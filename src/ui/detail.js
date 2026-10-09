/** Asset detail panel: preview image + spec, cart, and "open in Blender". */

import { escapeHtml, formatDims, formatInt } from '../lib/util.js';
import { getUrl } from '../lib/library.js';
import { cartHas, cartToggle } from '../lib/state.js';
import { icon } from './icons.js';
import { sendItems } from './blender.js';
import { placeItems } from './unity.js';

let els = {};
let ctx = {};
let current = null;

export function initDetail(context) {
  ctx = context;
  els.dialog = document.querySelector('#detail');
  els.preview = document.querySelector('#detail-preview');
  els.previewPh = document.querySelector('#detail-preview-ph');
  els.previewBadge = document.querySelector('#detail-preview-badge');
  els.spec = document.querySelector('#detail-spec');
  els.body = document.querySelector('#detail-body');
  els.title = document.querySelector('#detail-title');
  els.code = document.querySelector('#detail-code');
  els.cat = document.querySelector('#detail-cat');
  els.cart = document.querySelector('#detail-cart');
  els.blender = document.querySelector('#detail-blender');
  els.unity = document.querySelector('#detail-unity');
  els.refresh = document.querySelector('#detail-refresh');

  for (const btn of els.dialog.querySelectorAll('[data-close]')) {
    btn.addEventListener('click', closeDetail);
  }
  els.dialog.addEventListener('click', (event) => {
    if (event.target === els.dialog) closeDetail();
  });
  els.dialog.addEventListener('close', () => {
    current = null;
  });

  els.cart.addEventListener('click', () => {
    if (!current) return;
    cartToggle(current.code);
    syncCartButton();
    ctx.onCartChanged?.();
  });

  els.blender.addEventListener('click', () => {
    if (current) sendItems([current], 'import', 'current asset');
  });

  els.unity.addEventListener('click', () => {
    if (current) placeItems([current], 'current asset');
  });

  els.refresh?.addEventListener('click', () => {
    if (current) ctx.onRefresh?.(current.code);
  });

  els.spec.addEventListener('click', (event) => {
    const tag = event.target.closest('[data-tag]');
    if (tag) {
      closeDetail();
      ctx.onTag(tag.dataset.tag);
      return;
    }
    const cat = event.target.closest('[data-l1],[data-l2]');
    if (cat) {
      closeDetail();
      ctx.onCategory(cat.dataset.l1 || '', cat.dataset.l2 || '');
    }
  });
}

export function openDetail(item) {
  current = item;
  renderSpec(item);
  renderPreview(item);
  if (!els.dialog.open) els.dialog.showModal();
}

export function closeDetail() {
  if (els.dialog?.open) els.dialog.close();
}

export function refreshCartButton() {
  syncCartButton();
}

export function refreshCurrent(item, url) {
  if (!current || current.code !== item.code) return;
  current = item;
  renderSpec(item);
  if (url) {
    els.preview.hidden = false;
    els.previewPh.hidden = true;
    els.previewBadge.textContent = textureBadge(item);
    els.preview.src = url;
  }
}

function textureBadge(item) {
  if (item.untextured) return 'No textures';
  const n = Number(item.n_tex) || 0;
  return `${n} texture${n === 1 ? '' : 's'}`;
}

async function renderPreview(item) {
  els.preview.hidden = false;
  els.previewPh.hidden = true;
  els.preview.removeAttribute('src');
  els.previewBadge.textContent = textureBadge(item);
  const rel = item.preview || `${item.path}/${item.slug}.png`;
  try {
    const url = await getUrl(rel);
    if (current !== item) return;
    els.preview.onerror = () => {
      els.preview.hidden = true;
      els.previewPh.hidden = false;
    };
    els.preview.src = url;
  } catch {
    els.preview.hidden = true;
    els.previewPh.hidden = false;
  }
}

function syncCartButton() {
  if (!current || !els.cart) return;
  const inCart = cartHas(current.code);
  els.cart.classList.toggle('is-in', inCart);
  els.cart.innerHTML = `${icon(inCart ? 'check' : 'plus', 20)}<span>${inCart ? 'Remove from cart' : 'Add to cart'}</span>`;
}

function renderSpec(item) {
  els.code.textContent = item.code;
  els.title.textContent = item.slug;
  els.title.title = item.slug;
  els.cat.innerHTML =
    `<button class="chip chip--link" data-l1="${escapeHtml(item.l1)}">${escapeHtml(item.l1)}</button>` +
    '<span class="sep">/</span>' +
    `<button class="chip chip--link" data-l2="${escapeHtml(item.l2)}">${escapeHtml(item.l2)}</button>`;

  const dims = item.dimensions_m || {};
  const lods = item.lods || [];
  const texs = item.textures || [];
  els.body.innerHTML = `
    <section class="spec">
      <h3 class="spec__label">Identity</h3>
      <dl class="kv mono">
        <div><dt>Original name</dt><dd>${escapeHtml(item.name_original || '-')}</dd></div>
        <div><dt>ID</dt><dd>${escapeHtml(item.id || '-')}</dd></div>
      </dl>
      ${item.description ? `<p class="spec__desc">${escapeHtml(item.description)}</p>` : ''}
    </section>
    <section class="spec">
      <h3 class="spec__label">Tags</h3>
      <div class="cluster">
        ${(item.tags || []).map((t) => `<button class="chip chip--tag" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join('') || '<span class="spec__none">No tags</span>'}
      </div>
    </section>
    <section class="spec">
      <h3 class="spec__label">Specs</h3>
      <dl class="kv mono">
        <div><dt>Triangles</dt><dd>${formatInt(item.tri_count)}</dd></div>
        <div><dt>Size W×H×D</dt><dd>${escapeHtml(formatDims(dims))}</dd></div>
        <div><dt>Textures</dt><dd>${Number(item.n_tex) || 0}${item.untextured ? ' · none' : ''}</dd></div>
        <div><dt>LODs</dt><dd>${lods.length || 1}</dd></div>
      </dl>
    </section>
    <section class="spec">
      <h3 class="spec__label">LOD files</h3>
      <ul class="spec__list mono">${lods.map((l) => `<li>${escapeHtml(l)}</li>`).join('') || '<li class="spec__none">-</li>'}</ul>
    </section>
    <section class="spec">
      <h3 class="spec__label">Textures <span class="spec__count">${texs.length}</span></h3>
      <ul class="texlist">${texs.map((t) => `<li class="texrow"><span class="dot dot--ok"></span><span class="texrow__name mono" title="${escapeHtml(t)}">${escapeHtml(t.split('/').pop() || t)}</span></li>`).join('') || '<li class="spec__none">No textures</li>'}</ul>
    </section>
    <section class="spec">
      <h3 class="spec__label">Paths</h3>
      <p class="spec__path mono">${escapeHtml(item.path)}</p>
      <p class="spec__path mono">${escapeHtml(`${item.path}/${item.slug}.fbx`)}</p>
    </section>`;
  els.spec.scrollTop = 0;
  syncCartButton();
}
