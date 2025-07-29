# GitHub Copilot Instructions for ICB Agent

## Project Overview

ICB Agent is a professional Microsoft 365 tenant management and automation platform designed for IT professionals. It provides AI-powered insights, natural language commands, and enterprise-grade automation for Microsoft 365 environments.

## Git Workflow & Feature Development

### Feature Branch Strategy

**IMPORTANT**: For every new feature development in the ICB Agent webapp, follow this mandatory workflow:

1. **Create Feature Branch**: Always create a new branch before starting any new feature
   ```bash
   git checkout -b feature/descriptive-feature-name
   ```

2. **Branch Naming Convention**:
   - `feature/feature-name` - For new features (e.g., `feature/zero-trust-integration`)
   - `fix/bug-description` - For bug fixes (e.g., `fix/viewport-responsiveness`)
   - `enhance/improvement-name` - For enhancements (e.g., `enhance/connection-status-ui`)
   - `refactor/component-name` - For code refactoring (e.g., `refactor/chat-interface`)

3. **Progressive Commits**: As we progress through feature development, create frequent commits with descriptive messages:
   ```bash
   git add .
   git commit -m "feat: add initial component structure for [feature-name]
   
   - Created base HTML structure
   - Added CSS styling framework
   - Implemented basic JavaScript functionality"
   ```

4. **Commit Message Format**:
   ```
   type: brief description of changes
   
   - Detailed point 1 of what was implemented
   - Detailed point 2 of what was modified
   - Detailed point 3 of what was added/removed
   ```

5. **Commit Types**:
   - `feat:` - New features
   - `fix:` - Bug fixes
   - `enhance:` - Improvements to existing features
   - `style:` - CSS/styling changes
   - `refactor:` - Code restructuring without functionality changes
   - `docs:` - Documentation updates
   - `test:` - Testing additions or modifications

6. **Feature Completion Workflow**:
   ```bash
   # Final commit for the feature
   git commit -m "feat: complete [feature-name] implementation
   
   - Finalized all UI components
   - Added responsive design optimizations
   - Implemented error handling
   - Updated documentation
   - Tested across all viewport sizes"
   
   # Push feature branch
   git push origin feature/feature-name
   
   # Create pull request or merge to main
   git checkout main
   git merge feature/feature-name
   git push origin main
   
   # Clean up feature branch
   git branch -d feature/feature-name
   git push origin -d feature/feature-name
   ```

7. **Commit Frequency Guidelines**:
   - Commit after completing each logical unit of work
   - Commit when a component is functional (even if not complete)
   - Commit before major refactoring or structural changes
   - Commit at natural breakpoints in development
   - Always commit before switching contexts or ending work sessions

### Example Feature Development Flow

```bash
# Starting a new feature: Dynamic Status Cards
git checkout -b feature/dynamic-status-cards

# Initial commit
git commit -m "feat: initialize dynamic status cards feature

- Created HTML structure for connection status cards
- Added basic CSS framework for card styling"

# Progress commit
git commit -m "feat: implement card visibility logic

- Added JavaScript functions for showing/hiding cards
- Enhanced updateConnectionStatus function
- Added event listeners for new card buttons"

# Styling commit
git commit -m "style: enhance connected card design

- Added glassmorphism effects and green theme
- Implemented responsive design for mobile devices
- Added animated connection icon with pulsing effect"

# Final commit
git commit -m "feat: complete dynamic status cards implementation

- Finalized card switching based on connection state
- Added comprehensive error handling
- Updated both index.html and index_new.html
- Tested functionality across all viewport sizes
- Added proper accessibility attributes"

# Merge to main
git checkout main
git merge feature/dynamic-status-cards
git push origin main
```

## Architecture & Technology Stack

### Backend
- **Framework**: Node.js with Express.js
- **Real-time Communication**: Socket.IO for WebSocket connections
- **Main Entry Point**: `server.js`
- **API Structure**: RESTful endpoints with real-time socket events

### Frontend
- **Core Technologies**: Vanilla JavaScript, HTML5, CSS3
- **Design System**: Custom glassmorphism theme with ICB Navy Blue palette
- **Responsive Design**: Mobile-first approach with viewport optimizations
- **Main Files**:
  - `public/index.html` - Primary interface
  - `public/index_new.html` - Alternative version
  - `public/js/app.js` - Main application logic
  - `public/css/styles.css` - Comprehensive styling system

### Key Features
1. **Dynamic Connection Status Management**: Cards that show/hide based on tenant connection state
2. **AI-Powered Natural Language Interface**: Chat-based M365 administration
3. **Zero Trust Assessment Integration**: Direct link to Microsoft's assessment tool
4. **Intelligent Health Reports**: Automated tenant health reporting
5. **Real-time Status Updates**: Live connection and operation status

## Code Style & Conventions

### JavaScript
- **Class-based Architecture**: Main application uses `ICBAgent` class
- **Event-driven Pattern**: Extensive use of event listeners and socket events
- **Async/Await**: Preferred for asynchronous operations
- **Error Handling**: Comprehensive try-catch blocks with user feedback
- **Naming Convention**: camelCase for variables and functions

### CSS
- **CSS Custom Properties**: Extensive use of CSS variables for theming
- **BEM-like Methodology**: Component-based class naming
- **Mobile-first Responsive**: Progressive enhancement approach
- **Glassmorphism Design**: backdrop-filter and transparency effects
- **Animation System**: Consistent timing and easing functions

### HTML
- **Semantic Structure**: Proper use of semantic HTML5 elements
- **Accessibility**: ARIA labels, proper form labels, keyboard navigation
- **Progressive Enhancement**: Works without JavaScript for basic functionality

## Design System

### Color Palette
```css
/* Primary Colors - ICB Navy Blue Palette */
--primary-500: #3e8ab4;
--primary-600: #2f6b8a;
--primary-700: #204d61;
--primary-900: #022541;

/* Success/Action Colors */
--success: #10b981; /* Used for connected states and clickable elements */
```

### Component Patterns
- **Feature Cards**: Glassmorphism cards with hover effects
- **Connection Status**: Dynamic indicators with pulsing animations
- **Form Elements**: Consistent styling with focus states
- **Buttons**: Gradient backgrounds with shimmer effects

## Key Components & Functionality

### Connection Management
- **Dynamic UI States**: Landing page adapts based on connection status
- **Tenant Setup Card**: Shows when disconnected
- **Current Connection Card**: Shows when connected with tenant info
- **Status Indicators**: Real-time visual feedback

### Chat Interface
- **Natural Language Processing**: Conversational M365 administration
- **Message System**: User and assistant message handling
- **Quick Actions**: Predefined command buttons
- **Real-time Updates**: Socket-based communication

### External Integrations
- **Microsoft Graph API**: For M365 data and operations
- **Zero Trust Assessment**: Direct integration with Microsoft's tool
- **Authentication**: OAuth2 flow for M365 access

## Development Guidelines

### When Adding New Features
1. **Create Feature Branch**: Always start with `git checkout -b feature/feature-name`
2. **Maintain Design Consistency**: Use existing CSS custom properties
3. **Follow Responsive Patterns**: Mobile-first, progressive enhancement
4. **Update All Versions**: Sync changes across `index.html` and `index_new.html`
5. **Add Event Listeners**: Include in `bindEvents()` method
6. **Error Handling**: Comprehensive error states and user feedback
7. **Progressive Commits**: Commit logical units of work with detailed messages
8. **Final Testing**: Validate across all viewport sizes before merge

### Code Organization
- **Single Responsibility**: Each function should have one clear purpose
- **Modular Design**: Separate concerns between UI, API, and business logic
- **State Management**: Centralized state in `ICBAgent` class
- **Event Handling**: Consistent event binding and cleanup

### Performance Considerations
- **Efficient DOM Manipulation**: Minimize reflows and repaints
- **Optimized Images**: Use appropriate formats and sizes
- **Lazy Loading**: Implement for non-critical resources
- **Animation Performance**: Use transform and opacity for animations

## Testing & Quality Assurance

### Browser Compatibility
- **Primary Targets**: Chrome, Firefox, Safari, Edge (latest versions)
- **Mobile Testing**: iOS Safari, Chrome Mobile
- **Accessibility**: WCAG 2.1 AA compliance

### Viewport Testing
- **Desktop**: 1440x1024, 1920x1080
- **Tablet**: 1024x768, 768x1024
- **Mobile**: 375x667, 375x812, 414x896

### Feature Testing
- **Connection States**: Test all connection status transitions
- **Responsive Layout**: Ensure single-viewport visibility
- **Interactive Elements**: Verify all buttons and links function
- **Real-time Features**: Test socket connections and updates

## Security Considerations

### Data Handling
- **No Sensitive Data Storage**: Avoid storing credentials in frontend
- **Session Management**: Proper cleanup on disconnect
- **Input Validation**: Sanitize all user inputs
- **HTTPS Only**: Enforce secure connections in production

### Authentication Flow
- **OAuth2 Implementation**: Follow Microsoft's best practices
- **Token Management**: Secure handling of access tokens
- **Permission Scopes**: Request minimal necessary permissions

## Deployment & Environment

### Development
- **Local Server**: Node.js server on port 3000
- **Hot Reload**: Development server with file watching
- **Debug Logging**: Comprehensive console logging

### Production Considerations
- **Environment Variables**: Use for configuration
- **Error Logging**: Structured logging for production
- **Performance Monitoring**: Track key metrics
- **Security Headers**: Implement proper security headers

## Common Patterns & Best Practices

### UI State Management
```javascript
// Always update both UI elements and internal state
this.isConnected = true;
this.updateConnectionStatus('connected', tenantDomain);
```

### Error Handling
```javascript
try {
    // Operation
} catch (error) {
    console.error('Operation failed:', error);
    this.showError('User-friendly error message');
}
```

### Responsive CSS
```css
/* Mobile-first approach */
.component {
    /* Base mobile styles */
}

@media (min-width: 768px) {
    .component {
        /* Tablet and desktop enhancements */
    }
}
```

### Event Binding
```javascript
// Always check for element existence
const element = document.getElementById('elementId');
if (element) {
    element.addEventListener('click', () => {
        this.handleClick();
    });
}
```

## File Structure & Dependencies

### Core Files
- `server.js` - Main server application
- `package.json` - Dependencies and scripts
- `public/index.html` - Primary interface
- `public/js/app.js` - Main application logic
- `public/css/styles.css` - Complete styling system

### Asset Organization
- `public/images/` - Static images and logos
- `public/css/` - Stylesheets
- `public/js/` - JavaScript files

### Development Files
- `test-device-queries.js` - Viewport testing utilities
- Various backup and alternative versions for development

This document should be updated as the project evolves to maintain accurate guidance for GitHub Copilot and development team members.
