const d3=globalThis.d3;
export function createMap(container,{onSelect}){
 let regions=[],records={},selected=null,projection,path,width=1000,height=700;
 const svg=d3.select(container).append('svg').attr('role','img').attr('aria-label','互動地圖，可使用搜尋或地區清單選取').attr('class','map-svg');
 const backdrop=svg.append('g');
 const group=svg.append('g');
 const tooltip=d3.select(container).append('div').attr('class','map-tooltip').attr('hidden',true);
 const zoom=d3.zoom().scaleExtent([1,32]).clickDistance(6).on('zoom',e=>{group.attr('transform',e.transform);backdrop.attr('transform',e.transform);tooltip.attr('hidden',true)});
 svg.call(zoom).on('dblclick.zoom',null);
 function paint(){group.selectAll('path').attr('fill',r=>records[r.id]?.color||'#dce4e8').classed('selected',r=>r.id===selected);}
 function draw(preserveView=false){
  if(!regions.length)return;
  const previous=d3.zoomTransform(svg.node());
  const center=preserveView&&projection?projection.invert([(width/2-previous.x)/previous.k,(height/2-previous.y)/previous.k]):null;
  width=container.clientWidth||1000;height=container.clientHeight||700;svg.attr('viewBox',`0 0 ${width} ${height}`);
  const scope=regions[0].scope,collection={type:'FeatureCollection',features:regions.map(r=>r.feature)};
  svg.attr('data-scope',scope);
  projection=scope==='world'?d3.geoEqualEarth():d3.geoMercator();
  projection.fitExtent([[32,45],[width-32,height-65]],scope==='world'?{type:'Sphere'}:collection);
  path=d3.geoPath(projection);
  backdrop.selectAll('*').remove();
  if(scope==='world'){
   backdrop.append('path').datum(d3.geoGraticule10()).attr('d',path).attr('class','graticule');
  }
  group.selectAll('path').data(regions,r=>r.id).join('path').attr('d',r=>path(r.feature)).attr('class','country').attr('data-region',r=>r.id)
   .on('click',(event,r)=>{event.stopPropagation();onSelect(r.id)})
   .on('pointermove',(event,r)=>{if(event.pointerType==='touch')return;const [x,y]=d3.pointer(event,container);tooltip.text(r.name).attr('hidden',null).style('left',`${Math.min(x+14,width-130)}px`).style('top',`${Math.max(8,y-40)}px`)})
   .on('pointerleave',()=>tooltip.attr('hidden',true));
  paint();
  const point=center&&projection(center);
  const transform=point&&previous.k>1?d3.zoomIdentity.translate(width/2,height/2).scale(previous.k).translate(-point[0],-point[1]):d3.zoomIdentity;
  svg.call(zoom.transform,transform);
 }
 const observer=new ResizeObserver(()=>draw(true));observer.observe(container);
 return {
  setRegions(value){regions=value;draw()},setColors(value){records=value;paint()},select(id){selected=id;paint()},
  focus(id){const r=regions.find(r=>r.id===id);if(!r||!path)return;const [[x0,y0],[x1,y1]]=path.bounds(r.feature);const scale=Math.max(1,Math.min(24,.65/Math.max((x1-x0)/width,(y1-y0)/height)));const t=d3.zoomIdentity.translate(width/2,height/2).scale(scale).translate(-(x0+x1)/2,-(y0+y1)/2);svg.transition().duration(380).call(zoom.transform,t)},
  zoomBy(factor){svg.transition().duration(180).call(zoom.scaleBy,factor)},reset(){svg.transition().duration(300).call(zoom.transform,d3.zoomIdentity)},destroy(){observer.disconnect();svg.remove();tooltip.remove()}
 };
}
