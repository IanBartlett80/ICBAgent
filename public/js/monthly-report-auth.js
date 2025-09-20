/**
 * Monthly Report Authentication Service
 * Handles Microsoft Graph authentication for Monthly Report generation
 */

class MonthlyReportAuth {
    constructor() {
        this.msalInstance = null;
        this.currentAccount = null;
        this.isAuthenticated = false;
        this.tenantDomain = null;
        
        // Graph API permissions required for comprehensive monthly report
        this.graphScopes = [
            // Identity & User Security
            'User.Read.All',
            'UserAuthenticationMethod.Read.All',
            'IdentityRiskEvent.Read.All',
            'IdentityUserFlow.Read.All',
            
            // Security & Compliance
            'SecurityEvents.Read.All',
            'ThreatIndicators.Read.All',
            'SecurityActions.Read.All',
            'InformationProtectionPolicy.Read.All',
            
            // Device Management (Intune)
            'DeviceManagementApps.Read.All',
            'DeviceManagementConfiguration.Read.All',
            'DeviceManagementManagedDevices.Read.All',
            'DeviceManagementServiceConfig.Read.All',
            
            // Azure AD & Directory
            'Directory.Read.All',
            'AuditLog.Read.All',
            'Policy.Read.All',
            'Application.Read.All',
            
            // Compliance & Data Protection (Purview)
            'InformationProtectionPolicy.Read.All',
            'ThreatAssessment.Read.All',
            
            // Reports
            'Reports.Read.All',
            'ReportSettings.Read.All',
            
            // Mail (for notification capabilities)
            'Mail.Send'
        ];

        this.initializeMSAL();
    }

    initializeMSAL() {
        // Get client ID from environment or use a default for demo
        const clientId = this.getClientId();
        
        if (!clientId) {
            console.warn('⚠️ No client ID configured. Monthly Report authentication will not work.');
            console.warn('Please configure a Microsoft Application Registration for production use.');
            return;
        }

        // MSAL configuration
        const msalConfig = {
            auth: {
                clientId: clientId,
                authority: 'https://login.microsoftonline.com/common',
                redirectUri: window.location.origin + '/public/index.html',
                postLogoutRedirectUri: window.location.origin
            },
            cache: {
                cacheLocation: 'sessionStorage',
                storeAuthStateInCookie: false
            },
            system: {
                loggerOptions: {
                    loggerCallback: (level, message, containsPii) => {
                        if (containsPii) return;
                        console.log(`[MSAL ${level}] ${message}`);
                    },
                    logLevel: 'Info'
                }
            }
        };

        try {
            this.msalInstance = new msal.PublicClientApplication(msalConfig);
            console.log('✅ MSAL initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize MSAL:', error);
            throw new Error('Failed to initialize Microsoft Authentication');
        }
    }

    /**
     * Get client ID from configuration
     * Priority: URL parameter > localStorage > environment > demo fallback
     */
    getClientId() {
        // 1. Check URL parameter (for demo/testing)
        const urlParams = new URLSearchParams(window.location.search);
        const urlClientId = urlParams.get('clientId');
        if (urlClientId) {
            console.log('📋 Using client ID from URL parameter');
            return urlClientId;
        }

        // 2. Check localStorage (for persistent configuration)
        const storedClientId = localStorage.getItem('msalClientId');
        if (storedClientId) {
            console.log('📋 Using client ID from localStorage');
            return storedClientId;
        }

        // 3. Check if running in development (demo mode)
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            console.log('🛠️ Development mode detected - using demo client ID');
            console.log('ℹ️ For production, please configure a proper Microsoft App Registration');
            
            // Return a placeholder that will show helpful error message
            return 'DEMO_CLIENT_ID_REPLACE_ME';
        }

        // 4. Production should have this configured properly
        console.error('❌ No client ID configured for Microsoft Authentication');
        return null;
    }

    /**
     * Authenticate user for specific tenant domain
     * @param {string} tenantDomain - Target tenant domain (e.g., customer.onmicrosoft.com)
     * @returns {Promise<Object>} Authentication result with access token
     */
    async authenticateForTenant(tenantDomain) {
        if (!tenantDomain) {
            throw new Error('Tenant domain is required for authentication');
        }

        // Check if MSAL is properly initialized
        if (!this.msalInstance) {
            throw new Error('Microsoft Authentication is not properly configured. Please contact your administrator.');
        }

        // Check for demo client ID
        const clientId = this.getClientId();
        if (clientId === 'DEMO_CLIENT_ID_REPLACE_ME') {
            throw new Error('Demo mode: Please configure a real Microsoft App Registration client ID for authentication to work.');
        }

        this.tenantDomain = tenantDomain;
        
        try {
            console.log(`🔐 Starting authentication for tenant: ${tenantDomain}`);
            
            // First, try silent authentication
            const silentResult = await this.trySilentAuthentication();
            if (silentResult) {
                console.log('✅ Silent authentication successful');
                return silentResult;
            }

            // If silent auth fails, use interactive authentication
            console.log('🔄 Starting interactive authentication...');
            return await this.performInteractiveAuthentication();

        } catch (error) {
            console.error('❌ Authentication failed:', error);
            throw new Error(`Authentication failed: ${error.message}`);
        }
    }

    async trySilentAuthentication() {
        try {
            const accounts = this.msalInstance.getAllAccounts();
            if (accounts.length === 0) {
                console.log('No cached accounts found');
                return null;
            }

            const account = accounts[0];
            const silentRequest = {
                scopes: this.graphScopes,
                account: account,
                forceRefresh: false
            };

            const response = await this.msalInstance.acquireTokenSilent(silentRequest);
            
            this.currentAccount = account;
            this.isAuthenticated = true;
            
            console.log('✅ Silent authentication successful for:', account.username);
            return response;

        } catch (error) {
            console.log('Silent authentication failed:', error.message);
            return null;
        }
    }

    async performInteractiveAuthentication() {
        const loginRequest = {
            scopes: this.graphScopes,
            prompt: 'select_account',
            loginHint: this.tenantDomain ? `user@${this.tenantDomain}` : undefined
        };

        try {
            const response = await this.msalInstance.loginPopup(loginRequest);
            
            this.currentAccount = response.account;
            this.isAuthenticated = true;
            
            console.log('✅ Interactive authentication successful for:', response.account.username);
            console.log('🎫 Access token acquired with scopes:', response.scopes);
            
            return response;

        } catch (error) {
            if (error.name === 'BrowserAuthError' && error.errorCode === 'popup_window_error') {
                throw new Error('Authentication popup was blocked. Please allow popups and try again.');
            } else if (error.name === 'ClientAuthError' && error.errorCode === 'user_cancelled') {
                throw new Error('Authentication was cancelled by user.');
            } else {
                throw new Error(`Authentication failed: ${error.message}`);
            }
        }
    }

    /**
     * Get access token for Graph API calls
     * @returns {Promise<string>} Valid access token
     */
    async getAccessToken() {
        if (!this.isAuthenticated || !this.currentAccount) {
            throw new Error('User is not authenticated');
        }

        try {
            const tokenRequest = {
                scopes: this.graphScopes,
                account: this.currentAccount,
                forceRefresh: false
            };

            const response = await this.msalInstance.acquireTokenSilent(tokenRequest);
            return response.accessToken;

        } catch (error) {
            console.error('Failed to acquire access token:', error);
            
            // If silent token acquisition fails, try interactive
            try {
                const response = await this.msalInstance.acquireTokenPopup({
                    scopes: this.graphScopes,
                    account: this.currentAccount
                });
                return response.accessToken;
            } catch (interactiveError) {
                throw new Error(`Failed to acquire access token: ${interactiveError.message}`);
            }
        }
    }

    /**
     * Get authenticated user information
     * @returns {Object} User account information
     */
    getCurrentUser() {
        if (!this.currentAccount) {
            return null;
        }

        return {
            username: this.currentAccount.username,
            name: this.currentAccount.name,
            tenantId: this.currentAccount.tenantId,
            homeAccountId: this.currentAccount.homeAccountId
        };
    }

    /**
     * Sign out the current user
     */
    async signOut() {
        try {
            if (this.currentAccount) {
                await this.msalInstance.logoutPopup({
                    account: this.currentAccount,
                    postLogoutRedirectUri: window.location.origin
                });
            }
            
            this.currentAccount = null;
            this.isAuthenticated = false;
            this.tenantDomain = null;
            
            console.log('✅ User signed out successfully');
            
        } catch (error) {
            console.error('Sign out failed:', error);
            // Clear local state even if logout fails
            this.currentAccount = null;
            this.isAuthenticated = false;
            this.tenantDomain = null;
        }
    }

    /**
     * Check if user is currently authenticated
     * @returns {boolean} Authentication status
     */
    isUserAuthenticated() {
        return this.isAuthenticated && this.currentAccount !== null;
    }

    /**
     * Get tenant information from authenticated account
     * @returns {Object} Tenant information
     */
    getTenantInfo() {
        if (!this.currentAccount) {
            return null;
        }

        return {
            tenantId: this.currentAccount.tenantId,
            domain: this.tenantDomain,
            username: this.currentAccount.username
        };
    }

    /**
     * Validate required permissions
     * @returns {Promise<Object>} Validation result with missing permissions
     */
    async validatePermissions() {
        if (!this.isAuthenticated) {
            throw new Error('User must be authenticated to validate permissions');
        }

        try {
            const accessToken = await this.getAccessToken();
            
            // Decode token to check granted scopes (basic validation)
            const tokenPayload = this.decodeJWT(accessToken);
            const grantedScopes = tokenPayload.scp ? tokenPayload.scp.split(' ') : [];
            
            const missingScopes = this.graphScopes.filter(scope => 
                !grantedScopes.includes(scope)
            );

            return {
                isValid: missingScopes.length === 0,
                grantedScopes: grantedScopes,
                missingScopes: missingScopes,
                totalRequired: this.graphScopes.length,
                totalGranted: grantedScopes.filter(scope => 
                    this.graphScopes.includes(scope)
                ).length
            };

        } catch (error) {
            console.error('Permission validation failed:', error);
            return {
                isValid: false,
                error: error.message,
                grantedScopes: [],
                missingScopes: this.graphScopes
            };
        }
    }

    /**
     * Simple JWT decoder for permission validation
     * @param {string} token - JWT token to decode
     * @returns {Object} Decoded token payload
     */
    decodeJWT(token) {
        try {
            const base64Payload = token.split('.')[1];
            const payload = atob(base64Payload);
            return JSON.parse(payload);
        } catch (error) {
            console.error('Failed to decode JWT:', error);
            return {};
        }
    }
}

// Initialize global authentication service for Monthly Reports
window.monthlyReportAuth = new MonthlyReportAuth();

console.log('✅ Monthly Report Authentication Service loaded');