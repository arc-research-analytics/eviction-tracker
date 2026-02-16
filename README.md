# Metro Atlanta Eviction Tracker

A web-based data visualization application that maps eviction filings across the Metro Atlanta region. Users can explore eviction patterns by census tract, high school statistical area, or hexagonal grid, viewing either raw filing counts or filing rates over time.

## Features

- **Interactive choropleth map** powered by Mapbox, showing eviction intensity by color
- **Three geographic levels** — Census tracts, High School Statistical Areas, and hexagonal grid
- **Two display modes** — Raw filing counts or filing rates (filings per renter-occupied housing unit)
- **Time slider** — Browse eviction data month by month, or select a custom date range
- **Trend charts** — Click any area to see its historical eviction trend in a popup sparkline
- **County Trends drawer** — Compare filing trends across all five Metro Atlanta counties (Fulton, DeKalb, Gwinnett, Cobb, Clayton) with moratorium period shading
- **Data download** — Export the currently displayed data as CSV

## Tech Stack

- **[Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/)** — Map rendering and interaction
- **[Supabase](https://supabase.com/)** — PostgreSQL database and API for eviction data
- **[Chart.js](https://www.chartjs.org/)** — Trend line charts in popups and the county trends drawer
- **[Web Awesome](https://www.webawesome.com/)** — UI components (buttons, drawers, sliders, tooltips)

No build process — the app is plain HTML, CSS, and JavaScript served statically.

## Getting Started

### Prerequisites

- A Supabase project with eviction data loaded (see [Data Pipeline](#data-pipeline))
- A Mapbox access token

### Setup

1. Clone the repository
2. Copy `js/config.template.js` to `js/config.dev.js` and fill in your credentials:
   - Supabase URL and anonymous key
   - Mapbox access token
   - `START_DATE` and `MAX_DATE` for the time slider range
3. Serve the project with any static file server (e.g., `python -m http.server`, VS Code Live Server)
4. Open in a browser — the app auto-detects `localhost` and loads the dev config

For production, create `js/config.js` with production credentials. Neither config file is tracked in git.

## Data Pipeline

The `data-hidden/Eviction-Pipeline/eviction_compiler.py` script processes raw eviction records into the format the app expects:

1. Geocoded eviction filings to lat/lon coordinates
2. Performs spatial joins to assign each filing to a census tract, high school statistical area, and hex cell
3. Aggregates filings by geography and month
4. Calculates filing rates using renter-occupied housing unit data
5. Pushes results to Supabase

## Project Structure

```
index.html              Main application page
js/                     JavaScript modules (loaded sequentially)
  app.js                Main orchestrator
  DataLoader.js         Supabase data loading and state management
  MapManager.js         Map coordination and sub-managers
  UIManager.js          UI components and loading states
  PopupManager.js       Tract/area detail popups with trend charts
  CountyTrends.js       County trends drawer visualization
  MonthUtils.js         Month format conversions and date math
  MapTooltipHandler.js  Hover tooltip display
  LayerManager.js       Map layer management
  InteractionManager.js Map click/hover event handling
  CursorManager.js      Map cursor state
  TooltipManager.js     Tooltip positioning
  config.template.js    Configuration template
css/style.css           Application styles
data/                   GeoJSON boundary files
  region_tracts_simp.geojson      Census tract polygons
  region_schools_hires.geojson    High school statistical area polygons
  region_hex.geojson              Hexagonal grid polygons
  region_boundaries.geojson       County boundary lines
  region_mask.geojson             Mask for areas outside the region
  region_labels.geojson           County name labels
assets/                 Images and logos
data-hidden/            Data pipeline scripts and source data (not served)
```

## License

This project is licensed under the GNU General Public License v3.0 — see the [LICENSE](LICENSE) file for details.
