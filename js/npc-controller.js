// NPC Controller - Simulates inputs for Player 2 with full ability support
window.NPCController = (() => {
  let enabled = false;
  let lastRollTime = 0;
  let beatCounter = 0;
  let dodgeCooldown = 0;

  // NPC State Management
  let npcState = {
    targetDistance: 150,
    lastAttackType: null,
    comboStep: 0,
    lastHitTime: 0,
    lastR1Time: 0, // For double-tap detection
    attackCooldowns: {},
    lastActionTime: 0,
    preferredRange: 150,
    l2ChargeStart: 0, // Track when L2 charge started
    l2Charging: false, // Track if currently charging L2
    lastDanceTime: 0, // Track last dance move
    lastJumpTime: 0, // Track last jump to avoid spam
    incomingAttackCounter: 0,
    nextDodgeAttempt: 3 + Math.floor(Math.random() * 3),
    shouldDodgeThisAttack: false,
    dodgeAttemptedForCurrentAttack: false,
    lastTrackedAttackRef: null,
    lastOpponentAttackPhase: "none",
    // Tutorial-specific deterministic beat-charge behavior
    beatChargeCollecting: false,
    beatChargeTarget: 4, // Number of perfect beats to collect deterministically
    lastBeatDanceAttempt: 0,
    beatAggressiveMode: false,
    // Double-tap dash tracking
    doubleDashState: {
      waitingForSecondTap: false,
      queuedAt: 0,
      lastUsedAt: 0,
    },
    lastAttackChoice: null,
    // --- Strategy Layer ---
    strategy: {
      currentMode: "ZONE_SEEKER", // "ZONE_SEEKER", "DANCE_FOCUS", "COMBAT_DEFENSE", "BEAT_STEAL", "ULTIMATE_SEEK", "TACTICAL_DANCE_COMBAT"
      confidence: 1.0,
      lastChange: 0,
      modeStartTime: 0,
    },
    playerProfile: {
      aggressionScore: 0,
      rhythmSkill: 0,
      recentActions: [], // { type: "attack"|"hit", time: number }
    },
    resources: {
      beatCharges: 0,
      ultReady: false,
      healthState: "high",
    },
    // Attack cooldowns per type
    attackCooldowns: {
      r1: 0,
      r2: 0,
      l1: 0,
      l2: 0,
      grab: 0,
    },
    lastAttackAnim: null, // Track last attack animation to prevent spam
  };

  // Proximity threshold (in pixels) at which mere closeness counts as a threat.
  const PROX_THREAT_DISTANCE = 140;

  function toggle() {
    enabled = !enabled;
    console.log(`🤖 NPC ${enabled ? "ENABLED" : "DISABLED"}`);
    return enabled;
  }

  function enable() {
    enabled = true;
    console.log(`🤖 NPC ENABLED`);
    return enabled;
  }

  function disable() {
    enabled = false;
    console.log(`🤖 NPC DISABLED`);
    return enabled;
  }

  function isEnabled() {
    return enabled;
  }

  // Helper: Check if ability can be used (replicates Physics.canUseAbility logic)
  function canUseAbility(p, ability) {
    return !p.cooldowns || p.cooldowns[ability] <= 0;
  }

  // Heatmap Helpers ---------------------------------------------------------
  function scaleToHeatmap(x, y, data, state) {
    if (!data) return { x: 0, y: 0 };

    const cameraBounds = state?.cameraBounds;
    if (!cameraBounds) {
      return { x: x | 0, y: y | 0 };
    }

    const stageWidth =
      cameraBounds.width ??
      window.GameState?.CONSTANTS?.NATIVE_WIDTH ??
      data.width;
    const stageHeight =
      cameraBounds.height ??
      window.GameState?.CONSTANTS?.NATIVE_HEIGHT ??
      data.height;
    const stageX = cameraBounds.x ?? 0;
    const stageY = cameraBounds.y ?? 0;

    const scaleX = data.width / stageWidth;
    const scaleY = data.height / stageHeight;

    const hx = (x - stageX) * scaleX;
    const hy = (y - stageY) * scaleY;

    return { x: hx | 0, y: hy | 0 };
  }

  function isHeatmapSolid(x, y, data, state) {
    if (!data) return false;
    const coords = scaleToHeatmap(x, y, data, state);
    const ix = Math.max(0, Math.min(data.width - 1, coords.x));
    const iy = Math.max(0, Math.min(data.height - 1, coords.y));
    const index = (iy * data.width + ix) * 4 + 3; // Alpha channel
    return data.data[index] > 128;
  }

  function isGroundPixel(x, y, state) {
    if (!state) return false;
    return (
      isHeatmapSolid(x, y, state.groundData, state) ||
      isHeatmapSolid(x, y, state.semisolidData, state)
    );
  }

  function isOnSemisolidPlatform(p, state) {
    if (!state?.semisolidData || !p.grounded) return false;
    const hb = window.Renderer?.getHurtbox?.(p);
    if (!hb) return false;

    // Check if standing on semisolid (but not on regular ground)
    const footX = hb.left + hb.w / 2;
    const footY = hb.top + hb.h + 2; // Just below feet

    const onSemisolid = isHeatmapSolid(
      footX,
      footY,
      state.semisolidData,
      state
    );
    const onRegularGround = isHeatmapSolid(
      footX,
      footY,
      state.groundData,
      state
    );

    // On semisolid but NOT on regular ground = can drop through
    return onSemisolid && !onRegularGround;
  }

  function hasGroundBelow(x, y, state, maxDrop = 48, step = 6) {
    if (!state) return false;
    for (let dy = 0; dy <= maxDrop; dy += step) {
      if (isGroundPixel(x, y + dy, state)) {
        return true;
      }
    }
    return false;
  }

  function scanForLanding(p, direction, state, options = {}) {
    const {
      maxDistance = 160,
      step = 12,
      dropDistance = 64,
      footY = p.pos.y,
    } = options;

    if (!direction) return null;

    for (let offset = step; offset <= maxDistance; offset += step) {
      const sampleX = p.pos.x + direction * offset;
      if (hasGroundBelow(sampleX, footY, state, dropDistance)) {
        return offset;
      }
    }

    return null;
  }

  function getEdgeInfo(p, axis, state, options = {}) {
    if (!state || !axis) {
      return { isGap: false };
    }

    const direction = axis > 0 ? 1 : -1;
    const footY = options.footY ?? p.pos.y + 2;
    const lookAhead = options.lookAhead ?? 32;
    const dropDistance = options.dropDistance ?? 54;

    const hasSupportAhead = hasGroundBelow(
      p.pos.x + direction * lookAhead,
      footY,
      state,
      dropDistance
    );

    if (hasSupportAhead) {
      return { isGap: false };
    }

    const landingDistance = scanForLanding(p, direction, state, {
      footY,
      dropDistance,
      maxDistance: options.maxLandingDistance ?? 160,
      step: options.step ?? 12,
    });

    return {
      isGap: true,
      direction,
      landingDistance,
    };
  }

  // Check if dash attack would be safe (won't fall off stage)
  function isDashAttackSafe(p, direction, state, dashDistance = 80) {
    if (!state || !direction) return false;

    const dashDir = direction > 0 ? 1 : -1;
    const endX = p.pos.x + dashDir * dashDistance;
    const footY = p.pos.y + 2;

    // Check if there's ground at the end of the dash
    const hasGroundAtEnd = hasGroundBelow(endX, footY, state, 64, 6);

    // Also check if there's a gap that can't be cleared
    const edgeInfo = getEdgeInfo(p, dashDir, state, {
      lookAhead: dashDistance + 20,
      dropDistance: 80,
      maxLandingDistance: 200,
    });

    // Safe if: ground at end AND (no gap OR gap can be cleared with jump)
    return (
      hasGroundAtEnd &&
      (!edgeInfo.isGap ||
        (edgeInfo.landingDistance !== null && edgeInfo.landingDistance < 200))
    );
  }

  // Check if character is near edge or offzone (stage boundaries)
  function isNearEdgeOrOffzone(p, state, threshold = 120) {
    if (!state || !p) return false;

    const cameraBounds = state.cameraBounds;
    if (!cameraBounds) {
      // Fallback: use canvas dimensions if available
      const canvas = state.canvas;
      if (canvas) {
        const distToLeft = p.pos.x;
        const distToRight = canvas.width - p.pos.x;
        return distToLeft < threshold || distToRight < threshold;
      }
      return false;
    }

    const stageX = cameraBounds.x ?? 0;
    const stageWidth =
      cameraBounds.width ?? window.GameState?.CONSTANTS?.NATIVE_WIDTH ?? 2500;
    const stageLeft = stageX;
    const stageRight = stageX + stageWidth;

    const distToLeft = p.pos.x - stageLeft;
    const distToRight = stageRight - p.pos.x;

    // Check if near left or right stage boundary
    if (distToLeft < threshold || distToRight < threshold) {
      return true;
    }

    // Also check for gaps/edges using heatmap
    const hasHeatmap = !!(state?.groundData || state?.semisolidData);
    if (hasHeatmap) {
      const edgeInfoLeft = getEdgeInfo(p, -1, state, { lookAhead: threshold });
      const edgeInfoRight = getEdgeInfo(p, 1, state, { lookAhead: threshold });

      // Consider it unsafe if there's a gap in either direction
      if (edgeInfoLeft.isGap || edgeInfoRight.isGap) {
        return true;
      }
    }

    return false;
  }

  function canAttemptJump(p, grounded, currentTime) {
    if (!grounded) return false;
    if (typeof currentTime !== "number") return false;
    if (typeof p.jumpsLeft === "number" && p.jumpsLeft <= 0) return false;
    return currentTime - npcState.lastJumpTime > 0.35;
  }

  function getRandomDodgeInterval() {
    return 3 + Math.floor(Math.random() * 3);
  }

  function finalizeInputs(inputs, currentTime) {
    if (!inputs) return inputs;

    if (inputs.jump || inputs.jumpPressed) {
      inputs.jump = true;
      if (typeof inputs.jumpHeld !== "boolean") {
        inputs.jumpHeld = true;
      }
      npcState.lastJumpTime = currentTime;
    }

    return inputs;
  }

  // Helper: Get optimal range for character
  function getOptimalRange(p2, attackType = "r1") {
    return 150; // Default
  }

  function chooseWeightedCandidate(candidates) {
    if (!candidates || candidates.length === 0) return null;
    const totalWeight = candidates.reduce(
      (sum, candidate) => sum + (candidate.weight ?? 1),
      0
    );
    let roll = Math.random() * totalWeight;
    for (const candidate of candidates) {
      roll -= candidate.weight ?? 1;
      if (roll <= 0) {
        return candidate;
      }
    }
    return candidates[candidates.length - 1];
  }

  function isInActiveDanceZone(p, state) {
    const spot = state.danceMode?.currentActiveSpot;
    if (!spot) return false;
    const hb = window.Renderer?.getHurtbox?.(p);
    const playerX = hb ? hb.left + hb.w / 2 : p.pos.x;
    const playerY = hb ? hb.top + hb.h : p.pos.y;
    const dx = spot.pos.x - playerX;
    const dy = spot.pos.y - playerY;
    const dist = Math.hypot(dx, dy);
    const radius = state.danceMode?.beatMatchRadius ?? 400;
    return dist <= radius * 0.5; // Inside half-radius = "in zone"
  }

  function getDanceSpotGuardAxis(p, state) {
    const spot = state.danceMode?.currentActiveSpot;
    if (!spot)
      return {
        axis: 0,
        weight: 0,
        distance: Infinity,
        dy: 0,
        needsVertical: false,
      };
    const hb = window.Renderer?.getHurtbox?.(p);
    const playerX = hb ? hb.left + hb.w / 2 : p.pos.x;
    const playerY = hb ? hb.top + hb.h : p.pos.y;
    const dx = spot.pos.x - playerX;
    const dy = spot.pos.y - playerY;
    const dist = Math.hypot(dx, dy);
    const radius = state.danceMode?.beatMatchRadius ?? 400;

    // If already in zone, no movement needed
    if (dist <= radius * 0.5) {
      return {
        axis: 0,
        weight: 0,
        distance: dist,
        dy: dy,
        needsVertical: Math.abs(dy) > 40,
      };
    }

    // Strong pull towards zone (full axis value)
    const axis = dx > 0 ? 1.0 : -1.0;
    // Weight increases with distance (stronger pull when far)
    const weight = Math.min(1.0, dist / Math.max(radius, 200));
    // Needs vertical movement if zone is significantly above/below
    const needsVertical = Math.abs(dy) > 40;
    return {
      axis,
      weight,
      distance: dist,
      dy: dy,
      needsVertical: needsVertical,
    };
  }

  function queueDoubleDashTap(currentTime) {
    const dd = npcState.doubleDashState;
    if (dd.waitingForSecondTap) return;
    dd.waitingForSecondTap = true;
    dd.queuedAt = currentTime;
  }

  function applyPendingDoubleDash(inputs, p, currentTime) {
    const dd = npcState.doubleDashState;
    if (
      !dd.waitingForSecondTap ||
      !p.attack ||
      p.attack.type !== "r1" ||
      p.attack.phase !== "start"
    ) {
      return;
    }
    inputs.r1Down = true;
    dd.waitingForSecondTap = false;
    dd.lastUsedAt = currentTime;
    npcState.lastAttackType = "r1_dash";
  }

  function canAttemptUltimateSafely(p, opponent, state) {
    if (!opponent) return false;
    // Assuming ultimate is generally safe/desired if full
    return true;
  }

  function isHPUltimateActive(p) {
    return (
      p.attack?.type === "r2_l2_ulti" ||
      p.ultiPhase === "active" ||
      (p.anim && (p.anim.includes("r2_l2_ulti") || p.anim.includes("bike")))
    );
  }

  // --- Strategy & Analysis Helpers ---

  function updateStrategy(p1, p2, state, currentTime) {
    // Update attack cooldowns (decay per frame, assuming 60fps)
    const dt = 1 / 60;
    for (const key in npcState.attackCooldowns) {
      if (npcState.attackCooldowns[key] > 0) {
        npcState.attackCooldowns[key] = Math.max(
          0,
          npcState.attackCooldowns[key] - dt
        );
      }
    }

    // Handle Cooldown Reset post-animation
    const currentAnim = p2.anim || "";
    const isInAttackAnim =
      currentAnim.includes("r1") ||
      currentAnim.includes("r2") ||
      currentAnim.includes("l1") ||
      currentAnim.includes("l2") ||
      currentAnim.includes("jab") ||
      currentAnim.includes("smash") ||
      currentAnim.includes("dash");

    if (npcState.lastAttackAnim && !isInAttackAnim) {
      const attackType = npcState.lastAttackAnim.includes("l1") ? "l1" : "r1"; // Simplified
      const minCooldown = 0.5;
      if ((npcState.attackCooldowns[attackType] || 0) < minCooldown) {
        npcState.attackCooldowns[attackType] = minCooldown;
      }
    }
    npcState.lastAttackAnim = isInAttackAnim ? currentAnim : null;

    // --- NEW PRIORITY SYSTEM ---

    // 1. ULTIMATE: Highest Priority
    if (window.UltimeterManager?.canUseUltimate(p2)) {
      npcState.strategy.currentMode = "ULTIMATE_SEEK";
      return;
    }

    // 2. BEAT STEAL: If player has > 4 charges
    if ((p1.perfectBeatCount || 0) > 4) {
      npcState.strategy.currentMode = "BEAT_STEAL";
      return;
    }

    const dist = Math.abs(p1.pos.x - p2.pos.x);
    const isThreatened =
      detectIncomingAttack(p1, p2)?.phase !== "none" ||
      dist < PROX_THREAT_DISTANCE;
    const p2InZone = isInActiveDanceZone(p2, state);
    const p1InZone = isInActiveDanceZone(p1, state);

    // 3. COMBAT / DEFENSE
    if (isThreatened) {
      npcState.strategy.currentMode = "COMBAT_DEFENSE";
      return;
    }

    // 3b. TACTICAL MIX (Both in Zone)
    if (p2InZone && p1InZone) {
      npcState.strategy.currentMode = "TACTICAL_DANCE_COMBAT";
      return;
    }

    // 4. DEFAULT: MOVE TO ZONE / DANCE
    npcState.strategy.currentMode = p2InZone ? "DANCE_FOCUS" : "ZONE_SEEKER";
  }

  // Phase 1: Movement Decision
  function decideMovement(p1, p2, distance, grounded, state, currentTime) {
    const inputs = {
      axis: 0,
      jumpPressed: false,
      jump: false,
      jumpHeld: false,
      down: false,
    };

    if (
      p2.attack?.type !== "none" ||
      (p2.stunT && p2.stunT > 0) ||
      p2.roll?.active
    ) {
      return inputs;
    }

    const mode = npcState.strategy.currentMode;
    const danceZoneInfo = getDanceSpotGuardAxis(p2, state);
    let jumpingForZone = false;
    const hasHeatmap = !!(state?.groundData || state?.semisolidData);

    // --- PRIORITY-BASED MOVEMENT ---

    // A. Chase Player (Ult or Beat Steal)
    if (mode === "ULTIMATE_SEEK" || mode === "BEAT_STEAL") {
      const desiredAxis = p2.pos.x < p1.pos.x ? 1 : -1;
      // Safety check before moving
      if (hasHeatmap && grounded) {
        const edgeInfo = getEdgeInfo(p2, desiredAxis, state);
        if (edgeInfo.isGap) {
          const landingDist = edgeInfo.landingDistance;
          const canJump = canAttemptJump(p2, grounded, currentTime);
          if (landingDist && landingDist < 200 && canJump) {
            inputs.axis = desiredAxis;
            inputs.jump = true;
            inputs.jumpPressed = true;
            inputs.jumpHeld = true;
          } else if (!edgeInfo.isGap || (landingDist && landingDist < 200)) {
            inputs.axis = desiredAxis;
          }
        } else {
          inputs.axis = desiredAxis;
        }
      } else {
        inputs.axis = desiredAxis;
      }
    }
    // B. Combat Defense (Keep optimal range)
    else if (mode === "COMBAT_DEFENSE") {
      const optimalRange = 120;
      let desiredAxis = 0;
      if (distance > optimalRange + 20) {
        desiredAxis = p2.pos.x < p1.pos.x ? 1 : -1;
      } else if (distance < optimalRange - 20) {
        desiredAxis = p2.pos.x < p1.pos.x ? -1 : 1;
      }

      // Safety check
      if (desiredAxis !== 0 && hasHeatmap && grounded) {
        const edgeInfo = getEdgeInfo(p2, desiredAxis, state);
        if (
          !edgeInfo.isGap ||
          (edgeInfo.landingDistance !== null && edgeInfo.landingDistance < 200)
        ) {
          inputs.axis = desiredAxis;
        }
      } else if (desiredAxis !== 0) {
        inputs.axis = desiredAxis;
      }
    }
    // C. Tactical Dance Combat (Erratic Movement in Zone)
    else if (mode === "TACTICAL_DANCE_COMBAT") {
      // Small adjustments, maybe cross up
      if (Math.random() < 0.1) {
        const desiredAxis = Math.random() < 0.5 ? 1 : -1;
        if (hasHeatmap && grounded) {
          const edgeInfo = getEdgeInfo(p2, desiredAxis, state);
          if (!edgeInfo.isGap) {
            inputs.axis = desiredAxis;
          }
        } else {
          inputs.axis = desiredAxis;
        }
      }
    }
    // D. Zone Seeker (Go to Zone) - HIGHEST PRIORITY FOR NAVIGATION
    else if (mode === "ZONE_SEEKER") {
      if (danceZoneInfo.weight > 0) {
        const desiredAxis = danceZoneInfo.axis;

        // Horizontal movement safety check
        if (hasHeatmap && grounded && desiredAxis !== 0) {
          const edgeInfo = getEdgeInfo(p2, desiredAxis, state);
          if (edgeInfo.isGap) {
            const landingDist = edgeInfo.landingDistance;
            const canJump = canAttemptJump(p2, grounded, currentTime);
            if (landingDist && landingDist < 200 && canJump) {
              inputs.axis = desiredAxis;
              inputs.jump = true;
              inputs.jumpPressed = true;
              inputs.jumpHeld = true;
              jumpingForZone = true;
            } else if (landingDist && landingDist < 200) {
              inputs.axis = desiredAxis; // Safe to move
            }
            // else: stop at edge (axis stays 0)
          } else {
            inputs.axis = desiredAxis; // No gap, safe to move
          }
        } else {
          inputs.axis = desiredAxis;
        }

        // Vertical Navigation for Zone
        if (
          danceZoneInfo.needsVertical &&
          grounded &&
          canAttemptJump(p2, grounded, currentTime)
        ) {
          const zoneAbove = danceZoneInfo.dy < -40;
          const zoneBelow = danceZoneInfo.dy > 40;
          const verticalDist = Math.abs(danceZoneInfo.dy);

          if (zoneAbove && verticalDist > 50 && verticalDist < 250) {
            // Check if we can reach zone via platforms
            if (hasHeatmap) {
              // Check for platforms above
              const checkHeights = [60, 100, 140, 180, 220];
              let foundPlatform = false;

              for (const height of checkHeights) {
                const checkY = p2.pos.y - height;
                const checkX = p2.pos.x + desiredAxis * 20;
                if (hasGroundBelow(checkX, checkY, state, 80, 6)) {
                  foundPlatform = true;
                  break;
                }
              }

              if (foundPlatform || verticalDist < 200) {
                inputs.jump = true;
                inputs.jumpPressed = true;
                inputs.jumpHeld = true;
                jumpingForZone = true;
              }
            } else {
              // No heatmap, but zone is within jump range
              if (verticalDist < 200) {
                inputs.jump = true;
                inputs.jumpPressed = true;
                inputs.jumpHeld = true;
                jumpingForZone = true;
              }
            }
          } else if (
            zoneBelow &&
            verticalDist > 60 &&
            isOnSemisolidPlatform(p2, state)
          ) {
            inputs.down = true; // Drop through semisolid platform
          }
        }
      }
    }
    // E. Dance Focus (Stay put / Center)
    else if (mode === "DANCE_FOCUS") {
      // Center in zone if drifting too far
      if (danceZoneInfo.distance > 50) {
        const desiredAxis = danceZoneInfo.axis * 0.5;
        if (hasHeatmap && grounded) {
          const edgeInfo = getEdgeInfo(p2, desiredAxis, state);
          if (!edgeInfo.isGap) {
            inputs.axis = desiredAxis;
          }
        } else {
          inputs.axis = desiredAxis;
        }
      }
    }

    // Final Edge Safety Check (for all movement)
    if (grounded && inputs.axis !== 0 && !jumpingForZone && hasHeatmap) {
      const edgeInfo = getEdgeInfo(p2, inputs.axis, state);
      if (edgeInfo.isGap) {
        const landingDist = edgeInfo.landingDistance;
        const canJump = canAttemptJump(p2, grounded, currentTime);

        if (landingDist && landingDist < 200 && canJump) {
          inputs.jump = true;
          inputs.jumpPressed = true;
          inputs.jumpHeld = true;
        } else {
          inputs.axis = 0; // Stop at edge if can't jump
        }
      }
    }

    // SIMPLIFIED: Always use double jump when available (in air with jumps left)
    if (!grounded && typeof p2.jumpsLeft === "number" && p2.jumpsLeft > 0) {
      // Use double jump if falling and have jumps available
      if (p2.vel.y >= 0 || (p2.vel.y < 0 && p2.vel.y > -50)) {
        // Falling or at peak of jump - use double jump
        inputs.jump = true;
        inputs.jumpPressed = true;
        inputs.jumpHeld = true;
      }
    }

    return inputs;
  }

  // Phase 2: Attack Decision
  function decideAttack(p1, p2, distance, grounded, state, currentTime) {
    const inputs = {
      r1Down: false,
      r2Down: false,
      l1Down: false,
      l2Down: false,
      grabDown: false,
      danceDown: false,
    };

    const mode = npcState.strategy.currentMode;
    const isInBeatWindow = Physics.isInBeatWindow
      ? Physics.isInBeatWindow(state)
      : false;
    const p2InZone = isInActiveDanceZone(p2, state);
    const p1InZone = isInActiveDanceZone(p1, state);

    // Check Cooldowns
    const canAttack = (type, cd = 0.3) =>
      canUseAbility(p2, type) && (npcState.attackCooldowns[type] || 0) <= 0;

    // 1. BEAT STEAL -> Grab Priority (MUST USE GRAB)
    if (mode === "BEAT_STEAL") {
      // Check if in grab range (horizontal and vertical)
      const hb1 = window.Renderer?.getHurtbox?.(p1);
      const hb2 = window.Renderer?.getHurtbox?.(p2);
      let inGrabRange = false;

      if (hb1 && hb2) {
        const dx = Math.abs(hb1.left + hb1.w / 2 - (hb2.left + hb2.w / 2));
        const dy = Math.abs(hb1.top + hb1.h / 2 - (hb2.top + hb2.h / 2));
        // If NPC (p2) is beat-charged, increase grab thresholds by 20%
        const BEAT_CHARGE_MULT = p2?.perfectBeatCount > 0 ? 1.2 : 1.0;
        inGrabRange =
          dx < Math.round(120 * BEAT_CHARGE_MULT) &&
          dy < Math.round(80 * BEAT_CHARGE_MULT);
      } else {
        const BEAT_CHARGE_MULT = p2?.perfectBeatCount > 0 ? 1.2 : 1.0;
        inGrabRange =
          distance < Math.round(120 * BEAT_CHARGE_MULT) &&
          Math.abs(p1.pos.y - p2.pos.y) < Math.round(80 * BEAT_CHARGE_MULT);
      }

      if (inGrabRange && grounded && canAttack("grab", 0.5)) {
        inputs.grabDown = true;
        npcState.lastActionTime = currentTime;
        npcState.attackCooldowns.grab = 2.0;
        return inputs;
      }
      // If can't grab, try to close distance (but check dash safety and edge/offzone)
      if (distance > 120 && canAttack("r1", 0.3)) {
        const dashDir = p2.pos.x < p1.pos.x ? 1 : -1;
        if (
          !isNearEdgeOrOffzone(p2, state, 120) &&
          isDashAttackSafe(p2, dashDir, state, 80)
        ) {
          inputs.r1Down = true;
          npcState.lastActionTime = currentTime;
          return inputs;
        }
      }
    }

    // 2. TACTICAL DANCE COMBAT (Both in Zone) -> Mixed Bag
    if (mode === "TACTICAL_DANCE_COMBAT") {
      const roll = Math.random();

      // Distance-based dance priority: further away = higher dance priority
      // Distance 0-100: 0.5 dance chance, 100-200: 0.7, 200+: 0.9
      const distanceBasedDanceChance =
        distance < 100 ? 0.5 : distance < 200 ? 0.7 : 0.9;
      const danceRoll = Math.random();

      // Check dance first if distance-based chance allows (increased priority)
      if (danceRoll < distanceBasedDanceChance && isInBeatWindow && p2InZone) {
        inputs.danceDown = true;
        npcState.lastActionTime = currentTime;
        npcState.lastDanceTime = currentTime;
        return inputs;
      }

      // Also dance outside beat window if far enough (distance > 150)
      if (distance > 150 && p2InZone && danceRoll < 0.4) {
        inputs.danceDown = true;
        npcState.lastActionTime = currentTime;
        npcState.lastDanceTime = currentTime;
        return inputs;
      }

      // Varied attacks, but check dash safety for R1 and block if near edge/offzone
      if (roll < 0.3 && canAttack("r1")) {
        const dashDir = p2.facing >= 0 ? 1 : -1;
        if (
          !isNearEdgeOrOffzone(p2, state, 120) &&
          isDashAttackSafe(p2, dashDir, state, 80)
        ) {
          inputs.r1Down = true;
        }
      } else if (roll < 0.5 && canAttack("r2")) {
        // Block R2 dash if near edge or offzone
        if (!isNearEdgeOrOffzone(p2, state, 120)) {
          inputs.r2Down = true;
        }
      } else if (roll < 0.6 && canAttack("l1")) {
        inputs.l1Down = true;
      }

      if (inputs.r1Down || inputs.r2Down || inputs.l1Down || inputs.danceDown) {
        npcState.lastActionTime = currentTime;
        return inputs;
      }
    }

    // 3. COMBAT DEFENSE -> Protect self
    if (mode === "COMBAT_DEFENSE") {
      if (distance < 100 && canAttack("r1")) {
        const dashDir = p2.facing >= 0 ? 1 : -1;
        // Block R1 dash if near edge or offzone
        if (
          !isNearEdgeOrOffzone(p2, state, 120) &&
          isDashAttackSafe(p2, dashDir, state, 80)
        ) {
          inputs.r1Down = true; // Get off me
        }
      } else if (distance < 180 && canAttack("r2")) {
        // Block R2 dash if near edge or offzone
        if (!isNearEdgeOrOffzone(p2, state, 120)) {
          inputs.r2Down = true; // Punish
        }
      }

      if (inputs.r1Down || inputs.r2Down) {
        npcState.lastActionTime = currentTime;
        return inputs;
      }
    }

    // 4. DANCE FOCUS -> MUST DANCE (Primary Goal)
    if (mode === "DANCE_FOCUS") {
      // Always dance when in beat window
      if (isInBeatWindow) {
        inputs.danceDown = true;
        npcState.lastActionTime = currentTime;
        npcState.lastDanceTime = currentTime;
        return inputs;
      }
      // Also dance frequently outside beat window if in zone (to maintain position)
      // Distance-based: further away = higher chance (0.5 at close, 0.8 at far)
      const distanceBasedDanceChance = Math.min(
        0.8,
        0.5 + (distance / 400) * 0.3
      );
      if (
        p2InZone &&
        Math.random() < distanceBasedDanceChance &&
        currentTime - npcState.lastDanceTime > 0.3
      ) {
        inputs.danceDown = true;
        npcState.lastDanceTime = currentTime;
        return inputs;
      }
    }

    // 5. ZONE_SEEKER -> Can dance while moving to zone if in beat window
    // Distance-based: further away = higher priority to dance
    if (mode === "ZONE_SEEKER" && p2InZone) {
      if (isInBeatWindow) {
        // Always dance in beat window, but higher priority when far
        inputs.danceDown = true;
        npcState.lastActionTime = currentTime;
        npcState.lastDanceTime = currentTime;
        return inputs;
      }
      // Also dance outside beat window if far enough away (distance > 150)
      // Increased chance: 0.4 -> 0.6
      if (distance > 150 && Math.random() < 0.6) {
        inputs.danceDown = true;
        npcState.lastActionTime = currentTime;
        npcState.lastDanceTime = currentTime;
        return inputs;
      }
    }

    return inputs;
  }

  // Phase 3: Special Attack Decision
  function decideSpecialAttack(p1, p2, distance, grounded, state) {
    const inputs = {};
    const currentTime = performance.now() * 0.001;

    if (
      p2.attack?.type !== "none" ||
      !canUseAbility(p2, "r1") ||
      currentTime - npcState.lastActionTime < 0.3
    ) {
      return inputs;
    }

    // R1 Up Attack (aerial advantage)
    if (
      !grounded &&
      p2.pos.y < p1.pos.y - 20 &&
      distance < 150 &&
      Math.random() < 0.2
    ) {
      inputs.l3UpR1Down = true;
      inputs.r1Down = true; // Required for l3UpR1Down
      npcState.lastAttackType = "r1_up";
      npcState.lastActionTime = currentTime;
      return inputs;
    }

    // R1 Dash Attack (double-tap detection) - WITH SAFETY CHECK
    if (
      distance < 150 &&
      grounded &&
      currentTime - npcState.lastR1Time < 0.2 &&
      npcState.lastR1Time > 0
    ) {
      const dashDir = p2.facing >= 0 ? 1 : -1;

      // CRITICAL: Check if dash is safe and not near edge/offzone before executing
      if (
        !isNearEdgeOrOffzone(p2, state, 120) &&
        isDashAttackSafe(p2, dashDir, state, 80)
      ) {
        inputs.r1Down = true;
        npcState.lastAttackType = "r1_dash";
        npcState.lastActionTime = currentTime;
        npcState.lastR1Time = 0; // Reset
        return inputs;
      }

      // Unsafe to dash near edge; reset detection window to prevent spam
      npcState.lastR1Time = 0;
    }

    // Track R1 presses for dash detection
    if (inputs.r1Down) {
      npcState.lastR1Time = currentTime;
    }

    return inputs;
  }

  function detectIncomingAttack(p1, p2) {
    if (!p1.attack || p1.attack.type === "none") return null;
    const distance = Math.abs(p1.pos.x - p2.pos.x);
    return {
      type: p1.attack.type,
      phase: p1.attack.phase,
      distance: distance,
      direction: p1.facing,
      isClose: distance < 120,
    };
  }

  function getDodgeDirection(attackInfo, p1, p2) {
    return p2.pos.x < p1.pos.x ? -1 : 1; // Simple dodge away
  }

  // Generate fake inputs for Player 2
  function getInputs(state, playerIndex) {
    if (!enabled || playerIndex !== 1) {
      return null; // Only control P2
    }

    const p2 = state.players?.[1];
    const p1 = state.players?.[0];
    if (!p2 || !p1) return null;

    const currentTime = performance.now() * 0.001;
    const dt = 1 / 60;

    // --- Update Strategy ---
    updateStrategy(p1, p2, state, currentTime);

    const distance = Math.abs(p1.pos.x - p2.pos.x);
    const grounded = !!p2.grounded;

    // Jump state resets automatically when grounded (jumpsLeft is reset by physics system)

    // Update Cooldowns
    if (dodgeCooldown > 0) dodgeCooldown -= dt;

    const inputs = {
      axis: 0,
      jumpPressed: false,
      jump: false,
      jumpHeld: false,
      l1Held: false,
      l1Down: false,
      l1Up: false,
      l2Held: false,
      l2Down: false,
      l2Up: false,
      r1Held: false,
      r1Down: false,
      r1Up: false,
      r2Held: false,
      r2Down: false,
      rollDown: false,
      downHeld: false,
      grabDown: false,
      ultiDown: false,
      r1CircleDown: false,
      l3UpR1Down: false,
      danceDown: false,
    };

    applyPendingDoubleDash(inputs, p2, currentTime);

    // Phase 6: Recovery handling
    if ((p2.stunT && p2.stunT > 0) || p2.isInvincible) {
      const movement = decideMovement(
        p1,
        p2,
        distance,
        grounded,
        state,
        currentTime
      );
      Object.assign(inputs, movement);
      return finalizeInputs(inputs, currentTime);
    }

    // PRIORITY 1: DODGE
    // Check for incoming attacks and dodge if necessary
    const attackInfo = detectIncomingAttack(p1, p2);
    if (attackInfo && dodgeCooldown <= 0 && !p2.roll?.active) {
      const isDangerous =
        attackInfo.phase === "active" || attackInfo.phase === "release";
      if (isDangerous && attackInfo.distance < 180) {
        inputs.rollDown = true;
        inputs.axis = getDodgeDirection(attackInfo, p1, p2);
        dodgeCooldown = 1.0;
        return finalizeInputs(inputs, currentTime);
      }
    }

    // PRIORITY 2: ULTIMATE (If Mode is ULTIMATE_SEEK)
    if (npcState.strategy.currentMode === "ULTIMATE_SEEK") {
      // Move to range first? Or just fire? Assuming global range or chasing.
      const movement = decideMovement(
        p1,
        p2,
        distance,
        grounded,
        state,
        currentTime
      );
      Object.assign(inputs, movement);

      // Fire when ready (simplified safe check)
      if (canAttemptUltimateSafely(p2, p1, state)) {
        inputs.ultiDown = true;
      }
      return finalizeInputs(inputs, currentTime);
    }

    // PRIORITY 3: DANCE (If in zone and beat window) - HIGH PRIORITY
    // Distance-based priority: further away = higher dance priority
    const p2InZone = isInActiveDanceZone(p2, state);
    const isInBeatWindow = Physics.isInBeatWindow
      ? Physics.isInBeatWindow(state)
      : false;

    // Calculate distance-based dance priority
    // At distance 0: base priority, at distance 300+: 2x priority
    const distanceMultiplier = 1.0 + Math.min(1.0, distance / 300);
    const shouldPrioritizeDance = distance > 100 && distanceMultiplier > 1.2;

    // CRITICAL FIX: Dance should interrupt attacks if in beat window
    // If in zone and beat window, ALWAYS prioritize dancing (especially when far)
    if (p2InZone && isInBeatWindow && !p2.roll?.active) {
      // Higher priority when far away, but always dance in beat window
      if (shouldPrioritizeDance || Math.random() < 0.95) {
        // Cancel current attack to dance
        if (p2.attack && p2.attack.type !== "none") {
          p2.attack = { type: "none", phase: "none" };
        }
        inputs.danceDown = true;
        npcState.lastDanceTime = currentTime;
        // Still allow movement to stay centered
        const movement = decideMovement(
          p1,
          p2,
          distance,
          grounded,
          state,
          currentTime
        );
        Object.assign(inputs, movement);
        return finalizeInputs(inputs, currentTime);
      }
    }

    // Also dance outside beat window if far enough away (distance > 150)
    // Increased chance: 0.2 -> 0.4 base chance
    if (
      p2InZone &&
      !isInBeatWindow &&
      distance > 150 &&
      !p2.roll?.active &&
      currentTime - npcState.lastDanceTime > 0.3 &&
      Math.random() < Math.min(0.6, 0.4 * distanceMultiplier)
    ) {
      // Cancel current attack to dance if far enough
      if (distance > 200 && p2.attack && p2.attack.type !== "none") {
        p2.attack = { type: "none", phase: "none" };
      }
      inputs.danceDown = true;
      npcState.lastDanceTime = currentTime;
      const movement = decideMovement(
        p1,
        p2,
        distance,
        grounded,
        state,
        currentTime
      );
      Object.assign(inputs, movement);
      return finalizeInputs(inputs, currentTime);
    }

    // PRIORITY 4: ATTACKS (Based on Mode)
    // Only if not rolling/dodging
    if (!p2.roll?.active) {
      const attackInputs = decideAttack(
        p1,
        p2,
        distance,
        grounded,
        state,
        currentTime
      );
      if (
        Object.keys(attackInputs).length > 0 &&
        (attackInputs.r1Down ||
          attackInputs.r2Down ||
          attackInputs.grabDown ||
          attackInputs.danceDown ||
          attackInputs.l1Down)
      ) {
        Object.assign(inputs, attackInputs);
        // Blend movement if not in attack
        if (
          !attackInputs.r1Down &&
          !attackInputs.r2Down &&
          !attackInputs.grabDown
        ) {
          const movement = decideMovement(
            p1,
            p2,
            distance,
            grounded,
            state,
            currentTime
          );
          Object.assign(inputs, movement);
        }
        return finalizeInputs(inputs, currentTime);
      }

      const specialInputs = decideSpecialAttack(
        p1,
        p2,
        distance,
        grounded,
        state
      );
      if (Object.keys(specialInputs).length > 0) {
        Object.assign(inputs, specialInputs);
        return finalizeInputs(inputs, currentTime);
      }
    }

    // PRIORITY 4: MOVEMENT (Always active fallback)
    const movement = decideMovement(
      p1,
      p2,
      distance,
      grounded,
      state,
      currentTime
    );
    Object.assign(inputs, movement);

    // Log Debug
    if (state.debug?.devMode && Math.random() < 0.02) {
      console.log(
        `[NPC] Mode: ${npcState.strategy.currentMode} | Dist: ${Math.round(
          distance
        )} | InZone: ${isInActiveDanceZone(p2, state)}`
      );
    }

    return finalizeInputs(inputs, currentTime);
  }

  return {
    toggle,
    enable,
    disable,
    isEnabled,
    getInputs,
  };
})();
