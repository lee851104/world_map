import {loadRegions,searchRegions} from './regions.js';
import {emptyState,loadState,persistState,validateState,setRegionColor,upsertEvent,deleteEvent,MAX_BACKUP_BYTES,upsertSalesperson,deleteSalesperson,setRegionAssignees,regionColors,MAX_ASSIGNEES} from './store.js';
import {createMap} from './map.js';
import {MapDocuments,api,DOCUMENTS_KEY} from './documents.js';
import {exportKml} from './kml.js';
const $=id=>document.getElementById(id);
const palette=['#84b8a4','#83afcb','#ab9aca','#e5b976','#d98c88','#739eaa'];
let all={},scope='world',selected=null,state=emptyState(),validIds=new Set(),editing=null,storageBlocked=false,storageRaw=null,toastTimer;
let editingPerson=null;
let documents,adminIndex={countries:{}},scopeRequest=0;
const map=createMap($('map'),{onSelect:selectRegion});
function notify(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,3500)}
function setTools(open){
 $('panel').hidden=!open;
 document.querySelector('.workspace').classList.toggle('tools-open',open);
 $('tools-toggle').setAttribute('aria-expanded',String(open));
 if(!open&&$('panel').contains(document.activeElement))$('tools-toggle').focus();
}
function setSearch(open){
 $('search-box').hidden=!open;$('search-toggle').setAttribute('aria-expanded',String(open));
 if(open)$('search').focus();else{$('search-results').hidden=true;$('search').value='';if($('search-box').contains(document.activeElement))$('search-toggle').focus()}
}
function current(){return Object.values(all).flat().find(r=>r.id===selected)}
function save(next){
 if(storageBlocked){notify('目前資料讀取異常，請先用備份還原，以免覆蓋原紀錄。');return false}
 try{documents.stage(next);state=documents.active.state;refresh();return true}
 catch(error){notify(error.message||'無法儲存，請確認瀏覽器允許儲存且有足夠空間。');return false}
}
function text(tag,content,className){const el=document.createElement(tag);el.textContent=content;if(className)el.className=className;return el}
function button(label,action,className){const el=text('button',label,className);el.type='button';el.addEventListener('click',action);return el}
function listRegions(){
 $('region-list').replaceChildren();
 for(const r of all[scope]||[]){const b=button(r.name,()=>selectRegion(r.id,true));const dot=text('span','','region-dot');dot.style.background=colorBackground(regionColors(state,r.id));b.prepend(dot);$('region-list').append(b)}
 $('region-total').textContent=all[scope]?.length||0;
}
async function switchScope(next){
 const request=++scopeRequest;
 if(!all[next]){try{$('loading').textContent='正在載入行政區…';$('loading').hidden=false;const loaded=await loadRegions(next);all[next]=loaded;if(request!==scopeRequest)return false}catch(error){notify(error.message);if(request===scopeRequest)$('loading').hidden=true;return false}}
 if(request!==scopeRequest)return false;$('loading').hidden=true;
 scope=next;selected=null;$('search').value='';$('search-results').hidden=true;
 $('world-tab').classList.toggle('active',scope==='world');$('world-tab').setAttribute('aria-pressed',String(scope==='world'));$('taiwan-tab').classList.toggle('active',scope!=='world');$('taiwan-tab').setAttribute('aria-pressed',String(scope!=='world'));$('taiwan-tab').textContent=scope.startsWith('adm1:')?scopeCountryName(scope):'台灣';
 $('search').placeholder=scope==='world'?'搜尋國家或地區…':'搜尋行政區…';
 $('search').setAttribute('aria-label',scope==='world'?'搜尋國家或地區':'搜尋行政區');
 $('list-title').textContent=scope==='world'?'選擇國家或地區':'選擇行政區';
 map.setRegions(all[scope]);map.select(null);refresh();
 return true;
}
function scopeCountryName(value){return all.world?.find(r=>r.iso3===value.slice(5))?.name||value.slice(5)}
function subdivisionScope(r){return r?.id==='world:TW'?'taiwan':r?.scope==='world'&&adminIndex.countries[r.iso3]?`adm1:${r.iso3}`:null}
async function selectRegion(id,focus=false){
 const found=Object.values(all).flat().find(r=>r.id===id);if(!found)return;
 const nextScope=found.scope;
 if(nextScope!==scope&&!await switchScope(nextScope))return;
 selected=id;map.select(id);
 if(focus)map.focus(id);
 setSearch(false);refresh();
}
function refresh(){
 map.setColors(Object.fromEntries(Object.keys(state.regions).map(id=>[id,{colors:regionColors(state,id)}])));listRegions();
 const r=current();$('empty-panel').hidden=!!r;$('region-panel').hidden=!r;
 const names=(state.regions[selected]?.assignees||[]).map(id=>state.salespeople.find(p=>p.id===id)?.name).filter(Boolean);
 $('selection-label').textContent=r?[r.name,...names].join(' · '):'';$('selection-label').hidden=!r;
 const childScope=subdivisionScope(r);$('enter-taiwan').hidden=!childScope;$('enter-taiwan').textContent=childScope==='taiwan'?'查看 22 縣市':'查看行政區';
 if(!r)return;
 const record=state.regions[r.id]||{color:null,events:[]};
 $('region-name').textContent=r.name;$('region-english').textContent=r.englishName;$('region-scope').textContent=r.scope==='world'?'世界地圖 / 國家與地區':r.scope==='taiwan'?'台灣 / 縣市':`${scopeCountryName(r.scope)} / 一級行政區`;
 $('explore-taiwan').hidden=r.scope!=='world';$('explore-taiwan').disabled=!childScope;$('explore-taiwan').textContent=childScope==='taiwan'?'查看 22 縣市':childScope?'查看一級行政區':'暫無可用行政區圖資';
 document.querySelector('.color-section h3').textContent=r.id==='world:TW'?'世界地圖顏色':'地圖顏色';
 $('color-value').textContent=record.assignees?.length?'業務配色':record.color?.toUpperCase()||'尚未上色';$('custom-color').value=record.color||'#176370';
 for(const b of $('swatches').children){const active=!record.assignees?.length&&b.dataset.color===record.color;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))}
 const focusedPerson=$('assignees').contains(document.activeElement)?document.activeElement.dataset.person:null;
 $('assignees').replaceChildren();
 const assigned=record.assignees||[];
 $('assignee-count').textContent=`${assigned.length} / ${MAX_ASSIGNEES}`;
 for(const person of state.salespeople){
  const label=text('label','','assignee-option');const input=document.createElement('input');input.type='checkbox';input.dataset.person=person.id;input.checked=assigned.includes(person.id);input.disabled=!input.checked&&assigned.length>=MAX_ASSIGNEES;
  input.onchange=()=>{const next=input.checked?[...assigned,person.id]:assigned.filter(id=>id!==person.id);try{if(!save(setRegionAssignees(state,r.id,next)))refresh()}catch(error){notify(error.message);refresh()}};
  const swatch=text('span','','person-swatch');swatch.style.background=person.color;label.append(input,swatch,text('span',person.name));$('assignees').append(label);
 }
 if(!state.salespeople.length)$('assignees').append(text('p','先新增業務，再勾選負責人。','events-empty'));
 if(focusedPerson){const restored=[...$('assignees').querySelectorAll('input')].find(input=>input.dataset.person===focusedPerson);restored?.focus()}
 $('event-count').textContent=record.events.length;$('events').replaceChildren();
 if(!record.events.length)$('events').append(text('p','尚無記事','events-empty'));
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
$('world-tab').onclick=()=>switchScope('world');$('taiwan-tab').onclick=()=>switchScope(scope.startsWith('adm1:')?scope:'taiwan');$('explore-taiwan').onclick=()=>{const next=subdivisionScope(current());if(next)switchScope(next)};$('enter-taiwan').onclick=$('explore-taiwan').onclick;
$('zoom-in').onclick=()=>map.zoomBy(1.6);$('zoom-out').onclick=()=>map.zoomBy(1/1.6);$('reset-map').onclick=()=>map.reset();$('focus-region').onclick=()=>map.focus(selected);
$('tools-toggle').onclick=()=>setTools($('panel').hidden);$('close-panel').onclick=()=>setTools(false);$('back-list').onclick=()=>{selected=null;map.select(null);refresh()};
$('search-toggle').onclick=()=>setSearch($('search-box').hidden);$('close-search').onclick=()=>setSearch(false);
function search(){const q=$('search').value.trim();$('search-results').replaceChildren();$('search-results').hidden=!q;if(!q)return;const matches=searchRegions(all[scope]||[],q).slice(0,30);if(!matches.length)$('search-results').append(text('p','找不到符合的地區'));for(const r of matches){const b=button(r.name,()=>{selectRegion(r.id,true);$('search').value=''});b.append(text('small',r.id.split(':')[1]));$('search-results').append(b)}}
$('search').addEventListener('input',search);$('search').addEventListener('focus',search);$('search').addEventListener('keydown',e=>{if(e.key==='Enter')$('search-results').querySelector('button')?.click();if(e.key==='Escape'){e.stopPropagation();setSearch(false)}});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.search-box'))$('search-results').hidden=true;if(!e.target.closest('.more-menu'))$('more-menu').open=false});document.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]'))return;if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();setSearch(true)}if(e.key==='Escape'){setSearch(false);setTools(false);$('more-menu').open=false}});
for(const el of document.querySelectorAll('[data-close]'))el.onclick=()=>$(el.dataset.close).close();
function colorBackground(colors){return colors.length>1?`repeating-linear-gradient(125deg,${colors.map((color,i)=>`${color} ${i*5}px ${(i+1)*5}px`).join(',')})`:colors[0]||''}
function resetPerson(){editingPerson=null;$('person-name').value='';$('person-color').value=['#db5353','#327fd1','#2d9b73','#915fc1'][state.salespeople.length%4];$('person-save').textContent='新增';$('person-cancel').hidden=true;$('people-error').textContent=''}
function renderPeople(){
 $('people-list').replaceChildren();
 for(const person of state.salespeople){const row=text('div','','person-row');const swatch=text('span','','person-swatch');swatch.style.background=person.color;const name=text('span',person.name,'person-name');row.append(swatch,name,button('編輯',()=>{editingPerson=person.id;$('person-name').value=person.name;$('person-color').value=person.color;$('person-save').textContent='儲存';$('person-cancel').hidden=false;$('person-name').focus()}),button('刪除',async()=>{if(await confirmAction(`刪除 ${person.name}？`,'所有地區將移除此人的指派，記事保留。')&&save(deleteSalesperson(state,person.id))){renderPeople();resetPerson()}}));$('people-list').append(row)}
}
function openPeople(){$('more-menu').open=false;renderPeople();resetPerson();$('people-dialog').showModal()}
$('manage-people').onclick=openPeople;$('people-button').onclick=openPeople;$('person-cancel').onclick=resetPerson;
$('person-form').onsubmit=e=>{e.preventDefault();const name=$('person-name').value.trim();if(!name){$('people-error').textContent='請填寫姓名。';return}try{if(save(upsertSalesperson(state,{id:editingPerson||crypto.randomUUID(),name,color:$('person-color').value}))){renderPeople();resetPerson()}}catch{$('people-error').textContent='請檢查姓名與顏色。'}};
$('backup-button').onclick=()=>{$('more-menu').open=false;$('backup-error').textContent='';$('backup-dialog').showModal()};
function downloadFile(name,content,type='application/json'){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name.replace(/[\\/:*?"<>|]/g,'-');a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('export-data').onclick=()=>{try{const raw=storageBlocked?(localStorage.getItem(DOCUMENTS_KEY)||localStorage.getItem('world-notes:v1')):JSON.stringify({format:'atlas-map',name:documents.active.name,state},null,2);downloadFile(`${documents?.active.name||'atlas'}-backup.json`,raw||'');notify('備份已下載')}catch{$('backup-error').textContent='無法匯出備份。'}};
$('import-data').onclick=()=>$('import-file').click();
$('import-file').onchange=async e=>{
 const file=e.target.files[0];e.target.value='';if(!file)return;
 try{if(file.size>MAX_BACKUP_BYTES)throw Error('檔案超過 10 MB，請選擇較小的備份。');const input=JSON.parse(await file.text());const next=validateState(input.format==='atlas-map'?input.state:input,validIds);
 if(storageBlocked){
  if(documents?.user)throw Error('雲端連線尚未恢復，請重新整理後再匯入。');
  if(!await confirmAction('以備份恢復本機地圖？','將取代無法讀取的本機地圖清單；請先匯出原始備份。'))return;
  const restored={id:crypto.randomUUID(),name:'還原的地圖',state:next,updatedAt:new Date().toISOString()};localStorage.setItem(DOCUMENTS_KEY,JSON.stringify({version:2,activeId:restored.id,documents:[restored]}));documents=new MapDocuments(validIds,syncStatus);storageBlocked=false;$('storage-warning').hidden=true;activateDocument();syncStatus('僅此裝置');$('backup-dialog').close();notify('本機地圖已還原');return;
 }
 await documents.create(typeof input.name==='string'?input.name.slice(0,80):'匯入的地圖',next);activateDocument();$('backup-dialog').close();notify('已匯入為新的地圖');
 }catch(error){$('backup-error').textContent=`無法匯入：${error.message}`}
};
$('share-button').onclick=async()=>{
 $('more-menu').open=false;
 const url=location.origin+location.pathname;
 try{if(navigator.share&&matchMedia('(max-width:760px)').matches)await navigator.share({title:'地圖記事 · Atlas Notes',url});else{await navigator.clipboard.writeText(url);notify('網址已複製；對方會使用自己的獨立地圖。')}}catch(error){if(error.name!=='AbortError')notify('請複製瀏覽器網址分享給朋友。')}
};
async function start(){
 for(const id of ['world-tab','taiwan-tab','backup-button','share-button','tools-toggle','search-toggle'])$(id).disabled=true;
 try{
  const [world,taiwan,catalog]=await Promise.all([loadRegions('world'),loadRegions('taiwan'),fetch('./data/adm1-index.json').then(r=>{if(!r.ok)throw Error('行政區目錄載入失敗。');return r.json()})]);all={world,taiwan};adminIndex=catalog;validIds=new Set([...world,...taiwan].map(r=>r.id));for(const [iso,entry]of Object.entries(catalog.countries))for(const id of entry.ids)validIds.add(`adm1:${iso}-${id}`);
  try{documents=new MapDocuments(validIds,syncStatus);state=documents.active.state;await documents.connect();state=documents.active.state;activateDocument()}catch(error){storageBlocked=true;$('storage-warning').textContent=error.message;$('storage-warning').hidden=false}
  if(storageBlocked){$('storage-warning').textContent+=' 已暫停修改；可先匯出備份，再重新整理重試。';$('storage-warning').hidden=false}
  switchScope('world');$('loading').hidden=true;
  for(const id of ['world-tab','taiwan-tab','backup-button','share-button','tools-toggle','search-toggle'])$(id).disabled=false;
  registerTools();
 }catch(error){$('loading').textContent=`${error.message} 請重新整理再試一次。`}
}
function registerTools(){
 const context=document.modelContext;if(!context?.registerTool)return;const lifecycle=new AbortController();window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
 const definitions=[
 {name:'search_map_regions',description:'搜尋世界國家或台灣縣市，傳回可選地區識別碼。',inputSchema:{type:'object',properties:{query:{type:'string'}},required:['query'],additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:false},execute(input){if(typeof input?.query!=='string')throw Error('query 必須是文字');return searchRegions(Object.values(all).flat(),input.query).slice(0,30).map(({id,name})=>({id,name}))}},
 {name:'select_map_region',description:'在地圖選取並定位國家或縣市，不自動開啟工具面板。',inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){if(!validIds.has(input?.id))throw Error('未知地區');selectRegion(input.id,true);return {selected:input.id}}}
 ];
 for(const tool of definitions){try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{})}catch{}}
}
function syncStatus(label,error=null){$('sync-state').textContent=label;$('sync-error').hidden=!error;$('sync-error-message').textContent=error?.message||''}
function activateDocument(){state=documents.active.state;$('document-title').textContent=documents.active.name;$('account-button').textContent=documents.user?'帳號':'登入';selected=null;map.select(null);refresh()}
function renderDocuments(){
 $('documents-list').replaceChildren();for(const item of documents.maps){const b=button(item.name,async()=>{try{await documents.select(item.id);activateDocument();$('documents-dialog').close()}catch(e){$('documents-error').textContent=e.message}},'document-item');b.setAttribute('aria-pressed',String(item.id===documents.active.id));$('documents-list').append(b)}
 $('document-name').value=documents.active.name;$('documents-error').textContent='';$('copy-local').hidden=!documents.user;$('delete-document').disabled=documents.maps.length<2;
}
$('documents-button').onclick=()=>{if(!documents)return;renderDocuments();$('documents-dialog').showModal()};
$('new-document').onclick=async()=>{try{await documents.create($('new-document-name').value.trim()||'未命名地圖');$('new-document-name').value='';activateDocument();renderDocuments()}catch(e){$('documents-error').textContent=e.message}};
$('rename-document').onclick=async()=>{try{await documents.rename($('document-name').value);activateDocument();renderDocuments()}catch(e){$('documents-error').textContent=e.message}};
$('duplicate-document').onclick=async()=>{try{await documents.create(`${documents.active.name.slice(0,75)} 副本`,state);activateDocument();renderDocuments()}catch(e){$('documents-error').textContent=e.message}};
$('delete-document').onclick=async()=>{if(!await confirmAction('刪除這份地圖？','這份地圖的所有顏色與記事將被刪除，建議先匯出備份。'))return;try{await documents.remove();activateDocument();renderDocuments()}catch(e){$('documents-error').textContent=e.message}};
$('copy-local').onclick=async()=>{if(!await confirmAction('將此裝置地圖複製到雲端？',`將新增 ${documents.local.documents.length} 份地圖，不會取代現有雲端地圖。`))return;try{for(const local of documents.local.documents)await documents.create(local.name,local.state);activateDocument();renderDocuments();notify('已複製到雲端')}catch(e){$('documents-error').textContent=e.message}};
$('retry-sync').onclick=async()=>{try{await documents.retry()}catch(e){notify(e.message)}};
$('reload-cloud').onclick=async()=>{if(!await confirmAction('載入雲端版本？','目前尚未同步的修改將被取代，請先下載備份。'))return;try{await documents.reloadCloud();activateDocument()}catch(e){notify(e.message)}};
$('download-unsaved').onclick=()=>$('export-data').click();
$('export-kml').onclick=async()=>{
 const control=$('export-kml');control.disabled=true;$('backup-error').textContent='';$('kml-downloads').replaceChildren();
 try{const scopes=[...new Set(Object.keys(state.regions).filter(id=>id.startsWith('adm1:')).map(id=>`adm1:${id.slice(5,8)}`))];for(const value of scopes)if(!all[value])all[value]=await loadRegions(value);
  const parts=exportKml(documents.active.name,Object.values(all).flat(),state);if(!parts.length)throw Error('目前沒有上色、記事或人員標示可匯出。');
  if(parts.length===1)downloadFile(parts[0].name,parts[0].content,'application/vnd.google-earth.kml+xml');else for(const part of parts)$('kml-downloads').append(button(`下載 ${part.name}`,()=>downloadFile(part.name,part.content,'application/vnd.google-earth.kml+xml'),'backup-action'));
  notify(parts.length===1?'KML 已匯出':`已分成 ${parts.length} 份，請逐一下載`);
 }catch(e){$('backup-error').textContent=e.message}finally{control.disabled=false}
};
$('account-button').onclick=async()=>{
 if(!documents)return;$('account-error').textContent='';$('google-button').replaceChildren();$('account-dialog').showModal();$('account-email').textContent=documents.user?.email||'使用 Google 登入後，可在不同裝置使用同一份地圖。';$('sign-out').hidden=!documents.user;
 if(documents.user)return;
 try{const config=await api('/api/auth/config');if(!config.configured)throw Error('Google 登入尚待網站管理者完成設定。目前地圖仍保存在此裝置。');
  if(!window.google?.accounts?.id)await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.onload=resolve;script.onerror=()=>reject(Error('無法載入 Google 登入，請檢查網路。'));document.head.append(script)});
  window.google.accounts.id.initialize({client_id:config.clientId,nonce:config.nonce,callback:async response=>{try{await documents.flush();await api('/api/auth/google',{method:'POST',body:JSON.stringify({credential:response.credential})});location.reload()}catch(e){$('account-error').textContent=e.message}}});window.google.accounts.id.renderButton($('google-button'),{theme:'outline',size:'large',text:'signin_with',locale:'zh_TW'});
 }catch(e){$('account-error').textContent=e.message}
};
$('sign-out').onclick=async()=>{try{await documents.flush();await api('/api/auth/logout',{method:'POST',body:'{}'});location.reload()}catch(e){$('account-error').textContent=e.message}};
window.addEventListener('beforeunload',event=>{if(documents?.dirty){event.preventDefault();event.returnValue=''}});
start();
