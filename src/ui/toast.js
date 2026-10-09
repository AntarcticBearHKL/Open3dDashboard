/** Bottom-center toast stack (aria-live polite, transform/opacity only). */

import { $ } from '../lib/util.js';

const DURATION = 2600;

export function toast(message, tone = 'info') {
  const host = $('#toasts');
  if (!host) return;
  const el = document.createElement('div');
  el.className = `toast toast--${tone}`;
  el.textContent = message;
  host.appendChild(el);
  requestAnimationFrame(() => el.classList.add('is-in'));
  setTimeout(() => {
    el.classList.remove('is-in');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
    setTimeout(() => el.remove(), 500);
  }, DURATION);
}
