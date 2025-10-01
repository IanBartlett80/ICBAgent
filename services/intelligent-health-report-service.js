/**
 * Intelligent Health Report Service
 * Main orchestrator for generating comprehensive M365 health reports
 * with Playwright screenshots and OpenAI analysis
 * 
 * @author ICB Solutions
 * @date October 2025
 */

const path = require('path');
const fs = require('fs').promises;
const PlaywrightScreenshotService = require('./playwright-screenshot-service-local');
const OpenAIAnalysisService = require('./openai-analysis-service');
const WordDocumentGenerator = require('./word-document-generator');
const SharePointUploadService = require('./sharepoint-upload-service');

class IntelligentHealthReportService {
    constructor(io) {
        this.io = io;
        this.playwrightService = new PlaywrightScreenshotService();
        this.openaiService = new OpenAIAnalysisService();
        this.wordGenerator = new WordDocumentGenerator();
        this.sharepointService = new SharePointUploadService();
        
        this.tempPath = process.env.TEMP_REPORT_PATH || '/tmp/health-reports';
        this.autoCleanup = process.env.AUTO_CLEANUP_TEMP !== 'false';
    }

    /**
     * Generate a complete intelligent health report
     * @param {Object} options - Report generation options
     * @param {string} options.sessionId - Unique session identifier
     * @param {string} options.socketId - Socket.IO client identifier
     * @param {string} options.icbAccessToken - ICB Solutions staff access token
     * @returns {Promise<Object>} Report generation result
     */
    async generateReport(options) {
        const { sessionId, socketId, icbAccessToken } = options;
        
        console.log(`📊 Starting intelligent health report generation for session: ${sessionId}`);
        
        // Create temp directory for this session
        const sessionTempPath = path.join(this.tempPath, sessionId);
        await fs.mkdir(sessionTempPath, { recursive: true });
        
        const result = {
            success: false,
            sessionId,
            error: null,
            customerName: null,
            documentPath: null,
            sharepointPath: null
        };
        
        try {
            // Step 1: Launch Playwright and wait for manual authentication
            this.emitProgress(socketId, {
                step: 'authentication',
                progress: 5,
                message: 'Launching browser for customer tenant authentication...',
                details: 'Initializing browser...'
            });
            
            await this.playwrightService.initialize();
            
            this.emitProgress(socketId, {
                step: 'authentication',
                progress: 10,
                message: 'Please sign in to the customer\'s Microsoft 365 tenant...',
                details: 'Waiting for manual sign-in...'
            });
            
            // Wait for user to complete manual authentication with progress updates
            const authResult = await this.playwrightService.waitForAuthentication(
                (progress) => this.emitProgress(socketId, progress)
            );
            
            if (!authResult.success) {
                throw new Error('Customer tenant authentication failed or was cancelled');
            }
            
            result.customerName = authResult.tenantName;
            
            this.emitProgress(socketId, {
                step: 'authentication',
                progress: 15,
                message: `Authenticated to ${result.customerName}. Starting data collection...`,
                details: 'Authentication successful'
            });
            
            // Step 2: Capture screenshots from M365 portals
            this.emitProgress(socketId, {
                step: 'screenshots',
                progress: 20,
                message: 'Capturing screenshots from Microsoft 365 portals...',
                details: 'Starting screenshot capture...'
            });
            
            const screenshots = await this.playwrightService.captureAllPortalScreenshots(
                sessionTempPath,
                (progress) => this.emitProgress(socketId, progress)
            );
            
            this.emitProgress(socketId, {
                step: 'screenshots',
                progress: 60,
                message: `Captured ${screenshots.length} screenshots successfully`,
                details: 'All portal screenshots captured'
            });
            
            // Step 3: Analyze data with OpenAI
            this.emitProgress(socketId, {
                step: 'analysis',
                progress: 65,
                message: 'Analyzing data with AI to generate recommendations...',
                details: 'Processing with GPT-4o...'
            });
            
            const aiAnalysis = await this.openaiService.analyzeHealthData({
                screenshots,
                customerName: result.customerName,
                sessionTempPath
            });
            
            this.emitProgress(socketId, {
                step: 'analysis',
                progress: 75,
                message: 'AI analysis complete. Generating Word document...',
                details: 'Insights and recommendations generated'
            });
            
            // Step 4: Generate Word document
            this.emitProgress(socketId, {
                step: 'document',
                progress: 80,
                message: 'Creating professional Word document...',
                details: 'Building report structure...'
            });
            
            const documentPath = await this.wordGenerator.generateReport({
                customerName: result.customerName,
                screenshots,
                aiAnalysis,
                outputPath: sessionTempPath
            });
            
            result.documentPath = documentPath;
            
            this.emitProgress(socketId, {
                step: 'document',
                progress: 85,
                message: 'Word document generated successfully',
                details: 'Report document ready'
            });
            
            // Step 5: Upload to SharePoint
            this.emitProgress(socketId, {
                step: 'upload',
                progress: 90,
                message: 'Uploading report to ICB Solutions SharePoint...',
                details: 'Connecting to SharePoint...'
            });
            
            const sharepointResult = await this.sharepointService.uploadReport({
                documentPath,
                customerName: result.customerName,
                accessToken: icbAccessToken
            });
            
            result.sharepointPath = sharepointResult.webUrl;
            
            this.emitProgress(socketId, {
                step: 'upload',
                progress: 100,
                message: 'Report generation complete!',
                details: 'Successfully uploaded to SharePoint'
            });
            
            // Cleanup Playwright
            await this.playwrightService.close();
            
            // Cleanup temp files if configured
            if (this.autoCleanup) {
                await this.cleanupTempFiles(sessionTempPath);
            }
            
            result.success = true;
            console.log(`✅ Report generation complete for ${result.customerName}`);
            
        } catch (error) {
            console.error(`❌ Error generating report for session ${sessionId}:`, error);
            result.error = error.message;
            
            // Try to save partial report
            try {
                if (result.documentPath) {
                    // Document was created, save it locally
                    this.emitProgress(socketId, {
                        step: 'error-partial-save',
                        progress: 100,
                        message: 'Error occurred. Partial report saved locally.'
                    });
                }
            } catch (saveError) {
                console.error('Error saving partial report:', saveError);
            }
            
            // Cleanup Playwright
            try {
                await this.playwrightService.close();
            } catch (closeError) {
                console.error('Error closing Playwright:', closeError);
            }
        }
        
        return result;
    }

    /**
     * Capture screenshots from all M365 portals
     * @param {string} sessionTempPath - Temporary directory path
     * @param {string} socketId - Socket.IO client identifier
     * @returns {Promise<Array>} Array of screenshot metadata
     */
    async captureAllPortalScreenshots(sessionTempPath, socketId) {
        const screenshots = [];
        
        // Portal configurations
        const portals = [
            {
                name: 'Entra - Licenses',
                url: `${process.env.ENTRA_PORTAL_URL}/billing/licenses`,
                section: 'licenses',
                waitFor: '[role="grid"]', // Wait for license grid
                description: 'License allocation and usage details'
            },
            {
                name: 'Security - Monthly Summary',
                url: `${process.env.SECURITY_PORTAL_URL}/reports/monthly-security-summary`,
                section: 'security-summary',
                waitFor: '.metrics-container, [class*="metric"]',
                description: 'Monthly security metrics and trends'
            },
            {
                name: 'Security - Security Report',
                url: `${process.env.SECURITY_PORTAL_URL}/reports/security-report`,
                section: 'security-report',
                waitFor: '[class*="chart"], [class*="graph"]',
                description: 'Comprehensive security posture report'
            },
            {
                name: 'Security - Device Health',
                url: `${process.env.SECURITY_PORTAL_URL}/reports/device-health`,
                section: 'device-health',
                waitFor: '[class*="device"], [class*="compliance"]',
                description: 'Device health and compliance metrics'
            }
        ];
        
        for (let i = 0; i < portals.length; i++) {
            const portal = portals[i];
            
            this.emitProgress(socketId, {
                step: 'screenshots',
                progress: 20 + (i * 10),
                message: `Capturing ${portal.name}... (${i + 1} of ${portals.length})`,
                details: `Processing ${portal.section}...`
            });
            
            try {
                const screenshotPath = await this.playwrightService.capturePortalScreenshot({
                    url: portal.url,
                    section: portal.section,
                    waitFor: portal.waitFor,
                    outputPath: sessionTempPath
                });
                
                if (screenshotPath) {
                    screenshots.push({
                        name: portal.name,
                        path: screenshotPath,
                        section: portal.section,
                        description: portal.description,
                        url: portal.url
                    });
                    
                    console.log(`✅ Captured: ${portal.name}`);
                } else {
                    console.warn(`⚠️ Skipped: ${portal.name} (unavailable or no permission)`);
                }
            } catch (error) {
                console.error(`❌ Error capturing ${portal.name}:`, error.message);
                // Continue with other portals
            }
        }
        
        return screenshots;
    }

    /**
     * Emit progress update to client
     * @param {string} socketId - Socket.IO client identifier
     * @param {Object} progress - Progress data
     */
    emitProgress(socketId, progress) {
        if (this.io) {
            this.io.to(socketId).emit('intelligent-report-progress', progress);
        }
    }

    /**
     * Clean up temporary files
     * @param {string} sessionTempPath - Path to temporary directory
     */
    async cleanupTempFiles(sessionTempPath) {
        try {
            await fs.rm(sessionTempPath, { recursive: true, force: true });
            console.log(`🧹 Cleaned up temp files: ${sessionTempPath}`);
        } catch (error) {
            console.error('Error cleaning up temp files:', error);
        }
    }
}

module.exports = IntelligentHealthReportService;
