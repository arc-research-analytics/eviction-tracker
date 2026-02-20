/**
 * MonthUtils - Utility functions for converting between different month formats
 */
class MonthUtils {
    constructor() {
        this.monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

        // Generate month list based on config date range
        this.monthList = this.generateMonthList();
    }

    /**
     * Generate list of months based on available data (no config filtering)
     * Will be populated dynamically from database
     */
    generateMonthList() {
        // Return empty array initially - will be populated by loadAvailableMonths()
        return [];
    }
    
    /**
     * Populate month list from available data in Supabase
     */
    async loadAvailableMonths(supabaseClient) {
        try {
            // Get all available months from new table structure
            const [tractData, countyData] = await Promise.all([
                supabaseClient.from('evictions-tract').select('filemonth'),
                supabaseClient.from('evictions-county').select('filemonth')
            ]);

            // Combine and deduplicate months
            const allMonths = new Set();
            if (tractData.data) {
                tractData.data.forEach(row => {
                    allMonths.add(row.filemonth);
                });
            }
            if (countyData.data) {
                countyData.data.forEach(row => {
                    allMonths.add(row.filemonth);
                });
            }

            // Convert to internal format and sort chronologically
            const supabaseMonths = Array.from(allMonths);
            let internalMonths = supabaseMonths
                .map(month => this.convertFromSupabaseFormat(month))
                .sort((a, b) => {
                    const parseMonth = (month) => {
                        const [year, monthNum] = month.split('-');
                        return parseInt(year) * 100 + parseInt(monthNum);
                    };
                    return parseMonth(a) - parseMonth(b);
                });

            // Filter months to config START_DATE / MAX_DATE window
            const configStartDate = (typeof CONFIG !== 'undefined' && CONFIG.dateRange)
                ? CONFIG.dateRange.START_DATE
                : null;
            const configMaxDate = (typeof CONFIG !== 'undefined' && CONFIG.dateRange)
                ? CONFIG.dateRange.MAX_DATE
                : null;

            if (configStartDate) {
                const startDateNum = this.parseMonthForComparison(configStartDate);
                internalMonths = internalMonths.filter(month => {
                    return this.parseMonthForComparison(month) >= startDateNum;
                });
            }

            if (configMaxDate) {
                const maxDateNum = this.parseMonthForComparison(configMaxDate);
                internalMonths = internalMonths.filter(month => {
                    return this.parseMonthForComparison(month) <= maxDateNum;
                });
            }

            this.monthList = internalMonths;

            // If no months found, fall back to config-based approach
            if (internalMonths.length === 0) {
                const fallbackMonths = this.generateConfigBasedMonthList();
                this.monthList = fallbackMonths;
                return fallbackMonths;
            }

            return internalMonths;


        } catch (error) {
            // Fallback to config-based approach
            const fallbackMonths = this.generateConfigBasedMonthList();
            this.monthList = fallbackMonths;
            return fallbackMonths;
        }
    }

    /**
     * Fallback: Generate list based on config (updated for YYYY-MM format)
     */
    generateConfigBasedMonthList() {
        const months = [];

        // Get date range from config, with fallback defaults (now YYYY-MM format)
        const startDate = (typeof CONFIG !== 'undefined' && CONFIG.dateRange)
            ? CONFIG.dateRange.START_DATE
            : '2020-01'; // January 2020
        const maxDate = (typeof CONFIG !== 'undefined' && CONFIG.dateRange)
            ? CONFIG.dateRange.MAX_DATE
            : '2025-08'; // August 2025

        // Parse start and end dates (now YYYY-MM format)
        const [startYearStr, startMonthStr] = startDate.split('-');
        const [endYearStr, endMonthStr] = maxDate.split('-');
        const startYear = parseInt(startYearStr);
        const startMonth = parseInt(startMonthStr);
        const endYear = parseInt(endYearStr);
        const endMonth = parseInt(endMonthStr);

        // Generate months from start to end (YYYY-MM format with zero-padding)
        // This fallback method also respects the MAX_DATE cutoff
        for (let year = startYear; year <= endYear; year++) {
            const monthStart = year === startYear ? startMonth : 1;
            const monthEnd = year === endYear ? endMonth : 12;

            for (let month = monthStart; month <= monthEnd; month++) {
                const yearStr = year.toString(); // Full year (2020, not 20)
                const monthStr = month.toString().padStart(2, '0'); // Zero-padded month (01, not 1)
                months.push(`${yearStr}-${monthStr}`);
            }
        }

        return months;
    }

    /**
     * Convert slider index to database month format (YYYY-MM)
     */
    sliderIndexToDbMonth(index) {
        if (index < 0 || index >= this.monthList.length) {
            return null;
        }
        return this.monthList[index];
    }

    /**
     * Convert database month format (YYYY-MM) to slider index
     */
    dbMonthToSliderIndex(dbMonth) {
        return this.monthList.indexOf(dbMonth);
    }

    /**
     * Convert slider index to human readable format (Jan 2016)
     */
    sliderIndexToHumanReadable(index) {
        const dbMonth = this.sliderIndexToDbMonth(index);
        if (!dbMonth) return null;
        
        return this.dbMonthToHumanReadable(dbMonth);
    }

    /**
     * Convert database month format (YYYY-MM) to human readable format (Jan 2020)
     * Now expects consistent YYYY-MM format with zero-padded months
     */
    dbMonthToHumanReadable(dbMonth) {
        const [year, month] = dbMonth.split('-');
        const monthIndex = parseInt(month) - 1;
        const fullYear = parseInt(year);
        
        if (monthIndex >= 0 && monthIndex < 12) {
            return `${this.monthNames[monthIndex]} ${fullYear}`;
        }
        
        return dbMonth;
    }

    /**
     * Convert database month format (YYYY-MM) to full readable format (January 2020)
     * Now expects consistent YYYY-MM format with zero-padded months
     */
    dbMonthToFullReadable(dbMonth) {
        const fullMonthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        
        const [year, month] = dbMonth.split('-');
        const monthIndex = parseInt(month) - 1;
        const fullYear = parseInt(year);
        
        if (monthIndex >= 0 && monthIndex < 12) {
            return `${fullMonthNames[monthIndex]} ${fullYear}`;
        }
        
        return dbMonth;
    }

    /**
     * Get the total number of months in the range
     */
    getTotalMonths() {
        return this.monthList.length;
    }

    /**
     * Get the current month index (defaults to config DEFAULT_DATE or latest available month)
     */
    getCurrentMonthIndex() {
        if (this.monthList.length === 0) {
            return 0; // Default to first month if no data loaded yet
        }

        // Check if config DEFAULT_DATE exists and use it as the preferred default
        const configDefaultDate = (typeof CONFIG !== 'undefined' && CONFIG.dateRange)
            ? CONFIG.dateRange.DEFAULT_DATE
            : null;

        if (configDefaultDate) {
            const defaultIndex = this.dbMonthToSliderIndex(configDefaultDate);
            if (defaultIndex !== -1) {
                return defaultIndex;
            }
        }

        // Fallback to last available month if config DEFAULT_DATE not found in data
        return this.monthList.length - 1;
    }

    /**
     * Get all months for debugging
     */
    getAllMonths() {
        return this.monthList;
    }

    /**
     * Convert to Supabase format - now both formats are the same (YYYY-MM)
     * Kept for compatibility, but now just validates and returns the same format
     */
    convertToSupabaseFormat(dbMonth) {
        if (!dbMonth) {
            return null;
        }

        // Now both internal and Supabase formats are YYYY-MM, so just return as-is
        // But validate the format
        const [year, month] = dbMonth.split('-');
        if (year && month && year.length === 4 && month.length === 2) {
            return dbMonth; // Already in correct YYYY-MM format
        }

        return dbMonth;
    }

    /**
     * Convert from Supabase format - now both formats are the same (YYYY-MM)
     * Kept for compatibility, but now just validates and returns the same format
     */
    convertFromSupabaseFormat(supabaseMonth) {
        if (!supabaseMonth) {
            return supabaseMonth;
        }
        
        // Now both formats are YYYY-MM, so just return as-is
        // But ensure zero-padding for consistency
        const [year, month] = supabaseMonth.split('-');
        if (year && month) {
            const paddedMonth = month.padStart(2, '0');
            return `${year}-${paddedMonth}`;
        }
        
        return supabaseMonth;
    }

    /**
     * Get all months in Supabase format - now same as internal format
     */
    getAllMonthsSupabaseFormat() {
        return this.monthList; // Same format now
    }

    /**
     * Convert database month format to slider index (handles both formats)
     */
    dbMonthToSliderIndexFlexible(dbMonth) {
        // Try direct lookup first (YY-MM format)
        let index = this.monthList.indexOf(dbMonth);
        
        // If not found, try converting from Supabase format
        if (index === -1) {
            const convertedMonth = this.convertFromSupabaseFormat(dbMonth);
            index = this.monthList.indexOf(convertedMonth);
        }
        
        return index;
    }

    /**
     * Sort month strings chronologically (handles both YY-MM and YYYY-M formats)
     */
    sortMonthsChronologically(months) {
        return months.sort((a, b) => {
            return this.parseMonthForComparison(a) - this.parseMonthForComparison(b);
        });
    }

    /**
     * Parse month string to numeric value for comparison (works with YYYY-MM format)
     */
    parseMonthForComparison(monthString) {
        const [year, monthNum] = monthString.split('-');
        return parseInt(year) * 100 + parseInt(monthNum);
    }
}
