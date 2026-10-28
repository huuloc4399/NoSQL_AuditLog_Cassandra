param([ValidateSet('status', 'tables', 'shell')][string]$Action = 'status')
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'project-wsl.ps1')
$linuxRoot = Get-ProjectLinuxRoot
$cassandraScript = "$linuxRoot/scripts/cassandra-wsl.sh"
switch ($Action) {
    'status' {
        & $projectWslExe @projectWslArgs bash $cassandraScript status
        if ($LASTEXITCODE -ne 0) { throw 'Cassandra nodetool status failed.' }
        & $projectWslExe @projectWslArgs bash $cassandraScript cql -e 'SELECT cluster_name, release_version, data_center FROM system.local; SELECT count(*) FROM audit_log_system.audit_logs;'
    }
    'tables' { & $projectWslExe @projectWslArgs bash $cassandraScript cql --keyspace audit_log_system -e 'DESCRIBE TABLES;' }
    'shell' { & $projectWslExe @projectWslArgs bash $cassandraScript cql --keyspace audit_log_system }
}
if ($LASTEXITCODE -ne 0) { throw "Cassandra $Action failed." }
