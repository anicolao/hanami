import {parentPort} from 'node:worker_threads';
import {playGame} from './environment.mjs';
parentPort.on('message',({id,games,model,sample,keepEvents,verifyReplay})=>{try{parentPort.postMessage({id,results:games.map(game=>playGame({...game,model,sample,keepEvents,verifyReplay}))});}catch(error){parentPort.postMessage({id,error:error.stack});}});
