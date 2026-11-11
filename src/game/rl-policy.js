import {applyChoice,availablePlacement,cells,currentPlayer,strength,tileById,abilityById} from './engine.js';
import {adjacent,neighbors} from './maps.js';
const types=['sakura','chochin','onigiri'];
const abilities=['torii','taiyaki','dango','bicycle','green-tea','fruit-sandwich','rainy-day','akkorokamui','takoyaki'];
export const featureNames=[
 ...[0,1,2].flatMap(rank=>['owned','opponent','margin','forecast-margin','influence','opponent-influence','near-win','near-loss'].map(name=>`race-${rank}-${name}`)),
 'forecast-two-majorities','forecast-majority-balance','minimum-forecast-margin','maximum-forecast-margin','capture-balance','progress','terminal-result','terminal',
 'spent-strength','spent-wild-strength','fast','ability-used','draw','cover','move','end',
 ...abilities.map(name=>`ability-${name}`),
];
const geometry=new Map();
function boardGeometry(s){const key=`${s.map}:${s.players.length}`;if(!geometry.has(key)){const spaces=cells(s);geometry.set(key,{spaces,parks:spaces.filter(c=>c.kind==='park').map(c=>({id:c.id,around:adjacent(c,spaces)})),byId:new Map(spaces.map(c=>[c.id,c]))});}return geometry.get(key);}
const sigmoid=x=>1/(1+Math.exp(-Math.max(-30,Math.min(30,x))));
const dot=(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0);

function* abilityIntents(s,p,spaces,byId){
 const kind=abilityById(p.ability)?.type,board=Object.values(s.board),tokens=Object.values(s.tokens).flat();
 const pair=(a,b)=>({type:'ability',a,b});
 if(kind==='torii'||kind==='fruit-sandwich'){
  for(let i=0;i<tokens.length;i++)for(let j=i+1;j<tokens.length;j++)if(tokens[i].type!==tokens[j].type)yield pair(tokens[i].id,tokens[j].id);
 }else if(kind==='takoyaki'){for(const a of p.captured)for(const b of s.ties)yield pair(a.id,b.id);
 }else if(kind==='taiyaki'||kind==='dango'){
  for(const id of p.hand)for(const c of spaces)if(kind==='taiyaki'?c.kind==='water'&&!s.board[c.id]:tileById(id).strength<=2&&c.kind==='land')yield pair(id,c.id);
 }else if(kind==='akkorokamui'||kind==='rainy-day'){for(const a of board)yield {type:'ability',a:a.cell};
 }else if(kind==='green-tea'){for(const a of board.filter(a=>a.owner===p.id))for(const b of board)if(a.cell!==b.cell)yield pair(a.cell,b.cell);
 }else if(kind==='bicycle'){for(const a of board)for(const b of spaces)if(b.kind==='land'&&!s.board[b.id]&&neighbors(byId.get(a.cell),b))yield pair(a.cell,b.id);}
}

// This function receives only computerObservation, never the full game state.
export function decisionOptions(view,playerId){
 const p=view.players.find(p=>p.id===playerId);if(!p)return [];
 if(view.phase==='choosing'&&!p.ability)return p.abilityOptions.map(ability=>({intent:{type:'choose-ability',playerId,ability},next:applyChoice(view,p.controller,{type:'choose-ability',playerId,ability}),cost:0}));
 if(view.phase!=='playing'||view.undoRequest||currentPlayer(view)?.id!==playerId)return [];
 const {spaces,byId}=boardGeometry(view),out=[];
 const add=(intent,cost)=>{intent={...intent,playerId};try{out.push({intent,next:applyChoice(view,p.controller,intent),cost});}catch{/* Production rules validate every proposed action. */}};
 add({type:'end'},0);
 for(const id of p.hand){const t=tileById(id);if(t.type==='move')continue;
  for(const c of spaces)if(availablePlacement(view,p.id,id,c.id))for(let direction=0;direction<(t.type==='copy'?6:1);direction++)add({type:'place',tile:id,cell:c.id,...(t.type==='copy'?{direction}:{})},.08+(t.strength||0)*.015);
 }
 if(p.hand.includes('move'))for(const source of Object.values(view.board))if(source.owner===p.id&&!tileById(source.tile).fast&&!source.facedown)for(const c of spaces)if(c.kind==='land'&&!view.board[c.id])add({type:'move',source:source.cell,destination:c.id},.1);
 if(!p.usedAbility&&!view.placed&&!view.abilityUsedThisTurn)for(const i of abilityIntents(view,p,spaces,byId))add(i,1);
 return out;
}

function winnerFromCounts(own,other){
 const ours=own.map((n,i)=>n>other[i]&&n>0),theirs=other.map((n,i)=>n>own[i]&&n>0);
 const a=ours.filter(Boolean).length,b=theirs.filter(Boolean).length;
 if(a!==b)return Math.sign(a-b);
 if(a){const x=own.reduce((n,v,i)=>n+(ours[i]?0:v),0),y=other.reduce((n,v,i)=>n+(theirs[i]?0:v),0);if(x!==y)return Math.sign(x-y);}
 return Math.sign(own.reduce((a,b)=>a+b,0)-other.reduce((a,b)=>a+b,0));
}

export function stateFeatures(s,playerId,intent={type:'end'}){
 if(s.players.length!==2)throw Error('RL policy currently supports two-player games only.');
 const p=s.players.find(p=>p.id===playerId),supply=7;
 const own=types.map(type=>p.captured.filter(t=>t.type===type).length);
 const remaining=types.map(type=>Object.values(s.tokens).flat().filter(t=>t.type===type).length);
 const tied=types.map(type=>s.ties.filter(t=>t.type===type).length);
 // Opponent category counts are deducible in a two-player game from the public
 // supply, remaining parks, ties and our own captures. No hidden field is read.
 const other=types.map((_,i)=>supply-own[i]-remaining[i]-tied[i]);
 const forecast=[...own],forecastOther=[...other],influence=[0,0,0],enemyInfluence=[0,0,0],near=[0,0,0],danger=[0,0,0],unresolved=[...remaining];
 let prior=s.players.reduce((n,other)=>n+other.captured.length*(other.id===p.id?72:8),0),prospectiveTies=s.ties.length;
 for(const park of boardGeometry(s).parks){
  const tokens=s.tokens[park.id]||[];if(!tokens.length)continue;
  const open=park.around.filter(c=>c.kind==='land'&&!s.board[c.id]).length;
  for(const token of tokens){const k=types.indexOf(token.type);let ours=0,theirs=0;
   for(const c of park.around){const piece=s.board[c.id];if(piece){const amount=strength(s,piece,token.type);if(piece.owner===p.id)ours+=amount;else theirs+=amount;}}
   if(!open){prior+=40+(ours>theirs?32:ours<theirs?-32:0);unresolved[k]--;if(ours>theirs){own[k]++;forecast[k]++;}else if(theirs>ours){other[k]++;forecastOther[k]++;}else prospectiveTies++;
   }else{
    prior+=(Math.tanh((ours-theirs)/3)*8+Math.min(ours,10)*.3)/(1+open*.5);
    const chance=sigmoid((ours-theirs)/(1.8*Math.sqrt(open)+.8));forecast[k]+=chance;forecastOther[k]+=1-chance;
    influence[k]+=Math.min(ours,12)/(1+open);enemyInfluence[k]+=Math.min(theirs,12)/(1+open);
    if(open===1){near[k]+=+(ours>theirs);danger[k]+=+(theirs>ours);}
   }
  }
 }
 const races=types.map((_,i)=>({own:own[i],other:other[i],margin:Math.tanh((own[i]-other[i])/2),projected:Math.tanh((forecast[i]-forecastOther[i])/2),inf:influence[i],enemy:enemyInfluence[i],near:near[i],danger:danger[i]})).sort((a,b)=>b.projected-a.projected);
 const chances=races.map(r=>(r.projected+1)/2);
 const terminal=unresolved.some(n=>n===0)||prospectiveTies>=4;
 const features=races.flatMap(r=>[r.own/supply,r.other/supply,r.margin,r.projected,r.inf/40,r.enemy/40,r.near/supply,r.danger/supply]);
 const t=tileById(intent.tile||intent.a),spent=intent.type==='place'||intent.type==='ability'&&['taiyaki','dango'].includes(abilityById(p.ability)?.type);
 features.push(chances[0]*chances[1]+chances[0]*chances[2]+chances[1]*chances[2]-2*chances[0]*chances[1]*chances[2],races.reduce((n,r)=>n+r.projected,0)/3,races[2].projected,races[0].projected,
  (own.reduce((a,b)=>a+b,0)-other.reduce((a,b)=>a+b,0))/21,1-unresolved.reduce((a,b)=>a+b,0)/21,terminal?winnerFromCounts(own,other):0,+terminal,
  spent?(t?.strength||0)/4:0,spent&&['cat','boat','draw','cover'].includes(t?.type)?(t.strength||0)/4:0,+!!t?.fast,+!!p.usedAbility,+(t?.type==='draw'),+(t?.type==='cover'),+(intent.type==='move'),+(intent.type==='end'),
  ...abilities.map(kind=>+(abilityById(p.ability)?.type===kind&&!p.usedAbility)));
 if(features.length!==featureNames.length||features.some(x=>!Number.isFinite(x)))throw Error('Invalid RL features');
 return {features,prior};
}

export function initialModel(){return {schemaVersion:1,algorithm:'residual-linear-reinforce',features:[...featureNames],weights:featureNames.map(()=>0),temperature:.6,topK:24};}
export function chooseRlIntent(view,playerId,model,{sample=false,random=Math.random,record=false}={}){
 if(model.schemaVersion!==1||model.weights.length!==featureNames.length||model.features.join('|')!==featureNames.join('|'))throw Error('Incompatible RL model');
 const options=decisionOptions(view,playerId);if(!options.length)return {intent:null};
 const base=stateFeatures(view,playerId).prior;
 const rows=options.map(option=>{
  const info=stateFeatures(option.next,playerId,option.intent);
  let prior=Math.atan((info.prior-base-option.cost)/4);
  if(option.intent.type==='choose-ability')prior=(abilities.length-abilities.indexOf(abilityById(option.intent.ability).type))*.025;
  return {...option,features:info.features,logit:prior+dot(model.weights,info.features)};
 });
 rows.sort((a,b)=>b.logit-a.logit);
 if(!sample)return {intent:rows[0].intent};
 const shortlist=rows.slice(0,model.topK),max=shortlist[0].logit,exp=shortlist.map(row=>Math.exp((row.logit-max)/model.temperature)),sum=exp.reduce((a,b)=>a+b,0),probabilities=exp.map(n=>n/sum);
 let chosen=shortlist.length-1,u=random();for(let i=0;i<probabilities.length;i++){u-=probabilities[i];if(u<=0){chosen=i;break;}}
 const gradient=record?featureNames.map((_,j)=>(shortlist[chosen].features[j]-shortlist.reduce((n,row,i)=>n+probabilities[i]*row.features[j],0))/model.temperature):null;
 return {intent:shortlist[chosen].intent,gradient,entropy:-probabilities.reduce((n,p)=>n+p*Math.log(p||1),0)};
}
