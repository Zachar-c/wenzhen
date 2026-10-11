// 战前构筑适配；合法催动和伤害仍由现有战斗规则判定。
globalThis.BuildRules = (() => {
  const slots = bonus => Math.min(6, 3 + Math.max(0, Number(bonus) || 0));
  const refreshCost = count => 2 + 2 * Math.max(0, Number(count) || 0);
  function choose({ candidates, healthRatio, strategy, counter, distance, maintained = [] }) {
    const healing = candidates.find(g => g.battleEffect.kind === 'heal');
    if (healing && healthRatio <= (strategy === 'aggressive' ? 0.3 : 0.6)) return { gu: healing };
    if (counter && !distance) return { kind: 'basic' };
    if (strategy === 'guarded' || (strategy === 'balanced' && healthRatio < 0.75)) {
      const defense = candidates.find(g => g.battleEffect.kind === 'maintained'
        && !maintained.some(m => m.active && (m.instanceId === g.instanceId || m.defenseGroup)));
      if (defense) return { gu: defense };
    }
    const attacks = candidates.filter(g => Number(g.plan.damage) > 0)
      .sort((a, b) => (b.plan.damage + (b.plan.bleeding || 0)) - (a.plan.damage + (a.plan.bleeding || 0)));
    const attack = attacks[0];
    if (attack) {
      const support = candidates.find(g => g.plan.support?.targetGuId === attack.id
        && Number(g.trueQiCost) + Number(attack.trueQiCost) <= g.availableQi
        && Number(g.thoughtCost) + Number(attack.thoughtCost) <= g.availableThought);
      return { gu: support || attack };
    }
    return { kind: distance > 0 ? 'approach' : 'basic' };
  }
  return { slots, refreshCost, choose };
})();
