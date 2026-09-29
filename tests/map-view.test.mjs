import test from 'node:test';
import assert from 'node:assert/strict';
import * as d3 from 'd3';
import {createProjection, subdivisionScopes, coloredSubdivisions} from '../dist/map-view.js';

test('world and country views use conformal Mercator, including real Alaska position',()=>{
 const points={type:'MultiPoint',coordinates:[[-150,60],[-120,35],[-80,40]]};
 for(const scope of ['world','adm1:USA','taiwan']){
  const p=createProjection(d3,scope,points,[[20,20],[980,680]]);
  assert.ok(typeof p.center==='function');
  const a=p([-150,60]),b=p([-120,35]);
  assert.ok(a.every(Number.isFinite));assert.ok(a[0]<b[0]&&a[1]<b[1]);
  const round=p.invert(p([121,24]));assert.ok(Math.abs(round[0]-121)<1e-8&&Math.abs(round[1]-24)<1e-8);
 }
});
test('world overlay includes painted subdivisions and assignees, excludes note-only and country records',()=>{
 const state={salespeople:[{id:'a',color:'#ff0000'}],regions:{'world:US':{color:'#0000ff'},'adm1:USA-a':{color:'#ff0000'},'adm1:JPN-b':{assignees:['a']},'taiwan:09007':{color:'#00ff00'},'adm1:CAN-c':{events:[{title:'note'}]}}};
 assert.deepEqual(subdivisionScopes(state).sort(),['adm1:JPN','adm1:USA','taiwan']);
 const all={world:[{id:'world:US'}],'adm1:USA':[{id:'adm1:USA-a'},{id:'adm1:USA-empty'}],taiwan:[{id:'taiwan:09007'}]};
 assert.deepEqual(coloredSubdivisions(all,state).map(r=>r.id),['adm1:USA-a','taiwan:09007']);
 assert.deepEqual(subdivisionScopes({regions:{},salespeople:[]}),[]);
});
