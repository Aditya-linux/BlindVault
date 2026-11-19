# SP-1 helper: build upstream Gachapon example (local proof only).
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$example = Join-Path $root "vendor\magicblock-engine-examples\gachapon-example"
if (-not (Test-Path $example)) {
  Write-Error "Missing $example — clone magicblock-engine-examples into vendor/ first."
}
Set-Location $example
Write-Host "Building Gachapon at $example"
anchor build --ignore-keys
