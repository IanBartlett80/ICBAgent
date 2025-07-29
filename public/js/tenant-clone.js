// Tenant Clone JavaScript Implementation
class TenantCloneManager {
    constructor() {
        this.socket = null;
        this.sessionId = null;
        this.sourceTenant = null;
        this.targetTenant = null;
        this.policies = new Map();
        this.selectedPolicies = new Set();
        this.isConnected = false;
        this.authStatus = {
            source: 'pending',
            target: 'pending'
        };
        this.migrationLog = [];
        this.currentClonePolicy = null; // Track current policy being cloned for retry
        this.currentPage = 'connectionPage'; // Track current page
        
        this.init();
    }

    init() {
        this.initializeSocket();
        this.bindEvents();
        this.initializeDragAndDrop();
        this.logMessage('system', 'Tenant Clone interface initialized');
        this.showPage('connectionPage'); // This will map to connectionSection
    }

    // Page Navigation System
    showPage(pageId) {
        console.log(`📄 Navigating to page: ${pageId}`);
        console.log(`📄 Current page before navigation: ${this.currentPage}`);
        
        // Map page IDs to section IDs for backwards compatibility
        const pageToSectionMap = {
            'connectionPage': 'connectionSection',
            'authenticationPage': 'authSection', 
            'migrationPage': 'policySection'
        };
        
        const sectionId = pageToSectionMap[pageId] || pageId;
        console.log(`📄 Mapped ${pageId} to section: ${sectionId}`);
        
        // Hide all sections
        const sections = document.querySelectorAll('section[id$="Section"]');
        console.log(`📄 Found ${sections.length} sections`);
        sections.forEach(section => {
            section.style.display = 'none';
            console.log(`📄 Hiding section: ${section.id}`);
        });

        // Show target section
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.style.display = 'block';
            this.currentPage = pageId;
            this.updateBreadcrumb(pageId);
            console.log(`📄 Successfully navigated to: ${pageId} (section: ${sectionId})`);
        } else {
            console.error(`📄 Target section not found: ${sectionId}`);
        }
    }

    updateBreadcrumb(pageId) {
        // Update breadcrumb navigation
        const breadcrumbItems = document.querySelectorAll('.breadcrumb-item');
        breadcrumbItems.forEach(item => {
            item.classList.remove('active');
            if (item.dataset.page === pageId) {
                item.classList.add('active');
            }
        });
    }

    navigateToPage(pageId) {
        // Navigation with validation
        if (pageId === 'authenticationPage' && !this.validateConnectionInput()) {
            this.showError('Please enter both source and target tenant domains before proceeding.');
            return;
        }

        if (pageId === 'migrationPage' && (this.authStatus.source !== 'authenticated' || this.authStatus.target !== 'authenticated')) {
            this.showError('Both tenants must be authenticated before accessing the migration dashboard.');
            return;
        }

        this.showPage(pageId);

        // Trigger specific page initialization
        if (pageId === 'authenticationPage') {
            this.startAuthentication();
        } else if (pageId === 'migrationPage') {
            this.initializeMigrationDashboard();
        }
    }

    initializeSocket() {
        this.socket = io();
        
        // Generate session ID
        this.sessionId = this.generateSessionId();
        
        // Join session
        this.socket.emit('join_session', this.sessionId);
        
        // Socket event listeners
        this.socket.on('dual_tenant_initialized', (data) => {
            this.handleDualTenantInitialized(data);
        });

        this.socket.on('dual_tenant_status', (data) => {
            this.handleDualTenantStatus(data);
        });

        this.socket.on('dual_tenant_error', (data) => {
            this.handleDualTenantError(data);
        });

        this.socket.on('source_policies_loaded', (data) => {
            this.handleSourcePoliciesLoaded(data);
        });

        this.socket.on('source_policies_error', (data) => {
            this.handleSourcePoliciesError(data);
        });

        this.socket.on('policy_cloned', (data) => {
            this.handlePolicyCloned(data);
        });

        this.socket.on('policy_clone_failed', (data) => {
            this.handlePolicyCloneFailed(data);
        });

        this.socket.on('policy_clone_permission_required', (data) => {
            this.handlePolicyClonePermissionRequired(data);
        });

        this.socket.on('permissions_requested', (data) => {
            this.handlePermissionsRequested(data);
        });

        this.socket.on('permission_request_failed', (data) => {
            this.handlePermissionRequestFailed(data);
        });

        this.socket.on('auth_status_changed', (data) => {
            this.handleAuthStatusChanged(data);
        });
    }

    bindEvents() {
        // Back to main button
        const backBtn = document.getElementById('backToMainBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                window.location.href = '/';
            });
        }

        // Page navigation buttons
        const startSetupBtn = document.getElementById('startSetupBtn');
        if (startSetupBtn) {
            startSetupBtn.addEventListener('click', () => {
                this.navigateToPage('authenticationPage');
            });
        }

        const proceedToDashboardBtn = document.getElementById('proceedToDashboardBtn');
        if (proceedToDashboardBtn) {
            proceedToDashboardBtn.addEventListener('click', () => {
                this.navigateToPage('migrationPage');
            });
        }

        // Breadcrumb navigation
        const breadcrumbItems = document.querySelectorAll('.breadcrumb-item[data-page]');
        breadcrumbItems.forEach(item => {
            item.addEventListener('click', () => {
                const pageId = item.dataset.page;
                if (pageId) {
                    this.navigateToPage(pageId);
                }
            });
        });

        // Connect tenants button (legacy - now handled in authentication page)
        const connectBtn = document.getElementById('connectTenantsBtn');
        if (connectBtn) {
            connectBtn.addEventListener('click', () => {
                this.connectTenants();
            });
        }

        // Load policies button
        const loadBtn = document.getElementById('loadPoliciesBtn');
        if (loadBtn) {
            loadBtn.addEventListener('click', () => {
                this.loadSourcePolicies();
            });
        }

        // Bulk migrate button
        const bulkBtn = document.getElementById('bulkMigrateBtn');
        if (bulkBtn) {
            bulkBtn.addEventListener('click', () => {
                this.bulkMigratePolicies();
            });
        }

        // Search functionality
        const searchInput = document.getElementById('policySearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterPolicies(e.target.value);
            });
        }

        // Policy type filter
        const typeFilter = document.getElementById('policyTypeFilter');
        if (typeFilter) {
            typeFilter.addEventListener('change', (e) => {
                this.filterPoliciesByType(e.target.value);
            });
        }

        // Clear log button
        const clearLogBtn = document.getElementById('clearLogBtn');
        if (clearLogBtn) {
            clearLogBtn.addEventListener('click', () => {
                this.clearLog();
            });
        }

        // Modal events
        const closeModalBtn = document.getElementById('closeCloneModalBtn');
        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => {
                this.closeCloneModal();
            });
        }

        const cancelBtn = document.getElementById('cancelCloneBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                this.closeCloneModal();
            });
        }

        const confirmBtn = document.getElementById('confirmCloneBtn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                this.confirmPolicyClone();
            });
        }

        // Policy details modal events
        const policyModal = document.getElementById('policyDetailsModal');
        if (policyModal) {
            const closePolicyModalBtn = policyModal.querySelector('.modal-close');
            if (closePolicyModalBtn) {
                closePolicyModalBtn.addEventListener('click', () => {
                    this.closePolicyDetailsModal();
                });
            }

            // Tab navigation
            const tabBtns = policyModal.querySelectorAll('.tab-btn');
            tabBtns.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    this.switchPolicyTab(e.target.dataset.tab);
                });
            });

            // Clone from modal
            const cloneFromModalBtn = policyModal.querySelector('#clonePolicyFromModal');
            if (cloneFromModalBtn) {
                cloneFromModalBtn.addEventListener('click', () => {
                    const policyId = policyModal.dataset.policyId;
                    this.closePolicyDetailsModal();
                    this.showCloneModal(policyId);
                });
            }
        }

        // Close modal on overlay click
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                if (e.target.id === 'cloneModalOverlay') {
                    this.closeCloneModal();
                } else if (e.target.id === 'policyDetailsModal') {
                    this.closePolicyDetailsModal();
                }
            }
        });

        // Escape key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeCloneModal();
                this.closePolicyDetailsModal();
            }
        });

        // Input validation
        const sourceDomainInput = document.getElementById('sourceTenantDomain');
        if (sourceDomainInput) {
            sourceDomainInput.addEventListener('input', (e) => {
                this.validateTenantDomain(e.target, 'source');
            });
        }

        const targetDomainInput = document.getElementById('targetTenantDomain');
        if (targetDomainInput) {
            targetDomainInput.addEventListener('input', (e) => {
                this.validateTenantDomain(e.target, 'target');
            });
        }

        // Policy card click handlers (will be bound dynamically when policies are loaded)
        this.bindPolicyCardEvents();
    }

    generateSessionId() {
        return 'tenant-clone-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
    }

    async connectTenants() {
        const sourceInput = document.getElementById('sourceTenantDomain');
        const targetInput = document.getElementById('targetTenantDomain');
        const connectBtn = document.getElementById('connectTenantsBtn');

        this.sourceTenant = sourceInput.value.trim();
        this.targetTenant = targetInput.value.trim();

        if (!this.sourceTenant || !this.targetTenant) {
            this.showError('Both source and target tenant domains are required');
            return;
        }

        if (this.sourceTenant === this.targetTenant) {
            this.showError('Source and target tenants must be different');
            return;
        }

        if (!this.isValidDomain(this.sourceTenant) || !this.isValidDomain(this.targetTenant)) {
            this.showError('Please enter valid tenant domain names');
            return;
        }

        // Show loading state
        this.setButtonLoading(connectBtn, true);
        this.logMessage('system', `Connecting to tenants: ${this.sourceTenant} → ${this.targetTenant}`);

        try {
            // Initialize dual tenant connection
            this.socket.emit('dual_tenant_init', {
                sessionId: this.sessionId,
                sourceTenant: this.sourceTenant,
                targetTenant: this.targetTenant
            });

            // Show authentication progress
            this.showAuthProgress();

        } catch (error) {
            console.error('Error connecting tenants:', error);
            this.showError('Failed to connect to tenants: ' + error.message);
            this.setButtonLoading(connectBtn, false);
        }
    }

    // New page-specific methods
    validateConnectionInput() {
        const sourceInput = document.getElementById('sourceTenantDomain');
        const targetInput = document.getElementById('targetTenantDomain');
        
        if (!sourceInput || !targetInput) return false;
        
        const sourceDomain = sourceInput.value.trim();
        const targetDomain = targetInput.value.trim();
        
        return sourceDomain && targetDomain && 
               sourceDomain !== targetDomain && 
               this.isValidDomain(sourceDomain) && 
               this.isValidDomain(targetDomain);
    }

    startAuthentication() {
        // Get the tenant domains from the connection page
        const sourceInput = document.getElementById('sourceTenantDomain');
        const targetInput = document.getElementById('targetTenantDomain');
        
        if (!sourceInput || !targetInput) return;
        
        this.sourceTenant = sourceInput.value.trim();
        this.targetTenant = targetInput.value.trim();
        
        // Update the authentication page with tenant info
        this.updateAuthenticationPage();
        
        // Start the connection process
        this.connectTenants();
    }

    updateAuthenticationPage() {
        // Update source tenant info
        const sourceTitle = document.querySelector('.tenant-status-card.source .tenant-status-title');
        const sourceDomain = document.querySelector('.tenant-status-card.source .tenant-status-domain');
        if (sourceTitle) sourceTitle.textContent = 'Source Tenant';
        if (sourceDomain) sourceDomain.textContent = this.sourceTenant;

        // Update target tenant info
        const targetTitle = document.querySelector('.tenant-status-card.target .tenant-status-title');
        const targetDomainEl = document.querySelector('.tenant-status-card.target .tenant-status-domain');
        if (targetTitle) targetTitle.textContent = 'Target Tenant';
        if (targetDomainEl) targetDomainEl.textContent = this.targetTenant;

        // Set initial status
        this.updateTenantAuthStatus('source', 'authenticating');
        this.updateTenantAuthStatus('target', 'authenticating');
    }

    updateTenantAuthStatus(tenant, status) {
        const card = document.querySelector(`.tenant-status-card.${tenant}`);
        if (!card) return;

        const icon = card.querySelector('.tenant-status-icon');
        const message = card.querySelector('.tenant-status-message');

        // Remove existing status classes
        card.classList.remove('authenticated', 'authenticating', 'pending');
        icon.classList.remove('authenticating');
        message.classList.remove('authenticated', 'authenticating', 'pending');

        // Add new status classes
        card.classList.add(status);
        message.classList.add(status);

        // Update message text and icon
        switch (status) {
            case 'authenticated':
                message.textContent = '✓ Successfully Authenticated';
                icon.innerHTML = '<i class="fas fa-check"></i>';
                break;
            case 'authenticating':
                message.textContent = 'Authenticating...';
                icon.innerHTML = '<i class="fas fa-spinner"></i>';
                icon.classList.add('authenticating');
                break;
            case 'pending':
                message.textContent = 'Waiting to authenticate';
                icon.innerHTML = '<i class="fas fa-clock"></i>';
                break;
            case 'error':
                message.textContent = 'Authentication failed';
                icon.innerHTML = '<i class="fas fa-times"></i>';
                card.classList.add('error');
                message.classList.add('error');
                break;
        }
    }

    initializeMigrationDashboard() {
        console.log('🏗️ Initializing migration dashboard');
        console.log('🏗️ Current page:', this.currentPage);
        console.log('🏗️ Policies loaded:', this.policies.size);
        
        // Update dashboard with tenant information
        const sourcePanelDomain = document.querySelector('.tenant-panel.source .panel-domain');
        const targetPanelDomain = document.querySelector('.tenant-panel.target .panel-domain');
        
        if (sourcePanelDomain) sourcePanelDomain.textContent = this.sourceTenant;
        if (targetPanelDomain) targetPanelDomain.textContent = this.targetTenant;

        // Load policies if not already loaded
        if (this.policies.size === 0) {
            console.log('🏗️ Loading policies for migration dashboard');
            this.loadSourcePolicies();
        } else {
            console.log('🏗️ Policies already loaded, rendering panels');
            this.renderPolicyPanels();
        }
    }

    renderPolicyPanels() {
        const sourcePolicyList = document.querySelector('.tenant-panel.source .policy-list');
        const sourceStatsValue = document.querySelector('.tenant-panel.source .stat-value');
        
        if (!sourcePolicyList) return;

        // Clear existing policies
        sourcePolicyList.innerHTML = '';

        // Update stats
        if (sourceStatsValue) {
            sourceStatsValue.textContent = this.policies.size;
        }

        // Render policy items
        this.policies.forEach((policy, policyId) => {
            const policyItem = this.createPolicyListItem(policy, policyId);
            sourcePolicyList.appendChild(policyItem);
        });
    }

    createPolicyListItem(policy, policyId) {
        const item = document.createElement('div');
        item.className = 'policy-item';
        item.dataset.policyId = policyId;

        item.innerHTML = `
            <div class="policy-info">
                <div class="policy-name">${policy.displayName || policy.name || 'Unnamed Policy'}</div>
                <div class="policy-type">${this.getPolicyTypeLabel(policy['@odata.type'])}</div>
            </div>
            <div class="policy-actions">
                <button class="action-btn view" onclick="tenantClone.showPolicyDetails('${policyId}')" title="View Details">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="action-btn clone" onclick="tenantClone.showCloneModal('${policyId}')" title="Clone Policy">
                    <i class="fas fa-copy"></i>
                </button>
            </div>
        `;

        return item;
    }

    async loadSourcePolicies() {
        console.log('🔍 loadSourcePolicies called');
        console.log('🔍 isConnected:', this.isConnected);
        console.log('🔍 sessionId:', this.sessionId);
        console.log('🔍 sourceTenant:', this.sourceTenant);
        console.log('🔍 targetTenant:', this.targetTenant);
        
        if (!this.isConnected) {
            this.showError('Please connect to both tenants first');
            return;
        }

        const loadBtn = document.getElementById('loadPoliciesBtn');
        this.setButtonLoading(loadBtn, true);
        this.logMessage('system', 'Loading policies from source tenant...');

        try {
            console.log('🚀 Emitting load_source_policies event with sessionId:', this.sessionId);
            this.socket.emit('load_source_policies', {
                sessionId: this.sessionId
            });

        } catch (error) {
            console.error('Error loading source policies:', error);
            this.showError('Failed to load source policies: ' + error.message);
            this.setButtonLoading(loadBtn, false);
        }
    }

    async clonePolicy(policyId, policyType, customizations = {}) {
        if (!this.isConnected) {
            this.showError('Please connect to both tenants first');
            return;
        }

        // Store current clone policy for potential retry after permission request
        this.currentClonePolicy = { policyId, policyType, customizations };

        this.logMessage('system', `Starting clone of policy: ${policyId}`);

        try {
            this.socket.emit('clone_policy', {
                sessionId: this.sessionId,
                policyId: policyId,
                policyType: policyType,
                customizations: customizations
            });

            // Add to migration progress
            this.addMigrationProgress(policyId, policyType, 'pending');

        } catch (error) {
            console.error('Error cloning policy:', error);
            this.showError('Failed to clone policy: ' + error.message);
            this.currentClonePolicy = null; // Clear on error
        }
    }

    bulkMigratePolicies() {
        if (this.selectedPolicies.size === 0) {
            this.showError('Please select at least one policy to migrate');
            return;
        }

        const bulkBtn = document.getElementById('bulkMigrateBtn');
        this.setButtonLoading(bulkBtn, true);

        this.logMessage('system', `Starting bulk migration of ${this.selectedPolicies.size} policies`);

        // Clone each selected policy
        for (const policyId of this.selectedPolicies) {
            const policy = this.findPolicyById(policyId);
            if (policy) {
                this.clonePolicy(policyId, policy.policyType);
            }
        }

        // Clear selection after starting migration
        this.selectedPolicies.clear();
        this.updateBulkMigrateButton();
        this.setButtonLoading(bulkBtn, false);
    }

    // Event Handlers
    handleDualTenantInitialized(data) {
        console.log('🏁 Dual tenant initialized:', data);
        console.log('🏁 Current authStatus before update:', this.authStatus);
        
        this.updateConnectionStatus(data.status);
        
        // If both tenants are already authenticated locally, ensure UI is updated
        if (this.authStatus.source === 'authenticated' && this.authStatus.target === 'authenticated') {
            console.log('🏁 Both tenants already authenticated locally - triggering checkBothTenantsAuthenticated');
            this.checkBothTenantsAuthenticated();
        }
    }

    handleDualTenantStatus(data) {
        console.log('Dual tenant status:', data);
        this.updateConnectionStatus(data);
        
        if (data.type === 'source_initialized') {
            this.updateTenantStatus('source', 'connecting');
        } else if (data.type === 'target_initialized') {
            this.updateTenantStatus('target', 'connecting');
        }
    }

    handleDualTenantError(data) {
        console.error('Dual tenant error:', data);
        this.showError(`Connection error: ${data.error}`);
        this.logMessage('error', `Connection failed: ${data.error}`);
        
        // Reset UI state
        this.hideAuthProgress();
        this.setButtonLoading(document.getElementById('connectTenantsBtn'), false);
    }

    handleSourcePoliciesLoaded(data) {
        console.log('Source policies loaded:', data);
        this.policies.clear();
        
        // Process policies by type
        for (const [policyType, policyList] of Object.entries(data.policies)) {
            for (const policy of policyList) {
                policy.policyType = policyType;
                this.policies.set(policy.id, policy);
            }
        }

        this.renderSourcePolicies();
        this.updatePolicyCount(data.count);
        this.setButtonLoading(document.getElementById('loadPoliciesBtn'), false);
        this.logMessage('success', `Loaded ${data.count} policies from source tenant`);
        
        // Update the new dashboard panels
        this.renderPolicyPanels();
    }

    handleSourcePoliciesError(data) {
        console.error('Error loading source policies:', data);
        this.setButtonLoading(document.getElementById('loadPoliciesBtn'), false);
        this.logMessage('error', `Failed to load policies: ${data.error}`);
        this.showError('Failed to load source policies: ' + data.error);
    }

    handlePolicyCloned(data) {
        console.log('Policy cloned successfully:', data);
        this.logMessage('success', `Successfully cloned: ${data.policyName}`);
        this.updateMigrationProgress(data.migrationId, 'success', data.policyName);
        this.incrementMigrationCount();
        
        // Clear current clone policy on success
        this.currentClonePolicy = null;
    }

    handlePolicyCloneFailed(data) {
        console.error('Policy clone failed:', data);
        this.logMessage('error', `Failed to clone policy ${data.policyId}: ${data.error}`);
        this.updateMigrationProgress(data.migrationId, 'error', data.error);
        
        // Clear current clone policy on failure (non-permission related)
        this.currentClonePolicy = null;
    }

    handlePolicyClonePermissionRequired(data) {
        console.warn('Policy clone requires additional permissions:', data);
        this.logMessage('warning', `Policy clone requires additional permissions: ${data.message}`);
        this.updateMigrationProgress(data.migrationId, 'permission_required', data.error);
        
        // Show permission request dialog
        this.showPermissionDialog(data.tenantDomain, data.error);
    }

    handlePermissionsRequested(data) {
        console.log('Additional permissions requested:', data);
        this.logMessage('system', `Additional permissions requested for ${data.tenantRole} tenant (${data.tenantDomain})`);
        this.logMessage('system', `Required scopes: ${data.requiredScopes.join(', ')}`);
        this.logMessage('system', data.message);
        
        // Show authentication prompt
        this.showAuthenticationPrompt(data);
    }

    handlePermissionRequestFailed(data) {
        console.error('Permission request failed:', data);
        this.logMessage('error', `Failed to request additional permissions for ${data.tenantRole} tenant: ${data.error}`);
        this.logMessage('error', data.message);
    }

    handleAuthStatusChanged(data) {
        console.log('Auth status changed:', data);
        
        // Determine which tenant this is for based on tenantRole, message, or domain
        let tenantType;
        if (data.tenantRole) {
            tenantType = data.tenantRole; // 'source' or 'target'
        } else {
            // Fallback logic for backwards compatibility
            const isSource = data.message?.includes('source') || data.tenantDomain === this.sourceTenant;
            tenantType = isSource ? 'source' : 'target';
        }
        
        if (data.status === 'authenticated') {
            this.authStatus[tenantType] = 'authenticated';
            this.updateAuthStatus(tenantType, 'authenticated'); // Changed from 'success' to 'authenticated'
            this.updateTenantAuthStatus(tenantType, 'authenticated');
            this.logMessage('success', `${tenantType} tenant (${data.tenantDomain}) authenticated successfully`);
        } else if (data.status === 'needs_authentication') {
            this.authStatus[tenantType] = 'pending';
            this.updateAuthStatus(tenantType, 'pending');
            this.updateTenantAuthStatus(tenantType, 'pending');
            this.logMessage('system', `${tenantType} tenant requires authentication`);
        } else if (data.status === 'authentication_error') {
            this.authStatus[tenantType] = 'error';
            this.updateAuthStatus(tenantType, 'error');
            this.updateTenantAuthStatus(tenantType, 'error');
            this.logMessage('error', `${tenantType} tenant authentication failed`);
        }
        
        // Check if both tenants are authenticated
        this.checkBothTenantsAuthenticated();
    }

    // UI Update Methods
    updateConnectionStatus(status) {
        console.log('🔄 updateConnectionStatus called with:', status);
        console.log('🔄 Current authStatus:', this.authStatus);
        
        const statusIndicator = document.querySelector('.status-indicator');
        const statusText = document.querySelector('.connection-status span');

        // Priority check: Use local auth status if both tenants are authenticated
        const bothAuthenticatedLocally = this.authStatus.source === 'authenticated' && this.authStatus.target === 'authenticated';
        
        // Fallback check: Server-reported status
        const bothAuthenticatedServer = status?.isActive && status?.sourceTenant?.authenticated && status?.targetTenant?.authenticated;
        
        const bothAuthenticated = bothAuthenticatedLocally || bothAuthenticatedServer;

        console.log('🔄 bothAuthenticatedLocally:', bothAuthenticatedLocally);
        console.log('🔄 bothAuthenticatedServer:', bothAuthenticatedServer);
        console.log('🔄 Final bothAuthenticated:', bothAuthenticated);

        if (bothAuthenticated) {
            console.log('✅ Both tenants authenticated - updating UI');
            if (statusIndicator) statusIndicator.className = 'status-indicator connected';
            if (statusText) statusText.textContent = 'Both Tenants Connected';
            this.isConnected = true;
            this.showMigrationInterface();
            this.updateTenantCards();
        } else if (status?.isActive) {
            if (statusIndicator) statusIndicator.className = 'status-indicator connecting';
            if (statusText) statusText.textContent = 'Connecting Tenants';
        } else {
            if (statusIndicator) statusIndicator.className = 'status-indicator';
            if (statusText) statusText.textContent = 'Not Connected';
        }
    }

    updateTenantCards() {
        // Update source tenant card
        const sourceCard = document.querySelector('.tenant-card.source-card');
        if (sourceCard) {
            const badge = sourceCard.querySelector('.connection-badge');
            const info = sourceCard.querySelector('.connection-info');
            
            if (badge && this.authStatus.source === 'authenticated') {
                badge.className = 'connection-badge connected';
                badge.innerHTML = '<i class="fas fa-check"></i>';
                if (info) {
                    info.className = 'connection-info connected';
                    info.innerHTML = '<i class="fas fa-check-circle"></i> Connected';
                }
            } else if (badge && this.authStatus.source === 'connecting') {
                badge.className = 'connection-badge connecting';
                badge.innerHTML = '<i class="fas fa-spinner"></i>';
                if (info) {
                    info.className = 'connection-info';
                    info.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
                }
            } else if (badge && this.authStatus.source === 'error') {
                badge.className = 'connection-badge error';
                badge.innerHTML = '<i class="fas fa-times"></i>';
                if (info) {
                    info.className = 'connection-info error';
                    info.innerHTML = '<i class="fas fa-exclamation-circle"></i> Connection Failed';
                }
            }
        }

        // Update target tenant card
        const targetCard = document.querySelector('.tenant-card.target-card');
        if (targetCard) {
            const badge = targetCard.querySelector('.connection-badge');
            const info = targetCard.querySelector('.connection-info');
            
            if (badge && this.authStatus.target === 'authenticated') {
                badge.className = 'connection-badge connected';
                badge.innerHTML = '<i class="fas fa-check"></i>';
                if (info) {
                    info.className = 'connection-info connected';
                    info.innerHTML = '<i class="fas fa-check-circle"></i> Connected';
                }
            } else if (badge && this.authStatus.target === 'connecting') {
                badge.className = 'connection-badge connecting';
                badge.innerHTML = '<i class="fas fa-spinner"></i>';
                if (info) {
                    info.className = 'connection-info';
                    info.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
                }
            } else if (badge && this.authStatus.target === 'error') {
                badge.className = 'connection-badge error';
                badge.innerHTML = '<i class="fas fa-times"></i>';
                if (info) {
                    info.className = 'connection-info error';
                    info.innerHTML = '<i class="fas fa-exclamation-circle"></i> Connection Failed';
                }
            }
        }
    }

    updateTenantStatus(tenantType, status) {
        // Don't override a successful authentication status
        if (this.authStatus[tenantType] === 'authenticated' && status === 'connecting') {
            console.log(`Not overriding successful auth status for ${tenantType} tenant`);
            return;
        }
        
        this.authStatus[tenantType] = status;
        this.updateTenantCards();
        
        // Check if both tenants are authenticated after any status update
        this.checkBothTenantsAuthenticated();
    }

    updateAuthStatus(tenantType, status) {
        this.authStatus[tenantType] = status;
        
        const authItem = document.getElementById(`${tenantType}AuthItem`);
        if (!authItem) {
            console.log(`Auth status updated: ${tenantType} = ${status} (UI element not found)`);
            return;
        }
        
        const authStatus = authItem.querySelector('.auth-status');
        const authText = authItem.querySelector(`#${tenantType}AuthText`);

        if (authStatus) {
            authStatus.className = `auth-status ${status}`;
        }
        
        if (authText) {
            switch (status) {
                case 'authenticated':
                case 'success':
                    authText.textContent = 'Authentication successful';
                    break;
                case 'error':
                    authText.textContent = 'Authentication failed';
                    break;
                default:
                    authText.textContent = 'Waiting for authentication...';
            }
        }
    }

    checkBothTenantsAuthenticated() {
        console.log('🔍 checkBothTenantsAuthenticated called');
        console.log('🔍 Source auth status:', this.authStatus.source);
        console.log('🔍 Target auth status:', this.authStatus.target);
        
        if (this.authStatus.source === 'authenticated' && this.authStatus.target === 'authenticated') {
            console.log('✅ Both tenants authenticated - updating all UI elements');
            this.isConnected = true;
            this.logMessage('success', 'Both tenants authenticated successfully');
            
            // Update authentication page to show success and enable navigation
            const proceedBtn = document.getElementById('proceedToDashboardBtn');
            if (proceedBtn) {
                proceedBtn.style.display = 'block';
                proceedBtn.disabled = false;
                console.log('✅ Proceed button enabled');
            }

            // Update progress message
            const progressMessage = document.querySelector('.auth-progress-message');
            if (progressMessage) {
                progressMessage.textContent = 'Both tenants have been successfully authenticated. You can now proceed to the migration dashboard.';
            }

            // Update progress icon
            const progressIcon = document.querySelector('.auth-progress-icon');
            if (progressIcon) {
                progressIcon.innerHTML = '<i class="fas fa-check"></i>';
                progressIcon.style.animation = 'none';
                progressIcon.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            }

            // Update connection status UI with forced update
            const statusIndicator = document.querySelector('.status-indicator');
            const statusText = document.querySelector('.connection-status span');
            if (statusIndicator) {
                statusIndicator.className = 'status-indicator connected';
                console.log('✅ Status indicator updated to connected');
            }
            if (statusText) {
                statusText.textContent = 'Both Tenants Connected';
                console.log('✅ Status text updated');
            }

            // Auto-navigate to migration page after a short delay to show success state
            setTimeout(() => {
                console.log('🚀 Auto-navigating to migration dashboard');
                this.navigateToPage('migrationPage');
            }, 2000); // 2 second delay to show the success state

            // Legacy support for old interface
            this.hideAuthProgress();
            this.showMigrationInterface();
            this.updateTenantConnectionDisplay();
            this.updateTenantCards();
            
            console.log('✅ All UI updates completed');
        } else {
            console.log('⏳ Not both tenants authenticated yet');
        }
    }

    showAuthProgress() {
        const dualTenantSetup = document.getElementById('dualTenantSetup');
        const authProgressSection = document.getElementById('authProgressSection');
        
        if (dualTenantSetup) {
            dualTenantSetup.style.display = 'none';
        }
        if (authProgressSection) {
            authProgressSection.style.display = 'block';
        }
        
        // Show the auth section if the setup elements don't exist
        const authSection = document.getElementById('authSection');
        if (authSection && !dualTenantSetup) {
            authSection.style.display = 'block';
        }
    }

    hideAuthProgress() {
        const authProgressSection = document.getElementById('authProgressSection');
        if (authProgressSection) {
            authProgressSection.style.display = 'none';
        }
    }

    showMigrationInterface() {
        const migrationInterface = document.getElementById('migrationInterface');
        if (migrationInterface) {
            migrationInterface.style.display = 'block';
        }
        
        // Show the policy section if the migration interface doesn't exist
        const policySection = document.getElementById('policySection');
        if (policySection && !migrationInterface) {
            policySection.style.display = 'block';
        }
    }

    updateTenantConnectionDisplay() {
        const connectedSourceTenant = document.getElementById('connectedSourceTenant');
        const connectedTargetTenant = document.getElementById('connectedTargetTenant');
        
        if (connectedSourceTenant) {
            connectedSourceTenant.textContent = this.sourceTenant;
        }
        if (connectedTargetTenant) {
            connectedTargetTenant.textContent = this.targetTenant;
        }
    }

    renderSourcePolicies() {
        const policyGrid = document.getElementById('policyGrid');
        
        if (!policyGrid) {
            console.warn('policyGrid element not found - skipping policy rendering');
            return;
        }
        
        if (this.policies.size === 0) {
            policyGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">
                        <i class="fas fa-folder-open"></i>
                    </div>
                    <h3>No Policies Found</h3>
                    <p>No policies were found in the source tenant. Make sure you have the necessary permissions to read policies.</p>
                </div>
            `;
            return;
        }

        const policiesArray = Array.from(this.policies.values());
        const policiesHTML = policiesArray.map(policy => this.createPolicyCardHTML(policy)).join('');
        
        policyGrid.innerHTML = policiesHTML;
        
        // Bind events to policy cards
        this.bindPolicyCardEvents();
    }

    createPolicyCardHTML(policy) {
        const isSelected = this.selectedPolicies.has(policy.id);
        const formattedDate = policy.lastModifiedDateTime 
            ? new Date(policy.lastModifiedDateTime).toLocaleDateString()
            : 'Unknown';

        const policyTypeClass = this.getPolicyTypeClass(policy.policyType);
        const policyIcon = this.getPolicyTypeIcon(policy.policyType);

        return `
            <div class="policy-card ${isSelected ? 'selected' : ''}" 
                 data-policy-id="${policy.id}" 
                 data-policy-type="${policy.policyType}">
                
                <div class="policy-header">
                    <div class="policy-type-badge ${policyTypeClass}">
                        <i class="${policyIcon}"></i>
                        ${this.formatPolicyType(policy.policyType)}
                    </div>
                    <div class="connection-badge ${isSelected ? 'connected' : ''}">
                        <i class="fas ${isSelected ? 'fa-check' : 'fa-circle'}"></i>
                    </div>
                </div>

                <div class="policy-title">
                    ${policy.displayName || 'Unnamed Policy'}
                </div>

                <div class="policy-description">
                    ${policy.description || 'No description available'}
                </div>

                <div class="policy-actions">
                    <button class="action-btn view-policy-btn" data-policy-id="${policy.id}">
                        <i class="fas fa-eye"></i>
                        <span>View Details</span>
                    </button>
                    <button class="action-btn primary clone-policy-btn" data-policy-id="${policy.id}">
                        <i class="fas fa-clone"></i>
                        <span>Clone</span>
                    </button>
                </div>
            </div>
        `;
    }

    getPolicyTypeClass(policyType) {
        switch (policyType) {
            case 'deviceConfiguration':
                return 'device-configuration';
            case 'deviceCompliance':
                return 'device-compliance';
            case 'appProtection':
                return 'app-protection';
            default:
                return 'device-configuration';
        }
    }

    getPolicyTypeIcon(policyType) {
        switch (policyType) {
            case 'deviceConfiguration':
                return 'fas fa-cog';
            case 'deviceCompliance':
                return 'fas fa-shield-alt';
            case 'appProtection':
                return 'fas fa-mobile-alt';
            default:
                return 'fas fa-file-alt';
        }
    }

    bindPolicyCardEvents() {
        // View policy details buttons
        document.querySelectorAll('.view-policy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const policyId = btn.dataset.policyId;
                this.showPolicyDetailsModal(policyId);
            });
        });

        // Clone buttons
        document.querySelectorAll('.clone-policy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const policyId = btn.dataset.policyId;
                this.showCloneModal(policyId);
            });
        });

        // Policy card selection
        document.querySelectorAll('.policy-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.action-btn')) return;
                
                const policyId = card.dataset.policyId;
                this.togglePolicySelection(policyId, card);
            });
        });
    }

    showPolicyDetailsModal(policyId) {
        const policy = this.policies.get(policyId);
        if (!policy) return;

        const modal = document.getElementById('policyDetailsModal');
        modal.dataset.policyId = policyId;
        
        // Update modal title
        modal.querySelector('.modal-header h3').textContent = policy.displayName || 'Policy Details';
        
        // Update overview tab
        this.updatePolicyOverviewTab(policy);
        
        // Update settings tab
        this.updatePolicySettingsTab(policy);
        
        // Show modal
        modal.style.display = 'flex';
        
        // Default to overview tab
        this.switchPolicyTab('overview');
    }

    updatePolicyOverviewTab(policy) {
        const overviewContent = document.getElementById('policyOverviewContent');
        const formattedDate = policy.lastModifiedDateTime 
            ? new Date(policy.lastModifiedDateTime).toLocaleString()
            : 'Unknown';

        overviewContent.innerHTML = `
            <div class="info-grid">
                <div class="info-item">
                    <label>Policy Name</label>
                    <span>${policy.displayName || 'Unnamed Policy'}</span>
                </div>
                <div class="info-item">
                    <label>Policy Type</label>
                    <span>${this.formatPolicyType(policy.policyType)}</span>
                </div>
                <div class="info-item">
                    <label>Description</label>
                    <span>${policy.description || 'No description available'}</span>
                </div>
                <div class="info-item">
                    <label>Created Date</label>
                    <span>${policy.createdDateTime ? new Date(policy.createdDateTime).toLocaleString() : 'Unknown'}</span>
                </div>
                <div class="info-item">
                    <label>Last Modified</label>
                    <span>${formattedDate}</span>
                </div>
                <div class="info-item">
                    <label>Policy ID</label>
                    <span style="font-family: monospace; font-size: 0.875rem;">${policy.id}</span>
                </div>
            </div>
        `;
    }

    updatePolicySettingsTab(policy) {
        const settingsContent = document.getElementById('policySettingsContent');
        
        // Create a clean version of the policy for display (remove metadata)
        const cleanPolicy = { ...policy };
        delete cleanPolicy.id;
        delete cleanPolicy.createdDateTime;
        delete cleanPolicy.lastModifiedDateTime;
        delete cleanPolicy['@odata.type'];
        delete cleanPolicy['odata.type'];

        settingsContent.innerHTML = `
            <div class="settings-json">
                <pre><code>${JSON.stringify(cleanPolicy, null, 2)}</code></pre>
            </div>
        `;
    }

    switchPolicyTab(tabName) {
        const modal = document.getElementById('policyDetailsModal');
        
        // Update tab buttons
        modal.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            }
        });
        
        // Update tab content
        modal.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
            if (content.id === `policy${tabName.charAt(0).toUpperCase() + tabName.slice(1)}Content`) {
                content.classList.add('active');
            }
        });
    }

    closePolicyDetailsModal() {
        const modal = document.getElementById('policyDetailsModal');
        modal.style.display = 'none';
        modal.dataset.policyId = '';
    }

    togglePolicySelection(policyId, element) {
        if (this.selectedPolicies.has(policyId)) {
            this.selectedPolicies.delete(policyId);
            element.classList.remove('selected');
        } else {
            this.selectedPolicies.add(policyId);
            element.classList.add('selected');
        }
        
        this.updateBulkMigrateButton();
    }

    updateBulkMigrateButton() {
        const bulkBtn = document.getElementById('bulkMigrateBtn');
        const selectedCount = this.selectedPolicies.size;
        
        if (!bulkBtn) {
            console.warn('bulkMigrateBtn element not found');
            return;
        }
        
        if (selectedCount > 0) {
            bulkBtn.style.display = 'flex';
            // Update the text span (first span) and count badge (second span)
            const textSpan = bulkBtn.querySelector('span:first-of-type');
            const countBadge = bulkBtn.querySelector('#selectedCount');
            
            if (textSpan) {
                textSpan.textContent = 'Migrate Selected';
            }
            if (countBadge) {
                countBadge.textContent = selectedCount;
            }
        } else {
            bulkBtn.style.display = 'none';
        }
    }

    showCloneModal(policyId, policyType) {
        const policy = this.policies.get(policyId);
        if (!policy) return;

        // Populate modal with policy details (with null checks)
        const sourcePolicyName = document.getElementById('sourcePolicyName');
        const sourcePolicyType = document.getElementById('sourcePolicyType');
        const sourcePolicyDescription = document.getElementById('sourcePolicyDescription');
        const targetPolicyName = document.getElementById('targetPolicyName');
        const targetPolicyDescription = document.getElementById('targetPolicyDescription');
        const cloneModalOverlay = document.getElementById('cloneModalOverlay');
        
        if (sourcePolicyName) {
            sourcePolicyName.textContent = policy.displayName || 'Unnamed Policy';
        }
        if (sourcePolicyType) {
            sourcePolicyType.textContent = this.formatPolicyType(policyType);
        }
        if (sourcePolicyDescription) {
            sourcePolicyDescription.textContent = policy.description || 'No description';
        }

        // Clear form fields
        if (targetPolicyName) {
            targetPolicyName.value = '';
        }
        if (targetPolicyDescription) {
            targetPolicyDescription.value = '';
        }

        // Store current policy for cloning
        this.currentClonePolicy = { policyId, policyType };

        // Show modal
        if (cloneModalOverlay) {
            cloneModalOverlay.style.display = 'flex';
        }
    }

    closeCloneModal() {
        const cloneModalOverlay = document.getElementById('cloneModalOverlay');
        if (cloneModalOverlay) {
            cloneModalOverlay.style.display = 'none';
        }
        this.currentClonePolicy = null;
    }

    confirmPolicyClone() {
        if (!this.currentClonePolicy) return;

        const customizations = {
            displayName: document.getElementById('targetPolicyName').value.trim(),
            description: document.getElementById('targetPolicyDescription').value.trim()
        };

        this.clonePolicy(
            this.currentClonePolicy.policyId,
            this.currentClonePolicy.policyType,
            customizations
        );

        this.closeCloneModal();
    }

    addMigrationProgress(policyId, policyType, status) {
        const policy = this.policies.get(policyId);
        const progressList = document.getElementById('migrationProgressContent');
        const migrationProgress = document.getElementById('migrationProgressPanel');

        if (!progressList) {
            console.warn('migrationProgressContent element not found - skipping progress update');
            return;
        }

        const progressItem = document.createElement('div');
        progressItem.className = 'progress-item';
        progressItem.dataset.migrationId = policyId; // Use policyId as temporary migration ID
        progressItem.innerHTML = `
            <div class="progress-status ${status}">
                ${status === 'pending' ? '⏳' : status === 'success' ? '✅' : '❌'}
            </div>
            <div class="progress-details">
                <strong>${policy?.displayName || 'Unknown Policy'}</strong>
                <span>${status === 'pending' ? 'Cloning...' : 'Processing'}</span>
            </div>
        `;

        progressList.appendChild(progressItem);
        if (migrationProgress) {
            migrationProgress.style.display = 'block';
        }
    }

    updateMigrationProgress(migrationId, status, message) {
        const progressItem = document.querySelector(`[data-migration-id="${migrationId}"]`);
        if (progressItem) {
            const statusElement = progressItem.querySelector('.progress-status');
            const messageElement = progressItem.querySelector('span');

            // Remove existing status classes
            progressItem.className = progressItem.className.replace(/\b(success|error|permission-required)\b/g, '');
            
            // Add new status class and set content
            progressItem.classList.add('migration-progress');
            if (status === 'success') {
                statusElement.className = `progress-status ${status}`;
                statusElement.textContent = '✅';
            } else if (status === 'error') {
                statusElement.className = `progress-status ${status}`;
                statusElement.textContent = '❌';
            } else if (status === 'permission_required') {
                progressItem.classList.add('permission-required');
                statusElement.className = `progress-status ${status}`;
                statusElement.textContent = '🔐';
            } else {
                statusElement.className = `progress-status ${status}`;
                statusElement.textContent = '⏳';
            }
            
            messageElement.textContent = message;
        }
    }

    updatePolicyCount(count) {
        const sourcePolicyCount = document.getElementById('sourcePolicyCount');
        if (sourcePolicyCount) {
            sourcePolicyCount.textContent = count;
        }
    }

    incrementMigrationCount() {
        const migrationCountElement = document.getElementById('migratedPolicyCount');
        if (migrationCountElement) {
            const currentCount = parseInt(migrationCountElement.textContent) || 0;
            migrationCountElement.textContent = currentCount + 1;
        }
    }

    // Utility Methods
    getPolicyTypeLabel(odataType) {
        if (!odataType) return 'Unknown';
        
        const typeMap = {
            '#microsoft.graph.deviceConfiguration': 'Device Configuration',
            '#microsoft.graph.deviceCompliancePolicy': 'Device Compliance',
            '#microsoft.graph.mobileAppManagementPolicy': 'App Management',
            '#microsoft.graph.appProtectionPolicy': 'App Protection',
            '#microsoft.graph.deviceEnrollmentConfiguration': 'Device Enrollment',
            '#microsoft.graph.windowsInformationProtectionPolicy': 'WIP Policy',
            '#microsoft.graph.managedAppPolicy': 'Managed App Policy',
            'deviceConfigurations': 'Device Config',
            'deviceCompliancePolicies': 'Device Compliance',
            'mobileAppManagementPolicies': 'App Management',
            'appProtectionPolicies': 'App Protection',
            'deviceEnrollmentConfigurations': 'Device Enrollment',
            'windowsInformationProtectionPolicies': 'WIP',
            'managedAppPolicies': 'Managed Apps'
        };
        
        return typeMap[odataType] || odataType.replace(/^#microsoft\.graph\./, '').replace(/([A-Z])/g, ' $1').trim();
    }

    formatPolicyType(policyType) {
        const typeMap = {
            'deviceConfigurations': 'Device Config',
            'deviceCompliancePolicies': 'Device Compliance',
            'mobileAppManagementPolicies': 'App Management',
            'appProtectionPolicies': 'App Protection',
            'deviceEnrollmentConfigurations': 'Device Enrollment',
            'windowsInformationProtectionPolicies': 'WIP',
            'managedAppPolicies': 'Managed Apps'
        };
        
        return typeMap[policyType] || policyType;
    }

    findPolicyById(policyId) {
        return this.policies.get(policyId);
    }

    filterPolicies(searchTerm) {
        const policyItems = document.querySelectorAll('.policy-item');
        const lowerSearchTerm = searchTerm.toLowerCase();

        policyItems.forEach(item => {
            const policyName = item.querySelector('.policy-name').textContent.toLowerCase();
            const policyDescription = item.querySelector('.policy-description')?.textContent.toLowerCase() || '';
            
            const matches = policyName.includes(lowerSearchTerm) || 
                          policyDescription.includes(lowerSearchTerm);
            
            item.style.display = matches ? 'block' : 'none';
        });
    }

    filterPoliciesByType(policyType) {
        const policyItems = document.querySelectorAll('.policy-item');

        policyItems.forEach(item => {
            const itemPolicyType = item.dataset.policyType;
            const matches = policyType === 'all' || itemPolicyType === policyType;
            
            item.style.display = matches ? 'block' : 'none';
        });
    }

    isValidDomain(domain) {
        const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
        return domainRegex.test(domain);
    }

    validateTenantDomain(input, tenantType) {
        const value = input.value.trim();
        const isValid = !value || this.isValidDomain(value);
        
        if (isValid) {
            input.style.borderColor = '';
        } else {
            input.style.borderColor = '#f44336';
        }
        
        return isValid;
    }

    setButtonLoading(button, loading) {
        if (!button) {
            console.error('setButtonLoading: button element is null');
            return;
        }
        
        // First try generic selectors
        let btnText = button.querySelector('.btn-text');
        let btnLoader = button.querySelector('.btn-loader');
        
        // If not found, try specific connect button selectors
        if (!btnText || !btnLoader) {
            if (button.id === 'connectTenantsBtn') {
                btnText = button.querySelector('#connectBtnText');
                btnLoader = button.querySelector('#connectBtnSpinner');
            }
        }
        
        if (!btnText || !btnLoader) {
            console.log(`setButtonLoading: missing text or loader elements in button: ${button.id} - using fallback`);
            // Fallback: modify button text and disable/enable the button
            if (loading) {
                button.disabled = true;
                button.dataset.originalText = button.textContent;
                button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
            } else {
                button.disabled = false;
                const originalText = button.dataset.originalText || 'Load Policies';
                button.innerHTML = originalText;
            }
            return;
        }
        
        if (loading) {
            btnText.style.display = 'none';
            btnLoader.style.display = 'inline-block';
            button.disabled = true;
        } else {
            btnText.style.display = 'inline-block';
            btnLoader.style.display = 'none';
            button.disabled = false;
        }
    }

    showError(message) {
        // Create error notification
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.innerHTML = `
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM13 17h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            <span>${message}</span>
        `;
        
        // Insert after header - with fallback
        const header = document.querySelector('.modern-header');
        if (header) {
            header.insertAdjacentElement('afterend', errorDiv);
        } else {
            // Fallback: insert at beginning of body
            const body = document.body;
            if (body && body.firstChild) {
                body.insertBefore(errorDiv, body.firstChild);
            } else {
                console.error('Could not display error message:', message);
                return;
            }
        }
        
        // Remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    }

    showSuccess(message) {
        // Create success notification
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.innerHTML = `
            <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            <span>${message}</span>
        `;
        
        // Insert after header
        const header = document.querySelector('.tenant-clone-header');
        header.insertAdjacentElement('afterend', successDiv);
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.parentNode.removeChild(successDiv);
            }
        }, 3000);
    }

    logMessage(type, message) {
        const timestamp = new Date().toLocaleTimeString();
        const logContent = document.getElementById('logContent');
        
        // Log to console if log element doesn't exist
        if (!logContent) {
            console.log(`[${timestamp}] ${type.toUpperCase()}: ${message}`);
            return;
        }
        
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.innerHTML = `
            <span class="timestamp">${timestamp}</span>
            <span class="message">${message}</span>
        `;
        
        logContent.appendChild(logEntry);
        logContent.scrollTop = logContent.scrollHeight;
        
        // Keep log entries manageable
        while (logContent.children.length > 100) {
            logContent.removeChild(logContent.firstChild);
        }
    }

    clearLog() {
        const logContent = document.getElementById('logContent');
        const currentTime = new Date().toLocaleTimeString();
        
        // Log to console if log element doesn't exist
        if (!logContent) {
            console.log(`[${currentTime}] SYSTEM: Log cleared`);
            return;
        }
        
        logContent.innerHTML = `
            <div class="log-entry system">
                <span class="timestamp">${currentTime}</span>
                <span class="message">Log cleared</span>
            </div>
        `;
    }

    showPermissionDialog(tenantDomain, error) {
        // Create permission dialog
        const dialogHtml = `
            <div class="permission-dialog-overlay" id="permissionDialog">
                <div class="permission-dialog">
                    <div class="permission-dialog-header">
                        <h3>🔐 Additional Permissions Required</h3>
                    </div>
                    <div class="permission-dialog-content">
                        <p>The target tenant <strong>${tenantDomain}</strong> requires additional permissions to create policies:</p>
                        <div class="permission-error">
                            <code>${error}</code>
                        </div>
                        <p>The following permissions will be requested:</p>
                        <ul class="permissions-list">
                            <li>DeviceManagementConfiguration.ReadWrite.All</li>
                            <li>DeviceManagementApps.ReadWrite.All</li>
                            <li>DeviceManagementServiceConfig.ReadWrite.All</li>
                            <li>Policy.ReadWrite.ConditionalAccess</li>
                        </ul>
                        <p><strong>Note:</strong> You may need to sign in with an administrator account to grant these permissions.</p>
                    </div>
                    <div class="permission-dialog-actions">
                        <button class="btn-secondary" onclick="window.tenantCloneManager.closePermissionDialog()">Cancel</button>
                        <button class="btn-primary" onclick="window.tenantCloneManager.retryAfterPermissions()">Request Permissions & Retry</button>
                    </div>
                </div>
            </div>
        `;
        
        // Add to page
        document.body.insertAdjacentHTML('beforeend', dialogHtml);
    }

    showAuthenticationPrompt(data) {
        // Create authentication prompt
        const promptHtml = `
            <div class="auth-prompt-overlay" id="authPrompt">
                <div class="auth-prompt">
                    <div class="auth-prompt-header">
                        <h3>🔐 Authentication Required</h3>
                    </div>
                    <div class="auth-prompt-content">
                        <p>Additional permissions have been requested for the <strong>${data.tenantRole}</strong> tenant:</p>
                        <p><strong>${data.tenantDomain}</strong></p>
                        <p>${data.message}</p>
                        <div class="auth-instructions">
                            <ol>
                                <li>A browser window should have opened automatically</li>
                                <li>Sign in with administrator credentials</li>
                                <li>Grant the requested permissions</li>
                                <li>Return to this page once authentication is complete</li>
                            </ol>
                        </div>
                        <p><em>If the browser window didn't open, click the button below:</em></p>
                    </div>
                    <div class="auth-prompt-actions">
                        <button class="btn-secondary" onclick="window.tenantCloneManager.closeAuthPrompt()">Close</button>
                        <button class="btn-primary" onclick="window.open('${data.authUrl}', '_blank')">Open Authentication</button>
                    </div>
                </div>
            </div>
        `;
        
        // Add to page
        document.body.insertAdjacentHTML('beforeend', promptHtml);
    }

    closePermissionDialog() {
        const dialog = document.getElementById('permissionDialog');
        if (dialog) {
            dialog.remove();
        }
    }

    closeAuthPrompt() {
        const prompt = document.getElementById('authPrompt');
        if (prompt) {
            prompt.remove();
        }
    }

    retryAfterPermissions() {
        this.closePermissionDialog();
        this.logMessage('system', 'Retrying policy cloning after permission request...');
        
        // If we have a current clone operation, retry it
        if (this.currentClonePolicy) {
            const { policyId, policyType, customizations } = this.currentClonePolicy;
            this.clonePolicy(policyId, policyType, customizations);
        }
    }

    initializeDragAndDrop() {
        // This would be for future drag-and-drop functionality
        // For now, we'll use the clone buttons
        console.log('Drag and drop functionality initialized');
    }
}

// Initialize Tenant Clone Manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.tenantCloneManager = new TenantCloneManager();
    window.tenantClone = window.tenantCloneManager; // Shorter alias for HTML handlers
});

// Global error handler
window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
    if (window.tenantCloneManager) {
        const errorMessage = e.error ? e.error.message : 'Unknown error';
        window.tenantCloneManager.logMessage('error', `JavaScript error: ${errorMessage}`);
    }
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (window.tenantCloneManager && window.tenantCloneManager.socket) {
        window.tenantCloneManager.socket.disconnect();
    }
});
