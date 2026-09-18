import { test, expect } from '@playwright/test'

/**
 * A screenshot pair shows the variant matching the theme, in all four states.
 *
 * Four, not two: the machine's preference and the reader's explicit choice are
 * independent, and light chosen on a dark machine is the combination a media
 * query alone gets wrong. This site has already shipped that exact bug in
 * colour, which is what e2e/native-controls.spec.mjs exists for.
 *
 * The request assertion is the other half. Both variants are in the DOM, so
 * the obvious implementation downloads two screenshots to show one. They carry
 * loading="lazy", and a display:none image is never near the viewport, so the
 * hidden one is never fetched. That is a real behaviour worth pinning: it would
 * be undone by nothing more visible than adding loading="eager" to improve the
 * hero paint.
 */

const PAGE = '/filament/'

/** Preset the shared theme key before any page script runs, then load. */
async function open(page, { machine, stored }) {
  await page.emulateMedia({ colorScheme: machine })
  await page.addInitScript((value) => {
    try {
      if (value === null) localStorage.removeItem('starlight-theme')
      else localStorage.setItem('starlight-theme', value)
    } catch (e) {}
  }, stored)

  const requested = []
  page.on('request', (r) => {
    const url = r.url()
    if (/\/panel-(light|dark)\.[^/]*\.webp$/.test(url)) requested.push(url)
  })

  await page.goto(PAGE)
  await page.locator('.themed-image img').first().waitFor({ state: 'attached' })
  return requested
}

/**
 * Which screenshot actually renders.
 *
 * Deliberately measured from the box rather than from a computed display value.
 * The first version read getComputedStyle on the img, which reports the img's
 * own display whatever an ancestor does, so when each variant gained a wrapping
 * link to its full-size file every image counted as visible and all four state
 * tests went red. getClientRects is empty for anything in a display:none
 * subtree, so it cannot be fooled by where in the tree the rule is applied.
 */
const shown = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('.themed-image img')]
      .filter((img) => img.getClientRects().length > 0)
      .map((img) => (img.closest('a').className.includes('__dark') ? 'dark' : 'light')),
  )

const CASES = [
  ['light chosen on a dark machine', { machine: 'dark', stored: 'light' }, 'light'],
  ['dark chosen on a light machine', { machine: 'light', stored: 'dark' }, 'dark'],
  ['auto on a dark machine', { machine: 'dark', stored: null }, 'dark'],
  ['auto on a light machine', { machine: 'light', stored: null }, 'light'],
]

for (const [name, state, expected] of CASES) {
  test(`shows the ${expected} screenshot with ${name}`, async ({ page }) => {
    await open(page, state)
    expect(await shown(page)).toEqual([expected])
  })
}

test('downloads one screenshot, not both', async ({ page }) => {
  const requested = await open(page, { machine: 'light', stored: 'dark' })

  // Scroll it into view, since the visible one is lazy too and would otherwise
  // never be fetched either, which would pass this assertion for the wrong
  // reason.
  await page.locator('.themed-image').scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)

  expect(requested.length).toBe(1)
  expect(requested[0]).toContain('panel-dark')
})

test.describe('with JavaScript off', () => {
  test.use({ javaScriptEnabled: false })

  // Starlight writes data-theme="dark" into the static HTML and corrects it from
  // an inline script, so with no JavaScript the attribute stays dark and the
  // whole page renders dark on any machine. The dark screenshot is therefore the
  // right one in both rows below: matching the page is the requirement, and a
  // light screenshot on a dark page would be the defect.
  //
  // This was asserted the other way round first, on the assumption that nothing
  // stamps the attribute without JavaScript. The browser said otherwise.
  for (const machine of ['light', 'dark']) {
    test(`shows one screenshot, matching the page, on a ${machine} machine`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: machine })
      await page.goto(PAGE)

      expect(await shown(page)).toEqual(['dark'])
    })
  }
})
