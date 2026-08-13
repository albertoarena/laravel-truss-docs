/**
 * Consent state for the analytics banner.
 *
 * Deliberately a plain module rather than logic inlined in the component: this
 * is the decision that governs whether Google is contacted at all, so it is
 * unit-tested in tests/consent.test.js.
 *
 * The choice lives in localStorage, not a cookie, so declining leaves nothing
 * on the visitor's device that gets sent to a server. Every storage access is
 * wrapped, because storage can throw outright (Safari private mode, and any
 * browser where the user has blocked site data). A throw there must degrade to
 * "no choice yet", never take the script down and leave the banner unrendered.
 */

export const STORAGE_KEY = 'truss-consent'
export const ACCEPTED = 'accepted'
export const DECLINED = 'declined'

const CHOICES = [ACCEPTED, DECLINED]

/** The stored choice, or null when absent, unreadable or not a known value. */
export function readConsent(storage) {
  try {
    const value = storage?.getItem(STORAGE_KEY)
    return CHOICES.includes(value) ? value : null
  } catch {
    return null
  }
}

/** Show the banner until an explicit choice exists. */
export function shouldShowBanner(stored) {
  return !CHOICES.includes(stored)
}

/** Analytics run on an explicit accept and on nothing else. */
export function analyticsAllowed(stored) {
  return stored === ACCEPTED
}

export function storeConsent(storage, choice) {
  if (!CHOICES.includes(choice)) {
    throw new Error(`Refusing to store "${choice}" as a consent choice`)
  }
  try {
    storage?.setItem(STORAGE_KEY, choice)
  } catch {
    // Nothing to do: the visitor's choice is honoured for this page view, it
    // just cannot be remembered for the next one.
  }
}

/** Withdraw consent, which returns the visitor to the no-choice state. */
export function clearConsent(storage) {
  try {
    storage?.removeItem(STORAGE_KEY)
  } catch {
    // As above.
  }
}
