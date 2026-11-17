[CmdletBinding()]
param([string]$PKHeXPath = (Join-Path $PSScriptRoot '../../PKHeX'))
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$source = (Resolve-Path -LiteralPath $PKHeXPath).Path
$git = if (Test-Path -LiteralPath "$env:ProgramFiles/Git/cmd/git.exe") { "$env:ProgramFiles/Git/cmd/git.exe" } else { (Get-Command git).Source }
$commit = & $git -C $source rev-parse HEAD
if ($LASTEXITCODE -ne 0) { throw 'PKHeX Git repository not found.' }
$dirty = & $git -C $source status --porcelain
if ($dirty) { throw 'Commit or preserve pending PKHeX changes before synchronizing a reproducible core.' }
$project = Join-Path $source 'PKHeX.Core/PKHeX.Core.csproj'
dotnet build $project -c Release "-p:SourceRevisionId=$commit" -v minimal
if ($LASTEXITCODE -ne 0) { throw 'PKHeX build failed; PKVault has not been changed.' }
$dll = Join-Path $repo 'PKVault.Core/PKHeX.Core.dll'
$manifest = Join-Path $repo 'PKVault.Core/pkhex-source.json'
$previousDll = [IO.File]::ReadAllBytes($dll)
$previousManifest = if (Test-Path -LiteralPath $manifest) { [IO.File]::ReadAllBytes($manifest) } else { $null }
try {
    Copy-Item -LiteralPath (Join-Path $source 'PKHeX.Core/bin/Release/net10.0/PKHeX.Core.dll') -Destination $dll
    [ordered]@{
        repository = 'https://github.com/JeidoUran/PKHeX'
        commit = $commit.Trim()
        configuration = 'Release'
        sha256 = (Get-FileHash -LiteralPath $dll -Algorithm SHA256).Hash.ToLowerInvariant()
    } | ConvertTo-Json | Set-Content -LiteralPath $manifest -Encoding utf8NoBOM
    dotnet build (Join-Path $repo 'PKVault.Core/PKVault.Core.csproj') -v minimal
    if ($LASTEXITCODE -ne 0) { throw 'PKVault is incompatible with this core.' }
    dotnet run --project (Join-Path $repo 'PKVault.Core.Tests') -- -class HomeServiceTests -class CoreRouterTests
    if ($LASTEXITCODE -ne 0) { throw 'HOME or routing validation failed.' }
} catch {
    [IO.File]::WriteAllBytes($dll, $previousDll)
    if ($null -ne $previousManifest) { [IO.File]::WriteAllBytes($manifest, $previousManifest) }
    elseif (Test-Path -LiteralPath $manifest) { Remove-Item -LiteralPath $manifest }
    throw
}
Write-Host "Core synchronized at $commit. Review, run the full tests, rebuild/restart PKVault, then commit the DLL and pkhex-source.json."
Write-Host 'No fetch, merge, submodule update, commit or push was performed.'
