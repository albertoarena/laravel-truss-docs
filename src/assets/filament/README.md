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
| `accent-amber-*.jpg` | The diagram focused on books, panel primary Amber | 2112x1280 |
| `accent-teal-*.jpg` | The same view, panel primary Teal | 2112x1280 |

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

## Why 1440, and why that is now history

The schema page is shot at a 1440 viewport. It had to be: until Truss v1.13.1
the toolbar's Filter input collapsed to a 24px empty box in a Filament panel,
anywhere from roughly 1280 down to 1100, while the Focus input beside it kept
its full width.

**Fixed in v1.13.1**, and the cause was deeper than it looked from here. The
toolbar's responsive steps were media queries keyed on the window, so a 1280px
window with a panel sidebar taking 470px left the bar about 810px and no step
fired. Every child but the Filter field is floored at its min-content width, so
that field absorbed the whole shortfall. `toolbar-layout.js` now measures the
bar itself, and an embedded 810px bar behaves the way an 810px window always
did.

**The screenshots here were taken before that**, against a demo panel running
v1.13.0, so they are unaffected either way: 1440 was always above the range
where it bit. A re-shoot could now use a narrower viewport and get a larger,
more legible diagram, which is worth doing next time these are re-taken rather
than on its own.

## The theming pair

`--accent=<name>` takes only that pair, cropped to the diagram box with
`?focus=books` applied. Focus is what puts an accent border and a focus ring on
screen, and it shrinks the diagram so the crop stays legible at prose width,
where two full panel screenshots would not be.

It is run twice, with the demo app's `->colors()` changed in between:

```sh
node scripts/shoot-filament.mjs src/assets/filament --accent=amber
# change 'primary' => Color::Teal in the demo app's AdminPanelProvider
node scripts/shoot-filament.mjs src/assets/filament --accent=teal
# change it back
```

**The name is passed in rather than detected.** The script cannot know what the
panel was configured with, and reading it back off a rendered pixel would be
worse than being told.

The demo app was returned to Amber after the teal pair was taken, and its
working tree was checked clean afterwards.
