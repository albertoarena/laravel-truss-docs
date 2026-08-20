/**
 * Facts about the package this site documents.
 *
 * Single source of truth. The landing page used to carry the version as its own
 * literal, which meant remembering to bump it in one more place at every
 * release; it now imports from here, and tests/structured-data.test.js checks
 * this constant against .demo-asset-version, the tag the prebuild step actually
 * resolved, so a forgotten bump fails the build rather than shipping a site that
 * advertises a release it no longer serves.
 */

export const PACKAGE_NAME = 'Laravel Truss'

/** Git tag form. Strip the leading v where a bare semver is wanted. */
export const PACKAGE_VERSION = 'v1.9.1'

export const REPO_URL = 'https://github.com/albertoarena/laravel-truss'
export const PACKAGIST_URL = 'https://packagist.org/packages/albertoarena/laravel-truss'
export const LICENSE_URL = `${REPO_URL}/blob/main/LICENSE`

export const AUTHOR_NAME = 'Alberto Arena'

/**
 * Profiles that establish the author identity.
 *
 * Deliberately short. sameAs is an identity assertion, and listing a profile the
 * site does not otherwise corroborate weakens entity resolution instead of
 * helping it, so this holds only what is already linked from the site itself.
 */
export const AUTHOR_PROFILE = 'https://github.com/albertoarena'
