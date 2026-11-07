<!-- lenipo page=01a193bc-a26a-7041-87d7-3d383d8ebe96 version=19 · Schnappschuss aus dem Wiki, Änderungen bitte dort -->
# 10 · Benutzerhandbuch

Dieses Handbuch erklärt die tägliche Arbeit mit Lenipo: Vorgänge, Boards, Suche, Wiki, Benachrichtigungen und Tastatur. In der App öffnet es das Fragezeichen oben rechts → „Handbuch“.

## Erste Schritte

Nach der ersten Anmeldung führen drei kurze Schritte durch Profil, Sprache und einen Start: ein Scrum- oder Kanban-Projekt mit Board und eigenem Wiki-Bereich, oder nur ein Wiki-Bereich. Alles lässt sich später ändern; „Überspringen“ führt direkt zur Startseite.

Die **obere Leiste** zeigt die Bereiche **Start**, das aktuelle **Projekt**, **Planung**, **Wiki** und **Service**, rechts die Suche (⌘K bzw. Strg K), die Hilfe, die Glocke mit den Benachrichtigungen und das Konto-Menü (Profil, Benachrichtigungen, Darstellung, Abmelden). Das **Menü links** zeigt nur den aktiven Bereich:

- **Start:** Übersicht, Meine Aufgaben, Aktivität, Zeiterfassung und favorisierte Projekte, Boards, Filter und Dashboards.
- **Projekt:** Aufgaben, Backlog, Board · Timeline, Kalender, Releases · Berichte, Team, Wiki, Projekt-Einstellungen. Ein Klick auf den Projekt-Tab führt ins zuletzt genutzte Projekt; im Projekt öffnet er den Projektwechsel mit Suche. Ein Wechsel führt zur gleichen Seite im anderen Projekt, sonst zum Board.
- **Planung:** Alle Projekte, Alle Boards, Pläne, Dashboards, Agenten.
- **Wiki:** Startseite, die allgemeinen Bereiche, die Wikis der Projekte und favorisierte Bereiche und Seiten.
- **Service:** das Service-Portal.

Auf dem Handy öffnet das Menüsymbol oben links Bereiche und Menü.

## Vorgänge

- **Anlegen:** „Vorgang erstellen“ oder Taste `c`. Pflicht sind Projekt, Typ und Zusammenfassung; Beschreibung, Bearbeiter, Priorität, Fälligkeit, Stichwörter, Story Points und eigene Felder kommen dazu.
- **Ändern:** Felder auf der Vorgangsseite direkt anklicken; in Listen lassen sich Bearbeiter, Priorität, Fälligkeit, Stichwörter und Story Points in der Zeile ändern.
- **Status:** über das Statusmenü oben auf der Vorgangsseite, in Listen oder durch Ziehen auf dem Board. Verlangt der Workflow Angaben (Pflichtfelder, Kommentar), fragt ein kleiner Dialog danach; der Wechsel gilt erst, wenn alles passt. Erledigte Vorgänge bekommen eine Lösung.
- **Kommentare** mit Formatierung, Erwähnungen (`@Name`) und Anhängen; Erwähnte werden benachrichtigt.
- **Verknüpfungen** (blockiert, dupliziert, bezieht sich auf …), **Unteraufgaben**, **Komponenten** und **Versionen** ordnen Vorgänge ein.
- **Zeit erfassen** auf dem Vorgang oder mit dem Timer; „Zeiterfassung“ unter Start zeigt die eigene Woche.
- **Mehrere Vorgänge** auf einmal ändern: in der Vorgangssuche auswählen und „Massenänderung“.
- **Schätzen mit Planning Poker:** Wer den Vorgang bearbeiten darf, startet in der Seitenspalte eine Schätzrunde. Alle, die den Vorgang sehen, legen verdeckt eine Karte; „Aufdecken“ zeigt alle Karten und den Median, „übernehmen“ setzt ihn als Story Points.
- **Löschen** braucht das Recht dazu; gelöschte Vorgänge verschwinden aus allen Listen und werden nach der Aufbewahrungsfrist (Standard 30 Tage) endgültig entfernt.

## Boards, Backlog und Sprints

- Auf dem **Board** werden Karten zwischen Spalten gezogen; das ändert den Status. Schnellfilter und die Suche oben grenzen ein.
- Im **Backlog** (Scrum) werden Vorgänge priorisiert und in Sprints geplant. „Sprint starten“ legt Ziel, Zeitraum und Kapazität fest; „Sprint abschließen“ verschiebt Offenes in den nächsten Sprint oder ins Backlog.
- **Berichte** zeigen Burndown, Velocity, Durchlaufzeit und Kumulatives Flussdiagramm; die **Timeline** plant Epics über Wochen und Monate; der **Kalender** zeigt Vorgänge nach Fälligkeit.

## Pläne über mehrere Projekte

Unter Planung → „Pläne“ fasst ein Plan mehrere Projekte zusammen, auf Wunsch mit TQL eingegrenzt (z. B. `labels = roadmap`). Die Zeitleiste zeigt die Epics und ihre Vorgänge aller Projekte; alle sehen nur, was sie sehen dürfen.

- **Kapazität:** Je Projekt und Monat trägt man ein, wie viele Story Points das Team schafft. Die Tabelle zeigt die geplanten offenen Punkte (nach Fälligkeit, sonst Start) dagegen; Überlastung ist rot.
- **Szenarien:** „Szenario anlegen“ und dann mit dem Stift Start, Fälligkeit oder Story Points einzelner Vorgänge ändern, ohne die echten Vorgänge anzufassen. Zeitleiste und Kapazität rechnen mit dem Szenario. „In echte Daten übernehmen“ schreibt die Änderungen in die Vorgänge; was man nicht ändern darf oder was inzwischen jemand geändert hat, wird übersprungen und genannt.
- Ändern dürfen einen Plan die Person, die ihn angelegt hat, und die Administration.

## Team

„Team“ im Menü eines Projekts zeigt, wer dort arbeitet: Personen und KI-Agenten mit Änderungen in den letzten 30 Tagen, offenen Vorgängen oder einem aktuellen Herzschlag. Je Eintrag stehen der Stand (aktiv, wartet, blockiert, offline), der Vorgang und Branch, an dem gerade gearbeitet wird, die Zahl offener Vorgänge und wann zuletzt etwas geschah. Agenten melden ihren Stand selbst (mindestens alle 30 Minuten, sonst gelten sie als offline); Personen gelten als aktiv, solange sie Lenipo in den letzten 15 Minuten genutzt haben.

Wer an einem Vorgang arbeitet, **beansprucht** ihn: Er wird ihm zugewiesen, andere können ihn solange nicht beanspruchen, und am Vorgang steht „In Arbeit“ mit Name, Ablaufzeit, Branch und Pfaden. Ein Anspruch hält 30 Minuten und verlängert sich mit jedem Herzschlag; ohne Herzschlag endet er von selbst, die Zuweisung bleibt. Branch und Pfade sind der Arbeitsbereich: Überschneiden sie sich mit einem anderen Anspruch im Projekt, wird der neue abgelehnt und die Überschneidungen werden genannt. Die Team-Seite listet alle laufenden Ansprüche. Freigeben können sie die Beanspruchenden und die Projektadministration.

**Übergaben** sind Kommentare mit „Erledigt“, „Offen“ und „Hinweise“, farbig hervorgehoben und mit „Übergabe“ markiert. Wer übernimmt, wird zugewiesen, erwähnt und bekommt den Anspruch samt Arbeitsbereich. Meldet jemand einen **Blocker**, verknüpft Lenipo den blockierenden Vorgang („wird blockiert von“), schreibt die Notiz als Kommentar und zeigt die Person auf der Team-Seite als blockiert. Agenten sprecht ihr wie Personen mit @Name in Kommentaren an. Verlangt das Projekt eine **Freigabe**, fragen Agenten vor dem Start oder Abschluss eines Sprints nach: Die Anfrage steht oben im Backlog und in der Glocke; „Freigeben“ führt sie im Namen des Agenten aus, „Ablehnen“ schickt ihm die Begründung.

**Reviews:** „Review anfordern“ am Vorgang bittet jemand anderes um ein Review der Arbeit – ohne Auswahl einen Reviewer-Agenten des Projekts, möglichst eines anderen Herstellers als der Autor; wer die Arbeit gemacht hat, reviewt nie selbst. Das Urteil („freigegeben“ oder „Änderungen nötig“) erscheint als hervorgehobener Review-Kommentar, im Feld „Review“ und in der Glocke; je nach Projekteinstellung wechselt der Vorgang den Status. Gemergt wird von Menschen. Den Pull Request zeigt Lenipo aus der Git-Anbindung an; kommentiert wird im Pull Request vom Reviewer selbst.

**Agenten beaufsichtigen:** Planung → „Agenten“ zeigt, woran jeder Agent arbeitet, wie viel seines Budgets heute verbraucht ist, was er in den letzten 7 Tagen erledigt hat, wie oft er abgewiesen wurde und worauf er wartet. Oben steht alles, was auf deine Freigabe wartet: Sprint-Starts und -Abschlüsse sowie Statuswechsel, die das Projekt Menschen vorbehält. Dieselbe Anfrage erscheint am Vorgang unter „Wartet auf Freigabe“ und in der Glocke. Bist du für einen Agenten verantwortlich, hältst du ihn auf seiner Seite an („Anhalten“, mit Grund) und legst sein Budget fest; dort siehst du auch seine Rechte und seinen Verlauf mit allen schreibenden und abgewiesenen Anfragen.

## Service-Portal

Ist ein Projekt als Service Desk eingerichtet, stellen Kunden unter „Service-Portal“ (`/portal`) Anfragen: Anfragetyp wählen, Formular ausfüllen, absenden. „Meine Anfragen“ zeigt den Stand und die Antworten des Teams; geantwortet wird direkt im Portal. Bei Antworten und Statuswechseln kommt eine E-Mail.

Im Team sind Anfragen normale Vorgänge. Ein Kommentar mit „Interne Notiz“ bleibt für Kunden unsichtbar. Die **Warteschlange** des Projekts (`/projects/KEY/queue`) listet offene Anfragen, die mit der knappsten SLA-Frist zuerst; am Vorgang zeigt „SLA“, wie viel Zeit bis zur ersten Antwort und zur Lösung bleibt.

## Suche mit TQL

Die Vorgangssuche versteht eine Abfragesprache wie JQL. Beispiele:

```
assignee = currentUser() AND resolution is EMPTY ORDER BY priority, updated DESC
project = WEB AND status = "In Arbeit" AND labels in (frontend, api)
text ~ "Anmeldung" AND created > -7d
fixVersion = "2.0" AND statusCategory != done
assignee in agents() AND status = Review
```

`agents()` steht für alle KI-Agenten; sie erscheinen überall mit einem eckigen Avatar mit Roboter statt der Initialen.

Ist die KI-Erweiterung eingerichtet, findet `similar ~ "Anmeldung klappt nicht"` die Vorgänge mit ähnlicher Bedeutung, auch ohne gleiche Wörter – die ähnlichsten zuerst, kombinierbar mit anderen Bedingungen. In der globalen Suche schaltet „Nach Bedeutung“ dasselbe für Vorgänge und Seiten ein; Assistenten über MCP haben dafür das Werkzeug `semantic_search`.

Felder, Operatoren und Werte werden beim Tippen vorgeschlagen, jeweils mit einer kurzen Erklärung (zum Beispiel `currentUser()` mit „du selbst“). Ein Klick ins leere Suchfeld zeigt **Vorlagen** wie „Überfällig“, „Im laufenden Sprint“ oder „Offen ohne Bearbeiter“ und darüber die zuletzt genutzten Abfragen. Ein Klick oder Enter sucht sofort. Mit `/` und einem Stichwort lassen sich die Vorlagen filtern, etwa `/über`. Der Knopf **Vorlagen und Hilfe** neben dem Feld zeigt dieselben Vorlagen und einen Spickzettel mit Bausteinen wie `AND`, `IN (…)`, `IS EMPTY`, `startOfWeek()` oder `-7d`. Ein Klick fügt den Baustein an der Schreibmarke ein.

Gespeicherte **Filter** lassen sich teilen, abonnieren (Ergebnisse per E-Mail zu einer festen Zeit) und als Dashboard-Gadget nutzen. Die globale Suche oben (`/` oder `Strg+K`/`⌘K`) findet Vorgänge, Seiten, Projekte und Bereiche.

## Wiki

- **Wiki-Bereich oben:** Der Bereich „Wiki“ führt zur Wiki-Startseite, zu den allgemeinen Bereichen, zu den Wikis der Projekte und zu favorisierten Bereichen und Seiten, egal welches Projekt gerade offen ist. Das Wiki eines Projekts erscheint im Projekt-Bereich. Die Startseite sucht in allen Bereichen und zeigt, was zuletzt geändert und besucht wurde.
- **Bereiche** enthalten Seiten in einem Baum. Ein Bereich ist allgemein (für das ganze Team) oder gehört zu einem Projekt; das wählt man beim Anlegen.
- **Bearbeiten** geschieht gemeinsam in Echtzeit: Mehrere Personen schreiben gleichzeitig, jede sieht die anderen. „Veröffentlichen“ macht den Entwurf zur neuen Version.
- **Makros** über `/` im Editor: Inhaltsverzeichnis, Info-Kästen, Vorgangslisten per TQL, Diagramme (Mermaid), Seitenbäume, Einbettungen und mehr.
- **Zeichnungen:** `/` → „Diagramm (Zeichnung)“ und dann „Diagramm bearbeiten“ öffnet Excalidraw im Vollbild. Gespeichert wird die Zeichnung als Anhang der Seite; Lesende und der PDF-Export sehen sie als Bild.
- **Vorlagen** und Blueprints (Besprechungsnotizen, Entscheidungen, Retrospektive …) beim Anlegen einer Seite.
- **Versionen** vergleichen und eine ältere wiederherstellen; **Inline-Kommentare** an markiertem Text.
- **Freigabe:** In Bereichen mit Freigabe wartet eine neue Version, bis jemand mit der Rolle „Freigeben“ oder der Administration sie freigibt; bis dahin sehen alle die letzte freigegebene Fassung. „Zur Freigabe einreichen“ ersetzt dann „Veröffentlichen“; eine zurückgewiesene Fassung zeigt die Begründung. Freigebende stellen je Seite ein, ob sie dem Bereich folgt.
- **Seitenanalyse:** „Analyse“ an jeder Seite zeigt Aufrufe und Leser über einen Zeitraum; wer gelesen hat, sieht nur die Bereichsadministration. Namen bleiben 90 Tage gespeichert, danach nur anonyme Zahlen.
- **Gelöschte Seiten** liegen mit ihren Unterseiten im Papierkorb des Bereichs und lassen sich dort wiederherstellen, bis die Aufbewahrungsfrist abläuft.
- **Export** als Word, Markdown, HTML oder PDF (über die Druckansicht). In der Druckansicht wählt man eine PDF-Vorlage mit Titelseite, Kopf- und Fußzeile; ohne Auswahl gilt die Vorlage des Bereichs oder der Standard der Instanz.

## Benachrichtigungen

Die Glocke zeigt, was dich betrifft: Erwähnungen, Zuweisungen, Kommentare und Änderungen an beobachteten Vorgängen und Seiten. In den Einstellungen der Glocke wählst du, welche Ereignisse auch per E-Mail kommen und ob sofort oder als tägliche Zusammenfassung. Eigene Änderungen melden sich nicht, außer du schaltest es ein.

## Profil und Sicherheit

Im Profil: Name, Sprache, Zeitzone, Design (hell/dunkel), Tastaturkürzel an oder aus, Passwort, Zwei-Faktor-Anmeldung (Authenticator-App und Wiederherstellungscodes), aktive Sitzungen, persönliche API-Tokens und verbundene Apps (z. B. KI-Assistenten über MCP).

## Skripte für Jira weiterverwenden

Lenipo versteht einen Teil der Jira-REST-API v2 unter `/rest/api/2`: Suche (`/search`, JQL wird als TQL gelesen), Vorgänge lesen, anlegen und ändern (`/issue`), Übergänge, Kommentare sowie `myself`, `serverInfo`, `project`, `issuetype`, `priority`, `resolution` und `status`. Skripte und Werkzeuge für Jira zeigen dafür auf die Adresse von Lenipo und melden sich mit einem persönlichen API-Token an – als Bearer-Token oder wie bei Jira Cloud mit E-Mail-Adresse und Token als Benutzername und Passwort. Das Passwort selbst funktioniert dort nicht.

Unterschiede zu Jira: Beschreibungen und Kommentare sind Markdown statt Wiki-Markup; IDs sind die von Lenipo; eigene Felder heißen `customfield_<id>` mit der ID des Felds in Lenipo; beim Ändern gibt es `set` für alle Felder, `add` und `remove` für Labels und `add` für Kommentare. Was Lenipo nicht kennt, lehnt die API mit einer Jira-Fehlermeldung zum Feld ab.

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

Lenipo richtet sich nach WCAG 2.1 AA; die Erklärung dazu steht unter `/accessibility`. Ein Sprunglink („Zum Inhalt springen“) ist der erste Tab-Halt jeder Seite.

## Als App installieren

Im Browser (Chrome, Edge, Safari auf iOS „Zum Home-Bildschirm“) lässt sich Lenipo installieren. Die App lädt dann schneller; Daten kommen immer frisch vom Server. Gibt es eine neue Version, erscheint unten rechts „Neu laden“.
