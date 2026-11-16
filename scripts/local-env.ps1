param(
    [ValidateSet('Import', 'Initialize', 'Provision')]
    [string]$Action = 'Import'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$localRoot = Join-Path $projectRoot '.local'
$composeEnvPath = Join-Path $localRoot 'graphway.compose.env'
$runtimePath = Join-Path $localRoot 'graphway.runtime.json'
$postgresHostPort = 55433

function Set-GraphWayPrivateAcl {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][bool]$IsDirectory
    )

    $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    $grant = if ($IsDirectory) { "$($identity):(OI)(CI)F" } else { "$($identity):F" }
    & icacls.exe $Path '/inheritance:r' '/grant:r' $grant | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw 'Could not restrict local environment ACL to the current user.'
    }
}

function New-GraphWaySecret {
    param([Parameter(Mandatory = $true)][ValidateRange(16, 128)][int]$ByteCount)

    $bytes = [byte[]]::new($ByteCount)
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $generator.GetBytes($bytes)
    }
    finally {
        $generator.Dispose()
    }

    [System.Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

function Read-GraphWayComposeValues {
    if (-not (Test-Path -LiteralPath $composeEnvPath -PathType Leaf)) {
        throw 'Local Compose settings are missing; initialize the local environment first.'
    }

    $values = @{}
    foreach ($line in [System.IO.File]::ReadAllLines($composeEnvPath)) {
        if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith('#')) { continue }
        $separator = $line.IndexOf('=')
        if ($separator -le 0) { throw 'Local Compose settings contain an invalid line.' }
        $values[$line.Substring(0, $separator)] = $line.Substring($separator + 1)
    }
    return $values
}

function Initialize-GraphWayLocalEnvironment {
    if (-not (Test-Path -LiteralPath $localRoot -PathType Container)) {
        [void](New-Item -ItemType Directory -Path $localRoot)
    }
    Set-GraphWayPrivateAcl -Path $localRoot -IsDirectory $true

    $composeExists = Test-Path -LiteralPath $composeEnvPath -PathType Leaf
    $runtimeExists = Test-Path -LiteralPath $runtimePath -PathType Leaf
    if ($composeExists -xor $runtimeExists) {
        throw 'Local secret files are incomplete; refusing to replace or regenerate credentials.'
    }

    if ($composeExists) {
        Set-GraphWayPrivateAcl -Path $composeEnvPath -IsDirectory $false
        Set-GraphWayPrivateAcl -Path $runtimePath -IsDirectory $false
        $composeValues = Read-GraphWayComposeValues
        try {
            $runtime = [System.IO.File]::ReadAllText($runtimePath) | ConvertFrom-Json
        }
        catch {
            throw 'Local runtime settings are unreadable or invalid; refusing to rotate secrets.'
        }
        $adminPassword = [string]$composeValues['GRAPHWAY_POSTGRES_ADMIN_PASSWORD']
        $appPassword = [string]$composeValues['GRAPHWAY_APP_PASSWORD']
        if ($adminPassword -notmatch '^[A-Za-z0-9_-]{43}$' -or $appPassword -notmatch '^[A-Za-z0-9_-]{43}$' -or [string]$runtime.SESSION_SECRET -notmatch '^[A-Za-z0-9_-]{86}$') {
            throw 'Existing canonical secret fields are missing or invalid; refusing to replace credentials.'
        }
        if ($composeValues['GRAPHWAY_POSTGRES_BOOTSTRAP_DB'] -ne 'postgres' -or $composeValues['GRAPHWAY_POSTGRES_ADMIN_USER'] -ne 'graphway_admin' -or $composeValues['GRAPHWAY_APP_USER'] -ne 'graphway_app' -or [string]$composeValues['GRAPHWAY_POSTGRES_PORT'] -ne [string]$postgresHostPort) {
            throw 'Existing Compose fields are not canonical; refusing to overwrite local settings.'
        }
        if ($runtime.DATABASE_URL -ne "postgresql://graphway_app:$appPassword@127.0.0.1:$postgresHostPort/graphway_dev" -or $runtime.TEST_DATABASE_URL -ne "postgresql://graphway_app:$appPassword@127.0.0.1:$postgresHostPort/graphway_test") {
            throw 'Existing runtime database fields are not canonical; refusing to overwrite local settings.'
        }
        foreach ($name in @('PORT', 'WEB_PORT', 'PG_PORT')) {
            $port = [string]$runtime.$name
            if ($port -notmatch '^\d{1,5}$' -or [int]$port -lt 1 -or [int]$port -gt 65535) {
                throw "Existing runtime field $name is not a valid TCP port."
            }
        }
        if ([int]$runtime.PG_PORT -ne $postgresHostPort) {
            throw 'Existing runtime PostgreSQL port does not match Compose settings.'
        }
        return
    }

    $adminPassword = New-GraphWaySecret -ByteCount 32
    $appPassword = New-GraphWaySecret -ByteCount 32
    $sessionSecret = New-GraphWaySecret -ByteCount 64
    $composeContents = @(
        'GRAPHWAY_POSTGRES_BOOTSTRAP_DB=postgres'
        'GRAPHWAY_POSTGRES_ADMIN_USER=graphway_admin'
        "GRAPHWAY_POSTGRES_ADMIN_PASSWORD=$adminPassword"
        'GRAPHWAY_APP_USER=graphway_app'
        "GRAPHWAY_APP_PASSWORD=$appPassword"
        "GRAPHWAY_POSTGRES_PORT=$postgresHostPort"
    ) -join "`n"
    $composeContents += "`n"
    $runtime = [ordered]@{
        DATABASE_URL = "postgresql://graphway_app:$appPassword@127.0.0.1:$postgresHostPort/graphway_dev"
        TEST_DATABASE_URL = "postgresql://graphway_app:$appPassword@127.0.0.1:$postgresHostPort/graphway_test"
        SESSION_SECRET = $sessionSecret
        PORT = 3001
        WEB_PORT = 5173
        PG_PORT = $postgresHostPort
    }
    $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllText($composeEnvPath, $composeContents, $utf8NoBom)
    [System.IO.File]::WriteAllText($runtimePath, ($runtime | ConvertTo-Json -Depth 4) + "`n", $utf8NoBom)
    Set-GraphWayPrivateAcl -Path $composeEnvPath -IsDirectory $false
    Set-GraphWayPrivateAcl -Path $runtimePath -IsDirectory $false
}

function Protect-GraphWaySqlDiagnostic {
    param([string]$Diagnostic, [string[]]$Secrets)

    $safe = $Diagnostic
    foreach ($secret in $Secrets) {
        if (-not [string]::IsNullOrEmpty($secret)) {
            $safe = $safe.Replace($secret, '[REDACTED]')
        }
    }
    $safe = [regex]::Replace($safe, 'postgres(?:ql)?://\S+', '[connection URI redacted]')
    $lines = @($safe -split '\r?\n' | Where-Object {
        $_ -match '^\s*(?:psql:\s*error:|(?:ERROR|FATAL|PANIC|DETAIL|HINT):|Error response from daemon:|docker:\s*Error|OCI runtime exec failed:)'
    } | Select-Object -First 6)
    if ($lines.Count -eq 0) { return 'No non-SQL diagnostic line was available on stderr.' }
    $summary = $lines -join ' '
    return $summary.Substring(0, [Math]::Min(1200, $summary.Length))
}

function Invoke-GraphWaySql {
    param(
        [Parameter(Mandatory = $true)][string]$User,
        [Parameter(Mandatory = $true)][string]$Sql
    )

    $dockerPath = (Get-Command docker.exe -ErrorAction Stop).Source
    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $dockerPath
    $startInfo.Arguments = "exec -i graphway-local-postgres-1 psql -X -v ON_ERROR_STOP=1 --username=$User --dbname=postgres"
    $startInfo.WorkingDirectory = $projectRoot
    $startInfo.UseShellExecute = $false
    $startInfo.CreateNoWindow = $true
    $startInfo.RedirectStandardInput = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true

    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    if (-not $process.Start()) { throw 'Could not start local PostgreSQL provisioning.' }
    $stdoutTask = $process.StandardOutput.ReadToEndAsync()
    $stderrTask = $process.StandardError.ReadToEndAsync()
    $process.StandardInput.Write($Sql)
    $process.StandardInput.Close()
    $process.WaitForExit()
    [void]$stdoutTask.GetAwaiter().GetResult()
    $stderr = $stderrTask.GetAwaiter().GetResult()
    if ($process.ExitCode -ne 0) {
        $values = Read-GraphWayComposeValues
        $diagnostic = Protect-GraphWaySqlDiagnostic -Diagnostic $stderr -Secrets @([string]$values['GRAPHWAY_APP_PASSWORD'], [string]$values['GRAPHWAY_POSTGRES_ADMIN_PASSWORD'])
        throw "Local PostgreSQL provisioning exited ($($process.ExitCode)): $diagnostic"
    }
}

function Provision-GraphWayDatabases {
    $values = Read-GraphWayComposeValues
    $adminPassword = [string]$values['GRAPHWAY_POSTGRES_ADMIN_PASSWORD']
    $appPassword = [string]$values['GRAPHWAY_APP_PASSWORD']
    if ($adminPassword -notmatch '^[A-Za-z0-9_-]{43}$' -or $appPassword -notmatch '^[A-Za-z0-9_-]{43}$') {
        throw 'Local database credentials are missing or invalid.'
    }


    $appSql = @"
SELECT 'CREATE ROLE graphway_app WITH LOGIN PASSWORD ' || quote_literal('$appPassword') || ' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS' WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'graphway_app') \gexec
ALTER ROLE graphway_app WITH LOGIN PASSWORD '$appPassword' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
SELECT 'CREATE DATABASE graphway_dev OWNER graphway_app' WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'graphway_dev') \gexec
ALTER DATABASE graphway_dev OWNER TO graphway_app;
SELECT 'CREATE DATABASE graphway_test OWNER graphway_app' WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'graphway_test') \gexec
ALTER DATABASE graphway_test OWNER TO graphway_app;
"@
    Invoke-GraphWaySql -User 'graphway_admin' -Sql $appSql
}

function Import-GraphWayRuntimeEnvironment {
    if (-not (Test-Path -LiteralPath $runtimePath -PathType Leaf)) {
        throw 'Local runtime settings are missing; initialize the local environment first.'
    }

    try {
        $runtime = [System.IO.File]::ReadAllText($runtimePath) | ConvertFrom-Json
    }
    catch {
        throw 'Local runtime settings are unreadable or invalid.'
    }

    foreach ($name in @('DATABASE_URL', 'TEST_DATABASE_URL', 'SESSION_SECRET', 'PORT', 'WEB_PORT', 'PG_PORT')) {
        $value = $runtime.$name
        if ($null -eq $value -or [string]::IsNullOrWhiteSpace([string]$value)) {
            throw "Local runtime settings are missing required field $name."
        }
        Set-Item -Path "Env:$name" -Value ([string]$value)
    }
}

switch ($Action) {
    'Initialize' { Initialize-GraphWayLocalEnvironment }
    'Provision' { Provision-GraphWayDatabases }
    'Import' { Import-GraphWayRuntimeEnvironment }
}
