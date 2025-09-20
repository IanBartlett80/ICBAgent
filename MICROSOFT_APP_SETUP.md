# Microsoft App Registration Setup Guide for ICB Agent

## Quick Setup Instructions

### 1. Create Microsoft App Registration

1. Go to **Azure Portal** → **Microsoft Entra ID** → **App registrations** → **New registration**

2. **Application Setup:**
   - **Name**: `ICB Agent - Microsoft 365 Management Platform`
   - **Supported account types**: **"Accounts in any organizational directory (Any Microsoft Entra ID tenant - Multitenant)"**
   - **Redirect URI**: 
     - Platform: `Single-page application (SPA)`
     - URI: `http://localhost:3000`

### 2. Configure Authentication

**Authentication** tab:
- ✅ **Redirect URIs**: 
  - `http://localhost:3000` (development)
  - Add your production domain when ready
- ✅ **Implicit grant**: Check "Access tokens" and "ID tokens"
- ✅ **Allow public client flows**: Yes

### 3. API Permissions

**API permissions** tab → **Add a permission** → **Microsoft Graph** → **Delegated permissions**:

**Basic permissions:**
- User.Read
- openid
- profile  
- offline_access

**ICB Agent permissions:**
- User.Read.All
- UserAuthenticationMethod.Read.All
- SecurityEvents.Read.All
- ThreatIndicators.Read.All
- SecurityActions.Read.All
- InformationProtectionPolicy.Read.All
- DeviceManagementApps.Read.All
- DeviceManagementConfiguration.Read.All
- DeviceManagementManagedDevices.Read.All
- DeviceManagementServiceConfig.Read.All
- Directory.Read.All
- AuditLog.Read.All
- Policy.Read.All
- Application.Read.All
- Reports.Read.All
- ReportSettings.Read.All
- Mail.Send

### 4. Copy Your Client ID

1. Go to **Overview** tab
2. Copy the **Application (client) ID**
3. Replace `YOUR_CLIENT_ID_HERE` in the code with this ID

### 5. Update ICB Agent

**Option A: Quick Dev Setup**
Replace `YOUR_CLIENT_ID_HERE` in these files with your actual client ID:
- `/public/js/auth-service.js` (line ~122)
- `/public/js/monthly-report-auth.js` (line ~126)

**Option B: Runtime Configuration**
Set your client ID at runtime:
```javascript
// In browser console or on page load:
localStorage.setItem('icb_client_id', 'your-actual-client-id-here');
localStorage.setItem('msalClientId', 'your-actual-client-id-here');
```

**Option C: URL Parameter**
Add to URL: `http://localhost:3000?clientId=your-actual-client-id-here`

## Important Notes

### ✅ Multi-tenant Benefits
- **One app registration works for ALL customer tenants**
- **No installation required in customer tenants**
- **Customers just sign in with their Microsoft 365 credentials**
- **ICB Agent automatically gets tenant context from user**

### 🔒 Security
- App uses `/common` endpoint - works with any tenant
- Delegated permissions - only acts on behalf of signed-in user
- No admin consent required in customer tenants
- Customers control access through their own tenant permissions

### 🚀 How It Works
1. Customer clicks "Sign in with Microsoft" 
2. Redirected to Microsoft login (their tenant)
3. User enters their credentials
4. Microsoft validates they exist in their tenant
5. User grants permissions for ICB Agent
6. ICB Agent gets access token scoped to their tenant
7. All Graph API calls automatically work with their tenant data

### 🔧 Troubleshooting
- **"Application not found"**: Client ID is still placeholder
- **"Permissions error"**: User doesn't have required roles in their tenant
- **"Popup blocked"**: User needs to allow popups for authentication

---

**That's it!** Once you have your real client ID, any Microsoft 365 user can authenticate with ICB Agent without any setup in their tenant.