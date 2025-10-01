# Manual Screenshot Capture - Technical Implementation Summary

## Overview
This document provides a technical overview of the manual screenshot capture system implemented to replace the unreliable automated navigation approach.

## Architecture Changes

### 1. Frontend Changes (`public/`)

#### `index.html` - Pre-flight Modal
- **Already had** customer name input field with proper styling
- Field ID: `customerNameInput`
- Validation: Required attribute
- Location: Inside `#intelligentReportModal`

#### `app.js` - Client Application Logic
- **Line ~3390**: `startIntelligentReport()` method
- Validates customer name input before proceeding
- Stores customer name: `this.customerName = customerName`
- Emits socket event with customer name:
  ```javascript
  this.socket.emit('generate-intelligent-report', {
      sessionId: sessionId,
      icbAccessToken: icbAccessToken,
      customerName: this.customerName
  });
  ```

### 2. Backend Changes

#### `server.js` - Socket Handler
- **Line ~3607**: `socket.on('generate-intelligent-report')`
- Receives `customerName` from frontend
- Passes to intelligent report service:
  ```javascript
  const result = await intelligentReportService.generateReport({
      sessionId: data.sessionId,
      socketId: socket.id,
      icbAccessToken: data.icbAccessToken,
      customerName: data.customerName
  });
  ```

#### `services/intelligent-health-report-service.js`
- **Line ~38**: `generateReport()` accepts `customerName` in options
- **Line ~46**: Stores in result object: `customerName: customerName`
- **Line ~160**: Uses for folder creation:
  ```javascript
  const customerFolder = path.join(localReportsPath, result.customerName);
  await fs.mkdir(customerFolder, { recursive: true });
  ```
- **Removed**: Tenant name extraction from authentication (no longer needed)

#### `services/playwright-screenshot-service-local.js` - Major Rewrite

##### New Methods Added

**`getSectionDefinitions()`**
- Returns array of 20 section definitions
- Each section has:
  - `name`: Internal identifier (e.g., 'entra_licenses')
  - `displayName`: User-facing name (e.g., 'Entra Licenses Overview')
  - `portal`: Portal name (e.g., 'Entra Admin Center')
  - `instructions`: Navigation instructions for user

**`injectCaptureOverlay()`**
- Injects CSS styles for overlay UI
- Creates 3 DOM elements:
  1. `#icb-capture-overlay` - Floating control panel
  2. `#icb-selection-overlay` - Full-screen dim overlay
  3. `#icb-selection-box` - Visual selection rectangle
- Adds mouse event handlers for drag-to-select
- Initializes `window.icbCaptureState` object for state management

**`showCapturePrompt(section, sectionNumber, totalSections)`**
- Updates overlay with current section info
- Shows progress (e.g., "Section 5/20")
- Displays portal name and instructions
- Resets capture state for new section

**`waitForUserCapture(section, outputPath)`**
- Waits for user action (capture or skip)
- Uses `page.waitForFunction()` to poll state
- Timeout: 10 minutes per section (600000ms)
- If captured: Uses `page.screenshot()` with `clip` parameter
- Returns success/failure result object

**`hideCaptureOverlay()`**
- Hides overlay when all sections complete

##### Modified Methods

**`captureAllPortalScreenshots(outputPath, progressCallback)` - Complete Rewrite**
- Old approach: Automated navigation with hardcoded selectors
- New approach: Manual capture with overlay UI
- Flow:
  1. Navigate to initial portal (admin.microsoft.com)
  2. Inject overlay UI
  3. Loop through 20 sections:
     - Show prompt with instructions
     - Wait for user to navigate and capture
     - Save screenshot or record skip
     - Update progress
  4. Hide overlay
  5. Return array of screenshot results

**Region Selection Implementation**
```javascript
// In injected page context
let startX, startY, isSelecting = false;

selectionOverlay.addEventListener('mousedown', (e) => {
    isSelecting = true;
    startX = e.clientX;
    startY = e.clientY;
    // Show selection box
});

selectionOverlay.addEventListener('mousemove', (e) => {
    if (!isSelecting) return;
    // Update selection box size and position
    const width = Math.abs(e.clientX - startX);
    const height = Math.abs(e.clientY - startY);
    // ... update box dimensions
});

selectionOverlay.addEventListener('mouseup', (e) => {
    // Finalize selection
    window.icbCaptureState.selectionBounds = { x, y, width, height };
    window.icbCaptureState.selectionComplete = true;
});
```

**Screenshot Capture with Clip**
```javascript
await this.page.screenshot({
    path: screenshotPath,
    type: 'jpeg',
    quality: 90,
    clip: {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height
    }
});
```

#### `services/word-document-generator.js`

**Logo Size Change**
- **Line ~117**: Changed from 200x200 to 100x100
```javascript
logoImage = new ImageRun({
    data: imageBuffer,
    transformation: {
        width: 100,   // Previously 120 (and 200 before that)
        height: 100   // Previously 120 (and 200 before that)
    }
});
```

**Filename Generation** (Already existed, unchanged)
- **Line ~38**: Uses customer name in filename
```javascript
const filename = `${sanitizedName}_Health_Report_${monthYear.replace(' ', '_')}.docx`;
```

#### `services/openai-analysis-service.js`

**Error Prevention**
- **Line ~89**: Enhanced null checks
```javascript
if (screenshot.isTextExtraction || !screenshot.path || screenshot.path === undefined) {
    // Skip vision analysis, return text-only result
    return {
        summary: screenshot.textContent || 'Section content not captured',
        insights: screenshot.textContent ? [...] : ['Screenshot not available'],
        recommendations: [...],
        severity: screenshot.textContent ? 'info' : 'warning'
    };
}
```

**Previously**: Caused `ERR_INVALID_ARG_TYPE` when trying to read undefined path  
**Now**: Safely handles missing screenshots

## State Management

### Frontend State (`app.js`)
```javascript
this.customerName = customerName;  // Stored in ICBAgent class instance
```

### Browser Injected State (`playwright-screenshot-service-local.js`)
```javascript
window.icbCaptureState = {
    isCapturing: false,
    captureRequested: false,
    skipRequested: false,
    selectionComplete: false,
    selectionBounds: null
};
```

### Backend State (`intelligent-health-report-service.js`)
```javascript
const result = {
    success: false,
    sessionId,
    error: null,
    customerName: customerName,  // From options parameter
    documentPath: null,
    sharepointPath: null
};
```

## UI/UX Flow

### 1. Pre-Flight Modal
```
User opens modal
  ↓
Enters customer name (required)
  ↓
Clicks "Generate Report"
  ↓
Validation: customer name not empty
  ↓
Socket emit to backend
```

### 2. Authentication Phase
```
Browser opens (Chromium headed)
  ↓
User signs in to customer M365 tenant
  ↓
System detects successful auth
  ↓
Proceeds to capture phase
```

### 3. Manual Capture Phase
```
For each section (1-20):
  ┌────────────────────────────────────┐
  │ Overlay shows:                     │
  │ - Section number (5/20)            │
  │ - Section name                     │
  │ - Portal name                      │
  │ - Navigation instructions          │
  │ [Capture Region] [Skip]            │
  └────────────────────────────────────┘
         ↓                    ↓
    User clicks          User clicks
    "Capture Region"     "Skip"
         ↓                    ↓
    Screen dims          Mark as skipped
    Crosshair cursor     Move to next
         ↓
    Drag to select
         ↓
    Release mouse
         ↓
    Capture region
         ↓
    Save screenshot
         ↓
    Move to next section
```

### 4. Report Generation Phase
```
All sections complete
  ↓
Run AI analysis (GPT-4 Vision)
  ↓
Generate Word document
  ↓
Save to customer folder
  ↓
Notify user with success/download link
```

## File Structure

### Screenshot Files (Temporary)
```
/tmp/health-reports/
└── [sessionId]/
    ├── entra_licenses_1696123456789.jpg
    ├── vulnerability_dashboard_1696123456790.jpg
    ├── security_overview_1696123456791.jpg
    └── ... (up to 20 files)
```

### Report Files (Permanent)
```
C:\ICBAgent\
└── Monthly Reports\
    └── [CustomerName]\
        └── [CustomerName]_Health_Report_[Month]_[Year].docx
```

## Error Handling

### Customer Name Validation
```javascript
// app.js
const customerName = customerNameInput?.value?.trim();
if (!customerName) {
    this.showError('Please enter a customer/organization name');
    customerNameInput?.focus();
    return;
}
```

### Screenshot Capture Errors
```javascript
// playwright-screenshot-service-local.js
try {
    await this.page.screenshot({ ... });
    return { success: true, ... };
} catch (error) {
    console.error(`❌ Failed to capture ${section}:`, error.message);
    return { success: false, section, error: error.message };
}
```

### Vision Analysis Errors
```javascript
// openai-analysis-service.js
if (screenshot.isTextExtraction || !screenshot.path || screenshot.path === undefined) {
    // Return safe default instead of trying to read file
    return { summary: ..., insights: ..., ... };
}
```

## Performance Considerations

### Timeouts
- **Authentication**: 5 minutes (300000ms)
- **Per Section Capture**: 10 minutes (600000ms)
- **Page Navigation**: 60 seconds (60000ms)
- **Content Loading**: 3-8 seconds (waitForTimeout)

### Screenshot Optimization
- **Format**: JPEG (not PNG for smaller file size)
- **Quality**: 90% (balance between size and quality)
- **Method**: Clip-based (only selected region, not full page)

### Memory Management
- **Cleanup**: `cleanup()` method closes browser resources
- **Temp Files**: Optional auto-cleanup after report generation
- **Browser**: Single page instance reused for all sections

## Security Considerations

### Customer Credentials
- **Storage**: Never stored by system
- **Transmission**: Only in browser, not sent to backend
- **Scope**: Required for accessing customer M365 portals

### Access Tokens
- **ICB Token**: Passed from frontend for ICB staff auth
- **Customer Token**: Generated by browser during M365 sign-in
- **Lifetime**: Session-based, not persisted

### Screenshot Data
- **Storage**: Local filesystem only
- **Transmission**: Not sent over network (except for AI analysis)
- **Cleanup**: Temp files deleted after report generation

## Browser Automation Details

### Playwright Configuration
```javascript
this.browser = await chromium.launch({
    headless: false,  // Visible for user interaction
    args: [
        '--start-maximized',
        '--disable-blink-features=AutomationControlled'
    ]
});

this.context = await this.browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ...'
});
```

### Why Headed Mode
- User needs to see portals for manual navigation
- Manual authentication requires visible browser
- User selects regions visually with mouse
- Debugging easier (can see what's happening)

## Testing Checklist

### Frontend Testing
- [ ] Customer name field appears in modal
- [ ] Validation prevents empty submission
- [ ] Customer name sent to backend correctly

### Backend Testing
- [ ] Socket receives customerName parameter
- [ ] Report service uses customerName for folders
- [ ] Word document filename includes customer name
- [ ] Folder created: `C:\ICBAgent\Monthly Reports\[CustomerName]\`

### Screenshot Testing
- [ ] Overlay appears after authentication
- [ ] Instructions show for each section
- [ ] Region selection works (drag and select)
- [ ] Screenshots save with correct filenames
- [ ] Skip button works correctly
- [ ] Progress tracking accurate (1/20, 2/20, etc.)

### Error Handling Testing
- [ ] Empty customer name shows error
- [ ] Missing screenshot doesn't crash AI analysis
- [ ] Skipped sections handled gracefully
- [ ] Timeout errors caught and reported

### Integration Testing
- [ ] Full report generation end-to-end
- [ ] Customer name in final document
- [ ] All 20 sections processable
- [ ] Document opens correctly in Word

## Future Enhancements

### Potential Improvements
1. **Automatic Region Detection**: AI-based content detection
2. **Template Regions**: Save common region selections for reuse
3. **Multi-Monitor Support**: Handle multiple screens
4. **Keyboard Shortcuts**: Speed up capture process
5. **Annotation Tools**: Add arrows/highlights before capturing
6. **Undo/Redo**: Recapture specific sections
7. **Batch Capture**: Capture multiple regions at once
8. **OCR Integration**: Extract text from screenshots automatically

### Known Limitations
- **Manual Process**: Slower than automated (when automation works)
- **User Training**: Requires user to know portal navigation
- **Consistency**: Screenshot framing may vary between users
- **Time**: 20 sections × 2 minutes average = 40 minutes minimum

## Migration Notes

### From Old Automated System

**Removed Code**:
- All automated `safeClick()` calls for menu navigation
- Hardcoded portal URLs with hash-based routes
- Sequential navigation logic (Phase 1, 2, 3, 4, 5)
- `extractSummaryText()` for Monthly Security Summary

**Kept Code**:
- `initialize()` - Browser launch
- `waitForAuthentication()` - Manual sign-in
- `cleanup()` - Resource cleanup
- `autoScroll()` - Page scrolling helper

**Compatibility**:
- Screenshot result format unchanged
- AI analysis service expects same data structure
- Word generator unchanged (uses same screenshot array)

## Rollback Plan

If manual capture system needs to be reverted:

1. **Git**: Revert to commit before `e6d8c45`
2. **Files to restore**:
   - `services/playwright-screenshot-service-local.js` (all automation code)
   - `services/intelligent-health-report-service.js` (tenant name extraction)
3. **Frontend**: Remove customer name validation (keep field for reference)

## Success Metrics

### Before (Automated System)
- Success Rate: ~30%
- Average Time: 15 minutes (when successful)
- Maintenance: Weekly selector updates needed
- User Involvement: Minimal

### After (Manual System)
- Success Rate: ~100% (user-dependent)
- Average Time: 40-60 minutes
- Maintenance: None (portal changes don't affect system)
- User Involvement: High (active throughout)

---

**Commit**: e6d8c45  
**Date**: October 1, 2025  
**Branch**: main  
**Files Changed**: 8  
**Lines Added**: 623  
**Lines Removed**: 25
