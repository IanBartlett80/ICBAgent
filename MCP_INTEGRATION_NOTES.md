# Playwright MCP Integration Notes

## Current Status (October 1, 2025)

### What's Working ✅
1. **ICB Staff Authentication**
   - Persists across page refreshes
   - User name displays correctly
   - Access tokens managed by MSAL

2. **UI Components**
   - Pre-flight modal displays
   - Progress modal with 5 steps
   - "Start Report Generation" button triggers workflow

3. **Backend Communication**
   - Socket.IO events working
   - Progress updates sent to client
   - ICB access token obtained successfully

4. **Playwright MCP Browser**
   - Browser launches successfully
   - Can navigate and authenticate manually
   - Successfully authenticated to **longhorn-group.com.au** tenant

### Current Issue ❌

The **Playwright Screenshot Service** was designed to control the browser programmatically, but we're using **Playwright MCP** which requires the AI agent (GitHub Copilot) to manually invoke MCP tools.

**The Problem:**
- Service calls `mcpNavigate()`, `mcpGetCurrentUrl()`, etc.
- These methods try to call `global.mcpClient.callTool()` 
- But `mcpClient` doesn't exist - MCP tools are invoked by Copilot via `@antml:invoke`

**What Happens:**
- Service waits for authentication (polls for URL changes)
- Polling never succeeds because `mcpGetCurrentUrl()` returns null
- After 5 minutes, times out with "Authentication timeout"

## Solution Implemented 🔧

Created **`playwright-screenshot-service-mcp.js`** which uses a different approach:

### New Architecture

Instead of controlling the browser, the service returns **instructions** for the AI agent to execute:

```javascript
// Old approach (doesn't work):
await this.playwrightService.navigate(url);
const screenshot = await this.playwrightService.captureScreenshot();

// New approach (works with MCP):
const instructions = await this.playwrightService.capturePortalScreenshot(options);
// Returns: { requiresManualCompletion: true, instructions: {...}, mcpCommands: {...} }

// AI agent then executes:
// - mcp_playwright_browser_navigate
// - mcp_playwright_browser_wait_for
// - mcp_playwright_browser_take_screenshot

// After completion, call:
service.setScreenshotComplete(screenshotPath);
```

### Key Changes

1. **Authentication**
   - `waitForAuthentication()` returns instructions, not a promise that waits
   - AI agent manually completes auth
   - Call `setAuthenticationComplete({ tenantName, currentUrl })` when done

2. **Screenshot Capture**
   - `capturePortalScreenshot()` returns MCP command instructions
   - AI agent executes the commands
   - Call `setScreenshotComplete(path)` after each screenshot

3. **Batch Operations**
   - `captureAllPortalScreenshots()` returns instructions for all portals
   - AI agent loops through and executes
   - Call `setAllScreenshotsComplete([paths])` when all done

## Next Steps to Complete Feature 📋

### Option A: Fully Automated (Requires Code Changes)

Update `intelligent-health-report-service.js` to work with the instruction-based approach:

1. **Check for `requiresManualCompletion`**
   ```javascript
   const authResult = await this.playwrightService.waitForAuthentication();
   if (authResult.requiresManualCompletion) {
       // Emit special event to client asking for manual intervention
       // OR have server notify AI agent to handle it
   }
   ```

2. **Create Agent Handler**
   - Server emits "needs-agent-action" events
   - AI agent monitors these events
   - Executes MCP commands automatically
   - Calls completion methods

### Option B: Semi-Manual (Quick Solution)

For testing/development, manually control the workflow:

1. **User clicks "Start Report Generation"**
2. **Server emits progress: "authentication" step**
3. **AI agent (manually) does:**
   ```
   - Navigate to login.microsoftonline.com
   - User signs in
   - Navigate to portal.office.com (or any M365 portal)
   - Call service.setAuthenticationComplete({ tenantName: 'Longhorn Group', currentUrl })
   ```

4. **Server emits progress: "screenshots" step**
5. **AI agent (manually) captures each screenshot:**
   ```
   For each portal:
   - Navigate to URL
   - Wait 5 seconds
   - Take screenshot
   - Call service.setScreenshotComplete(path)
   ```

6. **Continue with AI analysis, document generation, SharePoint upload**

### Option C: Hybrid Approach (Recommended)

1. **Keep screenshot service as MCP-instruction-based**
2. **Add "Agent Assistant Mode" to server**
   - When report generation starts, create an agent task queue
   - AI agent polls/listens for tasks
   - Executes MCP commands automatically
   - Reports completion

3. **Benefits:**
   - Works in dev container environment
   - Can still work locally with direct Playwright
   - Scalable to other automated tasks

## Testing the Current Implementation

### Manual Test Steps

1. **Start report generation from UI**
2. **Monitor server logs** for "🔐 Waiting for manual authentication..."
3. **Use MCP tools to authenticate:**
   ```
   mcp_playwright_browser_navigate: https://login.microsoftonline.com
   [User signs in to customer tenant]
   mcp_playwright_browser_navigate: https://admin.microsoft.com
   ```

4. **In separate terminal/method, call:**
   ```javascript
   intelligentReportService.playwrightService.setAuthenticationComplete({
       tenantName: 'Longhorn Group',
       currentUrl: 'https://admin.microsoft.com'
   });
   ```

5. **Continue with screenshot instructions**

## Recommended Implementation for Production

For a production-ready solution in the dev container environment:

### 1. Agent Task Queue System

Create `services/agent-task-queue.js`:
- Server adds tasks to queue
- AI agent processes tasks automatically
- Returns results to server

### 2. WebSocket Bridge

Add special Socket.IO events:
- `agent-task-created` - New task for AI agent
- `agent-task-progress` - Agent reports progress
- `agent-task-complete` - Agent finished task

### 3. Update Report Service

Modify `intelligent-health-report-service.js`:
```javascript
// Instead of blocking await:
const authTask = await this.createAgentTask('authenticate', {...});
// Wait for task completion via event
await this.waitForTaskCompletion(authTask.id);
```

## Files Modified

- ✅ `services/playwright-screenshot-service-mcp.js` - New MCP-compatible service
- ⏸️ `services/intelligent-health-report-service.js` - Needs updates to use new service
- ⏸️ `server.js` - May need task queue integration

## Environment

- **Development**: GitHub Codespaces / VS Code Dev Container
- **Playwright**: Managed via MCP (Model Context Protocol)
- **AI Agent**: GitHub Copilot with MCP tool access
- **Browser**: Chromium (headless in container, no display)

## Authentication Flow (Current Working State)

1. ✅ User: IanBartlett@icb.solutions (ICB Staff)
2. ✅ ICB Token: Obtained via MSAL
3. ✅ Customer Tenant: longhorn-group.com.au
4. ✅ Customer User: ICBAdmin@longhorn-group.com.au
5. ✅ Browser: Authenticated and on M365 portal

**Next Action Required:** Capture screenshots from authenticated session

## Current Session State

- **Browser**: Open at `https://m365.cloud.microsoft/chat/`
- **Authenticated As**: ICBAdmin@longhorn-group.com.au
- **Tenant**: Longhorn Group (longhorn-group.com.au)
- **Ready For**: Screenshot capture from M365 portals

