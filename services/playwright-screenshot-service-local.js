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
        console.log('📸 Capturing all 20 portal screenshots...');
        
        await fs.mkdir(outputPath, { recursive: true });
        
        const screenshots = [];
        let progressValue = 20;
        const progressIncrement = 40 / 20;  // Spread across 20-60%
        
        try {
            // ========================================
            // 1. ENTRA PORTAL - LICENSES
            // ========================================
            console.log('\n📊 Portal 1/20: Entra Licenses');
            await this.page.goto('https://entra.microsoft.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
            await this.page.waitForTimeout(5000);
            
            // Click Billing menu
            await this.safeClick('text=Billing', 'Billing menu');
            await this.page.waitForTimeout(2000);
            
            // Click Licenses
            await this.safeClick('text=Licenses', 'Licenses submenu');
            await this.page.waitForTimeout(2000);
            
            // Click All Products
            await this.safeClick('text=All products', 'All Products');
            await this.page.waitForTimeout(5000);
            
            screenshots.push(await this.captureScreenshot({
                section: 'entra_licenses',
                name: 'Entra Licenses - All Products',
                outputPath,
                progressCallback,
                progressValue: progressValue += progressIncrement
            }));
            
            // ========================================
            // 2-6. SECURITY PORTAL - VULNERABILITY MANAGEMENT
            // ========================================
            console.log('\n📊 Portals 2-6/20: Vulnerability Management');
            await this.page.goto('https://security.microsoft.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
            await this.page.waitForTimeout(5000);
            
            // Navigate to Vulnerability Management > Dashboard
            await this.safeClick('text=Vulnerability management', 'Vulnerability Management');
            await this.page.waitForTimeout(2000);
            await this.safeClick('text=Dashboard', 'Dashboard');
            await this.page.waitForTimeout(5000);
            
            // 2. Exposure Score (top of page)
            screenshots.push(await this.captureScreenshot({
                section: 'vuln_mgmt_exposure_score',
                name: 'Exposure Score',
                outputPath,
                progressCallback,
                progressValue: progressValue += progressIncrement,
                fullPage: false
            }));
            
            // 3. Exposure Score Over Time (scroll 300px)
            await this.page.evaluate(() => window.scrollTo(0, 300));
            await this.page.waitForTimeout(3000);
            screenshots.push(await this.captureScreenshot({
                section: 'vuln_mgmt_exposure_time',
                name: 'Exposure Score Over Time',
                outputPath,
                progressCallback,
                progressValue: progressValue += progressIncrement,
                fullPage: false
            }));
            
            // 4. Device Score (scroll 500px)
            await this.page.evaluate(() => window.scrollTo(0, 500));
            await this.page.waitForTimeout(3000);
            screenshots.push(await this.captureScreenshot({
                section: 'vuln_mgmt_device_score',
                name: 'Your Score for Devices',
                outputPath,
                progressCallback,
                progressValue: progressValue += progressIncrement,
                fullPage: false
            }));
            
            // 5. Exposure Distribution (scroll 700px)
            await this.page.evaluate(() => window.scrollTo(0, 700));
            await this.page.waitForTimeout(3000);
            screenshots.push(await this.captureScreenshot({
                section: 'vuln_mgmt_exposure_distribution',
                name: 'Exposure Distribution',
                outputPath,
                progressCallback,
                progressValue: progressValue += progressIncrement,
                fullPage: false
            }));
            
            // 6. Top 10 Recommendations (new page)
            await this.safeClick('text=Recommendations', 'Recommendations');
            await this.page.waitForTimeout(5000);
            screenshots.push(await this.captureScreenshot({
                section: 'vuln_mgmt_top_10_recommendations',
                name: 'Top 10 Vulnerability Recommendations',
                outputPath,
                progressCallback,
                progressValue: progressValue += progressIncrement,
                fullPage: false
            }));
            
            // ========================================
            // 7-11. SECURITY PORTAL - SECURITY REPORTS (GENERAL)
            // ========================================
            console.log('\n📊 Portals 7-11/20: Security Reports');
            await this.page.goto('https://security.microsoft.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
            await this.page.waitForTimeout(5000);
            
            await this.safeClick('text=Reports', 'Reports menu');
            await this.page.waitForTimeout(2000);
            await this.safeClick('text=Security report', 'Security Report');
            await this.page.waitForTimeout(5000);
            
            // 7. Detections Blocked (scroll 300px)
            await this.page.evaluate(() => window.scrollTo(0, 300));
            await this.page.waitForTimeout(3000);
            screenshots.push(await this.captureScreenshot({
                section: 'security_reports_detections_blocked',
                name: 'Detections Blocked',
                outputPath,
                progressCallback,
                progressValue: progressValue += progressIncrement,
                fullPage: false
            }));
            
            // 8. ASR Rules (scroll 500px)
            await this.page.evaluate(() => window.scrollTo(0, 500));
            await this.page.waitForTimeout(3000);
            screenshots.push(await this.captureScreenshot({
                section: 'security_reports_asr_rules',
                name: 'ASR Rule Configuration',
                outputPath,
                progressCallback,
                progressValue: progressValue += progressIncrement,
                fullPage: false
            }));
            
            // 9. Threat Analytics (scroll 700px)
            await this.page.evaluate(() => window.scrollTo(0, 700));
            await this.page.waitForTimeout(3000);
            screenshots.push(await this.captureScreenshot({
                section: 'security_reports_threat_analytics',
                name: 'Threat Analytics',
                outputPath,
                progressCallback,
                progressValue: progressValue += progressIncrement,
                fullPage: false
            }));
            
            // 10. Device Compliance (scroll 900px)
            await this.page.evaluate(() => window.scrollTo(0, 900));
            await this.page.waitForTimeout(3000);
            screenshots.push(await this.captureScreenshot({
                section: 'security_reports_device_compliance',
                name: 'Device Compliance',
                outputPath,
                progressCallback,
                progressValue: progressValue += progressIncrement,
                fullPage: false
            }));
            
            // 11. Active Malware (scroll 1100px)
            await this.page.evaluate(() => window.scrollTo(0, 1100));
            await this.page.waitForTimeout(3000);
            screenshots.push(await this.captureScreenshot({
                section: 'security_reports_active_malware',
                name: 'Devices with Active Malware',
                outputPath,
                progressCallback,
                progressValue: progressValue += progressIncrement,
                fullPage: false
            }));
            
            // ========================================
            // 12-14. SECURITY PORTAL - DEVICE HEALTH
            // ========================================
            console.log('\n📊 Portals 12-14/20: Device Health');
            await this.page.goto('https://security.microsoft.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
            await this.page.waitForTimeout(5000);
            
            await this.safeClick('text=Reports', 'Reports menu');
            await this.page.waitForTimeout(2000);
            await this.safeClick('text=Device health', 'Device Health');
            await this.page.waitForTimeout(5000);
            
            // 12. Sensor Health (top)
            screenshots.push(await this.captureScreenshot({
                section: 'device_health_sensor_health',
                name: 'Sensor Health',
                outputPath,
                progressCallback,
                progressValue: progressValue += progressIncrement,
                fullPage: false
            }));
            
            // 13. OS Platforms (scroll 400px)
            await this.page.evaluate(() => window.scrollTo(0, 400));
            await this.page.waitForTimeout(3000);
            screenshots.push(await this.captureScreenshot({
                section: 'device_health_os_platforms',
                name: 'Operating Systems and Platforms',
                outputPath,
                progressCallback,
                progressValue: progressValue += progressIncrement,
                fullPage: false
            }));
            
            // 14. Windows Versions (scroll 700px)
            await this.page.evaluate(() => window.scrollTo(0, 700));
            await this.page.waitForTimeout(3000);
            screenshots.push(await this.captureScreenshot({
                section: 'device_health_windows_versions',
                name: 'Windows Versions',
                outputPath,
                progressCallback,
                progressValue: progressValue += progressIncrement,
                fullPage: false
            }));
            
            // ========================================
            // 15-20. SECURITY PORTAL - MONTHLY SECURITY REPORT
            // ========================================
            console.log('\n📊 Portals 15-20/20: Monthly Security Report');
            await this.page.goto('https://security.microsoft.com', { waitUntil: 'domcontentloaded', timeout: 60000 });
            await this.page.waitForTimeout(5000);
            
            await this.safeClick('text=Reports', 'Reports menu');
            await this.page.waitForTimeout(2000);
            await this.safeClick('text=Monthly security report', 'Monthly Security Report');
            await this.page.waitForTimeout(5000);
            
            // 15. Summary (extract text)
            const summaryText = await this.extractSummaryText();
            screenshots.push({
                success: true,
                section: 'monthly_security_summary_text',
                name: 'Monthly Security Summary (Text)',
                textContent: summaryText,
                isTextExtraction: true
            });
            progressValue += progressIncrement;
            
            // 16. Secure Score (scroll 300px)
            await this.page.evaluate(() => window.scrollTo(0, 300));
            await this.page.waitForTimeout(3000);
            screenshots.push(await this.captureScreenshot({
                section: 'monthly_security_secure_score',
                name: 'Microsoft Secure Score',
                outputPath,
                progressCallback,
                progressValue: progressValue += progressIncrement,
                fullPage: false
            }));
            
            // 17. Score Comparison (scroll 500px)
            await this.page.evaluate(() => window.scrollTo(0, 500));
            await this.page.waitForTimeout(3000);
            screenshots.push(await this.captureScreenshot({
                section: 'monthly_security_score_comparison',
                name: 'Score Comparison',
                outputPath,
                progressCallback,
                progressValue: progressValue += progressIncrement,
                fullPage: false
            }));
            
            // 18. Devices Onboarded (scroll 700px)
            await this.page.evaluate(() => window.scrollTo(0, 700));
            await this.page.waitForTimeout(3000);
            screenshots.push(await this.captureScreenshot({
                section: 'monthly_security_devices_onboarded',
                name: 'Devices Onboarded',
                outputPath,
                progressCallback,
                progressValue: progressValue += progressIncrement,
                fullPage: false
            }));
            
            // 19. Threat Protection (scroll 900px)
            await this.page.evaluate(() => window.scrollTo(0, 900));
            await this.page.waitForTimeout(3000);
            screenshots.push(await this.captureScreenshot({
                section: 'monthly_security_threat_protection',
                name: 'Protection Against Threats',
                outputPath,
                progressCallback,
                progressValue: progressValue += progressIncrement,
                fullPage: false
            }));
            
            // 20. Suspicious Activities (scroll 1100px)
            await this.page.evaluate(() => window.scrollTo(0, 1100));
            await this.page.waitForTimeout(3000);
            screenshots.push(await this.captureScreenshot({
                section: 'monthly_security_suspicious_activities',
                name: 'Suspicious Activities',
                outputPath,
                progressCallback,
                progressValue: progressValue += progressIncrement,
                fullPage: false
            }));
            
        } catch (error) {
            console.error('❌ Error during screenshot capture:', error);
            throw error;
        }
        
        console.log(`\n✅ Captured ${screenshots.length}/20 screenshots`);
        return screenshots.filter(s => s.success || s.isTextExtraction);
    }
    
    /**
     * Safe click with error handling and fallback
     */
    async safeClick(selector, elementName) {
        try {
            const element = this.page.locator(selector).first();
            await element.waitFor({ state: 'visible', timeout: 10000 });
            await element.click();
            console.log(`  ✓ Clicked: ${elementName}`);
        } catch (error) {
            console.warn(`  ⚠️ Could not click ${elementName}: ${error.message}`);
            // Continue anyway - the navigation might have already happened
        }
    }
    
    /**
     * Extract text from Monthly Security Summary section
     */
    async extractSummaryText() {
        try {
            const summaryContent = await this.page.evaluate(() => {
                // Try to find summary text in common containers
                const selectors = [
                    'div[class*="summary"]',
                    'div[class*="executive"]',
                    'p[class*="summary"]',
                    'div[role="main"] p'
                ];
                
                for (const selector of selectors) {
                    const elements = document.querySelectorAll(selector);
                    for (const el of elements) {
                        const text = el.innerText?.trim();
                        if (text && text.length > 50) {
                            return text;
                        }
                    }
                }
                
                return 'Summary text extraction not available';
            });
            
            console.log(`  ✓ Extracted summary text (${summaryContent.length} chars)`);
            return summaryContent;
        } catch (error) {
            console.warn(`  ⚠️ Could not extract summary text: ${error.message}`);
            return 'Summary text extraction failed';
        }
    }
    
    /**
     * Capture screenshot helper
     */
    async captureScreenshot(options) {
        const { section, name, outputPath, progressCallback, progressValue, fullPage = false } = options;
        
        console.log(`  📸 Capturing: ${name}`);
        
        if (progressCallback) {
            progressCallback({
                step: 'screenshots',
                progress: Math.round(progressValue),
                message: `Capturing ${name}...`,
                details: `Section ${section}`
            });
        }
        
        try {
            const timestamp = Date.now();
            const filename = `${section}_${timestamp}.jpg`;
            const screenshotPath = path.join(outputPath, filename);
            
            await this.page.screenshot({
                path: screenshotPath,
                type: 'jpeg',
                quality: 90,
                fullPage: fullPage
            });
            
            const stats = await fs.stat(screenshotPath);
            console.log(`  ✓ Saved: ${filename} (${(stats.size / 1024).toFixed(2)} KB)`);
            
            return {
                success: true,
                path: screenshotPath,
                section,
                name,
                filename,
                size: stats.size
            };
        } catch (error) {
            console.error(`  ❌ Failed to capture ${name}:`, error.message);
            return {
                success: false,
                section,
                name,
                error: error.message
            };
        }
    }
    
    /**
     * Capture screenshot from a specific portal report page (legacy method - kept for compatibility)
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
                const distance = 100;
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
