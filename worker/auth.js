import {createRemoteJWKSet,jwtVerify} from 'jose';
const keys=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
export const SESSION_COOKIE='__Host-atlas-session';
export const NONCE_COOKIE='__Host-atlas-nonce';
export const randomToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
export async function hashToken(token){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),n=>n.toString(16).padStart(2,'0')).join('')}
export function cookie(request,name){return request.headers.get('cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='))?.slice(name.length+1)||''}
export const setCookie=(name,value,age)=>`${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
export async function verifyGoogleToken(token,clientId,nonce,keySet=keys){
 if(typeof token!=='string'||token.length>20000||!clientId||!nonce)throw Error('登入資訊不完整。');
 const {payload}=await jwtVerify(token,keySet,{algorithms:['RS256'],issuer:['https://accounts.google.com','accounts.google.com'],audience:clientId,maxTokenAge:'10m',clockTolerance:10});
 if(payload.nonce!==nonce||payload.email_verified!==true||typeof payload.email!=='string'||typeof payload.sub!=='string'||!payload.sub)throw Error('Google 身分驗證失敗。');
 return {owner:payload.sub,email:payload.email,name:typeof payload.name==='string'?payload.name:payload.email};
}
export async function sessionUser(request,db){const token=cookie(request,SESSION_COOKIE);if(!/^[a-f0-9]{64}$/.test(token))return null;return db.prepare('SELECT owner, email, name FROM atlas_sessions WHERE hash = ? AND expires > ?').bind(await hashToken(token),Date.now()).first()}
