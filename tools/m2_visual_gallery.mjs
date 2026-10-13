// Browser-rendered audit wall: 26 actual M2 Gu IDs, not a fictional card list.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const output='artifacts/m2-visual-pass';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1,reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(new URL('../m2.html',import.meta.url).href);
 await page.evaluate(()=>{
  const escValue=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  document.body.removeAttribute('data-prep-tab');
  const cards=GU.map(g=>'<div class="shopitem card"><div class="name">'+escValue(g.name)+'</div><div class="meta">'+escValue(g.school)+' · '+escValue(g.kind)+'</div><div class="offer-hint">'+escValue(g.description)+'</div><div class="gold">'+escValue(g.id)+'</div></div>').join('');
  document.querySelector('#app').innerHTML='<h2>美术验收 · '+GU.length+' 只现役蛊</h2><p>七只匹配插画候选，其余使用可追溯 SVG；以下图集仅为测试专用渲染。</p><div class="grid m2-gallery">'+cards+'</div>';
  document.documentElement.style.cssText+='height:auto;overflow:auto';
  document.body.style.cssText+='height:auto;display:block;overflow:auto';
  document.querySelector('#app').style.cssText+='height:auto;max-height:none;overflow:visible';
 });
 await page.addStyleTag({content:'.m2-gallery{grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}.m2-gallery .shopitem{min-height:190px;grid-template-columns:96px minmax(0,1fr)}.m2-gallery .shopitem>.m2-gu-illustration{width:96px;min-height:120px}.m2-gallery .shopitem .name{font-size:16px}.m2-gallery .offer-hint{font-size:11px}.m2-gallery .shopitem .meta{font-size:12px}'});
 const total=await page.evaluate(()=>GU.length);
 await page.waitForFunction(expected=>document.querySelectorAll('.m2-gallery .shopitem[data-gu-painted]').length===expected,total);
 assert.equal(await page.locator('.m2-gallery .m2-r8-gu-painted').count(),7,'seven genuine Gu illustration matches');
 const names=await page.locator('.m2-gallery .shopitem[data-gu-painted]').evaluateAll(nodes=>nodes.map(n=>n.dataset.guPainted));
 assert.equal(new Set(names).size,total);
 const atlasGood=await page.evaluate(()=>Promise.all(['assets/visual/m2_r8_character_atlas.webp','assets/visual/m2_r8_gu_atlas.webp'].map(src=>new Promise(ok=>{let image=new Image();image.onload=()=>ok(image.naturalWidth>0);image.onerror=()=>ok(false);image.src=src}))));
 assert.deepEqual(atlasGood,[true,true],'both painterly art files must decode offline');
 await page.screenshot({path:output+'/07_gu_catalog_real_chromium_1920x1080.png',fullPage:true});
 assert.deepEqual(errors,[],'gallery JS errors');
 console.log('M2_ART_GALLERY_OK '+names.length+' current Gu, 7 painted, 2 decoded atlases');
}finally{await browser.close()}
