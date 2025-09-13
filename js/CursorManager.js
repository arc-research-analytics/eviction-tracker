/**
 * CursorManager - Handles cursor state changes for map interactions
 */
class CursorManager {
    constructor(map) {
        this.map = map;
        this.canvas = null;
        
        this.setupCursorHandling();
    }

    /**
     * Set up all cursor handling for the map
     */
    setupCursorHandling() {
        this.canvas = this.map.getCanvas();
        
        // Set default cursor to grab (open hand)
        this.canvas.style.cursor = 'grab';
        
        this.setupTractHoverCursors();
        this.setupPanningCursors();
        this.setupMouseEventCursors();
    }

    /**
     * Set up cursor changes when hovering over tract features
     */
    setupTractHoverCursors() {
        // Change cursor to pointer when hovering over clickable tracts
        this.map.on('mouseenter', 'tract-fills', () => {
            this.canvas.style.cursor = 'pointer';
        });

        // Change back to grab cursor when leaving tracts
        this.map.on('mouseleave', 'tract-fills', () => {
            this.canvas.style.cursor = 'grab';
        });
    }

    /**
     * Set up cursor changes for map panning/dragging
     */
    setupPanningCursors() {
        // When user starts dragging, show grabbing cursor (closed fist)
        this.map.on('dragstart', () => {
            this.canvas.style.cursor = 'grabbing';
        });
        
        // When drag ends, check what's underneath and set appropriate cursor
        this.map.on('dragend', (e) => {
            // Get the center point of the map to check what's underneath
            const center = this.map.getCenter();
            const centerPoint = this.map.project(center);
            const features = this.map.queryRenderedFeatures(centerPoint, { layers: ['tract-fills'] });
            
            if (features.length > 0) {
                this.canvas.style.cursor = 'pointer';
            } else {
                this.canvas.style.cursor = 'grab';
            }
        });
    }

    /**
     * Set up mouse event cursor handlers for immediate feedback
     */
    setupMouseEventCursors() {
        // Handle mouse down for immediate cursor feedback
        this.canvas.addEventListener('mousedown', (e) => {
            this.canvas.style.cursor = 'grabbing';
        });
        
        // Handle mouse up and check what's underneath
        this.canvas.addEventListener('mouseup', (e) => {
            // After mouse up, check if we're over a tract
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const point = [x, y];
            
            const features = this.map.queryRenderedFeatures(point, { layers: ['tract-fills'] });
            
            if (features.length > 0) {
                this.canvas.style.cursor = 'pointer';
            } else {
                this.canvas.style.cursor = 'grab';
            }
        });
        
        // Handle general mouse movement over the map (when not over specific tracts)
        this.map.on('mousemove', (e) => {
            // Only set grab cursor if we're not currently dragging and not over a tract
            if (this.canvas.style.cursor !== 'grabbing') {
                const features = this.map.queryRenderedFeatures(e.point, { layers: ['tract-fills'] });
                if (features.length === 0) {
                    this.canvas.style.cursor = 'grab';
                }
            }
        });
    }

    /**
     * Manually set cursor to a specific state
     */
    setCursor(cursorType) {
        if (this.canvas) {
            this.canvas.style.cursor = cursorType;
        }
    }

    /**
     * Get current cursor state
     */
    getCurrentCursor() {
        return this.canvas ? this.canvas.style.cursor : null;
    }

    /**
     * Reset cursor to default grab state
     */
    resetCursor() {
        this.setCursor('grab');
    }

    /**
     * Clean up event listeners
     */
    destroy() {
        // Event listeners on map will be cleaned up when map is destroyed
        // Canvas event listeners would need to be tracked and removed if needed
        this.canvas = null;
    }
}
