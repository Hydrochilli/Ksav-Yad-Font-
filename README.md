# Ksav Proof: Alphabet Draft 03

A 27-form alphabet draft traced from the owner's STaM sample, not an existing typeface.
The supplied photograph is `/home/hydrochilli/Documents/Sofrus/1000005532.jpg`.

Open `alphabet.html` directly in a browser. No server is required.
The approved four-letter comparison is preserved at `index.html`.

## Variants

- **Faithful trace:** thresholded source contours, small ink fragments removed,
  original relative widths retained, individual baselines aligned.
- **Faithful, refined:** original square proportions and crowns retained, contours
  smoothed at four times source resolution, small individual rotations selected
  within +/-8 degrees by horizontal ink alignment. No anisotropic scaling.
- **Earlier print study (retained in assets):** median-filtered contours, shortened shin crowns, standardised
  body heights, more compact widths and consistent side bearings.
- **Alphabet draft:** all 27 consonant forms, traced and smoothed using the
  faithful/refined treatment. Significant disconnected strokes are retained;
  crop-edge noise is removed. Nested counters receive opposite winding without
  reversing disconnected outer shapes. Final-form descenders are positioned
  below the baseline. Limit-hitting deskew estimates are rejected except for
  the previously approved yod.

These are automated first-pass outlines for visual discussion, not final
hand-refined glyphs. The print study is not a halachic STaM assessment or specimen.
The photo has not been fully perspective-corrected. The alphabet font supports
U+05D0 through U+05EA and space. Earlier four-letter fonts remain limited to
shin, mem, yod, final mem and space. Text without unsupported marks can be set
in the alphabet font, but all forms, metrics and spacing are still drafts.
There are no vowels, cantillation marks, kerning pairs or alternate glyphs.
The source contact sheet runs left-to-right for inspection, while the actual
Hebrew word is rendered right-to-left.

## Rebuild

With Node.js 20 or newer and npm:

```sh
npm install --prefix /tmp/ksav-proof-tools --no-save --package-lock=false sharp potrace opentype.js svgpath fast-xml-parser svg-path-reverse svg-path-properties@1.3.0
NODE_PATH=/tmp/ksav-proof-tools/node_modules node build-proof.cjs /home/hydrochilli/Documents/Sofrus/1000005532.jpg --alphabet
```

Without `--alphabet`, the original four-letter studies are regenerated.
Run that first if starting without the existing four-letter font assets.
The alphabet source coordinates are recorded in `assets/alphabet-sources.json`.
Use `--alphabet-crops` to inspect source selections without rebuilding the font.

The build reopens all generated OpenType font files, checks the four character
mappings (or all 27 in alphabet mode) and nonempty outline bounds, and renders
PNG specimens through SVG. Alphabet mode checks character coverage for all
six word studies. `assets/alphabet-outline-sheet.png` is the rendered atlas.
It also checks that the final mem's counter remains white in the raster output.
The letter coordinates deliberately require this specific original image size.
The tools are installed outside the repository; their own licences still apply.
No third-party font outlines are used. No distribution licence has been assigned
to the draft fonts.