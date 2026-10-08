#!/usr/bin/env node
/**
 * Site checks. No dependencies.
 *
 *   node scripts/check.mjs            structural checks must pass; launch blockers are listed
 *   node scripts/check.mjs --launch   launch blockers also fail (use before going live)
 *
 * STRUCTURE (always fail): shared header/footer in sync, no broken internal links or #anchors,
 *   canonical and og:url match each page's own URL, no canonical on the 404, JSON-LD parses and
 *   its URLs exist, the sitemap lists exactly the real pages, images have alt text.
 * LAUNCH BLOCKERS (fail with --launch): placeholders, unverified claims, wording from the old
 *   lead-generation model, references to removed pages, and the staging noindex switch.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pages, origin, pathExists, pub, root } from './lib.mjs';

const launch = process.argv.includes('--launch');
const list = pages();
const base = origin();
const errors = [];   // structure problems
const blockers = []; // things to resolve before launch
const warnings = [];
const add = (arr, rel, msg) => arr.push(`${rel}: ${msg}`);

const text = f => readFileSync(f, 'utf8');
const stripShellAndLd = s => s;

// 1. Shell in sync
const sync = spawnSync('node', [join(root, 'scripts/sync-shell.mjs'), '--check'], { encoding: 'utf8' });
if (sync.status !== 0) errors.push('Shared header/footer are out of sync. Run: npm run sync\n' + sync.stdout.trim());

// 2. Per-page checks
const titles = new Map(), descs = new Map();
const banned = [
  [/YOURDOMAIN/, 'placeholder domain (run: npm run config -- --domain ...)'],
  [/YOURFORMID/, 'placeholder Formspree ID (run: npm run config -- --form ...)'],
  [/020 7946 0\d\d/, 'placeholder phone number (reserved for TV drama; use the real number)'],
  [/\[(VERIFY|OPERATOR DATA)/i, 'unresolved [VERIFY] / [OPERATOR DATA] marker'],
  [/\[(£?X\b|phone number|[^\]]*£X)/i, 'unresolved [X] or [phone number] placeholder'],
  [/lead generation|lead-gen/i, 'old lead-generation wording'],
  [/one local,? (insured )?tree surgeon|pass (my|your) details/i, 'old "we pass your enquiry" wording'],
  [/[Ww]arlingham/, 'reference to the removed Warlingham page'],
  [/href="\/(how-it-works|about|reviews|projects|tree-surgeon-warlingham)\/"/, 'link to a removed page'],
];

for (const p of list) {
  const s = text(p.file);
  const body = s.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/g, m => m); // keep JSON-LD in scope for banned phrases

  // canonical / og:url
  const canon = [...s.matchAll(/<link rel="canonical" href="([^"]*)"/g)].map(m => m[1]);
  const og = [...s.matchAll(/<meta property="og:url" content="([^"]*)"/g)].map(m => m[1]);
  if (p.is404) {
    if (canon.length) add(errors, p.rel, 'the 404 page should not have a canonical link');
  } else {
    const want = base + p.url;
    if (canon.length !== 1 || canon[0] !== want) add(errors, p.rel, `canonical is ${JSON.stringify(canon)}, expected ${want}`);
    if (og.length !== 1 || og[0] !== want) add(errors, p.rel, `og:url is ${JSON.stringify(og)}, expected ${want}`);
  }

  // title / description
  const title = s.match(/<title>([^<]*)<\/title>/)?.[1];
  const desc = s.match(/<meta name="description" content="([^"]*)"/)?.[1];
  if (!title) add(errors, p.rel, 'missing <title>');
  if (!desc && !p.is404) add(errors, p.rel, 'missing meta description');
  if (title) { if (title.length > 70) add(warnings, p.rel, `title is ${title.length} characters (aim for 60 or fewer)`); (titles.get(title) ?? titles.set(title, []).get(title)).push(p.rel); }
  if (desc) { if (desc.length > 165) add(warnings, p.rel, `meta description is ${desc.length} characters (aim for 155 or fewer)`); (descs.get(desc) ?? descs.set(desc, []).get(desc)).push(p.rel); }

  // JSON-LD
  for (const m of s.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let j;
    try { j = JSON.parse(m[1]); } catch (e) { add(errors, p.rel, 'JSON-LD does not parse: ' + e.message); continue; }
    const visit = o => {
      if (Array.isArray(o)) return o.forEach(visit);
      if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) {
        if ((k === 'url' || k === 'item') && typeof v === 'string' && v.startsWith(base)) {
          if (!pathExists(v.slice(base.length) || '/')) add(errors, p.rel, `JSON-LD points to a page that does not exist: ${v}`);
        } else visit(v);
      }
    };
    visit(j);
  }

  // internal links and anchors
  const ids = new Set([...s.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
  for (const m of s.matchAll(/<(?:a|link|script|img)\b[^>]*?\s(?:href|src)="([^"]+)"/g)) {
    const u = m[1];
    if (/^(https?:|mailto:|tel:|data:|\/\/)/.test(u)) continue;
    if (u.startsWith('#')) { if (u.length > 1 && !ids.has(u.slice(1))) add(errors, p.rel, `anchor ${u} has no matching id on this page`); continue; }
    if (!u.startsWith('/')) { add(warnings, p.rel, `relative link ${u}`); continue; }
    if (!pathExists(u)) { add(errors, p.rel, `broken link ${u}`); continue; }
    const hash = u.split('#')[1];
    if (hash && /\/(?:#.*)?$/.test(u.split('#')[0] + '/') ) {
      const target = list.find(x => x.url === (u.split('#')[0] || '/') || x.url === u.split('#')[0] + '/');
      if (target && !text(target.file).includes(`id="${hash}"`)) add(errors, p.rel, `link ${u} points to an id that does not exist on the target page`);
    }
  }

  // images
  for (const m of s.matchAll(/<img\b[^>]*>/g)) if (!/\salt="/.test(m[0])) add(errors, p.rel, 'image without alt text: ' + m[0].slice(0, 60));

  if (/\{\{\w+\}\}/.test(s.replace(/<script[\s\S]*?<\/script>/g, ''))) add(errors, p.rel, 'unresolved {{token}} in the page (check content/facts.json and the token name)');

  // launch blockers
  for (const [re, why] of banned) {
    const hits = body.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g'));
    if (hits) add(blockers, p.rel, `${hits.length}x ${why}`);
  }
  if (!p.is404 && /content="noindex/.test(s)) { /* staging, reported once below */ }
}

for (const [t, files] of titles) if (files.length > 1) add(warnings, files.join(', '), `duplicate title "${t.slice(0, 50)}"`);
for (const [d, files] of descs) if (files.length > 1) add(warnings, files.join(', '), `duplicate meta description`);

// 2b. Placeholder photos and calculator promises
for (const p of list) {
  const s = text(p.file);
  const ph = (s.match(/\/images\/placeholders\//g) || []).length;
  if (ph) add(blockers, p.rel, `${ph}x placeholder photo (replace with a real job photo, then change the src)`);
  // The shared calculator needs the price engine loaded before script.js
  if (/data-calc\b/.test(s)) {
    const e = s.indexOf('/price-engine.js'), sc = s.indexOf('/script.js');
    if (e === -1 || (sc !== -1 && e > sc)) add(errors, p.rel, 'has the calculator but does not load /price-engine.js before /script.js');
  }
}

// 2c. Price calculator: prices must be the operator's own before launch
try {
  const pcjs = text(join(pub, 'price-engine.js'));
  const pcui = text(join(pub, 'price-calculator.js'));
  if (/operatorConfirmed:\s*false/.test(pcjs) && /acceptedForLaunch:\s*true/.test(pcjs)) warnings.push('price-engine.js: prices are published-guide figures accepted for launch, not the operator\'s own job prices (see PRICING.md)');
  else if (/operatorConfirmed:\s*false/.test(pcjs)) blockers.push('price-engine.js: calculator prices come from published guides, not the operator\'s own jobs (confirm them, see PRICING.md, then set operatorConfirmed: true)');
  if (/YOURFORMID/.test(pcui)) blockers.push('price-calculator.js: placeholder Formspree ID');
} catch { errors.push('price-engine.js or price-calculator.js could not be read'); }

// 3. Sitemap
try {
  const sm = text(join(pub, 'sitemap.xml'));
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  const want = list.filter(p => !p.is404).map(p => base + p.url);
  for (const u of want) if (!locs.includes(u)) add(errors, 'sitemap.xml', `missing ${u} (run: npm run sitemap)`);
  for (const u of locs) if (!want.includes(u)) add(errors, 'sitemap.xml', `lists a page that does not exist: ${u} (run: npm run sitemap)`);
} catch { errors.push('sitemap.xml could not be read'); }

// 4. Staging switch
const home = text(join(pub, 'index.html'));
const staging = /<meta name="robots" content="noindex/.test(home);
if (staging) add(blockers, 'site', 'still in staging (noindex). Run: npm run launch  (after everything else passes)');

// Report
const show = (title, arr, max = 40) => {
  if (!arr.length) return;
  console.log(`\n${title} (${arr.length})`);
  arr.slice(0, max).forEach(x => console.log('  - ' + x));
  if (arr.length > max) console.log(`  ... and ${arr.length - max} more`);
};
// Launch blockers are grouped by reason, so the list stays readable
const grouped = new Map();
for (const b of blockers) {
  const m = b.match(/^([^:]+): (?:(\d+)x )?(.*)$/s);
  const [, where, n, why] = m;
  const g = grouped.get(why) ?? grouped.set(why, { count: 0, files: [] }).get(why);
  g.count += Number(n ?? 1); g.files.push(where);
}
console.log(`Checked ${list.length} pages on ${base}`);
show('STRUCTURE ERRORS (must fix)', errors);
if (grouped.size) {
  console.log(`\nLAUNCH BLOCKERS${launch ? ' (must fix)' : ' (fix before going live)'}`);
  for (const [why, g] of grouped) {
    const files = g.files.length <= 5 || launch ? ': ' + g.files.join(', ') : '';
    console.log(`  - ${why}: ${g.count} in ${g.files.length} file(s)${files}`);
  }
}
show('WARNINGS', warnings, 15);
const failed = errors.length || (launch && blockers.length);
console.log(failed ? '\nFAILED' : '\nStructure OK' + (blockers.length ? ` | ${grouped.size} kind(s) of launch blocker remain` : ' | ready to launch'));
process.exit(failed ? 1 : 0);
