/** Shared IntersectionObserver for lazily-resolved preview images. */

import { getUrl } from '../lib/library.js';

let io = null;

async function onSeen(entries) {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const img = entry.target;
    io.unobserve(img);
    const rel = img.dataset.src;
    if (!rel) continue;
    try {
      const url = await getUrl(rel);
      img.addEventListener(
        'load',
        () => {
          img.classList.add('is-loaded');
          const thumb = img.closest('.thumb');
          if (thumb) thumb.classList.remove('is-loading');
        },
        { once: true },
      );
      img.addEventListener(
        'error',
        () => {
          const thumb = img.closest('.thumb');
          if (thumb) {
            thumb.classList.remove('is-loading');
            thumb.classList.add('is-error');
          }
        },
        { once: true },
      );
      img.src = url;
    } catch {
      const thumb = img.closest('.thumb');
      if (thumb) {
        thumb.classList.remove('is-loading');
        thumb.classList.add('is-error');
      }
    }
  }
}

function ensure() {
  if (!io) io = new IntersectionObserver(onSeen, { rootMargin: '720px 0px' });
  return io;
}

export function watchImage(img) {
  ensure().observe(img);
}
