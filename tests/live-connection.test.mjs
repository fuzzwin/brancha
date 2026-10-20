import test from 'node:test';import assert from 'node:assert/strict';import {localConnection} from '../dist/live-connection.mjs';
const old='a'.repeat(64),fresh='b'.repeat(64),reply=(status,data)=>({status,ok:status===200,json:async()=>data,text:async()=>data});
test('a companion restart renews the local token and resumes reads without reloading the current map',async()=>{
 const seen=[];let roots=0;const api=localConnection(old,async(url,options)=>{seen.push([url,options]);if(url==='/'){roots++;assert.equal(options.redirect,'error');return reply(200,`<meta name="brancha-local-token" content="${fresh}">`);}return options.headers['x-brancha-token']===fresh?reply(200,{revision:2}):reply(403,{error:'Expired connection'});});
 assert.equal((await api('/api/identity')).revision,2);assert.equal((await api('/api/view?path=Generated%2FNavigation%2FHome.md')).revision,2);assert.equal(roots,1);assert.equal(seen.filter(([url])=>url==='/api/identity').length,2);
});
test('an unchanged or invalid bootstrap token cannot cause an authentication retry loop',async()=>{
 for(const html of [`<meta name="brancha-local-token" content="${old}">`,'<html>No connection credential</html>']){let reads=0;const api=localConnection(old,async url=>{if(url==='/')return reply(200,html);reads++;return reply(403,{error:'Access denied'});});await assert.rejects(api('/api/view'),e=>e.status===403);assert.equal(reads,1);}
});
test('reconnection never repeats a rejected write or follows a bootstrap redirect',async()=>{
 let calls=0;const api=localConnection(old,async()=>{calls++;return reply(403,{error:'Access denied'});});await assert.rejects(api('/api/review-request',{method:'POST'}),e=>e.status===403);assert.equal(calls,1);
 const blocked=localConnection(old,async(url,options)=>{if(url==='/'){assert.equal(options.redirect,'error');throw Error('Redirect blocked');}return reply(403,{error:'Expired'});});await assert.rejects(blocked('/api/identity'),/Redirect blocked/);
});
