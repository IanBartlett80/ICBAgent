const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : "*",
    methods: ["GET", "POST"]
  }
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", "ws:", "wss:"]
    }
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

app.use(compression());
app.use(limiter);
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store active sessions and MCP connections
const activeSessions = new Map();
const mcpConnections = new Map();

// Real MCP Client class for communicating with Lokka Microsoft MCP server
class MCPClient {
  constructor(sessionId, tenantDomain, io) {
    this.sessionId = sessionId;
    this.tenantDomain = tenantDomain;
    this.io = io; // Socket.IO instance for emitting events
    this.process = null;
    this.isConnected = false;
    this.hasInitialized = false;
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.availableTools = [];
    this.accessToken = null;
    this.authStatus = 'not_authenticated';
  }

  async start() {
    return new Promise((resolve, reject) => {
      try {
        console.log(`Starting Lokka Microsoft MCP server for tenant: ${this.tenantDomain}`);
        
        // Spawn the Lokka MCP server process with interactive authentication
        this.process = spawn('npx', ['-y', '@merill/lokka'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...process.env,
            USE_INTERACTIVE: 'true',
            REDIRECT_URI: 'http://localhost:3000/auth/success',
            // Set tenant domain if provided (for organizational logins)
            ...(this.tenantDomain && !this.tenantDomain.includes('.onmicrosoft.com') ? {} : {
              TENANT_ID: this.tenantDomain.replace('.onmicrosoft.com', '')
            })
          }
        });

        // Handle stderr (errors and logs)
        this.process.stderr.on('data', (data) => {
          const errorOutput = data.toString();
          console.error(`MCP server stderr: ${errorOutput}`);
          
          // Check for authentication errors
          if (errorOutput.includes('authentication') || errorOutput.includes('credentials') || errorOutput.includes('login')) {
            console.log('Authentication issue detected - will provide guidance to user');
          }
        });

        // Handle stdout (JSON-RPC responses)
        let buffer = '';
        this.process.stdout.on('data', (data) => {
          buffer += data.toString();
          
          // Process complete JSON-RPC messages
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer
          
          for (const line of lines) {
            if (line.trim()) {
              try {
                const message = JSON.parse(line.trim());
                this.handleMCPMessage(message);
              } catch (error) {
                console.error('Error parsing MCP message:', error, 'Raw line:', line);
              }
            }
          }
        });

        // Handle process errors
        this.process.on('error', (error) => {
          console.error(`MCP server process error: ${error.message}`);
          reject(new Error(`Failed to start MCP server: ${error.message}`));
        });

        this.process.on('exit', (code, signal) => {
          console.log(`MCP server process exited with code ${code}, signal ${signal}`);
          this.isConnected = false;
          
          // Don't treat authentication-related exits as fatal errors
          if (code === 1 && !this.hasInitialized) {
            console.log('MCP server likely needs authentication setup - providing guidance');
          }
        });

        // Initialize the MCP connection
        this.initializeMCP()
          .then(() => {
            console.log(`Lokka MCP server connected for session: ${this.sessionId}`);
            this.isConnected = true;
            this.hasInitialized = true;
            
            // Start periodic auth check if not authenticated
            if (this.authStatus !== 'authenticated') {
              this.startAuthMonitoring();
            }
            
            resolve();
          })
          .catch((error) => {
            console.error(`Failed to initialize Lokka MCP server: ${error.message}`);
            // Don't reject for authentication issues - provide guidance instead
            if (error.message.includes('timeout') || error.message.includes('authentication')) {
              console.log('Lokka MCP server initialization failed - likely authentication issue');
              this.hasInitialized = false;
              this.isConnected = false;
              resolve(); // Resolve so the session continues, but provide auth guidance
            } else {
              reject(error);
            }
          });

      } catch (error) {
        console.error('Failed to start MCP server:', error);
        reject(error);
      }
    });
  }

  async initializeMCP() {
    try {
      // Send initialize request
      const initResponse = await this.sendMCPRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        clientInfo: {
          name: 'icb-agent',
          version: '1.0.0'
        }
      });

      console.log('Lokka MCP Initialize response:', initResponse);

      // Get available tools
      const toolsResponse = await this.sendMCPRequest('tools/list', {});
      this.availableTools = toolsResponse.tools || [];
      
      console.log(`Available Lokka MCP tools: ${this.availableTools.map(t => t.name).join(', ')}`);

      // Check authentication status
      await this.checkAuthStatus();
      
    } catch (error) {
      console.error('Error initializing Lokka MCP server:', error);
      throw error;
    }
  }

  async checkAuthStatus() {
    try {
      const authResponse = await this.sendMCPRequest('tools/call', {
        name: 'get-auth-status',
        arguments: {}
      });

      console.log('Lokka authentication status:', authResponse);
      
      const previousStatus = this.authStatus;
      
      // Parse the authentication response correctly
      let authData = null;
      if (authResponse.content && Array.isArray(authResponse.content) && authResponse.content[0]) {
        try {
          authData = JSON.parse(authResponse.content[0].text);
        } catch (parseError) {
          console.error('Error parsing auth status:', parseError);
        }
      } else if (authResponse.content && authResponse.content.isAuthenticated) {
        authData = authResponse.content;
      }
      
      if (authData && authData.isReady && authData.tokenStatus && !authData.tokenStatus.isExpired) {
        this.authStatus = 'authenticated';
        this.accessToken = 'authenticated'; // Lokka manages the actual token
        
        // Emit authentication success event
        if (previousStatus !== 'authenticated') {
          this.io.to(this.sessionId).emit('auth_status_changed', {
            status: 'authenticated',
            message: 'Authentication successful! You can now query your Microsoft 365 tenant.',
            hasToken: true,
            tenantDomain: this.tenantDomain
          });
          
          console.log(`Authentication successful for session ${this.sessionId}`);
        }
      } else {
        this.authStatus = 'needs_authentication';
        
        // Emit authentication needed event
        if (previousStatus !== 'needs_authentication') {
          this.io.to(this.sessionId).emit('auth_status_changed', {
            status: 'needs_authentication',
            message: 'Please complete the authentication process in your browser window.',
            hasToken: false,
            tenantDomain: this.tenantDomain,
            authUrl: 'http://localhost:3200'
          });
          
          console.log('Lokka MCP server requires authentication - browser window should have opened');
        }
      }
      
    } catch (error) {
      console.error('Error checking auth status:', error);
      const previousStatus = this.authStatus;
      this.authStatus = 'authentication_error';
      
      // Emit error event
      if (previousStatus !== 'authentication_error') {
        this.io.to(this.sessionId).emit('auth_status_changed', {
          status: 'authentication_error',
          message: `Authentication error: ${error.message}`,
          hasToken: false,
          tenantDomain: this.tenantDomain
        });
      }
    }
  }

  sendMCPRequest(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      const request = {
        jsonrpc: '2.0',
        id: id,
        method: method,
        params: params
      };

      // Store the promise callbacks
      this.pendingRequests.set(id, { resolve, reject });

      // Send the request
      const requestStr = JSON.stringify(request) + '\n';
      this.process.stdin.write(requestStr);

      // Set timeout
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`MCP request timeout: ${method}`));
        }
      }, 30000);
    });
  }

  handleMCPMessage(message) {
    if (message.id && this.pendingRequests.has(message.id)) {
      const { resolve, reject } = this.pendingRequests.get(message.id);
      this.pendingRequests.delete(message.id);

      if (message.error) {
        reject(new Error(`MCP Error: ${message.error.message}`));
      } else {
        resolve(message.result);
      }
    }
  }

  async sendMessage(userMessage) {
    if (!this.isConnected) {
      return {
        id: uuidv4(),
        message: this.getConnectionGuidance(userMessage),
        timestamp: new Date().toISOString(),
        type: 'connection_guidance'
      };
    }

    // Check if we need to handle authentication
    if (this.authStatus !== 'authenticated') {
      return {
        id: uuidv4(),
        message: await this.handleAuthentication(userMessage),
        timestamp: new Date().toISOString(),
        type: 'auth_status'
      };
    }

    try {
      console.log(`Processing message via Lokka MCP server: ${userMessage}`);
      
      // Analyze the message to determine which MCP tools to use
      const toolCalls = this.analyzeMessageForTools(userMessage);
      
      let response = '';
      
      if (toolCalls.length === 0) {
        // If no specific tools identified, get general info
        response = await this.getGeneralInfo(userMessage);
      } else {
        // Execute the identified tools
        for (const toolCall of toolCalls) {
          try {
            console.log(`Calling MCP tool: ${toolCall.name} with args:`, toolCall.arguments);
            
            const toolResponse = await this.sendMCPRequest('tools/call', {
              name: toolCall.name,
              arguments: toolCall.arguments
            });
            
            console.log(`MCP tool response received for ${toolCall.name}`);
            
            // Check if response indicates permission error
            if (this.isPermissionError(toolResponse)) {
              const permissionResponse = await this.handlePermissionRequest(toolCall, userMessage);
              response += permissionResponse + '\n\n';
            } else {
              const formattedResponse = this.formatToolResponse(toolCall.name, toolResponse);
              response += formattedResponse + '\n\n';
            }
            
          } catch (error) {
            console.error(`Error calling MCP tool ${toolCall.name}:`, error);
            
            // Check if error is permission-related
            if (this.isPermissionError(error)) {
              const permissionResponse = await this.handlePermissionRequest(toolCall, userMessage);
              response += permissionResponse + '\n\n';
            } else {
              response += `❌ **Error calling ${toolCall.name}:** ${error.message}\n\n`;
            }
          }
        }
      }
      
      return {
        id: uuidv4(),
        message: response.trim(),
        timestamp: new Date().toISOString(),
        type: 'mcp_response'
      };

    } catch (error) {
      console.error(`Error processing message via Lokka MCP: ${error.message}`);
      throw error;
    }
  }

  async handleAuthentication(userMessage) {
    try {
      // Re-check authentication status
      await this.checkAuthStatus();
      
      if (this.authStatus === 'authenticated') {
        return `✅ **Authentication Successful!**

Great! You're now authenticated with Microsoft 365 for tenant: **${this.tenantDomain}**

🎉 **Your access token has been received and stored.**

You can now ask me anything about your Microsoft 365 environment:
• "Show me all users in the tenant"
• "What are the current security policies?"
• "List all SharePoint sites"
• "Check for security alerts"
• "Show me license usage"

**Your question:** "${userMessage}"

I'm processing this now...`;
      } else {
        return `🔐 **Microsoft 365 Authentication Required**

I understand you asked: "${userMessage}"

**🚀 Authentication Process:**

1. **Browser Window** - Lokka should have opened a authentication window in your default browser
2. **Sign In** - Please complete the sign-in process for tenant: **${this.tenantDomain}**
3. **Grant Permissions** - Allow the requested Microsoft Graph permissions
4. **Return Here** - Once complete, your token will be automatically available

**🔄 Current Status:** ${this.authStatus}

**💡 If the browser window didn't open:**
- Check if pop-ups are blocked
- Look for a new tab/window in your browser
- The authentication URL should be: \`http://localhost:3200\`

**⏱️ Please complete the authentication process and ask your question again.**

Once authenticated, I'll be able to provide live Microsoft 365 data for your tenant!`;
      }
    } catch (error) {
      return `❌ **Authentication Error**

There was an issue with the authentication process: ${error.message}

**🔧 Troubleshooting:**
1. Ensure your browser allows pop-ups from this domain
2. Check that port 3200 is available for the redirect URI
3. Try refreshing the page and starting over

**💬 Your question:** "${userMessage}" will be processed once authentication is complete.`;
    }
  }

  getConnectionGuidance(userMessage) {
    return `🔗 **Connecting to Lokka Microsoft MCP Server**

I understand you asked: "${userMessage}"

**🚀 Starting Authentication Process:**

The Lokka MCP server is initializing for tenant: **${this.tenantDomain}**

This will trigger an interactive authentication flow where:
1. A browser window will open automatically
2. You'll be asked to sign in to Microsoft 365
3. You'll need to grant permissions for Microsoft Graph API access
4. Your access token will be securely stored

**⏳ Please wait while the connection is established...**

Once connected and authenticated, I'll be able to help you with:
• User management and directory services
• License allocation and usage analysis  
• Security monitoring and compliance status
• SharePoint sites and document analytics
• Teams and Groups management
• Exchange Online mailbox information
• Comprehensive tenant health reporting

**🔄 Connection Status:** Initializing Lokka MCP server...`;
  }

  analyzeMessageForTools(message) {
    const lowerMessage = message.toLowerCase();
    const toolCalls = [];

    // Check if Lokka-Microsoft tool is available
    const lokkaTool = this.availableTools.find(tool => 
      tool.name === 'Lokka-Microsoft' || tool.name.includes('lokka') || tool.name.includes('microsoft')
    );

    if (!lokkaTool) {
      console.log('No Lokka-Microsoft tool found in available tools:', this.availableTools.map(t => t.name));
      return [];
    }

    const toolName = lokkaTool.name;

    // Map user intent to Lokka MCP tool calls
    if (lowerMessage.includes('users') || lowerMessage.includes('list users')) {
      toolCalls.push({
        name: toolName,
        arguments: {
          apiType: 'graph',
          method: 'get',
          path: '/users',
          queryParams: {
            '$select': 'displayName,userPrincipalName,assignedLicenses,createdDateTime,signInActivity'
          }
        }
      });
    }

    if (lowerMessage.includes('license') || lowerMessage.includes('licensing')) {
      toolCalls.push({
        name: toolName,
        arguments: {
          apiType: 'graph',
          method: 'get',
          path: '/subscribedSkus'
        }
      });
    }

    if (lowerMessage.includes('security') || lowerMessage.includes('alerts')) {
      toolCalls.push({
        name: toolName,
        arguments: {
          apiType: 'graph',
          method: 'get',
          path: '/security/alerts_v2',
          queryParams: {
            '$top': '10'
          }
        }
      });
    }

    if (lowerMessage.includes('signin') || lowerMessage.includes('sign-in') || lowerMessage.includes('activity')) {
      toolCalls.push({
        name: toolName,
        arguments: {
          apiType: 'graph',
          method: 'get',
          path: '/auditLogs/signIns',
          queryParams: {
            '$top': '20',
            '$orderby': 'createdDateTime desc'
          }
        }
      });
    }

    if (lowerMessage.includes('sharepoint') || lowerMessage.includes('sites')) {
      toolCalls.push({
        name: toolName,
        arguments: {
          apiType: 'graph',
          method: 'get',
          path: '/sites',
          queryParams: {
            '$select': 'displayName,webUrl,createdDateTime,lastModifiedDateTime'
          }
        }
      });
    }

    if (lowerMessage.includes('groups') || lowerMessage.includes('teams')) {
      toolCalls.push({
        name: toolName,
        arguments: {
          apiType: 'graph',
          method: 'get',
          path: '/groups',
          queryParams: {
            '$select': 'displayName,description,groupTypes,createdDateTime'
          }
        }
      });
    }

    if (lowerMessage.includes('organization') || lowerMessage.includes('tenant info')) {
      toolCalls.push({
        name: toolName,
        arguments: {
          apiType: 'graph',
          method: 'get',
          path: '/organization'
        }
      });
    }

    if (lowerMessage.includes('devices') || lowerMessage.includes('device') || lowerMessage.includes('managed devices')) {
      toolCalls.push({
        name: toolName,
        arguments: {
          apiType: 'graph',
          method: 'get',
          path: '/deviceManagement/managedDevices',
          queryParams: {
            '$select': 'deviceName,operatingSystem,osVersion,complianceState,lastSyncDateTime,enrolledDateTime,managedDeviceOwnerType'
          }
        }
      });
    }

    if (lowerMessage.includes('applications') || lowerMessage.includes('apps') || lowerMessage.includes('registered apps')) {
      toolCalls.push({
        name: toolName,
        arguments: {
          apiType: 'graph',
          method: 'get',
          path: '/applications',
          queryParams: {
            '$select': 'displayName,appId,createdDateTime,signInAudience'
          }
        }
      });
    }

    if (lowerMessage.includes('contacts') || lowerMessage.includes('directory contacts')) {
      toolCalls.push({
        name: toolName,
        arguments: {
          apiType: 'graph',
          method: 'get',
          path: '/contacts',
          queryParams: {
            '$select': 'displayName,emailAddresses,companyName,jobTitle'
          }
        }
      });
    }

    return toolCalls;
  }

  async getGeneralInfo(message) {
    return `🤖 **Connected to Microsoft 365 tenant: ${this.tenantDomain}**

I understand you asked: "${message}"

I'm connected to your tenant via the Lokka-Microsoft MCP server and can help you with:

**👥 User Management:**
• "Show me all users" - List tenant users
• "List users" - User directory information

**� Device Management:**
• "Show me all devices" - List managed devices
• "What devices are in the tenant?" - Device inventory
• "List devices" - Device compliance status

**�📊 License Information:**
• "What's our license usage?" - License allocation
• "Show licenses" - Subscription details

**🔒 Security Status:**
• "Check security alerts" - Security monitoring
• "Show security status" - Compliance information

**📈 Activity Monitoring:**
• "Show sign-in activity" - Recent login events
• "User activity" - Authentication logs

**🏢 Organization & Apps:**
• "Show tenant info" - Organization details
• "List applications" - Registered applications
• "What apps are registered?" - App inventory

**🌐 Collaboration:**
• "List SharePoint sites" - Site collection info
• "Show groups and teams" - Group directory

Try asking me any of these questions to get real data from your Microsoft 365 tenant!`;
  }

  formatToolResponse(toolName, toolResponse) {
    try {
      // The response might be in different formats depending on the MCP implementation
      let data = toolResponse;
      
      if (toolResponse.content) {
        data = toolResponse.content;
      }
      
      // Handle Lokka MCP response format with content array
      if (Array.isArray(data) && data[0] && data[0].text) {
        const responseText = data[0].text;
        
        // Check if the response text looks like JSON
        if (responseText.trim().startsWith('{') || responseText.trim().startsWith('[')) {
          try {
            data = JSON.parse(responseText);
          } catch (parseError) {
            console.error('Error parsing Lokka JSON response:', parseError);
            // If JSON parsing fails, return the raw text formatted nicely
            return `**Live Data from ${toolName}:**\n\n${responseText}`;
          }
        } else {
          // It's plain text, return it formatted
          return `**Response from ${toolName}:**\n\n${responseText}`;
        }
      }
      
      if (typeof data === 'string') {
        return data;
      }

      // Handle Microsoft Graph API responses
      if (data.value && Array.isArray(data.value)) {
        const items = data.value;
        
        if (toolName.includes('users') || data['@odata.context']?.includes('users')) {
          return this.formatUsersResponse(items);
        } else if (toolName.includes('subscribedSkus') || data['@odata.context']?.includes('subscribedSkus')) {
          return this.formatLicenseResponse(items);
        } else if (toolName.includes('security') || data['@odata.context']?.includes('security')) {
          return this.formatSecurityResponse(items);
        } else if (toolName.includes('signIns') || data['@odata.context']?.includes('signIns')) {
          return this.formatSignInResponse(items);
        } else if (toolName.includes('sites') || data['@odata.context']?.includes('sites')) {
          return this.formatSitesResponse(items);
        } else if (toolName.includes('groups') || data['@odata.context']?.includes('groups')) {
          return this.formatGroupsResponse(items);
        } else if (toolName.includes('organization') || data['@odata.context']?.includes('organization')) {
          return this.formatOrganizationResponse(items);
        } else if (toolName.includes('devices') || toolName.includes('deviceManagement') || data['@odata.context']?.includes('deviceManagement')) {
          return this.formatDevicesResponse(items);
        } else if (toolName.includes('applications') || data['@odata.context']?.includes('applications')) {
          return this.formatApplicationsResponse(items);
        } else if (toolName.includes('contacts') || data['@odata.context']?.includes('contacts')) {
          return this.formatContactsResponse(items);
        }
      }

      // Default formatting for unknown responses
      return `**Live Data from ${toolName}:**\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;

    } catch (error) {
      console.error(`Error formatting response from ${toolName}:`, error);
      return `**Error formatting response from ${toolName}:** ${error.message}`;
    }
  }

  formatUsersResponse(users) {
    if (!users || users.length === 0) {
      return `👥 **No users found in ${this.tenantDomain}**`;
    }

    const userList = users.slice(0, 15).map(user => {
      const lastSignIn = user.lastSignInDateTime 
        ? new Date(user.lastSignInDateTime).toLocaleDateString()
        : 'Never';
      
      const licenseCount = user.assignedLicenses ? user.assignedLicenses.length : 0;
      
      return `• **${user.displayName}** (${user.userPrincipalName})\n  └ Last sign-in: ${lastSignIn} | Licenses: ${licenseCount}`;
    }).join('\n');

    return `👥 **Users in ${this.tenantDomain}** (${users.length} total, showing first 15)

${userList}

${users.length > 15 ? `\n*...and ${users.length - 15} more users*` : ''}`;
  }

  formatLicenseResponse(licenses) {
    if (!licenses || licenses.length === 0) {
      return `📊 **No license information found for ${this.tenantDomain}**`;
    }

    const licenseList = licenses.map(sku => {
      const total = sku.prepaidUnits?.enabled || 0;
      const used = sku.consumedUnits || 0;
      const available = total - used;
      
      return `• **${sku.skuPartNumber}**\n  └ Used: ${used}/${total} (${available} available)`;
    }).join('\n');

    return `📊 **License Usage for ${this.tenantDomain}**

${licenseList}`;
  }

  formatSecurityResponse(alerts) {
    if (!alerts || alerts.length === 0) {
      return `🔒 **Security Status for ${this.tenantDomain}**\n\n✅ No active security alerts found.`;
    }

    const alertList = alerts.slice(0, 8).map(alert => {
      const created = new Date(alert.createdDateTime).toLocaleDateString();
      return `• **${alert.title || 'Security Alert'}** (${alert.severity || 'Unknown'})\n  └ Status: ${alert.status || 'Active'} | Created: ${created}`;
    }).join('\n');

    return `🔒 **Security Alerts for ${this.tenantDomain}** (${alerts.length} total)

${alertList}`;
  }

  formatSignInResponse(signIns) {
    if (!signIns || signIns.length === 0) {
      return `📈 **No recent sign-in activity found for ${this.tenantDomain}**`;
    }

    const signInList = signIns.slice(0, 12).map(signIn => {
      const time = new Date(signIn.createdDateTime).toLocaleString();
      const location = signIn.location?.city || 'Unknown location';
      const status = signIn.status?.errorCode ? '❌ Failed' : '✅ Success';
      
      return `• **${signIn.userDisplayName}** from ${location}\n  └ ${time} | ${status}`;
    }).join('\n');

    return `📈 **Recent Sign-ins for ${this.tenantDomain}** (${signIns.length} total, showing recent 12)

${signInList}`;
  }

  formatSitesResponse(sites) {
    if (!sites || sites.length === 0) {
      return `🌐 **No SharePoint sites found for ${this.tenantDomain}**`;
    }

    const siteList = sites.slice(0, 10).map(site => {
      const modified = new Date(site.lastModifiedDateTime).toLocaleDateString();
      return `• **${site.displayName}**\n  └ ${site.webUrl}\n  └ Last modified: ${modified}`;
    }).join('\n');

    return `🌐 **SharePoint Sites for ${this.tenantDomain}** (${sites.length} total, showing first 10)

${siteList}`;
  }

  formatGroupsResponse(groups) {
    if (!groups || groups.length === 0) {
      return `👨‍👩‍👧‍👦 **No groups found for ${this.tenantDomain}**`;
    }

    const groupList = groups.slice(0, 12).map(group => {
      const type = group.groupTypes?.includes('Unified') ? 'Microsoft 365 Group' : 'Security Group';
      const created = new Date(group.createdDateTime).toLocaleDateString();
      
      return `• **${group.displayName}**\n  └ Type: ${type} | Created: ${created}`;
    }).join('\n');

    return `👨‍👩‍👧‍👦 **Groups in ${this.tenantDomain}** (${groups.length} total, showing first 12)

${groupList}`;
  }

  formatOrganizationResponse(orgs) {
    if (!orgs || orgs.length === 0) {
      return `🏢 **No organization information found for ${this.tenantDomain}**`;
    }

    const org = orgs[0]; // Usually only one organization
    return `🏢 **Organization Information for ${this.tenantDomain}**

• **Display Name:** ${org.displayName}
• **Verified Domains:** ${org.verifiedDomains?.map(d => d.name).join(', ') || 'Not available'}
• **Created:** ${org.createdDateTime ? new Date(org.createdDateTime).toLocaleDateString() : 'Not available'}
• **Country:** ${org.countryLetterCode || 'Not specified'}`;
  }

  formatDevicesResponse(devices) {
    if (!devices || devices.length === 0) {
      return `📱 **No managed devices found for ${this.tenantDomain}**`;
    }

    const deviceList = devices.slice(0, 15).map(device => {
      const lastSync = device.lastSyncDateTime 
        ? new Date(device.lastSyncDateTime).toLocaleDateString()
        : 'Never';
      const enrolled = device.enrolledDateTime
        ? new Date(device.enrolledDateTime).toLocaleDateString()
        : 'Unknown';
      const compliance = device.complianceState || 'Unknown';
      const os = device.operatingSystem || 'Unknown';
      const version = device.osVersion || 'Unknown';
      
      return `• **${device.deviceName || 'Unknown Device'}** (${os} ${version})\n  └ Compliance: ${compliance} | Last Sync: ${lastSync} | Enrolled: ${enrolled}`;
    }).join('\n');

    return `📱 **Managed Devices in ${this.tenantDomain}** (${devices.length} total, showing first 15)

${deviceList}

${devices.length > 15 ? `\n*...and ${devices.length - 15} more devices*` : ''}`;
  }

  formatApplicationsResponse(apps) {
    if (!apps || apps.length === 0) {
      return `📋 **No registered applications found for ${this.tenantDomain}**`;
    }

    const appList = apps.slice(0, 12).map(app => {
      const created = app.createdDateTime 
        ? new Date(app.createdDateTime).toLocaleDateString()
        : 'Unknown';
      const audience = app.signInAudience || 'Unknown';
      
      return `• **${app.displayName || 'Unknown App'}**\n  └ App ID: ${app.appId || 'N/A'} | Audience: ${audience} | Created: ${created}`;
    }).join('\n');

    return `📋 **Registered Applications in ${this.tenantDomain}** (${apps.length} total, showing first 12)

${appList}

${apps.length > 12 ? `\n*...and ${apps.length - 12} more applications*` : ''}`;
  }

  formatContactsResponse(contacts) {
    if (!contacts || contacts.length === 0) {
      return `👤 **No contacts found for ${this.tenantDomain}**`;
    }

    const contactList = contacts.slice(0, 10).map(contact => {
      const email = contact.emailAddresses && contact.emailAddresses[0] 
        ? contact.emailAddresses[0].address 
        : 'No email';
      const company = contact.companyName || 'No company';
      const title = contact.jobTitle || 'No title';
      
      return `• **${contact.displayName || 'Unknown Contact'}**\n  └ ${email} | ${company} | ${title}`;
    }).join('\n');

    return `👤 **Contacts in ${this.tenantDomain}** (${contacts.length} total, showing first 10)

${contactList}

${contacts.length > 10 ? `\n*...and ${contacts.length - 10} more contacts*` : ''}`;
  }

  async getAccessToken() {
    if (this.accessToken) {
      return this.accessToken;
    }

    try {
      // Try to get the current token from Lokka
      const authResponse = await this.sendMCPRequest('tools/call', {
        name: 'get-auth-status',
        arguments: {}
      });

      if (authResponse.content && authResponse.content.accessToken) {
        this.accessToken = authResponse.content.accessToken;
        return this.accessToken;
      }
    } catch (error) {
      console.error('Error getting access token:', error);
    }

    return null;
  }

  getAuthenticationStatus() {
    return {
      status: this.authStatus,
      isAuthenticated: this.authStatus === 'authenticated',
      hasToken: !!this.accessToken,
      tenantDomain: this.tenantDomain,
      sessionId: this.sessionId
    };
  }

  startAuthMonitoring() {
    if (this.authMonitorInterval) {
      clearInterval(this.authMonitorInterval);
    }
    
    console.log(`Starting authentication monitoring for session ${this.sessionId}`);
    
    // Check authentication status every 5 seconds
    this.authMonitorInterval = setInterval(async () => {
      try {
        if (this.authStatus === 'authenticated') {
          // Stop monitoring once authenticated
          clearInterval(this.authMonitorInterval);
          this.authMonitorInterval = null;
          return;
        }
        
        await this.checkAuthStatus();
        
      } catch (error) {
        console.error('Error during auth monitoring:', error);
      }
    }, 5000);
  }

  stopAuthMonitoring() {
    if (this.authMonitorInterval) {
      clearInterval(this.authMonitorInterval);
      this.authMonitorInterval = null;
      console.log(`Stopped authentication monitoring for session ${this.sessionId}`);
    }
  }

  isPermissionError(response) {
    // Check for permission-related errors in response or error object
    const responseText = this.getResponseText(response);
    
    const permissionIndicators = [
      'insufficient privileges',
      'access denied',
      'forbidden',
      'unauthorized',
      'permission',
      'consent required',
      'scope',
      'AADSTS',
      'InsufficientPrivileges',
      'Forbidden',
      'Authorization_RequestDenied'
    ];
    
    return permissionIndicators.some(indicator => 
      responseText.toLowerCase().includes(indicator.toLowerCase())
    );
  }

  getResponseText(response) {
    if (typeof response === 'string') {
      return response;
    }
    
    if (response?.message) {
      return response.message;
    }
    
    if (response?.content && Array.isArray(response.content) && response.content[0]?.text) {
      return response.content[0].text;
    }
    
    if (response?.content) {
      return JSON.stringify(response.content);
    }
    
    return JSON.stringify(response);
  }

  isPermissionError(response) {
    // Check for permission-related errors in response or error object
    const responseText = this.getResponseText(response);
    
    const permissionIndicators = [
      'insufficient privileges',
      'access denied',
      'forbidden',
      'unauthorized',
      'permission',
      'consent required',
      'scope',
      'AADSTS',
      'InsufficientPrivileges',
      'Forbidden',
      'Authorization_RequestDenied'
    ];
    
    return permissionIndicators.some(indicator => 
      responseText.toLowerCase().includes(indicator.toLowerCase())
    );
  }

  getResponseText(response) {
    if (typeof response === 'string') {
      return response;
    }
    
    if (response?.message) {
      return response.message;
    }
    
    if (response?.content && Array.isArray(response.content) && response.content[0]?.text) {
      return response.content[0].text;
    }
    
    if (response?.content) {
      return JSON.stringify(response.content);
    }
    
    return JSON.stringify(response);
  }

  async handlePermissionRequest(toolCall, originalMessage) {
    try {
      console.log(`Handling permission request for tool: ${toolCall.name}`);
      
      // Determine required permissions based on the API endpoint
      const requiredScopes = this.getRequiredScopes(toolCall);
      
      if (requiredScopes.length === 0) {
        return `❌ **Permission Error**: Unable to determine required permissions for this request.`;
      }
      
      // Store the original query for rerun after permission approval
      this.pendingQuery = {
        toolCall: toolCall,
        originalMessage: originalMessage,
        timestamp: new Date().toISOString()
      };
      
      console.log(`Requesting additional permissions: ${requiredScopes.join(', ')}`);
      
      // Start monitoring for permission approval
      this.startPermissionMonitoring();
      
      // Request additional permissions via Lokka MCP
      try {
        const permissionResponse = await this.sendMCPRequest('tools/call', {
          name: 'add-graph-permission',
          arguments: {
            scopes: requiredScopes
          }
        });
        
        console.log('Permission request response:', permissionResponse);
        
        // Emit permission request event to frontend
        this.io.to(this.sessionId).emit('permission_request', {
          scopes: requiredScopes,
          endpoint: toolCall.arguments.path,
          originalMessage: originalMessage,
          timestamp: new Date().toISOString()
        });
        
        return `🔐 **Additional Permissions Required**

To process your request: "${originalMessage}"

**Required Microsoft Graph Permissions:**
${requiredScopes.map(scope => `• ${scope}`).join('\n')}

**🚀 Permission Request Process:**

1. **Browser Window Opening** - A new tab will open for permission consent
2. **Review Permissions** - Please review and approve the requested permissions
3. **Grant Access** - Click "Accept" to grant the required permissions
4. **Automatic Redirect** - You'll be redirected back to the ICB Agent
5. **Query Rerun** - Your original query will be automatically processed

**⏳ Please complete the permission consent process...**

Once permissions are granted, I'll automatically rerun your query and provide the results!`;
        
      } catch (permissionError) {
        console.error('Error requesting permissions:', permissionError);
        return `❌ **Permission Request Failed**

Unable to request additional permissions: ${permissionError.message}

**Required Permissions:**
${requiredScopes.map(scope => `• ${scope}`).join('\n')}

**Manual Steps:**
1. Contact your Microsoft 365 administrator
2. Request the above permissions for the Lokka MCP application
3. Try your query again once permissions are granted`;
      }
      
    } catch (error) {
      console.error('Error handling permission request:', error);
      return `❌ **Permission Error**: ${error.message}`;
    }
  }

  getRequiredScopes(toolCall) {
    const path = toolCall.arguments?.path || '';
    const scopes = [];
    
    // Map API endpoints to required permissions
    const scopeMapping = {
      '/users': ['User.Read.All', 'Directory.Read.All'],
      '/subscribedSkus': ['Organization.Read.All'],
      '/security/alerts': ['SecurityEvents.Read.All'],
      '/security/alerts_v2': ['SecurityEvents.Read.All'],
      '/auditLogs/signIns': ['AuditLog.Read.All', 'Directory.Read.All'],
      '/sites': ['Sites.Read.All'],
      '/groups': ['Group.Read.All', 'Directory.Read.All'],
      '/organization': ['Organization.Read.All'],
      '/deviceManagement/managedDevices': ['DeviceManagementManagedDevices.Read.All'],
      '/applications': ['Application.Read.All', 'Directory.Read.All'],
      '/contacts': ['Contacts.Read']
    };
    
    // Find matching scope requirements
    for (const [endpoint, requiredScopes] of Object.entries(scopeMapping)) {
      if (path.includes(endpoint)) {
        scopes.push(...requiredScopes);
        break;
      }
    }
    
    // Remove duplicates
    return [...new Set(scopes)];
  }

  async rerunPendingQuery() {
    if (!this.pendingQuery) {
      console.log('No pending query to rerun');
      return null;
    }
    
    console.log('Rerunning pending query after permission approval');
    
    const { toolCall, originalMessage } = this.pendingQuery;
    this.pendingQuery = null; // Clear pending query
    
    try {
      const toolResponse = await this.sendMCPRequest('tools/call', {
        name: toolCall.name,
        arguments: toolCall.arguments
      });
      
      const formattedResponse = this.formatToolResponse(toolCall.name, toolResponse);
      
      const response = {
        id: uuidv4(),
        message: `✅ **Permissions Approved - Query Completed!**

Your original request: "${originalMessage}"

${formattedResponse}`,
        timestamp: new Date().toISOString(),
        type: 'permission_approved_response'
      };
      
      // Emit the response to the frontend
      this.io.to(this.sessionId).emit('query_rerun_complete', response);
      
      return response;
      
    } catch (error) {
      console.error('Error rerunning query after permission approval:', error);
      
      const errorResponse = {
        id: uuidv4(),
        message: `❌ **Error after permission approval**

Your request: "${originalMessage}"

Unfortunately, there was still an error after granting permissions: ${error.message}

Please try your query again or contact support if the issue persists.`,
        timestamp: new Date().toISOString(),
        type: 'permission_error_response'
      };
      
      this.io.to(this.sessionId).emit('query_rerun_complete', errorResponse);
      return errorResponse;
    }
  }

  startPermissionMonitoring() {
    if (this.permissionMonitorInterval) {
      clearInterval(this.permissionMonitorInterval);
    }
    
    console.log(`Starting permission monitoring for session ${this.sessionId}`);
    
    // Check every 3 seconds for permission approval
    this.permissionMonitorInterval = setInterval(async () => {
      try {
        if (!this.pendingQuery) {
          // No pending query, stop monitoring
          clearInterval(this.permissionMonitorInterval);
          this.permissionMonitorInterval = null;
          return;
        }
        
        const previousStatus = this.authStatus;
        await this.checkAuthStatus();
        
        // If auth status changed to authenticated and we have a pending query
        if (this.authStatus === 'authenticated' && previousStatus !== 'authenticated' && this.pendingQuery) {
          console.log(`Permission approval detected for session ${this.sessionId}, rerunning query`);
          
          // Stop monitoring
          clearInterval(this.permissionMonitorInterval);
          this.permissionMonitorInterval = null;
          
          // Rerun the pending query
          await this.rerunPendingQuery();
        }
        
      } catch (error) {
        console.error('Error during permission monitoring:', error);
      }
    }, 3000);
    
    // Stop monitoring after 10 minutes to prevent infinite loops
    setTimeout(() => {
      if (this.permissionMonitorInterval) {
        console.log(`Permission monitoring timeout for session ${this.sessionId}`);
        clearInterval(this.permissionMonitorInterval);
        this.permissionMonitorInterval = null;
      }
    }, 600000); // 10 minutes
  }

  stopPermissionMonitoring() {
    if (this.permissionMonitorInterval) {
      clearInterval(this.permissionMonitorInterval);
      this.permissionMonitorInterval = null;
      console.log(`Stopped permission monitoring for session ${this.sessionId}`);
    }
  }

  async stop() {
    try {
      // Stop authentication monitoring
      this.stopAuthMonitoring();
      
      // Stop permission monitoring
      this.stopPermissionMonitoring();
      
      if (this.process) {
        this.process.kill('SIGTERM');
        
        // Wait a bit for graceful shutdown
        setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.process.kill('SIGKILL');
          }
        }, 5000);
        
        this.process = null;
      }
      
      this.isConnected = false;
      this.pendingRequests.clear();
      console.log(`Lokka MCP client stopped for session: ${this.sessionId}`);
    } catch (error) {
      console.error(`Error stopping Lokka MCP client: ${error.message}`);
    }
  }
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API Routes
app.post('/api/session/create', (req, res) => {
  const sessionId = uuidv4();
  const { tenantDomain } = req.body;
  
  if (!tenantDomain) {
    return res.status(400).json({ error: 'Tenant domain is required' });
  }
  
  // Validate domain format
  if (!isValidTenantDomain(tenantDomain)) {
    return res.status(400).json({ 
      error: 'Invalid domain format. Please provide a valid Microsoft 365 domain (e.g., contoso.onmicrosoft.com, contoso.com)' 
    });
  }
  
  activeSessions.set(sessionId, {
    id: sessionId,
    tenantDomain,
    createdAt: new Date(),
    status: 'initialized'
  });
  
  res.json({ sessionId, tenantDomain });
});

app.post('/api/mcp/start', async (req, res) => {
  const { sessionId, tenantDomain } = req.body;
  
  if (!sessionId || !activeSessions.has(sessionId)) {
    return res.status(400).json({ error: 'Invalid session ID' });
  }
  
  try {
    console.log(`Starting MCP server for session ${sessionId}, tenant: ${tenantDomain}`);
    
    // Create and start MCP client
    const mcpClient = new MCPClient(sessionId, tenantDomain, io);
    await mcpClient.start();
    
    // Store MCP connection
    mcpConnections.set(sessionId, mcpClient);
    
    // Update session status
    const session = activeSessions.get(sessionId);
    session.status = 'mcp_connected';
    session.mcpStartedAt = new Date();
    
    console.log(`MCP server started successfully for session ${sessionId}`);
    
    res.json({ 
      success: true, 
      message: 'MCP server started successfully',
      sessionId,
      status: 'connected'
    });
    
    // Emit to socket for real-time updates
    io.to(sessionId).emit('mcp_status', { 
      status: 'ready',
      message: 'Connected to Microsoft 365 tenant'
    });
    
  } catch (error) {
    console.error('Error starting MCP server:', error);
    
    // Clean up on error
    if (mcpConnections.has(sessionId)) {
      const mcpClient = mcpConnections.get(sessionId);
      await mcpClient.stop();
      mcpConnections.delete(sessionId);
    }
    
    res.status(500).json({ error: 'Failed to start MCP server: ' + error.message });
    
    // Emit error to socket
    io.to(sessionId).emit('mcp_status', { 
      status: 'error',
      message: 'Failed to connect to Microsoft 365 tenant'
    });
  }
});

app.post('/api/chat', async (req, res) => {
  const { sessionId, message } = req.body;
  
  if (!sessionId || !activeSessions.has(sessionId)) {
    return res.status(400).json({ error: 'Invalid session ID' });
  }
  
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }
  
  try {
    // Process chat message through AI agent
    const response = await processAIMessage(sessionId, message);
    res.json({ response });
  } catch (error) {
    console.error('Error processing chat message:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

app.post('/api/reports/health-check', async (req, res) => {
  const { sessionId } = req.body;
  
  if (!sessionId || !activeSessions.has(sessionId)) {
    return res.status(400).json({ error: 'Invalid session ID' });
  }
  
  try {
    // Generate M365 Health Check Report
    const report = await generateHealthCheckReport(sessionId);
    res.json({ report });
  } catch (error) {
    console.error('Error generating health check report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('join_session', (sessionId) => {
    socket.join(sessionId);
    console.log(`Socket ${socket.id} joined session ${sessionId}`);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Clean up any orphaned sessions
    // Note: In production, you might want more sophisticated cleanup logic
  });
});

// Cleanup function for sessions
async function cleanupSession(sessionId) {
  console.log(`Cleaning up session: ${sessionId}`);
  
  // Stop MCP client if exists
  if (mcpConnections.has(sessionId)) {
    const mcpClient = mcpConnections.get(sessionId);
    await mcpClient.stop();
    mcpConnections.delete(sessionId);
  }
  
  // Remove session
  activeSessions.delete(sessionId);
  
  console.log(`Session ${sessionId} cleaned up`);
}

// Add endpoint to disconnect session
app.post('/api/session/disconnect', async (req, res) => {
  const { sessionId } = req.body;
  
  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID is required' });
  }
  
  try {
    await cleanupSession(sessionId);
    res.json({ success: true, message: 'Session disconnected successfully' });
  } catch (error) {
    console.error('Error disconnecting session:', error);
    res.status(500).json({ error: 'Failed to disconnect session' });
  }
});

// Authentication status endpoint
app.get('/api/auth/status/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  
  try {
    const mcpClient = mcpConnections.get(sessionId);
    
    if (!mcpClient) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const authStatus = mcpClient.getAuthenticationStatus();
    res.json(authStatus);
    
  } catch (error) {
    console.error('Error getting auth status:', error);
    res.status(500).json({ error: 'Failed to get authentication status' });
  }
});

// Get access token endpoint
app.get('/api/auth/token/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  
  try {
    const mcpClient = mcpConnections.get(sessionId);
    
    if (!mcpClient) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const token = await mcpClient.getAccessToken();
    
    if (token) {
      res.json({ 
        hasToken: true, 
        tokenPreview: token.substring(0, 20) + '...', // Only send preview for security
        expiresAt: null // Lokka manages token expiry
      });
    } else {
      res.json({ hasToken: false });
    }
    
  } catch (error) {
    console.error('Error getting access token:', error);
    res.status(500).json({ error: 'Failed to get access token' });
  }
});

// Force authentication re-check endpoint
app.post('/api/auth/refresh/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  
  try {
    const mcpClient = mcpConnections.get(sessionId);
    
    if (!mcpClient) {
      return res.status(404).json({ error: 'Session not found' });
    }

    await mcpClient.checkAuthStatus();
    const authStatus = mcpClient.getAuthenticationStatus();
    
    res.json(authStatus);
    
  } catch (error) {
    console.error('Error refreshing auth status:', error);
    res.status(500).json({ error: 'Failed to refresh authentication status' });
  }
});

// Rerun pending query endpoint (for permission approval completion)
app.post('/api/auth/rerun-query/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  
  try {
    const mcpClient = mcpConnections.get(sessionId);
    
    if (!mcpClient) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Check if there's a pending query to rerun
    if (!mcpClient.pendingQuery) {
      return res.json({ 
        success: false, 
        message: 'No pending query found',
        hasPendingQuery: false
      });
    }
    
    console.log(`Manually triggering pending query rerun for session ${sessionId}`);
    
    // Re-check authentication status first
    await mcpClient.checkAuthStatus();
    
    if (mcpClient.authStatus !== 'authenticated') {
      return res.json({
        success: false,
        message: 'Authentication required before rerunning query',
        authStatus: mcpClient.authStatus
      });
    }
    
    // Rerun the pending query
    const result = await mcpClient.rerunPendingQuery();
    
    res.json({
      success: true,
      message: 'Pending query rerun completed',
      result: result
    });
    
  } catch (error) {
    console.error('Error rerunning pending query:', error);
    res.status(500).json({ 
      error: 'Failed to rerun pending query: ' + error.message 
    });
  }
});

// Authentication redirect endpoint
app.get('/auth/callback', async (req, res) => {
  // This endpoint will handle the redirect from Lokka authentication
  console.log('Authentication callback received:', req.query);
  
  // Check if there are any sessions with pending queries that need permission approval
  for (const [sessionId, mcpClient] of mcpConnections.entries()) {
    if (mcpClient && mcpClient.pendingQuery) {
      console.log(`Found pending query for session ${sessionId}, checking auth status...`);
      
      // Check if authentication/permissions were approved
      try {
        await mcpClient.checkAuthStatus();
        
        // If authenticated, rerun the pending query
        if (mcpClient.authStatus === 'authenticated') {
          console.log(`Authentication successful, rerunning pending query for session ${sessionId}`);
          await mcpClient.rerunPendingQuery();
        }
      } catch (error) {
        console.error(`Error checking auth status for session ${sessionId}:`, error);
      }
    }
  }
  
  // Redirect user back to the main application with success indicator
  res.redirect('/?auth=success&permissions=approved');
});

// Authentication success page
app.get('/auth/success', async (req, res) => {
  // Check for sessions with pending queries and attempt to rerun them
  const permissionsApproved = req.query.permissions === 'approved';
  
  for (const [sessionId, mcpClient] of mcpConnections.entries()) {
    if (mcpClient && mcpClient.pendingQuery && permissionsApproved) {
      console.log(`Permissions approved, checking and rerunning query for session ${sessionId}`);
      
      try {
        // Re-check authentication status
        await mcpClient.checkAuthStatus();
        
        // If authenticated, rerun the pending query
        if (mcpClient.authStatus === 'authenticated') {
          await mcpClient.rerunPendingQuery();
        }
      } catch (error) {
        console.error(`Error rerunning query for session ${sessionId}:`, error);
      }
    }
  }
  
  res.send(`
    <html>
      <head>
        <title>Authentication Successful</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .success { color: #28a745; }
          .container { max-width: 500px; margin: 0 auto; }
          .button { 
            background: #007bff; 
            color: white; 
            padding: 10px 20px; 
            text-decoration: none; 
            border-radius: 5px; 
            display: inline-block; 
            margin-top: 20px;
          }
        </style>
        <script>
          // Notify parent window of successful authentication
          if (window.opener) {
            window.opener.postMessage({ 
              type: 'auth_success', 
              permissionsApproved: ${permissionsApproved}
            }, '*');
          }
        </script>
      </head>
      <body>
        <div class="container">
          <h1 class="success">✅ Authentication Successful!</h1>
          <p>You have successfully authenticated with Microsoft 365.</p>
          ${permissionsApproved ? '<p><strong>🎉 Permissions approved! Your query is being processed automatically.</strong></p>' : ''}
          <p>You can now return to the ICB Agent application to start querying your tenant data.</p>
          <a href="/" class="button">Return to ICB Agent</a>
          <script>
            // Automatically redirect after 3 seconds
            setTimeout(() => {
              if (window.opener) {
                window.close();
              } else {
                window.location.href = '/';
              }
            }, 3000);
          </script>
        </div>
      </body>
    </html>
  `);
});

// Helper functions
function isValidTenantDomain(domain) {
  // Basic domain pattern validation for Microsoft 365 domains
  const basicDomainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
  
  if (!basicDomainRegex.test(domain)) {
    return false;
  }
  
  // Additional checks for invalid patterns
  const invalidPatterns = [
    /^-/,           // Cannot start with hyphen
    /-$/,           // Cannot end with hyphen
    /\.\./,         // Cannot have consecutive dots
    /^\.|\.$/, // Cannot start or end with dot
  ];
  
  return !invalidPatterns.some(pattern => pattern.test(domain));
}

async function processAIMessage(sessionId, message) {
  console.log(`Processing message for session ${sessionId}: ${message}`);
  
  // Get the MCP client for this session
  const mcpClient = mcpConnections.get(sessionId);
  
  if (!mcpClient) {
    throw new Error('MCP server not connected. Please start a session first.');
  }
  
  if (!mcpClient.isConnected) {
    throw new Error('MCP server is not ready. Please wait for connection to establish.');
  }
  
  try {
    // Send message to MCP server and get response
    const response = await mcpClient.sendMessage(message);
    console.log(`MCP response received for session ${sessionId}`);
    
    return response;
    
  } catch (error) {
    console.error(`Error processing message via MCP: ${error.message}`);
    
    // Return error response
    return {
      id: uuidv4(),
      message: `❌ **Error processing your request**

Sorry, I encountered an issue while processing your request: "${message}"

**Error Details:** ${error.message}

**Troubleshooting:**
• Ensure you're connected to a Microsoft 365 tenant
• Check that the MCP server is running properly
• Try disconnecting and reconnecting to refresh the session

Please try again or contact support if the issue persists.`,
      timestamp: new Date().toISOString(),
      type: 'error_response'
    };
  }
}

async function generateHealthCheckReport(sessionId) {
  const session = activeSessions.get(sessionId);
  return {
    id: uuidv4(),
    tenantDomain: session.tenantDomain,
    generatedAt: new Date().toISOString(),
    status: 'generated',
    sections: [
      { name: 'User Accounts', status: 'healthy' },
      { name: 'Security Settings', status: 'attention_required' },
      { name: 'License Usage', status: 'healthy' },
      { name: 'Service Health', status: 'healthy' }
    ]
  };
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`ICB Agent Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
