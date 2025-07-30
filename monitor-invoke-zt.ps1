# Invoke-ZTAssessment Monitor - Targeted for your specific cmdlet
param([string]$OutputPath = ".")

$Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$OutputDir = Join-Path $OutputPath "ZeroTrust_InvokeZT_$Timestamp"
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

# Enable comprehensive logging
$env:MICROSOFT_GRAPH_DEBUG = "true"
$env:MICROSOFT_GRAPH_DEBUG_CONTENT = "true"

# Start transcript with all output
$TranscriptPath = Join-Path $OutputDir "InvokeZT_Session.log"
Start-Transcript -Path $TranscriptPath -UseMinimalHeader

Write-Host "=== INVOKE-ZTASSESSMENT MONITORING ===" -ForegroundColor Green
Write-Host "Target Cmdlet: Invoke-ZTAssessment" -ForegroundColor Cyan
Write-Host "Output Directory: $OutputDir" -ForegroundColor Yellow
Write-Host "Expected XLSX Location: C:\Users\ianbart\" -ForegroundColor Yellow
Write-Host "Transcript: $TranscriptPath" -ForegroundColor Yellow
Write-Host ""

# Pre-execution baseline
Write-Host "=== PRE-EXECUTION BASELINE ===" -ForegroundColor Cyan
Write-Host "Scanning C:\Users\ianbart\ for existing XLSX files..." -ForegroundColor Yellow

$UserPath = "C:\Users\ianbart"
$PreExistingFiles = @()
if (Test-Path $UserPath) {
    $PreExistingFiles = Get-ChildItem -Path $UserPath -Filter "*.xlsx" -ErrorAction SilentlyContinue
    Write-Host "Found $($PreExistingFiles.Count) existing XLSX files:" -ForegroundColor White
    $PreExistingFiles | ForEach-Object { Write-Host "  - $($_.Name) ($($_.LastWriteTime))" -ForegroundColor Gray }
} else {
    Write-Host "Cannot access $UserPath" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== READY FOR INVOKE-ZTASSESSMENT ===" -ForegroundColor White
Write-Host "1. Run: Invoke-ZTAssessment" -ForegroundColor Green
Write-Host "2. Let it complete fully" -ForegroundColor Green
Write-Host "3. All output will be captured automatically" -ForegroundColor Green
Write-Host "4. XLSX file will be detected and copied" -ForegroundColor Green
Write-Host ""

# Monitor execution time
$StartTime = Get-Date
Write-Host "Monitoring started at: $StartTime" -ForegroundColor Yellow
Write-Host ""
Write-Host "RUN YOUR INVOKE-ZTASSESSMENT CMDLET NOW:" -ForegroundColor White -BackgroundColor Blue
Write-Host ""

# Wait for completion
$Response = Read-Host "Type 'done' and press ENTER after Invoke-ZTAssessment completes"
$EndTime = Get-Date
$Duration = $EndTime - $StartTime

Write-Host ""
Write-Host "=== POST-EXECUTION ANALYSIS ===" -ForegroundColor Cyan
Write-Host "Execution Duration: $($Duration.TotalMinutes.ToString('F2')) minutes" -ForegroundColor White

# Look for new XLSX files in user directory
Write-Host ""
Write-Host "Scanning for new XLSX files in C:\Users\ianbart\..." -ForegroundColor Yellow

$NewFiles = @()
if (Test-Path $UserPath) {
    $AllFiles = Get-ChildItem -Path $UserPath -Filter "*.xlsx" -ErrorAction SilentlyContinue
    
    # Find files that are new or modified since start time
    $NewFiles = $AllFiles | Where-Object { 
        $_.LastWriteTime -gt $StartTime.AddMinutes(-1) -or 
        $_.CreationTime -gt $StartTime.AddMinutes(-1)
    }
    
    if ($NewFiles) {
        Write-Host "Found $($NewFiles.Count) new/modified XLSX file(s):" -ForegroundColor Green
        foreach ($File in $NewFiles) {
            Write-Host "  ✓ $($File.Name)" -ForegroundColor Green
            Write-Host "    Size: $([math]::Round($File.Length/1KB, 2)) KB" -ForegroundColor White
            Write-Host "    Created: $($File.CreationTime)" -ForegroundColor White
            Write-Host "    Modified: $($File.LastWriteTime)" -ForegroundColor White
            
            # Copy to our analysis directory
            try {
                $DestPath = Join-Path $OutputDir $File.Name
                Copy-Item $File.FullName $DestPath -Force
                Write-Host "    ✓ Copied to analysis directory" -ForegroundColor Green
            } catch {
                Write-Host "    ✗ Copy failed: $_" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "No new XLSX files found since $StartTime" -ForegroundColor Yellow
        
        # Show what files exist for debugging
        Write-Host ""
        Write-Host "All XLSX files in directory:" -ForegroundColor Cyan
        $AllFiles | ForEach-Object { 
            Write-Host "  - $($_.Name) (Modified: $($_.LastWriteTime))" -ForegroundColor Gray 
        }
    }
} else {
    Write-Host "Cannot access $UserPath for post-execution scan" -ForegroundColor Red
}

# Also check current directory for any outputs
Write-Host ""
Write-Host "Checking current directory for any outputs..." -ForegroundColor Yellow
$LocalFiles = Get-ChildItem -Path . -Include "*.xlsx", "*.csv", "*.json", "*.txt" -Recurse -ErrorAction SilentlyContinue | 
              Where-Object { $_.LastWriteTime -gt $StartTime.AddMinutes(-1) }

if ($LocalFiles) {
    Write-Host "Found $($LocalFiles.Count) local file(s):" -ForegroundColor Green
    $LocalFiles | ForEach-Object {
        Write-Host "  ✓ $($_.Name) ($($_.LastWriteTime))" -ForegroundColor Green
        Copy-Item $_.FullName $OutputDir -Force
    }
}

# Create execution summary
$Summary = @{
    Cmdlet = "Invoke-ZTAssessment"
    StartTime = $StartTime
    EndTime = $EndTime
    Duration = $Duration.ToString()
    FilesFound = $NewFiles.Count + $LocalFiles.Count
    UserDirectory = $UserPath
    NewXLSXFiles = $NewFiles | Select-Object Name, Length, CreationTime, LastWriteTime
    LocalFiles = $LocalFiles | Select-Object Name, Length, CreationTime, LastWriteTime
}

$Summary | ConvertTo-Json -Depth 3 | Out-File (Join-Path $OutputDir "ExecutionSummary.json")

Stop-Transcript

Write-Host ""
Write-Host "=== MONITORING COMPLETE ===" -ForegroundColor Green
Write-Host "Analysis Directory: $OutputDir" -ForegroundColor Yellow
Write-Host "Session Log: $TranscriptPath" -ForegroundColor Yellow
Write-Host "Files Captured: $($NewFiles.Count + $LocalFiles.Count)" -ForegroundColor Yellow
Write-Host ""
Write-Host "Next: Copy '$OutputDir' to VS Code and run: node analyze-graph-calls.js" -ForegroundColor Cyan
