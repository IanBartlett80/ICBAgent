const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? false : "*",
    methods: ["GET", "POST"]
  }
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", "ws:", "wss:"]
    }
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

app.use(compression());
app.use(limiter);
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store active sessions and MCP connections
const activeSessions = new Map();
const mcpConnections = new Map();

// Store dual-tenant sessions for Tenant Clone feature
const dualTenantSessions = new Map();

// Dual Tenant Manager for Tenant Clone feature
class DualTenantManager {
  constructor(sessionId, io) {
    this.sessionId = sessionId;
    this.io = io;
    this.sourceTenant = null;
    this.targetTenant = null;
    this.isActive = false;
    this.policies = {
      source: new Map(),
      target: new Map()
    };
    this.migrations = new Map(); // Track ongoing migrations
  }

  async initializeSourceTenant(tenantDomain) {
    try {
      console.log(`🔄 Initializing source tenant: ${tenantDomain}`);
      
      // Create dedicated MCP client for source tenant
      this.sourceTenant = new MCPClient(
        `${this.sessionId}_source`, 
        tenantDomain, 
        this.io,
        'source' // tenant role
      );
      
      await this.sourceTenant.start();
      
      this.io.to(this.sessionId).emit('dual_tenant_status', {
        type: 'source_initialized',
        tenant: tenantDomain,
        status: 'connecting'
      });
      
      return true;
    } catch (error) {
      console.error(`Error initializing source tenant: ${error.message}`);
      this.io.to(this.sessionId).emit('dual_tenant_error', {
        type: 'source_init_failed',
        tenant: tenantDomain,
        error: error.message
      });
      return false;
    }
  }

  async initializeTargetTenant(tenantDomain) {
    try {
      console.log(`🔄 Initializing target tenant: ${tenantDomain}`);
      
      // Create dedicated MCP client for target tenant
      this.targetTenant = new MCPClient(
        `${this.sessionId}_target`, 
        tenantDomain, 
        this.io,
        'target' // tenant role
      );
      
      await this.targetTenant.start();
      
      this.io.to(this.sessionId).emit('dual_tenant_status', {
        type: 'target_initialized',
        tenant: tenantDomain,
        status: 'connecting'
      });
      
      return true;
    } catch (error) {
      console.error(`Error initializing target tenant: ${error.message}`);
      this.io.to(this.sessionId).emit('dual_tenant_error', {
        type: 'target_init_failed',
        tenant: tenantDomain,
        error: error.message
      });
      return false;
    }
  }

  async loadSourcePolicies() {
    if (!this.sourceTenant || this.sourceTenant.authStatus !== 'authenticated') {
      throw new Error('Source tenant not authenticated');
    }

    console.log('📋 Loading policies from source tenant...');
    console.log(`🔍 Source tenant auth status: ${this.sourceTenant.authStatus}`);
    console.log(`🔍 Source tenant connected: ${this.sourceTenant.isConnected}`);
    
    const policyTypes = [
      'deviceConfigurations',
      'deviceCompliancePolicies', 
      'mobileAppManagementPolicies',
      'appProtectionPolicies',
      'deviceEnrollmentConfigurations',
      'windowsInformationProtectionPolicies',
      'managedAppPolicies'
    ];

    const policies = new Map();
    let totalPoliciesFound = 0;
    
    for (const policyType of policyTypes) {
      try {
        console.log(`🔍 Fetching ${policyType}...`);
        
        // First get the list of policies (basic info)
        const listResponse = await this.sourceTenant.sendMCPRequest('tools/call', {
          name: 'Lokka-Microsoft',
          arguments: {
            apiType: 'graph',
            graphApiVersion: 'beta',
            method: 'get',
            path: `/deviceManagement/${policyType}`,
            queryParams: {
              '$select': 'id,displayName,description,createdDateTime,lastModifiedDateTime,version'
            }
          }
        });

        console.log(`📊 List response for ${policyType}:`, listResponse ? 'Got response' : 'No response');
        
        if (listResponse && listResponse.content && listResponse.content[0]) {
          try {
            let responseText = listResponse.content[0].text;
            console.log(`📝 Raw list response for ${policyType} (first 200 chars):`, responseText.substring(0, 200));
            
            // Handle Lokka MCP response format which might have prefixes like "Result for xyz: {json}"
            let jsonData = null;
            
            // Try to extract JSON from response that might have prefixes
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              jsonData = JSON.parse(jsonMatch[0]);
            } else if (responseText.trim().startsWith('{') || responseText.trim().startsWith('[')) {
              jsonData = JSON.parse(responseText.trim());
            } else {
              console.log(`⚠️ Could not extract JSON from ${policyType} response:`, responseText.substring(0, 100));
              continue;
            }
            
            if (jsonData && jsonData.value && jsonData.value.length > 0) {
              console.log(`✅ Found ${jsonData.value.length} ${policyType}, fetching full configurations...`);
              
              // Now fetch full configuration for each policy
              const fullPolicies = [];
              for (const basicPolicy of jsonData.value) {
                try {
                  console.log(`🔄 Fetching full config for policy: ${basicPolicy.displayName} (${basicPolicy.id})`);
                  
                  const fullPolicyResponse = await this.sourceTenant.sendMCPRequest('tools/call', {
                    name: 'Lokka-Microsoft',
                    arguments: {
                      apiType: 'graph',
                      graphApiVersion: 'beta',
                      method: 'get',
                      path: `/deviceManagement/${policyType}/${basicPolicy.id}`
                    }
                  });

                  if (fullPolicyResponse && fullPolicyResponse.content && fullPolicyResponse.content[0]) {
                    let fullResponseText = fullPolicyResponse.content[0].text;
                    
                    // Extract JSON from the full policy response
                    const fullJsonMatch = fullResponseText.match(/\{[\s\S]*\}/);
                    if (fullJsonMatch) {
                      const fullPolicyData = JSON.parse(fullJsonMatch[0]);
                      fullPolicies.push({
                        ...fullPolicyData,
                        policyType: policyType // Add policy type for easier handling
                      });
                      console.log(`✅ Full config loaded for: ${fullPolicyData.displayName}`);
                    } else {
                      console.log(`⚠️ Could not extract JSON from full policy response for ${basicPolicy.id}`);
                      // Fallback to basic policy info
                      fullPolicies.push({
                        ...basicPolicy,
                        policyType: policyType,
                        configurationIncomplete: true
                      });
                    }
                  } else {
                    console.log(`⚠️ No response for full policy ${basicPolicy.id}`);
                    // Fallback to basic policy info
                    fullPolicies.push({
                      ...basicPolicy,
                      policyType: policyType,
                      configurationIncomplete: true
                    });
                  }
                } catch (fullPolicyError) {
                  console.error(`❌ Error fetching full policy ${basicPolicy.id}:`, fullPolicyError.message);
                  // Fallback to basic policy info
                  fullPolicies.push({
                    ...basicPolicy,
                    policyType: policyType,
                    configurationIncomplete: true
                  });
                }
              }
              
              policies.set(policyType, fullPolicies);
              totalPoliciesFound += fullPolicies.length;
              console.log(`🎯 Completed loading ${fullPolicies.length} ${policyType} with full configurations`);
              
            } else {
              console.log(`⚠️ No value array found in ${policyType} response`);
              console.log(`📋 Response structure:`, Object.keys(jsonData || {}));
            }
          } catch (parseError) {
            console.error(`❌ JSON parsing error for ${policyType}:`, parseError.message);
            console.log(`📝 Problematic response text:`, listResponse.content[0].text.substring(0, 300));
          }
        } else {
          console.log(`⚠️ No content found in ${policyType} response`);
        }
      } catch (error) {
        console.error(`❌ Error loading ${policyType}:`, error.message);
      }
    }

    console.log(`📊 Total policies found: ${totalPoliciesFound}`);
    this.policies.source = policies;
    
    this.io.to(this.sessionId).emit('source_policies_loaded', {
      policies: this.convertPoliciesToClientFormat(policies),
      count: this.getTotalPolicyCount(policies)
    });

    return policies;
  }

  async clonePolicy(policyId, policyType, customizations = {}) {
    if (!this.sourceTenant || !this.targetTenant) {
      throw new Error('Both tenants must be initialized');
    }

    if (this.sourceTenant.authStatus !== 'authenticated' || 
        this.targetTenant.authStatus !== 'authenticated') {
      throw new Error('Both tenants must be authenticated');
    }

    const migrationId = uuidv4();
    this.migrations.set(migrationId, {
      policyId,
      policyType,
      status: 'starting',
      startTime: new Date()
    });

    try {
      // Step 1: Fetch full policy details from source
      console.log(`🔄 Fetching policy ${policyId} from source tenant...`);
      
      const sourcePolicy = await this.sourceTenant.sendMCPRequest('tools/call', {
        name: 'Lokka-Microsoft',
        arguments: {
          apiType: 'graph',
          graphApiVersion: 'beta',
          method: 'get',
          path: `/deviceManagement/${policyType}/${policyId}`
        }
      });

      if (!sourcePolicy || !sourcePolicy.content || !sourcePolicy.content[0]) {
        throw new Error('Failed to fetch source policy');
      }

      // Parse the response text with the same logic as loadSourcePolicies
      let responseText = sourcePolicy.content[0].text;
      console.log(`📝 Raw policy response text (first 200 chars):`, responseText.substring(0, 200));
      
      let policyData = null;
      
      // Handle Lokka MCP response format which might have prefixes like "Result for xyz: {json}"
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        policyData = JSON.parse(jsonMatch[0]);
      } else if (responseText.trim().startsWith('{') || responseText.trim().startsWith('[')) {
        policyData = JSON.parse(responseText.trim());
      } else {
        throw new Error(`Could not extract JSON from policy response: ${responseText.substring(0, 100)}`);
      }
      
      this.migrations.get(migrationId).status = 'transforming';
      
      // Step 2: Transform policy for target tenant
      console.log(`🔧 Starting policy transformation...`);
      console.log(`🔍 Original policy keys: ${Object.keys(policyData).join(', ')}`);
      
      // Check for secret references before transformation
      console.log(`🔍 Checking for secret references in original policy...`);
      const originalSecrets = [];
      this.verifyNoSecretsRemain(policyData, originalSecrets);
      if (originalSecrets.length > 0) {
        console.log(`⚠️  Found ${originalSecrets.length} secret references in original policy:`);
        originalSecrets.forEach((secret, index) => {
          console.log(`   ${index + 1}. ${secret.path}: ${secret.key} = ${typeof secret.value === 'string' ? secret.value.substring(0, 50) + '...' : secret.value}`);
        });
      } else {
        console.log(`✅ No secret references found in original policy`);
      }
      
      const transformedPolicy = this.transformPolicyForTarget(policyData, customizations);
      
      // Check for secret references after transformation
      console.log(`🔍 Checking for secret references after transformation...`);
      
      // Create a clean copy for verification (without internal metadata)
      const policyForVerification = { ...transformedPolicy };
      delete policyForVerification._secretReferencesRemoved;
      
      const transformedSecrets = [];
      this.verifyNoSecretsRemain(policyForVerification, transformedSecrets);
      if (transformedSecrets.length > 0) {
        console.log(`❌ CRITICAL: ${transformedSecrets.length} secret references still present after transformation:`);
        transformedSecrets.forEach((secret, index) => {
          console.log(`   ${index + 1}. ${secret.path}: ${secret.key} = ${typeof secret.value === 'string' ? secret.value.substring(0, 50) + '...' : secret.value}`);
        });
        
        // Emit warning to client
        this.io.to(this.sessionId).emit('policy_warning', {
          message: `Policy contains ${transformedSecrets.length} secret references that must be cleaned before migration.`,
          details: transformedSecrets
        });
        
        throw new Error(`Policy contains secret references. Please use "Clean Secrets" button first.`);
      } else {
        console.log(`✅ No secret references found after transformation - ready for migration`);
      }
      
      console.log(`🔍 Transformed policy keys: ${Object.keys(transformedPolicy).join(', ')}`);
      console.log(`✅ Policy transformation completed successfully`);
      
      this.migrations.get(migrationId).status = 'creating';
      
      // Step 3: Create policy in target tenant
      console.log(`🔄 Creating policy in target tenant...`);
      console.log(`📋 Policy payload size: ${JSON.stringify(transformedPolicy).length} characters`);
      console.log(`📋 Policy payload keys: ${Object.keys(transformedPolicy).join(', ')}`);
      
      let targetResponse;
      try {
        targetResponse = await this.targetTenant.sendMCPRequest('tools/call', {
          name: 'Lokka-Microsoft',
          arguments: {
            apiType: 'graph',
            graphApiVersion: 'beta',
            method: 'post',
            path: `/deviceManagement/${policyType}`,
            body: transformedPolicy
          }
        });
      } catch (error) {
        console.error(`❌ Request error during policy creation:`, error.message);
        
        // Enhanced secret reference error detection
        if (error.message && error.message.toLowerCase().includes('secretreferencevalueid')) {
          console.error(`🔐 SECRETREFERENCEVALUEID ERROR DETECTED!`);
          console.error(`The policy still contains secret references that Microsoft Graph rejected.`);
          console.error(`This typically means the cleaning process missed some secret references.`);
          
          // Emit specific secret error to client
          this.io.to(this.sessionId).emit('policy_secret_error', {
            message: 'Policy contains secret references that were not properly cleaned',
            error: error.message,
            solution: 'Use the "Clean Secrets" button and verify the policy is clean before migration'
          });
          
          throw new Error(`SECRET_REFERENCE_ERROR: Policy contains secret references. Please clean the policy first using the "Clean Secrets" button.`);
        }
        
        // Check if this is a permission error
        if (this.isPermissionError(error.message)) {
          console.log('🔐 Permission error detected, requesting additional permissions...');
          await this.requestAdditionalPermissions();
          throw new Error(`PERMISSION_REQUIRED: ${error.message}`);
        }
        throw error;
      }

      if (!targetResponse || !targetResponse.content || !targetResponse.content[0]) {
        throw new Error('Failed to create policy in target tenant');
      }

      // Parse the target response text with the same logic
      let targetResponseText = targetResponse.content[0].text;
      console.log(`📝 Raw target response text (first 200 chars):`, targetResponseText.substring(0, 200));
      
      // Check if the response contains a permission error even in successful response
      if (this.isPermissionError(targetResponseText)) {
        console.log('🔐 Permission error detected in response, requesting additional permissions...');
        await this.requestAdditionalPermissions();
        throw new Error(`PERMISSION_REQUIRED: ${targetResponseText}`);
      }
      
      let createdPolicy = null;
      
      // Handle Lokka MCP response format which might have prefixes like "Result for xyz: {json}"
      const targetJsonMatch = targetResponseText.match(/\{[\s\S]*\}/);
      if (targetJsonMatch) {
        const parsedResponse = JSON.parse(targetJsonMatch[0]);
        
        // Check if the parsed response is an error response
        if (parsedResponse.error) {
          console.log('🔐 Permission error detected in parsed response, requesting additional permissions...');
          console.log('📋 Error details:', parsedResponse.error);
          
          // Check if this is specifically a permission error
          if (this.isPermissionError(JSON.stringify(parsedResponse.error)) || this.isPermissionError(parsedResponse.error)) {
            await this.requestAdditionalPermissions();
            throw new Error(`PERMISSION_REQUIRED: ${JSON.stringify(parsedResponse.error)}`);
          } else {
            throw new Error(`Policy creation failed: ${JSON.stringify(parsedResponse.error)}`);
          }
        }
        
        createdPolicy = parsedResponse;
      } else if (targetResponseText.trim().startsWith('{') || targetResponseText.trim().startsWith('[')) {
        const parsedResponse = JSON.parse(targetResponseText.trim());
        
        // Check if the parsed response is an error response
        if (parsedResponse.error) {
          console.log('🔐 Permission error detected in parsed response, requesting additional permissions...');
          console.log('📋 Error details:', parsedResponse.error);
          
          // Check if this is specifically a permission error
          if (this.isPermissionError(JSON.stringify(parsedResponse.error)) || this.isPermissionError(parsedResponse.error)) {
            await this.requestAdditionalPermissions();
            throw new Error(`PERMISSION_REQUIRED: ${JSON.stringify(parsedResponse.error)}`);
          } else {
            throw new Error(`Policy creation failed: ${JSON.stringify(parsedResponse.error)}`);
          }
        }
        
        createdPolicy = parsedResponse;
      } else {
        throw new Error(`Could not extract JSON from target response: ${targetResponseText.substring(0, 100)}`);
      }
      
      this.migrations.get(migrationId).status = 'completed';
      this.migrations.get(migrationId).targetPolicyId = createdPolicy.id;
      this.migrations.get(migrationId).endTime = new Date();

      // Emit success event
      this.io.to(this.sessionId).emit('policy_cloned', {
        migrationId,
        sourcePolicyId: policyId,
        targetPolicyId: createdPolicy.id,
        policyType,
        policyName: createdPolicy.displayName,
        secretReferencesRemoved: transformedPolicy._secretReferencesRemoved || []
      });

      // Prepare success response
      const successResponse = {
        success: true,
        migrationId,
        targetPolicyId: createdPolicy.id,
        message: `Successfully cloned policy "${createdPolicy.displayName}" to target tenant`
      };

      // Add secret references information if any were removed
      if (transformedPolicy._secretReferencesRemoved && transformedPolicy._secretReferencesRemoved.length > 0) {
        successResponse.secretReferencesRemoved = transformedPolicy._secretReferencesRemoved;
        successResponse.requiresManualConfiguration = true;
        successResponse.message += ` (${transformedPolicy._secretReferencesRemoved.length} secret reference${transformedPolicy._secretReferencesRemoved.length === 1 ? '' : 's'} removed - manual configuration required)`;
      }

      // Clean up the metadata before returning
      delete transformedPolicy._secretReferencesRemoved;

      return successResponse;

    } catch (error) {
      console.error(`Error cloning policy ${policyId}:`, error);
      
      this.migrations.get(migrationId).status = 'failed';
      this.migrations.get(migrationId).error = error.message;
      this.migrations.get(migrationId).endTime = new Date();

      // Check if this is a permission error
      if (error.message.startsWith('PERMISSION_REQUIRED:')) {
        this.io.to(this.sessionId).emit('policy_clone_permission_required', {
          migrationId,
          policyId,
          policyType,
          error: error.message.replace('PERMISSION_REQUIRED: ', ''),
          message: 'Additional permissions required. Please complete the authentication flow to grant the necessary permissions.',
          tenantDomain: this.targetTenant.tenantDomain,
          tenantRole: 'target'
        });
      } else {
        this.io.to(this.sessionId).emit('policy_clone_failed', {
          migrationId,
          policyId,
          policyType,
          error: error.message
        });
      }

      throw error;
    }
  }

  transformPolicyForTarget(sourcePolicy, customizations) {
    // Remove source-specific properties and read-only fields
    const transformed = { ...sourcePolicy };
    
    // Preserve the @odata.type as it's required for concrete policy type identification
    const originalODataType = sourcePolicy['@odata.type'];
    
    // Remove all Microsoft Graph metadata EXCEPT @odata.type for policy creation
    delete transformed.id;
    delete transformed.createdDateTime;
    delete transformed.lastModifiedDateTime;
    delete transformed.supportsScopeTags;
    delete transformed.roleScopeTagIds;
    delete transformed.deviceStatuses;
    delete transformed.userStatuses;
    delete transformed.deviceStatusOverview;
    delete transformed.userStatusOverview;
    delete transformed.assignments;
    delete transformed.deviceSettingStateSummaries;
    delete transformed.complianceGracePeriodExpirationDateTime;
    delete transformed.settingStates;
    delete transformed.rootCertificateId;
    delete transformed.trustedRootCertificate;
    delete transformed.derivedCredentialSettings;
    delete transformed.advancedThreatProtectionAutoEnableType;
    delete transformed.advancedThreatProtectionOfficeKind;
    delete transformed.advancedThreatProtectionOfficeDataSharing;
    delete transformed.advancedThreatProtectionOfficeNetworkScanningType;
    delete transformed.advancedThreatProtectionOfficeAntivirusType;
    delete transformed.advancedThreatProtectionOfficeRealtimeProtectionType;
    delete transformed.advancedThreatProtectionOfficeSignatureUpdateIntervalInHours;
    
    // Remove other OData specific properties but preserve @odata.type
    delete transformed['@odata.context'];
    delete transformed['@odata.id'];
    delete transformed['@odata.etag'];
    delete transformed['@odata.editLink'];
    delete transformed['@odata.nextLink'];

    // Track secret references for IT pro guidance
    const secretReferencesRemoved = [];
    
    // Log the original policy structure for debugging
    console.log(`🔍 Original policy keys:`, Object.keys(transformed));
    console.log(`🔍 Policy displayName:`, transformed.displayName);
    
    // Clean secret references recursively
    this.cleanSecretReferences(transformed, secretReferencesRemoved);
    
    // Log secret references that were removed for IT pro guidance
    if (secretReferencesRemoved.length > 0) {
      console.log(`🔐 Secret references removed from policy (will need manual configuration):`, secretReferencesRemoved);
      
      // Store in metadata for client notification
      transformed._secretReferencesRemoved = secretReferencesRemoved;
    } else {
      console.log(`✅ No secret references found in policy`);
    }
    
    // After cleaning, log the policy again to verify
    console.log(`🧹 Policy after secret cleaning:`, {
      displayName: transformed.displayName,
      keys: Object.keys(transformed),
      hasSecretMetadata: !!transformed._secretReferencesRemoved
    });

    // Handle scheduledActionsForRule for compliance policies
    if (transformed.scheduledActionsForRule && Array.isArray(transformed.scheduledActionsForRule)) {
      // Clean up scheduled actions by removing read-only properties but preserving structure
      transformed.scheduledActionsForRule = transformed.scheduledActionsForRule.map(rule => {
        const cleanRule = { ...rule };
        // Remove read-only properties from the rule
        delete cleanRule.id;
        
        // Clean up scheduledActionConfigurations if present
        if (cleanRule.scheduledActionConfigurations && Array.isArray(cleanRule.scheduledActionConfigurations)) {
          cleanRule.scheduledActionConfigurations = cleanRule.scheduledActionConfigurations.map(config => {
            const cleanConfig = { ...config };
            delete cleanConfig.id;
            return cleanConfig;
          });
        }
        
        return cleanRule;
      });
      console.log(`✅ Preserved and cleaned scheduledActionsForRule: ${transformed.scheduledActionsForRule.length} rules`);
    } else if (originalODataType && originalODataType.includes('CompliancePolicy')) {
      // If this is a compliance policy but has no scheduledActionsForRule, create a default one
      transformed.scheduledActionsForRule = [
        {
          ruleName: "PasswordRequired",
          scheduledActionConfigurations: [
            {
              actionType: "block",
              gracePeriodHours: 0,
              notificationTemplateId: "",
              notificationMessageCCList: []
            }
          ]
        }
      ];
      console.log(`✅ Created default scheduledActionsForRule for compliance policy`);
    }
    
    // For device compliance and configuration policies, preserve the @odata.type
    // as it's required to specify the concrete implementation
    if (originalODataType) {
      transformed['@odata.type'] = originalODataType;
      console.log(`✅ Preserving @odata.type: ${originalODataType}`);
    }
    
    // Apply customizations
    if (customizations.displayName) {
      transformed.displayName = customizations.displayName;
    } else {
      transformed.displayName = `${sourcePolicy.displayName} (Cloned)`;
    }

    if (customizations.description) {
      transformed.description = customizations.description;
    }

    // Reset version for new policy
    if (transformed.version) {
      transformed.version = 1;
    }
    
    // Remove any null or undefined values that might cause issues
    Object.keys(transformed).forEach(key => {
      if (transformed[key] === null || transformed[key] === undefined) {
        delete transformed[key];
      }
    });
    
    // Log the cleaned policy for debugging
    console.log(`🧹 Cleaned policy for creation:`, {
      displayName: transformed.displayName,
      odataType: transformed['@odata.type'],
      keys: Object.keys(transformed),
      hasScheduledActions: !!transformed.scheduledActionsForRule,
      preservedODataType: !!originalODataType
    });

    return transformed;
  }

  /**
   * Recursively clean secret references from policy objects
   * @param {Object} obj - The object to clean
   * @param {Array} secretReferencesRemoved - Array to track removed secret references
   * @param {string} path - Current path in the object (for logging)
   */
  cleanSecretReferences(obj, secretReferencesRemoved, path = '') {
    if (!obj || typeof obj !== 'object') return;

    // Check if this is an array
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        this.cleanSecretReferences(item, secretReferencesRemoved, `${path}[${index}]`);
      });
      return;
    }

    // Process each property in the object
    const keysToDelete = [];
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      // Check for secret reference patterns
      if (this.isSecretReference(key, value)) {
        keysToDelete.push(key);
        secretReferencesRemoved.push({
          path: currentPath,
          key: key,
          type: this.getSecretReferenceType(key, value),
          description: this.getSecretReferenceDescription(key, value),
          originalValue: typeof value === 'string' && value.length > 100 ? `${value.substring(0, 50)}...` : value
        });
        console.log(`🔐 Removing secret reference: ${currentPath} = ${key}`);
        continue;
      }

      // Recursively process nested objects
      if (value && typeof value === 'object') {
        this.cleanSecretReferences(value, secretReferencesRemoved, currentPath);
      }
    }

    // Remove secret reference keys
    keysToDelete.forEach(key => {
      delete obj[key];
    });
  }

  /**
   * Verify that no secret references remain in the policy (final check)
   * @param {Object} obj - The object to verify
   * @param {Array} remainingSecrets - Array to track any remaining secrets
   * @param {string} path - Current path in the object
   */
  verifyNoSecretsRemain(obj, remainingSecrets, path = '') {
    if (!obj || typeof obj !== 'object') return;

    // Skip our internal metadata - both in path and at root level
    if (path.includes('_secretReferencesRemoved')) return;

    // Check if this is an array
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        this.verifyNoSecretsRemain(item, remainingSecrets, `${path}[${index}]`);
      });
      return;
    }

    // Process each property in the object
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      // Skip internal metadata fields completely
      if (key === '_secretReferencesRemoved') {
        console.log(`🔍 Skipping internal metadata field: ${currentPath}`);
        continue;
      }
      
      // Check for secret reference patterns
      if (this.isSecretReference(key, value)) {
        remainingSecrets.push({
          path: currentPath,
          key: key,
          value: typeof value === 'string' && value.length > 100 ? `${value.substring(0, 50)}...` : value
        });
      }

      // Recursively process nested objects
      if (value && typeof value === 'object') {
        this.verifyNoSecretsRemain(value, remainingSecrets, currentPath);
      }
    }
  }

  /**
   * Check if a key-value pair represents a secret reference
   * @param {string} key - The property key
   * @param {*} value - The property value
   * @returns {boolean} True if this is a secret reference
   */
  isSecretReference(key, value) {
    // Exclude internal metadata fields from secret detection
    if (key === '_secretReferencesRemoved' || key.startsWith('_')) {
      return false;
    }

    // Direct secret reference patterns (case-insensitive)
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

  /**
   * Get the type of secret reference for categorization
   * @param {string} key - The property key
   * @param {*} value - The property value
   * @returns {string} The secret reference type
   */
  getSecretReferenceType(key, value) {
    if (key.toLowerCase().includes('certificate')) return 'certificate';
    if (key.toLowerCase().includes('password')) return 'password';
    if (key.toLowerCase().includes('secret')) return 'shared_secret';
    if (key.toLowerCase().includes('key')) return 'encryption_key';
    if (key.toLowerCase().includes('credential')) return 'credential';
    return 'unknown_secret';
  }

  /**
   * Get a human-readable description for the secret reference
   * @param {string} key - The property key
   * @param {*} value - The property value
   * @returns {string} Human-readable description
   */
  getSecretReferenceDescription(key, value) {
    const type = this.getSecretReferenceType(key, value);
    
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

  // Helper method to detect permission errors
  isPermissionError(errorMessage) {
    if (!errorMessage) return false;
    
    const permissionIndicators = [
      'Application is not authorized to perform this operation',
      'DeviceManagementConfiguration.ReadWrite',
      'DeviceManagementApps.ReadWrite',
      'DeviceManagementServiceConfig.ReadWrite',
      'Insufficient privileges',
      'Access denied',
      'Permission denied',
      'Authorization_RequestDenied',
      'Forbidden'
    ];

    // Handle both string and object inputs
    let errorText = '';
    if (typeof errorMessage === 'string') {
      errorText = errorMessage.toLowerCase();
    } else if (typeof errorMessage === 'object') {
      errorText = JSON.stringify(errorMessage).toLowerCase();
    } else {
      return false;
    }
    
    return permissionIndicators.some(indicator => 
      errorText.includes(indicator.toLowerCase())
    );
  }

  // Method to request additional permissions
  async requestAdditionalPermissions() {
    console.log('🔐 Requesting additional permissions for policy management...');
    
    const requiredScopes = [
      'DeviceManagementConfiguration.ReadWrite.All',
      'DeviceManagementApps.ReadWrite.All',
      'DeviceManagementServiceConfig.ReadWrite.All',
      'Policy.ReadWrite.ConditionalAccess'
    ];

    try {
      // Use the target tenant to request additional permissions
      const permissionResponse = await this.targetTenant.sendMCPRequest('tools/call', {
        name: 'add-graph-permission',
        arguments: {
          scopes: requiredScopes
        }
      });

      console.log('✅ Additional permissions requested successfully:', permissionResponse);

      // Emit event to frontend to inform user about permission request
      this.io.to(this.sessionId).emit('permissions_requested', {
        tenantRole: 'target',
        tenantDomain: this.targetTenant.tenantDomain,
        requiredScopes,
        message: 'Additional permissions required for policy creation. Please complete the authentication flow in your browser.',
        authUrl: 'http://localhost:3200'
      });

      return permissionResponse;
      
    } catch (error) {
      console.error('❌ Failed to request additional permissions:', error);
      
      // Emit event to frontend about permission request failure
      this.io.to(this.sessionId).emit('permission_request_failed', {
        tenantRole: 'target',
        tenantDomain: this.targetTenant.tenantDomain,
        error: error.message,
        message: 'Failed to request additional permissions. Please try authenticating again with administrator privileges.'
      });
      
      throw error;
    }
  }

  convertPoliciesToClientFormat(policies) {
    const formatted = {};
    
    for (const [policyType, policyList] of policies) {
      formatted[policyType] = policyList.map(policy => ({
        // Include all policy data for full JSON editing capabilities
        ...policy,
        // Ensure consistent policyType field
        policyType: policy.policyType || policyType
      }));
    }

    return formatted;
  }

  getTotalPolicyCount(policies) {
    let count = 0;
    for (const [, policyList] of policies) {
      count += policyList.length;
    }
    return count;
  }

  getStatus() {
    return {
      isActive: this.isActive,
      sourceTenant: this.sourceTenant ? {
        domain: this.sourceTenant.tenantDomain,
        connected: this.sourceTenant.isConnected,
        authenticated: this.sourceTenant.authStatus === 'authenticated'
      } : null,
      targetTenant: this.targetTenant ? {
        domain: this.targetTenant.tenantDomain,
        connected: this.targetTenant.isConnected,
        authenticated: this.targetTenant.authStatus === 'authenticated'
      } : null,
      policyCount: this.getTotalPolicyCount(this.policies.source),
      activeMigrations: this.migrations.size
    };
  }

  async cleanup() {
    if (this.sourceTenant) {
      await this.sourceTenant.cleanup();
    }
    if (this.targetTenant) {
      await this.targetTenant.cleanup();
    }
    this.policies.source.clear();
    this.policies.target.clear();
    this.migrations.clear();
  }
}

// Real MCP Client class for communicating with Lokka Microsoft MCP server
class MCPClient {
  constructor(sessionId, tenantDomain, io, tenantRole = 'primary') {
    this.sessionId = sessionId;
    this.tenantDomain = tenantDomain;
    this.tenantRole = tenantRole; // 'primary', 'source', or 'target'
    this.io = io; // Socket.IO instance for emitting events
    this.process = null;
    this.isConnected = false;
    this.hasInitialized = false;
    this.requestId = 0;
    this.pendingRequests = new Map();
    this.availableTools = [];
    this.accessToken = null;
    this.authStatus = 'not_authenticated';
  }

  async start() {
    return new Promise((resolve, reject) => {
      try {
        console.log(`Starting Lokka Microsoft MCP server for tenant: ${this.tenantDomain} (${this.tenantRole})`);
        
        // Different redirect URIs for different tenant roles to avoid conflicts
        const redirectPorts = {
          'primary': '3000',
          'source': '3001', 
          'target': '3002'
        };
        
        const redirectUri = `http://localhost:${redirectPorts[this.tenantRole]}/auth/success`;
        
        // Spawn the Lokka MCP server process with interactive authentication
        this.process = spawn('npx', ['-y', '@merill/lokka'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...process.env,
            USE_INTERACTIVE: 'true',
            REDIRECT_URI: redirectUri,
            // Set tenant domain if provided (for organizational logins)
            ...(this.tenantDomain && !this.tenantDomain.includes('.onmicrosoft.com') ? {} : {
              TENANT_ID: this.tenantDomain.replace('.onmicrosoft.com', '')
            })
          }
        });

        // Handle stderr (errors and logs)
        this.process.stderr.on('data', (data) => {
          const errorOutput = data.toString();
          console.error(`MCP server stderr: ${errorOutput}`);
          
          // Check for authentication errors
          if (errorOutput.includes('authentication') || errorOutput.includes('credentials') || errorOutput.includes('login')) {
            console.log('Authentication issue detected - will provide guidance to user');
          }
        });

        // Handle stdout (JSON-RPC responses)
        let buffer = '';
        this.process.stdout.on('data', (data) => {
          buffer += data.toString();
          
          // Process complete JSON-RPC messages
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer
          
          for (const line of lines) {
            if (line.trim()) {
              try {
                const message = JSON.parse(line.trim());
                this.handleMCPMessage(message);
              } catch (error) {
                console.error('Error parsing MCP message:', error, 'Raw line:', line);
              }
            }
          }
        });

        // Handle process errors
        this.process.on('error', (error) => {
          console.error(`MCP server process error: ${error.message}`);
          reject(new Error(`Failed to start MCP server: ${error.message}`));
        });

        this.process.on('exit', (code, signal) => {
          console.log(`MCP server process exited with code ${code}, signal ${signal}`);
          this.isConnected = false;
          
          // Don't treat authentication-related exits as fatal errors
          if (code === 1 && !this.hasInitialized) {
            console.log('MCP server likely needs authentication setup - providing guidance');
          }
        });

        // Initialize the MCP connection
        this.initializeMCP()
          .then(() => {
            console.log(`Lokka MCP server connected for session: ${this.sessionId}`);
            this.isConnected = true;
            this.hasInitialized = true;
            
            // Start periodic auth check if not authenticated
            if (this.authStatus !== 'authenticated') {
              this.startAuthMonitoring();
            }
            
            resolve();
          })
          .catch((error) => {
            console.error(`Failed to initialize Lokka MCP server: ${error.message}`);
            // Don't reject for authentication issues - provide guidance instead
            if (error.message.includes('timeout') || error.message.includes('authentication')) {
              console.log('Lokka MCP server initialization failed - likely authentication issue');
              this.hasInitialized = false;
              this.isConnected = false;
              resolve(); // Resolve so the session continues, but provide auth guidance
            } else {
              reject(error);
            }
          });

      } catch (error) {
        console.error('Failed to start MCP server:', error);
        reject(error);
      }
    });
  }

  async initializeMCP() {
    try {
      // Send initialize request
      const initResponse = await this.sendMCPRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        clientInfo: {
          name: 'icb-agent',
          version: '1.0.0'
        }
      });

      console.log('Lokka MCP Initialize response:', initResponse);

      // Get available tools
      const toolsResponse = await this.sendMCPRequest('tools/list', {});
      this.availableTools = toolsResponse.tools || [];
      
      console.log(`Available Lokka MCP tools: ${this.availableTools.map(t => t.name).join(', ')}`);

      // Check authentication status
      await this.checkAuthStatus();
      
    } catch (error) {
      console.error('Error initializing Lokka MCP server:', error);
      throw error;
    }
  }

  async checkAuthStatus() {
    try {
      const authResponse = await this.sendMCPRequest('tools/call', {
        name: 'get-auth-status',
        arguments: {}
      });

      console.log('Lokka authentication status:', authResponse);
      
      const previousStatus = this.authStatus;
      
      // Parse the authentication response correctly
      let authData = null;
      if (authResponse.content && Array.isArray(authResponse.content) && authResponse.content[0]) {
        try {
          authData = JSON.parse(authResponse.content[0].text);
        } catch (parseError) {
          console.error('Error parsing auth status:', parseError);
        }
      } else if (authResponse.content && authResponse.content.isAuthenticated) {
        authData = authResponse.content;
      }
      
      if (authData && authData.isReady && authData.tokenStatus && !authData.tokenStatus.isExpired) {
        this.authStatus = 'authenticated';
        this.accessToken = 'authenticated'; // Lokka manages the actual token
        
        // Emit authentication success event
        if (previousStatus !== 'authenticated') {
          // For dual-tenant sessions, extract the base sessionId once
          const baseSessionId = this.sessionId.replace(/_source$|_target$/, '');
          const isDualTenant = baseSessionId !== this.sessionId;
          
          // Emit to the specific sessionId (could be with _source/_target suffix)
          this.io.to(this.sessionId).emit('auth_status_changed', {
            status: 'authenticated',
            message: `Authentication successful! You can now query your Microsoft 365 tenant.`,
            hasToken: true,
            tenantDomain: this.tenantDomain,
            tenantRole: this.tenantRole // Add tenant role info
          });
          
          // Also emit MCP status ready to ensure UI updates
          this.io.to(this.sessionId).emit('mcp_status', {
            status: 'ready',
            message: `Connected to Microsoft 365 tenant: ${this.tenantDomain}`,
            authenticated: true,
            tenantDomain: this.tenantDomain,
            tenantRole: this.tenantRole
          });
          
          // For dual-tenant sessions, also emit to the base sessionId
          if (isDualTenant) {
            // This is a dual-tenant session, emit to base session too
            this.io.to(baseSessionId).emit('auth_status_changed', {
              status: 'authenticated',
              message: `${this.tenantRole} tenant authentication successful! You can now query your Microsoft 365 tenant.`,
              hasToken: true,
              tenantDomain: this.tenantDomain,
              tenantRole: this.tenantRole
            });
            
            this.io.to(baseSessionId).emit('mcp_status', {
              status: 'ready',
              message: `${this.tenantRole} tenant connected to Microsoft 365: ${this.tenantDomain}`,
              authenticated: true,
              tenantDomain: this.tenantDomain,
              tenantRole: this.tenantRole
            });
          }
          
          // Update session status
          const sessionToUpdate = activeSessions.has(this.sessionId) ? this.sessionId : baseSessionId;
          
          if (activeSessions.has(sessionToUpdate)) {
            const session = activeSessions.get(sessionToUpdate);
            session.status = 'authenticated';
            session.authenticatedAt = new Date();
          } else if (dualTenantSessions.has(baseSessionId)) {
            // For dual-tenant sessions, we don't update activeSessions but could track in dualManager
            console.log(`Authentication successful for dual-tenant role: ${this.tenantRole} in session ${baseSessionId}`);
          }
          
          // Stop authentication monitoring since we're now authenticated
          if (this.authMonitorInterval) {
            clearInterval(this.authMonitorInterval);
            this.authMonitorInterval = null;
            console.log(`Authentication monitoring stopped for session ${this.sessionId}`);
          }
          
          console.log(`Authentication successful for session ${this.sessionId}`);
        }
      } else {
        this.authStatus = 'needs_authentication';
        
        // Emit authentication needed event
        if (previousStatus !== 'needs_authentication') {
          // For dual-tenant sessions, extract the base sessionId once
          const baseSessionId = this.sessionId.replace(/_source$|_target$/, '');
          const isDualTenant = baseSessionId !== this.sessionId;
          
          this.io.to(this.sessionId).emit('auth_status_changed', {
            status: 'needs_authentication',
            message: 'Please complete the authentication process in your browser window.',
            hasToken: false,
            tenantDomain: this.tenantDomain,
            tenantRole: this.tenantRole,
            authUrl: 'http://localhost:3200'
          });
          
          // For dual-tenant sessions, also emit to the base sessionId
          if (isDualTenant) {
            this.io.to(baseSessionId).emit('auth_status_changed', {
              status: 'needs_authentication',
              message: `${this.tenantRole} tenant requires authentication. Please complete the sign-in process.`,
              hasToken: false,
              tenantDomain: this.tenantDomain,
              tenantRole: this.tenantRole,
              authUrl: 'http://localhost:3200'
            });
          }
          
          console.log('Lokka MCP server requires authentication - browser window should have opened');
        }
      }
      
    } catch (error) {
      console.error('Error checking auth status:', error);
      const previousStatus = this.authStatus;
      this.authStatus = 'authentication_error';
      
      // Emit error event
      if (previousStatus !== 'authentication_error') {
        // For dual-tenant sessions, extract the base sessionId once
        const baseSessionId = this.sessionId.replace(/_source$|_target$/, '');
        const isDualTenant = baseSessionId !== this.sessionId;
        
        this.io.to(this.sessionId).emit('auth_status_changed', {
          status: 'authentication_error',
          message: `Authentication error: ${error.message}`,
          hasToken: false,
          tenantDomain: this.tenantDomain,
          tenantRole: this.tenantRole
        });
        
        // For dual-tenant sessions, also emit to the base sessionId
        if (isDualTenant) {
          this.io.to(baseSessionId).emit('auth_status_changed', {
            status: 'authentication_error',
            message: `${this.tenantRole} tenant authentication error: ${error.message}`,
            hasToken: false,
            tenantDomain: this.tenantDomain,
            tenantRole: this.tenantRole
          });
        }
      }
    }
  }

  sendMCPRequest(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      const request = {
        jsonrpc: '2.0',
        id: id,
        method: method,
        params: params
      };

      // Store the promise callbacks
      this.pendingRequests.set(id, { resolve, reject });

      // Send the request
      const requestStr = JSON.stringify(request) + '\n';
      this.process.stdin.write(requestStr);

      // Set timeout
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`MCP request timeout: ${method}`));
        }
      }, 30000);
    });
  }

  handleMCPMessage(message) {
    if (message.id && this.pendingRequests.has(message.id)) {
      const { resolve, reject } = this.pendingRequests.get(message.id);
      this.pendingRequests.delete(message.id);

      if (message.error) {
        reject(new Error(`MCP Error: ${message.error.message}`));
      } else {
        resolve(message.result);
      }
    }
  }

  async sendMessage(userMessage) {
    if (!this.isConnected) {
      return {
        id: uuidv4(),
        message: this.getConnectionGuidance(userMessage),
        timestamp: new Date().toISOString(),
        type: 'connection_guidance'
      };
    }

    // Check if we need to handle authentication
    if (this.authStatus !== 'authenticated') {
      return {
        id: uuidv4(),
        message: await this.handleAuthentication(userMessage),
        timestamp: new Date().toISOString(),
        type: 'auth_status'
      };
    }

    try {
      console.log(`Processing message via Lokka MCP server: ${userMessage}`);
      
      // PRIORITY 1: Always try Lokka MCP first for ALL queries
      let response = await this.processWithLokkaMCP(userMessage);
      
      if (response) {
        console.log(`✅ Successfully processed with Lokka MCP`);
        return {
          id: uuidv4(),
          message: response,
          timestamp: new Date().toISOString(),
          type: 'mcp_response'
        };
      }
      
      // FALLBACK: Only if Lokka MCP fails completely
      console.log(`⚠️ Lokka MCP processing failed, falling back to help message`);
      response = this.getFallbackHelp(userMessage);
      
      return {
        id: uuidv4(),
        message: response,
        timestamp: new Date().toISOString(),
        type: 'fallback_response'
      };

    } catch (error) {
      console.error(`Error processing message via Lokka MCP: ${error.message}`);
      throw error;
    }
  }

  async processWithLokkaMCP(userMessage) {
    try {
      // First, try specific tool matching
      const specificToolCalls = this.analyzeMessageForTools(userMessage);
      
      if (specificToolCalls.length > 0) {
        console.log(`🎯 Found ${specificToolCalls.length} specific tool matches`);
        return await this.executeSpecificTools(specificToolCalls, userMessage);
      }
      
      // Second, try general Graph API queries
      console.log(`🔍 No specific tools found, trying general Graph API queries`);
      const generalResponse = await this.tryGeneralGraphQueries(userMessage);
      
      if (generalResponse) {
        return generalResponse;
      }
      
      // Third, try intelligent query expansion
      console.log(`🧠 Trying intelligent query expansion`);
      const expandedResponse = await this.tryIntelligentQueryExpansion(userMessage);
      
      if (expandedResponse) {
        return expandedResponse;
      }
      
      return null; // No results found
      
    } catch (error) {
      console.error(`Error in Lokka MCP processing: ${error.message}`);
      return null;
    }
  }

  async executeSpecificTools(toolCalls, originalMessage) {
    let response = '';
    
    for (const toolCall of toolCalls) {
      try {
        console.log(`Calling MCP tool: ${toolCall.name} with args:`, toolCall.arguments);
        
        const toolResponse = await this.sendMCPRequest('tools/call', {
          name: toolCall.name,
          arguments: toolCall.arguments
        });
        
        console.log(`MCP tool response received for ${toolCall.name}`);
        
        // Check if response indicates permission error
        if (this.isPermissionError(toolResponse)) {
          const permissionResponse = await this.handlePermissionRequest(toolCall, originalMessage);
          response += permissionResponse + '\n\n';
        } else {
          const formattedResponse = this.formatToolResponse(toolCall.name, toolResponse);
          response += formattedResponse + '\n\n';
        }
        
      } catch (error) {
        console.error(`Error calling MCP tool ${toolCall.name}:`, error);
        
        // Check if error is permission-related
        if (this.isPermissionError(error)) {
          const permissionResponse = await this.handlePermissionRequest(toolCall, originalMessage);
          response += permissionResponse + '\n\n';
        } else {
          response += `❌ **Error calling ${toolCall.name}:** ${error.message}\n\n`;
        }
      }
    }
    
    return response.trim() || null;
  }

  async tryGeneralGraphQueries(userMessage) {
    const lowerMessage = userMessage.toLowerCase();
    const generalQueries = this.analyzeGeneralQuery(lowerMessage);
    
    if (generalQueries.length === 0) {
      return null;
    }
    
    console.log(`Attempting ${generalQueries.length} general Graph API queries for: "${userMessage}"`);
    
    let response = `🔍 **Microsoft 365 Search Results for: "${userMessage}"**\n\n`;
    let hasResults = false;
    
    // Try each potential query
    for (const query of generalQueries) {
      try {
        console.log(`Trying general query: ${query.endpoint}`);
        
        const toolResponse = await this.sendMCPRequest('tools/call', {
          name: 'Lokka-Microsoft',
          arguments: {
            apiType: 'graph',
            graphApiVersion: 'v1.0',
            method: 'get',
            path: query.endpoint,
            queryParams: query.queryParams || {}
          }
        });
        
        const formattedResponse = this.formatToolResponse('Lokka-Microsoft', toolResponse);
        if (formattedResponse && !formattedResponse.includes('Error')) {
          response += `**${query.description}:**\n${formattedResponse}\n\n`;
          hasResults = true;
        }
        
      } catch (error) {
        console.error(`General query failed for ${query.endpoint}:`, error);
        // Continue to next query without showing error to user
      }
    }
    
    return hasResults ? response.trim() : null;
  }

  async tryIntelligentQueryExpansion(userMessage) {
    // Try to intelligently expand the query to common Graph API endpoints
    const expandedQueries = this.generateIntelligentQueries(userMessage);
    
    if (expandedQueries.length === 0) {
      return null;
    }
    
    console.log(`Trying ${expandedQueries.length} intelligent query expansions`);
    
    let response = `🤖 **AI-Enhanced Search for: "${userMessage}"**\n\n`;
    let hasResults = false;
    
    for (const query of expandedQueries) {
      try {
        const toolResponse = await this.sendMCPRequest('tools/call', {
          name: 'Lokka-Microsoft',
          arguments: query.arguments
        });
        
        const formattedResponse = this.formatToolResponse('Lokka-Microsoft', toolResponse);
        if (formattedResponse && !formattedResponse.includes('Error')) {
          response += `**${query.description}:**\n${formattedResponse}\n\n`;
          hasResults = true;
        }
        
      } catch (error) {
        console.error(`Intelligent query failed for ${query.description}:`, error);
      }
    }
    
    return hasResults ? response.trim() : null;
  }

  generateIntelligentQueries(userMessage) {
    const lowerMessage = userMessage.toLowerCase();
    const queries = [];
    
    // Common search terms that might relate to various Graph API endpoints
    const searchTerms = {
      // User-related terms
      'user': ['/users', '/me/profile'],
      'people': ['/users', '/me/people'],
      'person': ['/users'],
      'employee': ['/users'],
      'staff': ['/users'],
      
      // Device-related terms
      'device': ['/deviceManagement/managedDevices', '/devices'],
      'computer': ['/deviceManagement/managedDevices'],
      'phone': ['/deviceManagement/managedDevices'],
      'tablet': ['/deviceManagement/managedDevices'],
      'mobile': ['/deviceManagement/managedDevices'],
      
      // Security-related terms
      'security': ['/security/alerts_v2', '/identityGovernance/privilegedAccess'],
      'alert': ['/security/alerts_v2'],
      'threat': ['/security/alerts_v2'],
      'risk': ['/identityProtection/riskyUsers'],
      
      // License-related terms
      'license': ['/subscribedSkus', '/users'],
      'subscription': ['/subscribedSkus'],
      'plan': ['/subscribedSkus'],
      
      // Group-related terms
      'group': ['/groups'],
      'team': ['/teams', '/groups'],
      'channel': ['/teams'],
      
      // App-related terms
      'app': ['/applications', '/servicePrincipals'],
      'application': ['/applications'],
      'service': ['/servicePrincipals'],
      
      // Mail-related terms
      'mail': ['/me/messages', '/users'],
      'email': ['/me/messages', '/users'],
      'message': ['/me/messages'],
      
      // File-related terms
      'file': ['/me/drive/root/children', '/drives'],
      'document': ['/me/drive/root/children'],
      'folder': ['/me/drive/root/children'],
      
      // Calendar-related terms
      'calendar': ['/me/calendars', '/me/events'],
      'event': ['/me/events'],
      'meeting': ['/me/events'],
      'appointment': ['/me/events']
    };
    
    // Find matching terms and generate queries
    for (const [term, endpoints] of Object.entries(searchTerms)) {
      if (lowerMessage.includes(term)) {
        for (const endpoint of endpoints) {
          queries.push({
            description: `${term.charAt(0).toUpperCase() + term.slice(1)} Information`,
            arguments: {
              apiType: 'graph',
              graphApiVersion: 'v1.0',
              method: 'get',
              path: endpoint,
              queryParams: this.getOptimalQueryParams(endpoint)
            }
          });
        }
      }
    }
    
    // Remove duplicates based on endpoint
    const uniqueQueries = queries.filter((query, index, self) => 
      index === self.findIndex(q => q.arguments.path === query.arguments.path)
    );
    
    return uniqueQueries.slice(0, 5); // Limit to 5 queries to avoid overwhelming
  }

  getOptimalQueryParams(endpoint) {
    // Return optimal query parameters for different endpoints
    const paramMap = {
      '/users': { '$select': 'displayName,userPrincipalName,assignedLicenses,lastSignInDateTime', '$top': '20' },
      '/deviceManagement/managedDevices': { '$select': 'deviceName,operatingSystem,complianceState,lastSyncDateTime,userDisplayName', '$top': '20' },
      '/groups': { '$select': 'displayName,description,groupTypes,createdDateTime', '$top': '20' },
      '/applications': { '$select': 'displayName,appId,createdDateTime', '$top': '20' },
      '/servicePrincipals': { '$select': 'displayName,appId,servicePrincipalType', '$top': '20' },
      '/subscribedSkus': { '$select': 'skuPartNumber,consumedUnits,prepaidUnits' },
      '/security/alerts_v2': { '$top': '10' },
      '/me/messages': { '$select': 'subject,from,receivedDateTime,isRead', '$top': '10' },
      '/me/events': { '$select': 'subject,start,end,organizer', '$top': '10' },
      '/me/drive/root/children': { '$select': 'name,size,lastModifiedDateTime,webUrl', '$top': '20' },
      '/drives': { '$select': 'name,driveType,quota', '$top': '10' }
    };
    
    return paramMap[endpoint] || { '$top': '20' };
  }

  getFallbackHelp(userMessage) {
    return `🤖 **Connected to Microsoft 365 via Lokka MCP**

I tried to find information for: "${userMessage}" but couldn't locate specific results.

**✅ Test Markdown Rendering:**

Here's a sample of what proper markdown should look like:

• **John Doe** (john.doe@company.com)
  └ Last sign-in: 12/15/2024 | Licenses: 3
• **Jane Smith** (jane.smith@company.com)  
  └ Last sign-in: 12/14/2024 | Licenses: 2
• **Bob Johnson** (bob.johnson@company.com)
  └ Last sign-in: Never | Licenses: 1

**👥 User & Identity Management:**
• "show me all users" | "list users" | "user information"
• "show me external users" | "guest users" | "directory roles"

**📱 Device Management:**
• "show me all devices" | "ios devices" | "android devices" | "windows devices"
• "compliance status" | "device sync" | "managed devices"

**🔒 Security & Compliance:**
• "security alerts" | "conditional access policies" | "risk users"
• "audit logs" | "sign-in activity" | "authentication methods"

**📊 Licenses & Subscriptions:**
• "license usage" | "subscription status" | "sku information"

**🏢 Organization & Apps:**
• "tenant information" | "registered applications" | "service principals"
• "domains" | "organization details"

**🌐 Collaboration:**
• "sharepoint sites" | "teams" | "groups" | "channels"
• "mail" | "calendars" | "files" | "drives"

**💡 Pro Tips:**
• All queries use **native Lokka MCP** with Microsoft Graph API v1.0
• Responses include **intelligent insights** and **actionable recommendations**
• Try natural language like "What's our security status?" or "Show me non-compliant devices"

**🔧 Current Connection:** Authenticated with full Graph API access
**📈 Query Processing:** 100% Lokka MCP + Graph API (no external tools)

Ask me anything about your Microsoft 365 environment!`;
  }

  async handleAuthentication(userMessage) {
    try {
      // Re-check authentication status
      await this.checkAuthStatus();
      
      if (this.authStatus === 'authenticated') {
        return `✅ **Authentication Successful!**

Great! You're now authenticated with Microsoft 365 for tenant: **${this.tenantDomain}**

🎉 **Your access token has been received and stored.**

You can now ask me anything about your Microsoft 365 environment:
• "Show me all users in the tenant"
• "What are the current security policies?"
• "List all SharePoint sites"
• "Check for security alerts"
• "Show me license usage"

**Your question:** "${userMessage}"

I'm processing this now...`;
      } else {
        return `🔐 **Microsoft 365 Authentication Required**

I understand you asked: "${userMessage}"

**🚀 Authentication Process:**

1. **Browser Window** - Lokka should have opened a authentication window in your default browser
2. **Sign In** - Please complete the sign-in process for tenant: **${this.tenantDomain}**
3. **Grant Permissions** - Allow the requested Microsoft Graph permissions
4. **Return Here** - Once complete, your token will be automatically available

**🔄 Current Status:** ${this.authStatus}

**💡 If the browser window didn't open:**
- Check if pop-ups are blocked
- Look for a new tab/window in your browser
- The authentication URL should be: \`http://localhost:3200\`

**⏱️ Please complete the authentication process and ask your question again.**

Once authenticated, I'll be able to provide live Microsoft 365 data for your tenant!`;
      }
    } catch (error) {
      return `❌ **Authentication Error**

There was an issue with the authentication process: ${error.message}

**🔧 Troubleshooting:**
1. Ensure your browser allows pop-ups from this domain
2. Check that port 3200 is available for the redirect URI
3. Try refreshing the page and starting over

**💬 Your question:** "${userMessage}" will be processed once authentication is complete.`;
    }
  }

  getConnectionGuidance(userMessage) {
    return `🔗 **Connecting to Lokka Microsoft MCP Server**

I understand you asked: "${userMessage}"

**🚀 Starting Authentication Process:**

The Lokka MCP server is initializing for tenant: **${this.tenantDomain}**

This will trigger an interactive authentication flow where:
1. A browser window will open automatically
2. You'll be asked to sign in to Microsoft 365
3. You'll need to grant permissions for Microsoft Graph API access
4. Your access token will be securely stored

**⏳ Please wait while the connection is established...**

Once connected and authenticated, I'll be able to help you with:
• User management and directory services
• License allocation and usage analysis  
• Security monitoring and compliance status
• SharePoint sites and document analytics
• Teams and Groups management
• Exchange Online mailbox information
• Comprehensive tenant health reporting

**🔄 Connection Status:** Initializing Lokka MCP server...`;
  }

  analyzeMessageForTools(message) {
    const lowerMessage = message.toLowerCase();
    const toolCalls = [];

    // Check if Lokka-Microsoft tool is available
    const lokkaTool = this.availableTools.find(tool => 
      tool.name === 'Lokka-Microsoft' || tool.name.includes('lokka') || tool.name.includes('microsoft')
    );

    if (!lokkaTool) {
      console.log('No Lokka-Microsoft tool found in available tools:', this.availableTools.map(t => t.name));
      return [];
    }

    const toolName = lokkaTool.name;

    // Enhanced user query analysis with specific filtering
    if (lowerMessage.includes('users') || lowerMessage.includes('list users') || lowerMessage.includes('user')) {
      const userQueryParams = this.buildUserQueryParams(message, lowerMessage);
      toolCalls.push({
        name: toolName,
        arguments: {
          apiType: 'graph',
          graphApiVersion: 'v1.0',
          method: 'get',
          path: '/users',
          queryParams: userQueryParams
        }
      });
    }

    if (lowerMessage.includes('license') || lowerMessage.includes('licensing')) {
      toolCalls.push({
        name: toolName,
        arguments: {
          apiType: 'graph',
          graphApiVersion: 'v1.0',
          method: 'get',
          path: '/subscribedSkus'
        }
      });
    }

    if (lowerMessage.includes('security') || lowerMessage.includes('alerts')) {
      toolCalls.push({
        name: toolName,
        arguments: {
          apiType: 'graph',
          graphApiVersion: 'v1.0',
          method: 'get',
          path: '/security/alerts_v2',
          queryParams: {
            '$top': '10'
          }
        }
      });
    }

    if (lowerMessage.includes('signin') || lowerMessage.includes('sign-in') || lowerMessage.includes('activity')) {
      toolCalls.push({
        name: toolName,
        arguments: {
          apiType: 'graph',
          graphApiVersion: 'v1.0',
          method: 'get',
          path: '/auditLogs/signIns',
          queryParams: {
            '$top': '20',
            '$orderby': 'createdDateTime desc'
          }
        }
      });
    }

    if (lowerMessage.includes('sharepoint') || lowerMessage.includes('sites')) {
      toolCalls.push({
        name: toolName,
        arguments: {
          apiType: 'graph',
          graphApiVersion: 'v1.0',
          method: 'get',
          path: '/sites',
          queryParams: {
            '$select': 'displayName,webUrl,createdDateTime,lastModifiedDateTime'
          }
        }
      });
    }

    if (lowerMessage.includes('groups') || lowerMessage.includes('teams')) {
      toolCalls.push({
        name: toolName,
        arguments: {
          apiType: 'graph',
          graphApiVersion: 'v1.0',
          method: 'get',
          path: '/groups',
          queryParams: {
            '$select': 'displayName,description,groupTypes,createdDateTime'
          }
        }
      });
    }

    if (lowerMessage.includes('organization') || lowerMessage.includes('tenant info')) {
      toolCalls.push({
        name: toolName,
        arguments: {
          apiType: 'graph',
          graphApiVersion: 'v1.0',
          method: 'get',
          path: '/organization'
        }
      });
    }

    // Enhanced device queries with specific device name filtering and "show all" support
    if (lowerMessage.includes('devices') || lowerMessage.includes('device') || lowerMessage.includes('managed devices') || 
        lowerMessage.includes('ios') || lowerMessage.includes('iphone') || lowerMessage.includes('ipad') ||
        lowerMessage.includes('android') || lowerMessage.includes('windows') || lowerMessage.includes('macos')) {
      
      const deviceQueryParams = this.buildDeviceQueryParams(message, lowerMessage);
      console.log('🔍 Built device query params:', deviceQueryParams);
      
      toolCalls.push({
        name: toolName,
        arguments: {
          apiType: 'graph',
          graphApiVersion: 'v1.0',
          method: 'get',
          path: '/deviceManagement/managedDevices',
          queryParams: deviceQueryParams
        }
      });
    }

    if (lowerMessage.includes('applications') || lowerMessage.includes('apps') || lowerMessage.includes('registered apps')) {
      toolCalls.push({
        name: toolName,
        arguments: {
          apiType: 'graph',
          graphApiVersion: 'v1.0',
          method: 'get',
          path: '/applications',
          queryParams: {
            '$select': 'displayName,appId,createdDateTime,signInAudience'
          }
        }
      });
    }

    if (lowerMessage.includes('contacts') || lowerMessage.includes('directory contacts')) {
      toolCalls.push({
        name: toolName,
        arguments: {
          apiType: 'graph',
          graphApiVersion: 'v1.0',
          method: 'get',
          path: '/contacts',
          queryParams: {
            '$select': 'displayName,emailAddresses,companyName,jobTitle'
          }
        }
      });
    }

    return toolCalls;
  }

  // Helper method to build enhanced user query parameters
  buildUserQueryParams(originalMessage, lowerMessage) {
    let queryParams = {
      '$select': 'displayName,userPrincipalName,assignedLicenses,accountEnabled,lastSignInDateTime,createdDateTime,userType,jobTitle,department'
    };

    let filterConditions = [];

    // Check for specific user name or email in the query
    const specificUserMatch = this.extractSpecificIdentifier(originalMessage, ['user', 'person', 'employee']);
    if (specificUserMatch) {
      // Search for users by display name or user principal name
      filterConditions.push(`startswith(displayName,'${specificUserMatch}') or startswith(userPrincipalName,'${specificUserMatch}')`);
      console.log('🎯 Searching for specific user:', specificUserMatch);
    }

    // Check for external/guest user queries
    if (lowerMessage.includes('external') || lowerMessage.includes('guest')) {
      filterConditions.push("userType eq 'Guest'");
    }

    // Check for enabled/disabled status
    if (lowerMessage.includes('disabled') || lowerMessage.includes('inactive')) {
      filterConditions.push("accountEnabled eq false");
    } else if (lowerMessage.includes('enabled') || lowerMessage.includes('active')) {
      filterConditions.push("accountEnabled eq true");
    }

    // Handle "show all" requests by increasing the limit
    if (lowerMessage.includes('show all') || lowerMessage.includes('list all') || lowerMessage.includes('all users')) {
      queryParams['$top'] = '999'; // GraphAPI max is usually 999
      console.log('📊 User requested ALL users - setting $top to 999');
    } else {
      queryParams['$top'] = '50'; // Default reasonable limit
    }

    // Combine filter conditions
    if (filterConditions.length > 0) {
      queryParams['$filter'] = filterConditions.join(' and ');
    }

    return queryParams;
  }

  // Helper method to build enhanced device query parameters
  buildDeviceQueryParams(originalMessage, lowerMessage) {
    let queryParams = {
      '$select': 'deviceName,operatingSystem,osVersion,complianceState,lastSyncDateTime,enrolledDateTime,managedDeviceOwnerType,userDisplayName,emailAddress,model,manufacturer,serialNumber,id'
    };

    let filterConditions = [];

    // Check for specific device name in the query
    const specificDeviceName = this.extractSpecificIdentifier(originalMessage, ['device', 'computer', 'phone', 'tablet', 'laptop']);
    if (specificDeviceName) {
      // Search for devices by device name
      filterConditions.push(`startswith(deviceName,'${specificDeviceName}') or contains(deviceName,'${specificDeviceName}')`);
      console.log('🎯 Searching for specific device:', specificDeviceName);
    }

    // Check for specific OS-related queries  
    if (lowerMessage.includes('ios') || lowerMessage.includes('iphone') || lowerMessage.includes('ipad')) {
      filterConditions.push("operatingSystem eq 'iOS'");
    } else if (lowerMessage.includes('android')) {
      filterConditions.push("operatingSystem eq 'Android'");  
    } else if (lowerMessage.includes('windows')) {
      filterConditions.push("operatingSystem eq 'Windows'");
    } else if (lowerMessage.includes('macos')) {
      filterConditions.push("operatingSystem eq 'macOS'");
    }

    // Check for specific compliance-related queries
    if (lowerMessage.includes('grace period') || lowerMessage.includes('compliance grace')) {
      filterConditions.push("complianceState eq 'inGracePeriod'");
    } else if (lowerMessage.includes('non-compliant') || lowerMessage.includes('noncompliant')) {
      filterConditions.push("complianceState eq 'noncompliant'");
    } else if (lowerMessage.includes('compliant') && !lowerMessage.includes('non-compliant')) {
      filterConditions.push("complianceState eq 'compliant'");
    }

    // Check for specific user ownership
    const userOwnerMatch = this.extractUserFromDeviceQuery(originalMessage);
    if (userOwnerMatch) {
      filterConditions.push(`contains(userDisplayName,'${userOwnerMatch}') or contains(emailAddress,'${userOwnerMatch}')`);
      console.log('🎯 Filtering devices by user:', userOwnerMatch);
    }

    // Handle "show all" requests by removing the limit or setting it very high
    if (lowerMessage.includes('show all') || lowerMessage.includes('list all') || lowerMessage.includes('all devices')) {
      queryParams['$top'] = '999'; // GraphAPI max
      console.log('📊 User requested ALL devices - setting $top to 999');
    } else if (specificDeviceName) {
      queryParams['$top'] = '50'; // More results when searching for specific device
    } else {
      queryParams['$top'] = '25'; // Default reasonable limit
    }

    // Combine filter conditions
    if (filterConditions.length > 0) {
      queryParams['$filter'] = filterConditions.join(' and ');
    }

    return queryParams;
  }

  // Helper method to extract specific identifiers from user queries
  extractSpecificIdentifier(message, entityTypes) {
    // Look for patterns like "show me device ABC123" or "find user John Smith"
    const patterns = [
      // Pattern: "show me device XYZ", "find device XYZ", "search for device XYZ"
      new RegExp(`(?:show me|find|search for|get|locate)\\s+(?:${entityTypes.join('|')})\\s+([\\w\\-\\.@\\s]+?)(?:\\s|$|\\?|,)`, 'i'),
      // Pattern: "device XYZ", "user XYZ" (when not at start of sentence)
      new RegExp(`\\b(?:${entityTypes.join('|')})\\s+([\\w\\-\\.@\\s]+?)(?:\\s(?:is|has|was|does|can|should|will)|$|\\?|\\.|,)`, 'i'),
      // Pattern: quoted strings like "device 'ABC123'" or 'user "John Smith"'
      new RegExp(`(?:${entityTypes.join('|')})\\s+['"]([^'"]+)['"]`, 'i')
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        const identifier = match[1].trim();
        // Filter out common words that aren't identifiers
        const commonWords = ['all', 'any', 'some', 'the', 'a', 'an', 'that', 'this', 'with', 'in', 'on', 'for', 'by', 'named', 'called'];
        if (!commonWords.includes(identifier.toLowerCase()) && identifier.length > 1) {
          return identifier;
        }
      }
    }

    return null;
  }

  // Helper method to extract user information from device queries
  extractUserFromDeviceQuery(message) {
    const patterns = [
      // Pattern: "devices for user John", "devices owned by Jane"
      /(?:devices?|computers?|phones?|tablets?).*(?:for|owned by|belonging to|assigned to)\s+(?:user\s+)?([a-zA-Z][a-zA-Z0-9\.\-_@\s]+?)(?:\s|$|\?|,)/i,
      // Pattern: "John's devices", "Jane's computers"
      /([a-zA-Z][a-zA-Z0-9\.\-_@]+)'s\s+(?:devices?|computers?|phones?|tablets?)/i,
      // Pattern: "show me devices user:john.doe"
      /user:([a-zA-Z0-9\.\-_@]+)/i
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  analyzeGeneralQuery(lowerMessage) {
    const queries = [];
    
    // Security-related queries
    if (lowerMessage.includes('policies') || lowerMessage.includes('policy')) {
      queries.push({
        endpoint: '/policies/conditionalAccessPolicies',
        description: 'Conditional Access Policies',
        queryParams: { '$select': 'displayName,state,conditions,grantControls,sessionControls,createdDateTime' }
      });
      queries.push({
        endpoint: '/policies/authenticationMethodsPolicy',
        description: 'Authentication Methods Policy',
        queryParams: { '$select': 'displayName,description,policyVersion' }
      });
    }
    
    // Service principals and apps
    if (lowerMessage.includes('service principal') || lowerMessage.includes('enterprise app')) {
      queries.push({
        endpoint: '/servicePrincipals',
        description: 'Service Principals (Enterprise Applications)',
        queryParams: { '$select': 'displayName,appId,servicePrincipalType,createdDateTime', '$top': '20' }
      });
    }
    
    // Directory roles
    if (lowerMessage.includes('roles') || lowerMessage.includes('admin') || lowerMessage.includes('directory role')) {
      queries.push({
        endpoint: '/directoryRoles',
        description: 'Directory Roles',
        queryParams: { '$select': 'displayName,description,roleTemplateId' }
      });
      queries.push({
        endpoint: '/roleManagement/directory/roleAssignments',
        description: 'Role Assignments',
        queryParams: { '$select': 'principalId,roleDefinitionId,directoryScopeId', '$top': '20' }
      });
    }
    
    // External users
    if (lowerMessage.includes('external') || lowerMessage.includes('guest')) {
      queries.push({
        endpoint: '/users',
        description: 'External/Guest Users',
        queryParams: { 
          '$filter': "userType eq 'Guest'",
          '$select': 'displayName,userPrincipalName,userType,createdDateTime,externalUserState'
        }
      });
    }
    
    // Domains
    if (lowerMessage.includes('domain') || lowerMessage.includes('dns')) {
      queries.push({
        endpoint: '/domains',
        description: 'Tenant Domains',
        queryParams: { '$select': 'id,isDefault,isInitial,isVerified,supportedServices' }
      });
    }
    
    // Subscriptions and billing
    if (lowerMessage.includes('subscription') || lowerMessage.includes('billing') || lowerMessage.includes('plan')) {
      queries.push({
        endpoint: '/subscribedSkus',
        description: 'License Subscriptions',
        queryParams: { '$select': 'skuPartNumber,consumedUnits,prepaidUnits,servicePlans' }
      });
    }
    
    // Mail and Exchange
    if (lowerMessage.includes('mail') || lowerMessage.includes('exchange') || lowerMessage.includes('mailbox')) {
      queries.push({
        endpoint: '/users',
        description: 'Mailbox Information',
        queryParams: { 
          '$filter': 'assignedLicenses/$count ne 0',
          '$select': 'displayName,userPrincipalName,mail,mailNickname,proxyAddresses'
        }
      });
    }
    
    // Teams and channels
    if (lowerMessage.includes('team') || lowerMessage.includes('channel')) {
      queries.push({
        endpoint: '/teams',
        description: 'Microsoft Teams',
        queryParams: { '$select': 'displayName,description,createdDateTime,visibility' }
      });
    }
    
    // Calendar and events
    if (lowerMessage.includes('calendar') || lowerMessage.includes('event') || lowerMessage.includes('meeting')) {
      queries.push({
        endpoint: '/me/calendars',
        description: 'Calendars',
        queryParams: { '$select': 'name,color,isDefaultCalendar,canShare,canViewPrivateItems' }
      });
    }
    
    // Files and drives
    if (lowerMessage.includes('file') || lowerMessage.includes('drive') || lowerMessage.includes('onedrive')) {
      queries.push({
        endpoint: '/drives',
        description: 'OneDrive and SharePoint Drives',
        queryParams: { '$select': 'name,driveType,owner,quota,createdDateTime' }
      });
    }
    
    // Compliance and auditing
    if (lowerMessage.includes('audit') || lowerMessage.includes('compliance') || lowerMessage.includes('log')) {
      queries.push({
        endpoint: '/auditLogs/directoryAudits',
        description: 'Directory Audit Logs',
        queryParams: { '$top': '10', '$select': 'activityDisplayName,category,result,activityDateTime,initiatedBy' }
      });
    }
    
    return queries;
  }

  async getGeneralInfo(message) {
    const lowerMessage = message.toLowerCase();
    
    // Try to intelligently guess what Graph API endpoint might be relevant
    const generalQueries = this.analyzeGeneralQuery(lowerMessage);
    
    if (generalQueries.length > 0) {
      console.log(`Attempting general Graph API queries for: "${message}"`);
      
      let response = `🔍 **Searching Microsoft 365 for: "${message}"**\n\n`;
      
      // Try each potential query
      for (const query of generalQueries) {
        try {
          console.log(`Trying general query: ${query.endpoint}`);
          
          const toolResponse = await this.sendMCPRequest('tools/call', {
            name: 'Lokka-Microsoft',
            arguments: {
              apiType: 'graph',
              graphApiVersion: 'v1.0',
              method: 'get',
              path: query.endpoint,
              queryParams: query.queryParams || {}
            }
          });
          
          const formattedResponse = this.formatToolResponse('Lokka-Microsoft', toolResponse);
          response += `**${query.description}:**\n${formattedResponse}\n\n`;
          
        } catch (error) {
          console.error(`General query failed for ${query.endpoint}:`, error);
          // Don't show errors to user for general queries, just try the next one
        }
      }
      
      // If we got any results, return them
      if (response.length > 100) {
        return response.trim();
      }
    }
    
    // Fallback to help message if no general queries worked
    return `🤖 **Connected to Microsoft 365 tenant: ${this.tenantDomain}**

I understand you asked: "${message}"

I'm connected to your tenant via the Lokka-Microsoft MCP server and can help you with:

**👥 User Management:**
• "Show me all users" - List tenant users
• "List users" - User directory information

**� Device Management:**
• "Show me all devices" - List managed devices
• "What devices are in the tenant?" - Device inventory
• "List devices" - Device compliance status

**�📊 License Information:**
• "What's our license usage?" - License allocation
• "Show licenses" - Subscription details

**🔒 Security Status:**
• "Check security alerts" - Security monitoring
• "Show security status" - Compliance information

**📈 Activity Monitoring:**
• "Show sign-in activity" - Recent login events
• "User activity" - Authentication logs

**🏢 Organization & Apps:**
• "Show tenant info" - Organization details
• "List applications" - Registered applications
• "What apps are registered?" - App inventory

**🌐 Collaboration:**
• "List SharePoint sites" - Site collection info
• "Show groups and teams" - Group directory

**🔧 Technical Notes:**
• All queries use Microsoft Graph API v1.0 endpoints for maximum compatibility
• Device compliance queries include grace period expiration tracking
• Proper OData filtering is applied for specific compliance states

**📱 Enhanced Device Queries:**
• "Show me devices that are in grace period for compliance" - Devices in compliance grace period
• "Show me non-compliant devices" - Devices that are not compliant
• "Show me compliant devices" - Devices that are compliant

**💡 Try asking me questions like:**
• "What policies do we have?"
• "Show me service principals"
• "What conditional access policies exist?"
• "List directory roles"
• "Show me external users"
• "What domains are configured?"
• "Show me audit logs"

I'll try to find relevant information from your Microsoft 365 tenant!`;
  }

  formatToolResponse(toolName, toolResponse) {
    try {
      // The response might be in different formats depending on the MCP implementation
      let data = toolResponse;
      
      if (toolResponse.content) {
        data = toolResponse.content;
      }
      
      // Handle Lokka MCP response format with content array
      if (Array.isArray(data) && data[0] && data[0].text) {
        const responseText = data[0].text;
        console.log('📝 Raw Lokka response text (first 200 chars):', responseText.substring(0, 200));
        
        // Try to extract JSON from the response text
        let jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            data = JSON.parse(jsonMatch[0]);
            console.log('✅ Successfully extracted and parsed JSON from Lokka response');
          } catch (parseError) {
            console.error('Error parsing extracted JSON:', parseError);
            // If JSON parsing fails, return the raw text formatted nicely
            return `**Live Data from ${toolName}:**\n\n${responseText}`;
          }
        } else if (responseText.trim().startsWith('{') || responseText.trim().startsWith('[')) {
          try {
            data = JSON.parse(responseText);
            console.log('✅ Successfully parsed JSON response from Lokka MCP');
          } catch (parseError) {
            console.error('Error parsing Lokka JSON response:', parseError);
            // If JSON parsing fails, return the raw text formatted nicely
            return `**Live Data from ${toolName}:**\n\n${responseText}`;
          }
        } else {
          // It's plain text, return it formatted
          console.log('ℹ️ Received plain text response from Lokka MCP');
          return `**Response from ${toolName}:**\n\n${responseText}`;
        }
      }
      
      if (typeof data === 'string') {
        return data;
      }

      // Handle Microsoft Graph API responses
      if (data.value && Array.isArray(data.value)) {
        const items = data.value;
        console.log('📊 Processing Graph API response with', items.length, 'items');
        console.log('🔍 Context:', data['@odata.context']);
        console.log('🛠️ Tool name:', toolName);
        
        if (toolName.includes('users') || data['@odata.context']?.includes('users')) {
          console.log('👥 Formatting as users response');
          return this.formatUsersResponse(items);
        } else if (toolName.includes('subscribedSkus') || data['@odata.context']?.includes('subscribedSkus')) {
          console.log('📊 Formatting as license response');
          return this.formatLicenseResponse(items);
        } else if (toolName.includes('security') || data['@odata.context']?.includes('security')) {
          console.log('🔒 Formatting as security response');
          return this.formatSecurityResponse(items);
        } else if (toolName.includes('signIns') || data['@odata.context']?.includes('signIns')) {
          console.log('📈 Formatting as sign-in response');
          return this.formatSignInResponse(items);
        } else if (toolName.includes('sites') || data['@odata.context']?.includes('sites')) {
          console.log('🌐 Formatting as sites response');
          return this.formatSitesResponse(items);
        } else if (toolName.includes('groups') || data['@odata.context']?.includes('groups')) {
          console.log('👨‍👩‍👧‍👦 Formatting as groups response');
          return this.formatGroupsResponse(items);
        } else if (toolName.includes('organization') || data['@odata.context']?.includes('organization')) {
          console.log('🏢 Formatting as organization response');
          return this.formatOrganizationResponse(items);
        } else if (toolName.includes('devices') || toolName.includes('deviceManagement') || data['@odata.context']?.includes('deviceManagement')) {
          console.log('📱 Formatting as devices response');
          return this.formatDevicesResponse(items);
        } else if (toolName.includes('applications') || data['@odata.context']?.includes('applications')) {
          console.log('📋 Formatting as applications response');
          return this.formatApplicationsResponse(items);
        } else if (toolName.includes('contacts') || data['@odata.context']?.includes('contacts')) {
          console.log('👤 Formatting as contacts response');
          return this.formatContactsResponse(items);
        }
        
        console.log('⚠️ No specific formatter found, using default array conversion');
        return this.convertArrayToMarkdown(items, toolName);
      }

      // Handle single objects - convert to markdown
      if (typeof data === 'object' && data !== null) {
        console.log('📄 Converting single object to markdown');
        return this.convertObjectToMarkdown(data, toolName);
      }

      // Default formatting for unknown responses
      return `**Live Data from ${toolName}:**\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;

    } catch (error) {
      console.error(`Error formatting response from ${toolName}:`, error);
      return `**Error formatting response from ${toolName}:** ${error.message}`;
    }
  }

  // New method to convert arrays to markdown format
  convertArrayToMarkdown(items, toolName) {
    if (!items || items.length === 0) {
      return `**No data found from ${toolName}**`;
    }

    // Take first few items to avoid overwhelming the user
    const displayItems = items.slice(0, 15);
    let markdown = `**Data from ${toolName}** (${items.length} total${items.length > 15 ? ', showing first 15' : ''})\n\n`;

    displayItems.forEach((item, index) => {
      markdown += `### Item ${index + 1}\n\n`;
      markdown += this.convertObjectToMarkdown(item, '', false);
      markdown += '\n\n---\n\n';
    });

    if (items.length > 15) {
      markdown += `*...and ${items.length - 15} more items*`;
    }

    return markdown.trim();
  }

  // New method to convert objects to markdown format
  convertObjectToMarkdown(obj, toolName = '', includeTitle = true) {
    if (!obj || typeof obj !== 'object') {
      return `**${toolName}:** ${obj}`;
    }

    let markdown = '';
    
    if (includeTitle && toolName) {
      markdown += `**Data from ${toolName}:**\n\n`;
    }

    // Convert object properties to markdown list
    const entries = Object.entries(obj);
    
    entries.forEach(([key, value]) => {
      // Skip null, undefined, or empty values
      if (value === null || value === undefined || value === '') {
        return;
      }

      // Format the key nicely
      const formattedKey = key
        .replace(/([A-Z])/g, ' $1') // Add space before capitals
        .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
        .replace(/Id$/, 'ID') // Fix ID capitalization
        .replace(/Url$/, 'URL') // Fix URL capitalization
        .replace(/Api$/, 'API'); // Fix API capitalization

      if (Array.isArray(value)) {
        if (value.length === 0) {
          markdown += `• **${formattedKey}:** None\n`;
        } else if (value.length <= 5) {
          // For small arrays, show all items
          const arrayItems = value.map(item => 
            typeof item === 'object' ? JSON.stringify(item) : String(item)
          ).join(', ');
          markdown += `• **${formattedKey}:** ${arrayItems}\n`;
        } else {
          // For large arrays, show count and first few items
          const preview = value.slice(0, 3).map(item => 
            typeof item === 'object' ? JSON.stringify(item) : String(item)
          ).join(', ');
          markdown += `• **${formattedKey}:** ${preview}... (${value.length} total)\n`;
        }
      } else if (typeof value === 'object') {
        // For nested objects, show key properties
        const nestedEntries = Object.entries(value).slice(0, 3);
        const nestedText = nestedEntries.map(([k, v]) => `${k}: ${v}`).join(', ');
        markdown += `• **${formattedKey}:** ${nestedText}${Object.keys(value).length > 3 ? '...' : ''}\n`;
      } else if (typeof value === 'boolean') {
        markdown += `• **${formattedKey}:** ${value ? '✅ Yes' : '❌ No'}\n`;
      } else if (key.toLowerCase().includes('date') || key.toLowerCase().includes('time')) {
        // Format dates nicely
        try {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            markdown += `• **${formattedKey}:** ${date.toLocaleString()}\n`;
          } else {
            markdown += `• **${formattedKey}:** ${value}\n`;
          }
        } catch {
          markdown += `• **${formattedKey}:** ${value}\n`;
        }
      } else if (key.toLowerCase().includes('url') || key.toLowerCase().includes('link')) {
        // Format URLs as clickable links
        markdown += `• **${formattedKey}:** [${value}](${value})\n`;
      } else {
        // Regular value
        markdown += `• **${formattedKey}:** ${value}\n`;
      }
    });

    return markdown;
  }

  formatUsersResponse(users) {
    if (!users || users.length === 0) {
      return `👥 **No users found in ${this.tenantDomain}**`;
    }

    // Determine display limit based on total results and user intent
    let displayLimit = 20; // Default limit
    let showAllRequested = false;
    
    // Check if this is a "show all" request by looking at the total count
    if (users.length > 50 || users.length === 999) { // 999 indicates a "show all" request
      displayLimit = users.length; // Show all results
      showAllRequested = true;
      console.log('📊 Showing ALL users as requested:', users.length);
    } else if (users.length <= 5) {
      displayLimit = users.length; // Show all for small result sets
    }

    // For users, a table format is much more readable than a list
    const displayUsers = users.slice(0, displayLimit);
    
    let tableHtml = `<div class="data-table-container">
<h3><span class="status-emoji">👥</span> <strong>Users in ${this.tenantDomain}</strong> (${users.length} total${showAllRequested ? ', showing all' : `, showing first ${displayUsers.length}`})</h3>

<table class="data-table">
<thead>
<tr>
<th>Display Name</th>
<th>User Principal Name</th>
<th>Last Sign-in</th>
<th>Licenses</th>
<th>Enabled</th>
</tr>
</thead>
<tbody>`;

    displayUsers.forEach(user => {
      const lastSignIn = user.lastSignInDateTime 
        ? new Date(user.lastSignInDateTime).toLocaleDateString()
        : 'Never';
      
      const licenseCount = user.assignedLicenses ? user.assignedLicenses.length : 0;
      const isEnabled = user.accountEnabled ? '✅' : '❌';
      const displayName = user.displayName || 'N/A';
      const userPrincipalName = user.userPrincipalName || 'N/A';
      
      tableHtml += `
<tr>
<td><strong>${displayName}</strong></td>
<td><code>${userPrincipalName}</code></td>
<td>${lastSignIn === 'Never' ? '<em>Never</em>' : lastSignIn}</td>
<td><span class="license-count">${licenseCount}</span></td>
<td>${isEnabled}</td>
</tr>`;
    });

    tableHtml += `
</tbody>
</table>`;

    if (!showAllRequested && users.length > displayLimit) {
      tableHtml += `<p class="table-footer"><em>...and ${users.length - displayLimit} more users. <strong>Say "show me all users" to see the complete list.</strong></em></p>`;
    }
    
    tableHtml += `</div>`;
    
    return tableHtml;
  }

  formatLicenseResponse(licenses) {
    if (!licenses || licenses.length === 0) {
      return `📊 **No license information found for ${this.tenantDomain}**`;
    }

    const licenseList = licenses.map(sku => {
      const total = sku.prepaidUnits?.enabled || 0;
      const used = sku.consumedUnits || 0;
      const available = total - used;
      
      return `• **${sku.skuPartNumber}**\n  └ Used: ${used}/${total} (${available} available)`;
    }).join('\n');

    return `📊 **License Usage for ${this.tenantDomain}**

${licenseList}`;
  }

  formatSecurityResponse(alerts) {
    if (!alerts || alerts.length === 0) {
      return `🔒 **Security Status for ${this.tenantDomain}**\n\n✅ No active security alerts found.`;
    }

    const alertList = alerts.slice(0, 8).map(alert => {
      const created = new Date(alert.createdDateTime).toLocaleDateString();
      return `• **${alert.title || 'Security Alert'}** (${alert.severity || 'Unknown'})\n  └ Status: ${alert.status || 'Active'} | Created: ${created}`;
    }).join('\n');

    return `🔒 **Security Alerts for ${this.tenantDomain}** (${alerts.length} total)

${alertList}`;
  }

  formatSignInResponse(signIns) {
    if (!signIns || signIns.length === 0) {
      return `📈 **No recent sign-in activity found for ${this.tenantDomain}**`;
    }

    const signInList = signIns.slice(0, 12).map(signIn => {
      const time = new Date(signIn.createdDateTime).toLocaleString();
      const location = signIn.location?.city || 'Unknown location';
      const status = signIn.status?.errorCode ? '❌ Failed' : '✅ Success';
      
      return `• **${signIn.userDisplayName}** from ${location}\n  └ ${time} | ${status}`;
    }).join('\n');

    return `📈 **Recent Sign-ins for ${this.tenantDomain}** (${signIns.length} total, showing recent 12)

${signInList}`;
  }

  formatSitesResponse(sites) {
    if (!sites || sites.length === 0) {
      return `🌐 **No SharePoint sites found for ${this.tenantDomain}**`;
    }

    const siteList = sites.slice(0, 10).map(site => {
      const modified = new Date(site.lastModifiedDateTime).toLocaleDateString();
      return `• **${site.displayName}**\n  └ ${site.webUrl}\n  └ Last modified: ${modified}`;
    }).join('\n');

    return `🌐 **SharePoint Sites for ${this.tenantDomain}** (${sites.length} total, showing first 10)

${siteList}`;
  }

  formatGroupsResponse(groups) {
    if (!groups || groups.length === 0) {
      return `👨‍👩‍👧‍👦 **No groups found for ${this.tenantDomain}**`;
    }

    const groupList = groups.slice(0, 12).map(group => {
      const type = group.groupTypes?.includes('Unified') ? 'Microsoft 365 Group' : 'Security Group';
      const created = new Date(group.createdDateTime).toLocaleDateString();
      
      return `• **${group.displayName}**\n  └ Type: ${type} | Created: ${created}`;
    }).join('\n');

    return `👨‍👩‍👧‍👦 **Groups in ${this.tenantDomain}** (${groups.length} total, showing first 12)

${groupList}`;
  }

  formatOrganizationResponse(orgs) {
    if (!orgs || orgs.length === 0) {
      return `🏢 **No organization information found for ${this.tenantDomain}**`;
    }

    const org = orgs[0]; // Usually only one organization
    return `🏢 **Organization Information for ${this.tenantDomain}**

• **Display Name:** ${org.displayName}
• **Verified Domains:** ${org.verifiedDomains?.map(d => d.name).join(', ') || 'Not available'}
• **Created:** ${org.createdDateTime ? new Date(org.createdDateTime).toLocaleDateString() : 'Not available'}
• **Country:** ${org.countryLetterCode || 'Not specified'}`;
  }

  formatDevicesResponse(devices) {
    if (!devices || devices.length === 0) {
      return `📱 **No managed devices found for ${this.tenantDomain}**`;
    }

    // Determine if this is a filtered query based on the devices returned
    const osTypes = [...new Set(devices.map(d => d.operatingSystem).filter(Boolean))];
    let titlePrefix = '📱';
    let titleText = 'Managed Devices';
    
    if (osTypes.length === 1) {
      switch (osTypes[0]) {
        case 'iOS': 
          titlePrefix = '📱'; 
          titleText = 'iOS Devices';
          break;
        case 'Android': 
          titlePrefix = '🤖'; 
          titleText = 'Android Devices';
          break;
        case 'Windows': 
          titlePrefix = '💻'; 
          titleText = 'Windows Devices';
          break;
        case 'macOS': 
          titlePrefix = '🖥️'; 
          titleText = 'macOS Devices';
          break;
      }
    }

    // Determine display limit based on total results and user intent
    let displayLimit = 15; // Default limit for devices (fewer due to more columns)
    let showAllRequested = false;
    
    // Check if this is a "show all" request or specific device search
    if (devices.length > 25 || devices.length === 999) { // 999 indicates a "show all" request
      displayLimit = devices.length; // Show all results
      showAllRequested = true;
      console.log('📊 Showing ALL devices as requested:', devices.length);
    } else if (devices.length <= 10) {
      displayLimit = devices.length; // Show all for small result sets (likely specific searches)
    } else if (devices.length <= 25) {
      displayLimit = devices.length; // Show all for medium result sets
    }

    // For devices, table format is much more readable
    const displayDevices = devices.slice(0, displayLimit);
    
    let tableHtml = `<div class="data-table-container">
<h3><span class="status-emoji">${titlePrefix}</span> <strong>${titleText} in ${this.tenantDomain}</strong> (${devices.length} total${showAllRequested ? ', showing all' : `, showing first ${displayDevices.length}`})</h3>

<table class="data-table devices-table">
<thead>
<tr>
<th>Device Name</th>
<th>OS / Version</th>
<th>Compliance</th>
<th>Owner</th>
<th>Last Sync</th>
<th>Enrolled</th>
</tr>
</thead>
<tbody>`;

    displayDevices.forEach(device => {
      const lastSync = device.lastSyncDateTime 
        ? new Date(device.lastSyncDateTime).toLocaleDateString()
        : 'Never';
      const enrolled = device.enrolledDateTime
        ? new Date(device.enrolledDateTime).toLocaleDateString()
        : 'Unknown';
      const compliance = device.complianceState || 'Unknown';
      const os = device.operatingSystem || 'Unknown';
      const version = device.osVersion || 'Unknown';
      const deviceName = device.deviceName || 'Unknown Device';
      const owner = device.userDisplayName || device.emailAddress || 'Unknown';
      
      // Handle grace period expiration date
      let graceInfo = '';
      if (device.complianceGracePeriodExpirationDateTime && compliance === 'inGracePeriod') {
        const graceExpiry = new Date(device.complianceGracePeriodExpirationDateTime);
        const now = new Date();
        const daysLeft = Math.ceil((graceExpiry - now) / (1000 * 60 * 60 * 24));
        graceInfo = ` (${daysLeft}d left)`;
      }
      
      // Add compliance status emoji and styling
      let complianceCell = '';
      switch (compliance) {
        case 'compliant': 
          complianceCell = `<span class="compliance-status compliant">✅ Compliant</span>`;
          break;
        case 'noncompliant': 
          complianceCell = `<span class="compliance-status noncompliant">❌ Non-compliant</span>`;
          break;
        case 'inGracePeriod': 
          complianceCell = `<span class="compliance-status grace-period">⏳ Grace Period${graceInfo}</span>`;
          break;
        case 'conflict': 
          complianceCell = `<span class="compliance-status conflict">⚠️ Conflict</span>`;
          break;
        default: 
          complianceCell = `<span class="compliance-status unknown">❓ Unknown</span>`;
          break;
      }
      
      tableHtml += `
<tr>
<td><strong>${deviceName}</strong></td>
<td><code>${os} ${version}</code></td>
<td>${complianceCell}</td>
<td><em>${owner}</em></td>
<td>${lastSync === 'Never' ? '<em>Never</em>' : lastSync}</td>
<td>${enrolled === 'Unknown' ? '<em>Unknown</em>' : enrolled}</td>
</tr>`;
    });

    tableHtml += `
</tbody>
</table>`;

    // Add summary statistics
    const complianceStats = devices.reduce((stats, device) => {
      const state = device.complianceState || 'unknown';
      stats[state] = (stats[state] || 0) + 1;
      return stats;
    }, {});

    // Add OS breakdown if multiple OS types
    const osStats = devices.reduce((stats, device) => {
      const os = device.operatingSystem || 'unknown';
      stats[os] = (stats[os] || 0) + 1;
      return stats;
    }, {});

    if (Object.keys(complianceStats).length > 1) {
      const statsList = Object.entries(complianceStats)
        .map(([state, count]) => `${state}: ${count}`)
        .join(', ');
      tableHtml += `<div class="table-summary"><strong>Compliance Summary:</strong> ${statsList}</div>`;
    }
    
    if (Object.keys(osStats).length > 1) {
      const osList = Object.entries(osStats)
        .map(([os, count]) => `${os}: ${count}`)
        .join(', ');
      tableHtml += `<div class="table-summary"><strong>OS Breakdown:</strong> ${osList}</div>`;
    }

    if (!showAllRequested && devices.length > displayLimit) {
      tableHtml += `<p class="table-footer"><em>...and ${devices.length - displayLimit} more devices. <strong>Say "show me all devices" to see the complete list.</strong></em></p>`;
    }
    
    tableHtml += `</div>`;
    
    return tableHtml;
  }

  formatApplicationsResponse(apps) {
    if (!apps || apps.length === 0) {
      return `📋 **No registered applications found for ${this.tenantDomain}**`;
    }

    const appList = apps.slice(0, 12).map(app => {
      const created = app.createdDateTime 
        ? new Date(app.createdDateTime).toLocaleDateString()
        : 'Unknown';
      const audience = app.signInAudience || 'Unknown';
      
      return `• **${app.displayName || 'Unknown App'}**\n  └ App ID: ${app.appId || 'N/A'} | Audience: ${audience} | Created: ${created}`;
    }).join('\n');

    return `📋 **Registered Applications in ${this.tenantDomain}** (${apps.length} total, showing first 12)

${appList}

${apps.length > 12 ? `\n*...and ${apps.length - 12} more applications*` : ''}`;
  }

  formatContactsResponse(contacts) {
    if (!contacts || contacts.length === 0) {
      return `👤 **No contacts found for ${this.tenantDomain}**`;
    }

    const contactList = contacts.slice(0, 10).map(contact => {
      const email = contact.emailAddresses && contact.emailAddresses[0] 
        ? contact.emailAddresses[0].address 
        : 'No email';
      const company = contact.companyName || 'No company';
      const title = contact.jobTitle || 'No title';
      
      return `• **${contact.displayName || 'Unknown Contact'}**\n  └ ${email} | ${company} | ${title}`;
    }).join('\n');

    return `👤 **Contacts in ${this.tenantDomain}** (${contacts.length} total, showing first 10)

${contactList}

${contacts.length > 10 ? `\n*...and ${contacts.length - 10} more contacts*` : ''}`;
  }

  async getAccessToken() {
    if (this.accessToken) {
      return this.accessToken;
    }

    try {
      // Try to get the current token from Lokka
      const authResponse = await this.sendMCPRequest('tools/call', {
        name: 'get-auth-status',
        arguments: {}
      });

      if (authResponse.content && authResponse.content.accessToken) {
        this.accessToken = authResponse.content.accessToken;
        return this.accessToken;
      }
    } catch (error) {
      console.error('Error getting access token:', error);
    }

    return null;
  }

  getAuthenticationStatus() {
    return {
      status: this.authStatus,
      isAuthenticated: this.authStatus === 'authenticated',
      hasToken: !!this.accessToken,
      tenantDomain: this.tenantDomain,
      sessionId: this.sessionId
    };
  }

  startAuthMonitoring() {
    if (this.authMonitorInterval) {
      clearInterval(this.authMonitorInterval);
    }
    
    console.log(`Starting authentication monitoring for session ${this.sessionId}`);
    
    // Check authentication status every 5 seconds
    this.authMonitorInterval = setInterval(async () => {
      try {
        if (this.authStatus === 'authenticated') {
          // Stop monitoring once authenticated
          clearInterval(this.authMonitorInterval);
          this.authMonitorInterval = null;
          return;
        }
        
        await this.checkAuthStatus();
        
      } catch (error) {
        console.error('Error during auth monitoring:', error);
      }
    }, 5000);
  }

  stopAuthMonitoring() {
    if (this.authMonitorInterval) {
      clearInterval(this.authMonitorInterval);
      this.authMonitorInterval = null;
      console.log(`Stopped authentication monitoring for session ${this.sessionId}`);
    }
  }

  isPermissionError(response) {
    // Check for permission-related errors in response or error object
    const responseText = this.getResponseText(response);
    
    const permissionIndicators = [
      'insufficient privileges',
      'access denied',
      'forbidden',
      'unauthorized',
      'permission',
      'consent required',
      'scope',
      'AADSTS',
      'InsufficientPrivileges',
      'Forbidden',
      'Authorization_RequestDenied'
    ];
    
    return permissionIndicators.some(indicator => 
      responseText.toLowerCase().includes(indicator.toLowerCase())
    );
  }

  getResponseText(response) {
    if (typeof response === 'string') {
      return response;
    }
    
    if (response?.message) {
      return response.message;
    }
    
    if (response?.content && Array.isArray(response.content) && response.content[0]?.text) {
      return response.content[0].text;
    }
    
    if (response?.content) {
      return JSON.stringify(response.content);
    }
    
    return JSON.stringify(response);
  }

  isPermissionError(response) {
    // Check for permission-related errors in response or error object
    const responseText = this.getResponseText(response);
    
    const permissionIndicators = [
      'insufficient privileges',
      'access denied',
      'forbidden',
      'unauthorized',
      'permission',
      'consent required',
      'scope',
      'AADSTS',
      'InsufficientPrivileges',
      'Forbidden',
      'Authorization_RequestDenied'
    ];
    
    return permissionIndicators.some(indicator => 
      responseText.toLowerCase().includes(indicator.toLowerCase())
    );
  }

  getResponseText(response) {
    if (typeof response === 'string') {
      return response;
    }
    
    if (response?.message) {
      return response.message;
    }
    
    if (response?.content && Array.isArray(response.content) && response.content[0]?.text) {
      return response.content[0].text;
    }
    
    if (response?.content) {
      return JSON.stringify(response.content);
    }
    
    return JSON.stringify(response);
  }

  async handlePermissionRequest(toolCall, originalMessage) {
    try {
      console.log(`Handling permission request for tool: ${toolCall.name}`);
      
      // Determine required permissions based on the API endpoint
      const requiredScopes = this.getRequiredScopes(toolCall);
      
      if (requiredScopes.length === 0) {
        return `❌ **Permission Error**: Unable to determine required permissions for this request.`;
      }
      
      // Store the original query for rerun after permission approval
      this.pendingQuery = {
        toolCall: toolCall,
        originalMessage: originalMessage,
        timestamp: new Date().toISOString()
      };
      
      console.log(`Requesting additional permissions: ${requiredScopes.join(', ')}`);
      
      // Start monitoring for permission approval
      this.startPermissionMonitoring();
      
      // Request additional permissions via Lokka MCP
      try {
        const permissionResponse = await this.sendMCPRequest('tools/call', {
          name: 'add-graph-permission',
          arguments: {
            scopes: requiredScopes
          }
        });
        
        console.log('Permission request response:', permissionResponse);
        
        // Emit permission request event to frontend
        this.io.to(this.sessionId).emit('permission_request', {
          scopes: requiredScopes,
          endpoint: toolCall.arguments.path,
          originalMessage: originalMessage,
          timestamp: new Date().toISOString()
        });
        
        return `🔐 **Additional Permissions Required**

To process your request: "${originalMessage}"

**Required Microsoft Graph Permissions:**
${requiredScopes.map(scope => `• ${scope}`).join('\n')}

**🚀 Permission Request Process:**

1. **Browser Window Opening** - A new tab will open for permission consent
2. **Review Permissions** - Please review and approve the requested permissions
3. **Grant Access** - Click "Accept" to grant the required permissions
4. **Automatic Redirect** - You'll be redirected back to the ICB Agent
5. **Query Rerun** - Your original query will be automatically processed

**⏳ Please complete the permission consent process...**

Once permissions are granted, I'll automatically rerun your query and provide the results!`;
        
      } catch (permissionError) {
        console.error('Error requesting permissions:', permissionError);
        return `❌ **Permission Request Failed**

Unable to request additional permissions: ${permissionError.message}

**Required Permissions:**
${requiredScopes.map(scope => `• ${scope}`).join('\n')}

**Manual Steps:**
1. Contact your Microsoft 365 administrator
2. Request the above permissions for the Lokka MCP application
3. Try your query again once permissions are granted`;
      }
      
    } catch (error) {
      console.error('Error handling permission request:', error);
      return `❌ **Permission Error**: ${error.message}`;
    }
  }

  getRequiredScopes(toolCall) {
    const path = toolCall.arguments?.path || '';
    const scopes = [];
    
    // Map API endpoints to required permissions
    const scopeMapping = {
      '/users': ['User.Read.All', 'Directory.Read.All'],
      '/subscribedSkus': ['Organization.Read.All'],
      '/security/alerts': ['SecurityEvents.Read.All'],
      '/security/alerts_v2': ['SecurityEvents.Read.All'],
      '/auditLogs/signIns': ['AuditLog.Read.All', 'Directory.Read.All'],
      '/sites': ['Sites.Read.All'],
      '/groups': ['Group.Read.All', 'Directory.Read.All'],
      '/organization': ['Organization.Read.All'],
      '/deviceManagement/managedDevices': ['DeviceManagementManagedDevices.Read.All'],
      '/applications': ['Application.Read.All', 'Directory.Read.All'],
      '/contacts': ['Contacts.Read'],
      '/identity/conditionalAccess/policies': ['Policy.Read.All', 'Policy.ReadWrite.ConditionalAccess', 'Directory.Read.All'],
      '/directoryRoles': ['RoleManagement.Read.Directory', 'Directory.Read.All'],
      '/servicePrincipals': ['Application.Read.All', 'Directory.Read.All'],
      '/domains': ['Domain.Read.All', 'Directory.Read.All'],
      '/deviceManagement/deviceCompliancePolicies': ['DeviceManagementConfiguration.Read.All'],
      '/deviceManagement/deviceConfigurations': ['DeviceManagementConfiguration.Read.All']
    };
    
    // Find matching scope requirements
    for (const [endpoint, requiredScopes] of Object.entries(scopeMapping)) {
      if (path.includes(endpoint)) {
        scopes.push(...requiredScopes);
        break;
      }
    }
    
    // Remove duplicates
    return [...new Set(scopes)];
  }

  async rerunPendingQuery() {
    if (!this.pendingQuery) {
      console.log('No pending query to rerun');
      return null;
    }
    
    console.log('Rerunning pending query after permission approval');
    
    const { toolCall, originalMessage } = this.pendingQuery;
    this.pendingQuery = null; // Clear pending query
    
    try {
      const toolResponse = await this.sendMCPRequest('tools/call', {
        name: toolCall.name,
        arguments: toolCall.arguments
      });
      
      const formattedResponse = this.formatToolResponse(toolCall.name, toolResponse);
      
      const response = {
        id: uuidv4(),
        message: `✅ **Permissions Approved - Query Completed!**

Your original request: "${originalMessage}"

${formattedResponse}`,
        timestamp: new Date().toISOString(),
        type: 'permission_approved_response'
      };
      
      // Emit the response to the frontend
      this.io.to(this.sessionId).emit('query_rerun_complete', response);
      
      return response;
      
    } catch (error) {
      console.error('Error rerunning query after permission approval:', error);
      
      const errorResponse = {
        id: uuidv4(),
        message: `❌ **Error after permission approval**

Your request: "${originalMessage}"

Unfortunately, there was still an error after granting permissions: ${error.message}

Please try your query again or contact support if the issue persists.`,
        timestamp: new Date().toISOString(),
        type: 'permission_error_response'
      };
      
      this.io.to(this.sessionId).emit('query_rerun_complete', errorResponse);
      return errorResponse;
    }
  }

  startPermissionMonitoring() {
    if (this.permissionMonitorInterval) {
      clearInterval(this.permissionMonitorInterval);
    }
    
    console.log(`Starting permission monitoring for session ${this.sessionId}`);
    
    // Check every 3 seconds for permission approval
    this.permissionMonitorInterval = setInterval(async () => {
      try {
        if (!this.pendingQuery) {
          // No pending query, stop monitoring
          clearInterval(this.permissionMonitorInterval);
          this.permissionMonitorInterval = null;
          return;
        }
        
        const previousStatus = this.authStatus;
        await this.checkAuthStatus();
        
        // If auth status changed to authenticated and we have a pending query
        if (this.authStatus === 'authenticated' && previousStatus !== 'authenticated' && this.pendingQuery) {
          console.log(`Permission approval detected for session ${this.sessionId}, rerunning query`);
          
          // Stop monitoring
          clearInterval(this.permissionMonitorInterval);
          this.permissionMonitorInterval = null;
          
          // Rerun the pending query
          await this.rerunPendingQuery();
        }
        
      } catch (error) {
        console.error('Error during permission monitoring:', error);
      }
    }, 3000);
    
    // Stop monitoring after 10 minutes to prevent infinite loops
    setTimeout(() => {
      if (this.permissionMonitorInterval) {
        console.log(`Permission monitoring timeout for session ${this.sessionId}`);
        clearInterval(this.permissionMonitorInterval);
        this.permissionMonitorInterval = null;
      }
    }, 600000); // 10 minutes
  }

  stopPermissionMonitoring() {
    if (this.permissionMonitorInterval) {
      clearInterval(this.permissionMonitorInterval);
      this.permissionMonitorInterval = null;
      console.log(`Stopped permission monitoring for session ${this.sessionId}`);
    }
  }

  async stop() {
    try {
      // Stop authentication monitoring
      this.stopAuthMonitoring();
      
      // Stop permission monitoring
      this.stopPermissionMonitoring();
      
      if (this.process) {
        this.process.kill('SIGTERM');
        
        // Wait a bit for graceful shutdown
        setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.process.kill('SIGKILL');
          }
        }, 5000);
        
        this.process = null;
      }
      
      this.isConnected = false;
      this.pendingRequests.clear();
      console.log(`Lokka MCP client stopped for session: ${this.sessionId}`);
    } catch (error) {
      console.error(`Error stopping Lokka MCP client: ${error.message}`);
    }
  }

  async cleanup() {
    await this.stop();
    this.availableTools = [];
    this.accessToken = null;
    this.authStatus = 'not_authenticated';
    this.pendingQuery = null;
  }
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve the new policy migration dashboard
app.get('/tenant-clone-new', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'tenant-clone-new.html'));
});

// Legacy tenant clone page
app.get('/tenant-clone', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'tenant-clone.html'));
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API Routes
app.post('/api/session/create', (req, res) => {
  const sessionId = uuidv4();
  const { tenantDomain } = req.body;
  
  if (!tenantDomain) {
    return res.status(400).json({ error: 'Tenant domain is required' });
  }
  
  // Validate domain format
  if (!isValidTenantDomain(tenantDomain)) {
    return res.status(400).json({ 
      error: 'Invalid domain format. Please provide a valid Microsoft 365 domain (e.g., contoso.onmicrosoft.com, contoso.com)' 
    });
  }
  
  activeSessions.set(sessionId, {
    id: sessionId,
    tenantDomain,
    createdAt: new Date(),
    status: 'initialized'
  });
  
  res.json({ sessionId, tenantDomain });
});

app.post('/api/mcp/start', async (req, res) => {
  const { sessionId, tenantDomain } = req.body;
  
  if (!sessionId || !activeSessions.has(sessionId)) {
    return res.status(400).json({ error: 'Invalid session ID' });
  }
  
  try {
    console.log(`Starting MCP server for session ${sessionId}, tenant: ${tenantDomain}`);
    
    // Create and start MCP client
    const mcpClient = new MCPClient(sessionId, tenantDomain, io);
    await mcpClient.start();
    
    // Store MCP connection
    mcpConnections.set(sessionId, mcpClient);
    
    // Update session status
    const session = activeSessions.get(sessionId);
    session.status = 'mcp_connected';
    session.mcpStartedAt = new Date();
    
    console.log(`MCP server started successfully for session ${sessionId}`);
    
    res.json({ 
      success: true, 
      message: 'MCP server started successfully',
      sessionId,
      status: 'connected'
    });
    
    // Emit to socket for real-time updates
    io.to(sessionId).emit('mcp_status', { 
      status: 'ready',
      message: 'Connected to Microsoft 365 tenant'
    });
    
  } catch (error) {
    console.error('Error starting MCP server:', error);
    
    // Clean up on error
    if (mcpConnections.has(sessionId)) {
      const mcpClient = mcpConnections.get(sessionId);
      await mcpClient.stop();
      mcpConnections.delete(sessionId);
    }
    
    res.status(500).json({ error: 'Failed to start MCP server: ' + error.message });
    
    // Emit error to socket
    io.to(sessionId).emit('mcp_status', { 
      status: 'error',
      message: 'Failed to connect to Microsoft 365 tenant'
    });
  }
});

app.post('/api/chat', async (req, res) => {
  const { sessionId, message } = req.body;
  
  if (!sessionId || !activeSessions.has(sessionId)) {
    return res.status(400).json({ error: 'Invalid session ID' });
  }
  
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }
  
  try {
    // Process chat message through AI agent
    const response = await processAIMessage(sessionId, message);
    console.log('📤 Sending response to frontend:', { 
      messageLength: response.message.length,
      messagePreview: response.message.substring(0, 200) + '...',
      responseType: response.type 
    });
    res.json({ response });
  } catch (error) {
    console.error('Error processing chat message:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

app.post('/api/reports/health-check', async (req, res) => {
  const { sessionId } = req.body;
  
  if (!sessionId || !activeSessions.has(sessionId)) {
    return res.status(400).json({ error: 'Invalid session ID' });
  }
  
  try {
    // Generate M365 Health Check Report
    const report = await generateHealthCheckReport(sessionId);
    res.json({ report });
  } catch (error) {
    console.error('Error generating health check report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('join_session', (sessionId) => {
    socket.join(sessionId);
    console.log(`Socket ${socket.id} joined session ${sessionId}`);
  });
  
  // Dual-Tenant Socket Events for Tenant Clone Feature
  socket.on('dual_tenant_init', async (data) => {
    const { sessionId, sourceTenant, targetTenant } = data;
    
    try {
      console.log(`🔄 Initializing dual-tenant session: ${sessionId}`);
      
      // Create dual tenant manager
      const dualManager = new DualTenantManager(sessionId, io);
      dualTenantSessions.set(sessionId, dualManager);
      
      // Initialize source tenant
      if (sourceTenant) {
        await dualManager.initializeSourceTenant(sourceTenant);
      }
      
      // Initialize target tenant  
      if (targetTenant) {
        await dualManager.initializeTargetTenant(targetTenant);
      }
      
      socket.emit('dual_tenant_initialized', {
        sessionId,
        status: dualManager.getStatus()
      });
      
    } catch (error) {
      console.error('Error initializing dual tenant session:', error);
      socket.emit('dual_tenant_error', {
        type: 'init_failed',
        error: error.message
      });
    }
  });
  
  socket.on('load_source_policies', async (data) => {
    const { sessionId } = data;
    
    try {
      if (!dualTenantSessions.has(sessionId)) {
        throw new Error('Dual tenant session not found');
      }
      
      const dualManager = dualTenantSessions.get(sessionId);
      await dualManager.loadSourcePolicies();
      
    } catch (error) {
      console.error('Error loading source policies:', error);
      socket.emit('source_policies_error', {
        error: error.message
      });
    }
  });
  
  socket.on('clone_policy', async (data) => {
    const { sessionId, policyId, policyType, customizations } = data;
    
    try {
      if (!dualTenantSessions.has(sessionId)) {
        throw new Error('Dual tenant session not found');
      }
      
      const dualManager = dualTenantSessions.get(sessionId);
      const result = await dualManager.clonePolicy(policyId, policyType, customizations);
      
      socket.emit('policy_clone_result', result);
      
    } catch (error) {
      console.error('Error cloning policy:', error);
      socket.emit('policy_clone_error', {
        policyId,
        policyType,
        error: error.message
      });
    }
  });
  
  socket.on('get_dual_tenant_status', (data) => {
    const { sessionId } = data;
    
    if (dualTenantSessions.has(sessionId)) {
      const dualManager = dualTenantSessions.get(sessionId);
      socket.emit('dual_tenant_status_update', dualManager.getStatus());
    } else {
      socket.emit('dual_tenant_status_update', { isActive: false });
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Clean up any orphaned sessions
    // Note: In production, you might want more sophisticated cleanup logic
  });
});

// Cleanup function for sessions
async function cleanupSession(sessionId) {
  console.log(`Cleaning up session: ${sessionId}`);
  
  // Stop MCP client if exists
  if (mcpConnections.has(sessionId)) {
    const mcpClient = mcpConnections.get(sessionId);
    await mcpClient.stop();
    mcpConnections.delete(sessionId);
  }
  
  // Clean up dual-tenant session if exists
  if (dualTenantSessions.has(sessionId)) {
    const dualManager = dualTenantSessions.get(sessionId);
    await dualManager.cleanup();
    dualTenantSessions.delete(sessionId);
  }
  
  // Remove session
  activeSessions.delete(sessionId);
  
  console.log(`Session ${sessionId} cleaned up`);
}

// Add endpoint to disconnect session
app.post('/api/session/disconnect', async (req, res) => {
  const { sessionId } = req.body;
  
  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID is required' });
  }
  
  try {
    await cleanupSession(sessionId);
    res.json({ success: true, message: 'Session disconnected successfully' });
  } catch (error) {
    console.error('Error disconnecting session:', error);
    res.status(500).json({ error: 'Failed to disconnect session' });
  }
});

// Authentication status endpoint
app.get('/api/auth/status/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  
  try {
    const mcpClient = mcpConnections.get(sessionId);
    
    if (!mcpClient) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const authStatus = mcpClient.getAuthenticationStatus();
    res.json(authStatus);
    
  } catch (error) {
    console.error('Error getting auth status:', error);
    res.status(500).json({ error: 'Failed to get authentication status' });
  }
});

// Get access token endpoint
app.get('/api/auth/token/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  
  try {
    const mcpClient = mcpConnections.get(sessionId);
    
    if (!mcpClient) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const token = await mcpClient.getAccessToken();
    
    if (token) {
      res.json({ 
        hasToken: true, 
        tokenPreview: token.substring(0, 20) + '...', // Only send preview for security
        expiresAt: null // Lokka manages token expiry
      });
    } else {
      res.json({ hasToken: false });
    }
    
  } catch (error) {
    console.error('Error getting access token:', error);
    res.status(500).json({ error: 'Failed to get access token' });
  }
});

// Force authentication re-check endpoint
app.post('/api/auth/refresh/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  
  try {
    const mcpClient = mcpConnections.get(sessionId);
    
    if (!mcpClient) {
      return res.status(404).json({ error: 'Session not found' });
    }

    await mcpClient.checkAuthStatus();
    const authStatus = mcpClient.getAuthenticationStatus();
    
    res.json(authStatus);
    
  } catch (error) {
    console.error('Error refreshing auth status:', error);
    res.status(500).json({ error: 'Failed to refresh authentication status' });
  }
});

// Rerun pending query endpoint (for permission approval completion)
app.post('/api/auth/rerun-query/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  
  try {
    const mcpClient = mcpConnections.get(sessionId);
    
    if (!mcpClient) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Check if there's a pending query to rerun
    if (!mcpClient.pendingQuery) {
      return res.json({ 
        success: false, 
        message: 'No pending query found',
        hasPendingQuery: false
      });
    }
    
    console.log(`Manually triggering pending query rerun for session ${sessionId}`);
    
    // Re-check authentication status first
    await mcpClient.checkAuthStatus();
    
    if (mcpClient.authStatus !== 'authenticated') {
      return res.json({
        success: false,
        message: 'Authentication required before rerunning query',
        authStatus: mcpClient.authStatus
      });
    }
    
    // Rerun the pending query
    const result = await mcpClient.rerunPendingQuery();
    
    res.json({
      success: true,
      message: 'Pending query rerun completed',
      result: result
    });
    
  } catch (error) {
    console.error('Error rerunning pending query:', error);
    res.status(500).json({ 
      error: 'Failed to rerun pending query: ' + error.message 
    });
  }
});

// Authentication redirect endpoint
app.get('/auth/callback', async (req, res) => {
  // This endpoint will handle the redirect from Lokka authentication
  console.log('Authentication callback received:', req.query);
  
  // Check if there are any sessions with pending queries that need permission approval
  for (const [sessionId, mcpClient] of mcpConnections.entries()) {
    if (mcpClient && mcpClient.pendingQuery) {
      console.log(`Found pending query for session ${sessionId}, checking auth status...`);
      
      // Check if authentication/permissions were approved
      try {
        await mcpClient.checkAuthStatus();
        
        // If authenticated, rerun the pending query
        if (mcpClient.authStatus === 'authenticated') {
          console.log(`Authentication successful, rerunning pending query for session ${sessionId}`);
          await mcpClient.rerunPendingQuery();
        }
      } catch (error) {
        console.error(`Error checking auth status for session ${sessionId}:`, error);
      }
    }
  }
  
  // Redirect user back to the main application with success indicator
  res.redirect('/?auth=success&permissions=approved');
});

// Authentication success page
app.get('/auth/success', async (req, res) => {
  // Check for sessions with pending queries and attempt to rerun them
  const permissionsApproved = req.query.permissions === 'approved';
  
  for (const [sessionId, mcpClient] of mcpConnections.entries()) {
    if (mcpClient && mcpClient.pendingQuery && permissionsApproved) {
      console.log(`Permissions approved, checking and rerunning query for session ${sessionId}`);
      
      try {
        // Re-check authentication status
        await mcpClient.checkAuthStatus();
        
        // If authenticated, rerun the pending query
        if (mcpClient.authStatus === 'authenticated') {
          await mcpClient.rerunPendingQuery();
        }
      } catch (error) {
        console.error(`Error rerunning query for session ${sessionId}:`, error);
      }
    }
  }
  
  res.send(`
    <html>
      <head>
        <title>Authentication Successful</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .success { color: #28a745; }
          .container { max-width: 500px; margin: 0 auto; }
          .button { 
            background: #007bff; 
            color: white; 
            padding: 10px 20px; 
            text-decoration: none; 
            border-radius: 5px; 
            display: inline-block; 
            margin-top: 20px;
          }
        </style>
        <script>
          // Notify parent window of successful authentication
          if (window.opener) {
            window.opener.postMessage({ 
              type: 'auth_success', 
              permissionsApproved: ${permissionsApproved}
            }, '*');
          }
        </script>
      </head>
      <body>
        <div class="container">
          <h1 class="success">✅ Authentication Successful!</h1>
          <p>You have successfully authenticated with Microsoft 365.</p>
          ${permissionsApproved ? '<p><strong>🎉 Permissions approved! Your query is being processed automatically.</strong></p>' : ''}
          <p>You can now return to the ICB Agent application to start querying your tenant data.</p>
          <a href="/" class="button">Return to ICB Agent</a>
          <script>
            // Automatically redirect after 3 seconds
            setTimeout(() => {
              if (window.opener) {
                window.close();
              } else {
                window.location.href = '/';
              }
            }, 3000);
          </script>
        </div>
      </body>
    </html>
  `);
});

// MCP Permission request endpoint for Zero Trust Assessment
app.post('/api/mcp/request-permissions', async (req, res) => {
  const { sessionId, scopes, context } = req.body;
  
  if (!sessionId || !activeSessions.has(sessionId)) {
    return res.status(400).json({ error: 'Invalid session ID' });
  }
  
  if (!scopes || !Array.isArray(scopes)) {
    return res.status(400).json({ error: 'Scopes array is required' });
  }
  
  try {
    const mcpClient = mcpConnections.get(sessionId);
    
    if (!mcpClient) {
      return res.status(404).json({ error: 'MCP client not found for session' });
    }

    console.log(`🔑 Requesting MCP permissions for session ${sessionId}:`, scopes);
    
    // Request additional permissions via Lokka MCP
    const permissionResponse = await mcpClient.sendMCPRequest('tools/call', {
      name: 'add-graph-permission',
      arguments: {
        scopes: scopes
      }
    });
    
    console.log('MCP permission request response:', permissionResponse);
    
    // Emit permission request to the frontend for UI updates
    if (context === 'zero-trust-assessment') {
      io.to(sessionId).emit('zero_trust_permission_request', {
        scopes: scopes,
        context: context,
        timestamp: new Date().toISOString()
      });
    }
    
    res.json({
      success: true,
      message: 'Permission request sent successfully',
      scopes: scopes,
      response: permissionResponse
    });
    
  } catch (error) {
    console.error('Error requesting MCP permissions:', error);
    res.status(500).json({ 
      error: 'Failed to request permissions: ' + error.message 
    });
  }
});

// Dual-Tenant API Endpoints for Tenant Clone Feature
app.post('/api/dual-tenant/initialize', async (req, res) => {
  const { sessionId, sourceTenant, targetTenant } = req.body;
  
  if (!sessionId || !activeSessions.has(sessionId)) {
    return res.status(400).json({ error: 'Invalid session ID' });
  }
  
  if (!sourceTenant || !targetTenant) {
    return res.status(400).json({ 
      error: 'Both source and target tenant domains are required' 
    });
  }
  
  try {
    console.log(`🔄 Initializing dual-tenant for session ${sessionId}`);
    
    // Create dual tenant manager
    const dualManager = new DualTenantManager(sessionId, io);
    dualTenantSessions.set(sessionId, dualManager);
    
    // Initialize both tenants
    const sourceResult = await dualManager.initializeSourceTenant(sourceTenant);
    const targetResult = await dualManager.initializeTargetTenant(targetTenant);
    
    if (!sourceResult || !targetResult) {
      throw new Error('Failed to initialize one or both tenants');
    }
    
    res.json({
      success: true,
      message: 'Dual-tenant session initialized successfully',
      status: dualManager.getStatus()
    });
    
  } catch (error) {
    console.error('Error initializing dual-tenant session:', error);
    
    // Clean up on error
    if (dualTenantSessions.has(sessionId)) {
      const dualManager = dualTenantSessions.get(sessionId);
      await dualManager.cleanup();
      dualTenantSessions.delete(sessionId);
    }
    
    res.status(500).json({ 
      error: 'Failed to initialize dual-tenant session: ' + error.message 
    });
  }
});

app.get('/api/dual-tenant/status/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  if (!sessionId || !activeSessions.has(sessionId)) {
    return res.status(400).json({ error: 'Invalid session ID' });
  }
  
  if (dualTenantSessions.has(sessionId)) {
    const dualManager = dualTenantSessions.get(sessionId);
    res.json({
      success: true,
      status: dualManager.getStatus()
    });
  } else {
    res.json({
      success: true,
      status: { isActive: false }
    });
  }
});

app.post('/api/dual-tenant/load-policies', async (req, res) => {
  const { sessionId } = req.body;
  
  if (!sessionId || !activeSessions.has(sessionId)) {
    return res.status(400).json({ error: 'Invalid session ID' });
  }
  
  if (!dualTenantSessions.has(sessionId)) {
    return res.status(400).json({ error: 'Dual-tenant session not found' });
  }
  
  try {
    const dualManager = dualTenantSessions.get(sessionId);
    const policies = await dualManager.loadSourcePolicies();
    
    res.json({
      success: true,
      policies: dualManager.convertPoliciesToClientFormat(policies),
      count: dualManager.getTotalPolicyCount(policies)
    });
    
  } catch (error) {
    console.error('Error loading source policies:', error);
    res.status(500).json({ 
      error: 'Failed to load source policies: ' + error.message 
    });
  }
});

app.post('/api/dual-tenant/clone-policy', async (req, res) => {
  const { sessionId, policyId, policyType, customizations } = req.body;
  
  if (!sessionId || !activeSessions.has(sessionId)) {
    return res.status(400).json({ error: 'Invalid session ID' });
  }
  
  if (!dualTenantSessions.has(sessionId)) {
    return res.status(400).json({ error: 'Dual-tenant session not found' });
  }
  
  if (!policyId || !policyType) {
    return res.status(400).json({ 
      error: 'Policy ID and policy type are required' 
    });
  }
  
  try {
    const dualManager = dualTenantSessions.get(sessionId);
    const result = await dualManager.clonePolicy(policyId, policyType, customizations || {});
    
    res.json(result);
    
  } catch (error) {
    console.error('Error cloning policy:', error);
    res.status(500).json({ 
      error: 'Failed to clone policy: ' + error.message 
    });
  }
});

// Zero Trust Assessment API endpoint
app.post('/api/zero-trust-assessment', async (req, res) => {
  const { sessionId } = req.body;
  
  if (!sessionId || !activeSessions.has(sessionId)) {
    return res.status(400).json({ error: 'Invalid session ID' });
  }
  
  try {
    const mcpClient = mcpConnections.get(sessionId);
    
    if (!mcpClient) {
      return res.status(404).json({ error: 'MCP client not found for session' });
    }

    if (!mcpClient.isConnected) {
      return res.status(400).json({ error: 'MCP client not connected' });
    }

    // Check if we have a valid access token
    const token = await mcpClient.getAccessToken();
    if (!token) {
      return res.status(401).json({ 
        error: 'No valid access token available',
        requiresAuth: true 
      });
    }

    // Return success response - the client-side code will handle the actual assessment
    res.json({
      success: true,
      message: 'Zero Trust Assessment ready to start',
      hasValidToken: true,
      sessionId: sessionId
    });
    
  } catch (error) {
    console.error('Error preparing Zero Trust Assessment:', error);
    res.status(500).json({ 
      error: 'Failed to prepare Zero Trust Assessment: ' + error.message 
    });
  }
});

// Zero Trust Assessment data collection endpoint
app.post('/api/zero-trust-assessment/collect', async (req, res) => {
  const { sessionId, dataType, options } = req.body;
  
  if (!sessionId || !activeSessions.has(sessionId)) {
    return res.status(400).json({ error: 'Invalid session ID' });
  }
  
  if (!dataType) {
    return res.status(400).json({ error: 'Data type is required' });
  }
  
  try {
    const mcpClient = mcpConnections.get(sessionId);
    
    if (!mcpClient || !mcpClient.isConnected) {
      return res.status(400).json({ error: 'MCP client not available' });
    }

    // Map data collection requests to MCP commands
    let mcpRequest;
    
    // Debug logging for options
    console.log(`📊 Zero Trust collect request - dataType: ${dataType}, options:`, options);
    
    switch (dataType) {
      case 'users':
        mcpRequest = {
          apiType: 'graph',
          method: 'get',
          path: '/users',
          queryParams: {
            '$select': 'id,displayName,userPrincipalName,mail,accountEnabled,signInActivity,lastSignInDateTime,createdDateTime,assignedLicenses,assignedPlans,mfaDetail',
            '$top': String(options?.limit || 100)
          },
          fetchAll: false, // Disable fetchAll to avoid array length issues
          consistencyLevel: 'eventual'
        };
        break;
        
      case 'devices':
        mcpRequest = {
          apiType: 'graph',
          method: 'get',
          path: '/deviceManagement/managedDevices',
          queryParams: {
            '$select': 'id,deviceName,operatingSystem,osVersion,complianceState,lastSyncDateTime,enrolledDateTime,managementAgent,ownerType,userPrincipalName',
            '$top': String(options?.limit || 100)
          },
          fetchAll: false // Disable fetchAll to avoid array length issues
        };
        break;
        
      case 'compliancePolicies':
        mcpRequest = {
          apiType: 'graph',
          method: 'get',
          path: '/deviceManagement/deviceCompliancePolicies',
          queryParams: {
            '$select': 'id,displayName,description,createdDateTime,lastModifiedDateTime,version,scheduledActionsForRule',
            '$top': String(options?.limit || 100)
          },
          fetchAll: false // Disable fetchAll to avoid array length issues
        };
        break;
        
      case 'configurationPolicies':
        mcpRequest = {
          apiType: 'graph',
          method: 'get',
          path: '/deviceManagement/deviceConfigurations',
          queryParams: {
            '$select': 'id,displayName,description,createdDateTime,lastModifiedDateTime,version,deviceManagementApplicabilityRuleOsEdition,deviceManagementApplicabilityRuleOsVersion',
            '$top': String(options?.limit || 100)
          },
          fetchAll: false // Disable fetchAll to avoid array length issues
        };
        break;
        
      case 'servicePrincipals':
        mcpRequest = {
          apiType: 'graph',
          method: 'get',
          path: '/servicePrincipals',
          queryParams: {
            '$select': 'id,displayName,appId,servicePrincipalType,accountEnabled,createdDateTime,tags,appRoles,oauth2PermissionScopes',
            '$top': String(options?.limit || 100)
          },
          fetchAll: false // Disable fetchAll to avoid array length issues
        };
        break;
        
      case 'conditionalAccess':
        mcpRequest = {
          apiType: 'graph',
          method: 'get',
          path: '/identity/conditionalAccess/policies',
          queryParams: {
            '$select': 'id,displayName,state,conditions,grantControls,sessionControls,createdDateTime,modifiedDateTime',
            '$top': String(options?.limit || 100)
          },
          fetchAll: false // Disable fetchAll to avoid array length issues
        };
        break;
        
      case 'applications':
        mcpRequest = {
          apiType: 'graph',
          method: 'get',
          path: '/applications',
          queryParams: {
            '$select': 'id,displayName,appId,createdDateTime,signInAudience,requiredResourceAccess,keyCredentials,passwordCredentials',
            '$top': String(options?.limit || 100)
          },
          fetchAll: false // Disable fetchAll to avoid array length issues
        };
        break;
        
      case 'groups':
        mcpRequest = {
          apiType: 'graph',
          method: 'get',
          path: '/groups',
          queryParams: {
            '$select': 'id,displayName,groupTypes,securityEnabled,mailEnabled,createdDateTime,membershipRule,membershipRuleProcessingState',
            '$top': String(options?.limit || 100)
          },
          fetchAll: false, // Disable fetchAll to avoid array length issues
          consistencyLevel: 'eventual'
        };
        break;
        
      case 'directoryRoles':
        mcpRequest = {
          apiType: 'graph',
          method: 'get',
          path: '/directoryRoles',
          queryParams: {
            '$select': 'id,displayName,description,roleTemplateId'
            // Note: directoryRoles endpoint does not support $top parameter
          },
          fetchAll: false // Disable fetchAll to avoid array length issues
        };
        break;
        
      case 'domains':
        mcpRequest = {
          apiType: 'graph',
          method: 'get',
          path: '/domains',
          queryParams: {
            '$select': 'id,authenticationType,availabilityStatus,isDefault,isInitial,isRoot,isVerified,supportedServices',
            '$top': String(options?.limit || 100)
          },
          fetchAll: false // Disable fetchAll to avoid array length issues
        };
        break;
        
      case 'organization':
        mcpRequest = {
          apiType: 'graph',
          method: 'get',
          path: '/organization',
          queryParams: {
            '$select': 'id,displayName,verifiedDomains,assignedPlans,securityComplianceNotificationMails,securityComplianceNotificationPhones',
            '$top': String(options?.limit || 100)
          },
          fetchAll: false // Disable fetchAll to avoid array length issues
        };
        break;
        
      default:
        return res.status(400).json({ error: 'Unsupported data type: ' + dataType });
    }

    // Execute the MCP request
    const response = await mcpClient.sendMCPRequest('tools/call', {
      name: 'Lokka-Microsoft',
      arguments: mcpRequest
    });
    
    if (response && response.content && response.content[0] && response.content[0].text) {
      let responseText = response.content[0].text;
      console.log(`📝 Raw Zero Trust response for ${dataType} (first 200 chars):`, responseText.substring(0, 200));
      
      // Handle Lokka MCP response format which might have prefixes like "Result for xyz: {json}"
      let jsonData = null;
      
      // Check for permission/access errors first
      if (responseText.toLowerCase().includes('access denied') || 
          responseText.toLowerCase().includes('forbidden') || 
          responseText.toLowerCase().includes('required scopes are missing') ||
          responseText.toLowerCase().includes('accessdenied')) {
        
        console.log(`🔒 Permission error detected for ${dataType}`);
        const requiredPermissions = getZeroTrustDataTypePermissions(dataType);
        
        return res.status(403).json({
          success: false,
          error: `Insufficient permissions to access ${dataType}`,
          dataType: dataType,
          requiresPermissions: true,
          requiredScopes: requiredPermissions,
          rawError: responseText
        });
      }
      
      // Check for other API errors
      if (responseText.toLowerCase().includes('error') && 
          (responseText.includes('statusCode') || responseText.includes('"error":'))) {
        
        console.log(`❌ API error detected for ${dataType}:`, responseText.substring(0, 300));
        
        try {
          const errorData = JSON.parse(responseText);
          return res.status(400).json({
            success: false,
            error: errorData.error || `API error occurred while collecting ${dataType}`,
            dataType: dataType,
            statusCode: errorData.statusCode,
            rawError: responseText
          });
        } catch (parseError) {
          return res.status(400).json({
            success: false,
            error: `API error occurred while collecting ${dataType}`,
            dataType: dataType,
            rawError: responseText
          });
        }
      }
      
      // Try to extract JSON from response that might have prefixes
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          jsonData = JSON.parse(jsonMatch[0]);
        } catch (parseError) {
          console.log(`⚠️ JSON parse error for ${dataType}:`, parseError.message);
          return res.status(500).json({ 
            error: `Could not parse JSON response for ${dataType}`,
            rawError: responseText.substring(0, 200)
          });
        }
      } else if (responseText.trim().startsWith('{') || responseText.trim().startsWith('[')) {
        try {
          jsonData = JSON.parse(responseText.trim());
        } catch (parseError) {
          console.log(`⚠️ JSON parse error for ${dataType}:`, parseError.message);
          return res.status(500).json({ 
            error: `Could not parse JSON response for ${dataType}`,
            rawError: responseText.substring(0, 200)
          });
        }
      } else {
        console.log(`⚠️ Could not extract JSON from ${dataType} response:`, responseText.substring(0, 200));
        return res.status(500).json({ 
          error: `Could not parse response format for ${dataType}`,
          rawError: responseText.substring(0, 200)
        });
      }
      
      res.json({
        success: true,
        dataType: dataType,
        data: jsonData,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(500).json({ 
        error: 'Unexpected response format from Microsoft Graph API' 
      });
    }
    
  } catch (error) {
    console.error(`Error collecting ${dataType} data:`, error);
    res.status(500).json({ 
      error: `Failed to collect ${dataType} data: ` + error.message 
    });
  }
});

// Request additional permissions for Zero Trust Assessment
app.post('/api/zero-trust-assessment/request-permissions', async (req, res) => {
  const { sessionId, requiredScopes } = req.body;
  
  if (!sessionId || !activeSessions.has(sessionId)) {
    return res.status(400).json({ error: 'Invalid session ID' });
  }
  
  if (!requiredScopes || !Array.isArray(requiredScopes) || requiredScopes.length === 0) {
    return res.status(400).json({ error: 'Required scopes array is required' });
  }
  
  try {
    const mcpClient = mcpConnections.get(sessionId);
    
    if (!mcpClient || !mcpClient.isConnected) {
      return res.status(400).json({ error: 'MCP client not available' });
    }

    console.log(`🔐 Requesting additional Graph permissions for Zero Trust Assessment: ${requiredScopes.join(', ')}`);

    // Request additional permissions using MCP
    const permissionResponse = await mcpClient.sendMCPRequest('tools/call', {
      name: 'add-graph-permission',
      arguments: {
        scopes: requiredScopes
      }
    });

    console.log('✅ Zero Trust permission request completed:', permissionResponse);

    // Parse the MCP response to check if permissions were granted
    let permissionsGranted = false;
    if (permissionResponse && permissionResponse.content && permissionResponse.content[0]) {
      const responseText = permissionResponse.content[0].text || '';
      console.log('🔍 Permission response text:', responseText);
      
      // Check for success indicators in the response
      if (responseText.toLowerCase().includes('successfully') || 
          responseText.toLowerCase().includes('granted') ||
          responseText.toLowerCase().includes('approved') ||
          responseText.toLowerCase().includes('access token updated')) {
        permissionsGranted = true;
      }
    }

    if (permissionsGranted) {
      console.log('✅ Permissions successfully granted');
      
      // Emit success event to frontend
      io.to(sessionId).emit('zero_trust_permissions_granted', {
        requiredScopes,
        message: 'Microsoft Graph permissions successfully granted. The Zero Trust Assessment will now restart with complete data access.',
        timestamp: new Date().toISOString()
      });
      
      res.json({
        success: true,
        message: 'Permissions successfully granted',
        requiredScopes,
        permissionsGranted: true,
        timestamp: new Date().toISOString()  
      });
    } else {
      // Emit event to frontend to inform about permission request (awaiting user action)
      io.to(sessionId).emit('zero_trust_permissions_requested', {
        requiredScopes,
        message: 'Additional Microsoft Graph permissions required for complete Zero Trust Assessment. Please complete the authentication flow in your browser.',
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        message: 'Permission request initiated successfully',
        requiredScopes,
        permissionsGranted: false,
        timestamp: new Date().toISOString()  
      });
    }
    
  } catch (error) {
    console.error('❌ Failed to request Zero Trust permissions:', error);
    
    // Emit event to frontend about permission request failure
    io.to(sessionId).emit('zero_trust_permission_request_failed', {
      requiredScopes,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    
    res.status(500).json({ 
      error: `Failed to request permissions: ${error.message}` 
    });
  }
});

app.post('/api/dual-tenant/cleanup', async (req, res) => {
  const { sessionId } = req.body;
  
  if (!sessionId || !activeSessions.has(sessionId)) {
    return res.status(400).json({ error: 'Invalid session ID' });
  }
  
  try {
    if (dualTenantSessions.has(sessionId)) {
      const dualManager = dualTenantSessions.get(sessionId);
      await dualManager.cleanup();
      dualTenantSessions.delete(sessionId);
    }
    
    res.json({
      success: true,
      message: 'Dual-tenant session cleaned up successfully'
    });
    
  } catch (error) {
    console.error('Error cleaning up dual-tenant session:', error);
    res.status(500).json({ 
      error: 'Failed to cleanup dual-tenant session: ' + error.message 
    });
  }
});

// Helper functions
function isValidTenantDomain(domain) {
  // Basic domain pattern validation for Microsoft 365 domains
  const basicDomainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
  
  if (!basicDomainRegex.test(domain)) {
    return false;
  }
  
  // Additional checks for invalid patterns
  const invalidPatterns = [
    /^-/,           // Cannot start with hyphen
    /-$/,           // Cannot end with hyphen
    /\.\./,         // Cannot have consecutive dots
    /^\.|\.$/, // Cannot start or end with dot
  ];
  
  return !invalidPatterns.some(pattern => pattern.test(domain));
}

// Helper function to get required permissions for Zero Trust data types
function getZeroTrustDataTypePermissions(dataType) {
  const permissionMap = {
    'users': ['User.Read.All', 'Directory.Read.All'],
    'devices': ['DeviceManagementManagedDevices.Read.All'],
    'compliancePolicies': ['DeviceManagementConfiguration.Read.All'],
    'configurationPolicies': ['DeviceManagementConfiguration.Read.All'],
    'servicePrincipals': ['Application.Read.All', 'Directory.Read.All'],
    'conditionalAccess': ['Policy.Read.All', 'Policy.ReadWrite.ConditionalAccess', 'Directory.Read.All'],
    'applications': ['Application.Read.All', 'Directory.Read.All'],
    'groups': ['Group.Read.All', 'Directory.Read.All'],
    'directoryRoles': ['RoleManagement.Read.Directory', 'Directory.Read.All'],
    'domains': ['Domain.Read.All', 'Directory.Read.All'],
    'organization': ['Organization.Read.All']
  };
  
  return permissionMap[dataType] || ['Directory.Read.All'];
}

async function processAIMessage(sessionId, message) {
  console.log(`Processing message for session ${sessionId}: ${message}`);
  
  // Get the MCP client for this session
  const mcpClient = mcpConnections.get(sessionId);
  
  if (!mcpClient) {
    throw new Error('MCP server not connected. Please start a session first.');
  }
  
  if (!mcpClient.isConnected) {
    throw new Error('MCP server is not ready. Please wait for connection to establish.');
  }
  
  try {
    // Send message to MCP server and get response
    const response = await mcpClient.sendMessage(message);
    console.log(`MCP response received for session ${sessionId}`);
    
    return response;
    
  } catch (error) {
    console.error(`Error processing message via MCP: ${error.message}`);
    
    // Return error response
    return {
      id: uuidv4(),
      message: `❌ **Error processing your request**

Sorry, I encountered an issue while processing your request: "${message}"

**Error Details:** ${error.message}

**Troubleshooting:**
• Ensure you're connected to a Microsoft 365 tenant
• Check that the MCP server is running properly
• Try disconnecting and reconnecting to refresh the session

Please try again or contact support if the issue persists.`,
      timestamp: new Date().toISOString(),
      type: 'error_response'
    };
  }
}

async function generateHealthCheckReport(sessionId) {
  const session = activeSessions.get(sessionId);
  return {
    id: uuidv4(),
    tenantDomain: session.tenantDomain,
    generatedAt: new Date().toISOString(),
    status: 'generated',
    sections: [
      { name: 'User Accounts', status: 'healthy' },
      { name: 'Security Settings', status: 'attention_required' },
      { name: 'License Usage', status: 'healthy' },
      { name: 'Service Health', status: 'healthy' }
    ]
  };
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`ICB Agent Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
