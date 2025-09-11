/**
 * DataLoader - Handles data loading and processing operations
 */
class DataLoader {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.evictionData = {};
        this.monthUtils = new MonthUtils();
        this.currentMonth = '25-06'; // Default to June 2025
    }

    /**
     * Load eviction data from Supabase for the current month
     */
    async loadEvictionData() {
        try {
            const { data, error } = await this.supabase
                .from('eviction-test')
                .select('tractid, totalfilings, filemonth')
                .eq('filemonth', this.currentMonth);

            if (error) throw error;

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
     * Get month utilities instance
     */
    getMonthUtils() {
        return this.monthUtils;
    }
}
