import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {GamePool,fixtures,summarize} from './pool.mjs';import {initialModel as baseInitial,featureNames as baseNames} from '../../src/game/rl-policy.js';import {initialModel as enhancedInitial,featureNames as enhancedNames} from '../../src/game/rl-policy-v2.js';import {VERSION} from '../../src/game/engine.js';
const args=process.argv.slice(2),arg=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
let featureNames=args.includes('--enhanced')?enhancedNames:baseNames;
const initialModel=args.includes('--enhanced')?enhancedInitial:baseInitial;
const out=arg('--out','training/rl-v1'),limit=Number(arg('--episodes','8192')),workers=Number(arg('--workers','8')),batchSize=64,every=512;
let seed=arg('--seed','hanami-rl-v1'),learningRate=Number(arg('--learning-rate','.04')),initializationDigest=null,exploration=arg('--exploration','trajectory');
fs.mkdirSync(out,{recursive:true});
const opponentFile=arg('--opponent','');let opponentModel=opponentFile?JSON.parse(fs.readFileSync(opponentFile)):null;
let opponentDigest=opponentModel?createHash('sha256').update(JSON.stringify(opponentModel)).digest('hex'):null;
const save=(file,value)=>{const target=path.join(out,file),temp=target+'.tmp';fs.writeFileSync(temp,JSON.stringify(value,null,2)+'\n');fs.renameSync(temp,target);};
const source=Object.fromEntries(['src/game/engine.js','src/game/computer.js','src/game/maps.json','src/catalog.js','src/game/rl-policy.js','src/game/rl-policy-v2.js','scripts/rl/environment.mjs','scripts/rl/train.mjs'].map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
let model=initialModel();model.temperature=Number(arg('--temperature',String(model.temperature)));model.topK=Number(arg('--top-k',String(model.topK)));
if(!Number.isFinite(learningRate)||learningRate<=0||!['trajectory','single'].includes(exploration)||!Number.isInteger(limit)||limit<512||limit%512)throw Error('Use positive learning rate, known exploration and an episode count divisible by 512');
if(!(model.temperature>0)||!Number.isInteger(model.topK)||model.topK<1)throw Error('Invalid exploration settings');
const initializeFile=arg('--initialize','');
if(initializeFile){const initialization=JSON.parse(fs.readFileSync(initializeFile));if(initialization.features.some((name,i)=>name!==featureNames[i]))throw Error('Incompatible initialization');initialization.weights.forEach((w,i)=>model.weights[i]=w);initializationDigest=createHash('sha256').update(JSON.stringify(initialization)).digest('hex');}
let m=featureNames.map(()=>0),v=[...m],updates=0,episodes=0,best=null,bestRate=-1,history=[];
const resume=arg('--resume','');if(resume){const checkpoint=JSON.parse(fs.readFileSync(resume));if(opponentFile&&opponentDigest!==(checkpoint.opponentDigest||null))throw Error('Cannot change opponent while resuming');
 if(args.includes('--seed')&&seed!==checkpoint.seed)throw Error('Cannot change seed while resuming');
 ({model,m,v,updates,episodes,best,bestRate,history}=checkpoint);
 featureNames=[...model.features];learningRate=checkpoint.learningRate??.04;initializationDigest=checkpoint.initializationDigest||null;exploration=checkpoint.exploration||'trajectory';
 seed=checkpoint.seed;opponentModel=checkpoint.opponentModel||null;opponentDigest=checkpoint.opponentDigest||null;}
const pool=new GamePool(workers),start=Date.now();
const evaluate=async(model,prefix,n=256,events=false)=>{const games=await pool.run(fixtures(prefix,n),model,{opponentModel,sample:false,verifyReplay:true,keepEvents:events});return {metrics:summarize(games),games};};
const checkpoint=()=>save('checkpoint.json',{model,m,v,updates,episodes,best,bestRate,history,source,seed,opponentModel,opponentDigest,initializationDigest,learningRate,exploration,ruleVersion:VERSION});
try{
 if(!resume){const initial=await evaluate(model,`${seed}:selection`);save('untrained.json',{model,metrics:initial.metrics,source});console.log(JSON.stringify({stage:'untrained',...initial.metrics}));}

 while(episodes<limit){
  const games=fixtures(`${seed}:training-batch-${updates}`,batchSize);
  const results=await pool.run(games,model,{sample:true,opponentModel,exploration});
  const rewardSum=results.reduce((sum,r)=>sum+r.reward,0),gradient=featureNames.map(()=>0);
  for(const result of results){const baseline=result.baselineReward??(rewardSum-result.reward)/(results.length-1),advantage=result.reward-baseline;for(let j=0;j<gradient.length;j++)gradient[j]+=advantage*result.gradient[j]/results.length;}
  const norm=Math.sqrt(gradient.reduce((n,g)=>n+g*g,0));if(norm>5)for(let j=0;j<gradient.length;j++)gradient[j]*=5/norm;
  updates++;episodes+=results.reduce((n,r)=>n+(r.trainingGames||1),0);
  for(let j=0;j<gradient.length;j++){m[j]=.9*m[j]+.1*gradient[j];v[j]=.999*v[j]+.001*gradient[j]**2;model.weights[j]+=learningRate*(m[j]/(1-.9**updates))/(Math.sqrt(v[j]/(1-.999**updates))+1e-8);model.weights[j]*=.99995;}
  if(episodes%every===0||episodes===limit){
   const selection=await evaluate(model,`${seed}:selection`);
   const row={episodes,updates,elapsedSeconds:(Date.now()-start)/1000,training:summarize(results),selection:selection.metrics};history.push(row);console.log(JSON.stringify({stage:'selection',...row}));
   if(selection.metrics.winRate>bestRate){bestRate=selection.metrics.winRate;best=structuredClone(model);save('best-model.json',{...best,training:{episodes,seed,source,opponentDigest,ruleVersion:VERSION}});}
   checkpoint();save('history.json',history);
   save(`checkpoint-${episodes}-model.json`,model);
  }
 }
 checkpoint();console.log(JSON.stringify({stage:'training-complete',episodes,bestSelectionRate:bestRate,next:'Run evaluate.mjs for independent confirmation.'}));
}finally{await pool.close();}
