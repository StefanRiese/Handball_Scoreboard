# 🤾 Handball Scoreboard

Eine schlanke Web-App zum Verfolgen des Spielstands bei Handballspielen – optimiert für die Nutzung auf dem Smartphone (iPhone und Android). Ohne Installation aus dem App Store, läuft direkt im Browser oder als Web-App auf dem Home-Bildschirm.

## Features

### Spielstand-Tracking
- Zwei Teams nebeneinander, jeweils mit großem „+"-Button zum Tore zählen
- Spielstand groß in der jeweiligen Teamfarbe
- Karten immer gleich breit und hoch
- Kurzes haptisches Feedback (Vibration) bei jedem Tor

### Tore korrigieren
- „− 1" / „+ 1"-Buttons pro Team für versehentliche Eingaben
- Kein negativer Spielstand möglich

### Teamnamen
- Durch Antippen direkt bearbeitbar
- Lange Namen brechen automatisch um
- Voreinstellung: „TuS Griesheim" (rot) vs. „Gast" (blau)

### Teamfarben
- 6 Schnellauswahl-Farben (Rot, Grün, Blau, Weiß, Gelb, Orange)
- Zusätzliches Farbmenü mit 30 Farben
- Sehr helle oder sehr dunkle Farben werden für Team-Name und Spielstand automatisch kontrastreich angepasst (je nach Theme)

### Seitenwechsel
- ⇄-Button tauscht beide Teams manuell (Name, Farbe, Tore)
- Nützlich zur Halbzeit – bewusst nicht automatisch

### Historie
- Spiele speichern mit Datum, Uhrzeit, Endstand und Gewinner
- Eigener Tab zur Übersicht aller gespeicherten Spiele
- Einzelne Einträge löschbar
- Komplette Historie mit einem Klick löschbar (mit Bestätigung)
- Dauerhaft im Browser gespeichert

### Design
- Umschaltbares dunkles / helles Theme (Einstellung wird gespeichert)

## Mobile-Optimierung
- Große, touch-freundliche Buttons mit Druck-Feedback
- Zoom (Doppeltipp & Pinch) deaktiviert
- Seite fixiert gegen versehentliches Verschieben
- Bildschirm bleibt während des Spiels wach (Wake Lock API, iOS 16.4+, mit zusätzlichem Fallback für installierte Home-Bildschirm-Apps; in den Einstellungen abschaltbar)
- Angepasstes, kompakteres Layout im Querformat (z. B. für Schiedsrichter mit Smartphone im Landscape-Modus)
- Als Web-App mit eigenem Icon installierbar – auf dem iPhone über „Zum Home-Bildschirm", auf Android/Chrome direkt über den Installations-Hinweis des Browsers (Web App Manifest)
- Bedienelemente mit Screenreader-Beschriftungen (aria-label) für symbolbasierte Buttons

## Offline-Nutzung
Nach dem ersten Laden funktioniert die App dank Service Worker auch komplett ohne Internetverbindung.

## Installation auf dem iPhone
1. Die App-URL in **Safari** öffnen
2. **Teilen-Button** antippen
3. **„Zum Home-Bildschirm"** wählen
4. Fertig – die App startet im Vollbild und funktioniert offline

## Installation auf Android
1. Die App-URL in **Chrome** öffnen
2. Auf den Installations-Hinweis tippen (oder **Menü → „App installieren"** wählen)
3. Fertig – die App erscheint als eigenes Icon auf dem Home-Bildschirm und funktioniert offline

## Deployment via GitHub Pages
1. `index.html`, `handball_icon.png` und `manifest.json` ins Repository-Root hochladen
2. **Settings → Pages → Source:** „Deploy from a branch", Branch `main`, Ordner `/ (root)`
3. Nach kurzer Zeit ist die App erreichbar unter:
   `https://<username>.github.io/<repository>`

## Technik
- Reines HTML, CSS und JavaScript – keine Frameworks, keine Build-Tools
- Eine einzige `index.html`-Datei
- Datenspeicherung über `localStorage`
- Offline-Support über einen Service Worker
- Bildschirm-Wachhaltung über die Wake Lock API, mit stummem Video-Loop als Fallback für Home-Bildschirm-Apps auf iOS
- Web App Manifest (`manifest.json`) für die Installation auf Android/Chrome

## Lizenz
Privates Projekt – frei zur eigenen Nutzung und Anpassung.
