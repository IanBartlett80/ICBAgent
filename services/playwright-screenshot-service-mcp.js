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
        
        // Define all portals to capture - COMPREHENSIVE M365 HEALTH MONITORING
        const portals = [
            // 1. ENTRA PORTAL - LICENSES
            {
                name: 'Entra Portal - License Allocation (All Products)',
                url: 'https://entra.microsoft.com',
                section: 'entra_licenses',
                navigationSteps: [
                    'Navigate to https://entra.microsoft.com',
                    'Wait 5 seconds for portal to load',
                    'Click on "Billing" in the left navigation menu',
                    'Wait 3 seconds',
                    'Click on "Licenses" sub-menu item',
                    'Wait 3 seconds',
                    'Click on "All Products" option',
                    'Wait 5 seconds for license table to fully load',
                    'Scroll down if needed to ensure all licenses are visible',
                    'Take screenshot of the licenses table'
                ],
                waitFor: 'license table with all products',
                description: 'Billing > Licenses > All Products - License allocation overview',
                requiresScroll: false
            },
            
            // 2. SECURITY PORTAL - VULNERABILITY MANAGEMENT DASHBOARD
            {
                name: 'Security Portal - Vulnerability Management Dashboard (Exposure Score)',
                url: 'https://security.microsoft.com',
                section: 'vuln_mgmt_exposure_score',
                navigationSteps: [
                    'Navigate to https://security.microsoft.com',
                    'Wait 5 seconds for portal to load',
                    'Click on "Vulnerability Management" in the left navigation menu',
                    'Wait 3 seconds',
                    'Click on "Dashboard" option',
                    'Wait 5 seconds for dashboard to load',
                    'Take screenshot of Exposure Score section (top of page)'
                ],
                waitFor: 'exposure score metrics',
                description: 'Vulnerability Management > Dashboard - Exposure Score',
                requiresScroll: false
            },
            {
                name: 'Security Portal - Vulnerability Management Dashboard (Exposure Score Over Time)',
                url: 'https://security.microsoft.com',
                section: 'vuln_mgmt_exposure_time',
                navigationSteps: [
                    'Should already be on Vulnerability Management > Dashboard',
                    'Scroll down to "Exposure Score over Time" section',
                    'Wait 3 seconds for chart to render',
                    'Take screenshot of the trend chart'
                ],
                waitFor: 'exposure score time series chart',
                description: 'Vulnerability Management > Dashboard - Exposure Score Over Time',
                requiresScroll: true,
                scrollAmount: 300
            },
            {
                name: 'Security Portal - Vulnerability Management Dashboard (Device Score)',
                url: 'https://security.microsoft.com',
                section: 'vuln_mgmt_device_score',
                navigationSteps: [
                    'Should already be on Vulnerability Management > Dashboard',
                    'Scroll down to "Your Score for devices" section',
                    'Wait 3 seconds for data to load',
                    'Take screenshot of device score metrics'
                ],
                waitFor: 'device score section',
                description: 'Vulnerability Management > Dashboard - Your Score for Devices',
                requiresScroll: true,
                scrollAmount: 500
            },
            {
                name: 'Security Portal - Vulnerability Management Dashboard (Exposure Distribution)',
                url: 'https://security.microsoft.com',
                section: 'vuln_mgmt_exposure_distribution',
                navigationSteps: [
                    'Should already be on Vulnerability Management > Dashboard',
                    'Scroll down to "Exposure distribution" section',
                    'Wait 3 seconds for visualization to render',
                    'Take screenshot of distribution chart'
                ],
                waitFor: 'exposure distribution visualization',
                description: 'Vulnerability Management > Dashboard - Exposure Distribution',
                requiresScroll: true,
                scrollAmount: 700
            },
            
            // 3. SECURITY PORTAL - VULNERABILITY RECOMMENDATIONS (TOP 10)
            {
                name: 'Security Portal - Vulnerability Recommendations (Top 10 Priorities)',
                url: 'https://security.microsoft.com',
                section: 'vuln_mgmt_top_10_recommendations',
                navigationSteps: [
                    'Navigate to https://security.microsoft.com',
                    'Wait 5 seconds for portal to load',
                    'Click on "Vulnerability Management" in the left navigation menu',
                    'Wait 3 seconds',
                    'Click on "Recommendations" option',
                    'Wait 5 seconds for recommendations table to load',
                    'Ensure table is sorted by priority (default)',
                    'Take screenshot showing the top 10 vulnerabilities',
                    'NOTE: AI analysis should focus specifically on these top 10 for monthly priorities'
                ],
                waitFor: 'recommendations table with top vulnerabilities',
                description: 'Vulnerability Management > Recommendations - Top 10 vulnerability priorities for next month',
                requiresScroll: false,
                aiInstructions: 'Focus on the TOP 10 vulnerabilities only. Provide detailed analysis and remediation steps for each.'
            },
            
            // 4. SECURITY PORTAL - SECURITY REPORTS (GENERAL)
            {
                name: 'Security Portal - Security Reports (Detections Blocked)',
                url: 'https://security.microsoft.com',
                section: 'security_reports_detections_blocked',
                navigationSteps: [
                    'Navigate to https://security.microsoft.com',
                    'Wait 5 seconds for portal to load',
                    'Click on "Reports" in the left navigation menu',
                    'Wait 3 seconds',
                    'Click on "Security Reports" under General section',
                    'Wait 5 seconds for report to load',
                    'Scroll down to locate "Detections Blocked" section',
                    'Wait 3 seconds',
                    'Take screenshot of Detections Blocked metrics'
                ],
                waitFor: 'detections blocked data',
                description: 'Reports > Security Reports > Detections Blocked',
                requiresScroll: true,
                scrollAmount: 300
            },
            {
                name: 'Security Portal - Security Reports (ASR Rule Configuration)',
                url: 'https://security.microsoft.com',
                section: 'security_reports_asr_rules',
                navigationSteps: [
                    'Should already be on Security Reports page',
                    'Scroll down to "ASR rule configuration" section',
                    'Wait 3 seconds for data to load',
                    'Take screenshot of ASR configuration'
                ],
                waitFor: 'ASR rule configuration data',
                description: 'Reports > Security Reports > ASR Rule Configuration',
                requiresScroll: true,
                scrollAmount: 500
            },
            {
                name: 'Security Portal - Security Reports (Threat Analytics)',
                url: 'https://security.microsoft.com',
                section: 'security_reports_threat_analytics',
                navigationSteps: [
                    'Should already be on Security Reports page',
                    'Scroll down to "Threat Analytics" section',
                    'Wait 3 seconds for analytics to load',
                    'Take screenshot of threat analytics'
                ],
                waitFor: 'threat analytics section',
                description: 'Reports > Security Reports > Threat Analytics',
                requiresScroll: true,
                scrollAmount: 700
            },
            {
                name: 'Security Portal - Security Reports (Device Compliance)',
                url: 'https://security.microsoft.com',
                section: 'security_reports_device_compliance',
                navigationSteps: [
                    'Should already be on Security Reports page',
                    'Scroll down to "Device Compliance" section',
                    'Wait 3 seconds',
                    'Take screenshot of compliance metrics'
                ],
                waitFor: 'device compliance section',
                description: 'Reports > Security Reports > Device Compliance',
                requiresScroll: true,
                scrollAmount: 900
            },
            {
                name: 'Security Portal - Security Reports (Devices with Active Malware)',
                url: 'https://security.microsoft.com',
                section: 'security_reports_active_malware',
                navigationSteps: [
                    'Should already be on Security Reports page',
                    'Scroll down to "Devices with active malware" section',
                    'Wait 3 seconds',
                    'Take screenshot of malware detection data'
                ],
                waitFor: 'active malware section',
                description: 'Reports > Security Reports > Devices with Active Malware',
                requiresScroll: true,
                scrollAmount: 1100
            },
            
            // 5. SECURITY PORTAL - DEVICE HEALTH REPORT
            {
                name: 'Security Portal - Device Health Report (Sensor Health)',
                url: 'https://security.microsoft.com',
                section: 'device_health_sensor_health',
                navigationSteps: [
                    'Navigate to https://security.microsoft.com',
                    'Wait 5 seconds for portal to load',
                    'Click on "Reports" in the left navigation menu',
                    'Wait 3 seconds',
                    'Click on "Device Health" under Endpoints section',
                    'Wait 5 seconds for report to load',
                    'Take screenshot of "Sensor Health" section (top of page)'
                ],
                waitFor: 'sensor health metrics',
                description: 'Reports > Device Health (Endpoints) > Sensor Health',
                requiresScroll: false
            },
            {
                name: 'Security Portal - Device Health Report (Operating Systems)',
                url: 'https://security.microsoft.com',
                section: 'device_health_os_platforms',
                navigationSteps: [
                    'Should already be on Device Health report',
                    'Scroll down to "Operating systems and platforms" section',
                    'Wait 3 seconds',
                    'Take screenshot of OS distribution'
                ],
                waitFor: 'operating systems section',
                description: 'Reports > Device Health (Endpoints) > Operating Systems and Platforms',
                requiresScroll: true,
                scrollAmount: 400
            },
            {
                name: 'Security Portal - Device Health Report (Windows Versions)',
                url: 'https://security.microsoft.com',
                section: 'device_health_windows_versions',
                navigationSteps: [
                    'Should already be on Device Health report',
                    'Scroll down to "Windows versions" section',
                    'Wait 3 seconds',
                    'Take screenshot of Windows version distribution'
                ],
                waitFor: 'Windows versions section',
                description: 'Reports > Device Health (Endpoints) > Windows Versions',
                requiresScroll: true,
                scrollAmount: 700
            },
            
            // 6. SECURITY PORTAL - MONTHLY SECURITY REPORT
            {
                name: 'Security Portal - Monthly Security Report (Summary - TEXT EXTRACTION)',
                url: 'https://security.microsoft.com',
                section: 'monthly_security_summary_text',
                navigationSteps: [
                    'Navigate to https://security.microsoft.com',
                    'Wait 5 seconds for portal to load',
                    'Click on "Reports" in the left navigation menu',
                    'Wait 3 seconds',
                    'Click on "Monthly Security Report" under Endpoints section',
                    'Wait 5 seconds for report to load',
                    'Take snapshot to extract text from Summary section',
                    'SPECIAL: Extract text content directly for use in report'
                ],
                waitFor: 'monthly summary section',
                description: 'Reports > Monthly Security Report > Summary (Extract text content)',
                requiresScroll: false,
                extractText: true,
                textExtractionNote: 'Use text content directly in report generation, not as screenshot'
            },
            {
                name: 'Security Portal - Monthly Security Report (Microsoft Secure Score)',
                url: 'https://security.microsoft.com',
                section: 'monthly_security_secure_score',
                navigationSteps: [
                    'Should already be on Monthly Security Report',
                    'Scroll down to "Microsoft Secure Score" section',
                    'Wait 3 seconds for score to load',
                    'Take screenshot of secure score metrics'
                ],
                waitFor: 'Microsoft Secure Score section',
                description: 'Reports > Monthly Security Report > Microsoft Secure Score',
                requiresScroll: true,
                scrollAmount: 300
            },
            {
                name: 'Security Portal - Monthly Security Report (Score Comparison)',
                url: 'https://security.microsoft.com',
                section: 'monthly_security_score_comparison',
                navigationSteps: [
                    'Should already be on Monthly Security Report',
                    'Scroll down to "Your secure score compared to organizations of similar size" section',
                    'Wait 3 seconds for comparison data to load',
                    'Take screenshot of comparison metrics'
                ],
                waitFor: 'score comparison section',
                description: 'Reports > Monthly Security Report > Score Comparison with Similar Organizations',
                requiresScroll: true,
                scrollAmount: 500
            },
            {
                name: 'Security Portal - Monthly Security Report (Devices Onboarded)',
                url: 'https://security.microsoft.com',
                section: 'monthly_security_devices_onboarded',
                navigationSteps: [
                    'Should already be on Monthly Security Report',
                    'Scroll down to "Devices onboarded to Defender for Business" section',
                    'Wait 3 seconds',
                    'Take screenshot of onboarded devices metrics'
                ],
                waitFor: 'devices onboarded section',
                description: 'Reports > Monthly Security Report > Devices Onboarded to Defender',
                requiresScroll: true,
                scrollAmount: 700
            },
            {
                name: 'Security Portal - Monthly Security Report (Threat Protection)',
                url: 'https://security.microsoft.com',
                section: 'monthly_security_threat_protection',
                navigationSteps: [
                    'Should already be on Monthly Security Report',
                    'Scroll down to "Protection against specific types of threats" section',
                    'Wait 3 seconds',
                    'Take screenshot of threat protection data'
                ],
                waitFor: 'threat protection section',
                description: 'Reports > Monthly Security Report > Protection Against Specific Threats',
                requiresScroll: true,
                scrollAmount: 900
            },
            {
                name: 'Security Portal - Monthly Security Report (Suspicious Activities)',
                url: 'https://security.microsoft.com',
                section: 'monthly_security_suspicious_activities',
                navigationSteps: [
                    'Should already be on Monthly Security Report',
                    'Scroll down to "Tracked severe suspicious or malicious activities" section',
                    'Wait 3 seconds',
                    'Take screenshot of suspicious activities tracking'
                ],
                waitFor: 'suspicious activities section',
                description: 'Reports > Monthly Security Report > Tracked Suspicious/Malicious Activities',
                requiresScroll: true,
                scrollAmount: 1100
            }
        ];
        
        // Return batch instructions with comprehensive navigation and scroll handling
        return {
            success: false,
            requiresManualCompletion: true,
            batchOperation: true,
            instructions: {
                action: 'captureAllScreenshots',
                totalPortals: portals.length,
                outputDirectory: outputPath,
                portals: portals.map((portal, index) => {
                    const filename = `${portal.section}_${Date.now() + index}.jpg`;
                    const filePath = path.join(outputPath, filename);
                    
                    return {
                        index: index + 1,
                        name: portal.name,
                        section: portal.section,
                        url: portal.url,
                        navigationSteps: portal.navigationSteps,
                        waitFor: portal.waitFor,
                        description: portal.description,
                        requiresScroll: portal.requiresScroll || false,
                        scrollAmount: portal.scrollAmount || 0,
                        extractText: portal.extractText || false,
                        textExtractionNote: portal.textExtractionNote || '',
                        aiInstructions: portal.aiInstructions || '',
                        filename: filename,
                        path: filePath,
                        mcpCommands: portal.requiresScroll ? {
                            navigate: {
                                tool: 'mcp_playwright_browser_navigate',
                                params: { url: portal.url }
                            },
                            wait: {
                                tool: 'mcp_playwright_browser_wait_for',
                                params: { time: 5 }
                            },
                            scroll: {
                                tool: 'mcp_playwright_browser_evaluate',
                                params: {
                                    function: `() => { window.scrollBy(0, ${portal.scrollAmount}); }`
                                }
                            },
                            waitAfterScroll: {
                                tool: 'mcp_playwright_browser_wait_for',
                                params: { time: 3 }
                            },
                            screenshot: {
                                tool: 'mcp_playwright_browser_take_screenshot',
                                params: {
                                    filename: filePath,
                                    type: 'jpeg',
                                    fullPage: false
                                }
                            }
                        } : {
                            navigate: {
                                tool: 'mcp_playwright_browser_navigate',
                                params: { url: portal.url }
                            },
                            wait: {
                                tool: 'mcp_playwright_browser_wait_for',
                                params: { time: 5 }
                            },
                            screenshot: {
                                tool: 'mcp_playwright_browser_take_screenshot',
                                params: {
                                    filename: filePath,
                                    type: 'jpeg',
                                    fullPage: portal.extractText ? false : true
                                }
                            }
                        }
                    };
                }),
                workflow: [
                    '🔐 AUTHENTICATION (if not already authenticated):',
                    '  - User must sign in to customer Microsoft 365 tenant',
                    '  - Complete MFA if required',
                    '  - Ensure all required permissions are granted',
                    '',
                    '📸 SCREENSHOT CAPTURE WORKFLOW:',
                    '',
                    'For each portal section:',
                    '  1. Follow the specific navigationSteps array for that portal',
                    '  2. If requiresScroll is true:',
                    '     a. Wait for initial page load (5 seconds)',
                    '     b. Execute scroll using scrollAmount pixels',
                    '     c. Wait 3 seconds for content to render after scroll',
                    '  3. If extractText is true (Monthly Summary):',
                    '     a. Use mcp_playwright_browser_snapshot to get page content',
                    '     b. Extract text from Summary section',
                    '     c. Store text separately for direct inclusion in report',
                    '  4. Take screenshot using specified parameters',
                    '  5. Verify screenshot file was created',
                    '  6. Report progress to user',
                    '',
                    '⚠️ IMPORTANT NOTES:',
                    '  - Some sections require staying on same page and scrolling',
                    '  - Wait times are critical for content to load properly',
                    '  - Scroll amounts are calibrated per section',
                    '  - Top 10 Vulnerabilities: AI must focus on first 10 items only',
                    '  - Monthly Summary: Extract text, do not just screenshot',
                    '',
                    '✅ COMPLETION:',
                    '  - After all portals captured, call setAllScreenshotsComplete()',
                    '  - Pass array of all screenshot paths',
                    '  - Include extracted text data for Monthly Summary',
                    '',
                    '🎯 TOTAL SCREENSHOTS: ' + portals.length,
                    '  - Entra Licenses: 1 screenshot',
                    '  - Vulnerability Management: 5 screenshots (Dashboard: 4, Recommendations: 1)',
                    '  - Security Reports (General): 5 screenshots',
                    '  - Device Health: 3 screenshots',
                    '  - Monthly Security Report: 6 screenshots (1 text extraction + 5 screenshots)'
                ]
            },
            outputPath,
            totalSections: portals.length,
            sectionsBreakdown: {
                entraLicenses: 1,
                vulnerabilityManagement: 5,
                securityReportsGeneral: 5,
                deviceHealth: 3,
                monthlySecurity: 6
            }
        };
    }

    /**
     * Mark all screenshots as complete (called externally)
     * @param {Array<string>} screenshotPaths - Array of screenshot paths
     * @param {Object} extractedTextData - Optional extracted text data (e.g., Monthly Summary)
     */
    setAllScreenshotsComplete(screenshotPaths, extractedTextData = null) {
        console.log(`✅ All screenshots captured: ${screenshotPaths.length} files`);
        
        if (extractedTextData) {
            console.log(`📄 Text data extracted from: ${Object.keys(extractedTextData).join(', ')}`);
        }
        
        return {
            success: true,
            screenshots: screenshotPaths,
            count: screenshotPaths.length,
            extractedText: extractedTextData,
            metadata: {
                captureDate: new Date().toISOString(),
                sectionsIncluded: [
                    'Entra Licenses',
                    'Vulnerability Management (Dashboard + Top 10 Recommendations)',
                    'Security Reports (General)',
                    'Device Health',
                    'Monthly Security Report'
                ]
            }
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
     * Extract text content from Monthly Summary section
     * This method provides instructions for extracting text via MCP snapshot
     * @returns {Object} Instructions for text extraction
     */
    extractMonthlySummaryText() {
        return {
            success: false,
            requiresManualCompletion: true,
            instructions: {
                action: 'extractText',
                section: 'monthly_security_summary',
                steps: [
                    'Navigate to https://security.microsoft.com',
                    'Go to Reports > Monthly Security Report',
                    'Wait for Summary section to load',
                    'Use mcp_playwright_browser_snapshot to capture page content',
                    'Extract text from Summary section heading and content',
                    'Return extracted text for direct inclusion in report'
                ],
                mcpCommands: {
                    navigate: {
                        tool: 'mcp_playwright_browser_navigate',
                        params: { url: 'https://security.microsoft.com' }
                    },
                    wait: {
                        tool: 'mcp_playwright_browser_wait_for',
                        params: { time: 5 }
                    },
                    snapshot: {
                        tool: 'mcp_playwright_browser_snapshot',
                        params: {}
                    }
                },
                textSelectors: [
                    'Look for Summary heading or section',
                    'Extract paragraph text under Summary',
                    'Capture key metrics and statements',
                    'Format as clean text for report inclusion'
                ]
            }
        };
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
