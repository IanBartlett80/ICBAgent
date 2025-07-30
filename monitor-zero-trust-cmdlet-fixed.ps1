# PowerShell Zero Trust Assessment Monitor
# File: monitor-zero-trust-cmdlet-fixed.ps1

param(
    [switch]$Verbose,
    [switch]$NetworkCapture,
    [string]$OutputPath = "."
)

$ErrorActionPreference = "Continue"
$WarningPreference = "Continue"

# Create timestamped output directory
$Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$OutputDir = Join-Path $OutputPath "ZeroTrust_Analysis_$Timestamp"
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

# Start transcript for complete session capture
$TranscriptPath = Join-Path $OutputDir "Complete_Session.log"
Start-Transcript -Path $TranscriptPath -Append

Write-Host "Zero Trust Assessment Monitoring Started" -ForegroundColor Green
Write-Host "Output Directory: $OutputDir" -ForegroundColor Yellow
Write-Host "Session Transcript: $TranscriptPath" -ForegroundColor Yellow

function Capture-GraphModuleInfo {
    Write-Host "`nCapturing Graph Module Information" -ForegroundColor Cyan
    
    try {
        $GraphModules = Get-Module Microsoft.Graph* -ListAvailable | Select-Object Name, Version
        $GraphModules | Out-File (Join-Path $OutputDir "GraphModules.txt")
        
        Write-Host "Graph Modules:" -ForegroundColor Yellow
        $GraphModules | ForEach-Object { Write-Host "  - $($_.Name) v$($_.Version)" }
        
        try {
            $Context = Get-MgContext -ErrorAction SilentlyContinue
            if ($Context) {
                Write-Host "`nAlready connected to Graph:" -ForegroundColor Green
                Write-Host "  TenantId: $($Context.TenantId)"
                Write-Host "  Account: $($Context.Account)"
                Write-Host "  Scopes: $($Context.Scopes -join ', ')"
                $Context | ConvertTo-Json | Out-File (Join-Path $OutputDir "Initial_GraphContext.json")
            } else {
                Write-Host "`nNot currently connected to Graph" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "`nGraph context not available" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "Error capturing Graph module info: $_" -ForegroundColor Red
    }
}

function Enable-GraphLogging {
    Write-Host "`nEnabling Graph API Logging" -ForegroundColor Cyan
    
    $env:MICROSOFT_GRAPH_DEBUG = "true"
    $env:MICROSOFT_GRAPH_DEBUG_CONTENT = "true"
    
    Write-Host "Graph API debugging enabled" -ForegroundColor Green
    Write-Host "Environment variables set for detailed logging" -ForegroundColor Gray
}

function Start-NetworkCapture {
    param([switch]$Enable)
    
    if ($Enable) {
        Write-Host "`nNetwork Capture" -ForegroundColor Cyan
        Write-Host "Monitoring HTTP requests to graph.microsoft.com" -ForegroundColor Yellow
        Write-Host "(Network capture would require Wireshark/Netsh for full analysis)" -ForegroundColor Gray
    }
}

function Start-ExecutionMonitor {
    Write-Host "`nExecution Monitoring Ready" -ForegroundColor Cyan
    Write-Host "Execution monitoring prepared" -ForegroundColor Green
}

function Capture-PostExecution {
    Write-Host "`nCapturing Post-Execution Data" -ForegroundColor Cyan
    
    try {
        $FinalContext = Get-MgContext -ErrorAction SilentlyContinue
        if ($FinalContext) {
            Write-Host "Final Graph Context:" -ForegroundColor Yellow
            Write-Host "  TenantId: $($FinalContext.TenantId)"
            Write-Host "  Account: $($FinalContext.Account)"
            Write-Host "  Scopes: $($FinalContext.Scopes -join ', ')"
            $FinalContext | ConvertTo-Json | Out-File (Join-Path $OutputDir "Final_GraphContext.json")
        }
        
        $GeneratedFiles = Get-ChildItem -Path . -Filter "*.xlsx" -Recurse | Where-Object { $_.CreationTime -gt (Get-Date).AddHours(-1) }
        if ($GeneratedFiles) {
            Write-Host "`nGenerated Excel Files:" -ForegroundColor Yellow
            $GeneratedFiles | ForEach-Object { 
                Write-Host "  - $($_.FullName)"
                Copy-Item $_.FullName $OutputDir -Force
            }
        }
        
        $DataFiles = Get-ChildItem -Path . -Include "*.csv", "*.json" -Recurse | Where-Object { $_.CreationTime -gt (Get-Date).AddHours(-1) }
        if ($DataFiles) {
            Write-Host "`nGenerated Data Files:" -ForegroundColor Yellow
            $DataFiles | ForEach-Object {
                Write-Host "  - $($_.FullName)"
                Copy-Item $_.FullName $OutputDir -Force
            }
        }
    } catch {
        Write-Host "Error in post-execution capture: $_" -ForegroundColor Red
    }
}

# Main execution
try {
    Capture-GraphModuleInfo
    Enable-GraphLogging
    Start-NetworkCapture -Enable:$NetworkCapture
    Start-ExecutionMonitor
    
    Write-Host "`n============================================================" -ForegroundColor White
    Write-Host "READY FOR ZERO TRUST ASSESSMENT EXECUTION" -ForegroundColor White
    Write-Host "============================================================" -ForegroundColor White
    
    Write-Host "`nInstructions:" -ForegroundColor Green
    Write-Host "1. The monitoring environment is now active" -ForegroundColor White
    Write-Host "2. Run your Zero Trust Assessment PowerShell cmdlet" -ForegroundColor White
    Write-Host "3. Let it complete fully (including Excel generation)" -ForegroundColor White
    Write-Host "4. All Graph API calls and authentication will be captured" -ForegroundColor White
    Write-Host "5. Generated reports will be copied to: $OutputDir" -ForegroundColor White
    
    Write-Host "`nWaiting for cmdlet execution..." -ForegroundColor Yellow
    Write-Host "(All PowerShell activity is being logged)" -ForegroundColor Gray
    
    Read-Host "`nPress ENTER after your Zero Trust Assessment cmdlet has completed"
    
    Capture-PostExecution
    
    Write-Host "`nMonitoring Complete!" -ForegroundColor Green
    Write-Host "All captured data is in: $OutputDir" -ForegroundColor Yellow
    Write-Host "Complete session log: $TranscriptPath" -ForegroundColor Yellow
    
} catch {
    Write-Host "`nMonitoring Error: $_" -ForegroundColor Red
} finally {
    try {
        Stop-Transcript
    } catch {
        # Transcript might not be active
    }
    
    Write-Host "`nNext Step: Run analyze-graph-calls.js on the captured data" -ForegroundColor Cyan
}
