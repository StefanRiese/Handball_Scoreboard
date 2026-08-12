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
- ⇄-Button tauscht, welches Team links und welches rechts angezeigt wird
- Name, Farbe und Tore bleiben dabei fest dem jeweiligen Team zugeordnet
- Die Team-Karten in den Einstellungen tauschen dabei ebenfalls die Seite, sodass die Reihenfolge dort immer zur Spielansicht passt
- Optional automatisch bei jedem Halbzeitwechsel (Einstellung, standardmäßig aus)
- Kurze Bestätigung nach dem Tausch

### Spielernummern erfassen
- Optional in den Einstellungen aktivierbar (standardmäßig aus)
- Bei jedem Tor öffnet sich ein Ziffernblock mit großen Tasten zur schnellen Eingabe der Trikotnummer
- Das Tor zählt immer sofort – Eingabe überspringen oder daneben tippen lässt das Tor ohne zugeordnete Nummer stehen
- In der Historie über den 👕-Button pro Spiel einsehbar: Anzahl Tore je Spielernummer, getrennt nach Team

### Historie
- Spiele speichern mit Datum, Uhrzeit, Halbzeit- und Endstand sowie Gewinner
- Eigener Tab zur Übersicht aller gespeicherten Spiele
- Einträge nachträglich bearbeitbar (Teamnamen, Spielstand, Datum & Uhrzeit)
- Einzelne Einträge löschbar
- Komplette Historie mit einem Klick löschbar (mit Bestätigung)
- Historie als JSON-Datei exportierbar (Backup oder Weiterverarbeitung außerhalb der App)
- Dauerhaft im Browser gespeichert

### Teilen
- Ergebnis eines gespeicherten Spiels per WhatsApp teilen oder als Text in die Zwischenablage kopieren (zum Einfügen in eine beliebige andere App)
- App selbst per WhatsApp teilen oder als QR-Code zum Scannen mit einem anderen Handy anzeigen
- WhatsApp-Teilen lässt sich in den Einstellungen deaktivieren (die Kopieren-Option bleibt davon unabhängig immer verfügbar)

### Design
- Umschaltbares dunkles / helles Theme (Einstellung wird gespeichert)
- Dezenter Farbverlauf in der Teamfarbe auf den Spiel-Karten, per Einstellung abschaltbar
- Weiche Schatten statt harter Kanten auf Karten, einheitliche Eckenradien und Abstände
- Kurzer Puls-Effekt auf dem Spielstand bei jedem Tor
- Sichtbarer Fokusring bei Tastatur-/Screenreader-Navigation

## Mobile-Optimierung
- Große, touch-freundliche Buttons mit Druck-Feedback
- Zoom (Doppeltipp & Pinch) deaktiviert
- Seite fixiert gegen versehentliches Verschieben
- Bildschirm bleibt während des Spiels wach (Wake Lock API), inkl. Reaktivierung bei jeder Berührung für höhere Zuverlässigkeit
- Angepasstes, kompakteres Layout im Querformat (z. B. für Schiedsrichter mit Smartphone im Landscape-Modus)
- Als Web-App mit eigenem Icon installierbar – direkt über den Button in den Einstellungen (Android: echter Installations-Dialog; iOS: kurze Anleitung, da Apple hier keine automatische Installation erlaubt)
- Bedienelemente mit Screenreader-Beschriftungen (aria-label) für symbolbasierte Buttons

## Offline-Nutzung
Nach dem ersten Laden funktioniert die App dank Service Worker auch komplett ohne Internetverbindung.

## Updates
Die App prüft nicht automatisch im Hintergrund auf neue Versionen – das würde während eines laufenden Spiels unerwartet Inhalte verändern. Über „🔄 Nach Updates suchen" in den Einstellungen lässt sich jederzeit manuell prüfen, ob eine neuere Version vorliegt. Auch der Service Worker selbst aktualisiert seinen Cache nur, wenn diese Prüfung explizit ausgelöst wird – ein bloßes Öffnen der App mit Internetverbindung reicht nicht aus, um im Hintergrund neue Inhalte zu laden.

## Installation auf dem iPhone
Am einfachsten über **„📲 Zum Home-Bildschirm hinzufügen"** in den Einstellungen der App – zeigt direkt die passende Anleitung an. Alternativ manuell:
1. Die App-URL in **Safari** öffnen
2. **Teilen-Button** antippen
3. **„Zum Home-Bildschirm"** wählen
4. Fertig – die App startet im Vollbild und funktioniert offline

## Installation auf Android
Am einfachsten über **„📲 Zum Home-Bildschirm hinzufügen"** in den Einstellungen der App – öffnet direkt den Installations-Dialog. Alternativ manuell:
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
- Bildschirm-Wachhaltung über die Wake Lock API
- Web App Manifest (`manifest.json`) für die Installation auf Android/Chrome

## Lizenz
Privates Projekt – frei zur eigenen Nutzung und Anpassung.
