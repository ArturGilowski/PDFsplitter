$WshShell = New-Object -comObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath("Desktop")
$Shortcut = $WshShell.CreateShortcut("$DesktopPath\PDF Splitter.lnk")

$batPath = Join-Path $PSScriptRoot "run-servers.bat"

$Shortcut.TargetPath = "powershell.exe"
$Shortcut.Arguments = "-WindowStyle Hidden -Command ""Start-Process cmd -ArgumentList '/c', '""$batPath""' -WindowStyle Hidden"""
$Shortcut.WorkingDirectory = $PSScriptRoot

# Use the custom application icon
$Shortcut.IconLocation = "$PSScriptRoot\docs\app-icon.ico"
$Shortcut.Description = "Włącz lokalną bazę OCR i program do dzielenia PDF-ów"
$Shortcut.Save()

Write-Host "Gotowe! Skrót 'PDF Splitter' znalazl się na Twoim Pulpicie!" -ForegroundColor Green
