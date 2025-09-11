/**
 * EvictionApp - Main application orchestrator that coordinates all modules
 */
class EvictionApp {
    constructor() {
        this.supabase = null;
        this.dataLoader = null;
        this.mapManager = null;
        this.uiManager = null;
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
            this.mapManager = new MapManager(CONFIG, this.dataLoader);

            // Start loading process
            this.uiManager.showLoading();

            // Initialize map
            const map = this.mapManager.initializeMap();
            
            // Load data when map is ready
            map.on('load', async () => {
                await this.dataLoader.loadEvictionData();
                await this.mapManager.loadTractBoundaries();
                await this.mapManager.loadCountyOutline();
                
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
        
        // Get current month index
        const currentIndex = this.dataLoader.getMonthUtils().getCurrentMonthIndex();
        
        // Set initial slider value
        const slider = document.getElementById('monthSlider');
        if (slider) {
            slider.value = currentIndex;
        }
        
        // Initialize slider label with current month
        this.uiManager.updateSliderLabel(currentIndex);
        
        // Set up the slider event listener with callback
        this.uiManager.setupSliderListener(async (sliderIndex) => {
            
            try {
                // Show loading for longer operations (but not for immediate updates)
                const isCurrentMonth = sliderIndex === this.dataLoader.getMonthUtils().getCurrentMonthIndex();
                if (!isCurrentMonth) {
                    this.uiManager.showLoading();
                }
                
                
                // Change month and reload data
                await this.dataLoader.changeMonthBySliderIndex(sliderIndex);
                
                
                // Refresh map with new data
                await this.mapManager.refreshTractBoundaries();
                
                // Update month display
                this.uiManager.updateMonthDisplay();
                
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