// Visual evidence contract: true Chromium captures, no screenshots synthesized from HTML.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const dir='artifacts/m2-visual-pass';fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const sizes=[['1280x720',1280,720],['1366x768',1366,768],['1920x1080',1920,1080],['390x844',390,844]];
const findings=[];
try{
 for(const [key,width,height] of sizes){
  const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce'});
  const page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(new URL('../m2.html',import.meta.url).href);
  await page.screenshot({path:`${dir}/01_dao_${key}.png`});
  await page.getByRole('button',{name:'选择道途'}).first().click();
  await page.locator('.shopitem .m2-gu-illustration').first().waitFor();
  await page.screenshot({path:`${dir}/02_shop_${key}.png`});
  const painted=await page.locator('.shopitem>.m2-gu-illustration').count();
  assert.equal(painted,4,'all shop offers must carry generated illustrations');
  const artwork=await page.locator('.shopitem>.m2-gu-illustration').evaluateAll(nodes=>nodes.map(n=>n.style.backgroundImage));
  assert.equal(new Set(artwork).size,4,'four offers must use distinct Gu artworks');
  await page.getByRole('tab',{name:/构筑 · 蛊仓/}).click();
  await page.screenshot({path:`${dir}/03_inventory_${key}.png`});
  if(width===1366){
   await page.evaluate(()=>{while(state.gu.length<12)state.gu.push(owned('B101'));save();render()});
   await page.getByRole('tab',{name:/构筑 · 蛊仓/}).click();
   await page.screenshot({path:`${dir}/04_inventory_full_${key}.png`});
   assert.equal(await page.locator('.slot>.m2-gu-illustration').count()>=12,true,'inventory art must cover 12 slots');
   const last=page.getByRole('button',{name:'装备'}).last();await last.scrollIntoViewIfNeeded();
   assert.equal(await last.isVisible(),true);
  }
  if(width===1366){await page.reload();await page.getByRole('tab',{name:/交易 · 商店/}).click()}
  await page.getByRole('button',{name:/迎战/}).click();
  await page.locator('.player-figure[data-portrait]').waitFor();
  assert.equal(await page.locator('.battle-gu>.m2-gu-illustration').count()>0,true,'battle cards must be painted');
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:`${dir}/05_battle_${key}.png`});
  if(width<600){
   const arena=await page.locator('.combat-stage').boundingBox();
   assert.ok(arena&&arena.y<height&&arena.y+arena.height>0,`mobile battle stage should intersect viewport: ${JSON.stringify(arena)}`);
  }
  await page.getByRole('button',{name:'立即结算'}).click();
  if(await page.locator('.spoils-panel').count()){
   await page.evaluate(()=>window.scrollTo(0,0));
   await page.screenshot({path:`${dir}/06_spoils_${key}.png`});
  }
  const metrics=await page.evaluate(()=>({scrollW:document.documentElement.scrollWidth,innerW:innerWidth,scrollH:document.documentElement.scrollHeight,innerH:innerHeight,portrait:!!document.querySelector('.player-figure[data-portrait]')}));
  assert.equal(metrics.scrollW<=metrics.innerW+2,true,`${key} no horizontal overflow`);
  if(width>=1000)assert.equal(metrics.scrollH<=metrics.innerH+2,true,`${key} no desktop document scroll`);
  assert.deepEqual(errors,[],`${key} page errors`);
  findings.push({size:key,painted,metrics,errors});
  await ctx.close();
 }
 fs.writeFileSync(dir+'/report.json',JSON.stringify(findings,null,2));
 console.log('M2_VISUAL_CAPTURE_OK '+findings.map(x=>x.size).join(', '));
}finally{await browser.close()}
