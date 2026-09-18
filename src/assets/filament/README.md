# Filament panel screenshots

Taken on 18/09/2026 by `scripts/shoot-filament.mjs`, against the demo panel on
`http://127.0.0.1:8000`, a real Filament panel on a seeded bookshop database.
Committed here rather than fetched at build time, unlike the demo's frontend
assets: those have to match the released package, while a screenshot that
changed underneath the prose describing it would be worse than one that is
visibly out of date.

Re-take them with `node scripts/shoot-filament.mjs src/assets/filament` while
that panel is running. A screenshot nobody can reproduce is one that quietly
goes stale, so the shot is a script rather than a description of how it was
once taken.

| File | What it shows | Size |
| --- | --- | --- |
| `panel-light.jpg` | The Database schema page, panel chrome included | 2880x1800 |
| `panel-dark.jpg` | The same, in the panel's dark mode | 2880x1800 |
| `focus-button-light.jpg` | The View in schema button on a resource header | 2208x184 |
| `focus-button-dark.jpg` | The same, dark | 2208x184 |

## Two rules, neither optional

**No row data in any frame.** The schema page shows none by construction. A
resource list page is nothing but rows, which is why the focus button shot is
clipped to the page header rather than framed loosely.

**Nothing identifying a real application.**

## Why these are not the package's art/filamentphp/ shots

That set is for the filamentphp.com plugin listing, and `art/shoot.mjs` removes
`.fi-sidebar` and `.fi-topbar` and replaces the page heading with the package
name, because the listing reviewer asked for the feature rather than a panel.

Here the panel chrome is the evidence for what the page claims, so nothing is
removed and the real heading stays. The two sets answer different questions and
both are correct for the place they appear.

## Known, and visible in nothing here

The schema page is shot at a 1440 viewport because the toolbar's Filter input
collapses below roughly 1400 and is 24px wide, an empty box, from 1280 down to
1100. Shooting at 1440 avoids documenting that, which is a reason to fix it
rather than a reason to keep shooting around it.

## Still wanted

The theming page argues that the diagram follows the panel's own palette and
has no image at all. The shot that would prove it is the same page in two
different panel primaries, which needs `->colors()` changed in the demo app.
