import {decisionOptions,featureNames as baseNames} from './rl-policy.js';
import {featureNames as hardNames} from './rl-policy-v2.js';
import {cells,strength,tileById,abilityById} from './engine.js';
import {adjacent} from './maps.js';
const types=['sakura','chochin','onigiri'];
const abilities=['torii','taiyaki','dango','bicycle','green-tea','fruit-sandwich','rainy-day','akkorokamui','takoyaki'];
const interactions=[];
for(let race=0;race<3;race++)for(const [a,b] of [[0,3],[2,3],[3,4],[3,5],[3,6],[3,7],[4,5]])interactions.push([race*8+a,race*8+b]);
for(const pair of [[3,11],[11,19],[3,19],[24,28],[24,29],[25,28],[26,28],[27,28],[26,29],[27,29]])interactions.push(pair);
const geometry=new Map();
function parks(s){const key=`${s.map}:${s.players.length}`;if(!geometry.has(key)){const spaces=cells(s);geometry.set(key,spaces.filter(c=>c.kind==='park').map(c=>({id:c.id,around:adjacent(c,spaces)})));}return geometry.get(key);}

// Transfer the fixed two-player weights to count-aware public features. Opponent
// captures cannot be recovered individually in multiplayer: distribute only the
// publicly deducible pool equally, preserving any captures in a simulated move.
// No hidden hand, captured array, deck, seed or event history is consulted.
export function multiplayerFeatures(s,id,intent={type:'end'}){
 const count=s.players.length,supply=count*3+1,ownIndex=s.players.findIndex(p=>p.id===id),p=s.players[ownIndex];
 if(![3,4].includes(count)||!p)throw Error('Multiplayer policy requires three or four players');
 const remaining=types.map(type=>Object.values(s.tokens).flat().filter(t=>t.type===type).length);
 const captured=s.players.map(player=>types.map(type=>player.captured.filter(t=>t.type===type).length));
 for(let k=0;k<3;k++){
  const pool=supply-captured[ownIndex][k]-remaining[k]-s.ties.filter(t=>t.type===types[k]).length;
  const known=captured.reduce((n,row,i)=>n+(i===ownIndex?0:row[k]),0),unknown=Math.max(0,pool-known)/(count-1);
  captured.forEach((row,i)=>{if(i!==ownIndex)row[k]+=unknown;});
 }
 const forecast=captured.map(row=>[...row]),inf=s.players.map(()=>[0,0,0]),near=[0,0,0],danger=[0,0,0],unresolved=[...remaining];
 let prior=captured[ownIndex].reduce((a,b)=>a+b,0)*72,prospectiveTies=s.ties.length;
 for(const park of parks(s))for(const token of s.tokens[park.id]||[]){
  const k=types.indexOf(token.type),open=park.around.filter(c=>c.kind==='land'&&!s.board[c.id]).length;
  const influence=s.players.map(player=>park.around.reduce((n,c)=>n+(s.board[c.id]?.owner===player.id?strength(s,s.board[c.id],token.type):0),0));
  const ours=influence[ownIndex],theirs=Math.max(...influence.filter((_,i)=>i!==ownIndex));
  if(!open){
   const best=Math.max(...influence),leaders=influence.flatMap((n,i)=>best>0&&n===best?[i]:[]);
   unresolved[k]--;prior+=40;
   if(leaders.length===1){const winner=leaders[0];captured[winner][k]++;forecast[winner][k]++;prior+=winner===ownIndex?32:-32;}
   else prospectiveTies++;
  }else{
   prior+=(Math.tanh((ours-theirs)/3)*8+Math.min(ours,10)*.3)/(1+open*.5);
   const scale=1.8*Math.sqrt(open)+.8,best=Math.max(...influence),weights=influence.map(n=>Math.exp((n-best)/scale)),sum=weights.reduce((a,b)=>a+b,0);
   weights.forEach((n,i)=>{forecast[i][k]+=n/sum;inf[i][k]+=Math.min(influence[i],12)/(1+open);});
   if(open===1){near[k]+=+(ours>theirs);danger[k]+=+(theirs>ours);}
  }
 }
 const opponentMax=(rows,k)=>Math.max(...rows.filter((_,i)=>i!==ownIndex).map(row=>row[k]));
 const races=types.map((_,k)=>({own:captured[ownIndex][k],other:opponentMax(captured,k),margin:Math.tanh((captured[ownIndex][k]-opponentMax(captured,k))/2),projected:Math.tanh((forecast[ownIndex][k]-opponentMax(forecast,k))/2),inf:inf[ownIndex][k],enemy:opponentMax(inf,k),near:near[k],danger:danger[k]})).sort((a,b)=>b.projected-a.projected);
 const terminal=unresolved.some(n=>n===0)||prospectiveTies>=4;
 const rows=captured.map((row,i)=>{
  const won=row.map((n,k)=>n>0&&captured.every((other,j)=>i===j||n>other[k]));
  return {index:i,points:won.filter(Boolean).length,other:row.reduce((n,v,k)=>n+(won[k]?0:v),0),total:row.reduce((a,b)=>a+b,0)};
 });
 const points=Math.max(...rows.map(row=>row.points));let leaders=rows.filter(row=>row.points===points);
 if(points&&leaders.length>1){const other=Math.max(...leaders.map(row=>row.other));leaders=leaders.filter(row=>row.other===other);}
 const total=Math.max(...leaders.map(row=>row.total));leaders=leaders.filter(row=>row.total===total);
 const result=leaders.some(row=>row.index===ownIndex)?leaders.length===1?1:0:-1;
 const chances=races.map(r=>(r.projected+1)/2),features=races.flatMap(r=>[r.own/supply,r.other/supply,r.margin,r.projected,r.inf/40,r.enemy/40,r.near/supply,r.danger/supply]);
 const t=tileById(intent.tile||intent.a),spent=intent.type==='place'||intent.type==='ability'&&['taiyaki','dango'].includes(abilityById(p.ability)?.type);
 features.push(chances[0]*chances[1]+chances[0]*chances[2]+chances[1]*chances[2]-2*chances[0]*chances[1]*chances[2],races.reduce((n,r)=>n+r.projected,0)/3,races[2].projected,races[0].projected,
  (races.reduce((n,r)=>n+r.own-r.other,0))/(supply*3),1-unresolved.reduce((a,b)=>a+b,0)/(supply*3),terminal?result:0,+terminal,
  spent?(t?.strength||0)/4:0,spent&&['cat','boat','draw','cover'].includes(t?.type)?(t.strength||0)/4:0,+!!t?.fast,+!!p.usedAbility,+(t?.type==='draw'),+(t?.type==='cover'),+(intent.type==='move'),+(intent.type==='end'),
  ...abilities.map(kind=>+(abilityById(p.ability)?.type===kind&&!p.usedAbility)));
 const tiles=p.hand.map(tileById),wild=t=>['cat','boat','draw','cover'].includes(t.type);
 const resources=[tiles.length/10,tiles.reduce((n,t)=>n+(t.strength||0),0)/30,tiles.filter(t=>t.fast).length/5,tiles.filter(wild).length/5];
 for(const type of types){const k=types.indexOf(type),reserve=tiles.reduce((n,t)=>n+(t.type===type||wild(t)?t.strength||0:0),0)/20;resources.push(reserve,reserve*Math.tanh((captured[ownIndex][k]-opponentMax(captured,k))/2),reserve*remaining[k]/supply);}
 return {prior,features,extended:[...features,...interactions.map(([a,b])=>features[a]*features[b]),...resources]};
}
export function chooseMultiplayerIntent(view,id,model){
 const names=model.schemaVersion===1?baseNames:hardNames;
 if(model.features.join('|')!==names.join('|')||model.weights.length!==names.length)throw Error('Incompatible multiplayer model');
 const options=decisionOptions(view,id);if(!options.length)return null;
 const base=multiplayerFeatures(view,id).prior;
 return options.map(option=>{
  const info=multiplayerFeatures(option.next,id,option.intent),features=model.schemaVersion===1?info.features:info.extended;
  if(features.length!==names.length||features.some(n=>!Number.isFinite(n)))throw Error('Invalid multiplayer features');
  const prior=option.intent.type==='choose-ability'?(abilities.length-abilities.indexOf(abilityById(option.intent.ability).type))*.025:Math.atan((info.prior-base-option.cost)/4);
  return {intent:option.intent,score:prior+features.reduce((n,value,i)=>n+value*model.weights[i],0)};
 }).sort((a,b)=>b.score-a.score)[0].intent;
}
