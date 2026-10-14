/* Shared read-only Gu and opponent inspection for the M2 specimen interface. */
(() => {
  'use strict';
  const layer = document.getElementById('inspect-layer');
  if (!layer) return;
  let hoverTimer = 0;
  let ignoreHoverUntil = 0;
  let pinned = null;
  let pinnedSelector = '';
  let returnFocus = null;
  let returnSelector = '';
  const escHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
  const sourceOf = node => node?.closest?.('[data-gu-id], [data-foe-id]') || null;
  const guFor = node => {
    const id = node?.dataset?.guId;
    return id ? GM[id] : null;
  };
  const ownedCount = id => (state?.gu || []).filter(item => item.gu === id).length;
  const recipesFor = id => (typeof M3_RECIPES === 'undefined' ? [] : M3_RECIPES.filter(r => r.id === id || r.inputs.includes(id)));
  const recipeHtml = recipe => {
    const has = id => (state?.gu || []).some(item => item.gu === id);
    const icon = id => window.InkSpecimenArt?.markup(id) || '';
    const name = id => escHtml(GM[id]?.name || id);
    const inputs = recipe.inputs.map(id => `<span class="inspect-recipe-part ${has(id) ? 'have' : 'missing'}" data-gu-id="${escHtml(id)}">${icon(id)}<b>${name(id)}</b><small>${has(id) ? '持有' : '缺少'}</small></span>`).join('<b aria-hidden="true">＋</b>');
    const available = typeof availableRecipes === 'function' && availableRecipes().some(r => r.id === recipe.id);
    return `<section class="inspect-recipe"><div class="inspect-recipe-flow"><span class="inspect-recipe-result" data-gu-id="${escHtml(recipe.id)}">${icon(recipe.id)}<b>${name(recipe.id)}</b><small>合炼成蛊</small></span><b aria-hidden="true">＝</b>${inputs}</div><p>${escHtml(recipe.note || '固定蛊方')}</p><small>${available ? '当前可合炼' : '原料不足'}</small></section>`;
  };
  function detail(node) {
    const id = node.dataset.guId;
    const gu = guFor(node);
    if (gu) {
      const count = ownedCount(id);
      const equipped = (state?.equip || []).filter(instance => (state?.gu || []).some(item => item.id === instance && item.gu === id)).length;
      const recipes = recipesFor(id);
      const battleInstance = node.closest('.battle-gu');
      const cooldown = battleInstance?.querySelector('.battle-gu-copy small')?.textContent;
      const price = node.closest('.shopitem') ? '4 金币' : '';
      const status = battleInstance ? (cooldown || '战斗中') : count ? `持有 ${count} · 出战 ${equipped}` : price ? `货架价格 ${price}` : '蛊方组件';
      const art = window.InkSpecimenArt?.markup(id) || '';
      return `<div class="inspect-backdrop" data-inspect-close></div><section class="inspect-dialog" role="dialog" aria-modal="true" aria-labelledby="inspect-title" tabindex="-1"><button class="inspect-close" data-inspect-close aria-label="关闭详情">×</button><aside class="inspect-art" aria-hidden="true">${art}</aside><section class="inspect-info"><div class="inspect-kicker">${escHtml(gu.school)} · ${escHtml(gu.kind)} · ${status}</div><h2 id="inspect-title">${escHtml(gu.name)}</h2><p class="inspect-description">${escHtml(gu.description)}</p><div class="inspect-facts"><span>冷却 <b>${gu.cd} tick</b></span><span>首次触发 <b>${gu.first} tick</b></span>${count ? `<span>库存 <b>${count}</b></span>` : ''}</div></section><section class="inspect-recipes"><h3>相关蛊方</h3>${recipes.length ? recipes.map(recipeHtml).join('') : '<p class="inspect-empty">当前没有已登记的合炼蛊方。</p>'}</section></section>`;
    }
    const foe = node.dataset.foeId && typeof FOES !== 'undefined' ? FOES.find(item => item.id === node.dataset.foeId) : null;
    if (foe) {
      const activeBattle = typeof battle !== 'undefined' && battle?.foe?.id === foe.id ? battle : null;
      const hidden = activeBattle?.current?.type === 'feint' && !activeBattle.current.revealed;
      const publicMove = activeBattle?.current ? (hidden ? '轨迹未明 · 变招蓄势' : `${activeBattle.current.name} · 伤害 ${activeBattle.current.damage} · ${Math.max(0, activeBattle.current.impact - activeBattle.tick)} tick`) : '';
      return `<div class="inspect-backdrop" data-inspect-close></div><section class="inspect-dialog inspect-enemy-dialog" role="dialog" aria-modal="true" aria-labelledby="inspect-title" tabindex="-1"><button class="inspect-close" data-inspect-close aria-label="关闭详情">×</button><aside class="inspect-enemy-art"><img src="${escHtml(window.InkSpecimenArt?.foe(foe.id) || '')}" alt="${escHtml(foe.name)}"></aside><section class="inspect-info"><div class="inspect-kicker">敌方 · 当前遭遇</div><h2 id="inspect-title">${escHtml(foe.name)}</h2><p class="inspect-description">气血 ${activeBattle ? activeBattle.foe.hp : foe.hp} / ${foe.hp} · 护甲 ${foe.armor} · 首招 tick ${foe.first}</p>${publicMove ? `<p>已公开意图：${escHtml(publicMove)}</p>` : ''}<p>${escHtml(FOE_HINTS[foe.id] || '敌情以战斗中已公开的信息为准。')}</p><p class="inspect-empty">未公开的变招不会在此显示。</p></section><section class="inspect-recipes"><h3>公开战况</h3><p>交锋中只展示已公开意图与当前状态。</p>${publicMove ? `<div class="inspect-recipe">${escHtml(publicMove)}</div>` : '<p class="inspect-empty">尚未公开下一式。</p>'}</section></section>`;
    }
    return '';
  }
  function pin(node) {
    if (!node) return;
    clearTimeout(hoverTimer);
    pinned = node;
    pinnedSelector = node.dataset.instanceId
      ? `[data-instance-id="${CSS.escape(node.dataset.instanceId)}"]`
      : node.dataset.foeId ? `[data-foe-id="${CSS.escape(node.dataset.foeId)}"]`
        : node.dataset.guId ? `[data-gu-id="${CSS.escape(node.dataset.guId)}"]` : '';
    returnFocus = node;
    document.getElementById('app').inert = true;
    const instance = node.dataset.instanceId;
    returnSelector = instance
      ? `[data-instance-id="${CSS.escape(instance)}"]`
      : node.dataset.guId ? `[data-gu-id="${CSS.escape(node.dataset.guId)}"]`
        : node.dataset.foeId ? `[data-foe-id="${CSS.escape(node.dataset.foeId)}"]` : '';
    layer.innerHTML = detail(node);
    const dialog = layer.querySelector('.inspect-dialog');
    dialog?.focus({ preventScroll: true });
  }
  function close() {
    pinned = null;
    pinnedSelector = '';
    layer.replaceChildren();
    document.getElementById('app').inert = false;
    const current = returnFocus?.isConnected ? returnFocus : returnSelector ? document.querySelector(`#app ${returnSelector}`) : null;
    current?.focus?.({ preventScroll: true });
    returnFocus = null;
    returnSelector = '';
  }
  function showHover(node) {
    const gu = guFor(node);
    const foe = node.dataset.foeId && typeof FOES !== 'undefined' ? FOES.find(item => item.id === node.dataset.foeId) : null;
    if (!gu && !foe) return;
    if (Date.now() < ignoreHoverUntil) return;
    clearTimeout(hoverTimer);
    hoverTimer = window.setTimeout(() => {
      if (pinned || !node.isConnected) return;
      const title = gu ? gu.name : foe.name;
      const currentHp = typeof battle !== 'undefined' && battle && foe && battle.foe.id === foe.id ? battle.foe.hp : foe?.hp;
      const content = gu
        ? `<div class="tooltip-head"><b>${escHtml(title)}</b><small>${escHtml(gu.school)} · ${escHtml(gu.kind)}</small></div><div class="tooltip-body"><p>${escHtml(gu.description)}</p><div class="tooltip-facts"><span>冷却 <b>${gu.cd} tick</b></span><span>首发 <b>${gu.first} tick</b></span></div></div>`
        : `<div class="tooltip-head"><b>${escHtml(title)}</b><small>敌方 · 已公开情报</small></div><div class="tooltip-body"><p>${escHtml(FOE_HINTS[foe.id] || '')}</p><div class="tooltip-facts"><span>气血 <b>${currentHp} / ${foe.hp}</b></span><span>护甲 <b>${foe.armor}</b></span></div></div>`;
      let tip = layer.querySelector('.inspect-tooltip');
      if (!tip) { tip = document.createElement('div'); tip.className = 'inspect-tooltip'; tip.setAttribute('role', 'tooltip'); layer.append(tip); }
      tip.innerHTML = content + '<div class="tooltip-footer">右键查看详情与蛊方</div>';
      const rect = node.getBoundingClientRect();
      const width = tip.getBoundingClientRect().width || 430;
      const height = tip.getBoundingClientRect().height || 180;
      const canSitAbove = rect.top - height - 16 >= 100;
      const leftFits = rect.left - width - 18 >= 18;
      const rightFits = rect.right + width + 18 <= innerWidth - 18;
      const left = canSitAbove ? rect.left : leftFits ? rect.left - width - 18 : rightFits ? rect.right + 18 : rect.left;
      const top = canSitAbove ? rect.top - height - 16 : leftFits || rightFits ? rect.top : rect.bottom + 16;
      tip.style.left = `${Math.max(8, Math.min(innerWidth - width - 8, left))}px`;
      tip.style.top = `${Math.max(8, Math.min(innerHeight - height - 8, top))}px`;
    }, 180);
  }
  window.M2Inspect = { clearHover() { clearTimeout(hoverTimer); ignoreHoverUntil = Date.now() + 450; layer.querySelector('.inspect-tooltip')?.remove(); } };
  document.addEventListener('pointerover', event => {
    const node = sourceOf(event.target);
    if (node && !node.contains(event.relatedTarget)) showHover(node);
  });
  document.addEventListener('pointerout', event => {
    const node = sourceOf(event.target);
    if (node && !node.contains(event.relatedTarget) && !pinned) {
      clearTimeout(hoverTimer);
      layer.querySelector('.inspect-tooltip')?.remove();
    }
  });
  document.addEventListener('focusin', event => { const node = sourceOf(event.target); if (node) showHover(node); });
  document.addEventListener('focusout', event => { if (sourceOf(event.target) && !pinned) { clearTimeout(hoverTimer); layer.querySelector('.inspect-tooltip')?.remove(); } });
  document.addEventListener('contextmenu', event => {
    const node = sourceOf(event.target);
    if (!node || !detail(node)) return;
    event.preventDefault();
    pin(node);
  });
  document.addEventListener('click', event => {
    if (event.target.closest('[data-inspect-close]')) { close(); return; }
    const trigger = event.target.closest('[data-inspect-trigger]');
    if (trigger) { event.preventDefault(); event.stopPropagation(); pin(sourceOf(trigger)); }
  });
  document.addEventListener('keydown', event => {
    if (!pinned && event.key === 'Enter' && event.target.matches('[data-gu-id],[data-foe-id]')) { event.preventDefault(); pin(sourceOf(event.target)); return; }
    if (!pinned) return;
    if (event.key === 'Escape') { event.preventDefault(); close(); return; }
    if (event.key === 'Tab') {
      const controls = [...layer.querySelectorAll('button,[tabindex="0"]')];
      const dialog = layer.querySelector('.inspect-dialog');
      if (controls.length && (document.activeElement === dialog || event.shiftKey && document.activeElement === controls[0] || !event.shiftKey && document.activeElement === controls.at(-1))) {
        event.preventDefault(); controls[event.shiftKey ? controls.length - 1 : 0].focus();
      }
    }
  });
  document.addEventListener('pointerdown', event => {
    if (event.button === 2) { const node = sourceOf(event.target); if (node) returnFocus = node; }
  });
  const decorate = () => document.querySelectorAll('#app [data-gu-id], #app [data-foe-id]').forEach(node => {
    if (node.matches('.empty-slot') || node.querySelector(':scope > [data-inspect-trigger]')) return;
    if (!node.hasAttribute('tabindex') && !node.matches('button,a,input,select')) node.tabIndex = 0;
    if (getComputedStyle(node).position === 'static') node.style.position = 'relative';
    node.setAttribute('aria-haspopup', 'dialog');
    if (node.matches('.shopitem,.loadout-slot,.battle-gu,.hunt-card,.recipe-input,.recipe-output')) {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'inspect-trigger'; button.dataset.inspectTrigger = '1';
      button.setAttribute('aria-label', `查询${node.dataset.foeId ? '敌人' : '蛊虫'}详情`); button.textContent = 'i';
      node.append(button);
    }
  });
  new MutationObserver(() => {
    decorate();
    if (pinnedSelector) {
      const current = document.querySelector(`#app ${pinnedSelector}`);
      if (current) {
        pinned = current;
        const next = detail(current);
        if (next && layer.innerHTML !== next) {
          const dialog = layer.querySelector('.inspect-dialog');
          const scrollTop = dialog?.scrollTop || 0;
          const hadCloseFocus = document.activeElement === layer.querySelector('.inspect-close');
          layer.innerHTML = next;
          const updated = layer.querySelector('.inspect-dialog');
          if (updated) updated.scrollTop = scrollTop;
          if (hadCloseFocus) layer.querySelector('.inspect-close')?.focus({ preventScroll: true });
          else if (!layer.contains(document.activeElement)) updated?.focus({ preventScroll: true });
        }
      }
      else { pinned = null; pinnedSelector = ''; returnFocus = null; returnSelector = ''; layer.replaceChildren(); document.getElementById('app').inert = false; }
    }
  }).observe(document.getElementById('app'), { childList: true, subtree: true });
  decorate();
})();
