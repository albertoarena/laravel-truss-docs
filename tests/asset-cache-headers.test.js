import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { IMMUTABLE_HTACCESS } from '../scripts/asset-cache-headers.mjs'

// Everything under _astro is fingerprinted by Astro: the filename carries a
// hash of the contents, so the URL changes whenever the bytes do. Such a file
// can be cached forever and never go stale, yet the host was serving it with
// the same 7 day policy as everything else.
//
// A directory-scoped .htaccess rather than a pattern match in the site-wide
// one, because "everything in this directory" is exactly the rule, and matching
// hashed filenames by regex would be guessing at Astro's naming scheme. It is
// written at build time because _astro is generated, so there is no source
// directory to put a file in.
//
// Deliberately NOT applied to /fonts/. Those filenames are stable
// (ibm-plex-mono-400.woff2), so immutable would pin a stale copy if one were
// ever replaced. Fingerprinting is what earns the aggressive policy.

const dist = (p) => fileURLToPath(new URL(`../dist/${p}`, import.meta.url))

describe('the immutable asset policy', () => {
  it('caches for a year and promises never to revalidate', () => {
    expect(IMMUTABLE_HTACCESS).toMatch(/max-age=31536000/)
    expect(IMMUTABLE_HTACCESS).toMatch(/immutable/)
  })

  it('is guarded, so a host without mod_headers still serves the assets', () => {
    expect(IMMUTABLE_HTACCESS).toMatch(/<IfModule mod_headers\.c>/)
  })

  it('explains itself to whoever finds it in a release directory', () => {
    // It lands in generated output with no git history attached, so the file
    // has to carry its own reason.
    expect(IMMUTABLE_HTACCESS).toMatch(/^#/m)
  })
})

describe('the built output', () => {
  let htaccess = ''

  beforeAll(() => {
    const path = dist('_astro/.htaccess')
    if (!existsSync(path)) {
      throw new Error(
        'dist/_astro/.htaccess missing. Fingerprinted assets would fall back to the default cache policy, which is correct but wastes the whole point of hashing them.',
      )
    }
    htaccess = readFileSync(path, 'utf8')
  })

  it('writes the policy into the fingerprinted asset directory', () => {
    expect(htaccess).toBe(IMMUTABLE_HTACCESS)
  })

  it('sits beside assets that are genuinely fingerprinted', () => {
    // If this ever fails, _astro has stopped being hash-named and the
    // immutable policy is no longer safe.
    // Hash lengths vary by producer: Astro emits 8 characters, Expressive Code
    // 5 (ec.8zarh.js). What matters is that a hash segment is there at all.
    const files = readdirSync(dist('_astro')).filter((f) => /\.(css|js)$/.test(f))
    const unhashed = files.filter((f) => !/\.[A-Za-z0-9_-]{4,}\.(css|js)$/.test(f))

    expect(files.length).toBeGreaterThan(0)
    expect(unhashed).toEqual([])
  })
})
