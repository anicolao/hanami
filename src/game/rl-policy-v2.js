import {decisionOptions,stateFeatures,featureNames as baseNames,chooseRlIntent} from './rl-policy.js';
import {tileById,abilityById} from './engine.js';
const types=['sakura','chochin','onigiri'];
const abilities=['torii','taiyaki','dango','bicycle','green-tea','fruit-sandwich','rainy-day','akkorokamui','takoyaki'];
const interactions=[];
// Nonlinear relationships allow the new value function to change its strategy
// as races advance, rather than simply multiplying each feature by a constant.
for(let race=0;race<3;race++)for(const [a,b] of [[0,3],[2,3],[3,4],[3,5],[3,6],[3,7],[4,5]])interactions.push([race*8+a,race*8+b]);
for(const [a,b] of [[3,11],[11,19],[3,19],[24,28],[24,29],[25,28],[26,28],[27,28],[26,29],[27,29]])interactions.push([a,b]);
const resourceNames=['hand-size','hand-strength','hand-fast','hand-wild',...types.flatMap(type=>[`${type}-reserve`,`${type}-reserve-margin`,`${type}-reserve-needed`])];
export const featureNames=[...baseNames,...interactions.map(([a,b])=>`${baseNames[a]}*${baseNames[b]}`),...resourceNames];
function features(state,id,intent){
 const info=stateFeatures(state,id,intent),p=state.players.find(p=>p.id===id),tiles=p.hand.map(tileById);
 const remaining=Object.values(state.tokens).flat();
 const wild=t=>['cat','boat','draw','cover'].includes(t.type);
 const resources=[tiles.length/10,tiles.reduce((n,t)=>n+(t.strength||0),0)/30,tiles.filter(t=>t.fast).length/5,tiles.filter(wild).length/5];
 for(const type of types){
  const own=p.captured.filter(t=>t.type===type).length;
  const left=remaining.filter(t=>t.type===type).length;
  const other=7-own-left-state.ties.filter(t=>t.type===type).length;
  const reserve=tiles.reduce((n,t)=>n+(t.type===type||wild(t)?t.strength||0:0),0)/20;
  resources.push(reserve,reserve*Math.tanh((own-other)/2),reserve*left/7);
 }
 return {prior:info.prior,features:[...info.features,...interactions.map(([a,b])=>info.features[a]*info.features[b]),...resources]};
}
export function initialModel(){return {schemaVersion:2,algorithm:'second-order-residual-reinforce',features:[...featureNames],weights:featureNames.map(()=>0),temperature:.15,topK:4};}
export function chooseModelIntent(view,id,model,options={}){
 if(model.schemaVersion===1)return chooseRlIntent(view,id,model,options);
 if(model.schemaVersion!==2||model.features.join('|')!==featureNames.join('|')||model.weights.length!==featureNames.length||model.weights.some(x=>!Number.isFinite(x)))throw Error('Incompatible RL model');
 const candidates=decisionOptions(view,id);if(!candidates.length)return {intent:null};
 const base=stateFeatures(view,id).prior;
 const rows=candidates.map(option=>{
  const info=features(option.next,id,option.intent);
  const prior=option.intent.type==='choose-ability'?(abilities.length-abilities.indexOf(abilityById(option.intent.ability).type))*.025:Math.atan((info.prior-base-option.cost)/4);
  return {intent:option.intent,features:info.features,score:prior+info.features.reduce((sum,x,i)=>sum+x*model.weights[i],0)};
 }).sort((a,b)=>b.score-a.score);
 if(!options.sample)return {intent:rows[0].intent};
 const shortlist=rows.slice(0,model.topK),exps=shortlist.map(row=>Math.exp((row.score-shortlist[0].score)/model.temperature)),sum=exps.reduce((a,b)=>a+b,0),probabilities=exps.map(x=>x/sum);
 let chosen=shortlist.length-1,u=(options.random||Math.random)();
 for(let i=0;i<probabilities.length;i++){u-=probabilities[i];if(u<=0){chosen=i;break;}}
 return {intent:shortlist[chosen].intent,gradient:options.record?featureNames.map((_,j)=>(shortlist[chosen].features[j]-shortlist.reduce((n,row,i)=>n+probabilities[i]*row.features[j],0))/model.temperature):null,entropy:-probabilities.reduce((n,p)=>n+p*Math.log(p||1),0)};
}
