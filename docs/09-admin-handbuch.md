<!-- lenipo page=01a193bc-a25d-7714-b271-061da005a4cc version=2 · Schnappschuss aus dem Wiki, Änderungen bitte dort -->
# 09 · Admin-Handbuch

Betrieb einer Lenipo-Instanz: Installation, Konfiguration, Anmeldung, Rechte, Sicherung, Updates, Überwachung und Fehlersuche (TL-44, E-125). Die Hintergründe stehen in [Architektur](06-architektur.md) und [Entscheidungen](08-entscheidungen.md).

## Installation

**Docker Compose** (ein Server):

```bash
cd deploy
POSTGRES_PASSWORD='…' SITE_ADDRESS=lenipo.example.org docker compose up -d --build
```

Das startet Lenipo (API, Collab-Server und Worker in einem Prozess), PostgreSQL 17, Valkey und Caddy mit automatischem HTTPS. Anhänge liegen im Volume `app-files`; für S3 `STORAGE_DRIVER=s3` und die `S3_*`-Variablen setzen, `--profile s3` startet zusätzlich RustFS.

**Kubernetes:** Helm-Chart unter `deploy/helm/lenipo` mit je einem Deployment für api, collab und worker; PostgreSQL, Valkey und S3 laufen außerhalb (E-123). Secrets (`DATABASE_URL`, `REDIS_URL`, S3-Schlüssel, `SMTP_URL` …) als vorhandenes Secret (`existingSecret`) oder über `secrets`.

**Erster Start:** Im Log steht ein Einrichtungscode (`docker compose logs app | grep setupCode`, im Cluster in den api-Pods). Unter `/setup` legt er den ersten Administrator an – oder spielt stattdessen ein Backup ein (siehe unten).

## Konfiguration

Umgebungsvariablen, beim Start geprüft (ein Fehler nennt die Variable):

| Variable | Bedeutung |
| --- | --- |
| `DATABASE_URL` | PostgreSQL-Verbindung (Pflicht) |
| `PUBLIC_URL` | Öffentliche Adresse, für Links in E-Mails, OAuth und SAML |
| `MODE` | `all` (Standard) oder eine Rolle: `api`, `collab`, `worker` |
| `REDIS_URL` | Valkey: Anfragegrenzen über alle Instanzen, mehrere Collab-Server |
| `STORAGE_DRIVER`, `STORAGE_LOCAL_DIR`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Ablage der Anhänge und Backups |
| `ATTACHMENT_MAX_MB` | Größte Anhangsdatei (Standard 25) |
| `SMTP_URL`, `MAIL_FROM` | E-Mail-Versand; ohne `SMTP_URL` keine E-Mails |
| `OIDC_ISSUER_URL`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_DISPLAY_NAME`, `OIDC_SCOPES`, `OIDC_GROUPS_CLAIM`, `OIDC_AUTO_CREATE_USERS` | Anmeldung über OpenID Connect |
| `SESSION_IDLE_HOURS`, `SESSION_MAX_DAYS` | Vorgaben für Sitzungen (in der Administration änderbar) |
| `COOKIE_SECURE` | Sitzungs-Cookie nur über HTTPS (Standard in Produktion) |
| `RATE_LIMITS` | `false` schaltet die Anfragegrenzen ab, etwa hinter einem Gateway |
| `METRICS_PORT` | Prometheus-Metriken auf diesem Port unter `/metrics` |
| `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME` | Traces per OTLP |
| `SHUTDOWN_TIMEOUT_SECONDS` | Wie lange ein stoppender Prozess auf laufende Arbeit wartet (25) |
| `WEBHOOK_ALLOW_PRIVATE_NETWORKS` | Webhooks und Abrufe an private Adressen erlauben (Standard aus) |
| `HELP_URL` | Ziel des Eintrags „Hilfe“; ohne ihn das eingebaute Benutzerhandbuch |
| `LOG_LEVEL` | `info` (Standard), `debug`, `warn` … |

Einstellungen, die Admins zur Laufzeit ändern, liegen in der Datenbank und stehen in der **Administration**.

## Anmeldung und Personen

- **Lokale Konten** mit Passwort (Argon2id) und optionaler Zwei-Faktor-Anmeldung; Gruppen können sie verpflichtend machen (Administration → Anmeldung).
- **OIDC** über die Variablen oben; **SAML 2.0** und **LDAP/Active Directory** in der Administration (Verzeichnisse). Die Reihenfolge der Verzeichnisse entscheidet beim Passwort-Login. SAML verknüpft ein vorhandenes Konto nur, wenn es kein eigenes Passwort und keinen zweiten Faktor hat.
- **Einladungen** per E-Mail, **Selbstregistrierung** für freigegebene Domains (standardmäßig aus).
- **Deaktivieren** beendet alle Sitzungen und Tokens; **Anonymisieren** (DSGVO) ersetzt Name und E-Mail überall durch „Ehemalige Person n“ und ist nicht umkehrbar.
- **API-Tokens** und **OAuth-Apps**: Personen legen Tokens selbst an; Admins registrieren Apps von Drittanbietern (vertraulich mit Secret oder öffentlich mit PKCE) und sehen alle Verbindungen.

## Rechte

Globale Rechte hängen an Gruppen (`administrators`, `users` und eigene). Projekte bekommen ein **Berechtigungsschema** (wer was darf, über Projektrollen), ein **Benachrichtigungsschema** und optional ein **Sicherheitsschema** mit Stufen, die einzelne Vorgänge verbergen. Bereiche in Wiki haben eigene Rollen und Seiteneinschränkungen. „Rechte prüfen“ in der Administration erklärt, warum eine Person etwas sehen darf oder nicht.

## Sicherung und Wiederherstellung

- **Backups** (Administration → Wartung): ein ZIP mit allen Tabellen und Anhängen im Dateispeicher, täglich zur eingestellten Stunde, die letzten drei bleiben. Von Hand oder per Cronjob: `lenipo admin backup create` und `lenipo admin backup download <id>`. Backups gehören zusätzlich außer Haus.
- **Wiederherstellen** geht in eine frische Instanz derselben Version: unter `/setup` den Einrichtungscode eingeben und das ZIP hochladen. Danach melden sich alle mit ihren alten Konten an.
- **Aufbewahrung:** Papierkorb 30 Tage, Audit-Log 365 Tage, alte Seitenversionen optional ausdünnen; stündlich im Worker.
- **Archive** einzelner Projekte oder Bereiche (Administration → Import) ziehen Inhalte in eine andere Instanz um.

## Updates

1. Release-Hinweise lesen.
2. Neues Image ausrollen. Migrationen laufen beim Start unter einer Sperre (im Helm-Chart zusätzlich als Job vor dem Update).
3. Mit mehreren Instanzen rollt das Update ohne Ausfall: jede Migration funktioniert noch mit der vorigen Version (erst erweitern, eine Version später aufräumen; `pnpm migrations:check` prüft das).

**Zurück** auf die vorige Version geht, solange die neue keine aufräumende Migration (`-- lenipo:contract`) enthielt; sonst aus dem Backup vor dem Update.

**Wartungsmodus** (Administration → Betrieb) lässt nur Admins herein, etwa für größere Arbeiten; ein **Ankündigungsbanner** informiert vorher.

## Betrieb und Überwachung

- **Gesundheit:** `/api/v1/health/live` (Prozess läuft) und `/api/v1/health/ready` (Datenbank erreichbar; beim Herunterfahren sofort 503).
- **Metriken** mit `METRICS_PORT`: HTTP-Dauer je Route, offene Verbindungen, Warteschlangen (`lenipo_backlog`), Alter des ältesten unverarbeiteten Ereignisses (`lenipo_outbox_lag_seconds`), `lenipo_database_up`. Sinnvolle Alarme: `lenipo_database_up == 0`, `lenipo_outbox_lag_seconds > 300`, wachsende Webhook-Warteschlange.
- **Logs** als JSON auf der Standardausgabe, ohne Header und Query-Strings; mit Traces enthalten sie `trace_id`.
- **Module** (Wiki, Boards, Zeiterfassung, Automatisierung, Dashboards) lassen sich abschalten; **Anfragegrenzen** je Person, Token und IP einstellen (Administration → Betrieb).
- **Skalierung:** mehrere api- und worker-Instanzen jederzeit; mehrere Collab-Server nur mit `REDIS_URL`.
- **Lasttest** gegen die Qualitätsziele: `pnpm --filter @toolvibes/loadtest loadtest` (siehe [Lasttests](12-lasttests.md)).

## Fehlersuche

| Beobachtung | Ursache und Abhilfe |
| --- | --- |
| Start bricht mit „Invalid configuration“ ab | Die Meldung nennt die Variable; Wert prüfen |
| Kein Einrichtungscode im Log | Die Instanz ist schon eingerichtet; neuer Code nur, solange es keinen Admin gibt |
| Anmeldung meldet „zu viele Versuche“ | Mehr als 10 Fehlversuche je Konto oder 50 je IP in 15 Minuten; 15 Minuten warten |
| Antworten mit 429 | Anfragegrenze erreicht (`Retry-After` sagt, wie lange); Grenzen oder Token-Quote anpassen |
| Alle außer Admins sehen „Lenipo wird gewartet“ | Wartungsmodus ist an (Administration → Betrieb) |
| Keine E-Mails | `SMTP_URL` fehlt oder ist falsch; Worker-Log prüfen |
| Webhook wird nicht zugestellt | Zustellprotokoll des Webhooks; private Ziele brauchen `WEBHOOK_ALLOW_PRIVATE_NETWORKS` |
| Gemeinsames Bearbeiten verliert die Verbindung | Proxy muss WebSockets unter `/collab` durchreichen |
| Suche langsam | `lenipo_http_request_duration_seconds` je Route ansehen; `ANALYZE` nach großen Importen |
