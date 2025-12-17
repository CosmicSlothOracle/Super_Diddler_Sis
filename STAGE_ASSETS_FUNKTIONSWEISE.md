# Wie Stage-Assets funktionieren - Technische Erklärung

## Übersicht: Was passiert beim Kopieren?

Wenn du den `pvp_stage_3` Ordner in ein ähnliches Projekt kopierst, werden die Dateien **automatisch erkannt und geladen**, sofern das Zielprojekt die gleiche Asset-Loading-Architektur verwendet. Die Funktionalität hängt jedoch von mehreren kritischen Abhängigkeiten ab.

---

## 1. Heatmap-System (`heatmaps/`)

### 1.1 Grundlegende Heatmaps (Pflicht)

#### `ground.png` - Kollisionserkennung

- **Zweck**: Definiert, wo Charaktere stehen können
- **Laden**: `game-assets.js` Zeile 584-585

  ```javascript
  const groundImg = await loadImage(`${heatmapPath}/ground.png`);
  state.groundData = getImageData(groundImg);
  ```

- **Verwendung**: `physics.js` prüft jeden Frame, ob ein Pixel an der Charakterposition nicht-schwarz ist
- **Farben**:
  - Schwarz (0,0,0) = Leerer Raum (keine Kollision)
  - Dunkelgrau (64,64,64) = Wände
  - Hellgrau (192,192,192) = Decken
- **Kritik**: Die Farbcodierung ist **nicht intuitiv** - warum nicht einfach "jeder nicht-schwarze Pixel = Boden"? Die Unterscheidung zwischen Wänden/Decken/Böden könnte auch über separate Heatmaps erfolgen.

#### `kill.png` - Todeszonen

- **Zweck**: Sofortiger Tod bei Berührung
- **Laden**: Zeile 588-589
- **Farbe**: Rot (255,0,0)
- **Verwendung**: `physics.js` prüft bei jeder Bewegung, ob der Charakter in eine rote Zone gerät
- **Problematisch**: Wenn `anim_ui.png` auch Rot verwendet, könnte es zu Konflikten kommen (siehe `HEATMAP_COLORS_LEGEND.md` Zeile 165)

#### `semisolid.png` - Plattformen

- **Zweck**: Plattformen, die von unten durchsprungen werden können
- **Farbe**: Gelb (255,255,0)
- **Logik**: Charakter kann nur von oben landen, nicht von unten durchstoßen

#### `spawn.png` - Spawn-Punkte

- **Zweck**: Startpositionen für Spieler und NPCs
- **Farben**:
  - Blau (0,0,255) = Spieler-Spawn
  - Magenta (255,0,255) = NPC-Spawn
- **Laden**: Zeile 724-737 mit spezieller Parsing-Funktion `parseSpawns()`
- **Wichtig**: Die Spawn-Punkte werden in `state.spawnPoints` (Array) und `state.npcSpawnPoints` gespeichert

### 1.2 Optionale Heatmaps

#### `bounce_wall.png` - Wandspringen

- **Zweck**: Wände, an denen man springen kann (Walljump)
- **Laden**: Zeile 752-763
- **Verwendung**: `physics.js` Zeile 3104 - nur `bounce_wall.png` wird für Walljumps geprüft, **nicht** `ground.png`
- **Kritik**: Warum nicht einfach `ground.png` mit einer speziellen Farbe? Die Trennung macht Sinn für Performance, aber erhöht die Komplexität.

#### `zone.png` - Dance Zones

- **Zweck**: Definiert Dance-Spots für Rhythm-Mode
- **Laden**: Zeile 822-831
- **Funktionsweise**:
  - Erkennt bis zu 5 separate "Blobs" (zusammenhängende farbige Bereiche)
  - Jeder Blob wird als Dance Spot behandelt
  - Ein Spot wird zufällig als "aktiv" ausgewählt
  - Proximity-basierte Lautstärke: 0-150px = 100%, 150-800px = Fade, >800px = 0%
- **Kritik**: Die "Blob-Erkennung" ist komplexer als nötig - warum nicht einfach einzelne Pixel als Spots definieren?

#### `anim_ui.png` - Stage Animation Spawns

- **Zweck**: Definiert Positionen, wo Stage-Animationen gespawnt werden
- **Laden**: Zeile 809-819
- **Funktionsweise** (`physics.js` Zeile 4957-5105):
  1. **Automatische Farbzuordnung**: Das System liest alle Animationen aus `atlas.json` und ordnet ihnen automatisch Farben zu (alphabetisch sortiert)
  2. **256×256 Block-System**: Die Heatmap wird in 256×256 Pixel Blöcke aufgeteilt
  3. **Zentrum-Sampling**: Pro Block wird nur der Mittelpunkt-Pixel geprüft
  4. **Farb-Matching**: Mit ±5 RGB Toleranz wird geprüft, welche Animation gespawnt werden soll
  5. **Koordinaten-Skalierung**: Die Heatmap-Koordinaten werden auf Stage-Koordinaten skaliert (wichtig bei unterschiedlichen Auflösungen)
- **Palette**: 20 vordefinierte Farben (siehe `HEATMAP_COLORS_LEGEND.md` Zeile 124-147)
- **Kritik**:
  - **Problematisch**: Wenn du mehr als 20 Animationen hast, werden Farben wiederverwendet (Zeile 5019-5024 warnt davor)
  - **Ineffizient**: Warum 256×256 Blöcke? Das ist sehr groß und limitiert die Präzision
  - **Fehleranfällig**: Die automatische Farbzuordnung bedeutet, dass die Reihenfolge der Animationen in `atlas.json` kritisch ist

---

## 2. Stage Animation System (`stage_animations/`)

### 2.1 `atlas.json` - Animation Metadata

**Struktur**:

```json
{
  "frames": {
    "fx_stage_3_0000": {
      "frame": { "x": 0, "y": 0, "w": 256, "h": 256 },
      ...
    }
  },
  "animations": {
    "fx_stage_3": ["fx_stage_3_0000", "fx_stage_3_0001", ...]
  },
  "meta": {
    "fps": 8,
    "sync": {
      "fx_stage_3": { "beatsPerLoop": 4, "offsetMs": 0 }
    }
  }
}
```

**Laden** (`game-assets.js` Zeile 833-874):

1. JSON wird geladen mit Cache-Busting (`?v=${Date.now()}`)
2. PNG wird geladen
3. **Skalierungs-Erkennung**: Prüft, ob die PNG-Größe mit `meta.size` übereinstimmt
4. Speichert in `state.stageFxAtlas`:
   - `frames`: Alle Frame-Definitionen
   - `animations`: Animation-Sequenzen
   - `atlasImage`: Das PNG-Bild
   - `fps`: Frames pro Sekunde
   - `sourceScaleX/Y`: Skalierungs-Korrektur

**Kritik**:

- **Gut**: Die Skalierungs-Erkennung ist clever - erlaubt hochauflösende Atlas-Bilder
- **Problematisch**: Wenn `meta.size` fehlt oder falsch ist, wird die tatsächliche Bildgröße verwendet - das könnte zu Fehlern führen

### 2.2 `atlas.png` - Sprite Sheet

- **Format**: RGBA8888 (laut `atlas.json` meta)
- **Größe**: 4096×4096 Pixel (laut meta)
- **Struktur**: Alle Frames vertikal/horizontal angeordnet
- **Verwendung**: `renderer.js` schneidet die Frames basierend auf `atlas.json` Koordinaten aus

**Wichtig**: `atlas.json` und `atlas.png` **müssen zusammenpassen** - die Koordinaten in der JSON müssen exakt die Positionen im PNG widerspiegeln.

---

## 3. Visuelle Layer (`bg_layer.png`, `mid.png`, `fg.png`)

### 3.1 Render-Reihenfolge

1. **bg** (Background) - Video oder statisches Bild
2. **bgLayer** - Optional, für Stage-Animationen
3. **Characters** - Spieler
4. **Effects & Particles** - Effekte
5. **mid** - Mittlere Ebene
6. **fg** - Vordergrund

**Laden** (`game-assets.js` Zeile 568-580):

- `bg_layer.png` ist **optional** (try/catch)
- `mid.png` und `fg.png` sind **pflicht** (kein try/catch)

**Kritik**: Warum ist `mid.png` pflicht, aber `bg_layer.png` optional? Das scheint inkonsistent.

---

## 4. Animierter Hintergrund (`bg_animated/bg.webm`)

**Laden** (Zeile 558-566):

```javascript
try {
  state.bgVideo = await loadVideo(videoPath);
} catch (e) {
  // Fallback zu statischem bg.png
}
```

**Kritik**:

- **Gut**: Fallback-Mechanismus ist robust
- **Problematisch**: WebM ist nicht überall unterstützt - sollte es einen zweiten Fallback geben?

---

## 5. Was passiert beim Kopieren?

### 5.1 Automatische Erkennung

Das System erkennt neue Stages **automatisch**, wenn:

1. Die Dateistruktur korrekt ist: `levels/sidescroller/[stage]/sections/[section_name]/`
2. Die Heatmaps im `heatmaps/` Unterordner liegen
3. Die Stage in `data/stages.json` registriert ist (oder das System dynamisch scannt)

### 5.2 Lade-Prozess

1. **Stage-Pfad wird übergeben** (z.B. aus `stages.json` oder Menü-Auswahl)
2. **`loadStageAssets()` wird aufgerufen** (`game-assets.js` Zeile 456)
3. **Heatmaps werden geladen**:
   - Pflicht: `ground.png`, `kill.png`, `semisolid.png`, `spawn.png` → **Fehler wenn fehlend**
   - Optional: Alle anderen → **Warnung wenn fehlend, aber Spiel läuft weiter**
4. **Stage-Animationen werden geladen**:
   - `stage_animations/atlas.json` und `atlas.png` → **Optional** (Zeile 870-873)
5. **Visuelle Layer werden geladen**:
   - `bg_layer.png` → Optional
   - `mid.png`, `fg.png` → Pflicht
   - `bg_animated/bg.webm` → Optional (Fallback zu `bg.png`)

### 5.3 Runtime-Verwendung

#### Heatmaps werden verwendet in

- **`physics.js`**: Kollisionserkennung, Spawn-Punkte, Effekte
- **`npc-controller.js`**: NPC-Pfadfindung (Zeile 127-159)
- **`renderer.js`**: Visuelle Debug-Overlays (optional)

#### Stage-Animationen werden verwendet in

- **`physics.js` Zeile 4957**: `spawnStageUiAnimations()` scannt `anim_ui.png` und spawnt Animationen
- **`main.js` Zeile 2231-2256**: Stage-spezifische Animationen werden beim Start gespawnt
- **`renderer.js`**: Rendering der Animationen auf dem `bgLayer`

---

## 6. Kritische Abhängigkeiten beim Kopieren

### 6.1 Code-Abhängigkeiten

**Muss vorhanden sein**:

- `js/game-assets.js` mit `loadStageAssets()` Funktion
- `js/physics.js` mit Heatmap-Checking-Funktionen
- `js/renderer.js` mit Atlas-Rendering
- `js/game-state.js` mit State-Struktur (`groundData`, `spawnPoints`, etc.)

**Muss kompatibel sein**:

- **Koordinaten-System**: Die Heatmap-Auflösung muss zur Stage-Größe passen
- **Farb-Codes**: Die Farbwerte müssen exakt übereinstimmen (±5 Toleranz)
- **Atlas-Format**: `atlas.json` muss dem erwarteten Format entsprechen

### 6.2 Asset-Abhängigkeiten

**Pflicht**:

- `ground.png`, `kill.png`, `semisolid.png`, `spawn.png`
- `mid.png`, `fg.png`
- `bg.png` (wenn kein `bg.webm`)

**Optional** (aber empfohlen):

- `bg_layer.png`
- `bg_animated/bg.webm`
- `stage_animations/atlas.json` + `atlas.png`
- Alle anderen Heatmaps

### 6.3 Konfiguration

**`data/stages.json`** muss einen Eintrag haben:

```json
{
  "pvp_stage_3": {
    "name": "PVP Stage 3",
    "path": "levels/sidescroller/ninja_stage/sections/pvp_stage_3",
    ...
  }
}
```

**Oder** das System muss dynamisch alle Ordner unter `sections/` scannen.

---

## 7. Potenzielle Probleme beim Kopieren

### 7.1 Auflösungs-Mismatch

**Problem**: Heatmap ist 1920×1080, aber Stage ist 2560×1440
**Lösung**: Das System skaliert automatisch (Zeile 5090-5091), aber die Präzision leidet

### 7.2 Farb-Konflikte

**Problem**: `anim_ui.png` verwendet Rot, aber `kill.png` auch
**Lösung**: Die Heatmaps werden separat geprüft, aber visuell verwirrend

### 7.3 Atlas-Mismatch

**Problem**: `atlas.json` sagt Frame ist bei (0,0,256,256), aber im PNG ist es woanders
**Lösung**: Animationen werden falsch gerendert oder gar nicht angezeigt

### 7.4 Fehlende Animationen

**Problem**: `anim_ui.png` referenziert `fx_stage_3`, aber die Animation existiert nicht in `atlas.json`
**Lösung**: System warnt in Console, aber spawnt nichts (Zeile 4984-4986)

---

## 8. Best Practices für Kopieren

1. **Kopiere den gesamten Ordner**: `pvp_stage_3/` mit allen Unterordnern
2. **Prüfe `stages.json`**: Stelle sicher, dass die Stage registriert ist
3. **Teste die Auflösung**: Heatmaps sollten zur Stage-Größe passen
4. **Prüfe Console-Logs**: Das System loggt alle geladenen Assets und Warnungen
5. **Validiere Atlas**: Stelle sicher, dass `atlas.json` und `atlas.png` zusammenpassen
6. **Teste `anim_ui.png`**: Prüfe die Console-Logs für die Farbzuordnung (Zeile 5014-5028)

---

## 9. Fazit

**Was funktioniert automatisch**:

- ✅ Heatmap-Laden (wenn Pfad-Struktur stimmt)
- ✅ Stage-Animation-Laden (wenn vorhanden)
- ✅ Spawn-Point-Parsing
- ✅ Koordinaten-Skalierung

**Was manuell gemacht werden muss**:

- ⚠️ Stage in `stages.json` registrieren
- ⚠️ Code-Kompatibilität prüfen
- ⚠️ Farb-Konflikte vermeiden
- ⚠️ Atlas-Validierung

**Kritische Annahmen**:

- ❓ Das Zielprojekt verwendet die gleiche Asset-Loading-Architektur
- ❓ Die State-Struktur ist kompatibel
- ❓ Die Render-Pipeline unterstützt das Atlas-Format
- ❓ Die Physics-Engine kann Heatmaps lesen

**Empfehlung**: Bevor du kopierst, prüfe die Code-Basis des Zielprojekts auf Kompatibilität. Ein einfaches Kopieren reicht **nicht**, wenn die Architektur unterschiedlich ist.

