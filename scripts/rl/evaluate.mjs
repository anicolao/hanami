import fs from 'node:fs';
import {createHash, randomUUID} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {GamePool, fixtures, summarize} from './pool.mjs';
const args=process.argv.slice(2),arg=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
const out=arg('--out','training/rl-v1');
const checkpoint=JSON.parse(fs.readFileSync(arg('--checkpoint',`${out}/checkpoint.json`)));
const model=checkpoint.model;
const sha=value=>createHash('sha256').update(value).digest('hex');
const baselineSource=sha(fs.readFileSync('src/game/computer.js'));
if(baselineSource!==checkpoint.source['src/game/computer.js'])throw Error('Benchmark opponent changed since training');
for(const [file,digest] of Object.entries(checkpoint.source)) {
 if(file!=='scripts/rl/train.mjs'&&sha(fs.readFileSync(file))!==digest)throw Error(`Training source changed: ${file}`);
}
let attempt=1;while(fs.existsSync(`${out}/confirmation-${attempt}-plan.json`))attempt++;
const games=Number(arg('--games','1024')),seed=`hanami-rl-confirmation:${randomUUID()}`,alpha=.05/(attempt*(attempt+1));
const modelDigest=sha(JSON.stringify(model));
const plan={attempt,seed,games,modelDigest,baselineSource,alpha,target:.6,independentSeedPairs:games/2,criterion:'winRate - sqrt(log(1/alpha)/(2*independentSeedPairs)) >= target',draws:'non-wins',unfinished:'non-wins',trainingEpisodes:checkpoint.episodes,trainingSource:checkpoint.source};
fs.writeFileSync(`${out}/confirmation-${attempt}-plan.json`,JSON.stringify(plan,null,2)+'\n');
fs.writeFileSync(`${out}/candidate.json`,JSON.stringify(model,null,2)+'\n');
console.log(JSON.stringify({stage:'frozen',...plan}));
const pool=new GamePool(Number(arg('--workers','8'))),results=[],schedule=fixtures(seed,games);
try{
 for(let start=0;start<schedule.length;start+=64){results.push(...await pool.run(schedule.slice(start,start+64),model,{sample:false,verifyReplay:true,keepEvents:true}));console.log(JSON.stringify({stage:'progress',completed:results.length,games,wins:results.filter(r=>r.win).length}));}
 const metrics=summarize(results),lowerBound=metrics.winRate-Math.sqrt(Math.log(1/alpha)/games),pass=lowerBound>=plan.target;
 const report={...plan,pass,lowerBound,confirmation:metrics};
 fs.writeFileSync(`${out}/confirmation-${attempt}.json`,JSON.stringify(report,null,2)+'\n');
 fs.writeFileSync(`${out}/confirmation-${attempt}-events.jsonl.gz`,gzipSync(results.map(({gradient,...r})=>JSON.stringify(r)).join('\n')+'\n'));
 fs.writeFileSync(`${out}/evaluation.json`,JSON.stringify(report,null,2)+'\n');
 if(pass)fs.writeFileSync(`${out}/model.json`,JSON.stringify({...model,training:{episodes:checkpoint.episodes,source:checkpoint.source},evaluation:{...metrics,lowerBound,alpha,modelDigest}},null,2)+'\n');
 console.log(JSON.stringify({stage:'confirmation',...report}));if(!pass)process.exitCode=2;
}finally{await pool.close();}
