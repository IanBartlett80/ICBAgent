# Comprehensive Screenshot Capture Guide for Intelligent Health Reports

## Overview

This guide explains the updated Playwright MCP screenshot service that captures **20 distinct sections** across Microsoft 365 portals for comprehensive monthly health reporting.

## Updated: October 1, 2025

---

## Total Screenshots Required: 20 Sections

### Breakdown by Portal

1. **Entra Portal** - 1 screenshot
2. **Security Portal - Vulnerability Management** - 5 screenshots
3. **Security Portal - Security Reports (General)** - 5 screenshots
4. **Security Portal - Device Health** - 3 screenshots
5. **Security Portal - Monthly Security Report** - 6 sections (1 text extraction + 5 screenshots)

---

## Detailed Section Requirements

### 1. ENTRA PORTAL - LICENSES (1 screenshot)

#### Section: `entra_licenses`
- **URL**: https://entra.microsoft.com
- **Navigation Path**: Billing > Licenses > All Products
- **Content**: License allocation table showing all products
- **Scroll Required**: No
- **Wait Time**: 5 seconds after navigation

**Navigation Steps:**
1. Navigate to https://entra.microsoft.com
2. Wait 5 seconds for portal to load
3. Click "Billing" in left navigation menu
4. Wait 3 seconds
5. Click "Licenses" sub-menu item
6. Wait 3 seconds
7. Click "All Products"
8. Wait 5 seconds for table to load
9. Take screenshot

---

### 2. SECURITY PORTAL - VULNERABILITY MANAGEMENT (5 screenshots)

#### Section 2.1: `vuln_mgmt_exposure_score`
- **URL**: https://security.microsoft.com
- **Navigation Path**: Vulnerability Management > Dashboard
- **Content**: Exposure Score (top section)
- **Scroll Required**: No
- **Wait Time**: 5 seconds

**Navigation Steps:**
1. Navigate to https://security.microsoft.com
2. Wait 5 seconds
3. Click "Vulnerability Management" in left menu
4. Click "Dashboard"
5. Wait 5 seconds
6. Take screenshot of Exposure Score section

---

#### Section 2.2: `vuln_mgmt_exposure_time`
- **Navigation Path**: Same page - Vulnerability Management > Dashboard
- **Content**: Exposure Score over Time chart
- **Scroll Required**: Yes (300px down)
- **Wait Time**: 3 seconds after scroll

**Navigation Steps:**
1. Already on Vulnerability Management Dashboard
2. Scroll down 300 pixels
3. Wait 3 seconds for chart to render
4. Take screenshot of trend chart

---

#### Section 2.3: `vuln_mgmt_device_score`
- **Navigation Path**: Same page - Vulnerability Management > Dashboard
- **Content**: Your Score for Devices section
- **Scroll Required**: Yes (500px down from top)
- **Wait Time**: 3 seconds after scroll

**Navigation Steps:**
1. Already on Vulnerability Management Dashboard
2. Scroll down to 500 pixels from top
3. Wait 3 seconds
4. Take screenshot of device score metrics

---

#### Section 2.4: `vuln_mgmt_exposure_distribution`
- **Navigation Path**: Same page - Vulnerability Management > Dashboard
- **Content**: Exposure Distribution visualization
- **Scroll Required**: Yes (700px down from top)
- **Wait Time**: 3 seconds after scroll

**Navigation Steps:**
1. Already on Vulnerability Management Dashboard
2. Scroll down to 700 pixels from top
3. Wait 3 seconds
4. Take screenshot of distribution chart

---

#### Section 2.5: `vuln_mgmt_top_10_recommendations`
- **URL**: https://security.microsoft.com
- **Navigation Path**: Vulnerability Management > Recommendations
- **Content**: **TOP 10 VULNERABILITIES ONLY** - Priority list for next month
- **Scroll Required**: No
- **Wait Time**: 5 seconds
- **AI Instructions**: Focus analysis on top 10 items only

**Navigation Steps:**
1. Navigate to https://security.microsoft.com
2. Wait 5 seconds
3. Click "Vulnerability Management" in left menu
4. Click "Recommendations"
5. Wait 5 seconds for table to load
6. Ensure sorted by priority (default)
7. Take screenshot showing top 10 rows
8. **NOTE**: AI analysis must concentrate on these top 10 for monthly priorities

---

### 3. SECURITY PORTAL - SECURITY REPORTS (GENERAL) (5 screenshots)

All sections accessed from: Reports > Security Reports (under General)

#### Section 3.1: `security_reports_detections_blocked`
- **URL**: https://security.microsoft.com
- **Navigation Path**: Reports > Security Reports
- **Content**: Detections Blocked section
- **Scroll Required**: Yes (300px down)
- **Wait Time**: 3 seconds after scroll

**Navigation Steps:**
1. Navigate to https://security.microsoft.com
2. Click "Reports" in left menu
3. Click "Security Reports" under General
4. Wait 5 seconds
5. Scroll down 300 pixels to "Detections Blocked"
6. Wait 3 seconds
7. Take screenshot

---

#### Section 3.2: `security_reports_asr_rules`
- **Navigation Path**: Same page - Reports > Security Reports
- **Content**: ASR Rule Configuration
- **Scroll Required**: Yes (500px down)
- **Wait Time**: 3 seconds after scroll

---

#### Section 3.3: `security_reports_threat_analytics`
- **Navigation Path**: Same page - Reports > Security Reports
- **Content**: Threat Analytics section
- **Scroll Required**: Yes (700px down)
- **Wait Time**: 3 seconds after scroll

---

#### Section 3.4: `security_reports_device_compliance`
- **Navigation Path**: Same page - Reports > Security Reports
- **Content**: Device Compliance metrics
- **Scroll Required**: Yes (900px down)
- **Wait Time**: 3 seconds after scroll

---

#### Section 3.5: `security_reports_active_malware`
- **Navigation Path**: Same page - Reports > Security Reports
- **Content**: Devices with Active Malware
- **Scroll Required**: Yes (1100px down)
- **Wait Time**: 3 seconds after scroll

---

### 4. SECURITY PORTAL - DEVICE HEALTH REPORT (3 screenshots)

All sections accessed from: Reports > Device Health (under Endpoints)

#### Section 4.1: `device_health_sensor_health`
- **URL**: https://security.microsoft.com
- **Navigation Path**: Reports > Device Health (Endpoints)
- **Content**: Sensor Health section
- **Scroll Required**: No
- **Wait Time**: 5 seconds

**Navigation Steps:**
1. Navigate to https://security.microsoft.com
2. Click "Reports" in left menu
3. Click "Device Health" under Endpoints
4. Wait 5 seconds
5. Take screenshot of Sensor Health (top section)

---

#### Section 4.2: `device_health_os_platforms`
- **Navigation Path**: Same page - Reports > Device Health
- **Content**: Operating Systems and Platforms
- **Scroll Required**: Yes (400px down)
- **Wait Time**: 3 seconds after scroll

---

#### Section 4.3: `device_health_windows_versions`
- **Navigation Path**: Same page - Reports > Device Health
- **Content**: Windows Versions distribution
- **Scroll Required**: Yes (700px down)
- **Wait Time**: 3 seconds after scroll

---

### 5. SECURITY PORTAL - MONTHLY SECURITY REPORT (6 sections)

All sections accessed from: Reports > Monthly Security Report (under Endpoints)

#### Section 5.1: `monthly_security_summary_text` ⚠️ TEXT EXTRACTION
- **URL**: https://security.microsoft.com
- **Navigation Path**: Reports > Monthly Security Report
- **Content**: Summary section - **EXTRACT TEXT, DO NOT JUST SCREENSHOT**
- **Scroll Required**: No
- **Wait Time**: 5 seconds
- **Special Handling**: Use text content directly in report

**Navigation Steps:**
1. Navigate to https://security.microsoft.com
2. Click "Reports" in left menu
3. Click "Monthly Security Report" under Endpoints
4. Wait 5 seconds
5. Use `mcp_playwright_browser_snapshot` to get page content
6. Extract text from Summary section
7. Store text separately for direct use in report (not as screenshot)

**Text Extraction Instructions:**
- Capture the Summary heading and paragraph content
- Extract key metrics and statements
- Format as clean text for report inclusion
- Pass to AI analysis service for direct embedding in report

---

#### Section 5.2: `monthly_security_secure_score`
- **Navigation Path**: Same page - Reports > Monthly Security Report
- **Content**: Microsoft Secure Score
- **Scroll Required**: Yes (300px down)
- **Wait Time**: 3 seconds after scroll

---

#### Section 5.3: `monthly_security_score_comparison`
- **Navigation Path**: Same page - Reports > Monthly Security Report
- **Content**: "Your secure score compared to organizations of similar size"
- **Scroll Required**: Yes (500px down)
- **Wait Time**: 3 seconds after scroll

---

#### Section 5.4: `monthly_security_devices_onboarded`
- **Navigation Path**: Same page - Reports > Monthly Security Report
- **Content**: Devices onboarded to Defender for Business
- **Scroll Required**: Yes (700px down)
- **Wait Time**: 3 seconds after scroll

---

#### Section 5.5: `monthly_security_threat_protection`
- **Navigation Path**: Same page - Reports > Monthly Security Report
- **Content**: Protection against specific types of threats
- **Scroll Required**: Yes (900px down)
- **Wait Time**: 3 seconds after scroll

---

#### Section 5.6: `monthly_security_suspicious_activities`
- **Navigation Path**: Same page - Reports > Monthly Security Report
- **Content**: Tracked severe suspicious or malicious activities
- **Scroll Required**: Yes (1100px down)
- **Wait Time**: 3 seconds after scroll

---

## MCP Command Workflow

### For Sections WITHOUT Scroll

```javascript
{
  navigate: {
    tool: 'mcp_playwright_browser_navigate',
    params: { url: '<portal_url>' }
  },
  wait: {
    tool: 'mcp_playwright_browser_wait_for',
    params: { time: 5 }
  },
  screenshot: {
    tool: 'mcp_playwright_browser_take_screenshot',
    params: {
      filename: '<output_path>',
      type: 'jpeg',
      fullPage: true
    }
  }
}
```

### For Sections WITH Scroll

```javascript
{
  navigate: {
    tool: 'mcp_playwright_browser_navigate',
    params: { url: '<portal_url>' }
  },
  wait: {
    tool: 'mcp_playwright_browser_wait_for',
    params: { time: 5 }
  },
  scroll: {
    tool: 'mcp_playwright_browser_evaluate',
    params: {
      function: '() => { window.scrollBy(0, <scroll_amount>); }'
    }
  },
  waitAfterScroll: {
    tool: 'mcp_playwright_browser_wait_for',
    params: { time: 3 }
  },
  screenshot: {
    tool: 'mcp_playwright_browser_take_screenshot',
    params: {
      filename: '<output_path>',
      type: 'jpeg',
      fullPage: false
    }
  }
}
```

### For Text Extraction (Monthly Summary)

```javascript
{
  navigate: {
    tool: 'mcp_playwright_browser_navigate',
    params: { url: 'https://security.microsoft.com' }
  },
  wait: {
    tool: 'mcp_playwright_browser_wait_for',
    params: { time: 5 }
  },
  snapshot: {
    tool: 'mcp_playwright_browser_snapshot',
    params: {}
  }
}
```

---

## Authentication Requirements

### Prerequisites
- User must authenticate to customer Microsoft 365 tenant
- Required permissions:
  - Security Administrator or Global Reader
  - Access to Entra Admin Center
  - Access to Microsoft 365 Security Portal
  - Appropriate licensing (Defender for Business, etc.)

### Authentication Flow
1. MCP agent navigates to https://login.microsoftonline.com
2. User selects appropriate account or enters credentials
3. Complete MFA if required
4. Verify successful authentication
5. Call `setAuthenticationComplete()` with tenant info

---

## Progress Reporting

The service reports progress for each section:

```javascript
{
  step: 'screenshots',
  progress: <percentage>,
  message: 'Capturing screenshots from Microsoft 365 portals...',
  details: 'Section X of 20: <section_name>'
}
```

### Progress Milestones
- 20% - Authentication complete
- 25% - Entra licenses captured
- 40% - Vulnerability Management complete
- 60% - Security Reports complete
- 75% - Device Health complete
- 95% - Monthly Security Report complete
- 100% - All screenshots captured

---

## Output Structure

```
screenshots/
  report_<timestamp>/
    entra_licenses_<timestamp>.jpg
    vuln_mgmt_exposure_score_<timestamp>.jpg
    vuln_mgmt_exposure_time_<timestamp>.jpg
    vuln_mgmt_device_score_<timestamp>.jpg
    vuln_mgmt_exposure_distribution_<timestamp>.jpg
    vuln_mgmt_top_10_recommendations_<timestamp>.jpg
    security_reports_detections_blocked_<timestamp>.jpg
    security_reports_asr_rules_<timestamp>.jpg
    security_reports_threat_analytics_<timestamp>.jpg
    security_reports_device_compliance_<timestamp>.jpg
    security_reports_active_malware_<timestamp>.jpg
    device_health_sensor_health_<timestamp>.jpg
    device_health_os_platforms_<timestamp>.jpg
    device_health_windows_versions_<timestamp>.jpg
    monthly_security_summary_text.json (extracted text)
    monthly_security_secure_score_<timestamp>.jpg
    monthly_security_score_comparison_<timestamp>.jpg
    monthly_security_devices_onboarded_<timestamp>.jpg
    monthly_security_threat_protection_<timestamp>.jpg
    monthly_security_suspicious_activities_<timestamp>.jpg
```

---

## AI Analysis Instructions

### Top 10 Vulnerabilities (Section 2.5)
- **CRITICAL**: Focus ONLY on the first 10 items in the recommendations table
- Provide detailed analysis for each of the top 10
- Include remediation steps for each
- Prioritize these for next month's action plan
- Do not analyze vulnerabilities beyond the top 10

### Monthly Security Summary (Section 5.1)
- Use extracted text content directly
- Do not attempt to interpret screenshot
- Embed text verbatim in report
- Add AI commentary around the official summary

### General Analysis
- Compare metrics month-over-month when possible
- Identify trends in security posture
- Highlight critical issues requiring immediate attention
- Provide actionable recommendations for each section

---

## Troubleshooting

### Common Issues

1. **Authentication Timeout**
   - Ensure user completes sign-in within 60 seconds
   - Check MFA configuration
   - Verify account has required permissions

2. **Content Not Loading**
   - Increase wait times if portal is slow
   - Check network connectivity
   - Verify user has access to specific reports

3. **Scroll Not Capturing Correct Section**
   - Adjust scroll amounts if page layout has changed
   - Verify page has fully loaded before scrolling
   - Use fixed scroll amounts rather than relative

4. **Missing Screenshots**
   - Verify output directory permissions
   - Check disk space
   - Ensure filename paths are valid

---

## Testing Checklist

- [ ] Authentication completes successfully
- [ ] All 20 sections are captured
- [ ] Scroll amounts position sections correctly
- [ ] Text extraction works for Monthly Summary
- [ ] Screenshots are high quality and readable
- [ ] File naming is consistent
- [ ] Progress reporting is accurate
- [ ] AI analysis focuses on top 10 vulnerabilities
- [ ] Report generation includes all sections

---

## Service API

### Initialize Service
```javascript
const screenshotService = new PlaywrightScreenshotServiceMCP();
await screenshotService.initialize();
```

### Capture All Screenshots
```javascript
const result = await screenshotService.captureAllPortalScreenshots(
  (progress) => {
    console.log(`${progress.progress}% - ${progress.message}`);
  }
);
```

### Mark Completion
```javascript
screenshotService.setAllScreenshotsComplete(
  screenshotPaths,
  { monthly_summary: extractedText }
);
```

---

## Version History

- **October 1, 2025** - Comprehensive update to 20 sections across 5 portal areas
- Added detailed navigation steps for each section
- Implemented scroll handling for multi-section pages
- Added text extraction for Monthly Security Summary
- Enhanced AI instructions for Top 10 vulnerabilities focus

---

## Support

For issues or questions about the screenshot service:
1. Check the service logs for detailed error messages
2. Verify MCP tools are properly installed
3. Ensure user has required Microsoft 365 permissions
4. Review this guide for correct navigation steps

---

**Last Updated**: October 1, 2025  
**Service Version**: 2.0 (MCP Integration)  
**Total Sections**: 20 (19 screenshots + 1 text extraction)
