import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// `color-scheme` is what tells the browser how to paint the parts of a control
// it draws itself: a checkbox, a scrollbar, a focus ring, a colour picker.
// Declared nowhere it defaults to `normal`, which paints them light on a page
// that may be dark. The package shipped that bug until v1.13.0.
//
// Measured on this site before the fix, on a machine set to dark with no stored
// preference: the landing page and the roadmap computed `normal` while carrying
// data-theme="dark", so every native control on them was painted light on a dark
// page. Starlight's own pages computed `dark` and were already right, which is
// the trap the two layout paths always set here: half the site was correct and
// the half nothing else covers was not.
//
// The theme builder is correct for a third reason and is asserted separately.

const read = (p) => readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), 'utf8')

describe('tokens.css declares a colour scheme', () => {
  const css = read('src/styles/tokens.css')

  it('leaves the base :root open, so auto follows the OS', () => {
    // `light dark` rather than a value: with no explicit choice the page follows
    // prefers-color-scheme, and the controls must follow it too.
    expect(css).toMatch(/:root\s*\{[^}]*color-scheme:\s*light\s+dark\s*;/s)
  })

  it('forces light when the light theme is chosen', () => {
    expect(css).toMatch(/:root\[data-theme='light'\]\s*\{[^}]*color-scheme:\s*light\s*;/s)
  })

  it('forces dark when the dark theme is chosen', () => {
    expect(css).toMatch(/:root\[data-theme='dark'\]\s*\{[^}]*color-scheme:\s*dark\s*;/s)
  })

  it('keeps the forced values out of the media query', () => {
    // The overrides have to win in both directions: a page forced to light on a
    // dark machine is exactly the case that broke, so they cannot live inside
    // `@media (prefers-color-scheme: dark)`.
    const dark = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'))
    const firstClose = dark.indexOf('\n}\n')
    expect(dark.slice(0, firstClose)).not.toMatch(/\[data-theme='light'\]/)
  })
})

describe('the theme builder inherits its colour scheme from the package', () => {
  // This page is under public/ and never sees tokens.css. It does not need its
  // own declarations: it links the package's shipped truss.css for its tokens,
  // and that file has carried `color-scheme` on :root and on both data-theme
  // selectors since v1.13.0. Measured: the page computes `light` under the
  // builder's light mode and `dark` under its dark mode.
  //
  // The link is therefore load-bearing for more than colour, so assert it. The
  // rendered result is guarded in e2e/native-controls.spec.mjs.
  const html = read('public/theme-builder/index.html')

  it('links the package stylesheet that carries the declarations', () => {
    expect(html).toMatch(/<link\s+rel="stylesheet"\s+href="\.\.\/demo\/assets\/truss\.css">/)
  })
})
