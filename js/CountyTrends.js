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
    this.cityData = null;
    this.selectedCities = [];
    this.activeTab = 'county'; // 'county', 'city', or 'region'
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
      
      if (this.activeTab === 'city') {
        if (!this.cityData) {
          await this.loadCityData();
        } else {
          this.renderCityVisualization();
        }
      } else if (!this.monthlyData.labels) {
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
    const content = this.drawer.querySelector('.county-trends-content');

    tabs.forEach(tab => {
      tab.addEventListener('click', async () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        this.activeTab = tab.dataset.tab;

        // Toggle city-mode CSS class for layout adjustment
        content.classList.toggle('city-mode', this.activeTab === 'city');

        // Update drawer label
        const labels = { county: 'Monthly County Eviction Filings', city: 'Monthly City Eviction Filings', region: 'Monthly Regional Eviction Filings' };
        this.drawer.label = labels[this.activeTab];

        // Render appropriate view
        if (this.activeTab === 'city') {
          if (!this.cityData) {
            await this.loadCityData();
          } else {
            this.renderCityVisualization();
          }
        } else if (this.monthlyData.labels) {
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
   * Load city trends data from the evictions-city table
   */
  async loadCityData() {
    if (!this.dataLoader || !this.supabase) return;

    try {
      this.showLoading();

      const monthUtils = this.dataLoader.getMonthUtils();
      const allMonths = monthUtils.getAllMonths();
      const availableMonths = monthUtils.getAllMonthsSupabaseFormat();

      // Paginate to avoid Supabase's 1,000-row default limit.
      // With ~56 cities × ~82 months ≈ 4,600 rows, pagination is required.
      const pageSize = 1000;
      let allData = [];
      let from = 0;
      while (true) {
        const { data: page, error } = await this.supabase
          .from('evictions-city')
          .select('filemonth, city_id, totalfilings')
          .in('filemonth', availableMonths)
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (page) allData = allData.concat(page);
        if (!page || page.length < pageSize) break;
        from += pageSize;
      }

      // Group data by city and month
      const byCityAndMonth = {};
      if (allData) {
        allData.forEach(record => {
          const cityName = record.city_id;
          const month = monthUtils.convertFromSupabaseFormat(record.filemonth);
          if (!byCityAndMonth[cityName]) byCityAndMonth[cityName] = {};
          byCityAndMonth[cityName][month] = record.totalfilings || 0;
        });
      }

      // Sort cities by total filings descending (top cities first in the select).
      // Exclude unincorporated areas — they don't appear on the map.
      const cityTotals = Object.entries(byCityAndMonth)
        .filter(([name]) => !name.toLowerCase().includes('unincorporated'))
        .map(([name, months]) => ({
          name,
          total: Object.values(months).reduce((s, v) => s + v, 0)
        }));
      cityTotals.sort((a, b) => b.total - a.total);

      // Alphabetical list for display in the select widget
      const cityNames = cityTotals.map(c => c.name).sort((a, b) => a.localeCompare(b));
      // Filings-sorted list kept only for fallback default selection
      const cityNamesByFilings = cityTotals.map(c => c.name);
      const labels = allMonths.map(m => monthUtils.dbMonthToHumanReadable(m));

      this.cityData = { cityNames, byCityAndMonth, labels, allMonths };

      // Default: preferred cities (excluding Atlanta which dominates the scale).
      // Case-insensitive match in case DB casing differs.
      const preferredDefaults = ['Marietta', 'South Fulton', 'Sandy Springs', 'East Point'];
      this.selectedCities = preferredDefaults
        .map(name => cityNames.find(c => c.toLowerCase() === name.toLowerCase()))
        .filter(Boolean);
      // Fallback: top 4 non-Atlanta cities by filings if preferred names don't match
      if (this.selectedCities.length === 0) {
        this.selectedCities = cityNamesByFilings.filter(c => c !== 'Atlanta').slice(0, 4);
      }

      this.hideLoading();
      this.populateCitySelect();
      this.renderCityVisualization();

    } catch (error) {
      console.error('CountyTrends: Failed to load city data:', error);
      this.hideLoading();
      this.showError('Failed to load city trends data');
    }
  }

  /**
   * Populate the city multi-select with options from loaded city data
   */
  populateCitySelect() {
    const select = document.getElementById('cityMultiSelect');
    if (!select || !this.cityData) return;

    // Remove existing options
    select.innerHTML = '';

    // Add a wa-option for each city
    this.cityData.cityNames.forEach(cityName => {
      const option = document.createElement('wa-option');
      option.value = cityName;
      option.textContent = cityName;
      select.appendChild(option);
    });

    // Set initial selection after WA processes the new child elements
    requestAnimationFrame(() => {
      select.value = [...this.selectedCities];
    });

    this.setupCitySelect();
  }

  /**
   * Wire up the city multi-select change event
   */
  setupCitySelect() {
    const select = document.getElementById('cityMultiSelect');
    if (!select || select._cityListenerAttached) return;
    select._cityListenerAttached = true;

    // Read select.value directly — more reliable than e.target.value which
    // may not be populated yet when the event fires in WA 3.x.
    // requestAnimationFrame deduplicates in case both wa-change and change fire.
    let pending = false;
    const handleChange = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        const val = select.value;
        let newSelected = Array.isArray(val) ? [...val] : (val ? [val] : []);

        // Enforce max 5 cities
        if (newSelected.length > 5) {
          newSelected = newSelected.slice(0, 5);
          select.value = newSelected;
        }

        this.selectedCities = newSelected;

        if (this.selectedCities.length > 0) {
          this.renderCityVisualization();
        } else if (this.chart) {
          this.chart.destroy();
          this.chart = null;
        }
      });
    };

    // WA 3.x fires 'wa-change'; also listen to native 'change' as a fallback
    select.addEventListener('wa-change', handleChange);
    select.addEventListener('change', handleChange);
  }

  /**
   * Render city trends visualization for the selected cities
   */
  renderCityVisualization() {
    if (!this.cityData || !this.chartCanvas) return;
    if (this.selectedCities.length === 0) {
      if (this.chart) { this.chart.destroy(); this.chart = null; }
      return;
    }

    try {
      if (this.chart) this.chart.destroy();

      const ctx = this.chartCanvas.getContext('2d');
      const monthUtils = this.dataLoader.getMonthUtils();
      const currentMonth = this.dataLoader.getCurrentMonth();
      this.currentMonthIndex = monthUtils.dbMonthToSliderIndex(currentMonth);

      if (this.dataLoader.isInRangeMode()) {
        this.rangeStartIndex = monthUtils.dbMonthToSliderIndex(this.dataLoader.getStartMonth());
        this.rangeEndIndex = monthUtils.dbMonthToSliderIndex(this.dataLoader.getEndMonth());
      } else {
        this.rangeStartIndex = null;
        this.rangeEndIndex = null;
      }

      const colors = ['#ee575d', '#636ea0', '#1270B3', '#1aafa6', '#678539'];
      const allMonths = this.cityData.allMonths;

      const datasets = this.selectedCities.map((cityName, i) => {
        const cityMonths = this.cityData.byCityAndMonth[cityName] || {};
        const monthlyValues = allMonths.map(m => cityMonths[m] || 0);
        const color = colors[i % colors.length];
        return {
          label: cityName,
          data: monthlyValues,
          borderColor: color,
          backgroundColor: 'transparent',
          borderWidth: 3,
          tension: 0.3,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: color,
          pointBorderColor: '#ffffff',
          pointBorderWidth: 1
        };
      });

      const countyTrends = this;
      const labels = this.cityData.labels;

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
            if (startIndex >= 0 && endIndex >= 0) {
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
              ctx.fillText(period.name, labelX, chartArea.top + 5);
              ctx.fillText('Moratorium', labelX, chartArea.top + 18);
              ctx.restore();
            }
          });

          if (countyTrends.rangeStartIndex !== null && countyTrends.rangeEndIndex !== null) {
            [countyTrends.rangeStartIndex, countyTrends.rangeEndIndex].forEach(idx => {
              if (idx >= 0 && idx < labels.length) {
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
          } else if (countyTrends.currentMonthIndex >= 0 && countyTrends.currentMonthIndex < labels.length) {
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

      this.chart = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
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
                padding: 8,
                font: { size: 13, weight: '500', family: 'DINPro, sans-serif' }
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
                  return `${context.dataset.label}: ${context.parsed.y.toLocaleString()} filings`;
                }
              }
            }
          },
          interaction: { intersect: false, mode: 'index' },
          hover: { mode: 'index', intersect: false }
        }
      });

      const explanationEl = document.querySelector('#countyTrendsDrawer .chart-explanation p i');
      if (explanationEl) {
        const rangeText = this.dataLoader.isInRangeMode()
          ? 'Vertical dashed lines show the date range selected on the map\'s time slider.'
          : 'Vertical dashed line represents the period selected on the map\'s time slider.';
        explanationEl.textContent = rangeText + ' Click a city in the legend above to hide it from the chart.';
      }
    } catch (error) {
      this.showError('Failed to render city chart');
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
      const isRange = this.dataLoader.isInRangeMode();
      const lineText = isRange
        ? 'Vertical dashed lines show the date range selected on the map\'s time slider.'
        : 'Vertical dashed line represents the period selected on the map\'s time slider.';
      if (this.activeTab === 'region') {
        explanationEl.textContent = lineText;
      } else if (this.activeTab === 'city') {
        explanationEl.textContent = lineText + ' Click a city in the legend above to hide it from the chart.';
      } else {
        explanationEl.textContent = lineText + ' Click a county in the legend above to hide it from the chart.';
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
    this.cityData = null;
    this.selectedCities = [];
  }
}

// Make CountyTrends available globally
window.CountyTrends = CountyTrends;
