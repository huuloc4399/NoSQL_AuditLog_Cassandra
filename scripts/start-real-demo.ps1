param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$project = Join-Path $taskRoot 'DeTai10_Nhom07_AuditLog_Cassandra\audit-log-system'
$stateDir = Join-Path $taskRoot '.runtime'
[IO.Directory]::CreateDirectory($stateDir) | Out-Null
$node = (Get-Command node.exe -ErrorAction Stop).Source
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
. (Join-Path $PSScriptRoot 'project-wsl.ps1')

function Test-LocalPort([int]$Port) {
    $client = [Net.Sockets.TcpClient]::new()
    try {
        $attempt = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
        if (-not $attempt.AsyncWaitHandle.WaitOne(500)) { return $false }
        $client.EndConnect($attempt)
        return $true
    } catch { return $false } finally { $client.Dispose() }
}
function Wait-LocalPort([int]$Port, [int]$Seconds = 120) {
    $deadline = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-LocalPort $Port) { return }
        Start-Sleep -Milliseconds 700
    }
    throw "Port $Port was not ready. Check log files in $stateDir."
}
function Invoke-ProjectNpm([string]$Folder, [string[]]$Arguments) {
    Push-Location $Folder
    try { & $npm @Arguments; if ($LASTEXITCODE -ne 0) { throw "npm failed in $Folder" } }
    finally { Pop-Location }
}
function Start-ProjectProcess([string]$Name, [string]$Executable, [string[]]$Arguments, [string]$Folder) {
    $process = Start-Process -FilePath $Executable -ArgumentList $Arguments -WorkingDirectory $Folder -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $stateDir "$Name.log") -RedirectStandardError (Join-Path $stateDir "$Name.error.log")
    $record = @{ pid = $process.Id; executable = $Executable; started = $process.StartTime.ToString('o') }
    $record | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $stateDir "$Name.process.json") -Encoding UTF8
}

Write-Host 'Starting the real Cassandra demo...'
if (-not (Test-LocalPort 9042)) {
    $linuxRoot = Get-ProjectLinuxRoot
    Start-ProjectProcess 'cassandra' $projectWslExe ($projectWslArgs + @('bash', "$linuxRoot/scripts/cassandra-wsl.sh", 'foreground')) $taskRoot
    Wait-LocalPort 9042
}

if (-not (Test-Path (Join-Path $project 'backend\node_modules\cassandra-driver'))) { Invoke-ProjectNpm (Join-Path $project 'backend') @('ci', '--no-audit', '--no-fund') }
if (-not (Test-Path (Join-Path $project 'frontend\node_modules\vite'))) { Invoke-ProjectNpm (Join-Path $project 'frontend') @('ci', '--no-audit', '--no-fund') }

if (-not (Test-LocalPort 5000)) {
    Invoke-ProjectNpm (Join-Path $project 'backend') @('run', 'build')
    $env:CASSANDRA_NODETOOL_HELP = 'CHECK_CASSANDRA.bat'
    Start-ProjectProcess 'backend' $node @('dist/server.js') (Join-Path $project 'backend')
    Wait-LocalPort 5000 60
}
$health = Invoke-RestMethod 'http://127.0.0.1:5000/api/health' -TimeoutSec 10
if (-not $health.success -or -not $health.cassandra.release_version -or $health.service -ne 'Audit Log Backend API') { throw 'Backend has not confirmed the project Cassandra connection.' }
Write-Host "Cassandra $($health.cassandra.release_version): $($health.cassandra.cluster_name)"
Invoke-ProjectNpm (Join-Path $project 'backend') @('run', 'seed:demo')
Invoke-ProjectNpm (Join-Path $project 'backend') @('run', 'seed:today')

if (-not (Test-LocalPort 5173)) {
    $env:VITE_DEMO_MODE = 'false'
    $env:VITE_API_BASE_URL = '/api'
    Start-ProjectProcess 'frontend' $node @('node_modules/vite/bin/vite.js', '--mode', 'development', '--host', '127.0.0.1', '--port', '5173', '--strictPort') (Join-Path $project 'frontend')
    Wait-LocalPort 5173 30
}
$page = Invoke-WebRequest 'http://127.0.0.1:5173/' -UseBasicParsing -TimeoutSec 10
if ($page.StatusCode -ne 200) { throw 'Website is not ready.' }
$config = Invoke-WebRequest 'http://127.0.0.1:5173/src/config/api.ts' -UseBasicParsing -TimeoutSec 10
if ($config.Content -match '"VITE_DEMO_MODE"\s*:\s*"true"') { throw 'The simulated demo is using port 5173. Close it before starting the real-data demo.' }
Write-Host 'Website: http://127.0.0.1:5173'
Write-Host 'Admin: admin / admin123'
Write-Host 'User: user / user12345'
Write-Host 'Processes run in the background. Database files are preserved in Ubuntu WSL.'
if (-not $NoBrowser) { Start-Process 'http://127.0.0.1:5173' }
