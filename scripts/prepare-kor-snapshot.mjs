// One-time source preparation. Input is the unmodified, publicly licensed
// HangJeongDong_ver20260401.geojson download. Runtime ships dissolved provinces.
import fs from 'node:fs/promises';
import {topology} from 'topojson-server';
import {merge} from 'topojson-client';
import {geoArea} from 'd3';
const input=process.argv[2];if(!input)throw Error('Pass the April 2026 source GeoJSON path');
const root=new URL('../',import.meta.url);
const original=JSON.parse(await fs.readFile(input));
const previous=JSON.parse(await fs.readFile(new URL('dist/data/adm1/KOR.json',root)));
const codes={'36':'50','50':'49','51':'42','52':'45'};
const chinese={'11':'首爾特別市','26':'釜山廣域市','27':'大邱廣域市','28':'仁川廣域市','29':'光州廣域市','30':'大田廣域市','31':'蔚山廣域市','41':'京畿道','42':'江原特別自治道','43':'忠清北道','44':'忠清南道','45':'全北特別自治道','46':'全羅南道','47':'慶尚北道','48':'慶尚南道','49':'濟州特別自治道','50':'世宗特別自治市'};
const topo=topology({districts:original});
const groups=Object.groupBy(topo.objects.districts.geometries,g=>g.properties.sido);
if(Object.keys(groups).length!==17)throw Error('Expected 17 regions in April snapshot');
const features=Object.entries(groups).map(([sido,parts])=>{
 const code=codes[sido]||sido,old=previous.features.find(f=>f.properties.iso===`KR-${code}`);
 if(!old)throw Error(`Unmapped region ${sido}`);
 const geometry=merge(topo,parts);
 geometry.coordinates=geometry.coordinates.map(p=>p.map(r=>r.map(point=>point.map(n=>+n.toFixed(5)))));
 for(const p of geometry.coordinates)if(geoArea({type:'Polygon',coordinates:p})>Math.PI*2)p.forEach(r=>r.reverse());
 return {type:'Feature',properties:{...old.properties,nameZh:chinese[code],sourceName:parts[0].properties.sidonm},geometry};
});
const collection={type:'FeatureCollection',features};
await fs.writeFile(new URL('dist/data/adm1/KOR.json',root),JSON.stringify(collection));
const catalog=JSON.parse(await fs.readFile(new URL('dist/data/adm1-index.json',root)));
catalog.countries.KOR={...catalog.countries.KOR,year:'2026-04-01 snapshot (17 regions, before July merger)',source:'Statistics Korea SGIS, processed by vuski/admdongkor; dissolved to province level by Atlas Notes',license:'CC BY 4.0; upstream KOGL Type 1',sourceUrl:'https://github.com/vuski/admdongkor',downloadUrl:'https://raw.githubusercontent.com/vuski/admdongkor/master/ver20260401/HangJeongDong_ver20260401.geojson',modifications:'Dissolved administrative-dong polygons by sido; rounded to 5 decimals and normalized ring winding. Original 17 Atlas region IDs retained. Historical April snapshot intentionally keeps Gwangju and Jeonnam separate; not the July 2026 administrative grouping.'};
await fs.writeFile(new URL('dist/data/adm1-index.json',root),JSON.stringify(catalog));
console.log('KOR: 17 detailed region boundaries; existing IDs retained.');
