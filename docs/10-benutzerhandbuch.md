<!-- lenipo page=01a193bc-a26a-7041-87d7-3d383d8ebe96 version=3 · Schnappschuss aus dem Wiki, Änderungen bitte dort -->
# 10 · Benutzerhandbuch

Dieses Handbuch erklärt die tägliche Arbeit mit Lenipo: Vorgänge, Boards, Suche, Wiki, Benachrichtigungen und Tastatur. In der App öffnet es der Eintrag „Hilfe“ in der Seitenleiste.

## Erste Schritte

Nach der ersten Anmeldung führen drei kurze Schritte durch Profil, Sprache und einen Start: ein Scrum- oder Kanban-Projekt mit Board und eigenem Wiki-Bereich, oder nur ein Wiki-Bereich. Alles lässt sich später ändern; „Überspringen“ führt direkt zur Startseite.

Die **Seitenleiste** links zeigt Übersicht, Meine Aufgaben, Benachrichtigungen, die Projekte (das aktuelle mit Backlog, Board, Timeline, Berichten, Kalender, Releases und Wiki) und Favoriten. Auf dem Handy öffnet das Menüsymbol oben links die Seitenleiste.

## Vorgänge

- **Anlegen:** „Vorgang erstellen“ oder Taste `c`. Pflicht sind Projekt, Typ und Zusammenfassung; Beschreibung, Bearbeiter, Priorität, Fälligkeit, Stichwörter, Story Points und eigene Felder kommen dazu.
- **Ändern:** Felder auf der Vorgangsseite direkt anklicken; in Listen lassen sich Bearbeiter, Priorität, Fälligkeit, Stichwörter und Story Points in der Zeile ändern.
- **Status:** über das Statusmenü oben auf der Vorgangsseite, in Listen oder durch Ziehen auf dem Board. Verlangt der Workflow Angaben (Pflichtfelder, Kommentar), fragt ein kleiner Dialog danach; der Wechsel gilt erst, wenn alles passt. Erledigte Vorgänge bekommen eine Lösung.
- **Kommentare** mit Formatierung, Erwähnungen (`@Name`) und Anhängen; Erwähnte werden benachrichtigt.
- **Verknüpfungen** (blockiert, dupliziert, bezieht sich auf …), **Unteraufgaben**, **Komponenten** und **Versionen** ordnen Vorgänge ein.
- **Zeit erfassen** auf dem Vorgang oder mit dem Timer; „Zeiterfassung“ in der Seitenleiste zeigt die eigene Woche.
- **Mehrere Vorgänge** auf einmal ändern: in der Vorgangssuche auswählen und „Massenänderung“.
- **Löschen** braucht das Recht dazu; gelöschte Vorgänge verschwinden aus allen Listen und werden nach der Aufbewahrungsfrist (Standard 30 Tage) endgültig entfernt.

## Boards, Backlog und Sprints

- Auf dem **Board** werden Karten zwischen Spalten gezogen; das ändert den Status. Schnellfilter und die Suche oben grenzen ein.
- Im **Backlog** (Scrum) werden Vorgänge priorisiert und in Sprints geplant. „Sprint starten“ legt Ziel, Zeitraum und Kapazität fest; „Sprint abschließen“ verschiebt Offenes in den nächsten Sprint oder ins Backlog.
- **Berichte** zeigen Burndown, Velocity, Durchlaufzeit und Kumulatives Flussdiagramm; die **Timeline** plant Epics über Wochen und Monate; der **Kalender** zeigt Vorgänge nach Fälligkeit.

## Suche mit TQL

Die Vorgangssuche versteht eine Abfragesprache wie JQL. Beispiele:

```
assignee = currentUser() AND resolution is EMPTY ORDER BY priority, updated DESC
project = WEB AND status = "In Arbeit" AND labels in (frontend, api)
text ~ "Anmeldung" AND created > -7d
fixVersion = "2.0" AND statusCategory != done
```

Felder, Operatoren und Werte werden beim Tippen vorgeschlagen. Gespeicherte **Filter** lassen sich teilen, abonnieren (Ergebnisse per E-Mail zu einer festen Zeit) und als Dashboard-Gadget nutzen. Die globale Suche oben (`/` oder `Strg+K`/`⌘K`) findet Vorgänge, Seiten, Projekte und Bereiche.

## Wiki

- **Bereiche** enthalten Seiten in einem Baum; jedes Projekt kann einen eigenen Bereich haben.
- **Bearbeiten** geschieht gemeinsam in Echtzeit: Mehrere Personen schreiben gleichzeitig, jede sieht die anderen. „Veröffentlichen“ macht den Entwurf zur neuen Version.
- **Makros** über `/` im Editor: Inhaltsverzeichnis, Info-Kästen, Vorgangslisten per TQL, Diagramme (Mermaid), Seitenbäume, Einbettungen und mehr.
- **Vorlagen** und Blueprints (Besprechungsnotizen, Entscheidungen, Retrospektive …) beim Anlegen einer Seite.
- **Versionen** vergleichen und eine ältere wiederherstellen; **Inline-Kommentare** an markiertem Text.
- **Gelöschte Seiten** liegen mit ihren Unterseiten im Papierkorb des Bereichs und lassen sich dort wiederherstellen, bis die Aufbewahrungsfrist abläuft.
- **Export** als Word, Markdown, HTML oder PDF (über die Druckansicht).

## Benachrichtigungen

Die Glocke zeigt, was dich betrifft: Erwähnungen, Zuweisungen, Kommentare und Änderungen an beobachteten Vorgängen und Seiten. In den Einstellungen der Glocke wählst du, welche Ereignisse auch per E-Mail kommen und ob sofort oder als tägliche Zusammenfassung. Eigene Änderungen melden sich nicht, außer du schaltest es ein.

## Profil und Sicherheit

Im Profil: Name, Sprache, Zeitzone, Design (hell/dunkel), Tastaturkürzel an oder aus, Passwort, Zwei-Faktor-Anmeldung (Authenticator-App und Wiederherstellungscodes), aktive Sitzungen, persönliche API-Tokens und verbundene Apps (z. B. KI-Assistenten über MCP).

## Tastaturkürzel

`?` zeigt alle Kürzel. Die wichtigsten:

| Taste | Wirkung |
| --- | --- |
| `/` oder `Strg+K`/`⌘K` | Suche und Befehle |
| `c` | Vorgang anlegen |
| `g` dann `h` / `p` / `i` / `b` / `w` / `a` | Startseite / Projekte / Vorgangssuche / Boards / Wiki / Aktivität |
| `j` / `k` | In Listen nach unten / oben |
| `a` / `i` / `w` / `m` | Auf der Vorgangsseite: Bearbeiter wählen / mir zuweisen / beobachten / kommentieren |

Wer mit Spracheingabe oder Schaltern arbeitet, kann die Einzeltasten-Kürzel im Profil abschalten.

## Barrierefreiheit

Lenipo richtet sich nach WCAG 2.1 AA; die Erklärung dazu steht unter `/accessibility` und in [Kapitel 4](04-plattform-admin.md). Ein Sprunglink („Zum Inhalt springen“) ist der erste Tab-Halt jeder Seite.

## Als App installieren

Im Browser (Chrome, Edge, Safari auf iOS „Zum Home-Bildschirm“) lässt sich Lenipo installieren. Die App lädt dann schneller; Daten kommen immer frisch vom Server. Gibt es eine neue Version, erscheint unten rechts „Neu laden“.
