// 炼蛊台。普通脚本：全局 renderAlchemy；依赖 data.js 的 DATA 与 describe.js 的 effectText。
// 获取后直接入仓；这里只展示合炼，不恢复旧版待炼化流程。
// 查找走 GU_BY_ID：配方输入多时 DATA.gu.find 是 draw 热点（O(n²)）。
const iconOf = (id) => {
  const g = (typeof GU_BY_ID !== 'undefined' && GU_BY_ID[id]) || DATA.gu.find((x) => x.id === id);
  return g ? `assets/gu/${g.icon}.png` : '';
};
const nameOf = (id) => {
  const g = (typeof GU_BY_ID !== 'undefined' && GU_BY_ID[id]) || DATA.gu.find((x) => x.id === id);
  return (g && g.name) || id;
};

function renderAlchemy(root) {
  const owned = DATA.gu.filter((g) => (state.owned[g.id] || 0) > 0);
  const guByIdMap = typeof GU_BY_ID !== 'undefined' ? GU_BY_ID : Object.fromEntries(DATA.gu.map((x) => [x.id, x]));

  const live = GuRules.liveRecipes(DATA.recipes);
  const forks = GuRules.forkGroups(DATA.recipes);
  const forkIds = new Set(forks.flatMap((f) => f.branches.map((b) => b.id)));
  const rows = live.map((r) => {
    const need = countBy(r.inputs);
    const settlement = GuRules.settleForge(r, {
      owned: state.owned, stones: state.stones, materials:state.materials||{}, playerRank: state.cultivation,
    }, guByIdMap);
    const reasonText = {
      missing_ingredients: '蛊虫不足', missing_materials:'蛊材不足', insufficient_stones: '元石不足',
      insufficient_rank: `修为不足 · 需${settlement.needRank}转`,
    }[settlement.reason] || '';
    const inputs = Object.entries(need).map(([id, n]) =>
      `<span style="display:inline-flex;align-items:center;gap:5px">
         <img src="${iconOf(id)}" alt="">${nameOf(id)}<span style="color:var(--cinnabar)">×${n}</span>
       </span>`).join('<span class="arrow">+</span>');
    const src = (r.source || '').replace(/^蛊真人-clean\.txt\s*/, '原文 ');
    const branch = r.branchLabel
      ? `<div class="meta" style="color:var(--cinnabar)">${r.branchLabel} · 消耗所列组件</div>`
      : '';
    return `<div class="recipe ${forkIds.has(r.id) ? 'fork-branch' : ''}">
      <div class="io">${inputs}<span class="arrow">→</span>
        <span style="display:inline-flex;align-items:center;gap:5px">
          <img src="${iconOf(r.output)}" alt="">${nameOf(r.output)}
        </span>
      </div>
      ${branch}
      ${Object.entries(r.materials||{}).length ? '<div class="meta">蛊材 · '+Object.entries(r.materials).map(([n,q])=>n+' ×'+q+'（现有 '+Number(state.materials?.[n]||0)+'）').join('、')+'</div>' : ''}
      ${r.inputs.some(id => guByIdMap[id]?.effect?.kind === 'body_training') ? '<div class="meta">已得肉身力量保留；投入锻体蛊后，失去该蛊继续增力的能力。</div>' : ''}
      <div class="meta">
        ${r.kind === 'advance' ? '升炼' : '合炼'} · 成算 ${r.successRollMax >= 100 ? '必成 · 游戏适配' : `${r.successRollMax}%`}${r.stoneCost ? ` · 元石 ${r.stoneCost}` : ''}
        <span class="src">${src}</span>
      </div>
      <button ${settlement.ok ? '' : 'disabled'} data-forge="${r.id}">开炉</button>
      ${reasonText ? `<span class="gm" style="color:var(--cinnabar);font-size:11px">${reasonText}</span>` : ''}
    </div>`;
  }).join('');

  const forkNotes = forks.map((f) => `
    <div class="meta" style="margin:8px 0 16px;padding:8px 10px;border-left:3px solid var(--cinnabar)">
      <b>分支节点</b> · 投入 ${f.inputs.map(nameOf).join(' + ')}
      → ${f.branches.map((b) => b.branchLabel || nameOf(b.output)).join(' ／ ')}
      <div style="font-size:12px;opacity:.85">这些路线争用同一批组件；再次取得组件后，可以尝试另一条路线。</div>
    </div>`).join('');

  root.innerHTML = `
    <div class="pane-note">已在手的蛊虫见「蛊仓」页签（卖蛊也在那里）；本页把它们当作合炼与升炼的投入。</div>
    <h2 style="margin-top:22px">炼蛊台 · 合炼 · ${owned.length} 种可作投入</h2>
    ${forkNotes}
    <div class="recipes">${rows}</div>`;
  // 点击由 journey.js 整备页事件委托收口，避免重绘后逐钮重绑。
}

function countBy(ids) {
  return ids.reduce((m, id) => ((m[id] = (m[id] || 0) + 1), m), {});
}
