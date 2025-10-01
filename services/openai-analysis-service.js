/**
 * OpenAI Analysis Service
 * Analyzes health report data and screenshots using GPT-4o
 * Generates business-focused recommendations with priorities
 * 
 * @author ICB Solutions
 * @date October 2025
 */

const OpenAI = require('openai');
const fs = require('fs').promises;
const path = require('path');

class OpenAIAnalysisService {
    constructor() {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY environment variable is required');
        }
        
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        
        this.model = 'gpt-4o'; // Latest GPT-4o model
    }

    /**
     * Analyze health data and generate recommendations
     * @param {Object} data - Analysis data
     * @param {Array} data.screenshots - Array of screenshot metadata
     * @param {string} data.customerName - Customer/tenant name
     * @param {string} data.sessionTempPath - Temporary directory path
     * @returns {Promise<Object>} AI analysis results
     */
    async analyzeHealthData(data) {
        const { screenshots, customerName, sessionTempPath } = data;
        
        console.log(`🤖 Starting AI analysis for ${customerName}...`);
        
        const analysis = {
            executiveSummary: null,
            sectionAnalysis: {},
            overallPriorities: [],
            generatedAt: new Date().toISOString()
        };
        
        try {
            // Analyze each section with its screenshot
            for (const screenshot of screenshots) {
                console.log(`🔍 Analyzing ${screenshot.section}...`);
                
                const sectionAnalysis = await this.analyzeSectionWithVision(
                    screenshot,
                    { customerName, sessionTempPath }
                );
                
                analysis.sectionAnalysis[screenshot.section] = sectionAnalysis;
            }
            
            // Generate executive summary from all sections
            analysis.executiveSummary = await this.generateExecutiveSummary({
                customerName,
                sectionAnalyses: analysis.sectionAnalysis
            });
            
            // Generate overall priorities across all sections
            analysis.overallPriorities = await this.generateOverallPriorities({
                customerName,
                sectionAnalyses: analysis.sectionAnalysis
            });
            
            console.log('✅ AI analysis complete');
            
        } catch (error) {
            console.error('❌ Error during AI analysis:', error);
            throw error;
        }
        
        return analysis;
    }

    /**
     * Analyze a specific section using Vision API
     * @param {Object} screenshot - Screenshot metadata
     * @param {Object} context - Analysis context
     * @returns {Promise<Object>} Section analysis
     */
    async analyzeSectionWithVision(screenshot, context) {
        const { customerName, sessionTempPath } = context || {};
        
        console.log(`🔍 Analyzing ${screenshot.section} with GPT-4o Vision...`);
        
        try {
            // Skip vision analysis for text-only sections or missing screenshots
            if (screenshot.isTextExtraction || !screenshot.path || screenshot.path === undefined) {
                console.log(`  ℹ️  Text-only section or missing screenshot, using text content if available`);
                return {
                    summary: screenshot.textContent || 'Section content not captured',
                    insights: screenshot.textContent ? ['Content extracted directly from portal'] : ['Screenshot not available'],
                    recommendations: screenshot.textContent ? ['Review the summary text for key security metrics'] : ['Manually capture this section if needed'],
                    severity: screenshot.textContent ? 'info' : 'warning'
                };
            }
            
            // Read screenshot image
            const imageBuffer = await fs.readFile(screenshot.path);
            const base64Image = imageBuffer.toString('base64');
            
            // Create prompt for this section
            const prompt = this.createSectionPrompt(screenshot, customerName);
            
            // Call OpenAI Vision API
            const response = await this.openai.chat.completions.create({
                model: this.model,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a senior IT consultant at an IT Managed Service Provider (MSP) writing a monthly update report for a business owner. Your analysis should be professional, business-focused, and explain technical concepts in terms that emphasize business impact, risk mitigation, and operational efficiency. Write as if you are providing ongoing managed services and are committed to the client\'s success. Use "we" when referring to ICB Solutions and "your" when addressing the client.'
                    },
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: prompt
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:image/jpeg;base64,${base64Image}`
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 1500,
                temperature: 0.7
            });
            
            const aiResponse = response.choices[0].message.content;
            
            // Parse the AI response into structured data
            return this.parseAIResponse(aiResponse, screenshot.section);
            
        } catch (error) {
            console.error(`Error analyzing ${screenshot.section}:`, error);
            return {
                summary: `Unable to analyze ${screenshot.name}`,
                findings: [],
                recommendations: []
            };
        }
    }

    /**
     * Create analysis prompt for a specific section
     * @param {Object} screenshot - Screenshot metadata
     * @param {string} customerName - Customer name
     * @returns {string} Analysis prompt
     */
    createSectionPrompt(screenshot, customerName) {
        const prompts = {
            'licenses': `As the IT managed service provider for ${customerName}, analyze this month's license allocation and usage data.
                
                Write a detailed paragraph (150-200 words) that:
                - Summarizes the current license utilization and allocation
                - Explains what the metrics indicate about your environment
                - Highlights any concerns or opportunities in business terms
                - Uses an MSP monthly update tone ("This month, we observed...")
                
                Then provide 3-5 prioritized recommendations with:
                - [Priority Level] Clear action item
                - Detailed rationale explaining WHY this is a priority (business impact, cost savings, risk reduction)
                - Estimated time/effort
                - Potential cost impact where applicable
                
                Format:
                SUMMARY:
                [Your detailed paragraph here]
                
                KEY FINDINGS:
                - Finding 1
                - Finding 2
                - Finding 3
                
                RECOMMENDATIONS:
                - [High/Medium/Low] Action item (Time estimate)
                  Rationale: Detailed explanation of why this matters
                - [Priority] Next action (Time)
                  Rationale: Why this is important`,
            
            'security-summary': `As the IT managed service provider for ${customerName}, analyze this month's security summary data.
                
                Write a detailed paragraph (150-200 words) that:
                - Summarizes the security incidents and trends this month
                - Explains what these metrics mean for your business
                - Contextualizes any alerts or anomalies
                - Uses an MSP monthly update tone ("Our security monitoring this month revealed...")
                
                Then provide 3-5 prioritized recommendations with:
                - [Priority Level] Clear action item
                - Detailed rationale explaining WHY this is a priority (threat mitigation, compliance, user protection)
                - Estimated time/effort
                - Business risk assessment
                
                Format as above with SUMMARY, KEY FINDINGS, and RECOMMENDATIONS sections.`,
            
            'security-report': `As the IT managed service provider for ${customerName}, analyze this comprehensive security report.
                
                Write a detailed paragraph (150-200 words) that:
                - Provides an overall security posture assessment
                - Explains critical security scores and what they indicate
                - Identifies the most significant risks or concerns
                - Uses an MSP monthly update tone ("This month's security assessment shows...")
                
                Then provide 3-5 prioritized recommendations with:
                - [Priority Level] Clear action item
                - Detailed rationale explaining WHY this is a priority (compliance gaps, vulnerabilities, attack surface)
                - Estimated time/effort
                - Risk mitigation strategy
                
                Format as above with SUMMARY, KEY FINDINGS, and RECOMMENDATIONS sections.`,
            
            'device-health': `As the IT managed service provider for ${customerName}, analyze this month's device health and compliance data.
                
                Write a detailed paragraph (150-200 words) that:
                - Summarizes device compliance rates and health status
                - Explains what these metrics mean for operational security
                - Highlights any devices requiring attention
                - Uses an MSP monthly update tone ("Our endpoint monitoring this month identified...")
                
                Then provide 3-5 prioritized recommendations with:
                - [Priority Level] Clear action item
                - Detailed rationale explaining WHY this is a priority (security risks, productivity impact, compliance)
                - Estimated time/effort
                - Operational impact assessment
                
                Format as above with SUMMARY, KEY FINDINGS, and RECOMMENDATIONS sections.`
        };
        
        return prompts[screenshot.section] || `As the IT managed service provider for ${customerName}, analyze this ${screenshot.name} data and provide business-focused insights with prioritized recommendations and detailed rationale for each priority.`;
    }

    /**
     * Parse AI response into structured format
     * @param {string} aiResponse - Raw AI response
     * @param {string} section - Section identifier
     * @returns {Object} Parsed analysis
     */
    parseAIResponse(aiResponse, section) {
        // Parse the AI response to extract findings and recommendations
        const lines = aiResponse.split('\n');
        
        const analysis = {
            summary: '',
            findings: [],
            recommendations: []
        };
        
        let currentSection = 'summary';
        let currentRecommendation = null;
        let capturingRationale = false;
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            if (!trimmed) continue;
            
            // Detect section headers
            if (trimmed.toLowerCase().includes('key findings') || trimmed.toLowerCase().includes('findings:')) {
                currentSection = 'findings';
                capturingRationale = false;
                continue;
            }
            if (trimmed.toLowerCase().includes('recommendations') || trimmed.toLowerCase().includes('actions:')) {
                currentSection = 'recommendations';
                capturingRationale = false;
                continue;
            }
            
            // Parse content based on current section
            if (currentSection === 'summary' && analysis.summary.length < 800) {
                analysis.summary += trimmed + ' ';
            } else if (currentSection === 'findings') {
                if (trimmed.match(/^[-*•]\s/)) {
                    analysis.findings.push(trimmed.replace(/^[-*•]\s/, ''));
                }
            } else if (currentSection === 'recommendations') {
                // Check if this is a rationale line
                if (trimmed.toLowerCase().startsWith('rationale:')) {
                    capturingRationale = true;
                    if (currentRecommendation) {
                        currentRecommendation.rationale = trimmed.replace(/rationale:/i, '').trim();
                    }
                    continue;
                }
                
                // Try to extract priority and time estimate
                const priorityMatch = trimmed.match(/\b(High|Medium|Low)\b/i);
                const timeMatch = trimmed.match(/\((\d+\s*(hours?|days?|weeks?))\)/i);
                
                if (trimmed.match(/^[-*•]\s/) || (priorityMatch && trimmed.match(/^\[/))) {
                    if (currentRecommendation) {
                        analysis.recommendations.push(currentRecommendation);
                    }
                    
                    let actionText = trimmed.replace(/^[-*•]\s/, '').replace(/\*\*(.*?)\*\*/g, '$1');
                    
                    // Remove time estimate from action if present
                    if (timeMatch) {
                        actionText = actionText.replace(timeMatch[0], '').trim();
                    }
                    
                    currentRecommendation = {
                        action: actionText,
                        priority: priorityMatch ? priorityMatch[1] : 'Medium',
                        timeEstimate: timeMatch ? timeMatch[1] : 'TBD',
                        rationale: ''
                    };
                    capturingRationale = false;
                } else if (capturingRationale && currentRecommendation) {
                    // Continue building rationale
                    currentRecommendation.rationale += ' ' + trimmed;
                } else if (currentRecommendation && !capturingRationale) {
                    // Continuation of current recommendation action
                    currentRecommendation.action += ' ' + trimmed;
                }
            }
        }
        
        // Add last recommendation if any
        if (currentRecommendation) {
            analysis.recommendations.push(currentRecommendation);
        }
        
        // Clean up summary
        analysis.summary = analysis.summary.trim();
        
        // Clean up recommendations
        for (const rec of analysis.recommendations) {
            rec.action = rec.action.trim();
            rec.rationale = rec.rationale.trim();
        }
        
        return analysis;
    }

    /**
     * Generate executive summary from all section analyses
     * @param {Object} options - Summary options
     * @returns {Promise<string>} Executive summary
     */
    async generateExecutiveSummary(options) {
        const { customerName, sectionAnalyses } = options;
        
        // Compile findings from all sections
        const allFindings = Object.values(sectionAnalyses)
            .flatMap(section => section.findings)
            .slice(0, 10); // Top 10 findings
        
        const prompt = `As the IT managed service provider for ${customerName}, write a concise executive summary (3-4 paragraphs) for this month's Microsoft 365 health report.
            
            Writing style:
            - Use first person plural ("we") for ICB Solutions
            - Address the client as "you" or "your organization"
            - Write as if this is a monthly update to a business owner
            - Be professional, consultative, and business-focused
            - Emphasize business impact, risk mitigation, and opportunities
            - Example opening: "This month, we conducted our regular assessment of your Microsoft 365 environment..."
            
            Content to include:
            - Overall health status and key trends
            - Most critical areas requiring attention
            - Positive findings and improvements
            - Business impact and opportunities
            - Our commitment to addressing identified issues
            
            Key Findings from this month's assessment:
            ${allFindings.map((f, i) => `${i + 1}. ${f}`).join('\n')}
            
            Executive Summary:`;
        
        try {
            const response = await this.openai.chat.completions.create({
                model: this.model,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a senior IT consultant at an IT Managed Service Provider writing executive summaries for business owners. Write in an MSP monthly update style using "we" for ICB Solutions and "you/your" for the client. Be concise, business-focused, and emphasize partnership and commitment to the client\'s success.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 800,
                temperature: 0.7
            });
            
            return response.choices[0].message.content.trim();
            
        } catch (error) {
            console.error('Error generating executive summary:', error);
            return `Executive summary for ${customerName}'s Microsoft 365 environment analysis.`;
        }
    }

    /**
     * Generate overall priorities across all sections
     * @param {Object} options - Priority options
     * @returns {Promise<Array>} Prioritized action items
     */
    async generateOverallPriorities(options) {
        const { customerName, sectionAnalyses } = options;
        
        // Compile all recommendations
        const allRecommendations = Object.entries(sectionAnalyses)
            .flatMap(([section, analysis]) => 
                analysis.recommendations.map(rec => ({
                    ...rec,
                    section
                }))
            );
        
        const prompt = `Review these IT recommendations for ${customerName} and create a prioritized action plan 
            for the next month (top 5-7 items). For each priority:
            - Assign overall priority (High/Medium/Low) considering business impact
            - Provide clear action item description
            - Estimate time/effort
            - Group related items where appropriate
            
            Recommendations by section:
            ${Object.entries(sectionAnalyses).map(([section, analysis]) => 
                `\n${section.toUpperCase()}:\n${analysis.recommendations.map(r => 
                    `- [${r.priority}] ${r.action} (${r.timeEstimate})`
                ).join('\n')}`
            ).join('\n')}
            
            Consolidated Next Month Priorities:`;
        
        try {
            const response = await this.openai.chat.completions.create({
                model: this.model,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a senior IT consultant creating monthly action plans for clients. Prioritize based on security, compliance, cost optimization, and operational efficiency.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 1000,
                temperature: 0.7
            });
            
            // Parse the response into structured priorities
            return this.parsePriorities(response.choices[0].message.content);
            
        } catch (error) {
            console.error('Error generating overall priorities:', error);
            return [];
        }
    }

    /**
     * Parse priorities from AI response
     * @param {string} response - AI response text
     * @returns {Array} Parsed priorities
     */
    parsePriorities(response) {
        const lines = response.split('\n');
        const priorities = [];
        let currentPriority = null;
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            
            // Look for priority indicators
            const priorityMatch = trimmed.match(/^(\d+\.|\*|-|•)\s*\[?(High|Medium|Low)\]?:?\s*(.*)/i);
            
            if (priorityMatch) {
                if (currentPriority) {
                    priorities.push(currentPriority);
                }
                
                const [, , priority, action] = priorityMatch;
                currentPriority = {
                    priority: priority,
                    action: action.trim(),
                    timeEstimate: 'TBD'
                };
                
                // Try to extract time estimate from action
                const timeMatch = action.match(/\((\d+\s*(hours?|days?|weeks?))\)/i);
                if (timeMatch) {
                    currentPriority.timeEstimate = timeMatch[1];
                    currentPriority.action = action.replace(timeMatch[0], '').trim();
                }
            } else if (currentPriority && trimmed.length > 10) {
                // Continuation of current priority
                currentPriority.action += ' ' + trimmed;
            }
        }
        
        if (currentPriority) {
            priorities.push(currentPriority);
        }
        
        return priorities.slice(0, 7); // Top 7 priorities
    }
}

module.exports = OpenAIAnalysisService;
