<!-- lenipo page=01a193bc-a25d-7714-b271-061da005a4cc version=22 · Schnappschuss aus dem Wiki, Änderungen bitte dort -->
# 09 · Admin-Handbuch

Betrieb einer Lenipo-Instanz: Installation, Konfiguration, Anmeldung, Rechte, Sicherung, Updates, Überwachung und Fehlersuche.

## Installation

**Docker Compose** (ein Server):

```bash
cd deploy
POSTGRES_PASSWORD='…' SITE_ADDRESS=lenipo.example.org docker compose up -d --build
```

Das startet Lenipo (API, Collab-Server und Worker in einem Prozess), PostgreSQL 17 mit der Erweiterung pgvector (gebaut aus `deploy/postgres`), Valkey und Caddy mit automatischem HTTPS. Anhänge liegen im Volume `app-files`; für S3 `STORAGE_DRIVER=s3` und die `S3_*`-Variablen setzen, `--profile s3` startet zusätzlich RustFS.

**Kubernetes:** Helm-Chart unter `deploy/helm/lenipo` mit je einem Deployment für api, collab und worker; PostgreSQL, Valkey und S3 laufen außerhalb. Secrets (`DATABASE_URL`, `REDIS_URL`, S3-Schlüssel, `SMTP_URL` …) als vorhandenes Secret (`existingSecret`) oder über `secrets`.

**Erster Start:** Im Log steht ein Einrichtungscode (`docker compose logs app | grep setupCode`, im Cluster in den api-Pods). Unter `/setup` legt er den ersten Administrator an – oder spielt stattdessen ein Backup ein (siehe unten).

## Konfiguration

Umgebungsvariablen, beim Start geprüft (ein Fehler nennt die Variable):

| Variable | Bedeutung |
| --- | --- |
| `DATABASE_URL` | PostgreSQL-Verbindung (Pflicht) |
| `PUBLIC_URL` | Öffentliche Adresse, für Links in E-Mails, OAuth und SAML |
| `MODE` | `all` (Standard) oder eine Rolle: `api`, `collab`, `worker` |
| `SETUP_TOKEN` | Optional, mindestens 32 Zeichen, für Bereitsteller (Hosting-Dienst, Deployment-Skript) mit `Authorization: Bearer <SETUP_TOKEN>`. `POST /api/v1/setup/provision` richtet die Instanz ein, solange das noch aussteht: Name und eine Einladung für die erste Admin-Person, deren Link zurückkommt; die Person setzt Name und Passwort selbst. `PUT /api/v1/provider/limits` setzt einen Rahmen (Plätze, Agenten, Speicher, Module, Service Desk, Obergrenzen der Anfragegrenzen), `GET /api/v1/provider/usage` liefert die Nutzung und wann zuletzt eine Person Lenipo genutzt hat |
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
| `IMPRINT_URL`, `PRIVACY_URL` | Links zu Impressum und Datenschutzerklärung, solange Admins keine eigenen eintragen |
| `LOG_LEVEL` | `info` (Standard), `debug`, `warn` … |

Einstellungen, die Admins zur Laufzeit ändern, liegen in der Datenbank und stehen in der **Administration**.

## Anmeldung und Personen

- **Lokale Konten** mit Passwort (Argon2id) und optionaler Zwei-Faktor-Anmeldung; Gruppen können sie verpflichtend machen (Administration → Anmeldung).
- **OIDC** über die Variablen oben; **SAML 2.0** und **LDAP/Active Directory** in der Administration (Verzeichnisse). Die Reihenfolge der Verzeichnisse entscheidet beim Passwort-Login. SAML verknüpft ein vorhandenes Konto nur, wenn es kein eigenes Passwort und keinen zweiten Faktor hat.
- **SCIM 2.0** für Identitätsanbieter wie Entra ID, Okta oder Keycloak: Administration → Verzeichnisse → SCIM-Provisionierung erzeugt ein Token (nur einmal angezeigt, widerrufbar); im Anbieter als Adresse `https://<lenipo>/scim/v2` und das Token als Bearer-Token eintragen. Der Anbieter legt Personen (Anmeldename = E-Mail, ohne Passwort, Anmeldung über OIDC oder SAML) und Gruppen an, ändert und deaktiviert sie; ein vorhandenes Konto mit derselben E-Mail übernimmt er. Löschen deaktiviert nur, Beiträge bleiben. Gruppen, die der Anbieter angelegt hat, verwaltet nur er; eingebaute und in Lenipo angelegte Gruppen kann er nicht ändern.
- **Einladungen** per E-Mail, **Selbstregistrierung** für freigegebene Domains (standardmäßig aus).
- **Externe** (Kunden, Partner): Einladung mit „Als externe Person einladen“ oder in der Benutzerverwaltung „Als extern führen“. Externe sind nicht in der Gruppe „users“, haben keine globalen Rechte und sehen nur die Projekte und Bereiche, in denen sie eine Rolle haben. Beim Zuordnen zu einem Projekt gibt „Auch im verknüpften Wiki-Bereich freigeben“ die passende Stufe im Wiki-Bereich des Projekts.
- **Agenten** (KI-Agenten wie Claude Code, Codex oder Gemini CLI): Administration → Agenten legt ein Konto mit Werkzeug, Modell und verantwortlicher Person an. Agenten haben kein Passwort und melden sich nie an; sie arbeiten mit Tokens, die die verantwortliche Person (Profil → „Meine Agenten“) oder ein Admin erstellt – nie mit dem Bereich `admin`. Agenten sind nicht in der Gruppe „users“ und bekommen Projekte wie andere Personen über die Rollen des Projekts. Überall erscheinen sie mit einem eckigen Avatar mit Roboter; `assignee in agents()` findet ihre Vorgänge. „Darf nehmen (TQL)“ begrenzt, welche Vorgänge ein Agent mit „nächste Aufgabe beanspruchen“ nimmt, z. B. `component = Frontend AND labels != security`. E-Mails bekommen sie nicht; ihre Benachrichtigungen holen sie über die API, den Ereignis-Strom `GET /api/v1/me/events` (Server-Sent Events) oder einen eigenen Webhook, den die verantwortliche Person oder ein Admin beim Agenten einträgt (Ereignis `notification.created`, signiert wie alle Webhooks, nicht in der Webhook-Liste der Administration). SCIM sieht sie nicht. In den Projekteinstellungen unter **Agenten** bekommen sie je Projekt Rollen: Planer (Sprints anlegen, füllen, starten), Koordinator (Sprints abschließen), Umsetzer und Tester (Vorgänge beanspruchen), Reviewer; ohne Rolle gelten sie als Umsetzer. Dort lässt sich auch einschalten, dass Agenten Sprints nur nach Freigabe durch eine Person starten und abschließen. Ebenfalls dort: in welchen Status ein Vorgang nach einem Review-Urteil wechselt (standardmäßig bleibt er stehen). Deaktivieren in der Personenliste stoppt alle ihre Tokens. **Aufsicht:** Die Seite „Agenten“ in der Seitenleiste zeigt alle Agenten mit Stand, Vorgang, Budget, Erledigtem und Fehlversuchen der letzten 7 Tage sowie alles, was auf eine Freigabe wartet. Auf der Seite eines Agenten halten verantwortliche Person und Admins ihn an (**Not-Aus**: nur noch lesen, Ansprüche enden, Webhook ruht, Tokens bleiben gültig) und legen ein **Budget** je Tag und Monat fest (neu beanspruchte Vorgänge, Minuten mit Anspruch, gemeldete Kosten; bei 80 % und 100 % eine Nachricht an die verantwortliche Person, danach nimmt der Agent nichts Neues an). Dort stehen auch seine Rechte und sein Verlauf: Lenipo protokolliert jede schreibende und jede abgewiesene Anfrage eines Agenten 90 Tage lang (Tabelle `agent_requests`, aufgeräumt vom Aufbewahrungsjob). In den Projekteinstellungen unter **Agenten** hält die Projektadministration alle Agenten des Projekts an und legt **Status, die nur Menschen setzen** fest; verschiebt ein Agent dorthin, entscheidet eine Person über die Anfrage. Betrieben werden Agenten mit dem Runner der Kommandozeile (`lenipo agent run`, Sprint-Agent-Handbuch): auf einem Rechner oder Server im Code-Repository, mehrere Agenten parallel in eigenen Git-Worktrees, angestoßen per Zeitplan, Ereignis-Strom oder Webhook an `http://<Runner>:<Port>/<Name>`.
- **Deaktivieren** beendet alle Sitzungen und Tokens; **Anonymisieren** (DSGVO) ersetzt Name und E-Mail überall durch „Ehemalige Person n“ und ist nicht umkehrbar.
- **API-Tokens** und **OAuth-Apps**: Personen legen Tokens selbst an; Admins registrieren Apps von Drittanbietern (vertraulich mit Secret oder öffentlich mit PKCE) und sehen alle Verbindungen.

## Service Desk

Projekteinstellungen → Service Desk → „Als Service Desk betreiben“. Dort: wer Anfragen stellen darf (eingetragene Kunden, oft externe Konten, oder alle Angemeldeten), Begrüßung im Portal, Anfragetypen (Name, Vorgangstyp, zusätzliche Felder Priorität und Fälligkeit) und SLA-Ziele in Stunden Arbeitszeit je Priorität für erste Antwort und Lösung. Gezählt wird an den Arbeitstagen der Instanz (Zeiterfassung: Stunden pro Tag, Tage pro Woche) ab der eingestellten Uhrzeit in Europe/Berlin; in gewählten Status (z. B. „Wartet auf Kunde“) ruht die Uhr. Kunden brauchen keine Rolle im Projekt; sie sehen nur ihre eigenen Anfragen und keine internen Notizen.

## KI (optional)

Administration → KI verbindet ein Sprachmodell mit OpenAI-kompatibler Schnittstelle: Ollama, vLLM, LocalAI oder ein Anbieter wie OpenAI oder Mistral. Einzutragen sind die Adresse bis vor `/embeddings` (z. B. `http://ollama:11434/v1`), bei Bedarf ein API-Schlüssel und zwei Modelle:

- **Embedding-Modell** für die Suche nach Bedeutung. Für deutsche Texte ein mehrsprachiges Modell nehmen, z. B. `qwen3-embedding`, `bge-m3` oder `multilingual-e5`. Der Worker erfasst danach alle Vorgänge und veröffentlichten Seiten und hält sie aktuell – Seiten Abschnitt für Abschnitt (an den Überschriften bis Ebene 3), sodass die Suche die passende Stelle zeigt. Nach einem Modellwechsel erfasst er alles neu. Manche Modelle erwarten einen **Präfix**: `nomic-embed-text` etwa `search_query: ` vor Suchanfragen und `search_document: ` vor Inhalten, `qwen3-embedding` eine Anweisung wie `Instruct: Given a search query, retrieve relevant passages that answer the query` gefolgt von einem Zeilenumbruch und `Query: ` vor Suchanfragen.
- **Chat-Modell** für die Automatisierungsaktion „KI fragen“, begrenzt auf eine einstellbare Zahl von Aufrufen pro Tag (0 schaltet die Aktion ab).

„Verbindung testen“ ruft beide Modelle einmal auf. Inhalte von Vorgängen und Seiten gehen an das eingetragene Modell; wer keine Daten nach außen geben will, betreibt das Modell selbst. Der Schlüssel liegt wie das LDAP-Passwort in der Datenbank und wird nie angezeigt.

Die Suche nach Bedeutung braucht **pgvector** in PostgreSQL. Die mitgelieferte Docker-Compose-Datei bringt es mit; bei einer eigenen Datenbank installiert es ein Superuser einmal mit `CREATE EXTENSION vector`. Ohne die Erweiterung funktioniert die KI-Aktion trotzdem. Wer eine bestehende Installation von `postgres:17-alpine` auf das neue Image umstellt, behält seine Daten (gleiche Basis); ein Wechsel auf das Debian-basierte `pgvector/pgvector:pg17` braucht danach `REINDEX DATABASE`. Die Embeddings gehören nicht zum Backup, sie entstehen nach einer Wiederherstellung neu.

## Apps

Apps erweitern Lenipo um **Panels am Vorgang**, **Wiki-Makros** (im Editor über `/` → „App-Makro“) und **Dashboard-Gadgets**. Sie laufen nicht im Server, sondern als Seiten auf ihrer eigenen Adresse in abgeschotteten iFrames. Administration → Apps installiert eine App aus der Adresse ihres Manifests: Lenipo lädt und prüft es, zeigt die verlangten Rechte und installiert erst nach der Freigabe. „Manifest neu laden“ übernimmt Änderungen; mehr Rechte als bisher brauchen eine neue Freigabe. Ausschalten blendet die App aus, Entfernen beendet zusätzlich sofort alle ihre Tokens.

Das **Manifest** (JSON):

```json
{
  "key": "hallo",
  "name": "Hallo-App",
  "vendor": "Beispiel GmbH",
  "description": "Was die App tut.",
  "baseUrl": "https://app.example.org/",
  "scopes": ["issues:read"],
  "modules": {
    "issuePanels": [{ "key": "info", "title": "Info", "url": "panel.html" }],
    "macros": [{ "key": "chart", "title": "Diagramm", "url": "macro.html" }],
    "gadgets": [{ "key": "kpi", "title": "Kennzahl", "url": "gadget.html" }]
  }
}
```

Die App muss auf einer anderen Adresse als Lenipo laufen, und alle Modul-Adressen liegen auf ihrer eigenen. `scopes` sind die Rechte, mit denen sie im Namen der ansehenden Person handelt (`issues:read`, `issues:write`, `wiki:read`, `wiki:write`; nie `admin`); ohne Scopes bekommt sie keinen API-Zugriff.

Das **Protokoll** läuft über `postMessage`, beide Seiten prüfen die Herkunft:

| Nachricht | Richtung | Inhalt |
| --- | --- | --- |
| `lenipo:ready` | App → Lenipo | Die Seite ist bereit. |
| `lenipo:context` | Lenipo → App | `context`: `app`, `module`, `kind` (`issuePanel`, `macro`, `gadget`), `issueKey`, `projectKey`, `pageId`, `config` (Einstellung von Makro oder Gadget), `user`, `locale`, `theme`. Kommt nach dem Laden und nach `ready`. |
| `lenipo:resize` | App → Lenipo | `height` in Pixeln (40 bis 2.000). |
| `lenipo:token` | App → Lenipo | Bittet um ein Token. |
| `lenipo:token` | Lenipo → App | `accessToken` (15 Minuten gültig, neu anfragen), `expiresIn`, `scopes`, `apiBase`. Die App ruft damit die REST-API mit `Authorization: Bearer …` auf; CORS ist für die Adressen installierter Apps offen. |
| `lenipo:error` | Lenipo → App | `message`, wenn kein Token ausgegeben wurde. |

Die Tokens gehören zu einer Verbindung je Person, die im Profil unter den verbundenen Apps steht und dort widerrufen werden kann. Eine lauffähige Beispiel-App liegt unter `examples/lenipo-app`.

In Automatisierungsregeln führt die Aktion **„Skript ausführen“** JavaScript abgeschottet aus (QuickJS in WebAssembly, höchstens 1 Sekunde und 32 MB, ohne Netz, Dateien und Zeitgeber). Das Skript bekommt `issue`, `data` und `rule`; was es mit `return` zurückgibt, steht den folgenden Aktionen als `{{script.result}}` zur Verfügung. Das Skript selbst ändert nichts.

## E-Mail-Eingang

Projekteinstellungen → Service Desk → E-Mail-Eingang verbindet ein IMAP-Postfach (Server, Port, TLS, Benutzer, Passwort, Ordner, Vorgangstyp). Der Worker liest es jede Minute: Neue Mails werden Vorgänge (Betreff → Zusammenfassung, Text → Beschreibung, Anhänge), Antworten mit einem Vorgangsschlüssel des Projekts im Betreff werden Kommentare ohne das zitierte Original. Absender müssen aktive Konten sein und handeln mit ihren eigenen Rechten; Kunden eines Service Desks stellen so Anfragen. Mails unbekannter Absender, automatische Antworten und eigene Benachrichtigungen bleiben unbearbeitet. Verarbeitete Mails wandern in den „Ordner für Erledigtes“ oder werden als gelesen markiert; jede Message-ID wird nur einmal behandelt. Die letzten Mails und was aus ihnen wurde, stehen unter den Einstellungen.

## PDF-Vorlagen

Administration → PDF-Vorlagen: Titelseite mit Logo (PNG, JPEG oder WebP bis 200 KB), Untertitel, Kopf- und Fußzeile mit den Platzhaltern `{{title}}`, `{{space}}`, `{{date}}`, `{{page}}` und `{{pages}}` sowie eigenes CSS (ohne `@import` und `url()`). Eine Vorlage kann Standard sein; Bereichsadministratoren wählen in den Bereichseinstellungen eine eigene. Gedruckt wird weiterhin im Browser; Kopf- und Fußzeilen erscheinen in Chromium-Browsern (Chrome, Edge).

## Rechte

Globale Rechte hängen an Gruppen (`administrators`, `users` und eigene). Projekte bekommen ein **Berechtigungsschema** (wer was darf, über Projektrollen), ein **Benachrichtigungsschema** und optional ein **Sicherheitsschema** mit Stufen, die einzelne Vorgänge verbergen. Bereiche in Wiki haben eigene Rollen und Seiteneinschränkungen. „Rechte prüfen“ in der Administration erklärt, warum eine Person etwas sehen darf oder nicht.

## Tarif-Rahmen eines Bereitstellers

Hat ein Bereitsteller wie ein Hosting-Dienst einen Rahmen gesetzt, steht er unter Administration → Betrieb: Tarifname, belegte und gebuchte Plätze, Agenten, Speicher für Anhänge, Service Desk und gegebenenfalls Anfragen je Minute. Ist der Rahmen erreicht, lehnt Lenipo das Anlegen, Einladen und Reaktivieren von Personen ab (auch bei Anmeldung per OIDC, SAML und beim Verzeichnis-Sync), ebenso neue Agenten, Anhänge über dem Speicher, neue Service Desks und Module außerhalb des Tarifs, jeweils mit einem Hinweis auf den Tarif. Gäste (externe Personen) und KI-Agenten belegen keine Plätze. Setzt der Tarif Obergrenzen für die Anfragegrenzen, lassen sich die Grenzen je Person, Token und IP nur darunter einstellen; höhere Einstellungen von früher gelten nur bis zur Obergrenze. Ohne Rahmen, also beim eigenen Betrieb, ist nichts begrenzt.

## Sicherung und Wiederherstellung

- **Backups** (Administration → Wartung): ein ZIP mit allen Tabellen und Anhängen im Dateispeicher, täglich zur eingestellten Stunde, die letzten drei bleiben. Von Hand oder per Cronjob: `lenipo admin backup create` und `lenipo admin backup download <id>`, oder ohne Token direkt im Container: `docker compose exec app node api/dist/maintenance/backup-cli.js --out /tmp/lenipo.zip`. Backups gehören zusätzlich außer Haus.
- **Wiederherstellen** geht in eine frische Instanz derselben Version: unter `/setup` den Einrichtungscode eingeben und das ZIP hochladen, oder ohne Web-Oberfläche im Container: `docker compose exec app node api/dist/maintenance/restore-cli.js --in /tmp/lenipo.zip` (die Datei vorher mit `docker compose cp` hineinkopieren). Danach melden sich alle mit ihren alten Konten an.
- **Aufbewahrung:** Papierkorb 30 Tage, Audit-Log 365 Tage, alte Seitenversionen optional ausdünnen, Seitenaufrufe je Person 90 Tage (danach anonyme Zahlen); stündlich im Worker.
- **Archive** einzelner Projekte oder Bereiche (Administration → Import) ziehen Inhalte in eine andere Instanz um.

## Updates

**Versionen und Images:** Lenipo hat eine Versionsnummer nach dem Muster `1.4.0`. Die Images liegen unter `ghcr.io/toolvibes/lenipo`:

| Tag | Inhalt |
| --- | --- |
| `latest` | die neueste bewährte Version: sie lief vorher einige Tage im gehosteten Betrieb ohne Probleme |
| `1` | die neueste bewährte Version der Hauptversion 1 |
| `1.4` | die neueste Version von 1.4, ab dem Erscheinen |
| `1.4.0` | genau diese Version |
| `edge` | die neueste Version überhaupt, auch vor ihrer Bewährung |

Die Docker-Compose-Datei nutzt `latest`; eine feste Version setzt `LENIPO_VERSION=1.4.0`. Im Helm-Chart steht sie in `image.tag`. Was jede Version bringt, steht im Changelog und in den Release-Hinweisen auf GitHub.

**Ablauf:**

1. Release-Hinweise lesen, vor allem den Abschnitt „Update“.
2. Eine Sicherung anlegen (Administration → Wartung oder `backup-cli`).
3. Neues Image holen und starten (`docker compose pull && docker compose up -d`). Migrationen laufen beim Start unter einer Sperre, im Helm-Chart zusätzlich als Job vor dem Update.
4. Mit mehreren Instanzen rollt das Update ohne Ausfall: jede Migration funktioniert noch mit der vorigen Version (erst erweitern, eine Version später aufräumen; `pnpm migrations:check` prüft das).

**Versionen überspringen** geht, solange die Release-Hinweise keine Mindestversion nennen. Nennt eine Version eine (etwa „Updates auf diese Version gehen ab Lenipo 1.3.0“), weil sie Altes aus der Datenbank entfernt, startet sie nicht auf einer älteren Datenbank. Sie meldet dann, auf welche Version zuerst zu aktualisieren ist, statt halb zu migrieren.

**Zurück** auf die vorige Version geht, solange die neue keine aufräumende Migration enthielt; die Release-Hinweise sagen es („Diese Version räumt die Datenbank auf“). Sonst geht es nur über die Sicherung von vor dem Update.

**Hinweis auf neue Versionen:** Administration → Wartung zeigt die laufende Version. Auf Wunsch sieht Lenipo einmal am Tag in der öffentlichen Liste der Versionen auf GitHub nach und zeigt Admins, wenn eine neuere bewährte Version erschienen ist. Das ist standardmäßig aus; außer dieser Abfrage wird nichts gesendet. `UPDATE_CHECK_URL` zeigt bei Bedarf auf eine andere Quelle, etwa einen Spiegel.

**Wartungsmodus** (Administration → Betrieb) lässt nur Admins herein, etwa für größere Arbeiten; ein **Ankündigungsbanner** informiert vorher.

## Betrieb und Überwachung

- **Gesundheit:** `/api/v1/health/live` (Prozess läuft) und `/api/v1/health/ready` (Datenbank erreichbar; beim Herunterfahren sofort 503).
- **Metriken** mit `METRICS_PORT`: HTTP-Dauer je Route, offene Verbindungen, Warteschlangen (`lenipo_backlog`), Alter des ältesten unverarbeiteten Ereignisses (`lenipo_outbox_lag_seconds`), `lenipo_database_up`. Sinnvolle Alarme: `lenipo_database_up == 0`, `lenipo_outbox_lag_seconds > 300`, wachsende Webhook-Warteschlange.
- **Logs** als JSON auf der Standardausgabe, ohne Header und Query-Strings; mit Traces enthalten sie `trace_id`.
- **Module** (Wiki, Boards, Zeiterfassung, Automatisierung, Dashboards) lassen sich abschalten; **Anfragegrenzen** je Person, Token und IP einstellen (Administration → Betrieb).
- **Impressum und Datenschutz** (Administration → Betrieb): Links zu den Seiten der eigenen Organisation. Sie stehen auf der Anmeldeseite, im Service-Portal und unten in der Seitenleiste; ohne eigene gelten `IMPRINT_URL` und `PRIVACY_URL`. Wer Lenipo für andere betreibt, etwa für Service-Desk-Kunden, sollte sie eintragen.
- **Skalierung:** mehrere api- und worker-Instanzen jederzeit; mehrere Collab-Server nur mit `REDIS_URL`.
- **Lasttest** gegen die Qualitätsziele: `pnpm --filter @toolvibes/loadtest loadtest`.

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
