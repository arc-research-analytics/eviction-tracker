/**
 * MonthUtils - Utility functions for converting between different month formats
 */
class MonthUtils {
    constructor() {
        this.monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        
        // Generate all months from Jan 2016 to Jun 2025
        this.monthList = this.generateMonthList();
    }

    /**
     * Generate list of all months from 16-01 to 25-06
     */
    generateMonthList() {
        const months = [];
        
        // Start from 2016 (16) to 2025 (25)
        for (let year = 16; year <= 25; year++) {
            const endMonth = year === 25 ? 6 : 12; // June 2025 is the last month
            
            for (let month = 1; month <= endMonth; month++) {
                const yearStr = year.toString().padStart(2, '0');
                const monthStr = month.toString().padStart(2, '0');
                months.push(`${yearStr}-${monthStr}`);
            }
        }
        
        return months;
    }

    /**
     * Convert slider index to database month format (YY-MM)
     */
    sliderIndexToDbMonth(index) {
        if (index < 0 || index >= this.monthList.length) {
            return null;
        }
        return this.monthList[index];
    }

    /**
     * Convert database month format (YY-MM) to slider index
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
     * Convert database month format (YY-MM) to human readable format (Jan 2016)
     */
    dbMonthToHumanReadable(dbMonth) {
        const [year, month] = dbMonth.split('-');
        const monthIndex = parseInt(month) - 1;
        const fullYear = 2000 + parseInt(year);
        
        if (monthIndex >= 0 && monthIndex < 12) {
            return `${this.monthNames[monthIndex]} ${fullYear}`;
        }
        
        return dbMonth;
    }

    /**
     * Convert database month format (YY-MM) to full readable format (January 2016)
     */
    dbMonthToFullReadable(dbMonth) {
        const fullMonthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        
        const [year, month] = dbMonth.split('-');
        const monthIndex = parseInt(month) - 1;
        const fullYear = 2000 + parseInt(year);
        
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
     * Get the current month index (25-06 = June 2025)
     */
    getCurrentMonthIndex() {
        return this.dbMonthToSliderIndex('25-06');
    }

    /**
     * Get all months for debugging
     */
    getAllMonths() {
        return this.monthList;
    }
}
