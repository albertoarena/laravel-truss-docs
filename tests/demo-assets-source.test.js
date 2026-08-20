import { describe, it, expect } from 'vitest'

import { resolveSource, LOCAL_STAMP } from '../scripts/copy-demo-assets.mjs'

// Where the demo's copy of the Truss frontend comes from.
//
// Until now: always a clone of the published repo, pinned to the latest release.
// That is right for a deploy and wrong for review, because a package frontend
// change cannot be seen in the demo until it is pushed AND released. Reviewing
// one meant pushing a branch to point PACKAGE_REF at, or hand-copying files into
// the built output and remembering they would be wiped by the next build.

describe('resolveSource', () => {
  it('takes the latest release when nothing says otherwise', () => {
    expect(resolveSource({})).toEqual({ kind: 'release', ref: null })
  })

  it('takes the ref it is given', () => {
    expect(resolveSource({ PACKAGE_REF: 'main' })).toEqual({ kind: 'release', ref: 'main' })
  })

  it('takes a local checkout when given a path', () => {
    expect(resolveSource({ PACKAGE_PATH: '/w/laravel-truss' })).toEqual({
      kind: 'local',
      path: '/w/laravel-truss',
    })
  })

  it('prefers the local checkout, since asking for both means you are reviewing', () => {
    expect(resolveSource({ PACKAGE_PATH: '/w/laravel-truss', PACKAGE_REF: 'main' })).toEqual({
      kind: 'local',
      path: '/w/laravel-truss',
    })
  })

  it('treats an empty or blank value as unset', () => {
    // An unset variable in a shell script often arrives as an empty string, and
    // silently building against '' would be worse than ignoring it.
    expect(resolveSource({ PACKAGE_PATH: '', PACKAGE_REF: '' })).toEqual({
      kind: 'release',
      ref: null,
    })
    expect(resolveSource({ PACKAGE_PATH: '   ' })).toEqual({ kind: 'release', ref: null })
  })

  it('trims a path that arrived with whitespace around it', () => {
    expect(resolveSource({ PACKAGE_PATH: ' /w/laravel-truss ' })).toEqual({
      kind: 'local',
      path: '/w/laravel-truss',
    })
  })
})

describe('the version stamp for a local build', () => {
  it('is not a version number, so a local build cannot look like a release', () => {
    // The stamp names the built asset folder (assets-v1.9.0) and is the only
    // thing distinguishing one build's frontend from another. A local build
    // wearing a release tag would be indistinguishable from the real thing in
    // the output, which is exactly the confusion this whole change exists to
    // stop.
    expect(LOCAL_STAMP).toBe('local')
    expect(LOCAL_STAMP).not.toMatch(/^v?\d+\.\d+\.\d+$/)
  })
})
