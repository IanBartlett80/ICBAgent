// Microsoft Graph API Service for Zero Trust Assessment
// File: public/js/zero-trust-graph-service.js

class ZeroTrustGraphService {
    constructor() {
        this.sessionId = null;
        this.requiredScopes = [
            'DeviceManagementConfiguration.Read.All',
            'DeviceManagementManagedDevices.Read.All',
            'DeviceManagementApps.Read.All',
            'Policy.Read.All',
            'Directory.Read.All',
            'User.Read.All',
            'Group.Read.All'
        ];
        
        // Map data types to specific required permissions
        this.dataTypePermissions = {
            'users': ['User.Read.All', 'Directory.Read.All'],
            'devices': ['DeviceManagementManagedDevices.Read.All'],
            'compliancePolicies': ['DeviceManagementConfiguration.Read.All'],
            'configurationPolicies': ['DeviceManagementConfiguration.Read.All'],
            'servicePrincipals': ['Application.Read.All', 'Directory.Read.All'],
            'conditionalAccess': ['Policy.Read.All', 'Policy.ReadWrite.ConditionalAccess', 'Directory.Read.All'],
            'applications': ['Application.Read.All', 'Directory.Read.All'],
            'groups': ['Group.Read.All', 'Directory.Read.All'],
            'directoryRoles': ['RoleManagement.Read.Directory', 'Directory.Read.All'],
            'domains': ['Domain.Read.All', 'Directory.Read.All'],
            'organization': ['Organization.Read.All']
        };
        
        console.log('🔧 ZeroTrustGraphService constructor completed');
    }

    /**
     * Get required permissions for a specific data type
     * @param {string} dataType - The data type to get permissions for
     * @returns {Array<string>} Array of required permission scopes
     */
    getRequiredPermissions(dataType) {
        return this.dataTypePermissions[dataType] || ['Directory.Read.All'];
    }

    /**
     * Initialize the service with session ID
     * @param {string} sessionId - ICB Agent session ID
     */
    initialize(sessionId) {
        this.sessionId = sessionId;
        console.log('ZeroTrustGraphService initialized with session ID:', sessionId);
    }

    /**
     * Make authenticated request via ICB Agent API
     * @param {string} dataType - Type of data to collect
     * @param {Object} options - Request options
     * @returns {Promise<Object>} API response data
     */
    async makeGraphRequest(dataType, options = {}) {
        if (!this.sessionId) {
            throw new Error('Graph service not initialized. Session ID required.');
        }

        try {
            console.log(`Making Graph API request via ICB Agent: ${dataType}`);
            
            const response = await fetch('/api/zero-trust-assessment/collect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    dataType: dataType,
                    options: options
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.log('🔍 API Error Response Details:', {
                    status: response.status,
                    errorData: errorData,
                    dataType: dataType
                });
                
                // Handle permission errors specifically
                if (response.status === 403 && errorData.requiresPermissions) {
                    console.log('🔒 Creating permission error with scopes:', errorData.requiredScopes);
                    const permissionError = new Error(errorData.error || `Insufficient permissions for ${dataType}`);
                    permissionError.isPermissionError = true;
                    permissionError.dataType = dataType;
                    permissionError.requiresPermissions = true;
                    permissionError.requiredScopes = errorData.requiredScopes || this.getRequiredPermissions(dataType);
                    permissionError.rawError = errorData.rawError;
                    throw permissionError;
                }
                
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            const result = await response.json();
            console.log(`Graph API request completed for ${dataType}:`, {
                success: result.success,
                dataCount: result.data?.value?.length || 'N/A'
            });

            return result.data;

        } catch (error) {
            console.error(`Graph API request failed for ${dataType}:`, error);
            throw error;
        }
    }

    // ==================== DEVICE MANAGEMENT METHODS ====================

    /**
     * Get all managed devices from Microsoft Intune
     * @returns {Promise<Array>} Array of managed device objects
     */
    async getManagedDevices() {
        try {
            const data = await this.makeGraphRequest('devices', { limit: 100 });
            return data.value || [];
        } catch (error) {
            console.error('Error fetching managed devices:', error);
            throw error;
        }
    }

    /**
     * Get device compliance policies
     * @returns {Promise<Array>} Array of compliance policy objects
     */
    async getDeviceCompliancePolicies() {
        try {
            const data = await this.makeGraphRequest('compliancePolicies');
            return data.value || [];
        } catch (error) {
            console.error('Error fetching device compliance policies:', error);
            throw error;
        }
    }

    /**
     * Get device configuration policies
     * @returns {Promise<Array>} Array of configuration policy objects
     */
    async getDeviceConfigurationPolicies() {
        try {
            const data = await this.makeGraphRequest('configurationPolicies');
            return data.value || [];
        } catch (error) {
            console.error('Error fetching device configuration policies:', error);
            throw error;
        }
    }

    // ==================== IDENTITY & ACCESS METHODS ====================

    /**
     * Get all users in the organization
     * @returns {Promise<Array>} Array of user objects
     */
    async getUsers() {
        try {
            const data = await this.makeGraphRequest('users', { limit: 100 });
            return data.value || [];
        } catch (error) {
            console.error('Error fetching users:', error);
            throw error;
        }
    }

    /**
     * Get conditional access policies
     * @returns {Promise<Array>} Array of conditional access policy objects
     */
    async getConditionalAccessPolicies() {
        try {
            const data = await this.makeGraphRequest('conditionalAccess');
            return data.value || [];
        } catch (error) {
            console.error('Error fetching conditional access policies:', error);
            throw error;
        }
    }

    /**
     * Get all groups in the organization
     * @returns {Promise<Array>} Array of group objects
     */
    async getGroups() {
        try {
            const data = await this.makeGraphRequest('groups', { limit: 100 });
            return data.value || [];
        } catch (error) {
            console.error('Error fetching groups:', error);
            throw error;
        }
    }

    /**
     * Get directory roles
     * @returns {Promise<Array>} Array of directory role objects
     */
    async getDirectoryRoles() {
        try {
            const data = await this.makeGraphRequest('directoryRoles');
            return data.value || [];
        } catch (error) {
            console.error('Error fetching directory roles:', error);
            throw error;
        }
    }

    // ==================== APPLICATION METHODS ====================

    /**
     * Get all applications registered in Azure AD
     * @returns {Promise<Array>} Array of application objects
     */
    async getApplications() {
        try {
            const data = await this.makeGraphRequest('applications');
            return data.value || [];
        } catch (error) {
            console.error('Error fetching applications:', error);
            throw error;
        }
    }

    /**
     * Get service principals
     * @returns {Promise<Array>} Array of service principal objects
     */
    async getServicePrincipals() {
        try {
            const data = await this.makeGraphRequest('servicePrincipals');
            return data.value || [];
        } catch (error) {
            console.error('Error fetching service principals:', error);
            throw error;
        }
    }

    // ==================== INFRASTRUCTURE METHODS ====================

    /**
     * Get organization information
     * @returns {Promise<Object>} Organization details
     */
    async getOrganization() {
        try {
            const data = await this.makeGraphRequest('organization');
            return data.value?.[0] || {};
        } catch (error) {
            console.error('Error fetching organization info:', error);
            throw error;
        }
    }

    /**
     * Get verified domains
     * @returns {Promise<Array>} Array of domain objects
     */
    async getDomains() {
        try {
            const data = await this.makeGraphRequest('domains');
            return data.value || [];
        } catch (error) {
            console.error('Error fetching domains:', error);
            throw error;
        }
    }

    // ==================== COMBINED DATA COLLECTION METHODS ====================

    /**
     * Collect all identity-related data
     * @param {Function} progressCallback - Progress update callback
     * @returns {Promise<Object>} Combined identity data
     */
    async collectIdentityData(progressCallback) {
        const results = {};
        const tasks = [
            { name: 'users', method: () => this.getUsers() },
            { name: 'groups', method: () => this.getGroups() },
            { name: 'directoryRoles', method: () => this.getDirectoryRoles() },
            { name: 'conditionalAccessPolicies', method: () => this.getConditionalAccessPolicies() }
        ];

        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            try {
                if (progressCallback) {
                    progressCallback(`Collecting ${task.name}...`, (i / tasks.length) * 100);
                }
                results[task.name] = await task.method();
            } catch (error) {
                console.error(`Failed to collect ${task.name}:`, error);
                console.log('🔍 Task error details:', {
                    taskName: task.name,
                    isPermissionError: error.isPermissionError,
                    dataType: error.dataType,
                    message: error.message
                });
                
                // If this is a permission error, propagate it up instead of continuing
                if (error.isPermissionError) {
                    console.log(`🔒 Permission error in collectIdentityData for ${task.name}, propagating...`);
                    throw error;
                }
                
                // For other errors, set empty result and continue
                results[task.name] = [];
            }
        }

        return results;
    }

    /**
     * Collect all device-related data
     * @param {Function} progressCallback - Progress update callback
     * @returns {Promise<Object>} Combined device data
     */
    async collectDeviceData(progressCallback) {
        const results = {};
        const tasks = [
            { name: 'managedDevices', method: () => this.getManagedDevices() },
            { name: 'compliancePolicies', method: () => this.getDeviceCompliancePolicies() },
            { name: 'configurationPolicies', method: () => this.getDeviceConfigurationPolicies() }
        ];

        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            try {
                if (progressCallback) {
                    progressCallback(`Collecting ${task.name}...`, (i / tasks.length) * 100);
                }
                results[task.name] = await task.method();
            } catch (error) {
                console.error(`Failed to collect ${task.name}:`, error);
                
                // If this is a permission error, propagate it up instead of continuing
                if (error.isPermissionError) {
                    console.log(`🔒 Permission error in collectDeviceData for ${task.name}, propagating...`);
                    throw error;
                }
                
                // For other errors, set empty result and continue
                results[task.name] = [];
            }
        }

        return results;
    }

    /**
     * Collect all application-related data
     * @param {Function} progressCallback - Progress update callback
     * @returns {Promise<Object>} Combined application data
     */
    async collectApplicationData(progressCallback) {
        const results = {};
        const tasks = [
            { name: 'applications', method: () => this.getApplications() },
            { name: 'servicePrincipals', method: () => this.getServicePrincipals() }
        ];

        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            try {
                if (progressCallback) {
                    progressCallback(`Collecting ${task.name}...`, (i / tasks.length) * 100);
                }
                results[task.name] = await task.method();
            } catch (error) {
                console.error(`Failed to collect ${task.name}:`, error);
                
                // If this is a permission error, propagate it up instead of continuing
                if (error.isPermissionError) {
                    console.log(`🔒 Permission error in collectApplicationData for ${task.name}, propagating...`);
                    throw error;
                }
                
                // For other errors, set empty result and continue
                results[task.name] = [];
            }
        }

        return results;
    }

    /**
     * Collect all infrastructure-related data
     * @param {Function} progressCallback - Progress update callback
     * @returns {Promise<Object>} Combined infrastructure data
     */
    async collectInfrastructureData(progressCallback) {
        const results = {};
        const tasks = [
            { name: 'organization', method: () => this.getOrganization() },
            { name: 'domains', method: () => this.getDomains() }
        ];

        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            try {
                if (progressCallback) {
                    progressCallback(`Collecting ${task.name}...`, (i / tasks.length) * 100);
                }
                results[task.name] = await task.method();
            } catch (error) {
                console.error(`Failed to collect ${task.name}:`, error);
                
                // If this is a permission error, propagate it up instead of continuing
                if (error.isPermissionError) {
                    console.log(`🔒 Permission error in collectInfrastructureData for ${task.name}, propagating...`);
                    throw error;
                }
                
                // For other errors, set empty result and continue
                results[task.name] = [];
            }
        }

        return results;
    }

    /**
     * Collect all data for Zero Trust Assessment
     * @param {Function} progressCallback - Overall progress callback
     * @returns {Promise<Object>} Complete dataset for assessment
     */
    async collectAllAssessmentData(progressCallback) {
        const startTime = new Date();
        const results = {};
        
        try {
            if (progressCallback) progressCallback('Starting data collection...', 0);

            // Identity data (35% weight)
            if (progressCallback) progressCallback('Collecting identity data...', 10);
            results.identity = await this.collectIdentityData((msg, progress) => {
                if (progressCallback) progressCallback(`Identity: ${msg}`, 10 + (progress * 0.25));
            });

            // Device data (30% weight)
            if (progressCallback) progressCallback('Collecting device data...', 35);
            results.devices = await this.collectDeviceData((msg, progress) => {
                if (progressCallback) progressCallback(`Devices: ${msg}`, 35 + (progress * 0.25));
            });

            // Application data (20% weight)
            if (progressCallback) progressCallback('Collecting application data...', 60);
            results.applications = await this.collectApplicationData((msg, progress) => {
                if (progressCallback) progressCallback(`Applications: ${msg}`, 60 + (progress * 0.20));
            });

            // Infrastructure data (15% weight)
            if (progressCallback) progressCallback('Collecting infrastructure data...', 80);
            results.infrastructure = await this.collectInfrastructureData((msg, progress) => {
                if (progressCallback) progressCallback(`Infrastructure: ${msg}`, 80 + (progress * 0.15));
            });

            if (progressCallback) progressCallback('Data collection completed!', 100);

            // Add metadata for assessment engine
            const endTime = new Date();
            results.metadata = {
                collectionStartTime: startTime.toISOString(),
                collectionEndTime: endTime.toISOString(),
                dataPoints: this.calculateDataPoints(results),
                sessionId: this.sessionId
            };

            return results;

        } catch (error) {
            console.error('Error during complete data collection:', error);
            throw error;
        }
    }

    /**
     * Calculate total data points collected
     * @param {Object} results - Collection results
     * @returns {number} Total data points
     */
    calculateDataPoints(results) {
        let total = 0;
        
        if (results.identity) {
            total += (results.identity.users?.length || 0);
            total += (results.identity.groups?.length || 0);
            total += (results.identity.directoryRoles?.length || 0);
            total += (results.identity.conditionalAccessPolicies?.length || 0);
        }
        
        if (results.devices) {
            total += (results.devices.managedDevices?.length || 0);
            total += (results.devices.compliancePolicies?.length || 0);
            total += (results.devices.configurationPolicies?.length || 0);
        }
        
        if (results.applications) {
            total += (results.applications.applications?.length || 0);
            total += (results.applications.servicePrincipals?.length || 0);
        }
        
        if (results.infrastructure) {
            total += (results.infrastructure.organization?.length || 0);
            total += (results.infrastructure.domains?.length || 0);
        }
        
        return total;
    }
}

// Export for use in other modules
console.log('🔧 Exporting ZeroTrustGraphService to window object');
window.ZeroTrustGraphService = ZeroTrustGraphService;
