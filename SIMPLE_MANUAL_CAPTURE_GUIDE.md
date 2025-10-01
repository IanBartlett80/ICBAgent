# Simple Manual Screenshot Capture - User Guide

## 🎯 Overview

This is the **simplest possible approach** - no browser automation, no overlay injection, just you taking screenshots with Windows Snipping Tool!

## 📋 How It Works

1. **System creates a watch folder**: `C:\Users\YourName\Documents\ICB_Screenshots`
2. **You take screenshots** with Windows Snipping Tool (Win+Shift+S)
3. **You save them** to the watch folder with the right name
4. **System automatically detects** and processes them

## 🚀 Quick Start

### Step 1: Start the Report Generation

1. Click "Generate Monthly Health Report" button
2. Enter customer name
3. System will show: "Waiting for Section 1/20..."

### Step 2: Take Each Screenshot

For each section (20 total):

1. **Read the instructions** shown in the console:
   ```
   📸 Section 1/20: Entra Licenses Overview
      Portal: Entra Admin Center
      Instructions: Entra Admin Center → Billing → Licenses → All Products
      📝 Save as: section_1.png or section_1.jpg
      📁 Location: C:\Users\YourName\Documents\ICB_Screenshots
      ⏳ Waiting for screenshot...
   ```

2. **Navigate to the portal location** in your browser

3. **Take the screenshot**:
   - Press `Win+Shift+S` to open Snipping Tool
   - Drag to select the area you want to capture
   - Screenshot is copied to clipboard

4. **Save the screenshot**:
   - Open File Explorer → `C:\Users\YourName\Documents\ICB_Screenshots`
   - Press `Ctrl+V` to paste
   - Name it: `section_1.png` (or `section_1.jpg`)
   - Click Save

5. **System automatically detects** the file within 2 seconds:
   ```
   ✅ Captured: entra_licenses_1759306273478.jpg
   
   📸 Section 2/20: Vulnerability Management Dashboard
      ...
   ```

6. **Repeat for all 20 sections**

## 📝 File Naming

The system accepts these naming patterns:

- `section_1.png` (recommended)
- `section_1.jpg`
- `Section_1.png` (capital S)
- `1.png` (just the number)

**Important**: Use the section number shown in the console (1-20)

## ⏱️ Timing

- **No rush!** System checks every 2 seconds for new files
- **5 minute timeout** per section (then auto-skips)
- **Take your time** to navigate and capture correctly

## 🎨 What to Capture

Each section has specific instructions:

### Section 1: Entra Licenses Overview
- Portal: Entra Admin Center
- Navigate: Billing → Licenses → All Products
- Capture: Full licenses table

### Section 2: Vulnerability Management Dashboard
- Portal: Microsoft Defender
- Navigate: Vulnerability Management → Dashboard
- Capture: Full dashboard view

### Section 3-20: ...
- Follow the instructions shown in the console for each section

## 🔧 Troubleshooting

### "System not detecting my screenshot"

**Check:**
- Is the file in the right folder? (`C:\Users\YourName\Documents\ICB_Screenshots`)
- Is the filename correct? (e.g., `section_1.png`)
- Wait 2 seconds after saving - system checks periodically

### "I made a mistake"

**Solution:**
- Delete the wrong screenshot from the watch folder
- System will keep waiting for the correct section
- Take a new screenshot with the same section number

### "I want to skip a section"

**Solution:**
- Just wait 5 minutes - system will auto-skip
- Or save a blank/placeholder image with the section name

## 📊 Progress Tracking

The system shows progress in two places:

1. **Backend console** (server terminal):
   ```
   📸 Section 1/20: Entra Licenses Overview
   ✅ Captured: entra_licenses_1759306273478.jpg
   ```

2. **Frontend UI** (browser):
   ```
   Waiting for Section 1/20: Entra Licenses Overview
   Navigate to: Entra Admin Center → Billing → Licenses → All Products
   ```

## ✅ Benefits of This Approach

- ✅ **Simple**: Just use Windows Snipping Tool
- ✅ **Reliable**: No browser automation failures
- ✅ **Flexible**: Capture exactly what you want
- ✅ **No timing issues**: Take as long as you need
- ✅ **Works everywhere**: Any browser, any portal
- ✅ **Full control**: You decide what to capture

## 🎯 Complete Workflow

```
1. Click "Generate Report" → Enter customer name
                                 ↓
2. System creates watch folder: C:\Users\...\ICB_Screenshots
                                 ↓
3. System shows: "Section 1/20: Entra Licenses"
                                 ↓
4. You navigate to Entra Admin Center
                                 ↓
5. You press Win+Shift+S and capture
                                 ↓
6. You save as: section_1.png in watch folder
                                 ↓
7. System detects file (within 2 seconds)
                                 ↓
8. System copies to report folder
                                 ↓
9. System deletes from watch folder
                                 ↓
10. System shows: "Section 2/20: Vulnerability Dashboard"
                                 ↓
11. Repeat steps 4-10 for all 20 sections
                                 ↓
12. System analyzes with AI
                                 ↓
13. System generates Word document
                                 ↓
14. Done! ✅
```

## 📂 File Locations

### Watch Folder (temporary):
```
C:\Users\YourName\Documents\ICB_Screenshots\
```
Files here are automatically deleted after processing

### Final Report Location:
```
C:\ICBAgent\Monthly Reports\<Customer Name>\
```
Final Word document is saved here permanently

## 🎓 Tips

1. **Keep File Explorer open** to the watch folder for quick saving
2. **Use keyboard shortcut** Win+Shift+S instead of opening Snipping Tool app
3. **Check the console** for exact section instructions before capturing
4. **Take full screenshots** - capture more rather than less
5. **Don't worry about mistakes** - system validates and you can retake

## 🚨 Important Notes

- **Section numbers matter**: Save as `section_1.png`, not `section_01.png` or `section1.png`
- **File format**: PNG or JPG/JPEG only
- **One at a time**: System waits for section 1 before asking for section 2
- **Sequential order**: Must capture sections in order (1, 2, 3...)

## 🎉 Success Criteria

You'll know it's working when you see:

```
✅ Captured: entra_licenses_1759306273478.jpg

📸 Section 2/20: Vulnerability Management Dashboard
   Portal: Microsoft Defender
   Instructions: Defender → Vulnerability Management → Dashboard
   📝 Save as: section_2.png
   ⏳ Waiting for screenshot...
```

## 📞 Support

If you encounter issues:

1. Check the server console for error messages
2. Verify watch folder path is correct
3. Ensure you have write permissions to Documents folder
4. Try saving to desktop first, then moving to watch folder

---

**That's it!** This is the simplest, most reliable way to capture the 20 required screenshots. No complex automation, no overlay issues - just you, Windows Snipping Tool, and a folder watch system. 🎯
