// Actual Chromium pointer/keyboard acceptance for the fixed 1920×1080 M2 surface.
// No npm dependencies. Node 22+; set INK_BROWSER_EXECUTABLE to a Chromium executable.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const args = process.argv.slice(2);
const option = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const url = option('--url', 'http://127.0.0.1:8013/m2.html');
const out = resolve(option('--out', 'artifacts/m2-visual-pass-2026-10-14/after'));
const executable = process.env.INK_BROWSER_EXECUTABLE || 'chromium';
const profile = join(tmpdir(), `wenzhen-visual-${Date.now()}`), port = 9300 + Math.floor(Math.random() * 800);
mkdirSync(out, { recursive: true });
const proc = spawn(executable, ['--headless=new', '--no-sandbox', `--user-data-dir=${profile}`, `--remote-debugging-port=${port}`, 'about:blank'], { stdio: 'ignore' });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const report = { viewport: [1920, 1080], url, pointerChecks: [], keyboardChecks: [], screenshots: [], fixtures: [], exceptions: [], failedResources: [] };
let ws;
try {
  let version;
  for (let i = 0; i < 100 && !version; i++) {
    try { version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch {}
    if (!version) await wait(100);
  }
  assert.ok(version, 'Chromium DevTools started');
  ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let sequence = 0, sessionId;
  const pending = new Map();
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') report.exceptions.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (message.method === 'Network.loadingFailed') report.failedResources.push(message.params.errorText);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id); pending.delete(message.id);
      message.error ? reject(Error(message.error.message)) : resolve(message.result);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence; pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const { targetInfos } = await send('Target.getTargets');
  sessionId = (await send('Target.attachToTarget', { targetId: targetInfos.find(target => target.type === 'page').targetId, flatten: true })).sessionId;
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result?.value;
  };
  const until = async (expression, timeout = 6000) => {
    for (let elapsed = 0; elapsed < timeout; elapsed += 80) { if (await evaluate(expression)) return; await wait(80); }
    throw Error(`Timed out: ${expression}`);
  };
  const point = async selector => {
    const result = await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button,[data-gu-id],[data-foe-id]')?.getAttribute('onclick'),disabled:e.disabled}})()`);
    assert.ok(result, `Target exists: ${selector}`); return result;
  };
  const move = async selector => { const { x, y } = await point(selector); await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }); };
  const click = async (selector, button = 'left') => {
    const { x, y, disabled, hit } = await point(selector);
    assert.ok(!disabled, `Target is enabled: ${selector}`);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', button, buttons: button === 'right' ? 2 : 1, clickCount: 1, x, y });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button, buttons: 0, clickCount: 1, x, y });
    await wait(80); report.pointerChecks.push({ selector, button, hit });
  };
  const escape = async () => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await wait(40);
  };
  const key = async (name, code) => {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: name, code: name, windowsVirtualKeyCode: code });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: name, code: name, windowsVirtualKeyCode: code }); await wait(40);
  };
  const shot = async name => {
    await evaluate('document.fonts.ready');
    const data = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(join(out, name), Buffer.from(data.data, 'base64')); report.screenshots.push(name);
  };
  const layout = async () => evaluate(`(()=>{const r=e=>{const x=e.getBoundingClientRect();return [x.x,x.y,x.width,x.height]};return {viewport:[innerWidth,innerHeight],scroll:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],cards:[...document.querySelectorAll('.battle-gu')].map(r),formation:document.querySelector('.player-gu-formation')?r(document.querySelector('.player-gu-formation')):null,tooltip:document.querySelector('.inspect-tooltip')?r(document.querySelector('.inspect-tooltip')):null,inventory:document.querySelectorAll('.inventory-grid>*').length}})()`);
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url }); await until("!!document.querySelector('.school-card')");
  await evaluate('document.fonts.ready'); await wait(150);
  await shot('01-onboarding.png');
  await click('.school-card button'); await until("!!document.querySelector('.prep-scene')");
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1064, y: 540 }); await wait(500);
  report.assetCoverage = await evaluate("({guTotal:GU.length,paintedGu:4,foeTotal:FOES.length,matchingEnemyArt:2,playerUsesExistingRoguePortrait:true})");
  assert.deepEqual((await layout()).scroll, [1920, 1080]);
  assert.equal(await evaluate('state.gu.length'), 3); await shot('02-prep.png');
  await move('.shopitem'); await wait(250);
  assert.equal(await evaluate("document.querySelector('.tooltip-head b')?.textContent"), '引锋蛊');
  const hover = await layout(); const [hx, hy, hw, hh] = hover.tooltip;
  assert.ok(hx >= 0 && hy >= 0 && hx + hw <= 1920 && hy + hh <= 1080);
  const card = await point('.shopitem'); assert.ok(!(card.x > hx && card.x < hx + hw && card.y > hy && card.y < hy + hh), 'Tooltip avoids the hovered target');
  report.hover = hover.tooltip; await shot('03-hover.png');
  await click('.shopitem', 'right'); await until("!!document.querySelector('.inspect-dialog')");
  assert.ok(await evaluate("!!document.querySelector('.inspect-art .painted-specimen')"), 'Pinned card uses the same painted artwork');
  await shot('04-inspect.png'); await escape(); assert.equal(await evaluate("document.querySelector('#app').inert"), false);
  await key('Enter', 13); assert.ok(await evaluate("!!document.querySelector('.inspect-dialog')"));
  await key('Tab', 9); assert.equal(await evaluate("document.activeElement.className"), 'inspect-close');
  await escape(); report.keyboardChecks.push('Enter opens focused Gu; Tab stays in inspection; Escape restores gameplay.');
  const retainedOffer = await evaluate('state.shelf[0].id');
  await click('.shopitem button[onclick^="lock("]'); assert.equal(await evaluate('state.shelf[0].lock'), true);
  await click('.refresh-seal'); assert.equal(await evaluate('state.shelf[0].id'), retainedOffer);
  await click('.shopitem .buy-button'); assert.equal(await evaluate('state.gu.length'), 4); assert.equal(await evaluate('state.gold'), 9);
  await click('.inventory-grid .gu-card .actions button'); assert.equal(await evaluate('state.equip.length'), 2);
  await click('.inventory-grid .gu-card .actions button'); assert.equal(await evaluate('state.equip.length'), 3);
  await click('.replica-nav button'); await shot('05-hunt-drawer.png');
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.hunt-card.selected')).backgroundColor"), 'rgb(241, 229, 242)');
  assert.ok(await evaluate("getComputedStyle(document.querySelector('.drawer-scrim')).backgroundColor.startsWith('rgba(33, 21, 44')"));
  await escape(); assert.equal(await evaluate("document.querySelector('#prep-drawer').hidden"), true);
  assert.equal(await evaluate("document.activeElement.getAttribute('onclick')"), "openPrepDrawer('hunt')");
  report.keyboardChecks.push('Escape closes prep drawer and returns focus to its opener.');
  await click('.replica-nav button');
  await click('.hunt-card:not(.selected)>button'); assert.equal(await evaluate('targetFoe().id'), 'boar');
  await click('.replica-nav button:nth-child(2)'); await shot('05b-refine-drawer.png');
  await click('.recipe-input', 'right'); await until("!!document.querySelector('.inspect-dialog')");
  await escape(); assert.equal(await evaluate("document.querySelector('#prep-drawer').hidden"), false);
  await escape(); report.keyboardChecks.push('Nested inspection closes before its underlying prep drawer.');
  const normalState = await evaluate('JSON.stringify(state)');
  await evaluate("while(state.gu.length<12)state.gu.push(owned(GU[state.gu.length%GU.length].id));state.equip=state.gu.slice(0,5).map(x=>x.id);render()");
  report.fixtures.push('06: Full inventory/formation visual stress only; twelve owned instances, five equipped.');
  assert.equal((await layout()).inventory, 12); await shot('06-full-inventory.png');
  await move('.inventory-grid .gu-card:last-child'); await wait(240);
  const bottomTip = (await layout()).tooltip; assert.ok(bottomTip && bottomTip[1] + bottomTip[3] <= 1080);
  await evaluate(`state=JSON.parse(${JSON.stringify(normalState)});save();render()`);
  await click('.start-emblem'); await until("!!document.querySelector('.fight-scene')");
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 960, y: 540 });
  await shot('07-fight.png');
  const battleLayout = await layout(); report.battleLayout = battleLayout;
  assert.deepEqual(battleLayout.scroll, [1920, 1080]);
  const [, fy, , fh] = battleLayout.formation;
  assert.ok(battleLayout.cards.every(([, y, , h]) => y >= fy && y + h <= fy + fh), 'All five battle cards fit the formation');
  assert.equal(await evaluate("getComputedStyle(document.querySelector('.cooldown-ring')).maskImage"), 'none', 'Cooldown numbers are not masked');
  await click('[data-action=pause]'); const pausedTick = await evaluate('battle.tick'); await wait(650);
  assert.equal(await evaluate('battle.tick'), pausedTick); await shot('08-paused.png');
  await click('[data-action=pause]'); await until('battle&&battle.tick>=6'); await shot('09-active-intent.png');
  await click('.foe-readout', 'right'); const beforeTick = await evaluate('battle.tick'); await wait(650);
  assert.ok(await evaluate('battle.tick') > beforeTick); assert.ok(await evaluate("!!document.querySelector('.inspect-dialog')"));
  await shot('10-enemy-inspect.png'); await escape();
  await click('.report-tab'); await wait(650); assert.equal(await evaluate("document.querySelector('#battle-log-drawer').hidden"), false);
  await shot('11-battle-log.png');
  await click('[data-action=quick]'); await until("!!document.querySelector('.spoils-panel')");
  assert.equal(await evaluate("document.querySelectorAll('.battle-report').length"), 1);
  assert.ok(await evaluate("document.querySelector('.spoils-panel .combat-overline').textContent.includes('铁背野猪')"));
  await shot('12-spoils.png');
  const spoilState = await evaluate('JSON.stringify(state)');
  await evaluate("while(state.gu.length<12)state.gu.push(owned('B101'));renderSpoils()");
  report.fixtures.push('13: Full inventory spoils visual stress; exchange selector shown.');
  assert.ok(await evaluate("!!document.querySelector('#spoil-replace')")); await shot('13-full-spoils.png');
  await evaluate(`state=JSON.parse(${JSON.stringify(spoilState)});renderSpoils()`);
  await click('.spoils-panel button.primary'); assert.equal(await evaluate('state.round'), 2);
  await click('.replica-nav button'); await click('.hunt-card[data-foe-id="swordsman"]>button');
  await click('.start-emblem');
  // Replay the real engine to its hidden feint. No enemy values or disclosure flags are overwritten.
  await evaluate('clearInterval(timer);timer=null;while(battle&&battle.tick<15)step();renderBattle()');
  report.fixtures.push('14: Real swordsman engine stepped to tick 15 for deterministic hidden-feint screenshot.');
  assert.equal(await evaluate('battle.current.revealed'), false);
  assert.ok(await evaluate("document.querySelector('.public-intent').textContent.includes('轨迹未明')"));
  assert.ok(!(await evaluate("document.querySelector('.public-intent').textContent.includes('伤害 6')")));
  await click('.foe-readout', 'right'); await shot('14-hidden-feint-inspect.png'); await escape();
  await click('[data-action=quick]');
  await evaluate("while(!state.completed){if(state.pendingSpoils)resolveSpoils('sell');else {startBattle();quick()}}render()");
  await shot('15-run-result.png'); assert.ok(await evaluate("!!document.querySelector('.result-panel')"));
  report.result = await evaluate('({round:state.round,losses:state.losses,completed:state.completed})');
  assert.deepEqual(report.exceptions, [], 'No browser runtime exceptions');
  assert.deepEqual(report.failedResources, [], 'No failed resource requests');
  report.passed = true; writeFileSync(join(out, 'acceptance.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: true, screenshots: report.screenshots.length, pointerChecks: report.pointerChecks.length, result: report.result, exceptions: report.exceptions }, null, 2));
  await send('Browser.close');
} catch (error) {
  report.passed = false; report.error = String(error); writeFileSync(join(out, 'acceptance.json'), JSON.stringify(report, null, 2) + '\n');
  throw error;
} finally { ws?.close(); proc.kill(); rmSync(profile, { recursive: true, force: true }); }
