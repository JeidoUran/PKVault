namespace PKVault.Core;

[Route("api/home")]
public class HomeController(HomeService home, ISessionService session)
{
    [HttpGet()]
    public HomeCollectionDTO[] GetAll() => home.GetCollections();
    [HttpGet("snapshot")]
    public HomeInventoryDTO GetSnapshot(string collectionId, string? snapshotId = null) => home.GetInventory(collectionId, snapshotId);
    [HttpGet("pokemon")]
    public HomePokemonDetailsDTO GetPokemon(string collectionId, string snapshotId, string entryId, string view = "core") => home.GetPokemon(collectionId, snapshotId, entryId, view);
    [HttpPost("selection")]
    public HomeCollectionDTO Select(HomeSelectionInput input)
    {
        if (!session.HasEmptyActionList()) throw new InvalidOperationException("Enregistrer ou annuler les actions avant de changer l'instantané HOME actif.");
        return home.Select(input);
    }
    [HttpPost("rescan")]
    public HomeCollectionDTO[] Rescan() { home.ClearCache(); return home.GetCollections(); }
}
