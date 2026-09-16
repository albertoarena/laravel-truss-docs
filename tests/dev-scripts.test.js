import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// `npm run dev` is not safe to run while reviewing an unreleased package
// frontend. `predev` runs copy-demo-assets, which without PACKAGE_PATH downloads
// the latest release and overwrites whatever local assets are in place. The
// variable has to reach the npm invocation that fires the hook, so exporting it
// in the shell first or passing it to some other script does nothing. That cost
// three rounds of confusion during the v1.13.0 release, twice reading released
// assets while believing they were local.
//
// The fix is a named script, so the safe form is the one you can remember.

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8')
)

describe('dev:local', () => {
  it('exists, so reviewing a local package frontend has a name', () => {
    expect(pkg.scripts['dev:local']).toBeTypeOf('string')
  })

  it('sets PACKAGE_PATH on the npm call that fires the predev hook', () => {
    // Not `astro dev` directly: that would skip predev and leave whatever assets
    // happened to be there, which is a different way to be wrong about what you
    // are looking at.
    expect(pkg.scripts['dev:local']).toMatch(/^PACKAGE_PATH=\S+\s+npm run dev$/)
  })

  it('points at the sibling checkout the docs already tell you to use', () => {
    expect(pkg.scripts['dev:local']).toContain('../laravel-truss')
  })

  it('leaves plain `dev` alone, since the release path is the default', () => {
    expect(pkg.scripts.dev).toBe('astro dev')
    expect(pkg.scripts.predev).toBe('node scripts/copy-demo-assets.mjs')
  })
})
