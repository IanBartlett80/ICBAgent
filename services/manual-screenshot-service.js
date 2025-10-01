/**
 * Manual Screenshot Service - Simple File Watcher Approach
 * User takes screenshots with Windows Snipping Tool (Win+Shift+S)
 * and saves them to a monitored folder
 * 
 * @author ICB Solutions
 * @date October 2025
 */

const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

class ManualScreenshotService {
    constructor() {
        this.watchFolder = path.join(process.env.USERPROFILE || 'C:\\Users\\Administrator', 'Documents', 'ICB_Screenshots');
        this.capturedScreenshots = [];
        this.currentSectionIndex = 0;
        this.sections = this.getSectionDefinitions();
    }

    /**
     * Initialize the screenshot capture process
     */
    async initialize() {
        console.log('📸 Initializing manual screenshot capture...');
        
        // Create watch folder if it doesn't exist
        try {
            await fs.mkdir(this.watchFolder, { recursive: true });
            console.log(`✅ Screenshot folder ready: ${this.watchFolder}`);
        } catch (error) {
            console.error('❌ Error creating screenshot folder:', error);
            throw error;
        }

        // Clear any existing screenshots from previous sessions
        await this.clearWatchFolder();
    }

    /**
     * Clear the watch folder
     */
    async clearWatchFolder() {
        try {
            const files = await fs.readdir(this.watchFolder);
            for (const file of files) {
                if (file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.png')) {
                    await fs.unlink(path.join(this.watchFolder, file));
                }
            }
            console.log('✅ Watch folder cleared');
        } catch (error) {
            console.warn('⚠️ Error clearing watch folder:', error.message);
        }
    }

    /**
     * Start capturing screenshots for all sections
     * @param {string} outputPath - Destination folder for screenshots
     * @param {Function} progressCallback - Progress update callback
     * @returns {Promise<Array>} Array of screenshot results
     */
    async captureAllScreenshots(outputPath, progressCallback) {
        console.log('\n📸 ========================================');
        console.log('   MANUAL SCREENSHOT CAPTURE MODE');
        console.log('   ========================================');
        console.log(`\n📁 Watch Folder: ${this.watchFolder}`);
        console.log('🖼️  Instructions:');
        console.log('   1. Use Windows Snipping Tool (Win+Shift+S)');
        console.log('   2. Capture the required section');
        console.log('   3. Save to the watch folder above');
        console.log('   4. Name it: section_1.png, section_2.png, etc.');
        console.log('   5. System will automatically detect and process');
        console.log('\n⏳ Waiting for screenshots...\n');

        await fs.mkdir(outputPath, { recursive: true });

        this.capturedScreenshots = [];
        this.currentSectionIndex = 0;

        // Show instructions for each section
        for (let i = 0; i < this.sections.length; i++) {
            const section = this.sections[i];
            const sectionNumber = i + 1;

            if (progressCallback) {
                progressCallback({
                    step: 'screenshots',
                    progress: Math.round(20 + (40 * i / this.sections.length)),
                    message: `Waiting for Section ${sectionNumber}/20: ${section.displayName}`,
                    details: `Navigate to: ${section.instructions}`
                });
            }

            console.log(`\n📸 Section ${sectionNumber}/20: ${section.displayName}`);
            console.log(`   Portal: ${section.portal}`);
            console.log(`   Instructions: ${section.instructions}`);
            console.log(`   📝 Save as: section_${sectionNumber}.png or section_${sectionNumber}.jpg`);
            console.log(`   📁 Location: ${this.watchFolder}`);
            console.log(`   ⏳ Waiting for screenshot...`);

            // Wait for user to save screenshot
            const screenshot = await this.waitForScreenshot(sectionNumber, section, outputPath);
            
            if (screenshot.success) {
                this.capturedScreenshots.push(screenshot);
                console.log(`   ✅ Captured: ${screenshot.filename}`);
            } else {
                this.capturedScreenshots.push({
                    success: false,
                    section: section.name,
                    displayName: section.displayName,
                    error: 'Screenshot not provided'
                });
                console.log(`   ⏭️  Skipped: ${section.displayName}`);
            }
        }

        console.log(`\n✅ Screenshot capture complete: ${this.capturedScreenshots.filter(s => s.success).length}/20 sections captured\n`);
        
        return this.capturedScreenshots;
    }

    /**
     * Wait for user to save a screenshot
     * @param {number} sectionNumber - Section number (1-20)
     * @param {Object} section - Section definition
     * @param {string} outputPath - Destination folder
     * @returns {Promise<Object>} Screenshot result
     */
    async waitForScreenshot(sectionNumber, section, outputPath) {
        return new Promise((resolve) => {
            const expectedFilenames = [
                `section_${sectionNumber}.png`,
                `section_${sectionNumber}.jpg`,
                `section_${sectionNumber}.jpeg`,
                `Section_${sectionNumber}.png`,
                `Section_${sectionNumber}.jpg`,
                `Section_${sectionNumber}.jpeg`,
                `${sectionNumber}.png`,
                `${sectionNumber}.jpg`,
                `${sectionNumber}.jpeg`
            ];

            let checkInterval;
            let skipTimeout;

            // Check every 2 seconds for new file
            const checkForFile = async () => {
                try {
                    const files = await fs.readdir(this.watchFolder);
                    
                    // Look for matching filename
                    for (const filename of expectedFilenames) {
                        if (files.includes(filename)) {
                            const sourceFile = path.join(this.watchFolder, filename);
                            const timestamp = Date.now();
                            const destFilename = `${section.name}_${timestamp}.jpg`;
                            const destFile = path.join(outputPath, destFilename);

                            // Copy file to output folder
                            await fs.copyFile(sourceFile, destFile);
                            
                            // Delete from watch folder
                            await fs.unlink(sourceFile);

                            // Get file size
                            const stats = await fs.stat(destFile);

                            clearInterval(checkInterval);
                            clearTimeout(skipTimeout);

                            resolve({
                                success: true,
                                path: destFile,
                                section: section.name,
                                displayName: section.displayName,
                                filename: destFilename,
                                size: stats.size
                            });
                            return;
                        }
                    }
                } catch (error) {
                    console.warn('   ⚠️ Error checking for screenshot:', error.message);
                }
            };

            // Start checking
            checkInterval = setInterval(checkForFile, 2000);

            // Auto-skip after 5 minutes if no screenshot
            skipTimeout = setTimeout(() => {
                clearInterval(checkInterval);
                console.log('   ⏱️  5 minute timeout - skipping section');
                resolve({
                    success: false,
                    section: section.name,
                    displayName: section.displayName,
                    error: 'Timeout waiting for screenshot'
                });
            }, 300000); // 5 minutes
        });
    }

    /**
     * Get definitions for all 20 sections
     * @returns {Array} Section definitions
     */
    getSectionDefinitions() {
        return [
            {
                name: 'entra_licenses',
                displayName: 'Entra Licenses Overview',
                portal: 'Entra Admin Center',
                instructions: 'Entra Admin Center → Billing → Licenses → All Products'
            },
            {
                name: 'vulnerability_dashboard',
                displayName: 'Vulnerability Management Dashboard',
                portal: 'Microsoft Defender',
                instructions: 'Defender → Vulnerability Management → Dashboard'
            },
            {
                name: 'vulnerability_top10',
                displayName: 'Top 10 Vulnerabilities',
                portal: 'Microsoft Defender',
                instructions: 'Defender → Vulnerability Management → Recommendations'
            },
            {
                name: 'vulnerability_weaknesses',
                displayName: 'Security Weaknesses',
                portal: 'Microsoft Defender',
                instructions: 'Defender → Vulnerability Management → Weaknesses'
            },
            {
                name: 'vulnerability_exposed_devices',
                displayName: 'Exposed Devices',
                portal: 'Microsoft Defender',
                instructions: 'Defender → Vulnerability Management → Exposed Devices'
            },
            {
                name: 'security_overview',
                displayName: 'Security Overview',
                portal: 'Microsoft Defender',
                instructions: 'Defender → Reports → Security Report'
            },
            {
                name: 'threat_analytics',
                displayName: 'Threat Analytics',
                portal: 'Microsoft Defender',
                instructions: 'Defender → Threat Analytics'
            },
            {
                name: 'incidents_alerts',
                displayName: 'Incidents & Alerts',
                portal: 'Microsoft Defender',
                instructions: 'Defender → Incidents & Alerts'
            },
            {
                name: 'email_security',
                displayName: 'Email & Collaboration Security',
                portal: 'Microsoft Defender',
                instructions: 'Defender → Email & Collaboration → Reports'
            },
            {
                name: 'secure_score',
                displayName: 'Microsoft Secure Score',
                portal: 'Microsoft Defender',
                instructions: 'Defender → Secure Score'
            },
            {
                name: 'device_overview',
                displayName: 'Device Overview',
                portal: 'Intune Admin Center',
                instructions: 'Intune → Devices → Overview'
            },
            {
                name: 'device_compliance',
                displayName: 'Device Compliance',
                portal: 'Intune Admin Center',
                instructions: 'Intune → Devices → Compliance'
            },
            {
                name: 'device_health',
                displayName: 'Device Health Status',
                portal: 'Intune Admin Center',
                instructions: 'Intune → Reports → Device Health'
            },
            {
                name: 'monthly_security_summary',
                displayName: 'Monthly Security Summary',
                portal: 'Microsoft Defender',
                instructions: 'Defender → Reports → Security Report → Monthly Security Report'
            },
            {
                name: 'monthly_identity_security',
                displayName: 'Identity Security Status',
                portal: 'Microsoft Defender',
                instructions: 'Monthly Security Report → Identity Security section'
            },
            {
                name: 'monthly_device_security',
                displayName: 'Device Security Status',
                portal: 'Microsoft Defender',
                instructions: 'Monthly Security Report → Device Security section'
            },
            {
                name: 'monthly_threat_protection',
                displayName: 'Threat Protection Overview',
                portal: 'Microsoft Defender',
                instructions: 'Monthly Security Report → Threat Protection section'
            },
            {
                name: 'monthly_vulnerabilities',
                displayName: 'Vulnerability Summary',
                portal: 'Microsoft Defender',
                instructions: 'Monthly Security Report → Vulnerability section'
            },
            {
                name: 'monthly_recommendations',
                displayName: 'Security Recommendations',
                portal: 'Microsoft Defender',
                instructions: 'Monthly Security Report → Recommendations section'
            },
            {
                name: 'conditional_access',
                displayName: 'Conditional Access Policies',
                portal: 'Entra Admin Center',
                instructions: 'Entra → Protection → Conditional Access'
            }
        ];
    }

    /**
     * Clean up resources
     */
    async cleanup() {
        console.log('🧹 Cleaning up manual screenshot service...');
        console.log('✅ Manual screenshot service cleanup complete');
    }
}

module.exports = ManualScreenshotService;
