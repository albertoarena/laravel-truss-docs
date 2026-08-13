/**
 * Loads Google Analytics, and only ever after an explicit accept.
 *
 * This is deliberately stricter than the usual Consent Mode setup. The common
 * pattern loads gtag.js immediately with consent "denied", which still sends
 * cookieless pings to Google carrying the visitor's IP before anyone has agreed
 * to anything. No cookie is set, but a request to a third-country processor
 * happens. Here nothing Google-related enters the document until the visitor
 * accepts, which is what lets the privacy page say so plainly rather than with
 * a caveat. The behavioural modelling that denied-by-default buys is worth
 * nothing at this traffic volume.
 *
 * Consequences of that choice, both intentional:
 *   - `analytics_storage` is simply `granted`, because there is no denied case
 *     left to express: a visitor who has not accepted never reaches this code.
 *   - There is no `wait_for_update`, which exists to hold an already-loaded tag
 *     while a decision is pending. Nothing is loaded here to hold.
 */

export const GA_SCRIPT_ORIGIN = 'https://www.googletagmanager.com'

/** The loader URL for a measurement ID. */
export function gtagUrl(id) {
  return `${GA_SCRIPT_ORIGIN}/gtag/js?id=${encodeURIComponent(id)}`
}

/**
 * Consent Mode v2 signals applied at initialisation. Advertising stays denied
 * forever: this site has none and should never acquire any, and the privacy
 * page says so.
 */
export function consentSignals() {
  return {
    analytics_storage: 'granted',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  }
}

/**
 * Inject and initialise gtag. Safe to call more than once: a second call is a
 * no-op, so accepting twice (or a stored accept plus a click) cannot load the
 * script or count the page view twice.
 */
export function loadAnalytics({ id, doc = globalThis.document, win = globalThis.window } = {}) {
  if (!id || !doc || !win) return

  const src = gtagUrl(id)
  if (doc.querySelector(`script[src^="${GA_SCRIPT_ORIGIN}"]`)) return

  win.dataLayer = win.dataLayer || []
  const gtag = function () {
    win.dataLayer.push(arguments)
  }

  // Consent first, so the signals are in place before the config call that
  // triggers the first hit.
  gtag('consent', 'default', consentSignals())
  gtag('js', new Date())
  gtag('config', id)

  const script = doc.createElement('script')
  script.async = true
  script.src = src
  doc.head.appendChild(script)
}
