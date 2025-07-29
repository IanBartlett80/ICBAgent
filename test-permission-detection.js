// Test script to verify permission detection logic
const mockErrorResponse = {
  error: "{\r\n  \"_version\": 3,\r\n  \"Message\": \"Application is not authorized to perform this operation. Application must have one of the following scopes: DeviceManagementConfiguration.ReadWrite.All\",\r\n  \"DebugText\": null,\r\n  \"InnerError\": null\r\n}"
};

// Test the permission detection logic
function isPermissionError(errorMessage) {
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

console.log('Testing permission detection...');
console.log('Mock error response:', JSON.stringify(mockErrorResponse, null, 2));
console.log('Should detect as permission error:', isPermissionError(mockErrorResponse));
console.log('Should detect string error:', isPermissionError(mockErrorResponse.error));
console.log('Should detect parsed JSON:', isPermissionError(JSON.parse(mockErrorResponse.error)));

// Test with raw response text like we get from Lokka
const rawResponse = `{"error":"{\r\n  \"_version\": 3,\r\n  \"Message\": \"Application is not authorized to perform this operation. Application must have one of the following scopes: DeviceManagementConfiguration.ReadWrite.All\",\r\n  \"DebugText\": null,\r\n  \"InnerError\": null\r\n}","statusCode":403}`;

console.log('\nTesting with raw response text:');
console.log('Raw response:', rawResponse);
console.log('Should detect as permission error:', isPermissionError(rawResponse));

// Test JSON parsing
try {
  const parsedRaw = JSON.parse(rawResponse);
  console.log('Parsed raw response:', parsedRaw);
  console.log('Should detect parsed raw:', isPermissionError(parsedRaw));
  console.log('Should detect error property:', isPermissionError(parsedRaw.error));
} catch (e) {
  console.error('Failed to parse:', e.message);
}
