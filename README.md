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

---

## Getting Started (Local Development)

### Prerequisites

- **VS Code** with the **[Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer)** extension — this is required, not optional (see port note below)
- Credentials for Supabase and Mapbox (obtain from outgoing maintainer — see [Credentials Handoff](#credentials-handoff))
- Git access to the `arc-research-analytics` GitHub organization (see [GitHub Access](#github-access))

### Port 5500 Requirement

> **This app must be served on port 5500.** The Mapbox token used by this project (`evictions` token in the ARC Mapbox account) is locked to a URL allowlist that includes `http://127.0.0.1:5500` and `http://localhost:5500`. Serving on any other port will cause Mapbox to reject the token and the map will not render.
>
> The easiest way to satisfy this requirement is VS Code's **Live Server** extension, which defaults to port 5500. Right-click `index.html` in the VS Code Explorer → **Open with Live Server**, or click **Go Live** in the bottom status bar.

### Setup

1. Clone the repository:
   ```bash
   git clone git@github.com:arc-research-analytics/eviction-tracker.git
   cd eviction-tracker
   ```
2. Copy the config template and fill in your credentials:
   ```bash
   cp js/config.template.js js/config.dev.js
   ```
   Edit `js/config.dev.js`:
   - `SUPABASE_URL` — Supabase project URL
   - `SUPABASE_ANON_KEY` — Supabase anonymous key
   - `MAPBOX_ACCESS_TOKEN` — the `evictions` token from the ARC Mapbox account
   - `START_DATE` — beginning of the time slider (currently `2019-01`)
   - `MAX_DATE` — last month of available data (update this monthly)
3. Open the project folder in VS Code and click **Go Live** in the status bar (or right-click `index.html` → Open with Live Server).
4. The app auto-detects `localhost` and loads `config.dev.js` instead of `config.js`.

`js/config.dev.js` is gitignored and will never be committed.

---

## Deployment

The app deploys automatically to **GitHub Pages** when changes are pushed to `main`. The GitHub Actions workflow (`.github/workflows/deploy.yml`) generates `js/config.js` from repository secrets at deploy time — you do not need to manage `js/config.js` manually for deployments.

**To update the live app:**
```bash
git add <changed files>
git commit -m "your message"
git push origin main
```
The deploy workflow runs automatically and the live site updates within a minute or two.

---

## Monthly Data Update Workflow

Eviction data is updated monthly. The typical workflow is:

1. Receive the new monthly eviction filing data (CSV from court records)
2. Run the data pipeline script to process and upload the new data:
   ```bash
   cd data-hidden/Eviction-Pipeline
   # See pipeline README / comments in eviction_compiler.py for exact steps
   python eviction_compiler.py
   ```
3. Verify the new month appears correctly in the app locally
4. Update `MAX_DATE` in `js/config.js` to the new latest month (e.g., `2026-05`)
5. Commit and push:
   ```bash
   git add js/config.js
   git commit -m "data: update MAX_DATE to 2026-05"
   git push
   ```
   This triggers the deploy workflow and the live app updates automatically.

---

## GitHub Access

The repository is at `https://github.com/arc-research-analytics/eviction-tracker`.

To push changes you need:
1. **Membership in the `arc-research-analytics` GitHub organization** — request an invite from an org admin
2. **Authentication** — either SSH keys or a Personal Access Token:

**SSH (recommended):**
```bash
# Generate a key if you don't have one
ssh-keygen -t ed25519 -C "your_email@example.com"

# Add the public key to your GitHub account:
# GitHub → Settings → SSH and GPG keys → New SSH key
# Paste the contents of ~/.ssh/id_ed25519.pub

# Switch your local remote to SSH
git remote set-url origin git@github.com:arc-research-analytics/eviction-tracker.git

# Test it
ssh -T git@github.com
```

**Personal Access Token (alternative):**
Generate one at GitHub → Settings → Developer Settings → Personal Access Tokens. When prompted for a password during `git push`, use the token instead.

---

## Credentials Handoff

When taking over this project, obtain the following from the outgoing maintainer:

| Credential | Where to find it | Notes |
|---|---|---|
| Supabase URL | Supabase dashboard → Project Settings → API | |
| Supabase anon key | Supabase dashboard → Project Settings → API | |
| Mapbox token | ARC Mapbox account → Tokens | Use the existing `evictions` token — **do not create a new one**, as its URL allowlist is already configured for both localhost:5500 and the GitHub Pages domain |
| GitHub org invite | Ask an `arc-research-analytics` org admin | Needed to push changes |
| GitHub Secrets | GitHub repo → Settings → Secrets and Variables | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `MAPBOX_ACCESS_TOKEN` — must be set for the deploy workflow to generate production config |

---

## Data Pipeline

The `data-hidden/Eviction-Pipeline/eviction_compiler.py` script processes raw eviction records into the format the app expects:

1. Geocodes eviction filings to lat/lon coordinates
2. Performs spatial joins to assign each filing to a census tract, high school statistical area, and hex cell
3. Aggregates filings by geography and month
4. Calculates filing rates using renter-occupied housing unit data
5. Pushes results to Supabase

The `data-hidden/` directory is gitignored and contains source data, intermediate files, and the pipeline scripts. It is not served by the app.

---

## Project Structure

```
index.html              Main application page
js/                     JavaScript modules (loaded sequentially — order matters)
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
  config.template.js    Configuration template (tracked in git)
  config.js             Production config (tracked; generated by CI from secrets)
  config.dev.js         Local dev config (gitignored — create from template)
css/style.css           Application styles
data/                   GeoJSON boundary files
  region_tracts_simp.geojson      Census tract polygons
  region_schools_hires.geojson    High school statistical area polygons
  region_hex.geojson              Hexagonal grid polygons
  region_boundaries.geojson       County boundary lines
  region_mask.geojson             Mask for areas outside the region
  region_labels.geojson           County name labels
  region_cities.geojson           City boundary polygons
assets/                 Images and logos
data-hidden/            Data pipeline scripts and source data (gitignored, not served)
.github/workflows/      GitHub Actions — deploy.yml auto-deploys to GitHub Pages on push to main
CLAUDE.md               Developer notes for Claude Code AI assistant
```

---

## License

This project is licensed under the GNU General Public License v3.0 — see the [LICENSE](LICENSE) file for details.
