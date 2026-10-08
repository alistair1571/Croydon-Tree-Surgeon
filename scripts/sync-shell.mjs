#!/usr/bin/env node
/**
 * Stamps the shared header and footer into every page.
 *
 * The header (top bar, logo, menus) and the footer (links, call bar) live once in
 * scripts/partials/. Edit those two files, then run:   npm run sync
 *
 *   node scripts/sync-shell.mjs          rewrite pages that differ
 *   node scripts/sync-shell.mjs --check  report pages that differ, change nothing (exit 1 if any)
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
const header = readFileSync(join(root, 'scripts/partials/header.html'), 'utf8').trimEnd();
const footer = readFileSync(join(root, 'scripts/partials/footer.html'), 'utf8').trimEnd();
const checkOnly = process.argv.includes('--check');

const HEADER_RE = /<div class="topbar">[\s\S]*?<\/header>/;
const FOOTER_RE = /<footer class="footer">[\s\S]*?<\/footer>\s*<div class="mobile-call-bar">[\s\S]*?<\/div>/;

function* htmlFiles(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* htmlFiles(p);
    else if (name.endsWith('.html')) yield p;
  }
}

let changed = 0, total = 0, problems = 0;
for (const file of htmlFiles(pub)) {
  total++;
  const rel = file.slice(pub.length + 1);
  let s = readFileSync(file, 'utf8');
  if (!HEADER_RE.test(s) || !FOOTER_RE.test(s)) {
    console.error(`  !! ${rel}: could not find the header or footer block`);
    problems++;
    continue;
  }
  const next = s.replace(HEADER_RE, () => header).replace(FOOTER_RE, () => footer);
  if (next !== s) {
    changed++;
    if (checkOnly) console.log(`  differs: ${rel}`);
    else writeFileSync(file, next);
  }
}
console.log(`${checkOnly ? 'Checked' : 'Synced'} ${total} pages, ${changed} ${checkOnly ? 'out of date' : 'updated'}.`);
process.exit(problems || (checkOnly && changed) ? 1 : 0);
