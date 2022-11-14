# Schulferien API

## Einleitung

Die Schulferien aller Bundesländer in Deutschland werden hier bereitgestellt.

## Abruf-URLs

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

## Unterstützung gerne gesehen

Solltest du die API auch nutzen wollen, findest aber Fehler oder es fehlen Daten, melde dich gerne und stelle einen Merge-Request mit der Anpassung. Die Dateien für die jeweiligen Jahre findest du unter `routes/years`
Verbesserungsvorschläge, Wünsche,... gerne gesehen.
