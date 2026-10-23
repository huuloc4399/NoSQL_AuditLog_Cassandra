$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$dbGateExe = Join-Path $taskRoot 'tools\DbGate\DbGate.exe'
$dbGateWorkspace = Join-Path $taskRoot '.runtime\dbgate-workspace'
$dbGateProfile = Join-Path $taskRoot '.runtime\dbgate-profile'
if (-not (Test-Path -LiteralPath $dbGateExe)) {
    throw 'DbGate is missing from tools\DbGate.'
}
New-Item -ItemType Directory -Force $dbGateWorkspace, $dbGateProfile | Out-Null
$connectionFile = Join-Path $dbGateWorkspace 'connections.jsonl'
if (-not (Test-Path -LiteralPath $connectionFile)) {
    $connection = [ordered]@{
        _id = 'auditflow-cassandra-local'
        displayName = 'AuditFlow - Cassandra local'
        engine = 'cassandra@dbgate-plugin-cassandra'
        server = '127.0.0.1'
        port = 9042
        localDataCenter = 'datacenter1'
        singleDatabase = $true
        defaultDatabase = 'audit_log_system'
        allowedDatabases = 'audit_log_system'
        isReadOnly = $true
    }
    $connectionJson = $connection | ConvertTo-Json -Compress
    [System.IO.File]::WriteAllText($connectionFile, $connectionJson, (New-Object System.Text.UTF8Encoding($false)))
}
$env:WORKSPACE_DIR = $dbGateWorkspace
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
Start-Process -FilePath $dbGateExe -ArgumentList "--user-data-dir=`"$dbGateProfile`"" -WorkingDirectory (Split-Path -Parent $dbGateExe) -WindowStyle Normal
