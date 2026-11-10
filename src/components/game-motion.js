import { MotionTimeline, elementPose, playComponentFlights, moveLiftFlights } from './motion.js';
import { tileArt, tokenArt } from '../art.js';

const key=p=>`${p.owner}:${p.tile}`;
function record(element) {
  if(!element)return null;
  const component=element.matches('.painted-tile')?element:element.querySelector('.painted-tile')||element;
  return {from:elementPose(component),art:component.outerHTML,clone:component.cloneNode(true)};
}
export function captureComponents(root,state) {
  const board=new Map(),hands=new Map(),tokens=new Map(),bags=new Map(),held=new Map();
  for(const [cell,p] of Object.entries(state.board)) {
    const el=root.querySelector(`[data-cell-wrapper="${cell}"] .printed-tile`);
    if(el)board.set(key(p),{...record(el),cell,piece:p});
  }
  for(const p of state.players) {
    const area=root.querySelector(`[data-player="${p.id}"]`);
    if(!area)continue;
    for(const el of area.querySelectorAll('[data-tile]'))hands.set(`${p.id}:${el.dataset.tile}`,record(el));
    const holding=area.querySelector('[data-held-move]');if(holding)held.set(p.id,record(holding));
    const bag=area.querySelector('.draw-bag .printed-tile');
    const origin=record(bag||area.querySelector('.privacy-screen')||area);
    if(!bag){const pose=origin.from;origin.from={...pose,left:pose.left+pose.width/2-27,top:pose.top+pose.height/2-23.383,width:54,height:46.766,localWidth:54,localHeight:46.766};}
    bags.set(p.id,origin);
  }
  for(const el of root.querySelectorAll('[data-token]'))tokens.set(el.dataset.token,record(el));
  return {board,hands,tokens,bags,held};
}
export class GameMotion {
  constructor(root,complete) {
    this.root=root;this.complete=complete;this.transients=[];this.holding=null;
    this.timeline=new MotionTimeline(root,t=>{
      root.querySelector('[data-table-view]')?.setAttribute('data-motion-idle',String(!t.running));
      root.classList.toggle('components-moving',t.running);
      if(this.holding&&t.time>=this.holding.until)this.holding.element.style.visibility='hidden';
    });
  }
  get running(){return this.timeline.running;}
  finish(){this.timeline.clear();for(const el of this.transients)el.remove();this.transients=[];this.holding=null;this.root.classList.remove('components-moving');this.root.querySelector('[data-table-view]')?.setAttribute('data-motion-idle','true');}
  play(flights,settings){
    this.root.dataset.motionFlights=String(flights.length);
    this.root.dataset.motionDuration=String(settings.duration);
    this.root.dataset.motionSpeed=String(settings.speed);
    playComponentFlights(this.timeline,flights,settings,()=>{this.finish();this.complete?.();});
  }
  transit(player,art) {
    const area=this.root.querySelector(`[data-player="${player}"]`);if(!area)return null;
    const el=document.createElement('div');el.className='component-transit';el.innerHTML=art;el.setAttribute('aria-hidden','true');
    el.style.left='50%';el.style.top='4px';area.append(el);this.transients.push(el);return el;
  }
  moveLift({moveFrom,tileFrom,source},settings) {
    this.play(moveLiftFlights({moveFrom,tileFrom,replacement:()=>this.root.querySelector(`[data-cell-wrapper="${source}"] .printed-tile`),holding:()=>this.root.querySelector('[data-held-move] .printed-tile')},settings),settings);
  }
  transition(before,previous,next,event,settings) {
    const flights=[],used=new Set(),intent=event?.intent||{};
    const add=(record,target,extra={})=>{if(record&&target){flights.push({from:record.from,target,...extra});return true;}return false;};
    const targetCell=cell=>this.root.querySelector(`[data-cell-wrapper="${cell}"] .printed-tile`);
    // Move is one immutable event, but remote viewers still see the same three legs.
    const moved=next.board[intent.destination],oldSource=previous.board[intent.source];
    if(intent.type==='move'&&moved&&oldSource) {
      const owner=moved.owner,held=before.held.get(owner),moving=before.board.get(key(oldSource));
      if(held)add(held,targetCell(intent.destination));
      else if(moving) {
        const holding=this.transit(owner,moving.art);
        const moveFrom=before.hands.get(`${owner}:move`)||before.bags.get(owner);
        if(holding) {
          flights.push(...moveLiftFlights({moveFrom:moveFrom.from,tileFrom:moving.from,replacement:()=>targetCell(intent.source),holding:()=>holding},settings));
          add(record(holding),targetCell(intent.destination),{delay:settings.duration*2+150});
          this.holding={element:holding,until:settings.duration*2+150};
        }
      }
      used.add(key(moved));used.add(`${moved.owner}:move`);
    }
    for(const [cell,piece] of Object.entries(next.board)) {
      const id=key(piece);if(used.has(id))continue;
      const old=before.board.get(id),target=targetCell(cell),was=previous.board[cell];
      if(old&&old.cell===cell&&old.piece.facedown===piece.facedown&&old.piece.direction===piece.direction)continue;
      const origin=old||before.hands.get(id)||before.bags.get(piece.owner);
      const covered=was&&key(was)!==id?before.board.get(key(was)):null;
      add(origin,target,{flip:!!old&&old.piece.facedown!==piece.facedown,fromArt:old?.art||'',underlay:covered?.clone||null});
    }
    // Refill uses the same complete-piece perspective turn as the lab.
    for(const p of next.players) {
      const oldPlayer=previous.players.find(old=>old.id===p.id);
      const area=this.root.querySelector(`[data-player="${p.id}"]`);
      if(!oldPlayer||!area)continue;
      let order=0;
      for(const tile of p.hand) {
        if(oldPlayer.hand.includes(tile))continue;
        const fromBoard=before.board.get(`${p.id}:${tile}`);
        const target=area.querySelector(`[data-tile="${tile}"] .printed-tile`);
        const origin=fromBoard||before.bags.get(p.id);
        if(target)add(origin,target,{delay:order++*160,flip:!fromBoard,fromArt:before.bags.get(p.id)?.art||''});
        else if(origin&&!fromBoard) {
          const index=p.color??next.players.indexOf(p);
          const back=this.transit(p.id,tileArt({id:'back'},index,true,'hand'));
          add(origin,back,{delay:order++*160,flip:false});
        }
      }
      for(const token of p.captured) {
        if(oldPlayer.captured.some(t=>t.id===token.id))continue;
        const origin=before.tokens.get(token.id);
        const target=area.querySelector(`[data-token="${token.id}"]`)||this.transit(p.id,tokenArt(token.type,false,'captured'));
        add(origin,target,{delay:order++*100});
      }
    }
    // Public token swaps and ties also travel from their original park positions.
    for(const el of this.root.querySelectorAll('[data-token]')) {
      const origin=before.tokens.get(el.dataset.token);if(!origin||flights.some(f=>f.target===el))continue;
      const to=elementPose(el);if(Math.hypot(to.left-origin.from.left,to.top-origin.from.top)>2)add(origin,el);
    }
    this.play(flights,settings);
  }
}
