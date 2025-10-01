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
            // Build document sections
            const sections = [];
            
            // Section 1: Cover page and metadata
            sections.push(...await this.createCoverPage(customerName, reportDate));
            
            // Section 2: Table of Contents
            sections.push(this.createTableOfContents());
            
            // Section 3: Executive Summary
            sections.push(...this.createExecutiveSummary(aiAnalysis.executiveSummary));
            
            // Section 4: Customer Details
            sections.push(...this.createCustomerDetails(customerName, reportDate));
            
            // Section 5: Detailed Sections (Licenses, Security, Devices)
            for (const screenshot of screenshots) {
                const sectionAnalysis = aiAnalysis.sectionAnalysis[screenshot.section];
                if (sectionAnalysis) {
                    sections.push(...await this.createDetailedSection(
                        screenshot,
                        sectionAnalysis
                    ));
                }
            }
            
            // Section 6: Next Month Priorities
            sections.push(...this.createPrioritiesSection(aiAnalysis.overallPriorities));
            
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
        
        return [
            new Paragraph({
                text: '',
                spacing: { after: 400 }
            }),
            new Paragraph({
                text: 'ICB SOLUTIONS',
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
                spacing: { after: 200 },
                children: [
                    new TextRun({
                        text: 'ICB SOLUTIONS',
                        color: this.icbNavyBlue,
                        size: 48,
                        bold: true
                    })
                ]
            }),
            new Paragraph({
                text: 'Microsoft 365 Health Report',
                heading: HeadingLevel.HEADING_2,
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 },
                children: [
                    new TextRun({
                        text: 'Microsoft 365 Health Report',
                        color: this.icbPrimaryBlue,
                        size: 36
                    })
                ]
            }),
            new Paragraph({
                text: '',
                spacing: { after: 600 }
            }),
            new Paragraph({
                text: customerName,
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
                spacing: { after: 200 },
                children: [
                    new TextRun({
                        text: customerName,
                        size: 40,
                        bold: true
                    })
                ]
            }),
            new Paragraph({
                text: monthYear,
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 },
                children: [
                    new TextRun({
                        text: monthYear,
                        size: 28,
                        italics: true
                    })
                ]
            }),
            new Paragraph({
                text: '',
                spacing: { after: 800 }
            }),
            new Paragraph({
                text: `Confidential - For ${customerName} Only`,
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
                text: `Prepared by ICB Solutions - ${reportDate.toLocaleDateString()}`,
                alignment: AlignmentType.CENTER,
                spacing: { after: 400 },
                children: [
                    new TextRun({
                        text: `Prepared by ICB Solutions - ${reportDate.toLocaleDateString()}`,
                        size: 18,
                        italics: true
                    })
                ]
            }),
            new Paragraph({
                text: '',
                pageBreakBefore: true
            })
        ];
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
     * Create customer details section
     */
    createCustomerDetails(customerName, reportDate) {
        return [
            new Paragraph({
                text: '',
                pageBreakBefore: true
            }),
            new Paragraph({
                text: 'Customer Details',
                heading: HeadingLevel.HEADING_1,
                spacing: { after: 300 }
            }),
            new Paragraph({
                text: `Organization: ${customerName}`,
                spacing: { after: 200 }
            }),
            new Paragraph({
                text: `Report Period: ${reportDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
                spacing: { after: 200 }
            }),
            new Paragraph({
                text: `Generated: ${reportDate.toLocaleDateString()} ${reportDate.toLocaleTimeString()}`,
                spacing: { after: 200 }
            }),
            new Paragraph({
                text: `Prepared by: ICB Solutions`,
                spacing: { after: 400 }
            })
        ];
    }

    /**
     * Create detailed section with screenshot and analysis
     */
    async createDetailedSection(screenshot, analysis) {
        const sectionTitle = this.formatSectionTitle(screenshot.section);
        const elements = [];
        
        // Section heading
        elements.push(
            new Paragraph({
                text: '',
                pageBreakBefore: true
            }),
            new Paragraph({
                text: sectionTitle,
                heading: HeadingLevel.HEADING_1,
                spacing: { after: 300 }
            })
        );
        
        // Screenshot description
        elements.push(
            new Paragraph({
                text: screenshot.description,
                spacing: { after: 200 },
                italics: true
            })
        );
        
        // Embed screenshot
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
                    spacing: { after: 300 },
                    alignment: AlignmentType.CENTER
                }),
                new Paragraph({
                    text: `Figure: ${screenshot.name}`,
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 400 },
                    italics: true
                })
            );
        } catch (error) {
            console.error(`Error embedding screenshot ${screenshot.name}:`, error);
        }
        
        // Analysis summary
        elements.push(
            new Paragraph({
                text: 'Analysis',
                heading: HeadingLevel.HEADING_2,
                spacing: { after: 200 }
            }),
            new Paragraph({
                text: analysis.summary,
                spacing: { after: 300, line: 360 }
            })
        );
        
        // Key findings
        if (analysis.findings && analysis.findings.length > 0) {
            elements.push(
                new Paragraph({
                    text: 'Key Findings',
                    heading: HeadingLevel.HEADING_2,
                    spacing: { after: 200 }
                })
            );
            
            for (const finding of analysis.findings) {
                elements.push(
                    new Paragraph({
                        text: finding,
                        bullet: { level: 0 },
                        spacing: { after: 150 }
                    })
                );
            }
        }
        
        // Recommendations
        if (analysis.recommendations && analysis.recommendations.length > 0) {
            elements.push(
                new Paragraph({
                    text: 'Recommendations',
                    heading: HeadingLevel.HEADING_2,
                    spacing: { after: 200, before: 300 }
                })
            );
            
            for (const rec of analysis.recommendations) {
                const priorityColor = this.getPriorityColor(rec.priority);
                elements.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `[${rec.priority}] `,
                                color: priorityColor,
                                bold: true
                            }),
                            new TextRun({
                                text: rec.action
                            }),
                            new TextRun({
                                text: ` (${rec.timeEstimate})`,
                                italics: true,
                                color: '6b7280'
                            })
                        ],
                        bullet: { level: 0 },
                        spacing: { after: 150 }
                    })
                );
            }
        }
        
        return elements;
    }

    /**
     * Create next month priorities section
     */
    createPrioritiesSection(priorities) {
        const elements = [
            new Paragraph({
                text: '',
                pageBreakBefore: true
            }),
            new Paragraph({
                text: 'Next Month Priorities',
                heading: HeadingLevel.HEADING_1,
                spacing: { after: 300 }
            }),
            new Paragraph({
                text: 'Based on the comprehensive analysis, ICB Solutions recommends focusing on the following priorities for the upcoming month:',
                spacing: { after: 400, line: 360 }
            })
        ];
        
        if (priorities && priorities.length > 0) {
            for (let i = 0; i < priorities.length; i++) {
                const priority = priorities[i];
                const priorityColor = this.getPriorityColor(priority.priority);
                
                elements.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `${i + 1}. `,
                                bold: true,
                                size: 24
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
                        spacing: { after: 150, before: 150 }
                    }),
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: `   Estimated Effort: ${priority.timeEstimate}`,
                                italics: true,
                                color: '6b7280'
                            })
                        ],
                        spacing: { after: 300 }
                    })
                );
            }
        }
        
        return elements;
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
     * Format section title from section ID
     */
    formatSectionTitle(sectionId) {
        const titles = {
            'licenses': 'License Allocation & Usage',
            'security-summary': 'Security Summary',
            'security-report': 'Comprehensive Security Report',
            'device-health': 'Device Health & Compliance'
        };
        return titles[sectionId] || sectionId;
    }

    /**
     * Sanitize customer name for filename
     */
    sanitizeName(name) {
        return name.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_');
    }
}

module.exports = WordDocumentGenerator;
