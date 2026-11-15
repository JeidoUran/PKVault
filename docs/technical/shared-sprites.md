# Reuse an existing PokéAPI sprites library

Normal application use does not need the PokéAPI Git submodules. The core
embeds generated JSON data; the frontend bundles the sprite sheets. A source checkout may need to
rebuild the sheets once before building the application.

Set `PKVAULT_SPRITES_PATH` to an existing clone of PokeAPI/sprites (the directory
containing `sprites/pokemon`, not `sprites/pokemon` itself). No files in this
source directory are changed. When unset, the original `pokeapi/sprites` path
is used.

From the PKVault repository root, in PowerShell:

```powershell
$env:PKVAULT_SPRITES_PATH = 'G:\GitProjects\Pokémon\pokemon-database\assets\library\pokeapi\data\v2\sprites'
dotnet run --project Scripts -- gen-spritesheets
dotnet build PKVault.Backend
```

`gen-spritesheets` uses the static species and item metadata already embedded
in PKVault.Core, without fetching or regenerating PokéAPI API data. It writes
only PKVault's generated atlas/diff and `frontend/public/imgs/sheets`. Rebuild
the frontend and core after generation to include the resulting resources. The selected library must contain every
image referenced by that metadata; a missing image stops generation.

Full `gen-static-data` generation still requires the separate `PokeAPI/api-data`
submodule. The Django `PokeAPI/pokeapi` repository in Pokémon Database contains
CSV sources and is not a drop-in replacement for `PokeAPI/api-data` JSON files.

Do not junction one repository's submodule worktree to another: updating the
submodule could change the shared library's checked-out revision.

The local game icons in `frontend/src/assets/game_icons` were copied from
Pokémon Database's `assets/library/collection/game_icons/Database_Final` on
2026-11-14. Their source-to-target mapping is recorded in `custom-game-icons.json`.
