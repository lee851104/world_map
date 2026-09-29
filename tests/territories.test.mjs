import test from 'node:test';
import assert from 'node:assert/strict';
import * as store from '../dist/store.js';
const ids=new Set(['world:TW','world:US','taiwan:09007']);
const people=Array.from({length:5},(_,i)=>({id:`person-${i}`,name:`業務 ${i}`,color:['#dc5050','#2684d8','#28a678','#915cc4','#eaaa20'][i]}));
test('old backups preserve independent Taiwan and county colors and notes',()=>{
 const note={id:'old-note',title:'既有客戶拜訪',content:'保留記事內容',date:'2026-09-29',createdAt:'2026-09-29T01:00:00.000Z'};
 const old={version:1,regions:{'world:TW':{color:'#112233',events:[note]},'taiwan:09007':{color:'#aabbcc',events:[]}}};
 const result=store.validateState(old,ids);
 assert.equal(result.regions['world:TW'].color,'#112233');
 assert.equal(result.regions['taiwan:09007'].color,'#aabbcc');
 assert.deepEqual(result.salespeople,[]);
 assert.deepEqual(store.validateState(JSON.parse(JSON.stringify(result)),ids).regions['world:TW'].events,[note]);
});
test('assignments support four people, survive backup, and follow roster edits',()=>{
 let state=store.emptyState();
 for(const person of people)state=store.upsertSalesperson(state,person);
 state=store.setRegionAssignees(state,'world:US',people.slice(0,4).map(p=>p.id));
 assert.throws(()=>store.setRegionAssignees(state,'world:US',people.map(p=>p.id)),/4/);
 assert.deepEqual(store.validateState(JSON.parse(JSON.stringify(state)),ids),state);
 state=store.upsertSalesperson(state,{...people[0],name:'新姓名',color:'#123456'});
 assert.equal(store.regionColors(state,'world:US')[0],'#123456');
 state=store.deleteSalesperson(state,people[0].id);
 assert.equal(state.regions['world:US'].assignees.length,3);
 assert.equal(state.salespeople.length,4);
});
test('invalid assignments and duplicate people cannot corrupt backups',()=>{
 let state=store.upsertSalesperson(store.emptyState(),people[0]);
 state=store.setRegionAssignees(state,'world:TW',[people[0].id]);
 for(const change of [s=>s.regions['world:TW'].assignees=['unknown'],s=>s.regions['world:TW'].assignees=['person-0','person-0'],s=>s.salespeople.push(people[0]),s=>s.salespeople[0].color='url(evil)']){
  const invalid=structuredClone(state);change(invalid);assert.throws(()=>store.validateState(invalid,ids));
 }
});
