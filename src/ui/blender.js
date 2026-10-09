/** Blender dialog: bridge status, config, and "send to Blender" actions. */

import { $ } from '../lib/util.js';
import { toast } from './toast.js';
import { cartItems } from '../lib/state.js';
import {
  checkHealth,
  getBlenderConfig,
  sendToBlender,
  setBlenderConfig,
} from '../lib/blender.js';

let els = {};
let busy = false;

export function initBlender() {
  els.dialog = $('#blender');
  els.dot = $('#blender-dot');
  els.status = $('#blender-status');
  els.root = $('#blender-root');
  els.base = $('#blender-base');
  els.importCart = $('#blender-import-cart');
  els.openCart = $('#blender-open-cart');
  els.recheck = $('#blender-recheck');

  const cfg = getBlenderConfig();
  els.root.value = cfg.root;
  els.base.value = cfg.base;

  for (const btn of els.dialog.querySelectorAll('[data-close]')) {
    btn.addEventListener('click', () => els.dialog.close());
  }
  els.dialog.addEventListener('click', (e) => {
    if (e.target === els.dialog) els.dialog.close();
  });

  const persist = () => setBlenderConfig({ root: els.root.value.trim(), base: els.base.value.trim() });
  els.root.addEventListener('change', persist);
  els.base.addEventListener('change', persist);
  els.recheck.addEventListener('click', () => refreshStatus(true));

  els.importCart.addEventListener('click', () => sendItems(cartItems(), 'import', 'cart item'));
  els.openCart.addEventListener('click', () => sendItems(cartItems(), 'open', 'cart item'));
}

export function openBlenderDialog() {
  if (!els.dialog.open) els.dialog.showModal();
  refreshStatus();
}

export async function refreshStatus(announce = false) {
  setDot('checking', 'Checking…');
  const h = await checkHealth();
  if (!h.bridge) {
    setDot('down', 'Local bridge is not running');
  } else if (!h.blender) {
    setDot('warn', 'Bridge is ready, but Blender is not open (MCP addon not listening)');
  } else {
    setDot('ok', 'Blender connected — ready to import');
  }
  if (announce) toast(h.bridge ? (h.blender ? 'Blender connected' : 'Blender is not open') : 'Local bridge is not running', h.blender ? 'ok' : 'info');
  syncActions(h);
  return h;
}

function setDot(state, text) {
  for (const el of document.querySelectorAll('#blender-dot, #blender-top-dot')) {
    el.dataset.state = state;
  }
  if (els.status) els.status.textContent = text;
}

function syncActions(h) {
  const hasCart = cartItems().length > 0;
  els.importCart.disabled = !hasCart;
  els.openCart.disabled = !hasCart;
  els.importCart.title = h.blender ? '' : 'Blender must be open';
}

export async function sendItems(items, mode, label = 'asset') {
  if (busy) return;
  if (!items.length) {
    toast('Cart is empty', 'info');
    return;
  }
  busy = true;
  const verb = mode === 'open' ? 'Opening' : 'Importing';
  const noun = items.length === 1 ? label : `${items.length} ${label}s`;
  const where = mode === 'open' ? 'in a new Blender window' : 'to Blender';
  toast(`${verb} ${noun} ${where}…`, 'info');
  const res = await sendToBlender(mode, items);
  busy = false;

  if (mode === 'open') {
    if (res.ok) toast(`Opened ${noun} in a new Blender`, 'ok');
    else toast(`Failed to launch: ${res.error || 'Unknown error'}`, 'error');
  } else if (res.ok) {
    const n = res.result?.result?.count ?? items.length;
    toast(`Imported ${n} ${n === 1 ? label : `${label}s`} to Blender`, 'ok');
  } else {
    toast(res.error || 'Import failed', 'error');
  }
  if (els.dialog?.open) refreshStatus();
}
