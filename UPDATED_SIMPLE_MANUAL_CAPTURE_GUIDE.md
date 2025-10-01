# Simple Manual Screenshot Capture - Updated User Guide

## 🎯 Overview

The **simplest possible approach** - no Playwright, just:
1. System opens a browser tab for M365 authentication
2. You sign in to the customer's tenant
3. You take screenshots with Windows Snipping Tool
4. System automatically detects and processes them

## 🚀 Complete Workflow

### Step 1: Start Report Generation

1. Click "Generate Monthly Health Report" button
2. Enter customer name
3. Click "Generate Report"

### Step 2: Authenticate (Manual Incognito)

System will:
- Show modal: "Customer Tenant Authentication Required"
- Display instructions to open incognito/InPrivate window
- Provide URL to copy: `https://login.microsoftonline.com`

You:
1. **Open Incognito/InPrivate window**:
   - **Chrome/Edge**: Press `Ctrl+Shift+N`
   - **Firefox**: Press `Ctrl+Shift+P`
   
2. **Copy the URL** from the modal (click to copy)

3. **Paste in incognito window** and press Enter

4. **Sign in to the CUSTOMER'S Microsoft 365 tenant**
   - Use customer's admin credentials (e.g., `admin@customer.onmicrosoft.com`)
   - NOT your own credentials
   - Complete MFA if required

5. **Click "I've Opened Incognito and Signed In"** in the modal

6. **Keep incognito window open** - you'll use it for all 20 screenshots

**Why Incognito?**
- Prevents using your current session's access token
- Ensures you authenticate to the CUSTOMER's tenant
- Avoids mixing your credentials with customer's
- Clean authentication session

### Step 3: Capture Screenshots

System shows console instructions:
```
📸 Section 1/20: Entra Licenses Overview
   Portal: Entra Admin Center
   Instructions: Entra Admin Center → Billing → Licenses → All Products
   📝 Save as: section_1.png
   📁 Location: C:\Users\YourName\Documents\ICB_Screenshots
   ⏳ Waiting for screenshot...
```

For each section:

1. **Navigate in the authenticated tab**:
   - Use the tab where you signed in
   - Navigate to the portal location shown in instructions
   - Example: `https://entra.microsoft.com` → Billing → Licenses → All Products

2. **Capture the screenshot**:
   - Press `Win+Shift+S` (Windows Snipping Tool)
   - Drag to select the area you want to capture
   - Screenshot copies to clipboard automatically

3. **Save to watch folder**:
   - Open File Explorer: `C:\Users\YourName\Documents\ICB_Screenshots`
   - Press `Ctrl+V` to paste
   - Name it: `section_1.png` (match the section number)
   - Click Save

4. **System auto-detects** (within 2 seconds):
   ```
   ✅ Captured: entra_licenses_1759306273478.jpg
   
   📸 Section 2/20: Vulnerability Management Dashboard
      ...
   ```

5. **Repeat for all 20 sections**

## 🗺️ Portal Navigation Reference

Stay in your **authenticated browser tab** and navigate to these portals:

### Sections 1: Entra Admin Center
- URL: `https://entra.microsoft.com`
- Navigate: Billing → Licenses → All Products

### Sections 2-10: Microsoft Defender
- URL: `https://security.microsoft.com`
- Various dashboards and reports

### Sections 11-13: Intune Admin Center  
- URL: `https://intune.microsoft.com`
- Device management and compliance

### Sections 14-19: Back to Microsoft Defender
- URL: `https://security.microsoft.com`
- Monthly security reports

### Section 20: Back to Entra
- URL: `https://entra.microsoft.com`
- Conditional Access policies

## 📝 File Naming Patterns

The system accepts these naming patterns:

✅ `section_1.png` (recommended)  
✅ `section_1.jpg`  
✅ `Section_1.png` (capital S)  
✅ `1.png` (just the number)

❌ `section_01.png` (no leading zeros)  
❌ `section1.png` (no underscore)  
❌ `screenshot_1.png` (wrong prefix)

## ⏱️ Timing

- **30 seconds** given for authentication (then auto-continues)
- **5 minute timeout** per screenshot (then auto-skips)
- System checks for new files **every 2 seconds**
- Take your time to navigate correctly

## 📂 File Locations

### Watch Folder (temporary):
```
C:\Users\YourName\Documents\ICB_Screenshots\
```
Screenshots saved here are automatically:
- Detected by system
- Copied to report folder
- Deleted from watch folder

### Final Report Location:
```
C:\ICBAgent\Monthly Reports\<Customer Name>\
```
Final Word document saved here permanently

## 🎓 Pro Tips

1. **Keep authentication tab open** - Use it for all 20 sections
2. **Keep File Explorer open** to watch folder for quick saving
3. **Use Win+Shift+S** - Faster than opening Snipping Tool app
4. **Check console first** - Read exact instructions before capturing
5. **Capture more rather than less** - Include full context
6. **Stay authenticated** - Don't sign out until all 20 sections done

## 🔧 Troubleshooting

### "Authentication tab didn't open"

**Check:**
- Does your browser block popups? Allow popups for this site
- Try manually opening: `https://login.microsoftonline.com`
- Sign in to customer tenant manually

### "System not detecting my screenshot"

**Check:**
- Correct folder? `C:\Users\...\Documents\ICB_Screenshots`
- Correct filename? `section_1.png` (not `section_01.png`)
- Wait 2 seconds after saving - system checks periodically

### "I'm not authenticated to the customer tenant"

**Solution:**
- Open new tab: `https://portal.azure.com`
- Sign out if needed
- Sign back in with customer credentials
- Look for customer tenant name in top-right corner

### "Screenshot shows wrong tenant"

**Problem:**
- You're authenticated to YOUR tenant, not customer's

**Solution:**
- Sign out of all Microsoft accounts
- Clear browser cookies/cache
- Restart browser
- Sign in to customer tenant only

## 🎯 Complete Step-by-Step Example

```
1. Click "Generate Report"
   → Modal opens

2. Enter "SylviaP Sportswear" as customer name
   → Click "Generate Report"

3. System shows modal: "Customer Tenant Authentication Required"
   → Instructions displayed

4. You press Ctrl+Shift+N (Chrome/Edge)
   → Incognito window opens

5. You copy URL from modal (click to copy)
   → https://login.microsoftonline.com copied

6. You paste in incognito window and press Enter
   → Microsoft login page loads

7. You sign in with customer credentials
   → admin@sylviapsportswear.onmicrosoft.com
   → Complete MFA
   → Redirected to portal.azure.com

8. You click "I've Opened Incognito and Signed In" in modal
   → Modal closes

9. System shows: "Section 1/20: Entra Licenses"
   → Console shows detailed instructions

10. In incognito window, navigate to:
    → https://entra.microsoft.com
    → Billing → Licenses → All Products

7. Press Win+Shift+S
   → Drag to select licenses table
   → Screenshot copied to clipboard

8. Open File Explorer:
   → C:\Users\Ian\Documents\ICB_Screenshots

9. Press Ctrl+V
   → Image appears
   → Rename to: section_1.png
   → Click Save

10. Within 2 seconds:
    ✅ Captured: entra_licenses_1759313535254.jpg
    
    📸 Section 2/20: Vulnerability Management Dashboard
    
11. Navigate to: https://security.microsoft.com
    → Vulnerability Management → Dashboard

12. Repeat Win+Shift+S → Save as section_2.png

... continue for all 20 sections ...

20. Final section captured
    → System analyzes with AI
    → Generates Word document
    → Saves to: C:\ICBAgent\Monthly Reports\SylviaP Sportswear\
    ✅ Done!
```

## ✅ Benefits of This Approach

- ✅ **Simple authentication**: Just opens login.microsoftonline.com
- ✅ **No Playwright needed**: Uses your regular browser
- ✅ **Stay authenticated**: One login for all 20 sections
- ✅ **Familiar tools**: Windows Snipping Tool you already know
- ✅ **Reliable detection**: Simple file system watching
- ✅ **Full control**: You decide what to capture
- ✅ **Works anywhere**: Any browser, any portal
- ✅ **No timing issues**: Take as long as you need

## 🎉 Success Indicators

You'll know it's working when:

```
✅ Step 1: "Opening Microsoft login - please authenticate..."
✅ Step 2: New tab opens to login.microsoftonline.com
✅ Step 3: You sign in to customer tenant
✅ Step 4: "Section 1/20: Entra Licenses Overview"
✅ Step 5: You save section_1.png
✅ Step 6: "✅ Captured: entra_licenses_..."
✅ Step 7: "Section 2/20: Vulnerability Management..."
```

## 📊 Progress Tracking

- **Frontend UI**: Shows progress bar and current step
- **Backend Console**: Shows detailed section-by-section progress
- **Watch Folder**: Screenshots appear then disappear as processed

## 🚨 Important Notes

- **One authentication** for all 20 sections
- **Sequential order** required (must do 1, then 2, then 3...)
- **Section numbers matter** in filenames
- **Keep browser open** until all sections captured
- **Don't sign out** until report is complete

---

**This is the simplest, most reliable way to generate health reports!** 🎯

No Playwright complexity, just:
1. System opens login tab
2. You sign in once
3. You take 20 screenshots
4. System does the rest
