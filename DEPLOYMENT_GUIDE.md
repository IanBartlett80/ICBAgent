# ICB Agent - Deployment Guide
**Feature:** Intelligent Health Reports with Browser Automation  
**Date:** October 1, 2025

---

## 🎯 Recommended Deployment: Local Machine

**For maximum reliability, ease of use, and consistent operation, run ICB Agent locally on your Windows machine.**

### Why Local Machine is Best

| Factor | Local Machine | Production Hosting |
|--------|---------------|-------------------|
| **Playwright Compatibility** | ✅ Native, no workarounds | ❌ Needs headless or xvfb |
| **Browser Visibility** | ✅ See authentication flow | ❌ Hidden/headless |
| **Setup Complexity** | ✅ Simple (npm install) | ❌ Complex (VM + display) |
| **File Access** | ✅ Direct Windows paths | ❌ Container filesystem |
| **Debugging** | ✅ Easy to troubleshoot | ❌ Remote debugging needed |
| **Cost** | ✅ Free (your PC) | ❌ VM hosting costs |
| **Maintenance** | ✅ Minimal | ❌ Infrastructure upkeep |
| **Authentication** | ✅ Interactive MFA | ⚠️ Requires special config |

**Verdict:** Since you're the primary user and this is an admin tool (not public-facing), local deployment is perfect.

---

## 🚀 Local Machine Setup (Windows)

### Prerequisites

1. **Node.js** (v18 or higher)
   - Download: https://nodejs.org/
   - Verify: `node --version`

2. **Git** (for updates)
   - Download: https://git-scm.com/
   - Verify: `git --version`

3. **Visual Studio Code** (recommended)
   - Download: https://code.visualstudio.com/

### Installation Steps

```powershell
# 1. Clone or navigate to ICBAgent directory
cd C:\Users\YourUsername\ICBAgent

# 2. Install dependencies
npm install

# 3. Install Playwright browsers (one-time)
npx playwright install chromium

# 4. Create .env file with your OpenAI API key
copy .env.example .env
notepad .env

# Add this line:
# OPENAI_API_KEY=sk-proj-your-key-here

# 5. Start the server
node server.js

# Server will start at: http://localhost:3000
```

### Running ICB Agent

**Option A: Manual Start**
```powershell
cd C:\Users\YourUsername\ICBAgent
node server.js
```

**Option B: Windows Shortcut (Auto-start)**
1. Create a new file: `start-icb-agent.bat`
2. Add these lines:
   ```batch
   @echo off
   cd C:\Users\YourUsername\ICBAgent
   node server.js
   pause
   ```
3. Double-click to start

**Option C: Windows Startup (Auto-launch on boot)**
1. Press `Win+R`, type `shell:startup`, press Enter
2. Create shortcut to `start-icb-agent.bat` in this folder
3. Server will start automatically when Windows boots

### Accessing ICB Agent

1. Open browser: http://localhost:3000
2. Sign in with your @icb.solutions account
3. Start using Intelligent Health Reports and other features

---

## 🌐 Production Hosting (Advanced - Optional)

If you need to host ICB Agent for team access, here are the options:

### Option 1: Azure VM with Desktop (Recommended for Production)

**Setup:**
```bash
# Create Windows Server VM with GUI
- Size: Standard_D2s_v3 (2 vCPUs, 8 GB RAM)
- OS: Windows Server 2022 with Desktop Experience
- Network: Allow inbound 3000, 443

# On VM:
1. Install Node.js
2. Install Chromium browser
3. Clone ICBAgent repo
4. npm install
5. Setup PM2 or Windows Service for auto-restart
6. Configure firewall rules
```

**Access:** `http://your-vm-ip:3000`

### Option 2: Docker Container with xvfb (Complex)

**Requires:**
- Virtual display (xvfb)
- VNC server for debugging
- Special Playwright configuration

```dockerfile
FROM node:20
RUN apt-get update && apt-get install -y \
    xvfb \
    chromium \
    fonts-liberation
ENV DISPLAY=:99
CMD xvfb-run node server.js
```

**Challenges:**
- Authentication flows harder to debug
- File paths need remapping
- More moving parts to maintain

### Option 3: Azure Container Instance (Not Recommended)

❌ **Don't use** - Playwright doesn't work reliably in serverless containers

---

## 🔧 Configuration

### Environment Variables (.env)

```bash
# OpenAI API Key (Required)
OPENAI_API_KEY=sk-proj-your-actual-key-here

# Server Port (Optional, default: 3000)
PORT=3000

# Node Environment (Optional)
NODE_ENV=development
```

### Microsoft Graph Permissions

**Required for ICB Staff (@icb.solutions accounts):**
- `User.Read` - Read user profile
- `Files.ReadWrite.All` - Access OneDrive/SharePoint
- `Sites.ReadWrite.All` - Upload to SharePoint

**Setup in Azure Portal:**
1. Go to Azure Active Directory > App Registrations
2. Find "ICB Agent" app
3. API Permissions > Microsoft Graph > Delegated
4. Add required permissions
5. Grant admin consent

---

## 🛠️ Troubleshooting

### Issue: Server won't start

**Check:**
```powershell
# Port already in use?
netstat -ano | findstr :3000

# Kill process using port 3000:
taskkill /PID <process-id> /F

# Try starting server again
node server.js
```

### Issue: Playwright browser won't launch

**Fix:**
```powershell
# Reinstall Playwright browsers
npx playwright install chromium --force

# Check if Chromium installed:
npx playwright --version
```

### Issue: OpenAI API errors

**Check:**
```powershell
# Verify .env file exists
dir .env

# Check API key format (should start with sk-proj-)
type .env

# Test API key:
curl https://api.openai.com/v1/models -H "Authorization: Bearer sk-proj-your-key"
```

### Issue: SharePoint upload fails

**Check:**
1. Signed in with @icb.solutions account?
2. Graph API permissions granted?
3. SharePoint site accessible?
4. Check browser console for errors

---

## 📊 Performance & Resource Usage

### Local Machine Requirements

**Minimum:**
- CPU: 2 cores
- RAM: 4 GB
- Disk: 500 MB (for app + screenshots)
- Network: Standard broadband

**Recommended:**
- CPU: 4+ cores
- RAM: 8+ GB
- Disk: 2 GB free
- Network: Fast broadband (for portal loading)

### Expected Usage Patterns

| Operation | Duration | Resources |
|-----------|----------|-----------|
| Server startup | 2-5 seconds | 50 MB RAM |
| Idle state | N/A | 100 MB RAM |
| Report generation | 2-4 minutes | 500 MB RAM peak |
| Browser automation | Per report | +200 MB RAM |
| OpenAI analysis | 15-30 seconds | Network only |
| Word generation | 2-3 seconds | 150 MB RAM |

---

## 🔄 Updates & Maintenance

### Getting Latest Updates

```bash
# In ICBAgent directory
git pull origin MonthlyReport
npm install
node server.js
```

### Backup Important Data

**Automatically backed up to SharePoint:**
- ✅ Generated health reports

**Stored locally (backup recommended):**
- `.env` file (API keys)
- Custom configurations

### Updating Dependencies

```bash
# Check for outdated packages
npm outdated

# Update specific package
npm update package-name

# Update all packages
npm update
```

---

## 🎯 Quick Reference

### Start Server
```bash
cd C:\Users\YourUsername\ICBAgent && node server.js
```

### Access Application
```
http://localhost:3000
```

### Stop Server
```
Press Ctrl+C in terminal
```

### View Logs
```
Check terminal output where node server.js is running
```

### Report Issues
1. Check this guide first
2. Review terminal logs
3. Check browser console (F12)
4. Contact: support@icb.solutions

---

## ✅ Deployment Checklist

Before first use:

- [ ] Node.js installed (v18+)
- [ ] ICBAgent cloned/downloaded
- [ ] `npm install` completed successfully
- [ ] Playwright browsers installed (`npx playwright install chromium`)
- [ ] `.env` file created with OpenAI API key
- [ ] Server starts without errors (`node server.js`)
- [ ] Can access http://localhost:3000
- [ ] Can sign in with @icb.solutions account
- [ ] Microsoft Graph permissions granted
- [ ] Test report generation with a customer tenant

---

**Recommendation: Stick with local deployment for maximum reliability and ease of use!**
