import fs from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash, randomUUID} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {GamePool, fixtures, summarize, confidence} from './pool.mjs';
const args=process.argv.slice(2),arg=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
const out=arg('--out','training/rl-v1');
const environmentFile=arg('--environment','scripts/rl/environment.mjs');
const environmentModule=pathToFileURL(resolve(environmentFile)).href;
const checkpoint=JSON.parse(fs.readFileSync(arg('--checkpoint',`${out}/checkpoint.json`)));
const model=args.includes('--best')?checkpoint.best:checkpoint.model;
if(!model)throw Error('No model checkpoint');
const selectedEpisodes=args.includes('--best')?checkpoint.history.find(row=>row.selection.winRate===checkpoint.bestRate).episodes:checkpoint.episodes;
const opponentModel=checkpoint.opponentModel||null;
const opponentDigest=opponentModel?createHash('sha256').update(JSON.stringify(opponentModel)).digest('hex'):null;
if(opponentDigest!==(checkpoint.opponentDigest||null))throw Error('Frozen opponent digest mismatch');
const sha=value=>createHash('sha256').update(value).digest('hex');
const baselineSource=sha(fs.readFileSync('src/game/computer.js'));
if(baselineSource!==checkpoint.source['src/game/computer.js'])throw Error('Benchmark opponent changed since training');
for(const [file,digest] of Object.entries(checkpoint.source)) {
 if(file!=='scripts/rl/train.mjs'&&sha(fs.readFileSync(file==='scripts/rl/environment.mjs'?environmentFile:file))!==digest)throw Error(`Training source changed: ${file}`);
}
let attempt=1;while(fs.existsSync(`${out}/confirmation-${attempt}-plan.json`))attempt++;
const games=Number(arg('--games','1024')),seed=`hanami-rl-confirmation:${randomUUID()}`,alphaBudget=Number(arg('--alpha-budget','.05')),alpha=alphaBudget/(attempt*(attempt+1));
const modelDigest=sha(JSON.stringify(model)),metric=arg('--metric','win-rate');
if(!['win-rate','advantage'].includes(metric))throw Error('Unknown metric');
const plan={attempt,seed,games,modelDigest,baselineSource,opponentDigest,evaluationEnvironment:environmentFile,alphaBudget,alpha,metric,target:Number(arg('--target',metric==='advantage'?'0':'.6')),minimumWinRate:Number(arg('--minimum-win-rate','0')),independentSeedPairs:games/2,criterion:metric==='advantage'?'((wins-losses-unfinished)/games) - 2*sqrt(log(1/alpha)/(2*independentSeedPairs)) >= target; winRate >= minimumWinRate':'winRate - sqrt(log(1/alpha)/(2*independentSeedPairs)) >= target',draws:'non-wins',unfinished:'non-wins',trainingEpisodes:selectedEpisodes,totalTrainingEpisodes:checkpoint.episodes,trainingSource:checkpoint.source};
fs.writeFileSync(`${out}/confirmation-${attempt}-plan.json`,JSON.stringify(plan,null,2)+'\n');
fs.writeFileSync(`${out}/candidate.json`,JSON.stringify(model,null,2)+'\n');
fs.writeFileSync(`${out}/confirmation-${attempt}-model.json`,JSON.stringify(model,null,2)+'\n');
console.log(JSON.stringify({stage:'frozen',...plan}));
const pool=new GamePool(Number(arg('--workers','8'))),results=[],schedule=fixtures(seed,games);
try{
 for(let start=0;start<schedule.length;start+=64){results.push(...await pool.run(schedule.slice(start,start+64),model,{opponentModel,environmentModule,sample:false,verifyReplay:true,keepEvents:true}));console.log(JSON.stringify({stage:'progress',completed:results.length,games,wins:results.filter(r=>r.win).length}));}
 const metrics=summarize(results),interval=confidence(metrics,alpha,metric),{lowerBound}=interval,pass=lowerBound>=plan.target&&metrics.winRate>=plan.minimumWinRate;
 const report={...plan,pass,...interval,confirmation:metrics};
 fs.writeFileSync(`${out}/confirmation-${attempt}.json`,JSON.stringify(report,null,2)+'\n');
 fs.writeFileSync(`${out}/confirmation-${attempt}-events.jsonl.gz`,gzipSync(results.map(({gradient,...r})=>JSON.stringify(r)).join('\n')+'\n'));
 fs.writeFileSync(`${out}/evaluation.json`,JSON.stringify(report,null,2)+'\n');
 if(pass)fs.writeFileSync(`${out}/model.json`,JSON.stringify({...model,training:{episodes:selectedEpisodes,totalEpisodes:checkpoint.episodes,source:checkpoint.source},evaluation:{...metrics,...interval,alpha,modelDigest}},null,2)+'\n');
 console.log(JSON.stringify({stage:'confirmation',...report}));if(!pass)process.exitCode=2;
}finally{await pool.close();}
