# Deutsche Schulferien API

[![Deployment status from DeployBot](https://fuxdev.deploybot.com/badge/77558060233260/207735.svg)](https://deploybot.com)
[![License: CC BY-SA 4.0](https://licensebuttons.net/l/by-sa/4.0/80x15.png)](https://creativecommons.org/licenses/by-sa/4.0/)

## Einleitung

Die Schulferien aller Bundesländer in Deutschland werden hier bereitgestellt.

## Endpunkte

Es können alle Schulferien nach Jahr oder nach Jahr und Bundesland abgerufen werden

Beispiel:
nach Jahr 2022
https://ferien-api.maxleistner.de/api/v1/2022/

nach Jahr 2022 und Bundesland Bayern
https://ferien-api.maxleistner.de/api/v1/2022/BY/

## Bundesland-Codes

| BW  | Baden-Württemberg      |
| --- | ---------------------- |
| BY  | Bayern                 |
| BE  | Berlin                 |
| BB  | Brandenburg            |
| HB  | Bremen                 |
| HH  | Hamburg                |
| HE  | Hessen                 |
| MV  | Mecklenburg-Vorpommern |
| NI  | Niedersachsen          |
| NW  | Nordrhein-Westfalen    |
| RP  | Rheinland-Pfalz        |
| SL  | Saarland               |
| SN  | Sachsen                |
| ST  | Sachsen-Anhalt         |
| SH  | Schleswig-Holstein     |
| TH  | Thüringen              |

## Verfügbare Jahre

- 2022
- 2023
- 2024
- 2025
- 2026
- 2027

## Entwicklung

### Installation

```bash
# LTS Node.js Version verwenden (empfohlen für beste Unterstützung)
nvm install --lts && nvm use

# Abhängigkeiten installieren
npm install
```

### API starten

```bash
# Server im Produktionsmodus starten
npm start

# Server mit automatischem Neustart bei Änderungen (Entwicklungsmodus)
npm run dev
```

### API testen

```bash
# Alle Ferien für ein bestimmtes Jahr
curl "http://localhost:3000/api/v1/2024/"

# Ferien für ein bestimmtes Jahr und Bundesland (Bayern)
curl "http://localhost:3000/api/v1/2024/BY/"

# Alternative: Schleswig-Holstein
curl "http://localhost:3000/api/v1/2024/SH/"
```

## Automatisierte Tests

Diese API verfügt über eine umfassende Testsuite mit über 80 Tests, die alle Funktionen abdeckt.

### Test-Befehle

```bash
# Alle Tests ausführen
npm test

# Tests mit Coverage-Report
npm run test:coverage

# Tests im Watch-Modus (entwicklung)
npm run test:watch

# Spezifische Testsuiten
npm run test:api          # API-Endpunkt-Tests
npm run test:data         # Datenvalidierungs-Tests
npm run test:routes       # Route-Unit-Tests
```

### Was wird getestet?

#### API-Funktionalität
- ✅ Alle Endpunkte (`GET /api/v1/:year` und `GET /api/v1/:year/:state`)
- ✅ Gültige Anfragen für alle verfügbaren Jahre (2024-2027)
- ✅ Alle 16 deutschen Bundesländer
- ✅ Fehlerbehandlung für ungültige Parameter
- ✅ CORS-Unterstützung
- ✅ HTTP-Methoden-Validierung

#### Datenvalidierung
- ✅ JSON-Struktur und Datentypen
- ✅ ISO 8601 Datumsformat (`YYYY-MM-DDTHH:mmZ`)
- ✅ Bundesland-Codes (BW, BY, BE, etc.)
- ✅ Ferientypen (winterferien, osterferien, pfingstferien, sommerferien, herbstferien, weihnachtsferien)
- ✅ Slug-Format (`ferientype-jahr-bundesland`)
- ✅ Datumslogik (Start ≤ Ende)
- ✅ Vollständigkeit aller Bundesländer

#### Qualitätssicherung
- ✅ Keine übermäßigen Duplikate
- ✅ Vernünftige Feriendauern
- ✅ Korrekte Monate für Ferientypen
- ✅ Konsistenz zwischen Jahren
- ✅ Hamburg's spezielle Namenskonvention (`fruehjahrsferien`)

#### Performance & Robustheit
- ✅ Gleichzeitige Anfragen
- ✅ Antwortzeiten unter 1 Sekunde
- ✅ Fehlerbehandlung bei fehlenden Dateien
- ✅ JSON-Parse-Fehler-Behandlung

### Testausführung

Beispiel einer erfolgreichen Testausführung:

```bash
$ npm test

 PASS  tests/api.test.js
 PASS  tests/data-validation.test.js
 PASS  tests/routes.test.js

Test Suites: 3 passed, 3 total
Tests:       88 passed, 88 total
Snapshots:   0 total
Time:        0.729 s
```

## Datenqualität

### Kürzlich behobene Probleme

- ✅ **Baden-Württemberg 2027**: Fehlerhaft als `winterferien` klassifizierte März-Ferien wurden zu `osterferien` korrigiert
- ✅ **Datenvalidierung**: Umfassende Tests für alle Jahre und Bundesländer implementiert
- ✅ **Konsistenzprüfung**: Automatische Erkennung von Datenanomalien

### Neue Jahresberechnungen hinzufügen

Um Feriendaten für ein neues Jahr hinzuzufügen:

1. Erstelle eine neue JSON-Datei: `routes/years/YYYY.json`
2. Folge der bestehenden Datenstruktur (siehe Abschnitt unten)
3. Die API erkennt automatisch neue Jahresbereiche und stellt sie bereit
4. Führe Tests aus: `npm test` um die Datenqualität zu überprüfen

### Datenstruktur

Jeder Ferieneintrag enthält:

```json
{
  "start": "2024-07-25T00:00Z",
  "end": "2024-09-08T00:00Z",
  "year": 2024,
  "stateCode": "BW",
  "name": "sommerferien",
  "slug": "sommerferien-2024-BW"
}
```

**Wichtige Hinweise:**
- Alle Daten im ISO 8601 Format mit UTC-Zeitzone
- Bundesland-Codes sind zweistellige Abkürzungen in Großbuchstaben
- Ferientypen verwenden deutsche Namen
- Hamburg verwendet `fruehjahrsferien` statt `osterferien`
- Slugs folgen dem Format `ferientyp-jahr-bundesland`

## Unterstützung gerne gesehen

Solltest du die API auch nutzen wollen, findest aber Fehler oder es fehlen Daten, melde dich gerne und stelle einen Merge-Request mit der Anpassung. Die Dateien für die jeweiligen Jahre findest du unter `routes/years`

**Vor dem Einreichen von Änderungen:**
1. Führe die Tests aus: `npm test`
2. Überprüfe die Datenqualität: `npm run test:data`
3. Stelle sicher, dass alle API-Endpunkte funktionieren: `npm run test:api`

Verbesserungsvorschläge, Wünsche,... gerne gesehen.

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/V7V8GDFQJ)
