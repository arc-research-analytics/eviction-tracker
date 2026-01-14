/**
 * LayerManager - Handles loading and managing all map layers (tracts, county, mask)
 */
class LayerManager {
    constructor(map, dataLoader) {
        this.map = map;
        this.dataLoader = dataLoader;
        this.currentGeography = 'tract'; // Default geography type

        // Mapping from string IDs to numeric feature IDs for feature-state
        this.featureIdMap = {};
        this.reverseFeatureIdMap = {};

        // Geography configuration mapping
        this.geographyConfig = {
            tract: {
                file: 'data/region_tracts_simp.geojson',
                idProperty: 'GEOID',
                name: 'Census Tract'
            },
            school: {
                file: 'data/region_schools.geojson',
                idProperty: 'ShortLabel',
                name: 'High School Attendance Zone'
            },
            hex: {
                file: 'data/region_hex.geojson',
                idProperty: 'hex_id',
                name: 'H3 Hexagon'
            }
        };

        /**
         * CHOROPLETH COLOR SCALE BREAKPOINTS
         *
         * Configure the breakpoints for the choropleth map colors.
         * Each geography level (tract, school, hex) has separate breakpoints for:
         *   - rate: Filing rate shown as percentage
         *   - count: Raw number of eviction filings
         *
         * Format: [value1, value2, value3, value4, value5]
         * These create 5 color stops from light yellow → yellow → orange → red → dark red
         *
         * Values calculated using Jenks natural breaks optimization (classes=5)
         * To modify: Change the numeric values below to adjust when colors transition.
         */
        this.colorBreakpoints = {
            tract: {
                rate: [0, 2.0, 6.0, 10.0, 220],      // Jenks breaks for tract filing rate (%)
                count: [0, 8, 15, 35, 214]           // Jenks breaks for tract filing count
            },
            school: {
                rate: [0, 1.0, 1.5, 2.5, 8.4],       // Jenks breaks for school filing rate (%)
                count: [0, 50, 125, 215, 822]        // Jenks breaks for school filing count
            },
            hex: {
                rate: [0, 1.0, 2.5, 10.0, 550],       // Jenks breaks for hex filing rate (%)
                count: [0, 10, 30, 60, 251]          // Jenks breaks for hex filing count
            }
        };

        // Color palette used for all breakpoints (light → dark)
        this.colorPalette = ['#ffffcc', '#fed976', '#fd8d3c', '#e31a1c', '#800026'];
    }

    /**
     * Get current geography type
     */
    getGeographyType() {
        return this.currentGeography;
    }

    /**
     * Set geography type
     */
    setGeographyType(geographyType) {
        if (this.geographyConfig[geographyType]) {
            this.currentGeography = geographyType;
        }
    }

    /**
     * Get numeric feature ID from string ID (for feature-state operations)
     */
    getNumericFeatureId(stringId) {
        return this.featureIdMap[stringId];
    }

    /**
     * Get string ID from numeric feature ID
     */
    getStringFeatureId(numericId) {
        return this.reverseFeatureIdMap[numericId];
    }

    /**
     * Load and display tract boundaries with eviction data
     */
    async loadTractBoundaries() {
        try {
            const config = this.geographyConfig[this.currentGeography];
            const response = await fetch(config.file);
            if (!response.ok) throw new Error(`Failed to fetch ${config.name} boundaries`);

            const tractData = await response.json();
            const evictionData = this.dataLoader.getEvictionData();

            // Clear previous ID mappings
            this.featureIdMap = {};
            this.reverseFeatureIdMap = {};

            // Join eviction data to tract geometries
            let matchedCount = 0;
            tractData.features.forEach((feature, index) => {
                const tractId = feature.properties[config.idProperty];
                const tractData = evictionData[tractId] || { totalfilings: 0, filingRate: 0 };

                // Set numeric feature id for feature-state support
                // Use index as the numeric ID to ensure it works for all geography types
                const numericId = index;
                feature.id = numericId;

                // Store bidirectional mapping between string ID and numeric ID
                this.featureIdMap[tractId] = numericId;
                this.reverseFeatureIdMap[numericId] = tractId;

                // Set both total filings and filing rate
                feature.properties.totalfilings = tractData.totalfilings || 0;
                feature.properties.filingrate = tractData.filingRate || 0;

                // Set the display value based on current display mode
                const displayValue = this.dataLoader.getDataValueForTract(tractId);
                feature.properties.displayvalue = displayValue;

                if (displayValue > 0) {
                    matchedCount++;
                }
            });

            // Add data source
            this.addTractSource(tractData);
            
            // Add all tract layers
            this.addTractLayers();

            return { matchedCount, totalTracts: tractData.features.length };

        } catch (error) {
            throw new Error('Failed to load tract boundaries');
        }
    }

    /**
     * Add tract data source to the map
     */
    addTractSource(tractData) {
        this.map.addSource('eviction-tracts', {
            type: 'geojson',
            data: tractData
        });
    }

    /**
     * Add all tract-related layers to the map
     */
    addTractLayers() {
        // Determine which layer to insert before to keep county layers on top
        // Priority: county-fill (lowest county layer) > county-border > county-label-text
        let beforeLayerId = null;
        if (this.map.getLayer('county-fill')) {
            beforeLayerId = 'county-fill';
        } else if (this.map.getLayer('county-border')) {
            beforeLayerId = 'county-border';
        } else if (this.map.getLayer('county-label-text')) {
            beforeLayerId = 'county-label-text';
        }

        // Fill layer for tract coloring - use dynamic color scale
        this.map.addLayer({
            id: 'tract-fills',
            type: 'fill',
            source: 'eviction-tracts',
            paint: {
                'fill-color': this.getColorScale(),
                'fill-opacity': [
                    'case',
                    ['boolean', ['feature-state', 'hovered'], false], 0,
                    ['boolean', ['feature-state', 'selected'], false], 0,
                    0.7
                ]
            }
        }, beforeLayerId);

        // Base border layer for all tracts
        this.map.addLayer({
            id: 'tract-borders',
            type: 'line',
            source: 'eviction-tracts',
            paint: {
                'line-color': '#cccccc',  // Light grey for better visibility
                'line-width': 0.8,        // Slightly thicker for clarity
                'line-opacity': 0.4
            }
        }, beforeLayerId);

        // Hover border layer
        this.map.addLayer({
            id: 'tract-borders-hover',
            type: 'line',
            source: 'eviction-tracts',
            paint: {
                'line-color': '#969696',
                'line-width': 2,
                'line-opacity': 1
            },
            filter: ['==', ['get', this.geographyConfig[this.currentGeography].idProperty], ''] // Initially hide all features
        }, beforeLayerId);

        // Selected tract border layer (renders on top of hover)
        this.map.addLayer({
            id: 'tract-borders-selected',
            type: 'line',
            source: 'eviction-tracts',
            paint: {
                'line-color': '#000000',
                'line-width': 2.5,
                'line-opacity': 1,
                // 'line-dasharray': [2, 2]
            },
            filter: ['==', ['get', this.geographyConfig[this.currentGeography].idProperty], ''] // Initially hide all features
        }, beforeLayerId);
    }

    /**
     * Load and display county outline
     */
    async loadCountyOutline() {
        try {
            const response = await fetch('data/region_boundaries.geojson');
            if (!response.ok) throw new Error('Failed to fetch county outline');
            
            const countyData = await response.json();

            // Add county outline source
            this.map.addSource('county-outline', {
                type: 'geojson',
                data: countyData
            });

            // Add transparent fill layer
            this.map.addLayer({
                id: 'county-fill',
                type: 'fill',
                source: 'county-outline',
                paint: {
                    'fill-color': 'transparent',
                    'fill-opacity': 0
                }
            });

            // Add thick black border on top
            this.map.addLayer({
                id: 'county-border',
                type: 'line',
                source: 'county-outline',
                paint: {
                    'line-color': '#000000',
                    'line-width': 2,
                    'line-opacity': 1
                }
            });

        } catch (error) {
            throw new Error('Failed to load county outline');
        }
    }

    /**
     * Load and display county mask as a semi-transparent grey filter
     */
    async loadCountyMask() {
        try {
            const response = await fetch('data/region_mask.geojson');
            if (!response.ok) throw new Error('Failed to fetch county mask');
            
            const maskData = await response.json();

            // Add county mask source
            this.map.addSource('county-mask', {
                type: 'geojson',
                data: maskData
            });

            // Add mask layer with semi-transparent fill
            this.map.addLayer({
                id: 'county-mask',
                type: 'fill',
                source: 'county-mask',
                paint: {
                    'fill-color': '#808080',
                    'fill-opacity': 0.4
                }
            });

        } catch (error) {
            throw new Error('Failed to load county mask');
        }
    }

    /**
     * Refresh tract boundaries with new eviction data
     */
    async refreshTractBoundaries() {
        try {
            if (!this.map.getSource('eviction-tracts')) {
                // If source doesn't exist yet, load normally
                return await this.loadTractBoundaries();
            }

            // Get fresh tract data
            const config = this.geographyConfig[this.currentGeography];
            const response = await fetch(config.file);
            if (!response.ok) throw new Error(`Failed to fetch ${config.name} boundaries`);

            const tractData = await response.json();
            const evictionData = this.dataLoader.getEvictionData();

            // Clear previous ID mappings
            this.featureIdMap = {};
            this.reverseFeatureIdMap = {};

            // Join new eviction data to tract geometries
            let matchedCount = 0;
            tractData.features.forEach((feature, index) => {
                const tractId = feature.properties[config.idProperty];
                const tractData = evictionData[tractId] || { totalfilings: 0, filingRate: 0 };

                // Set numeric feature id for feature-state support
                const numericId = index;
                feature.id = numericId;

                // Store bidirectional mapping
                this.featureIdMap[tractId] = numericId;
                this.reverseFeatureIdMap[numericId] = tractId;

                // Set both total filings and filing rate
                feature.properties.totalfilings = tractData.totalfilings || 0;
                feature.properties.filingrate = tractData.filingRate || 0;

                // Set the display value based on current display mode
                const displayValue = this.dataLoader.getDataValueForTract(tractId);
                feature.properties.displayvalue = displayValue;

                if (displayValue > 0) {
                    matchedCount++;
                }
            });

            // Update the existing source with new data
            this.map.getSource('eviction-tracts').setData(tractData);

            return { matchedCount, totalTracts: tractData.features.length };

        } catch (error) {
            throw new Error('Failed to refresh tract boundaries');
        }
    }

    /**
     * Load and display county name labels
     */
    async loadCountyLabels() {
        try {
            const response = await fetch('data/region_labels.geojson');
            if (!response.ok) throw new Error('Failed to fetch county labels');

            const labelData = await response.json();

            // Add county labels source
            this.map.addSource('county-labels', {
                type: 'geojson',
                data: labelData
            });

            // Add symbol layer for county names
            this.map.addLayer({
                id: 'county-label-text',
                type: 'symbol',
                source: 'county-labels',
                maxzoom: 12,
                layout: {
                    'text-field': ['get', 'NAME'],
                    'text-font': ['DIN Pro Bold Italic', 'Arial Unicode MS Bold'],
                    'text-size': 16,
                    'text-transform': 'uppercase'
                },
                paint: {
                    'text-color': '#000000',
                    'text-halo-color': '#ffffff',
                    'text-halo-width': 2
                }
            });

        } catch (error) {
            console.error('Error loading county labels:', error);
            throw new Error('Failed to load county labels');
        }
    }

    /**
     * Load all layers in the correct order
     */
    async loadAllLayers() {
        try {
            // Load layers in the order they should appear (bottom to top)
            await this.loadCountyMask();    // Bottom layer (grey mask)
            await this.loadTractBoundaries(); // Middle layers (tract data)
            await this.loadCountyOutline(); // Top layer (county border)
            await this.loadCountyLabels();  // Top layer (county names)

            return true;
        } catch (error) {
            throw new Error('Failed to load map layers');
        }
    }

    /**
     * Remove tract layers and source
     */
    removeTractLayers() {
        // Remove layers in reverse order
        const layers = ['tract-borders-selected', 'tract-borders-hover', 'tract-borders', 'tract-fills'];
        layers.forEach(layerId => {
            if (this.map.getLayer(layerId)) {
                this.map.removeLayer(layerId);
            }
        });

        // Remove source
        if (this.map.getSource('eviction-tracts')) {
            this.map.removeSource('eviction-tracts');
        }
    }

    /**
     * Switch geography type and reload layers
     */
    async switchGeography(geographyType) {
        // Set the new geography type
        this.setGeographyType(geographyType);

        // Remove existing tract layers and source
        this.removeTractLayers();

        // Reload tract boundaries with new geography
        const result = await this.loadTractBoundaries();

        return result;
    }

    /**
     * Check if tract layers are loaded
     */
    areTractLayersLoaded() {
        return this.map.getSource('eviction-tracts') !== undefined;
    }

    /**
     * Check if county layers are loaded
     */
    areCountyLayersLoaded() {
        return this.map.getSource('county-outline') !== undefined;
    }

    /**
     * Check if mask layer is loaded
     */
    isMaskLayerLoaded() {
        return this.map.getSource('county-mask') !== undefined;
    }

    /**
     * Get color scale based on current geography and display mode
     * Uses configurable breakpoints from this.colorBreakpoints
     */
    getColorScale() {
        const displayMode = this.dataLoader.getDisplayMode();
        const geographyType = this.currentGeography;

        // Get the appropriate breakpoints for this geography and display mode
        const breakpoints = this.colorBreakpoints[geographyType][displayMode];
        const colors = this.colorPalette;

        // Build the Mapbox color scale expression
        // Format: ['interpolate', ['linear'], ['get', 'displayvalue'], value1, color1, value2, color2, ...]
        return [
            'interpolate',
            ['linear'],
            ['get', 'displayvalue'],
            breakpoints[0], colors[0],  // Light yellow
            breakpoints[1], colors[1],  // Yellow
            breakpoints[2], colors[2],  // Orange
            breakpoints[3], colors[3],  // Red
            breakpoints[4], colors[4]   // Dark red
        ];
    }

    /**
     * Update color scale when display mode changes
     */
    updateColorScale() {
        if (this.map.getLayer('tract-fills')) {
            this.map.setPaintProperty('tract-fills', 'fill-color', this.getColorScale());
        }
    }
}
