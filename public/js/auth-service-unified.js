/**
 * ICB Agent Unified Authentication Service
 * Single point of authentication for all webapp features
 * Consolidates permissions for main app, monthly reports, and zero trust assessment
 * Author: ICB Solutions
 */

class ICBUnifiedAuthService {
    constructor() {
        this.msalInstance = null;
        this.accessToken = null;
        this.account = null;
        this.tenantDomain = null;
        this.isAuthenticated = false;
        this.sessionId = null;
        
        // Default client configuration
        this.clientConfig = {
            clientId: null,
            authority: null,
            redirectUri: this.getRedirectUri()
        };

        // Consolidated permissions for ALL webapp features (validated Microsoft Graph permissions only)
        this.allRequiredScopes = [
            // Core User & Directory Access
            "User.Read.All",
            "Directory.Read.All",
            "Group.Read.All",
            
            // Authentication & Identity
            "UserAuthenticationMethod.Read.All",
            
            // Security & Compliance (using valid scopes)
            "SecurityEvents.Read.All",
            
            // Device Management (Intune) - Zero Trust
            "DeviceManagementApps.Read.All",
            "DeviceManagementConfiguration.Read.All",
            "DeviceManagementManagedDevices.Read.All",
            "DeviceManagementServiceConfig.Read.All",
            
            // Policies & Conditional Access
            "Policy.Read.All",
            
            // Applications & Service Principals
            "Application.Read.All",
            
            // Audit & Reports
            "AuditLog.Read.All",
            "Reports.Read.All",
            
            // Domains & Organization  
            "Domain.Read.All",
            "Organization.Read.All",
            
            // Role Management
            "RoleManagement.Read.Directory"
        ];

        console.log('🔧 ICB Unified Auth Service initialized with consolidated permissions');
        
        // Initialize on construction
        this.initialize();
    }

    /**
     * Initialize the authentication service
     */
    async initialize() {
        try {
            // Check for authentication errors in URL first
            if (this.checkForAuthenticationError()) {
                return; // Error handling will clear state and reload
            }
            
            // Check if we have auth parameters immediately upon initialization
            const hasAuthParams = window.location.hash.includes('code=') || window.location.search.includes('code=');
            if (hasAuthParams) {
                console.log('🔍 Auth parameters detected during initialization, scheduling redirect processing...');
                // Give the main app more time to initialize before processing auth
                setTimeout(() => this.handleRedirectResponse(), 500);
            }
        } catch (error) {
            console.error('❌ Error during auth service initialization:', error);
        }
    }

    /**
     * Check for authentication errors in the URL and handle them
     */
    checkForAuthenticationError() {
        const urlParams = new URLSearchParams(window.location.hash.substring(1));
        const searchParams = new URLSearchParams(window.location.search);
        
        // Check both hash and search parameters for error
        const errorInHash = urlParams.get('error');
        const errorInSearch = searchParams.get('error');
        const error = errorInHash || errorInSearch;
        
        if (error) {
            const errorDescription = urlParams.get('error_description') || searchParams.get('error_description') || '';
            
            console.error('🚨 Authentication error detected:', {
                error: error,
                description: decodeURIComponent(errorDescription)
            });
            
            // Show user-friendly error message
            const errorMsg = this.parseAuthenticationError(error, errorDescription);
            if (window.icbAgent && typeof window.icbAgent.showError === 'function') {
                window.icbAgent.showError(`Authentication failed: ${errorMsg}`);
            } else {
                alert(`Authentication failed: ${errorMsg}`);
            }
            
            // Clear authentication state and URL
            this.forceResetAuthentication();
            return true;
        }
        
        return false;
    }

    /**
     * Parse authentication error into user-friendly message
     */
    parseAuthenticationError(error, errorDescription) {
        if (error === 'invalid_client') {
            if (errorDescription.includes('AADSTS650053')) {
                return 'Invalid permission scope requested. The application permissions have been updated.';
            }
            return 'Invalid application configuration. Please contact support.';
        } else if (error === 'access_denied') {
            return 'Access denied. Please ensure you have the required permissions.';
        } else if (error === 'consent_required') {
            return 'Administrator consent required for this application.';
        } else {
            return `${error}: ${decodeURIComponent(errorDescription)}`;
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
     * Get client ID for the application
     */
    getClientId() {
        // Try to get from localStorage first (user configuration)
        const storedClientId = localStorage.getItem('msalClientId');
        if (storedClientId && storedClientId !== 'your-app-registration-id-here') {
            return storedClientId;
        }
        
        // ICB Solutions App Registration - Multi-tenant Microsoft 365 Management Platform
        return 'e18ea8f1-5bc5-4710-bb54-aced2112724c';
    }

    /**
     * Initialize MSAL with common Microsoft endpoint and consolidated permissions
     */
    async initializeAuthentication() {
        try {
            console.log('🚀 Initializing unified Microsoft authentication...');
            
            if (typeof msal === 'undefined') {
                throw new Error('MSAL library not loaded. Please check your internet connection.');
            }

            const clientId = this.getClientId();
            console.log('🔑 Using client ID:', clientId);

            // Configure MSAL with common endpoint - allows any Microsoft tenant
            this.clientConfig = {
                auth: {
                    clientId: clientId,
                    authority: 'https://login.microsoftonline.com/common',
                    redirectUri: this.getRedirectUri()
                },
                cache: {
                    cacheLocation: 'localStorage',
                    storeAuthStateInCookie: false
                },
                system: {
                    loggerOptions: {
                        loggerCallback: (level, message, containsPii) => {
                            console.log(`🔐 MSAL: ${message}`);
                        },
                        logLevel: 'Info'
                    }
                }
            };

            this.msalInstance = new msal.PublicClientApplication(this.clientConfig);
            await this.msalInstance.initialize();

            console.log('✅ MSAL initialized successfully with unified permissions');

            // Handle redirect response if we're returning from authentication
            await this.handleRedirectResponse();

        } catch (error) {
            console.error('❌ Failed to initialize unified MSAL:', error);
            throw new Error(`Unified authentication initialization failed: ${error.message}`);
        }
    }

    /**
     * Handle authentication redirect response
     * Called when returning from Microsoft login page
     */
    async handleRedirectResponse() {
        try {
            console.log('🔄 Processing authentication redirect response...');
            
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

            if (response) {
                // Successful authentication
                console.log('✅ Redirect authentication successful');
                
                return this.handleAuthSuccess(response);
            } else if (hasAuthCode && hasState) {
                // MSAL didn't detect auth parameters but they exist - force a retry
                console.log('⚠️ MSAL missed auth parameters, manually handling...');
                console.log('🔄 Attempting MSAL retry with current URL...');
                
                // Give MSAL another chance to process
                setTimeout(async () => {
                    const retryResponse = await this.msalInstance.handleRedirectPromise();
                    console.log('🔍 MSAL retry response:', retryResponse);
                    
                    if (retryResponse) {
                        return this.handleAuthSuccess(retryResponse);
                    } else {
                        // Manual fallback - check if user is already authenticated
                        const accounts = this.msalInstance.getAllAccounts();
                        console.log('👥 Available accounts after retry:', accounts);
                        
                        if (accounts && accounts.length > 0) {
                            this.isAuthenticated = true;
                            this.account = accounts[0];
                            this.tenantDomain = this.extractTenantDomain(this.account.username);
                            
                            // Try to get a token silently to validate the session
                            try {
                                const silentRequest = {
                                    scopes: ["User.Read"],
                                    account: this.account
                                };
                                
                                const tokenResponse = await this.msalInstance.acquireTokenSilent(silentRequest);
                                this.accessToken = tokenResponse.accessToken;
                                this.saveAuthState();
                                
                                // Notify the main app
                                if (window.icbAgent && typeof window.icbAgent.onAuthenticationSuccess === 'function') {
                                    const authResponse = {
                                        account: this.account,
                                        accessToken: this.accessToken,
                                        isAuthenticated: this.isAuthenticated
                                    };
                                    window.icbAgent.onAuthenticationSuccess(authResponse, this.tenantDomain);
                                }
                                
                                console.log('✅ Session restored with silent token acquisition');
                                return { success: true, account: this.account };
                                
                            } catch (tokenError) {
                                console.log('ℹ️ Silent token acquisition failed, user needs to re-authenticate');
                                this.isAuthenticated = false;
                            }
                        } else {
                            console.log('ℹ️ No existing authentication found');
                            this.isAuthenticated = false;
                        }
                    }
                }, 1000);
            } else {
                console.log('ℹ️ No authentication parameters found in URL');
            }

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
            console.log('🔐 Starting unified redirect authentication...');
            
            if (!this.msalInstance) {
                throw new Error('MSAL not initialized. Call initializeAuthentication first.');
            }

            const loginRequest = {
                scopes: this.allRequiredScopes,
                prompt: 'select_account'
            };

            // Try silent authentication first
            const accounts = this.msalInstance.getAllAccounts();
            if (accounts && accounts.length > 0) {
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

        } catch (error) {
            console.error('❌ Authentication failed:', error);
            throw error;
        }
    }

    /**
     * Handle successful authentication
     */
    async handleAuthSuccess(response) {
        try {
            this.account = response.account;
            this.accessToken = response.accessToken;
            this.isAuthenticated = true;
            this.tenantDomain = this.extractTenantDomain(response.account.username);
            this.generateSessionId();

            console.log('✅ Unified authentication successful for tenant:', this.tenantDomain);
            console.log('🎫 Consolidated permissions granted:', response.scopes);

            // Save authentication state
            this.saveAuthState();

            console.log('🔗 Attempting to notify main application...');
            console.log('🔍 window.icbAgent available:', !!window.icbAgent);
            console.log('🔍 onAuthenticationSuccess method available:', 
                window.icbAgent && typeof window.icbAgent.onAuthenticationSuccess === 'function');

            // Notify the main application with retry mechanism
            let notificationAttempts = 0;
            const maxAttempts = 10;
            
            const attemptNotification = async () => {
                if (window.icbAgent && typeof window.icbAgent.onAuthenticationSuccess === 'function') {
                    console.log('📢 Calling main app authentication success handler...');
                    try {
                        await window.icbAgent.onAuthenticationSuccess(response, this.tenantDomain);
                        console.log('✅ Main app notified successfully');
                        return true;
                    } catch (error) {
                        console.error('❌ Error calling main app handler:', error);
                    }
                }
                return false;
            };

            // Try immediate notification
            const immediateSuccess = await attemptNotification();
            
            if (!immediateSuccess) {
                console.warn('⚠️ Main app not ready - setting up retry mechanism...');
                
                // Retry mechanism with polling
                const retryInterval = setInterval(async () => {
                    notificationAttempts++;
                    console.log(`🔄 Retry attempt ${notificationAttempts}/${maxAttempts} to notify main app...`);
                    
                    const success = await attemptNotification();
                    
                    if (success || notificationAttempts >= maxAttempts) {
                        clearInterval(retryInterval);
                        
                        if (!success) {
                            console.warn('⚠️ Max notification attempts reached - using fallback methods...');
                            
                            // Alternative: Dispatch custom event
                            const authEvent = new CustomEvent('icbAuthSuccess', {
                                detail: {
                                    authResponse: response,
                                    tenantDomain: this.tenantDomain,
                                    sessionId: this.sessionId
                                }
                            });
                            window.dispatchEvent(authEvent);
                            console.log('📡 Dispatched custom authentication event as fallback');
                            
                            // Also try to update connection status directly if possible
                            if (window.icbAgent && typeof window.icbAgent.updateConnectionStatus === 'function') {
                                console.log('🔄 Updating connection status directly...');
                                window.icbAgent.updateConnectionStatus('connected', this.tenantDomain);
                            }
                        }
                    }
                }, 200); // Check every 200ms
            }

            // Clean URL from auth parameters
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);

            return {
                success: true,
                account: this.account,
                accessToken: this.accessToken,
                tenantDomain: this.tenantDomain,
                sessionId: this.sessionId
            };

        } catch (error) {
            console.error('❌ Error handling auth success:', error);
            throw error;
        }
    }

    /**
     * Get access token for API calls
     */
    async getAccessToken(specificScopes = null) {
        try {
            if (!this.isAuthenticated || !this.msalInstance) {
                throw new Error('Not authenticated. Please authenticate first.');
            }

            const scopes = specificScopes || this.allRequiredScopes;
            const account = this.account || this.msalInstance.getAllAccounts()[0];

            if (!account) {
                throw new Error('No account found. Please authenticate.');
            }

            const silentRequest = {
                scopes: scopes,
                account: account
            };

            const response = await this.msalInstance.acquireTokenSilent(silentRequest);
            this.accessToken = response.accessToken;
            
            return response.accessToken;

        } catch (error) {
            console.error('❌ Failed to get access token:', error);
            
            // If silent token acquisition fails, trigger re-authentication
            if (error.name === 'InteractionRequiredAuthError') {
                console.log('🔄 Token expired, triggering re-authentication...');
                await this.authenticate();
                return this.getAccessToken(specificScopes);
            }
            
            throw error;
        }
    }

    /**
     * Sign out the current user
     */
    async signOut() {
        try {
            console.log('🚪 Signing out...');

            if (this.msalInstance) {
                const account = this.account || this.msalInstance.getAllAccounts()[0];
                if (account) {
                    await this.msalInstance.logoutRedirect({
                        account: account
                    });
                }
            }

            // Clear local state
            this.clearAuthState();

            // Notify main app
            if (window.icbAgent && typeof window.icbAgent.onSignOut === 'function') {
                window.icbAgent.onSignOut();
            }

        } catch (error) {
            console.error('❌ Error during sign out:', error);
            // Clear state anyway
            this.clearAuthState();
        }
    }

    /**
     * Extract tenant domain from username
     */
    extractTenantDomain(username) {
        if (!username) return null;
        
        const domain = username.split('@')[1];
        return domain || null;
    }

    /**
     * Generate a unique session ID
     */
    generateSessionId() {
        this.sessionId = 'icb_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        return this.sessionId;
    }

    /**
     * Save authentication state to localStorage
     */
    saveAuthState() {
        try {
            localStorage.setItem('icb_unified_auth', JSON.stringify({
                isAuthenticated: this.isAuthenticated,
                tenantDomain: this.tenantDomain,
                sessionId: this.sessionId,
                accountId: this.account?.homeAccountId,
                username: this.account?.username,
                timestamp: Date.now()
            }));
            
            // Also save individual items for backward compatibility
            if (this.sessionId) localStorage.setItem('icb_session', this.sessionId);
            if (this.tenantDomain) localStorage.setItem('icb_tenant', this.tenantDomain);
            
        } catch (error) {
            console.error('❌ Error saving auth state:', error);
        }
    }

    /**
     * Load authentication state from localStorage
     */
    loadAuthState() {
        try {
            const savedState = localStorage.getItem('icb_unified_auth');
            if (savedState) {
                const state = JSON.parse(savedState);
                
                // Check if state is recent (within 24 hours)
                const stateAge = Date.now() - (state.timestamp || 0);
                if (stateAge < 24 * 60 * 60 * 1000) {
                    this.isAuthenticated = state.isAuthenticated;
                    this.tenantDomain = state.tenantDomain;
                    this.sessionId = state.sessionId;
                    
                    console.log('📋 Unified auth state restored:', {
                        tenant: this.tenantDomain,
                        session: this.sessionId
                    });
                    
                    return true;
                }
            }
        } catch (error) {
            console.error('❌ Error loading auth state:', error);
        }
        
        return false;
    }

    /**
     * Clear authentication state
     */
    clearAuthState() {
        this.isAuthenticated = false;
        this.accessToken = null;
        this.account = null;
        this.tenantDomain = null;
        this.sessionId = null;

        // Clear localStorage
        try {
            localStorage.removeItem('icb_unified_auth');
            localStorage.removeItem('icb_session');
            localStorage.removeItem('icb_tenant');
            localStorage.removeItem('icb_authenticated');
            localStorage.removeItem('icb_user');
            
            // Clear any MSAL cache
            if (this.msalInstance) {
                const accounts = this.msalInstance.getAllAccounts();
                accounts.forEach(account => {
                    this.msalInstance.getTokenCache().removeAccount(account);
                });
            }
            
        } catch (error) {
            console.error('❌ Error clearing auth state:', error);
        }
    }

    /**
     * Force clear all authentication data and reload page
     */
    forceResetAuthentication() {
        console.log('🔄 Force resetting authentication...');
        
        // Clear all authentication state
        this.clearAuthState();
        
        // Clear URL parameters that might contain error states
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
        
        // Reload the page to start fresh
        window.location.reload();
    }

    /**
     * Check if user is authenticated
     */
    isUserAuthenticated() {
        return this.isAuthenticated && this.accessToken && this.account;
    }

    /**
     * Get current tenant domain
     */
    getCurrentTenant() {
        return this.tenantDomain;
    }

    /**
     * Get current session ID
     */
    getSessionId() {
        return this.sessionId;
    }

    /**
     * Get current account information
     */
    getCurrentAccount() {
        return this.account;
    }
}

// Create global instance for unified authentication
window.icbUnifiedAuth = new ICBUnifiedAuthService();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ICBUnifiedAuthService;
}