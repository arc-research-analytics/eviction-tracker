/**
 * MapTooltipHandler - Handles map-specific tooltip logic with lat/lng capture
 * Create this as a separate file (MapTooltipHandler.js) and use it with your map
 */
class MapTooltipHandler {
    constructor(map, tooltipManager, censusLayerId) {
        this.map = map;
        this.tooltipManager = tooltipManager;
        this.censusLayerId = censusLayerId;
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
        console.log('🚨 MapTooltipHandler hiding tooltip on mousedown');
        this.tooltipManager.hide();
        
        console.log('🖱️ [TIMING 1] MapTooltipHandler mousedown - Captured lat/lng:', {
            timestamp: Date.now(),
            lat: e.lngLat.lat.toFixed(6),
            lng: e.lngLat.lng.toFixed(6),
            screenPoint: { x: e.point.x, y: e.point.y }
        });
    }
    
    handleMouseUp(e) {
        this.isDragging = false;
        
        console.log('🖱️ [TIMING 4] MapTooltipHandler mouseup:', {
            timestamp: Date.now(),
            currentMousePos: { x: e.point.x, y: e.point.y },
            currentLatLng: { lat: e.lngLat.lat.toFixed(6), lng: e.lngLat.lng.toFixed(6) },
            capturedLatLng: this.capturedLatLng ? {
                lat: this.capturedLatLng.lat.toFixed(6),
                lng: this.capturedLatLng.lng.toFixed(6)
            } : null,
            dragDetected: this.dragDetected,
            willShowTooltip: this.capturedLatLng && !this.dragDetected
        });
        
        // Don't show tooltip if dragging occurred - let InteractionManager handle it
        if (this.capturedLatLng && !this.dragDetected) {
            console.log('🎯 MapTooltipHandler showing tooltip for click (no drag detected)');
            
            const features = this.map.queryRenderedFeatures(e.point, {
                layers: [this.censusLayerId]
            });
            
            if (features.length > 0) {
                const feature = features[0];
                const content = this.generateTooltipContent(feature);
                
                console.log('📍 Tooltip at current mouse position:', { x: e.point.x, y: e.point.y });
                console.log('🚨 TOOLTIP CONFLICT? MapTooltipHandler is calling tooltipManager.show()');
                this.tooltipManager.show(content, e.point.x, e.point.y);
            } else {
                console.log('❌ No features found at current mouse position');
            }
        }
        
        // Reset for next interaction
        this.capturedLatLng = null;
        this.dragDetected = false;
    }
    
    handleDragStart() {
        this.dragDetected = true;
        console.log('🔄 [TIMING 2] MapTooltipHandler drag started - dragDetected = true', { timestamp: Date.now() });
    }
    
    handleDragEnd() {
        // Reset dragging state but keep dragDetected until mouseup
        this.isDragging = false;
        console.log('🏁 [TIMING 3] MapTooltipHandler drag ended - isDragging = false, dragDetected still =', this.dragDetected, { timestamp: Date.now() });
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
        const filings = properties.totalfilings || 0;
        
        return `
            <span class="tooltip-count">Eviction filings: ${filings}</span>
            <span class="tooltip-hint"><i>Click for historic trends</i></span>
        `;
    }
}