using PKHeX.Core;
using PKVault.Core;

public sealed class MetLocationTests
{
    [Fact]
    public void RubyKeepsItsNativeLocation()
    {
        var pokemon = new PK3 { Version = GameVersion.R, MetLocation = 17 };
        Assert.Equal("Route 102", new ImmutablePKM(pokemon).GetOriginMetLocation("fr"));
    }

    [Theory]
    [InlineData("fr", "Parc des Amis")]
    [InlineData("en", "Pal Park")]
    public void GenerationThreeInGenerationFourUsesPalPark(string language, string expected)
    {
        var pokemon = new PK4 { Version = GameVersion.R, MetLocation = Locations.Transfer3 };
        Assert.Equal(expected, new ImmutablePKM(pokemon).GetOriginMetLocation(language));
    }

    [Theory]
    [InlineData(GameVersion.R, "fr", "Poké Fret")]
    [InlineData(GameVersion.HG, "en", "Poké Transfer")]
    public void ClassicTransfersUseTheGenerationFiveTable(GameVersion origin, string language, string expected)
    {
        var pokemon = new PK9 { Version = origin, MetLocation = Locations.Transfer4 };
        Assert.Equal(expected, new ImmutablePKM(pokemon).GetOriginMetLocation(language));
    }

    [Fact]
    public void ModernNpcTradeKeepsItsOwnLabel()
    {
        var pokemon = new PK9 { Version = GameVersion.SL, MetLocation = Locations.LinkTrade6NPC };
        Assert.Equal("Échange en réseau (NPC)", new ImmutablePKM(pokemon).GetOriginMetLocation("fr"));
    }

    [Fact]
    public void NativeUnovaLocationStaysReadableAfterTransfer()
    {
        var pokemon = new PK9 { Version = GameVersion.B, MetLocation = 45 };
        Assert.Equal("Palais de N", new ImmutablePKM(pokemon).GetOriginMetLocation("fr"));
    }
}
