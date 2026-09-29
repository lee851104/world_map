export const STORAGE_KEY='world-notes:v1';
export const MAX_BACKUP_BYTES=10*1024*1024;
export const MAX_ASSIGNEES=4;
export const emptyState=()=>({version:1,regions:{},salespeople:[]});
const record=()=>({color:null,events:[],assignees:[]});
const fail=()=>{throw Error('備份格式不正確，原本的資料沒有變更。')};
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&[Object.prototype,null].includes(Object.getPrototypeOf(x));
const validColor=x=>typeof x==='string'&&/^#[0-9a-f]{6}$/i.test(x);
function checkPerson(p){
 if(!plain(p)||typeof p.id!=='string'||! /^[A-Za-z0-9-]{1,100}$/.test(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>40||!validColor(p.color))fail();
 return {id:p.id,name:p.name.trim(),color:p.color};
}
function checkAssignees(value,people){
 if(!Array.isArray(value)||value.length>MAX_ASSIGNEES||new Set(value).size!==value.length||value.some(id=>!people.some(p=>p.id===id)))fail();
 return [...value];
}
function checkEvent(e){
 if(!plain(e)||typeof e.id!=='string'||!e.id||e.id.length>100||typeof e.title!=='string'||!e.title.trim()||e.title.length>160||typeof e.content!=='string'||e.content.length>10000)fail();
 if(typeof e.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(e.date)||!Number.isFinite(Date.parse(e.date))||new Date(e.date).toISOString().slice(0,10)!==e.date)fail();
 if(typeof e.createdAt!=='string'||!Number.isFinite(Date.parse(e.createdAt)))fail();
 return {id:e.id,date:e.date,title:e.title,content:e.content,createdAt:e.createdAt};
}
export function validateState(input,validIds){
 if(!plain(input)||input.version!==1||!plain(input.regions))fail();
 const result=emptyState(),seen=new Set();
 if(input.salespeople!==undefined&&!Array.isArray(input.salespeople))fail();
 result.salespeople=(input.salespeople||[]).map(checkPerson);
 if(new Set(result.salespeople.map(p=>p.id)).size!==result.salespeople.length)fail();
 for(const [id,r] of Object.entries(input.regions)){
  if(!validIds.has(id)||!plain(r)||!(r.color===null||typeof r.color==='string'&&/^#[0-9a-f]{6}$/i.test(r.color))||!Array.isArray(r.events))fail();
  const events=r.events.map(e=>{const event=checkEvent(e);if(seen.has(event.id))fail();seen.add(event.id);return event;});
  result.regions[id]={color:r.color,events:events.sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)),assignees:checkAssignees(r.assignees===undefined?[]:r.assignees,result.salespeople)};
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
export function setRegionColor(state,id,color){if(color!==null&&!validColor(color))fail();return update(state,id,r=>({...r,color,assignees:[]}));}
export function upsertSalesperson(state,person){const checked=checkPerson(person);const people=state.salespeople||[];return {...state,salespeople:people.some(p=>p.id===checked.id)?people.map(p=>p.id===checked.id?checked:p):[...people,checked]};}
export function deleteSalesperson(state,id){return {...state,salespeople:(state.salespeople||[]).filter(p=>p.id!==id),regions:Object.fromEntries(Object.entries(state.regions).map(([key,r])=>[key,{...r,assignees:(r.assignees||[]).filter(value=>value!==id)}]))};}
export function setRegionAssignees(state,id,assignees){if(assignees.length>MAX_ASSIGNEES)throw Error('每個地區最多選擇 4 位業務。');const checked=checkAssignees(assignees,state.salespeople||[]);return update(state,id,r=>({...r,assignees:checked}));}
export function regionColors(state,id){const r=state.regions[id];const colors=(r?.assignees||[]).map(personId=>(state.salespeople||[]).find(p=>p.id===personId)?.color).filter(Boolean);return colors.length?colors:r?.color?[r.color]:[];}
export function upsertEvent(state,id,event){const checked=checkEvent(event);return update(state,id,r=>({...r,events:[...r.events.filter(e=>e.id!==checked.id),checked].sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt))}));}
export function deleteEvent(state,id,eventId){return update(state,id,r=>({...r,events:r.events.filter(e=>e.id!==eventId)}));}
