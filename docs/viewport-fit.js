/* MPL-2.0. Layout only: no ROM, save, storage, or network access. */
(()=>{'use strict';
  const root=document.documentElement,pages=new Map();
  let frame=0,play=null,settings=null,sectionSelect=null,lastPanel=null;
  const $=id=>document.getElementById(id);
  function style(el,key,value){if(el.style.getPropertyValue(key)!==value)el.style.setProperty(key,value);}
  function request(){if(!frame)frame=requestAnimationFrame(fit);}
  function button(text,action){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=action;return b;}
  function paged(section){
    if(pages.has(section))return pages.get(section);
    const windowEl=document.createElement('div'),content=document.createElement('div'),nav=document.createElement('nav');
    windowEl.className='cp-pages-window';content.className='cp-pages-content';nav.className='cp-page-nav';
    nav.setAttribute('aria-label','設定ページの切り替え');
    const state={section,windowEl,content,nav,index:0,count:1,span:0};
    const prev=button('前へ',()=>show(state,state.index-1)),next=button('次へ',()=>show(state,state.index+1)),output=document.createElement('output');
    prev.setAttribute('aria-label','前のページ');next.setAttribute('aria-label','次のページ');output.setAttribute('aria-live','polite');
    Object.assign(state,{prev,next,output});
    while(section.firstChild)content.append(section.firstChild);
    windowEl.append(content);nav.append(prev,output,next);section.append(windowEl,nav);section.classList.add('cp-pages');pages.set(section,state);
    new MutationObserver(request).observe(content,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['hidden','open']});
    new ResizeObserver(request).observe(windowEl);
    section.addEventListener('toggle',request,true);
    section.addEventListener('focusin',e=>{
      if(!content.contains(e.target)||!state.span)return;
      windowEl.scrollLeft=windowEl.scrollTop=0;
      const r=e.target.getBoundingClientRect(),w=windowEl.getBoundingClientRect();
      const page=Math.floor((r.left-w.left+state.index*state.span+1)/state.span);
      show(state,page);windowEl.scrollLeft=windowEl.scrollTop=0;
    });
    return state;
  }
  function show(state,index){
    state.index=Math.max(0,Math.min(state.count-1,index));
    style(state.content,'transform',`translateX(${-state.index*state.span}px)`);
    state.prev.disabled=state.index===0;state.next.disabled=state.index===state.count-1;
    const label=`${state.index+1} / ${state.count}`;if(state.output.textContent!==label)state.output.textContent=label;
    state.windowEl.scrollLeft=state.windowEl.scrollTop=0;
  }
  function measure(state){
    const {section,windowEl,content,nav}=state;
    // Upstream modules may prepend controls after WASM initialization. Keep their DOM nodes/handlers.
    const nodes=[...section.childNodes],anchor=content.firstChild;let before=true;
    for(const node of nodes){
      if(node===windowEl){before=false;continue;}if(node===nav)continue;
      if(before)content.insertBefore(node,anchor);else content.append(node);
    }
    const width=windowEl.clientWidth,height=windowEl.clientHeight;
    if(!width||!height)return;
    style(content,'--cp-page-w',width+'px');state.span=width+24;
    state.count=Math.max(1,Math.ceil((content.scrollWidth+24-1)/state.span));
    show(state,state.index);
  }
  function activate(name){
    for(const tab of settings.querySelectorAll(':scope>.tabs [data-tab]')){
      const active=tab.dataset.tab===name;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;
      const panel=$('panel-'+tab.dataset.tab);if(panel)panel.hidden=!active;
    }
    request();
  }
  function prepareSettings(){
    settings=$('settings');if(!settings)return;
    const tabs=settings.querySelector(':scope>.tabs');
    const memory=document.querySelector('.memory-panel');
    if(memory&&tabs){
      const section=document.createElement('section');section.id='panel-memory';section.setAttribute('role','tabpanel');section.hidden=true;
      section.append(memory);settings.append(section);
      const tab=button('メモリ',()=>activate('memory'));tab.id='tab-memory';tab.dataset.tab='memory';tab.setAttribute('aria-selected','false');tabs.append(tab);
    }
    const label=document.createElement('label');label.className='cp-section-select';label.append(document.createTextNode('項目'));
    sectionSelect=document.createElement('select');sectionSelect.setAttribute('aria-label','設定項目');
    for(const tab of settings.querySelectorAll(':scope>.tabs [data-tab]')){
      // The offline build has no link transport; do not add its hidden tabs to the selector.
      if(['celio','link'].includes(tab.dataset.tab))continue;
      sectionSelect.add(new Option(tab.textContent.trim(),tab.dataset.tab));
    }
    sectionSelect.onchange=()=>activate(sectionSelect.value);label.append(sectionSelect);settings.append(label);
    for(const section of settings.querySelectorAll(':scope>[role=tabpanel]'))paged(section);
    new MutationObserver(request).observe(settings,{subtree:true,childList:true,attributes:true,attributeFilter:['open','hidden','aria-selected']});
  }
  function prepareInstaller(){
    const main=document.querySelector('body>main');if(!main||play)return;
    root.classList.add('cp-install');
    const steps=main.querySelector(':scope>.steps'),notes=main.querySelector(':scope>details'),footer=main.querySelector(':scope>footer');
    if(!steps||!notes||!footer)return;
    const dialog=document.createElement('dialog');dialog.className='cp-dialog';dialog.setAttribute('aria-label','使い方と注意事項');
    const head=document.createElement('div');head.className='dialog-head';
    const title=document.createElement('h2');title.textContent='使い方・注意事項';head.append(title,button('閉じる',()=>dialog.close()));
    const label=document.createElement('label');label.className='cp-section-select';label.textContent='項目';
    const select=document.createElement('select');select.setAttribute('aria-label','案内の項目');select.add(new Option('使い方','0'));select.add(new Option('安全性・バックアップ','1'));label.append(select);
    const sections=[steps,notes].map(node=>{const s=document.createElement('section');s.append(node);dialog.append(s);paged(s);return s;});
    const statusSection=document.createElement('section'),statusTitle=document.createElement('h3');statusTitle.textContent='保存状況の詳細';statusSection.append(statusTitle);
    for(const id of ['status','meta']){const source=$(id),copy=document.createElement('p');statusSection.append(copy);const update=()=>{copy.textContent=source.textContent;};update();new MutationObserver(update).observe(source,{subtree:true,childList:true,characterData:true});}
    dialog.append(statusSection);paged(statusSection);sections.push(statusSection);select.add(new Option('保存状況','2'));
    notes.open=true;
    const intro=main.querySelector('.hero>p:last-child');if(intro)sections[0].querySelector('.cp-pages-content').prepend(intro.cloneNode(true));
    select.onchange=()=>{sections.forEach((s,i)=>s.hidden=i!==Number(select.value));request();};select.onchange();
    dialog.prepend(head,label);document.body.append(dialog);
    footer.replaceChildren(button('使い方・注意事項',()=>{select.value='0';select.onchange();dialog.showModal();request();}),button('状態の詳細',()=>{select.value='2';select.onchange();dialog.showModal();request();}));
    new MutationObserver(request).observe(dialog,{attributes:true,attributeFilter:['open']});
  }
  function fit(){
    frame=0;
    const vv=window.visualViewport;
    // Keep pinch zoom available. Do not resize the layout while the user magnifies it.
    if(!vv||Math.abs(vv.scale-1)<.02){
      style(root,'--cp-vh',Math.round(vv?.height||innerHeight)+'px');
      style(root,'--cp-vw',Math.round(vv?.width||innerWidth)+'px');
      style(root,'--cp-top',(vv?.offsetTop||0)+'px');style(root,'--cp-left',(vv?.offsetLeft||0)+'px');
    }
    if(play){
      const toolbar=play.querySelector('.emulator-toolbar');
      style(play,'--cp-tools',Math.ceil(toolbar?.getBoundingClientRect().height||0)+'px');
      if(play.classList.contains('overlay')){
        const pad=play.querySelector('.gamepad'),bounds=pad?.getBoundingClientRect();
        if(bounds&&bounds.height>0)for(const el of pad.querySelectorAll('.dpad,.ab,.shoulder-l,.shoulder-r,.system')){
          const r=el.getBoundingClientRect();
          const dx=r.left<bounds.left+3?bounds.left+3-r.left:r.right>bounds.right-3?bounds.right-3-r.right:0;
          const dy=r.top<bounds.top+3?bounds.top+3-r.top:r.bottom>bounds.bottom-3?bounds.bottom-3-r.bottom:0;
          if(dx)el.style.left=(r.left+r.width/2-bounds.left+dx)+'px';
          if(dy)el.style.top=(r.top+r.height/2-bounds.top+dy)+'px';
        }
      }
    }
    if(settings?.open){
      const current=[...settings.querySelectorAll(':scope>[role=tabpanel]')].find(el=>!el.hidden);
      if(current){sectionSelect.value=current.id.replace('panel-','');if(current!==lastPanel){const p=pages.get(current);if(p)p.index=0;lastPanel=current;}}
    }
    for(const state of pages.values())measure(state);
  }
  function start(){
    root.classList.add('cp-fit');play=document.querySelector('.app-shell > .play');root.classList.toggle('cp-game',!!play);
    prepareSettings();prepareInstaller();
    if(play){
      const observer=new ResizeObserver(request);observer.observe(play);const bar=play.querySelector('.emulator-toolbar');if(bar)observer.observe(bar);
      new MutationObserver(request).observe(play,{attributes:true,attributeFilter:['class']});
      document.addEventListener('pointerup',request);
    }
    addEventListener('resize',request);addEventListener('orientationchange',request);addEventListener('pageshow',request);
    window.visualViewport?.addEventListener('resize',request);window.visualViewport?.addEventListener('scroll',request);
    document.addEventListener('touchmove',e=>{if(e.cancelable&&e.target.closest?.('.play')&&!e.target.closest?.('dialog,input,textarea,select'))e.preventDefault();},{passive:false});
    request();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
