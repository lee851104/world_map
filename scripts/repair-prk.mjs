import {readFile,writeFile} from 'node:fs/promises';
import clipping from 'polygon-clipping';
import {geoArea} from 'd3';
const root=new URL('../',import.meta.url);
const read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const source=await read('scripts/sources/PRK-adm1-2018.json');
const parts=await read('scripts/sources/PRK-special-city-parts-2019.json');
const coordinates=f=>(f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates).map(poly=>poly.map(ring=>ring.map(p=>p.slice(0,2).map(n=>+n.toFixed(5)))));
function geometry(polygons){
 for(let i=0;i<polygons.length;i++)if(geoArea({type:'Polygon',coordinates:polygons[i]})>2*Math.PI)polygons[i]=polygons[i].map(r=>r.reverse());
 return {type:'MultiPolygon',coordinates:polygons};
}
const names={Jagang:'慈江道',Kangwon:'江原道',Nampo:'南浦特別市','North Hamgyong':'咸鏡北道','North Hwanghae':'黃海北道','North Pyongan':'平安北道',Pyongyang:'平壤直轄市',Ryanggang:'兩江道','South Hamgyong':'咸鏡南道','South Hwanghae':'黃海南道','South Pyongan':'平安南道'};
for(const f of source.features)f.properties.nameZh=names[f.properties.name];
const changes=[
 {name:'Kaesong',nameZh:'開城特別市',id:'KP-15',parent:'North Hwanghae',parts:['Kaesong City','Jangphung']},
 {name:'Rason',nameZh:'羅先特別市',id:'KP-13',parent:'North Hamgyong',parts:['Rason City']}
];
for(const change of changes){
 const parent=source.features.find(f=>f.properties.name===change.parent);
 const pieces=change.parts.map(name=>{const found=parts.features.find(f=>f.properties.shapeName===name);if(!found)throw Error(`Missing ${name}`);return coordinates(found)});
 const city=clipping.intersection(coordinates(parent),clipping.union(...pieces));
 if(!city.length)throw Error(`Empty ${change.name}`);
 parent.geometry=geometry(clipping.difference(coordinates(parent),city));
 source.features.push({type:'Feature',properties:{name:change.name,nameZh:change.nameZh,id:change.id,iso:change.id},geometry:geometry(city)});
}
await writeFile(new URL('dist/data/adm1/PRK.json',root),JSON.stringify(source));
const index=await read('dist/data/adm1-index.json');
index.countries.PRK={...index.countries.PRK,count:13,year:'2018/2019 geometry; 2025 administrative grouping',source:'World Food Programme, OCHA ROAP via geoBoundaries; administrative grouping checked against Ministry of Unification (2025)',ids:source.features.map(f=>f.properties.id),
 supplementaryDownloadUrl:parts.url,
 administrativeSourceUrl:'https://nkinfo.unikorea.go.kr/nkp/pge/view.do?menuId=SO302',
 kaesongMembershipSourceUrl:'https://nkinfo.unikorea.go.kr/nkp/search/search.do?query=%EA%B0%9C%EC%84%B1%ED%8A%B9%EB%B3%84%EC%8B%9C',
 modifications:'Kaesong City and Jangphung ADM2 units merged into Kaesong; Rason City promoted to ADM1. Both clipped to and subtracted from their former province to retain a non-overlapping partition. Original 11 region IDs retained. Simplified historical geometry, not a current cadastral survey.'};
await writeFile(new URL('dist/data/adm1-index.json',root),JSON.stringify(index));
console.log('PRK: 13 regions; existing 11 IDs retained.');
