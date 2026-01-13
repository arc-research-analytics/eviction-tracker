/**
 * PopupManager - Handles census tract popup creation with historical trend charts
 */
class PopupManager {
    constructor(dataLoader, mapManager) {
        this.dataLoader = dataLoader;
        this.mapManager = mapManager;
        this.currentPopup = null;
        this.currentChart = null;
        this.isLoading = false;
        this.tractCoordinates = null; // Store the tract's geographic coordinates
        this.mapMoveListener = null; // Store map move event listener
        this.currentTractId = null; // Store current tract ID for easy access
        this.currentTractName = null; // Store current tract name for heading updates
    }

    /**
     * Show popup with historical data for a specific census tract
     */
    async showTractPopup(tractId, tractName, clickEvent) {
        // Prevent multiple popups from opening simultaneously
        if (this.isLoading) return;
        
        // Close existing popup without clearing the selected tract
        this.closePopupOnly();
        
        try {
            this.isLoading = true;

            // Store the tract ID, name, and geographic coordinates from the click event
            this.currentTractId = tractId;
            this.currentTractName = tractName;
            this.tractCoordinates = clickEvent.lngLat;

            // Create popup element with loading state
            this.currentPopup = this.createPopupElement(tractName);
            document.body.appendChild(this.currentPopup);
            
            // Position popup based on geographic coordinates
            this.positionPopupByCoordinates();
            
            // Set up map move listener to keep popup anchored
            this.setupMapMoveListener();
            
            // Load historical data
            const historicalData = await this.loadHistoricalData(tractId);
            
            // Create chart with the data
            this.createChart(historicalData);
            
        } catch (error) {
            this.showErrorInPopup('Failed to load historical data');
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Create popup HTML element
     */
    createPopupElement(tractName) {
        const popup = document.createElement('div');
        popup.className = 'tract-popup';
        const geographyType = this.dataLoader.getGeographyType();
        const geographyLabel = this.getGeographyLabel(geographyType);
        const displayMode = this.dataLoader.getDisplayMode();
        const headingText = displayMode === 'rate' ? 'Monthly Filing Rate in' : 'Monthly Filings in';

        popup.innerHTML = `
            <div class="popup-header">
                <h3 class="tract-name">${headingText} ${tractName || geographyLabel}</h3>
                <button class="popup-close" type="button">&times;</button>
            </div>
            <div class="popup-content">
                <div class="chart-container">
                    <div class="loading-chart">
                        <wa-spinner style="font-size: 1.5rem"></wa-spinner>
                        <span>Loading trend data...</span>
                    </div>
                    <canvas id="trendChart" width="320" height="120"></canvas>
                </div>
                <div class="chart-explanation">
                    Vertical dashed line represents the time period selected by the slider.
                </div>
            </div>
        `;

        // Add close button event listener
        const closeBtn = popup.querySelector('.popup-close');
        closeBtn.addEventListener('click', () => this.closePopup());

        // Close popup when clicking outside
        document.addEventListener('click', this.handleOutsideClick.bind(this), true);

        return popup;
    }

    /**
     * Position popup based on stored geographic coordinates
     */
    positionPopupByCoordinates() {
        if (!this.currentPopup || !this.tractCoordinates || !this.mapManager) return;
        
        const map = this.mapManager.getMap();
        if (!map) return;
        
        // Convert geographic coordinates to screen coordinates
        const point = map.project(this.tractCoordinates);
        
        const popup = this.currentPopup;
        
        // Use calculated screen coordinates with offset
        let left = point.x + 15; // Small offset from tract center
        let top = point.y - 15;
        
        // Adjust if popup would go outside viewport
        if (left + 460 > window.innerWidth) { // Updated for new popup width
            left = point.x - 475; // Flip to left side
        }
        
        if (top + 220 > window.innerHeight) { // Estimated popup height
            top = point.y - 205; // Flip to above tract center
        }
        
        // Ensure popup stays within bounds
        left = Math.max(10, Math.min(left, window.innerWidth - 470));
        top = Math.max(10, Math.min(top, window.innerHeight - 230));
        
        popup.style.left = left + 'px';
        popup.style.top = top + 'px';
    }

    /**
     * Set up map move listener to keep popup anchored to tract location
     */
    setupMapMoveListener() {
        if (!this.mapManager) return;
        
        const map = this.mapManager.getMap();
        if (!map) return;
        
        // Remove any existing listener
        if (this.mapMoveListener) {
            map.off('move', this.mapMoveListener);
        }
        
        // Create new listener
        this.mapMoveListener = () => {
            this.positionPopupByCoordinates();
        };
        
        // Add listener for map move events
        map.on('move', this.mapMoveListener);
    }

    /**
     * Load historical eviction data for a specific location
     */
    async loadHistoricalData(tractId) {
        try {
            // Get current geography configuration
            const geographyType = this.dataLoader.getGeographyType();
            const config = this.dataLoader.geographyConfig[geographyType];

            const { data, error } = await this.dataLoader.supabase
                .from(config.table)
                .select(`filemonth, totalfilings, filing-rate, ${config.idField}`)
                .eq(config.idField, tractId)
                .order('filemonth', { ascending: true });

            if (error) throw error;

            // Convert data to chart format based on display mode
            const monthUtils = this.dataLoader.getMonthUtils();
            const displayMode = this.dataLoader.getDisplayMode();
            const chartData = {
                labels: [],
                values: []
            };

            if (data && data.length > 0) {
                data.forEach(record => {
                    const monthLabel = monthUtils.dbMonthToHumanReadable(record.filemonth);
                    chartData.labels.push(monthLabel);

                    // Use rate or count based on display mode
                    if (displayMode === 'rate') {
                        chartData.values.push((record['filing-rate'] || 0) * 100);  // Convert decimal to percentage
                    } else {
                        chartData.values.push(record.totalfilings || 0);
                    }
                });
            }

            return chartData;

        } catch (error) {
            throw new Error('Failed to load historical trend data');
        }
    }

    /**
     * Create Chart.js sparkline chart
     */
    createChart(data) {
        const canvas = this.currentPopup.querySelector('#trendChart');
        const loadingDiv = this.currentPopup.querySelector('.loading-chart');
        
        if (!canvas) return;
        
        // Hide loading indicator
        if (loadingDiv) {
            loadingDiv.style.display = 'none';
        }
        
        // Show canvas
        canvas.style.display = 'block';
        
        // Destroy existing chart if any
        if (this.currentChart) {
            this.currentChart.destroy();
        }
        
        // Get current slider month for vertical line
        const currentMonth = this.dataLoader.getCurrentMonth();
        const monthUtils = this.dataLoader.getMonthUtils();
        const currentMonthLabel = monthUtils.dbMonthToHumanReadable(currentMonth);
        
        // Find index of current month in chart data
        const currentMonthIndex = data.labels.indexOf(currentMonthLabel);
        
        const ctx = canvas.getContext('2d');
        
        // Create custom plugin for vertical lines (static + hover crosshair)
        const popupManager = this; // Reference to this instance for closure
        const verticalLinePlugin = {
            id: 'verticalLine',
            afterDraw: (chart) => {
                const ctx = chart.ctx;
                const chartArea = chart.chartArea;
                const xScale = chart.scales.x;
                
                // Draw static vertical line for current month (dashed)
                if (popupManager.currentMonthIndex >= 0) {
                    const xPos = xScale.getPixelForValue(popupManager.currentMonthIndex);
                    
                    ctx.save();
                    ctx.strokeStyle = 'rgba(128, 128, 128, 0.7)';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([5, 5]); // Dashed line for current month
                    ctx.beginPath();
                    ctx.moveTo(xPos, chartArea.top);
                    ctx.lineTo(xPos, chartArea.bottom);
                    ctx.stroke();
                    ctx.restore();
                }
                
                // Draw dynamic hover crosshair (solid line)
                if (chart.tooltip && chart.tooltip.opacity > 0) {
                    const activeElements = chart.tooltip.dataPoints;
                    if (activeElements && activeElements.length > 0) {
                        const xPos = activeElements[0].element.x;
                        
                        ctx.save();
                        ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)'; // Light black for hover line
                        ctx.lineWidth = 1;
                        ctx.setLineDash([]); // Solid line for hover
                        ctx.beginPath();
                        ctx.moveTo(xPos, chartArea.top);
                        ctx.lineTo(xPos, chartArea.bottom);
                        ctx.stroke();
                        ctx.restore();
                    }
                }
            }
        };

        this.currentChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    data: data.values,
                    borderColor: '#e31a1c',
                    backgroundColor: 'rgba(227, 26, 28, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    pointBackgroundColor: '#e31a1c',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        right: 20 // Add right padding to balance the y-axis title
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: '#e31a1c',
                        borderWidth: 1,
                        displayColors: false,
                        callbacks: {
                            title: function(context) {
                                return context[0].label;
                            },
                            label: function(context) {
                                const value = context.parsed.y;
                                const displayMode = popupManager.dataLoader.getDisplayMode();

                                if (displayMode === 'rate') {
                                    // Format as percentage (multiplied by 100 when loaded)
                                    return `${value.toFixed(2)}% filing rate`;
                                } else {
                                    return `${value} eviction${value !== 1 ? 's' : ''}`;
                                }
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: false // Hide x-axis for sparkline look
                    },
                    y: {
                        title: {
                            display: true,
                            text: this.getYAxisTitle()
                        },
                        display: true,
                        beginAtZero: true,
                        grid: {
                            display: false // Hide grid lines for cleaner look
                        },
                        ticks: {
                            font: {
                                size: 10 // Small but legible font size
                            },
                            color: '#666666',
                            maxTicksLimit: 4, // Limit to max 4 ticks to prevent crowding
                            padding: 5
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                hover: {
                    mode: 'index',
                    intersect: false
                }
            },
            plugins: [verticalLinePlugin]
        });
        
        // Store chart data for potential updates
        this.chartData = data;
        this.currentMonthIndex = currentMonthIndex;
    }

    /**
     * Update the vertical line position when slider changes
     */
    updateVerticalLine() {
        if (!this.currentChart || !this.chartData) return;
        
        // Get new current month
        const currentMonth = this.dataLoader.getCurrentMonth();
        const monthUtils = this.dataLoader.getMonthUtils();
        const currentMonthLabel = monthUtils.dbMonthToHumanReadable(currentMonth);
        
        // Find new index of current month in chart data
        const newCurrentMonthIndex = this.chartData.labels.indexOf(currentMonthLabel);
        
        // Update stored index
        this.currentMonthIndex = newCurrentMonthIndex;
        
        // Trigger chart redraw to show new vertical line position
        this.currentChart.update('none'); // 'none' for no animation
    }

    /**
     * Show error message in popup
     */
    showErrorInPopup(message) {
        if (!this.currentPopup) return;
        
        const loadingDiv = this.currentPopup.querySelector('.loading-chart');
        if (loadingDiv) {
            loadingDiv.innerHTML = `
                <wa-icon name="exclamation-triangle" style="color: #c62828;"></wa-icon>
                <span style="color: #c62828;">${message}</span>
            `;
        }
    }

    /**
     * Close current popup and clear selected tract
     */
    closePopup() {
        this.closePopupOnly();
        
        // Clear selected tract border when popup closes
        if (this.mapManager && this.mapManager.clearSelectedTract) {
            this.mapManager.clearSelectedTract();
        }
    }

    /**
     * Close only the popup without clearing the selected tract
     */
    closePopupOnly() {
        if (this.currentChart) {
            this.currentChart.destroy();
            this.currentChart = null;
        }
        
        if (this.currentPopup) {
            this.currentPopup.remove();
            this.currentPopup = null;
        }
        
        // Remove map move listener
        if (this.mapMoveListener && this.mapManager) {
            const map = this.mapManager.getMap();
            if (map) {
                map.off('move', this.mapMoveListener);
            }
            this.mapMoveListener = null;
        }
        
        // Clear stored coordinates, tract ID, and tract name
        this.tractCoordinates = null;
        this.currentTractId = null;
        this.currentTractName = null;

        // Remove outside click listener
        document.removeEventListener('click', this.handleOutsideClick.bind(this), true);
    }

    /**
     * Handle clicks outside the popup to close it
     */
    handleOutsideClick(event) {
        if (this.currentPopup && !this.currentPopup.contains(event.target)) {
            this.closePopup();
        }
    }

    /**
     * Get Y-axis title based on display mode
     */
    getYAxisTitle() {
        const displayMode = this.dataLoader.getDisplayMode();
        return displayMode === 'rate' ? 'Filing Rate (%)' : 'Evictions';
    }

    /**
     * Update chart when display mode changes
     */
    async updateChartForDisplayMode(tractId) {
        if (!this.currentChart || !this.currentPopup) return;

        try {
            // Update popup heading text based on new display mode
            this.updatePopupHeading();

            // Reload historical data for new display mode
            const historicalData = await this.loadHistoricalData(tractId);

            // Update chart data
            this.currentChart.data.datasets[0].data = historicalData.values;

            // Update y-axis title
            this.currentChart.options.scales.y.title.text = this.getYAxisTitle();

            // Update the chart
            this.currentChart.update();

            // Update stored chart data
            this.chartData = historicalData;

        } catch (error) {
        }
    }

    /**
     * Update popup heading text based on current display mode
     */
    updatePopupHeading() {
        if (!this.currentPopup || !this.currentTractName) return;

        const displayMode = this.dataLoader.getDisplayMode();
        const headingText = displayMode === 'rate' ? 'Monthly Filing Rate in' : 'Monthly Filings in';
        const geographyType = this.dataLoader.getGeographyType();
        const geographyLabel = this.getGeographyLabel(geographyType);

        const headingElement = this.currentPopup.querySelector('.tract-name');
        if (headingElement) {
            headingElement.textContent = `${headingText} ${this.currentTractName || geographyLabel}`;
        }
    }

    /**
     * Get geography label for popup title
     */
    getGeographyLabel(geographyType) {
        const labels = {
            tract: 'Census Tract',
            school: 'School Zone',
            hex: 'Hexagon'
        };
        return labels[geographyType] || 'Location';
    }

    /**
     * Get location name from properties based on geography type
     */
    getTractName(properties) {
        const geographyType = this.dataLoader.getGeographyType();

        if (geographyType === 'tract') {
            if (properties.GEOID) {
                // Format as State-County-Tract (e.g., 13-121-007810)
                const geoid = properties.GEOID;
                if (geoid.length >= 11) {
                    const state = geoid.slice(0, 2);        // First 2 digits (13)
                    const county = geoid.slice(2, 5);       // Next 3 digits (121)
                    const tract = geoid.slice(5);           // Remaining digits (007810)
                    return `Tract ${state}-${county}-${tract}`;
                }
                return `Tract ${geoid}`;
            }
        } else if (geographyType === 'school') {
            if (properties.ShortLabel) {
                return `${properties.ShortLabel} High School`;
            }
        } else if (geographyType === 'hex') {
            if (properties.hex_id) {
                // Show shortened hex ID for readability
                return `Hex ${properties.hex_id.substring(0, 10)}...`;
            }
        }

        // Fallback
        return this.getGeographyLabel(geographyType);
    }
}
