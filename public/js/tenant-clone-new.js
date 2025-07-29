class PolicyMigrationDashboard {
    constructor() {
        this.socket = null;
        this.sessionId = null;
        this.sourceTenant = null;
        this.targetTenant = null;
        this.policies = new Map();
        this.selectedPolicies = new Set();
        this.filteredPolicies = new Set();
        this.sortOrder = { column: 'name', direction: 'asc' };
        this.isConnected = false;
        this.authStatus = {
            source: 'pending',
            target: 'pending'
        };
        this.migrationLog = [];
        this.currentJsonPolicy = null;
        this.errors = new Map();
        
        this.init();
    }

    init() {
        this.initializeSocket();
        this.bindEvents();
        this.showInitialView();
        this.logMessage('system', 'Policy Migration Dashboard initialized');
    }

    // ===== INITIALIZATION =====
    initializeSocket() {
        this.socket = io();
        this.sessionId = this.generateSessionId();
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

        this.socket.on('policy_warning', (data) => {
            this.handlePolicyWarning(data);
        });

        this.socket.on('policy_secret_error', (data) => {
            this.handlePolicySecretError(data);
        });
    }

    bindEvents() {
        // Header navigation
        const backBtn = document.getElementById('backToDashboardBtn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                window.location.href = '/';
            });
        }

        // Tenant management
        const changeTenantBtn = document.getElementById('changeTenantBtn');
        if (changeTenantBtn) {
            changeTenantBtn.addEventListener('click', () => {
                this.showConnectionModal();
            });
        }

        const connectTenantBtn = document.getElementById('connectTenantBtn');
        if (connectTenantBtn) {
            connectTenantBtn.addEventListener('click', () => {
                if (this.isConnected) {
                    this.showPolicyDashboard();
                } else {
                    this.showConnectionModal();
                }
            });
        }

        // Connection setup
        const setupTenantsBtn = document.getElementById('setupTenantsBtn');
        if (setupTenantsBtn) {
            setupTenantsBtn.addEventListener('click', () => {
                this.connectTenants();
            });
        }

        // Policy management
        const loadPoliciesBtn = document.getElementById('loadPoliciesBtn');
        if (loadPoliciesBtn) {
            loadPoliciesBtn.addEventListener('click', () => {
                this.loadSourcePolicies();
            });
        }

        const migrateSelectedBtn = document.getElementById('migrateSelectedBtn');
        if (migrateSelectedBtn) {
            migrateSelectedBtn.addEventListener('click', () => {
                this.migrateSelectedPolicies();
            });
        }

        // Search and filter
        const searchInput = document.getElementById('policySearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterPolicies(e.target.value);
            });
        }

        const typeFilter = document.getElementById('policyTypeFilter');
        if (typeFilter) {
            typeFilter.addEventListener('change', (e) => {
                this.filterPoliciesByType(e.target.value);
            });
        }

        // Selection tools
        const selectAllBtn = document.getElementById('selectAllBtn');
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                this.selectAllVisible();
            });
        }

        const selectNoneBtn = document.getElementById('selectNoneBtn');
        if (selectNoneBtn) {
            selectNoneBtn.addEventListener('click', () => {
                this.clearSelection();
            });
        }

        const selectByTypeBtn = document.getElementById('selectByTypeBtn');
        if (selectByTypeBtn) {
            selectByTypeBtn.addEventListener('click', () => {
                this.showSmartSelectionMenu();
            });
        }

        // Master checkbox
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.selectAllVisible();
                } else {
                    this.clearSelection();
                }
            });
        }

        // Table sorting
        const sortableHeaders = document.querySelectorAll('.sortable');
        sortableHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const sortBy = header.dataset.sort;
                this.sortTable(sortBy);
            });
        });

        // JSON Panel
        const closeJsonBtn = document.getElementById('closeJsonBtn');
        if (closeJsonBtn) {
            closeJsonBtn.addEventListener('click', () => {
                this.closeJsonPanel();
            });
        }

        const cancelJsonBtn = document.getElementById('cancelJsonBtn');
        if (cancelJsonBtn) {
            cancelJsonBtn.addEventListener('click', () => {
                this.closeJsonPanel();
            });
        }

        const migrateWithChangesBtn = document.getElementById('migrateWithChangesBtn');
        if (migrateWithChangesBtn) {
            migrateWithChangesBtn.addEventListener('click', () => {
                this.migrateWithJsonChanges();
            });
        }

        const formatJsonBtn = document.getElementById('formatJsonBtn');
        if (formatJsonBtn) {
            formatJsonBtn.addEventListener('click', () => {
                this.formatJson();
            });
        }

        const resetJsonBtn = document.getElementById('resetJsonBtn');
        if (resetJsonBtn) {
            resetJsonBtn.addEventListener('click', () => {
                this.resetJson();
            });
        }

        const cleanSecretsBtn = document.getElementById('cleanSecretsBtn');
        if (cleanSecretsBtn) {
            cleanSecretsBtn.addEventListener('click', () => {
                this.cleanSecretReferences();
            });
        }

        const verifyCleanBtn = document.getElementById('verifyCleanBtn');
        if (verifyCleanBtn) {
            verifyCleanBtn.addEventListener('click', () => {
                this.verifyPolicyClean();
            });
        }

        // Error panel
        const closeErrorPanelBtn = document.getElementById('closeErrorPanelBtn');
        if (closeErrorPanelBtn) {
            closeErrorPanelBtn.addEventListener('click', () => {
                this.hideErrorPanel();
            });
        }

        const retryAllErrorsBtn = document.getElementById('retryAllErrorsBtn');
        if (retryAllErrorsBtn) {
            retryAllErrorsBtn.addEventListener('click', () => {
                this.retryAllErrors();
            });
        }

        // Panel overlay
        const panelOverlay = document.getElementById('panelOverlay');
        if (panelOverlay) {
            panelOverlay.addEventListener('click', () => {
                this.closeJsonPanel();
            });
        }

        // Empty state load button
        const emptyStateLoadBtn = document.getElementById('emptyStateLoadBtn');
        if (emptyStateLoadBtn) {
            emptyStateLoadBtn.addEventListener('click', () => {
                const loadPoliciesBtn = document.getElementById('loadPoliciesBtn');
                if (loadPoliciesBtn) loadPoliciesBtn.click();
            });
        }

        // Event delegation for dynamically created elements
        this.setupEventDelegation();
    }

    setupEventDelegation() {
        // Delegate events for policy action buttons
        document.addEventListener('click', (e) => {
            // JSON editor button
            if (e.target.closest('.json-editor-btn')) {
                const btn = e.target.closest('.json-editor-btn');
                const policyId = btn.dataset.policyId;
                if (policyId) {
                    this.openJsonEditor(policyId);
                }
            }

            // Migrate policy button
            if (e.target.closest('.migrate-policy-btn')) {
                const btn = e.target.closest('.migrate-policy-btn');
                const policyId = btn.dataset.policyId;
                const policyType = btn.dataset.policyType;
                if (policyId && policyType) {
                    this.clonePolicy(policyId, policyType);
                }
            }

            // Error retry button
            if (e.target.closest('.error-retry-btn')) {
                const btn = e.target.closest('.error-retry-btn');
                const errorId = btn.dataset.errorId;
                if (errorId) {
                    this.retryError(errorId);
                }
            }

            // Error dismiss button
            if (e.target.closest('.error-dismiss-btn')) {
                const btn = e.target.closest('.error-dismiss-btn');
                const errorId = btn.dataset.errorId;
                if (errorId) {
                    this.removeError(errorId);
                }
            }

            // Custom error action button
            if (e.target.closest('.error-action-btn')) {
                const btn = e.target.closest('.error-action-btn');
                const errorId = btn.dataset.errorId;
                const actionType = btn.dataset.action;
                if (errorId && actionType === 'custom') {
                    const error = this.errors.get(errorId);
                    if (error && error.actionButton && error.actionButton.action) {
                        error.actionButton.action();
                    }
                }
            }

            // Task dismiss button
            if (e.target.closest('.task-dismiss-btn')) {
                const btn = e.target.closest('.task-dismiss-btn');
                const errorId = btn.dataset.errorId;
                if (errorId) {
                    this.removeError(errorId);
                }
            }
        });
    }

    // ===== VIEW MANAGEMENT =====
    showInitialView() {
        if (this.isConnected) {
            this.showPolicyDashboard();
        } else {
            this.showConnectionModal();
        }
    }

    showConnectionModal() {
        const modal = document.getElementById('connectionModal');
        const dashboard = document.getElementById('policyDashboard');
        
        if (modal) modal.style.display = 'flex';
        if (dashboard) dashboard.style.display = 'none';
        
        this.updateConnectButton();
    }

    showPolicyDashboard() {
        const modal = document.getElementById('connectionModal');
        const dashboard = document.getElementById('policyDashboard');
        
        if (modal) modal.style.display = 'none';
        if (dashboard) dashboard.style.display = 'block';
        
        this.updateTenantHeader();
        this.updateConnectButton();
    }

    updateTenantHeader() {
        const sourceDisplay = document.getElementById('sourceTenantDisplay');
        const targetDisplay = document.getElementById('targetTenantDisplay');
        const sourceStatus = document.getElementById('sourceStatus');
        const targetStatus = document.getElementById('targetStatus');

        if (sourceDisplay) {
            sourceDisplay.textContent = this.sourceTenant || 'Connect tenant...';
        }
        if (targetDisplay) {
            targetDisplay.textContent = this.targetTenant || 'Connect tenant...';
        }

        // Update connection status indicators
        if (sourceStatus) {
            sourceStatus.className = `connection-status ${this.authStatus.source === 'authenticated' ? 'connected' : 
                                     this.authStatus.source === 'connecting' ? 'connecting' : ''}`;
        }
        if (targetStatus) {
            targetStatus.className = `connection-status ${this.authStatus.target === 'authenticated' ? 'connected' : 
                                     this.authStatus.target === 'connecting' ? 'connecting' : ''}`;
        }
    }

    updateConnectButton() {
        const connectBtn = document.getElementById('connectTenantBtn');
        if (!connectBtn) return;

        if (this.isConnected) {
            connectBtn.innerHTML = '<i class="fas fa-check"></i><span>Connected</span>';
            connectBtn.className = 'action-btn primary';
        } else {
            connectBtn.innerHTML = '<i class="fas fa-plug"></i><span>Connect</span>';
            connectBtn.className = 'action-btn primary';
        }
    }

    // ===== TENANT CONNECTION =====
    async connectTenants() {
        const sourceInput = document.getElementById('sourceInput');
        const targetInput = document.getElementById('targetInput');
        const setupBtn = document.getElementById('setupTenantsBtn');

        if (!sourceInput || !targetInput) return;

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

        this.setButtonLoading(setupBtn, true);
        this.logMessage('system', `Connecting to tenants: ${this.sourceTenant} → ${this.targetTenant}`);

        try {
            this.socket.emit('dual_tenant_init', {
                sessionId: this.sessionId,
                sourceTenant: this.sourceTenant,
                targetTenant: this.targetTenant
            });
        } catch (error) {
            console.error('Error connecting tenants:', error);
            this.showError('Failed to connect to tenants: ' + error.message);
            this.setButtonLoading(setupBtn, false);
        }
    }

    // ===== POLICY MANAGEMENT =====
    async loadSourcePolicies() {
        if (!this.isConnected) {
            this.showError('Please connect to both tenants first');
            return;
        }

        const loadBtn = document.getElementById('loadPoliciesBtn');
        this.setButtonLoading(loadBtn, true);
        this.showLoadingState();
        this.logMessage('system', 'Loading policies from source tenant...');

        try {
            this.socket.emit('load_source_policies', {
                sessionId: this.sessionId
            });
        } catch (error) {
            console.error('Error loading source policies:', error);
            this.showError('Failed to load source policies: ' + error.message);
            this.setButtonLoading(loadBtn, false);
            this.hideLoadingState();
        }
    }

    migrateSelectedPolicies() {
        if (this.selectedPolicies.size === 0) {
            this.showError('Please select at least one policy to migrate');
            return;
        }

        const migrateBtn = document.getElementById('migrateSelectedBtn');
        this.setButtonLoading(migrateBtn, true);

        this.logMessage('system', `Starting migration of ${this.selectedPolicies.size} policies`);

        // Migrate each selected policy
        for (const policyId of this.selectedPolicies) {
            const policy = this.policies.get(policyId);
            if (policy) {
                this.clonePolicy(policyId, policy.policyType);
            }
        }

        this.setButtonLoading(migrateBtn, false);
    }

    async clonePolicy(policyId, policyType, customizations = {}) {
        if (!this.isConnected) {
            this.showError('Please connect to both tenants first');
            return;
        }

        this.logMessage('system', `Starting clone of policy: ${policyId}`);

        try {
            this.socket.emit('clone_policy', {
                sessionId: this.sessionId,
                policyId: policyId,
                policyType: policyType,
                customizations: customizations
            });

            // Update policy status to pending
            this.updatePolicyStatus(policyId, 'pending');

        } catch (error) {
            console.error('Error cloning policy:', error);
            this.showError('Failed to clone policy: ' + error.message);
        }
    }

    // ===== TABLE MANAGEMENT =====
    renderPolicyTable() {
        const tableBody = document.getElementById('policyTableBody');
        const emptyState = document.getElementById('emptyState');
        
        if (!tableBody) return;

        // Show/hide empty state
        if (this.policies.size === 0) {
            if (emptyState) emptyState.style.display = 'flex';
            tableBody.innerHTML = '';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';

        // Get filtered and sorted policies
        const policiesArray = this.getFilteredAndSortedPolicies();
        
        // Render rows
        tableBody.innerHTML = '';
        policiesArray.forEach(policy => {
            const row = this.createPolicyRow(policy);
            tableBody.appendChild(row);
        });

        this.updateSelectionUI();
    }

    createPolicyRow(policy) {
        const row = document.createElement('tr');
        row.dataset.policyId = policy.id;
        
        const isSelected = this.selectedPolicies.has(policy.id);
        if (isSelected) row.classList.add('selected');

        const policyName = policy.displayName || policy.name || 'Unnamed Policy';
        const policyType = this.formatPolicyType(policy.policyType);
        const policyId = policy.id;
        const migrationStatus = this.getPolicyMigrationStatus(policy.id);

        row.innerHTML = `
            <td class="select-column">
                <input type="checkbox" class="table-checkbox policy-checkbox" 
                       data-policy-id="${policy.id}" ${isSelected ? 'checked' : ''}>
            </td>
            <td>
                <div class="policy-name">${policyName}</div>
            </td>
            <td>
                <span class="policy-type">${policyType}</span>
            </td>
            <td>
                <code class="policy-id">${policyId}</code>
            </td>
            <td>
                <span class="migration-status ${migrationStatus.class}">
                    <i class="${migrationStatus.icon}"></i>
                    ${migrationStatus.text}
                </span>
            </td>
            <td class="actions-column">
                <div class="policy-actions">
                    <button class="policy-action-btn json-editor-btn" data-policy-id="${policy.id}" title="Edit JSON">
                        <i class="fas fa-code"></i>
                    </button>
                    <button class="policy-action-btn primary migrate-policy-btn" data-policy-id="${policy.id}" data-policy-type="${policy.policyType}" title="Migrate">
                        <i class="fas fa-rocket"></i>
                    </button>
                </div>
            </td>
        `;

        // Bind checkbox event
        const checkbox = row.querySelector('.policy-checkbox');
        if (checkbox) {
            checkbox.addEventListener('change', (e) => {
                this.togglePolicySelection(policy.id, e.target.checked);
            });
        }

        return row;
    }

    getFilteredAndSortedPolicies() {
        let policiesArray = Array.from(this.policies.values());

        // Apply filters if any
        if (this.filteredPolicies.size > 0) {
            policiesArray = policiesArray.filter(policy => this.filteredPolicies.has(policy.id));
        }

        // Apply sorting
        policiesArray.sort((a, b) => {
            let aValue, bValue;
            
            switch (this.sortOrder.column) {
                case 'name':
                    aValue = (a.displayName || a.name || '').toLowerCase();
                    bValue = (b.displayName || b.name || '').toLowerCase();
                    break;
                case 'type':
                    aValue = a.policyType || '';
                    bValue = b.policyType || '';
                    break;
                case 'id':
                    aValue = a.id || '';
                    bValue = b.id || '';
                    break;
                case 'status':
                    aValue = this.getPolicyMigrationStatus(a.id).text;
                    bValue = this.getPolicyMigrationStatus(b.id).text;
                    break;
                default:
                    return 0;
            }

            if (aValue < bValue) return this.sortOrder.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return this.sortOrder.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return policiesArray;
    }

    getPolicyMigrationStatus(policyId) {
        // This would be enhanced to track actual migration status
        return {
            class: 'not-started',
            icon: 'fas fa-circle',
            text: 'Ready'
        };
    }

    // ===== SELECTION MANAGEMENT =====
    togglePolicySelection(policyId, selected) {
        if (selected) {
            this.selectedPolicies.add(policyId);
        } else {
            this.selectedPolicies.delete(policyId);
        }

        this.updateSelectionUI();
        this.updatePolicyRowSelection(policyId, selected);
    }

    selectAllVisible() {
        const visiblePolicies = this.getFilteredAndSortedPolicies();
        visiblePolicies.forEach(policy => {
            this.selectedPolicies.add(policy.id);
        });
        this.updateSelectionUI();
        this.renderPolicyTable(); // Re-render to update checkboxes
    }

    clearSelection() {
        this.selectedPolicies.clear();
        this.updateSelectionUI();
        this.renderPolicyTable(); // Re-render to update checkboxes
    }

    updateSelectionUI() {
        const selectedCount = this.selectedPolicies.size;
        const migrateBtn = document.getElementById('migrateSelectedBtn');
        const selectedCountElement = document.getElementById('selectedPoliciesCount');
        const migrationSelectionCount = document.getElementById('migrationSelectionCount');
        const selectAllCheckbox = document.getElementById('selectAllCheckbox');

        // Update stats
        if (selectedCountElement) {
            selectedCountElement.textContent = selectedCount;
        }

        // Update migrate button
        if (migrateBtn) {
            if (selectedCount > 0) {
                migrateBtn.style.display = 'flex';
                if (migrationSelectionCount) {
                    migrationSelectionCount.textContent = selectedCount;
                }
            } else {
                migrateBtn.style.display = 'none';
            }
        }

        // Update master checkbox
        if (selectAllCheckbox) {
            const visiblePolicies = this.getFilteredAndSortedPolicies();
            const visibleSelected = visiblePolicies.filter(p => this.selectedPolicies.has(p.id)).length;
            
            if (visibleSelected === 0) {
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = false;
            } else if (visibleSelected === visiblePolicies.length) {
                selectAllCheckbox.checked = true;
                selectAllCheckbox.indeterminate = false;
            } else {
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = true;
            }
        }
    }

    updatePolicyRowSelection(policyId, selected) {
        const row = document.querySelector(`tr[data-policy-id="${policyId}"]`);
        if (row) {
            if (selected) {
                row.classList.add('selected');
            } else {
                row.classList.remove('selected');
            }
        }
    }

    // ===== FILTERING AND SORTING =====
    filterPolicies(searchTerm) {
        if (!searchTerm.trim()) {
            this.filteredPolicies.clear();
        } else {
            this.filteredPolicies.clear();
            const term = searchTerm.toLowerCase();
            
            this.policies.forEach((policy, policyId) => {
                const name = (policy.displayName || policy.name || '').toLowerCase();
                const type = (policy.policyType || '').toLowerCase();
                const id = (policy.id || '').toLowerCase();
                
                if (name.includes(term) || type.includes(term) || id.includes(term)) {
                    this.filteredPolicies.add(policyId);
                }
            });
        }
        
        this.renderPolicyTable();
    }

    filterPoliciesByType(policyType) {
        if (policyType === 'all') {
            this.filteredPolicies.clear();
        } else {
            this.filteredPolicies.clear();
            this.policies.forEach((policy, policyId) => {
                if (policy.policyType === policyType) {
                    this.filteredPolicies.add(policyId);
                }
            });
        }
        
        this.renderPolicyTable();
    }

    sortTable(column) {
        if (this.sortOrder.column === column) {
            this.sortOrder.direction = this.sortOrder.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortOrder.column = column;
            this.sortOrder.direction = 'asc';
        }

        this.updateSortIcons();
        this.renderPolicyTable();
    }

    updateSortIcons() {
        // Reset all sort icons
        document.querySelectorAll('.sort-icon').forEach(icon => {
            icon.className = 'fas fa-sort sort-icon';
        });

        // Update active sort icon
        const activeHeader = document.querySelector(`[data-sort="${this.sortOrder.column}"]`);
        if (activeHeader) {
            const icon = activeHeader.querySelector('.sort-icon');
            if (icon) {
                icon.className = `fas fa-sort-${this.sortOrder.direction === 'asc' ? 'up' : 'down'} sort-icon`;
            }
        }
    }

    // ===== JSON EDITOR =====
    openJsonEditor(policyId) {
        const policy = this.policies.get(policyId);
        if (!policy) return;

        this.currentJsonPolicy = policy;
        
        const jsonPanel = document.getElementById('jsonPanel');
        const panelOverlay = document.getElementById('panelOverlay');
        const jsonPolicyName = document.getElementById('jsonPolicyName');
        const jsonPolicyType = document.getElementById('jsonPolicyType');
        const jsonEditor = document.getElementById('jsonEditor');

        if (jsonPolicyName) jsonPolicyName.textContent = policy.displayName || policy.name || 'Unnamed Policy';
        if (jsonPolicyType) jsonPolicyType.textContent = this.formatPolicyType(policy.policyType);
        
        if (jsonEditor) {
            // Clean policy object for editing (remove metadata)
            const cleanPolicy = { ...policy };
            delete cleanPolicy.id;
            delete cleanPolicy.createdDateTime;
            delete cleanPolicy.lastModifiedDateTime;
            delete cleanPolicy['@odata.type'];
            delete cleanPolicy.policyType;
            
            jsonEditor.value = JSON.stringify(cleanPolicy, null, 2);
        }

        if (jsonPanel) jsonPanel.classList.add('open');
        if (panelOverlay) panelOverlay.classList.add('active');
    }

    closeJsonPanel() {
        const jsonPanel = document.getElementById('jsonPanel');
        const panelOverlay = document.getElementById('panelOverlay');

        if (jsonPanel) jsonPanel.classList.remove('open');
        if (panelOverlay) panelOverlay.classList.remove('active');
        
        this.currentJsonPolicy = null;
    }

    formatJson() {
        const jsonEditor = document.getElementById('jsonEditor');
        if (!jsonEditor) return;

        try {
            const parsed = JSON.parse(jsonEditor.value);
            jsonEditor.value = JSON.stringify(parsed, null, 2);
        } catch (error) {
            this.showError('Invalid JSON format');
        }
    }

    resetJson() {
        if (!this.currentJsonPolicy) return;
        
        const jsonEditor = document.getElementById('jsonEditor');
        if (!jsonEditor) return;

        // Reset to original policy
        const cleanPolicy = { ...this.currentJsonPolicy };
        delete cleanPolicy.id;
        delete cleanPolicy.createdDateTime;
        delete cleanPolicy.lastModifiedDateTime;
        delete cleanPolicy['@odata.type'];
        delete cleanPolicy.policyType;
        
        jsonEditor.value = JSON.stringify(cleanPolicy, null, 2);
    }

    migrateWithJsonChanges() {
        if (!this.currentJsonPolicy) return;

        const jsonEditor = document.getElementById('jsonEditor');
        if (!jsonEditor) return;

        try {
            const customizations = JSON.parse(jsonEditor.value);
            this.clonePolicy(this.currentJsonPolicy.id, this.currentJsonPolicy.policyType, customizations);
            this.closeJsonPanel();
        } catch (error) {
            this.showError('Invalid JSON format: ' + error.message);
        }
    }

    cleanSecretReferences() {
        const jsonEditor = document.getElementById('jsonEditor');
        if (!jsonEditor) return;

        try {
            const policy = JSON.parse(jsonEditor.value);
            const secretReferencesRemoved = [];
            
            this.cleanSecretReferencesFromObject(policy, secretReferencesRemoved);
            
            // Update the JSON editor with cleaned policy
            jsonEditor.value = JSON.stringify(policy, null, 2);
            
            // Show notification about what was cleaned
            if (secretReferencesRemoved.length > 0) {
                this.showSecretCleaningResults(secretReferencesRemoved);
            } else {
                this.showInfo('No secret references found in this policy.');
            }
            
        } catch (error) {
            this.showError('Invalid JSON format: ' + error.message);
        }
    }

    cleanSecretReferencesFromObject(obj, secretReferencesRemoved, path = '') {
        if (!obj || typeof obj !== 'object') return;

        // Check if this is an array
        if (Array.isArray(obj)) {
            obj.forEach((item, index) => {
                this.cleanSecretReferencesFromObject(item, secretReferencesRemoved, `${path}[${index}]`);
            });
            return;
        }

        // Process each property in the object
        const keysToDelete = [];
        for (const [key, value] of Object.entries(obj)) {
            const currentPath = path ? `${path}.${key}` : key;
            
            // Check for secret reference patterns
            if (this.isSecretReference(key, value)) {
                keysToDelete.push(key);
                secretReferencesRemoved.push({
                    path: currentPath,
                    key: key,
                    type: this.getSecretReferenceType(key, value),
                    description: this.getSecretReferenceDescription(key, value)
                });
                continue;
            }

            // Recursively process nested objects
            if (value && typeof value === 'object') {
                this.cleanSecretReferencesFromObject(value, secretReferencesRemoved, currentPath);
            }
        }

        // Remove secret reference keys
        keysToDelete.forEach(key => {
            delete obj[key];
        });
    }

    isSecretReference(key, value) {
        // Direct secret reference patterns (case-insensitive)
        const secretKeyPatterns = [
            /secretReferenceValueId/i,
            /secretReference/i,
            /secretValue/i,
            /certificateId/i,
            /trustedRootCertificate/i,
            /rootCertificateId/i,
            /encryptedPassword/i,
            /hashedPassword/i,
            /passwordHash/i,
            /sharedSecret/i,
            /privateKey/i,
            /keyContainer/i,
            /pfxBlobHash/i,
            /thumbprint/i,
            /fingerprint/i,
            /subjectNameFormat/i,
            /subjectAlternativeNameType/i,
            /certificateStore/i,
            /keyUsage/i,
            /extendedKeyUsages/i,
            /customSubjectAlternativeNames/i,
            /scepServerUrl/i,
            /certificateValidityPeriodValue/i,
            /certificateValidityPeriodScale/i,
            /subjectNameFormatString/i,
            /keyStorageProvider/i,
            /customKeyStorageProvider/i,
            /smartCardReaderName/i,
            /certificateAccessType/i
        ];

        // Check if key matches secret patterns
        if (secretKeyPatterns.some(pattern => pattern.test(key))) {
            return true;
        }

        // Additional checks for nested certificate/security objects
        if (typeof value === 'object' && value !== null) {
            // Check if this object has properties that indicate it's a certificate/secret object
            const objectKeys = Object.keys(value);
            const hasCertificateProperties = objectKeys.some(k => 
                /certificate|secret|password|key|thumbprint|pfx|p12|der|pem/i.test(k)
            );
            
            if (hasCertificateProperties && (
                key.toLowerCase().includes('certificate') ||
                key.toLowerCase().includes('credential') ||
                key.toLowerCase().includes('auth') ||
                key.toLowerCase().includes('security')
            )) {
                return true;
            }
        }

        // Check for GUID-like values that might be secret references
        if (typeof value === 'string' && key.toLowerCase().includes('id')) {
            const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (guidPattern.test(value) && (
                key.toLowerCase().includes('certificate') ||
                key.toLowerCase().includes('secret') ||
                key.toLowerCase().includes('key') ||
                key.toLowerCase().includes('credential') ||
                key.toLowerCase().includes('thumbprint') ||
                key.toLowerCase().includes('reference')
            )) {
                return true;
            }
        }

        // Check for certificate/key data patterns
        if (typeof value === 'string') {
            const secretValuePatterns = [
                /^[A-Za-z0-9+/]{100,}={0,2}$/, // Base64 encoded data (likely certificates/keys)
                /BEGIN (CERTIFICATE|PRIVATE KEY|PUBLIC KEY|RSA PRIVATE KEY|ENCRYPTED PRIVATE KEY)/i,
                /END (CERTIFICATE|PRIVATE KEY|PUBLIC KEY|RSA PRIVATE KEY|ENCRYPTED PRIVATE KEY)/i,
                /^[A-Fa-f0-9]{40,}$/, // Long hex strings (thumbprints, hashes)
                /^MIIE[A-Za-z0-9+/]/, // Common certificate prefix
                /^MII[A-Za-z0-9+/]{100,}/ // Generic certificate/key pattern
            ];
            
            if (secretValuePatterns.some(pattern => pattern.test(value))) {
                return true;
            }
        }

        // Check for URL patterns that might contain secrets
        if (typeof value === 'string' && value.startsWith('http') && (
            key.toLowerCase().includes('secret') ||
            key.toLowerCase().includes('key') ||
            key.toLowerCase().includes('certificate') ||
            key.toLowerCase().includes('scep') ||
            key.toLowerCase().includes('ca')
        )) {
            return true;
        }

        return false;
    }

    getSecretReferenceType(key, value) {
        if (key.toLowerCase().includes('certificate')) return 'certificate';
        if (key.toLowerCase().includes('password')) return 'password';
        if (key.toLowerCase().includes('secret')) return 'shared_secret';
        if (key.toLowerCase().includes('key')) return 'encryption_key';
        if (key.toLowerCase().includes('credential')) return 'credential';
        return 'unknown_secret';
    }

    getSecretReferenceDescription(key, value) {
        const type = this.getSecretReferenceType(key, value);
        
        switch (type) {
            case 'certificate':
                return 'Certificate reference - upload certificate in target tenant';
            case 'password':
                return 'Password/credential - configure authentication in target tenant';
            case 'shared_secret':
                return 'Shared secret - configure secret value in target tenant';
            case 'encryption_key':
                return 'Encryption key - configure key settings in target tenant';
            case 'credential':
                return 'Authentication credential - configure authentication in target tenant';
            default:
                return 'Secret reference - manual configuration required in target tenant';
        }
    }

    showSecretCleaningResults(secretReferencesRemoved) {
        const count = secretReferencesRemoved.length;
        let message = `🔐 Removed ${count} secret reference${count === 1 ? '' : 's'} from policy JSON:\n\n`;
        
        secretReferencesRemoved.forEach((ref, index) => {
            message += `${index + 1}. ${ref.key} (${ref.type})\n   📝 ${ref.description}\n\n`;
        });

        message += `✅ Policy is now ready for migration. You'll need to manually configure these secrets in the target tenant after migration.`;
        
        // Show in a more user-friendly way
        this.showInfo(message);
    }

    verifyPolicyClean() {
        const jsonEditor = document.getElementById('jsonEditor');
        if (!jsonEditor) return;

        try {
            const policy = JSON.parse(jsonEditor.value);
            const remainingSecrets = [];
            
            this.verifyNoSecretsRemain(policy, remainingSecrets);
            
            if (remainingSecrets.length > 0) {
                let message = `⚠️ Found ${remainingSecrets.length} potential secret reference${remainingSecrets.length === 1 ? '' : 's'} still in the policy:\n\n`;
                
                remainingSecrets.forEach((ref, index) => {
                    message += `${index + 1}. ${ref.path} = ${ref.key}\n`;
                    if (ref.value) {
                        message += `   Value: ${ref.value}\n`;
                    }
                    message += '\n';
                });
                
                message += `❌ This policy may still fail migration. Consider running "Clean Secrets" or manually removing these references.`;
                this.showInfo(message);
            } else {
                this.showInfo(`✅ No secret references detected in this policy. It should migrate successfully!`);
            }
            
        } catch (error) {
            this.showError('Invalid JSON format: ' + error.message);
        }
    }

    verifyNoSecretsRemain(obj, remainingSecrets, path = '') {
        if (!obj || typeof obj !== 'object') return;

        // Check if this is an array
        if (Array.isArray(obj)) {
            obj.forEach((item, index) => {
                this.verifyNoSecretsRemain(item, remainingSecrets, `${path}[${index}]`);
            });
            return;
        }

        // Process each property in the object
        for (const [key, value] of Object.entries(obj)) {
            const currentPath = path ? `${path}.${key}` : key;
            
            // Check for secret reference patterns
            if (this.isSecretReference(key, value)) {
                remainingSecrets.push({
                    path: currentPath,
                    key: key,
                    value: typeof value === 'string' && value.length > 100 ? `${value.substring(0, 50)}...` : value
                });
            }

            // Recursively process nested objects
            if (value && typeof value === 'object') {
                this.verifyNoSecretsRemain(value, remainingSecrets, currentPath);
            }
        }
    }

    showInfo(message) {
        // Create a temporary notification or use existing error system with info styling
        console.log('INFO:', message);
        
        // You could implement a toast notification system here
        // For now, we'll use a simple alert
        alert(message);
    }

    // ===== ERROR MANAGEMENT =====
    showErrorPanel() {
        const errorPanel = document.getElementById('errorPanel');
        if (errorPanel) {
            errorPanel.style.display = 'block';
        }
        this.updateErrorCount();
    }

    hideErrorPanel() {
        const errorPanel = document.getElementById('errorPanel');
        if (errorPanel) {
            errorPanel.style.display = 'none';
        }
    }

    addError(errorId, error) {
        this.errors.set(errorId, error);
        this.updateErrorPanel();
        this.showErrorPanel();
    }

    removeError(errorId) {
        this.errors.delete(errorId);
        if (this.errors.size === 0) {
            this.hideErrorPanel();
        } else {
            this.updateErrorPanel();
        }
    }

    updateErrorPanel() {
        const errorContent = document.getElementById('errorContent');
        if (!errorContent) return;

        errorContent.innerHTML = '';
        
        this.errors.forEach((error, errorId) => {
            const errorItem = document.createElement('div');
            
            // Apply different styling for post-migration tasks vs actual errors
            if (error.isTask) {
                errorItem.className = 'error-item task-item';
                errorItem.innerHTML = `
                    <div class="task-summary">
                        <i class="fas fa-clipboard-check task-icon"></i>
                        <strong>${error.title}</strong>
                        <span class="task-time">${new Date(error.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div class="task-details">${error.message.replace(/\n/g, '<br>')}</div>
                    <div class="task-actions">
                        <button class="task-dismiss-btn" data-error-id="${errorId}">
                            <i class="fas fa-check"></i> Mark as Complete
                        </button>
                    </div>
                `;
            } else {
                errorItem.className = 'error-item';
                
                // Determine error type styling
                const errorTypeClass = error.type === 'warning' ? 'warning-item' : '';
                if (errorTypeClass) {
                    errorItem.className += ` ${errorTypeClass}`;
                }
                
                // Build error HTML
                let actionsHTML = '';
                
                if (error.actionButton) {
                    actionsHTML += `
                        <button class="error-action-btn" data-error-id="${errorId}" data-action="custom">
                            <i class="fas fa-tools"></i> ${error.actionButton.text}
                        </button>
                    `;
                }
                
                if (error.retryAction) {
                    actionsHTML += `
                        <button class="error-retry-btn" data-error-id="${errorId}">
                            <i class="fas fa-redo"></i> Retry
                        </button>
                    `;
                }
                
                actionsHTML += `
                    <button class="error-dismiss-btn" data-error-id="${errorId}">
                        <i class="fas fa-times"></i> Dismiss
                    </button>
                `;
                
                errorItem.innerHTML = `
                    <div class="error-summary">
                        <strong>${error.title}</strong>
                        <span class="error-time">${new Date(error.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div class="error-details">${error.message}</div>
                    <div class="error-technical">${error.technical || ''}</div>
                    ${error.solution ? `<div class="error-solution"><strong>Solution:</strong> ${error.solution}</div>` : ''}
                    <div class="error-actions">
                        ${actionsHTML}
                    </div>
                `;
            }
            errorContent.appendChild(errorItem);
        });

        this.updateErrorCount();
    }

    updateErrorCount() {
        const errorCount = document.getElementById('errorCount');
        if (errorCount) {
            errorCount.textContent = this.errors.size;
        }
    }

    retryError(errorId) {
        const error = this.errors.get(errorId);
        if (error && error.retryAction) {
            error.retryAction();
            this.removeError(errorId);
        }
    }

    retryAllErrors() {
        this.errors.forEach((error, errorId) => {
            if (error.retryAction) {
                error.retryAction();
            }
        });
        this.errors.clear();
        this.hideErrorPanel();
    }

    // ===== UI STATE MANAGEMENT =====
    showLoadingState() {
        const loadingState = document.getElementById('loadingState');
        const emptyState = document.getElementById('emptyState');
        
        if (loadingState) loadingState.style.display = 'flex';
        if (emptyState) emptyState.style.display = 'none';
    }

    hideLoadingState() {
        const loadingState = document.getElementById('loadingState');
        if (loadingState) loadingState.style.display = 'none';
    }

    updatePolicyStats() {
        const totalCount = document.getElementById('totalPoliciesCount');
        const migratedCount = document.getElementById('migratedPoliciesCount');

        if (totalCount) totalCount.textContent = this.policies.size;
        if (migratedCount) {
            // This would be calculated based on actual migration status
            migratedCount.textContent = '0';
        }
    }

    updatePolicyStatus(policyId, status) {
        // Update policy status in the table
        const row = document.querySelector(`tr[data-policy-id="${policyId}"]`);
        if (row) {
            const statusElement = row.querySelector('.migration-status');
            if (statusElement) {
                const statusInfo = this.getStatusInfo(status);
                statusElement.className = `migration-status ${statusInfo.class}`;
                statusElement.innerHTML = `<i class="${statusInfo.icon}"></i> ${statusInfo.text}`;
            }
        }
    }

    getStatusInfo(status) {
        switch (status) {
            case 'pending':
                return { class: 'pending', icon: 'fas fa-clock', text: 'Migrating...' };
            case 'success':
                return { class: 'success', icon: 'fas fa-check', text: 'Completed' };
            case 'error':
                return { class: 'error', icon: 'fas fa-times', text: 'Failed' };
            default:
                return { class: 'not-started', icon: 'fas fa-circle', text: 'Ready' };
        }
    }

    // ===== SOCKET EVENT HANDLERS =====
    handleDualTenantInitialized(data) {
        console.log('Dual tenant initialized:', data);
        this.updateConnectionStatus(data.status);
    }

    handleDualTenantStatus(data) {
        console.log('Dual tenant status:', data);
        this.updateConnectionStatus(data);
    }

    handleDualTenantError(data) {
        console.error('Dual tenant error:', data);
        this.showError(`Connection error: ${data.error}`);
        this.logMessage('error', `Connection failed: ${data.error}`);
        
        const setupBtn = document.getElementById('setupTenantsBtn');
        this.setButtonLoading(setupBtn, false);
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

        this.renderPolicyTable();
        this.updatePolicyStats();
        
        const loadBtn = document.getElementById('loadPoliciesBtn');
        this.setButtonLoading(loadBtn, false);
        this.hideLoadingState();
        
        this.logMessage('success', `Loaded ${data.count} policies from source tenant`);
    }

    handleSourcePoliciesError(data) {
        console.error('Error loading source policies:', data);
        const loadBtn = document.getElementById('loadPoliciesBtn');
        this.setButtonLoading(loadBtn, false);
        this.hideLoadingState();
        this.logMessage('error', `Failed to load policies: ${data.error}`);
        this.showError('Failed to load source policies: ' + data.error);
    }

    handlePolicyCloned(data) {
        console.log('Policy cloned successfully:', data);
        
        // Basic success handling
        this.logMessage('success', `Successfully cloned: ${data.policyName}`);
        this.updatePolicyStatus(data.sourcePolicyId, 'success');
        
        // Handle secret references if any were removed
        if (data.secretReferencesRemoved && data.secretReferencesRemoved.length > 0) {
            this.handleSecretReferencesRemoved(data);
        }
        
        this.updatePolicyStats();
    }

    handleSecretReferencesRemoved(data) {
        const count = data.secretReferencesRemoved.length;
        const policyName = data.policyName;
        
        // Log informational message about secret references
        this.logMessage('warning', `⚠️ ${policyName}: ${count} secret reference${count === 1 ? '' : 's'} removed - manual configuration required`);
        
        // Create detailed guidance message
        let guidanceMessage = `🔐 Policy "${policyName}" was migrated successfully, but ${count} secret reference${count === 1 ? ' was' : 's were'} automatically removed:\n\n`;
        
        data.secretReferencesRemoved.forEach((ref, index) => {
            guidanceMessage += `${index + 1}. ${ref.key} (${ref.type})\n   📝 ${ref.description}\n\n`;
        });
        
        guidanceMessage += `✅ Next Steps:\n`;
        guidanceMessage += `1. Go to your target tenant's Intune portal\n`;
        guidanceMessage += `2. Find the migrated policy: "${policyName}"\n`;
        guidanceMessage += `3. Configure the secret values listed above\n`;
        guidanceMessage += `4. Save and assign the policy as needed`;
        
        // Add to a special section for post-migration tasks
        this.addPostMigrationTask(data.sourcePolicyId, {
            title: `Configure Secrets for "${policyName}"`,
            message: guidanceMessage,
            policyId: data.targetPolicyId,
            secretReferences: data.secretReferencesRemoved,
            timestamp: Date.now()
        });
        
        console.log('Secret references removed:', data.secretReferencesRemoved);
    }

    addPostMigrationTask(policyId, task) {
        // For now, we'll add it to the error panel but with a different styling
        // In a full implementation, you might want a separate "Post-Migration Tasks" panel
        this.addError(policyId, {
            ...task,
            type: 'post-migration-task',
            isTask: true
        });
    }

    handlePolicyCloneFailed(data) {
        console.error('Policy clone failed:', data);
        this.logMessage('error', `Failed to clone policy ${data.policyId}: ${data.error}`);
        this.updatePolicyStatus(data.policyId, 'error');
        
        // Add to error panel
        this.addError(data.policyId, {
            title: 'Policy Migration Failed',
            message: `Failed to migrate policy: ${data.error}`,
            technical: data.technical || '',
            timestamp: Date.now(),
            retryAction: () => {
                const policy = this.policies.get(data.policyId);
                if (policy) {
                    this.clonePolicy(data.policyId, policy.policyType);
                }
            }
        });
    }

    handlePolicyWarning(data) {
        console.warn('Policy warning:', data);
        this.logMessage('warning', `Policy warning: ${data.message}`);
        
        // Show warning in error panel
        this.addError('policy-warning', {
            title: 'Policy Contains Secret References',
            message: data.message,
            technical: `Found ${data.details?.length || 0} secret references that need to be cleaned.`,
            timestamp: Date.now(),
            type: 'warning'
        });
    }

    handlePolicySecretError(data) {
        console.error('Policy secret reference error:', data);
        this.logMessage('error', `Secret reference error: ${data.message}`);
        
        // Show detailed secret error in error panel
        this.addError('secret-reference-error', {
            title: 'Secret Reference Error',
            message: data.message,
            technical: `Graph API Error: ${data.error}`,
            solution: data.solution,
            timestamp: Date.now(),
            type: 'error',
            actionButton: {
                text: 'Clean Secrets',
                action: () => {
                    const cleanBtn = document.getElementById('cleanSecretsBtn');
                    if (cleanBtn) {
                        cleanBtn.click();
                        // Scroll to JSON editor
                        const jsonContainer = document.getElementById('jsonContainer');
                        if (jsonContainer) {
                            jsonContainer.scrollIntoView({ behavior: 'smooth' });
                        }
                    }
                }
            }
        });
    }

    handlePolicyClonePermissionRequired(data) {
        console.warn('Policy clone requires additional permissions:', data);
        this.logMessage('warning', `Policy clone requires additional permissions: ${data.message}`);
        this.updatePolicyStatus(data.policyId, 'error');
        
        // Add to error panel with permission-specific info
        this.addError(data.policyId, {
            title: 'Additional Permissions Required',
            message: 'Policy migration requires additional permissions.',
            technical: data.error,
            timestamp: Date.now(),
            retryAction: () => {
                // This would trigger permission request flow
                this.requestAdditionalPermissions(data.tenantRole, data.tenantDomain);
            }
        });
    }

    handlePermissionsRequested(data) {
        console.log('Additional permissions requested:', data);
        this.logMessage('system', `Additional permissions requested for ${data.tenantRole} tenant (${data.tenantDomain})`);
        this.logMessage('system', `Required scopes: ${data.requiredScopes.join(', ')}`);
    }

    handlePermissionRequestFailed(data) {
        console.error('Permission request failed:', data);
        this.logMessage('error', `Failed to request additional permissions for ${data.tenantRole} tenant: ${data.error}`);
    }

    handleAuthStatusChanged(data) {
        console.log('Auth status changed:', data);
        
        const tenantType = data.tenantRole || (data.tenantDomain === this.sourceTenant ? 'source' : 'target');
        
        if (data.status === 'authenticated') {
            this.authStatus[tenantType] = 'authenticated';
            this.logMessage('success', `${tenantType} tenant (${data.tenantDomain}) authenticated successfully`);
        } else if (data.status === 'needs_authentication') {
            this.authStatus[tenantType] = 'pending';
            this.logMessage('system', `${tenantType} tenant requires authentication`);
        } else if (data.status === 'authentication_error') {
            this.authStatus[tenantType] = 'error';
            this.logMessage('error', `${tenantType} tenant authentication failed`);
        }
        
        this.checkBothTenantsAuthenticated();
        this.updateTenantHeader();
    }

    // ===== CONNECTION STATUS =====
    updateConnectionStatus(status) {
        console.log('Updating connection status:', status);
        
        const bothAuthenticated = status?.isActive && 
                                status?.sourceTenant?.authenticated && 
                                status?.targetTenant?.authenticated;

        if (bothAuthenticated || (this.authStatus.source === 'authenticated' && this.authStatus.target === 'authenticated')) {
            this.isConnected = true;
            this.showPolicyDashboard();
            this.logMessage('success', 'Both tenants connected successfully');
        }
        
        this.updateTenantHeader();
        this.updateConnectButton();
    }

    checkBothTenantsAuthenticated() {
        if (this.authStatus.source === 'authenticated' && this.authStatus.target === 'authenticated') {
            this.isConnected = true;
            this.showPolicyDashboard();
            this.logMessage('success', 'Both tenants authenticated successfully');
        }
    }

    // ===== UTILITY METHODS =====
    generateSessionId() {
        return 'policy-dashboard-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now();
    }

    isValidDomain(domain) {
        // Accept any valid domain format including:
        // - standard domains like contoso.com, fabrikam.net
        // - onmicrosoft.com domains like tenant.onmicrosoft.com
        // - subdomains like subdomain.contoso.com
        const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
        
        // Basic checks
        if (!domain || typeof domain !== 'string') return false;
        if (domain.length > 253) return false;
        if (domain.startsWith('.') || domain.endsWith('.')) return false;
        if (domain.includes('..')) return false;
        
        return domainRegex.test(domain);
    }

    formatPolicyType(policyType) {
        const typeMap = {
            'deviceConfiguration': 'Device Configuration',
            'deviceCompliance': 'Device Compliance',
            'appProtection': 'App Protection',
            'managedApp': 'Managed App',
            'deviceConfigurations': 'Device Configuration',
            'deviceCompliancePolicies': 'Device Compliance',
            'appProtectionPolicies': 'App Protection',
            'managedAppPolicies': 'Managed App'
        };
        return typeMap[policyType] || policyType;
    }

    setButtonLoading(button, loading) {
        if (!button) return;

        const spinner = button.querySelector('.btn-spinner');
        const text = button.querySelector('span');
        const icon = button.querySelector('i:not(.btn-spinner i)');

        if (loading) {
            button.disabled = true;
            if (spinner) spinner.style.display = 'block';
            if (text) text.style.display = 'none';
            if (icon) icon.style.display = 'none';
        } else {
            button.disabled = false;
            if (spinner) spinner.style.display = 'none';
            if (text) text.style.display = 'inline';
            if (icon) icon.style.display = 'inline';
        }
    }

    showError(message) {
        // Create a temporary notification for immediate errors
        const notification = document.createElement('div');
        notification.className = 'error-notification';
        notification.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <span>${message}</span>
        `;
        notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: rgba(239, 68, 68, 0.9);
            color: white;
            padding: 1rem;
            border-radius: 8px;
            z-index: 1000;
            max-width: 400px;
            animation: slideInRight 0.3s ease;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

    logMessage(type, message) {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[${timestamp}] ${type.toUpperCase()}: ${message}`);
        
        // Add to migration log
        this.migrationLog.push({
            timestamp: Date.now(),
            type: type,
            message: message
        });
    }
}

// Initialize the dashboard when the page loads
// Initialize dashboard when DOM is ready
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new PolicyMigrationDashboard();
});
