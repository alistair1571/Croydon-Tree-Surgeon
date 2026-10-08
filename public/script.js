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
   SHARED CALCULATOR (one compact panel, result at the top)
   Renders into every <div data-calc> (the hero of most pages).
   Prices come from price-engine.js (loaded before this file); see PRICING.md.
   Optional attributes on the container: data-service (remove, prune, stump,
   hedge) preselects the job, data-area names the area for the lead.
   ===================================================================== */
(function(){
  var E = window.TSPriceEngine;
  var CONFIG = {
    brand: 'Croydon Tree Surgeon',
    phone: '07881 305352',
    phoneHref: '+447881305352',
    formAction: 'https://formspree.io/f/xljgjozn'
  };

  var SERVICES = [['', 'Choose a job'], ['removal', 'Tree removal'], ['pruning', 'Tree pruning or reduction'], ['stump', 'Stump grinding'],
    ['hedge', 'Hedge trimming or reduction'], ['hedgeRemoval', 'Hedge removal'], ['emergency', 'Fallen or dangerous tree (emergency)']];
  var SIZES = {
    tree: ['Tree height', [['', 'Choose'], ['small', 'Small: under 3m (9ft)'], ['medium', 'Medium: 3 to 6m (9 to 18ft)'], ['mediumLarge', 'Medium large: 6 to 9m (18 to 27ft)'], ['large', 'Large: over 9m (27ft+)'], ['other', 'Not sure']]],
    stump: ['Stump width across the top', [['', 'Choose'], ['under20', 'Under 20cm (8in)'], ['d20to50', '20 to 50cm (8 to 20in)'], ['over50', 'Over 50cm (20in+)']]],
    hedge: ['Hedge length and height', [['', 'Choose'], ['under5|low', 'Under 5m long, up to 1.5m high'], ['d5to10|low', '5 to 10m long, up to 1.5m high'], ['d5to10|mid', '5 to 10m long, 1.5 to 2.5m high'],
      ['d10to20|mid', '10 to 20m long, 1.5 to 2.5m high'], ['d10to20|tall', '10 to 20m long, over 2.5m high'], ['over20|mid', 'Over 20m long, 1.5 to 2.5m high'], ['over20|tall', 'Over 20m long, over 2.5m high']]]
  };
  var COUNTS = [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5 or more']];
  var ACCESS = [['easy', 'Easy: open garden, van access'], ['gate', 'Side gate or narrow passage'], ['tight', 'Tight: terrace or long carry'], ['buildings', 'Close to buildings or glass'], ['power', 'Near power or phone lines']];
  var PROTECT = [['unsure', 'Not sure'], ['no', 'No'], ['conservation', 'Conservation area'], ['tpo', 'TPO in place']];
  var OLD = { remove: 'removal', prune: 'pruning', stump: 'stump', hedge: 'hedge', emergency: 'emergency' };

  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function opts(list, sel){ return list.map(function(o){ return '<option value="' + esc(o[0]) + '"' + (o[0] === sel ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join(''); }
  function label(list, v){ for (var i = 0; i < list.length; i++) if (list[i][0] === v) return list[i][1]; return v; }

  function init(mount){
    if (!E) { mount.innerHTML = '<p class="calc-sub">Please call <a href="tel:' + CONFIG.phoneHref + '"><strong>' + esc(CONFIG.phone) + '</strong></a> for a price, or use the <a href="/contact/">contact form</a>.</p>'; return; }
    var area = mount.getAttribute('data-area') || '';
    var preset = OLD[mount.getAttribute('data-service')] || mount.getAttribute('data-service') || '';
    var uid = 'qc' + Math.random().toString(36).slice(2, 6);
    mount.className = (mount.className + ' qc').trim();
    mount.innerHTML =
      '<div class="qc-result" role="status" aria-live="polite" data-r></div>' +
      '<div class="qc-grid" data-g>' +
        '<div class="qc-f full"><label for="' + uid + 's">What do you need?</label><select class="qc-sel" id="' + uid + 's" data-svc>' + opts(SERVICES, preset) + '</select></div>' +
        '<div class="qc-row2" data-row2><div class="qc-f"><label for="' + uid + 'z" data-sizelabel>Tree height</label><select class="qc-sel" id="' + uid + 'z" data-size></select></div>' +
        '<div class="qc-f" data-countwrap><label for="' + uid + 'n">How many?</label><select class="qc-sel" id="' + uid + 'n" data-count>' + opts(COUNTS, '1') + '</select></div></div>' +
        '<div class="qc-f"><label for="' + uid + 'a">Describe the access</label><select class="qc-sel" id="' + uid + 'a" data-access>' + opts(ACCESS, 'easy') + '</select></div>' +
        '<div class="qc-f"><label for="' + uid + 'p">Is it protected?</label><select class="qc-sel" id="' + uid + 'p" data-prot>' + opts(PROTECT, 'unsure') + '</select></div>' +
        '<label class="qc-check full" data-stumpwrap><input type="checkbox" data-stump> Also grind the stump</label>' +
      '</div>' +
      '<form class="qc-send" data-f novalidate>' +
        '<input type="hidden" name="_subject" value="New tree surgery lead - ' + esc(CONFIG.brand) + '">' +
        '<input type="text" name="_gotcha" style="display:none" tabindex="-1" autocomplete="off">' +
        '<input type="hidden" name="source_site" value="' + esc(location.hostname) + '">' +
        '<input type="hidden" name="calculator_summary" data-sum><input type="hidden" name="area" value="' + esc(area) + '"><input type="hidden" name="page" value="' + esc(location.pathname) + '">' +
        '<div class="qc-f"><label for="' + uid + 'nm">Your name</label><input class="qc-in" id="' + uid + 'nm" name="name" type="text" autocomplete="name"></div>' +
        '<div class="qc-f"><label for="' + uid + 'ph">Phone</label><input class="qc-in" id="' + uid + 'ph" name="phone" type="tel" autocomplete="tel"></div>' +
        '<div class="qc-f"><label for="' + uid + 'pc">Postcode</label><input class="qc-in" id="' + uid + 'pc" name="postcode" type="text" autocomplete="postal-code" data-pc></div>' +
        '<div class="qc-f qc-go"><button type="submit" class="qc-btn">Send quote request</button></div>' +
        '<p class="qc-err" role="alert" data-err></p>' +
        '<p class="qc-fine">Free and no obligation. We use your details only to reply. <a href="/privacy/">Privacy policy</a></p>' +
      '</form>';

    var q = function(sel){ return mount.querySelector(sel); };
    var svc = q('[data-svc]'), size = q('[data-size]'), count = q('[data-count]'), access = q('[data-access]'), prot = q('[data-prot]'),
        chk = q('[data-stump]'), pc = q('[data-pc]'), res = q('[data-r]'), grid = q('[data-g]'), form = q('[data-f]');
    var lastSizeKind = null, calc = null;

    function kind(){ var v = svc.value; return v === 'removal' || v === 'pruning' ? 'tree' : v === 'stump' ? 'stump' : v === 'hedge' ? 'hedge' : null; }

    function layout(){
      var k = kind(), v = svc.value, em = v === 'emergency';
      if (k !== lastSizeKind) {
        lastSizeKind = k;
        if (k) { q('[data-sizelabel]').textContent = SIZES[k][0]; size.innerHTML = opts(SIZES[k][1], ''); }
      }
      q('[data-row2]').hidden = !k;
      q('[data-countwrap]').hidden = !(k === 'tree' || k === 'stump');
      q('[data-row2]').className = 'qc-row2' + (q('[data-countwrap]').hidden ? ' solo' : '');
      q('[data-stumpwrap]').hidden = v !== 'removal';
      grid.hidden = em; form.hidden = em;
      q('[data-countwrap] label').textContent = k === 'stump' ? 'How many stumps?' : 'How many trees?';
    }

    function input(){
      var v = svc.value, s = { service: v, access: access.value, protection: prot.value, waste: 'pro', health: 'healthy', postcode: pc.value,
        multi: +count.value > 1 ? 'yes' : 'no', count: +count.value, stump: chk.checked ? 'yes' : 'no', extent: 'standard' };
      if (v === 'removal' || v === 'pruning') s.height = size.value;
      else if (v === 'stump') { s.stumpDia = size.value; s.stumpCount = +count.value; }
      else if (v === 'hedge') { var p = size.value.split('|'); s.hedgeLen = p[0]; s.hedgeH = p[1]; s.hedgeMode = 'trim'; }
      else if (v === 'hedgeRemoval') { s.service = 'hedge'; s.hedgeMode = 'remove'; }
      return s;
    }
    function ready(){ var v = svc.value; return v === 'hedgeRemoval' || (kind() && size.value); }

    function summary(){
      var v = svc.value, p = [label(SERVICES, v)];
      if (kind()) p.push(label(SIZES[kind()][1], size.value));
      if (kind() === 'tree' || kind() === 'stump') p.push(count.value === '5' ? '5 or more' : count.value);
      if (v === 'removal' && chk.checked) p.push('with stump grinding');
      p.push('Access: ' + label(ACCESS, access.value)); p.push('Protected: ' + label(PROTECT, prot.value));
      if (area) p.push('Area: ' + area);
      return (calc && calc.ok ? 'Guide price ' + E.money(calc.lo) + ' to ' + E.money(calc.hi) + '. ' : '') + p.join(' | ');
    }

    function paint(){
      layout(); calc = null;
      if (svc.value === 'emergency') {
        res.innerHTML = '<p class="qc-eyebrow">Emergency</p><p class="qc-price qc-call">Call us now</p><p class="qc-note"><strong>If anyone is in danger, call 999.</strong> If power lines are down, call 105. For a fallen, split or leaning tree call us so we can talk it through.</p><a class="qc-tel" href="tel:' + CONFIG.phoneHref + '">Call ' + esc(CONFIG.phone) + '</a>';
        return;
      }
      if (!ready()) {
        res.innerHTML = '<p class="qc-eyebrow">Your guide price</p><p class="qc-price qc-empty">Choose a job to see a price</p><p class="qc-note">Updates as you choose. Free written quote after a site visit.</p>';
        return;
      }
      calc = E.estimate(input());
      var fl = calc.flags.filter(function(f){ return f.kind === 'warn'; }).concat(calc.flags.filter(function(f){ return f.kind !== 'warn'; })).slice(0, 2);
      res.innerHTML = '<p class="qc-eyebrow">Your guide price</p><p class="qc-price">' + E.money(calc.lo) + ' – ' + E.money(calc.hi) + '</p>' +
        '<p class="qc-note">A guide, not a quote. ' + (calc.needsVisit ? 'We need to see this one first. ' : '') + 'Fixed written price after a free visit.</p>' +
        (fl.length ? '<ul class="qc-flags">' + fl.map(function(f){ return '<li class="' + f.kind + '">' + esc(f.short) + '</li>'; }).join('') + '</ul>' : '');
    }

    [svc, size, count, access, prot, chk].forEach(function(el){ el.addEventListener('change', paint); });
    pc.addEventListener('input', function(){ if (ready()) paint(); });

    form.addEventListener('submit', function(e){
      e.preventDefault();
      var err = q('[data-err]'); err.textContent = '';
      var n = form.elements.name.value.trim(), p = form.elements.phone.value.trim(), z = form.elements.postcode.value.trim();
      if (!ready() && svc.value !== 'emergency') { err.textContent = 'Please choose a job and its size first.'; return; }
      if (!n || p.replace(/\D/g, '').length < 9 || !z) { err.textContent = 'Please add your name, a phone number and your postcode.'; return; }
      q('[data-sum]').value = summary();
      var btn = form.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Sending...';
      fetch(CONFIG.formAction, { method: 'POST', body: new FormData(form), headers: { 'Accept': 'application/json' } })
        .then(function(r){ if (!r.ok) throw new Error('bad'); form.innerHTML = '<div class="qc-done" role="status"><strong>Thanks, we have your details.</strong> We\'ll check the tree\'s protection and come back to you to book a free visit or send a written quote. Need it sooner? Call <a href="tel:' + CONFIG.phoneHref + '"><strong>' + esc(CONFIG.phone) + '</strong></a>.</div>'; })
        .catch(function(){ btn.disabled = false; btn.textContent = 'Send quote request'; err.textContent = 'That did not send. Please call ' + CONFIG.phone + ' instead.'; });
    });

    paint();
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
