import {test} from '@playwright/test';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);

test('Eight route workbenches share connections and recover from a blocked write',async({baseURL},info)=>{
 const result=await run(process.execPath,['scripts/check-lab-preparation.mjs'],{
  env:{...process.env,HANAMI_LAB_URL:baseURL},timeout:180000,maxBuffer:2*1024*1024,
 });
 await info.attach('Real-route preparation and replication checks',{body:result.stdout,contentType:'application/json'});
});
