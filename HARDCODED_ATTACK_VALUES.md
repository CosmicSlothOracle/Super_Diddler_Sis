# Hardcodierte Attack-Werte in physics.js

Diese Datei listet alle hardcodierten Werte auf, die mit dem Attack Catalog interferieren könnten (außer Ultimates).

## 1. Cyboard L2 Smash Attack ✅ MIGRIERT

**Status:** ✅ Migriert zum Attack Catalog

**Lösung:** Verwendet jetzt `AttackCatalog.getDescriptor(p, "l2_smash")` und `AttackSystem.applyDamageWithDescriptor()` mit distance-based scaling und charge multiplier.

```985:1042:js/physics.js
// Get descriptor for L2 Smash Attack
const descriptor = AttackCatalog.getDescriptor(p, "l2_smash");
// ... distance-based scaling ...
// Apply damage and knockback using descriptor system
AttackSystem.applyDamageWithDescriptor(
  p,
  target,
  modifiedDescriptor,
  state
);
```

---

## 2. Cyboard Sword Grab - Initial Damage ✅ ENTFERNT

**Status:** ✅ Entfernt - Grab-Mechanismus wurde komplett entfernt

---

## 3. Cyboard Sword Grab - Damage Over Time ✅ ENTFERNT

**Status:** ✅ Entfernt - DoT-Mechanismus wurde komplett entfernt

---

## 4. Cyboard Sword Slam Finisher ✅ ENTFERNT

**Status:** ✅ Entfernt - Slam Finisher wurde komplett entfernt

---

## 5. Cyboard L1 Bomb Splash Damage (Zeile 6664)

**Problem:** Hardcodierter Knockback für Splash Damage

```6664:6677:js/physics.js
const projKnockback = 500;
const projFalloff = 1.0 - (proj.pos.y - proj.prevPos.y) / 100;

// Projectile damage using descriptor
const descriptor = AttackCatalog.getDescriptor(
  proj.owner,
  "l1_bomb"
);
AttackSystem.applyDamageWithDescriptor(
  proj.owner,
  target,
  descriptor,
  state
);
```

**Hinweis:** Der `projKnockback = 500` wird nicht verwendet, da der Descriptor verwendet wird. Aber der Wert ist trotzdem hardcodiert und könnte verwirrend sein.

---

## 6. HP Bike Collision (Zeilen 7793-7794, 7812)

**Problem:** Hardcodierte Bike-Kollisionswerte

```7793:7794:js/physics.js
const bikeDamage = 20; // 20% damage
const bikeStun = 0.3; // Short stun
```

```7812:7812:js/physics.js
knockback: 400, // Base knockback
```

**Hinweis:** Bike-Kollision ist Teil des Ultimate-Systems, könnte aber auch als normales Attack-System behandelt werden.

---

## 7. Dance Battle Damage (Zeilen 2204-2205)

**Problem:** Hardcodierte Dance Battle Werte

```2204:2205:js/physics.js
const DANCE_BATTLE_DAMAGE = 30; // 30%
const DANCE_BATTLE_KNOCKBACK = 800; // Stark reduziert (war 2000)
```

**Hinweis:** Dance Battle ist ein spezieller Modus, könnte aber auch über Attack Catalog geregelt werden.

---

## 8. Ultimate Stun (Zeile 502)

**Problem:** Hardcodierter Ultimate Stun

```502:502:js/physics.js
stun: 1.5, // 1.5 seconds stun
```

**Hinweis:** Teil des Ultimate-Systems, aber sollte aus dem Descriptor kommen.

---

## Zusammenfassung

**Status-Updates:**
1. ✅ Cyboard L2 Smash Attack - VOLLSTÄNDIG MIGRIERT zu `AttackSystem.handleCyboardL2()` (attack-system.js, Zeile 4452)
2. ⚠️ Cyboard Sword Slam Finisher - Status unklar, prüfen ob noch existiert
3. ⚠️ Cyboard Sword Grab/DoT - Status unklar, prüfen ob noch existiert (Grab-System existiert noch für HP)

**Weniger kritisch (aber trotzdem dokumentiert):**
4. Cyboard L1 Bomb Splash (Zeile 6664 - wird nicht verwendet)
5. HP Bike Collision (Zeilen 7793-7794, 7812)
6. Dance Battle Damage (Zeilen 2204-2205)
7. Ultimate Stun (Zeile 502)

**Empfehlung:** Alle diese Werte sollten durch Attack Catalog Descriptors und `AttackSystem.applyDamageWithDescriptor()` ersetzt werden.
