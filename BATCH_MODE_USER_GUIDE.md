# Batch Mode Screenshot Processing - User Guide

## 🎯 What Changed

**OLD (Sequential Mode):**
- System waits for `section_1.png`
- Then waits for `section_2.png`
- Then waits for `section_3.png`
- One at a time, must be sequential

**NEW (Batch Mode):**
- Capture ALL screenshots with ANY names ✅
- Save them all to the watch folder
- Click "Process Screenshots" button when done
- System processes everything at once ✅

## 🚀 How to Use Batch Mode

### Step 1: Start Report Generation
1. Click "Generate Monthly Health Report"
2. Enter customer name
3. Authentication modal appears
4. Open incognito window, sign in to customer tenant
5. Click "I've Opened Incognito and Signed In"

### Step 2: Floating Button Appears
A button will appear in the **bottom-right corner** of your screen:

```
┌──────────────────────────────────────┐
│ 📸 Screenshot Capture                │
│                                      │
│ Save your screenshots to:            │
│ C:\Users\...\ICB_Screenshots         │
│                                      │
│ 0 screenshot(s) ready                │
│                                      │
│ ┌──────────────────────────────────┐ │
│ │   🚀 Process Screenshots         │ │
│ └──────────────────────────────────┘ │
│                                      │
│ Click when you've captured all       │
│ screenshots                          │
└──────────────────────────────────────┘
```

### Step 3: Capture Your Screenshots

In your **incognito window** where you're signed into customer tenant:

1. Navigate to Entra Admin Center → Licenses
2. Press `Win+Shift+S` to capture
3. Save as: `entra_licenses.png` (or any name you want!)
4. Go to `C:\Users\...\Documents\ICB_Screenshots`
5. Paste and save

Button updates: **"1 screenshot(s) ready"** ✅

6. Navigate to Defender → Vulnerability Dashboard
7. Press `Win+Shift+S` to capture
8. Save as: `vuln_dashboard.jpg` (any name!)
9. Save to watch folder

Button updates: **"2 screenshot(s) ready"** ✅

10. Continue for all sections you want to capture
11. Button keeps updating with count

### Step 4: Process When Ready

When you've captured all screenshots (e.g., 12 total):

- Button shows: **"12 screenshot(s) ready"** 
- Click **"🚀 Process Screenshots"** button
- Button disappears
- System processes all 12 images at once ✅

### Step 5: System Processing

Backend console shows:
```
🔄 Processing all screenshots in batch mode...

📸 Found 12 image files to process
   ✅ Processed: entra_licenses.png → screenshot_1_1759... (45.23 KB)
   ✅ Processed: vuln_dashboard.jpg → screenshot_2_1759... (52.18 KB)
   ✅ Processed: defender_alerts.png → screenshot_3_1759... (38.91 KB)
   ✅ Processed: intune_devices.jpg → screenshot_4_1759... (41.55 KB)
   ... (all 12 files)

✅ Batch processing complete: 12 screenshots processed

🤖 Analyzing data with AI...
📄 Generating Word document...
✅ Report generation complete!
```

## 📝 File Naming

**Completely flexible now!** Any names work:

✅ `entra_licenses.png`  
✅ `Screenshot 2025-01-30 at 3.45 PM.png`  
✅ `vuln.jpg`  
✅ `1.png`  
✅ `defender_screenshot.jpeg`  
✅ `my_capture_image.png`  

System will rename them to:
- `screenshot_1_[timestamp].jpg`
- `screenshot_2_[timestamp].jpg`
- `screenshot_3_[timestamp].jpg`
- etc.

## 🎨 Button Features

### Live Count Updates
- Updates **every 2 seconds**
- Shows exact number of images in watch folder
- Green color when images detected
- Button always visible until clicked

### Visual Feedback
- Floating button (doesn't block UI)
- Bottom-right corner
- Hover effect (darker green)
- Click removes button instantly

### Watch Folder Path
- Shows exact path in button
- Click to copy (future enhancement)
- Easy to verify location

## ✅ Benefits

### Flexible Workflow
- ✅ Capture in any order
- ✅ Use any filenames
- ✅ Add more anytime before clicking
- ✅ Delete unwanted before clicking

### Visual Feedback
- ✅ See count update in real-time
- ✅ Know exactly how many ready
- ✅ Button shows path clearly
- ✅ Clear call-to-action

### Batch Processing
- ✅ All images processed at once
- ✅ No waiting between captures
- ✅ Faster overall workflow
- ✅ More efficient

## 🔄 Workflow Comparison

### OLD (Sequential):
```
1. System: "Waiting for section_1.png"
2. User captures and saves section_1.png
3. System: "Waiting for section_2.png"
4. User captures and saves section_2.png
5. System: "Waiting for section_3.png"
6. ... repeat 20 times
```
⏱️ **Time**: ~15-20 minutes (waiting between each)

### NEW (Batch):
```
1. Button appears
2. User captures ALL screenshots (any names)
3. User saves all to watch folder
4. Button shows "12 ready"
5. User clicks "Process Screenshots"
6. System processes all at once
```
⏱️ **Time**: ~5-10 minutes (no waiting)

## 🎯 Your Current Situation

You already have **12 images** saved in the watch folder!

**What to do:**

1. **On your Windows machine**:
   ```bash
   cd C:\ICBAgent\ICBAgent-main
   git pull origin main
   ```

2. **Restart server**:
   ```bash
   node server.js
   ```

3. **Start new report**:
   - Click "Generate Monthly Health Report"
   - Enter customer name
   - Complete authentication
   - Button appears

4. **Your 12 images are already there!**
   - Button immediately shows: **"12 screenshot(s) ready"** ✅
   - Click **"Process Screenshots"**
   - Done! ✅

## 🔧 Troubleshooting

### Button doesn't appear
- Check backend console for "showProcessButton" action
- Refresh page and try again
- Ensure report generation started

### Count shows 0 but I have images
- Check folder path matches button display
- Ensure files are .png, .jpg, or .jpeg
- Wait 2 seconds (updates every 2s)

### Button disappears before I click
- Shouldn't happen, button stays until clicked
- If it does, restart report generation

### Images not processing
- Check backend console for errors
- Ensure watch folder permissions
- Try with smaller image files first

## 📊 Success Indicators

You'll know it's working when:

1. ✅ Button appears after authentication
2. ✅ Count updates to show your images
3. ✅ Click button makes it disappear
4. ✅ Backend console shows processing
5. ✅ Progress bar continues to AI analysis
6. ✅ Word document generated

---

**This batch mode makes screenshot capture much faster and more flexible!** 🎯

Your 12 existing screenshots will be processed as soon as you click the button!
