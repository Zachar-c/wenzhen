// Independent real-game portrait captures; no M2 test file or business logic edits.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const dir='artifacts/m2-visual-pass';fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1,reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(new URL('../m2.html',import.meta.url).href);
 await page.getByRole('button',{name:'选择道途'}).first().click();
 await page.getByRole('button',{name:'购买'}).last().click();
 await page.getByRole('tab',{name:/构筑 · 蛊仓/}).click();
 await page.getByRole('button',{name:'装备'}).last().click();
 const covered=new Set();
 for(let round=1;round<=6;round++){
  await page.getByRole('button',{name:/迎战/}).click();
  await page.waitForTimeout(150);
  const subject=page.locator('.m2-r8-foe-portrait');
  if(await subject.count()){
   const foe=await subject.getAttribute('data-foe');
   assert.ok(['swordsman','shadow','warden'].includes(foe));
   covered.add(foe);
   await page.screenshot({path:dir+'/08_enemy_'+foe+'_round_'+round+'.png'});
  }
  await page.getByRole('button',{name:'立即结算'}).click();
  if(await page.getByRole('button',{name:/收入蛊仓/}).count())await page.getByRole('button',{name:/收入蛊仓/}).click();
  else if(await page.getByRole('button',{name:/夺蛊并替换/}).count())await page.getByRole('button',{name:/夺蛊并替换/}).first().click();
 }
 assert.equal(covered.size,3,'normal six-battle route must display all three painted foe portraits');
 assert.deepEqual(errors,[],'enemy capture must have no page errors');
 console.log('M2_VISUAL_ENEMIES_OK '+[...covered].join(', '));
}finally{await browser.close()}
