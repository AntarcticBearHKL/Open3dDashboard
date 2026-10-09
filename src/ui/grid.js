/**
 * Asset wall: chunked rendering (160 per page) + lazy previews.
 * The scroll owner is #grid-scroll (see DESIGN.md §4); a sentinel element
 * inside it triggers the next chunk through an IntersectionObserver.
 */

import { $, escapeHtml } from '../lib/util.js';
import { icon } from './icons.js';
import { watchImage } from './lazy.js';

const CHUNK = 160;

let els = {};
let ctx = {};
let items = [];
let rendered = 0;
let sentinelObs = null;

export function initGrid(context) {
  ctx = context;
  els.grid = $('#grid');
  els.sentinel = $('#grid-sentinel');
  els.empty = $('#empty');
  els.grid.addEventListener('click', onClick);
  sentinelObs = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) renderChunk();
    },
    { rootMargin: '900px 0px' },
  );
}

function onClick(event) {
  const cartBtn = event.target.closest('[data-cart]');
  if (cartBtn) {
    event.preventDefault();
    ctx.onToggleCart(cartBtn.dataset.cart);
    return;
  }
  const copyBtn = event.target.closest('[data-copy-item]');
  if (copyBtn) {
    event.preventDefault();
    ctx.onCopyItem(copyBtn.dataset.copyItem);
    return;
  }
  const blenderBtn = event.target.closest('[data-blender-item]');
  if (blenderBtn) {
    event.preventDefault();
    ctx.onBlenderItem(blenderBtn.dataset.blenderItem);
    return;
  }
  const unityBtn = event.target.closest('[data-unity-item]');
  if (unityBtn) {
    event.preventDefault();
    ctx.onUnityItem(unityBtn.dataset.unityItem);
    return;
  }
  const tagBtn = event.target.closest('[data-tag]');
  if (tagBtn) {
    event.preventDefault();
    ctx.onTag(tagBtn.dataset.tag);
    return;
  }
  const openBtn = event.target.closest('[data-open]');
  if (openBtn) {
    event.preventDefault();
    ctx.onOpen(openBtn.dataset.open);
  }
}

function cardHtml(item) {
  const inCart = ctx.isInCart(item.code);
  const tags = item.tags || [];
  const alt = `${item.code} ${item.slug} preview`;
  return `
  <article class="card${inCart ? ' is-in-cart' : ''}" role="listitem" data-code="${escapeHtml(item.code)}">
    <button class="card__open" data-open="${escapeHtml(item.code)}" aria-label="View ${escapeHtml(item.code)} ${escapeHtml(item.slug)}"></button>
    <div class="card__thumb thumb is-loading">
      <span class="thumb__ph" aria-hidden="true">${icon('cube', 26)}</span>
      <span class="thumb__off" aria-hidden="true">${icon('imageOff', 20)}<em>No preview</em></span>
      <img class="thumb__img" alt="${escapeHtml(alt)}" data-src="${escapeHtml(item.preview || '')}" loading="lazy" decoding="async">
    </div>
    <div class="card__body">
      <div class="card__row">
        <span class="plate">${escapeHtml(item.code)}</span>
        <span class="card__actions">
          <button class="btn btn--icon btn--cart-toggle${inCart ? ' is-in' : ''}" data-cart="${escapeHtml(item.code)}"
            aria-pressed="${inCart}" aria-label="${inCart ? 'Remove from cart' : 'Add to cart'} ${escapeHtml(item.code)}"
            title="${inCart ? 'Remove from cart' : 'Add to cart'}">${icon(inCart ? 'check' : 'plus', 14)}</button>
          <button class="btn btn--icon" data-copy-item="${escapeHtml(item.code)}"
            aria-label="Copy asset data for ${escapeHtml(item.code)}" title="Copy asset data">${icon('copy', 14)}</button>
          <button class="btn btn--icon" data-blender-item="${escapeHtml(item.code)}"
            aria-label="Import ${escapeHtml(item.code)} to Blender" title="Import to Blender">${icon('blender', 14)}</button>
          <button class="btn btn--icon" data-unity-item="${escapeHtml(item.code)}"
            aria-label="Place ${escapeHtml(item.code)} in Unity" title="Place in Unity">${icon('unity', 14)}</button>
        </span>
      </div>
      <h3 class="card__slug mono" title="${escapeHtml(item.slug)}">${escapeHtml(item.slug)}</h3>
    </div>
    ${tags.length ? `<div class="card__tags cluster">
        ${tags.map((t) => `<button class="chip chip--tag" data-tag="${escapeHtml(t)}" title="Filter by tag: ${escapeHtml(t)}">${escapeHtml(t)}</button>`).join('')}
      </div>` : ''}
  </article>`;
}

function renderChunk() {
  if (rendered >= items.length) return;
  const slice = items.slice(rendered, rendered + CHUNK);
  rendered += slice.length;
  const frag = document.createElement('template');
  frag.innerHTML = slice.map(cardHtml).join('');
  const cards = Array.from(frag.content.children);
  els.grid.append(...cards);
  for (const card of cards) {
    const img = card.querySelector('img[data-src]');
    if (img && img.dataset.src) watchImage(img);
    else card.querySelector('.thumb')?.classList.remove('is-loading');
  }
  if (rendered >= items.length && sentinelObs) sentinelObs.unobserve(els.sentinel);
}

export function renderView(nextItems) {
  items = nextItems;
  rendered = 0;
  els.grid.replaceChildren();
  const isEmpty = items.length === 0;
  els.empty.hidden = !isEmpty;
  els.grid.hidden = isEmpty;
  if (isEmpty) {
    els.sentinel.hidden = true;
    sentinelObs.unobserve(els.sentinel);
    renderEmpty();
    return;
  }
  els.sentinel.hidden = false;
  renderChunk();
  sentinelObs.observe(els.sentinel);
}

function renderEmpty() {
  const filtering = ctx.filtersActive();
  els.empty.innerHTML = `
    <div class="empty__inner">
      <span class="empty__glyph" aria-hidden="true">${icon(filtering ? 'filter' : 'folder', 26)}</span>
      <h2 class="empty__title">${filtering ? 'No matching assets' : 'Library is empty'}</h2>
      <p class="empty__hint">${filtering ? 'Adjust your search or filters and try again.' : 'No asset entries found in manifest.json.'}</p>
      ${filtering ? '<button class="btn btn--ghost" data-clear-filters>Clear filters</button>' : ''}
    </div>`;
  if (filtering) {
    els.empty.querySelector('[data-clear-filters]').addEventListener('click', () => ctx.onClearFilters());
  }
}

/** Re-sync only the cart controls of already-rendered cards (cheap on cart changes). */
export function syncCartState() {
  for (const card of els.grid.querySelectorAll('.card')) {
    const code = card.dataset.code;
    const inCart = ctx.isInCart(code);
    card.classList.toggle('is-in-cart', inCart);
    const btn = card.querySelector('.btn--cart-toggle');
    if (!btn) continue;
    btn.classList.toggle('is-in', inCart);
    btn.setAttribute('aria-pressed', String(inCart));
    btn.setAttribute('aria-label', `${inCart ? 'Remove from cart' : 'Add to cart'} ${code}`);
    btn.title = inCart ? 'Remove from cart' : 'Add to cart';
    btn.innerHTML = icon(inCart ? 'check' : 'plus', 14);
  }
}

export function updateCard(code, item, imgUrl) {
  const card = els.grid?.querySelector(`.card[data-code="${code}"]`);
  if (!card) return;
  const tmp = document.createElement('template');
  tmp.innerHTML = cardHtml(item);
  const fresh = tmp.content.firstElementChild;
  card.replaceWith(fresh);
  const img = fresh.querySelector('img[data-src]');
  const thumb = fresh.querySelector('.thumb');
  if (!img) return;
  if (imgUrl) {
    img.loading = 'eager';
    img.addEventListener('load', () => {
      img.classList.add('is-loaded');
      thumb?.classList.remove('is-loading');
    }, { once: true });
    img.addEventListener('error', () => {
      thumb?.classList.remove('is-loading');
      thumb?.classList.add('is-error');
    }, { once: true });
    img.src = imgUrl;
  } else if (img.dataset.src) {
    watchImage(img);
  } else {
    thumb?.classList.remove('is-loading');
  }
}

export function scrollGridTop() {
  $('#grid-scroll')?.scrollTo({ top: 0, behavior: 'auto' });
}
