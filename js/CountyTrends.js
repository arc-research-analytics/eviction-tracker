/**
 * CountyTrends module - handles the county trends drawer functionality
 */
class CountyTrends {
  constructor(dataLoader = null, supabase = null) {
    this.drawer = null;
    this.openButton = null;
    this.chart = null;
    this.chartCanvas = null;
    this.loadingIndicator = null;
    this.isInitialized = false;
    this.dataLoader = dataLoader;
    this.supabase = supabase;
    this.monthlyData = [];
    
    this.init();
  }

  /**
   * Initialize the county trends drawer
   */
  init() {
    // Wait for DOM to be ready and Web Awesome components to load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setupDrawer());
    } else {
      this.setupDrawer();
    }
  }

  /**
   * Set up drawer elements and event listeners
   */
  setupDrawer() {
    // Get drawer and button elements
    this.drawer = document.getElementById('countyTrendsDrawer');
    this.openButton = document.getElementById('countyTrendsBtn');
    this.chartCanvas = document.getElementById('countyTrendsChart');
    this.loadingIndicator = document.getElementById('chartLoadingIndicator');

    if (!this.drawer || !this.openButton || !this.chartCanvas) {
      console.error('CountyTrends: Required elements not found');
      return;
    }

    // Add event listener to open button
    this.openButton.addEventListener('click', () => this.openDrawer());

    // Listen for drawer close events (if needed for cleanup)
    this.drawer.addEventListener('wa-hide', () => this.onDrawerClose());
    this.drawer.addEventListener('wa-show', () => this.onDrawerOpen());

    this.isInitialized = true;
    console.log('CountyTrends: Drawer functionality initialized');
  }

  /**
   * Open the county trends drawer
   */
  async openDrawer() {
    if (this.drawer && this.isInitialized) {
      this.drawer.open = true;
      
      // Load chart data if not already loaded (cached after first load)
      if (this.monthlyData.length === 0) {
        console.log('CountyTrends: Loading data for first time...');
        await this.loadTrendsData();
      } else {
        console.log('CountyTrends: Using cached data, rendering immediately');
        this.renderVisualization();
      }
    }
  }

  /**
   * Close the county trends drawer
   */
  closeDrawer() {
    if (this.drawer && this.isInitialized) {
      this.drawer.open = false;
    }
  }

  /**
   * Handle drawer open event
   */
  onDrawerOpen() {
    console.log('CountyTrends: Drawer opened');
    // Future: Initialize any charts or data when drawer opens
  }

  /**
   * Handle drawer close event
   */
  onDrawerClose() {
    console.log('CountyTrends: Drawer closed');
    // Future: Clean up any resources when drawer closes
  }

  /**
   * Load county trends data for all available months
   */
  async loadTrendsData() {
    if (!this.dataLoader || !this.supabase) {
      console.error('CountyTrends: DataLoader or Supabase not available');
      return;
    }

    try {
      // Show loading indicator
      this.showLoading();

      const monthUtils = this.dataLoader.getMonthUtils();
      const allMonths = monthUtils.getAllMonths();
      
      console.log('CountyTrends: Loading data for', allMonths.length, 'months');

      // Try to load all data, with fallback to pagination if needed
      console.log('CountyTrends: Attempting to load all data...');
      
      let allData = [];
      let totalCount = 0;
      
      try {
        // First attempt: try to get all data with high limit
        const { data: bulkData, error, count } = await this.supabase
          .from('eviction-test')
          .select('tractid, totalfilings, filemonth', { count: 'exact' })
          .limit(50000);

        if (error) throw error;
        
        totalCount = count || 0;
        console.log('CountyTrends: Bulk query returned', bulkData?.length || 0, 'records out of', totalCount, 'total records');
        
        // If we got all the data, use it
        if (bulkData && (!count || bulkData.length >= count)) {
          allData = bulkData;
          console.log('CountyTrends: Successfully loaded all data in single query');
        } else {
          // Otherwise, fall back to pagination
          console.log('CountyTrends: Falling back to paginated queries...');
          allData = await this.loadDataWithPagination(totalCount);
        }
        
      } catch (error) {
        console.error('CountyTrends: Error with bulk query, trying pagination:', error);
        // Get count first
        const { count } = await this.supabase
          .from('eviction-test')
          .select('*', { count: 'exact', head: true });
        
        totalCount = count || 0;
        allData = await this.loadDataWithPagination(totalCount);
      }

      console.log('CountyTrends: Final result -', allData.length, 'records loaded out of', totalCount, 'total');

      // Debug: Check what months are actually in the data
      const uniqueMonths = [...new Set(allData?.map(record => record.filemonth) || [])].sort();
      console.log('CountyTrends: Found data for', uniqueMonths.length, 'unique months');
      console.log('CountyTrends: Month range:', uniqueMonths[0], 'to', uniqueMonths[uniqueMonths.length - 1]);

      // Group data by month and calculate totals in JavaScript
      const monthTotals = {};
      
      if (allData) {
        allData.forEach(record => {
          const month = record.filemonth;
          if (!monthTotals[month]) {
            monthTotals[month] = 0;
          }
          monthTotals[month] += record.totalfilings || 0;
        });
      }

      // Create monthly totals array in correct order
      const monthlyTotals = allMonths.map(month => ({
        month: month,
        total: monthTotals[month] || 0,
        label: monthUtils.dbMonthToHumanReadable(month)
      }));

      // Debug: Show key statistics
      const nonZeroMonths = monthlyTotals.filter(m => m.total > 0).length;
      console.log('CountyTrends: Processed', nonZeroMonths, 'months with data out of', monthlyTotals.length, 'total months');

      this.monthlyData = monthlyTotals;
      console.log('CountyTrends: Loaded data for', monthlyTotals.length, 'months');

      // Hide loading indicator and render chart
      this.hideLoading();
      this.renderVisualization();

    } catch (error) {
      console.error('CountyTrends: Error loading trends data:', error);
      this.hideLoading();
      this.showError('Failed to load county trends data');
    }
  }

  /**
   * Render county trends visualization using Chart.js
   */
  renderVisualization() {
    if (!this.monthlyData.length || !this.chartCanvas) {
      console.error('CountyTrends: No data or canvas available for chart');
      return;
    }

    try {
      // Destroy existing chart if it exists
      if (this.chart) {
        this.chart.destroy();
      }

      const ctx = this.chartCanvas.getContext('2d');
      
      // Prepare data for Chart.js
      const labels = this.monthlyData.map(item => item.label);
      const data = this.monthlyData.map(item => item.total);

      // Get current slider month for vertical line
      const currentMonth = this.dataLoader.getCurrentMonth();
      const currentMonthIndex = this.dataLoader.getMonthUtils().dbMonthToSliderIndex(currentMonth);

      // Create custom plugin for vertical lines
      const countyTrends = this; // Reference to this instance for closure
      const verticalLinePlugin = {
        id: 'verticalLine',
        afterDraw: (chart) => {
          const ctx = chart.ctx;
          const chartArea = chart.chartArea;
          const xScale = chart.scales.x;
          
          // Draw static vertical line for current month (dashed)
          if (countyTrends.currentMonthIndex >= 0 && countyTrends.currentMonthIndex < labels.length) {
            const xPos = xScale.getPixelForValue(countyTrends.currentMonthIndex);
            
            ctx.save();
            ctx.strokeStyle = 'rgba(128, 128, 128, 0.7)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]); // Dashed line for current month
            ctx.beginPath();
            ctx.moveTo(xPos, chartArea.top);
            ctx.lineTo(xPos, chartArea.bottom);
            ctx.stroke();
            ctx.restore();
          }
          
          // Draw dynamic hover crosshair (solid line)
          if (chart.tooltip && chart.tooltip.opacity > 0) {
            const activeElements = chart.tooltip.dataPoints;
            if (activeElements && activeElements.length > 0) {
              const xPos = activeElements[0].element.x;
              
              ctx.save();
              ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)'; // Light black for hover line
              ctx.lineWidth = 1;
              ctx.setLineDash([]); // Solid line for hover
              ctx.beginPath();
              ctx.moveTo(xPos, chartArea.top);
              ctx.lineTo(xPos, chartArea.bottom);
              ctx.stroke();
              ctx.restore();
            }
          }
        }
      };

      // Store current month index for vertical line
      this.currentMonthIndex = currentMonthIndex;

      this.chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: 'Monthly Evictions',
            data: data,
            borderColor: '#e31a1c',
            backgroundColor: 'rgba(227, 26, 28, 0.1)',
            borderWidth: 2,
            pointBackgroundColor: '#e31a1c',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            fill: true,
            tension: 0.1
          }]
        },
        plugins: [verticalLinePlugin], // Add the vertical line plugin
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              title: {
                display: true,
                text: '',
                font: {
                  size: 14,
                  weight: 'bold'
                }
              },
              grid: {
                display: false // Remove x-axis gridlines
              },
              ticks: {
                maxTicksLimit: 20, // Increased from 12 to show more labels
                callback: function(value, index, ticks) {
                  const label = this.getLabelForValue(value);
                  // Show every 6th label (every 6 months) plus first/last
                  if (index === 0 || index === ticks.length - 1 || index % 6 === 0) {
                    return label;
                  }
                  return '';
                }
              }
            },
            y: {
              title: {
                display: true,
                text: 'Number of Evictions',
                font: {
                  size: 14,
                  weight: 'bold'
                }
              },
              grid: {
                display: false // Remove y-axis gridlines
              },
              beginAtZero: true,
              ticks: {
                callback: function(value) {
                  return value.toLocaleString();
                }
              }
            }
          },
          plugins: {
            title: {
              display: false
            },
            legend: {
              display: false
            },
            tooltip: {
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              titleColor: 'white',
              bodyColor: 'white',
              cornerRadius: 6,
              callbacks: {
                label: function(context) {
                  return `Evictions: ${context.parsed.y.toLocaleString()}`;
                }
              }
            }
          },
          interaction: {
            intersect: false,
            mode: 'index'
          },
          hover: {
            mode: 'index',
            intersect: false
          }
        }
      });

      console.log('CountyTrends: Chart rendered successfully');
    } catch (error) {
      console.error('CountyTrends: Error rendering chart:', error);
      this.showError('Failed to render chart');
    }
  }

  /**
   * Show loading indicator
   */
  showLoading() {
    if (this.loadingIndicator) {
      this.loadingIndicator.classList.remove('hidden');
    }
    if (this.chartCanvas) {
      this.chartCanvas.style.opacity = '0.3';
    }
  }

  /**
   * Hide loading indicator
   */
  hideLoading() {
    if (this.loadingIndicator) {
      this.loadingIndicator.classList.add('hidden');
    }
    if (this.chartCanvas) {
      this.chartCanvas.style.opacity = '1';
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    console.error('CountyTrends:', message);
    // TODO: Could implement a user-facing error display here
  }

  /**
   * Load data using pagination to work around row limits
   */
  async loadDataWithPagination(totalCount) {
    const pageSize = 1000; // Use the max we know works
    const totalPages = Math.ceil(totalCount / pageSize);
    let allData = [];
    
    console.log('CountyTrends: Loading data in', totalPages, 'pages of', pageSize, 'records each');
    
    for (let page = 0; page < totalPages; page++) {
      const rangeStart = page * pageSize;
      const rangeEnd = rangeStart + pageSize - 1;
      
      console.log(`CountyTrends: Loading page ${page + 1}/${totalPages} (records ${rangeStart}-${rangeEnd})`);
      
      try {
        const { data: pageData, error } = await this.supabase
          .from('eviction-test')
          .select('tractid, totalfilings, filemonth')
          .range(rangeStart, rangeEnd);

        if (error) throw error;
        
        if (pageData && pageData.length > 0) {
          allData = allData.concat(pageData);
          console.log(`CountyTrends: Page ${page + 1} loaded ${pageData.length} records (total: ${allData.length})`);
        } else {
          console.log(`CountyTrends: Page ${page + 1} returned no data, stopping pagination`);
          break;
        }
        
      } catch (error) {
        console.error(`CountyTrends: Error loading page ${page + 1}:`, error);
        // Continue with other pages rather than failing completely
      }
    }
    
    console.log('CountyTrends: Pagination complete -', allData.length, 'total records loaded');
    return allData;
  }

  /**
   * Update the vertical line position when slider changes (matches census tract functionality)
   */
  updateVerticalLine() {
    if (!this.chart || !this.dataLoader) return;

    // Get new current month from slider
    const currentMonth = this.dataLoader.getCurrentMonth();
    const newCurrentMonthIndex = this.dataLoader.getMonthUtils().dbMonthToSliderIndex(currentMonth);

    // Update stored index
    this.currentMonthIndex = newCurrentMonthIndex;

    // Trigger chart redraw to show new vertical line position
    this.chart.update('none'); // 'none' for no animation
  }

  /**
   * Clear cached data (forces reload on next open)
   */
  clearCache() {
    this.monthlyData = [];
    console.log('CountyTrends: Cache cleared - next open will reload data');
  }
}

// Make CountyTrends available globally
window.CountyTrends = CountyTrends;
