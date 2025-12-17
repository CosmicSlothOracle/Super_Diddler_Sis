# Redundante Code-Stellen in physics.js

## 1. ⚠️ Legacy `applyDamage` Funktion (Zeilen 7423-7493)

**Status:** Funktion existiert noch und wird verwendet (z.B. Zeile 7488 prüft `isGrabbed`)

**Aktueller Zustand:**
- Die Funktion `applyDamage` wird noch in einigen Legacy-Pfaden verwendet
- Neue Attack-Logik sollte `AttackSystem.applyDamageWithDescriptor()` verwenden
- Die Funktion ist nicht veraltet, aber sollte langfristig durch das Descriptor-System ersetzt werden

**Empfehlung:** Schrittweise Migration zu `applyDamageWithDescriptor`, aber Funktion nicht entfernen, solange sie noch verwendet wird

---

## 2. ⚠️ Legacy Attack-Handler in `handleAttacks` (Zeilen 605-700)

**Problem:** Attack-Handler die nur noch Start/Ende logik haben, aber nicht zum AttackSystem migriert wurden

### 2.1 `r1_circle_attack` (Zeilen 605-617, 689-692)
- Startet Attack manuell
- Nur Animation-End-Check
- **Sollte migriert werden zu:** AttackSystem

### 2.2 `r1_up_attack` (Zeilen 679-688, 693-696)
- Fritz L3+R1 overhead attack
- Nur Animation-End-Check
- **Sollte migriert werden zu:** AttackSystem

### 2.3 `r2_hit_followup` (Zeilen 697-700)
- Nur Animation-End-Check
- **Sollte migriert werden zu:** AttackSystem

**Empfehlung:** Diese Attack-Typen sollten komplett zum AttackSystem migriert werden

---

## 3. ✅ Cyboard L2 Smash Attack - MIGRIERT

**Status:** ✅ Vollständig migriert zu `AttackSystem.handleCyboardL2()` (Zeile 4452 in attack-system.js)

**Aktueller Zustand:**
- Die gesamte Attack-Phasen-Logik (charge, jump, hover, fall, impact) wurde zu `attack-system.js` migriert
- Verwendet `AttackCatalog.getDescriptor(p, "cyboard:l2_smash")` für Damage/Knockback
- Die Logik in `physics.js` wurde entfernt/ersetzt

**Hinweis:** Diese Attack-Logik ist vollständig im AttackSystem und sollte nicht mehr in physics.js sein

---

## 4. ❌ `slamming` State in Sword Projectile (Zeilen 6163-6205)

**Problem:** `slamming` State macht nur noch visuelle Logik, da Grab entfernt wurde

```6163:6205:js/physics.js
} else if (proj.state === "slamming") {
  // Drive the slam with the linked effect animation
  // ... nur noch visuelle Logik ohne Schaden/Knockback
}
```

**Status:** Nach Entfernung von Grab/Slam Finisher ist dieser State nur noch für visuelle Effekte da. Wenn `linkedEffect` entfernt wird, kann der gesamte State entfernt werden.

**Empfehlung:** Prüfen ob `linkedEffect` noch benötigt wird, sonst State entfernen

---

## 5. ✅ `isGrabbed` Referenzen - AKTIV VERWENDET

**Status:** ✅ Grab-System ist aktiv und wird verwendet

**Aktueller Zustand:**
- Das Grab-System existiert und funktioniert (z.B. HP L1 ranged grab in `attack-system.js`)
- `isGrabbed` wird aktiv verwendet in:
  - `attack-system.js` (handleHPGrab, Zeile 581): `target.isGrabbed = true;`
  - `physics.js` (updatePlayer, Zeile 358): `if (p.isGrabbed)` - Safety-Check für Grabber
  - `physics.js` (applyDamage, Zeile 7488): `if (!target.isGrabbed && !wasStunned)` - verhindert Animation während Grab
  - `physics.js` (detectHits, Zeile 9358): Cyboard R2 max charge kann Ziele greifen
- Alle Referenzen sind aktiv und notwendig

**Hinweis:** Das Grab-System wurde NICHT entfernt. Die Dokumentation war falsch.

---

## 6. ⚠️ Legacy `detectHits` Kommentar (Zeile 71)

**Problem:** Kommentar deutet darauf hin, dass `detectHits` migriert werden soll

```71:71:js/physics.js
detectHits(state.players[i], i, state); // legacy path (to be removed after migration)
```

**Status:** `detectHits` delegiert bereits zu `AttackSystem.detectHits()`, aber der Kommentar deutet auf vollständige Migration hin.

**Empfehlung:** Prüfen ob `detectHits` komplett entfernt werden kann oder ob noch legacy Code drin ist

---

## 7. ⚠️ Doppelte Attack-Logik in `handleAttacks`

**Problem:** `handleAttacks` hat sowohl AttackSystem-Delegation als auch Legacy-Logik

```553:560:js/physics.js
function handleAttacks(dt, p, inputs, state) {
  // Delegate to AttackSystem
  AttackSystem.handleAttacks(dt, p, inputs, state);

  // If the modular AttackSystem started an attack, avoid running legacy attack logic
  if (p.attack && p.attack.type !== "none" && p.attack.owner === "mod") {
    return;
  }
  // ... dann kommt noch Legacy-Logik
}
```

**Empfehlung:** Nach vollständiger Migration aller Attacks sollte die gesamte Legacy-Logik entfernt werden

---

## Zusammenfassung

### Status-Updates:
1. ✅ `applyDamage` Funktion existiert noch und wird verwendet (Legacy-Pfad, aber aktiv)
2. ✅ `isGrabbed` Referenzen sind aktiv und notwendig (Grab-System funktioniert)
3. ⚠️ `slamming` State (prüfen ob `linkedEffect` noch benötigt wird)

### Migrieren (⚠️):
1. `r1_circle_attack`, `r1_up_attack`, `r2_hit_followup` → AttackSystem (noch in physics.js, sehr einfache Logik)
2. ✅ Cyboard L2 Smash Attack → `AttackSystem.handleCyboardL2()` (BEREITS MIGRIERT)
3. Legacy `detectHits` komplett entfernen (wenn möglich)

### Aufräumen nach Migration:
- Legacy Attack-Logik in `handleAttacks` entfernen
- Kommentar "legacy path" entfernen
