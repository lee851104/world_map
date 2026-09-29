const SVG_NS='http://www.w3.org/2000/svg';
const properties=['fill','fill-opacity','stroke','stroke-width','stroke-opacity','stroke-linecap','stroke-linejoin','opacity','vector-effect','paint-order','font-family','font-size','font-weight','text-anchor'];
function styledClone(source){
 const copy=source.cloneNode(true);
 const originals=[source,...source.querySelectorAll('*')],clones=[copy,...copy.querySelectorAll('*')];
 originals.forEach((node,i)=>{
  const style=getComputedStyle(node);
  for(const property of properties){
   // Keep local pattern references; computed URLs may contain the page origin.
   if(property==='fill'&&node.getAttribute('fill')?.startsWith('url('))continue;
   clones[i].style.setProperty(property,style.getPropertyValue(property));
  }
  clones[i].style.setProperty('transition','none');
 });
 copy.querySelectorAll('.country-hit').forEach(node=>node.remove());
 return copy;
}
export async function mapPng(container){
 const source=container.querySelector('.map-svg');
 if(!source)throw Error('地圖尚未載入。');
 const bounds=container.getBoundingClientRect(),width=Math.round(bounds.width),height=Math.round(bounds.height);
 if(width<1||height<1)throw Error('地圖尚未顯示。');
 const root=document.createElementNS(SVG_NS,'svg');
 root.setAttribute('xmlns',SVG_NS);root.setAttribute('width',width);root.setAttribute('height',height);root.setAttribute('viewBox',`0 0 ${width} ${height}`);
 const background=document.createElementNS(SVG_NS,'rect');background.setAttribute('width','100%');background.setAttribute('height','100%');background.setAttribute('fill','#f5f9fb');root.append(background);
 const main=styledClone(source);main.setAttribute('width',width);main.setAttribute('height',height);main.style.overflow='hidden';root.append(main);
 for(const card of container.querySelectorAll('.island-insets:not([hidden]) .island-card')){
  const preview=card.querySelector('svg'),rect=preview.getBoundingClientRect(),cardRect=card.getBoundingClientRect();
  const frame=document.createElementNS(SVG_NS,'rect');
  for(const [key,value]of Object.entries({x:cardRect.left-bounds.left,y:cardRect.top-bounds.top,width:cardRect.width,height:cardRect.height,rx:8,fill:'#ffffff',stroke:'#e3eaed'}))frame.setAttribute(key,value);
  root.append(frame);const inset=styledClone(preview);inset.setAttribute('x',rect.left-bounds.left);inset.setAttribute('y',rect.top-bounds.top);inset.setAttribute('width',rect.width);inset.setAttribute('height',rect.height);root.append(inset);
 }
 if(container.querySelector('.island-insets:not([hidden])')){
  const label=container.querySelector('.inset-caption'),rect=label.getBoundingClientRect(),text=document.createElementNS(SVG_NS,'text');
  text.setAttribute('x',rect.left-bounds.left);text.setAttribute('y',rect.bottom-bounds.top-2);text.setAttribute('font-size','12');text.setAttribute('fill','#71858d');text.textContent=label.textContent;root.append(text);
 }
 const svgUrl=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(root)],{type:'image/svg+xml;charset=utf-8'}));
 try{
  const picture=new Image();picture.src=svgUrl;await picture.decode();
  const scale=Math.min(2,4096/Math.max(width,height));const canvas=document.createElement('canvas');canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);
  const context=canvas.getContext('2d');if(!context)throw Error('此瀏覽器無法產生圖片。');context.drawImage(picture,0,0,canvas.width,canvas.height);
  return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('圖片產生失敗，請再試一次。')),'image/png'));
 }finally{URL.revokeObjectURL(svgUrl)}
}
