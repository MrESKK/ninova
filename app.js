'use strict';
const books=window.LIBRARY_BOOKS.sort((a,b)=>a.title.localeCompare(b.title,'tr')),config=window.LIBRARY_CONFIG;
const $=id=>document.getElementById(id),norm=s=>s.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i');
let visible=books,genre='Tümü',current=0,lastFocus=null,drag=null,dragged=false;
const detail=$('detail'),rail=$('rail'),tooltip=$('tooltip'),recd=$('recommend-dialog');
function readPreference(key,fallback){try{return localStorage.getItem(key)||fallback;}catch{return fallback;}}
function savePreference(key,value){try{localStorage.setItem(key,value);}catch{}}
let lang=readPreference('ninova-language','tr');if(!['tr','en','es'].includes(lang))lang='tr';
let theme=readPreference('ninova-theme','light');if(!['light','dark'].includes(theme))theme='light';
const t=key=>window.NINOVA_TEXT[lang][key];
const genreName=g=>g==='Tümü'?t('all'):(t('genres')[g]||g);
const number=n=>n.toLocaleString(lang==='tr'?'tr-TR':lang==='es'?'es-ES':'en-US');
function updateFrame(){if(!config.recommendationsUrl||!recd.open)return;const url=new URL(config.recommendationsUrl);url.searchParams.set('lang',lang);url.searchParams.set('theme',theme);$('recommend-frame').src=url.href;}
function updateTheme(){document.documentElement.dataset.theme=theme;$('theme-label').textContent=t(theme==='dark'?'light':'dark');$('theme-toggle').setAttribute('aria-label',t(theme==='dark'?'light':'dark'));$('theme-toggle').setAttribute('title',t(theme==='dark'?'light':'dark'));$('theme-toggle').setAttribute('aria-pressed',theme==='dark');$('theme-toggle').firstElementChild.textContent=theme==='dark'?'☀':'☾';document.querySelector('meta[name=theme-color]').content=theme==='dark'?'#181b1e':'#e6e3da';}
function localize(){document.documentElement.lang=lang;document.querySelectorAll('[data-i18n]').forEach(el=>el.textContent=t(el.dataset.i18n));document.querySelectorAll('[data-i18n-aria]').forEach(el=>el.setAttribute('aria-label',t(el.dataset.i18nAria)));document.querySelectorAll('[data-i18n-placeholder]').forEach(el=>el.setAttribute('placeholder',t(el.dataset.i18nPlaceholder)));document.querySelectorAll('[data-i18n-title]').forEach(el=>el.title=t(el.dataset.i18nTitle));$('language').value=lang;$('total').textContent=`${books.length} ${t('books').toLocaleUpperCase(lang)}`;$('filters').querySelectorAll('button').forEach(btn=>{btn.firstChild.textContent=genreName(btn.dataset.genre);});updateTheme();welcome();if(recd.open&&!config.recommendationsUrl&&!config.email)$('recommend-status').textContent=t('unconfigured');}
$('theme-toggle').onclick=()=>{theme=theme==='dark'?'light':'dark';savePreference('ninova-theme',theme);updateTheme();updateFrame();};
$('language').onchange=e=>{lang=e.target.value;savePreference('ninova-language',lang);const oldScroll=rail.scrollLeft;localize();render();rail.scrollLeft=oldScroll;if(detail.open)openBook(current);updateFrame();};
let typingTimer;
function welcome(){clearInterval(typingTimer);const title=t('welcome');$('heading').setAttribute('aria-label',title);$('typed').textContent='';if(matchMedia('(prefers-reduced-motion: reduce)').matches){$('typed').textContent=title;return;}let i=0;typingTimer=setInterval(()=>{$('typed').textContent=title.slice(0,++i);if(i>=title.length)clearInterval(typingTimer);},65);}
function bookTitle(b){return b.titles?.[lang]||b.title;}
function coverRecord(b){return window.NINOVA_COVERS?.[b.id]?.[lang];}
function coverUrls(b){return coverRecord(b)?.urls||[b.covers?.[lang]||b.cover].filter(Boolean).map(url=>url.startsWith('https://')?url:'https://raw.githubusercontent.com/MrESKK/ninova/main/'+url);}
const unavailableCovers=new Set();
function coverPlaceholder(b){
 const escape=value=>String(value).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const words=bookTitle(b).split(' '),lines=[];let line='';
 for(const word of words){if((line+' '+word).trim().length>20&&line){lines.push(line);line=word;}else line=(line+' '+word).trim();}if(line)lines.push(line);
 const label=lines.slice(0,5).map((value,i)=>`<text x="125" y="${155+i*30}" text-anchor="middle" fill="#302b25" font-family="Georgia,serif" font-size="22">${escape(value)}</text>`).join('');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="250" height="400" viewBox="0 0 250 400"><rect width="250" height="400" fill="#e9e0ce"/><rect x="15" y="15" width="220" height="370" fill="none" stroke="#b9a891"/><text x="125" y="75" text-anchor="middle" font-family="Georgia,serif" font-size="16" fill="#78462c">Ninova</text>${label}<text x="125" y="355" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" fill="#766d62">${escape(b.author.slice(0,38))}</text></svg>`;
 return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
}
function setCoverImage(img,b,defer=false){
 const urls=[...new Set(coverUrls(b))];let index=0;
 img.decoding='async';img.referrerPolicy='no-referrer';
 function next(){
  while(index<urls.length&&unavailableCovers.has(urls[index]))index++;
  if(index<urls.length){const url=urls[index++];img.dataset.coverSource=url;img.src=url;}
  else{img.onerror=null;img.onload=null;img.dataset.coverSource='placeholder';img.src=coverPlaceholder(b);}
 }
 img.onerror=()=>{if(img.dataset.coverSource)unavailableCovers.add(img.dataset.coverSource);next();};
 img.onload=()=>{if(img.naturalWidth<30||img.naturalHeight<60){unavailableCovers.add(img.dataset.coverSource);next();}};
 if(defer)img._loadCover=next;else next();
}
// Covers outside the nearby shelf area wait until the user scrolls.
const coverObserver=new IntersectionObserver(entries=>{for(const entry of entries){if(!entry.isIntersecting)continue;const img=entry.target.querySelector('img');if(img?._loadCover){img._loadCover();delete img._loadCover;}coverObserver.unobserve(entry.target);}},{root:rail,rootMargin:'0px 350px'});

const counts={};books.forEach(b=>b.genres.forEach(g=>counts[g]=(counts[g]||0)+1));
['Tümü',...Object.keys(counts).sort((a,b)=>counts[b]-counts[a])].forEach(g=>{const btn=document.createElement('button');btn.textContent=genreName(g);const count=document.createElement('small');count.textContent=g==='Tümü'?books.length:counts[g];btn.append(count);btn.setAttribute('aria-pressed',g===genre);btn.onclick=()=>{genre=g;render();};btn.dataset.genre=g;$('filters').append(btn);});
function render(){coverObserver.disconnect();const q=norm($('query').value.trim());visible=books.filter(b=>(genre==='Tümü'||b.genres.includes(genre))&&norm([b.title,...Object.values(b.titles||{}),b.originalTitle||'',b.author,...b.genres,...b.genres.map(genreName)].join(' ')).includes(q));$('row').replaceChildren();$('filters').querySelectorAll('button').forEach(btn=>btn.setAttribute('aria-pressed',btn.dataset.genre===genre));$('results').textContent=`${visible.length} / ${books.length} ${t('books')}`;$('empty').hidden=!!visible.length;rail.hidden=!visible.length;tooltip.hidden=true;
visible.forEach((b,i)=>{const button=document.createElement('button');button.className='book';button.dataset.id=b.id;button.setAttribute('aria-label',`${bookTitle(b)}, ${b.author}. ${t('details')}`);const coverStyle=coverRecord(b)?.style||b.coverStyles?.[lang]||b;let seed=parseInt(b.id.slice(2,6),16),pages=b.pages||320;button.style.cssText=`--w:${Math.max(20,Math.min(54,pages*.047))}px;--h:${212+seed%35}px;--spine:${coverStyle.spine};--letter:${coverStyle.ink};--lean:${-(seed%35)/10}deg;--depth:${seed%13-6}px`;
const body=document.createElement('span');body.className='book-body';const spine=document.createElement('span');spine.className='spine';const title=document.createElement('span');title.className='spine-title';title.textContent=bookTitle(b);const mark=document.createElement('span');mark.className='spine-mark';mark.textContent='✦';const rule=document.createElement('span');rule.className='spine-rule';spine.append(title,mark,rule);const front=document.createElement('span');front.className='front';const img=document.createElement('img');img.alt='';setCoverImage(img,b,true);front.append(img);const pagesEl=document.createElement('span');pagesEl.className='pages';body.append(spine,front,pagesEl);button.append(body);button.onclick=()=>{if(!dragged)openBook(i,button);};button.onpointerenter=()=>showTip(b,button);button.onfocus=()=>showTip(b,button);button.onpointerleave=button.onblur=()=>tooltip.hidden=true;$('row').append(button);coverObserver.observe(button);});rail.scrollLeft=0;requestAnimationFrame(perspective);}
function showTip(b,button){if(drag||detail.open)return;tooltip.replaceChildren();const title=document.createElement('strong');title.textContent=bookTitle(b);const author=document.createElement('p');author.textContent=b.author;const meta=document.createElement('small');meta.textContent=[b.genres.map(genreName).join(' · '),b.pages?b.pages+' '+t('pages'):null,b.rating!==null?number(b.rating)+'/5':null].filter(Boolean).join(' · ');tooltip.append(title,author,meta);tooltip.hidden=false;const r=button.getBoundingClientRect();const left=Math.max(10,Math.min(innerWidth-tooltip.offsetWidth-10,r.left+r.width/2-tooltip.offsetWidth/2));tooltip.style.left=left+'px';tooltip.style.top=Math.max(10,r.top-tooltip.offsetHeight-30)+'px';}
let queued=false;function perspective(){queued=false;const rr=rail.getBoundingClientRect();$('row').classList.toggle('short',rail.scrollWidth<=rail.clientWidth+1);$('row').querySelectorAll('.book').forEach(btn=>{const r=btn.getBoundingClientRect(),t=Math.max(-1,Math.min(1,(r.left+r.width/2-rr.left-rr.width/2)/(rr.width/2)));btn.style.setProperty('--ry',`${-Math.sign(t)*Math.pow(Math.abs(t),1.35)*34}deg`);});$('left').disabled=rail.scrollLeft<=2;$('right').disabled=rail.scrollLeft>=rail.scrollWidth-rail.clientWidth-2;}
rail.addEventListener('scroll',()=>{tooltip.hidden=true;if(!queued){queued=true;requestAnimationFrame(perspective);}},{passive:true});new ResizeObserver(perspective).observe(rail);
rail.addEventListener('wheel',e=>{if(rail.scrollWidth<=rail.clientWidth)return;const d=Math.abs(e.deltaY)>Math.abs(e.deltaX)?e.deltaY:e.deltaX;const can=d>0?rail.scrollLeft<rail.scrollWidth-rail.clientWidth-1:rail.scrollLeft>1;if(can){e.preventDefault();rail.scrollLeft+=d;}},{passive:false});
rail.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'||e.button!==0)return;drag={x:e.clientX,scroll:rail.scrollLeft};dragged=false;});window.addEventListener('pointermove',e=>{if(!drag)return;if(Math.abs(e.clientX-drag.x)>6){dragged=true;rail.classList.add('dragging');tooltip.hidden=true;rail.scrollLeft=drag.scroll-(e.clientX-drag.x);}});window.addEventListener('pointerup',()=>{drag=null;rail.classList.remove('dragging');setTimeout(()=>dragged=false,0);});window.addEventListener('pointercancel',()=>{drag=null;rail.classList.remove('dragging');});
const scrollBy=d=>rail.scrollBy({left:d,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});$('left').onclick=()=>scrollBy(-350);$('right').onclick=()=>scrollBy(350);rail.onkeydown=e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();scrollBy(e.key==='ArrowRight'?350:-350);}};$('query').oninput=render;
function openBook(i,trigger){current=i;if(!detail.open){lastFocus=trigger||document.activeElement;detail.showModal();}tooltip.hidden=true;const b=visible[i];$('detail-title').textContent=bookTitle(b);$('detail-author').textContent=b.author;$('detail-genre').textContent=b.genres.map(genreName).join(' · ');$('detail-meta').textContent=b.pages?`${b.pages} ${t('pages').toLocaleUpperCase(lang)}`:t('unknownPages');const rating=$('detail-rating');rating.replaceChildren();rating.textContent=b.rating!==null?'★'.repeat(Math.floor(b.rating))+(b.rating%1?'½':''):'';const rt=document.createElement('span');rt.textContent=b.rating!==null?`${number(b.rating)} / 5 · ${t('myRating')}`:t('unknownRating');rating.append(rt);const img=document.createElement('img');img.alt=bookTitle(b)+' '+t('cover');setCoverImage(img,b);$('detail-cover').replaceChildren(img);$('prev').disabled=i===0;$('next').disabled=i===visible.length-1;}
$('prev').onclick=()=>current>0&&openBook(current-1);$('next').onclick=()=>current<visible.length-1&&openBook(current+1);$('close-detail').onclick=$('shelve').onclick=()=>detail.close();detail.addEventListener('close',()=>lastFocus?.focus());detail.addEventListener('keydown',e=>{if(e.key==='ArrowRight'){e.preventDefault();$('next').click();}if(e.key==='ArrowLeft'){e.preventDefault();$('prev').click();}});
// Touch shortcuts apply only inside the open book dialog; the shelf is unchanged.
let bookTouch=null;
const detailLayout=detail.querySelector('.detail-layout');
function resetBookTouch(){bookTouch=null;detailLayout.style.transform='';detailLayout.style.opacity='';}
detail.addEventListener('touchstart',e=>{
 resetBookTouch();
 if(!detail.open||e.touches.length!==1||e.target.closest('button,a,input,select,textarea'))return;
 const touch=e.touches[0],bounds=detail.getBoundingClientRect();
 if(touch.clientX<bounds.left||touch.clientX>bounds.right||touch.clientY<bounds.top||touch.clientY>bounds.bottom)return;
 bookTouch={id:touch.identifier,x:touch.clientX,y:touch.clientY,time:performance.now(),atTop:detail.scrollTop<=1,axis:null};
},{passive:true});
detail.addEventListener('touchmove',e=>{
 if(!bookTouch)return;
 if(e.touches.length!==1){resetBookTouch();return;}
 const touch=Array.from(e.touches).find(t=>t.identifier===bookTouch.id);if(!touch){resetBookTouch();return;}
 const dx=touch.clientX-bookTouch.x,dy=touch.clientY-bookTouch.y;
 if(!bookTouch.axis){
  if(Math.max(Math.abs(dx),Math.abs(dy))<12)return;
  if(Math.abs(dx)>Math.abs(dy)*1.25)bookTouch.axis='horizontal';
  else if(Math.abs(dy)>Math.abs(dx)*1.25)bookTouch.axis=dy>0&&bookTouch.atTop?'dismiss':'scroll';
  else return;
 }
 if(bookTouch.axis==='scroll')return;
 if(e.cancelable)e.preventDefault();
 if(bookTouch.axis==='horizontal'){
  const canMove=dx>0?current>0:current<visible.length-1;
  detailLayout.style.transform=`translateX(${Math.max(-80,Math.min(80,dx*(canMove ? .35 : .1)))}px)`;
 }else detailLayout.style.transform=`translateY(${Math.max(0,Math.min(100,dy*.4))}px)`;
 detailLayout.style.opacity=String(1-Math.min(.2,Math.abs(bookTouch.axis==='horizontal'?dx:dy)/800));
},{passive:false});
detail.addEventListener('touchend',e=>{
 if(!bookTouch)return;
 const state=bookTouch,touch=Array.from(e.changedTouches).find(t=>t.identifier===state.id);
 resetBookTouch();if(!touch||!detail.open||performance.now()-state.time>1200)return;
 const dx=touch.clientX-state.x,dy=touch.clientY-state.y;
 if(state.axis==='horizontal'&&Math.abs(dx)>=60&&Math.abs(dx)>Math.abs(dy)*1.35){
  const next=current+(dx>0?-1:1);
  if(next<0||next>=visible.length)return;
  openBook(next);detail.scrollTop=0;
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches)detailLayout.animate([{transform:`translateX(${dx>0?-20:20}px)`,opacity:.8},{transform:'translateX(0)',opacity:1}],{duration:180,easing:'ease-out'});
 }else if(state.axis==='dismiss'&&state.atTop&&dy>=100&&dy>Math.abs(dx)*1.5)detail.close();
},{passive:true});
detail.addEventListener('touchcancel',resetBookTouch,{passive:true});
detail.addEventListener('close',resetBookTouch);
[detail,recd].forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
$('recommend').onclick=()=>{recd.showModal();$('send').disabled=false;$('mail-hint').hidden=false;$('recommend-status').textContent='';if(config.recommendationsUrl){$('recommend-form').hidden=true;$('recommend-frame').hidden=false;updateFrame();}else if(!config.email){$('send').disabled=true;$('mail-hint').hidden=true;$('recommend-status').textContent=t('unconfigured');}};$('close-recommend').onclick=()=>recd.close();$('recommend-form').onsubmit=e=>{e.preventDefault();if(!config.email)return;const d=Object.fromEntries(new FormData(e.target));const subject=t('mailSubject')+': '+d.title;const body=`${t('recommender')}: ${d.name}\n${t('bookTitle')}: ${d.title}\n${t('author')}: ${d.author}\n\n${d.note}`;location.href=`mailto:${encodeURIComponent(config.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;$('recommend-status').textContent=t('draftStatus');};localize();render();
