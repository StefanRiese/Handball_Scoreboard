# 🤾 Handball Scoreboard

Eine schlanke Web-App zum Verfolgen des Spielstands bei Handballspielen – optimiert für die Nutzung auf dem iPhone. Ohne Installation aus dem App Store, läuft direkt im Browser oder als Web-App auf dem Home-Bildschirm.

## Features

### Spielstand-Tracking
- Zwei Teams nebeneinander, jeweils mit großem „+"-Button zum Tore zählen
- Spielstand groß in der jeweiligen Teamfarbe
- Karten immer gleich breit und hoch

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
- Alle Farben für dunklen Hintergrund optimiert

### Seitenwechsel
- ⇄-Button tauscht beide Teams manuell (Name, Farbe, Tore)
- Nützlich zur Halbzeit – bewusst nicht automatisch

### Historie
- Spiele speichern mit Datum, Uhrzeit, Endstand und Gewinner
- Eigener Tab zur Übersicht aller gespeicherten Spiele
- Einzelne Einträge löschbar
- Dauerhaft im Browser gespeichert

### Design
- Umschaltbares dunkles / helles Theme (Einstellung wird gespeichert)

## iPhone-Optimierung
- Große, touch-freundliche Buttons mit Druck-Feedback
- Zoom (Doppeltipp & Pinch) deaktiviert
- Seite fixiert gegen versehentliches Verschieben
- Bildschirm bleibt während des Spiels wach (Wake Lock API, iOS 16.4+)
- Als Web-App mit eigenem Icon installierbar

## Offline-Nutzung
Nach dem ersten Laden funktioniert die App dank Service Worker auch komplett ohne Internetverbindung.

## Installation auf dem iPhone
1. Die App-URL in **Safari** öffnen
2. **Teilen-Button** antippen
3. **„Zum Home-Bildschirm"** wählen
4. Fertig – die App startet im Vollbild und funktioniert offline

## Deployment via GitHub Pages
1. `index.html` und `handball_icon.png` ins Repository-Root hochladen
2. **Settings → Pages → Source:** „Deploy from a branch", Branch `main`, Ordner `/ (root)`
3. Nach kurzer Zeit ist die App erreichbar unter:
   `https://<username>.github.io/<repository>`

## Technik
- Reines HTML, CSS und JavaScript – keine Frameworks, keine Build-Tools
- Eine einzige `index.html`-Datei
- Datenspeicherung über `localStorage`
- Offline-Support über einen Service Worker
- Bildschirm-Wachhaltung über die Wake Lock API

## Lizenz
Privates Projekt – frei zur eigenen Nutzung und Anpassung.# Handball_Scoreboard
