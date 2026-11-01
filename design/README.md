# Design-Tokens

`tokens.json` ist die einzige Quelle für Farben, Typografie, Abstände und Radien im Code. Nach einer Änderung:

```bash
pnpm design:tokens
```

Das erzeugt `apps/web/src/styles/tokens.css` (helles Theme als Standard, dunkles über `prefers-color-scheme` oder `data-theme="dark"`). Die Datei nie von Hand bearbeiten. Text in Akzentfarbe und auf Flächen muss mindestens 4,5:1 Kontrast halten (WCAG 2.1 AA).
