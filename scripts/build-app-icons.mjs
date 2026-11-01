// Draws the app icons for the PWA manifest (TL-43) from the Lenipo mark (TL-87, E-129): the mark
// on white, as on the brand board's light app icon. Renders with Playwright's Chromium, which the
// web app's end-to-end tests bring along. Writes apps/web/public/icons/.
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../apps/web/package.json', import.meta.url));
const { chromium } = require('@playwright/test');

const MARK = readFileSync(
  new URL('../apps/web/src/assets/lenipo-mark.svg', import.meta.url),
  'utf8',
);
const OUT = new URL('../apps/web/public/icons/', import.meta.url);

/**
 * `markHeight`: the mark's height as share of the icon; `radius`: corner radius as share of the
 * icon, 0 fills it edge to edge (maskable and Apple icons are cut by the system).
 */
function page(size, { markHeight, radius }) {
  const height = Math.round(size * markHeight);
  return `<!doctype html><html><body style="margin:0;background:transparent">
<div style="width:${size}px;height:${size}px;border-radius:${size * radius}px;background:#ffffff;display:flex;align-items:center;justify-content:center">
<div style="height:${height}px;width:${Math.round((height * 192) / 208)}px">${MARK.replace('width="192" height="208"', 'width="100%" height="100%"')}</div>
</div></body></html>`;
}

// Locally the installed Chrome, as in the end-to-end tests; in CI Playwright's own Chromium.
const browser = await chromium.launch(process.env.CI ? {} : { channel: 'chrome' });
try {
  const tab = await browser.newPage();
  const draw = async (name, size, options) => {
    await tab.setViewportSize({ width: size, height: size });
    await tab.setContent(page(size, options));
    writeFileSync(new URL(name, OUT), await tab.screenshot({ omitBackground: true }));
  };
  await draw('icon-192.png', 192, { markHeight: 0.62, radius: 0.22 });
  await draw('icon-512.png', 512, { markHeight: 0.62, radius: 0.22 });
  // Maskable: full bleed, the mark well inside the 80 % safe zone.
  await draw('maskable-512.png', 512, { markHeight: 0.5, radius: 0 });
  await draw('apple-touch-icon.png', 180, { markHeight: 0.6, radius: 0 });
} finally {
  await browser.close();
}
writeFileSync(new URL('favicon.svg', OUT), MARK);
console.log(`Wrote icons to ${OUT.pathname}`);
