#!/usr/bin/env node
/**
 * Checks the price engine's model against the published price guides it is based on,
 * and checks that each adjustment moves the price the right way.   npm run test:pricing
 *
 * ENVELOPES hold the range each published source supports for each case, scaled for London.
 * Bark's UK guide is multiplied by 1.6, which is the London uplift Bark itself reports
 * (London average removal £650 and pruning £400, against £400 and £250 in the North).
 */
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const mod = { exports: {} };
runInNewContext(readFileSync(join(root, 'public/price-engine.js'), 'utf8'), { module: mod, window: undefined });
const P = mod.exports;
const M = P.MODEL;

let fail = 0;
const ok = (cond, msg) => { if (!cond) { fail++; console.log('  FAIL ' + msg); } };

// Envelope = [lowest, highest] that the sources support for the case (in £, London)
const ENVELOPES = {
  removal: { small: [112, 550], medium: [112, 650], mediumLarge: [480, 1200], large: [480, 3500] },
  pruning: { small: [112, 450], medium: [112, 600], mediumLarge: [400, 900], large: [800, 1500] },
  stumpByTree: { small: [96, 250], medium: [96, 400], mediumLarge: [160, 500], large: [300, 800] },
  stumpByDiameter: { under20: [96, 250], d20to50: [150, 400], over50: [300, 800] },
};
console.log('Per-band ranges against the source envelopes');
console.log('  case                          ours            sources support');
for (const [table, bands] of Object.entries(ENVELOPES)) {
  for (const [band, env] of Object.entries(bands)) {
    const r = M[table][band];
    console.log(`  ${(table + ' ' + band).padEnd(28)} £${r[0]}-£${r[1]}`.padEnd(48) + `£${env[0]}-£${env[1]}`);
    ok(r[0] >= env[0] && r[1] <= env[1], `${table}.${band} ${r} is outside the source envelope ${env}`);
    ok(r[0] < r[1], `${table}.${band} low must be below high`);
  }
}
// Hedges: £5-10, £10-15, £15-25 per m2 (MyJobQuote); London hedge jobs £90-£1,000+ across guides; removal £100-£450
ok(M.hedgeRatePerM2.low[0] === 5 && M.hedgeRatePerM2.tall[1] === 25, 'hedge per-m2 rates should match the published £5 to £25 range');
ok(M.hedgeRemoval[0] >= 100 && M.hedgeRemoval[1] <= 450, 'hedge removal outside the £100 to £450 published range');
for (const [k, f] of Object.entries(M.floors)) ok(f[0] >= 100 && f[1] <= 450, `floor ${k} looks wrong: ${f}`);

// Behaviour
const base = { prox: [], count: 2, stumpCount: 1, waste: 'pro', health: 'healthy', protection: 'no', multi: 'no', stump: 'no' };
const est = o => P.estimate(Object.assign({}, base, o));
const b = est({ service: 'removal', height: 'medium' });
console.log('\nBehaviour checks (medium removal base: £' + Math.round(b.lo) + ' to £' + Math.round(b.hi) + ')');
ok(est({ service: 'removal', height: 'medium', multi: 'yes', count: 3 }).lo === b.lo * 3, 'three trees should cost three times');
ok(est({ service: 'removal', height: 'medium', stump: 'yes' }).hi > b.hi, 'adding a stump should raise the price');
ok(est({ service: 'removal', height: 'medium', prox: ['buildings'] }).hi > b.hi, 'buildings should raise the price');
ok(est({ service: 'removal', height: 'medium', prox: ['power'] }).needsVisit === true, 'power lines should need a site visit');
ok(est({ service: 'removal', height: 'medium', health: 'dead' }).hi === b.hi + M.healthExtra[1], 'dead trees should add the published extra');
ok(est({ service: 'removal', height: 'medium', waste: 'self' }).lo < b.lo, 'taking the waste yourself should lower the price');
ok(est({ service: 'removal', height: 'large' }).lo > est({ service: 'removal', height: 'small' }).lo, 'larger trees should cost more');
ok(est({ service: 'pruning', height: 'large', extent: 'light' }).hi < est({ service: 'pruning', height: 'large', extent: 'heavy' }).hi + 1, 'light pruning should not exceed heavy');
ok(est({ service: 'pruning', height: 'medium' }).hi <= est({ service: 'removal', height: 'medium' }).hi, 'pruning should not exceed removal for the same tree');
ok(est({ service: 'removal', height: 'medium', access: 'tight' }).hi > b.hi, 'tight access should raise the price');
ok(est({ service: 'removal', height: 'medium', access: 'gate' }).hi > b.hi && est({ service: 'removal', height: 'medium', access: 'gate' }).hi < est({ service: 'removal', height: 'medium', access: 'tight' }).hi, 'a narrow route in should cost less extra than tight access');
ok(est({ service: 'stump', stumpDia: 'd20to50', access: 'tight' }).hi > est({ service: 'stump', stumpDia: 'd20to50' }).hi, 'tight access should raise a stump price');
ok(est({ service: 'hedge', hedgeMode: 'trim', hedgeLen: 'd10to20', hedgeH: 'mid', access: 'tight' }).hi > est({ service: 'hedge', hedgeMode: 'trim', hedgeLen: 'd10to20', hedgeH: 'mid' }).hi, 'tight access should raise a hedge price');
ok(est({ service: 'removal', height: 'medium', access: 'power' }).needsVisit === true, 'power lines in the access question should need a site visit');
ok(est({ service: 'emergency' }).emergency === true, 'emergency should not return a price');
for (const h of M.bands) for (const s of ['removal', 'pruning']) {
  const r = est({ service: s, height: h, multi: 'yes', count: 5, prox: ['buildings', 'power', 'fences'], health: 'dead', waste: 'self', stump: s === 'removal' ? 'yes' : 'no' });
  ok(r.lo <= r.hi && r.lo >= M.floors[s][0], `${s} ${h} worst case is inconsistent`);
}
const flags = est({ service: 'removal', height: 'medium', protection: 'conservation' }).flags.map(f => f.text).join(' ');
ok(/six weeks/i.test(flags), 'conservation area should mention six weeks');
ok(/outside|elsewhere/i.test(P.estimate(Object.assign({}, base, { service: 'removal', height: 'medium', postcode: 'M1 1AA' })).flags.map(f => f.text).join(' ')), 'a non-Croydon postcode should be flagged');
ok(!P.estimate(Object.assign({}, base, { service: 'removal', height: 'medium', postcode: 'CR8 3AB' })).flags.some(f => /cover the London Borough/.test(f.text)), 'a CR8 postcode should not be flagged');

console.log('\nExample jobs');
const ex = [
  ['Remove one small tree, easy access', { service: 'removal', height: 'small' }],
  ['Remove one 3-6m tree and its stump', { service: 'removal', height: 'medium', stump: 'yes' }],
  ['Remove one large tree near a house', { service: 'removal', height: 'large', prox: ['buildings'] }],
  ['Reduce a 6-9m tree', { service: 'pruning', height: 'mediumLarge', extent: 'standard' }],
  ['Grind two 20-50cm stumps', { service: 'stump', stumpDia: 'd20to50', stumpCount: 2 }],
  ['Trim a 15m x 2m hedge', { service: 'hedge', hedgeMode: 'trim', hedgeLen: 'd10to20', hedgeH: 'mid' }],
];
for (const [label, o] of ex) { const r = est(o); console.log('  ' + label.padEnd(40) + P.money(r.lo) + ' to ' + P.money(r.hi)); }

// Site-wide consistency: pages use tokens from the model, and the hand-edited homepage must match them
import { readdirSync } from 'node:fs';
import { PRICES } from './prices.mjs';
console.log('\nSite-wide price consistency');
const pagesDir = join(root, 'content/pages');
for (const f of readdirSync(pagesDir).filter(x => x.endsWith('.md'))) {
  const md = readFileSync(join(pagesDir, f), 'utf8');
  ok(!/£\[[^\]]*\]/.test(md), `${f} still has a £[...] price placeholder`);
  for (const m of md.matchAll(/\{\{p\.([\w.]+)\}\}/g)) {
    const v = m[1].split('.').reduce((o, k) => (o == null ? o : o[k]), PRICES);
    ok(typeof v === 'string', `${f}: unknown price token {{p.${m[1]}}}`);
  }
}
const home = readFileSync(join(root, 'public/index.html'), 'utf8');
ok(!/£\[[^\]]*\]/.test(home), 'homepage still has a £[...] price placeholder');
// Homepage cost table is hand-edited: every figure must still match the model (update the page when the model changes)
const fmt = n => '£' + n.toLocaleString('en-GB');
const range = (r, plus) => `${fmt(r[0])} to ${fmt(r[1])}${plus ? '+' : ''}`;
const prox = M.proximity.buildings.hi;
const homeWants = [
  ['small tree removal', range(M.removal.small)],
  ['medium tree removal', range(M.removal.medium)],
  ['large tree removal', range(M.removal.large, true)],
  ['large tree, tight access or over a building', `${fmt(Math.round(M.removal.large[0] * M.proximity.buildings.lo))} to ${fmt(Math.round(M.removal.large[1] * prox))}+`],
  ['light prune, small tree', `${fmt(M.pruning.small[0])} to ${fmt(Math.round(M.pruning.small[0] + (M.pruning.small[1] - M.pruning.small[0]) * M.prunePortion.light[1]))}`],
  ['crown reduction, large tree', range(M.pruning.large, true)],
  ['stump grinding', range([M.stumpByTree.small[0], M.stumpByTree.large[1]])],
  ['hedge', `${fmt(M.floors.hedge[0])} to ${fmt(M.hedgeRemoval[1])}`],
  ['survey', `From ${fmt(M.other.surveyBasicFrom)}`],
  ['emergency call-out', `From ${fmt(M.other.emergencyCallout)}`],
];
for (const [label, want] of homeWants)
  ok(home.includes(want), `homepage cost table should say "${want}" for ${label}`);
// Tree removal page cost table is hand-written: every figure must match the model
const removalPage = readFileSync(join(root, 'content/pages/tree-removal.md'), 'utf8');
for (const [label, want] of [
  ['small tree', range(M.removal.small)], ['medium tree', range(M.removal.medium)], ['medium-large tree', range(M.removal.mediumLarge)],
  ['large tree', range(M.removal.large, true)],
  ['large tree, tight access', `${fmt(Math.round(M.removal.large[0] * M.proximity.buildings.lo))} to ${fmt(Math.round(M.removal.large[1] * M.proximity.buildings.hi))}+`],
  ['stump grinding', range([M.stumpByTree.small[0], M.stumpByTree.large[1]])],
  ['emergency', `From ${fmt(M.other.emergencyCallout)}`],
]) ok(removalPage.includes(want), `tree-removal page cost table should say "${want}" for ${label}`);
// Tree surveys page: survey prices must match the model
const surveyPage = readFileSync(join(root, 'content/pages/tree-surveys.md'), 'utf8');
for (const want of [`From ${fmt(M.other.surveyBasicFrom)}`, `From ${fmt(M.other.bs5837From)}`, `from ${fmt(M.other.surveyBasicFrom)}`, `from ${fmt(M.other.bs5837From)}`])
  ok(surveyPage.includes(want), `tree-surveys page should say "${want}"`);
// Emergency page: call-out and large fallen tree prices must match the model
const emergencyPage = readFileSync(join(root, 'content/pages/emergency.md'), 'utf8');
ok(emergencyPage.includes(`from ${fmt(M.other.emergencyCallout)}`), 'emergency page call-out price does not match the model');
ok(emergencyPage.includes(`from about ${fmt(M.removal.large[0])}`), 'emergency page large-tree clearance price does not match the model');
// Pruning and stump pages: tables must match the model
const pruningPage = readFileSync(join(root, 'content/pages/tree-pruning.md'), 'utf8');
const lightHi = Math.round(M.pruning.small[0] + (M.pruning.small[1] - M.pruning.small[0]) * M.prunePortion.light[1]);
for (const [label, want] of [
  ['light prune, small tree', `${fmt(M.pruning.small[0])} to ${fmt(lightHi)}`],
  ['crown lift, small to medium', `${fmt(M.pruning.small[0])} to ${fmt(M.pruning.medium[1])}`],
  ['medium tree', range(M.pruning.medium)], ['medium-large tree', range(M.pruning.mediumLarge)],
  ['large tree', range(M.pruning.large, true)], ['pollarding', `From ${fmt(M.other.pollardFrom)}`],
]) ok(pruningPage.includes(want), `tree-pruning page should say "${want}" for ${label}`);
const stumpPage = readFileSync(join(root, 'content/pages/stump-grinding.md'), 'utf8');
for (const [label, want] of [
  ['under 20 cm', range(M.stumpByDiameter.under20)], ['20 to 50 cm', range(M.stumpByDiameter.d20to50)], ['over 50 cm', range(M.stumpByDiameter.over50)],
  ['minimum', `From ${fmt(M.floors.stump[0])}`],
]) ok(stumpPage.includes(want), `stump-grinding page should say "${want}" for ${label}`);
// Hedge page: tables must match the model (area x rate, with the minimum call-out floor)
const hedgePage = readFileSync(join(root, 'content/pages/hedge-cutting.md'), 'utf8');
const rnd = n => Math.round(n / (n >= 1000 ? 50 : 10)) * (n >= 1000 ? 50 : 10);
const hedge = (len, ht, rate) => [Math.max(M.floors.hedge[0], rnd(len * ht * rate[0])), Math.max(M.floors.hedge[1], rnd(len * ht * rate[1]))];
const hedgeRow = (lenKey, htKey, rateKey) => hedge(M.hedgeLengthM[lenKey], M.hedgeHeightM[htKey], M.hedgeRatePerM2[rateKey]);
for (const [label, want] of [
  ['small front hedge', range(hedgeRow('under5', 'low', 'low'))],
  ['medium garden hedge', range(hedgeRow('d10to20', 'mid', 'mid'))],
  ['tall hedge or leylandii', range(hedgeRow('over20', 'tall', 'tall'), true)],
  ['hedge removal', range(M.hedgeRemoval)],
  ['minimum call-out', `From ${fmt(M.floors.hedge[0])}`],
]) ok(hedgePage.includes(want), `hedge-cutting page should say "${want}" for ${label}`);
// Trees-near-buildings page: prices beside buildings are the base ranges times the "buildings" proximity multiplier
const nearPage = readFileSync(join(root, 'content/pages/trees-near-buildings.md'), 'utf8');
const bl = M.proximity.buildings;
for (const [label, want] of [
  ['crown lift or reduction over a roof', `${fmt(rnd(M.pruning.small[0] * bl.lo))} to ${fmt(rnd(M.pruning.medium[1] * bl.hi))}`],
  ['small or medium removal beside a house', `${fmt(rnd(M.removal.small[0] * bl.lo))} to ${fmt(rnd(M.removal.medium[1] * bl.hi))}`],
  ['large tree over a house', `${fmt(rnd(M.removal.large[0] * bl.lo))} to ${fmt(rnd(M.removal.large[1] * bl.hi))}+`],
]) ok(nearPage.includes(want), `trees-near-buildings page should say "${want}" for ${label}`);
ok(nearPage.includes(`From about ${fmt(rnd(M.pruning.small[0] * bl.lo))} to over ${fmt(rnd(M.removal.large[1] * bl.hi))}`), 'trees-near-buildings short answer price range does not match the model');
// Calculator page: every row of the price table and worked examples must match the model
const calcPage = readFileSync(join(root, 'content/pages/calculator.md'), 'utf8');
const hedgeTall = range(hedgeRow('over20', 'tall', 'tall'), true);
for (const [label, want] of [
  ['light prune', `${fmt(M.pruning.small[0])} to ${fmt(lightHi)}`], ['medium pruning', range(M.pruning.medium)], ['large reduction', range(M.pruning.large, true)],
  ['small removal', range(M.removal.small)], ['medium removal', range(M.removal.medium)], ['medium-large removal', range(M.removal.mediumLarge)],
  ['large removal', range(M.removal.large, true)],
  ['large, tight access', `${fmt(rnd(M.removal.large[0] * bl.lo))} to ${fmt(rnd(M.removal.large[1] * bl.hi))}+`],
  ['stump grinding', range([M.stumpByTree.small[0], M.stumpByTree.large[1]])],
  ['hedge typical', `${fmt(M.floors.hedge[0])} to ${fmt(hedgeRow('d10to20', 'mid', 'mid')[1])}`],
  ['hedge long and tall', `from ${fmt(hedgeRow('over20', 'tall', 'tall')[0])}`],
  ['survey', `From ${fmt(M.other.surveyBasicFrom)}`], ['emergency', `From ${fmt(M.other.emergencyCallout)}`],
  ['example 1 total', `From about ${fmt(M.removal.small[0] + M.stumpByTree.small[0])}`],
  ['example 1 parts', `Small removal ${range(M.removal.small)}, plus stump grinding from ${fmt(M.stumpByTree.small[0])}`],
  ['example birch', `Medium-large removal ${range(M.removal.mediumLarge)}`],
  ['example oak', `Large crown reduction ${range(M.pruning.large, true)}`],
]) ok(calcPage.includes(want), `calculator page should say "${want}" for ${label}`);
// Area pages: every "£x to £y" in a guide-price table must be a figure the model produces
const valid = new Set([
  range(M.pruning.small[0] ? [M.pruning.small[0], lightHi] : [0, 0]), range([M.pruning.small[0], M.pruning.medium[1]]), range(M.pruning.medium), range(M.pruning.mediumLarge), range(M.pruning.large, true),
  range(M.removal.small), range(M.removal.medium), range(M.removal.mediumLarge), range(M.removal.large, true),
  `${fmt(rnd(M.removal.large[0] * bl.lo))} to ${fmt(rnd(M.removal.large[1] * bl.hi))}+`,
  range([M.stumpByTree.small[0], M.stumpByTree.large[1]]), range(M.stumpByDiameter.under20), range(M.stumpByDiameter.d20to50), range(M.stumpByDiameter.over50), range([M.stumpByTree.small[0], M.stumpByTree.medium[1]]), range(hedgeRow('under5', 'low', 'low')), range([M.removal.small[0], M.removal.medium[1]]), `${fmt(M.floors.hedge[0])} to ${fmt(hedgeRow('d10to20', 'mid', 'mid')[1])}`,
]);
let areaTables = 0;
for (const f of readdirSync(pagesDir).filter(x => /^area-.*\.md$/.test(x))) {
  const md = readFileSync(join(pagesDir, f), 'utf8');
  const hdr = md.match(/^\| [^|\n]* \| Guide price \|$/m);
  if (!hdr) continue;
  areaTables++;
  const table = md.split(hdr[0])[1].split('\n\n')[0];
  for (const m of table.matchAll(/£[\d,]+ to £[\d,]+\+?/g))
    ok(valid.has(m[0]), `${f}: guide price "${m[0]}" is not a figure the model produces`);
}
console.log('  checked ' + areaTables + ' area page price table(s)');
// Cost guide: every "£x to £y" in its guide-price table must be a model figure (plus the minimum call-out range)
for (const gf of ['guide-cost.md', 'guide-ash.md']) {
  const md = readFileSync(join(pagesDir, gf), 'utf8');
  const hdr = md.match(/^\| Job \| Guide price \|$/m);
  ok(!!hdr, gf + ' should have a "Job | Guide price" table');
  if (hdr) {
    const table = md.split(hdr[0])[1].split('\n\n')[0];
    const okSet = new Set([...valid, range([M.floors.stump[0], M.floors.removal[0]])]);
    for (const m of table.matchAll(/£[\d,]+ to £[\d,]+\+?/g)) ok(okSet.has(m[0]), `${gf}: guide price "${m[0]}" is not a figure the model produces`);
    ok(table.includes(`From ${fmt(M.other.surveyBasicFrom)}`), gf + ' survey price should match the model');
    console.log('  checked the ' + gf + ' price table');
  }
}
// The numbers in the calculator tables must be the model's numbers
ok(PRICES.removal.small === `£${M.removal.small[0]} – £${M.removal.small[1]}`, 'removal.small token does not match the model');
ok(M.other.surveyBasicFrom === 260 && M.other.bs5837From === 460 && M.other.pollardFrom === 380 && M.other.emergencyCallout === 250, 'other prices changed: update the source note in PRICING.md');
console.log('  checked ' + readdirSync(pagesDir).filter(x => x.endsWith('.md')).length + ' pages and the homepage');

console.log(P.STATUS.operatorConfirmed ?  '\nOperator has confirmed these prices.' : '\nNOTE: operatorConfirmed is false: prices are from published guides, not the operator\'s own jobs.');
console.log(fail ? `\n${fail} check(s) FAILED` : '\nAll pricing checks passed');
process.exit(fail ? 1 : 0);
