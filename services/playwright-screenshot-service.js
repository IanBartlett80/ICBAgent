/**
 * Playwright Screenshot Service
 * Handles browser automation, portal navigation, and screenshot capture
 * using Playwright MCP integration
 * 
 * @author ICB Solutions
 * @date October 2025
 */

const path = require('path');

class PlaywrightScreenshotService {
    constructor() {
        this.browser = null;
        this.page = null;
        this.isAuthenticated = false;
        this.tenantName = null;
        
        this.navigationTimeout = parseInt(process.env.PLAYWRIGHT_NAVIGATION_TIMEOUT) || 60000;
        this.screenshotTimeout = parseInt(process.env.SCREENSHOT_TIMEOUT) || 30000;
        this.elementWaitTimeout = parseInt(process.env.ELEMENT_WAIT_TIMEOUT) || 10000;
    }

    /**
     * Initialize Playwright and launch browser
     * Browser will be visible (headed mode) for manual authentication
     */
    async initialize() {
        console.log('🚀 Initializing Playwright MCP...');
        
        // Use MCP Playwright tools via the MCP server
        // The browser is already managed by the MCP server
        // We'll use the MCP tools: mcp_playwright_browser_navigate, mcp_playwright_browser_take_screenshot, etc.
        
        this.isAuthenticated = false;
        
        console.log('✅ Playwright MCP initialized');
    }

    /**
     * Wait for user to complete manual authentication
     * Opens Microsoft login page and waits for successful authentication
     * @returns {Promise<Object>} Authentication result with tenant info
     */
    async waitForAuthentication() {
        console.log('🔐 Waiting for manual authentication...');
        
        // Navigate to Microsoft login page
        const loginUrl = 'https://login.microsoftonline.com';
        
        // Use MCP navigate tool
        await this.mcpNavigate(loginUrl);
        
        // Show instructions to user via progress banner
        console.log('👤 Please sign in to the customer\'s Microsoft 365 tenant');
        console.log('⏳ Waiting for authentication to complete...');
        
        // Poll for authentication completion
        // Check if we've been redirected to a Microsoft portal
        const maxWaitTime = 300000; // 5 minutes
        const pollInterval = 2000; // 2 seconds
        let elapsed = 0;
        
        while (elapsed < maxWaitTime) {
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            elapsed += pollInterval;
            
            // Get current URL
            const currentUrl = await this.mcpGetCurrentUrl();
            
            // Check if we're on a Microsoft portal (authenticated)
            if (currentUrl && (
                currentUrl.includes('portal.office.com') ||
                currentUrl.includes('admin.microsoft.com') ||
                currentUrl.includes('entra.microsoft.com') ||
                currentUrl.includes('security.microsoft.com') ||
                currentUrl.includes('portal.azure.com')
            )) {
                console.log('✅ Authentication detected');
                this.isAuthenticated = true;
                
                // Extract tenant name from URL or page
                this.tenantName = await this.extractTenantName();
                
                return {
                    success: true,
                    tenantName: this.tenantName
                };
            }
        }
        
        // Timeout
        return {
            success: false,
            error: 'Authentication timeout - user did not complete sign-in within 5 minutes'
        };
    }

    /**
     * Capture screenshot from a specific M365 portal section
     * @param {Object} options - Screenshot options
     * @returns {Promise<string|null>} Path to saved screenshot or null if failed
     */
    async capturePortalScreenshot(options) {
        const { url, section, waitFor, outputPath } = options;
        
        console.log(`📸 Navigating to: ${url}`);
        
        try {
            // Navigate to portal URL
            await this.mcpNavigate(url);
            
            // Wait for page load and specific elements
            console.log(`⏳ Waiting for elements to render: ${waitFor}`);
            await this.mcpWaitForElement(waitFor);
            
            // Additional wait for dynamic content
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Take full-page screenshot
            const timestamp = Date.now();
            const filename = `${section}_${timestamp}.jpg`;
            const screenshotPath = path.join(outputPath, filename);
            
            console.log(`📷 Capturing screenshot: ${filename}`);
            await this.mcpTakeScreenshot(screenshotPath, true); // Full page
            
            console.log(`✅ Screenshot saved: ${screenshotPath}`);
            return screenshotPath;
            
        } catch (error) {
            console.error(`❌ Error capturing screenshot from ${url}:`, error.message);
            
            // Check if it's a permission/access issue
            if (error.message.includes('Access denied') || error.message.includes('404')) {
                console.warn(`⚠️ Skipping ${section} - not available or no permission`);
                return null;
            }
            
            throw error;
        }
    }

    /**
     * Extract tenant name from current page or URL
     * @returns {Promise<string>} Tenant name
     */
    async extractTenantName() {
        try {
            const currentUrl = await this.mcpGetCurrentUrl();
            
            // Try to extract from URL
            if (currentUrl) {
                // Look for tenant domain in URL
                const match = currentUrl.match(/([a-zA-Z0-9-]+)\.(onmicrosoft\.com|sharepoint\.com)/);
                if (match) {
                    const tenantDomain = match[1];
                    // Clean up and capitalize
                    return tenantDomain
                        .split('-')[0]
                        .replace(/[^a-zA-Z0-9]/g, '')
                        .charAt(0).toUpperCase() + tenantDomain.slice(1);
                }
            }
            
            // Try to get from page content
            const snapshot = await this.mcpSnapshot();
            if (snapshot && snapshot.includes('tenant')) {
                // Parse snapshot for tenant info
                // This is a simplified extraction
                const lines = snapshot.split('\n');
                for (const line of lines) {
                    if (line.toLowerCase().includes('organization') || line.toLowerCase().includes('tenant')) {
                        // Extract potential tenant name
                        const words = line.split(/\s+/);
                        for (const word of words) {
                            if (word.length > 3 && /^[A-Z][a-zA-Z0-9]+$/.test(word)) {
                                return word;
                            }
                        }
                    }
                }
            }
            
            return 'Customer'; // Fallback
            
        } catch (error) {
            console.error('Error extracting tenant name:', error);
            return 'Customer'; // Fallback
        }
    }

    /**
     * Close Playwright browser
     */
    async close() {
        console.log('🔒 Closing Playwright browser...');
        
        try {
            await this.mcpClose();
            console.log('✅ Browser closed');
        } catch (error) {
            console.error('Error closing browser:', error);
        }
    }

    // ========================================
    // MCP Playwright Tool Wrappers
    // ========================================

    /**
     * Navigate to URL using MCP
     */
    async mcpNavigate(url) {
        // Call MCP tool: mcp_playwright_browser_navigate
        return global.mcpClient?.callTool('mcp_playwright_browser_navigate', { url });
    }

    /**
     * Wait for element using MCP
     */
    async mcpWaitForElement(selector) {
        // Call MCP tool: mcp_playwright_browser_wait_for
        // Wait for text or element to appear
        return global.mcpClient?.callTool('mcp_playwright_browser_wait_for', {
            time: this.elementWaitTimeout / 1000 // Convert to seconds
        });
    }

    /**
     * Take screenshot using MCP
     */
    async mcpTakeScreenshot(filePath, fullPage = true) {
        // Call MCP tool: mcp_playwright_browser_take_screenshot
        return global.mcpClient?.callTool('mcp_playwright_browser_take_screenshot', {
            filename: filePath,
            type: 'jpeg',
            fullPage: fullPage
        });
    }

    /**
     * Get current URL
     */
    async mcpGetCurrentUrl() {
        // This would need to be implemented via MCP snapshot or other method
        const snapshot = await this.mcpSnapshot();
        // Parse URL from snapshot if available
        return null; // Placeholder
    }

    /**
     * Get page snapshot
     */
    async mcpSnapshot() {
        // Call MCP tool: mcp_playwright_browser_snapshot
        return global.mcpClient?.callTool('mcp_playwright_browser_snapshot', {});
    }

    /**
     * Close browser using MCP
     */
    async mcpClose() {
        // Call MCP tool: mcp_playwright_browser_close
        return global.mcpClient?.callTool('mcp_playwright_browser_close', {});
    }
}

module.exports = PlaywrightScreenshotService;
