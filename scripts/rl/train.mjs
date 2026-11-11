import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {GamePool,fixtures,summarize} from './pool.mjs';import {initialModel,featureNames} from '../../src/game/rl-policy.js';import {VERSION} from '../../src/game/engine.js';
const args=process.argv.slice(2),arg=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
const out=arg('--out','training/rl-v1'),limit=Number(arg('--episodes','8192')),workers=Number(arg('--workers','8')),batchSize=64,every=512,seed=arg('--seed','hanami-rl-v1');
fs.mkdirSync(out,{recursive:true});
const save=(file,value)=>{const target=path.join(out,file),temp=target+'.tmp';fs.writeFileSync(temp,JSON.stringify(value,null,2)+'\n');fs.renameSync(temp,target);};
const source=Object.fromEntries(['src/game/engine.js','src/game/computer.js','src/game/maps.json','src/catalog.js','src/game/rl-policy.js','scripts/rl/environment.mjs','scripts/rl/train.mjs'].map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
let model=initialModel(),m=featureNames.map(()=>0),v=[...m],updates=0,episodes=0,best=null,bestRate=-1,history=[];
const resume=arg('--resume','');if(resume){const checkpoint=JSON.parse(fs.readFileSync(resume));({model,m,v,updates,episodes,best,bestRate,history}=checkpoint);}
const pool=new GamePool(workers),start=Date.now();
const evaluate=async(model,prefix,n=256,events=false)=>{const games=await pool.run(fixtures(prefix,n),model,{sample:false,verifyReplay:true,keepEvents:events});return {metrics:summarize(games),games};};
const checkpoint=()=>save('checkpoint.json',{model,m,v,updates,episodes,best,bestRate,history,source,seed,ruleVersion:VERSION});
try{
 if(!resume){const initial=await evaluate(model,`${seed}:selection`);save('untrained.json',{model,metrics:initial.metrics,source});console.log(JSON.stringify({stage:'untrained',...initial.metrics}));}

 while(episodes<limit){
  const games=fixtures(`${seed}:training-batch-${updates}`,batchSize);
  const results=await pool.run(games,model,{sample:true});
  const rewardSum=results.reduce((sum,r)=>sum+r.reward,0),gradient=featureNames.map(()=>0);
  for(const result of results){const baseline=(rewardSum-result.reward)/(results.length-1),advantage=result.reward-baseline;for(let j=0;j<gradient.length;j++)gradient[j]+=advantage*result.gradient[j]/results.length;}
  const norm=Math.sqrt(gradient.reduce((n,g)=>n+g*g,0));if(norm>5)for(let j=0;j<gradient.length;j++)gradient[j]*=5/norm;
  updates++;episodes+=results.length;
  for(let j=0;j<gradient.length;j++){m[j]=.9*m[j]+.1*gradient[j];v[j]=.999*v[j]+.001*gradient[j]**2;model.weights[j]+=.04*(m[j]/(1-.9**updates))/(Math.sqrt(v[j]/(1-.999**updates))+1e-8);model.weights[j]*=.99995;}
  if(episodes%every===0||episodes===limit){
   const selection=await evaluate(model,`${seed}:selection`);
   const row={episodes,updates,elapsedSeconds:(Date.now()-start)/1000,training:summarize(results),selection:selection.metrics};history.push(row);console.log(JSON.stringify({stage:'selection',...row}));
   if(selection.metrics.winRate>bestRate){bestRate=selection.metrics.winRate;best=structuredClone(model);save('best-model.json',{...best,training:{episodes,seed,source,ruleVersion:VERSION}});}
   checkpoint();save('history.json',history);
   save(`checkpoint-${episodes}-model.json`,model);
  }
 }
 checkpoint();console.log(JSON.stringify({stage:'training-complete',episodes,bestSelectionRate:bestRate,next:'Run evaluate.mjs for independent confirmation.'}));
}finally{await pool.close();}
