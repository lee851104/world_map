import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as d3 from 'd3';
import {normalizeRegions} from '../dist/regions.js';
import * as view from '../dist/map-view.js';
import {validateState,emptyState,setRegionColor} from '../dist/store.js';
import {exportKml} from '../dist/kml.js';
const read=async name=>JSON.parse(await fs.readFile(new URL(`../dist/data/${name}.json`,import.meta.url)));
test('world subdivision selection retains its parent country entry',()=>{
 const catalog={countries:{CHN:{},FRA:{}}};
 assert.equal(view.drilldownScope({scope:'adm1:CHN'},'world',catalog),'adm1:CHN');
 assert.equal(view.drilldownScope({scope:'taiwan'},'world',catalog),'taiwan');
 assert.equal(view.drilldownScope({scope:'adm1:CHN'},'adm1:CHN',catalog),null);
});
test('France links to metropolitan regions and China excludes Taiwan without removing backup IDs',async()=>{
 const world=normalizeRegions(await read('world'),'world');
 assert.equal(world.find(r=>r.id==='world:FR').iso3,'FRA');
 const china=normalizeRegions(await read('adm1/CHN'),'adm1:CHN');
 assert.ok(!china.some(r=>/Taiwan/i.test(r.englishName)));
 assert.equal(china.length,33);
 const catalog=await read('adm1-index');
 assert.ok(catalog.countries.CHN.ids.includes('43563684B32372453033755'));
});
test('straight longitude/latitude borders stay straight in Mercator',()=>{
 const line={type:'FeatureCollection',features:[{type:'Feature',properties:{name:'Test','ISO3166-1-Alpha-2':'US'},geometry:{type:'Polygon',coordinates:[[[-122.75,48.99],[-95.17,48.99],[-95.17,30],[-122.75,30],[-122.75,48.99]]]}}]};
 const r=normalizeRegions(line,'world')[0];
 const points=[];const projection=d3.geoMercator().scale(100);
 d3.geoStream(r.feature,projection.stream({point:(x,y)=>points.push([x,y]),lineStart(){},lineEnd(){},polygonStart(){},polygonEnd(){}}));
 const northY=projection([-110,48.99])[1];
 assert.ok(Math.min(...points.map(p=>p[1]))>=northY-.001,'49th parallel must not bow north');
});
test('Kazakhstan has no separate Baikonur hole and retired records remain importable',async()=>{
 const world=normalizeRegions(await read('world'),'world');
 const kaz=world.find(r=>r.id==='world:KZ');
 assert.ok(d3.geoContains(kaz.feature,[63.3,46]));
 assert.ok(!world.some(r=>r.englishName==='Baykonur Cosmodrome'));
 assert.ok((await read('adm1-index')).legacyWorldIds.includes('world:X-BAYKONUR-COSMODROME'));
});
test('Korean snapshot preserves 17 stored IDs with real metropolitan boundaries',async()=>{
 const data=await read('adm1/KOR'),catalog=await read('adm1-index');
 assert.equal(data.features.length,17);
 assert.deepEqual(new Set(data.features.map(f=>f.properties.id)),new Set(catalog.countries.KOR.ids));
 const byIso=iso=>data.features.find(f=>f.properties.iso===iso);
 const area=f=>d3.geoArea(f)*6371**2;
 assert.ok(area(byIso('KR-29'))>480&&area(byIso('KR-29'))<530,'Gwangju should be about 500 km²');
 assert.ok(area(byIso('KR-27'))>1450&&area(byIso('KR-27'))<1550,'Daegu includes Gunwi');
 assert.ok(d3.geoContains(byIso('KR-27'),[128.572,36.242]));
});
test('retired duplicate Taiwan data survives JSON but cannot cover Taiwan in KML',async()=>{
 const catalog=await read('adm1-index');
 const world=normalizeRegions(await read('world'),'world'),tw=normalizeRegions(await read('taiwan'),'taiwan');
 const china=normalizeRegions(await read('adm1/CHN'),'adm1:CHN');
 const ids=new Set([...world,...tw].map(r=>r.id).concat(catalog.legacyWorldIds));
 for(const [iso,entry]of Object.entries(catalog.countries))for(const id of entry.ids)ids.add(`adm1:${iso}-${id}`);
 const retired='adm1:CHN-43563684B32372453033755';
 let state=emptyState();for(const id of [retired,'world:TW','world:X-BAYKONUR-COSMODROME'])state=setRegionColor(state,id,'#ff0000');
 const restored=validateState(JSON.parse(JSON.stringify(state)),ids);
 assert.deepEqual(restored.regions,state.regions);
 const kml=exportKml('backup',[...world,...tw,...china],restored).map(p=>p.content).join('');
 assert.ok(kml.includes('world:TW'));assert.ok(!kml.includes(retired));
 assert.ok(!kml.includes('world:X-BAYKONUR-COSMODROME'));
});
