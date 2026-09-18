import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * The table count in the prose is the one the screenshot shows.
 *
 * /filament/configuration/ explains the footer by quoting it, and /filament/
 * carries a screenshot of that same footer. They disagreed: the prose said
 * "8 of 17 tables", copied from the package README, while the demo panel and
 * both screenshots said "8 of 16". A picture and a sentence one click apart
 * contradicted each other and no test could see it, because one of them is an
 * image.
 *
 * scripts/shoot-filament.mjs now writes down the footer it read from the panel
 * at the moment it took the pictures, and this reads that. So the figure can
 * only change by re-shooting, and re-shooting a different database turns the
 * prose red rather than leaving it quietly wrong.
 */

const read = (p) => readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), 'utf8')

describe('the Filament footer count', () => {
  const recorded = JSON.parse(read('src/assets/filament/panel.json')).footer
  const page = read('src/content/docs/filament/configuration.mdx')

  it('is recorded from the panel the screenshots were taken from', () => {
    expect(recorded).toMatch(/^\d+ of \d+ tables$/)
  })

  it('is the figure the configuration page quotes', () => {
    expect(page).toContain(`\`${recorded}\``)
  })

  it('is the only table count that page states', () => {
    // Catches the half-fix: the quoted footer updated, the sentence leading into
    // it left on the old number.
    const counts = new Set(page.match(/\d+ of \d+ tables/g) ?? [])
    expect([...counts]).toEqual([recorded])

    const [drawn, total] = recorded.match(/(\d+) of (\d+)/).slice(1)
    expect(page).toContain(`a panel on ${total} tables may draw ${drawn} of them`)
  })
})
