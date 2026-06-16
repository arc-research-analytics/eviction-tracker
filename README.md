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

## Pipeline Setup (First Time)

This section is for anyone setting up the data pipeline on a new machine. You do **not** need to set up the frontend (VS Code Live Server, Mapbox, etc.) to run monthly data updates — the pipeline is a standalone Python script that reads local files and writes to Supabase.

### 1. Clone the repo

```bash
git clone git@github.com:<org>/eviction-tracker.git
cd eviction-tracker
```

You will need push access to the repo — the pipeline script auto-commits and pushes the updated config after each successful run. Set up SSH authentication with GitHub if you haven't already (GitHub → Settings → SSH and GPG keys).

### 2. Set up a Python environment

You need Python 3.9+ with a handful of packages. Use whichever environment manager you prefer:

**conda (recommended — avoids common geopandas/GDAL install issues):**
```bash
conda create -n evictions python=3.11
conda activate evictions
conda install pandas geopandas pyarrow
pip install supabase
```

**pip + venv:**
```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install pandas geopandas pyarrow supabase
```

> Note: `geopandas` can be difficult to install via pip on some systems due to GDAL dependencies. If `pip install geopandas` fails, try the conda approach or see the [geopandas installation docs](https://geopandas.org/en/stable/getting_started/install.html).

Required packages and why:
| Package | Purpose |
|---|---|
| `pandas` | Data loading, cleaning, aggregation |
| `geopandas` | Spatial joins (assigning evictions to tracts/schools/hexes) |
| `pyarrow` | Reading Eviction Lab `.parquet` files |
| `supabase` | Uploading aggregated data to the database |

### 3. Get `el_master.csv`

The compiled historical record of all eviction filings is **not in the repo**. Download `el_master.csv` from the **`WW Handoff`** folder under **`Eviction Tracker Materials`** on the ARC shared drive and place it here:

```
data-hidden/Eviction-Pipeline/From_EL/el_master.csv
```

Do not skip this step. Running the pipeline without this file will wipe all historical data from the database. After the first run the script keeps the file updated automatically.

### 4. Configure credentials

The pipeline authenticates to Supabase using a static API key — no ongoing login is required. You need two values: the project URL and the service role key.

**Get your credentials from the Supabase dashboard:**
1. Accept the Supabase project invite from the outgoing maintainer (you'll receive an email)
2. Log into [supabase.com](https://supabase.com) and open the eviction tracker project
3. Go to **Project Settings** (gear icon, bottom of left sidebar) → **API**
4. Copy the **Project URL** — this is your `SUPABASE_URL`
5. Under **Project API keys**, copy the **`service_role`** key — this is your `SUPABASE_KEY`

> **Important:** There are two keys listed — `anon` (public) and `service_role` (secret). The pipeline requires the `service_role` key. The anon key will not have sufficient permissions to delete and re-insert data.

**Create your local `.env` file:**
```bash
cp data-hidden/Eviction-Pipeline/.env.example data-hidden/Eviction-Pipeline/.env
```

Open `.env` and paste in the two values:
```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your-service-role-key-here
```

This file is gitignored and will never be committed. If the service role key is ever rotated by an admin, return to Project Settings → API to retrieve the new key and update this file.

### 5. Do a dry run

Before running the pipeline for real, set `SKIP_SUPABASE = True` near the top of `eviction_compiler.py` (around line 129). This lets the script run the full data processing without touching the database, so you can confirm your environment is set up correctly.

```bash
cd data-hidden/Eviction-Pipeline
python eviction_compiler.py
```

If it completes without errors, set `SKIP_SUPABASE = False` and you're ready for live runs.

---

## Monthly Data Update Workflow

Eviction data is updated monthly. The typical workflow is:

1. Obtain the new monthly eviction filing data from Eviction Lab (parquet or CSV format).
2. Drop the file into `data-hidden/Eviction-Pipeline/From_EL/`.
3. Run the pipeline script:
   ```bash
   cd data-hidden/Eviction-Pipeline
   python eviction_compiler.py
   ```
   The script handles everything automatically: it merges the new file into `el_master.csv`, performs spatial joins, aggregates by geography, determines the new `MAX_DATE`, updates `js/config.template.js` and `js/config.js`, pushes data to Supabase, and commits + pushes the config change to git.
4. Verify the new month appears correctly in the live app after the GitHub Actions deploy completes (usually within 1–2 minutes of the push).

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

1. Loads all historical eviction data from `el_master.csv` (the compiled master record — see below)
2. Merges in any new Eviction Lab files dropped into `From_EL/`, deduplicates, and updates `el_master.csv`
3. Performs spatial joins to assign each filing to a census tract, high school statistical area, and hex cell
4. Aggregates filings by geography and month
5. Calculates filing rates using renter-occupied housing unit data
6. Pushes results to Supabase

### el_master.csv — Critical Dependency

`el_master.csv` is the compiled historical record of all eviction filings from January 2019 to present. It is **not tracked in git** because of its size (~45 MB, ~900k records). The pipeline requires this file to be present before the first run — without it, running the script will process only the newly dropped file and will overwrite all historical data in Supabase.

**Where to get it:** The file is stored in the **`WW Handoff`** folder under **`Eviction Tracker Materials`** on the ARC shared drive. Download it and place it at:

```
data-hidden/Eviction-Pipeline/From_EL/el_master.csv
```

After the first run the script keeps this file updated automatically.

### Other pipeline dependencies (in `data-hidden/`, tracked in git)

- `ROcc_HUs_tract.csv`, `ROcc_HUs_school.csv`, `ROcc_HUs_hex.csv`, `ROcc_HUs_city.csv`, `ROcc_HUs_county.csv` — Renter-occupied housing unit counts by geography, used to calculate filing rates
- `region_tracts_hires.geojson`, `region_schools_hires.geojson` — High-resolution boundary files used for spatial joins (the simplified versions in `data/` are for map display only)

The `data-hidden/Eviction-Pipeline/.env` file holds Supabase credentials and is gitignored. Copy `.env.example` to `.env` and fill in your credentials to run the pipeline locally.

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

## Repo Migration Checklist

This section documents the steps required to complete the transition from the current public repo (`arc-research-analytics/eviction-tracker`) to a new private repo on a different GitHub account, with the old public URL redirecting to the new one.

### Step 1 — Archive `el_master.csv` to shared storage
- [ ] Copy `data-hidden/Eviction-Pipeline/From_EL/el_master.csv` to the **`WW Handoff`** folder under **`Eviction Tracker Materials`** on the ARC shared drive (so a successor can retrieve it per the instructions in the [Data Pipeline](#data-pipeline) section above)

### Step 2 — Create the new private repo
- [ ] Create a new private repository on the destination GitHub account
- [ ] Add the new repo as a remote and push all current code: `git remote add new-origin <url> && git push new-origin main`
- [ ] Confirm the full commit history is present on the new repo before proceeding

### Step 3 — Restructure `.gitignore` on the new repo
The current `.gitignore` blanket-ignores all of `data-hidden/`. On the new private repo, only credentials and large/regenerable data files should be ignored. Replace the `data-hidden/` entry with these targeted rules:

```
# Credentials
data-hidden/Eviction-Pipeline/.env

# Large raw data files (regenerable or too large to track)
data-hidden/Eviction-Pipeline/From_EL/
data-hidden/Eviction-Pipeline/From_FultonAPI/all_fulton_props.csv
data-hidden/Eviction-Pipeline/From_FultonAPI/Assessor_Fulton.csv
data-hidden/Eviction-Pipeline/From_FultonAPI/Apartments_Fulton.csv
data-hidden/Eviction-Pipeline/fulton_geocoded.csv
data-hidden/evictions_*.csv
data-hidden/Fulton.csv
data-hidden/fulton-export.csv
data-hidden/eviction_month_summary.csv
data-hidden/eviction_tract_summary.csv
```

This makes the pipeline script, ROcc CSVs, and hires GeoJSON trackable so a future maintainer who clones the repo has everything needed to run the pipeline (except credentials and the master CSV).

### Step 4 — Add `.env.example`
- [ ] Create `data-hidden/Eviction-Pipeline/.env.example` with placeholder values:
  ```
  # Supabase credentials — obtain from Supabase project settings > API
  SUPABASE_URL=https://your-project-id.supabase.co
  SUPABASE_KEY=your-service-role-key-here
  ```
- [ ] Commit and push this file to the new repo

### Step 5 — Remove the legacy Fulton API pipeline
The `From_FultonAPI/` directory and `fulton_geocoded.csv` are no longer used by `eviction_compiler.py` (Eviction Lab now covers Fulton County). Do not port these to the new repo. If they were accidentally pushed, remove them:
- [ ] Delete `data-hidden/Eviction-Pipeline/From_FultonAPI/` (entire directory)
- [ ] Delete `data-hidden/Eviction-Pipeline/fulton_geocoded.csv`

### Step 6 — Add the safety guard to `eviction_compiler.py`
- [ ] Add an early exit to `main()` that aborts with a clear error message if `el_master.csv` is missing and no other EL files are present in `From_EL/`. This prevents a silent run that would wipe all historical Supabase data. The message should point the user to the `WW Handoff` folder.

### Step 7 — Configure GitHub Actions on the new repo
- [ ] Go to the new repo → Settings → Secrets and Variables → Actions
- [ ] Add the three repository secrets: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `MAPBOX_ACCESS_TOKEN`
- [ ] Confirm `.github/workflows/deploy.yml` is present and GitHub Pages is enabled (Settings → Pages → Source: GitHub Actions)
- [ ] Push a test commit and verify the deploy succeeds and the live site loads

### Step 8 — Update the Mapbox token allowlist
- [ ] Log into the ARC Mapbox account and open the `evictions` token settings
- [ ] Add the new GitHub Pages URL (e.g., `https://new-account.github.io/eviction-tracker/*`) to the token's allowed URLs
- [ ] Keep the old GitHub Pages URL in the allowlist until the redirect is in place and confirmed working

### Step 9 — Convert the old public repo to a redirect
Once the new site is live and confirmed:
- [ ] Delete all files from the old public repo except `index.html`
- [ ] Replace `index.html` with a meta-refresh redirect:
  ```html
  <!DOCTYPE html>
  <html>
    <head>
      <meta http-equiv="refresh" content="0; url=https://new-account.github.io/eviction-tracker/">
      <link rel="canonical" href="https://new-account.github.io/eviction-tracker/">
    </head>
    <body>
      <p>This page has moved. <a href="https://new-account.github.io/eviction-tracker/">Click here</a> if you are not redirected.</p>
    </body>
  </html>
  ```
- [ ] Push to `main` on the old repo and confirm the redirect works in a browser

### Step 10 — Rotate credentials
- [ ] Rotate the Supabase service-role key (used in `.env`) via the Supabase dashboard → Project Settings → API → Regenerate
- [ ] Update the `.env` file and the new repo's GitHub Secrets with the new key
- [ ] Optionally, verify the old key no longer works

---

## License

This project is licensed under the GNU General Public License v3.0 — see the [LICENSE](LICENSE) file for details.
