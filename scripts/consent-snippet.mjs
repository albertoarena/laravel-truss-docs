/**
 * The consent banner, as a self-contained snippet for the hand-authored static
 * pages (the demo, its multi-connection variant, and the theme builder).
 *
 * Those pages live under public/ and are copied verbatim, so they never pass
 * through SiteLayout or the Starlight override and cannot import the shared
 * modules. Before this they carried no banner and no analytics at all, which
 * meant the most engaged page on the site was unmeasured and anyone who
 * accepted elsewhere looked like they had bounced.
 *
 * This duplicates the behaviour of CookieConsent.astro, which is a real drift
 * risk. Two things contain it: the values most likely to diverge are imported
 * from the source modules rather than retyped, and tests/consent-snippet.test.js
 * pins the rest against those same modules. The precedent is the theme builder,
 * which already re-implements the package's theme derivations with a parity
 * test holding the two together.
 *
 * Injected into the BUILT output only, never into the committed source, the
 * same way the demo asset versioning rewrites these pages.
 */

import { STORAGE_KEY, ACCEPTED, DECLINED } from '../src/scripts/consent.js'
import { GA_SCRIPT_ORIGIN } from '../src/scripts/analytics.js'

/** Only ever interpolated into a JS string literal, but belt and braces. */
const escapeId = (id) => String(id).replace(/[^A-Za-z0-9._-]/g, '')

/**
 * Returns the markup, styles and script to append before </body>.
 * An empty measurement ID returns an empty string: no tag, so nothing to ask.
 */
export function consentSnippet(measurementId) {
  const id = escapeId(measurementId ?? '')
  if (!id) return ''

  return `
<style>
  #cookie-consent {
    position: fixed;
    inset: auto 0 0 0;
    z-index: 2147483000;
    background: var(--bp-panel, #0f2338);
    color: var(--bp-fg, #d7e7f4);
    border-top: 1px solid var(--bp-line-strong, #4681b2);
    padding: 1rem 24px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  #cookie-consent[hidden] { display: none; }
  #cookie-consent .consent-inner {
    max-width: 940px; margin: 0 auto; display: flex; flex-wrap: wrap;
    align-items: center; justify-content: space-between; gap: 1rem;
  }
  #cookie-consent .consent-copy { flex: 1 1 22rem; }
  #cookie-consent .consent-title { margin: 0 0 .25rem; font-size: .875rem; font-weight: 600; }
  #cookie-consent p { margin: 0; font-size: .8125rem; line-height: 1.5; }
  #cookie-consent a { color: var(--bp-cyan, #7fe0f2); }
  #cookie-consent .consent-actions { display: flex; gap: .75rem; flex-shrink: 0; }
  /* One class for both controls: refusing must be exactly as easy as agreeing. */
  #cookie-consent .consent-btn {
    font: inherit; font-size: .8125rem; line-height: 1; padding: .7rem 1.1rem;
    border: 1px solid var(--bp-line-strong, #4681b2); border-radius: 8px;
    background: transparent; color: inherit; cursor: pointer;
  }
  #cookie-consent .consent-btn-accept {
    background: var(--bp-ink, #5fd0e6); border-color: var(--bp-ink, #5fd0e6); color: #0b1a2b;
  }
  #cookie-consent .consent-btn:focus-visible { outline: 2px solid var(--bp-cyan, #7fe0f2); outline-offset: 2px; }
  @media (max-width: 560px) {
    #cookie-consent .consent-actions { width: 100%; }
    #cookie-consent .consent-btn { flex: 1; }
  }
</style>
<div id="cookie-consent" role="dialog" aria-labelledby="cookie-consent-title"
     aria-describedby="cookie-consent-description" hidden>
  <div class="consent-inner">
    <div class="consent-copy">
      <p id="cookie-consent-title" class="consent-title">Analytics, only if you agree</p>
      <p id="cookie-consent-description">
        Nothing is loaded until you choose. Accept and Google Analytics helps show which
        pages are actually useful. No advertising, no profiling, no cross-site tracking.
        <a href="/privacy/">Privacy</a>
      </p>
    </div>
    <div class="consent-actions">
      <button type="button" class="consent-btn" data-consent="${DECLINED}">Decline</button>
      <button type="button" class="consent-btn consent-btn-accept" data-consent="${ACCEPTED}">Accept analytics</button>
    </div>
  </div>
</div>
<script>
  (function () {
    var KEY = '${STORAGE_KEY}', ACCEPTED = '${ACCEPTED}', DECLINED = '${DECLINED}', ID = '${id}';
    var banner = document.getElementById('cookie-consent');
    if (!banner) return;

    function read() {
      try {
        var v = localStorage.getItem(KEY);
        return v === ACCEPTED || v === DECLINED ? v : null;
      } catch (e) { return null; }
    }
    function store(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }

    function load() {
      if (document.querySelector('script[src^="${GA_SCRIPT_ORIGIN}"]')) return;
      window.dataLayer = window.dataLayer || [];
      function gtag() { window.dataLayer.push(arguments); }
      gtag('consent', 'default', {
        analytics_storage: 'granted',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied'
      });
      gtag('js', new Date());
      gtag('config', ID);
      var s = document.createElement('script');
      s.async = true;
      s.src = '${GA_SCRIPT_ORIGIN}/gtag/js?id=${id}';
      document.head.appendChild(s);
    }

    var stored = read();
    if (stored === ACCEPTED) load();

    if (stored) {
      banner.parentNode.removeChild(banner);
    } else {
      banner.hidden = false;
    }

    var buttons = banner.querySelectorAll('[data-consent]');
    for (var i = 0; i < buttons.length; i++) {
      (function (button) {
        button.addEventListener('click', function () {
          var choice = button.getAttribute('data-consent') === ACCEPTED ? ACCEPTED : DECLINED;
          store(choice);
          if (choice === ACCEPTED) load();
          banner.parentNode.removeChild(banner);
        });
      })(buttons[i]);
    }
  })();
</script>
`
}
