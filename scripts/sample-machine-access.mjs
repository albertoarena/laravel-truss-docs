/**
 * Characterise an intermittent fault by sampling it over hours.
 *
 * check-machine-access.mjs answers "is the site readable right now". That is not
 * enough here: on 2026-08-15 this site failed every check at 14:21 and passed
 * every check at 16:45 with nothing changed in between. A single verdict is
 * worthless against a fault like that; what is needed is a rate and a shape.
 *
 *   # sample every 5 minutes for 6 hours, appending as it goes
 *   npm run sample:machine-access
 *   npm run sample:machine-access -- --interval=5m --duration=6h
 *
 *   # read the summary at any time, including mid-run
 *   npm run sample:machine-access -- --analyse
 *
 * On a Mac, wrap the sampling run in `caffeinate -i` or a sleeping laptop will
 * leave holes in the series:
 *   caffeinate -i npm run sample:machine-access
 *
 * Run it from your own machine, not from the origin server: a request from the
 * origin hairpins back through Cloudflare to itself, which no real crawler does,
 * and cPanel hosts often whitelist the server's own address, so it would report
 * clean regardless.
 *
 * One probe per interval, one line appended per probe. Append-only on purpose:
 * the run can be interrupted, resumed, or read while still going, and analysis
 * is a separate pure step over whatever is in the file.
 */

import { appendFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

import {
  ANSWER_ENGINE_AGENTS,
  checkUrl,
  rotateAgent,
  serialiseSample,
  parseSamples,
  samplesNeededFor,
  summarise,
} from './machine-access.mjs'

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const match = args.find((arg) => arg.startsWith(`--${name}=`))
  return match ? match.split('=')[1] : fallback
}

/** "90s", "5m", "6h" in milliseconds. Plain numbers are read as seconds. */
function duration(text) {
  const match = /^(\d+(?:\.\d+)?)(ms|s|m|h)?$/.exec(String(text).trim())
  if (!match) throw new Error(`Cannot read duration: ${text}`)
  const scale = { ms: 1, s: 1000, m: 60_000, h: 3_600_000 }
  return Number(match[1]) * scale[match[2] ?? 's']
}

const base = (flag('url', process.env.SITE_URL || 'https://trussphp.com')).replace(/\/$/, '')
const out = flag('out', '.docs/machine-access-samples.jsonl')
const target = `${base}${flag('path', '/')}`

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const pct = (value) => `${(value * 100).toFixed(1)}%`

function report() {
  if (!existsSync(out)) {
    console.log(`\nNo samples yet at ${out}\n`)
    return 0
  }

  const samples = parseSamples(readFileSync(out, 'utf8'))
  const stats = summarise(samples)

  console.log(`\nMachine access samples: ${out}`)
  console.log(`${stats.total} samples, ${stats.readable} readable, ${stats.unreadable} not\n`)

  if (stats.total === 0) return 0

  console.log(`  readable rate        ${pct(stats.readableRate)}`)
  console.log(`  longest bad streak   ${stats.longestFailureStreak} consecutive samples`)

  if (stats.unreadable > 0) {
    console.log(`  first failure        ${stats.firstFailureAt}`)
    console.log(`  last failure         ${stats.lastFailureAt}`)
    console.log('\n  failures by reason')
    for (const [reason, count] of Object.entries(stats.reasons)) {
      console.log(`    ${reason.padEnd(20)} ${count}`)
    }
    console.log(
      '\n  A long streak points at reputation windows on the origin WAF.\n' +
        '  Failures scattered singly point at per-connection edge selection.',
    )
  } else {
    // Zero failures is not zero risk, and saying "all good" here is exactly the
    // claim that made this site look healthy while it was unreadable.
    const bound = stats.failureRateUpperBound
    if (bound > 0.2) {
      console.log(
        `\n  No failures observed, but ${stats.total} samples bound nothing useful.\n` +
          `  A clean run only starts to mean something at ${samplesNeededFor(0.05)} samples\n` +
          `  (a 5% ceiling), and ${samplesNeededFor(0.01)} for a 1% one. Keep it running.`,
      )
    } else {
      console.log(
        `\n  No failures observed. By the rule of three, that bounds the true\n` +
          `  failure rate at roughly ${pct(bound)} (95% confidence), no lower.\n` +
          `  More samples tighten it; nothing here can prove zero.`,
      )
    }
  }

  console.log('\n  by Cloudflare colo')
  for (const [name, counts] of Object.entries(stats.byColo)) {
    console.log(`    ${name.padEnd(10)} ${counts.readable}/${counts.total} readable`)
  }
  console.log('')

  return stats.unreadable > 0 ? 1 : 0
}

async function sample() {
  const interval = duration(flag('interval', '5m'))
  const total = duration(flag('duration', '6h'))
  const planned = Math.max(1, Math.floor(total / interval))

  mkdirSync(dirname(out), { recursive: true })

  console.log(`\nSampling ${target}`)
  console.log(`every ${flag('interval', '5m')} for ${flag('duration', '6h')} (${planned} samples) into ${out}`)
  console.log('Interrupt any time; the file is append-only and --analyse reads partial runs.\n')

  for (let index = 0; index < planned; index += 1) {
    const userAgent = rotateAgent(index, ANSWER_ENGINE_AGENTS)
    const result = await checkUrl(target, { userAgent })
    const record = {
      at: new Date().toISOString(),
      userAgent,
      url: target,
      status: result.status,
      readable: result.readable,
      reason: result.reason,
      colo: result.colo,
    }

    appendFileSync(out, serialiseSample(record))
    console.log(
      `${record.at}  ${result.readable ? ' ok ' : 'FAIL'}  ${userAgent.padEnd(18)} ${String(result.status).padEnd(4)} ${result.colo.padEnd(6)} ${result.reason}`,
    )

    if (index < planned - 1) await pause(interval)
  }

  return report()
}

process.exitCode = args.includes('--analyse') ? report() : await sample()
