// Shared helpers for the build scripts. No dependencies.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..');
export const pub = join(root, 'public');

export function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else yield p;
  }
}

/** All HTML pages as { file, rel, url } where url is the page path, e.g. "/guides/" or "/404.html". */
export function pages() {
  const out = [];
  for (const file of walk(pub)) {
    if (!file.endsWith('.html')) continue;
    const rel = file.slice(pub.length + 1).split('\\').join('/');
    let url = '/' + rel;
    if (rel === 'index.html') url = '/';
    else if (rel.endsWith('/index.html')) url = '/' + rel.slice(0, -'index.html'.length);
    out.push({ file, rel, url, is404: rel === '404.html' });
  }
  return out.sort((a, b) => a.url.localeCompare(b.url));
}

/** The site origin, read from the homepage canonical so there is one source of truth. */
export function origin() {
  const home = readFileSync(join(pub, 'index.html'), 'utf8');
  const m = home.match(/<link rel="canonical" href="(https?:\/\/[^\/"]+)\/?"/);
  if (!m) throw new Error('Homepage has no canonical link; cannot work out the site origin.');
  return m[1];
}

/** Does an internal path such as "/guides/ash/" or "/style.css" exist in public/? */
export function pathExists(p) {
  const clean = decodeURIComponent(p.split('#')[0].split('?')[0]);
  if (clean === '' || clean === '/') return true;
  const direct = join(pub, clean);
  if (existsSync(direct) && statSync(direct).isFile()) return true;
  const asDir = join(direct, 'index.html');
  if (clean.endsWith('/') && existsSync(asDir)) return true;
  // Cloudflare "auto-trailing-slash": /about resolves to /about/index.html
  if (!clean.endsWith('/') && existsSync(join(direct, 'index.html'))) return true;
  return false;
}
