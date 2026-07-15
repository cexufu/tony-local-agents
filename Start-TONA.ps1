Set-Location -LiteralPath $PSScriptRoot
Write-Host "Starting TONA Agent Studio..."
Start-Process -FilePath node -ArgumentList "server.js" -WorkingDirectory $PSScriptRoot -WindowStyle Minimized
Start-Sleep -Seconds 2
Start-Process "http://localhost:7357"

