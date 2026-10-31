// Draws the app icons for the PWA manifest (TL-43): the logo mark, a white "T" on a dark
// rounded square, as PNG without image libraries. Writes apps/web/public/icons/.
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const INK = [0x1b, 0x1c, 0x1e];
const WHITE = [0xff, 0xff, 0xff];
const OUT = new URL('../apps/web/public/icons/', import.meta.url);

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(bytes) {
  let c = -1;
  for (const byte of bytes) c = CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/**
 * `inset`: share of the size left free around the square (maskable icons need a safe zone);
 * `radius`: corner radius as share of the square; 0 fills the whole icon.
 */
function icon(size, { inset = 0, radius = 0.22 } = {}) {
  const rows = [];
  const start = size * inset;
  const side = size - 2 * start;
  const r = side * radius;
  // The "T": a bar and a stem, as in the sidebar logo.
  const barTop = start + side * 0.27;
  const barBottom = start + side * 0.4;
  const barLeft = start + side * 0.25;
  const barRight = start + side * 0.75;
  const stemLeft = start + side * 0.435;
  const stemRight = start + side * 0.565;
  const stemBottom = start + side * 0.76;
  for (let y = 0; y < size; y += 1) {
    const row = [0];
    for (let x = 0; x < size; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      const inSquare = px >= start && px <= start + side && py >= start && py <= start + side;
      const cx = Math.min(Math.max(px, start + r), start + side - r);
      const cy = Math.min(Math.max(py, start + r), start + side - r);
      const rounded = (px - cx) ** 2 + (py - cy) ** 2 <= r * r;
      const background = inset === 0 && radius === 0 ? true : inSquare && rounded;
      const letter =
        (py >= barTop && py <= barBottom && px >= barLeft && px <= barRight) ||
        (py >= barTop && py <= stemBottom && px >= stemLeft && px <= stemRight);
      if (letter && background) row.push(...WHITE, 255);
      else if (background) row.push(...INK, 255);
      else row.push(0, 0, 0, 0);
    }
    rows.push(Buffer.from(row));
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(OUT, { recursive: true });
writeFileSync(new URL('icon-192.png', OUT), icon(192));
writeFileSync(new URL('icon-512.png', OUT), icon(512));
// Maskable: full bleed, the mark inside the 80 % safe zone.
writeFileSync(new URL('maskable-512.png', OUT), icon(512, { inset: 0, radius: 0 }));
writeFileSync(new URL('apple-touch-icon.png', OUT), icon(180, { radius: 0 }));
writeFileSync(
  new URL('favicon.svg', OUT),
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><title>Tasklore</title><rect width="64" height="64" rx="14" fill="#1b1c1e"/><path fill="#fff" d="M16 17.3h32v8.3H34.8v23H29.2v-23H16z"/></svg>\n',
);
console.log(`Wrote icons to ${OUT.pathname}`);
