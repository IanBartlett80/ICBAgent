// Test script to demonstrate secret reference cleaning functionality

// Mock policy with secret references (similar to the timezone policy that failed)
const mockPolicyWithSecrets = {
    "@odata.type": "#microsoft.graph.windows10CustomConfiguration",
    "id": "12345678-1234-1234-1234-123456789012",
    "displayName": "Set Timezone to Brisbane",
    "description": "Configures timezone settings for devices",
    "createdDateTime": "2024-01-15T10:30:00Z",
    "lastModifiedDateTime": "2024-01-15T10:30:00Z",
    "omaSettings": [
        {
            "@odata.type": "#microsoft.graph.omaSettingString",
            "displayName": "Time Zone",
            "omaUri": "./Device/Vendor/MSFT/Policy/Config/TimeLanguageSettings/ConfigureTimeZone",
            "value": "E. Australia Standard Time"
        },
        {
            "@odata.type": "#microsoft.graph.omaSettingString", 
            "displayName": "Certificate Setting",
            "omaUri": "./Device/Vendor/MSFT/Policy/Config/Certificate/Store",
            "secretReferenceValueId": "87654321-4321-4321-4321-210987654321",
            "encryptedPassword": "VGhpc0lzQVNlY3JldFBhc3N3b3Jk...base64encodeddata",
            "certificateId": "abcdef12-3456-7890-abcd-ef1234567890"
        }
    ],
    "assignments": [],
    "deviceStatuses": [],
    "version": 1
};

console.log("=== SECRET REFERENCE CLEANING TEST ===\n");

console.log("Original Policy (with secrets):");
console.log(JSON.stringify(mockPolicyWithSecrets, null, 2));

// Simulate the secret cleaning function
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
                description: getSecretReferenceDescription(key, value)
            });
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
    // Direct secret reference patterns
    const secretKeyPatterns = [
        /secretReferenceValueId/i,
        /secretReference/i,
        /certificateId/i,
        /trustedRootCertificate/i,
        /rootCertificateId/i,
        /encryptedPassword/i,
        /hashedPassword/i,
        /passwordHash/i,
        /sharedSecret/i,
        /privateKey/i,
        /keyContainer/i,
        /pfxBlobHash/i
    ];

    // Check if key matches secret patterns
    if (secretKeyPatterns.some(pattern => pattern.test(key))) {
        return true;
    }

    // Check for GUID-like values that might be secret references
    if (typeof value === 'string' && key.toLowerCase().includes('id')) {
        const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (guidPattern.test(value) && (
            key.includes('certificate') ||
            key.includes('secret') ||
            key.includes('key') ||
            key.includes('credential')
        )) {
            return true;
        }
    }

    // Check for certificate/key data patterns
    if (typeof value === 'string') {
        const secretValuePatterns = [
            /^[A-Za-z0-9+/]{100,}={0,2}$/, // Base64 encoded data (likely certificates/keys)
            /BEGIN (CERTIFICATE|PRIVATE KEY|PUBLIC KEY)/,
            /END (CERTIFICATE|PRIVATE KEY|PUBLIC KEY)/
        ];
        
        if (secretValuePatterns.some(pattern => pattern.test(value))) {
            return true;
        }
    }

    return false;
}

function getSecretReferenceType(key, value) {
    if (key.toLowerCase().includes('certificate')) return 'certificate';
    if (key.toLowerCase().includes('password')) return 'password';
    if (key.toLowerCase().includes('secret')) return 'shared_secret';
    if (key.toLowerCase().includes('key')) return 'encryption_key';
    if (key.toLowerCase().includes('credential')) return 'credential';
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
            return 'Encryption key - configure key settings in target tenant';
        case 'credential':
            return 'Authentication credential - configure authentication in target tenant';
        default:
            return 'Secret reference - manual configuration required in target tenant';
    }
}

// Test the cleaning
const cleanedPolicy = JSON.parse(JSON.stringify(mockPolicyWithSecrets)); // Deep copy
const secretReferencesRemoved = [];

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
    console.log('');
});

console.log(`✅ Total secret references removed: ${secretReferencesRemoved.length}`);
console.log("\n📝 IT Professional Next Steps:");
console.log("1. Policy has been migrated to target tenant");
console.log("2. Go to Intune portal in target tenant");
console.log("3. Find the migrated policy: 'Set Timezone to Brisbane (Cloned)'");
console.log("4. Configure the secret values listed above");
console.log("5. Save and assign the policy as needed");
