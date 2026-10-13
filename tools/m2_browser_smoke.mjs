// Headless Chromium interaction proof for M2: eight schools x three real DOM battles.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';
const output='artifacts/m2-browser';
fs.mkdirSync(output,{recursive:true});
const schools=['百兵','晦明','玄牝','执枢','阖辟','参同','乘物','观复'];
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 for(let i=0;i<schools.length;i++){
  const ctx=await browser.newContext({viewport:{width:1280,height:800}});
  const page=await ctx.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(new URL('../m2.html',import.meta.url).href);
  await page.getByRole('button',{name:'选择道途'}).nth(i).click();
  assert.match(await page.locator('#status').innerText(),/13 金币/);
  assert.equal(await page.locator('.shopitem').count(),4);
  if(i===0){
   await page.screenshot({path:output+'/m2_shop_desktop.png',fullPage:true});
   await page.setViewportSize({width:390,height:844});
   const separated=await page.locator('header').evaluate(h=>{const a=h.children[0].getBoundingClientRect(),b=h.children[1].getBoundingClientRect();return a.bottom<=b.top||a.right<=b.left});
   assert.equal(separated,true,'mobile title must not overlap status badges');
   await page.screenshot({path:output+'/m2_shop_mobile.png',fullPage:true});
   await page.setViewportSize({width:1280,height:800});
  }
  // Genuine purchase/equipment interaction through buttons, not JS fixture injection.
  await page.getByRole('button',{name:'购买'}).last().click();
  await page.getByRole('button',{name:'装备'}).last().click();
  assert.match(await page.locator('#status').innerText(),/9 金币/);
  for(let round=1;round<=6;round++){
   await page.getByRole('button',{name:/迎战/}).click();
   assert.equal(await page.locator('.combat-stage').count(),1);
   assert.equal(await page.locator('.battle-gu').count(),round===1?4:4);
   if(i===0&&round===1){
    await page.waitForTimeout(1400);
    const portrait=page.locator('.foe-portrait');
    assert.equal(await portrait.evaluate(el=>el.complete&&el.naturalWidth>0),true,'existing enemy art must load offline');
    assert.match(await page.locator('.focus-event').innerText(),/战场焦点/);
    assert.match(await page.locator('.battle-progress').innerText(),/我方已造成/);
    await page.screenshot({path:output+'/m2_battle_desktop.png',fullPage:true});
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true,'no mobile arena horizontal overflow');
    await page.screenshot({path:output+'/m2_battle_mobile.png',fullPage:true});
    await page.setViewportSize({width:1280,height:800});
   }
   await page.getByRole('button',{name:'立即结算'}).click();
   assert.match(await page.locator('#app').innerText(),/战斗胜利|战斗失利/);
   assert.match(await page.locator('#app').innerText(),/造成伤害|护盾吸收/);
  }
  assert.match(await page.locator('#app').innerText(),/M2 双幕结算/);
  const save=await page.evaluate(()=>JSON.parse(localStorage.getItem('wenzhen_m2_v1')));
  assert.equal(save.completed,true);
  assert.equal(save.round,6);
  assert.equal(save.inBattle,false);
  if(i===0)await page.screenshot({path:output+'/m2_stage_result.png',fullPage:true});
  assert.deepEqual(errors,[],schools[i]+' browser errors');
  console.log('BROWSER_OK '+schools[i]+' 6 battles, purchased/equipped, completed; losses='+save.losses);
  await ctx.close();
 }
} finally {await browser.close()}
