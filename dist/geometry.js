// GeoJSON edges are linear in longitude/latitude. Subdivide before D3's
// spherical resampling so long parallels are not drawn as great-circle arcs.
export function linearGeometry(geometry){
 const line=points=>points.flatMap((a,i)=>{
  if(i===points.length-1)return [a];
  const b=points[i+1];let dx=b[0]-a[0];
  if(Math.abs(dx)>180)dx-=Math.sign(dx)*360;
  const steps=Math.ceil(Math.max(Math.abs(dx),Math.abs(b[1]-a[1]))/.2)||1;
  return Array.from({length:steps},(_,j)=>{
   if(!j)return a;
   let x=a[0]+dx*j/steps;if(x>180)x-=360;if(x<-180)x+=360;
   return [x,a[1]+(b[1]-a[1])*j/steps];
  });
 });
 if(geometry.type==='Polygon')return {...geometry,coordinates:geometry.coordinates.map(line)};
 if(geometry.type==='MultiPolygon')return {...geometry,coordinates:geometry.coordinates.map(p=>p.map(line))};
 return geometry;
}
