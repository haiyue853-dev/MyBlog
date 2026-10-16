param(
    [Parameter(Mandatory = $true)][ValidateSet('blog', 'iris', 'caddy')][string]$Service,
    [Parameter(Mandatory = $true)][string]$Config
)
$ErrorActionPreference = 'Stop'
try {
    $stack = Get-Content -LiteralPath $Config -Raw -Encoding UTF8 | ConvertFrom-Json
    $environmentFile = Join-Path $stack.BlogDir '.env.windows'
    $allowed = @('SITE_DOMAIN', 'APP_URL', 'PUBLIC_SITE_READY', 'DATA_DIR', 'IRIS_BASE_URL', 'IRIS_API_TOKEN', 'CADDY_DATA_DIR')
    if ($Service -eq 'iris') {
        $environmentFile = Join-Path $stack.IrisRuntime '.env'
        $allowed = @('OPENAI_API_KEY', 'OPENAI_BASE_URL', 'LLM_MODEL', 'TAVILY_API_KEY')
    }
    # Missing file entries must not inherit machine-wide deployment flags or keys.
    foreach ($key in $allowed) { [Environment]::SetEnvironmentVariable($key, $null, 'Process') }
    $seen = @{}
    $lineNumber = 0
    foreach ($line in Get-Content -LiteralPath $environmentFile -Encoding UTF8) {
        $lineNumber++
        $valueLine = $line.Trim()
        if (-not $valueLine -or $valueLine.StartsWith('#')) { continue }
        if ($valueLine -notmatch '^([A-Z][A-Z0-9_]*)=(.*)$') { throw "Invalid environment entry at line $lineNumber." }
        $key = $Matches[1]
        $value = $Matches[2].Trim()
        if ($allowed -notcontains $key -or $seen.ContainsKey($key)) { throw "Unsupported or duplicate environment entry at line $lineNumber." }
        $seen[$key] = $true
        [Environment]::SetEnvironmentVariable($key, $value, 'Process')
    }
    switch ($Service) {
        'blog' {
            Set-Location -LiteralPath $stack.BlogDir
            # The existing local launcher loads .env.local; it must not override cloud restrictions.
            if (Test-Path -LiteralPath '.env.local') { throw 'Remove the local development .env.local from the cloud blog directory.' }
            $env:NODE_ENV = 'production'
            $env:HOSTNAME = '127.0.0.1'
            $env:PORT = '3000'
            $env:TRUST_PROXY = '1'
            $env:DISABLE_WEB_SETUP = '1'
            if ($env:IRIS_BASE_URL -ne 'http://127.0.0.1:8000') { throw 'This stack requires Iris on http://127.0.0.1:8000.' }
            & $stack.NodeExe 'scripts/check-deployment.mjs'
            if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
            & $stack.NodeExe 'scripts/start.mjs'
        }
        'iris' {
            Set-Location -LiteralPath $stack.IrisRuntime
            & $stack.IrisPython (Join-Path $PSScriptRoot 'start-iris.py')
        }
        'caddy' {
            if ($env:PUBLIC_SITE_READY -ne '1') { throw 'Public website is disabled. Wait for ICP approval before setting PUBLIC_SITE_READY=1.' }
            if (-not $env:SITE_DOMAIN -or -not $env:CADDY_DATA_DIR) { throw 'SITE_DOMAIN and CADDY_DATA_DIR are required.' }
            $origin = [Uri]$env:APP_URL
            if (-not $origin.IsAbsoluteUri -or $origin.Scheme -ne 'https' -or $origin.Host -ne $env:SITE_DOMAIN -or -not $origin.IsDefaultPort -or $origin.AbsolutePath -ne '/' -or $origin.Query -or $origin.Fragment -or $origin.UserInfo) { throw 'APP_URL must match the HTTPS SITE_DOMAIN origin.' }
            Set-Location -LiteralPath $stack.BlogDir
            & $stack.CaddyExe 'validate' '--config' (Join-Path $PSScriptRoot 'Caddyfile') '--adapter' 'caddyfile'
            if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
            & $stack.CaddyExe 'run' '--config' (Join-Path $PSScriptRoot 'Caddyfile') '--adapter' 'caddyfile'
        }
    }
    exit $LASTEXITCODE
} catch {
    Write-Error $_ -ErrorAction Continue
    exit 1
}
