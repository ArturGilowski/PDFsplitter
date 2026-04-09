# Konfiguracja repozytorium
$repoZip = "https://github.com/ArturGilowski/PDFsplitter/archive/refs/heads/main.zip"
$installPath = "$env:LOCALAPPDATA\PDFsplitter"
$zipPath = "$env:TEMP\PDFsplitter.zip"
$extractPath = "$env:TEMP\PDFsplitter-main"

Write-Host ">>> Rozpoczynam instalację PDF Splitter w: $installPath" -ForegroundColor Cyan

# 1. Tworzenie folderu docelowego
if (!(Test-Path $installPath)) { 
    New-Item -ItemType Directory -Path $installPath -Force | Out-Null 
}

# 2. Pobieranie paczki ZIP
Write-Host ">>> Pobieranie najnowszej wersji z GitHub..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $repoZip -OutFile $zipPath

# 3. Rozpakowywanie i czyszczenie
Write-Host ">>> Rozpakowywanie plików..." -ForegroundColor Cyan
# Czyścimy folder tymczasowy jeśli istniał
if (Test-Path $extractPath) { Remove-Item -Path $extractPath -Recurse -Force }

Expand-Archive -Path $zipPath -DestinationPath $env:TEMP -Force

# Kopiowanie zawartości (GitHub dodaje '-main' do nazwy folderu w ZIP)
Copy-Item -Path "$extractPath\*" -Destination $installPath -Recurse -Force

# Sprzątanie plików tymczasowych
Remove-Item -Path $extractPath -Recurse -Force
Remove-Item -Path $zipPath -Force

# 4. Uruchomienie głównego skryptu instalacyjnego środowiska
Set-Location $installPath
if (Test-Path ".\install.ps1") {
    Write-Host ">>> Rozpoczynam automatyczną konfigurację środowiska (Python, Node, Tesseract)..." -ForegroundColor Yellow
    Write-Host ">>> ZAAKCEPTUJ PROŚBĘ O UPRAWNIENIA ADMINISTRATORA W NOWYM OKNIE! <<<" -ForegroundColor Yellow

    $installScript = Join-Path $installPath "install.ps1"
    
    # Uruchamiamy install.ps1 jako Administrator
    $args = '-NoProfile -ExecutionPolicy Bypass -File "' + $installScript + '"'
    Start-Process -FilePath "powershell.exe" -ArgumentList $args -Verb RunAs -Wait
}

# 5. Weryfikacja i uruchomienie skrótu
$desktopPath = [Environment]::GetFolderPath("Desktop")
$exePath = Join-Path $desktopPath "PDF Splitter.lnk"

if (Test-Path $exePath) {
    Write-Host ">>> Instalacja zakończona sukcesem! Uruchamiam aplikację..." -ForegroundColor Green
    Start-Process $exePath
} else {
    Write-Host ">>> Coś poszło nie tak – nie znaleziono skrótu na pulpicie. Sprawdź folder: $installPath" -ForegroundColor Red
}
