param([switch]$NoBrowser, [switch]$SkipBuild)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'ngrok-common.ps1')
$launchLock = Open-NgrokProjectLock
$createdNgrok = $null
try {
    $ngrokCommand = Get-Command ngrok.exe -ErrorAction SilentlyContinue
    if (-not $ngrokCommand) { throw 'ngrok.exe was not found. Install ngrok and configure your account first.' }
    $nodePath = (Get-Command node.exe -ErrorAction Stop).Source
    $npmPath = (Get-Command npm.cmd -ErrorAction Stop).Source
    $frontend = Join-Path $ngrokTaskRoot 'DeTai10_Nhom07_AuditLog_Cassandra\audit-log-system\frontend'

    Write-Host '[1/4] Starting the real Cassandra demo...'
    & (Join-Path $PSScriptRoot 'start-real-demo.ps1') -NoBrowser

    Write-Host '[2/4] Preparing the shared frontend...'
    if (-not $SkipBuild) {
        $previousMode = $env:VITE_DEMO_MODE
        $previousApi = $env:VITE_API_BASE_URL
        Push-Location $frontend
        try {
            $env:VITE_DEMO_MODE = 'false'
            $env:VITE_API_BASE_URL = '/api'
            & $npmPath run build -- --outDir dist-api
            if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed; ngrok was not started.' }
        } finally {
            Pop-Location
            $env:VITE_DEMO_MODE = $previousMode
            $env:VITE_API_BASE_URL = $previousApi
        }
    }
    if (-not (Test-Path -LiteralPath (Join-Path $frontend 'dist-api\index.html'))) {
        throw 'Shared frontend is missing. Run again without -SkipBuild.'
    }

    Write-Host '[3/4] Checking the share server on port 5180...'
    if (-not (Get-ProjectShareHealth)) {
        $shareProcess = Get-NgrokRecordedProcess 'share-server'
        if (-not $shareProcess) {
            # Refuse an occupied port instead of starting a duplicate server.
            $socket = New-Object Net.Sockets.TcpClient
            try {
                $connect = $socket.BeginConnect('127.0.0.1', 5180, $null, $null)
                $occupied = $connect.AsyncWaitHandle.WaitOne(500) -and $socket.Connected
            } finally { $socket.Dispose() }
            if ($occupied) { throw 'Port 5180 is occupied by a different server. Close that server and try again.' }
            $shareScript = Join-Path $PSScriptRoot 'share-server.cjs'
            $shareProcess = Start-NgrokBackgroundProcess 'share-server' $nodePath @("`"$shareScript`"")
        }
        $deadline = (Get-Date).AddSeconds(30)
        while ((Get-Date) -lt $deadline -and -not (Get-ProjectShareHealth)) {
            $shareProcess.Refresh()
            if ($shareProcess.HasExited) { throw 'Share server exited. See .runtime/share-server.error.log.' }
            Start-Sleep -Milliseconds 500
        }
        if (-not (Get-ProjectShareHealth)) { throw 'Share server is not ready. See .runtime/share-server.error.log.' }
    }
    $apiHealth = Invoke-RestMethod 'http://127.0.0.1:5180/api/health' -TimeoutSec 10
    if (-not $apiHealth.success -or $apiHealth.service -ne 'Audit Log Backend API' -or -not $apiHealth.cassandra.release_version) {
        throw 'The share server has not confirmed the real Cassandra API.'
    }

    Write-Host '[4/4] Starting or reusing ngrok...'
    $agent = Get-NgrokAgent
    $tunnel = Get-ProjectNgrokTunnel $agent
    if (-not $tunnel) {
        if ($agent) { throw 'Another ngrok agent is using port 4040 for a different target. Close it yourself before starting this demo.' }
        $ngrokProcess = Get-NgrokRecordedProcess 'ngrok'
        if (-not $ngrokProcess) {
            $ngrokProcess = Start-NgrokBackgroundProcess 'ngrok' $ngrokCommand.Source @('http', 'http://127.0.0.1:5180', '--log=stdout', '--log-format=json')
            $createdNgrok = $ngrokProcess
        }
        $deadline = (Get-Date).AddSeconds(40)
        while ((Get-Date) -lt $deadline) {
            $tunnel = Get-ProjectNgrokTunnel (Get-NgrokAgent)
            if ($tunnel) { break }
            $ngrokProcess.Refresh()
            if ($ngrokProcess.HasExited) { break }
            Start-Sleep -Milliseconds 500
        }
        if (-not $tunnel) { throw (Get-NgrokFailureMessage) }
    } else {
        # Refresh a known legacy record; never take ownership of an unrelated agent.
        $knownNgrok = Get-NgrokRecordedProcess 'ngrok'
        Write-Host 'Reusing the existing demo tunnel.'
    }

    $publicUrl = $tunnel.public_url.TrimEnd('/')
    [IO.File]::WriteAllText((Join-Path $ngrokStateDir 'ngrok-url.txt'), $publicUrl)
    Write-Host ''
    Write-Host "Demo link: $publicUrl/login" -ForegroundColor Green
    Write-Host 'Admin: admin / admin123'
    Write-Host 'User: user / user12345'
    Write-Host 'Link saved in .runtime/ngrok-url.txt. Keep this computer awake and online.'
    Write-Host 'You may close this window; the demo and tunnel run in the background.'
    Write-Host 'STOP_NGROK_DEMO.bat stops the managed ngrok process and keeps the local demo running.'
    if (-not $NoBrowser) { Start-Process "$publicUrl/login" }
} catch {
    if ($createdNgrok) {
        $ownedNgrok = Get-NgrokRecordedProcess 'ngrok'
        if ($ownedNgrok -and $ownedNgrok.Id -eq $createdNgrok.Id) { Stop-Process -Id $ownedNgrok.Id -ErrorAction SilentlyContinue }
    }
    throw
} finally { $launchLock.Dispose() }
