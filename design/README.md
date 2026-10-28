# Design

Gestaltungsrichtung **Feldbuch** (Abstimmung 3:0, siehe [E-25](../docs/08-entscheidungen.md)).

- **Design-System (Claude Design):** https://claude.ai/artifact/VLRKCV9QrfEDmG6FAYDPJ8 – Gestaltungsrichtlinie, Tokens, Komponenten mit Live-Vorschau
- **Kernansichten (Design-Canvas):** https://claude.ai/artifact/N59hUxGE2HQzUvWi5Psz5i – Sprint-Board, Vorgang, Wiki-Seite im dunklen Theme

`tokens.json` ist eine Kopie der Tokens aus dem Design-System und die einzige Quelle für Farben, Typografie, Abstände und Radien im Code. Nach einer Änderung:

```bash
pnpm design:tokens
```

Das erzeugt `apps/web/src/styles/tokens.css` (helles Theme als Standard, dunkles über `prefers-color-scheme` oder `data-theme="dark"`). Die Datei nie von Hand bearbeiten.
