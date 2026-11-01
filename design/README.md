# Design

Gestaltung nach dem Claude-Design-Projekt **„Lenipo UI Design“, Richtung 1a** (siehe [E-67](../docs/08-entscheidungen.md)): https://claude.ai/design/p/60308882-ddf4-4939-b2f5-4cce911db3b1 – feste Seitenleiste, warmes Neutralgrau, ein blauer Akzent, Instrument Sans, Newsreader für Wiki, JetBrains Mono. Sie löst „Zink & Kobalt“ (E-64) und „Feldbuch“ (E-25) ab.

- **Design-System (Claude Design):** https://claude.ai/artifact/VLRKCV9QrfEDmG6FAYDPJ8 – Gestaltungsrichtlinie, Tokens, Komponenten mit Live-Vorschau
- **Kernansichten (Design-Canvas):** https://claude.ai/artifact/N59hUxGE2HQzUvWi5Psz5i – Sprint-Board, Vorgang, Wiki-Seite im dunklen Theme

Das ältere Design-System und der Design-Canvas zeigen noch „Feldbuch“; maßgeblich ist `tokens.json`.

`tokens.json` ist die einzige Quelle für Farben, Typografie, Abstände und Radien im Code. Nach einer Änderung:

```bash
pnpm design:tokens
```

Das erzeugt `apps/web/src/styles/tokens.css` (helles Theme als Standard, dunkles über `prefers-color-scheme` oder `data-theme="dark"`). Die Datei nie von Hand bearbeiten.
