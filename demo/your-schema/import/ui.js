/**
 * The paste flow: read, parse, account for it, draw it.
 *
 * The parsing lives in its own modules and is unit tested; this file is the DOM
 * around them and is deliberately thin.
 *
 * Two things here are load-bearing and should not be "tidied" away.
 *
 * The schema never leaves the browser, and that is not a slogan about intent: no
 * request carries schema content, nothing is written to storage on the ordinary
 * path, and the payload reaches the dashboard through an in-memory blob URL. The
 * page says so, so it has to be true.
 *
 * truss.js is imported only once a schema exists. The dashboard reads its
 * endpoint once, at module evaluation (config.endpoint, truss.js:16), so loading
 * it after the blob is in place is what makes the first draw work with no page
 * reload. Loading a second schema does reload, because re-importing the module
 * would double every listener it binds.
 */

import { detectFormat } from './detect.js'
import { parseMysql } from './mysql.js'
import { parseTrussJson } from './truss-json.js'
import { buildSnapshot, reportHeadline } from './snapshot.js'

/** Past this a paste stops being a schema and starts being a database. */
const MAX_BYTES = 2 * 1024 * 1024

/** Only used to hand a schema across the reload that "load another" needs. */
const HANDOFF_KEY = 'truss-demo-pending-schema'

const el = {
  paste: document.getElementById('paste'),
  input: document.getElementById('paste-input'),
  file: document.getElementById('paste-file'),
  format: document.getElementById('paste-format'),
  go: document.getElementById('paste-go'),
  report: document.getElementById('paste-report'),
  app: document.getElementById('truss-app'),
  strip: document.getElementById('paste-strip'),
  summary: document.getElementById('paste-summary'),
  detailsBtn: document.getElementById('paste-details-btn'),
  details: document.getElementById('paste-details'),
  again: document.getElementById('paste-again'),
}

let loaded = false

const text = (value) => document.createTextNode(String(value))

function element(tag, textContent, className) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (textContent !== undefined) node.append(text(textContent))
  return node
}

/* ---- reporting --------------------------------------------------------- */

function showError(message) {
  el.report.replaceChildren(element('div', message, 'paste-error'))
  el.input.focus()
}

/** Irregular plurals this report actually uses. Everything else takes an s. */
const PLURALS = { index: 'indexes' }

const plural = (count, noun) =>
  `${count} ${count === 1 ? noun : (PLURALS[noun] ?? `${noun}s`)}`

/**
 * Everything the parse did that the diagram cannot show for itself. Built as
 * nodes rather than markup, so a table name out of a pasted file is text and
 * can never be anything else.
 */
function renderDetails(report) {
  const nodes = []
  const section = (heading, items) => {
    if (!items.length) return
    nodes.push(element('h2', heading))
    const list = document.createElement('ul')
    for (const item of items) list.append(element('li', item))
    nodes.push(list)
  }

  nodes.push(element('h2', 'Drawn'))
  nodes.push(
    element(
      'p',
      `${plural(report.counts.tables, 'table')}, ${plural(report.counts.columns, 'column')}, ` +
        `${plural(report.counts.indexes, 'index')}, ${plural(report.counts.foreignKeys, 'foreign key')}.`,
    ),
  )

  const ignored = Object.entries(report.ignored).sort(([a], [b]) => a.localeCompare(b))
  section(
    'Read and thrown away',
    ignored.map(([kind, count]) => `${plural(count, `${kind} statement`)}`),
  )
  if (report.ignored.INSERT) {
    nodes.push(element('p', 'No row data was read. Only the table definitions were.'))
  }

  section(
    'Not understood',
    report.unrecognised.map((entry) => `Line ${entry.line}: ${entry.snippet}`),
  )
  section('Adjusted', report.problems.map((problem) => problem.detail))
  section(
    'Renamed to fit the diagram',
    report.renamed.map((rename) => `${rename.from} became ${rename.to}`),
  )

  if (ignored.length === 0 && !report.unrecognised.length && !report.problems.length && !report.renamed.length) {
    nodes.push(element('p', 'Every statement was understood, and nothing had to be adjusted.'))
  }

  el.details.replaceChildren(...nodes)
}

/* ---- drawing ----------------------------------------------------------- */

function draw(snapshot, report) {
  const blob = new Blob([JSON.stringify(snapshot)], { type: 'application/json' })

  el.app.dataset.schemaEndpoint = URL.createObjectURL(blob)

  el.paste.hidden = true
  el.app.hidden = false
  el.strip.hidden = false

  // Anything genuinely odd has to reach this sentence. Leaving it in the Details
  // panel alone is what let a dump with a corrupted column definition draw under
  // the same reassuring line as a clean one.
  const headline = reportHeadline(report)
  el.summary.replaceChildren(
    element('strong', 'Your schema:'),
    text(` ${headline.text} Parsed in this browser, nothing uploaded.`),
  )
  if (headline.attention) {
    el.summary.append(element('span', ` ${headline.attention}.`, 'paste-attention'))
  }
  el.strip.classList.toggle('has-attention', Boolean(headline.attention))
  el.detailsBtn.classList.toggle('attention', Boolean(headline.attention))

  renderDetails(report)

  // Before the module loads, so its first fit measures the viewport the strip
  // has already taken its height out of.
  document.documentElement.setAttribute('data-pasted', '')

  loaded = true

  // Declared on this module's own script tag and resolved against the document,
  // so the build's asset version stamp (applied to the page HTML, never to JS)
  // is carried into the import. document.currentScript is null in a module, so
  // the tag is looked up rather than read from it.
  const source =
    document.querySelector('script[data-truss-module]')?.dataset.trussModule ?? '../assets/truss.js'

  import(new URL(source, document.baseURI).href).catch(() => {
    el.app.hidden = true
    el.strip.hidden = true
    el.paste.hidden = false
    showError('The dashboard failed to load. Reload the page and try again.')
  })
}

/* ---- the flow ---------------------------------------------------------- */

function parse(source, format) {
  const chosen = format === 'auto' ? detectFormat(source) : format

  if (!chosen) {
    throw new Error(
      'That does not look like SQL or a Truss export. Pick a format above if you know what it is.',
    )
  }

  return chosen === 'truss-json' ? parseTrussJson(source) : parseMysql(source)
}

function submit(source) {
  if (!source.trim()) {
    showError('Paste a schema first, or choose a file.')
    return
  }
  if (source.length > MAX_BYTES) {
    showError(
      `That is ${Math.round(source.length / 1024 / 1024)} MB. This page reads up to 2 MB; a --no-data dump of a large schema is usually well under it.`,
    )
    return
  }

  let built
  try {
    built = buildSnapshot(parse(source, el.format.value))
  } catch (error) {
    showError(error.message)
    return
  }

  if (!built.snapshot.tables.length) {
    const inserts = built.report.ignored.INSERT
    showError(
      inserts
        ? 'No table definitions in that, only rows. A dump taken with --no-data carries the structure.'
        : 'No tables found in that. A schema dump starts with CREATE TABLE.',
    )
    return
  }

  // A second schema needs the reload: re-importing truss.js would bind every
  // listener it owns a second time.
  if (loaded) {
    try {
      sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(built))
      // location.pathname, NOT reload(). truss.js seeds its filter and focus
      // from the query string and writes them back there as you use it, so
      // reloading in place carries the last schema's view onto the new one:
      // a filter that matches nothing, or a focus on a table that is gone.
      window.location.replace(window.location.pathname)
      return
    } catch {
      showError('Could not hand the schema over. Reload the page and paste it again.')
      return
    }
  }

  draw(built.snapshot, built.report)
}

el.go.addEventListener('click', () => submit(el.input.value))

el.file.addEventListener('change', async () => {
  const file = el.file.files?.[0]
  if (!file) return

  if (file.size > MAX_BYTES) {
    showError('That file is over 2 MB. This page reads up to 2 MB.')
    return
  }

  el.input.value = await file.text()
  el.report.replaceChildren()
  submit(el.input.value)
})

el.detailsBtn.addEventListener('click', () => {
  const open = el.details.hidden
  el.details.hidden = !open
  el.detailsBtn.setAttribute('aria-expanded', String(open))
})

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !el.details.hidden) {
    el.details.hidden = true
    el.detailsBtn.setAttribute('aria-expanded', 'false')
    el.detailsBtn.focus()
  }
})

el.again.addEventListener('click', () => {
  el.paste.hidden = false
  el.app.hidden = true
  el.strip.hidden = true
  el.details.hidden = true
  el.detailsBtn.setAttribute('aria-expanded', 'false')
  document.documentElement.removeAttribute('data-pasted')
  el.report.replaceChildren()

  // Drop the view state the dashboard wrote into the URL, so going back to the
  // form visibly resets rather than carrying a filter and focus forward.
  window.history.replaceState(null, '', window.location.pathname)

  el.input.focus()
  el.input.select()
})

// A schema handed across the reload by "load another". Read once and deleted
// immediately, so it does not survive a second one.
try {
  const pending = sessionStorage.getItem(HANDOFF_KEY)
  if (pending) {
    sessionStorage.removeItem(HANDOFF_KEY)
    const { snapshot, report } = JSON.parse(pending)
    if (snapshot?.tables?.length) draw(snapshot, report)
  }
} catch {
  sessionStorage.removeItem(HANDOFF_KEY)
}
