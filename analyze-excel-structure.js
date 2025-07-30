// Excel Structure Analyzer for Zero Trust Assessment
// File: analyze-excel-structure.js

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

class ExcelStructureAnalyzer {
    constructor() {
        this.worksheets = [];
        this.sharedStrings = [];
        this.relationships = [];
        this.structure = {};
    }

    async analyzeExcelFile(filePath) {
        console.log('📊 ANALYZING EXCEL FILE STRUCTURE');
        console.log('================================');
        console.log(`File: ${path.basename(filePath)}`);
        console.log(`Size: ${(fs.statSync(filePath).size / 1024).toFixed(1)} KB`);
        
        try {
            // Create temporary extraction directory
            const tempDir = path.join(path.dirname(filePath), 'excel_extracted');
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
            fs.mkdirSync(tempDir);

            // Extract Excel file (it's a ZIP archive)
            console.log('\n📦 Extracting Excel archive...');
            try {
                await execAsync(`cd "${path.dirname(filePath)}" && unzip -q "${path.basename(filePath)}" -d excel_extracted`);
                console.log('✅ Extraction successful');
            } catch (error) {
                console.log('❌ Unzip failed, trying alternative extraction...');
                // Try with different unzip options
                try {
                    await execAsync(`cd "${path.dirname(filePath)}" && unzip -o "${path.basename(filePath)}" -d excel_extracted`);
                    console.log('✅ Alternative extraction successful');
                } catch (altError) {
                    console.log('❌ Excel extraction failed:', altError.message);
                    return null;
                }
            }

            // Analyze extracted structure
            await this.analyzeExtractedContent(tempDir);
            
            // Generate comprehensive report
            const report = this.generateStructureReport();
            
            // Save analysis report
            const reportPath = path.join(path.dirname(filePath), 'Excel_Structure_Analysis.json');
            fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
            console.log(`\n💾 Structure analysis saved to: ${path.basename(reportPath)}`);
            
            // Clean up
            fs.rmSync(tempDir, { recursive: true, force: true });
            
            return report;
            
        } catch (error) {
            console.error('❌ Analysis error:', error.message);
            return null;
        }
    }

    async analyzeExtractedContent(tempDir) {
        console.log('\n🔍 Analyzing extracted content...');
        
        // Analyze workbook structure
        await this.analyzeWorkbook(tempDir);
        
        // Analyze worksheets
        await this.analyzeWorksheets(tempDir);
        
        // Analyze shared strings (text content)
        await this.analyzeSharedStrings(tempDir);
        
        // Analyze relationships
        await this.analyzeRelationships(tempDir);
        
        // Look for charts and drawings
        await this.analyzeChartsAndDrawings(tempDir);
    }

    async analyzeWorkbook(tempDir) {
        console.log('\n📚 Analyzing workbook structure...');
        
        const workbookPath = path.join(tempDir, 'xl', 'workbook.xml');
        if (fs.existsSync(workbookPath)) {
            const content = fs.readFileSync(workbookPath, 'utf8');
            
            // Extract sheet names and relationships
            const sheetMatches = content.match(/<sheet[^>]*>/g) || [];
            console.log(`   Found ${sheetMatches.length} worksheets:`);
            
            sheetMatches.forEach((match, index) => {
                const nameMatch = match.match(/name="([^"]*)"/);
                const sheetIdMatch = match.match(/sheetId="([^"]*)"/);
                const rIdMatch = match.match(/r:id="([^"]*)"/);
                
                const sheet = {
                    index: index + 1,
                    name: nameMatch ? nameMatch[1] : `Sheet${index + 1}`,
                    sheetId: sheetIdMatch ? sheetIdMatch[1] : index + 1,
                    relationshipId: rIdMatch ? rIdMatch[1] : null
                };
                
                this.worksheets.push(sheet);
                console.log(`   - ${sheet.name} (ID: ${sheet.sheetId})`);
            });
        }
    }

    async analyzeWorksheets(tempDir) {
        console.log('\n📋 Analyzing individual worksheets...');
        
        const worksheetsDir = path.join(tempDir, 'xl', 'worksheets');
        if (fs.existsSync(worksheetsDir)) {
            const files = fs.readdirSync(worksheetsDir);
            
            for (const file of files) {
                if (file.endsWith('.xml')) {
                    const filePath = path.join(worksheetsDir, file);
                    const content = fs.readFileSync(filePath, 'utf8');
                    
                    console.log(`   📄 ${file}:`);
                    
                    // Count rows and columns with data
                    const cellMatches = content.match(/<c[^>]*r="[^"]*"[^>]*>/g) || [];
                    const rowMatches = content.match(/<row[^>]*>/g) || [];
                    
                    console.log(`      Rows: ${rowMatches.length}`);
                    console.log(`      Cells with data: ${cellMatches.length}`);
                    
                    // Look for merged cells
                    const mergedCells = content.match(/<mergeCell[^>]*>/g) || [];
                    if (mergedCells.length > 0) {
                        console.log(`      Merged cells: ${mergedCells.length}`);
                    }
                    
                    // Look for hyperlinks
                    const hyperlinks = content.match(/<hyperlink[^>]*>/g) || [];
                    if (hyperlinks.length > 0) {
                        console.log(`      Hyperlinks: ${hyperlinks.length}`);
                    }
                }
            }
        }
    }

    async analyzeSharedStrings(tempDir) {
        console.log('\n📝 Analyzing shared strings (text content)...');
        
        const sharedStringsPath = path.join(tempDir, 'xl', 'sharedStrings.xml');
        if (fs.existsSync(sharedStringsPath)) {
            const content = fs.readFileSync(sharedStringsPath, 'utf8');
            
            // Extract unique text strings
            const stringMatches = content.match(/<t[^>]*>([^<]*)<\/t>/g) || [];
            const uniqueStrings = new Set();
            
            stringMatches.forEach(match => {
                const textMatch = match.match(/<t[^>]*>([^<]*)<\/t>/);
                if (textMatch && textMatch[1]) {
                    uniqueStrings.add(textMatch[1]);
                }
            });
            
            console.log(`   Total strings: ${stringMatches.length}`);
            console.log(`   Unique strings: ${uniqueStrings.size}`);
            
            // Look for Zero Trust related terms
            const ztTerms = ['Zero Trust', 'Identity', 'Device', 'Network', 'Application', 'Data', 'Infrastructure'];
            const foundTerms = [];
            
            uniqueStrings.forEach(str => {
                ztTerms.forEach(term => {
                    if (str.toLowerCase().includes(term.toLowerCase())) {
                        foundTerms.push(`${term}: "${str}"`);
                    }
                });
            });
            
            if (foundTerms.length > 0) {
                console.log('\n   🎯 Zero Trust related content found:');
                foundTerms.slice(0, 10).forEach(term => {
                    console.log(`      ${term}`);
                });
                if (foundTerms.length > 10) {
                    console.log(`      ... and ${foundTerms.length - 10} more`);
                }
            }
            
            this.sharedStrings = Array.from(uniqueStrings);
        }
    }

    async analyzeRelationships(tempDir) {
        console.log('\n🔗 Analyzing relationships...');
        
        const relsDir = path.join(tempDir, 'xl', '_rels');
        if (fs.existsSync(relsDir)) {
            const files = fs.readdirSync(relsDir);
            
            files.forEach(file => {
                if (file.endsWith('.rels')) {
                    const filePath = path.join(relsDir, file);
                    const content = fs.readFileSync(filePath, 'utf8');
                    
                    const relMatches = content.match(/<Relationship[^>]*>/g) || [];
                    console.log(`   ${file}: ${relMatches.length} relationships`);
                }
            });
        }
    }

    async analyzeChartsAndDrawings(tempDir) {
        console.log('\n📊 Analyzing charts and drawings...');
        
        // Check for charts
        const chartsDir = path.join(tempDir, 'xl', 'charts');
        if (fs.existsSync(chartsDir)) {
            const chartFiles = fs.readdirSync(chartsDir);
            console.log(`   Charts found: ${chartFiles.length}`);
            
            chartFiles.forEach(file => {
                console.log(`   - ${file}`);
            });
        }
        
        // Check for drawings
        const drawingsDir = path.join(tempDir, 'xl', 'drawings');
        if (fs.existsSync(drawingsDir)) {
            const drawingFiles = fs.readdirSync(drawingsDir);
            console.log(`   Drawings found: ${drawingFiles.length}`);
        }
    }

    generateStructureReport() {
        return {
            timestamp: new Date().toISOString(),
            analysis: 'Zero Trust Assessment Excel Structure',
            worksheets: this.worksheets,
            content: {
                totalSharedStrings: this.sharedStrings.length,
                zeroTrustTerms: this.extractZeroTrustTerms(),
                assessmentCategories: this.extractAssessmentCategories()
            },
            implementation: {
                htmlStructure: this.generateHTMLStructure(),
                requiredComponents: this.identifyRequiredComponents(),
                dataRequirements: this.identifyDataRequirements()
            }
        };
    }

    extractZeroTrustTerms() {
        const ztKeywords = ['Zero Trust', 'Identity', 'Device', 'Network', 'Application', 'Data', 'Infrastructure', 'Security', 'Compliance', 'Assessment'];
        
        return this.sharedStrings.filter(str => 
            ztKeywords.some(keyword => 
                str.toLowerCase().includes(keyword.toLowerCase())
            )
        ).slice(0, 20); // Top 20 relevant terms
    }

    extractAssessmentCategories() {
        // Look for category-like strings
        return this.sharedStrings.filter(str => 
            str.length > 5 && 
            str.length < 50 && 
            (str.includes('Assessment') || str.includes('Score') || str.includes('Compliance') || str.includes('Security'))
        ).slice(0, 15);
    }

    generateHTMLStructure() {
        return {
            suggested: 'Multi-tab HTML interface matching Excel worksheets',
            worksheets: this.worksheets.map(sheet => ({
                name: sheet.name,
                htmlEquivalent: `${sheet.name.toLowerCase().replace(/\s+/g, '-')}-tab`
            })),
            navigation: 'Tab-based navigation system',
            responsiveDesign: 'Mobile-first approach with collapsible sections'
        };
    }

    identifyRequiredComponents() {
        return [
            'Tab navigation system',
            'Chart/visualization components',
            'Data table components',
            'Score/rating display components',
            'Interactive assessment forms',
            'Export functionality',
            'Administrator notes section'
        ];
    }

    identifyDataRequirements() {
        return [
            'Microsoft Graph API integration',
            'Security compliance data collection',
            'Identity and access management metrics',
            'Device compliance status',
            'Network security configurations',
            'Application security policies',
            'Data protection settings'
        ];
    }
}

// CLI usage
if (require.main === module) {
    const analyzer = new ExcelStructureAnalyzer();
    
    // Look for Excel files in analysis directories
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
        
        // Look for Excel files in the directory
        const files = fs.readdirSync(latestDir);
        const excelFile = files.find(f => f.endsWith('.xlsx'));
        
        if (excelFile) {
            const filePath = path.join(latestDir, excelFile);
            console.log(`📊 Found Excel file: ${excelFile}`);
            analyzer.analyzeExcelFile(filePath);
        } else {
            console.log('❌ No Excel files found in analysis directory');
        }
    } else {
        console.log('❌ No analysis directories found');
    }
}

module.exports = ExcelStructureAnalyzer;
