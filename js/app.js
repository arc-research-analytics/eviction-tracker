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
        this.tooltipManager = null;
        this.mapTooltipHandler = null;
        this.countyTrends = null;
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
            
            // Initialize available months from database first
            await this.dataLoader.initializeAvailableMonths();
            
            this.uiManager = new UIManager(this.dataLoader);
            this.countyTrends = new CountyTrends(this.dataLoader, this.supabase);
            
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
                try {
                    // Make sure we have months available before loading data
                    if (this.dataLoader.getMonthUtils().getAllMonths().length === 0) {
                        console.warn('App: No months available, retrying initialization...');
                        await this.dataLoader.initializeAvailableMonths();
                    }

                    await this.dataLoader.loadEvictionData();
                    await this.mapManager.loadTractBoundaries();
                    await this.mapManager.loadCountyMask();
                    await this.mapManager.loadCountyOutline();
                } catch (error) {
                    console.error('App: Error loading map data:', error);
                    this.uiManager.hideLoading();
                    this.uiManager.showError('Failed to load map data');
                    return;
                }
                
                // Now that tract layers are loaded, set up interactions
                this.mapManager.setPopupManager(this.popupManager);
                
                // Initialize map tooltip handler
                this.initializeMapTooltipHandler();
                
                // Update UI components
                this.uiManager.updateMonthDisplay();
                this.uiManager.addLegend();
                
                // Set up slider functionality
                this.setupSliderFunctionality();

                // Set up toggle functionality
                this.setupToggleFunctionality();
                
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
        const slider = document.getElementById('monthSlider');
        const monthUtils = this.dataLoader.getMonthUtils();

        if (slider) {
            // Dynamically set slider range based on configured date range
            const totalMonths = monthUtils.getTotalMonths();
            const currentIndex = monthUtils.getCurrentMonthIndex();

            // Update slider attributes
            slider.setAttribute('max', totalMonths - 1);  // 0-based indexing
            slider.setAttribute('value', currentIndex);
            slider.value = currentIndex;

            console.log(`Slider configured: max=${totalMonths - 1}, current=${currentIndex}`);
        }

        // Use current data loader month (which was set from HTML value during initialization)
        const currentDbMonth = this.dataLoader.getCurrentMonth();
        const currentIndex = this.dataLoader.getMonthUtils().dbMonthToSliderIndex(currentDbMonth);

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
                
                // Update county trends vertical line if drawer is open
                if (this.countyTrends) {
                    this.countyTrends.updateVerticalLine();
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
        
        // Add data loading comparison helper to global scope 
        window.debugDataLoading = async (month) => {
            console.log(`Testing data loading methods for month: ${month}`);
            return await this.dataLoader.debugCompareLoadingMethods(month);
        };
        
        // Add helper to check what data is currently loaded on the map
        window.checkCurrentMapData = () => {
            const currentMonth = this.dataLoader.getCurrentMonth();
            const evictionData = this.dataLoader.getEvictionData();
            const total = this.dataLoader.calculateTotalEvictions();
            console.log(`Current map month: ${currentMonth}`);
            console.log(`Total evictions displayed: ${total}`);
            console.log(`Number of tracts with data: ${Object.keys(evictionData).length}`);
            return { month: currentMonth, total, tractCount: Object.keys(evictionData).length };
        };

        // Simple RLS test function
        window.testRLS = async () => {
            console.log('=== TESTING ROW LEVEL SECURITY ===');
            
            // Direct table access test
            const monthTest = await this.supabase.from('month-summary').select('*').limit(1);
            const tractTest = await this.supabase.from('tract-summary').select('*').limit(1);
            
            console.log('Direct month-summary test:', monthTest);
            console.log('Direct tract-summary test:', tractTest);
            
            if (monthTest.error) {
                console.error('❌ month-summary blocked:', monthTest.error.message);
            } else {
                console.log('✅ month-summary accessible:', monthTest.data?.length, 'rows');
            }
            
            if (tractTest.error) {
                console.error('❌ tract-summary blocked:', tractTest.error.message);
            } else {
                console.log('✅ tract-summary accessible:', tractTest.data?.length, 'rows');
            }
        };

        // Add database test function for troubleshooting
        window.testDatabase = async () => {
            console.log('=== DATABASE CONNECTION TEST ===');
            
            try {
                // Test 1: Direct queries to both tables
                console.log('Test 1: Querying month-summary...');
                const monthTest = await this.supabase
                    .from('month-summary')
                    .select('filemonth, totalfilings')
                    .limit(5);
                
                console.log('month-summary result:', monthTest);
                
                console.log('Test 2: Querying tract-summary...');
                const tractTest = await this.supabase
                    .from('tract-summary')
                    .select('tractid, filemonth, totalfilings')
                    .limit(5);
                    
                console.log('tract-summary result:', tractTest);
                
                // Test 3: Check what months are available
                console.log('Test 3: Available months in each table...');
                const [monthMonths, tractMonths] = await Promise.all([
                    this.supabase.from('month-summary').select('filemonth').limit(100),
                    this.supabase.from('tract-summary').select('filemonth').limit(100)
                ]);
                
                const uniqueMonthMonths = [...new Set(monthMonths.data?.map(d => d.filemonth) || [])];
                const uniqueTractMonths = [...new Set(tractMonths.data?.map(d => d.filemonth) || [])];
                
                console.log('Available months in month-summary:', uniqueMonthMonths.slice(0, 10));
                console.log('Available months in tract-summary:', uniqueTractMonths.slice(0, 10));
                
                // Test 4: Current app month vs available months
                const currentMonth = this.dataLoader.getCurrentMonth();
                const supabaseFormat = this.dataLoader.getMonthUtils().convertToSupabaseFormat(currentMonth);
                
                console.log('App current month (internal):', currentMonth);
                console.log('App current month (Supabase format):', supabaseFormat);
                console.log('Is current month in month-summary?', uniqueMonthMonths.includes(supabaseFormat));
                console.log('Is current month in tract-summary?', uniqueTractMonths.includes(supabaseFormat));
                
                return {
                    monthSummaryRows: monthTest.data?.length || 0,
                    tractSummaryRows: tractTest.data?.length || 0,
                    monthSummaryError: monthTest.error,
                    tractSummaryError: tractTest.error,
                    availableMonths: { monthSummary: uniqueMonthMonths, tractSummary: uniqueTractMonths },
                    currentMonth: { internal: currentMonth, supabase: supabaseFormat }
                };
                
            } catch (error) {
                console.error('Database test failed:', error);
                return { error: error.message };
            }
        };

        // Add debugging helper for toggle
        window.testToggle = (mode) => {
            console.log('Manually testing toggle with mode:', mode);
            if (mode === 'rate' || mode === 'count') {
                this.dataLoader.setDisplayMode(mode);
                console.log('DataLoader display mode set to:', this.dataLoader.getDisplayMode());

                // Manually update UI components
                this.uiManager.updateLegend();
                if (this.mapManager && this.mapManager.updateColorScale) {
                    this.mapManager.updateColorScale();
                }
                console.log('UI updated manually');
                return `Mode changed to: ${mode}`;
            } else {
                return 'Invalid mode. Use "rate" or "count"';
            }
        };

        // Helper to check toggle state
        window.checkToggle = () => {
            const toggle = document.getElementById('showRateSwitch');
            const currentMode = this.dataLoader.getDisplayMode();
            console.log('Toggle element:', toggle);
            console.log('Toggle checked:', toggle?.checked);
            console.log('Toggle attributes:', {
                checked: toggle?.getAttribute('checked'),
                ariaChecked: toggle?.getAttribute('aria-checked')
            });
            console.log('Current display mode:', currentMode);
            return {
                element: toggle,
                checked: toggle?.checked,
                displayMode: currentMode
            };
        };

    }

    /**
     * Set up toggle functionality for switching between rates and counts
     */
    setupToggleFunctionality() {
        console.log('App: Setting up toggle functionality...');

        // Set up the toggle event listener with callback
        this.uiManager.setupToggleListener(async (newDisplayMode) => {
            try {
                console.log('App: Handling display mode change to:', newDisplayMode);

                // Show loading for the mode change
                this.uiManager.showLoading();

                // Update data loader display mode
                this.dataLoader.setDisplayMode(newDisplayMode);

                // Refresh map layers with new display values
                await this.mapManager.refreshTractBoundaries();

                // Update map color scale
                this.mapManager.updateColorScale();

                // Update legend
                this.uiManager.updateLegend();

                // Update any open popup chart for new display mode
                if (this.popupManager && this.popupManager.currentPopup && this.popupManager.currentTractId) {
                    await this.popupManager.updateChartForDisplayMode(this.popupManager.currentTractId);
                }

                // Hide loading
                this.uiManager.hideLoading();

                console.log('App: Display mode change completed successfully');

            } catch (error) {
                console.error('App: Error handling display mode change:', error);
                this.uiManager.hideLoading();
                this.uiManager.showError('Failed to update display mode');
            }
        });
    }


    /**
     * Initialize map tooltip handler after map layers are loaded
     */
    initializeMapTooltipHandler() {
        if (!this.mapManager || !this.mapManager.getMap()) {
            console.error('MapManager or map not available for tooltip handler initialization');
            return;
        }

        // Get the tooltip manager from MapManager
        const tooltipManager = this.mapManager.getTooltipManager();
        const map = this.mapManager.getMap();
        const censusLayerId = 'tract-fills';

        if (!tooltipManager) {
            console.error('TooltipManager not available from MapManager');
            return;
        }

        // Initialize the map tooltip handler with dataLoader for display mode awareness
        this.mapTooltipHandler = new MapTooltipHandler(map, tooltipManager, censusLayerId, this.dataLoader);
        
        console.log('MapTooltipHandler initialized successfully');
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

    /**
     * Get reference to county trends manager
     */
    getCountyTrends() {
        return this.countyTrends;
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