# 🤾 Handball Scoreboard

Eine schlanke Web-App zum Verfolgen des Spielstands bei Handballspielen – optimiert für die Nutzung auf dem Smartphone (iPhone und Android). Ohne Installation aus dem App Store, läuft direkt im Browser oder als Web-App auf dem Home-Bildschirm.

## Features

### Spielstand-Tracking
- Zwei Teams nebeneinander – Antippen der Team-Karte zählt ein Tor
- Spielstand groß in der jeweiligen Teamfarbe, Halbzeitstand („HZ") oben auf der Karte
- Karten immer gleich breit und hoch
- Kurzes haptisches Feedback (Vibration) bei jedem Tor (Android; iOS unterstützt keine Vibration aus Web-Apps)

### Tore korrigieren
- „−"-Button pro Team für versehentliche Eingaben – nur sichtbar, wenn es in der aktuellen Halbzeit ein Tor zum Abziehen gibt
- Kein negativer Spielstand möglich
- Optionaler „Einzel-Rückgängig-Modus" (Einstellungen, standardmäßig aus): der „−"-Button wird zu einem ↺-Symbol, das nur für ein einstellbares Zeitfenster (standardmäßig 30 Sekunden) nach einem Tor sichtbar ist und jeweils nur das zuletzt erzielte Tor rückgängig machen kann

### Spieluhr & Halbzeiten
- Countdown-Uhr mit Start/Pause (▶/⏸) und Zurücksetzen (↻, mit Ja/Nein-Bestätigung)
- Halbzeitlänge einstellbar (1–99 Minuten, standardmäßig 30)
- Läuft auch weiter, wenn die App im Hintergrund ist oder geschlossen wird
- Bei Ablauf der 1. Halbzeit automatischer Wechsel in die 2. Halbzeit
- Ende einer Halbzeit wird durch Blinken der Uhr (und Vibration auf Android) signalisiert
- Halbzeit auch manuell umschaltbar
- Uhr in den Einstellungen ausblendbar

### Teamnamen
- In den Einstellungen bearbeitbar
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
- Optional automatisch zur 2. Halbzeit (Einstellung, standardmäßig an) – beim Beenden oder Zurücksetzen des Spiels stehen die Teams wieder auf ihren ursprünglichen Seiten
- Kurze Bestätigung nach dem Tausch

### Spielernummern erfassen
- In den Einstellungen deaktivierbar (standardmäßig an)
- Bei jedem Tor öffnet sich ein Ziffernblock mit großen Tasten zur schnellen Eingabe der Trikotnummer, eingefärbt in der Farbe des torschießenden Teams
- Führende Nullen werden ignoriert: „03" und „3" gelten als dieselbe Nummer
- Das Tor zählt immer sofort – Eingabe überspringen oder daneben tippen lässt das Tor ohne zugeordnete Nummer stehen
- Schnelles Doppeltippen auf eine Team-Karte zählt zwei Tore; die Nummern werden nacheinander abgefragt
- Während des Spiels über „🥅 Tore anzeigen" einsehbar, in der Historie über den 🥅-Button pro Spiel: Anzahl Tore je Spielernummer, getrennt nach Team
- Optionaler „Punktefaktor" (Einstellung, standardmäßig an): Anzahl verschiedener Torschützen × Tore des Teams

### Historie
- Spiele speichern mit Datum, Uhrzeit, Halbzeit- und Endstand sowie Gewinner
- Eigener Tab zur Übersicht aller gespeicherten Spiele
- Einträge nachträglich bearbeitbar (Teamnamen, Spielstand, Datum & Uhrzeit) – die Liste bleibt dabei nach Datum sortiert
- Einzelne Einträge löschbar
- Komplette Historie mit einem Klick löschbar (mit Bestätigung)
- Historie als JSON-Datei exportierbar (Backup oder Weiterverarbeitung außerhalb der App)
- Dauerhaft im Browser gespeichert

### Teilen
- Ergebnis eines gespeicherten Spiels per WhatsApp teilen oder als Text in die Zwischenablage kopieren (zum Einfügen in eine beliebige andere App)
- App selbst per WhatsApp teilen oder als QR-Code zum Scannen mit einem anderen Handy anzeigen
- WhatsApp-Teilen ist immer verfügbar, ganz ohne Einstellung

### Design
- Umschaltbares dunkles / helles Theme (Einstellung wird gespeichert)
- Dezenter Farbverlauf in der Teamfarbe auf den Spiel-Karten, per Einstellung abschaltbar
- Weiche Schatten statt harter Kanten auf Karten, einheitliche Eckenradien und Abstände
- Kurzer Puls-Effekt auf dem Spielstand bei jedem Tor
- Statusleiste und Browser-Leiste passen sich dem Theme an (auf dem iPhone ggf. erst nach dem nächsten App-Start)
- Sichtbarer Fokusring bei Tastatur-/Screenreader-Navigation

### Einstellungen
- Alle Team-, Zeit-, Tore- und Darstellungs-Optionen im Tab „Einstellungen" gesammelt
- „Auf Standardeinstellungen zurücksetzen" (mit Bestätigung) setzt Teamnamen, Teamfarben, Seitenreihenfolge, Design, Sprache und alle Schalter auf die Werkseinstellung zurück – das laufende Spiel und die gespeicherte Historie bleiben davon unberührt

## Mobile-Optimierung
- Große, touch-freundliche Buttons mit Druck-Feedback
- Zoom (Doppeltipp & Pinch) deaktiviert
- Seite fixiert gegen versehentliches Verschieben
- Bildschirm bleibt während des Spiels wach (Wake Lock API), inkl. Reaktivierung bei jeder Berührung für höhere Zuverlässigkeit
- Angepasstes, kompakteres Layout im Querformat (z. B. für Schiedsrichter mit Smartphone im Landscape-Modus)
- Berücksichtigt Notch und Home-Indikator (auch im Querformat)
- Als Web-App mit eigenem Icon installierbar – direkt über den Button in den Einstellungen (Android: echter Installations-Dialog; iOS: kurze Anleitung, da Apple hier keine automatische Installation erlaubt)
- Bedienelemente mit Screenreader-Beschriftungen (aria-label) für symbolbasierte Buttons

## Offline-Nutzung
Nach dem ersten Laden funktioniert die App dank Service Worker auch komplett ohne Internetverbindung.

## Updates
Beim Öffnen der App wird bei bestehender Internetverbindung automatisch und ohne Rückfrage geprüft, ob eine neuere Version vorliegt – ist das der Fall, wird sie (samt App-Icon und Manifest) im Hintergrund geladen und die App lädt sich einmal neu. Ältere Versionen werden dabei nie eingespielt. Ohne Internetverbindung läuft einfach die zuletzt geladene Version weiter, ganz ohne Fehlermeldung.

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
1. `index.html`, `sw.js`, `handball_icon.png` und `manifest.json` ins Repository-Root hochladen
2. **Settings → Pages → Source:** „Deploy from a branch", Branch `main`, Ordner `/ (root)`
3. Nach kurzer Zeit ist die App erreichbar unter:
   `https://<username>.github.io/<repository>`

## Technik
- Reines HTML, CSS und JavaScript – keine Frameworks, keine Build-Tools
- Die gesamte App in einer einzigen `index.html`-Datei, dazu der Service Worker (`sw.js`)
- Datenspeicherung über `localStorage`
- Offline-Support über einen Service Worker
- Bildschirm-Wachhaltung über die Wake Lock API
- Web App Manifest (`manifest.json`) für die Installation auf Android/Chrome

## Lizenz
Privates Projekt – frei zur eigenen Nutzung und Anpassung.
