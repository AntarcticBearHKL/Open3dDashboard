/** Unity dialog: bridge status, config, and "send to Unity" actions. */

import { $ } from '../lib/util.js';
import { toast } from './toast.js';
import { cartItems } from '../lib/state.js';
import {
  checkHealth,
  exportScene,
  getUnityConfig,
  placeAsset,
  setUnityConfig,
  syncLibrary,
} from '../lib/unity.js';

let els = {};
let busy = false;

export function initUnity() {
  els.dialog = $('#unity');
  els.dot = $('#unity-dot');
  els.status = $('#unity-status');
  els.base = $('#unity-base');
  els.recheck = $('#unity-recheck');
  els.placeCart = $('#unity-place-cart');
  els.sync = $('#unity-sync');
  els.export = $('#unity-export');

  const cfg = getUnityConfig();
  els.base.value = cfg.base;

  for (const btn of els.dialog.querySelectorAll('[data-close]')) {
    btn.addEventListener('click', () => els.dialog.close());
  }
  els.dialog.addEventListener('click', (e) => {
    if (e.target === els.dialog) els.dialog.close();
  });

  const persist = () => setUnityConfig({ base: els.base.value.trim() });
  els.base.addEventListener('change', persist);
  els.recheck.addEventListener('click', () => refreshUnityStatus(true));

  els.placeCart.addEventListener('click', () => placeItems(cartItems(), 'cart asset'));
  els.sync.addEventListener('click', () => runBridgeAction('sync'));
  els.export.addEventListener('click', () => runBridgeAction('export'));
}

export function openUnityDialog() {
  if (!els.dialog.open) els.dialog.showModal();
  refreshUnityStatus();
}

export async function refreshUnityStatus(announce = false) {
  setDot('checking', 'Checking…');
  const h = await checkHealth();
  if (!h.ok) {
    setDot('down', 'Local bridge is not running');
  } else if (!h.unity) {
    setDot('warn', 'Bridge is ready, but Unity is not open (MCP not listening)');
  } else {
    setDot('ok', 'Unity connected — ready to place');
  }
  if (announce) toast(h.ok ? (h.unity ? 'Unity connected' : 'Unity is not open') : 'Local bridge is not running', h.unity ? 'ok' : 'info');
  syncActions(h);
  return h;
}

function setDot(state, text) {
  for (const el of document.querySelectorAll('#unity-dot, #unity-top-dot')) {
    el.dataset.state = state;
  }
  if (els.status) els.status.textContent = text;
}

function syncActions(h) {
  const hasCart = cartItems().length > 0;
  const hint = !h.ok ? 'Local bridge is not running' : h.unity ? '' : 'Unity editor must be open';
  els.placeCart.disabled = busy || !hasCart;
  for (const btn of [els.placeCart, els.sync, els.export]) btn.title = hint;
}

function uid() {
  return globalThis.crypto?.randomUUID?.() || `rq-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** While a place is in flight, disable every "place in Unity" entry point so it cannot fire twice. */
function setPlaceBusy(on) {
  for (const el of document.querySelectorAll('[data-unity-item], #unity-place-cart, #detail-unity')) {
    el.disabled = on;
  }
}

/** Put items into the open Unity scene — one /place call per unique item. */
export async function placeItems(items, label = 'asset') {
  if (busy) return;
  // Never place the same asset twice within one action (a repeated code would create duplicates).
  const unique = [];
  const seen = new Set();
  for (const it of items) {
    if (!it?.slug || seen.has(it.code)) continue;
    seen.add(it.code);
    unique.push(it);
  }
  if (!unique.length) {
    toast('Cart is empty', 'info');
    return;
  }
  busy = true;
  setPlaceBusy(true);
  const subject = unique.length === 1 ? label : `${unique.length} ${label}s`;
  toast(`Placing ${subject} in Unity…`, 'info');
  let placed = 0;
  let firstError = '';
  for (const item of unique) {
    // One fresh requestId per item; Unity treats a repeated requestId as a retry and will not place twice.
    const res = await placeAsset(item, uid());
    if (res.ok) placed += 1;
    else if (!firstError) firstError = res.error || 'Unknown error';
  }
  busy = false;
  setPlaceBusy(false);

  if (placed === unique.length) {
    toast(unique.length === 1 ? 'Placed in Unity' : `Placed ${placed} ${label}s in Unity`, 'ok');
  } else if (placed > 0) {
    toast(`Placed ${placed}, ${unique.length - placed} failed: ${firstError}`, 'error');
  } else {
    toast(firstError || 'Place failed', 'error');
  }
  if (els.dialog?.open) refreshUnityStatus();
}

async function runBridgeAction(kind) {
  if (busy) return;
  busy = true;
  const isSync = kind === 'sync';
  toast(isSync ? 'Syncing library…' : 'Exporting scene…', 'info');
  const res = isSync ? await syncLibrary() : await exportScene();
  busy = false;
  if (res.ok) toast(isSync ? 'Library synced' : 'Scene exported', 'ok');
  else toast(res.error || (isSync ? 'Sync failed' : 'Export failed'), 'error');
  if (els.dialog?.open) refreshUnityStatus();
}
