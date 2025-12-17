## Attack System Architecture

- **Goal**: keep combat data centralized in `attack-catalog.js`, character tuning in `character-catalog.js`, and runtime logic in `attack-system.js`. Legacy branches in `physics.js` are phased out once parity is verified.
- **Descriptors (`attack-catalog.js`)**: define base damage/knockback/stun, charge tiers, combo steps, FX ids, clank rules, projectiles, and the phases where hit detection runs (`detectInPhase`). Descriptors are keyed by `<character>:<attack>` or generic ids.
- **Character Config (`character-catalog.js`)**: per-character knobs for animation speeds, dash multipliers, combo window start, landing friction, cooldowns, and any other tuning. Always reference via lowercase character keys (`cyboard`, `fritz`, `hp`, ...).
- **Runtime (`attack-system.js`)**: `handleAttacks` seeds attack state, `updateAttackStates` delegates to character handlers, `detectHits` queries the descriptor to apply damage/knockback, and helper functions trigger FX. Dependencies (`setAnim`, `spawnEffect`, etc.) are injected via `AttackSystem.init()`.
- **Hitboxes (`renderer.js`)**: exposes helpers like `getR1Hitbox`, `getR1JumpHitbox`, `getL2SmashHitbox`. `AttackSystem` never owns geometry; it only requests rectangles from the renderer.
- **Supporting Systems**: `particle-system.js`, `audio-system.js`, `ultimeter-manager.js`, `dance-catalog.js`, rhythm/beat systems. Descriptors reference these via FX ids or metadata.

## Standard Flow for an Attack

1. **Input**: `input-handler.js` normalizes hardware input (e.g., `inputs.r1Down`, `inputs.r1Held`).
2. **Entry**: `AttackSystem.handleAttacks()` checks `canUseAbility` and initializes `p.attack` (type + phase) and animation via `setAnim` using config speed.
3. **Update Loop**: every frame `AttackSystem.updateAttackStates()` calls the character-specific handler (e.g., `handleCyboardR1`) with `grounded`, `inputs`, and `dt`.
4. **Phase Logic**: handler reads descriptor/config to manage transitions (start → loop/charge → release/combo) and set per-phase damage, dash, charge timers, FX overlays.
5. **Hit Detection**: after movement, `AttackSystem.detectHits()` retrieves the descriptor, builds the hitbox from `renderer.js`, and checks `rectsIntersect` against each target’s hurtbox. On hit, it calls `applyDamageWithDescriptor()`.
6. **Damage + FX**: `applyDamageWithDescriptor()` and helpers compute charge/percent scaling, apply knockback, set victim animation, and spawn FX/particle/rhythm events via descriptor metadata.
7. **Cleanup**: once animation finishes, the handler resets `p.attack` to `{ type: "none", phase: "none" }`, applying landing friction or dash slowdown as needed.

## Implementing a New Attack (Checklist)

1. **Audit Legacy Behavior**
   - Review old `physics.js` logic (or prototype spec) to extract timings, damage, knockback exponents, input windows, movement bursts, and FX.

2. **Describe the Attack**
   - Add/extend descriptor in `attack-catalog.js` with: `baseDamage`, `baseKnockback`, `knockbackAngle`, `knockbackExponent`, `detectInPhase`, `charge` data, `combo.steps`, `fx`, `projectile` metadata, clank/priority rules.
   - Use `cloneDeep` helpers if you need to extend defaults.

3. **Expose Character Tuning**
   - Add the per-character block in `character-catalog.js` (e.g., `cyboard.r1`). Include animation speeds, dash multipliers, combo window frames, landing friction, release dash frames, cooldown durations.
   - Ensure character keys are lowercase.

4. **Write/Update Handler**
   - In `attack-system.js`, create or update the relevant handler (`handle<Char><Attack>`). Use descriptor/config data instead of literals.
   - Maintain `p.attack` state: `phase`, `tickTimer`, `loopTime`, `chargeT`, `comboStep`, etc.
   - Gate aerial vs ground logic with `grounded`.
   - Use `setAnim(p, animName, shouldLoop, state, speed)` for transitions.
   - Reset attack state and velocities on completion.

5. **Hook Hit Detection**
   - In `detectHits()`, ensure the attack type and phase are covered. Request correct hitbox (`Renderer.getR1DashHitbox`, etc.) and call `applyDamageWithDescriptor()`.

6. **Wire Dependencies**
   - If the attack needs new FX or projectiles, ensure corresponding functions exist (e.g., `spawnEffect`) and are injected via `AttackSystem.init()`.

7. **Disable Legacy Branch**
   - Comment/remove the old code in `physics.js` once tests confirm parity.

8. **Test Thoroughly**
   - Dev mode ON for debug logs, then OFF for real timings.
   - Verify ground vs aerial, tap vs hold, combo follow-ups, projectiles, particles, rhythm bonuses.
   - Check both P1/P2, varying percents, edge cases (landing mid-attack, getting hit during charge).

## Troubleshooting Guide

- **No Damage/Knockback**: confirm descriptor `detectInPhase` contains the active phase; ensure `detectHits` branch runs for that attack type.
- **Combo Doesn’t Trigger**: check `comboWindowStartFrame` in character config vs animation length; log `p.frameIndex` and `inputs`.
- **Wrong Animation Speed**: verify `character-catalog` value and that handler passes it into `setAnim`.
- **Missing FX**: check descriptor `fx.hit.id` exists in the atlas; ensure `spawnGlobalEffect` is injected.
- **Charge Not Scaling**: confirm handler updates `p.attack.chargeT` and descriptor `maxCharge` aligns with config.
- **Landing Issues**: ensure `handleR1JumpAttack`/`handleR1DashAttack` apply landing friction from config.

## Coding Standards

- Always read attack configuration via `CharacterCatalog.getAttackConfig(charKey, state)`, using `charKey = p.charName.toLowerCase()`.
- Store any per-attack timers on `p.attack` so they persist between frames.
- Reset `p.attack` to `{ type: "none", phase: "none" }` when done to avoid stale state.
- Avoid direct imports from other modules; rely on dependency injection (`AttackSystem.init`).
- When adding new catalog data, keep names consistent (`r1`, `r1_combo`, `l2_ranged`, etc.).
- Maintain ASCII-only files unless the target file already contains Unicode.

## Quick Reference

- Initialize: `AttackSystem.init({ canUseAbility, startCooldown, setAnim, spawnEffect, spawnGlobalEffect, checkRhythmBonus, spawnRhythmEffect, rectsIntersect });`
- Clear state: `p.attack = { type: "none", phase: "none" };`
- Descriptor lookup: `const descriptor = AttackCatalog.getDescriptor(p, "r1");`
- Character config lookup: `const cfg = CharacterCatalog.getAttackConfig(charKey, state);`
- Set animation: `setAnim(p, "r1start", false, state, cfg.r1.animSpeed || 1);`
- Hit check: `const atkRect = Renderer.getR1Hitbox(p, state); if (rectsIntersect(atkRect, Renderer.getHurtbox(target))) {...}`

Keep this file updated whenever we expand the combat system. Future contributors should follow this document before implementing or modifying attack logic.

## Inputs

- Gamepad mapping:
  - R1: light
  - R2: heavy
  - L1: special
  - L2: charged
  - Ultimate: R3 (right stick press)
- Keyboard mapping remains unchanged (R2+L2 combo) unless specified otherwise.

## Ultimates (Modular)

- All ultimate flows are handled in `attack-system.js` (no legacy calls from `physics.js`).
- Character specifics:
  - HP: Bike loop for 10s with contact damage (per-target cooldown), ignores jump interrupts, exits to idle.
  - Fritz: Disco-ball scan projectile (range-capped), dash to target, finisher damage/KB.
  - Cyboard: Teleport to nearest target, finish animation, damage/KB, clean exit to idle.

Renderer: Ulti animations are protected from generic state switches; `setAnim` guards prevent premature interruption while `p.ultiPhase` is active.

## Phase 3 Audit Snapshot (Feb 2025)

- Descriptor inheritance fallback is implemented: character-specific descriptors inherit missing fields (e.g., movement, chargeStages, fx) from the generic attack descriptor.
- Hit detection now honors `descriptor.detectInPhase` for Cyboard, Fritz, and HP; hits only process in listed phases.
- R2 flows read `chargeStages` and `movement.releaseDashBase` from `attack-catalog.js`; release FX can be triggered via `fx.release.id`.
- Cyboard L2 smash uses catalog values (damage, stun, knockback, exponent) inside hit detection; hitbox growth logic remains runtime.
- Projectiles are catalog-driven:
  - Spawn/type resolved from `descriptor.projectile` (Cyboard L1 bomb, HP L2 mushroom, Cyboard R2 combo follow-up).
  - Impact FX resolved via `descriptor.fx.hit.id` with sensible fallbacks (`l1_impact`, `l2_impact`).
- Movement locks added to prevent drift during attack-controlled phases:
  - R2 release (all chars)
  - HP L1 ranged grab cast/pull/combo
- Remaining legacy items:
  - Legacy ultimate handlers in `physics.js` are disabled; do not re-enable. Any leftover helpers are safe to delete when no references remain.
  - Isolated hardcoded constants are being removed case-by-case as descriptors are expanded.
  - Simple attack types (`r1_circle_attack`, `r1_up_attack`, `r2_hit_followup`) still have minimal logic in `physics.js` (animation end checks only).
- Testing covers Fritz/Cyboard/HP R1, L1, L2 (ground/air, tap/hold, combos). R2 and L2 are tuned via descriptors; further tuning should occur in `attack-catalog.js`/`character-catalog.js`.
- **Cyboard L2 Smash Attack**: Fully migrated to `AttackSystem.handleCyboardL2()` (attack-system.js, line 4452). All phase logic (charge, jump, hover, fall, impact) is now in AttackSystem.
