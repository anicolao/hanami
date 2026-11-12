import { MotionTimeline, elementPose, playComponentFlights, moveLiftFlights, boardPieceDimensions } from './motion.js';
import {stackLayers} from '../game/tile-stack.js';
import { tileArt, tokenArt } from '../art.js';

const playerArea=(root,id)=>root.querySelector(`[data-player="${id}"]`)||root.querySelector(`[data-player-summary="${id}"]`);
const zone=element=>element.closest('[data-cell-wrapper]')?'board':element.closest('[data-held-move]')?'holding':element.closest('.draw-bag')?'bag':element.closest('.hand')?'hand':element.closest('.private-captures')?'captured':'public';
const key=p=>`${p.owner}:${p.tile}`;
function record(element) {
  if(!element)return null;
  const component=element.matches('.painted-tile')?element:element.querySelector('.painted-tile')||element;
  return {zone:zone(component),from:elementPose(component),art:component.outerHTML,clone:component.cloneNode(true)};
}
function hiddenHandPose(root,player,area,size=boardPieceDimensions(root)) {
  const anchor=area.querySelector('.privacy-screen')||area,box=anchor.getBoundingClientRect();
  const visible=box.width>0&&!anchor.closest('[inert],[aria-hidden="true"]')&&getComputedStyle(anchor).visibility!=='hidden';
  let x=box.left+box.width/2,y=box.top+box.height/2,angle=visible?elementPose(anchor).angle:0;
  if(!visible){
    const board=root.querySelector('.board-surface').getBoundingClientRect(),edge=player.edge||'north';
    x=board.left+board.width*(edge.endsWith('-west')?.25:edge.endsWith('-east')?.75:.5);y=board.top+board.height/2;
    if(edge.startsWith('north'))y=board.top+size.height/2;
    else if(edge.startsWith('south'))y=board.bottom-size.height/2;
    else if(edge==='west')x=board.left+size.width/2;
    else if(edge==='east')x=board.right-size.width/2;
  }
  return {left:x-size.width/2,top:y-size.height/2,width:size.width,height:size.height,localWidth:size.width,localHeight:size.height,angle,turn:0};
}
export function captureComponents(root,state) {
  const board=new Map(),hands=new Map(),tokens=new Map(),bags=new Map(),held=new Map();
  for(const [cell,p] of Object.entries(state.board)) {
    const elements=root.querySelectorAll(`[data-cell-wrapper="${cell}"] .printed-tile`);
    for(const [index,piece]of stackLayers(p).entries())if(elements[index])board.set(key(piece),{...record(elements[index]),cell,piece});
  }
  for(const p of state.players) {
    const area=playerArea(root,p.id);
    if(!area)continue;
    for(const el of area.querySelectorAll('[data-tile]'))hands.set(`${p.id}:${el.dataset.tile}`,record(el));
    const holding=area.querySelector('[data-held-move]');if(holding)held.set(p.id,record(holding));
    const bag=area.querySelector('.draw-bag .printed-tile');
    const origin=record(bag||area.querySelector('.privacy-screen')||area);
    if(!bag)origin.from=hiddenHandPose(root,p,area);
    bags.set(p.id,origin);
  }
  for(const el of root.querySelectorAll('[data-token]'))tokens.set(el.dataset.token,record(el));
  return {board,hands,tokens,bags,held};
}
export class GameMotion {
  constructor(root,complete,{retainTimeline=false,onUpdate=()=>{}}={}) {
    this.root=root;this.complete=complete;this.retainTimeline=retainTimeline;this.transients=[];this.holding=null;
    this.timeline=new MotionTimeline(root,t=>{
      root.querySelector('[data-table-view]')?.setAttribute('data-motion-idle',String(!t.running));
      root.classList.toggle('components-moving',t.running);
      onUpdate(t);
      if(this.holding&&t.time>=this.holding.until)this.holding.element.style.visibility='hidden';
    });
  }
  get running(){return this.timeline.running;}
  setDropOrigin(gesture){this.cancelDrop();gesture.retained=true;this.dropOrigin=gesture;}
  cancelDrop(){if(this.dropOrigin){this.dropOrigin.retained=false;this.dropOrigin.release();}this.dropOrigin=null;}
  restoreDrop(){const source=this.dropOrigin&&this.root.querySelector(this.dropOrigin.selector);if(source)source.style.visibility='hidden';}
  finish(){this.timeline.clear();for(const el of this.transients)el.remove();this.transients=[];this.holding=null;this.root.classList.remove('components-moving');this.root.querySelector('[data-table-view]')?.setAttribute('data-motion-idle','true');}
  play(flights,settings){
    const drop=this.dropOrigin;
    if(drop){
      const landing=flights.find(f=>(f.target||f.find?.())?.closest('[data-cell-wrapper]')?.dataset.cellWrapper===drop.cell);
      if(landing){
        const settle=Math.min(160,settings.duration),oldDuration=landing.duration??settings.duration;
        Object.assign(landing,{from:drop.from,source:'drag',duration:settle,delay:0,arc:0});
        // Move's displaced tile departs as soon as the dragged Move settles.
        for(const flight of flights)if(flight!==landing&&flight.delay===oldDuration)flight.delay=settle;
        this.cancelDrop();
      }
    }
    this.root.dataset.motionPlan=JSON.stringify(flights.map(f=>{
      const target=f.target||f.find?.();
      return {source:f.source||'unknown',target:target?zone(target):'missing',delay:f.delay||0,duration:f.duration??settings.duration,arc:f.arc??settings.arc,flip:!!f.flip,speed:settings.speed};
    }));
    this.root.dataset.motionFlights=String(flights.length);
    this.root.dataset.motionDuration=String(settings.duration);
    this.root.dataset.motionSpeed=String(settings.speed);
    playComponentFlights(this.timeline,flights,settings,()=>{if(!this.retainTimeline)this.finish();this.complete?.();});
    if(this.timeline.running)this.root.querySelector('[data-table-view]')?.setAttribute('data-motion-idle','false');
  }
  transit(player,art,origin=null) {
    const area=playerArea(this.root,player);if(!area)return null;
    const el=document.createElement('div');el.className='component-transit';el.innerHTML=art;el.setAttribute('aria-hidden','true');
    const size=boardPieceDimensions(this.root),tile=!!el.querySelector('.printed-tile');
    const dimensions=tile?size:{width:size.width*.65,height:size.width*.65};
    // These are public animation targets, never private hand contents.
    const anchor=origin||hiddenHandPose(this.root,{edge:area.className.match(/edge-([a-z-]+)/)?.[1]||'north'},area,dimensions);
    const pose={left:anchor.left+anchor.width/2-dimensions.width/2,top:anchor.top+anchor.height/2-dimensions.height/2,angle:anchor.angle};
    Object.assign(el.style,{position:'fixed',left:`${pose.left}px`,top:`${pose.top}px`,width:`${dimensions.width}px`,height:`${dimensions.height}px`,transform:`rotate(${pose.angle}deg)`});
    this.root.append(el);this.transients.push(el);return el;
  }
  transition(before,previous,next,event,settings) {
    const flights=[],used=new Set(),intent=event?.intent||{};
    const add=(record,target,extra={})=>{if(record&&target){flights.push({from:record.from,source:record.zone,target,...extra});return true;}return false;};
    const targetCell=cell=>this.root.querySelector(`[data-cell-wrapper="${cell}"] .printed-tile`);
    if(intent.type==='move-cancel') {
      const piece=previous.board[intent.source];
      add(before.held.get(piece.owner),targetCell(intent.source));
      add(before.board.get(key(piece)),playerArea(this.root,piece.owner)?.querySelector('[data-tile="move"] .printed-tile'));
      this.play(flights,settings);return;
    }
    if(intent.type==='move-lift') {
      const piece=previous.board[intent.source],moving=before.board.get(key(piece));
      const move=before.hands.get(`${piece.owner}:move`);
      const flights=moveLiftFlights({moveFrom:move.from,tileFrom:moving.from,replacement:()=>targetCell(intent.source),holding:()=>this.root.querySelector('[data-held-move] .printed-tile')},settings);
      flights[0].source='hand';flights[1].source='board';
      this.play(flights,settings);return;
    }
    // Move is one immutable event, but remote viewers still see the same three legs.
    const moved=next.board[intent.destination],oldSource=previous.board[intent.source];
    if(intent.type==='move'&&moved&&oldSource) {
      const owner=moved.owner,held=before.held.get(owner),moving=before.board.get(key(oldSource));
      if(held)add(held,targetCell(intent.destination));
      else if(moving) {
        const holding=this.transit(owner,moving.art,before.bags.get(owner)?.from);
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
      add(origin,target,{flip:!!old&&old.piece.facedown!==piece.facedown,arc:old&&(old.cell===cell||old.piece.facedown!==piece.facedown)?0:settings.arc,fromArt:old?.art||'',underlay:covered?.clone||null});
    }
    // Refill uses the same complete-piece perspective turn as the lab.
    for(const p of next.players) {
      const oldPlayer=previous.players.find(old=>old.id===p.id);
      const area=playerArea(this.root,p.id);
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
          const back=this.transit(p.id,tileArt({id:'back'},index,true,'hand'),before.bags.get(p.id)?.from);
          add(origin,back,{delay:order++*160,flip:false});
        }
      }
      let captureOrder=0;
      for(const token of p.captured) {
        if(oldPlayer.captured.some(t=>t.id===token.id))continue;
        const origin=before.tokens.get(token.id);
        const target=area.querySelector(`[data-token="${token.id}"]`)||this.transit(p.id,tokenArt(token.type,false,'captured'),before.bags.get(p.id)?.from);
        add(origin,target,{delay:captureOrder++*130});
      }
    }
    // Public token swaps and ties also travel from their original park positions.
    for(const el of this.root.querySelectorAll('[data-token]')) {
      const origin=before.tokens.get(el.dataset.token);if(!origin||flights.some(f=>f.target===el))continue;
      // A hand/layout change does not move already captured celebrations.
      if(origin.zone==='captured'&&zone(el)==='captured')continue;
      const to=elementPose(el);if(Math.hypot(to.left-origin.from.left,to.top-origin.from.top)>2)add(origin,el);
    }
    this.play(flights,settings);
  }
}
