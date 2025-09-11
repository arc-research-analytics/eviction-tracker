/**
 * MapManager - Handles map initialization, interactions, and layer management
 */
class MapManager {
    constructor(config, dataLoader) {
        this.config = config;
        this.dataLoader = dataLoader;
        this.map = null;
    }

    /**
     * Initialize the Mapbox map
     */
    initializeMap() {
        mapboxgl.accessToken = this.config.mapbox.accessToken;
        
        this.map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/light-v11',
            center: [-84.35, 33.83], 
            zoom: 8.8
        });

        // Add Mapbox scale bar
        this.map.addControl(new mapboxgl.ScaleControl({
            unit: 'imperial',
            position: 'bottom-left'
        }));

        return this.map;
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

            // Add source
            this.map.addSource('eviction-tracts', {
                type: 'geojson',
                data: tractData
            });

            // Add fill layer
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

            // Add border layer
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

            this.setupMapInteractions();

        } catch (error) {
            console.error('Error loading tract boundaries:', error);
            throw new Error('Failed to load tract boundaries');
        }
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

            // Add county outline layer with transparent fill and thick black border
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
     * Set up map interactions (tooltips, hover effects)
     */
    setupMapInteractions() {
        // Create tooltip element
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.style.display = 'none';
        document.body.appendChild(tooltip);

        // Smooth tooltip animation variables
        let tooltipPos = { x: 0, y: 0 };
        let targetPos = { x: 0, y: 0 };
        let animationId = null;

        // Smooth animation function
        const animateTooltip = () => {
            // Linear interpolation for smooth following
            const lerp = 0.15; // Lower = more lag/smoothness, Higher = more responsive
            tooltipPos.x += (targetPos.x - tooltipPos.x) * lerp;
            tooltipPos.y += (targetPos.y - tooltipPos.y) * lerp;

            tooltip.style.left = Math.round(tooltipPos.x) + 'px';
            tooltip.style.top = Math.round(tooltipPos.y) + 'px';

            // Continue animation if tooltip is visible
            if (tooltip.style.display !== 'none') {
                animationId = requestAnimationFrame(animateTooltip);
            }
        };

        // Tooltip on hover
        this.map.on('mouseenter', 'tract-fills', (e) => {
            this.map.getCanvas().style.cursor = 'pointer';
            tooltip.style.display = 'block';
            
            // Initialize positions
            tooltipPos.x = e.point.x + 10;
            tooltipPos.y = e.point.y - 10;
            targetPos.x = tooltipPos.x;
            targetPos.y = tooltipPos.y;
            
            // Start smooth animation
            if (animationId) {
                cancelAnimationFrame(animationId);
            }
            animateTooltip();
        });

        this.map.on('mousemove', 'tract-fills', (e) => {
            // Update tooltip content for current feature (this fires when moving between tracts)
            const properties = e.features[0].properties;
            const filings = properties.totalfilings || 0;
            
            
            tooltip.innerHTML = `
                <span class="tooltip-count">${filings} evictions</span>
                <span class="tooltip-hint">Click for historic trend</span>
            `;
            
            // Calculate tooltip target position with smart positioning
            let left = e.point.x + 10;
            let top = e.point.y - 10;
            
            // Flip horizontally if too close to right edge
            if (left + 150 > window.innerWidth) {  // 150px estimated tooltip width
                left = e.point.x - 150;
            }
            
            // Flip vertically if too close to bottom edge
            if (top + 60 > window.innerHeight) {  // 60px estimated tooltip height (now taller with 2 lines)
                top = e.point.y - 60;
            }
            
            // Ensure tooltip doesn't go off left or top edges
            left = Math.max(10, left);
            top = Math.max(10, top);
            
            // Update target position (animation will smoothly move towards it)
            targetPos.x = left;
            targetPos.y = top;
        });

        this.map.on('mouseleave', 'tract-fills', () => {
            this.map.getCanvas().style.cursor = '';
            tooltip.style.display = 'none';
            
            // Stop animation
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
        });
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

        } catch (error) {
            console.error('Error refreshing tract boundaries:', error);
            throw new Error('Failed to refresh tract boundaries');
        }
    }

    /**
     * Get the map instance
     */
    getMap() {
        return this.map;
    }
}
