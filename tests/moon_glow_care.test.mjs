import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { openLab } from './helpers/lab_browser.mjs';

const context = vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('../js/gu_rules.js', import.meta.url), 'utf8'), context);
const rules = context.GuRules;
const plain = (value) => JSON.parse(JSON.stringify(value));

test('shared petal food need counts Moonlight and Moon Glow separately', () => {
  assert.deepEqual(plain(rules.petalGuIds), ['moonlight_gu', 'moon_glow_gu', 'moon_ray_gu']);
  assert.equal(rules.foodNeed({ moonlight_gu: 2, moon_glow_gu: 1 }), 16);
  assert.equal(rules.foodNeed({ moonlight_gu: 1, moon_glow_gu: 1, moon_ray_gu: 1 }), 16);
  assert.equal(rules.foodNeed({ moonlight_gu: -1, moon_glow_gu: 1.9 }), 8);
});

test('mixed Moonlight and Moon Glow consume their combined ration every five nodes', () => {
  const care = rules.advanceCare(
    { petals: 20, steps: 0, hungry: false },
    { moonlight_gu: 1, moon_glow_gu: 1 },
    5,
  );
  assert.deepEqual(plain(care), { petals: 8, steps: 5, hungry: false });
});

test('Moon Glow hunger is shared and buying petals restores it when the full ration is covered', () => {
  const hungry = rules.advanceCare(
    { petals: 10, steps: 0, hungry: false },
    { moon_glow_gu: 2 },
    5,
  );
  assert.deepEqual(plain(hungry), { petals: 10, steps: 5, hungry: true });

  const fed = rules.buyCare(hungry, { moon_glow_gu: 2 }, 3);
  assert.equal(fed.ok, true);
  assert.equal(fed.stones, 2);
  assert.deepEqual(plain(fed.care), { petals: 4, steps: 5, hungry: false });
});

test('no petal-feeding Gu clears shared hunger', () => {
  assert.deepEqual(
    plain(rules.advanceCare({ petals: 2, steps: 5, hungry: true }, { stone_shell_gu: 1 }, 10)),
    { petals: 2, steps: 10, hungry: false },
  );
});

test('Moonlight-only care preserves the previous four-petal daily ration', () => {
  assert.deepEqual(
    plain(rules.advanceCare({ petals: 20, steps: 0, hungry: false }, { moonlight_gu: 1 }, 5)),
    { petals: 16, steps: 5, hungry: false },
  );
});

// Check the real shared combat input rather than a duplicate feeding predicate.
test('hungry Moonlight and Moon Glow are both removed from combat ownership without deleting inventory', () => {
  const source = fs.readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
  const start = source.indexOf('function fedGuOwned()');
  const end = source.indexOf('function rollVictoryLoot(', start);
  const state = { owned: { moonlight_gu: 1, moon_glow_gu: 1, small_light_gu: 1 } };
  const ctx = vm.createContext({ state, GuRules: rules, currentGuCare: () => ({ hungry: true }) });
  vm.runInContext(source.slice(start, end), ctx);
  const fed = ctx.fedGuOwned();
  assert.equal(fed.moonlight_gu, 0);
  assert.equal(fed.moon_glow_gu, 0);
  assert.equal(fed.small_light_gu, 1);
  assert.equal(state.owned.moon_glow_gu, 1);
});

test('NORMAL_RUN: first preparation points to wild Small Light as Moon Glow ingredients', async () => {
  const lab = await openLab({ seed: 3 });
  try {
    await lab.click('[data-start-run]');
    const map = await lab.snapshot();
    const node = map.journey.graph.nodes.find(n => map.journey.availableNodeIds.includes(n.id) && n.type === 'battle');
    assert.ok(node);
    await lab.click(`[data-choose-node="${node.id}"]`);
    for (let turn = 0; turn < 12; turn += 1) {
      let s = await lab.snapshot();
      if (s.reward || s.ending) break;
      if (s.qi >= 3) {
        try { await lab.click('[data-use-gu="small_light_gu::1"]'); } catch { /* support already used */ }
        s = await lab.snapshot();
      }
      if (s.qi >= 2) await lab.click('[data-use-gu="moonlight_gu::1"]');
      else await lab.click('[data-basic-attack]');
    }
    const won = await lab.snapshot();
    assert.ok(won.reward, 'normal opening fight rewards preparation');
    await lab.click(won.reward.guChoices?.length ? '[data-reward-skip]' : '[data-reward-continue]');
    assert.equal((await lab.snapshot()).page, 'prep');
    assert.match(await lab.text('.prep-guides'), /已有待炼化蛊可补齐 月芒蛊/);
    await lab.click('[data-prep-tab="gu"]');
    const before = await lab.snapshot();
    assert.match(await lab.text('[data-solid-gu-care]'), /玉皮蛊.*10日一餐/);
    if (process.env.WENZHEN_CARE_SCREENSHOT) await lab.shoot(process.env.WENZHEN_CARE_SCREENSHOT);
    await lab.click('[data-buy-solid-food="pork"]');
    const fed = await lab.snapshot();
    assert.equal(fed.stones, before.stones - 1);
    assert.equal(fed.solidCare.pork, before.solidCare.pork + 1);
    await lab.reload();
    assert.deepEqual((await lab.snapshot()).solidCare, fed.solidCare);
    await lab.click('[data-prep-continue]');
    assert.equal((await lab.snapshot()).page, 'map');
    assert.equal(lab.logs().filter(x => x.includes('[exception]')).length, 0);
  } finally { await lab.close(); }
});
