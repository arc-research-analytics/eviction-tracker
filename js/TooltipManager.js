/**
 * TooltipManager - Handles tooltip creation, positioning, animation, and lifecycle
 */
class TooltipManager {
    constructor() {
        this.tooltip = null;
        this.tooltipPos = { x: 0, y: 0 };
        this.targetPos = { x: 0, y: 0 };
        this.animationId = null;
        this.isVisible = false;
        
        this.createTooltip();
    }

    /**
     * Create the tooltip DOM element and add it to the page
     */
    createTooltip() {
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'tooltip';
        this.tooltip.style.display = 'none';
        document.body.appendChild(this.tooltip);
    }

    /**
     * Show tooltip with specified content at given position
     */
    show(content, x, y) {
        this.tooltip.innerHTML = content;
        this.tooltip.style.display = 'block';
        this.isVisible = true;
        
        // Initialize positions
        this.tooltipPos.x = x;
        this.tooltipPos.y = y;
        this.targetPos.x = x;
        this.targetPos.y = y;
        
        // Start smooth animation
        this.startAnimation();
    }

    /**
     * Hide the tooltip and stop animations
     */
    hide() {
        if (this.tooltip) {
            this.tooltip.style.display = 'none';
            this.isVisible = false;
        }
        
        this.stopAnimation();
    }

    /**
     * Update tooltip content without changing position
     */
    updateContent(content) {
        if (this.tooltip && this.isVisible) {
            this.tooltip.innerHTML = content;
        }
    }

    /**
     * Update tooltip target position for smooth movement
     */
    updatePosition(x, y) {
        if (!this.isVisible) return;
        
        // Calculate smart positioning to avoid screen edges
        const position = this.calculateOptimalPosition(x, y);
        
        // Update target position (animation will smoothly move towards it)
        this.targetPos.x = position.x;
        this.targetPos.y = position.y;
    }

    /**
     * Calculate optimal tooltip position to avoid screen edges
     */
    calculateOptimalPosition(x, y) {
        let left = x + 10;
        let top = y - 10;
        
        // Get tooltip dimensions for better positioning
        const tooltipRect = this.tooltip.getBoundingClientRect();
        const tooltipWidth = tooltipRect.width || 200; // fallback width
        const tooltipHeight = tooltipRect.height || 60; // fallback height
        
        // Flip horizontally if too close to right edge
        if (left + tooltipWidth > window.innerWidth) {
            left = x - tooltipWidth - 10;
        }
        
        // Flip vertically if too close to bottom edge
        if (top + tooltipHeight > window.innerHeight) {
            top = y - tooltipHeight - 10;
        }
        
        // Ensure tooltip doesn't go off left or top edges
        left = Math.max(10, left);
        top = Math.max(10, top);
        
        return { x: left, y: top };
    }

    /**
     * Start the smooth tooltip animation
     */
    startAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        this.animateTooltip();
    }

    /**
     * Stop the tooltip animation
     */
    stopAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    /**
     * Smooth animation function for tooltip movement
     */
    animateTooltip() {
        // Linear interpolation for smooth following
        const lerp = 0.15; // Lower = more lag/smoothness, Higher = more responsive
        this.tooltipPos.x += (this.targetPos.x - this.tooltipPos.x) * lerp;
        this.tooltipPos.y += (this.targetPos.y - this.tooltipPos.y) * lerp;

        this.tooltip.style.left = Math.round(this.tooltipPos.x) + 'px';
        this.tooltip.style.top = Math.round(this.tooltipPos.y) + 'px';

        // Continue animation if tooltip is visible
        if (this.isVisible) {
            this.animationId = requestAnimationFrame(() => this.animateTooltip());
        }
    }

    /**
     * Set tooltip position immediately without animation
     */
    setPositionImmediate(x, y) {
        const position = this.calculateOptimalPosition(x, y);
        
        this.tooltipPos.x = position.x;
        this.tooltipPos.y = position.y;
        this.targetPos.x = position.x;
        this.targetPos.y = position.y;
        
        if (this.tooltip) {
            this.tooltip.style.left = position.x + 'px';
            this.tooltip.style.top = position.y + 'px';
        }
    }

    /**
     * Check if tooltip is currently visible
     */
    isTooltipVisible() {
        return this.isVisible;
    }

    /**
     * Clean up tooltip element and animations
     */
    destroy() {
        this.stopAnimation();
        
        if (this.tooltip && this.tooltip.parentNode) {
            this.tooltip.parentNode.removeChild(this.tooltip);
            this.tooltip = null;
        }
    }
}
