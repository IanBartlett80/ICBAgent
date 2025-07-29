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
        
        this.init();
    }

    init() {
        this.initializeSocket();
        this.bindEvents();
        this.initializeDragAndDrop();
        this.logMessage('system', 'Tenant Clone interface initialized');
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
        document.getElementById('backToMainBtn').addEventListener('click', () => {
            window.location.href = '/';
        });

        // Connect tenants button
        document.getElementById('connectTenantsBtn').addEventListener('click', () => {
            this.connectTenants();
        });

        // Load policies button
        document.getElementById('loadPoliciesBtn').addEventListener('click', () => {
            this.loadSourcePolicies();
        });

        // Bulk migrate button
        document.getElementById('bulkMigrateBtn').addEventListener('click', () => {
            this.bulkMigratePolicies();
        });

        // Search functionality
        document.getElementById('sourcePolicySearch').addEventListener('input', (e) => {
            this.filterPolicies(e.target.value);
        });

        // Policy type filter
        document.getElementById('policyTypeFilter').addEventListener('change', (e) => {
            this.filterPoliciesByType(e.target.value);
        });

        // Clear log button
        document.getElementById('clearLogBtn').addEventListener('click', () => {
            this.clearLog();
        });

        // Modal events
        document.getElementById('closeCloneModalBtn').addEventListener('click', () => {
            this.closeCloneModal();
        });

        document.getElementById('cancelCloneBtn').addEventListener('click', () => {
            this.closeCloneModal();
        });

        document.getElementById('confirmCloneBtn').addEventListener('click', () => {
            this.confirmPolicyClone();
        });

        // Close modal on overlay click
        document.getElementById('cloneModalOverlay').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.closeCloneModal();
            }
        });

        // Input validation
        document.getElementById('sourceTenantDomain').addEventListener('input', (e) => {
            this.validateTenantDomain(e.target, 'source');
        });

        document.getElementById('targetTenantDomain').addEventListener('input', (e) => {
            this.validateTenantDomain(e.target, 'target');
        });
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
        console.log('Dual tenant initialized:', data);
        this.updateConnectionStatus(data.status);
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
            this.updateAuthStatus(tenantType, 'success');
            this.logMessage('success', `${tenantType} tenant (${data.tenantDomain}) authenticated successfully`);
        } else if (data.status === 'needs_authentication') {
            this.updateAuthStatus(tenantType, 'pending');
            this.logMessage('system', `${tenantType} tenant requires authentication`);
        } else if (data.status === 'authentication_error') {
            this.updateAuthStatus(tenantType, 'error');
            this.logMessage('error', `${tenantType} tenant authentication failed`);
        }
        
        // Check if both tenants are authenticated
        this.checkBothTenantsAuthenticated();
    }

    // UI Update Methods
    updateConnectionStatus(status) {
        const statusIndicator = document.getElementById('cloneStatusIndicator');
        const statusText = document.getElementById('cloneStatusText');

        if (status.isActive && status.sourceTenant?.authenticated && status.targetTenant?.authenticated) {
            statusIndicator.className = 'status-indicator connected';
            statusText.textContent = 'Connected';
            this.isConnected = true;
            this.showMigrationInterface();
        } else {
            statusIndicator.className = 'status-indicator connecting';
            statusText.textContent = 'Connecting';
        }
    }

    updateTenantStatus(tenantType, status) {
        const statusElement = document.getElementById(`${tenantType}Status`);
        const statusDot = statusElement.querySelector('.status-dot');
        const statusText = statusElement.querySelector('.status-text');

        statusDot.className = `status-dot ${status}`;
        
        switch (status) {
            case 'connecting':
                statusText.textContent = 'Connecting...';
                break;
            case 'connected':
                statusText.textContent = 'Connected';
                break;
            case 'error':
                statusText.textContent = 'Connection Failed';
                break;
            default:
                statusText.textContent = 'Not Connected';
        }
    }

    updateAuthStatus(tenantType, status) {
        this.authStatus[tenantType] = status;
        
        const authItem = document.getElementById(`${tenantType}AuthItem`);
        const authStatus = authItem.querySelector('.auth-status');
        const authText = authItem.querySelector(`#${tenantType}AuthText`);

        authStatus.className = `auth-status ${status}`;
        
        switch (status) {
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

    checkBothTenantsAuthenticated() {
        if (this.authStatus.source === 'success' && this.authStatus.target === 'success') {
            this.isConnected = true;
            this.hideAuthProgress();
            this.showMigrationInterface();
            this.updateTenantConnectionDisplay();
            this.logMessage('success', 'Both tenants authenticated successfully');
        }
    }

    showAuthProgress() {
        document.getElementById('dualTenantSetup').style.display = 'none';
        document.getElementById('authProgressSection').style.display = 'block';
    }

    hideAuthProgress() {
        document.getElementById('authProgressSection').style.display = 'none';
    }

    showMigrationInterface() {
        document.getElementById('migrationInterface').style.display = 'block';
    }

    updateTenantConnectionDisplay() {
        document.getElementById('connectedSourceTenant').textContent = this.sourceTenant;
        document.getElementById('connectedTargetTenant').textContent = this.targetTenant;
    }

    renderSourcePolicies() {
        const policiesList = document.getElementById('sourcePoliciesList');
        
        if (this.policies.size === 0) {
            policiesList.innerHTML = `
                <div class="empty-state">
                    <svg width="64" height="64" fill="currentColor" viewBox="0 0 24 24" opacity="0.3">
                        <path d="M19 7h-8l-2-2H5c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2z"/>
                    </svg>
                    <h4>No Policies Found</h4>
                    <p>No policies were found in the source tenant.</p>
                </div>
            `;
            return;
        }

        const policiesArray = Array.from(this.policies.values());
        const policiesHTML = policiesArray.map(policy => this.createPolicyHTML(policy)).join('');
        
        policiesList.innerHTML = policiesHTML;
        
        // Bind events to policy items
        this.bindPolicyEvents();
    }

    createPolicyHTML(policy) {
        const isSelected = this.selectedPolicies.has(policy.id);
        const formattedDate = policy.lastModifiedDateTime 
            ? new Date(policy.lastModifiedDateTime).toLocaleDateString()
            : 'Unknown';

        return `
            <div class="policy-item ${isSelected ? 'selected' : ''}" 
                 data-policy-id="${policy.id}" 
                 data-policy-type="${policy.policyType}"
                 draggable="true">
                <div class="policy-header">
                    <h4 class="policy-name">${policy.displayName || 'Unnamed Policy'}</h4>
                    <span class="policy-type-badge">${this.formatPolicyType(policy.policyType)}</span>
                </div>
                
                ${policy.description ? `<p class="policy-description">${policy.description}</p>` : ''}
                
                <div class="policy-meta">
                    <span>Modified: ${formattedDate}</span>
                    <div class="policy-actions">
                        <button class="clone-policy-btn" data-policy-id="${policy.id}" data-policy-type="${policy.policyType}">
                            <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
                            </svg>
                            Clone
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    bindPolicyEvents() {
        // Clone buttons
        document.querySelectorAll('.clone-policy-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const policyId = btn.dataset.policyId;
                const policyType = btn.dataset.policyType;
                this.showCloneModal(policyId, policyType);
            });
        });

        // Policy selection
        document.querySelectorAll('.policy-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.clone-policy-btn')) return;
                
                const policyId = item.dataset.policyId;
                this.togglePolicySelection(policyId, item);
            });
        });

        // Drag events
        document.querySelectorAll('.policy-item').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', item.dataset.policyId);
                item.classList.add('dragging');
            });

            item.addEventListener('dragend', (e) => {
                item.classList.remove('dragging');
            });
        });
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
        
        if (selectedCount > 0) {
            bulkBtn.style.display = 'flex';
            bulkBtn.querySelector('span').textContent = `Migrate Selected (${selectedCount})`;
        } else {
            bulkBtn.style.display = 'none';
        }
    }

    showCloneModal(policyId, policyType) {
        const policy = this.policies.get(policyId);
        if (!policy) return;

        // Populate modal with policy details
        document.getElementById('sourcePolicyName').textContent = policy.displayName || 'Unnamed Policy';
        document.getElementById('sourcePolicyType').textContent = this.formatPolicyType(policyType);
        document.getElementById('sourcePolicyDescription').textContent = policy.description || 'No description';

        // Clear form fields
        document.getElementById('targetPolicyName').value = '';
        document.getElementById('targetPolicyDescription').value = '';

        // Store current policy for cloning
        this.currentClonePolicy = { policyId, policyType };

        // Show modal
        document.getElementById('cloneModalOverlay').style.display = 'flex';
    }

    closeCloneModal() {
        document.getElementById('cloneModalOverlay').style.display = 'none';
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
        const progressList = document.getElementById('progressList');
        const migrationProgress = document.getElementById('migrationProgress');

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
        migrationProgress.style.display = 'block';
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
        document.getElementById('sourcePolicyCount').textContent = count;
    }

    incrementMigrationCount() {
        const migrationCountElement = document.getElementById('migrationCount');
        const currentCount = parseInt(migrationCountElement.textContent) || 0;
        migrationCountElement.textContent = currentCount + 1;
    }

    // Utility Methods
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
        
        const btnText = button.querySelector('.btn-text');
        const btnLoader = button.querySelector('.btn-loader');
        
        if (!btnText || !btnLoader) {
            console.error('setButtonLoading: missing .btn-text or .btn-loader elements in button:', button.id);
            // Fallback: just disable/enable the button
            button.disabled = loading;
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
        
        // Insert after header
        const header = document.querySelector('.tenant-clone-header');
        header.insertAdjacentElement('afterend', errorDiv);
        
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
