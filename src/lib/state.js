/** Application state: manifest items, filters, cart, simple pub/sub. */

import { library } from './library.js';

const CART_KEY = 'asset-browser.cart.v1';

export const state = {
  filters: { q: '', l1: '', l2: '', tag: '', style: '', sort: 'code' },
  cart: new Set(),
  l1Options: [],
  l2ByL1: new Map(),
  tagCounts: new Map(),
  viewItems: [],
  listeners: new Set(),
};

const byCode = new Map();

export function subscribe(fn) {
  state.listeners.add(fn);
  return () => state.listeners.delete(fn);
}

function emit() {
  for (const fn of state.listeners) fn();
}

/* ------------------------------- cart ---------------------------------- */

export function loadCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    if (Array.isArray(raw)) state.cart = new Set(raw.filter((c) => typeof c === 'string'));
  } catch {
    state.cart = new Set();
  }
}

export function saveCart() {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify([...state.cart]));
  } catch {
    /* private mode: keep in memory only */
  }
}

export function cartHas(code) {
  return state.cart.has(code);
}

export function cartAdd(code) {
  if (state.cart.has(code)) return false;
  state.cart.add(code);
  saveCart();
  emit();
  return true;
}

export function cartRemove(code) {
  const ok = state.cart.delete(code);
  if (ok) {
    saveCart();
    emit();
  }
  return ok;
}

export function cartToggle(code) {
  return state.cart.has(code) ? (cartRemove(code), false) : (cartAdd(code), true);
}

export function cartClear() {
  if (!state.cart.size) return;
  state.cart.clear();
  saveCart();
  emit();
}

export function itemByCode(code) {
  return byCode.get(code) || null;
}

export function patchItem(code, patch) {
  const it = byCode.get(code);
  if (!it) return null;
  Object.assign(it, patch);
  it._hay = [it.code, it.slug, it.name_original, (it.tags || []).join(' ')].join(' ').toLowerCase();
  return it;
}

export function cartItems() {
  return [...state.cart]
    .map((code) => byCode.get(code))
    .filter(Boolean);
}

/* ------------------------------ items ---------------------------------- */

function buildIndex(items) {
  byCode.clear();
  const l1Set = new Set();
  state.l2ByL1 = new Map();
  state.tagCounts = new Map();
  for (const item of items) {
    byCode.set(item.code, item);
    item._hay = [item.code, item.slug, item.name_original, (item.tags || []).join(' ')]
      .join(' ')
      .toLowerCase();
    l1Set.add(item.l1);
    if (!state.l2ByL1.has(item.l1)) state.l2ByL1.set(item.l1, new Set());
    state.l2ByL1.get(item.l1).add(item.l2);
    for (const tag of item.tags || []) state.tagCounts.set(tag, (state.tagCounts.get(tag) || 0) + 1);
  }
  state.l1Options = [...l1Set].sort((a, b) => a.localeCompare(b));
  for (const [k, v] of state.l2ByL1) state.l2ByL1.set(k, [...v].sort((a, b) => a.localeCompare(b)));
}

export function setItems(items) {
  library.items = items;
  buildIndex(items);
  applyFilters();
  emit();
}

export function replaceItems(items) {
  library.items = items;
  buildIndex(items);
  applyFilters();
}

/* ----------------------------- filters --------------------------------- */

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

export function applyFilters() {
  const f = state.filters;
  const q = f.q.trim().toLowerCase();
  let out = library.items;
  if (q) out = out.filter((it) => it._hay.includes(q));
  if (f.l1) out = out.filter((it) => it.l1 === f.l1);
  if (f.l2) out = out.filter((it) => it.l2 === f.l2);
  if (f.tag) out = out.filter((it) => (it.tags || []).includes(f.tag));
  if (f.style) out = out.filter((it) => (it.tags || []).includes(f.style));

  const dir = f.sort === 'tri_desc' ? -1 : 1;
  const sorted = out.slice();
  if (f.sort === 'slug') sorted.sort((a, b) => collator.compare(a.slug, b.slug));
  else if (f.sort === 'tri_asc' || f.sort === 'tri_desc') {
    sorted.sort((a, b) => (Number(a.tri_count) - Number(b.tri_count)) * dir);
  } else sorted.sort((a, b) => collator.compare(a.code, b.code));
  state.viewItems = sorted;
}

export function setFilter(patch) {
  if ('l1' in patch) state.filters.l2 = '';
  Object.assign(state.filters, patch);
  applyFilters();
  emit();
}

export function clearFilters() {
  state.filters = { q: '', l1: '', l2: '', tag: '', style: '', sort: state.filters.sort };
  applyFilters();
  emit();
}

export function filtersActive() {
  const f = state.filters;
  return Boolean(f.q || f.l1 || f.l2 || f.tag || f.style);
}

/* ------------------------------ export --------------------------------- */

/** The single export record shape shared by buildExport and buildItemPayload. */
function itemRecord(it) {
  return {
    code: it.code,
    slug: it.slug,
    l1: it.l1,
    l2: it.l2,
    category: it.category,
    path: it.path,
    fbx: `${it.path}/${it.slug}.fbx`,
    lods: it.lods || [],
    textures: it.textures || [],
  };
}

export function buildExport() {
  const items = cartItems();
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    count: items.length,
    codes: items.map((it) => it.code),
    items: items.map(itemRecord),
  };
}

/** Single-asset export payload for the per-card copy action; null when unknown. */
export function buildItemPayload(code) {
  const it = byCode.get(code);
  if (!it) return null;
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    count: 1,
    codes: [it.code],
    items: [itemRecord(it)],
  };
}
