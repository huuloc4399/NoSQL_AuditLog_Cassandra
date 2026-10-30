$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'demo-supervisor-common.ps1')
. (Join-Path $PSScriptRoot 'ngrok-common.ps1')
$disabledFile = Join-Path $demoSupervisorState 'demo-supervisor.disabled'
$statusFile = Join-Path $demoSupervisorState 'demo-supervisor.status.json'
$logFile = Join-Path $demoSupervisorState 'demo-supervisor.log'
[IO.Directory]::CreateDirectory($demoSupervisorState) | Out-Null

function Write-SupervisorLog([string]$Message) {
    if ((Test-Path -LiteralPath $logFile) -and (Get-Item -LiteralPath $logFile).Length -gt 1MB) {
        Move-Item -LiteralPath $logFile -Destination ($logFile + '.previous') -Force
    }
    Add-Content -LiteralPath $logFile -Value ('{0} {1}' -f [DateTimeOffset]::Now.ToString('o'), $Message)
}
function Get-DemoHealth {
    $apiReady = $false; $frontendReady = $false
    try {
        $health = Invoke-RestMethod 'http://127.0.0.1:5000/api/health' -TimeoutSec 5
        $apiReady = $health.success -and $health.service -eq 'Audit Log Backend API' -and [bool]$health.cassandra.release_version
    } catch { }
    try {
        $page = Invoke-WebRequest 'http://127.0.0.1:5173/login' -UseBasicParsing -TimeoutSec 5
        $frontendReady = $page.StatusCode -eq 200 -and $page.Content -match '/src/main.tsx'
    } catch { }
    $shareReady = [bool](Get-ProjectShareHealth)
    $tunnel = Get-ProjectNgrokTunnel (Get-NgrokAgent)
    return @{ api=$apiReady; frontend=$frontendReady; share=$shareReady; tunnel=[bool]$tunnel; url=$(if ($tunnel) { $tunnel.public_url.TrimEnd('/') } else { $null }) }
}
function Stop-UnhealthyOwnedProcess([string]$Name, [string]$CommandPattern) {
    $process = Get-NgrokRecordedProcess $Name
    if (-not $process) { return }
    $command = Get-CimInstance Win32_Process -Filter "ProcessId = $($process.Id)"
    if ($command.CommandLine -notmatch $CommandPattern) { return }
    Stop-Process -Id $process.Id -ErrorAction Stop
    $process.WaitForExit(10000) | Out-Null
    Write-SupervisorLog "Stopped unresponsive project component: $Name"
}

$lock = $null
try {
    try { $lock = [IO.File]::Open((Join-Path $demoSupervisorState 'demo-supervisor.lock'), 'OpenOrCreate', 'ReadWrite', 'None') }
    catch { exit 0 }
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class AuditFlowPower {
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern uint SetThreadExecutionState(uint flags);
}
'@
    # Keep the system awake only while this process exists; do not change Windows power plans.
    $wakeResult = [AuditFlowPower]::SetThreadExecutionState([uint32]2147483649)
    if ($wakeResult -eq 0) { Write-SupervisorLog 'Windows did not accept the keep-awake request.' }
    Write-SupervisorLog 'Supervisor started outside Codex. Health interval: 20 seconds.'
    $failures = @{ api=0; frontend=0; share=0; tunnel=0 }
    $needsBuild = $true
    while (-not (Test-Path -LiteralPath $disabledFile)) {
        $health = Get-DemoHealth
        foreach ($component in @('api','frontend','share','tunnel')) {
            if ($health[$component]) { $failures[$component] = 0 } else { $failures[$component]++ }
        }
        $ready = $health.api -and $health.frontend -and $health.share -and $health.tunnel
        @{ ready=[bool]($ready -and -not $needsBuild); checkedAt=[DateTimeOffset]::Now.ToString('o'); url=$health.url; components=$health; failures=$failures; pid=$PID; keepAwake=($wakeResult -ne 0) } |
            ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $statusFile -Encoding UTF8
        if ($needsBuild -or -not $ready) {
            # Three failed probes before replacing a live but unresponsive process. Never kill unrelated processes.
            if ($failures.api -ge 3) { Stop-UnhealthyOwnedProcess 'backend' 'dist/server\.js' }
            if ($failures.frontend -ge 3) { Stop-UnhealthyOwnedProcess 'frontend' 'node_modules/vite/bin/vite\.js' }
            if ($failures.share -ge 3) { Stop-UnhealthyOwnedProcess 'share-server' 'scripts[\\/]share-server\.cjs' }
            Write-SupervisorLog 'Checking/recovering demo components with the project launcher.'
            try {
                # Separate launcher scope so helper variables do not alter the supervisor. All children belong to the scheduled task.
                $arguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + (Join-Path $PSScriptRoot 'start-ngrok-demo.ps1') + '" -NoBrowser'
                if (-not $needsBuild) { $arguments += ' -SkipBuild' }
                $launcher = Start-Process -FilePath $demoSupervisorPowerShell -ArgumentList $arguments -WindowStyle Hidden -PassThru -WorkingDirectory $demoSupervisorRoot `
                    -RedirectStandardOutput (Join-Path $demoSupervisorState 'demo-supervisor-launch.log') `
                    -RedirectStandardError (Join-Path $demoSupervisorState 'demo-supervisor-launch.error.log')
                # Keep the native handle open: Windows PowerShell 5 may otherwise
                # lose ExitCode after polling a short-lived process with Refresh().
                $launcher.Handle | Out-Null
                $launcherDeadline = (Get-Date).AddMinutes(7)
                while (-not $launcher.HasExited -and (Get-Date) -lt $launcherDeadline -and -not (Test-Path -LiteralPath $disabledFile)) {
                    Start-Sleep -Milliseconds 500
                    $launcher.Refresh()
                }
                if (Test-Path -LiteralPath $disabledFile) {
                    if (-not $launcher.HasExited) { Stop-Process -Id $launcher.Id -ErrorAction SilentlyContinue }
                    break
                }
                if (-not $launcher.HasExited) {
                    Stop-Process -Id $launcher.Id -ErrorAction SilentlyContinue
                    throw 'Recovery launcher exceeded seven minutes.'
                }
                $launcher.WaitForExit()
                if ($launcher.ExitCode -ne 0) { throw "Recovery launcher exited with code $($launcher.ExitCode)." }
                $needsBuild = $false
                Write-SupervisorLog 'Project launcher completed successfully.'
            } catch { Write-SupervisorLog $_.Exception.Message; Start-Sleep -Seconds 20 }
            continue
        }
        Start-Sleep -Seconds 20
    }
} catch {
    Write-SupervisorLog $_.Exception.Message
    throw
} finally {
    if ('AuditFlowPower' -as [type]) { [AuditFlowPower]::SetThreadExecutionState([uint32]2147483648) | Out-Null }
    if ($lock) { $lock.Dispose() }
}
