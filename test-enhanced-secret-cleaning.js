// Enhanced test script for comprehensive secret reference detection

// Mock policy with various types of secret references that could cause migration failures
const mockPolicyWithComplexSecrets = {
    "@odata.type": "#microsoft.graph.windows10CertificateProfileBase",
    "id": "12345678-1234-1234-1234-123456789012",
    "displayName": "Complex Certificate Policy",
    "description": "A policy with various secret reference types",
    "createdDateTime": "2024-01-15T10:30:00Z",
    "lastModifiedDateTime": "2024-01-15T10:30:00Z",
    
    // Direct secret reference patterns
    "secretReferenceValueId": "87654321-4321-4321-4321-210987654321",
    "certificateId": "abcdef12-3456-7890-abcd-ef1234567890",
    "trustedRootCertificate": "MIIEowIBAAKCAQEA4WiKyXVSRpZ8B1p...",
    "encryptedPassword": "VGhpc0lzQVNlY3JldFBhc3N3b3Jk...",
    "thumbprint": "1234567890ABCDEF1234567890ABCDEF12345678",
    
    // Certificate configuration object
    "certificateStore": "Root",
    "subjectNameFormat": "commonName",
    "subjectAlternativeNameType": "emailAddress",
    "keyUsage": ["digitalSignature", "keyEncipherment"],
    "extendedKeyUsages": ["1.3.6.1.5.5.7.3.2", "1.3.6.1.5.5.7.3.4"],
    
    // SCEP settings with secrets
    "scepServerUrls": ["https://scep.example.com/ca/scep"],
    "customSubjectAlternativeNames": [
        {
            "sanType": "emailAddress",
            "name": "user@example.com"
        }
    ],
    
    // Nested certificate settings
    "rootCertificateSettings": {
        "certificateId": "nested-cert-123-456-789",
        "secretReferenceValueId": "nested-secret-ref-123",
        "trustedRootCertificate": "MIIE...base64data...",
        "pfxData": "MIIKzAIBAzCCCogGCSqGSIb3DQEHAaCCCnkEggp1MIIKcTCCBXQGCSqGSIb3DQEHAaCCBWUEggVh..."
    },
    
    // Authentication settings
    "credentialSettings": {
        "keyStorageProvider": "Microsoft Software Key Storage Provider",
        "smartCardReaderName": "Microsoft Usbccid Smartcard Reader",
        "certificateAccessType": "userCertificate",
        "privateKeyAttributes": {
            "keyUsage": "signature",
            "keySpec": "AT_SIGNATURE"
        }
    },
    
    // Non-secret settings that should be preserved
    "assignmentGroupId": "non-secret-group-id",
    "displayName": "Complex Certificate Policy",
    "assignments": [],
    "deviceStatuses": [],
    "version": 1
};

console.log("=== ENHANCED SECRET REFERENCE DETECTION TEST ===\n");

console.log("Original Policy (with complex secrets):");
console.log(JSON.stringify(mockPolicyWithComplexSecrets, null, 2));

// Enhanced secret cleaning function
function cleanSecretReferences(obj, secretReferencesRemoved, path = '') {
    if (!obj || typeof obj !== 'object') return;

    // Check if this is an array
    if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
            cleanSecretReferences(item, secretReferencesRemoved, `${path}[${index}]`);
        });
        return;
    }

    // Process each property in the object
    const keysToDelete = [];
    for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        // Check for secret reference patterns
        if (isSecretReference(key, value)) {
            keysToDelete.push(key);
            secretReferencesRemoved.push({
                path: currentPath,
                key: key,
                type: getSecretReferenceType(key, value),
                description: getSecretReferenceDescription(key, value),
                originalValue: typeof value === 'string' && value.length > 50 ? `${value.substring(0, 30)}...` : value
            });
            console.log(`🔐 Removing secret reference: ${currentPath} = ${key}`);
            continue;
        }

        // Recursively process nested objects
        if (value && typeof value === 'object') {
            cleanSecretReferences(value, secretReferencesRemoved, currentPath);
        }
    }

    // Remove secret reference keys
    keysToDelete.forEach(key => {
        delete obj[key];
    });
}

function isSecretReference(key, value) {
    // Enhanced secret reference patterns (case-insensitive)
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
        /pfxData/i,
        /thumbprint/i,
        /fingerprint/i,
        /subjectNameFormat/i,
        /subjectAlternativeNameType/i,
        /certificateStore/i,
        /keyUsage/i,
        /extendedKeyUsages/i,
        /customSubjectAlternativeNames/i,
        /scepServerUrl/i,
        /certificateValidityPeriodValue/i,
        /certificateValidityPeriodScale/i,
        /subjectNameFormatString/i,
        /keyStorageProvider/i,
        /customKeyStorageProvider/i,
        /smartCardReaderName/i,
        /certificateAccessType/i
    ];

    // Check if key matches secret patterns
    if (secretKeyPatterns.some(pattern => pattern.test(key))) {
        return true;
    }

    // Additional checks for nested certificate/security objects
    if (typeof value === 'object' && value !== null) {
        // Check if this object has properties that indicate it's a certificate/secret object
        const objectKeys = Object.keys(value);
        const hasCertificateProperties = objectKeys.some(k => 
            /certificate|secret|password|key|thumbprint|pfx|p12|der|pem/i.test(k)
        );
        
        if (hasCertificateProperties && (
            key.toLowerCase().includes('certificate') ||
            key.toLowerCase().includes('credential') ||
            key.toLowerCase().includes('auth') ||
            key.toLowerCase().includes('security')
        )) {
            return true;
        }
    }

    // Check for GUID-like values that might be secret references
    if (typeof value === 'string' && key.toLowerCase().includes('id')) {
        const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (guidPattern.test(value) && (
            key.toLowerCase().includes('certificate') ||
            key.toLowerCase().includes('secret') ||
            key.toLowerCase().includes('key') ||
            key.toLowerCase().includes('credential') ||
            key.toLowerCase().includes('thumbprint') ||
            key.toLowerCase().includes('reference')
        )) {
            return true;
        }
    }

    // Check for certificate/key data patterns
    if (typeof value === 'string') {
        const secretValuePatterns = [
            /^[A-Za-z0-9+/]{100,}={0,2}$/, // Base64 encoded data (likely certificates/keys)
            /BEGIN (CERTIFICATE|PRIVATE KEY|PUBLIC KEY|RSA PRIVATE KEY|ENCRYPTED PRIVATE KEY)/i,
            /END (CERTIFICATE|PRIVATE KEY|PUBLIC KEY|RSA PRIVATE KEY|ENCRYPTED PRIVATE KEY)/i,
            /^[A-Fa-f0-9]{40,}$/, // Long hex strings (thumbprints, hashes)
            /^MIIE[A-Za-z0-9+/]/, // Common certificate prefix
            /^MII[A-Za-z0-9+/]{100,}/ // Generic certificate/key pattern
        ];
        
        if (secretValuePatterns.some(pattern => pattern.test(value))) {
            return true;
        }
    }

    // Check for URL patterns that might contain secrets
    if (typeof value === 'string' && value.startsWith('http') && (
        key.toLowerCase().includes('secret') ||
        key.toLowerCase().includes('key') ||
        key.toLowerCase().includes('certificate') ||
        key.toLowerCase().includes('scep') ||
        key.toLowerCase().includes('ca')
    )) {
        return true;
    }

    return false;
}

function getSecretReferenceType(key, value) {
    if (key.toLowerCase().includes('certificate') || key.toLowerCase().includes('thumbprint')) return 'certificate';
    if (key.toLowerCase().includes('password')) return 'password';
    if (key.toLowerCase().includes('secret')) return 'shared_secret';
    if (key.toLowerCase().includes('key') || key.toLowerCase().includes('pfx')) return 'encryption_key';
    if (key.toLowerCase().includes('credential') || key.toLowerCase().includes('auth')) return 'credential';
    if (key.toLowerCase().includes('scep') || key.toLowerCase().includes('url')) return 'service_url';
    return 'unknown_secret';
}

function getSecretReferenceDescription(key, value) {
    const type = getSecretReferenceType(key, value);
    
    switch (type) {
        case 'certificate':
            return 'Certificate reference - upload certificate in target tenant';
        case 'password':
            return 'Password/credential - configure authentication in target tenant';
        case 'shared_secret':
            return 'Shared secret - configure secret value in target tenant';
        case 'encryption_key':
            return 'Encryption key/PFX data - configure key settings in target tenant';
        case 'credential':
            return 'Authentication credential - configure authentication in target tenant';
        case 'service_url':
            return 'Service URL with secrets - configure service endpoint in target tenant';
        default:
            return 'Secret reference - manual configuration required in target tenant';
    }
}

// Test the enhanced cleaning
const cleanedPolicy = JSON.parse(JSON.stringify(mockPolicyWithComplexSecrets)); // Deep copy
const secretReferencesRemoved = [];

console.log("\n=== RUNNING ENHANCED SECRET CLEANING ===\n");

cleanSecretReferences(cleanedPolicy, secretReferencesRemoved);

console.log("\n=== CLEANING RESULTS ===\n");

console.log("Cleaned Policy (secrets removed):");
console.log(JSON.stringify(cleanedPolicy, null, 2));

console.log("\n=== SECRET REFERENCES DETECTED AND REMOVED ===");
secretReferencesRemoved.forEach((ref, index) => {
    console.log(`${index + 1}. Path: ${ref.path}`);
    console.log(`   Key: ${ref.key}`);
    console.log(`   Type: ${ref.type}`);
    console.log(`   Description: ${ref.description}`);
    if (ref.originalValue) {
        console.log(`   Original Value: ${ref.originalValue}`);
    }
    console.log('');
});

console.log(`✅ Total secret references removed: ${secretReferencesRemoved.length}`);

// Verify no secrets remain
function verifyNoSecretsRemain(obj, remainingSecrets, path = '') {
    if (!obj || typeof obj !== 'object') return;

    if (Array.isArray(obj)) {
        obj.forEach((item, index) => {
            verifyNoSecretsRemain(item, remainingSecrets, `${path}[${index}]`);
        });
        return;
    }

    for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (isSecretReference(key, value)) {
            remainingSecrets.push({
                path: currentPath,
                key: key,
                value: typeof value === 'string' && value.length > 50 ? `${value.substring(0, 30)}...` : value
            });
        }

        if (value && typeof value === 'object') {
            verifyNoSecretsRemain(value, remainingSecrets, currentPath);
        }
    }
}

console.log("\n=== FINAL VERIFICATION ===");
const remainingSecrets = [];
verifyNoSecretsRemain(cleanedPolicy, remainingSecrets);

if (remainingSecrets.length > 0) {
    console.log(`❌ WARNING: ${remainingSecrets.length} secret references still found:`);
    remainingSecrets.forEach((ref, index) => {
        console.log(`${index + 1}. ${ref.path} = ${ref.key} (${ref.value})`);
    });
} else {
    console.log(`✅ SUCCESS: No secret references remain in the cleaned policy!`);
}

console.log("\n📝 IT Professional Next Steps:");
console.log("1. Policy should now migrate successfully to target tenant");
console.log("2. Go to Intune portal in target tenant after migration");
console.log("3. Find the migrated policy and configure the secret values listed above");
console.log("4. Test the policy on a small group before full deployment");
console.log("5. Save and assign the policy as needed");
