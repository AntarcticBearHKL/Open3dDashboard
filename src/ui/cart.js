/** Cart drawer: list, remove, clear, select-all-filtered, export entry. */

import { $, escapeHtml, formatInt, copyText } from '../lib/util.js';
import { icon } from './icons.js';
import { watchImage } from './lazy.js';
import { buildExport, cartClear, cartItems, cartRemove, state } from '../lib/state.js';
import { toast } from './toast.js';

let els = {};
let ctx = {};
let open = false;

export function initCart(context) {
  ctx = context;
  els.drawer = $('#cart');
  els.list = $('#cart-list');
  els.foot = $('#cart-foot');
  els.scrim = $('#scrim');

  $('#cart-open').addEventListener('click', toggleCart);
  $('#cart-close').addEventListener('click', closeCart);
  els.scrim.addEventListener('click', closeCart);
  $('#cart-clear').addEventListener('click', () => {
    const n = state.cart.size;
    cartClear();
    if (n) toast(`Cart cleared (${n})`, 'info');
  });
  $('#cart-export').addEventListener('click', async () => {
    const payload = buildExport();
    if (!payload.count) {
      toast('Cart is empty', 'info');
      return;
    }
    const ok = await copyText(JSON.stringify(payload, null, 2));
    if (!ok) {
      toast('Copy failed', 'error');
      return;
    }
    cartClear();
    closeCart();
    toast(`Copied ${payload.count} code${payload.count === 1 ? '' : 's'} to the clipboard (cart cleared)`, 'ok');
  });

  els.list.addEventListener('click', (event) => {
    const removeBtn = event.target.closest('[data-remove]');
    if (removeBtn) {
      event.preventDefault();
      cartRemove(removeBtn.dataset.remove);
      return;
    }
    const row = event.target.closest('[data-row]');
    if (row) {
      closeCart();
      ctx.onOpen(row.dataset.row);
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      closeCart();
    }
  });

  renderCart();
}

export function toggleCart() {
  open ? closeCart() : openCart();
}

export function openCart() {
  if (open) return;
  renderCart();
  open = true;
  els.drawer.classList.add('is-open');
  els.drawer.setAttribute('aria-hidden', 'false');
  els.scrim.classList.add('is-open');
  els.scrim.hidden = false;
  $('#cart-open').setAttribute('aria-expanded', 'true');
  requestAnimationFrame(() => {
    const first = els.drawer.querySelector('#cart-close');
    (first || els.drawer).focus?.();
  });
}

export function closeCart() {
  if (!open) return;
  open = false;
  els.drawer.classList.remove('is-open');
  els.drawer.setAttribute('aria-hidden', 'true');
  els.scrim.classList.remove('is-open');
  setTimeout(() => {
    if (!open) els.scrim.hidden = true;
  }, 260);
  $('#cart-open').setAttribute('aria-expanded', 'false');
  $('#cart-open').focus();
}

export function renderCart() {
  const items = cartItems();
  const count = items.length;
  for (const el of document.querySelectorAll('[data-cart-count]')) {
    el.textContent = formatInt(count);
    el.classList.toggle('is-empty', count === 0);
  }
  els.list.hidden = count === 0;
  els.foot.hidden = false;
  $('#cart-export').disabled = count === 0;
  $('#cart-clear').disabled = count === 0;

  if (count === 0) {
    els.list.replaceChildren();
    return;
  }

  els.list.innerHTML = items
    .map(
      (it) => `
    <div class="crow" data-row="${escapeHtml(it.code)}" role="button" tabindex="0" aria-label="View ${escapeHtml(it.code)} ${escapeHtml(it.slug)}">
      <div class="crow__thumb thumb is-loading">
        <span class="thumb__ph" aria-hidden="true">${icon('cube', 16)}</span>
        <span class="thumb__off" aria-hidden="true">${icon('imageOff', 14)}</span>
        <img class="thumb__img" alt="" data-src="${escapeHtml(it.preview || '')}" loading="lazy" decoding="async">
      </div>
      <div class="crow__meta">
        <span class="plate">${escapeHtml(it.code)}</span>
        <span class="crow__slug mono" title="${escapeHtml(it.slug)}">${escapeHtml(it.slug)}</span>
        <span class="crow__cat">${escapeHtml(it.category)}</span>
      </div>
      <button class="btn btn--icon crow__remove" data-remove="${escapeHtml(it.code)}" aria-label="Remove ${escapeHtml(it.code)}" title="Remove">${icon('x', 14)}</button>
    </div>`,
    )
    .join('');

  els.list.querySelectorAll('img[data-src]').forEach((img) => {
    if (img.dataset.src) watchImage(img);
    else img.closest('.thumb')?.classList.remove('is-loading');
  });
}
