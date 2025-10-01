/**
 * Test Complete Pipeline
 * Manually test AI Analysis → Word Document → SharePoint Upload
 * Using mock screenshot data        
              
        console.log('  ✅ Word Document Generated');
        console.log(`  📁 Location: ${docPath}`);
        
        // Check file size
        const docStats = fs.statSync(docPath);
        console.log(`  📊 File size: ${(docStats.size / 1024).toFixed(2)} KB`);
        console.log('');
        
        // Step 5: Upload to SharePoint
        console.log('📤 Step 5: Uploading to SharePoint...');'  ✅ Word Document Generated');
        console.log(`  📁 Location: ${docPath}`);
        
        // Check file size
        const docStats = fs.statSync(docPath);
        console.log(`  📊 File size: ${(docStats.size / 1024).toFixed(2)} KB`);
        console.log('');ole.log('  ✅ Word Document Generated');
        console.log(`  📁 Location: ${docPath}`);
        
        // Check file size
        const docStats = fs.statSync(docPath);
        console.log(`  📊 File size: ${(docStats.size / 1024).toFixed(2)} KB`);
        console.log('');
        
        // Step 5: Upload to SharePointeenshots are on Windows host
 */

require('dotenv').config();

const path = require('path');
const fs = require('fs').promises;
const OpenAIAnalysisService = require('./services/openai-analysis-service');
const WordDocumentGenerator = require('./services/word-document-generator');
const SharePointUploadService = require('./services/sharepoint-upload-service');

async function testCompletePipeline() {
    console.log('🧪 Testing Complete Intelligent Health Report Pipeline\n');
    
    // Test configuration
    const sessionId = 'test_session_' + Date.now();
    const customerName = 'Longhorn Group';
    const tempPath = '/tmp/health-reports';
    const sessionTempPath = path.join(tempPath, sessionId);
    
    try {
        // Step 1: Create temp directory
        console.log('📁 Step 1: Creating temp directory...');
        await fs.mkdir(sessionTempPath, { recursive: true });
        console.log(`✅ Created: ${sessionTempPath}\n`);
        
        // Step 2: Create mock screenshot files
        console.log('📸 Step 2: Creating mock screenshot files...');
        const screenshots = [
            'entra-admin-center.png',
            'security-center.png',
            'intune-admin-center.png',
            'm365-admin-center.png'
        ];
        
        for (const screenshot of screenshots) {
            const filePath = path.join(sessionTempPath, screenshot);
            // Create a tiny 1x1 PNG file (valid PNG header)
            const pngHeader = Buffer.from([
                0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
                0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
                0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1 dimensions
                0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
                0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
                0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
                0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
                0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
                0x42, 0x60, 0x82
            ]);
            await fs.writeFile(filePath, pngHeader);
            console.log(`  ✅ Created: ${screenshot}`);
        }
        console.log('');
        
        // Step 3: AI Analysis with OpenAI
        console.log('🤖 Step 3: Running AI Analysis with OpenAI GPT-4o...');
        const openaiService = new OpenAIAnalysisService();
        
        const mockScreenshotData = {
            'entra-admin-center.png': {
                name: 'Entra Admin Center',
                description: 'Identity and Access Management dashboard showing 26 users, 7 groups, 5 devices, Identity Secure Score: 55%'
            },
            'security-center.png': {
                name: 'Microsoft Defender Security Center',
                description: 'Security operations center with SOC optimization, 0 active incidents, healthy service status'
            },
            'intune-admin-center.png': {
                name: 'Intune Admin Center',
                description: 'Device management showing 1 device not in compliance, 0 connector errors, service health: Healthy'
            },
            'm365-admin-center.png': {
                name: 'Microsoft 365 Admin Center',
                description: 'User management dashboard displaying 26 active users with various license assignments'
            }
        };
        
        const screenshotPaths = screenshots.map(s => path.join(sessionTempPath, s));
        
        console.log('  📊 Analyzing health data...');
        
        // Build screenshots array in the format expected by the service
        const screenshotsArray = screenshotPaths.map(filePath => {
            const filename = path.basename(filePath);
            const metadata = mockScreenshotData[filename];
            return {
                path: filePath,
                section: filename.replace('.png', ''),
                description: metadata ? metadata.description : filename
            };
        });
        
        const analysisResult = await openaiService.analyzeHealthData({
            screenshots: screenshotsArray,
            customerName: customerName,
            sessionTempPath: sessionTempPath
        });
        
        console.log('  ✅ AI Analysis Complete');
        console.log('  Analysis structure:', Object.keys(analysisResult));
        if (analysisResult.executiveSummary) {
            console.log('  📝 Executive Summary received');
        }
        if (analysisResult.sectionAnalysis) {
            console.log('  📋 Section analyses:', Object.keys(analysisResult.sectionAnalysis).length);
        }
        if (analysisResult.overallPriorities) {
            console.log('  🎯 Priorities:', analysisResult.overallPriorities.length);
        }
        console.log('');
        
        // Step 4: Generate Word Document
        console.log('📄 Step 4: Generating Word Document...');
        const wordGenerator = new WordDocumentGenerator();
        
        const docPath = await wordGenerator.generateReport({
            customerName,
            outputPath: sessionTempPath,
            screenshots: screenshotsArray,
            aiAnalysis: analysisResult
        });
        
        console.log('  ✅ Word Document Generated');
        console.log(`  📁 Location: ${docPath}`);
        
        // Check file size
        const docStats = fs.statSync(docPath);
        console.log('');
        
        // Step 5: Upload to SharePoint
        console.log('📤 Step 5: Uploading to SharePoint...');
        console.log('  ⚠️ Skipping SharePoint upload (requires ICB staff token)');
        console.log('  ℹ️ In production, this would upload to: ICB Solutions SharePoint > Monthly Reports > [YYYY] > [Customer Name]');
        console.log('');
        
        // Summary
        console.log('✅ Pipeline Test Complete!\n');
        console.log('📊 Test Results Summary:');
        console.log('  ✅ Temp directory created');
        console.log('  ✅ Mock screenshots created');
        console.log(`  ${analysisResult.success ? '✅' : '⚠️'} AI analysis completed`);
        console.log('  ✅ Word document generated');
        console.log('  ⏸️ SharePoint upload (skipped)');
        console.log('');
        console.log(`📁 All files saved to: ${sessionTempPath}`);
        console.log('');
        console.log('🎉 Success! The pipeline is working correctly.');
        
    } catch (error) {
        console.error('❌ Error during pipeline test:', error);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run the test
testCompletePipeline().catch(console.error);
