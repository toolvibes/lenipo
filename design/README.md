# Design

Gestaltungsrichtung **Zink & Kobalt** (siehe [E-64](../docs/08-entscheidungen.md)); sie löst Farben, Schriften und Radien der früheren Richtung „Feldbuch“ (E-25) ab.

- **Design-System (Claude Design):** https://claude.ai/artifact/VLRKCV9QrfEDmG6FAYDPJ8 – Gestaltungsrichtlinie, Tokens, Komponenten mit Live-Vorschau
- **Kernansichten (Design-Canvas):** https://claude.ai/artifact/N59hUxGE2HQzUvWi5Psz5i – Sprint-Board, Vorgang, Wiki-Seite im dunklen Theme

Das Design-System und der Design-Canvas zeigen noch „Feldbuch“; maßgeblich ist seit E-64 `tokens.json`.

`tokens.json` ist die einzige Quelle für Farben, Typografie, Abstände und Radien im Code. Nach einer Änderung:

```bash
pnpm design:tokens
```

Das erzeugt `apps/web/src/styles/tokens.css` (helles Theme als Standard, dunkles über `prefers-color-scheme` oder `data-theme="dark"`). Die Datei nie von Hand bearbeiten.
