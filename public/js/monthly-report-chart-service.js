/**
 * ICB Solutions Chart Generation Service
 * Professional chart generation for Monthly Reports using Chart.js
 * Integrates with Microsoft Graph API data for accurate visualizations
 */

class MonthlyReportChartService {
    constructor() {
        this.chartDefaults = {
            responsive: false,
            animation: false,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        padding: 15,
                        font: {
                            size: 11,
                            family: 'Helvetica'
                        }
                    }
                }
            },
            layout: {
                padding: {
                    top: 20,
                    bottom: 20,
                    left: 20,
                    right: 20
                }
            }
        };

        // ICB Solutions color scheme
        this.colors = {
            primary: '#3e8ab4',
            secondary: '#2f6b8a',
            accent: '#10b981',
            danger: '#dc2626',
            warning: '#f59e0b',
            info: '#3b82f6',
            success: '#059669',
            light: '#f8fafc',
            dark: '#1f2937'
        };

        this.chartColors = [
            this.colors.primary,
            this.colors.accent,
            this.colors.warning,
            this.colors.info,
            this.colors.danger,
            this.colors.secondary
        ];
    }

    /**
     * Generate security score trend chart
     */
    async generateSecurityScoreChart(data, width = 400, height = 250) {
        const canvas = this.createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Sample data - in real implementation, this would come from reportData
        const securityScoreData = data?.securityHistory || this.generateSampleSecurityData();

        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: securityScoreData.map(item => item.date),
                datasets: [{
                    label: 'Security Score',
                    data: securityScoreData.map(item => item.score),
                    borderColor: this.colors.primary,
                    backgroundColor: this.addTransparency(this.colors.primary, 0.1),
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: this.colors.primary,
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 5
                }]
            },
            options: {
                ...this.chartDefaults,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        },
                        grid: {
                            color: '#e5e7eb'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                plugins: {
                    ...this.chartDefaults.plugins,
                    title: {
                        display: true,
                        text: 'Security Score Trend (Last 30 Days)',
                        font: {
                            size: 14,
                            weight: 'bold'
                        },
                        color: this.colors.dark
                    }
                }
            }
        });

        await this.waitForChartRender(chart);
        return canvas.toDataURL('image/png');
    }

    /**
     * Generate compliance overview donut chart
     */
    async generateComplianceChart(data, width = 300, height = 300) {
        const canvas = this.createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        const complianceData = data?.complianceBreakdown || {
            compliant: 75,
            nonCompliant: 15,
            notApplicable: 10
        };

        const chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Compliant', 'Non-Compliant', 'Not Applicable'],
                datasets: [{
                    data: [complianceData.compliant, complianceData.nonCompliant, complianceData.notApplicable],
                    backgroundColor: [
                        this.colors.success,
                        this.colors.danger,
                        this.colors.warning
                    ],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                ...this.chartDefaults,
                cutout: '60%',
                plugins: {
                    ...this.chartDefaults.plugins,
                    title: {
                        display: true,
                        text: 'Device Compliance Overview',
                        font: {
                            size: 14,
                            weight: 'bold'
                        },
                        color: this.colors.dark
                    }
                }
            }
        });

        await this.waitForChartRender(chart);
        return canvas.toDataURL('image/png');
    }

    /**
     * Generate MFA adoption chart
     */
    async generateMFAChart(data, width = 350, height = 200) {
        const canvas = this.createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        const mfaData = data?.mfaBreakdown || {
            enabled: 120,
            disabled: 25,
            enforced: 95
        };

        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['MFA Enabled', 'MFA Disabled', 'MFA Enforced'],
                datasets: [{
                    label: 'Users',
                    data: [mfaData.enabled, mfaData.disabled, mfaData.enforced],
                    backgroundColor: [
                        this.colors.success,
                        this.colors.danger,
                        this.colors.primary
                    ],
                    borderColor: [
                        this.colors.success,
                        this.colors.danger,
                        this.colors.primary
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                ...this.chartDefaults,
                plugins: {
                    ...this.chartDefaults.plugins,
                    title: {
                        display: true,
                        text: 'Multi-Factor Authentication Status',
                        font: {
                            size: 14,
                            weight: 'bold'
                        },
                        color: this.colors.dark
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 10
                        },
                        grid: {
                            color: '#e5e7eb'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });

        await this.waitForChartRender(chart);
        return canvas.toDataURL('image/png');
    }

    /**
     * Generate device types distribution pie chart
     */
    async generateDeviceTypesChart(data, width = 300, height = 300) {
        const canvas = this.createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        const deviceData = data?.deviceTypes || {
            Windows: 45,
            iOS: 25,
            Android: 20,
            macOS: 10
        };

        const chart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: Object.keys(deviceData),
                datasets: [{
                    data: Object.values(deviceData),
                    backgroundColor: this.chartColors.slice(0, Object.keys(deviceData).length),
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                ...this.chartDefaults,
                plugins: {
                    ...this.chartDefaults.plugins,
                    title: {
                        display: true,
                        text: 'Device Types Distribution',
                        font: {
                            size: 14,
                            weight: 'bold'
                        },
                        color: this.colors.dark
                    }
                }
            }
        });

        await this.waitForChartRender(chart);
        return canvas.toDataURL('image/png');
    }

    /**
     * Generate security alerts timeline
     */
    async generateSecurityAlertsChart(data, width = 500, height = 250) {
        const canvas = this.createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        const alertsData = data?.securityAlerts || this.generateSampleAlertsData();

        const chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: alertsData.map(item => item.date),
                datasets: [
                    {
                        label: 'Critical',
                        data: alertsData.map(item => item.critical),
                        backgroundColor: this.colors.danger,
                        borderColor: this.colors.danger,
                        borderWidth: 1
                    },
                    {
                        label: 'High',
                        data: alertsData.map(item => item.high),
                        backgroundColor: this.colors.warning,
                        borderColor: this.colors.warning,
                        borderWidth: 1
                    },
                    {
                        label: 'Medium',
                        data: alertsData.map(item => item.medium),
                        backgroundColor: this.colors.info,
                        borderColor: this.colors.info,
                        borderWidth: 1
                    }
                ]
            },
            options: {
                ...this.chartDefaults,
                scales: {
                    x: {
                        stacked: true,
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        grid: {
                            color: '#e5e7eb'
                        }
                    }
                },
                plugins: {
                    ...this.chartDefaults.plugins,
                    title: {
                        display: true,
                        text: 'Security Alerts Timeline (Last 7 Days)',
                        font: {
                            size: 14,
                            weight: 'bold'
                        },
                        color: this.colors.dark
                    }
                }
            }
        });

        await this.waitForChartRender(chart);
        return canvas.toDataURL('image/png');
    }

    /**
     * Generate threat protection status chart
     */
    async generateThreatProtectionChart(data, width = 400, height = 250) {
        const canvas = this.createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        const threatData = data?.threatProtection || {
            'Anti-malware': 98,
            'Safe Attachments': 95,
            'Safe Links': 92,
            'Anti-phishing': 96,
            'ATP': 88
        };

        const chart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: Object.keys(threatData),
                datasets: [{
                    label: 'Protection Score (%)',
                    data: Object.values(threatData),
                    backgroundColor: this.addTransparency(this.colors.primary, 0.2),
                    borderColor: this.colors.primary,
                    borderWidth: 2,
                    pointBackgroundColor: this.colors.primary,
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                ...this.chartDefaults,
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            stepSize: 20,
                            callback: function(value) {
                                return value + '%';
                            }
                        },
                        grid: {
                            color: '#e5e7eb'
                        }
                    }
                },
                plugins: {
                    ...this.chartDefaults.plugins,
                    title: {
                        display: true,
                        text: 'Threat Protection Coverage',
                        font: {
                            size: 14,
                            weight: 'bold'
                        },
                        color: this.colors.dark
                    }
                }
            }
        });

        await this.waitForChartRender(chart);
        return canvas.toDataURL('image/png');
    }

    /**
     * Generate user activity chart
     */
    async generateUserActivityChart(data, width = 450, height = 250) {
        const canvas = this.createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        const activityData = data?.userActivity || this.generateSampleUserActivity();

        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: activityData.map(item => item.date),
                datasets: [
                    {
                        label: 'Active Users',
                        data: activityData.map(item => item.activeUsers),
                        borderColor: this.colors.primary,
                        backgroundColor: this.addTransparency(this.colors.primary, 0.1),
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Sign-ins',
                        data: activityData.map(item => item.signIns),
                        borderColor: this.colors.accent,
                        backgroundColor: this.addTransparency(this.colors.accent, 0.1),
                        borderWidth: 2,
                        fill: false,
                        tension: 0.4
                    }
                ]
            },
            options: {
                ...this.chartDefaults,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: '#e5e7eb'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                plugins: {
                    ...this.chartDefaults.plugins,
                    title: {
                        display: true,
                        text: 'User Activity Trends',
                        font: {
                            size: 14,
                            weight: 'bold'
                        },
                        color: this.colors.dark
                    }
                }
            }
        });

        await this.waitForChartRender(chart);
        return canvas.toDataURL('image/png');
    }

    /**
     * Helper method to create canvas element
     */
    createCanvas(width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        
        // Add to DOM temporarily for Chart.js rendering
        canvas.style.position = 'absolute';
        canvas.style.top = '-9999px';
        canvas.style.left = '-9999px';
        document.body.appendChild(canvas);
        
        return canvas;
    }

    /**
     * Wait for chart to finish rendering
     */
    async waitForChartRender(chart) {
        return new Promise((resolve) => {
            chart.options.animation = {
                onComplete: () => {
                    setTimeout(() => {
                        resolve();
                    }, 100);
                }
            };
            chart.update();
        });
    }

    /**
     * Add transparency to color
     */
    addTransparency(color, alpha) {
        // Convert hex to rgba
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    /**
     * Generate sample security score data
     */
    generateSampleSecurityData() {
        const data = [];
        const today = new Date();
        
        for (let i = 29; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            
            data.push({
                date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                score: Math.floor(Math.random() * 20) + 75 // Random score between 75-95
            });
        }
        
        return data;
    }

    /**
     * Generate sample alerts data
     */
    generateSampleAlertsData() {
        const data = [];
        const today = new Date();
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            
            data.push({
                date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                critical: Math.floor(Math.random() * 3),
                high: Math.floor(Math.random() * 8),
                medium: Math.floor(Math.random() * 15)
            });
        }
        
        return data;
    }

    /**
     * Generate sample user activity data
     */
    generateSampleUserActivity() {
        const data = [];
        const today = new Date();
        
        for (let i = 13; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            
            data.push({
                date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                activeUsers: Math.floor(Math.random() * 50) + 100,
                signIns: Math.floor(Math.random() * 200) + 150
            });
        }
        
        return data;
    }

    /**
     * Clean up canvas elements after chart generation
     */
    cleanup() {
        const canvases = document.querySelectorAll('canvas[style*="position: absolute"]');
        canvases.forEach(canvas => {
            if (canvas.parentNode) {
                canvas.parentNode.removeChild(canvas);
            }
        });
    }
}

// Make the class globally available
window.MonthlyReportChartService = MonthlyReportChartService;