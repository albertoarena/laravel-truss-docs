import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// The two demo pages are hand-authored shells around the package's ACTUAL
// shipped frontend: scripts/copy-demo-assets.mjs fetches resources/ from the
// latest package release, but the markup those assets bind to lives here and is
// maintained by hand. Nothing has ever checked that the two agree.
//
// That drift is not hypothetical. v1.9.0 replaced the Focus <select> with an
// ARIA combobox, and truss.js wires it only when both the input and its listbox
// are present (`if (el.focus && el.focusList)`), so the old markup does not
// throw: the Focus control simply goes dead, on a page whose whole job is to
// show the thing working. These assertions are the tripwire for that class of
// change, on both shells, since the multi-connection variant is easy to forget.
const root = fileURLToPath(new URL('..', import.meta.url))

const SHELLS = [
  'public/demo/index.html',
  'public/demo/multi-connection/index.html',
].map((path) => ({ path, html: readFileSync(new URL(`../${path}`, import.meta.url), 'utf8') }))

describe('demo shells carry the controls the shipped frontend binds to', () => {
  it('reads both hand-authored shells', () => {
    expect(SHELLS.length).toBe(2)
    for (const { path, html } of SHELLS) {
      expect(html.length, path).toBeGreaterThan(0)
    }
  })

  it('gives Focus the combobox input, not the retired select', () => {
    for (const { path, html } of SHELLS) {
      expect(html, `${path} still has the pre-v1.9 <select>`).not.toMatch(
        /<select[^>]*id="truss-focus"/,
      )
      expect(html, path).toMatch(/<input[^>]*id="truss-focus"[^>]*role="combobox"/s)
    }
  })

  it('gives the combobox its listbox and its live region', () => {
    // Both are required: truss.js skips wiring the picker without the listbox,
    // and the status span is what announces the match count as you type.
    for (const { path, html } of SHELLS) {
      expect(html, path).toMatch(/<ul[^>]*id="truss-focus-list"[^>]*role="listbox"/s)
      expect(html, path).toMatch(/id="truss-focus-status"/)
    }
  })

  it('points the combobox at its listbox and starts collapsed', () => {
    for (const { path, html } of SHELLS) {
      expect(html, path).toMatch(/id="truss-focus"[^>]*aria-controls="truss-focus-list"/s)
      expect(html, path).toMatch(/id="truss-focus"[^>]*aria-expanded="false"/s)
    }
  })

  it('labels the combobox with a real label element', () => {
    // The other fields wrap their control in a <label>; a combobox cannot, since
    // the listbox would sit inside the label too, so it needs an explicit for=.
    for (const { path, html } of SHELLS) {
      expect(html, path).toMatch(/<label[^>]*for="truss-focus"/)
    }
  })

  it('gives the zoom slider an accessible name', () => {
    // A title attribute is a tooltip, not a name (WCAG 4.1.2). The package
    // fixed this in v1.9.0; the shells carry their own copy of the control.
    for (const { path, html } of SHELLS) {
      expect(html, path).toMatch(/id="truss-zoom-range"[^>]*aria-label="Zoom"/s)
    }
  })
})
