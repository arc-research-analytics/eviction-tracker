/**
 * InteractionManager - Handles mouse interactions, hover effects, and tract selection
 */
class InteractionManager {
    constructor(map, dataLoader, tooltipManager, popupManager) {
        this.map = map;
        this.dataLoader = dataLoader;
        this.tooltipManager = tooltipManager;
        this.popupManager = popupManager;
        this.hoveredFeatureId = null;
        this.selectedTractId = null;
        
        this.setupMapInteractions();
    }

    /**
     * Set up all map interactions (hover, click, tooltip management)
     */
    setupMapInteractions() {
        // Tooltip on hover enter
        this.map.on('mouseenter', 'tract-fills', (e) => {
            const tractId = e.features[0].properties.GEOID;
            this.hoveredFeatureId = tractId;

            // Show hover border (only if not selected)
            if (tractId !== this.selectedTractId) {
                this.map.setFilter('tract-borders-hover', ['==', ['get', 'GEOID'], tractId]);

                // Set hovered state to make fill transparent
                this.map.setFeatureState(
                    { source: 'eviction-tracts', id: tractId },
                    { hovered: true }
                );
            }

            // Show tooltip with initial content
            const content = this.generateTooltipContent(e.features[0].properties);
            this.tooltipManager.show(content, e.point.x + 10, e.point.y - 10);
        });

        // Update tooltip content and position on mouse move
        this.map.on('mousemove', 'tract-fills', (e) => {
            const properties = e.features[0].properties;
            const tractId = properties.GEOID;

            // Update hover border if we've moved to a different tract
            if (tractId !== this.hoveredFeatureId) {
                // Clear previous hover state
                if (this.hoveredFeatureId && this.hoveredFeatureId !== this.selectedTractId) {
                    this.map.setFeatureState(
                        { source: 'eviction-tracts', id: this.hoveredFeatureId },
                        { hovered: false }
                    );
                }

                this.hoveredFeatureId = tractId;
                // Don't show hover border if this tract is already selected
                if (tractId !== this.selectedTractId) {
                    this.map.setFilter('tract-borders-hover', ['==', ['get', 'GEOID'], tractId]);

                    // Set hovered state for new tract
                    this.map.setFeatureState(
                        { source: 'eviction-tracts', id: tractId },
                        { hovered: true }
                    );
                }
            }

            // Update tooltip content and position
            const content = this.generateTooltipContent(properties);
            this.tooltipManager.updateContent(content);
            this.tooltipManager.updatePosition(e.point.x, e.point.y);
        });

        // Hide tooltip on mouse leave
        this.map.on('mouseleave', 'tract-fills', () => {
            this.tooltipManager.hide();

            // Clear hover state to restore fill opacity
            if (this.hoveredFeatureId && this.hoveredFeatureId !== this.selectedTractId) {
                this.map.setFeatureState(
                    { source: 'eviction-tracts', id: this.hoveredFeatureId },
                    { hovered: false }
                );
            }

            // Hide hover border
            this.hoveredFeatureId = null;
            this.map.setFilter('tract-borders-hover', ['==', ['get', 'GEOID'], '']);
        });

        // Handle tract clicks
        this.map.on('click', 'tract-fills', (e) => {
            if (this.popupManager && e.features && e.features.length > 0) {
                const feature = e.features[0];
                const tractId = feature.properties.GEOID;
                const tractName = this.popupManager.getTractName(feature.properties);
                
                // Update selected tract
                this.setSelectedTract(tractId);
                
                // Show popup with historical data
                this.popupManager.showTractPopup(tractId, tractName, e);
            }
        });

        // Hide tooltip when starting to drag/pan the map
        this.map.on('dragstart', () => {
            this.tooltipManager.hide();

            // Clear hover state
            if (this.hoveredFeatureId && this.hoveredFeatureId !== this.selectedTractId) {
                this.map.setFeatureState(
                    { source: 'eviction-tracts', id: this.hoveredFeatureId },
                    { hovered: false }
                );
            }

            // Hide hover border
            this.hoveredFeatureId = null;
            this.map.setFilter('tract-borders-hover', ['==', ['get', 'GEOID'], '']);
        });

        // Show tooltip again after drag ends if mouse is still over a tract
        this.map.on('dragend', (e) => {
            // Don't show tooltip if we don't have actual mouse coordinates
            if (!e.point) {
                return;
            }

            const point = e.point;

            const features = this.map.queryRenderedFeatures(point, { layers: ['tract-fills'] });

            if (features.length > 0) {
                const feature = features[0];
                const tractId = feature.properties.GEOID;

                // Update hover state
                this.hoveredFeatureId = tractId;

                // Show hover border (only if not selected)
                if (tractId !== this.selectedTractId) {
                    this.map.setFilter('tract-borders-hover', ['==', ['get', 'GEOID'], tractId]);

                    // Set hovered state
                    this.map.setFeatureState(
                        { source: 'eviction-tracts', id: tractId },
                        { hovered: true }
                    );
                }

                // Show tooltip
                const content = this.generateTooltipContent(feature.properties);
                this.tooltipManager.show(content, point[0] + 10, point[1] - 10);
                this.tooltipManager.setPositionImmediate(point[0] + 10, point[1] - 10);
            }
        });
    }

    /**
     * Generate tooltip HTML content for a tract
     */
    generateTooltipContent(properties) {
        const filings = properties.totalfilings || 0;
        
        // Get current month in human readable format
        const currentMonth = this.dataLoader.getCurrentMonth();
        const monthUtils = this.dataLoader.getMonthUtils();
        const monthYear = monthUtils.dbMonthToFullReadable(currentMonth);
        
        return `
            <span class="tooltip-count">${monthYear} evictions: ${filings}</span>
            <span class="tooltip-hint"><i>Click for historic trends</i></span>
        `;
    }

    /**
     * Set the selected tract and show selection border
     */
    setSelectedTract(tractId) {
        if (!this.map || !this.map.getLayer('tract-borders-selected')) {
            return;
        }

        // Clear previous selected tract's state
        if (this.selectedTractId) {
            this.map.setFeatureState(
                { source: 'eviction-tracts', id: this.selectedTractId },
                { selected: false }
            );
        }

        // Update the selected tract ID
        this.selectedTractId = tractId;

        // Show selection border for the selected tract
        this.map.setFilter('tract-borders-selected', ['==', ['get', 'GEOID'], tractId]);

        // Set selected state to make fill transparent
        this.map.setFeatureState(
            { source: 'eviction-tracts', id: tractId },
            { selected: true }
        );

        // Hide hover border for selected tract since selection border is now showing
        if (this.hoveredFeatureId === tractId) {
            this.map.setFilter('tract-borders-hover', ['==', ['get', 'GEOID'], '']);

            // Clear hover state since selected state takes precedence
            this.map.setFeatureState(
                { source: 'eviction-tracts', id: tractId },
                { hovered: false }
            );
        }
    }

    /**
     * Clear the selected tract and hide selection border
     */
    clearSelectedTract() {
        if (!this.map || !this.map.getLayer('tract-borders-selected')) {
            return;
        }

        // Clear selected state to restore fill opacity
        if (this.selectedTractId) {
            this.map.setFeatureState(
                { source: 'eviction-tracts', id: this.selectedTractId },
                { selected: false }
            );
        }

        // Clear the selected tract ID
        this.selectedTractId = null;

        // Hide the selection border
        this.map.setFilter('tract-borders-selected', ['==', ['get', 'GEOID'], '']);

        // Restore hover border if we're still hovering over a tract
        if (this.hoveredFeatureId) {
            this.map.setFilter('tract-borders-hover', ['==', ['get', 'GEOID'], this.hoveredFeatureId]);

            // Restore hover state
            this.map.setFeatureState(
                { source: 'eviction-tracts', id: this.hoveredFeatureId },
                { hovered: true }
            );
        }
    }

    /**
     * Get the currently selected tract ID
     */
    getSelectedTractId() {
        return this.selectedTractId;
    }

    /**
     * Get the currently hovered tract ID
     */
    getHoveredFeatureId() {
        return this.hoveredFeatureId;
    }

    /**
     * Clean up event listeners and references
     */
    destroy() {
        this.hoveredFeatureId = null;
        this.selectedTractId = null;
    }
}
