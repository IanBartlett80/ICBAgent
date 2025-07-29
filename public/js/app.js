class ICBAgent {
    constructor() {
        this.socket = null;
        this.sessionId = null;
        this.currentTenant = null;
        this.isConnected = false;
        
        this.init();
    }

    init() {
        console.log('ICBAgent initializing...'); // Debug log
        this.initializeSocket();
        this.bindEvents();
        this.updateConnectionStatus('disconnected');
        this.setupAuthenticationListener();
        console.log('ICBAgent initialized'); // Debug log
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
            this.handleAuthStatusChanged(data);
        });

        this.socket.on('chat_response', (data) => {
            this.addMessage(data.message, 'assistant');
        });

        this.socket.on('permission_request', (data) => {
            this.handlePermissionRequest(data);
        });

        this.socket.on('query_rerun_complete', (data) => {
            this.addMessage(data.message, 'assistant');
        });
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

            // Switch to chat interface
            this.showChatInterface();
            this.updateConnectionStatus('connected', this.currentTenant);

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
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to send message');
            }

            // Add AI response to chat
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

    addMessage(content, type, isError = false) {
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
        
        // Enhanced message rendering with insights and recommendations
        if (type === 'assistant') {
            messageContent.innerHTML = this.renderEnhancedResponse(content);
        } else {
            messageContent.innerHTML = this.formatMessage(content);
        }

        messageDiv.appendChild(messageContent);
        chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    formatMessage(content) {
        // Basic markdown-like formatting
        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
    }

    renderEnhancedResponse(content) {
        // Enhanced markdown rendering with insights and recommendations
        let html = this.parseMarkdown(content);
        
        // Add insights and recommendations if this looks like a data response
        if (this.isDataResponse(content)) {
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
        
        // Lists - Enhanced styling
        html = html.replace(/^• (.*$)/gm, '<li class="response-list-item">$1</li>');
        html = html.replace(/^- (.*$)/gm, '<li class="response-list-item">$1</li>');
        html = html.replace(/(<li class="response-list-item">.*<\/li>)/s, '<ul class="response-list">$1</ul>');
        
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
        return dataIndicators.some(indicator => lowerContent.includes(indicator));
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
        console.log('Auth Status Changed:', data);
        
        switch (data.status) {
            case 'authenticated':
                this.updateConnectionStatus('connected', data.tenantDomain);
                this.showSuccess(`🎉 Authentication successful for ${data.tenantDomain}! You can now query your Microsoft 365 environment.`);
                
                // Show a system message in chat if chat interface is visible
                if (document.getElementById('chatSection').style.display !== 'none') {
                    this.addMessage(`✅ **Authentication Complete!**\n\nYou're now connected to **${data.tenantDomain}** and can ask questions about your Microsoft 365 environment.\n\n🔐 **Access token received and stored securely.**`, 'system');
                }
                break;
                
            case 'needs_authentication':
                this.updateConnectionStatus('connecting', data.tenantDomain || this.currentTenant);
                this.showAuthenticationNotice(data);
                break;
                
            case 'authentication_error':
                this.updateConnectionStatus('disconnected');
                this.showError(`Authentication failed: ${data.message}`);
                break;
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
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing ICB Agent...'); // Debug log
    window.icbAgent = new ICBAgent();
    console.log('ICB Agent created:', window.icbAgent); // Debug log
});
