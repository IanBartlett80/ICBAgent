# Intelligent Health Reports - Implementation Plan
**Date:** October 1, 2025  
**Feature:** Enhanced Health Reports with Playwright MCP Screenshots & OpenAI Analysis  
**Branch:** MonthlyReport  

---

## 🎯 Feature Overview

Transform the Intelligent Health Reports feature to capture screenshots from Microsoft 365 portals using Playwright MCP, analyze data with OpenAI GPT-4o, and generate professional Word documents saved to ICB Solutions SharePoint.

---

## 🔐 Authentication Architecture

### Dual-Token System

**1. ICB Solutions Staff Authentication (Primary)**
- **Restriction:** Only `@icb.solutions` email addresses allowed
- **Purpose:** Access ICB Solutions SharePoint for report storage
- **Validation:** Check email domain during MSAL authentication callback
- **Error Message:** "Access restricted to ICB Solutions staff only"
- **UI:** "ICB Solutions Sign-In" button (replaces current header button)
- **Display:** Show authenticated staff member's name in header

**2. Customer Tenant Authentication (Report Generation)**
- **Method:** Manual authentication via Playwright browser (headed mode)
- **Trigger:** When "Intelligent Health Reports" feature clicked
- **Flow:** User manually enters customer admin credentials and completes MFA
- **Scope:** Used only for portal navigation and screenshot capture
- **Lifecycle:** Discarded after report generation

### Microsoft Graph Permissions

**Added Scopes:**
```javascript
"Sites.ReadWrite.All" // For SharePoint file upload
```

**SharePoint Upload Configuration:**
- **Site:** icbsolutionsptyltd.sharepoint.com
- **Site Name:** allcompany
- **Document Library:** Documents
- **Path Structure:** `Documents/Monthly Health Reports/{CustomerName}/`
- **Customer Name:** Extracted from tenant domain (e.g., contoso.onmicrosoft.com → Contoso)
- **Folder Naming:** Sanitized (remove special characters, spaces → underscores)

---

## 📸 Screenshot Capture Specifications

### Portal Targets

**1. Entra Admin Portal (entra.microsoft.com)**
- **Location:** Billing / Licenses / All Products
- **Capture:** License details and allocation

**2. Security Portal (security.microsoft.com) - Monthly Security Summary**
- **Location:** Reports / Monthly Security Summary
- **Capture:** All metrics and graphs

**3. Security Portal (security.microsoft.com) - Security Report**
- **Location:** Reports / Security Report
- **Capture:** All metrics and visualizations

**4. Security Portal (security.microsoft.com) - Device Health**
- **Location:** Reports / Device Health
- **Capture:** All metrics and graphs

### Screenshot Technical Specs

- **Format:** JPEG (standard quality)
- **Type:** Full-page screenshots
- **Rendering:** Wait for specific elements (graphs, charts, tables) to be fully rendered
- **Error Handling:** Skip unavailable sections, continue with rest
- **Progress:** Show progress indicator in Playwright browser window
- **Storage:** Temp folder `/tmp/health-reports/{sessionId}/` + embedded in document
- **Navigation:** Use default view/current month for all portals

---

## 🤖 OpenAI Integration

### Configuration

- **Model:** GPT-4o (latest, best quality)
- **API Key Storage:** Environment variable (`.env` file)
- **Analysis Method:** Both visual analysis (Vision API) + structured data
- **Tone:** Business-focused recommendations
- **Output Format:** 
  - Priority levels (High/Medium/Low)
  - Estimated time/effort for each action
  - Section-specific recommendations
  - Overall "Next Month Priorities" summary

### AI Analysis Flow

1. Send screenshots to OpenAI Vision API
2. Extract and send structured metrics data
3. Generate section-specific recommendations
4. Create consolidated "Next Month Priorities" section
5. Format recommendations with priority and time estimates

---

## 📄 Word Document Generation

### Document Structure

**1. Cover Page**
- ICB Solutions logo and branding
- Report title: "Monthly Health Report"
- Customer name
- Report date
- Confidentiality notice: "Confidential - For [Customer Name] Only"
- Footer: "Prepared by ICB Solutions - [Date]"

**2. Table of Contents**
- Auto-generated with page numbers

**3. Customer Details Section**
- Organization information
- Tenant details
- Reporting period

**4. Executive Summary**
- Overall health score
- Key metrics snapshot
- Critical findings

**5. Detailed Sections**
- **Licenses & Subscriptions**
  - Screenshots from Entra portal
  - License allocation analysis
  - AI recommendations (section-specific)
  
- **Identity & Access Management**
  - User and group metrics
  - Access patterns
  - AI recommendations (section-specific)
  
- **Security Posture & Incidents**
  - Security portal screenshots
  - Incident summary
  - Threat analysis
  - AI recommendations (section-specific)
  
- **Device Health & Compliance**
  - Device health portal screenshots
  - Compliance metrics
  - Device management insights
  - AI recommendations (section-specific)

**6. Next Month Priorities (AI-Generated)**
- Consolidated recommendations
- Priority-based action items
- Estimated time/effort for each action
- Business impact analysis

**7. Appendix (if needed)**
- Additional screenshots
- Detailed metrics tables

### Document Formatting

- **Headers/Footers:** On all pages with ICB branding
- **Page Numbers:** Included
- **Screenshot Layout:** Mix of full-width, centered with captions, and side-by-side
- **Color Scheme:** ICB Navy Blue palette
- **Professional Styling:** Headers, bullet points, tables
- **Confidentiality:** Footer on each page

### Document Naming Convention

```
{CustomerName}_Health_Report_{MonthName_Year}.docx
Example: Contoso_Health_Report_October_2025.docx
```

### Document Workflow

1. Generate Word document with all content and screenshots
2. Automatically open document for editing
3. User can make manual edits
4. Optional: Convert to PDF (user decides)
5. Save to SharePoint (Word document only initially)

---

## 🔄 User Workflow

### Pre-Flight Screen

When user clicks "Intelligent Health Reports" feature:

**Display:**
- Customer tenant authentication notice
- Checklist of what will be captured:
  - ✓ License allocation from Entra portal
  - ✓ Security metrics and incidents
  - ✓ Device health and compliance
  - ✓ AI-powered recommendations
- Estimated time: "This will take 5-10 minutes"
- "Start Report Generation" button

### Progress Tracking

**Detailed Progress Modal in Web App:**
```
Generating Intelligent Health Report...

✓ Authenticated to customer tenant
⏳ Capturing Entra portal screenshots... (1 of 4)
⏳ Capturing Security portal screenshots... (2 of 4)
⏳ Capturing Device health screenshots... (3 of 4)
⏳ Analyzing data with AI...
⏳ Generating Word document...
⏳ Uploading to SharePoint...
```

**Progress in Playwright Browser:**
- Visual banner showing current step
- Clear indication of automated actions

### Error Handling

**If Error Occurs:**
1. Save partial report locally (with available data)
2. Notify user with detailed error message
3. Provide local file path
4. Log error for debugging

**Graceful Degradation:**
- Skip unavailable portal sections
- Continue with remaining captures
- Note missing sections in report

### Completion

**Success:**
1. Upload Word document to SharePoint
2. Automatically open document for editing
3. Show success notification with SharePoint path
4. Provide option to convert to PDF

---

## 🛠️ Technical Implementation

### Service Architecture

**Separate Service Files:**

**1. `services/intelligent-health-report-service.js`**
- Main orchestrator for entire workflow
- Coordinates all other services
- Manages state and progress tracking

**2. `services/playwright-screenshot-service.js`**
- Portal navigation logic
- Screenshot capture for all 4 portal sections
- Element waiting and rendering detection
- Session management

**3. `services/openai-analysis-service.js`**
- OpenAI API integration
- Vision API for screenshot analysis
- Text analysis for structured data
- Recommendation generation
- Priority and effort estimation

**4. `services/word-document-generator.js`**
- Word document creation with ICB branding
- Template structure and formatting
- Screenshot embedding (multiple layouts)
- Table of contents generation
- Headers, footers, page numbers

**5. `services/sharepoint-upload-service.js`**
- Microsoft Graph integration
- Folder creation (if not exists)
- File upload to SharePoint
- Path sanitization

**6. `services/icb-auth-service.js`**
- ICB Solutions staff authentication
- Email domain validation (@icb.solutions)
- Token management for SharePoint access

### NPM Dependencies

**Install Required Packages:**
```bash
npm install docx              # Word document generation
npm install openai            # Official OpenAI SDK
npm install @microsoft/microsoft-graph-client  # SharePoint integration
npm install @azure/msal-node  # Server-side authentication
npm install jimp              # Image processing (if needed)
npm install dotenv            # Environment variables
```

### Environment Configuration

**`.env` File:**
```env
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Microsoft App Registration (ICB Solutions)
ICB_CLIENT_ID=your_icb_client_id
ICB_TENANT_ID=your_icb_tenant_id
ICB_CLIENT_SECRET=your_icb_client_secret

# SharePoint Configuration
SHAREPOINT_SITE_ID=icbsolutionsptyltd.sharepoint.com
SHAREPOINT_SITE_NAME=allcompany
SHAREPOINT_LIBRARY=Documents
SHAREPOINT_BASE_PATH=Monthly Health Reports

# Playwright Configuration
PLAYWRIGHT_HEADLESS=false
SCREENSHOT_TIMEOUT=30000
ELEMENT_WAIT_TIMEOUT=10000

# Temp Storage
TEMP_REPORT_PATH=/tmp/health-reports
```

### Server-Side Implementation

**Execution Context:** Server-side (Node.js)
- More stable for Playwright automation
- Better control over file system
- Secure API key management
- Proper error handling and logging

**Socket.IO Events:**
```javascript
// Client → Server
socket.emit('generate-intelligent-report', { sessionId });

// Server → Client (Progress Updates)
socket.emit('report-progress', { 
  step: 'capturing-screenshots', 
  progress: 50, 
  message: 'Capturing Security portal screenshots...' 
});

// Server → Client (Completion)
socket.emit('report-complete', { 
  filePath: '/path/to/document.docx',
  sharepointPath: 'Documents/Monthly Health Reports/Contoso/',
  customerName: 'Contoso'
});

// Server → Client (Error)
socket.emit('report-error', { 
  message: 'Failed to capture screenshots',
  partialReportPath: '/path/to/partial-report.docx'
});
```

---

## 🎨 UI Updates

### Header Changes

**Replace Current Sign-In Button:**
```html
<button id="icbSignInBtn" class="icb-signin-btn">
  <i class="ms-Icon ms-Icon--Signin"></i>
  ICB Solutions Sign-In
</button>

<!-- After Authentication -->
<div class="icb-user-info">
  <span class="user-name">john.smith@icb.solutions</span>
  <button id="icbSignOutBtn" class="signout-btn">Sign Out</button>
</div>
```

### Pre-Flight Modal

```html
<div id="intelligentReportModal" class="modal">
  <div class="modal-content">
    <h2>Generate Intelligent Health Report</h2>
    
    <div class="info-section">
      <p>This process will:</p>
      <ul class="checklist">
        <li>✓ Authenticate to customer's Microsoft 365 tenant</li>
        <li>✓ Capture license details from Entra portal</li>
        <li>✓ Capture security metrics and incidents</li>
        <li>✓ Capture device health and compliance data</li>
        <li>✓ Generate AI-powered recommendations</li>
        <li>✓ Create professional Word document</li>
        <li>✓ Save to ICB Solutions SharePoint</li>
      </ul>
      
      <div class="estimate">
        <strong>Estimated Time:</strong> 5-10 minutes
      </div>
    </div>
    
    <div class="actions">
      <button id="startReportBtn" class="primary-btn">
        Start Report Generation
      </button>
      <button id="cancelReportBtn" class="secondary-btn">
        Cancel
      </button>
    </div>
  </div>
</div>
```

### Progress Modal

```html
<div id="reportProgressModal" class="modal">
  <div class="modal-content">
    <h2>Generating Intelligent Health Report</h2>
    
    <div class="progress-steps">
      <div class="step completed">
        <span class="icon">✓</span>
        <span class="label">Customer tenant authenticated</span>
      </div>
      <div class="step active">
        <span class="icon">⏳</span>
        <span class="label">Capturing Entra portal screenshots...</span>
      </div>
      <div class="step">
        <span class="icon">○</span>
        <span class="label">Capturing Security portal screenshots...</span>
      </div>
      <div class="step">
        <span class="icon">○</span>
        <span class="label">Analyzing data with AI...</span>
      </div>
      <div class="step">
        <span class="icon">○</span>
        <span class="label">Generating Word document...</span>
      </div>
      <div class="step">
        <span class="icon">○</span>
        <span class="label">Uploading to SharePoint...</span>
      </div>
    </div>
    
    <div class="progress-bar">
      <div class="progress-fill" style="width: 33%"></div>
    </div>
    <div class="progress-text">33% Complete</div>
  </div>
</div>
```

---

## 📋 Implementation Checklist

### Phase 1: Authentication Updates
- [ ] Update auth-service-unified.js to validate @icb.solutions emails only
- [ ] Create icb-auth-service.js for staff authentication
- [ ] Update UI header with ICB Solutions Sign-In button
- [ ] Add email domain validation on authentication callback
- [ ] Add error handling for non-ICB users
- [ ] Show authenticated staff name in header

### Phase 2: Service File Creation
- [ ] Create services/ directory
- [ ] Create intelligent-health-report-service.js (orchestrator)
- [ ] Create playwright-screenshot-service.js
- [ ] Create openai-analysis-service.js
- [ ] Create word-document-generator.js
- [ ] Create sharepoint-upload-service.js

### Phase 3: NPM Dependencies
- [ ] Install docx package
- [ ] Install openai package
- [ ] Install @microsoft/microsoft-graph-client
- [ ] Install @azure/msal-node
- [ ] Install dotenv
- [ ] Update package.json

### Phase 4: Environment Configuration
- [ ] Create .env.example file
- [ ] Add OpenAI API key configuration
- [ ] Add ICB Solutions app registration details
- [ ] Add SharePoint configuration
- [ ] Add Playwright settings

### Phase 5: Playwright Integration
- [ ] Implement MCP Playwright connection
- [ ] Create portal navigation logic for 4 portals
- [ ] Implement element waiting/rendering detection
- [ ] Add screenshot capture with JPEG format
- [ ] Add progress indicators in browser
- [ ] Implement error handling and section skipping

### Phase 6: OpenAI Integration
- [ ] Set up OpenAI client with GPT-4o
- [ ] Implement Vision API for screenshot analysis
- [ ] Create business-focused prompt templates
- [ ] Implement section-specific recommendation generation
- [ ] Create overall priorities summary generation
- [ ] Add priority and time estimation logic

### Phase 7: Word Document Generation
- [ ] Create ICB-branded Word template
- [ ] Implement cover page with logo
- [ ] Add customer details section
- [ ] Create executive summary structure
- [ ] Implement detailed sections (Licenses, Security, Devices)
- [ ] Add screenshot embedding (multiple layouts)
- [ ] Generate table of contents
- [ ] Add headers/footers with confidentiality notices
- [ ] Implement page numbers

### Phase 8: SharePoint Integration
- [ ] Implement Microsoft Graph authentication
- [ ] Create folder structure navigation
- [ ] Add folder creation logic (if not exists)
- [ ] Implement customer name extraction from tenant
- [ ] Add name sanitization
- [ ] Create file upload functionality
- [ ] Add error handling for upload failures

### Phase 9: UI Implementation
- [ ] Create pre-flight modal HTML/CSS
- [ ] Create progress modal HTML/CSS
- [ ] Update feature card click handler
- [ ] Implement Socket.IO event listeners
- [ ] Add progress step updates
- [ ] Create success/error notifications
- [ ] Add document auto-open functionality

### Phase 10: Server-Side Integration
- [ ] Add Socket.IO event handlers in server.js
- [ ] Create report generation endpoint
- [ ] Implement session management
- [ ] Add temporary file cleanup
- [ ] Create logging for debugging
- [ ] Add comprehensive error handling

### Phase 11: Testing & Validation
- [ ] Test ICB email validation
- [ ] Test customer tenant authentication flow
- [ ] Verify screenshot capture from all 4 portals
- [ ] Test OpenAI analysis and recommendations
- [ ] Verify Word document generation and formatting
- [ ] Test SharePoint upload and folder creation
- [ ] Validate complete end-to-end workflow
- [ ] Test error scenarios and partial report generation

### Phase 12: Documentation
- [ ] Update README.md with new feature
- [ ] Create user guide for report generation
- [ ] Document environment variable setup
- [ ] Add troubleshooting guide
- [ ] Create API documentation for services

---

## 🚀 Implementation Priority Order

1. **Authentication Foundation** (Phase 1)
2. **Service Structure** (Phase 2)
3. **Dependencies & Config** (Phase 3-4)
4. **Core Functionality** (Phase 5-8)
5. **User Interface** (Phase 9)
6. **Integration** (Phase 10)
7. **Testing & Docs** (Phase 11-12)

---

## 📝 Notes & Considerations

### Security
- Never commit .env file with actual API keys
- Validate all user inputs
- Sanitize file paths and customer names
- Implement proper error messages without exposing sensitive data

### Performance
- Use temp folder cleanup to prevent disk space issues
- Implement timeout limits for Playwright operations
- Monitor OpenAI API usage and costs
- Consider caching for repeated operations (future enhancement)

### Scalability
- Current implementation: Single-threaded report generation
- Future: Queue system for multiple concurrent reports
- Future: Progress persistence for long-running operations

### Browser Compatibility
- Playwright runs server-side, no browser compatibility issues
- Web app should work in modern browsers (Chrome, Edge, Firefox, Safari)

### Error Recovery
- Partial reports saved locally if errors occur
- Detailed error logging for debugging
- User-friendly error messages in UI

---

## 🔮 Future Enhancements (Not in Current Scope)

- Report scheduling and automation
- Email delivery of completed reports
- Custom report templates per customer
- Historical trend analysis across multiple reports
- Dashboard for all generated reports
- Report comparison tools
- Multi-language support
- Custom branding per customer
- Report versioning system
- Collaborative editing features

---

**Document Version:** 1.0  
**Last Updated:** October 1, 2025  
**Status:** Ready for Implementation
