# Deutsche Schulferien API

![Vercel Deploy](https://deploy-badge.vercel.app/vercel/deutsche-schulferien-api?style=for-the-badge&logo=schulferien-api)
[![License: CC BY-SA 4.0](https://licensebuttons.net/l/by-sa/4.0/80x15.png)](https://creativecommons.org/licenses/by-sa/4.0/)

> **⚠️ WICHTIGER HINWEIS - DOMAIN-ÄNDERUNG**
> 
> **Die API ist ab sofort unter der neuen Domain verfügbar: `https://schulferien-api.de`**
> 
> Die alte Domain `ferien-api.maxleistner.de` bleibt noch einige Monate aktiv, wird aber langfristig abgeschaltet. Bitte aktualisieren Sie Ihre Anwendungen auf die neue Domain.
> 
> **Neu:** `https://schulferien-api.de/api/v1/2024/BY`  
> **Alt:** `https://ferien-api.maxleistner.de/api/v1/2024/BY` (noch aktiv)

## Einleitung

Die Schulferien aller Bundesländer in Deutschland werden hier bereitgestellt.

Die API bietet zwei Versionen:
- **V1 (Legacy)**: Ursprüngliche API für Abwärtskompatibilität
- **V2 (Enhanced)**: Erweiterte API mit fortgeschrittenen Filtermöglichkeiten und neuen Features

## 🆕 V2 API (Enhanced) - Neu!

Die V2 API erweitert die ursprüngliche Funktionalität um leistungsstarke Filter- und Suchfunktionen.

### 📚 Interactive Documentation
**Swagger UI**: https://schulferien-api.de/docs · **OpenAPI-Spezifikation**: https://schulferien-api.de/docs/openapi.json

### 🔍 Erweiterte Filterung

#### Jahresbasierte Abfrage mit Filtern
```bash
# Alle Ferien für ein Jahr
curl "https://schulferien-api.de/api/v2/2024/"

# Nach Datumsbereich filtern
curl "https://schulferien-api.de/api/v2/2024?from=2024-03-01&to=2024-08-31"

# Nach Ferientypen filtern
curl "https://schulferien-api.de/api/v2/2024?type=sommerferien,winterferien"

# Nach Bundesländern filtern
curl "https://schulferien-api.de/api/v2/2024?states=BY,BW,BE"

# Nur bestimmte Felder zurückgeben
curl "https://schulferien-api.de/api/v2/2024?fields=start,end,name,name_cp,stateCode"

# Kombinierte Filter
curl "https://schulferien-api.de/api/v2/2024?type=sommerferien&states=BY&fields=start,end,name"
```

#### Bundesland mit Filtern
```bash
# Ferien für Bayern mit zusätzlichen Filtern
curl "https://schulferien-api.de/api/v2/2024/BY?type=sommerferien"
curl "https://schulferien-api.de/api/v2/2024/BY?from=2024-07-01&to=2024-08-31"
```

### 🎯 Spezielle Endpunkte

#### Aktuelle Ferien
```bash
# Alle aktuell laufenden Ferien
curl "https://schulferien-api.de/api/v2/current"

# Aktuelle Ferien nur für Bayern
curl "https://schulferien-api.de/api/v2/current?states=BY"
```

#### Kommende Ferien
```bash
# Ferien in den nächsten 30 Tagen
curl "https://schulferien-api.de/api/v2/next/30"

# Kommende Ferien nur für bestimmte Bundesländer
curl "https://schulferien-api.de/api/v2/next/60?states=BY,BW"
```

#### Datum prüfen
```bash
# Prüfen ob ein bestimmtes Datum Ferien sind
curl "https://schulferien-api.de/api/v2/date/2024-07-25"

# Nur für bestimmte Bundesländer prüfen
curl "https://schulferien-api.de/api/v2/date/2024-07-25?states=BY,BW"
```

#### Suche
```bash
# Nach Ferientyp suchen
curl "https://schulferien-api.de/api/v2/search?q=sommer"

# Suche mit Jahr einschränken
curl "https://schulferien-api.de/api/v2/search?q=ferien&year=2024"

# Suche mit Bundesland einschränken
curl "https://schulferien-api.de/api/v2/search?q=sommer&states=BY"
```

#### Statistiken
```bash
# Ferienstatistiken für ein Jahr
curl "https://schulferien-api.de/api/v2/stats/2024"
```

#### Jahresvergleich
```bash
# Zwei Jahre vergleichen
curl "https://schulferien-api.de/api/v2/compare/2024/2025"
```

### 🔧 System-Endpunkte

```bash
# Gesundheitsstatus (für Load Balancer)
curl "https://schulferien-api.de/health"

# Bereitschaftsstatus
curl "https://schulferien-api.de/ready"

# Detaillierter Systemstatus
curl "https://schulferien-api.de/status"
```

### 📋 Unterstützte Query Parameter

| Parameter | Beschreibung | Beispiel |
|-----------|--------------|----------|
| `from` | Start-Datum (YYYY-MM-DD) | `from=2024-03-01` |
| `to` | End-Datum (YYYY-MM-DD) | `to=2024-08-31` |
| `type` | Ferientypen (kommagetrennt) | `type=sommerferien,winterferien` |
| `states` | Bundesland-Codes (kommagetrennt) | `states=BY,BW,BE` |
| `fields` | Gewünschte Felder (kommagetrennt) | `fields=start,end,name` |
| `q` | Suchbegriff | `q=sommer` |
| `year` | Jahr (nur bei Suche) | `year=2024` |

### 🎯 Gültige Werte

**Ferientypen**:
- `winterferien`, `osterferien`, `pfingstferien`, `sommerferien`, `herbstferien`, `weihnachtsferien`
- `fruehjahrsferien` (z. B. Hamburg, statt `osterferien`)
- `variabler_ferientag` (einzelne bewegliche Ferientage, z. B. Berlin/Brandenburg)

Mehrere Werte können kommagetrennt (`states=BY,BW`) oder als wiederholter Parameter (`states=BY&states=BW`) übergeben werden.

**Felder**:
- `start`, `end`, `year`, `stateCode`, `name`, `name_cp`, `slug`

---

## 📜 V1 API (Legacy)

Die ursprüngliche API bleibt für Abwärtskompatibilität verfügbar.

### Endpunkte

```bash
# Alle Ferien für ein Jahr
curl "https://schulferien-api.de/api/v1/2024/"

# Ferien für ein Jahr und Bundesland
curl "https://schulferien-api.de/api/v1/2024/BY/"
```

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
- 2028
- 2029 (Thüringen: Herbst- und Weihnachtsferien folgen)

## Entwicklung

### Installation

```bash
# Node.js 24 verwenden (wie auf Vercel)
nvm install 24 && nvm use 24

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
# V1 API (Legacy)
curl "http://localhost:3000/api/v1/2024/"
curl "http://localhost:3000/api/v1/2024/BY/"

# V2 API (Enhanced) - mit erweiterten Filtern
curl "http://localhost:3000/api/v2/2024?type=sommerferien&states=BY"
curl "http://localhost:3000/api/v2/current"
curl "http://localhost:3000/api/v2/date/2024-07-25"

# System-Endpunkte
curl "http://localhost:3000/health"
curl "http://localhost:3000/docs" # Swagger UI
```

## Automatisierte Tests

Diese API verfügt über eine umfassende Testsuite, die alle V1- und V2-Funktionen abdeckt. Die Tests laufen bei jedem Push und Pull Request automatisch über GitHub Actions.

### Test-Befehle

```bash
# Alle Tests ausführen
npm test

# Tests mit Coverage-Report
npm run test:coverage

# Tests im Watch-Modus (entwicklung)
npm run test:watch

# Spezifische Testsuiten
npm run test:api          # V1 API-Endpunkt-Tests
npm run test:v2           # V2 API-Endpunkt-Tests
npm run test:filters      # Filter-Utility-Tests
npm run test:system       # System-Endpunkt-Tests
npm run test:data         # Datenvalidierungs-Tests
```

### Was wird getestet?

#### API-Funktionalität
- ✅ Alle Endpunkte (`GET /api/v1/:year` und `GET /api/v1/:year/:state`)
- ✅ Gültige Anfragen für alle verfügbaren Jahre
- ✅ Alle 16 deutschen Bundesländer
- ✅ Fehlerbehandlung für ungültige Parameter
- ✅ CORS-Unterstützung
- ✅ HTTP-Methoden-Validierung

#### Datenvalidierung
- ✅ JSON-Struktur und Datentypen
- ✅ ISO 8601 Datumsformat (`YYYY-MM-DDTHH:mmZ`)
- ✅ Bundesland-Codes (BW, BY, BE, etc.)
- ✅ Ferientypen (winterferien, fruehjahrsferien, osterferien, pfingstferien, sommerferien, herbstferien, weihnachtsferien, variabler_ferientag)
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

## Datenqualität

### Kürzlich behobene Probleme

- ✅ **Enddatum-Format korrigiert (Breaking Change)**: Enddaten zeigen jetzt den tatsächlichen letzten Ferientag um 23:59Z (inklusiv) statt den Folgetag um 00:00Z. Insgesamt wurden 590 Einträge in den Jahren 2022–2027 angepasst
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
  "end": "2024-09-07T23:59Z",
  "year": 2024,
  "stateCode": "BW",
  "name": "sommerferien",
  "name_cp": "Sommerferien",
  "slug": "sommerferien-2024-BW"
}
```

**Wichtige Hinweise:**
- Alle Daten im ISO 8601 Format mit UTC-Zeitzone
- Das Enddatum `end` ist **inklusiv** und repräsentiert den letzten Ferientag um 23:59Z (UTC)
- Bundesland-Codes sind zweistellige Abkürzungen in Großbuchstaben
- Ferientypen verwenden deutsche Namen
- Hamburg verwendet `fruehjahrsferien` statt `osterferien`
- Slugs folgen dem Format `ferientyp-jahr-bundesland`

**Migration:** Entfernen Sie ggf. clientseitige Workarounds wie "end - 1 Tag", da das Enddatum jetzt korrekt den letzten Ferientag anzeigt.

## Unterstützung gerne gesehen

Solltest du die API auch nutzen wollen, findest aber Fehler oder es fehlen Daten, melde dich gerne und stelle einen Merge-Request mit der Anpassung. Die Dateien für die jeweiligen Jahre findest du unter `routes/years`

**Vor dem Einreichen von Änderungen:**
1. Führe die Tests aus: `npm test`
2. Überprüfe die Datenqualität: `npm run test:data`
3. Stelle sicher, dass alle API-Endpunkte funktionieren: `npm run test:api`

Verbesserungsvorschläge, Wünsche,... gerne gesehen.

## 🆕 Version 2.0 - Was ist neu?

### Neue Features
- ✨ **V2 API** mit erweiterten Filterfunktionen
- 🔍 **Erweiterte Suche** nach Ferientypen und Bundesländern
- 📅 **Datumsbereiche** für präzise Abfragen
- 📊 **Statistiken** und Jahresvergleiche
- 🎯 **Aktuelle/Kommende Ferien** Endpunkte
- 🔧 **Gesundheitschecks** für Load Balancer
- 📚 **Swagger UI** für interaktive Dokumentation
- ⚡ **Performance-Optimierungen** durch In-Memory-Caching
- 🧪 **Robuste Tests** mit über 160 Testfällen

### Abwärtskompatibilität
👍 **Vollständig abwärtskompatibel**: Alle V1-Endpunkte funktionieren unverändert.

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/V7V8GDFQJ)
