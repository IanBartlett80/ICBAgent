// Zero Trust Assessment Main Component
// File: public/js/zero-trust-assessment.js

class ZeroTrustAssessment {
    constructor(icbAgent) {
        console.log('🔧 ZeroTrustAssessment constructor called with:', icbAgent);
        
        this.icbAgent = icbAgent;
        
        // Check if required classes are available
        console.log('🔍 ZeroTrustAssessment constructor - checking dependencies:');
        console.log('  - ZeroTrustGraphService:', typeof ZeroTrustGraphService);
        console.log('  - ZeroTrustAssessmentEngine:', typeof ZeroTrustAssessmentEngine);
        
        try {
            this.graphService = new ZeroTrustGraphService();
            console.log('✅ ZeroTrustGraphService created successfully');
        } catch (error) {
            console.error('❌ Failed to create ZeroTrustGraphService:', error);
            throw error;
        }
        
        try {
            this.assessmentEngine = new ZeroTrustAssessmentEngine();
            console.log('✅ ZeroTrustAssessmentEngine created successfully');
        } catch (error) {
            console.error('❌ Failed to create ZeroTrustAssessmentEngine:', error);
            throw error;
        }
        
        this.currentAssessment = null;
        this.assessmentHistory = [];
        this.isRunning = false;
        
        console.log('🔧 ZeroTrustAssessment: Initializing UI...');
        this.initializeUI();
        console.log('🔧 ZeroTrustAssessment: Binding events...');
        this.bindEvents();
        
        console.log('✅ Zero Trust Assessment component initialized successfully');
    }

    initializeUI() {
        console.log('ZeroTrustAssessment: Initializing UI...');
        // Create the Zero Trust Assessment UI elements
        this.createAssessmentInterface();
        this.createProgressIndicator();
        this.createResultsInterface();
        this.createNotesInterface();
        console.log('ZeroTrustAssessment: UI initialization complete');
    }

    createAssessmentInterface() {
        const assessmentHTML = `
            <div id="zero-trust-assessment" class="feature-section" style="display: none;">
                <div class="section-header">
                    <h2>🛡️ Zero Trust Assessment</h2>
                    <p>Comprehensive security posture evaluation for your Microsoft 365 environment</p>
                </div>

                <div class="assessment-controls">
                    <div class="control-group">
                        <button id="start-assessment-btn" class="primary-button">
                            <span class="button-icon">🚀</span>
                            Start Assessment
                        </button>
                        <button id="view-history-btn" class="secondary-button">
                            <span class="button-icon">📊</span>
                            View History
                        </button>
                        <button id="export-report-btn" class="secondary-button" disabled>
                            <span class="button-icon">📄</span>
                            Export Report
                        </button>
                    </div>
                    
                    <div class="assessment-status">
                        <div id="last-assessment-info" class="status-info">
                            <span class="status-label">Last Assessment:</span>
                            <span id="last-assessment-date">Never</span>
                        </div>
                        <div id="overall-score-display" class="score-display" style="display: none;">
                            <span class="score-label">Overall Score:</span>
                            <span id="overall-score-value" class="score-value">--</span>
                        </div>
                    </div>
                </div>

                <div id="assessment-progress" class="progress-container" style="display: none;">
                    <div class="progress-header">
                        <h3 id="progress-title">Starting Assessment...</h3>
                        <span id="progress-percentage">0%</span>
                    </div>
                    <div class="progress-bar">
                        <div id="progress-fill" class="progress-fill"></div>
                    </div>
                    <div id="progress-status" class="progress-status">
                        Initializing...
                    </div>
                </div>

                <div id="assessment-results" class="results-container" style="display: none;">
                    <!-- Results will be dynamically populated -->
                </div>

                <div id="administrator-notes" class="notes-container" style="display: none;">
                    <div class="notes-header">
                        <h3>📝 Administrator Notes</h3>
                        <button id="save-notes-btn" class="save-button">Save Notes</button>
                    </div>
                    <div class="notes-editor">
                        <textarea id="notes-textarea" placeholder="Add your notes about this assessment, recommendations for remediation, or other observations..."></textarea>
                    </div>
                </div>
            </div>
        `;

        // Insert into the main content area
        const mainContent = document.querySelector('.main-content') || document.body;
        console.log('ZeroTrustAssessment: Inserting UI into:', mainContent);
        mainContent.insertAdjacentHTML('beforeend', assessmentHTML);
        console.log('ZeroTrustAssessment: Assessment interface HTML inserted');
    }

    createProgressIndicator() {
        // Progress indicator is created in the main interface
        // This method could be used for additional progress UI elements
    }

    createResultsInterface() {
        // Results interface is dynamically created in showResults method
    }

    createNotesInterface() {
        // Notes interface is created in the main interface
        // This method could be used for rich text editor initialization
    }

    bindEvents() {
        // Bind assessment control events
        document.getElementById('start-assessment-btn')?.addEventListener('click', () => {
            this.startAssessment();
        });

        document.getElementById('view-history-btn')?.addEventListener('click', () => {
            this.showAssessmentHistory();
        });

        document.getElementById('export-report-btn')?.addEventListener('click', () => {
            this.exportReport();
        });

        document.getElementById('save-notes-btn')?.addEventListener('click', () => {
            this.saveNotes();
        });

        // Bind to ICB Agent connection events
        if (this.icbAgent.socket) {
            this.icbAgent.socket.on('graph-token-received', (token) => {
                this.handleGraphToken(token);
            });
            
            // Set up permission event listeners
            this.setupPermissionEventListeners();
        }
    }

    async startAssessment() {
        if (this.isRunning) {
            this.icbAgent.showNotification('Assessment already in progress', 'warning');
            return;
        }

        try {
            this.isRunning = true;
            this.showProgress();
            
            // Verify session is available
            if (!this.icbAgent.sessionId) {
                throw new Error('No active session. Please connect to a tenant first.');
            }

            // Initialize Graph service with session ID (already done in app.js)
            this.updateProgress(5, 'Initializing Graph API service...');
            if (!this.graphService.sessionId) {
                this.graphService.initialize(this.icbAgent.sessionId);
            }

            // Test connectivity by making a simple API call
            this.updateProgress(10, 'Verifying Microsoft Graph connectivity...');
            try {
                await this.graphService.makeGraphRequest('organization');
            } catch (error) {
                // Handle permission errors in the connectivity test
                if (error.isPermissionError) {
                    this.hideProgress();
                    
                    // Show permission error message instead of attempting retry
                    this.icbAgent.addMessage(`🔐 **Permission Required for Zero Trust Assessment**

**Cannot connect to Microsoft Graph - missing permissions**

The Zero Trust Assessment requires basic Microsoft Graph permissions to access organization information.

**Required permissions:**
${(error.requiredScopes || ['Organization.Read.All']).map(p => `• **${p}**`).join('\n')}

**To resolve this:**
1. Please send a message requesting these permissions
2. The system will open Microsoft consent window
3. Approve the requested permissions
4. Run the assessment again

**Example message:** "Please approve Microsoft Graph permissions: ${(error.requiredScopes || ['Organization.Read.All']).join(', ')}"`, 'system');
                    
                    return; // Don't retry automatically
                }
                throw new Error('Failed to connect to Microsoft Graph. Please ensure you are properly authenticated.');
            }

            // Collect data
            this.updateProgress(15, 'Collecting assessment data...');
            let assessmentData;
            try {
                assessmentData = await this.graphService.collectAllAssessmentData(
                    (progress) => {
                        const percentage = 15 + (progress.percentage * 0.6); // 15-75%
                        this.updateProgress(percentage, `Collecting ${progress.currentTask}...`);
                    }
                );
            } catch (error) {
                console.log('🔍 Data collection error details:', {
                    message: error.message,
                    isPermissionError: error.isPermissionError,
                    dataType: error.dataType,
                    requiredScopes: error.requiredScopes,
                    stack: error.stack
                });
                
                // Handle catastrophic permission errors (should be rare now)
                if (error.isPermissionError) {
                    console.log('🔒 Handling critical permission error for data type:', error.dataType);
                    this.hideProgress();
                    
                    // Show permission error message instead of attempting retry
                    this.icbAgent.addMessage(`🔐 **Critical Permission Required for Zero Trust Assessment**

**Missing permissions for ${error.dataType} data collection**

The Zero Trust Assessment requires additional Microsoft Graph permissions to access ${error.dataType} information.

**Required permissions:**
${(error.requiredScopes || []).map(p => `• **${p}**`).join('\n')}

**To resolve this:**
1. Please send a message requesting these permissions
2. The system will open Microsoft consent window
3. Approve the requested permissions
4. Run the assessment again

**Example message:** "Please approve Microsoft Graph permissions: ${(error.requiredScopes || []).join(', ')}"`, 'system');
                    
                    return; // Don't retry automatically
                }
                throw error;
            }

            // Check for permission errors in the collected data
            if (assessmentData.metadata && assessmentData.metadata.permissionErrors && assessmentData.metadata.permissionErrors.length > 0) {
                const permissionErrors = assessmentData.metadata.permissionErrors;
                const uniqueScopes = [...new Set(permissionErrors.flatMap(e => e.requiredScopes || []))];
                const missingDataTypes = permissionErrors.map(e => e.dataType || e.taskName).join(', ');
                
                console.log('🔒 Permission errors found in assessment data:', permissionErrors);
                console.log('🔒 Unique scopes needed:', uniqueScopes);
                
                // Stop the assessment and request permissions
                this.hideProgress();
                
                this.icbAgent.addMessage(`🔐 **Additional Permissions Required for Complete Zero Trust Assessment**

**Missing data for:** ${missingDataTypes}

The Zero Trust Assessment requires additional Microsoft Graph permissions to collect complete security data.

**Missing permissions:**
${uniqueScopes.map(p => `• **${p}**`).join('\n')}

**Requesting permissions now...**

A browser window will open for you to approve these permissions. Once approved, the assessment will automatically restart with complete data collection.`, 'system');

                // Request the missing permissions
                try {
                    await this.requestMissingPermissions(uniqueScopes);
                } catch (error) {
                    console.error('Failed to request permissions:', error);
                    this.icbAgent.addMessage(`❌ **Permission Request Failed**

Unable to request the required permissions: ${error.message}

Please try running the assessment again or contact your administrator.`, 'system');
                }
                
                return; // Stop the current assessment
            }

            // Perform assessment
            this.updateProgress(75, 'Analyzing security posture...');
            const assessmentResults = await this.assessmentEngine.performAssessment(
                assessmentData,
                (progress) => {
                    const percentage = 75 + (progress.percentage * 0.2); // 75-95%
                    this.updateProgress(percentage, `Analyzing ${progress.currentTask}...`);
                }
            );

            // Finalize and display results
            this.updateProgress(95, 'Generating report...');
            await this.sleep(500); // Brief pause for UI
            
            this.currentAssessment = assessmentResults;
            this.assessmentHistory.unshift(assessmentResults);
            
            this.updateProgress(100, 'Assessment complete!');
            await this.sleep(1000);
            
            this.hideProgress();
            this.showResults(assessmentResults);
            this.updateAssessmentInfo(assessmentResults);
            
            this.icbAgent.showNotification('Zero Trust Assessment completed successfully', 'success');
            
        } catch (error) {
            console.error('Assessment failed:', error);
            this.hideProgress();
            this.icbAgent.showError('Assessment failed: ' + error.message);
        } finally {
            this.isRunning = false;
        }
    }

    handleGraphToken(token) {
        // This method is no longer needed as we use session-based authentication
        console.log('Graph token handling is managed by ICB Agent MCP client');
    }

    /**
     * Request missing permissions for Zero Trust Assessment
     * @param {Array} requiredScopes - Array of required Graph API scopes
     */
    async requestMissingPermissions(requiredScopes) {
        try {
            console.log('🔐 Requesting missing permissions:', requiredScopes);
            
            // Set up socket event listeners before making the request
            this.setupPermissionEventListeners();
            
            const response = await fetch('/api/zero-trust-assessment/request-permissions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionId: this.icbAgent.sessionId,
                    requiredScopes: requiredScopes
                })
            });

            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'Failed to request permissions');
            }

            console.log('✅ Permission request initiated successfully');
            
        } catch (error) {
            console.error('❌ Failed to request permissions:', error);
            throw error;
        }
    }

    /**
     * Set up socket event listeners for permission flow
     */
    setupPermissionEventListeners() {
        if (!this.icbAgent.socket) {
            console.error('Socket not available for permission events');
            return;
        }

        // Remove any existing listeners to avoid duplicates
        this.icbAgent.socket.off('zero_trust_permissions_requested');
        this.icbAgent.socket.off('zero_trust_permission_request_failed');
        this.icbAgent.socket.off('zero_trust_permissions_granted');

        // Handle permission request initiated
        this.icbAgent.socket.on('zero_trust_permissions_requested', (data) => {
            console.log('🔐 Permission request initiated:', data);
            this.icbAgent.addMessage(`🔐 **Permission Consent Window Opened**

A new browser window has been opened for you to approve the required Microsoft Graph permissions:

${data.requiredScopes.map(p => `• **${p}**`).join('\n')}

**Please:**
1. Switch to the new browser window
2. Review the requested permissions
3. Click "Accept" to approve them
4. Return to this window

Once you approve the permissions, the Zero Trust Assessment will automatically restart with complete data collection.

*Waiting for permission approval...*`, 'system');
        });

        // Handle permission request failure
        this.icbAgent.socket.on('zero_trust_permission_request_failed', (data) => {
            console.error('❌ Permission request failed:', data);
            this.icbAgent.addMessage(`❌ **Permission Request Failed**

Failed to initiate permission request: ${data.error}

Please try running the assessment again or contact your administrator.`, 'system');
        });

        // Handle successful permission grant (this should trigger assessment restart)
        this.icbAgent.socket.on('zero_trust_permissions_granted', (data) => {
            console.log('✅ Permissions granted, restarting assessment:', data);
            this.icbAgent.addMessage(`✅ **Permissions Approved Successfully**

The required Microsoft Graph permissions have been approved. Restarting the Zero Trust Assessment with complete data collection...`, 'system');
            
            // Clear any previous partial results and restart assessment
            this.currentAssessment = null;
            
            // Restart the assessment after a brief delay
            setTimeout(() => {
                this.startAssessment();
            }, 2000);
        });
    }

    showProgress() {
        document.getElementById('assessment-progress').style.display = 'block';
        document.getElementById('assessment-results').style.display = 'none';
        document.getElementById('administrator-notes').style.display = 'none';
        
        // Disable start button
        const startBtn = document.getElementById('start-assessment-btn');
        if (startBtn) {
            startBtn.disabled = true;
            startBtn.innerHTML = '<span class="button-icon">⏳</span>Running...';
        }
    }

    updateProgress(percentage, status) {
        const progressFill = document.getElementById('progress-fill');
        const progressPercentage = document.getElementById('progress-percentage');
        const progressStatus = document.getElementById('progress-status');

        if (progressFill) progressFill.style.width = `${percentage}%`;
        if (progressPercentage) progressPercentage.textContent = `${Math.round(percentage)}%`;
        if (progressStatus) progressStatus.textContent = status;
    }

    hideProgress() {
        document.getElementById('assessment-progress').style.display = 'none';
        
        // Re-enable start button
        const startBtn = document.getElementById('start-assessment-btn');
        if (startBtn) {
            startBtn.disabled = false;
            startBtn.innerHTML = '<span class="button-icon">🚀</span>Start Assessment';
        }
    }

    showResults(results) {
        const resultsContainer = document.getElementById('assessment-results');
        if (!resultsContainer) return;

        const resultsHTML = this.generateResultsHTML(results);
        resultsContainer.innerHTML = resultsHTML;
        resultsContainer.style.display = 'block';
        
        // Show administrator notes
        document.getElementById('administrator-notes').style.display = 'block';
        
        // Enable export button
        const exportBtn = document.getElementById('export-report-btn');
        if (exportBtn) exportBtn.disabled = false;
        
        // Bind result interaction events
        this.bindResultEvents();
    }

    generateResultsHTML(results) {
        const overallRating = results.overallRating;
        const categories = results.categories;

        return `
            <div class="results-header">
                <div class="overall-score">
                    <div class="score-circle" style="border-color: ${overallRating.color}">
                        <span class="score-number">${results.overallScore}</span>
                        <span class="score-suffix">%</span>
                    </div>
                    <div class="score-details">
                        <h3>Overall Security Score</h3>
                        <p class="score-rating" style="color: ${overallRating.color}">${overallRating.label}</p>
                        <p class="assessment-date">Assessed on ${new Date(results.metadata.assessmentDate).toLocaleDateString()}</p>
                    </div>
                </div>
                
                <div class="assessment-summary">
                    <div class="summary-stats">
                        <div class="stat">
                            <span class="stat-number">${results.metadata.totalDataPoints}</span>
                            <span class="stat-label">Data Points</span>
                        </div>
                        <div class="stat">
                            <span class="stat-number">${results.criticalFindings.length}</span>
                            <span class="stat-label">Critical Issues</span>
                        </div>
                        <div class="stat">
                            <span class="stat-number">${results.recommendations.length}</span>
                            <span class="stat-label">Recommendations</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="category-results">
                ${Object.entries(categories).map(([key, category]) => this.generateCategoryHTML(key, category)).join('')}
            </div>

            <div class="recommendations-section">
                <h3>🎯 Key Recommendations</h3>
                <div class="recommendations-list">
                    ${results.recommendations.map(rec => `
                        <div class="recommendation-item">
                            <span class="recommendation-icon">💡</span>
                            <span class="recommendation-text">${rec}</span>
                        </div>
                    `).join('')}
                </div>
            </div>

            ${results.criticalFindings.length > 0 ? `
                <div class="critical-findings-section">
                    <h3>🚨 Critical Findings</h3>
                    <div class="critical-findings-list">
                        ${results.criticalFindings.map(finding => `
                            <div class="critical-finding-item">
                                <span class="finding-icon">⚠️</span>
                                <div class="finding-content">
                                    <p class="finding-message">${finding.message}</p>
                                    <p class="finding-impact">${finding.impact}</p>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
        `;
    }

    generateCategoryHTML(key, category) {
        const rating = category.rating;
        
        return `
            <div class="category-card" data-category="${key}">
                <div class="category-header">
                    <div class="category-score" style="color: ${rating.color}">
                        <span class="score">${category.score}%</span>
                        <span class="rating">${rating.label}</span>
                    </div>
                    <div class="category-info">
                        <h4>${category.name}</h4>
                        <p>${category.findings?.length || 0} findings</p>
                    </div>
                    <button class="expand-btn" onclick="toggleCategoryDetails('${key}')">
                        <span class="expand-icon">▼</span>
                    </button>
                </div>
                
                <div class="category-details" id="details-${key}" style="display: none;">
                    <div class="subcategories">
                        ${Object.entries(category.subcategories || {}).map(([subKey, subCategory]) => `
                            <div class="subcategory">
                                <div class="subcategory-header">
                                    <span class="subcategory-name">${subKey}</span>
                                    <span class="subcategory-score">${subCategory.score}%</span>
                                </div>
                                <div class="subcategory-findings">
                                    ${(subCategory.findings || []).map(finding => `
                                        <div class="finding finding-${finding.type}">
                                            <span class="finding-message">${finding.message}</span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    bindResultEvents() {
        // Category expansion events are handled by global function
        // Additional result interaction events can be added here
    }

    updateAssessmentInfo(results) {
        const lastAssessmentDate = document.getElementById('last-assessment-date');
        const overallScoreDisplay = document.getElementById('overall-score-display');
        const overallScoreValue = document.getElementById('overall-score-value');

        if (lastAssessmentDate) {
            lastAssessmentDate.textContent = new Date(results.metadata.assessmentDate).toLocaleString();
        }

        if (overallScoreDisplay) {
            overallScoreDisplay.style.display = 'flex';
        }

        if (overallScoreValue) {
            overallScoreValue.textContent = `${results.overallScore}%`;
            overallScoreValue.style.color = results.overallRating.color;
        }
    }

    showAssessmentHistory() {
        if (this.assessmentHistory.length === 0) {
            this.icbAgent.showNotification('No assessment history available', 'info');
            return;
        }

        // Create and show history modal
        const historyHTML = this.generateHistoryHTML();
        this.icbAgent.showModal('Assessment History', historyHTML);
    }

    generateHistoryHTML() {
        return `
            <div class="assessment-history">
                ${this.assessmentHistory.map((assessment, index) => `
                    <div class="history-item ${index === 0 ? 'current' : ''}">
                        <div class="history-header">
                            <span class="history-date">${new Date(assessment.metadata.assessmentDate).toLocaleString()}</span>
                            <span class="history-score" style="color: ${assessment.overallRating.color}">
                                ${assessment.overallScore}% (${assessment.overallRating.label})
                            </span>
                        </div>
                        <div class="history-summary">
                            <span>${assessment.metadata.totalDataPoints} data points analyzed</span>
                            <span>${assessment.criticalFindings.length} critical findings</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    async exportReport() {
        if (!this.currentAssessment) {
            this.icbAgent.showNotification('No assessment results to export', 'warning');
            return;
        }

        try {
            // Generate export data
            const exportData = {
                assessment: this.currentAssessment,
                exportDate: new Date().toISOString(),
                notes: document.getElementById('notes-textarea')?.value || ''
            };

            // Create downloadable report
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
                type: 'application/json' 
            });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `zero-trust-assessment-${new Date().toISOString().split('T')[0]}.json`;
            
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
            
            this.icbAgent.showNotification('Assessment report exported successfully', 'success');
            
        } catch (error) {
            console.error('Export failed:', error);
            this.icbAgent.showError('Failed to export report: ' + error.message);
        }
    }

    saveNotes() {
        const notes = document.getElementById('notes-textarea')?.value || '';
        
        if (this.currentAssessment) {
            this.currentAssessment.administratorNotes = notes;
            this.currentAssessment.notesLastModified = new Date().toISOString();
        }

        // Save to local storage as backup
        localStorage.setItem('zt-assessment-notes', notes);
        
        this.icbAgent.showNotification('Notes saved successfully', 'success');
    }

    loadNotes() {
        const savedNotes = localStorage.getItem('zt-assessment-notes');
        const notesTextarea = document.getElementById('notes-textarea');
        
        if (savedNotes && notesTextarea) {
            notesTextarea.value = savedNotes;
        }
    }

    // Show/hide the Zero Trust Assessment interface
    show() {
        console.log('ZeroTrustAssessment: Attempting to show interface...');
        const assessmentSection = document.getElementById('zero-trust-assessment');
        console.log('ZeroTrustAssessment: Found element:', assessmentSection);
        if (assessmentSection) {
            assessmentSection.style.display = 'block';
            this.loadNotes();
            console.log('ZeroTrustAssessment: Interface shown successfully');
        } else {
            console.error('ZeroTrustAssessment: Could not find zero-trust-assessment element in DOM');
        }
    }

    hide() {
        const assessmentSection = document.getElementById('zero-trust-assessment');
        if (assessmentSection) {
            assessmentSection.style.display = 'none';
        }
    }

    /**
     * Handle permission errors by using ICB Agent's built-in permission system
     * @param {Error} error - The permission error
     * @param {string} dataType - The data type that requires permissions
     * @param {Function} retryCallback - Function to call after permission approval
     */
    async handlePermissionError(error, dataType, retryCallback) {
        console.log('🔒 Handling permission error for Zero Trust Assessment:', error);
        
        // Get required permissions from error or fallback to service method
        const requiredPermissions = error.requiredScopes || this.graphService.getRequiredPermissions(dataType);
        
        console.log('🔐 Required permissions for', dataType, ':', requiredPermissions);
        
        // Use ICB Agent's built-in permission approval system
        await this.requestPermissionsViaICB(requiredPermissions, dataType, retryCallback);
    }

    /**
     * Request permissions using ICB Agent's built-in system
     * @param {Array<string>} permissions - Required permission scopes
     * @param {string} dataType - The data type requiring permissions
     * @param {Function} retryCallback - Function to call after approval
     */
    async requestPermissionsViaICB(permissions, dataType, retryCallback) {
        console.log('🔑 Requesting permissions via ICB Agent system:', permissions);
        
        // Show user-friendly message about the permission request
        const dataTypeDisplay = dataType.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
        
        this.icbAgent.addMessage(`🔐 **Additional Permissions Required**

**Zero Trust Assessment needs access to ${dataTypeDisplay} data**

The following Microsoft Graph permissions are required:
${permissions.map(p => `• **${p}**`).join('\n')}

**🚀 Opening Microsoft consent window...**

Please review and approve the permissions to continue the assessment.`, 'system');

        // Store the retry callback for after permission approval
        if (retryCallback) {
            this.pendingAssessmentRetry = retryCallback;
            this.monitorZeroTrustPermissionApproval(retryCallback);
        }

        // Use ICB Agent's permission request system
        try {
            // Send message to trigger the existing permission flow
            await this.icbAgent.sendMessage(`Please approve the following Microsoft Graph permissions for Zero Trust Assessment: ${permissions.join(', ')}`);
            
        } catch (error) {
            console.error('❌ Error requesting permissions via ICB Agent:', error);
            this.icbAgent.showError('Failed to request permissions. Please try again.');
        }
    }

    /**
     * Monitor for permission approval and retry assessment (Zero Trust specific)
     * @param {Function} retryCallback - Function to call after approval
     */
    monitorZeroTrustPermissionApproval(retryCallback) {
        console.log('🔍 Starting Zero Trust permission approval monitoring...');
        
        // Listen for ICB Agent's permission approval completion
        if (this.icbAgent.socket) {
            const handlePermissionApproval = () => {
                console.log('✅ Zero Trust permission approval detected!');
                
                // Clear pending retry
                this.pendingAssessmentRetry = null;
                
                // Show success message
                this.icbAgent.addMessage('✅ **Permissions Approved!** \n\nResuming Zero Trust Assessment with the newly granted permissions...', 'system');
                
                // Small delay to ensure permissions are fully propagated
                setTimeout(() => {
                    if (retryCallback) {
                        console.log('🔄 Retrying Zero Trust Assessment after permission approval...');
                        retryCallback();
                    }
                }, 2000);
                
                // Remove the listener to prevent duplicate calls
                this.icbAgent.socket.off('query_rerun_complete', handlePermissionApproval);
            };
            
            // Listen for query rerun completion (indicates permissions were approved)
            this.icbAgent.socket.on('query_rerun_complete', handlePermissionApproval);
        }
        
        // Also monitor authentication status changes as fallback
        const checkInterval = setInterval(async () => {
            try {
                if (!this.pendingAssessmentRetry) {
                    clearInterval(checkInterval);
                    return;
                }
                
                // Check authentication status  
                const response = await fetch(`/api/auth/status/${this.icbAgent.sessionId}`);
                if (response.ok) {
                    const authStatus = await response.json();
                    
                    if (authStatus.isAuthenticated && authStatus.hasToken) {
                        clearInterval(checkInterval);
                        
                        console.log('✅ Zero Trust permission approval detected via polling!');
                        
                        // Clear pending retry
                        this.pendingAssessmentRetry = null;
                        
                        // Show success message
                        this.icbAgent.addMessage('✅ **Permissions Approved!** \n\nResuming Zero Trust Assessment with the newly granted permissions...', 'system');
                        
                        // Small delay to ensure permissions are fully propagated
                        setTimeout(() => {
                            if (retryCallback) {
                                console.log('🔄 Retrying Zero Trust Assessment after permission approval...');
                                retryCallback();
                            }
                        }, 2000);
                    }
                }
            } catch (error) {
                console.error('Error checking permission status:', error);
            }
        }, 3000);

        // Timeout after 10 minutes
        setTimeout(() => {
            if (checkInterval) {
                clearInterval(checkInterval);
            }
            if (this.pendingAssessmentRetry) {
                this.pendingAssessmentRetry = null;
                this.icbAgent.addMessage('⏰ **Permission Request Timeout**\n\nThe permission approval process timed out. Please try starting the assessment again.', 'system');
            }
        }, 600000);
    }

    /**
     * Get display name for data type
     * @param {string} dataType - The data type
     * @returns {string} Human-readable display name
     */
    getDataTypeDisplayName(dataType) {
        const displayNames = {
            'users': 'User Accounts',
            'devices': 'Managed Devices',
            'compliancePolicies': 'Device Compliance Policies',
            'configurationPolicies': 'Device Configuration Policies',
            'servicePrincipals': 'Service Principals',
            'conditionalAccess': 'Conditional Access Policies',
            'applications': 'Application Registrations',
            'groups': 'Security Groups',
            'directoryRoles': 'Directory Roles',
            'domains': 'Verified Domains',
            'organization': 'Organization Information'
        };
        return displayNames[dataType] || dataType;
    }

    /**
     * Get description for permission scope
     * @param {string} permission - The permission scope
     * @returns {string} Human-readable description
     */
    getPermissionDescription(permission) {
        const descriptions = {
            'User.Read.All': 'Read all user profiles and account information',
            'Directory.Read.All': 'Read directory data including users, groups, and organizational settings',
            'DeviceManagementManagedDevices.Read.All': 'Read information about managed devices enrolled in Microsoft Intune',
            'DeviceManagementConfiguration.Read.All': 'Read device compliance and configuration policies',
            'Application.Read.All': 'Read application registrations and service principals',
            'Policy.Read.All': 'Read conditional access and other security policies',
            'Policy.ReadWrite.ConditionalAccess': 'Read conditional access policies and their configurations',
            'Group.Read.All': 'Read group information and membership details',
            'RoleManagement.Read.Directory': 'Read directory role assignments and definitions',
            'Domain.Read.All': 'Read verified domain information',
            'Organization.Read.All': 'Read organization profile and tenant information'
        };
        return descriptions[permission] || 'Microsoft Graph permission for tenant access';
    }

    // Utility method for delays
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Global function for category expansion (referenced in HTML)
function toggleCategoryDetails(categoryKey) {
    const details = document.getElementById(`details-${categoryKey}`);
    const button = document.querySelector(`[data-category="${categoryKey}"] .expand-btn .expand-icon`);
    
    if (details && button) {
        const isHidden = details.style.display === 'none';
        details.style.display = isHidden ? 'block' : 'none';
        button.textContent = isHidden ? '▲' : '▼';
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ZeroTrustAssessment;
} else {
    window.ZeroTrustAssessment = ZeroTrustAssessment;
}
