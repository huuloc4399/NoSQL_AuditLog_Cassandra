$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$stateDir = Join-Path $taskRoot '.runtime'
& (Join-Path $PSScriptRoot 'stop-share-demo.ps1')
foreach ($name in @('frontend', 'backend')) {
    $recordPath = Join-Path $stateDir "$name.process.json"
    if (-not (Test-Path -LiteralPath $recordPath)) { continue }
    $record = Get-Content -LiteralPath $recordPath -Raw | ConvertFrom-Json
    $process = Get-Process -Id $record.pid -ErrorAction SilentlyContinue
    if (-not $process) { continue }
    $command = Get-CimInstance Win32_Process -Filter "ProcessId = $($process.Id)"
    $sameTime = [Math]::Abs(($process.StartTime - ([DateTime]$record.started)).TotalSeconds) -lt 1
    if ($sameTime -and $process.Path -eq $record.executable -and $command.CommandLine -match 'dist/server.js|node_modules/vite/bin/vite.js') {
        Stop-Process -Id $process.Id
        Write-Host "Stopped this project's $name process."
    }
}
. (Join-Path $PSScriptRoot 'project-wsl.ps1')
$linuxRoot = Get-ProjectLinuxRoot
& $projectWslExe @projectWslArgs bash "$linuxRoot/scripts/cassandra-wsl.sh" stop
if ($LASTEXITCODE -ne 0) { throw 'Cassandra stop failed.' }
Write-Host 'Database data has been preserved.'
