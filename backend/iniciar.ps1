$Host.UI.RawUI.WindowTitle = "Clínica Vida+ - Backend"
Write-Host "Clínica Vida+ / LCODE" -ForegroundColor Cyan
Write-Host ""

if (-not $env:DB_HOST) { $env:DB_HOST = "localhost" }
if (-not $env:DB_USER) { $env:DB_USER = "root" }
if (-not $env:DB_NAME) { $env:DB_NAME = "clinica_vida" }

if (-not $env:DB_PASSWORD) {
    $secure = Read-Host "Senha do MySQL (pressione Enter se não houver senha)" -AsSecureString
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        $env:DB_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}

if (-not $env:SESSION_SECRET) {
    $env:SESSION_SECRET = [guid]::NewGuid().ToString() + [guid]::NewGuid().ToString()
}

node server.js
