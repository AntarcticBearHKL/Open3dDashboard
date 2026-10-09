/** Client for the local Unity bridge (bridge/unity_bridge.py). */

const KEY = 'asset-browser.unity.v1';
const DEFAULTS = { base: 'http://127.0.0.1:9878' };

export function getUnityConfig() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { ...DEFAULTS, ...raw };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setUnityConfig(patch) {
  const next = { ...getUnityConfig(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
  return next;
}

export function bridgeUrl(path) {
  const base = getUnityConfig().base.replace(/\/+$/, '');
  return `${base}${path}`;
}

/** Health payload: { ok: bridge reachable, unity: editor + MCP reachable }. */
export async function checkHealth(timeoutMs = 2500) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(bridgeUrl('/health'), { signal: ctrl.signal });
    return await res.json();
  } catch {
    return { ok: false, unity: false };
  } finally {
    clearTimeout(timer);
  }
}

/** The item fields the bridge gets; Unity resolves the fbx from the manifest by slug. */
function itemPayload(item) {
  return {
    slug: item.slug,
    code: item.code,
    l1: item.l1,
    l2: item.l2,
    category: item.category,
    path: item.path,
  };
}

async function post(path, body, timeoutMs = 120000) {
  const cfg = getUnityConfig();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(bridgeUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    return await res.json();
  } catch (err) {
    return { ok: false, error: `Cannot reach the local bridge (${cfg.base}): ${err.message || err}` };
  } finally {
    clearTimeout(timer);
  }
}

/** POST /place {slug, code, l1, l2, category, path, requestId} — put one asset into the open Unity scene.
 *  requestId makes the call idempotent in Unity: retrying the same request must never place a second copy. */
export function placeAsset(item, requestId, timeoutMs) {
  if (!item?.slug) return Promise.resolve({ ok: false, error: 'Missing slug' });
  return post('/place', { ...itemPayload(item), requestId: requestId || '' }, timeoutMs);
}

/** POST /sync — ask Unity to re-read the asset library manifest. */
export function syncLibrary(timeoutMs) {
  return post('/sync', {}, timeoutMs);
}

/** POST /export — ask Unity to write the current scene back to the asset library. */
export function exportScene(timeoutMs) {
  return post('/export', {}, timeoutMs);
}
