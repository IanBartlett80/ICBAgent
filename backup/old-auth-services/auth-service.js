/**
 * ICB Agent Unified Authentication Service
 * Handles Microsoft 365 tenant authentication with MSAL integration
 * Author: ICB Solutions
 */

class ICBAuthService {
    constructor() {
        this.msalInstance = null;
        this.accessToken = null;
        this.account = null;
        this.tenantDomain = null;
        this.isAuthenticated = false;
        
        // Default client configuration
        this.clientConfig = {
            clientId: null,
            authority: null,
            redirectUri: this.getRedirectUri()
        };

        // Required permissions for full ICB Agent functionality
        this.requiredScopes = [
            "User.Read.All",
            "User.ReadWrite.All", 
            "UserAuthenticationMethod.Read.All",
            "SecurityEvents.Read.All",
            "ThreatIndicators.Read.All",
            "DeviceManagementApps.Read.All",
            "DeviceManagementConfiguration.Read.All",
            "DeviceManagementManagedDevices.Read.All",
            "Directory.Read.All",
            "AuditLog.Read.All",
            "InformationProtectionPolicy.Read.All",
            "Reports.Read.All",
            "ReportSettings.Read.All"
        ];

        console.log('🔧 ICB Auth Service initialized');
    }

    /**
     * Get the appropriate redirect URI based on current hostname
     */
    getRedirectUri() {
        // Always use localhost for consistency with Azure App Registration
        // Azure only allows localhost or https, not 127.0.0.1
        const port = window.location.port || '3000';
        return `http://localhost:${port}`;
    }

    /**
     * Initialize MSAL with common Microsoft endpoint
     */
    async initializeAuthentication() {
        try {
            console.log('🚀 Initializing Microsoft authentication...');
            
            if (typeof msal === 'undefined') {
                throw new Error('MSAL library not loaded. Please check your internet connection.');
            }
            
            // Get or generate client ID
            const clientId = this.getClientId();
            
            // Configure MSAL with common endpoint - allows any Microsoft tenant
            this.clientConfig = {
                auth: {
                    clientId: clientId,
                    authority: 'https://login.microsoftonline.com/common', // Common endpoint for multi-tenant
                    redirectUri: this.getRedirectUri(),
                    postLogoutRedirectUri: this.getRedirectUri()
                },
                cache: {
                    cacheLocation: "localStorage", // Use localStorage for cross-window sharing
                    storeAuthStateInCookie: false
                },
                system: {
                    loggerOptions: {
                        loggerCallback: (level, message, containsPii) => {
                            if (containsPii) return;
                            console.log(`🔐 MSAL: ${message}`);
                        }
                    }
                }
            };

            this.msalInstance = new msal.PublicClientApplication(this.clientConfig);
            await this.msalInstance.initialize();
            
            console.log('✅ MSAL initialized successfully with common endpoint');
            
            // Load existing session if available
            this.loadAuthState();
            
            // Handle redirect response if we're returning from authentication
            await this.handleRedirectResponse();
            
            return true;
            
        } catch (error) {
            console.error('❌ Failed to initialize MSAL:', error);
            throw new Error(`Authentication initialization failed: ${error.message}`);
        }
    }

    /**
     * Handle authentication redirect response
     * For popup flow, this mainly handles existing sessions
     */
    async handleRedirectResponse() {
        try {
            // Check for existing sessions first
            const accounts = this.msalInstance.getAllAccounts();
            if (accounts.length > 0) {
                console.log('✅ Found existing session for:', accounts[0].username);
                this.account = accounts[0];
                this.isAuthenticated = true;
                this.tenantDomain = this.extractTenantDomain(this.account);
                
                // Try to get a fresh token to validate the session
                try {
                    const silentRequest = {
                        scopes: ['User.Read'],
                        account: this.account
                    };
                    const tokenResponse = await this.msalInstance.acquireTokenSilent(silentRequest);
                    this.accessToken = tokenResponse.accessToken;
                    console.log('✅ Successfully refreshed access token from existing session');
                    
                    // Save the authentication state
                    this.saveAuthState();
                    
                    // Notify the app of existing authentication
                    if (window.icbAgent) {
                        console.log('🔔 Notifying ICB Agent of existing authentication session');
                        window.icbAgent.updateConnectionStatus('connected', this.tenantDomain);
                        window.icbAgent.onAuthenticationSuccess(this.getAuthResult(), this.tenantDomain);
                    }
                } catch (tokenError) {
                    console.log('⚠️ Could not refresh token from existing session:', tokenError.message);
                    // Session exists but token refresh failed - clear the session
                    this.account = null;
                    this.isAuthenticated = false;
                    this.tenantDomain = null;
                    this.accessToken = null;
                }
                return;
            }

            // Handle any redirect responses (mainly for error cases)
            const response = await this.msalInstance.handleRedirectPromise();
            if (response) {
                console.log('✅ Authentication redirect processed:', response);
                return this.handleAuthSuccess(response);
            }
        } catch (error) {
            console.error('❌ Error handling redirect response:', error);
            if (window.icbAgent) {
                window.icbAgent.updateConnectionStatus('disconnected');
            }
        }
    }

    /**
     * Build tenant authority URL
     */
    buildTenantAuthority(tenantDomain) {
        // Handle different domain formats
        if (tenantDomain.includes('.onmicrosoft.com')) {
            return `https://login.microsoftonline.com/${tenantDomain}`;
        } else {
            // For custom domains, use the domain directly
            return `https://login.microsoftonline.com/${tenantDomain}`;
        }
    }

    /**
     * Get client ID from various sources
     */
    getClientId() {
        // Check URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        let clientId = urlParams.get('clientId');
        
        // Check localStorage
        if (!clientId) {
            clientId = localStorage.getItem('icb_client_id');
        }
        
        // Use development fallback
        if (!clientId) {
            console.log('⚠️ No client ID configured, using development mode');
            // ICB Solutions App Registration - Multi-tenant Microsoft 365 Management Platform
            return 'e18ea8f1-5bc5-4710-bb54-aced2112724c';
        }
        
        return clientId;
    }

    /**
     * Perform interactive authentication
     */
    async authenticate() {
        try {
            console.log('🔐 Starting interactive authentication...');
            
            if (!this.msalInstance) {
                throw new Error('MSAL not initialized. Call initializeAuthentication first.');
            }

            const loginRequest = {
                scopes: ['User.Read'], // Start with basic scope
                prompt: 'select_account'
            };

            // Try silent authentication first
            const accounts = this.msalInstance.getAllAccounts();
            if (accounts.length > 0) {
                try {
                    const silentRequest = {
                        ...loginRequest,
                        account: accounts[0]
                    };
                    
                    const response = await this.msalInstance.acquireTokenSilent(silentRequest);
                    console.log('✅ Silent authentication successful');
                    return this.handleAuthSuccess(response);
                } catch (silentError) {
                    console.log('ℹ️ Silent authentication failed, falling back to interactive');
                }
            }

            // Interactive popup authentication - let MSAL handle everything
            console.log('🚀 Opening authentication popup...');
            const response = await this.msalInstance.acquireTokenPopup(loginRequest);
            console.log('✅ Popup authentication completed successfully');
            return this.handleAuthSuccess(response);
            
        } catch (error) {
            console.error('❌ Authentication failed:', error);
            
            if (error.name === 'BrowserAuthError' && error.errorMessage.includes('popup_window_error')) {
                throw new Error('Popup blocked. Please allow popups for this site and try again.');
            }
            
            if (error.name === 'BrowserAuthError' && error.errorMessage.includes('user_cancelled')) {
                throw new Error('Authentication was cancelled. Please try again.');
            }
            
            throw new Error(`Authentication failed: ${error.message}`);
        }
    }

    /**
     * Handle successful authentication
     */
    async handleAuthSuccess(response) {
        this.accessToken = response.accessToken;
        this.account = response.account;
        this.isAuthenticated = true;
        
        // Extract tenant domain from the authenticated user
        this.tenantDomain = this.extractTenantDomain(this.account);
        
        console.log('✅ Authentication successful for:', this.account.username);
        console.log('🏢 Detected tenant domain:', this.tenantDomain);
        
        // Validate tenant access
        const isValidTenant = await this.validateTenantAccess();
        if (!isValidTenant) {
            throw new Error('User does not have access to the tenant');
        }
        
        // Try to acquire additional permissions
        await this.acquireAdditionalPermissions();
        
        // Save authentication state for session persistence
        this.saveAuthState();
        
        // Notify the app of successful authentication
        if (window.icbAgent) {
            window.icbAgent.onAuthenticationSuccess(this.getAuthResult(), this.tenantDomain);
        }
        
        return this.getAuthResult();
    }

    /**
     * Get authentication result object
     */
    getAuthResult() {
        return {
            isAuthenticated: true,
            account: this.account,
            tenantDomain: this.tenantDomain,
            accessToken: this.accessToken
        };
    }

    /**
     * Extract tenant domain from authenticated user account
     */
    extractTenantDomain(account) {
        // Try to get tenant info from various sources
        if (account.tenantId && account.tenantId !== 'common') {
            // Use tenant ID if available
            return account.tenantId;
        }
        
        if (account.username && account.username.includes('@')) {
            // Extract domain from username
            const domain = account.username.split('@')[1];
            if (domain) {
                return domain;
            }
        }
        
        if (account.homeAccountId && account.homeAccountId.includes('.')) {
            // Extract from home account ID
            const parts = account.homeAccountId.split('.');
            if (parts.length > 1) {
                return parts[1];
            }
        }
        
        // Fallback to tenant ID or generic
        return account.tenantId || 'microsoft-tenant';
    }

    /**
     * Validate that the authenticated user has access to the tenant
     */
    async validateTenantAccess() {
        try {
            // Make a simple Graph API call to validate access
            const response = await fetch('https://graph.microsoft.com/v1.0/me', {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const userInfo = await response.json();
                console.log('✅ Tenant access validated for user:', userInfo.userPrincipalName);
                return true;
            } else {
                console.error('❌ Failed to validate tenant access:', response.status, response.statusText);
                return false;
            }
        } catch (error) {
            console.error('❌ Error validating tenant access:', error);
            return false;
        }
    }

    /**
     * Save authentication state to localStorage for session persistence
     */
    saveAuthState() {
        if (this.isAuthenticated && this.account) {
            const authState = {
                account: this.account,
                tenantDomain: this.tenantDomain,
                isAuthenticated: this.isAuthenticated,
                timestamp: Date.now()
            };
            localStorage.setItem('icb_auth_state', JSON.stringify(authState));
            console.log('💾 Authentication state saved to localStorage');
        }
    }

    /**
     * Load authentication state from localStorage
     */
    loadAuthState() {
        try {
            const authStateJson = localStorage.getItem('icb_auth_state');
            if (authStateJson) {
                const authState = JSON.parse(authStateJson);
                
                // Check if state is not too old (24 hours)
                const maxAge = 24 * 60 * 60 * 1000; // 24 hours
                if (Date.now() - authState.timestamp < maxAge) {
                    this.account = authState.account;
                    this.tenantDomain = authState.tenantDomain;
                    this.isAuthenticated = authState.isAuthenticated;
                    console.log('📥 Authentication state loaded from localStorage');
                    return true;
                } else {
                    console.log('⏰ Stored authentication state expired, clearing');
                    this.clearAuthState();
                }
            }
        } catch (error) {
            console.error('❌ Error loading authentication state:', error);
            this.clearAuthState();
        }
        return false;
    }

    /**
     * Clear authentication state from localStorage
     */
    clearAuthState() {
        localStorage.removeItem('icb_auth_state');
        console.log('🗑️ Authentication state cleared from localStorage');
    }

    /**
     * Acquire additional permissions needed for full functionality
     */
    async acquireAdditionalPermissions() {
        try {
            console.log('🔑 Acquiring additional permissions...');
            
            const additionalRequest = {
                scopes: this.requiredScopes,
                account: this.account
            };
            
            const response = await this.msalInstance.acquireTokenSilent(additionalRequest);
            this.accessToken = response.accessToken;
            
            console.log('✅ Additional permissions acquired');
            return true;
            
        } catch (error) {
            console.log('⚠️ Some permissions may require admin consent:', error.message);
            
            // Try interactive consent for additional permissions
            try {
                const response = await this.msalInstance.acquireTokenPopup(additionalRequest);
                this.accessToken = response.accessToken;
                console.log('✅ Additional permissions acquired via popup');
                return true;
            } catch (popupError) {
                console.log('ℹ️ Additional permissions not granted, some features may be limited');
                return false;
            }
        }
    }

    /**
     * Get current access token
     */
    async getAccessToken() {
        if (!this.isAuthenticated || !this.accessToken) {
            throw new Error('Not authenticated. Please call authenticate() first.');
        }
        
        // Check if token needs refresh
        try {
            const silentRequest = {
                scopes: ['User.Read'],
                account: this.account
            };
            
            const response = await this.msalInstance.acquireTokenSilent(silentRequest);
            this.accessToken = response.accessToken;
            return this.accessToken;
            
        } catch (error) {
            console.error('Token refresh failed:', error);
            throw new Error('Token refresh failed. Please re-authenticate.');
        }
    }

    /**
     * Sign out
     */
    async signOut() {
        try {
            if (this.msalInstance && this.account) {
                await this.msalInstance.logoutPopup({
                    account: this.account
                });
            }
            
            // Clear local state
            this.accessToken = null;
            this.account = null;
            this.isAuthenticated = false;
            this.tenantDomain = null;
            
            // Clear stored auth state
            this.clearAuthState();
            
            // Notify the app of disconnection
            if (window.icbAgent) {
                window.icbAgent.updateConnectionStatus('disconnected');
            }
            
            console.log('✅ Sign out successful');
            
        } catch (error) {
            console.error('❌ Sign out failed:', error);
            // Clear local state anyway
            this.accessToken = null;
            this.account = null;
            this.isAuthenticated = false;
            this.tenantDomain = null;
            this.clearAuthState();
        }
    }

    /**
     * Disconnect user (same as sign out but different terminology)
     */
    async disconnect() {
        await this.signOut();
    }

    /**
     * Get authentication status
     */
    getAuthStatus() {
        return {
            isAuthenticated: this.isAuthenticated,
            account: this.account,
            tenantDomain: this.tenantDomain,
            hasToken: !!this.accessToken
        };
    }
}

// Export to window for global access
window.ICBAuthService = ICBAuthService;
console.log('🔧 ICB Auth Service exported to window');