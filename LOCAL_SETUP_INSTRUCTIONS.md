# ICB Agent - Local Setup Instructions for Windows

**Complete step-by-step guide to run ICB Agent on your local Windows machine**

---

## 📋 Prerequisites

Before you begin, you'll need:
- Windows 10 or Windows 11
- Internet connection
- Administrator access (for installing software)
- Approximately 500 MB free disk space

---

## Step 1: Install Node.js

Node.js is required to run the ICB Agent server.

### Download Node.js

1. **Open your web browser** and go to: https://nodejs.org/
2. **Download the LTS (Long Term Support) version**
   - Click the big green button that says "Download Node.js (LTS)"
   - This will download a file like `node-v20.x.x-x64.msi`
3. **Run the installer**
   - Double-click the downloaded `.msi` file
   - Click "Next" through the installation wizard
   - Accept the license agreement
   - Keep all default options selected
   - Click "Install"
   - Click "Finish"

### Verify Node.js Installation

1. **Open PowerShell**
   - Press `Win + X` and select "Windows PowerShell" or "Terminal"
   - Or search for "PowerShell" in the Start menu

2. **Check Node.js version:**
   ```powershell
   node --version
   ```
   You should see something like: `v20.11.0`

3. **Check npm (Node Package Manager) version:**
   ```powershell
   npm --version
   ```
   You should see something like: `10.2.4`

✅ **If both commands show version numbers, Node.js is installed correctly!**

---

## Step 2: Download ICB Agent from GitHub

You have two options to download the project:

### Option A: Download as ZIP (Easier - No Git Required)

1. **Open your web browser** and go to: https://github.com/IanBartlett80/ICBAgent

2. **Click the green "Code" button** (top right of the file list)

3. **Click "Download ZIP"**

4. **Save the file** to a location you'll remember, such as:
   - `C:\Users\YourUsername\Downloads\ICBAgent-main.zip`

5. **Extract the ZIP file:**
   - Right-click the downloaded ZIP file
   - Select "Extract All..."
   - Choose a destination folder, such as:
     - `C:\Users\YourUsername\Documents\ICBAgent`
   - Click "Extract"

6. **Rename the folder** (if needed):
   - The extracted folder will be named `ICBAgent-main`
   - Rename it to just `ICBAgent` for simplicity

### Option B: Clone with Git (Recommended for Updates)

**If you have Git installed:**

1. **Open PowerShell**

2. **Navigate to where you want the project:**
   ```powershell
   cd C:\Users\YourUsername\Documents
   ```

3. **Clone the repository:**
   ```powershell
   git clone https://github.com/IanBartlett80/ICBAgent.git
   ```

4. **Navigate into the folder:**
   ```powershell
   cd ICBAgent
   ```

**Don't have Git?** Download from: https://git-scm.com/download/win

---

## Step 3: Install Project Dependencies

Now that you have the ICB Agent files, you need to install the required packages.

1. **Open PowerShell**

2. **Navigate to the ICBAgent folder:**
   ```powershell
   cd C:\Users\YourUsername\Documents\ICBAgent
   ```
   *(Adjust the path to match where you extracted/cloned the project)*

3. **Install all dependencies:**
   ```powershell
   npm install
   ```
   
   This will take 1-3 minutes. You'll see a progress bar and package names scrolling by.
   
   When complete, you should see:
   ```
   added XXX packages, and audited XXX packages in XXs
   
   found 0 vulnerabilities
   ```

4. **Install Playwright browser:**
   ```powershell
   npx playwright install chromium
   ```
   
   This will download the Chromium browser (about 170 MB) used for automated screenshots.
   
   You'll see:
   ```
   Downloading Chromium...
   Chromium downloaded successfully
   ```

✅ **Dependencies are now installed!**

---

## Step 4: Configure Environment Variables

The ICB Agent needs an OpenAI API key for AI-powered analysis.

### Get Your OpenAI API Key

1. **Go to:** https://platform.openai.com/api-keys
2. **Sign in** to your OpenAI account (or create one if needed)
3. **Click "Create new secret key"**
4. **Copy the key** (it starts with `sk-proj-...`)
5. **Save it somewhere safe** - you'll need it in the next step

### Create .env File

1. **In PowerShell, make sure you're in the ICBAgent folder:**
   ```powershell
   cd C:\Users\YourUsername\Documents\ICBAgent
   ```

2. **Copy the example environment file:**
   ```powershell
   copy .env.example .env
   ```

3. **Edit the .env file:**
   ```powershell
   notepad .env
   ```

4. **Add your OpenAI API key:**
   
   Find this line:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```
   
   Replace `your_openai_api_key_here` with your actual API key:
   ```
   OPENAI_API_KEY=sk-proj-YOUR_ACTUAL_KEY_HERE
   ```

5. **Save and close Notepad:**
   - Click File → Save (or press Ctrl+S)
   - Close Notepad

✅ **Environment configured!**

---

## Step 5: Start the Server

Now you're ready to run ICB Agent!

1. **In PowerShell, in the ICBAgent folder, run:**
   ```powershell
   node server.js
   ```

2. **You should see:**
   ```
   📊 Intelligent Health Report Service initialized
   Starting server initialization...
   ICB Agent Server running on http://0.0.0.0:3000
   Environment: development
   Server accessible at: http://localhost:3000
   Process ID: XXXXX
   Server should be listening now...
   ```

3. **If you see "Error: listen EADDRINUSE":**
   
   This means port 3000 is already in use. Fix it:
   
   ```powershell
   # Stop any existing Node processes
   Get-Process -Name node | Stop-Process -Force
   
   # Try again
   node server.js
   ```

✅ **Server is running!**

---

## Step 6: Access ICB Agent in Your Browser

1. **Open your web browser** (Chrome, Edge, or Firefox)

2. **Go to:** http://localhost:3000

3. **You should see the ICB Agent home page** with:
   - ICB Solutions logo
   - "Welcome to ICB Agent" heading
   - Connection status card
   - Feature cards (AI Chat, Zero Trust Assessment, etc.)

✅ **ICB Agent is now running locally!**

---

## Step 7: Sign In with Your Microsoft Account

To use the Intelligent Health Reports and other features:

1. **Click the "Sign In" button** in the top right

2. **Sign in with your @icb.solutions account**
   - Enter your Microsoft work email
   - Complete multi-factor authentication if prompted

3. **Grant permissions** when prompted

4. **You're signed in!** Your name will appear in the header

---

## Step 8: Test Intelligent Health Reports

1. **Click the "Intelligent Health Reports" feature card**

2. **Click "Start Report Generation"**

3. **A Chromium browser window will open**
   - This is the automation browser for capturing screenshots
   - Sign in with a customer tenant's admin credentials
   - Complete MFA if required

4. **Watch the automation:**
   - Browser navigates to different Microsoft portals
   - Screenshots are captured automatically
   - Progress updates show in the modal

5. **Wait for completion** (3-5 minutes total):
   - ✅ Authentication
   - ✅ Screenshot capture (4 portals)
   - ✅ AI analysis
   - ✅ Word document generation
   - ✅ SharePoint upload (if configured)

6. **Download your report!**

---

## 🛑 How to Stop the Server

**When you want to stop the server:**

1. **Go to the PowerShell window** where `node server.js` is running

2. **Press `Ctrl + C`**

3. **Confirm** if prompted (press `Y` and Enter)

4. **Server will stop** and you'll return to the command prompt

---

## 🔄 Starting the Server Again

**Each time you want to use ICB Agent:**

1. **Open PowerShell**

2. **Navigate to ICBAgent folder:**
   ```powershell
   cd C:\Users\YourUsername\Documents\ICBAgent
   ```

3. **Start the server:**
   ```powershell
   node server.js
   ```

4. **Open browser to:** http://localhost:3000

---

## 🚀 Optional: Create a Desktop Shortcut

**Make it easier to start ICB Agent:**

### Create Start Script

1. **In the ICBAgent folder, create a new file** named `start-icb-agent.bat`

2. **Right-click in the folder** → New → Text Document

3. **Rename it** from `New Text Document.txt` to `start-icb-agent.bat`
   - Make sure to change the extension from `.txt` to `.bat`

4. **Right-click the .bat file** → Edit

5. **Add these lines:**
   ```batch
   @echo off
   echo Starting ICB Agent...
   cd /d %~dp0
   start http://localhost:3000
   node server.js
   pause
   ```

6. **Save and close**

### Create Desktop Shortcut

1. **Right-click `start-icb-agent.bat`**

2. **Select "Create shortcut"**

3. **Drag the shortcut** to your Desktop

4. **Double-click the desktop shortcut** to start ICB Agent
   - Server will start automatically
   - Browser will open to http://localhost:3000

---

## 🔧 Troubleshooting

### Problem: "node is not recognized as an internal or external command"

**Solution:** Node.js is not installed or not in PATH
```powershell
# Verify Node.js is installed
node --version

# If not found, reinstall Node.js from https://nodejs.org/
# Make sure to check "Add to PATH" during installation
```

### Problem: "Cannot find module 'express'"

**Solution:** Dependencies not installed
```powershell
cd C:\Users\YourUsername\Documents\ICBAgent
npm install
```

### Problem: "Error: listen EADDRINUSE :::3000"

**Solution:** Port 3000 is already in use
```powershell
# Option 1: Stop the existing process
Get-Process -Name node | Stop-Process -Force
node server.js

# Option 2: Use a different port
$env:PORT=3001
node server.js
# Then access at: http://localhost:3001
```

### Problem: Browser says "Can't reach this page" or "Connection refused"

**Solution:** Check if server is actually running

1. **Look at PowerShell window** - should say "Server should be listening now..."
2. **Try different URLs:**
   - http://localhost:3000
   - http://127.0.0.1:3000
3. **Check firewall:**
   - Windows Security → Firewall → Allow an app
   - Find Node.js and check both Private and Public
4. **Restart server:**
   - Press Ctrl+C to stop
   - Run `node server.js` again

### Problem: "OpenAI API key is required" error

**Solution:** .env file not configured correctly
```powershell
# Edit the .env file
notepad .env

# Make sure you have this line with your actual key:
OPENAI_API_KEY=sk-proj-YOUR_ACTUAL_KEY_HERE

# Save and restart server
```

### Problem: Playwright browser won't open

**Solution:** Playwright not installed
```powershell
npx playwright install chromium

# If that doesn't work, reinstall Playwright
npm uninstall playwright
npm install playwright
npx playwright install chromium
```

### Problem: Screenshots are blank or pages won't load

**Solution:** Authentication issues or internet connectivity

1. **Check internet connection**
2. **Sign in manually** in the Playwright browser window
3. **Complete MFA** if required
4. **Wait longer** - Azure portals can be slow to load

---

## 📁 File Structure

After setup, your ICBAgent folder should look like this:

```
ICBAgent/
├── node_modules/          (installed packages - don't edit)
├── public/
│   ├── css/
│   ├── js/
│   ├── images/
│   └── index.html
├── services/
│   ├── intelligent-health-report-service.js
│   ├── playwright-screenshot-service-local.js
│   ├── openai-analysis-service.js
│   ├── word-document-generator.js
│   └── sharepoint-upload-service.js
├── .env                   (your API keys - DO NOT SHARE)
├── .env.example           (template)
├── package.json
├── server.js
└── README.md
```

---

## 🔐 Security Notes

### Keep These Files Private

**NEVER share or commit to GitHub:**
- `.env` file (contains your API keys)
- Any files in `/tmp/health-reports/` (customer data)

### Protect Your API Keys

- OpenAI API key has usage costs - keep it secure
- Don't share your `.env` file
- Don't commit `.env` to version control (it's in `.gitignore`)

---

## 🆘 Getting Help

### Check the Documentation

- **DEPLOYMENT_GUIDE.md** - Detailed deployment options
- **AUTOMATION_COMPLETE_SUMMARY.md** - Feature overview
- **SCREENSHOT_COMPARISON_GUIDE.md** - What screenshots should look like

### Common Issues

Most problems are solved by:
1. Running `npm install` again
2. Restarting the server (Ctrl+C then `node server.js`)
3. Checking the `.env` file has correct API key
4. Making sure you're in the correct folder

### Still Having Issues?

1. Check the PowerShell window for error messages
2. Try the troubleshooting steps above
3. Check if your antivirus is blocking Node.js
4. Make sure Windows Firewall allows Node.js

---

## ✅ Success Checklist

Before using ICB Agent, verify:

- [x] Node.js installed (`node --version` works)
- [x] ICBAgent folder downloaded/extracted
- [x] Dependencies installed (`npm install` completed)
- [x] Playwright installed (`npx playwright install chromium`)
- [x] `.env` file created with OpenAI API key
- [x] Server starts without errors (`node server.js`)
- [x] Browser can access http://localhost:3000
- [x] Can sign in with @icb.solutions account
- [x] Intelligent Health Reports feature works

---

## 🎉 You're Ready!

**ICB Agent is now running locally on your Windows machine!**

You can now:
- ✅ Generate Intelligent Health Reports with AI analysis
- ✅ Use AI Chat for M365 administration
- ✅ Run Zero Trust Assessments
- ✅ Access all ICB Agent features

**Each time you want to use ICB Agent:**
1. Open PowerShell in the ICBAgent folder
2. Run `node server.js`
3. Open http://localhost:3000 in your browser

**Or use the desktop shortcut if you created one!**

---

**Need to update ICB Agent?** If you cloned with Git:
```powershell
cd C:\Users\YourUsername\Documents\ICBAgent
git pull origin main
npm install
node server.js
```

**Enjoy using ICB Agent!** 🚀
