import './motion.css';
// Animated raster sizes must not replace a static component's decode-cache entry.
function isolateFlightRasters(root) {
  const flightURL=value=>{const url=new URL(value,document.baseURI);url.searchParams.set('motion','flight');return url.href;};
  for(const el of [root,...root.querySelectorAll('*')]) {
    if(el instanceof HTMLImageElement){
      if(el.hasAttribute('src'))el.src=flightURL(el.getAttribute('src'));
      if(el.hasAttribute('srcset'))el.srcset=el.getAttribute('srcset').split(',').map(candidate=>{const [url,width]=candidate.trim().split(/\s+/);return `${flightURL(url)} ${width}`;}).join(', ');
    }
    for(const property of ['maskImage','backgroundImage']){
      if(el.style[property]?.startsWith('url('))el.style[property]=el.style[property].replace(/url\(["']?(.*?)["']?\)/g,(_,url)=>`url("${flightURL(url)}")`);
    }
  }
}

// Pose of the complete physical component, including a shared-table seat's rotation.
export function elementPose(element) {
  const rect=element.getBoundingClientRect(),style=getComputedStyle(element);
  let angle=0;
  for(let node=element;node instanceof Element;node=node.parentElement) {
    const transform=getComputedStyle(node).transform;
    if(transform!=='none'){const matrix=new DOMMatrixReadOnly(transform);angle+=Math.atan2(matrix.b,matrix.a)*180/Math.PI;}
  }
  return {left:rect.left,top:rect.top,width:rect.width,height:rect.height,
    localWidth:parseFloat(style.width)||rect.width,localHeight:parseFloat(style.height)||rect.height,angle,turn:parseFloat(style.getPropertyValue('--tile-turn'))||0};
}

// Shared seekable presentation timeline; it never changes game or fixture state.
export class MotionTimeline {
  constructor(root, update) {
    this.root = root;
    this.update = update || (()=>{});
    this.items = [];
    this.time = 0;
    this.duration = 0;
    this.running = false;
    this.speed = 1;
    this.reverse = false;
    this.last = 0;
    this.frame = 0;
  }
  clear() {
    cancelAnimationFrame(this.frame);
    for (const item of this.items) {
      item.animation.cancel();
      item.flipAnimation?.cancel();
      item.underlay?.remove();
      item.clone.remove();
      item.target.style.visibility = '';
    }
    this.items = [];
    this.running = false;
    this.time = this.duration = 0;
  }
  add({ target, from, duration, delay = 0, arc = 60, easing = 'cubic-bezier(.22,.68,.22,1)', flip = false, fromArt = '', underlay = null }) {
    const piece = target.matches('.painted-tile') ? target : target.querySelector('.painted-tile');
    const element = piece || target;
    const clone = document.createElement('div');
    clone.className = 'component-flight' + (piece ? ' component-tile-flight' : '');
    const content = element.cloneNode(true);
    Object.assign(content.style, {width:'100%',height:'100%',left:'0',top:'0',margin:'0',transform:'none',visibility:'visible'});
    isolateFlightRasters(content);
    clone.append(content);
    clone.setAttribute('aria-hidden', 'true');
    clone.querySelectorAll('button').forEach(button => button.disabled = true);
    this.root.append(clone);
    if (underlay) {
      isolateFlightRasters(underlay);
      underlay.classList.add('component-cover-underlay');
      underlay.setAttribute('aria-hidden', 'true');
      this.root.append(underlay);
    }
    // Keep the turn and flight on the same clock, with a gentle takeoff/landing.
    const flightEasing = flip ? 'ease-in-out' : easing;
    const animation = clone.animate([], { duration, fill: 'both', easing: flightEasing });
    animation.pause();
    const item = { target: element, clone, from, duration, delay, arc, animation, flip, fromArt, underlay };
    this.items.push(item);
    this.duration = Math.max(this.duration, duration + delay);
    this.layoutItem(item);
    element.style.visibility = 'hidden';
    return item;
  }
  layoutItem(item) {
    const to = elementPose(item.target), from = item.from;
    // Rasterize at the larger endpoint; transport only shrinks this layer.
    const width=Math.max(to.localWidth,from.localWidth||from.width),height=to.localHeight*width/to.localWidth;
    Object.assign(item.clone.style, {
      position: 'fixed', left: `${to.left+to.width/2-width/2}px`, top: `${to.top+to.height/2-height/2}px`,
      width: `${width}px`, height: `${height}px`,
      transform: 'none', transformOrigin: '50% 50%', visibility: 'visible', margin: '0',
    });
    if (item.underlay) Object.assign(item.underlay.style, {position:'fixed',left:`${to.left}px`,top:`${to.top}px`,width:`${to.width}px`,height:`${to.height}px`,transform:'none',margin:'0'});
    const dx = from.left+from.width/2-to.left-to.width/2, dy = from.top+from.height/2-to.top-to.height/2;
    const sx = (from.localWidth||from.width) / width, sy = sx, endScale=to.localWidth/width; // A rigid component never stretches.
    const turnDelta=(((from.turn||0)-(to.turn||0)+540)%360)-180;
    const startAngle=(from.angle||0)+turnDelta,endAngle=to.angle||0;
    const transform = (x, y, xScale, yScale, angle) => `translate(${x}px,${y}px) rotate(${angle}deg) scale(${xScale},${yScale})`;
    item.animation.effect.setKeyframes([
      { transform: transform(dx, dy, sx, sy, startAngle), offset: 0 },
      { transform: transform(dx * .5, dy * .5 - item.arc, (sx + endScale) / 2, (sy + endScale) / 2, (startAngle+endAngle)/2), offset: .5 },
      { transform: transform(0, 0, endScale, endScale, endAngle), offset: 1 },
    ]);
    if (item.flip) {
      let inner = item.clone.querySelector('.component-flip-inner');
      if (!inner) {
        const face = item.clone.querySelector('.painted-tile');
        if (!face) return;
        inner = document.createElement('div');
        inner.className = 'component-flip-inner';
        inner.innerHTML = `<div class="component-flip-front">${item.fromArt || face.outerHTML}</div><div class="component-flip-back">${face.outerHTML}</div>`;
        // A dedicated scene keeps perspective independent of the FLIP transport
        // scale and of native button rendering. Only the inner tile turns.
        const stage = document.createElement('div');
        stage.className = 'component-flip-stage';
        isolateFlightRasters(inner);
        stage.append(inner);
        face.replaceWith(stage);
      }
      const stage = inner.parentElement;
      stage.style.perspective = `${Math.max(160, to.width * 3)}px`;
      if (item.flipAnimation) item.flipAnimation.cancel();
      item.flipAnimation = inner.animate([
        { transform: 'translateZ(0px) rotateX(0deg) rotateY(0deg)', offset: 0 },
        { transform: 'translateZ(18px) rotateX(-16deg) rotateY(90deg)', offset: .5 },
        { transform: 'translateZ(0px) rotateX(0deg) rotateY(180deg)', offset: 1 },
      ], { duration: item.duration, fill: 'both', easing: 'ease-in-out' });
      item.flipAnimation.pause();
    }
  }
  relayout() {
    for (const item of this.items) this.layoutItem(item);
    this.paint();
  }
  paint() {
    for (const item of this.items) {
      const time = Math.max(0, Math.min(item.duration, this.time - item.delay));
      item.animation.currentTime = time;
      if (item.flipAnimation) item.flipAnimation.currentTime = time;
      const arrived = this.time >= item.duration + item.delay;
      item.clone.style.visibility = arrived ? 'hidden' : 'visible';
      item.target.style.visibility = arrived ? '' : 'hidden';
      if (item.underlay) item.underlay.style.visibility = arrived ? 'hidden' : 'visible';
    }
    this.update(this);
  }
  seek(fraction) {
    this.running = false;
    cancelAnimationFrame(this.frame);
    this.time = Math.max(0, Math.min(1, fraction)) * this.duration;
    this.paint();
  }
  play(reverse = false, onEnd) {
    if (!this.items.length) return;
    this.reverse = reverse;
    this.onEnd = onEnd;
    this.running = true;
    this.last = performance.now();
    cancelAnimationFrame(this.frame);
    const tick = now => {
      if (!this.running) return;
      this.time += (now - this.last) * this.speed * (this.reverse ? -1 : 1);
      this.last = now;
      this.time = Math.max(0, Math.min(this.duration, this.time));
      this.paint();
      if ((!this.reverse && this.time >= this.duration) || (this.reverse && this.time <= 0)) {
        this.running = false;
        this.paint();
        this.onEnd?.();
      } else this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }
  pause() { this.running = false; cancelAnimationFrame(this.frame); this.paint(); }
}

export function playComponentFlights(timeline, flights, settings, onEnd) {
  timeline.speed=settings.speed;
  for(const f of flights) {
    const target=f.target || f.find?.();
    if(target)timeline.add({...f,target,duration:f.duration??settings.duration,delay:f.delay||0,arc:f.arc??settings.arc});
  }
  timeline.paint();
  if(timeline.items.length)timeline.play(false,onEnd);else onEnd?.();
}
// The production presenter uses this replacement / holding phase for Move.
export function moveLiftFlights({moveFrom,tileFrom,replacement,holding},settings) {
  return [{from:moveFrom,find:replacement},{from:tileFrom,find:holding,delay:settings.duration}];
}
