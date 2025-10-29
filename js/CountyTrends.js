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
      return;
    }

    // Add event listener to open button
    this.openButton.addEventListener('click', () => this.openDrawer());

    // Listen for drawer close events (if needed for cleanup)
    this.drawer.addEventListener('wa-hide', () => this.onDrawerClose());
    this.drawer.addEventListener('wa-show', () => this.onDrawerOpen());

    this.isInitialized = true;
  }

  /**
   * Open the county trends drawer
   */
  async openDrawer() {
    if (this.drawer && this.isInitialized) {
      this.drawer.open = true;
      
      // Load chart data if not already loaded (cached after first load)
      if (this.monthlyData.length === 0) {
        await this.loadTrendsData();
      } else {
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
    // Future: Initialize any charts or data when drawer opens
  }

  /**
   * Handle drawer close event
   */
  onDrawerClose() {
    // Future: Clean up any resources when drawer closes
  }

  /**
   * Load county trends data from the evictions-month table
   */
  async loadTrendsData() {
    if (!this.dataLoader || !this.supabase) {
      return;
    }

    try {
      // Show loading indicator
      this.showLoading();

      const monthUtils = this.dataLoader.getMonthUtils();
      const allMonths = monthUtils.getAllMonths();

      // Load data from evictions-month table for available months (respects MAX_DATE filter)
      const availableMonths = monthUtils.getAllMonthsSupabaseFormat();
      
      const { data, error } = await this.supabase
        .from('evictions-month')
        .select('filemonth, totalfilings')
        .in('filemonth', availableMonths);

      if (error) {
        throw error;
      }

      // Create lookup object for faster access
      // Convert Supabase format to internal format for lookup
      const monthTotals = {};
      if (data) {
        data.forEach(record => {
          // Convert YYYY-M format to YY-MM format for internal consistency
          const internalFormat = monthUtils.convertFromSupabaseFormat(record.filemonth);
          monthTotals[internalFormat] = record.totalfilings || 0;
        });
      }

      // Create monthly totals array in configured chronological order
      // This handles the sorting issue by using our configured month order instead of string sorting
      const monthlyTotals = allMonths.map(month => ({
        month: month,
        total: monthTotals[month] || 0,
        label: monthUtils.dbMonthToHumanReadable(month)
      }));

      this.monthlyData = monthlyTotals;

      // Hide loading indicator and render chart
      this.hideLoading();
      this.renderVisualization();

    } catch (error) {
      this.hideLoading();
      this.showError('Failed to load county trends data');
    }
  }

  /**
   * Render county trends visualization using Chart.js
   */
  renderVisualization() {
    if (!this.monthlyData.length || !this.chartCanvas) {
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

      // Create custom plugin for vertical lines and moratorium periods
      const countyTrends = this; // Reference to this instance for closure
      const verticalLinePlugin = {
        id: 'verticalLine',
        afterDraw: (chart) => {
          const ctx = chart.ctx;
          const chartArea = chart.chartArea;
          const xScale = chart.scales.x;

          // Define moratorium periods (format: YYYY-MM to match data)
          const moratoriumPeriods = [
            {
              name: 'CARES Act',
              start: '2020-03', // March 2020
              end: '2020-07',   // July 2020
              color: 'rgba(128, 128, 128, 0.15)'
            },
            {
              name: 'CDC',
              start: '2020-09', // September 2020
              end: '2021-10',   // October 2021
              color: 'rgba(128, 128, 128, 0.15)'
            }
          ];

          // Draw moratorium period shaded regions
          moratoriumPeriods.forEach(period => {
            // Find month indices for this period
            const startIndex = countyTrends.monthlyData.findIndex(m => m.month === period.start);
            const endIndex = countyTrends.monthlyData.findIndex(m => m.month === period.end);

            if (startIndex >= 0 && endIndex >= 0 && endIndex >= startIndex) {
              const xStart = xScale.getPixelForValue(startIndex);
              const xEnd = xScale.getPixelForValue(endIndex);

              // Draw shaded rectangle
              ctx.save();
              ctx.fillStyle = period.color;
              ctx.fillRect(xStart, chartArea.top, xEnd - xStart, chartArea.bottom - chartArea.top);
              ctx.restore();

              // Draw label at top of shaded region (two lines)
              ctx.save();
              ctx.fillStyle = 'rgba(80, 80, 80, 0.8)';
              ctx.font = 'bold 11px sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'top';
              const labelX = (xStart + xEnd) / 2;
              const labelY = chartArea.top + 5;
              // Draw two lines of text
              ctx.fillText(period.name, labelX, labelY);
              ctx.fillText('Moratorium', labelX, labelY + 13); // 13px spacing
              ctx.restore();
            }
          });

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
                  if (index === 0 || index === ticks.length - 1 || index % 4 === 0) {
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
    } catch (error) {
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
    // TODO: Could implement a user-facing error display here
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
  }
}

// Make CountyTrends available globally
window.CountyTrends = CountyTrends;
