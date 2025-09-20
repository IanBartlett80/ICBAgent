/**
 * Monthly Report Graph API Service
 * Collects comprehensive Microsoft 365 data for monthly reports
 */

class MonthlyReportGraphService {
    constructor(authService) {
        this.authService = authService;
        this.graphBaseUrl = 'https://graph.microsoft.com/v1.0';
        this.graphBetaUrl = 'https://graph.microsoft.com/beta';
        this.rateLimitDelay = 100; // Delay between requests to avoid throttling
        this.maxRetries = 3;
        this.collectedData = new Map();
        this.collectionStartTime = null;
        this.reportPeriod = null;
    }

    /**
     * Main method to collect all report data
     * @param {Object} options - Collection options including date range
     * @returns {Promise<Object>} Complete dataset for monthly report
     */
    async collectReportData(options = {}) {
        this.collectionStartTime = new Date();
        this.reportPeriod = this.calculateReportPeriod(options.reportPeriod);
        
        console.log(`📊 Starting comprehensive data collection for period: ${this.reportPeriod.start} to ${this.reportPeriod.end}`);
        
        try {
            // Define data collection tasks
            const collectionTasks = [
                { name: 'Identity & User Security', method: 'collectIdentityData', icon: '👥' },
                { name: 'Device Management', method: 'collectDeviceData', icon: '📱' },
                { name: 'Security Score & Threats', method: 'collectSecurityData', icon: '🛡️' },
                { name: 'Compliance & Policies', method: 'collectComplianceData', icon: '📋' },
                { name: 'Application Security', method: 'collectApplicationData', icon: '🔐' },
                { name: 'Data Protection', method: 'collectDataProtectionData', icon: '📊' }
            ];

            // Execute collection tasks with progress tracking
            for (let i = 0; i < collectionTasks.length; i++) {
                const task = collectionTasks[i];
                
                // Notify progress
                if (window.reportProgressCallback) {
                    window.reportProgressCallback({
                        current: i + 1,
                        total: collectionTasks.length,
                        task: task.name,
                        status: 'collecting'
                    });
                }

                try {
                    console.log(`🔄 Collecting: ${task.name}`);
                    const data = await this[task.method]();
                    this.collectedData.set(task.method, {
                        name: task.name,
                        icon: task.icon,
                        data: data,
                        collectedAt: new Date().toISOString(),
                        status: 'success'
                    });

                    // Notify task completion
                    if (window.reportProgressCallback) {
                        window.reportProgressCallback({
                            current: i + 1,
                            total: collectionTasks.length,
                            task: task.name,
                            status: 'completed'
                        });
                    }

                    console.log(`✅ Completed: ${task.name}`);
                    
                } catch (error) {
                    console.error(`❌ Failed to collect ${task.name}:`, error);
                    this.collectedData.set(task.method, {
                        name: task.name,
                        icon: task.icon,
                        data: null,
                        error: error.message,
                        collectedAt: new Date().toISOString(),
                        status: 'failed'
                    });

                    // Notify task failure but continue
                    if (window.reportProgressCallback) {
                        window.reportProgressCallback({
                            current: i + 1,
                            total: collectionTasks.length,
                            task: task.name,
                            status: 'failed',
                            error: error.message
                        });
                    }
                }

                // Rate limiting delay
                await this.delay(this.rateLimitDelay);
            }

            // Generate summary and analysis
            const reportData = this.generateReportData();
            
            console.log(`📈 Data collection completed in ${Date.now() - this.collectionStartTime.getTime()}ms`);
            return reportData;

        } catch (error) {
            console.error('❌ Critical error during data collection:', error);
            throw new Error(`Data collection failed: ${error.message}`);
        }
    }

    /**
     * Collect Identity and User Security data
     */
    async collectIdentityData() {
        const identityData = {};

        try {
            // User statistics
            identityData.users = await this.graphRequest('/users', {
                $count: true,
                $select: 'id,displayName,userPrincipalName,accountEnabled,createdDateTime,signInActivity,userType'
            });

            // Admin roles
            identityData.adminRoles = await this.graphRequest('/directoryRoles', {
                $expand: 'members'
            });

            // MFA status and authentication methods
            identityData.mfaStatus = await this.collectMFAStatus();

            // Sign-in logs (last 30 days)
            identityData.signInLogs = await this.graphRequest('/auditLogs/signIns', {
                $filter: `createdDateTime ge ${this.reportPeriod.start}`,
                $top: 1000,
                $orderby: 'createdDateTime desc'
            });

            // Risk events
            identityData.riskEvents = await this.graphRequest('/identityProtection/riskDetections', {
                $filter: `detectedDateTime ge ${this.reportPeriod.start}`,
                $orderby: 'detectedDateTime desc'
            });

            // Risky users
            identityData.riskyUsers = await this.graphRequest('/identityProtection/riskyUsers');

            // Conditional Access policies
            identityData.conditionalAccessPolicies = await this.graphRequest('/identity/conditionalAccess/policies');

        } catch (error) {
            console.error('Error collecting identity data:', error);
            throw error;
        }

        return identityData;
    }

    /**
     * Collect Device Management data (Intune)
     */
    async collectDeviceData() {
        const deviceData = {};

        try {
            // Managed devices
            deviceData.managedDevices = await this.graphRequest('/deviceManagement/managedDevices', {
                $select: 'id,deviceName,operatingSystem,complianceState,lastSyncDateTime,enrolledDateTime,deviceType'
            });

            // Device compliance policies
            deviceData.compliancePolicies = await this.graphRequest('/deviceManagement/deviceCompliancePolicies');

            // Device configurations
            deviceData.deviceConfigurations = await this.graphRequest('/deviceManagement/deviceConfigurations');

            // Mobile application management
            deviceData.mobileApps = await this.graphRequest('/deviceManagement/mobileApps', {
                $select: 'id,displayName,publisher,largeIcon,createdDateTime'
            });

            // Device enrollment configurations
            deviceData.enrollmentConfigurations = await this.graphRequest('/deviceManagement/deviceEnrollmentConfigurations');

            // Compliance status summary
            deviceData.complianceStatus = await this.analyzeDeviceCompliance(deviceData.managedDevices);

        } catch (error) {
            console.error('Error collecting device data:', error);
            throw error;
        }

        return deviceData;
    }

    /**
     * Collect Security Score and Threat data
     */
    async collectSecurityData() {
        const securityData = {};

        try {
            // Secure Score
            securityData.secureScore = await this.graphRequest('/security/secureScores', {
                $top: 1,
                $orderby: 'createdDateTime desc'
            });

            // Secure Score controls
            securityData.secureScoreControls = await this.graphRequest('/security/secureScoreControlProfiles');

            // Security alerts
            securityData.securityAlerts = await this.graphRequest('/security/alerts', {
                $filter: `createdDateTime ge ${this.reportPeriod.start}`,
                $orderby: 'createdDateTime desc'
            });

            // Threat intelligence indicators
            securityData.threatIndicators = await this.graphRequest('/security/tiIndicators', {
                $top: 100,
                $orderby: 'lastReportedDateTime desc'
            });

            // Security actions
            securityData.securityActions = await this.graphRequest('/security/securityActions', {
                $filter: `lastActionDateTime ge ${this.reportPeriod.start}`
            });

            // Advanced threat analytics (if available)
            try {
                securityData.advancedThreats = await this.graphRequest('/security/attacks');
            } catch (error) {
                console.log('Advanced threat analytics not available:', error.message);
                securityData.advancedThreats = { value: [] };
            }

        } catch (error) {
            console.error('Error collecting security data:', error);
            throw error;
        }

        return securityData;
    }

    /**
     * Collect Compliance and Policy data
     */
    async collectComplianceData() {
        const complianceData = {};

        try {
            // Compliance score
            complianceData.complianceScore = await this.graphRequest('/deviceManagement/complianceManagementPartners');

            // Data loss prevention policies
            try {
                complianceData.dlpPolicies = await this.graphRequest('/security/informationProtection/labelPolicySettings');
            } catch (error) {
                console.log('DLP policies not accessible:', error.message);
                complianceData.dlpPolicies = { value: [] };
            }

            // Retention policies
            try {
                complianceData.retentionPolicies = await this.graphRequest('/security/labels/retentionLabels');
            } catch (error) {
                console.log('Retention policies not accessible:', error.message);
                complianceData.retentionPolicies = { value: [] };
            }

            // Audit log configuration
            complianceData.auditLogConfig = await this.graphRequest('/auditLogs/directoryAudits', {
                $top: 10,
                $orderby: 'activityDateTime desc'
            });

            // Information protection labels
            try {
                complianceData.sensitivityLabels = await this.graphRequest('/security/informationProtection/sensitivityLabels');
            } catch (error) {
                console.log('Sensitivity labels not accessible:', error.message);
                complianceData.sensitivityLabels = { value: [] };
            }

        } catch (error) {
            console.error('Error collecting compliance data:', error);
            throw error;
        }

        return complianceData;
    }

    /**
     * Collect Application Security data
     */
    async collectApplicationData() {
        const applicationData = {};

        try {
            // Registered applications
            applicationData.applications = await this.graphRequest('/applications', {
                $select: 'id,displayName,createdDateTime,publisherDomain,signInAudience'
            });

            // Service principals
            applicationData.servicePrincipals = await this.graphRequest('/servicePrincipals', {
                $select: 'id,displayName,appId,servicePrincipalType,createdDateTime'
            });

            // OAuth2 grants
            applicationData.oauth2Grants = await this.graphRequest('/oauth2PermissionGrants');

            // App role assignments
            applicationData.appRoleAssignments = await this.graphRequest('/servicePrincipals', {
                $expand: 'appRoleAssignments'
            });

            // Enterprise applications
            applicationData.enterpriseApps = await this.graphRequest('/servicePrincipals', {
                $filter: 'servicePrincipalType eq \'Application\'',
                $select: 'id,displayName,appId,homepage,replyUrls'
            });

        } catch (error) {
            console.error('Error collecting application data:', error);
            throw error;
        }

        return applicationData;
    }

    /**
     * Collect Data Protection data
     */
    async collectDataProtectionData() {
        const dataProtectionData = {};

        try {
            // SharePoint sites
            dataProtectionData.sharepointSites = await this.graphRequest('/sites', {
                $select: 'id,displayName,createdDateTime,lastModifiedDateTime,webUrl'
            });

            // OneDrive usage
            dataProtectionData.oneDriveUsage = await this.graphRequest('/reports/getOneDriveUsageAccountDetail(period=\'D30\')');

            // SharePoint usage
            dataProtectionData.sharepointUsage = await this.graphRequest('/reports/getSharePointSiteUsageDetail(period=\'D30\')');

            // Mail usage
            dataProtectionData.mailUsage = await this.graphRequest('/reports/getMailboxUsageDetail(period=\'D30\')');

            // Information protection events (if available)
            try {
                dataProtectionData.protectionEvents = await this.graphRequest('/security/informationProtection/threatAssessmentRequests');
            } catch (error) {
                console.log('Information protection events not accessible:', error.message);
                dataProtectionData.protectionEvents = { value: [] };
            }

        } catch (error) {
            console.error('Error collecting data protection data:', error);
            throw error;
        }

        return dataProtectionData;
    }

    /**
     * Helper method to collect MFA status for users
     */
    async collectMFAStatus() {
        try {
            const authMethods = await this.graphRequest('/reports/authenticationMethods/userRegistrationDetails');
            return authMethods;
        } catch (error) {
            console.log('MFA status not accessible, using alternative method:', error.message);
            
            // Fallback to basic user info
            const users = await this.graphRequest('/users', {
                $select: 'id,displayName,userPrincipalName'
            });
            
            return {
                value: users.value?.map(user => ({
                    id: user.id,
                    userPrincipalName: user.userPrincipalName,
                    displayName: user.displayName,
                    isMfaRegistered: 'unknown',
                    methodsRegistered: []
                })) || []
            };
        }
    }

    /**
     * Analyze device compliance status
     */
    analyzeDeviceCompliance(managedDevices) {
        const devices = managedDevices.value || [];
        const compliance = {
            total: devices.length,
            compliant: 0,
            nonCompliant: 0,
            unknown: 0,
            byOS: {}
        };

        devices.forEach(device => {
            switch (device.complianceState) {
                case 'compliant':
                    compliance.compliant++;
                    break;
                case 'noncompliant':
                    compliance.nonCompliant++;
                    break;
                default:
                    compliance.unknown++;
            }

            // Group by OS
            const os = device.operatingSystem || 'Unknown';
            if (!compliance.byOS[os]) {
                compliance.byOS[os] = { total: 0, compliant: 0, nonCompliant: 0 };
            }
            compliance.byOS[os].total++;
            if (device.complianceState === 'compliant') {
                compliance.byOS[os].compliant++;
            } else if (device.complianceState === 'noncompliant') {
                compliance.byOS[os].nonCompliant++;
            }
        });

        return compliance;
    }

    /**
     * Make authenticated Graph API request
     */
    async graphRequest(endpoint, params = {}, useBeta = false) {
        const baseUrl = useBeta ? this.graphBetaUrl : this.graphBaseUrl;
        // Fix URL construction - append endpoint to base URL properly
        const fullUrl = baseUrl + (endpoint.startsWith('/') ? endpoint : '/' + endpoint);
        const url = new URL(fullUrl);
        
        // Add query parameters
        Object.keys(params).forEach(key => {
            url.searchParams.append(key, params[key]);
        });

        const accessToken = await this.authService.getAccessToken();
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const response = await fetch(url.toString(), {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.status === 429) {
                    // Rate limited - wait and retry
                    const retryAfter = response.headers.get('Retry-After') || 60;
                    console.log(`Rate limited, waiting ${retryAfter} seconds...`);
                    await this.delay(retryAfter * 1000);
                    continue;
                }

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(`Graph API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
                }

                const data = await response.json();
                console.log(`✅ Graph API request successful: ${endpoint}`);
                return data;

            } catch (error) {
                console.error(`❌ Graph API request failed (attempt ${attempt}): ${endpoint}`, error);
                
                if (attempt === this.maxRetries) {
                    throw error;
                }
                
                // Exponential backoff
                await this.delay(Math.pow(2, attempt) * 1000);
            }
        }
    }

    /**
     * Calculate report period dates
     */
    calculateReportPeriod(period = 'previous-month') {
        const now = new Date();
        let start, end;

        if (period === 'previous-month') {
            start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            end = new Date(now.getFullYear(), now.getMonth(), 0);
        } else {
            // Default to last 30 days
            start = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
            end = now;
        }

        return {
            start: start.toISOString(),
            end: end.toISOString(),
            startDate: start,
            endDate: end
        };
    }

    /**
     * Generate comprehensive report data from collected information
     */
    generateReportData() {
        const reportData = {
            metadata: {
                generatedAt: new Date().toISOString(),
                reportPeriod: this.reportPeriod,
                collectionDuration: Date.now() - this.collectionStartTime.getTime(),
                dataSourcesCollected: this.collectedData.size,
                tenantInfo: this.authService.getTenantInfo()
            },
            executiveSummary: this.generateExecutiveSummary(),
            sections: this.generateReportSections(),
            recommendations: this.generateAIRecommendations(),
            rawData: Object.fromEntries(this.collectedData)
        };

        return reportData;
    }

    /**
     * Generate executive summary with key metrics
     */
    generateExecutiveSummary() {
        const summary = {
            securityScore: 0,
            totalUsers: 0,
            totalDevices: 0,
            criticalAlerts: 0,
            complianceRate: 0,
            mfaAdoption: 0
        };

        try {
            // Extract key metrics from collected data
            const identityData = this.collectedData.get('collectIdentityData')?.data;
            const deviceData = this.collectedData.get('collectDeviceData')?.data;
            const securityData = this.collectedData.get('collectSecurityData')?.data;

            if (identityData?.users?.value) {
                summary.totalUsers = identityData.users.value.length;
            }

            if (deviceData?.managedDevices?.value) {
                summary.totalDevices = deviceData.managedDevices.value.length;
                
                if (deviceData.complianceStatus) {
                    summary.complianceRate = Math.round((deviceData.complianceStatus.compliant / deviceData.complianceStatus.total) * 100);
                }
            }

            if (securityData?.secureScore?.value?.[0]) {
                summary.securityScore = Math.round(securityData.secureScore.value[0].currentScore || 0);
            }

            if (securityData?.securityAlerts?.value) {
                summary.criticalAlerts = securityData.securityAlerts.value.filter(alert => 
                    alert.severity === 'high' || alert.severity === 'critical'
                ).length;
            }

            if (identityData?.mfaStatus?.value) {
                const mfaRegistered = identityData.mfaStatus.value.filter(user => 
                    user.isMfaRegistered === true || user.methodsRegistered?.length > 0
                ).length;
                summary.mfaAdoption = Math.round((mfaRegistered / identityData.mfaStatus.value.length) * 100);
            }

        } catch (error) {
            console.error('Error generating executive summary:', error);
        }

        return summary;
    }

    /**
     * Generate detailed report sections
     */
    generateReportSections() {
        const sections = [];

        this.collectedData.forEach((collection, key) => {
            if (collection.status === 'success' && collection.data) {
                sections.push({
                    name: collection.name,
                    icon: collection.icon,
                    status: 'healthy', // This would be analyzed based on actual data
                    lastUpdated: collection.collectedAt,
                    summary: this.generateSectionSummary(key, collection.data)
                });
            }
        });

        return sections;
    }

    /**
     * Generate AI-powered recommendations
     */
    generateAIRecommendations() {
        const recommendations = [];
        const summary = this.generateExecutiveSummary();

        // Security Score recommendations
        if (summary.securityScore < 80) {
            recommendations.push({
                priority: 'high',
                category: 'Security',
                title: 'Improve Security Score',
                description: `Current security score of ${summary.securityScore}% is below recommended threshold. Focus on implementing security controls to reach 80%+.`,
                impact: 'high',
                effort: 'medium'
            });
        }

        // MFA recommendations
        if (summary.mfaAdoption < 95) {
            recommendations.push({
                priority: 'high',
                category: 'Identity',
                title: 'Increase MFA Adoption',
                description: `Only ${summary.mfaAdoption}% of users have MFA enabled. Target 95%+ adoption for improved security.`,
                impact: 'high',
                effort: 'low'
            });
        }

        // Compliance recommendations
        if (summary.complianceRate < 90) {
            recommendations.push({
                priority: 'medium',
                category: 'Device Management',
                title: 'Improve Device Compliance',
                description: `${summary.complianceRate}% device compliance rate needs improvement. Review and update compliance policies.`,
                impact: 'medium',
                effort: 'medium'
            });
        }

        // Critical alerts
        if (summary.criticalAlerts > 0) {
            recommendations.push({
                priority: 'critical',
                category: 'Security',
                title: 'Address Critical Security Alerts',
                description: `${summary.criticalAlerts} critical security alerts require immediate attention.`,
                impact: 'critical',
                effort: 'high'
            });
        }

        return recommendations;
    }

    /**
     * Generate section-specific summary
     */
    generateSectionSummary(sectionKey, data) {
        // This would contain detailed analysis for each section
        return {
            itemCount: this.countDataItems(data),
            status: 'analyzed',
            keyFindings: []
        };
    }

    /**
     * Count total items in data structure
     */
    countDataItems(data) {
        let count = 0;
        Object.values(data).forEach(value => {
            if (value?.value?.length) {
                count += value.value.length;
            }
        });
        return count;
    }

    /**
     * Utility method for delays
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Export for use in other modules
window.MonthlyReportGraphService = MonthlyReportGraphService;

console.log('✅ Monthly Report Graph Service loaded');