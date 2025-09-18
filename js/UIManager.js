/**
 * UIManager - Handles UI operations, loading screens, and display updates
 */
class UIManager {
    constructor(dataLoader) {
        this.dataLoader = dataLoader;
        this.loadingTimeout = null;
        this.isLoading = false;
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
    updateMonthDisplay() {
        const monthText = document.getElementById('monthText');
        const totalText = document.getElementById('totalText');
        
        if (monthText && totalText) {
            const formattedMonth = this.dataLoader.formatMonthDisplay(this.dataLoader.getCurrentMonth());
            const totalEvictions = this.dataLoader.calculateTotalEvictions();
            
            // Hide the month text element since we're combining the display
            monthText.style.display = 'none';
            
            // Show combined format in the total text element
            totalText.innerHTML = `Countywide evictions<br/> in ${formattedMonth}: <span style="color: #e31a1c;">${totalEvictions.toLocaleString()}</span>`;
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
     * Update legend content based on display mode
     */
    updateLegend(legendElement = null) {
        const legend = legendElement || document.getElementById('mapLegend');
        if (!legend) return;

        const displayMode = this.dataLoader.getDisplayMode();

        if (displayMode === 'rate') {
            legend.innerHTML = `
                <h4 style="text-align: center;">Eviction Filing Rate<br/>by Census Tract</h4>
                <div class="legend-item">
                    <div class="legend-color" style="background-color: #ffffcc;"></div>
                    <span>0%</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background-color: #fed976;"></div>
                    <span>0-2%</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background-color: #fd8d3c;"></div>
                    <span>2-5%</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background-color: #e31a1c;"></div>
                    <span>5-8%</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background-color: #800026;"></div>
                    <span>8%+</span>
                </div>
                <div class="legend-explanation">
                    "Rate" defined as the total filings
                    divided by the number of renter-
                    occupied housing units in 2023.
                    
                </div>
            `;
        } else {
            legend.innerHTML = `
                <h4 style="text-align: center;">Eviction Filings<br/>by Census Tract</h4>
                <div class="legend-item">
                    <div class="legend-color" style="background-color: #ffffcc;"></div>
                    <span>0</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background-color: #fed976;"></div>
                    <span>1-10</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background-color: #fd8d3c;"></div>
                    <span>11-25</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background-color: #e31a1c;"></div>
                    <span>26-60</span>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background-color: #800026;"></div>
                    <span>60+</span>
                </div>
                <div class="legend-explanation">
                    Raw eviction count for the given<br/>
                    month in the census tract.
                </div>
            `;
        }

        // Match toggle container width after legend update
        this.matchToggleContainerWidth();
    }

    /**
     * Match toggle container width to legend width
     */
    matchToggleContainerWidth() {
        const legend = document.getElementById('mapLegend');
        const toggleContainer = document.getElementById('toggleContainer');

        if (legend && toggleContainer) {
            // Wait a brief moment for layout to complete
            setTimeout(() => {
                const legendWidth = legend.offsetWidth;
                toggleContainer.style.width = legendWidth + 'px';
                console.log('Toggle container width matched to legend:', legendWidth + 'px');
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
        } else {
            console.error('Slider label element not found');
        }
    }

    /**
     * Set up slider event listener
     */
    setupSliderListener(onSliderChange) {
        const slider = document.getElementById('monthSlider');
        
        if (!slider) {
            // Retry after a short delay to ensure Web Awesome components are loaded
            setTimeout(() => this.setupSliderListener(onSliderChange), 100);
            return;
        }


        // Debug: Let's see what events actually fire
        console.log('Slider element:', slider);
        console.log('Slider tagName:', slider.tagName);
        console.log('Setting up event listeners...');
        
        let debounceTimeout = null;
        
        const handleSliderChange = async (sliderValue, eventName) => {
            console.log(`Slider event '${eventName}' fired with value:`, sliderValue);
            
            // Update slider label immediately for visual feedback
            this.updateSliderLabel(sliderValue);
            
            // Debounce the data loading to prevent too many API calls during drag
            if (debounceTimeout) {
                clearTimeout(debounceTimeout);
            }
            
            debounceTimeout = setTimeout(async () => {
                console.log('Executing data load for value:', sliderValue);
                if (onSliderChange) {
                    try {
                        await onSliderChange(sliderValue);
                        console.log('Data load completed for:', sliderValue);
                        
                        // Ensure focus returns to map after data loading completes
                        const slider = document.getElementById('monthSlider');
                        const mapCanvas = document.querySelector('#map canvas');
                        if (slider && mapCanvas) {
                            slider.blur();
                            mapCanvas.focus();
                        }
                    } catch (error) {
                        console.error('Error handling slider change:', error);
                        this.showError('Failed to load data for selected month');
                    }
                }
            }, 100);
        };
        
        
        // Try multiple events and log which ones actually fire
        const eventTypes = ['input', 'change', 'wa-input', 'wa-change'];
        
        eventTypes.forEach(eventType => {
            slider.addEventListener(eventType, (event) => {
                console.log(`Event '${eventType}' detected on slider with value:`, event.target.value);
                const sliderValue = parseInt(event.target.value);
                handleSliderChange(sliderValue, eventType);
            });
        });
        
        // Also try mouseup and touchend for when user finishes dragging
        slider.addEventListener('mouseup', (event) => {
            console.log('Mouse up on slider with value:', event.target.value);
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
            console.log('Touch end on slider with value:', event.target.value);
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
        
        console.log('All event listeners attached. Try moving the slider and watch the console.');
    }

    /**
     * Set up toggle switch event listener
     */
    setupToggleListener(onToggleChange) {
        const toggle = document.getElementById('showRateSwitch');

        if (!toggle) {
            // Retry after a short delay to ensure Web Awesome components are loaded
            setTimeout(() => this.setupToggleListener(onToggleChange), 100);
            return;
        }

        console.log('Setting up toggle event listener...', toggle);
        console.log('Toggle initial state:', toggle.checked);

        // Try multiple event types to find which one works for Web Awesome switch
        const eventTypes = ['wa-change', 'change', 'input', 'click'];

        // Debounce mechanism to prevent multiple rapid calls
        let isHandling = false;
        let lastValue = toggle.checked;

        const handleToggleChange = async (event, eventType) => {
            // Prevent duplicate/rapid fire events
            if (isHandling) {
                console.log(`Ignoring duplicate ${eventType} event (already handling)`);
                return;
            }

            // Check if value actually changed
            const currentValue = event.target.checked;
            if (currentValue === lastValue) {
                console.log(`Ignoring ${eventType} event (no value change)`);
                return;
            }

            isHandling = true;
            lastValue = currentValue;
            console.log(`Toggle event '${eventType}' fired:`, {
                checked: event.target.checked,
                value: event.target.value,
                target: event.target
            });

            const showAsRate = event.target.checked;
            const newDisplayMode = showAsRate ? 'rate' : 'count';

            console.log('New display mode:', newDisplayMode);

            if (onToggleChange) {
                try {
                    await onToggleChange(newDisplayMode);
                    console.log('Toggle change completed successfully');
                } catch (error) {
                    console.error('Error handling toggle change:', error);
                    this.showError('Failed to update display mode');
                }
            }

            // Reset handling flag after a short delay
            setTimeout(() => {
                isHandling = false;
            }, 500);
        };

        // Add listeners for all potential events
        eventTypes.forEach(eventType => {
            toggle.addEventListener(eventType, (event) => {
                console.log(`Event '${eventType}' detected on toggle`);
                handleToggleChange(event, eventType);
            });
        });

        // Also try with shadow DOM events
        if (toggle.shadowRoot) {
            console.log('Toggle has shadow root, adding shadow DOM listeners');
            const shadowToggle = toggle.shadowRoot.querySelector('input[type="checkbox"]');
            if (shadowToggle) {
                shadowToggle.addEventListener('change', (event) => {
                    console.log('Shadow DOM change event detected');
                    // Manually update the main element
                    toggle.checked = event.target.checked;
                    handleToggleChange({ target: toggle }, 'shadow-change');
                });
            }
        }

        console.log('Toggle event listeners attached for events:', eventTypes);

        // Backup method: Use MutationObserver to watch for attribute changes
        if (window.MutationObserver) {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' &&
                        (mutation.attributeName === 'checked' || mutation.attributeName === 'aria-checked')) {
                        console.log('MutationObserver detected checked attribute change:', {
                            attributeName: mutation.attributeName,
                            oldValue: mutation.oldValue,
                            newValue: toggle.checked || toggle.getAttribute('checked')
                        });

                        const isChecked = toggle.checked || toggle.hasAttribute('checked');

                        // Use same debouncing logic
                        if (isChecked === lastValue) {
                            console.log('MutationObserver ignoring - no value change');
                            return;
                        }

                        console.log('MutationObserver triggering mode change:', isChecked ? 'rate' : 'count');
                        handleToggleChange({ target: { checked: isChecked } }, 'mutation-observer');
                    }
                });
            });

            observer.observe(toggle, {
                attributes: true,
                attributeOldValue: true,
                attributeFilter: ['checked', 'aria-checked']
            });

            console.log('MutationObserver set up for toggle changes');
        }
    }
}
