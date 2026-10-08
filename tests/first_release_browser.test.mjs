import test from 'node:test';
import assert from 'node:assert/strict';
import { openLab } from './helpers/lab_browser.mjs';

test('first release: normal first encounter opens a focused prep page and saves its progress', async () => {
  const lab = await openLab({ entry: process.env.WENZHEN_ENTRY, seed: 1, viewport: [1280, 800] });
  try {
    await lab.click('[data-start-run]');
    let state = await lab.snapshot();
    assert.equal(state.page, 'map');
    assert.ok((await lab.text('#panel-map .guide-block')).includes(`预计开场 ${state.qiMax}/${state.qiMax}`));
    const firstBattle = state.journey.graph.nodes.find(node =>
      state.journey.availableNodeIds.includes(node.id) && node.type === 'battle');
    assert.ok(firstBattle, 'the starting map exposes an ordinary battle');
    await lab.click(`[data-choose-node="${firstBattle.id}"]`);
    state = await lab.snapshot();
    assert.equal(state.page, 'battle');
    assert.match(await lab.text('[data-use-gu^="moonlight_gu::"]'), /无视闪避/);
    const target = state.battle.enemies[0];
    if (target.problemLabel) assert.ok((await lab.text('.target-phase')).includes(target.problemLabel));
    await lab.click('[data-observe]');
    await lab.click('.combat-details summary');
    const clues = await lab.text('[data-enemy-clues]');
    assert.ok(clues.length);
    for (const id of target.clues) assert.ok(!clues.includes(id),'observed clues show translated labels');
    state = await lab.snapshot();

    for (let turn = 0; turn < 40 && state.page === 'battle'; turn += 1) {
      if (state.battle?.over) break;
      const canUseMoonlight = Number(state.owned?.moonlight_gu || 0) > 0 && state.qi >= 2;
      await lab.click(canUseMoonlight ? '[data-use-gu^="moonlight_gu::"]' : '[data-basic-attack]');
      state = await lab.snapshot();
    }
    state = await lab.snapshot();
    assert.equal(state.page, 'reward', `first encounter did not finish: ${JSON.stringify({ page: state.page, ending: state.ending, blood: state.blood, battle: state.battle?.enemies })}`);
    const rewardGu = state.reward?.guChoices?.[0];
    await lab.click(rewardGu ? `[data-reward-gu="${rewardGu}"]` : '[data-reward-continue]');
    state = await lab.snapshot();
    assert.equal(state.page, 'prep');
    assert.equal(state.journey.nodeId, firstBattle.id);
    const beforeGrowth = state;
    assert.ok((await lab.text('[data-growth-benefit]')).includes(`${state.qiMax} → ${state.qiMax + 1}`));
    await lab.click('[data-break="stone"]');
    state = await lab.snapshot();
    assert.equal(state.cultivationStage, 1);
    assert.equal(state.qiMax, beforeGrowth.qiMax + 1);
    assert.equal(state.qi, beforeGrowth.qi, 'breakthrough does not replenish current essence');
    assert.equal(state.stones, beforeGrowth.stones - 2);

    for (const selector of [
      '[data-buy-gu-food]', '[data-buy-solid-food]', '[data-forge]', '[data-km]',
      '[data-prep-tab="food"]', '[data-prep-tab="forge"]', '[data-prep-tab="killmove"]',
    ]) assert.equal(await lab.text(selector), '', `unexpected first-release control: ${selector}`);

    await lab.click('[data-prep-tab="shop"]');
    const beforeBuy = await lab.snapshot();
    let bought = false;
    try {
      await lab.click('article.shop-offer button:not([disabled])');
      bought = true;
    } catch { /* no affordable ordinary offer in this stock */ }
    if (bought) {
      const afterBuy = await lab.snapshot();
      assert.ok(afterBuy.stones < beforeBuy.stones || JSON.stringify(afterBuy.owned) !== JSON.stringify(beforeBuy.owned),
        'an enabled ordinary shop purchase changes inventory or currency');
      state = afterBuy;
    }

    await lab.click('[data-prep-tab="gu"]');
    const beforeSell = await lab.snapshot();
    let sold = false;
    try {
      await lab.click('[data-sell-gu]');
      sold = true;
    } catch { /* no sellable Gu in the current inventory */ }
    if (sold) {
      const afterSell = await lab.snapshot();
      assert.ok(afterSell.stones > beforeSell.stones, 'an enabled Gu sale pays its listed value');
      state = afterSell;
    }

    assert.ok(bought, 'this seed must exercise a purchase');
    assert.ok(sold, 'this inventory must exercise a sale');
    await lab.click('[data-train-body="white_boar_strength_gu"]');
    state = await lab.snapshot();
    assert.ok(state.qi < state.qiMax, 'paid preparation leaves less than full essence for the map preview');
    const persisted = {
      page: state.page,
      completed: state.journey.completed,
      nodeId: state.journey.nodeId,
      stones: state.stones,
      owned: state.owned,
      reward: state.reward,
      qi: state.qi, qiMax: state.qiMax, cultivationStage: state.cultivationStage,
    };
    await lab.reload();
    const restored = await lab.snapshot();
    assert.deepEqual({
      page: restored.page,
      completed: restored.journey.completed,
      nodeId: restored.journey.nodeId,
      stones: restored.stones,
      owned: restored.owned,
      reward: restored.reward,
      qi: restored.qi, qiMax: restored.qiMax, cultivationStage: restored.cultivationStage,
    }, persisted);
    await lab.click('[data-prep-continue]');
    const advanced=await lab.snapshot();
    assert.equal(advanced.page,'map');
    const mapGuide = await lab.text('#panel-map .guide-block');
    assert.ok(mapGuide.includes(`当前真元 ${advanced.qi}/${advanced.qiMax}`));
    assert.ok(mapGuide.includes(`预计开场 ${advanced.qiMax}/${advanced.qiMax}`));
    assert.equal(advanced.journey.nodeId,null);
    assert.ok(advanced.journey.completed.includes(firstBattle.id));
    await lab.reload();
    assert.deepEqual((await lab.snapshot()).journey,advanced.journey);
    const nextBattle = advanced.journey.graph.nodes.find(node =>
      advanced.journey.availableNodeIds.includes(node.id) && node.type === 'battle');
    await lab.click(`[data-choose-node="${nextBattle.id}"]`);
    const nextEncounter = await lab.snapshot();
    assert.equal(nextEncounter.qi, advanced.qiMax);
    assert.equal(nextEncounter.battle.playerHuman.baseline.essenceMax, advanced.qiMax);
    assert.equal(lab.logs().filter(line => line.includes('[exception]')).length, 0);
    console.log('[FIRST_RELEASE_BROWSER]', JSON.stringify({
      seed: 1, page: restored.page, completed: restored.journey.completed.length,
      bought, sold, stones: restored.stones, owned: restored.owned,
    }));
  } finally {
    await lab.close();
  }
});

test('dedicated market offers targeted purchases, keeps rank gates and persists a sold-out offer', async () => {
  const lab = await openLab({ entry: process.env.WENZHEN_ENTRY, seed: 1, viewport: [1280, 800] });
  try {
    await lab.click('[data-start-run]');
    let state = await lab.snapshot();
    const market = state.journey.graph.nodes.find(node => state.journey.availableNodeIds.includes(node.id) && node.type === 'market');
    assert.ok(market);
    assert.ok((await lab.text(`[data-choose-node="${market.id}"]`)).includes('本段已解锁的全部商品'));
    await lab.click(`[data-choose-node="${market.id}"]`);
    await lab.click('[data-node-action="leave"]');
    assert.ok((await lab.text('.pane-note')).includes('本段已解锁的全部商品'));
    const stock = await lab.text('.shop-grid');
    assert.ok(stock.includes('白豕蛊'));
    assert.ok(stock.includes('青铜舍利蛊'));
    assert.equal(await lab.text('[data-buy-offer="purchase_blood_atk_3_11_gu"]'), '');
    state = await lab.snapshot();
    await lab.click('[data-buy-offer="purchase_vitality_leaf"]');
    const bought = await lab.snapshot();
    assert.equal(bought.stones, state.stones - 3);
    assert.equal(bought.owned.vitality_leaf_gu, state.owned.vitality_leaf_gu + 1);
    await assert.rejects(lab.click('[data-buy-offer="purchase_vitality_leaf"]'));
    await lab.reload();
    const restored = await lab.snapshot();
    assert.deepEqual(restored.shopSold, bought.shopSold);
    assert.equal(restored.stones, bought.stones);
    assert.equal(restored.owned.vitality_leaf_gu, bought.owned.vitality_leaf_gu);
    assert.ok((await lab.text('.pane-note')).includes('本段已解锁的全部商品'));
    assert.equal(lab.logs().filter(line => line.includes('[exception]')).length, 0);
  } finally { await lab.close(); }
});
