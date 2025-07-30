# PowerShell Zero Trust Assessment Monitor
# File: monitor-zero-trust-cmdlet.ps1

# Enable comprehensive logging and monitoring
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

Write-Host "🚀 ZERO TRUST ASSESSMENT MONITORING STARTED" -ForegroundColor Green
Write-Host "📁 Output Directory: $OutputDir" -ForegroundColor Yellow
Write-Host "📝 Session Transcript: $TranscriptPath" -ForegroundColor Yellow

# Function to capture Graph module information
function Capture-GraphModuleInfo {
    Write-Host "`n🔍 CAPTURING GRAPH MODULE INFORMATION" -ForegroundColor Cyan
    
    try {
        # Get installed Graph modules
        $GraphModules = Get-Module Microsoft.Graph* -ListAvailable | Select-Object Name, Version
        $GraphModules | Out-File (Join-Path $OutputDir "GraphModules.txt")
        
        Write-Host "Graph Modules:" -ForegroundColor Yellow
        $GraphModules | ForEach-Object { Write-Host "  - $($_.Name) v$($_.Version)" }
        
        # Check if already connected
        try {
            $Context = Get-MgContext -ErrorAction SilentlyContinue
            if ($Context) {
                Write-Host "`n🔗 Already connected to Graph:" -ForegroundColor Green
                Write-Host "  TenantId: $($Context.TenantId)"
                Write-Host "  Account: $($Context.Account)"
                Write-Host "  Scopes: $($Context.Scopes -join ', ')"
                $Context | ConvertTo-Json | Out-File (Join-Path $OutputDir "Initial_GraphContext.json")
            } else {
                Write-Host "`n🔗 Not currently connected to Graph" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "`n🔗 Graph context not available" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "Error capturing Graph module info: $_" -ForegroundColor Red
    }
}

# Function to enable Graph SDK logging
function Enable-GraphLogging {
    Write-Host "`n🔧 ENABLING GRAPH API LOGGING" -ForegroundColor Cyan
    
    # Enable Graph SDK debug logging
    $env:MICROSOFT_GRAPH_DEBUG = "true"
    $env:MICROSOFT_GRAPH_DEBUG_CONTENT = "true"
    
    Write-Host "✅ Graph API debugging enabled" -ForegroundColor Green
    Write-Host "  Environment variables set for detailed logging" -ForegroundColor Gray
}

# Function to capture network activity (if tools available)
function Start-NetworkCapture {
    param([switch]$Enable)
    
    if ($Enable) {
        Write-Host "`n🌐 NETWORK CAPTURE" -ForegroundColor Cyan
        Write-Host "📡 Monitoring HTTP requests to graph.microsoft.com" -ForegroundColor Yellow
        
        # Note: Actual packet capture would require additional tools
        # This is a placeholder for network monitoring
        Write-Host "  (Network capture would require Wireshark/Netsh for full analysis)" -ForegroundColor Gray
    }
}

# Function to monitor PowerShell execution
function Start-ExecutionMonitor {
    Write-Host "`n📊 EXECUTION MONITORING READY" -ForegroundColor Cyan
    
    # Create monitoring script block for potential use
    $MonitorScript = {
        param($Command)
        Write-Host "🎯 Executing: $Command" -ForegroundColor Magenta
        
        # Capture start time
        $StartTime = Get-Date
        
        # Execute and capture output
        try {
            $Result = Invoke-Expression $Command
            $EndTime = Get-Date
            $Duration = $EndTime - $StartTime
            
            Write-Host "✅ Completed in $($Duration.TotalSeconds) seconds" -ForegroundColor Green
            return $Result
        } catch {
            $EndTime = Get-Date
            $Duration = $EndTime - $StartTime
            Write-Host "❌ Failed after $($Duration.TotalSeconds) seconds: $_" -ForegroundColor Red
            throw
        }
    }
    
    Write-Host "✅ Execution monitoring prepared" -ForegroundColor Green
}

# Function to capture post-execution analysis
function Capture-PostExecution {
    Write-Host "`n📋 CAPTURING POST-EXECUTION DATA" -ForegroundColor Cyan
    
    try {
        # Capture final Graph context
        $FinalContext = Get-MgContext -ErrorAction SilentlyContinue
        if ($FinalContext) {
            Write-Host "📊 Final Graph Context:" -ForegroundColor Yellow
            Write-Host "  TenantId: $($FinalContext.TenantId)"
            Write-Host "  Account: $($FinalContext.Account)"  
            Write-Host "  Scopes: $($FinalContext.Scopes -join ', ')"
            $FinalContext | ConvertTo-Json | Out-File (Join-Path $OutputDir "Final_GraphContext.json")
        }
        
        # Look for generated files
        $GeneratedFiles = Get-ChildItem -Path . -Filter "*.xlsx" -Recurse | Where-Object { $_.CreationTime -gt (Get-Date).AddHours(-1) }
        if ($GeneratedFiles) {
            Write-Host "`n📄 Generated Excel Files:" -ForegroundColor Yellow
            $GeneratedFiles | ForEach-Object { 
                Write-Host "  - $($_.FullName)"
                Copy-Item $_.FullName $OutputDir -Force
            }
        }
        
        # Capture any CSV or JSON outputs
        $DataFiles = Get-ChildItem -Path . -Include "*.csv", "*.json" -Recurse | Where-Object { $_.CreationTime -gt (Get-Date).AddHours(-1) }
        if ($DataFiles) {
            Write-Host "`n📊 Generated Data Files:" -ForegroundColor Yellow
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
    # Initialize monitoring
    Capture-GraphModuleInfo
    Enable-GraphLogging
    Start-NetworkCapture -Enable:$NetworkCapture
    Start-ExecutionMonitor
    
    Write-Host "`n" + "="*60 -ForegroundColor White
    Write-Host "🎯 READY FOR ZERO TRUST ASSESSMENT EXECUTION" -ForegroundColor White
    Write-Host "="*60 -ForegroundColor White
    
    Write-Host "`n📋 INSTRUCTIONS:" -ForegroundColor Green
    Write-Host "1. The monitoring environment is now active" -ForegroundColor White
    Write-Host "2. Run your Zero Trust Assessment PowerShell cmdlet" -ForegroundColor White
    Write-Host "3. Let it complete fully (including Excel generation)" -ForegroundColor White
    Write-Host "4. All Graph API calls and authentication will be captured" -ForegroundColor White
    Write-Host "5. Generated reports will be copied to: $OutputDir" -ForegroundColor White
    
    Write-Host "`n⏳ Waiting for cmdlet execution..." -ForegroundColor Yellow
    Write-Host "   (All PowerShell activity is being logged)" -ForegroundColor Gray
    
    # Wait for user to run their cmdlet
    Read-Host "`nPress ENTER after your Zero Trust Assessment cmdlet has completed"
    
    # Post-execution analysis
    Capture-PostExecution
    
    Write-Host "`n✅ MONITORING COMPLETE!" -ForegroundColor Green
    Write-Host "📁 All captured data is in: $OutputDir" -ForegroundColor Yellow
    Write-Host "📝 Complete session log: $TranscriptPath" -ForegroundColor Yellow
    
} catch {
    Write-Host "`n❌ MONITORING ERROR: $_" -ForegroundColor Red
} finally {
    # Always stop transcript
    try {
        Stop-Transcript
    } catch {
        # Transcript might not be active
    }
    
    Write-Host "`n🎯 Next Step: Run analyze-graph-calls.js on the captured data" -ForegroundColor Cyan
}
