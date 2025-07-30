# Simple Zero Trust Monitor - Minimal Version
param([string]$OutputPath = ".")

$Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$OutputDir = Join-Path $OutputPath "ZeroTrust_Analysis_$Timestamp"
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

$TranscriptPath = Join-Path $OutputDir "Session.log"
Start-Transcript -Path $TranscriptPath

Write-Host "Zero Trust Monitoring Started" -ForegroundColor Green
Write-Host "Output: $OutputDir" -ForegroundColor Yellow

$env:MICROSOFT_GRAPH_DEBUG = "true"

Write-Host "`n=== READY FOR ASSESSMENT ===" -ForegroundColor White
Write-Host "1. Run your Zero Trust Assessment cmdlet now" -ForegroundColor Green
Write-Host "2. All activity will be logged automatically" -ForegroundColor Green
Write-Host "3. Press ENTER when complete" -ForegroundColor Green

Read-Host "`nPress ENTER after cmdlet completion"

# Capture any generated files
$Files = Get-ChildItem -Path . -Include "*.xlsx", "*.csv", "*.json" -Recurse | Where-Object { $_.CreationTime -gt (Get-Date).AddHours(-1) }
if ($Files) {
    Write-Host "`nCopying generated files:" -ForegroundColor Yellow
    $Files | ForEach-Object {
        Write-Host "  - $($_.Name)"
        Copy-Item $_.FullName $OutputDir -Force
    }
}

Stop-Transcript
Write-Host "`nComplete! Data saved to: $OutputDir" -ForegroundColor Green
