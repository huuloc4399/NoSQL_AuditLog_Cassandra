param([switch]$NoBrowser, [switch]$SkipBuild)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$stateDir = Join-Path $taskRoot '.runtime'
$toolPath = Join-Path $taskRoot 'tools\cloudflared\cloudflared.exe'
$nodePath = (Get-Command node.exe -ErrorAction Stop).Source
[IO.Directory]::CreateDirectory($stateDir) | Out-Null
& (Join-Path $PSScriptRoot 'start-real-demo.ps1') -NoBrowser
if (-not $SkipBuild) {
    Push-Location (Join-Path $taskRoot 'DeTai10_Nhom07_AuditLog_Cassandra\audit-log-system\frontend')
    try { & npm.cmd run build -- --outDir dist-api; if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' } }
    finally { Pop-Location }
}
if (-not (Test-Path -LiteralPath $toolPath)) {
    [IO.Directory]::CreateDirectory((Split-Path -Parent $toolPath)) | Out-Null
    Invoke-WebRequest 'https://github.com/cloudflare/cloudflared/releases/download/2026.10.3/cloudflared-windows-amd64.exe' -OutFile $toolPath -UseBasicParsing
}
$digest = (Get-FileHash -LiteralPath $toolPath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($digest -ne '76b2805253d0d6ffacb092a7acfbee99e7af6917835c0c5410e23f3ef5052da2') { throw 'cloudflared SHA256 mismatch.' }

function Get-RecordedProcess([string]$Name) {
    $recordPath = Join-Path $stateDir "$Name.process.json"
    if (-not (Test-Path -LiteralPath $recordPath)) { return $null }
    $record = Get-Content -LiteralPath $recordPath -Raw | ConvertFrom-Json
    $running = Get-Process -Id $record.pid -ErrorAction SilentlyContinue
    if ($running -and $running.Path -eq $record.executable -and [Math]::Abs(($running.StartTime - ([DateTime]$record.started)).TotalSeconds) -lt 2) { return $running }
    return $null
}
function Start-ShareProcess([string]$Name, [string]$Executable, [string[]]$Arguments) {
    $running = Start-Process -FilePath $Executable -ArgumentList $Arguments -WorkingDirectory $taskRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $stateDir "$Name.log") -RedirectStandardError (Join-Path $stateDir "$Name.error.log")
    @{ pid=$running.Id; executable=$Executable; started=$running.StartTime.ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $stateDir "$Name.process.json") -Encoding UTF8
}
if (-not (Get-RecordedProcess 'share-server')) {
    $shareScript = Join-Path $PSScriptRoot 'share-server.cjs'
    Start-ShareProcess 'share-server' $nodePath @("`"$shareScript`"")
}
$ready = $false
for ($attempt=0; $attempt -lt 30; $attempt++) {
    try {
        $health = Invoke-RestMethod 'http://127.0.0.1:5180/__demo/health' -TimeoutSec 2
        if ($health.service -eq 'AuditFlow shared demo' -and $health.ready) { $ready=$true; break }
    } catch {}
    Start-Sleep -Milliseconds 500
}
if (-not $ready) { throw 'Share server did not become ready. See .runtime/share-server.error.log.' }
if (-not (Get-RecordedProcess 'cloudflare-tunnel')) {
    Start-ShareProcess 'cloudflare-tunnel' $toolPath @('tunnel','--url','http://127.0.0.1:5180','--no-autoupdate','--protocol','http2')
}
$publicUrl = $null
for ($attempt=0; $attempt -lt 120; $attempt++) {
    $logs = @((Join-Path $stateDir 'cloudflare-tunnel.log'), (Join-Path $stateDir 'cloudflare-tunnel.error.log')) | Where-Object { Test-Path -LiteralPath $_ } | ForEach-Object { Get-Content -LiteralPath $_ -Raw }
    $match = [regex]::Match(($logs -join "`n"), 'https://[a-z0-9-]+\.trycloudflare\.com')
    if ($match.Success) { $publicUrl=$match.Value; break }
    Start-Sleep -Milliseconds 500
}
if (-not $publicUrl) { throw 'Cloudflare did not provide a URL. See .runtime/cloudflare-tunnel.error.log.' }
[IO.File]::WriteAllText((Join-Path $stateDir 'cloudflare-url.txt'), $publicUrl)
Write-Host "Share URL: $publicUrl"
Write-Host 'Keep this computer awake and connected while your team tests.'
Write-Host 'STOP_SHARE_DEMO.bat closes public access and leaves the local demo running.'
if (-not $NoBrowser) { Start-Process "$publicUrl/login" }
