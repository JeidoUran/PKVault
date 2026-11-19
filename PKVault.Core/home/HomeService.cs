using System.Globalization;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using PKHeX.Core;

namespace PKVault.Core;

/// <summary>Reads declared HOME snapshots. Original bytes never enter PKVault's editing/storage loaders.</summary>
public sealed class HomeService(ISettingsService settingsService, PkmLegalityService pkmLegalityService, string? statePath = null)
{
    private readonly object gate = new();
    private readonly Dictionary<string, Snapshot> cache = new(StringComparer.Ordinal);
    private string SelectionPath => statePath ?? Path.Combine(SettingsService.AppDirectory, "config", "home-selection.json");
    private sealed record Entry(HomePokemonDTO DTO, HomeFile File, string Hash, string RelativePath, string BoxName, int BoxOrder);
    private sealed record Snapshot(HomeSnapshotDTO DTO, Entry[] Entries, byte[]? Manifest = null);
    private sealed record Collection(string Id, string Name, string Root, uint SourceId);
    private static readonly Dictionary<string, (HomeGameDataFormat Format, string Label)> Views = new()
    {
        ["PB7"] = (HomeGameDataFormat.PB7, "Let's Go, Pikachu / Évoli"),
        ["PK8"] = (HomeGameDataFormat.PK8, "Épée / Bouclier"),
        ["PA8"] = (HomeGameDataFormat.PA8, "Légendes Arceus"),
        ["PB8"] = (HomeGameDataFormat.PB8, "Diamant Étincelant / Perle Scintillante"),
        ["PK9"] = (HomeGameDataFormat.PK9, "Écarlate / Violet"),
        ["PA9"] = (HomeGameDataFormat.PA9, "Légendes Z-A"),
        ["PC9"] = (HomeGameDataFormat.PC9, "Champions — bloc brut")
    };
    private static readonly System.Reflection.PropertyInfo[] CoreRibbonProperties = typeof(GameDataCore).GetProperties()
        .Where(p => p.Name.StartsWith(RibbonInfo.PropertyPrefix, StringComparison.Ordinal)
            && (p.PropertyType == typeof(bool) || p.PropertyType == typeof(byte)))
        .ToArray();

    // A catalogue entry identifies the form and its growth rate even for a core-only export.
    private static readonly (HomeGameDataFormat Format, EntityContext Context, IPersonalTable Table)[] DisplayTables =
    [
        (HomeGameDataFormat.PK9, EntityContext.Gen9, PersonalTable.SV),
        (HomeGameDataFormat.PA9, EntityContext.Gen9a, PersonalTable.ZA),
        (HomeGameDataFormat.PK8, EntityContext.Gen8, PersonalTable.SWSH),
        (HomeGameDataFormat.PB8, EntityContext.Gen8b, PersonalTable.BDSP),
        (HomeGameDataFormat.PA8, EntityContext.Gen8a, PersonalTable.LA),
        (HomeGameDataFormat.PB7, EntityContext.Gen7b, PersonalTable.GG),
        (HomeGameDataFormat.None, EntityContext.Gen7, PersonalTable.USUM),
    ];

    private static (EntityContext Context, PersonalInfo? Personal) GetDisplayInfo(HomeFile file, PKH entity)
    {
        var species = entity.Species;
        var form = entity.Form;
        foreach (var (format, context, table) in DisplayTables)
        {
            if (file.HasFormat(format) && table.IsPresentInGame(species, form))
                return (context, table.GetFormEntry(species, form));
        }
        foreach (var (_, context, table) in DisplayTables)
        {
            if (table.IsPresentInGame(species, form))
                return (context, table.GetFormEntry(species, form));
        }
        foreach (var (_, context, table) in DisplayTables)
        {
            if (table.IsSpeciesInGame(species))
                return (context, table.GetFormEntry(species, 0));
        }
        return (EntityContext.Gen9a, null);
    }

    public void ClearCache() { lock (gate) cache.Clear(); }
    public HomeCollectionDTO[] GetCollections()
    {
        lock (gate)
        {
            var result = new List<HomeCollectionDTO>();
            var used = new HashSet<string>(StringComparer.Ordinal);
            foreach (var root in settingsService.GetSettings().SettingsMutable.HOME_PATHS ?? [])
            {
                try
                {
                    var collection = ReadCollection(root);
                    if (!used.Add(collection.Id)) throw new InvalidDataException("Identifiant de collection HOME en double.");
                    var snapshots = Discover(collection);
                    var selected = ReadSelections().GetValueOrDefault(collection.Id);
                    var active = snapshots.FirstOrDefault(s => s.DTO.Id == selected && s.DTO.IsValid)
                        ?? snapshots.FirstOrDefault(s => s.DTO.IsValid);
                    result.Add(new(collection.Id, collection.Name, collection.SourceId, active?.DTO.Id,
                        snapshots.Select(s => s.DTO).ToArray(), null, selected == null));
                }
                catch (Exception ex) when (ex is InvalidDataException or IOException or UnauthorizedAccessException or JsonException or ArgumentException or KeyNotFoundException or InvalidOperationException)
                {
                    result.Add(new("invalid-" + result.Count, "Pokémon HOME", 0, null, [], ex.Message));
                }
            }
            return result.ToArray();
        }
    }

    public HomeInventoryDTO GetInventory(string collectionId, string? snapshotId = null)
    {
        lock (gate)
        {
            var (collection, snapshot) = Resolve(collectionId, snapshotId);
            var boxes = snapshot.Entries.GroupBy(e => e.DTO.Box).Select(group => new HomeBoxDTO(
                group.Key, group.First().BoxName, group.First().BoxOrder,
                snapshot.DTO.ExactSlots, group.Select(e => e.DTO).OrderBy(p => p.DisplayIndex).ToArray()
            )).OrderBy(b => b.Order).ThenBy(b => b.Id, StringComparer.Ordinal).ToArray();
            return new(collection.Id, collection.SourceId, snapshot.DTO, boxes);
        }
    }

    public HomeCollectionDTO Select(HomeSelectionInput input)
    {
        lock (gate)
        {
            _ = Resolve(input.CollectionId, string.IsNullOrEmpty(input.SnapshotId) ? null : input.SnapshotId);
            var selections = ReadSelections();
            if (string.IsNullOrEmpty(input.SnapshotId)) selections.Remove(input.CollectionId);
            else selections[input.CollectionId] = input.SnapshotId;
            Directory.CreateDirectory(Path.GetDirectoryName(SelectionPath)!);
            var temp = SelectionPath + ".tmp";
            File.WriteAllText(temp, JsonSerializer.Serialize(selections, HomeJsonContext.Default.DictionaryStringString));
            File.Move(temp, SelectionPath, true);
            return GetCollections().Single(c => c.Id == input.CollectionId);
        }
    }

    public HomePokemonDetailsDTO GetPokemon(string collectionId, string snapshotId, string entryId, string view)
    {
        Entry entry;
        lock (gate)
        {
            var (_, snapshot) = Resolve(collectionId, snapshotId);
            entry = snapshot.Entries.FirstOrDefault(e => e.DTO.Id == entryId)
                ?? throw new KeyNotFoundException("Pokémon absent de cet instantané.");
        }

        var home = entry.File.CreateEntity();
        PKM entity = home;
        byte[] block;
        string label;
        bool projection = view != "core";
        if (view == "core")
        {
            block = entry.File.GetBlockBytes(HomeGameDataFormat.None);
            label = "HOME — données communes";
        }
        else
        {
            if (!Views.TryGetValue(view, out var v) || !entry.File.HasFormat(v.Format))
                throw new ArgumentException("Ce bloc de jeu n'est pas présent dans le fichier HOME.");
            label = v.Label;
            block = entry.File.GetBlockBytes(v.Format);
            entity = v.Format == HomeGameDataFormat.PC9 ? home
                : entry.File.CreateGameEntity(v.Format, allowReconstruction: false)
                    ?? throw new InvalidDataException("Projection indisponible pour ce bloc.");
        }
        var game = entity is PKH ? null : new ImmutablePKM(entity);
        var pkm = game ?? new ImmutablePKM(home);
        // Only a game block present in this snapshot can supply encounter data.
        var encounterPkm = game ?? (view == "core" && entry.File.CreateProjection() is { } recorded
            ? new ImmutablePKM(recorded)
            : null);
        var language = settingsService.GetSettings().GetLanguageForPKHeX();
        var (spriteContext, personal) = GetDisplayInfo(entry.File, home);
        var context = game?.Context;
        return new(entry.DTO.Id, entry.Hash, entry.RelativePath, entry.DTO.Views,
            new(view, label, projection, entity.Context, entity.Species, entity.Form,
                pkm.Nickname, (byte)pkm.Gender, pkm.IsShiny, game?.CurrentLevel ?? entry.DTO.Level,
                pkm.OriginTrainerName, entity.TID16, entity.SID16, pkm.Version, entity.Language,
                entry.DTO.Tracker, entity.PID, pkm.Nature.ToString(), pkm.IVs, pkm.EVs,
                game?.Ability, game?.Moves.ToArray(), game?.HeldItem,
                pkm.OriginMetDate?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                encounterPkm?.MetLocation, Convert.ToHexString(block),
                context ?? spriteContext,
                context.HasValue ? (entity.Version.Context == context.Value ? entity.Version : context.Value.GetSingleGameVersion()) : null,
                game?.Types ?? (personal == null ? [] : DexGenService.GetTypes(spriteContext.Generation, personal)),
                game?.TeraType,
                game == null ? null : PokeApiFromPKHeX.GetBallPokeApiId((Ball)game.Ball),
                game?.IsAlpha ?? false, game?.CanGigantamax ?? false, game?.IsAbilityHidden,
                pkm.Markings, game?.Stats, game?.RelearnMoves, game?.AlphaMove,
                game == null ? ReadCoreRibbons(home.Core) : game.Ribbons,
                pkm.Contest, pkm.Friendship, pkm.EggHatchCount,
                pkm.OriginTrainerGender, pkm.HandlingTrainerName, pkm.HandlingTrainerGender,
                pkm.FatefulEncounter, encounterPkm?.OriginMetLevel ?? pkm.OriginMetLevel,
                encounterPkm?.GetOriginMetLocation(language),
                pkm.TID, pkm.SID, encounterPkm == null ? [] : pkmLegalityService.GetEncounterSummary(encounterPkm)));
    }

    private static Dictionary<string, byte> ReadCoreRibbons(GameDataCore core)
    {
        return CoreRibbonProperties.Select(p => (p.Name, Count: p.GetValue(core) switch
        {
            true => (byte)1,
            byte count => count,
            _ => (byte)0,
        })).Where(p => p.Count > 0).ToDictionary(p => p.Name, p => p.Count);
    }

    public CoreFileResponse Download(string collectionId, string? snapshotId)
    {
        Snapshot snapshot;
        lock (gate)
            (_, snapshot) = Resolve(collectionId, snapshotId);

        var manifestBytes = snapshot.Manifest ?? throw new InvalidDataException("Manifeste HOME absent.");
        const string contentType = "application/zip";
        var output = new MemoryStream();
        try
        {
            using (var archive = new ZipArchive(output, ZipArchiveMode.Create, leaveOpen: true))
            {
                using (var manifest = archive.CreateEntry("manifest-sha256.json", CompressionLevel.Fastest).Open())
                    manifest.Write(manifestBytes);
                foreach (var entry in snapshot.Entries)
                {
                    using var file = archive.CreateEntry(entry.RelativePath.Replace('\\', '/'), CompressionLevel.Fastest).Open();
                    file.Write(entry.File.GetOriginalData());
                }
            }
            output.Position = 0;
            return new(new(output, contentType, $"pokemon-home-{collectionId}-{snapshot.DTO.Id}.zip"),
                200, contentType, []);
        }
        catch
        {
            output.Dispose();
            throw;
        }
    }

    /// <summary>Add only the selected HOME observation to the common bank Pokédex. No historical/projection duplicates.</summary>
    public async Task AddToDex(Dictionary<ushort, Dictionary<uint, DexItemDTO>> dex, HashSet<ushort>? speciesSet,
        StaticDataService staticData)
    {
        var speciesData = await staticData.GetStaticSpecies();
        lock (gate)
        {
            foreach (var collection in GetCollections().Where(c => c.ActiveSnapshotId != null && c.Error == null))
            {
                var (_, snapshot) = Resolve(collection.Id, collection.ActiveSnapshotId);
                foreach (var speciesGroup in snapshot.Entries.Where(e => !e.DTO.IsEgg)
                    .Where(e => speciesSet == null || speciesSet.Contains(e.DTO.Species)).GroupBy(e => e.DTO.Species))
                {
                    var forms = new List<DexItemForm>();
                    foreach (var group in speciesGroup.GroupBy(e => (e.DTO.Form, e.DTO.Gender)))
                    {
                        var sample = group.First();
                        var projection = sample.File.CreateProjection();
                        var context = projection?.Context ?? EntityContext.Gen9a;
                        var staticForms = speciesData.GetValueOrDefault(speciesGroup.Key)?.Forms.GetValueOrDefault((byte)context);
                        if (staticForms == null || group.Key.Form >= staticForms.Length) continue;
                        var pi = projection?.PersonalInfo ?? PersonalTable.ZA.GetFormEntry(speciesGroup.Key, group.Key.Form);
                        forms.Add(new($"home-{collection.Id}-{speciesGroup.Key}-{group.Key.Form}-{group.Key.Gender}",
                            speciesGroup.Key, group.Key.Form, (Gender)group.Key.Gender,
                            DexGenService.GetTypes(context.Generation, pi), GetAbilities(pi),
                            pi is IPersonalAbility12H ability ? ability.AbilityH : 0,
                            [pi.HP, pi.ATK, pi.DEF, pi.SPA, pi.SPD, pi.SPE],
                            true, group.Any(e => e.DTO.IsShiny), false, true, true,
                            group.Any(e => e.DTO.IsShiny), false, context, context.Generation));
                    }
                    if (forms.Count == 0) continue;
                    if (!dex.TryGetValue(speciesGroup.Key, out var bySource)) dex[speciesGroup.Key] = bySource = [];
                    // The normal UI already treats the main bank as the aggregate non-game source.
                    var id = FakeSaveFile.Default.ID32;
                    if (bySource.TryGetValue(id, out var existing))
                    {
                        foreach (var form in forms)
                        {
                            var old = existing.Forms.FirstOrDefault(f => f.Form == form.Form && f.Gender == form.Gender);
                            if (old == null) existing.Forms.Add(form);
                            else
                            {
                                existing.Forms.Remove(old);
                                existing.Forms.Add(old with { IsSeen = true, IsCaught = true, IsOwned = true,
                                    IsOwnedShiny = old.IsOwnedShiny || form.IsOwnedShiny, IsSeenShiny = old.IsSeenShiny || form.IsSeenShiny });
                            }
                        }
                        bySource[id] = existing with { Languages = existing.Languages.Concat(speciesGroup.Select(e => (LanguageID)e.File.CreateEntity().Language)).Distinct().ToArray() };
                    }
                    else bySource[id] = new($"{speciesGroup.Key}_{id}", speciesGroup.Key, id, forms,
                        speciesGroup.Select(e => (LanguageID)e.File.CreateEntity().Language).Distinct().ToArray());
                }
            }
        }
    }

    private (Collection, Snapshot) Resolve(string id, string? snapshotId)
    {
        var configured = GetCollections().FirstOrDefault(c => c.Id == id && c.Error == null)
            ?? throw new KeyNotFoundException("Collection HOME introuvable.");
        Collection? collection = null;
        foreach (var root in settingsService.GetSettings().SettingsMutable.HOME_PATHS ?? [])
        {
            try { var candidate = ReadCollection(root); if (candidate.Id == id) { collection = candidate; break; } }
            catch (Exception ex) when (ex is InvalidDataException or IOException or UnauthorizedAccessException or JsonException or ArgumentException or KeyNotFoundException) { }
        }
        if (collection == null) throw new KeyNotFoundException("Collection HOME introuvable.");
        var snapshots = Discover(collection);
        var selected = snapshotId ?? configured.ActiveSnapshotId;
        var snapshot = snapshots.FirstOrDefault(s => s.DTO.Id == selected)
            ?? throw new KeyNotFoundException("Instantané HOME introuvable.");
        if (!snapshot.DTO.IsValid) throw new InvalidDataException(snapshot.DTO.Error);
        return (collection, snapshot);
    }
    private Collection ReadCollection(string configuredRoot)
    {
        var root = Path.GetFullPath(configuredRoot);
        var config = SafePath(root, "home-collection.json");
        using var document = JsonDocument.Parse(File.ReadAllBytes(config));
        if (document.RootElement.GetProperty("schema_version").GetInt32() != 1) throw new InvalidDataException("Version de collection HOME inconnue.");
        var id = document.RootElement.GetProperty("collection_id").GetString()!;
        if (!System.Text.RegularExpressions.Regex.IsMatch(id, "^[a-zA-Z0-9_-]{1,80}$")) throw new InvalidDataException("Identifiant HOME invalide.");
        var name = document.RootElement.TryGetProperty("name", out var n) ? n.GetString() ?? "Pokémon HOME" : "Pokémon HOME";
        var hash = SHA256.HashData(Encoding.UTF8.GetBytes("home:" + id));
        return new(id, name, root, BitConverter.ToUInt32(hash) | 0x80000000);
    }
    private Snapshot[] Discover(Collection collection)
    {
        var snapshots = new List<Snapshot>();
        foreach (var dir in Directory.EnumerateDirectories(collection.Root).Order(StringComparer.Ordinal))
        {
            if (!File.Exists(Path.Combine(dir, "manifest-sha256.json"))) continue;
            try { snapshots.Add(LoadSnapshot(dir)); }
            catch (Exception ex) when (ex is InvalidDataException or IOException or JsonException or UnauthorizedAccessException or ArgumentException or KeyNotFoundException or InvalidOperationException)
            {
                snapshots.Add(new(new(Path.GetFileName(dir), Path.GetFileName(dir), null, "unknown", false,
                    ex.Message, 0, 0, 0, 0, false, ""), []));
            }
        }
        return snapshots.OrderByDescending(s => s.DTO.CapturedAt, StringComparer.Ordinal)
            .ThenByDescending(s => s.DTO.Id, StringComparer.Ordinal).ToArray();
    }
    private Snapshot LoadSnapshot(string directory)
    {
        var manifestPath = SafePath(directory, "manifest-sha256.json");
        var raw = File.ReadAllBytes(manifestPath);
        // Snapshots are immutable observations. Keep their validated original bytes in memory;
        // a new manifest or explicit refresh revalidates every source file.
        var stamp = Convert.ToHexString(SHA256.HashData(raw));
        if (cache.TryGetValue(directory, out var cached) && cached.DTO.Fingerprint == stamp) return cached;
        using var document = JsonDocument.Parse(raw);
        var root = document.RootElement;
        if (root.GetProperty("schema_version").GetInt32() != 1) throw new InvalidDataException("Version du manifeste HOME inconnue.");
        var files = root.GetProperty("files").EnumerateArray().ToArray();
        if (root.GetProperty("file_count").GetInt32() != files.Length) throw new InvalidDataException("Nombre de fichiers du manifeste incohérent.");
        if (files.Length > 100000) throw new InvalidDataException("Instantané HOME trop volumineux.");
        var paths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var file in files)
        {
            var relative = file.GetProperty("path").GetString()!;
            var path = SafePath(directory, relative);
            if (!paths.Add(path)) throw new InvalidDataException("Chemin HOME en double.");
            if (!HomeFile.IsHomeExtension(Path.GetExtension(path))) throw new InvalidDataException("Le manifeste contient un format autre que PH4/EH4.");
            var info = new FileInfo(path);
            if (!info.Exists || info.Length > 0x330 || info.Length != file.GetProperty("bytes").GetInt64()) throw new InvalidDataException("Fichier HOME absent ou de taille incorrecte : " + relative);
        }
        var boxCounts = new Dictionary<string, int>(StringComparer.Ordinal);
        var entries = new List<Entry>();
        bool exact = files.Length > 0 && files.All(f => f.TryGetProperty("slot_index", out _) && f.TryGetProperty("box_index", out _));
        var usedSlots = new HashSet<(string, int)>();
        foreach (var file in files.OrderBy(f => f.GetProperty("path").GetString(), StringComparer.Ordinal))
        {
            var relative = file.GetProperty("path").GetString()!;
            var data = File.ReadAllBytes(SafePath(directory, relative));
            var hash = Convert.ToHexString(SHA256.HashData(data));
            if (!hash.Equals(file.GetProperty("sha256").GetString(), StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("Empreinte HOME incorrecte : " + relative);
            if (!HomeFile.TryCreate(data, out var home)) throw new InvalidDataException("Fichier HOME invalide : " + relative);
            var entity = home.CreateEntity();
            var (context, personal) = GetDisplayInfo(home, entity);
            var box = Path.GetDirectoryName(relative)?.Replace('\\', '/') ?? "HOME";
            var boxName = file.TryGetProperty("box_name", out var bname) ? bname.GetString() ?? box : box;
            int order = file.TryGetProperty("box_index", out var index) ? index.GetInt32() : ExtractBoxOrder(box);
            if (order < 0) throw new InvalidDataException("Numéro de boîte HOME invalide.");
            int? slot = exact ? file.GetProperty("slot_index").GetInt32() : null;
            if (slot is < 0 or > 29 || slot.HasValue && !usedSlots.Add((box, slot.Value))) throw new InvalidDataException("Emplacement HOME invalide ou en double.");
            var id = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(relative))).ToLowerInvariant();
            var tracker = entity.Tracker.ToString("X16", CultureInfo.InvariantCulture);
            var views = new[] { "core" }.Concat(home.AvailableFormats.ToArray().Select(f => f.ToString()).Where(Views.ContainsKey)).ToArray();
            int boxCount = boxCounts.GetValueOrDefault(box);
            if (boxCount == 30) throw new InvalidDataException("Plus de 30 Pokémon dans une boîte HOME.");
            boxCounts[box] = boxCount + 1;
            byte? level = personal == null ? null : Experience.GetLevel(entity.EXP, personal.EXPGrowth);
            entries.Add(new(new(id, box, slot ?? boxCount, slot,
                entity.Species, entity.Form, entity.Nickname, entity.Gender, entity.IsShiny, entity.IsEgg,
                tracker, context, views, level), home, hash.ToLowerInvariant(), relative, boxName, order));
        }
        var snapshotId = Path.GetFileName(directory);
        string? captured = null;
        string precision = "unknown";
        if (DateOnly.TryParseExact(snapshotId, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var day))
        { captured = day.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture); precision = "day"; }
        else if (DateTimeOffset.TryParseExact(snapshotId, "yyyy-MM-dd'T'HHmmss'Z'", CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeUniversal, out var moment)) { captured = moment.ToUniversalTime().ToString("O"); precision = "second"; }
        var dto = new HomeSnapshotDTO(snapshotId, captured ?? snapshotId, captured, precision, true, null,
            entries.Count, boxCounts.Count, entries.Count(e => e.DTO.IsShiny),
            entries.Where(e => !e.DTO.IsEgg).Select(e => e.DTO.Species).Distinct().Count(), exact, stamp, FileIOService.NormalizePath(directory));
        return cache[directory] = new(dto, entries.ToArray(), raw);
    }
    private Dictionary<string, string> ReadSelections() => File.Exists(SelectionPath)
        ? JsonSerializer.Deserialize(File.ReadAllText(SelectionPath), HomeJsonContext.Default.DictionaryStringString) ?? [] : [];
    private static int ExtractBoxOrder(string box)
    {
        var match = System.Text.RegularExpressions.Regex.Match(box, @"\d+");
        return match.Success && int.TryParse(match.Value, out var value) ? value : int.MaxValue;
    }
    private static int[] GetAbilities(PersonalInfo pi)
    {
        Span<int> abilities = stackalloc int[pi.AbilityCount];
        pi.GetAbilities(abilities);
        return abilities.ToArray().Distinct().ToArray();
    }
    internal static string SafePath(string root, string relative)
    {
        if (string.IsNullOrWhiteSpace(relative) || Path.IsPathRooted(relative) || relative.Contains(':')
            || relative.Split('/', '\\').Any(component => component is "" or "." or "..")) throw new InvalidDataException("Chemin de fichier HOME invalide.");
        var fullRoot = Path.GetFullPath(root);
        var path = Path.GetFullPath(Path.Combine(fullRoot, relative));
        if (!path.StartsWith(fullRoot.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("Le chemin HOME sort de son instantané.");
        for (var current = new FileInfo(path) as FileSystemInfo; current != null; current = Directory.GetParent(current.FullName))
        {
            if ((File.Exists(current.FullName) || Directory.Exists(current.FullName)) && (File.GetAttributes(current.FullName) & FileAttributes.ReparsePoint) != 0)
                throw new InvalidDataException("Les liens de fichiers/dossiers ne sont pas acceptés dans un instantané HOME.");
            if (current.FullName.Equals(fullRoot, StringComparison.OrdinalIgnoreCase)) break;
        }
        return path;
    }
}
