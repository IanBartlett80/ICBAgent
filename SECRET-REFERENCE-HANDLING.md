# Secret Reference Handling in ICB Agent Tenant Clone

## Overview

The ICB Agent Tenant Clone webapp now automatically detects and handles secret references during policy migration, solving the common "SecretReferenceValueId invalid for create" error that occurs when migrating Microsoft Intune policies between tenants.

## Features

### 1. Automatic Secret Reference Detection
The system automatically detects various types of secret references in policies:

- **Certificate References**: `certificateId`, `trustedRootCertificate`, `rootCertificateId`
- **Password/Credentials**: `encryptedPassword`, `hashedPassword`, `passwordHash`
- **Secret References**: `secretReferenceValueId`, `secretReference`, `sharedSecret`
- **Encryption Keys**: `privateKey`, `keyContainer`, `pfxBlobHash`
- **Base64 Data**: Large base64-encoded strings (likely certificates or keys)
- **GUID References**: GUID patterns in certificate/secret/key related fields

### 2. Automatic Cleaning During Migration
When migrating policies, the system:

1. **Scans** the policy JSON for secret references
2. **Removes** tenant-specific secret values automatically  
3. **Preserves** all other policy configuration
4. **Creates** the policy in the target tenant successfully
5. **Reports** what secret references were removed

### 3. Manual Secret Cleaning in JSON Editor
IT professionals can manually clean secret references before migration:

1. **Edit Policy**: Click the edit button on any policy to open the JSON editor
2. **Clean Secrets**: Click the "Clean Secrets" button in the JSON tools
3. **Review Changes**: See exactly what secret references were detected and removed
4. **Migrate**: Proceed with migration using the cleaned JSON

### 4. Post-Migration Guidance
After migration, the system provides detailed guidance:

- **Lists** all secret references that were removed
- **Categorizes** each secret type (certificate, password, key, etc.)
- **Provides** specific instructions for manual configuration
- **Creates** post-migration tasks for IT professionals

## Example Scenario

### Original Error (Before Enhancement)
```
Policy Migration Failed
Failed to migrate policy: Policy creation failed: 
"SecretReferenceValueId invalid for create"
```

### With Secret Reference Handling (After Enhancement)
```
✅ Policy "Set Timezone to Brisbane" migrated successfully
⚠️ 3 secret references removed - manual configuration required

Secret References Removed:
1. secretReferenceValueId (shared_secret)
   📝 Shared secret - configure secret value in target tenant

2. encryptedPassword (password)  
   📝 Password/credential - configure authentication in target tenant

3. certificateId (certificate)
   📝 Certificate reference - upload certificate in target tenant

Next Steps:
1. Go to your target tenant's Intune portal
2. Find the migrated policy: "Set Timezone to Brisbane (Cloned)"
3. Configure the secret values listed above
4. Save and assign the policy as needed
```

## Technical Implementation

### Server-Side Processing
- **Deep Scanning**: Recursively scans all policy objects and arrays
- **Pattern Matching**: Uses regex patterns to identify secret references
- **Safe Removal**: Removes only identified secret references, preserves all other data
- **Metadata Tracking**: Tracks what was removed for client notification

### Client-Side Features
- **JSON Editor Integration**: Manual secret cleaning in the policy editor
- **Visual Feedback**: Clear indication of what was cleaned
- **Task Management**: Post-migration tasks for manual configuration
- **Error Prevention**: Prevents common migration failures

### Supported Secret Types
| Type | Examples | Description |
|------|----------|-------------|
| Certificate | `certificateId`, `trustedRootCertificate` | Certificate references and data |
| Password | `encryptedPassword`, `hashedPassword` | Authentication credentials |
| Shared Secret | `secretReferenceValueId`, `sharedSecret` | Shared secret values |
| Encryption Key | `privateKey`, `keyContainer` | Encryption keys and containers |
| Base64 Data | Large base64 strings | Encoded certificates/keys |

## Benefits for IT Professionals

1. **Eliminates Migration Failures**: No more "SecretReferenceValueId invalid" errors
2. **Saves Time**: Automatic detection and cleaning, no manual JSON editing required
3. **Provides Guidance**: Clear instructions for post-migration configuration
4. **Maintains Security**: Secret references are properly handled and documented
5. **Preserves Functionality**: All non-secret policy settings are preserved exactly

## Usage Instructions

### Automatic Mode (Recommended)
1. Load source policies as normal
2. Select policies to migrate
3. Click "Start Migration"
4. System automatically handles secret references
5. Review post-migration tasks for manual configuration

### Manual Mode (Advanced Users)
1. Load source policies
2. Click edit button on any policy with secrets
3. Click "Clean Secrets" in the JSON editor
4. Review what was removed
5. Proceed with migration

This enhancement makes policy migration much more reliable and user-friendly, especially for policies that contain certificates, passwords, or other secret references that cannot be directly copied between tenants.
