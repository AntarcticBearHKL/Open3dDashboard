/**
 * Library data sources.
 *
 * Primary (FSA):  window.showDirectoryPicker() -> read _Catalog/manifest.json through
 *                 the directory handle; every library-relative path is resolved lazily
 *                 to a File -> blob URL.
 * Fallback (HTTP): ?base=<url> -> fetch(base + "_Catalog/manifest.json"); files resolve
 *                 as base + relPath URLs (any static server works).
 */

import { encodeRelPath, toPosix } from './path.js';

export const library = {
  mode: 'none', // 'fsa' | 'http' | 'none'
  label: '',
  base: '',
  root: null,
  items: [],
  bust: 0,
  _dirCache: new Map(),
  _fileCache: new Map(),
  _urlCache: new Map(),
};

export function fsSupported() {
  return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
}

export function isLoaded() {
  return library.mode !== 'none';
}

/** Read ?base= from the URL, normalized to end with a slash. */
export function baseFromUrl() {
  const raw = new URLSearchParams(window.location.search).get('base');
  if (!raw) return '';
  return raw.endsWith('/') ? raw : `${raw}/`;
}

function resetCaches() {
  library._dirCache.clear();
  library._fileCache.clear();
  library._urlCache.clear();
}

async function readManifestViaFsa(root) {
  const catalog = await root.getDirectoryHandle('_Catalog');
  const fileHandle = await catalog.getFileHandle('manifest.json');
  const file = await fileHandle.getFile();
  return JSON.parse(await file.text());
}

/** Accept either the library root or its parent (e.g. D:\) when picking a directory. */
async function locateRoot(handle) {
  try {
    await handle.getDirectoryHandle('_Catalog');
    return handle;
  } catch {
    try {
      const inner = await handle.getDirectoryHandle('3D Resource');
      await inner.getDirectoryHandle('_Catalog');
      return inner;
    } catch {
      throw new Error(
        'Could not find _Catalog/manifest.json in the selected folder. Choose the library root folder (for example D:\\3D Resource).',
      );
    }
  }
}

/** Open the library from a user-picked directory handle. */
export async function openDirectory(handleArg) {
  const picked = handleArg || (await window.showDirectoryPicker({ id: 'asset-library', mode: 'read' }));
  const root = await locateRoot(picked);
  const items = await readManifestViaFsa(root);
  if (!Array.isArray(items) || !items.length) throw new Error('manifest.json is empty or malformed.');
  resetCaches();
  library.mode = 'fsa';
  library.root = root;
  library.base = '';
  library.label = root.name || 'Local folder';
  library.items = items;
  return items;
}

/** Open the library over HTTP: fetch(base + "_Catalog/manifest.json"). */
export async function openHttp(base) {
  const norm = base.endsWith('/') ? base : `${base}/`;
  const url = `${norm}_Catalog/manifest.json`;
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    throw new Error(`Cannot reach ${url}. Make sure the static server is running and allows cross-origin reads (CORS).`);
  }
  if (!res.ok) throw new Error(`Failed to load ${url} (HTTP ${res.status}).`);
  const items = JSON.parse(await res.text());
  if (!Array.isArray(items) || !items.length) throw new Error('manifest.json is empty or malformed.');
  resetCaches();
  library.mode = 'http';
  library.root = null;
  library.base = norm;
  library.label = norm;
  library.items = items;
  return items;
}

async function fsaGetFile(rel) {
  const key = toPosix(rel);
  const cached = library._fileCache.get(key);
  if (cached) return cached;
  const parts = key.split('/').filter(Boolean);
  let dir = library.root;
  let dirKey = '';
  for (let i = 0; i < parts.length - 1; i += 1) {
    dirKey += `/${parts[i]}`;
    let next = library._dirCache.get(dirKey);
    if (!next) {
      next = await dir.getDirectoryHandle(parts[i]);
      library._dirCache.set(dirKey, next);
    }
    dir = next;
  }
  const fileHandle = await dir.getFileHandle(parts[parts.length - 1]);
  const file = await fileHandle.getFile();
  library._fileCache.set(key, file);
  return file;
}

/** Resolve a library-relative path to a usable URL (blob: for FSA, base+path for HTTP). */
export async function getUrl(rel) {
  const key = toPosix(rel);
  const cached = library._urlCache.get(key);
  if (cached) return cached;
  if (library.mode === 'fsa') {
    const file = await fsaGetFile(key);
    const url = URL.createObjectURL(file);
    library._urlCache.set(key, url);
    return url;
  }
  if (library.mode === 'http') {
    const base = library.base + encodeRelPath(key);
    const url = library.bust ? `${base}${base.includes('?') ? '&' : '?'}v=${library.bust}` : base;
    library._urlCache.set(key, url);
    return url;
  }
  throw new Error('Library is not loaded yet.');
}

async function fetchManifestHttp(norm) {
  const url = `${norm}_Catalog/manifest.json`;
  let res;
  try {
    res = await fetch(url, { cache: 'no-store' });
  } catch (err) {
    throw new Error(`Cannot reach ${url}. Make sure the static server is running and allows cross-origin reads (CORS).`);
  }
  if (!res.ok) throw new Error(`Failed to load ${url} (HTTP ${res.status}).`);
  return JSON.parse(await res.text());
}

export async function reloadManifest() {
  resetCaches();
  library.bust += 1;
  if (library.mode === 'fsa') {
    library.items = await readManifestViaFsa(library.root);
  } else if (library.mode === 'http') {
    library.items = await fetchManifestHttp(library.base);
  } else {
    throw new Error('Library is not loaded yet.');
  }
  return library.items;
}

export async function getText(rel) {
  const key = toPosix(rel);
  if (library.mode === 'fsa') {
    const file = await fsaGetFile(key);
    return file.text();
  }
  if (library.mode === 'http') {
    const res = await fetch(library.base + encodeRelPath(key), { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  }
  throw new Error('Library is not loaded yet.');
}

export async function refreshUrl(rel) {
  const key = toPosix(rel);
  library.bust += 1;
  library._fileCache.delete(key);
  library._urlCache.delete(key);
  const url = await getUrl(key);
  if (library.mode === 'http') {
    return url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();
  }
  return url;
}

/** Human-readable source label for the header chip. */
export function sourceLabel() {
  if (library.mode === 'fsa') return `Local folder · ${library.label}`;
  if (library.mode === 'http') return `HTTP · ${library.label}`;
  return 'Not loaded';
}
