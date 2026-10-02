/* Contact forms (Formspree) */
document.querySelectorAll('.leadForm').forEach(function(f){
  f.addEventListener('submit', function(e){
    e.preventDefault();
    var form = this;
    var btn = form.querySelector('.form-submit');
    var originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Sending...';
    fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
      headers: { 'Accept': 'application/json' }
    }).then(function(response){
      if (response.ok) {
        btn.textContent = "Thanks, we'll be in touch shortly";
        form.reset();
      } else {
        btn.textContent = 'Something went wrong, please call us instead';
        btn.disabled = false;
      }
    }).catch(function(){
      btn.textContent = 'Something went wrong, please call us instead';
      btn.disabled = false;
    });
  });
});

/* Mobile menu */
(function(){
  var btn = document.querySelector('.mobile-toggle');
  var nav = document.getElementById('site-nav');
  if (!btn || !nav) return;
  btn.addEventListener('click', function(){
    var open = nav.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape' && nav.classList.contains('open')) {
      nav.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      btn.focus();
    }
  });
})();

/* =====================================================================
   TREE SURGERY CALCULATOR
   Renders into every <div data-calc> (the hero of each page).

   PRICES: leave a figure as null until it comes from a real, recent job
   in the area. While showPrices is false, or any figure needed is null,
   the calculator shows a job profile (how involved the job is, what will
   shape the quote, which rules to check) instead of a price, and still
   sends the lead. To show prices: fill PRICES with real [low, high]
   per-job figures in pounds, then set showPrices to true.
   ===================================================================== */
(function(){
  var CONFIG = {
    brand: 'Croydon Tree Surgeon',
    phone: '020 7946 0142',
    phoneHref: '+442079460142',
    formAction: 'https://formspree.io/f/YOURFORMID',
    currency: '£',
    showPrices: false,
    roundTo: 10,
    minimumJob: null              // e.g. 120, or null
  };

  /* [low, high] per job for each size band, by service. null = not set. */
  var PRICES = {
    remove:    { s: null, m: null, l: null, x: null },
    prune:     { s: null, m: null, l: null, x: null },
    stump:     { s: null, m: null, l: null, x: null },
    hedge:     { s: null, m: null, l: null, x: null },
    survey:    { s: null, m: null, l: null, x: null },
    emergency: { s: null, m: null, l: null, x: null }
  };
  var ACCESS_MULT = { open: 1, side: 1.15, hand: 1.35, steep: 1.5 };   /* edit with real figures */
  var EXTRA_PRICE = { stumpAdd: null, waste: null };                  /* [low, high] or null */

  var SERVICES = [
    { id: 'remove',    label: 'Remove a tree', sub: 'Felling or dismantling', size: 'Tree size',
      sizes: ['Small, up to about 4 m', 'Medium, about 4 to 8 m', 'Large, about 8 to 15 m', 'Very large, over 15 m'] },
    { id: 'prune',     label: 'Prune or reduce', sub: 'Crown reduction, lifting', size: 'Tree size',
      sizes: ['Small, up to about 4 m', 'Medium, about 4 to 8 m', 'Large, about 8 to 15 m', 'Very large, over 15 m'] },
    { id: 'stump',     label: 'Grind a stump', sub: 'Below ground level', size: 'Stump width',
      sizes: ['Under 30 cm', '30 to 60 cm', '60 to 100 cm', 'Over 100 cm'] },
    { id: 'hedge',     label: 'Cut a hedge', sub: 'Trim or reduce', size: 'Hedge length and height',
      sizes: ['Short and low, under 5 m', 'About 5 to 15 m', 'About 15 to 30 m', 'Long or tall, over 30 m'] },
    { id: 'survey',    label: 'Tree survey', sub: 'Health, safety or planning', size: 'Number of trees to survey',
      sizes: ['1 tree', '2 to 5 trees', '6 to 15 trees', 'Over 15 trees'] },
    { id: 'emergency', label: 'Emergency', sub: 'Fallen or dangerous tree', size: 'Tree size',
      sizes: ['Small, up to about 4 m', 'Medium, about 4 to 8 m', 'Large, about 8 to 15 m', 'Very large, over 15 m'] }
  ];
  var SIZE_KEYS = ['s', 'm', 'l', 'x'];

  var ACCESS = [
    { id: 'open',  label: 'Open', sub: 'A vehicle can reach it' },
    { id: 'side',  label: 'Side access', sub: 'A narrow gap or gate' },
    { id: 'hand',  label: 'By hand only', sub: 'Through the house or a passage' },
    { id: 'steep', label: 'Steep or stepped', sub: 'Sloping garden or steps' }
  ];

  var AREAS = [
    ['', 'Choose your area'],
    ['Addiscombe', 'Addiscombe'], ['Coulsdon', 'Coulsdon'], ['Crystal Palace', 'Crystal Palace or Upper Norwood (Croydon side)'],
    ['Kenley', 'Kenley'], ['Norbury', 'Norbury (Croydon side)'], ['Purley', 'Purley'], ['Sanderstead', 'Sanderstead'],
    ['Selsdon', 'Selsdon'], ['Shirley', 'Shirley'], ['South Croydon', 'South Croydon'], ['Thornton Heath', 'Thornton Heath'],
    ['Warlingham', 'Warlingham (Tandridge, Surrey)'], ['Elsewhere in Croydon', 'Elsewhere in Croydon'],
    ['Other borough', 'Another borough (Bromley, Lambeth, Southwark, Sutton, Merton, Surrey)']
  ];

  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function svc(id){ for (var i=0;i<SERVICES.length;i++) if (SERVICES[i].id===id) return SERVICES[i]; return SERVICES[0]; }
  function money(n){ var r = CONFIG.roundTo || 1; return CONFIG.currency + (Math.round(n / r) * r).toLocaleString('en-GB'); }

  function init(mount){
    var state = { step: 1, service: mount.getAttribute('data-service') || 'remove', size: 1, count: 1, access: 'open',
      near: false, power: false, ash: false, stumpAdd: false, waste: true, protection: 'unsure',
      area: mount.getAttribute('data-area') || '' };
    var uid = 'c' + Math.random().toString(36).slice(2, 7);

    function chips(name, items, selected){
      return '<div class="calc-chips" role="radiogroup">' + items.map(function(it, i){
        var v = it.id !== undefined ? it.id : i;
        var checked = String(v) === String(selected) ? ' checked' : '';
        return '<label><input type="radio" name="' + uid + name + '" value="' + esc(v) + '"' + checked + '><span>' + esc(it.label) +
          (it.sub ? '<small>' + esc(it.sub) + '</small>' : '') + '</span></label>';
      }).join('') + '</div>';
    }

    function render(){
      var s = svc(state.service);
      var html = '<h2>Tree surgery calculator</h2><p class="calc-sub">Three quick steps. See how involved your job is and what to check first.</p>' +
        '<div class="calc-progress" aria-hidden="true"><i class="' + (state.step>=1?'on':'') + '"></i><i class="' + (state.step>=2?'on':'') + '"></i><i class="' + (state.step>=3?'on':'') + '"></i></div>';
      if (state.step === 1) {
        html += '<div class="calc-step active"><fieldset><legend>What do you need?</legend>' + chips('svc', SERVICES, state.service) + '</fieldset>' +
          '<div class="field"><label for="' + uid + 'area" class="calc-label">Where is it?</label><select id="' + uid + 'area">' +
          AREAS.map(function(a){ return '<option value="' + esc(a[0]) + '"' + (a[0]===state.area?' selected':'') + '>' + esc(a[1]) + '</option>'; }).join('') +
          '</select></div><div class="calc-nav"><button type="button" class="btn" data-next>Next: about the job</button></div></div>';
      } else if (state.step === 2) {
        var sizeItems = s.sizes.map(function(l, i){ return { id: i, label: l }; });
        html += '<div class="calc-step active"><fieldset><legend>' + esc(s.size) + '</legend>' + chips('size', sizeItems, state.size) + '</fieldset>';
        if (s.id !== 'survey') html += '<div class="calc-label">How many ' + (s.id==='hedge'?'hedges':s.id==='stump'?'stumps':'trees') + '?</div><div class="calc-count" style="margin-bottom:14px"><button type="button" data-dec aria-label="Fewer">−</button><output aria-live="polite">' + state.count + '</output><button type="button" data-inc aria-label="More">+</button></div>';
        html += '<fieldset><legend>How easy is it to get to?</legend>' + chips('acc', ACCESS, state.access) + '</fieldset>' +
          '<div class="calc-checks">' +
          (s.id!=='hedge' && s.id!=='survey' ? '<label><input type="checkbox" data-k="near"' + (state.near?' checked':'') + '>It is over, or close to, a house, conservatory or garage</label>' : '') +
          '<label><input type="checkbox" data-k="power"' + (state.power?' checked':'') + '>Power lines or cables run through or near it</label>' +
          (s.id==='remove' ? '<label><input type="checkbox" data-k="stumpAdd"' + (state.stumpAdd?' checked':'') + '>Also grind out the stump</label>' : '') +
          (s.id==='remove'||s.id==='prune'||s.id==='survey'||s.id==='emergency' ? '<label><input type="checkbox" data-k="ash"' + (state.ash?' checked':'') + '>It is, or may be, an ash tree</label>' : '') +
          (s.id!=='survey' ? '<label><input type="checkbox" data-k="waste"' + (state.waste?' checked':'') + '>Take away all the waste</label>' : '') +
          '</div><div class="field" style="margin-top:12px"><label for="' + uid + 'prot" class="calc-label">Is the tree protected?</label><select id="' + uid + 'prot">' +
          [['unsure','Not sure, please check for me'],['tpo','Yes, it has a tree preservation order'],['ca','Yes, it is in a conservation area'],['no','No, I have checked with the council']].map(function(o){ return '<option value="' + o[0] + '"' + (o[0]===state.protection?' selected':'') + '>' + o[1] + '</option>'; }).join('') +
          '</select></div><div class="calc-nav"><button type="button" class="calc-back" data-back>Back</button><button type="button" class="btn" data-next>See my job profile</button></div></div>';
      } else {
        html += resultHtml();
      }
      mount.innerHTML = html;
      bind();
    }

    function compute(){
      var s = svc(state.service);
      var score = state.size * 2 + ({open:0, side:1, hand:2, steep:3}[state.access]) + (state.near?2:0) + (state.power?2:0) +
        (state.count>1 ? Math.min(state.count-1, 3) : 0) + (state.stumpAdd?1:0) + (state.service==='emergency'?2:0);
      var level = score<=3 ? 0 : score<=6 ? 1 : score<=9 ? 2 : 3;
      var names = ['Straightforward', 'Standard', 'Involved', 'Specialist'];
      var blurb = [
        'A routine job with good access. Most of the quote will be time on site.',
        'A normal job with one or two things to plan, such as access or waste.',
        'More planning than usual. Expect a site visit before a firm quote.',
        'Likely to need specialist methods or equipment, and a site visit before any price.'
      ];
      var factors = [];
      factors.push(s.size + ': ' + s.sizes[state.size]);
      if (state.count > 1) factors.push(state.count + ' ' + (s.id==='hedge'?'hedges':s.id==='stump'?'stumps':'trees') + ' in one visit');
      factors.push('Access: ' + ACCESS.filter(function(a){return a.id===state.access;})[0].label.toLowerCase() + ', ' + ACCESS.filter(function(a){return a.id===state.access;})[0].sub.toLowerCase());
      if (state.near) factors.push('Close to a building, so pieces must be lowered under control');
      if (state.power) factors.push('Cables nearby need extra planning');
      if (state.stumpAdd) factors.push('Stump grinding added');
      if (state.waste && s.id!=='survey') factors.push('Waste removal included in the quote');
      if (state.protection==='tpo' || state.protection==='ca') factors.push('Council notice or consent may need to come first');
      var flags = [];
      var area = state.area;
      if (area === 'Other borough' || area === 'Warlingham') flags.push(['warn', area==='Warlingham'
        ? 'Warlingham is in Tandridge, Surrey, so Tandridge District Council\'s tree rules apply, not Croydon\'s. We check the right council for you.'
        : 'Croydon Council\'s tree rules only apply to Croydon addresses. We\'ll confirm which council covers yours before we quote.']);
      if (area === 'Crystal Palace' || area === 'Norbury') flags.push(['warn', 'Parts of this area sit in other boroughs. We confirm which council covers your address first.']);
      if (state.protection === 'ca') flags.push(['warn', 'In a Croydon conservation area you must give the council six weeks\' written notice before work to a tree. We\'ll help you check and plan around it.']);
      else if (state.protection === 'tpo') flags.push(['warn', 'Work on a protected tree needs the council\'s consent first, and unauthorised work can mean a fine. We\'ll check the order before any work.']);
      else if (state.protection === 'unsure') flags.push(['', 'We check protection before quoting: tree preservation orders and conservation areas can both apply.']);
      if (state.service === 'emergency') flags.push(['warn', 'If anyone is in danger, call 999. If power lines are down, call 105.']);
      if (state.ash) flags.push(['', 'Ash dieback is widespread. Councils advise against felling healthy ash, but infected trees can become dangerous, so we assess it first.']);
      var m = new Date().getMonth();
      if (m >= 2 && m <= 7 && (s.id==='hedge'||s.id==='prune'||s.id==='remove')) flags.push(['', 'Birds are nesting between March and August. Active nests are protected, so we check before cutting and may delay part of the work.']);
      return { level: level, name: names[level], blurb: blurb[level], factors: factors, flags: flags, price: price() };
    }

    function price(){
      if (!CONFIG.showPrices) return null;
      var p = PRICES[state.service] && PRICES[state.service][SIZE_KEYS[state.size]];
      if (!p) return null;
      var mult = ACCESS_MULT[state.access] || 1;
      var n = svc(state.service).id==='survey' ? 1 : state.count;
      var lo = p[0] * n * mult, hi = p[1] * n * mult;
      if (state.stumpAdd){ if (!EXTRA_PRICE.stumpAdd) return null; lo += EXTRA_PRICE.stumpAdd[0]; hi += EXTRA_PRICE.stumpAdd[1]; }
      if (CONFIG.minimumJob){ lo = Math.max(lo, CONFIG.minimumJob); hi = Math.max(hi, CONFIG.minimumJob); }
      return money(lo) + ' to ' + money(hi);
    }

    function summaryText(r){
      var s = svc(state.service);
      return s.label + ' | ' + s.sizes[state.size] + ' | count ' + state.count + ' | access ' + state.access +
        (state.near?' | near building':'') + (state.power?' | cables':'') + (state.stumpAdd?' | stump':'') + (state.ash?' | ash':'') +
        ' | protection ' + state.protection + ' | area ' + (state.area||'not given') + ' | profile ' + r.name;
    }

    function resultHtml(){
      var r = compute(), s = svc(state.service);
      var meter = '<div class="calc-meter" aria-hidden="true">' + [0,1,2,3].map(function(i){ return '<i class="' + (i<=r.level?'on':'') + '"></i>'; }).join('') + '</div>';
      return '<div class="calc-step active"><div class="calc-result" aria-live="polite">' +
        '<div class="calc-level"><span>' + esc(s.label) + '</span><strong>' + r.name + '</strong></div>' + meter +
        (r.price ? '<div class="calc-price">' + esc(r.price) + '</div><p>Guide price, confirmed by a free written quote.</p>' : '') +
        '<p>' + r.blurb + '</p><h4>What will shape your quote</h4><ul>' + r.factors.map(function(f){ return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>' +
        r.flags.map(function(f){ return '<div class="calc-flag ' + f[0] + '">' + esc(f[1]) + '</div>'; }).join('') + '</div>' +
        '<form class="calc-form" novalidate><h3>Get your free written quote</h3>' +
        '<input type="hidden" name="_subject" value="New tree surgery lead - ' + esc(CONFIG.brand) + '">' +
        '<input type="text" name="_gotcha" style="display:none" tabindex="-1" autocomplete="off">' +
        '<input type="hidden" name="calculator_summary" value="' + esc(summaryText(r)) + '">' +
        '<div class="field"><label for="' + uid + 'n">Name</label><input id="' + uid + 'n" name="name" type="text" autocomplete="name" required></div>' +
        '<div class="calc-row"><div class="field"><label for="' + uid + 'p">Phone</label><input id="' + uid + 'p" name="phone" type="tel" autocomplete="tel" required></div>' +
        '<div class="field"><label for="' + uid + 'z">Postcode</label><input id="' + uid + 'z" name="postcode" type="text" autocomplete="postal-code" required></div></div>' +
        '<div class="field"><label for="' + uid + 'e">Email (optional)</label><input id="' + uid + 'e" name="email" type="email" autocomplete="email"></div>' +
        '<label class="calc-consent"><input type="checkbox" name="consent" value="yes" required><span>I agree ' + esc(CONFIG.brand) + ' can pass my details to one local tree surgeon to contact me about this job.</span></label>' +
        '<div class="calc-error" role="alert"></div>' +
        '<button type="submit" class="form-submit">Send my job details</button>' +
        '<p class="form-fineprint">Free and no obligation. We\'re a lead generation website. <a href="/how-it-works/">How it works</a></p></form>' +
        '<div class="calc-nav"><button type="button" class="calc-back" data-back>Change my answers</button></div></div>';
    }

    function bind(){
      var $ = function(sel){ return mount.querySelector(sel); };
      mount.querySelectorAll('input[type=radio]').forEach(function(r){
        r.addEventListener('change', function(){
          var n = r.name.replace(uid, '');
          if (n === 'svc') { state.service = r.value; state.size = Math.min(state.size, 3); }
          if (n === 'size') state.size = parseInt(r.value, 10);
          if (n === 'acc') state.access = r.value;
        });
      });
      var area = $('#' + uid + 'area'); if (area) area.addEventListener('change', function(){ state.area = area.value; });
      var prot = $('#' + uid + 'prot'); if (prot) prot.addEventListener('change', function(){ state.protection = prot.value; });
      mount.querySelectorAll('input[data-k]').forEach(function(c){ c.addEventListener('change', function(){ state[c.getAttribute('data-k')] = c.checked; }); });
      var inc = $('[data-inc]'), dec = $('[data-dec]');
      if (inc) inc.addEventListener('click', function(){ state.count = Math.min(state.count + 1, 10); mount.querySelector('output').textContent = state.count; });
      if (dec) dec.addEventListener('click', function(){ state.count = Math.max(state.count - 1, 1); mount.querySelector('output').textContent = state.count; });
      var next = $('[data-next]'); if (next) next.addEventListener('click', function(){ state.step += 1; render(); focusTop(); });
      var back = $('[data-back]'); if (back) back.addEventListener('click', function(){ state.step -= 1; render(); focusTop(); });
      var form = $('.calc-form');
      if (form) form.addEventListener('submit', function(e){
        e.preventDefault();
        var err = form.querySelector('.calc-error'); err.className = 'calc-error'; err.textContent = '';
        var name = form.name.value.trim(), phone = form.phone.value.trim(), pc = form.postcode.value.trim();
        if (!name || !phone || !pc || !form.consent.checked) { err.textContent = 'Please add your name, phone number and postcode, and tick the box so we can pass on your details.'; err.className = 'calc-error show'; return; }
        var btn = form.querySelector('.form-submit'); btn.disabled = true; btn.textContent = 'Sending...';
        fetch(CONFIG.formAction, { method: 'POST', body: new FormData(form), headers: { 'Accept': 'application/json' } })
          .then(function(res){ if (!res.ok) throw new Error('bad'); done(); })
          .catch(function(){ btn.disabled = false; btn.textContent = 'Send my job details'; err.textContent = 'That did not send. Please call ' + CONFIG.phone + ' instead.'; err.className = 'calc-error show'; });
      });
    }
    function done(){
      mount.innerHTML = '<div class="calc-done" role="status"><h3>Thanks, we have your details</h3><p>We\'ll check the tree\'s protection and come back to you to book a free visit or send a written quote. Need it sooner? Call <a href="tel:' + CONFIG.phoneHref + '"><strong>' + CONFIG.phone + '</strong></a>.</p></div>';
    }
    function focusTop(){ var h = mount.querySelector('h2'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } }
    render();
  }
  document.querySelectorAll('[data-calc]').forEach(init);
})();

/* Scroller arrows */
document.querySelectorAll('[data-scroller]').forEach(function(sc){
  var track = document.getElementById(sc.getAttribute('data-scroller'));
  if (!track) return;
  sc.querySelectorAll('button').forEach(function(b){
    b.addEventListener('click', function(){
      var d = b.getAttribute('data-dir') === 'next' ? 1 : -1;
      track.scrollBy({ left: d * Math.min(320, track.clientWidth * 0.9), behavior: 'smooth' });
    });
  });
});
