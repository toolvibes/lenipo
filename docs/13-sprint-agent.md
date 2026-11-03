<!-- lenipo page=01a196b1-4ccb-766b-bac7-296c0a8e1047 version=7 · Schnappschuss aus dem Wiki, Änderungen bitte dort -->
# 13 · Sprint-Agent

Ein Coding-Agent wie Claude Code arbeitet im Code-Repository eines Teams die Aufgaben des aktiven Sprints eines Lenipo-Projekts selbstständig ab. Fragen und Entscheidungen hält er als Kommentar am Vorgang fest; erst wenn Aufgabe, Kommentare und Entscheidung klar sind, setzt er um – auf einem eigenen Branch mit Pull Request, nie direkt auf `main`.

Stand: Prototyp. Er läuft auf dem Rechner einer Entwicklerin oder eines Entwicklers und fragt Lenipo in festen Abständen ab.

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

   `init` sucht das Scrum-Board des Projekts (oder nimmt `--board <id>`) und schreibt zwei Dateien:
   - `.lenipo/agent.json`: Projekt, Board, Label (`agent`) und Rückfrage-Label (`agent-question`)
   - `.lenipo/agent-prompt.md`: die Anweisungen für den Coding-Agenten (Ablauf und Leitplanken)

   Beide Dateien gehören ins Repository; das Token nicht (es liegt im Profil unter `~/.config/lenipo`). In CI ersetzen `LENIPO_URL` und `LENIPO_TOKEN` das Profil.
3. Den Agenten starten, z. B. in Claude Code mit einer Schleife alle 15 Minuten und dem Inhalt von `.lenipo/agent-prompt.md` als Auftrag.

## Befehle

| Befehl | Wirkung |
| --- | --- |
| `lenipo agent init --project <KEY> [--board <id>] [--label agent] [--question-label agent-question]` | Einrichtung im aktuellen Ordner |
| `lenipo agent next [--output json]` | Nennt den nächsten Vorgang (`task`), oder nichts |
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
| `lenipo agent watch` | Gibt jede neue Benachrichtigung sofort als JSON-Zeile aus (Ereignis-Strom), verbindet sich nach Abbrüchen neu |

Über MCP heißen sie `set_status`, `get_team`, `claim_task`, `claim_next_task`, `release_task`, `handover`, `report_blocker`, `get_inbox`, `mark_read`, `request_review`, `get_review_queue` und `submit_review`; die Teamliste gibt es auch als Ressource `lenipo://project/<KEY>/team`.

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
- Kosten begrenzt der Coding-Agent selbst (z. B. Intervall der Schleife und Laufzeitgrenzen).

## Später

- **Ohne Abfragen in festen Abständen:** Benachrichtigungen kommen schon jetzt über `lenipo agent watch` (Ereignis-Strom `GET /api/v1/me/events`) oder einen Webhook beim Agenten (Administration → Agenten → Tokens, oder Profil → Meine Agenten). Ein Runner, der den Agenten damit anstößt, folgt.
- Mehrere Agenten auf einem Board, Kostenrahmen in Lenipo, Auswertung der Agenten-Arbeit im Sprintbericht.
