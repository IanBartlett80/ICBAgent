// JavaScript Graph API Call Analyzer
// File: analyze-graph-calls.js

const fs = require('fs');
const path = require('path');

class ZeroTrustAnalyzer {
    constructor() {
        this.graphCalls = [];
        this.permissions = new Set();
        this.authFlow = [];
        this.dataStructures = {};
        this.errors = [];
        this.assessmentFlow = [];
    }

    analyzeSession(outputDir) {
        console.log('🔍 ANALYZING ZERO TRUST ASSESSMENT SESSION');
        console.log('==========================================');
        
        try {
            // Read session transcript
            const transcriptFile = this.findTranscriptFile(outputDir);
            if (!transcriptFile) {
                console.error('❌ No transcript file found');
                return null;
            }
            
            console.log(`📝 Analyzing transcript: ${transcriptFile}`);
            const transcript = fs.readFileSync(path.join(outputDir, transcriptFile), 'utf8');
            
            // Analyze execution summary if available
            this.analyzeExecutionSummary(outputDir);
            
            // Analyze different aspects
            this.extractGraphAPICalls(transcript);
            this.extractAuthenticationFlow(transcript);
            this.extractPermissions(transcript);
            this.extractErrors(transcript);
            this.extractAssessmentFlow(transcript);
            
            // Analyze generated files
            this.analyzeGeneratedFiles(outputDir);
            
            // Generate comprehensive report
            return this.generateReport(outputDir);
            
        } catch (error) {
            console.error('❌ Analysis error:', error.message);
            return null;
        }
    }

    findTranscriptFile(outputDir) {
        const files = fs.readdirSync(outputDir);
        return files.find(f => (f.includes('Complete_Session') || f.includes('InvokeZT_Session')) && f.endsWith('.log'));
    }

    analyzeExecutionSummary(outputDir) {
        console.log('\n📊 Analyzing Execution Summary...');
        
        try {
            const summaryPath = path.join(outputDir, 'ExecutionSummary.json');
            if (fs.existsSync(summaryPath)) {
                const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
                console.log(`   Cmdlet: ${summary.Cmdlet || 'Unknown'}`);
                console.log(`   Duration: ${summary.Duration || 'Unknown'}`);
                console.log(`   Files Generated: ${summary.FilesFound || 0}`);
                
                if (summary.NewXLSXFiles) {
                    console.log(`   Excel Report: ${summary.NewXLSXFiles.Name}`);
                    console.log(`   Report Size: ${(summary.NewXLSXFiles.Length / 1024).toFixed(1)} KB`);
                }
                
                this.dataStructures.executionSummary = summary;
            } else {
                console.log('   No execution summary found');
            }
        } catch (error) {
            console.log(`   Error reading execution summary: ${error.message}`);
        }
    }

    extractGraphAPICalls(content) {
        console.log('\n📡 Extracting Graph API Calls...');
        
        // Patterns for different Graph API call formats - enhanced for Invoke-ZTAssessment
        const patterns = [
            // Direct URLs
            /https:\/\/graph\.microsoft\.com\/[^\s\)'"]+/gi,
            // PowerShell cmdlets
            /Invoke-MgGraphRequest[^\n]+/gi,
            /Invoke-RestMethod[^\n]*graph\.microsoft\.com[^\n]*/gi,
            // SDK calls
            /Get-Mg\w+[^\n]+/gi,
            /New-Mg\w+[^\n]+/gi,
            /Set-Mg\w+[^\n]+/gi,
            // Zero Trust Assessment specific patterns
            /Invoke-ZTAssessment[^\n]+/gi,
            // Authentication patterns
            /Connect-MgGraph[^\n]+/gi,
            /Connect-AzAccount[^\n]+/gi,
            // API calls in verbose output
            /GET\s+https:\/\/[^\s]+/gi,
            /POST\s+https:\/\/[^\s]+/gi,
            // OAuth and token patterns
            /oauth[^\n]+/gi,
            /token[^\n]+/gi,
        ];
        
        patterns.forEach(pattern => {
            const matches = content.match(pattern) || [];
            matches.forEach(match => {
                const cleaned = this.cleanGraphCall(match);
                if (cleaned && !this.graphCalls.find(c => c.endpoint === cleaned.endpoint)) {
                    this.graphCalls.push(cleaned);
                }
            });
        });
        
        console.log(`   Found ${this.graphCalls.length} unique Graph API calls`);
        this.graphCalls.forEach(call => {
            console.log(`   - ${call.method} ${call.endpoint}`);
        });
    }

    extractAuthenticationFlow(content) {
        console.log('\n🔐 Extracting Authentication Flow...');
        
        const authPatterns = [
            /Connect-MgGraph[^\n]+/gi,
            /authentication[^\n]+/gi,
            /login[^\n]+/gi,
            /consent[^\n]+/gi,
            /token[^\n]+/gi
        ];
        
        authPatterns.forEach(pattern => {
            const matches = content.match(pattern) || [];
            matches.forEach(match => {
                this.authFlow.push({
                    step: match.trim(),
                    timestamp: this.extractTimestamp(match)
                });
            });
        });
        
        console.log(`   Found ${this.authFlow.length} authentication-related events`);
    }

    extractPermissions(content) {
        console.log('\n🔑 Extracting Permissions...');
        
        // Look for scope/permission patterns
        const permissionPatterns = [
            /Scopes:\s*([^\n\r]+)/gi,
            /Permission[^\n]*:\s*([^\n\r]+)/gi,
            /\.Read\.All|\.ReadWrite\.All|\.Manage\.All/gi
        ];
        
        permissionPatterns.forEach(pattern => {
            const matches = content.match(pattern) || [];
            matches.forEach(match => {
                // Extract individual permissions
                const perms = match.split(/[,;\s]+/)
                    .filter(p => p.includes('.') && (p.includes('All') || p.includes('Read') || p.includes('Write')))
                    .map(p => p.trim().replace(/['"]/g, ''));
                
                perms.forEach(perm => this.permissions.add(perm));
            });
        });
        
        console.log(`   Found ${this.permissions.size} unique permissions:`);
        Array.from(this.permissions).sort().forEach(perm => {
            console.log(`   - ${perm}`);
        });
    }

    extractErrors(content) {
        console.log('\n❌ Extracting Errors and Warnings...');
        
        const errorPatterns = [
            /error[^\n]+/gi,
            /exception[^\n]+/gi,
            /failed[^\n]+/gi,
            /warning[^\n]+/gi
        ];
        
        errorPatterns.forEach(pattern => {
            const matches = content.match(pattern) || [];
            matches.forEach(match => {
                this.errors.push({
                    message: match.trim(),
                    timestamp: this.extractTimestamp(match)
                });
            });
        });
        
        console.log(`   Found ${this.errors.length} errors/warnings`);
    }

    extractAssessmentFlow(content) {
        console.log('\n🏗️ Extracting Assessment Flow...');
        
        // Look for assessment-specific patterns
        const assessmentPatterns = [
            /identity/gi,
            /device/gi,
            /application/gi,
            /network/gi,
            /security/gi,
            /compliance/gi,
            /conditional\s*access/gi
        ];
        
        assessmentPatterns.forEach(pattern => {
            const matches = content.match(pattern) || [];
            if (matches.length > 0) {
                const category = pattern.source.replace(/\\s\*/g, ' ').replace(/\\/g, '');
                this.assessmentFlow.push({
                    category: category,
                    mentions: matches.length
                });
            }
        });
        
        console.log(`   Assessment categories found:`);
        this.assessmentFlow.forEach(cat => {
            console.log(`   - ${cat.category}: ${cat.mentions} mentions`);
        });
    }

    analyzeGeneratedFiles(outputDir) {
        console.log('\n📄 Analyzing Generated Files...');
        
        const files = fs.readdirSync(outputDir);
        const excelFiles = files.filter(f => f.endsWith('.xlsx'));
        const jsonFiles = files.filter(f => f.endsWith('.json'));
        const csvFiles = files.filter(f => f.endsWith('.csv'));
        
        console.log(`   Excel files: ${excelFiles.length}`);
        console.log(`   JSON files: ${jsonFiles.length}`);
        console.log(`   CSV files: ${csvFiles.length}`);
        
        // Try to analyze JSON files for structure
        jsonFiles.forEach(file => {
            try {
                const content = fs.readFileSync(path.join(outputDir, file), 'utf8');
                const data = JSON.parse(content);
                this.dataStructures[file] = {
                    keys: Object.keys(data),
                    structure: this.analyzeObjectStructure(data)
                };
                console.log(`   - ${file}: ${Object.keys(data).length} top-level keys`);
            } catch (error) {
                console.log(`   - ${file}: Unable to parse JSON`);
            }
        });
    }

    cleanGraphCall(rawCall) {
        // Extract clean endpoint and method
        const urlMatch = rawCall.match(/https:\/\/graph\.microsoft\.com\/[^\s\)'"]+/);
        if (!urlMatch) return null;
        
        const url = urlMatch[0];
        const method = rawCall.toLowerCase().includes('post') ? 'POST' : 
                     rawCall.toLowerCase().includes('patch') ? 'PATCH' :
                     rawCall.toLowerCase().includes('delete') ? 'DELETE' : 'GET';
        
        return {
            endpoint: url,
            method: method,
            raw: rawCall.trim()
        };
    }

    extractTimestamp(text) {
        const timeMatch = text.match(/\d{2}:\d{2}:\d{2}/);
        return timeMatch ? timeMatch[0] : null;
    }

    analyzeObjectStructure(obj, depth = 0) {
        if (depth > 2) return '[deep object]'; // Prevent infinite recursion
        
        if (Array.isArray(obj)) {
            return `[array of ${obj.length} items]`;
        } else if (typeof obj === 'object' && obj !== null) {
            const keys = Object.keys(obj);
            return keys.slice(0, 5).reduce((acc, key) => {
                acc[key] = this.analyzeObjectStructure(obj[key], depth + 1);
                return acc;
            }, {});
        } else {
            return typeof obj;
        }
    }

    generateReport(outputDir) {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                graphAPICalls: this.graphCalls.length,
                uniquePermissions: this.permissions.size,
                authenticationSteps: this.authFlow.length,
                errors: this.errors.length,
                assessmentCategories: this.assessmentFlow.length
            },
            analysis: {
                graphEndpoints: this.graphCalls,
                requiredPermissions: Array.from(this.permissions).sort(),
                authenticationFlow: this.authFlow,
                assessmentFlow: this.assessmentFlow,
                errors: this.errors,
                dataStructures: this.dataStructures
            },
            recommendations: this.generateRecommendations()
        };
        
        // Save detailed report
        const reportPath = path.join(outputDir, 'ZeroTrust_Analysis_Report.json');
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        
        // Generate summary
        this.printSummary(report);
        
        return report;
    }

    generateRecommendations() {
        return {
            implementation: [
                "Create ZeroTrustAssessment class in server.js",
                "Implement Graph API permission checking",
                "Build assessment data collection methods",
                "Create HTML report generation with Excel-like layout",
                "Add administrator notes functionality"
            ],
            graphAPI: [
                "Use Microsoft Graph SDK for Node.js",
                "Implement proper OAuth2 flow with required scopes",
                "Add retry logic for rate limiting",
                "Cache assessment data for better performance"
            ],
            security: [
                "Store assessment results server-side only",
                "Implement proper access controls",
                "Add audit logging for assessments",
                "Ensure sensitive data is not logged"
            ]
        };
    }

    printSummary(report) {
        console.log('\n📊 ZERO TRUST ASSESSMENT ANALYSIS SUMMARY');
        console.log('==========================================');
        console.log(`📡 Graph API Calls: ${report.summary.graphAPICalls}`);
        console.log(`🔑 Required Permissions: ${report.summary.uniquePermissions}`);
        console.log(`🔐 Authentication Steps: ${report.summary.authenticationSteps}`);
        console.log(`⚠️  Errors/Warnings: ${report.summary.errors}`);
        console.log(`🏗️  Assessment Categories: ${report.summary.assessmentCategories}`);
        
        console.log('\n🎯 TOP GRAPH API ENDPOINTS:');
        report.analysis.graphEndpoints.slice(0, 10).forEach(call => {
            console.log(`   ${call.method} ${call.endpoint}`);
        });
        
        console.log('\n🔑 KEY PERMISSIONS REQUIRED:');
        report.analysis.requiredPermissions.slice(0, 10).forEach(perm => {
            console.log(`   - ${perm}`);
        });
        
        console.log('\n📊 IMPLEMENTATION ROADMAP:');
        console.log('1. Set up Graph API authentication with discovered permissions');
        console.log('2. Implement data collection using discovered endpoints');
        console.log('3. Build assessment logic based on discovered flow');
        console.log('4. Create HTML report matching Excel template structure');
        console.log('5. Add interactive features and administrator notes');
        
        console.log(`\n💾 Full analysis saved to: ZeroTrust_Analysis_Report.json`);
    }
}

// CLI usage
if (require.main === module) {
    const analyzer = new ZeroTrustAnalyzer();
    
    // Look for analysis directories
    const dirs = fs.readdirSync('.')
        .filter(item => {
            try {
                return fs.statSync(item).isDirectory() && (item.startsWith('ZeroTrust_Analysis_') || item.startsWith('ZeroTrust_InvokeZT_'));
            } catch (e) {
                return false;
            }
        });
    
    if (dirs.length > 0) {
        const latestDir = dirs.sort().pop();
        console.log(`📁 Found analysis directory: ${latestDir}`);
        analyzer.analyzeSession(latestDir);
    } else {
        console.log('❌ No ZeroTrust analysis directories found.');
        console.log('Please run the PowerShell monitoring script first.');
    }
}

module.exports = ZeroTrustAnalyzer;
