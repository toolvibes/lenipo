// Generates apps/web/src/styles/tokens.css from design/tokens.json (the Tasklore design system's tokens).
import { readFileSync, writeFileSync } from 'node:fs';

const SOURCE = new URL('../design/tokens.json', import.meta.url);
const TARGET = new URL('../apps/web/src/styles/tokens.css', import.meta.url);

const tokens = JSON.parse(readFileSync(SOURCE, 'utf8'));
const [primaryTheme, ...otherThemes] = tokens.color.themes.map((theme) => theme.id);

/** `{other-token}` aliases become CSS variable references. */
function cssValue(value) {
  const alias = /^\{([A-Za-z0-9_.-]+)\}$/.exec(value);
  return alias ? `var(--${alias[1]})` : value;
}

function themedValue(token, theme) {
  if (typeof token.value === 'string') return theme === primaryTheme ? token.value : undefined;
  return token.value[theme];
}

function declarations(list, theme) {
  return list
    .map((token) => [token.name, themedValue(token, theme)])
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => `  --${name}: ${cssValue(value)};`);
}

const themed = [...tokens.color.tokens, ...(tokens.shadow?.tokens ?? [])];
const fixed = ['spacing', 'size', 'radius'].flatMap((family) => tokens[family]?.tokens ?? []);
const fonts = Object.entries(tokens.type.families).map(
  ([key, stack]) => `  --font-${key}: ${stack};`,
);

const lines = [
  '/* Tasklore — generated from design/tokens.json by scripts/build-design-tokens.mjs. Do not edit. */',
  ':root {',
  ...declarations(themed, primaryTheme),
  ...fixed.map((token) => `  --${token.name}: ${token.value};`),
  ...fonts,
  `  color-scheme: ${primaryTheme};`,
  '}',
];

for (const theme of otherThemes) {
  const body = [...declarations(themed, theme), `  color-scheme: ${theme};`];
  lines.push(
    `@media (prefers-color-scheme: ${theme}) {`,
    `  :root:not([data-theme="${primaryTheme}"]) {`,
    ...body.map((line) => `  ${line}`),
    '  }',
    '}',
    `:root[data-theme="${theme}"] {`,
    ...body,
    '}',
  );
}

for (const group of tokens.type.groups) {
  for (const style of group.styles) {
    const family = style.family ?? group.family;
    lines.push(
      `.tl-${style.name} {`,
      `  font-family: var(--font-${family});`,
      `  font-size: ${style.fontSize};`,
      `  line-height: ${style.lineHeight};`,
      `  font-weight: ${style.fontWeight};`,
      ...(style.letterSpacing ? [`  letter-spacing: ${style.letterSpacing};`] : []),
      '}',
    );
  }
}

writeFileSync(TARGET, `${lines.join('\n')}\n`);
console.log(`Wrote ${TARGET.pathname}`);
