# Resolve one project WSL runtime consistently for start/stop/status/CQL tools.
$projectRuntimeRoot = Split-Path -Parent $PSScriptRoot
$projectWslConfig = Join-Path $projectRuntimeRoot '.runtime\wsl-config.json'
$projectWslName = if ($env:CASSANDRA_WSL_DISTRO) { $env:CASSANDRA_WSL_DISTRO } else { 'Ubuntu-22.04' }
$projectWslUser = 'traffic'
if (-not $env:CASSANDRA_WSL_DISTRO -and (Test-Path -LiteralPath $projectWslConfig)) {
    $savedWslConfig = Get-Content -LiteralPath $projectWslConfig -Raw | ConvertFrom-Json
    $projectWslName = [string]$savedWslConfig.distribution
    $projectWslUser = [string]$savedWslConfig.user
}
if ($projectWslName -notmatch '^[A-Za-z0-9_.-]+$' -or $projectWslUser -notmatch '^[a-z_][a-z0-9_-]*$') { throw 'Invalid project WSL configuration.' }
$projectWslExe = (Get-Command wsl.exe -ErrorAction Stop).Source
$projectWslArgs = @('-d', $projectWslName, '--user', $projectWslUser, '--')

function Get-ProjectLinuxRoot {
    $registration = @(Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Lxss\*' -ErrorAction SilentlyContinue | Where-Object DistributionName -eq $projectWslName)
    if ($registration.Count -ne 1) { throw "WSL distribution '$projectWslName' is not registered. See REAL_DATABASE.md." }
    if ($registration[0].Version -eq 2) {
        $vhdName = if ($registration[0].VhdFileName) { $registration[0].VhdFileName } else { 'ext4.vhdx' }
        $basePath = [string]$registration[0].BasePath
        # WSL imports store an extended path; Windows PowerShell 5 Join-Path rejects it.
        if ($basePath -match '^\\\\\?\\[A-Za-z]:\\') { $basePath = $basePath.Substring(4) }
        $vhdPath = [IO.Path]::Combine($basePath, $vhdName)
        if (-not (Test-Path -LiteralPath $vhdPath -PathType Leaf)) {
            throw "WSL '$projectWslName' is registered, but its disk is missing: $vhdPath. Restore the disk path; see REAL_DATABASE.md."
        }
    }
    $pathArgs = @('-d', $projectWslName, '--user', $projectWslUser, '--cd', '/', '--')
    $output = @(& $projectWslExe @pathArgs wslpath -a $projectRuntimeRoot.Replace('\', '/') 2>&1)
    $wslExit = $LASTEXITCODE
    # WSL có thể in cảnh báo systemd trước đường dẫn dù wslpath trả exit 0.
    # Chỉ nhận một đường dẫn tuyệt đối; không truyền cảnh báo vào đối số của bash.
    $outputLines = @($output | ForEach-Object { $_.ToString().Replace([string][char]0, '').Trim() })
    $linuxPaths = @($outputLines | Where-Object { $_ -match '^/' })
    if ($wslExit -ne 0 -or $linuxPaths.Count -ne 1) {
        $diagnostic = $outputLines -join [Environment]::NewLine
        throw "WSL '$projectWslName' could not start (exit $wslExit). $diagnostic"
    }
    return $linuxPaths[0]
}
