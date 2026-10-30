$demoSupervisorRoot = Split-Path -Parent $PSScriptRoot
$demoSupervisorState = Join-Path $demoSupervisorRoot '.runtime'
$demoSupervisorScript = Join-Path $PSScriptRoot 'demo-supervisor.ps1'
$demoSupervisorPowerShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$taskHasher = [Security.Cryptography.SHA256]::Create()
try {
    $taskDigest = $taskHasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($demoSupervisorRoot.ToLowerInvariant()))
    $demoSupervisorTaskName = 'AuditFlow-Demo-' + ([BitConverter]::ToString($taskDigest).Replace('-', '').Substring(0, 12))
} finally { $taskHasher.Dispose() }

function Get-ProjectSupervisorTask {
    $task = Get-ScheduledTask -TaskName $demoSupervisorTaskName -ErrorAction SilentlyContinue
    if ($task) {
        $expectedArguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + $demoSupervisorScript + '"'
        if (@($task.Actions).Count -ne 1 -or $task.Actions[0].Execute -ne $demoSupervisorPowerShell -or $task.Actions[0].Arguments -ne $expectedArguments) {
            throw 'The supervisor task name belongs to a different command. It was not changed.'
        }
    }
    return $task
}
