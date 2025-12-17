# NPC Verhaltensanalyse: Kausalketten und Szenarien

## 1. Strategie-Mode-Entscheidungsmatrix

### Kausalkette: Mode-Auswahl

```
Inputs:
- Player Aggression Score (0-1): basierend auf Angriffen in letzten 5s
- NPC Health State: "low" (>100%), "mid" (>50%), "high" (≤50%)
- Distance to Player: horizontal distance
- In Zone: boolean
- Beat Charges: 0-9+

Decision Tree:
1. SURVIVAL: healthState === "low" AND aggressionScore > 0.7
   → Priorität: Überleben > Zone > Angriff

2. COMBAT_AGGRO: aggressionScore > 0.5 OR (distance < 200 AND !inZone)
   → Priorität: Angriff > Zone

3. RESOURCE_GATHER: inZone AND beatCharges < 9 AND aggressionScore < 0.3
   → Priorität: Beat-Charges sammeln > Angriff

4. ZONE_DEFENSE: Default
   → Priorität: Zone erreichen/verteidigen > Angriff
```

### Problem: Hysteresis vs. Reaktionszeit
- **Hysteresis**: 1.0s Mindestdauer pro Mode
- **Problem**: Bei schnellen Spieler-Änderungen (z.B. Aggression → Passiv) reagiert NPC zu langsam
- **Konsequenz**: NPC bleibt in COMBAT_AGGRO, obwohl Spieler aufhört zu attackieren

---

## 2. Bewegungs-Szenarien

### Szenario A: Zone oberhalb, NPC am Boden

**Kausalkette:**
```
1. getDanceSpotGuardAxis() erkennt: dy < -40 → needsVertical = true
2. decideMovement() prüft: zoneAbove = true, grounded = true
3. Plattform-Erkennung:
   - Prüft Höhen: 60px, 100px, 140px, 180px
   - Prüft Position: p2.pos.x + (axis * 20) → leicht voraus
4. Entscheidung:
   - foundPlatform = true → shouldJump = true
   - ODER verticalDist 50-250px → shouldJump = true
5. Jump-Input wird gesetzt
```

**Vermutetes Verhalten:**
- ✅ Springt, wenn Plattform in 60-180px Höhe gefunden wird
- ✅ Springt auch ohne Plattform, wenn Zone 50-250px entfernt
- ⚠️ Problem: Prüft nur 4 feste Höhenpunkte → könnte Plattformen zwischen 60-100px übersehen
- ⚠️ Problem: Prüft nur in Bewegungsrichtung → könnte Plattformen seitlich übersehen

**Bewertung:**
- **Gut**: Grundlegende vertikale Navigation funktioniert
- **Schlecht**: Zu starre Höhenprüfung, keine adaptive Suche
- **Verbesserung**: Dynamische Höhenprüfung basierend auf dy-Wert

---

### Szenario B: Zone unterhalb, NPC auf Plattform

**Kausalkette:**
```
1. getDanceSpotGuardAxis() erkennt: dy > 40 → needsVertical = true
2. decideMovement() prüft: zoneBelow = true, verticalDist > 60
3. Aktuell: Nur Logging, keine Drop-Through-Logik
4. NPC bewegt sich horizontal zur Zone
5. Physik-System lässt NPC fallen, wenn Edge erreicht
```

**Vermutetes Verhalten:**
- ✅ Bewegt sich horizontal zur Zone
- ❌ Kann NICHT durch semisolid Plattformen fallen (fehlt Down-Input)
- ❌ Muss erst zum Edge laufen, dann fallen
- ⚠️ Ineffizient: Umweg statt direkter Drop-Through

**Bewertung:**
- **Kritisch**: Fehlende Drop-Through-Funktionalität
- **Konsequenz**: NPC kann nicht effizient zu tieferen Zonen navigieren
- **Lösung**: Down-Input hinzufügen, wenn Zone deutlich unterhalb UND auf semisolid Plattform

---

### Szenario C: Zone weit entfernt, horizontal

**Kausalkette:**
```
1. getDanceSpotGuardAxis() erkennt: distance > radius * 0.5
2. axis = dx > 0 ? 1.0 : -1.0 (volle Geschwindigkeit)
3. weight = min(1.0, dist / max(radius, 200))
4. decideMovement() setzt: inputs.axis = danceZoneInfo.axis
5. Edge-Detection prüft Gaps
```

**Vermutetes Verhalten:**
- ✅ Bewegt sich mit voller Geschwindigkeit zur Zone
- ✅ Edge-Detection verhindert Abstürze
- ✅ Springt über Gaps, wenn Landing möglich
- ⚠️ Problem: Keine Berücksichtigung von Umwegen (z.B. Plattformen oberhalb nutzen)

**Bewertung:**
- **Gut**: Grundlegende horizontale Navigation funktioniert
- **Verbesserung**: Pathfinding für komplexere Level-Strukturen

---

### Szenario D: Zone erreicht, Spieler nähert sich

**Kausalkette:**
```
1. inZone = true (distance <= radius * 0.5)
2. Mode könnte sein: ZONE_DEFENSE oder RESOURCE_GATHER
3. decideMovement() prüft: distance < 150
4. Wenn zu nah: blendet Retreat (60%) mit Zone-Pull (40%)
5. Sonst: Zentriert in Zone (axis * 0.5)
```

**Vermutetes Verhalten:**
- ✅ Bleibt in Zone, wenn Spieler fern
- ✅ Weicht aus, wenn Spieler zu nah (<150px)
- ⚠️ Problem: Blend-Logik könnte NPC aus Zone schieben
- ⚠️ Problem: Keine Berücksichtigung, ob Retreat Zone verlässt

**Bewertung:**
- **Mäßig**: Grundidee gut, aber Implementierung könnte verbessert werden
- **Verbesserung**: Prüfen, ob Retreat-Position noch in Zone ist

---

## 3. Angriffs-Szenarien

### Szenario E: COMBAT_AGGRO Mode, Spieler in Reichweite

**Kausalkette:**
```
1. Mode = COMBAT_AGGRO
2. decideAttack() prüft:
   - distance < 180 → R1 (weight: 4)
   - beatCharges >= 2 AND distance < 250 → double_dash (weight: 6)
   - distance < 220 → R2 (weight: 3)
   - !grounded → air_r1 (weight: 3)
3. chooseWeightedCandidate() wählt zufällig basierend auf Gewichten
4. Cooldown wird gesetzt (R1: 0.8s, R2: 1.2s, etc.)
```

**Vermutetes Verhalten:**
- ✅ Variiert Angriffe basierend auf Distanz
- ✅ Double-Dash hat höchste Priorität bei Beat-Charges
- ⚠️ Problem: Zufällige Auswahl → könnte suboptimale Angriffe wählen
- ⚠️ Problem: Keine Berücksichtigung von Spieler-Position (oben/unten)

**Bewertung:**
- **Gut**: Angriffs-Variation vorhanden
- **Verbesserung**: Kontext-bewusste Angriffsauswahl (z.B. Air-Angriff, wenn Spieler oberhalb)

---

### Szenario F: ZONE_DEFENSE Mode, Spieler fern

**Kausalkette:**
```
1. Mode = ZONE_DEFENSE
2. decideAttack() prüft:
   - distance > 200 → L1 (weight: 4, cooldown: 2.0s)
   - distance 150-300 → L2 (weight: 3, cooldown: 1.5s)
3. L1 hat sehr lange Cooldown (2.5s nach Attack)
```

**Vermutetes Verhalten:**
- ✅ Nutzt L1 für Zoning, wenn Spieler fern
- ✅ L1-Spam wird durch Cooldown verhindert
- ⚠️ Problem: L1 könnte zu selten genutzt werden (2.0s + 2.5s = 4.5s zwischen Angriffen)
- ⚠️ Problem: Keine Berücksichtigung, ob L1 tatsächlich Spieler erreichen kann

**Bewertung:**
- **Mäßig**: Zoning-Idee gut, aber Timing könnte optimiert werden
- **Verbesserung**: Dynamische Cooldown-Anpassung basierend auf Erfolg

---

### Szenario G: RESOURCE_GATHER Mode, Spieler greift an

**Kausalkette:**
```
1. Mode = RESOURCE_GATHER (inZone AND beatCharges < 9 AND aggressionScore < 0.3)
2. Spieler greift an → aggressionScore steigt
3. updateStrategy() prüft: aggressionScore > 0.5 → Mode wechselt zu COMBAT_AGGRO
4. ABER: Hysteresis von 1.0s verhindert sofortigen Wechsel
5. In der Zwischenzeit: decideAttack() in RESOURCE_GATHER erlaubt nur R1 bei distance < 100
```

**Vermutetes Verhalten:**
- ⚠️ Problem: NPC bleibt 1.0s in RESOURCE_GATHER, obwohl angegriffen
- ⚠️ Problem: Kann nur R1 nutzen, obwohl andere Angriffe besser wären
- ❌ NPC ist verwundbar während Hysteresis-Period

**Bewertung:**
- **Kritisch**: Hysteresis verhindert defensive Reaktionen
- **Lösung**: Hysteresis-Bypass für kritische Situationen (z.B. angegriffen werden)

---

## 4. Edge-Cases und Probleme

### Problem 1: Animation-State vs. Attack-Type Diskrepanz

**Kausalkette:**
```
1. Attack startet → p2.attack.type = "l1"
2. Animation läuft → p2.anim = "l1_ranged_grab"
3. Attack endet → p2.attack.type = "none"
4. ABER: Animation könnte noch laufen → isInAttackAnim = true
5. decideAttack() blockiert neue Angriffe korrekt
```

**Bewertung:**
- ✅ Funktioniert: Animation-Check verhindert Spam
- ⚠️ Problem: Doppelte Prüfung (attack.type UND anim) könnte redundant sein

---

### Problem 2: Cooldown vs. Animation-Finish Timing

**Kausalkette:**
```
1. Attack endet → Animation läuft noch
2. updateStrategy() erkennt: lastAttackAnim vorhanden, jetzt !isInAttackAnim
3. Setzt minCooldown (L1: 1.5s, andere: 0.5s)
4. ABER: Cooldown läuft bereits seit Attack-Start
5. Mögliche Race-Condition: Cooldown könnte bereits abgelaufen sein
```

**Bewertung:**
- ⚠️ Potenzielle Race-Condition
- **Verbesserung**: Cooldown beim Attack-Start setzen, nicht beim Animation-Finish

---

### Problem 3: Vertikale Navigation vs. Edge-Detection Konflikt

**Kausalkette:**
```
1. Zone oberhalb → jumpingForZone = true
2. Edge-Detection wird übersprungen (gut)
3. ABER: Was, wenn Zone oberhalb UND Gap vor NPC?
4. NPC springt vertikal, aber könnte in Gap fallen
```

**Bewertung:**
- ⚠️ Potenzielle Lücke: Vertikale Navigation berücksichtigt keine horizontalen Gaps
- **Verbesserung**: Kombinierte Prüfung: Vertikal + Horizontal

---

### Problem 4: Beat-Charge-Sammeln vs. Zone-Verteidigung

**Kausalkette:**
```
1. NPC in Zone, beatCharges < 9, aggressionScore < 0.3
2. Mode = RESOURCE_GATHER
3. decideMovement() in Zone: axis = danceZoneInfo.axis * 0.5 (Zentrierung)
4. getInputs() setzt: danceDown = true (wenn in beat window)
5. ABER: Movement könnte NPC aus Zone schieben, während er tanzt
```

**Bewertung:**
- ⚠️ Potenzielle Lücke: Movement während Dance könnte Zone verlassen
- **Verbesserung**: Movement reduzieren/blockieren, wenn danceDown aktiv

---

## 5. Gesamtbewertung

### Stärken:
1. ✅ Klare Strategie-Modi mit definierten Prioritäten
2. ✅ Vertikale Navigation grundlegend implementiert
3. ✅ Angriffs-Cooldowns verhindern Spam
4. ✅ Edge-Detection verhindert Abstürze
5. ✅ Logging für Debugging vorhanden

### Schwächen:
1. ❌ Hysteresis verhindert schnelle Reaktionen auf Bedrohungen
2. ❌ Fehlende Drop-Through-Funktionalität für semisolid Plattformen
3. ❌ Starre Höhenprüfung bei vertikaler Navigation
4. ❌ Keine Berücksichtigung von Umwegen bei horizontaler Navigation
5. ❌ Potenzielle Race-Conditions bei Cooldown-Management

### Kritische Probleme:
1. **Hysteresis-Bypass fehlt**: NPC kann nicht schnell auf Bedrohungen reagieren
2. **Drop-Through fehlt**: NPC kann nicht effizient zu tieferen Zonen navigieren
3. **Pathfinding fehlt**: NPC nutzt keine Umwege für komplexe Level-Strukturen

### Empfohlene Verbesserungen (Priorität):

**Hoch:**
1. Hysteresis-Bypass für kritische Situationen (angegriffen werden)
2. Drop-Through-Input für semisolid Plattformen
3. Dynamische Höhenprüfung bei vertikaler Navigation

**Mittel:**
4. Pathfinding für komplexe Level-Strukturen
5. Kontext-bewusste Angriffsauswahl (z.B. Air-Angriffe)
6. Cooldown-Management verbessern (beim Start setzen)

**Niedrig:**
7. Movement während Dance optimieren
8. Retreat-Logik verbessern (Zone-Boundary-Check)
9. Redundante Checks entfernen (attack.type vs. anim)






