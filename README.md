# Tasklore: Projektplan

> **Tasklore**: Tasks + Lore (Wissen). Eine selbst gehostete Alternative zu **Jira Server/Data Center** und **Confluence Server/Data Center**: eine Plattform, eine Datenbank, ein Login.

Repository: https://github.com/davidk85/TaskLore (privat)

## Worum es geht

Atlassian hat die Server-Produkte eingestellt. Was bleibt, sind die Cloud-Version oder sehr teures Data Center. Wir bauen das nach, was die Server-Versionen stark gemacht hat:

- **Tracking (Jira-Teil):** Projekte, frei konfigurierbare Vorgangstypen, Felder und Workflows, Scrum- und Kanban-Boards, Backlog, Sprints, Releases, Roadmaps, Berichte und eine eigene Abfragesprache (wie JQL).
- **Wiki (Confluence-Teil):** Bereiche, Seitenbäume, ein Editor, in dem mehrere Leute **gleichzeitig live** an einer Seite schreiben, Makros, Vorlagen, Versionshistorie, Inline-Kommentare.
- **Für Entwickler und Maschinen:** Eine vollständige REST-API (API-first), Webhooks, ein **MCP-Server** für KI-Agenten, eine CLI und Git-Anbindung.
- **Administration:** Benutzer, Gruppen, SSO, Berechtigungsschemata, Audit-Log, Backup und Restore, Import aus Jira und Confluence.

## Dokumente

Die Dokumentation lebt im eigenen Wiki (Lore-Bereich `TL`); `docs/` ist ein Schnappschuss daraus, siehe [docs/README.md](docs/README.md).

| # | Dokument | Inhalt |
|---|----------|--------|
| 1 | [Vision & Scope](docs/01-vision-scope.md) | Ziele, Zielgruppen, Leitprinzipien, was wir bewusst nicht machen |
| 2 | [Features: Tracking (Jira)](docs/02-features-tracking.md) | Vorgänge, Workflows, Boards, Sprints, Releases, Berichte, Abfragesprache |
| 3 | [Features: Wiki (Confluence)](docs/03-features-wiki.md) | Bereiche, Seiten, Live-Editor, Makros, Vorlagen, Historie |
| 4 | [Plattform & Administration](docs/04-plattform-admin.md) | Benutzer, Rechte, Benachrichtigungen, Suche, Admin-Konsole, Betrieb |
| 5 | [API, MCP & Entwickler-Tools](docs/05-api-mcp-devtools.md) | REST-API, Webhooks, MCP-Server, CLI, SDK, Git-Integration |
| 6 | [Architektur & Technik](docs/06-architektur.md) | Stack, Module, Datenmodell, Echtzeit, Suche, Sicherheit, Deployment |
| 7 | [Roadmap](docs/07-roadmap.md) | Phasen, Meilensteine, MVP, Definition of Done, Risiken |
| 8 | [Entscheidungen](docs/08-entscheidungen.md) | Offene und getroffene Architekturentscheidungen |

## Priorisierung

Jedes Feature hat eine ID (z. B. `T-BRD-03`) und eine Priorität:

- **P1**: gehört zum MVP. Ohne das können wir das Tool nicht selbst nutzen.
- **P2**: gehört zu Version 1.0, also zum vollwertigen Ersatz für Jira/Confluence Server.
- **P3**: kommt später oder ist optional.

## Leitidee für die Umsetzung

Seit dem MVP (Ende Phase 3) **verwalten wir die Weiterentwicklung im Tool selbst**: Diese Dokumentation ist ins eigene Wiki umgezogen (Bereich `TL`), der Backlog steht im Projekt `TL` (ein Epic je Roadmap-Phase). So merken wir früh, was im Alltag fehlt.

## Entwicklung

Voraussetzungen: Node 24+, pnpm 11, Docker.

```bash
cp .env.example .env      # Standardwerte passen zu docker-compose.yml
pnpm install
pnpm infra:up             # PostgreSQL (5440), Valkey (6380), RustFS als S3 (9010, Konsole 9011), Mailpit (SMTP 1026, Postfach http://localhost:8026)
pnpm dev                  # API :4000, Collab-Server :4001, Web :5173
```

Dann <http://localhost:5173> in zwei Tabs öffnen: Beide bearbeiten dasselbe Dokument live. Mit `?doc=page:<name>` lassen sich weitere Dokumente öffnen.

| Befehl | Zweck |
|--------|-------|
| `pnpm lint` / `pnpm format` | Biome prüfen / automatisch korrigieren |
| `pnpm typecheck` | TypeScript in allen Paketen |
| `pnpm test` | Unit-Tests (Vitest) |
| `pnpm build` | Alle Pakete bauen |
| `pnpm db:generate` | Migration aus dem Drizzle-Schema erzeugen |
| `pnpm db:migrate` | Migrationen anwenden (passiert auch beim API-Start) |
| `pnpm licenses:check` | Nur permissive Lizenzen in Produktionsabhängigkeiten |

### KI-Agenten (MCP)

Tasklore hat einen eingebauten MCP-Server unter `/mcp` (E-52) mit Werkzeugen, Ressourcen (`tasklore://issue/WEB-1` …) und Prompts (E-114). Clients melden sich per OAuth im Browser an (E-115), zum Beispiel in Claude Code:

```bash
claude mcp add --transport http tasklore http://localhost:5173/mcp
```

Alternativ mit einem Personal Access Token aus „Profil → Tokens“: `--header "Authorization: Bearer <token>"`. Der Agent arbeitet mit den Rechten der Person; seine Änderungen stehen in der Historie als „über MCP“. Verbundene Anwendungen lassen sich im Profil trennen.

### Kommandozeile (`tl`)

Das Paket `packages/cli` bringt `tl` (auch `tasklore`) mit (E-117): Vorgänge, Boards, Sprints, Wiki-Seiten als Markdown samt Ordner-Abgleich und eine stdio-MCP-Brücke für Clients, die nur Programme starten.

```bash
pnpm --filter @tasklore/cli build && node packages/cli/dist/main.js login http://localhost:5173
```

`tl help` zeigt alle Befehle; `tl completion zsh` liefert die Shell-Vervollständigung. In CI ersetzen `TASKLORE_URL` und `TASKLORE_TOKEN` das Profil.

### Produktion

```bash
cd deploy
POSTGRES_PASSWORD='…' SITE_ADDRESS=tasklore.example.org docker compose up -d --build
```

Startet Tasklore (ein Image, API und Collab-Server in einem Prozess), PostgreSQL, Valkey und Caddy mit automatischem HTTPS. Anhänge landen im Volume `app-files`; für S3 `STORAGE_DRIVER=s3` und die `S3_*`-Variablen setzen, mit `--profile s3` startet zusätzlich RustFS. Migrationen laufen beim Start. Beim ersten Start steht im Log (`docker compose logs app`) ein Einrichtungscode; damit legt der Setup-Assistent unter `/setup` den ersten Administrator an. API-Dokumentation: `/api/docs`.

Backups (E-120): Administration → Wartung legt täglich ein ZIP mit allen Daten und Anhängen im Dateispeicher ab (die letzten drei bleiben), von Hand oder per Cronjob mit `tl admin backup create` und `tl admin backup download <id>`. Wiederhergestellt wird in eine frische Instanz derselben Version: unter `/setup` den Einrichtungscode eingeben und das Backup hochladen.

Betrieb (E-121): Administration → Betrieb schaltet Module ab, setzt den Wartungsmodus und einen Ankündigungsbanner und begrenzt Anfragen je Person, Token und IP. Mit `REDIS_URL` (Valkey) gelten die Grenzen über alle Instanzen; `RATE_LIMITS=false` schaltet sie ab, wenn ein Gateway davor schon begrenzt.

### Kubernetes

```bash
helm install tasklore deploy/helm/tasklore --set image.repository=<registry>/tasklore --set secrets.DATABASE_URL='postgres://…' --set secrets.REDIS_URL='redis://…' --set ingress.host=tasklore.example.org
```

Je Rolle ein Deployment (api, collab, worker) aus demselben Image, Migrationen als Job vor jedem Update; PostgreSQL, Valkey und S3 laufen außerhalb (E-123). Updates rollen ohne Ausfall, solange Migrationen die Regel „erst erweitern, dann aufräumen“ einhalten (`pnpm migrations:check`). Metriken: `METRICS_PORT` (im Chart 9464) unter `/metrics`; Traces mit `OTEL_EXPORTER_OTLP_ENDPOINT`.

### Aufbau

```
apps/api      NestJS 12: REST-API, Collab-Server (Hocuspocus), später Worker; Rolle über MODE
apps/web      React 19 + Vite: Oberfläche, TipTap-Editor
packages/     geteilter Code (@tasklore/shared)
docs/         Projektplan
design/       Design-Tokens (Quelle für tokens.css), Links zu Design-System und Kernansichten
```
