"""Rendered layout tests, not a ROM/iCloud test.
Fixture reproduces the pinned upstream DOM's layout and conflicting CSS rules.
Run: python tests/test_viewport.py (Playwright + Chromium installed separately).
"""
from pathlib import Path
import json,os,re
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
REPORT=ROOT/'tests/viewport-results.json'
FIT_CSS=(ROOT/'docs/viewport-fit.css').read_text()
FIT_JS=(ROOT/'docs/viewport-fit.js').read_text()
BASE_CSS=(ROOT/'tests/fixtures/upstream-layout.css').read_text()
FIXTURE=(ROOT/'tests/fixtures/viewport.html').read_text()
MATRIX=[(320,568),(568,320),(375,667),(667,375),(393,852),(852,393),(430,932),(932,430),(744,1133),(1133,744),(768,1024),(1024,768),(820,1180),(1180,820),(393,650),(852,280),(507,768),(768,507)]
MEASURE='''()=>{
 const visible=e=>e.getClientRects().length&&!e.hidden&&!(e.closest('details:not([open])')&&e.tagName!=='SUMMARY');
 const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};
 const safe={t:parseFloat(getComputedStyle(document.body).paddingTop),r:parseFloat(getComputedStyle(document.body).paddingRight),b:parseFloat(getComputedStyle(document.body).paddingBottom),l:parseFloat(getComputedStyle(document.body).paddingLeft)};
 const bad=[],buttons=[...document.querySelectorAll('.gamepad button,.emulator-toolbar button,.emulator-toolbar summary')].filter(visible);
 const screen=box(document.querySelector('#screen'));
 const aspect=240/160,ih=Math.min(screen.h,screen.w/aspect),iw=ih*aspect;
 const image={x:screen.x+(screen.w-iw)/2,y:screen.y+(screen.h-ih)/2,w:iw,h:ih};
 const overlay=document.querySelector('.play').classList.contains('overlay');
 for(const e of buttons){const r=box(e),hit=document.elementFromPoint(r.x+r.w/2,r.y+r.h/2);
  if(r.x<safe.l-.5||r.y<safe.t-.5||r.right>innerWidth-safe.r+.5||r.bottom>innerHeight-safe.b+.5||(!e.contains(hit)&&hit!==e))bad.push({text:e.textContent,r,hit:hit?.id||hit?.className});
  if(!overlay&&e.closest('.gamepad')&&Math.min(r.right,image.x+image.w)-Math.max(r.x,image.x)>1&&Math.min(r.bottom,image.y+image.h)-Math.max(r.y,image.y)>1)bad.push({text:e.textContent,error:'game obscured'});
 }
 return {viewport:[innerWidth,innerHeight],bad,buttons:buttons.length,screen,image,document:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],scroll:[scrollX,scrollY]};
}'''
def markup():
 return FIXTURE.replace('</head>','<style>'+BASE_CSS+FIT_CSS+'</style></head>').replace('</body>','<script>'+FIT_JS+'</script></body>')
results=[]
def record(name,fn):
 try:fn();results.append({'name':name,'result':'PASS'})
 except Exception as e:results.append({'name':name,'result':'FAIL','error':str(e)})
 print(name,results[-1]['result'],results[-1].get('error',''),flush=True)
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':393,'height':852},has_touch=True)
 page.set_default_timeout(1800)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('about:blank');page.set_content(markup())
 def verify(w,h,safe=False):
  page.set_viewport_size({'width':w,'height':h})
  insets=[59,0,34,0] if h>w else [0,59,21,59]
  page.evaluate('(values)=>{["t","r","b","l"].forEach((s,i)=>document.documentElement.style.setProperty("--cp-safe-"+s,values[i]+"px"));}',insets if safe else [0]*4)
  page.wait_for_timeout(90)
  result=page.evaluate(MEASURE)
  assert not result['bad'],result
  assert result['buttons']==20,result['buttons']
  assert result['document']==[w,h],result
  assert result['image']['w']>100 and result['image']['h']>60,result
  page.mouse.wheel(900,900);page.wait_for_timeout(30)
  assert page.evaluate('[scrollX,scrollY]')==[0,0]
  assert not errors,errors
 for w,h in MATRIX:record(f'game + live rotation {w}x{h}',lambda w=w,h=h:verify(w,h))
 for w,h in [(393,852),(852,393),(744,1133),(1133,744)]:record(f'safe-area simulation {w}x{h}',lambda w=w,h=h:verify(w,h,True))
 def fullscreen(w,h):
  page.evaluate('document.body.classList.add("expanded");document.querySelector(".play").classList.add("immersive")')
  try:verify(w,h,True)
  finally:page.evaluate('document.body.classList.remove("expanded");document.querySelector(".play").classList.remove("immersive")')
 for w,h in [(393,852),(852,393),(744,1133),(1133,744)]:record(f'fullscreen with safe-area {w}x{h}',lambda w=w,h=h:fullscreen(w,h))
 def overlay():
  page.set_viewport_size({'width':393,'height':852});page.evaluate('document.querySelector(".play").classList.add("overlay")')
  page.evaluate('''()=>{let els=document.querySelectorAll('.gamepad .dpad,.gamepad .ab,.gamepad .shoulder-l,.gamepad .shoulder-r,.gamepad .system');els.forEach((e,i)=>{e.style.left=(i%2?95:5)+'%';e.style.top=(i%2?95:5)+'%'});}''')
  page.set_viewport_size({'width':852,'height':393});page.wait_for_timeout(100)
  # User-made overlapping controls are not rearranged; only their viewport bounds are constrained.
  data=page.evaluate('''()=>{let b=document.querySelector('.gamepad').getBoundingClientRect();return [...document.querySelectorAll('.gamepad .dpad,.gamepad .ab,.gamepad .shoulder-l,.gamepad .shoulder-r,.gamepad .system')].every(e=>{let r=e.getBoundingClientRect();return r.left>=b.left-.5&&r.right<=b.right+.5&&r.top>=b.top-.5&&r.bottom<=b.bottom+.5})}''')
  assert data
 record('saved overlay coordinates clamped after rotation',overlay)
 # Fresh DOM for pager tests (same selectors and a late-initialized share panel).
 page.set_viewport_size({'width':852,'height':393});page.goto('about:blank');page.set_content(markup());page.wait_for_timeout(80)
 page.evaluate('''()=>{const s=document.createElement('section');s.id='celio-transfer';s.innerHTML='<h3>iPhone・iPadでセーブを共有</h3><p>通常セーブを受け渡します。</p><div class="transfer-actions"><button id="transfer-import">iCloud Driveから読込</button><button id="transfer-export">iCloud Driveへ書出</button></div><details open><summary>注意事項</summary>'+('<p>書き出し・反映確認・読み込みの順で切り替えてください。2台で同時に進めないでください。</p>'.repeat(16))+'</details><button id="end-marker">最後の操作</button>';s.querySelector('#end-marker').onclick=()=>window.pagerClicked=true;document.getElementById('panel-save').prepend(s)}''')
 def paging(w,h):
  page.set_viewport_size({'width':w,'height':h});page.locator('#file-menu-open').click();page.wait_for_timeout(100)
  selector=page.locator('.cp-section-select select').first
  selector.select_option('general');selector.select_option('save');page.wait_for_timeout(100)
  seen=set()
  for i in range(80):
   values=page.evaluate('''()=>{const w=document.querySelector('#panel-save .cp-pages-window').getBoundingClientRect();return [...document.querySelectorAll('#panel-save .cp-pages-content button')].filter(e=>{let r=e.getBoundingClientRect();return r.width&&r.x>=w.x-.5&&r.right<=w.right+.5&&r.y>=w.y-.5&&r.bottom<=w.bottom+.5}).map(e=>e.id)}''')
   seen.update(values)
   if 'end-marker' in values:page.locator('#end-marker').click()
   nxt=page.locator('#panel-save .cp-page-nav button').last
   if nxt.is_disabled():break
   nxt.click();page.wait_for_timeout(30)
  assert {'transfer-import','transfer-export','end-marker','export','import'}<=seen,seen
  assert page.evaluate('window.pagerClicked===true')
  assert page.evaluate('[document.documentElement.scrollWidth,document.documentElement.scrollHeight]')==[w,h]
  assert page.evaluate('[...document.querySelectorAll(".cp-pages-window")].every(e=>e.scrollLeft===0&&e.scrollTop===0)')
  selector.select_option('memory');page.wait_for_timeout(60)
  assert page.locator('#panel-memory').is_visible()
  page.locator('#settings-close').click()
 for w,h in [(393,852),(852,393),(744,1133),(1133,744)]:record(f'no-scroll settings, late iCloud controls, memory {w}x{h}',lambda w=w,h=h:paging(w,h))
 def startup():
  page.set_viewport_size({'width':568,'height':320});page.goto('about:blank');page.set_content(markup());page.evaluate('document.querySelector(".play").classList.remove("has-rom")');page.wait_for_timeout(100)
  for sel in ['#welcome-open','#rom-library-open']:
   r=page.locator(sel).bounding_box();assert r and r['y']>=0 and r['y']+r['height']<=320,r
  assert page.evaluate('[document.documentElement.scrollWidth,document.documentElement.scrollHeight]')==[568,320]
 record('ROM selection screen before game load',startup)
 # Actual installer HTML/CSS, with network/bootstrap scripts replaced only in the test harness.
 installer=(ROOT/'docs/index.html').read_text()
 installer=re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]*>','',installer)
 installer=re.sub(r'<script[^>]*src="[^"]+"[^>]*></script>','',installer)
 installer=re.sub(r'<link[^>]*>','',installer)
 installer=installer.replace('</head>','<style>'+(ROOT/'docs/install.css').read_text()+FIT_CSS+'</style></head>').replace('</body>','<script>'+FIT_JS+'</script></body>')
 def installation(w,h):
  page.goto('about:blank');page.set_viewport_size({'width':w,'height':h});page.set_content(installer);page.wait_for_timeout(80)
  assert page.evaluate('document.documentElement.classList.contains("cp-install")')
  for sel in ['#install','#check','footer button:first-child','footer button:last-child']:
   r=page.locator(sel).bounding_box();assert r and r['x']>=0 and r['y']>=0 and r['x']+r['width']<=w+.5 and r['y']+r['height']<=h+.5,(sel,r)
  assert page.evaluate('[document.documentElement.scrollWidth,document.documentElement.scrollHeight]')==[w,h]
  page.locator('footer button').first.click();page.wait_for_timeout(70)
  for option in ['0','1','2']:
   page.locator('.cp-dialog select').select_option(option);page.wait_for_timeout(70)
   assert page.locator('.cp-dialog>.cp-pages:visible').count()==1
   assert page.locator('.cp-dialog>.cp-pages:visible output').inner_text().startswith('1 /')
  page.locator('.cp-dialog .dialog-head button').click()
  # Long errors remain available via an explicit details page, even on a short landscape viewport.
  page.evaluate('document.getElementById("status").textContent="保存できませんでした。".repeat(15)')
  page.locator('footer button').last.click();page.wait_for_timeout(70)
  assert '保存できませんでした' in page.locator('.cp-dialog>.cp-pages:visible').inner_text()
  assert page.evaluate('[document.documentElement.scrollWidth,document.documentElement.scrollHeight]')==[w,h]
  assert not errors,errors
 for w,h in [(393,852),(852,393),(744,1133),(1133,744),(320,568),(568,320),(852,280)]:record(f'installer, instructions and status pages {w}x{h}',lambda w=w,h=h:installation(w,h))
 browser.close()
REPORT.write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(results,ensure_ascii=False,indent=2))
print(f"{sum(r['result']=='PASS' for r in results)}/{len(results)} passed")
raise SystemExit(any(r['result']=='FAIL' for r in results))
