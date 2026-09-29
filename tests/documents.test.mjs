import test from 'node:test';import assert from 'node:assert/strict';
import {loadLocalDocuments,validateDocuments,MapDocuments} from '../dist/documents.js';
import {emptyState,setRegionColor} from '../dist/store.js';
test('legacy notes migrate into independent named documents without modifying source',()=>{
 const raw=JSON.stringify({version:1,regions:{'world:TW':{color:'#112233',events:[]}}});const storage={getItem(key){return key==='world-notes:v1'?raw:null}};
 const library=loadLocalDocuments(storage,new Set(['world:TW']));assert.equal(library.documents[0].name,'原有地圖');assert.equal(library.documents[0].state.regions['world:TW'].color,'#112233');
 library.documents.push({id:'new-map',name:'旅行',state:{version:1,regions:{},salespeople:[]}});assert.equal(validateDocuments(library,new Set(['world:TW'])).documents[1].state.regions['world:TW'],undefined);
 assert.equal(storage.getItem('world-notes:v1'),raw);
});
test('document switching refuses concurrent edits and parallel flushes serialize revisions',async()=>{
 const originalFetch=globalThis.fetch,originalStorage=globalThis.localStorage;
 globalThis.localStorage={getItem(){return null},setItem(){}};
 const docs=new MapDocuments(new Set(['world:TW']),()=>{});docs.user={id:'test'};docs.active={id:'a',name:'A',state:emptyState(),revision:1};docs.maps=[docs.active,{id:'b',name:'B'}];
 let resolveRead;globalThis.fetch=()=>new Promise(resolve=>resolveRead=resolve);
 const switching=docs.select('b');await new Promise(resolve=>setImmediate(resolve));
 assert.throws(()=>docs.stage(setRegionColor(emptyState(),'world:TW','#123456')),/稍候/);
 resolveRead(Response.json({id:'b',name:'B',state:emptyState(),revision:1}));await switching;assert.equal(docs.active.id,'b');
 const calls=[];const pending=[];globalThis.fetch=(path,options)=>{calls.push(JSON.parse(options.body));return new Promise(resolve=>pending.push(resolve))};
 docs.stage(setRegionColor(emptyState(),'world:TW','#123456'));const first=docs.flush();docs.stage(setRegionColor(emptyState(),'world:TW','#654321'));const second=docs.flush(),third=docs.flush();
 pending.shift()(Response.json({...docs.active,revision:2}));await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(calls.map(c=>c.revision),[1,2]);
 pending.shift()(Response.json({...docs.active,revision:3}));await Promise.all([first,second,third]);assert.equal(docs.dirty,false);
 globalThis.fetch=originalFetch;globalThis.localStorage=originalStorage;
});
