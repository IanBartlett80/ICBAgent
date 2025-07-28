# ICB Agent - Microsoft 365 Management Assistant

A production-ready AI-powered web application for ICB Solutions to manage Microsoft 365 environments through natural language interactions and automated health check reporting.

## Features

### 🤖 AI-Powered Management
- Natural language interface for Microsoft 365 administration
- Intelligent responses powered by advanced AI
- Real-time chat interface for seamless interaction

### 🔐 Secure Authentication
- Integration with Lokka-Microsoft MCP server
- Microsoft Graph API authentication
- Enterprise-grade security standards

### 📊 Health Check Reports
- Automated monthly M365 tenant health reports
- Comprehensive analysis of tenant status
- PDF generation and email delivery to customers

### 🎨 Professional UI/UX
- Clean, modern interface designed for IT professionals
- Responsive design for all devices
- ICB Solutions branded theme

## Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Access to Microsoft 365 tenant for testing

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/IanBartlett80/ICBAgent.git
   cd ICBAgent
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Install MCP Server**
   ```bash
   npm install -g mcp-server-lokka-microsoft
   ```

5. **Start the application**
   ```bash
   npm start
   ```

6. **Access the application**
   Open your browser to `http://localhost:3000`

## Usage

### Getting Started
1. Enter your Microsoft 365 tenant domain (e.g., `contoso.onmicrosoft.com`)
2. Click "Get Started" to initiate authentication
3. Complete the Microsoft authentication flow
4. Start managing your tenant through natural language commands

### Example Commands
- "Show me all users in the tenant"
- "What are the current security policies?"
- "Generate a license usage report"
- "Check for any security alerts"
- "List all SharePoint sites"
- "Show recent sign-in activity"

### Health Check Reports
- Click "Generate Health Report" to create a comprehensive tenant analysis
- Reports include user accounts, security settings, license usage, and service health
- Download as PDF or email directly to customers

## Architecture

### Backend Components
- **Express.js Server**: Main application server
- **Socket.IO**: Real-time communication
- **MCP Integration**: Lokka-Microsoft MCP server for M365 connectivity
- **AI Processing**: Natural language understanding and response generation

### Frontend Components
- **Vanilla JavaScript**: Lightweight, fast client-side logic
- **WebSocket Integration**: Real-time updates and notifications
- **Responsive CSS**: Professional, accessible design
- **Progressive Enhancement**: Works across all modern browsers

### Security Features
- Helmet.js for security headers
- CORS protection
- Rate limiting
- Secure session management
- Environment variable protection

## Configuration

### Environment Variables
```env
NODE_ENV=development|production
PORT=3000
SESSION_SECRET=your-secret-key
MCP_SERVER_PATH=mcp-server-lokka-microsoft
MCP_TIMEOUT=30000
LOG_LEVEL=info
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
CORS_ORIGIN=http://localhost:3000
```

### MCP Server Setup
The application uses the Lokka-Microsoft MCP server for Microsoft Graph API integration:

1. Install the MCP server globally
2. Configure authentication credentials
3. The application will automatically start the MCP server when needed

## Development

### Running in Development Mode
```bash
npm run dev
```

### File Structure
```
ICBAgent/
├── server.js              # Main server file
├── package.json           # Dependencies and scripts
├── public/                # Static files
│   ├── index.html         # Main HTML file
│   ├── css/
│   │   └── styles.css     # Application styles
│   └── js/
│       └── app.js         # Client-side logic
├── .env.example           # Environment template
└── README.md             # This file
```

### API Endpoints
- `GET /` - Main application
- `POST /api/session/create` - Create new session
- `POST /api/mcp/start` - Start MCP server
- `POST /api/chat` - Send chat message
- `POST /api/reports/health-check` - Generate health report
- `GET /health` - Health check endpoint

## Production Deployment

### Prerequisites
- Node.js 18+ production environment
- SSL certificate for HTTPS
- Environment variables configured
- MCP server installed and configured

### Deployment Steps
1. Set `NODE_ENV=production`
2. Configure production environment variables
3. Set up SSL/TLS certificates
4. Configure reverse proxy (nginx recommended)
5. Set up process manager (PM2 recommended)
6. Configure logging and monitoring

### Security Considerations
- Use HTTPS in production
- Set secure session secrets
- Configure proper CORS origins
- Enable rate limiting
- Regular security updates
- Monitor for vulnerabilities

## Integration with ICB Solutions

### Branding
The application uses ICB Solutions' professional blue color scheme and modern design principles suitable for IT professionals.

### Customer Management
- Multi-tenant support for managing different customer environments
- Session isolation for security
- Audit logging for compliance

### Reporting
- Branded reports with ICB Solutions identity
- Automated delivery options
- Customizable report templates

## Support

### Documentation
- API documentation available in `/docs`
- MCP server documentation: [Lokka-Microsoft MCP](https://github.com/lokka-microsoft/mcp-server)

### Troubleshooting
- Check application logs for errors
- Verify MCP server connectivity
- Ensure Microsoft Graph permissions are configured
- Check network connectivity and firewall settings

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

Copyright © 2024 ICB Solutions. All rights reserved.

This software is proprietary and confidential. Unauthorized copying, distribution, or use is strictly prohibited.