# Mitwirken

Danke, dass du Lenipo verbessern willst. Fehlerberichte, Ideen, Übersetzungen, Dokumentation und Code sind willkommen.

## Bevor du anfängst

- **Fehler und Wünsche** meldest du als [Issue](https://github.com/toolvibes/lenipo/issues/new/choose). Bitte schau vorher, ob es schon eines dazu gibt.
- **Größere Änderungen** besprich bitte erst in einem Issue, bevor du viel Zeit hineinsteckst. So klären wir früh, ob und wie sie passen.
- **Sicherheitslücken** bitte nie öffentlich melden, sondern wie in [SECURITY.md](SECURITY.md) beschrieben.
- Für alle gilt der [Verhaltenskodex](CODE_OF_CONDUCT.md).

## Entwicklungsumgebung

Voraussetzungen und den ersten Start beschreibt die [README](README.md#lokal-starten): Node.js 24, pnpm 11 und Docker. Kurz:

```bash
cp .env.example .env
pnpm install
pnpm infra:up
pnpm dev
```

## Änderungen machen

1. Forke das Repository und lege einen Branch von `main` an.
2. Halte Änderungen klein und auf ein Thema beschränkt.
3. Schreibe Tests für neues Verhalten: Unit- und Integrationstests mit Vitest, für die Oberfläche End-to-End-Tests mit Playwright.
4. Prüfe vor dem Pull Request:

   ```bash
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm --filter @toolvibes/web e2e   # bei Änderungen an der Oberfläche
   ```

5. Ändert sich die API, erzeuge die Beschreibung und die SDKs neu (`pnpm api:generate`, dann `pnpm sdk:generate`) und committe das Ergebnis mit.

## Regeln im Code

- **Migrationen** erzeugt `pnpm db:generate`. Sie müssen Updates ohne Ausfall erlauben; `pnpm migrations:check` prüft das.
- **Abhängigkeiten** brauchen eine permissive Lizenz (`pnpm licenses:check`) und sollten mindestens zwei Wochen alt sein.
- **Barrierefreiheit:** Lenipo richtet sich nach WCAG 2.1 AA. Neue Oberflächen müssen mit Tastatur und Screenreader bedienbar sein; die End-to-End-Tests prüfen mit axe-core. Mehr in [ACCESSIBILITY.md](ACCESSIBILITY.md).
- **Texte der Oberfläche** stehen in `apps/web/src/i18n` auf Deutsch und Englisch; neue Texte bitte in beiden Sprachen.
- **Formatierung** übernimmt Biome (`pnpm format`).

## Commits und Pull Requests

- Commit-Nachrichten auf Deutsch im Stil `feat: …`, `fix: …`, `perf: …`, `docs: …`, `test: …` oder `chore: …`. Aus `feat`, `fix` und `perf` entsteht der [Changelog](CHANGELOG.md).
- Im Pull Request beschreibst du, was sich ändert und warum, und verlinkst das Issue (`Closes #123`).
- Die CI muss grün sein. Ein Maintainer schaut sich den Pull Request an und meldet sich mit Rückfragen oder einer Freigabe.

## Lizenz

Lenipo steht unter der [GNU AGPL-3.0](LICENSE) (`AGPL-3.0-only`). Mit einem Beitrag stimmst du zu, dass er unter derselben Lizenz veröffentlicht wird.
