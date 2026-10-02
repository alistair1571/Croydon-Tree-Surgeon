# Croydon Tree Surgeon

A static lead-generation site for tree surgery in the London Borough of Croydon (plus Warlingham in Surrey). Plain HTML, one `style.css` and one `script.js`, built the same way as the Miami Polished Concrete site, and served by Cloudflare Workers static assets.

- 39 pages: home, 7 services, 12 areas, 8 guides, a calculator page, and company pages
- Palette: cream `#F4EFE4`, dark green `#1C3227`, lime `#D5F289` (calls to action and highlights). Font: Manrope.
- The homepage layout follows lovey.com. A tree surgery calculator sits in the hero of every page.

## What is in the folder

```
wrangler.jsonc          Cloudflare config (assets only, no Worker code)
package.json            npm scripts: dev, deploy, check
scripts/set-config.sh   replaces the launch placeholders everywhere in one command
public/                 the whole site
  index.html            homepage
  style.css, script.js  all styling, plus the calculator and form scripts
  _headers              security and cache headers (Cloudflare reads this file)
  404.html              served for unknown URLs
  sitemap.xml, robots.txt
  services/ areas/ guides/ ...   one folder per page, each with an index.html
```

## 1. Replace the placeholders

These appear across the site and must be changed before launch:

| Placeholder | What to put |
| --- | --- |
| `www.YOURDOMAIN.com` | Your domain (canonicals, sitemap, schema, social tags) |
| `020 7946 0142` | Your real phone number (the `tel:` link is derived from it) |
| `YOURFORMID` | The ID from your Formspree URL, `https://formspree.io/f/<ID>` |
| `Croydon Tree Surgeon` | Your brand, if you choose another name |

Run it once, from the project root:

```sh
sh scripts/set-config.sh --domain www.example.co.uk --phone "020 8123 4567" --form abc123
# optional: --brand "Your Brand"
```

To change values again later, pass the current ones as `--old-domain`, `--old-phone`, `--old-form` and `--old-brand`.

Then check nothing was missed:

```sh
grep -rn "YOURDOMAIN\|YOURFORMID\|7946 0142" public | head
```

The script was tested on a copy of the site. The domain, phone and Formspree ID all replaced cleanly, and the `tel:` links updated.

Also still to do by hand:

- The privacy and terms pages have bracketed gaps: data controller name, address, ICO registration, company details.
- Create the logo in your final brand if the name changes (`public/images/logo-dark.png`, `logo-light.png`, `favicon.svg`, `og-image.png`).

## 2. Run it locally

You need Node 18 or newer.

```sh
npm install
npm run dev        # serves ./public with Wrangler, normally at http://localhost:8787
```

Google Fonts needs internet access to load Manrope; offline, the page falls back to a system font.

## 3. Deploy to Cloudflare

```sh
npx wrangler login
npm run check      # dry run: confirms the config and that all files are read
npm run deploy     # publishes to https://croydon-tree-surgeon.<your-subdomain>.workers.dev
```

`npm run check` was run on this project and read all 90 files without errors. `dev` and a live deploy have not been run, so test them on your account.

**Custom domain.** The domain must be on your Cloudflare account. In `wrangler.jsonc`, uncomment `routes` and put your domain in `pattern`, then deploy again. Also decide whether `www` or the bare domain is canonical, and redirect the other one (a Cloudflare redirect rule is the simplest way). The canonical tags use the `www` form.

**Trailing slashes.** Pages are served as `/about/`. `html_handling: auto-trailing-slash` makes `/about` redirect to `/about/`, which matches the links, sitemap and canonicals.

**404s.** `not_found_handling: 404-page` serves `/404.html` with a 404 status.

If a Wrangler option has changed since this was written, check the current Cloudflare Workers static assets documentation.

## 4. The calculator

It lives in `public/script.js`, in the section headed `TREE SURGERY CALCULATOR`, and renders into every `<div data-calc>`.

- It does not show prices. It shows a job profile: how involved the job is, what will shape the quote, and which council rules to check. It then sends the lead to Formspree with a plain-text summary in the `calculator_summary` field.
- Each page pre-selects its own service and area through `data-service` and `data-area`.
- It flags: conservation areas and protected trees, ash dieback, nesting season (March to August), Warlingham being in Tandridge, and Crystal Palace and Norbury spanning several boroughs.
- **To show prices**, fill `PRICES` with real `[low, high]` per-job figures from real, recent jobs, check `ACCESS_MULT` and `EXTRA_PRICE`, then set `showPrices: true`. Any figure left as `null` makes the calculator fall back to the job profile, so it never shows a made-up number.
- The calculator's `CONFIG` block also holds the brand, phone and form address. `set-config.sh` updates these too.

## 5. Content rules to keep

These came out of the planning work. Please do not break them when editing.

- **No invented prices, reviews, qualifications, insurance amounts or job counts.** The projects, reviews and "about the tree surgeon" sections are deliberate placeholders. Fill them only with real, permitted material.
- **Every council rule is sourced.** Each page ends with a "Sources" panel. Keep it, and update the date when you re-check.
- **Croydon's rules apply only to Croydon addresses.** Warlingham is Tandridge (Surrey). Crystal Palace, Upper Norwood and Norbury sit across boroughs. Those pages say so; do not let a Croydon rule leak onto them.
- **Area pages go live only when there is a real job in that area**, with photos and permission. If the operator does not work in an area, remove its page and links.
- **Duplicate-content test:** swap the town name on any paragraph. If it still reads true, rewrite it.
- The site is a lead generation website, and says so in the footer, on every area page and on `/how-it-works/`. Keep the disclosure.

## 6. Before you publish: things to confirm

Open items from the research, each needing a check on the live council site:

- **Conservation areas:** current boundaries for Croham Manor Road, East India Estate, Norbury Estate, Webb Estate, Upper Woodcote Village, Kenley Aerodrome and the Upper Norwood areas (Beulah Hill, Church Road, Norwood Grove, Upper Norwood Triangle, Harold Road).
- **Proposed areas:** whether Whitgift Estate, Croham Park Estate, Court Avenue (Coulsdon), Sanderstead Village and Brighton Road (Purley) have been designated. Pages say "under consideration" until then.
- **Ward tree canopy figures:** the GLA ward spreadsheet could not be read during the build, so the area pages show London's 19.6% only. Add the local ward figures with attribution. Do not republish the file.
- **Parking suspension fees:** two versions of Croydon's page showed different fees, so the site quotes none. Check the live page.
- **Felling licences:** confirm the current Forestry Commission exceptions, including for gardens.
- **Warlingham:** re-download Tandridge's full tree preservation order data and replace the 26-order snapshot with true totals and a new date.
- **Tandridge's own pages** on conservation area notices and TPO applications: read them and replace the national wording.
- **SERP and map pack:** check each area from a local postcode before promising rankings. Coulsdon has strong local competitors.

## 7. After launch

1. Add the site to Google Search Console and submit `https://<your-domain>/sitemap.xml`.
2. Test the calculator and every form end to end, including the Formspree confirmation.
3. Validate structured data in Google's Rich Results Test.
4. Set up the Google Business Profile for the real operator, with a real address. No spoofed addresses.
5. Ask every customer for a Google review that names the job type and area.
6. Re-check sourced facts quarterly and update the "Last reviewed" date.

## 8. Editing pages

The pages are plain HTML, so you can edit them directly. Common edits:

- Add a real project: edit `public/projects/index.html` and replace the placeholder box.
- Add reviews: edit `public/reviews/index.html`, and add a testimonial carousel to the homepage in the same style as the local-facts carousel, only with real reviews.
- Add a new area: copy an existing area folder, change the text, and add it to the nav (in every page's header), the footer, `areas/index.html` and `sitemap.xml`. The header is repeated in each file, so use a project-wide search and replace.

## Notes

- Nothing here sets cookies, so no cookie banner is built in. If you add analytics or ads, add a consent banner and update the privacy page.
- Images are minimal (logo, favicon, social image). Add real job photos with descriptive alt text and compress them before upload.
