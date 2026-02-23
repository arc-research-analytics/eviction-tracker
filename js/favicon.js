(function () {
  'use strict';

  // Extract the rendered SVG from a wa-icon's shadow DOM.
  // Polls until the SVG appears (icons are fetched async from CDN).
  async function getIconSvg(name, variant) {
    const wrapper = document.createElement('div');
    wrapper.style.cssText =
      'position:fixed;left:-9999px;top:0;width:0;height:0;overflow:hidden;';

    const icon = document.createElement('wa-icon');
    icon.setAttribute('name', name);
    if (variant) icon.setAttribute('variant', variant);

    wrapper.appendChild(icon);
    document.body.appendChild(wrapper);

    try {
      await customElements.whenDefined('wa-icon');
      if (icon.updateComplete) await icon.updateComplete;

      // Poll for the SVG — the icon fetches its SVG from CDN asynchronously
      let svg = null;
      for (let i = 0; i < 40 && !svg; i++) {
        await new Promise((r) => setTimeout(r, 50));
        svg = icon.shadowRoot?.querySelector('svg');
      }

      return svg ? svg.cloneNode(true) : null;
    } finally {
      document.body.removeChild(wrapper);
    }
  }

  // Build a favicon data URL from an SVG element, overriding its fill color.
  function buildFaviconUrl(svg, color) {
    if (!svg) return null;
    const clone = svg.cloneNode(true);
    clone.setAttribute('width', '32');
    clone.setAttribute('height', '32');
    clone.setAttribute('fill', color);

    // Replace any currentColor references with the explicit color
    const svgStr = new XMLSerializer()
      .serializeToString(clone)
      .replace(/currentColor/g, color);

    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr);
  }

  async function init() {
    const [solidSvg, regularSvg] = await Promise.all([
      getIconSvg('building', null),      // solid  → used in light mode (dark icon)
      getIconSvg('building', 'regular'), // regular → used in dark mode  (light icon)
    ]);

    const lightModeFavicon = buildFaviconUrl(solidSvg, '#1a1a2e');  // dark fill for light tabs
    const darkModeFavicon  = buildFaviconUrl(regularSvg, '#ffffff'); // white outline for dark tabs

    let link = document.querySelector('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.type = 'image/svg+xml';

    const mq = window.matchMedia('(prefers-color-scheme: dark)');

    function update(isDark) {
      const url = isDark ? darkModeFavicon : lightModeFavicon;
      if (url) link.href = url;
    }

    update(mq.matches);
    mq.addEventListener('change', (e) => update(e.matches));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
