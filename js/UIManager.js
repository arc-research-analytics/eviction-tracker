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
                overlay.classList.remove('hidden');
            }
        }, 500);
    }

    /**
     * Hide loading overlay
     */
    hideLoading() {
        this.isLoading = false;
        
        // Clear timeout if it hasn't fired yet
        if (this.loadingTimeout) {
            clearTimeout(this.loadingTimeout);
            this.loadingTimeout = null;
        }
        
        // Hide overlay if it's currently showing
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.add('hidden');
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
            
            monthText.textContent = formattedMonth;
            totalText.textContent = `${totalEvictions.toLocaleString()} evictions`;
        }
    }

    /**
     * Add legend to the map
     */
    addLegend() {
        const legend = document.createElement('div');
        legend.className = 'legend';
        legend.innerHTML = `
            <h4>Eviction Filings</h4>
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
        `;
        
        document.body.appendChild(legend);
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
        });
        
        console.log('All event listeners attached. Try moving the slider and watch the console.');
    }
}
