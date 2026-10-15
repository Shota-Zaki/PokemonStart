/* Celio Pocket iPhone/iPad: game assets are cache-only; no ROM/SAV transport. */
'use strict';
importScripts('./assets.js');
const SOURCE=self.CELIO_SOURCE,APP_REV='ipad-icloud-v2',ROOT=self.registration.scope,SCOPE=new URL(ROOT);
const CACHE_SHELL='celio-shell-'+SOURCE.revision+'-'+APP_REV;
const CACHE_GAME='celio-game-'+SOURCE.revision+'-'+APP_REV;
const DONE=new URL('.celio-ready',ROOT).href,local=path=>new URL(path||'./',ROOT).href;
const SHELL=['','index.html','install.css','install.js','assets.js','manifest.webmanifest','icon.svg','sw.js','save-transfer.js','save-transfer.css'];
const GAME=['game.html',...SOURCE.files.map(([path])=>path).filter(path=>!['index.html','manifest.webmanifest','sw.js'].includes(path))];
const shellURLs=new Set(SHELL.map(local)),gameURLs=new Set(GAME.map(local));
const upstreamURLs=new Set(SOURCE.files.map(([path])=>SOURCE.rawBase+path));
async function sealed(){return !!(await (await caches.open(CACHE_GAME)).match(DONE));}
async function state(){
  const cache=await caches.open(CACHE_GAME);
  const hits=await Promise.all(GAME.map(path=>cache.match(local(path)).then(Boolean)));
  return{ready:await sealed()&&hits.every(Boolean),count:hits.filter(Boolean).length,total:hits.length};
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE_SHELL);
  await cache.addAll(SHELL.map(path=>new Request(local(path),{cache:'reload'})));
  await self.skipWaiting();
})()));
// Retain earlier program caches during an upgrade. Never erase IndexedDB ROMs/saves.
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('message',event=>event.waitUntil((async()=>{
  const port=event.ports?.[0];if(!port)return;
  try{
    if(['STATUS','PREPARE'].includes(event.data))port.postMessage(await state());
    else port.postMessage({error:'セーブ保護のため、この操作は無効です。'});
  }catch(e){port.postMessage({error:String(e.message||e)});}
})()));
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  if(req.method!=='GET'){event.respondWith(new Response('アップロード禁止',{status:405}));return;}
  if(url.origin!==SCOPE.origin){
    event.respondWith((async()=>{
      const client=event.clientId?await self.clients.get(event.clientId):null;
      const installer=client&&[local(''),local('index.html')].includes(client.url);
      if(installer&&!(await sealed())&&!url.search&&upstreamURLs.has(url.href))return fetch(req);
      return new Response('外部通信は禁止されています',{status:403});
    })());return;
  }
  if(!url.href.startsWith(ROOT)||url.search){event.respondWith(new Response('未許可のURL',{status:403}));return;}
  event.respondWith((async()=>{
    if(shellURLs.has(url.href))return (await (await caches.open(CACHE_SHELL)).match(url.href))||new Response('保存がありません',{status:503});
    if(!gameURLs.has(url.href))return new Response('未登録',{status:404});
    if(!(await sealed()))return Response.redirect(local('index.html'),302);
    return (await (await caches.open(CACHE_GAME)).match(url.href))||new Response('ゲームファイルがありません',{status:503});
  })());
});
