import test from 'node:test';import assert from 'node:assert/strict';
import {database} from './d1-helper.mjs';import {handleApi} from '../worker/index.js';
import {SESSION_COOKIE,hashToken,verifyGoogleToken} from '../worker/auth.js';
import {generateKeyPair,SignJWT} from 'jose';
test('cloud maps isolate owners and reject stale writes, CSRF and anonymous access',async()=>{
 const db=database(),env={DB:db};const tokens=['a'.repeat(64),'b'.repeat(64)];
 for(let i=0;i<2;i++)await db.prepare('INSERT INTO atlas_sessions VALUES (?, ?, ?, ?, ?)').bind(await hashToken(tokens[i]),`owner-${i}`,`user${i}@example.test`,'User',Date.now()+100000).run();
 const request=(method,path,body,user=0,origin='https://atlas.test')=>handleApi(new Request(`https://atlas.test${path}`,{method,headers:{Origin:origin,'Content-Type':'application/json',Cookie:user===null?'':`${SESSION_COOKIE}=${tokens[user]}`},body:body===undefined?undefined:JSON.stringify(body)}),env);
 assert.equal((await request('GET','/api/maps',undefined,null)).status,401);
 assert.equal((await request('POST','/api/maps',{name:'Unsafe'},0,'https://evil.test')).status,403);
 const created=await (await request('POST','/api/maps',{name:'工作'})).json();
 assert.equal((await request('GET',`/api/maps/${created.id}`,undefined,1)).status,404);
 assert.equal((await (await request('GET','/api/maps',undefined,1)).json()).maps.length,0);
 const update={name:'新版',state:created.state,revision:1};assert.equal((await request('PUT',`/api/maps/${created.id}`,update)).status,200);
 assert.equal((await request('PUT',`/api/maps/${created.id}`,update)).status,409);
 assert.equal((await (await request('GET',`/api/maps/${created.id}`)).json()).name,'新版');
 assert.equal((await request('DELETE',`/api/maps/${created.id}`,{revision:1})).status,409);
 assert.equal((await request('DELETE',`/api/maps/${created.id}`,{revision:2})).status,200);db.close();
});
test('Google verification requires signature, audience, nonce, verified email and expiry',async()=>{
 const {privateKey,publicKey}=await generateKeyPair('RS256');
 const token=async(extra={})=>new SignJWT({email:'a@example.test',email_verified:true,nonce:'nonce',...extra}).setProtectedHeader({alg:'RS256'}).setIssuer('https://accounts.google.com').setSubject('google-id').setAudience('client-id').setIssuedAt().setExpirationTime('5m').sign(privateKey);
 assert.equal((await verifyGoogleToken(await token(),'client-id','nonce',publicKey)).owner,'google-id');
 const expired=await new SignJWT({email:'a@example.test',email_verified:true,nonce:'nonce'}).setProtectedHeader({alg:'RS256'}).setIssuer('https://accounts.google.com').setSubject('google-id').setAudience('client-id').setIssuedAt(Math.floor(Date.now()/1000)-1000).setExpirationTime(Math.floor(Date.now()/1000)-100).sign(privateKey);
 await assert.rejects(()=>verifyGoogleToken(expired,'client-id','nonce',publicKey));
 await assert.rejects(async()=>verifyGoogleToken(await token(),'wrong-client','nonce',publicKey));
 await assert.rejects(async()=>verifyGoogleToken(await token(),'client-id','wrong',publicKey));
 await assert.rejects(async()=>verifyGoogleToken(await token({email_verified:false}),'client-id','nonce',publicKey));
});
