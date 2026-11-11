import {chooseComputerIntent} from './computer.js';
import {chooseMultiplayerIntent} from './multiplayer-policy.js';
import {chooseModelIntent} from './rl-policy-v2.js';
import medium from './models/medium.json' with {type:'json'};
import hard from './models/hard.json' with {type:'json'};

export const difficultyLevels=['easy','medium','hard'];

// Caller supplies the same redacted observation used in training. All levels
// share the production rules and event driver; undo consent is not strategic.
export function choosePracticeIntent(view,playerId,level='easy') {
 if(!difficultyLevels.includes(level))throw Error('Unknown computer level');
 const player=view.players.find(p=>p.id===playerId);
 if(!player?.computer)return null;
 if(level==='easy'||view.undoRequest)return chooseComputerIntent(view,playerId);
 if(view.players.length!==2)return chooseMultiplayerIntent(view,playerId,level==='medium'?medium:hard);
 return chooseModelIntent(view,playerId,level==='medium'?medium:hard).intent;
}
