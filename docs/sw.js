/* Celio Pocket iPhone offline-only service worker.
 * Once the complete upstream emulator is cached, no game request is sent
 * to the network. ROM/SAV are never included in any request.
 */
'use strict';
importScripts('./assets.js');
const SOURCE = self.CELIO_SOURCE;
const ROOT = self.registration.scope;
const SCOPE = new URL(ROOT);
const CACHE_SHELL = 'celio-shell-' + SOURCE.revision;
const CACHE_GAME = 'celio-game-' + SOURCE.revision;
const DONE = new URL('.celio-ready', ROOT).href;
const local = path => new URL(path || './', ROOT).href;
const SHELL = ['', 'index.html', 'install.css', 'install.js', 'assets.js', 'manifest.webmanifest', 'icon.svg', 'sw.js'];
const GAME = ['game.html', ...SOURCE.files.map(([path]) => path)
  .filter(path => !['index.html', 'manifest.webmanifest', 'sw.js'].includes(path))];
const shellURLs = new Set(SHELL.map(local));
const gameURLs = new Set(GAME.map(local));
const upstreamURLs = new Set(SOURCE.files.map(([path]) => SOURCE.rawBase + path));
async function sealed(){return !!(await (await caches.open(CACHE_GAME)).match(DONE));}
async function state(){
  const cache=await caches.open(CACHE_GAME);
  const hits=await Promise.all(GAME.map(path=>cache.match(local(path)).then(Boolean)));
  const marked=!!await cache.match(DONE);
  return {ready:marked && hits.every(Boolean),count:hits.filter(Boolean).length,total:hits.length};
}
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE_SHELL);
  await cache.addAll(SHELL.map(path=>new Request(local(path),{cache:'reload'})));
  await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const names=await caches.keys();
  await Promise.all(names.filter(name=>name.startsWith('celio-')&&!([CACHE_SHELL,CACHE_GAME].includes(name))).map(name=>caches.delete(name)));
  await self.clients.claim();
})()));
self.addEventListener('message',event=>event.waitUntil((async()=>{
  const port=event.ports?.[0];if(!port)return;
  try{
    switch(event.data){
      case 'STATUS':case 'PREPARE':port.postMessage(await state());break;
      case 'CLEAR':port.postMessage({error:'セーブ保護のためゲームからキャッシュは削除できません'});break;
      default:port.postMessage({error:'未対応の操作'});
    }
  }catch(e){port.postMessage({error:String(e.message||e)});}
})()));
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  if(req.method!=='GET'){
    event.respondWith(new Response('オフライン専用: アップロード禁止',{status:405}));
    return;
  }
  if(url.origin!==SCOPE.origin){
    event.respondWith((async()=>{
      if(!(await sealed())&&!url.search&&upstreamURLs.has(url.href))
        return fetch(req);
      return new Response('外部通信は禁止されています',{status:403});
    })());return;
  }
  if(!url.href.startsWith(ROOT)||url.search){
    event.respondWith(new Response('未許可のURLです',{status:403}));return;
  }
  event.respondWith((async()=>{
    if(shellURLs.has(url.href)){
      const cache=await caches.open(CACHE_SHELL);
      return (await cache.match(url.href))||new Response('オフラインキャッシュがありません',{status:503});
    }
    if(!gameURLs.has(url.href))return new Response('未登録',{status:404});
    if(!(await sealed()))return Response.redirect(local('index.html'),302);
    const cache=await caches.open(CACHE_GAME);
    return (await cache.match(url.href))||new Response('ゲームファイルがありません',{status:503});
  })());
});
