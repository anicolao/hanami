import {expect} from '@playwright/test';
import {replay} from '../../src/game/engine.js';

// Independently replay immutable events, then check every public collection and
// open hand's physical tokens. A folded tabletop screen must hide only tiles.
export async function assertPublicCollections(pages) {
 const identity=await pages[0].locator('main').evaluate(el=>({scope:el.dataset.scope,table:el.dataset.table,revision:Number(el.dataset.revision),phase:el.dataset.phase}));
 if(!['playing','finished'].includes(identity.phase))return;
 // Read-only emulator event audit: no injected state, writes or special app API.
 const decode=value=>{
  if('mapValue' in value)return Object.fromEntries(Object.entries(value.mapValue.fields||{}).map(([k,v])=>[k,decode(v)]));
  if('arrayValue' in value)return (value.arrayValue.values||[]).map(decode);
  if('integerValue' in value)return Number(value.integerValue);
  return value.stringValue??value.booleanValue??value.doubleValue??null;
 };
 const url=`http://127.0.0.1:8191/v1/projects/demo-hanami/databases/(default)/documents/previews/${identity.scope}/tables/${identity.table}/events?pageSize=1000`;
 const response=await pages[0].request.get(url,{headers:{Authorization:'Bearer owner'}});
 expect(response.ok(),'The immutable emulator event log must be readable').toBe(true);
 const payload=await response.json();expect(payload.nextPageToken).toBeUndefined();
 const events=(payload.documents||[]).map(doc=>decode({mapValue:{fields:doc.fields}})).filter(e=>e.sequence<=identity.revision).sort((a,b)=>a.sequence-b.sequence);
 expect(events.length).toBe(identity.revision);
 const expected=replay(events).players.map(player=>({id:player.id,counts:Object.fromEntries(['sakura','onigiri','chochin'].map(type=>[type,player.captured.filter(t=>t.type===type).length]))}));
 for(const page of pages){
  const actual=await page.evaluate(()=>({
   collections:[...document.querySelectorAll('[data-collected-player]')].map(el=>({id:el.dataset.collectedPlayer,counts:Object.fromEntries([...el.querySelectorAll('[data-collection-type]')].map(n=>[n.dataset.collectionType,Number(n.dataset.count)])),total:Number(el.querySelector('.collection-total').textContent.match(/\d+/)[0])})),
   required:[...document.querySelectorAll('.player-summary')].map(el=>({id:el.dataset.playerSummary,collections:el.querySelectorAll('[data-collected-player]').length})),
   open:[...document.querySelectorAll('.player-area.private-open')].map(el=>({id:el.dataset.player,counts:Object.fromEntries(['sakura','onigiri','chochin'].map(type=>[type,el.querySelectorAll(`.private-captures [data-token-type="${type}"]`).length]))})),
   closed:[...document.querySelectorAll('.player-area:not(.private-open)')].map(el=>({id:el.dataset.player,collections:el.querySelectorAll('[data-collected-player]').length,privateTiles:el.querySelectorAll('[data-tile]').length})),
  }));
  for(const {id,counts} of expected){
   for(const collection of actual.collections.filter(c=>c.id===id)){
    expect(collection.counts,'Public type counts must equal the replayed event log').toEqual(counts);
    expect(collection.total).toBe(Object.values(counts).reduce((a,b)=>a+b,0));
   }
  }
  for(const area of actual.open)expect(area.counts).toEqual(expected.find(row=>row.id===area.id).counts);
  for(const row of actual.required)expect(row.collections,'Every player summary exposes its collection').toBe(1);
  for(const closed of actual.closed){expect(closed.collections,'Every folded screen exposes its collection').toBe(1);expect(closed.privateTiles,'The collection does not expose the hidden hand').toBe(0);}
 }
}
