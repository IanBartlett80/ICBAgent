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
                        content: 'You are a senior IT consultant analyzing Microsoft 365 health metrics for business clients. Provide business-focused insights with clear priorities and actionable recommendations.'
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
            'licenses': `Analyze the license allocation and usage for ${customerName}. 
                Focus on:
                - License utilization rates
                - Underutilized or wasted licenses
                - License compliance and optimization opportunities
                - Cost-saving recommendations
                
                Provide business-focused insights with:
                - Key findings (2-3 points)
                - Recommendations with priority (High/Medium/Low) and estimated time/effort
                - Potential cost impact where applicable`,
            
            'security-summary': `Analyze the monthly security summary for ${customerName}.
                Focus on:
                - Security incident trends
                - Critical vulnerabilities or risks
                - User risk patterns
                - Security posture improvements
                
                Provide business-focused insights with:
                - Key findings (2-3 points)
                - Recommendations with priority (High/Medium/Low) and estimated time/effort
                - Business impact assessment`,
            
            'security-report': `Analyze the comprehensive security report for ${customerName}.
                Focus on:
                - Overall security score and trends
                - High-priority security issues
                - Compliance gaps
                - Identity and access management concerns
                
                Provide business-focused insights with:
                - Key findings (2-3 points)
                - Recommendations with priority (High/Medium/Low) and estimated time/effort
                - Risk mitigation strategies`,
            
            'device-health': `Analyze the device health and compliance data for ${customerName}.
                Focus on:
                - Device compliance rates
                - Outdated or vulnerable devices
                - Management coverage gaps
                - Endpoint security concerns
                
                Provide business-focused insights with:
                - Key findings (2-3 points)
                - Recommendations with priority (High/Medium/Low) and estimated time/effort
                - Operational impact`
        };
        
        return prompts[screenshot.section] || `Analyze this ${screenshot.name} data for ${customerName} and provide business-focused insights with prioritized recommendations.`;
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
        
        for (const line of lines) {
            const trimmed = line.trim();
            
            if (!trimmed) continue;
            
            // Detect section headers
            if (trimmed.toLowerCase().includes('key findings') || trimmed.toLowerCase().includes('findings:')) {
                currentSection = 'findings';
                continue;
            }
            if (trimmed.toLowerCase().includes('recommendations') || trimmed.toLowerCase().includes('actions:')) {
                currentSection = 'recommendations';
                continue;
            }
            
            // Parse content based on current section
            if (currentSection === 'summary' && analysis.summary.length < 500) {
                analysis.summary += trimmed + ' ';
            } else if (currentSection === 'findings') {
                if (trimmed.match(/^[-*•]\s/)) {
                    analysis.findings.push(trimmed.replace(/^[-*•]\s/, ''));
                }
            } else if (currentSection === 'recommendations') {
                // Try to extract priority and time estimate
                const priorityMatch = trimmed.match(/\b(High|Medium|Low)\b/i);
                const timeMatch = trimmed.match(/(\d+\s*(hours?|days?|weeks?))/i);
                
                if (trimmed.match(/^[-*•]\s/) || priorityMatch) {
                    if (currentRecommendation) {
                        analysis.recommendations.push(currentRecommendation);
                    }
                    
                    currentRecommendation = {
                        action: trimmed.replace(/^[-*•]\s/, '').replace(/\*\*(.*?)\*\*/g, '$1'),
                        priority: priorityMatch ? priorityMatch[1] : 'Medium',
                        timeEstimate: timeMatch ? timeMatch[1] : 'TBD'
                    };
                } else if (currentRecommendation) {
                    // Continuation of current recommendation
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
        
        const prompt = `Based on the following key findings from ${customerName}'s Microsoft 365 environment, 
            write a concise executive summary (3-4 paragraphs, business-focused) that:
            - Highlights the overall health status
            - Identifies the most critical areas requiring attention
            - Emphasizes business impact and opportunities
            - Maintains a professional, consultative tone
            
            Key Findings:
            ${allFindings.map((f, i) => `${i + 1}. ${f}`).join('\n')}
            
            Executive Summary:`;
        
        try {
            const response = await this.openai.chat.completions.create({
                model: this.model,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a senior IT consultant writing executive summaries for C-level executives. Be concise, business-focused, and highlight ROI opportunities.'
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
