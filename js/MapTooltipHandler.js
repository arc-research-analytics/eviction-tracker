/**
 * MapTooltipHandler - Handles map-specific tooltip logic with lat/lng capture
 * Create this as a separate file (MapTooltipHandler.js) and use it with your map
 */
class MapTooltipHandler {
    constructor(map, tooltipManager, censusLayerId, dataLoader = null) {
        this.map = map;
        this.tooltipManager = tooltipManager;
        this.censusLayerId = censusLayerId;
        this.dataLoader = dataLoader;
        this.capturedLatLng = null;
        this.isDragging = false;
        this.dragDetected = false; // Track if actual dragging occurred

        this.setupEventListeners();
    }
    
    setupEventListeners() {
        this.map.on('mousedown', (e) => this.handleMouseDown(e));
        this.map.on('mouseup', (e) => this.handleMouseUp(e));
        this.map.on('mousemove', (e) => this.handleMouseMove(e));
        
        // Detect when dragging actually starts and ends
        this.map.on('dragstart', () => this.handleDragStart());
        this.map.on('dragend', () => this.handleDragEnd());
    }
    
    handleMouseDown(e) {
        this.capturedLatLng = e.lngLat;
        this.isDragging = true;
        this.tooltipManager.hide();
    }
    
    handleMouseUp(e) {
        this.isDragging = false;

        // Don't show tooltip if dragging occurred - let InteractionManager handle it
        if (this.capturedLatLng && !this.dragDetected) {
            const features = this.map.queryRenderedFeatures(e.point, {
                layers: [this.censusLayerId]
            });

            if (features.length > 0) {
                const feature = features[0];
                const content = this.generateTooltipContent(feature);

                this.tooltipManager.show(content, e.point.x, e.point.y);
            }
        }

        // Reset for next interaction
        this.capturedLatLng = null;
        this.dragDetected = false;
    }
    
    handleDragStart() {
        this.dragDetected = true;
    }
    
    handleDragEnd() {
        // Reset dragging state but keep dragDetected until mouseup
        this.isDragging = false;
    }
    
    handleMouseMove(e) {
        if (this.isDragging) {
            return;
        }
        
        const features = this.map.queryRenderedFeatures(e.point, {
            layers: [this.censusLayerId]
        });
        
        if (features.length > 0) {
            const feature = features[0];
            const content = this.generateTooltipContent(feature);
            
            if (this.tooltipManager.isTooltipVisible()) {
                this.tooltipManager.updateContent(content);
                this.tooltipManager.updatePosition(e.point.x, e.point.y);
            } else {
                this.tooltipManager.show(content, e.point.x, e.point.y);
            }
        } else {
            this.tooltipManager.hide();
        }
    }
    
    generateTooltipContent(feature) {
        const properties = feature.properties;

        // Use display value and appropriate text based on display mode
        if (this.dataLoader) {
            const displayMode = this.dataLoader.getDisplayMode();
            const geographyType = this.dataLoader.getGeographyType();
            const displayValue = properties.displayvalue || 0;

            // Build school name prefix if geography is schools
            let schoolNamePrefix = '';
            if (geographyType === 'school' && properties.ShortLabel) {
                schoolNamePrefix = `<span class="tooltip-school-name">${properties.ShortLabel} High School</span>`;
            }

            if (displayMode === 'rate') {
                // Filing rate is already in percentage format from database
                const percentageValue = displayValue.toFixed(2);
                return `
                    ${schoolNamePrefix}
                    <span class="tooltip-count">Filing rate: ${percentageValue}%</span>
                    <span class="tooltip-hint"><i>Click for historic trends</i></span>
                `;
            } else {
                return `
                    ${schoolNamePrefix}
                    <span class="tooltip-count">Eviction filings: ${displayValue.toLocaleString()}</span>
                    <span class="tooltip-hint"><i>Click for historic trends</i></span>
                `;
            }
        } else {
            // Fallback to original behavior if no dataLoader
            const filings = properties.totalfilings || 0;
            return `
                <span class="tooltip-count">Eviction filings: ${filings}</span>
                <span class="tooltip-hint"><i>Click for historic trends</i></span>
            `;
        }
    }
}