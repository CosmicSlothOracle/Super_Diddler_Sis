if (!window.AttackCatalog) {
  const fallbackDescriptor = (attacker, attackType) => ({
    id: `${attacker?.charName || "unknown"}:${attackType || "unknown"}`,
    attackType: attackType || "unknown",
    charName: attacker?.charName || null,
    tier: "BASIC",
    priority: 0,
    chargeRank: 0,
    clankable: true,
    fx: {},
    metadata: {
      basePriority: 0,
      tierPriority: 0,
      chargePriorityBonus: 0,
      maxCharge: null,
      guardBreak: false,
    },
  });

  window.AttackCatalog = {
    TIERS: {},
    getDescriptor: fallbackDescriptor,
    enableTradeLogging: () => {},
    logTrade: () => {},
  };

  console.warn(
    "AttackCatalog not found. Using fallback descriptors with basic priority logic."
  );
}

if (typeof AttackCatalog.enableTradeLogging === "function") {
  AttackCatalog.enableTradeLogging(true);
}

const debugLog = (...args) => {
  // Debug logging disabled
};

window.Physics = (() => {
  // Initialize MovementSystem with required dependencies
  MovementSystem.init({
    canUseAbility: null, // Will be set after function definitions
    startCooldown: null, // Will be set after function definitions
    setAnim: null, // Will be set after function definitions
  });

  function update(dt, state, canvas) {
    if (!state.players) return;

    // Apply global time scale (for slow-motion effects)
    const timeScale = state.timeScale !== undefined ? state.timeScale : 1.0;
    const scaledDt = dt * timeScale;

    // NEW: Anti-Drift System - Detect and correct timing drift
    if (AudioSystem.detectAndCorrectDrift) {
      AudioSystem.detectAndCorrectDrift(state);
    }

    // NEW: Continue normal gameplay during match end sequence
    // The winner can still move and beatmatch normally

    // --- Phase 1: Update Player Logic (Movement, Attacks, etc.) ---
    state.pendingHits = []; // Clear pending hits at the start of the frame
    for (let i = 0; i < state.players.length; i++) {
      updatePlayer(scaledDt, state, state.players[i], i, canvas);
    }

    // --- Phase 2: Detect All Hits ---
    for (let i = 0; i < state.players.length; i++) {
      detectHits(state.players[i], i, state); // legacy path (to be removed after migration)
    }

    // --- Phase 3: Resolve Hits with Priority ---
    resolveHits(state);

    // --- Phase 4: Update Other Game Objects ---
    updateEffects(scaledDt, state);
    updateStageAnimations(scaledDt, state); // NEW: Update stage animations
    updateProjectiles(scaledDt, state, canvas);
    updateCamera(scaledDt, state, canvas);

    // --- Phase 5: Update Match End Sequence ---
    if (state.matchEnd && state.matchEnd.isActive) {
      updateMatchEndSequence(dt, state);
    }

    // --- Phase 5: Update Combo System Timers ---
    updateComboTimers(dt, state);
    handleDanceBattle(dt, state); // NEW: Update Dance Battle state

    // NEW: Update Dance Spot Manager (Global Mechanic)
    if (window.DanceSpotManager) {
      window.DanceSpotManager.update(dt, state);
    }

    // NEW: Tutorial Proximity Detection and Fade
    if (
      state.tutorial?.active &&
      state.tutorial.part === 1 &&
      state.tutorial.danceSpotActive &&
      !state.tutorial.victoryDance.active
    ) {
      updateTutorialProximity(dt, state);
    }

    // NEW: Update Tutorial Victory Dance Sequence
    if (state.tutorial?.victoryDance?.active) {
      updateTutorialVictoryDance(dt, state);
    }

    // --- Phase 5: Cleanup ---
    for (const p of state.players) {
      p.attack.didHitThisFrame = false;
    }
  }

  // NEW: Start Tutorial Victory Dance Sequence
  function startTutorialVictoryDance(state) {
    if (state.tutorial.victoryDance.active) return; // Prevent multiple triggers

    console.log("[Tutorial] Starting victory dance sequence...");

    const p1 = state.players[0];
    if (!p1 || !window.DanceCatalog) {
      console.warn(
        "[Tutorial] Cannot start victory dance - missing player or DanceCatalog"
      );
      state.tutorial.transitionToPart2 = true;
      return;
    }

    // Initialize victory dance state
    state.tutorial.victoryDance.active = true;
    state.tutorial.victoryDance.phase = "zooming";
    state.tutorial.victoryDance.startTime = state.lastTime;
    state.tutorial.victoryDance.zoomStartTime = state.lastTime;

    // Apply victory dance animation
    const showcase = window.DanceCatalog.getCharacterDanceShowcaseAnimation?.(
      p1.charName
    );
    if (showcase) {
      const showcaseName =
        showcase.metadata?.name ||
        `dance_showcase_${(p1.charName || "unknown")
          .toLowerCase()
          .replace(/\s+/g, "_")}`;
      console.log(`[Tutorial] Triggering victory dance for ${p1.charName}`);
      window.DanceCatalog.applyAnimation(p1, showcase, showcaseName);
    } else {
      console.warn(`[Tutorial] No dance showcase available for ${p1.charName}`);
    }

    // Activate audio effects (technicolor like in match end)
    if (window.AudioSystem && window.AudioSystem.startDancePhase) {
      window.AudioSystem.startDancePhase(1.5, {
        filterFreq: 20000,
        bpm: state.currentBPM || 80,
      });
    }

    // Activate WebGL technicolor effects
    if (window.WebGLRenderer && window.WebGLRenderer.setDancePhase) {
      window.WebGLRenderer.setDancePhase(true, 1.0);
    }
  }

  // NEW: Update Tutorial Victory Dance Sequence
  function updateTutorialVictoryDance(dt, state) {
    if (!state.tutorial.victoryDance.active) return;

    const vd = state.tutorial.victoryDance;
    const currentTime = state.lastTime;
    const p1 = state.players[0];

    switch (vd.phase) {
      case "zooming":
        // Zoom in on player for close-up
        if (currentTime - vd.zoomStartTime >= vd.zoomDuration) {
          vd.phase = "dancing";
          console.log("[Tutorial] Victory dance: Zoom complete, dancing phase");
        }
        break;

      case "dancing":
        // Dance for specified duration
        if (
          currentTime - vd.zoomStartTime >=
          vd.zoomDuration + vd.danceDuration
        ) {
          vd.phase = "complete";
          console.log(
            "[Tutorial] Victory dance complete! Transitioning to pvp_stage_2..."
          );

          // Deactivate effects
          if (window.WebGLRenderer && window.WebGLRenderer.setDancePhase) {
            window.WebGLRenderer.setDancePhase(false, 0.0);
          }
          if (window.AudioSystem && window.AudioSystem.endDancePhase) {
            window.AudioSystem.endDancePhase(1.0);
          }

          // Set flag to transition to training stage
          state.tutorial.transitionToPart2 = true;
        }
        break;

      case "complete":
        // Already complete, do nothing
        break;
    }
  }

  // NEW: Update Tutorial Proximity-based Fade
  function updateTutorialProximity(dt, state) {
    if (!state.tutorial.activeSpotPos || state.players.length === 0) return;

    const p1 = state.players[0];
    const spotPos = state.tutorial.activeSpotPos;
    const spotSize = state.tutorial.activeSpotSize || 256;
    const playerHb = Renderer.getHurtbox(p1);
    const playerCenterX = playerHb.left + playerHb.w / 2;
    const playerCenterY = playerHb.top + playerHb.h / 2;

    // Calculate distance to dance spot
    const distX = Math.abs(playerCenterX - spotPos.x);
    const distY = Math.abs(playerCenterY - spotPos.y);
    const distance = Math.sqrt(distX * distX + distY * distY);

    // Fade range: 0-300px (full fade at 0px, no fade at 300px+)
    const maxFadeDistance = 300;
    const minFadeDistance = 0;
    const proximityAlpha = Math.max(
      0,
      Math.min(
        1,
        1 - (distance - minFadeDistance) / (maxFadeDistance - minFadeDistance)
      )
    );

    // Smooth fade transition
    const fadeSpeed = 2.0; // Fade speed per second
    const targetAlpha = proximityAlpha;
    const currentAlpha = state.tutorial.proximityAlpha || 0;
    const alphaDiff = targetAlpha - currentAlpha;
    state.tutorial.proximityAlpha = Math.max(
      0,
      Math.min(1, currentAlpha + alphaDiff * fadeSpeed * dt)
    );

    // Update UI visibility based on proximity (only during tutorial part 1)
    state.tutorial.uiVisible = state.tutorial.proximityAlpha > 0.1; // Show UI when 10% faded in
    // Only set global UI visibility during tutorial part 1 (proximity fade)
    // In other modes, respect user toggle (U key)
    if (state.tutorial?.active && state.tutorial.part === 1) {
      state.uiVisible = state.tutorial.uiVisible;
    }

    // Fade in music based on proximity
    if (!state.tutorial.musicFadedIn && state.tutorial.proximityAlpha > 0.3) {
      // Start music fade in when 30% proximity
      if (window.AudioSystem && window.AudioSystem.playTrack) {
        window.AudioSystem.playTrack(state.currentStageMusic, {
          fadeIn: 2.0, // 2 second fade in
          delay: 0,
        });
        state.tutorial.musicFadedIn = true;
        console.log("[Tutorial] Music fade in started");
      }
    }

    // Update music volume based on proximity (if music is playing)
    if (
      state.tutorial.musicFadedIn &&
      window.AudioSystem &&
      window.AudioSystem.currentGainNode
    ) {
      const targetVolume = state.tutorial.proximityAlpha * 0.3; // Max volume 0.3
      // Directly set gain node volume
      const gainNode = window.AudioSystem.currentGainNode();
      if (gainNode) {
        gainNode.gain.value = targetVolume;
      }
    }
  }

  function updatePlayer(dt, state, p, i, canvas) {
    if (p.eliminated) {
      return;
    }

    // Initialize player logging state if not exists
    if (!p._loggingState) {
      p._loggingState = {
        lastStatus: null,
        lastSpeed: 0,
        lastLogTime: 0,
        statusChangeCount: 0,
      };
    }

    // Respawn-Update-Logik
    if (p.respawnState === "respawn") {
      p.respawnTimer -= dt;

      if (p.respawnTimer <= 0) {
        // Respawn beendet - Spieler kann sich wieder bewegen
        p.respawnState = "none";
        p.isMovable = true;
        p.respawnTimer = 0;
        setAnim(p, "idle", false, state);
        // isInvincible bleibt true bis respawnInvincibilityTimer abl�uft
      }
      return; // Keine normale Update-Logik w�hrend Respawn
    }

    if ((p.hitlagTimer || 0) > 0) {
      p.hitlagTimer -= dt;
      return; // Halt player update during hitlag
    }

    // Apply queued knockback after hitlag ends
    if (p.queuedKnockback) {
      p.vel.x = p.queuedKnockback.vx;
      p.vel.y = p.queuedKnockback.vy;
      p.stunT = Math.max(p.stunT || 0, p.queuedKnockback.stun);
      p.grounded = false;
      p.queuedKnockback = null; // Clear it after applying
    }

    // EMERGENCY STUCK-IN-WALL CHECK: Only for extreme edge cases
    // This should rarely trigger now with preventive collision detection
    if (state.groundData) {
      const hb = Renderer.getHurtbox(p);
      const checkPositions = [
        { x: hb.left, y: hb.top + hb.h / 2 }, // Left side
        { x: hb.left + hb.w, y: hb.top + hb.h / 2 }, // Right side
        { x: hb.left + hb.w / 2, y: hb.top }, // Top
        { x: hb.left + hb.w / 2, y: hb.top + hb.h }, // Bottom
      ];

      let stuckCount = 0;
      for (const pos of checkPositions) {
        if (isPixelSolid(pos.x, pos.y, state.groundData)) {
          stuckCount++;
        }
      }

      // Only emergency teleport if player is completely stuck (3+ corners)
      if (stuckCount >= 3) {
        console.warn("Player stuck in wall, teleporting");
        checkStuckInWall(p, state.groundData, state);
      }
    }

    if (p.isGrabbed) {
      // Safety check: Release if grabber is no longer holding us
      const attacker = p.grabbedBy;
      const isHeld =
        attacker &&
        !attacker.eliminated && // EDGE CASE FIX: Grabber eliminated
        attacker.attack &&
        (attacker.attack.grabbedTarget === p ||
          attacker.attack.maxChargeGrabbedTarget === p ||
          attacker.attack.savedTarget === p); // CRITICAL: Also check savedTarget for ranged grabs

      // EMERGENCY FAILSAFE: Track how long we've been grabbed
      if (!p._grabTimer) {
        p._grabTimer = 0;
      }
      p._grabTimer += dt;

      if (!isHeld) {
        // Grab broken externally (grabber eliminated, attack ended, etc.)
        console.log(
          `[Grab DEBUG] ${p.charName} auto-released: grabber no longer holding`
        );
        p.isGrabbed = false;
        p.grabbedBy = null;
        p._grabTimer = 0;
        setAnim(p, "jump_fall", false, state);
        // Continue update normally to apply gravity/physics immediately
      } else if (p._grabTimer > 5.0) {
        // EMERGENCY: Been grabbed for more than 5 seconds, force release
        console.log(
          `[Grab DEBUG] EMERGENCY: ${
            p.charName
          } grabbed for ${p._grabTimer.toFixed(2)}s, force releasing`
        );
        p.isGrabbed = false;
        p.grabbedBy = null;
        p._grabTimer = 0;
        if (attacker && attacker.attack) {
          // Force release on attacker side too
          if (
            window.AttackSystem &&
            typeof window.AttackSystem.releaseGrabbedTarget === "function"
          ) {
            window.AttackSystem.releaseGrabbedTarget(attacker, state);
          }
        }
        setAnim(p, "jump_fall", false, state);
      } else {
        advanceAnim(dt, p, state); // Continue playing animation while grabbed
        return;
      }
    } else {
      // Reset grab timer when not grabbed
      p._grabTimer = 0;
    }

    p.parryWindow = Math.max(0, (p.parryWindow || 0) - 1); // Decrement frame-by-frame
    p.postDoubleJumpCooldown = Math.max(
      0,
      (p.postDoubleJumpCooldown || 0) - dt
    );

    // Update airTime for airborne animations
    if (!p.grounded) {
      p.airTime = (p.airTime || 0) + dt;
      // AirTime threshold reached for airborne animation
    } else {
      // Reset airTime when grounded
      p.airTime = 0; // Reset when grounded
      p.airborneFromHit = false; // Reset airborne flag when grounded
      // Reset knockback flight tracking when landing
      if (p.knockbackFlightStartTime) {
        p.knockbackFlightStartTime = null;
        p.lastKnockbackSmokeEmitTime = null;
      }
    }

    // NEW: Cooldowns only reduce through beatmatches, not over time!
    // (Cooldown reduction happens in handleDanceMove on perfect beats)

    // Update dance segment grace period timer
    if (
      p._danceSegmentGracePeriod !== undefined &&
      p._danceSegmentGracePeriod > 0
    ) {
      p._danceSegmentGracePeriod -= dt;
      if (p._danceSegmentGracePeriod <= 0) {
        p._danceSegmentJustCompleted = false;
        p._danceSegmentGracePeriod = undefined;
      }
    }

    // DEBUG: Keep ultimeter at 100% if infinite ultimeter is enabled
    if (state.debug?.infiniteUltimeter) {
      p.ultimeter.current = p.ultimeter.max;
      p.ultimeter.isReady = true;
    }

    // NEW: Tutorial Part 2 - Check if ultimeter is ready (called every frame)
    if (
      state.tutorial?.active &&
      state.tutorial.part === 2 &&
      p.padIndex === 0 &&
      window.TutorialSystem?.checkPartTwoUltimeterReady
    ) {
      window.TutorialSystem.checkPartTwoUltimeterReady(state);
      window.TutorialSystem.checkPartTwoUltimateUsed(state); // <-- NEW
    }

    // Beatmatch mode management
    p.beatmatchMode = p.beatmatchMode || false;

    const padIn = InputHandler.getPadInput(p.padIndex, state);
    const kbIn = i === 0 ? InputHandler.getKeyboardInput(state) : {};
    const mobileIn =
      i === 0
        ? InputHandler.getMobileInput
          ? InputHandler.getMobileInput(i)
          : {}
        : {};

    // NEW: Check if NPC should override P2 inputs
    const npcIn = window.NPCController?.getInputs(state, i);
    const finalInput = npcIn || padIn;
    const finalKbIn = npcIn ? {} : kbIn; // Disable keyboard for NPC-controlled player
    const finalMobileIn = npcIn ? {} : mobileIn; // Disable mobile for NPC-controlled player

    // Merge inputs: priority is gamepad > keyboard > mobile (for axis, use strongest)
    const allAxis = [
      finalInput.axis,
      finalKbIn.axis ?? 0,
      finalMobileIn.axis ?? 0,
    ];
    const strongestAxis = allAxis.reduce(
      (a, b) => (Math.abs(a) > Math.abs(b) ? a : b),
      0
    );

    const inputs = {
      axis: strongestAxis,
      jumpPressed:
        finalInput.jump ||
        (finalKbIn.jump ?? false) ||
        (finalMobileIn.jump ?? false),
      jumpHeld:
        finalInput.jumpHeld ||
        (finalKbIn.jumpHeld ?? false) ||
        (finalMobileIn.jumpHeld ?? false),
      l1Held:
        finalInput.l1Held ||
        (finalKbIn.l1Held ?? false) ||
        (finalMobileIn.l1Held ?? false),
      l1Down:
        finalInput.l1Down ||
        (finalKbIn.l1Down ?? false) ||
        (finalMobileIn.l1Down ?? false),
      l1Up:
        finalInput.l1Up ||
        (finalKbIn.l1Up ?? false) ||
        (finalMobileIn.l1Up ?? false),
      l2Held:
        finalInput.l2Held ||
        (finalKbIn.l2Held ?? false) ||
        (finalMobileIn.l2Held ?? false),
      l2Down:
        finalInput.l2Down ||
        (finalKbIn.l2Down ?? false) ||
        (finalMobileIn.l2Down ?? false),
      l2Up:
        finalInput.l2Up ||
        (finalKbIn.l2Up ?? false) ||
        (finalMobileIn.l2Up ?? false),
      r1Held:
        finalInput.r1Held ||
        (finalKbIn.r1Held ?? false) ||
        (finalMobileIn.r1Held ?? false),
      r1Down:
        finalInput.r1Down ||
        (finalKbIn.r1Down ?? false) ||
        (finalMobileIn.r1Down ?? false),
      r1Up:
        finalInput.r1Up ||
        (finalKbIn.r1Up ?? false) ||
        (finalMobileIn.r1Up ?? false),
      r2Held:
        finalInput.r2Held ||
        (finalKbIn.r2Held ?? false) ||
        (finalMobileIn.r2Held ?? false),
      r2Down:
        finalInput.r2Down ||
        (finalKbIn.r2Down ?? false) ||
        (finalMobileIn.r2Down ?? false),
      rollDown:
        finalInput.rollDown ||
        (finalKbIn.rollDown ?? false) ||
        (finalMobileIn.rollDown ?? false),
      rollHeld:
        finalInput.rollHeld ||
        (finalKbIn.rollHeld ?? false) ||
        (finalMobileIn.rollHeld ?? false),
      rollUp:
        finalInput.rollUp ||
        (finalKbIn.rollUp ?? false) ||
        (finalMobileIn.rollUp ?? false),
      wallInteractDown:
        finalInput.wallInteractDown ||
        (finalKbIn.wallInteractDown ?? false) ||
        (finalMobileIn.wallInteractDown ?? false),
      wallInteractHeld:
        finalInput.wallInteractHeld ||
        (finalKbIn.wallInteractHeld ?? false) ||
        (finalMobileIn.wallInteractHeld ?? false),
      wallInteractUp:
        finalInput.wallInteractUp ||
        (finalKbIn.wallInteractUp ?? false) ||
        (finalMobileIn.wallInteractUp ?? false),
      downHeld:
        finalInput.downHeld ||
        (finalKbIn.downHeld ?? false) ||
        (finalMobileIn.downHeld ?? false),
      grabDown:
        finalInput.grabDown ||
        (finalKbIn.grabDown ?? false) ||
        (finalMobileIn.grabDown ?? false),
      ultiDown:
        finalInput.ultiDown ||
        (finalKbIn.ultiDown ?? false) ||
        (finalMobileIn.ultiDown ?? false),
      r1CircleDown:
        finalInput.r1CircleDown ||
        (finalKbIn.r1CircleDown ?? false) ||
        (finalMobileIn.r1CircleDown ?? false),
      l3UpR1Down:
        finalInput.l3UpR1Down ||
        (finalKbIn.l3UpR1Down ?? false) ||
        (finalMobileIn.l3UpR1Down ?? false),
      danceDown:
        finalInput.danceDown ||
        (finalKbIn.danceDown ?? false) ||
        (finalMobileIn.danceDown ?? false),
    };

    const particleMgr = window.ParticleManager;
    if (particleMgr) {
      particleMgr.checkPlayerVelocity(p, state);
      particleMgr.checkKnockbackSmokeTrail(p, state); // NEW: Knockback flight smoke trail

      // NEW: Emit beat charge particles (replaces aura)
      if (p.perfectBeatCount > 0 && particleMgr.emitBeatChargeParticles) {
        particleMgr.emitBeatChargeParticles(p, p.perfectBeatCount, state);
      }
    }

    handleAttacks(dt, p, inputs, state);
    handleRoll(dt, p, inputs, state);
    handleDanceMove(dt, p, inputs, state, i);
    handleDanceBattleInput(p, inputs, state); // NEW: Check for Dance Battle trigger (Now handled automatically by DanceSpotManager)

    // Update ability cooldown timers (time-based)
    if (p.cooldowns) {
      for (const ability in p.cooldowns) {
        if (p.cooldowns[ability] > 0) {
          p.cooldowns[ability] = Math.max(0, p.cooldowns[ability] - dt);
        }
      }
    }
    // AttackSystem handles ultimates; legacy handler disabled
    handleMovement(dt, p, inputs, state);

    const maxStep = 240;
    const maxVel = Math.max(Math.abs(p.vel.x), Math.abs(p.vel.y));
    const substeps = Math.max(
      1,
      Math.ceil((maxVel * dt) / maxStep) + (p.walljumpBoost?.active ? 2 : 0)
    );
    const subDt = dt / substeps;

    for (let step = 0; step < substeps; step++) {
      applyPhysics(subDt, p, p.config?.physics || state.physics);
      resolveCollisionsStep(subDt, p, state, canvas);
    }
    // Player-to-player collision resolution (after environment collision)
    // resolvePlayerCollisions(dt, state); // DISABLED: Characters can now pass through each other
    updateAnimation(dt, p, inputs, state);
    // detectHits(p, i, state); // <-- REMOVED from here

    // Log player status and velocity changes (intelligent logging)
    logPlayerStatus(p, state);

    p.prevY = p.pos.y;
  }

  function handleUltimate(dt, p, inputs, state) {
    // Handle HP Ultimate via p.ultiPhase system (also for ernst)
    if (
      (p.charName.toLowerCase() === "hp" ||
        p.charName.toLowerCase() === "ernst") &&
      p.ultiPhase
    ) {
      handleHPUltimate(dt, p, state);
    }

    // Handle Cyboard Ultimate via p.ultiPhase system
    if (p.charName === "cyboard" && p.ultiPhase) {
      handleCyboardUltimate(dt, p, state);
    }
  }

  function handleHPUltimate(dt, p, state) {
    // HP Ultimate Phase Management
    if (!p.ultiPhase) {
      p.ultiPhase = "start";
      p.ultiTarget = null;
      p.ultiStartTime = performance.now() * 0.001; // Initialize timer immediately
      p.ultiDuration = 10.0;
      p.invincible = true;
    }

    switch (p.ultiPhase) {
      case "start":
        // HP: Fahrrad Ultimate Start
        if (p.animFinished && p.anim === "r2_l2_ulti_start") {
          p.ultiPhase = "active";
          p.ultiStartTime = performance.now() * 0.001; // Convert to seconds
          setAnim(p, "r2_l2_ulti", true, state); // TRUE = Loop f�r 10 Sekunden
          p.invincible = true; // Unbesiegbar f�r 10 Sekunden
        }
        break;

      case "active":
        // HP: Fahrrad Ultimate Active Phase (10 seconds)
        const currentTime = performance.now() * 0.001; // Convert to seconds
        const elapsedTime = currentTime - p.ultiStartTime;

        if (elapsedTime >= p.ultiDuration) {
          // Ultimate ended - transition to end phase
          p.ultiPhase = "end";
          p.invincible = false;
        } else {
          // Check for collision with enemies during bike ride
          checkHPBikeCollision(p, state);
        }
        break;

      case "end":
        // HP: Ultimate End Phase - transition back to normal state
        if (
          p.anim === "r2_l2_ulti" ||
          p.anim === "bike_jump_fall" ||
          p.anim === "bike_jump_up" ||
          p.anim === "bike_double_jump"
        ) {
          // Force transition to idle when ultimate ends
          setAnim(p, "idle", true, state);
        }

        // Clean up ultimate state immediately
        p.ultiPhase = null;
        p.ultiStartTime = null;
        p.ultiDuration = null;
        p.invincible = false;

        break;
    }
  }

  function handleCyboardUltimate(dt, p, state) {
    // Cyboard Ultimate: Portal Teleportation + Explosive Finish
    switch (p.ultiPhase) {
      case "start":
        // Phase 1: Portal opening animation (r2_l2_ulti_start)
        // Initialize target search on first call
        if (!p.ultiTarget && !p.ultiTargetSearchDone) {
          p.ultiTargetSearchDone = true;
          p.invincible = true;

          // Find nearest opponent (by padIndex, not charName - supports mirror matches)
          const opponents = state.players.filter(
            (player) => player.padIndex !== p.padIndex && !player.eliminated
          );

          if (opponents.length === 0) {
            debugLog(
              `[CYBOARD ULTI START] P${p.padIndex}: All players: ${state.players
                .map((pl) => `P${pl.padIndex}:${pl.charName}`)
                .join(", ")}`
            );
          }

          if (opponents.length > 0) {
            // Find closest opponent
            let closestOpponent = opponents[0];
            let closestDistance = Math.sqrt(
              Math.pow(opponents[0].pos.x - p.pos.x, 2) +
                Math.pow(opponents[0].pos.y - p.pos.y, 2)
            );

            for (let i = 1; i < opponents.length; i++) {
              const distance = Math.sqrt(
                Math.pow(opponents[i].pos.x - p.pos.x, 2) +
                  Math.pow(opponents[i].pos.y - p.pos.y, 2)
              );
              if (distance < closestDistance) {
                closestDistance = distance;
                closestOpponent = opponents[i];
              }
            }

            p.ultiTarget = closestOpponent;
            debugLog(
              `[Cyboard Ultimate] ? Target found: ${
                p.ultiTarget.charName
              } at distance ${closestDistance.toFixed(0)}px`
            );
          } else {
            debugLog("[Cyboard Ultimate] ? No target found, ending ultimate");
            p.ultiPhase = "end";
            return;
          }
        }

        // Start reverse animation on target
        if (!p.ultiTargetReverseAnimStarted && p.ultiTarget) {
          // Start reverse animation on target (frames 9?0)
          p.ultiTarget.ultiReverseAnim = {
            frames: [
              "r2_l2_ulti_009",
              "r2_l2_ulti_008",
              "r2_l2_ulti_007",
              "r2_l2_ulti_006",
              "r2_l2_ulti_005",
              "r2_l2_ulti_004",
              "r2_l2_ulti_003",
              "r2_l2_ulti_002",
              "r2_l2_ulti_001",
              "r2_l2_ulti_000",
            ],
            currentFrame: 0,
            frameTime: 0,
            frameDuration: 1 / 12, // 12 FPS
            finished: false,
          };
          debugLog(
            "[Cyboard Ultimate] ? Started reverse portal animation on target"
          );
          p.ultiTargetReverseAnimStarted = true;
        }

        if (p.animFinished && p.anim === "r2_l2_ulti_start") {
          // Check if we have a valid target
          if (!p.ultiTarget) {
            debugLog(
              "[Cyboard Ultimate] ? No target available after anim, ending ultimate"
            );
            p.ultiPhase = "end";
            return;
          }

          // Wait for reverse animation to finish on target
          if (
            !p.ultiTarget.ultiReverseAnim ||
            p.ultiTarget.ultiReverseAnim.finished
          ) {
            p.ultiPhase = "teleport";
            debugLog(
              "[Cyboard Ultimate] ? Portal opened, transitioning to teleport phase"
            );
          }
        }
        break;

      case "teleport":
        // Phase 2: Teleport to target and start finish animation (instant, no wait)
        if (p.ultiTarget) {
          // Teleport to target position
          p.pos.x = p.ultiTarget.pos.x;
          p.pos.y = p.ultiTarget.pos.y;
          p.facing = p.ultiTarget.facing * -1; // Face the target

          // Start explosive finish animation
          setAnim(p, "r2_l2_ulti_finish", false, state);
          p.ultiPhase = "finish";

          debugLog(
            `[Cyboard Ultimate] ? Teleported to (${p.pos.x.toFixed(
              0
            )}, ${p.pos.y.toFixed(0)}), starting explosive finish`
          );
        } else {
          p.ultiPhase = "end";
        }
        break;

      case "finish":
        // Phase 3: Explosive finish animation with damage
        if (p.animFinished && p.anim === "r2_l2_ulti_finish") {
          // Apply damage and knockback to target
          if (p.ultiTarget && !p.ultiTarget.eliminated) {
            // 30% damage
            p.ultiTarget.percentage += 30;

            // Strong knockback (up and away)
            const knockbackStrength = 1200;
            const knockbackX = p.facing * knockbackStrength;
            const knockbackY = -knockbackStrength * 0.8; // Upward component

            p.ultiTarget.queuedKnockback = {
              vx: knockbackX,
              vy: knockbackY,
              stun: 1.5, // 1.5 seconds stun
            };
          }

          p.ultiPhase = "end";
        }
        break;

      case "end":
        // Cleanup
        if (p.ultiTarget) {
          p.ultiTarget.ultiReverseAnim = null;
        }
        p.ultiPhase = null;
        p.ultiTarget = null;
        p.ultiTargetSearchDone = false; // Reset search flag for next ultimate
        p.ultiTargetReverseAnimStarted = false;
        p.invincible = false;
        setAnim(p, "idle", true, state);
        break;

      default:
        console.error("Unknown ulti phase:", p.ultiPhase);
        p.ultiPhase = "end"; // Force end on unknown phase
        break;
    }
  }

  // Helper function to check and start cooldown
  function canUseAbility(p, ability) {
    const canUse = !p.cooldowns || p.cooldowns[ability] <= 0;
    // Cyboard L2 requires ground contact to prevent spam
    if (ability === "l2" && p.charName === "cyboard") {
      const grounded = !!p.grounded;
      const canUseGrounded = canUse && grounded;
      debugLog(
        `[canUseAbility] P${
          p.padIndex + 1
        } (Cyboard): L2 ability check - canUse: ${canUse}, grounded: ${grounded}, final: ${canUseGrounded}`
      );
      debugLog(
        `[canUseAbility] - l2 cooldown: ${
          p.cooldowns?.[ability] || "undefined"
        }`
      );
      return canUseGrounded;
    }
    return canUse;
  }

  function startCooldown(p, ability, state) {
    if (p.cooldowns && state.cooldownConfig) {
      p.cooldowns[ability] = state.cooldownConfig[ability];
    }
  }
  function handleAttacks(dt, p, inputs, state) {
    // Delegate to AttackSystem
    AttackSystem.handleAttacks(dt, p, inputs, state);

    // If the modular AttackSystem started an attack, avoid running legacy attack logic
    if (p.attack && p.attack.type !== "none" && p.attack.owner === "mod") {
      return;
    }

    // Keep beat-matching logic in physics.js for now
    const canAttack =
      !p.roll?.active &&
      !p.shield?.active &&
      (p.stunT || 0) <= 0 &&
      !p.isInvincible;
    p.attack = p.attack || { type: "none", phase: "none" };

    // ?? BEAT-MATCH ATTACK BOOST: Check if any attack input is on beat
    const hasAttackInput =
      inputs.r1Down || inputs.r2Down || inputs.l1Down || inputs.l2Down;
    const wasOnBeat = hasAttackInput && isInBeatWindow(state);

    if (wasOnBeat && hasAttackInput) {
      p.attack.wasOnBeat = true;
    } else if (hasAttackInput) {
      // Reset flag for off-beat inputs
      p.attack.wasOnBeat = false;
    }
    // Note: wasOnBeat flag persists until attack ends or new attack starts

    // ?? INPUT LOGGING - Log all attack inputs
    const activeInputs = [];
    if (inputs.r1Down) activeInputs.push("R1");
    if (inputs.r2Down) activeInputs.push("R2");
    if (inputs.l1Down) activeInputs.push("L1");
    if (inputs.l2Down) activeInputs.push("L2");
    if (inputs.r1CircleDown) activeInputs.push("R1_CIRCLE");
    if (inputs.r1UpDown) activeInputs.push("R1_UP");
    if (inputs.r1DashDown) activeInputs.push("R1_DASH");
    if (inputs.r1JumpDown) activeInputs.push("R1_JUMP");

    // Reduced input logging frequency
    if (activeInputs.length > 0 && Math.random() < 0.1) {
      debugLog(
        `[INPUT] P${p.padIndex} (${p.charName}): ${activeInputs.join(
          ", "
        )} | canAttack: ${canAttack} | currentAttack: ${
          p.attack?.type || "none"
        }`
      );
    }

    if (
      inputs.r1CircleDown &&
      p.attack.type === "none" &&
      canAttack &&
      p.grounded
    ) {
      p.attack = { type: "r1_circle_attack", phase: "active" };
      setAnim(p, "r1_circle_attack", false, state);
      const pconf = p.config.physics;
      p.vel.x = p.facing * pconf.moveSpeed * 3.0;
      p.vel.y = 0;
      return; // Consume input
    }

    if (
      p.charName === "cyboard" &&
      p.swordIsOut &&
      inputs.r2Down &&
      canAttack
    ) {
      // Find the sword and recall it
      const sword = state.projectiles.find(
        (proj) => proj.owner === p && proj.type === "cyboard_sword"
      );

      if (sword && sword.state === "hanging") {
        sword.state = "returning";
        sword.returnStartTime = performance.now(); // Track when return started
      }
      // Prevent starting another attack by consuming the input logic for this frame
      return;
    }

    if (p.attack.type === "none" && canAttack) {
      // Ultimate handling is now done by AttackSystem.handleAttacks
      // Legacy code removed - all ultimates use AttackSystem now
      if (
        inputs.l3UpR1Down &&
        p.charName === "fritz" &&
        canUseAbility(p, "r1")
      ) {
        // Fritz: L3 up + R1 overhead attack (works from ground or air)
        p.attack = { type: "r1_up_attack", phase: "active" };
        startCooldown(p, "r1", state);
        setAnim(p, "r1_up_attack", false, state);
      }
    } else if (p.attack.type === "r1_circle_attack") {
      if (p.animFinished) {
        p.attack = { type: "none", phase: "none" };
      }
    } else if (p.attack.type === "r1_up_attack") {
      if (p.animFinished) {
        p.attack = { type: "none", phase: "none" };
      }
    } else if (p.attack.type === "r2_hit_followup") {
      if (p.animFinished) {
        p.attack = { type: "none", phase: "none" };
      }
    } else if (
      p.attack.type === "l1_ranged_grab" &&
      (p.charName === "HP" || p.charName.toLowerCase() === "ernst")
    ) {
      if (p.animFinished) {
        p.attack = { type: "none", phase: "none" };
      }
    } else if (p.attack.type === "l2" && p.charName === "cyboard") {
      // Cyboard: L2 Smash Attack (New Multi-Phase Attack)
      debugLog(
        `[Physics] P${
          p.padIndex + 1
        } (Cyboard): L2 Attack Processing - phase: ${p.attack.phase}, frame: ${
          p.frameIndex
        }`
      );

      if (p.attack.phase === "start") {
        // Initialize charge phase
        if (p.frameIndex === 0 && !p.attack.initialized) {
          p.attack.initialized = true;
          p.attack.startX = p.pos.x;
          p.attack.startY = p.pos.y;
          p.vel.x = 0; // Stoppe Bewegung
          p.attack.chargeTime = 0;
          p.attack.maxChargeTime = 1.0; // Max 1 Sekunde laden (doppelt so schnell)
          setAnim(p, "l2_smash_charge", false, state);
        }

        // Charge-Mechanik: L2 halten = mehr Power
        if (inputs.l2Held && p.attack.chargeTime < p.attack.maxChargeTime) {
          p.attack.chargeTime += dt;

          // Wechsle zur Loop-Animation wenn die erste Charge-Animation fertig ist
          if (p.animFinished && p.anim === "l2_smash_charge") {
            setAnim(p, "l2_smash_charge_loop", true, state); // Loop = true
          }

          // Verlangsamung der Animation w�hrend des Ladens
          // Don't override animSpeed for dance animations
          if (!p.anim || !p.anim.includes("dance")) {
            p.animSpeed = Math.max(
              0.3,
              1.0 - (p.attack.chargeTime / p.attack.maxChargeTime) * 0.7
            );
          }

          // Visual feedback f�r Charge
          const chargeProgress = p.attack.chargeTime / p.attack.maxChargeTime;
          debugLog(
            `[Cyboard L2] Charging: ${(chargeProgress * 100).toFixed(
              0
            )}% - Time: ${p.attack.chargeTime.toFixed(2)}s`
          );
        }

        // Release oder Max Charge erreicht
        if (!inputs.l2Held || p.attack.chargeTime >= p.attack.maxChargeTime) {
          p.attack.phase = "jump";
          p.attack.jumpStarted = true;
          p.attack.jumpTime = 0;
          p.attack.jumpDuration = 0.15; // Doppelt so schnell

          // EMERGENCY FIX: Charge-basierte Skalierung (capped at 2.5x)
          const chargeMultiplier = Math.min(
            Math.max(
              1.0,
              1.0 + (p.attack.chargeTime / p.attack.maxChargeTime) * 1.5
            ),
            2.5 // EMERGENCY FIX: Cap at 2.5x instead of 3.0x
          );

          p.attack.jumpHeight = 120 * chargeMultiplier; // H�here Sprung bei mehr Charge
          p.attack.jumpAngle = 45;
          p.attack.jumpDistance = 200 * chargeMultiplier; // Gr��ere Distanz

          p.attack.targetX =
            p.pos.x +
            p.facing *
              Math.cos((p.attack.jumpAngle * Math.PI) / 180) *
              p.attack.jumpDistance;
          p.attack.targetY = p.pos.y - p.attack.jumpHeight;
          p.grounded = false;
          // Don't override animSpeed for dance animations
          if (!p.anim || !p.anim.includes("dance")) {
            p.animSpeed = 1.0; // Normale Geschwindigkeit f�r Sprung
          }

          // Speichere Charge-Multiplier f�r sp�tere Phasen
          p.attack.chargeMultiplier = chargeMultiplier;

          // Wechsle zur Haupt-Animation f�r Sprung und Impact
          setAnim(p, "l2_smash_jump", false, state);

          debugLog(
            `[Cyboard L2] Phase 2: 45° Sprung gestartet - Charge: ${chargeMultiplier.toFixed(
              2
            )}x`
          );
        }
      } else if (p.attack.phase === "jump") {
        // Frames 4-5: Sehr schneller 45� Sprung
        p.attack.jumpTime += dt;
        const jumpProgress = Math.min(
          p.attack.jumpTime / p.attack.jumpDuration,
          1.0
        );

        // Schnelle Bewegung zum Zielpunkt
        const lerpSpeed = 8.0; // Sehr schnell
        p.pos.x =
          p.attack.startX + (p.attack.targetX - p.attack.startX) * jumpProgress;
        p.pos.y =
          p.attack.startY + (p.attack.targetY - p.attack.startY) * jumpProgress;

        // Velocity f�r visuellen Effekt
        p.vel.x = (p.attack.targetX - p.attack.startX) * lerpSpeed;
        p.vel.y = (p.attack.targetY - p.attack.startY) * lerpSpeed;

        // Transition zu Schwebe-Phase
        if (jumpProgress >= 1.0) {
          p.attack.phase = "hover";
          p.attack.hoverTime = 0;
          p.attack.hoverDuration = 0.2; // Schweben f�r Frames 6-7 (doppelt so schnell)
          p.attack.hoverX = p.pos.x;
          p.attack.hoverY = p.pos.y;
          p.vel.x = 0;
          p.vel.y = 0;

          // Setze Hover-Animation
          setAnim(p, "l2_smash_hover", false, state);
        }
      } else if (p.attack.phase === "hover") {
        // Frames 6-7: Schwebend still
        p.attack.hoverTime += dt;
        const hoverProgress = Math.min(
          p.attack.hoverTime / p.attack.hoverDuration,
          1.0
        );

        // Bleibe an der Position schweben
        p.pos.x = p.attack.hoverX;
        p.pos.y = p.attack.hoverY;
        p.vel.x = 0;
        p.vel.y = 0;

        // Transition zu Impact-Phase
        if (hoverProgress >= 1.0) {
          p.attack.phase = "fall";
          p.attack.impactTime = 0;
          p.attack.impactDuration = 0.1; // Sehr schneller Impact (doppelt so schnell)
          p.attack.groundTargetY = p.attack.startY; // Zur�ck zum Boden
          p.attack.impactStarted = false;
          p.attack.impactTriggered = false;
          p.attack.stunnedTargets = []; // Liste der gestunnten Gegner

          // Starte mit Fall-Animation, Impact kommt sp�ter
          setAnim(p, "l2_smash_fall", false, state);
        }
      } else if (p.attack.phase === "fall") {
        // Fall-Phase: Warten bis Animation fertig ist, dann zu Impact
        p.attack.impactTime += dt;

        if (p.animFinished) {
          // Wechsle zur Impact-Animation
          const chargeMultiplier = p.attack.chargeMultiplier || 1.0;
          if (chargeMultiplier >= 2.0) {
            setAnim(p, "l2_impact_high", false, state);
            debugLog(
              `[Cyboard L2] Phase 5: HIGH Impact gestartet (Charge: ${chargeMultiplier.toFixed(
                2
              )}x)`
            );
          } else {
            setAnim(p, "l2_impact_low", false, state);
            debugLog(
              `[Cyboard L2] Phase 5: LOW Impact gestartet (Charge: ${chargeMultiplier.toFixed(
                2
              )}x)`
            );
          }
          p.attack.phase = "impact";
          p.attack.impactTime = 0;
        }
      } else if (p.attack.phase === "impact") {
        // Frames 8-13: Extrem schneller senkrechter Fall + Impact
        p.attack.impactTime += dt;
        const impactProgress = Math.min(
          p.attack.impactTime / p.attack.impactDuration,
          1.0
        );

        // Extrem schneller senkrechter Fall
        p.pos.x = p.attack.hoverX; // Bleibe horizontal
        p.pos.y =
          p.attack.hoverY +
          (p.attack.groundTargetY - p.attack.hoverY) * impactProgress;
        p.vel.x = 0;
        p.vel.y = 2000; // Sehr schnelle Fallgeschwindigkeit

        // Pr�fe Bedingungen f�r Impact-Trigger
        const chargeMultiplier = p.attack.chargeMultiplier || 1.0;
        const hasMinimumCharge = chargeMultiplier >= 1.5; // Mindestens Low Charge (1.5x)

        // Pr�fe ob Gegner im Impact-Zentrum ist (letzter Frame der Smash-Animation = Frame 10)
        let hasEnemyInCenter = false;
        if (p.frameIndex === 10 && !p.attack.impactTriggered) {
          const baseRadius = 70; // Cyboards Breite (70px)
          const explosionRadius = baseRadius * chargeMultiplier;
          const explosionCenter = { x: p.pos.x, y: p.pos.y };

          for (const target of state.players) {
            if (target !== p && !target.eliminated) {
              const distance = Math.sqrt(
                Math.pow(target.pos.x - explosionCenter.x, 2) +
                  Math.pow(target.pos.y - explosionCenter.y, 2)
              );

              if (distance <= explosionRadius * 0.5) {
                // Nur im inneren 50% Bereich
                hasEnemyInCenter = true;
                break;
              }
            }
          }

          if (hasEnemyInCenter) {
            p.attack.impactTriggered = true;
          }
        }

        // Trigger Impact-Effekt nur wenn Bedingungen erf�llt sind
        if (hasMinimumCharge && hasEnemyInCenter && !p.attack.impactStarted) {
          p.attack.impactStarted = true;

          const baseRadius = 70; // Cyboards Breite (70px)
          const explosionRadius = baseRadius * chargeMultiplier;
          const explosionCenter = { x: p.pos.x, y: p.pos.y };
          debugLog(
            `[Cyboard L2] Impact Explosion - Radius: ${explosionRadius.toFixed(
              0
            )} (Charge: ${chargeMultiplier.toFixed(2)}x)`
          );

          // Hit all enemies in explosion radius
          for (const target of state.players) {
            if (target !== p && !target.eliminated) {
              const distance = Math.sqrt(
                Math.pow(target.pos.x - explosionCenter.x, 2) +
                  Math.pow(target.pos.y - explosionCenter.y, 2)
              );

              if (distance <= explosionRadius) {
                // Stun bis Impact-Animation abgespielt ist
                const impactAnimDuration =
                  p.anim === "l2_impact_high" ? 0.375 : 0.25; // Dauer der Impact-Animation (doppelt so schnell)
                target.stunned = true;
                target.stunT = impactAnimDuration;
                p.attack.stunnedTargets.push(target);
              }
            }
          }
        }

        // Knockback nach Impact-Animation
        if (p.attack.impactStarted && p.animFinished) {
          // Get descriptor for L2 Smash Attack
          const descriptor = AttackCatalog.getDescriptor(p, "l2_smash");
          const baseRadius = 70;
          const explosionRadius = baseRadius * chargeMultiplier;
          const explosionCenter = { x: p.pos.x, y: p.pos.y };

          // Knockback auf alle gestunnten Gegner anwenden
          for (const target of p.attack.stunnedTargets) {
            if (target && !target.eliminated) {
              const distance = Math.sqrt(
                Math.pow(target.pos.x - explosionCenter.x, 2) +
                  Math.pow(target.pos.y - explosionCenter.y, 2)
              );

              // Calculate knockback strength based on distance from center
              const normalizedDistance = Math.min(
                distance / explosionRadius,
                1.0
              );
              const knockbackStrength = Math.pow(1 - normalizedDistance, 1.5);

              // Calculate scaled damage and knockback based on distance and charge
              const baseDamage = descriptor.baseDamage || 6;
              const baseKnockback = descriptor.baseKnockback || 550;

              // Distance-based scaling: 0.0 (edge) to 1.0 (center)
              const scaledDamage =
                baseDamage + baseDamage * 0.67 * knockbackStrength; // 6 to 10 at center
              const scaledKnockback =
                baseKnockback + baseKnockback * 0.73 * knockbackStrength; // 550 to 950 at center

              // Apply charge multiplier (with 80% knockback reduction as per original)
              const finalDamage = scaledDamage * chargeMultiplier;
              const finalKnockback = scaledKnockback * chargeMultiplier * 0.2;

              // Create modified descriptor with calculated values
              const modifiedDescriptor = {
                ...descriptor,
                baseDamage: finalDamage,
                baseKnockback: finalKnockback,
              };

              // Apply damage and knockback using descriptor system
              AttackSystem.applyDamageWithDescriptor(
                p,
                target,
                modifiedDescriptor,
                state
              );

              debugLog(
                `[Cyboard L2] Impact Knockback - distance: ${distance.toFixed(
                  1
                )}, force: ${finalKnockback.toFixed(
                  0
                )}, damage: ${finalDamage.toFixed(1)}`
              );
            }
          }

          // Spawn explosion visual effect
          spawnEffect(state, p, "explosion", {
            pos: { x: p.pos.x, y: p.pos.y },
            scale: 1.0 * chargeMultiplier,
            duration: 1.2 * chargeMultiplier,
          });
        }

        // End attack when animation finishes
        if (p.animFinished) {
          // Attack komplett beenden
          p.attack = { type: "none", phase: "none" };
        }
      }
    } else if (p.attack.type === "l2" && p.charName === "fritz") {
      // Fritz: L2 Multi-Hit Attack
      // Delegate to AttackSystem
      AttackSystem.handleFritzL2(p, inputs, state);
    } else if (p.attack.type === "r2_l2_ulti") {
      // Handle Fritz Ultimate only (HP uses different system)
      if (p.charName === "fritz") {
        handleFritzUlti(dt, p, state);
      }
    }
  }

  function handleShield(dt, p, inputs, state) {
    // Shield system has been removed - replaced by Dance Battle
    // Kept as stub for backward compatibility
    return;
  }

  // NEW: Check if Player is at Active Dance Spot
  function checkPlayerAtDanceSpot(p, state) {
    if (!state.danceMode?.active || !state.danceMode.currentActiveSpot) {
      return false;
    }

    // Only check if player is grounded
    if (!p.grounded) {
      return false;
    }

    const spot = state.danceMode.currentActiveSpot;
    const hurtbox = Renderer.getHurtbox(p);

    // Calculate distance from player center to spot center
    const playerCenterX = p.pos.x;
    const playerCenterY = p.pos.y - hurtbox.h / 2; // Adjust for hurtbox
    const dx = playerCenterX - spot.pos.x;
    const dy = playerCenterY - spot.pos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Detection radius based on spot size
    const detectionRadius = spot.size / 2; // Half of frame width

    return distance <= detectionRadius;
  }
  function handleRoll(dt, p, inputs, state) {
    p.roll = p.roll || { active: false, t: 0 };

    // Ground roll (existing)
    if (
      !p.roll.active &&
      p.grounded &&
      p.attack?.type === "none" &&
      inputs.rollDown &&
      canUseAbility(p, "roll")
    ) {
      p.roll.active = true;
      p.roll.t = 0;
      p.roll.isAirDodge = false;
      p.invincible = false; // Start without invincibility - will be set frame-based
      p.attack = { type: "none", phase: "none" }; // Cancel any active attack
      startCooldown(p, "roll", state);
      // If down is held, perform a spot dodge (no direction)
      p.roll.dir = inputs.downHeld ? 0 : p.facing;
      setAnim(p, "roll", false, state);

      // If player is on a semisolid and presses down for a spot-dodge,
      // convert the ground spot-dodge into a semisolid drop-through while
      // keeping the dodge animation/frames. This reuses the air-dodge
      // movement behavior to avoid horizontal travel during the drop.
      try {
        const onSemisolid = isPlayerOnSemisolid(p, state);
        const isSpotDodgeOnSemisolid = inputs.downHeld && onSemisolid;
        if (isSpotDodgeOnSemisolid) {
          // Reuse air-dodge movement for drop-through behavior
          p.roll.isAirDodge = true;
          // Activate/extend drop-through timer so collision ignores semisolid
          p.dropThroughTimer = Math.max(p.dropThroughTimer || 0, 0.3);
          // Leave grounded state and nudge player down to avoid re-catching
          p.grounded = false;
          p.pos.y += 2;
        }
      } catch (e) {
        // Defensive: if helper not available, don't break roll
        console.warn("Semisolid spot-dodge check failed:", e);
      }
    }

    // Air dodge (new) - Roll in air while holding down
    // BUT: Don't activate if touching a wall (wallslide takes priority)
    if (
      !p.roll.active &&
      !p.grounded &&
      p.attack?.type === "none" &&
      inputs.rollDown &&
      inputs.downHeld &&
      canUseAbility(p, "roll")
    ) {
      // Check for wall contact - if touching wall, let wallslide logic handle it instead
      let touchingWall = false;
      if (state.walljumpData) {
        const hb = Renderer.getHurtbox(p);
        const checkPoints = [
          { x: hb.left - 2, y: hb.top + hb.h / 2 },
          { x: hb.left + hb.w + 2, y: hb.top + hb.h / 2 },
        ];
        for (const pt of checkPoints) {
          if (isWalljumpPixelScaled(pt.x, pt.y, state.walljumpData, state)) {
            touchingWall = true;
            break;
          }
        }
      }

      // Only activate air dodge if NOT touching a wall
      if (!touchingWall) {
        p.roll.active = true;
        p.roll.t = 0;
        p.roll.isAirDodge = true;
        p.invincible = false; // Start without invincibility - will be set frame-based
        p.attack = { type: "none", phase: "none" }; // Cancel any active attack
        startCooldown(p, "roll", state);
        p.roll.dir = 0; // Air dodge has no horizontal movement
        setAnim(p, "roll", false, state);
        // Activate drop-through for air dodge
        p.dropThroughTimer = 0.3;
      }
    }

    if (p.roll.active) {
      // CRITICAL: If player gets stunned during dodge (shouldn't happen due to invincibility,
      // but handle as fallback), immediately stop the roll and reset velocity
      if (p.stunT && p.stunT > 0) {
        const wasAirDodge = p.roll.isAirDodge;
        p.roll.active = false;
        p.roll.isAirDodge = false;
        p.invincible = false;
        p.vel.x = 0;
        // Don't reset vel.y for air dodge to allow natural fall, but stop horizontal movement for ground roll
        if (!wasAirDodge) {
          p.vel.y = 0;
        }
        return;
      }

      const ROLL_DURATION = 1.0; // Increased from 0.529375 for longer invincibility frames and better precision
      const ROLL_SPEED = 1118; // Reduced from 1490 (half of the added range removed: 1490 - 372 = 1118) for shorter distance but longer duration
      p.roll.t += dt;

      // Different movement for air dodge vs ground roll
      if (p.roll.isAirDodge) {
        // Air dodge: no horizontal movement, slight downward drift
        p.vel.x = 0;
        p.vel.y = Math.min(p.vel.y + 200 * dt, 300); // Gentle downward drift
      } else {
        // Ground roll: normal horizontal movement WITH wall collision check
        const desiredVelX = p.roll.dir * ROLL_SPEED;

        // CRITICAL: Check wall collision BEFORE applying velocity
        // Without this, player can phase through wall corner during roll's fast movement
        // causing position offset and triggering out-of-bounds in lateral kill zones
        if (state.groundData && desiredVelX !== 0) {
          const hb = Renderer.getHurtbox(p);
          const checkX = desiredVelX > 0 ? hb.left + hb.w : hb.left;
          const checkYTop = hb.top + 4;
          const checkYMid = hb.top + hb.h / 2;
          const checkYBottom = hb.top + hb.h - 4;

          const wouldCollide =
            isPixelSolid(checkX, checkYTop, state.groundData) ||
            isPixelSolid(checkX, checkYMid, state.groundData) ||
            isPixelSolid(checkX, checkYBottom, state.groundData);

          if (wouldCollide) {
            // Prevent roll into wall - stop roll immediately
            p.roll.active = false;
            p.invincible = false;
            p.vel.x = 0;
            console.log(`🛑 Roll blocked by wall for ${p.charName}`);
          } else {
            p.vel.x = desiredVelX;
          }
        } else {
          p.vel.x = desiredVelX;
        }
      }

      // Duration-based invincibility: Invincible for the entire roll duration
      // This provides longer invincibility frames for better precision when dodging attacks
      p.invincible = true;

      if (p.roll.t >= ROLL_DURATION || p.animFinished) {
        p.roll.active = false;
        p.roll.isAirDodge = false;
        p.invincible = false; // Ensure invincibility is cleared when roll ends
      }
    }
  }
  function handleDanceMove(dt, p, inputs, state, playerIndex) {
    // Cooldown abzählen
    if (p.danceCooldown) {
      p.danceCooldown = Math.max(0, p.danceCooldown - dt);
    }

    if (
      state.danceBattle?.active &&
      (state.danceBattle.inputLocked || state.danceBattle.countdown?.active)
    ) {
      return;
    }

    // Dance-Input prüfen (Debug aktiviert)
    if (inputs.danceDown) {
    }

    // Perfect-Sequenz-Logik entfernt - dance_c ist jetzt eine einzelne Animation
    if (
      inputs.danceDown &&
      p.attack?.type === "none" &&
      !p.roll?.active &&
      (p.danceCooldown || 0) <= 0
    ) {
      // NEW: Check Heatmap Zone Intensity
      // If Dance Mode is active, inputs in "Silent Zone" (Alpha ~0) are ignored
      if (
        window.DanceSpotManager &&
        state.danceMode?.active &&
        typeof p.danceZoneIntensity === "number"
      ) {
        if (p.danceZoneIntensity < 0.05) {
          return; // Dead Zone: Input does nothing
        }
      }

      const isInBeat = isInBeatWindow(state);
      // Neues Dance-System basierend auf Beat-Qualität
      const beatQuality = getBeatWindowQuality(state);

      // NEW: Update combo system based on beat quality (only if dance input was pressed)
      if (inputs.danceDown) {
        updateComboSystem(state, playerIndex, beatQuality);
      }

      applyDanceBeatAnimations(p, state, beatQuality);

      updateDanceBeatFeedback(state, p, beatQuality);

      // NEW: Reset perfect beat match on non-perfect beat
      if (
        beatQuality !== "perfect" &&
        AttackSystem &&
        AttackSystem.resetPerfectBeatMatch
      ) {
        AttackSystem.resetPerfectBeatMatch(p);
      }

      if (beatQuality === "perfect") {
        // 1. Calculate Multiplier based on Radial Distance (Zone.png logic)
        let chargeMultiplier = 1.0;
        let pointsMultiplier = 1.0;

        if (
          window.DanceSpotManager &&
          state.danceMode?.active &&
          state.danceMode.currentActiveSpot
        ) {
          const activeSpot = state.danceMode.currentActiveSpot;
          const pHb = Renderer.getHurtbox(p);
          const pX = pHb.left + pHb.w / 2;
          const pY = pHb.top + pHb.h;
          const dist = Math.hypot(pX - activeSpot.pos.x, pY - activeSpot.pos.y);

          if (dist < 150) {
            chargeMultiplier = 2.0; // Double charge in hot zone
            pointsMultiplier = 2.0; // Double points in hot zone
            // Trigger electric effect with high intensity
            if (
              window.WebGLRenderer &&
              window.WebGLRenderer.triggerElectricEffect
            ) {
              window.WebGLRenderer.triggerElectricEffect(pX, pY, 1.0, 6);
            }
            console.log(
              `[DanceBonus] Hot Zone! Double Charge & Points (Dist: ${dist.toFixed(
                0
              )})`
            );
          } else if (dist > 500) {
            chargeMultiplier = 0.5; // Half charge far away
            pointsMultiplier = 0.5; // Half points far away
            console.log(
              `[DanceBonus] Far Zone! Half Charge & Points (Dist: ${dist.toFixed(
                0
              )})`
            );
          }
        }

        // 2. Apply Ultimeter Gain with Multiplier
        const baseGain = UltimeterManager.GAIN_CONFIGS["perfect_beat"] || 15;
        const actualGain = baseGain * chargeMultiplier;

        // Apply directly instead of using gainUltimeter to avoid double scaling if gainUltimeter also used config
        // But gainUltimeter handles effects, so let's modify the player state temporarily or pass a multiplier if supported.
        // Since gainUltimeter is simple, let's just call it normally and add the extra if needed?
        // Better: Manually add the extra gain or subtract if < 1.0

        // Re-implement gain logic locally for precision or just call it multiple times / scaled
        // We will modify the gainRate temporarily? No, let's just direct modify current
        // Actually, let's just call gainUltimeter with a custom amount if possible, but it takes type.
        // Let's trust gainUltimeter for base and ADD/SUBTRACT delta.

        UltimeterManager.gainUltimeter(
          p,
          "perfect_beat",
          state,
          chargeMultiplier
        );

        p.musicNotes = Math.min(3, p.musicNotes + 1); // Gewinn 1 Note, max 3

        // 3. Update Beat Match Tracking (10 Segments Logic)
        // Instead of complex partial charges, we treat 1 segment = 1 charge.
        // Multiplier 2.0 = 2 segments.
        // Multiplier 0.5 = 50% chance OR accumulator.
        // Let's use accumulator for smooth UI.

        if (AttackSystem && AttackSystem.updatePerfectBeatMatch) {
          // Use accumulator on player for partial charges
          p.partialBeatCharge = (p.partialBeatCharge || 0) + chargeMultiplier;

          while (p.partialBeatCharge >= 1.0) {
            AttackSystem.updatePerfectBeatMatch(p, state);
            p.partialBeatCharge -= 1.0;
          }
        }

        // 4. Dance Battle Logic with Multiplier
        if (state.danceBattle.active) {
          const basePoints = 2; // Base points per perfect beat
          const actualPoints = basePoints * pointsMultiplier;

          // Accumulator for partial points
          p.partialBattlePoints = (p.partialBattlePoints || 0) + actualPoints;

          if (p.partialBattlePoints >= 1.0) {
            const pointsToAdd = Math.floor(p.partialBattlePoints);
            p.partialBattlePoints -= pointsToAdd;

            if (p.padIndex === 0) {
              state.danceBattle.p1BeatCount += pointsToAdd;
              triggerScreenFlash(state, 0.3);
              if (window.AudioSystem?.triggerPerfectBeatEffect)
                window.AudioSystem.triggerPerfectBeatEffect(0);

              if (state.danceBattle.p1BeatCount >= 6) {
                // Win condition
                state.danceBattle.winner = 0;
                scheduleDanceBattleKnockback(
                  state.players[0],
                  state.players[1],
                  state
                );
                return;
              }
            } else {
              state.danceBattle.p2BeatCount += pointsToAdd;
              triggerScreenFlash(state, 0.3);
              if (window.AudioSystem?.triggerPerfectBeatEffect)
                window.AudioSystem.triggerPerfectBeatEffect(1);

              if (state.danceBattle.p2BeatCount >= 6) {
                // Win condition
                state.danceBattle.winner = 1;
                scheduleDanceBattleKnockback(
                  state.players[1],
                  state.players[0],
                  state
                );
                return;
              }
            }
          }
        }

        if (
          state.tutorial?.active &&
          beatQuality === "perfect" &&
          p.padIndex === 0
        ) {
          window.TutorialSystem?.trackPerfectBeat?.(state, p);
        }

        // NEW: Trigger Electric Effect based on musicNotes (intensity increases with consecutive perfects)

        // NEW: Tutorial Part 3 Progress Tracking (Advanced Rhythm)
        if (
          state.tutorial?.active &&
          state.tutorial.part === 3 &&
          beatQuality === "perfect" &&
          p.padIndex === 0
        ) {
          const part3 = state.tutorial.part3;
          if (part3) {
            // Track beat charges with multiplier
            part3.beatChargeAccumulator =
              (part3.beatChargeAccumulator || 0) + chargeMultiplier;
            const maxCharges = part3.maxBeatCharges || 3;

            while (part3.beatChargeAccumulator >= 1.0) {
              const gainedCharges = Math.floor(part3.beatChargeAccumulator);
              part3.beatCharges = Math.min(
                maxCharges,
                (part3.beatCharges || 0) + gainedCharges
              );
              part3.beatChargeAccumulator -= gainedCharges;
              window.TutorialSystem?.setPartTwoTip?.(
                state,
                `Beat Charge erhalten! (${part3.beatCharges}/${maxCharges})`,
                2.5
              );
            }

            // Step A: Check if beat charges collected (at least 1)
            if (!part3.beatChargesCollected && part3.beatCharges >= 1) {
              part3.beatChargesCollected = true;
              // Show Step B modal after a short delay
              setTimeout(() => {
                if (state.tutorial?.part3 && !state.tutorial?.modal?.visible) {
                  window.TutorialSystem?.showPartThreeStepModal?.(
                    state,
                    "stepB"
                  );
                }
              }, 1000);
            }

            // Track center double bonus achievement (Step C)
            // Show Step C modal when player starts filling ultimeter (before it's full)
            if (
              !part3.centerDoubleAchieved &&
              !part3.ultimeterFull &&
              p.ultimeter.current < p.ultimeter.max * 0.7
            ) {
              // Check if we should show Step C modal (center hint)
              // This should appear while player is collecting, before ultimeter is full
              if (
                !state.tutorial?.modal?.visible &&
                part3.currentStep === "stepB" &&
                part3.chargedAttackUsed
              ) {
                // Show Step C modal after charged attack is used
                setTimeout(() => {
                  if (
                    state.tutorial?.part3 &&
                    !state.tutorial?.modal?.visible
                  ) {
                    window.TutorialSystem?.showPartThreeStepModal?.(
                      state,
                      "stepC"
                    );
                  }
                }, 2000);
              }
            }

            if (!part3.centerDoubleAchieved && chargeMultiplier >= 2.0) {
              part3.centerDoubleAchieved = true;
              window.TutorialSystem?.setPartTwoTip?.(
                state,
                "Im Zentrum verdoppelt sich alles!",
                3
              );
              // Show Step D modal after center achievement
              setTimeout(() => {
                if (state.tutorial?.part3 && !state.tutorial?.modal?.visible) {
                  window.TutorialSystem?.showPartThreeStepModal?.(
                    state,
                    "stepD"
                  );
                }
              }, 3000);
            } else if (!part3.quietZoneHintShown && chargeMultiplier < 0.6) {
              part3.quietZoneHintShown = true;
              window.TutorialSystem?.setPartTwoTip?.(
                state,
                "Leise Zone: Boni nur etwa 25%",
                3
              );
            }

            // Track ultimeter fill (Step E)
            if (
              !part3.ultimeterFull &&
              p.ultimeter.current >= p.ultimeter.max
            ) {
              part3.ultimeterFull = true;
              window.TutorialSystem?.setPartTwoTip?.(
                state,
                "Ultimeter voll! Führe jetzt das Ultimate aus.",
                4
              );
            }
          }
        }

        // NEW: Tutorial Part 1 Progress Tracking
        if (
          state.tutorial?.active &&
          state.tutorial.part === 1 &&
          beatQuality === "perfect"
        ) {
          // Check if player is at tutorial dance spot
          if (state.tutorial.danceSpotActive && state.tutorial.activeSpotPos) {
            const spotPos = state.tutorial.activeSpotPos;
            const spotSize = state.tutorial.activeSpotSize || 256;
            const playerHb = Renderer.getHurtbox(p);
            const playerCenterX = playerHb.left + playerHb.w / 2;
            const playerCenterY = playerHb.top + playerHb.h / 2;

            const distX = Math.abs(playerCenterX - spotPos.x);
            const distY = Math.abs(playerCenterY - spotPos.y);
            const maxDist = spotSize / 2 + 50; // 50px tolerance

            if (distX < maxDist && distY < maxDist) {
              state.tutorial.perfectBeatCount++;
              console.log(
                `[Tutorial] Perfect beat at dance spot! Progress: ${state.tutorial.perfectBeatCount}/${state.tutorial.requiredPerfectBeats}`
              );

              // Check if tutorial part 1 is complete
              if (
                state.tutorial.perfectBeatCount >=
                state.tutorial.requiredPerfectBeats
              ) {
                console.log(
                  "[Tutorial] Part 1 complete! Starting victory dance..."
                );
                // Start victory dance sequence instead of direct transition
                startTutorialVictoryDance(state);
              }
            }
          }

          if (state.tutorial?.active && state.tutorial.part === 2) {
            const part2 = state.tutorial.part2;
            if (part2) {
              part2.beatChargeAccumulator =
                (part2.beatChargeAccumulator || 0) + chargeMultiplier;
              const gainedCharges = Math.floor(part2.beatChargeAccumulator);
              if (gainedCharges > 0) {
                const maxCharges = part2.maxBeatCharges || 3;
                part2.beatCharges = Math.min(
                  maxCharges,
                  (part2.beatCharges || 0) + gainedCharges
                );
                part2.beatChargeAccumulator -= gainedCharges;
                window.TutorialSystem?.setPartTwoTip?.(
                  state,
                  `Beat Charge erhalten! (${part2.beatCharges}/${maxCharges})`,
                  2.5
                );
              }

              if (!part2.centerDoubleAchieved && chargeMultiplier >= 2.0) {
                part2.centerDoubleAchieved = true;
                window.TutorialSystem?.setPartTwoTip?.(
                  state,
                  "Im Zentrum verdoppelt sich alles!",
                  3
                );
              } else if (!part2.quietZoneHintShown && chargeMultiplier < 0.6) {
                part2.quietZoneHintShown = true;
                window.TutorialSystem?.setPartTwoTip?.(
                  state,
                  "Leise Zone: Boni nur etwa 25%",
                  3
                );
              }
            }
          }
        }

        // NEW: Dance Mode 4-Beat-System (after Dance Battle, before normal rewards)
        if (state.danceMode?.active && beatQuality === "perfect") {
          const atActiveSpot = checkPlayerAtDanceSpot(p, state);
          if (atActiveSpot) {
            // Get current spot ID for tracking
            const currentSpotId =
              state.danceMode.currentActiveSpot?.spotId || null;
            const playerKey = p.padIndex === 0 ? "p1" : "p2";
            const beatCountKey = playerKey + "PerfectBeatCount";
            const spotIdsKey = playerKey + "SpotIds";

            // Increment beat counter
            state.danceMode[beatCountKey]++;

            // Add current spot ID to array (keep only last 4)
            if (!Array.isArray(state.danceMode[spotIdsKey])) {
              state.danceMode[spotIdsKey] = [];
            }
            state.danceMode[spotIdsKey].push(currentSpotId);
            if (state.danceMode[spotIdsKey].length > 4) {
              state.danceMode[spotIdsKey].shift(); // Remove oldest if more than 4
            }

            console.log(
              `[Dance Mode] P${p.padIndex + 1} perfect beat ${
                state.danceMode[beatCountKey]
              }/4 at spot ${currentSpotId}`
            );

            // On 4th perfect beat: award points and reset counter
            if (state.danceMode[beatCountKey] >= 4) {
              // Check if all 4 beats were at the same spot
              const spotIds = state.danceMode[spotIdsKey];
              const allAtSameSpot =
                spotIds.length === 4 &&
                spotIds.every((id) => id === spotIds[0]);
              const pointsToAward = allAtSameSpot ? 2 : 1; // 2 points if all 4 at same spot, 1 otherwise

              console.log(
                `[Dance Mode] P${
                  p.padIndex + 1
                } reached 4 perfect beats! Spots: [${spotIds.join(
                  ", "
                )}] - All at same spot: ${allAtSameSpot} → ${pointsToAward} point(s)`
              );

              incrementDanceModeScore(state, p.padIndex, pointsToAward);

              // Reset counter and spot tracking
              state.danceMode[beatCountKey] = 0;
              state.danceMode[spotIdsKey] = [];

              return; // Exit early - dance mode score takes priority
            }
          } else {
            // Player not at active spot - reset counter if they had progress
            const playerKey = p.padIndex === 0 ? "p1" : "p2";
            const beatCountKey = playerKey + "PerfectBeatCount";
            const spotIdsKey = playerKey + "SpotIds";

            if (state.danceMode[beatCountKey] > 0) {
              console.log(
                `[Dance Mode] P${
                  p.padIndex + 1
                } not at active spot - resetting beat counter (had ${
                  state.danceMode[beatCountKey]
                }/4)`
              );
              state.danceMode[beatCountKey] = 0;
              state.danceMode[spotIdsKey] = [];
            }
          }
        }

        // Miss-Streak zurücksetzen, wenn der Beat getroffen wurde
        p.beatmatchMissCount = 0;

        // NEW: Reduce all cooldowns by beatReduction amount
        if (p.cooldowns && state.cooldownConfig) {
          const reduction = state.cooldownConfig.beatReduction;
          for (const ability in p.cooldowns) {
            if (p.cooldowns[ability] > 0) {
              p.cooldowns[ability] = Math.max(
                0,
                p.cooldowns[ability] - reduction
              );
            }
          }
        }

        spawnRhythmEffect(state, p);
      } else {
        // Miss: gestaffelter Stun (0.5s Basis +0.5s pro Miss, max 2s)
        const baseStun = 0.5;
        const increment = 0.5;
        const maxStun = 2.0;
        const missCount = (p.beatmatchMissCount || 0) + 1;
        p.beatmatchMissCount = missCount;

        const stunDuration = Math.min(
          baseStun + (missCount - 1) * increment,
          maxStun
        );

        p.stunT = stunDuration;
        setAnim(p, "stun", true, state);

        // NEW: Loss of 1 charge segment on miss
        if (UltimeterManager.loseSegment) {
          UltimeterManager.loseSegment(p, state);
        }

        console.log(
          `[Dance Move] P${
            p.padIndex + 1
          } missed beatmatch (not perfect) - ${stunDuration.toFixed(
            2
          )} second stun applied (miss streak: ${missCount})`
        );

        // Optional: Note-Verlust (alte Mechanik, kann beibehalten werden)
        p.musicNotes = Math.max(0, p.musicNotes - 1); // Verliere 1 Note
      }

      // Temporärer Cooldown - einheitlich für alle Dance-Moves
      p.danceCooldown = 0.5; // 500ms für alle Dance-Moves

      //
      // );
    }
  }

  function handleDanceBattleInput(p, inputs, state) {
    // Dance Battle Trigger - DISABLED (Now automatic via DanceSpotManager)
    // Was: inputs.danceBattleDown && ...
    /*
    if (
      inputs.danceBattleDown &&
      !state.danceBattle.active &&
      state.danceBattle.cooldown <= 0 &&
      state.players.length >= 2 && // Needs 2 players
      state.players.filter((p) => !p.eliminated && p.lives > 0).length >= 2 // At least 2 players with lives
    ) {
      startDanceBattle(state);
    }
    */
  }
  // NEW: Increment Dance Mode Score
  function incrementDanceModeScore(state, playerIndex, points = 1) {
    if (!state.danceMode?.active) return;

    // Prevent double-scoring in same frame
    if (state.danceMode.lastScoreFrame === state.lastTime) {
      return;
    }

    state.danceMode.lastScoreFrame = state.lastTime;

    // Increment score (points can be 1 or 2)
    if (playerIndex === 0) {
      state.danceMode.p1Score += points;
      console.log(
        `[Dance Mode] P1 scored ${points} point(s)! Total: ${state.danceMode.p1Score}/10`
      );
    } else {
      state.danceMode.p2Score += points;
      console.log(
        `[Dance Mode] P2 scored ${points} point(s)! Total: ${state.danceMode.p2Score}/10`
      );
    }

    // NEW: Update audio filter based on combined score
    updateDanceModeAudioFilter(state);

    // Spawn cleared animation at active spot position
    if (state.danceMode.currentActiveSpot) {
      const spot = state.danceMode.currentActiveSpot;

      // Spawn dance_spot_cleared animation (one-shot, no loop, no beat sync)
      const halfWidth = spot.size / 2;
      const halfHeight = (spot.height ?? spot.size) / 2;
      const clearedEffect = spawnStageAnimation(
        state,
        "dance_spot_cleared",
        { x: spot.pos.x - halfWidth, y: spot.pos.y - halfHeight },
        {
          scale: 1.0,
          isLooped: false,
          speed: 2.0, // Double speed
          beatSync: false, // No beat sync for one-shot animation
          fpsMultiplier: 1,
        }
      );

      if (clearedEffect) {
        console.log(
          `[Dance Mode] Spawned dance_spot_cleared animation (one-shot, 2x speed)`
        );
      }

      // NEW: Trigger HP dance_aimation animation for the scoring player
      const scoringPlayer = state.players[playerIndex];
      if (scoringPlayer) {
        const celebration = window.DanceCatalog.getCelebrationAnimation(
          window.DanceCatalog.CELEBRATION_TYPES.DANCE_MODE_SCORE,
          scoringPlayer.charName,
          { startedAt: Date.now() }
        );
        if (celebration) {
          celebration.metadata = celebration.metadata || {};
          celebration.metadata.name =
            celebration.metadata.name ||
            `dance_score_${(
              scoringPlayer.charName || "unknown"
            ).toLowerCase()}`;
          window.DanceCatalog.applyAnimation(
            scoringPlayer,
            celebration,
            celebration.metadata.name
          );
          console.log(
            `[Dance Mode] Triggered celebration for player ${playerIndex}`
          );
        }
      }

      // Also spawn the burst effect from atlas_fx3 for extra visual impact
      spawnGlobalEffect(
        state,
        { pos: spot.pos, facing: 1 },
        "dance_spot_burst",
        {
          x: spot.pos.x,
          y: spot.pos.y,
          scale: 1.0,
          speed: 2.0, // 2x speed for dramatic effect
        }
      );
    }

    // Check win condition
    checkDanceModeWinCondition(state);

    // Select next random spot (if game not over)
    if (!state.matchEnd.isActive) {
      // Remove ALL dance_spot_loop animations before selecting new one
      const existingDanceSpots = state.stageAnimations.filter(
        (anim) => anim.anim === "dance_spot_loop"
      );
      if (existingDanceSpots.length > 0) {
        console.log(
          `[Dance Mode] DEBUG: Removing ${existingDanceSpots.length} dance_spot_loop animations after score`
        );
        state.stageAnimations = state.stageAnimations.filter(
          (anim) => anim.anim !== "dance_spot_loop"
        );
      }

      // Clear current active spot reference
      if (state.danceMode.currentActiveSpot) {
        state.danceMode.currentActiveSpot.effect = null;
      }

      selectRandomActiveSpot(state);
    }
  }

  // NEW: Update Dance Mode Audio Filter
  function updateDanceModeAudioFilter(state) {
    if (!state.danceMode?.active || !window.AudioSystem) return;

    // Calculate combined score (both players)
    const totalScore = state.danceMode.p1Score + state.danceMode.p2Score;
    const maxScore = state.danceMode.targetScore * 2; // 20 total possible points

    // Calculate filter frequency: 400Hz → 20000Hz over 20 points
    // Formula: 400 + (totalScore / maxScore) * (20000 - 400)
    const filterProgress = Math.min(totalScore / maxScore, 1.0);
    const targetFrequency = 400 + filterProgress * 19600; // 400Hz to 20000Hz

    // Apply filter with high priority to override battle mode
    if (window.AudioSystem.setMainFilter) {
      window.AudioSystem.setMainFilter(targetFrequency, 0.8, 2); // Priority 2 > Battle mode (0)
      console.log(
        `[Dance Mode] Audio filter: ${Math.round(
          targetFrequency
        )}Hz (${totalScore}/${maxScore} points)`
      );
    }
  }

  // NEW: Check Dance Mode Win Condition
  function checkDanceModeWinCondition(state) {
    if (!state.danceMode?.active) return;

    if (state.danceMode.p1Score >= state.danceMode.targetScore) {
      console.log("[Dance Mode] P1 WINS with 10 perfect beats!");
      startMatchEndSequence(state, 0);
    } else if (state.danceMode.p2Score >= state.danceMode.targetScore) {
      console.log("[Dance Mode] P2 WINS with 10 perfect beats!");
      startMatchEndSequence(state, 1);
    }
  }
  function startDanceBattle(state) {
    const db = state.danceBattle;

    db.active = true;
    db.timeRemaining = 15.0;
    db.startTime = state.lastTime;
    db.p1BeatCount = 0;
    db.p2BeatCount = 0;
    db.winner = null;
    db.musicStartReferenceMs =
      window.AudioSystem && window.AudioSystem.getMusicTime
        ? window.AudioSystem.getMusicTime()
        : null;
    db.prevTimeScale = state.timeScale || 1.0;
    state.timeScale = 0.35;
    db.countdown = {
      active: true,
      frames: [4, 4, 3, 3, 2, 2, 1, 1],
      frameIndex: 0,
      frameInterval: 0.25,
      timer: 0,
    };
    db.countdownValue = db.countdown.frames[0];
    db.inputLocked = true;

    // CSS: Dance Phase Visual Effects (direkt, ohne WebGL)

    // Subtle Technicolor-Effekt mit CSS
    document.body.style.filter =
      "hue-rotate(10deg) saturate(1.5) contrast(1.1) brightness(1.05)";
    document.body.style.transition = "filter 2.5s ease-in-out";

    // Gentle Puls-Effekt
    document.body.style.animation = "dancePhasePulse 0.8s infinite alternate";

    // CSS Animation hinzufügen
    if (!document.getElementById("dancePhaseCSS")) {
      const style = document.createElement("style");
      style.id = "dancePhaseCSS";
      style.textContent = `
        @keyframes dancePhasePulse {
          0% { filter: hue-rotate(10deg) saturate(1.5) contrast(1.1) brightness(1.05); }
          100% { filter: hue-rotate(15deg) saturate(1.7) contrast(1.15) brightness(1.08); }
        }
      `;
      document.head.appendChild(style);
    }

    debugLog(
      "[Dance Battle] STARTED! 15 seconds - First to 6 Points wins! (Perfect: +2, Good: +1)"
    );

    // Spawn dance_spot effects at marked positions in the stage special heatmap
    state.danceBattle.spots = [];
    try {
      const special = state.specialData;
      if (special) {
        const W = special.width;
        const H = special.height;
        // Use camera_bounds dimensions if available (for scaled stages), otherwise use NATIVE dimensions
        const stageW =
          state.cameraBounds?.width ?? GameState.CONSTANTS.NATIVE_WIDTH;
        const stageH =
          state.cameraBounds?.height ?? GameState.CONSTANTS.NATIVE_HEIGHT;

        // target colors (approximate): yellow, orange, magenta, teal
        const targets = [
          { name: "yellow", r: 255, g: 255, b: 0 },
          { name: "orange", r: 255, g: 165, b: 0 },
          { name: "magenta", r: 255, g: 0, b: 255 },
          { name: "teal", r: 0, g: 254, b: 254 }, // #00fefe
        ];

        const tolerance = 50; // Increased tolerance for better detection
        const seen = new Set();
        const spawnedSpots = []; // Track spawned positions to avoid duplicates
        const debugPixels = []; // Debug: track all pixels we check

        // Smaller step size for better detection
        const step = Math.max(4, Math.floor(Math.min(W, H) / 80));
        const minDistance = 80; // Reduced minimum distance

        console.log(
          `[Dance Spots] Scanning heatmap: ${W}x${H}, step: ${step}, tolerance: ${tolerance}`
        );

        for (let y = 0; y < H; y += step) {
          for (let x = 0; x < W; x += step) {
            const px = getPixelColor(x, y, special);
            if (!px || px.a < 128) continue;

            // Debug: log first few pixels
            if (debugPixels.length < 10) {
              debugPixels.push({ x, y, r: px.r, g: px.g, b: px.b });
            }

            for (const t of targets) {
              const dr = Math.abs(px.r - t.r);
              const dg = Math.abs(px.g - t.g);
              const db = Math.abs(px.b - t.b);
              if (dr <= tolerance && dg <= tolerance && db <= tolerance) {
                const worldX = (x / W) * stageW;
                const worldY = (y / H) * stageH;

                // Check minimum distance from existing spots
                let tooClose = false;
                for (const existing of spawnedSpots) {
                  const dx = worldX - existing.x;
                  const dy = worldY - existing.y;
                  const distance = Math.sqrt(dx * dx + dy * dy);
                  if (distance < minDistance) {
                    tooClose = true;
                    break;
                  }
                }

                if (tooClose) continue;

                console.log(
                  `[Dance Spots] Found ${
                    t.name
                  } at (${x},${y}) -> world(${worldX.toFixed(
                    0
                  )},${worldY.toFixed(0)})`
                );

                const eff = spawnGlobalEffect(
                  state,
                  { pos: { x: worldX, y: worldY }, facing: 1 },
                  "dance_spot",
                  {
                    x: worldX,
                    y: worldY - 128, // Position: heatmap pixel top = sprite bottom (256px sprite, so -128px offset)
                    scale: 1.0,
                    speed: 1.0, // Normal 12 FPS speed
                    duration: 999999,
                    isLooped: true,
                    isStageEffect: true,
                    tag: `dance_spot_${t.name}`,
                  }
                );
                if (eff) {
                  state.danceBattle.spots.push(eff);
                  spawnedSpots.push({ x: worldX, y: worldY, color: t.name });
                }
                break; // Only spawn one spot per pixel
              }
            }
          }
        }

        console.log(`[Dance Spots] Debug pixels:`, debugPixels);
        console.log(
          `[Dance Spots] Spawned ${spawnedSpots.length} dance spots:`,
          spawnedSpots.map(
            (s) => `${s.color}@(${s.x.toFixed(0)},${s.y.toFixed(0)})`
          )
        );
      }
    } catch (e) {
      console.warn("Failed to spawn dance_spot effects:", e);
    }
  }
  function endDanceBattle(state) {
    state.danceBattle.active = false;
    state.danceBattle.cooldown = 5.0; // 5 Sekunden bis nächste Phase möglich
    state.timeScale = state.danceBattle.prevTimeScale ?? 1.0;
    state.danceBattle.prevTimeScale = 1.0;
    state.danceBattle.countdown = null;
    state.danceBattle.inputLocked = false;
    state.danceBattle.countdownValue = 0;

    // Audio: Fade zurück zu Background
    if (AudioSystem.endDancePhase) {
      AudioSystem.endDancePhase(1.5, { filterFreq: 400 });
    }

    // CSS: Dance Phase Visual Effects deaktivieren

    // CSS-Effekte entfernen
    document.body.style.filter = "none";
    document.body.style.animation = "none";
    document.body.style.transition = "filter 1.5s ease-in-out";

    // CSS Animation entfernen
    const dancePhaseCSS = document.getElementById("dancePhaseCSS");
    if (dancePhaseCSS) {
      dancePhaseCSS.remove();
    }

    // NEW: Reset dance battle audio effects
    if (window.AudioSystem && window.AudioSystem.resetDanceBattleEffects) {
      window.AudioSystem.resetDanceBattleEffects();
    }

    // NEW: Reset perfect beat effects
    if (window.AudioSystem && window.AudioSystem.resetPerfectBeatEffects) {
      window.AudioSystem.resetPerfectBeatEffects();
    }

    // Fade out any dance_spot stage effects smoothly
    try {
      const spots = state.danceBattle?.spots || [];
      const fadeOut = 0.6; // seconds
      for (const eff of spots) {
        if (!eff) continue;
        // stop looping and schedule a fade-out
        eff.isLooped = false;
        eff.fadeOut = true;
        eff.duration = fadeOut;
        eff.time = 0;
        // Force it to use duration-based cleanup (not animation-based)
        eff.useDurationCleanup = true;
      }
      // clear references (effects will be removed by updateEffects when done)
      state.danceBattle.spots = [];
    } catch (e) {
      console.warn("Failed to fade out dance spots:", e);
    }
  }

  function handleDanceBattle(dt, state) {
    const db = state.danceBattle;

    if (db.cooldown > 0) {
      db.cooldown = Math.max(0, db.cooldown - dt);
      return;
    }

    if (!db.active) {
      return;
    }

    let countdownActive = db.countdown?.active;
    if (countdownActive) {
      const countdown = db.countdown;
      const interval = countdown.frameInterval || 0.25;
      countdown.timer += dt;

      while (
        countdownActive &&
        countdown.timer >= interval &&
        countdown.frameIndex <= countdown.frames.length
      ) {
        countdown.timer -= interval;
        countdown.frameIndex += 1;

        if (countdown.frameIndex < countdown.frames.length) {
          db.countdownValue = countdown.frames[countdown.frameIndex];
        }

        if (countdown.frameIndex >= countdown.frames.length) {
          countdownActive = false;
          db.countdown = null;
          db.inputLocked = false;
          state.timeScale = db.prevTimeScale ?? 1.0;
          db.prevTimeScale = 1.0;
          db.countdownValue = 0;
        }
      }

      if (countdownActive) {
        return;
      }
    }

    // Update dance battle timer
    db.timeRemaining -= dt;

    // NEW: Update dance battle audio effects based on intensity
    if (window.AudioSystem && window.AudioSystem.updateDanceBattleEffects) {
      const totalBeats = db.p1BeatCount + db.p2BeatCount;
      const maxBeats = 12; // 6 beats per player
      const intensity = Math.min(totalBeats / maxBeats, 1.0);

      // Calculate beat progress (0-1 within current beat cycle)
      const beatInterval = 60000 / (state.currentBPM || 117);
      const musicTime = getCurrentMusicTime(state);
      const beatProgress =
        beatInterval > 0 ? ((musicTime || 0) % beatInterval) / beatInterval : 0;

      window.AudioSystem.updateDanceBattleEffects(intensity, beatProgress);
    }

    // Zeit abgelaufen: Wer mehr Perfect Beats hat gewinnt
    if (db.timeRemaining <= 0) {
      if (db.p1BeatCount > db.p2BeatCount) {
        db.winner = 0;
        applyDanceBattleKnockback(state.players[0], state.players[1], state);
      } else if (db.p2BeatCount > db.p1BeatCount) {
        db.winner = 1;
        applyDanceBattleKnockback(state.players[1], state.players[0], state);
      }
      // Unentschieden: Kein Knockback
      endDanceBattle(state);
    }
  }

  function getCurrentMusicTime(state) {
    if (window.AudioSystem && window.AudioSystem.getMusicTime) {
      return window.AudioSystem.getMusicTime();
    }
    if (typeof state.lastTime === "number") {
      return state.lastTime;
    }
    return typeof performance !== "undefined" ? performance.now() : 0;
  }

  function getCurrentMusicTime(state) {
    if (window.AudioSystem && window.AudioSystem.getMusicTime) {
      return window.AudioSystem.getMusicTime();
    }
    if (typeof state.lastTime === "number") {
      return state.lastTime;
    }
    return typeof performance !== "undefined" ? performance.now() : 0;
  }
  function applyDanceBeatAnimations(p, state, beatQuality, options = {}) {
    const skipBattleRewards = !!options.skipBattleRewards;

    // EDGE CASE FIX: Prevent dance animations during grab attacks to avoid animation loops
    // This fixes the issue where stealing beat charges during grab triggers dance animations
    // that conflict with the grab animation, causing game-breaking loops
    if (p.attack && p.attack.type === "grab") {
      console.log(
        `[Dance] BLOCKED: P${
          p.padIndex + 1
        } cannot trigger dance animation during grab attack`
      );
      return;
    }
    if (p.isGrabbed) {
      console.log(
        `[Dance] BLOCKED: P${
          p.padIndex + 1
        } cannot trigger dance animation while grabbed`
      );
      return;
    }

    // Grace period is updated in updatePlayer with actual dt

    if (beatQuality === "perfect") {
      // Reset grace period on perfect beat
      p._danceSegmentJustCompleted = false;
      p._danceSegmentGracePeriod = undefined;
      p.consecutivePerfects++;

      const oldBarProgress = p.beatBarProgress || 0;
      const oldLevel = p.danceVariationLevel || 1;
      const oldStreak = p.perfectBarStreak || 0;

      const nextBarProgress = oldBarProgress + 1;
      const frameSegmentStart = (nextBarProgress - 1) * 4;
      const frameSegmentEnd = Math.min(frameSegmentStart + 4, 16);

      if (oldBarProgress === 0) {
        const level = Math.max(1, Math.min(3, oldLevel));
        const comboForLevel = level === 1 ? 0 : level === 2 ? 3 : 10;
        const config = window.DanceCatalog.getCharacterPerfectBeatmatchDance(
          p.charName,
          comboForLevel
        );

        if (!config || !config.frames || config.frames.length < 16) {
          console.error(
            `[Dance] ❌ Invalid config for ${p.charName}, level ${level}`
          );
          return;
        }

        const name = `dance_perfect_level_${level}`;

        console.log(
          `[Dance] 🎯 P${
            p.padIndex
          } PERFECT Beat 1 - Playing frames ${frameSegmentStart}-${
            frameSegmentEnd - 1
          } of 16:`,
          {
            character: p.charName,
            level: level,
            animName: name,
            segmentFrames: config.frames
              .slice(frameSegmentStart, frameSegmentEnd)
              .map((f) => (typeof f === "object" ? f.frame : f)),
          }
        );

        window.DanceCatalog.applyAnimation(p, config, name);
        p.frameIndex = frameSegmentStart;
        p.frameTime = 0;
        p._danceSegmentStart = frameSegmentStart;
        p._danceSegmentEnd = frameSegmentEnd;
      } else {
        if (
          !p.anim ||
          !p.anim.includes("dance") ||
          !p.frames ||
          p.frames.length < 16
        ) {
          const level = Math.max(1, Math.min(3, oldLevel));
          const comboForLevel = level === 1 ? 0 : level === 2 ? 3 : 10;
          const configNext =
            window.DanceCatalog.getCharacterPerfectBeatmatchDance(
              p.charName,
              comboForLevel
            );
          const nameNext = `dance_perfect_level_${level}`;
          window.DanceCatalog.applyAnimation(p, configNext, nameNext);
        }

        console.log(
          `[Dance] 🎯 P${
            p.padIndex
          } PERFECT Beat ${nextBarProgress} - Jumping to frames ${frameSegmentStart}-${
            frameSegmentEnd - 1
          }:`,
          {
            currentFrameIndex: p.frameIndex,
            jumpTo: frameSegmentStart,
            segmentFrames: p.frames
              ? p.frames
                  .slice(frameSegmentStart, frameSegmentEnd)
                  .map((f) => (typeof f === "object" ? f.frame : f))
              : [],
          }
        );

        if (p.frames && p.frames.length > frameSegmentStart) {
          p.frameIndex = frameSegmentStart;
          p.frameTime = 0;
          p._danceSegmentStart = frameSegmentStart;
          p._danceSegmentEnd = frameSegmentEnd;
        }
      }

      p.beatBarProgress = nextBarProgress;
      if (p.beatBarProgress >= 4) {
        const newStreak = oldStreak + 1;
        p.beatBarProgress = 0;
        p.perfectBarStreak = newStreak;
        console.log(
          `[Dance] ✅ P${p.padIndex} PERFECT BAR COMPLETE! (all 16 frames played) Streak: ${newStreak}/2`
        );

        p._danceSegmentStart = undefined;
        p._danceSegmentEnd = undefined;
        console.log(
          `[Dance] 🎊 P${p.padIndex} Completed full 16-frame dance - animation will finish and return to normal`
        );

        if (newStreak >= 2) {
          const newLevel = Math.min(3, oldLevel + 1);
          p.perfectBarStreak = 0;
          p.danceVariationLevel = newLevel;
          console.log(
            `[Dance] 🚀 P${p.padIndex} LEVEL UP! New dance variation level: ${newLevel}`
          );
        }
      }
    } else {
      // Don't trigger MISS if we're in grace period after segment completion
      if (p._danceSegmentJustCompleted && p._danceSegmentGracePeriod > 0) {
        return; // Skip MISS during grace period
      }

      console.log(
        `[Dance] ❌ P${p.padIndex} MISS (${beatQuality}) - Resetting bar progress:`,
        {
          oldBarProgress: p.beatBarProgress || 0,
          oldLevel: p.danceVariationLevel || 1,
          oldStreak: p.perfectBarStreak || 0,
          currentAnim: p.anim,
          currentFrameIndex: p.frameIndex,
          wasAtSegmentEnd:
            p._danceSegmentEnd !== undefined &&
            p.frameIndex >= (p._danceSegmentEnd - 1 || 0),
          inGracePeriod:
            p._danceSegmentJustCompleted && p._danceSegmentGracePeriod > 0,
        }
      );

      p.consecutivePerfects = 0;
      p.beatBarProgress = 0;
      p.perfectBarStreak = 0;
      p.danceVariationLevel = 1;
      p._danceSegmentStart = undefined;
      p._danceSegmentEnd = undefined;

      if (p.anim && p.anim.includes("dance")) {
        console.log(
          `[Dance] 🛑 P${p.padIndex} Stopping dance animation ${p.anim} due to miss`
        );
        p.animFinished = true;
      }

      const animName = Math.abs(p.vel.x) > 30 ? "run" : "idle";
      setAnim(p, animName, true, state);
      console.log(
        `[Dance] 🔄 P${p.padIndex} MISS detected - immediately returning to ${animName}, all progress reset. Next perfect will start at Frame 0.`
      );

      if (
        window.ParticleManager &&
        window.ParticleManager.emitComboFailEffect
      ) {
        window.ParticleManager.emitComboFailEffect(p, state);
        console.log(`[Dance] 💥 P${p.padIndex} Emitting fail particles`);
      }

      if (window.AudioSystem && window.AudioSystem.resetPerfectBeatEffects) {
        window.AudioSystem.resetPerfectBeatEffects();
      }
    }

    if (p.frames && p.frames.length > 0) {
      console.log(`[Physics] Player ${p.padIndex} frames:`, {
        firstFrame: p.frames[0],
        lastFrame: p.frames[p.frames.length - 1],
        totalFrames: p.frames.length,
      });
    } else {
      console.error(
        `[Physics] ❌ Player ${p.padIndex} has no frames after DanceCatalog.applyAnimation!`
      );
    }
  }

  function updateDanceBeatFeedback(state, p, beatQuality) {
    const playerKey = p.padIndex === 0 ? "p1" : "p2";
    if (beatQuality === "perfect") {
      state.beatFeedback[playerKey] = {
        text: "PERFECT",
        color: "#00ff00",
        time: 0,
        duration: 0.5,
      };
    } else {
      state.beatFeedback[playerKey] = {
        text: "OFF",
        color: "#ff0000",
        time: 0,
        duration: 0.5,
      };
    }
  }

  function applyDancePerfectRewards(p, state, options = {}) {
    const skipBattleRewards = !!options.skipBattleRewards;

    UltimeterManager.gainUltimeter(p, "perfect_beat", state);
    p.musicNotes = Math.min(3, p.musicNotes + 1);

    if (window.WebGLRenderer && window.WebGLRenderer.triggerElectricEffect) {
      const playerHb = Renderer.getHurtbox(p);
      const screenX = playerHb.left + playerHb.w / 2;
      const screenY = playerHb.top + playerHb.h / 2;
      const intensity = Math.min(1.0, 0.3 + p.musicNotes * 0.25);
      const branches = Math.max(3, p.musicNotes * 2);

      window.WebGLRenderer.triggerElectricEffect(
        screenX,
        screenY,
        intensity,
        branches
      );
      debugLog(
        `? Perfect Beat! Electric effect: intensity=${intensity.toFixed(
          2
        )}, branches=${branches}, notes=${p.musicNotes}`
      );
    }

    if (state.danceBattle.active) {
      triggerScreenFlash(state, 0.3);
      if (window.AudioSystem && window.AudioSystem.triggerPerfectBeatEffect) {
        window.AudioSystem.triggerPerfectBeatEffect(p.padIndex);
      }

      if (!skipBattleRewards) {
        if (p.padIndex === 0) {
          state.danceBattle.p1BeatCount += 2;
          if (state.danceBattle.p1BeatCount >= 6) {
            state.danceBattle.winner = 0;
            scheduleDanceBattleKnockback(
              state.players[0],
              state.players[1],
              state
            );
            return;
          }
        } else if (p.padIndex === 1) {
          state.danceBattle.p2BeatCount += 2;
          if (state.danceBattle.p2BeatCount >= 6) {
            state.danceBattle.winner = 1;
            scheduleDanceBattleKnockback(
              state.players[1],
              state.players[0],
              state
            );
            return;
          }
        }
      }
    }

    // NOTE: Dance Mode scoring is now handled in handleDanceMove with 4-beat system
    // This legacy code is kept for compatibility but should not be reached
    if (state.danceMode?.active) {
      const atActiveSpot = checkPlayerAtDanceSpot(p, state);
      if (atActiveSpot) {
        // This should not be reached - dance mode scoring is handled in handleDanceMove
        console.warn(
          "[Dance Mode] Legacy incrementDanceModeScore call detected"
        );
        incrementDanceModeScore(state, p.padIndex, 1);
        return;
      }
    }

    if (p.cooldowns && state.cooldownConfig) {
      const reduction = state.cooldownConfig.beatReduction;
      for (const ability in p.cooldowns) {
        if (p.cooldowns[ability] > 0) {
          p.cooldowns[ability] = Math.max(0, p.cooldowns[ability] - reduction);
        }
      }
    }

    spawnRhythmEffect(state, p);
  }

  // NEW: Schedule delayed dance battle knockback with dance move
  function scheduleDanceBattleKnockback(winner, loser, state) {
    // Guard: Ensure both winner and loser exist
    if (!winner || !loser) {
      console.warn(
        "[Dance Battle] Cannot schedule knockback: winner or loser is undefined"
      );
      if (state.danceBattle) {
        endDanceBattle(state);
      }
      return;
    }

    // 1. Winner starts dance move immediately
    const celebration = window.DanceCatalog.getCelebrationAnimation(
      window.DanceCatalog.CELEBRATION_TYPES.DANCE_BATTLE_VICTORY,
      winner.charName,
      { startedAt: Date.now() }
    );
    if (celebration) {
      celebration.metadata = celebration.metadata || {};
      celebration.metadata.name =
        celebration.metadata.name ||
        `dance_victory_${(winner.charName || "unknown").toLowerCase()}`;
      window.DanceCatalog.applyAnimation(
        winner,
        celebration,
        celebration.metadata.name
      );
    }

    // 2. Loser gets stunned immediately
    loser.stunned = true;
    loser.stunTime = 1.0; // 1 second stun

    // 3. After 1 second delay, apply knockback
    setTimeout(() => {
      if (state.danceBattle.active && state.danceBattle.winner !== null) {
        applyDanceBattleKnockback(winner, loser, state);
        endDanceBattle(state);
      }
    }, 1000);
  }
  function applyDanceBattleKnockback(winner, loser, state) {
    // Guard: Ensure both winner and loser exist
    if (!winner || !loser) {
      console.warn(
        "[Dance Battle] Cannot apply knockback: winner or loser is undefined"
      );
      return;
    }

    const DANCE_BATTLE_DAMAGE = 30; // 30%
    const DANCE_BATTLE_KNOCKBACK = 800; // Stark reduziert (war 2000)

    // NEW: Berechne Punktedifferenz und Knockback-Verstärkung
    const winnerBeatCount =
      winner.padIndex === 0
        ? state.danceBattle.p1BeatCount
        : state.danceBattle.p2BeatCount;
    const loserBeatCount =
      loser.padIndex === 0
        ? state.danceBattle.p1BeatCount
        : state.danceBattle.p2BeatCount;
    const pointDifference = winnerBeatCount - loserBeatCount;

    // 10% Verstärkung pro Punkt Differenz
    const knockbackMultiplier = 1.0 + pointDifference * 0.1;
    debugLog(
      `[Dance Battle] Knockback Multiplier: ${knockbackMultiplier.toFixed(
        2
      )}x (Winner: ${winnerBeatCount}, Loser: ${loserBeatCount}, Diff: ${pointDifference})`
    );

    // NEW: Trigger dramatic knockback audio effect
    if (window.AudioSystem && window.AudioSystem.triggerDanceKnockbackEffect) {
      const intensity = Math.min(winnerBeatCount / 6, 1.0);
      window.AudioSystem.triggerDanceKnockbackEffect(intensity);
    }

    // Damage anwenden
    loser.percent = Math.min(999, (loser.percent || 0) + DANCE_BATTLE_DAMAGE);

    // Trigger subtle screen flash for dance battle damage
    triggerScreenFlash(state, 0.4);

    // Spawn blood splatter effect
    if (ParticleManager && ParticleManager.emitBloodSplatter) {
      ParticleManager.emitBloodSplatter(
        loser.pos.x,
        loser.pos.y,
        DANCE_BATTLE_DAMAGE,
        state
      );
    }

    // Richtung: 45° basierend auf Position relativ zum Gewinner
    const direction = loser.pos.x > winner.pos.x ? 1 : -1; // Rechts oder links
    const angle = 45 * (Math.PI / 180);

    const P = loser.percent || 0;
    const K =
      DANCE_BATTLE_KNOCKBACK * Math.pow(1 + P / 100, 0.8) * knockbackMultiplier;

    loser.vel.x = Math.cos(angle) * K * direction;
    loser.vel.y = -Math.sin(angle) * K;
    loser.grounded = false;
    loser.stunT = 1.0;

    // Massive Visual Effects
    spawnGlobalEffect(state, loser, "fx_hurt_knockback");
    spawnGlobalEffect(state, loser, "fx_knockback", {
      rotation: Math.atan2(loser.vel.y, loser.vel.x),
      speed: 6.0,
      target: loser,
    });

    // NEW: Dance Battle Impact Effect (über dem Character)
    spawnGlobalEffect(state, loser, "fx_dance_battle_impact", {
      offsetY: -80, // über dem Character
      scale: 1.2, // Etwas größer für mehr Impact
      speed: 2.25, // 3x faster for dramatic effect
    });

    setAnim(loser, "hurt", false, state);
    // Enable airborne animation for this player after being hit
    loser.airborneFromHit = true;
  }
  function handleMovement(dt, p, inputs, state) {
    // Delegate to MovementSystem
    MovementSystem.handleMovement(dt, p, inputs, state);

    // Handle wall interaction (wallslide + walljump) - keep this in physics.js for now
    const pconf = p.config.physics;
    if (p.stunT && p.stunT > 0) p.stunT = Math.max(0, p.stunT - dt);
    const controlsLocked =
      (p.stunT || 0) > 0 ||
      p.attack?.type === "grab" ||
      (p.attack?.type === "l2" && p.attack.phase === "release") || // Lock on *any* L2 release
      (p.attack?.type === "r2" && p.attack.phase === "release") || // Lock during R2 release dash
      p.attack?.type === "r2_combo" ||
      p.attack?.type === "r2_hit_followup" ||
      p.attack?.type === "r1_circle_attack" ||
      ((p.charName.toLowerCase() === "hp" ||
        p.charName.toLowerCase() === "ernst") &&
        p.ultiPhase === "start"); // Lock movement during HP/ernst bike mount

    if (p.decelerate) {
      p.vel.x *= 0.85; // Slow down to a halt
      if (Math.abs(p.vel.x) < 10) {
        p.vel.x = 0;
        p.decelerate = false; // Stop decelerating
      }
    } else if (!p.roll?.active) {
      // Progressive movement slowdown during charge attacks
      if (
        (p.attack?.type === "l2" &&
          p.attack.phase === "charge" &&
          p.charName === "fritz") ||
        (p.attack?.type === "r1" &&
          p.attack.phase === "loop" &&
          (p.charName === "HP" || p.charName.toLowerCase() === "ernst")) ||
        (p.attack?.type === "r2" &&
          p.attack.phase === "loop" &&
          p.charName === "fritz")
      ) {
        const pconf = p.config.physics;

        // Get charge time (HP R1 uses loopTime, others use chargeT)
        let chargeT, maxCharge;
        if (
          p.attack.type === "r1" &&
          (p.charName === "HP" || p.charName.toLowerCase() === "ernst")
        ) {
          chargeT = p.attack.loopTime || 0; // HP/ernst R1 uses loopTime
          maxCharge = 2.0; // Max loop time for slowdown calc
        } else if (p.attack.type === "l2" && p.charName === "fritz") {
          chargeT = p.attack.chargeT || 0;
          maxCharge = 2.5; // Fritz L2 max charge
        } else if (p.attack.type === "r2" && p.charName === "fritz") {
          chargeT = p.attack.chargeT || 0;
          maxCharge = 2.0; // Fritz R2 max charge
        }

        // Progressive slowdown: 100% ? 20% over charge duration
        const chargeProgress = Math.min(chargeT / maxCharge, 1.0); // 0 to 1
        const speedMultiplier = 1.0 - chargeProgress * 0.8; // 1.0 ? 0.2

        // PREVENTIVE WALL COLLISION: Check if movement would cause wall collision
        const proposedVelX = inputs.axis * pconf.moveSpeed * speedMultiplier;
        if (proposedVelX !== 0 && state.groundData) {
          const hb = Renderer.getHurtbox(p);
          const checkX = proposedVelX > 0 ? hb.left + hb.w : hb.left;
          const checkYTop = hb.top + 4;
          const checkYMid = hb.top + hb.h / 2;
          const checkYBottom = hb.top + hb.h - 4;

          // Check if movement would cause wall collision
          const wouldCollide =
            isPixelSolid(checkX, checkYTop, state.groundData) ||
            isPixelSolid(checkX, checkYMid, state.groundData) ||
            isPixelSolid(checkX, checkYBottom, state.groundData);

          if (wouldCollide) {
            p.vel.x = 0; // Prevent movement into wall
          } else {
            p.vel.x = proposedVelX; // Allow movement
          }
        } else {
          p.vel.x = proposedVelX;
        }
      } else {
        // Prüfe ob Spieler beweglich ist (nicht während Respawn)
        const canMove = p.isMovable !== false; // Default true, false nur während Respawn
        const target =
          controlsLocked || !canMove ? p.vel.x : inputs.axis * pconf.moveSpeed;
        const accel = p.grounded ? pconf.accel : pconf.accel * pconf.airControl;
        const deltaV = target - p.vel.x;
        const maxStep = accel * dt;
        const newVelX =
          Math.abs(deltaV) <= maxStep
            ? target
            : p.vel.x + Math.sign(deltaV) * maxStep;

        // PREVENTIVE WALL COLLISION: Check if movement would cause wall collision
        if (newVelX !== 0 && state.groundData) {
          const hb = Renderer.getHurtbox(p);
          const checkX = newVelX > 0 ? hb.left + hb.w : hb.left;
          const checkYTop = hb.top + 4;
          const checkYMid = hb.top + hb.h / 2;
          const checkYBottom = hb.top + hb.h - 4;

          // Check if movement would cause wall collision
          const wouldCollide =
            isPixelSolid(checkX, checkYTop, state.groundData) ||
            isPixelSolid(checkX, checkYMid, state.groundData) ||
            isPixelSolid(checkX, checkYBottom, state.groundData);

          if (wouldCollide) {
            p.vel.x = 0; // Prevent movement into wall
          } else {
            p.vel.x = newVelX; // Allow movement
          }
        } else {
          p.vel.x = newVelX;
        }
      }
    }

    if (inputs.axis !== 0 && !controlsLocked && p.isMovable !== false)
      p.facing = inputs.axis > 0 ? 1 : -1;

    // WALL INTERACTION (wallslide + walljump)
    // Ctrl Hold = Wallslide, Ctrl Release = Walljump
    // Fallback to roll inputs if wallInteract not available (for gamepad compatibility)
    const wallInteractPressed =
      inputs.wallInteractDown ||
      inputs.wallInteractHeld ||
      inputs.rollDown ||
      inputs.rollHeld;
    const wallInteractHeld = inputs.wallInteractHeld || inputs.rollHeld;
    const wallInteractReleased = inputs.wallInteractUp || inputs.rollUp;
    // Wallslide can interrupt roll if wall contact is present
    // Check for wall contact first to determine if wallslide should take priority
    let hasWallContact = false;
    // Check wall contact even when grounded so wall interaction can be
    // initiated from the ground edge (prevents false 'groundedNoCling' gating).
    if (state.walljumpData) {
      const hb = Renderer.getHurtbox(p);
      const checkPoints = [
        { x: hb.left - 2, y: hb.top + hb.h / 2 },
        { x: hb.left + hb.w + 2, y: hb.top + hb.h / 2 },
      ];
      for (const pt of checkPoints) {
        if (isWalljumpPixelScaled(pt.x, pt.y, state.walljumpData, state)) {
          hasWallContact = true;
          break;
        }
      }
    }

    const canWallInteract =
      !controlsLocked &&
      (!p.roll?.active || (hasWallContact && wallInteractHeld)) && // Allow wallslide to interrupt roll if wall contact
      p.isMovable !== false &&
      state.walljumpData &&
      (wallInteractPressed || p.wallcling) &&
      (!p.grounded || p.wallcling);

    const attemptedWallInteract =
      wallInteractPressed || wallInteractHeld || p.wallcling;

    if (attemptedWallInteract && !canWallInteract) {
      const blockers = [];
      if (controlsLocked) blockers.push("controlsLocked");
      if (p.roll?.active) blockers.push("rollActive");
      if (p.isMovable === false) blockers.push("isMovable=false");
      if (!state.walljumpData) blockers.push("missingWalljumpHeatmap");
      if (!(wallInteractPressed || p.wallcling))
        blockers.push("noInteractInput");
      if (!(!p.grounded || p.wallcling)) blockers.push("groundedNoCling");
      console.log(
        `🚫 Wallslide gated for ${p.charName}: reasons=${blockers.join(
          ","
        )}, grounded=${p.grounded}, vel=(${p.vel.x.toFixed(
          1
        )},${p.vel.y.toFixed(1)}), axis=${inputs.axis.toFixed(2)}`
      );
    }

    if (canWallInteract) {
      const hb = Renderer.getHurtbox(p);

      // Use camera bounds for scaling if available (scaled stages), otherwise use native/groundData
      const stageW =
        state.cameraBounds?.width ??
        (state.groundData?.width || GameState.CONSTANTS.NATIVE_WIDTH);
      const stageH =
        state.cameraBounds?.height ??
        (state.groundData?.height || GameState.CONSTANTS.NATIVE_HEIGHT);

      // Check points in world coordinates (will be scaled by isWalljumpPixel)
      const checkPoints = [
        { x: hb.left - 2, y: hb.top + 4 },
        { x: hb.left - 2, y: hb.top + hb.h / 2 },
        { x: hb.left - 2, y: hb.top + hb.h - 4 },
        { x: hb.left + hb.w + 2, y: hb.top + 4 },
        { x: hb.left + hb.w + 2, y: hb.top + hb.h / 2 },
        { x: hb.left + hb.w + 2, y: hb.top + hb.h - 4 },
      ];

      // Only check bounce_wall.png for wallslideable walls - NOT ground.png
      // This ensures only explicitly marked walls in bounce_wall.png are wallslideable
      let leftWall = false;
      let rightWall = false;

      // Check LEFT wall - with Front/Back-Face detection
      for (let i = 0; i < 3; i++) {
        const pt = checkPoints[i];
        // Use scaled version which handles coordinate scaling internally
        if (isWalljumpPixelScaled(pt.x, pt.y, state.walljumpData, state)) {
          // FRONT/BACK-FACE CHECK: Is there a DARK_GRAY WALL behind this green wallslide pixel?
          // If yes = Back-Face (don't allow wallslide from this side, wall blocks access)
          // If no = Front-Face (allow wallslide from this side)
          // pt.x/pt.y are already in world coordinates

          // Check 8 pixels TO THE LEFT of the wall_bounce pixel for a DARK_GRAY wall
          // CRITICAL: Only check for DARK_GRAY walls, NOT black ground
          // Black ground should NOT block wallslide (it's passable floor)
          const checkBackFaceX = pt.x - 8; // 8 pixels to the left of wallslide surface

          const isBackFace = isWallPixelScaled(
            checkBackFaceX,
            pt.y,
            state.groundData,
            state
          );

          if (!isBackFace) {
            // Front-Face detected - allow wallslide from this side (no DARK_GRAY wall blocking)
            leftWall = true;
            break;
          }
          // Back-Face: DARK_GRAY wall behind = don't allow wallslide from this direction
        }
      }

      // Check RIGHT wall - with Front/Back-Face detection
      for (let i = 3; i < 6; i++) {
        const pt = checkPoints[i];
        // Use scaled version which handles coordinate scaling internally
        if (isWalljumpPixelScaled(pt.x, pt.y, state.walljumpData, state)) {
          // FRONT/BACK-FACE CHECK: Is there a DARK_GRAY WALL behind this green wallslide pixel?
          // If yes = Back-Face (don't allow wallslide from this side, wall blocks access)
          // If no = Front-Face (allow wallslide from this side)
          // pt.x/pt.y are already in world coordinates

          // Check 8 pixels TO THE RIGHT of the wall_bounce pixel for a DARK_GRAY wall
          // CRITICAL: Only check for DARK_GRAY walls, NOT black ground
          // Black ground should NOT block wallslide (it's passable floor)
          const checkBackFaceX = pt.x + 8; // 8 pixels to the right of wallslide surface

          const isBackFace = isWallPixelScaled(
            checkBackFaceX,
            pt.y,
            state.groundData,
            state
          );

          if (!isBackFace) {
            // Front-Face detected - allow wallslide from this side (no DARK_GRAY wall blocking)
            rightWall = true;
            break;
          }
          // Back-Face: DARK_GRAY wall behind = don't allow wallslide from this direction
        }
      }

      const touchingWall = leftWall || rightWall;

      if (!touchingWall) {
        if (
          attemptedWallInteract &&
          state?.debug?.devMode &&
          state?.debug?.wallslide
        ) {
          const sampleLeft = getPixelColorScaled(
            hb.left - 2,
            hb.top + hb.h / 2,
            state.walljumpData,
            state
          );
          const sampleRight = getPixelColorScaled(
            hb.left + hb.w + 2,
            hb.top + hb.h / 2,
            state.walljumpData,
            state
          );
          const cam = state.cameraBounds;
          console.log(
            `🧱 No wallslide surface for ${
              p.charName
            }: leftWall=${leftWall}, rightWall=${rightWall}, pos=(${hb.left.toFixed(
              1
            )},${hb.top.toFixed(1)}), axis=${inputs.axis.toFixed(
              2
            )}, vel=(${p.vel.x.toFixed(1)},${p.vel.y.toFixed(1)}), sampleLeft=${
              sampleLeft?.r ?? "∅"
            },${sampleLeft?.g ?? "∅"},${sampleLeft?.b ?? "∅"}, sampleRight=${
              sampleRight?.r ?? "∅"
            },${sampleRight?.g ?? "∅"},${sampleRight?.b ?? "∅"}, cameraBounds=${
              cam ? `${cam.x},${cam.y},${cam.width},${cam.height}` : "∅"
            }`
          );
        }
        p.wallcling = undefined;
      } else {
        // Determine wall side: prefer the wall the player is facing or moving towards
        let wallSide;
        if (leftWall && rightWall) {
          // Both walls detected (corner) - use player's facing direction or velocity
          if (p.vel.x < 0) {
            wallSide = -1; // Moving/facing left, use left wall
          } else if (p.vel.x > 0) {
            wallSide = 1; // Moving/facing right, use right wall
          } else {
            wallSide = p.facing; // Not moving, use facing direction
          }
          if (state?.debug?.devMode && state?.debug?.wallslide) {
            console.log(
              `⚠️ Corner detected! Using wallSide=${wallSide} based on vel.x=${p.vel.x}, facing=${p.facing}`
            );
          }
        } else {
          wallSide = leftWall ? -1 : 1; // -1 = wall on left, +1 = wall on right
        }

        if (state?.debug?.devMode && state?.debug?.wallslide) {
          console.log(
            `🔍 Wall detection: leftWall=${leftWall}, rightWall=${rightWall}, chosen wallSide=${wallSide}`
          );
        }

        const triggerWalljump = (launchFromSide) => {
          if (p.walljumpBoost?.active) {
            p.walljumpBoost.active = false;
          }
          if (!p.walljumpBoost) {
            p.walljumpBoost = {
              active: false,
              elapsed: 0,
              duration: 0.35,
              direction: 0,
              startHorizontal: 0,
              endHorizontal: 0,
              startVertical: 0,
              endVertical: 0,
            };
          }
          const gravity = Math.max(
            pconf?.gravity ?? state.physics?.gravity ?? 2400,
            1
          );
          const baseMove = pconf?.moveSpeed ?? 520;
          const baseJump = pconf?.jumpSpeed ?? 880;
          const targetDistance = 256;
          const desiredHorizontal = Math.max(baseMove, 480);

          let horizontalSpeed = desiredHorizontal;
          let timeToTarget = targetDistance / Math.max(horizontalSpeed, 1);
          let verticalSpeed = (gravity * timeToTarget) / 2;

          const maxVertical = baseJump * 0.95;
          const minVertical = baseJump * 0.55;

          if (verticalSpeed > maxVertical) {
            verticalSpeed = maxVertical;
            timeToTarget = (2 * verticalSpeed) / gravity;
            horizontalSpeed = targetDistance / Math.max(timeToTarget, 0.08);
          } else if (verticalSpeed < minVertical) {
            verticalSpeed = minVertical;
            timeToTarget = (2 * verticalSpeed) / gravity;
            horizontalSpeed = targetDistance / Math.max(timeToTarget, 0.08);
          }

          const launchDir = launchFromSide < 0 ? 1 : -1; // Jump away from wall

          const boostedHorizontal = Math.min(
            horizontalSpeed * 1.9,
            baseMove * 2.6
          );
          const boostedVertical = Math.min(
            Math.max(verticalSpeed * 1.28, minVertical * 1.15),
            baseJump * 1.35
          );

          console.log(
            `🚀 Walljump triggered: wallSide=${launchFromSide}, launchDir=${launchDir}, vel.x will be=${
              launchDir * boostedHorizontal
            }, vel.y will be=${-boostedVertical}`
          );

          setAnim(p, "walljump", false, state);
          p.frameIndex = 0;
          p.frameTime = 0;
          p.animFinished = false;
          p.walljumpActive = true;
          p.wallcling = undefined;

          Object.assign(p.walljumpBoost, {
            active: true,
            elapsed: 0,
            duration: 0.35,
            direction: launchDir,
            startHorizontal: boostedHorizontal,
            endHorizontal: horizontalSpeed,
            startVertical: boostedVertical,
            endVertical: verticalSpeed,
          });

          p.vel.x = launchDir * boostedHorizontal;
          p.vel.y = -boostedVertical;
          if (p.jumpsLeft > 0) p.jumpsLeft -= 1;
          p.grounded = false;
          p.facing = launchDir;

          console.log(
            `🚀 Walljump applied: facing=${p.facing}, vel.x=${p.vel.x}, vel.y=${p.vel.y}`
          );
        };

        if (wallInteractHeld) {
          // Interrupt roll if it's active (wallslide takes priority)
          if (p.roll?.active) {
            p.roll.active = false;
            p.roll.isAirDodge = false;
            p.invincible = false;
          }

          // Determine desired side from stick input
          const stickThreshold = 0.3;
          let desiredSide = null;

          if (inputs.axis > stickThreshold) {
            desiredSide = 1; // Right
          } else if (inputs.axis < -stickThreshold) {
            desiredSide = -1; // Left
          }

          // Wallslide logic: stick in direction = slide on that side
          let wallSide;
          if (desiredSide === 1 && rightWall) {
            wallSide = 1; // Stick right = slide on right wall
          } else if (desiredSide === -1 && leftWall) {
            wallSide = -1; // Stick left = slide on left wall
          } else if (p.wallcling) {
            // Keep current side if stick is neutral
            wallSide = p.wallcling.side;
          } else {
            // First time: default to closest wall
            wallSide = leftWall ? -1 : 1;
          }

          // Update or create wallcling
          const cling =
            p.wallcling && p.wallcling.side === wallSide
              ? p.wallcling
              : { side: wallSide, holdTime: 0 };

          if (cling !== p.wallcling) {
            cling.holdTime = 0;
          } else {
            cling.holdTime += dt;
          }
          p.wallcling = cling;

          p.vel.x = 0;
          if (p.vel.y > 0) p.vel.y = Math.max(p.vel.y * 0.2, -30);
          p.grounded = false;
          p.jumpsLeft = Math.max(p.jumpsLeft, 1);
          p.facing = wallSide;

          console.log(
            `🧗 Wallslide: wallSide=${wallSide}, facing=${
              p.facing
            }, leftWall=${leftWall}, rightWall=${rightWall}, stick=${inputs.axis.toFixed(
              2
            )}, desiredSide=${desiredSide} (stick direction = slide on that side)`
          );

          // Reset R1 Jump Attack cooldown on wallslide
          p.r1JumpAttackCanReuse = true;

          if (!p.walljumpActive && p.anim !== "wallslide_loop") {
            console.log(
              `🎬 Setting wallslide_loop animation for ${p.charName}, current anim: ${p.anim}`
            );
            setAnim(p, "wallslide_loop", true, state);
            console.log(
              `🎬 After setAnim: ${p.anim}, frames: ${p.frames?.length || 0}`
            );
          }

          if (!p.walljumpActive) {
            return;
          }
        } else if (p.wallcling && wallInteractReleased) {
          // Same stick-based direction for release
          const stickThreshold = 0.3;
          let launchFromSide = p.wallcling.side;

          if (inputs.axis > stickThreshold) {
            // Stick right = jump right (launch from left wall)
            launchFromSide = -1;
          } else if (inputs.axis < -stickThreshold) {
            // Stick left = jump left (launch from right wall)
            launchFromSide = 1;
          }
          // Stick neutral = jump away from current wall (keep current side)

          triggerWalljump(launchFromSide);
          return;
        } else if (
          !p.wallcling &&
          wallInteractPressed &&
          !wallInteractHeld &&
          !p.walljumpActive
        ) {
          triggerWalljump(wallSide);
          return;
        }
      }
    }

    if (
      !controlsLocked &&
      !p.roll?.active &&
      inputs.jumpPressed &&
      p.jumpsLeft > 0 &&
      p.isMovable !== false // Blockiere Sprung während Respawn
    ) {
      // Check cooldown only for double jump (when not grounded)
      if (!p.grounded && p.jumpsLeft === 1) {
        if (canUseAbility(p, "doubleJump")) {
          p.vel.y = -pconf.jumpSpeed;
          startCooldown(p, "doubleJump", state);
          // Use bike animations during HP/ernst ultimate
          if (
            (p.charName.toLowerCase() === "hp" ||
              p.charName.toLowerCase() === "ernst") &&
            p.ultiPhase === "active"
          ) {
            setAnim(p, "bike_double_jump", false, state);
          } else {
            setAnim(p, "double_jump", false, state);
          }
          p.grounded = false;
          p.jumpsLeft -= 1;
        }
      } else {
        // Normal jump (no cooldown)
        p.vel.y = -pconf.jumpSpeed;
        // Use bike animations during HP/ernst ultimate
        if (
          (p.charName.toLowerCase() === "hp" ||
            p.charName.toLowerCase() === "ernst") &&
          p.ultiPhase === "active"
        ) {
          setAnim(p, "bike_jump_up", false, state);
        }
        p.grounded = false;
        p.jumpsLeft -= 1;
      }
    }

    p.dropThroughTimer = Math.max(0, (p.dropThroughTimer || 0) - dt);

    // Manual drop-through: Jump + Down (existing)
    if (p.grounded && inputs.downHeld && inputs.jumpPressed) {
      p.dropThroughTimer = 0.3;
      p.grounded = false;
      p.pos.y += 2;
    }

    // Air dodge drop-through: Roll in air while holding down
    if (!p.grounded && p.roll?.active && inputs.downHeld) {
      p.dropThroughTimer = Math.max(p.dropThroughTimer, 0.2); // Extend timer during air dodge
    }

    // Update invincibility timer (for target after HP bike hit - don't remove ultimate invincibility)
    if (p.invincibilityTimer && p.invincibilityTimer > 0) {
      p.invincibilityTimer -= dt;
      if (p.invincibilityTimer <= 0) {
        // Only remove invincibility if it's not from ultimate
        if (p.ultiPhase !== "active" && p.ultiPhase !== "start") {
          p.invincible = false;
        }
        p.invincibilityTimer = 0;
      }
    }

    // Update respawn invincibility timer
    if (p.respawnInvincibilityTimer && p.respawnInvincibilityTimer > 0) {
      p.respawnInvincibilityTimer -= dt;
      if (p.respawnInvincibilityTimer <= 0) {
        p.isInvincible = false;
        p.respawnInvincibilityTimer = 0;
      }
    }
  }

  function applyPhysics(dt, p, pconf) {
    // Delegate to MovementSystem
    MovementSystem.applyPhysics(dt, p, pconf);
  }
  // Helper function to determine if an attack can be interrupted by character-to-character collision
  function isAttackInterruptible(player) {
    // No attack active - always interruptible
    if (!player.attack || player.attack.type === "none") {
      return true;
    }

    // Critical attacks that should NOT be interrupted:
    const nonInterruptibleAttacks = [
      "l2", // Heavy attacks (L2 smashes)
      "r2", // Heavy attacks (R2 smashes)
      "r2_l2_ulti", // Ultimate attacks
      "l1_ranged_grab", // Grab attacks (active phase)
      "r1_dash_attack", // Dash attacks (active phase)
      "r1_jump", // Jump attacks (active phase)
      "r1_up_attack", // Up attacks (active phase)
      "r1_circle_attack", // Circle attacks (active phase)
    ];

    // Check if current attack type is non-interruptible
    if (nonInterruptibleAttacks.includes(player.attack.type)) {
      // For multi-phase attacks, check the phase
      if (player.attack.phase === "active" || player.attack.phase === "pull") {
        return false; // Don't interrupt active/pull phases
      }
      // For charge/release phases, allow interruption
      return true;
    }

    // All other attacks are interruptible
    return true;
  }

  // NEW: Helper function to determine if an attack comes from above/side and should bypass collision
  function isAerialAttack(player) {
    if (!player.attack || player.attack.type === "none") {
      return false;
    }

    // Get attack descriptor from catalog to check if it should bypass collision
    const descriptor = AttackCatalog.getDescriptor(player, player.attack.type);

    // Check if this attack is configured to bypass player collision
    if (descriptor.bypassPlayerCollision) {
      // For aerial attacks, also check if player is airborne or has downward velocity
      // This ensures the attack is actually coming from above
      return (
        player.attack.phase === "active" &&
        (!player.grounded || player.vel.y > 0)
      ); // Either airborne or falling
    }

    return false;
  }
  function resolveCollisionsStep(dt, p, state, canvas) {
    // --- SMASH-STYLE LATERAL KILL ZONES ---
    // Players can go beyond screen edges but have limited time to recover
    const lateralKillZone = 100; // ~100px outside stage bounds
    const recoveryZone = 100; // Grace period for recovery

    // Check if player is beyond lateral kill zones
    // Use camera bounds for stage origin and size (fallback to native space)
    const stageX = state.cameraBounds?.x ?? 0;
    const stageWidth =
      state.cameraBounds?.width ?? GameState.CONSTANTS.NATIVE_WIDTH;
    const leftKillZone = stageX - lateralKillZone;
    const rightKillZone = stageX + stageWidth + lateralKillZone;

    // Check invincibility (both invincible and isInvincible from respawn)
    const isInvulnerable = p.invincible || p.isInvincible;

    if (p.pos.x < leftKillZone || p.pos.x > rightKillZone) {
      // Skip kill zone logic if player is invulnerable
      if (isInvulnerable) {
        return;
      }

      // Player is in kill zone - check if they have recovery options
      if (!p.inLateralKillZone) {
        p.inLateralKillZone = true;
        p.lateralKillZoneTimer = 2.0; // 2 seconds to recover
        console.log(`⚠️ Player ${p.padIndex + 1} entered lateral kill zone!`);
      }

      p.lateralKillZoneTimer -= dt;

      // If timer runs out, player dies
      if (p.lateralKillZoneTimer <= 0) {
        console.log(`💀 Player ${p.padIndex + 1} died in lateral kill zone!`);
        spawnGlobalEffect(state, p, "fx_death");
        if (window.AudioSystem && window.AudioSystem.triggerDeathEffect) {
          window.AudioSystem.triggerDeathEffect(p.padIndex);
        }
        triggerScreenFlash(state);
        respawnPlayer(state, p, canvas);
        return;
      }
    } else {
      // Player is back in safe zone
      if (p.inLateralKillZone) {
        p.inLateralKillZone = false;
        p.lateralKillZoneTimer = 0;
        console.log(`✅ Player ${p.padIndex + 1} escaped lateral kill zone!`);
      }
    }

    // Allow movement beyond screen bounds (but check for death above)
    // Remove the old hard boundary: p.pos.x = Math.max(0, Math.min(canvas.width, p.pos.x));

    const hb = Renderer.getHurtbox(p);
    const groundData = state.groundData;

    // --- HEATMAP EFFECTS ---
    checkHeatmapEffects(p, state);

    // --- HORIZONTAL COLLISION (Walls) ---
    // Check for walls only if moving horizontally
    if (p.vel.x !== 0 && groundData) {
      const checkYTop = hb.top + 4;
      const checkYMid = hb.top + hb.h / 2;
      const checkYBottom = hb.top + hb.h - 4;

      if (p.vel.x > 0) {
        // Moving Right
        const checkX = hb.left + hb.w;
        if (
          isPixelSolidScaled(checkX, checkYTop, groundData, state) ||
          isPixelSolidScaled(checkX, checkYMid, groundData, state) ||
          isPixelSolidScaled(checkX, checkYBottom, groundData, state)
        ) {
          // Check surface type for different physics (TODO: update getSurfaceType for scaling)
          const surfaceType = getSurfaceType(
            checkX,
            checkYMid,
            groundData,
            state.cameraBounds
          );

          // CRITICAL FIX: Walls are ALWAYS impassable, regardless of airborne state
          if (surfaceType === "wall") {
            // Walls: Always stop movement and correct position
            p.vel.x = 0;
            p.pos.x = Math.floor(checkX) - hb.w; // Snap to surface immediately

            // CONTINUOUS POSITION CORRECTION: Ensure player is never inside wall
            const newHb = Renderer.getHurtbox(p);
            if (
              isPixelSolidScaled(
                newHb.left + newHb.w,
                checkYMid,
                groundData,
                state
              )
            ) {
              // Still overlapping, force position correction
              p.pos.x = Math.floor(checkX) - newHb.w - 0.1;
            }
          } else if (isAirborne(p)) {
            // Non-wall surfaces when airborne
            if (false) {
              // DISABLED WALLBOUNCE
            } else if (surfaceType === "ceiling") {
              p.vel.x *= -0.3; // Softer ceiling bounce
            } else {
              p.vel.x *= -0.6; // Default ground bounce
            }
            p.pos.x = Math.floor(checkX) - hb.w; // Snap to surface
          } else {
            // Non-wall surfaces when grounded
            if (false) {
              // DISABLED WALLBOUNCE
            } else if (surfaceType === "ceiling") {
              p.vel.x *= 0.3; // Sliding on ceiling
            } else {
              p.vel.x = 0; // Stop on ground
            }
            p.pos.x = Math.floor(checkX) - hb.w; // Snap to surface
          }
        }
      } else {
        // Moving Left
        const checkX = hb.left;
        if (
          isPixelSolidScaled(checkX, checkYTop, groundData, state) ||
          isPixelSolidScaled(checkX, checkYMid, groundData, state) ||
          isPixelSolidScaled(checkX, checkYBottom, groundData, state)
        ) {
          // Check surface type for different physics
          const surfaceType = getSurfaceType(
            checkX,
            checkYMid,
            groundData,
            state.cameraBounds
          );

          // CRITICAL FIX: Walls are ALWAYS impassable, regardless of airborne state
          if (surfaceType === "wall") {
            // Walls: Always stop movement and correct position
            p.vel.x = 0;
            p.pos.x = Math.ceil(checkX) + 1; // Snap to surface immediately

            // CONTINUOUS POSITION CORRECTION: Ensure player is never inside wall
            const newHb = Renderer.getHurtbox(p);
            if (isPixelSolidScaled(newHb.left, checkYMid, groundData, state)) {
              // Still overlapping, force position correction
              p.pos.x = Math.ceil(checkX) + 1.1;
            }
          } else if (isAirborne(p)) {
            // Non-wall surfaces when airborne
            if (false) {
              // DISABLED WALLBOUNCE
            } else if (surfaceType === "ceiling") {
              p.vel.x *= -0.3; // Softer ceiling bounce
            } else {
              p.vel.x *= -0.6; // Default ground bounce
            }
            p.pos.x = Math.ceil(checkX) + 1; // Snap to surface
          } else {
            // Non-wall surfaces when grounded
            if (false) {
              // DISABLED WALLBOUNCE
            } else if (surfaceType === "ceiling") {
              p.vel.x *= 0.3; // Sliding on ceiling
            } else {
              p.vel.x = 0; // Stop on ground
            }
            p.pos.x = Math.ceil(checkX) + 1; // Snap to surface
          }
        }
      }
    }

    // Refresh hurtbox after potential horizontal correction
    const hbAfterX = Renderer.getHurtbox(p);

    // --- VERTICAL COLLISION (Ground & Ceiling) ---
    let landed = false;

    // 1. Check for CEILING collision (only if moving up)
    if (p.vel.y < 0 && groundData) {
      const checkXLeft = hbAfterX.left + 4;
      const checkXMid = hbAfterX.left + hbAfterX.w / 2;
      const checkXRight = hbAfterX.left + hbAfterX.w - 4;
      const checkY = hbAfterX.top;

      if (
        isPixelSolidScaled(checkXLeft, checkY, groundData, state) ||
        isPixelSolidScaled(checkXMid, checkY, groundData, state) ||
        isPixelSolidScaled(checkXRight, checkY, groundData, state)
      ) {
        // Check surface type for different ceiling physics
        const surfaceType = getSurfaceType(
          checkXMid,
          checkY,
          groundData,
          state.cameraBounds
        );

        if (surfaceType === "ceiling") {
          p.vel.y = 0; // Stop at ceiling
          p.pos.y = Math.ceil(checkY) + hbAfterX.h; // Snap to ceiling
        } else if (surfaceType === "wall") {
          p.vel.y *= -0.3; // Soft bounce off wall when moving up
          p.pos.y = Math.ceil(checkY) + hbAfterX.h;
        } else {
          p.vel.y = 0; // Default ceiling behavior
          p.pos.y = Math.ceil(checkY) + hbAfterX.h;
        }
      }
    }

    // 2. Check for GROUND collision (only if moving down)
    else if (p.vel.y >= 0) {
      const feetX = p.pos.x;
      const start = (p.prevY ?? p.pos.y) | 0;
      const end = p.pos.y | 0;

      const groundY = findGroundYBelow(
        feetX,
        end,
        state.groundData,
        start,
        state.cameraBounds
      );
      let semisolidY = Infinity;
      if ((p.dropThroughTimer || 0) <= 0 && state.semisolidData) {
        semisolidY = findGroundYBelow(
          feetX,
          end,
          state.semisolidData,
          start,
          state.cameraBounds
        );
      }

      // CRITICAL: Ground always takes priority over semisolid
      // This ensures solid platforms remain impenetrable
      const gy = Math.min(groundY, semisolidY);

      if (gy !== Infinity && p.pos.y >= gy) {
        if (isAirborne(p) && gy === groundY) {
          // Only bounce on solid ground
          p.pos.y = gy;
          p.vel.y *= -0.6; // Bounce
        } else {
          p.pos.y = gy;
          p.vel.y = 0;
          landed = true;
        }
      }
    }

    // --- CHARACTER-TO-CHARACTER VERTICAL COLLISION ---
    // DISABLED: Characters can now pass through each other vertically
    // This allows players to jump through each other and prevents stacking issues
    /*
    for (const otherPlayer of state.players) {
      if (otherPlayer === p || otherPlayer.eliminated) continue;

      const otherHb = Renderer.getHurtbox(otherPlayer);
      const myHb = Renderer.getHurtbox(p);

      // Check if characters are overlapping vertically
      if (rectsIntersect(myHb, otherHb)) {
        // Determine who should be on top based on velocity and position
        if (p.vel.y > otherPlayer.vel.y && p.pos.y < otherPlayer.pos.y) {
          // NEW: Check if current player is performing an aerial attack
          const currentPlayerAerialAttack = isAerialAttack(p);

          // If current player is performing an aerial attack, skip collision resolution
          // This allows aerial attacks to hit stacked players from above
          if (currentPlayerAerialAttack) {
            // Skip collision resolution - let the aerial attack hit naturally
            continue;
          }

          // Check if current player is in an attack that should not be interrupted
          const currentPlayerInterruptible = isAttackInterruptible(p);
          const otherPlayerInterruptible = isAttackInterruptible(otherPlayer);

          // Only apply character-to-character collision resolution if:
          // 1. Current player's attack can be interrupted, AND
          // 2. Either both players have interruptible attacks, OR other player is not attacking
          if (
            currentPlayerInterruptible &&
            (otherPlayerInterruptible || otherPlayer.attack?.type === "none")
          ) {
            // p is falling faster and is above otherPlayer
            // Set p's position to be on top of otherPlayer
            p.pos.y = otherHb.top - myHb.h;
            p.vel.y = 0;
            p.grounded = true;
            landed = true;
            // Reset R1 Jump Attack cooldown on landing
            p.r1JumpAttackCanReuse = true;

            // Reset jump count when landing on another character
            p.jumpsLeft = 2;

            // Small upward push to prevent immediate re-collision
            otherPlayer.vel.y = Math.min(otherPlayer.vel.y, -100);
          }
        }
      }
    }
    */

    if (landed) {
      if (p.walljumpBoost?.active) {
        p.walljumpBoost.active = false;
      }
      if (!p.grounded) p.jumpsLeft = 2;
      p.grounded = true;
      // Reset R1 Jump Attack cooldown on landing
      p.r1JumpAttackCanReuse = true;
    } else {
      p.grounded = false;
    }

    // Kill zone check (re-get hurtbox in case of vertical correction)
    const finalHb = Renderer.getHurtbox(p);

    // DEBUG: Log player position and velocity for death debugging
    if (p.pos.x > canvas.width - 50 || p.pos.x < 50) {
      debugLog(
        `[DEATH DEBUG] P${p.padIndex + 1} near edge: pos=(${p.pos.x.toFixed(
          0
        )}, ${p.pos.y.toFixed(0)}), ` +
          `vel=(${p.vel.x.toFixed(0)}, ${p.vel.y.toFixed(0)}), ` +
          `hurtbox=(${finalHb.left.toFixed(0)}, ${finalHb.top.toFixed(0)}, ${
            finalHb.w
          }, ${finalHb.h})`
      );
    }

    // NEW: Enhanced vertical kill zone - stage-based margins (400px above/below)
    const stageY = state.cameraBounds?.y ?? 0;
    const stageHeight =
      state.cameraBounds?.height ?? GameState.CONSTANTS.NATIVE_HEIGHT;
    const topKillZone = stageY - 400; // 400px above stage top
    const bottomKillZone = stageY + stageHeight + 400; // 400px below stage bottom

    // Reuse isInvulnerable from lateral kill zone check (declared earlier in function)

    const isInVerticalKillZone =
      (!isInvulnerable &&
        p.vel.y > 0 &&
        rectIntersectsKill(finalHb, state.killData)) ||
      (!isInvulnerable && (p.pos.y > bottomKillZone || p.pos.y < topKillZone));

    if (isInVerticalKillZone) {
      debugLog(
        `?? [DEATH] P${p.padIndex + 1} (${
          p.charName
        }) DIED! Pos: (${p.pos.x.toFixed(0)}, ${p.pos.y.toFixed(
          0
        )}), Vel: (${p.vel.x.toFixed(0)}, ${p.vel.y.toFixed(
          0
        )}), Hurtbox: (${finalHb.left.toFixed(0)}, ${finalHb.top.toFixed(0)}, ${
          finalHb.w
        }, ${finalHb.h})`
      );

      spawnGlobalEffect(state, p, "fx_death");

      // NEW: Trigger death audio effect
      if (window.AudioSystem && window.AudioSystem.triggerDeathEffect) {
        window.AudioSystem.triggerDeathEffect(p.padIndex);
      }

      // NEW: Trigger Kill Zone visual effect
      if (window.WebGLRenderer && window.WebGLRenderer.triggerKillZoneEffect) {
        // Convert player position to screen coordinates
        const screenX = finalHb.left + finalHb.w / 2;
        const screenY = finalHb.top + finalHb.h / 2;
        window.WebGLRenderer.triggerKillZoneEffect(screenX, screenY, 1.0);
      }

      // NEW: Trigger screen flash effect for death
      triggerScreenFlash(state);

      respawnPlayer(state, p, canvas);
    }
  }

  // Helper function to scale world coordinates to heatmap coordinates
  function scaleToHeatmap(x, y, data, cameraBounds) {
    if (!data || !cameraBounds) {
      // No scaling needed if no camera bounds (fallback to native)
      return { x: x | 0, y: y | 0 };
    }
    // Scale world coordinates to heatmap pixel coordinates
    const stageWidth = cameraBounds.width ?? GameState.CONSTANTS.NATIVE_WIDTH;
    const stageHeight =
      cameraBounds.height ?? GameState.CONSTANTS.NATIVE_HEIGHT;
    const stageX = cameraBounds.x ?? 0;
    const stageY = cameraBounds.y ?? 0;

    const scaleX = data.width / stageWidth;
    const scaleY = data.height / stageHeight;

    const heatmapX = (x - stageX) * scaleX;
    const heatmapY = (y - stageY) * scaleY;

    return { x: heatmapX | 0, y: heatmapY | 0 };
  }

  function isPixelSolid(x, y, data, cameraBounds = null) {
    if (!data) return false;

    // Use color-aware solid test: only treat explicit ground/wall colors as solid.
    // This prevents arbitrary opaque pixels from being interpreted as blocking.
    const color = getPixelColor(x, y, data, cameraBounds);
    if (!color || color.a <= 128) return false;

    // Accept both BLACK (ground) and DARK_GRAY (wall) as solid pixels.
    // Use a small tolerance to allow for exact-authoring or small export variance.
    const tolerance = 2;
    const isBlack = colorsMatch(color, HEATMAP_COLORS.BLACK, tolerance);
    const isWallGray = colorsMatch(color, HEATMAP_COLORS.DARK_GRAY, tolerance);
    return isBlack || isWallGray;
  }

  // Wrapper function that automatically uses state.cameraBounds
  function isPixelSolidScaled(x, y, data, state) {
    return isPixelSolid(x, y, data, state?.cameraBounds ?? null);
  }

  /**
   * Check if a pixel is specifically a wall pixel (DARK_GRAY)
   * Returns true only when the pixel color matches the configured wall color.
   */
  function isWallPixel(x, y, data, cameraBounds = null) {
    if (!data) return false;
    const color = getPixelColor(x, y, data, cameraBounds);
    if (!color || color.a <= 128) return false;
    return colorsMatch(color, HEATMAP_COLORS.DARK_GRAY, 2);
  }

  function isWallPixelScaled(x, y, data, state) {
    return isWallPixel(x, y, data, state?.cameraBounds ?? null);
  }

  /**
   * Check if a pixel is specifically ground (BLACK)
   */
  function isGroundPixel(x, y, data, cameraBounds = null) {
    if (!data) return false;
    const color = getPixelColor(x, y, data, cameraBounds);
    if (!color || color.a <= 128) return false;
    return colorsMatch(color, HEATMAP_COLORS.BLACK, 2);
  }

  function isGroundPixelScaled(x, y, data, state) {
    return isGroundPixel(x, y, data, state?.cameraBounds ?? null);
  }

  // Walljump Heatmap Detection - Check for Green (#00FF00) color in bounce_wall.png
  function isWalljumpPixel(x, y, walljumpData, cameraBounds = null) {
    if (!walljumpData) return false;

    // Scale coordinates if camera bounds provided (scaled stages)
    let pixelX, pixelY;
    if (cameraBounds) {
      const coords = scaleToHeatmap(x, y, walljumpData, cameraBounds);
      pixelX = coords.x;
      pixelY = coords.y;
    } else {
      pixelX = x | 0;
      pixelY = y | 0;
    }

    if (
      pixelX < 0 ||
      pixelX >= walljumpData.width ||
      pixelY < 0 ||
      pixelY >= walljumpData.height
    ) {
      return false;
    }

    const index = (pixelY * walljumpData.width + pixelX) * 4;
    const r = walljumpData.data[index];
    const g = walljumpData.data[index + 1];
    const b = walljumpData.data[index + 2];
    const a = walljumpData.data[index + 3];

    // Check for Green (#00FF00) - wallslideable walls from bounce_wall.png
    return a > 128 && colorsMatch({ r, g, b }, HEATMAP_COLORS.GREEN);
  }

  // Wrapper function that automatically uses state.cameraBounds
  function isWalljumpPixelScaled(x, y, walljumpData, state) {
    return isWalljumpPixel(x, y, walljumpData, state?.cameraBounds ?? null);
  }

  function getSurfaceType(x, y, data, cameraBounds = null) {
    if (!data) return null;

    // Scale coordinates if camera bounds provided (scaled stages)
    let pixelX, pixelY;
    if (cameraBounds) {
      const coords = scaleToHeatmap(x, y, data, cameraBounds);
      pixelX = coords.x;
      pixelY = coords.y;
    } else {
      pixelX = x | 0;
      pixelY = y | 0;
    }

    if (
      pixelX < 0 ||
      pixelX >= data.width ||
      pixelY < 0 ||
      pixelY >= data.height
    ) {
      return null;
    }

    const color = getPixelColor(x, y, data, cameraBounds);
    if (!color || color.a <= 128) return null;

    if (colorsMatch(color, HEATMAP_COLORS.BLACK)) return "ground";
    if (colorsMatch(color, HEATMAP_COLORS.DARK_GRAY)) return "wall";
    if (colorsMatch(color, HEATMAP_COLORS.LIGHT_GRAY)) return "ceiling";

    return "ground"; // Default fallback
  }

  function findGroundX(startY, startX, y, data, checkRight) {
    if (!data) return Infinity;
    const clampY = Math.max(0, Math.min(data.height - 1, y | 0));

    const dir = checkRight ? 1 : -1;
    const endX = checkRight ? data.width : -1;

    let sx = Math.round(startX);
    sx = Math.max(0, Math.min(data.width - 1, sx));

    for (let x = sx; x !== endX; x += dir) {
      if (data.data[(clampY * data.width + x) * 4 + 3] > 0) {
        return x - dir;
      }
    }
    return Infinity;
  }

  function isAirborne(p) {
    return p.anim?.startsWith("airborne");
  }
  function updateAnimation(dt, p, inputs, state) {
    if (!p.anim) return;

    // Cyboard Ultimate: Handle reverse portal animation on target
    if (p.ultiReverseAnim && !p.ultiReverseAnim.finished) {
      p.ultiReverseAnim.frameTime += dt;

      if (p.ultiReverseAnim.frameTime >= p.ultiReverseAnim.frameDuration) {
        p.ultiReverseAnim.frameTime = 0;
        p.ultiReverseAnim.currentFrame++;

        if (p.ultiReverseAnim.currentFrame >= p.ultiReverseAnim.frames.length) {
          p.ultiReverseAnim.finished = true;
        }
      }

      // Don't advance normal animation while reverse anim is playing
      return;
    }

    // HP/ernst Ultimate: Keep bike animation regardless of movement/jumps (only during ultimate)
    if (
      (p.charName.toLowerCase() === "hp" ||
        p.charName.toLowerCase() === "ernst") &&
      p.ultiPhase &&
      (p.anim === "r2_l2_ulti_start" || p.anim === "r2_l2_ulti")
    ) {
      advanceAnim(dt, p, state);
      return; // Skip all other animation logic
    }

    // Fritz Ultimate: Keep ulti animations regardless of movement/jumps (only during ultimate)
    if (
      p.charName === "fritz" &&
      p.ultiPhase &&
      (p.anim === "r2_l2_ulti_start" || p.anim === "r2_l2_ulti")
    ) {
      advanceAnim(dt, p, state);
      return; // Skip all other animation logic
    }

    // Cyboard Ultimate: Keep portal animations regardless of movement/jumps (only during ultimate)
    if (
      p.charName === "cyboard" &&
      p.ultiPhase &&
      (p.anim === "r2_l2_ulti_start" || p.anim === "r2_l2_ulti_finish")
    ) {
      advanceAnim(dt, p, state);
      return; // Skip all other animation logic
    }

    // Walljump Animation: Force walljump animation to play completely - HIGHEST PRIORITY
    if (p.walljumpActive) {
      if (p.grounded) {
        p.walljumpActive = false;
        setAnim(p, "idle", true, state);
        return;
      }

      const totalFrames = Array.isArray(p.frames) ? p.frames.length : 0;

      advanceAnim(dt, p, state);

      if (p.animFinished || (totalFrames && p.frameIndex >= totalFrames - 1)) {
        p.walljumpActive = false;
      } else {
        return; // Keep playing walljump animation while airborne
      }
    }

    // Wallcling is now controlled by Roll/Dodge input, not Jump
    // Removed: wallcling ends when Roll/Dodge is released (handled in wall interaction logic)

    if (p.wallcling) {
      // Keep wallslide animation stable while clinging to a wall.
      if (p.anim !== "wallslide_loop") {
        setAnim(p, "wallslide_loop", true, state);
      }
      advanceAnim(dt, p, state);
      return;
    }

    // HP Ultimate: Complete bike jump animation system (only during active phase)
    if (p.charName.toLowerCase() === "hp" && p.ultiPhase === "active") {
      // Handle bike jump animations with proper state machine
      if (!p.grounded) {
        const AIRBORNE_VEL_THRESHOLD = 150;

        // If bike jump animations are playing, don't interrupt them
        if (
          (p.anim === "bike_jump_up" || p.anim === "bike_double_jump") &&
          !p.animFinished
        ) {
          // Let bike jump animations play
        }
        // If bike_double_jump just finished, transition to bike fall
        else if (p.anim === "bike_double_jump" && p.animFinished) {
          setAnim(p, "bike_jump_fall", true, state);
          p.postDoubleJumpCooldown = 0.2; // Suppress airborne for a moment
        }
        // If player is floating (and not right after a double jump), use bike fall
        else if (
          (p.postDoubleJumpCooldown || 0) <= 0 &&
          Math.abs(p.vel.y) < AIRBORNE_VEL_THRESHOLD &&
          p.airTime > 0.3
        ) {
          setAnim(p, "bike_jump_fall", true, state);
        }
        // Default bike jump behavior for rising or falling
        else {
          if (p.vel.y < 0) {
            setAnim(p, "bike_jump_up", false, state); // Non-looping
          } else {
            setAnim(p, "bike_jump_fall", true, state); // Looping fall
          }
        }
      } else {
        // HP is grounded during ultimate - return to bike loop
        if (
          p.anim === "bike_jump_fall" ||
          p.anim === "bike_jump_up" ||
          p.anim === "bike_double_jump"
        ) {
          setAnim(p, "r2_l2_ulti", true, state); // Return to bike loop
        }
      }
      // Skip normal grounded animation logic for HP during ultimate
      advanceAnim(dt, p, state);
      return;
    }

    // Ernst Ultimate: No bike movement, just ulti loop (projectiles handle damage)
    if (p.charName.toLowerCase() === "ernst" && p.ultiPhase === "active") {
      // Keep ulti loop animation, no bike movement
      advanceAnim(dt, p, state);
      return;
    }

    // Advance charge FX animation if it exists
    if (p.chargeFx && state.fxAtlas) {
      p.chargeFx.time = (p.chargeFx.time || 0) + dt;
      const fxAnimData = state.fxAtlas.animations[p.chargeFx.name];
      if (fxAnimData) {
        const frameDur = 1 / state.fxAtlas.fps;
        if (p.chargeFx.time >= frameDur) {
          p.chargeFx.time -= frameDur;
          p.chargeFx.frameIndex =
            ((p.chargeFx.frameIndex || 0) + 1) % fxAnimData.length;
        }
      }
    }

    if ((p.stunT || 0) > 0) {
      // Don't interrupt an attack animation with stun, as it can lock the state machine.
      if (p.attack.type === "none") {
        setAnim(p, "stun", true, state);
      }
    } else if (p.ultiHurtLock && p.anim === "hurt") {
      // Ernst Ultimate: Keep hurt animation looping while locked
      advanceAnim(dt, p, state);
      // Reset to loop if finished
      if (p.animFinished) {
        p.frameIndex = 0;
        p.frameTime = 0;
        p.animFinished = false;
      }
      return;
    } else if (p.anim === "hurt" && !p.animFinished) {
      // let anim play out
    } else if (p.anim && p.anim.includes("dance") && !p.animFinished) {
      // let dance animation play out (including new dynamic dance animations)
      advanceAnim(dt, p, state);
    } else {
      const attackLocked =
        p.attack.type !== "none" ||
        (p.anim === "r1_dash_attack" && !p.animFinished);

      if (attackLocked && p.attack.type === "r1_dash_attack") {
      }

      // Don't interrupt dance animations (including new dynamic dance animations)
      const danceActive = p.anim && p.anim.includes("dance") && !p.animFinished;

      if (!attackLocked && !p.roll.active && !danceActive) {
        const absVx = Math.abs(p.vel.x);
        if (!p.grounded) {
          // Debug: Log animation changes that might interrupt wallslide
          if (p.anim === "wallslide_loop") {
            console.log(
              `🎬 Wallslide animation interrupted by airborne logic for ${p.charName}`
            );
          }

          // PROTECT WALLSLIDE: Don't interrupt wallslide animation with airborne logic
          if (p.anim === "wallslide_loop" && p.wallcling) {
            console.log(`🎬 Protecting wallslide animation for ${p.charName}`);
            advanceAnim(dt, p, state);
            return;
          }

          // If a jump/double_jump animation is playing, let it finish.
          if (
            (p.anim === "jump_up" || p.anim === "double_jump") &&
            !p.animFinished
          ) {
            // keep current animation
          } else if (p.anim === "double_jump" && p.animFinished) {
            // transition to fall after the double jump completes
            setAnim(p, "jump_fall", true, state);
            p.postDoubleJumpCooldown = 0.2; // Suppress immediate retrigger
          } else {
            // Default airborne handling: rising uses jump_up, falling uses jump_fall
            if (p.vel.y < 0) {
              if (p.anim !== "jump_up") {
                setAnim(p, "jump_up", false, state);
              }
            } else {
              if (p.anim !== "jump_fall") {
                setAnim(p, "jump_fall", true, state);
              }
            }
          }
        } else if (absVx > 30) {
          setAnim(p, "run", true, state);
        } else {
          setAnim(p, "idle", true, state, 0.5); // Play idle at half speed
        }
      }

      // fall through to advanceAnim
    }

    advanceAnim(dt, p, state);
  }
  // Rhythm System Functions
  function checkRhythmBonus(attackTime, attackType, attacker) {
    // Use dynamic BPM and audio time so gameplay aligns with music
    const state = typeof window !== "undefined" ? window.state : null;

    // NEW: Intensity-based Zone Check (from Heatmap)
    // If Dance Mode is active, verify player is in a "Hot Zone" via intensity
    let doubleCharge = false;
    if (window.DanceSpotManager && state?.danceMode?.active && attacker) {
      // Get intensity from player state (updated by DanceSpotManager)
      const intensity = attacker.danceZoneIntensity || 0;

      // Thresholds from Guide:
      // Hot Zone (Alpha 200-255) -> Intensity > ~0.78
      // Center Core (Alpha 250+) -> Intensity > 0.95 -> Double Charge

      if (intensity < 0.75) {
        return null; // Not in Hot Zone -> no beat match
      }

      if (intensity > 0.95) {
        doubleCharge = true; // Center of the zone -> Double Beat Charge
      }
    }

    const BPM = state?.currentBPM || 117;
    const BEAT_INTERVAL = 60000 / BPM; // ms per beat
    const BEAT_WINDOW = BEAT_INTERVAL * 0.25; // 25% window (any beat)

    // Prefer audio-based music time, adjusted by stage downbeat offset
    const beatOffset = state?.currentBeatOffset || 0;
    let adjustedTime = 0;
    let audioTime = 0;
    if (AudioSystem && AudioSystem.getMusicTime) {
      audioTime = AudioSystem.getMusicTime() || 0;
    }
    if (audioTime > 0) {
      adjustedTime = Math.max(0, audioTime + beatOffset);
    } else {
      // Fallback to provided attackTime or system time
      adjustedTime =
        typeof attackTime === "number"
          ? attackTime
          : (performance.now() / 1000) * 1000 + beatOffset;
    }

    const timeSinceLastBeat = adjustedTime % BEAT_INTERVAL;
    const isOnBeat =
      timeSinceLastBeat < BEAT_WINDOW ||
      timeSinceLastBeat > BEAT_INTERVAL - BEAT_WINDOW;

    // Only apply to actual attacks, not special moves
    const isAttackType =
      attackType &&
      (attackType.includes("r1") ||
        attackType.includes("r2") ||
        attackType.includes("l1") ||
        attackType.includes("l2"));

    if (isOnBeat && isAttackType) {
      return {
        damageMultiplier: 1.2, // 20% more damage
        knockbackMultiplier: 1.1, // 10% more knockback
        showFx: true,
        doubleCharge: doubleCharge, // Pass double charge flag
      };
    }
    return null;
  }

  function isInBeatWindow(state) {
    // Use dynamic BPM from current stage (defaults to 117 if not set)
    const BPM = state?.currentBPM || 117;
    const BEAT_INTERVAL = 60000 / BPM; // Time between beats in ms
    const BEAT_WINDOW = BEAT_INTERVAL * 0.25; // 25% window (any beat)

    // Get beat offset from stage config (in milliseconds, can be negative)
    const beatOffset = state?.currentBeatOffset || 0;

    // NEW: Use unified audio-based timing system
    let adjustedTime = 0;
    let audioTime = 0;
    if (AudioSystem && AudioSystem.getMusicTime) {
      audioTime = AudioSystem.getMusicTime() || 0;
    }
    if (audioTime > 0) {
      adjustedTime = Math.max(0, audioTime + beatOffset);
    } else {
      // Fallback to system time
      const stageStartTime = state?.stageStartTime || 0;
      const timeSinceStageStart = performance.now() / 1000 - stageStartTime;
      adjustedTime = Math.max(0, timeSinceStageStart * 1000 + beatOffset);
    }

    const timeSinceLastBeat = adjustedTime % BEAT_INTERVAL;

    // Check if we're within the beat window (before or after the beat)
    const isNearBeat =
      timeSinceLastBeat < BEAT_WINDOW ||
      timeSinceLastBeat > BEAT_INTERVAL - BEAT_WINDOW;

    return isNearBeat;
  }
  function getBeatWindowQuality(state) {
    // Returns: "perfect" or null (miss)
    const BPM = state?.currentBPM || 117;
    const BEAT_INTERVAL = 60000 / BPM;
    const PERFECT_WINDOW = BEAT_INTERVAL * 0.24; // 24% für Perfect (halbiert von 48%)
    const GOOD_WINDOW = BEAT_INTERVAL * 0.6; // 60% f�r Good (angepasst)

    const beatOffset = state?.currentBeatOffset || 0;

    // NEW: Use unified audio-based timing system
    let adjustedTime = 0;
    let audioTime = 0;
    if (AudioSystem && AudioSystem.getMusicTime) {
      audioTime = AudioSystem.getMusicTime() || 0;
    }
    if (audioTime > 0) {
      adjustedTime = Math.max(0, audioTime + beatOffset);
    } else {
      // Fallback to system time
      const stageStartTime = state?.stageStartTime || 0;
      const timeSinceStageStart = performance.now() / 1000 - stageStartTime;
      adjustedTime = Math.max(0, timeSinceStageStart * 1000 + beatOffset);
    }

    const timeSinceLastBeat = adjustedTime % BEAT_INTERVAL;

    // Check Perfect Window
    if (
      timeSinceLastBeat < PERFECT_WINDOW ||
      timeSinceLastBeat > BEAT_INTERVAL - PERFECT_WINDOW
    ) {
      return "perfect";
    }

    return null; // Miss (alles was nicht perfect ist)
  }
  // NEW: Combo System - Updates combo counters based on beat quality
  function updateComboSystem(state, playerIndex, beatQuality) {
    // Safety checks
    if (!state || !state.comboSystem) {
      return; // Silently return if not initialized
    }

    const playerKey = `p${playerIndex + 1}`;
    const combo = state.comboSystem[playerKey];
    if (!combo) {
      return; // Silently return if player combo data not found
    }

    // Safety check for arrays
    if (!state.comboSystem.comboTerms || !state.comboSystem.comboColors) {
      return; // Silently return if arrays not initialized
    }

    if (beatQuality === "perfect") {
      // Perfect beat - increment combo and perfect streak
      combo.count = Math.min(combo.count + 1, 10); // Cap at 10
      combo.perfectStreak = (combo.perfectStreak || 0) + 1;

      // Check for special 50x perfect reward
      if (combo.perfectStreak === 50) {
        combo.text = "TARANTULA";
        combo.color = "#ff00ff"; // Special magenta color for ultimate achievement
      } else {
        // Set combo text and color with bounds checking
        const termIndex = Math.max(0, Math.min(combo.count - 1, 9)); // 0-9 for array access
        if (
          termIndex < state.comboSystem.comboTerms.length &&
          termIndex < state.comboSystem.comboColors.length
        ) {
          combo.text = state.comboSystem.comboTerms[termIndex];
          combo.color = state.comboSystem.comboColors[termIndex];
        }
      }

      // NEW: Emit combo particles
      const player = state.players[playerIndex];
      if (player && combo.count > 0) {
        console.log(
          `🎯 Combo ${combo.count}: ${combo.text} - Emitting particles for player ${playerIndex}`
        );
        ParticleManager.emitComboParticles(player, combo.count, state);
      }

      // Activate combo display (will show after PERFECT fades out)
      combo.isActive = true;
      combo.time = 0; // Reset timing for new rendering system
    } else if (beatQuality === "off" || beatQuality === null) {
      // Non-perfect beat - reset combo and perfect streak
      combo.count = 0;
      combo.perfectStreak = 0;
      combo.isActive = false;
      combo.text = "";
      combo.color = "";
    }
    // Note: We don't handle "missed beats" here as that's handled by the beat detection system
  }
  // NEW: Update combo display timers
  function updateComboTimers(dt, state) {
    // Safety check
    if (!state || !state.comboSystem) {
      return;
    }

    // Update P1 combo timer
    if (state.comboSystem.p1 && state.comboSystem.p1.isActive) {
      state.comboSystem.p1.time += dt;
      // Debug: Log timer progress
      if (state.comboSystem.p1.time < 0.1) {
        console.log(
          `⏰ P1 combo timer started: "${
            state.comboSystem.p1.text
          }" at time ${state.comboSystem.p1.time.toFixed(2)}s`
        );
      }
      // Combo runs for 2.0s total (new system: immediate display)
      if (state.comboSystem.p1.time >= 2.0) {
        state.comboSystem.p1.isActive = false;
        console.log(`⏰ P1 combo timer ended: "${state.comboSystem.p1.text}"`);
      }
    }

    // Update P2 combo timer
    if (state.comboSystem.p2 && state.comboSystem.p2.isActive) {
      state.comboSystem.p2.time += dt;
      // Debug: Log timer progress
      if (state.comboSystem.p2.time < 0.1) {
        console.log(
          `⏰ P2 combo timer started: "${
            state.comboSystem.p2.text
          }" at time ${state.comboSystem.p2.time.toFixed(2)}s`
        );
      }
      // Combo runs for 2.0s total (new system: immediate display)
      if (state.comboSystem.p2.time >= 2.0) {
        state.comboSystem.p2.isActive = false;
        console.log(`⏰ P2 combo timer ended: "${state.comboSystem.p2.text}"`);
      }
    }
  }

  function detectHits(p, i, state) {
    // PREVENT HIT DETECTION IF GRABBED OR GRABBING (unless specific logic handles it)
    if (p.isGrabbed) return;

    // Keep frame tracking in physics.js
    if (p.attack?.didHitThisFrame) return; // Already processed this attack this frame

    // Delegate to AttackSystem
    AttackSystem.detectHits(p, i, state);
  }

  function updateEffects(dt, state) {
    for (let i = state.effects.length - 1; i >= 0; i--) {
      const e = state.effects[i];

      // NEW: Update position if effect is following a target
      if (e.target) {
        const hurtbox = Renderer.getHurtbox(e.target);
        e.pos.x = e.target.pos.x;
        e.pos.y = e.target.pos.y + e.offsetY; // Apply vertical offset
      }

      // Update position for character effects (attached to owner)
      if (e.isCharacterEffect && e.owner) {
        e.pos.x = e.owner.pos.x;
        e.pos.y = e.owner.pos.y;
        e.facing = e.owner.facing; // Update facing direction

        // Debug logging for beat charge aura effect
        if (
          e.frames &&
          e.frames[0] &&
          typeof e.frames[0] === "string" &&
          e.frames[0].includes("fx_charged_beat")
        ) {
          const owner = e.owner;
          if (
            owner &&
            owner.beatChargeAuraEffect &&
            owner.beatChargeAuraEffect !== e
          ) {
            console.warn(
              `[BeatCharge] P${
                owner.padIndex + 1
              }: Aura effect mismatch! Owner reference points to different effect`
            );
          }
          if (e.done && owner && owner.beatChargeAuraEffect === e) {
            console.log(
              `[BeatCharge] P${
                owner.padIndex + 1
              }: Aura effect marked as done, will be removed from array`
            );
          }
        }
      }

      e.time = (e.time || 0) + dt;

      // Check if effect has a duration (for static effects like damage numbers)
      // BUT: If it's looped, we still want to animate it
      // UNLESS: It's marked for duration-based cleanup (like fade-out effects)
      if (e.duration && (!e.isLooped || e.useDurationCleanup)) {
        if (e.time >= e.duration) {
          e.done = true;
        }
      } else {
        // Normal animated effect (including looped effects with duration)
        const fps = e.fps || state.fps; // Use effect's own FPS, or default

        // Support frame-specific durations (for ulti_impact from AttackAnimationCatalog)
        if (
          e.useFrameDurations &&
          e.frames &&
          e.frames.length > 0 &&
          e.frameIndex < e.frames.length
        ) {
          const currentFrame = e.frames[e.frameIndex];
          const frameDuration =
            typeof currentFrame === "object" && currentFrame.d
              ? currentFrame.d / fps / (e.speed || 1)
              : 1 / fps / (e.speed || 1);

          if (e.time >= frameDuration) {
            e.time -= frameDuration;
            if (e.frameIndex < e.frames.length - 1) {
              e.frameIndex++;
            } else {
              e.done = true; // Non-looping impact effect
            }
          }
        } else {
          // Standard frame duration
          const frameDur = 1 / fps / (e.speed || 1);

          // Debug logging for knockback effects
          if (e.anim && e.anim.includes("fx_knockback")) {
            debugLog(
              `[updateEffects] ${e.anim} - frameIndex: ${e.frameIndex}/${
                e.frames.length - 1
              }, time: ${e.time.toFixed(3)}, frameDur: ${frameDur.toFixed(
                3
              )}, speed: ${e.speed}`
            );
          }

          while (e.time >= frameDur) {
            e.time -= frameDur;
            if (e.frameIndex < e.frames.length - 1) e.frameIndex++;
            else if (e.isLooped) {
              // Loop the animation for stage effects
              e.frameIndex = 0;
            } else {
              e.done = true;
              if (
                e.frames &&
                e.frames[0] &&
                e.anim &&
                e.anim.includes("fx_knockback")
              ) {
                // Knockback effect finished
              }
            }
          }
        }
      }

      if (e.done) {
        // Debug logging for beat charge aura effect removal
        if (
          e.isCharacterEffect &&
          e.owner &&
          e.frames &&
          e.frames[0] &&
          typeof e.frames[0] === "string" &&
          e.frames[0].includes("fx_charged_beat")
        ) {
          console.log(
            `[BeatCharge] P${
              e.owner.padIndex + 1
            }: Removing aura effect from effects array`
          );
        }
        state.effects.splice(i, 1);
      }
    }
  }
  // NEW: Update stage animations for bgLayer
  function updateStageAnimations(dt, state) {
    if (!state.stageAnimations) return;

    for (let i = state.stageAnimations.length - 1; i >= 0; i--) {
      const anim = state.stageAnimations[i];
      if (anim.done) {
        state.stageAnimations.splice(i, 1);
        continue;
      }

      // Check if animation has a duration
      if (anim.duration && (!anim.isLooped || anim.useDurationCleanup)) {
        if (anim.time >= anim.duration) {
          anim.done = true;
        }
      } else {
        // NEW: Beat-synchronized stage effect (every 4th frame = 1 beat)
        if (anim.beatSync && window.AudioSystem && AudioSystem.getMusicTime) {
          let musicMs = AudioSystem.getMusicTime() || 0;
          const beatOffset = state.currentBeatOffset || 0;
          let adjustedMusicTime = 0;
          if (musicMs > 0) {
            adjustedMusicTime = musicMs + beatOffset;
          } else {
            const stageStartTime = state.stageStartTime || 0;
            const timeSinceStageStart =
              performance.now() / 1000 - stageStartTime;
            adjustedMusicTime = Math.max(
              0,
              timeSinceStageStart * 1000 + beatOffset
            );
          }
          const bpm = state.currentBPM || 120;
          const msPerBeat = 60000 / bpm;

          // Calculate current beat position
          const currentBeat = Math.floor(adjustedMusicTime / msPerBeat);
          const timeSinceBeat = adjustedMusicTime % msPerBeat;

          // Every frame = 1 beat (much slower, more musical)
          const totalFrames = anim.frames.length;

          // Stage-specific FPS multiplier (e.g., 2x for stage 3)
          const fpsMultiplier = anim.fpsMultiplier || 1;
          const adjustedBeat = Math.floor(currentBeat * fpsMultiplier);
          const frameIndex = adjustedBeat % totalFrames;

          anim.frameIndex = frameIndex;

          // Debug logging for beat sync
          if (state.debug?.beatSyncLogging && currentBeat % 4 === 0) {
            console.log(
              `🎬 [BEAT SYNC] Beat: ${currentBeat}, Frame: ${frameIndex}/${totalFrames}, FPS Multiplier: ${fpsMultiplier}x, TimeSinceBeat: ${timeSinceBeat.toFixed(
                0
              )}ms`
            );
          }
        } else if (
          anim.sync &&
          window.AudioSystem &&
          AudioSystem.getMusicTime
        ) {
          // Legacy BPM-synced stage effect
          let musicMs = AudioSystem.getMusicTime() || 0;
          const bpm = state.currentBPM || 120;
          const beatsPerLoop = anim.sync.beatsPerLoop || 4; // default 1 bar
          const msPerBeat = 60000 / bpm;
          const loopMs = msPerBeat * beatsPerLoop;
          let phaseMs = 0;
          if (musicMs > 0) {
            phaseMs = (musicMs + (anim.sync.offsetMs || 0)) % loopMs;
          } else {
            const stageStartTime = state.stageStartTime || 0;
            const timeSinceStageStart =
              performance.now() / 1000 - stageStartTime;
            phaseMs =
              (Math.max(0, timeSinceStageStart * 1000) +
                (anim.sync.offsetMs || 0)) %
              loopMs;
          }
          const t = phaseMs / loopMs; // 0..1
          const index = Math.floor(t * anim.frames.length) % anim.frames.length;
          anim.frameIndex = index;
        } else {
          const fps = anim.fps || state.fps;
          // Apply fpsMultiplier to normal FPS-based animations as well
          const fpsMultiplier = anim.fpsMultiplier || 1;
          const frameDur = 1 / fps / (anim.speed || 1) / fpsMultiplier;
          anim.time += dt;

          while (anim.time >= frameDur) {
            anim.time -= frameDur;
            anim.frameIndex++;
            if (anim.frameIndex >= anim.frames.length) {
              if (anim.isLooped) {
                anim.frameIndex = 0;
              } else {
                anim.done = true;
              }
            }
          }
        }
      }

      if (anim.done) state.stageAnimations.splice(i, 1);
    }
  }
  // NEW: Spawn stage animation on bgLayer
  function spawnStageAnimation(state, animName, pos, options = {}) {
    if (!state.stageFxAtlas || !state.stageFxAtlas.animations[animName]) {
      console.warn(`Stage animation '${animName}' not found in stageFxAtlas`);
      return null;
    }

    const frames = state.stageFxAtlas.animations[animName];
    const stageAnim = {
      anim: animName,
      frames,
      fps: state.stageFxAtlas.fps,
      frameIndex: 0,
      time: 0,
      pos: { ...pos },
      offsetX: options.offsetX || 0,
      offsetY: options.offsetY || 0,
      speed: options.speed || 1.0,
      scale: options.scale || 1.0,
      duration: options.duration || null,
      isLooped: options.isLooped || false,
      done: false,
      // Optional BPM sync (legacy)
      sync: options.sync || null,
      // NEW: Beat sync (every 4th frame = 1 beat)
      beatSync: options.beatSync || false,
      // NEW: FPS multiplier for stage-specific speeds
      fpsMultiplier: options.fpsMultiplier || 2, // Default 2x for all stages
    };

    state.stageAnimations.push(stageAnim);
    console.log(
      `Spawned stage animation '${animName}' at (${pos.x}, ${pos.y})`
    );
    return stageAnim;
  }
  // NEW: Spawn stage animation from heatmap detection
  function spawnStageAnimationFromHeatmap(state, animName, heatmapPos) {
    if (!state.stageFxAtlas || !state.stageFxAtlas.animations[animName]) {
      console.warn(`Stage animation '${animName}' not found in stageFxAtlas`);
      return null;
    }

    // Convert heatmap position to world coordinates
    // Use camera_bounds dimensions if available (for scaled stages), otherwise use NATIVE dimensions
    const stageW =
      state.cameraBounds?.width ?? GameState.CONSTANTS.NATIVE_WIDTH;
    const stageH =
      state.cameraBounds?.height ?? GameState.CONSTANTS.NATIVE_HEIGHT;
    const heatmapW = state.specialData?.width ?? stageW;
    const heatmapH = state.specialData?.height ?? stageH;

    // Convert heatmap pixel coordinates to world coordinates
    const worldX = (heatmapPos.x / heatmapW) * stageW;
    const worldY = (heatmapPos.y / heatmapH) * stageH;

    const renderScaleX = state.stageFxAtlas?.sourceScaleX || 1;
    const renderScaleY = state.stageFxAtlas?.sourceScaleY || 1;

    const frames = state.stageFxAtlas.animations[animName];
    const firstFrameId = frames?.[0];
    const firstFrame = firstFrameId
      ? state.stageFxAtlas.frames[firstFrameId]
      : null;
    const baseFrameWidth = firstFrame?.frame?.w || 256;
    const baseFrameHeight = firstFrame?.frame?.h || 256;

    const halfRenderWidth = (baseFrameWidth * renderScaleX) / 2;
    const halfRenderHeight = (baseFrameHeight * renderScaleY) / 2;

    const animationPos = {
      x: worldX - halfRenderWidth,
      y: worldY - halfRenderHeight,
    };

    // De-duplication: avoid spawning same animation in same block
    const blockSize = 20; // must match detection block size - smaller for more precision
    const blockX = Math.floor(heatmapPos.x / blockSize);
    const blockY = Math.floor(heatmapPos.y / blockSize);
    const spawnKey = `${animName}@${blockX}_${blockY}`;
    if (
      state.spawnedStageAnimKeys &&
      state.spawnedStageAnimKeys.has(spawnKey)
    ) {
      console.log(`Skipping duplicate stage anim ${spawnKey}`);
      return null;
    }
    const stageAnim = {
      anim: animName,
      frames,
      fps: state.stageFxAtlas.fps,
      frameIndex: 0,
      time: 0,
      pos: { ...animationPos },
      offsetX: 0,
      offsetY: 0,
      speed: 1.0,
      scale: 1.0,
      duration: null,
      isLooped: true, // Loop the animation
      done: false,
      // Optional BPM sync (legacy)
      sync: state.stageFxAtlas?.meta?.sync?.[animName] || null,
      // NEW: Beat sync (every 4th frame = 1 beat)
      beatSync: true, // Enable beat synchronization for heatmap animations
      // NEW: FPS multiplier for stage-specific speeds
      fpsMultiplier: state.stageFxAtlas?.meta?.fpsMultiplier?.[animName] || 1,
    };

    state.stageAnimations.push(stageAnim);
    if (state.spawnedStageAnimKeys) state.spawnedStageAnimKeys.add(spawnKey);
    console.log(
      `Spawned ${animName} animation from heatmap at (${animationPos.x}, ${animationPos.y})`
    );
    return stageAnim;
  }

  // NEW: Spawn animations from dedicated UI heatmap (anim_ui.png)
  function spawnStageUiAnimations(state) {
    if (!state.animUiData || !state.stageFxAtlas) return;

    const { width, height } = state.animUiData;
    const stageW =
      state.cameraBounds?.width ?? GameState.CONSTANTS.NATIVE_WIDTH;
    const stageH =
      state.cameraBounds?.height ?? GameState.CONSTANTS.NATIVE_HEIGHT;

    console.log(
      `🔍 Scanning anim_ui heatmap (${width}x${height}) for stage animations...`
    );

    // 1. Generate Palette Mapping
    // Get all animation keys from atlas
    let animKeys = [];
    if (state.stageFxAtlas.animations) {
      animKeys = Object.keys(state.stageFxAtlas.animations).sort();
    } else if (state.stageFxAtlas.frames) {
      // Fallback to frame names if no animations defined
      animKeys = (
        Array.isArray(state.stageFxAtlas.frames)
          ? state.stageFxAtlas.frames.map((f, i) => i.toString())
          : Object.keys(state.stageFxAtlas.frames)
      ).sort();
    }

    if (animKeys.length === 0) {
      console.warn("⚠️ No animations found in stage atlas to map.");
      return;
    }

    // Distinct colors palette
    const palette = [
      { r: 255, g: 0, b: 0 }, // 0: Red
      { r: 0, g: 255, b: 0 }, // 1: Green
      { r: 0, g: 0, b: 255 }, // 2: Blue
      { r: 255, g: 255, b: 0 }, // 3: Yellow
      { r: 0, g: 255, b: 255 }, // 4: Cyan
      { r: 255, g: 0, b: 255 }, // 5: Magenta
      { r: 255, g: 128, b: 0 }, // 6: Orange
      { r: 128, g: 0, b: 255 }, // 7: Purple
      { r: 128, g: 255, b: 0 }, // 8: Lime
      { r: 255, g: 128, b: 192 }, // 9: Pink
      { r: 0, g: 128, b: 128 }, // 10: Teal
      { r: 0, g: 0, b: 128 }, // 11: Navy
      { r: 128, g: 0, b: 0 }, // 12: Maroon
      { r: 128, g: 128, b: 0 }, // 13: Olive
      { r: 165, g: 42, b: 42 }, // 14: Brown
      { r: 255, g: 127, b: 80 }, // 15: Coral
      { r: 75, g: 0, b: 130 }, // 16: Indigo
      { r: 238, g: 130, b: 238 }, // 17: Violet
      { r: 255, g: 215, b: 0 }, // 18: Gold
      { r: 192, g: 192, b: 192 }, // 19: Silver
    ];

    // Log the mapping for the user
    console.log("🎨 Stage Animation Color Mapping:");
    const colorMap = new Map();
    animKeys.forEach((key, index) => {
      const color = palette[index % palette.length];
      // If we run out of colors, we cycle. Ideally, we'd warn or use a larger palette.
      if (index >= palette.length) {
        console.warn(
          `⚠️ More animations than colors! '${key}' shares color with '${
            animKeys[index % palette.length]
          }'`
        );
      }
      console.log(`  • ${key} → RGB(${color.r}, ${color.g}, ${color.b})`);
      colorMap.set(JSON.stringify(color), key);
    });

    const detectedAnimations = [];
    const blockSize = 256;
    const tolerance = 5;

    // 2. Scan Heatmap in 256x256 blocks
    // We check the center of each potential 256x256 block
    for (let y = 0; y < height; y += blockSize) {
      for (let x = 0; x < width; x += blockSize) {
        // Check bounds
        if (x + blockSize > width || y + blockSize > height) continue;

        // Sample center pixel
        const centerX = x + blockSize / 2;
        const centerY = y + blockSize / 2;

        const color = getPixelColor(
          Math.floor(centerX),
          Math.floor(centerY),
          state.animUiData
        );

        if (!color || color.a < 128) continue;

        // Check against mapped colors
        let foundAnim = null;

        for (const [paletteKey, animName] of colorMap.entries()) {
          const targetColor = JSON.parse(paletteKey);
          if (
            Math.abs(color.r - targetColor.r) <= tolerance &&
            Math.abs(color.g - targetColor.g) <= tolerance &&
            Math.abs(color.b - targetColor.b) <= tolerance
          ) {
            foundAnim = animName;
            break;
          }
        }

        if (foundAnim) {
          detectedAnimations.push({
            x: centerX, // Spawn at center of the block
            y: centerY,
            anim: foundAnim,
            blockKey: `${x}_${y}`,
          });
          console.log(
            `✅ Detected ${foundAnim} at block (${x},${y}) -> Pos: (${centerX},${centerY})`
          );
        }
      }
    }

    console.log(
      `🎯 Found ${detectedAnimations.length} animation blocks in anim_ui heatmap`
    );

    // 3. Spawn
    let spawnCount = 0;
    // Ratio for coordinate mapping if heatmap size != stage size
    // Assuming heatmap covers the whole stage area defined by cameraBounds
    const xRatio = stageW / width;
    const yRatio = stageH / height;

    for (const data of detectedAnimations) {
      const worldX = data.x * xRatio;
      const worldY = data.y * yRatio;

      const spawned = spawnStageAnimationFromHeatmap(state, data.anim, {
        x: worldX,
        y: worldY,
      });
      if (spawned) spawnCount++;
    }
    console.log(`🚀 Spawned ${spawnCount} animations from anim_ui`);
    state.stageAnimationsFromHeatmapSpawned = true;
  }
  // NEW: Scan special heatmap for colored pixels and spawn animations
  function spawnStageAnimationsFromHeatmap(state) {
    // 1. Try new system first
    if (state.animUiData && state.stageFxAtlas) {
      spawnStageUiAnimations(state);
      return;
    }

    if (!state.specialData || !state.stageFxAtlas) {
      console.warn(
        "Cannot spawn stage animations: missing specialData/animUiData or stageFxAtlas"
      );
      return;
    }

    // Prevent multiple spawns
    if (state.stageAnimationsFromHeatmapSpawned) {
      console.log("Stage animations from heatmap already spawned, skipping");
      return;
    }

    const { width, height } = state.specialData;
    // Use camera_bounds dimensions if available (for scaled stages), otherwise use NATIVE dimensions
    const stageW =
      state.cameraBounds?.width ?? GameState.CONSTANTS.NATIVE_WIDTH;
    const stageH =
      state.cameraBounds?.height ?? GameState.CONSTANTS.NATIVE_HEIGHT;
    const detectedAnimations = [];

    // Define target colors and their corresponding animations
    const colorAnimationMap = {
      [JSON.stringify(HEATMAP_COLORS.GREEN_03FF00)]: "fx_stage_3",
      [JSON.stringify(HEATMAP_COLORS.BLUE_0300FF)]: "fx_stage_3_1",
    };

    console.log("🔍 Starting precise pixel detection scan (20x20 blocks)...");
    console.log(
      `📐 Using stage dimensions: ${stageW}x${stageH} (heatmap: ${width}x${height})`
    );

    // Scan the entire heatmap with improved detection
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const color = getPixelColor(x, y, state.specialData);

        // More robust color matching with tolerance
        if (color && color.a > 100) {
          // Lowered alpha threshold for better detection
          const colorKey = JSON.stringify(color);

          // Check if this pixel matches any of our target colors
          for (const [targetColorKey, animName] of Object.entries(
            colorAnimationMap
          )) {
            const targetColor = JSON.parse(targetColorKey);

            // More flexible color matching with tolerance
            const colorMatch =
              Math.abs(color.r - targetColor.r) <= 5 && // 5-pixel tolerance
              Math.abs(color.g - targetColor.g) <= 5 &&
              Math.abs(color.b - targetColor.b) <= 5;

            if (colorMatch) {
              // Use smaller grouping (20x20) for more precise placement
              const blockSize = 20;
              const blockX = Math.floor(x / blockSize);
              const blockY = Math.floor(y / blockSize);
              const blockKey = `${blockX}_${blockY}`;

              // Check if we already have an animation in this block
              const existingAnim = detectedAnimations.find(
                (anim) => anim.blockKey === blockKey
              );

              if (!existingAnim) {
                // Calculate center position of the block
                const centerX = blockX * blockSize + blockSize / 2;
                const centerY = blockY * blockSize + blockSize / 2;

                detectedAnimations.push({
                  x: centerX,
                  y: centerY,
                  anim: animName,
                  blockKey: blockKey,
                  originalPixel: { x, y },
                  detectedColor: { ...color },
                });

                console.log(
                  `✅ Detected ${animName} at block (${blockX},${blockY}) center: (${centerX},${centerY}) original pixel: (${x},${y})`
                );
              } else {
                console.log(
                  `⚠️ Block (${blockX},${blockY}) already has ${existingAnim.anim}, skipping duplicate`
                );
              }
              break; // Found a match, no need to check other colors
            }
          }
        }
      }
    }

    console.log(
      `🎯 Found ${detectedAnimations.length} animation spawn points in special heatmap`
    );

    // Spawn animations at each detected position
    let spawnCount = 0;
    for (const animData of detectedAnimations) {
      const spawned = spawnStageAnimationFromHeatmap(state, animData.anim, {
        x: animData.x,
        y: animData.y,
      });
      if (spawned) {
        spawnCount++;
      }
    }

    console.log(
      `🚀 Successfully spawned ${spawnCount}/${detectedAnimations.length} animations`
    );

    // Mark as spawned to prevent duplicates
    state.stageAnimationsFromHeatmapSpawned = true;
  }
  // NEW: Spawn Dance Mode Spots from Heatmap (Supports both Legacy Special.png and New Zone.png)
  function spawnDanceSpotsFromHeatmap(state) {
    // 1. Try New System (Zone.png)
    if (state.zoneData) {
      console.log(
        "[Dance Mode] Found Zone.png, using new simplified detection system."
      );
      spawnDanceSpotsFromZone(state);
      return;
    }

    // 2. Fallback to Legacy System (Special.png)
    if (!state.specialData || !state.stageFxAtlas) {
      console.warn(
        "Cannot spawn dance spots: missing specialData or stageFxAtlas"
      );
      return;
    }

    const { width, height } = state.specialData;
    // Use camera_bounds dimensions if available (for scaled stages), otherwise use NATIVE dimensions
    const stageW =
      state.cameraBounds?.width ?? GameState.CONSTANTS.NATIVE_WIDTH;
    const stageH =
      state.cameraBounds?.height ?? GameState.CONSTANTS.NATIVE_HEIGHT;

    // Define dance spot colors - all use the same loop animation but different positions
    // NEW: Added generic red/orange support for easier testing
    const danceSpotColorMap = {
      [JSON.stringify(HEATMAP_COLORS.DANCE_SPOT_A)]: "dance_spot_loop",
      [JSON.stringify(HEATMAP_COLORS.DANCE_SPOT_B)]: "dance_spot_loop",
      [JSON.stringify(HEATMAP_COLORS.DANCE_SPOT_C)]: "dance_spot_loop",
      [JSON.stringify(HEATMAP_COLORS.DANCE_SPOT_D)]: "dance_spot_loop",
      [JSON.stringify(HEATMAP_COLORS.DANCE_SPOT_E)]: "dance_spot_loop",
      // Generic Red/Orange fallbacks
      '{"r":255,"g":0,"b":0,"a":255}': "dance_spot_loop", // Pure Red (often used by mistake)
      '{"r":255,"g":100,"b":0,"a":255}': "dance_spot_loop", // Generic Orange
    };

    console.log(
      `[Dance Mode] Scanning special heatmap for dance spots... (Width: ${width}, Height: ${height})`
    );

    const detectedSpots = [];
    const blockSize = 20;
    const tolerance = 5;

    // Scan heatmap for dance spot colors
    // NEW: CLUSTER DETECTION to prevent spamming animations
    // Instead of spawning per block, we group blocks into clusters
    const clusters = []; // Array of { colorKey, spotId, pixels: [{x,y}], minX, maxX, minY, maxY }

    for (let y = 0; y < height; y += blockSize) {
      for (let x = 0; x < width; x += blockSize) {
        // Sample center of block for better performance
        const color = getPixelColor(
          Math.min(x + blockSize / 2, width - 1),
          Math.min(y + blockSize / 2, height - 1),
          state.specialData
        );
        if (!color || color.a < 128) continue;

        for (const [targetColorKey, animName] of Object.entries(
          danceSpotColorMap
        )) {
          const targetColor = JSON.parse(targetColorKey);

          // Check if color matches (ignoring alpha for identification, but stored for later)
          const colorMatch =
            Math.abs(color.r - targetColor.r) <= tolerance &&
            Math.abs(color.g - targetColor.g) <= tolerance &&
            Math.abs(color.b - targetColor.b) <= tolerance;

          if (colorMatch) {
            // Found a matching block. Add to existing cluster or start new one.
            // Simple clustering: specific spot colors are usually far apart.
            // We group by colorKey AND proximity (distance < 200px)

            let foundCluster = null;
            for (const cluster of clusters) {
              if (cluster.colorKey === targetColorKey) {
                // Check distance to cluster bounds
                // If inside or close to bounds, add to it
                // Note: Heuristic distance for merging
                const distX = Math.max(0, x - cluster.maxX, cluster.minX - x);
                const distY = Math.max(0, y - cluster.maxY, cluster.minY - y);

                if (distX < 200 && distY < 200) {
                  foundCluster = cluster;
                  break;
                }
              }
            }

            if (foundCluster) {
              foundCluster.pixels.push({ x, y });
              foundCluster.minX = Math.min(foundCluster.minX, x);
              foundCluster.maxX = Math.max(foundCluster.maxX, x);
              foundCluster.minY = Math.min(foundCluster.minY, y);
              foundCluster.maxY = Math.max(foundCluster.maxY, y);
              foundCluster.count++;
            } else {
              // Identify Spot ID
              let spotId = "unknown";
              if (
                JSON.stringify(targetColor) ===
                JSON.stringify(HEATMAP_COLORS.DANCE_SPOT_A)
              )
                spotId = "a";
              else if (
                JSON.stringify(targetColor) ===
                JSON.stringify(HEATMAP_COLORS.DANCE_SPOT_B)
              )
                spotId = "b";
              else if (
                JSON.stringify(targetColor) ===
                JSON.stringify(HEATMAP_COLORS.DANCE_SPOT_C)
              )
                spotId = "c";
              else if (
                JSON.stringify(targetColor) ===
                JSON.stringify(HEATMAP_COLORS.DANCE_SPOT_D)
              )
                spotId = "d";
              else if (
                JSON.stringify(targetColor) ===
                JSON.stringify(HEATMAP_COLORS.DANCE_SPOT_E)
              )
                spotId = "e";
              // Fallback for generic red/orange
              else if (targetColor.r > 200 && targetColor.g < 50) spotId = "a";
              else if (targetColor.r > 200 && targetColor.g > 50) spotId = "d";

              clusters.push({
                colorKey: targetColorKey,
                spotId: spotId,
                animName: animName,
                pixels: [{ x, y }],
                minX: x,
                maxX: x,
                minY: y,
                maxY: y,
                count: 1,
                targetColor: targetColor,
              });
            }
            break; // Handled this block
          }
        }
      }
    }

    // Process Clusters into Single Spots
    for (const cluster of clusters) {
      // Calculate Center of Mass
      const centerX = (cluster.minX + cluster.maxX) / 2 + blockSize / 2;
      const centerY = (cluster.minY + cluster.maxY) / 2 + blockSize / 2;

      const worldX = (centerX / width) * stageW;
      const worldY = (centerY / height) * stageH;

      // Fallback logic for animation frame
      const framesForAnim =
        state.stageFxAtlas.animations[cluster.animName] || [];
      let firstFrameName = framesForAnim[0];
      let firstFrame = firstFrameName
        ? state.stageFxAtlas.frames[firstFrameName]
        : null;

      if (!firstFrame) {
        firstFrame = { frame: { w: 256, h: 256 } };
      }

      const baseFrameWidth = firstFrame?.frame?.w || 256;
      const baseFrameHeight = firstFrame?.frame?.h || 256;
      const renderScaleX = state.stageFxAtlas?.sourceScaleX || 1;
      const renderScaleY = state.stageFxAtlas?.sourceScaleY || 1;
      const renderWidth = baseFrameWidth * renderScaleX;
      const renderHeight = baseFrameHeight * renderScaleY;

      detectedSpots.push({
        blockKey: `${Math.floor(centerX)}_${Math.floor(centerY)}`,
        animName: cluster.animName,
        spotId: cluster.spotId,
        heatmapPos: { x: centerX, y: centerY },
        worldPos: { x: worldX, y: worldY },
        renderWidth,
        renderHeight,
        color: cluster.targetColor,
      });

      console.log(
        `[Dance Mode] Cluster detected (Size: ${cluster.count}) -> Spot ${
          cluster.spotId
        } at world(${worldX.toFixed(0)}, ${worldY.toFixed(0)})`
      );
    }

    console.log(`[Dance Mode] Found ${detectedSpots.length} dance spots`);

    // Validate minimum spots
    if (detectedSpots.length < 1) {
      console.warn(
        `[Dance Mode] Only ${detectedSpots.length} spots found (minimum 1 required)`
      );
      return;
    }

    // Spawn stage animations for each detected spot
    state.danceMode.availableSpots = [];
    for (const spotData of detectedSpots) {
      const frames = state.stageFxAtlas.animations[spotData.animName];
      if (!frames) {
        console.warn(
          `[Dance Mode] Animation ${spotData.animName} not found in stageFxAtlas`
        );
        continue;
      }

      // Get render size (accounts for upscaled atlas)
      const renderScaleX = state.stageFxAtlas?.sourceScaleX || 1;
      const renderScaleY = state.stageFxAtlas?.sourceScaleY || 1;
      const frameSize =
        spotData.renderWidth ??
        (state.stageFxAtlas.frames[frames[0]]?.frame?.w || 256) * renderScaleX;
      const frameHeight =
        spotData.renderHeight ??
        (state.stageFxAtlas.frames[frames[0]]?.frame?.h || 256) * renderScaleY;

      // Store spot data for position detection (don't spawn animation yet)
      state.danceMode.availableSpots.push({
        pos: { x: spotData.worldPos.x, y: spotData.worldPos.y },
        animName: spotData.animName, // Always "dance_spot" now
        spotId: spotData.spotId, // Original spot ID (a, b, c, d, e)
        size: frameSize,
        height: frameHeight,
        effect: null, // Will be set when this spot becomes active
      });
    }

    console.log(
      `[Dance Mode] Spawned ${state.danceMode.availableSpots.length} dance spots`
    );
  }

  // NEW: Simplified Zone.png scanner using blob detection
  function spawnDanceSpotsFromZone(state) {
    const { width, height } = state.zoneData;
    const stageW =
      state.cameraBounds?.width ?? GameState.CONSTANTS.NATIVE_WIDTH;
    const stageH =
      state.cameraBounds?.height ?? GameState.CONSTANTS.NATIVE_HEIGHT;

    // Validate heatmap dimensions match stage dimensions
    if (width !== stageW || height !== stageH) {
      console.warn(
        `[Dance Mode] Zone.png size mismatch! Heatmap: ${width}x${height}, Stage: ${stageW}x${stageH}. ` +
          `Zone heatmap must match stage dimensions exactly. Spots may be positioned incorrectly.`
      );
    } else {
      console.log(
        `[Dance Mode] Zone.png dimensions validated: ${width}x${height} matches stage ${stageW}x${stageH}`
      );
    }

    const visited = new Uint8Array(width * height);
    const spots = [];

    // Scan for blobs
    // Optimization: Scan every 5th pixel to find potential blobs, then flood fill
    for (let y = 0; y < height; y += 5) {
      for (let x = 0; x < width; x += 5) {
        const idx = y * width + x;
        if (visited[idx]) continue;

        const color = getPixelColor(x, y, state.zoneData);
        // Use simple alpha threshold for "is this a marker?"
        if (color.a > 128) {
          // Found a new blob! Flood fill to find extent
          const blob = {
            minX: x,
            maxX: x,
            minY: y,
            maxY: y,
            count: 0,
            pixels: [],
          };
          const stack = [[x, y]];
          visited[idx] = 1;

          while (stack.length > 0) {
            const [cx, cy] = stack.pop();
            blob.pixels.push({ x: cx, y: cy });
            blob.minX = Math.min(blob.minX, cx);
            blob.maxX = Math.max(blob.maxX, cx);
            blob.minY = Math.min(blob.minY, cy);
            blob.maxY = Math.max(blob.maxY, cy);
            blob.count++;

            // Check neighbors
            const neighbors = [
              [cx + 1, cy],
              [cx - 1, cy],
              [cx, cy + 1],
              [cx, cy - 1],
            ];

            for (const [nx, ny] of neighbors) {
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const nIdx = ny * width + nx;
                if (!visited[nIdx]) {
                  const nColor = getPixelColor(nx, ny, state.zoneData);
                  if (nColor.a > 128) {
                    visited[nIdx] = 1;
                    stack.push([nx, ny]);
                  }
                }
              }
            }
          }

          // Blob complete. Validate size.
          // User said "at least 10x10" which is 100 pixels area roughly.
          if (blob.count > 50) {
            // slightly lenient
            const centerX = (blob.minX + blob.maxX) / 2;
            const centerY = (blob.minY + blob.maxY) / 2;

            const worldX = (centerX / width) * stageW;
            const worldY = (centerY / height) * stageH;

            spots.push({
              pos: { x: worldX, y: worldY },
              animName: "dance_spot_loop", // All spots use generic loop
              spotId: `zone_${spots.length}`, // Generic ID
              size: 256, // Default size
              height: 256,
              effect: null,
            });

            console.log(
              `[Dance Mode] Zone spot ${
                spots.length
              }: Heatmap(${centerX.toFixed(1)}, ${centerY.toFixed(
                1
              )}) -> World(${worldX.toFixed(1)}, ${worldY.toFixed(1)})`
            );

            if (spots.length >= 5) break; // Max 5 spots
          }
        }
      }
      if (spots.length >= 5) break;
    }

    console.log(
      `[Dance Mode] Zone.png: Found ${spots.length} spots using blob detection. ` +
        `Heatmap: ${width}x${height}, Stage: ${stageW}x${stageH}`
    );
    state.danceMode.availableSpots = spots;
  }

  // NEW: Spawn Tutorial Dance Spots (only DANCE_SPOT_D color)
  function spawnTutorialDanceSpots(state) {
    if (!state.specialData || !state.stageFxAtlas) {
      console.warn(
        "[Tutorial] Cannot spawn dance spots: missing specialData or stageFxAtlas"
      );
      return;
    }

    const { width, height } = state.specialData;
    const stageW =
      state.cameraBounds?.width ?? GameState.CONSTANTS.NATIVE_WIDTH;
    const stageH =
      state.cameraBounds?.height ?? GameState.CONSTANTS.NATIVE_HEIGHT;

    console.log(
      "[Tutorial] Scanning special heatmap for tutorial dance spots (#FF641E)..."
    );

    const detectedSpots = [];
    const blockSize = 20;
    const tolerance = 5;
    const tutorialColor = HEATMAP_COLORS.DANCE_SPOT_D; // #FF641E

    // Scan heatmap for tutorial dance spot color
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const color = getPixelColor(x, y, state.specialData);
        if (!color || color.a < 128) continue;

        const colorMatch =
          Math.abs(color.r - tutorialColor.r) <= tolerance &&
          Math.abs(color.g - tutorialColor.g) <= tolerance &&
          Math.abs(color.b - tutorialColor.b) <= tolerance;

        if (colorMatch) {
          const blockX = Math.floor(x / blockSize);
          const blockY = Math.floor(y / blockSize);
          const blockKey = `${blockX}_${blockY}`;

          // Check if we already have a spot in this block
          const existingSpot = detectedSpots.find(
            (spot) => spot.blockKey === blockKey
          );

          if (!existingSpot) {
            const centerX = blockX * blockSize + blockSize / 2;
            const centerY = blockY * blockSize + blockSize / 2;
            const worldX = (centerX / width) * stageW;
            const worldY = (centerY / height) * stageH;

            const animName = "dance_spot_loop";
            const framesForAnim = state.stageFxAtlas.animations[animName] || [];
            const firstFrameName = framesForAnim[0];
            const firstFrame = firstFrameName
              ? state.stageFxAtlas.frames[firstFrameName]
              : null;
            const baseFrameWidth = firstFrame?.frame?.w || 256;
            const baseFrameHeight = firstFrame?.frame?.h || 256;
            const renderScaleX = state.stageFxAtlas?.sourceScaleX || 1;
            const renderScaleY = state.stageFxAtlas?.sourceScaleY || 1;
            const renderWidth = baseFrameWidth * renderScaleX;
            const renderHeight = baseFrameHeight * renderScaleY;

            detectedSpots.push({
              blockKey,
              animName,
              spotId: "tutorial",
              heatmapPos: { x: centerX, y: centerY },
              worldPos: { x: worldX, y: worldY },
              renderWidth,
              renderHeight,
            });

            console.log(
              `[Tutorial] Found dance spot at world(${worldX.toFixed(
                0
              )}, ${worldY.toFixed(0)})`
            );
          }
          break;
        }
      }
    }

    console.log(`[Tutorial] Found ${detectedSpots.length} dance spot(s)`);

    if (detectedSpots.length === 0) {
      console.warn(
        "[Tutorial] No dance spots found! Make sure to mark spots with #FF641E on special.png"
      );
      return;
    }

    // Spawn the first (or only) dance spot as active
    const firstSpot = detectedSpots[0];

    // Use the existing logic which centers based on heatmapPos and render size
    // Since we already calculated center of blob, we just center the image there
    const spotPos = {
      x: firstSpot.worldPos.x, // Already centered
      y: firstSpot.worldPos.y, // Already centered
    };

    const spotEffect = spawnStageAnimation(state, firstSpot.animName, spotPos, {
      scale: 1.0,
      isLooped: true,
      speed: 2.0, // Double speed for dance spot animations
      beatSync: true,
    });

    state.tutorial.danceSpotActive = true;
    state.tutorial.activeSpotPos = firstSpot.worldPos;
    state.tutorial.activeSpotSize = firstSpot.renderWidth;

    if (spotEffect) {
      console.log(
        `[Tutorial] Spawned active dance spot at (${firstSpot.worldPos.x.toFixed(
          0
        )}, ${firstSpot.worldPos.y.toFixed(0)})`
      );
    } else {
      console.warn(
        `[Tutorial] Stage animation '${firstSpot.animName}' missing; dance spot visual skipped but proximity logic remains active`
      );
    }
  }

  // NEW: Select Random Active Dance Spot
  function selectRandomActiveSpot(state) {
    const spots = state.danceMode.availableSpots;
    if (spots.length === 0) {
      console.warn("[Dance Mode] No spots available to select");
      return;
    }

    // DEBUG: Check for existing dance_spot_loop animations
    const existingDanceSpots = state.stageAnimations.filter(
      (anim) => anim.anim === "dance_spot_loop"
    );
    if (existingDanceSpots.length > 0) {
      console.log(
        `[Dance Mode] DEBUG: Found ${existingDanceSpots.length} existing dance_spot_loop animations, removing all`
      );
      // Remove ALL existing dance_spot_loop animations
      state.stageAnimations = state.stageAnimations.filter(
        (anim) => anim.anim !== "dance_spot_loop"
      );
    }

    // Remove previous active spot animation if it exists
    if (state.danceMode.currentActiveSpot?.effect) {
      const prevEffect = state.danceMode.currentActiveSpot.effect;
      const index = state.stageAnimations.indexOf(prevEffect);
      if (index !== -1) {
        state.stageAnimations.splice(index, 1);
        console.log(`[Dance Mode] Removed previous active spot animation`);
      }
    }

    // Exclude current spot to force movement (unless only 1 spot)
    // Compare by spotId to ensure we actually get a different spot
    const currentSpotId = state.danceMode.currentActiveSpot?.spotId;
    const eligibleSpots = spots.filter((s) => s.spotId !== currentSpotId);

    // Select from eligible spots
    if (eligibleSpots.length === 0) {
      // Only one spot or first selection (fallback to any spot)
      state.danceMode.currentActiveSpot =
        spots[Math.floor(Math.random() * spots.length)];
    } else {
      state.danceMode.currentActiveSpot =
        eligibleSpots[Math.floor(Math.random() * eligibleSpots.length)];
    }

    // Spawn animation for the newly selected active spot
    const activeSpot = state.danceMode.currentActiveSpot;

    // Ensure we spawn at the CENTER of the spot (which is what .pos represents now)
    const spotEffect = spawnStageAnimation(
      state,
      activeSpot.animName,
      {
        x: activeSpot.pos.x, // Already centered from Cluster logic
        y: activeSpot.pos.y, // Already centered from Cluster logic
      },
      {
        scale: 1.0,
        isLooped: true,
        speed: 2.0, // Double speed for dance spot animations
        beatSync: true,
        fpsMultiplier: 1,
        offsetX: 0, // Center alignment handled by renderer
        offsetY: 0, // Center alignment handled by renderer
      }
    );

    if (spotEffect) {
      // Link the effect to the spot
      activeSpot.effect = spotEffect;
      console.log(
        `[Dance Mode] Active spot: dance_spot_${
          activeSpot.spotId
        } at (${activeSpot.pos.x.toFixed(0)}, ${activeSpot.pos.y.toFixed(
          0
        )}) - Animation spawned`
      );
    } else {
      console.error(
        `[Dance Mode] Failed to spawn animation for ${activeSpot.animName}`
      );
    }
  }
  function setAnim(p, name, loop, state, speed = 1) {
    const charData = state.characterConfigs[p.charName];
    if (!charData) {
      console.error("Character data not found for:", p.charName);
      return;
    }

    // EDGE CASE: is_grabbed can override protected animations (grab is higher priority)
    // This ensures that when a player is grabbed, the is_grabbed animation always plays,
    // even if they were in a protected animation (dance, ultimate, walljump)
    const isGrabbedAnim = name === "is_grabbed";

    // If a dance animation is playing and not finished, do not allow non-dance animations to interrupt it
    // Exception: is_grabbed can override dance animations
    if (
      !isGrabbedAnim &&
      p.anim &&
      p.anim.includes("dance") &&
      !p.animFinished &&
      !(name && name.includes("dance"))
    ) {
      return;
    }

    // If walljump animation is playing, do not allow other animations to interrupt it
    // Exception: is_grabbed can override walljump animations
    if (!isGrabbedAnim && p.walljumpActive && name !== "walljump") {
      console.log(
        `🎬 Walljump animation protected from interruption by: ${name}`
      );
      return;
    }

    // Protect Fritz ultimate animations from being interrupted by generic state switches
    // Exception: is_grabbed can override ultimate animations
    if (
      !isGrabbedAnim &&
      p.charName === "fritz" &&
      p.ultiPhase &&
      (p.anim === "r2_l2_ulti" || p.anim === "r2_l2_ulti_start") &&
      name !== "r2_l2_ulti" &&
      name !== "r2_l2_ulti_start"
    ) {
      return;
    }

    // If requested animation is a dance, delegate to DanceCatalog so it's authoritative
    if (
      name &&
      name.includes("dance") &&
      window.DanceCatalog &&
      window.DanceCatalog.applyAnimation
    ) {
      const animFrames = charData.animations[name] || [];
      const animConfig = {
        frames: animFrames,
        loop: !!loop,
        fps: charData.fps || 12,
      };
      window.DanceCatalog.applyAnimation(p, animConfig, name);
      return;
    }

    // Simplified early-exit: if same animation and loop state, no change
    if (p.anim === name && p.loop === loop) return;

    // Log airborne animation changes
    debugLog("Setting airborne animation");

    // Log animation changes for Cyboard L2
    if (p.charName === "cyboard" && name.startsWith("l2_")) {
      debugLog(`Cyboard L2 animation: ${name}`);
    }

    // Log animation changes for Cyboard during ultimate (only on change)
    if (p.charName === "cyboard" && p.ultiPhase) {
      debugLog(`Cyboard ultimate animation: ${name}`);
    }

    p.anim = name;
    if (name === "wallslide_loop") {
      p._debugLastWallslideFrame = -1;
    } else if (p._debugLastWallslideFrame !== undefined) {
      delete p._debugLastWallslideFrame;
    }
    // Clear start log flag for new animation
    p._danceStartedLogged = false;

    // FIX: Clear dance segment limits and frame duration flags to prevent animation locking/loops
    // This ensures that switching from a dance animation (with segment limits) to a normal animation
    // (like grab_active) resets the frame progression logic.
    p._danceSegmentStart = undefined;
    p._danceSegmentEnd = undefined;
    p._danceSegmentJustCompleted = false;
    p._danceSegmentGracePeriod = undefined;
    p.useFrameDurations = false; // Default to false, AttackAnimationCatalog can override this

    // AttackAnimationCatalog override (per-frame durations/offsets like DanceCatalog)
    if (
      window.AttackAnimationCatalog &&
      typeof window.AttackAnimationCatalog.getAnimation === "function"
    ) {
      const attackAnim = window.AttackAnimationCatalog.getAnimation(
        p.charName,
        name,
        state
      );
      if (
        attackAnim &&
        Array.isArray(attackAnim.frames) &&
        attackAnim.frames.length > 0
      ) {
        p.frames = attackAnim.frames;
        p.loop = !!loop;
        p.useFrameDurations = !!attackAnim.useFrameDurations;
        // For frame-based durations, keep speed at 1; otherwise use provided speed
        if (!p.anim || !p.anim.includes("dance")) {
          p.animSpeed = p.useFrameDurations ? 1 : speed;
        }
      } else {
        p.frames = charData.animations[name] || [];
      }
    } else {
      p.frames = charData.animations[name] || [];
    }
    if (p.frames.length === 0) {
      console.error("Animation not found:", name, "for character:", p.charName);
      console.error("Available animations:", Object.keys(charData.animations));
      // Fallback auf idle Animation
      p.frames = charData.animations["idle"] || [];
      if (p.frames.length === 0) {
        console.error("No idle animation found for character:", p.charName);
        return;
      }
      p.anim = "idle"; // Korrigiere auch den Animation-Namen
      console.warn(`⚠️ Animation fallback: ${name} -> idle for ${p.charName}`);
    } else {
      if (state?.debug?.devMode) {
        console.log(
          `✅ Animation loaded: ${name} (${p.frames.length} frames) for ${p.charName}`
        );
      }
      // Debug: Log successful animation loading
      if (name === "dance_e") {
        if (state?.debug?.devMode) {
          console.log(
            `[DEBUG] Successfully loaded dance_e animation for ${p.charName}:`,
            p.frames.length,
            "frames"
          );
        }
      }
    }
    p.loop = !!loop;
    p.frameIndex = 0;
    p.frameTime = 0;
    p.animFinished = false;
    // Do not overwrite animSpeed for dance animations (handled by DanceCatalog)
    // If frame-specific durations are active, keep speed at 1 to make timing independent of setAnim speed
    if (!p.anim || !p.anim.includes("dance")) {
      if (!p.useFrameDurations) {
        p.animSpeed = speed;
      }
    }

    // Debug: Log loop setting for dance_e
    if (name === "dance_e") {
      console.log(
        `[DEBUG] setAnim: dance_e loop=${p.loop}, frameIndex=${p.frameIndex}, frames=${p.frames.length}`
      );
    }
    p.loopStart = undefined;
    p.loopEnd = undefined;
  }
  function advanceAnim(dt, p, state) {
    // Debug: Log advanceAnim calls for dance animations (only once per start)
    if (
      p.anim &&
      p.anim.includes("dance") &&
      p.frameIndex === 0 &&
      !p._danceStartedLogged
    ) {
      if (state?.debug?.devMode) {
        console.log(
          `[Physics] Starting dance animation for P${p.padIndex}: ${p.anim}`
        );
      }
      p._danceStartedLogged = true;
    }

    const charData = state.characterConfigs[p.charName];
    if (!charData) {
      console.error("Character data not found for:", p.charName);
      return;
    }
    let fps = charData.fps || 12; // Default FPS

    // Check if current frame has specific FPS setting
    const currentFrameData = p.frames[p.frameIndex];
    if (typeof currentFrameData === "object" && currentFrameData.fps) {
      fps = currentFrameData.fps;
    }

    // Advance frame time accumulator BEFORE any duration checks
    p.frameTime = (p.frameTime || 0) + dt;

    // Special handling for animations with frame-specific durations (like HP perfect beatmatch dance)
    if (
      p.useFrameDurations &&
      typeof currentFrameData === "object" &&
      currentFrameData.d
    ) {
      // Use frame-specific duration multiplier: interpret `d` as multiplier of base frame duration
      const baseFps = charData.fps || 12;
      const baseFrameDur = 1 / baseFps;
      const frameDur =
        ((currentFrameData.d || 1) * baseFrameDur) / (p.animSpeed || 1);

      if (p.frameTime >= frameDur) {
        p.frameTime -= frameDur;

        const loopStart = p.loopStart ?? 0;
        const loopEnd = p.loopEnd ?? p.frames.length - 1;

        // Check if we're in a dance segment with limits
        const segmentEnd =
          p._danceSegmentEnd !== undefined ? p._danceSegmentEnd : loopEnd;
        // If segmentEnd is exclusive (dance segments), stop before segmentEnd - 1.
        // Otherwise (normal loops), allow progression up to loopEnd.
        const maxFrameInSegment =
          segmentEnd !== loopEnd
            ? Math.max(segmentEnd - 1, loopStart)
            : loopEnd;
        const maxFrameAllowed = maxFrameInSegment;

        if (p.frameIndex < maxFrameAllowed && p.frameIndex < loopEnd) {
          const oldFrameIndex = p.frameIndex;
          p.frameIndex++;
          const currentFrame = p.frames[p.frameIndex];
          const frameName =
            typeof currentFrame === "object"
              ? currentFrame.frame
              : currentFrame;

          if (p.anim === "wallslide_loop") {
            const hasLoggedFrame =
              p._debugLastWallslideFrame === p.frameIndex &&
              p._debugLastWallslideFrameName === frameName;
            if (!hasLoggedFrame) {
              console.log(
                `[Wallslide Anim][dur] ${p.charName} frame=${frameName} index=${
                  p.frameIndex
                }/${p.frames.length - 1} time=${p.frameTime.toFixed(
                  3
                )}s dur=${frameDur.toFixed(3)}s speed=${p.animSpeed || 1}`
              );
              p._debugLastWallslideFrame = p.frameIndex;
              p._debugLastWallslideFrameName = frameName;
            }
          }

          // Debug: Log frame advancement for frame-specific durations
          if (p.anim && p.anim.includes("dance")) {
            const segmentInfo =
              p._danceSegmentStart !== undefined
                ? ` [segment ${p._danceSegmentStart}-${p._danceSegmentEnd - 1}]`
                : "";
            console.log(
              `[Dance Frame] P${p.anim?.match(/P(\d+)/)?.[1] || "?"} ${
                p.anim || "unknown"
              } → Frame ${p.frameIndex}/${
                p.frames.length - 1
              }: "${frameName}"${segmentInfo} (dur: ${
                currentFrameData.d
              }, time: ${p.frameTime.toFixed(3)}s)`
            );
          }
        } else if (
          p.frameIndex >= maxFrameAllowed &&
          p._danceSegmentEnd !== undefined &&
          segmentEnd !== loopEnd
        ) {
          // Reached end of segment - immediately return to normal cycle (idle/run)
          if (p.anim && p.anim.includes("dance")) {
            console.log(
              `[Dance Frame] P${p.padIndex} ${p.anim || "unknown"} ✅ Segment ${
                p._danceSegmentStart
              }-${maxFrameInSegment} complete → returning to normal animation until next beat`
            );
          }
          p.animFinished = true;
          // Set grace period flag to prevent immediate MISS after segment completion
          p._danceSegmentJustCompleted = true;
          p._danceSegmentGracePeriod = 0.5; // 0.5 seconds grace period
          // Return to run if moving fast, otherwise idle (do NOT reset beatBarProgress here)
          if (
            !(p.attack && p.attack.type !== "none") &&
            !(p.stunT > 0) &&
            !p.ultiPhase &&
            !(p.roll && p.roll.active)
          ) {
            if (Math.abs(p.vel.x) > 30) {
              setAnim(p, "run", true, state, 1);
            } else {
              setAnim(p, "idle", true, state, 1);
            }
          }
          return; // Stop further advancement this frame
        } else if (p.loop) {
          p.frameIndex = loopStart;
          const currentFrame = p.frames[p.frameIndex];
          const frameName =
            typeof currentFrame === "object"
              ? currentFrame.frame
              : currentFrame;
          if (p.anim && p.anim.includes("dance")) {
            console.log(
              `[Dance Frame] P${p.anim?.match(/P(\d+)/)?.[1] || "?"} ${
                p.anim || "unknown"
              } 🔄 Looped to frame ${p.frameIndex}: "${frameName}"`
            );
          }
        } else {
          p.animFinished = true;
          if (p.anim && p.anim.includes("dance")) {
            console.log(
              `[Dance Frame] P${p.anim?.match(/P(\d+)/)?.[1] || "?"} ${
                p.anim || "unknown"
              } ⏹️ Animation finished (played ${
                p.frames.length
              } frames) - returning to normal animation`
            );

            // Always return to normal animation when dance animation finishes
            // Try to auto-return based on movement if safe (no attack, not stunned, not in ulti, not rolling)
            if (
              !(p.attack && p.attack.type !== "none") &&
              !(p.stunT > 0) &&
              !p.ultiPhase &&
              !(p.roll && p.roll.active)
            ) {
              // Return to run if moving fast, otherwise idle
              if (Math.abs(p.vel.x) > 30) {
                setAnim(p, "run", true, state, 1);
              } else {
                setAnim(p, "idle", true, state, 1);
              }
            }
          }
        }
        return; // Skip the normal FPS-based calculation
      }
      return; // Skip the normal FPS-based calculation
    }

    // NOTE: frameTime already advanced above for both frame-specific and FPS-based paths
    if (!p.frames || p.frames.length === 0) {
      console.error(
        "No frames available for animation:",
        name,
        "char:",
        p.charName
      );
      return;
    }

    const durationMultiplier =
      typeof currentFrameData === "object" ? currentFrameData.d || 1 : 1;

    const frameDur = (1 / (fps * (p.animSpeed || 1))) * durationMultiplier;

    // Debug logging for run animation FPS comparison
    if (p.anim === "run" && state?.debug?.devMode && Math.random() < 0.01) {
      // Log occasionally (1% chance per frame) to avoid spam
      console.log(
        `[Run Animation Debug] ${p.charName}: fps=${fps}, animSpeed=${
          p.animSpeed || 1
        }, ` +
          `effectiveFPS=${(fps * (p.animSpeed || 1)).toFixed(
            2
          )}, frameDur=${frameDur.toFixed(4)}s, ` +
          `frameIndex=${p.frameIndex}/${p.frames.length}`
      );
    }

    if (p.frameTime >= frameDur) {
      p.frameTime -= frameDur;

      const loopStart = p.loopStart ?? 0;
      const loopEnd = p.loopEnd ?? p.frames.length - 1;

      // Check if we're in a dance segment with limits
      const segmentEnd =
        p._danceSegmentEnd !== undefined ? p._danceSegmentEnd : loopEnd;
      const maxFrameInSegment =
        segmentEnd !== loopEnd ? Math.max(segmentEnd - 1, loopStart) : loopEnd;
      const maxFrameAllowed = maxFrameInSegment;

      if (p.frameIndex < maxFrameAllowed && p.frameIndex < loopEnd) {
        const oldFrameIndex = p.frameIndex;
        p.frameIndex++;
        const currentFrame = p.frames[p.frameIndex];
        const frameName =
          typeof currentFrame === "object" ? currentFrame.frame : currentFrame;

        if (p.anim === "wallslide_loop") {
          const hasLoggedFrame =
            p._debugLastWallslideFrame === p.frameIndex &&
            p._debugLastWallslideFrameName === frameName;
          if (!hasLoggedFrame) {
            console.log(
              `[Wallslide Anim][fps] ${p.charName} frame=${frameName} index=${
                p.frameIndex
              }/${p.frames.length - 1} time=${p.frameTime.toFixed(
                3
              )}s dur=${frameDur.toFixed(3)}s speed=${p.animSpeed || 1}`
            );
            p._debugLastWallslideFrame = p.frameIndex;
            p._debugLastWallslideFrameName = frameName;
          }
        }

        // Debug: Log frame advancement for dance animations
        if (p.anim && p.anim.includes("dance")) {
          const segmentInfo =
            p._danceSegmentStart !== undefined
              ? ` [segment ${p._danceSegmentStart}-${p._danceSegmentEnd - 1}]`
              : "";
          console.log(
            `[Dance Frame] P${p.padIndex} ${p.anim || "unknown"} → Frame ${
              p.frameIndex
            }/${
              p.frames.length - 1
            }: "${frameName}"${segmentInfo} (FPS: ${fps}, speed: ${
              p.animSpeed || 1
            })`
          );
        }
      } else if (
        p.frameIndex >= maxFrameAllowed &&
        p._danceSegmentEnd !== undefined &&
        segmentEnd !== loopEnd
      ) {
        // Reached end of segment - immediately return to normal cycle (idle/run)
        if (p.anim && p.anim.includes("dance")) {
          console.log(
            `[Dance Frame] P${p.padIndex} ${p.anim || "unknown"} ✅ Segment ${
              p._danceSegmentStart
            }-${maxFrameInSegment} complete → returning to normal animation until next beat`
          );
        }
        p.animFinished = true;
        if (
          !(p.attack && p.attack.type !== "none") &&
          !(p.stunT > 0) &&
          !p.ultiPhase &&
          !(p.roll && p.roll.active)
        ) {
          if (Math.abs(p.vel.x) > 30) {
            setAnim(p, "run", true, state, 1);
          } else {
            setAnim(p, "idle", true, state, 1);
          }
        }
        return;
      } else if (p.loop) {
        if (
          p.anim === "l1_charge_loop" &&
          p.attack?.type === "l1" &&
          p.attack?.phase === "charge"
        ) {
          p.frameIndex = loopStart;
          p.animFinished = false;
        } else {
          p.frameIndex = loopStart;
          const currentFrame = p.frames[p.frameIndex];
          const frameName =
            typeof currentFrame === "object"
              ? currentFrame.frame
              : currentFrame;

          // Debug: Log loop restart for dance animations
          if (p.anim && p.anim.includes("dance")) {
            console.log(
              `[Dance Frame] P${p.padIndex} ${
                p.anim || "unknown"
              } 🔄 Looped to frame ${p.frameIndex}: "${frameName}"`
            );
          }
        }
      } else {
        p.animFinished = true;
        // Debug: Log animation finish for dance animations
        if (p.anim && p.anim.includes("dance")) {
          console.log(
            `[Dance Frame] P${p.padIndex} ${
              p.anim || "unknown"
            } ⏹️ Animation finished (played ${
              p.frames.length
            } frames total) - returning to normal animation`
          );

          // Always return to normal animation when dance animation finishes
          // Try to auto-return based on movement if safe (no attack, not stunned, not in ulti, not rolling)
          if (
            !(p.attack && p.attack.type !== "none") &&
            !(p.stunT > 0) &&
            !p.ultiPhase &&
            !(p.roll && p.roll.active)
          ) {
            // Return to run if moving fast, otherwise idle
            if (Math.abs(p.vel.x) > 30) {
              setAnim(p, "run", true, state, 1);
            } else {
              setAnim(p, "idle", true, state, 1);
            }
          }
        }

        // Log when Cyboard ultimate animations finish
        if (
          p.charName === "cyboard" &&
          p.ultiPhase &&
          (p.anim === "r2_l2_ulti_start" || p.anim === "r2_l2_ulti_finish")
        ) {
        }
      }
    }
  }

  function createPlayer(state, charName, spawnPos, index) {
    const charData = state.characterConfigs[charName];

    // NEW: Use CharacterCatalog as single source of truth
    const characterData = CharacterCatalog.getCharacterData(charName, state);
    const cooldownConfig = CharacterCatalog.getCooldownConfig(charName, state);
    const animationConfig = CharacterCatalog.getAnimationConfig(
      charName,
      state
    );
    const moveConfig = CharacterCatalog.getMoveConfig(charName, state);

    const p = {
      charName: charName,

      // NEW: CharacterCatalog-based config
      config: {
        physics: characterData.physics,
        getAttackDescriptor: characterData.attackDescriptor,
        cooldowns: cooldownConfig,
        animations: animationConfig,
        moves: moveConfig,
      },

      // Backward compatibility - keep old config for gradual migration
      oldConfig: charData?.config || {},

      anim: "idle",
      animSpeed: 1,
      frames: animationConfig.animations["idle"] || [],
      frameIndex: 0,
      frameTime: 0,
      chargeFx: null,
      pos: { ...spawnPos },
      vel: { x: 0, y: 0 },
      grounded: true,
      jumpsLeft: 2,
      r1JumpAttackCanReuse: true, // R1 Jump Attack can be used (reset on landing/wallslide)
      lives: 3, // 3 Leben pro Spieler
      eliminated: false, // Wird true bei 0 Leben
      respawnState: "none", // 'none', 'respawn', 'invincible'
      respawnTimer: 0, // Timer für Respawn-Animation
      respawnInvincibilityTimer: 2.0, // Timer für Invincibility nach Spawn (2 seconds initial grace)
      isInvincible: true, // Spawn-Kill-Schutz - start with invincibility
      isMovable: true, // Kann sich bewegen
      percent: 0,
      facing: 1,
      padIndex: index,
      swordIsOut: false, // For Cyboard's R2 combo projectile
      isGrabbed: false,
      hitlagTimer: 0,
      queuedKnockback: null,
      ultimeter: {
        current: 0, // Aktueller Wert (0-100)
        max: 100, // Maximaler Wert
        isReady: false, // Kann Ultimate ausgelöst werden?
        lastGainTime: 0, // Zeitpunkt der letzten Aufladung
        gainRate: 1.0, // Multiplikator für Aufladung
      },
      danceCooldown: 0, // Cooldown für Dance-Moves
      musicNotes: 3, // Musiknoten für Dance-System (Start: 3, Max: 3)
      consecutivePerfects: 0, // Zähler für aufeinanderfolgende Perfect-Beatmatches
      // NEW: Bar-based dance tracking
      beatBarProgress: 0, // 0-4 perfects within current bar
      perfectBarStreak: 0, // number of perfect bars in a row
      danceVariationLevel: 1, // 1..3 which 16-frame set to use
      danceBattle: {
        frozen: false,
        reFreezeQueued: false,
      },
      // Shield removed - replaced by Dance Battle system
      // NEW: Ability Cooldowns - Use CharacterCatalog
      cooldowns: {
        r1: cooldownConfig.r1,
        r2: cooldownConfig.r2,
        l1: cooldownConfig.l1,
        l2: cooldownConfig.l2,
        ultimate: 0, // Start with ultimate available once meter fills
        roll: cooldownConfig.roll,
        shield: cooldownConfig.shield,
        doubleJump: 0, // Double jump available at start
      },
    };
    p.pos.y = findGroundYBelow(
      p.pos.x,
      p.pos.y,
      state.groundData,
      p.pos.y,
      state.cameraBounds
    );
    return p;
  }
  function respawnPlayer(state, p, canvas) {
    debugLog(
      `?? [RESPAWN] P${p.padIndex + 1} (${p.charName}) respawning: ` +
        `Lives before: ${p.lives}, Pos: (${p.pos.x.toFixed(
          0
        )}, ${p.pos.y.toFixed(0)})`
    );

    // Analytics: Track player death
    if (window.AnalyticsClient && p.lives > 0) {
      // Only track if player has lives left (actual death, not elimination)
      window.AnalyticsClient.trackEvent("player_death", {
        playerIndex: p.padIndex,
        character: p.charName,
        livesRemaining: p.lives - 1,
        percent: p.percent || 0,
      });
    }

    // Dance Mode: Skip life reduction (infinite lives)
    if (state.selectedGameMode === "dance") {
      const sp = state.spawnPoints?.[p.padIndex] ?? {
        x: canvas.width * (p.padIndex === 0 ? 0.25 : 0.75),
        y: canvas.height * 0.5,
      };
      p.pos.x = sp.x;
      p.pos.y = findGroundYBelow(
        sp.x,
        sp.y,
        state.groundData,
        sp.y,
        state.cameraBounds
      );
      p.vel.x = 0;
      p.vel.y = 0;
      p.grounded = true;
      p.jumpsLeft = 2;
      p.attack = { type: "none", phase: "none" };
      p.roll = { active: false, t: 0 };
      // Reset R1 Jump Attack cooldown on landing
      p.r1JumpAttackCanReuse = true;
      p.percent = 0;
      p.airTime = 0;
      p.chargeFx = null;
      p.swordIsOut = false;
      p.isGrabbed = false;
      p.decelerate = false;
      p.hitlagTimer = 0;
      p.queuedKnockback = null;

      // Respawn animation
      p.respawnState = "respawn";
      p.isInvincible = true;
      p.isMovable = false;
      p.respawnTimer = 1.0;
      p.respawnInvincibilityTimer = 3.0;

      const charData = state.characterConfigs[p.charName];
      if (charData && charData.animations && charData.animations["respawn"]) {
        setAnim(p, "respawn", true, state);
      } else {
        setAnim(p, "idle", true, state);
      }

      p.danceCooldown = 0;
      p.musicNotes = 3;

      console.log(
        `[Dance Mode] P${p.padIndex + 1} respawned without life reduction`
      );
      return; // Exit early - skip normal life reduction
    }

    // Leben reduzieren
    p.lives = Math.max(0, p.lives - 1);

    // Bei 0 Leben: Elimination
    if (p.lives === 0) {
      debugLog(
        `?? [ELIMINATION] P${p.padIndex + 1} (${
          p.charName
        }) ELIMINATED! No lives left.`
      );
      p.eliminated = true;
      p.eliminated = true;

      // Analytics: Track player elimination
      if (window.AnalyticsClient) {
        window.AnalyticsClient.trackEvent("player_elimination", {
          playerIndex: p.padIndex,
          character: p.charName,
          percent: p.percent || 0,
        });
      }

      // NEW: Track enemy defeat in tutorial
      if (window.TutorialSystem && state.tutorial?.active) {
        window.TutorialSystem.trackPlayerDeath(state, p);
      }

      // NEW: End dance battle if active (not enough players with lives)
      if (state.danceBattle.active) {
        endDanceBattle(state);
      }

      // NEW: Check if match should end (one player eliminated)
      checkMatchEnd(state);
      return;
    }
    const sp = state.spawnPoints?.[p.padIndex] ?? {
      x: canvas.width * (p.padIndex === 0 ? 0.25 : 0.75),
      y: canvas.height * 0.5,
    };
    p.pos.x = sp.x;
    p.pos.y = findGroundYBelow(sp.x, sp.y, state.groundData);
    p.vel.x = 0;
    p.vel.y = 0;
    p.grounded = true;
    p.jumpsLeft = 2;
    p.attack = { type: "none", phase: "none" };
    p.roll = { active: false, t: 0 };
    // Reset R1 Jump Attack cooldown on landing
    p.r1JumpAttackCanReuse = true;
    p.percent = 0;
    p.airTime = 0;
    p.chargeFx = null;
    p.swordIsOut = false;
    p.isGrabbed = false;
    p.decelerate = false;
    p.hitlagTimer = 0;
    p.queuedKnockback = null;

    // Respawn-Animation starten
    p.respawnState = "respawn";
    p.isInvincible = true; // Spawn-Kill-Schutz
    p.isMovable = false; // Nicht beweglich während Respawn
    p.respawnTimer = 1.0; // 1 Sekunde Respawn-Animation (verkürzt)
    p.respawnInvincibilityTimer = 3.0; // 3 Sekunden Invincibility nach Respawn

    // Respawn-Animation abspielen (falls vorhanden) - im Loop
    const charData = state.characterConfigs[p.charName];
    if (charData && charData.animations && charData.animations["respawn"]) {
      setAnim(p, "respawn", true, state); // true = Loop
    } else {
      // Fallback: Idle-Animation
      setAnim(p, "idle", true, state); // true = Loop
    }
    p.ultimeter = {
      current: 0,
      max: 100,
      isReady: false,
      lastGainTime: 0,
      gainRate: 1.0,
    };
    p.danceCooldown = 0;
    p.musicNotes = 3; // Reset music notes on respawn
    // Reset bar-based dance tracking
    p.beatBarProgress = 0;
    p.perfectBarStreak = 0;
    p.danceVariationLevel = 1;

    // NEW: Reset death audio effects on respawn
    if (window.AudioSystem && window.AudioSystem.resetDeathEffects) {
      window.AudioSystem.resetDeathEffects();
    }

    // NEW: Reset cooldowns on respawn (all back on cooldown)
    p.cooldowns = {
      r1: state.cooldownConfig.r1,
      r2: state.cooldownConfig.r2,
      l1: state.cooldownConfig.l1,
      l2: state.cooldownConfig.l2,
      ultimate: state.cooldownConfig.ultimate,
      roll: state.cooldownConfig.roll,
      shield: state.cooldownConfig.shield,
      doubleJump: 0,
    };
    setAnim(p, "idle", true, state);
  }
  function findGroundYBelow(
    x,
    startY,
    data,
    scanStart = startY,
    cameraBounds = null
  ) {
    if (!data) return Infinity;

    // Scale world coordinates to heatmap coordinates if camera bounds provided
    let heatmapX, heatmapStartY, heatmapScanStart;
    if (cameraBounds) {
      const coords = scaleToHeatmap(x, startY, data, cameraBounds);
      heatmapX = coords.x;
      heatmapStartY = coords.y;
      const scanCoords = scaleToHeatmap(x, scanStart, data, cameraBounds);
      heatmapScanStart = scanCoords.y;
    } else {
      heatmapX = x | 0;
      heatmapStartY = startY | 0;
      heatmapScanStart = scanStart | 0;
    }

    const clampX = Math.max(0, Math.min(data.width - 1, heatmapX));
    for (let y = Math.max(0, heatmapScanStart); y < data.height; y++) {
      if (data.data[(y * data.width + clampX) * 4 + 3] > 0) {
        // Found ground - convert back to world coordinates
        if (cameraBounds) {
          const stageHeight =
            cameraBounds.height ?? GameState.CONSTANTS.NATIVE_HEIGHT;
          const stageY = cameraBounds.y ?? 0;
          const scaleY = stageHeight / data.height;
          return (y - 1) * scaleY + stageY;
        }
        return y - 1;
      }
    }
    return Infinity;
  }
  function rectsIntersect(a, b) {
    return (
      a.left < b.left + b.w &&
      a.left + a.w > b.left &&
      a.top < b.top + b.h &&
      a.top + a.h > b.top
    );
  }

  function getPixelColor(x, y, imageData, cameraBounds = null) {
    if (!imageData) return null;

    // Scale coordinates if camera bounds provided (scaled stages)
    let pixelX, pixelY;
    if (cameraBounds) {
      const coords = scaleToHeatmap(x, y, imageData, cameraBounds);
      pixelX = coords.x;
      pixelY = coords.y;
    } else {
      pixelX = Math.floor(x);
      pixelY = Math.floor(y);
    }

    // Clamp to valid range
    pixelX = Math.max(0, Math.min(imageData.width - 1, pixelX));
    pixelY = Math.max(0, Math.min(imageData.height - 1, pixelY));

    const index = (pixelY * imageData.width + pixelX) * 4;
    return {
      r: imageData.data[index],
      g: imageData.data[index + 1],
      b: imageData.data[index + 2],
      a: imageData.data[index + 3],
    };
  }

  // Wrapper function that automatically uses state.cameraBounds
  function getPixelColorScaled(x, y, imageData, state) {
    return getPixelColor(x, y, imageData, state?.cameraBounds ?? null);
  }

  function colorsMatch(color1, color2, tolerance = 5) {
    if (!color1 || !color2) return false;
    return (
      Math.abs(color1.r - color2.r) <= tolerance &&
      Math.abs(color1.g - color2.g) <= tolerance &&
      Math.abs(color1.b - color2.b) <= tolerance
    );
  }

  function isPlayerOnSemisolid(player, state) {
    if (!state.semisolidData || !player.grounded) return false;

    const hb = Renderer.getHurtbox(player);
    const feetX = player.pos.x;
    const feetY = player.pos.y + hb.h / 2; // Bottom of hurtbox

    // Check if player is standing on semisolid platform (with scaling for larger stages)
    return isPixelSolidScaled(feetX, feetY + 1, state.semisolidData, state);
  }
  function resolvePlayerCollisions(dt, state) {
    const players = state.players.filter((p) => !p.eliminated && p.isMovable);

    // Only process if we have at least 2 players
    if (players.length < 2) return;

    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const p1 = players[i];
        const p2 = players[j];

        // Skip if either player is in special states that shouldn't collide
        if (p1.isGrabbed || p2.isGrabbed || p1.invincible || p2.invincible) {
          continue;
        }

        // Check if either player is being pushed through semisolid by collision
        const p1OnSemisolid = isPlayerOnSemisolid(p1, state);
        const p2OnSemisolid = isPlayerOnSemisolid(p2, state);

        // If collision would push a player through semisolid, activate drop-through
        if (p1OnSemisolid && !p1.dropThroughTimer) {
          p1.dropThroughTimer = 0.1; // Brief drop-through to prevent getting stuck
        }
        if (p2OnSemisolid && !p2.dropThroughTimer) {
          p2.dropThroughTimer = 0.1; // Brief drop-through to prevent getting stuck
        }

        const hb1 = Renderer.getHurtbox(p1);
        const hb2 = Renderer.getHurtbox(p2);

        if (rectsIntersect(hb1, hb2)) {
          // Calculate overlap amounts
          const overlapX = Math.min(
            hb1.left + hb1.w - hb2.left,
            hb2.left + hb2.w - hb1.left
          );
          const overlapY = Math.min(
            hb1.top + hb1.h - hb2.top,
            hb2.top + hb2.h - hb1.top
          );

          // Ensure we have valid overlap values
          if (overlapX <= 0 || overlapY <= 0) continue;

          // ANTI-STACKING: If players are stacked vertically, reduce downward velocity
          if (overlapY > overlapX && Math.abs(p1.pos.x - p2.pos.x) < 50) {
            // Players are stacked vertically, reduce downward velocity to prevent acceleration
            if (p1.vel.y > 0 && p2.vel.y > 0) {
              // Both falling, reduce velocity of the one below
              if (p1.pos.y > p2.pos.y) {
                p1.vel.y *= 0.5; // Reduce velocity of player below
              } else {
                p2.vel.y *= 0.5; // Reduce velocity of player below
              }
            }
          }

          if (overlapX < overlapY) {
            // Horizontal separation (preferred for ground collision)
            const separation = Math.min(overlapX / 2, 10); // Cap separation to prevent teleporting

            // PREVENTIVE WALL COLLISION: Check if separation would cause wall collision
            let p1NewX, p2NewX;
            if (p1.pos.x < p2.pos.x) {
              p1NewX = p1.pos.x - separation;
              p2NewX = p2.pos.x + separation;
            } else {
              p1NewX = p1.pos.x + separation;
              p2NewX = p2.pos.x - separation;
            }

            // Check if new positions would cause wall collision
            if (state.groundData) {
              const p1Hb = Renderer.getHurtbox(p1);
              const p2Hb = Renderer.getHurtbox(p2);

              // Check if p1 would be pushed through wall
              let p1SafeX = p1NewX;
              const p1CheckX =
                p1NewX > p1.pos.x ? p1Hb.left + p1Hb.w : p1Hb.left;
              const p1CheckY = p1Hb.top + p1Hb.h / 2;
              if (
                isPixelSolidScaled(p1CheckX, p1CheckY, state.groundData, state)
              ) {
                p1SafeX = p1.pos.x; // Keep original position
              }

              // Check if p2 would be pushed through wall
              let p2SafeX = p2NewX;
              const p2CheckX =
                p2NewX > p2.pos.x ? p2Hb.left + p2Hb.w : p2Hb.left;
              const p2CheckY = p2Hb.top + p2Hb.h / 2;
              if (
                isPixelSolidScaled(p2CheckX, p2CheckY, state.groundData, state)
              ) {
                p2SafeX = p2.pos.x; // Keep original position
              }

              // Apply safe positions
              p1.pos.x = p1SafeX;
              p2.pos.x = p2SafeX;
            } else {
              // No ground data, apply separation normally
              p1.pos.x = p1NewX;
              p2.pos.x = p2NewX;
            }
          } else {
            // Vertical separation (only if both players are grounded)
            if (!isAirborne(p1) && !isAirborne(p2)) {
              const separation = Math.min(overlapY / 2, 10); // Cap separation to prevent teleporting

              // PREVENTIVE GROUND COLLISION: Check if separation would cause ground collision
              let p1NewY, p2NewY;
              if (p1.pos.y < p2.pos.y) {
                p1NewY = p1.pos.y - separation;
                p2NewY = p2.pos.y + separation;
              } else {
                p1NewY = p1.pos.y + separation;
                p2NewY = p2.pos.y - separation;
              }

              // Check if new positions would cause ground collision
              if (state.groundData) {
                const p1Hb = Renderer.getHurtbox(p1);
                const p2Hb = Renderer.getHurtbox(p2);

                // Check if p1 would be pushed through ground
                let p1SafeY = p1NewY;
                const p1GroundY = findGroundYBelow(
                  p1.pos.x,
                  p1NewY,
                  state.groundData
                );
                if (p1GroundY !== Infinity && p1NewY > p1GroundY) {
                  p1SafeY = p1GroundY;
                }

                // Check if p2 would be pushed through ground
                let p2SafeY = p2NewY;
                const p2GroundY = findGroundYBelow(
                  p2.pos.x,
                  p2NewY,
                  state.groundData
                );
                if (p2GroundY !== Infinity && p2NewY > p2GroundY) {
                  p2SafeY = p2GroundY;
                }

                // Apply safe positions
                p1.pos.y = p1SafeY;
                p2.pos.y = p2SafeY;
              } else {
                // No ground data, apply separation normally
                p1.pos.y = p1NewY;
                p2.pos.y = p2NewY;
              }
            }
            // TODO: Future air collision - could add horizontal separation for airborne players
            // else if (isAirborne(p1) || isAirborne(p2)) {
            //   // Air collision: only horizontal separation to prevent mid-air stacking
            //   const separation = Math.min(overlapX / 2, 8);
            //   if (p1.pos.x < p2.pos.x) {
            //     p1.pos.x -= separation;
            //     p2.pos.x += separation;
            //   } else {
            //     p1.pos.x += separation;
            //     p2.pos.x -= separation;
            //   }
            // }
          }
        }
      }
    }
  }

  // Color constants for heatmap effects
  const HEATMAP_COLORS = {
    // Ground types
    BLACK: { r: 0, g: 0, b: 0 }, // Standard ground
    DARK_GRAY: { r: 64, g: 64, b: 64 }, // Walls
    LIGHT_GRAY: { r: 192, g: 192, b: 192 }, // Ceilings

    // Effect types
    CYAN: { r: 0, g: 255, b: 255 }, // Ice (low friction)
    MAGENTA: { r: 255, g: 0, b: 255 }, // Mud (high friction)
    ORANGE: { r: 255, g: 165, b: 0 }, // Lava (damage)
    PURPLE: { r: 128, g: 0, b: 128 }, // Electric (shock)
    GREEN: { r: 0, g: 255, b: 0 }, // Bounce
    WHITE: { r: 255, g: 255, b: 255 }, // Speed boost
    GRAY: { r: 128, g: 128, b: 128 }, // Special effects
    GREEN_03FF00: { r: 3, g: 255, b: 0 }, // Stage animation spawn points
    BLUE_0300FF: { r: 3, g: 0, b: 255 }, // Stage animation spawn points for fx_stage_3_1

    // Dance Mode Spots
    DANCE_SPOT_A: { r: 255, g: 30, b: 30 }, // #FF1E1E - Bright red
    DANCE_SPOT_B: { r: 200, g: 30, b: 30 }, // #C81E1E - Medium red
    DANCE_SPOT_C: { r: 150, g: 30, b: 30 }, // #961E1E - Dark red
    DANCE_SPOT_D: { r: 255, g: 100, b: 30 }, // #FF641E - Orange-red
    DANCE_SPOT_E: { r: 255, g: 150, b: 30 }, // #FF961E - Light orange-red
  };

  // Wall bounce physics constants
  const WALL_BOUNCE_THRESHOLDS = {
    SLOW: 300, // Stop at wall
    MEDIUM: 600, // Reduced bounce
    FAST: Infinity, // Full bounce
  };

  const WALL_BOUNCE_RETENTION = {
    MEDIUM: 0.4, // 40% energy retained
    FAST: 0.7, // 70% energy retained
  };
  function checkStuckInWall(p, groundData, state = null) {
    if (!groundData) return false;

    const hb = Renderer.getHurtbox(p);
    const checkPositions = [
      { x: hb.left, y: hb.top + hb.h / 2 }, // Left side
      { x: hb.left + hb.w, y: hb.top + hb.h / 2 }, // Right side
      { x: hb.left + hb.w / 2, y: hb.top }, // Top
      { x: hb.left + hb.w / 2, y: hb.top + hb.h }, // Bottom
    ];

    let stuckCount = 0;
    for (const pos of checkPositions) {
      if (isPixelSolidScaled(pos.x, pos.y, groundData, state)) {
        stuckCount++;
      }
    }

    // If more than 2 corners are in solid pixels, player is stuck
    if (stuckCount >= 2) {
      // Try multiple escape directions for better robustness
      const escapeDirections = [
        { x: -60, y: 0 }, // Left
        { x: 60, y: 0 }, // Right
        { x: 0, y: -50 }, // Straight up
        { x: -40, y: -20 }, // Left and up
        { x: 40, y: -20 }, // Right and up
      ];

      for (const dir of escapeDirections) {
        const testX = p.pos.x + dir.x;
        const testY = p.pos.y + dir.y;
        const testHb = {
          left: testX - hb.w / 2,
          top: testY - hb.h / 2,
          w: hb.w,
          h: hb.h,
        };

        // Check if this position is safe
        let safe = true;
        for (const pos of checkPositions) {
          const testPos = { x: pos.x + dir.x, y: pos.y + dir.y };
          if (isPixelSolidScaled(testPos.x, testPos.y, groundData, state)) {
            safe = false;
            break;
          }
        }

        if (safe) {
          // Additional safety check: make sure we're not in killzone
          const finalTestHb = {
            left: testX - hb.w / 2,
            top: testY - hb.h / 2,
            w: hb.w,
            h: hb.h,
          };

          // Check if position is in killzone (only if falling)
          if (
            p.vel.y > 0 &&
            state.killData &&
            rectIntersectsKill(finalTestHb, state.killData)
          ) {
            console.warn(
              "Potential teleport position is in killzone, skipping"
            );
            continue;
          }

          console.warn("Found safe position for teleport", testX, testY);
          p.pos.x = testX;
          p.pos.y = testY;
          p.vel.x = 0;
          p.vel.y = 0;
          return true;
        }
      }

      // Last resort: teleport to spawn point or find safe ground
      console.error("Teleport fallback: no safe nearby positions found");

      // Try to find a safe spawn position
      const spawnPoint = state.spawnPoints?.[p.padIndex];
      if (spawnPoint) {
        p.pos.x = spawnPoint.x;
        p.pos.y = spawnPoint.y;
      } else {
        // Find safe ground position
        const safeX = 200; // Middle of screen
        const safeY = findGroundYBelow(
          safeX,
          100,
          groundData,
          100,
          state?.cameraBounds ?? null
        );
        p.pos.x = safeX;
        p.pos.y = safeY - 50; // 50 pixels above ground
      }

      p.vel.x = 0;
      p.vel.y = 0;
      return true;
    }
    return false;
  }
  function checkHeatmapEffects(p, state) {
    const hb = Renderer.getHurtbox(p);
    const checkPositions = [
      { x: hb.left + hb.w / 2, y: hb.top + hb.h }, // Bottom center
      { x: hb.left + hb.w / 2, y: hb.top + hb.h / 2 }, // Center
      { x: hb.left, y: hb.top + hb.h }, // Bottom left
      { x: hb.left + hb.w, y: hb.top + hb.h }, // Bottom right
    ];

    // Check friction effects
    if (state.frictionData) {
      for (const pos of checkPositions) {
        const color = getPixelColorScaled(
          pos.x,
          pos.y,
          state.frictionData,
          state
        );
        if (color && color.a > 128) {
          // Not transparent
          if (colorsMatch(color, HEATMAP_COLORS.CYAN)) {
            // Ice - low friction
            p.friction = 0.1;
            p.iceEffect = true;
            break;
          } else if (colorsMatch(color, HEATMAP_COLORS.MAGENTA)) {
            // Mud - high friction
            p.friction = 0.9;
            p.mudEffect = true;
            break;
          }
        }
      }
    }

    // Check hazard effects
    if (state.hazardData) {
      for (const pos of checkPositions) {
        const color = getPixelColorScaled(
          pos.x,
          pos.y,
          state.hazardData,
          state
        );
        if (color && color.a > 128) {
          if (colorsMatch(color, HEATMAP_COLORS.ORANGE)) {
            // Lava damage
            if (!p.hazardCooldown || p.hazardCooldown <= 0) {
              // Environmental damage - no descriptor needed
              p.percent = Math.min(999, (p.percent || 0) + 5);
              p.hazardCooldown = 1.0; // 1 second cooldown
              spawnEffect(state, p, "lava_hit");
            }
            break;
          } else if (colorsMatch(color, HEATMAP_COLORS.PURPLE)) {
            // Electric shock
            if (!p.hazardCooldown || p.hazardCooldown <= 0) {
              // Environmental damage - no descriptor needed
              p.percent = Math.min(999, (p.percent || 0) + 3);
              p.hazardCooldown = 0.5; // 0.5 second cooldown
              spawnEffect(state, p, "electric_hit");
            }
            break;
          }
        }
      }
    }

    // Check bounce effects
    if (state.bounceData) {
      for (const pos of checkPositions) {
        const color = getPixelColorScaled(
          pos.x,
          pos.y,
          state.bounceData,
          state
        );
        if (
          color &&
          color.a > 128 &&
          colorsMatch(color, HEATMAP_COLORS.GREEN)
        ) {
          if (p.vel.y > 0) {
            // Only bounce when falling
            p.vel.y = -800; // Strong upward bounce
            spawnEffect(state, p, "bounce_fx");
            break;
          }
        }
      }
    }

    // Check speed boost effects
    if (state.speedData) {
      for (const pos of checkPositions) {
        const color = getPixelColorScaled(pos.x, pos.y, state.speedData, state);
        if (
          color &&
          color.a > 128 &&
          colorsMatch(color, HEATMAP_COLORS.WHITE)
        ) {
          if (!p.speedBoostCooldown || p.speedBoostCooldown <= 0) {
            p.vel.x *= 1.5; // Speed boost
            p.speedBoostCooldown = 0.2; // 0.2 second cooldown
            spawnEffect(state, p, "speed_fx");
            break;
          }
        }
      }
    }

    // Check special effects
    if (state.specialData) {
      for (const pos of checkPositions) {
        const color = getPixelColorScaled(
          pos.x,
          pos.y,
          state.specialData,
          state
        );
        if (color && color.a > 128) {
          // Original teleporter effect (gray pixels)
          if (colorsMatch(color, HEATMAP_COLORS.GRAY)) {
            // Teleporter or other special effects
            if (!p.specialCooldown || p.specialCooldown <= 0) {
              // Example: Teleport to random spawn point
              if (state.spawnPoints && state.spawnPoints.length > 0) {
                const randomSpawn =
                  state.spawnPoints[
                    Math.floor(Math.random() * state.spawnPoints.length)
                  ];
                p.pos.x = randomSpawn.x;
                p.pos.y = randomSpawn.y;
                spawnEffect(state, p, "teleport_fx");
                p.specialCooldown = 2.0; // 2 second cooldown
              }
              break;
            }
          }
        }
      }
    }

    // Update cooldowns
    if (p.hazardCooldown) p.hazardCooldown -= 1 / 60; // Assuming 60 FPS
    if (p.speedBoostCooldown) p.speedBoostCooldown -= 1 / 60;
    if (p.specialCooldown) p.specialCooldown -= 1 / 60;
  }

  function rectIntersectsKill(rect, killData) {
    if (!killData) return false;
    const step = 6;
    let killPixelsFound = [];

    for (let y = rect.top; y <= rect.top + rect.h; y += step) {
      if (isKillPixel(rect.left, y, killData)) {
        killPixelsFound.push(`left(${rect.left}, ${y})`);
      }
      if (isKillPixel(rect.left + rect.w, y, killData)) {
        killPixelsFound.push(`right(${rect.left + rect.w}, ${y})`);
      }
    }
    for (let x = rect.left; x <= rect.left + rect.w; x += step) {
      if (isKillPixel(x, rect.top, killData)) {
        killPixelsFound.push(`top(${x}, ${rect.top})`);
      }
      if (isKillPixel(x, rect.top + rect.h, killData)) {
        killPixelsFound.push(`bottom(${x}, ${rect.top + rect.h})`);
      }
    }

    const centerKill = isKillPixel(
      rect.left + (rect.w >> 1),
      rect.top + (rect.h >> 1),
      killData
    );
    if (centerKill) {
      killPixelsFound.push(
        `center(${rect.left + (rect.w >> 1)}, ${rect.top + (rect.h >> 1)})`
      );
    }

    if (killPixelsFound.length > 0) {
      debugLog(
        `?? [KILLZONE] Kill pixels detected: ${killPixelsFound.join(
          ", "
        )} for hurtbox (${rect.left.toFixed(0)}, ${rect.top.toFixed(0)}, ${
          rect.w
        }, ${rect.h})`
      );
      return true;
    }

    return false;
  }

  function isKillPixel(x, y, data) {
    const ix = Math.max(0, Math.min(data.width - 1, x | 0));
    const iy = Math.max(0, Math.min(data.height - 1, y | 0));
    const i = (iy * data.width + ix) * 4;

    const r = data.data[i];
    const g = data.data[i + 1];
    const b = data.data[i + 2];
    const a = data.data[i + 3];

    const isKill = a > 128 && r > 160 && g < 60 && b < 60;

    // Log kill pixel detection for debugging
    if (isKill) {
      debugLog(
        `?? [KILLPIXEL] Kill pixel found at (${x}, ${y}): RGBA(${r}, ${g}, ${b}, ${a}) - alpha>128: ${
          a > 128
        }, red>160: ${r > 160}, green<60: ${g < 60}, blue<60: ${b < 60}`
      );
    }

    return isKill;
  }

  // NEW: Knockback Type System Functions
  function applyStandardKnockback(target, force, angle, facing) {
    const rad = ((angle || 45) * Math.PI) / 180; // Fallback to 45°
    target.vel.x = Math.cos(rad) * force * facing;
    target.vel.y = -Math.sin(rad) * force;
    target.grounded = false;
    debugLog(
      `[KNOCKBACK] Standard: force=${force}, angle=${angle}°, facing=${facing} ? vel=(${target.vel.x.toFixed(
        1
      )}, ${target.vel.y.toFixed(1)})`
    );
  }

  function applyDashKnockback(attacker, target, force, descriptor) {
    const angle = descriptor.knockbackAngle || 25; // Fallback to 25°
    const rad = (angle * Math.PI) / 180;
    target.vel.x = Math.cos(rad) * force * attacker.facing;
    target.vel.y = -Math.sin(rad) * force;
    target.grounded = false;

    // Attacker gains momentum
    const momentum = descriptor.attackerMomentum || 0.3; // Fallback to 30%
    attacker.vel.x = attacker.facing * force * momentum;
    debugLog(
      `[KNOCKBACK] Dash: force=${force}, angle=${angle}°, momentum=${momentum} ? target_vel=(${target.vel.x.toFixed(
        1
      )}, ${target.vel.y.toFixed(1)}), attacker_vel=(${attacker.vel.x.toFixed(
        1
      )}, ${attacker.vel.y.toFixed(1)})`
    );
  }

  function applyLauncherKnockback(target, force, descriptor) {
    const angle = descriptor.knockbackAngle || 80; // Fallback to 80°
    const rad = (angle * Math.PI) / 180;
    target.vel.x = Math.cos(rad) * force * (Math.random() > 0.5 ? 1 : -1) * 0.2;
    target.vel.y = -Math.sin(rad) * force;
    target.grounded = false;
    debugLog(
      `[KNOCKBACK] Launcher: force=${force}, angle=${angle}° ? vel=(${target.vel.x.toFixed(
        1
      )}, ${target.vel.y.toFixed(1)})`
    );
  }

  function applyExplosionKnockback(attacker, target, force, descriptor) {
    // Radial knockback away from attacker
    const dx = target.pos.x - attacker.pos.x;
    const dy = target.pos.y - attacker.pos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 0) {
      const normalizedX = dx / distance;
      const normalizedY = dy / distance;
      target.vel.x = normalizedX * force;
      target.vel.y = normalizedY * force;
      target.grounded = false;

      debugLog(
        `[KNOCKBACK] Explosion: force=${force}, distance=${distance.toFixed(
          1
        )} ? vel=(${target.vel.x.toFixed(1)}, ${target.vel.y.toFixed(1)})`
      );
    }
  }

  function calculateFinalDamage(attacker, descriptor) {
    let damage = descriptor.baseDamage || 4; // Fallback to default

    // Apply combo multiplier if it's a finisher
    if (descriptor.isComboFinisher && descriptor.comboMultiplier) {
      damage *= descriptor.comboMultiplier;
    }

    debugLog(
      `[DAMAGE] ${attacker?.charName || attacker?.id || "unknown"} ${
        descriptor.attackType
      }: base=${descriptor.baseDamage || 4} ? final=${damage} (combo: ${
        descriptor.isComboFinisher ? descriptor.comboMultiplier || 2.0 : 1.0
      })`
    );
    return damage;
  }
  function calculateFinalKnockback(attacker, target, descriptor) {
    let knockback = descriptor.baseKnockback || 150; // Fallback to default

    // Apply charge scaling
    if (
      attacker.attack &&
      (attacker.attack.chargeTime ||
        attacker.attack.chargeT ||
        attacker.attack.loopTime) > 0
    ) {
      const chargeTime =
        attacker.attack.chargeTime ||
        attacker.attack.chargeT ||
        attacker.attack.loopTime ||
        0;
      const maxCharge = descriptor.maxCharge || 2.0; // Fallback
      const chargeRatio = chargeTime / maxCharge;

      if (
        descriptor.chargeScalingType === "linear" &&
        descriptor.maxKnockback
      ) {
        knockback =
          descriptor.baseKnockback +
          chargeRatio * (descriptor.maxKnockback - descriptor.baseKnockback);
      } else if (descriptor.chargeScalingType === "staged") {
        if (chargeRatio < 0.33) {
          knockback = descriptor.baseKnockback;
        } else if (chargeRatio < 0.66) {
          knockback = descriptor.baseKnockback * 1.5;
        } else {
          knockback = descriptor.baseKnockback * 2.0;
        }
      }
    }

    // Apply combo multiplier if it's a finisher
    if (descriptor.isComboFinisher && descriptor.comboMultiplier) {
      knockback *= descriptor.comboMultiplier;
    }

    // Apply percent scaling
    const P = target.percent || 0;
    const knockbackExponent = descriptor.knockbackExponent || 0.7; // Fallback
    const knockbackScale = Math.pow(1 + P / 100, knockbackExponent);
    knockback *= knockbackScale;

    // Apply global knockback boost (+25%)
    knockback *= 1.25;

    // ?? BEAT-MATCH ATTACK BOOST: +10% knockback if attack was on beat
    let beatMatchMultiplier = 1.0;
    if (attacker.padIndex !== undefined && attacker.perfectBeatCount > 0) {
      // Logarithmic scaling: 1->1.2, 2->1.35, 3->1.45... 9->~1.8
      beatMatchMultiplier =
        1.0 + Math.log2(attacker.perfectBeatCount + 1) * 0.25;
      knockback *= beatMatchMultiplier;

      // NEW: Trigger discharge effect BEFORE resetting the count
      // This visualizes the consumption of stored beat energy
      if (
        window.ParticleManager &&
        window.ParticleManager.emitBeatDischargeParticles
      ) {
        window.ParticleManager.emitBeatDischargeParticles(
          attacker,
          attacker.perfectBeatCount,
          state
        );
      }

      // Consume beat match charges on hit
      attacker.perfectBeatCount = 0;
      if (AttackSystem && AttackSystem.resetPerfectBeatMatch) {
        AttackSystem.resetPerfectBeatMatch(attacker);
      }
    } else if (attacker.attack && attacker.attack.wasOnBeat) {
      beatMatchMultiplier = 1.1; // +10% boost (standard perfect beat without charge)
      knockback *= beatMatchMultiplier;
    }

    debugLog(
      `[KNOCKBACK] ${attacker?.charName || attacker?.id || "unknown"} ${
        descriptor.attackType
      }: base=${descriptor.baseKnockback || 150} ? final=${knockback.toFixed(
        1
      )} (charge: ${
        attacker.attack?.chargeTime || 0
      }s, percent: ${P}%, scale: ${knockbackScale.toFixed(
        2
      )}, beatmatch: ${beatMatchMultiplier.toFixed(2)})`
    );
    return knockback;
  }
  // NEW: Descriptor-based damage application
  function applyDamageWithDescriptor(attacker, target, descriptor, state) {
    if (target.invincible) return;

    const damage = calculateFinalDamage(attacker, descriptor);
    const knockback = calculateFinalKnockback(attacker, target, descriptor);

    // Apply damage
    target.percent = Math.min(999, (target.percent || 0) + damage);

    // Apply knockback based on type
    let hasKnockback = false;
    switch (descriptor.knockbackType) {
      case "standard":
        applyStandardKnockback(
          target,
          knockback,
          descriptor.knockbackAngle,
          attacker.facing
        );
        hasKnockback = true;
        break;
      case "dash":
        applyDashKnockback(attacker, target, knockback, descriptor);
        hasKnockback = true;
        break;
      case "launcher":
        applyLauncherKnockback(target, knockback, descriptor);
        hasKnockback = true;
        break;
      case "explosion":
        applyExplosionKnockback(attacker, target, knockback, descriptor);
        hasKnockback = true;
        break;
      case "none":
        // No knockback (projectiles)
        break;
    }

    // Cancel charge attacks when receiving knockback (even if no damage)
    if (hasKnockback && knockback > 0) {
      const isCharging =
        target.attack?.phase === "loop" ||
        target.attack?.phase === "charge" ||
        target.attack?.phase === "start";

      if (isCharging) {
        target.attack = { type: "none", phase: "none" };
        target.chargeFx = null;
      }
    }

    // Set airborne flag if knockback was applied (for enhanced particle trails)
    if (hasKnockback && knockback > 0) {
      target.grounded = false;
      target.airborneFromHit = true;
    }

    // Apply stun
    target.stunT = descriptor.stunDuration || 0.15; // Fallback to default

    // Emit appropriate FX
    const knockbackType = descriptor.knockbackType || "standard"; // Fallback
    const fxId = descriptor.fx?.hit?.id || `fx_knockback_${knockbackType}`;
    if (fxId !== "fx_knockback_none") {
      spawnGlobalEffect(state, target, fxId);
    }

    // ?? BEAT-MATCH ATTACK BOOST: Spawn additional beat-match effect if attack was on beat
    if (attacker.attack && attacker.attack.wasOnBeat) {
      spawnGlobalEffect(state, target, "fx_knockback_beatmatch");
    }

    // Blood splatter effect
    ParticleManager.emitBloodSplatter(
      target.pos.x,
      target.pos.y,
      damage,
      state
    );

    // ?? COMPREHENSIVE ATTACK LOGGING
    debugLog({
      attackType: descriptor.attackType,
      tier: descriptor.tier,
      damage: damage,
      knockback: knockback,
      knockbackType: descriptor.knockbackType,
      knockbackAngle: descriptor.knockbackAngle,
      stunDuration: descriptor.stunDuration,
      targetPercent: target.percent,
      fxId: fxId,
      attackerMomentum: descriptor.attackerMomentum || 0,
    });
  }
  function applyDamage(
    target,
    sourcePos,
    baseDamage,
    maxStun,
    baseKnockback,
    state,
    falloff = 1.0,
    knockbackExponent = 0.8
  ) {
    if (falloff <= 0) return;

    if (target.invincible) return; // Do not apply damage or effects if target is invincible

    const wasStunned = (target.stunT || 0) > 0;
    const P = target.percent || 0;

    // --- NEW: Calculate scaled knockback and determine appropriate effect ---
    const knockbackScale = Math.pow(1 + P / 100, knockbackExponent);
    const K = baseKnockback * knockbackScale * falloff;
    const actualDamage = Math.round(baseDamage * falloff);

    if (K > 1200) {
      // Strong hit effects
      spawnGlobalEffect(state, target, "fx_hurt_knockback");
      const angle = Math.atan2(target.vel.y, target.vel.x);
      spawnGlobalEffect(state, target, "fx_knockback", {
        rotation: angle,
        speed: 5.625, // 1.875 * 3 = 5.625 (3x faster)
        target: target, // Make this effect follow the target
      });
    } else {
      // Default hit effect
      spawnGlobalEffect(state, target, "fx_hurt");
    }

    // --- NEW: Spawn blood splatter effect ---
    if (ParticleManager && ParticleManager.emitBloodSplatter) {
      ParticleManager.emitBloodSplatter(
        target.pos.x,
        target.pos.y,
        actualDamage,
        state
      );
    }
    // --- END NEW ---

    target.percent = Math.min(
      999,
      (target.percent || 0) + baseDamage * falloff
    );
    target.stunT = Math.max(target.stunT || 0, maxStun * falloff);

    // Setze lastDamageFrame f�r UI-Animation
    target.lastDamageFrame = state.lastTime;

    const dx = target.pos.x - sourcePos.x;
    const dy = target.pos.y - sourcePos.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    // Use the newly calculated scaled knockback force 'K'
    target.vel.x = (dx / dist) * K;
    target.vel.y = (dy / dist) * K * 0.7 - 200; // Add a slight upward pop
    target.grounded = false;

    if (!target.isGrabbed && !wasStunned) {
      setAnim(target, "hurt", false, state);
      // Enable airborne animation for this player after being hit
      target.airborneFromHit = true;
    }
  }
  function updateProjectiles(dt, state, canvas) {
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const proj = state.projectiles[i];
      let lockedTarget = null;

      // Store previous position for collision detection
      proj.prevPos = { ...proj.pos };

      // Character-specific projectile behavior
      switch (proj.type) {
        case "ernst_ulti_projectile": {
          lockedTarget = proj.lockedTarget || null;

          if (
            (!lockedTarget || lockedTarget.eliminated) &&
            Number.isInteger(proj.lockedTargetIndex) &&
            proj.lockedTargetIndex >= 0 &&
            proj.lockedTargetIndex < state.players.length
          ) {
            const candidate = state.players[proj.lockedTargetIndex];
            if (candidate && !candidate.eliminated) {
              lockedTarget = candidate;
            }
          }

          if (!lockedTarget && proj.lockedTargetPad != null) {
            lockedTarget = state.players.find(
              (player) =>
                player &&
                !player.eliminated &&
                player.padIndex === proj.lockedTargetPad
            );
          }

          if (!lockedTarget || lockedTarget.eliminated) {
            console.warn("[ErnstUlt] Projectile lost target – removing.", {
              owner: proj.owner?.padIndex,
              lockedIndex: proj.lockedTargetIndex,
              lockedPad: proj.lockedTargetPad,
            });
            state.projectiles.splice(i, 1);
            continue;
          }

          proj.lockedTarget = lockedTarget;
          proj.lockedTargetIndex = state.players.indexOf(lockedTarget);
          if (typeof lockedTarget.padIndex === "number") {
            proj.lockedTargetPad = lockedTarget.padIndex;
          }

          try {
            const hb = Renderer.getHurtbox(lockedTarget);
            if (hb) {
              proj.pos.y = hb.top + hb.h * 0.5;
            }
          } catch (err) {
            console.warn(
              "Renderer hurtbox lookup failed for Ernst ulti projectile update",
              err
            );
          }

          const ownerFacing =
            typeof proj.owner?.attack?.lockedFacing === "number"
              ? proj.owner.attack.lockedFacing
              : proj.owner?.facing;
          const dir =
            typeof ownerFacing === "number"
              ? ownerFacing >= 0
                ? 1
                : -1
              : Math.sign((lockedTarget.pos?.x || 0) - proj.pos.x) || 1;
          const speed = Math.abs(proj.vel?.x || 2000) || 2000;
          proj.vel.x = dir * speed;
          proj.pos.x += proj.vel.x * dt;
          proj.traveledDistance += Math.abs(proj.vel.x) * dt;
          break;
        }
        case "cyboard_sword":
          if (proj.state === "rising") {
            proj.pos.y += proj.vel.y * dt;
            if (proj.pos.y <= proj.startY - 400) {
              // Value was 300
              proj.state = "hanging";
              proj.vel.y = 0;
            }
          } else if (proj.state === "hanging") {
            // Sword hanging - no grab or damage logic
            // Just keep the sword in position
          } else if (proj.state === "returning") {
            const owner = proj.owner;
            if (!owner) {
              state.projectiles.splice(i, 1);
              break; // Owner is gone, remove sword
            }

            // Safety timeout: If returning takes more than 2 seconds, force cleanup
            const RETURN_TIMEOUT = 2000; // 2 seconds in milliseconds
            const returnDuration =
              performance.now() - (proj.returnStartTime || 0);
            if (returnDuration > RETURN_TIMEOUT) {
              console.warn("[Sword Return] Timeout reached, forcing cleanup");
              owner.swordIsOut = false;
              state.projectiles.splice(i, 1);
              break;
            }

            const targetX = owner.pos.x;
            const targetY = owner.pos.y - 100; // Aim for just above the head
            const dx = targetX - proj.pos.x;
            const dy = targetY - proj.pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const RETURN_SPEED = 2500;
            const CATCH_RADIUS = 120; // Increased from 50 to ensure reliable catching

            if (dist < CATCH_RADIUS) {
              owner.swordIsOut = false;
              state.projectiles.splice(i, 1);
              break; // Projectile is gone, continue to next one
            } else {
              proj.vel.x = (dx / dist) * RETURN_SPEED;
              proj.vel.y = (dy / dist) * RETURN_SPEED;
              proj.pos.x += proj.vel.x * dt;
              proj.pos.y += proj.vel.y * dt;
            }
          } else if (proj.state === "slamming") {
            // Drive the slam with the linked effect animation
            if (proj.linkedEffect && !proj.linkedEffect.done) {
              // Start moving on frame 4 (index 3)
              if (proj.linkedEffect.frameIndex >= 3 && !proj.isSlamming) {
                proj.isSlamming = true; // Flag to start moving down
                proj.vel.y = 3500; // SLAM_SPEED
              }

              if (proj.isSlamming) {
                proj.pos.y += proj.vel.y * dt;
              }

              // Keep effect locked to projectile
              proj.linkedEffect.pos = { ...proj.pos };

              // Ground collision
              const groundY = findGroundYBelow(
                proj.pos.x,
                proj.pos.y,
                state.groundData,
                proj.prevPos.y
              );
              if (proj.pos.y >= groundY) {
                // 1. Teleport Player to impact
                proj.owner.pos.x = proj.pos.x;
                proj.owner.pos.y = groundY;
                proj.owner.vel = { x: 0, y: 0 };
                proj.owner.grounded = true;

                // 2. Clean up projectile and sword state
                proj.linkedEffect.done = true;
                proj.owner.swordIsOut = false;
                state.projectiles.splice(i, 1);
                break; // Projectile is gone
              }
            } else {
              // Effect is done or doesn't exist, cleanup
              proj.owner.swordIsOut = false;
              state.projectiles.splice(i, 1);
              break;
            }
          }
          break;
        case "ulti_check":
          // Disco-ball behavior: fast horizontal movement, then hover over target
          if (proj.isDiscoBall) {
            // Update animation
            proj.frameTime += dt;
            const fps = 12; // Default FPS
            const frameDuration = 1 / fps;
            if (proj.frameTime >= frameDuration) {
              proj.frameTime = 0;
              proj.frameIndex = (proj.frameIndex + 1) % 3; // Loop through 3 frames
            }

            // If no target detected yet, move horizontally and look for targets
            if (!proj.targetDetected) {
              // Move horizontally at high speed
              proj.x += proj.vel.x * dt;
              proj.traveledDistance += Math.abs(proj.vel.x) * dt;

              // Check if reached max range
              if (proj.traveledDistance >= proj.maxRange) {
                proj.reachedMaxRange = true;
                state.projectiles.splice(i, 1);
                break;
              }

              // Look for target collision - Use consistent hitbox with renderer
              for (const target of state.players) {
                if (target === proj.owner || target.eliminated) continue;

                const targetHurtbox = Renderer.getHurtbox(target);
                // Use the same hitbox calculation as in renderer.js
                const groundY = 800;
                const discoBallCenterY = proj.y;
                const projHitbox = {
                  left: proj.x - proj.size / 2,
                  top: Math.min(groundY, discoBallCenterY),
                  w: proj.size,
                  h: Math.abs(discoBallCenterY - groundY),
                };

                if (rectsIntersect(projHitbox, targetHurtbox)) {
                  proj.targetDetected = true;
                  proj.hitTarget = target;
                  proj.vel = { x: 0, y: 0 }; // Stop horizontal movement
                  proj.targetPosition = {
                    x: target.pos.x,
                    y: target.pos.y - targetHurtbox.h / 2 - proj.hoverHeight,
                  };
                  break;
                }
              }
            } else {
              // Target detected - hover above target
              const target = proj.hitTarget;
              if (target && !target.eliminated) {
                // Update target position
                const targetHurtbox = Renderer.getHurtbox(target);
                proj.targetPosition.x = target.pos.x;
                proj.targetPosition.y =
                  target.pos.y - targetHurtbox.h / 2 - proj.hoverHeight;

                // Smooth movement to target position
                const moveSpeed = 300; // pixels per second
                const dx = proj.targetPosition.x - proj.x;
                const dy = proj.targetPosition.y - proj.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance > 5) {
                  // Only move if not close enough
                  proj.x += (dx / distance) * moveSpeed * dt;
                  proj.y += (dy / distance) * moveSpeed * dt;
                } else {
                  proj.x = proj.targetPosition.x;
                  proj.y = proj.targetPosition.y;
                }
              }
            }

            // Update pos for compatibility
            proj.pos.x = proj.x;
            proj.pos.y = proj.y;
          }
          break;
        default: // Cyboard's bomb
          proj.vel.y += proj.owner.config.physics.gravity * dt;
          proj.pos.x += proj.vel.x * dt;
          proj.pos.y += proj.vel.y * dt;
          break;
      }

      // --- Animation ---
      const charName = proj.owner?.charName;
      if (charName) {
        const charData = state.characterConfigs[charName];
        const animFrames = charData.animations[proj.anim];
        if (animFrames) {
          proj.frameTime = (proj.frameTime || 0) + dt;
          const frameDur = 1 / (charData.fps || 12);
          if (proj.frameTime >= frameDur) {
            proj.frameTime -= frameDur;
            proj.frameIndex = (proj.frameIndex || 0) + 1;
            if (proj.frameIndex >= animFrames.length) {
              proj.frameIndex = 0; // Always loop projectile animations
            }
          }
        }
      }

      let hitSomething = false;

      if (proj.type !== "ulti_check") {
        const projHitbox = Renderer.getProjectileHitbox(proj);

        if (proj.type === "ernst_ulti_projectile") {
          const target = lockedTarget;
          if (!target || target === proj.owner || target.eliminated) {
            console.warn(
              "[ErnstUlt] Projectile hit detection – target invalid.",
              {
                owner: proj.owner?.padIndex,
                targetPad: target?.padIndex ?? null,
              }
            );
            state.projectiles.splice(i, 1);
            continue;
          }

          const targetHurtbox = Renderer.getHurtbox(target);
          if (targetHurtbox && rectsIntersect(projHitbox, targetHurtbox)) {
            target.percent = Math.min(
              999,
              (target.percent || 0) + (proj.damage || 256)
            );

            const sourceKey = proj.owner?.charName?.toLowerCase() || "ernst";
            if (!target.ultiHurtLock) {
              target.ultiHurtLock = true;
            }
            if (!target.ultiHurtLockSource) {
              target.ultiHurtLockSource = sourceKey;
            }
            if (target.anim !== "hurt") {
              setAnim(target, "hurt", true, state, 1);
            }
            target.frameIndex = 0;
            target.frameTime = 0;

            console.log("[ErnstUlt] Projectile connected.", {
              owner: proj.owner?.padIndex,
              targetPad: target.padIndex,
              damage: proj.damage,
              targetPercent: target.percent,
            });

            const charData = state.characterConfigs?.[proj.owner?.charName];
            if (charData && window.AttackAnimationCatalog) {
              const impactConfig = window.AttackAnimationCatalog.getAnimation(
                proj.owner.charName,
                "ulti_impact",
                state
              );
              if (impactConfig && impactConfig.frames) {
                const effect = {
                  charName: proj.owner.charName,
                  frames: impactConfig.frames,
                  fps: charData.fps || 12,
                  frameIndex: 0,
                  time: 0,
                  pos: { x: proj.pos.x, y: proj.pos.y },
                  facing: proj.owner.facing,
                  offsetX: 0,
                  offsetY: 0,
                  speed: 1.0,
                  done: false,
                  useFrameDurations: impactConfig.useFrameDurations || false,
                };
                state.effects.push(effect);
              }
            }

            state.projectiles.splice(i, 1);
            hitSomething = true;
          }
        } else {
          for (const target of state.players) {
            if (target === proj.owner || target.eliminated) continue;

            const targetHurtbox = Renderer.getHurtbox(target);
            if (!targetHurtbox) continue;
            if (!rectsIntersect(projHitbox, targetHurtbox)) continue;

            if (target.parryWindow > 0) {
              proj.owner = target;

              let vx = proj.vel.x * -0.5;
              let vy = proj.vel.y * -0.5;

              const angleVariation = (Math.random() * 10 - 5) * (Math.PI / 180);
              const cos = Math.cos(angleVariation);
              const sin = Math.sin(angleVariation);

              proj.vel.x = vx * cos - vy * sin;
              proj.vel.y = vx * sin + vy * cos;

              hitSomething = true;
              break;
            } else {
              let attackType;
              let shouldApplyDistanceBasedStun = false;
              const ownerCharName = proj.owner?.charName?.toLowerCase();

              if (proj.type === "hp_mushroom") {
                attackType = "l2_projectile";
                shouldApplyDistanceBasedStun = true;
              } else if (
                ownerCharName === "cyboard" &&
                (!proj.type || proj.type === "l1_bomb")
              ) {
                attackType = "l1_bomb";
                shouldApplyDistanceBasedStun = true;
              } else {
                attackType =
                  proj.type === "hp_mushroom" ? "l2_projectile" : "l1_bomb";
                shouldApplyDistanceBasedStun = false;
              }

              const descriptor = AttackCatalog.getDescriptor(
                proj.owner,
                attackType
              );

              const impactFx =
                descriptor?.fx?.hit?.id ||
                (attackType === "l2_projectile" ? "l2_impact" : "l1_impact");

              if (shouldApplyDistanceBasedStun && proj.startPos) {
                const dx = proj.pos.x - proj.startPos.x;
                const dy = proj.pos.y - proj.startPos.y;
                const flightDistance = Math.sqrt(dx * dx + dy * dy);

                const normalizedDistance = Math.min(
                  1.0,
                  Math.max(0.0, flightDistance / 1200)
                );

                const minStun = 0.1;
                const maxStun = 3.0;
                const calculatedStun =
                  minStun + (maxStun - minStun) * normalizedDistance;

                const stunDescriptor = {
                  ...descriptor,
                  stunDuration: calculatedStun,
                };

                AttackSystem.applyDamageWithDescriptor(
                  proj.owner,
                  target,
                  stunDescriptor,
                  state,
                  { source: proj, fxOverride: impactFx }
                );
                target.stunT = Math.max(target.stunT || 0, calculatedStun);
              } else {
                AttackSystem.applyDamageWithDescriptor(
                  proj.owner,
                  target,
                  descriptor,
                  state,
                  { source: proj, fxOverride: impactFx }
                );
              }

              state.projectiles.splice(i, 1);
              hitSomething = true;
              break;
            }
          }
        }
      }

      if (hitSomething) continue;

      // 2. Check for ground collision (if no direct hit) - skip for ulti_check
      if (proj.type !== "ulti_check") {
        const groundY = findGroundYBelow(
          proj.pos.x,
          proj.pos.y,
          state.groundData,
          proj.prevPos.y
        );
        if (proj.pos.y >= groundY) {
          // Character-specific impact effects
          if (proj.type === "hp_mushroom") {
            const descriptor = AttackCatalog.getDescriptor(
              proj.owner,
              "l2_projectile"
            );
            const impactFx = descriptor?.fx?.hit?.id || "l2_impact";
            spawnEffect(state, proj, impactFx);
            // HP's mushroom has no splash damage, only direct hit
          } else {
            const descriptor = AttackCatalog.getDescriptor(
              proj.owner,
              "l1_bomb"
            );
            const impactFx = descriptor?.fx?.hit?.id || "l1_impact";
            spawnEffect(state, proj, impactFx);

            // 3. Apply splash damage on ground impact (Cyboard's bomb only)
            const splashRadius = 200;
            for (const target of state.players) {
              if (target.eliminated) continue;

              const dx = target.pos.x - proj.pos.x;
              const dy = target.pos.y - proj.pos.y;
              const dist = Math.sqrt(dx * dx + dy * dy);

              if (dist < splashRadius) {
                const falloff = 1.0 - dist / splashRadius;
                const pconf = proj.owner.config.physics;
                const charge = proj.owner.attack.chargeT || 0;
                const minPower = pconf.jumpSpeed * 0.7;
                const maxPower = pconf.jumpSpeed * 2.1;
                const power = minPower + (maxPower - minPower) * (charge / 1.5);
                const angle = (60 * Math.PI) / 180;
                const projVel = {
                  x: proj.owner.facing * power * Math.cos(angle),
                  y: -power * Math.sin(angle),
                };
                const projDamage = proj.owner.config.moves.l1_bomb_damage;
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
              }
            }
          }
          state.projectiles.splice(i, 1);
        }
      }
    }
  }

  function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
  }
  function logPlayerStatus(p, state) {
    if (!p._loggingState) return;

    // Check if logging is enabled
    const config = window.playerStatusLoggingConfig;
    if (!config || !config.enabled) return;

    const now = state.lastTime || performance.now();
    const loggingState = p._loggingState;

    // Determine current status
    let currentStatus = "unknown";
    if (p.grounded) {
      if (isPlayerOnSemisolid(p, state)) {
        currentStatus = "semisolid";
      } else {
        currentStatus = "ground";
      }
    } else if (p.vel.y < -50) {
      currentStatus = "jumping";
    } else if (p.vel.y > 50) {
      currentStatus = "falling";
    } else {
      currentStatus = "air";
    }

    // Calculate current speed
    const currentSpeed = Math.sqrt(p.vel.x * p.vel.x + p.vel.y * p.vel.y);

    // Check for status change
    const statusChanged = currentStatus !== loggingState.lastStatus;

    // Check for significant speed change (configurable threshold)
    const speedChanged =
      Math.abs(currentSpeed - loggingState.lastSpeed) > config.speedThreshold;

    // Check for time-based logging (configurable interval)
    const timeElapsed = now - loggingState.lastLogTime;
    const shouldLogByTime = timeElapsed > config.logInterval;

    // Log conditions:
    // 1. Status changed
    // 2. Significant speed change
    // 3. Time-based logging (configurable interval)
    // 4. First time logging
    if (
      statusChanged ||
      speedChanged ||
      shouldLogByTime ||
      loggingState.lastStatus === null
    ) {
      const speedCategory =
        currentSpeed < 100
          ? "slow"
          : currentSpeed < 400
          ? "medium"
          : currentSpeed < 800
          ? "fast"
          : "very_fast";

      const direction =
        Math.abs(p.vel.x) > Math.abs(p.vel.y)
          ? p.vel.x > 0
            ? "right"
            : "left"
          : p.vel.y > 0
          ? "down"
          : "up";

      debugLog(
        `Speed: ${currentSpeed.toFixed(
          0
        )} (${speedCategory}) | Vel: (${p.vel.x.toFixed(0)}, ${p.vel.y.toFixed(
          0
        )}) ${direction}`
      );
      // Update logging state
      loggingState.lastStatus = currentStatus;
      loggingState.lastSpeed = currentSpeed;
      loggingState.lastLogTime = now;

      if (statusChanged) {
        loggingState.statusChangeCount++;
      }
    }
  }

  // Global function to control player status logging
  window.setPlayerStatusLogging = function (enabled, options = {}) {
    const config = {
      enabled: enabled,
      logInterval: options.logInterval || 2000, // ms
      speedThreshold: options.speedThreshold || 100, // units
      ...options,
    };

    // Store config globally
    window.playerStatusLoggingConfig = config;

    if (enabled) {
    }
  };
  // Initialize logging as enabled by default
  window.setPlayerStatusLogging(true);

  function updateCamera(dt, state, canvas) {
    if (!state.camera || state.players.length < 1) return;

    // CRITICAL: Skip camera updates during Tutorial Part 2 game freeze
    // This keeps the camera centered on the stage during the intro modal
    if (window.TutorialSystem?.isGameFrozen?.(state)) {
      return;
    }

    // One-time initialization logging
    if (!state.camera._debugInitialized) {
      console.log(
        `📷 Camera system initialized for stage: ${
          state.currentStagePath || "unknown"
        }`
      );
      state.camera._debugInitialized = true;
    }

    // NEW: Dance Spot Camera Focus - Highest Priority
    // If dance mode is active and there's an active spot, focus camera on the spot
    if (
      state.danceMode?.active &&
      state.danceMode.currentActiveSpot &&
      state.danceMode.currentActiveSpot.pos
    ) {
      const spot = state.danceMode.currentActiveSpot;
      const spotX = spot.pos.x;
      const spotY = spot.pos.y;

      const BASE_MAX_ZOOM = 2.03125;
      const BASE_MIN_ZOOM = 1.0;
      const stageWidthForPadding =
        state.cameraBounds?.width ?? GameState.CONSTANTS.NATIVE_WIDTH;
      const stageHeightForPadding =
        state.cameraBounds?.height ?? GameState.CONSTANTS.NATIVE_HEIGHT;
      const hasPaddingScale = !!(
        state.cameraPaddingScale &&
        typeof state.cameraPaddingScale.x === "number" &&
        typeof state.cameraPaddingScale.y === "number"
      );
      const PADDING_X = hasPaddingScale
        ? stageWidthForPadding * state.cameraPaddingScale.x
        : 300;
      const PADDING_Y = hasPaddingScale
        ? stageHeightForPadding * state.cameraPaddingScale.y
        : 200;
      const SMOOTHING = 4.0;
      const VERTICAL_OFFSET = state.cameraBounds?.height
        ? -100 * (GameState.CONSTANTS.NATIVE_HEIGHT / state.cameraBounds.height)
        : -100;

      // Calculate zoom to show spot with some padding
      // Also consider players if they're near the spot
      const p1 = state.players[0];
      const p2 = state.players.length > 1 ? state.players[1] : p1;

      // Calculate distance from spot to players
      const p1Dist = Math.hypot(p1.pos.x - spotX, p1.pos.y - spotY);
      const p2Dist = Math.hypot(p2.pos.x - spotX, p2.pos.y - spotY);
      const maxDist = Math.max(p1Dist, p2Dist);

      // If players are far from spot, zoom out to show both spot and players
      // If players are close, zoom in on spot area
      const spotRadius = state.danceMode.beatMatchRadius ?? 400;
      const effectiveRadius = Math.max(spotRadius, maxDist * 0.5);

      const computedBoundsMinZoom = state.cameraBounds
        ? Math.max(
            GameState.CONSTANTS.NATIVE_WIDTH / state.cameraBounds.width,
            GameState.CONSTANTS.NATIVE_HEIGHT / state.cameraBounds.height
          )
        : BASE_MIN_ZOOM;
      const MIN_ZOOM = Math.max(
        state.stageMinZoom ?? BASE_MIN_ZOOM,
        computedBoundsMinZoom
      );
      const MAX_ZOOM = state.stageMaxZoom ?? BASE_MAX_ZOOM;

      // Calculate zoom based on effective radius (spot + players)
      const zoomX =
        GameState.CONSTANTS.NATIVE_WIDTH /
        (effectiveRadius * 2 + PADDING_X * 2);
      const zoomY =
        GameState.CONSTANTS.NATIVE_HEIGHT /
        (effectiveRadius * 2 + PADDING_Y * 2);
      let targetZoom = Math.min(zoomX, zoomY);
      targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, targetZoom));

      // Target position: center on spot
      let targetX = spotX;
      let targetY = spotY + VERTICAL_OFFSET;

      // Apply bounds clamping
      const viewWidth = GameState.CONSTANTS.NATIVE_WIDTH / targetZoom;
      const viewHeight = GameState.CONSTANTS.NATIVE_HEIGHT / targetZoom;

      if (state.cameraBounds) {
        const bounds = state.cameraBounds;
        let minX, maxX, minY, maxY;

        if (viewWidth > bounds.width) {
          minX = maxX = bounds.x + bounds.width / 2;
        } else {
          minX = bounds.x + viewWidth / 2;
          maxX = bounds.x + bounds.width - viewWidth / 2;
        }

        if (viewHeight > bounds.height) {
          minY = maxY = bounds.y + bounds.height / 2;
        } else {
          minY = bounds.y + viewHeight / 2;
          maxY = bounds.y + bounds.height - viewHeight / 2;
        }

        targetX = Math.max(minX, Math.min(maxX, targetX));
        targetY = Math.max(minY, Math.min(maxY, targetY));
      } else {
        targetX = Math.max(
          viewWidth / 2,
          Math.min(GameState.CONSTANTS.NATIVE_WIDTH - viewWidth / 2, targetX)
        );
        targetY = Math.max(
          viewHeight / 2,
          Math.min(GameState.CONSTANTS.NATIVE_HEIGHT - viewHeight / 2, targetY)
        );
      }

      // Smooth camera movement to spot
      const smoothFactor = 1 - Math.exp(-SMOOTHING * dt);
      const desiredZoom = lerp(state.camera.zoom, targetZoom, smoothFactor);
      const desiredX = lerp(state.camera.x, targetX, smoothFactor);
      const desiredY = lerp(state.camera.y, targetY, smoothFactor);

      // Apply rate limits
      const maxTransPerSec =
        (GameState.CONSTANTS.NATIVE_WIDTH / targetZoom) * 1.5;
      const maxStep = maxTransPerSec * dt;
      const dx = desiredX - state.camera.x;
      const dy = desiredY - state.camera.y;
      state.camera.x += Math.max(-maxStep, Math.min(maxStep, dx));
      state.camera.y += Math.max(-maxStep, Math.min(maxStep, dy));

      const maxZoomPerSec = state.cameraMaxZoomPerSec ?? 1.5;
      const maxZoomStep = maxZoomPerSec * dt;
      const dZ = desiredZoom - state.camera.zoom;
      state.camera.zoom += Math.max(-maxZoomStep, Math.min(maxZoomStep, dZ));

      if (state.debug?.cameraLogging) {
        console.log(
          `📷 Dance Spot Camera: spot=(${spotX.toFixed(1)}, ${spotY.toFixed(
            1
          )}), target=(${targetX.toFixed(1)}, ${targetY.toFixed(
            1
          )}), zoom=${state.camera.zoom.toFixed(3)}`
        );
      }

      return; // Skip normal player-follow camera logic
    }

    const p1 = state.players[0];
    const p2 = state.players.length > 1 ? state.players[1] : p1;

    const BASE_MAX_ZOOM = 2.03125; // Value was 1.625, increased by 25%
    const BASE_MIN_ZOOM = 1.0;
    // Dynamic padding: prefer stage-scaled values from meta, fallback to legacy constants
    const stageWidthForPadding =
      state.cameraBounds?.width ?? GameState.CONSTANTS.NATIVE_WIDTH;
    const stageHeightForPadding =
      state.cameraBounds?.height ?? GameState.CONSTANTS.NATIVE_HEIGHT;
    const hasPaddingScale = !!(
      state.cameraPaddingScale &&
      typeof state.cameraPaddingScale.x === "number" &&
      typeof state.cameraPaddingScale.y === "number"
    );
    const PADDING_X = hasPaddingScale
      ? stageWidthForPadding * state.cameraPaddingScale.x
      : 300;
    const PADDING_Y = hasPaddingScale
      ? stageHeightForPadding * state.cameraPaddingScale.y
      : 200;
    const SMOOTHING = 4.0;
    // Slower smoothing for box dimensions to prevent jumpy zoom during jumps
    const BOX_SMOOTHING = 1.2; // Much slower than position smoothing for delayed zoom reaction
    // Vertical offset scales with stage height (negative = shift camera up)
    const VERTICAL_OFFSET = state.cameraBounds?.height
      ? -100 * (GameState.CONSTANTS.NATIVE_HEIGHT / state.cameraBounds.height)
      : -100;

    // Initialize smoothed box dimensions if not present
    // Use current player positions for initial values to avoid jump on first frame
    if (!state.camera._smoothedBox) {
      const initialMinX = Math.min(p1.pos.x, p2.pos.x);
      const initialMaxX = Math.max(p1.pos.x, p2.pos.x);
      const initialMinY = Math.min(p1.pos.y, p2.pos.y);
      const initialMaxY = Math.max(p1.pos.y, p2.pos.y);
      state.camera._smoothedBox = {
        width: initialMaxX - initialMinX,
        height: initialMaxY - initialMinY,
      };
    }

    // Load stage-specific zoom settings - allow zoom < 1.0 for larger stages
    let computedBoundsMinZoom = BASE_MIN_ZOOM;
    if (state.cameraBounds) {
      const lbx = GameState.CONSTANTS.NATIVE_WIDTH / state.cameraBounds.width;
      const lby = GameState.CONSTANTS.NATIVE_HEIGHT / state.cameraBounds.height;
      // Allow zoom below 1.0 for stages larger than native resolution
      computedBoundsMinZoom = Math.max(lbx, lby);
    }

    const MIN_ZOOM = Math.max(
      state.stageMinZoom ?? BASE_MIN_ZOOM,
      computedBoundsMinZoom
    );
    const MAX_ZOOM = state.stageMaxZoom ?? BASE_MAX_ZOOM;
    const DISABLE_AUTO_ZOOM = state.stageDisableAutoZoom ?? false;
    const LOCK_TO_BOUNDS = state.cameraLockToBounds ?? false;

    // Debug logging for camera settings
    if (state.debug?.cameraLogging) {
      console.log(
        `📷 Camera Settings: MIN_ZOOM=${MIN_ZOOM}, MAX_ZOOM=${MAX_ZOOM}, DISABLE_AUTO_ZOOM=${DISABLE_AUTO_ZOOM}`
      );
    }

    // NEW: Tutorial Victory Dance Camera Zoom
    if (
      state.tutorial?.victoryDance?.active &&
      (state.tutorial.victoryDance.phase === "zooming" ||
        state.tutorial.victoryDance.phase === "dancing")
    ) {
      const p1 = state.players[0];
      if (p1 && !p1.eliminated) {
        const vd = state.tutorial.victoryDance;
        const zoomProgress = Math.min(
          1,
          (state.lastTime - vd.zoomStartTime) / vd.zoomDuration
        );
        const currentZoom = lerp(1.0, vd.targetZoom, Math.min(1, zoomProgress));

        // Center camera on player
        const playerHb = Renderer.getHurtbox(p1);
        const playerCenterX = playerHb.left + playerHb.w / 2;
        const playerCenterY = playerHb.top + playerHb.h / 2;

        const smoothingMultiplier = 0.3;
        const effectiveSmoothing = SMOOTHING * smoothingMultiplier;
        const smoothFactor = 1 - Math.exp(-effectiveSmoothing * dt);

        const victoryTargetZoom = Math.max(
          MIN_ZOOM,
          Math.min(MAX_ZOOM, currentZoom)
        );
        const victoryTargetX = playerCenterX;
        const victoryTargetY = playerCenterY;

        const desiredZoom = lerp(
          state.camera.zoom,
          victoryTargetZoom,
          smoothFactor
        );
        const desiredX = lerp(state.camera.x, victoryTargetX, smoothFactor);
        const desiredY = lerp(state.camera.y, victoryTargetY, smoothFactor);

        const maxZoomPerSec = 1.0;
        const maxZoomStep = maxZoomPerSec * dt;
        const dZ = desiredZoom - state.camera.zoom;
        state.camera.zoom += Math.max(-maxZoomStep, Math.min(maxZoomStep, dZ));

        const maxTransPerSec =
          (GameState.CONSTANTS.NATIVE_WIDTH / victoryTargetZoom) * 1.0;
        const maxStep = maxTransPerSec * dt;
        const dx = desiredX - state.camera.x;
        const dy = desiredY - state.camera.y;
        state.camera.x += Math.max(-maxStep, Math.min(maxStep, dx));
        state.camera.y += Math.max(-maxStep, Math.min(maxStep, dy));

        return; // Skip normal camera logic during victory dance
      }
    }

    // NEW: Handle match end camera (zoom on winner)
    if (state.matchEnd.isActive && state.matchEnd.phase === "zooming") {
      const winner = state.players[state.matchEnd.winner];
      if (winner) {
        const smoothingMultiplier = 0.3;
        const effectiveSmoothing = SMOOTHING * smoothingMultiplier;
        const rawWinnerZoom =
          state.matchEnd.targetZoom != null
            ? state.matchEnd.targetZoom
            : BASE_MAX_ZOOM;
        const targetZoom = Math.max(
          MIN_ZOOM,
          Math.min(MAX_ZOOM, rawWinnerZoom)
        );
        const viewWidth = GameState.CONSTANTS.NATIVE_WIDTH / targetZoom;
        const viewHeight = GameState.CONSTANTS.NATIVE_HEIGHT / targetZoom;

        let targetX = winner.pos.x;
        let targetY = winner.pos.y + VERTICAL_OFFSET;

        if (!state.camera._lastClampedTarget) {
          state.camera._lastClampedTarget = { x: targetX, y: targetY };
        }

        if (state.cameraBounds) {
          const bounds = state.cameraBounds;
          const centerX = bounds.x + bounds.width / 2;
          const centerY = bounds.y + bounds.height / 2;
          let minX, maxX, minY, maxY;

          if (viewWidth >= bounds.width) {
            minX = maxX = centerX;
          } else {
            minX = bounds.x + viewWidth / 2;
            maxX = bounds.x + bounds.width - viewWidth / 2;
          }

          if (viewHeight >= bounds.height) {
            minY = maxY = centerY;
          } else {
            minY = bounds.y + viewHeight / 2;
            maxY = bounds.y + bounds.height - viewHeight / 2;
          }

          const boundsSmoothing = 6.0;
          const boundsSmoothFactor =
            1 - Math.exp(-boundsSmoothing * dt * smoothingMultiplier);

          state.camera._lastClampedTarget.x = lerp(
            state.camera._lastClampedTarget.x,
            Math.max(minX, Math.min(maxX, targetX)),
            boundsSmoothFactor
          );
          state.camera._lastClampedTarget.y = lerp(
            state.camera._lastClampedTarget.y,
            Math.max(minY, Math.min(maxY, targetY)),
            boundsSmoothFactor
          );

          targetX = state.camera._lastClampedTarget.x;
          targetY = state.camera._lastClampedTarget.y;
        } else {
          const nativeWidth = GameState.CONSTANTS.NATIVE_WIDTH;
          const nativeHeight = GameState.CONSTANTS.NATIVE_HEIGHT;
          const clampedX = Math.max(
            viewWidth / 2,
            Math.min(nativeWidth - viewWidth / 2, targetX)
          );
          const clampedY = Math.max(
            viewHeight / 2,
            Math.min(nativeHeight - viewHeight / 2, targetY)
          );
          targetX = clampedX;
          targetY = clampedY;
        }

        const smoothFactor = 1 - Math.exp(-effectiveSmoothing * dt);
        const desiredZoom = lerp(state.camera.zoom, targetZoom, smoothFactor);
        const desiredX = lerp(state.camera.x, targetX, smoothFactor);
        const desiredY = lerp(state.camera.y, targetY, smoothFactor);

        const maxTransPerSec =
          (GameState.CONSTANTS.NATIVE_WIDTH / targetZoom) * 1.0;
        const maxStep = maxTransPerSec * dt;
        const dx = desiredX - state.camera.x;
        const dy = desiredY - state.camera.y;
        state.camera.x += Math.max(-maxStep, Math.min(maxStep, dx));
        state.camera.y += Math.max(-maxStep, Math.min(maxStep, dy));

        const maxZoomPerSec = 1.0;
        const maxZoomStep = maxZoomPerSec * dt;
        const dZ = desiredZoom - state.camera.zoom;
        state.camera.zoom += Math.max(-maxZoomStep, Math.min(maxZoomStep, dZ));

        return; // Skip normal camera logic during match end zoom
      }
    }

    // Initialize camera frame counter for intro lock
    if (typeof state.camera.framesSinceStart !== "number") {
      state.camera.framesSinceStart = 0;
    }
    state.camera.framesSinceStart += 1;
    // Distance-based intro mode: start zoomed out to show full stage, exit when players get close
    if (state.camera.introModeActive === undefined) {
      state.camera.introModeActive = true;
    }
    if (state.cameraIntroHoldUntilClose === undefined) {
      // Default to enabled unless explicitly disabled
      state.cameraIntroHoldUntilClose = true;
    }

    // If camera is locked to bounds, center on bounds and lock zoom (no tracking)
    if (LOCK_TO_BOUNDS) {
      let targetX, targetY;
      if (state.cameraBounds) {
        targetX = state.cameraBounds.x + state.cameraBounds.width / 2;
        // For locked camera, center exactly on bounds without vertical offset
        targetY = state.cameraBounds.y + state.cameraBounds.height / 2;
      } else {
        targetX = GameState.CONSTANTS.NATIVE_WIDTH / 2;
        // For locked camera, center exactly without vertical offset
        targetY = GameState.CONSTANTS.NATIVE_HEIGHT / 2;
      }
      const smoothFactor = 1 - Math.exp(-SMOOTHING * dt);
      state.camera.zoom = lerp(state.camera.zoom, MIN_ZOOM, smoothFactor);
      state.camera.x = lerp(state.camera.x, targetX, smoothFactor);
      state.camera.y = lerp(state.camera.y, targetY, smoothFactor);
      return;
    }

    // If auto-zoom is disabled (but not locked), lock to MIN_ZOOM and follow players
    if (DISABLE_AUTO_ZOOM) {
      const targetX = (p1.pos.x + p2.pos.x) / 2;
      const targetY = (p1.pos.y + p2.pos.y) / 2 + VERTICAL_OFFSET;

      if (state.debug?.cameraLogging) {
        console.log(
          `📷 Auto-zoom disabled: targetX=${targetX.toFixed(
            1
          )}, targetY=${targetY.toFixed(1)}, zoom=${MIN_ZOOM}`
        );
      }

      const smoothFactor = 1 - Math.exp(-SMOOTHING * dt);
      state.camera.zoom = lerp(state.camera.zoom, MIN_ZOOM, smoothFactor);
      state.camera.x = lerp(state.camera.x, targetX, smoothFactor);
      state.camera.y = lerp(state.camera.y, targetY, smoothFactor);
      return;
    }

    const minX = Math.min(p1.pos.x, p2.pos.x);
    const maxX = Math.max(p1.pos.x, p2.pos.x);
    const minY = Math.min(p1.pos.y, p2.pos.y);
    const maxY = Math.max(p1.pos.y, p2.pos.y);

    // Calculate immediate box dimensions
    const immediateBoxWidth = maxX - minX;
    const immediateBoxHeight = maxY - minY;

    // Smooth box dimensions to prevent jumpy zoom during jumps
    // This creates a delayed reaction so the camera doesn't instantly zoom when players jump
    const boxSmoothFactor = 1 - Math.exp(-BOX_SMOOTHING * dt);
    state.camera._smoothedBox.width = lerp(
      state.camera._smoothedBox.width,
      immediateBoxWidth,
      boxSmoothFactor
    );
    state.camera._smoothedBox.height = lerp(
      state.camera._smoothedBox.height,
      immediateBoxHeight,
      boxSmoothFactor
    );

    // Use smoothed box dimensions for zoom calculation
    const boxWidth = state.camera._smoothedBox.width;
    const boxHeight = state.camera._smoothedBox.height;

    // Use NATIVE dimensions for consistent zoom calculation
    const zoomX = GameState.CONSTANTS.NATIVE_WIDTH / (boxWidth + PADDING_X * 2);
    const zoomY =
      GameState.CONSTANTS.NATIVE_HEIGHT / (boxHeight + PADDING_Y * 2);
    let targetZoom = Math.min(zoomX, zoomY);
    const rawTargetZoom = targetZoom; // store unclamped zoom for intro exit check

    if (state.debug?.cameraLogging) {
      console.log(
        `📷 Zoom calculation: boxWidth=${boxWidth.toFixed(
          1
        )}, boxHeight=${boxHeight.toFixed(1)}, zoomX=${zoomX.toFixed(
          3
        )}, zoomY=${zoomY.toFixed(3)}, rawTarget=${targetZoom.toFixed(3)}`
      );
    }

    // Clamp to stage-specific zoom range
    const originalTarget = targetZoom;
    targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, targetZoom));

    if (state.debug?.cameraLogging && originalTarget !== targetZoom) {
      console.log(
        `📷 Zoom clamped: ${originalTarget.toFixed(3)} → ${targetZoom.toFixed(
          3
        )} (MIN=${MIN_ZOOM}, MAX=${MAX_ZOOM})`
      );
    }

    let idealTargetX = minX + boxWidth / 2;
    let idealTargetY = minY + boxHeight / 2 + VERTICAL_OFFSET;

    // Predictive lead (X only for iteration 2), clamped to ±5% of view width
    const leadFactor =
      typeof state.cameraPredictiveLeadFactor === "number"
        ? state.cameraPredictiveLeadFactor
        : 0;
    if (leadFactor > 0) {
      const avgVelX = ((p1.vel?.x || 0) + (p2.vel?.x || 0)) / 2;
      const leadXRaw = avgVelX * leadFactor;
      const viewWForLead = GameState.CONSTANTS.NATIVE_WIDTH / targetZoom;
      const leadClamp = 0.05 * viewWForLead;
      const leadX = Math.max(-leadClamp, Math.min(leadClamp, leadXRaw));
      idealTargetX += leadX;
    }

    // Store ideal target before clamping for smooth bounds transitions
    let targetX = idealTargetX;
    let targetY = idealTargetY;

    // Intro lock: keep camera centered on stage for first N frames
    const introFrames = state.cameraIntroLockFrames | 0;
    if (introFrames > 0 && state.camera.framesSinceStart <= introFrames) {
      if (state.cameraBounds) {
        idealTargetX = state.cameraBounds.x + state.cameraBounds.width / 2;
        idealTargetY =
          state.cameraBounds.y +
          state.cameraBounds.height / 2 +
          VERTICAL_OFFSET;
        targetX = idealTargetX;
        targetY = idealTargetY;
      } else {
        idealTargetX = GameState.CONSTANTS.NATIVE_WIDTH / 2;
        idealTargetY = GameState.CONSTANTS.NATIVE_HEIGHT / 2 + VERTICAL_OFFSET;
        targetX = idealTargetX;
        targetY = idealTargetY;
      }
      targetZoom = MIN_ZOOM;
    }
    // Distance-based intro mode: force full-stage view until players are close enough
    if (state.cameraIntroHoldUntilClose && state.camera.introModeActive) {
      // Exit intro when the desired (raw) zoom would be meaningfully above min zoom (players are close)
      const introExitThreshold = MIN_ZOOM * 1.05; // 5% hysteresis
      const introTimeoutFrames =
        typeof state.cameraIntroTimeoutFrames === "number"
          ? state.cameraIntroTimeoutFrames
          : (state.cameraIntroLockFrames | 0) + 120; // default ~2s after intro lock ends
      const hasTimedOut =
        state.camera.framesSinceStart > Math.max(introTimeoutFrames, 0);

      if (rawTargetZoom > introExitThreshold || hasTimedOut) {
        state.camera.introModeActive = false;
      } else {
        if (state.cameraBounds) {
          idealTargetX = state.cameraBounds.x + state.cameraBounds.width / 2;
          idealTargetY =
            state.cameraBounds.y +
            state.cameraBounds.height / 2 +
            VERTICAL_OFFSET;
          targetX = idealTargetX;
          targetY = idealTargetY;
        } else {
          idealTargetX = GameState.CONSTANTS.NATIVE_WIDTH / 2;
          idealTargetY =
            GameState.CONSTANTS.NATIVE_HEIGHT / 2 + VERTICAL_OFFSET;
          targetX = idealTargetX;
          targetY = idealTargetY;
        }
        targetZoom = MIN_ZOOM;
      }
    }

    const viewWidth = GameState.CONSTANTS.NATIVE_WIDTH / targetZoom;
    const viewHeight = GameState.CONSTANTS.NATIVE_HEIGHT / targetZoom;

    // Apply deadzone (focus) before clamping, using current view size
    const dz = state.cameraDeadzone;
    if (dz && typeof dz.width === "number" && typeof dz.height === "number") {
      const halfViewW = viewWidth / 2;
      const halfViewH = viewHeight / 2;
      const allowMoveX =
        Math.abs(idealTargetX - state.camera.x) > dz.width * halfViewW;
      const allowMoveY =
        Math.abs(idealTargetY - state.camera.y) > dz.height * halfViewH;
      if (!allowMoveX) idealTargetX = state.camera.x;
      if (!allowMoveY) idealTargetY = state.camera.y;
      targetX = idealTargetX;
      targetY = idealTargetY;
    }

    // Initialize smoothed clamped position for bounds transitions
    if (!state.camera._lastClampedTarget) {
      state.camera._lastClampedTarget = { x: idealTargetX, y: idealTargetY };
    }

    if (state.cameraBounds) {
      const bounds = state.cameraBounds;

      if (state.debug?.cameraLogging) {
        console.log(
          `📷 Camera bounds applied: x=${bounds.x}, y=${bounds.y}, width=${bounds.width}, height=${bounds.height}`
        );
      }

      let minX, maxX, minY, maxY;

      if (viewWidth > bounds.width) {
        // View is wider than bounds; lock to stage center to avoid exposing empty space.
        minX = maxX = bounds.x + bounds.width / 2;
      } else {
        // View is narrower than bounds, so we clamp the camera position
        // to keep the view inside the bounds.
        minX = bounds.x + viewWidth / 2;
        maxX = bounds.x + bounds.width - viewWidth / 2;
      }

      if (viewHeight > bounds.height) {
        minY = maxY = bounds.y + bounds.height / 2;
      } else {
        minY = bounds.y + viewHeight / 2;
        maxY = bounds.y + bounds.height - viewHeight / 2;
      }

      // Extreme Mode: if enabled and a player is outside camera_bounds but inside blast_bounds,
      // use blast bounds for clamping and allow additional zoom-out down to blast-bounds min
      let useBlast = false;
      let bminX, bmaxX, bminY, bmaxY;
      if (state.cameraEnableBlastBounds && state.cameraBlastBounds) {
        const b = bounds;
        const bb = state.cameraBlastBounds;
        const isOutsideCam = (px, py) =>
          px < b.x || px > b.x + b.width || py < b.y || py > b.y + b.height;
        const isInsideBlast = (px, py) =>
          px >= bb.x &&
          px <= bb.x + bb.width &&
          py >= bb.y &&
          py <= bb.y + bb.height;
        const p1OutsideInside =
          isOutsideCam(p1.pos.x, p1.pos.y) && isInsideBlast(p1.pos.x, p1.pos.y);
        const p2OutsideInside =
          isOutsideCam(p2.pos.x, p2.pos.y) && isInsideBlast(p2.pos.x, p2.pos.y);
        useBlast = p1OutsideInside || p2OutsideInside;
        if (useBlast) {
          // Recompute clamp ranges with blast bounds
          const bbx = state.cameraBlastBounds;
          if (viewWidth > bbx.width) {
            bminX = bmaxX = bbx.x + bbx.width / 2;
          } else {
            bminX = bbx.x + viewWidth / 2;
            bmaxX = bbx.x + bbx.width - viewWidth / 2;
          }
          if (viewHeight > bbx.height) {
            bminY = bmaxY = bbx.y + bbx.height / 2;
          } else {
            bminY = bbx.y + viewHeight / 2;
            bmaxY = bbx.y + bbx.height - viewHeight / 2;
          }

          // Allow zoom below normal MIN_ZOOM but not below blast-bounds minimum
          const extremeMinZoom = Math.max(
            GameState.CONSTANTS.NATIVE_WIDTH / bbx.width,
            GameState.CONSTANTS.NATIVE_HEIGHT / bbx.height
          );
          if (targetZoom < extremeMinZoom) targetZoom = extremeMinZoom;
        }
      }

      if (!useBlast) {
        // Calculate clamped position
        const clampedX = Math.max(minX, Math.min(maxX, idealTargetX));
        const clampedY = Math.max(minY, Math.min(maxY, idealTargetY));

        // Smooth the clamped position to prevent jitter when both players push in opposite directions
        // Use faster smoothing when moving away from bounds, slower when approaching bounds
        const boundsSmoothing = 6.0; // Faster than main smoothing for responsive bounds
        const boundsSmoothFactor = 1 - Math.exp(-boundsSmoothing * dt);
        state.camera._lastClampedTarget.x = lerp(
          state.camera._lastClampedTarget.x,
          clampedX,
          boundsSmoothFactor
        );
        state.camera._lastClampedTarget.y = lerp(
          state.camera._lastClampedTarget.y,
          clampedY,
          boundsSmoothFactor
        );

        targetX = state.camera._lastClampedTarget.x;
        targetY = state.camera._lastClampedTarget.y;
      } else {
        // Blast bounds mode: smooth clamped position as well
        const clampedX = Math.max(bminX, Math.min(bmaxX, idealTargetX));
        const clampedY = Math.max(bminY, Math.min(bmaxY, idealTargetY));

        const boundsSmoothing = 6.0;
        const boundsSmoothFactor = 1 - Math.exp(-boundsSmoothing * dt);
        state.camera._lastClampedTarget.x = lerp(
          state.camera._lastClampedTarget.x,
          clampedX,
          boundsSmoothFactor
        );
        state.camera._lastClampedTarget.y = lerp(
          state.camera._lastClampedTarget.y,
          clampedY,
          boundsSmoothFactor
        );

        targetX = state.camera._lastClampedTarget.x;
        targetY = state.camera._lastClampedTarget.y;
      }
    } else {
      // No bounds: clamp to native screen bounds with smoothing
      const clampedX = Math.max(
        viewWidth / 2,
        Math.min(GameState.CONSTANTS.NATIVE_WIDTH - viewWidth / 2, idealTargetX)
      );
      const clampedY = Math.max(
        viewHeight / 2,
        Math.min(
          GameState.CONSTANTS.NATIVE_HEIGHT - viewHeight / 2,
          idealTargetY
        )
      );

      // Smooth clamped position
      const boundsSmoothing = 6.0;
      const boundsSmoothFactor = 1 - Math.exp(-boundsSmoothing * dt);
      state.camera._lastClampedTarget.x = lerp(
        state.camera._lastClampedTarget.x,
        clampedX,
        boundsSmoothFactor
      );
      state.camera._lastClampedTarget.y = lerp(
        state.camera._lastClampedTarget.y,
        clampedY,
        boundsSmoothFactor
      );

      targetX = state.camera._lastClampedTarget.x;
      targetY = state.camera._lastClampedTarget.y;
    }

    const smoothFactor = 1 - Math.exp(-SMOOTHING * dt);
    // Compute desired values via smoothing
    const desiredZoom = lerp(state.camera.zoom, targetZoom, smoothFactor);
    const desiredX = lerp(state.camera.x, targetX, smoothFactor);
    const desiredY = lerp(state.camera.y, targetY, smoothFactor);

    // Apply rate limits to avoid visible jumps
    // Limit camera translation to a fraction of the current view size per second
    const maxTransPerSec =
      (GameState.CONSTANTS.NATIVE_WIDTH / targetZoom) * 1.5; // 1.5 screen widths per second
    const maxStep = maxTransPerSec * dt;
    const dx = desiredX - state.camera.x;
    const dy = desiredY - state.camera.y;
    const clampedDx = Math.max(-maxStep, Math.min(maxStep, dx));
    const clampedDy = Math.max(-maxStep, Math.min(maxStep, dy));
    state.camera.x += clampedDx;
    state.camera.y += clampedDy;

    // Limit zoom rate (units per second)
    const maxZoomPerSec = state.cameraMaxZoomPerSec ?? 1.5; // Use stage-specific setting or default
    const maxZoomStep = maxZoomPerSec * dt;
    const dZ = desiredZoom - state.camera.zoom;
    const clampedDZ = Math.max(-maxZoomStep, Math.min(maxZoomStep, dZ));
    state.camera.zoom += clampedDZ;

    if (state.debug?.cameraLogging) {
      console.log(
        `📷 Final camera: x=${state.camera.x.toFixed(
          1
        )}, y=${state.camera.y.toFixed(1)}, zoom=${state.camera.zoom.toFixed(
          3
        )}, targetZoom=${targetZoom.toFixed(3)}`
      );
    }
  }
  function spawnProjectile(state, p, attackType = "l1", target = null) {
    if (attackType === "r2_projectile" && p.charName === "cyboard") {
      const proj = {
        type: "cyboard_sword",
        owner: p,
        pos: { x: p.pos.x, y: p.pos.y - 50 },
        vel: { x: 0, y: -1200 }, // Shoots straight up
        anim: "r2_projectile",
        frameIndex: 0,
        frameTime: 0,
        state: "rising", // "rising", "hanging", "returning"
        startY: p.pos.y,
        visible: true,
        returnStartTime: null, // Will be set when entering "returning" state
      };
      state.projectiles.push(proj);
      return;
    }

    if (attackType === "ernst_ulti_projectile") {
      // Ernst Ultimate: Fast horizontal projectile (spawns 2x per ulti_loop)
      const descriptor = AttackCatalog.getDescriptor(p, "r2_l2_ulti");
      const projConfig = descriptor?.projectile || {};
      const damagePerHit = projConfig.damagePerHit || 256;
      const resolvedTarget =
        target && typeof target === "object" ? target : null;
      let targetIndex = -1;
      let targetPadIndex = null;
      let targetCenterY = p.pos.y - 80;
      if (resolvedTarget && Array.isArray(state.players)) {
        targetIndex = state.players.indexOf(resolvedTarget);
        targetPadIndex =
          typeof resolvedTarget.padIndex === "number"
            ? resolvedTarget.padIndex
            : null;
        try {
          const targetHb = Renderer.getHurtbox(resolvedTarget);
          if (targetHb) {
            targetCenterY = targetHb.top + targetHb.h * 0.5;
          }
        } catch (err) {
          console.warn(
            "Renderer hurtbox lookup failed for ulti projectile target",
            err
          );
        }
      }

      const facing =
        typeof p.attack?.lockedFacing === "number"
          ? p.attack.lockedFacing
          : p.facing || 1;

      const startPos = {
        x: p.pos.x + facing * 50,
        y: targetCenterY,
      };
      const proj = {
        type: "ernst_ulti_projectile",
        owner: p,
        pos: { ...startPos },
        prevPos: { ...startPos },
        startPos: { ...startPos },
        vel: {
          x: facing * 2000, // Very fast horizontal speed
          y: 0, // Purely horizontal
        },
        anim: "ulti_projectile", // Dedicated Ernst ultimate projectile animation
        frameIndex: 0,
        frameTime: 0,
        damage: damagePerHit,
        knockbackMultiplier: 0, // No knockback
        maxRange:
          resolvedTarget && Number.isFinite(projConfig.maxRange)
            ? projConfig.maxRange
            : Infinity,
        traveledDistance: 0,
        lockedTargetIndex: targetIndex,
        lockedTargetPad: targetPadIndex,
        lockedTarget: resolvedTarget || null,
      };
      console.log("[ErnstUlt] Projectile seeded.", {
        player: p.padIndex,
        facing,
        targetPad: resolvedTarget?.padIndex ?? null,
        startPos,
      });
      state.projectiles.push(proj);
      return;
    }

    if (
      (attackType === "l2_projectile" || attackType === "l2_mushroom") &&
      (p.charName === "HP" || p.charName.toLowerCase() === "ernst")
    ) {
      // HP/ernst: L2 Mushroom Projectile (parabolic trajectory like Cyboard's bomb)
      const pconf = p.config.physics;
      const charge = p.attack.chargeT || 0;
      const minPower = pconf.jumpSpeed * 0.7;
      const maxPower = pconf.jumpSpeed * 2.1;
      const power = minPower + (maxPower - minPower) * (charge / 2.0); // Charge time 0-2s

      const angle = (60 * Math.PI) / 180; // 60 degrees in radians

      const startPos = { x: p.pos.x + p.facing * 50, y: p.pos.y - 80 };
      const proj = {
        type: "hp_mushroom",
        owner: p,
        pos: { ...startPos },
        prevPos: { ...startPos },
        startPos: { ...startPos }, // Track start position for flight distance calculation
        vel: {
          x: p.facing * power * Math.cos(angle),
          y: -power * Math.sin(angle),
        },
        anim: "l2_projectile",
        frameIndex: 0,
        frameTime: 0,
        damage: 0, // Initialize damage
        knockbackMultiplier: 1.0, // Initialize knockback multiplier
      };
      state.projectiles.push(proj);
      return;
    }

    // Default: Cyboard's bomb
    const pconf = p.config.physics;
    const charge = p.attack.chargeT || 0;
    const minPower = pconf.jumpSpeed * 0.7;
    const maxPower = pconf.jumpSpeed * 2.1;
    const power = minPower + (maxPower - minPower) * (charge / 1.5);

    const angle = (60 * Math.PI) / 180; // 60 degrees in radians

    const startPos = { x: p.pos.x + p.facing * 50, y: p.pos.y - 80 };
    const proj = {
      owner: p,
      pos: { ...startPos },
      prevPos: { ...startPos },
      startPos: { ...startPos }, // Track start position for flight distance calculation
      vel: {
        x: p.facing * power * Math.cos(angle),
        y: -power * Math.sin(angle),
      },
      anim: "l1_object_loop",
      damage: 0, // Initialize damage
      knockbackMultiplier: 1.0, // Initialize knockback multiplier
    };
    state.projectiles.push(proj);
  }
  function spawnEffect(state, p, animName, options = {}) {
    const charName = p.charName || p.owner?.charName;
    if (!charName) {
      console.warn("Cannot spawn effect, no character context:", {
        p,
        animName,
      });
      return;
    }
    const charData = state.characterConfigs[charName];
    const frames = charData.animations[animName];
    if (!frames || frames.length === 0) return;
    const isProjectileContext = !!p.owner && p !== p.owner && !p.charName;
    const basePos = {
      x: options.x ?? p.pos?.x ?? p.owner?.pos?.x ?? 0,
      y: options.y ?? p.pos?.y ?? p.owner?.pos?.y ?? 0,
    };
    const facing = options.facing ?? p.facing ?? p.owner?.facing ?? 1;
    const baseSpeed = options.speed ?? 1;
    // REMOVED: r1_fx speed logic (assets deleted)

    // For R2 effects, attach to owner so they move with the character
    const isR2Effect = animName.startsWith("r2_fx");
    const shouldFollowOwner =
      options.followOwner ?? (isR2Effect && options.followOwner !== false);
    const effectOwner =
      options.owner || (shouldFollowOwner ? p.owner || p : undefined);

    const effect = {
      charName, // <-- THIS IS THE FIX
      frames,
      fps: charData.fps,
      frameIndex: 0,
      time: 0,
      pos: basePos,
      facing,
      offsetX: options.offsetX ?? (isProjectileContext ? 0 : 32),
      offsetY: options.offsetY ?? (isProjectileContext ? 0 : -16),
      speed: baseSpeed,
      done: false,
      // NEW: Make R2 effects follow the character
      isCharacterEffect: shouldFollowOwner,
      owner: effectOwner,
    };

    if (options.scale !== undefined) effect.scale = options.scale;
    if (options.duration !== undefined) effect.duration = options.duration;
    if (options.isLooped !== undefined) effect.isLooped = options.isLooped;
    if (options.layer !== undefined) effect.layer = options.layer;
    if (options.zIndex !== undefined) effect.zIndex = options.zIndex;
    if (options.target !== undefined) effect.target = options.target;
    if (options.onComplete !== undefined)
      effect.onComplete = options.onComplete;

    state.effects.push(effect);
    return effect;
  }

  // Test function for dance_spot animation
  window.testDanceSpotEffect = function (state, x = 400, y = 300) {
    spawnGlobalEffect(state, { pos: { x, y }, facing: 1 }, "dance_spot", {
      x: x,
      y: y,
      scale: 1.0,
      duration: 2.0,
      isLooped: true,
    });
  };

  window.spawnGlobalEffect = function (state, p, animName, options = {}) {
    // Cooldown for knockback effects to prevent multiple overlapping
    if (animName.includes("fx_knockback") && p.lastKnockbackEffectTime) {
      const timeSinceLastEffect = state.lastTime - p.lastKnockbackEffectTime;
      if (timeSinceLastEffect < 0.3) {
        // 300ms cooldown
        return;
      }
    }

    const atlases = [
      state.fxAtlas3,
      state.fxAtlas2,
      state.fxAtlas,
      state.stageFxAtlas,
    ].filter(Boolean);

    let atlas = null;
    let frames = null;

    debugLog(
      "spawnGlobalEffect: Searching for animation",
      animName,
      "in atlases:",
      atlases.map((a) => (a ? "loaded" : "null"))
    );

    for (let i = 0; i < atlases.length; i++) {
      const candidate = atlases[i];
      const candidateFrames = candidate.animations?.[animName];
      const atlasName =
        candidate === state.fxAtlas3
          ? "fxAtlas3"
          : candidate === state.fxAtlas2
          ? "fxAtlas2"
          : candidate === state.fxAtlas
          ? "fxAtlas"
          : "unknown";

      debugLog(
        candidateFrames ? `${candidateFrames.length} frames` : "not found"
      );

      // Debug logging for beat charge animation search
      if (
        animName === "fx_charged_beat" ||
        (animName && animName.includes("beat_match_charge"))
      ) {
        console.log(
          `[spawnGlobalEffect] Checking ${atlasName} for "${animName}":`,
          {
            hasAnimations: !!candidate.animations,
            hasAnimation: !!candidate.animations?.[animName],
            framesLength: candidateFrames?.length,
            frames: candidateFrames,
          }
        );
      }

      if (candidateFrames && candidateFrames.length) {
        atlas = candidate;
        frames = candidateFrames;
        if (
          animName === "fx_charged_beat" ||
          (animName && animName.includes("beat_match_charge"))
        ) {
          console.log(
            `[spawnGlobalEffect] Found "${animName}" in ${atlasName} with ${frames.length} frames`
          );
        }
        break;
      }
    }

    // Debug logging for beat charge animation search result
    if (
      animName === "fx_charged_beat" ||
      (animName && animName.includes("beat_match_charge"))
    ) {
      console.log(`[spawnGlobalEffect] Final result for "${animName}":`, {
        found: !!atlas,
        atlasName: atlas
          ? atlas === state.fxAtlas3
            ? "fxAtlas3"
            : atlas === state.fxAtlas2
            ? "fxAtlas2"
            : atlas === state.fxAtlas
            ? "fxAtlas"
            : "unknown"
          : "none",
        framesCount: frames?.length,
      });
    }

    if (!atlas || !frames) {
      console.warn("spawnGlobalEffect: Animation not found:", animName);
      const availableInFxAtlas = state.fxAtlas?.animations
        ? Object.keys(state.fxAtlas.animations)
        : [];
      const availableInFxAtlas2 = state.fxAtlas2?.animations
        ? Object.keys(state.fxAtlas2.animations)
        : [];
      const availableInFxAtlas3 = state.fxAtlas3?.animations
        ? Object.keys(state.fxAtlas3.animations)
        : [];

      console.warn("spawnGlobalEffect: Available animations:", {
        fxAtlas:
          availableInFxAtlas.length > 0 ? availableInFxAtlas : "not loaded",
        fxAtlas2:
          availableInFxAtlas2.length > 0 ? availableInFxAtlas2 : "not loaded",
        fxAtlas3:
          availableInFxAtlas3.length > 0 ? availableInFxAtlas3 : "not loaded",
        searchingFor: animName,
        foundInFxAtlas: availableInFxAtlas.includes(animName),
        foundInFxAtlas2: availableInFxAtlas2.includes(animName),
        foundInFxAtlas3: availableInFxAtlas3.includes(animName),
      });

      debugLog(
        "Available animations in fxAtlas3:",
        state.fxAtlas3?.animations
          ? Object.keys(state.fxAtlas3.animations)
          : "not loaded"
      );
      debugLog(
        "Available animations in fxAtlas2:",
        state.fxAtlas2?.animations
          ? Object.keys(state.fxAtlas2.animations)
          : "not loaded"
      );
      debugLog(
        "Available animations in fxAtlas:",
        state.fxAtlas?.animations
          ? Object.keys(state.fxAtlas.animations)
          : "not loaded"
      );
      return;
    }

    const hurtbox = Renderer.getHurtbox(p);

    let offsetY = -hurtbox.h / 2; // Default: Centered on hurtbox
    if (animName === "fx_knockback") {
      offsetY = 0; // Align with player's origin (feet) instead of centering
    } else if (animName === "dance_spot") {
      offsetY = 0; // Dance spots use exact positioning from options
    } else if (animName === "fx_charged_beat") {
      offsetY = 0; // No offset for beat charge aura
    } else if (animName && animName.includes("beat_match_charge")) {
      offsetY = 0; // No offset for beat match charge effects
    }

    const speedOverrides = {
      fx_knockback_standard: 2,
      fx_knockback_dash: 2,
      fx_knockback_launcher: 2,
      fx_knockback_explosion: 2,
      fx_clank: 2,
      fx_wall_hit: 2,
    };

    const baseSpeed =
      animName === "fx_hurt"
        ? 7.995
        : animName === "fx_hurt_knockback"
        ? 3
        : animName === "fx_death"
        ? 3
        : animName === "dance_spot"
        ? 1.0 // Normal 12 FPS for dance spots
        : 1.5;

    const effect = {
      isGlobal: true,
      atlas,
      frames,
      fps: atlas.fps,
      frameIndex: 0,
      time: 0,
      pos: { ...p.pos },
      facing: p.facing,
      offsetX: 0,
      offsetY,
      speed: speedOverrides[animName] ?? baseSpeed,
      done: false,
      ...options, // This will now include the optional 'target'
    };

    // For dance spots, use exact positioning from options
    if (
      animName === "dance_spot" &&
      options.x !== undefined &&
      options.y !== undefined
    ) {
      effect.pos.x = options.x;
      effect.pos.y = options.y;
    }

    debugLog({
      frames: frames.length,
      fps: atlas.fps,
      speed: effect.speed,
      pos: effect.pos,
      atlas:
        atlas === state.fxAtlas3
          ? "fxAtlas3"
          : atlas === state.fxAtlas2
          ? "fxAtlas2"
          : atlas === state.fxAtlas
          ? "fxAtlas"
          : "stageFxAtlas",
    });

    // Set cooldown timestamp for knockback effects
    if (animName.includes("fx_knockback")) {
      p.lastKnockbackEffectTime = state.lastTime;
    }

    state.effects.push(effect);
    return effect; // Return the effect so it can be stored (e.g., for beat charge aura)
  };
  function resolveHits(state) {
    const finalHits = new Map(); // Map<target, winningHit>

    // 1. Handle trades and clanks first
    const hitsToProcess = [...state.pendingHits];
    const processedIndices = new Set();

    for (let i = 0; i < hitsToProcess.length; i++) {
      if (processedIndices.has(i)) continue;

      const hit1 = hitsToProcess[i];
      if (!hit1.descriptor && hit1.descriptorOverride) {
        hit1.descriptor = hit1.descriptorOverride;
      }
      if (!hit1.descriptor && hit1.attacker) {
        hit1.descriptor = AttackCatalog.getDescriptor(
          hit1.attacker,
          hit1.attackType,
          {
            chargeTime:
              hit1.attacker.attack?.chargeTime ||
              hit1.attacker.attack?.chargeT ||
              hit1.attacker.attack?.loopTime ||
              0,
          }
        );
      }

      for (let j = i + 1; j < hitsToProcess.length; j++) {
        if (processedIndices.has(j)) continue;

        const hit2 = hitsToProcess[j];
        if (!hit2.descriptor && hit2.descriptorOverride) {
          hit2.descriptor = hit2.descriptorOverride;
        }
        if (!hit2.descriptor && hit2.attacker) {
          hit2.descriptor = AttackCatalog.getDescriptor(
            hit2.attacker,
            hit2.attackType,
            {
              chargeTime:
                hit2.attacker.attack?.chargeTime ||
                hit2.attacker.attack?.chargeT ||
                hit2.attacker.attack?.loopTime ||
                0,
            }
          );
        }

        // Check if players are hitting each other
        if (hit1.attacker === hit2.target && hit1.target === hit2.attacker) {
          const desc1 = hit1.descriptor;
          const desc2 = hit2.descriptor;

          // NEW: Use descriptor damage for comparison
          const damage1 = desc1
            ? calculateFinalDamage(hit1.attacker, desc1)
            : hit1.damage ?? 0;
          const damage2 = desc2
            ? calculateFinalDamage(hit2.attacker, desc2)
            : hit2.damage ?? 0;

          if (damage1 > damage2) {
            // P1 wins, P2's attack is cancelled
            processedIndices.add(j);
            AttackCatalog.logTrade("damage-win", hit1, hit2);
          } else if (damage2 > damage1) {
            // P2 wins, P1's attack is cancelled
            processedIndices.add(i);
            AttackCatalog.logTrade("damage-win", hit2, hit1);
          } else {
            // Equal damage - check for clank or trade
            const clankAllowed =
              (desc1?.clankable ?? true) && (desc2?.clankable ?? true);

            if (clankAllowed) {
              // Both clank
              AttackCatalog.logTrade("clank", hit1, hit2);

              const clankFx = desc1?.fx?.clank ||
                desc2?.fx?.clank || {
                  type: "global",
                  id: "fx_clank",
                  options: { speed: 1.5 },
                };

              const midX = (hit1.attacker.pos.x + hit1.target.pos.x) / 2;
              const midY = (hit1.attacker.pos.y + hit1.target.pos.y) / 2 - 50;

              if (clankFx?.id) {
                spawnGlobalEffect(
                  state,
                  { pos: { x: midX, y: midY }, facing: hit1.attacker.facing },
                  clankFx.id,
                  clankFx.options || {}
                );
              }

              processedIndices.add(i);
              processedIndices.add(j);
            } else {
              // Trade (both hit)
              AttackCatalog.logTrade("trade", hit1, hit2);
              // Don't add to processedIndices - let both hits process
            }
          }

          if (processedIndices.has(i) && processedIndices.has(j)) {
            processedIndices.add(i);
            processedIndices.add(j);
          }
          // Found the interaction, no need to check other hits for hit1
          break;
        }
      }
    }

    const validHits = hitsToProcess.filter(
      (_, index) => !processedIndices.has(index)
    );

    // 2. Determine the single winning hit for each target
    for (const hit of validHits) {
      const { target, damage } = hit;
      if (!hit.descriptor && hit.attacker) {
        hit.descriptor = AttackCatalog.getDescriptor(
          hit.attacker,
          hit.attackType
        );
      }
      if (!finalHits.has(target)) {
        finalHits.set(target, hit);
        continue;
      }

      const current = finalHits.get(target);
      const descHit = hit.descriptor;
      const descCurrent = current.descriptor;

      const priorityHit = descHit?.priority ?? damage ?? 0;
      const priorityCurrent = descCurrent?.priority ?? current.damage ?? 0;

      if (priorityHit > priorityCurrent) {
        finalHits.set(target, hit);
      } else if (priorityHit === priorityCurrent) {
        const chargeHit = descHit?.chargeRank ?? 0;
        const chargeCurrent = descCurrent?.chargeRank ?? 0;
        if (chargeHit > chargeCurrent) {
          finalHits.set(target, hit);
        } else if (chargeHit === chargeCurrent) {
          if ((damage ?? 0) > (current.damage ?? 0)) {
            finalHits.set(target, hit);
          } else if ((damage ?? 0) === (current.damage ?? 0)) {
            // prefer the hit that originated earlier in processing (current stays)
          }
        }
      }
    }

    // 3. Apply the winning hits
    for (const [target, hit] of finalHits.entries()) {
      const { attacker, damage, stun, knockback, attackType } = hit;

      // --- Re-adding special hit logic that was in detectHits ---
      if (attackType === "r2_combo" && attacker.charName === "cyboard") {
        attacker.attack.hitConfirmed = true;
        target.isGrabbed = true;
        target.vel = { x: 0, y: 0 };
        const desc = hit.descriptorOverride || hit.descriptor;
        const projType = desc?.projectile?.type || "r2_projectile";
        spawnProjectile(state, attacker, projType, target);
        attacker.swordIsOut = true;
      } else if (
        attackType === "r2" &&
        attacker.charName === "cyboard" &&
        attacker.attack?.wasMaxCharge
      ) {
        // Cyboard R2 max charge hit: Start slow-motion effect
        // IMPORTANT: Only start slow-motion if not already active and target not already hit
        if (
          !attacker.attack.slowMotionActive &&
          !attacker.attack.hitTargets?.has(target)
        ) {
          attacker.attack.slowMotionActive = true;
          attacker.attack.slowMotionTimer = 0;
          attacker.attack.slowMotionDuration = 0.3; // 0.3 seconds slow-mo (reduced from 0.6)
          attacker.attack.slowMotionHitTarget = target;
          attacker.attack.originalDashSpeed =
            attacker.attack.dashSpeed || attacker.vel.x;
          state.timeScale = 0.2; // Slow down to 20% speed (strong slow-motion)

          // Mark target as hit to prevent duplicate hits
          if (!(attacker.attack.hitTargets instanceof Set)) {
            attacker.attack.hitTargets = new Set();
          }
          attacker.attack.hitTargets.add(target);

          // Store target's frozen state (will be restored or used for knockback)
          if (!target.attack) target.attack = {};
          target.attack.frozenVel = { x: target.vel.x, y: target.vel.y };
          target.vel.x = 0;
          target.vel.y = 0;

          // Don't apply damage/knockback yet - wait for slow-motion to end
          console.log("🎬 Cyboard R2 Max Charge: Slow-motion activated");
          continue; // Skip normal hit processing
        }
      } else if (attackType === "r1_up_attack") {
        const descriptor = hit.descriptorOverride;
        if (descriptor) {
          AttackSystem.applyDamageWithDescriptor(
            attacker,
            target,
            descriptor,
            state
          );
        }
      } else {
        const descriptor = hit.descriptorOverride || hit.descriptor;
        if (descriptor) {
          AttackSystem.applyDamageWithDescriptor(
            attacker,
            target,
            descriptor,
            state
          );
        } else {
          console.error("Hit without descriptor:", hit);
        }
      }
      // --- End special hit logic ---
    }
  }

  function spawnRhythmEffect(state, p) {
    if (!state.fxAtlas) return;

    // Rhythm effect disabled - no more beatmatch particles on rhythm hits
    // if (ParticleManager && ParticleManager.emitBeatmatchParticles) {
    //   ParticleManager.emitBeatmatchParticles(p.pos.x, p.pos.y, state);
    // }
  }
  // HP Bike Ultimate Collision Detection (also for ernst)
  function checkHPBikeCollision(p, state) {
    if (
      (p.charName.toLowerCase() !== "hp" &&
        p.charName.toLowerCase() !== "ernst") ||
      p.ultiPhase !== "active"
    )
      return;

    // Get HP's current position and create a collision box
    const bikeHitbox = {
      left: p.pos.x - 128, // Half character width
      top: p.pos.y - 128, // Half character height
      w: 256, // Full character width
      h: 256, // Full character height
    };

    // Check collision with all other players
    for (const target of state.players) {
      if (target === p || target.eliminated || target.invincible) continue;

      const targetHurtbox = Renderer.getHurtbox(target);

      if (rectsIntersect(bikeHitbox, targetHurtbox)) {
        // HP hit someone with his bike! - Use descriptor system
        const bikeDamage = 20; // 20% damage
        const bikeStun = 0.3; // Short stun

        // Get HP's horizontal speed (absolute value)
        const hpSpeed = Math.abs(p.vel.x);

        // Calculate angle based on speed: faster = steeper (more vertical)
        // Speed range: ~0-800, map to angle range: 30° - 70° (more horizontal to more vertical)
        const minAngle = Math.PI / 6; // 30° (more horizontal)
        const maxAngle = (7 * Math.PI) / 18; // 70° (steeper)
        const speedFactor = Math.min(hpSpeed / 800, 1); // Normalize to 0-1
        const angle = minAngle + speedFactor * (maxAngle - minAngle);

        // Create pending hit with descriptor
        const pendingHit = {
          attacker: p,
          target: target,
          damage: bikeDamage,
          stun: bikeStun,
          knockback: 400, // Base knockback
          attackType: "r2_l2_ulti", // HP ultimate
          pos: { x: p.pos.x, y: p.pos.y },
          angle: angle,
          facing: p.facing,
        };

        // Attach descriptor for priority/FX system
        pendingHit.descriptor = AttackCatalog.getDescriptor(p, "r2_l2_ulti");

        // Apply damage and effects using descriptor system
        const bikeDescriptor = AttackCatalog.getDescriptor(p, "r2_l2_ulti");
        AttackSystem.applyDamageWithDescriptor(
          p,
          target,
          bikeDescriptor,
          state
        );
        debugLog(
          `[HP Bike] Hit ${
            target.charName
          } for ${bikeDamage}% damage (speed: ${hpSpeed.toFixed(0)}, angle: ${(
            (angle * 180) /
            Math.PI
          ).toFixed(1)}°) - Descriptor: ${pendingHit.descriptor.tier}`
        );

        // Give target brief invincibility to prevent spam damage
        target.invincible = true;
        target.invincibilityTimer = 0.5; // 0.5 seconds
      }
    }
  }

  function triggerScreenFlash(state, intensity = 1.0) {
    state.screenFlash.active = true;
    state.screenFlash.startTime = state.lastTime;

    // Adjust duration based on intensity
    if (intensity !== 1.0) {
      state.screenFlash.duration = 0.3 * intensity;
    } else {
      // Reset to default values
      state.screenFlash.duration = 0.3;
      state.screenFlash.color = "rgba(255, 255, 255, 0.8)";
    }
  }

  // NEW: Check if match should end and start end sequence
  function checkMatchEnd(state) {
    if (!state.players || state.players.length < 2) return;

    const alivePlayers = [];
    for (let i = 0; i < state.players.length; i++) {
      if (!state.players[i].eliminated) {
        alivePlayers.push(i);
      }
    }

    if (alivePlayers.length === 1) {
      const survivor = alivePlayers[0];
      state.matchEnd.lastKnownAliveIndex = survivor;
      // Analytics: Track match end
      if (window.AnalyticsClient) {
        const winner = state.players[survivor];
        window.AnalyticsClient.trackEvent("match_end", {
          winner: survivor,
          winnerCharacter: winner?.charName || "unknown",
          matchDuration: state.lastTime || 0,
        });
      }
      startMatchEndSequence(state, survivor);
    } else if (alivePlayers.length === 0) {
      const fallbackWinner = state.matchEnd.lastKnownAliveIndex;
      if (typeof fallbackWinner === "number") {
        startMatchEndSequence(state, fallbackWinner);
      } else if (!state.matchEnd.isActive) {
        debugLog(
          "[MatchEnd] No surviving players detected; defaulting winner to player 0"
        );
        state.matchEnd.lastKnownAliveIndex = 0;
        startMatchEndSequence(state, 0);
      }
    } else {
      state.matchEnd.lastKnownAliveIndex = null;
    }
  }
  // NEW: Start the end-of-match sequence
  function startMatchEndSequence(state, winnerIndex) {
    if (state.matchEnd.isActive) return; // Prevent multiple triggers

    debugLog("Starting match end sequence for winner:", winnerIndex);

    // Clean up any active dance battle effects
    if (state.danceBattle.active) {
      endDanceBattle(state);
    }

    // NEW: Reset Dance Mode audio filter to full spectrum
    if (
      state.danceMode?.active &&
      window.AudioSystem &&
      window.AudioSystem.setMainFilter
    ) {
      window.AudioSystem.setMainFilter(20000, 1.0, 3); // Priority 3 > Dance Mode (2)
      console.log("[Dance Mode] Audio filter reset to full spectrum (20000Hz)");
    }

    // Initialize match end state
    state.matchEnd.isActive = true;
    state.matchEnd.phase = "zooming";
    state.matchEnd.winner = winnerIndex;
    state.matchEnd.startTime = state.lastTime;
    state.matchEnd.zoomStartTime = state.lastTime;
    state.matchEnd.perfectBeatCount = 0;

    // Reset visual effects
    state.matchEnd.screenGrayAlpha = 0;
    state.matchEnd.modalSlideOffset = 0;

    const winnerPlayer = state.players?.[winnerIndex];
    if (winnerPlayer && window.DanceCatalog) {
      const showcase = window.DanceCatalog.getCharacterDanceShowcaseAnimation?.(
        winnerPlayer.charName
      );
      if (showcase) {
        const showcaseName =
          showcase.metadata?.name ||
          `dance_showcase_${(winnerPlayer.charName || "unknown")
            .toLowerCase()
            .replace(/\s+/g, "_")}`;
        console.log(
          `[MatchEnd] Triggering dance showcase for ${winnerPlayer.charName}`
        );
        window.DanceCatalog.applyAnimation(
          winnerPlayer,
          showcase,
          showcaseName
        );
      } else {
        console.warn(
          `[MatchEnd] No dance showcase available for ${winnerPlayer.charName}`
        );
      }
    }

    // Activate audio effects (technicolor like in dance battle)
    state.matchEnd.technicolorActive = true;
    state.matchEnd.gaterActive = false; // Will be activated on perfect beats

    // Start dance phase for technicolor effects
    if (window.AudioSystem && window.AudioSystem.startDancePhase) {
      window.AudioSystem.startDancePhase(1.5, {
        filterFreq: 20000,
        bpm: state.currentBPM || 120,
      });
      debugLog(
        "?? End sequence: Dance phase activated for technicolor effects"
      );
    }

    // Activate WebGL technicolor effects
    if (window.WebGLRenderer && window.WebGLRenderer.setDancePhase) {
      window.WebGLRenderer.setDancePhase(true, 1.0);
    }
  }
  // NEW: Update match end sequence
  function updateMatchEndSequence(dt, state) {
    if (!state.matchEnd.isActive) return;

    const me = state.matchEnd;
    const currentTime = state.lastTime;

    switch (me.phase) {
      case "zooming":
        // Zoom in on winner for 8 seconds (8 bars)
        if (currentTime - me.zoomStartTime >= me.zoomDuration) {
          // Transition directly to results phase (skip beatmatching)
          me.phase = "showingResults";
          me.audioFadeStartTime = currentTime;
          me.screenGrayStartTime = currentTime;
        }
        break;

      case "showingResults":
        // Handle audio fade, screen graying, and modal display
        const audioFadeProgress = Math.min(
          1,
          (currentTime - me.audioFadeStartTime) / me.audioFadeDuration
        );
        const screenGrayProgress = Math.min(
          1,
          (currentTime - me.screenGrayStartTime) / me.screenGrayDuration
        );

        // Start audio fade immediately when entering showingResults phase
        if (
          audioFadeProgress === 0 &&
          window.AudioSystem &&
          window.AudioSystem.stopMusic
        ) {
          window.AudioSystem.stopMusic(me.audioFadeDuration);
        }

        // Update screen gray alpha
        me.screenGrayAlpha = screenGrayProgress * 0.6; // Max 60% opacity

        // Start modal after screen is grayed
        if (screenGrayProgress >= 1 && !me.modalShowStartTime) {
          me.modalShowStartTime = currentTime;
        }

        // Update modal slide animation
        if (me.modalShowStartTime) {
          const modalProgress = Math.min(
            1,
            (currentTime - me.modalShowStartTime) / me.modalShowDuration
          );
          me.modalSlideOffset = 1 - modalProgress; // Slide in from bottom

          // Show modal when animation is complete
          if (modalProgress >= 1) {
            state.modal.isOpen = true;
            state.modal.selectedButton = 0; // Reset to first button
          }
        }

        // Complete sequence when everything is done
        if (
          audioFadeProgress >= 1 &&
          screenGrayProgress >= 1 &&
          me.modalShowStartTime &&
          currentTime - me.modalShowStartTime >= me.modalShowDuration
        ) {
          me.phase = "complete";

          // Deactivate WebGL technicolor effects
          if (window.WebGLRenderer && window.WebGLRenderer.setDancePhase) {
            window.WebGLRenderer.setDancePhase(false, 0.0);
            debugLog("?? End sequence: WebGL technicolor effects deactivated");
          }

          // Deactivate audio dance phase
          if (window.AudioSystem && window.AudioSystem.endDancePhase) {
            window.AudioSystem.endDancePhase(1.0);
          }
        }
        break;
    }
  }

  // Initialize MovementSystem with dependencies after all functions are defined
  MovementSystem.init({
    canUseAbility,
    startCooldown,
    setAnim,
  });

  // Initialize AttackSystem with dependencies after all functions are defined
  AttackSystem.init({
    canUseAbility,
    startCooldown,
    setAnim,
    spawnEffect,
    spawnGlobalEffect,
    checkRhythmBonus,
    spawnRhythmEffect,
    rectsIntersect,
    spawnProjectile,
    getBeatWindowQuality,
  });

  return {
    update,
    createPlayer,
    isInBeatWindow,
    getBeatWindowQuality,
    triggerScreenFlash,
    spawnStageAnimation, // NEW: Export stage animation spawner
    spawnStageAnimationsFromHeatmap, // NEW: Export heatmap-based animation spawner
    spawnTutorialDanceSpots, // NEW: Export tutorial dance spot spawner
    spawnDanceSpotsFromHeatmap, // NEW: Export dance mode spot spawner
    selectRandomActiveSpot, // NEW: Export random spot selector
    resolveHits, // NEW: Export for warmup (prevents first-hit stutter)
    startDanceBattle, // NEW: Export for DanceSpotManager
    updateStageAnimations, // NEW: allow rendering to advance stage animations even when physics is paused
  };
})();
