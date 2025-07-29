// Test script to validate minimal policy migration
const fs = require('fs');
const path = require('path');

// Minimal test policy that should NOT have any secrets
const testPolicy = {
    "@odata.type": "#microsoft.graph.windows10CompliancePolicy",
    "displayName": "Test Compliance Policy",
    "description": "Simple compliance policy for testing",
    "passwordRequired": true,
    "passwordMinimumLength": 8,
    "passwordRequiredType": "alphanumeric",
    "passwordMinutesOfInactivityBeforeLock": 5,
    "passwordExpirationDays": 90,
    "passwordPreviousPasswordBlockCount": 5,
    "passwordRequireToUnlockFromIdle": false,
    "requireHealthyDeviceReport": false,
    "osMinimumVersion": "10.0.19041",
    "osMaximumVersion": null,
    "mobileOsMinimumVersion": null,
    "mobileOsMaximumVersion": null,
    "earlyLaunchAntiMalwareDriverEnabled": false,
    "bitLockerEnabled": false,
    "secureBootEnabled": false,
    "codeIntegrityEnabled": false,
    "storageRequireEncryption": false,
    "activeFirewallRequired": false,
    "defenderEnabled": false,
    "defenderVersion": null,
    "signatureOutOfDate": false,
    "rtpEnabled": false,
    "antivirusRequired": false,
    "antiSpywareRequired": false,
    "deviceThreatProtectionEnabled": false,
    "deviceThreatProtectionRequiredSecurityLevel": "unavailable",
    "configurationManagerComplianceRequired": false,
    "tpmRequired": false,
    "deviceCompliancePolicyScript": null,
    "validOperatingSystemBuildRanges": []
};

console.log('=== MINIMAL POLICY MIGRATION TEST ===\n');

// First, let's test if our isSecretReference method would flag anything
function isSecretReference(key, value) {
    // Simplified version of the server's isSecretReference method
    const secretKeyPatterns = [
        /secretReferenceValueId/i,
        /secretReference/i,
        /secretValue/i,
        /certificateId/i,
        /trustedRootCertificate/i,
        /rootCertificateId/i,
        /encryptedPassword/i,
        /hashedPassword/i,
        /passwordHash/i,
        /sharedSecret/i,
        /privateKey/i,
        /keyContainer/i,
        /pfxBlobHash/i,
        /thumbprint/i,
        /fingerprint/i
    ];

    // Check if key matches secret patterns
    if (secretKeyPatterns.some(pattern => pattern.test(key))) {
        return true;
    }

    // Check for GUID-like values that might be secret references
    if (typeof value === 'string' && key.toLowerCase().includes('id')) {
        const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (guidPattern.test(value) && (
            key.toLowerCase().includes('certificate') ||
            key.toLowerCase().includes('secret') ||
            key.toLowerCase().includes('key') ||
            key.toLowerCase().includes('credential')
        )) {
            return true;
        }
    }

    return false;
}

function scanForSecrets(obj, path = '') {
    const secrets = [];
    
    for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (isSecretReference(key, value)) {
            secrets.push({
                path: currentPath,
                key: key,
                value: value
            });
        }
        
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
            secrets.push(...scanForSecrets(value, currentPath));
        }
    }
    
    return secrets;
}

const detectedSecrets = scanForSecrets(testPolicy);

console.log('Original Policy:');
console.log(JSON.stringify(testPolicy, null, 2));
console.log('\n=== SECRET DETECTION RESULTS ===');

if (detectedSecrets.length === 0) {
    console.log('✅ No secrets detected - this policy should migrate successfully!');
} else {
    console.log('❌ Secrets detected:');
    detectedSecrets.forEach((secret, index) => {
        console.log(`${index + 1}. Path: ${secret.path}`);
        console.log(`   Key: ${secret.key}`);
        console.log(`   Value: ${secret.value}`);
    });
}

console.log('\n=== MIGRATION PREPARATION ===');
console.log('This policy should be ready for migration without cleaning.');
console.log('It contains only compliance settings and no secret references.');

// Test JSON structure for Graph API
const migrationPayload = {
    ...testPolicy
};

// Remove any read-only properties that might cause issues
delete migrationPayload.id;
delete migrationPayload.createdDateTime;
delete migrationPayload.lastModifiedDateTime;
delete migrationPayload.version;

console.log('\n=== MIGRATION PAYLOAD ===');
console.log('Policy prepared for Graph API:');
console.log(JSON.stringify(migrationPayload, null, 2));

console.log('\n=== TEST COMPLETE ===');
console.log('This minimal policy should migrate without SecretReferenceValueId errors.');
