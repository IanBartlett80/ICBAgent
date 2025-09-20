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

        // Required permissions for ICB Agent functionality
        // Starting with core permissions, can be expanded as needed
        this.requiredScopes = [
            "User.Read.All",
            "Directory.Read.All",
            "DeviceManagementManagedDevices.Read.All",
            "DeviceManagementConfiguration.Read.All",
            "DeviceManagementApps.Read.All",
            "AuditLog.Read.All",
            "Reports.Read.All",
            "SecurityEvents.Read.All"
        ];

        console.log('🔧 ICB Auth Service initialized');
        
        // Check if we have auth parameters immediately upon initialization
        const hasAuthParams = window.location.hash.includes('code=') || window.location.search.includes('code=');
        if (hasAuthParams) {
            console.log('🔍 Auth parameters detected during initialization, scheduling redirect processing...');
            // Schedule redirect processing after initialization is complete
            setTimeout(() => {
                this.handleRedirectResponse().catch(error => {
                    console.error('❌ Error in scheduled redirect processing:', error);
                });
            }, 100);
        }
    }

    /**
     * Get the appropriate redirect URI based on current hostname
     */
    getRedirectUri() {
        const port = window.location.port || '3000';
        return `http://localhost:${port}`;
    }

    /**
     * Get the client ID for the application
     * Using ICB Solutions tenant app registration
     */
    getClientId() {
        // ICB Solutions tenant app registration ID
        const clientId = 'e18ea8f1-5bc5-4710-bb54-aced2112724c';
        console.log('🆔 Using ICB Solutions app registration client ID:', clientId);
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
            console.log('🔍 Processing redirect response...');
            console.log('🔍 Current URL:', window.location.href);
            console.log('🔍 URL hash:', window.location.hash);
            console.log('🔍 URL search:', window.location.search);
            
            // Check if MSAL instance is initialized
            if (!this.msalInstance) {
                console.log('⚠️ MSAL instance not ready, initializing first...');
                await this.initializeAuthentication();
            }
            
            // Check if URL contains auth parameters manually first
            const hasAuthCode = window.location.hash.includes('code=') || window.location.search.includes('code=');
            const hasState = window.location.hash.includes('state=') || window.location.search.includes('state=');
            console.log('🔍 Manual auth parameter check:', { hasAuthCode, hasState });
            
            const response = await this.msalInstance.handleRedirectPromise();
            console.log('🔍 MSAL handleRedirectPromise response:', response);
            
            if (response !== null) {
                // User just returned from redirect
                console.log('✅ Redirect authentication successful');
                console.log('✅ Response details:', response);
                return this.handleAuthSuccess(response);
            } else if (hasAuthCode && hasState) {
                // MSAL didn't detect auth parameters but they exist - force a retry
                console.log('⚠️ MSAL missed auth parameters, manually handling...');
                console.log('🔄 Attempting MSAL retry with current URL...');
                
                // Wait a moment and try again
                await new Promise(resolve => setTimeout(resolve, 500));
                const retryResponse = await this.msalInstance.handleRedirectPromise();
                console.log('🔍 MSAL retry response:', retryResponse);
                
                if (retryResponse !== null) {
                    console.log('✅ Retry successful');
                    return this.handleAuthSuccess(retryResponse);
                }
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
                        
                        // Notify the app with correct parameter structure
                        if (window.icbAgent) {
                            const authResponse = {
                                account: this.account,
                                accessToken: this.accessToken,
                                isAuthenticated: this.isAuthenticated
                            };
                            window.icbAgent.onAuthenticationSuccess(authResponse, this.tenantDomain);
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
        
        // Notify the app with the correct parameter structure
        if (window.icbAgent) {
            // The app expects (authResponse, tenantDomain) as separate parameters
            const authResponse = {
                account: this.account,
                accessToken: this.accessToken,
                isAuthenticated: this.isAuthenticated,
                expiresOn: response.expiresOn
            };
            window.icbAgent.onAuthenticationSuccess(authResponse, this.tenantDomain);
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