$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'demo-supervisor-common.ps1')
[IO.Directory]::CreateDirectory($demoSupervisorState) | Out-Null
# Latch prevents an in-flight recovery from enabling supervision after an intentional stop.
[IO.File]::WriteAllText((Join-Path $demoSupervisorState 'demo-supervisor.disabled'), [DateTimeOffset]::Now.ToString('o'))
$task = Get-ProjectSupervisorTask
if ($task -and $task.State -eq 'Running') {
    # Let the supervisor exit normally; forcibly ending a scheduled task can also
    # terminate its child servers. Intentional tunnel stop must preserve the database.
    $deadline = (Get-Date).AddSeconds(40)
    while ((Get-ProjectSupervisorTask).State -eq 'Running' -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 200 }
    if ((Get-ProjectSupervisorTask).State -eq 'Running') { throw 'Supervisor has not stopped yet. Its stop request is saved; retry before stopping the tunnel.' }
    Write-Host 'Stopped background supervision. The demo will not restart itself.'
}
Remove-Item -LiteralPath (Join-Path $demoSupervisorState 'demo-supervisor.status.json') -ErrorAction SilentlyContinue
