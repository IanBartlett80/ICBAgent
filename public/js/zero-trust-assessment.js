// Zero Trust Assessment Main Component
// File: public/js/zero-trust-assessment.js

class ZeroTrustAssessment {
    constructor(icbAgent) {
        this.icbAgent = icbAgent;
        this.graphService = new ZeroTrustGraphService();
        this.assessmentEngine = new ZeroTrustAssessmentEngine();
        
        this.currentAssessment = null;
        this.assessmentHistory = [];
        this.isRunning = false;
        
        this.initializeUI();
        this.bindEvents();
        
        console.log('Zero Trust Assessment component initialized');
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
            
            // Check if we have a Graph token
            if (!this.icbAgent.graphToken) {
                this.updateProgress(0, 'Requesting Microsoft Graph access...');
                await this.requestGraphAccess();
            }

            // Initialize Graph service
            this.updateProgress(5, 'Initializing Graph API service...');
            this.graphService.initialize(this.icbAgent.graphToken);

            // Validate permissions
            this.updateProgress(10, 'Validating permissions...');
            const permissionCheck = await this.graphService.validatePermissions();
            
            if (!permissionCheck.allPermissionsValid) {
                throw new Error('Insufficient permissions for comprehensive assessment');
            }

            // Collect data
            this.updateProgress(15, 'Collecting assessment data...');
            const assessmentData = await this.graphService.collectAssessmentData(
                (progress) => {
                    const percentage = 15 + (progress.percentage * 0.6); // 15-75%
                    this.updateProgress(percentage, `Collecting ${progress.currentTask}...`);
                }
            );

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

    async requestGraphAccess() {
        return new Promise((resolve, reject) => {
            // Request Graph token from ICB Agent
            this.icbAgent.socket.emit('request-graph-token', {
                scopes: this.graphService.requiredScopes
            });

            // Set timeout for token request
            const timeout = setTimeout(() => {
                reject(new Error('Graph token request timeout'));
            }, 30000);

            // Handle token response
            const tokenHandler = (token) => {
                clearTimeout(timeout);
                this.icbAgent.socket.off('graph-token-received', tokenHandler);
                this.icbAgent.socket.off('graph-token-error', errorHandler);
                resolve(token);
            };

            const errorHandler = (error) => {
                clearTimeout(timeout);
                this.icbAgent.socket.off('graph-token-received', tokenHandler);
                this.icbAgent.socket.off('graph-token-error', errorHandler);
                reject(new Error(error.message));
            };

            this.icbAgent.socket.on('graph-token-received', tokenHandler);
            this.icbAgent.socket.on('graph-token-error', errorHandler);
        });
    }

    handleGraphToken(token) {
        this.icbAgent.graphToken = token;
        console.log('Graph token received for Zero Trust Assessment');
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
