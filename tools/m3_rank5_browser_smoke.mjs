// Real Chromium end-to-end purchase/fusion/battle proof for gated M3, not a visual-grade verdict.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';

const out='artifacts/m3-browser';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const routes=[
 {school:'百兵',i:0,ladder:['B201','B301','B401','B501'],stock:['骨节兵蛊','回匣刀蛊','归鞘轮兵蛊']},
 {school:'观复',i:1,ladder:['G201','G301','G401','G501'],stock:['循痕蛊','回痕截式蛊','周而复始蛊']}
];
const names={T103:'火筹蛊',B101:'引锋蛊',S101:'含芽蛊'};

async function contract(page,id){
 await page.getByRole('tab',{name:/交易 · 商店/}).click();
 await page.locator('#seek-gu').selectOption(id);
 await page.getByRole('button',{name:/定向寻蛊/}).click();
 const gu=page.locator('.shopitem').filter({hasText:names[id]});
 await gu.getByRole('button',{name:'购买'}).first().click();
 const inst=await page.evaluate(id=>state.gu.filter(x=>x.gu===id).at(-1)?.id,id);
 assert.ok(inst,'purchased instance must exist');
 await page.getByRole('tab',{name:/构筑 · 蛊仓/}).click();
 await page.locator('button[onclick="equip(\''+inst+'\')"]').click();
 assert.equal(await page.evaluate(id=>state.equip.includes(id),inst),true,'real equip click');
}
try{
 for(const cfg of routes){
  const context=await browser.newContext({viewport:{width:1366,height:768}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(new URL('../m2.html?m3=rank5',import.meta.url).href);
  assert.match(await page.getByRole('heading',{level:2}).first().innerText(),/五转逆推/);
  await page.getByRole('button',{name:'选择道途'}).nth(cfg.i).click();
  assert.match(await page.locator('#status').innerText(),/第1\/16轮/);
  assert.equal(await page.locator('.preflight .card').count(),2);
  await contract(page,'T103');
  let tier=0,foes=[];
  for(let phase=1;phase<=16;phase++){
    assert.equal(await page.evaluate(()=>state.round),phase,'stage order');
    if(cfg.school==='观复'&&phase===2)await contract(page,'B101');
    if(cfg.school==='观复'&&phase===3)await contract(page,'S101');
    if([4,8,12].includes(phase)){
      const index=[4,8,12].indexOf(phase),coin=[4,6,8][index];
      const before=await page.evaluate(()=>state.gold);
      const btn=page.getByRole('button',{name:cfg.stock[index],exact:true});
      assert.equal(await btn.isEnabled(),true,'source unlock '+phase);
      await btn.click();
      assert.equal(before-await page.evaluate(()=>state.gold),coin);
    }
    if(tier<4){
      const craft=page.locator('button[onclick*="'+cfg.ladder[tier]+'"]');
      if(await craft.isEnabled()){await craft.click();tier++;}
    }
    if(phase===1||phase===12){
      await page.screenshot({path:out+'/'+cfg.school+'_stage_'+phase+'.png',fullPage:true});
    }
    foes.push(await page.evaluate(()=>targetFoe().id));
    await page.getByRole('button',{name:/迎战/}).click();
    if(phase===13)await page.screenshot({path:out+'/'+cfg.school+'_rank5_combat.png',fullPage:true});
    await page.getByRole('button',{name:'立即结算'}).click();
    if(await page.evaluate(()=>!!state.pendingSpoils)){
      await page.getByRole('button',{name:'变卖 +2 金币'}).click();
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),true,'no horizontal scroll');
  }
  assert.equal(tier,4);
  assert.equal(new Set(foes).size,16,'no repeated enemy credit');
  const snapshot=await page.evaluate(()=>({completed:state.completed,round:state.round,losses:state.losses,gu:state.gu.map(x=>x.gu),key:localStorage.getItem('wenzhen_m2_v1')}));
  assert.equal(snapshot.completed,true);
  assert.equal(snapshot.round,16);
  assert.equal(snapshot.key,null,'M3 never writes M2 state');
  assert.ok(snapshot.gu.includes(cfg.ladder[3]));
  assert.deepEqual(errors,[],cfg.school+' browser JS errors');
  await page.screenshot({path:out+'/'+cfg.school+'_result.png',fullPage:true});
  console.log('M3_BROWSER_OK '+JSON.stringify({school:cfg.school,rounds:16,losses:snapshot.losses,foes:foes.length,rank5:cfg.ladder[3]}));
  await context.close();
 }
}finally{await browser.close()}
