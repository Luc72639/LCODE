$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " PET E ALEGRIA - LCODE" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js nao foi encontrado no PATH." -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "node_modules")) {
    Write-Host "Dependencias ainda nao instaladas. Instalando..." -ForegroundColor Yellow
    & npm.cmd install
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

# Carrega valores nao secretos do .env, quando existir.
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        $linha = $_.Trim()
        if ($linha -and -not $linha.StartsWith('#') -and $linha.Contains('=')) {
            $partes = $linha.Split('=', 2)
            $nome = $partes[0].Trim()
            $valor = $partes[1].Trim()
            if ($nome -and $nome -ne 'DB_PASSWORD') {
                [Environment]::SetEnvironmentVariable($nome, $valor, 'Process')
            }
        }
    }
}

if (-not $env:DB_HOST) { $env:DB_HOST = "127.0.0.1" }
if (-not $env:DB_PORT) { $env:DB_PORT = "3306" }
if (-not $env:DB_USER) { $env:DB_USER = "root" }
if (-not $env:DB_NAME) { $env:DB_NAME = "pet_e_alegria" }
if (-not $env:PORT) { $env:PORT = "3000" }
if (-not $env:SESSION_SECRET) { $env:SESSION_SECRET = "pet-e-alegria-local-session-$([Guid]::NewGuid().ToString('N'))" }

Write-Host "Banco: $($env:DB_NAME) em $($env:DB_HOST):$($env:DB_PORT)" -ForegroundColor DarkGray
Write-Host ""

$senhaSegura = Read-Host "Digite a senha do MySQL root" -AsSecureString
$credencial = New-Object System.Management.Automation.PSCredential('root', $senhaSegura)
$env:DB_PASSWORD = $credencial.GetNetworkCredential().Password

Write-Host ""
Write-Host "Iniciando o sistema..." -ForegroundColor Green
Write-Host "Se o MySQL portatil nao estiver ligado, abra-o antes e execute este script novamente." -ForegroundColor DarkGray
Write-Host ""

& node server.js
exit $LASTEXITCODE
