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
        console.log('ICBAgent initialized'); // Debug log
    }

    initializeSocket() {
        this.socket = io();
        
        this.socket.on('connect', () => {
            console.log('Socket connected');
            this.updateConnectionStatus('connected');
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
        this.updateConnectionStatus('connecting');

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
            this.updateConnectionStatus('connected');

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
        messageContent.innerHTML = this.formatMessage(content);

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

    showChatInterface() {
        document.getElementById('welcomeSection').style.display = 'none';
        document.getElementById('chatSection').style.display = 'block';
        document.getElementById('currentTenant').textContent = this.currentTenant;
        
        // Focus on message input
        document.getElementById('messageInput').focus();
    }

    showWelcomeInterface() {
        document.getElementById('chatSection').style.display = 'none';
        document.getElementById('welcomeSection').style.display = 'block';
        
        // Clear form
        document.getElementById('tenantDomain').value = '';
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

    updateConnectionStatus(status) {
        const indicator = document.querySelector('.status-indicator');
        const text = document.querySelector('.status-text');
        
        indicator.className = `status-indicator ${status}`;
        
        switch (status) {
            case 'connected':
                text.textContent = 'Connected';
                this.isConnected = true;
                break;
            case 'connecting':
                text.textContent = 'Connecting...';
                this.isConnected = false;
                break;
            default:
                text.textContent = 'Disconnected';
                this.isConnected = false;
        }
    }

    handleMCPStatus(data) {
        console.log('MCP Status:', data);
        
        if (data.status === 'ready') {
            this.updateConnectionStatus('connected');
        } else if (data.status === 'error') {
            this.showError('Failed to connect to Microsoft 365 tenant');
            this.updateConnectionStatus('disconnected');
        }
    }

    handleAuthStatusChanged(data) {
        console.log('Auth Status Changed:', data);
        
        switch (data.status) {
            case 'authenticated':
                this.updateConnectionStatus('connected');
                this.showSuccess(`🎉 Authentication successful for ${data.tenantDomain}! You can now query your Microsoft 365 environment.`);
                
                // Show a system message in chat if chat interface is visible
                if (document.getElementById('chatSection').style.display !== 'none') {
                    this.addMessage(`✅ **Authentication Complete!**\n\nYou're now connected to **${data.tenantDomain}** and can ask questions about your Microsoft 365 environment.\n\n🔐 **Access token received and stored securely.**`, 'system');
                }
                break;
                
            case 'needs_authentication':
                this.updateConnectionStatus('connecting');
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

A browser window should open shortly for you to grant the additional permissions.`;

        this.addMessage(permissionMessage, 'system');
        
        // Show notification
        this.showNotification(`Permission consent required for: ${data.scopes.join(', ')}`, 'info', 10000);
        
        // Optional: You could also open the permission URL if provided
        // setTimeout(() => {
        //     if (data.authUrl) {
        //         window.open(data.authUrl, '_blank');
        //     }
        // }, 1000);
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
