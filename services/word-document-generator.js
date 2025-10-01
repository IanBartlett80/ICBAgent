/**
 * Word Document Generator Service
 * Creates professional Word documents with ICB Solutions branding
 * for customer health reports
 * 
 * @author ICB Solutions
 * @date October 2025
 */

const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, 
        Table, TableRow, TableCell, WidthType, ImageRun, TableOfContents,
        Header, Footer, PageNumber, NumberFormat } = require('docx');
const fs = require('fs').promises;
const path = require('path');

class WordDocumentGenerator {
    constructor() {
        this.icbNavyBlue = '022541';
        this.icbPrimaryBlue = '3e8ab4';
        this.successGreen = '10b981';
        this.warningOrange = 'f59e0b';
        this.errorRed = 'ef4444';
    }

    /**
     * Generate complete health report document
     * @param {Object} options - Report options
     * @returns {Promise<string>} Path to generated document
     */
    async generateReport(options) {
        const { customerName, screenshots, aiAnalysis, outputPath } = options;
        
        console.log(`📄 Generating Word document for ${customerName}...`);
        
        const sanitizedName = this.sanitizeName(customerName);
        const reportDate = new Date();
        const monthYear = reportDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const filename = `${sanitizedName}_Health_Report_${monthYear.replace(' ', '_')}.docx`;
        const filePath = path.join(outputPath, filename);
        
        try {
            // Categorize screenshots by first letter (I, S, E)
            const categorizedScreenshots = this.categorizeScreenshots(screenshots);
            
            // Build document sections
            const sections = [];
            
            // Section 1: Cover page and metadata
            sections.push(...await this.createCoverPage(customerName, reportDate));
            
            // Section 2: Table of Contents
            sections.push(this.createTableOfContents());
            
            // Section 3: Executive Summary
            sections.push(...this.createExecutiveSummary(aiAnalysis.executiveSummary));
            
            // Section 4: Identity Status
            if (categorizedScreenshots.identity.length > 0) {
                sections.push(...await this.createCategorySection(
                    'Identity Status',
                    categorizedScreenshots.identity,
                    aiAnalysis,
                    'identity'
                ));
            }
            
            // Section 5: Security Status
            if (categorizedScreenshots.security.length > 0) {
                sections.push(...await this.createCategorySection(
                    'Security Status',
                    categorizedScreenshots.security,
                    aiAnalysis,
                    'security'
                ));
            }
            
            // Section 6: Endpoint Status
            if (categorizedScreenshots.endpoint.length > 0) {
                sections.push(...await this.createCategorySection(
                    'Endpoint Status',
                    categorizedScreenshots.endpoint,
                    aiAnalysis,
                    'endpoint'
                ));
            }
            
            // Section 7: ICB Solutions Call to Actions
            sections.push(...this.createCallToActionsSection(
                aiAnalysis,
                categorizedScreenshots
            ));
            
            // Create document
            const doc = new Document({
                sections: [{
                    properties: {
                        page: {
                            margin: {
                                top: 720,  // 0.5 inch
                                right: 720,
                                bottom: 720,
                                left: 720
                            }
                        }
                    },
                    headers: {
                        default: this.createHeader(customerName)
                    },
                    footers: {
                        default: this.createFooter(reportDate)
                    },
                    children: sections
                }]
            });
            
            // Save document
            const buffer = await Packer.toBuffer(doc);
            await fs.writeFile(filePath, buffer);
            
            console.log(`✅ Word document generated: ${filePath}`);
            return filePath;
            
        } catch (error) {
            console.error('❌ Error generating Word document:', error);
            throw error;
        }
    }

    /**
     * Create cover page
     */
    async createCoverPage(customerName, reportDate) {
        const monthYear = reportDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        
        // Load ICB Solutions logo
        const logoPath = path.join(__dirname, '..', 'public', 'images', 'icblogo.jpg');
        let logoImage = null;
        
        try {
            const imageBuffer = await fs.readFile(logoPath);
            logoImage = new ImageRun({
                data: imageBuffer,
                transformation: {
                    width: 80,  // pixels (optimized for report)
                    height: 80   // pixels (maintains aspect ratio)
                }
            });
        } catch (error) {
            console.warn('⚠️ Could not load ICB logo:', error.message);
        }
        
        const coverElements = [
            new Paragraph({
                text: '',
                spacing: { after: 200 }
            })
        ];
        
        // Add logo if available
        if (logoImage) {
            coverElements.push(
                new Paragraph({
                    children: [logoImage],
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 400 }
                })
            );
        }
        
        // Add remaining cover page elements
        coverElements.push(
            new Paragraph({
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 },
                children: [
                    new TextRun({
                        text: 'Microsoft 365 Health Report',
                        color: this.icbNavyBlue,
                        size: 48,
                        bold: true
                    })
                ]
            }),
            new Paragraph({
                text: '',
                spacing: { after: 400 }
            }),
            new Paragraph({
                heading: HeadingLevel.HEADING_2,
                alignment: AlignmentType.CENTER,
                spacing: { after: 200 },
                children: [
                    new TextRun({
                        text: customerName,
                        color: this.icbPrimaryBlue,
                        size: 40,
                        bold: true
                    })
                ]
            }),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 600 },
                children: [
                    new TextRun({
                        text: monthYear,
                        size: 28,
                        color: '666666',
                        italics: true
                    })
                ]
            }),
            new Paragraph({
                text: '',
                spacing: { after: 800 }
            }),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 200 },
                children: [
                    new TextRun({
                        text: `Confidential - For ${customerName} Only`,
                        color: this.errorRed,
                        size: 20,
                        bold: true
                    })
                ]
            }),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 100 },
                children: [
                    new TextRun({
                        text: 'Prepared by ICB Solutions',
                        size: 18,
                        color: this.icbNavyBlue,
                        bold: true
                    })
                ]
            }),
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 },
                children: [
                    new TextRun({
                        text: reportDate.toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                        }),
                        size: 16,
                        color: '666666',
                        italics: true
                    })
                ]
            }),
            new Paragraph({
                text: '',
                pageBreakBefore: true
            })
        );
        
        return coverElements;
    }

    /**
     * Create table of contents
     */
    createTableOfContents() {
        return new TableOfContents('Table of Contents', {
            hyperlink: true,
            headingStyleRange: '1-3'
        });
    }

    /**
     * Create executive summary section
     */
    createExecutiveSummary(summary) {
        return [
            new Paragraph({
                text: '',
                pageBreakBefore: true
            }),
            new Paragraph({
                text: 'Executive Summary',
                heading: HeadingLevel.HEADING_1,
                spacing: { after: 300 }
            }),
            new Paragraph({
                text: summary || 'Executive summary of the Microsoft 365 environment health analysis.',
                spacing: { after: 400, line: 360 }
            })
        ];
    }

    /**
     * Create document header
     */
    createHeader(customerName) {
        return new Header({
            children: [
                new Paragraph({
                    children: [
                        new TextRun({
                            text: 'ICB Solutions - ',
                            bold: true,
                            color: this.icbNavyBlue
                        }),
                        new TextRun({
                            text: `${customerName} Health Report`,
                            color: this.icbPrimaryBlue
                        })
                    ],
                    alignment: AlignmentType.RIGHT
                })
            ]
        });
    }

    /**
     * Create document footer
     */
    createFooter(reportDate) {
        return new Footer({
            children: [
                new Paragraph({
                    children: [
                        new TextRun({
                            text: `Confidential - Prepared by ICB Solutions - ${reportDate.toLocaleDateString()}`,
                            size: 16,
                            color: '6b7280'
                        }),
                        new TextRun({
                            text: '                Page ',
                            size: 16,
                            color: '6b7280'
                        }),
                        new TextRun({
                            children: [PageNumber.CURRENT]
                        })
                    ],
                    alignment: AlignmentType.CENTER
                })
            ]
        });
    }

    /**
     * Get color code for priority level
     */
    getPriorityColor(priority) {
        const colors = {
            'High': this.errorRed,
            'Medium': this.warningOrange,
            'Low': this.successGreen
        };
        return colors[priority] || this.icbPrimaryBlue;
    }

    /**
     * Categorize screenshots by first letter of filename (I, S, E)
     */
    categorizeScreenshots(screenshots) {
        const categorized = {
            identity: [],
            security: [],
            endpoint: []
        };
        
        for (const screenshot of screenshots) {
            const filename = path.basename(screenshot.name || screenshot.path || '');
            const firstLetter = filename.charAt(0).toUpperCase();
            
            if (firstLetter === 'I') {
                categorized.identity.push(screenshot);
            } else if (firstLetter === 'S') {
                categorized.security.push(screenshot);
            } else if (firstLetter === 'E') {
                categorized.endpoint.push(screenshot);
            }
        }
        
        return categorized;
    }

    /**
     * Create a category section (Identity, Security, or Endpoint)
     */
    async createCategorySection(title, screenshots, aiAnalysis, category) {
        const elements = [];
        
        // Section heading
        elements.push(
            new Paragraph({
                text: '',
                pageBreakBefore: true
            }),
            new Paragraph({
                text: title,
                heading: HeadingLevel.HEADING_1,
                spacing: { after: 400 }
            })
        );
        
        // Add each screenshot with analysis
        for (const screenshot of screenshots) {
            const sectionAnalysis = aiAnalysis.sectionAnalysis[screenshot.section];
            if (sectionAnalysis) {
                elements.push(...await this.createScreenshotWithComments(screenshot, sectionAnalysis));
            }
        }
        
        // Add ICB Solutions Priority Areas subsection
        elements.push(...this.createPriorityAreasSubsection(screenshots, aiAnalysis, category));
        
        return elements;
    }

    /**
     * Create screenshot with comments section (no title, just image + analysis)
     */
    async createScreenshotWithComments(screenshot, analysis) {
        const elements = [];
        
        // Embed screenshot (centered, no title)
        try {
            const imageBuffer = await fs.readFile(screenshot.path);
            elements.push(
                new Paragraph({
                    children: [
                        new ImageRun({
                            data: imageBuffer,
                            transformation: {
                                width: 600,
                                height: 400
                            }
                        })
                    ],
                    spacing: { after: 300, before: 200 },
                    alignment: AlignmentType.CENTER
                })
            );
        } catch (error) {
            console.error(`Error embedding screenshot ${screenshot.name}:`, error);
        }
        
        // Comments section with detailed analysis
        elements.push(
            new Paragraph({
                text: 'Comments',
                heading: HeadingLevel.HEADING_3,
                spacing: { after: 200, before: 200 }
            }),
            new Paragraph({
                text: analysis.summary || 'This month\'s data shows the current state of this area within your Microsoft 365 environment. Our team has reviewed the metrics and identified key observations that warrant attention.',
                spacing: { after: 400, line: 360 }
            })
        );
        
        return elements;
    }

    /**
     * Create Priority Areas subsection for each category
     */
    createPriorityAreasSubsection(screenshots, aiAnalysis, category) {
        const elements = [];
        
        // Collect all recommendations for this category
        const categoryRecommendations = [];
        for (const screenshot of screenshots) {
            const sectionAnalysis = aiAnalysis.sectionAnalysis[screenshot.section];
            if (sectionAnalysis && sectionAnalysis.recommendations) {
                categoryRecommendations.push(...sectionAnalysis.recommendations);
            }
        }
        
        // Sort by priority (High > Medium > Low) and take top 3-5
        const sortedRecommendations = this.sortRecommendationsByPriority(categoryRecommendations).slice(0, 5);
        
        if (sortedRecommendations.length > 0) {
            elements.push(
                new Paragraph({
                    text: 'ICB Solutions Priority Areas',
                    heading: HeadingLevel.HEADING_2,
                    spacing: { after: 300, before: 400 }
                }),
                new Paragraph({
                    text: `Based on our analysis of your ${category} posture this month, we have identified the following priority areas that ICB Solutions recommends addressing to enhance your security, compliance, and operational efficiency:`,
                    spacing: { after: 300, line: 360 }
                })
            );
            
            for (let i = 0; i < sortedRecommendations.length; i++) {
                const rec = sortedRecommendations[i];
                const priorityColor = this.getPriorityColor(rec.priority);
                
                elements.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `${i + 1}. `,
                                bold: true,
                                size: 24
                            }),
                            new TextRun({
                                text: `[${rec.priority} Priority] `,
                                color: priorityColor,
                                bold: true
                            }),
                            new TextRun({
                                text: rec.action
                            })
                        ],
                        spacing: { after: 150, before: 150 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `   Estimated Effort: ${rec.timeEstimate}`,
                                italics: true,
                                color: '6b7280'
                            })
                        ],
                        spacing: { after: 100 }
                    }),
                    new Paragraph({
                        text: `   ${rec.rationale || 'This priority area has been identified as critical to improving your overall ' + category + ' posture and reducing potential risks to your organization.'}`,
                        spacing: { after: 300 },
                        color: '374151'
                    })
                );
            }
        }
        
        return elements;
    }

    /**
     * Create Call to Actions section (final summary section)
     */
    createCallToActionsSection(aiAnalysis, categorizedScreenshots) {
        const elements = [
            new Paragraph({
                text: '',
                pageBreakBefore: true
            }),
            new Paragraph({
                text: 'ICB Solutions Call to Actions',
                heading: HeadingLevel.HEADING_1,
                spacing: { after: 400 }
            }),
            new Paragraph({
                text: 'Monthly Summary',
                heading: HeadingLevel.HEADING_2,
                spacing: { after: 200, before: 200 }
            }),
            new Paragraph({
                text: 'This month, our team has conducted a comprehensive review of your Microsoft 365 environment across Identity, Security, and Endpoint management areas. The analysis has revealed several opportunities for optimization and risk mitigation that we believe warrant immediate attention.',
                spacing: { after: 300, line: 360 }
            }),
            new Paragraph({
                text: aiAnalysis.executiveSummary || 'Our analysis indicates a generally healthy environment with specific areas requiring focused attention to maintain and enhance your security posture.',
                spacing: { after: 400, line: 360 }
            }),
            new Paragraph({
                text: 'Next Month Priorities',
                heading: HeadingLevel.HEADING_2,
                spacing: { after: 300, before: 400 }
            }),
            new Paragraph({
                text: 'Based on our comprehensive assessment, ICB Solutions has identified the following high-priority areas that we will focus on in the coming month to enhance your Microsoft 365 environment:',
                spacing: { after: 300, line: 360 }
            })
        ];
        
        // Get top 3 highest priority items from each category
        const topPriorities = this.getTopPrioritiesByCategory(aiAnalysis, categorizedScreenshots);
        
        // Identity priorities
        if (topPriorities.identity.length > 0) {
            elements.push(
                new Paragraph({
                    text: 'Identity & Access Management',
                    heading: HeadingLevel.HEADING_3,
                    spacing: { after: 200, before: 300 }
                })
            );
            
            for (let i = 0; i < Math.min(3, topPriorities.identity.length); i++) {
                const priority = topPriorities.identity[i];
                const priorityColor = this.getPriorityColor(priority.priority);
                
                elements.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `• `,
                                bold: true
                            }),
                            new TextRun({
                                text: `[${priority.priority}] `,
                                color: priorityColor,
                                bold: true
                            }),
                            new TextRun({
                                text: priority.action
                            })
                        ],
                        spacing: { after: 150 },
                        bullet: { level: 0 }
                    })
                );
            }
        }
        
        // Security priorities
        if (topPriorities.security.length > 0) {
            elements.push(
                new Paragraph({
                    text: 'Security Posture',
                    heading: HeadingLevel.HEADING_3,
                    spacing: { after: 200, before: 300 }
                })
            );
            
            for (let i = 0; i < Math.min(3, topPriorities.security.length); i++) {
                const priority = topPriorities.security[i];
                const priorityColor = this.getPriorityColor(priority.priority);
                
                elements.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `• `,
                                bold: true
                            }),
                            new TextRun({
                                text: `[${priority.priority}] `,
                                color: priorityColor,
                                bold: true
                            }),
                            new TextRun({
                                text: priority.action
                            })
                        ],
                        spacing: { after: 150 },
                        bullet: { level: 0 }
                    })
                );
            }
        }
        
        // Endpoint priorities
        if (topPriorities.endpoint.length > 0) {
            elements.push(
                new Paragraph({
                    text: 'Endpoint Management',
                    heading: HeadingLevel.HEADING_3,
                    spacing: { after: 200, before: 300 }
                })
            );
            
            for (let i = 0; i < Math.min(3, topPriorities.endpoint.length); i++) {
                const priority = topPriorities.endpoint[i];
                const priorityColor = this.getPriorityColor(priority.priority);
                
                elements.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `• `,
                                bold: true
                            }),
                            new TextRun({
                                text: `[${priority.priority}] `,
                                color: priorityColor,
                                bold: true
                            }),
                            new TextRun({
                                text: priority.action
                            })
                        ],
                        spacing: { after: 150 },
                        bullet: { level: 0 }
                    })
                );
            }
        }
        
        // Closing statement
        elements.push(
            new Paragraph({
                text: '',
                spacing: { after: 300 }
            }),
            new Paragraph({
                text: 'ICB Solutions Commitment',
                heading: HeadingLevel.HEADING_3,
                spacing: { after: 200, before: 400 }
            }),
            new Paragraph({
                text: 'Our team is committed to working alongside you to implement these recommendations and ensure your Microsoft 365 environment remains secure, compliant, and optimized for your business needs. We will schedule follow-up sessions to discuss these priorities and develop an implementation roadmap that aligns with your business objectives.',
                spacing: { after: 400, line: 360 }
            })
        );
        
        return elements;
    }

    /**
     * Get top priorities by category
     */
    getTopPrioritiesByCategory(aiAnalysis, categorizedScreenshots) {
        const priorities = {
            identity: [],
            security: [],
            endpoint: []
        };
        
        // Collect recommendations by category
        for (const [category, screenshots] of Object.entries(categorizedScreenshots)) {
            for (const screenshot of screenshots) {
                const sectionAnalysis = aiAnalysis.sectionAnalysis[screenshot.section];
                if (sectionAnalysis && sectionAnalysis.recommendations) {
                    priorities[category].push(...sectionAnalysis.recommendations);
                }
            }
            
            // Sort by priority and take top items
            priorities[category] = this.sortRecommendationsByPriority(priorities[category]);
        }
        
        return priorities;
    }

    /**
     * Sort recommendations by priority (High > Medium > Low)
     */
    sortRecommendationsByPriority(recommendations) {
        const priorityOrder = { 'High': 1, 'Medium': 2, 'Low': 3 };
        return recommendations.sort((a, b) => {
            const priorityA = priorityOrder[a.priority] || 999;
            const priorityB = priorityOrder[b.priority] || 999;
            return priorityA - priorityB;
        });
    }

    /**
     * Sanitize customer name for filename
     */
    sanitizeName(name) {
        return name.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
    }
}

module.exports = WordDocumentGenerator;
