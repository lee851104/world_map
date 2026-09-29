import {mkdir,writeFile,copyFile} from 'node:fs/promises';
import {feature} from 'topojson-client';
import {topology} from 'topojson-server';
import {presimplify,simplify,quantile} from 'topojson-simplify';
import {geoArea} from 'd3';
const root=new URL('../',import.meta.url);
await mkdir(new URL('dist/data/',root),{recursive:true});
await mkdir(new URL('dist/vendor/',root),{recursive:true});
const sources={world:'https://raw.githubusercontent.com/datasets/geo-countries/main/data/countries.geojson',taiwan:'https://cdn.jsdelivr.net/npm/taiwan-atlas@2021.9.20/counties-10t.json'};
async function get(url){const r=await fetch(url);if(!r.ok)throw Error(`${r.status}: ${url}`);return r.json()}
const [world,tw]=await Promise.all([get(sources.world),get(sources.taiwan)]);
const topo=presimplify(topology({countries:world},1e5));
const light=feature(simplify(topo,quantile(topo,0.15)),topo.objects.countries);
// Tiny states need original boundaries: simplification can collapse their rings.
light.features=light.features.map((f,i)=>geoArea(f)<=1e-12||geoArea(world.features[i])<1e-7?world.features[i]:f);
await writeFile(new URL('dist/data/world.json',root),JSON.stringify(light));
await writeFile(new URL('dist/data/taiwan.json',root),JSON.stringify(feature(tw,tw.objects.counties)));
await writeFile(new URL('dist/data/sources.json',root),JSON.stringify({retrieved:new Date().toISOString(),sources},null,2));
await copyFile(new URL('node_modules/d3/dist/d3.min.js',root),new URL('dist/vendor/d3.min.js',root));
await copyFile(new URL('node_modules/d3/LICENSE',root),new URL('dist/vendor/D3-LICENSE.txt',root));
console.log(JSON.stringify({world:light.features.length,taiwan:tw.objects.counties.geometries.length,worldProperties:light.features[0].properties,countyProperties:tw.objects.counties.geometries[0].properties}));
