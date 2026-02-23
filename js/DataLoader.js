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
        // Current geography type
        this.currentGeography = 'tract';
        // Range mode state
        this.isRangeMode = false;
        this.startMonth = null;
        this.endMonth = null;

        // Geography configuration for Supabase tables
        this.geographyConfig = {
            tract: {
                table: 'evictions-tract',
                idField: 'tractid'
            },
            school: {
                table: 'evictions-school',
                idField: 'school_id'
            },
            hex: {
                table: 'evictions-hex',
                idField: 'hex_id'
            },
            city: {
                table: 'evictions-city',
                idField: 'city_id'
            }
        };
    }

    /**
     * Get current geography type
     */
    getGeographyType() {
        return this.currentGeography;
    }

    /**
     * Set geography type
     */
    setGeographyType(geographyType) {
        if (this.geographyConfig[geographyType]) {
            this.currentGeography = geographyType;
        }
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

            // Get the correct table and ID field for current geography
            const config = this.geographyConfig[this.currentGeography];

            const { data, error } = await this.supabase
                .from(config.table)
                .select(`${config.idField}, totalfilings, filing-rate, filemonth`)
                .eq('filemonth', supabaseMonth);

            if (error) {
                throw error;
            }

            // Create lookup object with both filing counts and rates
            this.evictionData = {};
            if (data) {
                data.forEach(item => {
                    const id = item[config.idField];
                    this.evictionData[id] = {
                        totalfilings: item.totalfilings || 0,
                        filingRate: (item['filing-rate'] || 0) * 100  // Convert decimal to percentage
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
     * Calculate total evictions from county-level data
     * This ensures the total matches the source data and County Trends chart
     */
    async calculateTotalEvictions() {
        try {
            // Check if current month is set
            if (!this.currentMonth) {
                return 0;
            }

            // Convert internal format (YY-MM) to Supabase format (YYYY-M) for querying
            const supabaseMonth = this.monthUtils.convertToSupabaseFormat(this.currentMonth);

            if (!supabaseMonth) {
                return 0;
            }

            // Query county-level aggregate data
            const { data, error } = await this.supabase
                .from('evictions-county')
                .select('totalfilings')
                .eq('filemonth', supabaseMonth);

            if (error) {
                console.error('Error calculating total evictions:', error);
                return 0;
            }

            // Sum all county totals
            if (data && data.length > 0) {
                return data.reduce((sum, county) => {
                    return sum + (county.totalfilings || 0);
                }, 0);
            }

            return 0;

        } catch (error) {
            console.error('Error calculating total evictions:', error);
            return 0;
        }
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

    /**
     * Set range mode on/off
     */
    setRangeMode(enabled) {
        this.isRangeMode = enabled;
        if (enabled) {
            this.displayMode = 'count';
        }
    }

    /**
     * Check if in range mode
     */
    isInRangeMode() {
        return this.isRangeMode;
    }

    /**
     * Get start/end months of range
     */
    getStartMonth() { return this.startMonth; }
    getEndMonth() { return this.endMonth; }

    /**
     * Get array of month strings between start and end (inclusive)
     */
    getMonthsInRange(startMonth, endMonth) {
        const allMonths = this.monthUtils.getAllMonths();
        const startIndex = allMonths.indexOf(startMonth);
        const endIndex = allMonths.indexOf(endMonth);
        if (startIndex === -1 || endIndex === -1) return [];
        return allMonths.slice(startIndex, endIndex + 1);
    }

    /**
     * Load eviction data for a date range and aggregate totalfilings per feature
     */
    async loadEvictionDataForRange(startMonth, endMonth) {
        try {
            this.startMonth = startMonth;
            this.endMonth = endMonth;

            const monthsInRange = this.getMonthsInRange(startMonth, endMonth);
            if (monthsInRange.length === 0) {
                this.evictionData = {};
                return this.evictionData;
            }

            const supabaseMonths = monthsInRange.map(m =>
                this.monthUtils.convertToSupabaseFormat(m)
            );

            const config = this.geographyConfig[this.currentGeography];

            // Paginate to avoid Supabase's default 1,000-row limit
            const pageSize = 1000;
            let allData = [];
            let from = 0;

            while (true) {
                const { data: page, error } = await this.supabase
                    .from(config.table)
                    .select(`${config.idField}, totalfilings, filemonth`)
                    .in('filemonth', supabaseMonths)
                    .range(from, from + pageSize - 1);

                if (error) throw error;
                if (page) allData = allData.concat(page);
                if (!page || page.length < pageSize) break;
                from += pageSize;
            }

            this.evictionData = {};
            if (allData.length > 0) {
                allData.forEach(item => {
                    const id = item[config.idField];
                    if (!this.evictionData[id]) {
                        this.evictionData[id] = { totalfilings: 0, filingRate: 0 };
                    }
                    this.evictionData[id].totalfilings += (item.totalfilings || 0);
                });
            }

            return this.evictionData;
        } catch (error) {
            throw new Error('Failed to load eviction data for range');
        }
    }

    /**
     * Calculate total evictions across the date range from county-level data
     */
    async calculateTotalEvictionsForRange() {
        try {
            if (!this.startMonth || !this.endMonth) return 0;

            const monthsInRange = this.getMonthsInRange(this.startMonth, this.endMonth);
            if (monthsInRange.length === 0) return 0;

            const supabaseMonths = monthsInRange.map(m =>
                this.monthUtils.convertToSupabaseFormat(m)
            );

            const { data, error } = await this.supabase
                .from('evictions-county')
                .select('totalfilings')
                .in('filemonth', supabaseMonths);

            if (error) return 0;

            if (data && data.length > 0) {
                return data.reduce((sum, county) => sum + (county.totalfilings || 0), 0);
            }
            return 0;
        } catch (error) {
            return 0;
        }
    }
}
