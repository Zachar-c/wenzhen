import test from 'node:test';
import assert from 'node:assert/strict';
import { openLab } from './helpers/lab_browser.mjs';

for (const viewport of [[1440, 950], [390, 844]]) {
  test(`new UI uses real state, read-only views and confirmation at ${viewport[0]}px offline`, async () => {
    const lab = await openLab({ viewport, seed: 1, offline: true,
      ...(process.env.WENZHEN_ENTRY ? { entry: process.env.WENZHEN_ENTRY } : {}) });
    const nav = page => viewport[0] < 760 ? `[data-ui-page="${page}"]` : `[data-tab="${page}"]`;
    try {
      await lab.click('[data-start-run]');
      let state = await lab.snapshot();
      const unchanged = value => ({ owned: value.owned, qi: value.qi, stones: value.stones,
        stage: value.cultivationStage, completed: value.journey.completed });
      const before = unchanged(state);
      for (const page of ['gu', 'cult', 'journal', 'records']) {
        await lab.click(nav(page));
        assert.equal((await lab.snapshot()).page, page);
        assert.deepEqual(unchanged(await lab.snapshot()), before);
        assert.equal((await lab.layoutInfo()).documentWidth, (await lab.layoutInfo()).width);
        if (page === 'gu') {
          assert.match(await lab.text('.prep-title .kicker'), /选择下一站/);
          await assert.rejects(lab.click('[data-sell-gu]'));
          await lab.click('[data-ui-gu-filter="防御"]');
          assert.equal((await lab.layoutInfo('[data-gu-id="moonlight_gu"]')).visible, false);
          assert.equal((await lab.layoutInfo('[data-gu-id="jade_skin_gu"]')).visible, true);
          await lab.click('[data-ui-gu-filter="all"]');
        }
        if (page === 'cult') await assert.rejects(lab.click('[data-break]'));
      }
      await lab.click(nav('map'));
      const node = state.journey.graph.nodes.find(n => state.journey.availableNodeIds.includes(n.id) && ['battle', 'elite'].includes(n.type));
      assert.ok(node);
      await lab.click(`[data-choose-node="${node.id}"]`);
      assert.equal((await lab.snapshot()).page, 'battle');
      assert.match(await lab.text('#view-title'), /交锋/);
      const battle = (await lab.snapshot()).battle;
      await lab.click(nav('gu'));
      await assert.rejects(lab.click('[data-sell-gu]'));
      await lab.click(nav('battle'));
      assert.deepEqual((await lab.snapshot()).battle, battle);
      await lab.click('[data-retreat]');
      assert.equal((await lab.layoutInfo()).dialogOpen, true);
      await lab.key('Escape');
      assert.deepEqual((await lab.snapshot()).battle, battle);
      await lab.click('[data-retreat]');
      await lab.click('[data-confirm-accept]');
      state = await lab.snapshot();
      assert.equal(state.page, 'map');
      assert.equal(state.reward, null);
      await lab.click(nav('hall'));
      await lab.click('[data-start-run]');
      assert.equal((await lab.layoutInfo()).dialogOpen, true);
      await lab.click('[data-confirm-cancel]');
      assert.deepEqual((await lab.snapshot()).journey, state.journey);
      await lab.reload();
      assert.deepEqual((await lab.snapshot()).journey, state.journey);
      await lab.shoot(`output/ui-integration/ui-${viewport[0]}-map.png`);
      assert.deepEqual(lab.logs().filter(line => line.includes('[exception]')), []);
    } finally { await lab.close(); }
  });
}

test('dedicated Gu and cultivation views perform real preparation actions without resetting the visit', async () => {
  const lab = await openLab({ seed: 1, offline: true,
    ...(process.env.WENZHEN_ENTRY ? { entry: process.env.WENZHEN_ENTRY } : {}) });
  try {
    await lab.click('[data-start-run]');
    let state = await lab.snapshot();
    const node = state.journey.graph.nodes.find(n => state.journey.availableNodeIds.includes(n.id) && n.type === 'battle');
    await lab.click(`[data-choose-node="${node.id}"]`);
    await lab.click('[data-observe]');
    await lab.click('[data-basic-attack]');
    await lab.click('[data-use-gu="small_light_gu::1"]');
    await lab.click('[data-use-gu="moonlight_gu::1"]');
    state = await lab.snapshot();
    assert.equal(state.page, 'reward');
    await lab.click(state.reward.guChoices.length ? '[data-reward-skip]' : '[data-reward-continue]');
    await lab.click('[data-tab="gu"]');
    const before = await lab.snapshot();
    const trainingCost = Number((await lab.text('[data-train-body="white_boar_strength_gu"]')).match(/真元 (\d+)/)[1]);
    await lab.click('[data-train-body="white_boar_strength_gu"]');
    state = await lab.snapshot();
    assert.equal(state.page, 'gu');
    assert.equal(state.qi, before.qi - trainingCost);
    assert.ok(state.modifierLedger.length > before.modifierLedger.length);
    await assert.rejects(lab.click('[data-train-body="white_boar_strength_gu"]'));
    await lab.click('[data-tab="cult"]');
    const capacity = (await lab.snapshot()).qiMax;
    const essence = (await lab.snapshot()).qi;
    await lab.click('[data-break="stone"]');
    state = await lab.snapshot();
    assert.equal(state.page, 'cult');
    assert.equal(state.qiMax, capacity + 1);
    assert.equal(state.qi, essence);
    await lab.click('[data-tab="prep"]');
    assert.equal((await lab.snapshot()).prepFor, node.id);
    await lab.reload();
    state = await lab.snapshot();
    assert.equal(state.cultivationStage, 1);
    assert.equal(state.prepFor, node.id);
    assert.deepEqual(lab.logs().filter(line => line.includes('[exception]')), []);
  } finally { await lab.close(); }
});

for (const [storageScenario, message] of [['denied', /存储不可用/], ['corrupt', /无法读取存档.*原文已保留/], ['incompatible', /存档版本不兼容.*原文已保留/]]) {
  test(`new home reports ${storageScenario} storage honestly`, async () => {
    const lab = await openLab({ offline: true, storageScenario,
      ...(process.env.WENZHEN_ENTRY ? { entry: process.env.WENZHEN_ENTRY } : {}) });
    try {
      assert.match(await lab.text('.hall-save'), message);
      assert.equal((await lab.snapshot()).journey.started, false);
      assert.notEqual((await lab.bootInfo()).bootSaveIssue, null);
      assert.deepEqual(lab.logs().filter(line => line.includes('[exception]')), []);
    } finally { await lab.close(); }
  });
}


for (const viewport of [[1440, 950], [390, 844]]) {
  test(`local Gu art loads across player flow offline at ${viewport[0]}px`, async () => {
    const lab = await openLab({ seed: 1, viewport, offline: true,
      ...(process.env.WENZHEN_ENTRY ? { entry: process.env.WENZHEN_ENTRY } : {}) });
    const nav = page => viewport[0] < 760 ? `[data-ui-page="${page}"]` : `[data-tab="${page}"]`;
    const checkArt = async selector => {
      const art = await lab.images(selector);
      assert.ok(art.length > 0, selector);
      assert.ok(art.every(img => img.loaded && img.src.startsWith('assets/gu/')), JSON.stringify(art));
      return art;
    };
    try {
      await lab.click('[data-start-run]');
      await lab.click(nav("gu"));
      assert.ok((await checkArt('#panel-gu .gu-face>.gu-art')).every(img => img.width > 150));
      await lab.shoot(`output/ui-integration/gu-art-${viewport[0]}.png`);
      await lab.click(nav("map"));
      const state = await lab.snapshot();
      const node = state.journey.graph.nodes.find(n => state.journey.availableNodeIds.includes(n.id) && n.type === 'battle');
      await lab.click(`[data-choose-node="${node.id}"]`);
      await checkArt('#panel-battle .gu-art');
      await lab.click('[data-observe]');
      await checkArt('#panel-battle [data-use-gu] .gu-art');
      await lab.click('[data-basic-attack]');
      await lab.click('[data-use-gu="small_light_gu::1"]');
      await lab.click('[data-use-gu="moonlight_gu::1"]');
      assert.equal((await lab.snapshot()).page, 'reward');
      const reward = (await lab.snapshot()).reward;
      if (reward.guChoices.length) await checkArt('#panel-reward .gu-art');
      await lab.click(reward.guChoices.length ? '[data-reward-skip]' : '[data-reward-continue]');
      await lab.click('[data-prep-tab="shop"]');
      if ((await lab.images('#panel-prep .shop-offer .gu-art')).length) await checkArt('#panel-prep .shop-offer .gu-art');
      assert.ok((await lab.layoutInfo()).documentWidth <= viewport[0]);
      assert.deepEqual(lab.logs().filter(line => line.includes('[exception]')), []);
    } finally { await lab.close(); }
  });
}

test('pictograms support a real market and combat flow without reading button text', async () => {
  const lab = await openLab({seed: 3, offline: true, entry: process.env.WENZHEN_ENTRY});
  const pictured = async selector => {
    const controls = await lab.visualControls(selector);
    assert.ok(controls.length);
    assert.ok(controls.every(control => control.pictures > 0), selector);
  };
  try {
    await pictured('[data-start-run]');
    await lab.click('.picture-guide>summary');
    await lab.click('[data-start-run]');
    await pictured('[data-choose-node]');
    let state = await lab.snapshot();
    const market = state.journey.graph.nodes.find(n => state.journey.availableNodeIds.includes(n.id) && n.type === 'market');
    await lab.click(`[data-choose-node="${market.id}"]`);
    await pictured('[data-node-action]');
    await lab.shoot('output/ui-integration/visual-choices.png');
    await lab.click('[data-node-action="leave"]');
    await pictured('[data-buy-offer],[data-prep-continue],[data-break]');
    state = await lab.snapshot();
    await lab.click('[data-buy-offer="purchase_vitality_leaf"]');
    const bought = await lab.snapshot();
    assert.equal(bought.stones, state.stones - 3);
    assert.equal(bought.owned.vitality_leaf_gu, state.owned.vitality_leaf_gu + 1);
    await lab.click('[data-prep-continue]');
    state = await lab.snapshot();
    const battle = state.journey.graph.nodes.find(n => state.journey.availableNodeIds.includes(n.id) && n.type === 'battle');
    await lab.click(`[data-choose-node="${battle.id}"]`);
    await pictured('[data-use-gu],[data-basic-attack],[data-end-turn],[data-retreat]');
    await lab.shoot('output/ui-integration/visual-battle.png');
    await lab.click('[data-retreat]');
    await pictured('[data-confirm-accept],[data-confirm-cancel]');
    await lab.key('Escape');
    const active = await lab.snapshot();
    await lab.reload();
    assert.deepEqual((await lab.snapshot()).battle, active.battle);
    assert.equal(lab.logs().filter(line => line.includes('[exception]')).length, 0);
  } finally {await lab.close();}
});
