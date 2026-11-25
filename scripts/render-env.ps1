<#
.SYNOPSIS
    Builds render.env: a Render-ready environment file copied from your local .env.

.DESCRIPTION
    Copies the model-provider keys from the repo-root .env, drops the local-only
    values (local Postgres URL, localhost CORS), and adds the production ones.
    It never prints a secret value, only the names of the keys it wrote.

    Paste the result into Render > your service > Environment > "Add from .env".

.EXAMPLE
    pwsh ./scripts/render-env.ps1 -DatabaseUrl "postgresql://neondb_owner:...@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$DatabaseUrl,

    [string]$CorsOrigins = "https://multi-agent-debate-eta.vercel.app",

    [string]$CorsOriginRegex = "https://.*\.vercel\.app",

    [string]$PythonVersion = "3.11.9",

    [string]$SourceEnv = ".env",

    [string]$OutFile = "render.env"
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$envPath = if ([System.IO.Path]::IsPathRooted($SourceEnv)) { $SourceEnv } else { Join-Path $root $SourceEnv }
$outPath = Join-Path $root $OutFile

if (-not (Test-Path -LiteralPath $envPath)) {
    throw "No .env found at $envPath"
}

if ($DatabaseUrl -notmatch '^postgres(ql)?(\+asyncpg)?://') {
    throw "DatabaseUrl does not look like a Postgres connection string."
}

# Values that belong to local development only and must not reach Render.
$localOnly = @("DATABASE_URL", "CORS_ORIGINS", "CORS_ORIGIN_REGEX", "PYTHON_VERSION")

$keys = New-Object System.Collections.Generic.List[string]
$values = @{}

foreach ($line in Get-Content -LiteralPath $envPath) {
    $text = $line.Trim()
    if (-not $text -or $text.StartsWith("#")) { continue }

    $split = $text.IndexOf("=")
    if ($split -lt 1) { continue }

    $key = $text.Substring(0, $split).Trim()
    $value = $text.Substring($split + 1)
    if ($localOnly -contains $key) { continue }
    if (-not $value.Trim().Trim('"').Trim("'")) { continue }

    if (-not $values.ContainsKey($key)) { $keys.Add($key) }
    $values[$key] = $value
}

if (-not $values.ContainsKey("GROQ_API_KEY")) {
    Write-Warning "GROQ_API_KEY is missing from .env: the API will start but every debate will fail."
}

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("# Render environment for backend/. Paste into Render > Environment > Add from .env.")
$lines.Add("# Generated from the local .env by scripts/render-env.ps1. Contains live secrets: never commit.")
$lines.Add("")
$lines.Add("# Pins the Python build Render installs.")
$lines.Add("PYTHON_VERSION=$PythonVersion")
$lines.Add("")
$lines.Add("# Neon, direct (non-pooled) connection string.")
$lines.Add("DATABASE_URL=$DatabaseUrl")
$lines.Add("")
$lines.Add("# Sites allowed to call the API from a browser.")
$lines.Add("CORS_ORIGINS=$CorsOrigins")
$lines.Add("CORS_ORIGIN_REGEX=$CorsOriginRegex")
$lines.Add("")
$lines.Add("# --- Model provider keys (copied from .env) ---")

foreach ($key in ($keys | Sort-Object)) {
    $lines.Add("$key=$($values[$key])")
}

[System.IO.File]::WriteAllLines($outPath, $lines, [System.Text.UTF8Encoding]::new($false))

Write-Host "Wrote $outPath"
Write-Host ("Keys: PYTHON_VERSION, DATABASE_URL, CORS_ORIGINS, CORS_ORIGIN_REGEX, " + (($keys | Sort-Object) -join ", "))
