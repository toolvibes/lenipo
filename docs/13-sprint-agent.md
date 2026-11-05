<!-- lenipo page=01a196b1-4ccb-766b-bac7-296c0a8e1047 version=9 · Schnappschuss aus dem Wiki, Änderungen bitte dort -->
# 13 · Sprint-Agent

Ein Coding-Agent wie Claude Code arbeitet im Code-Repository eines Teams die Aufgaben des aktiven Sprints eines Lenipo-Projekts selbstständig ab. Fragen und Entscheidungen hält er als Kommentar am Vorgang fest; erst wenn Aufgabe, Kommentare und Entscheidung klar sind, setzt er um – auf einem eigenen Branch mit Pull Request, nie direkt auf `main`.

Er läuft auf dem Rechner einer Entwicklerin oder eines Entwicklers oder auf einem Server. Den Coding-Agenten startet entweder ein Mensch in einer Schleife oder der Runner `lenipo agent run`, der mehrere Agenten parallel betreibt (siehe „Runner für mehrere Agenten“).

## Welche Vorgänge der Agent nimmt

- Nur Vorgänge im **aktiven Sprint** des eingestellten Boards, die nicht erledigt sind,
- und die entweder das Label `agent` tragen oder dem **Konto des Agenten** zugewiesen sind,
- in der Reihenfolge des Sprints (Rang).

Ein Vorgang mit dem Label `agent-question` wartet auf eine Antwort. Er kommt erst wieder dran, wenn nach der letzten Rückfrage des Agenten ein Mensch kommentiert hat; dann entfernt der Agent das Label und arbeitet weiter. Am Workflow muss dafür nichts geändert werden.

## Einrichten

1. **Agent anlegen:** Administration → Agenten → „Agent anlegen“ (z. B. „Sprint-Agent“, Werkzeug „Claude Code“), damit im Verlauf klar ist, was der Agent getan hat. Er braucht im Projekt die Rolle „Entwickler“. Die verantwortliche Person erstellt unter Profil → „Meine Agenten“ einen Token, nur mit `issues:read` und `issues:write`.
2. Im Code-Repository anmelden und einrichten:

   ```bash
   lenipo login https://lenipo.example.org --token <lp_pat_…>
   lenipo agent init --project WEB
   ```

   `init` sucht das Scrum-Board des Projekts (oder nimmt `--board <id>`) und schreibt diese Dateien:
   - `.lenipo/agent.json`: Projekt, Board, Label (`agent`) und Rückfrage-Label (`agent-question`)
   - `.lenipo/agent-prompt.md`: die Anweisungen für den Coding-Agenten (Ablauf und Leitplanken)
   - `.lenipo/runner.json` (nur wenn noch keine da ist): eine Vorlage für den Runner

   Die Dateien gehören ins Repository; das Token nicht (es liegt im Profil unter `~/.config/lenipo`). In CI ersetzen `LENIPO_URL` und `LENIPO_TOKEN` das Profil.
3. Den Agenten starten: mit `lenipo agent run` (unten) oder von Hand, z. B. in Claude Code mit einer Schleife alle 15 Minuten und dem Inhalt von `.lenipo/agent-prompt.md` als Auftrag.

## Befehle

| Befehl | Wirkung |
| --- | --- |
| `lenipo agent init --project <KEY> [--board <id>] [--label agent] [--question-label agent-question]` | Einrichtung im aktuellen Ordner |
| `lenipo agent next [--output json]` | Nennt den nächsten Vorgang (`task`), oder nichts; ist der Agent angehalten oder das Budget verbraucht, steht in `stop` der Grund (`paused`, `budget`) |
| `lenipo agent ask <KEY> <Frage>` | Rückfrage als Kommentar, setzt `agent-question` und meldet den Agenten als wartend |
| `lenipo agent status active\|waiting\|blocked\|offline [--issue <KEY>] [--branch <Name>] [--note <Text>]` | Herzschlag: Stand und woran der Agent arbeitet; `offline` beendet die Arbeit am Vorgang |
| `lenipo agent team [--project <KEY>] [--output json]` | Wer im Projekt arbeitet, mit Stand, Vorgang und Branch |
| `lenipo agent claim [<KEY>] [--branch <Name>] [--path <Ordner> …] [--force] [--filter <TQL>]` | Beansprucht den Vorgang (ohne Schlüssel den nächsten passenden des Projekts) und weist ihn dem Agenten zu; scheitert, wenn jemand anderes daran arbeitet oder sich Branch oder Pfade mit einem anderen Anspruch überschneiden |
| `lenipo agent release <KEY>` | Gibt den Anspruch frei |
| `lenipo agent handover <KEY> --done <Text> [--open <Text>] [--notes <Text>] [--to <E-Mail>]` | Übergabe als ein Kommentar; mit `--to` übernimmt die Person oder der Agent Zuweisung und Anspruch, sonst endet der eigene Anspruch |
| `lenipo agent blocked <KEY> --note <Text> [--by <KEY>]` | Blocker melden: Verknüpfung, Kommentar, Stand „blockiert“ |
| `lenipo agent inbox [--read] [--output json]` | Ungelesene Benachrichtigungen (Erwähnungen, Zuweisungen, Kommentare); `--read` markiert sie als gelesen |
| `lenipo agent review-request <KEY> [--reviewer <E-Mail>]` | Review anfordern; ohne `--reviewer` wählt Lenipo einen Reviewer-Agenten, bevorzugt eines anderen Herstellers |
| `lenipo agent reviews [--output json]` | Reviews, die auf einen warten, mit Pull Request |
| `lenipo agent review <KEY> --approve\|--changes --body <Text>` | Urteil abgeben: Review-Kommentar am Vorgang, Nachricht an den Anfragenden, Status nach Projektregel |
| `lenipo agent usage [--cost <Betrag>] [--output json]` | Budget-Verbrauch heute und im Monat; mit `--cost` meldet der Runner die Kosten eines Laufs |
| `lenipo agent run [--once] [--every <Minuten>] [--listen <Port>] [--dry-run]` | Runner: startet die Agenten aus `.lenipo/runner.json`, wenn es Arbeit gibt, jeden in seinem Worktree |
| `lenipo agent watch` | Gibt jede neue Benachrichtigung sofort als JSON-Zeile aus (Ereignis-Strom), verbindet sich nach Abbrüchen neu |

Über MCP heißen sie `set_status`, `get_team`, `claim_task`, `claim_next_task`, `release_task`, `handover`, `report_blocker`, `get_inbox`, `mark_read`, `request_review`, `get_review_queue`, `submit_review` und `report_usage`; `whoami` nennt Pause und Budget-Stand; die Teamliste gibt es auch als Ressource `lenipo://project/<KEY>/team`.

Alles Weitere erledigt der Agent mit den vorhandenen Befehlen (`lenipo issue view|comment|move|edit`) oder den MCP-Werkzeugen.

## Ablauf je Durchgang

1. `lenipo agent next --output json`; ist `task` leer: `lenipo agent status offline`, Ende des Durchgangs.
2. Vorgang mit Kommentaren lesen.
3. Unklar? `lenipo agent ask` und Ende des Durchgangs, nicht raten.
4. Sonst: Branch `agent/<KEY>-…`, `lenipo agent claim <KEY> --branch … --path …` (scheitert es, Vorgang nicht anfassen und Durchgang beenden), `lenipo agent status active --issue <KEY> --branch …` (bei langer Arbeit alle 15 Minuten wiederholen), umsetzen, Tests und Prüfungen des Repositorys, Push, Pull Request, Abschlusskommentar mit Zusammenfassung, Entscheidungen und Link, Status „Review“, `lenipo agent handover <KEY> --done … --open …` (beendet den Anspruch), `lenipo agent status offline`. Kommt der Agent nicht weiter: `lenipo agent blocked <KEY> --note …`.
5. `lenipo agent inbox`: Erwähnungen beantworten, Erledigtes mit `--read` abhaken.

## Reviewer-Agent

Ein Agent mit der Rolle **Reviewer** arbeitet in seiner Schleife `lenipo agent reviews` ab: Pull Request mit den eigenen Git-Werkzeugen lesen (z. B. `gh pr diff`), Befunde im Pull Request kommentieren, dann `lenipo agent review <KEY> --approve` oder `--changes --body "<Befunde>"`. Lenipo schreibt nicht in den Git-Host. Der Umsetzer fordert das Review nach dem Pull Request mit `lenipo agent review-request <KEY>` an; bei „Änderungen nötig“ geht der Vorgang je nach Projektregel zurück in Arbeit.

## Rollen und Selbstverwaltung

Je Projekt bekommen Agenten Rollen (Projekteinstellungen → Agenten). Der Sprint-Agent oben ist ein **Umsetzer** – das gilt auch ohne Rolle. Ein **Planer** zerlegt Stories (`create_issue` mit übergeordnetem Vorgang), schätzt mit den anderen Agenten im Planning Poker (`estimate`, `reveal_estimates`, dann Story Points mit `update_issue`), füllt den Sprint (`create_sprint`, `move_to_sprint`) und startet ihn (`start_sprint`). Ein **Koordinator** schließt ihn ab (`complete_sprint`) und schreibt den Bericht (`get_sprint_report`, dann eine Wiki-Seite). Verlangt das Projekt eine Freigabe, warten Start und Abschluss auf eine Person; das Ergebnis kommt als Benachrichtigung (`get_inbox`). Agenten ohne passende Rolle bekommen 403.

## Leitplanken

- Branch und Pull Request statt `main`; ein Mensch prüft und führt zusammen.
- Tests vor jedem Push.
- Höchstens drei Versuche je Vorgang, danach eine Rückfrage.
- Ein Konto mit eingeschränktem Token; keine Geheimnisse in Kommentaren, Commits oder Pull Requests.

## Aufsicht durch Menschen

- **Not-Aus:** Die verantwortliche Person oder ein Admin hält einen Agenten auf seiner Seite (Planung → Agenten) an, die Projektadministration alle Agenten eines Projekts (Projekteinstellungen → Agenten). Der Agent darf dann nur noch lesen: Schreiben beantwortet Lenipo mit **423** und dem Grund, seine Ansprüche enden, sein Webhook ruht, `lenipo agent next` meldet `stop: paused`. Bei 423 hört der Agent sofort auf.
- **Budget:** Grenzen je Tag und Monat (UTC) für neu beanspruchte Vorgänge, Minuten mit Anspruch (aus den Herzschlägen) und Kosten. Kosten meldet der Runner nach jedem Lauf (`lenipo agent usage --cost 0.42` oder MCP `report_usage`), in der Währung, in der das Budget eingetragen ist. Bei 80 % und 100 % bekommt die verantwortliche Person eine Nachricht. Ist eine Grenze erreicht, antwortet das Beanspruchen mit **409** (`budget-exceeded`); bereits beanspruchte Arbeit darf der Agent beenden.
- **Freigabepunkte:** In den Projekteinstellungen lassen sich Status festlegen, die nur Menschen setzen (z. B. „Erledigt“). Verschiebt der Agent dorthin, antwortet Lenipo mit **202** und einer wartenden Anfrage (`lenipo issue move` meldet „wartet auf Freigabe“); eine Person mit dem Recht, Vorgänge zu verschieben, gibt frei (der Vorgang wechselt im Namen des Agenten) oder lehnt mit Begründung ab. Das Ergebnis kommt in die Inbox. Nicht erneut versuchen.
- **Verlauf:** Jede schreibende und jede abgewiesene Anfrage des Agenten (REST und MCP) steht 90 Tage in seinem Verlauf, zusammen mit Änderungen, Kommentaren, Reviews und Freigaben. Die Seite „Agenten“ zeigt für alle Agenten Stand, Vorgang, Budget heute, Erledigtes und Fehlversuche der letzten 7 Tage und offene Rückfragen; die Seite eines Agenten zusätzlich Budget, Rechte (Gruppen, Projekte mit Berechtigungen und Rollen, Tokens) und den Verlauf.

## Runner für mehrere Agenten

`lenipo agent run` im Code-Repository betreibt mehrere Agenten gleichzeitig, auch von verschiedenen Herstellern. Welche, steht in `.lenipo/runner.json`:

```json
{
  "base": "main",
  "every": 15,
  "agents": [
    { "name": "claude", "adapter": "claude-code", "profile": "claude", "slots": 2,
      "args": ["--permission-mode", "acceptEdits"], "webhookSecretEnv": "LENIPO_HOOK_CLAUDE" },
    { "name": "codex", "adapter": "codex", "profile": "codex", "args": ["--full-auto"] },
    { "name": "gemini", "adapter": "gemini", "tokenEnv": "LENIPO_TOKEN_GEMINI", "args": ["--yolo"] },
    { "name": "aider", "adapter": "command", "profile": "aider",
      "command": ["aider", "--yes", "--message", "{prompt}"], "timeoutMinutes": 30 }
  ]
}
```

- **Adapter:** `claude-code` startet `claude -p <Prompt> --output-format json`, `codex` startet `codex exec <Prompt>`, `gemini` startet `gemini -p <Prompt>`, `command` eine eigene Befehlszeile, in der `{prompt}` für den Prompt steht. `args` hängt Optionen an, etwa für Rechte des Werkzeugs; welche ein Werkzeug ohne Rückfragen braucht, steht in seiner Doku. Ein Durchgang endet nach `timeoutMinutes` (Standard 60).
- **Zugang:** Jeder Agent hat sein eigenes Konto und Token. Das Token liegt nie im Repository, sondern in einem CLI-Profil (`lenipo login https://lenipo.example.org --profile claude --token <lp_pat_…>`) oder in einer Umgebungsvariable (`tokenEnv`, die Adresse dann aus `LENIPO_URL`). Der Runner gibt dem gestarteten Werkzeug `LENIPO_URL` und `LENIPO_TOKEN` seines Agenten mit, so handelt `lenipo` darin als dieser Agent.
- **Auslöser:** beim Start, alle `every` Minuten (oder `--every`), bei jeder neuen Benachrichtigung im Ereignis-Strom des Agenten und, mit `--listen <Port>`, beim Webhook des Agenten an `http://<Runner>:<Port>/<name>`. Webhooks ohne gültige Signatur (Geheimnis in der Variablen aus `webhookSecretEnv`) weist der Runner ab; ohne öffentliche Adresse genügen Zeitplan und Ereignis-Strom.
- **Nur bei Arbeit:** Vor jedem Start fragt der Runner nach dem nächsten Vorgang des Agenten (wie `lenipo agent next`). Gibt es keinen, startet er das Werkzeug nur für eine neue Nachricht in der Inbox. Angehaltene Agenten startet er nicht; ist das Budget verbraucht, nur für eigene, schon beanspruchte Vorgänge. Ein Auslöser, während alle Plätze arbeiten, wird vorgemerkt und danach nachgeholt.
- **Parallel:** `slots` Vorgänge je Agent gleichzeitig, jeder Platz mit eigenem Git-Worktree unter `.lenipo/worktrees/<name>-<n>`. Vor jedem Durchgang holt der Runner den Stand von `origin` und setzt einen sauberen Worktree auf `base`; hat er offene Änderungen, setzt der Agent dort fort. Zwei Plätze bekommen nie denselben Vorgang; der Prompt nennt den Vorgang des Durchgangs.
- **Protokoll und Kosten:** Jeder Durchgang schreibt seine Ausgabe nach `.lenipo/runs/<name>/`. Worktrees und Protokolle schließt `.lenipo/.gitignore` aus. Die Kosten eines Durchgangs mit Claude Code liest der Runner aus dessen JSON-Ausgabe und meldet sie selbst; bei anderen Werkzeugen meldet der Agent sie laut Prompt mit `lenipo agent usage --cost`.
- **Ausprobieren:** `lenipo agent run --once --dry-run` zeigt, was gestartet würde. Auf einem Server läuft der Runner genauso, z. B. als Dienst mit `lenipo agent run --listen 8787`.

## Später

- Auswertung der Agenten-Arbeit im Sprintbericht.
