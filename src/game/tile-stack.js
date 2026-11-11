// Topmost tile first. Cover retains the complete previous placement underneath.
export function stackLayers(piece) {
 const layers=[];
 for(let layer=piece;layer;layer=layer.covered)layers.push(layer);
 return layers;
}
