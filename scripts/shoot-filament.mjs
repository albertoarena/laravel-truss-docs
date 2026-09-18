#!/usr/bin/env node
//
// Screenshots for the Filament panel section, taken against a running demo
// panel. Run by hand, not by the build.
//
//   node scripts/shoot-filament.mjs src/assets/filament
//
// Playwright resolves from this repo's node_modules, and the panel defaults to
// http://127.0.0.1:8000. /demo-login signs itself in, so no credentials live
// here or are needed.
//
// WHY THIS EXISTS RATHER THAN art/shoot.mjs IN THE PACKAGE REPOSITORY
//
// That script strips .fi-sidebar and .fi-topbar and replaces the page heading
// with the package name, because the plugin listing reviewer's note was that
// the image should be the feature and not a panel. The docs need the exact
// opposite: the panel chrome IS the claim /filament/ makes, and a shot with it
// cropped out cannot answer the question the reader arrived with. Folding this
// into that script as a flag would be better than two scripts, and is a change
// for the package repository rather than this one.
//
// The rules that do carry over, and are not optional:
//
//   No row data in any frame. The schema page shows none by construction; a
//   resource list page is nothing but rows, which is why the focus button shot
//   is clipped to the page header.
//
//   Nothing identifying a real application.
//

import { writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const BASE = process.env.ART_BASE ?? 'http://127.0.0.1:8000'
const OUT = process.argv[2] ?? 'src/assets/filament'

/**
 * --accent=<name> takes only the theming pair, cropped to the diagram box, and
 * names the files after the panel's current primary.
 *
 * The page it feeds argues that the diagram takes the panel's palette, and the
 * only way to show that is the same view under two primaries. So this is run
 * twice with the demo app's ->colors() changed in between, and the name is
 * passed in rather than detected: the script cannot know what the panel was
 * configured with, and guessing it from a rendered pixel would be worse than
 * being told.
 *
 * Cropped to #truss-app, with ?focus=books applied. Focus is what puts an
 * accent border and a focus ring on screen, and it shrinks the diagram so the
 * crop stays legible at prose width, where two full panel screenshots would
 * not be.
 */
const ACCENT = process.argv.find((a) => a.startsWith('--accent='))?.split('=')[1] ?? null

async function open(dark) {
  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: dark ? 'dark' : 'light',
  })
  const page = await context.newPage()
  if (dark) await page.addInitScript(() => localStorage.setItem('theme', 'dark'))
  await page.goto(`${BASE}/demo-login`, { waitUntil: 'networkidle' })
  return { browser, page }
}

async function forceDark(page) {
  await page.evaluate(() => {
    document.documentElement.classList.add('dark')
    document.documentElement.setAttribute('data-theme', 'dark')
  })
}

for (const dark of [false, true]) {
  const theme = dark ? 'dark' : 'light'

  if (ACCENT) {
    const { browser, page } = await open(dark)
    await page.goto(`${BASE}/admin/database-schema?focus=books`, { waitUntil: 'networkidle' })
    if (dark) await forceDark(page)
    await page.waitForFunction(() => !!document.querySelector('#truss-canvas svg'), { timeout: 20000 })
    await page.waitForTimeout(2000)
    const box = await page.evaluate(() => {
      const el = document.getElementById('truss-app')
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height }
    })
    await page.screenshot({ path: `${OUT}/accent-${ACCENT}-${theme}.jpg`, type: 'jpeg', quality: 92, clip: box })
    console.log(`accent-${ACCENT}-${theme}.jpg  ${Math.round(box.width)}x${Math.round(box.height)}`)
    await browser.close()
    continue
  }

  // The schema page. Fitted rather than left at the default 70%: at 70% the
  // outer tables are cut by the frame, which reads as a broken screenshot. The
  // panel is the subject here, not the schema, so a complete diagram at 47%
  // beats a cropped one at 70%. (On the demo landings the diagram IS the
  // subject and the opposite call is the right one.)
  {
    const { browser, page } = await open(dark)
    await page.goto(`${BASE}/admin/database-schema`, { waitUntil: 'networkidle' })
    if (dark) await forceDark(page)
    await page.waitForFunction(() => !!document.querySelector('#truss-canvas svg'), { timeout: 20000 })
    await page.waitForTimeout(1500)
    await page.evaluate(() => document.querySelector('#truss-app [data-fit]')?.click())
    await page.waitForTimeout(1500)
    await page.screenshot({ path: `${OUT}/panel-${theme}.jpg`, type: 'jpeg', quality: 92 })
    console.log(`panel-${theme}.jpg`)

    // Record the footer the camera actually saw.
    //
    // The prose on /filament/configuration/ quotes this count, and it was wrong
    // once already: it was copied from the package README, which says 8 of 17,
    // while the demo and both screenshots say 8 of 16. A picture and a sentence
    // one click apart disagreed, and nothing could have failed. Now the figure
    // is written down here and tests/filament-footer.test.js reads it, so the
    // two can only drift with a red build.
    if (!dark) {
      const footer = await page.evaluate(
        () => document.querySelector('#truss-app')?.textContent.match(/\d+ of \d+ tables/)?.[0] ?? null,
      )
      if (!footer) throw new Error('no table count in the footer, so nothing can be asserted about it')
      writeFileSync(`${OUT}/panel.json`, JSON.stringify({ footer }, null, 2) + '\n')
      console.log(`panel.json  footer "${footer}"`)
    }

    await browser.close()
  }

  // The focus button, cropped to the page header.
  //
  // The crop is the point, not framing: a Filament list page is rows of real
  // records, and no row data appears in any shot. The header carries the
  // breadcrumb, the heading and both buttons, which is the whole claim.
  {
    const { browser, page } = await open(dark)
    await page.goto(`${BASE}/admin/books`, { waitUntil: 'networkidle' })
    if (dark) await forceDark(page)
    await page.waitForTimeout(800)
    const box = await page.evaluate(() => {
      const header = document.querySelector('.fi-header')
      const crumb = document.querySelector('.fi-breadcrumbs')
      if (!header) return null
      const h = header.getBoundingClientRect()
      const c = crumb?.getBoundingClientRect()
      const top = Math.min(h.top, c ? c.top : h.top)
      return { x: h.x - 24, y: top - 20, width: h.width + 48, height: h.bottom - top + 28 }
    })
    if (!box) throw new Error('no .fi-header on the books page')
    await page.screenshot({ path: `${OUT}/focus-button-${theme}.jpg`, type: 'jpeg', quality: 92, clip: box })
    console.log(`focus-button-${theme}.jpg  clip ${JSON.stringify(box)}`)
    await browser.close()
  }
}
