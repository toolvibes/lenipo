<!-- lenipo page=01a196b1-4ccb-766b-bac7-296c0a8e1047 version=1 · Schnappschuss aus dem Wiki, Änderungen bitte dort -->
# 13 · Sprint-Agent

Ein Coding-Agent wie Claude Code arbeitet im Code-Repository eines Teams die Aufgaben des aktiven Sprints eines Lenipo-Projekts selbstständig ab (TL-88, E-132). Fragen und Entscheidungen hält er als Kommentar am Vorgang fest; erst wenn Aufgabe, Kommentare und Entscheidung klar sind, setzt er um – auf einem eigenen Branch mit Pull Request, nie direkt auf `main`.

Stand: Prototyp. Er läuft auf dem Rechner einer Entwicklerin oder eines Entwicklers und fragt Lenipo in festen Abständen ab.

## Welche Vorgänge der Agent nimmt

- Nur Vorgänge im **aktiven Sprint** des eingestellten Boards, die nicht erledigt sind,
- und die entweder das Label `agent` tragen oder dem **Konto des Agenten** zugewiesen sind,
- in der Reihenfolge des Sprints (Rang).

Ein Vorgang mit dem Label `agent-question` wartet auf eine Antwort. Er kommt erst wieder dran, wenn nach der letzten Rückfrage des Agenten ein Mensch kommentiert hat; dann entfernt der Agent das Label und arbeitet weiter. Am Workflow muss dafür nichts geändert werden.

## Einrichten

1. **Konto für den Agenten** anlegen (z. B. „Sprint-Agent“), damit im Verlauf klar ist, was der Agent getan hat. Es braucht im Projekt die Rolle „Entwickler“. Als dieses Konto einen persönlichen Zugriffstoken erstellen, nur mit `issues:read` und `issues:write`.
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
| `lenipo agent ask <KEY> <Frage>` | Rückfrage als Kommentar, setzt `agent-question` |

Alles Weitere erledigt der Agent mit den vorhandenen Befehlen (`lenipo issue view|comment|move|edit`) oder den MCP-Werkzeugen.

## Ablauf je Durchgang

1. `lenipo agent next --output json`; ist `task` leer, endet der Durchgang.
2. Vorgang mit Kommentaren lesen.
3. Unklar? `lenipo agent ask` und Ende des Durchgangs, nicht raten.
4. Sonst: Branch `agent/<KEY>-…`, umsetzen, Tests und Prüfungen des Repositorys, Push, Pull Request, Abschlusskommentar mit Zusammenfassung, Entscheidungen und Link, Status „Review“.

## Leitplanken

- Branch und Pull Request statt `main`; ein Mensch prüft und führt zusammen.
- Tests vor jedem Push.
- Höchstens drei Versuche je Vorgang, danach eine Rückfrage.
- Ein Konto mit eingeschränktem Token; keine Geheimnisse in Kommentaren, Commits oder Pull Requests.
- Kosten begrenzt der Coding-Agent selbst (z. B. Intervall der Schleife und Laufzeitgrenzen).

## Später

- **Webhooks statt Abfragen:** Lenipo meldet `issue.updated` und `comment.created` an einen lokalen Runner, der den Agenten anstößt (E-132 sieht das als Option vor).
- Mehrere Agenten auf einem Board, Kostenrahmen in Lenipo, Auswertung der Agenten-Arbeit im Sprintbericht.
