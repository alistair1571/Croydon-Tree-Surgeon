#!/usr/bin/env node
/**
 * Switch the whole site between "staging" (hidden from search engines) and "live" (indexable).
 *
 *   node scripts/launch.mjs --noindex   hide the site: noindex meta tag, X-Robots-Tag header, no sitemap line
 *   node scripts/launch.mjs --index     make it indexable (run only when `npm run verify:launch` passes)
 *   node scripts/launch.mjs             show the current state
 *
 * The 404 page is always noindex.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pages, origin, pub } from './lib.mjs';

const arg = process.argv[2];
const ROBOTS_RE = /<meta name="robots" content="[^"]*">/;

function state() {
  const home = readFileSync(join(pub, 'index.html'), 'utf8').match(ROBOTS_RE)?.[0] ?? '';
  return /noindex/.test(home) ? 'noindex' : 'index';
}
if (!arg) { console.log(`Site is currently: ${state() === 'noindex' ? 'STAGING (noindex)' : 'LIVE (indexable)'}`); process.exit(0); }
if (arg !== '--index' && arg !== '--noindex') { console.error('Use --index or --noindex'); process.exit(1); }
const live = arg === '--index';

let n = 0;
for (const p of pages()) {
  const s = readFileSync(p.file, 'utf8');
  const tag = (live && !p.is404) ? '<meta name="robots" content="index,follow">'
                                 : `<meta name="robots" content="noindex,${p.is404 ? 'follow' : 'nofollow'}">`;
  const next = ROBOTS_RE.test(s) ? s.replace(ROBOTS_RE, tag) : s.replace('</title>', `</title>\n${tag}`);
  if (next !== s) { writeFileSync(p.file, next); n++; }
}

// _headers: a marked block that sends X-Robots-Tag while in staging
const hp = join(pub, '_headers');
let h = readFileSync(hp, 'utf8').replace(/# staging-start[\s\S]*?# staging-end\n?\n?/, '');
if (!live) h = `# staging-start (removed by "npm run launch")\n/*\n  X-Robots-Tag: noindex, nofollow\n# staging-end\n\n` + h;
writeFileSync(hp, h);

// robots.txt
const base = origin();
writeFileSync(join(pub, 'robots.txt'),
  `User-agent: *\nAllow: /\n` + (live ? `Sitemap: ${base}/sitemap.xml\n` : ''));

console.log(`Site is now ${live ? 'LIVE (indexable)' : 'STAGING (noindex)'}; ${n} page(s) changed.`);
if (live) console.log('Next: submit the sitemap in Google Search Console.');
