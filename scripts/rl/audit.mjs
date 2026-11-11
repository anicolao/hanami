import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {replay} from '../../src/game/engine.js';
import {summarize,confidence} from './pool.mjs';
const reportFile=process.argv[2]||'training/rl-v1/evaluation.json';
const report=JSON.parse(fs.readFileSync(reportFile));
const dir=new URL(`../../${reportFile}`,import.meta.url);const eventFile=new URL(`confirmation-${report.attempt}-events.jsonl.gz`,dir);
const rows=gunzipSync(fs.readFileSync(eventFile)).toString().trim().split('\n').map(line=>JSON.parse(line));
for(const row of rows){
 const state=replay(row.events),learner=state.players[row.seat].id;
 assert.equal(row.win,!row.truncated&&state.phase==='finished'&&state.winners.length===1&&state.winners[0]===learner);
 assert.equal(row.draw,!row.truncated&&state.phase==='finished'&&state.winners.length>1);
 assert.equal(row.truncated,state.phase!=='finished');
 assert.deepEqual(row.winners,state.winners.map(id=>state.players.findIndex(p=>p.id===id)));
 assert.equal(row.choices,row.events.length);
}
assert.deepEqual(summarize(rows),report.confirmation);
if(report.metric){
 const interval=confidence(report.confirmation,report.alpha,report.metric);
 assert.ok(Math.abs(interval.lowerBound-report.lowerBound)<1e-12,'Confidence bound must match actual outcomes');
 assert.ok(Math.abs(interval.score-report.score)<1e-12);
 assert.equal(report.pass,interval.lowerBound>=report.target&&report.confirmation.winRate>=report.minimumWinRate);
}
const attemptModel=new URL(`confirmation-${report.attempt}-model.json`,dir);
const model=JSON.parse(fs.readFileSync(fs.existsSync(attemptModel)?attemptModel:new URL('candidate.json',dir)));
assert.equal(createHash('sha256').update(JSON.stringify(model)).digest('hex'),report.modelDigest);
assert.equal(createHash('sha256').update(fs.readFileSync('src/game/computer.js')).digest('hex'),report.baselineSource);
if(report.opponentDigest){
 const checkpoint=JSON.parse(fs.readFileSync(new URL('checkpoint.json',dir)));
 assert.equal(createHash('sha256').update(JSON.stringify(checkpoint.opponentModel)).digest('hex'),report.opponentDigest);
}
console.log(`Audited ${rows.length} real event histories: ${report.confirmation.wins} wins. Model and unchanged opponent hashes match.`);
