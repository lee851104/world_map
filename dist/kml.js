const esc=value=>String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
const byteLength=text=>new TextEncoder().encode(text).length;
const colorToKml=color=>`99${color.slice(5,7)}${color.slice(3,5)}${color.slice(1,3)}`;
function ring(points,outer=true){let area=0;for(let i=1;i<points.length;i++)area+=points[i-1][0]*points[i][1]-points[i][0]*points[i-1][1];const ordered=(outer&&area<0)||(!outer&&area>0)?[...points].reverse():points;return `<LinearRing><coordinates>${ordered.map(([x,y])=>`${+x.toFixed(5)},${+y.toFixed(5)},0`).join(' ')}</coordinates></LinearRing>`}
function geometry(value){
 const polygons=value.type==='Polygon'?[value.coordinates]:value.type==='MultiPolygon'?value.coordinates:[];
 return `<MultiGeometry>${polygons.map(p=>`<Polygon><tessellate>1</tessellate><outerBoundaryIs>${ring(p[0])}</outerBoundaryIs>${p.slice(1).map(h=>`<innerBoundaryIs>${ring(h,false)}</innerBoundaryIs>`).join('')}</Polygon>`).join('')}</MultiGeometry>`;
}
export function exportKml(name,regions,state,{maxBytes=4_900_000,maxFeatures=1900}={}){
 const head=`<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${esc(name)}</name>`,tail='</Document></kml>';
 const parts=[];let marks=[],size=byteLength(head+tail);
 const flush=()=>{if(marks.length)parts.push({name:`${name}${parts.length?`-${parts.length+1}`:''}.kml`,content:head+marks.join('')+tail});marks=[];size=byteLength(head+tail)};
 for(const region of regions){const record=state.regions[region.id];if(!record||(!record.color&&!record.assignees?.length&&!record.events?.length))continue;
  const people=(record.assignees||[]).map(id=>state.salespeople?.find(p=>p.id===id)).filter(Boolean);
  const color=people[0]?.color||record.color||'#83afcb';
  const description=[people.length?`負責人：${people.map(p=>p.name).join('、')}`:'',...(record.events||[]).map(e=>`${e.date} ${e.title}\n${e.content}`)].filter(Boolean).join('\n\n');
  const mark=`<Placemark><name>${esc(region.name)}</name><description>${esc(esc(description).replaceAll('\n','<br>'))}</description><ExtendedData><Data name="regionId"><value>${esc(region.id)}</value></Data><Data name="assignees"><value>${esc(people.map(p=>p.name).join('、'))}</value></Data></ExtendedData><Style><PolyStyle><color>${colorToKml(color)}</color><outline>1</outline></PolyStyle><LineStyle><color>ff777777</color><width>1</width></LineStyle></Style>${geometry(region.feature.geometry)}</Placemark>`;
  const bytes=byteLength(mark);if(bytes+byteLength(head+tail)>maxBytes)throw Error(`${region.name} 的邊界超過 My Maps 單檔限制，請分別匯出較小行政區。`);
  if(marks.length>=maxFeatures||size+bytes>maxBytes)flush();marks.push(mark);size+=bytes;
 }
 flush();return parts;
}
