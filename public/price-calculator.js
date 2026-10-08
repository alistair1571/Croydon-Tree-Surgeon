/* =====================================================================
   TREE SURGERY PRICE CALCULATOR  (calculator page: the longer, step-by-step form)

   Questions follow the fields in Bark's tree surgery request form
   (property type, owner, stump removal, height, number of trees, health,
   proximity, protections, location, start date, waste), plus three
   additions needed to price a job: the type of job, how many trees, and
   how much pruning.

   Prices come from price-engine.js (see PRICING.md). Load that file first.
   ===================================================================== */
(function () {
  var E = window.TSPriceEngine;
  if (!E) return;
  var MODEL = E.MODEL, estimate = E.estimate, money = E.money, has = E.has;

  var CONFIG = {
    brand: 'Croydon Tree Surgeon',
    phone: '07881 305352',
    phoneHref: '+447881305352',
    formAction: 'https://formspree.io/f/xljgjozn'
  };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ---------------- QUESTIONS ---------------- */
  var Q = [
    { id: 'service', title: 'What do you need doing?', type: 'radio', add: true, options: [
      ['removal', 'Tree removal', 'Felling or sectional dismantling'], ['pruning', 'Pruning or crown reduction', 'Reduce, thin or lift a tree'],
      ['stump', 'Stump grinding only', 'The tree is already down'], ['hedge', 'Hedge cutting', 'Trimming, reduction or removal'],
      ['emergency', 'A tree has fallen, or is dangerous', 'Storm damage or leaning tree']] },
    { id: 'property', title: 'What type of property needs tree surgery?', type: 'radio', options: [
      ['residential', 'Residential garden'], ['communal', 'Communal garden', 'Flats, blocks or an estate'], ['commercial', 'Office or commercial garden'], ['other', 'Other', '', true]] },
    { id: 'owner', title: 'Are you the owner of the property?', type: 'radio', options: [['yes', 'Yes'], ['no', 'No', 'Tenant, landlord\'s agent or other']] },
    { id: 'stump', title: 'Do you also require stump removal?', type: 'radio', show: function (s) { return s.service === 'removal'; }, options: [['yes', 'Yes'], ['no', 'No']] },
    { id: 'height', title: 'What is the height of the trees or shrubs?', type: 'radio', show: function (s) { return s.service === 'removal' || s.service === 'pruning'; }, options: [
      ['small', 'Small', 'under 9ft / 3m'], ['medium', 'Medium', '9ft to 18ft / 3m to 6m'], ['mediumLarge', 'Medium large', '18ft to 27ft / 6m to 9m'], ['large', 'Large', 'more than 27ft / 9m'], ['other', 'Other or not sure', '', true]] },
    { id: 'multi', title: 'Does more than one tree need attention?', type: 'multi', add: true, show: function (s) { return s.service === 'removal' || s.service === 'pruning'; }, options: [['yes', 'Yes, more than 1'], ['no', 'No']] },
    { id: 'extent', title: 'How much pruning does it need?', type: 'radio', add: true, show: function (s) { return s.service === 'pruning'; }, options: [
      ['light', 'A light tidy', 'Deadwood, a few branches'], ['standard', 'Reduce or thin the crown', 'The usual job'], ['heavy', 'A heavy reduction', 'Large, overgrown or neglected']] },
    { id: 'stumpDia', title: 'How wide is the stump?', help: 'Measure across the top. A dinner plate is about 25cm.', type: 'radio', add: true, show: function (s) { return s.service === 'stump'; }, options: [
      ['under20', 'Under 20cm', 'about 8 inches'], ['d20to50', '20cm to 50cm', '8 to 20 inches'], ['over50', 'Over 50cm', 'about 20 inches or more']] },
    { id: 'stumpCount', title: 'How many stumps?', type: 'count', add: true, show: function (s) { return s.service === 'stump'; } },
    { id: 'hedgeMode', title: 'What needs doing to the hedge?', type: 'radio', add: true, show: function (s) { return s.service === 'hedge'; }, options: [['trim', 'Trim or reduce it'], ['remove', 'Remove it']] },
    { id: 'hedgeLen', title: 'How long is the hedge?', type: 'radio', add: true, show: function (s) { return s.service === 'hedge' && s.hedgeMode === 'trim'; }, options: [
      ['under5', 'Under 5m'], ['d5to10', '5m to 10m'], ['d10to20', '10m to 20m'], ['over20', 'Over 20m']] },
    { id: 'hedgeH', title: 'How tall is the hedge?', type: 'radio', add: true, show: function (s) { return s.service === 'hedge' && s.hedgeMode === 'trim'; }, options: [
      ['low', 'Up to 1.5m', 'about 5ft'], ['mid', '1.5m to 2.5m', '5ft to 8ft'], ['tall', 'Over 2.5m', 'about 8ft or more']] },
    { id: 'health', title: 'What is the health of the trees?', type: 'radio', show: function (s) { return s.service === 'removal' || s.service === 'pruning'; }, options: [
      ['healthy', 'I think they are healthy'], ['dead', 'I think they are dead'], ['unsure', 'I\'m not sure'], ['discuss', 'I need to discuss with the pro'], ['other', 'Other', '', true]] },
    { id: 'prox', title: 'Are the trees located in close proximity to any of the following?', help: 'Tick all that apply.', type: 'check', show: function (s) { return s.service === 'removal' || s.service === 'pruning'; }, options: [
      ['none', 'No obstructions'], ['buildings', 'Buildings'], ['trees', 'Other trees'], ['power', 'Power / telephone lines'], ['fences', 'Fences'], ['other', 'Other', '', true]] },
    { id: 'protection', title: 'Are there any protections on the tree(s)?', type: 'radio', show: function (s) { return s.service !== 'hedge'; }, options: [
      ['no', 'No'], ['conservation', 'Yes, conservation area'], ['tpo', 'Yes, TPO in place'], ['unsure', 'I\'m not sure'], ['other', 'Other', '', true]] },
    { id: 'postcode', title: 'Where do you need the tree surgeon?', help: 'The postcode or town for the address where you want the work.', type: 'text', placeholder: 'Enter your postcode or town' },
    { id: 'when', title: 'When do you want the work to begin?', type: 'radio', options: [
      ['asap', 'As soon as possible'], ['flexible', 'I\'m flexible'], ['days', 'In the next few days'], ['week', 'In the next week'], ['weeks', 'In the next few weeks'], ['other', 'Other', '', true]] },
    { id: 'waste', title: 'Will you require disposal services?', type: 'radio', show: function (s) { return s.service !== 'emergency'; }, options: [
      ['pro', 'I would like the pro to remove the waste'], ['self', 'I can take care of the waste'], ['discuss', 'I need to discuss with the pro'], ['other', 'Other', '', true]] }
  ];

  var LABELS = {
    service: { removal: 'Tree removal', pruning: 'Pruning or crown reduction', stump: 'Stump grinding only', hedge: 'Hedge cutting', emergency: 'Emergency tree work' }
  };

  /* ---------------- UI ---------------- */
  function mount(el) {
    var uid = 'pc' + Math.random().toString(36).slice(2, 7);
    var st = { step: 0, prox: [], count: 2, stumpCount: 1 };
    var steps = function () { return Q.filter(function (q) { return !q.show || q.show(st); }); };
    var $ = function (sel) { return el.querySelector(sel); };

    function answered(q) {
      var v = st[q.id];
      if (q.type === 'check') return (st.prox || []).length > 0;
      if (q.type === 'count') return true;
      if (q.type === 'text') return !!(v && String(v).trim().length > 1);
      if (q.type === 'multi') return !!v;
      return !!v;
    }

    function optHtml(q, o, type) {
      var name = uid + q.id, id = name + o[0], isOther = !!o[3];
      var checked = type === 'checkbox' ? has(st.prox, o[0]) : st[q.id] === o[0];
      return '<label class="pc-opt' + (checked ? ' on' : '') + '" for="' + id + '"><input id="' + id + '" type="' + type + '" name="' + name + '" value="' + esc(o[0]) + '"' + (checked ? ' checked' : '') + '>' +
        '<span class="pc-mark" aria-hidden="true"></span><span class="pc-text"><strong>' + esc(o[1]) + '</strong>' + (o[2] ? '<small>' + esc(o[2]) + '</small>' : '') + '</span>' +
        (isOther && checked ? '<input class="pc-other" type="text" data-other="' + q.id + '" placeholder="Tell us more" value="' + esc(st[q.id + 'Other'] || '') + '" aria-label="Other, tell us more">' : '') + '</label>';
    }

    function render() {
      var list = steps();
      if (st.step >= list.length) { return renderResult(); }
      var q = list[st.step], bar = '';
      for (var i = 0; i <= list.length; i++) bar += '<i class="' + (i <= st.step ? 'on' : '') + '"></i>';
      var body = '';
      if (q.type === 'radio') body = q.options.map(function (o) { return optHtml(q, o, 'radio'); }).join('');
      else if (q.type === 'check') body = q.options.map(function (o) { return optHtml(q, o, 'checkbox'); }).join('');
      else if (q.type === 'multi') {
        body = q.options.map(function (o) { return optHtml(q, o, 'radio'); }).join('');
        if (st.multi === 'yes') body += '<div class="pc-sub"><span class="pc-sublabel">How many trees?</span><div class="pc-counts">' + [2, 3, 4, 5].map(function (n) { return '<label class="' + (st.count === n ? 'on' : '') + '"><input type="radio" name="' + uid + 'count" value="' + n + '"' + (st.count === n ? ' checked' : '') + '>' + (n === 5 ? '5 or more' : n) + '</label>'; }).join('') + '</div></div>';
      }
      else if (q.type === 'count') body = '<div class="calc-count"><button type="button" data-dec aria-label="One fewer">-</button><output aria-live="polite">' + (st.stumpCount === 5 ? '5+' : st.stumpCount) + '</output><button type="button" data-inc aria-label="One more">+</button></div>';
      else if (q.type === 'text') body = '<input class="pc-text-in" type="text" id="' + uid + 'pcode" autocomplete="postal-code" placeholder="' + esc(q.placeholder) + '" value="' + esc(st.postcode || '') + '">';
      el.innerHTML = '<div class="calc-progress" aria-hidden="true">' + bar + '</div>' +
        '<fieldset class="pc-q"><legend tabindex="-1">' + esc(q.title) + '</legend>' + (q.help ? '<p class="pc-help">' + esc(q.help) + '</p>' : '') + '<div class="pc-opts">' + body + '</div></fieldset>' +
        '<div class="pc-nav">' + (st.step > 0 ? '<button type="button" class="pc-back" data-back>Back</button>' : '<span></span>') + '<button type="button" class="pc-next" data-next ' + (answered(q) ? '' : 'disabled') + '>Continue</button></div>' +
        '<p class="pc-step">Question ' + (st.step + 1) + ' of ' + list.length + '</p>';
      bind(q);
    }

    function syncNext(q) { var n = $('[data-next]'); if (n) n.disabled = !answered(q); }

    function bind(q) {
      el.querySelectorAll('input[type=radio][name="' + uid + q.id + '"]').forEach(function (r) {
        r.addEventListener('change', function () {
          st[q.id] = r.value;
          render(); var lg = $('legend'); if (lg) lg.focus({ preventScroll: true });
        });
      });
      el.querySelectorAll('input[type=checkbox][name="' + uid + q.id + '"]').forEach(function (c) {
        c.addEventListener('change', function () {
          var cur = (st.prox || []).slice();
          if (c.checked) cur = c.value === 'none' ? ['none'] : cur.filter(function (x) { return x !== 'none'; }).concat([c.value]);
          else cur = cur.filter(function (x) { return x !== c.value; });
          st.prox = cur; render();
        });
      });
      el.querySelectorAll('input[data-other]').forEach(function (t) { t.addEventListener('input', function () { st[t.getAttribute('data-other') + 'Other'] = t.value; }); });
      el.querySelectorAll('input[name="' + uid + 'count"]').forEach(function (r) { r.addEventListener('change', function () { st.count = +r.value; render(); }); });
      var inc = $('[data-inc]'), dec = $('[data-dec]');
      if (inc) inc.addEventListener('click', function () { st.stumpCount = Math.min(st.stumpCount + 1, 5); $('output').textContent = st.stumpCount === 5 ? '5+' : st.stumpCount; });
      if (dec) dec.addEventListener('click', function () { st.stumpCount = Math.max(st.stumpCount - 1, 1); $('output').textContent = st.stumpCount === 5 ? '5+' : st.stumpCount; });
      var tx = $('.pc-text-in'); if (tx) tx.addEventListener('input', function () { st.postcode = tx.value; syncNext(q); });
      var nx = $('[data-next]'); if (nx) nx.addEventListener('click', function () {
        if (!answered(q)) return;
        if (q.id === 'service' && st.service === 'emergency') { st.step = 99; return render(); }
        st.step += 1; render(); var lg = $('legend, h3'); if (lg) lg.focus({ preventScroll: true });
      });
      var bk = $('[data-back]'); if (bk) bk.addEventListener('click', function () { st.step = Math.max(0, st.step - 1); render(); });
      if (tx) tx.addEventListener('keydown', function (e) { if (e.key === 'Enter' && answered(q)) { e.preventDefault(); nx.click(); } });
    }

    function summaryText(r) {
      var parts = [];
      Q.forEach(function (q) {
        if (q.show && !q.show(st)) return;
        var v = st[q.id]; if (v == null || v === '' || (q.type === 'check' && !st.prox.length)) return;
        var shown;
        if (q.type === 'check') shown = st.prox.join(', ') + (has(st.prox, 'other') && st.proxOther ? ' (' + st.proxOther + ')' : '');
        else shown = String(v) + (v === 'other' && st[q.id + 'Other'] ? ' (' + st[q.id + 'Other'] + ')' : '');
        if (q.id === 'multi' && v === 'yes') shown += ', ' + (st.count === 5 ? '5 or more' : st.count) + ' trees';
        if (q.id === 'stumpCount') shown = String(st.stumpCount);
        parts.push(q.title.replace(/\?$/, '') + ': ' + shown);
      });
      return (r.ok ? 'Guide price ' + money(r.lo) + ' to ' + money(r.hi) + '. ' : '') + parts.join(' | ');
    }

    function renderResult() {
      var r = estimate(st);
      if (r.emergency) {
        el.innerHTML = '<div class="pc-result"><h3>If a tree has fallen or is dangerous, please call us</h3><p><strong>If anyone is in danger, call 999.</strong> If power lines are down, call 105. For a fallen, split or leaning tree, call <a href="tel:' + CONFIG.phoneHref + '"><strong>' + esc(CONFIG.phone) + '</strong></a> so we can talk it through and tell you honestly how quickly we can attend. Emergency work is priced on the day, so there is no guide price.</p><p><a class="btn btn-lg" href="tel:' + CONFIG.phoneHref + '">Call ' + esc(CONFIG.phone) + '</a></p><p><button type="button" class="pc-back" data-restart>Start again</button></p></div>';
        var rs = $('[data-restart]'); if (rs) rs.addEventListener('click', function () { st = { step: 0, prox: [], count: 2, stumpCount: 1 }; render(); });
        return;
      }
      var lines = r.lines.map(function (l) {
        var amt = (l.lo === l.hi) ? money(l.lo) : money(l.lo) + ' to ' + money(l.hi);
        return '<li><span>' + esc(l.label) + '</span><span>' + (l.sign ? l.sign + ' ' : '') + amt + '</span></li>';
      }).join('');
      var flags = r.flags.map(function (f) { return '<div class="calc-flag ' + (f.kind === 'warn' ? 'warn' : 'info') + '">' + esc(f.text) + '</div>'; }).join('');
      var incl = st.waste === 'self' ? 'Labour, equipment and a tidy finish. You are taking care of the waste.' : 'Labour, equipment, taking the waste away and a tidy finish.';
      el.innerHTML = '<div class="pc-result" role="status"><p class="pc-eyebrow">Your guide price</p><h3 class="pc-price">' + money(r.lo) + ' <span>to</span> ' + money(r.hi) + '</h3>' +
        '<p class="pc-note">This is a guide, not a quote. ' + (r.needsVisit ? 'We need to see this job before we can quote. ' : '') + 'A fixed written price follows a free site visit. ' + incl + '</p>' + flags +
        '<details class="pc-how"><summary>How this guide price is worked out</summary><ul class="pc-lines">' + lines + '</ul><p>Guide prices are based on typical London tree surgery prices from published 2025 to 2026 price guides, and will be replaced with our own job prices. Several trees in one visit, and winter bookings, are often cheaper than the guide.</p></details>' +
        '<form class="calc-form" novalidate><h3>Get your free written quote</h3>' +
        '<input type="hidden" name="_subject" value="New tree surgery lead - ' + esc(CONFIG.brand) + '">' +
        '<input type="text" name="_gotcha" style="display:none" tabindex="-1" autocomplete="off">' +
        '<input type="hidden" name="source_site" value="' + esc(location.hostname) + '">' +
        '<input type="hidden" name="calculator_summary" value="' + esc(summaryText(r)) + '">' +
        '<div class="field"><label for="' + uid + 'n">Name</label><input id="' + uid + 'n" name="name" type="text" autocomplete="name" required></div>' +
        '<div class="calc-row"><div class="field"><label for="' + uid + 'p">Phone</label><input id="' + uid + 'p" name="phone" type="tel" autocomplete="tel" required></div>' +
        '<div class="field"><label for="' + uid + 'z">Postcode</label><input id="' + uid + 'z" name="postcode" type="text" autocomplete="postal-code" required value="' + esc(st.postcode || '') + '"></div></div>' +
        '<div class="field"><label for="' + uid + 'e">Email (optional)</label><input id="' + uid + 'e" name="email" type="email" autocomplete="email"></div>' +
        '<label class="calc-consent"><input type="checkbox" name="consent" value="yes" required><span>I agree ' + esc(CONFIG.brand) + ' can contact me about this enquiry.</span></label>' +
        '<div class="calc-error" role="alert"></div><button type="submit" class="form-submit">Send my job details</button>' +
        '<p class="form-fineprint">Free and no obligation. <a href="/privacy/">Privacy policy</a></p></form>' +
        '<div class="pc-nav"><button type="button" class="pc-back" data-edit>Change my answers</button></div></div>';
      $('[data-edit]').addEventListener('click', function () { st.step = Math.max(0, steps().length - 1); render(); });
      var form = $('.calc-form');
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var err = form.querySelector('.calc-error'); err.className = 'calc-error'; err.textContent = '';
        var n = form.elements.name.value.trim(), p = form.elements.phone.value.trim(), z = form.elements.postcode.value.trim();
        if (!n || p.replace(/\D/g, '').length < 9 || !z || !form.elements.consent.checked) { err.textContent = 'Please add your name, a phone number and postcode, and tick the box so we can get in touch.'; err.className = 'calc-error show'; return; }
        var btn = form.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Sending...';
        fetch(CONFIG.formAction, { method: 'POST', body: new FormData(form), headers: { 'Accept': 'application/json' } })
          .then(function (res) { if (!res.ok) throw new Error('bad'); el.innerHTML = '<div class="calc-done" role="status"><h3>Thanks, we have your details</h3><p>We\'ll check the tree\'s protection and come back to you to book a free visit or send a written quote. Need it sooner? Call <a href="tel:' + CONFIG.phoneHref + '"><strong>' + esc(CONFIG.phone) + '</strong></a>.</p></div>'; })
          .catch(function () { btn.disabled = false; btn.textContent = 'Send my job details'; err.textContent = 'That did not send. Please call ' + CONFIG.phone + ' instead.'; err.className = 'calc-error show'; });
      });
    }

    el.classList.add('pc'); render();
  }

  function mountAll(doc) { Array.prototype.forEach.call(doc.querySelectorAll('[data-price-calc]'), mount); }
  var go = function () { mountAll(document); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
})();
