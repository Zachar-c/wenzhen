// Headless Chromium interaction proof for M2: eight schools x three real DOM battles.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';
const output='output/ink-gameplay/m2-browser';
fs.mkdirSync(output,{recursive:true});
const schools=['百兵','晦明','玄牝','执枢','阖辟','参同','乘物','观复'];
const browser=await chromium.launch({headless:true,...(process.env.INK_BROWSER_EXECUTABLE?{executablePath:process.env.INK_BROWSER_EXECUTABLE}:{}),args:['--no-sandbox']});
try{
 for(let i=0;i<schools.length;i++){
  const ctx=await browser.newContext({viewport:{width:1280,height:800}});
  const page=await ctx.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(new URL('../m2.html',import.meta.url).href);
  await page.getByRole('button',{name:'选择道途'}).nth(i).click();
  assert.match(await page.locator('#status').innerText(),/金币\s*13/);
  assert.equal(await page.locator('.shopitem').count(),4);
  assert.equal(await page.locator('.hunt-board .hunt-card').count()>=1,true,'enemy-intelligence choices are present');
  assert.equal(await page.locator('.hunt-board .hunt-card.selected').count(),1,'exactly one hunt target is selected');
  assert.equal(await page.locator('header.game-header').count(),1,'M2 ink header must load');
  if(i===0){
    await page.setViewportSize({width:1366,height:768});
    await page.getByRole('tab',{name:/构筑 · 蛊仓/}).click();
    assert.equal(await page.locator('body').getAttribute('data-prep-tab'),'inventory');
    assert.equal(await page.locator('.inventory-main').isVisible(),true);
    await page.getByRole('tab',{name:/交易 · 商店/}).click();
    assert.equal(await page.locator('.shop-panel').isVisible(),true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true,'1366x768 shop must not overflow horizontally');
    await page.setViewportSize({width:1280,height:800});
  }
  if(i===0){
   await page.screenshot({path:output+'/m2_shop_desktop.png',fullPage:true});
   await page.setViewportSize({width:390,height:844});
   const separated=await page.evaluate(()=>{const a=document.querySelector('header.game-header .brand').getBoundingClientRect(),b=document.querySelector('#status').getBoundingClientRect();return a.bottom<=b.top||a.right<=b.left});
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
    assert.equal(await pg.locator('.inventory-grid > *').count(),12,'twelve inventory cells remain rendered');
    const layout=await pg.evaluate(()=>{
      const doc=document.documentElement;
      const content=document.querySelector('.inventory-main');
      const last=content.querySelector('.inventory-grid > :last-child');
      const panel=content.getBoundingClientRect();
      return {whole:doc.scrollHeight<=innerHeight+2,
        x:doc.scrollWidth<=innerWidth+2,
        scrollable:content.scrollHeight>content.clientHeight,
        last:!!last, panelHeight:panel.height};
    });
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
  if(i===0){
    const merchantCtx=await browser.newContext({viewport:{width:1366,height:768}});
    const merchant=await merchantCtx.newPage();
    await merchant.goto(new URL('../m2.html',import.meta.url).href);
    await merchant.getByRole('button',{name:'选择道途'}).last().click();
    await merchant.locator('details.merchant-details > summary').click();
    await merchant.locator('#seek-gu').selectOption('G112');
    await merchant.getByRole('button',{name:/定向寻蛊/}).click();
    assert.match(await merchant.locator('#status').innerText(),/金币\s*11/);
    assert.equal(await merchant.locator('.shopitem').count(),4);
    assert.equal(await merchant.locator('.shopitem').filter({hasText:'知几蛊'}).count(),1);
    assert.equal(await merchant.evaluate(()=>state.seekUsed),true,'the actual commission is saved for this round');
    await merchant.locator('.shopitem').filter({hasText:'知几蛊'}).getByRole('button',{name:'购买'}).click();
    assert.match(await merchant.locator('#status').innerText(),/金币\s*7/);
    await merchant.getByRole('tab',{name:/构筑 · 蛊仓/}).click();
    assert.match(await merchant.locator('#app').innerText(),/知几蛊/);
    await merchant.screenshot({path:output+'/m2_merchant_gu_commission.png'});
    await merchantCtx.close();
  }
  if(i===0){
    // M3 real browser refinement: click fixed recipe, inspect inventory and verify battle remains playable.
    const craftCtx=await browser.newContext({viewport:{width:1366,height:768}});
    const craft=await craftCtx.newPage();
    await craft.goto(new URL('../m2.html',import.meta.url).href);
    await craft.getByRole('button',{name:'选择道途'}).first().click();
    await craft.getByRole('tab',{name:/构筑 · 蛊仓/}).click();
    assert.equal(await craft.locator('button[onclick*="B201"]').isEnabled(),true);
    await craft.locator('button[onclick*="B201"]').click();
    assert.equal(await craft.evaluate(()=>state.gu.some(x=>x.gu==="B101"||x.gu==="B102")),false);
    assert.equal(await craft.evaluate(()=>state.gu.filter(x=>x.gu==="B201").length),1);
    assert.equal(await craft.evaluate(()=>state.equip.length),2);
    assert.match(await craft.locator('#status').innerText(),/金币\s*13/);
    await craft.screenshot({path:output+'/m3_refined_prebattle_1366.png'});
    await craft.getByRole('button',{name:/迎战/}).click();
    await craft.getByRole('button',{name:'立即结算'}).click();
    assert.match(await craft.locator('#app').innerText(),/折锋回刺|造成伤害/);
    await craftCtx.close();
  }
  if(i===0){
    const observerCtx=await browser.newContext({viewport:{width:1366,height:768}});
    const observer=await observerCtx.newPage();
    await observer.goto(new URL('../m2.html',import.meta.url).href);
    await observer.getByRole('button',{name:'选择道途'}).last().click();
    await observer.getByRole('tab',{name:/构筑 · 蛊仓/}).click();
    const btn=observer.locator('button[onclick*="G201"]');
    assert.equal(await btn.isEnabled(),true);
    await btn.click();
    assert.equal(await observer.evaluate(()=>state.gu.filter(x=>x.gu==="G201").length),1);
    assert.equal(await observer.evaluate(()=>state.gu.some(x=>x.gu==="G101"||x.gu==="G102")),false);
    assert.equal(await observer.evaluate(()=>state.equip.length),2);
    await observer.waitForTimeout(550); // UI entry animation must settle before visual evidence.
    await observer.screenshot({path:output+'/m3_observation_recipe_1366.png'});
    await observer.getByRole('button',{name:/迎战/}).click();
    await observer.getByRole('button',{name:'立即结算'}).click();
    assert.match(await observer.locator('#app').innerText(),/造成伤害|护盾吸收/);
    await observerCtx.close();
  }
  if(i===0){
    // M3-B optional real encounter: force only round selection, then use actual hunt/attack UI.
    const rootCtx=await browser.newContext({viewport:{width:1366,height:768}});
    const root=await rootCtx.newPage();
    await root.goto(new URL('../m2.html',import.meta.url).href);
    await root.getByRole('button',{name:'选择道途'}).nth(5).click();
    await root.evaluate(()=>{state.round=6;state.targetIndex=5;save();render()});
    await root.locator('.hunt-board .hunt-card').filter({hasText:'枯根傀儡'}).getByRole('button',{name:/追猎此敌/}).click();
    assert.equal(await root.evaluate(()=>targetFoe().id),'rootling');
    assert.match(await root.locator('#app').innerText(),/火筹灼烧期间/);
    await root.waitForTimeout(550); // Avoid capturing panels mid fade-in.
    await root.screenshot({path:output+'/m3_rootling_hunt_1366.png'});
    await root.getByRole('button',{name:/迎战/}).click();
    await root.getByRole('button',{name:'立即结算'}).click();
    assert.match(await root.locator('#app').innerText(),/造成伤害|护盾吸收/);
    await rootCtx.close();
  }
  // Genuine purchase/equipment interaction through buttons, not JS fixture injection.
  await page.getByRole('button',{name:'购买'}).last().click();
  await page.getByRole('tab',{name:/构筑 · 蛊仓/}).click();
  await page.getByRole('button',{name:'装备'}).last().click();
  assert.match(await page.locator('#status').innerText(),/金币\s*9/);
  for(let round=1;round<=6;round++){
   await page.getByRole('button',{name:/迎战/}).click();
   assert.equal(await page.locator('.combat-stage').count(),1);
   assert.equal(await page.locator('.combat-stage .foe-portrait').count(),1,'each battle must show enemy character art');
   if(i===0&&[3,5,6].includes(round)){
     await page.waitForFunction(()=>!!document.querySelector('.combat-stage .foe-portrait'));
     await page.screenshot({path:output+'/m2_visual_enemy_round_'+round+'.png'});
   }
   assert.equal(await page.locator('.battle-gu-list > *').count(),5,'five battle slots include visible empty slots');
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
   const result=await page.evaluate(()=>state.lastResult);
   assert.ok(result&&result.tick>0,'settlement records a completed battle tick');
   assert.ok(result.stats&&(result.stats.damageDealt>0||result.stats.damageTaken>0||result.stats.shieldAbsorbed>0),
     'settlement retains actual combat outcome metrics');
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
