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

**2.27.0**
- Photos: re-cropped and compressed the seven supplied photos plus the stump grinder photo at 3:2 (hero 960 x 640, cards 640 x 427, about 1.4 MB for the folder, down from 2.4 MB). The fixed `height` attribute was overriding the aspect ratio and made hero photos 900px tall on phones; images now use `height:auto`, 3:2 on desktop and a 16:9 strip (max 260px) at 920px and under. Hero `width`/`height` attributes updated to match.
- Calculator on inner pages starts as a single compact bar at 920px and under ("Instant guide price", Open or Close). Links to `#calculator` open it. Desktop unchanged. The homepage calculator is unchanged.
- The top bar ("Tree surgery across the London Borough of Croydon / Free quotes") is hidden at 1024px and under.
- Fixed hero paragraphs that showed literal quotation marks: the front matter parser now strips surrounding double quotes.

**2.26.0**
- Cost calculator page rewritten again from the new copy (`content/pages/calculator.md`): six worked examples, a new "How to get the most accurate price" section, the national comparison paragraph and a 15-question FAQ whose schema matches the supplied schema exactly. The closing note still says prices come from published price guides, not the operator's own work, until the operator confirms prices. `test-pricing.mjs` checks the new worked examples against the model.

**2.25.0**
- How-to-choose-a-tree-surgeon guide rewritten from the new copy (`content/pages/guide-choose.md`) with a 12-question FAQ whose schema matches the supplied schema exactly. Insurance levels, certificate bodies and the waste carrier phone number are used as supplied; recheck periodically.

**2.24.0**
- Ash dieback guide rewritten from the new copy (`content/pages/guide-ash.md`) with a 12-question FAQ whose schema matches the supplied schema exactly. `test-pricing.mjs` now checks the ash guide price table against the model as well as the cost guide.

**2.23.0**
- Storm-damaged tree guide rewritten from the new copy (`content/pages/guide-storm.md`) with a 12-question FAQ whose schema matches the supplied schema exactly. Safety numbers are used as supplied; recheck them periodically.

**2.22.0**
- Bird nesting season guide rewritten from the new copy (`content/pages/guide-nesting.md`) with a 12-question FAQ whose schema matches the supplied schema exactly. Penalties, RSPB dates and the wildlife crime contact details are used as supplied.

**2.21.0**
- Tree removal cost guide rewritten from the new copy (`content/pages/guide-cost.md`) with a 12-question FAQ whose schema matches the supplied schema exactly. `test-pricing.mjs` now checks the guide's price table against the model. The national comparison figures, crew day rates and parking notice period are used as supplied.

**2.20.0**
- Permission-to-fell guide rewritten from the new copy (`content/pages/guide-permission.md`) with a 12-question FAQ whose schema matches the supplied schema exactly. Felling licence limits, utility phone numbers and the parking bay notice period are used as supplied; recheck periodically.

**2.19.0**
- Conservation area tree work guide rewritten from the new copy (`content/pages/guide-conservation-area.md`) with a 12-question FAQ whose schema matches the supplied schema exactly. The list of 21 areas, the nine areas under consideration and the 75 mm and two-year points are used as supplied; update the list when the council designates any new area.

**2.18.0**
- Tree preservation orders guide rewritten from the new copy (`content/pages/guide-tpo.md`) with a 12-question FAQ whose schema matches the supplied schema exactly. Council contact details, the £32.68 copy fee and the "last checked October 2026" note are used as supplied; recheck them periodically.

**2.17.0**
- Coulsdon area page rewritten from the new copy (`content/pages/area-coulsdon.md`) with a 10-question FAQ whose schema matches the supplied schema exactly. Court Avenue is described as under consideration only; update if the council designates it.

**2.16.0**
- Purley area page rewritten from the new copy (`content/pages/area-purley.md`) with a 10-question FAQ whose schema matches the supplied schema exactly. The Webb Estate draft plan is described as a draft (published 16 September 2025); update when Full Council decides.

**2.15.0**
- Sanderstead area page rewritten from the new copy (`content/pages/area-sanderstead.md`) with a 10-question FAQ whose schema matches the supplied schema exactly. The page says Sanderstead Village is only under review as a conservation area; update it if the council designates it.

**2.14.0**
- Selsdon area page rewritten from the new copy (`content/pages/area-selsdon.md`) with a 10-question FAQ whose schema matches the supplied schema exactly.

**2.13.0**
- Crystal Palace and Upper Norwood and South Croydon area pages rewritten from the new copy (`area-crystal-palace.md`, `area-south-croydon.md`), with 10 and 9 question FAQs whose schemas match the supplied schemas exactly.

**2.12.0**
- Norbury area page rewritten from the new copy (`content/pages/area-norbury.md`) with a 9-question FAQ whose schema matches the supplied schema exactly. The page explains that SW16 crosses borough lines and that Croydon's rules apply to Croydon addresses only.

**2.11.0**
- Thornton Heath area page rewritten from the new copy (`content/pages/area-thornton-heath.md`) with a 10-question FAQ whose schema matches the supplied schema exactly. Area-page price check now finds any guide-price table whatever its first column is called.

**2.10.0**
- Shirley area page rewritten from the new copy (`content/pages/area-shirley.md`) with a 10-question FAQ whose schema matches the supplied schema exactly. Hero calculator, quote form and link chips unchanged. The page says the Whitgift Estate conservation area outcome is unconfirmed (consultation closed 15 May 2026): check the council's heritage pages and update when it is decided.

**2.9.0**
- Addiscombe area page rewritten from the new copy (`content/pages/area-addiscombe.md`) with an 11-question FAQ whose schema matches the supplied schema exactly. The hero calculator, quote form and service and nearby-area chips are unchanged. Area-page price tables are now checked against the model by `npm run test:pricing`.

**2.8.0**
- Calculator page copy rewritten from the new copy (`content/pages/calculator.md`) with a 12-question FAQ whose schema matches the supplied schema exactly. The calculator itself is unchanged. Every row of the price table and the first worked example are checked against the model by `npm run test:pricing`. The closing note now says the prices come from published UK and London price guides (the supplied wording, "from our Croydon work", was not true yet because the operator has not confirmed the prices).

**2.7.0**
- Trees near buildings page rewritten from the new copy (`content/pages/trees-near-buildings.md`) with a 12-question FAQ whose schema matches the supplied schema exactly. Prices beside buildings are checked against the model by `npm run test:pricing`.

**2.6.0**
- Hedge cutting page rewritten from the new copy (`content/pages/hedge-cutting.md`) with a 12-question FAQ whose schema matches the supplied schema exactly. Hedge price table checked against the model by `npm run test:pricing`.

**2.5.0**
- Tree pruning and stump grinding pages rewritten from the new copy (`content/pages/tree-pruning.md`, `stump-grinding.md`), each with a 9-question FAQ whose schema matches the supplied schema exactly. Price tables checked against the model by `npm run test:pricing`.
- Stump grinding page and homepage service card now use the correct tracked stump grinder photo (hero and card crops regenerated from the supplied image).

**2.4.0**
- Emergency tree work page rewritten from the new copy (`content/pages/emergency.md`): triage table, who to ring by location, do and don't list, what happens when we attend, protected trees, insurance, rogue traders, other trees, 9-question FAQ. The opening-hours statement ("not a 24-hour service") sits in the hero. FAQ schema matches the supplied schema exactly. Call-out and large-tree prices are checked against the model by `npm run test:pricing`.

**2.3.0**
- Tree surveys page rewritten from the new copy (`content/pages/tree-surveys.md`): which survey, costs, what a survey can and cannot tell you, duty of care, BS 5837, subsidence, buying a house, protected trees, report contents, who should survey, 10-question FAQ. FAQ schema matches the supplied schema exactly. Survey prices are checked against the model by `npm run test:pricing`. List spacing on the tree removal page tidied so numbered lists render as lists.

**2.2.0**
- Tree removal page rewritten from the new copy (`content/pages/tree-removal.md`): short answers, "does it need to come down" table, permission rules, removal methods, guide-price table, day-of steps, waste carrier duty of care, specific situations, wildlife and timing, aftercare, 9-question FAQ, areas and sources. Hero photo, quote form and related-services block unchanged. The FAQPage schema is generated from the visible FAQ and matches the supplied schema exactly. `npm run test:pricing` now also checks the page's price table against the model.

**2.1.0**
- Homepage rewritten from the new copy: short answers, "what do you need help with" router, Croydon rules table, guide-price table (checked against the price model by `npm run test:pricing`), emergency steps, ownership, wildlife and buildings, areas, guides, 8-question FAQ, call to action and sources. Template components kept as they were: hero calculator, service cards, Why choose us, 3 steps, Compare, area cards, header and footer.
- New title and meta description. The homepage FAQPage JSON-LD now holds the same 8 questions and answers as the visible FAQ (generated from the same text). Organization, WebSite and Service schema unchanged.
- Removed from the homepage because the new copy covers them: the old "Your Local Tree Surgeons" intro, the "Clear rules. Safe checks" strip and the old 25-question FAQ.

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
