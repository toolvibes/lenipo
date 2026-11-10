## Was ändert sich und warum?

<!-- Kurz beschreiben und das Issue verlinken, z. B. "Closes #123". -->

## Wie wurde es geprüft?

<!-- Tests, Schritte zum Ausprobieren, Screenshots bei Änderungen an der Oberfläche. -->

## Checkliste

- [ ] `pnpm lint`, `pnpm typecheck` und `pnpm test` laufen durch
- [ ] Bei Änderungen an der Oberfläche: End-to-End-Tests laufen, Bedienung mit Tastatur geprüft
- [ ] Neue Texte stehen auf Deutsch und Englisch in `apps/web/src/i18n`
- [ ] Bei Änderungen an der API: `pnpm api:generate` und `pnpm sdk:generate` ausgeführt
- [ ] Neue Migrationen erlauben Updates ohne Ausfall (`pnpm migrations:check`)
- [ ] Dokumentation in `docs/` angepasst, falls nötig
