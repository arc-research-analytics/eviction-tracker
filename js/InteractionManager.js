/**
 * InteractionManager - Handles mouse interactions, hover effects, and tract selection
 */
class InteractionManager {
    constructor(map, dataLoader, tooltipManager, popupManager, layerManager) {
        this.map = map;
        this.dataLoader = dataLoader;
        this.tooltipManager = tooltipManager;
        this.popupManager = popupManager;
        this.layerManager = layerManager;
        this.hoveredFeatureId = null;
        this.selectedTractId = null;

        this.setupMapInteractions();
    }

    /**
     * Get the current ID property name based on geography type
     */
    getIdProperty() {
        const geographyType = this.layerManager.getGeographyType();
        return this.layerManager.geographyConfig[geographyType].idProperty;
    }

    /**
     * Set up all map interactions (hover, click, tooltip management)
     */
    setupMapInteractions() {
        // Tooltip on hover enter
        this.map.on('mouseenter', 'tract-fills', (e) => {
            const idProperty = this.getIdProperty();
            const tractId = e.features[0].properties[idProperty];
            this.hoveredFeatureId = tractId;

            // Show hover border (only if not selected)
            if (tractId !== this.selectedTractId) {
                this.map.setFilter('tract-borders-hover', ['==', ['get', idProperty], tractId]);

                // Set hovered state to make fill transparent
                // Convert string ID to numeric ID for feature-state
                const numericId = this.layerManager.getNumericFeatureId(tractId);
                console.log('Setting hovered state for:', tractId, 'numericId:', numericId);
                try {
                    this.map.setFeatureState(
                        { source: 'eviction-tracts', id: numericId },
                        { hovered: true }
                    );

                    // Verify the state was set
                    const state = this.map.getFeatureState({ source: 'eviction-tracts', id: numericId });
                    console.log('Feature state after setting:', state);
                } catch (error) {
                    console.error('Error setting feature state:', error);
                }
            }

            // Show tooltip with initial content
            const content = this.generateTooltipContent(e.features[0].properties);
            this.tooltipManager.show(content, e.point.x + 10, e.point.y - 10);
        });

        // Update tooltip content and position on mouse move
        this.map.on('mousemove', 'tract-fills', (e) => {
            const properties = e.features[0].properties;
            const idProperty = this.getIdProperty();
            const tractId = properties[idProperty];

            // Update hover border if we've moved to a different tract
            if (tractId !== this.hoveredFeatureId) {
                // Clear previous hover state
                if (this.hoveredFeatureId && this.hoveredFeatureId !== this.selectedTractId) {
                    const prevNumericId = this.layerManager.getNumericFeatureId(this.hoveredFeatureId);
                    this.map.setFeatureState(
                        { source: 'eviction-tracts', id: prevNumericId },
                        { hovered: false }
                    );
                }

                this.hoveredFeatureId = tractId;
                // Don't show hover border if this tract is already selected
                if (tractId !== this.selectedTractId) {
                    this.map.setFilter('tract-borders-hover', ['==', ['get', idProperty], tractId]);

                    // Set hovered state for new tract
                    const numericId = this.layerManager.getNumericFeatureId(tractId);
                    this.map.setFeatureState(
                        { source: 'eviction-tracts', id: numericId },
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
                const numericId = this.layerManager.getNumericFeatureId(this.hoveredFeatureId);
                this.map.setFeatureState(
                    { source: 'eviction-tracts', id: numericId },
                    { hovered: false }
                );
            }

            // Hide hover border
            this.hoveredFeatureId = null;
            const idProperty = this.getIdProperty();
            this.map.setFilter('tract-borders-hover', ['==', ['get', idProperty], '']);
        });

        // Handle tract clicks
        this.map.on('click', 'tract-fills', (e) => {
            if (this.popupManager && e.features && e.features.length > 0) {
                const feature = e.features[0];
                const idProperty = this.getIdProperty();
                const tractId = feature.properties[idProperty];
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

            // Hide hover border but keep the transparent fill during drag
            // (The hovered state will be cleared naturally on mouseleave)
            const idProperty = this.getIdProperty();
            this.map.setFilter('tract-borders-hover', ['==', ['get', idProperty], '']);
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
                const idProperty = this.getIdProperty();
                const tractId = feature.properties[idProperty];

                // Update hover state
                this.hoveredFeatureId = tractId;

                // Show hover border (only if not selected)
                if (tractId !== this.selectedTractId) {
                    this.map.setFilter('tract-borders-hover', ['==', ['get', idProperty], tractId]);

                    // Set hovered state
                    const numericId = this.layerManager.getNumericFeatureId(tractId);
                    this.map.setFeatureState(
                        { source: 'eviction-tracts', id: numericId },
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

        // For schools, include the school name at the top
        const geographyType = this.layerManager.getGeographyType();
        let schoolNameHtml = '';

        if (geographyType === 'school' && properties.ShortLabel) {
            schoolNameHtml = `<span class="tooltip-school-name">${properties.ShortLabel} High School</span>`;
        }

        return `
            ${schoolNameHtml}
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
            const prevNumericId = this.layerManager.getNumericFeatureId(this.selectedTractId);
            this.map.setFeatureState(
                { source: 'eviction-tracts', id: prevNumericId },
                { selected: false }
            );
        }

        // Update the selected tract ID
        this.selectedTractId = tractId;

        // Show selection border for the selected tract
        const idProperty = this.getIdProperty();
        this.map.setFilter('tract-borders-selected', ['==', ['get', idProperty], tractId]);

        // Set selected state to make fill transparent
        const numericId = this.layerManager.getNumericFeatureId(tractId);
        this.map.setFeatureState(
            { source: 'eviction-tracts', id: numericId },
            { selected: true }
        );

        // Hide hover border for selected tract since selection border is now showing
        if (this.hoveredFeatureId === tractId) {
            this.map.setFilter('tract-borders-hover', ['==', ['get', idProperty], '']);

            // Clear hover state since selected state takes precedence
            this.map.setFeatureState(
                { source: 'eviction-tracts', id: numericId },
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
            const numericId = this.layerManager.getNumericFeatureId(this.selectedTractId);
            this.map.setFeatureState(
                { source: 'eviction-tracts', id: numericId },
                { selected: false }
            );
        }

        // Clear the selected tract ID
        this.selectedTractId = null;

        // Hide the selection border
        const idProperty = this.getIdProperty();
        this.map.setFilter('tract-borders-selected', ['==', ['get', idProperty], '']);

        // Restore hover border if we're still hovering over a tract
        if (this.hoveredFeatureId) {
            this.map.setFilter('tract-borders-hover', ['==', ['get', idProperty], this.hoveredFeatureId]);

            // Restore hover state
            const hoveredNumericId = this.layerManager.getNumericFeatureId(this.hoveredFeatureId);
            this.map.setFeatureState(
                { source: 'eviction-tracts', id: hoveredNumericId },
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
