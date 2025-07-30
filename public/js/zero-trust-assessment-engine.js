// Zero Trust Assessment Engine
// File: public/js/zero-trust-assessment-engine.js

class ZeroTrustAssessmentEngine {
    constructor() {
        this.assessmentCategories = {
            identity: {
                name: 'Identity Assessment',
                weight: 0.35,
                subcategories: [
                    'conditionalAccess',
                    'authenticationMethods',
                    'userRiskPolicies',
                    'privilegedAccess'
                ]
            },
            devices: {
                name: 'Device Assessment',
                weight: 0.30,
                subcategories: [
                    'deviceCompliance',
                    'deviceConfiguration',
                    'deviceEnrollment',
                    'deviceSecurity'
                ]
            },
            applications: {
                name: 'Application Assessment',
                weight: 0.20,
                subcategories: [
                    'appProtectionPolicies',
                    'appConfiguration',
                    'appCompliance'
                ]
            },
            infrastructure: {
                name: 'Infrastructure Assessment',
                weight: 0.15,
                subcategories: [
                    'networkSecurity',
                    'dataProtection',
                    'governance'
                ]
            }
        };

        this.scoringCriteria = {
            excellent: { min: 90, color: '#10b981', label: 'Excellent' },
            good: { min: 75, color: '#3b82f6', label: 'Good' },
            fair: { min: 60, color: '#f59e0b', label: 'Fair' },
            poor: { min: 40, color: '#ef4444', label: 'Poor' },
            critical: { min: 0, color: '#dc2626', label: 'Critical' }
        };

        this.assessmentResults = null;
        this.rawData = null;
    }

    /**
     * Perform comprehensive Zero Trust assessment
     * @param {Object} data - Raw data from ZeroTrustGraphService
     * @param {Function} progressCallback - Progress callback function
     * @returns {Promise<Object>} Assessment results
     */
    async performAssessment(data, progressCallback = null) {
        console.log('🔍 Starting Zero Trust Assessment Analysis...');
        const startTime = Date.now();

        this.rawData = data;
        
        const assessmentTasks = [
            { name: 'Identity Assessment', method: () => this.assessIdentity(data) },
            { name: 'Device Assessment', method: () => this.assessDevices(data) },
            { name: 'Application Assessment', method: () => this.assessApplications(data) },
            { name: 'Infrastructure Assessment', method: () => this.assessInfrastructure(data) }
        ];

        const results = {
            metadata: {
                assessmentDate: new Date().toISOString(),
                dataCollectionTime: data.metadata.collectionEndTime,
                assessmentDuration: null,
                totalDataPoints: data.metadata.dataPoints
            },
            overallScore: 0,
            overallRating: null,
            categories: {},
            recommendations: [],
            criticalFindings: [],
            complianceStatus: {}
        };

        let completedTasks = 0;
        const totalTasks = assessmentTasks.length;

        for (const task of assessmentTasks) {
            try {
                console.log(`📊 ${task.name}...`);
                
                if (progressCallback) {
                    progressCallback({
                        current: completedTasks,
                        total: totalTasks,
                        currentTask: task.name,
                        percentage: Math.round((completedTasks / totalTasks) * 100)
                    });
                }

                const categoryResult = await task.method();
                const categoryKey = task.name.toLowerCase().replace(' assessment', '').replace(' ', '');
                results.categories[categoryKey] = categoryResult;

                console.log(`✅ ${task.name}: ${categoryResult.score}% score`);
                
            } catch (error) {
                console.error(`❌ Failed ${task.name}:`, error);
                const categoryKey = task.name.toLowerCase().replace(' assessment', '').replace(' ', '');
                results.categories[categoryKey] = this.createErrorResult(task.name, error);
            }
            
            completedTasks++;
        }

        // Calculate overall score
        results.overallScore = this.calculateOverallScore(results.categories);
        results.overallRating = this.getScoreRating(results.overallScore);

        // Generate recommendations and critical findings
        results.recommendations = this.generateRecommendations(results.categories);
        results.criticalFindings = this.extractCriticalFindings(results.categories);
        results.complianceStatus = this.assessComplianceStatus(results.categories);

        const endTime = Date.now();
        results.metadata.assessmentDuration = endTime - startTime;

        this.assessmentResults = results;

        console.log(`🎉 Assessment complete! Overall Score: ${results.overallScore}% (${results.overallRating.label})`);

        if (progressCallback) {
            progressCallback({
                current: totalTasks,
                total: totalTasks,
                currentTask: 'Complete',
                percentage: 100
            });
        }

        return results;
    }

    // ==================== IDENTITY ASSESSMENT ====================

    /**
     * Assess identity and access management
     * @param {Object} data - Raw assessment data
     * @returns {Object} Identity assessment results
     */
    assessIdentity(data) {
        const identity = data.identity;
        const users = data.users;
        
        const subcategoryResults = {
            conditionalAccess: this.assessConditionalAccess(identity.conditionalAccessPolicies),
            authenticationMethods: this.assessAuthenticationMethods(identity.authenticationMethodsPolicies),
            userRiskPolicies: this.assessUserRiskPolicies(identity),
            privilegedAccess: this.assessPrivilegedAccess(data.directoryRoles, users)
        };

        const categoryScore = this.calculateCategoryScore(subcategoryResults, this.assessmentCategories.identity.subcategories);

        return {
            name: 'Identity Assessment',
            score: categoryScore,
            rating: this.getScoreRating(categoryScore),
            subcategories: subcategoryResults,
            findings: this.generateIdentityFindings(subcategoryResults),
            recommendations: this.generateIdentityRecommendations(subcategoryResults)
        };
    }

    assessConditionalAccess(policies) {
        let score = 0;
        const findings = [];
        
        if (!policies || policies.length === 0) {
            findings.push({
                type: 'critical',
                message: 'No Conditional Access policies found',
                impact: 'High security risk - unrestricted access'
            });
            return { score: 0, findings, details: { totalPolicies: 0, enabledPolicies: 0 } };
        }

        const enabledPolicies = policies.filter(p => p.state === 'enabled');
        const totalPolicies = policies.length;

        // Base score for having CA policies
        score += Math.min(30, (enabledPolicies.length / Math.max(totalPolicies, 1)) * 30);

        // Check for essential policy types
        const mfaPolicies = enabledPolicies.filter(p => 
            p.grantControls && p.grantControls.builtInControls && 
            p.grantControls.builtInControls.includes('mfa')
        );
        
        if (mfaPolicies.length > 0) {
            score += 25;
            findings.push({
                type: 'positive',
                message: `${mfaPolicies.length} MFA policies enabled`,
                impact: 'Improved authentication security'
            });
        } else {
            findings.push({
                type: 'warning',
                message: 'No MFA enforcement policies found',
                impact: 'Weak authentication security'
            });
        }

        // Check for device compliance requirements
        const deviceCompliancePolicies = enabledPolicies.filter(p =>
            p.grantControls && p.grantControls.builtInControls &&
            p.grantControls.builtInControls.includes('compliantDevice')
        );

        if (deviceCompliancePolicies.length > 0) {
            score += 20;
            findings.push({
                type: 'positive',
                message: `${deviceCompliancePolicies.length} device compliance policies enabled`,
                impact: 'Enhanced device security'
            });
        }

        // Check for location-based policies
        const locationPolicies = enabledPolicies.filter(p =>
            p.conditions && p.conditions.locations && p.conditions.locations.includeLocations
        );

        if (locationPolicies.length > 0) {
            score += 15;
        }

        // Check for application-specific policies
        const appSpecificPolicies = enabledPolicies.filter(p =>
            p.conditions && p.conditions.applications && 
            p.conditions.applications.includeApplications && 
            p.conditions.applications.includeApplications.length > 0
        );

        if (appSpecificPolicies.length > 0) {
            score += 10;
        }

        return {
            score: Math.min(100, score),
            findings,
            details: {
                totalPolicies: totalPolicies,
                enabledPolicies: enabledPolicies.length,
                mfaPolicies: mfaPolicies.length,
                deviceCompliancePolicies: deviceCompliancePolicies.length,
                locationPolicies: locationPolicies.length,
                appSpecificPolicies: appSpecificPolicies.length
            }
        };
    }

    assessAuthenticationMethods(authMethodsPolicy) {
        let score = 0;
        const findings = [];

        if (!authMethodsPolicy) {
            findings.push({
                type: 'warning',
                message: 'Authentication methods policy not found',
                impact: 'Cannot assess authentication security'
            });
            return { score: 50, findings, details: {} };
        }

        // Check if modern authentication methods are enabled
        const methods = authMethodsPolicy.authenticationMethodConfigurations || [];
        
        const mfaMethods = methods.filter(m => 
            ['microsoftAuthenticator', 'sms', 'voice', 'fido2', 'windowsHelloForBusiness'].includes(m.id) &&
            m.state === 'enabled'
        );

        if (mfaMethods.length >= 2) {
            score += 40;
            findings.push({
                type: 'positive',
                message: `${mfaMethods.length} MFA methods enabled`,
                impact: 'Multiple authentication options available'
            });
        } else if (mfaMethods.length === 1) {
            score += 20;
            findings.push({
                type: 'warning',
                message: 'Only one MFA method enabled',
                impact: 'Limited authentication options'
            });
        }

        // Check for passwordless methods
        const passwordlessMethods = methods.filter(m =>
            ['microsoftAuthenticator', 'fido2', 'windowsHelloForBusiness'].includes(m.id) &&
            m.state === 'enabled'
        );

        if (passwordlessMethods.length > 0) {
            score += 30;
            findings.push({
                type: 'positive',
                message: `${passwordlessMethods.length} passwordless methods enabled`,
                impact: 'Enhanced security with passwordless authentication'
            });
        }

        // Check if legacy methods are disabled
        const legacyMethods = methods.filter(m =>
            ['sms', 'voice'].includes(m.id) && m.state === 'enabled'
        );

        if (legacyMethods.length === 0) {
            score += 30;
            findings.push({
                type: 'positive',
                message: 'Legacy authentication methods disabled',
                impact: 'Reduced security risks'
            });
        } else {
            findings.push({
                type: 'warning',
                message: `${legacyMethods.length} legacy methods still enabled`,
                impact: 'Potential security vulnerabilities'
            });
        }

        return {
            score: Math.min(100, score),
            findings,
            details: {
                totalMethods: methods.length,
                mfaMethods: mfaMethods.length,
                passwordlessMethods: passwordlessMethods.length,
                legacyMethods: legacyMethods.length
            }
        };
    }

    assessUserRiskPolicies(identity) {
        let score = 60; // Base score assuming basic security
        const findings = [];

        // Check security defaults
        if (identity.securityDefaultsPolicy && identity.securityDefaultsPolicy.isEnabled) {
            score += 20;
            findings.push({
                type: 'positive',
                message: 'Security defaults enabled',
                impact: 'Basic security protections active'
            });
        }

        // Check for identity protection policies (would be in conditional access)
        const identityProtectionPolicies = identity.conditionalAccessPolicies?.filter(p =>
            p.conditions && (p.conditions.userRiskLevels || p.conditions.signInRiskLevels)
        ) || [];

        if (identityProtectionPolicies.length > 0) {
            score += 20;
            findings.push({
                type: 'positive',
                message: `${identityProtectionPolicies.length} risk-based policies found`,
                impact: 'Identity protection active'
            });
        } else {
            findings.push({
                type: 'warning',
                message: 'No risk-based conditional access policies found',
                impact: 'Limited identity protection'
            });
        }

        return {
            score: Math.min(100, score),
            findings,
            details: {
                securityDefaultsEnabled: identity.securityDefaultsPolicy?.isEnabled || false,
                riskBasedPolicies: identityProtectionPolicies.length
            }
        };
    }

    assessPrivilegedAccess(directoryRoles, users) {
        let score = 70; // Base score
        const findings = [];

        const privilegedRoles = directoryRoles?.filter(role =>
            ['Global Administrator', 'Security Administrator', 'Conditional Access Administrator'].includes(role.displayName)
        ) || [];

        if (privilegedRoles.length > 0) {
            findings.push({
                type: 'info',
                message: `${privilegedRoles.length} privileged roles identified`,
                impact: 'Privileged access monitoring required'
            });
        }

        // In a real implementation, we'd check for PIM policies, role assignments, etc.
        // For now, we'll provide a baseline assessment

        return {
            score,
            findings,
            details: {
                privilegedRoles: privilegedRoles.length,
                totalRoles: directoryRoles?.length || 0
            }
        };
    }

    // ==================== DEVICE ASSESSMENT ====================

    assessDevices(data) {
        const devices = data.devices;
        
        const subcategoryResults = {
            deviceCompliance: this.assessDeviceCompliance(devices.managedDevices, devices.compliancePolicies),
            deviceConfiguration: this.assessDeviceConfiguration(devices.configurationPolicies),
            deviceEnrollment: this.assessDeviceEnrollment(devices.managedDevices, devices.azureADDevices),
            deviceSecurity: this.assessDeviceSecurity(devices.managedDevices)
        };

        const categoryScore = this.calculateCategoryScore(subcategoryResults, this.assessmentCategories.devices.subcategories);

        return {
            name: 'Device Assessment',
            score: categoryScore,
            rating: this.getScoreRating(categoryScore),
            subcategories: subcategoryResults,
            findings: this.generateDeviceFindings(subcategoryResults),
            recommendations: this.generateDeviceRecommendations(subcategoryResults)
        };
    }

    assessDeviceCompliance(managedDevices, compliancePolicies) {
        let score = 0;
        const findings = [];

        if (!compliancePolicies || compliancePolicies.length === 0) {
            findings.push({
                type: 'critical',
                message: 'No device compliance policies found',
                impact: 'Devices not monitored for compliance'
            });
            return { score: 0, findings, details: {} };
        }

        const totalPolicies = compliancePolicies.length;
        score += Math.min(30, totalPolicies * 10);

        const compliantDevices = managedDevices?.filter(d => d.complianceState === 'compliant') || [];
        const totalManagedDevices = managedDevices?.length || 0;
        
        if (totalManagedDevices > 0) {
            const complianceRate = (compliantDevices.length / totalManagedDevices) * 100;
            score += Math.min(70, complianceRate * 0.7);
            
            findings.push({
                type: complianceRate >= 80 ? 'positive' : complianceRate >= 60 ? 'warning' : 'critical',
                message: `${complianceRate.toFixed(1)}% device compliance rate`,
                impact: `${compliantDevices.length}/${totalManagedDevices} devices compliant`
            });
        }

        return {
            score: Math.min(100, score),
            findings,
            details: {
                totalPolicies,
                totalManagedDevices,
                compliantDevices: compliantDevices.length,
                complianceRate: totalManagedDevices > 0 ? (compliantDevices.length / totalManagedDevices) * 100 : 0
            }
        };
    }

    assessDeviceConfiguration(configPolicies) {
        let score = 50; // Base score
        const findings = [];

        const totalPolicies = configPolicies?.length || 0;
        
        if (totalPolicies === 0) {
            findings.push({
                type: 'warning',
                message: 'No device configuration policies found',
                impact: 'Devices may not have security configurations'
            });
            return { score: 30, findings, details: { totalPolicies: 0 } };
        }

        score += Math.min(50, totalPolicies * 5);

        findings.push({
            type: 'positive',
            message: `${totalPolicies} configuration policies deployed`,
            impact: 'Device security configurations managed'
        });

        return {
            score: Math.min(100, score),
            findings,
            details: { totalPolicies }
        };
    }

    assessDeviceEnrollment(managedDevices, azureADDevices) {
        let score = 0;
        const findings = [];

        const totalAzureADDevices = azureADDevices?.length || 0;
        const totalManagedDevices = managedDevices?.length || 0;

        if (totalAzureADDevices === 0) {
            findings.push({
                type: 'warning',
                message: 'No Azure AD devices found',
                impact: 'Device management may not be configured'
            });
            return { score: 20, findings, details: {} };
        }

        const managementRate = totalAzureADDevices > 0 ? (totalManagedDevices / totalAzureADDevices) * 100 : 0;
        score = Math.min(100, managementRate);

        findings.push({
            type: managementRate >= 70 ? 'positive' : managementRate >= 40 ? 'warning' : 'critical',
            message: `${managementRate.toFixed(1)}% device management coverage`,
            impact: `${totalManagedDevices}/${totalAzureADDevices} devices under management`
        });

        return {
            score,
            findings,
            details: {
                totalAzureADDevices,
                totalManagedDevices,
                managementRate
            }
        };
    }

    assessDeviceSecurity(managedDevices) {
        let score = 70; // Base score
        const findings = [];

        if (!managedDevices || managedDevices.length === 0) {
            return { score: 50, findings: [{ type: 'warning', message: 'No managed devices to assess', impact: 'Cannot evaluate device security' }], details: {} };
        }

        const encryptedDevices = managedDevices.filter(d => d.isEncrypted === true);
        const supervisionCompliantDevices = managedDevices.filter(d => d.isSupervised === true);
        
        const encryptionRate = (encryptedDevices.length / managedDevices.length) * 100;
        score += Math.min(30, encryptionRate * 0.3);

        if (encryptionRate >= 80) {
            findings.push({
                type: 'positive',
                message: `${encryptionRate.toFixed(1)}% devices encrypted`,
                impact: 'Strong data protection'
            });
        } else {
            findings.push({
                type: 'warning',
                message: `Only ${encryptionRate.toFixed(1)}% devices encrypted`,
                impact: 'Data at risk on unencrypted devices'
            });
        }

        return {
            score: Math.min(100, score),
            findings,
            details: {
                totalDevices: managedDevices.length,
                encryptedDevices: encryptedDevices.length,
                encryptionRate
            }
        };
    }

    // ==================== APPLICATION ASSESSMENT ====================

    assessApplications(data) {
        const applications = data.applications;
        
        const subcategoryResults = {
            appProtectionPolicies: this.assessAppProtectionPolicies(applications.managedAppPolicies),
            appConfiguration: this.assessAppConfiguration(applications.managedAppRegistrations),
            appCompliance: this.assessAppCompliance(applications)
        };

        const categoryScore = this.calculateCategoryScore(subcategoryResults, this.assessmentCategories.applications.subcategories);

        return {
            name: 'Application Assessment',
            score: categoryScore,
            rating: this.getScoreRating(categoryScore),
            subcategories: subcategoryResults,
            findings: this.generateApplicationFindings(subcategoryResults),
            recommendations: this.generateApplicationRecommendations(subcategoryResults)
        };
    }

    assessAppProtectionPolicies(managedAppPolicies) {
        let score = 50; // Base score
        const findings = [];

        const totalPolicies = managedAppPolicies?.length || 0;
        
        if (totalPolicies === 0) {
            findings.push({
                type: 'warning',
                message: 'No app protection policies found',
                impact: 'Mobile applications not protected'
            });
            return { score: 30, findings, details: { totalPolicies: 0 } };
        }

        score += Math.min(50, totalPolicies * 10);

        findings.push({
            type: 'positive',
            message: `${totalPolicies} app protection policies configured`,
            impact: 'Mobile app data protection enabled'
        });

        return {
            score,
            findings,
            details: { totalPolicies }
        };
    }

    assessAppConfiguration(managedAppRegistrations) {
        let score = 60; // Base score
        const findings = [];

        const totalRegistrations = managedAppRegistrations?.length || 0;
        
        findings.push({
            type: 'info',
            message: `${totalRegistrations} managed app registrations found`,
            impact: 'Application inventory tracked'
        });

        return {
            score,
            findings,
            details: { totalRegistrations }
        };
    }

    assessAppCompliance(applications) {
        let score = 65; // Base score
        const findings = [];

        // This would be expanded with more detailed app compliance checking
        findings.push({
            type: 'info',
            message: 'Application compliance assessment requires additional data',
            impact: 'Manual review recommended'
        });

        return {
            score,
            findings,
            details: {}
        };
    }

    // ==================== INFRASTRUCTURE ASSESSMENT ====================

    assessInfrastructure(data) {
        const subcategoryResults = {
            networkSecurity: this.assessNetworkSecurity(data.identity.namedLocations),
            dataProtection: this.assessDataProtection(data),
            governance: this.assessGovernance(data)
        };

        const categoryScore = this.calculateCategoryScore(subcategoryResults, this.assessmentCategories.infrastructure.subcategories);

        return {
            name: 'Infrastructure Assessment',
            score: categoryScore,
            rating: this.getScoreRating(categoryScore),
            subcategories: subcategoryResults,
            findings: this.generateInfrastructureFindings(subcategoryResults),
            recommendations: this.generateInfrastructureRecommendations(subcategoryResults)
        };
    }

    assessNetworkSecurity(namedLocations) {
        let score = 50; // Base score
        const findings = [];

        const totalLocations = namedLocations?.length || 0;
        
        if (totalLocations > 0) {
            score += 30;
            findings.push({
                type: 'positive',
                message: `${totalLocations} named locations configured`,
                impact: 'Location-based access control available'
            });
        } else {
            findings.push({
                type: 'warning',
                message: 'No named locations configured',
                impact: 'No location-based access restrictions'
            });
        }

        return {
            score,
            findings,
            details: { totalLocations }
        };
    }

    assessDataProtection(data) {
        let score = 60; // Base score
        const findings = [];

        // This would be expanded with more detailed data protection assessment
        findings.push({
            type: 'info',
            message: 'Data protection assessment requires additional data sources',
            impact: 'Manual review of DLP and encryption policies recommended'
        });

        return {
            score,
            findings,
            details: {}
        };
    }

    assessGovernance(data) {
        let score = 65; // Base score
        const findings = [];

        const totalUsers = data.users?.length || 0;
        const totalGroups = data.groups?.length || 0;

        findings.push({
            type: 'info',
            message: `${totalUsers} users and ${totalGroups} groups in directory`,
            impact: 'Identity governance scope identified'
        });

        return {
            score,
            findings,
            details: { totalUsers, totalGroups }
        };
    }

    // ==================== SCORING AND RATING UTILITIES ====================

    calculateCategoryScore(subcategoryResults, subcategoryNames) {
        const validSubcategories = subcategoryNames.filter(name => subcategoryResults[name]);
        
        if (validSubcategories.length === 0) return 0;

        const totalScore = validSubcategories.reduce((sum, name) => sum + subcategoryResults[name].score, 0);
        return Math.round(totalScore / validSubcategories.length);
    }

    calculateOverallScore(categories) {
        let totalWeightedScore = 0;
        let totalWeight = 0;

        Object.keys(this.assessmentCategories).forEach(categoryKey => {
            if (categories[categoryKey]) {
                const weight = this.assessmentCategories[categoryKey].weight;
                const score = categories[categoryKey].score;
                
                totalWeightedScore += score * weight;
                totalWeight += weight;
            }
        });

        return totalWeight > 0 ? Math.round(totalWeightedScore / totalWeight) : 0;
    }

    getScoreRating(score) {
        for (const [key, criteria] of Object.entries(this.scoringCriteria)) {
            if (score >= criteria.min) {
                return { key, ...criteria };
            }
        }
        return this.scoringCriteria.critical;
    }

    createErrorResult(categoryName, error) {
        return {
            name: categoryName,
            score: 0,
            rating: this.scoringCriteria.critical,
            error: error.message,
            findings: [{
                type: 'error',
                message: `Assessment failed: ${error.message}`,
                impact: 'Unable to evaluate this category'
            }],
            recommendations: [`Resolve data collection issues for ${categoryName}`]
        };
    }

    // ==================== FINDINGS AND RECOMMENDATIONS ====================

    generateIdentityFindings(subcategoryResults) {
        const findings = [];
        Object.values(subcategoryResults).forEach(result => {
            if (result.findings) findings.push(...result.findings);
        });
        return findings;
    }

    generateIdentityRecommendations(subcategoryResults) {
        const recommendations = [];
        
        if (subcategoryResults.conditionalAccess.score < 70) {
            recommendations.push('Implement comprehensive Conditional Access policies with MFA requirements');
        }
        
        if (subcategoryResults.authenticationMethods.score < 70) {
            recommendations.push('Enable additional MFA methods and consider passwordless authentication');
        }
        
        return recommendations;
    }

    generateDeviceFindings(subcategoryResults) {
        const findings = [];
        Object.values(subcategoryResults).forEach(result => {
            if (result.findings) findings.push(...result.findings);
        });
        return findings;
    }

    generateDeviceRecommendations(subcategoryResults) {
        const recommendations = [];
        
        if (subcategoryResults.deviceCompliance.score < 70) {
            recommendations.push('Improve device compliance rates through policy refinement and user training');
        }
        
        if (subcategoryResults.deviceEnrollment.score < 70) {
            recommendations.push('Increase device enrollment coverage in mobile device management');
        }
        
        return recommendations;
    }

    generateApplicationFindings(subcategoryResults) {
        const findings = [];
        Object.values(subcategoryResults).forEach(result => {
            if (result.findings) findings.push(...result.findings);
        });
        return findings;
    }

    generateApplicationRecommendations(subcategoryResults) {
        const recommendations = [];
        
        if (subcategoryResults.appProtectionPolicies.score < 70) {
            recommendations.push('Deploy comprehensive app protection policies for mobile applications');
        }
        
        return recommendations;
    }

    generateInfrastructureFindings(subcategoryResults) {
        const findings = [];
        Object.values(subcategoryResults).forEach(result => {
            if (result.findings) findings.push(...result.findings);
        });
        return findings;
    }

    generateInfrastructureRecommendations(subcategoryResults) {
        const recommendations = [];
        
        if (subcategoryResults.networkSecurity.score < 70) {
            recommendations.push('Configure named locations for improved network security controls');
        }
        
        return recommendations;
    }

    generateRecommendations(categories) {
        const allRecommendations = [];
        
        Object.values(categories).forEach(category => {
            if (category.recommendations) {
                allRecommendations.push(...category.recommendations);
            }
        });
        
        return allRecommendations;
    }

    extractCriticalFindings(categories) {
        const criticalFindings = [];
        
        Object.values(categories).forEach(category => {
            if (category.findings) {
                const critical = category.findings.filter(f => f.type === 'critical');
                criticalFindings.push(...critical);
            }
        });
        
        return criticalFindings;
    }

    assessComplianceStatus(categories) {
        const complianceThreshold = 75;
        
        return {
            overallCompliant: Object.values(categories).every(cat => cat.score >= complianceThreshold),
            categoryCompliance: Object.keys(categories).reduce((acc, key) => {
                acc[key] = categories[key].score >= complianceThreshold;
                return acc;
            }, {}),
            complianceThreshold
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ZeroTrustAssessmentEngine;
} else {
    window.ZeroTrustAssessmentEngine = ZeroTrustAssessmentEngine;
}
