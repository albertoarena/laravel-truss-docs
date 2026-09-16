import { test, expect } from '@playwright/test'

/**
 * Native controls follow the chosen theme, not the operating system.
 *
 * `color-scheme` is what tells the browser how to paint the parts of a control
 * it draws itself. Declared nowhere it computes `normal`, so a dark page keeps
 * painting light scrollbars, checkboxes and pickers. Declared once as
 * `light dark` it means "use the OS preference", which is right only while the
 * page is on auto.
 *
 * Read against dist and on BOTH layout paths, because that is the trap on this
 * site: measured on a dark machine before the fix, Starlight's pages computed
 * `dark` and were already correct, while the SiteLayout pages computed `normal`
 * while carrying data-theme="dark". A spec that checked one path would have
 * reported the site healthy.
 */

const scheme = (page) =>
  page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)

/** Preset the shared theme key before any page script runs, then load. */
async function open(page, path, stored) {
  await page.addInitScript((value) => {
    try {
      if (value === null) localStorage.removeItem('starlight-theme')
      else localStorage.setItem('starlight-theme', value)
    } catch (e) {}
  }, stored)
  await page.goto(path)
}

const PAGES = [
  ['the landing page', '/'],
  ['the roadmap', '/roadmap/'],
  // Starlight's own layout, as the control: it was already correct, and this is
  // what keeps it that way while tokens.css also declares a scheme.
  ['a docs page', '/getting-started/installation/'],
  // Hand-authored under public/, so it sees neither layout. It takes its
  // declarations from the package's truss.css, which it links for its tokens,
  // and it stamps data-theme itself from its own light/dark mode control. Six
  // native inputs, one of them a colour picker, so it is the page that matters.
  ['the theme builder', '/theme-builder/'],
]

for (const [name, path] of PAGES) {
  test(`${name} paints controls light when light is chosen on a dark machine`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await open(page, path, 'light')

    expect(await scheme(page)).toBe('light')
  })

  test(`${name} paints controls dark when dark is chosen on a light machine`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' })
    await open(page, path, 'dark')

    expect(await scheme(page)).toBe('dark')
  })
}

test('the demo shell leaves both open on auto, so the OS decides', async ({ page }) => {
  // The one page where auto is observable end to end: it stamps no data-theme at
  // all. SiteLayout resolves light or dark before paint and the theme builder
  // always reflects its own mode, so neither can show the base value.
  await page.emulateMedia({ colorScheme: 'dark' })
  await open(page, '/demo/', null)

  expect(await scheme(page)).toBe('light dark')
})
