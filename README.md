# Deutsche Schulferien API

![Vercel Deploy](https://deploy-badge.vercel.app/vercel/deutsche-schulferien-api?style=for-the-badge&logo=schulferien-api)
[![License: CC BY-SA 4.0](https://licensebuttons.net/l/by-sa/4.0/80x15.png)](https://creativecommons.org/licenses/by-sa/4.0/)

Kostenlose API mit den Schulferien aller 16 Bundesländer – ohne API-Key, ohne Registrierung.

**API:** https://schulferien-api.de · **Interaktive Doku:** https://schulferien-api.de/docs · **OpenAPI:** https://schulferien-api.de/docs/openapi.json

> **⚠️ Alte Domain:** `ferien-api.maxleistner.de` ist veraltet und wird abgeschaltet. Bitte stellen Sie auf `https://schulferien-api.de` um – die Pfade bleiben gleich.

## Schnellstart

```bash
# Alle Ferien eines Jahres
curl "https://schulferien-api.de/api/v2/2026"

# Ferien eines Bundeslands
curl "https://schulferien-api.de/api/v2/2026/BY"

# Sommerferien in Bayern und Baden-Württemberg, nur bestimmte Felder
curl "https://schulferien-api.de/api/v2/2026?type=sommerferien&states=BY,BW&fields=start,end,name_cp,stateCode"

# Welche Ferien laufen gerade? Welche beginnen in den nächsten 30 Tagen?
curl "https://schulferien-api.de/api/v2/current?states=BY"
curl "https://schulferien-api.de/api/v2/next/30"

# Ist ein Tag ein Ferientag?
curl "https://schulferien-api.de/api/v2/date/2026-07-25?states=BY"
```

Alle Endpunkte und Parameter sind in der [interaktiven Dokumentation](https://schulferien-api.de/docs) beschrieben und dort direkt ausprobierbar.

## Endpunkte

| Endpunkt | Beschreibung |
|---|---|
| `GET /api/v2/{jahr}` | Alle Ferien eines Jahres, filterbar |
| `GET /api/v2/{jahr}/{land}` | Ferien eines Bundeslands, filterbar |
| `GET /api/v2/current` | Heute laufende Ferien (deutsche Ortszeit) |
| `GET /api/v2/next/{tage}` | Ferien, die in den nächsten 1–365 Tagen beginnen |
| `GET /api/v2/date/{datum}` | Prüft, ob ein Datum (YYYY-MM-DD) ein Ferientag ist |
| `GET /api/v2/search?q=…` | Suche nach Ferientyp, Slug oder Bundesland |
| `GET /api/v2/stats/{jahr}` | Statistiken eines Jahres |
| `GET /api/v2/compare/{jahrA}/{jahrB}` | Vergleich zweier Jahre |
| `GET /api/v2/ical/{land}.ics` | Kalender-Abo eines Bundeslands (iCalendar) |
| `GET /api/v1/{jahr}` · `GET /api/v1/{jahr}/{land}` | Ursprüngliche API, unverändert verfügbar |
| `GET /health` · `/ready` · `/status` | Systemstatus |

**Filter** (v2): `from`/`to` (Datumsbereich, YYYY-MM-DD), `type` (Ferientypen), `states` (Bundesländer), `fields` (Feldauswahl). Mehrere Werte kommagetrennt (`states=BY,BW`) oder als wiederholter Parameter (`states=BY&states=BW`).

**Fehler** kommen als JSON mit passendem Statuscode (`400` ungültige Eingabe, `404` nichts gefunden bzw. Jahr ohne Daten):

```json
{ "error": { "message": "…", "statusCode": 404, "documentation": "/docs" } }
```

## 📅 Kalender abonnieren

Jedes Bundesland gibt es als abonnierbaren Kalender mit allen verfügbaren Jahren – neue Jahre erscheinen automatisch:

```
https://schulferien-api.de/api/v2/ical/BY.ics
```

- **Google Kalender:** Weitere Kalender → „Per URL hinzufügen“ → URL einfügen
- **Apple Kalender / Outlook:** `webcal://schulferien-api.de/api/v2/ical/BY.ics` öffnen oder als Internetkalender abonnieren
- Optional nur bestimmte Ferientypen: `…/ical/BY.ics?type=sommerferien,herbstferien`

## Daten

### Format

```json
{
  "start": "2026-08-03T00:00Z",
  "end": "2026-09-14T23:59Z",
  "year": 2026,
  "stateCode": "BY",
  "name": "sommerferien",
  "name_cp": "Sommerferien",
  "slug": "sommerferien-2026-BY"
}
```

- `start` ist der erste, `end` der **letzte** Ferientag (inklusiv, 23:59Z). Die Daten sind Kalendertage in Deutschland.
- Weihnachtsferien gehören zum Jahr, in dem sie beginnen.
- Ein Ferientyp kann pro Land mehrfach vorkommen (z. B. Herbstferien plus einzelner Brückentag); `slug` ist daher nicht eindeutig.

### Ferientypen

`winterferien`, `osterferien`, `pfingstferien`, `sommerferien`, `herbstferien`, `weihnachtsferien`, `variabler_ferientag`

- Einzelne Ferientage (z. B. Brückentage) haben den Typ der Spalte, in der die KMK sie führt – der Freitag nach Himmelfahrt ist also `pfingstferien`, Brückentage um den 1. Mai sind `osterferien`.
- Hamburgs Frühjahrsferien stehen bei der KMK unter „Ostern/Frühjahr“ und sind daher `osterferien`. (`fruehjahrsferien` wird als Filter weiterhin akzeptiert, kommt in den Daten aber nicht mehr vor.)
- `variabler_ferientag` gibt es nur in Brandenburg: Diese Tage gelten, soweit die Schulkonferenz nichts anderes festlegt.
- Bewegliche Ferientage, die jede Schule selbst festlegt (z. B. in BW, NW, RP), sind nicht enthalten.

### Bundesländer

| Code | Land | Code | Land |
|---|---|---|---|
| BW | Baden-Württemberg | NI | Niedersachsen |
| BY | Bayern | NW | Nordrhein-Westfalen |
| BE | Berlin | RP | Rheinland-Pfalz |
| BB | Brandenburg | SL | Saarland |
| HB | Bremen | SN | Sachsen |
| HH | Hamburg | ST | Sachsen-Anhalt |
| HE | Hessen | SH | Schleswig-Holstein |
| MV | Mecklenburg-Vorpommern | TH | Thüringen |

### Verfügbare Jahre

2022 bis 2029. Für Thüringen fehlen noch die Herbst- und Weihnachtsferien 2029.

### Quellen

Die Termine stammen aus den Ferienlisten der [Kultusministerkonferenz](https://www.kmk.org/service/ferien.html) und den Ferienverordnungen der Länder. Sonderregelungen einzelner Inseln (z. B. Sylt, Föhr, Amrum) sind nicht abgebildet.

## Entwicklung

```bash
# Node.js 24 verwenden (wie auf Vercel)
nvm install 24 && nvm use 24

npm install
npm run dev    # startet auf http://localhost:3000 und lädt bei Änderungen neu
npm test       # alle Tests; laufen auch bei jedem Push über GitHub Actions
```

Einzelne Testsuiten: `npm run test:api`, `test:v2`, `test:filters`, `test:system`, `test:data`, `test:ical`.

### Neues Jahr hinzufügen

1. `routes/years/JJJJ.json` im obigen Format anlegen (Länder in derselben Reihenfolge wie die anderen Jahre, innerhalb eines Landes chronologisch).
2. `npm test` ausführen – die Datenvalidierung prüft automatisch jedes Jahr.
3. Startseite, Doku und Kalender übernehmen das neue Jahr ohne weitere Änderungen.

## Mitmachen

Fehler gefunden oder fehlen Daten? Gerne ein Issue oder einen Pull Request mit der Anpassung in `routes/years` – bitte mit Quelle (KMK oder Kultusministerium) und vorher `npm test` ausführen.

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/V7V8GDFQJ)
