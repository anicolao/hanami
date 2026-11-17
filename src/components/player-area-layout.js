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
    // Old absolute positions must not introduce scrollbars while measuring
    // the new grid. A desktop card can be wider than the entire phone mat.
    footer.style.overflow='clip';
    footer.style.width='';footer.style.marginLeft='';footer.style.height='';
    const side=!!area.closest('.side-hand'),table=!!area.closest('.shared-table');
    const bottomLandscape=!!area.closest('.web:not(.side-hand)')&&innerWidth>innerHeight;
    const pose=elementPose(area),a=pose.angle*Math.PI/180,cos=Math.cos(a),sin=Math.sin(a);
    const bounds=el=>{const r=el.getBoundingClientRect(),dx=r.x+r.width/2-pose.left-pose.width/2,dy=r.y+r.height/2-pose.top-pose.height/2,s=getComputedStyle(el),w=parseFloat(s.width),h=parseFloat(s.height);return{x:dx*cos+dy*sin+pose.localWidth/2-w/2,y:-dx*sin+dy*cos+pose.localHeight/2-h/2,w,h};};
    const handBox=bounds(hand),rowBox=bounds(row),style=getComputedStyle(area),gap=side?4:6;
    const tile=hand.querySelector('.hand-tile .printed-tile');
    const handGap=parseFloat(getComputedStyle(hand).gap)||0;
    const key=`${area.dataset.player}:${pose.localWidth}:${pose.localHeight}:${handBox.w}`;
    const target=tile?parseFloat(getComputedStyle(tile).width):measured.get(key)||(side||table?boardPieceDimensions(root).width:Math.min(100,(handBox.w-handGap*4)/5));
    if(tile)measured.set(key,target);
    if(!(target>0)){footer.style.overflow='';continue;}
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
    const tokens=[...captures.children],token=tokens[0];
    Object.assign(captures.style,{display:'',gridTemplateColumns:'',gridAutoRows:'',padding:''});
    for(const item of tokens){item.style.width='';item.style.height='';}
    const tokenSize=token?parseFloat(getComputedStyle(token).width):0;
    const columns=(width,size)=>Math.max(1,Math.floor(width/(size+2)));
    const trayHeight=(width,size)=>Math.ceil(tokens.length/columns(width,size))*(size+2);
    let best=null;
    // Try the full-size pile first. Only reduce it if the available area cannot
    // fit it alongside a usable card; the face-up tiles remain untouched.
    // Keep celebration thumbnails readable before sacrificing their size
    // to a larger draw pile. Very short screens can use a smaller fallback.
    for(const minimumToken of tokenSize>12?[12,4]:[Math.min(tokenSize,4)]) {
      for(let D=target;D>=Math.min(target,18);D-=1) {
        // Fit the entire collection, with padding for its dark outline. Keep
        // native token size whenever possible; reduce it only if no tray fits.
        for(let T=tokenSize;T>=Math.min(tokenSize,minimumToken);T-=1) {
          // Prefer a separate count caption, but overlay it if short mobile
          // browser chrome leaves too little room for the physical card.
          for(const below of D<40&&!bottomLandscape?[true,false]:[false]) {
            const bw=Math.max(52,D),bh=D/1.1547005384+(below?24:0);
            const trays=tokenSize?['bottom','side','pile']:['none'];
            for(const tray of trays) {
              const captureHeight=tray==='side'?trayHeight(T+2,T):tray==='pile'?trayHeight(bw,T):tray==='bottom'?trayHeight(W,T):0;
              if(tray==='side'&&captureHeight>H+.1)continue;
              const w=W-(tray==='side'?T+2+gap:0),h=H-(tray==='bottom'?captureHeight+gap:0);
              for(const direction of ['horizontal','vertical']) {
                if((side&&direction==='horizontal')||(tray==='pile'&&direction!=='horizontal'))continue;
                const C=card?Math.max(0,direction==='horizontal'?Math.min(h,w-bw-gap):Math.min(w,h-bh-gap)):0;
                const gw=direction==='horizontal'?bw+(card?gap+C:0):Math.max(bw,C);
                const pileHeight=bh+(tray==='pile'?captureHeight+2:0);
                const gh=Math.max(direction==='horizontal'?Math.max(pileHeight,C):bh+(card?gap+C:0),tray==='side'?captureHeight:0);
                if(gw>w+.1||gh>h+(table?4:.1)||C<(card?Math.min(32,W):0))continue;
                if(!best||C>best.C)best={D,bw,bh,C,gw,gh,w,h,tray,direction,below,T,captureHeight};
              }
            }
          }
          if(best)break;
        }
        if(best)break;
      }
      if(best)break;
    }
    if(!best){footer.style.overflow='';continue;}
    const {D,bw,bh,C,gw,gh,w,tray,direction,below,T,captureHeight}=best;
    if(side){H=gh+(tray==='bottom'?captureHeight+gap:0);footer.style.height=`${H}px`;}
    const h=H-(tray==='bottom'?captureHeight+gap:0),x=(w-gw)/2,y=(h-gh)/2;
    const place=(el,left,top,width,height)=>{if(el)Object.assign(el.style,{left:`${left}px`,top:`${top}px`,width:`${width}px`,height:`${height}px`});};
    const bagX=x+(direction==='vertical'?(gw-bw)/2:0),bagY=y+(direction==='horizontal'?(gh-bh-(tray==='pile'?captureHeight+2:0))/2:0);
    place(bag,bagX,bagY,bw,bh);
    place(card,x+(direction==='horizontal'?bw+gap:(gw-C)/2),y+(direction==='vertical'?bh+gap:(gh-C)/2),C,C);
    bag.style.setProperty('--pile-size',`${D}px`);bag.classList.toggle('pile-caption-below',below);
    if(token){
      const width=tray==='pile'?bw:tray==='side'?T+2:W;
      place(captures,tray==='pile'?bagX:tray==='side'?w+gap:0,tray==='pile'?bagY+bh+2:tray==='bottom'?h+gap:0,width,tray==='side'?H:captureHeight);
      Object.assign(captures.style,{display:'grid',gridTemplateColumns:`repeat(${columns(width,T)},${T}px)`,gridAutoRows:`${T}px`,gap:'2px',padding:'1px'});
      for(const item of tokens)Object.assign(item.style,{width:`${T}px`,height:`${T}px`});
    }
    captures.dataset.tray=tray;footer.style.overflow='';
  }
}

const observedRoots=new WeakMap();
// Fonts, privacy screens and orientation changes can resize a mat after render.
// Observe the actual tracks, rather than requiring a second window resize.
export function observePlayerAreas(root) {
  let state=observedRoots.get(root);
  if(!state){
    state={frame:0,observer:new ResizeObserver(()=>{
      if(state.frame)return;
      state.frame=requestAnimationFrame(()=>{state.frame=0;layoutPlayerAreas(root);});
    })};
    observedRoots.set(root,state);
  }
  state.observer.disconnect();
  for(const node of root.querySelectorAll('.player-area>header,.player-area .hand-row'))state.observer.observe(node);
}
