import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {geoArea} from 'd3';
const root=new URL('../dist/data/',import.meta.url);
const catalog=JSON.parse(await readFile(new URL('./adm1-catalog.json',import.meta.url),'utf8'));
await mkdir(new URL('adm1/',root),{recursive:true});
let index={};try{index=JSON.parse(await readFile(new URL('adm1-index.json',root),'utf8')).countries}catch{}
const failures=[];
const rewindRing=ring=>ring.map(p=>p.slice(0,2).map(n=>+n.toFixed(5)));
function normalize(f){
 const geometry=structuredClone(f.geometry);
 const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
 for(let i=0;i<polygons.length;i++){
  polygons[i]=polygons[i].map(rewindRing);
  const polygon={type:'Polygon',coordinates:polygons[i]};
  if(geoArea(polygon)>2*Math.PI)polygons[i]=polygons[i].map(r=>r.reverse());
 }
 geometry.coordinates=geometry.type==='Polygon'?polygons[0]:polygons;
 return {type:'Feature',properties:{name:f.properties.shapeName,id:f.properties.shapeID,iso:f.properties.shapeISO||''},geometry};
}
const queue=catalog.filter(m=>m.boundaryISO!=='TWN'&&!index[m.boundaryISO]);let done=0;
async function worker(){while(queue.length){const meta=queue.shift();try{
 const url=meta.simplifiedGeometryGeoJSON;const response=await fetch(url,{signal:AbortSignal.timeout(180000)});if(!response.ok)throw Error(`HTTP ${response.status}`);
 const collection=await response.json();let features=collection.features.map(normalize);
 if(meta.boundaryISO==='USA')features=features.filter(f=>!['US-AS','US-GU','US-MP','US-PR','US-VI'].includes(f.properties.iso));
 if(!features.length||features.some(f=>!f.properties.id||!['Polygon','MultiPolygon'].includes(f.geometry.type)))throw Error('invalid feature');
 await writeFile(new URL(`adm1/${meta.boundaryISO}.json`,root),JSON.stringify({type:'FeatureCollection',features}));
 index[meta.boundaryISO]={name:meta.boundaryName,count:features.length,year:meta.boundaryYearRepresented,source:meta.boundarySource,license:meta.boundaryLicense,sourceUrl:meta.boundarySourceURL,downloadUrl:url,ids:features.map(f=>f.properties.id)};
 }catch(error){failures.push({iso:meta.boundaryISO,error:error.message})}done++;if(done%20===0)console.log(`${done}/${catalog.length-1} downloaded`);}}
await Promise.all(Array.from({length:6},worker));
await writeFile(new URL('adm1-index.json',root),JSON.stringify({retrieved:new Date().toISOString(),provider:'geoBoundaries gbOpen',url:'https://www.geoboundaries.org/',countries:index}));
console.log(JSON.stringify({downloaded:Object.keys(index).length,failures}));
if(failures.length)process.exitCode=1;
