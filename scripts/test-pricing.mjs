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
for (const want of [PRICES.removal.all, PRICES.stump.all, `${PRICES.most.replace(' to ', ' and ')}, with large trees at ${PRICES.large}`])
  ok(home.includes(want), `homepage FAQ should say "${want}" (it is hand-edited, so update it when the model changes)`);
// The numbers in the calculator tables must be the model's numbers
ok(PRICES.removal.small === `£${M.removal.small[0]} – £${M.removal.small[1]}`, 'removal.small token does not match the model');
ok(M.other.surveyBasicFrom === 260 && M.other.bs5837From === 460 && M.other.pollardFrom === 380 && M.other.emergencyCallout === 250, 'other prices changed: update the source note in PRICING.md');
console.log('  checked ' + readdirSync(pagesDir).filter(x => x.endsWith('.md')).length + ' pages and the homepage');

console.log(P.STATUS.operatorConfirmed ?  '\nOperator has confirmed these prices.' : '\nNOTE: operatorConfirmed is false: prices are from published guides, not the operator\'s own jobs.');
console.log(fail ? `\n${fail} check(s) FAILED` : '\nAll pricing checks passed');
process.exit(fail ? 1 : 0);
