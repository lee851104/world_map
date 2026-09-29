const d3=globalThis.d3;
export function createMap(container,{onSelect}){
 let regions=[],records={},selected=null,projection,path,width=1000,height=700;
 const svg=d3.select(container).append('svg').attr('role','img').attr('aria-label','互動地圖，可使用搜尋或地區清單選取').attr('class','map-svg');
 const defs=svg.append('defs');
 const backdrop=svg.append('g');
 const group=svg.append('g');
 const tooltip=d3.select(container).append('div').attr('class','map-tooltip').attr('hidden',true);
 const islands=d3.select(container).append('div').attr('class','island-insets').attr('hidden',true);
 const offshore=new Set(['taiwan:09007','taiwan:09020','taiwan:10016']);
 const zoom=d3.zoom().scaleExtent([1,64]).clickDistance(6).on('zoom',e=>{group.attr('transform',e.transform);backdrop.attr('transform',e.transform);group.selectAll('.country-hit').attr('r',10/e.transform.k);defs.selectAll('pattern').attr('patternTransform',`rotate(35) scale(${1/e.transform.k})`);tooltip.attr('hidden',true)});
 svg.call(zoom).on('dblclick.zoom',null);
 const patternId=(id,prefix)=>`${prefix}-${id.replace(':','-')}`;
 function fill(r,prefix){const colors=records[r.id]?.colors||[];return colors.length>1?`url(#${patternId(r.id,prefix)})`:colors[0]||'#dce4e8'}
 function patterns(target,prefix){
  const patterned=regions.filter(r=>(records[r.id]?.colors||[]).length>1);
  const items=target.selectAll('pattern').data(patterned,r=>r.id).join('pattern').attr('id',r=>patternId(r.id,prefix)).attr('patternUnits','userSpaceOnUse').attr('width',r=>records[r.id].colors.length*7).attr('height',8).attr('patternTransform','rotate(35)');
  items.each(function(r){d3.select(this).selectAll('rect').data(records[r.id].colors).join('rect').attr('x',(_,i)=>i*7).attr('width',7.2).attr('height',8).attr('fill',color=>color)});
 }
 function paint(){
  patterns(defs,'map-stripe');defs.selectAll('pattern').attr('patternTransform',`rotate(35) scale(${1/d3.zoomTransform(svg.node()).k})`);
  group.selectAll('path').attr('fill',r=>fill(r,'map-stripe')).classed('selected',r=>r.id===selected);
  islands.selectAll('svg').each(function(r){const preview=d3.select(this);const prefix=`inset-${r.id.replace(':','-')}`;patterns(preview.select('defs'),prefix);preview.selectAll('.country').attr('fill',d=>fill(d,prefix)).classed('selected',d=>d.id===selected)});
  islands.selectAll('button').attr('aria-pressed',r=>String(r.id===selected));
 }
 function drawIslands(scope){
  islands.attr('hidden',scope==='taiwan'?null:true);islands.selectAll('*').remove();if(scope!=='taiwan')return;
  islands.append('span').attr('class','inset-caption').text('離島放大・非同比例');
  const cards=islands.selectAll('button').data(regions.filter(r=>offshore.has(r.id))).join('button').attr('type','button').attr('class','island-card').attr('aria-label',r=>`選取並放大${r.name}`).on('click',(_,r)=>onSelect(r.id,true));
  cards.append('span').text(r=>r.name);
  cards.each(function(r){
   const preview=d3.select(this).append('svg').attr('viewBox','0 0 160 100').attr('aria-hidden','true');preview.append('defs');
   // Kinmen includes distant Wuqiu: use two geographic frames so neither disappears.
   const pieces=r.id==='taiwan:09020'?[{type:'Feature',geometry:{type:'MultiPolygon',coordinates:r.feature.geometry.coordinates.filter(p=>d3.geoCentroid({type:'Polygon',coordinates:p})[0]<119)}},{type:'Feature',geometry:{type:'MultiPolygon',coordinates:r.feature.geometry.coordinates.filter(p=>d3.geoCentroid({type:'Polygon',coordinates:p})[0]>=119)}}]:[r.feature];
   if(r.id==='taiwan:09007'){
    preview.attr('viewBox','0 0 160 124');
    const clusters=[{name:'南北竿',accept:([x,y])=>x<120.1&&y>=26.1},{name:'東引',accept:([x])=>x>=120.4},{name:'莒光',accept:([,y])=>y<26.1},{name:'亮島',accept:([x,y])=>x>=120.1&&x<120.4&&y>=26.1}];
    clusters.forEach((cluster,i)=>{const x=(i%2)*80,y=Math.floor(i/2)*62;const feature={type:'Feature',geometry:{type:'MultiPolygon',coordinates:r.feature.geometry.coordinates.filter(p=>cluster.accept(d3.geoCentroid({type:'Polygon',coordinates:p})))}};if(!feature.geometry.coordinates.length)return;const local=d3.geoMercator().fitExtent([[x+8,y+3],[x+72,y+41]],feature);preview.append('path').datum(r).attr('d',d3.geoPath(local)(feature)).attr('class','country');preview.append('text').attr('x',x+40).attr('y',y+58).attr('text-anchor','middle').attr('class','islet-label').text(cluster.name)});
   }else pieces.forEach((feature,i)=>{const extent=pieces.length===1?[[8,8],[152,92]]:i===0?[[5,12],[108,90]]:[[118,20],[154,64]];const local=d3.geoMercator().fitExtent(extent,feature);preview.append('path').datum(r).attr('d',d3.geoPath(local)(feature)).attr('class','country');if(pieces.length>1&&i===1)preview.append('text').attr('x',136).attr('y',88).attr('text-anchor','middle').attr('class','islet-label').text('烏坵')});
  });
 }
 function draw(preserveView=false){
  if(!regions.length)return;
  const previous=d3.zoomTransform(svg.node());
  const center=preserveView&&projection?projection.invert([(width/2-previous.x)/previous.k,(height/2-previous.y)/previous.k]):null;
  width=container.clientWidth||1000;height=container.clientHeight||700;svg.attr('viewBox',`0 0 ${width} ${height}`);
  const scope=regions[0].scope,collection={type:'FeatureCollection',features:regions.filter(r=>!offshore.has(r.id)).map(r=>r.feature)};
  svg.attr('data-scope',scope);
  projection=scope==='world'?d3.geoEqualEarth():scope==='adm1:USA'?d3.geoAlbersUsa():d3.geoMercator().rotate(scope.startsWith('adm1:')?[-d3.geoCentroid(collection)[0],0]:[0,0]);
  projection.fitExtent(scope==='world'?[[32,45],[width-32,height-65]]:scope==='taiwan'?[[width<550?125:190,30],[width-25,height-75]]:[[24,30],[width-24,height-75]],scope==='world'?{type:'Sphere'}:collection);
  path=d3.geoPath(projection);
  backdrop.selectAll('*').remove();
  if(scope==='world'){
   backdrop.append('path').datum(d3.geoGraticule10()).attr('d',path).attr('class','graticule');
  }
  group.selectAll('path').data(regions,r=>r.id).join('path').attr('d',r=>path(r.feature)).attr('class','country').attr('data-region',r=>r.id)
   .on('click',(event,r)=>{event.stopPropagation();onSelect(r.id)})
   .on('pointermove',(event,r)=>{if(event.pointerType==='touch')return;const [x,y]=d3.pointer(event,container);tooltip.text(r.name).attr('hidden',null).style('left',`${Math.min(x+14,width-130)}px`).style('top',`${Math.max(8,y-40)}px`)})
   .on('pointerleave',()=>tooltip.attr('hidden',true));
  group.selectAll('.country-hit').data(regions.filter(r=>r.id==='world:TW')).join('circle').attr('class','country-hit').attr('cx',r=>path.centroid(r.feature)[0]).attr('cy',r=>path.centroid(r.feature)[1]).attr('r',10).attr('fill','transparent').attr('aria-label','台灣').style('cursor','pointer').on('click',(event,r)=>{event.stopPropagation();onSelect(r.id)});
  drawIslands(scope);paint();
  const point=center&&projection(center);
  const transform=point&&previous.k>1?d3.zoomIdentity.translate(width/2,height/2).scale(previous.k).translate(-point[0],-point[1]):d3.zoomIdentity;
  svg.call(zoom.transform,transform);
 }
 const observer=new ResizeObserver(()=>draw(true));observer.observe(container);
 return {
  setRegions(value){regions=value;draw()},setColors(value){records=value;paint()},select(id){selected=id;paint()},
  focus(id){const r=regions.find(r=>r.id===id);if(!r||!path)return;const [[x0,y0],[x1,y1]]=path.bounds(r.feature);const left=r.scope==='taiwan'?(width<550?125:190):0;const areaWidth=width-left;const scale=Math.max(1,Math.min(60,.75/Math.max((x1-x0)/areaWidth,(y1-y0)/(height-90))));const t=d3.zoomIdentity.translate(left+areaWidth/2,height/2).scale(scale).translate(-(x0+x1)/2,-(y0+y1)/2);svg.transition().duration(380).call(zoom.transform,t)},
  zoomBy(factor){svg.transition().duration(180).call(zoom.scaleBy,factor)},reset(){svg.transition().duration(300).call(zoom.transform,d3.zoomIdentity)},destroy(){observer.disconnect();svg.remove();tooltip.remove();islands.remove()}
 };
}
