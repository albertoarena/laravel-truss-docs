import { test, expect } from '@playwright/test'

import { MENU_PAGES, navLinks, MENU_BREAKPOINT } from '../scripts/demo-nav.mjs'

/**
 * What the shells actually render, at the widths where they have gone wrong.
 *
 * 390 and 430 are phones, 561 to 688 is the band where /demo/ overflowed its
 * own bar and put the theme toggle and the `</>` button past the right edge
 * with `overflow: hidden` over them, 900 is the tablet case, and 1450 is the
 * width the desktop footer clipped at.
 *
 * The breakpoint and the pixel above it are in the list because that pair is
 * where every one of these failures has lived: a number chosen against one item
 * set, and a set that later grew. This spec is what makes growing it noisy.
 */
const WIDTHS = [390, 430, 561, 620, 688, 720, 900, MENU_BREAKPOINT, MENU_BREAKPOINT + 1, 1200, 1450]

/**
 * A phone in landscape, and the narrow one on purpose.
 *
 * 932x430 is a large phone rotated, and it is ABOVE the breakpoint, so it gets
 * the inline nav and never opens a panel at all. The case that binds the panel
 * is a small phone rotated, where the height is least and the menu is still on.
 */
const LANDSCAPE = { width: 667, height: 375 }

const box = (locator) => locator.evaluate((el) => {
  const r = el.getBoundingClientRect()
  return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }
})

for (const shellPath of MENU_PAGES) {
  const shell = { path: shellPath }
  test.describe(shell.path, () => {
    for (const width of WIDTHS) {
      test(`nothing overflows the strips at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 })
        await page.goto(shell.path)

        for (const selector of ['.site-bar', '.app-foot']) {
          const strip = page.locator(selector)
          if (!(await strip.count())) continue

          // scrollWidth catches an item pushed past the right edge; comparing
          // each child's box to the strip's catches one centred and clipped at
          // both ends, which is what the footer did on a phone.
          const overflow = await strip.evaluate((el) => el.scrollWidth - el.clientWidth)
          expect(overflow, `${selector} scrolls`).toBeLessThanOrEqual(1)

          const parent = await box(strip)
          const children = strip.locator(':scope > *')
          for (let i = 0; i < (await children.count()); i += 1) {
            const child = children.nth(i)
            if (!(await child.isVisible())) continue
            const rect = await box(child)
            expect(rect.left, `${selector} child ${i} clipped on the left`).toBeGreaterThanOrEqual(parent.left - 0.5)
            expect(rect.right, `${selector} child ${i} clipped on the right`).toBeLessThanOrEqual(parent.right + 0.5)
          }
        }
      })
    }

    test('offers every route on a phone', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto(shell.path)

      const expected = navLinks(shell.path).map((link) => link.path)
      const menu = page.locator('#site-menu')

      // Collapsed to start with, or the panel would be sitting over the diagram
      // on arrival.
      await expect(menu).toBeHidden()
      await page.locator('.site-bar-menu-btn').click()
      await expect(menu).toBeVisible()

      for (const path of expected) {
        const link = menu.locator(`a[href="${path}"]`)
        await expect(link, `${path} is not reachable`).toBeVisible()
        const rect = await box(link)
        expect(rect.left, `${path} is off the left edge`).toBeGreaterThanOrEqual(0)
        expect(rect.right, `${path} is off the right edge`).toBeLessThanOrEqual(390)
      }

      // GitHub is a bar control, not a nav link, and stays one tap at every
      // width. Decision 2 in the plan, and the reason it needs a test: it used
      // to survive only because .site-bar-nav a.gh outranked the rule hiding
      // .site-bar-nav a.
      await expect(page.locator('.site-bar-actions a.gh')).toBeVisible()
      // The theme builder previews themes and has no toggle of its own, so this
      // is asserted where it exists rather than assumed everywhere.
      const toggle = page.locator('.site-bar-actions .site-bar-theme')
      if (await toggle.count()) await expect(toggle).toBeVisible()
    })

    test('closes on Escape and gives the button its focus back', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto(shell.path)

      const button = page.locator('.site-bar-menu-btn')
      await button.click()
      await expect(page.locator('#site-menu')).toBeVisible()
      await expect(button).toHaveAttribute('aria-expanded', 'true')

      await page.keyboard.press('Escape')
      await expect(page.locator('#site-menu')).toBeHidden()
      await expect(button).toHaveAttribute('aria-expanded', 'false')
      await expect(button).toBeFocused()
    })

    test('closes on a tap outside', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto(shell.path)

      await page.locator('.site-bar-menu-btn').click()
      await expect(page.locator('#site-menu')).toBeVisible()

      await page.locator('.site-bar-logo').click({ trial: true })
      await page.mouse.click(20, 300)
      await expect(page.locator('#site-menu')).toBeHidden()
    })

    test('fits the panel in landscape, where it has least room', async ({ page }) => {
      await page.setViewportSize(LANDSCAPE)
      await page.goto(shell.path)

      await page.locator('.site-bar-menu-btn').click()
      const panel = page.locator('#site-menu')
      await expect(panel).toBeVisible()

      const rect = await box(panel)
      expect(rect.bottom, 'the panel runs off the bottom, and it cannot scroll')
        .toBeLessThanOrEqual(LANDSCAPE.height)
    })

    test('does not leave a panel open across the breakpoint', async ({ page }) => {
      // A rotate crosses the breakpoint with the panel open, which would leave
      // a fixed panel hanging over a layout that already shows links inline.
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto(shell.path)

      await page.locator('.site-bar-menu-btn').click()
      await expect(page.locator('#site-menu')).toBeVisible()

      await page.setViewportSize({ width: MENU_BREAKPOINT + 200, height: 844 })
      await expect(page.locator('.site-bar-menu-btn')).toBeHidden()
      await expect(page.locator('#site-menu')).toBeVisible() // inline, not a panel
      await expect(page.locator('#site-menu')).toHaveJSProperty('dataset.open', undefined)
    })
  })
}
