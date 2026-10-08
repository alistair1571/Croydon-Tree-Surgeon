/* =====================================================================
   TREE SURGERY PRICE ENGINE
   The one price model for the whole site. Used by:
     - the shared calculator in script.js (compact, one panel, on most pages)
     - the calculator page (price-calculator.js, the longer step-by-step form)
     - the build (scripts/prices.mjs), which fills the price tables in page copy
   Every figure is explained in PRICING.md. Until the operator confirms the
   figures from their own jobs, operatorConfirmed stays false and
   `npm run verify` reports it as a launch blocker.
   Works in the browser (window.TSPriceEngine) and in Node (module.exports).
   ===================================================================== */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; return; }
  root.TSPriceEngine = api;
})(typeof window !== 'undefined' ? window : this, function () {

  // operatorConfirmed: true only when MODEL matches the operator's own prices.
  // acceptedForLaunch: the site owner accepted the published-guide figures for launch (8 October 2026), to be replaced with the operator's data.
  var STATUS = { operatorConfirmed: false, acceptedForLaunch: true };

  /* ---------------- PRICE MODEL (London guide prices, £) ----------------
     [low, high] per tree, including waste removal and clean-up.
     Height bands are the four Bark offers on its form. */
  var MODEL = {
    bands: ['small', 'medium', 'mediumLarge', 'large'],
    removal: { small: [250, 450], medium: [300, 600], mediumLarge: [550, 1100], large: [1000, 3000] },
    pruning: { small: [200, 400], medium: [250, 500], mediumLarge: [450, 850], large: [800, 1500] },
    stumpByTree: { small: [120, 220], medium: [160, 350], mediumLarge: [220, 450], large: [300, 700] },
    stumpByDiameter: { under20: [120, 220], d20to50: [160, 350], over50: [300, 700] },
    hedgeRatePerM2: { low: [5, 10], mid: [10, 15], tall: [15, 25] },   // £ per m2 of hedge face
    hedgeLengthM: { under5: 4, d5to10: 7.5, d10to20: 15, over20: 30 }, // length used for the maths
    hedgeHeightM: { low: 1.2, mid: 2.0, tall: 3.5 },
    hedgeRemoval: [150, 450],
    floors: { removal: [250, 450], pruning: [200, 400], stump: [120, 220], hedge: [120, 220] },
    // Adjustments (see PRICING.md for which are sourced and which are assumptions)
    healthExtra: [50, 200],             // dead / diseased / hazardous: published guide, per job
    notSureHighExtra: 100,              // assumption: widens the top of the range when health is unknown
    wasteSaving: [50, 100],             // customer disposes of waste: assumption based on published disposal charges
    proximity: {                        // assumptions: multipliers on the base range
      buildings: { lo: 1.10, hi: 1.30 }, power: { lo: 1.10, hi: 1.35 },
      fences: { lo: 1.00, hi: 1.10 }, trees: { lo: 1.00, hi: 1.10 }, other: { lo: 1.00, hi: 1.10 },
      gate: { lo: 1.00, hi: 1.10 },     // side gate or passage, no vehicle access
      tight: { lo: 1.10, hi: 1.30 }     // terrace, through the house or a long carry
    },
    proximityHighCap: 1.6,
    protectionFee: [0, 0],              // council paperwork preparation: set when the operator confirms
    prunePortion: { light: [0, 0.5], standard: [0, 1], heavy: [0.4, 1] }, // share of the low-to-high range
    maxTrees: 5,                         // "5" means 5 or more
    // Prices that appear on the site but are not part of the calculator ("from" prices, London operator guide)
    other: { emergencyCallout: 250, pollardFrom: 380, surveyBasicFrom: 260, bs5837From: 460 }
  };

  var OUR_POSTCODES = /^(CR0|CR2|CR5|CR7|CR8|SE19|SW16)\b/i;
  var OUR_TOWNS = /(croydon|purley|coulsdon|kenley|sanderstead|selsdon|shirley|addiscombe|thornton heath|norbury|norwood|crystal palace|south croydon)/i;

  function round(n) { var step = n >= 1000 ? 50 : 10; return Math.round(n / step) * step; }
  function money(n) { return '£' + round(n).toLocaleString('en-GB'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function has(arr, v) { return (arr || []).indexOf(v) > -1; }

  /* ---------------- ESTIMATE ---------------- */
  function estimate(st) {
    var out = { ok: false, lo: 0, hi: 0, lines: [], flags: [], needsVisit: false };
    var F = function (kind, text, short) { out.flags.push({ kind: kind, text: text, short: short || text }); };
    var L = function (label, lo, hi, sign) { out.lines.push({ label: label, lo: lo, hi: hi, sign: sign || '' }); };

    if (st.service === 'emergency') {
      out.emergency = true; return out;
    }

    var lo = 0, hi = 0, floor;
    var PROX_LABEL = { buildings: 'buildings', power: 'power or telephone lines', fences: 'fences', trees: 'other trees', other: 'other obstructions', gate: 'a narrow route in', tight: 'tight access' };
    function applyProx(keys) {
      var prox = (keys || []).filter(function (k) { return MODEL.proximity[k]; });
      if (!prox.length) return;
      var mLo = 1, mHi = 1;
      prox.forEach(function (k) { mLo = Math.max(mLo, MODEL.proximity[k].lo); mHi += MODEL.proximity[k].hi - 1; });
      mHi = Math.min(mHi, MODEL.proximityHighCap);
      var nlo = lo * mLo, nhi = hi * mHi;
      L('Access and surroundings: ' + prox.map(function (k) { return PROX_LABEL[k]; }).join(', '), nlo - lo, nhi - hi, '+');
      lo = nlo; hi = nhi;
    }

    if (st.service === 'removal' || st.service === 'pruning') {
      var table = st.service === 'removal' ? MODEL.removal : MODEL.pruning;
      var known = has(MODEL.bands, st.height);
      var r = known ? table[st.height] : [table.small[0], table.mediumLarge[1]];
      if (!known) F('info', 'You were not sure of the height, so this range is wide. Photos let us narrow it down.', 'Height not sure, so the range is wide.');
      var rlo = r[0], rhi = r[1];
      if (st.service === 'pruning') {
        var p = MODEL.prunePortion[st.extent] || MODEL.prunePortion.standard, span = rhi - rlo;
        rhi = rlo + span * p[1]; rlo = rlo + span * p[0];
      }
      var n = st.multi === 'yes' ? Math.min(Math.max(+st.count || 2, 2), MODEL.maxTrees) : 1;
      if (st.multi === 'yes' && n >= MODEL.maxTrees) F('info', 'Five or more trees: we will confirm the price on site, and several trees in one visit are usually cheaper per tree.');
      lo = rlo * n; hi = rhi * n;
      L((st.service === 'removal' ? 'Tree removal' : 'Tree pruning') + (known ? '' : ', height not sure') + (n > 1 ? ' x ' + n + (n >= MODEL.maxTrees ? '+' : '') : ''), lo, hi);

      // Access and surroundings (multiplier on the base range)
      applyProx((st.prox || []).concat(st.access ? [st.access] : []));
      if (has(st.prox, 'power') || st.access === 'power') { out.needsVisit = true; F('warn', 'Trees near power or telephone lines need specialist planning, and in London we coordinate with UK Power Networks. We will want to see the site before we quote.', 'Near power lines: we need to see it before we quote.'); }

      // Stump (removal only)
      if (st.service === 'removal' && st.stump === 'yes') {
        var sr = known ? MODEL.stumpByTree[st.height] : MODEL.stumpByTree.medium;
        L('Stump removal' + (n > 1 ? ' x ' + n : ''), sr[0] * n, sr[1] * n, '+');
        lo += sr[0] * n; hi += sr[1] * n;
      }

      // Health
      if (st.health === 'dead') {
        lo += MODEL.healthExtra[0]; hi += MODEL.healthExtra[1]; L('Dead or diseased trees need extra care', MODEL.healthExtra[0], MODEL.healthExtra[1], '+');
        F('warn', 'Dead trees can be brittle and unpredictable. If it is leaning, split or close to people or property, call us rather than waiting.', 'Dead trees can be brittle: call us if it is leaning or close to people.');
      } else if (st.health === 'unsure') {
        hi += MODEL.notSureHighExtra; L('Condition not known', 0, MODEL.notSureHighExtra, '+');
        F('info', 'We will check the trees\' condition at the site visit.');
      }
      floor = MODEL.floors[st.service];
    }

    else if (st.service === 'stump') {
      var d = MODEL.stumpByDiameter[st.stumpDia] || MODEL.stumpByDiameter.d20to50;
      var sn = Math.min(Math.max(+st.stumpCount || 1, 1), MODEL.maxTrees);
      lo = d[0] * sn; hi = d[1] * sn;
      L('Stump grinding' + (sn > 1 ? ' x ' + sn + (sn >= MODEL.maxTrees ? '+' : '') : ''), lo, hi);
      if (!MODEL.stumpByDiameter[st.stumpDia]) F('info', 'Stump size not given, so this assumes a medium stump.');
      applyProx(st.access ? [st.access] : []);
      if (st.access === 'power') { out.needsVisit = true; F('warn', 'Work near power or telephone lines needs specialist planning. We will want to see the site before we quote.', 'Near power lines: we need to see it before we quote.'); }
      floor = MODEL.floors.stump;
    }

    else if (st.service === 'hedge') {
      if (st.hedgeMode === 'remove') {
        lo = MODEL.hedgeRemoval[0]; hi = MODEL.hedgeRemoval[1];
        L('Hedge removal (typical range)', lo, hi);
        F('info', 'Hedge removal depends on length, height and species, so we confirm it on site.', 'Hedge removal is confirmed on site.');
        floor = MODEL.floors.hedge;
      } else {
        var rate = MODEL.hedgeRatePerM2[st.hedgeH] || MODEL.hedgeRatePerM2.mid;
        var area = (MODEL.hedgeLengthM[st.hedgeLen] || MODEL.hedgeLengthM.d5to10) * (MODEL.hedgeHeightM[st.hedgeH] || MODEL.hedgeHeightM.mid);
        lo = area * rate[0]; hi = area * rate[1];
        L('Hedge trimming or reduction, about ' + Math.round(area) + ' m2 of hedge', lo, hi);
        applyProx(st.access ? [st.access] : []);
        if (st.hedgeH === 'tall') F('info', 'Hedges over about 2.5m usually need a platform. Overgrown or conifer hedges can cost more, and we are honest if a conifer cannot be cut back hard.');
        floor = MODEL.floors.hedge;
      }
    }

    // Waste: if the customer takes care of it, the price is lower by an uncertain amount, so the range widens downwards
    if (st.waste === 'self' && st.service !== 'stump') {
      lo -= MODEL.wasteSaving[1]; hi -= MODEL.wasteSaving[0];
      L('You take care of the waste', MODEL.wasteSaving[0], MODEL.wasteSaving[1], '-');
    }

    // Protection
    if (st.protection === 'conservation') F('warn', 'Trees in a conservation area need six weeks\' written notice to Croydon Council before work. We prepare and submit it for you, so allow for that time. Council notices have no application fee.', 'Conservation area: six weeks\' notice to the council first. We handle it.');
    else if (st.protection === 'tpo') F('warn', 'A tree with a TPO needs the council\'s written consent before any work. We prepare the application for you, and the work can only go ahead as consented.', 'TPO: council consent needed first. We apply for you.');
    else if (st.protection === 'unsure') F('info', 'We check tree preservation orders and conservation areas for your address before we quote.', 'We check protection before we quote.');
    if ((st.protection === 'conservation' || st.protection === 'tpo') && (MODEL.protectionFee[0] || MODEL.protectionFee[1])) {
      lo += MODEL.protectionFee[0]; hi += MODEL.protectionFee[1]; L('Council paperwork', MODEL.protectionFee[0], MODEL.protectionFee[1], '+');
    }

    // Floors
    if (floor) { lo = Math.max(lo, floor[0]); hi = Math.max(hi, floor[1], lo); }
    if (hi < lo) hi = lo;

    // Messages that depend on the answers
    if (st.owner === 'no') F('info', 'Tree work needs the owner\'s permission (and a freeholder\'s or managing agent\'s where relevant). We can give a written quote to pass to them.');
    if (st.property === 'communal' || st.property === 'commercial') F('info', 'Communal and commercial sites are quoted individually, and may need the managing agent\'s sign-off or a site risk assessment.');
    var loc = String(st.postcode || '').trim();
    if (loc && !OUR_POSTCODES.test(loc) && !OUR_TOWNS.test(loc)) F('warn', 'We cover the London Borough of Croydon. If your address is elsewhere, ask us whether we can help, because the price here is for Croydon.');
    if (st.when === 'asap' || st.when === 'days') F('info', 'We will tell you honestly how soon we can attend. If a tree has fallen or is dangerous, call us now.');

    out.ok = true; out.lo = lo; out.hi = hi;
    return out;
  }

  return { STATUS: STATUS, MODEL: MODEL, estimate: estimate, money: money, round: round, has: has,
           OUR_POSTCODES: OUR_POSTCODES, OUR_TOWNS: OUR_TOWNS };
});
