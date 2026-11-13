// Chromium's resized-image cache can reuse sampling from a previous layout size.
// Keep each physical mask and celebration size separate while all surfaces use the same art.
export function trackComponentRasterSizes(root = document.body) {
  const tiles = new Set();
  // Mask sampling also depends on the component's position within a pixel.
  // A same-sized hex at another grid coordinate must not reuse that phase.
  const phase=element=>{const box=element.getBoundingClientRect(),density=window.devicePixelRatio||1;const fraction=n=>((n*density%1+1)%1).toFixed(3);return `${fraction(box.left)}x${fraction(box.top)}`;};
  const sizeRasters = tile => {
    for (const element of tile.querySelectorAll('[style*="mask-image"]')) {
      const style = getComputedStyle(element), density = window.devicePixelRatio || 1;
      const width = parseFloat(style.width), height = parseFloat(style.height);
      if (!(width > 0 && height > 0)) continue;
      const size = `${(width * density).toFixed(3)}x${(height * density).toFixed(3)}`;
      const value = element.style.maskImage.replace(/url\(["']?(.*?)["']?\)/g, (_, source) => {
        const url = new URL(source, document.baseURI);
        url.searchParams.set('layout', size);
        url.searchParams.set('phase',phase(element));
        return `url("${url.href}")`;
      });
      if (value !== element.style.maskImage) element.style.maskImage = value;
    }
    // The foil image is alpha-blended over the coloured frame. Reusing its
    // old downsample after a viewport resize changes the edge colours too.
    // Celebration cutouts need the same isolation: their original pixels and
    // native-size caps stay intact, but a phone cannot reuse a table's sampler.
    for (const image of tile.querySelectorAll('.printed-frame > img,.painted-token > .painting')) {
      const style=getComputedStyle(image),density=window.devicePixelRatio||1;
      const width=parseFloat(style.width),height=parseFloat(style.height);
      if(!(width>0&&height>0))continue;
      const url=new URL(image.src,document.baseURI);
      url.searchParams.set('layout',`${(width*density).toFixed(3)}x${(height*density).toFixed(3)}`);
      if(image.closest('.printed-frame'))url.searchParams.set('phase',phase(image));
      if(image.src!==url.href)image.src=url.href;
    }
  };
  const resize = new ResizeObserver(entries => entries.forEach(({target}) => sizeRasters(target)));
  const visit = (node, add) => {
    if (!(node instanceof Element)) return;
    const found = [...(node.matches('.printed-tile,.painted-token') ? [node] : []), ...node.querySelectorAll('.printed-tile,.painted-token')];
    for (const tile of found) {
      if (add) {
        if (tiles.has(tile) || tile.closest('.component-flight,.component-cover-underlay,.component-drag-ghost')) continue;
        tiles.add(tile);sizeRasters(tile);resize.observe(tile);
      } else { tiles.delete(tile);resize.unobserve(tile); }
    }
  };
  visit(root, true);
  const changes = new MutationObserver(records => {
    for (const record of records) {
      record.removedNodes.forEach(node => visit(node, false));
      record.addedNodes.forEach(node => visit(node, true));
    }
  });
  changes.observe(root, {childList:true,subtree:true});
  const refresh = () => tiles.forEach(sizeRasters);
  window.addEventListener('resize', refresh);
  return () => {changes.disconnect();resize.disconnect();window.removeEventListener('resize',refresh);tiles.clear();};
}
