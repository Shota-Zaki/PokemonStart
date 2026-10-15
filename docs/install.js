/* Celio Pocket — installation downloads ONLY static emulator program files.
 * User ROM and save files are never inspected, read or uploaded.
 */
(()=>{'use strict';
  const SRC=self.CELIO_SOURCE;
  const ROOT=new URL('./',location.href);
  const toLocal=path=>new URL(path,ROOT).href;
  const CACHE_NAME='celio-game-'+SRC.revision;
  const READY=toLocal('.celio-ready');
  const GAME='game.html';
  const skip=new Set(['sw.js','manifest.webmanifest']);
  const files=SRC.files.filter(([path])=>!skip.has(path));
  const expected=['game.html',...files.map(([path])=>path).filter(path=>path!=='index.html')];
  const size=files.reduce((sum,[, ,n])=>sum+n,0);
  const $=id=>document.getElementById(id);
  const install=$('install'),play=$('play'),badge=$('badge'),status=$('status'),meta=$('meta'),meter=$('meter'),bar=$('bar'),check=$('check');
  let busy=false;
  function info(message,pct=0,error=false,ready=false){
    status.textContent=message;badge.className=ready?'ready':error?'error':'';
    badge.textContent=ready?'利用可能':error?'エラー':busy?'保存中':'未準備';
    const n=Math.round(Math.min(1,Math.max(0,pct))*100);
    meter.setAttribute('aria-valuenow',String(n));bar.style.width=n+'%';
  }
  async function state(){
    const cache=await caches.open(CACHE_NAME);
    const all=await Promise.all(expected.map(path=>cache.match(toLocal(path)).then(Boolean)));
    return{ready:!!(await cache.match(READY))&&all.every(Boolean),count:all.filter(Boolean).length,total:all.length};
  }
  function show(s){
    install.hidden=s.ready;install.disabled=s.ready;play.hidden=!s.ready;check.disabled=false;
    if(s.ready){
      info('アプリは保存済みです。ゲームを起動できます。',1,false,true);
      meta.textContent=s.total+'ファイルを端末内に保存済み。ROM・SAVは外部へ送信しません。';
    }else{
      info('ゲーム本体の保存が必要です。',s.count/s.total);
      meta.textContent=s.count+'/'+s.total+'ファイル保存済み。初回はインターネットが必要です。';
    }
  }
  function type(path){
    if(path.endsWith('.js'))return 'text/javascript; charset=utf-8';
    if(path.endsWith('.wasm'))return 'application/wasm';
    if(path.endsWith('.html'))return 'text/html; charset=utf-8';
    if(path.endsWith('.css'))return 'text/css; charset=utf-8';
    if(path.endsWith('.glsl'))return 'text/plain; charset=utf-8';
    if(path.endsWith('.png'))return 'image/png';
    if(path.endsWith('.json')||path.endsWith('.webmanifest'))return 'application/json';
    return 'text/plain; charset=utf-8';
  }
  function transformHTML(src){
    if(!/<head>/i.test(src)||!/<\/head>/i.test(src)
       ||!/src=["']mgba\.js["']/i.test(src)||!/src=["']app\.js["']/i.test(src)
       ||!/id=["']rom["']/i.test(src))
      throw new Error('公開元の構成が変化しています。インストールを停止しました。');
    const csp=[
      "default-src 'none'","script-src 'self' 'wasm-unsafe-eval'",
      "connect-src 'self'","img-src 'self' data: blob:",
      "style-src 'self' 'unsafe-inline'","font-src 'self'",
      "worker-src 'self' blob:","manifest-src 'self'","media-src 'self' blob:",
      "object-src 'none'","frame-src 'none'","base-uri 'none'","form-action 'none'"
    ].join('; ');
    const removeOnline='<style id="celio-local-mode">'+
      '#tab-celio,#panel-celio,#link-dialog,#link-hud,#link-open,'+
      '#link-hud-settings,#link-choose-online,#link-choose-usb,#link-server,'+
      '#link-host,#link-join,#link-usb-start,#link-settings-open,'+
      '#offline-prepare,#cache-clear,#cache-clear-main{display:none!important}'+
      'a[href^="http:"] , a[href^="https:"] {pointer-events:none;opacity:.5}'+
      '</style>';
    return src
      .replace(/<head>/i, '<head><meta http-equiv="Content-Security-Policy" content="'+csp+'">')
      .replace(/<\/head>/i,removeOnline+'</head>')
      .replace(/<title>[^<]*<\/title>/i,'<title>Celio Pocket — Offline</title>');
  }
  const disabledLink=/* No WebSocket, HTTP, peer link, or USB transport. */
    "/* Offline build: Celio cable link deliberately disabled. */\n"+
    "window.createLinkSession=function(api){"+
    "const el=api.$('link-status');if(el)el.textContent='オフライン専用版では通信機能は無効です';"+
    "return {busy:false,blockSave:false,async onGame(){},tick(){return false}};"+
    "};\n";
  async function checkBlob(bytes,sha,size){
    if(bytes.byteLength!==size)throw new Error('ダウンロードしたファイルのサイズが不一致です。');
    const head=new TextEncoder().encode('blob '+bytes.byteLength+'\0');
    const joined=new Uint8Array(head.length+bytes.length);
    joined.set(head);joined.set(bytes,head.length);
    const hash=new Uint8Array(await crypto.subtle.digest('SHA-1',joined));
    const hex=Array.from(hash,n=>n.toString(16).padStart(2,'0')).join('');
    if(hex!==sha)throw new Error('ソースの照合値が一致しません。');
  }
  async function download(cache,[path,sha,n]){
    if(path==='link-session.js'){
      await cache.put(toLocal(path),new Response(disabledLink,{headers:{'Content-Type':type(path),'X-Content-Type-Options':'nosniff'}}));
      return;
    }
    const response=await fetch(SRC.rawBase+path,{method:'GET',mode:'cors',credentials:'omit',redirect:'error',cache:'no-store'});
    if(!response.ok||response.type!=='cors')throw new Error(path+' の取得に失敗しました。');
    const bytes=new Uint8Array(await response.arrayBuffer());
    await checkBlob(bytes,sha,n);
    const name=path==='index.html'?GAME:path;
    const data=path==='index.html'?transformHTML(new TextDecoder().decode(bytes)):bytes;
    const options={headers:{'Content-Type':type(name),'X-Content-Type-Options':'nosniff'}};
    await cache.put(toLocal(name),new Response(data,options));
  }
  async function run(){
    if(busy)return;busy=true;install.disabled=check.disabled=true;
    try{
      if(!window.isSecureContext||!navigator.serviceWorker||!window.caches||!crypto.subtle)
        throw new Error('HTTPSのSafariで開く必要があります。');
      try{await navigator.storage?.persist?.();}catch(e){}
      const cache=await caches.open(CACHE_NAME);
      await cache.delete(READY);
      let bytes=0;
      for(let i=0;i<files.length;i++){
        const f=files[i];
        await download(cache,f);bytes+=f[2];
        info('保存しています：'+f[0],bytes/size);
        meta.textContent=(i+1)+'/'+files.length+'ファイル · '+(bytes/1048576).toFixed(1)+' / '+(size/1048576).toFixed(1)+'MiB';
      }
      const current=await state();
      if(current.count!==current.total)throw new Error('必要なファイルをすべて保存できませんでした。');
      await cache.put(READY,new Response(SRC.revision,{headers:{'Content-Type':'text/plain'}}));
      const final=await state();
      if(!final.ready)throw new Error('完成状態の確認に失敗しました。');
      show(final);
    }catch(e){
      info('保存できませんでした：'+e.message,0,true);
      meta.textContent='通信状態・ストレージ容量を確認してください。安全のため未完成のゲームは起動できません。';
      install.disabled=false;
    }finally{busy=false;check.disabled=false;}
  }
  async function boot(){
    try{
      if(!window.isSecureContext||!navigator.serviceWorker||!window.caches)
        throw new Error('HTTPSのSafariが必要です。');
      await navigator.serviceWorker.register('sw.js',{scope:'./'});
      await navigator.serviceWorker.ready;
      show(await state());
    }catch(e){
      info('この端末では利用できません：'+e.message,0,true);
      meta.textContent='Safariの設定とインターネット接続を確認してください。';
    }
  }
  install.addEventListener('click',run);
  check.addEventListener('click',boot);
  boot();
})();
