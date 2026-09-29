import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normalizeRegions, searchRegions} from '../dist/regions.js';
import {geoArea} from 'd3';
const load = async name => JSON.parse(await readFile(new URL(`../dist/data/${name}.json`,import.meta.url),'utf8'));
test('all 22 counties and islands are selectable with unique stable IDs',async()=>{
 const regions=normalizeRegions(await load('taiwan'),'taiwan');
 assert.equal(regions.length,22); assert.equal(new Set(regions.map(r=>r.id)).size,22);
 const names='臺北市 新北市 桃園市 臺中市 臺南市 高雄市 基隆市 新竹市 嘉義市 新竹縣 苗栗縣 彰化縣 南投縣 雲林縣 嘉義縣 屏東縣 宜蘭縣 花蓮縣 臺東縣 澎湖縣 金門縣 連江縣'.split(' ');
 assert.deepEqual(regions.map(r=>r.name).sort(),names.sort());
 assert.equal(searchRegions(regions,'台北')[0].name,'臺北市');
 assert.ok(regions.every(r=>r.feature.geometry.coordinates.length));
});
test('world contains Taiwan and microstates; no duplicate IDs',async()=>{
 const regions=normalizeRegions(await load('world'),'world');
 assert.equal(new Set(regions.map(r=>r.id)).size,regions.length);
 for(const code of ['TW','MC','VA','SG','JP','US']) {const r=regions.find(r=>r.id===`world:${code}`);assert.ok(r,code);assert.ok(geoArea(r.feature)>0,`${code} must retain a visible polygon`);}
 assert.equal(searchRegions(regions,'Japan')[0].id,'world:JP');
});
