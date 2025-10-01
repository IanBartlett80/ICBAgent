# MCP Screenshot Execution Checklist

Use this checklist when executing the MCP screenshot capture for Intelligent Health Reports.

## Pre-Execution Setup

- [ ] User is signed into Microsoft 365 customer tenant
- [ ] Browser session is active via MCP
- [ ] Authentication completed with appropriate permissions
- [ ] Output directory exists: `screenshots/report_<timestamp>/`
- [ ] MCP Playwright tools are available and working

---

## Execution Progress Tracker

### Phase 1: Entra Portal (Expected time: ~30 seconds)

#### ✅ Section 1: Entra Licenses
- [ ] Navigate to https://entra.microsoft.com
- [ ] Wait 5 seconds for portal load
- [ ] Click "Billing" in left menu
- [ ] Wait 3 seconds
- [ ] Click "Licenses"
- [ ] Wait 3 seconds
- [ ] Click "All Products"
- [ ] Wait 5 seconds
- [ ] Screenshot captured: `entra_licenses_*.jpg`

**Status**: ⬜ Not Started | 🔄 In Progress | ✅ Complete | ❌ Failed

---

### Phase 2: Vulnerability Management (Expected time: ~2 minutes)

#### ✅ Section 2: Exposure Score
- [ ] Navigate to https://security.microsoft.com
- [ ] Wait 5 seconds
- [ ] Click "Vulnerability Management"
- [ ] Wait 3 seconds
- [ ] Click "Dashboard"
- [ ] Wait 5 seconds
- [ ] Screenshot captured: `vuln_mgmt_exposure_score_*.jpg`

**Status**: ⬜ Not Started | 🔄 In Progress | ✅ Complete | ❌ Failed

---

#### ✅ Section 3: Exposure Score Over Time
- [ ] Already on Dashboard (no new navigation)
- [ ] Scroll down 300 pixels
- [ ] Wait 3 seconds for chart render
- [ ] Screenshot captured: `vuln_mgmt_exposure_time_*.jpg`

**Status**: ⬜ Not Started | 🔄 In Progress | ✅ Complete | ❌ Failed

---

#### ✅ Section 4: Device Score
- [ ] Already on Dashboard (no new navigation)
- [ ] Scroll down to 500 pixels from top
- [ ] Wait 3 seconds
- [ ] Screenshot captured: `vuln_mgmt_device_score_*.jpg`

**Status**: ⬜ Not Started | 🔄 In Progress | ✅ Complete | ❌ Failed

---

#### ✅ Section 5: Exposure Distribution
- [ ] Already on Dashboard (no new navigation)
- [ ] Scroll down to 700 pixels from top
- [ ] Wait 3 seconds
- [ ] Screenshot captured: `vuln_mgmt_exposure_distribution_*.jpg`

**Status**: ⬜ Not Started | 🔄 In Progress | ✅ Complete | ❌ Failed

---

#### ✅ Section 6: Top 10 Recommendations ⚠️ CRITICAL
- [ ] Navigate to Vulnerability Management
- [ ] Click "Recommendations"
- [ ] Wait 5 seconds for table load
- [ ] Verify table shows vulnerabilities sorted by priority
- [ ] Screenshot captured showing TOP 10 rows: `vuln_mgmt_top_10_recommendations_*.jpg`
- [ ] **AI Instruction Confirmed**: Analysis will focus on top 10 only

**Status**: ⬜ Not Started | 🔄 In Progress | ✅ Complete | ❌ Failed

---

### Phase 3: Security Reports - General (Expected time: ~2 minutes)

#### ✅ Section 7: Detections Blocked
- [ ] Navigate to https://security.microsoft.com
- [ ] Click "Reports"
- [ ] Click "Security Reports" under General
- [ ] Wait 5 seconds
- [ ] Scroll down 300 pixels
- [ ] Wait 3 seconds
- [ ] Screenshot captured: `security_reports_detections_blocked_*.jpg`

**Status**: ⬜ Not Started | 🔄 In Progress | ✅ Complete | ❌ Failed

---

#### ✅ Section 8: ASR Rules
- [ ] Already on Security Reports (no new navigation)
- [ ] Scroll down to 500 pixels
- [ ] Wait 3 seconds
- [ ] Screenshot captured: `security_reports_asr_rules_*.jpg`

**Status**: ⬜ Not Started | 🔄 In Progress | ✅ Complete | ❌ Failed

---

#### ✅ Section 9: Threat Analytics
- [ ] Already on Security Reports (no new navigation)
- [ ] Scroll down to 700 pixels
- [ ] Wait 3 seconds
- [ ] Screenshot captured: `security_reports_threat_analytics_*.jpg`

**Status**: ⬜ Not Started | 🔄 In Progress | ✅ Complete | ❌ Failed

---

#### ✅ Section 10: Device Compliance
- [ ] Already on Security Reports (no new navigation)
- [ ] Scroll down to 900 pixels
- [ ] Wait 3 seconds
- [ ] Screenshot captured: `security_reports_device_compliance_*.jpg`

**Status**: ⬜ Not Started | 🔄 In Progress | ✅ Complete | ❌ Failed

---

#### ✅ Section 11: Active Malware
- [ ] Already on Security Reports (no new navigation)
- [ ] Scroll down to 1100 pixels
- [ ] Wait 3 seconds
- [ ] Screenshot captured: `security_reports_active_malware_*.jpg`

**Status**: ⬜ Not Started | 🔄 In Progress | ✅ Complete | ❌ Failed

---

### Phase 4: Device Health (Expected time: ~1.5 minutes)

#### ✅ Section 12: Sensor Health
- [ ] Navigate to https://security.microsoft.com
- [ ] Click "Reports"
- [ ] Click "Device Health" under Endpoints
- [ ] Wait 5 seconds
- [ ] Screenshot captured: `device_health_sensor_health_*.jpg`

**Status**: ⬜ Not Started | 🔄 In Progress | ✅ Complete | ❌ Failed

---

#### ✅ Section 13: OS Platforms
- [ ] Already on Device Health (no new navigation)
- [ ] Scroll down 400 pixels
- [ ] Wait 3 seconds
- [ ] Screenshot captured: `device_health_os_platforms_*.jpg`

**Status**: ⬜ Not Started | 🔄 In Progress | ✅ Complete | ❌ Failed

---

#### ✅ Section 14: Windows Versions
- [ ] Already on Device Health (no new navigation)
- [ ] Scroll down to 700 pixels
- [ ] Wait 3 seconds
- [ ] Screenshot captured: `device_health_windows_versions_*.jpg`

**Status**: ⬜ Not Started | 🔄 In Progress | ✅ Complete | ❌ Failed

---

### Phase 5: Monthly Security Report (Expected time: ~2.5 minutes)

#### ✅ Section 15: Summary Text ⚠️ TEXT EXTRACTION
- [ ] Navigate to https://security.microsoft.com
- [ ] Click "Reports"
- [ ] Click "Monthly Security Report" under Endpoints
- [ ] Wait 5 seconds
- [ ] Use `mcp_playwright_browser_snapshot` to capture page
- [ ] Extract text from Summary section
- [ ] Text saved: `monthly_security_summary_text.json`
- [ ] **Confirm**: Text will be used directly in report (not screenshot)

**Status**: ⬜ Not Started | 🔄 In Progress | ✅ Complete | ❌ Failed

---

#### ✅ Section 16: Secure Score
- [ ] Already on Monthly Security Report (no new navigation)
- [ ] Scroll down 300 pixels
- [ ] Wait 3 seconds
- [ ] Screenshot captured: `monthly_security_secure_score_*.jpg`

**Status**: ⬜ Not Started | 🔄 In Progress | ✅ Complete | ❌ Failed

---

#### ✅ Section 17: Score Comparison
- [ ] Already on Monthly Security Report (no new navigation)
- [ ] Scroll down to 500 pixels
- [ ] Wait 3 seconds
- [ ] Screenshot captured: `monthly_security_score_comparison_*.jpg`

**Status**: ⬜ Not Started | 🔄 In Progress | ✅ Complete | ❌ Failed

---

#### ✅ Section 18: Devices Onboarded
- [ ] Already on Monthly Security Report (no new navigation)
- [ ] Scroll down to 700 pixels
- [ ] Wait 3 seconds
- [ ] Screenshot captured: `monthly_security_devices_onboarded_*.jpg`

**Status**: ⬜ Not Started | 🔄 In Progress | ✅ Complete | ❌ Failed

---

#### ✅ Section 19: Threat Protection
- [ ] Already on Monthly Security Report (no new navigation)
- [ ] Scroll down to 900 pixels
- [ ] Wait 3 seconds
- [ ] Screenshot captured: `monthly_security_threat_protection_*.jpg`

**Status**: ⬜ Not Started | 🔄 In Progress | ✅ Complete | ❌ Failed

---

#### ✅ Section 20: Suspicious Activities
- [ ] Already on Monthly Security Report (no new navigation)
- [ ] Scroll down to 1100 pixels
- [ ] Wait 3 seconds
- [ ] Screenshot captured: `monthly_security_suspicious_activities_*.jpg`

**Status**: ⬜ Not Started | 🔄 In Progress | ✅ Complete | ❌ Failed

---

## Post-Execution Validation

### File Verification
- [ ] Total files captured: 20 (19 JPEGs + 1 JSON text file)
- [ ] All filenames follow naming convention
- [ ] All files are non-zero size
- [ ] Screenshots are readable and show correct sections
- [ ] Monthly Summary text is extracted and formatted

### Quality Checks
- [ ] Entra licenses table is complete and visible
- [ ] Vulnerability Dashboard sections are properly captured
- [ ] Top 10 recommendations table shows exactly 10 entries
- [ ] Security Reports sections show correct data
- [ ] Device Health metrics are visible
- [ ] Monthly Security Report sections are properly positioned

### Content Validation
- [ ] No authentication prompts visible in screenshots
- [ ] No loading spinners or incomplete data
- [ ] Charts and graphs are fully rendered
- [ ] Tables show data (not empty)
- [ ] Text is legible at normal zoom

---

## Completion Checklist

### Service API Calls
- [ ] `setAllScreenshotsComplete()` called with all paths
- [ ] Extracted text data passed to completion handler
- [ ] Progress callback reached 100%
- [ ] No error messages in console

### Handoff to AI Analysis
- [ ] All 20 sections available for analysis
- [ ] Monthly Summary text ready for direct embedding
- [ ] Top 10 vulnerabilities flagged for detailed analysis
- [ ] Screenshot metadata includes capture timestamp
- [ ] File paths are correct and accessible

---

## Troubleshooting Log

Use this section to track any issues during execution:

| Section | Issue | Resolution | Time Added |
|---------|-------|-----------|------------|
| | | | |
| | | | |
| | | | |

---

## Execution Summary

**Start Time**: ____________  
**End Time**: ____________  
**Total Duration**: ____________  
**Sections Completed**: ____ / 20  
**Sections Failed**: ____  
**Retry Attempts**: ____  

**Overall Status**: ⬜ Success | ⬜ Partial Success | ⬜ Failed

---

## Sign-Off

- [ ] All 20 sections captured successfully
- [ ] Quality validation passed
- [ ] Files delivered to AI analysis service
- [ ] Ready for report generation

**Executed By**: ____________  
**Date**: ____________  
**Customer Tenant**: ____________

---

## Next Steps

After completion:
1. ✅ Pass screenshot paths to OpenAI analysis service
2. ✅ Pass Monthly Summary extracted text separately
3. ✅ Flag Top 10 vulnerabilities for detailed analysis
4. ✅ Begin Word document generation with all sections

**Estimated Report Generation Time**: 5-10 minutes after screenshots complete

---

**Document Version**: 1.0  
**Last Updated**: October 1, 2025  
**Compatible with**: playwright-screenshot-service-mcp.js v2.0
