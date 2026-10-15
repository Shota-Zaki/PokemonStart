'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
(async()=>{
  const install=read('docs/install.js'),worker=read('docs/sw.js');
  for(const f of ['install.js','sw.js','save-transfer.js'])new vm.Script(read('docs/'+f));
  const chunk=install.slice(install.indexOf('  function transformHTML('),install.indexOf('  const disabledLink='));
  const {html,core}=new Function(chunk+'; return {html:transformHTML,core:transformCore}')();
  const fixture='<html><head><title>original</title></head><body><input id="rom"><script src="mgba.js"></script><script src="link-session.js"></script><script src="app.js"></script></body></html>';
  const result=html(fixture);
  assert(result.includes('save-transfer.css'));assert(result.indexOf('save-transfer.js')<result.indexOf('link-session.js'));
  assert(result.includes('Content-Security-Policy'));assert(result.includes("connect-src 'self'"));
  assert.throws(()=>html('<html></html>'));
  const anchor='getGame:() => ({loaded,bytes:romBytes,key:romKey,name,cheats:cheats.length>0}),';
  assert(core(anchor).includes('blocked:romLoading||quickBusy||backupBusy'));
  assert.throws(()=>core(anchor+anchor));assert.throws(()=>core('unknown'));
  assert(install.includes("APP_REV='ipad-icloud-v2'"));assert(worker.includes("APP_REV='ipad-icloud-v2'"));
  const handlers={},data=new Map(),network=[];let claims=0,deletions=0;
  const ROOT='https://example.invalid/app/',SOURCE={revision:'pinned',rawBase:'https://source.invalid/pinned/',files:[['app.js','x',1]]};
  const cache={async match(key){return data.get(String(key))?.clone()},async put(key,val){data.set(String(key),val)},async addAll(){}};
  const context={URL,Request,Response,Promise,Set,Map,console,importScripts(){},caches:{async open(){return cache},async delete(){deletions++}},
    fetch:async req=>{network.push(req.url);return new Response('program')},self:{CELIO_SOURCE:SOURCE,registration:{scope:ROOT},
      addEventListener:(type,handler)=>handlers[type]=handler,skipWaiting:async()=>{},clients:{claim:async()=>{claims++},get:async id=>({url:ROOT+(id==='installer'?'index.html':'game.html')})}}};
  vm.runInNewContext(worker,context);
  async function req(url,method='GET',clientId='installer'){
    let result;handlers.fetch({request:new Request(url,{method}),clientId,respondWith:r=>result=Promise.resolve(r)});return await result;
  }
  let count=0;function check(ok,name){assert(ok,name);count++;console.log('PASS '+name)}
  check((await req(ROOT+'save','POST')).status===405,'POST denied');
  check((await req('https://bad.invalid/upload')).status===403,'unlisted external denied');
  check((await req(SOURCE.rawBase+'app.js','GET','game')).status===403,'game cannot fetch external even before install');
  check((await req(SOURCE.rawBase+'app.js')).status===200&&network.length===1,'only installer can GET pinned static files');
  check((await req(ROOT+'game.html')).status===302,'unsealed game redirects to installer');
  data.set(ROOT+'.celio-ready',new Response('ipad-icloud-v2'));
  check((await req(SOURCE.rawBase+'app.js')).status===403&&network.length===1,'sealed installation never fetches external');
  check((await req(ROOT+'app.js')).status===503&&network.length===1,'missing game cache has no network fallback');
  data.set(ROOT+'save-transfer.js',new Response('local helper'));
  check(await (await req(ROOT+'save-transfer.js')).text()==='local helper','handoff script served from local cache');
  check((await req(ROOT+'index.html?save=secret')).status===403,'query exfiltration denied');
  let wait;handlers.activate({waitUntil:p=>wait=p});await wait;
  check(claims===1&&deletions===0,'upgrade preserves old caches and never deletes saves');
  console.log('PASS syntax, HTML/core transform, fail-closed markers, matching revision');
  console.log('Worker checks: '+count+'/10');
})().catch(error=>{console.error(error);process.exitCode=1;});
