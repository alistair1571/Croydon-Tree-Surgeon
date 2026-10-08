# Croydon Tree Surgeon

A static site for tree surgery in the London Borough of Croydon. Plain HTML, one `style.css` and one `script.js`, served by Cloudflare Workers static assets.

- 34 pages: home, services hub and 7 services, areas hub and 11 areas, guides hub and 8 guides, a calculator page, contact, privacy and terms (plus a 404)
- Some pages are built from Markdown in `content/pages/` (see "Two kinds of page" below); the rest are plain HTML
- Palette: cream `#F4EFE4`, dark green `#1C3227`, accent green `#55BA36` (set once in `style.css`: `--green` and `--cta`, with `--cta-hover` and the soft tint `--green-tint`). Font: Manrope.
- A compact tree surgery calculator sits in the hero of the homepage, hubs and area pages, and a longer one on the calculator page.
- The site is written in the tree surgeon's own voice ("we"). See "Content rules" before editing.

## What is in the folder

```
wrangler.jsonc          Cloudflare config (assets only, no Worker code)
package.json            npm scripts (see "Commands")
content/
  facts.json            brand, phone, domain, form ID, insurance, years (used by built pages)
  pages/*.md            pages written in Markdown, built into public/ (see content/README.md)
scripts/
  build-pages.mjs       renders content/pages/*.md into public/
  templates/form.html   the quote form used by built pages
  partials/header.html  the header and top bar, written once
  partials/footer.html  the footer and mobile call bar, written once
  sync-shell.mjs        stamps the two partials into every page
  build-sitemap.mjs     writes public/sitemap.xml from the pages on disk
  check.mjs             structure checks and launch blockers
  launch.mjs            switches the site between staging (noindex) and live
  set-config.sh         sets domain, phone, form ID and brand everywhere
public/                 the whole site
  index.html, style.css, script.js, _headers, robots.txt, sitemap.xml, 404.html
  <page>/index.html     one folder per page
```

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Serve `./public` locally with Wrangler (normally http://localhost:8787) |
| `npm run build` | Render `content/pages/*.md` into `public/`. Run after editing a Markdown page or `facts.json` |
| `npm run sync` | Copy `scripts/partials/*` into every page. **Run after editing the header or footer** |
| `npm run sitemap` | Rebuild `sitemap.xml`. Run after adding or removing a page |
| `npm run test:pricing` | Check the price model against its published sources and check each adjustment |
| `npm run verify` | Structure checks (must pass) and a list of launch blockers |
| `npm run verify:launch` | The same, but any launch blocker fails. Use before going live |
| `npm run launch` / `npm run unlaunch` | Make the site indexable / hide it from search engines |
| `npm run state` | Show whether the site is staging or live |
| `npm run deploy` | Runs sync check and `verify` first, then publishes with Wrangler |
| `npm run config -- --domain ... --phone ... --form ...` | See below |

## Staging and going live

**The site is in staging.** Every page has `noindex,nofollow`, `_headers` sends `X-Robots-Tag: noindex`, and `robots.txt` has no sitemap line. Do not index it until the launch blockers are cleared.

1. **Set the real values** (run once, from the project root):

   ```sh
   npm run config -- --domain www.example.co.uk --phone "020 8123 4567" --form abc123
   # optional: --brand "Your Brand"
   npm run sitemap
   ```

   This replaces `www.YOURDOMAIN.com` (canonicals, og:url, schema, sitemap), the phone number (and its `tel:` links), and the Formspree ID, in the pages, `script.js` and the shared partials. To change values later, pass the current ones as `--old-domain`, `--old-phone`, `--old-form`, `--old-brand`. The ID is the part of your Formspree URL after `/f/`.

2. **Clear the launch blockers.** `npm run verify` lists them: unresolved `[VERIFY]` and `[OPERATOR DATA]` markers, placeholder prices and phone numbers, and wording left over from the old lead-generation model.

3. **Check, then switch on:**

   ```sh
   npm run verify:launch   # must pass
   npm run launch
   npm run deploy
   ```

4. **After launch:** add the site to Google Search Console and submit `/sitemap.xml`; test the calculator and every form end to end (including the Formspree confirmation); validate structured data in Google's Rich Results Test; set up the Google Business Profile for the real operator with a real address.

**Custom domain.** The domain must be on your Cloudflare account. In `wrangler.jsonc`, uncomment `routes`, put your domain in `pattern`, and deploy. Decide whether `www` or the bare domain is canonical, and redirect the other one (a Cloudflare redirect rule is simplest). The canonical tags use whatever domain you pass to `--domain`.

## Editing

## Two kinds of page

- **Built pages** (Markdown in `content/pages/`): every page except the homepage. That is the services hub and 7 services, the calculator page, the areas hub and 11 area pages, the guides hub and 8 guides, contact, privacy and terms. Edit the Markdown, run `npm run build`. The build adds the hero, tables, FAQs, quote form, canonical and og tags, and the schema (FAQ schema is generated from the visible FAQ text, so they always match). Syntax is in `content/README.md`.
- **Plain HTML pages** (only the homepage, which has bespoke sections): edit the HTML directly.

Service photos live in `public/images/services/`: each service has a hero version (`name.jpg`, 4:3, 1200 x 900) and a card version (`name-card.jpg`, 3:2, 720 x 480) used on the homepage and the services hub. To change one, crop the new photo to both ratios, keep the file names, and rebuild. Alt text is set on each page (the `imageAlt:` line on Markdown pages, the `alt` on the homepage and hub cards), and should describe what the picture shows. `npm run verify` blocks launch if any page still points at `/images/placeholders/`.

## Editing

- **Header, menus, footer:** edit `scripts/partials/header.html` or `footer.html`, then `npm run sync`. Do not edit the header or footer inside individual pages; `sync` will overwrite them (and `verify` fails if they differ).
- **Adding a page:** create `public/<slug>/index.html` (copy a similar page), add it to the menu or footer partial if needed, then `npm run sync && npm run sitemap && npm run verify`. `verify` checks the canonical, og:url, schema URLs, links and sitemap for you.
- **Removing a page:** delete its folder, remove its links (partials and body text), then `npm run sync && npm run sitemap && npm run verify`. `verify` fails on any broken link. Add a 301 redirect if the page was ever indexed.
- **Styling:** everything is in `public/style.css`. The desktop dropdown menus stay open while hovered (a hover bridge and a short grace period); the mobile header and menu have their own spacing in the `max-width:920px` and `max-width:600px` blocks.

## The calculators

There are two, and they share one price engine.

- **The price engine** is `public/price-engine.js`: the price model (`MODEL`), the `estimate()` function and the `operatorConfirmed` flag. Every price on the site comes from it. See `PRICING.md`. It is loaded before `script.js` on every page that has the shared calculator (the build adds the tag; the check fails if it is missing).
- **The shared calculator** is one compact panel in the hero of the homepage, the services and areas hubs and the 11 area pages. It lives in `public/script.js`, in the section headed `SHARED CALCULATOR`, and renders into every `<div data-calc>`. The result is at the top and updates as you choose. The fields are: what you need (a dropdown), the tree height, stump width or hedge length and height (a dropdown that changes with the job), how many, a description of the access, and whether it is protected. A tick-box adds stump grinding to a removal. Name, phone and postcode, and a **Send quote request** button, sit in the same panel. `data-service` preselects the job and `data-area` names the area in the lead.
- **The calculator page** (`/tree-surgery-cost-calculator/`) uses `public/price-calculator.js`, a longer step-by-step form based on Bark's questions, for people who want to give more detail.

Both send the lead to Formspree with a plain-text summary and the guide price. Their `CONFIG` blocks hold the brand, phone and form address, which `set-config.sh` updates. Run `npm run test:pricing` after changing any price.

## Content rules to keep

- **No invented prices, reviews, qualifications, insurance amounts, accreditations, job counts or response times.** Every claim about the business must be true of the real operator. Until the operator's facts are confirmed, leave the claim out or mark it `[OPERATOR DATA]`; `npm run verify` treats markers as launch blockers.
- **Every council rule is sourced.** Each page ends with a "Sources" panel. Keep it, and update the date when you re-check.
- **Croydon's rules apply only to Croydon addresses.** Crystal Palace, Upper Norwood and Norbury sit across boroughs; those pages say so. Do not let a Croydon rule leak onto them.
- **Area pages go live only when the operator really works in that area.** If they do not, remove its page and links.
- **Duplicate-content test:** swap the town name on any paragraph. If it still reads true, rewrite it.
- **One source of truth for facts.** Phone, domain, form ID and brand come from `set-config.sh`. Prices come only from `MODEL` in `public/price-engine.js` (see `PRICING.md`) or real quotes.

## Things to confirm before launch

Each needs a check on the live council site:

- **Conservation areas:** current boundaries for Croham Manor Road, East India Estate, Norbury Estate, Webb Estate, Upper Woodcote Village, Kenley Aerodrome and the Upper Norwood areas (Beulah Hill, Church Road, Norwood Grove, Upper Norwood Triangle, Harold Road).
- **Proposed areas:** whether Whitgift Estate, Croham Park Estate, Court Avenue (Coulsdon), Sanderstead Village and Brighton Road (Purley) have been designated. Pages say "under consideration" until then.
- **Ward tree canopy figures:** the GLA ward spreadsheet could not be read during the build, so area pages show London's 19.6% only. Add local ward figures with attribution; do not republish the file.
- **Parking suspension fees:** two versions of Croydon's page showed different fees, so the site quotes none.
- **Felling licences:** confirm the current Forestry Commission exceptions, including for gardens.
- **SERP and map pack:** check each area from a local postcode before promising rankings. Coulsdon has strong local competitors.
- **Privacy and terms:** have both reviewed by a solicitor and make sure they describe who the data controller is and who contracts with the customer.

## Notes

- Nothing here sets cookies, so no cookie banner is built in. If you add analytics or ads, add a consent banner and update the privacy page.
- Brand images: `images/logo-dark.png` (header), `images/logo-light.svg` (footer), `favicon.svg`, `favicon.ico`, `favicon-32.png`, `apple-touch-icon.png` and `og-image.png` (the social sharing image, 1200 x 630). Other images are minimal. Add real job photos with descriptive alt text and compress them before upload.
- Cloudflare Git deploy troubleshooting: if you see `PropertyNameExpected` at `wrangler.jsonc:3:2`, the config has an extra pair of braces; it must start with one `{` and end with one `}`. If you see `Asset too large`, keep the site in `public/` with `"directory": "./public"` (as here), or put it at the root and use `.assetsignore`.

## Changelog

**2.0.1**
- Phone number set to 07881 305352 (display and `tel:` links, structured data, both calculators) and Formspree switched to its own form, `xljgjozn`, so tree surgery leads no longer share the Derby inbox. `npm run verify:launch` passes with no blockers (one warning: the prices are published-guide figures accepted for launch).

**2.0.0 (launch candidate)**
- Domain set to `treesurgeoncroydon.com` (non-www): canonicals, og:url, schema and sitemap all follow it. `robots.txt` now names the sitemap. The site is in live (indexable) mode: every noindex tag and the staging header are removed, except on the 404 page, which should stay noindex.
- All `[VERIFY]` and `[OPERATOR DATA]` markers are cleared. Research notes were removed and the claims left as written; policy details in the Terms and Privacy pages use defaults (quote valid 30 days, payment within 7 days, no cancellation fee with 48 hours' notice, complaints answered in 5 working days, enquiries kept 12 months and job records 6 years); report turnaround is stated as 5 working days; replies as the same working day. No registration numbers, company number, VAT number, address or email were invented: those lines are removed and should be added when known.
- Emergency hours are the opening hours (Monday to Saturday, 8am to 6pm), with a line saying we respond to emergencies. The emergency page says plainly that there is no 24-hour service, and "out-of-hours" pricing wording is gone.
- Prices are recorded as accepted for launch (`acceptedForLaunch` in `price-engine.js`); the checker shows a warning rather than a blocker.
- Six over-length titles and one long description shortened.

**1.9.0**
- Real photos replace the placeholders on all 7 service pages (in the hero, same 4:3 crop), on the homepage service cards, and now on the services hub cards too. The hub has an extra card crop for "Felling, dismantling and clearing". Hero images are 1200 x 900 (150 to 260KB), card images 720 x 480. The placeholder folder and its launch blocker are gone.

**1.8.0**
- Accent colour is now `#55BA36` (was a lime). The hover shade is lighter so button text stays readable, and selected states in the calculators use a soft green tint.
- New logos: the dark logo in the header, the light SVG in the footer. New favicon set (SVG, ICO, 32px PNG, Apple touch icon) and a rebuilt social sharing image.
- Formspree is now set to the same form as the Derby pest control site, `mbglyajq`. Every form and both calculators send a hidden `source_site` field, so leads from the two sites can be told apart in the shared inbox. The subject line also says which site it is.

**1.7.0**
- The shared calculator is rebuilt as one compact panel with the result at the top: what you need, size, how many, access, protected or not, then name, phone, postcode and a Send quote request button. It now shows real guide prices, from the same engine as the calculator page.
- The price model moves to its own file, `public/price-engine.js`, which both calculators and the build use. Access is now a price factor (a narrow route in, or tight access, cost more). The "calculator is configured not to show prices" launch check is replaced by a check that every calculator page loads the engine.

**1.6.0**
- Every price on the site now comes from one model (`MODEL` in `public/price-engine.js`) through `scripts/prices.mjs`. All 152 price placeholders on the service, area, guide and calculator pages are replaced with tokens, and the homepage FAQ prices are filled in. Tables use the calculator's four height bands (under 3m, 3 to 6m, 6 to 9m, over 9m). See `PRICING.md`.
- `npm run test:pricing` now also checks every page for leftover placeholders and unknown tokens, and checks the homepage figures against the model.

**1.5.0**
- New price calculator on the calculator page only: asks Bark's questions (property, owner, stump, height, number of trees, health, proximity, protections, location, start date, waste) plus the job type, pruning extent and hedge size, and shows a guide price range. Documented in `PRICING.md`, tested with `npm run test:pricing`.
- The calculator page's wording promises a guide price, which is now true on that page. The prices are from published guides until the operator confirms them (`operatorConfirmed`).

**1.4.0**
- Hedge cutting, trees near buildings, and the nesting season, storm damage, ash dieback and how-to-choose guides rebuilt, merging fuller drafts with the existing verified facts and replacing out-of-area sources with primary ones.
- Contact, Privacy and Terms rewritten for a business that does the work. Privacy lists only what the site really does (Formspree for forms, Cloudflare hosting, Google Fonts, no cookies of its own). Business details, retention periods, the 14-day cancellation notice and liability limits are marked `[OPERATOR DATA]` or `[VERIFY]` and **need a solicitor's review before launch**.
- All wording from the old lead-generation model is gone from every page.

**1.3.0**
- Areas hub rebuilt with a distinct summary per area, a postcode and council table, and a corrected council-boundary section (Crystal Palace and Upper Norwood is four boroughs: Bromley, Croydon, Lambeth and Southwark).
- All 11 area pages rebuilt from Markdown. The existing researched, sourced local sections (conservation areas, species tables, access, local data, sources) are kept unchanged apart from voice; new sections added: services in the area, cost, why choose us, and extra FAQs. Warlingham removed from the nearby-area chips.
- Guides hub plus the TPO, conservation area, permission-to-fell and cost guides rebuilt, merging fuller drafts with the verified Croydon facts from the old guides (no application fee, checks go via development management, Croydon's page mentions no small-tree or emergency exemption for conservation areas, named and proposed conservation areas).

**1.2.0**
- New copy for the homepage (H1, copy block, service cards with photos, Why Choose Us, rules section, FAQs), services hub, tree removal, pruning, stump grinding, emergency, surveys and calculator pages. Warlingham and CR6 removed from the copy; SE19 and SW16 added.
- Hero calculators replaced by photo slots on the service pages (placeholders until real photos are added).
- Markdown build for long pages (`npm run build`), with automatic FAQ schema.
- New launch checks: placeholder photos, a calculator that is configured not to show the "guide price" the copy promises, unresolved `{{tokens}}`.
- Hedge cutting, trees near buildings, the areas hub, the 11 area pages, the 8 guides, contact, privacy and terms still carry the older copy and are next.

**1.1.0**
- Removed the About, How it works, Projects, Reviews and Warlingham pages, and every link to them (including the footer, menus, calculator and sitemap).
- Removed the lead-generation section from every page, the footer disclosure and the "pass my details to one local tree surgeon" consent wording; the form consent now reads "contact me about this enquiry".
- Shared header and footer moved to `scripts/partials/` with `npm run sync`.
- Desktop menus stay open while hovered; the mobile header and menu have more vertical space.
- Sitemap is generated from the pages; the 404 page no longer has a canonical; the site is in staging (noindex) until `npm run launch`.
- New `verify` checks (canonicals, links, anchors, schema, sitemap, placeholders) run before every deploy.
