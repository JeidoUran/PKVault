using System.Security.Cryptography;
using System.Text.Json;
using Moq;
using PKHeX.Core;
using PKVault.Core;

public sealed class HomeServiceTests : IDisposable
{
    private readonly string root = Path.Combine(Path.GetTempPath(), "pkvault-home-test-" + Guid.NewGuid());
    private readonly HomeService service;
    private readonly ISettingsService settingsService;
    public HomeServiceTests()
    {
        Directory.CreateDirectory(root);
        File.WriteAllText(Path.Combine(root, "home-collection.json"), "{\"schema_version\":1,\"collection_id\":\"test-home\"}");
        var settings = new Mock<ISettingsService>();
        settings.Setup(s => s.GetSettings()).Returns(new SettingsDTO(Guid.Empty, RuntimeSystem.WINDOWS,
            SourceProvider.GithubRelease, false, "test", "test", root, "", "test",
            new("test.db", [], [], root, root, true, true, HOME_PATHS: [root])));
        settingsService=settings.Object;
        service = new HomeService(settingsService, Path.Combine(root, "state", "selection.json"));
    }

    [Fact]
    public void UsesLatestValidSnapshotAndPersistsManualSelection()
    {
        Snapshot("2026-11-12"); Snapshot("2026-11-17T120000Z");
        var collection = Assert.Single(service.GetCollections());
        Assert.Equal("2026-11-17T120000Z", collection.ActiveSnapshotId);
        Assert.True(collection.AutoSelectLatest);
        Assert.Equal("2026-11-12", service.Select(new("test-home", "2026-11-12")).ActiveSnapshotId);
        service.ClearCache();
        Assert.Equal("2026-11-12", Assert.Single(service.GetCollections()).ActiveSnapshotId);
        Assert.Equal("2026-11-17T120000Z", service.Select(new("test-home", "")).ActiveSnapshotId);
    }

    [Fact]
    public void RejectsChangedFileWhenRefreshingWithoutEditingIt()
    {
        var file = Snapshot("2026-11-12");
        var inventory = service.GetInventory("test-home");
        Assert.Single(inventory.Boxes[0].Pokemon);
        File.AppendAllText(file, "tampered");
        var modified = File.ReadAllBytes(file);
        service.ClearCache();
        var collection = Assert.Single(service.GetCollections());
        Assert.Null(collection.ActiveSnapshotId);
        Assert.False(Assert.Single(collection.Snapshots).IsValid);
        Assert.Equal(modified, File.ReadAllBytes(file));
    }

    [Theory]
    [InlineData("../outside.ph4")]
    [InlineData("C:/outside.ph4")]
    [InlineData("Box 001/../Box 001/test.ph4")]
    public void RejectsEscapingPathsAndCanonicalDuplicates(string path)
    {
        Snapshot("2026-11-12");
        var manifest = Path.Combine(root, "2026-11-12", "manifest-sha256.json");
        var original = File.ReadAllText(manifest);
        if (path.Contains("Box"))
        {
            using var doc = JsonDocument.Parse(original);
            var file = doc.RootElement.GetProperty("files")[0];
            var second = new { path, bytes=file.GetProperty("bytes").GetInt32(), sha256=file.GetProperty("sha256").GetString() };
            File.WriteAllText(manifest, JsonSerializer.Serialize(new { schema_version=1,file_count=2, files=new object[] { file.Clone(), second } }));
        }
        else File.WriteAllText(manifest, original.Replace("Box 001/test.ph4", path));
        Assert.False(Assert.Single(Assert.Single(service.GetCollections()).Snapshots).IsValid);
    }

    [Fact]
    public void CoreOnlyPokemonHasOneEntryAndNoInventedGameView()
    {
        var file = Snapshot("2026-11-12");
        var original = File.ReadAllBytes(file);
        var inventory = service.GetInventory("test-home");
        var p = Assert.Single(Assert.Single(inventory.Boxes).Pokemon);
        Assert.Equal(new[] { "core" }, p.Views);
        Assert.Equal(1, inventory.Snapshot.PokemonCount);
        Assert.False(inventory.Snapshot.ExactSlots);
        var detail = service.GetPokemon("test-home", "2026-11-12", p.Id, "core");
        Assert.Equal((ushort)25, detail.View.Species);
        Assert.Null(detail.View.Level);
        Assert.Throws<ArgumentException>(() => service.GetPokemon("test-home", "2026-11-12", p.Id, "PK9"));
        Assert.Equal(original, File.ReadAllBytes(file));
    }

    [Fact]
    public void PreservesDeclaredSlotsAndRejectsDuplicateSlot()
    {
        Snapshot("2026-11-12", slot:29);
        var box = Assert.Single(service.GetInventory("test-home").Boxes);
        Assert.True(box.ExactSlots);
        Assert.Equal(29, Assert.Single(box.Pokemon).SlotIndex);
        var manifest = Path.Combine(root,"2026-11-12","manifest-sha256.json");
        var source = File.ReadAllText(manifest);
        File.Copy(Path.Combine(root,"2026-11-12","Box 001","test.ph4"), Path.Combine(root,"2026-11-12","Box 001","second.ph4"));
        using var doc = JsonDocument.Parse(source);
        var file = doc.RootElement.GetProperty("files")[0].GetRawText();
        File.WriteAllText(manifest,"{\"schema_version\":1,\"file_count\":2,\"files\":["+file+","+file.Replace("test.ph4","second.ph4")+"]}");
        Assert.False(Assert.Single(Assert.Single(service.GetCollections()).Snapshots).IsValid);
    }

    [Fact]
    public void CorruptNewerSnapshotDoesNotReplaceValidOlderSnapshot()
    {
        Snapshot("2026-11-12"); var invalid=Snapshot("2026-11-17T120000Z");
        var data=File.ReadAllBytes(invalid); data[^1]^=0xFF; File.WriteAllBytes(invalid,data);
        var c=Assert.Single(service.GetCollections());
        Assert.Equal("2026-11-12",c.ActiveSnapshotId);
        Assert.Single(c.Snapshots,s=>!s.IsValid);
    }

    [Fact]
    public async Task DexUsesOnlyActiveSnapshotAndUnionsWithExistingBank()
    {
        Snapshot("2026-11-12",species:25); Snapshot("2026-11-17T120000Z",species:26);
        var data=new StaticDataService(settingsService);
        Dictionary<ushort,Dictionary<uint,DexItemDTO>> dex=[];
        await service.AddToDex(dex,null,data);
        Assert.Equal(new ushort[]{26},dex.Keys);
        Assert.True(Assert.Single(Assert.Single(dex[26]).Value.Forms).IsOwned);
        service.Select(new("test-home","2026-11-12")); dex.Clear();
        await service.AddToDex(dex,null,data);
        Assert.Equal(new ushort[]{25},dex.Keys);
        await service.AddToDex(dex,null,data);
        Assert.Single(Assert.Single(dex[25]).Value.Forms);
    }

    [Fact]
    public void MultipleGameBlocksRemainOnePokemonAndViewsCannotChangeSource()
    {
        var file=Snapshot("2026-11-12",withGameViews:true);
        var original=File.ReadAllBytes(file);
        var inventory=service.GetInventory("test-home");
        var p=Assert.Single(Assert.Single(inventory.Boxes).Pokemon);
        Assert.Equal(1,inventory.Snapshot.PokemonCount);
        Assert.Contains("PK9",p.Views); Assert.Contains("PK8",p.Views);
        foreach(var view in p.Views) _=service.GetPokemon("test-home","2026-11-12",p.Id,view);
        Assert.Equal(original,File.ReadAllBytes(file));
    }

    private string Snapshot(string id, int? slot=null, ushort species=25, bool withGameViews=false)
    {
        var dir=Path.Combine(root,id,"Box 001"); Directory.CreateDirectory(dir);
        var pokemon=new PKH { Species=species, Nickname="TEST", OriginalTrainerName="TEST", Tracker=123, Version=GameVersion.GO, Language=2 };
        if(withGameViews)
        {
            pokemon=PKH.ConvertFromPKM(new PK9 { Species=species, Nickname="TEST", OriginalTrainerName="TEST", Version=GameVersion.VL, Language=2 });
            _=pokemon.ConvertToPK8();
        }
        byte[] buffer=new byte[0x330]; int length=pokemon.WriteDecryptedDataStored(buffer);
        var bytes=buffer[..length];
        var path=Path.Combine(dir,"test.ph4"); File.WriteAllBytes(path,bytes);
        var file=new Dictionary<string,object> { ["path"]="Box 001/test.ph4",["bytes"]=bytes.Length,["sha256"]=Convert.ToHexString(SHA256.HashData(bytes)) };
        if(slot.HasValue) { file["slot_index"]=slot.Value; file["box_index"]=0; file["box_name"]="My Box"; }
        File.WriteAllText(Path.Combine(root,id,"manifest-sha256.json"),JsonSerializer.Serialize(new { schema_version=1,file_count=1,files=new[]{file} }));
        return path;
    }
    public void Dispose()
    {
        var full=Path.GetFullPath(root);
        if(!full.StartsWith(Path.GetFullPath(Path.GetTempPath()),StringComparison.OrdinalIgnoreCase) || !Path.GetFileName(full).StartsWith("pkvault-home-test-"))
            throw new InvalidOperationException("Unexpected test directory");
        Directory.Delete(full,true);
    }
}
