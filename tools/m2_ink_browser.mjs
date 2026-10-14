// Player-facing M2 ink-interface browser acceptance. Run after the visual/game implementation settles.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root = new URL('../', import.meta.url);
const output = path.resolve('output/ink-specimen-20261014');
fs.mkdirSync(output, { recursive: true });
const report = { result: 'INK_BROWSER_PENDING', output, checks: [], contrast: {}, exceptions: [], boundaries: [
  'Browser acceptance for the M2 ink interface at the tested desktop and 390x844 viewports.',
  'The event-log stress screenshot uses an isolated browser context and fabricated UI rows; it is not gameplay evidence.'
] };
const localLegacyPath = 'C:/Users/90877/AppData/Local/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-win64/chrome-headless-shell.exe';
const executablePath = process.env.INK_BROWSER_EXECUTABLE ||
  (process.platform === 'win32' && fs.existsSync(localLegacyPath) ? localLegacyPath : undefined);
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}), args: ['--no-sandbox'] });
const url = new URL('m2.html', root).href;
const errors = [];
const failedArt = [];
const expectedFallbackFailures = [];

async function newPage(viewport = { width: 1366, height: 768 }, reducedMotion = 'no-preference') {
  const context = await browser.newContext({ viewport, reducedMotion });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(String(error)));
  page.on('requestfailed', request => {
    if (/\.(png|webp)(?:\?|$)/i.test(request.url())) failedArt.push(request.url());
  });
  await page.goto(url, { waitUntil: 'networkidle' });
  return { context, page };
}

async function startSchool(page) {
  await page.getByRole('button', { name: '选择道途' }).first().click();
  await page.locator('.shopitem').first().waitFor();
}

async function visible(page, selector) {
  return page.locator(selector).evaluate(el => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight;
  });
}

async function tabTo(page, locator, label) {
  // Reach the target only by sequential Tab presses; never call focus() on it.
  for (let i = 0; i < 240; i++) {
    const reached = await locator.evaluate(el => el === document.activeElement && (() => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight;
    })()).catch(() => false);
    if (reached) {
      const ring = await page.evaluate(() => {
        const s = getComputedStyle(document.activeElement);
        return (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none';
      });
      assert.equal(ring, true, `${label} has a visible focus ring`);
      return await page.evaluate(() => {
        const all=[...document.querySelectorAll('button:not(:disabled),summary,select:not(:disabled),input:not(:disabled),[tabindex]:not([tabindex="-1"])')]
          .filter(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'});
        return all.indexOf(document.activeElement);
      });
    }
    await page.keyboard.press('Tab');
  }
  throw new Error(`Tab traversal could not reach visible ${label}`);
}

async function enterOn(page, locator, label) {
  const priorPosition = await tabTo(page, locator, label);
  await page.keyboard.press('Enter');
  return priorPosition;
}

async function assertFocusAfterRender(page, label, priorPosition = null) {
  const state = await page.evaluate(() => {
    const el = document.activeElement;
    const r = el?.getBoundingClientRect?.();
    return { tag: el?.tagName || '', text: (el?.innerText || el?.getAttribute?.('aria-label') || '').trim(),
      visible: !!r && r.width > 0 && r.height > 0,
      bounds: r ? {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height,viewport:{width:innerWidth,height:innerHeight}} : null,
      withinViewport: !!r && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
      body: el === document.body };
  });
  assert.equal(state.body, false, `${label}: focus stays on a meaningful adjacent control after render (${JSON.stringify(state)})`);
  assert.equal(state.visible, true, `${label}: focused control remains visible (${JSON.stringify(state)})`);
  assert.ok(['BUTTON', 'SUMMARY', 'SELECT', 'A', 'INPUT'].includes(state.tag), `${label}: focus is on an interactive control`);
  if (state.tag === 'BUTTON') assert.equal(state.withinViewport, true, `${label}: focused button is fully in the viewport (${JSON.stringify(state)})`);
  if (priorPosition !== null) {
    const nextPosition = await page.evaluate(() => {
      const all=[...document.querySelectorAll('button:not(:disabled),summary,select:not(:disabled),input:not(:disabled),[tabindex]:not([tabindex="-1"])')]
        .filter(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'});
      return all.indexOf(document.activeElement);
    });
    assert.ok(nextPosition >= 0 && Math.abs(nextPosition-priorPosition) <= 2,
      `${label}: focus lands on a nearby control after the removed or changed control (${priorPosition} -> ${nextPosition})`);
  }
  return state;
}

async function contrastAudit(page, selectors, label) {
  const result = await page.evaluate(({ selectors }) => {
    const parse = s => {
      const m = s.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const a = m[1].split(',').map(x => parseFloat(x.trim()));
      return [a[0], a[1], a[2], a.length > 3 ? a[3] : 1];
    };
    const blend = (fg, bg) => {
      const a = fg[3];
      return [0,1,2].map(i => fg[i] * a + bg[i] * (1-a)).concat(1);
    };
    const lum = c => {
      const vals = c.slice(0,3).map(v => v/255).map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4);
      return .2126*vals[0]+.7152*vals[1]+.0722*vals[2];
    };
    const visible = el => { const r=el.getBoundingClientRect(),s=getComputedStyle(el); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'; };
    const rows=[];
    for (const selector of selectors) for (const el of document.querySelectorAll(selector)) {
      if (!visible(el) || el.matches(':disabled,[disabled],[aria-hidden="true"]') || el.closest('[aria-hidden="true"]')) continue;
      if (el.closest('svg,canvas, .specimen-art, .figure-portrait, .causal-link')) continue;
      const txt=[...el.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('').trim();
      if (!txt) continue;
      const fg=parse(getComputedStyle(el).color); if(!fg) continue;
      let bg=[255,255,255,1];
      const chain=[]; for(let n=el;n;n=n.parentElement) chain.push(n);
      for(const n of chain.reverse()) { const c=parse(getComputedStyle(n).backgroundColor); if(c&&c[3]>0) bg=blend(c,bg); }
      const effectiveFg=blend(fg,bg), l1=lum(effectiveFg), l2=lum(bg);
      rows.push({text:txt.slice(0,60),selector:el.tagName.toLowerCase()+(el.className&&typeof el.className==='string'?'.'+el.className.trim().replace(/\s+/g,'.'):''),ratio:(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05)});
    }
    rows.sort((a,b)=>a.ratio-b.ratio);
    return { count:rows.length, minimum:rows[0]?.ratio??null, lowest:rows.slice(0,8), failures:rows.filter(x=>x.ratio<4.5) };
  }, { selectors });
  assert.ok(result.count > 0, `${label} contrast audit checked actual visible text, not an empty set`);
  report.contrast[label] = result;
  report.checks.push(`${label} contrast: ${result.count} visible text nodes, minimum ${result.minimum?.toFixed(2)}:1`);
  if (result.failures.length) report.exceptions.push({ area:label, contrastBelow45:result.failures });
  assert.deepEqual(result.failures, [], `${label} visible non-disabled text meets 4.5:1: ${JSON.stringify(result.failures)}`);
  return result;
}

async function decodeSvgSpecimens(page) {
  return page.locator('.shopitem .specimen-art').evaluateAll(async nodes => Promise.all(nodes.map(async el => {
    const img = el.querySelector('img');
    const svg = el.querySelector('svg');
    let source = img?.currentSrc || img?.src || '';
    if (!source) {
      const match = getComputedStyle(el).backgroundImage.match(/url\(["']?(.*?)["']?\)/);
      source = match?.[1] || '';
    }
    if (svg) {
      const serialized = new XMLSerializer().serializeToString(svg);
      source = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(serialized);
    }
    if (!/^data:image\/svg\+xml/i.test(source)) return { source: source.slice(0, 64), width: 0, height: 0 };
    const image = new Image();
    image.src = source;
    try { await image.decode(); } catch {}
    return { source: source.slice(0, 48), width: image.naturalWidth, height: image.naturalHeight };
  })));
}

async function runLogStress() {
  // A fresh browser context keeps fabricated log entries out of the real run and its saved result.
  const { context, page } = await newPage();
  await startSchool(page);
  await page.getByRole('button', { name: /迎战/ }).click();
  await page.locator('.battle-log-details').waitFor();
  await page.waitForFunction(() => Number(document.querySelector('.battle-clock')?.innerText.match(/TICK\s+(\d+)/)?.[1] || 0) >= 2,
    { timeout: 10000 });
  const logDetails = page.locator('.battle-log-details');
  await logDetails.locator('summary').click();
  const initialLog = page.locator('#log');
  await initialLog.evaluate(el => { el.scrollTop = el.scrollHeight; });
  const before = await initialLog.evaluate(el => ({ scrollTop:el.scrollTop, scrollHeight:el.scrollHeight }));
  assert.ok(before.scrollHeight > 0, 'isolated stress context has real scrollable log content');
  await page.evaluate(() => {
    for (let i=0;i<90;i++) log.push(`[${battle.tick}] UI压力夹具事件 ${i+1} · 非玩法证据`);
    renderBattle();
  });
  assert.equal(await page.locator('.battle-log-details').evaluate(el => el.open), true, 'stress render preserves expanded log');
  const stressLog = page.locator('#log');
  await stressLog.evaluate(el => { el.scrollTop = el.scrollHeight; });
  const stressBottom = await stressLog.evaluate(el => el.scrollTop);
  const initialClock = await page.locator('.battle-clock').innerText();
  await page.waitForFunction(old => {
    const el=document.querySelector('#log');
    return el && el.innerText.includes('UI压力夹具事件 90') && document.querySelector('.battle-clock')?.innerText !== old;
  }, initialClock, { timeout: 5000 });
  const after = await page.locator('#log').evaluate(el => ({ scrollTop:el.scrollTop, scrollHeight:el.scrollHeight }));
  assert.equal(await page.locator('.battle-log-details').evaluate(el => el.open), true, 'next stress-context timer render keeps the log open');
  assert.ok(after.scrollTop > 0 && Math.abs(after.scrollTop-stressBottom) <= 2,
    `next stress-context render preserves log scroll (${JSON.stringify({stressBottom,after})})`);
  await page.screenshot({ path:path.join(output,'log-stress.png'), fullPage:true });
  report.logStress = { fabricatedRows:90, context:'isolated', openPreserved:true, scrollTopPreserved:true, screenshot:'log-stress.png', gameplayEvidence:false };
  report.checks.push('Isolated log-stress context appended 90 UI-only rows; next render preserved the open details and scroll position.');
  await context.close();
}

try {
  const { context, page } = await newPage();
  await startSchool(page);

  // Desktop shop: all four offers expose their art/name and a real purchase/lock control.
  await contrastAudit(page, ['.shop-panel *', '.hunt-board *', '.prep-aside *'], 'Shop');
  assert.equal(await page.locator('.shopitem').count(), 4, 'shop has four offers');
  for (const card of await page.locator('.hunt-card').all()) {
    assert.equal(await card.locator('.hunt-copy > p').count(), 1, 'every hunt card exposes its reward paragraph');
    assert.equal(await card.locator('.hunt-copy > p').isVisible(), true, 'every hunt reward paragraph is visible');
    const clue = card.locator('.hunt-copy details.hunt-clue');
    if (await clue.count()) {
      await clue.locator('summary').click();
      assert.equal(await clue.evaluate(el => el.open), true, 'unselected hunt clue expands through its summary');
      assert.equal(await clue.locator('small').isVisible(), true, 'expanded hunt clue text is visible');
    }
  }
  report.checks.push('All visible hunt cards show reward copy; each unselected clue expands from its summary.');
  for (const card of await page.locator('.shopitem').all()) {
    assert.equal(await card.locator('.specimen-art').count(), 1, 'each offer has an art specimen');
    assert.equal(await card.locator('.name').count(), 1, 'each offer has a name');
    assert.equal(await card.getByRole('button', { name: '购买' }).count(), 1, 'each offer can be bought');
    assert.equal(await card.getByRole('button', { name: /锁定|解锁/ }).count(), 1, 'each offer can be locked');
    assert.equal(await card.evaluate(el => {
      const r = el.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth;
    }), true, 'all four shop cards fit inside the desktop viewport');
  }
  const primaryBounds = await page.locator('button.primary').evaluate(el => {
    const r = el.getBoundingClientRect();
    return { text: el.innerText, selector: 'button.primary', x: r.x, y: r.y, width: r.width, height: r.height,
      right: r.right, bottom: r.bottom, viewport: { width: innerWidth, height: innerHeight } };
  });
  assert.equal(await visible(page, 'button.primary'), true,
    `the primary challenge button fits in the desktop viewport: ${JSON.stringify(primaryBounds)}`);
  await page.screenshot({ path: path.join(output, 'shop-initial.png'), fullPage: true });
  report.shopInitial = { offers:4, screenshot:'shop-initial.png', capturedBeforePurchase:true };
  const cards = page.locator('.shopitem');
  const lockButton = cards.nth(1).getByRole('button', { name: /锁定|解锁/ });
  await enterOn(page, lockButton, 'shop lock button');
  assert.equal(await cards.nth(1).evaluate(el => el.classList.contains('locked')), true, 'Enter locks the selected offer');
  const buyButton = cards.first().getByRole('button', { name: '购买' });
  const buyPosition = await enterOn(page, buyButton, 'shop purchase button');
  const buyFocus = await assertFocusAfterRender(page, 'purchase render', buyPosition);
  report.checks.push(`Keyboard purchase and lock completed; post-purchase focus: ${buyFocus.tag} ${buyFocus.text}`);
  await page.screenshot({ path: path.join(output, 'shop.png'), fullPage: true });

  // Purchases persist through a reload and the saved economy is the actual game store.
  const savedAfterPurchase = await page.evaluate(() => JSON.parse(localStorage.getItem('wenzhen_m2_v1')));
  assert.ok(savedAfterPurchase, 'game save is written to wenzhen_m2_v1');
  const economyAfterPurchase = JSON.stringify({ gold: savedAfterPurchase.gold, shelf: savedAfterPurchase.shelf });
  await page.reload({ waitUntil: 'networkidle' });
  assert.equal(await page.locator('.shopitem').count(), 4);
  const savedAfterReload = await page.evaluate(() => JSON.parse(localStorage.getItem('wenzhen_m2_v1')));
  assert.equal(JSON.stringify({ gold: savedAfterReload.gold, shelf: savedAfterReload.shelf }), economyAfterPurchase,
    'stored game economy survives reload');

  // The directed merchant is deliberately collapsed at entry; expand it before commissioning an item.
  const merchant = page.locator('details.merchant-details');
  await merchant.locator('summary').click();
  await merchant.locator('#seek-gu').selectOption('G112');
  await merchant.getByRole('button', { name: /定向寻蛊/ }).click();
  assert.equal(await page.locator('.shopitem').filter({ has: page.locator('.name', { hasText: '知几蛊' }) }).count(), 1,
    'directed commission puts the selected Gu on the shelf');
  await page.locator('.shopitem').filter({ hasText: '知几蛊' }).getByRole('button', { name: '购买' }).click();

  // Inventory and preparation controls.
  const inventoryTab = page.getByRole('tab', { name: '构筑 · 蛊仓' });
  await inventoryTab.click();
  assert.equal(await page.locator('.inventory-grid > *').count(), 12, 'inventory shows twelve cells including empties');
  const gridGeometry = await page.locator('.inventory-grid').evaluate(el => {
    const s=getComputedStyle(el); return {columns:s.gridTemplateColumns.split(' ').length, rows:s.gridTemplateRows.split(' ').length,
      templateColumns:s.gridTemplateColumns, templateRows:s.gridTemplateRows};
  });
  assert.deepEqual({ columns:gridGeometry.columns, rows:gridGeometry.rows }, { columns:6, rows:2 },
    `desktop inventory is 6 columns by 2 rows: ${JSON.stringify(gridGeometry)}`);
  report.desktopInventory = { cells:12, loadoutSlots:5, ...gridGeometry };
  assert.equal(await page.locator('.loadout-grid > *').count(), 5, 'loadout shows five slots');
  assert.equal(await page.getByRole('button', { name: '装备' }).count() > 0, true, 'owned Gu can be equipped');
  assert.equal(await page.getByRole('button', { name: '卸下' }).count() > 0, true, 'equipped Gu can be removed');
  assert.equal(await page.getByRole('button', { name: '出售' }).count() > 0, true, 'owned Gu can be sold');
  assert.equal(await page.getByRole('button', { name: /合炼/ }).count() > 0, true, 'refinement control is present');
  await contrastAudit(page, ['.inventory-main *', '.prep-aside *'], 'Inventory');
  const fullEffect = page.locator('.inventory-main .gu-card[data-gu-id="G112"] details.gu-inspect');
  await fullEffect.locator('summary').click();
  assert.equal(await fullEffect.evaluate(el => el.open), true, 'inventory full-effect summary expands');
  const expandedEffect = await fullEffect.locator('p').innerText();
  const cardEffect = await page.locator('.inventory-main .gu-card[data-gu-id="G112"] .meta').innerText();
  assert.ok(expandedEffect.length > 20, 'the long-effect specimen has substantive text');
  assert.equal(expandedEffect, cardEffect, 'expanded full effect exposes the complete card description');
  const unload = page.locator('.inventory-main .gu-card').first().getByRole('button', { name: '卸下' });
  const unloadPosition = await enterOn(page, unload, 'unload button');
  await assertFocusAfterRender(page, 'unload render', unloadPosition);
  const equip = page.locator('.inventory-main .gu-card').first().getByRole('button', { name: '装备' });
  const equipPosition = await enterOn(page, equip, 'equip button');
  await assertFocusAfterRender(page, 'equip render', equipPosition);
  const sell = page.locator('.inventory-main .gu-card').last().getByRole('button', { name: /出售/ });
  const sellPosition = await enterOn(page, sell, 'sell button');
  const sellFocus = await assertFocusAfterRender(page, 'sell render', sellPosition);
  report.checks.push(`Keyboard equip/unload/sell completed; post-sale focus: ${sellFocus.tag} ${sellFocus.text}`);
  const forge = page.getByRole('button', { name: /合炼（牺牲原蛊）/ }).first();
  if (await forge.isEnabled()) {
    const outputId = await forge.evaluate(el => el.closest('.recipe')?.querySelector('.recipe-output')?.dataset.guId);
    await enterOn(page, forge, 'refinement button');
    assert.equal(await page.locator(`.inventory-main .gu-card[data-gu-id="${outputId}"]`).count(), 1, 'Enter refines real owned materials');
    report.checks.push(`Keyboard refinement consumed its recipe ingredients and produced ${outputId}.`);
  } else {
    throw new Error('The百兵 fixture must provide a real enabled refinement recipe.');
  }
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(output, 'inventory.png'), fullPage: true });

  // Challenge through the single primary action, then confirm side placement and five Gu cells.
  const challengeButtons = page.locator('button.primary', { hasText: '迎战' });
  assert.equal(await challengeButtons.count(), 1, 'there is exactly one primary challenge action');
  assert.equal(await page.locator('[aria-label*="迎战"]').count(), 0, 'no floating mobile challenge CTA');
  await enterOn(page, challengeButtons, 'challenge button');
  await page.locator('.combatant.player').waitFor();
  await page.locator('.foe').waitFor();
  assert.equal(await page.locator('.intent-bar').count() > 0, true, 'enemy intent is visible');
  assert.equal(await page.locator('.battle-gu-list > *').count(), 5, 'battle loadout has five cells including empty');
  assert.equal(await page.locator('.combat-side').count() > 0, true, 'combat side is present');
  assert.ok(await page.locator('.event-strip').count() <= 3, 'event strip stays compact');
  const placement = await page.evaluate(() => {
    const player = document.querySelector('.combatant.player').getBoundingClientRect();
    const foe = document.querySelector('.foe').getBoundingClientRect();
    return { playerX: player.x, foeX: foe.x, playerY: player.y, foeY: foe.y };
  });
  assert.ok(placement.playerX < placement.foeX, 'player is on the left and foe on the right');
  // Capture mobile while the live battle has a genuine announced attack countdown.
  await page.waitForFunction(() => /\d+ tick/.test(document.querySelector('.intent-bar > b')?.innerText || ''), { timeout:10000 });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'mobile has no horizontal overflow');
  for (const selector of ['.combatant.player', '.combatant.foe', '.intent-bar', '.battle-gu-list']) {
    assert.equal(await visible(page, selector), true, `${selector} is visible in the first mobile screen`);
  }
  assert.equal(await page.locator('.battle-gu-list > *').count(), 5);
  const intentCountdown = (await page.locator('.intent-bar > b').innerText()).trim();
  assert.match(intentCountdown, /\d+ tick|即将 · \d+ tick/, `mobile shows the live intent tick countdown: ${intentCountdown}`);
  assert.equal(await page.locator('.combatant.foe .hp-numbers').isVisible(), true, 'foe health is visible in the first mobile screen');
  assert.equal((await page.locator('.battle-log-details').count()) > 0, true, 'mobile scene has the real combat log panel');
  assert.equal((await page.locator('#log').innerText()).includes('UI压力夹具事件'), false, 'mobile scene contains only real combat log entries');
  report.checks.push(`390x844 first screen shows player and foe health, real intent countdown (${intentCountdown}), and five Gu slots.`);
  report.mobile = { viewport:{width:390,height:844}, playerHealthVisible:true, foeHealthVisible:true, intentCountdown, guSlots:5, horizontalOverflow:false };
  await page.screenshot({ path: path.join(output, 'mobile.png'), fullPage: true });
  await page.setViewportSize({ width:1366, height:768 });

  await page.waitForFunction(() => Number(document.querySelector('.battle-clock')?.innerText.match(/TICK\s+(\d+)/)?.[1] || 0) >= 6,
    { timeout: 10000 });
  await contrastAudit(page, ['.combat-stage *', '.combat-side *', '.combat-title *'], 'Combat');
  const logDetails = page.locator('.battle-log-details');
  await logDetails.locator('summary').click();
  const logBefore = page.locator('#log');
  await logBefore.evaluate(el => { el.scrollTop = el.scrollHeight; });
  assert.ok(await logBefore.evaluate(el => el.scrollHeight) > 0, 'real combat log has readable entries');
  assert.equal((await logBefore.innerText()).includes('UI压力夹具事件'), false, 'real combat log has no fixture entries before capture');
  // Freeze only the real fight's presentation at its current tick for a clean screenshot.
  await page.evaluate(() => { clearInterval(timer); timer = null; });
  const liveTick = await page.locator('.battle-clock').innerText();
  const actualScreenshotTick = Number(liveTick.match(/TICK\s+(\d+)/)?.[1] || 0);
  assert.ok(actualScreenshotTick >= 6, `battle-live capture has tick >= 6 (${liveTick})`);
  report.battleLive = { tick:actualScreenshotTick, screenshot:'battle-live.png', timerPausedBeforeCapture:true };
  await page.screenshot({ path: path.join(output, 'battle-live.png'), fullPage: true });

  const settle = page.getByRole('button', { name: '立即结算' });
  await enterOn(page, settle, 'immediate-settlement button');
  await page.locator('.spoils-panel,.result-panel').waitFor({ timeout: 10000 });
  assert.equal(await page.locator('.spoils-panel,.result-panel').count() > 0, true,
    'Enter on immediate settlement runs the real battle resolver and reaches its actual outcome');
  const settledSave = await page.evaluate(() => JSON.parse(localStorage.getItem('wenzhen_m2_v1')));
  assert.ok(settledSave?.lastResult, 'actual immediate settlement writes its real result');
  assert.equal(settledSave.lastResult.log.some(line => line.includes('UI压力夹具事件')), false,
    'real lastResult log contains no stress-fixture entries');
  report.checks.push('Keyboard immediate settlement used the real battle resolver and reached the result or spoils decision UI.');
  report.realLastResult = { exists:true, fixtureEntries:0, tick:settledSave.lastResult.tick, won:settledSave.lastResult.won };

  // Motion selection and OS preference both affect the effective motion behavior.
  await page.setViewportSize({ width: 1366, height: 768 });
  const motion = page.locator('#motion-setting');
  assert.equal(await motion.locator('option').evaluateAll(options => options.map(o => o.value).join(',')), 'system,reduce');
  await motion.selectOption('reduce');
  assert.equal(await page.locator('body').getAttribute('data-motion'), 'reduce');
  await page.evaluate(() => {
    document.querySelector('#motion-fixture')?.remove();
    const box=document.createElement('div'); box.id='motion-fixture';
    box.innerHTML='<span class="took-hit">受击文字保留</span><span class="just-forged">合炼文字保留</span>';
    document.body.appendChild(box);
  });
  const reduceMotionState = await page.locator('#motion-fixture').evaluate(el => [...el.children].map(node => {
    const s=getComputedStyle(node),r=node.getBoundingClientRect(); return {className:node.className,text:node.innerText,display:s.display,opacity:s.opacity,
      animationName:s.animationName,animationDuration:s.animationDuration,transform:s.transform,transitionDuration:s.transitionDuration,
      x:r.x,y:r.y,width:r.width,height:r.height};
  }));
  assert.equal(reduceMotionState.every(x => x.text.length>0&&x.display!=='none'&&Number(x.opacity)>0), true,
    `reduce mode preserves effect text: ${JSON.stringify(reduceMotionState)}`);
  assert.equal(reduceMotionState.every(x => x.animationName==='none'&&x.transform==='none'), true,
    `reduce mode removes actual hit/forge animation and displacement: ${JSON.stringify(reduceMotionState)}`);
  await page.waitForTimeout(250);
  const reduceMotionAfter = await page.locator('#motion-fixture').evaluate(el => [...el.children].map(n=>{const r=n.getBoundingClientRect();return [r.x,r.y]}));
  assert.equal(reduceMotionState.every((x,i)=>x.x===reduceMotionAfter[i][0]&&x.y===reduceMotionAfter[i][1]),true,
    `page reduce mode keeps hit/forge cues in place: ${JSON.stringify({before:reduceMotionState.map(x=>[x.x,x.y]),after:reduceMotionAfter})}`);
  await page.screenshot({ path: path.join(output, 'reduce.png'), fullPage: true });
  await motion.selectOption('system');
  assert.equal(await page.locator('body').getAttribute('data-motion'), 'system');
  await context.close();

  // With OS reduced-motion enabled, the system setting must also render the stage without animation.
  const systemReduced = await newPage({ width: 1366, height: 768 }, 'reduce');
  await startSchool(systemReduced.page);
  await systemReduced.page.getByRole('button', { name: /迎战/ }).click();
  await systemReduced.page.evaluate(() => {
    const box=document.createElement('div'); box.id='motion-fixture';
    box.innerHTML='<span class="took-hit">受击文字保留</span><span class="just-forged">合炼文字保留</span>';
    document.body.appendChild(box);
  });
  const osMotion = await systemReduced.page.locator('#motion-fixture').evaluate(el => [...el.children].map(n=>{const s=getComputedStyle(n),r=n.getBoundingClientRect();return {text:n.innerText,display:s.display,opacity:s.opacity,animationName:s.animationName,animationDuration:s.animationDuration,transform:s.transform,x:r.x,y:r.y}}));
  assert.equal(await systemReduced.page.locator('body').getAttribute('data-motion'),'system');
  assert.equal(osMotion.every(x=>x.text.length>0&&x.display!=='none'&&Number(x.opacity)>0&&x.animationName==='none'&&x.transform==='none'),true,
    `OS reduce preference in system mode preserves text and suppresses motion: ${JSON.stringify(osMotion)}`);
  await systemReduced.page.waitForTimeout(250);
  const osMotionAfter = await systemReduced.page.locator('#motion-fixture').evaluate(el => [...el.children].map(n=>{const r=n.getBoundingClientRect();return [r.x,r.y]}));
  assert.equal(osMotion.every((x,i)=>x.x===osMotionAfter[i][0]&&x.y===osMotionAfter[i][1]),true,
    `OS reduce preference keeps hit/forge cues in place: ${JSON.stringify({before:osMotion.map(x=>[x.x,x.y]),after:osMotionAfter})}`);
  report.checks.push('Page reduce mode and OS reduced-motion in system mode both suppress .took-hit/.just-forged animation and movement while keeping effect text visible.');
  await systemReduced.context.close();

  // Keyboard focus must be discernible. Exercise actual Tab focus and report the focused control.
  const keyboard = await newPage();
  await startSchool(keyboard.page);
  await keyboard.page.keyboard.press('Tab');
  const focusVisible = await keyboard.page.evaluate(() => {
    const el = document.activeElement;
    const style = getComputedStyle(el);
    return el && (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0 || style.boxShadow !== 'none');
  });
  assert.equal(focusVisible, true, 'keyboard focus indicator is visible');
  await keyboard.context.close();

  // Simulate missing image assets: failed PNG/WebP should leave a usable SVG or CSS specimen fallback.
  const fallback = await newPage();
  await fallback.page.route(/\.(?:png|webp)(?:\?.*)?$/i, route => {
    expectedFallbackFailures.push(route.request().url());
    return route.abort();
  });
  await fallback.page.reload({ waitUntil: 'networkidle' });
  await startSchool(fallback.page);
  const artFallbacks = await decodeSvgSpecimens(fallback.page);
  assert.equal(artFallbacks.length, 4);
  assert.equal(artFallbacks.every(x => x.width > 0 && x.height > 0), true,
    `inline SVG fallback decodes when raster assets fail: ${JSON.stringify(artFallbacks)}`);
  await fallback.context.close();

  await runLogStress();

  assert.deepEqual(errors, [], 'no uncaught browser errors');
  const unexpectedFailedArt = failedArt.filter(url => !expectedFallbackFailures.includes(url));
  assert.deepEqual(unexpectedFailedArt, [], `normal browser flows have no failed PNG/WebP requests: ${JSON.stringify(unexpectedFailedArt)}`);
  report.result = 'INK_BROWSER_OK';
  report.screenshots = ['shop-initial.png','shop.png','inventory.png','battle-live.png','mobile.png','reduce.png','log-stress.png'];
  report.failedArt = unexpectedFailedArt;
  report.expectedFallbackFailures = expectedFallbackFailures;
  report.economyPreservedAfterReload = true;
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (report.result === 'INK_BROWSER_PENDING') report.result = 'INK_BROWSER_FAILED';
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
  await browser.close();
}
