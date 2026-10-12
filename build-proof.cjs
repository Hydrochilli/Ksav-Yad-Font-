const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");
const { Potrace } = require("potrace");
const opentype = require("opentype.js");
const svgpath = require("svgpath");
const { XMLParser } = require("fast-xml-parser");
const { reverse: reversePath } = require("svg-path-reverse");
const { svgPathProperties } = require("svg-path-properties");

const letters = [
  { name: "shin", unicode: 0x05e9, left: 298, top: 2388, width: 109, height: 104 },
  { name: "mem", unicode: 0x05de, left: 229, top: 2400, width: 79, height: 100 },
  { name: "yod", unicode: 0x05d9, left: 191, top: 2413, width: 40, height: 80 },
  { name: "final-mem", unicode: 0x05dd, left: 121, top: 2423, width: 72, height: 80 },
];
const alphabetLetters = [
  { name: "aleph", unicode: 0x05d0, left: 872, top: 30, width: 92, height: 119 },
  { name: "bet", unicode: 0x05d1, left: 2435, top: 530, width: 78, height: 100 },
  { name: "gimel", unicode: 0x05d2, left: 1479, top: 1105, width: 41, height: 109 },
  { name: "dalet", unicode: 0x05d3, left: 2406, top: 276, width: 73, height: 103 },
  { name: "he", unicode: 0x05d4, left: 1008, top: 55, width: 60, height: 99 },
  { name: "vav", unicode: 0x05d5, left: 603, top: 49, width: 38, height: 105 },
  { name: "zayin", unicode: 0x05d6, left: 1434, top: 638, width: 44, height: 110 },
  { name: "het", unicode: 0x05d7, left: 798, top: 28, width: 67, height: 125 },
  { name: "tet", unicode: 0x05d8, left: 263, top: 506, width: 67, height: 119 },
  letters.find((letter) => letter.name === "yod"),
  { name: "final-kaf", unicode: 0x05da, left: 403, top: 295, width: 63, height: 132, baseline: -330, exclude: [{ left: 0, top: 110, width: 47, height: 22 }] },
  { name: "kaf", unicode: 0x05db, left: 795, top: 411, width: 66, height: 85 },
  { name: "lamed", unicode: 0x05dc, left: 1898, top: 5, width: 74, height: 145 },
  letters.find((letter) => letter.name === "final-mem"),
  letters.find((letter) => letter.name === "mem"),
  { name: "final-nun", unicode: 0x05df, left: 1092, top: 420, width: 63, height: 136, baseline: -380, exclude: [{ left: 0, top: 110, width: 45, height: 26 }] },
  { name: "nun", unicode: 0x05e0, left: 1290, top: 35, width: 47, height: 126 },
  { name: "samekh", unicode: 0x05e1, left: 1740, top: 1120, width: 68, height: 82 },
  { name: "ayin", unicode: 0x05e2, left: 740, top: 273, width: 75, height: 114, sizeScale: 0.77 },
  { name: "final-pe", unicode: 0x05e3, left: 1234, top: 1460, width: 74, height: 137, baseline: -330, exclude: [{ left: 0, top: 108, width: 55, height: 29 }] },
  { name: "pe", unicode: 0x05e4, left: 201, top: 510, width: 67, height: 122, sizeScale: 0.845 },
  { name: "final-tsadi", unicode: 0x05e5, left: 1234, top: 1687, width: 77, height: 143, baseline: -320, exclude: [{ left: 0, top: 96, width: 23, height: 47 }] },
  { name: "tsadi", unicode: 0x05e6, left: 1196, top: 272, width: 76, height: 117, sizeScale: 0.9 },
  { name: "qof", unicode: 0x05e7, left: 1947, top: 520, width: 70, height: 139, baseline: -310 },
  { name: "resh", unicode: 0x05e8, left: 2033, top: 60, width: 66, height: 92 },
  letters.find((letter) => letter.name === "shin"),
  { name: "tav", unicode: 0x05ea, left: 1350, top: 530, width: 79, height: 96 },
];
const assetPath = (...parts) => path.join(__dirname, "assets", ...parts);

function keepMainShape(pixels, width, height, preserveParts = false) {
  const visited = new Uint8Array(pixels.length);
  let largest = [];
  const components = [];
  for (let start = 0; start < pixels.length; start++) {
    if (pixels[start] !== 0 || visited[start]) continue;
    const component = [start];
    visited[start] = 1;
    for (let cursor = 0; cursor < component.length; cursor++) {
      const current = component[cursor];
      const column = current % width;
      const row = Math.floor(current / width);
      for (let deltaRow = -1; deltaRow <= 1; deltaRow++) {
        for (let deltaColumn = -1; deltaColumn <= 1; deltaColumn++) {
          const nextColumn = column + deltaColumn;
          const nextRow = row + deltaRow;
          if (nextColumn < 0 || nextColumn >= width || nextRow < 0 || nextRow >= height) continue;
          const next = nextRow * width + nextColumn;
          if (pixels[next] === 0 && !visited[next]) {
            visited[next] = 1;
            component.push(next);
          }
        }
      }
    }
    components.push(component);
    if (component.length > largest.length) largest = component;
  }
  if (largest.length < 100) throw new Error("Letter crop has insufficient ink.");
  const cleaned = Buffer.alloc(pixels.length, 255);
  const retained = preserveParts
    ? components.filter((component) => component === largest || (
      component.length >= Math.max(12, largest.length * 0.025)
      && !component.some((index) => index % width === 0 || index % width === width - 1 || index < width || index >= width * (height - 1))
    ))
    : [largest];
  for (const component of retained) {
    for (const index of component) cleaned[index] = 0;
  }
  return cleaned;
}

function containsPoint(polygon, point) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    if ((currentPoint.y > point.y) !== (previousPoint.y > point.y)
      && point.x < (previousPoint.x - currentPoint.x) * (point.y - currentPoint.y) / (previousPoint.y - currentPoint.y) + currentPoint.x) inside = !inside;
  }
  return inside;
}

function correctCounterWinding(outline) {
  const contours = [];
  svgpath(outline).abs().unshort().unarc().iterate((segment) => {
    if (segment[0] === "M") contours.push([]);
    contours[contours.length - 1].push(segment);
  });
  const polygons = contours.map((segments) => {
    const geometry = new svgPathProperties(segments.map((segment) => segment.join(" ")).join(" "));
    const length = geometry.getTotalLength();
    const steps = Math.max(24, Math.ceil(length / 2));
    return Array.from({ length: steps }, (_, index) => geometry.getPointAtLength(index * length / steps));
  });
  for (const [index, polygon] of polygons.entries()) {
    const depth = polygons.filter((other, otherIndex) => otherIndex !== index && containsPoint(other, polygon[0])).length;
    if (depth % 2 === 1) outline = reversePath(outline, index);
  }
  return outline;
}

async function smoothAndStraighten(cleaned, width, height, name, alphabet = false) {
  const enlarged = await sharp(cleaned, { raw: { width, height, channels: 1 } })
    .resize(width * 4, height * 4, { kernel: "lanczos3" })
    .blur(4)
    .png()
    .toBuffer();
  let bestScore = -Infinity;
  let bestAngle = 0;
  let bestImage;
  let originalScore;
  let originalImage;
  for (let angle = -8; angle <= 8; angle += 0.5) {
    const candidate = await sharp(enlarged)
      .rotate(angle, { background: "white" })
      .grayscale()
      .threshold(128)
      .raw()
      .toBuffer({ resolveWithObject: true });
    let score = 0;
    let ink = 0;
    for (let row = 0; row < candidate.info.height; row++) {
      let rowInk = 0;
      for (let column = 0; column < candidate.info.width; column++) {
        if (candidate.data[(row * candidate.info.width + column) * candidate.info.channels] === 0) rowInk++;
      }
      score += rowInk * rowInk;
      ink += rowInk;
    }
    score /= ink;
    if (angle === 0) {
      originalScore = score;
      originalImage = candidate;
    }
    if (score > bestScore) {
      bestScore = score;
      bestAngle = angle;
      bestImage = candidate;
    }
  }
  if (bestScore < originalScore * 1.005 || (alphabet && name !== "yod" && Math.abs(bestAngle) === 8)) {
    bestAngle = 0;
    bestImage = originalImage;
  }
  console.log(`${name}: refined rotation ${bestAngle.toFixed(1)} degrees.`);
  return sharp(bestImage.data, { raw: bestImage.info })
    .trim({ background: "white", threshold: 1 })
    .png()
    .toBuffer({ resolveWithObject: true });
}

async function traceLetter(source, letter, regularised, refined = false, alphabet = false) {
  const { left, top, width, height } = letter;
  let image = sharp(source).extract({ left, top, width, height }).grayscale();
  if (regularised) image = image.median(3);
  const pixels = await image.threshold(letter.threshold ?? 105).raw().toBuffer();
  if (alphabet) {
    for (const rectangle of letter.exclude ?? []) {
      for (let row = rectangle.top; row < rectangle.top + rectangle.height; row++) {
        pixels.fill(255, row * width + rectangle.left, row * width + rectangle.left + rectangle.width);
      }
    }
  }
  if (regularised && letter.name === "shin") {
    pixels.fill(255, 0, width * 24);
  }
  const cleaned = keepMainShape(pixels, width, height, alphabet && !letter.name.startsWith("final-"));
  const { data, info } = refined
    ? await smoothAndStraighten(cleaned, width, height, letter.name, alphabet)
    : await sharp(cleaned, { raw: { width, height, channels: 1 } })
      .trim({ background: "white", threshold: 1 })
      .png()
      .toBuffer({ resolveWithObject: true });
  const mode = alphabet ? "alphabet" : refined ? "refined" : regularised ? "print" : "faithful";
  await fs.writeFile(assetPath(`${letter.name}-${mode}.png`), data);
  const tracer = new Potrace({ threshold: 128, turdSize: 0, alphaMax: regularised ? 1.1 : refined ? 1.3 : 0.7, optTolerance: refined ? 6 : regularised ? 0.45 : 0.15 });
  await new Promise((resolve, reject) => tracer.loadImage(data, (error) => error ? reject(error) : resolve()));
  const parsed = new XMLParser({ ignoreAttributes: false }).parse(tracer.getSVG());
  let outline = parsed.svg.path["@_d"];
  if (!outline) throw new Error(`Missing outline for ${letter.name}.`);
  if (alphabet) {
    outline = correctCounterWinding(outline);
  } else {
    let contourCount = 0;
    svgpath(outline).abs().iterate((segment) => {
      if (segment[0] === "M") contourCount++;
    });
    for (let contour = 1; contour < contourCount; contour++) {
      outline = reversePath(outline, contour);
    }
  }
  const targetWidths = { shin: 780, mem: 620, yod: 220, "final-mem": 620 };
  const targetHeight = letter.name === "yod" ? 300 : 680;
  const sizeScale = alphabet ? (letter.sizeScale ?? 1) : 1;
  const scaleX = (regularised ? targetWidths[letter.name] / info.width : refined ? 2 : 8) * sizeScale;
  const scaleY = (regularised ? targetHeight / info.height : refined ? 2 : 8) * sizeScale;
  const baseline = letter.name === "yod" ? (regularised ? 380 : 600 - info.height * scaleY) : alphabet ? (letter.baseline ?? 0) : 0;
  const bearing = regularised ? 55 : 45;
  const fontPath = new opentype.Path();
  svgpath(outline).abs().unshort().unarc().iterate((segment) => {
    const transformPoint = (offset) => [bearing + segment[offset] * scaleX, baseline + (info.height - segment[offset + 1]) * scaleY];
    if (segment[0] === "M") fontPath.moveTo(...transformPoint(1));
    else if (segment[0] === "L") fontPath.lineTo(...transformPoint(1));
    else if (segment[0] === "C") fontPath.curveTo(...transformPoint(1), ...transformPoint(3), ...transformPoint(5));
    else if (segment[0] === "Q") fontPath.quadTo(...transformPoint(1), ...transformPoint(3));
    else if (segment[0] === "Z") fontPath.close();
    else throw new Error(`Unsupported outline command: ${segment[0]}`);
  });
  return new opentype.Glyph({ name: letter.name, unicode: letter.unicode, advanceWidth: Math.ceil(info.width * scaleX + bearing * 2), path: fontPath });
}

async function buildFont(source, regularised, refined = false, selectedLetters = letters) {
  const alphabet = selectedLetters === alphabetLetters;
  const missingPath = new opentype.Path();
  missingPath.moveTo(80, 0);
  missingPath.lineTo(80, 680);
  missingPath.lineTo(500, 680);
  missingPath.lineTo(500, 0);
  missingPath.close();
  const glyphs = [
    new opentype.Glyph({ name: ".notdef", advanceWidth: 580, path: missingPath }),
    new opentype.Glyph({ name: "space", unicode: 32, advanceWidth: 300, path: new opentype.Path() }),
  ];
  for (const letter of selectedLetters) glyphs.push(await traceLetter(source, letter, regularised, refined, alphabet));
  const mode = alphabet ? "alphabet" : refined ? "refined" : regularised ? "print" : "faithful";
  const font = new opentype.Font({
    familyName: alphabet ? "Ksav Alphabet Draft" : refined ? "Ksav Faithful Refined Study" : regularised ? "Ksav Print Study" : "Ksav Faithful Study",
    styleName: "Regular", unitsPerEm: 1000, ascender: alphabet ? 1250 : 950, descender: alphabet ? -500 : -200, glyphs,
  });
  for (const names of Object.values(font.names)) {
    names.description = { en: alphabet ? "27-form Hebrew alphabet draft from the owner's handwriting. Pending visual refinement; no vowel or cantillation support." : "Four-letter draft traced from the owner's handwriting. Not a complete Hebrew font." };
  }
  const buffer = Buffer.from(font.toArrayBuffer());
  if (buffer.toString("ascii", 0, 4) !== "OTTO") throw new Error("Expected OpenType CFF output.");
  await fs.writeFile(assetPath(`ksav-${mode}-draft.otf`), buffer);
  await fs.rm(assetPath(`ksav-${mode}-draft.ttf`), { force: true });
  const reread = opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  for (const letter of selectedLetters) {
    const glyph = reread.charToGlyph(String.fromCodePoint(letter.unicode));
    const bounds = glyph.getBoundingBox();
    if (glyph.name === ".notdef" || glyph.path.commands.length < 10 || bounds.x2 <= bounds.x1 || bounds.y2 <= bounds.y1) {
      throw new Error(`Invalid font glyph: ${letter.name}`);
    }
  }
  if (alphabet) {
    const shinBounds = reread.charToGlyph("ש").getBoundingBox();
    const shinHeight = shinBounds.y2 - shinBounds.y1;
    for (const character of "עפ") {
      const bounds = reread.charToGlyph(character).getBoundingBox();
      const heightRatio = (bounds.y2 - bounds.y1) / shinHeight;
      if (heightRatio < 0.97 || heightRatio > 1.03) throw new Error(`${character} should be approximately shin's height.`);
    }
    for (const sentence of ["ספרים על המדף", "מכתב קטן ליד החלון", "גשם ורוח בחוץ", "טקסט ברור ונעים", "צליל זך", "אותיות מרובעות"]) {
      for (const character of sentence) {
        if (reread.charToGlyphIndex(character) === 0) throw new Error(`Missing specimen character: ${character}`);
      }
    }
    const rows = [];
    for (const [index, letter] of selectedLetters.entries()) {
      const glyph = reread.charToGlyph(String.fromCodePoint(letter.unicode));
      const column = index % 7;
      const row = Math.floor(index / 7);
      const glyphPath = glyph.getPath(column * 160 + 30, row * 220 + 150, 100, { hinting: false }, reread).toSVG({ flipY: false });
      rows.push(`<text x="${column * 160 + 10}" y="${row * 220 + 20}" font-size="13" fill="#666">${letter.name}</text>${glyphPath}`);
    }
    const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="880"><rect width="1120" height="880" fill="white"/>${rows.join("")}</svg>`;
    await sharp(Buffer.from(sheet)).png().toFile(assetPath("alphabet-outline-sheet.png"));
  }
  const specimenPath = new opentype.Path();
  let cursor = 24;
  for (const character of "םימש") {
    const glyph = font.charToGlyph(character);
    specimenPath.extend(glyph.getPath(cursor, 154, 160, { hinting: false }, font));
    cursor += glyph.advanceWidth * 0.16;
  }
  const specimen = specimenPath.toSVG({ flipY: false });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="620" height="200" viewBox="0 0 620 200"><rect width="620" height="200" fill="white"/>${specimen}</svg>`;
  await fs.writeFile(assetPath(`word-${mode}.svg`), svg);
  await sharp(Buffer.from(svg)).png().toFile(assetPath(`word-${mode}.png`));
  const { data: raster, info: rasterInfo } = await sharp(assetPath(`word-${mode}.png`)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const counterBounds = reread.charToGlyph("ם").getBoundingBox();
  const counterColumn = Math.round(24 + (counterBounds.x1 + counterBounds.x2) * 0.08);
  const counterRow = Math.round(154 - (counterBounds.y1 + counterBounds.y2) * 0.08);
  const counterPixel = (counterRow * rasterInfo.width + counterColumn) * rasterInfo.channels;
  if (raster[counterPixel] < 240) throw new Error("Final mem counter must remain white.");
  console.log(`${mode}: validated ${selectedLetters.length} Hebrew glyphs, upright specimen and open final-mem counter.`);
  return buffer;
}

async function main() {
  const source = process.argv[2];
  if (!source) throw new Error("Usage: node build-proof.cjs <source-image>");
  const { width, height } = await sharp(source).metadata();
  if (width !== 2679 || height !== 2695) {
    throw new Error("The letter crops require the original 2679 x 2695 image.");
  }
  await fs.mkdir(assetPath(), { recursive: true });
  if (process.argv.includes("--alphabet-crops") || process.argv.includes("--alphabet")) {
    const tiles = [];
    for (const [index, letter] of alphabetLetters.entries()) {
      const { left, top, width: cropWidth, height: cropHeight } = letter;
      const crop = await sharp(source)
        .extract({ left, top, width: cropWidth, height: cropHeight })
        .png().toBuffer();
      await fs.writeFile(assetPath(`alphabet-${letter.name}-source.png`), crop);
      const thumbnail = await sharp(crop)
        .resize(140, 150, { fit: "contain", background: "white" })
        .extend({ top: 30, bottom: 20, left: 10, right: 10, background: "white" })
        .composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="30"><text x="8" y="20" font-size="13" fill="#333">${letter.name}</text></svg>`), left: 0, top: 0 }])
        .png().toBuffer();
      tiles.push({ input: thumbnail, left: (index % 7) * 160, top: Math.floor(index / 7) * 200 });
    }
    await sharp({ create: { width: 1120, height: 800, channels: 3, background: "white" } })
      .composite(tiles).png().toFile(assetPath("alphabet-source-selection.png"));
    console.log("All 27 labelled alphabet source crops generated.");
    if (process.argv.includes("--alphabet")) {
      const alphabetFont = await buildFont(source, false, true, alphabetLetters);
      const fonts = [
        ["Ksav Faithful", await fs.readFile(assetPath("ksav-faithful-draft.otf"))],
        ["Ksav Refined", await fs.readFile(assetPath("ksav-refined-draft.otf"))],
        ["Ksav Alphabet", alphabetFont],
      ];
      await fs.writeFile(assetPath("proof-fonts.css"), fonts.map(([family, buffer]) => `@font-face { font-family: "${family}"; src: url("data:font/otf;base64,${buffer.toString("base64")}") format("opentype"); font-display: block; }`).join("\n"));
      await fs.writeFile(assetPath("alphabet-sources.json"), JSON.stringify({ source, letters: alphabetLetters, status: "Draft; all 27 forms require visual review." }, null, 2));
      console.log("Alphabet draft generated; earlier four-letter drafts preserved.");
    }
    return;
  }
  if (process.argv.includes("--select-alphabet")) {
    for (const top of [0, 165, 275, 395, 510, 638, 875, 1105, 1330, 1460, 1700]) {
      const grid = Array.from({ length: 27 }, (_, index) => {
        const column = index * 100;
        return `<line x1="${column}" y1="25" x2="${column}" y2="205" stroke="#c53131" opacity="0.3"/><text x="${column + 2}" y="20" font-size="20" fill="#c53131">${column}</text>`;
      }).join("");
      const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="2679" height="205"><rect width="2679" height="25" fill="white"/>${grid}</svg>`;
      await sharp(source)
        .extract({ left: 0, top, width, height: 180 })
        .extend({ top: 25, bottom: 0, left: 0, right: 0, background: "white" })
        .composite([{ input: Buffer.from(overlay), left: 0, top: 0 }])
        .png()
        .toFile(assetPath(`selection-row-${top}.png`));
    }
    for (const region of [
      { name: "gimel", left: 1380, top: 1100, width: 240, height: 135 },
      { name: "samekh", left: 1600, top: 1100, width: 300, height: 140 },
      { name: "tet", left: 260, top: 505, width: 180, height: 140 },
      { name: "qof", left: 1800, top: 510, width: 340, height: 155 },
    ]) {
      const { name, ...rectangle } = region;
      const labels = Array.from({ length: Math.ceil(region.width / 20) }, (_, index) => `<text x="${index * 60 + 2}" y="20" font-size="16" fill="#c53131">${region.left + index * 20}</text><line x1="${index * 60}" y1="25" x2="${index * 60}" y2="${region.height * 3 + 25}" stroke="#c53131" opacity="0.3"/>`).join("");
      await sharp(source).extract(rectangle).resize(region.width * 3, region.height * 3)
        .extend({ top: 25, bottom: 0, left: 0, right: 0, background: "white" })
        .composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${region.width * 3}" height="${region.height * 3 + 25}">${labels}</svg>`), top: 0, left: 0 }])
        .png().toFile(assetPath(`selection-detail-${name}.png`));
    }
    console.log("Coordinate-labelled source rows generated for alphabet selection.");
    return;
  }
  await sharp(source)
    .extract({ left: 0, top: 1915, width, height: 780 })
    .png()
    .toFile(assetPath("source-detail.png"));
  const crops = [];
  for (const [index, letter] of letters.entries()) {
    const { left, top, width: cropWidth, height: cropHeight } = letter;
    const crop = await sharp(source)
      .extract({ left, top, width: cropWidth, height: cropHeight })
      .resize({ height: 400, kernel: "nearest" })
      .png()
      .toBuffer();
    await fs.writeFile(assetPath(`${letter.name}-source.png`), crop);
    crops.push({ input: crop, left: index * 440 + 20, top: 20 });
  }
  await sharp({ create: { width: 1760, height: 440, channels: 3, background: "white" } })
    .composite(crops)
    .png()
    .toFile(assetPath("letter-selection.png"));
  const faithfulFont = await buildFont(source, false);
  await buildFont(source, true);
  const refinedFont = await buildFont(source, false, true);
  const previewFonts = [
    ["Ksav Faithful", faithfulFont],
    ["Ksav Refined", refinedFont],
  ].map(([family, buffer]) => `@font-face { font-family: "${family}"; src: url("data:font/otf;base64,${buffer.toString("base64")}") format("opentype"); font-display: block; }`).join("\n");
  await fs.writeFile(assetPath("proof-fonts.css"), previewFonts);
  await sharp({ create: { width: 660, height: 460, channels: 3, background: "white" } })
    .composite([
      { input: assetPath("word-faithful.png"), left: 20, top: 10 },
      { input: assetPath("word-refined.png"), left: 20, top: 240 },
    ])
    .png()
    .toFile(assetPath("comparison.png"));
  console.log("Proof assets generated successfully.");
}

main().catch((error) => {
  console.error(error.stack);
  process.exitCode = 1;
});