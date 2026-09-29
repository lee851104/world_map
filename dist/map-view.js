import {regionColors} from './store.js';

export function drilldownScope(region,visibleScope,catalog){
 if(!region||visibleScope!=='world')return null;
 if(region.id==='world:TW'||region.scope==='taiwan')return 'taiwan';
 const iso=region.scope.startsWith('adm1:')?region.scope.slice(5):region.iso3;
 return catalog.countries[iso]?`adm1:${iso}`:null;
}

export function createProjection(d3,scope,collection,extent){
 const projection=d3.geoMercator();
 if(scope==='world'){
  // Frame inhabited latitudes initially; users can pan down to Antarctica.
  // A single uniform scale preserves Mercator's proportions on any screen.
  const north=Math.log(Math.tan(Math.PI/4+85*Math.PI/360)),south=Math.log(Math.tan(Math.PI/4-60*Math.PI/360));
  const scale=Math.min((extent[1][0]-extent[0][0])/(2*Math.PI),(extent[1][1]-extent[0][1])/(north-south));
  return projection.scale(scale).translate([(extent[0][0]+extent[1][0])/2,(extent[0][1]+extent[1][1])/2+scale*(north+south)/2]);
 }
 // Longitude recentering only: preserves north-up Mercator geometry and keeps
 // countries crossing the date line together in their local view.
 if(scope.startsWith('adm1:'))projection.rotate([-d3.geoCentroid(collection)[0],0]);
 return projection.fitExtent(extent,collection);
}
export function subdivisionScopes(state){
 return [...new Set(Object.keys(state.regions).filter(id=>!id.startsWith('world:')&&regionColors(state,id).length).map(id=>id.startsWith('taiwan:')?'taiwan':`adm1:${id.slice(5,8)}`))];
}
export function coloredSubdivisions(all,state){
 return subdivisionScopes(state).flatMap(scope=>(all[scope]||[]).filter(region=>regionColors(state,region.id).length));
}
