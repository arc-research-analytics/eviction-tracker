/**
 * DataLoader - Handles data loading and processing operations
 */
class DataLoader {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.evictionData = {};
        this.monthUtils = new MonthUtils();
        // Default month will be set after loading available months
        this.currentMonth = null;
        // Display mode: 'count' for raw evictions, 'rate' for filing rates
        this.displayMode = 'rate'; // Default to showing rates
    }

    /**
     * Load eviction data from Supabase for the current month
     */
    async loadEvictionData() {
        try {
            // Check if current month is set
            if (!this.currentMonth) {
                this.evictionData = {};
                return this.evictionData;
            }

            // Convert internal format (YY-MM) to Supabase format (YYYY-M) for querying
            const supabaseMonth = this.monthUtils.convertToSupabaseFormat(this.currentMonth);

            if (!supabaseMonth) {
                this.evictionData = {};
                return this.evictionData;
            }

            const { data, error } = await this.supabase
                .from('evictions-tract')
                .select('tractid, totalfilings, filing-rate, filemonth')
                .eq('filemonth', supabaseMonth);

            if (error) {
                throw error;
            }

            // Create lookup object with both filing counts and rates
            this.evictionData = {};
            if (data) {
                data.forEach(item => {
                    this.evictionData[item.tractid] = {
                        totalfilings: item.totalfilings || 0,
                        filingRate: item['filing-rate'] || 0
                    };
                });
            }
            
            return this.evictionData;

        } catch (error) {
            throw new Error('Failed to load eviction data');
        }
    }

    /**
     * Convert month format from '25-06' to 'June 2025'
     */
    formatMonthDisplay(monthString) {
        return this.monthUtils.dbMonthToFullReadable(monthString || this.currentMonth);
    }

    /**
     * Calculate total evictions from current data
     */
    calculateTotalEvictions() {
        return Object.values(this.evictionData).reduce((sum, tractData) => {
            return sum + (tractData.totalfilings || 0);
        }, 0);
    }

    /**
     * Get current month filter
     */
    getCurrentMonth() {
        return this.currentMonth;
    }

    /**
     * Set current month filter
     */
    setCurrentMonth(monthString) {
        this.currentMonth = monthString;
    }

    /**
     * Get eviction data
     */
    getEvictionData() {
        return this.evictionData;
    }

    /**
     * Change month and reload data
     */
    async changeMonth(newMonth) {
        this.currentMonth = newMonth;
        return await this.loadEvictionData();
    }

    /**
     * Change month by slider index and reload data
     */
    async changeMonthBySliderIndex(sliderIndex) {
        const newMonth = this.monthUtils.sliderIndexToDbMonth(sliderIndex);
        if (newMonth) {
            return await this.changeMonth(newMonth);
        }
        throw new Error('Invalid slider index');
    }

    /**
     * Load all eviction data within the configured date range
     * Fixed to use the same reliable method as single-month queries
     */
    async loadAllEvictionDataInRange() {
        try {
            // First, get only the months that actually have data (much smaller list)
            const availableMonths = await this.getAvailableMonths();

            if (availableMonths.length === 0) {
                return [];
            }

            // Use smaller .in() query with only months that have data (same as successful multi-month approach)
            const { data, error } = await this.supabase
                .from('evictions-tract')
                .select('tractid, totalfilings, filing-rate, filemonth')
                .in('filemonth', availableMonths)
                .order('filemonth');

            if (error) {
                throw error;
            }

            return data || [];

        } catch (error) {
            throw new Error('Failed to load eviction data range');
        }
    }

    /**
     * Check which months have data available in the database within our date range
     */
    async getAvailableMonths() {
        try {
            // Simply return all available months from the monthList (already loaded from database)
            const availableMonths = this.monthUtils.getAllMonthsSupabaseFormat();
            return availableMonths.map(month => this.monthUtils.convertFromSupabaseFormat(month));

        } catch (error) {
            return [];
        }
    }

    /**
     * Debug method: Compare single-month vs multi-month loading for a specific month
     */
    async debugCompareLoadingMethods(testMonth) {
        try {
            // Method 1: Single-month loading (what the map uses)
            const supabaseTestMonth = this.getMonthUtils().convertToSupabaseFormat(testMonth);
            const { data: singleData, error: singleError } = await this.supabase
                .from('evictions-tract')
                .select('tractid, totalfilings, filing-rate, filemonth')
                .eq('filemonth', supabaseTestMonth);

            if (singleError) throw singleError;

            const singleTotal = singleData ? singleData.reduce((sum, item) => sum + (item.totalfilings || 0), 0) : 0;

            // Method 2: Multi-month loading with .in() filter (what County Trends uses)
            const { data: multiData, error: multiError } = await this.supabase
                .from('evictions-tract')
                .select('tractid, totalfilings, filing-rate, filemonth')
                .in('filemonth', [supabaseTestMonth]);

            if (multiError) throw multiError;

            const multiTotal = multiData ? multiData.reduce((sum, item) => sum + (item.totalfilings || 0), 0) : 0;

            // Method 3: Test with full valid months array to see if filtering is the issue
            const monthUtils = this.getMonthUtils();
            const validMonths = monthUtils.getAllMonthsSupabaseFormat();
            const { data: fullRangeData, error: fullRangeError } = await this.supabase
                .from('evictions-tract')
                .select('tractid, totalfilings, filing-rate, filemonth')
                .in('filemonth', validMonths);

            if (fullRangeError) throw fullRangeError;

            const testMonthDataFromFullRange = fullRangeData ? fullRangeData.filter(r => r.filemonth === supabaseTestMonth) : [];
            const fullRangeTotal = testMonthDataFromFullRange.reduce((sum, item) => sum + (item.totalfilings || 0), 0);

            return {
                singleTotal,
                multiTotal,
                fullRangeTotal,
                singleRecords: singleData?.length || 0,
                multiRecords: multiData?.length || 0,
                fullRangeRecords: testMonthDataFromFullRange.length
            };

        } catch (error) {
            return null;
        }
    }

    /**
     * Initialize available months from database
     */
    async initializeAvailableMonths() {
        try {
            await this.monthUtils.loadAvailableMonths(this.supabase);

            // Set default current month using config MAX_DATE preference
            if (!this.currentMonth && this.monthUtils.monthList.length > 0) {
                const preferredIndex = this.monthUtils.getCurrentMonthIndex();
                this.currentMonth = this.monthUtils.monthList[preferredIndex];
            }

        } catch (error) {
            // Fall back to current month from config (now YYYY-MM format)
            this.currentMonth = '2025-05'; // fallback
        }

        // Final check - if still no current month, set a reasonable default
        if (!this.currentMonth && this.monthUtils.monthList.length > 0) {
            this.currentMonth = this.monthUtils.monthList[this.monthUtils.monthList.length - 1];
        }
    }

    /**
     * Get month utilities instance
     */
    getMonthUtils() {
        return this.monthUtils;
    }

    /**
     * Set display mode (count or rate)
     */
    setDisplayMode(mode) {
        if (mode === 'count' || mode === 'rate') {
            this.displayMode = mode;
        }
    }

    /**
     * Get current display mode
     */
    getDisplayMode() {
        return this.displayMode;
    }

    /**
     * Get data value for a tract based on current display mode
     */
    getDataValueForTract(tractId) {
        const tractData = this.evictionData[tractId];
        if (!tractData) return 0;

        if (this.displayMode === 'rate') {
            return tractData.filingRate || 0;
        } else {
            return tractData.totalfilings || 0;
        }
    }

    /**
     * Get all data values based on current display mode (for legend/styling)
     */
    getCurrentDataValues() {
        return Object.values(this.evictionData).map(tractData => {
            if (this.displayMode === 'rate') {
                return tractData.filingRate || 0;
            } else {
                return tractData.totalfilings || 0;
            }
        });
    }
}
