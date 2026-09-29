export const STORAGE_KEY='world-notes:v1';
export const MAX_BACKUP_BYTES=10*1024*1024;
export const emptyState=()=>({version:1,regions:{}});
const record=()=>({color:null,events:[]});
const fail=()=>{throw Error('備份格式不正確，原本的資料沒有變更。')};
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&[Object.prototype,null].includes(Object.getPrototypeOf(x));
function checkEvent(e){
 if(!plain(e)||typeof e.id!=='string'||!e.id||e.id.length>100||typeof e.title!=='string'||!e.title.trim()||e.title.length>160||typeof e.content!=='string'||e.content.length>10000)fail();
 if(typeof e.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||!Number.isFinite(Date.parse(e.date))||new Date(e.date).toISOString().slice(0,10)!==e.date)fail();
 if(typeof e.createdAt!=='string'||!Number.isFinite(Date.parse(e.createdAt)))fail();
 return {id:e.id,date:e.date,title:e.title,content:e.content,createdAt:e.createdAt};
}
export function validateState(input,validIds){
 if(!plain(input)||input.version!==1||!plain(input.regions))fail();
 const result=emptyState(),seen=new Set();
 for(const [id,r] of Object.entries(input.regions)){
  if(!validIds.has(id)||!plain(r)||!(r.color===null||typeof r.color==='string'&&/^#[0-9a-f]{6}$/i.test(r.color))||!Array.isArray(r.events))fail();
  const events=r.events.map(e=>{const event=checkEvent(e);if(seen.has(event.id))fail();seen.add(event.id);return event;});
  result.regions[id]={color:r.color,events:events.sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt))};
 }
 return result;
}
export function loadState(storage,validIds){
 try{const raw=storage.getItem(STORAGE_KEY);return {state:raw?validateState(JSON.parse(raw),validIds):emptyState(),error:null};}
 catch(error){return {state:emptyState(),error};}
}
export function persistState(storage,state,expectedRaw){
 if(expectedRaw!==undefined&&storage.getItem(STORAGE_KEY)!==expectedRaw)throw Error('另一個分頁已修改紀錄，請重新整理後再操作。');
 storage.setItem(STORAGE_KEY,JSON.stringify(state));
}
function update(state,id,fn){if(!/^(world|taiwan):[A-Za-z0-9-]+$/.test(id))fail();return {...state,regions:{...state.regions,[id]:fn(state.regions[id]||record())}};}
export function setRegionColor(state,id,color){if(color!==null&&!/^#[0-9a-f]{6}$/i.test(color))fail();return update(state,id,r=>({...r,color}));}
export function upsertEvent(state,id,event){const checked=checkEvent(event);return update(state,id,r=>({...r,events:[...r.events.filter(e=>e.id!==checked.id),checked].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt))}));}
export function deleteEvent(state,id,eventId){return update(state,id,r=>({...r,events:r.events.filter(e=>e.id!==eventId)}));}
