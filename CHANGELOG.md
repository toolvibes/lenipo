# Changelog

Alle Versionen von Lenipo; die neueste oben.

## 1.2.1 – 2026-11-05

### Behoben

- Installation per Docker Compose startet ohne S3-Schlüssel, Einstellungen per .env (deploy/.env.example)

## 1.2.0 – 2026-11-05

### Neu

- Projekt beim Anlegen vorbelegt, Board für neue Scrum- und Kanban-Projekte, Vorgänge in einen neuen Start-Status verschieben
- Projekte archivieren und löschen (Papierkorb), mit Rückfrage zu verknüpften Wiki-Bereichen
- Neue Navigation: obere Leiste mit Bereichen, Bereichsmenü links, Projektwechsler

## 1.1.1 – 2026-11-04

### Neu

- Wiki-Seiten nutzen die volle Breite statt einer festen Zeilenlänge

## 1.1.0 – 2026-11-04

### Neu

- Neues Erscheinungsbild: Violett, weiche Schatten statt Rahmen, große Rundungen, Plus Jakarta Sans

## 1.0.3 – 2026-11-04

### Behoben

- Release erhöht auch die Version der Python-SDK, damit die SDK-Prüfung grün bleibt
- Lange Wiki-Seiten lassen sich veröffentlichen (JSON bis 10 MB statt 100 KB)

## 1.0.2 – 2026-11-04

Keine Änderungen an Funktionen.

## 1.0.1 – 2026-11-04

### Neu

- Verständliche Fehlerseiten statt „Something went wrong“
- Obergrenzen für Anfragegrenzen, letzte Nutzung und Wiederherstellung ohne Web-Oberfläche
- Links zu Impressum und Datenschutzerklärung der eigenen Organisation
- Hinweis des Anbieters und Link zum Support

### Behoben

- Rechtliche Links in der Seitenleiste über dem Profil, damit sie sichtbar bleiben
- Willkommens-Schritt 3 fragt nach dem Namen des ersten Projekts oder Wiki-Bereichs
- OAuth-Metadaten für MCP auch ohne Accept: application/json als JSON ausliefern

## 1.0.0 – 2026-11-03

Erste veröffentlichte Version. Was Lenipo kann, steht im Benutzer- und im Admin-Handbuch.
