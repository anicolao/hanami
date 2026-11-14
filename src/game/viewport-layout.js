// Compare the actual board rectangles, rather than treating every wide screen
// like a phone. A side hand earns its space only when the larger board nearly
// fills the height: at most one hex plus the ordinary gap remains unused.
export function viewportLayout({width,height,aspect,pieceFraction}) {
 const usableWidth=width-8,usableHeight=height-8;
 const landscape=width>height;
 const minimumDock=88; // 24px controls, 48px pieces/card, padding and row gap.
 const bottomWidth=landscape?Math.min(usableWidth,Math.max(0,height-14-minimumDock)*aspect):usableWidth;
 const sideMat=Math.max(72,Math.min(130,width*.08));
 const sideWidth=Math.min(width-sideMat-14,usableHeight*aspect);
 const sideHeight=sideWidth/aspect;
 const hexHeight=sideWidth*pieceFraction/1.1547005384;
 const side=landscape&&sideWidth>bottomWidth+1&&usableHeight-sideHeight<=hexHeight+6;
 const dockHeight=height-14-bottomWidth/aspect;
 return {side,boardWidth:side?sideWidth:bottomWidth,dockHeight,compact:landscape&&!side&&dockHeight<180,drawer:side||(landscape&&!side&&dockHeight<180&&width<=950)};
}
