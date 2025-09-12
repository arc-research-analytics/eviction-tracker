/**
 * MapManager - Handles map initialization, interactions, and layer management
 */
class MapManager {
    constructor(config, dataLoader) {
        this.config = config;
        this.dataLoader = dataLoader;
        this.popupManager = null; // Will be set by app.js after initialization
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

            // Add hover border layer
            this.map.addLayer({
                id: 'tract-borders-hover',
                type: 'line',
                source: 'eviction-tracts',
                paint: {
                    'line-color': '#000000',  // Black outline on hover
                    'line-width': 2.5,        // Thicker outline on hover
                    'line-opacity': 1
                },
                filter: ['==', ['get', 'GEOID'], ''] // Initially hide all features
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
        // Track currently hovered feature for border highlighting
        let hoveredFeatureId = null;

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
            tooltip.style.display = 'block';
            
            // Show hover border for current feature
            const tractId = e.features[0].properties.GEOID;
            hoveredFeatureId = tractId;
            this.map.setFilter('tract-borders-hover', ['==', ['get', 'GEOID'], tractId]);
            
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
            
            // Update hover border if we've moved to a different tract
            const tractId = properties.GEOID;
            if (tractId !== hoveredFeatureId) {
                hoveredFeatureId = tractId;
                this.map.setFilter('tract-borders-hover', ['==', ['get', 'GEOID'], tractId]);
            }
            
            // Get current month in human readable format
            const currentMonth = this.dataLoader.getCurrentMonth();
            const monthUtils = this.dataLoader.getMonthUtils();
            const monthYear = monthUtils.dbMonthToFullReadable(currentMonth);
            
            tooltip.innerHTML = `
                <span class="tooltip-count">${monthYear} evictions: ${filings}</span>
                <span class="tooltip-hint">Click for historic trends</span>
            `;
            
            // Calculate tooltip target position with smart positioning
            let left = e.point.x + 10;
            let top = e.point.y - 10;
            
            // Get tooltip dimensions for better positioning
            const tooltipRect = tooltip.getBoundingClientRect();
            const tooltipWidth = tooltipRect.width || 200; // fallback width
            const tooltipHeight = tooltipRect.height || 60; // fallback height
            
            // Flip horizontally if too close to right edge
            if (left + tooltipWidth > window.innerWidth) {
                left = e.point.x - tooltipWidth - 10;
            }
            
            // Flip vertically if too close to bottom edge
            if (top + tooltipHeight > window.innerHeight) {
                top = e.point.y - tooltipHeight - 10;
            }
            
            // Ensure tooltip doesn't go off left or top edges
            left = Math.max(10, left);
            top = Math.max(10, top);
            
            // Update target position (animation will smoothly move towards it)
            targetPos.x = left;
            targetPos.y = top;
        });

        this.map.on('mouseleave', 'tract-fills', () => {
            tooltip.style.display = 'none';
            
            // Hide hover border
            hoveredFeatureId = null;
            this.map.setFilter('tract-borders-hover', ['==', ['get', 'GEOID'], '']);
            
            // Stop animation
            if (animationId) {
                cancelAnimationFrame(animationId);
                animationId = null;
            }
        });

        // Click event for showing popups
        this.map.on('click', 'tract-fills', (e) => {
            if (this.popupManager && e.features && e.features.length > 0) {
                const feature = e.features[0];
                const tractId = feature.properties.GEOID;
                const tractName = this.popupManager.getTractName(feature.properties);
                
                // Show popup with historical data
                this.popupManager.showTractPopup(tractId, tractName, e);
            }
        });

        // Change cursor to pointer when hovering over clickable tracts
        this.map.on('mouseenter', 'tract-fills', () => {
            this.map.getCanvas().style.cursor = 'pointer';
        });

        this.map.on('mouseleave', 'tract-fills', () => {
            this.map.getCanvas().style.cursor = 'grab';
        });

        // Add grabbing cursor for panning
        this.setupPanningCursor();
    }

    /**
     * Set up cursor changes for map panning (grab/grabbing)
     */
    setupPanningCursor() {
        const canvas = this.map.getCanvas();
        
        // Set default cursor to grab (open hand)
        canvas.style.cursor = 'grab';
        
        // When user starts dragging, show grabbing cursor (closed fist)
        this.map.on('dragstart', () => {
            canvas.style.cursor = 'grabbing';
        });
        
        // When drag ends, restore to grab cursor
        // The existing tract hover logic will override with pointer when needed
        this.map.on('dragend', () => {
            canvas.style.cursor = 'grab';
        });
        
        // Also handle mouse events for immediate feedback
        canvas.addEventListener('mousedown', (e) => {
            canvas.style.cursor = 'grabbing';
        });
        
        canvas.addEventListener('mouseup', () => {
            // Let the existing hover logic determine the right cursor
            // This will be overridden by tract hover if over a tract
            canvas.style.cursor = 'grab';
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
