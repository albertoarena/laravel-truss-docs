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
// reconstructing which pixels came off which edge. The same reasoning as
// scripts/shoot-filament.mjs, for the same reason: art nobody can reproduce goes
// stale quietly.
//
// WHY THE CROP IS TIGHT, WHICH IS THE WHOLE POINT
//
// The source is a composition for the filamentphp.com plugin listing: 16:9, seen
// large, in a grid beside two hundred others. A social card is not that. It is
// 1.91:1 and it is rendered about 520px wide, and the first version of this card
// was the full frame scaled into that, where the tagline went soft, the pills
// became unreadable and a sixteen-table diagram turned into grey texture.
//
// That was not a compression problem and encoding it better fixes nothing: the
// crop measured 0.29/255 against an ideal single downscale, so the pipeline was
// already lossless to the eye. The frame simply carried more than 520px can hold.
// The package's own art/README.md predicted it before this card existed: at list
// size "the wordmark and the shape of the window carry; the tagline, the pills
// and the install line do not, and a real thumbnail would drop them and bring
// the diagram closer."
//
// So this takes 86% of the width from the left edge rather than the whole frame,
// which is the nearest thing to that a crop can do: everything lands about 1.16x
// larger, the tagline and the pills and the install line come back, and the
// diagram is close enough to read column names. The window bleeds off the right,
// keeping its titlebar and its traffic lights, which are the part that evidences
// the claim that this is a real page in a real panel.
//
// The honest fix is a composition laid out at 1.91:1 in art/cover-template.mjs,
// with the pills and the install line dropped and the diagram brought in. That is
// work in the package repository. This crop is what the art on hand can give.
//
// WHY 1200x630 AND NOT THE DOUBLE
//
// public/cover-light.png is 2400x1260, twice its nominal size, and that is right
// for flat art. Here it was working against us. A card is displayed near 520 CSS
// px, so 1200 already covers a 2x screen, and anything larger is downscaled and
// re-encoded by each platform with settings nobody here chooses. At 1200 their
// pass is 1:1 and the only resample is this one, with a filter we picked.
//
// JPEG rather than the PNG the default cover uses, because this frame is a
// photograph of a panel over a gradient and PNG made it 900KB. WhatsApp drops a
// preview image over 300KB and fetches every card before deciding, so the format
// is the difference between the section having a card and having none. Quality 90
// rather than 85 because at this size that is 17KB, and the headroom is spent
// surviving the platforms' own re-encode rather than reaching the viewer.

import { writeFileSync } from 'node:fs'
import sharp from 'sharp'

/** Where the listing art lives when no local path is given. */
const SOURCE =
  'https://raw.githubusercontent.com/albertoarena/filament-truss/main/art/filamentphp/image-light.jpg'

const OUT = 'public/filament-cover-light.jpg'

/** What the meta tags declare, and now also what is written. */
const WIDTH = 1200
const HEIGHT = 630

/**
 * The window onto the source, as fractions of its width, so art re-shot at
 * another size crops to the same picture rather than to the same pixel counts.
 * Anchored left because the wordmark is there and the window is what bleeds.
 * The height follows from the card's ratio and is centred.
 */
const CROP = { left: 0.0125, width: 0.859 }

const source = process.argv[2] ?? SOURCE

async function read(from) {
  if (!/^https?:\/\//.test(from)) return sharp(from)

  const response = await fetch(from)
  if (!response.ok) throw new Error(`${from} returned ${response.status}`)
  return sharp(Buffer.from(await response.arrayBuffer()))
}

const image = await read(source)
const { width, height } = await image.metadata()

const cropWidth = Math.round(width * CROP.width)
const cropHeight = Math.round((cropWidth * HEIGHT) / WIDTH)
if (cropHeight > height) {
  throw new Error(`${source} is ${width}x${height}, too short to crop to ${WIDTH}x${HEIGHT}`)
}

const card = await image
  .extract({
    left: Math.round(width * CROP.left),
    top: Math.round((height - cropHeight) / 2),
    width: cropWidth,
    height: cropHeight,
  })
  .resize(WIDTH, HEIGHT)
  .jpeg({ quality: 90, mozjpeg: true })
  .toBuffer()

writeFileSync(OUT, card)
console.log(
  `${OUT}: ${WIDTH}x${HEIGHT} from a ${cropWidth}x${cropHeight} crop, ` +
    `${(card.length / 1024).toFixed(0)}KB, from ${source}`,
)
