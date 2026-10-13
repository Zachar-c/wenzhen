// Performance baseline for presentation-only rerenders, not a gameplay balance benchmark.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const output='artifacts/m2-visual-pass';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const measurements=[];
try{
 for(const [width,height] of [[1366,768],[390,844]]){
  const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(new URL('../m2.html',import.meta.url).href);
  await page.getByRole('button',{name:'选择道途'}).first().click();
  await page.getByRole('button',{name:/迎战/}).click();
  const metrics=await page.evaluate(()=>{
    clearInterval(timer);timer=null;
    renderBattle();
    const before=performance.now();
    for(let i=0;i<100;i++)renderBattle();
    const duration=performance.now()-before;
    return {totalMs:Number(duration.toFixed(2)),avgMs:Number((duration/100).toFixed(3)),guCount:GU.length};
  });
  await page.waitForTimeout(30);
  const stageCount=await page.locator('.combat-stage').count(),illustrations=await page.locator('.battle-gu>.m2-gu-illustration').count();
  assert.equal(stageCount,1,'renders must not leave previous stages');
  assert.ok(illustrations>0,'battle Gu cards must still have graphics');
  assert.deepEqual(errors,[],'stress renders must not cause JS errors');
  measurements.push({viewport:width+'x'+height,...metrics,illustrations});
  await page.close();
 }
 fs.writeFileSync(output+'/render_performance.json',JSON.stringify(measurements,null,2));
 console.log('M2_VISUAL_RENDER_PERFORMANCE '+JSON.stringify(measurements));
}finally{await browser.close()}
