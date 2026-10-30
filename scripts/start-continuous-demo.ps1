param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'demo-supervisor-common.ps1')
[IO.Directory]::CreateDirectory($demoSupervisorState) | Out-Null
$task = Get-ProjectSupervisorTask
if (-not $task) {
    $action = New-ScheduledTaskAction -Execute $demoSupervisorPowerShell -WorkingDirectory $demoSupervisorRoot `
        -Argument ('-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + $demoSupervisorScript + '"')
    $principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
    $settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew `
        -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
    Register-ScheduledTask -TaskName $demoSupervisorTaskName -Action $action -Principal $principal -Settings $settings `
        -Description 'Keep this AuditFlow demo and ngrok running until explicitly stopped. Started on demand; no login or reboot trigger.' | Out-Null
}
Remove-Item -LiteralPath (Join-Path $demoSupervisorState 'demo-supervisor.disabled') -ErrorAction SilentlyContinue
if ((Get-ProjectSupervisorTask).State -ne 'Running') {
    # Do not accept a stale healthy status from a previous run.
    Remove-Item -LiteralPath (Join-Path $demoSupervisorState 'demo-supervisor.status.json') -ErrorAction SilentlyContinue
    Start-ScheduledTask -TaskName $demoSupervisorTaskName
}
Write-Host "Background supervisor: $demoSupervisorTaskName"
Write-Host 'Preparing the demo and tunnel independently of this terminal...'
$deadline = (Get-Date).AddMinutes(8)
while ((Get-Date) -lt $deadline) {
    $statusPath = Join-Path $demoSupervisorState 'demo-supervisor.status.json'
    try {
        $status = Get-Content -LiteralPath $statusPath -Raw -ErrorAction Stop | ConvertFrom-Json
        if ($status.ready -and ([DateTimeOffset]::Now - [DateTimeOffset]$status.checkedAt).TotalSeconds -lt 60) {
            Write-Host "Demo link: $($status.url)/login"
            Write-Host 'Supervisor checks every 20 seconds and restarts failed components. Closing this terminal is safe.'
            Write-Host 'Keep Windows signed in and the computer powered and online. STOP_NGROK_DEMO.bat stops supervision and the tunnel.'
            if (-not $NoBrowser) { Start-Process "$($status.url)/login" }
            return
        }
    } catch { }
    if ((Get-ProjectSupervisorTask).State -ne 'Running') { throw 'The background supervisor stopped. See .runtime/demo-supervisor.log.' }
    Start-Sleep -Seconds 2
}
throw 'The background supervisor is still retrying. Check .runtime/demo-supervisor.log and demo-supervisor-launch.error.log.'
