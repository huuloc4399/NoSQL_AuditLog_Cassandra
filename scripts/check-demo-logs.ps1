$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$proofPath = Join-Path $taskRoot '.runtime\check-demo-logs.cql'
[IO.Directory]::CreateDirectory((Split-Path -Parent $proofPath)) | Out-Null
$utcDate = [DateTime]::UtcNow.ToString('yyyy-MM-dd')
$query = @"
USE audit_log_system;
SELECT log_time, log_id, action, user_id, details FROM audit_logs WHERE service_name = 'User' AND log_date = '$utcDate' LIMIT 12;
SELECT log_time, action, message FROM audit_logs_by_service_level WHERE service_name = 'Payment' AND level = 'ERROR' AND log_date = '$utcDate' LIMIT 5;
"@
[IO.File]::WriteAllText($proofPath, $query, (New-Object Text.UTF8Encoding($false)))
. (Join-Path $PSScriptRoot 'project-wsl.ps1')
$linuxRoot = Get-ProjectLinuxRoot
if ($LASTEXITCODE -ne 0 -or -not $linuxRoot) { throw 'Cannot resolve project directory in WSL.' }
& $projectWslExe @projectWslArgs bash "$linuxRoot/scripts/cassandra-wsl.sh" cql --file "$linuxRoot/.runtime/check-demo-logs.cql"
if ($LASTEXITCODE -ne 0) { throw 'CQLSH check failed. Start START_REAL_DEMO.bat first.' }
