/**
 * Word Template Validation Script
 * Tests the new 4-section structure and MSP tone implementation
 * 
 * Usage: node test-word-template-update.js
 */

const WordDocumentGenerator = require('./services/word-document-generator');
const OpenAIAnalysisService = require('./services/openai-analysis-service');

// Mock test data
const mockScreenshots = [
    {
        name: 'I_licenses.png',
        path: '/tmp/test/I_licenses.png',
        section: 'licenses',
        description: 'License allocation overview'
    },
    {
        name: 'I_users.png',
        path: '/tmp/test/I_users.png',
        section: 'identity',
        description: 'User and group information'
    },
    {
        name: 'S_security_summary.png',
        path: '/tmp/test/S_security_summary.png',
        section: 'security-summary',
        description: 'Monthly security summary'
    },
    {
        name: 'S_incidents.png',
        path: '/tmp/test/S_incidents.png',
        section: 'security-report',
        description: 'Security incidents report'
    },
    {
        name: 'E_devices.png',
        path: '/tmp/test/E_devices.png',
        section: 'device-health',
        description: 'Device health status'
    },
    {
        name: 'E_compliance.png',
        path: '/tmp/test/E_compliance.png',
        section: 'device-compliance',
        description: 'Device compliance metrics'
    }
];

const mockAIAnalysis = {
    executiveSummary: 'This month, we conducted a comprehensive review of your Microsoft 365 environment. Overall, your organization maintains a strong security posture with excellent license utilization. We have identified several opportunities to enhance your identity management and endpoint compliance.',
    sectionAnalysis: {
        licenses: {
            summary: 'This month, we analyzed your license allocation and found that 85% of your Microsoft 365 licenses are actively used, which represents strong utilization. However, we identified 15 unassigned licenses that could be reallocated or removed to optimize costs.',
            findings: [
                '85% license utilization rate',
                '15 unassigned licenses identified',
                'Strong Teams and Exchange adoption'
            ],
            recommendations: [
                {
                    action: 'Reallocate or remove 15 unused licenses',
                    priority: 'High',
                    timeEstimate: '2-3 hours',
                    rationale: 'Unassigned licenses represent wasted resources and unnecessary costs. By reallocating these licenses to users who need them or removing them from your subscription, you can optimize your Microsoft 365 spend and ensure that every license provides value to your organization.'
                },
                {
                    action: 'Implement license usage monitoring dashboard',
                    priority: 'Medium',
                    timeEstimate: '1 day',
                    rationale: 'A proactive monitoring dashboard will help you track license utilization trends over time and identify optimization opportunities before they become significant cost issues. This visibility is crucial for effective license management in dynamic organizations.'
                }
            ]
        },
        identity: {
            summary: 'Our review of your identity management shows strong baseline security with most users having appropriate access levels. We did identify several administrative accounts that would benefit from additional protection through Multi-Factor Authentication.',
            findings: [
                '5 admin accounts without MFA',
                'Strong password policies in place',
                'Good role-based access control'
            ],
            recommendations: [
                {
                    action: 'Enable MFA for all administrator accounts',
                    priority: 'High',
                    timeEstimate: '1-2 hours',
                    rationale: 'Administrator accounts are high-value targets for attackers. Without MFA, these accounts rely solely on passwords for protection, which can be compromised through phishing or other attacks. Implementing MFA adds a critical layer of security that can prevent unauthorized access even if credentials are compromised.'
                }
            ]
        },
        'security-summary': {
            summary: 'This month\'s security monitoring revealed a stable environment with no critical incidents. We observed normal levels of sign-in activity and successfully blocked 12 suspicious login attempts. Your security posture continues to improve month over month.',
            findings: [
                'Zero critical security incidents',
                '12 suspicious logins blocked',
                'Normal activity patterns'
            ],
            recommendations: [
                {
                    action: 'Review and update conditional access policies',
                    priority: 'Medium',
                    timeEstimate: '3-4 hours',
                    rationale: 'Regular review of conditional access policies ensures they remain aligned with your current security requirements and business needs. As your organization evolves, these policies should be updated to reflect new risks, compliance requirements, and user workflows.'
                }
            ]
        },
        'security-report': {
            summary: 'The comprehensive security assessment shows your organization maintains an 82/100 security score, which is above the industry average. We identified several opportunities to strengthen your security posture, particularly in the areas of information protection and threat prevention.',
            findings: [
                'Security score: 82/100',
                'Above industry average',
                'Opportunities in information protection'
            ],
            recommendations: [
                {
                    action: 'Implement data loss prevention policies',
                    priority: 'High',
                    timeEstimate: '1-2 days',
                    rationale: 'Data loss prevention (DLP) policies are essential for protecting sensitive information from accidental or intentional disclosure. Without DLP, your organization is at risk of compliance violations, data breaches, and loss of intellectual property. Implementing these policies will provide automated protection for your most critical data assets.'
                }
            ]
        },
        'device-health': {
            summary: 'Our endpoint monitoring this month shows that 92% of your devices are compliant with security policies. We identified 8 devices that require attention, including 3 that are running outdated operating systems and 5 that haven\'t checked in with Intune for over 30 days.',
            findings: [
                '92% device compliance rate',
                '3 devices with outdated OS',
                '5 devices not checking in'
            ],
            recommendations: [
                {
                    action: 'Update operating systems on 3 non-compliant devices',
                    priority: 'High',
                    timeEstimate: '2-3 hours',
                    rationale: 'Outdated operating systems contain known security vulnerabilities that can be exploited by attackers. These devices represent significant security risks to your organization and should be updated immediately to protect against malware, data breaches, and other threats.'
                }
            ]
        },
        'device-compliance': {
            summary: 'Device compliance monitoring indicates strong overall adherence to your security policies. The 8% non-compliance rate is within acceptable ranges, but we recommend addressing these devices to maintain optimal security posture.',
            findings: [
                '8% non-compliance rate',
                'Most issues are easily resolved',
                'No critical compliance failures'
            ],
            recommendations: [
                {
                    action: 'Investigate and remediate non-compliant devices',
                    priority: 'Medium',
                    timeEstimate: '1 day',
                    rationale: 'Non-compliant devices may not have the latest security updates, proper encryption, or required security software. Addressing these compliance gaps ensures all endpoints meet your security standards and reduces the attack surface of your organization.'
                }
            ]
        }
    },
    overallPriorities: [
        {
            action: 'Enable MFA for all administrator accounts',
            priority: 'High',
            timeEstimate: '1-2 hours'
        },
        {
            action: 'Update operating systems on 3 non-compliant devices',
            priority: 'High',
            timeEstimate: '2-3 hours'
        },
        {
            action: 'Implement data loss prevention policies',
            priority: 'High',
            timeEstimate: '1-2 days'
        }
    ],
    generatedAt: new Date().toISOString()
};

/**
 * Test screenshot categorization
 */
function testCategorization() {
    console.log('\\n🧪 Testing Screenshot Categorization...');
    const generator = new WordDocumentGenerator();
    const categorized = generator.categorizeScreenshots(mockScreenshots);
    
    console.log('✓ Identity screenshots:', categorized.identity.length);
    console.log('✓ Security screenshots:', categorized.security.length);
    console.log('✓ Endpoint screenshots:', categorized.endpoint.length);
    
    // Verify counts
    if (categorized.identity.length !== 2) {
        console.error('❌ Expected 2 Identity screenshots, got', categorized.identity.length);
        return false;
    }
    if (categorized.security.length !== 2) {
        console.error('❌ Expected 2 Security screenshots, got', categorized.security.length);
        return false;
    }
    if (categorized.endpoint.length !== 2) {
        console.error('❌ Expected 2 Endpoint screenshots, got', categorized.endpoint.length);
        return false;
    }
    
    console.log('✅ Categorization test passed!');
    return true;
}

/**
 * Test priority sorting
 */
function testPrioritySorting() {
    console.log('\\n🧪 Testing Priority Sorting...');
    const generator = new WordDocumentGenerator();
    
    const testRecommendations = [
        { action: 'Low priority item', priority: 'Low', timeEstimate: '1 hour' },
        { action: 'High priority item', priority: 'High', timeEstimate: '2 hours' },
        { action: 'Medium priority item', priority: 'Medium', timeEstimate: '3 hours' },
        { action: 'Another high', priority: 'High', timeEstimate: '1 day' }
    ];
    
    const sorted = generator.sortRecommendationsByPriority(testRecommendations);
    
    console.log('✓ First item priority:', sorted[0].priority);
    console.log('✓ Last item priority:', sorted[sorted.length - 1].priority);
    
    // Verify order
    if (sorted[0].priority !== 'High' || sorted[1].priority !== 'High') {
        console.error('❌ High priority items should be first');
        return false;
    }
    if (sorted[sorted.length - 1].priority !== 'Low') {
        console.error('❌ Low priority item should be last');
        return false;
    }
    
    console.log('✅ Priority sorting test passed!');
    return true;
}

/**
 * Test top priorities extraction
 */
function testTopPriorities() {
    console.log('\\n🧪 Testing Top Priorities Extraction...');
    const generator = new WordDocumentGenerator();
    const categorized = generator.categorizeScreenshots(mockScreenshots);
    const topPriorities = generator.getTopPrioritiesByCategory(mockAIAnalysis, categorized);
    
    console.log('✓ Identity priorities:', topPriorities.identity.length);
    console.log('✓ Security priorities:', topPriorities.security.length);
    console.log('✓ Endpoint priorities:', topPriorities.endpoint.length);
    
    // Verify each category has priorities
    if (topPriorities.identity.length === 0) {
        console.error('❌ No identity priorities found');
        return false;
    }
    if (topPriorities.security.length === 0) {
        console.error('❌ No security priorities found');
        return false;
    }
    if (topPriorities.endpoint.length === 0) {
        console.error('❌ No endpoint priorities found');
        return false;
    }
    
    // Verify priorities are sorted
    for (const category of Object.keys(topPriorities)) {
        const priorities = topPriorities[category];
        for (let i = 0; i < priorities.length - 1; i++) {
            const current = priorities[i].priority;
            const next = priorities[i + 1].priority;
            const priorityOrder = { 'High': 1, 'Medium': 2, 'Low': 3 };
            if (priorityOrder[current] > priorityOrder[next]) {
                console.error(`❌ ${category} priorities not properly sorted`);
                return false;
            }
        }
    }
    
    console.log('✅ Top priorities test passed!');
    return true;
}

/**
 * Test MSP tone in prompts
 */
function testMSPTone() {
    console.log('\\n🧪 Testing MSP Tone in Prompts...');
    
    // Note: This requires OpenAI API key to be configured
    if (!process.env.OPENAI_API_KEY) {
        console.log('⚠️  Skipping MSP tone test (OPENAI_API_KEY not set)');
        return true;
    }
    
    const service = new OpenAIAnalysisService();
    const prompt = service.createSectionPrompt(mockScreenshots[0], 'Test Company');
    
    // Check for MSP-specific language
    const mspKeywords = [
        'managed service provider',
        'This month',
        'we observed',
        'your',
        'MSP monthly update tone',
        'rationale'
    ];
    
    let foundKeywords = 0;
    for (const keyword of mspKeywords) {
        if (prompt.toLowerCase().includes(keyword.toLowerCase())) {
            console.log(`✓ Found keyword: "${keyword}"`);
            foundKeywords++;
        }
    }
    
    if (foundKeywords < 4) {
        console.error(`❌ Expected at least 4 MSP keywords, found ${foundKeywords}`);
        return false;
    }
    
    console.log('✅ MSP tone test passed!');
    return true;
}

/**
 * Run all tests
 */
async function runTests() {
    console.log('═══════════════════════════════════════════');
    console.log('   Word Template Update Validation Tests   ');
    console.log('═══════════════════════════════════════════');
    
    const tests = [
        testCategorization,
        testPrioritySorting,
        testTopPriorities,
        testMSPTone
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const test of tests) {
        try {
            const result = await test();
            if (result) {
                passed++;
            } else {
                failed++;
            }
        } catch (error) {
            console.error(`❌ Test failed with error:`, error.message);
            failed++;
        }
    }
    
    console.log('\\n═══════════════════════════════════════════');
    console.log(`   Test Results: ${passed} passed, ${failed} failed   `);
    console.log('═══════════════════════════════════════════\\n');
    
    if (failed === 0) {
        console.log('🎉 All tests passed! The Word template update is ready for use.');
        console.log('\\n📚 Next steps:');
        console.log('   1. Review WORD_TEMPLATE_UPDATE_SUMMARY.md');
        console.log('   2. Check WORD_TEMPLATE_QUICK_REFERENCE.md');
        console.log('   3. Test with real screenshots (I_*.png, S_*.png, E_*.png)');
        console.log('   4. Generate a sample report to verify formatting');
    } else {
        console.log('⚠️  Some tests failed. Please review the output above.');
    }
    
    process.exit(failed === 0 ? 0 : 1);
}

// Run tests
runTests().catch(error => {
    console.error('Fatal error running tests:', error);
    process.exit(1);
});
