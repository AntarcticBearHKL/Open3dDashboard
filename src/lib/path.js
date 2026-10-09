/**
 * Pure path helpers for library-relative paths (always posix-style forward slashes).
 * The library layout uses Windows separators inside FBX files:
 *   ..\..\..\_textures\<L1>\<file>
 * so every URL that reaches the texture resolver goes through here.
 */

export function toPosix(p) {
  return String(p == null ? '' : p).replace(/\\/g, '/');
}

/** Encode a library-relative path for use in an HTTP URL, keeping `/`. */
export function encodeRelPath(rel) {
  return encodeURI(toPosix(rel)).replace(/#/g, '%23').replace(/\?/g, '%3F');
}
