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
    }

    /**
     * Load eviction data from Supabase for the current month
     */
    async loadEvictionData() {
        try {
            // Check if current month is set
            if (!this.currentMonth) {
                console.warn('DataLoader: No current month set, cannot load eviction data');
                this.evictionData = {};
                return this.evictionData;
            }

            // Convert internal format (YY-MM) to Supabase format (YYYY-M) for querying
            const supabaseMonth = this.monthUtils.convertToSupabaseFormat(this.currentMonth);
            
            if (!supabaseMonth) {
                console.error('DataLoader: Failed to convert month format, cannot load data');
                this.evictionData = {};
                return this.evictionData;
            }
            
            console.log('DataLoader: Querying tract-summary with month:', supabaseMonth);
            const { data, error } = await this.supabase
                .from('tract-summary')
                .select('tractid, totalfilings, filemonth')
                .eq('filemonth', supabaseMonth);

            console.log('DataLoader: Raw query result:', { 
                data: data?.length, 
                error, 
                firstFewRows: data?.slice(0, 3),
                queryMonth: supabaseMonth 
            });

            if (error) {
                console.error('DataLoader: Supabase query error:', error);
                throw error;
            }

            // Debug: Log single-month data loading
            const totalForMonth = data ? data.reduce((sum, item) => sum + (item.totalfilings || 0), 0) : 0;
            console.log(`DataLoader.loadEvictionData(): Loaded ${data?.length || 0} records for ${this.currentMonth}, total evictions: ${totalForMonth}`);

            // Create lookup object
            this.evictionData = {};
            if (data) {
                data.forEach(item => {
                    this.evictionData[item.tractid] = item.totalfilings || 0;
                });
            }
            
            return this.evictionData;
            
        } catch (error) {
            console.error('Error loading eviction data:', error);
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
        return Object.values(this.evictionData).reduce((sum, filings) => sum + filings, 0);
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
                console.warn(`DataLoader: No data available in the configured date range`);
                return [];
            }

            console.log(`DataLoader: Loading data for ${availableMonths.length} available months:`, availableMonths);

            // Use smaller .in() query with only months that have data (same as successful multi-month approach)
            const { data, error } = await this.supabase
                .from('tract-summary')
                .select('tractid, totalfilings, filemonth')
                .in('filemonth', availableMonths)
                .order('filemonth');

            if (error) {
                console.error('Supabase error:', error);
                throw error;
            }

            console.log(`DataLoader: Loaded ${data?.length || 0} records from Supabase for available months`);

            if (data && data.length > 0) {
                const uniqueMonths = [...new Set(data.map(r => r.filemonth))].sort();
                console.log(`DataLoader: Successfully loaded data for months:`, uniqueMonths);

                // Verify totals match expected values for known months
                const monthTotals = {};
                data.forEach(record => {
                    if (!monthTotals[record.filemonth]) monthTotals[record.filemonth] = 0;
                    monthTotals[record.filemonth] += record.totalfilings || 0;
                });
                
                console.log(`DataLoader: Monthly totals verification:`, 
                    Object.entries(monthTotals).slice(0, 5).map(([month, total]) => `${month}: ${total}`));
            }

            return data || [];

        } catch (error) {
            console.error('Error loading all eviction data:', error);
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
            console.log(`DataLoader: Available months from loaded data:`, availableMonths.length, 'months');
            return availableMonths.map(month => this.monthUtils.convertFromSupabaseFormat(month));

        } catch (error) {
            console.error('Error checking available months:', error);
            return [];
        }
    }

    /**
     * Debug method: Compare single-month vs multi-month loading for a specific month
     */
    async debugCompareLoadingMethods(testMonth) {
        try {
            console.log(`\n=== DEBUGGING COMPARISON FOR MONTH: ${testMonth} ===`);
            
            // Method 1: Single-month loading (what the map uses)
            const supabaseTestMonth = this.getMonthUtils().convertToSupabaseFormat(testMonth);
            const { data: singleData, error: singleError } = await this.supabase
                .from('tract-summary')
                .select('tractid, totalfilings, filemonth')
                .eq('filemonth', supabaseTestMonth);

            if (singleError) throw singleError;

            const singleTotal = singleData ? singleData.reduce((sum, item) => sum + (item.totalfilings || 0), 0) : 0;
            console.log(`Single-month query (.eq): ${singleData?.length || 0} records, total: ${singleTotal}`);

            // Method 2: Multi-month loading with .in() filter (what County Trends uses) 
            const { data: multiData, error: multiError } = await this.supabase
                .from('tract-summary')
                .select('tractid, totalfilings, filemonth')
                .in('filemonth', [supabaseTestMonth]);

            if (multiError) throw multiError;

            const multiTotal = multiData ? multiData.reduce((sum, item) => sum + (item.totalfilings || 0), 0) : 0;
            console.log(`Multi-month query (.in): ${multiData?.length || 0} records, total: ${multiTotal}`);

            // Method 3: Test with full valid months array to see if filtering is the issue
            const monthUtils = this.getMonthUtils();
            const validMonths = monthUtils.getAllMonthsSupabaseFormat();
            const { data: fullRangeData, error: fullRangeError } = await this.supabase
                .from('tract-summary')
                .select('tractid, totalfilings, filemonth')
                .in('filemonth', validMonths);

            if (fullRangeError) throw fullRangeError;

            const testMonthDataFromFullRange = fullRangeData ? fullRangeData.filter(r => r.filemonth === supabaseTestMonth) : [];
            const fullRangeTotal = testMonthDataFromFullRange.reduce((sum, item) => sum + (item.totalfilings || 0), 0);
            console.log(`Full range query filtered to ${testMonth}: ${testMonthDataFromFullRange.length} records, total: ${fullRangeTotal}`);

            console.log(`=== COMPARISON RESULTS ===`);
            console.log(`Single (.eq): ${singleTotal}`);
            console.log(`Multi (.in): ${multiTotal}`);
            console.log(`Full range filtered: ${fullRangeTotal}`);
            console.log(`Match? Single=${singleTotal === multiTotal}, FullRange=${singleTotal === fullRangeTotal}`);

            return {
                singleTotal,
                multiTotal,
                fullRangeTotal,
                singleRecords: singleData?.length || 0,
                multiRecords: multiData?.length || 0,
                fullRangeRecords: testMonthDataFromFullRange.length
            };

        } catch (error) {
            console.error('Error in debug comparison:', error);
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
            
            console.log(`DataLoader: Initialized with ${this.monthUtils.monthList.length} available months`);
            console.log(`DataLoader: Default current month set to: ${this.currentMonth}`);
            
        } catch (error) {
            console.error('DataLoader: Failed to initialize available months:', error);
            // Fall back to current month from config (now YYYY-MM format)
            this.currentMonth = '2025-05'; // fallback
        }
        
        // Final check - if still no current month, set a reasonable default
        if (!this.currentMonth && this.monthUtils.monthList.length > 0) {
            this.currentMonth = this.monthUtils.monthList[this.monthUtils.monthList.length - 1];
            console.log(`DataLoader: Set fallback current month to: ${this.currentMonth}`);
        }
    }

    /**
     * Get month utilities instance
     */
    getMonthUtils() {
        return this.monthUtils;
    }
}
