/** Client for the local Blender bridge (bridge/blender_bridge.py). */

const KEY = 'asset-browser.blender.v1';
const DEFAULTS = { base: 'http://127.0.0.1:9877', root: 'D:\\3D Resource' };

export function getBlenderConfig() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { ...DEFAULTS, ...raw };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setBlenderConfig(patch) {
  const next = { ...getBlenderConfig(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
  return next;
}

export function bridgeUrl(path) {
  const base = getBlenderConfig().base.replace(/\/+$/, '');
  return `${base}${path}`;
}

export function absoluteFbx(item) {
  const root = getBlenderConfig().root.replace(/[\\/]+$/, '');
  const rel = `${item.path}/${item.slug}.fbx`.replace(/\//g, '\\');
  return `${root}\\${rel}`;
}

export async function checkHealth(timeoutMs = 2500) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(bridgeUrl('/health'), { signal: ctrl.signal });
    return await res.json();
  } catch {
    return { bridge: false, blender: false };
  } finally {
    clearTimeout(timer);
  }
}

export async function sendToBlender(mode, items, timeoutMs = 120000) {
  const cfg = getBlenderConfig();
  const payloadItems = items.filter(Boolean).map((it) => ({
    fbx: absoluteFbx(it),
    library_root: cfg.root,
    asset_rel: it.path,
    slug: it.slug,
    code: it.code,
  }));
  if (!payloadItems.length) return { ok: false, error: 'No assets to import' };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(bridgeUrl(`/${mode}`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: payloadItems.map((p) => p.fbx), items: payloadItems }),
      signal: ctrl.signal,
    });
    return await res.json();
  } catch (err) {
    return { ok: false, error: `Cannot reach the local bridge (${cfg.base}): ${err.message || err}` };
  } finally {
    clearTimeout(timer);
  }
}
