# Word Template Quick Reference

## 📋 Report Structure

```
┌─────────────────────────────────────────────┐
│ 1. COVER PAGE                               │
│    • ICB Logo (80x80px)                     │
│    • Report Title                           │
│    • Customer Name                          │
│    • Date & Confidentiality Notice          │
└─────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────┐
│ 2. TABLE OF CONTENTS                        │
│    • Auto-generated with hyperlinks         │
└─────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────┐
│ 3. EXECUTIVE SUMMARY                        │
│    • Overall health assessment              │
│    • Written in MSP monthly update tone     │
│    • Business-focused insights              │
└─────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────┐
│ 4. IDENTITY STATUS                          │
│    ├─ Screenshot (I_*.png) - Centered       │
│    ├─ Comments (Detailed paragraph)         │
│    ├─ Screenshot (I_*.png) - Centered       │
│    ├─ Comments (Detailed paragraph)         │
│    └─ ICB Solutions Priority Areas          │
│       • 3-5 top priorities with rationale   │
└─────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────┐
│ 5. SECURITY STATUS                          │
│    ├─ Screenshot (S_*.png) - Centered       │
│    ├─ Comments (Detailed paragraph)         │
│    ├─ Screenshot (S_*.png) - Centered       │
│    ├─ Comments (Detailed paragraph)         │
│    └─ ICB Solutions Priority Areas          │
│       • 3-5 top priorities with rationale   │
└─────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────┐
│ 6. ENDPOINT STATUS                          │
│    ├─ Screenshot (E_*.png) - Centered       │
│    ├─ Comments (Detailed paragraph)         │
│    ├─ Screenshot (E_*.png) - Centered       │
│    ├─ Comments (Detailed paragraph)         │
│    └─ ICB Solutions Priority Areas          │
│       • 3-5 top priorities with rationale   │
└─────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────┐
│ 7. ICB SOLUTIONS CALL TO ACTIONS            │
│    ├─ Monthly Summary                       │
│    ├─ Next Month Priorities:                │
│    │   • Identity & Access (Top 3)          │
│    │   • Security Posture (Top 3)           │
│    │   • Endpoint Management (Top 3)        │
│    └─ ICB Solutions Commitment              │
└─────────────────────────────────────────────┘
```

---

## 🏷️ Screenshot Naming Convention

| First Letter | Section | Example Filenames |
|--------------|---------|-------------------|
| **I** | Identity Status | `I_licenses.png`<br>`I_users.png`<br>`I_mfa.png` |
| **S** | Security Status | `S_summary.png`<br>`S_incidents.png`<br>`S_alerts.png` |
| **E** | Endpoint Status | `E_devices.png`<br>`E_compliance.png`<br>`E_health.png` |

---

## 📝 Writing Style Rules

### Use MSP Monthly Update Tone

✅ **DO:**
- Use "we" for ICB Solutions
- Use "you/your" for the client
- Start with "This month, we..."
- Explain business impact
- Be specific with metrics

❌ **DON'T:**
- Use passive voice
- Use technical jargon without explanation
- Make vague statements
- Skip the rationale

### Examples

#### ✅ Good Comments Section:
```
This month, we reviewed your license allocation and identified 
that 15% of your Microsoft 365 licenses remain unassigned. This 
represents approximately $3,000 in underutilized resources annually. 
We also observed that your Teams usage has increased by 20%, 
indicating strong adoption of collaboration tools. However, several 
Power BI Pro licenses are assigned to users who haven't logged in 
for over 90 days, suggesting an opportunity for reallocation.
```

#### ✅ Good Priority with Rationale:
```
1. [High Priority] Implement Multi-Factor Authentication for all 
   admin accounts
   
   Estimated Effort: 2-3 hours
   
   This priority has been identified as critical to improving your 
   overall identity posture and reducing potential risks to your 
   organization. Admin accounts without MFA present a significant 
   security vulnerability that could lead to unauthorized access and 
   data breaches. Recent industry trends show that 80% of breaches 
   involve compromised credentials, making MFA implementation one of 
   the most effective security controls available.
```

---

## 🎨 Visual Elements

### Logo
- Size: 80×80 pixels
- Position: Centered on cover page
- Aspect ratio: 1:1 (maintained)

### Screenshots
- All centered on page
- No captions/titles
- Dimensions: 600×400 pixels
- Spacing: 200px before, 300px after

### Priority Badges
- High Priority: Red (`#ef4444`)
- Medium Priority: Orange (`#f59e0b`)
- Low Priority: Green (`#10b981`)

---

## 📊 Content Structure

### Comments Section (Per Screenshot)
```
┌─────────────────────────────────────────┐
│ Comments                          [H3]  │
├─────────────────────────────────────────┤
│ [150-200 word paragraph]                │
│ • Summarizes metrics                    │
│ • Explains business impact              │
│ • Uses MSP tone                         │
│ • Identifies observations               │
└─────────────────────────────────────────┘
```

### Priority Areas Subsection (Per Section)
```
┌─────────────────────────────────────────┐
│ ICB Solutions Priority Areas      [H2] │
├─────────────────────────────────────────┤
│ [Introduction paragraph in MSP tone]    │
│                                         │
│ 1. [High] Action item                   │
│    Estimated Effort: X hours            │
│    Rationale paragraph...               │
│                                         │
│ 2. [Medium] Action item                 │
│    Estimated Effort: X days             │
│    Rationale paragraph...               │
│                                         │
│ 3-5 additional priorities...            │
└─────────────────────────────────────────┘
```

### Call to Actions Section
```
┌─────────────────────────────────────────┐
│ ICB Solutions Call to Actions     [H1] │
├─────────────────────────────────────────┤
│ Monthly Summary                   [H2] │
│ [Paragraph overview]                    │
│ [Executive summary text]                │
│                                         │
│ Next Month Priorities             [H2] │
│                                         │
│ Identity & Access Management      [H3] │
│ • [High] Top priority 1                 │
│ • [High] Top priority 2                 │
│ • [Medium] Top priority 3               │
│                                         │
│ Security Posture                  [H3] │
│ • [High] Top priority 1                 │
│ • [High] Top priority 2                 │
│ • [Medium] Top priority 3               │
│                                         │
│ Endpoint Management               [H3] │
│ • [High] Top priority 1                 │
│ • [Medium] Top priority 2               │
│ • [Low] Top priority 3                  │
│                                         │
│ ICB Solutions Commitment          [H3] │
│ [Closing partnership statement]         │
└─────────────────────────────────────────┘
```

---

## ⚙️ Technical Details

### Categorization Logic
```javascript
// Extracts first letter of filename
const filename = path.basename(screenshot.name);
const firstLetter = filename.charAt(0).toUpperCase();

if (firstLetter === 'I') → Identity section
if (firstLetter === 'S') → Security section
if (firstLetter === 'E') → Endpoint section
```

### Priority Sorting
```javascript
// Priorities sorted by importance
High > Medium > Low

// Within same priority level, maintains original order
```

### Recommendation Data Structure
```javascript
{
  action: "Clear action description",
  priority: "High" | "Medium" | "Low",
  timeEstimate: "2-3 hours",
  rationale: "Detailed explanation of business impact..."
}
```

---

## 🔍 Quality Checklist

Before generating a report, ensure:

- [ ] All screenshots follow I/S/E naming convention
- [ ] Logo file exists at `/public/images/icblogo.jpg`
- [ ] Customer name is provided
- [ ] OpenAI API key is configured
- [ ] Output directory is writable

After generating a report, verify:

- [ ] All sections are present
- [ ] Screenshots are categorized correctly
- [ ] Images are centered without titles
- [ ] Comments sections contain detailed analysis
- [ ] Priority areas have 3-5 items with rationale
- [ ] Call to actions shows top 9 priorities (3 per category)
- [ ] MSP tone is used throughout
- [ ] Logo is properly sized
- [ ] Page numbers are correct
- [ ] TOC links work properly

---

## 🚨 Common Issues & Solutions

### Issue: Screenshot not appearing in report
**Solution**: Check filename starts with I, S, or E (case-sensitive on first letter)

### Issue: Priority areas showing too few items
**Solution**: Ensure OpenAI is generating 3-5 recommendations per section

### Issue: Rationale text missing
**Solution**: Check OpenAI response parsing for "Rationale:" keyword

### Issue: MSP tone not evident
**Solution**: Verify OpenAI system prompts are updated with MSP instructions

### Issue: Logo too large/small
**Solution**: Confirm logo dimensions are set to 80x80 pixels

### Issue: Images not centered
**Solution**: Check AlignmentType.CENTER is applied to image paragraphs

---

## 📞 Support

For technical issues or questions:
- Review: `/workspaces/ICBAgent/WORD_TEMPLATE_UPDATE_SUMMARY.md`
- Check: `/workspaces/ICBAgent/services/word-document-generator.js`
- OpenAI config: `/workspaces/ICBAgent/services/openai-analysis-service.js`

---

**Quick Reference v2.0 - October 2025**
