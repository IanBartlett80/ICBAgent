/**
 * Playwright Screenshot Service (MCP Integration)
 * Handles browser automation, portal navigation, and screenshot capture
 * using Playwright MCP tools directly
 * 
 * This service is designed to work in a Copilot-assisted environment where
 * the AI agent uses MCP tools to control the browser on behalf of the service.
 * 
 * @author ICB Solutions
 * @date October 2025
 */

const path = require('path');
const fs = require('fs').promises;

class PlaywrightScreenshotServiceMCP {
    constructor() {
        this.isAuthenticated = false;
        this.tenantName = null;
        this.currentUrl = null;
        this.screenshotsDir = process.env.SCREENSHOTS_DIR || path.join(__dirname, '..', 'screenshots');
        
        this.navigationTimeout = parseInt(process.env.PLAYWRIGHT_NAVIGATION_TIMEOUT) || 60000;
        this.screenshotTimeout = parseInt(process.env.SCREENSHOT_TIMEOUT) || 30000;
    }

    /**
     * Initialize the service
     */
    async initialize() {
        console.log('🚀 Initializing Playwright MCP Service...');
        
        // Ensure screenshots directory exists
        try {
            await fs.mkdir(this.screenshotsDir, { recursive: true });
            console.log(`📁 Screenshots directory: ${this.screenshotsDir}`);
        } catch (error) {
            console.error('Error creating screenshots directory:', error);
        }
        
        this.isAuthenticated = false;
        console.log('✅ Playwright MCP Service initialized');
        console.log('ℹ️  Browser control will be handled by AI agent via MCP tools');
    }

    /**
     * Wait for manual authentication
     * This method provides instructions and waits for external confirmation
     * @param {Function} progressCallback - Callback to report progress
     * @returns {Promise<Object>} Authentication result
     */
    async waitForAuthentication(progressCallback) {
        console.log('🔐 Manual authentication required');
        console.log('👤 AI agent should use MCP tools to:');
        console.log('   1. Navigate to https://login.microsoftonline.com');
        console.log('   2. Wait for user to sign in to customer tenant');
        console.log('   3. Verify successful authentication');
        
        if (progressCallback) {
            progressCallback({
                step: 'authentication',
                progress: 5,
                message: 'Waiting for manual authentication...',
                details: 'Use MCP browser tools to complete sign-in'
            });
        }
        
        // In MCP mode, we rely on external agent to handle auth
        // Return a promise that instructs what needs to be done
        return {
            success: false,
            requiresManualCompletion: true,
            instructions: {
                action: 'authenticate',
                steps: [
                    'Use mcp_playwright_browser_navigate to go to https://login.microsoftonline.com',
                    'Wait for user to complete sign-in (account picker or credentials)',
                    'Use mcp_playwright_browser_snapshot to verify successful auth',
                    'Call setAuthenticationComplete() with tenant info'
                ]
            }
        };
    }

    /**
     * Mark authentication as complete (called externally)
     * @param {Object} authInfo - Authentication information
     */
    setAuthenticationComplete(authInfo) {
        this.isAuthenticated = true;
        this.tenantName = authInfo.tenantName || 'Customer';
        this.currentUrl = authInfo.currentUrl || null;
        
        console.log('✅ Authentication marked as complete');
        console.log(`🏢 Tenant: ${this.tenantName}`);
        
        return { success: true, tenantName: this.tenantName };
    }

    /**
     * Capture screenshot from a specific M365 portal
     * Returns instructions for MCP agent to execute
     * @param {Object} options - Screenshot options
     * @returns {Promise<Object>} Instructions for MCP agent
     */
    async capturePortalScreenshot(options) {
        const { url, section, waitFor, outputPath } = options;
        
        console.log(`📸 Screenshot request for ${section}: ${url}`);
        
        // Generate filename
        const timestamp = Date.now();
        const filename = `${section}_${timestamp}.jpg`;
        const screenshotPath = path.join(outputPath || this.screenshotsDir, filename);
        
        // Return instructions for MCP agent
        return {
            success: false,
            requiresManualCompletion: true,
            instructions: {
                action: 'captureScreenshot',
                section: section,
                steps: [
                    `Navigate to: ${url}`,
                    `Wait for page to load (${waitFor || 'main content'})`,
                    `Take fullPage screenshot and save to: ${screenshotPath}`,
                    `Call setScreenshotComplete() with path: ${screenshotPath}`
                ],
                mcpCommands: {
                    navigate: {
                        tool: 'mcp_playwright_browser_navigate',
                        params: { url }
                    },
                    wait: {
                        tool: 'mcp_playwright_browser_wait_for',
                        params: { time: 5 }
                    },
                    screenshot: {
                        tool: 'mcp_playwright_browser_take_screenshot',
                        params: {
                            filename: screenshotPath,
                            type: 'jpeg',
                            fullPage: true
                        }
                    }
                }
            },
            expectedPath: screenshotPath
        };
    }

    /**
     * Mark screenshot as complete (called externally after MCP capture)
     * @param {string} screenshotPath - Path to captured screenshot
     */
    setScreenshotComplete(screenshotPath) {
        console.log(`✅ Screenshot captured: ${screenshotPath}`);
        return { success: true, path: screenshotPath };
    }

    /**
     * Capture screenshots from all M365 portals
     * @param {Function} progressCallback - Callback to report progress
     * @returns {Promise<Object>} Instructions for capturing all screenshots
     */
    async captureAllPortalScreenshots(progressCallback) {
        console.log('📸 Preparing to capture all portal screenshots...');
        
        const outputPath = path.join(this.screenshotsDir, `report_${Date.now()}`);
        await fs.mkdir(outputPath, { recursive: true });
        
        // Define all portals to capture
        const portals = [
            {
                name: 'Microsoft 365 Admin Center',
                url: 'https://admin.microsoft.com',
                section: 'admin_center',
                waitFor: 'main content'
            },
            {
                name: 'Microsoft Entra Admin Center',
                url: 'https://entra.microsoft.com',
                section: 'entra_identity',
                waitFor: 'navigation'
            },
            {
                name: 'Microsoft Defender Portal',
                url: 'https://security.microsoft.com',
                section: 'security_center',
                waitFor: 'dashboard'
            },
            {
                name: 'Microsoft Intune Admin Center',
                url: 'https://intune.microsoft.com',
                section: 'intune_center',
                waitFor: 'devices'
            }
        ];
        
        // Return batch instructions
        return {
            success: false,
            requiresManualCompletion: true,
            batchOperation: true,
            instructions: {
                action: 'captureAllScreenshots',
                totalPortals: portals.length,
                outputDirectory: outputPath,
                portals: portals.map((portal, index) => ({
                    index: index + 1,
                    ...portal,
                    filename: `${portal.section}_${Date.now() + index}.jpg`,
                    path: path.join(outputPath, `${portal.section}_${Date.now() + index}.jpg`)
                })),
                workflow: [
                    'For each portal in the list:',
                    '  1. Navigate to portal URL',
                    '  2. Wait 5 seconds for page load',
                    '  3. Take full-page screenshot',
                    '  4. Report progress',
                    'After all portals captured:',
                    '  Call setAllScreenshotsComplete() with paths array'
                ]
            },
            outputPath
        };
    }

    /**
     * Mark all screenshots as complete (called externally)
     * @param {Array<string>} screenshotPaths - Array of screenshot paths
     */
    setAllScreenshotsComplete(screenshotPaths) {
        console.log(`✅ All screenshots captured: ${screenshotPaths.length} files`);
        return {
            success: true,
            screenshots: screenshotPaths,
            count: screenshotPaths.length
        };
    }

    /**
     * Extract tenant name from URL or page content
     * @param {string} url - Current URL
     * @param {string} pageContent - Page content or snapshot
     * @returns {string} Extracted tenant name
     */
    extractTenantName(url, pageContent = '') {
        try {
            // Try to extract from URL
            if (url) {
                // Look for tenant domain in URL
                const match = url.match(/([a-zA-Z0-9-]+)\.(onmicrosoft\.com|sharepoint\.com|microsoft\.com)/);
                if (match) {
                    const tenantDomain = match[1];
                    // Clean up and capitalize
                    const name = tenantDomain
                        .split('-')[0]
                        .replace(/[^a-zA-Z0-9]/g, '');
                    return name.charAt(0).toUpperCase() + name.slice(1);
                }
            }
            
            // Try to extract from page content
            if (pageContent) {
                // Look for organization or tenant name patterns
                const orgMatch = pageContent.match(/organization[:\s]+([A-Za-z0-9\s]+)/i);
                if (orgMatch) {
                    return orgMatch[1].trim();
                }
                
                const tenantMatch = pageContent.match(/tenant[:\s]+([A-Za-z0-9\s]+)/i);
                if (tenantMatch) {
                    return tenantMatch[1].trim();
                }
            }
            
            return 'Customer'; // Fallback
            
        } catch (error) {
            console.error('Error extracting tenant name:', error);
            return 'Customer'; // Fallback
        }
    }

    /**
     * Close browser (no-op in MCP mode)
     */
    async close() {
        console.log('ℹ️  Browser close requested (MCP mode)');
        console.log('   AI agent should use mcp_playwright_browser_close if needed');
        return { success: true, note: 'Browser managed externally' };
    }

    /**
     * Get service status
     */
    getStatus() {
        return {
            isAuthenticated: this.isAuthenticated,
            tenantName: this.tenantName,
            currentUrl: this.currentUrl,
            mode: 'MCP-Assisted',
            requiresAgentControl: true
        };
    }
}

module.exports = PlaywrightScreenshotServiceMCP;
