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
    this.regionalData = null;
    this.activeTab = 'county'; // 'county' or 'region'
    this.rangeStartIndex = null;
    this.rangeEndIndex = null;

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

    // Set up tab switching
    this.setupTabs();

    this.isInitialized = true;
  }

  /**
   * Open the county trends drawer
   */
  async openDrawer() {
    if (this.drawer && this.isInitialized) {
      this.drawer.open = true;
      
      // Load chart data if not already loaded (cached after first load)
      if (!this.monthlyData.labels) {
        await this.loadTrendsData();
      } else if (this.activeTab === 'region') {
        this.buildRegionalData();
        this.renderRegionalVisualization();
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
   * Set up tab switching between County and Region views
   */
  setupTabs() {
    const tabs = this.drawer.querySelectorAll('.trends-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        // Update active state
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        this.activeTab = tab.dataset.tab;

        // Update drawer label
        this.drawer.label = this.activeTab === 'region'
          ? 'Monthly Regional Eviction Filings'
          : 'Monthly County Eviction Filings';

        // Re-render if data is loaded
        if (this.monthlyData.labels) {
          if (this.activeTab === 'region') {
            this.buildRegionalData();
            this.renderRegionalVisualization();
          } else {
            this.renderVisualization();
          }
        }
      });
    });
  }

  /**
   * Build regional total data by summing county datasets
   */
  buildRegionalData() {
    if (!this.monthlyData || !this.monthlyData.datasets) return;

    const numMonths = this.monthlyData.labels.length;
    const regionalValues = new Array(numMonths).fill(0);

    this.monthlyData.datasets.forEach(dataset => {
      dataset.data.forEach((val, i) => {
        regionalValues[i] += val || 0;
      });
    });

    this.regionalData = {
      labels: this.monthlyData.labels,
      datasets: [{
        label: '5-County Region Total',
        data: regionalValues,
        borderColor: '#FDB713',
        backgroundColor: 'transparent',
        borderWidth: 3,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointBackgroundColor: '#FDB713',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 1
      }]
    };
  }

  /**
   * Render regional total visualization
   */
  renderRegionalVisualization() {
    if (!this.regionalData || !this.chartCanvas) return;

    try {
      if (this.chart) {
        this.chart.destroy();
      }

      const ctx = this.chartCanvas.getContext('2d');

      const currentMonth = this.dataLoader.getCurrentMonth();
      const monthUtils = this.dataLoader.getMonthUtils();
      const currentMonthIndex = monthUtils.dbMonthToSliderIndex(currentMonth);

      if (this.dataLoader.isInRangeMode()) {
        this.rangeStartIndex = monthUtils.dbMonthToSliderIndex(this.dataLoader.getStartMonth());
        this.rangeEndIndex = monthUtils.dbMonthToSliderIndex(this.dataLoader.getEndMonth());
      } else {
        this.rangeStartIndex = null;
        this.rangeEndIndex = null;
      }

      const allMonths = monthUtils.getAllMonths();
      const countyTrends = this;

      const verticalLinePlugin = {
        id: 'verticalLine',
        afterDraw: (chart) => {
          const ctx = chart.ctx;
          const chartArea = chart.chartArea;
          const xScale = chart.scales.x;

          const moratoriumPeriods = [
            { name: 'CARES Act', start: '2020-03', end: '2020-07', color: 'rgba(128, 128, 128, 0.15)' },
            { name: 'CDC', start: '2020-09', end: '2021-10', color: 'rgba(128, 128, 128, 0.15)' }
          ];

          moratoriumPeriods.forEach(period => {
            const startIndex = allMonths.findIndex(m => m === period.start);
            const endIndex = allMonths.findIndex(m => m === period.end);

            if (startIndex >= 0 && endIndex >= 0 && endIndex >= startIndex) {
              const xStart = xScale.getPixelForValue(startIndex);
              const xEnd = xScale.getPixelForValue(endIndex);

              ctx.save();
              ctx.fillStyle = period.color;
              ctx.fillRect(xStart, chartArea.top, xEnd - xStart, chartArea.bottom - chartArea.top);
              ctx.restore();

              ctx.save();
              ctx.fillStyle = 'rgba(80, 80, 80, 0.8)';
              ctx.font = '500 11px "DINPro", sans-serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'top';
              const labelX = (xStart + xEnd) / 2;
              const labelY = chartArea.top + 5;
              ctx.fillText(period.name, labelX, labelY);
              ctx.fillText('Moratorium', labelX, labelY + 13);
              ctx.restore();
            }
          });

          if (countyTrends.rangeStartIndex !== null && countyTrends.rangeEndIndex !== null) {
            [countyTrends.rangeStartIndex, countyTrends.rangeEndIndex].forEach(idx => {
              if (idx >= 0 && idx < countyTrends.regionalData.labels.length) {
                const xPos = xScale.getPixelForValue(idx);
                ctx.save();
                ctx.strokeStyle = 'rgba(128, 128, 128, 0.7)';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(xPos, chartArea.top);
                ctx.lineTo(xPos, chartArea.bottom);
                ctx.stroke();
                ctx.restore();
              }
            });
          } else if (countyTrends.currentMonthIndex >= 0 && countyTrends.currentMonthIndex < countyTrends.regionalData.labels.length) {
            const xPos = xScale.getPixelForValue(countyTrends.currentMonthIndex);
            ctx.save();
            ctx.strokeStyle = 'rgba(128, 128, 128, 0.7)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(xPos, chartArea.top);
            ctx.lineTo(xPos, chartArea.bottom);
            ctx.stroke();
            ctx.restore();
          }

          if (chart.tooltip && chart.tooltip.opacity > 0) {
            const activeElements = chart.tooltip.dataPoints;
            if (activeElements && activeElements.length > 0) {
              const xPos = activeElements[0].element.x;
              ctx.save();
              ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
              ctx.lineWidth = 1;
              ctx.setLineDash([]);
              ctx.beginPath();
              ctx.moveTo(xPos, chartArea.top);
              ctx.lineTo(xPos, chartArea.bottom);
              ctx.stroke();
              ctx.restore();
            }
          }
        }
      };

      this.currentMonthIndex = currentMonthIndex;

      this.chart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: this.regionalData.labels,
          datasets: this.regionalData.datasets
        },
        plugins: [verticalLinePlugin],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: {
              title: { display: true, text: '', font: { size: 14, weight: '500', family: 'DINPro, sans-serif' } },
              grid: { display: false },
              ticks: {
                maxTicksLimit: 20,
                font: { size: 12, weight: '400', family: 'DINPro, sans-serif' },
                callback: function(value, index, ticks) {
                  const label = this.getLabelForValue(value);
                  if (index === 0 || index === ticks.length - 1 || index % 4 === 0) return label;
                  return '';
                }
              }
            },
            y: {
              title: { display: true, text: 'Eviction Filings', font: { size: 14, weight: '500', family: 'DINPro, sans-serif' } },
              grid: { display: false },
              beginAtZero: true,
              ticks: {
                font: { size: 12, weight: '400', family: 'DINPro, sans-serif' },
                callback: function(value) { return value.toLocaleString(); }
              }
            }
          },
          plugins: {
            title: { display: false },
            legend: {
              display: true,
              position: 'bottom',
              labels: {
                usePointStyle: true,
                padding: 15,
                font: { size: 14, weight: '500', family: 'DINPro, sans-serif' }
              }
            },
            tooltip: {
              backgroundColor: '#58585A',
              titleColor: 'white',
              bodyColor: 'white',
              cornerRadius: 6,
              titleFont: { family: 'DINPro, sans-serif', weight: '500', size: 13 },
              bodyFont: { family: 'DINPro, sans-serif', weight: '400', size: 12 },
              callbacks: {
                label: function(context) {
                  const value = context.parsed.y.toLocaleString();
                  return `Region Total: ${value} filings`;
                }
              }
            }
          },
          interaction: { intersect: false, mode: 'index' },
          hover: { mode: 'index', intersect: false }
        }
      });

      // Update help text
      const explanationEl = document.querySelector('#countyTrendsDrawer .chart-explanation p i');
      if (explanationEl) {
        if (this.dataLoader.isInRangeMode()) {
          explanationEl.textContent = 'Vertical dashed lines show the date range selected on the map\'s time slider.';
        } else {
          explanationEl.textContent = 'Vertical dashed line represents the period selected on the map\'s time slider.';
        }
      }
    } catch (error) {
      this.showError('Failed to render regional chart');
    }
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
        .from('evictions-county')
        .select('filemonth, county_name, totalfilings')
        .in('filemonth', availableMonths);

      if (error) {
        throw error;
      }

      // Group data by county and month
      const countyData = {};
      if (data) {
        data.forEach(record => {
          const countyName = record.county_name;
          const internalFormat = monthUtils.convertFromSupabaseFormat(record.filemonth);

          if (!countyData[countyName]) {
            countyData[countyName] = {};
          }

          countyData[countyName][internalFormat] = record.totalfilings || 0;
        });
      }

      // Create datasets for each county
      const labels = allMonths.map(month => monthUtils.dbMonthToHumanReadable(month));
      const datasets = Object.keys(countyData).sort().map((countyName, index) => {
        const monthlyValues = allMonths.map(month => countyData[countyName][month] || 0);

        // Color palette for 5 counties
        const colors = [
          '#ee575d',  // Clayton
          '#636ea0',  // Cobb
          '#1270B3',  // DeKalb
          '#1aafa6',  // Fulton
          '#678539'   // Gwinnett
        ];

        return {
          label: countyName,
          data: monthlyValues,
          borderColor: colors[index % colors.length],
          backgroundColor: 'transparent',
          borderWidth: 3,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: colors[index % colors.length],
          pointBorderColor: '#ffffff',
          pointBorderWidth: 1
        };
      });

      this.monthlyData = { labels, datasets };

      // Hide loading indicator and render chart
      this.hideLoading();
      if (this.activeTab === 'region') {
        this.buildRegionalData();
        this.renderRegionalVisualization();
      } else {
        this.renderVisualization();
      }

    } catch (error) {
      this.hideLoading();
      this.showError('Failed to load county trends data');
    }
  }

  /**
   * Render county trends visualization using Chart.js
   */
  renderVisualization() {
    if (!this.monthlyData || !this.monthlyData.labels || !this.chartCanvas) {
      return;
    }

    try {
      // Destroy existing chart if it exists
      if (this.chart) {
        this.chart.destroy();
      }

      const ctx = this.chartCanvas.getContext('2d');

      // Get current slider month for vertical line
      const currentMonth = this.dataLoader.getCurrentMonth();
      const monthUtils = this.dataLoader.getMonthUtils();
      const currentMonthIndex = monthUtils.dbMonthToSliderIndex(currentMonth);

      // Compute range indices if in range mode
      if (this.dataLoader.isInRangeMode()) {
        this.rangeStartIndex = monthUtils.dbMonthToSliderIndex(this.dataLoader.getStartMonth());
        this.rangeEndIndex = monthUtils.dbMonthToSliderIndex(this.dataLoader.getEndMonth());
      } else {
        this.rangeStartIndex = null;
        this.rangeEndIndex = null;
      }

      // Get month list for moratorium period lookups
      const allMonths = monthUtils.getAllMonths();

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
            const startIndex = allMonths.findIndex(m => m === period.start);
            const endIndex = allMonths.findIndex(m => m === period.end);

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
              ctx.font = '500 11px "DINPro", sans-serif';
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

          // Draw vertical line(s) for current selection
          if (countyTrends.rangeStartIndex !== null && countyTrends.rangeEndIndex !== null) {
            // Range mode: draw two dashed lines at start and end
            [countyTrends.rangeStartIndex, countyTrends.rangeEndIndex].forEach(idx => {
              if (idx >= 0 && idx < countyTrends.monthlyData.labels.length) {
                const xPos = xScale.getPixelForValue(idx);
                ctx.save();
                ctx.strokeStyle = 'rgba(128, 128, 128, 0.7)';
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(xPos, chartArea.top);
                ctx.lineTo(xPos, chartArea.bottom);
                ctx.stroke();
                ctx.restore();
              }
            });
          } else if (countyTrends.currentMonthIndex >= 0 && countyTrends.currentMonthIndex < countyTrends.monthlyData.labels.length) {
            // Single month mode: draw single dashed line
            const xPos = xScale.getPixelForValue(countyTrends.currentMonthIndex);
            ctx.save();
            ctx.strokeStyle = 'rgba(128, 128, 128, 0.7)';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
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
          labels: this.monthlyData.labels,
          datasets: this.monthlyData.datasets
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
                  weight: '500',
                  family: 'DINPro, sans-serif'
                }
              },
              grid: {
                display: false // Remove x-axis gridlines
              },
              ticks: {
                maxTicksLimit: 20, // Increased from 12 to show more labels
                font: {
                  size: 12,
                  weight: '400',
                  family: 'DINPro, sans-serif'
                },
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
                text: 'Eviction Filings',
                font: {
                  size: 14,
                  weight: '500',
                  family: 'DINPro, sans-serif'
                }
              },
              grid: {
                display: false // Remove y-axis gridlines
              },
              beginAtZero: true,
              ticks: {
                font: {
                  size: 12,
                  weight: '400',
                  family: 'DINPro, sans-serif'
                },
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
              display: true,
              position: 'bottom',
              labels: {
                usePointStyle: true,
                padding: 15,
                font: {
                  size: 14,
                  weight: '500',
                  family: 'DINPro, sans-serif'
                }
              }
            },
            tooltip: {
              backgroundColor: '#58585A',
              titleColor: 'white',
              bodyColor: 'white',
              cornerRadius: 6,
              titleFont: {
                family: 'DINPro, sans-serif',
                weight: '500',
                size: 13
              },
              bodyFont: {
                family: 'DINPro, sans-serif',
                weight: '400',
                size: 12
              },
              callbacks: {
                label: function(context) {
                  const countyName = context.dataset.label;
                  const value = context.parsed.y.toLocaleString();
                  return `${countyName}: ${value} filings`;
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
      // Update help text based on range mode
      const explanationEl = document.querySelector('#countyTrendsDrawer .chart-explanation p i');
      if (explanationEl) {
        if (this.dataLoader.isInRangeMode()) {
          explanationEl.textContent = 'Vertical dashed lines show the date range selected on the map\'s time slider. Click a county in the legend above to hide it from the chart.';
        } else {
          explanationEl.textContent = 'Vertical dashed line represents the period selected on the map\'s time slider. Click a county in the legend above to hide it from the chart.';
        }
      }
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
    const monthUtils = this.dataLoader.getMonthUtils();
    const newCurrentMonthIndex = monthUtils.dbMonthToSliderIndex(currentMonth);

    // Update stored index
    this.currentMonthIndex = newCurrentMonthIndex;

    // Update range indices if in range mode
    if (this.dataLoader.isInRangeMode()) {
      this.rangeStartIndex = monthUtils.dbMonthToSliderIndex(this.dataLoader.getStartMonth());
      this.rangeEndIndex = monthUtils.dbMonthToSliderIndex(this.dataLoader.getEndMonth());
    } else {
      this.rangeStartIndex = null;
      this.rangeEndIndex = null;
    }

    // Update help text based on range mode and active tab
    const explanationEl = document.querySelector('#countyTrendsDrawer .chart-explanation p i');
    if (explanationEl) {
      if (this.activeTab === 'region') {
        if (this.dataLoader.isInRangeMode()) {
          explanationEl.textContent = 'Vertical dashed lines show the date range selected on the map\'s time slider.';
        } else {
          explanationEl.textContent = 'Vertical dashed line represents the period selected on the map\'s time slider.';
        }
      } else {
        if (this.dataLoader.isInRangeMode()) {
          explanationEl.textContent = 'Vertical dashed lines show the date range selected on the map\'s time slider. Click a county in the legend above to hide it from the chart.';
        } else {
          explanationEl.textContent = 'Vertical dashed line represents the period selected on the map\'s time slider. Click a county in the legend above to hide it from the chart.';
        }
      }
    }

    // Trigger chart redraw to show new vertical line position
    this.chart.update('none'); // 'none' for no animation
  }

  /**
   * Clear cached data (forces reload on next open)
   */
  clearCache() {
    this.monthlyData = [];
    this.regionalData = null;
  }
}

// Make CountyTrends available globally
window.CountyTrends = CountyTrends;
