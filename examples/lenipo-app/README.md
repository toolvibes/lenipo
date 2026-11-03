# Beispiel-App für Lenipo

Eine App aus zwei statischen Dateien: `lenipo-app.json` beschreibt sie, `app.html` ist Panel am Vorgang, Wiki-Makro und Dashboard-Gadget zugleich.

```bash
cd examples/lenipo-app
python3 -m http.server 5190
```

Dann in Lenipo unter Administration → Apps `http://localhost:5190/lenipo-app.json` eintragen, prüfen, die Rechte freigeben und installieren. Das Protokoll steht im Admin-Handbuch unter „Apps“.
