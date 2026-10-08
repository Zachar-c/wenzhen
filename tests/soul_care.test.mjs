import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { openLab } from './helpers/lab_browser.mjs';

const context = vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../js/run_rules.js', import.meta.url), 'utf8'), context);
vm.runInContext(fs.readFileSync(new URL('../js/shop_rules.js', import.meta.url), 'utf8'), context);
vm.runInContext(`${fs.readFileSync(new URL('../js/data.js', import.meta.url), 'utf8')}; globalThis.DATA = DATA;`, context);
const rules = context.RunRules;
const offer = { soul_gain: 1, soul_cap: 3 };

test('generated soul service is a tier 2, six-stone service shelf offer', () => {
  const service = context.DATA.shopOffers.find(entry => entry.id === 'soul_pill');
  assert.ok(service);
  assert.equal(service.kind, 'soul_boost');
  assert.equal(service.tier, 2);
  assert.equal(service.stone_cost, 6);
  assert.equal(service.soul_gain, 1);
  assert.equal(service.soul_cap, 3);
  const pacingLayers = context.DATA.loot.pacingLayers;
  const offerIds = context.DATA.shopOffers.map(entry => entry.id);
  assert.equal(context.ShopRules.goodsPool(context.DATA.shopOffers, {
    pacingLayers, layer: 1, school: 'light',
  }).includes(service.id), false, 'service stays outside randomized Gu slots');
  assert.equal(context.ShopRules.offerIsStocked(context.DATA.shopOffers, service.id, {
    seed: 3, nodeKey: 'tier-2-service-stock', pacingLayers, layer: 2,
  }), true);
  assert.equal(context.ShopRules.offerIsStocked(context.DATA.shopOffers, service.id, {
    seed: 3, nodeKey: 'tier-1-service-stock', pacingLayers, layer: 1,
  }), false);
  assert.ok(offerIds.includes(service.id));
});

test('soul nourishment heals one point of soul damage without raising the maximum', () => {
  const result = rules.soulNourishment(1, 2, offer);
  assert.equal(result.ok, true);
  assert.equal(result.soul, 2);
  assert.equal(result.soulMax, 2);
  assert.equal(result.reason, 'soul_recovered');
});

test('soul nourishment raises current and maximum soul by one only when already full', () => {
  const result = rules.soulNourishment(2, 2, offer);
  assert.equal(result.ok, true);
  assert.equal(result.soul, 3);
  assert.equal(result.soulMax, 3);
  assert.equal(result.reason, 'soul_strengthened');
});

test('full soul at offer cap is refused without changing either value', () => {
  const result = rules.soulNourishment(3, 3, offer);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'cap_reached');
});

test('zero soul cannot be revived by nourishment and invalid resources are refused', () => {
  const zero = rules.soulNourishment(0, 1, offer);
  assert.equal(zero.ok, false);
  assert.equal(zero.reason, 'invalid_resources');
  const invalid = rules.soulNourishment(2, 1, offer);
  assert.equal(invalid.ok, false);
  assert.equal(invalid.reason, 'invalid_resources');
});

test('NORMAL_RUN: reach tier 2 preparation, buy the soul service once, then reload the sold-out state', async () => {
  const lab = await openLab({ seed: 28 });
  const service = context.DATA.shopOffers.find(entry => entry.id === 'soul_pill');
  const tier2Cost = context.ShopRules.layerPrice(context.DATA.loot.pacingLayers, 2, service.stone_cost);
  try {
    await lab.click('[data-start-run]');

    // Follow the ordinary first-boss route used by the wolf run: complete each
    // depth through the visible retreat control, then fight the actual boss.
    for (let depth = 0; depth < 10; depth += 1) {
      const map = await lab.snapshot();
      const node = map.journey.graph.nodes.find(item =>
        map.journey.availableNodeIds.includes(item.id)
        && item.segment === 1 && item.depth === depth
        && ['battle', 'elite'].includes(item.type));
      assert.ok(node, `normal map offers a combat node at first-segment depth ${depth}`);
      await lab.click(`[data-choose-node="${node.id}"]`);
      assert.ok((await lab.snapshot()).battle, `${node.id} opens a normal battle`);
      await lab.click('[data-retreat]');
    }

    let snap = await lab.snapshot();
    const boss = snap.journey.graph.nodes.find(item =>
      snap.journey.availableNodeIds.includes(item.id) && item.segment === 1 && item.type === 'boss');
    assert.ok(boss, 'first-segment boss is reachable through the normal map');
    await lab.click(`[data-choose-node="${boss.id}"]`);

    for (let action = 0; action < 20; action += 1) {
      snap = await lab.snapshot();
      if (snap.reward) break;
      assert.ok(snap.battle && !snap.battle.over, 'first boss remains in a live normal battle');
      if (snap.qi > 0 && await lab.text('[data-use-gu="small_light_gu::1"]')
          && !snap.battle.turnSupports?.guTargets?.moonlight_gu) {
        try { await lab.click('[data-use-gu="small_light_gu::1"]'); } catch { /* already prepared */ }
        snap = await lab.snapshot();
      }
      if (snap.qi >= 2 && await lab.text('[data-use-gu="moonlight_gu::1"]')) {
        try { await lab.click('[data-use-gu="moonlight_gu::1"]'); }
        catch { await lab.click('[data-basic-attack]'); }
      } else {
        await lab.click('[data-basic-attack]');
      }
    }
    snap = await lab.snapshot();
    assert.ok(snap.reward, 'ordinary combat actions defeat the first boss');
    await lab.click(snap.reward.guChoices?.length ? '[data-reward-skip]' : '[data-reward-continue]');
    snap = await lab.snapshot();
    assert.equal(snap.page, 'prep', 'boss reward opens the ordinary preparation screen');
    assert.ok(snap.journey.graph.nodes.some(node => node.id === 'L2D0N0'), 'tier 2 route is present');
    assert.equal(snap.soul, 1, 'the service does not grant free soul growth before purchase');
    assert.equal(snap.soulMax, 1, 'the service does not grant a free maximum increase');

    // Preparation after the first boss is still attached to its tier 1 node.
    // Enter and retreat from the normal tier 2 opening encounter, then win the
    // reachable Thunder Crown Wolf encounter to reach a genuine tier 2 prep.
    await lab.click('[data-prep-continue]');
    snap = await lab.snapshot();
    assert.ok(snap.journey.availableNodeIds.includes('L2D0N0'));
    await lab.click('[data-choose-node="L2D0N0"]');
    assert.ok((await lab.snapshot()).battle, 'tier 2 opening node uses the normal battle flow');
    await lab.click('[data-retreat]');
    snap = await lab.snapshot();
    const wolfNode = snap.journey.graph.nodes.find(node =>
      snap.journey.availableNodeIds.includes(node.id)
      && node.segment === 2 && node.enemyIds?.length === 1
      && node.enemyIds[0] === 'thunder_crown_wolf');
    assert.ok(wolfNode, 'normal tier 2 route offers a reachable solo Thunder Crown Wolf');
    assert.deepEqual(Array.from(wolfNode.enemyIds), ['thunder_crown_wolf']);
    await lab.click(`[data-choose-node="${wolfNode.id}"]`);
    for (let action = 0; action < 24; action += 1) {
      snap = await lab.snapshot();
      if (snap.reward) break;
      assert.ok(snap.battle && !snap.battle.over, 'wolf fight remains a live normal battle');
      if (snap.qi >= 2 && await lab.text('[data-use-gu="moonlight_gu::1"]')) {
        try { await lab.click('[data-use-gu="moonlight_gu::1"]'); }
        catch { await lab.click('[data-basic-attack]'); }
      } else {
        await lab.click('[data-basic-attack]');
      }
    }
    snap = await lab.snapshot();
    assert.ok(snap.reward, 'ordinary strikes defeat the tier 2 wolf encounter');
    await lab.click(snap.reward.guChoices?.length ? '[data-reward-skip]' : '[data-reward-continue]');
    snap = await lab.snapshot();
    assert.equal(snap.page, 'prep', 'tier 2 encounter reward opens preparation');
    assert.equal(snap.journey.graph.nodes.find(node => node.id === snap.journey.nodeId)?.segment, 2,
      'the preparation belongs to the tier 2 encounter');

    await lab.click('[data-prep-tab="shop"]');
    const button = '[data-buy-offer="soul_pill"]';
    assert.notEqual(await lab.text(button), '', 'tier 2 preparation shows the soul service');
    snap = await lab.snapshot();
    if (snap.stones < tier2Cost) {
      const keep = new Set(['moonlight_gu', 'small_light_gu', 'jade_skin_gu', 'stone_shell_gu',
        'vitality_leaf_gu', 'white_boar_strength_gu', 'white_jade_gu']);
      await lab.click('[data-prep-tab="gu"]');
      for (const [id, count] of Object.entries(snap.owned || {})) {
        if (snap.stones >= tier2Cost) break;
        if (count > 0 && (!keep.has(id) || count > 1)) {
          try { await lab.click(`[data-sell-gu="${id}"]`); } catch { /* already sold or unavailable */ }
          snap = await lab.snapshot();
        }
      }
      await lab.click('[data-prep-tab="shop"]');
      snap = await lab.snapshot();
      assert.ok(snap.stones >= tier2Cost,
        `normal tier 2 preparation remains short of its ${tier2Cost}-stone service price after selling surplus Gu (have ${snap.stones})`);
    }
    const before = { soul: snap.soul, soulMax: snap.soulMax, stones: snap.stones };
    await lab.click(button);
    snap = await lab.snapshot();
    assert.deepEqual({ soul: snap.soul, soulMax: snap.soulMax }, { soul: 2, soulMax: 2 });
    assert.equal(snap.stones, before.stones - tier2Cost, 'purchase charges the tier 2 layer-adjusted price');
    const event = snap.eventLog.at(-1);
    assert.equal(event.action, 'shop');
    assert.equal(event.reason, 'shop_soul_nourishment');
    assert.equal(event.after.soul, 2);
    assert.equal(event.after.soul_max, 2);
    assert.equal(event.after.cost, tier2Cost);
    await assert.rejects(lab.click(button), /全被禁用或不可见/,
      'the same node refuses a second purchase');
    const afterDuplicate = await lab.snapshot();
    assert.equal(afterDuplicate.stones, snap.stones);
    assert.equal(afterDuplicate.soul, 2);
    assert.equal(afterDuplicate.eventLog.length, snap.eventLog.length);

    await lab.reload();
    snap = await lab.snapshot();
    assert.equal(snap.soul, 2, 'current soul persists after reload');
    assert.equal(snap.soulMax, 2, 'maximum soul persists after reload');
    await lab.click('[data-prep-tab="shop"]');
    const soldButton = await lab.text(button);
    assert.match(soldButton, /已售罄/, 'same-node service remains sold out after reload');
    assert.equal(lab.logs().filter(line => line.includes('[exception]')).length, 0);
  } finally {
    await lab.close();
  }
});
