/**
 * ICB Agent Simplified Authentication Service
 * Handles Microsoft 365 tenant authentication with MSAL redirect flow
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
        const port = window.location.port || '3000';
        return `http://localhost:${port}`;
    }

    /**
     * Get or generate a client ID for the application
     */
    getClientId() {
        let clientId = localStorage.getItem('icb_client_id');
        if (!clientId) {
            // Generate a UUID v4
            clientId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
            localStorage.setItem('icb_client_id', clientId);
            console.log('🆔 Generated new client ID:', clientId);
        }
        return clientId;
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
                    authority: 'https://login.microsoftonline.com/common',
                    redirectUri: this.getRedirectUri(),
                    postLogoutRedirectUri: this.getRedirectUri()
                },
                cache: {
                    cacheLocation: "localStorage",
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
     * Called when returning from Microsoft login page
     */
    async handleRedirectResponse() {
        try {
            const response = await this.msalInstance.handleRedirectPromise();
            
            if (response !== null) {
                // User just returned from redirect
                console.log('✅ Redirect authentication successful');
                return this.handleAuthSuccess(response);
            } else {
                // Check for existing sessions
                const accounts = this.msalInstance.getAllAccounts();
                if (accounts.length > 0) {
                    console.log('✅ Found existing session for:', accounts[0].username);
                    this.account = accounts[0];
                    this.isAuthenticated = true;
                    this.tenantDomain = this.extractTenantDomain(this.account);
                    
                    // Try to get a token silently to validate the session
                    try {
                        const silentRequest = {
                            scopes: ['User.Read'],
                            account: this.account
                        };
                        const tokenResponse = await this.msalInstance.acquireTokenSilent(silentRequest);
                        this.accessToken = tokenResponse.accessToken;
                        this.saveAuthState();
                        
                        // Notify the app
                        if (window.icbAgent) {
                            window.icbAgent.onAuthenticationSuccess(this.getAuthResult());
                        }
                        
                        return {
                            success: true,
                            account: this.account,
                            tenantDomain: this.tenantDomain
                        };
                    } catch (silentError) {
                        console.log('ℹ️ Silent token acquisition failed, user needs to re-authenticate');
                        this.isAuthenticated = false;
                    }
                } else {
                    console.log('ℹ️ No existing authentication found');
                    this.isAuthenticated = false;
                }
            }
            
            return null;
            
        } catch (error) {
            console.error('❌ Error handling redirect response:', error);
            this.isAuthenticated = false;
            throw error;
        }
    }

    /**
     * Perform interactive authentication using redirect flow
     */
    async authenticate() {
        try {
            console.log('🔐 Starting redirect authentication...');
            
            if (!this.msalInstance) {
                throw new Error('MSAL not initialized. Call initializeAuthentication first.');
            }

            const loginRequest = {
                scopes: this.requiredScopes,
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
                    console.log('ℹ️ Silent authentication failed, falling back to redirect');
                }
            }

            // Interactive redirect authentication
            console.log('🚀 Redirecting to Microsoft login page...');
            await this.msalInstance.loginRedirect(loginRequest);
            // Note: This will redirect the page, so code after this won't execute
            
        } catch (error) {
            console.error('❌ Authentication failed:', error);
            
            if (error.name === 'BrowserAuthError' && error.errorMessage.includes('user_cancelled')) {
                throw new Error('Authentication was cancelled. Please try again.');
            }
            
            throw new Error(`Authentication failed: ${error.message}`);
        }
    }

    /**
     * Sign out the current user
     */
    async signOut() {
        try {
            console.log('🔓 Signing out user...');
            
            if (!this.msalInstance) {
                throw new Error('MSAL not initialized');
            }

            // Clear local state
            this.clearAuthState();
            
            // Sign out with redirect
            const logoutRequest = {
                postLogoutRedirectUri: this.getRedirectUri()
            };
            
            await this.msalInstance.logoutRedirect(logoutRequest);
            
        } catch (error) {
            console.error('❌ Sign out failed:', error);
            throw new Error(`Sign out failed: ${error.message}`);
        }
    }

    /**
     * Handle successful authentication
     */
    handleAuthSuccess(response) {
        console.log('🎉 Authentication successful:', response);
        
        this.account = response.account;
        this.accessToken = response.accessToken;
        this.isAuthenticated = true;
        
        // Extract tenant domain from the authenticated user
        this.tenantDomain = this.extractTenantDomain(this.account);
        
        // Save authentication state
        this.saveAuthState();
        
        // Notify the app
        if (window.icbAgent) {
            window.icbAgent.onAuthenticationSuccess(this.getAuthResult());
        }
        
        return {
            success: true,
            account: this.account,
            tenantDomain: this.tenantDomain,
            accessToken: this.accessToken,
            isAuthenticated: true,
            expiresOn: response.expiresOn
        };
    }

    /**
     * Extract tenant domain from authenticated user account
     */
    extractTenantDomain(account) {
        if (!account) return null;
        
        // Try to extract from username (email)
        if (account.username && account.username.includes('@')) {
            const domain = account.username.split('@')[1];
            if (domain && !domain.includes('onmicrosoft.com')) {
                return domain;
            }
        }
        
        // Fallback to tenant ID info if available
        if (account.tenantId) {
            return `${account.tenantId}.onmicrosoft.com`;
        }
        
        return 'Unknown tenant';
    }

    /**
     * Get current authentication result
     */
    getAuthResult() {
        return {
            account: this.account,
            accessToken: this.accessToken,
            tenantDomain: this.tenantDomain,
            isAuthenticated: this.isAuthenticated
        };
    }

    /**
     * Save authentication state to localStorage
     */
    saveAuthState() {
        try {
            const authState = {
                tenantDomain: this.tenantDomain,
                isAuthenticated: this.isAuthenticated,
                timestamp: Date.now()
            };
            localStorage.setItem('icb_auth_state', JSON.stringify(authState));
            console.log('💾 Authentication state saved');
        } catch (error) {
            console.warn('⚠️ Failed to save auth state:', error);
        }
    }

    /**
     * Clear authentication state
     */
    clearAuthState() {
        this.account = null;
        this.accessToken = null;
        this.tenantDomain = null;
        this.isAuthenticated = false;
        
        try {
            localStorage.removeItem('icb_auth_state');
            console.log('🗑️ Authentication state cleared');
        } catch (error) {
            console.warn('⚠️ Failed to clear auth state:', error);
        }
    }

    /**
     * Get current authentication status
     */
    getStatus() {
        return {
            isAuthenticated: this.isAuthenticated,
            tenantDomain: this.tenantDomain,
            username: this.account?.username || null,
            hasValidToken: !!this.accessToken
        };
    }
}

// Export for use
window.ICBAuthService = ICBAuthService;