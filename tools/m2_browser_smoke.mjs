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
  assert.equal(await page.locator('.preflight').count(),1,'one compact enemy-intelligence strip');
  assert.equal(await page.locator('.book-header').count(),1,'M2 custom header must load');
  if(i===0){
    await page.setViewportSize({width:1366,height:768});
    await page.getByRole('tab',{name:/构筑 · 蛊仓/}).click();
    assert.equal(await page.locator('body').getAttribute('data-prep-tab'),'inventory');
    assert.equal(await page.locator('.shell>div:first-child>section:nth-child(2)').isVisible(),true);
    await page.getByRole('tab',{name:/交易 · 商店/}).click();
    assert.equal(await page.locator('.shell>div:first-child>section:nth-child(1)').isVisible(),true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollHeight<=window.innerHeight+2),true,'1366x768 game shell must not require document scrolling');
    await page.setViewportSize({width:1280,height:800});
  }
  if(i===0){
   await page.screenshot({path:output+'/m2_shop_desktop.png',fullPage:true});
   await page.setViewportSize({width:390,height:844});
   const separated=await page.locator('header').evaluate(h=>{const a=h.children[0].getBoundingClientRect(),b=h.children[1].getBoundingClientRect();return a.bottom<=b.top||a.right<=b.left});
   assert.equal(separated,true,'mobile title must not overlap status badges');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true,'M2 mobile shop must not overflow');
   await page.screenshot({path:output+'/m2_shop_mobile.png',fullPage:true});
   await page.setViewportSize({width:1280,height:800});
  }
  if(i===0){
    // Stress-only fixture: full Gu inventory, not part of the normal eight-school playthrough.
    const stress=await browser.newContext({viewport:{width:1366,height:768}});
    const pg=await stress.newPage();
    await pg.goto(new URL('../m2.html',import.meta.url).href);
    await pg.getByRole('button',{name:'选择道途'}).first().click();
    await pg.evaluate(()=>{
      while(state.gu.length<12)state.gu.push(owned('B101'));
      save();render();
    });
    await pg.getByRole('tab',{name:/构筑 · 蛊仓/}).click();
    assert.equal(await pg.locator('.shell .slot').count()>=12,true,'twelve Gu instances must remain rendered');
    const layout=await pg.evaluate(()=>{
      const doc=document.documentElement;
      const content=document.querySelector('.shell>div:first-child>section:nth-child(2)');
      const last=content.querySelector('.slot:last-of-type');
      const panel=content.getBoundingClientRect();
      return {whole:doc.scrollHeight<=innerHeight+2,
        x:doc.scrollWidth<=innerWidth+2,
        scrollable:content.scrollHeight>content.clientHeight,
        last:!!last, panelHeight:panel.height};
    });
    assert.equal(layout.whole,true,'full 12-Gu inventory must not scroll entire desktop document');
    assert.equal(layout.x,true,'full inventory must not overflow horizontally');
    assert.equal(layout.panelHeight>0,true,'inventory panel must occupy visible area');
    const lastEquip=pg.getByRole('button',{name:'装备'}).last();
    await lastEquip.scrollIntoViewIfNeeded();
    await lastEquip.click();
    assert.equal(await pg.evaluate(()=>state.equip.length),4,'last inventory entry must be operable');
    await pg.screenshot({path:output+'/m2_inventory_full_1366x768.png'});
    await pg.getByRole('tab',{name:/交易 · 商店/}).click();
    assert.equal(await pg.locator('.shopitem').count(),4,'shop remains available after full-inventory tab');
    await stress.close();
  }
  // Genuine purchase/equipment interaction through buttons, not JS fixture injection.
  await page.getByRole('button',{name:'购买'}).last().click();
  await page.getByRole('tab',{name:/构筑 · 蛊仓/}).click();
  await page.getByRole('button',{name:'装备'}).last().click();
  assert.match(await page.locator('#status').innerText(),/9 金币/);
  for(let round=1;round<=6;round++){
   await page.getByRole('button',{name:/迎战/}).click();
   assert.equal(await page.locator('.combat-stage').count(),1);
   assert.equal(await page.locator('.combat-stage .foe-portrait').count(),1,'each battle must show enemy character art');
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
   if(i===0&&round===1&&await page.getByRole('button',{name:/夺蛊并替换/}).count()){
    const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('wenzhen_m2_v1')).equip);
    await page.screenshot({path:output+'/m2_spoils_swap.png',fullPage:true});
    await page.getByRole('button',{name:/夺蛊并替换/}).first().click();
    const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('wenzhen_m2_v1')).equip);
    assert.equal(after.length,before.length);
    assert.notEqual(after[0],before[0],'loot should immediately replace the chosen equipped Gu');
   }else if(await page.getByRole('button',{name:/收入蛊仓/}).count())await page.getByRole('button',{name:/收入蛊仓/}).click();
   assert.match(await page.locator('#app').innerText(),/战斗胜利|战斗失利|整备与交易|双幕结算/);
   assert.match(await page.locator('#app').innerText(),/造成伤害|护盾吸收|可追夺的蛊|双幕结算/);
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
