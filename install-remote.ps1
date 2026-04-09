$repoZip = "https://github.com/ArturGilowski/PDFsplitter/archive/refs/heads/main.zip"
$installPath = "$env:LOCALAPPDATA\PDFsplitter"
$zipPath = "$env:TEMP\PDFsplitter.zip"
$extractPath = "$env:TEMP\PDFsplitter-main"

Write-Host ">>> Rozpoczynam zdalną instalację PDF Splitter..." -ForegroundColor Cyan

# 1. Tworzenie folderu docelowego
if (!(Test-Path $installPath)) { 
    New-Item -ItemType Directory -Path $installPath -Force | Out-Null 
}

# 2. Pobieranie paczki ZIP
Write-Host ">>> Pobieranie plików z repozytorium..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $repoZip -OutFile $zipPath

# 3. Rozpakowywanie
Write-Host ">>> Instalowanie plików..." -ForegroundColor Cyan
if (Test-Path $extractPath) { Remove-Item -Path $extractPath -Recurse -Force }
Expand-Archive -Path $zipPath -DestinationPath $env:TEMP -Force

# Kopiowanie (GitHub dodaje '-main' do folderu w ZIP-ie)
Copy-Item -Path "$extractPath\*" -Destination $installPath -Recurse -Force

# Sprzątanie tymczasowe
Remove-Item -Path $extractPath -Recurse -Force
Remove-Item -Path $zipPath -Force

# 4. Uruchomienie lokalnego skryptu instalacji środowiska i skrótu
Set-Location $installPath
if (Test-Path ".\install.ps1") {
    Write-Host ">>> Konfiguracja środowiska (Python, Node, OCR) oraz skrótu na pulpicie..." -ForegroundColor Yellow
    Write-Host ">>> PROSZĘ ZAAKCEPTUJCIE PROŚBĘ O UPRAWNIENIA ADMINISTRATORA <<<" -ForegroundColor Yellow

    $installScript = Join-Path $installPath "install.ps1"
    
    # Uruchomimy install.ps1 jako Administrator (-Wait tak aby instalator skończył przed zamknięciem okna głównego)
    $args = '-NoProfile -ExecutionPolicy Bypass -File "' + $installScript + '"'
    Start-Process -FilePath "powershell.exe" -ArgumentList $args -Verb RunAs -Wait
}

Write-Host ">>> Instalacja ukończona! Możesz teraz korzystać z aplikacji z poziomu Pulpitu." -ForegroundColor Green
Write-Host "Wciśnij dowolny klawisz, aby zamknąć..."
pause > $null
