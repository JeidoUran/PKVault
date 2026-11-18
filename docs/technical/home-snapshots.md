# HOME snapshots in this fork

HOME is a read-only source. It does not use a fake editable save file or enter the
storage/transfer loaders. Original PH4/EH4 bytes are validated against a manifest
and retained independently from disposable game projections provided by the custom
PKHeX.Core. Existing game blocks only are exposed; absent blocks are not rebuilt.
Champions data, when present, has a raw block view, not a reconstructed game entity.

## Configuration and identity

In settings, add a collection root to `HOME_PATHS` (one root per line in the UI).
The root must contain `home-collection.json`:

```json
{"schema_version":1,"collection_id":"home-main","name":"Pokémon HOME"}
```

Keep `collection_id` stable across exports and moves. Use a distinct ID for another
account/collection. Each immediate subdirectory containing `manifest-sha256.json`
is a snapshot. The original `2026-11-12` name remains valid with day precision.
New exports should use a UTC directory such as `2026-11-17T183000Z`.

```json
{
  "schema_version":1,
  "file_count":1,
  "files":[{
    "path":"Box 001/example.ph4",
    "bytes":304,
    "sha256":"<actual SHA-256>",
    "box_index":0,
    "slot_index":29,
    "box_name":"My box"
  }]
}
```

`bytes` and the hash must describe the actual original export, never the example
size above. Optional coordinates are zero-based. When any coordinates are absent,
the whole snapshot uses a compact per-box presentation and displays a warning;
names and original slots must not be inferred from species numbers in filenames.
The existing export did not record them. A future exporter also needs to record
empty boxes to preserve the complete layout; this first reader lists occupied boxes.

The newest valid snapshot is active by default. Browsing history does not change
the active observation. The explicit selection button pins a snapshot persistently
in the application's `config/home-selection.json`; “follow latest” returns to
automatic selection. Invalid snapshots remain visible with errors and never become
active automatically. A new manifest is validated on discovery. Refresh HOME
invalidates the cache and rechecks every source hash; ordinary browsing reuses the
validated bytes, rather than reopening thousands of files for each selected Pokémon.

## Counts and limits

One manifest entry is one Pokémon, regardless of the number of game blocks. Only
the active snapshot contributes to the common Pokédex. Historical previews and
game projections are never added. This first integration merges HOME ownership into
the common main-bank Pokédex bucket; filtering that bucket therefore includes HOME.
The owned details link back to the read-only HOME source. It does not create editable
copies in the bank. Separate HOME-specific Pokédex source filters remain future work.

No cross-source tracker deduplication between game saves and HOME is claimed:
observations captured at different times can describe the same individual in
different places. No legality verdict is shown by this initial HOME inspector.
Game saves continue using the pinned PKHeX legality engine normally.

Read endpoints are `GET /api/home`, `GET /api/home/snapshot`, `GET /api/home/pokemon`,
and `GET /api/home/download`. Download packages the original files and any original
manifest into a ZIP on request. `POST /api/home/selection` and `POST /api/home/rescan`
modify the app selection and cache only.
Selection requires no pending game/storage actions. This is local software with no
authentication added by this change; do not expose the development server publicly.

## Updating dependencies

The fork pins `PKVault.Core/PKHeX.Core.dll` and `pkhex-source.json` to an exact commit
of the custom PKHeX fork. A release number alone cannot identify master-only fixes.
Do not run the upstream release downloader `update-pkhex`, which would replace the
custom HOME reader. From PowerShell 7:

```powershell
./Scripts/Sync-PKHeX.ps1 -PKHeXPath ../PKHeX
```

This builds the already selected, clean local PKHeX checkout, updates the DLL and
provenance manifest, checks HOME and routing, and restores the previous pair if those
checks fail. It never pulls, merges, updates submodules, commits or pushes. After
success, run the full core tests and frontend build, restart, review and commit.

Review upstream changes weekly as a practical default, without a mandatory schedule.
Take urgent encounter/legality fixes earlier when needed. Merge PKHeX upstream into
the custom fork first, validate its HOME work, then synchronize the core here. Merge
PKVault upstream separately and verify its API compatibility. PokéAPI data/sprites/
cries need updating when their assets are needed, not with every legality fix. Keep
submodule commits pinned; share the existing sprite working directory through the
configured generation path. A dependency refresh is a reviewed batch, never an
unconditional recursive pull on app startup.
