// Event-vs-timer visual cue regression: real Chromium DOM & animation verification.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';
const root='artifacts/m2-visual-pass';fs.mkdirSync(root,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1366,height:768},reducedMotion:'no-preference'});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(new URL('../m2.html',import.meta.url).href);
 await page.getByRole('button',{name:'选择道途'}).first().click();
 await page.getByRole('button',{name:/迎战/}).click();
 await page.evaluate(()=>{clearInterval(timer);timer=null;log.push('[0] 基础攻击 造成2伤害');renderBattle()});
 await page.locator('.m2-scene-cue.m2-cue-strike').waitFor();
 assert.equal(await page.locator('.m2-scene-cue').count(),1,'one cue per new damage log');
 await page.screenshot({path:root+'/08_impact_real_chromium_1366x768.png'});
 await page.waitForTimeout(600);
 assert.equal(await page.locator('.m2-scene-cue').count(),0,'cue must release itself after animation');
 await page.evaluate(()=>renderBattle());
 await page.waitForTimeout(40);
 assert.equal(await page.locator('.m2-scene-cue').count(),0,'same log must not replay only because of rerender');
 await page.evaluate(()=>{log.push('[1] 饮锋反击 造成3伤害');renderBattle()});
 await page.locator('.m2-scene-cue.m2-cue-counter').waitFor();
 await page.waitForTimeout(600);
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.evaluate(()=>{log.push('[2] 守根蛊 护盾吸收3伤害');renderBattle()});
 await page.waitForTimeout(45);
 assert.equal(await page.locator('.m2-scene-cue').count(),0,'reduced motion must not retain flash nodes');
 assert.deepEqual(errors,[],'visual event regression has no browser exceptions');
 console.log('M2_VISUAL_EVENT_OK new-entry, no repeated ticks, counter, reduced motion');
}finally{await browser.close()}
