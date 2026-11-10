# Barrierefreiheit

Lenipo soll für alle benutzbar sein: mit Tastatur, Screenreader, Vergrößerung und auf dem Handy. Jede Instanz zeigt diese Erklärung auch unter `/accessibility`.

## Ziel

Lenipo richtet sich nach den [Web Content Accessibility Guidelines (WCAG) 2.1](https://www.w3.org/TR/WCAG21/), Stufe AA.

## Unterstützte Umgebungen

- Aktuelle Versionen von Chrome, Edge, Firefox und Safari, auf dem Desktop und auf dem Handy; Lenipo lässt sich auch als App installieren.
- Screenreader wie NVDA, JAWS oder VoiceOver. Lenipo baut auf semantischem HTML und ARIA auf.
- Bedienung allein mit der Tastatur: Ein Sprunglink („Zum Inhalt springen“) ist der erste Tab-Halt jeder Seite, die Tastenkürzel stehen im [Benutzerhandbuch](docs/10-benutzerhandbuch.md#tastaturkürzel) und lassen sich im Profil abschalten.
- Vergrößerung im Browser und schmale Fenster bis zur Handybreite; helles und dunkles Design.
- Oberfläche auf Deutsch und Englisch.

## Wie wir das prüfen

- Jede Änderung durchläuft in der CI End-to-End-Tests mit [axe-core](https://github.com/dequelabs/axe-core) auf den wichtigsten Seiten. Schwere Verstöße halten eine Änderung auf.
- Neue Oberflächen prüfen wir zusätzlich von Hand mit Tastatur und Screenreader.

## Bekannte Lücken

- Auf Boards und in der Seitenstruktur ist Ziehen und Ablegen der bequemste Weg. Status, Sprint und übergeordnete Seite lassen sich auch über Felder und Menüs ändern, die Reihenfolge per Tastatur aber noch nicht überall.
- Diagramme (Mermaid, Berichte) haben Textalternativen nur, wenn sie beim Anlegen ergänzt werden.
- Eingebettete Inhalte anderer Anbieter liegen außerhalb unserer Kontrolle.

## Barrieren melden

Wenn dich etwas behindert, [melde es als Issue](https://github.com/toolvibes/lenipo/issues/new?template=barriere.yml). Bitte nenne die Seite, was du tun wolltest und welche Hilfsmittel du benutzt (Browser, Screenreader, Vergrößerung). Barrieren behandeln wir wie Fehler.

Wer Lenipo im eigenen Unternehmen nutzt, kann Barrieren auch der eigenen Administration melden; sie gibt sie an uns weiter.
