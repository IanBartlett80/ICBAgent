# Quick Reference: MCP Screenshot Implementation

## 20 Sections at a Glance

### Portal Summary
| # | Portal | Section | Scroll | Wait | Special |
|---|--------|---------|--------|------|---------|
| 1 | Entra | Licenses | No | 5s | Full page |
| 2 | Security | Vuln: Exposure Score | No | 5s | Top section |
| 3 | Security | Vuln: Score Over Time | 300px | 3s | Chart |
| 4 | Security | Vuln: Device Score | 500px | 3s | Metrics |
| 5 | Security | Vuln: Distribution | 700px | 3s | Visualization |
| 6 | Security | Vuln: Top 10 Recomm. | No | 5s | **AI: Focus top 10** |
| 7 | Security | Security: Detections | 300px | 3s | Report section |
| 8 | Security | Security: ASR Rules | 500px | 3s | Configuration |
| 9 | Security | Security: Threats | 700px | 3s | Analytics |
| 10 | Security | Security: Compliance | 900px | 3s | Device data |
| 11 | Security | Security: Malware | 1100px | 3s | Active threats |
| 12 | Security | Device: Sensor Health | No | 5s | Top section |
| 13 | Security | Device: OS Platforms | 400px | 3s | Distribution |
| 14 | Security | Device: Win Versions | 700px | 3s | Versions |
| 15 | Security | Monthly: Summary | No | 5s | **TEXT EXTRACT** |
| 16 | Security | Monthly: Secure Score | 300px | 3s | Score card |
| 17 | Security | Monthly: Comparison | 500px | 3s | Benchmark |
| 18 | Security | Monthly: Onboarded | 700px | 3s | Device count |
| 19 | Security | Monthly: Threats | 900px | 3s | Protection data |
| 20 | Security | Monthly: Suspicious | 1100px | 3s | Activities |

---

## Execution Order

### Phase 1: Entra Portal (1 screenshot)
```
1. Entra Licenses (Billing > Licenses > All Products)
```

### Phase 2: Vulnerability Management (5 screenshots)
```
2. Dashboard - Exposure Score (top)
3. Dashboard - Exposure Over Time (scroll 300px)
4. Dashboard - Device Score (scroll 500px)
5. Dashboard - Distribution (scroll 700px)
6. Recommendations - Top 10 (new page, no scroll)
```

### Phase 3: Security Reports - General (5 screenshots)
```
7. Detections Blocked (scroll 300px)
8. ASR Rules (scroll 500px)
9. Threat Analytics (scroll 700px)
10. Device Compliance (scroll 900px)
11. Active Malware (scroll 1100px)
```

### Phase 4: Device Health (3 screenshots)
```
12. Sensor Health (top)
13. OS Platforms (scroll 400px)
14. Windows Versions (scroll 700px)
```

### Phase 5: Monthly Security Report (6 sections)
```
15. Summary (TEXT EXTRACTION - no screenshot)
16. Secure Score (scroll 300px)
17. Score Comparison (scroll 500px)
18. Devices Onboarded (scroll 700px)
19. Threat Protection (scroll 900px)
20. Suspicious Activities (scroll 1100px)
```

---

## MCP Commands Quick Reference

### Navigate + Screenshot (No Scroll)
```javascript
await mcp_playwright_browser_navigate({ url: 'https://...' });
await mcp_playwright_browser_wait_for({ time: 5 });
await mcp_playwright_browser_take_screenshot({
  filename: 'path.jpg',
  type: 'jpeg',
  fullPage: true
});
```

### Navigate + Scroll + Screenshot
```javascript
await mcp_playwright_browser_navigate({ url: 'https://...' });
await mcp_playwright_browser_wait_for({ time: 5 });
await mcp_playwright_browser_evaluate({
  function: '() => { window.scrollBy(0, 500); }'
});
await mcp_playwright_browser_wait_for({ time: 3 });
await mcp_playwright_browser_take_screenshot({
  filename: 'path.jpg',
  type: 'jpeg',
  fullPage: false
});
```

### Text Extraction (Monthly Summary)
```javascript
await mcp_playwright_browser_navigate({ url: 'https://security.microsoft.com' });
await mcp_playwright_browser_wait_for({ time: 5 });
const snapshot = await mcp_playwright_browser_snapshot({});
// Extract text from snapshot for direct report inclusion
```

---

## Critical Success Factors

### ✅ Must-Have
1. **Authentication**: User must sign in before any captures
2. **Wait Times**: Allow full page load before actions
3. **Scroll Timing**: Wait 3 seconds after each scroll
4. **Top 10 Focus**: AI must analyze only first 10 vulnerabilities
5. **Text Extraction**: Monthly Summary must be text, not screenshot

### ⚠️ Common Pitfalls
1. Not waiting long enough for dynamic content
2. Scrolling before page fully loads
3. Taking full-page screenshots after scrolling (should be viewport)
4. Missing the text extraction for Monthly Summary
5. Analyzing all vulnerabilities instead of just top 10

### 🎯 Quality Checks
- [ ] All 20 sections captured
- [ ] Images are clear and readable
- [ ] Correct sections are visible in each screenshot
- [ ] Monthly Summary text is extracted
- [ ] Top 10 vulnerabilities are properly identified
- [ ] File names follow naming convention
- [ ] Output directory is properly structured

---

## Scroll Amount Reference

| Scroll Distance | Sections Using This Distance |
|-----------------|------------------------------|
| 0px (no scroll) | 1, 2, 6, 12, 15 |
| 300px | 3, 7, 16 |
| 400px | 13 |
| 500px | 4, 8, 17 |
| 700px | 5, 9, 14, 18 |
| 900px | 10, 19 |
| 1100px | 11, 20 |

---

## Section Naming Convention

```
<portal>_<category>_<subsection>_<timestamp>.jpg
```

Examples:
- `entra_licenses_1696176000000.jpg`
- `vuln_mgmt_top_10_recommendations_1696176000001.jpg`
- `security_reports_detections_blocked_1696176000002.jpg`
- `device_health_sensor_health_1696176000003.jpg`
- `monthly_security_secure_score_1696176000004.jpg`

Special:
- `monthly_security_summary_text.json` (extracted text)

---

## AI Analysis Guidelines

### Section 6: Top 10 Vulnerabilities
```
CRITICAL: Analyze ONLY the first 10 rows in the recommendations table.

For each vulnerability (1-10):
1. Identify the vulnerability name
2. Assess the severity and exposure impact
3. Determine affected devices/assets
4. Provide step-by-step remediation guidance
5. Estimate time/effort required

DO NOT analyze vulnerabilities beyond position 10.
```

### Section 15: Monthly Summary Text
```
USAGE: Embed extracted text directly in report.

Format:
---
Microsoft 365 Monthly Security Summary:
[EXTRACTED TEXT CONTENT]
---

AI Commentary:
[Your analysis of the summary]
```

---

## Troubleshooting Quick Fixes

| Issue | Solution |
|-------|----------|
| Content not visible | Increase wait time from 5s to 10s |
| Wrong section in screenshot | Adjust scroll amount ±100px |
| Blurry screenshots | Use `fullPage: false` after scrolling |
| Missing sections | Check navigation path and wait times |
| Authentication fails | Verify permissions and retry MFA |

---

## Testing One-Liner

```bash
node -e "const s = require('./services/playwright-screenshot-service-mcp.js'); new s().captureAllPortalScreenshots(p => console.log(p)).then(r => console.log(r.instructions.portals.length + ' sections ready'));"
```

Expected output: `20 sections ready`

---

**Quick Start**: Run report generation → Service returns instructions → Execute MCP commands → Verify 20 files created → Check Monthly Summary text extracted → Confirm Top 10 vulnerabilities analyzed

**Last Updated**: October 1, 2025
