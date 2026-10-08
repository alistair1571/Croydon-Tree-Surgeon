# Price calculator: how the guide prices are worked out

The price engine (`public/price-engine.js`) works out a **guide price range** for two calculators: the compact one in the hero of the homepage, hubs and area pages (`script.js`), and the longer one on `/tree-surgery-cost-calculator/` (`price-calculator.js`). This page records where each figure comes from, so the operator can check it and replace it with their own job prices.

**Status: accepted for launch by the site owner (8 October 2026), not yet confirmed by the operator.** These are London-scaled guide prices, built from a London operator's 2026 price guide and Bark's UK guide scaled by its own London uplift, so they are higher than national averages. `operatorConfirmed` in `price-engine.js` is `false`, and `npm run verify` reports it as a launch blocker. Do not launch with these figures unless they match what the operator would really quote.

## Sources (read October 2026)

| Source | What it gives | Used for |
|---|---|---|
| [Bark, tree surgeon price guide (UK, 2025)](https://www.bark.com/en/gb/tree-surgeon/tree-surgeon-prices/) | UK prices by tree height, stump diameter and pruning extent. A London uplift. Extra for hazardous or diseased trees (£50 to £200). Extra for chipping or debris (£50 to £100) | Structure of the model and the adjustments |
| [GraftinGardeners, tree surgeon cost London (June 2026)](https://www.graftingardeners.co.uk/tree-surgeon-cost-london/) | London operator prices: small tree £250 to £550, medium from £600, large £1,200 to £3,500+; pruning small from £200, medium from £480, large £900 to £1,200+; stump grinding £150 to £400+; hedge trimming £150 to £1,000+ | Checks the London level of the ranges |
| [MyJobQuote, hedge removal costs](https://www.myjobquote.co.uk/costs/removing-hedges) | Hedge cutting £5 to £10 per m2 (small hedge), £10 to £15 (medium), £15 to £25 (large). Hedge removal £150 to £400 | Hedge trimming and removal |
| [Fantastic Services, hedge trimming cost](https://www.fantasticservices.com/cost-guides/gardening/hedge-trimming-cost/) | London standard hedge job £90 to £220 | Sanity check on the hedge floor |
| [Checkatrade, garden maintenance costs (June 2026)](https://www.checkatrade.com/blog/cost-guides/garden-maintenance-cost/) | Hedge removal £100 to £250 (small), £250 to £400 (large) | Sanity check on hedge removal |

Bark's own guide is not perfectly consistent (for example it gives London average removal as £650 in one table and pruning as £400 in another, and its price bands use different heights from its request form). So it is used for its structure and for the London uplift, and the figures are checked against the London operator guide.

## The London uplift

Bark reports average removal of £650 in London against £400 in the North, and pruning of £400 against £250. That is about **1.6 times**. Applying 1.6 to Bark's UK bands lands close to the London operator's ranges, which is why the two sources can be reconciled:

| Tree (Bark's UK removal band) | Bark UK range | x 1.6 for London | London operator guide |
|---|---|---|---|
| Up to 25ft | £70 to £300 | £112 to £480 | Small (up to ~15ft) £250 to £550 |
| 26 to 50ft | £300 to £700 | £480 to £1,120 | Medium (~15 to 30ft) from £600 |
| Over 50ft | £750 to £1,000+ | £1,200 to £1,600+ | Large (30ft+) £1,200 to £3,500+ |

## The ranges in the calculator

Heights are the four bands on Bark's form. Each range is per tree and includes taking the waste away.

| Height | Removal | Pruning (standard) | Stump (if also removing) |
|---|---|---|---|
| Small (under 3m) | £250 to £450 | £200 to £400 | £120 to £220 |
| Medium (3 to 6m) | £300 to £600 | £250 to £500 | £160 to £350 |
| Medium large (6 to 9m) | £550 to £1,100 | £450 to £850 | £220 to £450 |
| Large (over 9m) | £1,000 to £3,000 | £800 to £1,500 | £300 to £700 |

Stump grinding on its own, by width: under 20cm £120 to £220; 20 to 50cm £160 to £350; over 50cm £300 to £700 (Bark's three stump sizes, scaled for London and checked against the £150 to £400+ London guide).

Hedge trimming: hedge length x height x the per-m2 rate (£5 to £10, £10 to £15, £15 to £25 by height band), with a floor of £120 to £220. Hedge removal: £150 to £450.

Minimum prices (floors): removal £250 to £450, pruning £200 to £400, stump £120 to £220, hedge £120 to £220.

## Adjustments, and how firmly each is supported

| Adjustment | Amount | Support |
|---|---|---|
| Several trees | Price x number of trees. No discount | Conservative: several trees in one visit are usually cheaper per tree |
| Dead or diseased trees | + £50 to £200 per job | **Published** (Bark) |
| Health not known | Top of range + £100 | **Assumption** |
| Pruning extent | Light: lower half of the range. Standard: the full range. Heavy: upper 60% | Follows Bark's light (£100 to £200) and heavy (£300 to £800) pruning bands |
| Customer takes care of the waste | Range lowered by £50 to £100 | **Assumption** based on Bark's £50 to £100 for debris and chipping |
| Near buildings, or tight access (terrace, through the house, long carry) | Low x 1.10, high x 1.30 | **Assumption.** The sources say it costs more, but give no figure |
| A side gate or narrow passage, no vehicle access | Low x 1.0, high x 1.10 | **Assumption** |
| Near power or telephone lines | Low x 1.10, high x 1.35, and a site visit is needed | **Assumption** |
| Near fences, other trees, other | Low x 1.0, high x 1.10 | **Assumption** |
| Several obstructions together | The low uses the biggest factor, the highs add up, capped at x 1.6 | **Assumption** |
| Council paperwork for a TPO or conservation area | £0 for now (`protectionFee`) | Set by the operator. The council charges no fee, but the operator may charge for preparing it |
| Property type, owner, start date | No price effect | Used for notes and for the lead |

## The shared calculator's fields

What you need (removal, pruning, stump grinding, hedge trimming, hedge removal, or an emergency, which shows a phone number instead of a price); tree height, stump width, or hedge length and height; how many; a description of the access; and whether it is protected. A tick-box adds stump grinding to a tree removal. The access description is the same price factor as "near buildings" above, and it applies to stumps and hedges as well as trees. Everything it does not ask is assumed: the waste is taken away, the tree is healthy, and pruning is a standard reduction. The calculator page asks for those as well.

## The calculator page's fields (from Bark's tree surgery request form)

Property type, owner, stump removal, height, more than one tree, health, proximity (multi-select), protections (conservation area or TPO), location, start date and waste disposal, with Bark's options. Additions needed to price a job: the type of job (removal, pruning, stump only, hedge, emergency), how many trees when there is more than one, how much pruning, the stump width and hedge length and height. Emergency jobs show no price and ask the visitor to call.

## Where the prices appear on the site

**One source.** The numbers live in `MODEL` in `public/price-engine.js`. Page copy does not hold prices: it holds tokens such as `{{p.removal.small}}` or `{{p.stump.all}}`, which `scripts/prices.mjs` turns into text when the site is built. Change a price in `MODEL`, run `npm run build`, and every table, FAQ, title and description follows. The same applies to the worked examples on the calculator page, which are run through the calculator itself.

| Where | What it shows |
|---|---|
| Calculator page | The calculator, the cost table, three worked examples and the cost FAQs |
| Tree removal, pruning, stump grinding, hedge cutting, trees near buildings | The cost section or table, the FAQ answer, and "from" prices in titles and descriptions |
| Emergency and tree surveys | The cost tables (call-out and "from" prices; larger jobs are quoted) |
| Cost guide and ash dieback guide | The price table, FAQs and the ash ranges |
| All 11 area pages | The typical range in the cost section and FAQ |
| Homepage | Three FAQ answers. **The homepage is hand-edited HTML, so these are fixed text.** `npm run test:pricing` fails if they drift from the model |

Prices that are not part of the calculator are in `MODEL.other` (all from the London operator guide, as "from" prices): emergency call-out from £250, pollarding from £380, single-tree health and safety inspection from £260, BS 5837 planning survey from £460. Several-tree surveys, inspection programmes and overgrown-hedge restoration are shown as "quoted per site", because there is no published figure to base a range on.

## How to check and update

1. **Compare with real jobs.** Take 10 to 20 of the operator's recent Croydon quotes, run each through the calculator, and compare. The ranges should contain the real price most of the time. Adjust the numbers in `MODEL` in `public/price-engine.js`.
2. **Set the real minimum charge** in `MODEL.floors`, and any council-paperwork charge in `MODEL.protectionFee`.
3. **Replace the assumptions** (proximity, health unknown, waste) with the operator's real adjustments.
4. Run `npm run test:pricing`. It checks each range against the source envelopes in `scripts/test-pricing.mjs` and checks that every adjustment moves the price the right way. If you change a figure on purpose, update the envelope with the new source.
5. Set `operatorConfirmed: true`, and update the "how this is worked out" note in the result (it currently says the prices are based on published guides).
6. Edit the three homepage FAQ prices by hand if the model changes (the test tells you which).
