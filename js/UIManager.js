/**
 * UIManager - Handles UI operations, loading screens, and display updates
 */
class UIManager {
    constructor(dataLoader) {
        this.dataLoader = dataLoader;
        this.layerManager = null; // Will be set after MapManager is initialized
        this.loadingTimeout = null;
        this.isLoading = false;
    }

    /**
     * Set the layer manager reference (called after MapManager is initialized)
     */
    setLayerManager(layerManager) {
        this.layerManager = layerManager;
    }

    /**
     * Show loading overlay after 0.5 second delay
     */
    showLoading() {
        if (this.isLoading) return; // Already loading
        
        this.isLoading = true;
        this.loadingTimeout = setTimeout(() => {
            const overlay = document.getElementById('loadingOverlay');
            if (overlay && this.isLoading) {
                // Remove any previous fade-out state and show overlay
                overlay.classList.remove('hidden', 'fade-out');
            }
        }, 500);
    }

    /**
     * Hide loading overlay with fade-out animation
     */
    hideLoading() {
        this.isLoading = false;
        
        // Clear timeout if it hasn't fired yet
        if (this.loadingTimeout) {
            clearTimeout(this.loadingTimeout);
            this.loadingTimeout = null;
        }
        
        // Fade out overlay if it's currently showing
        const overlay = document.getElementById('loadingOverlay');
        if (overlay && !overlay.classList.contains('hidden')) {
            // Start fade-out animation
            overlay.classList.add('fade-out');
            
            // Hide completely after animation completes (400ms)
            setTimeout(() => {
                overlay.classList.add('hidden');
                overlay.classList.remove('fade-out');
            }, 400);
        }
    }

    /**
     * Show error overlay
     */
    showError(message) {
        // Create error overlay similar to loading overlay
        const errorOverlay = document.createElement('div');
        errorOverlay.className = 'loading-overlay';
        errorOverlay.innerHTML = `
            <div class="loading-content" style="color: #ffebee;">
                <wa-icon name="exclamation-triangle" size="large"></wa-icon>
                <div class="loading-text" style="color: #c62828;">Error: ${message}</div>
            </div>
        `;
        
        // Replace loading overlay with error overlay
        const existingOverlay = document.getElementById('loadingOverlay');
        if (existingOverlay) {
            existingOverlay.parentNode.replaceChild(errorOverlay, existingOverlay);
        } else {
            document.body.appendChild(errorOverlay);
        }
    }

    /**
     * Update the month display with current month and total evictions
     */
    async updateMonthDisplay() {
        const monthText = document.getElementById('monthText');
        const totalText = document.getElementById('totalText');

        if (monthText && totalText) {
            const formattedMonth = this.dataLoader.formatMonthDisplay(this.dataLoader.getCurrentMonth());
            const totalEvictions = await this.dataLoader.calculateTotalEvictions();

            // Hide the month text element since we're combining the display
            monthText.style.display = 'none';

            // Show combined format in the total text element
            totalText.innerHTML = `Regional eviction filings<br/> in ${formattedMonth}: ${totalEvictions.toLocaleString()}`;
        }
    }

    /**
     * Add legend to the map
     */
    addLegend() {
        const legend = document.createElement('div');
        legend.className = 'legend';
        legend.id = 'mapLegend';
        this.updateLegend(legend);

        document.body.appendChild(legend);

        // After legend is added, match toggle container width
        this.matchToggleContainerWidth();
    }

    /**
     * Update legend content based on display mode and geography
     */
    updateLegend(legendElement = null) {
        const legend = legendElement || document.getElementById('mapLegend');
        if (!legend) return;

        const displayMode = this.dataLoader.getDisplayMode();
        const geographyType = this.dataLoader.getGeographyType();

        // Get geography name for legend title
        const geographyNames = {
            tract: 'Census Tract',
            school: 'High School Statistical Area',
            hex: 'H3 Hexagon',
            city: 'City'
        };
        const geographyName = geographyNames[geographyType] || 'Census Tract';

        // Get breakpoints from layer manager if available, otherwise use defaults
        let breakpoints;
        if (this.layerManager && this.layerManager.colorBreakpoints) {
            breakpoints = this.layerManager.colorBreakpoints[geographyType][displayMode];
        } else {
            breakpoints = displayMode === 'rate' ? [0, 2, 5, 8, 12] : [0, 10, 25, 60, 100];
        }

        const isRate = displayMode === 'rate';
        const unit = isRate ? '%' : '';

        // Tick labels: top (darkest) to bottom (lightest)
        const tickLabels = [
            `${breakpoints[3]}${unit}+`,
            `${breakpoints[2]}${unit}`,
            `${breakpoints[1]}${unit}`,
            isRate ? '>0%' : '>0',
            isRate ? '0%' : '0'
        ];

        const titleMode = isRate ? 'Eviction Filing Rate' : 'Eviction Filings';
        const explanation = isRate
            ? '"Rate" defined as the total filings divided by the number of renter-occupied housing units in 2023.'
            : `Raw eviction count for the given month in the ${geographyName.toLowerCase().replace('h3', 'H3')}.`;

        legend.innerHTML = `
            <h4 style="text-align: center;">${titleMode}<br/>by ${geographyName}</h4>
            <div class="legend-bar-wrapper">
                <div class="legend-bar" id="legendBar">
                    <div class="legend-hover-band" id="legendHoverBand"></div>
                    <div class="legend-threshold-line" id="legendThresholdLine"></div>
                </div>
                <div class="legend-bar-ticks">
                    ${tickLabels.map(label => `<span>${label}</span>`).join('')}
                </div>
            </div>
            <div class="legend-filter-row">
                <span class="legend-filter-hint">Click scale to filter map</span>
                <div class="legend-reset-btn-area">
                    <wa-tooltip for="legendResetBtn">Clear filter</wa-tooltip>
                    <wa-button id="legendResetBtn" appearance="plain" size="small" style="visibility: hidden;">
                        <wa-icon name="filter-circle-xmark"></wa-icon>
                    </wa-button>
                </div>
            </div>
            <div class="legend-explanation">${explanation}</div>
        `;

        // Attach click handler to bar.
        // Use legend.querySelector instead of document.getElementById so this works
        // even when legend hasn't been appended to the DOM yet (e.g. during addLegend()).
        const legendBar = legend.querySelector('#legendBar');
        const resetBtn = legend.querySelector('#legendResetBtn');

        if (legendBar) {
            const bp = breakpoints;
            const thresholds = [bp[3], bp[2], bp[1], 0.001, 0];
            const hoverBand = legend.querySelector('#legendHoverBand');

            legendBar.addEventListener('mousemove', (e) => {
                if (!hoverBand) return;
                const rect = legendBar.getBoundingClientRect();
                const relY = e.clientY - rect.top;
                const zone = Math.min(Math.floor(relY / rect.height * 5), 4);
                hoverBand.style.top = (zone * 20) + '%';
                hoverBand.style.display = 'block';
            });

            legendBar.addEventListener('mouseleave', () => {
                if (hoverBand) hoverBand.style.display = 'none';
            });

            legendBar.addEventListener('click', (e) => {
                if (!this.layerManager) return;
                const rect = legendBar.getBoundingClientRect();
                const relY = e.clientY - rect.top;
                const zone = Math.min(Math.floor(relY / rect.height * 5), 4);
                const threshold = thresholds[zone];
                // Toggle off if clicking the same active zone
                const newThreshold = threshold === this.layerManager.filterThreshold ? 0 : threshold;
                this.layerManager.setFilterThreshold(newThreshold);
                this._updateThresholdIndicator(newThreshold, bp);
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                if (!this.layerManager) return;
                this.layerManager.resetFilter();
                this._updateThresholdIndicator(0, breakpoints);
            });
        }

        // Match toggle container width after legend update
        this.matchToggleContainerWidth();
    }

    /**
     * Update the threshold line position and reset button visibility
     */
    _updateThresholdIndicator(threshold, breakpoints) {
        const line = document.getElementById('legendThresholdLine');
        const resetBtn = document.getElementById('legendResetBtn');
        if (!line) return;

        if (threshold > 0) {
            const thresholds = [breakpoints[3], breakpoints[2], breakpoints[1], 0.001];
            const zoneIndex = thresholds.findIndex(t => t === threshold);
            if (zoneIndex !== -1) {
                // Position line at the bottom boundary of the clicked zone
                line.style.top = ((zoneIndex + 1) * 20) + '%';
                line.classList.add('active');
            }
            if (resetBtn) resetBtn.style.visibility = 'visible';
        } else {
            line.classList.remove('active');
            if (resetBtn) resetBtn.style.visibility = 'hidden';
        }
    }

    /**
     * Match toggle container width to legend width
     */
    matchToggleContainerWidth() {
        const legend = document.getElementById('mapLegend');
        const filingModeContainer = document.getElementById('filingModeContainer');

        if (legend && filingModeContainer) {
            // Wait a brief moment for layout to complete
            setTimeout(() => {
                const legendWidth = legend.offsetWidth;
                filingModeContainer.style.width = legendWidth + 'px';
            }, 50);
        }
    }

    /**
     * Update slider label with human-readable month
     */
    updateSliderLabel(sliderIndex) {
        const sliderLabel = document.getElementById('sliderLabel');
        if (sliderLabel) {
            const monthUtils = this.dataLoader.getMonthUtils();
            const humanReadable = monthUtils.sliderIndexToHumanReadable(sliderIndex);
            sliderLabel.textContent = humanReadable || 'Unknown';
        }
    }

    /**
     * Set up slider event listener
     */
    setupSliderListener(onSliderChange) {
        // Store the callback so it can be reused when replacing the slider
        this._onSliderChange = onSliderChange;

        const slider = document.getElementById('monthSlider');

        if (!slider) {
            // Retry after a short delay to ensure Web Awesome components are loaded
            setTimeout(() => this.setupSliderListener(onSliderChange), 100);
            return;
        }

        let debounceTimeout = null;

        const handleSliderChange = async (sliderValue, eventName) => {
            // Update slider label immediately for visual feedback
            this.updateSliderLabel(sliderValue);
            
            // Debounce the data loading to prevent too many API calls during drag
            if (debounceTimeout) {
                clearTimeout(debounceTimeout);
            }

            debounceTimeout = setTimeout(async () => {
                if (onSliderChange) {
                    try {
                        await onSliderChange(sliderValue);

                        // Ensure focus returns to map after data loading completes
                        const slider = document.getElementById('monthSlider');
                        const mapCanvas = document.querySelector('#map canvas');
                        if (slider && mapCanvas) {
                            slider.blur();
                            mapCanvas.focus();
                        }
                    } catch (error) {
                        this.showError('Failed to load data for selected month');
                    }
                }
            }, 100);
        };

        // Try multiple events and log which ones actually fire
        const eventTypes = ['input', 'change', 'wa-input', 'wa-change'];

        eventTypes.forEach(eventType => {
            slider.addEventListener(eventType, (event) => {
                const sliderValue = parseInt(event.target.value);
                handleSliderChange(sliderValue, eventType);
            });
        });

        // Also try mouseup and touchend for when user finishes dragging
        slider.addEventListener('mouseup', (event) => {
            const sliderValue = parseInt(event.target.value);
            handleSliderChange(sliderValue, 'mouseup');
            
            // Fix focus issue: blur the slider to allow map to receive mouse events immediately
            setTimeout(() => {
                slider.blur();
                // Ensure map canvas can receive focus
                const mapCanvas = document.querySelector('#map canvas');
                if (mapCanvas) {
                    mapCanvas.focus();
                }
            }, 10); // Small delay to ensure slider events complete
        });


        // Also handle touchend for mobile devices
        slider.addEventListener('touchend', (event) => {
            const sliderValue = parseInt(event.target.value);
            handleSliderChange(sliderValue, 'touchend');
            
            // Fix focus issue for mobile: blur the slider to allow map to receive touch events immediately
            setTimeout(() => {
                slider.blur();
                const mapCanvas = document.querySelector('#map canvas');
                if (mapCanvas) {
                    mapCanvas.focus();
                }
            }, 10);
        });
    }

    /**
     * Convert slider to range mode by replacing the element entirely.
     * Default range: Jan 2025 to Oct 2025.
     */
    convertSliderToRangeMode() {
        const oldSlider = document.getElementById('monthSlider');
        if (!oldSlider) return;

        const monthUtils = this.dataLoader.getMonthUtils();
        const totalMonths = monthUtils.getTotalMonths();

        // Calculate default range indices for Jan 2025 and Oct 2025
        const defaultStartIndex = monthUtils.dbMonthToSliderIndex('2025-01');
        const defaultEndIndex = monthUtils.dbMonthToSliderIndex('2025-10');
        const startIdx = defaultStartIndex !== -1 ? defaultStartIndex : 0;
        const endIdx = defaultEndIndex !== -1 ? defaultEndIndex : totalMonths - 1;

        // Create a new range slider element
        const newSlider = document.createElement('wa-slider');
        newSlider.id = 'monthSlider';
        newSlider.setAttribute('label', 'Drag handles to select month range:');
        newSlider.setAttribute('min', '0');
        newSlider.setAttribute('max', String(totalMonths - 1));
        newSlider.setAttribute('step', '1');
        newSlider.setAttribute('range', '');
        newSlider.setAttribute('min-value', String(startIdx));
        newSlider.setAttribute('max-value', String(endIdx));
        newSlider.setAttribute('with-tooltip', '');

        // Replace old slider in the DOM
        oldSlider.parentNode.replaceChild(newSlider, oldSlider);

        // Set up the value formatter for tooltips once the component is defined
        customElements.whenDefined('wa-slider').then(() => {
            newSlider.valueFormatter = (value) => {
                return monthUtils.sliderIndexToHumanReadable(value) || '';
            };
        });

        // Re-attach event listeners for range mode
        this._attachRangeSliderListeners(newSlider);

        // Update the label
        this.updateSliderLabelForRange(startIdx, endIdx);

        // Store start/end for return value
        this._rangeStartIndex = startIdx;
        this._rangeEndIndex = endIdx;
    }

    /**
     * Attach event listeners to the range slider
     */
    _attachRangeSliderListeners(slider) {
        let debounceTimeout = null;

        const handleRangeChange = () => {
            const startIndex = parseInt(slider.minValue) || 0;
            const endIndex = parseInt(slider.maxValue) || 0;

            // Update label immediately
            this.updateSliderLabelForRange(startIndex, endIndex);

            // Debounce data loading
            if (debounceTimeout) clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => {
                if (this._onSliderChange) {
                    this._onSliderChange(startIndex);
                }
            }, 150);
        };

        ['input', 'wa-input', 'change', 'wa-change'].forEach(eventType => {
            slider.addEventListener(eventType, handleRangeChange);
        });
    }

    /**
     * Convert slider back to single month mode by replacing the element.
     */
    convertSliderToSingleMode() {
        const oldSlider = document.getElementById('monthSlider');
        if (!oldSlider) return;

        const monthUtils = this.dataLoader.getMonthUtils();
        const currentIndex = monthUtils.getCurrentMonthIndex();

        // Create a new single-value slider
        const newSlider = document.createElement('wa-slider');
        newSlider.id = 'monthSlider';
        newSlider.setAttribute('label', 'Click and drag to change the month:');
        newSlider.setAttribute('min', '0');
        newSlider.setAttribute('max', String(monthUtils.getTotalMonths() - 1));
        newSlider.setAttribute('value', String(currentIndex));
        newSlider.setAttribute('step', '1');

        // Replace in DOM
        oldSlider.parentNode.replaceChild(newSlider, oldSlider);

        // Set the value as a property after the component is defined
        customElements.whenDefined('wa-slider').then(() => {
            newSlider.value = currentIndex;
        });

        // Re-attach single-mode event listeners
        this.setupSliderListener(this._onSliderChange);

        // Update label
        this.updateSliderLabel(currentIndex);
    }

    /**
     * Update slider label for range mode (shows "Jan 2020 - May 2025" format)
     */
    updateSliderLabelForRange(startIndex, endIndex) {
        const sliderLabel = document.getElementById('sliderLabel');
        if (sliderLabel) {
            const monthUtils = this.dataLoader.getMonthUtils();
            const startReadable = monthUtils.sliderIndexToHumanReadable(startIndex);
            const endReadable = monthUtils.sliderIndexToHumanReadable(endIndex);
            sliderLabel.textContent = `${startReadable} - ${endReadable}`;
        }
    }

    /**
     * Update month display header for range mode
     */
    updateMonthDisplayForRange(startMonth, endMonth, total) {
        const monthText = document.getElementById('monthText');
        const totalText = document.getElementById('totalText');

        if (monthText && totalText) {
            const startFormatted = this.dataLoader.formatMonthDisplay(startMonth);
            const endFormatted = this.dataLoader.formatMonthDisplay(endMonth);

            monthText.style.display = 'none';
            totalText.innerHTML = `Regional eviction filings<br/> from ${startFormatted} to ${endFormatted}: ${total.toLocaleString()}`;
        }
    }

    /**
     * Set up filing mode radio group event listener
     */
    setupToggleListener(onToggleChange) {
        const selector = document.getElementById('filingModeSelector');

        if (!selector) {
            setTimeout(() => this.setupToggleListener(onToggleChange), 100);
            return;
        }

        let isHandling = false;
        this._filingModeLastValue = selector.checked ? 'rate' : 'count';

        const handleChange = async (event) => {
            if (isHandling) return;

            const newValue = event.target.checked ? 'rate' : 'count';
            if (newValue === this._filingModeLastValue) return;

            isHandling = true;
            this._filingModeLastValue = newValue;

            if (onToggleChange) {
                try {
                    await onToggleChange(newValue);
                } catch (error) {
                    this.showError('Failed to update display mode');
                }
            }

            setTimeout(() => {
                isHandling = false;
            }, 500);
        };

        selector.addEventListener('wa-change', handleChange);
        selector.addEventListener('change', handleChange);
    }

    /**
     * Set the filing mode selector value programmatically
     */
    setFilingModeValue(value) {
        const selector = document.getElementById('filingModeSelector');
        if (selector) {
            selector.checked = (value === 'rate');
            // Sync the tracked value so the change listener stays in sync
            this._filingModeLastValue = value;
        }
    }

    /**
     * Enable or disable the filing mode selector
     */
    setFilingModeEnabled(enabled) {
        const selector = document.getElementById('filingModeSelector');
        if (selector) {
            selector.disabled = !enabled;
        }
    }
}
