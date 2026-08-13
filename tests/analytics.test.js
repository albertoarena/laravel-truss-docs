import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

import { GA_SCRIPT_ORIGIN, gtagUrl, consentSignals, loadAnalytics } from '../src/scripts/analytics.js'

// The tag loader. Its whole job is to contact Google exactly once, and only
// after an explicit accept, so the pieces are separated out and tested here
// rather than inlined in the component where nothing could reach them.

/** A document stand-in that records what got appended to the head. */
const fakeDoc = () => {
  const appended = []
  const scripts = []
  return {
    appended,
    scripts,
    createElement: () => {
      const el = { tagName: 'SCRIPT', async: false, src: '' }
      scripts.push(el)
      return el
    },
    querySelector: (sel) => {
      const m = sel.match(/src\^="([^"]+)"/)
      const prefix = m ? m[1] : null
      return prefix ? (appended.find((el) => el.src.startsWith(prefix)) ?? null) : null
    },
    head: {
      appendChild: (el) => {
        appended.push(el)
        return el
      },
    },
  }
}

const fakeWin = () => ({})

describe('the gtag URL', () => {
  it('points at Google with the measurement ID', () => {
    expect(gtagUrl('G-ABC123')).toBe(`${GA_SCRIPT_ORIGIN}/gtag/js?id=G-ABC123`)
  })

  it('encodes the ID rather than interpolating it raw', () => {
    expect(gtagUrl('G-A B')).not.toContain(' ')
  })
})

describe('consent signals', () => {
  const signals = consentSignals()

  it('grants analytics storage, because this only ever runs after an accept', () => {
    expect(signals.analytics_storage).toBe('granted')
  })

  it('denies every advertising signal, permanently', () => {
    expect(signals.ad_storage).toBe('denied')
    expect(signals.ad_user_data).toBe('denied')
    expect(signals.ad_personalization).toBe('denied')
  })

  it('carries no wait_for_update', () => {
    // It exists to hold an already-loaded tag while a decision is pending. Here
    // nothing is loaded until the decision is made, so copying it across from
    // the standard snippet would be cargo cult.
    expect(signals).not.toHaveProperty('wait_for_update')
  })
})

describe('loading the tag', () => {
  it('injects one async script pointing at the measurement ID', () => {
    const doc = fakeDoc()
    loadAnalytics({ id: 'G-ABC123', doc, win: fakeWin() })

    expect(doc.appended).toHaveLength(1)
    expect(doc.appended[0].src).toBe(gtagUrl('G-ABC123'))
    expect(doc.appended[0].async).toBe(true)
  })

  it('does nothing without a measurement ID', () => {
    const doc = fakeDoc()
    loadAnalytics({ id: '', doc, win: fakeWin() })
    expect(doc.appended).toHaveLength(0)
  })

  it('is idempotent, so accepting twice cannot double-count', () => {
    const doc = fakeDoc()
    const win = fakeWin()
    loadAnalytics({ id: 'G-ABC123', doc, win })
    loadAnalytics({ id: 'G-ABC123', doc, win })
    expect(doc.appended).toHaveLength(1)
  })

  it('pushes consent before config, so the signals apply to the first hit', () => {
    const win = fakeWin()
    loadAnalytics({ id: 'G-ABC123', doc: fakeDoc(), win })

    const calls = win.dataLayer.map((args) => Array.from(args))
    const consentAt = calls.findIndex((c) => c[0] === 'consent')
    const configAt = calls.findIndex((c) => c[0] === 'config')

    expect(consentAt).toBeGreaterThanOrEqual(0)
    expect(configAt).toBeGreaterThan(consentAt)
    expect(calls[consentAt][1]).toBe('default')
    expect(calls[consentAt][2]).toMatchObject(consentSignals())
    expect(calls[configAt][1]).toBe('G-ABC123')
  })
})

describe('the privacy page documents what the site actually stores', () => {
  // §7 of the plan: claims must match behaviour. A storage key added in code
  // without a matching line in the policy is exactly the drift that makes a
  // privacy page untrue, and it is cheap to catch here.
  const srcDir = fileURLToPath(new URL('../src', import.meta.url))
  const privacy = readFileSync(
    fileURLToPath(new URL('../src/content/docs/privacy.mdx', import.meta.url)),
    'utf8',
  )

  const walk = (dir) =>
    readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry)
      return statSync(full).isDirectory() ? walk(full) : [full]
    })

  const keys = new Set()
  for (const file of walk(srcDir)) {
    if (!/\.(js|ts|astro|mjs)$/.test(file)) continue
    for (const m of readFileSync(file, 'utf8').matchAll(
      /localStorage\.(?:get|set|remove)Item\(\s*['"]([^'"]+)['"]/g,
    )) {
      keys.add(m[1])
    }
    // The consent key is referenced through a constant, so pick it up too.
    for (const m of readFileSync(file, 'utf8').matchAll(/STORAGE_KEY\s*=\s*['"]([^'"]+)['"]/g)) {
      keys.add(m[1])
    }
  }

  it('finds the storage keys the code uses', () => {
    expect(keys.size).toBeGreaterThan(0)
  })

  it.each([...keys])('documents the "%s" key', (key) => {
    expect(privacy).toContain(key)
  })
})
