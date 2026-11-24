$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $repoRoot
$PID | Set-Content (Join-Path $repoRoot 'logs/auto-round.pid')
$runner = (Get-Command npx.cmd).Source
& $runner tsx scripts/keep-auto-round.ts *>> (Join-Path $repoRoot 'logs/auto-round.out.log')
