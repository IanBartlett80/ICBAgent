# Enhanced Zero Trust Monitor - Captures all activity
param([string]$OutputPath = ".")

$Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$OutputDir = Join-Path $OutputPath "ZeroTrust_Enhanced_$Timestamp"
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

# Enable comprehensive logging
$env:MICROSOFT_GRAPH_DEBUG = "true"
$env:MICROSOFT_GRAPH_DEBUG_CONTENT = "true"

# Start transcript with verbose output
$TranscriptPath = Join-Path $OutputDir "Complete_Session.log"
Start-Transcript -Path $TranscriptPath -UseMinimalHeader

Write-Host "=== ENHANCED ZERO TRUST MONITORING ===" -ForegroundColor Green
Write-Host "Output Directory: $OutputDir" -ForegroundColor Yellow
Write-Host "Transcript: $TranscriptPath" -ForegroundColor Yellow
Write-Host ""

# Capture PowerShell execution context
Write-Host "PowerShell Context:" -ForegroundColor Cyan
Write-Host "  Version: $($PSVersionTable.PSVersion)" -ForegroundColor White
Write-Host "  Edition: $($PSVersionTable.PSEdition)" -ForegroundColor White
Write-Host "  Host: $($Host.Name)" -ForegroundColor White
Write-Host ""

# Check for Graph modules
Write-Host "Checking Graph PowerShell Modules:" -ForegroundColor Cyan
$GraphModules = Get-Module Microsoft.Graph* -ListAvailable -ErrorAction SilentlyContinue
if ($GraphModules) {
    $GraphModules | Select-Object Name, Version | Format-Table -AutoSize
    $GraphModules | Select-Object Name, Version | Export-Csv (Join-Path $OutputDir "GraphModules.csv") -NoTypeInformation
} else {
    Write-Host "  No Microsoft Graph modules found" -ForegroundColor Yellow
}

# Check current working directory and files
Write-Host "Current Directory: $(Get-Location)" -ForegroundColor Cyan
Write-Host "Existing files:" -ForegroundColor Cyan
Get-ChildItem -Path . | Select-Object Name, Length, LastWriteTime | Format-Table -AutoSize

Write-Host ""
Write-Host "=== INSTRUCTIONS ===" -ForegroundColor White
Write-Host "1. Your Zero Trust Assessment cmdlet execution will be captured" -ForegroundColor Green
Write-Host "2. ALL PowerShell output will be logged automatically" -ForegroundColor Green  
Write-Host "3. Run your cmdlet in THIS PowerShell session" -ForegroundColor Green
Write-Host "4. Do NOT close this PowerShell window" -ForegroundColor Green
Write-Host "5. Files will be automatically detected and copied" -ForegroundColor Green
Write-Host ""

Write-Host "MONITORING IS ACTIVE - Run your Zero Trust Assessment cmdlet now:" -ForegroundColor Yellow
Write-Host ""

# Wait for user to run cmdlet
$Response = Read-Host "Type 'done' and press ENTER after your cmdlet completes"

Write-Host ""
Write-Host "=== POST-EXECUTION CAPTURE ===" -ForegroundColor Cyan

# Capture all recently modified files
Write-Host "Scanning for new/modified files..." -ForegroundColor Yellow
$CutoffTime = (Get-Date).AddHours(-2)
$NewFiles = @()

# Check common file types that might be generated
$FileTypes = @("*.xlsx", "*.csv", "*.json", "*.txt", "*.xml", "*.html", "*.pdf")
foreach ($FileType in $FileTypes) {
    $Files = Get-ChildItem -Path . -Filter $FileType -Recurse -ErrorAction SilentlyContinue | 
             Where-Object { $_.LastWriteTime -gt $CutoffTime }
    $NewFiles += $Files
}

if ($NewFiles) {
    Write-Host "Found $($NewFiles.Count) recently modified files:" -ForegroundColor Green
    foreach ($File in $NewFiles) {
        Write-Host "  - $($File.Name) ($($File.Length) bytes, $($File.LastWriteTime))" -ForegroundColor White
        try {
            Copy-Item $File.FullName $OutputDir -Force
            Write-Host "    ✓ Copied successfully" -ForegroundColor Green
        } catch {
            Write-Host "    ✗ Copy failed: $_" -ForegroundColor Red
        }
    }
} else {
    Write-Host "No recently modified files found" -ForegroundColor Yellow
}

# List final directory contents
Write-Host ""
Write-Host "Current directory contents:" -ForegroundColor Cyan
Get-ChildItem -Path . | Select-Object Name, Length, LastWriteTime | Format-Table -AutoSize

# Create summary file
$Summary = @{
    Timestamp = Get-Date
    WorkingDirectory = (Get-Location).Path
    FilesFound = $NewFiles.Count
    FilesCopied = ($NewFiles | Where-Object { Test-Path (Join-Path $OutputDir $_.Name) }).Count
    PowerShellVersion = $PSVersionTable.PSVersion.ToString()
    GraphModulesFound = ($GraphModules | Measure-Object).Count
}

$Summary | ConvertTo-Json | Out-File (Join-Path $OutputDir "MonitoringSummary.json")

Stop-Transcript

Write-Host ""
Write-Host "=== MONITORING COMPLETE ===" -ForegroundColor Green
Write-Host "All data saved to: $OutputDir" -ForegroundColor Yellow
Write-Host "Session transcript: $TranscriptPath" -ForegroundColor Yellow
Write-Host ""
Write-Host "Next: Copy this folder to VS Code and run: node analyze-graph-calls.js" -ForegroundColor Cyan
