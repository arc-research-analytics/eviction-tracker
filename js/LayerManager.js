/**
 * LayerManager - Handles loading and managing all map layers (tracts, county, mask)
 */
class LayerManager {
    constructor(map, dataLoader) {
        this.map = map;
        this.dataLoader = dataLoader;
    }

    /**
     * Load and display tract boundaries with eviction data
     */
    async loadTractBoundaries() {
        try {
            const response = await fetch('data/fulton_tracts.geojson');
            if (!response.ok) throw new Error('Failed to fetch tract boundaries');
            
            const tractData = await response.json();
            const evictionData = this.dataLoader.getEvictionData();
            
            // Join eviction data to tract geometries
            let matchedCount = 0;
            tractData.features.forEach(feature => {
                const tractId = feature.properties.GEOID;
                const filings = evictionData[tractId] || 0;
                feature.properties.totalfilings = filings;
                
                if (filings > 0) {
                    matchedCount++;
                }
            });

            // Add data source
            this.addTractSource(tractData);
            
            // Add all tract layers
            this.addTractLayers();

            return { matchedCount, totalTracts: tractData.features.length };

        } catch (error) {
            console.error('Error loading tract boundaries:', error);
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
        // Fill layer for tract coloring
        this.map.addLayer({
            id: 'tract-fills',
            type: 'fill',
            source: 'eviction-tracts',
            paint: {
                'fill-color': [
                    'interpolate',
                    ['linear'],
                    ['get', 'totalfilings'],
                    0, '#ffffcc',    // Light yellow for 0 filings
                    10, '#fed976',   // Yellow for low filings (1-10)
                    25, '#fd8d3c',   // Orange for medium filings (11-25)
                    60, '#e31a1c',   // Red for high filings (26-60)
                    100, '#800026'   // Dark red for very high filings (60+)
                ],
                'fill-opacity': 0.7
            }
        });

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
        });

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
            filter: ['==', ['get', 'GEOID'], ''] // Initially hide all features
        });

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
            filter: ['==', ['get', 'GEOID'], ''] // Initially hide all features
        });
    }

    /**
     * Load and display county outline
     */
    async loadCountyOutline() {
        try {
            const response = await fetch('data/fulton_county.geojson');
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
            console.error('Error loading county outline:', error);
            throw new Error('Failed to load county outline');
        }
    }

    /**
     * Load and display county mask as a semi-transparent grey filter
     */
    async loadCountyMask() {
        try {
            const response = await fetch('data/fulton_mask.geojson');
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
                    'fill-opacity': 0.5 
                }
            });

        } catch (error) {
            console.error('Error loading county mask:', error);
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
            const response = await fetch('data/fulton_tracts.geojson');
            if (!response.ok) throw new Error('Failed to fetch tract boundaries');
            
            const tractData = await response.json();
            const evictionData = this.dataLoader.getEvictionData();
            
            // Join new eviction data to tract geometries
            let matchedCount = 0;
            tractData.features.forEach(feature => {
                const tractId = feature.properties.GEOID;
                const filings = evictionData[tractId] || 0;
                feature.properties.totalfilings = filings;
                
                if (filings > 0) {
                    matchedCount++;
                }
            });

            // Update the existing source with new data
            this.map.getSource('eviction-tracts').setData(tractData);

            return { matchedCount, totalTracts: tractData.features.length };

        } catch (error) {
            console.error('Error refreshing tract boundaries:', error);
            throw new Error('Failed to refresh tract boundaries');
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
            
            return true;
        } catch (error) {
            console.error('Error loading layers:', error);
            throw new Error('Failed to load map layers');
        }
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
}
