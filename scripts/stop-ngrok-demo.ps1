$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'stop-demo-supervisor.ps1')
. (Join-Path $PSScriptRoot 'ngrok-common.ps1')
$launchLock = Open-NgrokProjectLock
try {
    $running = Get-NgrokRecordedProcess 'ngrok'
    if ($running) {
        Stop-Process -Id $running.Id -ErrorAction Stop
        $running.WaitForExit(10000) | Out-Null
        if (-not $running.HasExited) { throw 'Ngrok is still running; please check its process.' }
        Remove-Item -LiteralPath (Join-Path $ngrokStateDir 'ngrok.process.json') -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath (Join-Path $ngrokStateDir 'ngrok-url.txt') -ErrorAction SilentlyContinue
        Write-Host 'Stopped this project ngrok tunnel.'
    } elseif (Get-ProjectNgrokTunnel (Get-NgrokAgent)) {
        Write-Host 'The demo tunnel was started outside this launcher. Close its own ngrok window to stop it.'
    } else {
        Remove-Item -LiteralPath (Join-Path $ngrokStateDir 'ngrok-url.txt') -ErrorAction SilentlyContinue
        Write-Host 'No managed ngrok tunnel is running.'
    }
    Write-Host 'The local website, share server and Cassandra keep running.'
} finally { $launchLock.Dispose() }
