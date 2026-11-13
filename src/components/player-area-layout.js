import {elementPose,boardPieceDimensions} from './motion.js';
const measuredHands=new WeakMap();

// Lay out the utilities inside space the hand already leaves unused. The hand's
// grid track, tile widths and five-tile capacity are never changed by this pass.
// Called synchronously before animation targets are measured, on both routes.
export function layoutPlayerAreas(root) {
  if(!measuredHands.has(root))measuredHands.set(root,new Map());
  const measured=measuredHands.get(root);
  for(const area of root.querySelectorAll('.player-area.private-open')) {
    const footer=area.querySelector('.mat-utilities'),hand=area.querySelector('.hand'),row=area.querySelector('.hand-row');
    if(!footer||!hand||!row)continue;
    footer.style.width='';footer.style.marginLeft='';footer.style.height='';
    const side=!!area.closest('.side-hand'),table=!!area.closest('.shared-table');
    const pose=elementPose(area),a=pose.angle*Math.PI/180,cos=Math.cos(a),sin=Math.sin(a);
    const bounds=el=>{const r=el.getBoundingClientRect(),dx=r.x+r.width/2-pose.left-pose.width/2,dy=r.y+r.height/2-pose.top-pose.height/2,s=getComputedStyle(el),w=parseFloat(s.width),h=parseFloat(s.height);return{x:dx*cos+dy*sin+pose.localWidth/2-w/2,y:-dx*sin+dy*cos+pose.localHeight/2-h/2,w,h};};
    const handBox=bounds(hand),rowBox=bounds(row),style=getComputedStyle(area),gap=side?4:6;
    const tile=hand.querySelector('.hand-tile .printed-tile');
    const handGap=parseFloat(getComputedStyle(hand).gap)||0;
    const key=`${area.dataset.player}:${pose.localWidth}:${pose.localHeight}:${handBox.w}`;
    const target=tile?parseFloat(getComputedStyle(tile).width):measured.get(key)||(side||table?boardPieceDimensions(root).width:Math.min(100,(handBox.w-handGap*4)/5));
    if(tile)measured.set(key,target);
    if(!(target>0))continue;
    // Reserve the space for a full hand, even after tiles have been played.
    const fullWidth=Math.min(handBox.w,target*5+handGap*4);
    const holding=row.querySelector('.held-move');
    const reservedRight=holding?Math.max(handBox.x+(handBox.w+fullWidth)/2,bounds(holding).x+bounds(holding).w):handBox.x+(handBox.w+fullWidth)/2;
    const spare=side||(!table&&!area.closest('.web'))?0:Math.max(0,rowBox.x+rowBox.w-reservedRight-gap);
    const base=bounds(footer).w;
    footer.style.width=`${base+spare}px`;footer.style.marginLeft=`${-spare}px`;
    const W=base+spare;
    let H=bounds(footer).h;
    if(side) {
      const header=bounds(area.querySelector('header'));
      const naturalHand=Math.max(row.scrollHeight,rowBox.h);
      H=Math.max(0,pose.localHeight-parseFloat(style.paddingBottom)-header.y-header.h-naturalHand-2*(parseFloat(style.rowGap)||0));
    }
    const bag=footer.querySelector('.draw-bag'),card=footer.querySelector('.personal-ability'),captures=footer.querySelector('.private-captures');
    const token=captures.firstElementChild,tokenSize=token?parseFloat(getComputedStyle(token).width):0;
    let best=null;
    // Try the full-size pile first. Only reduce it if the available area cannot
    // fit it alongside a usable card; the face-up tiles remain untouched.
    for(let D=target;D>=Math.min(target,18);D-=1) {
      const bw=Math.max(52,D),bh=D/1.1547005384+(D<40?24:0);
      const trays=tokenSize?['bottom','side','pile']:['none'];
      for(const tray of trays) {
        const w=W-(tray==='side'?tokenSize+gap:0),h=H-(tray==='bottom'?tokenSize+gap:0);
        for(const direction of ['horizontal','vertical']) {
          if((side&&direction==='horizontal')||(tray==='pile'&&direction!=='horizontal'))continue;
          const C=card?Math.max(0,direction==='horizontal'?Math.min(h,w-bw-gap):Math.min(w,h-bh-gap)):0;
          const gw=direction==='horizontal'?bw+(card?gap+C:0):Math.max(bw,C);
          const pileHeight=bh+(tray==='pile'?tokenSize+2:0);
          const gh=direction==='horizontal'?Math.max(pileHeight,C):bh+(card?gap+C:0);
          if(gw>w+.1||gh>h+(table?4:.1)||C<(card?Math.min(32,W):0))continue;
          if(!best||C>best.C)best={D,bw,bh,C,gw,gh,w,h,tray,direction};
        }
      }
      if(best)break;
    }
    if(!best)continue;
    const {D,bw,bh,C,gw,gh,w,tray,direction}=best;
    if(side){H=gh+(tray==='bottom'?tokenSize+gap:0);footer.style.height=`${H}px`;}
    const h=H-(tray==='bottom'?tokenSize+gap:0),x=(w-gw)/2,y=(h-gh)/2;
    const place=(el,left,top,width,height)=>{if(el)Object.assign(el.style,{left:`${left}px`,top:`${top}px`,width:`${width}px`,height:`${height}px`});};
    const bagX=x+(direction==='vertical'?(gw-bw)/2:0),bagY=y+(direction==='horizontal'?(gh-bh-(tray==='pile'?tokenSize+2:0))/2:0);
    place(bag,bagX,bagY,bw,bh);
    place(card,x+(direction==='horizontal'?bw+gap:(gw-C)/2),y+(direction==='vertical'?bh+gap:(gh-C)/2),C,C);
    bag.style.setProperty('--pile-size',`${D}px`);bag.classList.toggle('pile-caption-below',D<40);
    if(token)place(captures,tray==='pile'?bagX:tray==='side'?w+gap:0,tray==='pile'?bagY+bh+2:tray==='bottom'?h+gap:0,tray==='pile'?bw:tray==='side'?tokenSize:W,['bottom','pile'].includes(tray)?tokenSize:H);
    captures.dataset.tray=tray;
  }
}
