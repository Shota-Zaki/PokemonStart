/* MPL-2.0. Explicit Files/Share Sheet handoff only; no HTTP or cloud API. */
window.createCelioSaveTransfer = function (api) {
  'use strict';
  const {m, $, upload, store, getGame} = api;
  const MAX = 6 * 1024 * 1024 + 16;
  const panel = document.createElement('section');
  panel.id = 'celio-transfer';
  panel.innerHTML = '<h3>iPhone・iPadでセーブを共有</h3>' +
    '<p>① 遊ぶ前に読み込む → ② ゲーム内でレポート → ③ 書き出す</p>' +
    '<div class="transfer-actions"><button type="button" id="transfer-import">iCloud Driveから読込</button>' +
    '<button type="button" id="transfer-export">iCloud Driveへ書出</button></div>' +
    '<p id="transfer-status" role="status" aria-live="polite">先に同じバージョンのROMを開いてください。</p>' +
    '<p id="transfer-file" class="transfer-note"></p>' +
    '<button type="button" id="transfer-download" hidden>.savをダウンロード</button>' +
    '<button type="button" id="transfer-backup" hidden>読込前のセーブを書出</button>' +
    '<details><summary>受け渡しの手順・注意</summary><p>両端末で同じApple AccountのiCloud Driveを有効にします。書出で共有画面が開いたら「ファイルに保存」→「iCloud Drive」→同じフォルダを選びます。同名ファイルの置き換えは保存画面で確認してください。</p>' +
    '<p>ファイルAppで別端末への反映を確認してから、その端末で読み込みます。読込はコピーであり、遊ぶだけではiCloudのファイルは更新されません。2台で同時に進めないでください。</p>' +
    '<p>アプリは自動送信しません。手動でiCloudに保存した.savはAppleのクラウドへ同期されます。共有時だけ通信が必要です。アプリから同期完了や保存先は確認できません。</p>' +
    '<p>通常の.savのみ対応。クイックセーブは端末別です。別ROM・古い進行を生の.savだけで完全には判定できません。読込前のセーブはこの端末に1世代退避します。</p></details>';
  $('panel-save').prepend(panel);
  const message = $('transfer-status'), fileLabel = $('transfer-file');
  const importButton = $('transfer-import'), exportButton = $('transfer-export');
  const downloadButton = $('transfer-download'), backupButton = $('transfer-backup');
  const input = $('save');
  input.accept = '.sav,application/octet-stream';
  let busy = false, pickedKey = '', backup = null, pendingDownload = null;
  const protectedIds = ['open','welcome-open','reset','pause','export','import','quick-save','import-main',
    'quick-state-load','quick-state-save','browser-save-delete','backup-restore'];
  let disabled = new Map();
  function say(text) { message.textContent = text; $('status').textContent = text; }
  function validSize(n) { if (!Number.isInteger(n) || n < 1 || n > MAX) throw new Error('空でない通常の.sav（最大6MiB＋16バイト）を選んでください。'); }
  function game() {
    const g = getGame();
    if (!g.loaded || !g.key) throw new Error('先にROMを開いてください。');
    if (g.blocked) throw new Error('ROM読込・保存処理中です。完了後に操作してください。');
    return g;
  }
  function nameFor(g) {
    const base = (g.name || 'game').replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_');
    return base.slice(0,100) + '--' + g.key.slice(0,12) + '.sav';
  }
  function fileFor(bytes, filename) { return new File([bytes], filename, {type:'application/octet-stream'}); }
  function snapshot() {
    const n = m._web_save_export();
    if (!n) return null;
    validSize(n);
    const p = m._web_save_data();
    return m.HEAPU8.slice(p, p+n);
  }
  function lock() {
    if (busy) throw new Error('現在の受け渡しを終えてください。');
    $('file-menu-open').click();
    api.mode(false, false); // Pause without changing speed or starting a link session.
    busy = true;
    for (const id of protectedIds) { const el=$(id); if(el){disabled.set(el,el.disabled);el.disabled=true;} }
    importButton.disabled = exportButton.disabled = backupButton.disabled = true;
  }
  function unlock() {
    busy = false;
    for (const [el,value] of disabled) el.disabled=value;
    disabled.clear();
    importButton.disabled=exportButton.disabled=!getGame().loaded;
    backupButton.disabled=false;
  }
  function offerDownload(file) {
    pendingDownload=file; downloadButton.hidden=false;
    say('このブラウザでは共有画面へ渡せません。「.savをダウンロード」の後、ファイルAppでiCloud Driveへ移動してください。');
  }
  function share(file) {
    // Invoked directly by a tap. Do not await storage/hash work before navigator.share.
    pendingDownload=null; downloadButton.hidden=true;
    fileLabel.textContent=file.name+' · '+file.size.toLocaleString('ja-JP')+'バイト';
    try {
      if (!navigator.share || !navigator.canShare || !navigator.canShare({files:[file]})) {
        offerDownload(file); unlock(); return;
      }
      const result=navigator.share({files:[file]});
      Promise.resolve(result).then(()=>{
        say('共有画面への受け渡しが終了しました。保存先と別端末への反映は、ファイルAppで確認してください。');
      },error=>{
        if (error.name==='AbortError') say('共有をキャンセルしました。iCloudへの保存は確認していません。');
        else offerDownload(file);
      }).finally(unlock);
    } catch (error) {
      if(error.name==='AbortError') say('共有をキャンセルしました。'); else offerDownload(file);
      unlock();
    }
  }
  function exportSave() {
    if(busy)return;
    try {
      const g=game();
      lock();
      const bytes=snapshot();
      if(!bytes)throw new Error('セーブがありません。先にゲーム内でレポートを書いてください。');
      share(fileFor(bytes,nameFor(g)));
    } catch(error) { say(error.message); if(busy)unlock(); }
  }
  function pick() {
    if(busy)return;
    try {
      pickedKey=game().key;
      pendingDownload=null;downloadButton.hidden=true;
      $('file-menu-open').click();
      api.mode(false,false);
      input.value=''; input.click();
    } catch(error) { say(error.message); }
  }
  async function importSave(file) {
    if(!file || busy)return;
    let old=null, changed=false, g;
    try {
      g=game();
      if(pickedKey && pickedKey!==g.key)throw new Error('ROMが変わりました。セーブを選び直してください。');
      if(!/\.sav$/i.test(file.name))throw new Error('通常の.savを選んでください。ROMやクイックセーブは読めません。');
      validSize(file.size);
      const marker=file.name.match(/--([0-9a-f]{12})(?:-before-\d+)?\.sav$/i);
      if(marker && marker[1].toLowerCase()!==g.key.slice(0,12))throw new Error('このアプリの書出名に含まれるROM識別子が一致しません。同じROMを開いてください。');
      lock();
      const bytes=new Uint8Array(await file.arrayBuffer());
      if(bytes.byteLength!==file.size)throw new Error('ファイル全体を読み込めませんでした。');
      if(getGame().key!==g.key)throw new Error('ROMが変わりました。取り込みを中止します。');
      const date=file.lastModified?new Date(file.lastModified).toLocaleString('ja-JP'):'不明';
      if(!confirm('このセーブを読み込みますか？\n'+file.name+'\n'+file.size.toLocaleString('ja-JP')+'バイト / ファイル更新: '+date+
        '\n\n現在の通常セーブを端末内に退避してゲームを再起動します。未保存の進行は失われます。\n同じROM・最新の進行か確認してください（日時だけでは判定できません）。')) {
        say('読み込みをキャンセルしました。現在のセーブは変更していません。');return;
      }
      old=snapshot();
      if(old) {
        const record={bytes:old.buffer.slice(0),updated:Date.now(),filename:nameFor(g).replace(/\.sav$/,'-before-'+Date.now()+'.sav')};
        await store.write('handoff-before:'+g.key,record); // Fail closed if backup storage is unavailable.
        backup=fileFor(record.bytes,record.filename); backupButton.hidden=false;
      }
      if(getGame().key!==g.key)throw new Error('ROMが変わりました。取り込みを中止します。');
      changed=true; // A failing core import could already have touched its save buffer.
      if(!upload(bytes,(p,n)=>m._web_save_import(p,n)))throw new Error('エミュレータがこのセーブを受け付けませんでした。');
      m._web_reset(); api.release(); api.refresh();
      // Keep the complete imported byte sequence, including any RTC/extension tail.
      await store.write(g.key,{bytes:bytes.buffer.slice(0),updated:Date.now(),filename:g.name});
      $('save-name').textContent=file.name;
      $('browser-save-status').textContent='共有セーブをこの端末に保存しました。';
      fileLabel.textContent=file.name+' · '+file.size.toLocaleString('ja-JP')+'バイト';
      say('読み込みました。メニューを閉じて「再開」。遊び終えたら、ゲーム内レポートの後にiCloud Driveへ書き出してください。');
    } catch(error) {
      let suffix='';
      if(changed) {
        try {
          if(!old || !upload(old,(p,n)=>m._web_save_import(p,n)))throw new Error('rollback');
          m._web_reset();api.release();api.refresh();
          await store.write(g.key,{bytes:old.buffer.slice(0),updated:Date.now(),filename:g.name});
          suffix=' 読込前の通常セーブに戻しました。';
        } catch(_) { suffix=' 自動復旧を確認できません。「読込前のセーブを書出」で退避データを保護し、再読み込みしてください。'; }
      }
      say('読み込みを中止しました：'+error.message+suffix);
    } finally { input.value=''; pickedKey=''; if(busy)unlock(); }
  }
  downloadButton.onclick=()=>{
    if(!pendingDownload)return;
    const a=document.createElement('a'),url=URL.createObjectURL(pendingDownload);
    a.href=url;a.download=pendingDownload.name;document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    say('ダウンロードを要求しました。ファイルAppで保存結果とiCloud Driveへの移動を確認してください。');
  };
  backupButton.onclick=()=>{if(busy||!backup)return;try{lock();share(backup);}catch(e){say(e.message);if(busy)unlock();}};
  importButton.onclick=pick; exportButton.onclick=exportSave;
  $('import').onclick=pick; $('export').onclick=exportSave;
  input.onchange=()=>importSave(input.files[0]);
  input.addEventListener('cancel',()=>{pickedKey='';say('ファイル選択をキャンセルしました。');});
  async function onGame() {
    const g=getGame(); pendingDownload=backup=null;downloadButton.hidden=backupButton.hidden=true;
    importButton.disabled=exportButton.disabled=!g.loaded;
    if(!g.loaded)return;
    fileLabel.textContent='共有用の保存名：'+nameFor(g);
    say('別端末から続けるときは、先にiCloud Driveの最新.savを読み込んでください。');
    try {
      const record=await store.read('handoff-before:'+g.key);
      if(getGame().key===g.key && record?.bytes){backup=fileFor(record.bytes,record.filename);backupButton.hidden=false;}
    } catch(_) { say('読込前バックアップを取得できません。共有前にファイルへ書き出してください。'); }
  }
  importButton.disabled=exportButton.disabled=true;
  return {get busy(){return busy;},onGame,tick(){return false;},get blockSave(){return busy;}};
};
