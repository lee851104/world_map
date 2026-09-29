import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {geoArea,geoContains} from 'd3';
import {normalizeRegions,searchRegions} from '../dist/regions.js';
import {emptyState,setRegionColor,validateState} from '../dist/store.js';
const data=JSON.parse(await readFile(new URL('../dist/data/adm1/PRK.json',import.meta.url),'utf8'));
const oldIds=['3916807B5646338397672','3916807B60771411413787','3916807B42842403076429','3916807B66197610677259','3916807B54689859523154','3916807B80386364257881','3916807B24987303688366','3916807B2118550659035','3916807B59695090380014','3916807B69422143587516','3916807B57216784573597'];
test('North Korea has 13 selectable regions including the four cities, while retaining existing IDs',()=>{
 const regions=normalizeRegions(data,'adm1:PRK');assert.equal(regions.length,13);
 for(const id of oldIds)assert.ok(regions.some(r=>r.id===`adm1:PRK-${id}`));
 for(const query of ['平壤','開城','羅先','南浦'])assert.equal(searchRegions(regions,query).length,1,query);
 const ids=new Set(regions.map(r=>r.id));let state=emptyState();
 for(const id of ids)state=setRegionColor(state,id,'#327fd1');
 assert.equal(Object.keys(validateState(JSON.parse(JSON.stringify(state)),ids).regions).length,13);
});
test('special cities own their territory exclusively instead of overlapping their former province',()=>{
 for(const [query,point]of [['開城',[126.55,37.97]],['開城',[126.8,38.12]],['羅先',[130.3,42.25]]]){
  const region=normalizeRegions(data,'adm1:PRK').find(r=>r.name.includes(query));assert.ok(region,query);
  const hits=data.features.filter(f=>geoContains(f,point));assert.equal(hits.length,1);assert.equal(hits[0].properties.id,region.feature.properties.id);
 }
 for(const f of data.features)assert.ok(geoArea(f)>0&&geoArea(f)<0.01,f.properties.name);
});
