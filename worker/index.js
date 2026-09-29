import {validateState,emptyState} from '../dist/store.js';
import ids from './valid-region-ids.json' with {type:'json'};
import {SESSION_COOKIE,NONCE_COOKIE,randomToken,hashToken,cookie,setCookie,verifyGoogleToken,sessionUser} from './auth.js';
const validIds=new Set(ids);
const MAX_BODY=1_500_000;
const json=(value,status=200,headers={})=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
function fail(status,message){throw Object.assign(Error(message),{status})}
async function body(request){
 const reader=request.body?.getReader();if(!reader)fail(400,'缺少資料。');let size=0;const chunks=[];
 while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>MAX_BODY){await reader.cancel();fail(413,'這份地圖超過雲端單份 1.5 MB 上限，請拆成多份地圖。')}chunks.push(value)}
 const all=new Uint8Array(size);let offset=0;for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.length}try{return JSON.parse(new TextDecoder().decode(all))}catch{fail(400,'資料格式不正確。')}
}
function name(value){if(typeof value!=='string'||!value.trim()||value.length>80)fail(400,'地圖名稱需為 1～80 個字。');return value.trim()}
function checkedState(value){try{return validateState(value,validIds)}catch{fail(400,'地圖資料格式不正確。')}}
function document(row){return {id:row.id,name:row.name,state:JSON.parse(row.payload),revision:row.revision,updatedAt:row.updated_at}}
export async function handleApi(request,env){
 const url=new URL(request.url),path=url.pathname;
 try{
  if(!['GET','HEAD'].includes(request.method)&&request.headers.get('origin')!==url.origin)fail(403,'請從本站操作。');
  if(path==='/api/auth/config'&&request.method==='GET'){
   const configured=!!env.GOOGLE_CLIENT_ID;
   const nonce=randomToken();return json({configured,clientId:env.GOOGLE_CLIENT_ID||null,nonce:configured?nonce:null},200,configured?{'Set-Cookie':setCookie(NONCE_COOKIE,nonce,600)}:{});
  }
  if(path==='/api/auth/google'&&request.method==='POST'){
   if(!env.GOOGLE_CLIENT_ID)fail(503,'Google 登入尚未設定完成。');
   const input=await body(request);let user;
   try{user=await verifyGoogleToken(input.credential,env.GOOGLE_CLIENT_ID,cookie(request,NONCE_COOKIE))}catch{fail(401,'Google 登入驗證失敗，請重新開啟登入。')}
   const token=randomToken(),expires=Date.now()+30*86400000;
   await env.DB.batch([env.DB.prepare('DELETE FROM atlas_sessions WHERE expires < ?').bind(Date.now()),env.DB.prepare('INSERT INTO atlas_sessions (hash, owner, email, name, expires) VALUES (?, ?, ?, ?, ?)').bind(await hashToken(token),user.owner,user.email,user.name,expires)]);
   const response=json({user:{id:user.owner,email:user.email,name:user.name}});response.headers.append('Set-Cookie',setCookie(SESSION_COOKIE,token,30*86400));response.headers.append('Set-Cookie',setCookie(NONCE_COOKIE,'',0));return response;
  }
  if(path==='/api/auth/logout'&&request.method==='POST'){
   const token=cookie(request,SESSION_COOKIE);if(token)await env.DB.prepare('DELETE FROM atlas_sessions WHERE hash = ?').bind(await hashToken(token)).run();return json({ok:true},200,{'Set-Cookie':setCookie(SESSION_COOKIE,'',0)});
  }
  const user=await sessionUser(request,env.DB);
  if(path==='/api/me'&&request.method==='GET')return json({user:user?{id:user.owner,email:user.email,name:user.name}:null});
  if(!user)fail(401,'請先使用 Google 登入。');
  if(path==='/api/maps'&&request.method==='GET')return json({maps:(await env.DB.prepare('SELECT id, name, revision, updated_at FROM atlas_maps WHERE owner = ? ORDER BY updated_at DESC').bind(user.owner).all()).results.map(r=>({id:r.id,name:r.name,revision:r.revision,updatedAt:r.updated_at}))});
  if(path==='/api/maps'&&request.method==='POST'){
   const input=await body(request);const mapName=name(input.name),state=checkedState(input.state||emptyState()),id=crypto.randomUUID(),now=new Date().toISOString();
   await env.DB.prepare('INSERT INTO atlas_maps (id, owner, name, payload, revision, updated_at) VALUES (?, ?, ?, ?, 1, ?)').bind(id,user.owner,mapName,JSON.stringify(state),now).run();return json({id,name:mapName,state,revision:1,updatedAt:now},201);
  }
  const match=path.match(/^\/api\/maps\/([a-zA-Z0-9-]{1,100})$/);if(!match)fail(404,'找不到內容。');
  const id=match[1];const row=await env.DB.prepare('SELECT * FROM atlas_maps WHERE id = ? AND owner = ?').bind(id,user.owner).first();if(!row)fail(404,'找不到這份地圖。');
  if(request.method==='GET')return json(document(row));
  const input=await body(request);if(!Number.isSafeInteger(input.revision)||input.revision<1)fail(400,'缺少有效版本。');
  if(input.revision!==row.revision)fail(409,'另一個裝置已更新這份地圖。請先下載未儲存備份，再重新載入雲端版本。');
  if(request.method==='DELETE'){
   const result=await env.DB.prepare('DELETE FROM atlas_maps WHERE id = ? AND owner = ? AND revision = ?').bind(id,user.owner,input.revision).run();if(!result.meta.changes)fail(409,'這份地圖已在另一個裝置變更。');return json({ok:true});
  }
  if(request.method!=='PUT')fail(405,'不支援此操作。');
  const nextName=name(input.name),state=checkedState(input.state),now=new Date().toISOString();
  const result=await env.DB.prepare('UPDATE atlas_maps SET name = ?, payload = ?, revision = revision + 1, updated_at = ? WHERE id = ? AND owner = ? AND revision = ?').bind(nextName,JSON.stringify(state),now,id,user.owner,input.revision).run();
  if(!result.meta.changes)fail(409,'這份地圖已在另一個裝置變更。');return json({id,name:nextName,state,revision:input.revision+1,updatedAt:now});
 }catch(error){if(!error.status)console.error('Atlas API failed',path,error.message);return json({error:error.status?error.message:'雲端暫時無法使用，修改仍保留在目前頁面，請稍後重試。'},error.status||503)}
}
export default {async fetch(request,env){const url=new URL(request.url);if(url.pathname.startsWith('/api/'))return handleApi(request,env);return env.ASSETS.fetch(request)}};
