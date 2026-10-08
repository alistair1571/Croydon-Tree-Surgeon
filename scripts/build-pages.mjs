#!/usr/bin/env node
/**
 * Renders content/pages/*.md into public/<url>/index.html using the site's existing components.
 *
 *   node scripts/build-pages.mjs           write pages
 *   node scripts/build-pages.mjs --check   fail if any built page is out of date (used before deploy)
 *
 * Pages without a Markdown file are plain HTML and are left alone.
 * Facts (brand, phone, domain, form ID, insurance, years) come from content/facts.json.
 * FAQ schema is generated from the visible FAQ text, so the two cannot drift apart.
 * See content/README.md for the Markdown syntax.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { root, pub } from './lib.mjs';

const checkOnly = process.argv.includes('--check');
const facts = JSON.parse(readFileSync(join(root, 'content/facts.json'), 'utf8'));
const header = readFileSync(join(root, 'scripts/partials/header.html'), 'utf8').trimEnd();
const footer = readFileSync(join(root, 'scripts/partials/footer.html'), 'utf8').trimEnd();
const formTpl = readFileSync(join(root, 'scripts/templates/form.html'), 'utf8').trimEnd();
const origin = 'https://' + facts.domain;

const AREAS = [
  ['addiscombe', 'Addiscombe'], ['shirley', 'Shirley'], ['thornton-heath', 'Thornton Heath'], ['norbury', 'Norbury'],
  ['crystal-palace', 'Crystal Palace and Upper Norwood'], ['south-croydon', 'South Croydon'], ['selsdon', 'Selsdon'],
  ['sanderstead', 'Sanderstead'], ['purley', 'Purley'], ['coulsdon', 'Coulsdon'], ['kenley', 'Kenley'],
];
const LABELS = {
  '/tree-removal-croydon/': 'Tree removal', '/tree-pruning-croydon/': 'Tree pruning', '/stump-grinding-croydon/': 'Stump grinding',
  '/emergency-tree-surgeon-croydon/': 'Emergency tree work', '/tree-surveys-croydon/': 'Tree surveys', '/hedge-cutting-croydon/': 'Hedge cutting',
  '/trees-near-buildings-croydon/': 'Trees near buildings', '/tree-surgery-cost-calculator/': 'Cost calculator', '/services/': 'All services',
  '/guides/tree-preservation-orders-croydon/': 'Tree preservation orders', '/guides/conservation-area-tree-work-croydon/': 'Conservation area tree work',
  '/guides/do-i-need-permission-to-fell-a-tree/': 'Do I need permission to fell a tree?', '/guides/tree-removal-cost-croydon/': 'What tree work costs',
  '/guides/bird-nesting-season-tree-work/': 'Nesting season', '/guides/storm-damaged-tree-who-is-responsible/': 'Storm-damaged trees',
  '/guides/ash-dieback-croydon/': 'Ash dieback', '/guides/how-to-choose-a-tree-surgeon/': 'How to choose a tree surgeon',
};
const join_and = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
import { PRICES, pget } from './prices.mjs';

const tokens = {
  brand: facts.brand, phone: facts.phone, phoneHref: facts.phoneHref, domain: facts.domain, formId: facts.formId, insurance: facts.insurance, years: facts.years,
  areaLinks: join_and(AREAS.map(([k, n]) => `[${n}](/tree-surgeon-${k}/)`)),
  postcodes: 'CR0, CR2, CR5, CR7, CR8, SE19 and SW16',
};

// ---------- inline Markdown ----------
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const tok = s => s.replace(/\{\{([\w.]+)\}\}/g, (m, k) => {
  if (k.startsWith('p.')) { const v = pget(k); if (typeof v !== 'string') throw new Error('Unknown price token ' + m); return v; }
  return k in tokens ? tokens[k] : m;
});
export function inline(raw) {
  let s = esc(tok(raw));
  const stash = [];
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, u) => { stash.push(`<a href="${u}">${t}</a>`); return `\u0000${stash.length - 1}\u0000`; });
  // To-do markers stay visible (highlighted) until real facts replace them; `npm run verify` treats them as launch blockers.
  s = s.replace(/(£?\[(?:VERIFY|OPERATOR DATA)[^\]]*\]|£\[[^\]]*\]|\[(?:phone number|within X[^\]]*|X[^\]]*|£X[^\]]*)\])/g, '<mark class="todo">$1</mark>');
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[\s(])\*([^*\s][^*]*?)\*(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (m, i) => stash[+i]);
}
const plain = html => html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const slug = t => plain(inline(t)).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);

// ---------- front matter ----------
function parseFront(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error('missing front matter');
  const fm = {}; let key = null;
  for (const line of m[1].split('\n')) {
    let k;
    if ((k = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/))) { key = k[1]; fm[key] = k[2] === '' ? [] : k[2]; }
    else if ((k = line.match(/^\s*-\s+(.*)$/)) && Array.isArray(fm[key])) fm[key].push(k[1]);
  }
  return { fm, body: m[2] };
}

// ---------- blocks ----------
function parseBlocks(md) {
  const L = md.split('\n'); const out = []; let i = 0;
  const startsSpecial = l => /^(#{2,3}\s|\||>|\s*[-+*]\s|\s*\d+\.\s|:::|<)/.test(l);
  while (i < L.length) {
    const line = L[i]; let m;
    if (!line.trim()) { i++; continue; }
    if ((m = line.match(/^:::(\w+)\s*(.*)$/))) {
      const buf = []; i++;
      while (i < L.length && !/^:::\s*$/.test(L[i])) buf.push(L[i++]);
      i++; out.push({ t: m[1], arg: m[2].trim(), body: buf.join('\n') }); continue;
    }
    if ((m = line.match(/^(#{2,3})\s+(.*)$/))) {
      let text = m[2], chip = null, nochip = false, cm;
      if ((cm = text.match(/\s*\{chip=([^}]*)\}\s*$/))) { chip = cm[1]; text = text.replace(cm[0], ''); }
      if ((cm = text.match(/\s*\{-\}\s*$/))) { nochip = true; text = text.replace(cm[0], ''); }
      out.push({ t: 'h' + m[1].length, text, chip, nochip }); i++; continue;
    }
    if (line.startsWith('|')) {
      const rows = []; while (i < L.length && L[i].startsWith('|')) rows.push(L[i++]);
      const cells = r => r.replace(/^\||\|\s*$/g, '').split('|').map(c => c.trim());
      out.push({ t: 'table', head: cells(rows[0]), rows: rows.slice(2).map(cells) }); continue;
    }
    if (/^>\s?/.test(line)) { const b = []; while (i < L.length && /^>\s?/.test(L[i])) b.push(L[i++].replace(/^>\s?/, '')); out.push({ t: 'quote', body: b.join('\n') }); continue; }
    if (/^\s*[-+]\s+/.test(line)) {
      const checks = /^\s*\+\s+/.test(line); const items = [];
      while (i < L.length && /^\s*[-+]\s+/.test(L[i])) items.push(L[i++].replace(/^\s*[-+]\s+/, ''));
      out.push({ t: 'ul', items, checks }); continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) { const items = []; while (i < L.length && /^\s*\d+\.\s+/.test(L[i])) items.push(L[i++].replace(/^\s*\d+\.\s+/, '')); out.push({ t: 'ol', items }); continue; }
    if (line.startsWith('<')) { const b = []; while (i < L.length && L[i].trim()) b.push(L[i++]); out.push({ t: 'raw', body: b.join('\n') }); continue; }
    const p = []; while (i < L.length && L[i].trim() && !startsSpecial(L[i])) p.push(L[i++]); out.push({ t: 'p', body: p.join(' ') });
  }
  return out;
}

function renderTable(b) {
  const th = b.head.map(h => `<th scope="col">${inline(h)}</th>`).join('');
  const rows = b.rows.map(r => '<tr>' + r.map((c, k) => k === 0 ? `<td>${inline(c)}</td>` : `<td data-label="${esc(plain(inline(b.head[k] ?? '')))}">${inline(c)}</td>`).join('') + '</tr>').join('');
  return `<div class="table-wrap"><table class="data-table"><thead><tr>${th}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderBasic(b, ctx) {
  switch (b.t) {
    case 'h2': { const id = slug(b.chip ?? b.text); ctx.h2s.push({ id, text: b.chip ?? plain(inline(b.text)), nochip: b.nochip }); return `<h2 id="${id}">${inline(b.text)}</h2>`; }
    case 'h3': return `<h3>${inline(b.text)}</h3>`;
    case 'p': return `<p>${inline(b.body)}</p>`;
    case 'ul': return `<ul${b.checks ? ' class="checks"' : ''}>${b.items.map(x => `<li>${inline(x)}</li>`).join('')}</ul>`;
    case 'ol': return `<ol>${b.items.map(x => `<li>${inline(x)}</li>`).join('')}</ol>`;
    case 'table': return renderTable(b);
    case 'quote': return `<div class="answer-box">${parseBlocks(b.body).map(x => renderBasic(x, { h2s: [] })).join('')}</div>`;
    case 'raw': return tok(b.body);
    default: return '';
  }
}

// ---------- special blocks (own full-width sections) ----------
function renderFaq(b, ctx) {
  const parts = b.body.split(/^###\s+/m).slice(1);
  let html = `<section class="section bg-light"><div class="container" style="max-width:760px"><div class="section-head"><h2>${inline(b.arg || 'Common questions')}</h2></div>`;
  for (const part of parts) {
    const nl = part.indexOf('\n'); const q = part.slice(0, nl).trim(); const group = q.match(/^\{group\}\s*(.*)$/);
    if (group) { html += `<h3 class="faq-group">${inline(group[1])}</h3>`; continue; }
    const answer = part.slice(nl + 1).trim().split(/\n{2,}/).map(p => `<p>${inline(p.replace(/\n/g, ' '))}</p>`).join('');
    html += `<details class="faq"><summary>${inline(q)}</summary>${answer}</details>`;
    ctx.faqs.push({ q: plain(inline(q)), a: plain(answer.replace(/<\/p><p>/g, ' ')) });
  }
  return html + '</div></section>';
}
function renderCta(b, ctx) {
  const [title, text, btn] = b.body.split('\n').map(x => x.trim()).filter(Boolean);
  const [label, href] = btn.split('|').map(x => x.trim());
  return `<section class="cta-band"><div class="container"><h2>${inline(title)}</h2><p>${inline(text)}</p><a href="${tok(href)}" class="btn btn-lg">${inline(label)}</a></div></section>`;
}
function renderCards(b) {
  const cards = b.body.split(/^###\s+/m).slice(1).map(part => {
    const lines = part.trim().split('\n'); const [title, href, img, alt] = lines[0].split('|').map(x => x.trim());
    const rest = lines.slice(1).join(' ').trim(); const m = rest.match(/^(.*?)\s*->\s*(.+)$/);
    const pic = img ? `<img class="thumb" src="${img}" alt="${esc(alt || '')}" width="720" height="480" loading="lazy">` : '';
    return `<a href="${href}" class="service-card${img ? ' has-thumb' : ''}">${pic}<h3>${inline(title)}</h3><p>${inline(m ? m[1] : rest)}</p><span class="more">${inline(m ? m[2] : 'Learn more')}</span></a>`;
  });
  return `<section class="section"><div class="container">${b.arg ? `<h2 style="margin-bottom:18px">${inline(b.arg)}</h2>` : ''}<div class="hub-grid" style="margin:0 0 20px">${cards.join('')}</div></div></section>`;
}
function renderRelated(b, ctx) {
  const rel = (ctx.fm.related || []).map(u => `<a href="${u}" class="chip">${LABELS[u] ?? u}</a>`).join('');
  const areas = AREAS.map(([k, n]) => `<a href="/tree-surgeon-${k}/" class="chip">${n}</a>`).join('');
  return `<section class="section bg-light"><div class="container prose">` +
    (rel ? `<h3>Related pages</h3><div class="chips">${rel}</div>` : '') +
    (b.arg !== 'noareas' ? `<h3>Areas we cover</h3><div class="chips">${areas}</div>` : '') + `</div></section>`;
}
function renderSources(b) {
  const items = b.body.split('\n').filter(l => /^\s*-\s+/.test(l)).map(l => `<li>${inline(l.replace(/^\s*-\s+/, ''))}</li>`).join('');
  const note = b.body.split('\n').filter(l => l.trim() && !/^\s*-\s+/.test(l)).map(l => `<p>${inline(l)}</p>`).join('');
  return `<section class="section"><div class="container prose"><details class="sources"><summary>Sources and when we checked them</summary><ul>${items}</ul>${note}</details></div></section>`;
}
function renderFacts(b) {
  const items = b.body.split('\n').filter(l => l.includes('|')).map(l => { const [v, ...r] = l.split('|'); return `<div class="fact"><strong>${inline(v.trim())}</strong><span>${inline(r.join('|').trim())}</span></div>`; });
  return `<div class="facts">${items.join('')}</div>`;
}
function renderChips(b) {
  // ### Heading, then "- Label | /url/" lines
  const groups = b.body.split(/^###\s+/m).slice(1).map(g => {
    const lines = g.trim().split('\n'); const h = lines[0].trim();
    const chips = lines.slice(1).filter(l => /^\s*-\s+/.test(l)).map(l => { const [t, u] = l.replace(/^\s*-\s+/, '').split('|').map(x => x.trim()); return `<a href="${u}" class="chip">${inline(t)}</a>`; }).join('');
    return `<h3>${inline(h)}</h3><div class="chips">${chips}</div>`;
  }).join('');
  return `<section class="section bg-light"><div class="container prose">${groups}</div></section>`;
}
function renderCalc() {
  return `<section class="section"><div class="container calc-page"><div class="calc" id="calculator" data-calc data-service="" data-area=""><h2>Tree surgery calculator</h2><p class="calc-sub">This tool needs JavaScript. Please call <a href="tel:${facts.phoneHref}">${facts.phone}</a> or use the <a href="/contact/">contact form</a>.</p></div></div></section>`;
}
function renderForm(b) {
  // Optional body lines: title: / intro: / bullets: a | b | c / button:
  const o = {}; for (const l of b.body.split('\n')) { const m = l.match(/^(title|intro|bullets|button):\s*(.+)$/); if (m) o[m[1]] = m[2].trim(); }
  let h = tok(formTpl);
  if (o.title) h = h.replace('Get a free tree surgery quote', esc(o.title));
  if (o.intro) h = h.replace("Tell us what you need and where. We check the tree's protection first, then we send a written quote.", esc(o.intro));
  if (o.bullets) h = h.replace(/<ul><li>Protection checked before any work<\/li>.*?<\/ul>/, '<ul>' + o.bullets.split('|').map(x => `<li>${esc(x.trim())}</li>`).join('') + '</ul>');
  if (o.button) h = h.replace('Request my free quote', esc(o.button));
  return h;
}
function renderPriceCalc() {
  return `<section class="section"><div class="container calc-page"><div class="pc" id="calculator" data-price-calc><h2>Tree surgery price calculator</h2><p class="calc-sub">This tool needs JavaScript. Please call <a href="tel:${facts.phoneHref}">${facts.phone}</a> or use the <a href="/contact/">contact form</a>.</p></div></div></section>`;
}
const SPECIAL = { pricecalc: renderPriceCalc, chips: renderChips, faq: renderFaq, cta: renderCta, cards: renderCards, related: renderRelated, sources: renderSources, calc: renderCalc, form: renderForm };

// ---------- page ----------
function renderPage(file, robots) {
  const { fm, body } = parseFront(readFileSync(file, 'utf8'));
  const ctx = { fm, h2s: [], faqs: [] };
  const url = fm.url; const canon = origin + url;
  const blocks = parseBlocks(body);

  // body sections
  const sections = []; let prose = [];
  const flush = () => { if (prose.length) { sections.push({ prose: prose.join('') }); prose = []; } };
  for (const b of blocks) {
    if (b.t === 'facts') prose.push(renderFacts(b));
    else if (SPECIAL[b.t]) { flush(); sections.push({ html: SPECIAL[b.t](b, ctx) }); } else prose.push(renderBasic(b, ctx));
  }
  flush();
  let first = true;
  const chips = fm.toc === 'no' ? '' : ctx.h2s.filter(h => !h.nochip && !/^(faqs?|common questions|sources)/i.test(h.text)).slice(0, 10)
    .map(h => `<a href="#${h.id}" class="chip">${esc(h.text)}</a>`).join('');
  const main = sections.map(s => {
    if (s.html) return s.html;
    const lead = first && chips ? `<p class="jump-label">On this page</p><p class="link-row">${chips}</p>` : '';
    const idAttr = first ? ' id="top"' : '';
    first = false;
    return `<section class="section"${idAttr}><div class="container prose">${lead}${s.prose}</div></section>`;
  }).join('\n');

  // hero
  const [pName, pHref] = (typeof fm.parent === 'string' ? fm.parent : '').split('|');
  const crumb = `<a href="/">Home</a> / ` + (pName ? `<a href="${pHref}">${pName}</a> / ` : '') + `<span>${esc(fm.crumb || fm.h1)}</span>`;
  const points = Array.isArray(fm.points) && fm.points.length ? `<ul class="hero-points">${fm.points.map(p => `<li>${inline(p)}</li>`).join('')}</ul>` : '';
  const [c2l, c2h] = (fm.cta2 || 'Get a free quote|#quote').split('|');
  const heroLeft = `<div><h1>${inline(fm.h1)}</h1><p class="lead">${inline(fm.lead)}</p>${points}<div class="hero-cta" style="margin-top:24px"><a href="tel:${facts.phoneHref}" class="btn btn-lg">Call ${facts.phone}</a><a href="${c2h}" class="btn btn-lg btn-outline">${inline(c2l)}</a></div></div>`;
  const img = fm.image ? `<figure class="hero-image"><img src="${fm.image}" alt="${esc(fm.imageAlt || '')}" width="1200" height="900" fetchpriority="high"></figure>` : '';
  const calcDiv = `<div class="calc" id="calculator" data-calc data-service="${fm.service || ''}" data-area="${fm.area || ''}"><h2>Tree surgery calculator</h2><p class="calc-sub">This tool needs JavaScript. Please call <a href="tel:${facts.phoneHref}">${facts.phone}</a> or use the <a href="/contact/">contact form</a>.</p></div>`;
  const hero = (fm.image || fm.calc === 'yes')
    ? `<section class="inner-hero"><div class="container"><div class="breadcrumb">${crumb}</div><div class="hero-split">${heroLeft}${fm.calc === 'yes' ? calcDiv : img}</div></div></section>`
    : `<section class="inner-hero"><div class="container"><div class="breadcrumb">${crumb}</div><h1>${inline(fm.h1)}</h1><p class="lead">${inline(fm.lead)}</p><div class="hero-cta" style="margin-top:24px"><a href="tel:${facts.phoneHref}" class="btn btn-lg">Call ${facts.phone}</a><a href="${c2h}" class="btn btn-lg btn-outline">${inline(c2l)}</a></div></div></section>`;
  const trust = fm.trust === 'no' ? '' : `<div class="trust-bar"><div class="container"><span>Protection checked before any work</span><span>Free, written quote</span><span>Croydon Council rules explained</span><span>No obligation</span></div></div>\n`;
  const reviewed = fm.reviewed === 'no' ? '' : `\n<section class="section"><div class="container"><p>Last reviewed ${facts.reviewed}. Rules and figures come from Croydon Council pages checked on 1 October 2026; always confirm with the council for your own tree.</p></div></section>`;

  // schema
  const ld = [];
  const crumbs = [{ '@type': 'ListItem', position: 1, name: 'Home', item: origin + '/' }];
  if (pName) crumbs.push({ '@type': 'ListItem', position: 2, name: pName, item: origin + pHref });
  crumbs.push({ '@type': 'ListItem', position: crumbs.length + 1, name: fm.crumb || plain(inline(fm.h1)), item: canon });
  const provider = { '@type': 'Organization', name: facts.brand, url: origin + '/', telephone: facts.phone };
  if (fm.schema) { const [type, name, svc] = fm.schema.split('|'); ld.push(type === 'WebApplication'
    ? { '@context': 'https://schema.org', '@type': 'WebApplication', name, url: canon, applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any', provider }
    : type === 'Article'
    ? { '@context': 'https://schema.org', '@type': 'Article', headline: name, dateModified: facts.reviewedISO, author: provider, mainEntityOfPage: canon, url: canon }
    : { '@context': 'https://schema.org', '@type': type, name, serviceType: svc || name, url: canon, areaServed: fm.areaName ? { '@type': 'Place', name: fm.areaName + ', London Borough of Croydon' } : 'London Borough of Croydon', provider }); }
  if (ctx.faqs.length) ld.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: ctx.faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) });
  ld.push({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs });
  const ldHtml = ld.map(o => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n');

  const t = esc(tok(fm.title)), d = esc(tok(fm.description));
  const head = `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${t}</title>
${robots}
<meta name="description" content="${d}">
<link rel="canonical" href="${canon}">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${canon}">
<meta property="og:type" content="website">
<meta property="og:image" content="${origin}/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${origin}/og-image.png">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="style" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" onload="this.onload=null;this.rel='stylesheet'">
<noscript><link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet"></noscript>
${ldHtml}
<link rel="stylesheet" href="/style.css">
</head>
<body>
`;
  return { url, html: head + header + '\n' + hero + '\n' + trust + main + reviewed + '\n\n' + footer + ((hero + main).includes('data-calc') ? '\n<script src="/price-engine.js"></script>' : '') + '\n<script src="/script.js"></script>\n' + [].concat(fm.scripts || []).map(u => `<script src="${u}" defer></script>\n`).join('') + '</body>\n</html>\n' };
}

// ---------- run ----------
const dir = join(root, 'content/pages');
const home = readFileSync(join(pub, 'index.html'), 'utf8');
const robots = (home.match(/<meta name="robots" content="[^"]*">/) || ['<meta name="robots" content="noindex,nofollow">'])[0];
let changed = 0, n = 0;
for (const f of readdirSync(dir).filter(x => x.endsWith('.md')).sort()) {
  n++;
  const { url, html } = renderPage(join(dir, f), robots);
  const out = join(pub, url, 'index.html');
  const cur = existsSync(out) ? readFileSync(out, 'utf8') : '';
  if (cur !== html) {
    changed++;
    if (checkOnly) console.log(`  out of date: ${url}  (run: npm run build)`);
    else { mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, html); }
  }
}
console.log(`${checkOnly ? 'Checked' : 'Built'} ${n} page(s) from content/pages, ${changed} ${checkOnly ? 'out of date' : 'written'}.`);
process.exit(checkOnly && changed ? 1 : 0);
