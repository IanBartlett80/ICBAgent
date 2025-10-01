/**
 * Playwright Screenshot Service - Native Local Version
 * For local Windows deployment with native Playwright browser automation
 * Captures specific Microsoft 365 report pages (not landing pages)
 * 
 * @author ICB Solutions
 * @date October 2025
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs').promises;

class PlaywrightScreenshotServiceLocal {
    constructor() {
        this.browser = null;
        this.context = null;
        this.page = null;
        this.isAuthenticated = false;
        this.tenantName = null;
        this.screenshotsDir = process.env.SCREENSHOTS_DIR || '/tmp/health-reports';
    }

    /**
     * Initialize Playwright browser (headed mode for authentication)
     * @returns {Promise<void>}
     */
    async initialize() {
        console.log('🚀 Initializing Playwright browser (headed mode)...');
        
        this.browser = await chromium.launch({
            headless: false,  // Visible browser for user authentication
            args: [
                '--start-maximized',
                '--disable-blink-features=AutomationControlled'
            ]
        });
        
        this.context = await this.browser.newContext({
            viewport: { width: 1920, height: 1080 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        });
        
        this.page = await this.context.newPage();
        
        console.log('✅ Browser initialized successfully');
    }

    /**
     * Wait for user to manually authenticate to customer tenant
     * @param {Function} progressCallback - Progress update callback
     * @returns {Promise<Object>} Authentication result with tenant info
     */
    async waitForAuthentication(progressCallback) {
        console.log('🔐 Waiting for manual customer tenant authentication...');
        
        if (progressCallback) {
            progressCallback({
                step: 'authentication',
                progress: 5,
                message: 'Navigating to Microsoft sign-in...',
                details: 'Opening sign-in page...'
            });
        }
        
        // Navigate to a Microsoft 365 portal that requires authentication
        await this.page.goto('https://login.microsoftonline.com', { 
            waitUntil: 'domcontentloaded',
            timeout: 60000 
        });
        
        if (progressCallback) {
            progressCallback({
                step: 'authentication',
                progress: 10,
                message: 'Please sign in with customer tenant administrator credentials',
                details: 'Waiting for authentication...'
            });
        }
        
        // Wait for successful authentication (detect redirect away from login page)
        try {
            // Wait for either:
            // 1. Navigation to portal (success)
            // 2. Stay logged in prompt (success)
            // 3. Timeout (failure)
            await this.page.waitForURL(url => {
                const urlString = url.toString();
                return !urlString.includes('login.microsoftonline.com') || 
                       urlString.includes('kmsi');  // "Keep me signed in" page
            }, { timeout: 300000 });  // 5 minute timeout for manual auth
            
            // Handle "Stay signed in?" prompt if present
            try {
                const staySignedInButton = await this.page.locator('input[type="submit"][value="Yes"]');
                if (await staySignedInButton.isVisible({ timeout: 5000 })) {
                    await staySignedInButton.click();
                    await this.page.waitForLoadState('networkidle');
                }
            } catch (e) {
                // No "stay signed in" prompt, continue
            }
            
            this.isAuthenticated = true;
            
            // Try to extract tenant name from page or URL
            this.tenantName = await this.extractTenantName();
            
            console.log(`✅ Authentication successful for tenant: ${this.tenantName}`);
            
            if (progressCallback) {
                progressCallback({
                    step: 'authentication',
                    progress: 15,
                    message: `Successfully authenticated to ${this.tenantName}`,
                    details: 'Ready to capture screenshots'
                });
            }
            
            return {
                success: true,
                tenantName: this.tenantName
            };
            
        } catch (error) {
            console.error('❌ Authentication timeout or failed:', error.message);
            throw new Error('Customer tenant authentication failed or timed out');
        }
    }

    /**
     * Extract tenant name from current page
     * @returns {Promise<string>} Tenant name or "Customer"
     */
    async extractTenantName() {
        try {
            // Try to get tenant name from page title or content
            const title = await this.page.title();
            
            // Common patterns in M365 portal titles
            if (title.includes('|')) {
                const parts = title.split('|');
                return parts[parts.length - 1].trim();
            }
            
            // Try to extract from URL
            const url = this.page.url();
            const match = url.match(/([^.]+)\.onmicrosoft\.com/);
            if (match) {
                return match[1].charAt(0).toUpperCase() + match[1].slice(1);
            }
            
            return 'Customer';  // Default if can't extract
            
        } catch (error) {
            console.warn('⚠️ Could not extract tenant name:', error.message);
            return 'Customer';
        }
    }

    /**
     * Capture screenshot from a specific portal report page
     * @param {Object} options - Screenshot options
     * @returns {Promise<Object>} Screenshot result with path and metadata
     */
    async capturePortalScreenshot(options) {
        const { url, section, waitFor, outputPath, progressCallback } = options;
        
        console.log(`📸 Capturing screenshot: ${section}`);
        
        if (progressCallback) {
            progressCallback({
                step: 'screenshots',
                progress: options.progressValue || 20,
                message: `Capturing ${section}...`,
                details: `Navigating to ${url}`
            });
        }
        
        try {
            // Navigate to the specific report page
            await this.page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });
            
            // Wait for dynamic content to load
            // Azure portals are SPAs with lots of async loading
            await this.page.waitForTimeout(8000);  // Give graphs/charts time to render
            
            // Additional wait for specific elements if provided
            if (waitFor) {
                console.log(`  ⏳ Waiting for: ${waitFor}`);
                // Wait a bit more for charts/graphs to fully render
                await this.page.waitForTimeout(3000);
            }
            
            // Scroll to load lazy-loaded content
            await this.autoScroll(this.page);
            
            // Generate filename
            const timestamp = Date.now();
            const filename = `${section}_${timestamp}.jpg`;
            const screenshotPath = path.join(outputPath, filename);
            
            // Capture full-page screenshot
            await this.page.screenshot({
                path: screenshotPath,
                type: 'jpeg',
                quality: 90,
                fullPage: true
            });
            
            // Verify screenshot was created
            const stats = await fs.stat(screenshotPath);
            if (stats.size < 10000) {
                console.warn(`⚠️ Screenshot may be incomplete (${stats.size} bytes)`);
            }
            
            console.log(`✅ Screenshot saved: ${filename} (${(stats.size / 1024).toFixed(2)} KB)`);
            
            return {
                success: true,
                path: screenshotPath,
                section,
                url,
                filename,
                size: stats.size
            };
            
        } catch (error) {
            console.error(`❌ Failed to capture ${section}:`, error.message);
            
            // Return partial success - don't fail entire report for one screenshot
            return {
                success: false,
                section,
                url,
                error: error.message
            };
        }
    }

    /**
     * Auto-scroll page to trigger lazy-loaded content
     * @param {Page} page - Playwright page object
     */
    async autoScroll(page) {
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 300;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;

                    if (totalHeight >= scrollHeight) {
                        clearInterval(timer);
                        window.scrollTo(0, 0);  // Scroll back to top
                        resolve();
                    }
                }, 100);
            });
        });
    }

    /**
     * Capture all required portal screenshots
     * @param {string} outputPath - Directory to save screenshots
     * @param {Function} progressCallback - Progress update callback
     * @returns {Promise<Array>} Array of screenshot results
     */
    async captureAllPortalScreenshots(outputPath, progressCallback) {
        console.log('📸 Capturing all portal screenshots...');
        
        await fs.mkdir(outputPath, { recursive: true });
        
        // Define specific report pages to capture (NOT landing pages!)
        const portals = [
            {
                name: 'License Allocation',
                url: 'https://entra.microsoft.com/#view/Microsoft_AAD_IAM/LicensesMenuBlade/~/Products',
                section: 'licenses',
                waitFor: 'license table and allocation data',
                progressValue: 25
            },
            {
                name: 'Monthly Security Summary',
                url: 'https://security.microsoft.com/reports/monthly-security-summary',
                section: 'monthly_security_summary',
                waitFor: 'security metrics and graphs',
                progressValue: 35
            },
            {
                name: 'Security Report',
                url: 'https://security.microsoft.com/reports/security-report',
                section: 'security_report',
                waitFor: 'security visualizations',
                progressValue: 45
            },
            {
                name: 'Device Health',
                url: 'https://security.microsoft.com/reports/device-health',
                section: 'device_health',
                waitFor: 'device health metrics',
                progressValue: 55
            }
        ];
        
        const screenshots = [];
        
        for (const portal of portals) {
            console.log(`\n📊 Portal: ${portal.name}`);
            
            const result = await this.capturePortalScreenshot({
                ...portal,
                outputPath,
                progressCallback
            });
            
            if (result.success) {
                screenshots.push({
                    path: result.path,
                    section: result.section,
                    name: portal.name,
                    url: portal.url,
                    description: `${portal.name} showing ${portal.waitFor}`
                });
            } else {
                console.warn(`⚠️ Skipping ${portal.name} due to error`);
            }
            
            // Small delay between portals
            await this.page.waitForTimeout(2000);
        }
        
        console.log(`\n✅ Captured ${screenshots.length} of ${portals.length} portal screenshots`);
        
        return screenshots;
    }

    /**
     * Clean up browser resources
     * @returns {Promise<void>}
     */
    async cleanup() {
        console.log('🧹 Cleaning up browser resources...');
        
        if (this.page) await this.page.close();
        if (this.context) await this.context.close();
        if (this.browser) await this.browser.close();
        
        this.isAuthenticated = false;
        this.tenantName = null;
        
        console.log('✅ Browser cleanup complete');
    }
}

module.exports = PlaywrightScreenshotServiceLocal;
