export const players = [
 {name:'Indigo',color:'#345c79',pattern:'Waves',mark:'≈'},
 {name:'Vermilion',color:'#bb5549',pattern:'Cups',mark:'∪'},
 {name:'Ochre',color:'#b68b35',pattern:'Circles',mark:'○'},
 {name:'Pine',color:'#527b62',pattern:'Stars',mark:'✳'}
];
export const celebrations = [
 {id:'sakura',name:'Sakura',jp:'桜',description:'Flower viewing',color:'#d88b98'},
 {id:'chochin',name:'Chochin',jp:'提灯',description:'Evening festivities',color:'#c65d4c'},
 {id:'onigiri',name:'Onigiri',jp:'おにぎり',description:'A picnic together',color:'#c7b98c'}
];
export const tiles = [
 ...celebrations.flatMap(c=>[2,3,4].map(strength=>({id:`${c.id}-${strength}`,name:c.name,type:c.id,strength,group:'Basic',effect:`Strength ${strength} toward ${c.name} only. Place on land.`,fast:false}))),
 ...[1,1,2,2,3,4].map((strength,i)=>({id:`cat-${i}`,name:'Maneki-neko',type:'cat',strength,group:'Wild',fast:strength===1,effect:'Wild strength toward every celebration. Place on land.'})),
 ...[1,2,3].map(strength=>({id:`boat-${strength}`,name:'Boat',type:'boat',strength,group:'Wild',fast:true,effect:'Wild strength toward every celebration. Place on water only.'})),
 {id:'move',name:'Move',type:'move',fast:false,group:'Action',effect:'Use your normal placement to relocate your own non-fast tile to empty land. Put this tile in its former space.'},
 {id:'draw',name:'Draw',type:'draw',strength:1,fast:true,group:'Special',effect:'Draw a tile immediately when placing this tile.'},
 {id:'cover',name:'Cover',type:'cover',strength:3,fast:true,group:'Special',effect:'Cover one of your placed tiles. This becomes a strength 3 wild tile.'},
 {id:'copy',name:'Copy',type:'copy',direction:0,group:'Special',effect:'Point toward a tile to copy its strength and celebration type. Does not copy fast status or action effects.'}
];
export const abilities = [
 ...players.map((p,i)=>({id:`torii-${i}`,name:`Torii · ${p.name}`,jp:'鳥居',type:'torii',group:'Standard',player:i,effect:'Swap the positions of any two celebration tokens on the board.',note:'Two tokens of the same celebration type may not share a park.'})),
 {id:'takoyaki',name:'Takoyaki',jp:'たこ焼き',type:'takoyaki',group:'Special',effect:'Swap a celebration token from behind your player screen with one from the ties area.'},
 {id:'taiyaki',name:'Taiyaki',jp:'たい焼き',type:'taiyaki',group:'Special',effect:'Place one of your player tiles on a water space. Treat it as a fast boat tile.'},
 {id:'akkorokamui',name:'Akkorokamui',jp:'アッコロカムイ',type:'akkorokamui',group:'Special',effect:'Flip any boat player tile face down.',note:'Everyone survived.'},
 {id:'green-tea',name:'Green Tea',jp:'緑茶',type:'green-tea',group:'Special',effect:'Swap one of your Sakura, Chochin, or Onigiri player tiles on the board with any player tile on the board of the same type.'},
 {id:'rainy-day',name:'Rainy Day',jp:'雨の日',type:'rainy-day',group:'Special',effect:'Flip any strength 1 or 2 Sakura, Chochin, or Onigiri player tile face down.'},
 {id:'bicycle',name:'Bicycle',jp:'自転車',type:'bicycle',group:'Special',effect:'Move any player tile on land to an available adjacent land space.'},
 {id:'dango',name:'Dango',jp:'団子',type:'dango',group:'Special',effect:'Place one of your strength 1 or 2 player tiles as if it has a fast icon.'},
 {id:'fruit-sandwich',name:'Fruit Sandwich',jp:'フルーツサンド',type:'fruit-sandwich',group:'Special',effect:'Swap the positions of any two celebration tokens on the board.',note:'Two tokens of the same celebration type may not share a park.'}
];
