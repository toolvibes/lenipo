# Tasklore: Projektplan

> **Tasklore**: Tasks + Lore (Wissen). Eine selbst gehostete Alternative zu **Jira Server/Data Center** und **Confluence Server/Data Center**: eine Plattform, eine Datenbank, ein Login.

## Worum es geht

Atlassian hat die Server-Produkte eingestellt. Was bleibt, sind die Cloud-Version oder sehr teures Data Center. Wir bauen das nach, was die Server-Versionen stark gemacht hat:

- **Tracking (Jira-Teil):** Projekte, frei konfigurierbare Vorgangstypen, Felder und Workflows, Scrum- und Kanban-Boards, Backlog, Sprints, Releases, Roadmaps, Berichte und eine eigene Abfragesprache (wie JQL).
- **Wiki (Confluence-Teil):** Bereiche, Seitenbäume, ein Editor, in dem mehrere Leute **gleichzeitig live** an einer Seite schreiben, Makros, Vorlagen, Versionshistorie, Inline-Kommentare.
- **Für Entwickler und Maschinen:** Eine vollständige REST-API (API-first), Webhooks, ein **MCP-Server** für KI-Agenten, eine CLI und Git-Anbindung.
- **Administration:** Benutzer, Gruppen, SSO, Berechtigungsschemata, Audit-Log, Backup und Restore, Import aus Jira und Confluence.

## Dokumente

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

Sobald das MVP steht (Ende Phase 3), **verwalten wir die Weiterentwicklung im Tool selbst**: Backlog, Sprints und diese Dokumentation wandern dann aus dem Repo ins eigene Wiki. So merken wir früh, was im Alltag fehlt.

## Entwicklung

Voraussetzungen: Node 24+, pnpm 11, Docker.

```bash
cp .env.example .env      # Standardwerte passen zu docker-compose.yml
pnpm install
pnpm infra:up             # PostgreSQL (Port 5440) und Valkey (Port 6380)
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

### Produktion

```bash
cd deploy
POSTGRES_PASSWORD='…' SITE_ADDRESS=tasklore.example.org docker compose up -d --build
```

Startet Tasklore (ein Image, API und Collab-Server in einem Prozess), PostgreSQL, Valkey und Caddy mit automatischem HTTPS. Migrationen laufen beim Start. Beim ersten Start steht im Log (`docker compose logs app`) ein Einrichtungscode; damit legt der Setup-Assistent unter `/setup` den ersten Administrator an. API-Dokumentation: `/api/docs`.

### Aufbau

```
apps/api      NestJS 12: REST-API, Collab-Server (Hocuspocus), später Worker; Rolle über MODE
apps/web      React 19 + Vite: Oberfläche, TipTap-Editor
packages/     geteilter Code (@tasklore/shared)
docs/         Projektplan
design/       Design-Tokens (Quelle für tokens.css), Links zu Design-System und Kernansichten
```
