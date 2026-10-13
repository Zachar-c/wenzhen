// Latest M2 GU audit wall: compatibility branch uses the real current GU array.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const dir='artifacts/m2-visual-pass';fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080},reducedMotion:'reduce'});
 await page.goto(new URL('../m2.html',import.meta.url).href);
 const result=await page.evaluate(()=>{
  const escape=s=>String(s).replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
  document.documentElement.style.cssText='height:auto;overflow:auto';
  document.body.style.cssText='height:auto;overflow:auto;display:block';
  const app=document.querySelector('#app');app.style.cssText='height:auto;max-height:none;overflow:visible';
  app.innerHTML='<h2>现役蛊虫视觉覆盖 · '+GU.length+' 只</h2><div class="grid m2-r9-audit">'+GU.map(g=>'<div class="shopitem card"><div class="name">'+escape(g.name)+'</div><div class="meta">'+escape(g.id)+' / '+escape(g.kind)+'</div><div class="offer-hint">'+escape(g.description)+'</div></div>').join('')+'</div>';
  return GU.map(g=>g.id);
 });
 await page.addStyleTag({content:'.m2-r9-audit{grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}.m2-r9-audit>.shopitem{min-height:190px}'});
 await page.waitForFunction(n=>document.querySelectorAll('.m2-r9-audit .shopitem[data-gu-painted]').length===n,result.length);
 const items=await page.locator('.m2-r9-audit .shopitem[data-gu-painted]').evaluateAll(els=>els.map(el=>({id:el.dataset.guPainted,bg:el.querySelector('.m2-gu-illustration')?.style.backgroundImage})));
 assert.ok(result.length>=29,'latest M2 should have 29 active Gu before approving full-art count');
 assert.equal(items.length,result.length);
 assert.equal(new Set(items.map(i=>i.id)).size,result.length,'all real IDs must map uniquely');
 assert.equal(items.every(i=>i.bg&&i.bg.includes('url(')),true,'all Gu must draw an illustration or SVG fallback');
 assert.equal(new Set(items.map(i=>i.bg)).size,result.length,'no two Gu may have identical asset presentation');
 await page.screenshot({path:dir+'/09_live_gu_latest_m2_1920x1080.png',fullPage:true});
 console.log('M2_VISUAL_LIVE_GU_OK '+result.length+' real IDs');
}finally{await browser.close()}
