import {emptyState,validateState,STORAGE_KEY} from './store.js';
export const DOCUMENTS_KEY='atlas:documents:v2';
const makeDocument=(name,state=emptyState())=>({id:crypto.randomUUID(),name,state,updatedAt:new Date().toISOString()});
export function validateDocuments(value,validIds){
 if(value?.version!==2||!Array.isArray(value.documents)||!value.documents.length)throw Error('地圖檔案格式不正確。');
 const seen=new Set();const documents=value.documents.map(d=>{if(typeof d.id!=='string'||!/^[A-Za-z0-9-]{1,100}$/.test(d.id)||seen.has(d.id)||typeof d.name!=='string'||!d.name.trim()||d.name.length>80)throw Error('地圖檔案格式不正確。');seen.add(d.id);return {...d,state:validateState(d.state,validIds)}});
 return {version:2,documents,activeId:seen.has(value.activeId)?value.activeId:documents[0].id};
}
export function loadLocalDocuments(storage,validIds){
 const raw=storage.getItem(DOCUMENTS_KEY);
 if(raw)return validateDocuments(JSON.parse(raw),validIds);
 const legacy=storage.getItem(STORAGE_KEY);const doc=makeDocument(legacy?'原有地圖':'我的地圖',legacy?validateState(JSON.parse(legacy),validIds):emptyState());
 return {version:2,documents:[doc],activeId:doc.id};
}
export async function api(path,options={}){
 const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,headers:{'Content-Type':'application/json',...options.headers}});
 let data;try{data=await response.json()}catch{throw Error('雲端連線失敗，請稍後重試。')}
 if(!response.ok)throw Object.assign(Error(data.error||'無法完成雲端操作。'),{status:response.status});return data;
}
export class MapDocuments{
 constructor(validIds,onStatus){this.validIds=validIds;this.onStatus=onStatus;this.user=null;this.dirty=false;this.saving=null;this.error=null;this.timer=null;this.local=loadLocalDocuments(localStorage,validIds);this.raw=localStorage.getItem(DOCUMENTS_KEY);this.active=this.local.documents.find(d=>d.id===this.local.activeId);this.maps=this.local.documents;}
 async connect(){const {user}=await api('/api/me');if(!user){this.onStatus('僅此裝置');return}this.user=user;await this.loadCloud();}
 async loadCloud(){this.maps=(await api('/api/maps')).maps;if(!this.maps.length){const doc=await api('/api/maps',{method:'POST',body:JSON.stringify({name:'我的地圖',state:emptyState()})});this.maps=[doc]}await this.select(this.maps[0].id);}
 persistLocal(){if(localStorage.getItem(DOCUMENTS_KEY)!==this.raw)throw Error('另一個分頁已修改地圖，請重新整理後再操作。');const value=JSON.stringify(this.local);localStorage.setItem(DOCUMENTS_KEY,value);this.raw=value;}
 stage(state){
  if(this.transitioning)throw Error('正在切換或更新地圖，請稍候再修改。');
  const checked=validateState(state,this.validIds);const next={...this.active,state:checked,updatedAt:new Date().toISOString()};
  if(!this.user){const previous=this.local;this.local={...this.local,documents:this.local.documents.map(d=>d.id===next.id?next:d)};try{this.persistLocal()}catch(e){this.local=previous;throw e}this.active=next;this.maps=this.local.documents;this.onStatus('已儲存在此裝置');return}
  this.active=next;this.dirty=true;this.onStatus(this.error?'尚未同步':'儲存中…',this.error);clearTimeout(this.timer);this.timer=setTimeout(()=>this.flush().catch(()=>{}),450);
 }
 async flush(){
  clearTimeout(this.timer);if(this.saving){await this.saving;return this.flush()}if(!this.user||!this.dirty)return;
  if(this.error)throw this.error;
  const snapshot=this.active;
  this.saving=api(`/api/maps/${snapshot.id}`,{method:'PUT',body:JSON.stringify({name:snapshot.name,state:snapshot.state,revision:snapshot.revision})}).then(result=>{
   this.active={...this.active,revision:result.revision};this.dirty=this.active.state!==snapshot.state||this.active.name!==snapshot.name;this.maps=this.maps.map(d=>d.id===result.id?{...d,name:result.name,revision:result.revision,updatedAt:result.updatedAt}:d);this.onStatus(this.dirty?'儲存中…':'已同步');
  }).catch(error=>{this.error=error;this.onStatus('尚未同步',error);throw error}).finally(()=>this.saving=null);
  await this.saving;if(this.dirty)await this.flush();
 }
 async retry(){this.error=null;await this.flush()}
 async transition(operation,discard=false){if(this.transitioning)throw Error('地圖處理中，請稍候。');this.transitioning=true;try{if(discard){clearTimeout(this.timer);if(this.saving)await this.saving.catch(()=>{})}else await this.flush();return await operation()}finally{this.transitioning=false}}
 async select(id){return this.transition(async()=>{if(this.user){const next=await api(`/api/maps/${id}`);next.state=validateState(next.state,this.validIds);this.active=next;this.onStatus('已同步')}else{const next=this.local.documents.find(d=>d.id===id);if(!next)throw Error('找不到地圖。');const previous=this.local;this.local={...this.local,activeId:id};try{this.persistLocal()}catch(e){this.local=previous;throw e}this.active=next;this.onStatus('僅此裝置')}})}
 async create(name,state=emptyState()){
  return this.transition(async()=>{if(!name.trim()||name.length>80)throw Error('地圖名稱需為 1～80 個字。');
  if(this.user){const doc=await api('/api/maps',{method:'POST',body:JSON.stringify({name:name.trim(),state})});this.maps.unshift(doc);this.active=doc;this.onStatus('已同步')}else{const previous=this.local;const doc=makeDocument(name.trim(),validateState(state,this.validIds));this.local={...this.local,activeId:doc.id,documents:[doc,...this.local.documents]};try{this.persistLocal()}catch(e){this.local=previous;throw e}this.active=doc;this.maps=this.local.documents;this.onStatus('僅此裝置')}});
 }
 async rename(name){return this.transition(async()=>{if(!name.trim()||name.length>80)throw Error('地圖名稱需為 1～80 個字。');const next={...this.active,name:name.trim()};if(this.user){this.active=await api(`/api/maps/${next.id}`,{method:'PUT',body:JSON.stringify({name:next.name,state:next.state,revision:next.revision})});this.maps=this.maps.map(d=>d.id===next.id?this.active:d);this.onStatus('已同步')}else{const previous=this.local;this.local={...this.local,documents:this.local.documents.map(d=>d.id===next.id?next:d)};try{this.persistLocal()}catch(e){this.local=previous;throw e}this.active=next;this.maps=this.local.documents}})}
 async remove(){return this.transition(async()=>{const id=this.active.id;if(this.maps.length<2)throw Error('請保留至少一份地圖。');if(this.user){const next=await api(`/api/maps/${this.maps.find(d=>d.id!==id).id}`);next.state=validateState(next.state,this.validIds);await api(`/api/maps/${id}`,{method:'DELETE',body:JSON.stringify({revision:this.active.revision})});this.maps=this.maps.filter(d=>d.id!==id);this.active=next;this.onStatus('已同步')}else{const previous=this.local;const docs=this.local.documents.filter(d=>d.id!==id);this.local={version:2,documents:docs,activeId:docs[0].id};try{this.persistLocal()}catch(e){this.local=previous;throw e}this.maps=docs;this.active=docs[0]}})}
 async reloadCloud(){return this.transition(async()=>{const latest=await api(`/api/maps/${this.active.id}`);latest.state=validateState(latest.state,this.validIds);this.active=latest;this.dirty=false;this.error=null;this.onStatus('已同步')},true)}
}
