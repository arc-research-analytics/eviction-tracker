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
                        await this.dataLoader.initializeAvailableMonths();
                    }

                    await this.dataLoader.loadEvictionData();
                    await this.mapManager.loadTractBoundaries();
                    await this.mapManager.loadCountyMask();
                    await this.mapManager.loadCountyOutline();
                    await this.mapManager.loadCountyLabels();
                } catch (error) {
                    this.uiManager.hideLoading();
                    this.uiManager.showError('Failed to load map data');
                    return;
                }

                // Now that tract layers are loaded, set up interactions
                this.mapManager.setPopupManager(this.popupManager);

                // Initialize map tooltip handler
                this.initializeMapTooltipHandler();

                // Connect UIManager with LayerManager for dynamic legend updates
                this.uiManager.setLayerManager(this.mapManager.getLayerManager());

                // Update UI components
                await this.uiManager.updateMonthDisplay();
                this.uiManager.addLegend();
                
                // Set up slider functionality
                this.setupSliderFunctionality();

                // Set up toggle functionality
                this.setupToggleFunctionality();

                // Set up month mode switch functionality
                this.setupMonthModeSwitchFunctionality();

                // Set up geography selector functionality
                this.setupGeographySelectorFunctionality();

                // Set up download button functionality
                this.setupDownloadFunctionality();

                // Hide loading screen
                this.uiManager.hideLoading();
            });

        } catch (error) {
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
        }

        // Use current data loader month (which was set from HTML value during initialization)
        const currentDbMonth = this.dataLoader.getCurrentMonth();
        const currentIndex = this.dataLoader.getMonthUtils().dbMonthToSliderIndex(currentDbMonth);

        // Update slider label to match current month
        this.uiManager.updateSliderLabel(currentIndex);
        
        // Set up the slider event listener with callback
        this.uiManager.setupSliderListener(async (sliderIndex) => {

            try {
                const monthUtils = this.dataLoader.getMonthUtils();

                if (this.dataLoader.isInRangeMode()) {
                    // Range mode: read both handle values
                    const slider = document.getElementById('monthSlider');
                    const startIndex = parseInt(slider.minValue) || 0;
                    const endIndex = parseInt(slider.maxValue) || monthUtils.getTotalMonths() - 1;

                    this.uiManager.showLoading(true);

                    const startMonth = monthUtils.sliderIndexToDbMonth(startIndex);
                    const endMonth = monthUtils.sliderIndexToDbMonth(endIndex);

                    await this.dataLoader.loadEvictionDataForRange(startMonth, endMonth);
                    await this.mapManager.refreshTractBoundaries();

                    this.uiManager.updateSliderLabelForRange(startIndex, endIndex);
                    const total = await this.dataLoader.calculateTotalEvictionsForRange();
                    this.uiManager.updateMonthDisplayForRange(startMonth, endMonth, total);

                    this.uiManager.hideLoading();
                } else {
                    // Single month mode (original behavior)
                    const isCurrentMonth = sliderIndex === monthUtils.getCurrentMonthIndex();
                    if (!isCurrentMonth) {
                        this.uiManager.showLoading(true);
                    }

                    await this.dataLoader.changeMonthBySliderIndex(sliderIndex);
                    await this.mapManager.refreshTractBoundaries();
                    await this.uiManager.updateMonthDisplay();

                    if (this.popupManager) {
                        this.popupManager.updateVerticalLine();
                    }

                    if (this.countyTrends) {
                        this.countyTrends.updateVerticalLine();
                    }

                    this.uiManager.hideLoading();
                }

            } catch (error) {
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
            return await this.dataLoader.debugCompareLoadingMethods(month);
        };
        
        // Add helper to check what data is currently loaded on the map
        window.checkCurrentMapData = () => {
            const currentMonth = this.dataLoader.getCurrentMonth();
            const evictionData = this.dataLoader.getEvictionData();
            const total = this.dataLoader.calculateTotalEvictions();
            return { month: currentMonth, total, tractCount: Object.keys(evictionData).length };
        };

        // Simple RLS test function
        window.testRLS = async () => {
            // Direct table access test
            const monthTest = await this.supabase.from('evictions-month').select('*').limit(1);
            const tractTest = await this.supabase.from('evictions-tract').select('*').limit(1);

            return {
                monthTest,
                tractTest,
                monthAccessible: !monthTest.error,
                tractAccessible: !tractTest.error
            };
        };

        // Add database test function for troubleshooting
        window.testDatabase = async () => {
            try {
                // Test 1: Direct queries to both tables
                const monthTest = await this.supabase
                    .from('evictions-month')
                    .select('filemonth, totalfilings')
                    .limit(5);

                const tractTest = await this.supabase
                    .from('evictions-tract')
                    .select('tractid, filemonth, totalfilings')
                    .limit(5);

                // Test 3: Check what months are available
                const [monthMonths, tractMonths] = await Promise.all([
                    this.supabase.from('evictions-month').select('filemonth').limit(100),
                    this.supabase.from('evictions-tract').select('filemonth').limit(100)
                ]);

                const uniqueMonthMonths = [...new Set(monthMonths.data?.map(d => d.filemonth) || [])];
                const uniqueTractMonths = [...new Set(tractMonths.data?.map(d => d.filemonth) || [])];

                // Test 4: Current app month vs available months
                const currentMonth = this.dataLoader.getCurrentMonth();
                const supabaseFormat = this.dataLoader.getMonthUtils().convertToSupabaseFormat(currentMonth);

                return {
                    monthSummaryRows: monthTest.data?.length || 0,
                    tractSummaryRows: tractTest.data?.length || 0,
                    monthSummaryError: monthTest.error,
                    tractSummaryError: tractTest.error,
                    availableMonths: { monthSummary: uniqueMonthMonths, tractSummary: uniqueTractMonths },
                    currentMonth: { internal: currentMonth, supabase: supabaseFormat }
                };

            } catch (error) {
                return { error: error.message };
            }
        };

        // Add debugging helper for toggle
        window.testToggle = (mode) => {
            if (mode === 'rate' || mode === 'count') {
                this.dataLoader.setDisplayMode(mode);

                // Manually update UI components
                this.uiManager.updateLegend();
                if (this.mapManager && this.mapManager.updateColorScale) {
                    this.mapManager.updateColorScale();
                }
                return `Mode changed to: ${mode}`;
            } else {
                return 'Invalid mode. Use "rate" or "count"';
            }
        };

        // Helper to check toggle state
        window.checkToggle = () => {
            const selector = document.getElementById('filingModeSelector');
            const currentMode = this.dataLoader.getDisplayMode();
            return {
                element: selector,
                selectedValue: selector?.value,
                displayMode: currentMode
            };
        };

    }

    /**
     * Set up toggle functionality for switching between rates and counts
     */
    setupToggleFunctionality() {
        // Set up the toggle event listener with callback
        this.uiManager.setupToggleListener(async (newDisplayMode) => {
            try {
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

            } catch (error) {
                this.uiManager.hideLoading();
                this.uiManager.showError('Failed to update display mode');
            }
        });
    }


    /**
     * Set up month mode radio selector - when "Custom Month Range" is selected,
     * disable the filing mode selector and force count mode
     */
    setupMonthModeSwitchFunctionality() {
        const monthModeSelector = document.getElementById('monthModeSelector');
        const filingModeSelector = document.getElementById('filingModeSelector');

        if (!monthModeSelector || !filingModeSelector) {
            setTimeout(() => this.setupMonthModeSwitchFunctionality(), 100);
            return;
        }

        let lastMode = 'single';

        const handleChange = async (event) => {
            const newMode = event.target.value;
            if (newMode === lastMode) return;
            lastMode = newMode;

            if (newMode === 'range') {
                // Disable filing mode selector and force count mode
                this.uiManager.setFilingModeValue('count');
                this.uiManager.setFilingModeEnabled(false);

                // Enter range mode
                this.dataLoader.setRangeMode(true);
                this.dataLoader.setDisplayMode('count');

                // Convert slider to range mode (defaults to Jan 2025 - Oct 2025)
                this.uiManager.convertSliderToRangeMode();

                // Load initial range data matching the slider defaults
                this.uiManager.showLoading();
                const monthUtils = this.dataLoader.getMonthUtils();
                const defaultStartIdx = monthUtils.dbMonthToSliderIndex('2025-01');
                const defaultEndIdx = monthUtils.dbMonthToSliderIndex('2025-10');
                const startMonth = monthUtils.sliderIndexToDbMonth(defaultStartIdx !== -1 ? defaultStartIdx : 0);
                const endMonth = monthUtils.sliderIndexToDbMonth(defaultEndIdx !== -1 ? defaultEndIdx : monthUtils.getTotalMonths() - 1);

                await this.dataLoader.loadEvictionDataForRange(startMonth, endMonth);
                await this.mapManager.refreshTractBoundaries();
                this.mapManager.updateColorScale();
                this.uiManager.updateLegend();

                const total = await this.dataLoader.calculateTotalEvictionsForRange();
                this.uiManager.updateMonthDisplayForRange(startMonth, endMonth, total);

                this.uiManager.hideLoading();
            } else {
                // Exit range mode
                this.dataLoader.setRangeMode(false);

                // Convert slider back to single mode
                this.uiManager.convertSliderToSingleMode();

                // Re-enable filing mode selector and set to count
                this.uiManager.setFilingModeEnabled(true);
                this.uiManager.setFilingModeValue('count');

                // Reload single month data
                this.uiManager.showLoading();
                await this.dataLoader.loadEvictionData();
                await this.mapManager.refreshTractBoundaries();
                this.mapManager.updateColorScale();
                this.uiManager.updateLegend();
                await this.uiManager.updateMonthDisplay();
                this.uiManager.hideLoading();
            }
        };

        monthModeSelector.addEventListener('wa-change', handleChange);
        monthModeSelector.addEventListener('change', handleChange);
    }

    /**
     * Set up geography selector functionality for switching between geography levels
     */
    setupGeographySelectorFunctionality() {
        const geographySelector = document.getElementById('geographySelector');

        if (geographySelector) {
            const handleChange = async (event) => {
                try {
                    const newGeography = event.target.value;

                    // Show loading
                    this.uiManager.showLoading(true);

                    // Update geography in DataLoader
                    this.dataLoader.setGeographyType(newGeography);

                    // Reload eviction data respecting current slider mode
                    if (this.dataLoader.isInRangeMode()) {
                        const startMonth = this.dataLoader.getStartMonth();
                        const endMonth = this.dataLoader.getEndMonth();
                        await this.dataLoader.loadEvictionDataForRange(startMonth, endMonth);
                    } else {
                        await this.dataLoader.loadEvictionData();
                    }

                    // Switch geography type and reload map layers
                    await this.mapManager.switchGeography(newGeography);

                    // Update legend to reflect new geography
                    this.uiManager.updateLegend();

                    // Hide loading
                    this.uiManager.hideLoading();

                } catch (error) {
                    console.error('Error switching geography:', error);
                    this.uiManager.hideLoading();
                    this.uiManager.showError('Failed to switch geography level');
                }
            };

            geographySelector.addEventListener('wa-change', handleChange);
            geographySelector.addEventListener('change', handleChange);
        }
    }

    /**
     * Set up download button functionality
     */
    setupDownloadFunctionality() {
        const downloadBtn = document.getElementById('downloadFilteredData');

        if (downloadBtn) {
            downloadBtn.addEventListener('click', async () => {
                try {
                    await this.downloadCurrentData();
                } catch (error) {
                    console.error('Error downloading data:', error);
                    this.uiManager.showError('Failed to download data');
                }
            });
        }
    }

    /**
     * Download the currently displayed map data as CSV
     */
    async downloadCurrentData() {
        // Get current state from DataLoader
        const evictionData = this.dataLoader.getEvictionData();
        const displayMode = this.dataLoader.getDisplayMode();
        const geographyType = this.dataLoader.getGeographyType();
        const currentMonth = this.dataLoader.getCurrentMonth();
        const monthUtils = this.dataLoader.getMonthUtils();

        // Get geography configuration from LayerManager
        const layerManager = this.mapManager.getLayerManager();
        const geoConfig = layerManager.geographyConfig[geographyType];

        // Fetch the GeoJSON to get feature names/properties
        const response = await fetch(geoConfig.file);
        if (!response.ok) throw new Error('Failed to fetch geography data');
        const geoJsonData = await response.json();

        // Build CSV rows
        const rows = [];

        // Get human-readable month label for the data column
        const isRange = this.dataLoader.isInRangeMode();
        const monthLabel = isRange
            ? `${monthUtils.dbMonthToHumanReadable(this.dataLoader.getStartMonth())} - ${monthUtils.dbMonthToHumanReadable(this.dataLoader.getEndMonth())}`
            : monthUtils.dbMonthToHumanReadable(currentMonth);

        // Determine headers based on geography type and display mode
        let headers;
        if (geographyType === 'tract') {
            headers = ['GEOID', 'County FIPS', 'Month', displayMode === 'rate' ? 'Filing Rate (%)' : 'Total Filings'];
        } else if (geographyType === 'school') {
            headers = ['School Name', 'Month', displayMode === 'rate' ? 'Filing Rate (%)' : 'Total Filings'];
        } else if (geographyType === 'hex') {
            headers = ['Hex ID', 'County', 'Month', displayMode === 'rate' ? 'Filing Rate (%)' : 'Total Filings'];
        }
        rows.push(headers);

        // Process each feature from the GeoJSON
        geoJsonData.features.forEach(feature => {
            const props = feature.properties;
            const featureId = props[geoConfig.idProperty];
            const data = evictionData[featureId] || { totalfilings: 0, filingRate: 0 };

            const value = displayMode === 'rate'
                ? (data.filingRate || 0).toFixed(2)
                : (data.totalfilings || 0);

            let row;
            if (geographyType === 'tract') {
                row = [props.GEOID, props.COUNTYFP, monthLabel, value];
            } else if (geographyType === 'school') {
                row = [`${props.ShortLabel} High School Area`, monthLabel, value];
            } else if (geographyType === 'hex') {
                row = [props.hex_id, props.County || '', monthLabel, value];
            }
            rows.push(row);
        });

        // Convert to CSV string
        const csvContent = rows.map(row =>
            row.map(cell => {
                // Escape cells that contain commas or quotes
                const cellStr = String(cell);
                if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                    return `"${cellStr.replace(/"/g, '""')}"`;
                }
                return cellStr;
            }).join(',')
        ).join('\n');

        // Generate filename
        const geoLabel = geographyType === 'tract' ? 'census-tracts'
            : geographyType === 'school' ? 'school-areas'
            : 'hexagons';
        const modeLabel = displayMode === 'rate' ? 'filing-rates' : 'filing-counts';
        const dateLabel = isRange
            ? `${monthUtils.dbMonthToHumanReadable(this.dataLoader.getStartMonth()).replace(' ', '-')}_to_${monthUtils.dbMonthToHumanReadable(this.dataLoader.getEndMonth()).replace(' ', '-')}`
            : monthUtils.dbMonthToHumanReadable(currentMonth).replace(' ', '-');
        const filename = `eviction-${modeLabel}-${geoLabel}-${dateLabel}.csv`;

        // Trigger download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }

    /**
     * Initialize map tooltip handler after map layers are loaded
     */
    initializeMapTooltipHandler() {
        if (!this.mapManager || !this.mapManager.getMap()) {
            return;
        }

        // Get the tooltip manager from MapManager
        const tooltipManager = this.mapManager.getTooltipManager();
        const map = this.mapManager.getMap();
        const censusLayerId = 'tract-fills';

        if (!tooltipManager) {
            return;
        }

        // Initialize the map tooltip handler with dataLoader for display mode awareness
        this.mapTooltipHandler = new MapTooltipHandler(map, tooltipManager, censusLayerId, this.dataLoader);
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