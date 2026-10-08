// Price tokens for page copy, derived from the single price model in public/price-engine.js.
// Pages use them as {{p.removal.small}} etc. Change a price in the model, rebuild, and every page follows.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { root } from './lib.mjs';

// ---------- prices: one source (MODEL in public/price-engine.js) ----------
const pcMod = { exports: {} };
runInNewContext(readFileSync(join(root, 'public/price-engine.js'), 'utf8'), { module: pcMod, window: undefined });
const PC = pcMod.exports, M = PC.MODEL;
const gbp = n => '£' + Math.round(n).toLocaleString('en-GB');
const rng = (a, b, plus) => `${gbp(a)} – ${gbp(b)}${plus ? '+' : ''}`;
const to = (a, b, plus) => `${gbp(a)} to ${gbp(b)}${plus ? '+' : ''}`;
const base = { prox: [], count: 2, stumpCount: 1, waste: 'pro', health: 'healthy', protection: 'no', multi: 'no', stump: 'no' };
const est = o => PC.estimate({ ...base, ...o });
const er = (o, plus) => { const r = est(o); return rng(+PC.money(r.lo).replace(/[£,]/g, ''), +PC.money(r.hi).replace(/[£,]/g, ''), plus); };
const band = (t, k, plus) => rng(M[t][k][0], M[t][k][1], plus);
const span = (t, k1, k2) => [M[t][k1][0], M[t][k2][1]];
const nearLo = o => +PC.money(est(o).lo).replace(/[£,]/g, ''), nearHi = o => +PC.money(est(o).hi).replace(/[£,]/g, '');
const mostLo = M.pruning.small[0], mostHi = M.removal.mediumLarge[1];
const largeLo = M.removal.large[0], largeHi = M.removal.large[1];
const stumpMax = M.stumpByDiameter.over50[1];
export const PRICES = {
  most: to(mostLo, mostHi), mostBetween: `${gbp(mostLo)} and ${gbp(mostHi)}`, large: to(largeLo, largeHi, true),
  minCharge: `${gbp(M.floors.stump[0])} to ${gbp(M.floors.removal[0])}, depending on the job`,
  removal: { small: band('removal', 'small'), medium: band('removal', 'medium'), mediumLarge: band('removal', 'mediumLarge'), large: band('removal', 'large', true),
    all: to(M.removal.small[0], largeHi, true), between: `${gbp(M.removal.small[0])} and ${gbp(largeHi)}+`, from: gbp(M.removal.small[0]),
    smallMedium: rng(M.removal.small[0], M.removal.medium[1]) },
  pruning: { light: rng(M.pruning.small[0], M.pruning.small[0] + (M.pruning.small[1] - M.pruning.small[0]) * M.prunePortion.light[1]),
    liftSmallMedium: rng(...span('pruning', 'small', 'medium')), small: band('pruning', 'small'), medium: band('pruning', 'medium'),
    mediumLarge: band('pruning', 'mediumLarge'), large: band('pruning', 'large', true),
    all: to(M.pruning.small[0], M.pruning.large[1], true), between: `${gbp(M.pruning.small[0])} and ${gbp(M.pruning.large[1])}+`, from: gbp(M.pruning.small[0]),
    pollard: 'From ' + gbp(M.other.pollardFrom) },
  stump: { under20: band('stumpByDiameter', 'under20'), d20to50: band('stumpByDiameter', 'd20to50'), over50: band('stumpByDiameter', 'over50'),
    all: to(M.stumpByDiameter.under20[0], stumpMax), between: `${gbp(M.stumpByDiameter.under20[0])} and ${gbp(stumpMax)}`, from: 'From ' + gbp(M.floors.stump[0]) },
  hedge: { small: er({ service: 'hedge', hedgeMode: 'trim', hedgeLen: 'under5', hedgeH: 'low' }), medium: er({ service: 'hedge', hedgeMode: 'trim', hedgeLen: 'd10to20', hedgeH: 'mid' }),
    tall: er({ service: 'hedge', hedgeMode: 'trim', hedgeLen: 'over20', hedgeH: 'tall' }, true), removal: rng(M.hedgeRemoval[0], M.hedgeRemoval[1]),
    typical: rng(M.floors.hedge[0], nearHi({ service: 'hedge', hedgeMode: 'trim', hedgeLen: 'd10to20', hedgeH: 'mid' })),
    typicalBetween: `${gbp(M.floors.hedge[0])} and ${gbp(nearHi({ service: 'hedge', hedgeMode: 'trim', hedgeLen: 'd10to20', hedgeH: 'mid' }))}`,
    tallFrom: 'from ' + gbp(nearLo({ service: 'hedge', hedgeMode: 'trim', hedgeLen: 'over20', hedgeH: 'tall' })), minCall: 'From ' + gbp(M.floors.hedge[0]) },
  other: { emergency: 'From ' + gbp(M.other.emergencyCallout), survey: 'From ' + gbp(M.other.surveyBasicFrom), bs5837: 'From ' + gbp(M.other.bs5837From),
    surveyFrom: gbp(M.other.surveyBasicFrom), bs5837Plain: gbp(M.other.bs5837From), largeFallen: 'From ' + gbp(largeLo) },
  near: { pruning: rng(nearLo({ service: 'pruning', height: 'small', prox: ['buildings'] }), nearHi({ service: 'pruning', height: 'medium', prox: ['buildings'] })),
    removalSmallMedium: rng(nearLo({ service: 'removal', height: 'small', prox: ['buildings'] }), nearHi({ service: 'removal', height: 'medium', prox: ['buildings'] })),
    removalLarge: rng(nearLo({ service: 'removal', height: 'large', prox: ['buildings'] }), nearHi({ service: 'removal', height: 'large', prox: ['buildings'] }), true),
    uplift: `${Math.round((M.proximity.buildings.lo - 1) * 100)}% to ${Math.round((M.proximity.buildings.hi - 1) * 100)}%` },
  ash: { smallMedium: rng(nearLo({ service: 'removal', height: 'small', health: 'dead' }), nearHi({ service: 'removal', height: 'medium', health: 'dead' })),
    large: rng(nearLo({ service: 'removal', height: 'large', health: 'dead', prox: ['buildings'] }), nearHi({ service: 'removal', height: 'large', health: 'dead', prox: ['buildings'] }), true) },
  ex: { birch: er({ service: 'removal', height: 'mediumLarge' }), oak: er({ service: 'pruning', height: 'large', extent: 'standard', prox: ['fences'] }, true),
    leylandii: er({ service: 'removal', height: 'medium', multi: 'yes', count: 4, stump: 'yes' }) },
};
export const pget = k => k.split('.').slice(1).reduce((o, x) => (o == null ? o : o[x]), PRICES);
