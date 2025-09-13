/**
 * EvictionApp - Main application orchestrator that coordinates all modules
 */
class EvictionApp {
    constructor() {
        this.supabase = null;
        this.dataLoader = null;
        this.mapManager = null;
        this.uiManager = null;
        this.popupManager = null;
        this.initializeApp();
    }

    /**
     * Initialize the application by setting up all modules and dependencies
     */
    async initializeApp() {
        try {
            // Initialize Supabase client
            this.supabase = supabase.createClient(
                CONFIG.supabase.url,
                CONFIG.supabase.anonKey
            );

            // Initialize modules with dependencies
            this.dataLoader = new DataLoader(this.supabase);
            this.uiManager = new UIManager(this.dataLoader);
            
            // Initialize MapManager first
            this.mapManager = new MapManager(CONFIG, this.dataLoader);
            
            // Initialize PopupManager with MapManager reference (but don't set it up yet)
            this.popupManager = new PopupManager(this.dataLoader, this.mapManager);

            // Respect initial slider value from DOM before first load
            const sliderEl = document.getElementById('monthSlider');
            let initialIndex = this.dataLoader.getMonthUtils().getCurrentMonthIndex();
            if (sliderEl && sliderEl.value !== undefined && sliderEl.value !== null && sliderEl.value !== '') {
                const parsed = parseInt(sliderEl.value, 10);
                if (!Number.isNaN(parsed)) {
                    initialIndex = parsed;
                }
            }
            const initialMonth = this.dataLoader.getMonthUtils().sliderIndexToDbMonth(initialIndex);
            if (initialMonth) {
                this.dataLoader.setCurrentMonth(initialMonth);
            }
            // Update the slider label early so the UI matches the chosen start month
            this.uiManager.updateSliderLabel(initialIndex);

            // Start loading process (show immediately for initial load)
            this.uiManager.showLoading(true);

            // Initialize map
            const map = this.mapManager.initializeMap();
            
            // Load data when map is ready
            map.on('load', async () => {
                await this.dataLoader.loadEvictionData();
                await this.mapManager.loadTractBoundaries();
                await this.mapManager.loadCountyMask();
                await this.mapManager.loadCountyOutline();
                
                // Now that tract layers are loaded, set up interactions
                this.mapManager.setPopupManager(this.popupManager);
                
                // Update UI components
                this.uiManager.updateMonthDisplay();
                this.uiManager.addLegend();
                
                // Set up slider functionality
                this.setupSliderFunctionality();
                
                // Hide loading screen
                this.uiManager.hideLoading();
            });

        } catch (error) {
            console.error('Error initializing app:', error);
            this.uiManager.hideLoading();
            this.uiManager.showError('Failed to initialize application');
        }
    }

    /**
     * Set up slider functionality and event handling
     */
    setupSliderFunctionality() {
        // No need to re-initialize - respect what was already set in initializeApp()
        const slider = document.getElementById('monthSlider');
        
        // Use current data loader month (which was set from HTML value during initialization)
        const currentDbMonth = this.dataLoader.getCurrentMonth();
        const currentIndex = this.dataLoader.getMonthUtils().dbMonthToSliderIndex(currentDbMonth);
        
        // Ensure the slider control matches the current state
        if (slider && currentIndex !== -1) {
            slider.value = currentIndex;
        }

        // Update slider label to match current month
        this.uiManager.updateSliderLabel(currentIndex);
        
        // Set up the slider event listener with callback
        this.uiManager.setupSliderListener(async (sliderIndex) => {
            
            try {
                // Show loading for longer operations (immediate for user interactions)
                const isCurrentMonth = sliderIndex === this.dataLoader.getMonthUtils().getCurrentMonthIndex();
                if (!isCurrentMonth) {
                    this.uiManager.showLoading(true);
                }
                
                
                // Change month and reload data
                await this.dataLoader.changeMonthBySliderIndex(sliderIndex);
                
                
                // Refresh map with new data
                await this.mapManager.refreshTractBoundaries();
                
                // Update month display
                this.uiManager.updateMonthDisplay();
                
                // Update any open popup's vertical line
                if (this.popupManager) {
                    this.popupManager.updateVerticalLine();
                }
                
                // Hide loading
                this.uiManager.hideLoading();
                
                
            } catch (error) {
                console.error('Error handling slider change:', error);
                this.uiManager.hideLoading();
                this.uiManager.showError('Failed to load data for selected month');
            }
        });
        
        // Add debugging helper to global scope
        window.testSlider = (index) => {
            this.uiManager.updateSliderLabel(index);
            return this.dataLoader.getMonthUtils().sliderIndexToHumanReadable(index);
        };
        
    }

    /**
     * Get reference to data loader
     */
    getDataLoader() {
        return this.dataLoader;
    }

    /**
     * Get reference to map manager
     */
    getMapManager() {
        return this.mapManager;
    }

    /**
     * Get reference to UI manager
     */
    getUIManager() {
        return this.uiManager;
    }

    /**
     * Get reference to popup manager
     */
    getPopupManager() {
        return this.popupManager;
    }
}

// Initialize when DOM is loaded or immediately if already loaded
function initializeApp() {
    new EvictionApp();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    // DOM is already loaded, initialize immediately
    initializeApp();
}