@echo off
cd /d "%~dp0"
wsl -d Ubuntu-22.04 -- bash /mnt/d/NOSQL_NHOM7_AuditLog_Cassandra/scripts/cassandra-wsl.sh status
wsl -d Ubuntu-22.04 -- bash /mnt/d/NOSQL_NHOM7_AuditLog_Cassandra/scripts/cassandra-wsl.sh cql -e "SELECT cluster_name, release_version, data_center FROM system.local; SELECT count(*) FROM audit_log_system.audit_logs;"
pause
