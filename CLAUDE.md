# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Application Overview

This is a Metro Atlanta Eviction Tracker - a web-based data visualization application that displays eviction data on an interactive map. The app uses Mapbox for mapping, Supabase for data storage, and Chart.js for trends visualization.

## Configuration

The application uses environment-specific configuration:

- `js/config.template.js` - Template with placeholder variables for deployment
- `js/config.dev.js` - Development configuration (not in git)
- `js/config.js` - Production configuration (not in git)

Configuration includes:

- Supabase URL and anonymous key
- Mapbox access token
- Date range configuration (START_DATE and MAX_DATE)

## Architecture

### Module Loading System

The application uses a sequential module loading system in `index.html`. Modules must load in this specific order:

1. MonthUtils.js
2. DataLoader.js
3. UIManager.js
4. PopupManager.js
5. TooltipManager.js
6. CountyTrends.js
7. LayerManager.js
8. CursorManager.js
9. InteractionManager.js
10. MapManager.js
11. MapTooltipHandler.js
12. app.js

### Core Modules

- **EvictionApp** (`app.js`) - Main orchestrator that coordinates all modules
- **DataLoader** - Handles Supabase data loading, month management, geography type, display mode, and range mode state
- **MapManager** - Coordinates map functionality and sub-managers (LayerManager, TooltipManager, InteractionManager, CursorManager)
- **UIManager** - Manages UI components, loading states, and month display
- **PopupManager** - Handles location detail popups with historical trend charts
- **MapTooltipHandler** - Handles map hover tooltips showing filing count or rate
- **CountyTrends** - Manages county-level trend visualization in drawer
- **MonthUtils** - Utility class for month format conversions and date calculations

### Geography System

The app supports three geographic levels, toggled by the user:

- **tract** - Census tracts (default). Table: `evictions-tract`, ID field: `tractid`
- **school** - High School Statistical Areas. Table: `evictions-school`, ID field: `school_id` (matches `ShortLabel` in GeoJSON)
- **hex** - Hexagonal grid. Table: `evictions-hex`, ID field: `hex_id`

Geography configuration is defined in `DataLoader.geographyConfig`.

### Display Modes

- **count** - Raw eviction filing counts (`totalfilings`)
- **rate** - Filing rate as a percentage (`filing-rate` field, stored as decimal, multiplied by 100 for display)

### Time Slider Modes

- **Single Month** - Slider selects one month; charts show a single dashed vertical line
- **Custom Range** - Slider selects a start/end range; charts show two dashed vertical lines at range boundaries. The popup chart fills the area between lines with semi-transparent gray; the County Trends chart does not (to avoid confusion with moratorium shading).

### Data Flow

1. App initializes Supabase client and DataLoader
2. DataLoader fetches available months from database
3. Initial month is set from slider value or defaults to latest
4. Map loads geographic boundaries from GeoJSON files in `data/`
5. Eviction data is loaded from the appropriate Supabase table based on geography type
6. Map layers are updated with eviction data styling (choropleth by count or rate)

### Month Format Handling

The app uses multiple month formats:

- Internal/database format: "YYYY-MM" (e.g., "2025-05" for May 2025)
- Human readable: "May 2025"
- Slider uses 0-based index from START_DATE

Note: Internal and Supabase formats are now both "YYYY-MM" (zero-padded). The `convertToSupabaseFormat` and `convertFromSupabaseFormat` methods in MonthUtils exist for historical reasons but effectively pass through.

## Development Commands

This is a client-side only application with no build process. Development is done by:

1. Setting up configuration files (`js/config.dev.js`)
2. Serving files with a local web server
3. The app automatically detects localhost and loads development config

## Database Schema

The app connects to Supabase with these tables:

- `evictions-tract` - Census tract level eviction data by month
- `evictions-school` - High school statistical area level eviction data by month
- `evictions-hex` - Hexagonal grid level eviction data by month
- `evictions-county` - County-level aggregated data by month (used by CountyTrends)

Key fields (shared across geography tables):

- `filemonth` - Month in "YYYY-MM" format
- `totalfilings` - Number of eviction filings
- `filing-rate` - Filing rate as a decimal (filings / renter-occupied housing units)

Geography-specific ID fields:

- `tractid` - Census tract GEOID (e.g., "13121007810")
- `school_id` - School name matching `ShortLabel` in GeoJSON (e.g., "Ronald E. McNair")
- `hex_id` - Hexagon identifier

## Data Pipeline

The `data-hidden/Eviction-Pipeline/eviction_compiler.py` script processes raw eviction data:

1. Geocodes eviction records to lat/lon coordinates
2. Performs spatial joins to assign evictions to tracts, school zones, and hexagons
3. Aggregates filings by geography and month
4. Calculates filing rates using renter-occupied housing unit data from CSVs (`ROcc_HUs_tract.csv`, `ROcc_HUs_school.csv`, etc.)
5. Pushes aggregated data to Supabase tables

**Important:** The `ShortLabel` property in the school GeoJSON is the join key used throughout the pipeline. It must match across the GeoJSON files, renter housing CSVs, and Supabase data.

## File Structure

- `index.html` - Main HTML file with module loading
- `js/` - All JavaScript modules
- `css/style.css` - Application styles
- `data/` - GeoJSON files for map boundaries
  - `region_tracts_simp.geojson` - Simplified census tract polygons
  - `region_schools_hires.geojson` - High school statistical area polygons
  - `region_hex.geojson` - Hexagonal grid polygons
  - `region_boundaries.geojson` - County boundary lines
  - `region_mask.geojson` - Mask overlay for areas outside the region
  - `region_labels.geojson` - County name labels
- `data-hidden/` - Processing scripts, source data, and pipeline code (not served)
- `assets/` - Images and logos

## Debugging Utilities

The app exposes several debugging functions on the global window object:

- `window.testSlider(index)` - Test slider label conversion
- `window.debugDataLoading(month)` - Compare data loading methods
- `window.checkCurrentMapData()` - Inspect current map state
- `window.testRLS()` - Test database row-level security
- `window.testDatabase()` - Comprehensive database connection test
