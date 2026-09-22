#!/usr/bin/env node
//
// The social card for the /filament/ section, derived from the plugin's own
// listing art. Run by hand, not by the build.
//
//   node scripts/make-filament-cover.mjs
//   node scripts/make-filament-cover.mjs ../filament-truss/art/filamentphp/image-light.jpg
//
// WHY A SCRIPT RATHER THAN A HAND CROP
//
// The output is committed, so nothing here runs on a visitor's behalf. What the
// script buys is that the crop can be repeated: when the plugin's listing art is
// re-shot, one command carries the new frame onto the card instead of somebody
// reconstructing which pixels came off the top. The same reasoning as
// scripts/shoot-filament.mjs, for the same reason: art nobody can reproduce
// goes stale quietly.
//
// WHY THE ART IS CROPPED AT ALL
//
// The source is 16:9 (3200x1800), because a filamentphp.com listing thumbnail
// is. A social card is 1.91:1, and every scraper that does not get that ratio
// invents its own crop: Twitter and LinkedIn take the middle, Discord letterboxes,
// and the wordmark ends up in a different place on each. Cropping here means the
// card is the same picture everywhere. 60px comes off the top and 60 off the
// bottom, which is empty page on both edges; the panel window and the composer
// line are well inside what survives.
//
// The output is 2400x1260, twice the 1200x630 the meta tags declare, matching
// public/cover-light.png. The tags stay at the nominal size deliberately: they
// describe the card, not the file, and a retina-resolution file under a nominal
// size is what every other page on this site already ships.
//
// JPEG rather than the PNG the default cover uses, because this frame is a
// photograph of a panel over a gradient and PNG made it 900KB. WhatsApp drops a
// preview image over 300KB and fetches every card before deciding, so the format
// is the difference between the section having a card there and having none.

import { writeFileSync } from 'node:fs'
import sharp from 'sharp'

/** Where the listing art lives when no local path is given. */
const SOURCE =
  'https://raw.githubusercontent.com/albertoarena/filament-truss/main/art/filamentphp/image-light.jpg'

const OUT = 'public/filament-cover-light.jpg'

/** The nominal card, doubled. Both meta tags on the page declare the half. */
const WIDTH = 2400
const HEIGHT = 1260

const source = process.argv[2] ?? SOURCE

async function read(from) {
  if (!/^https?:\/\//.test(from)) return sharp(from)

  const response = await fetch(from)
  if (!response.ok) throw new Error(`${from} returned ${response.status}`)
  return sharp(Buffer.from(await response.arrayBuffer()))
}

const image = await read(source)
const { width, height } = await image.metadata()

// Take the full width and the middle band of the height. Written as a ratio
// rather than as the 60px it currently works out to, so re-shot art at another
// size still produces a card of the right shape.
const band = Math.round((width * HEIGHT) / WIDTH)
if (band > height) {
  throw new Error(`${source} is ${width}x${height}, too short to crop to ${WIDTH}x${HEIGHT}`)
}

const card = await image
  .extract({ left: 0, top: Math.round((height - band) / 2), width, height: band })
  .resize(WIDTH, HEIGHT)
  .jpeg({ quality: 85, mozjpeg: true })
  .toBuffer()

writeFileSync(OUT, card)
console.log(`${OUT}: ${WIDTH}x${HEIGHT}, ${(card.length / 1024).toFixed(0)}KB, from ${source}`)
