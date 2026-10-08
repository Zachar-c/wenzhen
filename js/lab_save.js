// LabSave：局内存档信封的纯编解码与 storage 读写适配。
// 普通脚本：挂到全局 LabSave，装载顺序必须在 main.js 之前。
// 纯函数不触碰浏览器全局；storage 由调用方注入（浏览器 localStorage / 测试内存适配）。
globalThis.LabSave = (() => {
  const KEY = 'wenzhen.lab.run.v1';
  const ARCHIVE_KEY = 'wenzhen.lab.archive.v1';
  const ARCHIVE_VERSION = 1;
  const ARCHIVE_LIMIT = 24;
  const SCHEMA_VERSION = 1;

  function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  function migrateRemovedMaterialState(state) {
    const migrated = { ...state };
    delete migrated.materials;
    delete migrated.materialPityByTier;
    if (isPlainObject(migrated.reward)) {
      migrated.reward = { ...migrated.reward };
      delete migrated.reward.materialIds;
      delete migrated.reward.materialPityByTier;
    }
    return migrated;
  }

  // 自定义杀招只允许保存可由当前组件规则重新派生的配方。
  // 只序列化组件配方；装备 ID 必须能在固定招式或有效自定义配方中找到。
  function repairCustomKillMoves(state) {
    let guById = null;
    let data = null;
    try {
      if (typeof DATA !== 'undefined') data = DATA;
      if (typeof GU_BY_ID !== 'undefined') guById = GU_BY_ID;
      else if (data) {
        guById = { ...(data.guSemanticsById || {}) };
        for (const gu of data.gu || []) guById[gu.id] = { ...guById[gu.id], ...gu };
      }
    } catch { /* Keep save decoding usable outside the game runtime. */ }

    const validRecipes = [];
    const validCustomIds = new Set();
    const canCompose = !!guById && typeof GuRules !== 'undefined'
      && typeof GuRules.composeKillMove === 'function';
    if (canCompose) {
      for (const recipe of Array.isArray(state.customMoveRecipes) ? state.customMoveRecipes : []) {
        const result = GuRules.composeKillMove(recipe, guById);
        if (!result?.ok || !result.move?.id || validCustomIds.has(result.move.id)) continue;
        validRecipes.push([...result.move.recipe]);
        validCustomIds.add(result.move.id);
      }
    } else {
      // Unit-only storage consumers may not load gameplay rules. Preserve only
      // well-shaped component recipes there; the browser runtime rechecks them.
      for (const recipe of Array.isArray(state.customMoveRecipes) ? state.customMoveRecipes : []) {
        if (!Array.isArray(recipe) || recipe.length < 2 || recipe.length > 3
          || !recipe.every(id => typeof id === 'string' && /^[a-z0-9_]+$/.test(id))) continue;
        const sorted = [...recipe].sort();
        const id = `km_custom_${sorted.join('__')}`;
        if (validCustomIds.has(id)) continue;
        validRecipes.push(sorted);
        validCustomIds.add(id);
      }
    }

    const knownMoveIds = new Set();
    for (const move of data?.killMoves || []) if (move?.id) knownMoveIds.add(move.id);
    for (const id of validCustomIds) knownMoveIds.add(id);

    const equipped = Array.isArray(state.equipped) ? state.equipped.filter(id => {
      if (knownMoveIds.size) return knownMoveIds.has(id);
      return typeof id !== 'string' || !id.startsWith('km_custom_');
    }) : state.equipped;
    const repaired = { ...state, equipped };
    if (Array.isArray(state.customMoveRecipes) || validRecipes.length) repaired.customMoveRecipes = validRecipes;
    else delete repaired.customMoveRecipes;
    delete repaired.customMoveCosts;
    delete repaired.customMoveEffects;
    return repaired;
  }

  function missingCriticalState(state) {
    if (!isPlainObject(state)) return true;
    if (typeof state.seed !== 'number' || !Number.isFinite(state.seed)) return true;
    if (!isPlainObject(state.journey)) return true;
    const journey = state.journey;
    if (typeof journey.difficulty !== 'string' || !journey.difficulty) return true;
    if (!isPlainObject(journey.graph)) return true;
    if (!Array.isArray(journey.graph.nodes)) return true;
    if (!Array.isArray(journey.graph.roots)) return true;
    if (!Array.isArray(journey.availableNodeIds)) return true;
    if (!Array.isArray(journey.completed)) return true;
    if (typeof journey.started !== 'boolean') return true;
    if (!isPlainObject(state.owned)) return true;
    if (typeof state.stones !== 'number' || !Number.isFinite(state.stones)) return true;
    if (typeof state.blood !== 'number' || !Number.isFinite(state.blood)) return true;
    if (!Array.isArray(state.shopSold)) return true;
    if (!Array.isArray(state.equipped)) return true;
    const componentIds = (recipe) => Array.isArray(recipe)
      && recipe.length <= 3 && recipe.every(id => typeof id === 'string' && /^[a-z0-9_]+$/.test(id));
    if (state.killmoveDraft != null && !componentIds(state.killmoveDraft)) return true;
    if (state.customMoveRecipes != null && (!Array.isArray(state.customMoveRecipes)
      || !state.customMoveRecipes.every(recipe => componentIds(recipe) && recipe.length >= 2))) return true;
    if (!Array.isArray(state.journal)) return true;
    if (!Array.isArray(state.eventLog)) return true;
    if (state.travelSoulDebt != null) {
      const debt = state.travelSoulDebt;
      if (!isPlainObject(debt) || !Number.isInteger(debt.cost) || debt.cost <= 0
        || !['eventId', 'title', 'nodeId'].every(key => typeof debt[key] === 'string' && debt[key].length > 0)) return true;
    }
    if (typeof state.page !== 'string' || !state.page) return true;
    if (state.battle != null) {
      if (!isPlainObject(state.battle)) return true;
      if (!Array.isArray(state.battle.enemies)) return true;
    }
    return false;
  }

  function encode(state, contentVersion) {
    return JSON.stringify({
      schemaVersion: SCHEMA_VERSION,
      contentVersion,
      state,
    });
  }

  function decode(text, contentVersion, compatibleContentVersions = []) {
    if (typeof text !== 'string' || text.length === 0) {
      return { ok: false, reason: 'empty' };
    }
    let envelope;
    try {
      envelope = JSON.parse(text);
    } catch {
      return { ok: false, reason: 'bad_json', raw: text };
    }
    if (!isPlainObject(envelope)) {
      return { ok: false, reason: 'bad_envelope', raw: text };
    }
    if (Number(envelope.schemaVersion) !== SCHEMA_VERSION) {
      return { ok: false, reason: 'schema_mismatch', raw: text };
    }
    const legacyContentVersion = envelope.contentVersion !== contentVersion
      && Array.isArray(compatibleContentVersions)
      && compatibleContentVersions.includes(envelope.contentVersion);
    if (envelope.contentVersion !== contentVersion && !legacyContentVersion) {
      return { ok: false, reason: 'content_mismatch', raw: text };
    }
    if (missingCriticalState(envelope.state)) {
      return { ok: false, reason: 'missing_state', raw: text };
    }
    return {
      ok: true,
      state: repairCustomKillMoves(migrateRemovedMaterialState(envelope.state)),
      legacyContentVersion: legacyContentVersion ? envelope.contentVersion : '',
    };
  }

  function storageError(error) {
    if (error && error.name === 'QuotaExceededError') {
      return { ok: false, reason: 'quota', error: String(error && error.message ? error.message : error) };
    }
    return { ok: false, reason: 'storage_error', error: String(error && error.message ? error.message : error) };
  }

  function write(storage, state, contentVersion) {
    try {
      if (!storage || typeof storage.setItem !== 'function') {
        return { ok: false, reason: 'storage_error', error: 'storage unavailable' };
      }
      storage.setItem(KEY, encode(repairCustomKillMoves(state), contentVersion));
      return { ok: true };
    } catch (error) {
      return storageError(error);
    }
  }

  function read(storage, contentVersion, compatibleContentVersions = []) {
    try {
      if (!storage || typeof storage.getItem !== 'function') {
        return { ok: false, reason: 'storage_error', error: 'storage unavailable' };
      }
      const text = storage.getItem(KEY);
      if (text == null) {
        return { ok: false, reason: 'empty', empty: true };
      }
      const decoded = decode(String(text), contentVersion, compatibleContentVersions);
      if (!decoded.ok) {
        return {
          ok: false,
          reason: decoded.reason,
          raw: decoded.raw != null ? decoded.raw : String(text),
        };
      }
      return {
        ok: true,
        state: decoded.state,
        legacyContentVersion: decoded.legacyContentVersion || '',
      };
    } catch (error) {
      return storageError(error);
    }
  }

  function clear(storage) {
    try {
      if (!storage || typeof storage.removeItem !== 'function') {
        return { ok: false, reason: 'storage_error', error: 'storage unavailable' };
      }
      storage.removeItem(KEY);
      return { ok: true };
    } catch (error) {
      return storageError(error);
    }
  }

  function readArchive(storage) {
    try {
      if (!storage || typeof storage.getItem !== 'function') {
        return { ok: false, reason: 'storage_error', error: 'storage unavailable' };
      }
      const text = storage.getItem(ARCHIVE_KEY);
      if (text == null) return { ok: true, runs: [] };
      const envelope = JSON.parse(String(text));
      if (!isPlainObject(envelope)
        || Number(envelope.archiveVersion) !== ARCHIVE_VERSION
        || !Array.isArray(envelope.runs)) {
        return { ok: false, reason: 'archive_mismatch', raw: String(text) };
      }
      return { ok: true, runs: envelope.runs.filter(isPlainObject).slice(0, ARCHIVE_LIMIT) };
    } catch (error) {
      return { ok: false, reason: 'archive_unreadable', raw: String(error?.message || error) };
    }
  }

  function appendArchive(storage, record) {
    if (!isPlainObject(record) || !String(record.id || '')) {
      return { ok: false, reason: 'bad_archive_record' };
    }
    const current = readArchive(storage);
    if (!current.ok) return current;
    if (current.runs.some((run) => String(run.id || '') === String(record.id))) {
      return { ok: true, duplicate: true, runs: current.runs };
    }
    const runs = [record, ...current.runs].slice(0, ARCHIVE_LIMIT);
    try {
      if (!storage || typeof storage.setItem !== 'function') {
        return { ok: false, reason: 'storage_error', error: 'storage unavailable' };
      }
      storage.setItem(ARCHIVE_KEY, JSON.stringify({ archiveVersion: ARCHIVE_VERSION, runs }));
      return { ok: true, runs };
    } catch (error) {
      return storageError(error);
    }
  }

  return {
    KEY,
    ARCHIVE_KEY,
    SCHEMA_VERSION,
    encode,
    decode,
    write,
    read,
    clear,
    missingCriticalState,
    readArchive,
    appendArchive,
  };
})();
