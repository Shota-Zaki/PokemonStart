/* Celio Pocket: fixed program files only. Never reads ROM/SAV during installation. */
(()=>{'use strict';
  const SRC=self.CELIO_SOURCE, APP_REV='viewport-v3';
  const ROOT=new URL('./',location.href),toLocal=path=>new URL(path,ROOT).href;
  const CACHE_NAME='celio-game-'+SRC.revision+'-'+APP_REV,READY=toLocal('.celio-ready'),GAME='game.html';
  const files=SRC.files.filter(([path])=>!['sw.js','manifest.webmanifest'].includes(path));
  const expected=['game.html',...files.map(([path])=>path).filter(path=>path!=='index.html')];
  const size=files.reduce((sum,[,,n])=>sum+n,0),$=id=>document.getElementById(id);
  const install=$('install'),play=$('play'),badge=$('badge'),status=$('status'),meta=$('meta'),meter=$('meter'),bar=$('bar'),check=$('check');
  let busy=false;
  function info(message,pct=0,error=false,ready=false){
    status.textContent=message;badge.className=ready?'ready':error?'error':'';
    badge.textContent=ready?'利用可能':error?'エラー':busy?'保存中':'未準備';
    const n=Math.round(Math.min(1,Math.max(0,pct))*100);meter.setAttribute('aria-valuenow',String(n));bar.style.width=n+'%';
  }
  async function state(){
    const cache=await caches.open(CACHE_NAME);
    const all=await Promise.all(expected.map(path=>cache.match(toLocal(path)).then(Boolean)));
    return{ready:!!(await cache.match(READY))&&all.every(Boolean),count:all.filter(Boolean).length,total:all.length};
  }
  function show(s){
    install.hidden=s.ready;install.disabled=s.ready;play.hidden=!s.ready;check.disabled=false;
    if(s.ready){
      info('iPhone・iPad共通版を保存済みです。ゲームを起動できます。',1,false,true);
      meta.textContent=s.total+'ファイルを端末内に保存済み。セーブ共有はゲーム内「ファイル」から操作します。';
    }else{
      info('この端末に共通版の保存・更新が必要です。',s.count/s.total);
      meta.textContent=s.count+'/'+s.total+'ファイル。初回・版更新時は通信が必要です。既存のROM・セーブは削除しません。';
    }
  }
  function type(path){
    if(path.endsWith('.js'))return 'text/javascript; charset=utf-8';
    if(path.endsWith('.wasm'))return 'application/wasm';
    if(path.endsWith('.html'))return 'text/html; charset=utf-8';
    if(path.endsWith('.css'))return 'text/css; charset=utf-8';
    if(path.endsWith('.png'))return 'image/png';
    return 'text/plain; charset=utf-8';
  }
  function transformHTML(src){
    if(!/<head>/i.test(src)||!/<\/head>/i.test(src)||!/src=["']mgba\.js["']/i.test(src)||
       !/src=["']app\.js["']/i.test(src)||!/id=["']rom["']/i.test(src)||
       !src.includes('<script src="link-session.js"></script>'))throw new Error('公開元の構成が変化しています。安全のため停止しました。');
    const csp=["default-src 'none'","script-src 'self' 'wasm-unsafe-eval'","connect-src 'self'",
      "img-src 'self' data: blob:","style-src 'self' 'unsafe-inline'","font-src 'self'",
      "worker-src 'self' blob:","manifest-src 'self'","media-src 'self' blob:",
      "object-src 'none'","frame-src 'none'","base-uri 'none'","form-action 'none'"].join('; ');
    const localStyle='<link rel="stylesheet" href="save-transfer.css"><link rel="stylesheet" href="viewport-fit.css"><script defer src="viewport-fit.js"></script><style id="celio-local-mode">'+
      '#tab-celio,#panel-celio,#link-dialog,#link-hud,#link-open,#link-hud-settings,#link-choose-online,'+
      '#link-choose-usb,#link-server,#link-host,#link-join,#link-usb-start,#link-settings-open,'+
      '#offline-prepare,#cache-clear,#cache-clear-main{display:none!important}'+
      'a[href^="http:"] , a[href^="https:"] {pointer-events:none;opacity:.5}</style>';
    return src.replace(/<head>/i,'<head><meta http-equiv="Content-Security-Policy" content="'+csp+'">')
      .replace(/<\/head>/i,localStyle+'</head>')
      .replace(/<title>[^<]*<\/title>/i,'<title>Celio Pocket — iPhone / iPad</title>')
      .replace('<script src="link-session.js"></script>','<script src="save-transfer.js"></script><script src="link-session.js"></script>');
  }
  function transformCore(src){
    const anchor='getGame:() => ({loaded,bytes:romBytes,key:romKey,name,cheats:cheats.length>0}),';
    if(src.split(anchor).length!==2)throw new Error('セーブ受け渡し用の接続位置が一致しません。');
    return src.replace(anchor,anchor.replace('cheats:','blocked:romLoading||quickBusy||backupBusy,cheats:'));
  }
  function transformSkin(src){
    const anchor="const availableHeight=fullscreen?Math.max(1,stage.clientHeight-header):Math.max(160,innerHeight-(play.getBoundingClientRect().top+scrollY)-toolbar-bottom-2);";
    if(src.split(anchor).length!==2)throw new Error('スキンの表示領域を調整する位置が一致しません。');
    return src.replace(anchor,'const availableHeight=Math.max(1,stage.clientHeight-header);');
  }
  const disabledLink='/* MPL-2.0. Native file handoff only; no online/USB link. */\n'+
    'window.createLinkSession=function(api){return window.createCelioSaveTransfer(api);};\n';
  async function checkBlob(bytes,sha,n){
    if(bytes.byteLength!==n)throw new Error('ファイルサイズが一致しません。');
    const head=new TextEncoder().encode('blob '+bytes.byteLength+'\0'),joined=new Uint8Array(head.length+bytes.length);
    joined.set(head);joined.set(bytes,head.length);
    const hash=new Uint8Array(await crypto.subtle.digest('SHA-1',joined));
    if(Array.from(hash,n=>n.toString(16).padStart(2,'0')).join('')!==sha)throw new Error('固定ソースの照合値が一致しません。');
  }
  async function download(cache,[path,sha,n]){
    if(path==='link-session.js'){
      await cache.put(toLocal(path),new Response(disabledLink,{headers:{'Content-Type':type(path)}}));return;
    }
    const response=await fetch(SRC.rawBase+path,{method:'GET',mode:'cors',credentials:'omit',redirect:'error',cache:'no-store'});
    if(!response.ok||response.type!=='cors')throw new Error(path+' の取得に失敗しました。');
    const bytes=new Uint8Array(await response.arrayBuffer());await checkBlob(bytes,sha,n);
    const name=path==='index.html'?GAME:path,data=path==='index.html'?transformHTML(new TextDecoder().decode(bytes)):path==='app.js'?transformCore(new TextDecoder().decode(bytes)):path==='skins.js'?transformSkin(new TextDecoder().decode(bytes)):bytes;
    await cache.put(toLocal(name),new Response(data,{headers:{'Content-Type':type(name),'X-Content-Type-Options':'nosniff'}}));
  }
  async function run(){
    if(busy)return;busy=true;install.disabled=check.disabled=true;
    try{
      if(!window.isSecureContext||!navigator.serviceWorker||!window.caches||!crypto.subtle)throw new Error('HTTPSのSafariで開いてください。');
      try{await navigator.storage?.persist?.();}catch(_){}
      const cache=await caches.open(CACHE_NAME);await cache.delete(READY);let bytes=0;
      for(let i=0;i<files.length;i++){
        const f=files[i];await download(cache,f);bytes+=f[2];info('保存しています：'+f[0],bytes/size);
        meta.textContent=(i+1)+'/'+files.length+'ファイル · '+(bytes/1048576).toFixed(1)+' / '+(size/1048576).toFixed(1)+'MiB';
      }
      const current=await state();if(current.count!==current.total)throw new Error('必要なファイルをすべて保存できませんでした。');
      await cache.put(READY,new Response(APP_REV));show(await state());
    }catch(e){
      info('保存できませんでした：'+e.message,0,true);meta.textContent='通信・容量を確認してください。既存セーブは削除していません。';install.disabled=false;
    }finally{busy=false;check.disabled=false;}
  }
  async function boot(){
    try{
      if(!window.isSecureContext||!navigator.serviceWorker||!window.caches)throw new Error('HTTPSのSafariが必要です。');
      await navigator.serviceWorker.register('sw.js',{scope:'./',updateViaCache:'none'});
      await navigator.serviceWorker.ready;show(await state());
    }catch(e){info('利用できません：'+e.message,0,true);meta.textContent='Safariの設定と通信を確認してください。';}
  }
  install.addEventListener('click',run);check.addEventListener('click',boot);
  navigator.serviceWorker?.addEventListener('controllerchange',()=>{if(!busy)state().then(show).catch(()=>{});});
  boot();
})();
