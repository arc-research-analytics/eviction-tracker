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
            console.log('MonthUtils: Loading available months from database...');
            
            // Get all available months from new table structure
            console.log('MonthUtils: Querying tract-summary and month-summary tables...');
            const [tractData, monthData] = await Promise.all([
                supabaseClient.from('tract-summary').select('filemonth').limit(1000),
                supabaseClient.from('month-summary').select('filemonth').limit(1000)
            ]);

            console.log('MonthUtils: Query results:', {
                tractData: { data: tractData.data?.length || 0, error: tractData.error },
                monthData: { data: monthData.data?.length || 0, error: monthData.error }
            });
            
            // Debug: Show sample data from each table
            if (tractData.data?.length > 0) {
                console.log('MonthUtils: Sample tract-summary months:', tractData.data.slice(0, 5).map(d => d.filemonth));
                console.log('MonthUtils: First tract row full data:', tractData.data[0]);
            }
            if (monthData.data?.length > 0) {
                console.log('MonthUtils: Sample month-summary months:', monthData.data.slice(0, 5).map(d => d.filemonth));
                console.log('MonthUtils: First month row full data:', monthData.data[0]);
            }
            
            // Debug: Show what errors if any
            if (tractData.error) {
                console.error('MonthUtils: tract-summary query error:', tractData.error);
            }
            if (monthData.error) {
                console.error('MonthUtils: month-summary query error:', monthData.error);
            }

            // Combine and deduplicate months
            const allMonths = new Set();
            if (tractData.data) {
                tractData.data.forEach(row => {
                    allMonths.add(row.filemonth);
                });
            }
            if (monthData.data) {
                monthData.data.forEach(row => {
                    allMonths.add(row.filemonth);
                });
            }
            
            console.log('MonthUtils: Found', allMonths.size, 'unique months in database');

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

            // Filter out months beyond config MAX_DATE if specified
            const configMaxDate = (typeof CONFIG !== 'undefined' && CONFIG.dateRange) 
                ? CONFIG.dateRange.MAX_DATE 
                : null;
                
            if (configMaxDate) {
                const maxDateNum = this.parseMonthForComparison(configMaxDate);
                const originalCount = internalMonths.length;
                
                internalMonths = internalMonths.filter(month => {
                    const monthNum = this.parseMonthForComparison(month);
                    return monthNum <= maxDateNum;
                });
                
                const filteredCount = originalCount - internalMonths.length;
                if (filteredCount > 0) {
                    console.log(`MonthUtils: Filtered out ${filteredCount} months beyond MAX_DATE ${configMaxDate}`);
                }
            }

            this.monthList = internalMonths;
            
            console.log(`MonthUtils: Loaded ${internalMonths.length} months from database:`, internalMonths.slice(0, 5), '...', internalMonths.slice(-5));
            
            // If no months found, fall back to config-based approach
            if (internalMonths.length === 0) {
                console.warn('MonthUtils: No months found in database, falling back to config-based approach');
                const fallbackMonths = this.generateConfigBasedMonthList();
                this.monthList = fallbackMonths;
                return fallbackMonths;
            }
            
            return internalMonths;
            
        } catch (error) {
            console.error('MonthUtils: Error loading available months:', error);
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

        console.log(`MonthUtils: Generated ${months.length} months from config ${startDate} to ${maxDate}:`, months.slice(0, 5), '...', months.slice(-5));
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
     * Get the current month index (defaults to config MAX_DATE or latest available month)
     */
    getCurrentMonthIndex() {
        if (this.monthList.length === 0) {
            return 0; // Default to first month if no data loaded yet
        }
        
        // Check if config MAX_DATE exists and use it as the preferred default
        const configMaxDate = (typeof CONFIG !== 'undefined' && CONFIG.dateRange) 
            ? CONFIG.dateRange.MAX_DATE 
            : null;
            
        if (configMaxDate) {
            const maxIndex = this.dbMonthToSliderIndex(configMaxDate);
            if (maxIndex !== -1) {
                console.log(`MonthUtils: Using config MAX_DATE ${configMaxDate} as default (index ${maxIndex})`);
                return maxIndex;
            }
        }
        
        // Fallback to last available month if config MAX_DATE not found in data
        console.log('MonthUtils: Config MAX_DATE not found in data, using latest available month');
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
            console.error('MonthUtils: Cannot convert null/undefined month to Supabase format');
            return null;
        }
        
        // Now both internal and Supabase formats are YYYY-MM, so just return as-is
        // But validate the format
        const [year, month] = dbMonth.split('-');
        if (year && month && year.length === 4 && month.length === 2) {
            return dbMonth; // Already in correct YYYY-MM format
        }
        
        console.warn('MonthUtils: Invalid month format, expected YYYY-MM:', dbMonth);
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
