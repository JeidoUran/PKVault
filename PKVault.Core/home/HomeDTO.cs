using PKHeX.Core;

namespace PKVault.Core;

public record HomeSnapshotDTO(string Id, string Label, string? CapturedAt, string DatePrecision,
    bool IsValid, string? Error, int PokemonCount, int BoxCount, int ShinyCount, int SpeciesCount,
    bool ExactSlots, string Fingerprint, string? Path = null);
public record HomeCollectionDTO(string Id, string Name, uint SourceId, string? ActiveSnapshotId,
    HomeSnapshotDTO[] Snapshots, string? Error, bool AutoSelectLatest = true);
public record HomePokemonDTO(string Id, string Box, int DisplayIndex, int? SlotIndex,
    ushort Species, byte Form, string Nickname, byte Gender, bool IsShiny, bool IsEgg,
    string Tracker, EntityContext SpriteContext, string[] Views, byte? Level);
public record HomeBoxDTO(string Id, string Name, int Order, bool ExactSlots, HomePokemonDTO[] Pokemon);
public record HomeInventoryDTO(string CollectionId, uint SourceId, HomeSnapshotDTO Snapshot, HomeBoxDTO[] Boxes);
public record HomeViewDTO(string Key, string Label, bool IsProjection, EntityContext Context,
    ushort Species, byte Form, string Nickname, byte Gender, bool IsShiny, int? Level,
    string OriginalTrainer, uint TID, uint SID, GameVersion OriginGame, int Language,
    string Tracker, uint PID, string Nature, int[] IVs, int[]? EVs, int? Ability,
    ushort[]? Moves, int? HeldItem, string? MetDate, int? MetLocation, string BlockHex,
    EntityContext SpriteContext, GameVersion? ContextVersion, List<byte> Types, byte? TeraType,
    int? Ball, bool IsAlpha, bool CanGigantamax, bool? IsAbilityHidden,
    MarkingColorUniversal[]? Markings, int[]? Stats, List<ushort>? RelearnMoves, ushort? AlphaMove,
    Dictionary<string, byte>? Ribbons, int[]? Contest, byte Friendship, byte EggHatchCount,
    Gender OriginalTrainerGender, string HandlingTrainer, Gender HandlingTrainerGender,
    bool FatefulEncounter, byte? MetLevel, string? MetLocationName, uint DisplayTid, uint? DisplaySid);
public record HomePokemonDetailsDTO(string Id, string Sha256, string SourcePath, string[] AvailableViews, HomeViewDTO View);
public record HomeSelectionInput(string CollectionId, string SnapshotId);
