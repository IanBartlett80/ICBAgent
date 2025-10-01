/**
 * SharePoint Upload Service
 * Handles file upload to ICB Solutions SharePoint
 * 
 * Purpose:
 * - Upload generated health reports to SharePoint
 * - Organize reports by customer in folder structure
 * - Use Microsoft Graph API for file operations
 * 
 * Folder Structure:
 * Documents/
 *   └── Monthly Health Reports/
 *       └── {CustomerName}/
 *           └── {CustomerName}_Health_Report_{Month_Year}.docx
 */

const { Client } = require('@microsoft/microsoft-graph-client');
const fs = require('fs');
const path = require('path');

class SharePointUploadService {
    constructor() {
        // SharePoint configuration from environment
        this.siteId = process.env.SHAREPOINT_SITE_ID || 'icbsolutionsptyltd.sharepoint.com';
        this.siteName = process.env.SHAREPOINT_SITE_NAME || 'allcompany';
        this.library = process.env.SHAREPOINT_LIBRARY || 'Documents';
        this.basePath = process.env.SHAREPOINT_BASE_PATH || 'Monthly Health Reports';
        
        this.graphClient = null;
    }

    /**
     * Initialize Microsoft Graph Client with ICB staff access token
     * @param {string} accessToken - ICB Solutions staff member's access token
     */
    initializeGraphClient(accessToken) {
        this.graphClient = Client.init({
            authProvider: (done) => {
                done(null, accessToken);
            }
        });
    }

    /**
     * Main upload method - orchestrates the entire upload process
     * @param {Object} options - Upload options
     * @param {string} options.filePath - Local path to the Word document
     * @param {string} options.tenantDomain - Customer's tenant domain
     * @param {string} options.accessToken - ICB staff access token
     * @returns {Promise<Object>} Upload result with SharePoint URL
     */
    async uploadReport(options) {
        const { filePath, tenantDomain, accessToken } = options;

        try {
            console.log('📤 Starting SharePoint upload process...');
            console.log('   File:', filePath);
            console.log('   Tenant:', tenantDomain);

            // Initialize Graph Client
            this.initializeGraphClient(accessToken);

            // Extract and sanitize customer name
            const customerName = this.extractCustomerName(tenantDomain);
            const sanitizedName = this.sanitizeFolderName(customerName);
            
            console.log('   Customer Name:', customerName);
            console.log('   Sanitized:', sanitizedName);

            // Ensure folder structure exists
            await this.ensureFolderExists(sanitizedName);

            // Read file content
            const fileContent = fs.readFileSync(filePath);
            const fileName = path.basename(filePath);

            // Upload to SharePoint
            const uploadResult = await this.uploadFile(
                sanitizedName,
                fileName,
                fileContent
            );

            console.log('✅ SharePoint upload successful!');
            console.log('   URL:', uploadResult.webUrl);

            return {
                success: true,
                webUrl: uploadResult.webUrl,
                driveItemId: uploadResult.id,
                customerFolder: sanitizedName,
                fileName: fileName
            };

        } catch (error) {
            console.error('❌ SharePoint upload failed:', error.message);
            throw new Error(`SharePoint upload failed: ${error.message}`);
        }
    }

    /**
     * Ensure folder structure exists in SharePoint
     * Creates: Documents/Monthly Health Reports/{CustomerName}/
     * @param {string} customerName - Sanitized customer name
     */
    async ensureFolderExists(customerName) {
        try {
            console.log('📁 Ensuring folder structure exists...');

            // Get the site
            const site = await this.getSite();
            const driveId = site.driveId;

            // Build folder path: Monthly Health Reports/{CustomerName}
            const folderPath = `${this.basePath}/${customerName}`;
            
            console.log('   Checking folder:', folderPath);

            // Try to get the folder
            try {
                const folder = await this.graphClient
                    .api(`/drives/${driveId}/root:/${folderPath}`)
                    .get();
                
                console.log('   ✓ Folder already exists');
                return folder;
            } catch (error) {
                if (error.statusCode === 404) {
                    // Folder doesn't exist, create it
                    console.log('   Creating folder structure...');
                    return await this.createFolderStructure(driveId, customerName);
                } else {
                    throw error;
                }
            }

        } catch (error) {
            console.error('❌ Error ensuring folder exists:', error.message);
            throw error;
        }
    }

    /**
     * Create folder structure step by step
     * @param {string} driveId - SharePoint drive ID
     * @param {string} customerName - Sanitized customer name
     */
    async createFolderStructure(driveId, customerName) {
        try {
            // Step 1: Ensure base path exists (Monthly Health Reports)
            let baseFolderId;
            try {
                const baseFolder = await this.graphClient
                    .api(`/drives/${driveId}/root:/${this.basePath}`)
                    .get();
                baseFolderId = baseFolder.id;
                console.log('   ✓ Base folder exists:', this.basePath);
            } catch (error) {
                if (error.statusCode === 404) {
                    console.log('   Creating base folder:', this.basePath);
                    const newBaseFolder = await this.graphClient
                        .api(`/drives/${driveId}/root/children`)
                        .post({
                            name: this.basePath,
                            folder: {},
                            '@microsoft.graph.conflictBehavior': 'rename'
                        });
                    baseFolderId = newBaseFolder.id;
                } else {
                    throw error;
                }
            }

            // Step 2: Create customer folder inside base path
            console.log('   Creating customer folder:', customerName);
            const customerFolder = await this.graphClient
                .api(`/drives/${driveId}/items/${baseFolderId}/children`)
                .post({
                    name: customerName,
                    folder: {},
                    '@microsoft.graph.conflictBehavior': 'rename'
                });

            console.log('   ✓ Folder structure created successfully');
            return customerFolder;

        } catch (error) {
            console.error('❌ Error creating folder structure:', error.message);
            throw error;
        }
    }

    /**
     * Upload file to SharePoint folder
     * @param {string} customerName - Sanitized customer name
     * @param {string} fileName - Name of the file
     * @param {Buffer} fileContent - File content as Buffer
     */
    async uploadFile(customerName, fileName, fileContent) {
        try {
            console.log('📤 Uploading file to SharePoint...');

            const site = await this.getSite();
            const driveId = site.driveId;

            // Build upload path
            const uploadPath = `${this.basePath}/${customerName}/${fileName}`;
            
            console.log('   Upload path:', uploadPath);
            console.log('   File size:', fileContent.length, 'bytes');

            // Upload file using PUT (suitable for files < 4MB)
            // For larger files, we would need to use createUploadSession
            const uploadResult = await this.graphClient
                .api(`/drives/${driveId}/root:/${uploadPath}:/content`)
                .put(fileContent);

            console.log('   ✓ File uploaded successfully');
            console.log('   Drive Item ID:', uploadResult.id);

            return uploadResult;

        } catch (error) {
            console.error('❌ Error uploading file:', error.message);
            throw error;
        }
    }

    /**
     * Get SharePoint site information
     * @returns {Promise<Object>} Site object with driveId
     */
    async getSite() {
        try {
            // Get site by hostname and site name
            // Format: /sites/{hostname}:/sites/{sitename}
            const sitePath = `/sites/${this.siteId}:/sites/${this.siteName}`;
            
            const site = await this.graphClient
                .api(sitePath)
                .get();

            // Get the default document library drive
            const drive = await this.graphClient
                .api(`/sites/${site.id}/drive`)
                .get();

            return {
                siteId: site.id,
                driveId: drive.id,
                webUrl: site.webUrl
            };

        } catch (error) {
            console.error('❌ Error getting SharePoint site:', error.message);
            throw error;
        }
    }

    /**
     * Extract customer name from tenant domain
     * Examples:
     *   - contoso.onmicrosoft.com -> Contoso
     *   - fabrikam.onmicrosoft.com -> Fabrikam
     *   - woodgrove-bank.onmicrosoft.com -> Woodgrove Bank
     * @param {string} tenantDomain - Full tenant domain
     * @returns {string} Customer name
     */
    extractCustomerName(tenantDomain) {
        if (!tenantDomain) {
            return 'Unknown Customer';
        }

        try {
            // Remove .onmicrosoft.com or other domain extensions
            let name = tenantDomain
                .replace(/\.onmicrosoft\.com$/i, '')
                .replace(/\.com$/i, '')
                .replace(/\.net$/i, '')
                .replace(/\.org$/i, '');

            // Replace hyphens and underscores with spaces
            name = name.replace(/[-_]/g, ' ');

            // Capitalize each word
            name = name
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');

            return name;

        } catch (error) {
            console.error('Error extracting customer name:', error);
            return 'Unknown Customer';
        }
    }

    /**
     * Sanitize folder name for SharePoint
     * Removes invalid characters and formats properly
     * @param {string} name - Customer name
     * @returns {string} Sanitized folder name
     */
    sanitizeFolderName(name) {
        if (!name) {
            return 'Unknown_Customer';
        }

        // Remove invalid SharePoint folder characters: " * : < > ? / \ |
        let sanitized = name.replace(/["*:<>?/\\|]/g, '');

        // Replace spaces with underscores
        sanitized = sanitized.replace(/\s+/g, '_');

        // Remove leading/trailing underscores
        sanitized = sanitized.replace(/^_+|_+$/g, '');

        // Limit length to 255 characters (SharePoint limit)
        if (sanitized.length > 255) {
            sanitized = sanitized.substring(0, 255);
        }

        // Ensure not empty
        if (sanitized.length === 0) {
            sanitized = 'Unknown_Customer';
        }

        return sanitized;
    }

    /**
     * Test SharePoint connectivity
     * Used for validating configuration
     * @param {string} accessToken - ICB staff access token
     * @returns {Promise<Object>} Test result
     */
    async testConnection(accessToken) {
        try {
            console.log('🔍 Testing SharePoint connection...');
            
            this.initializeGraphClient(accessToken);
            const site = await this.getSite();

            console.log('✅ SharePoint connection successful!');
            console.log('   Site ID:', site.siteId);
            console.log('   Drive ID:', site.driveId);
            console.log('   Web URL:', site.webUrl);

            return {
                success: true,
                site: site
            };

        } catch (error) {
            console.error('❌ SharePoint connection test failed:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = SharePointUploadService;
