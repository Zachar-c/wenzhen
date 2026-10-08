// 杀招组装。普通脚本：全局 renderKillmove。
// 名称/图标走 GU_BY_ID；variant 只对「可组或已装备」展开，避免每次整备重绘都做笛卡尔积。
function renderKillmove(root) {
  const guMap = typeof GU_BY_ID !== 'undefined' ? GU_BY_ID : Object.fromEntries(DATA.gu.map((x) => [x.id, x]));
  const nameOf = (id) => (guMap[id] && guMap[id].name) || id;
  const iconOf = (id) => {
    const g = guMap[id];
    return g ? `assets/gu/${g.icon}.png` : '';
  };
  const killMoves = currentKillMoves().sort((a, b) => Number(b.playable === true) - Number(a.playable === true));
  const kmById = Object.fromEntries(killMoves.map((m) => [m.id, m]));
  const draft = Array.isArray(state.killmoveDraft) ? state.killmoveDraft : [];
  const customRecipes = Array.isArray(state.customMoveRecipes) ? state.customMoveRecipes : [];
  const customIds = new Set(customRecipes.map((recipe) => {
    const result = GuRules.composeKillMove(recipe, guMap);
    return result.ok ? result.move.id : '';
  }).filter(Boolean));
  const components = ['moonlight_gu', 'small_light_gu', 'moon_glow_gu'];
  const held = (id) => Math.max(0, Number(state.owned?.[id]) || 0);
  const draftCount = (id) => draft.filter((part) => part === id).length;

  const slots = Array.from({ length: 3 }, (_, i) => {
    const id = state.equipped[i];
    const km = id ? kmById[id] : null;
    // 早先这里只有一个图标 + title，鼠标不移上去根本不知道槽里是什么。
    if (!km) return `<div class="slot">空槽 ${i + 1}<span>到下方「可用杀招」记入</span></div>`;
    return `<div class="slot filled">
      ${(km.recipe[0] && `<img src="${iconOf(km.recipe[0])}" alt="">`) || ''}
      <span class="slot-name">${km.label}</span>
      <span class="slot-cost">真元 ${km.true_qi_cost} · 操控 ${km.thought_cost}</span>
    </div>`;
  }).join('');

  const renderCard = (m) => {
    const can = m.playable === true && GuRules.killMoveRecipeInstances(m, state.owned, {}, {}).every(Boolean);
    const on = state.equipped.includes(m.id);
    const mats = m.recipe.map((id) =>
      `<span class="mat-line" title="${nameOf(id)}">
         <img class="mini-gu" src="${iconOf(id)}" alt="">${nameOf(id)}</span>`).join('');
    const variants = (can || on)
      ? GuRules.killMoveVariants(m, state.owned, guMap).filter((v) => v.changed)
      : [];
    const variantNote = variants.length
      ? `<div class="mr" style="opacity:.85">替换组件后的效果：${variants.slice(0, 2).map((v) => {
        const variantMove = { ...m, recipe: v.recipe };
        return `${v.recipe.map(nameOf).join('＋')}：${killMoveEffectText(variantMove, guMap)}`;
      }).join('；')}</div>`
      : '';
    const forget = customIds.has(m.id)
      ? '<button style="margin:8px 0 0 8px" data-compose-forget="' + m.id + '">移除实验配方</button>'
      : '';
    return `<div class="move ${can ? 'ready' : ''}">
      <div class="ml">${m.label}${m.experimental ? ' · 实验同催' : ''}</div>
      <div class="mr">${mats}</div>
      <div class="me">${killMoveEffectText(m, guMap)}</div>
      ${variantNote}
      <div class="mc">真元 ${m.true_qi_cost} · 操控 ${m.thought_cost}${m.life_cost ? ` · 寿元 ${m.life_cost}` : ''}</div>
      <button style="margin-top:11px" ${can ? '' : 'disabled'} data-km="${m.id}">${on ? '卸下' : m.playable === true ? '记入杀招' : '尚未开放'}</button>${forget}
    </div>`;
  };
  const playableCards = killMoves.filter((m) => m.playable === true).map(renderCard).join('');
  const lockedMoves = killMoves.filter((m) => m.playable !== true);
  const lockedCards = lockedMoves.map(renderCard).join('');

  const draftResult = GuRules.composeKillMove(draft, guMap);
  const rankRequired = draft.length
    ? Math.max(...draft.map((id) => Number(guMap[id]?.rank) || 1))
    : 0;
  const rankReady = rankRequired > 0 && draft.every((id) => GuRules.canActivate(state.cultivation, guMap[id]?.rank, guMap[id]?.lowRankException));
  const draftCounts = components.map((id) =>
    `<span class="inv-line" title="${nameOf(id)}">
      <img class="mini-gu" src="${iconOf(id)}" alt="">${nameOf(id)}：库存 ${held(id)} · 已选 ${draftCount(id)} · 剩余 ${Math.max(0, held(id) - draftCount(id))}</span>`).join('');
  const addButtons = components.map((id) => {
    const disabled = draft.length >= 3 || draftCount(id) >= held(id);
    return `<button data-compose-add="${id}" ${disabled ? 'disabled' : ''}>加入 ${nameOf(id)}</button>`;
  }).join(' ');
  // 组件在草案里的作用只按现有 battleEffect 判定：有 target_gu_id 的是定向辅助，
  // 对象不在配方里就不增幅；nonStacking 的同名辅助第二只起不叠。页面不自造规则。
  const componentRole = (id, index) => {
    const gu = guMap[id] || {};
    const effect = gu.battleEffect || gu.v1_effect || {};
    if (!effect.target_gu_id) return ['主蛊', 'own', '自身效果计入'];
    const targetName = nameOf(effect.target_gu_id);
    if (draft.slice(0, index).includes(id)) {
      return [effect.nonStacking ? '重复辅助' : '同型辅助', effect.nonStacking ? 'bad' : 'own',
        effect.nonStacking ? '同类增幅不叠加' : '再叠一只同型'];
    }
    return draft.includes(effect.target_gu_id)
      ? [`有效辅助 ×${effect.multiplier || 1}`, 'good', `增幅${targetName}`]
      : ['无效辅助', 'bad', `配方里没有${targetName}，它不增强其他组件`];
  };
  const selected = draft.length
    ? draft.map((id, i) => {
      const [role, tone, hint] = componentRole(id, i);
      return `<span class="compose-part ${tone}" title="${hint}">
        <img src="${iconOf(id)}" alt="">${nameOf(id)}
        <em>${role}</em>
        <button data-compose-remove="${i}" aria-label="移除第 ${i + 1} 个组件：${nameOf(id)}，${role}">移除</button></span>`;
    }).join('')
    : '<span class="gm">还没有选择组件。</span>';
  const draftInventoryValid = draft.length >= 2 && draft.length <= 3
    && components.every((id) => draftCount(id) <= held(id));
  const qiReady = draftResult.ok && Number(state.qi || 0) >= Number(draftResult.move.true_qi_cost || 0);
  const thoughtReady = draftResult.ok && Number(state.thought || 0) >= Number(draftResult.move.thought_cost || 0);
  const resourceStatus = [
    ...(!draftInventoryValid ? ['组件库存不足'] : []),
    ...(!rankReady ? [`修为不足（需要至少 ${rankRequired} 转）`] : []),
    ...(draftResult.ok && !qiReady ? [`真元不足（需要 ${draftResult.move.true_qi_cost}，当前 ${Number(state.qi || 0)}）`] : []),
    ...(draftResult.ok && !thoughtReady ? [`操控不足（需要 ${draftResult.move.thought_cost}，当前 ${Number(state.thought || 0)}）`] : []),
  ];
  // 整备页读到的是当前真元/操控数值，但这两项在战斗内按回合重新结算；
  // 不写清这一句，「操控不足」会被读成「这条配方永远催不动」。
  const battleRefresh = resourceStatus.some((line) => /^(真元|操控)不足/.test(line))
    ? '（操控每回合刷新；真元按回合恢复，并支付持续防护费用，不保证进战即足够）' : '';
  const composeNotes = draftResult.ok ? draftResult.notes : [
    ...(draft.includes('small_light_gu') && !draft.includes('moonlight_gu')
      ? ['小光蛊只辅助月光蛊；配方没有月光蛊时不会增强其他组件。'] : []),
    ...(draft.filter((id) => id === 'small_light_gu').length > 1 ? ['小光蛊的同类辅助不叠加。'] : []),
  ];
  const preview = draftResult.ok
    ? `<div class="me">${killMoveEffectText(draftResult.move, guMap)}</div>
       <div class="mc">合计：真元 ${draftResult.move.true_qi_cost} · 操控 ${draftResult.move.thought_cost}${draftResult.move.life_cost ? ` · 寿元 ${draftResult.move.life_cost}` : ''} · 需要至少 ${rankRequired} 转</div>
       <div class="mr" role="status" aria-atomic="true">${resourceStatus.length ? `当前不能满足：${resourceStatus.join('；')}${battleRefresh}` : '当前资源足够；开战后仍需有行动可用，且组件实例本回合未被占用。'}</div>
       ${composeNotes.map((note) => `<div class="mr">${note}</div>`).join('')}`
    : `<div class="mr">${draft.length < 2 ? '请选择两个或三个组件。' : draftResult.reason === 'strike_required' ? '该实验构筑当前没有有效伤害，不能保存或催动。' : '该组合目前不能构筑。'}</div>
       ${composeNotes.map((note) => `<div class="mr">${note}</div>`).join('')}`;
  const canRemember = draftResult.ok && draftInventoryValid && !customIds.has(draftResult.move.id);
  // 不可组合时 draftResult.move 根本不存在，分支顺序必须先判 ok 再碰它。
  const rememberReason = canRemember ? ''
    : !draftResult.ok ? '先凑出两只以上、且含有效伤害的组件。'
      : !draftInventoryValid ? '库存已被现有草案占满，先移除一只。'
        : '这条配方已经记下，可直接在下方「可用杀招」里记入槽位。';

  root.innerHTML = `
    <h2>实验构筑 · 自由同催草案 <span class="km-count">已记入杀招槽 ${state.equipped.length} / 3</span></h2>
    <div class="compose-grid">
      <div class="compose-inventory">
        <div class="bf-k">组件余量</div>
        ${draftCounts}
      </div>
      <div class="button-row">${addButtons}</div>
      <div class="compose-selected">
        <div class="bf-k">已选组件 · ${draft.length} / 3</div>
        ${selected}
      </div>
      ${preview}
      <div class="compose-save">
        <button data-compose-remember ${canRemember ? '' : 'disabled'}>${draftResult.ok && customIds.has(draftResult.move.id) ? '已保存此实验草案' : '保存实验草案'}</button>
        ${rememberReason ? `<span class="bf-note">${rememberReason}</span>` : ''}
      </div>
    </div>
    <p class="gm">只试月光、小光、月芒三只蛊；保存草案不装备、不消耗蛊虫，也不代表原著已证的招式。</p>
    <h2>已记杀招槽</h2>
    <div class="slots">${slots}</div>
    <h2>可用杀招</h2>
    <div class="moves">${playableCards || '<div class="mr">还没有可用杀招。</div>'}</div>
    <details class="locked-moves">
      <summary>尚未开放的固定杀招（${lockedMoves.length}）· 当前不能装备或催动</summary>
      <p class="gm">这些招式尚未验证，先当作预告列表；开放后会移到上方。</p>
      <div class="moves">${lockedCards}</div>
    </details>`;
  // 点击由 journey.js 整备页事件委托收口。
}
