/**
 * Analytics configuration.
 *
 * The measurement ID is the single switch for the whole feature: unset means no
 * banner and no tag, so visitors are never asked to agree to something that is
 * not running.
 *
 * Read from the environment, and NOT because the ID is secret. It is public by
 * definition, visible in the page source of any site that uses it, which is why
 * it is a repository variable rather than a secret. The reason it is not
 * hardcoded is environment separation: a literal here would mean every local
 * build and preview carried the tag and sent hits to the property, polluting
 * the very data this exists to collect. Unset locally means no analytics, ever.
 *
 * The PUBLIC_ prefix is required, since Astro only exposes prefixed variables
 * to client-side code and the tag injection needs the value in the browser.
 *
 * Imported by both layout paths (SiteLayout.astro and the Starlight Footer
 * override) so the value cannot drift between them. The custom pages and the
 * docs pages render through different layouts, so anything site-wide has to be
 * mounted twice.
 */

/** GA4 measurement ID, e.g. 'G-XXXXXXXXXX'. Empty disables analytics entirely. */
export const GA_MEASUREMENT_ID = import.meta.env.PUBLIC_GA_MEASUREMENT_ID ?? ''

/** Whether the analytics feature is switched on at all. */
export const analyticsEnabled = () => GA_MEASUREMENT_ID.trim() !== ''
