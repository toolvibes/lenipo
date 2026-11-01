# Lenipo

**Projekte, Aufgaben und Wissen – einfach verbunden.** Lenipo ist eine selbst gehostete Plattform für Vorgänge, Boards und Wiki: eine Alternative zu **Jira Server/Data Center** und **Confluence Server/Data Center** mit einer Anwendung, einer Datenbank und einem Login.

Website: <https://lenipo.de> · Früherer Projektname: Tasklore (siehe [E-129](docs/08-entscheidungen.md))

> **Stand:** in Entwicklung, noch vor Version 1.0. Eine Lizenz ist noch nicht festgelegt (E-02); bis dahin gilt für den Code „alle Rechte vorbehalten“.

## Was Lenipo kann

- **Vorgänge und Boards:** Projekte mit eigenen Vorgangstypen, Feldern und Workflows (Regeln, Übergangsmasken), Scrum- und Kanban-Boards, Backlog, Sprints, Releases, Timeline, Kalender und Berichte.
- **Wiki:** Bereiche (allgemein oder zu einem Projekt) mit Seitenbäumen, gemeinsames Bearbeiten in Echtzeit, Makros, Vorlagen, Versionen, Inline-Kommentare, Export als Word, Markdown, HTML oder PDF.
- **Suche:** die Abfragesprache **TQL** (nah an JQL), gespeicherte Filter mit Abonnements, Dashboards und eine globale Suche über Vorgänge, Seiten, Projekte und Bereiche.
- **Automatisierung und Anbindung:** Regeln auf Ereignisse, Zeitpläne und eingehende Webhooks; ausgehende Webhooks und Chat-Nachrichten (Slack, Teams, Mattermost, Rocket.Chat); Git-Anbindung.
- **Für Entwickler und KI-Assistenten:** REST-API mit OpenAPI, TypeScript-SDK, Kommandozeile `lenipo`, OAuth-Apps und ein eingebauter **MCP-Server**.
- **Administration:** Gruppen und Berechtigungsschemata, Sicherheitsstufen, SSO über OIDC, SAML und LDAP, Zwei-Faktor-Anmeldung, Audit-Log, Backup und Wiederherstellung, Import aus Jira und Confluence.
- **Barrierefrei** nach WCAG 2.1 AA, als App installierbar, Oberfläche auf Deutsch und Englisch.

## Lokal starten

### Voraussetzungen

- **Node.js 24** oder neuer
- **pnpm 11** (`corepack enable` aktiviert die im Repository festgelegte Version)
- **Docker** mit Compose, für PostgreSQL, Valkey, S3-Speicher und ein Test-Postfach

### Erster Start

```bash
git clone https://github.com/toolvibes/lenipo.git
cd lenipo
cp .env.example .env      # Standardwerte passen zu docker-compose.yml
pnpm install
pnpm infra:up             # Dienste im Hintergrund starten (siehe Tabelle unten)
pnpm dev                  # API :4000, Collab-Server :4001, Web :5173
```

Dann <http://localhost:5173> öffnen. Beim allerersten Start gibt es noch keinen Administrator: Die Seite leitet zu `/setup`, und im Log der API steht ein **Einrichtungscode** (Feld `setupCode`). Mit ihm legt der Assistent das erste Konto an; danach führen drei kurze Schritte zu einem ersten Projekt oder Wiki-Bereich. Die Migrationen der Datenbank laufen beim Start der API automatisch.

| Dienst aus `docker-compose.yml` | Adresse |
| --- | --- |
| PostgreSQL 17 | `localhost:5440` (Benutzer, Passwort und Datenbank `tasklore`) |
| Valkey (Redis-kompatibel) | `localhost:6380` |
| RustFS als S3-Speicher | `localhost:9010`, Konsole <http://localhost:9011> |
| Mailpit (alle E-Mails landen hier) | SMTP `localhost:1026`, Postfach <http://localhost:8026> |
| Keycloak für OIDC, optional | `docker compose --profile oidc up -d keycloak`, siehe [dev/keycloak](dev/keycloak/README.md) |

Die lokalen Namen `tasklore` (Datenbank, Docker-Projekt) stammen aus der Zeit vor der Umbenennung und bleiben, damit vorhandene Entwicklungsdaten erhalten bleiben (E-129). Anhänge liegen standardmäßig in `apps/api/data/files`; für S3 die `S3_*`-Zeilen in `.env` einkommentieren.

`pnpm infra:down` stoppt die Dienste, die Daten bleiben in Docker-Volumes.

### Prüfen

| Befehl | Zweck |
| --- | --- |
| `pnpm lint` / `pnpm format` | Biome prüfen / automatisch korrigieren |
| `pnpm typecheck` | TypeScript in allen Paketen |
| `pnpm test` | Unit- und Integrationstests (Vitest); jede Testdatei bekommt eine eigene, frische Datenbank im lokalen PostgreSQL |
| `pnpm --filter @toolvibes/web e2e` | End-to-End- und Barrierefreiheitstests mit Playwright (lokal im installierten Chrome) |
| `pnpm build` | Alle Pakete bauen |
| `pnpm migrations:check` | Migrationen müssen Updates ohne Ausfall erlauben |
| `pnpm licenses:check` | Nur permissive Lizenzen in Produktionsabhängigkeiten |
| `node tools/loadtest/run.mjs --smoke` | Kleiner Lasttest (voll ohne `--smoke`, siehe [Lasttests](docs/12-lasttests.md)) |

Die S3-Tests laufen nur, wenn `TEST_S3_ENDPOINT` gesetzt ist (z. B. `http://localhost:9010` mit `TEST_S3_ACCESS_KEY_ID=tasklore` und `TEST_S3_SECRET_ACCESS_KEY=tasklore-dev-secret`), die Valkey-Tests nur mit `TEST_REDIS_URL`. Die CI in `.github/workflows/ci.yml` führt alles zusammen aus.

### Weitere Befehle

| Befehl | Zweck |
| --- | --- |
| `pnpm db:generate` | Migration aus dem Drizzle-Schema erzeugen |
| `pnpm db:migrate` | Migrationen von Hand anwenden |
| `pnpm api:generate` | OpenAPI-Beschreibung und SDK neu erzeugen |
| `pnpm design:tokens` | `tokens.css` aus `design/tokens.json` erzeugen |
| `node scripts/build-app-icons.mjs` | App-Icons und Favicon aus der Bildmarke rendern |

## Betrieb

### Ein Server mit Docker Compose

```bash
cd deploy
POSTGRES_PASSWORD='…' SITE_ADDRESS=lenipo.example.org docker compose up -d --build
```

Startet Lenipo (ein Image, API, Collab-Server und Worker in einem Prozess), PostgreSQL, Valkey und Caddy mit automatischem HTTPS. Den Einrichtungscode zeigt `docker compose logs app | grep setupCode`; unter `/setup` legt er den ersten Administrator an oder spielt ein Backup ein. Die API-Dokumentation liegt unter `/api/docs`.

### Kubernetes

```bash
helm install lenipo deploy/helm/lenipo --set image.repository=<registry>/lenipo \
  --set secrets.DATABASE_URL='postgres://…' --set secrets.REDIS_URL='redis://…' \
  --set ingress.host=lenipo.example.org
```

Je Rolle ein Deployment (api, collab, worker) aus demselben Image, Migrationen als Job vor jedem Update; PostgreSQL, Valkey und S3 laufen außerhalb.

Konfiguration, Anmeldung, Rechte, Backups, Updates, Überwachung und Fehlersuche beschreibt das **[Admin-Handbuch](docs/09-admin-handbuch.md)**.

## KI-Assistenten (MCP) und Kommandozeile

Der eingebaute MCP-Server unter `/mcp` bietet Werkzeuge, Ressourcen (`lenipo://issue/WEB-1` …) und Prompts. Clients melden sich per OAuth im Browser an, zum Beispiel in Claude Code:

```bash
claude mcp add --transport http lenipo http://localhost:5173/mcp
```

Alternativ mit einem persönlichen Token aus „Profil → Tokens“: `--header "Authorization: Bearer <token>"`. Der Assistent arbeitet mit den Rechten der Person.

Die Kommandozeile liegt in `packages/cli`:

```bash
pnpm --filter @toolvibes/cli build
node packages/cli/dist/main.js login http://localhost:5173
```

`lenipo help` zeigt alle Befehle (Vorgänge, Boards, Sprints, Wiki-Seiten als Markdown, Backups, Importe, stdio-MCP-Brücke). In CI ersetzen `LENIPO_URL` und `LENIPO_TOKEN` das Profil.

## Aufbau

```
apps/api         NestJS: REST-API, Collab-Server (Hocuspocus), Worker; Rolle über MODE
apps/web         React 19 + Vite: Oberfläche mit TipTap-Editor, PWA
packages/shared  Schemas und Typen für API und Oberfläche (Zod)
packages/editor  Editor-Erweiterungen und Markdown-Abgleich
packages/tql     Parser der Abfragesprache TQL
packages/sdk     TypeScript-SDK, erzeugt aus der OpenAPI-Beschreibung
packages/cli     Kommandozeile lenipo
tools/           Lasttest und Code-Erzeugung
deploy/          Docker Compose, Caddy und Helm-Chart für den Betrieb
design/          Design-Tokens
docs/            Dokumentation (Schnappschuss aus dem eigenen Wiki)
scripts/         Prüfungen und Generatoren
```

## Dokumentation

| # | Dokument | Inhalt |
| --- | --- | --- |
| 1 | [Vision & Scope](docs/01-vision-scope.md) | Ziele, Zielgruppen, Leitprinzipien, was wir bewusst nicht machen |
| 2 | [Features: Tracking](docs/02-features-tracking.md) | Vorgänge, Workflows, Boards, Sprints, Releases, Berichte, Abfragesprache |
| 3 | [Features: Wiki](docs/03-features-wiki.md) | Bereiche, Seiten, Live-Editor, Makros, Vorlagen, Historie |
| 4 | [Plattform & Administration](docs/04-plattform-admin.md) | Benutzer, Rechte, Benachrichtigungen, Suche, Admin-Konsole, Betrieb |
| 5 | [API, MCP & Entwickler-Tools](docs/05-api-mcp-devtools.md) | REST-API, Webhooks, MCP-Server, CLI, SDK, Git-Integration |
| 6 | [Architektur & Technik](docs/06-architektur.md) | Stack, Module, Datenmodell, Echtzeit, Suche, Sicherheit, Deployment |
| 7 | [Roadmap](docs/07-roadmap.md) | Phasen, Meilensteine, Definition of Done, Risiken |
| 8 | [Entscheidungen](docs/08-entscheidungen.md) | Getroffene und offene Entscheidungen |
| 9 | [Admin-Handbuch](docs/09-admin-handbuch.md) | Installation, Konfiguration, Sicherung, Updates, Betrieb, Fehlersuche |
| 10 | [Benutzerhandbuch](docs/10-benutzerhandbuch.md) | Vorgänge, Boards, TQL, Wiki, Benachrichtigungen, Tastatur (auch in der App unter „Hilfe“) |
| 11 | [Sicherheitsreview](docs/11-sicherheitsreview.md) | Review nach OWASP ASVS L2, Befunde und Behebung |
| 12 | [Lasttests](docs/12-lasttests.md) | Messung gegen die Qualitätsziele |

Die Dokumentation lebt im Wiki von Lenipo selbst (Bereich `TL`); `docs/` ist ein Schnappschuss daraus, siehe [docs/README.md](docs/README.md). Seit dem MVP wird Lenipo mit Lenipo entwickelt: Der Backlog steht im Projekt `TL`, je Roadmap-Phase ein Epic.

## Mitwirken

- Vor einem Commit `pnpm lint`, `pnpm typecheck` und `pnpm test` ausführen; bei Änderungen an der Oberfläche auch die End-to-End-Tests.
- Neue Abhängigkeiten brauchen eine permissive Lizenz und sollten mindestens zwei Wochen alt sein.
- Größere Entscheidungen kommen mit Begründung in die [Entscheidungen](docs/08-entscheidungen.md) (E-Nummer).
- Commit-Nachrichten auf Deutsch, im Stil `feat: …`, `fix: …`, `perf: …` mit Story-Nummer.

Sicherheitslücken bitte nicht öffentlich als Issue melden, sondern über [SECURITY.md](SECURITY.md).
