/**
 * Boot + wiring.
 * Two data sources: File System Access (primary) and ?base= HTTP (fallback).
 * The detail panel is code-split and only loaded when a detail is first opened.
 */

import './styles.css';
import { $, debounce, escapeHtml, formatInt, copyText } from './lib/util.js';
import * as lib from './lib/library.js';
import * as store from './lib/state.js';
import { brandMark, icon } from './ui/icons.js';
import { initGrid, renderView, syncCartState, scrollGridTop, updateCard } from './ui/grid.js';
import { initCart, renderCart } from './ui/cart.js';
import { initBlender, openBlenderDialog, refreshStatus, sendItems } from './ui/blender.js';
import { initUnity, openUnityDialog, placeItems, refreshUnityStatus } from './ui/unity.js';
import { toast } from './ui/toast.js';

const els = {};
let detail = null; // lazily imported (keeps the detail spec/preview UI out of the first paint bundle)
let lastView = null;
let lastCartSig = '';

/* ------------------------------------------------------------ bootstrap */

function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    el.innerHTML = icon(el.dataset.icon, Number(el.dataset.size || 16));
  });
}

function cacheEls() {
  els.app = $('#app');
  els.welcome = $('#welcome');
  els.welcomeHint = $('#welcome-hint');
  els.pickDir = $('#pick-dir');
  els.httpHint = $('#http-hint');
  els.sourceChip = $('#source-chip');
  els.q = $('#q');
  els.qClear = $('#q-clear');
  els.l1 = $('#l1');
  els.l2 = $('#l2');
  els.sort = $('#sort');
  els.style = $('#style');
  els.refreshAll = $('#refresh-all');
  els.count = $('#count');
  els.filtersRow = $('#filters-row');
  els.activeFilters = $('#active-filters');
}

async function ensureDetail() {
  if (detail) return detail;
  detail = await import('./ui/detail.js');
  detail.initDetail({ onTag, onCategory, onCartChanged: () => {}, onRefresh: refreshItem });
  return detail;
}

async function openDetailByCode(code) {
  const mod = await ensureDetail();
  const item = store.itemByCode(code);
  if (item) mod.openDetail(item);
}

/* ------------------------------------------------------------- callbacks */

function onToggleCart(code) {
  const added = store.cartToggle(code);
  toast(added ? `Added ${code}` : `Removed ${code}`, added ? 'ok' : 'info');
}

async function onCopyItem(code) {
  const item = store.itemByCode(code);
  if (!item) return;
  const payload = store.buildItemPayload(code);
  const ok = payload ? await copyText(JSON.stringify(payload, null, 2)) : false;
  if (ok) toast(`Copied asset data for ${code}`, 'ok');
  else toast(`Failed to copy ${code}`, 'error');
}

async function onBlenderItem(code) {
  const item = store.itemByCode(code);
  if (!item) return;
  await sendItems([item], 'import', 'current asset');
}

async function onUnityItem(code) {
  const item = store.itemByCode(code);
  if (!item) return;
  await placeItems([item], 'current asset');
}

function onTag(tag) {
  store.setFilter({ tag });
  scrollGridTop();
}

function onCategory(l1, l2) {
  store.setFilter({ l1, l2 });
  populateL2();
  scrollGridTop();
}

function onClearFilters() {
  store.clearFilters();
  els.q.value = '';
  populateL2();
}

async function refreshItem(code) {
  const item = store.itemByCode(code);
  if (!item) return;
  try {
    const txt = await lib.getText(`${item.path}/${item.slug}.json`);
    const j = JSON.parse(txt);
    const patch = {};
    if (j.dimensions_m) patch.dimensions_m = j.dimensions_m;
    if (Array.isArray(j.textures)) {
      patch.textures = j.textures;
      patch.n_tex = j.textures.length;
    }
    if (typeof j.tri_count === 'number') patch.tri_count = j.tri_count;
    patch.untextured = Boolean(j.untextured);
    if (j.description) patch.description = j.description;
    if (Array.isArray(j.tags)) patch.tags = j.tags;
    const updated = store.patchItem(code, patch) || item;
    const url = await lib.refreshUrl(updated.preview || `${updated.path}/${updated.slug}.png`);
    updateCard(code, updated, url);
    detail?.refreshCurrent?.(updated, url);
    toast(`Refreshed ${code}`, 'ok');
  } catch (err) {
    toast(`Failed to refresh ${code}: ${err?.message || err}`, 'error');
  }
}

async function refreshAll() {
  if (!lib.isLoaded()) return;
  els.refreshAll.disabled = true;
  const scroller = $('#grid-scroll');
  const top = scroller ? scroller.scrollTop : 0;
  try {
    const items = await lib.reloadManifest();
    store.replaceItems(items);
    lastView = store.state.viewItems;
    renderView(lastView);
    populateL1();
    updateCount();
    renderActiveFilters();
    syncControls();
    if (scroller) scroller.scrollTop = top;
    toast(`Refreshed (${formatInt(items.length)} assets)`, 'ok');
  } catch (err) {
    toast(`Refresh failed: ${err?.message || err}`, 'error');
  } finally {
    els.refreshAll.disabled = false;
  }
}

/* --------------------------------------------------------------- render */

function updateCount() {
  const shown = store.state.viewItems.length;
  const total = lib.library.items.length;
  els.count.textContent =
    shown === total ? `${formatInt(total)} assets` : `${formatInt(total)} assets · ${formatInt(shown)} matching`;
  document.title = `3D Asset Browser · ${formatInt(shown)}/${formatInt(total)}`;
}

function chipHtml(label, key) {
  return `<button class="chip chip--active" data-clear="${key}" title="Remove this filter">${escapeHtml(label)}<span class="chip__x" aria-hidden="true">${icon('x', 11)}</span></button>`;
}

function renderActiveFilters() {
  const f = store.state.filters;
  const chips = [];
  if (f.q) chips.push(chipHtml(`Search “${f.q}”`, 'q'));
  if (f.l1) chips.push(chipHtml(f.l1, 'l1'));
  if (f.l2) chips.push(chipHtml(`${f.l1} / ${f.l2}`, 'l2'));
  if (f.tag) chips.push(chipHtml(`Tag ${f.tag}`, 'tag'));
  if (f.style) chips.push(chipHtml(`Style ${f.style}`, 'style'));
  els.activeFilters.innerHTML = chips.length
    ? `${chips.join('')}<button class="btn btn--ghost btn--sm" data-clear-all>Clear filters</button>`
    : '';
  els.filtersRow.hidden = chips.length === 0;
}

function populateL2() {
  const l1 = store.state.filters.l1;
  const options = l1 ? store.state.l2ByL1.get(l1) || [] : [];
  els.l2.innerHTML =
    '<option value="">All subcategories</option>' +
    options.map((o) => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('');
  els.l2.disabled = !l1;
  els.l2.value = store.state.filters.l2;
}

function populateL1() {
  els.l1.innerHTML =
    '<option value="">All categories</option>' +
    store.state.l1Options.map((o) => `<option value="${escapeHtml(o)}">${escapeHtml(o)}</option>`).join('');
  els.l1.value = store.state.filters.l1;
  populateL2();
}

function syncControls() {
  const f = store.state.filters;
  if (document.activeElement !== els.q && els.q.value !== f.q) els.q.value = f.q;
  els.qClear.hidden = !f.q;
  els.l1.value = f.l1;
  els.l2.value = f.l2;
  els.sort.value = f.sort;
  els.style.value = f.style;
}

store.subscribe(() => {
  const view = store.state.viewItems;
  if (view !== lastView) {
    lastView = view;
    renderView(view);
    updateCount();
    renderActiveFilters();
    syncControls();
  }
  const sig = [...store.state.cart].join(',');
  if (sig !== lastCartSig) {
    lastCartSig = sig;
    renderCart();
    detail?.refreshCartButton?.();
  }
  syncCartState();
});

/* ---------------------------------------------------------------- load */

function onLibraryReady(items) {
  store.setItems(items);
  els.app.hidden = false;
  els.welcome.hidden = true;
  els.sourceChip.textContent = lib.sourceLabel();
  els.sourceChip.title = lib.library.mode === 'http' ? `HTTP base URL: ${lib.library.base}` : 'Read via File System Access';
  for (const el of [els.q, els.l1, els.l2, els.sort, els.style]) el.disabled = false;
  populateL1();
  renderCart();
  lastCartSig = [...store.state.cart].join(',');
  syncCartState();
  if (store.state.cart.size) toast(`Cart restored from last session (${store.state.cart.size} items)`, 'info');
  toast(`Loaded ${formatInt(items.length)} assets`, 'ok');
  const openCode = new URLSearchParams(window.location.search).get('open');
  if (openCode) openDetailByCode(openCode);
}

function showWelcomeError(message) {
  els.welcomeHint.classList.toggle('is-error', Boolean(message));
  els.welcomeHint.textContent = message || '';
}

async function startFsa() {
  if (!lib.fsSupported()) return;
  els.pickDir.disabled = true;
  showWelcomeError('');
  try {
    const items = await lib.openDirectory();
    onLibraryReady(items);
  } catch (err) {
    if (err?.name !== 'AbortError') {
      showWelcomeError(err?.message || String(err));
      toast('Failed to open folder', 'error');
    }
  } finally {
    els.pickDir.disabled = false;
  }
}

async function startHttp(base) {
  try {
    showWelcomeError('');
    const items = await lib.openHttp(base);
    onLibraryReady(items);
  } catch (err) {
    showWelcomeError(err?.message || String(err));
  }
}

const HTTP_HINT = `HTTP mode is for local testing or browsers without File System Access support:
1. In this project folder run <code>npm run dev</code>
2. In another terminal, serve the library: <code>npx serve "D:\\3D Resource"</code>
3. Open <code>http://localhost:5199/?base=http://localhost:3000/</code>
(?base= points at the library root; the server must allow cross-origin reads)`;

/* -------------------------------------------------------------- wiring */

function bindUi() {
  hydrateIcons();
  $('#brand-mark').innerHTML = brandMark(24);
  $('#welcome-mark').innerHTML = brandMark(30);

  initGrid({
    onOpen: openDetailByCode,
    onToggleCart,
    onCopyItem,
    onBlenderItem,
    onUnityItem,
    isInCart: store.cartHas,
    onTag,
    onClearFilters,
    filtersActive: store.filtersActive,
  });
  initCart({ onOpen: openDetailByCode });
  initBlender();
  initUnity();

  els.pickDir.addEventListener('click', startFsa);
  els.httpHint.addEventListener('click', () => {
    els.welcomeHint.classList.remove('is-error');
    els.welcomeHint.innerHTML = HTTP_HINT;
  });

  const onSearch = debounce(() => store.setFilter({ q: els.q.value }), 140);
  els.q.addEventListener('input', () => {
    els.qClear.hidden = !els.q.value;
    onSearch();
  });
  els.qClear.addEventListener('click', () => {
    els.q.value = '';
    els.qClear.hidden = true;
    store.setFilter({ q: '' });
    els.q.focus();
  });
  els.l1.addEventListener('change', () => {
    store.setFilter({ l1: els.l1.value, l2: '' });
    populateL2();
    scrollGridTop();
  });
  els.l2.addEventListener('change', () => {
    store.setFilter({ l2: els.l2.value });
    scrollGridTop();
  });
  els.sort.addEventListener('change', () => {
    store.setFilter({ sort: els.sort.value });
    scrollGridTop();
  });
  els.style.addEventListener('change', () => {
    store.setFilter({ style: els.style.value });
    scrollGridTop();
  });

  els.activeFilters.addEventListener('click', (event) => {
    if (event.target.closest('[data-clear-all]')) {
      onClearFilters();
      return;
    }
    const chip = event.target.closest('[data-clear]');
    if (!chip) return;
    const key = chip.dataset.clear;
    if (key === 'q') {
      els.q.value = '';
      els.qClear.hidden = true;
      store.setFilter({ q: '' });
    } else if (key === 'l1') {
      store.setFilter({ l1: '' });
      populateL2();
    } else if (key === 'l2') {
      store.setFilter({ l2: '' });
    } else if (key === 'tag') {
      store.setFilter({ tag: '' });
    } else if (key === 'style') {
      store.setFilter({ style: '' });
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) {
      event.preventDefault();
      els.q.focus();
    }
    if (event.key === 'Escape' && document.activeElement === els.q && els.q.value) {
      els.q.value = '';
      els.qClear.hidden = true;
      store.setFilter({ q: '' });
    }
  });

  const blenderBtn = $('#blender-open');
  if (blenderBtn) blenderBtn.addEventListener('click', openBlenderDialog);
  const unityBtn = $('#unity-open');
  if (unityBtn) unityBtn.addEventListener('click', openUnityDialog);
  els.refreshAll?.addEventListener('click', refreshAll);
  refreshStatus();
  refreshUnityStatus();
  setInterval(() => {
    refreshStatus();
    refreshUnityStatus();
  }, 15000);
}

function boot() {
  cacheEls();
  store.loadCart();
  bindUi();

  const base = lib.baseFromUrl();
  if (base) {
    startHttp(base);
    return;
  }
  if (!lib.fsSupported()) {
    els.pickDir.disabled = true;
    els.pickDir.title = 'This browser does not support the File System Access API';
    showWelcomeError(
      'This browser does not support the File System Access API (Chrome / Edge required). Use HTTP mode instead: ' +
        'start a static server and open this page with ?base=<library URL>, or click “How to use HTTP mode” for the steps.',
    );
  }
}

boot();
