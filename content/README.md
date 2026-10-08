# Content pages (Markdown)

Pages listed in `content/pages/*.md` are **built** into `public/<url>/index.html` by `npm run build`. Edit the Markdown, then run `npm run build`. Do not edit the generated HTML for these pages; the next build overwrites it. Pages without a Markdown file here are plain HTML and are edited directly.

Facts shared across pages (brand, phone, domain, form ID, insurance, years) live in `content/facts.json`; `npm run config` updates them.

## Front matter

```
---
url: /tree-removal-croydon/          page path (required)
title: ...                            <title> and social title
description: ...                      meta description
h1: Tree Removal in Croydon
lead: Opening paragraph under the H1
points:                               optional tick list under the lead
  - First point
image: /images/services/x.jpg     hero image, 4:3 (put imageAlt: next to it) (or  calc: yes  to put the calculator in the hero)
imageAlt: What the photo shows
parent: Services|/services/           breadcrumb parent (leave empty for none)
crumb: Tree removal                   breadcrumb label
schema: Service|Name|Service type     Service, Article or WebApplication schema (FAQ and breadcrumb schema are automatic)
related:                              chips under "Related pages"
  - /tree-pruning-croydon/
toc: no                               hide the "On this page" chips
cta2: Label|#quote                    second hero button
---
```

## Body

- `## Heading` makes a section and a chip; `## Heading {chip=Short label}` sets the chip text, `{-}` hides the chip.
- `### Heading`, paragraphs, `- item` lists, `+ item` tick lists, `1.` numbered lists, `> quote` answer box, pipe tables (the header row labels the stacked mobile cards).
- Inline: `**bold**`, `*italic*`, `[text](/path/)`. Tokens: `{{phone}}`, `{{phoneHref}}`, `{{insurance}}`, `{{years}}`, `{{brand}}`, `{{areaLinks}}`, `{{postcodes}}`.
- `[VERIFY ...]`, `[OPERATOR DATA ...]` and `£[X - Y]` are shown highlighted and block launch until replaced.

## Blocks

```
:::faq Heading            ### Question  then the answer (FAQ schema is built from this text)
:::cta                    title / text / Label | href
:::cards                  ### Title | /url/  then text -> link label  (services hub)
:::related [noareas]      related chips and the area chips
:::form                   quote form (optional lines: title: intro: bullets: a | b | c  button:)
:::sources                - list items, then a closing note
:::calc                   the live calculator
```
