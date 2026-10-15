"""Synthetic core / Chromium tests. Does not verify Apple Files, iCloud, or real ROMs."""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
FIXTURE='''<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/docs/save-transfer.css">
<style>body{font-family:system-ui;margin:16px;background:#111;color:white}button{padding:10px}#panel-save{max-width:800px;margin:auto}</style>
<div id="status"></div><div id="panel-save"></div><input id="save" type="file" hidden><div id="save-name"></div><div id="browser-save-status"></div>
<script src="/docs/save-transfer.js"></script><script>
for(const id of ['open','welcome-open','reset','pause','export','import','quick-save','import-main','quick-state-load','quick-state-save','browser-save-delete','backup-restore','file-menu-open']){const b=document.createElement('button');b.id=id;b.hidden=true;document.body.append(b)}
window.logs=[];window.records={};window.failed=false;window.shareMode='success';window.gameInfo={loaded:true,key:'a'.repeat(64),name:'PokemonStart.gba',blocked:false};window.coreBytes=new Uint8Array(131088).fill(7);
const m={HEAPU8:new Uint8Array(6291472),incoming:null,_web_save_export(){this.HEAPU8.set(coreBytes);return coreBytes.length},_web_save_data(){return 0},_web_save_import(p,n){logs.push(['import',n]);coreBytes=this.incoming.slice();return 1},_web_reset(){logs.push(['reset'])}};
const store={async read(k){return records[k]},async write(k,v){logs.push(['write',k,v.bytes.byteLength]);if(window.failBackup&&k.startsWith('handoff-before'))throw Error('backup unavailable');if(window.failPersist&&!failed&&k===gameInfo.key){failed=true;throw Error('disk full')}records[k]=structuredClone(v)}};
Object.defineProperty(navigator,'canShare',{value:()=>shareMode!=='unsupported'});
Object.defineProperty(navigator,'share',{value:d=>{logs.push(['share',d.files[0].name,d.files[0].size,navigator.userActivation.isActive]);window.shared=d.files[0];return shareMode==='cancel'?Promise.reject(new DOMException('cancel','AbortError')):Promise.resolve()}});
const $=id=>document.getElementById(id);
window.transfer=createCelioSaveTransfer({m,$,store,getGame:()=>gameInfo,upload(b,f){m.incoming=b.slice();return f(0,b.length)},mode(){logs.push(['pause'])},release(){},refresh(){}});window.ready=transfer.onGame();
</script>'''
results=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for case in range(1,13):
  ctx=browser.new_context(viewport={'width':768,'height':1024},has_touch=True)
  page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('dialog',lambda d:d.dismiss() if case==3 else d.accept())
  html=FIXTURE.replace('<link rel="stylesheet" href="/docs/save-transfer.css">','<style>'+(ROOT/'docs/save-transfer.css').read_text()+'</style>').replace('<script src="/docs/save-transfer.js"></script>','<script>'+(ROOT/'docs/save-transfer.js').read_text()+'</script>')
  page.set_content(html);page.evaluate('ready')
  def upload(name='test.sav',data=b'\x12'*131088):
   page.locator('#save').set_input_files({'name':name,'mimeType':'application/octet-stream','buffer':data});page.wait_for_function('!transfer.busy')
  def message():return page.locator('#transfer-status').inner_text()
  def export():page.locator('#transfer-export').click();page.wait_for_function('!transfer.busy')
  try:
   if case==1:
    export();assert page.evaluate("logs.find(x=>x[0]==='share').slice(1)")==['PokemonStart--aaaaaaaaaaaa.sav',131088,True]
    assert page.evaluate('shared.arrayBuffer().then(b=>new Uint8Array(b).every(x=>x===7))');assert '同期完了' not in message()
   elif case==2:
    data=bytearray(6291472);data[-16:]=bytes(range(16));upload(data=bytes(data))
    assert '読み込みました' in message();assert page.evaluate('coreBytes.length')==6291472
    assert page.evaluate('Array.from(coreBytes.slice(-16))')==list(range(16))
    assert page.evaluate("records['handoff-before:'+gameInfo.key].bytes.byteLength")==131088
    assert page.evaluate('records[gameInfo.key].bytes.byteLength')==6291472
    assert page.evaluate("logs.filter(x=>x[0]==='write'||x[0]==='import').map(x=>x[0])")==['write','import','write']
   elif case==3:
    upload();assert 'キャンセル' in message();assert page.evaluate("logs.filter(x=>x[0]==='write'||x[0]==='import').length")==0
   elif case==4:
    upload('Pokemon--bbbbbbbbbbbb.sav');assert '識別子が一致しません' in message();assert page.evaluate('logs.length')==0
   elif case==5:
    for n,d in [('empty.sav',b''),('large.sav',b'\0'*6291473),('state.ss0',b'\0'*20)]:upload(n,d);assert '中止' in message()
    assert page.evaluate("logs.filter(x=>x[0]==='import').length")==0
   elif case==6:
    page.evaluate('window.failBackup=true');upload();assert 'backup unavailable' in message();assert page.evaluate('coreBytes[0]')==7
    assert page.evaluate("logs.filter(x=>x[0]==='import').length")==0
   elif case==7:
    page.evaluate('window.failPersist=true');upload();assert '読込前の通常セーブに戻しました' in message()
    assert page.evaluate('coreBytes.every(x=>x===7)');assert not page.locator('#transfer-backup').is_hidden()
   elif case==8:
    page.evaluate("window.shareMode='cancel'");export();assert 'キャンセル' in message();assert page.locator('#transfer-download').is_hidden()
   elif case==9:
    page.evaluate("window.shareMode='unsupported'");export();assert not page.locator('#transfer-download').is_hidden()
    with page.expect_download() as d:page.locator('#transfer-download').click()
    assert d.value.suggested_filename=='PokemonStart--aaaaaaaaaaaa.sav'
   elif case==10:
    page.evaluate('gameInfo.blocked=true');export();assert '処理中' in message();assert page.evaluate('logs.length')==0
   elif case==11:
    for w,h,c in [(390,844,1),(768,1024,2),(1024,768,2)]:
     page.set_viewport_size({'width':w,'height':h})
     info=page.evaluate("({over:document.documentElement.scrollWidth>innerWidth,cols:getComputedStyle(document.querySelector('.transfer-actions')).gridTemplateColumns.split(' ').length,h:document.querySelector('#transfer-import').getBoundingClientRect().height})")
     assert not info['over'] and info['cols']==c and info['h']>=44,info
     page.screenshot(path=str(ROOT/f'tests/layout-{w}.png'))
   elif case==12:
    upload();page.evaluate('transfer.onGame()');assert not page.locator('#transfer-backup').is_hidden()
    page.locator('#transfer-backup').click();page.wait_for_function('!transfer.busy');assert '-before-' in page.evaluate('shared.name');assert page.evaluate('shared.size')==131088
   assert not errors,errors
   results.append({'case':case,'result':'PASS'})
  except Exception as e:
   results.append({'case':case,'result':'FAIL','error':str(e),'message':message()})
  finally:ctx.close()
 browser.close()
print(json.dumps(results,ensure_ascii=False,indent=2))
raise SystemExit(any(r['result']=='FAIL' for r in results))
