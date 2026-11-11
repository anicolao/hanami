import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const digest=model=>createHash('sha256').update(JSON.stringify(model)).digest('hex');
const args=process.argv.slice(2),hardRun=args.includes('--hard-run')?args[args.indexOf('--hard-run')+1]:'rl-v2-transfer';
const models={};
for(const [level,run] of [['medium','rl-v1'],['hard',hardRun]]){
 const directory=`training/${run}`;
 const report=JSON.parse(fs.readFileSync(`${directory}/evaluation.json`));
 const model=JSON.parse(fs.readFileSync(`${directory}/candidate.json`));
 assert.equal(report.pass,true,`${level}: confirmation must pass before export`);
 assert.equal(digest(model),report.modelDigest);
 for(const file of ['src/game/rl-policy.js',...(report.trainingSource?.['src/game/rl-policy-v2.js']?['src/game/rl-policy-v2.js']:[])])assert.equal(createHash('sha256').update(fs.readFileSync(file)).digest('hex'),report.trainingSource[file]);
 models[level]=model;
 if(level==='hard')assert.equal(report.opponentDigest,digest(models.medium),'Hard must have beaten the frozen medium model');
}
fs.mkdirSync('src/game/models',{recursive:true});
for(const [level,model] of Object.entries(models))fs.writeFileSync(`src/game/models/${level}.json`,JSON.stringify(model,null,2)+'\n');
console.log('Exported the independently evaluated medium and hard models.');
