import {connect,repository,scope} from '../game/repository.js';
import {initial,replay,currentPlayer,cells,tileById} from '../game/engine.js';
import {computerObservation} from '../game/computer.js';
import {decisionOptions} from '../game/rl-policy.js';
import {players} from '../catalog.js';

export const canPrepareLocalGame=import.meta.env.DEV&&import.meta.env.VITE_USE_FIREBASE_EMULATORS==='true';

// This controller only authors legal events in local emulators. The iframe
// receives an ordinary invitation URL, never a replacement state or renderer.
export async function prepareRouteScene({route,map,count,scene}){
 if(!canPrepareLocalGame)throw Error('Local game setup requires VITE_USE_FIREBASE_EMULATORS=true.');
 const {db,uid}=await connect();
 const code='LAB'+Array.from(crypto.getRandomValues(new Uint8Array(5)),n=>(n%36).toString(36)).join('').toUpperCase();
 let state=initial(),revision=-1,problem,repo;
 const waiters=new Set();
 const changed=()=>{for(const wake of waiters)wake();};
 repo=repository(db,uid,code,events=>{state=replay(events);revision=events.length;changed();},error=>{problem=error;changed();});
 const waitFor=target=>new Promise((resolve,reject)=>{
  const check=()=>{if(problem||revision>=target){clearTimeout(timer);waiters.delete(check);problem?reject(problem):resolve();}};
  const timer=setTimeout(()=>{waiters.delete(check);reject(Error('Local emulators did not acknowledge the game events.'));},15000);
  waiters.add(check);check();
 });
 const add=async intent=>{const target=revision+1;await repo.append(intent);await waitFor(target);};
 try{
  await waitFor(0);
  const tabletop=route==='tabletop',colors=[0,3,1,2],edges=['south-west','north-east','south-east','north-west'];
  await add({type:'create',name:'Indigo',mode:tabletop?'tabletop':'web',map,capacity:count,color:0,...(tabletop?{edge:edges[0]}:{})});
  for(let i=1;i<count;i++)await add(tabletop?{type:'join',name:players[colors[i]].name,color:colors[i],edge:edges[i]}:{type:'add-computer',difficulty:'easy'});
  if(scene!=='gathering'){
   await add({type:'start',seed:`layout-lab:${map}:${count}`});
   if(scene==='midgame'){
    // Three complete rounds leave the human on turn with a real full hand.
    // Candidate legality comes from the same production reducer as live play.
    const stopAt=1+count*3;
    while(state.phase==='playing'&&state.turnNumber<stopAt){
     const p=currentPlayer(state);
     if(state.placed){await add({type:'end',playerId:p.id});continue;}
     const choices=decisionOptions(computerObservation(state,p.id),p.id).filter(row=>row.intent.type==='place');
     const spaces=cells(state),distance=intent=>{const c=spaces.find(c=>c.id===intent.cell);return Math.hypot(c.x-50,(c.y-50)*.47)-(tileById(intent.tile).strength||0);};
     choices.sort((a,b)=>distance(a.intent)-distance(b.intent));
     if(!choices.length)break;
     await add(choices[0].intent);
    }
   }
  }
  return {code,scope,revision,turn:currentPlayer(state)?.name};
 }finally{repo.close();}
}
