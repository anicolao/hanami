import {parentPort} from 'node:worker_threads';
import {playGame as defaultPlayGame} from './environment.mjs';
parentPort.on('message',async({id,games,model,opponentModel,environmentModule,exploration,sample,keepEvents,verifyReplay})=>{
 try{
  const playGame=environmentModule?(await import(environmentModule)).playGame:defaultPlayGame;
  parentPort.postMessage({id,results:games.map(game=>playGame({...game,model,opponentModel,exploration,sample,keepEvents,verifyReplay}))});
 }catch(error){parentPort.postMessage({id,error:error.stack});}
});
