/** Minimal 24px stroke icon set (single family, stroke 1.7, currentColor). */

const PATHS = {
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16.2 16.2 21 21"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  cart:
    '<circle cx="9.2" cy="20" r="1.4"/><circle cx="17.2" cy="20" r="1.4"/>' +
    '<path d="M3 3.5h2.3l2.4 12.1a1.9 1.9 0 0 0 1.9 1.5h7.6a1.9 1.9 0 0 0 1.9-1.6L21 8H6.1"/>',
  plus: '<path d="M12 5.5v13M5.5 12h13"/>',
  check: '<path d="M4.6 12.6l4.8 4.8L19.4 6.8"/>',
  copy:
    '<rect x="9" y="9" width="11.5" height="11.5" rx="2"/>' +
    '<path d="M5.5 15V6a2 2 0 0 1 2-2H15"/>',
  download: '<path d="M12 3.5v11M7.8 10.6 12 14.8l4.2-4.2M4 20h16"/>',
  reset: '<path d="M3.8 12a8.2 8.2 0 1 0 2.5-5.9"/><path d="M4.1 4.6v4.6h4.6"/>',
  imageOff:
    '<rect x="3.2" y="4.4" width="17.6" height="15.2" rx="2"/>' +
    '<path d="M3.6 15.4l4.6-4.6 3.8 3.8 2.8-2.8 5.6 5.6"/>' +
    '<path d="M4.4 4.8 19.6 20"/>',
  folder:
    '<path d="M3 7a2 2 0 0 1 2-2h4.3l2 2H19a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  cube:
    '<path d="M12 2.9 20.4 8v8L12 21.1 3.6 16V8z"/>' +
    '<path d="M3.6 8 12 13.1 20.4 8M12 13.1v8"/>',
  blender:
    '<circle cx="13.3" cy="12" r="6.1"/>' +
    '<path d="M10.4 12h5.6l-2.8 3.9z"/>' +
    '<path d="M7.2 13.9 4.5 12l2.7-1.9"/>',
  unity:
    '<path d="M12 2.9 20.4 8v8L12 21.1 3.6 16V8z"/>' +
    '<path d="M3.6 8 12 13.1 20.4 8M12 13.1v8"/>',
  trash: '<path d="M4 7h16M9.5 7V4.8h5V7M6.4 7l1 13h9.2l1-13"/>',
  info: '<circle cx="12" cy="12" r="8.6"/><path d="M12 11v5.4M12 7.6v.3"/>',
  filter: '<path d="M4 6h16M7.5 12h9M10.5 18h3"/>',
};

export function icon(name, size = 16, cls = '') {
  const body = PATHS[name] || PATHS.info;
  return (
    `<svg class="icon ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" ` +
    'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" ' +
    `stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`
  );
}

/** The brand mark: a solid ink cube with light edges, drawn once (monochrome, no gradients). */
export function brandMark(size = 22) {
  return (
    `<svg class="brand__svg" width="${size}" height="${size}" viewBox="0 0 24 24" ` +
    'fill="none" aria-hidden="true" focusable="false">' +
    '<path d="M12 2.9 20.4 8v8L12 21.1 3.6 16V8z" fill="#111111"/>' +
    '<path d="M3.6 8 12 13.1 20.4 8M12 13.1v8" stroke="#e4e4e4" stroke-width="1.3" stroke-linejoin="round"/>' +
    '</svg>'
  );
}
