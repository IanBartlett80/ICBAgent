# Zero Trust Assessment - Permission Approval Guide

## Overview

The ICB Agent Zero Trust Assessment feature now includes an intelligent permission approval system that prompts IT professionals when additional Microsoft Graph permissions are required during security assessments.

## How It Works

### 1. Automatic Permission Detection
When the Zero Trust Assessment encounters a permission error while collecting data, the system:
- ✅ Automatically detects the specific permission requirement
- ✅ Identifies the exact Microsoft Graph scopes needed
- ✅ Pauses the assessment gracefully
- ✅ Presents a user-friendly permission request dialog

### 2. Permission Request Dialog
The permission dialog provides:
- **Clear explanation** of what data is being accessed and why
- **Detailed permission list** with human-readable descriptions
- **Security information** about read-only access
- **Step-by-step approval process**
- **Technical details** for troubleshooting (expandable)

### 3. Streamlined Approval Process
IT professionals can:
1. **Review** the requested permissions in context
2. **Approve** permissions with a single click
3. **Complete** Microsoft consent in a new browser window
4. **Continue** assessment automatically upon return

## Permission Categories

### Identity Assessment Permissions
- `User.Read.All` - Read all user profiles and account information
- `Directory.Read.All` - Read directory data including users, groups, and organizational settings
- `Policy.Read.All` - Read conditional access and other security policies
- `Policy.ReadWrite.ConditionalAccess` - Read conditional access policies and their configurations

### Device Assessment Permissions
- `DeviceManagementManagedDevices.Read.All` - Read information about managed devices enrolled in Microsoft Intune
- `DeviceManagementConfiguration.Read.All` - Read device compliance and configuration policies

### Application Assessment Permissions
- `Application.Read.All` - Read application registrations and service principals
- `Group.Read.All` - Read group information and membership details

### Infrastructure Assessment Permissions
- `RoleManagement.Read.Directory` - Read directory role assignments and definitions
- `Domain.Read.All` - Read verified domain information
- `Organization.Read.All` - Read organization profile and tenant information

## Security Considerations

### Read-Only Access
- ✅ All permissions are **read-only**
- ✅ No data modification or deletion capabilities
- ✅ Assessment purposes only
- ✅ Temporary access tokens

### Least Privilege Principle
- ✅ Only requests permissions for data being assessed
- ✅ Specific scopes for each assessment category
- ✅ Minimal permission sets
- ✅ Contextual permission requests

### Audit Trail
- ✅ All permission requests are logged
- ✅ User approval/denial tracked
- ✅ Assessment context preserved
- ✅ Compliance reporting available

## User Experience

### Before Permission Approval
```
🛡️ Starting Zero Trust Assessment...
📊 Collecting assessment data...
🔒 Additional permissions required for Conditional Access Policies
```

### Permission Dialog
```
🔐 Additional Permissions Required
Zero Trust Assessment needs additional Microsoft Graph permissions

📊 Data Collection Request
Resource: Conditional Access Policies
Purpose: Security posture assessment and compliance evaluation

🔑 Required Permissions
• Policy.Read.All - Read conditional access and other security policies
• Policy.ReadWrite.ConditionalAccess - Read conditional access policies and their configurations
• Directory.Read.All - Read directory data including users, groups, and organizational settings

ℹ️ What This Means
These permissions allow the ICB Agent to read Conditional Access Policies information 
from your Microsoft 365 tenant for security assessment purposes. 
No data will be modified or deleted.

🚀 Approval Process
1. Click "Approve Permissions" below
2. A new browser window will open for Microsoft consent
3. Review and approve the requested permissions
4. Return to this page - assessment will continue automatically

[✅ Approve Permissions] [❌ Cancel Assessment]
```

### After Permission Approval
```
✅ Permissions Approved!
Resuming Zero Trust Assessment with the newly granted permissions...
📊 Continuing data collection...
✅ Assessment completed successfully!
```

## Troubleshooting

### Common Issues

#### Permission Dialog Doesn't Appear
- Check browser popup blockers
- Ensure JavaScript is enabled
- Verify network connectivity

#### Permission Approval Fails
- Check Microsoft 365 admin permissions
- Verify tenant consent policies
- Review conditional access restrictions

#### Assessment Times Out
- Check authentication status
- Refresh the page if needed
- Restart assessment if necessary

### Technical Support

#### Error Messages
The system provides detailed error messages with:
- Specific permission requirements
- API response details
- Troubleshooting suggestions
- Contact information

#### Logging
All permission requests and responses are logged for:
- Administrative review
- Compliance auditing
- Technical troubleshooting
- Security monitoring

## Implementation Details

### Client-Side Components
- `ZeroTrustAssessment` - Main assessment orchestrator
- `ZeroTrustGraphService` - Microsoft Graph API interface
- Permission modal dialog with responsive design
- Error handling and retry mechanisms

### Server-Side Components
- Permission detection in API responses
- MCP integration for permission requests
- Required scope mapping for each data type
- Audit logging and session management

### Integration Points
- Microsoft Graph API permissions
- Lokka MCP server authentication
- ICB Agent session management
- Real-time UI updates via WebSocket

## Best Practices

### For IT Professionals
1. **Review permissions carefully** before approving
2. **Understand the data being accessed** and why
3. **Monitor permission usage** through audit logs
4. **Use principle of least privilege** for assessments
5. **Document approved permissions** for compliance

### For Organizations
1. **Establish permission approval policies**
2. **Train staff on permission requirements**
3. **Monitor assessment activities**
4. **Review permissions periodically**
5. **Maintain audit trails**

## Compliance and Governance

### Permission Tracking
- All permission requests logged with timestamps
- User approval/denial decisions recorded
- Assessment context and scope documented
- Audit trail maintained for compliance

### Policy Alignment
- Supports organizational security policies
- Enables role-based permission management
- Facilitates compliance reporting
- Maintains data governance standards

---

## Quick Reference

### Starting an Assessment
1. Navigate to Zero Trust Assessment
2. Click "Start Assessment"
3. Approve any requested permissions
4. Review comprehensive security report

### Permission Approval
1. Review permission dialog when prompted
2. Click "Approve Permissions"
3. Complete Microsoft consent process
4. Return to assessment automatically

### Troubleshooting Steps
1. Check browser settings (popups, JavaScript)
2. Verify Microsoft 365 admin permissions
3. Review network connectivity
4. Contact support if issues persist

For technical support or questions about the permission system, please contact the ICB Agent development team.
