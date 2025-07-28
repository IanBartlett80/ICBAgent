// ICB Agent - AI-Powered Landing Page Application
class ICBAgent {
    constructor() {
        this.isConnected = false;
        this.tenantDomain = null;
        this.sessionId = null;
        this.chatActive = false;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateConnectionStatus('disconnected');
        this.initializeAnimations();
        console.log('ICB Agent landing page initialized');
    }

    setupEventListeners() {
        // Domain input and connect button
        const domainInput = document.getElementById('tenant-domain');
        const connectButton = document.getElementById('connect-button');
        
        if (domainInput) {
            domainInput.addEventListener('input', () => this.validateDomainInput());
            domainInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !connectButton.disabled) {
                    this.connectTenant();
                }
            });
        }

        if (connectButton) {
            connectButton.addEventListener('click', () => this.connectTenant());
        }

        // Modal handlers
        this.setupModalHandlers();
        
        // Chat interface handlers
        this.setupChatHandlers();
    }

    setupModalHandlers() {
        // Close modals on backdrop click or close button
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-backdrop') || 
                e.target.classList.contains('modal-close')) {
                this.closeModals();
            }
            
            if (e.target.id === 'start-chat-button') {
                this.startChat();
            }
        });

        // Close modal on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModals();
            }
        });
    }

    setupChatHandlers() {
        const messageInput = document.getElementById('message-input');
        const sendButton = document.getElementById('send-message');
        const minimizeButton = document.getElementById('minimize-chat');

        if (messageInput) {
            messageInput.addEventListener('input', () => {
                this.adjustTextareaHeight();
                this.updateSendButtonState();
            });
            
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }

        if (sendButton) {
            sendButton.addEventListener('click', () => this.sendMessage());
        }

        if (minimizeButton) {
            minimizeButton.addEventListener('click', () => this.minimizeChat());
        }
    }

    initializeAnimations() {
        // Add random delays to neural network elements for more natural animation
        const nodes = document.querySelectorAll('.node');
        nodes.forEach((node, index) => {
            const delay = Math.random() * 3;
            node.style.animationDelay = `${delay}s`;
        });

        const particles = document.querySelectorAll('.particle');
        particles.forEach((particle, index) => {
            const delay = Math.random() * 8;
            particle.style.animationDelay = `${delay}s`;
        });
    }

    validateDomainInput() {
        const domainInput = document.getElementById('tenant-domain');
        const connectButton = document.getElementById('connect-button');
        const validationIcon = document.querySelector('.validation-icon');
        
        if (!domainInput || !connectButton) return;
        
        const domain = domainInput.value.trim();
        const isValid = this.isValidDomain(domain);
        
        // Update button state
        connectButton.disabled = !isValid;
        
        // Update validation indicator
        if (validationIcon) {
            if (domain.length === 0) {
                validationIcon.style.display = 'none';
            } else if (isValid) {
                validationIcon.style.display = 'block';
                validationIcon.style.background = 'var(--icb-success)';
                validationIcon.innerHTML = '✓';
            } else {
                validationIcon.style.display = 'block';
                validationIcon.style.background = 'var(--icb-error)';
                validationIcon.innerHTML = '✕';
            }
        }
    }

    isValidDomain(domain) {
        // Simple domain validation
        const basicDomainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
        return basicDomainRegex.test(domain) && domain.length > 3;
    }

    async connectTenant() {
        const domainInput = document.getElementById('tenant-domain');
        const connectButton = document.getElementById('connect-button');
        
        if (!domainInput || !connectButton) return;
        
        const domain = domainInput.value.trim();
        
        if (!this.isValidDomain(domain)) {
            this.showErrorModal('Please enter a valid domain name');
            return;
        }

        // Show loading state
        this.setButtonLoading(connectButton, true);
        this.updateConnectionStatus('connecting');
        
        try {
            // Step 1: Create session
            console.log('Creating session for domain:', domain);
            const sessionResponse = await fetch('/api/session/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ tenantDomain: domain }),
            });

            console.log('Session response status:', sessionResponse.status);
            
            if (!sessionResponse.ok) {
                const errorData = await sessionResponse.json();
                console.error('Session creation failed:', errorData);
                throw new Error(errorData.error || 'Failed to create session');
            }

            const sessionData = await sessionResponse.json();
            console.log('Session created successfully:', sessionData);
            this.sessionId = sessionData.sessionId;
            
            // Step 2: Start MCP connection
            console.log('Starting MCP connection for session:', this.sessionId);
            const mcpResponse = await fetch('/api/mcp/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    sessionId: this.sessionId,
                    tenantDomain: domain 
                }),
            });

            console.log('MCP response status:', mcpResponse.status);

            if (!mcpResponse.ok) {
                const errorData = await mcpResponse.json();
                console.error('MCP start failed:', errorData);
                throw new Error(errorData.error || 'Failed to start MCP connection');
            }

            const mcpData = await mcpResponse.json();
            console.log('MCP connection started successfully:', mcpData);
            
            // Success!
            this.tenantDomain = domain;
            this.isConnected = true;
            this.updateConnectionStatus('connected');
            this.showSuccessModal();
            
            const connectedDomainElement = document.getElementById('connected-domain');
            if (connectedDomainElement) {
                connectedDomainElement.textContent = domain;
            }
            
            console.log('Connection process completed successfully');
            
        } catch (error) {
            console.error('Connection error details:', error);
            this.updateConnectionStatus('disconnected');
            this.showErrorModal('Unable to connect to your Microsoft 365 tenant. Please check your domain and try again.');
        } finally {
            this.setButtonLoading(connectButton, false);
        }
    }

    setButtonLoading(button, loading) {
        if (loading) {
            button.classList.add('loading');
            button.disabled = true;
        } else {
            button.classList.remove('loading');
            button.disabled = false;
        }
    }

    updateConnectionStatus(status) {
        const indicator = document.querySelector('.status-indicator');
        const statusText = document.querySelector('.status-text');
        
        if (indicator && statusText) {
            indicator.className = `status-indicator ${status}`;
            
            const statusMessages = {
                'connected': 'Connected',
                'connecting': 'Connecting...',
                'disconnected': 'Ready to Connect'
            };
            
            statusText.textContent = statusMessages[status] || 'Unknown';
        }
    }

    showSuccessModal() {
        const modal = document.getElementById('success-modal');
        if (modal) {
            modal.classList.add('active');
        }
    }

    showErrorModal(message) {
        const modal = document.getElementById('error-modal');
        const errorMessage = document.getElementById('error-message');
        
        if (modal && errorMessage) {
            errorMessage.textContent = message;
            modal.classList.add('active');
        }
    }

    closeModals() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => modal.classList.remove('active'));
    }

    startChat() {
        this.closeModals();
        const chatInterface = document.getElementById('chat-interface');
        if (chatInterface) {
            chatInterface.classList.remove('hidden');
            this.chatActive = true;
            
            // Add welcome message
            this.addChatMessage('assistant', 
                `Welcome! I'm your AI assistant connected to ${this.tenantDomain}. How can I help you today?`
            );
        }
    }

    minimizeChat() {
        const chatInterface = document.getElementById('chat-interface');
        if (chatInterface) {
            chatInterface.classList.add('hidden');
            this.chatActive = false;
        }
    }

    async sendMessage() {
        const messageInput = document.getElementById('message-input');
        if (!messageInput) return;
        
        const message = messageInput.value.trim();
        if (!message) return;
        
        if (!this.sessionId) {
            this.showErrorModal('Please connect to a tenant first');
            return;
        }
        
        // Add user message to chat
        this.addChatMessage('user', message);
        
        // Clear input
        messageInput.value = '';
        this.adjustTextareaHeight();
        this.updateSendButtonState();
        
        // Show typing indicator
        this.showTypingIndicator();
        
        try {
            // Send message to chat API
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    message: message,
                    timestamp: new Date().toISOString()
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to send message');
            }

            const responseData = await response.json();
            
            // Hide typing indicator and add response
            this.hideTypingIndicator();
            this.addChatMessage('assistant', responseData.response || 'I received your message and I\'m processing it.');
            
        } catch (error) {
            console.error('Chat error:', error);
            this.hideTypingIndicator();
            this.addChatMessage('assistant', `Sorry, I encountered an error: ${error.message}`);
        }
    }

    addChatMessage(sender, content) {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;
        
        // Remove typing indicator
        this.hideTypingIndicator();
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${sender}`;
        messageDiv.innerHTML = `
            <div class="message-avatar">${sender === 'user' ? 'U' : 'AI'}</div>
            <div class="message-content">
                <div class="message-text">${content}</div>
                <div class="message-time">${this.formatTime()}</div>
            </div>
        `;
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    showTypingIndicator() {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;
        
        this.hideTypingIndicator(); // Remove existing indicator
        
        const typingDiv = document.createElement('div');
        typingDiv.className = 'chat-message assistant typing-indicator';
        typingDiv.innerHTML = `
            <div class="message-avatar">AI</div>
            <div class="message-content">
                <div class="typing-dots">
                    <div class="dot"></div>
                    <div class="dot"></div>
                    <div class="dot"></div>
                </div>
            </div>
        `;
        
        messagesContainer.appendChild(typingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    hideTypingIndicator() {
        const indicator = document.querySelector('.typing-indicator');
        if (indicator) {
            indicator.remove();
        }
    }

    adjustTextareaHeight() {
        const textarea = document.getElementById('message-input');
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
        }
    }

    updateSendButtonState() {
        const messageInput = document.getElementById('message-input');
        const sendButton = document.getElementById('send-message');
        
        if (messageInput && sendButton) {
            const hasContent = messageInput.value.trim().length > 0;
            sendButton.disabled = !hasContent;
        }
    }

    formatTime() {
        return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    window.icbAgent = new ICBAgent();
    console.log('ICB Agent application ready');
});
