/**
 * MapManager - Main coordinator for map functionality and module management
 */
class MapManager {
    constructor(config, dataLoader) {
        this.config = config;
        this.dataLoader = dataLoader;
        this.map = null;
        this.popupManager = null; // Will be set by app.js after initialization
        
        // Initialize sub-managers (will be created after map initialization)
        this.layerManager = null;
        this.tooltipManager = null;
        this.interactionManager = null;
        this.cursorManager = null;
    }

    /**
     * Initialize the Mapbox map and all sub-managers
     */
    initializeMap() {
        mapboxgl.accessToken = this.config.mapbox.accessToken;
        
        this.map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/streets-v12',
            center: [-84.35, 33.73], 
            zoom: 8.8,
            minZoom: 5,
            maxZoom: 16,
            maxBounds: [
                [-86.13468104043729, 32.48420711310857],  // Southwest coordinates [lng, lat]
                [-81.63130485272346, 35.63768859763405]   // Northeast coordinates [lng, lat]
            ]
        });

        // Add Mapbox scale bar
        this.map.addControl(new mapboxgl.ScaleControl({
            unit: 'imperial',
        }));

        // Initialize sub-managers after map is created
        this.initializeSubManagers();

        return this.map;
    }

    /**
     * Initialize all sub-manager modules
     */
    initializeSubManagers() {
        // Initialize managers in dependency order
        this.layerManager = new LayerManager(this.map, this.dataLoader);
        this.tooltipManager = new TooltipManager();
        this.cursorManager = new CursorManager(this.map);
        
        // InteractionManager depends on tooltip and popup managers
        // Note: popupManager will be set later by app.js, so we'll initialize InteractionManager 
        // in setupMapInteractions() when we have all dependencies
    }

    /**
     * Set the popup manager and complete interaction setup
     */
    setPopupManager(popupManager) {
        this.popupManager = popupManager;
        this.setupMapInteractions();
    }

    /**
     * Complete the interaction setup once all dependencies are available
     */
    setupMapInteractions() {
        if (!this.popupManager) {
            return;
        }

        // Now we can initialize InteractionManager with all dependencies
        this.interactionManager = new InteractionManager(
            this.map, 
            this.dataLoader, 
            this.tooltipManager, 
            this.popupManager
        );
    }

    /**
     * Load all map layers
     */
    async loadAllLayers() {
        if (!this.layerManager) {
            throw new Error('LayerManager not initialized');
        }

        try {
            await this.layerManager.loadAllLayers();
            return true;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Load and display tract boundaries with eviction data
     */
    async loadTractBoundaries() {
        if (!this.layerManager) {
            throw new Error('LayerManager not initialized');
        }

        try {
            const result = await this.layerManager.loadTractBoundaries();
            return result;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Load and display county outline
     */
    async loadCountyOutline() {
        if (!this.layerManager) {
            throw new Error('LayerManager not initialized');
        }

        try {
            await this.layerManager.loadCountyOutline();
        } catch (error) {
            throw error;
        }
    }

    /**
     * Load and display county mask
     */
    async loadCountyMask() {
        if (!this.layerManager) {
            throw new Error('LayerManager not initialized');
        }

        try {
            await this.layerManager.loadCountyMask();
        } catch (error) {
            throw error;
        }
    }

    /**
     * Load and display county name labels
     */
    async loadCountyLabels() {
        if (!this.layerManager) {
            throw new Error('LayerManager not initialized');
        }

        try {
            await this.layerManager.loadCountyLabels();
        } catch (error) {
            throw error;
        }
    }

    /**
     * Refresh tract boundaries with new eviction data
     */
    async refreshTractBoundaries() {
        if (!this.layerManager) {
            throw new Error('LayerManager not initialized');
        }

        try {
            const result = await this.layerManager.refreshTractBoundaries();
            return result;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Set the selected tract and show selection border
     */
    setSelectedTract(tractId) {
        if (!this.interactionManager) {
            return;
        }

        this.interactionManager.setSelectedTract(tractId);
    }

    /**
     * Clear the selected tract and hide selection border
     */
    clearSelectedTract() {
        if (!this.interactionManager) {
            return;
        }
        
        this.interactionManager.clearSelectedTract();
    }

    /**
     * Get the currently selected tract ID
     */
    getSelectedTractId() {
        return this.interactionManager ? this.interactionManager.getSelectedTractId() : null;
    }

    /**
     * Get the map instance
     */
    getMap() {
        return this.map;
    }

    /**
     * Get layer manager instance
     */
    getLayerManager() {
        return this.layerManager;
    }

    /**
     * Get tooltip manager instance
     */
    getTooltipManager() {
        return this.tooltipManager;
    }

    /**
     * Get interaction manager instance
     */
    getInteractionManager() {
        return this.interactionManager;
    }

    /**
     * Get cursor manager instance
     */
    getCursorManager() {
        return this.cursorManager;
    }

    /**
     * Update color scale when display mode changes
     */
    updateColorScale() {
        if (!this.layerManager) {
            return;
        }

        this.layerManager.updateColorScale();
    }

    /**
     * Clean up all managers and resources
     */
    destroy() {
        // Clean up sub-managers
        if (this.tooltipManager) {
            this.tooltipManager.destroy();
        }
        
        if (this.interactionManager) {
            this.interactionManager.destroy();
        }
        
        if (this.cursorManager) {
            this.cursorManager.destroy();
        }

        // Clean up map
        if (this.map) {
            this.map.remove();
            this.map = null;
        }

        // Clear references
        this.layerManager = null;
        this.tooltipManager = null;
        this.interactionManager = null;
        this.cursorManager = null;
        this.popupManager = null;
    }
}