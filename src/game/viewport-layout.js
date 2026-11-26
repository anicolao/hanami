// Compare the actual board rectangles, rather than treating every wide screen
// like a phone. A side hand earns its space only when the larger board nearly
// fills the height: at most one hex plus the ordinary gap remains unused.
export function viewportLayout({width,height,aspect,pieceFraction,playerCount=2}) {
 const usableWidth=width-8,usableHeight=height-8;
 const landscape=width>height;
 const minimumDock=40; // Graphical hand only; status and controls overlay the map.
 const bottomWidth=landscape?Math.min(usableWidth,Math.max(0,height-14-minimumDock)*aspect):usableWidth;
 const sideMat=Math.max(72,Math.min(130,width*.08));
 const sideWidth=Math.min(width-sideMat-14,usableHeight*aspect);
 const sideHeight=sideWidth/aspect;
 const hexHeight=sideWidth*pieceFraction/1.1547005384;
 const side=landscape&&sideWidth>bottomWidth+1&&usableHeight-sideHeight<=hexHeight+6;
 const dockHeight=height-14-bottomWidth/aspect;
 // Public type counts need a readable summary for each seat. Use the existing
 // drawer when that information cannot fit below the board; keep hand geometry.
 return {side,boardWidth:side?sideWidth:bottomWidth,dockHeight,compact:landscape&&!side&&dockHeight<180,drawer:side||(landscape&&width<=950)||(playerCount>=2&&dockHeight<playerCount*112)};
}
