#!/bin/sh
# Renders the toolbar icons in extension/icons/ from the SVGs here. Needs rsvg-convert and
# ImageMagick (macOS: brew install librsvg imagemagick). The *-small.svg files are simplified for 16px, where
# five thin bars blur together.
set -eu
cd "$(dirname "$0")"
out=../extension/icons
for name in icon recording; do
  rsvg-convert -w 16 -h 16 "$name-small.svg" -o "$out/$name-16.png"
  rsvg-convert -w 32 -h 32 "$name.svg" -o "$out/$name-32.png"
done
rsvg-convert -w 48 -h 48 icon.svg -o "$out/icon-48.png"
# Store and extensions-page size: 96px of art centered in 128, as the Chrome Web Store asks.
rsvg-convert -w 96 -h 96 icon.svg | magick - -background none -gravity center -extent 128x128 "PNG32:$out/icon-128.png"
