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
        
        // Set default timeout to 0 (no timeout) for all operations
        this.context.setDefaultTimeout(0);
        
        this.page = await this.context.newPage();
        
        // Also set page timeout to 0 for extra safety
        this.page.setDefaultTimeout(0);
        
        console.log('✅ Browser initialized successfully (no timeouts)');
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
     * Capture all required portal screenshots with manual capture overlay
     * @param {string} outputPath - Directory to save screenshots
     * @param {Function} progressCallback - Progress update callback
     * @returns {Promise<Array>} Array of screenshot results
     */
    async captureAllPortalScreenshots(outputPath, progressCallback) {
        console.log('📸 Starting manual screenshot capture with overlay...');
        
        await fs.mkdir(outputPath, { recursive: true });
        
        const screenshots = [];
        let progressValue = 20;
        const progressIncrement = 40 / 20;  // Spread across 20-60%
        
        // Define all 20 sections to capture
        const sectionsToCapture = this.getSectionDefinitions();
        
        try {
            // Set up automatic overlay re-injection on page navigation
            console.log('🔄 Setting up automatic overlay re-injection...');
            this.page.on('load', async () => {
                console.log('  📄 Page loaded, re-injecting overlay...');
                try {
                    await this.injectCaptureOverlay();
                } catch (error) {
                    console.warn('  ⚠️  Error re-injecting overlay on page load:', error.message);
                }
            });
            
            // Navigate to Entra portal to start capture process
            console.log('🌐 Navigating to Entra portal...');
            await this.page.goto('https://entra.microsoft.com', { 
                waitUntil: 'networkidle',  // Wait for network to be idle
                timeout: 60000 
            });
            
            // Wait for page to fully stabilize after any redirects
            await this.page.waitForTimeout(5000);
            
            // Inject the capture overlay UI
            console.log('💉 Injecting capture overlay...');
            await this.injectCaptureOverlay();
            
            // Capture each section sequentially
            for (let i = 0; i < sectionsToCapture.length; i++) {
                const section = sectionsToCapture[i];
                const sectionNumber = i + 1;
                
                progressValue += progressIncrement;
                
                if (progressCallback) {
                    progressCallback({
                        step: 'screenshots',
                        progress: Math.round(progressValue),
                        message: `Ready to capture section ${sectionNumber}/20: ${section.displayName}`,
                        details: section.instructions
                    });
                }
                
                console.log(`\\n📸 Section ${sectionNumber}/20: ${section.displayName}`);
                console.log(`   Instructions: ${section.instructions}`);
                
                // Ensure overlay exists (re-inject if page navigated)
                await this.ensureOverlayExists();
                
                // Show overlay with section info
                await this.showCapturePrompt(section, sectionNumber, sectionsToCapture.length);
                
                // Wait for user to capture the region
                const captureResult = await this.waitForUserCapture(section, outputPath);
                
                if (captureResult.success) {
                    screenshots.push(captureResult);
                    console.log(`✅ Captured: ${section.displayName}`);
                } else {
                    console.warn(`⚠️ Skipped: ${section.displayName}`);
                    // Still add to array but mark as skipped
                    screenshots.push({
                        success: false,
                        section: section.name,
                        displayName: section.displayName,
                        error: 'User skipped this section'
                    });
                }
            }
            
            // Hide overlay
            await this.hideCaptureOverlay();
            
            console.log(`\\n✅ Manual capture complete: ${screenshots.filter(s => s.success).length}/20 sections captured`);
            
        } catch (error) {
            console.error('❌ Error during manual capture:', error);
            throw error;
        }
        
        return screenshots;
    }
    
    /**
     * Get definitions for all 20 sections to capture
     * @returns {Array} Section definitions
     */
    getSectionDefinitions() {
        return [
            // 1. Entra Licenses
            {
                name: 'entra_licenses',
                displayName: 'Entra Licenses Overview',
                portal: 'Entra Admin Center',
                instructions: 'Navigate to: Entra Admin Center → Billing → Licenses → All Products. Capture the licenses table.'
            },
            // 2-5. Vulnerability Management (4 sections)
            {
                name: 'vulnerability_dashboard',
                displayName: 'Vulnerability Management Dashboard',
                portal: 'Microsoft Defender',
                instructions: 'Navigate to: Defender → Vulnerability Management → Dashboard. Capture the main dashboard overview.'
            },
            {
                name: 'vulnerability_top10',
                displayName: 'Top 10 Vulnerabilities',
                portal: 'Microsoft Defender',
                instructions: 'Navigate to: Defender → Vulnerability Management → Recommendations. Capture the top 10 most critical vulnerabilities.'
            },
            {
                name: 'vulnerability_weaknesses',
                displayName: 'Security Weaknesses',
                portal: 'Microsoft Defender',
                instructions: 'Navigate to: Defender → Vulnerability Management → Weaknesses. Capture the weaknesses summary.'
            },
            {
                name: 'vulnerability_exposed_devices',
                displayName: 'Exposed Devices',
                portal: 'Microsoft Defender',
                instructions: 'Navigate to: Defender → Vulnerability Management → Exposed Devices. Capture the exposed devices list.'
            },
            // 6-10. Security Reports (5 sections)
            {
                name: 'security_overview',
                displayName: 'Security Overview',
                portal: 'Microsoft Defender',
                instructions: 'Navigate to: Defender → Reports → Security Report. Capture the main security overview.'
            },
            {
                name: 'threat_analytics',
                displayName: 'Threat Analytics',
                portal: 'Microsoft Defender',
                instructions: 'Navigate to: Defender → Threat Analytics. Capture the threat analytics summary.'
            },
            {
                name: 'incidents_alerts',
                displayName: 'Incidents & Alerts',
                portal: 'Microsoft Defender',
                instructions: 'Navigate to: Defender → Incidents & Alerts. Capture the incidents summary.'
            },
            {
                name: 'email_security',
                displayName: 'Email & Collaboration Security',
                portal: 'Microsoft Defender',
                instructions: 'Navigate to: Defender → Email & Collaboration → Reports. Capture email security metrics.'
            },
            {
                name: 'secure_score',
                displayName: 'Microsoft Secure Score',
                portal: 'Microsoft Defender',
                instructions: 'Navigate to: Defender → Secure Score. Capture the secure score overview.'
            },
            // 11-13. Device Health (3 sections)
            {
                name: 'device_overview',
                displayName: 'Device Overview',
                portal: 'Intune Admin Center',
                instructions: 'Navigate to: Intune → Devices → Overview. Capture the device summary.'
            },
            {
                name: 'device_compliance',
                displayName: 'Device Compliance',
                portal: 'Intune Admin Center',
                instructions: 'Navigate to: Intune → Devices → Compliance. Capture compliance status.'
            },
            {
                name: 'device_health',
                displayName: 'Device Health Status',
                portal: 'Intune Admin Center',
                instructions: 'Navigate to: Intune → Reports → Device Health. Capture health metrics.'
            },
            // 14-19. Monthly Security Report (6 sections)
            {
                name: 'monthly_security_summary',
                displayName: 'Monthly Security Summary',
                portal: 'Microsoft Defender',
                instructions: 'Navigate to: Defender → Reports → Security Report → Monthly Security Report. Capture summary section.'
            },
            {
                name: 'monthly_identity_security',
                displayName: 'Identity Security Status',
                portal: 'Microsoft Defender',
                instructions: 'In Monthly Security Report: Capture the Identity Security section.'
            },
            {
                name: 'monthly_device_security',
                displayName: 'Device Security Status',
                portal: 'Microsoft Defender',
                instructions: 'In Monthly Security Report: Capture the Device Security section.'
            },
            {
                name: 'monthly_threat_protection',
                displayName: 'Threat Protection Overview',
                portal: 'Microsoft Defender',
                instructions: 'In Monthly Security Report: Capture the Threat Protection section.'
            },
            {
                name: 'monthly_vulnerabilities',
                displayName: 'Vulnerability Summary',
                portal: 'Microsoft Defender',
                instructions: 'In Monthly Security Report: Capture the Vulnerability section.'
            },
            {
                name: 'monthly_recommendations',
                displayName: 'Security Recommendations',
                portal: 'Microsoft Defender',
                instructions: 'In Monthly Security Report: Capture the Recommendations section.'
            },
            // 20. Additional Critical Metrics
            {
                name: 'conditional_access',
                displayName: 'Conditional Access Policies',
                portal: 'Entra Admin Center',
                instructions: 'Navigate to: Entra → Protection → Conditional Access. Capture policies overview.'
            }
        ];
    }
    
    /**
     * Inject floating capture overlay into the page
     * @returns {Promise<void>}
     */
    async injectCaptureOverlay() {
        try {
            // Wait for page to be ready
            await this.page.waitForLoadState('domcontentloaded', { timeout: 10000 });
            
            await this.page.addStyleTag({
                content: `
                #icb-capture-overlay {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 999999;
                    background: linear-gradient(135deg, #022541 0%, #2f6b8a 100%);
                    border: 2px solid #3e8ab4;
                    border-radius: 12px;
                    padding: 20px;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
                    font-family: 'Segoe UI', system-ui, sans-serif;
                    color: white;
                    max-width: 400px;
                    display: none;
                }
                #icb-capture-overlay h3 {
                    margin: 0 0 10px 0;
                    font-size: 18px;
                    color: #3e8ab4;
                    font-weight: 600;
                }
                #icb-capture-overlay p {
                    margin: 8px 0;
                    font-size: 14px;
                    line-height: 1.5;
                }
                #icb-capture-overlay .progress-text {
                    color: #10b981;
                    font-weight: 600;
                    margin-bottom: 8px;
                }
                #icb-capture-overlay .instructions {
                    background: rgba(62, 138, 180, 0.2);
                    padding: 12px;
                    border-radius: 8px;
                    border-left: 4px solid #3e8ab4;
                    margin: 12px 0;
                    font-size: 13px;
                }
                #icb-capture-overlay .buttons {
                    display: flex;
                    gap: 10px;
                    margin-top: 16px;
                }
                #icb-capture-overlay button {
                    flex: 1;
                    padding: 12px 20px;
                    border: none;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                #icb-capture-btn {
                    background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                    color: white;
                }
                #icb-capture-btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
                }
                #icb-skip-btn {
                    background: rgba(255, 255, 255, 0.1);
                    color: white;
                }
                #icb-skip-btn:hover {
                    background: rgba(255, 255, 255, 0.2);
                }
                #icb-selection-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                    z-index: 999998;
                    cursor: crosshair;
                    display: none;
                }
                #icb-selection-box {
                    position: fixed;
                    border: 3px solid #10b981;
                    background: rgba(16, 185, 129, 0.1);
                    z-index: 999999;
                    pointer-events: none;
                    display: none;
                }
            `
        });
        
        await this.page.evaluate(() => {
            // Create overlay elements
            const overlay = document.createElement('div');
            overlay.id = 'icb-capture-overlay';
            overlay.innerHTML = `
                <h3>📸 ICB Screenshot Capture</h3>
                <p class="progress-text" id="icb-progress-text">Ready to capture</p>
                <div class="instructions" id="icb-instructions">
                    Waiting for instructions...
                </div>
                <div class="buttons">
                    <button id="icb-capture-btn">Capture Region</button>
                    <button id="icb-skip-btn">Skip</button>
                </div>
            `;
            document.body.appendChild(overlay);
            
            // Create selection overlay (for region selection)
            const selectionOverlay = document.createElement('div');
            selectionOverlay.id = 'icb-selection-overlay';
            document.body.appendChild(selectionOverlay);
            
            // Create selection box
            const selectionBox = document.createElement('div');
            selectionBox.id = 'icb-selection-box';
            document.body.appendChild(selectionBox);
            
            // Store capture state
            window.icbCaptureState = {
                isCapturing: false,
                captureRequested: false,
                skipRequested: false,
                selectionComplete: false,
                selectionBounds: null
            };
            
            // Region selection logic
            let startX, startY, isSelecting = false;
            
            selectionOverlay.addEventListener('mousedown', (e) => {
                isSelecting = true;
                startX = e.clientX;
                startY = e.clientY;
                selectionBox.style.display = 'block';
                selectionBox.style.left = startX + 'px';
                selectionBox.style.top = startY + 'px';
                selectionBox.style.width = '0px';
                selectionBox.style.height = '0px';
            });
            
            selectionOverlay.addEventListener('mousemove', (e) => {
                if (!isSelecting) return;
                
                const currentX = e.clientX;
                const currentY = e.clientY;
                const width = Math.abs(currentX - startX);
                const height = Math.abs(currentY - startY);
                const left = Math.min(currentX, startX);
                const top = Math.min(currentY, startY);
                
                selectionBox.style.left = left + 'px';
                selectionBox.style.top = top + 'px';
                selectionBox.style.width = width + 'px';
                selectionBox.style.height = height + 'px';
            });
            
            selectionOverlay.addEventListener('mouseup', (e) => {
                if (!isSelecting) return;
                isSelecting = false;
                
                const currentX = e.clientX;
                const currentY = e.clientY;
                const width = Math.abs(currentX - startX);
                const height = Math.abs(currentY - startY);
                const left = Math.min(currentX, startX);
                const top = Math.min(currentY, startY);
                
                // Store bounds
                window.icbCaptureState.selectionBounds = {
                    x: left,
                    y: top,
                    width: width,
                    height: height
                };
                
                window.icbCaptureState.selectionComplete = true;
                
                // Hide selection UI
                selectionOverlay.style.display = 'none';
                selectionBox.style.display = 'none';
            });
            
            // Button handlers
            document.getElementById('icb-capture-btn').addEventListener('click', () => {
                window.icbCaptureState.captureRequested = true;
                selectionOverlay.style.display = 'block';
            });
            
            document.getElementById('icb-skip-btn').addEventListener('click', () => {
                window.icbCaptureState.skipRequested = true;
            });
        });
        } catch (error) {
            console.error('❌ Error injecting capture overlay:', error.message);
            throw error;
        }
    }
    
    /**
     * Ensure overlay exists on current page (re-inject if needed after navigation)
     * @returns {Promise<void>}
     */
    async ensureOverlayExists() {
        try {
            const overlayExists = await this.page.evaluate(() => {
                return !!document.getElementById('icb-capture-overlay') && !!window.icbCaptureState;
            });
            
            if (!overlayExists) {
                console.log('  🔄 Re-injecting overlay after page navigation...');
                await this.injectCaptureOverlay();
                // Wait a bit for DOM to be ready
                await this.page.waitForTimeout(1000);
            }
        } catch (error) {
            console.warn('  ⚠️  Error checking overlay, re-injecting...', error.message);
            await this.injectCaptureOverlay();
            await this.page.waitForTimeout(1000);
        }
    }
    
    /**
     * Show capture prompt for a specific section
     * @param {Object} section - Section definition
     * @param {number} sectionNumber - Current section number
     * @param {number} totalSections - Total number of sections
     * @returns {Promise<void>}
     */
    async showCapturePrompt(section, sectionNumber, totalSections) {
        await this.page.evaluate((args) => {
            const { section, sectionNumber, totalSections } = args;
            const overlay = document.getElementById('icb-capture-overlay');
            const progressText = document.getElementById('icb-progress-text');
            const instructions = document.getElementById('icb-instructions');
            
            // Safety checks
            if (!overlay || !progressText || !instructions) {
                console.error('Overlay elements not found! Overlay:', !!overlay, 'Progress:', !!progressText, 'Instructions:', !!instructions);
                return;
            }
            
            overlay.style.display = 'block';
            progressText.textContent = `Section ${sectionNumber}/${totalSections}: ${section.displayName}`;
            instructions.innerHTML = `
                <strong>📍 Portal:</strong> ${section.portal}<br><br>
                <strong>📋 Instructions:</strong><br>
                ${section.instructions}
            `;
            
            // Reset state
            if (window.icbCaptureState) {
                window.icbCaptureState.captureRequested = false;
                window.icbCaptureState.skipRequested = false;
                window.icbCaptureState.selectionComplete = false;
                window.icbCaptureState.selectionBounds = null;
            }
        }, { section, sectionNumber, totalSections });
    }
    
    /**
     * Wait for user to capture a region or skip
     * @param {Object} section - Section definition
     * @param {string} outputPath - Directory to save screenshot
     * @returns {Promise<Object>} Capture result
     */
    async waitForUserCapture(section, outputPath) {
        // Wait for user action (capture or skip) - NO TIMEOUT
        await this.page.waitForFunction(() => {
            // Safety check: ensure icbCaptureState exists
            if (!window.icbCaptureState) return false;
            return window.icbCaptureState.skipRequested || window.icbCaptureState.selectionComplete;
        }, { timeout: 0 }); // No timeout - user has unlimited time
        
        const state = await this.page.evaluate(() => window.icbCaptureState);
        
        if (state.skipRequested) {
            console.log('  ⏭️  User skipped this section');
            return {
                success: false,
                section: section.name,
                displayName: section.displayName,
                skipped: true
            };
        }
        
        if (state.selectionComplete && state.selectionBounds) {
            // Capture the selected region
            const bounds = state.selectionBounds;
            const timestamp = Date.now();
            const filename = `${section.name}_${timestamp}.jpg`;
            const screenshotPath = path.join(outputPath, filename);
            
            // Take screenshot of the selected region
            await this.page.screenshot({
                path: screenshotPath,
                type: 'jpeg',
                quality: 90,
                clip: {
                    x: bounds.x,
                    y: bounds.y,
                    width: bounds.width,
                    height: bounds.height
                }
            });
            
            const stats = await fs.stat(screenshotPath);
            console.log(`  ✅ Saved: ${filename} (${(stats.size / 1024).toFixed(2)} KB)`);
            
            return {
                success: true,
                path: screenshotPath,
                section: section.name,
                displayName: section.displayName,
                filename,
                size: stats.size,
                bounds
            };
        }
        
        return {
            success: false,
            section: section.name,
            displayName: section.displayName,
            error: 'Unknown error during capture'
        };
    }
    
    /**
     * Hide capture overlay
     * @returns {Promise<void>}
     */
    async hideCaptureOverlay() {
        await this.page.evaluate(() => {
            const overlay = document.getElementById('icb-capture-overlay');
            if (overlay) overlay.style.display = 'none';
        });
    }

    /**
     * Safe click helper - continues if element not found
     * @param {string} selector - Element selector
     * @param {string} elementName - Human-readable element name
     */
    async safeClick(selector, elementName) {
        try {
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
