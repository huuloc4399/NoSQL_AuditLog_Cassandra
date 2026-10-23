$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
foreach ($name in @('cloudflare-tunnel', 'share-server')) {
    $recordPath = Join-Path $taskRoot ".runtime\$name.process.json"
    if (-not (Test-Path -LiteralPath $recordPath)) { continue }
    $record = Get-Content -LiteralPath $recordPath -Raw | ConvertFrom-Json
    $running = Get-Process -Id $record.pid -ErrorAction SilentlyContinue
    if (-not $running) { continue }
    $command = Get-CimInstance Win32_Process -Filter "ProcessId = $($running.Id)"
    $matches = if ($name -eq 'cloudflare-tunnel') { $command.CommandLine -like '*tunnel*http://127.0.0.1:5180*' } else { $command.CommandLine -like '*scripts\share-server.cjs*' }
    if ($matches -and $running.Path -eq $record.executable -and [Math]::Abs(($running.StartTime - ([DateTime]$record.started)).TotalSeconds) -lt 2) {
        Stop-Process -Id $running.Id
        Write-Host "Stopped $name."
    }
}
Write-Host 'Public demo sharing stopped. Local website and Cassandra are unchanged.'
