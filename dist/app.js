import {loadRegions,searchRegions} from './regions.js';
import {emptyState,loadState,persistState,validateState,setRegionColor,upsertEvent,deleteEvent,MAX_BACKUP_BYTES} from './store.js';
import {createMap} from './map.js';
const $=id=>document.getElementById(id);
const palette=['#84b8a4','#83afcb','#ab9aca','#e5b976','#d98c88','#739eaa'];
let all={},scope='world',selected=null,state=emptyState(),validIds=new Set(),editing=null,storageBlocked=false,storageRaw=null,toastTimer;
const map=createMap($('map'),{onSelect:selectRegion});
function notify(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,3500)}
function showPanel(){ $('panel').classList.add('open'); }
function current(){return Object.values(all).flat().find(r=>r.id===selected)}
function save(next){
 if(storageBlocked){notify('目前資料讀取異常，請先用備份還原，以免覆蓋原紀錄。');return false}
 try{validateState(next,validIds);persistState(localStorage,next,storageRaw);storageRaw=JSON.stringify(next);state=next;refresh();return true}
 catch(error){notify(error.message.includes('分頁')?error.message:'無法儲存，請確認瀏覽器允許儲存且有足夠空間。');return false}
}
function text(tag,content,className){const el=document.createElement(tag);el.textContent=content;if(className)el.className=className;return el}
function button(label,action,className){const el=text('button',label,className);el.type='button';el.addEventListener('click',action);return el}
function listRegions(){
 $('region-list').replaceChildren();
 for(const r of all[scope]||[]){const b=button(r.name,()=>selectRegion(r.id,true));const dot=text('span','','region-dot');dot.style.background=state.regions[r.id]?.color||'';b.prepend(dot);$('region-list').append(b)}
 $('region-total').textContent=all[scope]?.length||0;
}
function switchScope(next){
 scope=next;selected=null;$('search').value='';$('search-results').hidden=true;
 for(const s of ['world','taiwan']){$(`${s}-tab`).classList.toggle('active',s===scope);$(`${s}-tab`).setAttribute('aria-pressed',String(s===scope))}
 $('view-title').textContent=scope==='world'?'世界，留下你的記號。':'走進台灣的每個角落。';
 $('view-description').textContent=scope==='world'?'選一個地方，記下值得留下的事。':'22 個縣市，各有一段屬於你的故事。';
 $('search').placeholder=scope==='world'?'搜尋國家或地區…':'搜尋台灣縣市…';
 $('search').setAttribute('aria-label',scope==='world'?'搜尋國家或地區':'搜尋台灣縣市');
 $('list-title').textContent=scope==='world'?'探索世界':'台灣 22 縣市';
 $('map-count').textContent=scope==='world'?`${all.world.length} 個國家與地區`:'22 個縣市 · 含澎湖、金門、連江';
 map.setRegions(all[scope]);map.select(null);refresh();
}
function selectRegion(id,focus=false){
 const found=Object.values(all).flat().find(r=>r.id===id);if(!found)return;
 const showCounties=id==='world:TW';
 const nextScope=showCounties?'taiwan':found.scope;
 if(nextScope!==scope)switchScope(nextScope);
 selected=id;map.select(showCounties?null:id);
 if(showCounties)map.reset();else if(focus)map.focus(id);
 $('search-results').hidden=true;refresh();
 // Leave the county map visible on phones; Taiwan-wide notes remain in the panel.
 if(showCounties)$('panel').classList.remove('open');else showPanel();
}
function refresh(){
 map.setColors(state.regions);listRegions();
 const r=current();$('empty-panel').hidden=!!r;$('region-panel').hidden=!r;
 $('mobile-panel').firstChild.textContent=r?`${r.name} · 地方記事 `:'地區與記事 ';
 if(!r)return;
 const record=state.regions[r.id]||{color:null,events:[]};
 $('region-name').textContent=r.name;$('region-english').textContent=r.englishName;$('region-scope').textContent=r.id==='world:TW'?'台灣 / 整體記事':r.scope==='world'?'世界地圖 / 國家與地區':'台灣地圖 / 縣市';
 $('explore-taiwan').hidden=r.id!=='world:TW';
 document.querySelector('.color-section h3').textContent=r.id==='world:TW'?'世界地圖顏色':'地圖顏色';
 $('color-value').textContent=record.color?.toUpperCase()||'尚未上色';$('custom-color').value=record.color||'#176370';
 for(const b of $('swatches').children){const active=b.dataset.color===record.color;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))}
 $('event-count').textContent=record.events.length;$('events').replaceChildren();
 if(!record.events.length){const empty=text('div','','events-empty');empty.append(text('div','▤','empty-symbol'),text('strong','這裡還沒有記事'),text('p','從一件小事開始，留下第一個記憶。'));$('events').append(empty)}
 for(const event of record.events){const card=text('article','','event-card');card.append(text('time',event.date.replaceAll('-',' / '),'event-date'),text('h4',event.title));if(event.content)card.append(text('p',event.content));const actions=text('div','','event-actions');actions.append(button('編輯',()=>openEvent(event)),button('刪除',async()=>{if(await confirmAction('刪除這則記事？','刪除後無法復原。')){if(save(deleteEvent(state,r.id,event.id)))notify('記事已刪除')}}));card.append(actions);$('events').append(card)}
}
function openEvent(event=null){
 if(!current())return;editing=event;$('event-region').textContent=current().name;$('event-dialog-title').textContent=event?'編輯記事':'新增記事';
 const now=new Date();const today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
 $('event-date').value=event?.date||today;$('event-title').value=event?.title||'';$('event-content').value=event?.content||'';$('form-error').textContent='';$('event-dialog').showModal();setTimeout(()=>$('event-title').focus(),60);
}
function confirmAction(title,message){return new Promise(resolve=>{
 const dialog=$('confirm-dialog');$('confirm-title').textContent=title;$('confirm-message').textContent=message;
 let done=false;const finish=value=>{if(done)return;done=true;dialog.close();resolve(value)};
 $('confirm-no').onclick=()=>finish(false);$('confirm-yes').onclick=()=>finish(true);dialog.oncancel=e=>{e.preventDefault();finish(false)};dialog.showModal();$('confirm-no').focus();
})}
for(const color of palette){const b=button('',()=>{if(selected)save(setRegionColor(state,selected,color))},'swatch');b.style.background=color;b.dataset.color=color;b.setAttribute('aria-label',`上色 ${color}`);$('swatches').append(b)}
$('custom-color').addEventListener('change',e=>{if(selected)save(setRegionColor(state,selected,e.target.value))});
$('clear-color').onclick=()=>{if(selected)save(setRegionColor(state,selected,null))};
$('add-event').onclick=()=>openEvent();
$('event-form').onsubmit=e=>{
 e.preventDefault();const title=$('event-title').value.trim();if(!title){$('form-error').textContent='請填寫記事標題。';return}
 const event={id:editing?.id||crypto.randomUUID(),date:$('event-date').value,title,content:$('event-content').value,createdAt:editing?.createdAt||new Date().toISOString()};
 try{if(save(upsertEvent(state,selected,event))){$('event-dialog').close();notify('記事已儲存')}}catch{$('form-error').textContent='請檢查日期與內容是否正確。'}
};
$('world-tab').onclick=()=>switchScope('world');$('taiwan-tab').onclick=()=>switchScope('taiwan');$('explore-taiwan').onclick=()=>switchScope('taiwan');
$('zoom-in').onclick=()=>map.zoomBy(1.6);$('zoom-out').onclick=()=>map.zoomBy(1/1.6);$('reset-map').onclick=()=>map.reset();$('focus-region').onclick=()=>map.focus(selected);
$('mobile-panel').onclick=showPanel;$('close-panel').onclick=()=>$('panel').classList.remove('open');$('back-list').onclick=()=>{selected=null;map.select(null);refresh()};
function search(){const q=$('search').value.trim();$('search-results').replaceChildren();$('search-results').hidden=!q;if(!q)return;const matches=searchRegions(all[scope]||[],q).slice(0,30);if(!matches.length)$('search-results').append(text('p','找不到符合的地區'));for(const r of matches){const b=button(r.name,()=>{selectRegion(r.id,true);$('search').value=''});b.append(text('small',r.id.split(':')[1]));$('search-results').append(b)}}
$('search').addEventListener('input',search);$('search').addEventListener('focus',search);$('search').addEventListener('keydown',e=>{if(e.key==='Enter')$('search-results').querySelector('button')?.click();if(e.key==='Escape')$('search-results').hidden=true});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.search-box'))$('search-results').hidden=true});document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)&&!document.querySelector('dialog[open]')){e.preventDefault();$('search').focus()}});
for(const el of document.querySelectorAll('[data-close]'))el.onclick=()=>$(el.dataset.close).close();
$('backup-button').onclick=()=>{$('backup-error').textContent='';$('backup-dialog').showModal()};
$('export-data').onclick=()=>{
 let raw;try{raw=localStorage.getItem('world-notes:v1')||JSON.stringify(state,null,2)}catch{$('backup-error').textContent='瀏覽器目前不允許讀取資料，無法匯出。';return}
 const url=URL.createObjectURL(new Blob([raw||''],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`atlas-notes-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('備份已下載');
};
$('import-data').onclick=()=>$('import-file').click();
$('import-file').onchange=async e=>{
 const file=e.target.files[0];e.target.value='';if(!file)return;
 try{if(file.size>MAX_BACKUP_BYTES)throw Error('檔案超過 10 MB，請選擇較小的備份。');const next=validateState(JSON.parse(await file.text()),validIds);
 if(!await confirmAction('還原這份備份？','目前所有地區的記事與顏色將被取代，建議先匯出備份。'))return;
 persistState(localStorage,next,storageRaw);storageRaw=JSON.stringify(next);state=next;storageBlocked=false;$('storage-warning').hidden=true;refresh();$('backup-dialog').close();notify('備份已還原');
 }catch(error){$('backup-error').textContent=`無法匯入：${error.message}`}
};
$('share-button').onclick=async()=>{
 const url=location.origin+location.pathname;
 try{if(navigator.share&&matchMedia('(max-width:760px)').matches)await navigator.share({title:'地圖記事 · Atlas Notes',url});else{await navigator.clipboard.writeText(url);notify('網址已複製；對方會使用自己的獨立地圖。')}}catch(error){if(error.name!=='AbortError')notify('請複製瀏覽器網址分享給朋友。')}
};
async function start(){
 for(const id of ['world-tab','taiwan-tab','backup-button','share-button'])$(id).disabled=true;
 try{
  const [world,taiwan]=await Promise.all([loadRegions('world'),loadRegions('taiwan')]);all={world,taiwan};validIds=new Set([...world,...taiwan].map(r=>r.id));
  let loaded;try{storageRaw=localStorage.getItem('world-notes:v1');loaded=loadState({getItem:()=>storageRaw},validIds)}catch(error){loaded={state:emptyState(),error}}state=loaded.state;storageBlocked=!!loaded.error;
  if(storageBlocked){$('storage-warning').textContent='無法讀取原有資料。為避免覆蓋，已暫停修改；請從「備份資料」匯出原始內容或還原備份。';$('storage-warning').hidden=false}
  switchScope('world');$('loading').hidden=true;
  for(const id of ['world-tab','taiwan-tab','backup-button','share-button'])$(id).disabled=false;
  registerTools();
 }catch(error){$('loading').textContent=`${error.message} 請重新整理再試一次。`}
}
function registerTools(){
 const context=document.modelContext;if(!context?.registerTool)return;const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
 const definitions=[
 {name:'search_map_regions',description:'搜尋世界國家或台灣縣市，傳回可選地區識別碼。',inputSchema:{type:'object',properties:{query:{type:'string'}},required:['query'],additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute(input){if(typeof input?.query!=='string')throw Error('query 必須是文字');return searchRegions(Object.values(all).flat(),input.query).slice(0,30).map(({id,name})=>({id,name}))}},
 {name:'select_map_region',description:'在地圖選取並定位國家或縣市，開啟其記事面板。',inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!validIds.has(input?.id))throw Error('未知地區');selectRegion(input.id,true);return {selected:input.id}}}
 ];
 for(const tool of definitions){try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{})}catch{}}
}
start();
