// Generates solid-color PWA icons with pure Node (zlib) — no dependencies.
// Usage: node scripts/make-icons.mjs [outdir]   (default: public/icons)
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

// Checkmark glyph, drawn as two line segments (distance field + 1px antialiasing
// against the brand background) — kept inside the maskable-icon 40%-radius safe
// zone (spec: https://www.w3.org/TR/appmanifest/#dfn-maskable-icons) so the
// circular OS mask never clips it.
const GLYPH = [
  [0.26, 0.54, 0.436, 0.70],
  [0.436, 0.70, 0.74, 0.30],
];
const GLYPH_THICKNESS = 0.09; // fraction of icon size

function segmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

// brand color #4A6FA5 background, white checkmark glyph on top
function iconPng(size, bg = [0x4a, 0x6f, 0xa5], fg = [0xff, 0xff, 0xff]) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  const half = (GLYPH_THICKNESS * size) / 2;
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    for (let x = 0; x < size; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let dist = Infinity;
      for (const [x1, y1, x2, y2] of GLYPH) {
        dist = Math.min(dist, segmentDistance(px, py, x1 * size, y1 * size, x2 * size, y2 * size));
      }
      // linear 1px antialiasing at the stroke edge, background otherwise
      const mix = Math.max(0, Math.min(1, half + 0.5 - dist));
      for (let c = 0; c < 3; c++) {
        row[1 + x * 3 + c] = Math.round(bg[c] + (fg[c] - bg[c]) * mix);
      }
    }
    rows.push(row);
  }
  const raw = Buffer.concat(rows);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outdir = process.argv[2] ?? 'public/icons';
fs.mkdirSync(outdir, { recursive: true });
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  fs.writeFileSync(path.join(outdir, name), iconPng(size));
  console.log('wrote', name);
}
