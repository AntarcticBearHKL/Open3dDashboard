/** Small DOM + formatting helpers. No framework. */

export const $ = (sel, root = document) => root.querySelector(sel);

export function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatInt(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '-';
  return v.toLocaleString('en-US');
}

export function formatDims(dims) {
  if (!dims) return '-';
  const fmt = (v) => (Number.isFinite(Number(v)) ? Number(v).toFixed(2).replace(/\.?0+$/, '') : '-');
  return `${fmt(dims.width)} × ${fmt(dims.height)} × ${fmt(dims.depth)} m`;
}

export function debounce(fn, ms = 140) {
  let t = 0;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for non-secure contexts.
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
