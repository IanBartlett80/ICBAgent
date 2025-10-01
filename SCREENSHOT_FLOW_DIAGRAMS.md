# Screenshot Capture Flow Diagram

## Overall Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                   INTELLIGENT HEALTH REPORT                     │
│                      Screenshot Capture Flow                    │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐
│ User Request │
│Generate Report│
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────────────────┐
│  Initialize Playwright MCP Service                   │
│  - Create output directory                           │
│  - Prepare for 20 section capture                    │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│  PHASE 1: AUTHENTICATION (30 seconds)                │
│  ┌────────────────────────────────────────────┐     │
│  │ • Navigate to login.microsoftonline.com    │     │
│  │ • User signs in to customer tenant         │     │
│  │ • Complete MFA if required                 │     │
│  │ • Verify authentication successful         │     │
│  └────────────────────────────────────────────┘     │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│  PHASE 2: ENTRA PORTAL (30 seconds)                  │
│  ┌────────────────────────────────────────────┐     │
│  │ Section 1: Licenses                        │     │
│  │ • Navigate to entra.microsoft.com          │     │
│  │ • Billing > Licenses > All Products        │     │
│  │ • Screenshot: License table                │     │
│  └────────────────────────────────────────────┘     │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│  PHASE 3: VULNERABILITY MANAGEMENT (2 minutes)       │
│  ┌────────────────────────────────────────────┐     │
│  │ Section 2: Exposure Score (top)            │     │
│  │ Section 3: Score Over Time (scroll 300px)  │     │
│  │ Section 4: Device Score (scroll 500px)     │     │
│  │ Section 5: Distribution (scroll 700px)     │     │
│  │ ─────────────────────────────────────────  │     │
│  │ Section 6: Top 10 Recommendations ⚠️        │     │
│  │ • NEW PAGE: Recommendations                │     │
│  │ • AI Focus: First 10 items only            │     │
│  └────────────────────────────────────────────┘     │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│  PHASE 4: SECURITY REPORTS (2 minutes)               │
│  ┌────────────────────────────────────────────┐     │
│  │ Section 7: Detections Blocked (300px)      │     │
│  │ Section 8: ASR Rules (500px)               │     │
│  │ Section 9: Threat Analytics (700px)        │     │
│  │ Section 10: Device Compliance (900px)      │     │
│  │ Section 11: Active Malware (1100px)        │     │
│  └────────────────────────────────────────────┘     │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│  PHASE 5: DEVICE HEALTH (1.5 minutes)                │
│  ┌────────────────────────────────────────────┐     │
│  │ Section 12: Sensor Health (top)            │     │
│  │ Section 13: OS Platforms (400px)           │     │
│  │ Section 14: Windows Versions (700px)       │     │
│  └────────────────────────────────────────────┘     │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│  PHASE 6: MONTHLY SECURITY REPORT (2.5 minutes)      │
│  ┌────────────────────────────────────────────┐     │
│  │ Section 15: Summary ⚠️ TEXT EXTRACT        │     │
│  │ • Use snapshot, extract text               │     │
│  │ • No screenshot, text only                 │     │
│  │ ─────────────────────────────────────────  │     │
│  │ Section 16: Secure Score (300px)           │     │
│  │ Section 17: Score Comparison (500px)       │     │
│  │ Section 18: Devices Onboarded (700px)      │     │
│  │ Section 19: Threat Protection (900px)      │     │
│  │ Section 20: Suspicious Activities (1100px) │     │
│  └────────────────────────────────────────────┘     │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│  CAPTURE COMPLETE                                    │
│  • 19 Screenshot JPEGs                               │
│  • 1 Text JSON (Monthly Summary)                     │
│  • Total: 20 sections                                │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│  PASS TO AI ANALYSIS SERVICE                         │
│  • All screenshot paths                              │
│  • Extracted Monthly Summary text                    │
│  • Metadata and special flags                        │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│  WORD DOCUMENT GENERATION                            │
│  • Embed screenshots in report                       │
│  • Insert Monthly Summary text                       │
│  • AI analysis and recommendations                   │
│  • Focus on Top 10 vulnerabilities                   │
└──────────────┬───────────────────────────────────────┘
               │
               ▼
        ┌──────────┐
        │ COMPLETE │
        └──────────┘
```

---

## Scroll Pattern Visualization

```
┌─────────────────────────────────────────────────────┐
│                   BROWSER WINDOW                    │
│                                                     │
│  ┌────────────────────────────────────────────┐   │
│  │ VIEWPORT (Visible Area)                     │   │
│  │                                             │   │
│  │  Section at top (0px)                       │   │
│  │  ─────────────────────────────────────      │   │
│  │  [Screenshot without scroll]                │   │
│  │                                             │   │
│  ├─────────────────────────────────────────────┤   │
│  │                                             │   │
│  │  Scroll 300px ▼                             │   │
│  │  ─────────────────────────────────────      │   │
│  │  [Screenshot after scroll]                  │   │
│  │                                             │   │
│  ├─────────────────────────────────────────────┤   │
│  │                                             │   │
│  │  Scroll 500px ▼                             │   │
│  │  ─────────────────────────────────────      │   │
│  │  [Screenshot after scroll]                  │   │
│  │                                             │   │
│  ├─────────────────────────────────────────────┤   │
│  │                                             │   │
│  │  Scroll 700px ▼                             │   │
│  │  ─────────────────────────────────────      │   │
│  │  [Screenshot after scroll]                  │   │
│  │                                             │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Page continues below viewport...                  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Section Distribution Map

```
┌────────────────────────────────────────────────────────────────┐
│                    20 SECTIONS BREAKDOWN                       │
└────────────────────────────────────────────────────────────────┘

ENTRA PORTAL (1)
├─ Licenses

SECURITY PORTAL - VULNERABILITY MANAGEMENT (5)
├─ Dashboard
│  ├─ Exposure Score
│  ├─ Score Over Time
│  ├─ Device Score
│  └─ Distribution
└─ Recommendations
   └─ Top 10 ⚠️

SECURITY PORTAL - SECURITY REPORTS (5)
└─ General Reports
   ├─ Detections Blocked
   ├─ ASR Rules
   ├─ Threat Analytics
   ├─ Device Compliance
   └─ Active Malware

SECURITY PORTAL - DEVICE HEALTH (3)
└─ Endpoints Report
   ├─ Sensor Health
   ├─ OS Platforms
   └─ Windows Versions

SECURITY PORTAL - MONTHLY SECURITY (6)
└─ Monthly Report
   ├─ Summary ⚠️ (text)
   ├─ Secure Score
   ├─ Score Comparison
   ├─ Devices Onboarded
   ├─ Threat Protection
   └─ Suspicious Activities

TOTAL: 20 SECTIONS
```

---

## MCP Command Sequence

```
FOR EACH SECTION:

┌──────────────────────────────────────┐
│ 1. NAVIGATE                          │
│    mcp_playwright_browser_navigate   │
│    ↓                                 │
│ 2. WAIT (5 seconds)                  │
│    mcp_playwright_browser_wait_for   │
│    ↓                                 │
│ 3. SCROLL (if required)              │
│    mcp_playwright_browser_evaluate   │
│    window.scrollBy(0, amount)        │
│    ↓                                 │
│ 4. WAIT AFTER SCROLL (3 seconds)     │
│    mcp_playwright_browser_wait_for   │
│    ↓                                 │
│ 5. SCREENSHOT or SNAPSHOT            │
│    mcp_playwright_browser_take_      │
│    screenshot / snapshot             │
│    ↓                                 │
│ 6. VERIFY & SAVE                     │
│    File written to disk              │
└──────────────────────────────────────┘

REPEAT FOR NEXT SECTION →
```

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   USER REQUEST                          │
│              "Generate Health Report"                   │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────┐
│     INTELLIGENT HEALTH REPORT SERVICE                   │
│                                                         │
│  ┌────────────────────────────────────────────┐       │
│  │ generateMonthlyHealthReport()              │       │
│  └────────────────┬───────────────────────────┘       │
│                   │                                     │
│                   ▼                                     │
│  ┌────────────────────────────────────────────┐       │
│  │ Call: playwrightService.                   │       │
│  │       captureAllPortalScreenshots()        │       │
│  └────────────────┬───────────────────────────┘       │
└───────────────────┼─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│    PLAYWRIGHT SCREENSHOT SERVICE (MCP)                  │
│                                                         │
│  ┌────────────────────────────────────────────┐       │
│  │ Returns MCP Instructions for:              │       │
│  │                                            │       │
│  │ • 20 portal section definitions            │       │
│  │ • Navigation steps for each                │       │
│  │ • MCP commands structure                   │       │
│  │ • Scroll requirements                      │       │
│  │ • Wait times                               │       │
│  └────────────────┬───────────────────────────┘       │
└───────────────────┼─────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│         MCP PLAYWRIGHT TOOLS (External)                 │
│                                                         │
│  Executes commands:                                     │
│  • browser_navigate                                     │
│  • browser_wait_for                                     │
│  • browser_evaluate (scroll)                            │
│  • browser_take_screenshot                              │
│  • browser_snapshot (text extract)                      │
│                                                         │
│  Output: 19 JPEGs + 1 JSON                              │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│    OPENAI ANALYSIS SERVICE                              │
│                                                         │
│  Input:                                                 │
│  • All 20 section data                                  │
│  • Screenshots (19)                                     │
│  • Monthly Summary text (1)                             │
│  • Special flags (Top 10, text sections)                │
│                                                         │
│  Process:                                               │
│  • Vision API analyzes screenshots                      │
│  • Text embedding for Monthly Summary                   │
│  • Focus on Top 10 vulnerabilities                      │
│                                                         │
│  Output: AI analysis and recommendations                │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│      WORD DOCUMENT GENERATOR                            │
│                                                         │
│  Creates professional report with:                      │
│  • Cover page with tenant info                          │
│  • Executive summary                                    │
│  • All 20 sections with screenshots                     │
│  • Monthly Summary text (verbatim)                      │
│  • Top 10 vulnerabilities (detailed)                    │
│  • AI recommendations per section                       │
│  • Action items and priorities                          │
│                                                         │
│  Output: Professional Word document (.docx)             │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│      SHAREPOINT UPLOAD (Optional)                       │
│                                                         │
│  Uploads to customer SharePoint:                        │
│  • Monthly Health Reports library                       │
│  • Metadata: Date, Tenant, Sections                     │
│  • Permissions: IT Admin access                         │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
        ┌────────────────┐
        │  COMPLETE      │
        │  Report Ready  │
        └────────────────┘
```

---

## Timing Diagram

```
TIME →   0s      30s     2m      4m      5m30s    8m      ~9m
         │       │       │       │       │        │       │
         ▼       ▼       ▼       ▼       ▼        ▼       ▼
         ┌───────┬───────┬───────┬───────┬────────┬───────┐
         │ AUTH  │ ENTRA │ VULN  │ SEC   │ DEVICE │MONTHLY│
         │       │       │ MGMT  │ RPTS  │ HEALTH │REPORT │
         └───────┴───────┴───────┴───────┴────────┴───────┘
         
         1 section  5 sects  5 sects  3 sects   6 sects
                    
Progress: 0%      25%     40%     60%     75%      95%    100%
```

---

## Error Handling Flow

```
┌─────────────────────────────────────────┐
│ Attempt Section Capture                 │
└──────────┬──────────────────────────────┘
           │
           ▼
     ┌─────────┐
     │Success? │
     └─┬────┬──┘
   YES │    │ NO
       │    └────────────────┐
       ▼                     ▼
┌──────────────┐    ┌─────────────────┐
│ Save file    │    │ Log error       │
│ Move to next │    │ Retry (max 3)   │
└──────────────┘    └────┬────────────┘
                         │
                         ▼
                    ┌─────────┐
                    │Retry OK?│
                    └─┬────┬──┘
                  YES │    │ NO
                      │    └────────────┐
                      ▼                 ▼
               ┌──────────────┐  ┌─────────────┐
               │ Continue     │  │ Mark failed │
               └──────────────┘  │ Continue w/ │
                                 │ partial     │
                                 └─────────────┘
```

---

**Document**: Visual Flow Diagrams  
**Version**: 1.0  
**Date**: October 1, 2025
