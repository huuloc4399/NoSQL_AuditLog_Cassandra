# Shared lifecycle helpers. Runtime records never contain ngrok credentials.
$ngrokTaskRoot = Split-Path -Parent $PSScriptRoot
$ngrokStateDir = Join-Path $ngrokTaskRoot '.runtime'
$ngrokAgentApi = 'http://127.0.0.1:4040/api/tunnels'
[IO.Directory]::CreateDirectory($ngrokStateDir) | Out-Null

function Open-NgrokProjectLock {
    try {
        return [IO.File]::Open((Join-Path $ngrokStateDir 'ngrok-launch.lock'), 'OpenOrCreate', 'ReadWrite', 'None')
    } catch {
        throw 'Another ngrok start/stop is running. Wait for that window to finish.'
    }
}

function Get-NgrokAgent {
    try { return Invoke-RestMethod $ngrokAgentApi -TimeoutSec 2 -ErrorAction Stop }
    catch { return $null }
}

function Get-ProjectNgrokTunnel($Agent) {
    return $Agent.tunnels | Where-Object {
        $_.config.addr -match '^(http://)?(127\.0\.0\.1|localhost):5180/?$|^5180$' -and
        $_.public_url -match '^https://[^/]+/?$'
    } | Select-Object -First 1
}

function Save-NgrokProcessRecord([string]$Name, $Process) {
    # MSIX aliases launch a different executable path; record the real process.
    $Process.Refresh()
    if ($Process.HasExited) { throw "$Name exited before it became ready." }
    @{ pid=$Process.Id; executable=$Process.Path; started=$Process.StartTime.ToString('o') } |
        ConvertTo-Json | Set-Content -LiteralPath (Join-Path $ngrokStateDir "$Name.process.json") -Encoding UTF8
}

function Get-NgrokRecordedProcess([string]$Name) {
    $recordPath = Join-Path $ngrokStateDir "$Name.process.json"
    if (-not (Test-Path -LiteralPath $recordPath)) { return $null }
    try {
        $record = Get-Content -LiteralPath $recordPath -Raw | ConvertFrom-Json
        $running = Get-Process -Id ([int]$record.pid) -ErrorAction Stop
        if ([Math]::Abs(($running.StartTime - ([DateTime]$record.started)).TotalSeconds) -gt 1) { return $null }
        $samePath = $running.Path -eq $record.executable
        # Accept this project's record from the earlier manual launch via the Store alias.
        $legacyAlias = Join-Path $env:LOCALAPPDATA 'Microsoft\WindowsApps\ngrok.exe'
        if (-not $samePath -and $Name -eq 'ngrok' -and $record.executable -eq $legacyAlias -and $running.ProcessName -eq 'ngrok') {
            Save-NgrokProcessRecord $Name $running
            $samePath = $true
        }
        if ($samePath) { return $running }
    } catch {}
    return $null
}

function Get-ProjectShareHealth {
    try {
        $health = Invoke-RestMethod 'http://127.0.0.1:5180/__demo/health' -TimeoutSec 2 -ErrorAction Stop
        return $health.service -eq 'AuditFlow shared demo' -and $health.ready
    } catch { return $false }
}

function Start-NgrokBackgroundProcess([string]$Name, [string]$Executable, [string[]]$Arguments) {
    $process = Start-Process -FilePath $Executable -ArgumentList $Arguments -WorkingDirectory $ngrokTaskRoot -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $ngrokStateDir "$Name.log") -RedirectStandardError (Join-Path $ngrokStateDir "$Name.error.log")
    Save-NgrokProcessRecord $Name $process
    return $process
}

function Get-NgrokFailureMessage {
    $codes = @(Get-Content -LiteralPath (Join-Path $ngrokStateDir 'ngrok.log'), (Join-Path $ngrokStateDir 'ngrok.error.log') -ErrorAction SilentlyContinue |
        Select-String -Pattern 'ERR_NGROK_\d+' -AllMatches | ForEach-Object { $_.Matches.Value } | Select-Object -Unique)
    # Do not echo raw ngrok logs: an authentication error may include credentials.
    return "Ngrok did not become ready. Error codes: $($codes -join ', '). Check .runtime/ngrok.log, your ngrok account and 'ngrok config check'."
}
