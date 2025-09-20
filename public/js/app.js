class ICBAgent {
    constructor() {
        this.socket = null;
        this.sessionId = null;
        this.currentTenant = null;
        this.isConnected = false;
        this.graphToken = null;
        
        // Initialize Zero Trust Assessment
        this.zeroTrustAssessment = null;
        
        this.init();
    }

    init() {
        console.log('ICBAgent initializing...'); // Debug log
        this.restoreSessionFromStorage(); // Add session restoration
        this.initializeSocket();
        this.bindEvents();
        this.updateConnectionStatus(this.isConnected ? 'connected' : 'disconnected', this.currentTenant);
        this.setupAuthenticationListener();
        this.initializeZeroTrustAssessment();
        this.testEnhancedRendering(); // Add test function
        console.log('ICBAgent initialized'); // Debug log
    }

    restoreSessionFromStorage() {
        try {
            const savedSession = localStorage.getItem('icb_session');
            const savedTenant = localStorage.getItem('icb_tenant');
            
            if (savedSession && savedTenant) {
                this.sessionId = savedSession;
                this.currentTenant = savedTenant;
                this.isConnected = true;
                console.log('🔄 Session restored from localStorage:', { 
                    sessionId: this.sessionId, 
                    tenant: this.currentTenant 
                });
                
                // Join the existing socket room when socket connects
                if (this.socket && this.socket.connected) {
                    this.socket.emit('join_session', this.sessionId);
                }
            } else {
                console.log('ℹ️ No previous session found in localStorage');
            }
        } catch (error) {
            console.warn('⚠️ Error restoring session from localStorage:', error);
        }
    }

    testEnhancedRendering() {
        // Test the enhanced rendering with a sample response
        console.log('🧪 Testing enhanced rendering...');
        
        const sampleResponse = `📱 **iOS Devices in tenant.com** (5 total, showing first 20)

• **John's iPhone** (iOS 17.1)
  └ ✅ Compliance: compliant | Last Sync: 7/28/2025 | Enrolled: 1/15/2024
• **Jane's iPad** (iOS 16.8)
  └ ❌ Compliance: noncompliant | Last Sync: Never | Enrolled: 2/20/2024

**Compliance Summary:** compliant: 3, noncompliant: 2`;
        
        try {
            console.log('📝 Testing with sample response:', sampleResponse.substring(0, 200));
            const rendered = this.renderEnhancedResponse(sampleResponse);
            console.log('✅ Enhanced rendering test result:', rendered.substring(0, 500));
            console.log('🔍 Contains proper list tags:', rendered.includes('<ul class="response-list">'));
            console.log('🔍 Contains list items:', rendered.includes('<li class="response-list-item">'));
        } catch (error) {
            console.error('❌ Enhanced rendering test failed:', error);
        }
    }

    setupAuthenticationListener() {
        // Listen for messages from authentication popup windows
        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'auth_success') {
                console.log('Authentication success message received:', event.data);
                
                if (event.data.permissionsApproved) {
                    console.log('Permissions were approved, checking for pending query rerun...');
                    this.handlePermissionApproval();
                }
            }
        });
    }

    async handlePermissionApproval() {
        if (!this.sessionId) {
            console.log('No active session for permission approval handling');
            return;
        }

        try {
            console.log('Attempting to rerun pending query after permission approval...');
            
            // Clear any waiting permission request
            this.lastPermissionRequest = null;
            
            // Show a loading message
            this.addMessage('🔄 **Permissions Approved!** \n\nRe-running your query with the newly granted permissions...', 'system');
            
            // Call the rerun endpoint
            const response = await fetch(`/api/auth/rerun-query/${this.sessionId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            const data = await response.json();
            
            if (data.success) {
                console.log('Pending query rerun completed successfully');
                // The result will be emitted via socket, so no need to add message here
            } else {
                console.log('No pending query found or rerun failed:', data.message);
                this.addMessage(`ℹ️ **Permission Status Update**\n\n${data.message}`, 'system');
            }
            
        } catch (error) {
            console.error('Error handling permission approval:', error);
            this.addMessage('❌ **Error processing permission approval**\n\nPlease try running your query again.', 'system');
        }
    }

    initializeSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('Socket connected');
            
            // Join session if we have one from restoration
            if (this.sessionId) {
                console.log('🔄 Rejoining session:', this.sessionId);
                this.socket.emit('join_session', this.sessionId);
            }
            
            // Don't automatically set connected status - only when actually connected to a tenant
            if (this.currentTenant && this.sessionId) {
                this.updateConnectionStatus('connected', this.currentTenant);
            }
        });

        this.socket.on('disconnect', () => {
            console.log('Socket disconnected');
            this.updateConnectionStatus('disconnected');
        });

        this.socket.on('mcp_status', (data) => {
            this.handleMCPStatus(data);
        });

        this.socket.on('auth_status_changed', (data) => {
            console.log('🔍 DEBUG - auth_status_changed socket event received:', JSON.stringify(data, null, 2));
            try {
                this.handleAuthStatusChanged(data);
            } catch (error) {
                console.error('❌ Error in handleAuthStatusChanged:', error);
            }
        });

        this.socket.on('chat_response', (data) => {
            console.log('📨 Received chat response:', data);
            this.addMessage(data.message, 'assistant');
        });

        this.socket.on('permission_request', (data) => {
            this.handlePermissionRequest(data);
        });

        this.socket.on('query_rerun_complete', (data) => {
            this.addMessage(data.message, 'assistant');
        });
    }

    initializeZeroTrustAssessment() {
        console.log('🔧 Initializing Zero Trust Assessment...');
        
        // Check if all required classes are available
        console.log('🔍 Checking class availability:');
        console.log('  - ZeroTrustAssessment:', typeof ZeroTrustAssessment);
        console.log('  - ZeroTrustGraphService:', typeof ZeroTrustGraphService);
        console.log('  - ZeroTrustAssessmentEngine:', typeof ZeroTrustAssessmentEngine);
        
        // Check if Zero Trust Assessment classes are available
        if (typeof ZeroTrustAssessment !== 'undefined') {
            try {
                console.log('🚀 Creating ZeroTrustAssessment instance...');
                this.zeroTrustAssessment = new ZeroTrustAssessment(this);
                console.log('✅ Zero Trust Assessment initialized successfully:', this.zeroTrustAssessment);
            } catch (error) {
                console.error('❌ Failed to initialize Zero Trust Assessment:', error);
            }
        } else {
            console.warn('⚠️ Zero Trust Assessment classes not loaded - checking scripts...');
            
            // Check if scripts are loaded
            const scripts = Array.from(document.querySelectorAll('script[src*="zero-trust"]'));
            console.log('📜 Zero Trust scripts found:', scripts.map(s => s.src));
        }
    }

    bindEvents() {
        // Get Started button
        const getStartedBtn = document.getElementById('getStartedBtn');
        const tenantDomainInput = document.getElementById('tenantDomain');
        
        console.log('getStartedBtn:', getStartedBtn); // Debug log
        console.log('tenantDomainInput:', tenantDomainInput); // Debug log
        
        if (getStartedBtn) {
            getStartedBtn.addEventListener('click', () => {
                console.log('Get started button clicked'); // Debug log
                this.handleGetStarted();
            });
        } else {
            console.error('getStartedBtn not found!');
        }

        if (tenantDomainInput) {
            tenantDomainInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    console.log('Enter key pressed in domain input'); // Debug log
                    this.handleGetStarted();
                }
            });
        } else {
            console.error('tenantDomainInput not found!');
        }

        // Chat functionality
        const sendBtn = document.getElementById('sendBtn');
        const messageInput = document.getElementById('messageInput');

        // Home button
        const homeBtn = document.getElementById('homeBtn');
        if (homeBtn) {
            homeBtn.addEventListener('click', () => {
                this.goHome();
            });
        }

        sendBtn.addEventListener('click', () => {
            this.sendMessage();
        });

        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Auto-resize textarea
        messageInput.addEventListener('input', () => {
            this.autoResizeTextarea(messageInput);
        });

        // Quick action buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('quick-action-btn')) {
                const message = e.target.getAttribute('data-message');
                this.sendQuickMessage(message);
            }
        });

        // AI Chat feature card click handler
        const aiChatFeature = document.getElementById('aiChatFeature');
        if (aiChatFeature) {
            aiChatFeature.addEventListener('click', () => {
                this.handleAIChatFeatureClick();
            });
        }

        // Health Reports feature card click handler
        const healthReportsCard = document.getElementById('healthReportsCard');
        if (healthReportsCard) {
            healthReportsCard.addEventListener('click', () => {
                this.handleMonthlyReportFeatureClick();
            });
        }

        // Zero Trust Assessment feature card click handler
        const zeroTrustCard = document.getElementById('zeroTrustCard');
        if (zeroTrustCard) {
            zeroTrustCard.addEventListener('click', () => {
                this.handleZeroTrustFeatureClick();
            });
        }

        // Report generation
        const generateReportBtn = document.getElementById('generateReportBtn');
        generateReportBtn.addEventListener('click', () => {
            this.generateHealthReport();
        });

        // Disconnect button
        const disconnectBtn = document.getElementById('disconnectBtn');
        disconnectBtn.addEventListener('click', () => {
            this.disconnect();
        });

        // Connected card buttons
        const openChatBtn = document.getElementById('openChatBtn');
        if (openChatBtn) {
            openChatBtn.addEventListener('click', () => {
                this.scrollToChatSection();
            });
        }

        const disconnectCardBtn = document.getElementById('disconnectCardBtn');
        if (disconnectCardBtn) {
            disconnectCardBtn.addEventListener('click', () => {
                this.disconnect();
            });
        }

        // Modal controls
        const closeReportModal = document.getElementById('closeReportModal');
        closeReportModal.addEventListener('click', () => {
            this.closeModal('reportModal');
        });

        const downloadReportBtn = document.getElementById('downloadReportBtn');
        downloadReportBtn.addEventListener('click', () => {
            this.downloadReport();
        });

        const emailReportBtn = document.getElementById('emailReportBtn');
        emailReportBtn.addEventListener('click', () => {
            this.emailReport();
        });

        // Monthly Report Modal controls
        const closeMonthlyReportModal = document.getElementById('closeMonthlyReportModal');
        if (closeMonthlyReportModal) {
            closeMonthlyReportModal.addEventListener('click', () => {
                this.closeModal('monthlyReportModal');
            });
        }

        const authenticateTenantBtn = document.getElementById('authenticateTenantBtn');
        if (authenticateTenantBtn) {
            authenticateTenantBtn.addEventListener('click', () => {
                this.authenticateForMonthlyReport();
            });
        }

        const generateReportDataBtn = document.getElementById('generateReportDataBtn');
        if (generateReportDataBtn) {
            generateReportDataBtn.addEventListener('click', () => {
                this.generateMonthlyReportData();
            });
        }

        const editReportBtn = document.getElementById('editReportBtn');
        if (editReportBtn) {
            editReportBtn.addEventListener('click', () => {
                this.editMonthlyReport();
            });
        }

        const exportReportBtn = document.getElementById('exportReportBtn');
        if (exportReportBtn) {
            exportReportBtn.addEventListener('click', () => {
                this.exportMonthlyReportPDF();
            });
        }
    }

    async handleGetStarted() {
        console.log('handleGetStarted called'); // Debug log
        const tenantDomain = document.getElementById('tenantDomain').value.trim();
        console.log('Tenant domain:', tenantDomain); // Debug log
        
        if (!tenantDomain) {
            this.showError('Please enter a tenant domain');
            return;
        }

        if (!this.isValidDomain(tenantDomain)) {
            this.showError('Please enter a valid domain (e.g., contoso.onmicrosoft.com, contoso.com, or mail.contoso.com)');
            return;
        }

        this.setButtonLoading('getStartedBtn', true);
        this.updateConnectionStatus('connecting', tenantDomain);

        try {
            console.log('Making session create request...'); // Debug log
            // Create session
            const sessionResponse = await fetch('/api/session/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ tenantDomain }),
            });

            const sessionData = await sessionResponse.json();
            console.log('Session response:', sessionData); // Debug log
            
            if (!sessionResponse.ok) {
                throw new Error(sessionData.error || 'Failed to create session');
            }

            this.sessionId = sessionData.sessionId;
            this.currentTenant = tenantDomain;

            // Join socket room
            this.socket.emit('join_session', this.sessionId);

            // Start MCP server
            console.log('Starting MCP server...'); // Debug log
            const mcpResponse = await fetch('/api/mcp/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    sessionId: this.sessionId, 
                    tenantDomain 
                }),
            });

            const mcpData = await mcpResponse.json();
            
            if (!mcpResponse.ok) {
                throw new Error(mcpData.error || 'Failed to start MCP server');
            }

            // Stay on landing page but update connection status
            // Note: Authentication may still be pending, final connected status will be set by auth_status_changed event
            this.updateConnectionStatus('connecting', this.currentTenant);

        } catch (error) {
            console.error('Error during startup:', error);
            this.showError(error.message);
            this.updateConnectionStatus('disconnected');
        } finally {
            this.setButtonLoading('getStartedBtn', false);
        }
    }

    async sendMessage() {
        const messageInput = document.getElementById('messageInput');
        const message = messageInput.value.trim();
        
        if (!message || !this.sessionId) return;

        // Add user message to chat
        this.addMessage(message, 'user');
        messageInput.value = '';
        this.autoResizeTextarea(messageInput);

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    sessionId: this.sessionId, 
                    message 
                }),
            });

            const data = await response.json();
            
            console.log('📨 Received API response:', data);
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to send message');
            }

            // Add AI response to chat
            console.log('🤖 Adding AI response to chat:', data.response);
            this.addMessage(data.response.message, 'assistant');

        } catch (error) {
            console.error('Error sending message:', error);
            this.addMessage('Sorry, I encountered an error processing your request. Please try again.', 'assistant', true);
        }
    }

    sendQuickMessage(message) {
        const messageInput = document.getElementById('messageInput');
        messageInput.value = message;
        this.sendMessage();
    }

    async generateHealthReport() {
        if (!this.sessionId) return;

        try {
            const response = await fetch('/api/reports/health-check', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ sessionId: this.sessionId }),
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to generate report');
            }

            this.showReportModal(data.report);

        } catch (error) {
            console.error('Error generating report:', error);
            this.showError('Failed to generate health check report');
        }
    }

    redirectToZeroTrustAssessment() {
        if (!this.sessionId || !this.currentTenant) {
            this.showError('No active session. Please connect to a tenant first.');
            return;
        }

        try {
            // Save session data to localStorage for the new page
            localStorage.setItem('icb_session', this.sessionId);
            localStorage.setItem('icb_tenant', this.currentTenant);
            
            // Show loading message
            this.showSuccess(`🔒 Opening Zero Trust Assessment for ${this.currentTenant}...`);
            
            // Redirect to dedicated Zero Trust Assessment page with session parameters
            const assessmentUrl = `/zero-trust-assessment.html?session=${encodeURIComponent(this.sessionId)}&tenant=${encodeURIComponent(this.currentTenant)}`;
            
            setTimeout(() => {
                window.location.href = assessmentUrl;
            }, 500); // Small delay to show the success message
            
        } catch (error) {
            console.error('Error redirecting to Zero Trust Assessment:', error);
            this.showError('Failed to open Zero Trust Assessment. Please try again.');
        }
    }

    addMessage(content, type, isError = false) {
        console.log('💬 Adding message:', { type, contentLength: content.length, isError });
        
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        if (isError) {
            messageDiv.style.background = 'var(--error)';
            messageDiv.style.color = 'white';
        } else if (type === 'system') {
            messageDiv.style.background = 'var(--primary-light)';
            messageDiv.style.border = '1px solid var(--primary)';
            messageDiv.style.borderRadius = '8px';
            messageDiv.style.padding = '12px';
            messageDiv.style.margin = '8px 0';
        }

        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        
        // Enhanced message rendering - use full markdown for both user and assistant messages
        if (type === 'assistant') {
            console.log('🤖 Assistant message detected, using enhanced rendering');
            messageContent.innerHTML = this.renderEnhancedResponse(content);
        } else if (type === 'user') {
            console.log('👤 User message detected, using full markdown rendering');
            messageContent.innerHTML = this.formatMessage(content);
        } else {
            console.log('🔧 System message detected, using enhanced rendering');
            messageContent.innerHTML = this.renderEnhancedResponse(content);
        }

        messageDiv.appendChild(messageContent);
        chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    formatMessage(content) {
        // Enhanced markdown formatting for user messages
        console.log('👤 Formatting user message with full markdown support');
        
        // First apply the same markdown parsing as assistant messages
        let html = this.parseMarkdown(content);
        
        return html;
    }

    renderEnhancedResponse(content) {
        console.log('🚀 Enhanced rendering triggered');
        
        // Enhanced markdown rendering with insights and recommendations
        let html = this.parseMarkdown(content);
        
        // Add insights and recommendations if this looks like a data response
        if (this.isDataResponse(content)) {
            console.log('📊 Data response detected, generating insights...');
            html += this.generateInsightsAndRecommendations(content);
        }
        
        return html;
    }

    parseMarkdown(content) {
        // Enhanced markdown parsing
        let html = content;
        
        // Headers
        html = html.replace(/^### (.*$)/gm, '<h3 class="response-header">$1</h3>');
        html = html.replace(/^## (.*$)/gm, '<h2 class="response-title">$1</h2>');
        html = html.replace(/^# (.*$)/gm, '<h1 class="response-main-title">$1</h1>');
        
        // Bold and italic
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="response-bold">$1</strong>');
        html = html.replace(/\*(.*?)\*/g, '<em class="response-italic">$1</em>');
        
        // Code blocks
        html = html.replace(/```json\n([\s\S]*?)\n```/g, '<div class="code-block json-block"><pre><code>$1</code></pre></div>');
        html = html.replace(/```([\s\S]*?)```/g, '<div class="code-block"><pre><code>$1</code></pre></div>');
        html = html.replace(/`(.*?)`/g, '<code class="inline-code">$1</code>');
        
        // Lists - Enhanced styling with support for nested content
        // Process lists by handling multi-line list items properly
        // Split into lines first and process line by line
        const lines = html.split('\n');
        let processedLines = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Check if this line starts with a bullet point
            if (line.match(/^• /)) {
                let listItemContent = line.substring(2); // Remove the bullet
                
                // Look ahead for indented continuation lines
                let j = i + 1;
                while (j < lines.length && lines[j].match(/^  └/)) {
                    listItemContent += '<br>&nbsp;&nbsp;' + lines[j].substring(2);
                    j++;
                }
                
                // Create the list item
                processedLines.push(`<li class="response-list-item">${listItemContent}</li>`);
                
                // Skip the lines we've already processed
                i = j - 1;
            } else if (line.match(/^- /)) {
                // Handle simple dash lists
                processedLines.push(`<li class="response-list-item">${line.substring(2)}</li>`);
            } else {
                // Regular line
                processedLines.push(line);
            }
        }
        
        html = processedLines.join('\n');
        
        // Then wrap consecutive list items in ul tags
        const finalLines = html.split('\n');
        let inList = false;
        let finalProcessedLines = [];
        
        for (let i = 0; i < finalLines.length; i++) {
            const line = finalLines[i];
            const isListItem = line.trim().startsWith('<li class="response-list-item">');
            
            if (isListItem && !inList) {
                // Starting a new list
                finalProcessedLines.push('<ul class="response-list">');
                finalProcessedLines.push(line);
                inList = true;
            } else if (isListItem && inList) {
                // Continue existing list
                finalProcessedLines.push(line);
            } else if (!isListItem && inList) {
                // End existing list
                finalProcessedLines.push('</ul>');
                finalProcessedLines.push(line);
                inList = false;
            } else {
                // Regular line
                finalProcessedLines.push(line);
            }
        }
        
        // Close any remaining open list
        if (inList) {
            finalProcessedLines.push('</ul>');
        }
        
        html = finalProcessedLines.join('\n');
        
        // Emojis and status indicators - Enhanced styling
        html = html.replace(/(✅|🔒|📊|👥|📱|🖥️|🤖|💻|📈|🌐|👨‍👩‍👧‍👦|🏢|📋|👤|❌|⚠️|ℹ️|🔄|🎉)/g, '<span class="status-emoji">$1</span>');
        
        // Special sections
        html = html.replace(/\*\*([^*]+):\*\*/g, '<div class="section-header"><strong>$1:</strong></div>');
        
        // Line breaks
        html = html.replace(/\n\n/g, '</p><p class="response-paragraph">');
        html = html.replace(/\n/g, '<br>');
        
        // Wrap in paragraph if not already wrapped
        if (!html.includes('<p') && !html.includes('<h') && !html.includes('<ul') && !html.includes('<div')) {
            html = `<p class="response-paragraph">${html}</p>`;
        }
        
        return html;
    }

    isDataResponse(content) {
        // Check if the response contains structured data that could benefit from insights
        const dataIndicators = [
            'total', 'showing first', 'devices', 'users', 'licenses', 'alerts',
            'compliance', 'non-compliant', 'grace period', 'last sync', 'enrolled',
            'sign-in', 'groups', 'applications', 'subscriptions', 'policies'
        ];
        
        const lowerContent = content.toLowerCase();
        const hasDataIndicators = dataIndicators.some(indicator => lowerContent.includes(indicator));
        
        console.log('🔍 Checking if data response:', { 
            hasDataIndicators, 
            foundIndicators: dataIndicators.filter(indicator => lowerContent.includes(indicator))
        });
        
        return hasDataIndicators;
    }

    generateInsightsAndRecommendations(content) {
        const insights = this.extractInsights(content);
        const recommendations = this.generateRecommendations(content);
        
        if (insights.length === 0 && recommendations.length === 0) {
            return '';
        }
        
        let html = '<div class="insights-recommendations-section">';
        
        if (insights.length > 0) {
            html += '<div class="insights-section">';
            html += '<h4 class="insights-title"><span class="insights-icon">💡</span> Key Insights</h4>';
            html += '<ul class="insights-list">';
            insights.forEach(insight => {
                html += `<li class="insight-item">${insight}</li>`;
            });
            html += '</ul>';
            html += '</div>';
        }
        
        if (recommendations.length > 0) {
            html += '<div class="recommendations-section">';
            html += '<h4 class="recommendations-title"><span class="recommendations-icon">🎯</span> Recommendations</h4>';
            html += '<ul class="recommendations-list">';
            recommendations.forEach(recommendation => {
                html += `<li class="recommendation-item">${recommendation}</li>`;
            });
            html += '</ul>';
            html += '</div>';
        }
        
        html += '</div>';
        return html;
    }

    extractInsights(content) {
        const insights = [];
        
        // Device insights
        if (content.includes('iOS Devices') || content.includes('Android Devices') || content.includes('Windows Devices')) {
            const deviceCount = this.extractNumber(content, /\((\d+) total/);
            if (deviceCount) {
                insights.push(`You have ${deviceCount} managed devices in your environment`);
            }
        }
        
        // Compliance insights
        if (content.includes('Compliance:')) {
            const nonCompliantCount = (content.match(/❌ Compliance: noncompliant/g) || []).length;
            const graceCount = (content.match(/⏳ Compliance: inGracePeriod/g) || []).length;
            
            if (nonCompliantCount > 0) {
                insights.push(`${nonCompliantCount} devices are currently non-compliant and may need attention`);
            }
            if (graceCount > 0) {
                insights.push(`${graceCount} devices are in compliance grace period - action needed soon`);
            }
        }
        
        // User insights
        if (content.includes('Users in') && content.includes('total')) {
            const userCount = this.extractNumber(content, /\((\d+) total/);
            if (userCount) {
                insights.push(`Your tenant has ${userCount} total users`);
                
                // Check for inactive users
                const neverSignedIn = (content.match(/Last sign-in: Never/g) || []).length;
                if (neverSignedIn > 0) {
                    insights.push(`${neverSignedIn} users have never signed in - consider reviewing these accounts`);
                }
            }
        }
        
        // License insights
        if (content.includes('License Usage')) {
            const licenseLines = content.match(/Used: (\d+)\/(\d+)/g);
            if (licenseLines) {
                licenseLines.forEach(line => {
                    const [used, total] = line.match(/(\d+)/g);
                    const utilization = Math.round((used / total) * 100);
                    if (utilization > 90) {
                        insights.push(`License utilization is ${utilization}% - consider purchasing additional licenses`);
                    } else if (utilization < 50) {
                        insights.push(`License utilization is only ${utilization}% - potential cost optimization opportunity`);
                    }
                });
            }
        }
        
        // Security insights
        if (content.includes('Security Alerts')) {
            if (content.includes('No active security alerts')) {
                insights.push('Your tenant currently has no active security alerts - great security posture!');
            } else {
                const alertCount = this.extractNumber(content, /\((\d+) total\)/);
                if (alertCount && alertCount > 0) {
                    insights.push(`${alertCount} security alerts require your attention`);
                }
            }
        }
        
        return insights;
    }

    generateRecommendations(content) {
        const recommendations = [];
        
        // Device management recommendations
        if (content.includes('non-compliant') || content.includes('grace period')) {
            recommendations.push('Review and remediate non-compliant devices to improve security posture');
            recommendations.push('Set up automated compliance policies to prevent future compliance issues');
        }
        
        // User management recommendations
        if (content.includes('Never')) {
            recommendations.push('Review users who have never signed in and consider disabling unused accounts');
            recommendations.push('Implement regular user access reviews to maintain good security hygiene');
        }
        
        // License optimization recommendations
        if (content.includes('License Usage')) {
            recommendations.push('Monitor license usage regularly to optimize costs and ensure adequate capacity');
            recommendations.push('Consider implementing license assignment policies based on job roles');
        }
        
        // Security recommendations
        if (content.includes('security alerts') && !content.includes('No active')) {
            recommendations.push('Address security alerts promptly to minimize potential security risks');
            recommendations.push('Enable additional security monitoring and alerting for proactive threat detection');
        }
        
        // Device-specific recommendations
        if (content.includes('Last Sync:')) {
            recommendations.push('Ensure devices sync regularly with Intune for proper management and security');
            recommendations.push('Consider implementing conditional access policies for better device control');
        }
        
        // General recommendations based on data type
        if (content.includes('Applications')) {
            recommendations.push('Regularly review registered applications and remove unused ones');
            recommendations.push('Implement app governance policies to control application permissions');
        }
        
        if (content.includes('Groups')) {
            recommendations.push('Use security groups for efficient permission management');
            recommendations.push('Regularly review group memberships to ensure appropriate access');
        }
        
        return recommendations;
    }

    extractNumber(content, regex) {
        const match = content.match(regex);
        return match ? parseInt(match[1]) : null;
    }

    showChatInterface() {
        document.getElementById('welcomeSection').style.display = 'none';
        document.getElementById('chatSection').style.display = 'block';
        document.getElementById('currentTenant').textContent = this.currentTenant;
        
        // Show home button when in chat interface
        const homeBtn = document.getElementById('homeBtn');
        if (homeBtn) {
            homeBtn.style.display = 'flex';
        }
        
        // Focus on message input
        document.getElementById('messageInput').focus();
    }

    showWelcomeInterface() {
        document.getElementById('chatSection').style.display = 'none';
        document.getElementById('welcomeSection').style.display = 'block';
        
        // Hide home button when on welcome interface
        const homeBtn = document.getElementById('homeBtn');
        if (homeBtn) {
            homeBtn.style.display = 'none';
        }
        
        // Clear form
        document.getElementById('tenantDomain').value = '';
    }

    goHome() {
        // Navigate back to welcome interface while keeping the connection active
        this.showWelcomeInterface();
        
        // Show a friendly message that they can return to chat anytime
        if (this.isConnected && this.currentTenant) {
            // Add a subtle notification that connection is maintained
            this.showSuccess(`🏠 Welcome back! You're still connected to ${this.currentTenant}. You can return to the chat interface anytime by clicking the connection status above.`);
        }
        
        // Scroll to top for better UX
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }

    handleAIChatFeatureClick() {
        // Check if user is already connected to a tenant
        if (this.isConnected && this.currentTenant) {
            // If connected, navigate directly to chat interface
            this.scrollToChatSection();
            this.showSuccess(`💬 Welcome to the AI Chat! You're connected to ${this.currentTenant} and ready to start conversing.`);
        } else {
            // If not connected, prompt them to connect first
            this.showInfo(`🚀 To use AI-Powered Natural Language features, please connect to your Microsoft 365 tenant first. Enter your tenant domain below and click "Connect".`);
            
            // Scroll to the tenant setup form
            const setupForm = document.querySelector('.tenant-setup');
            if (setupForm) {
                setupForm.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                });
                
                // Add a subtle highlight to the form
                setupForm.style.transition = 'box-shadow 0.3s ease';
                setupForm.style.boxShadow = '0 0 20px rgba(62, 138, 180, 0.3)';
                setTimeout(() => {
                    setupForm.style.boxShadow = '';
                }, 3000);
                
                // Focus on the domain input for better UX
                const domainInput = document.getElementById('tenantDomain');
                if (domainInput) {
                    setTimeout(() => {
                        domainInput.focus();
                    }, 500);
                }
            }
        }
    }

    handleZeroTrustFeatureClick() {
        // Check if user is already connected to a tenant
        if (this.isConnected && this.currentTenant) {
            // If connected, redirect to dedicated Zero Trust Assessment page
            this.redirectToZeroTrustAssessment();
        } else {
            // If not connected, prompt them to connect first
            this.showInfo(`🔒 To run the Zero Trust Assessment, please connect to your Microsoft 365 tenant first. Enter your tenant domain below and click "Connect".`);
            
            // Scroll to the tenant setup form
            const setupForm = document.querySelector('.tenant-setup');
            if (setupForm) {
                setupForm.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                });
                
                // Add a subtle highlight to the form with security theme
                setupForm.style.transition = 'box-shadow 0.3s ease';
                setupForm.style.boxShadow = '0 0 20px rgba(16, 185, 129, 0.3)'; // Green security theme
                setTimeout(() => {
                    setupForm.style.boxShadow = '';
                }, 3000);
                
                // Focus on the domain input for better UX
                const domainInput = document.getElementById('tenantDomain');
                if (domainInput) {
                    setTimeout(() => {
                        domainInput.focus();
                    }, 500);
                }
            }
        }
    }

    handleMonthlyReportFeatureClick() {
        // Launch the Monthly Report generation flow
        // This will trigger MSAL authentication and then generate the report
        this.showMonthlyReportModal();
    }

    showReportModal(report) {
        const modal = document.getElementById('reportModal');
        const content = document.getElementById('reportContent');
        
        content.innerHTML = this.generateReportHTML(report);
        modal.style.display = 'flex';
    }

    generateReportHTML(report) {
        return `
            <div class="report-header">
                <h4>Tenant: ${report.tenantDomain}</h4>
                <p>Generated: ${new Date(report.generatedAt).toLocaleString()}</p>
            </div>
            <div class="report-sections">
                ${report.sections.map(section => `
                    <div class="report-section">
                        <div class="section-header">
                            <h5>${section.name}</h5>
                            <span class="status-badge status-${section.status}">${section.status.replace('_', ' ')}</span>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    showMonthlyReportModal() {
        const modal = document.getElementById('monthlyReportModal');
        modal.style.display = 'flex';
        
        // Reset modal to first step
        this.resetMonthlyReportModal();
    }

    resetMonthlyReportModal() {
        // Hide all steps except the first one
        document.getElementById('authStep').style.display = 'block';
        document.getElementById('configStep').style.display = 'none';
        document.getElementById('progressStep').style.display = 'none';
        document.getElementById('previewStep').style.display = 'none';
        
        // Reset form fields
        document.getElementById('reportTenantDomain').value = '';
        document.getElementById('customerName').value = '';
        document.getElementById('customerLogo').value = '';
        
        // Reset auth status
        const authStatus = document.getElementById('authStatus');
        authStatus.style.display = 'none';
    }

    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }

    downloadReport() {
        // Implement PDF download functionality
        console.log('Downloading report...');
        this.showSuccess('Report download started');
    }

    emailReport() {
        // Implement email functionality
        console.log('Emailing report...');
        this.showSuccess('Report sent to customer');
    }

    // Monthly Report Methods
    async authenticateForMonthlyReport() {
        const tenantDomain = document.getElementById('reportTenantDomain').value.trim();
        
        if (!tenantDomain) {
            this.showError('Please enter a tenant domain');
            return;
        }

        const authStatus = document.getElementById('authStatus');
        const statusIndicator = authStatus.querySelector('.status-indicator');
        const statusText = authStatus.querySelector('.status-text');
        
        // Show auth status
        authStatus.style.display = 'flex';
        statusIndicator.className = 'status-indicator connecting';
        statusText.textContent = 'Initiating Microsoft Authentication...';

        try {
            // This will trigger MSAL authentication popup
            // For now, simulate the authentication process
            setTimeout(() => {
                statusIndicator.className = 'status-indicator connected';
                statusText.textContent = `✅ Successfully authenticated to ${tenantDomain}`;
                
                // Move to next step after successful auth
                setTimeout(() => {
                    this.showConfigurationStep(tenantDomain);
                }, 1500);
            }, 2000);

        } catch (error) {
            console.error('Authentication failed:', error);
            statusIndicator.className = 'status-indicator disconnected';
            statusText.textContent = '❌ Authentication failed. Please try again.';
            this.showError('Failed to authenticate with Microsoft 365');
        }
    }

    showConfigurationStep(tenantDomain) {
        // Hide auth step, show config step
        document.getElementById('authStep').style.display = 'none';
        document.getElementById('configStep').style.display = 'block';
        
        // Pre-populate customer name from tenant domain
        const customerName = document.getElementById('customerName');
        const domain = tenantDomain.replace('.onmicrosoft.com', '').replace('.com', '');
        customerName.value = domain.charAt(0).toUpperCase() + domain.slice(1);
        
        this.currentReportTenant = tenantDomain;
    }

    async generateMonthlyReportData() {
        const customerName = document.getElementById('customerName').value.trim();
        
        if (!customerName) {
            this.showError('Please enter a customer name');
            return;
        }

        // Move to progress step
        document.getElementById('configStep').style.display = 'none';
        document.getElementById('progressStep').style.display = 'block';
        
        // Start data collection process
        await this.collectReportData();
    }

    async collectReportData() {
        const progressFill = document.getElementById('dataProgress');
        const progressItems = document.getElementById('progressItems');
        
        const dataItems = [
            { name: 'Identity & User Security', endpoint: 'users', icon: '👥' },
            { name: 'Device Management', endpoint: 'devices', icon: '📱' },
            { name: 'Security Score & Threats', endpoint: 'security', icon: '🛡️' },
            { name: 'Compliance & Policies', endpoint: 'compliance', icon: '📋' },
            { name: 'Application Security', endpoint: 'applications', icon: '🔐' },
            { name: 'Data Protection', endpoint: 'dataProtection', icon: '📊' }
        ];

        progressItems.innerHTML = '';
        let completed = 0;

        for (const item of dataItems) {
            // Add progress item
            const itemElement = document.createElement('div');
            itemElement.className = 'progress-item';
            itemElement.innerHTML = `
                <span class="progress-icon">${item.icon}</span>
                <span class="progress-name">${item.name}</span>
                <span class="progress-status">⏳ Collecting...</span>
            `;
            progressItems.appendChild(itemElement);

            // Simulate data collection
            await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
            
            // Update status
            itemElement.querySelector('.progress-status').innerHTML = '✅ Complete';
            itemElement.classList.add('completed');
            
            completed++;
            const progress = (completed / dataItems.length) * 100;
            progressFill.style.width = `${progress}%`;
        }

        // Move to preview step
        setTimeout(() => {
            this.showReportPreview();
        }, 1000);
    }

    showReportPreview() {
        document.getElementById('progressStep').style.display = 'none';
        document.getElementById('previewStep').style.display = 'block';
        
        // Generate and show report preview
        const reportPreview = document.getElementById('reportPreview');
        reportPreview.innerHTML = this.generateMonthlyReportPreview();
    }

    generateMonthlyReportPreview() {
        const customerName = document.getElementById('customerName').value;
        const currentDate = new Date();
        const previousMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
        const monthName = previousMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

        return `
            <div class="report-preview-header">
                <div class="report-title">
                    <h2>Microsoft 365 Security & Compliance Report</h2>
                    <h3>${customerName} - ${monthName}</h3>
                    <p class="report-subtitle">Generated by ICB Solutions Managed Services</p>
                </div>
            </div>
            
            <div class="executive-summary">
                <h4>📊 Executive Summary</h4>
                <div class="summary-metrics">
                    <div class="metric-card">
                        <div class="metric-value">87%</div>
                        <div class="metric-label">Security Score</div>
                        <div class="metric-trend positive">+5% vs last month</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">145</div>
                        <div class="metric-label">Active Users</div>
                        <div class="metric-trend neutral">No change</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">23</div>
                        <div class="metric-label">Devices Managed</div>
                        <div class="metric-trend positive">+3 new devices</div>
                    </div>
                    <div class="metric-card">
                        <div class="metric-value">2</div>
                        <div class="metric-label">Critical Alerts</div>
                        <div class="metric-trend negative">Requires attention</div>
                    </div>
                </div>
            </div>

            <div class="report-sections-preview">
                <h4>📋 Report Sections</h4>
                <ul class="section-list">
                    <li>🔐 Identity Security & Zero Trust</li>
                    <li>📱 Device Management & Compliance</li>
                    <li>🛡️ Security Center & Threat Protection</li>
                    <li>📊 Data Protection & Compliance</li>
                    <li>🎯 Recommendations & Next Steps</li>
                </ul>
            </div>

            <div class="ai-recommendations-preview">
                <h4>🤖 AI-Generated Recommendations</h4>
                <div class="recommendation-item">
                    <strong>High Priority:</strong> Enable MFA for 12 remaining admin accounts to improve identity security.
                </div>
                <div class="recommendation-item">
                    <strong>Medium Priority:</strong> Update device compliance policies to address 3 outdated configurations.
                </div>
                <div class="recommendation-item">
                    <strong>Optimization:</strong> Consider upgrading 15 users to Microsoft 365 E5 for advanced security features.
                </div>
            </div>

            <p class="preview-note">
                <strong>Note:</strong> This is a preview of your monthly report. You can edit any section before exporting the final PDF.
            </p>
        `;
    }

    editMonthlyReport() {
        // TODO: Implement rich text editor for report content
        this.showInfo('🚀 Report editing interface coming soon! You can currently review and export the report.');
    }

    async exportMonthlyReportPDF() {
        try {
            // TODO: Implement actual PDF generation
            this.showSuccess('🎉 Monthly report PDF generated successfully! Ready for customer delivery.');
            
            // For now, simulate PDF download
            const blob = new Blob(['PDF Content Placeholder'], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            const customerName = document.getElementById('customerName').value || 'Customer';
            const currentDate = new Date().toISOString().split('T')[0];
            
            a.href = url;
            a.download = `${customerName}_Monthly_Report_${currentDate}.pdf`;
            a.click();
            window.URL.revokeObjectURL(url);
            
            // Close modal after successful export
            setTimeout(() => {
                this.closeModal('monthlyReportModal');
            }, 2000);
            
        } catch (error) {
            console.error('Failed to export PDF:', error);
            this.showError('Failed to generate PDF report');
        }
    }

    async disconnect() {
        if (this.sessionId) {
            try {
                // Call server to cleanup session
                await fetch('/api/session/disconnect', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ sessionId: this.sessionId }),
                });
            } catch (error) {
                console.error('Error disconnecting session:', error);
            }
        }
        
        this.sessionId = null;
        this.currentTenant = null;
        this.isConnected = false;
        
        // Clear localStorage
        try {
            localStorage.removeItem('icb_session');
            localStorage.removeItem('icb_tenant');
            console.log('🧹 Session data cleared from localStorage');
        } catch (error) {
            console.warn('⚠️ Could not clear localStorage:', error);
        }
        
        // Clear chat messages
        document.getElementById('chatMessages').innerHTML = `
            <div class="system-message">
                <div class="message-content">
                    <p>🎉 Successfully connected to your Microsoft 365 tenant!</p>
                    <p>You can now ask me anything about your environment. For example:</p>
                    <ul>
                        <li>"Show me all users in the tenant"</li>
                        <li>"What are the current security policies?"</li>
                        <li>"Generate a license usage report"</li>
                        <li>"Check for any security alerts"</li>
                    </ul>
                </div>
            </div>
        `;
        
        this.showWelcomeInterface();
        this.updateConnectionStatus('disconnected');
    }

    updateConnectionStatus(status, tenantDomain = null) {
        const indicator = document.querySelector('.status-indicator');
        const text = document.querySelector('#statusText');
        const connectionStatus = document.querySelector('#connectionStatus');
        const disconnectBtn = document.querySelector('#disconnectBtn');
        const tenantSetup = document.getElementById('tenantSetup');
        const currentConnection = document.getElementById('currentConnection');
        const connectedTenantDisplay = document.getElementById('connectedTenantDisplay');
        
        if (indicator) {
            indicator.className = `status-indicator ${status}`;
        }
        
        if (text && connectionStatus) {
            switch (status) {
                case 'connected':
                    const displayTenant = tenantDomain || this.currentTenant || 'Unknown Tenant';
                    text.innerHTML = `Connected to <strong>${displayTenant}</strong>`;
                    text.className = 'status-text';
                    connectionStatus.className = 'connection-status clickable';
                    connectionStatus.style.cursor = 'pointer';
                    connectionStatus.onclick = () => this.scrollToChatSection();
                    connectionStatus.title = 'Click to go to chat interface';
                    // Show disconnect button when connected
                    if (disconnectBtn) {
                        disconnectBtn.style.display = 'flex';
                    }
                    // Show current connection card and hide tenant setup
                    if (tenantSetup) {
                        tenantSetup.style.display = 'none';
                    }
                    if (currentConnection) {
                        currentConnection.style.display = 'block';
                    }
                    if (connectedTenantDisplay) {
                        connectedTenantDisplay.textContent = `Connected to ${displayTenant}`;
                    }
                    this.isConnected = true;
                    break;
                case 'connecting':
                    const connectingTenant = tenantDomain || this.currentTenant || '';
                    text.innerHTML = connectingTenant ? 
                        `Connecting to <strong>${connectingTenant}</strong>...` : 
                        'Connecting...';
                    text.className = 'status-text';
                    connectionStatus.className = 'connection-status';
                    connectionStatus.style.cursor = 'default';
                    connectionStatus.onclick = null;
                    connectionStatus.title = '';
                    // Hide disconnect button when connecting
                    if (disconnectBtn) {
                        disconnectBtn.style.display = 'none';
                    }
                    // Show tenant setup and hide current connection card
                    if (tenantSetup) {
                        tenantSetup.style.display = 'block';
                    }
                    if (currentConnection) {
                        currentConnection.style.display = 'none';
                    }
                    this.isConnected = false;
                    break;
                default:
                    text.textContent = 'Disconnected';
                    text.className = 'status-text';
                    connectionStatus.className = 'connection-status';
                    connectionStatus.style.cursor = 'default';
                    connectionStatus.onclick = null;
                    connectionStatus.title = '';
                    // Hide disconnect button when disconnected
                    if (disconnectBtn) {
                        disconnectBtn.style.display = 'none';
                    }
                    // Show tenant setup and hide current connection card
                    if (tenantSetup) {
                        tenantSetup.style.display = 'block';
                    }
                    if (currentConnection) {
                        currentConnection.style.display = 'none';
                    }
                    this.isConnected = false;
            }
        }
    }

    scrollToChatSection() {
        const chatSection = document.getElementById('chatSection');
        const welcomeSection = document.getElementById('welcomeSection');
        
        if (chatSection) {
            // If chat section is hidden (we're on welcome page), show it first
            if (chatSection.style.display === 'none') {
                this.showChatInterface();
                // Add a welcome back message
                this.showSuccess(`💬 Welcome back to the chat interface! You can continue your conversation with ${this.currentTenant}.`);
            } else {
                // If chat section is already visible, just scroll to it
                chatSection.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start' 
                });
                // Add a subtle highlight effect
                chatSection.style.transition = 'box-shadow 0.3s ease';
                chatSection.style.boxShadow = '0 0 20px rgba(16, 185, 129, 0.3)';
                setTimeout(() => {
                    chatSection.style.boxShadow = '';
                }, 2000);
            }
        }
    }

    handleMCPStatus(data) {
        console.log('MCP Status:', data);
        
        if (data.status === 'ready') {
            this.updateConnectionStatus('connected', this.currentTenant);
        } else if (data.status === 'error') {
            this.showError('Failed to connect to Microsoft 365 tenant');
            this.updateConnectionStatus('disconnected');
        }
    }

    handleAuthStatusChanged(data) {
        console.log('🔍 DEBUG - handleAuthStatusChanged called with data:', JSON.stringify(data, null, 2));
        console.log('Auth Status Changed:', data);
        
        try {
            switch (data.status) {
                case 'authenticated':
                    console.log('🔍 DEBUG - Processing authenticated status for tenant:', data.tenantDomain);
                    // Use setTimeout to ensure DOM updates from any previous calls complete
                    setTimeout(() => {
                        this.updateConnectionStatus('connected', data.tenantDomain);
                        console.log('🔍 DEBUG - updateConnectionStatus completed successfully');
                    }, 100);
                    
                    // Save session data to localStorage for cross-page functionality
                    if (this.sessionId && data.tenantDomain) {
                        try {
                            localStorage.setItem('icb_session', this.sessionId);
                            localStorage.setItem('icb_tenant', data.tenantDomain);
                            console.log('💾 Session data saved to localStorage');
                        } catch (error) {
                            console.warn('⚠️ Could not save session to localStorage:', error);
                        }
                    }
                    
                    this.showSuccess(`🎉 Authentication successful for ${data.tenantDomain}! You can now query your Microsoft 365 environment.`);
                    
                    // Show a system message in chat if chat interface is visible
                    if (document.getElementById('chatSection').style.display !== 'none') {
                        this.addMessage(`✅ **Authentication Complete!**\n\nYou're now connected to **${data.tenantDomain}** and can ask questions about your Microsoft 365 environment.\n\n🔐 **Access token received and stored securely.**`, 'system');
                    }
                    break;
                    
                case 'needs_authentication':
                    console.log('🔍 DEBUG - Processing needs_authentication status');
                    this.updateConnectionStatus('connecting', data.tenantDomain || this.currentTenant);
                    this.showAuthenticationNotice(data);
                    break;
                    
                case 'authentication_error':
                    console.log('🔍 DEBUG - Processing authentication_error status');
                    this.updateConnectionStatus('disconnected');
                    this.showError(`Authentication failed: ${data.message}`);
                    break;
                    
                default:
                    console.warn('🔍 DEBUG - Unknown auth status:', data.status);
            }
        } catch (error) {
            console.error('❌ Error in handleAuthStatusChanged switch statement:', error);
        }
    }

    showAuthenticationNotice(data) {
        // Show a prominent notice about authentication
        const notice = `🔐 **Authentication Required**

Please complete the sign-in process in the browser window that should have opened.

**Tenant:** ${data.tenantDomain}
**Auth URL:** ${data.authUrl || 'http://localhost:3200'}

Once you complete authentication, you'll be able to query your Microsoft 365 environment.`;

        // Show in chat if available
        if (document.getElementById('chatSection').style.display !== 'none') {
            this.addMessage(notice, 'system');
        }
        
        // Also show as a notification
        this.showNotification('Authentication window opened - please complete sign-in process', 'info', 8000);
    }

    handlePermissionRequest(data) {
        console.log('Permission request received:', data);
        
        // Add a prominent system message about the permission request
        const permissionMessage = `🔐 **Additional Permissions Required**

Your query: "${data.originalMessage}"

**Required Microsoft Graph Permissions:**
${data.scopes.map(scope => `• ${scope}`).join('\n')}

**🚀 Permission Request Process:**

1. **Browser Window Opening** - A new tab will open for permission consent
2. **Review Permissions** - Please review and approve the requested permissions
3. **Grant Access** - Click "Accept" to grant the required permissions
4. **Automatic Redirect** - You'll be redirected back to the ICB Agent
5. **Query Rerun** - Your original query will be automatically processed

**⏳ Please complete the permission consent process...**

The authentication window should open automatically. If it doesn't, please check for popup blockers or [click here to open manually](http://localhost:3200).

After granting permissions, your query will be automatically rerun and results displayed below.`;

        this.addMessage(permissionMessage, 'system');
        
        // Show notification
        this.showNotification(`Permission consent required for: ${data.scopes.join(', ')}`, 'info', 10000);
        
        // Store the permission request data for potential manual rerun
        this.lastPermissionRequest = {
            scopes: data.scopes,
            originalMessage: data.originalMessage,
            timestamp: data.timestamp
        };
        
        // Add a timeout to check if the user needs help
        setTimeout(() => {
            if (this.lastPermissionRequest) {
                this.addMessage(`⏰ **Still waiting for permission approval?**

If the permission window didn't open or you're having trouble:

1. **Check for popup blockers** - Allow popups for this site
2. **Manual authentication** - Visit: http://localhost:3200
3. **Browser issues** - Try refreshing this page after authentication
4. **Need help** - Contact your administrator if permissions are blocked

Once you complete the permission process, your query will be automatically processed!`, 'system');
            }
        }, 30000); // Show help after 30 seconds
    }

    setButtonLoading(buttonId, isLoading) {
        const button = document.getElementById(buttonId);
        const btnText = button.querySelector('.btn-text');
        const btnLoader = button.querySelector('.btn-loader');
        
        button.disabled = isLoading;
        
        if (isLoading) {
            btnText.style.display = 'none';
            btnLoader.style.display = 'block';
        } else {
            btnText.style.display = 'block';
            btnLoader.style.display = 'none';
        }
    }

    autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    }

    isValidDomain(domain) {
        // Allow various Microsoft 365 domain formats:
        // - Primary .onmicrosoft.com domains (e.g., contoso.onmicrosoft.com)
        // - Custom verified domains (e.g., contoso.com, company.co.uk)
        // - Subdomains (e.g., mail.contoso.com)
        
        // Basic domain pattern validation
        const basicDomainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
        
        // Check if it matches basic domain format
        if (!basicDomainRegex.test(domain)) {
            return false;
        }
        
        // Additional checks for common Microsoft 365 patterns
        const commonPatterns = [
            /\.onmicrosoft\.com$/i,           // Primary tenant domains
            /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/i, // Simple custom domains (e.g., contoso.com)
            /^[a-zA-Z0-9-]+\.[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/i, // Subdomains (e.g., mail.contoso.com)
        ];
        
        // Allow if it matches any common pattern
        const matchesPattern = commonPatterns.some(pattern => pattern.test(domain));
        
        // Additional validation: reject obviously invalid formats
        const invalidPatterns = [
            /^-/,           // Cannot start with hyphen
            /-$/,           // Cannot end with hyphen
            /\.\./,         // Cannot have consecutive dots
            /^\.|\.$/, // Cannot start or end with dot
        ];
        
        const hasInvalidPattern = invalidPatterns.some(pattern => pattern.test(domain));
        
        return matchesPattern && !hasInvalidPattern;
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showInfo(message) {
        this.showNotification(message, 'info');
    }

    showNotification(message, type, duration = 5000) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Add styles
        const backgroundColor = type === 'error' ? 'var(--error)' : 
                               type === 'info' ? 'var(--primary)' : 'var(--success)';
        
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '8px',
            color: 'white',
            fontWeight: '500',
            zIndex: '9999',
            maxWidth: '400px',
            backgroundColor: backgroundColor,
            boxShadow: 'var(--shadow-lg)',
            transform: 'translateX(100%)',
            transition: 'transform 0.3s ease'
        });
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 10);
        
        // Remove after specified duration
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, duration);
    }

    // ==================== ZERO TRUST ASSESSMENT METHODS ====================

    showZeroTrustAssessment() {
        if (this.zeroTrustAssessment) {
            this.zeroTrustAssessment.show();
        } else {
            this.showError('Zero Trust Assessment not available');
        }
    }

    hideZeroTrustAssessment() {
        if (this.zeroTrustAssessment) {
            this.zeroTrustAssessment.hide();
        }
    }

    showModal(title, content) {
        // Create modal backdrop
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';
        Object.assign(backdrop.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: '10000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: '0',
            transition: 'opacity 0.3s ease'
        });

        // Create modal content
        const modal = document.createElement('div');
        modal.className = 'modal-content';
        Object.assign(modal.style, {
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
            transform: 'scale(0.9)',
            transition: 'transform 0.3s ease'
        });

        modal.innerHTML = `
            <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid #e5e7eb; padding-bottom: 16px;">
                <h3 style="margin: 0; color: var(--primary-700); font-size: 1.25rem;">${title}</h3>
                <button class="modal-close" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280;">×</button>
            </div>
            <div class="modal-body">
                ${content}
            </div>
        `;

        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);

        // Animate in
        setTimeout(() => {
            backdrop.style.opacity = '1';
            modal.style.transform = 'scale(1)';
        }, 10);

        // Close handlers
        const closeModal = () => {
            backdrop.style.opacity = '0';
            modal.style.transform = 'scale(0.9)';
            setTimeout(() => {
                if (backdrop.parentNode) {
                    backdrop.parentNode.removeChild(backdrop);
                }
            }, 300);
        };

        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) closeModal();
        });

        modal.querySelector('.modal-close').addEventListener('click', closeModal);
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing ICB Agent...'); // Debug log
    window.icbAgent = new ICBAgent();
    console.log('ICB Agent created:', window.icbAgent); // Debug log
});
