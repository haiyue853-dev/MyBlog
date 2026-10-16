param(
    [Parameter(Mandatory = $true)][string]$IrisRuntime,
    [Parameter(Mandatory = $true)][string]$WinSWExe,
    [Parameter(Mandatory = $true)][string]$CaddyExe,
    [Parameter(Mandatory = $true)][string]$ServicesDir,
    [string]$NodeExe = (Get-Command node -ErrorAction Stop).Source,
    [string]$BlogDir
)
$ErrorActionPreference = 'Stop'
if (-not $BlogDir) { $BlogDir = Join-Path $PSScriptRoot '../..' }
$blog = (Resolve-Path -LiteralPath $BlogDir).Path
$iris = (Resolve-Path -LiteralPath $IrisRuntime).Path
$wrapper = (Resolve-Path -LiteralPath $WinSWExe).Path
$caddy = (Resolve-Path -LiteralPath $CaddyExe).Path
$node = (Resolve-Path -LiteralPath $NodeExe).Path
$python = (Resolve-Path -LiteralPath (Join-Path $iris '.venv/Scripts/python.exe')).Path
$destination = [IO.Path]::GetFullPath($ServicesDir).TrimEnd('\', '/')
foreach ($path in @($blog, $iris, $wrapper, $caddy, $node, $python, $destination)) {
    if ($path.Contains('"') -or $path.Contains('%')) { throw 'Deployment paths cannot contain quote or percent characters.' }
}
if ((Test-Path -LiteralPath $destination) -and @(Get-ChildItem -LiteralPath $destination -Force).Count -gt 0) { throw 'ServicesDir must be empty; existing service files are preserved.' }
New-Item -ItemType Directory -Path $destination -Force | Out-Null
$stack = @{BlogDir = $blog; IrisRuntime = $iris; NodeExe = $node; IrisPython = $python; CaddyExe = $caddy}
$stack | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $destination 'stack.json') -Encoding UTF8
$config = [Security.SecurityElement]::Escape((Join-Path $destination 'stack.json'))
$launcher = [Security.SecurityElement]::Escape((Join-Path $blog 'deploy/windows/Run-Service.ps1'))
$powershell = [Security.SecurityElement]::Escape((Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'))
foreach ($service in @('blog', 'iris', 'caddy')) {
    $name = "IrisBlog-$service"
    $xml = @"
<service>
  <id>$name</id>
  <name>$name</name>
  <description>Personal blog stack: $service</description>
  <executable>$powershell</executable>
  <arguments>-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "$launcher" -Service $service -Config "$config"</arguments>
  <workingdirectory>$([Security.SecurityElement]::Escape($blog))</workingdirectory>
  <startmode>Automatic</startmode>
  <serviceaccount><domain>NT AUTHORITY</domain><user>LocalService</user></serviceaccount>
  <onfailure action="restart" delay="30 sec"/>
  <resetfailure>1 hour</resetfailure>
  <stoptimeout>30 sec</stoptimeout>
  <log mode="roll-by-size"><sizeThreshold>10240</sizeThreshold><keepFiles>8</keepFiles></log>
</service>
"@
    $xml | Set-Content -LiteralPath (Join-Path $destination "$name.xml") -Encoding UTF8
    Copy-Item -LiteralPath $wrapper -Destination (Join-Path $destination "$name.exe")
}
Write-Output 'Generated three WinSW 2.x service wrappers. No services were installed or started.'
