window.AttackCatalog = (() => {
  /**
   * Centralised attack hierarchy catalog.
   *
   * Tier order (highest priority wins on simultaneous hits):
   * ULTIMATE (includes R2/L2 charged ultimates)
   * CHARGED_SMASH (fully charged heavy attacks)
   * SMASH (base L2/R2 heavy attacks)
   * GRAB (ranged/melee grabs that convert into follow ups)
   * SPECIAL (directional specials, dash attacks, unique skills)
   * COMBO (string continuations, charge releases below smash tier)
   * BASIC (neutral attacks, jabs)
   * PROJECTILE (detached hitboxes/projectiles)
   *
   * New attacks should be inserted with a descriptor so the system can reason
   * about priority, tie-breakers, and FX assignments without a state machine.
   */

  const TIERS = {
    ULTIMATE: { priority: 120, clankable: false },
    CHARGED_SMASH: { priority: 100, clankable: false },
    SMASH: { priority: 85, clankable: true },
    GRAB: { priority: 40, clankable: false }, // Reduced from 80 to match BASIC (no priority over attacks)
    SPECIAL: { priority: 70, clankable: true },
    COMBO: { priority: 55, clankable: true },
    BASIC: { priority: 40, clankable: true },
    PROJECTILE: { priority: 35, clankable: true },
    UTILITY: { priority: 30, clankable: true },
  };

  function cloneDeep(value) {
    if (Array.isArray(value)) {
      return value.map(cloneDeep);
    }
    if (value && typeof value === "object") {
      const cloned = {};
      for (const key in value) {
        cloned[key] = cloneDeep(value[key]);
      }
      return cloned;
    }
    return value;
  }

  function mergeDescriptors(primary, fallback) {
    if (!primary && !fallback) return null;
    if (!fallback) return cloneDeep(primary);
    if (!primary) return cloneDeep(fallback);
    const merged = cloneDeep(fallback);
    for (const key in primary) {
      if (primary[key] !== undefined) {
        merged[key] = cloneDeep(primary[key]);
      }
    }
    return merged;
  }

  const DEFAULT_DESCRIPTOR = {
    tier: "BASIC",
    priority: TIERS.BASIC.priority,
    chargePriorityBonus: 0,
    clankable: true,
    fx: {
      hit: null,
      clank: null,
      charge: [],
      release: null,
      finisher: null,
    },
    chargeStages: null,
    combo: null,
    projectile: null,
    dot: null,
    movement: null,
    ultimate: null,
    revertOnHit: false,

    // NEW - Combat Values
    baseDamage: 4,
    baseKnockback: 125,
    knockbackExponent: 1.2,
    stunDuration: 0.15,

    // NEW - Knockback Type
    knockbackType: "standard",
    knockbackAngle: 45,
    attackerMomentum: 0,

    // NEW - Charge Scaling
    maxCharge: 2.0,
    chargeScalingType: "linear",
    maxKnockback: 300,

    // NEW - Combo Support
    isComboFinisher: false,
    comboMultiplier: 2.0,

    // NEW - Frame Timing
    activeFrame: 2,

    // NEW - Collision Behavior
    bypassPlayerCollision: false, // Set to true for aerial attacks that should bypass player-on-player collision
  };

  const DESCRIPTORS = {
    // Walljump - Utility Movement
    walljump: {
      tier: "UTILITY",
      baseDamage: 0,
      baseKnockback: 0,
      knockbackExponent: 1.0,
      stunDuration: 0,
      knockbackType: "walljump",
      knockbackAngle: 45,
      activeFrame: 2,
      maxDuration: 0.083, // 5 frames @ 60fps
      bypassPlayerCollision: true,
      requiresWallContact: true,
    },
    // Fritz - Unified Values
    "fritz:r1": {
      tier: "BASIC",
      baseDamage: 4,
      baseKnockback: 5,
      knockbackExponent: 1.2,
      stunDuration: 0.15,
      knockbackType: "standard",
      knockbackAngle: 45,
      activeFrame: 2,
      movement: {
        dashTapWindow: 0.2,
        releaseDash: {
          frames: ["r1release"],
          damage: 5,
          dashSpeedMultiplier: 1.0,
        },
      },
      combo: {
        loopTickDamage: 4,
        loopTickSource: "animation",
        queueWindowFrames: 2,
      },
    },
    "fritz:r1_jump": {
      tier: "SPECIAL",
      baseDamage: 20,
      baseKnockback: 75,
      knockbackExponent: 1.2,
      stunDuration: 0.15,
      knockbackType: "dash",
      knockbackAngle: 25,
      attackerMomentum: 0.3,
      activeFrame: 1,
      bypassPlayerCollision: true, // Jump attack from above
      detectInPhase: ["active"],
      movement: {
        horizontalSpeedMultiplier: 9.7,
        landingFriction: 0.8,
        purelyHorizontal: true,
      },
    },
    "fritz:r1_dash_attack": {
      tier: "SPECIAL",
      baseDamage: 4,
      baseKnockback: 800,
      knockbackExponent: 1.2,
      stunDuration: 0.15,
      knockbackType: "standard",
      knockbackAngle: 15,
      activeFrame: 4,
      bypassPlayerCollision: true, // Dash attack can bypass collision
      movement: {
        horizontalSpeedMultiplier: 1.3,
        landingFriction: 0.7,
        purelyHorizontal: true,
        animSpeed: 0.85,
        dashRange: 360, // Dash range in pixels, aligned with HP (20% increase from 300)
      },
    },
    "fritz:r1_circle_attack": {
      tier: "SPECIAL",
      baseDamage: 4,
      baseKnockback: 175,
      knockbackExponent: 1.2,
      stunDuration: 0.15,
      knockbackType: "standard",
      knockbackAngle: 45,
      activeFrame: 2,
      bypassPlayerCollision: true, // Circle attack can bypass collision
    },
    "fritz:r1_up_attack": {
      tier: "SPECIAL",
      baseDamage: 4,
      baseKnockback: 175,
      knockbackExponent: 1.2,
      stunDuration: 0.15,
      knockbackType: "standard",
      knockbackAngle: 45,
      activeFrame: 2,
      bypassPlayerCollision: true, // Up attack from above
    },
    "fritz:r1_jump_attack": {
      tier: "SPECIAL",
      baseDamage: 4,
      baseKnockback: 175,
      knockbackExponent: 1.2,
      stunDuration: 0.15,
      knockbackType: "standard",
      knockbackAngle: 45,
      activeFrame: 2,
      bypassPlayerCollision: true, // Jump attack from above
    },
    "fritz:r1_combo_active": {
      tier: "COMBO",
      baseDamage: 4,
      baseKnockback: 2,
      knockbackExponent: 1.2,
      stunDuration: 0.15,
      knockbackType: "standard",
      knockbackAngle: 45,
      activeFrame: 2,
      combo: {
        steps: [
          {
            index: 1,
            queueWindowFrames: 2,
            dashMultiplier: 0.6,
          },
          {
            index: 2,
            queueWindowFrames: 1,
            dashMultiplier: 0.7,
          },
          {
            index: 3,
            finisher: true,
            damage: 10,
            stun: 0.4,
            knockback: {
              base: 110,
              exponent: 0.8,
              multiplier: 3.4,
              angle: 45,
            },
            dashDistance: 193,
            dragTarget: true,
          },
        ],
      },
    },
    "fritz:r2": {
      tier: "SMASH",
      baseDamage: 8,
      baseKnockback: 150,
      maxKnockback: 900,
      knockbackExponent: 1.3,
      stunDuration: 0.2,
      knockbackType: "standard",
      knockbackAngle: 45,
      maxCharge: 2.0,
      chargeScalingType: "linear",
      chargePriorityBonus: 12,
      activeFrame: 4,
      chargeStages: [
        {
          threshold: 0,
          damage: 4,
          knockback: 150,
          fx: { id: "r2_fx_low" },
          dashSpeed: 1800, // Base speed for tap
          dashRange: 250, // Base range for tap
        },
        {
          threshold: 0.8,
          damage: 7,
          knockback: 210,
          fx: { id: "r2_fx_mid" },
          dashSpeed: 1800, // Keep same speed to reach longer range (was 0.6x = 1080, too slow)
          dashRange: 300, // Longer range needs same or higher speed
        },
        {
          threshold: 1.5,
          damage: 12,
          knockback: 260,
          fx: { id: "r2_fx_high" },
          dashSpeed: 1800, // Keep same speed to reach longer range (was 0.8x = 1440, too slow)
          dashRange: 350, // Longer range needs same or higher speed
        },
        {
          threshold: 2.0,
          damage: 36, // Doubled at max charge
          knockback: 300, // Doubled knockback at max charge
          dashSpeed: 2400, // Higher speed for longest range (800 units needs more speed)
          dashRange: 800, // Doubled range at max charge
        },
      ],
      movement: {
        releaseDashBase: 1800, // Reduced from 3200 to 1800 for dodgeable dash attacks
        dashRange: 250, // Reduced from 400 to 250 for dodgeable dash attacks
        allowComboFollowup: true,
        comboWindowFrames: 2,
      },
    },
    "fritz:r2_combo": {
      tier: "COMBO",
      baseDamage: 15,
      baseKnockback: 200,
      knockbackExponent: 1.4,
      stunDuration: 0.3,
      knockbackType: "standard",
      knockbackAngle: 45,
      activeFrame: 2,
      clankable: false,
    },
    "fritz:l1_jab": {
      tier: "SPECIAL",
      baseDamage: 4,
      baseKnockback: 0,
      knockbackExponent: 1.0,
      stunDuration: 2.0,
      knockbackType: "none",
      knockbackAngle: 0,
      activeFrame: 2,
      clankable: false,
    },
    "fritz:l1_jab_combo": {
      tier: "COMBO",
      baseDamage: 6,
      baseKnockback: 90,
      knockbackExponent: 1.2,
      stunDuration: 0.2,
      knockbackType: "standard",
      knockbackAngle: 45,
      activeFrame: 1,
    },
    "fritz:l1_smash": {
      tier: "SMASH",
      baseDamage: 8,
      baseKnockback: 160,
      knockbackExponent: 1.35,
      stunDuration: 0.25,
      knockbackType: "standard",
      knockbackAngle: 45,
      maxCharge: 2.0,
      chargeScalingType: "linear",
      chargePriorityBonus: 12,
      chargeStages: [
        {
          threshold: 0,
          damage: 8,
          knockback: 160,
        },
        {
          threshold: 0.7,
          damage: 12,
          knockback: 240,
        },
        {
          threshold: 1.4,
          damage: 16,
          knockback: 320,
        },
        {
          threshold: 2.0,
          damage: 24,
          knockback: 420,
        },
      ],
      fx: {
        charge: [
          { id: "fx_charge_low" },
          { id: "fx_charge_mid" },
          { id: "fx_charge_high" },
        ],
        release: { id: "fx_fritz_l1_release" },
      },
    },
    "fritz:l2": {
      tier: "CHARGED_SMASH",
      baseDamage: 6,
      baseKnockback: 200,
      knockbackExponent: 1.2,
      stunDuration: 0.2,
      knockbackType: "standard",
      knockbackAngle: 45,
      maxCharge: 2.5,
      chargeScalingType: "linear",
      chargePriorityBonus: 10,
      chargeStages: [
        {
          threshold: 0,
          loops: 4,
          speedMultiplier: 1.0,
          damage: 6,
        },
        {
          threshold: 1.2,
          loops: 6,
          speedMultiplier: 1.35,
          damage: 8,
        },
        {
          threshold: 2.0,
          loops: 8,
          speedMultiplier: 1.6,
          damage: 10,
          finalHit: {
            damage: 18,
            stun: 1.0,
            knockback: {
              base: 420,
              exponent: 0.85,
              angleRange: [75, 105],
            },
          },
        },
      ],
      dot: {
        interval: 0.15,
        damagePerTick: 6,
        maxChargeStun: 0.9,
      },
      movement: {
        releaseMaxDistance: 220,
        releaseSlowdown: 0.3,
      },
      fx: {
        charge: [
          { id: "fx_charge_low" },
          { id: "fx_charge_mid" },
          { id: "fx_charge_high" },
        ],
        release: { id: "fx_fritz_l2_release" },
      },
    },
    "cyboard:r2": {
      tier: "SMASH",
      baseDamage: 8,
      baseKnockback: 150,
      maxKnockback: 1200,
      knockbackExponent: 1.3,
      stunDuration: 0.2,
      knockbackType: "standard",
      knockbackAngle: 30,
      maxCharge: 2.0,
      chargeScalingType: "linear",
      chargePriorityBonus: 12,
      activeFrame: 2,
      chargeStages: [
        {
          threshold: 0,
          damage: 4,
          fx: { id: "r2_fx_low" },
          dashSpeed: 1100, // Reduced from 3200 to 1800 for dodgeable dash attacks
          dashRange: 250, // Reduced from 400 to 250 for dodgeable dash attacks
        },
        {
          threshold: 0.8,
          damage: 7,
          fx: { id: "r2_fx_mid" },
          dashSpeed: 1400 * 0.6, // 0.6x base speed
          dashRange: 400, // Reduced from 550 to 300 for dodgeable dash attacks
        },
        {
          threshold: 1.5,
          damage: 12,
          fx: { id: "r2_fx_high" },
          dashSpeed: 1600 * 0.8, // 0.8x base speed
          dashRange: 600, // Reduced from 650 to 350 for dodgeable dash attacks
        },
        {
          threshold: 2.0,
          damage: 36, // Doubled at max charge
          knockback: 300, // Doubled knockback at max charge
          dashSpeed: 1800 * 1.0, // 1.0x base speed
          dashRange: 800, // Doubled range at max charge
        },
      ],
      movement: {
        releaseDashBase: 1800, // Reduced from 3200 to 1800 for dodgeable dash attacks
        dashRange: 250, // Reduced from 400 to 250 for dodgeable dash attacks
        allowComboFollowup: true,
        comboWindowFrames: 2,
      },
      projectile: {
        type: "r2_projectile",
        spawnOnMiss: true,
        requiresMaxCharge: true,
      },
    },
    "cyboard:r2_combo": {
      tier: "COMBO",
      baseDamage: 15,
      baseKnockback: 200,
      knockbackExponent: 1.4,
      stunDuration: 0.3,
      knockbackType: "standard",
      knockbackAngle: 45,
      activeFrame: 2,
      clankable: false,
    },
    "hp:r2": {
      tier: "SMASH",
      baseDamage: 8,
      baseKnockback: 300,
      maxKnockback: 900,
      knockbackExponent: 1.3,
      stunDuration: 0.2,
      knockbackType: "standard",
      knockbackAngle: 45,
      maxCharge: 2.0,
      chargeScalingType: "linear",
      activeFrame: 2,
    },

    // R1: basic tick-loop (tap)
    // NOTE: HP's R1 is a chargeable dash-release on hold (knockup/launcher).
    // The base dash range for release uses the reduced double-tap dash range
    // (see hp:r1_dash_attack.movement.dashRange) and scales up with charge.
    "hp:r1": {
      tier: "BASIC",
      baseDamage: 5,
      baseKnockback: 160,
      knockbackExponent: 1.2,
      stunDuration: 0.2,
      knockbackType: "standard",
      knockbackAngle: 85,
      activeFrame: 2,
      maxCharge: 2.0,
      chargeScalingType: "linear",
      chargeStages: [
        {
          threshold: 0,
          damage: 5,
          knockback: 160,
          knockbackAngle: 85,
        },
        {
          threshold: 0.8,
          damage: 8,
          knockback: 230,
          knockbackAngle: 85,
        },
        {
          threshold: 1.5,
          damage: 12,
          knockback: 300,
          knockbackAngle: 85,
        },
        {
          threshold: 2.0,
          damage: 15,
          knockback: 360,
          knockbackAngle: 85,
        },
      ],
      movement: {
        dashTapWindow: 0.2,
      },
    },

    // R1 combo active (multi-hit loop)
    "hp:r1_combo_active": {
      tier: "COMBO",
      baseDamage: 4,
      baseKnockback: 175,
      knockbackExponent: 1.2,
      stunDuration: 0.15,
      knockbackType: "standard",
      knockbackAngle: 45,
      activeFrame: 2,
      combo: {
        steps: [
          { index: 1, queueWindowFrames: 2, dashMultiplier: 0.6 },
          { index: 2, queueWindowFrames: 1, dashMultiplier: 0.7 },
          {
            index: 3,
            finisher: true,
            damage: 10,
            stun: 0.4,
            knockback: { base: 110, exponent: 0.8, multiplier: 3.4, angle: 45 },
            dashDistance: 193,
            dragTarget: true,
          },
        ],
      },
    },

    // R1 double-tap dash
    "hp:r1_dash_attack": {
      tier: "SPECIAL",
      baseDamage: 4,
      baseKnockback: 800,
      knockbackExponent: 1.2,
      stunDuration: 0.15,
      knockbackType: "standard",
      knockbackAngle: 10,
      activeFrame: 2,
      bypassPlayerCollision: true,
      movement: {
        horizontalSpeedMultiplier: 1.3,
        landingFriction: 0.7, // Reduced by 50% from 0.7
        purelyHorizontal: true,
        animSpeed: 0.8,
        // Hard limit for double-tap dash range. Reduced by 50% per request.
        // Previous: 210 -> reduced: 105
        dashRange: 300,
      },
    },

    // R1 air variant
    "hp:r1_jump": {
      tier: "SPECIAL",
      baseDamage: 10,
      baseKnockback: 75,
      knockbackExponent: 1.2,
      stunDuration: 0.15,
      knockbackType: "dash",
      knockbackAngle: 25,
      attackerMomentum: 0.3,
      activeFrame: 1,
      bypassPlayerCollision: true,
      detectInPhase: ["active"],
      movement: {
        horizontalSpeedMultiplier: 1.7,
        landingFriction: 1.4,
        purelyHorizontal: true,
      },
    },

    // L1 ranged grab (keep)
    "hp:l1_ranged_grab": {
      tier: "GRAB",
      baseDamage: 0,
      baseKnockback: 0,
      knockbackExponent: 1.0,
      stunDuration: 0,
      knockbackType: "standard",
      knockbackAngle: 45,
      clankable: false,
      activeFrame: 2,
      movement: {
        grabRange: 120,
        grabHeight: 80,
        detectFrame: 5,
        effectOffsetX: 188,
        effectOffsetY: 0,
        effectScale: 0.75,
        pullDuration: 0.25,
        safeDistance: 32,
      },
      combo: { comboWindow: 0, followupType: "l1_ranged_grab_combo" },
    },

    "hp:l1_ranged_grab_combo": {
      tier: "GRAB",
      baseDamage: 10,
      baseKnockback: 350,
      knockbackExponent: 1.45,
      stunDuration: 0.7,
      knockbackType: "launcher",
      knockbackAngle: 70,
      maxKnockback: 1200,
      maxCharge: 2.0,
      clankable: false,
      activeFrame: 2,
      movement: {
        finalKnockupFrame: 6,
        finalKnockupDamage: 8,
        lockTargetPosition: true,
        initialDamage: 8,
      },
    },

    // L2 (charged) and ranged variants
    "hp:l2": {
      tier: "CHARGED_SMASH",
      baseDamage: 6,
      baseKnockback: 150,
      maxKnockback: 900,
      knockbackExponent: 1.35,
      stunDuration: 0.3,
      knockbackType: "standard",
      knockbackAngle: 45,
      maxCharge: 2.0,
      chargeScalingType: "linear",
      chargePriorityBonus: 15,
      activeFrame: 2,
    },

    "hp:l2_ranged": {
      tier: "SMASH",
      baseDamage: 8,
      baseKnockback: 0,
      knockbackExponent: 1.0,
      stunDuration: 0,
      knockbackType: "none",
      knockbackAngle: 0,
      activeFrame: 2,
      maxCharge: 2.0,
      chargeStages: [
        { threshold: 0, fx: { id: "fx_charge_low" } },
        { threshold: 0.3, fx: { id: "fx_charge_low" } },
        { threshold: 0.8, fx: { id: "fx_charge_mid" } },
        { threshold: 1.5, fx: { id: "fx_charge_high" } },
      ],
      projectile: {
        type: "l2_mushroom",
        spawnOnRelease: true,
        spawnOnCharge: false,
      },
    },

    "hp:l2_projectile": {
      tier: "PROJECTILE",
      baseDamage: 8,
      baseKnockback: 300,
      knockbackExponent: 1.2,
      stunDuration: 1.2,
      knockbackType: "standard",
      knockbackAngle: 45,
      activeFrame: 2,
      fx: { hit: { id: "l2_impact" } },
    },

    // Keep HP ultimate
    "hp:r2_l2_ulti": {
      tier: "ULTIMATE",
      baseDamage: 50,
      baseKnockback: 200,
      maxKnockback: 3000,
      knockbackExponent: 1.3,
      stunDuration: 0.5,
      knockbackType: "standard",
      knockbackAngle: 45,
      clankable: false,
      activeFrame: 0,
    },

    // Ernst (1:1 copy of HP for initial testing)
    "ernst:r2": {
      tier: "SMASH",
      baseDamage: 8,
      baseKnockback: 150,
      maxKnockback: 1600,
      knockbackExponent: 1.3,
      stunDuration: 0.2,
      knockbackType: "standard",
      knockbackAngle: 45,
      maxCharge: 2.0,
      chargeScalingType: "linear",
      activeFrame: 2,
      chargeStages: [
        {
          threshold: 0,
          damage: 8,
          knockback: 200,
        },
        {
          threshold: 0.75,
          damage: 12,
          knockback: 300,
        },
        {
          threshold: 1.5,
          damage: 18,
          knockback: 400,
        },
        {
          threshold: 2.0,
          damage: 26,
          knockback: 600,
        },
      ],
    },

    // R1: basic tick-loop (tap)
    // NOTE: Ernst's R1 is a chargeable dash-release on hold (knockup/launcher).
    // The base dash range for release uses the reduced double-tap dash range
    // (see ernst:r1_dash_attack.movement.dashRange) and scales up with charge.
    "ernst:r1": {
      tier: "BASIC",
      baseDamage: 6,
      baseKnockback: 120,
      knockbackExponent: 1.2,
      stunDuration: 0.15,
      // Default release launches at 45° with standard knockback
      knockbackType: "standard",
      knockbackAngle: 15,
      activeFrame: 2,
      // Allow charging to increase dash range and damage
      maxCharge: 2.0,
      chargeScalingType: "linear",
      chargeStages: [
        {
          threshold: 0,
          damage: 6,
          knockback: 120,
          knockbackAngle: 15,
        },
        {
          threshold: 0.8,
          damage: 9,
          knockback: 220,
          knockbackAngle: 22,
        },
        {
          threshold: 1.5,
          damage: 12,
          knockback: 320,
          knockbackAngle: 28,
        },
        {
          threshold: 2.0,
          damage: 15,
          knockback: 400,
          knockbackAngle: 32,
        },
      ],
      movement: {
        dashTapWindow: 0.2,
        loopTickDamage: 1,
        releaseDamage: 5,
        releaseDashFrames: [4, 5, 6],
        releaseDashMultiplier: 4.0,
        // Use this as the base dash distance for release (numbers in px)
        releaseDashBase: 210,
      },
    },

    // R1 combo active (multi-hit loop)
    "ernst:r1_combo_active": {
      tier: "COMBO",
      baseDamage: 4,
      baseKnockback: 175,
      knockbackExponent: 1.2,
      stunDuration: 0.15,
      knockbackType: "standard",
      knockbackAngle: 30,
      activeFrame: 2,
      combo: {
        steps: [
          { index: 1, queueWindowFrames: 2, dashMultiplier: 0.6 },
          { index: 2, queueWindowFrames: 1, dashMultiplier: 0.7 },
          {
            index: 3,
            finisher: true,
            damage: 10,
            stun: 0.4,
            knockback: { base: 110, exponent: 0.8, multiplier: 3.4, angle: 45 },
            dashDistance: 386, // Doubled from 193
            dragTarget: true,
          },
        ],
      },
    },

    // R1 double-tap dash
    "ernst:r1_dash_attack": {
      tier: "SPECIAL",
      baseDamage: 2,
      baseKnockback: 800,
      knockbackExponent: 1.2,
      stunDuration: 0.15,
      knockbackType: "standard",
      knockbackAngle: 10,
      activeFrame: 2,
      bypassPlayerCollision: true,
      movement: {
        horizontalSpeedMultiplier: 1.3,
        landingFriction: 0.7, // Reduced by 50% from 0.7
        purelyHorizontal: true,
        animSpeed: 0.85,
        // Hard limit for double-tap dash range. Reduced by 50% per request.
        // Previous: 210 -> reduced: 105
        dashRange: 300,
      },
    },

    // R1 air variant
    "ernst:r1_jump": {
      tier: "SPECIAL",
      baseDamage: 10,
      baseKnockback: 75,
      knockbackExponent: 1.2,
      stunDuration: 0.15,
      knockbackType: "dash",
      knockbackAngle: 25,
      attackerMomentum: 0.3,
      activeFrame: 1,
      bypassPlayerCollision: true,
      detectInPhase: ["active"],
      movement: {
        horizontalSpeedMultiplier: 1.7,
        landingFriction: 1.4,
        purelyHorizontal: true,
      },
    },

    // L1 ranged grab (keep)
    "ernst:l1_ranged_grab": {
      tier: "GRAB",
      baseDamage: 0,
      baseKnockback: 0,
      knockbackExponent: 1.0,
      stunDuration: 0,
      knockbackType: "standard",
      knockbackAngle: 45,
      clankable: false,
      activeFrame: 2,
      movement: {
        grabRange: 120,
        grabHeight: 80,
        detectFrame: 5,
        effectOffsetX: 188,
        effectOffsetY: 0,
        effectScale: 0.75,
        pullDuration: 0.25,
        safeDistance: 32,
      },
      combo: { comboWindow: 0, followupType: "l1_ranged_grab_combo" },
    },

    "ernst:l1_ranged_grab_combo": {
      tier: "GRAB",
      baseDamage: 1,
      baseKnockback: 500,
      knockbackExponent: 1.45,
      stunDuration: 0.7,
      knockbackType: "launcher",
      knockbackAngle: 70,
      maxKnockback: 1200,
      maxCharge: 2.0,
      clankable: false,
      activeFrame: 2,
      movement: {
        finalKnockupFrame: 6,
        finalKnockupDamage: 8,
        lockTargetPosition: true,
        initialDamage: 8,
      },
    },

    // L2 (charged) and ranged variants
    "ernst:l2": {
      tier: "CHARGED_SMASH",
      baseDamage: 6,
      baseKnockback: 150,
      maxKnockback: 900,
      knockbackExponent: 1.35,
      stunDuration: 0.3,
      knockbackType: "standard",
      knockbackAngle: 45,
      maxCharge: 2.0,
      chargeScalingType: "linear",
      chargePriorityBonus: 15,
      activeFrame: 2,
    },

    "ernst:l2_ranged": {
      tier: "SMASH",
      baseDamage: 8,
      baseKnockback: 0,
      knockbackExponent: 1.0,
      stunDuration: 0,
      knockbackType: "none",
      knockbackAngle: 0,
      activeFrame: 2,
      maxCharge: 2.0,
      chargeStages: [
        { threshold: 0, fx: { id: "fx_charge_low" } },
        { threshold: 0.3, fx: { id: "fx_charge_low" } },
        { threshold: 0.8, fx: { id: "fx_charge_mid" } },
        { threshold: 1.5, fx: { id: "fx_charge_high" } },
      ],
      projectile: {
        type: "l2_mushroom",
        spawnOnRelease: true,
        spawnOnCharge: false,
      },
    },

    "ernst:l2_projectile": {
      tier: "PROJECTILE",
      baseDamage: 4,
      baseKnockback: 0,
      knockbackExponent: 1.2,
      stunDuration: 3,
      knockbackType: "standard",
      knockbackAngle: 45,
      activeFrame: 2,
      fx: { hit: { id: "l2_impact" } },
    },

    // Ernst ultimate: Projectile-based (no knockback, 4096 total damage)
    "ernst:r2_l2_ulti": {
      tier: "ULTIMATE",
      baseDamage: 0, // Damage is applied per projectile hit
      baseKnockback: 0, // No knockback
      maxKnockback: 0,
      knockbackExponent: 1.0,
      stunDuration: 0, // Stun handled by hurt lock
      knockbackType: "none",
      knockbackAngle: 0,
      clankable: false,
      activeFrame: 0,
      projectile: {
        type: "ernst_ulti_projectile",
        spawnOnLoop: true, // Spawn 2x per ulti_loop
        spawnsPerLoop: 2,
        damagePerHit: 256, // 4096 total / 16 projectiles (2 per loop * 8 loops in 10s)
        hurtLockDuration: 10.0, // Lock until ultimate ends
      },
    },

    // Fritz Ultimate
    "fritz:r2_l2_ulti": {
      tier: "ULTIMATE",
      baseDamage: 100,
      baseKnockback: 1100,
      maxKnockback: 6000,
      knockbackExponent: 1.9,
      stunDuration: 2.5,
      knockbackType: "standard",
      knockbackAngle: 45,
      clankable: false,
      activeFrame: 0,
    },

    // Charly (identical to HP)
    "charly:r1": {
      tier: "BASIC",
      baseDamage: 4,
      baseKnockback: 175,
      knockbackExponent: 1.2,
      stunDuration: 0.15,
      knockbackType: "standard",
      knockbackAngle: 45,
      activeFrame: 2,
    },
    "charly:r2": {
      tier: "SMASH",
      baseDamage: 8,
      baseKnockback: 150,
      maxKnockback: 300,
      knockbackExponent: 1.3,
      stunDuration: 0.2,
      knockbackType: "standard",
      knockbackAngle: 45,
      maxCharge: 2.0,
      chargeScalingType: "linear",
      activeFrame: 2,
    },
    "charly:l1_jab": {
      tier: "BASIC",
      baseDamage: 3,
      baseKnockback: 75,
      knockbackExponent: 1.2,
      stunDuration: 0.1,
      knockbackType: "standard",
      knockbackAngle: 45,
      activeFrame: 3,
    },
    "charly:l1_jab_combo": {
      tier: "COMBO",
      baseDamage: 3,
      baseKnockback: 75,
      knockbackExponent: 1.2,
      stunDuration: 0.1,
      knockbackType: "standard",
      knockbackAngle: 45,
      activeFrame: 1,
    },
    "charly:l1_smash": {
      tier: "SPECIAL",
      baseDamage: 3,
      baseKnockback: 75,
      knockbackExponent: 1.2,
      stunDuration: 0.1,
      knockbackType: "standard",
      knockbackAngle: 45,
      activeFrame: 2,
    },
    "charly:l1_ranged_grab": {
      tier: "GRAB",
      baseDamage: 0,
      baseKnockback: 0,
      knockbackExponent: 1.0,
      stunDuration: 0,
      knockbackType: "standard",
      knockbackAngle: 45,
      clankable: false,
      activeFrame: 2,
    },
    "charly:l1_ranged_grab_combo": {
      tier: "GRAB",
      baseDamage: 10,
      baseKnockback: 250,
      knockbackExponent: 1.3,
      stunDuration: 0.5,
      knockbackType: "launcher",
      knockbackAngle: 80,
      maxCharge: 2.0,
      clankable: false,
      activeFrame: 2,
    },
    "charly:l2": {
      tier: "CHARGED_SMASH",
      baseDamage: 6,
      baseKnockback: 150,
      maxKnockback: 300,
      knockbackExponent: 1.35,
      stunDuration: 0.3,
      knockbackType: "standard",
      knockbackAngle: 45,
      maxCharge: 2.0,
      chargeScalingType: "linear",
      chargePriorityBonus: 15,
      activeFrame: 2,
    },
    "charly:l2_ranged": {
      tier: "SMASH",
      baseDamage: 8,
      baseKnockback: 0, // Projectile
      knockbackExponent: 1.0,
      stunDuration: 0,
      knockbackType: "none",
      knockbackAngle: 0,
      activeFrame: 2,
    },
    "charly:r2_l2_ulti": {
      tier: "ULTIMATE",
      baseDamage: 50,
      baseKnockback: 800,
      knockbackExponent: 1.3,
      stunDuration: 0.5,
      knockbackType: "standard",
      knockbackAngle: 45,
      clankable: false,
      activeFrame: 0,
    },

    // Cyboard - Unified Values
    "cyboard:r1": {
      tier: "BASIC",
      baseDamage: 2,
      baseKnockback: 120,
      knockbackExponent: 1.15,
      stunDuration: 0.18,
      knockbackType: "standard",
      knockbackAngle: 40,
      activeFrame: 2,
      maxCharge: 2.0,
      chargeScalingType: "linear",
      disableAutoChargeScaling: true,
      chargeStages: [
        {
          threshold: 0,
          damage: 2,
          knockback: 120,
          stun: 0.18,
          fx: { id: "fx_charge_low" },
        },
        {
          threshold: 0.6,
          damage: 5,
          knockback: 160,
          stun: 0.22,
          fx: { id: "fx_charge_mid" },
        },
        {
          threshold: 1.2,
          damage: 7,
          knockback: 200,
          stun: 0.27,
          fx: { id: "fx_charge_high" },
        },
        {
          threshold: 1.8,
          damage: 10,
          knockback: 400,
          stun: 0.32,
          fx: { id: "fx_charge_high" },
        },
      ],
      release: {
        activeFrames: [2, 7],
        knockbackFrame: 7,
        recoveryFrames: [8, 9],
        maxChargeStunDuration: 0.45,
        maxChargeKnockbackDelay: true,
      },
      detectInPhase: ["release"],
    },
    "cyboard:r1_dash_attack": {
      tier: "SPECIAL",
      baseDamage: 4,
      baseKnockback: 800,
      knockbackExponent: 1.2,
      stunDuration: 0.15,
      knockbackType: "standard",
      knockbackAngle: 45,
      activeFrame: 2,
      bypassPlayerCollision: true, // Dash attack can bypass collision
    },
    "cyboard:r1_jump_attack": {
      tier: "SPECIAL",
      baseDamage: 4,
      baseKnockback: 175,
      knockbackExponent: 1.2,
      stunDuration: 0.15,
      knockbackType: "standard",
      knockbackAngle: 45,
      activeFrame: 2,
      bypassPlayerCollision: true, // Jump attack from above
    },
    "cyboard:r1_jump": {
      tier: "SPECIAL",
      baseDamage: 4,
      baseKnockback: 75,
      knockbackExponent: 1.2,
      stunDuration: 0.15,
      knockbackType: "dash",
      knockbackAngle: 25,
      attackerMomentum: 0.3,
      activeFrame: 1,
      bypassPlayerCollision: true, // Jump attack from above
      detectInPhase: ["active"],
      movement: {
        horizontalSpeedMultiplier: 2.7,
        landingFriction: 0.8,
        purelyHorizontal: true,
      },
    },
    "cyboard:r2_combo": {
      tier: "COMBO",
      baseDamage: 8,
      baseKnockback: 150,
      maxKnockback: 1200,
      knockbackExponent: 1.3,
      stunDuration: 0.2,
      knockbackType: "standard",
      knockbackAngle: 45,
      activeFrame: 2,
    },
    "cyboard:r2_hit_followup": {
      tier: "SPECIAL",
      baseDamage: 8,
      baseKnockback: 150,
      knockbackExponent: 1.3,
      stunDuration: 0.2,
      knockbackType: "standard",
      knockbackAngle: 45,
      activeFrame: 2,
    },
    "cyboard:r2_projectile": {
      tier: "PROJECTILE",
      baseDamage: 8,
      baseKnockback: 0, // Projectile
      knockbackExponent: 1.0,
      stunDuration: 0,
      knockbackType: "none",
      knockbackAngle: 0,
      activeFrame: 2,
    },
    "cyboard:l1": {
      tier: "COMBO",
      baseDamage: 3,
      baseKnockback: 75,
      knockbackExponent: 1.2,
      stunDuration: 0.1,
      knockbackType: "standard",
      knockbackAngle: 45,
      detectInPhase: ["start", "release"],
      activeFrame: 2,
      maxCharge: 1.5,
      chargeStages: [
        {
          threshold: 0,
          fx: { id: "fx_charge_low" },
        },
        {
          threshold: 0.3,
          fx: { id: "fx_charge_low" },
        },
        {
          threshold: 0.7,
          fx: { id: "fx_charge_mid" },
        },
        {
          threshold: 1.2,
          fx: { id: "fx_charge_high" },
        },
      ],
      projectile: {
        type: "l1_bomb",
        spawnOnRelease: true,
        spawnOnCharge: false,
      },
    },
    "cyboard:l1_bomb": {
      tier: "PROJECTILE",
      baseDamage: 6,
      baseKnockback: 0, // Projectile
      knockbackExponent: 1.0,
      stunDuration: 0,
      knockbackType: "none",
      knockbackAngle: 0,
      activeFrame: 2,
      fx: { hit: { id: "l1_impact" } },
    },
    "cyboard:l2_smash": {
      tier: "SPECIAL",
      baseDamage: 12,
      baseKnockback: 250,
      knockbackExponent: 1.2,
      stunDuration: 0.3,
      knockbackType: "explosion",
      knockbackAngle: 0, // Radial
      activeFrame: 2,
      bypassPlayerCollision: true, // Explosion attack from above
      movement: {
        explosionRadius: 100,
        explosionHeight: 100,
        forwardOffset: 0,
        verticalOffset: 0,
      },
    },
    "hp:l2_projectile": {
      tier: "PROJECTILE",
      baseDamage: 8,
      baseKnockback: 300,
      knockbackExponent: 1.2,
      stunDuration: 0.2,
      knockbackType: "standard",
      knockbackAngle: 45,
      activeFrame: 2,
      fx: { hit: { id: "l2_impact" } },
    },
    "cyboard:r2_l2_ulti": {
      tier: "ULTIMATE",
      baseDamage: 40,
      baseKnockback: 1050,
      maxKnockback: 5000,
      knockbackExponent: 1.3,
      stunDuration: 0.5,
      knockbackType: "standard",
      knockbackAngle: 45,
      clankable: false,
      activeFrame: 0,
    },
    "cyboard:grab": {
      tier: "GRAB",
      baseDamage: 10, // Damage on throw
      baseKnockback: 300,
      knockbackExponent: 1.2,
      stunDuration: 0.4,
      knockbackType: "standard",
      knockbackAngle: 45,
      activeFrame: 2, // Detection starts at frame 2 (after 2 windup frames)
      clankable: false, // Grabs usually don't clank with hits, they get interrupted
      grab: {
        detectFrames: 3, // How many frames detection lasts
        liftFrame: 3, // Relative to active start (Frame 4 of active = index 3)
        liftHeight: 80,
        throwFrame: 7, // End of active phase
      },
    },
    "fritz:grab": {
      tier: "GRAB",
      baseDamage: 10,
      baseKnockback: 300,
      knockbackExponent: 1.2,
      stunDuration: 0.4,
      knockbackType: "standard",
      knockbackAngle: 5,
      activeFrame: 2,
      clankable: false,
      grab: {
        detectFrames: 3,
        liftFrame: 1,
        liftHeight: 20,
        throwFrame: 7,
      },
    },
    "hp:grab": {
      tier: "GRAB",
      baseDamage: 10,
      baseKnockback: 300,
      knockbackExponent: 1.2,
      stunDuration: 0.4,
      knockbackType: "standard",
      knockbackAngle: 20,
      activeFrame: 2,
      clankable: false,
      grab: {
        detectFrames: 3,
        throwFrame: 7,
        rotateVictim: true,
        jumpSlam: true,
      },
    },
    "ernst:grab": {
      tier: "GRAB",
      baseDamage: 10,
      baseKnockback: 300,
      knockbackExponent: 1.2,
      stunDuration: 0.4,
      knockbackType: "standard",
      knockbackAngle: 45,
      activeFrame: 2,
      clankable: false,
      grab: {
        detectFrames: 3,
        liftFrame: 3,
        liftHeight: 80,
        throwFrame: 7,
      },
    },

    // Generic fallbacks by attackType
    r2_l2_ulti: { tier: "ULTIMATE", clankable: false },
    r2: { tier: "SMASH" },
    l2: { tier: "SMASH" },
    l2_ranged: { tier: "SMASH" },
    l1_smash: { tier: "SPECIAL" },
    l1: { tier: "COMBO" },
    l1_jab_combo: { tier: "COMBO" },
    l1_jab: { tier: "BASIC" },
    r1_combo_active: { tier: "COMBO" },
    r1_combo: { tier: "COMBO" },
    r1_circle_attack: { tier: "SPECIAL" },
    r1_up_attack: { tier: "SPECIAL" },
    r1_jump_attack: { tier: "SPECIAL", detectInPhase: ["active"] },
    r1_jump: { tier: "SPECIAL", detectInPhase: ["active"] },
    r1: { tier: "BASIC" },
    projectile: { tier: "PROJECTILE" },
    grab: { tier: "GRAB", clankable: false },
  };

  let tradeLoggingEnabled = false;

  function cloneFxConfig(fx) {
    if (!fx) return null;
    if (Array.isArray(fx)) {
      return fx.map(cloneFxConfig);
    }
    if (typeof fx === "object") {
      const cloned = { ...fx };
      if (fx.options) cloned.options = { ...fx.options };
      if (fx.stages) cloned.stages = cloneFxConfig(fx.stages);
      if (fx.fx) cloned.fx = cloneFxConfig(fx.fx);
      return cloned;
    }
    return fx;
  }

  function attemptDescriptorLookup(charName, attackType) {
    if (!attackType) return null;
    const lowerChar = charName ? String(charName).toLowerCase() : null;
    const charKey = lowerChar ? `${lowerChar}:${attackType}` : null;
    if (charKey && DESCRIPTORS[charKey]) return DESCRIPTORS[charKey];
    if (DESCRIPTORS[attackType]) return DESCRIPTORS[attackType];
    return null;
  }

  function computeChargeRatio(base, context = {}) {
    if (!base) return 0;
    const maxCharge = context.maxCharge || base.maxCharge;
    if (!maxCharge || maxCharge <= 0) return 0;
    const chargeTime = context.chargeTime || 0;
    const ratio = Math.max(0, Math.min(1, chargeTime / maxCharge));
    return ratio;
  }

  function getDescriptor(attacker, attackType, context = {}) {
    const lowerChar = attacker?.charName
      ? String(attacker.charName).toLowerCase()
      : null;
    const charKey = lowerChar ? `${lowerChar}:${attackType}` : null;
    const specific = charKey ? DESCRIPTORS[charKey] : null;
    const generic = DESCRIPTORS[attackType] || null;
    const baseDesc = mergeDescriptors(specific, generic) || DEFAULT_DESCRIPTOR;
    const tier = baseDesc.tier || DEFAULT_DESCRIPTOR.tier;
    const tierInfo = TIERS[tier] || TIERS.BASIC;
    const basePriority = baseDesc.priority ?? tierInfo.priority;
    const chargeRatio =
      context.chargeRatio ?? computeChargeRatio(baseDesc, context);
    const chargeBonus = baseDesc.chargePriorityBonus || 0;

    return {
      id: `${attacker?.charName || "unknown"}:${attackType || "unknown"}`,
      attackType: attackType || "unknown",
      charName: attacker?.charName || null,
      tier,
      priority: Math.round(basePriority + chargeRatio * chargeBonus),
      chargeRank: chargeRatio,
      clankable: baseDesc.clankable ?? tierInfo.clankable ?? true,
      fx: {
        hit: cloneFxConfig(baseDesc.fx?.hit),
        clank: cloneFxConfig(baseDesc.fx?.clank),
        charge: cloneFxConfig(baseDesc.fx?.charge),
        release: cloneFxConfig(baseDesc.fx?.release),
        finisher: cloneFxConfig(baseDesc.fx?.finisher),
      },

      chargeStages: cloneDeep(baseDesc.chargeStages),
      combo: cloneDeep(baseDesc.combo),
      projectile: cloneDeep(baseDesc.projectile),
      dot: cloneDeep(baseDesc.dot),
      movement: cloneDeep(baseDesc.movement),
      ultimate: cloneDeep(baseDesc.ultimate),

      // NEW - Combat Values
      baseDamage: baseDesc.baseDamage ?? DEFAULT_DESCRIPTOR.baseDamage,
      baseKnockback: baseDesc.baseKnockback ?? DEFAULT_DESCRIPTOR.baseKnockback,
      knockbackExponent:
        baseDesc.knockbackExponent ?? DEFAULT_DESCRIPTOR.knockbackExponent,
      stunDuration: baseDesc.stunDuration ?? DEFAULT_DESCRIPTOR.stunDuration,

      // NEW - Knockback Type
      knockbackType: baseDesc.knockbackType ?? DEFAULT_DESCRIPTOR.knockbackType,
      knockbackAngle:
        baseDesc.knockbackAngle ?? DEFAULT_DESCRIPTOR.knockbackAngle,
      attackerMomentum:
        baseDesc.attackerMomentum ?? DEFAULT_DESCRIPTOR.attackerMomentum,

      // NEW - Charge Scaling
      maxCharge: baseDesc.maxCharge ?? DEFAULT_DESCRIPTOR.maxCharge,
      chargeScalingType:
        baseDesc.chargeScalingType ?? DEFAULT_DESCRIPTOR.chargeScalingType,
      maxKnockback: baseDesc.maxKnockback ?? DEFAULT_DESCRIPTOR.maxKnockback,

      // NEW - Combo Support
      isComboFinisher:
        baseDesc.isComboFinisher ?? DEFAULT_DESCRIPTOR.isComboFinisher,
      comboMultiplier:
        baseDesc.comboMultiplier ?? DEFAULT_DESCRIPTOR.comboMultiplier,

      // NEW - Frame Timing
      activeFrame: baseDesc.activeFrame ?? DEFAULT_DESCRIPTOR.activeFrame,

      // NEW - Collision Behavior
      bypassPlayerCollision:
        baseDesc.bypassPlayerCollision ??
        DEFAULT_DESCRIPTOR.bypassPlayerCollision,

      // pass-through custom fields (e.g., animation speed tweaks)
      animSpeed: baseDesc.animSpeed,
      metadata: {
        basePriority,
        tierPriority: tierInfo.priority,
        chargePriorityBonus: chargeBonus,
        maxCharge: baseDesc.maxCharge || context.maxCharge || null,
        guardBreak: baseDesc.guardBreak || false,
      },
    };
  }

  function describeHit(hit) {
    const desc = hit?.descriptor;
    if (!desc) return "unknown";
    return `${desc.attackType} (tier=${desc.tier}, prio=${desc.priority})`;
  }

  function logTrade(result, winner, loser) {
    if (!tradeLoggingEnabled) return;
    console.log(
      `[AttackTrade] ${result}: ${describeHit(winner)} vs ${describeHit(loser)}`
    );
  }

  function enableTradeLogging(enabled) {
    tradeLoggingEnabled = !!enabled;
  }

  const api = {
    TIERS,
    getDescriptor,
    enableTradeLogging,
    logTrade,
  };

  if (typeof window !== "undefined") {
    window.__modDebug = window.__modDebug || {};
    window.__modDebug.attackCatalog = api;
  }

  return api;
})();
