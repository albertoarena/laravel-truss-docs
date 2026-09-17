# Filament panel screenshots

Copied from the `filament-truss` package repository, `art/filamentphp/`, on
17/09/2026. They are committed here rather than fetched at build time, unlike
the demo's frontend assets: those have to match the released package, while a
screenshot that changed underneath the prose describing it would be worse than
one that is visibly out of date. Re-copying is a deliberate act.

Shot by `art/shoot.mjs` in that repository, against the demo panel, which is a
real Filament panel on a seeded bookshop database. Two rules hold for every shot
and both come from what the package promises rather than from taste: no row data
in frame, and nothing identifying a real application.

| File | Source | Size |
| --- | --- | --- |
| `panel-light.jpg` | `art/filamentphp/image-light.jpg` | 3200x1800 |
| `panel-dark.jpg` | `art/filamentphp/image-dark.jpg` | 3200x1800 |

## These two are provisional

**They are the plugin listing's shots, not this site's.** `shoot.mjs` removes
`.fi-sidebar` and `.fi-topbar` and replaces the page heading with the package
name and a tagline, because the listing reviewer's note was that the image
should be the feature and not a panel.

That is the right call there and the wrong one here. This page argues that the
diagram is a native page inside a panel rather than a frame around the Truss
dashboard, and the evidence for that claim is exactly the chrome those shots
remove. The baked-in title also repeats the page's own heading.

**Replace them with a variant that keeps the chrome and the real page heading**,
which is a conditional around the two blocks in `shoot.mjs` that strip it. Until
then the page is illustrated by an image that does not show what the page says.
