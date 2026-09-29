import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,validateState,loadState,persistState,setRegionColor,upsertEvent,deleteEvent} from '../dist/store.js';
const ids=new Set(['world:TW','world:JP','taiwan:63000']);
const event={id:'event-1',date:'2026-09-29',title:'旅行',content:'筆記',createdAt:'2026-09-29T00:00:00.000Z'};
test('CRUD and colors survive JSON round trip, without mixing regions',()=>{
 const initial=emptyState(); let state=upsertEvent(initial,'world:TW',event);
 state=setRegionColor(state,'taiwan:63000','#3366ff');
 state=upsertEvent(state,'world:TW',{...event,title:'修改'});
 assert.equal(state.regions['world:TW'].events.length,1); assert.equal(initial.regions['world:TW'],undefined);
 assert.equal(state.regions['world:TW'].events[0].title,'修改');
 assert.equal(state.regions['taiwan:63000'].events.length,0);
 assert.deepEqual(validateState(JSON.parse(JSON.stringify(state)),ids),state);
 const memory={value:null,setItem(k,v){this.value=v},getItem(){return this.value}};
 persistState(memory,state); assert.deepEqual(loadState(memory,ids).state,state);
 state=deleteEvent(state,'world:TW','event-1'); assert.equal(state.regions['world:TW'].events.length,0);
 state=setRegionColor(state,'taiwan:63000',null); assert.equal(state.regions['taiwan:63000'].color,null);
});
test('invalid backups never pass validation',()=>{
 const good=upsertEvent(emptyState(),'world:TW',event);
 const edits=[s=>s.version=2,s=>s.regions.unknown={color:null,events:[]},s=>s.regions['world:TW'].color='red',s=>s.regions['world:TW'].events.push(event),s=>s.regions['world:TW'].events[0].date='2026-02-30',s=>s.regions['world:TW'].events[0].title=' ',s=>s.regions['world:TW'].events[0].content='x'.repeat(10001)];
 for(const change of edits){const state=structuredClone(good);change(state);assert.throws(()=>validateState(state,ids));}
 assert.throws(()=>validateState(JSON.parse('{"version":1,"regions":{"__proto__":{"color":null,"events":[]}}}'),ids));
});
test('storage failures and corrupted contents remain recoverable',()=>{
 const state=emptyState(); assert.throws(()=>persistState({setItem(){throw Error('QuotaExceeded')}},state));
 const result=loadState({getItem(){return '{broken'}},ids); assert.ok(result.error); assert.deepEqual(result.state,emptyState());
 assert.ok(loadState({getItem(){throw Error('Blocked')}},ids).error);
});
test('a stale tab cannot overwrite records saved by another tab',()=>{
 const memory={value:null,getItem(){return this.value},setItem(k,v){this.value=v}};
 const original=memory.getItem();
 const first=upsertEvent(emptyState(),'world:TW',event);persistState(memory,first,original);
 const stale=setRegionColor(emptyState(),'world:JP','#3366ff');
 assert.throws(()=>persistState(memory,stale,original),/分頁/);
 assert.deepEqual(loadState(memory,ids).state,first);
});
test('HTML remains literal text and events are sorted newest first',()=>{
 let state=upsertEvent(emptyState(),'world:TW',{...event,title:'<img src=x onerror=alert(1)>'});
 state=upsertEvent(state,'world:TW',{...event,id:'event-2',date:'2026-10-01'});
 assert.equal(state.regions['world:TW'].events[0].id,'event-2');
 assert.equal(validateState(state,ids).regions['world:TW'].events[1].title,'<img src=x onerror=alert(1)>');
});
