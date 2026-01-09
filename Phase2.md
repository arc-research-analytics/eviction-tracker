# Phase 2 Development Plan: Multi-Geography & Custom Range Support

## Overview

This phase expands the Metro Atlanta Eviction Tracker from a single-county (Fulton), tract-only view to a comprehensive 5-county regional application with multiple geography options and flexible time range selection.

## Current State

- **Geography**: Census tracts in Fulton County only
- **Time Selection**: Single month slider (0-112 range)
- **Data Display**: Toggle between raw counts and filing rates
- **Data Source**: Supabase `evictions-tract` table
- **GeoJSON**: `fulton_tracts.geojson`, `fulton_mask.geojson`, `fulton_county.geojson`

## Target State

- **Geography**: 3 options - H3 Hexagons, Census Tracts, High School Attendance Zones
- **Coverage**: 5-county Metro Atlanta region
- **Time Selection**: Single month OR custom date range (cumulative)
- **Data Display**: Filing rate (single month only) OR raw cumulative counts (both modes)
- **Data Source**: Multiple Supabase tables by geography
- **GeoJSON**: Regional files for all 3 geographies

---

## Data Preparation Tasks

### 1. Database Schema Setup

**New Supabase Tables Needed (4 total):**

- `evictions-county` - County-level aggregated data (for County Trends drawer chart)
- `evictions-hex` - H3 hexagon eviction data by month
- `evictions-school` - School zone eviction data by month
- `evictions-tract` - 5-county tract data (expand existing table to include all 5 counties)

**Schema Structure:**

All geography-level eviction tables (`evictions-hex`, `evictions-tract`, `evictions-school`) share the same column structure with housing units integrated:

```sql
-- Example structure for all geography eviction tables
CREATE TABLE evictions_hex (
  id TEXT PRIMARY KEY,                    -- Composite key: "filemonth-hex_id"
  filemonth TEXT NOT NULL,                -- "YYYY-M" format (e.g., "2025-5")
  hex_id TEXT NOT NULL,                   -- Geography identifier
  rocc_hus INTEGER DEFAULT 0,             -- Renter-occupied housing units (denominator)
  totalfilings INTEGER DEFAULT 0,         -- Raw eviction count
  filing_rate NUMERIC                     -- Pre-calculated: (totalfilings / rocc_hus) * 100
);

-- County table for trends drawer (simplified, fewer fields)
CREATE TABLE evictions_county (
  id TEXT PRIMARY KEY,                    -- Composite key: "filemonth-county_name"
  filemonth TEXT NOT NULL,                -- "YYYY-M" format
  county_name TEXT NOT NULL,              -- e.g., "Fulton", "DeKalb", etc.
  totalfilings INTEGER DEFAULT 0          -- County aggregate total
);
```

**Key Fields:**
- `id`: Primary key, format: `"{filemonth}-{geo_id}"` (e.g., "2025-5-13121000100")
- `filemonth`: Keep as "YYYY-M" format for consistency with existing code
- `{geo}_id`: Geography identifier field (hex_id, tract_id, school_id)
- `rocc_hus`: Renter-occupied housing units from ROcc_HUs_*.csv files
- `totalfilings`: Raw eviction count
- `filing_rate`: Pre-calculated (totalfilings / rocc_hus * 100), or NULL if rocc_hus = 0

**Important Notes:**
- Housing unit data is denormalized into each eviction table (not separate tables)
- All geographic data joined BEFORE upload to Supabase
- GeoJSON files remain in local `data/` folder, NOT uploaded to Supabase
- Only tabular data stored in Supabase database

### 2. Data Migration Tasks

**Pre-Processing Steps (Before Supabase Upload):**

1. **Join eviction data with housing units data:**
   - Join `evictions_hex.csv` + `ROcc_HUs_hex.csv` on `hex_id`
   - Join `evictions_schools.csv` + `ROcc_HUs_school.csv` on `school_id`
   - Join `evictions_tracts.csv` + `ROcc_HUs_tract.csv` on `tract_id`

2. **Calculate filing rates:**
   - Formula: `filing_rate = (totalfilings / rocc_hus) * 100`
   - Handle edge cases:
     - If `rocc_hus = 0`: Set `filing_rate = NULL`
     - If `rocc_hus = NULL`: Set `filing_rate = NULL`
     - If `totalfilings = 0`: Set `filing_rate = 0`

3. **Create composite primary keys:**
   - Format: `"{filemonth}-{geo_id}"` (e.g., "2025-5-88754e64dffffff")
   - Ensures uniqueness across months and geographies

**CSV to Supabase Upload:**

1. **Upload processed geography tables:**
   - Processed hex data → `evictions-hex` table
   - Processed school data → `evictions-school` table
   - Processed tract data → `evictions-tract` table
   - County aggregate data → `evictions-county` table

2. **Validation checklist:**
   - [ ] All months present for each geography (2017-01 through 2025-05)
   - [ ] No duplicate id values (primary key constraint)
   - [ ] Filing rates calculated correctly (spot check 10+ records)
   - [ ] NULL filing rates only where rocc_hus = 0
   - [ ] Row counts match source CSV row counts
   - [ ] All geography IDs match GeoJSON feature IDs

**Data Processing Script Requirements:**

Create a data processing script (Python/Node.js) that:
- Reads eviction CSVs and housing unit CSVs
- Performs LEFT JOIN on geography ID field
- Calculates filing_rate with proper NULL handling
- Generates composite primary key (id field)
- Outputs processed CSVs ready for Supabase upload
- Logs any missing/mismatched geography IDs
- Generates data quality report (row counts, NULL counts, min/max values)

**Example Python Script Outline:**

```python
import pandas as pd

# Load eviction and housing data
evictions_hex = pd.read_csv('data/evictions_hex.csv')
rocc_hus_hex = pd.read_csv('data/ROcc_HUs_hex.csv')

# Join on hex_id
merged = evictions_hex.merge(rocc_hus_hex, on='hex_id', how='left')

# Calculate filing rate
merged['filing_rate'] = merged.apply(
    lambda row: (row['totalfilings'] / row['rocc_hus'] * 100)
                if row['rocc_hus'] > 0 else None,
    axis=1
)

# Create composite ID
merged['id'] = merged['filemonth'] + '-' + merged['hex_id']

# Reorder columns for Supabase schema
merged = merged[['id', 'filemonth', 'hex_id', 'rocc_hus', 'totalfilings', 'filing_rate']]

# Export
merged.to_csv('data/processed/evictions_hex_final.csv', index=False)
```

### 3. GeoJSON Files (Local Storage)

**Location:** All GeoJSON files remain in the local `data/` directory and are loaded by the client via fetch requests. They are NOT uploaded to Supabase.

**Existing Regional Files:**
- ✓ `region_hex.geojson` (537K) - H3 hexagon boundaries for 5-county region
- ✓ `region_schools.geojson` (4.9M) - High school attendance zone boundaries
- ✓ `region_tracts.geojson` (6.1M) - Census tract boundaries for 5-county region
- ✓ `region_mask.geojson` (506K) - Regional boundary mask (for visual effect)
- ✓ `region_boundaries.geojson` (857K) - County outline boundaries
- ✓ `region_labels.geojson` (1K) - Optional county labels
- ✓ `region_school_labels.geojson` (16K) - Optional school zone labels

**Architecture:**
- GeoJSON files served as static assets (via local web server or CDN)
- Loaded via JavaScript fetch API
- Joined with Supabase tabular data client-side using geography IDs
- Mapbox GL JS renders features with data-driven styling

**Validation Checklist:**
- [ ] Verify geography IDs in GeoJSON properties match Supabase table geography IDs
  - Example hex GeoJSON property: `"hex_id": "88754e64dffffff"`
  - Must match `hex_id` field in `evictions-hex` table
- [ ] Check coordinate system (must be WGS84/EPSG:4326 for Mapbox GL JS)
- [ ] Test file loading performance (especially 6MB tract and 4.9MB school files)
- [ ] Confirm regional extent matches 5-county boundary
- [ ] Verify no topology errors (self-intersections, gaps, overlaps)
- [ ] Check that all features have required ID property field

---

## Application Architecture Changes

### 4. New Configuration Module

**`js/GeographyConfig.js`** - New module to manage geography-specific settings:

```javascript
class GeographyConfig {
  // Shared color scales (consistent across ALL geographies)
  static COLORS = {
    // For raw counts (both single month and cumulative ranges)
    count: {
      breaks: [0, 10, 25, 60, 100],
      colors: ['#ffffcc', '#fed976', '#fd8d3c', '#e31a1c', '#800026'],
      nullColor: '#cccccc'  // Gray for geographies with 0/NULL housing units
    },
    // For filing rates (single month only)
    rate: {
      breaks: [0, 2, 5, 8, 12],
      colors: ['#ffffcc', '#fed976', '#fd8d3c', '#e31a1c', '#800026'],
      nullColor: '#cccccc'  // Gray for geographies with 0/NULL housing units
    }
  };

  static GEOGRAPHIES = {
    hex: {
      id: 'hex',
      label: 'Hexagons',
      supabaseTable: 'evictions-hex',
      geojsonFile: 'data/region_hex.geojson',
      idField: 'hex_id',          // Must match GeoJSON property AND Supabase column
      layerId: 'hex-fills'
    },
    tract: {
      id: 'tract',
      label: 'Census Tracts',
      supabaseTable: 'evictions-tract',
      geojsonFile: 'data/region_tracts.geojson',
      idField: 'tract_id',        // Must match GeoJSON property AND Supabase column
      layerId: 'tract-fills'
    },
    school: {
      id: 'school',
      label: 'School Zones',
      supabaseTable: 'evictions-school',
      geojsonFile: 'data/region_schools.geojson',
      idField: 'school_id',       // Must match GeoJSON property AND Supabase column
      layerId: 'school-fills'
    }
  };

  static getConfig(geographyId) {
    return this.GEOGRAPHIES[geographyId];
  }

  static getColorScale(displayMode) {
    return this.COLORS[displayMode];
  }
}
```

**Key Design Decisions:**

1. **Consistent color scales**: All 3 geographies use the SAME color breaks and colors
   - Enables direct visual comparison across geography types
   - Simpler legend (no need to explain geography-specific scales)
   - User mental model: "Red is high everywhere"

2. **NULL/zero housing units handling**: Gray color (`#cccccc`)
   - Applied when `rocc_hus = 0` OR `filing_rate = NULL`
   - Visually distinct from data values
   - Prevents misleading zero-rate display

3. **Housing units integrated**: No separate `housingUnitsTable` field
   - All data (evictions + housing units + rates) in single table
   - Simpler queries, fewer table joins

### 5. Enhanced DataLoader Module

**Updates to `js/DataLoader.js`:**

- Add `currentGeography` state (default: 'tract')
- Add `timeMode` state: 'single' | 'range'
- Add `customRange` state: `{ start: 'YY-MM', end: 'YY-MM' }`
- New method: `loadEvictionDataByGeography(geography, month)` - for single month
- New method: `loadCumulativeEvictionData(geography, startMonth, endMonth)` - for ranges
- Update `calculateTotalEvictions()` to respect current geography and time mode
- Update data structure to include `rocc_hus` and `filing_rate` fields (loaded from Supabase)

**Key Logic Changes:**

```javascript
// Single month mode - show either count or rate
if (timeMode === 'single') {
  if (displayMode === 'rate') {
    // Use pre-calculated filing_rate from database
    // If filing_rate is NULL (rocc_hus = 0), show as gray on map
    return feature.filing_rate !== null ? feature.filing_rate : null;
  } else {
    // Show raw totalfilings
    return feature.totalfilings;
  }
}

// Custom range mode - ONLY show cumulative counts, no rates
if (timeMode === 'range') {
  // Sum totalfilings across all months in range
  // No filing rate calculation for ranges (doesn't make statistical sense)
  return cumulativeTotalFilings;
}

// Handle NULL/zero housing units for map styling
function getMapColor(feature, displayMode, timeMode) {
  if (displayMode === 'rate' && timeMode === 'single') {
    // If filing rate is NULL (zero housing units), return gray
    if (feature.filing_rate === null) {
      return '#cccccc';  // Gray color for NULL/no data
    }
    return getColorFromScale(feature.filing_rate, 'rate');
  } else {
    // Count mode (single month or cumulative range)
    return getColorFromScale(feature.totalfilings, 'count');
  }
}
```

**Data Loading Examples:**

```javascript
// Load single month data for a geography
async loadEvictionDataByGeography(geography, month) {
  const config = GeographyConfig.getConfig(geography);
  const supabaseMonth = this.monthUtils.convertToSupabaseFormat(month);

  const { data, error } = await this.supabase
    .from(config.supabaseTable)
    .select('*')  // Includes: id, filemonth, {geo}_id, rocc_hus, totalfilings, filing_rate
    .eq('filemonth', supabaseMonth);

  // Store with geography ID as key
  this.evictionData = {};
  data.forEach(item => {
    const geoId = item[config.idField];
    this.evictionData[geoId] = {
      totalfilings: item.totalfilings || 0,
      rocc_hus: item.rocc_hus || 0,
      filing_rate: item.filing_rate  // May be NULL if rocc_hus = 0
    };
  });
}

// Load cumulative data for date range
async loadCumulativeEvictionData(geography, startMonth, endMonth) {
  const config = GeographyConfig.getConfig(geography);
  // Query all months in range
  const { data, error } = await this.supabase
    .from(config.supabaseTable)
    .select('*')
    .gte('filemonth', startMonth)
    .lte('filemonth', endMonth);

  // Aggregate by geography ID
  this.evictionData = {};
  data.forEach(item => {
    const geoId = item[config.idField];
    if (!this.evictionData[geoId]) {
      this.evictionData[geoId] = { totalfilings: 0 };
    }
    this.evictionData[geoId].totalfilings += (item.totalfilings || 0);
  });
}
```

### 6. New Module: SettingsDrawer.js

**Purpose:** Manage the right-side settings drawer with map options

**Features:**
- Geography selector (radio buttons or dropdown)
- Time mode selector (single month vs. custom range)
- Visibility toggle
- Integration with existing UI

**HTML Structure (add to `index.html`):**

```html
<!-- Map Settings Drawer (slides in from right) -->
<wa-drawer
  label="Map Settings"
  placement="end"
  id="settingsDrawer"
  class="settings-drawer"
  style="--size: 350px"
>
  <div class="settings-content">

    <!-- Geography Selection -->
    <div class="setting-section">
      <h4>Geography Level</h4>
      <wa-radio-group id="geographySelector" value="tract">
        <wa-radio value="hex">Hexagons</wa-radio>
        <wa-radio value="tract">Census Tracts</wa-radio>
        <wa-radio value="school">School Zones</wa-radio>
      </wa-radio-group>
    </div>

    <!-- Time Mode Selection -->
    <div class="setting-section">
      <h4>Time Display Mode</h4>
      <wa-radio-group id="timeModeSelector" value="single">
        <wa-radio value="single">Single Month</wa-radio>
        <wa-radio value="range">Custom Range</wa-radio>
      </wa-radio-group>
      <div class="setting-explanation">
        <small>Custom range shows cumulative eviction totals over the selected period.</small>
      </div>
    </div>

  </div>

  <wa-button slot="footer" variant="brand" data-drawer="close">
    Apply Settings
  </wa-button>
</wa-drawer>

<!-- Settings Button (positioned on map) -->
<wa-button id="settingsBtn" variant="neutral">
  <wa-icon name="gear"></wa-icon> Map Settings
</wa-button>
```

**Class Structure:**

```javascript
class SettingsDrawer {
  constructor(dataLoader, mapManager, uiManager) {
    this.dataLoader = dataLoader;
    this.mapManager = mapManager;
    this.uiManager = uiManager;
    this.drawer = null;
    this.onSettingsChange = null; // Callback
  }

  initialize() {
    // Set up drawer and event listeners
  }

  handleGeographyChange(newGeography) {
    // Update DataLoader geography state
    // Trigger map reload with new geography
  }

  handleTimeModeChange(newMode) {
    // Update DataLoader time mode
    // Transform slider (single → range or vice versa)
    // Update UI elements
  }
}
```

### 7. Slider Component Transformation

**Current:** Single value slider (`<wa-slider>` from Web Awesome)
**Future:** Dual-handle range slider when in "range" mode

**Approach:** Use conditional rendering with Web Awesome components exclusively

Web Awesome is already in use throughout the app for consistent UI/UX. All slider components should continue using Web Awesome library (`<wa-slider>` elements).

```html
<!-- Single Month Mode (shown when timeMode === 'single') -->
<div id="singleSliderContainer">
  <wa-slider
    id="monthSlider"
    class="time-slider"
    label="Select Month:"
    min="0"
    max="112"
    value="112"
  ></wa-slider>
  <div id="sliderLabel">May 2025</div>
</div>

<!-- Custom Range Mode (shown when timeMode === 'range') -->
<div id="rangeSliderContainer" class="hidden">
  <label>Select Date Range:</label>
  <wa-slider
    id="startMonthSlider"
    label="Start Month:"
    min="0"
    max="112"
    value="0"
  ></wa-slider>
  <wa-slider
    id="endMonthSlider"
    label="End Month:"
    min="0"
    max="112"
    value="112"
  ></wa-slider>
  <div id="rangeSliderLabel">Jan 2017 - May 2025</div>
</div>
```

**Implementation Notes:**

- Toggle visibility of `singleSliderContainer` vs `rangeSliderContainer` based on `timeMode`
- Both sliders use same 0-112 range (months since START_DATE)
- Update both slider labels in real-time as user drags
- Validate that end month >= start month
- On mode switch, preserve current month as end of range (or middle of range)
- Continue using existing `MonthUtils` class for slider index ↔ month conversions

### 8. Updated LayerManager Module

**Changes to `js/LayerManager.js`:**

- Support for multiple geography layer types (hex, tract, school)
- Dynamic layer switching (remove old, add new)
- Layer-specific styling based on GeographyConfig
- Handle different ID fields for data joins

**New Methods:**

```javascript
async loadGeographyLayer(geography) {
  const config = GeographyConfig.getConfig(geography);

  // Remove existing geography layers
  this.removeAllGeographyLayers();

  // Load new GeoJSON
  const geojsonData = await fetch(config.geojsonFile).then(r => r.json());

  // Add source
  this.map.addSource(config.id, {
    type: 'geojson',
    data: geojsonData
  });

  // Add fill layer with data-driven styling
  this.addGeographyFillLayer(config);

  // Add outline layer
  this.addGeographyOutlineLayer(config);
}

updateLayerDataExpression(geography, evictionData, displayMode, timeMode) {
  // Build Mapbox expression for color based on:
  // - Geography type
  // - Display mode (count vs rate)
  // - Time mode (single vs range)
  // - Current data
}
```

### 9. UI Updates

**Toggle Switch Behavior:**

Current behavior: Always visible, switches between "count" and "rate"

**Phase 2 behavior:**
- **Single month mode**: Toggle visible, works as before
- **Custom range mode**: Toggle hidden (or disabled), locked to "count" display

```javascript
// In SettingsDrawer or UIManager
updateToggleVisibility(timeMode) {
  const toggle = document.getElementById('showRateSwitch');
  const toggleContainer = document.getElementById('toggleContainer');

  if (timeMode === 'range') {
    // Hide toggle, force count mode
    toggleContainer.style.display = 'none';
    this.dataLoader.setDisplayMode('count');
  } else {
    // Show toggle, allow user choice
    toggleContainer.style.display = 'block';
  }
}
```

**Legend Updates:**

- Legend must adapt to display mode and time mode
- **Consistent color scale** across all 3 geographies (easier comparison)
- Update legend title based on mode:
  - Single month + rate: "Eviction Filing Rate by {Geography}"
  - Single month + count: "Eviction Filings by {Geography}"
  - Custom range + count: "Cumulative Evictions (Jan 2020 - May 2025)"
- Add gray color explanation: "Gray = No housing unit data"
- Update {Geography} text: "Hexagon", "Census Tract", or "School Zone"

**Month Display Updates:**

Current: "Countywide evictions in May 2025: 1,234"

Phase 2:
- Single month: "Regional evictions in May 2025: 1,234"
- Custom range: "Cumulative evictions (Jan 2020 - May 2025): 5,678"

### 10. Popup & Tooltip Updates

**PopupManager Changes:**

- Support for different geography types (hex, tract, school)
- Update chart to show data for selected geography feature
- Adapt popup title based on geography (e.g., "Hexagon Detail" vs "Tract 13121000100")
- Load appropriate time series data from correct Supabase table

**TooltipManager Changes:**

- Update hover tooltip to show data for current geography
- Display appropriate labels (hex ID, tract ID, school name)
- Format values based on display mode and time mode

### 11. County Trends Drawer

**Decision:** Keep as TOP drawer showing county-level data for all geography selections

**Behavior:**
- Drawer slides down from top (current behavior, unchanged)
- Always shows county-level trend lines regardless of selected geography
- Provides consistent regional context across all views
- Data source: `evictions-county` Supabase table

**Rationale:**
- County boundaries are politically/administratively meaningful
- Users benefit from seeing county trends as regional context
- Simpler implementation (no conditional logic based on geography)
- Consistent user experience (drawer behavior doesn't change)

**Updates Needed:**
- Ensure `evictions-county` table includes all 5 counties (not just Fulton)
- Update chart title if needed: "Monthly County Eviction Filings (5-County Region)"
- No major code changes required - existing `CountyTrends.js` module continues to work

### 12. Performance Considerations

**Potential Issues:**

1. **Large GeoJSON files**: 6.1MB tract file, 4.9MB school file
   - **Solution**: Consider vector tiles (Mapbox Tiling Service) for production
   - **Short-term**: Use GeoJSON but monitor performance on slower connections

2. **Database queries for cumulative ranges**:
   - Summing across many months = many rows
   - **Solution**: Server-side aggregation with Supabase functions or views
   - **Alternative**: Client-side aggregation if dataset is manageable

3. **Switching geographies**: Reloading GeoJSON each time
   - **Solution**: Preload all 3 geographies on initial load (if size permits)
   - **Alternative**: Cache loaded geographies, only load once

4. **Map rendering with thousands of features**:
   - Hexagons and tracts can be dense
   - **Solution**: Use Mapbox GL's built-in optimization (automatic at low zooms)
   - Consider clustering or simplification for hex layer

**Performance Testing Checklist:**
- [ ] Test loading time for each geography
- [ ] Test switching between geographies
- [ ] Test range queries with 24+ month ranges
- [ ] Test on mobile devices
- [ ] Test with slow 3G network throttling

---

## Development Workflow

### Phase 2A: Data Preparation (Do First)

1. Create Supabase tables with proper schemas
2. Write data migration scripts
3. Calculate and upload filing rates
4. Upload all CSVs to Supabase
5. Validate data integrity (spot checks, row counts)
6. Test Supabase queries for all geographies and time ranges

### Phase 2B: Core Infrastructure

1. Create `GeographyConfig.js` module
2. Add `SettingsDrawer.js` module
3. Update `DataLoader.js` with geography and time mode support
4. Create conditional slider UI (single vs range)
5. Wire up settings drawer to trigger data/map updates

### Phase 2C: Map & Layer Updates

1. Update `LayerManager.js` for multi-geography support
2. Add layer switching logic
3. Update color scales and styling
4. Test map rendering for all 3 geographies
5. Update regional mask and boundaries

### Phase 2D: UI/UX Polish

1. Update toggle behavior (hide in range mode)
2. Update legend dynamically
3. Update month/range display
4. Update popup manager for new geographies
5. Update tooltip manager for new geographies
6. Test county trends drawer with new data sources

### Phase 2E: Testing & Optimization

1. End-to-end testing of all geography/mode combinations
2. Performance optimization (caching, query optimization)
3. Mobile responsiveness testing
4. Accessibility testing (keyboard navigation, screen readers)
5. Cross-browser testing

---

## Suggested Improvements & Considerations

### Additional Features to Consider

1. **Export functionality**: Allow users to download data for selected geography/time range as CSV

2. **Deep linking**: URL parameters to share specific geography/time selections
   - Example: `?geography=hex&mode=range&start=2020-01&end=2025-05`

3. **Compare mode**: Show two time periods side-by-side or as difference map
   - Could replace range mode or be a third option

4. **School zone labels**: Use `region_school_labels.geojson` to show school names on map

5. **County labels**: Use `region_labels.geojson` for county names

6. **Zoom-based geography**: Auto-switch to more detailed geography as user zooms in
   - Far out: Hexagons
   - Medium: School zones
   - Close: Census tracts

7. **Animation mode**: Automatically cycle through months to show temporal patterns

8. **Bookmarks**: Save favorite views (geography + time range combinations)

### Data Quality Considerations

1. **Missing data handling**: If a geography has no housing unit data (rocc_hus = 0 or NULL)
   - **Map display**: Show as gray (`#cccccc`)
   - **Filing rate**: Store as NULL in database
   - **Popup**: Display message "No housing unit data available"
   - **Calculations**: Exclude from regional totals/averages
   - **Tooltip**: Show "N/A" for filing rate

2. **Zero housing units**: When rocc_hus = 0
   - **Database**: `filing_rate = NULL` (cannot divide by zero)
   - **Map color**: Gray (`#cccccc`)
   - **Legend**: Include gray with explanation "No housing unit data"
   - **Popup note**: "This area has no renter-occupied housing units recorded."

3. **Data currency**: How to communicate data freshness to users?
   - Add "Last updated: [date]" to header or about dialog
   - Show data availability range in settings drawer

4. **Data accuracy disclaimer**: Eviction filing data nuances
   - Add explanation that filings ≠ completed evictions
   - Note any data collection methodology limitations
   - Link to data source documentation

### Accessibility Improvements

1. **Keyboard navigation**: Ensure all controls accessible via keyboard
   - Settings drawer open/close
   - Geography selection
   - Time mode selection
   - Slider controls

2. **Screen reader support**:
   - ARIA labels for all interactive elements
   - Announce data changes when geography/time changes
   - Accessible map feature descriptions

3. **Color contrast**: Verify WCAG compliance for all color scales

4. **Focus indicators**: Clear focus states for all interactive elements

### Mobile UX Considerations

1. **Drawer positioning**: Right drawer may not work well on mobile
   - Consider bottom sheet on mobile
   - Or modal dialog

2. **Slider interaction**: Range sliders can be fiddly on mobile
   - Consider date picker inputs as alternative
   - Or separate start/end dropdowns

3. **Popup handling**: Large popups may cover entire screen on mobile
   - Consider collapsible sections
   - Or separate detail view

4. **Touch targets**: Ensure all buttons meet minimum touch target size (44x44px)

### Future Phase Ideas

**Phase 3: Demographics & Context Layers**
- Overlay demographic data (race, income, housing tenure)
- Compare eviction rates across demographic groups
- Add context layers (transit, employment centers)

**Phase 4: Predictive Analytics**
- Forecast eviction trends based on economic indicators
- Identify high-risk areas
- Alert system for rapid changes

**Phase 5: Intervention Tracking**
- Track locations of eviction prevention programs
- Measure program effectiveness
- Resource allocation optimization

---

## Technical Debt & Migration Notes

### Deprecations

1. **Fulton-only files**: After Phase 2, these can be archived or removed:
   - `data/fulton_tracts.geojson`
   - `data/fulton_mask.geojson`
   - `data/fulton_county.geojson`

2. **Single-geography assumptions**: Many hard-coded references to "tract"
   - Search codebase for "tract" and make geography-agnostic
   - Update variable names: `tractId` → `featureId` or `geographyId`

### Configuration Updates

1. **`js/config.js` updates**:
   - Add default geography setting
   - Add default time mode setting
   - Add feature flags for Phase 2 features (gradual rollout)

```javascript
const CONFIG = {
  supabase: { /* ... */ },
  mapbox: { /* ... */ },
  startDate: '2017-01',
  maxDate: '2025-05',
  // NEW Phase 2 settings
  defaultGeography: 'tract',  // 'hex', 'tract', or 'school'
  defaultTimeMode: 'single',   // 'single' or 'range'
  enableGeographySelector: true,
  enableCustomRange: true
};
```

### Database Migrations

**RLS (Row Level Security) Policies:**
- Ensure all new tables have appropriate RLS policies
- Test anonymous access to all tables

**Indexes:**
- Add indexes on `filemonth` for all evictions tables
- Add indexes on geography ID fields (hex_id, school_id, tract_id)
- Consider composite indexes for common queries

```sql
CREATE INDEX idx_evictions_hex_month ON evictions_hex(filemonth);
CREATE INDEX idx_evictions_hex_id ON evictions_hex(hex_id);
CREATE INDEX idx_evictions_hex_month_id ON evictions_hex(filemonth, hex_id);
```

---

## Success Metrics

### User Experience Metrics

- [ ] All 3 geographies load successfully
- [ ] Geography switching completes in < 2 seconds
- [ ] Single month → range mode transition is smooth
- [ ] Filing rates display correctly for single month mode
- [ ] Cumulative totals calculate correctly for range mode
- [ ] Toggle behavior works as expected (hidden in range mode)
- [ ] Legends update dynamically for all combinations
- [ ] Popups show correct data for all geographies
- [ ] Mobile experience is usable on phones < 400px width

### Data Quality Metrics

- [ ] All CSV data successfully uploaded to Supabase
- [ ] Filing rates match manual calculations (spot check)
- [ ] Cumulative totals match sum of individual months (spot check)
- [ ] No missing months in any geography
- [ ] GeoJSON feature IDs match database geography IDs 100%

### Performance Metrics

- [ ] Initial load time < 3 seconds on 4G
- [ ] Geography switch < 2 seconds
- [ ] Range query (12 months) < 1 second
- [ ] Range query (24 months) < 2 seconds
- [ ] Map remains interactive during data loading
- [ ] No memory leaks when switching geographies repeatedly

---

## Decisions Made & Remaining Questions

### ✓ Resolved Decisions

1. **Filing rates for custom ranges**: ✓ RESOLVED
   - Custom ranges show ONLY cumulative counts, no filing rate
   - Statistically clearer and more meaningful

2. **County trends drawer**: ✓ RESOLVED
   - Keep as TOP drawer showing county-level data for ALL geographies
   - Provides consistent regional context

3. **Color scale normalization**: ✓ RESOLVED
   - **Consistent color scales across ALL geographies**
   - Enables easy visual comparison
   - Simpler legend and user mental model

4. **Zero housing units handling**: ✓ RESOLVED
   - Show as gray (`#cccccc`) on map
   - `filing_rate = NULL` in database
   - Include explanation in legend and popup

5. **GeoJSON storage**: ✓ RESOLVED
   - GeoJSON files remain local in `data/` folder
   - Only tabular data stored in Supabase
   - Client-side join of geometry + data

6. **Housing units storage**: ✓ RESOLVED
   - Integrated as columns in eviction tables (not separate tables)
   - Denormalized structure: rocc_hus + filing_rate in same table

7. **UI component library**: ✓ RESOLVED
   - Use Web Awesome exclusively for all UI widgets
   - Consistent with existing implementation

### ❓ Questions Still to Resolve

1. **Default view**: What should users see when first loading the app?
   - Current: Census tracts, single month, latest month, rate view
   - Keep these defaults? Or change to count view by default?
   - **Recommendation**: Keep existing defaults

2. **URL/Route structure**: Should Phase 2 add URL parameters?
   - Would enable sharing specific views: `?geography=hex&mode=range&start=2020-01&end=2025-05`
   - Adds complexity but improves shareability
   - **Recommendation**: Add URL params in Phase 2B

3. **Backwards compatibility**: If adding URL params, should old bookmarks still work?
   - **Recommendation**: Yes - load with defaults if params missing

4. **Data refresh cadence**: How often will data be updated?
   - Monthly? Quarterly?
   - Important for caching strategy and "last updated" messaging
   - Affects whether to build automated data pipeline

5. **Vector tiles vs GeoJSON**: Should Phase 2 migrate to vector tiles?
   - GeoJSON files are large (6MB for tracts)
   - Vector tiles would improve performance but add deployment complexity
   - **Recommendation**: Stick with GeoJSON for Phase 2, monitor performance

6. **Geography ID field naming**: Should all tables use consistent naming?
   - Current plan: `hex_id`, `tract_id`, `school_id` (different per table)
   - Alternative: All use `geo_id` with geography type in separate column
   - **Recommendation**: Keep geography-specific field names (clearer, less ambiguous)

---

## Development Branch Strategy

```bash
# Create Phase 2 branch
git checkout -b phase2-multi-geography

# Consider sub-branches for major pieces
git checkout -b phase2/data-migration
git checkout -b phase2/settings-drawer
git checkout -b phase2/range-slider
git checkout -b phase2/geography-switching
```

**Merge Strategy:**
- Complete data migration first (Phase 2A)
- Then feature branches can work in parallel
- Merge to `phase2-multi-geography` for integration testing
- Final merge to `main` after full QA

---

## Estimated Task Breakdown

**Phase 2A: Data Preparation** (~8-12 hours)
- Create Supabase tables: 2 hours
- Write migration scripts: 3 hours
- Upload and validate data: 2 hours
- Calculate filing rates: 2 hours
- Test queries: 2 hours

**Phase 2B: Core Infrastructure** (~12-16 hours)
- GeographyConfig module: 2 hours
- SettingsDrawer module: 4 hours
- DataLoader updates: 4 hours
- Slider UI updates: 3 hours
- Integration and testing: 3 hours

**Phase 2C: Map & Layer Updates** (~10-14 hours)
- LayerManager updates: 5 hours
- Layer switching logic: 3 hours
- Styling and color scales: 3 hours
- Testing all geographies: 3 hours

**Phase 2D: UI/UX Polish** (~10-12 hours)
- Toggle behavior: 2 hours
- Legend updates: 3 hours
- Month/range display: 2 hours
- Popup/tooltip updates: 3 hours
- County trends testing: 2 hours

**Phase 2E: Testing & Optimization** (~8-10 hours)
- End-to-end testing: 4 hours
- Performance optimization: 3 hours
- Mobile/accessibility testing: 3 hours

**Total estimated time: 48-64 hours**

Note: These are development hours estimates. Actual calendar time will depend on your schedule and priorities. Testing and iteration may add additional time.

---

## Next Steps

1. **Review and refine this plan** - Are there aspects I missed or misunderstood?

2. **Prioritize data preparation** - Getting data into Supabase should be first task

3. **Create Phase 2 git branch** - Start with clean slate

4. **Set up development environment** - Ensure you can test locally with new data

5. **Start with Phase 2A** - Data foundation must be solid before building features

6. **Iterate and test frequently** - Don't wait until end to test integration

---

## Summary of Key Decisions

This plan has been refined based on your requirements. Here are the confirmed decisions:

### Data Architecture
- ✓ **4 Supabase tables only**: evictions-county, evictions-hex, evictions-tract, evictions-school
- ✓ **Housing units integrated**: rocc_hus column in each eviction table (not separate tables)
- ✓ **Pre-calculated filing rates**: stored in filing_rate column
- ✓ **GeoJSON files local**: remain in data/ folder, not uploaded to Supabase
- ✓ **Client-side joins**: geography + eviction data joined in browser

### UI/UX Design
- ✓ **County Trends drawer**: stays as TOP drawer, shows county data for all geographies
- ✓ **Settings drawer**: RIGHT side drawer for geography/time mode selection
- ✓ **Consistent color scales**: same breaks/colors across all 3 geographies
- ✓ **Gray for missing data**: #cccccc for zero/NULL housing units
- ✓ **Web Awesome UI**: all widgets use Web Awesome library exclusively
- ✓ **Dual slider approach**: conditional rendering of single vs. range sliders

### Display Logic
- ✓ **Single month mode**: toggle between filing rate OR raw count
- ✓ **Custom range mode**: ONLY show cumulative count (no rate)
- ✓ **Toggle visibility**: hidden/disabled in range mode
- ✓ **Dynamic legend**: adapts to geography, display mode, and time mode

### Implementation Approach
- ✓ **Phase 2A first**: data preparation before any coding
- ✓ **Modular architecture**: new GeographyConfig + SettingsDrawer modules
- ✓ **Progressive enhancement**: keep existing features working
- ✓ **48-64 hour estimate**: realistic timeline for full implementation

## Final Thoughts

This is an ambitious and well-thought-out expansion! The key architectural decisions are:

1. **Separation of concerns**: GeographyConfig centralizes geography-specific logic
2. **Flexible time modes**: Single vs. range is clear user mental model
3. **Smart data display**: Showing rates only when meaningful (single month)
4. **Progressive enhancement**: Keep existing features working while adding new ones
5. **Consistent user experience**: Same color scales, UI patterns, and behaviors across all modes

The trickiest parts will likely be:
- Getting the range slider UX right (two separate sliders with validation)
- Ensuring smooth geography switching without janky reloads
- Performance optimization for large GeoJSON files (6MB tracts, 4.9MB schools)
- Maintaining legend/UI updates across all mode combinations (3 geographies × 2 time modes × 2 display modes)

But the foundation you've built is solid, and the modular architecture will make these additions cleaner than they might otherwise be. The decision to keep housing units in the same table simplifies queries significantly, and using consistent color scales makes the UX much more intuitive.

The plan is ready for implementation. Start with Phase 2A (data preparation), and the rest will follow logically from there!
