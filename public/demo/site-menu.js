/**
 * The site menu for the hand-authored demo shells.
 *
 * One source file, referenced by a real <script src> so `npm run dev` serves a
 * working menu, and inlined into each built page by siteMenuScript() in
 * astro.config.mjs. Inlined because the origin serves JavaScript with no
 * Cache-Control at all, so a separately served file would be heuristically
 * cached against HTML that PR #28 would make always fresh: new markup, old
 * script, a renamed id and no menu.
 *
 * No focus trap. This is a short menu, not a modal, and trapping focus in it
 * would be a stronger claim on the reader than it earns.
 */
;(function () {
  var button = document.querySelector('.site-bar-menu-btn')
  var menu = document.getElementById('site-menu')
  if (!button || !menu) return

  var isOpen = function () {
    return menu.hasAttribute('data-open')
  }

  var close = function (returnFocus) {
    if (!isOpen()) return
    menu.removeAttribute('data-open')
    button.setAttribute('aria-expanded', 'false')
    if (returnFocus) button.focus()
  }

  var open = function () {
    menu.setAttribute('data-open', '')
    button.setAttribute('aria-expanded', 'true')
    var first = menu.querySelector('a, button')
    if (first) first.focus()
  }

  button.addEventListener('click', function () {
    if (isOpen()) close(false)
    else open()
  })

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') close(true)
  })

  // pointerdown rather than click: the diagram under the panel handles pointer
  // events of its own, and closing on the way down means a tap that lands on
  // the canvas does not also pan it with a menu still open.
  document.addEventListener('pointerdown', function (event) {
    if (!isOpen()) return
    if (menu.contains(event.target) || button.contains(event.target)) return
    close(false)
  })

  // A rotate can cross the breakpoint with the panel open, which would leave a
  // fixed panel hanging over a layout that already shows the links inline.
  //
  // 1025 is MENU_BREAKPOINT + 1 from scripts/demo-nav.mjs. This file is served
  // to a browser and cannot import it, so a test asserts the two agree rather
  // than a comment asking the next person to check.
  var wide = window.matchMedia('(min-width: 1025px)')
  var onChange = function (event) {
    if (event.matches) close(false)
  }
  if (wide.addEventListener) wide.addEventListener('change', onChange)
  else wide.addListener(onChange)
})()
