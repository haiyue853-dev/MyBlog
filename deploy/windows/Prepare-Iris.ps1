param(
    [Parameter(Mandatory = $true)][string]$IrisSource,
    [Parameter(Mandatory = $true)][string]$IrisRuntime
)
$ErrorActionPreference = 'Stop'
$source = (Resolve-Path -LiteralPath $IrisSource).Path.TrimEnd('\', '/')
$target = [IO.Path]::GetFullPath($IrisRuntime).TrimEnd('\', '/')
if ($source -eq $target -or $target.StartsWith($source + '\', [StringComparison]::OrdinalIgnoreCase) -or $source.StartsWith($target + '\', [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Source and runtime must be separate directories, neither containing the other.'
}
foreach ($name in @('server.py', 'requirements.txt', 'iris_agent')) {
    if (-not (Test-Path -LiteralPath (Join-Path $source $name))) { throw "Iris source is missing $name." }
}
if ((Test-Path -LiteralPath $target) -and @(Get-ChildItem -LiteralPath $target -Force).Count -gt 0) {
    throw 'Runtime must be empty. This preparation never overwrites existing configuration or data.'
}
New-Item -ItemType Directory -Path $target -Force | Out-Null
foreach ($name in @('server.py', 'requirements.txt', 'iris_agent')) {
    Copy-Item -LiteralPath (Join-Path $source $name) -Destination $target -Recurse
}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'agent.cloud.yaml') -Destination (Join-Path $target 'agent.yaml')
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'iris.env.example') -Destination (Join-Path $target '.env.example')
Write-Output 'Prepared independent Iris runtime. Source .env, data, integrations and local agent.yaml were not copied.'
