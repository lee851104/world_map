import test from 'node:test';
import assert from 'node:assert/strict';
import {exportKml} from '../dist/kml.js';
const region={id:'world:US',name:'A & <B>',feature:{type:'Feature',geometry:{type:'Polygon',coordinates:[[[0,0],[0,2],[2,2],[2,0],[0,0]],[[.5,.5],[1,.5],[1,1],[.5,.5]]]}}};
test('KML preserves geometry holes and safely escapes notes and all assignees',()=>{
 const state={salespeople:[{id:'a',name:'Alice',color:'#112233'},{id:'b',name:'Bob',color:'#445566'}],regions:{'world:US':{color:null,assignees:['a','b'],events:[{date:'2026-09-29',title:'<script>',content:'A&B'}]}}};
 const parts=exportKml('地圖',[region],state);
 assert.equal(parts.length,1);assert.match(parts[0].content,/innerBoundaryIs/);assert.match(parts[0].content,/99332211/);assert.match(parts[0].content,/Alice/);assert.match(parts[0].content,/Bob/);assert.match(parts[0].content,/&amp;lt;script&amp;gt;/);assert.doesNotMatch(parts[0].content,/<script>/);
});
test('KML splits by limits and skips unmarked regions',()=>{
 const features=Array.from({length:4},(_,i)=>({...region,id:`world:${i}`}));const state={salespeople:[],regions:Object.fromEntries(features.slice(0,3).map(r=>[r.id,{color:'#ff0000',events:[],assignees:[]}]))};
 assert.equal(exportKml('test',features,state,{maxFeatures:2}).length,2);
 assert.deepEqual(exportKml('test',features,{salespeople:[],regions:{}}),[]);
});
