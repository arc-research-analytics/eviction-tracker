# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Application Overview

This is a Metro Atlanta Eviction Tracker - a web-based data visualization application that dis`play`s eviction data on an interactive map. The app uses Mapbox for mapping, Supabase for data storage, and Chart.js for trends visualization.

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
- **DataLoader** - Handles Supabase data loading and month management
- **MapManager** - Coordinates map functionality and sub-managers (LayerManager, TooltipManager, InteractionManager, CursorManager)
- **UIManager** - Manages UI components, loading states, and month display
- **PopupManager** - Handles tract detail popups with charts
- **CountyTrends** - Manages county-level trend visualization in drawer
- **MonthUtils** - Utility class for month format conversions and date calculations

### Data Flow

1. App initializes Supabase client and DataLoader
2. DataLoader fetches available months from database
3. Initial month is set from slider value or defaults to latest
4. Map loads tract boundaries and county data from GeoJSON files
5. Eviction data is loaded from Supabase `evictions-tract` table
6. Map layers are updated with eviction data styling

### Month Format Handling

The app uses multiple month formats:

- Internal format: "YY-MM" (e.g., "25-05" for May 2025)
- Supabase format: "YYYY-M" (e.g., "2025-5" for May 2025)
- Human readable: "May 2025"
- Slider uses 0-based index from START_DATE

## Development Commands

This is a client-side only application with no build process. Development is done by:

1. Setting up configuration files (`js/config.dev.js`)
2. Serving files with a local web server
3. The app automatically detects localhost and loads development config

## Database Schema

The app connects to Supabase with these tables:

- `evictions-month` - County-level aggregated data by month
- `evictions-tract` - Census tract level eviction data by month

Key fields:

- `filemonth` - Month in "YYYY-M" format
- `tractid` - Census tract identifier
- `totalfilings` - Number of eviction filings

## File Structure

- `index.html` - Main HTML file with module loading
- `js/` - All JavaScript modules
- `css/style.css` - Application styles
- `data/` - GeoJSON files for map boundaries
- `data-hidden/` - Processing scripts and source data (not served)
- `assets/` - Images and logos

## Debugging Utilities

The app exposes several debugging functions on the global window object:

- `window.testSlider(index)` - Test slider label conversion
- `window.debugDataLoading(month)` - Compare data loading methods
- `window.checkCurrentMapData()` - Inspect current map state
- `window.testRLS()` - Test database row-level security
- `window.testDatabase()` - Comprehensive database connection test
