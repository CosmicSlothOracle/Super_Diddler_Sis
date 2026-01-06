window.AttackSystem = (() => {
  /**
   * Centralized attack and combat system.
   * Handles all attack logic, hit detection, damage calculation, and combat mechanics.
   *
   * This system provides a clean separation of attack logic from the main
   * physics engine, making it easier to maintain and extend.
   */

  /**
   * Handle all attack inputs and logic
   * @param {number} dt - Delta time
   * @param {Object} p - Player object
   * @param {Object} inputs - Input state
   * @param {Object} state - Game state
   */
  /**
   * Update perfect beat match tracking (called when perfect beat is detected during dance move)
   * Tracks up to 9 perfect beats for beat match charge
   */
  function updatePerfectBeatMatch(p, state) {
    // Initialize perfect beat counter if not exists
    if (p.perfectBeatCount === undefined) {
      p.perfectBeatCount = 0;
    }

    // Increment and cap at 9
    const oldCount = p.perfectBeatCount;
    p.perfectBeatCount = Math.min(p.perfectBeatCount + 1, 9);

    console.log(
      `[BeatMatch] P${
        p.padIndex + 1
      }: updatePerfectBeatMatch called, count: ${oldCount} -> ${
        p.perfectBeatCount
      }`
    );

    // Update visual effects based on beat count
    updateBeatMatchVisualEffects(p, state);
  }

  /**
   * Reset perfect beat match counter (called when non-perfect beat is detected)
   */
  function resetPerfectBeatMatch(p) {
    p.perfectBeatCount = 0;
    // Clear all visual effects
    clearBeatMatchVisualEffects(p);
  }

  /**
   * Update visual effects for beat match charge
   * Shows different effects based on beat count (A-I)
   * Beat Match Charge A is shown for all levels 1-9, additional effects appear at higher levels
   */
  function updateBeatMatchVisualEffects(p, state) {
    // Legacy Aura Effect disabled - now using Particle System (emitBeatChargeParticles in Physics/ParticleSystem)
    // Just ensure we clear any existing legacy effects to prevent double rendering
    clearBeatMatchVisualEffects(p);
  }

  /**
   * Clear all beat match visual effects
   */
  function clearBeatMatchVisualEffects(p) {
    if (p.beatMatchEffects) {
      p.beatMatchEffects.forEach((effect) => {
        if (effect) {
          effect.done = true;
        }
      });
      p.beatMatchEffects = [];
    }
  }

  function handleAttacks(dt, p, inputs, state) {
    // EDGE CASE FIX: Block all attack inputs when player is grabbed
    if (p.isGrabbed) {
      return; // Grabbed targets cannot perform any attacks
    }

    // EDGE CASE FIX: Block all new attack inputs when grab is active (grabber cannot start new attacks)
    if (p.attack && p.attack.type === "grab") {
      updateAttackStates(dt, p, state, inputs);
      // If a beat-match refresh was queued during the grab, apply it now that the attack state updated.
      if (p._beatMatchRefreshPending && p.attack && p.attack.type === "none") {
        updateBeatMatchVisualEffects(p, state);
        p._beatMatchRefreshPending = false;
      }
      return; // Grabber must finish grab before starting new attacks
    }

    // Update existing attack state first to keep timers in sync
    if (p.attack && p.attack.type !== "none") {
      updateAttackStates(dt, p, state, inputs);
      // Apply any queued beat-match visual updates once the attack fully finishes.
      if (p._beatMatchRefreshPending && p.attack && p.attack.type === "none") {
        updateBeatMatchVisualEffects(p, state);
        p._beatMatchRefreshPending = false;
      }
      return;
    }

    // Determine if player is grounded for move selection
    const grounded = !!p.grounded;

    // Clear beat match visual effects when any attack starts (beats will be consumed on hit)
    function clearBeatMatchEffects() {
      clearBeatMatchVisualEffects(p);
    }

    // Handle R1 attacks (Light attacks)
    if (inputs.r1Down && canUseAbility(p, "r1")) {
      // Analytics: Track input action
      if (window.AnalyticsClient) {
        window.AnalyticsClient.trackInput("r1", p.padIndex);
      }
      clearBeatMatchEffects();
      handleR1Attack(p, inputs, state, grounded, dt);
      // Track attack usage for tutorial
      if (window.TutorialSystem && state.tutorial?.active) {
        // Only track for legacy tutorial steps, not Part 2
        if (state.tutorial?.part !== 2) {
          window.TutorialSystem.trackAttackUsage(state, p, "r1");
        }
      }
      return;
    }

    // Handle R2 attacks (Heavy attacks)
    if (inputs.r2Down && canUseAbility(p, "r2")) {
      // Analytics: Track input action
      if (window.AnalyticsClient) {
        window.AnalyticsClient.trackInput("r2", p.padIndex);
      }
      clearBeatMatchEffects();
      handleR2Attack(p, inputs, state, grounded);
      // Track attack usage for tutorial
      if (window.TutorialSystem && state.tutorial?.active) {
        // Only track for legacy tutorial steps, not Part 2
        if (state.tutorial?.part !== 2) {
          window.TutorialSystem.trackAttackUsage(state, p, "r2");
        }
      }
      return;
    }

    // Handle L1 attacks (Special attacks)
    if (inputs.l1Down && canUseAbility(p, "l1")) {
      // Analytics: Track input action
      if (window.AnalyticsClient) {
        window.AnalyticsClient.trackInput("l1", p.padIndex);
      }
      clearBeatMatchEffects();
      handleL1Attack(p, inputs, state, grounded);
      // Track attack usage for tutorial
      if (window.TutorialSystem && state.tutorial?.active) {
        // Only track for legacy tutorial steps, not Part 2
        if (state.tutorial?.part !== 2) {
          window.TutorialSystem.trackAttackUsage(state, p, "l1");
        }
      }
      return;
    }

    // Handle L2 attacks (Charged attacks)
    if (inputs.l2Down && canUseAbility(p, "l2")) {
      // Analytics: Track input action
      if (window.AnalyticsClient) {
        window.AnalyticsClient.trackInput("l2", p.padIndex);
      }
      clearBeatMatchEffects();
      handleL2Attack(p, inputs, state, grounded);
      // Track attack usage for tutorial
      if (window.TutorialSystem && state.tutorial?.active) {
        // Only track for legacy tutorial steps, not Part 2
        if (state.tutorial?.part !== 2) {
          window.TutorialSystem.trackAttackUsage(state, p, "l2");
        }
      }
      return;
    }

    // Handle Ultimate attacks (do not consume beat match charges)
    if (inputs.ultiDown && canUseAbility(p, "ultimate")) {
      // Analytics: Track input action
      if (window.AnalyticsClient) {
        window.AnalyticsClient.trackInput("ultimate", p.padIndex);
      }
      handleUltimateAttack(p, inputs, state, grounded);
      return;
    }

    // Handle Grab (New Mechanic)
    if (inputs.grabDown) {
      clearBeatMatchEffects();
      handleGrab(p, inputs, state, grounded, dt);
    }
  }

  /**
   * Execute the Grab Signature Mechanic:
   * 1. Steal ALL Beat Charges from victim -> Add to attacker (Max 9)
   * 2. Destroy ALL Ultimeter Segments of victim (Set to 0)
   */
  function executeGrabSignatureMechanic(attacker, victim, state) {
    if (!attacker || !victim) return;

    // 1. Steal Beat Charges
    const victimCharges = victim.perfectBeatCount || 0;
    if (victimCharges > 0) {
      attacker.perfectBeatCount = Math.min(
        (attacker.perfectBeatCount || 0) + victimCharges,
        9
      );
      // Defer applying visual beat-match effects until attack finishes to avoid
      // triggering dance/animation changes mid-grab which can cause loops.
      attacker._beatMatchRefreshPending = true;
      // Clear victim immediately
      resetPerfectBeatMatch(victim);
    }

    // 2. Destroy Ultimeter (Set to 0)
    if (victim.ultimeter && victim.ultimeter.current > 0) {
      victim.ultimeter.current = 0;
      victim.ultimeter.isReady = false;
    }
  }

  /**
   * Handle Grab attacks
   */
  function handleGrab(p, inputs, state, grounded, dt) {
    const charKey = p.charName.toLowerCase();
    // Generic initialization
    if (!p.attack || p.attack.type !== "grab") {
      if (!grounded) return; // Grabs are grounded only for now
      console.log(`[Grab] P${p.padIndex + 1} (${charKey}) started GRAB`);
      p.attack = {
        type: "grab",
        phase: "windup",
        owner: "mod",
        grabbedTarget: null,
        grabChecked: false,
        liftApplied: false,
        grabStartY: p.pos.y,
      };
      setAnim(p, "grab_windup", false, state, 1);
      p.vel.x = 0; // Stop movement
      return;
    }

    // Delegate to character specific handlers
    if (charKey === "cyboard" || charKey === "ernst") {
      handleCyboardGrab(p, inputs, state, dt);
    } else if (charKey === "fritz") {
      handleFritzGrab(p, inputs, state, dt);
    } else if (charKey === "hp") {
      handleHPGrab(p, inputs, state, dt);
    } else {
      // Generic fallback or other characters
      handleDefaultGrab(p, inputs, state, dt);
    }
  }

  function handleDefaultGrab(p, inputs, state, dt) {
    // Fallback for characters without specific grab logic yet
    if (p.animFinished) {
      if (p.attack.phase === "windup") {
        p.attack.phase = "active";
        setAnim(p, "grab_active", false, state, 1);
      } else {
        p.attack = { type: "none", phase: "none" };
      }
    }
  }

  function handleFritzGrab(p, inputs, state, dt) {
    const descriptor = AttackCatalog.getDescriptor(p, "grab");
    const grabConfig = descriptor.grab || {};

    // 1. Windup Phase
    if (p.attack.phase === "windup") {
      if (p.animFinished) {
        p.attack.phase = "active";
        // Grant temporary invincibility during the grab execution to avoid self-hits
        p.invincible = true;
        setAnim(p, "grab_active", false, state, 1);
      }
      return;
    }

    // 2. Active Phase
    if (p.attack.phase === "active") {
      const currentFrame = p.frameIndex;

      // Hit Detection (Frames 0-1)
      if (
        currentFrame < (grabConfig.detectFrames || 2) &&
        !p.attack.grabChecked
      ) {
        const grabRect = Renderer.getHurtbox(p);
        // Base expansion for grab detection (fallback to 120px - increased for robustness)
        const _grabExpansionBase =
          (typeof grabConfig !== "undefined" && grabConfig.range) || 120;
        const _grabExpansion =
          p?.perfectBeatCount > 0
            ? Math.round(_grabExpansionBase * 1.2)
            : _grabExpansionBase;
        // Also expand vertically to catch dodges
        grabRect.h *= 1.3; // 30% taller hitbox
        grabRect.w += _grabExpansion;
        // Extend backwards slightly to catch roll dodges
        const backwardExtension = Math.round(_grabExpansion * 0.4);
        grabRect.w += backwardExtension;
        if (p.facing === -1) {
          grabRect.left -= _grabExpansion + backwardExtension;
        } else {
          grabRect.left -= backwardExtension;
        }

        for (const target of state.players) {
          if (target === p || target.eliminated) continue;

          // Clank Check
          if (
            target.attack?.type === "grab" &&
            (target.attack.phase === "windup" ||
              target.attack.phase === "active")
          ) {
            const targetRect = Renderer.getHurtbox(target);
            if (rectsIntersect(grabRect, targetRect)) {
              console.log(
                `[Grab] CLANK triggered with P${target.padIndex + 1}`
              );
              p.attack.phase = "clank";
              setAnim(p, "grab_clank", false, state, 1);
              spawnGlobalEffect(state, p, "fx_clank");
              target.attack.phase = "clank";
              target.attack.grabbedTarget = null;
              setAnim(target, "grab_clank", false, state, 1);
              return;
            }
          }

          // Hit Check
          const hurtRect = Renderer.getHurtbox(target);
          if (rectsIntersect(grabRect, hurtRect)) {
            // EDGE CASE FIX: Cannot grab invincible targets (respawn, ultimate, etc.)
            if (target.invincible || target.isInvincible) {
              console.log(
                `[Grab] BLOCKED: Target P${target.padIndex + 1} is invincible`
              );
              continue;
            }

            // EDGE CASE FIX: Cannot grab targets that are already grabbed
            if (target.isGrabbed) {
              console.log(
                `[Grab] BLOCKED: Target P${
                  target.padIndex + 1
                } is already grabbed`
              );
              continue;
            }

            // EDGE CASE FIX: Cannot grab targets with active shield
            if (target.shield?.active) {
              console.log(
                `[Grab] BLOCKED: Target P${
                  target.padIndex + 1
                } has active shield`
              );
              continue;
            }

            // EDGE CASE FIX: Cannot grab targets that are respawning
            // Only block if actually respawning (respawnState === "respawn"), not if it's "none"
            if (target.respawnState === "respawn") {
              console.log(
                `[Grab] BLOCKED: Target P${target.padIndex + 1} is respawning`
              );
              continue;
            }

            // EDGE CASE FIX: Cannot grab during protected animations (dance, ultimate, walljump)
            // Only check if animation is actually set and not finished
            const isDanceAnimation =
              target.anim &&
              typeof target.anim === "string" &&
              target.anim.includes("dance") &&
              !target.animFinished;
            const isFritzUltimate =
              target.charName === "fritz" &&
              target.ultiPhase &&
              target.anim &&
              (target.anim === "r2_l2_ulti" ||
                target.anim === "r2_l2_ulti_start");
            const isWalljump = target.walljumpActive === true;

            if (isDanceAnimation || isFritzUltimate || isWalljump) {
              console.log(
                `[Grab] BLOCKED: Target P${
                  target.padIndex + 1
                } is in protected animation (anim: ${
                  target.anim
                }, dance: ${isDanceAnimation}, ultimate: ${isFritzUltimate}, walljump: ${isWalljump})`
              );
              continue;
            }

            if (target.attack && target.attack.type !== "none") {
              const targetDescriptor = AttackCatalog.getDescriptor(
                target,
                target.attack.type,
                {
                  chargeTime: target.attack.chargeT || 0,
                  chargeRatio: target.attack.chargeRatio,
                }
              );
              const grabPriority = descriptor.priority || 40;
              const targetPriority = targetDescriptor.priority || 0;
              const targetPhase = target.attack.phase || "none";
              let targetDetectPhases = targetDescriptor.detectInPhase || [
                "active",
                "dash",
                "release",
                "start",
              ];
              if (
                targetPriority > grabPriority &&
                targetDetectPhases.includes(targetPhase)
              ) {
                console.log(`[Grab] BLOCKED by higher priority`);
                continue;
              }
            }

            console.log(`[Grab] HIT target P${target.padIndex + 1}`);
            p.attack.grabbedTarget = target;
            p.attack.grabChecked = true;
            target.isGrabbed = true;
            target.grabbedBy = p;
            // UNIVERSAL: clear target's current attack to avoid cross-hit loops
            target.attack = { type: "none", phase: "none" };
            target.vel.x = 0;
            target.vel.y = 0;
            // Initial snap
            target.pos.x = p.pos.x + p.facing * 50;
            target.pos.y = p.pos.y;
            setAnim(target, "is_grabbed", true, state, 1);
            break;
          }
        }

        // EDGE CASE FIX: Mark grab as checked after detection phase ends, even if no target was found
        // This prevents the grab from staying in detection phase forever
        if (
          currentFrame >= (grabConfig.detectFrames || 2) &&
          !p.attack.grabChecked
        ) {
          p.attack.grabChecked = true;
        }
      }

      // Target Manipulation
      // EDGE CASE FIX: Release target if grabber is eliminated
      if (p.eliminated && p.attack.grabbedTarget) {
        const target = p.attack.grabbedTarget;
        target.isGrabbed = false;
        target.grabbedBy = null;
        p.attack.grabbedTarget = null;
        p.attack.phase = "recovery";
        return;
      }

      const target = p.attack.grabbedTarget;
      if (target && !target.eliminated) {
        const throwFrame = grabConfig.throwFrame || 7;

        // Position handling during hold
        if (currentFrame < throwFrame) {
          target.vel.x = 0;
          target.vel.y = 0;

          // 1. First Active (Frame 0+): Directly in front, slightly elevated
          let offsetX = 50;
          let offsetY = -10;

          // 2. Third Active (Frame 2): Push into Fritz's frame
          if (currentFrame >= 2 && currentFrame < throwFrame - 2) {
            offsetX = 20; // Pull closer
          }
          // 3. Second to last Active: Return to start position
          else if (currentFrame >= throwFrame - 2) {
            offsetX = 50; // Back to initial grab distance
          }

          target.pos.x = p.pos.x + p.facing * offsetX;
          target.pos.y = p.pos.y + offsetY;
        }

        // Throw
        if (currentFrame >= throwFrame) {
          target.isGrabbed = false;
          p.attack.grabbedTarget = null;
          executeGrabSignatureMechanic(p, target, state);
          applyDamageWithDescriptor(p, target, descriptor, state);

          // Force transition to recovery
          p.attack.phase = "recovery";
          setAnim(p, "grab_recovery", false, state, 0.5);
        }
      } else if (
        !p.attack.grabbedTarget &&
        currentFrame >= (grabConfig.detectFrames || 2)
      ) {
        p.attack.phase = "recovery";
        setAnim(p, "grab_recovery", false, state, 0.5);
      }
    }

    // 3. Recovery / Clank
    if (p.attack.phase === "recovery" || p.attack.phase === "clank") {
      if (p.animFinished) {
        p.attack = { type: "none", phase: "none" };
      }
    }
  }

  function handleHPGrab(p, inputs, state, dt) {
    const descriptor = AttackCatalog.getDescriptor(p, "grab");
    const grabConfig = descriptor.grab || {};

    // Prevent self-interruption during grab
    if (p.attack.phase === "active") {
      p.invincible = true;
    }

    if (p.attack.phase === "windup") {
      console.log(
        `[Grab DEBUG] HP windup phase, animFinished=${p.animFinished}`
      );
      if (p.animFinished) {
        console.log(`[Grab DEBUG] HP transitioning windup -> active`);
        p.attack.phase = "active";
        setAnim(p, "grab_active", false, state, 1);
      }
      return;
    }

    if (p.attack.phase === "active") {
      const currentFrame = p.frameIndex;

      // DEBUG: Log active phase progress
      console.log(
        `[Grab DEBUG] HP active phase: frame ${currentFrame}, grabChecked=${
          p.attack.grabChecked
        }, grabbedTarget=${p.attack.grabbedTarget?.charName || "none"}`
      );

      // Hit Detection (Frames 0-1)
      if (
        currentFrame < (grabConfig.detectFrames || 2) &&
        !p.attack.grabChecked
      ) {
        const grabRect = Renderer.getHurtbox(p);
        const _grabExpansionBase =
          (typeof grabConfig !== "undefined" && grabConfig.range) || 120;
        const _grabExpansion =
          p?.perfectBeatCount > 0
            ? Math.round(_grabExpansionBase * 1.44)
            : _grabExpansionBase;
        // Ensure grab box is at least 40% wider than character hurtbox (increased from 30%)
        const minExpansion = Math.ceil(grabRect.w * 0.4);
        const finalExpansion = Math.max(_grabExpansion, minExpansion);
        // Also expand vertically to catch dodges
        grabRect.h *= 1.4; // 40% taller hitbox
        // Extend backwards slightly to catch roll dodges
        const backwardExtension = Math.round(finalExpansion * 0.5);
        grabRect.w += finalExpansion + backwardExtension;
        if (p.facing === -1) {
          grabRect.left -= finalExpansion + backwardExtension;
        } else {
          grabRect.left -= backwardExtension;
        }

        for (const target of state.players) {
          if (target === p || target.eliminated) continue;
          if (
            target.attack?.type === "grab" &&
            (target.attack.phase === "windup" ||
              target.attack.phase === "active")
          ) {
            const targetRect = Renderer.getHurtbox(target);
            if (rectsIntersect(grabRect, targetRect)) {
              p.attack.phase = "clank";
              setAnim(p, "grab_clank", false, state, 1);
              spawnGlobalEffect(state, p, "fx_clank");
              target.attack.phase = "clank";
              releaseGrabbedTarget(target, state);
              setAnim(target, "grab_clank", false, state, 1);
              return;
            }
          }
          const hurtRect = Renderer.getHurtbox(target);
          if (rectsIntersect(grabRect, hurtRect)) {
            // VALIDATION CHECKS
            if (
              target.invincible ||
              target.isInvincible ||
              target.shield?.active ||
              target.respawnState === "respawn" ||
              target.isGrabbed
            ) {
              continue;
            }

            const isDanceAnimation =
              target.anim &&
              typeof target.anim === "string" &&
              target.anim.includes("dance") &&
              !target.animFinished;
            const isFritzUltimate =
              target.charName === "fritz" && target.ultiPhase;
            const isWalljump = target.walljumpActive === true;

            if (isDanceAnimation || isFritzUltimate || isWalljump) {
              console.log(`[Grab] BLOCKED: Target Protected`);
              continue;
            }

            if (target.attack && target.attack.type !== "none") {
              const targetDescriptor = AttackCatalog.getDescriptor(
                target,
                target.attack.type
              );
              const grabPriority = descriptor.priority || 40;
              const targetPriority = targetDescriptor.priority || 0;
              const targetPhase = target.attack.phase || "none";
              let targetDetectPhases = targetDescriptor.detectInPhase || [
                "active",
                "dash",
                "release",
                "start",
              ];
              if (
                targetPriority > grabPriority &&
                targetDetectPhases.includes(targetPhase)
              )
                continue;
            }

            console.log(`[Grab] HIT target P${target.padIndex + 1}`);
            p.attack.grabbedTarget = target;
            p.attack.grabChecked = true;
            target.isGrabbed = true;
            target.grabbedBy = p;
            // CRITICAL FIX: CANCEL VICTIM'S ATTACK
            target.attack = { type: "none", phase: "none" };
            target.vel.x = 0;
            target.vel.y = 0;
            target.pos.x = p.pos.x;
            target.pos.y = p.pos.y;
            setAnim(target, "is_grabbed", true, state, 1);
            break;
          }
        }

        if (
          currentFrame >= (grabConfig.detectFrames || 2) &&
          !p.attack.grabChecked
        ) {
          p.attack.grabChecked = true;
        }
      }

      // EDGE CASE FIX: Release target if grabber is eliminated
      if (p.eliminated && p.attack.grabbedTarget) {
        const target = p.attack.grabbedTarget;
        target.isGrabbed = false;
        target.grabbedBy = null;
        target.rotation = 0; // Reset rotation
        p.attack.grabbedTarget = null;
        p.attack.phase = "recovery";
        p.invincible = false;
        return;
      }

      const target = p.attack.grabbedTarget;
      if (target && !target.eliminated) {
        // DEBUG: Log HP grab progress
        console.log(
          `[Grab DEBUG] HP frame ${currentFrame}, throwFrame=${
            grabConfig.throwFrame || 7
          }, target=${target.charName}, targetGrabbed=${target.isGrabbed}`
        );

        // HP Logic:
        target.rotation = 90 * p.facing;
        target.pos.x = p.pos.x; // Centered under HP
        target.pos.y = (p.attack.grabStartY || p.pos.y) + 20; // Ground level + 20 offset
        target.vel.x = 0;
        target.vel.y = 0;

        // HP Jump Logic: Apex doubled to -240
        const jumpOffsets = {
          0: 0,
          1: -10,
          2: -30,
          3: -60,
          4: -140,
          5: -150, // Apex (doubled)
          6: -90, // Slam
          7: 0, // Land
        };
        const offset =
          jumpOffsets[currentFrame] !== undefined
            ? jumpOffsets[currentFrame]
            : 0;

        if (!p.attack.grabStartY) p.attack.grabStartY = p.pos.y;
        p.pos.y = p.attack.grabStartY + offset;
        p.vel.y = 0;
        p.vel.x = 0;

        // Throw/Impact
        if (currentFrame >= (grabConfig.throwFrame || 7)) {
          console.log(`[Grab] HP Piledriver Impact! (frame ${currentFrame})`);

          // 1. EXECUTE MECHANICS (Steal charges first to boost damage)
          executeGrabSignatureMechanic(p, target, state);

          // 2. ATOMIC RELEASE - CRITICAL FIX
          // Remove "grabbed" status BEFORE applying damage/knockback.
          console.log(`[Grab DEBUG] Releasing ${target.charName} from HP grab`);
          target.isGrabbed = false;
          target.grabbedBy = null;
          target.rotation = 0; // Reset rotation
          p.attack.grabbedTarget = null;

          // CRITICAL: Use proper release function to ensure cleanup
          releaseGrabbedTarget(p, state);

          // 3. Reset Position
          p.pos.y = p.attack.grabStartY; // Ensure HP lands

          // 4. Apply Damage (now separate entities)
          applyDamageWithDescriptor(p, target, descriptor, state);

          // 5. Cleanup
          p.invincible = false;
          p.attack.phase = "recovery";
          setAnim(p, "grab_recovery", false, state, 0.5);
        }
      } else if (
        !p.attack.grabbedTarget &&
        currentFrame >= (grabConfig.detectFrames || 2)
      ) {
        console.log(`[Grab DEBUG] HP grab missed, transitioning to recovery`);
        p.attack.phase = "recovery";
        p.invincible = false;
        setAnim(p, "grab_recovery", false, state, 0.5);
      }

      // EMERGENCY: If grab has been active for too long, force release
      if (p.attack.grabbedTarget && currentFrame > 20) {
        console.log(
          `[Grab DEBUG] EMERGENCY: HP grab stuck at frame ${currentFrame}, force releasing`
        );
        releaseGrabbedTarget(p, state);
        p.attack.phase = "recovery";
        p.invincible = false;
        setAnim(p, "grab_recovery", false, state, 0.5);
      }
    }

    if (p.attack.phase === "recovery" || p.attack.phase === "clank") {
      console.log(
        `[Grab DEBUG] HP recovery/clank phase, animFinished=${p.animFinished}`
      );
      p.invincible = false;
      if (p.animFinished) {
        console.log(`[Grab DEBUG] HP grab fully completed`);
        p.attack = { type: "none", phase: "none" };
      }
    }
  }

  function handleCyboardGrab(p, inputs, state, dt) {
    const descriptor = AttackCatalog.getDescriptor(p, "grab");
    const grabConfig = descriptor.grab || {};

    // 1. Windup Phase (2 Frames)
    if (p.attack.phase === "windup") {
      if (p.animFinished) {
        console.log(`[Grab] Cyboard windup finished -> active`);
        p.attack.phase = "active";
        // Make Cyboard invincible during the grab hold to avoid self-hits
        p.invincible = true;
        p.attack.activeFrameCount = 0;
        setAnim(p, "grab_active", false, state, 1); // 8 Frames
      }
      return;
    }

    // 2. Active Phase (8 Frames)
    if (p.attack.phase === "active") {
      const currentFrame = p.frameIndex; // Relative to grab_active anim
      // Maintain invincibility while the grab is holding a victim
      p.invincible = true;

      // Detect Frames (0-1)
      if (currentFrame < (grabConfig.detectFrames || 2)) {
        if (!p.attack.grabChecked) {
          // Check for grab hit
          const grabRect = Renderer.getHurtbox(p); // Simplified grab box (body range)
          // Expand rect slightly forward (scale up when beat-charged)
          const _grabExpansionBase =
            (typeof grabConfig !== "undefined" && grabConfig.range) || 120;
          const _grab_expansion =
            p?.perfectBeatCount > 0
              ? Math.round(_grabExpansionBase * 1.44)
              : _grabExpansionBase;
          // Ensure grab box is at least 40% wider than character hurtbox (increased from 30%)
          const minExpansion = Math.ceil(grabRect.w * 0.4);
          const finalExpansion = Math.max(_grab_expansion, minExpansion);
          // Also expand vertically to catch dodges
          grabRect.h *= 1.4; // 40% taller hitbox
          // Extend backwards slightly to catch roll dodges
          const backwardExtension = Math.round(finalExpansion * 0.5);
          grabRect.w += finalExpansion + backwardExtension;
          if (p.facing === -1) {
            grabRect.left -= finalExpansion + backwardExtension;
          } else {
            grabRect.left -= backwardExtension;
          }

          for (const target of state.players) {
            if (target === p || target.eliminated) continue;

            // Clank Check: If target is also grabbing in detection phase
            if (
              target.attack?.type === "grab" &&
              (target.attack.phase === "windup" ||
                target.attack.phase === "active")
            ) {
              const targetRect = Renderer.getHurtbox(target);
              if (rectsIntersect(grabRect, targetRect)) {
                // CLANK!
                console.log(
                  `[Grab] CLANK triggered with P${target.padIndex + 1}`
                );
                p.attack.phase = "clank";
                setAnim(p, "grab_clank", false, state, 1);
                spawnGlobalEffect(state, p, "fx_clank"); // Visual feedback

                // Force target to clank too (simultaneous interaction)
                target.attack.phase = "clank";
                releaseGrabbedTarget(target, state);
                setAnim(target, "grab_clank", false, state, 1);
                p.invincible = false;
                return;
              }
            }

            // Normal Hit Check
            const hurtRect = Renderer.getHurtbox(target);
            if (rectsIntersect(grabRect, hurtRect)) {
              // EDGE CASE FIX: Cannot grab invincible targets (respawn, ultimate, etc.)
              if (target.invincible || target.isInvincible) {
                console.log(
                  `[Grab] BLOCKED: Target P${target.padIndex + 1} is invincible`
                );
                continue;
              }

              // EDGE CASE FIX: Cannot grab targets that are already grabbed
              if (target.isGrabbed) {
                console.log(
                  `[Grab] BLOCKED: Target P${
                    target.padIndex + 1
                  } is already grabbed`
                );
                continue;
              }

              // EDGE CASE FIX: Cannot grab targets with active shield
              if (target.shield?.active) {
                console.log(
                  `[Grab] BLOCKED: Target P${
                    target.padIndex + 1
                  } has active shield`
                );
                continue;
              }

              // EDGE CASE FIX: Cannot grab targets that are respawning
              // Only block if actually respawning (respawnState === "respawn"), not if it's "none" or other values
              if (target.respawnState === "respawn") {
                console.log(
                  `[Grab] BLOCKED: Target P${target.padIndex + 1} is respawning`
                );
                continue;
              }

              // EDGE CASE FIX: Cannot grab during protected animations (dance, ultimate, walljump)
              // Only check if animation is actually set and not finished
              const isDanceAnimation =
                target.anim &&
                typeof target.anim === "string" &&
                target.anim.includes("dance") &&
                !target.animFinished;
              const isFritzUltimate =
                target.charName === "fritz" &&
                target.ultiPhase &&
                target.anim &&
                (target.anim === "r2_l2_ulti" ||
                  target.anim === "r2_l2_ulti_start");
              const isWalljump = target.walljumpActive === true;

              if (isDanceAnimation || isFritzUltimate || isWalljump) {
                console.log(
                  `[Grab] BLOCKED: Target P${
                    target.padIndex + 1
                  } is in protected animation (anim: ${
                    target.anim
                  }, dance: ${isDanceAnimation}, ultimate: ${isFritzUltimate}, walljump: ${isWalljump})`
                );
                continue;
              }

              // PRIORITY CHECK: If target has an active higher-priority attack, grab fails
              if (target.attack && target.attack.type !== "none") {
                const targetDescriptor = AttackCatalog.getDescriptor(
                  target,
                  target.attack.type,
                  {
                    chargeTime: target.attack.chargeT || 0,
                    chargeRatio: target.attack.chargeRatio,
                  }
                );
                const grabPriority = descriptor.priority || 40;
                const targetPriority = targetDescriptor.priority || 0;

                // Check if target attack is in an active damage-dealing phase
                const targetPhase = target.attack.phase || "none";
                let targetDetectPhases = targetDescriptor.detectInPhase;

                // If detectInPhase not defined, use common active phases as fallback
                if (!targetDetectPhases || !Array.isArray(targetDetectPhases)) {
                  // Default active phases: active, dash, release, start (but not windup, recovery, none)
                  targetDetectPhases = ["active", "dash", "release", "start"];
                }

                const isTargetInActivePhase =
                  Array.isArray(targetDetectPhases) &&
                  targetDetectPhases.includes(targetPhase);

                // If target has higher priority AND is in active phase, grab fails
                if (targetPriority > grabPriority && isTargetInActivePhase) {
                  console.log(
                    `[Grab] BLOCKED by higher priority attack: P${
                      target.padIndex + 1
                    } ${
                      target.attack.type
                    } (priority ${targetPriority} > ${grabPriority}) in phase ${targetPhase}`
                  );
                  // Grab fails - don't grab the target
                  continue;
                }
              }

              // Successful Grab
              console.log(`[Grab] HIT target P${target.padIndex + 1}`);
              p.attack.grabbedTarget = target;
              p.attack.grabChecked = true;
              target.isGrabbed = true;
              target.grabbedBy = p;
              // CRITICAL FIX: CANCEL VICTIM'S ATTACK to prevent self-hit loops
              target.attack = { type: "none", phase: "none" };
              target.vel.x = 0;
              target.vel.y = 0;
              // Snap target to front
              target.pos.x = p.pos.x + p.facing * 50;
              target.pos.y = p.pos.y; // Snap Y to attacker's Y (ground)
              setAnim(target, "is_grabbed", true, state, 1);
              break;
            }
          }
        }

        // EDGE CASE FIX: Mark grab as checked after detection phase ends, even if no target was found
        // This prevents the grab from staying in detection phase forever
        if (
          currentFrame >= (grabConfig.detectFrames || 2) &&
          !p.attack.grabChecked
        ) {
          p.attack.grabChecked = true;
        }
      }

      // EDGE CASE FIX: Release target if grabber is eliminated
      if (p.eliminated && p.attack.grabbedTarget) {
        const target = p.attack.grabbedTarget;
        target.isGrabbed = false;
        target.grabbedBy = null;
        p.attack.grabbedTarget = null;
        p.attack.phase = "recovery";
        return;
      }

      // If we have a target, process the animation logic
      const target = p.attack.grabbedTarget;
      if (target && !target.eliminated) {
        // Lift Logic (Frame 3 -> Index 3 = 4th frame)
        const liftFrame = grabConfig.liftFrame || 3;
        if (
          currentFrame >= liftFrame &&
          currentFrame < liftFrame + 1 &&
          !p.attack.liftApplied
        ) {
          console.log(`[Grab] Lifting target`);
          target.pos.y -= grabConfig.liftHeight || 80;
          p.attack.liftApplied = true;
        }
        // Fall/Drop Logic (Frames 4-6)
        if (
          p.attack.liftApplied &&
          currentFrame > liftFrame &&
          currentFrame < 7
        ) {
          target.pos.y += 20; // Drop speed
          // Clamp target Y to attacker Y (ground level) to prevent clipping through semisolids
          if (target.pos.y > p.pos.y) {
            target.pos.y = p.pos.y;
          }
        }

        // Throw Logic (Frame 7 -> End)
        const throwFrame = grabConfig.throwFrame || 7;
        if (currentFrame >= throwFrame) {
          // Apply Hit
          console.log(`[Grab] Throwing target!`);

          // 1. EXECUTE MECHANICS (Steal charges first to boost damage)
          executeGrabSignatureMechanic(p, target, state);

          // 2. ATOMIC RELEASE - CRITICAL FIX
          // Remove "grabbed" status BEFORE applying damage/knockback.
          target.isGrabbed = false;
          target.grabbedBy = null;
          p.attack.grabbedTarget = null;

          // 3. Apply Damage (now separate entities)
          applyDamageWithDescriptor(p, target, descriptor, state);

          // 4. Cleanup
          p.invincible = false;
          p.attack.phase = "recovery";
          setAnim(p, "grab_recovery", false, state, 0.5);
        }
      } else if (
        !p.attack.grabbedTarget &&
        currentFrame >= (grabConfig.detectFrames || 2)
      ) {
        console.log(`[Grab] Missed -> recovery (slow)`);
        p.invincible = false;
        p.attack.phase = "recovery";
        setAnim(p, "grab_recovery", false, state, 0.5);
      }
      return;
    }

    // 3. Clank Phase
    if (p.attack.phase === "clank") {
      p.invincible = false;
      if (p.animFinished) {
        p.attack = { type: "none", phase: "none" };
      }
      return;
    }

    // 4. Recovery Phase
    if (p.attack.phase === "recovery") {
      p.invincible = false;
      if (p.animFinished) {
        p.attack = { type: "none", phase: "none" };
      }
      return;
    }
  }

  /**
   * Handle R2 (Heavy) attacks
   * @param {Object} p - Player object
   * @param {Object} inputs - Input state
   * @param {Object} state - Game state
   */
  /**
   * Handle R1 (Light) attacks
   * @param {Object} p - Player object
   * @param {Object} inputs - Input state
   * @param {Object} state - Game state
   */
  function handleR1Attack(p, inputs, state, grounded, dt) {
    const charKey = p.charName.toLowerCase();
    const attackConfig = CharacterCatalog.getAttackConfig(charKey, state) || {};
    const r1Config = attackConfig.r1 || {};
    const r1JumpConfig = attackConfig.r1_jump || {};

    // Initialize the attack first
    if (grounded) {
      p.attack = { type: "r1", phase: "start", owner: "mod" };
      p.attack.loopTime = 0;
      p.attack.tickTimer = 0;
      p.attack.chargeT = 0;
      p.attack._dashTapInit = false;
      startCooldown(p, "r1", state);
      setAnim(p, "r1start", false, state, r1Config.animSpeed || 1);
    } else {
      // R1 Jump Attack: Check if can be reused (must have landed or wallslid since last use)
      if (p.r1JumpAttackCanReuse === false) {
        // Cannot use R1 Jump Attack until landing or wallslide
        return;
      }

      // Initialize R1 Jump Attack
      p.attack = { type: "r1_jump", phase: "active", owner: "mod" };
      p.attack.loopTime = 0;
      p.attack.tickTimer = 0;
      p.attack.chargeT = 0;
      // CRITICAL: Store original dash direction at attack start
      // This prevents velocity from flipping when facing changes during the attack
      p.attack.dashDirection = p.facing;

      // Mark that R1 Jump Attack was used - requires landing or wallslide to reuse
      p.r1JumpAttackCanReuse = false;

      startCooldown(p, "r1", state);
      const jumpAnimSpeed = r1JumpConfig.animSpeed || 1;
      setAnim(p, "r1_jump_attack", false, state, jumpAnimSpeed);
      const pconf = p.config.physics;
      p.vel.x =
        p.facing *
        pconf.moveSpeed *
        (r1JumpConfig.horizontalSpeedMultiplier || 1.0);
      p.vel.y = 0;
      return;
    }

    // Additional handling occurs in updateAttackStates
  }

  /**
   * Handle R2 (Heavy) attacks
   * @param {Object} p - Player object
   * @param {Object} inputs - Input state
   * @param {Object} state - Game state
   */
  function handleR2Attack(p, inputs, state, grounded) {
    if (!grounded) {
      return;
    }

    if (p.charName === "cyboard") {
      handleCyboardR2(p, inputs, state);
    } else if (p.charName === "fritz") {
      handleFritzR2(p, inputs, state);
    } else if (
      p.charName.toLowerCase() === "hp" ||
      p.charName.toLowerCase() === "ernst"
    ) {
      handleHPR2(p, inputs, state);
    } else {
      // Default R2 attack
      handleDefaultR2(p, inputs, state);
    }
  }

  /**
   * Handle L1 (Special) attacks
   * @param {Object} p - Player object
   * @param {Object} inputs - Input state
   * @param {Object} state - Game state
   */
  function handleL1Attack(p, inputs, state, grounded) {
    // Character-specific L1 attacks
    if (!grounded) {
      return;
    }

    if (p.charName === "cyboard") {
      handleCyboardL1(p, inputs, state);
    } else if (p.charName === "fritz") {
      handleFritzL1(p, inputs, state);
    } else if (
      p.charName.toLowerCase() === "hp" ||
      p.charName.toLowerCase() === "ernst"
    ) {
      handleHPL1(p, inputs, state);
    } else {
      // Default L1 attack
      handleDefaultL1(p, inputs, state);
    }
  }

  /**
   * Handle L2 (Charged) attacks
   * @param {Object} p - Player object
   * @param {Object} inputs - Input state
   * @param {Object} state - Game state
   */
  function handleL2Attack(p, inputs, state, grounded) {
    const pconf = p.config.physics;

    // Character-specific L2 attacks
    // Use passed grounded parameter, fallback to p.grounded if not provided
    const isGrounded = grounded !== undefined ? grounded : !!p.grounded;
    const dt = state.deltaTime;

    // Modular owns L2 for all characters (including Cyboard)

    const charKey = p.charName.toLowerCase();
    const attackType =
      p.charName === "HP" || charKey === "hp" || charKey === "ernst"
        ? "l2_ranged"
        : "l2";

    // Initialize L2 attack if not already active
    if (!p.attack || p.attack.type !== attackType) {
      // Cyboard L2 can only be STARTED when grounded (prevents spam)
      // Note: Once started, the attack can continue in air (includes jump)
      if (p.charName === "cyboard" && !isGrounded) {
        return; // Don't allow starting L2 attack in air
      }
      p.attack = {
        type: attackType,
        phase: "start",
        chargeT: 0,
        wasMaxCharge: false,
        hitTargets: new Set(),
        owner: "mod",
      };
      if (attackType === "l2_ranged") {
        p.attack.projectileSpawned = false;
      }
      startCooldown(p, "l2", state);

      if (p.charName === "fritz") {
        setAnim(p, "l2_start", false, state, 1);
      } else if (p.charName === "cyboard") {
        setAnim(p, "l2_smash_charge", false, state, 1);
      } else if (charKey === "hp" || charKey === "ernst") {
        setAnim(p, "l2_ranged_start", false, state, 1);
      } else {
        setAnim(p, "l2_start", false, state, 1);
      }
      return;
    }

    if (p.charName === "cyboard") {
      handleCyboardL2(p, inputs, state, isGrounded, dt);
    } else if (p.charName === "fritz") {
      handleFritzL2(p, inputs, state, isGrounded, dt);
    } else if (charKey === "hp" || charKey === "ernst") {
      handleHPL2(p, inputs, state, isGrounded, dt);
    } else {
      // Default L2 attack
      handleDefaultL2(p, inputs, state, isGrounded, dt);
    }
  }

  /**
   * Handle Ultimate attacks
   * @param {Object} p - Player object
   * @param {Object} inputs - Input state
   * @param {Object} state - Game state
   */
  function handleUltimateAttack(p, inputs, state) {
    if (p.attack && p.attack.type !== "none") return;

    // Check if ultimeter is full and can use ultimate
    if (!window.UltimeterManager || !window.UltimeterManager.canUseUltimate) {
      return; // UltimeterManager not available
    }

    if (!window.UltimeterManager.canUseUltimate(p)) {
      return; // Ultimeter not full
    }

    // Consume ultimate meter
    if (!window.UltimeterManager.consumeUltimate(p, state)) {
      return; // Failed to consume (shouldn't happen if canUseUltimate is true)
    }

    // Seed a unified ultimate attack; character handlers will drive phases
    p.attack = {
      type: "r2_l2_ulti",
      phase: "start",
      owner: "mod",
      hitTargets: new Set(),
    };

    // Common start animation
    setAnim(p, "r2_l2_ulti_start", false, state, 1);
    startCooldown(p, "ultimate", state);

    // Immediate per-character initialization flags
    if (
      p.charName &&
      (p.charName.toLowerCase() === "hp" ||
        p.charName.toLowerCase() === "ernst")
    ) {
      p.attack.duration = 10.0;
      p.invincible = true;
    } else {
      p.invincible = true;
    }
    p.ultiPhase = "start";

    // NEW: Track ultimate usage for Tutorial Part 3
    if (
      state?.tutorial?.active &&
      state.tutorial.part === 3 &&
      p.padIndex === 0
    ) {
      const part3 = state.tutorial.part3;
      if (part3 && !part3.ultimateUsed) {
        part3.ultimateUsed = true;
        console.log("[Tutorial Part 3] Ultimate used! Tutorial complete.");
        // Complete tutorial after a short delay to let ultimate play
        if (window.TutorialSystem) {
          setTimeout(() => {
            if (state.tutorial?.active) {
              window.TutorialSystem.completeTutorial(state);
            }
          }, 2000); // 2 second delay to let ultimate animation play
        }
      }
    }

    // Legacy: Part 2 ultimate tracking (remove if not needed)
    if (
      state?.tutorial?.active &&
      state.tutorial.part === 2 &&
      p.padIndex === 0 &&
      window.TutorialSystem?.completeTutorial
    ) {
      // Part 2 doesn't end on ultimate, it ends on enemy defeat
      // This is kept for backward compatibility
    }
  }

  /**
   * Update attack states and timers
   * @param {number} dt - Delta time
   * @param {Object} p - Player object
   * @param {Object} state - Game state
   */
  function updateAttackStates(dt, p, state, inputs = {}) {
    if (!p.attack || p.attack.type === "none") return;

    // EDGE CASE FIX: Cleanup grab state if grabber's attack type changed unexpectedly
    // Only release the grabbed target when the current attack type is NOT one of
    // the attacks that legitimately hold a target (e.g. grab, l1_ranged_grab, combos).
    // Avoid releasing legitimate ranged-grab flows.
    if (p.attack.grabbedTarget) {
      const allowedGrabHoldingTypes = new Set([
        "grab",
        "l1_ranged_grab",
        "l1_ranged_grab_combo",
        "l1_ranged_grab_combo_active",
        "l1_ranged_grab_combo_start",
        "r2", // some charged releases may hold targets (handled per-character)
        "r2_combo",
      ]);

      // ADDED CHECK: If player is hurt/stunned, they drop the target
      const isHurt = p.anim === "hurt" || p.anim === "stun" || p.eliminated;

      if (!allowedGrabHoldingTypes.has(p.attack.type) || isHurt) {
        console.warn(
          `[Grab Safety] Releasing target. Reason: ValidType=${allowedGrabHoldingTypes.has(
            p.attack.type
          )}, IsHurt=${isHurt}`
        );
        releaseGrabbedTarget(p, state);
      }
    }

    // EDGE CASE FIX: Cleanup grab state if grabber was eliminated
    if (p.eliminated && p.attack.grabbedTarget) {
      releaseGrabbedTarget(p, state);
    }

    // Handle specific attack types that need custom logic
    switch (p.attack.type) {
      case "r1": {
        const grounded = !!p.grounded;
        if (p.charName === "cyboard") {
          handleCyboardR1(p, inputs, state, grounded, dt);
          return;
        }
        if (p.charName === "fritz") {
          handleFritzR1(p, inputs, state, grounded, dt);
          return;
        }
        if (!p.charName) {
          handleDefaultR1(p, inputs, state, grounded, dt);
          return;
        }
        const lower = p.charName.toLowerCase();
        if (lower === "hp") {
          handleHPR1(p, inputs, state, grounded, dt);
          return;
        }
        if (lower === "ernst") {
          handleErnstR1(p, inputs, state, grounded, dt);
          return;
        }
        handleDefaultR1(p, inputs, state, grounded, dt);
        return;
      }
      case "r1_dash_attack":
        handleR1DashAttack(p, inputs, state);
        break;
      case "r1_jump":
        handleR1JumpAttack(p, inputs, state);
        break;
      case "r2": {
        const grounded = !!p.grounded;
        handleR2AttackState(p, inputs, state, grounded, dt);
        break;
      }
      case "l2_ranged": {
        const grounded = !!p.grounded;
        handleHPL2(p, inputs, state, grounded, dt);
        break;
      }
      case "r2_combo": {
        const grounded = !!p.grounded;
        handleR2Combo(p, inputs, state, grounded, dt);
        break;
      }
      case "r2_hit_followup": {
        const grounded = !!p.grounded;
        handleR2HitFollowup(p, inputs, state, grounded, dt);
        break;
      }
      case "r2_recovery": {
        handleR2Recovery(p, state);
        break;
      }
      case "l1_smash": {
        const grounded = !!p.grounded;
        handleFritzL1SmashState(p, inputs, state, grounded, dt);
        break;
      }
      case "l1_jab": {
        const grounded = !!p.grounded;
        handleFritzL1JabState(p, inputs, state, grounded, dt);
        break;
      }
      case "l1_jab_combo": {
        const grounded = !!p.grounded;
        handleFritzL1JabComboState(p, inputs, state, grounded, dt);
        break;
      }
      case "l1": {
        const grounded = !!p.grounded;
        handleCyboardL1State(p, inputs, state, grounded, dt);
        break;
      }
      case "l1_ranged_grab": {
        const grounded = !!p.grounded;
        handleHPL1RangedGrabState(p, inputs, state, grounded, dt);
        break;
      }
      case "l1_ranged_grab_combo": {
        handleHPL1RangedGrabComboState(p, inputs, state, !!p.grounded, dt);
        break;
      }
      case "l2": {
        const grounded = !!p.grounded;
        if (p.charName === "fritz") {
          handleFritzL2(p, inputs, state, grounded, dt);
        } else if (p.charName === "cyboard") {
          handleCyboardL2(p, inputs, state, grounded, dt);
        } else if (
          p.charName &&
          (p.charName.toLowerCase() === "hp" ||
            p.charName.toLowerCase() === "ernst")
        ) {
          handleHPL2(p, inputs, state, grounded, dt);
        } else {
          handleDefaultL2(p, inputs, state, grounded, dt);
        }
        break;
      }
      case "grab":
        handleGrab(p, inputs, state, !!p.grounded, dt);
        break;
      case "r2_l2_ulti": {
        if (p.charName && p.charName.toLowerCase() === "hp") {
          handleHPUltimate(p, inputs, state, dt);
        } else if (p.charName && p.charName.toLowerCase() === "ernst") {
          handleErnstUltimate(p, inputs, state, dt);
        } else if (p.charName === "fritz") {
          handleFritzUltimate(p, inputs, state, dt);
        } else if (p.charName === "cyboard") {
          handleCyboardUltimate(p, inputs, state, dt);
        }
        break;
      }
      default:
        // Update charge timers
        if (p.attack.phase === "charge") {
          p.attack.chargeT = (p.attack.chargeT || 0) + dt;
        }

        // Update loop timers
        if (p.attack.phase === "loop") {
          p.attack.loopTime = (p.attack.loopTime || 0) + dt;
        }

        // Handle attack phase transitions
        handleAttackPhaseTransitions(p, state, inputs);
        break;
    }
  }

  /**
   * Handle attack phase transitions
   * @param {Object} p - Player object
   * @param {Object} state - Game state
   */
  function handleAttackPhaseTransitions(p, state, inputs = {}) {
    if (!p.attack || p.attack.type === "none") return;

    // Character-specific phase transitions
    if (p.charName === "cyboard") {
      handleCyboardPhaseTransitions(p, state, inputs);
    } else if (p.charName === "fritz") {
      handleFritzPhaseTransitions(p, state, inputs);
    } else if (
      p.charName.toLowerCase() === "hp" ||
      p.charName.toLowerCase() === "ernst"
    ) {
      handleHPPhaseTransitions(p, state, inputs);
    }
  }

  /**
   * Detect hits for a player
   * @param {Object} p - Player object
   * @param {number} i - Player index
   * @param {Object} state - Game state
   */
  function detectHits(p, i, state) {
    if (!p.attack || p.attack.type === "none") return;

    const charKey = p.charName?.toLowerCase?.() || "";
    const descriptor = AttackCatalog.getDescriptor(p, p.attack.type);

    switch (charKey) {
      case "cyboard":
        detectCyboardHits(
          p,
          i,
          state,
          null,
          null,
          null,
          null,
          null,
          descriptor
        );
        break;
      case "fritz":
        detectFritzHits(p, i, state, null, null, null, null, null, descriptor);
        break;
      case "hp":
        detectHPHits(p, i, state, null, null, null, null, null, descriptor);
        break;
      case "ernst":
        detectErnstHits(p, i, state, null, null, null, null, null, descriptor);
        break;
      default:
        detectDefaultHits(
          p,
          i,
          state,
          null,
          null,
          null,
          null,
          null,
          descriptor
        );
        break;
    }
  }

  /**
   * Apply damage to a target
   * @param {Object} attacker - Attacking player
   * @param {Object} target - Target player
   * @param {Object} descriptor - Attack descriptor
   * @param {Object} state - Game state
   */
  function applyDamageWithDescriptor(
    attacker,
    target,
    descriptor,
    state,
    options = {}
  ) {
    // CRITICAL: Do not apply damage if target is invincible (e.g., during dodge)
    if (target.invincible) return;

    // Calculate final damage and knockback
    let finalDamage = calculateFinalDamage(attacker, descriptor);
    let finalKnockback = calculateFinalKnockback(attacker, target, descriptor);

    // Part 2: Beat Charge consumption
    const part2 = state?.tutorial?.part2;
    if (
      state?.tutorial?.active &&
      state.tutorial.part === 2 &&
      part2?.beatCharges > 0 &&
      attacker.padIndex === 0
    ) {
      const chargeBonus = 0.34;
      finalDamage = Math.round(finalDamage * (1 + chargeBonus));
      finalKnockback *= 1 + chargeBonus;
      part2.beatCharges = Math.max(0, part2.beatCharges - 1);
      window.TutorialSystem?.setPartTwoTip?.(
        state,
        "Beat Charge verbraucht! Verstärkter Schlag!",
        1.5
      );
    }

    // Part 3: Beat Charge consumption (Step B)
    const part3 = state?.tutorial?.part3;
    if (
      state?.tutorial?.active &&
      state.tutorial.part === 3 &&
      part3?.beatCharges > 0 &&
      attacker.padIndex === 0
    ) {
      const chargeBonus = 0.34;
      finalDamage = Math.round(finalDamage * (1 + chargeBonus));
      finalKnockback *= 1 + chargeBonus;
      part3.beatCharges = Math.max(0, part3.beatCharges - 1);

      // Track charged attack usage for Step B
      if (!part3.chargedAttackUsed) {
        part3.chargedAttackUsed = true;
      }

      window.TutorialSystem?.setPartTwoTip?.(
        state,
        "Beat Charge verbraucht! Verstärkter Schlag!",
        1.5
      );
    }

    // Apply damage
    target.percent += finalDamage;

    // NEW: Track Ultimate hit for Tutorial Part 2
    const isUltimateAttack =
      attacker.attack?.type === "ultimate" ||
      descriptor?.isUltimate ||
      (attacker.attack &&
        attacker.attack.type &&
        attacker.attack.type.toString().toLowerCase().includes("ultimate"));
    if (
      isUltimateAttack &&
      state?.tutorial?.active &&
      state.tutorial.part === 2
    ) {
      // Accept several nearby tutorial states to avoid race conditions
      const part2 = state.tutorial.part2 || {};
      const acceptable =
        part2.currentStep === "ultimate_task" ||
        part2.currentStep === "ultimate_explain" ||
        part2.ultimateReady === true;

      if (acceptable) {
        console.log(
          "[Tutorial Part 2] Ultimate hit detected! Triggering progression..."
        );
        // Force immediate progression
        if (window.TutorialSystem?.trackPartTwoUltimateHit) {
          window.TutorialSystem.trackPartTwoUltimateHit(state);
        } else {
          // Fallback: manually trigger progression
          console.log("[Tutorial Part 2] Manual progression trigger");
          if (state.tutorial.part2) {
            state.tutorial.part2.ultimateHitEnemy = true;
            state.tutorial.part2.currentStep = "beat_charge_explain";
            // Show beat charge explanation directly
            if (window.TutorialSystem?.showBeatChargeExplanationModal) {
              window.TutorialSystem.showBeatChargeExplanationModal(state);
            }
          }
        }
      }
    }

    // NEW: Track Beat-Charged GRAB hit for Tutorial Part 2 (require grab attack)
    const isBeatChargedAttack =
      !isUltimateAttack &&
      attacker.perfectBeatCount &&
      attacker.perfectBeatCount > 0;
    const attackIsGrab =
      attacker.attack?.type &&
      String(attacker.attack.type).toLowerCase().includes("grab");

    if (
      isBeatChargedAttack &&
      attackIsGrab &&
      state?.tutorial?.active &&
      state.tutorial.part === 2 &&
      attacker.padIndex === 0 &&
      state.tutorial.part2?.currentStep === "beat_charge_task"
    ) {
      console.log(
        `[Tutorial Part 2] Beat-charged GRAB hit enemy! (${attacker.perfectBeatCount} charges)`
      );
      if (window.TutorialSystem?.trackPartTwoBeatChargeHit) {
        // Small delay to let the hit effect play
        setTimeout(() => {
          window.TutorialSystem.trackPartTwoBeatChargeHit(state);
        }, 500);
      }
    }

    // --- NEW: IMPACT JUICE (Hitstop & Screen Shake) ---
    // Calculate Hitstop (Freeze Frames)
    // Reduced by ~25% base. Non-charged attacks get 50% reduction.
    const isHoldCharged = attacker.attack?.chargeT > 0;
    const isBeatCharged = attacker.perfectBeatCount > 0;
    const isCharged = isHoldCharged || isBeatCharged;

    const baseHitstop = descriptor.hitstop ?? 4;
    const damageHitstop = Math.floor(finalDamage * 0.35);
    let totalHitstop = Math.min(22, baseHitstop + damageHitstop);

    if (!isCharged) {
      totalHitstop = Math.floor(totalHitstop * 0.5);
    }

    if (state) {
      state.hitstop = totalHitstop;

      // Calculate Screen Shake
      // Intensity halved as requested
      const shakeIntensity = Math.min(12, (4 + finalKnockback * 0.03) * 0.5);
      const shakeDuration = 0.15 + finalKnockback * 0.001;

      if (state.shake) {
        state.shake.intensity = shakeIntensity;
        state.shake.duration = shakeDuration;
        state.shake.decay = 0.9;
        // Kickstart random offset immediately
        state.shake.x = (Math.random() - 0.5) * 2 * shakeIntensity;
        state.shake.y = (Math.random() - 0.5) * 2 * shakeIntensity;
      }
    }
    // --------------------------------------------------

    // Apply knockback
    const knockbackAngle = descriptor.knockbackAngle || 45;
    const knockbackType = descriptor.knockbackType || "standard";

    // Cancel charge attacks when receiving knockback (even if no damage)
    const hasKnockback = finalKnockback > 0 && knockbackType !== "none";
    if (hasKnockback) {
      const isCharging =
        target.attack?.phase === "loop" ||
        target.attack?.phase === "charge" ||
        target.attack?.phase === "start";

      if (isCharging) {
        target.attack = { type: "none", phase: "none" };
        target.chargeFx = null;
      }
    }

    if (knockbackType === "standard") {
      applyStandardKnockback(
        target,
        finalKnockback,
        knockbackAngle,
        attacker.facing
      );
    } else if (knockbackType === "dash") {
      applyDashKnockback(attacker, target, finalKnockback, descriptor);
    } else if (knockbackType === "launcher") {
      applyLauncherKnockback(attacker, target, finalKnockback, descriptor);
    } else if (knockbackType === "explosion") {
      applyExplosionKnockback(attacker, target, finalKnockback, descriptor);
    }

    // Apply stun
    // NEW: Dynamic Hitstun based on Knockback (Smash-style)
    // Formula: Stun = Knockback * 0.0006 (approx 0.4 frames per unit if unit was different)
    // Base stun is kept as minimum for weak hits.
    const dynamicStun = finalKnockback * 0.0006;
    const baseStun = descriptor.stunDuration || 0.15;
    // Cap stun at 1.5s to prevent soft-locks at extreme percents
    target.stunT = Math.min(1.5, Math.max(baseStun, dynamicStun));

    // Set animation
    setAnim(target, "hurt", false, state);

    // Spawn hit effects
    spawnHitEffects(attacker, target, descriptor, state, options);

    // NEW: Track attack hit for tutorial Step 2
    if (
      window.TutorialSystem &&
      state.tutorial?.active &&
      state.tutorial.step === 2
    ) {
      const attackType = attacker.attack?.type || "unknown";
      // Extract base attack type (r1, r2, l1, l2) from attack type string
      let baseType = "unknown";
      if (attackType.includes("r1") || attackType === "r1") baseType = "r1";
      else if (attackType.includes("r2") || attackType === "r2")
        baseType = "r2";
      else if (attackType.includes("l1") || attackType === "l1")
        baseType = "l1";
      else if (attackType.includes("l2") || attackType === "l2")
        baseType = "l2";

      if (baseType !== "unknown") {
        // Only track for legacy tutorial steps, not Part 2
        if (state.tutorial?.part !== 2) {
          window.TutorialSystem.trackAttackHit(
            state,
            attacker,
            target,
            baseType
          );
        }
      }
    }

    // CRITICAL FIX: Ultimate hit detection for Tutorial Part 2
    // This directly checks if the attacker is player 0 (human) and target is player 1 (NPC)
    const isPlayerUltimate =
      attacker === state.players[0] &&
      (attacker.attack?.type === "ultimate" || descriptor?.isUltimate);

    if (
      isPlayerUltimate &&
      state?.tutorial?.active &&
      state.tutorial.part === 2
    ) {
      console.log(
        "[Tutorial Part 2] ULTIMATE HIT DETECTED! Player hit NPC with ultimate"
      );

      // Force tutorial progression
      if (window.TutorialSystem?.trackPartTwoUltimateHit) {
        window.TutorialSystem.trackPartTwoUltimateHit(state);
      } else {
        // Emergency fallback - manually trigger progression
        console.log(
          "[Tutorial Part 2] Emergency fallback - triggering progression"
        );
        if (state.tutorial.part2) {
          state.tutorial.part2.ultimateHitEnemy = true;
          state.tutorial.part2.currentStep = "beat_charge_explain";

          // Show beat charge explanation modal
          if (window.TutorialSystem?.showBeatChargeExplanationModal) {
            window.TutorialSystem.showBeatChargeExplanationModal(state);
          } else {
            // Last resort: show modal directly
            state.tutorial.part2.gameFrozen = true;
            state.tutorial.part2.currentPage = 5;
            state.tutorial.part2.currentStep = "beat_charge_explain";
          }
        }
      }
    }
  }

  /**
   * Calculate final damage based on attack and character stats
   * @param {Object} attacker - Attacking player
   * @param {Object} descriptor - Attack descriptor
   * @returns {number} Final damage value
   */
  function calculateFinalDamage(attacker, descriptor) {
    let damage = descriptor.baseDamage || 4;

    // Apply perfect beat match multiplier (proportional: 1 beat = 1/9 of 5x = 5/9x, 9 beats = 5x)
    // Only apply to non-ultimate attacks
    const isUltimate =
      attacker.attack?.type === "ultimate" || descriptor.isUltimate;
    if (
      !isUltimate &&
      attacker.perfectBeatCount &&
      attacker.perfectBeatCount > 0
    ) {
      // SPECIAL: Grabs use linear scaling: 1 charge = 1x, 10 charges = 10x
      const isGrab =
        descriptor.tier === "GRAB" || attacker.attack?.type === "grab";
      let beatMultiplier;
      if (isGrab) {
        // Linear scaling: 1 charge = +100% (2x), 9 charges = +900% (10x)
        // Improved from previous (Math.min) to ensure 1 charge gives a bonus.
        beatMultiplier = 1 + attacker.perfectBeatCount;
      } else {
        // Standard scaling: 1 beat = 1/9 of 5x = 5/9x, 9 beats = 5x
        beatMultiplier = 1 + (attacker.perfectBeatCount / 9) * 4; // 1 + (beats/9) * 4 = 1 to 5x
      }
      damage *= beatMultiplier;
    }

    // Apply charge multiplier
    const skipChargeScaling =
      descriptor.disableAutoChargeScaling ||
      descriptor.metadata?.disableAutoChargeScaling;
    if (!skipChargeScaling && attacker.attack?.chargeT) {
      const chargeRatio = Math.min(
        attacker.attack.chargeT / (descriptor.maxCharge || 2.0),
        1.0
      );
      damage *= 1 + chargeRatio * 0.5; // 50% bonus at full charge
    }

    // Apply combo multiplier
    if (descriptor.comboMultiplier) {
      damage *= descriptor.comboMultiplier;
    }

    return Math.round(damage);
  }

  /**
   * Calculate final knockback based on attack, character stats, and target percent
   * @param {Object} attacker - Attacking player
   * @param {Object} target - Target player
   * @param {Object} descriptor - Attack descriptor
   * @returns {number} Final knockback value
   */
  function calculateFinalKnockback(attacker, target, descriptor) {
    let knockback = descriptor.baseKnockback || 125;

    // Apply perfect beat match multiplier (proportional: 1 beat = 1/9 of 5x = 5/9x, 9 beats = 5x)
    // Only apply to non-ultimate attacks
    const isUltimate =
      attacker.attack?.type === "ultimate" || descriptor.isUltimate;
    if (
      !isUltimate &&
      attacker.perfectBeatCount &&
      attacker.perfectBeatCount > 0
    ) {
      // SPECIAL: Grabs use linear scaling: 1 charge = 1x, 10 charges = 10x
      const isGrab =
        descriptor.tier === "GRAB" || attacker.attack?.type === "grab";
      let beatMultiplier;
      if (isGrab) {
        // Linear scaling: 1 charge = +100% (2x), 9 charges = +900% (10x)
        // Improved from previous (Math.min) to ensure 1 charge gives a bonus.
        beatMultiplier = 1 + attacker.perfectBeatCount;
      } else {
        // Standard scaling: 1 beat = 1/9 of 5x = 5/9x, 9 beats = 5x
        beatMultiplier = 1 + (attacker.perfectBeatCount / 9) * 4; // 1 + (beats/9) * 4 = 1 to 5x
      }
      knockback *= beatMultiplier;
    }

    // Apply percent scaling
    const percentScaling = Math.pow(
      1 + target.percent / 100,
      descriptor.knockbackExponent || 1.2
    );
    const afterPercentScaling = knockback * percentScaling;
    knockback = afterPercentScaling;

    // Apply global knockback boost (+25%)
    knockback *= 1.25;

    // Apply charge multiplier
    const skipChargeScaling =
      descriptor.disableAutoChargeScaling ||
      descriptor.metadata?.disableAutoChargeScaling;
    if (!skipChargeScaling && attacker.attack?.chargeT) {
      const chargeRatio = Math.min(
        attacker.attack.chargeT / (descriptor.maxCharge || 2.0),
        1.0
      );
      knockback *= 1 + chargeRatio * 0.8; // 80% bonus at full charge
    }

    // DEBUG LOGGING (only in dev mode)
    const debugState = window.state || state;
    if (debugState?.debug?.devMode && debugState?.debug?.knockbackLogging) {
      console.log(`[KNOCKBACK DEBUG] AttackSystem.calculateFinalKnockback:`, {
        base: descriptor.baseKnockback || 125,
        targetPercent: target.percent,
        exponent: descriptor.knockbackExponent || 1.2,
        percentScaling: percentScaling.toFixed(2),
        afterPercentScaling: afterPercentScaling.toFixed(2),
        globalBoost: 1.25,
        beatCharged: attacker.beatCharged || false,
        final: knockback.toFixed(2),
      });
    }

    return Math.round(knockback);
  }

  /**
   * Apply standard knockback
   * @param {Object} target - Target player
   * @param {number} force - Knockback force
   * @param {number} angle - Knockback angle in degrees
   * @param {number} facing - Attacker facing direction
   */
  function applyStandardKnockback(target, force, angle, facing) {
    const radians = (angle * Math.PI) / 180;
    target.vel.x = Math.cos(radians) * force * facing;
    target.vel.y = -Math.sin(radians) * force;
  }

  /**
   * Apply dash knockback
   * @param {Object} attacker - Attacking player
   * @param {Object} target - Target player
   * @param {number} force - Knockback force
   * @param {Object} descriptor - Attack descriptor
   */
  function applyDashKnockback(attacker, target, force, descriptor) {
    const angle = ((descriptor.knockbackAngle || 25) * Math.PI) / 180;
    const momentum = descriptor.attackerMomentum || 0;

    target.vel.x = Math.cos(angle) * force * attacker.facing;
    target.vel.y = -Math.sin(angle) * force;

    // Apply attacker momentum
    attacker.vel.x *= momentum;
  }

  /**
   * Apply launcher knockback
   * @param {Object} target - Target player
   * @param {number} force - Knockback force
   * @param {Object} descriptor - Attack descriptor
   */
  function applyLauncherKnockback(attacker, target, force, descriptor) {
    const angle = ((descriptor.knockbackAngle || 80) * Math.PI) / 180;
    const facing = attacker?.facing ?? 1;
    target.vel.x = Math.cos(angle) * force * facing;
    target.vel.y = -Math.sin(angle) * force;
  }

  /**
   * Apply explosion knockback
   * @param {Object} attacker - Attacking player
   * @param {Object} target - Target player
   * @param {number} force - Knockback force
   * @param {Object} descriptor - Attack descriptor
   */
  function applyExplosionKnockback(attacker, target, force, descriptor) {
    const dx = target.pos.x - attacker.pos.x;
    const dy = target.pos.y - attacker.pos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 0) {
      const normalizedX = dx / distance;
      const normalizedY = dy / distance;

      target.vel.x = normalizedX * force;
      target.vel.y = normalizedY * force;
    }
  }

  /**
   * Spawn hit effects
   * @param {Object} attacker - Attacking player
   * @param {Object} target - Target player
   * @param {Object} descriptor - Attack descriptor
   * @param {Object} state - Game state
   */
  function spawnHitEffects(attacker, target, descriptor, state, context = {}) {
    const damage = calculateFinalDamage(attacker, descriptor);

    // Blood splatter effect via ParticleManager (like in physics_old.js)
    if (window.ParticleManager && ParticleManager.emitBloodSplatter) {
      const bloodDir = {
        x: attacker?.facing ?? 1,
        y: descriptor.knockbackAngle
          ? -Math.sin(((descriptor.knockbackAngle || 65) * Math.PI) / 180)
          : -0.2,
      };
      ParticleManager.emitBloodSplatter(
        target.pos.x,
        target.pos.y,
        damage,
        state,
        { dir: bloodDir }
      );
    }

    // Spawn knockback effect
    // Use special knockback animation if attacker is beat charged
    const knockbackType = descriptor.knockbackType || "standard";
    const fxOverride = context.fxOverride;
    let fxId =
      typeof fxOverride === "string"
        ? fxOverride
        : descriptor.fx?.hit?.id || `fx_knockback_${knockbackType}`;

    // Note: Knockback animation stays normal for beat match charges
    // Visual effects are shown as aura, not on hit

    if (fxId !== "fx_knockback_none") {
      // Character-specific impact effects (l2_impact, l1_impact) use spawnEffect
      if (fxId === "l2_impact" || fxId === "l1_impact") {
        const effectContext = context.source || attacker;
        if (effectContext) {
          spawnEffect(state, effectContext, fxId);
        }
      } else {
        // Global FX effects use spawnGlobalEffect
        spawnGlobalEffect(state, target, fxId);
      }
    }

    // Consume all perfect beat matches after using them on hit
    if (attacker.perfectBeatCount && attacker.perfectBeatCount > 0) {
      attacker.perfectBeatCount = 0;
      clearBeatMatchVisualEffects(attacker);
    }

    // Beat-match effect if attack was on beat
    if (attacker.attack && attacker.attack.wasOnBeat) {
      spawnGlobalEffect(state, target, "fx_knockback_beatmatch");
    }
  }

  function releaseGrabbedTarget(p, state) {
    console.log(
      `[Grab DEBUG] releaseGrabbedTarget called for P${p.padIndex + 1}`
    );
    if (!p || !p.attack) return;

    // Known grab-tracking fields across handlers
    const grabFields = [
      "grabbedTarget",
      "maxChargeGrabbedTarget",
      "savedTarget",
      "pendingGrabTarget",
    ];

    for (const field of grabFields) {
      const target = p.attack[field];
      if (target) {
        console.log(
          `[Grab DEBUG] Releasing ${target.charName} from ${field} for P${
            p.padIndex + 1
          }`
        );
        try {
          target.isGrabbed = false;
        } catch (e) {}
        try {
          target.grabbedBy = null;
        } catch (e) {}
        if (target.attack && target.attack.isGrabbed) {
          try {
            delete target.attack.isGrabbed;
          } catch (e) {}
        }
        // Reset target velocities to prevent stuck state
        if (!target.eliminated) {
          target.vel = target.vel || { x: 0, y: 0 };
          target.vel.x = 0;
          target.vel.y = 0;
        }
        // Defensive animation fallback: if still stuck on is_grabbed, nudge to sensible anim
        if (typeof setAnim === "function" && target.anim === "is_grabbed") {
          console.log(
            `[Grab DEBUG] Force-changing ${target.charName} animation from is_grabbed to fallback`
          );
          if (!target.grounded) {
            setAnim(target, "jump_fall", false, state);
          } else if ((target.stunT || 0) > 0) {
            setAnim(target, "hurt", false, state);
          } else {
            setAnim(target, "idle", true, state);
          }
        }
      }
      // Clear field on attacker
      if (p.attack[field]) p.attack[field] = null;
    }
  }

  function buildComboStepDescriptor(baseDescriptor, stepConfig = {}) {
    if (!baseDescriptor) return {};

    const descriptor = { ...baseDescriptor };
    if (descriptor.combo) {
      delete descriptor.combo;
    }

    if (typeof stepConfig.damage === "number") {
      descriptor.baseDamage = stepConfig.damage;
    }
    if (typeof stepConfig.stun === "number") {
      descriptor.stunDuration = stepConfig.stun;
    }

    if (stepConfig.knockback) {
      const knock = stepConfig.knockback;
      const baseKnock =
        (typeof knock.base === "number"
          ? knock.base
          : descriptor.baseKnockback) || descriptor.baseKnockback;
      const multiplier =
        typeof knock.multiplier === "number" ? knock.multiplier : 1;
      descriptor.baseKnockback = baseKnock * multiplier;

      if (typeof knock.exponent === "number") {
        descriptor.knockbackExponent = knock.exponent;
      }
      if (typeof knock.angle === "number") {
        descriptor.knockbackAngle = knock.angle;
      }
      if (typeof knock.max === "number") {
        descriptor.maxKnockback = knock.max;
      }
    }

    return descriptor;
  }

  function applyComboStepMovement(
    p,
    state,
    animName,
    animSpeed,
    stepConfig = {},
    comboConfig = {}
  ) {
    const hasMultiplier = typeof stepConfig.dashMultiplier === "number";
    const baseDistance =
      (typeof stepConfig.dashDistance === "number"
        ? stepConfig.dashDistance
        : undefined) ?? (hasMultiplier ? comboConfig.dashDistance : undefined);

    if (typeof baseDistance !== "number" || baseDistance === 0) {
      return;
    }

    const multiplier = hasMultiplier ? stepConfig.dashMultiplier : 1;
    if (!multiplier) {
      return;
    }

    const charData = state.characterConfigs?.[p.charName];
    const animFrames = charData?.animations?.[animName];
    const fps = charData?.fps || 12;
    const frameCount = Array.isArray(animFrames) ? animFrames.length : 0;
    const duration = frameCount ? frameCount / (fps * (animSpeed || 1)) : 0;

    const distance = baseDistance * multiplier;
    const speed = duration > 0 ? distance / duration : distance;

    if (Number.isFinite(speed)) {
      p.vel.x = p.facing * speed;
    }
  }

  function setR1ComboStep(p, state, descriptor, comboConfig, stepIndex) {
    if (!p.attack) return;

    const comboSteps = descriptor?.combo?.steps || [];
    const stepConfig = comboSteps[stepIndex - 1] || {};

    releaseGrabbedTarget(p, state);

    p.attack.phase = "active";
    p.attack.comboStep = stepIndex;
    p.attack.inputQueued = false;

    if (p.attack.hitTargets instanceof Set) {
      p.attack.hitTargets.clear();
    } else {
      p.attack.hitTargets = new Set();
    }

    p.attack.pendingFinisher = null;
    p.attack.dragOffset =
      stepConfig.dragOffset ?? comboConfig.dragOffset ?? null;

    const animSpeed = comboConfig.animSpeed ?? descriptor.animSpeed ?? 1;
    const animName = `r1_combo_${stepIndex}`;

    setAnim(p, animName, false, state, animSpeed);
    applyComboStepMovement(
      p,
      state,
      animName,
      animSpeed,
      stepConfig,
      comboConfig
    );
  }

  function initR1Combo(
    p,
    state,
    descriptor,
    comboConfig,
    startingStep = 1,
    extraProps = {}
  ) {
    const baseAttack = {
      type: "r1_combo_active",
      phase: "active",
      comboStep: startingStep,
      inputQueued: false,
      hitTargets: new Set(),
      grabbedTarget: null,
      pendingFinisher: null,
      owner: "mod",
      ...extraProps,
    };

    p.attack = baseAttack;
    setR1ComboStep(p, state, descriptor, comboConfig, startingStep);
  }

  function maybeStartR1Combo(p, inputs, state, r1Config = {}) {
    if (!inputs.r1Down) {
      return false;
    }

    const charKey = p.charName?.toLowerCase?.();
    if (!charKey) {
      return false;
    }

    const attackConfig = CharacterCatalog.getAttackConfig(charKey, state) || {};
    const comboConfig = attackConfig.r1_combo || {};
    const descriptor = AttackCatalog.getDescriptor(p, "r1_combo_active");

    if (!descriptor?.combo?.steps?.length) {
      return false;
    }

    // Check if character has combo animations available
    const charData = state.characterConfigs?.[p.charName];
    const hasComboAnimations = charData?.animations?.["r1_combo_1"];
    if (!hasComboAnimations) {
      return false;
    }

    const windowFrame =
      comboConfig.comboWindowStartFrame ?? r1Config.comboWindowStartFrame ?? 0;

    if (p.frameIndex < windowFrame) {
      return false;
    }

    const prevWasOnBeat = p.attack?.wasOnBeat;
    initR1Combo(p, state, descriptor, comboConfig, 1, {
      wasOnBeat: prevWasOnBeat,
    });

    return true;
  }

  // Character-specific attack handlers (placeholders - these would be implemented based on existing code)
  function handleCyboardR1(p, inputs, state, grounded, dt) {
    if (!grounded) {
      return;
    }

    const charKey = p.charName.toLowerCase();
    const attackConfig = CharacterCatalog.getAttackConfig(charKey, state) || {};
    const r1Config = attackConfig.r1 || {};
    const dashConfig = attackConfig.r1_dash_attack || {};
    const descriptor = AttackCatalog.getDescriptor(p, "r1");
    const dashWindow = r1Config.dashTapWindow ?? 0.2;
    const maxCharge = r1Config.maxCharge ?? descriptor.maxCharge ?? 2.0;

    if (typeof p.attack.chargeT !== "number") {
      p.attack.chargeT = 0;
    }

    if (p.attack.phase === "start") {
      if (!p.attack._dashTapInit) {
        p.r1DashTapTimer = dashWindow;
        p.attack._dashTapInit = true;
        p.attack.finalChargeT = 0;
        p.attack.chargeT = 0;
        p.attack.releaseData = null;
        p.attack.deferredKnockbackTargets = null;
        p.attack.processedTargets = null;
      }
      p.r1DashTapTimer = Math.max(0, (p.r1DashTapTimer || 0) - dt);

      if (
        inputs.r1Down &&
        (p.r1DashTapTimer || 0) > 0 &&
        dashConfig.horizontalSpeedMultiplier
      ) {
        const dashDescriptor = AttackCatalog.getDescriptor(p, "r1_dash_attack");
        const dashConfigFromCatalog = dashConfig;
        const finalDashConfig = {
          horizontalSpeedMultiplier:
            dashDescriptor?.movement?.horizontalSpeedMultiplier ??
            dashConfigFromCatalog.horizontalSpeedMultiplier ??
            1,
          landingFriction:
            dashDescriptor?.movement?.landingFriction ??
            dashConfigFromCatalog.landingFriction ??
            0.7,
          animSpeed:
            dashDescriptor?.movement?.animSpeed ??
            dashConfigFromCatalog.animSpeed ??
            1,
          dashRange:
            dashDescriptor?.movement?.dashRange ??
            dashConfigFromCatalog.dashRange ??
            null,
        };

        p.attack = { type: "r1_dash_attack", phase: "active", owner: "mod" };
        p.attack.hitTargets = new Set();
        p.attack.dashDirection = p.facing;
        p.attack.dashStartX = p.pos.x;
        p.attack.dashDistanceTraveled = 0;
        p.attack._dashConfig = finalDashConfig;
        setAnim(
          p,
          "r1_dash_attack",
          false,
          state,
          finalDashConfig.animSpeed || 1
        );
        const pconf = p.config.physics;
        p.vel.x =
          p.facing *
          pconf.moveSpeed *
          (finalDashConfig.horizontalSpeedMultiplier || 1);
        p.vel.y = 0;
        p.r1DashTapTimer = 0;
        return;
      }

      if ((p.r1DashTapTimer || 0) > 0) {
        return;
      }

      if (p.animFinished) {
        if (inputs.r1Held) {
          p.attack.phase = "loop";
          p.attack.tickTimer = 0;
          setAnim(p, "r1loop", true, state, r1Config.animSpeed || 1);
        } else {
          p.attack.phase = "release";
          p.chargeFx = null;
          p.attack.finalChargeT = p.attack.chargeT || 0;
          prepareCyboardR1Release(p, descriptor, r1Config);
          setAnim(p, "r1release", false, state, r1Config.animSpeed || 1);
        }
      }
    } else if (p.attack.phase === "loop") {
      if (!inputs.r1Held) {
        p.attack.phase = "release";
        p.chargeFx = null;
        p.attack.finalChargeT = p.attack.chargeT || 0;
        prepareCyboardR1Release(p, descriptor, r1Config);
        setAnim(p, "r1release", false, state, r1Config.animSpeed || 1);
      } else {
        const clampedCharge = Math.min((p.attack.chargeT || 0) + dt, maxCharge);
        p.attack.chargeT = clampedCharge;
        applyChargeFxFromDescriptor(p, descriptor, clampedCharge);
      }
    } else if (p.attack.phase === "release") {
      if (maybeStartR1Combo(p, inputs, state, r1Config)) {
        return;
      }

      p.attack.chargeT = p.attack.finalChargeT || p.attack.chargeT || 0;

      if (p.animFinished) {
        if (
          p.attack.deferredKnockbackTargets instanceof Map &&
          p.attack.deferredKnockbackTargets.size > 0
        ) {
          for (const [
            target,
            knockDescriptor,
          ] of p.attack.deferredKnockbackTargets.entries()) {
            if (target && !target.eliminated) {
              applyDamageWithDescriptor(p, target, knockDescriptor, state);
            }
          }
        }
        p.attack = { type: "none", phase: "none" };
      }
    }
  }

  function prepareCyboardR1Release(p, descriptor, r1Config = {}) {
    const releaseInfo = descriptor.release || {};
    const finalChargeT = p.attack.finalChargeT || 0;
    const maxCharge = r1Config.maxCharge ?? descriptor.maxCharge ?? 2.0;

    const activeFrames = r1Config.releaseActiveFrames ||
      releaseInfo.activeFrames || [2, 7];
    const releaseKnockbackFrame =
      r1Config.releaseKnockbackFrame ??
      releaseInfo.knockbackFrame ??
      activeFrames[activeFrames.length - 1];
    const recoveryFrames = r1Config.releaseRecoveryFrames ||
      releaseInfo.recoveryFrames || [8, 9];
    const maxChargeStunDuration =
      r1Config.maxChargeStunDuration ??
      releaseInfo.maxChargeStunDuration ??
      descriptor.stunDuration ??
      0.3;
    const chargeStage =
      selectDescriptorChargeStage(descriptor.chargeStages, finalChargeT) || {};

    const baseDamage = chargeStage.damage ?? descriptor.baseDamage;
    const baseKnockback = chargeStage.knockback ?? descriptor.baseKnockback;
    const baseStun = chargeStage.stun ?? descriptor.stunDuration;

    const sharedMetadata = {
      ...descriptor.metadata,
      disableAutoChargeScaling: true,
    };

    const preHitDescriptor = {
      ...descriptor,
      baseDamage,
      baseKnockback: 0,
      stunDuration: baseStun,
      knockbackType: "none",
      disableAutoChargeScaling: true,
      metadata: sharedMetadata,
    };

    const knockbackDescriptor = {
      ...descriptor,
      baseDamage: 0,
      baseKnockback,
      stunDuration: 0,
      disableAutoChargeScaling: true,
      metadata: sharedMetadata,
    };

    const preHitFrame =
      r1Config.releasePreHitFrame ??
      releaseInfo.preHitFrame ??
      activeFrames[0] ??
      0;

    p.attack.releaseData = {
      descriptor: {
        ...descriptor,
        baseDamage,
        baseKnockback,
        stunDuration: baseStun,
        disableAutoChargeScaling: true,
        metadata: sharedMetadata,
      },
      activeFrames,
      knockbackFrame: releaseKnockbackFrame,
      preHitFrame,
      recoveryFrames,
      maxCharge,
      maxChargeStunDuration,
      maxChargeKnockbackDelay:
        r1Config.maxChargeKnockbackDelay ??
        releaseInfo.maxChargeKnockbackDelay ??
        true,
      preHitDescriptor,
      knockbackDescriptor,
    };

    p.attack.processedTargets = new Set();
    p.attack.deferredKnockbackTargets = new Map();
    p.attack.preHitTargets = new Set();
    p.attack.hitConfirmed = false;
  }
  function handleFritzR1(p, inputs, state, grounded, dt) {
    if (!grounded) {
      return;
    }

    const charKey = p.charName.toLowerCase();
    const attackConfig = CharacterCatalog.getAttackConfig(charKey, state) || {};
    const r1Config = attackConfig.r1 || {};
    const dashConfig = attackConfig.r1_dash_attack || {};
    const descriptor = AttackCatalog.getDescriptor(p, "r1");
    const loopTickDamage = r1Config.loopTickDamage ?? descriptor.baseDamage;
    const releaseDamage = r1Config.releaseDamage ?? descriptor.baseDamage;
    const dashWindow = r1Config.dashTapWindow ?? 0.2;

    if (p.attack.phase === "start") {
      if (!p.attack._dashTapInit) {
        p.r1DashTapTimer = dashWindow;
        p.attack._dashTapInit = true;
      }
      p.r1DashTapTimer = Math.max(0, (p.r1DashTapTimer || 0) - dt);

      if (
        inputs.r1Down &&
        (p.r1DashTapTimer || 0) > 0 &&
        dashConfig.horizontalSpeedMultiplier
      ) {
        // PERFORMANCE: Calculate dash config once at start, not every frame
        const dashDescriptor = AttackCatalog.getDescriptor(p, "r1_dash_attack");
        const dashConfigFromCatalog = dashConfig;
        const finalDashConfig = {
          horizontalSpeedMultiplier:
            dashDescriptor?.movement?.horizontalSpeedMultiplier ??
            dashConfigFromCatalog.horizontalSpeedMultiplier ??
            1,
          landingFriction:
            dashDescriptor?.movement?.landingFriction ??
            dashConfigFromCatalog.landingFriction ??
            0.7,
          animSpeed:
            dashDescriptor?.movement?.animSpeed ??
            dashConfigFromCatalog.animSpeed ??
            1,
          dashRange:
            dashDescriptor?.movement?.dashRange ??
            dashConfigFromCatalog.dashRange ??
            null,
        };

        p.attack = { type: "r1_dash_attack", phase: "active", owner: "mod" };
        p.attack.hitTargets = new Set();
        // CRITICAL: Store original dash direction at attack start
        // This prevents velocity from flipping when facing changes during the attack
        p.attack.dashDirection = p.facing;
        // CRITICAL: Store start position for range-based dash control
        p.attack.dashStartX = p.pos.x;
        p.attack.dashDistanceTraveled = 0;
        // PERFORMANCE: Store config once to avoid recalculating every frame
        p.attack._dashConfig = finalDashConfig;
        setAnim(
          p,
          "r1_dash_attack",
          false,
          state,
          finalDashConfig.animSpeed || 1
        );
        const pconf = p.config.physics;
        p.vel.x =
          p.facing *
          pconf.moveSpeed *
          (finalDashConfig.horizontalSpeedMultiplier || 1);
        p.vel.y = 0;
        p.r1DashTapTimer = 0;
        return;
      }

      if ((p.r1DashTapTimer || 0) > 0) {
        return;
      }

      if (p.animFinished) {
        if (inputs.r1Held) {
          p.attack.phase = "loop";
          p.attack.tickTimer = 0;
          setAnim(p, "r1loop", true, state, r1Config.animSpeed || 1);
        } else {
          p.attack.phase = "release";
          p.attack.damage = releaseDamage;
          p.attack.hitTargets = new Set();
          setAnim(p, "r1release", false, state, r1Config.animSpeed || 1);
        }
      }
    } else if (p.attack.phase === "loop") {
      if (!inputs.r1Held) {
        p.attack.phase = "release";
        p.attack.damage = releaseDamage;
        p.attack.hitTargets = new Set();
        setAnim(p, "r1release", false, state, r1Config.animSpeed || 1);
      } else {
        p.attack.tickTimer = (p.attack.tickTimer || 0) + dt;
        const charData = state.characterConfigs[p.charName];
        const animData = charData.animations["r1loop"];
        const tickDuration = animData.length / charData.fps;

        if (p.attack.tickTimer >= tickDuration) {
          p.attack.tickTimer -= tickDuration;
          const atkRect = Renderer.getR1Hitbox(p, state);
          for (const target of state.players) {
            if (target === p || target.eliminated) continue;
            const hurtRect = Renderer.getHurtbox(target);
            if (!rectsIntersect(atkRect, hurtRect)) continue;

            const tickDescriptor = {
              ...descriptor,
              baseDamage: loopTickDamage,
            };
            applyDamageWithDescriptor(p, target, tickDescriptor, state);
          }
        }
      }
    } else if (p.attack.phase === "release") {
      if (!(p.attack.hitTargets instanceof Set)) {
        p.attack.hitTargets = new Set();
      }
      // Only Cyboard has R1 combos, Fritz and HP have dash attacks instead
      if (
        p.charName.toLowerCase() === "cyboard" &&
        maybeStartR1Combo(p, inputs, state, r1Config)
      ) {
        return;
      }

      if (p.animFinished) {
        p.attack = { type: "none", phase: "none" };
      }
    }
  }

  function handleR1DashAttack(p, inputs, state) {
    const charKey = p.charName.toLowerCase();

    // PERFORMANCE: Use cached config instead of recalculating every frame
    // Config is set once when dash starts (in handleCyboardR1, handleFritzR1, etc.)
    let dashConfig = p.attack._dashConfig;

    // Fallback: Only calculate if not cached (shouldn't happen, but safety check)
    if (!dashConfig) {
      const descriptor = AttackCatalog.getDescriptor(p, "r1_dash_attack");
      const attackConfig =
        CharacterCatalog.getAttackConfig(charKey, state) || {};
      const dashConfigFromCatalog = attackConfig.r1_dash_attack || {};
      dashConfig = {
        horizontalSpeedMultiplier:
          descriptor?.movement?.horizontalSpeedMultiplier ??
          dashConfigFromCatalog.horizontalSpeedMultiplier ??
          1,
        landingFriction:
          descriptor?.movement?.landingFriction ??
          dashConfigFromCatalog.landingFriction ??
          0.7,
        animSpeed:
          descriptor?.movement?.animSpeed ??
          dashConfigFromCatalog.animSpeed ??
          1,
        dashRange:
          descriptor?.movement?.dashRange ??
          dashConfigFromCatalog.dashRange ??
          null,
      };
      // Cache it for next frame
      p.attack._dashConfig = dashConfig;
    }

    const dashTimelines = {
      fritz: {
        progress: [0, 0.18, 0.4, 0.6, 0.7, 0.85, 1.0, 1.0, 1.0, 1.0],
        recoveryStartFrame: 8,
        maxMultiplier: 3.0,
      },
      ernst: {
        progress: [0, 0.18, 0.4, 0.6, 0.7, 0.85, 1.0, 1.0, 1.0, 1.0],
        recoveryStartFrame: 8,
        maxMultiplier: 3.0,
      },
    };

    const timelineConfig = dashTimelines[charKey];
    const usesTimeline = Boolean(timelineConfig && dashConfig.dashRange);

    // CRITICAL: Enforce dash velocity every frame during active phase
    // This prevents existing movement velocity from adding to the dash speed
    // Use stored dashDirection to prevent flipping when facing changes
    if (p.attack.phase === "active") {
      // RANGE-BASED DASH CONTROL: Check if dashRange is reached
      if (dashConfig.dashRange && p.attack.dashStartX !== undefined) {
        const distanceTraveled = Math.abs(p.pos.x - p.attack.dashStartX);
        p.attack.dashDistanceTraveled = distanceTraveled;

        // If we've reached or exceeded target range, stop dash (unless a timeline controls recovery)
        if (!usesTimeline && distanceTraveled >= dashConfig.dashRange) {
          // Apply landing friction and end attack
          const landingFriction = dashConfig.landingFriction;
          p.vel.x *= landingFriction;
          p.attack = { type: "none", phase: "none" };
          return;
        }
      }

      const pconf = p.config.physics;
      const baseSpeed = pconf.moveSpeed;
      const multiplier = dashConfig.horizontalSpeedMultiplier;
      const dashDirection = p.attack.dashDirection ?? p.facing;
      const dt = Math.max(state?.deltaTime || 0.016, 1 / 240);

      if (usesTimeline) {
        const { progress, recoveryStartFrame, maxMultiplier } = timelineConfig;
        const sequence = Array.isArray(progress) ? progress : [];
        const dashRange = dashConfig.dashRange || 0;

        if (sequence.length >= 2 && dashRange > 0) {
          const lastIndex = sequence.length - 1;
          const rawIndex = Math.max(0, p.frameIndex || 0);
          const clampedFrame = Math.min(Math.floor(rawIndex), lastIndex - 1);
          const frameFraction = rawIndex - clampedFrame;
          const lerpFactor = Math.min(Math.max(frameFraction, 0), 1);

          const startProgress = sequence[clampedFrame] ?? 0;
          const endProgress =
            sequence[Math.min(clampedFrame + 1, lastIndex)] ?? startProgress;
          const targetProgress =
            startProgress + (endProgress - startProgress) * lerpFactor;

          const desiredDistance = dashRange * targetProgress;
          const currentDistance = Math.abs(p.pos.x - p.attack.dashStartX);
          const remainingDistance = desiredDistance - currentDistance;

          const recoveryFrame =
            typeof recoveryStartFrame === "number"
              ? recoveryStartFrame
              : sequence.length;
          const inRecovery = clampedFrame + 1 >= recoveryFrame;
          const maxSpeed = baseSpeed * multiplier * (maxMultiplier ?? 3.0);

          if (inRecovery) {
            p.vel.x = 0;
          } else if (remainingDistance > 0) {
            const requiredSpeed = remainingDistance / dt;
            const limitedSpeed = Math.min(requiredSpeed, maxSpeed);
            p.vel.x = dashDirection * Math.max(limitedSpeed, 0);
          } else {
            p.vel.x = 0;
          }
        } else {
          const finalSpeed = baseSpeed * multiplier;
          p.vel.x = dashDirection * finalSpeed;
        }
      } else if (
        charKey === "cyboard" &&
        p.frameIndex >= 7 &&
        p.frameIndex <= 9
      ) {
        // Recovery frames: reduce speed gradually
        const recoveryFriction = 0.5; // 50% speed in recovery
        p.vel.x = dashDirection * baseSpeed * multiplier * recoveryFriction;
      } else {
        // Active frames: full speed
        const finalSpeed = baseSpeed * multiplier;
        p.vel.x = dashDirection * finalSpeed;
      }
    }

    if (p.animFinished) {
      const landingFriction = dashConfig.landingFriction;
      p.vel.x *= landingFriction;
      p.attack = { type: "none", phase: "none" };
    }
  }

  function handleR1JumpAttack(p, inputs, state) {
    // CRITICAL: Enforce dash velocity every frame during active phase
    // This prevents existing movement velocity from adding to the dash speed
    // Use stored dashDirection to prevent flipping when facing changes
    if (p.attack.phase === "active") {
      const charKey = p.charName.toLowerCase();
      const charConfig = CharacterCatalog.getAttackConfig(charKey, state) || {};
      const r1JumpConfig = charConfig.r1_jump || {};
      const pconf = p.config.physics;
      const baseSpeed = pconf.moveSpeed;
      const multiplier = r1JumpConfig.horizontalSpeedMultiplier || 2.7;
      const finalSpeed = baseSpeed * multiplier;
      const dashDirection = p.attack.dashDirection ?? p.facing;
      p.vel.x = dashDirection * finalSpeed;
    }

    // Hold the final animation frame while airborne and R1 is held
    if (!p.grounded && inputs.r1Held && p.anim === "r1_jump_attack") {
      const frames = Array.isArray(p.frames) ? p.frames : [];
      if (frames.length > 0) {
        const lastFrameIndex = frames.length - 1;
        if (p.frameIndex >= lastFrameIndex) {
          p.frameIndex = lastFrameIndex;
          p.frameTime = 0;
          p.animFinished = false;
          return;
        }
      }
    }

    // R1 Jump Attack handler (used by all characters)
    if (p.animFinished || p.grounded) {
      p.attack = { type: "none", phase: "none" };
      // Reset horizontal velocity slightly on landing
      if (p.grounded) {
        const charKey = p.charName.toLowerCase();
        const charConfig =
          CharacterCatalog.getAttackConfig(charKey, state) || {};
        const r1JumpConfig = charConfig.r1_jump || {};
        const landingFriction = r1JumpConfig.landingFriction || 0.5; // Safe fallback
        p.vel.x *= landingFriction;
      }
    }
  }

  function startCombo(p, state) {
    const charKey = p.charName.toLowerCase();
    const attackConfig = CharacterCatalog.getAttackConfig(charKey, state) || {};
    const r1Config = attackConfig.r1 || {};
    p.attack = { type: "r1", phase: "start", owner: "mod" };
    p.attack.loopTime = 0;
    p.attack.tickTimer = 0;
    p.attack.chargeT = 0;
    p.attack._dashTapInit = false;
    setAnim(p, "r1start", false, state, r1Config.animSpeed || 1);
    startCooldown(p, "r1", state);
  }

  function handleR2AttackState(p, inputs, state, grounded, dt) {
    if (!grounded) {
      return;
    }

    const charKey = p.charName?.toLowerCase?.();
    const attackConfig = CharacterCatalog.getAttackConfig(charKey, state) || {};
    const r2Config = attackConfig.r2 || {};
    const descriptor = AttackCatalog.getDescriptor(p, "r2");
    const animSpeed = r2Config.animSpeed || descriptor?.animSpeed || 1;
    let chargeStages = descriptor?.chargeStages || [];
    const baseDash =
      r2Config.baseDashSpeed ?? descriptor?.movement?.releaseDashBase ?? 1600;

    // Fallback: synthesize charge stages from character config if missing
    if (!chargeStages || chargeStages.length === 0) {
      const thresholds = r2Config.chargeThresholds || [0.8, 1.5, 2.0];
      const multipliers = r2Config.dashMultipliers || [1.1, 1.2, 1.3];
      const stages = [{ threshold: 0, dashSpeed: baseDash }];
      for (let i = 0; i < thresholds.length; i++) {
        const t = thresholds[i];
        const mul = multipliers[Math.min(i, multipliers.length - 1)] || 1;
        stages.push({ threshold: t, dashSpeed: baseDash * mul });
      }
      chargeStages = stages;
    }

    const selectChargeStage = (chargeT = 0) => {
      if (!chargeStages.length) {
        return null;
      }
      let current = chargeStages[0];
      for (const stage of chargeStages) {
        if (chargeT >= (stage.threshold ?? 0)) {
          current = stage;
        } else {
          break;
        }
      }
      return current;
    };

    const applyStageValues = (stage, fallbackChargeT = 0) => {
      const damage = stage?.damage ?? descriptor?.baseDamage ?? 4;
      const knockback = stage?.knockback ?? descriptor?.baseKnockback ?? 150;
      const dashSpeed = stage?.dashSpeed ?? baseDash;
      const angle = stage?.knockbackAngle ?? descriptor?.knockbackAngle ?? 45;

      p.attack.damage = damage;
      p.attack.knockback = knockback;
      p.attack.knockbackAngle = angle;
      p.vel.x = p.facing * dashSpeed;

      // DEBUG: HP R2 Movement Calculation (only in dev mode)
      if (
        charKey === "hp" &&
        state?.debug?.devMode &&
        state?.debug?.movementLogging
      ) {
        console.log(`🎯 HP R2 Movement Debug:`, {
          charKey,
          chargeT: fallbackChargeT,
          stage: stage?.threshold || 0,
          baseDash,
          stageDashSpeed: stage?.dashSpeed,
          finalDashSpeed: dashSpeed,
          facing: p.facing,
          finalVelX: p.vel.x,
          damage,
          knockback,
        });
      }

      if (chargeStages.length) {
        const lastStage = chargeStages[chargeStages.length - 1];
        p.attack.wasMaxCharge = stage === lastStage;
      } else {
        const maxCharge =
          r2Config.maxCharge ?? descriptor?.maxCharge ?? fallbackChargeT;
        p.attack.wasMaxCharge = fallbackChargeT >= maxCharge;
      }
    };

    // Wind-up slow: reduce velocity during first 4 frames of start phase
    if (p.attack.phase === "start") {
      // Apply progressive friction reduction during first 4 frames
      if (p.frameIndex !== undefined && p.frameIndex < 4) {
        const frameProgress = p.frameIndex / 4; // 0 to 1
        // Start with heavy slow, then gradually return to normal
        const frictionMultiplier = 0.3 + frameProgress * 0.7; // 0.3 → 1.0
        p.vel.x *= frictionMultiplier;
      } else {
        // After 4 frames, normal friction applies
        p.vel.x *= 0.85; // Standard ground friction
      }

      if (p.animFinished) {
        p.attack.phase = inputs.r2Held ? "loop" : "release";
        setAnim(
          p,
          inputs.r2Held ? "r2_loop" : "r2_release",
          inputs.r2Held,
          state,
          animSpeed
        );
        if (!inputs.r2Held) {
          const stage = selectChargeStage(0);
          applyStageValues(stage, 0);
          p.attack.hitTargets = new Set();
          const relFx = descriptor?.fx?.release?.id;
          if (relFx && typeof spawnGlobalEffect === "function") {
            spawnGlobalEffect(state, p, relFx, { speed: animSpeed });
          }
        }
      }
      return;
    }

    if (p.attack.phase === "loop") {
      const maxCharge =
        r2Config.maxCharge ?? descriptor?.maxCharge ?? (p.attack.chargeT || 0);
      const clampedT = Math.min((p.attack.chargeT || 0) + dt, maxCharge);
      p.attack.chargeT = clampedT;

      applyChargeFxFromDescriptor(p, descriptor, clampedT);

      const maxStageThreshold =
        chargeStages.length > 1
          ? chargeStages[chargeStages.length - 1]?.threshold ?? Infinity
          : Infinity;
      if (clampedT >= maxStageThreshold && p.anim !== "r2_loop_max") {
        setAnim(p, "r2_loop_max", true, state, animSpeed);
      }

      if (!inputs.r2Held || clampedT >= maxCharge) {
        p.attack.phase = "release";
        setAnim(p, "r2_release", false, state, animSpeed);
        p.chargeFx = null;
        const relFx = descriptor?.fx?.release?.id;
        if (relFx && typeof spawnGlobalEffect === "function") {
          spawnGlobalEffect(state, p, relFx, { speed: animSpeed });
        }
        // Apply stage values when transitioning to release
        const stage = selectChargeStage(clampedT);
        applyStageValues(stage, clampedT);
        p.attack.hitTargets = new Set();
      }
      return;
    }

    if (p.attack.phase === "release") {
      if (!(p.attack.hitTargets instanceof Set)) {
        p.attack.hitTargets = new Set();
      }

      // CYBOARD R2 MAX CHARGE: Handle slow-motion effect
      if (charKey === "cyboard" && p.attack.slowMotionActive) {
        // EDGE CASE: If attack ended or target eliminated, cleanup slow-motion
        if (
          p.attack.type !== "r2" ||
          p.attack.phase !== "release" ||
          !p.attack.slowMotionHitTarget ||
          p.attack.slowMotionHitTarget.eliminated
        ) {
          // Cleanup slow-motion if attack ended unexpectedly
          state.timeScale = 1.0;
          if (
            p.attack.slowMotionHitTarget &&
            !p.attack.slowMotionHitTarget.eliminated
          ) {
            const target = p.attack.slowMotionHitTarget;
            // Release target - apply minimal knockback as safety
            if (target.attack?.frozenVel) {
              AttackSystem.applyStandardKnockback(target, 75, 45, p.facing);
              delete target.attack.frozenVel;
            }
          }
          p.attack.slowMotionActive = false;
          p.attack.slowMotionTimer = 0;
          p.attack.slowMotionHitTarget = null;
          // Continue with normal release logic
        } else {
          p.attack.slowMotionTimer = (p.attack.slowMotionTimer || 0) + dt;

          // Get current stage for dash speed calculation
          const chargeT = p.attack.chargeT || 0;
          const currentStage = selectChargeStage(chargeT);

          // Reduce dash speed during slow-motion (reduced to 20% = timeScale)
          const stageDashSpeed =
            (currentStage?.dashSpeed ?? baseDash) * (state.timeScale || 1);
          const dashDirection = p.attack.dashDirection ?? p.facing;
          p.vel.x = dashDirection * stageDashSpeed;

          // Keep target frozen during slow-motion
          const target = p.attack.slowMotionHitTarget;
          if (target && !target.eliminated) {
            // Freeze position and velocity
            target.vel.x = 0;
            target.vel.y = 0;
            // Prevent any movement input during freeze
            if (!target.attack) target.attack = {};
            target.attack.isFrozen = true;
          }

          // Check if combo should be triggered during slow-motion
          if (
            p.attack.wasMaxCharge &&
            inputs.r2Down &&
            p.frameIndex >= p.frames.length - 2
          ) {
            // Combo triggered: End slow-motion and transition to combo
            state.timeScale = 1.0; // Return to normal speed

            // Store target reference for combo
            const comboTarget = target;
            const currentDashKnockback =
              p.attack.knockback ?? descriptor?.baseKnockback ?? 150;

            // Release target from freeze (combo will handle new freeze)
            if (
              comboTarget &&
              !comboTarget.eliminated &&
              comboTarget.attack?.frozenVel
            ) {
              delete comboTarget.attack.frozenVel;
              delete comboTarget.attack.isFrozen;
            }

            p.attack = {
              type: "r2_combo",
              phase: "start",
              hitConfirmed: false,
              previousDashKnockback: currentDashKnockback,
              comboTarget: comboTarget, // Store for combo hit
              owner: "mod",
            };
            setAnim(p, "r2_combo", false, state);
            return;
          }

          // Slow-motion timer expired: Apply knockback and return to normal speed
          if (p.attack.slowMotionTimer >= p.attack.slowMotionDuration) {
            state.timeScale = 1.0; // Return to normal speed

            // Apply standard knockback to target with proper scaling
            if (target && !target.eliminated) {
              const r2Descriptor = AttackCatalog.getDescriptor(p, "r2");
              const chargeT = p.attack.chargeT || 0;
              const stage = selectChargeStage(chargeT);

              // Improved knockback scaling: Use stage knockback if available, otherwise base
              const baseKnockbackValue =
                stage?.knockback ?? r2Descriptor?.baseKnockback ?? 150;

              // Calculate final knockback with percent scaling
              const finalKnockback = AttackSystem.calculateFinalKnockback(
                p,
                target,
                {
                  ...r2Descriptor,
                  baseKnockback: baseKnockbackValue,
                }
              );

              // Apply knockback
              AttackSystem.applyStandardKnockback(
                target,
                finalKnockback,
                r2Descriptor?.knockbackAngle ?? 45,
                p.facing
              );

              // Apply damage
              const damage = stage?.damage ?? r2Descriptor?.baseDamage ?? 4;
              target.percent = Math.min(999, (target.percent || 0) + damage);

              // Apply stun
              target.stunT = r2Descriptor?.stunDuration ?? 0.2;
              setAnim(target, "hurt", false, state);

              // Release target from freeze - ensure velocity is not stuck
              if (target.attack?.frozenVel) {
                delete target.attack.frozenVel;
              }
              if (target.attack?.isFrozen) {
                delete target.attack.isFrozen;
              }

              console.log(
                "🎬 Slow-motion ended: Knockback applied, target freed",
                { knockback: finalKnockback, damage }
              );
            }

            // Continue normal dash after slow-motion
            const chargeT = p.attack.chargeT || 0;
            const currentStage = selectChargeStage(chargeT);
            const dashSpeed = currentStage?.dashSpeed ?? baseDash;
            const dashDirection = p.attack.dashDirection ?? p.facing;
            p.vel.x = dashDirection * dashSpeed;

            // Reset slow-motion state
            p.attack.slowMotionActive = false;
            p.attack.slowMotionTimer = 0;
            p.attack.slowMotionHitTarget = null;
          }

          return; // Skip normal release logic during slow-motion
        }
      }

      if (!p.attack.releaseInitialized) {
        p.attack.releaseInitialized = true;
        p.attack.releaseTimer = 0;
        // CRITICAL: Store original dash direction at attack start
        // This prevents velocity from flipping when facing changes during the attack
        p.attack.dashDirection = p.facing;
        // CRITICAL: Store start position for range-based dash control
        // This ensures consistent range regardless of initial movement speed
        p.attack.dashStartX = p.pos.x;
        p.attack.dashDistanceTraveled = 0;

        const chargeT = p.attack.chargeT || 0;
        const stage = selectChargeStage(chargeT);
        applyStageValues(stage, chargeT);
        p.chargeFx = null;

        // HP R2 MAX CHARGE: Initialize grab tracking for max charge
        if (charKey === "hp" && p.attack.wasMaxCharge) {
          p.attack.maxChargeGrabbedTarget = null;
          p.attack.maxChargeKnockbackPending = false;
          p.attack.maxChargeKnockbackDelay = 0;
        }
      }

      // HP R2 MAX CHARGE: Handle dragging and delayed knockback
      if (charKey === "hp" && p.attack.wasMaxCharge) {
        const grabbedTarget = p.attack.maxChargeGrabbedTarget;
        const releaseFrame = p.frameIndex || 0;

        // Frame 1: Check for hit and grab target
        if (releaseFrame === 1 && !grabbedTarget) {
          // Check if any hit was registered in this frame
          const atkRect = Renderer.getR2Hitbox(p, state);
          for (const target of state.players) {
            if (target === p || target.eliminated) continue;
            const hurtRect = Renderer.getHurtbox(target);
            if (rectsIntersect(atkRect, hurtRect)) {
              // Grab the target
              p.attack.maxChargeGrabbedTarget = target;
              target.isGrabbed = true;
              target.grabbedBy = p;
              // Set grabbed animation
              setAnim(target, "is_grabbed", true, state, 1);
              // Apply initial small damage
              const initialDamage = descriptor?.baseDamage ?? 4;
              target.percent += initialDamage;
              break;
            }
          }
        }

        // Frames 1-4: Drag the grabbed target along
        if (
          grabbedTarget &&
          !grabbedTarget.eliminated &&
          releaseFrame >= 1 &&
          releaseFrame < 5
        ) {
          // Lock target position relative to attacker
          const offsetX = p.facing * 60; // Offset distance in front of attacker
          grabbedTarget.pos.x = p.pos.x + offsetX;
          grabbedTarget.pos.y = p.pos.y;
          grabbedTarget.vel.x = p.vel.x;
          grabbedTarget.vel.y = 0;
          // Prevent target from moving on their own
          grabbedTarget.attack = grabbedTarget.attack || {};
          grabbedTarget.attack.isGrabbed = true;
        }

        // Frame 5: Trigger delayed strong knockback
        if (releaseFrame === 5 && grabbedTarget && !grabbedTarget.eliminated) {
          p.attack.maxChargeKnockbackPending = true;
          p.attack.maxChargeKnockbackDelay = 0.05; // 50ms delay
        }

        // Apply delayed knockback after delay
        if (
          p.attack.maxChargeKnockbackPending &&
          grabbedTarget &&
          !grabbedTarget.eliminated
        ) {
          p.attack.maxChargeKnockbackDelay -= dt;
          if (p.attack.maxChargeKnockbackDelay <= 0) {
            // Release target and apply strong knockback
            grabbedTarget.isGrabbed = false;
            if (grabbedTarget.attack) {
              delete grabbedTarget.attack.isGrabbed;
            }

            // Strong knockback for max charge
            const strongKnockback = descriptor?.baseKnockback
              ? descriptor.baseKnockback * 2.5
              : 750;
            const strongDamage = descriptor?.baseDamage
              ? descriptor.baseDamage * 1.5
              : 12;

            grabbedTarget.percent += strongDamage;
            grabbedTarget.stunT = descriptor?.stunDuration ?? 0.2;

            // Apply knockback
            const knockbackAngle = descriptor?.knockbackAngle ?? 45;
            const knockbackType = descriptor?.knockbackType ?? "standard";
            const finalKnockback = calculateFinalKnockback(p, grabbedTarget, {
              ...descriptor,
              baseKnockback: strongKnockback,
            });

            if (knockbackType === "standard") {
              applyStandardKnockback(
                grabbedTarget,
                finalKnockback,
                knockbackAngle,
                p.facing
              );
            }

            // Set hurt animation
            setAnim(grabbedTarget, "hurt", false, state);

            // Spawn hit effects
            spawnHitEffects(p, grabbedTarget, descriptor, state);

            // Clear grab state
            p.attack.maxChargeGrabbedTarget = null;
            p.attack.maxChargeKnockbackPending = false;
          }
        }
      }

      // RANGE-BASED DASH CONTROL: Calculate target range from descriptor/config
      const chargeT = p.attack.chargeT || 0;
      const stage = selectChargeStage(chargeT);
      const dashDirection = p.attack.dashDirection ?? p.facing;

      // Get target range from descriptor or calculate from speed*duration
      const targetRange =
        stage?.dashRange ??
        descriptor?.movement?.dashRange ??
        (stage?.dashSpeed ?? baseDash) * 0.2; // Fallback: speed * duration

      // Calculate distance traveled so far
      const distanceTraveled = Math.abs(p.pos.x - p.attack.dashStartX);
      p.attack.dashDistanceTraveled = distanceTraveled;

      // Calculate max allowed time based on target range and speed
      const stageDashSpeed = stage?.dashSpeed ?? baseDash;
      const maxTimeNeeded = targetRange / stageDashSpeed; // Time needed to reach target range
      const fallbackTime = Math.max(0.5, maxTimeNeeded * 1.5); // 50% buffer, minimum 0.5s

      // If we've reached or exceeded target range, stop
      if (distanceTraveled >= targetRange) {
        p.vel.x = 0;
        // End attack after a brief delay to allow animation to finish
        p.attack.releaseTimer += dt;
        if (p.attack.releaseTimer >= 0.05 && p.animFinished) {
          // Small buffer after reaching range AND animation finished
          // For Fritz, transition to recovery animation
          if (charKey === "fritz") {
            p.attack = { type: "r2_recovery", phase: "active", owner: "mod" };
            setAnim(p, "r2_recovery", false, state);
          } else {
            p.attack = { type: "none", phase: "none" };
          }
        }
        return;
      }

      // Use the stage's dashSpeed directly (it's already calibrated for each charge level)
      const dashSpeed = stageDashSpeed;

      // CRITICAL: Enforce dash velocity every frame during release phase
      // This prevents existing movement velocity from adding to the dash speed
      p.vel.x = dashDirection * dashSpeed;

      if (
        p.attack.wasMaxCharge &&
        inputs.r2Down &&
        p.frameIndex >= p.frames.length - 2
      ) {
        // Store the dash knockback from the current R2 release for use in combo
        const currentDashKnockback =
          p.attack.knockback ?? descriptor?.baseKnockback ?? 150;
        p.attack = {
          type: "r2_combo",
          phase: "start",
          hitConfirmed: false,
          previousDashKnockback: currentDashKnockback, // Store for doubling in combo
          owner: "mod",
        };
        setAnim(p, "r2_combo", false, state);
        return;
      }

      // Dynamic fallback timer based on target range (prevents premature stopping)
      p.attack.releaseTimer += dt;
      if (p.attack.releaseTimer >= fallbackTime && p.animFinished) {
        // Stop if exceeded calculated time (safety net) AND animation finished
        // For Fritz, transition to recovery animation
        if (charKey === "fritz") {
          p.attack = { type: "r2_recovery", phase: "active", owner: "mod" };
          setAnim(p, "r2_recovery", false, state);
        } else {
          p.attack = { type: "none", phase: "none" };
        }
      }
    }
  }

  function handleR2Combo(p, inputs, state, grounded, dt) {
    const charKey = p.charName?.toLowerCase?.();

    // IMPORTANT: For Fritz, ensure swordIsOut is never set or blocking
    // Fritz R2_combo does NOT spawn projectiles, so swordIsOut should remain false
    if (charKey === "fritz" || p.charName === "fritz") {
      p.swordIsOut = false; // Ensure it's cleared for Fritz
    }

    // Apply hitlag in frames 001-002 (before knock-up)
    if (p.frameIndex === 1 || p.frameIndex === 2) {
      // Hitlag: Stop velocity during these frames
      p.vel.x *= 0.3; // Heavy friction during hitlag
      p.vel.y *= 0.3;
    }

    // Recovery phase: frames after 002
    if (p.frameIndex > 2) {
      // Normal recovery - allow movement
      p.vel.x *= 0.85; // Standard ground friction
    }

    if (p.animFinished) {
      p.attack = { type: "none", phase: "none" };
      // Ensure swordIsOut is cleared when combo finishes (for Fritz)
      if (charKey === "fritz" || p.charName === "fritz") {
        p.swordIsOut = false;
      }
    }
  }

  function handleR2HitFollowup(p, inputs, state, grounded, dt) {
    if (p.animFinished) {
      p.attack = { type: "none", phase: "none" };
    }
  }

  function handleR2Recovery(p, state) {
    // Simple recovery handler - just wait for animation to finish
    if (p.animFinished) {
      p.attack = { type: "none", phase: "none" };
    }
  }

  function handleR1ComboActive(p, inputs, state, grounded, dt) {
    if (!grounded) {
      releaseGrabbedTarget(p, state);
      return;
    }

    const charKey = p.charName?.toLowerCase?.();
    const attackConfig = CharacterCatalog.getAttackConfig(charKey, state) || {};
    const comboConfig = attackConfig.r1_combo || {};
    const descriptor = AttackCatalog.getDescriptor(p, "r1_combo_active");
    const comboSteps = descriptor?.combo?.steps || [];

    if (!comboSteps.length) {
      releaseGrabbedTarget(p, state);
      p.attack = { type: "none", phase: "none" };
      return;
    }

    const stepIndex = Math.max(1, p.attack.comboStep || 1);
    const currentStep = comboSteps[stepIndex - 1];

    if (!currentStep) {
      releaseGrabbedTarget(p, state);
      p.attack = { type: "none", phase: "none" };
      return;
    }

    if (!(p.attack.hitTargets instanceof Set)) {
      p.attack.hitTargets = new Set();
    }

    const queueWindow = currentStep.queueWindowFrames;
    if (inputs.r1Down) {
      if (queueWindow == null || p.frameIndex >= queueWindow) {
        p.attack.inputQueued = true;
      }
    }

    if (p.attack.grabbedTarget) {
      const target = p.attack.grabbedTarget;
      if (!target || target.eliminated) {
        releaseGrabbedTarget(p, state);
      } else if (currentStep.dragTarget) {
        const offset =
          currentStep.dragOffset ??
          p.attack.dragOffset ??
          comboConfig.dragOffset ??
          60;
        target.pos.x = p.pos.x + p.facing * offset;
        target.pos.y = p.pos.y;
        target.vel.x = 0;
        target.vel.y = 0;
      } else {
        releaseGrabbedTarget(p, state);
      }
    }

    const atkRect = Renderer.getR1Hitbox(p, state);

    for (const target of state.players) {
      if (target === p || target.eliminated) continue;
      if (p.attack.hitTargets.has(target)) continue;

      const hurtRect = Renderer.getHurtbox(target);
      if (!rectsIntersect(atkRect, hurtRect)) continue;

      if (currentStep.dragTarget && !p.attack.grabbedTarget) {
        p.attack.grabbedTarget = target;
        target.isGrabbed = true;
        target.grabbedBy = p;
        target.vel.x = 0;
        target.vel.y = 0;
      }

      if (!currentStep.finisher || !currentStep.dragTarget) {
        const stepDescriptor = buildComboStepDescriptor(
          descriptor,
          currentStep
        );
        applyDamageWithDescriptor(p, target, stepDescriptor, state);
      } else {
        p.attack.pendingFinisher = buildComboStepDescriptor(
          descriptor,
          currentStep
        );
      }

      p.attack.hitTargets.add(target);
    }

    if (p.animFinished) {
      if (currentStep.finisher) {
        const target = p.attack.grabbedTarget;
        const finisherDescriptor =
          p.attack.pendingFinisher ||
          buildComboStepDescriptor(descriptor, currentStep);

        if (target && !target.eliminated) {
          target.isGrabbed = false;
          p.attack.grabbedTarget = null;
          p.attack.pendingFinisher = null;
          applyDamageWithDescriptor(p, target, finisherDescriptor, state);
        } else {
          releaseGrabbedTarget(p, state);
        }

        p.attack = { type: "none", phase: "none" };
        return;
      }

      if (p.attack.inputQueued && stepIndex < comboSteps.length) {
        const nextStep = stepIndex + 1;
        setR1ComboStep(p, state, descriptor, comboConfig, nextStep);
        return;
      }

      releaseGrabbedTarget(p, state);
      p.attack = { type: "none", phase: "none" };
    }
  }

  function handleHPR1(p, inputs, state, grounded, dt) {
    if (!grounded) {
      return;
    }

    const charKey = p.charName.toLowerCase();
    const attackConfig = CharacterCatalog.getAttackConfig(charKey, state) || {};
    const r1Config = attackConfig.r1 || {};
    const descriptor = AttackCatalog.getDescriptor(p, "r1");
    const dashConfigFromCatalog = attackConfig.r1_dash_attack || {};
    const dashWindow = r1Config.dashTapWindow ?? 0.2;
    const maxCharge = descriptor.maxCharge ?? 2.0;

    const dashDescriptor = AttackCatalog.getDescriptor(p, "r1_dash_attack");
    const dashMovement = dashDescriptor?.movement || {};
    const dashConfig = {
      horizontalSpeedMultiplier:
        dashMovement.horizontalSpeedMultiplier ??
        dashConfigFromCatalog.horizontalSpeedMultiplier ??
        0,
      landingFriction:
        dashMovement.landingFriction ??
        dashConfigFromCatalog.landingFriction ??
        0.7,
      animSpeed: dashMovement.animSpeed ?? dashConfigFromCatalog.animSpeed ?? 1,
      dashRange:
        dashMovement.dashRange ?? dashConfigFromCatalog.dashRange ?? null,
    };

    const startDashAttack = () => {
      p.attack = { type: "r1_dash_attack", phase: "active", owner: "mod" };
      p.attack.hitTargets = new Set();
      p.attack.dashDirection = p.facing;
      p.attack.dashStartX = p.pos.x;
      p.attack.dashDistanceTraveled = 0;
      p.attack._dashConfig = dashConfig;
      setAnim(p, "r1_dash_attack", false, state, dashConfig.animSpeed || 1);
      const baseSpeed = p.config.physics.moveSpeed;
      const multiplier = dashConfig.horizontalSpeedMultiplier || 1;
      p.vel.x = p.facing * baseSpeed * multiplier;
      p.vel.y = 0;
      p.r1DashTapTimer = 0;
    };

    const beginRelease = (chargeT) => {
      const stage =
        selectDescriptorChargeStage(descriptor.chargeStages, chargeT) || null;
      const damage =
        stage?.damage ?? r1Config.releaseDamage ?? descriptor.baseDamage ?? 4;
      const knockback =
        stage?.knockback ??
        r1Config.releaseKnockback ??
        descriptor.baseKnockback ??
        150;
      const angle =
        stage?.knockbackAngle ??
        r1Config.releaseKnockbackAngle ??
        descriptor.knockbackAngle ??
        20;
      const stun =
        stage?.stun ?? r1Config.releaseStun ?? descriptor.stunDuration ?? 0.2;

      p.attack.phase = "release";
      p.attack.finalChargeT = chargeT;
      p.attack.chargeT = chargeT;
      p.attack.damage = damage;
      p.attack.knockback = knockback;
      p.attack.knockbackAngle = angle;
      p.attack.stunDuration = stun;
      p.attack.hitTargets = new Set();
      p.attack.releaseHitFlags = new Map();
      setAnim(
        p,
        "r1release",
        false,
        state,
        r1Config.releaseAnimSpeed || r1Config.animSpeed || 1
      );
      p.vel.x *= 0.25;
    };

    if (p.attack.phase === "start") {
      if (!p.attack._dashTapInit) {
        p.r1DashTapTimer = dashWindow;
        p.attack._dashTapInit = true;
      }

      p.r1DashTapTimer = Math.max(0, (p.r1DashTapTimer || 0) - dt);

      if (
        inputs.r1Down &&
        (p.r1DashTapTimer || 0) > 0 &&
        dashConfig.horizontalSpeedMultiplier
      ) {
        startDashAttack();
        return;
      }

      if ((p.r1DashTapTimer || 0) > 0) {
        return;
      }

      if (p.animFinished) {
        if (inputs.r1Held) {
          p.attack.phase = "charge";
          p.attack.chargeT = 0;
          p.attack.hitTargets = new Set();
          setAnim(p, "r1loop", true, state, r1Config.animSpeed || 1);
          p.vel.x *= 0.5;
        } else {
          beginRelease(0);
        }
      }
    } else if (p.attack.phase === "charge") {
      const nextCharge = Math.min((p.attack.chargeT || 0) + dt, maxCharge);
      p.attack.chargeT = nextCharge;

      applyChargeFxFromDescriptor(p, descriptor, nextCharge);

      p.vel.x *= 0.9;

      if (!inputs.r1Held || inputs.r1Up || nextCharge >= maxCharge) {
        beginRelease(nextCharge);
        p.chargeFx = null;
      }
    } else if (p.attack.phase === "release") {
      if (Math.abs(p.vel.x) > 0.01) {
        p.vel.x *= 0.8;
        if (Math.abs(p.vel.x) < 5) {
          p.vel.x = 0;
        }
      }

      if (p.animFinished) {
        p.attack = { type: "none", phase: "none" };
      }
    } else {
      p.attack = { type: "none", phase: "none" };
    }
  }
  function handleDefaultR1(p, inputs, state, grounded, dt) {
    /* Implementation */
  }

  function initializeR2Attack(p, state) {
    const charKey = p.charName.toLowerCase();
    const attackConfig = CharacterCatalog.getAttackConfig(charKey, state) || {};
    const r2Config = attackConfig.r2 || {};
    const animSpeed = r2Config.animSpeed || 1;

    p.attack = {
      type: "r2",
      phase: "start",
      chargeT: 0,
      wasMaxCharge: false,
      hitTargets: new Set(),
      owner: "mod",
    };

    p.chargeFx = null;
    startCooldown(p, "r2", state);
    setAnim(p, "r2_start", false, state, animSpeed);
  }

  function handleCyboardR2(p, inputs, state) {
    if (p.swordIsOut) {
      return;
    }
    initializeR2Attack(p, state);
  }
  function handleFritzR2(p, inputs, state) {
    initializeR2Attack(p, state);
  }
  function handleHPR2(p, inputs, state) {
    initializeR2Attack(p, state);
  }
  function handleDefaultR2(p, inputs, state) {
    initializeR2Attack(p, state);
  }

  function handleCyboardL1(p, inputs, state) {
    const charKey = "cyboard";
    const attackConfig = CharacterCatalog.getAttackConfig(charKey, state) || {};
    const l1Config = attackConfig.l1 || {};

    p.attack = {
      type: "l1",
      phase: "start",
      chargeT: 0,
      owner: "mod",
    };
    startCooldown(p, "l1", state);
    setAnim(p, "l1_start", false, state, l1Config.animSpeed || 1);
    p.chargeFx = null;
    p.attack.projectileSpawned = false;
    p.vel.x = 0;
  }

  function handleFritzL1(p, inputs, state) {
    const charKey = "fritz";
    const attackConfig = CharacterCatalog.getAttackConfig(charKey, state) || {};
    const smashConfig = attackConfig.l1_smash || {};

    // Check if L1 is held for smash, otherwise start jab
    if (inputs.l1Held) {
      p.attack = {
        type: "l1_smash",
        phase: "start",
        chargeT: 0,
        owner: "mod",
      };
      startCooldown(p, "l1", state);
      setAnim(p, "l1_jab_start", false, state, smashConfig.animSpeed || 1);
      p.chargeFx = null;
    } else {
      // Quick tap - start jab directly
      p.attack = {
        type: "l1_jab",
        phase: "start",
        inputQueued: false,
        hitTargets: new Set(),
        owner: "mod",
      };
      startCooldown(p, "l1", state);
      setAnim(p, "l1_jab_start", false, state, 1);
    }
  }

  function handleHPL1(p, inputs, state) {
    const charKey = "hp";
    const attackConfig = CharacterCatalog.getAttackConfig(charKey, state) || {};
    const grabConfig = attackConfig.l1_ranged_grab || {};

    p.attack = {
      type: "l1_ranged_grab",
      phase: "cast",
      chargeT: 0,
      grabbedTarget: null,
      detectActive: false,
      hitChecked: false,
      savedTarget: null,
      owner: "mod",
      spawnedDetectFrames: new Set(),
    };
    startCooldown(p, "l1", state);
    setAnim(p, "l1_ranged_grab", false, state, grabConfig.animSpeed || 1);
    p.vel.x = 0;
    p.vel.y = 0;
  }

  function handleDefaultL1(p, inputs, state) {
    p.attack = { type: "none", phase: "none" };
  }

  function spawnCyboardL1Projectile(p, state) {
    if (p.attack.projectileSpawned) {
      return;
    }

    const descriptor = AttackCatalog.getDescriptor(p, "l1");
    const projType = descriptor?.projectile?.type || "l1_bomb";
    const shouldSpawn = descriptor?.projectile?.spawnOnRelease !== false; // default true
    if (shouldSpawn && typeof spawnProjectile === "function") {
      spawnProjectile(state, p, projType);
    } else if (!shouldSpawn) {
      // projectile disabled: do nothing
    } else {
      const fallbackRect = Renderer.getL1JabHitbox(p);
      for (const target of state.players) {
        if (target === p || target.eliminated) continue;
        const hurtRect = Renderer.getHurtbox(target);
        if (rectsIntersect(fallbackRect, hurtRect)) {
          applyDamageWithDescriptor(p, target, descriptor, state);
        }
      }
    }

    p.attack.projectileSpawned = true;
  }

  function handleCyboardL1State(p, inputs, state, grounded, dt) {
    if (!grounded) {
      p.attack = { type: "none", phase: "none" };
      return;
    }

    const charKey = "cyboard";
    const attackConfig = CharacterCatalog.getAttackConfig(charKey, state) || {};
    const l1Config = attackConfig.l1 || {};
    const descriptor = AttackCatalog.getDescriptor(p, "l1");
    const maxCharge = l1Config.maxCharge ?? descriptor?.maxCharge ?? 1.5;

    if (p.attack.phase === "start") {
      if (p.animFinished) {
        if (inputs.l1Held) {
          p.attack.phase = "charge";
          p.attack.chargeT = 0;
          setAnim(p, "l1_charge_loop", true, state, l1Config.animSpeed || 1);
        } else {
          p.attack.phase = "release";
          p.attack.damage = l1Config.bombDamage ?? descriptor.baseDamage;
          setAnim(p, "l1_release", false, state, l1Config.animSpeed || 1);
          const relFx = descriptor?.fx?.release?.id;
          if (relFx && typeof spawnGlobalEffect === "function") {
            spawnGlobalEffect(state, p, relFx, {
              speed: l1Config.animSpeed || 1,
            });
          }
          spawnCyboardL1Projectile(p, state);
        }
      }
    } else if (p.attack.phase === "charge") {
      const chargeT = (p.attack.chargeT = Math.min(
        (p.attack.chargeT || 0) + dt,
        maxCharge
      ));

      applyChargeFxFromDescriptor(p, descriptor, chargeT);

      if (!inputs.l1Held || inputs.l1Up) {
        p.attack.phase = "release";
        p.attack.damage = l1Config.bombDamage ?? descriptor.baseDamage;
        setAnim(p, "l1_release", false, state, l1Config.animSpeed || 1);
        p.chargeFx = null;
        const relFx = descriptor?.fx?.release?.id;
        if (relFx && typeof spawnGlobalEffect === "function") {
          spawnGlobalEffect(state, p, relFx, {
            speed: l1Config.animSpeed || 1,
          });
        }
        spawnCyboardL1Projectile(p, state);
      }
    } else if (p.attack.phase === "release") {
      if (p.animFinished) {
        p.attack = { type: "none", phase: "none" };
      }
    }
  }
  function handleErnstR1(p, inputs, state, grounded, dt) {
    if (!grounded) {
      return;
    }

    const charKey = "ernst";
    const attackConfig = CharacterCatalog.getAttackConfig(charKey, state) || {};
    const r1Config = attackConfig.r1 || {};
    const descriptor = AttackCatalog.getDescriptor(p, "r1");
    const dashConfigFromCatalog = attackConfig.r1_dash_attack || {};
    const dashWindow = r1Config.dashTapWindow ?? 0.2;
    const maxCharge = descriptor.maxCharge ?? 2.0;
    const releaseDashFrames = r1Config.releaseDashFrames || [];
    const releaseDashMultiplier = r1Config.releaseDashMultiplier ?? 1;

    if (typeof p.attack.chargeT !== "number") {
      p.attack.chargeT = 0;
    }
    if (!(p.attack.hitTargets instanceof Set)) {
      p.attack.hitTargets = new Set();
    }

    const dashDescriptor = AttackCatalog.getDescriptor(p, "r1_dash_attack");
    const dashMovement = dashDescriptor?.movement || {};
    const dashSettings = {
      horizontalSpeedMultiplier:
        dashMovement.horizontalSpeedMultiplier ??
        dashConfigFromCatalog.horizontalSpeedMultiplier ??
        0,
      landingFriction:
        dashMovement.landingFriction ??
        dashConfigFromCatalog.landingFriction ??
        0.7,
      animSpeed: dashMovement.animSpeed ?? dashConfigFromCatalog.animSpeed ?? 1,
      dashRange:
        dashMovement.dashRange ?? dashConfigFromCatalog.dashRange ?? null,
    };

    const startDashAttack = () => {
      p.attack = { type: "r1_dash_attack", phase: "active", owner: "mod" };
      p.attack.hitTargets = new Set();
      p.attack.dashDirection = p.facing;
      p.attack.dashStartX = p.pos.x;
      p.attack.dashDistanceTraveled = 0;
      p.attack._dashConfig = dashSettings;
      setAnim(p, "r1_dash_attack", false, state, dashSettings.animSpeed || 1);
      const moveSpeed = p.config.physics.moveSpeed;
      const multiplier = dashSettings.horizontalSpeedMultiplier || 1;
      p.vel.x = p.facing * moveSpeed * multiplier;
      p.vel.y = 0;
      p.r1DashTapTimer = 0;
    };

    const beginRelease = (chargeT) => {
      const stage =
        selectDescriptorChargeStage(descriptor.chargeStages, chargeT) || null;
      const damage =
        stage?.damage ?? r1Config.releaseDamage ?? descriptor.baseDamage ?? 4;
      const knockback =
        stage?.knockback ??
        r1Config.releaseKnockback ??
        descriptor.baseKnockback ??
        150;
      const angle =
        stage?.knockbackAngle ??
        r1Config.releaseKnockbackAngle ??
        descriptor.knockbackAngle ??
        5;
      const stun =
        stage?.stun ?? r1Config.releaseStun ?? descriptor.stunDuration ?? 0.15;

      p.attack.phase = "release";
      p.attack.finalChargeT = chargeT;
      p.attack.chargeT = chargeT;
      p.attack.damage = damage;
      p.attack.knockback = knockback;
      p.attack.knockbackAngle = angle;
      p.attack.stunDuration = stun;
      p.attack.hitTargets = new Set();
      setAnim(
        p,
        "r1release",
        false,
        state,
        r1Config.releaseAnimSpeed || r1Config.animSpeed || 1
      );
      p.vel.x *= 0.25;
    };

    if (p.attack.phase === "start") {
      if (!p.attack._dashTapInit) {
        p.r1DashTapTimer = dashWindow;
        p.attack._dashTapInit = true;
      }

      p.r1DashTapTimer = Math.max(0, (p.r1DashTapTimer || 0) - dt);

      if (
        inputs.r1Down &&
        (p.r1DashTapTimer || 0) > 0 &&
        dashSettings.horizontalSpeedMultiplier
      ) {
        startDashAttack();
        return;
      }

      if ((p.r1DashTapTimer || 0) > 0) {
        return;
      }

      if (p.animFinished) {
        if (inputs.r1Held) {
          p.attack.phase = "charge";
          p.attack.chargeT = 0;
          p.attack.hitTargets = new Set();
          setAnim(p, "r1loop", true, state, r1Config.animSpeed || 1);
          p.vel.x *= 0.6;
        } else {
          beginRelease(0);
        }
      }
    } else if (p.attack.phase === "charge") {
      const nextCharge = Math.min((p.attack.chargeT || 0) + dt, maxCharge);
      p.attack.chargeT = nextCharge;
      applyChargeFxFromDescriptor(p, descriptor, nextCharge);

      p.vel.x *= 0.9;

      if (!inputs.r1Held || inputs.r1Up || nextCharge >= maxCharge) {
        beginRelease(nextCharge);
        p.chargeFx = null;
      }
    } else if (p.attack.phase === "release") {
      if (
        Array.isArray(releaseDashFrames) &&
        releaseDashFrames.includes(p.frameIndex)
      ) {
        const moveSpeed = p.config.physics.moveSpeed;
        p.vel.x = p.facing * moveSpeed * releaseDashMultiplier;
      } else {
        p.vel.x *= 0.9;
      }

      if (p.animFinished) {
        p.attack = { type: "none", phase: "none" };
      }
    } else {
      p.attack = { type: "none", phase: "none" };
    }
  }

  function handleFritzL1SmashState(p, inputs, state, grounded, dt) {
    if (!grounded) {
      p.attack = { type: "none", phase: "none" };
      return;
    }

    const charKey = "fritz";
    const attackConfig = CharacterCatalog.getAttackConfig(charKey, state) || {};
    const smashConfig = attackConfig.l1_smash || {};
    const descriptor = AttackCatalog.getDescriptor(p, "l1_smash");
    const thresholds = smashConfig.chargeThresholds || [];
    const maxCharge = smashConfig.maxCharge ?? descriptor?.maxCharge ?? 2.0;
    const damageStages = smashConfig.damageStages || [];
    const maxChargeThreshold = smashConfig.maxChargeThreshold ?? 0.9;

    if (p.attack.phase === "start") {
      if (p.animFinished) {
        if (inputs.l1Held) {
          p.attack.phase = "charge";
          p.attack.chargeT = 0;
          setAnim(p, "l1_charge_loop", true, state, smashConfig.animSpeed || 1);
        } else {
          startFritzL1Jab(p, state, attackConfig);
        }
      }
    } else if (p.attack.phase === "charge") {
      const chargeT = (p.attack.chargeT = Math.min(
        (p.attack.chargeT || 0) + dt,
        maxCharge
      ));

      applyChargeFxFromDescriptor(p, descriptor, chargeT);

      if (!inputs.l1Held || inputs.l1Up) {
        const stageDamage = getChargeStageDamage(
          chargeT,
          thresholds,
          damageStages
        );
        const isMaxCharge = chargeT >= maxCharge * maxChargeThreshold;
        p.attack.phase = "release";
        p.attack.isMaxCharge = isMaxCharge;
        p.attack.damage = stageDamage ?? descriptor.baseDamage;
        p.attack.hitTargets = new Set();

        const releaseAnim =
          descriptor?.movement?.[
            isMaxCharge ? "releaseAnimMax" : "releaseAnimNormal"
          ];
        setAnim(
          p,
          releaseAnim ||
            (isMaxCharge ? "l1_smash_release_max" : "l1_smash_release"),
          false,
          state,
          smashConfig.animSpeed || 1
        );
        p.chargeFx = null;
      }
    } else if (p.attack.phase === "release") {
      if (p.animFinished) {
        p.attack = { type: "none", phase: "none" };
      }
    }
  }

  function startFritzL1Jab(p, state, attackConfig) {
    const jabConfig = attackConfig.l1_jab || {};
    const descriptor = AttackCatalog.getDescriptor(p, "l1_jab");

    p.attack = {
      type: "l1_jab",
      phase: "start",
      inputQueued: false,
      hitTargets: new Set(),
      damage: descriptor?.baseDamage,
      owner: "mod",
    };

    startCooldown(p, "l1", state);
    setAnim(p, "l1_jab_start", false, state, jabConfig.animSpeed || 1);
  }

  function handleFritzL1JabState(p, inputs, state, grounded, _dt) {
    if (!grounded) {
      p.attack = { type: "none", phase: "none" };
      return;
    }

    console.log(
      "[Fritz L1 Jab] Phase:",
      p.attack.phase,
      "Anim:",
      p.anim,
      "Frame:",
      p.frameIndex,
      "AnimFinished:",
      p.animFinished
    );

    const attackConfig = CharacterCatalog.getAttackConfig("fritz", state) || {};
    const jabConfig = attackConfig.l1_jab || {};
    const queueFrame = jabConfig.queueWindowFrame ?? 2;

    if (inputs.l1Down && p.frameIndex >= queueFrame) {
      p.attack.inputQueued = true;
    }

    if (p.animFinished) {
      if (p.attack.inputQueued) {
        startFritzL1JabCombo(p, state, attackConfig);
      } else {
        p.attack = { type: "none", phase: "none" };
      }
    }
  }

  function startFritzL1JabCombo(p, state, attackConfig) {
    const comboConfig = attackConfig.l1_jab_combo || {};
    const descriptor = AttackCatalog.getDescriptor(p, "l1_jab_combo");
    const animSpeed = comboConfig.animSpeed || 1;
    const dashMultipliers = comboConfig.dashMultipliers || [];
    const stepDamage = comboConfig.stepDamage || [];
    const moveSpeed = p.config.physics.moveSpeed;

    p.attack = {
      type: "l1_jab_combo",
      phase: "active",
      comboStep: 1,
      inputQueued: false,
      hitTargets: new Set(),
      damage: stepDamage[0] ?? descriptor?.baseDamage,
    };

    setAnim(p, "l1_jab_combo_x1", false, state, animSpeed);

    const dashMul = dashMultipliers[0] ?? 0;
    if (dashMul) {
      p.vel.x = p.facing * moveSpeed * dashMul;
    }
  }

  function handleFritzL1JabComboState(p, inputs, state, grounded, _dt) {
    if (!grounded) {
      p.attack = { type: "none", phase: "none" };
      return;
    }

    const attackConfig = CharacterCatalog.getAttackConfig("fritz", state) || {};
    const comboConfig = attackConfig.l1_jab_combo || {};
    const descriptor = AttackCatalog.getDescriptor(p, "l1_jab_combo");
    const maxSteps = comboConfig.maxSteps ?? 2;
    const queueWindows = comboConfig.queueWindowFrames || [];
    const dashMultipliers = comboConfig.dashMultipliers || [];
    const stepDamage = comboConfig.stepDamage || [];
    const animSpeed = comboConfig.animSpeed || 1;
    const moveSpeed = p.config.physics.moveSpeed;

    if (!(p.attack.hitTargets instanceof Set)) {
      p.attack.hitTargets = new Set();
    }

    const comboStep = p.attack.comboStep ?? 1;
    const queueFrame = queueWindows[comboStep - 1] ?? 1;
    if (inputs.l1Down && p.frameIndex >= queueFrame) {
      p.attack.inputQueued = true;
    }

    if (p.animFinished) {
      if (comboStep < maxSteps && p.attack.inputQueued) {
        const nextStep = comboStep + 1;
        p.attack.comboStep = nextStep;
        p.attack.inputQueued = false;
        p.attack.hitTargets.clear();

        const animName = `l1_jab_combo_x${nextStep}`;
        setAnim(p, animName, false, state, animSpeed);

        const dashMul = dashMultipliers[nextStep - 1] ?? 0;
        if (dashMul) {
          p.vel.x = p.facing * moveSpeed * dashMul;
        }

        const damage = stepDamage[nextStep - 1] ?? descriptor?.baseDamage;
        p.attack.damage = damage;
      } else {
        p.attack = { type: "none", phase: "none" };
      }
    }
  }

  function handleHPL1RangedGrabState(p, inputs, state, grounded, dt) {
    if (!grounded) {
      p.attack = { type: "none", phase: "none" };
      return;
    }

    const charKey = "hp";
    const attackConfig = CharacterCatalog.getAttackConfig(charKey, state) || {};
    const grabConfig = attackConfig.l1_ranged_grab || {};
    const descriptor = AttackCatalog.getDescriptor(p, "l1_ranged_grab");
    const charData = state.characterConfigs?.[p.charName];
    const grabAnimFrames = charData?.animations?.["l1_ranged_grab"];
    const defaultDetectFrame = grabAnimFrames
      ? Math.max(grabAnimFrames.length - 2, 0)
      : 5;
    const detectFrame =
      grabConfig.detectFrame ??
      descriptor?.movement?.detectFrame ??
      defaultDetectFrame;

    p.vel.x = 0;
    p.vel.y = 0;

    if (p.attack.phase === "cast") {
      const detectFrames = charData?.animations?.["l1_ranged_grab_detect"];
      if (detectFrames && detectFrames.length) {
        const effectOffsetX =
          grabConfig.effectOffsetX ??
          descriptor?.fx?.detect?.offsetX ??
          descriptor?.movement?.effectOffsetX ??
          0;
        const effectOffsetY =
          grabConfig.effectOffsetY ??
          descriptor?.fx?.detect?.offsetY ??
          descriptor?.movement?.effectOffsetY ??
          0;
        const effectScale =
          grabConfig.effectScale ??
          descriptor?.fx?.detect?.scale ??
          descriptor?.movement?.effectScale ??
          0.75;
        const detectFps =
          grabConfig.detectFps ?? state.fps ?? charData?.fps ?? 12;
        const duration = 1 / (state.fps || 60);
        const currentFrame = Math.floor(p.frameIndex || 0);

        if (
          currentFrame >= detectFrame &&
          currentFrame <= detectFrame + 1 &&
          !(p.attack.spawnedDetectFrames instanceof Set)
        ) {
          p.attack.spawnedDetectFrames = new Set();
        }

        if (
          currentFrame >= detectFrame &&
          currentFrame <= detectFrame + 1 &&
          !p.attack.spawnedDetectFrames.has(currentFrame)
        ) {
          const localIndex = Math.min(
            currentFrame - detectFrame,
            detectFrames.length - 1
          );
          const frameData = detectFrames[localIndex];
          const clonedFrame =
            typeof frameData === "object" ? { ...frameData } : frameData;

          const effect = {
            isCharacterEffect: true,
            owner: p,
            charName: p.charName,
            frames: [clonedFrame],
            fps: detectFps,
            frameIndex: 0,
            time: 0,
            pos: { x: p.pos.x, y: p.pos.y },
            facing: p.facing,
            offsetX: Math.abs(effectOffsetX),
            offsetY: effectOffsetY,
            scale: effectScale,
            duration,
          };

          state.effects.push(effect);
          p.attack.spawnedDetectFrames.add(currentFrame);
        }
      }

      if (!p.attack.detectActive && p.frameIndex >= detectFrame) {
        p.attack.detectActive = true;
      }

      if (p.attack.detectActive && !p.attack.hitChecked) {
        const grabRect = Renderer.getL1RangedGrabHitbox(p, state);
        for (const target of state.players) {
          if (target === p || target.eliminated) continue;
          const hurtRect = Renderer.getHurtbox(target);
          if (rectsIntersect(grabRect, hurtRect)) {
            p.attack.grabbedTarget = target;
            p.attack.hitChecked = true;
            target.isGrabbed = true;
            target.grabbedBy = p;
            target.vel = { x: 0, y: 0 };
            // Spawn hit FX if descriptor provides one; avoid calling unknown hardcoded FX ids
            const fxId = descriptor?.fx?.hit?.id;
            if (typeof spawnGlobalEffect === "function" && fxId) {
              spawnGlobalEffect(state, target, fxId);
            }
            break;
          }
        }
      }

      if (p.animFinished) {
        if (p.attack.grabbedTarget && !p.attack.grabbedTarget.eliminated) {
          p.attack.phase = "pull";
          p.attack.pullTimer = 0;
          p.attack.pullDuration =
            descriptor?.movement?.pullDuration ??
            grabConfig.pullDuration ??
            0.6;
          p.attack.pullStartPos = {
            x: p.attack.grabbedTarget.pos.x,
            y: p.attack.grabbedTarget.pos.y,
          };
          const hpWidth = p.hitbox ? p.hitbox.w : 60;
          p.attack.safeDistance =
            descriptor?.movement?.safeDistance ??
            grabConfig.safeDistance ??
            hpWidth * 0.25;
        } else {
          p.attack = { type: "none", phase: "none" };
        }
      }
    } else if (p.attack.phase === "pull") {
      const target = p.attack.grabbedTarget;
      if (!target || target.eliminated) {
        p.attack = { type: "none", phase: "none" };
        return;
      }

      // CRITICAL: Ensure target stays grabbed during pull phase
      if (!target.isGrabbed) {
        target.isGrabbed = true;
        target.grabbedBy = p;
      }

      const duration = p.attack.pullDuration ?? 0.6;
      p.attack.pullTimer = (p.attack.pullTimer || 0) + dt;
      const progress = Math.min(p.attack.pullTimer / duration, 1);
      const smoothT = progress * progress * (3 - 2 * progress);

      const startX = p.attack.pullStartPos?.x ?? target.pos.x;
      const startY = p.attack.pullStartPos?.y ?? target.pos.y;
      const endX = p.pos.x;
      const endY = p.pos.y - (p.attack.safeDistance ?? 32);

      target.pos.x = startX + (endX - startX) * smoothT;
      target.pos.y = startY + (endY - startY) * smoothT;
      target.vel.x = 0;
      target.vel.y = 0;

      if (progress >= 1) {
        target.pos.x = endX;
        target.pos.y = endY;

        const comboConfig = attackConfig.l1_ranged_grab_combo || {};
        const comboDesc = AttackCatalog.getDescriptor(
          p,
          "l1_ranged_grab_combo"
        );
        const initialDamage =
          comboDesc?.movement?.initialDamage ?? comboConfig.initialDamage ?? 8;
        target.percent = Math.min(999, (target.percent || 0) + initialDamage);
        target.stunT = Math.max(target.stunT || 0, 0.2);
        target.isGrabbed = true;
        target.grabbedBy = p;
        spawnGlobalEffect?.(state, target, "fx_hurt");

        p.attack = {
          type: "l1_ranged_grab_combo",
          phase: "active",
          savedTarget: target,
          finalKnockupApplied: false,
          owner: "mod",
        };
        setAnim(
          p,
          "l1_ranged_grab_combo",
          false,
          state,
          comboConfig.animSpeed || 1
        );
      }
    }
  }

  function handleHPL1RangedGrabComboState(p, inputs, state, grounded, _dt) {
    const charKey = "hp";
    const attackConfig = CharacterCatalog.getAttackConfig(charKey, state) || {};
    const comboConfig = attackConfig.l1_ranged_grab_combo || {};
    const descriptor = AttackCatalog.getDescriptor(p, "l1_ranged_grab_combo");
    const finalKnockupFrame =
      comboConfig.finalKnockupFrame ??
      descriptor?.movement?.finalKnockupFrame ??
      6;
    const target = p.attack.savedTarget;

    // CRITICAL: Check if we should apply knockback FIRST, before any position locking
    if (!p.attack.finalKnockupApplied && p.frameIndex >= finalKnockupFrame) {
      p.attack.finalKnockupApplied = true;
      if (target && !target.eliminated) {
        // CRITICAL: Ensure target is still grabbed before applying knockback
        // This prevents the target from escaping with a quick attack
        if (!target.isGrabbed) {
          target.isGrabbed = true;
          target.grabbedBy = p;
        }
        // Apply damage/knockback FIRST while target is still grabbed
        applyDamageWithDescriptor(p, target, descriptor, state);
        // Only release AFTER damage/knockback has been fully applied
        // CRITICAL: Do NOT reset velocities here - they were just set by applyDamageWithDescriptor
        // The knockback needs these velocities to work!
        target.isGrabbed = false;
        target.grabbedBy = null;
      }
    }

    if (target && !target.eliminated) {
      // CRITICAL: Ensure target stays grabbed during combo phase (only if knockback not applied yet)
      if (!target.isGrabbed && !p.attack.finalKnockupApplied) {
        target.isGrabbed = true;
        target.grabbedBy = p;
      }

      const lockTarget =
        (descriptor?.movement?.lockTargetPosition ?? true) &&
        comboConfig.lockTargetPosition !== false;
      // CRITICAL: Lock target position until knockback is applied
      // Only lock if we haven't applied the final knockup yet
      // IMPORTANT: This check prevents overriding velocities set by applyDamageWithDescriptor
      if (lockTarget && target.isGrabbed && !p.attack.finalKnockupApplied) {
        target.pos.x = p.pos.x;
        target.pos.y = p.pos.y;
        target.vel.x = 0;
        target.vel.y = 0;
      }
    }

    if (p.animFinished) {
      if (target && target.isGrabbed) {
        target.isGrabbed = false;
      }
      p.attack = { type: "none", phase: "none" };
    }
  }

  function getChargeStageDamage(chargeT, thresholds = [], damageStages = []) {
    if (!damageStages.length) {
      return null;
    }

    let stageIndex = 0;
    for (let i = 0; i < thresholds.length; i++) {
      if (chargeT >= thresholds[i]) {
        stageIndex = i + 1;
      }
    }

    stageIndex = Math.min(stageIndex, damageStages.length - 1);
    return damageStages[stageIndex];
  }

  function selectDescriptorChargeStage(stages = [], chargeT = 0) {
    if (!Array.isArray(stages) || !stages.length) {
      return null;
    }

    let selected = stages[0];
    for (const stage of stages) {
      if (chargeT >= (stage.threshold ?? 0)) {
        selected = stage;
      } else {
        break;
      }
    }
    return selected;
  }

  function applyChargeFxFromDescriptor(p, descriptor, chargeT) {
    const stages = descriptor?.chargeStages;
    if (!stages || !stages.length) {
      if (chargeT <= 0) {
        p.chargeFx = null;
      }
      return;
    }

    let selected = null;
    for (const stage of stages) {
      if (chargeT >= (stage.threshold ?? 0)) {
        selected = stage;
      } else {
        break;
      }
    }

    const fxId = selected?.fx?.id;
    if (fxId) {
      p.chargeFx = {
        name: fxId,
        time: p.chargeFx?.name === fxId ? p.chargeFx.time : 0,
      };
    } else {
      p.chargeFx = null;
    }
  }

  function handleCyboardL2(p, inputs, state, grounded, dt) {
    // Allow this L2 to proceed while airborne; do not cancel on !grounded

    // Initialization and Start Phase (Jump)
    if (p.attack.phase === "start") {
      if (!p.attack.initialized) {
        p.attack.initialized = true;
        p.attack.startX = p.pos.x;
        p.attack.startY = p.pos.y;

        // Fixed jump parameters (No charging)
        const JUMP_HEIGHT = 360;
        const JUMP_DISTANCE = 700;
        const ANGLE = 45;

        p.attack.jumpHeight = JUMP_HEIGHT;
        p.attack.jumpDistance = JUMP_DISTANCE;
        // Calculate target X
        p.attack.targetX =
          p.pos.x +
          p.facing * Math.cos((ANGLE * Math.PI) / 180) * JUMP_DISTANCE;
        p.attack.targetY = p.pos.y - JUMP_HEIGHT;

        p.attack.phase = "jump";
        p.attack.jumpTime = 0;
        p.attack.jumpDuration = 0.25; // Approx 3 frames @ 12fps

        p.grounded = false;
        p.vel.x = 0;
        setAnim(p, "l2_smash_start", false, state);
      }
      return;
    }

    // Jump Phase (000-002)
    if (p.attack.phase === "jump") {
      p.attack.jumpTime += dt;
      const t = Math.min(1.0, p.attack.jumpTime / p.attack.jumpDuration);
      const sx = p.attack.startX,
        sy = p.attack.startY;
      const tx = p.attack.targetX,
        ty = p.attack.targetY;

      // Lerp position
      const lerp = (a, b, u) => a + (b - a) * u;
      p.pos.x = lerp(sx, tx, t);
      p.pos.y = lerp(sy, ty, t);
      p.vel.x = (tx - sx) / p.attack.jumpDuration; // For visual trails/physics if checked
      p.vel.y = (ty - sy) / p.attack.jumpDuration;

      // Transition to Grab phase when jump finishes
      if (t >= 1.0 || p.animFinished) {
        p.attack.phase = "grab";
        p.attack.grabChecked = false;
        setAnim(p, "l2_smash_grab", false, state);
      }
      return;
    }

    // Grab Phase (003-005)
    if (p.attack.phase === "grab") {
      // Extended hit detection window: check for 3 frames (~0.25s @ 12fps)
      const GRAB_CHECK_FRAMES = 3;
      p.attack.grabCheckFrames = (p.attack.grabCheckFrames || 0) + 1;

      // Perform hit check each frame during the detection window
      if (p.attack.grabCheckFrames <= GRAB_CHECK_FRAMES) {
        const atkRect = Renderer.getL2SmashHitbox(p, state);
        let grabbedTarget = null;
        for (const target of state.players) {
          if (target === p || target.eliminated) continue;
          const hurtRect = Renderer.getHurtbox(target);
          if (rectsIntersect(atkRect, hurtRect)) {
            grabbedTarget = target;
            break;
          }
        }

        if (grabbedTarget) {
          // Hit: Hold enemy mid-air
          p.attack.grabbedTarget = grabbedTarget;
          grabbedTarget.isGrabbed = true;
          grabbedTarget.attack = grabbedTarget.attack || {};
          grabbedTarget.attack.isGrabbed = true;

          p.attack.phase = "grab_hold";
          p.attack.grabHoldTime = 0;
          p.attack.grabHoldDuration = 0.4; // Hold duration

          // Align target
          const offsetX = p.facing * 60;
          grabbedTarget.pos.x = p.pos.x + offsetX;
          grabbedTarget.pos.y = p.pos.y;
          grabbedTarget.vel.x = 0;
          grabbedTarget.vel.y = 0;

          // Loop the grab animation while holding
          setAnim(p, "l2_smash_grab", true, state);
          return;
        }
      }

      // After detection window expires, if no hit found, cancel attack
      if (p.attack.grabCheckFrames > GRAB_CHECK_FRAMES) {
        // Miss: No target found during detection window
        // Cancel attack and transition to normal fall
        p.attack = { type: "none", phase: "none" };

        // Reset vertical velocity to start falling from peak
        p.vel.y = 0;

        // Disable jump until grounded (prevent mobility abuse)
        p.jumpsLeft = 0;

        // Preserve horizontal velocity (p.vel.x) from the jump phase
        // so he continues drifting forward naturally.
        // The physics system will take over from here (gravity -> normal fall anim).
      }
      return;
    }

    // Holding Phase (Mid-air)
    if (p.attack.phase === "grab_hold") {
      p.attack.grabHoldTime += dt;
      p.vel.x = 0;
      p.vel.y = 0;
      const target = p.attack.grabbedTarget;
      if (target) {
        target.vel.x = 0;
        target.vel.y = 0;
        target.pos.x = p.pos.x + p.facing * 60;
        target.pos.y = p.pos.y;
      }

      if (p.attack.grabHoldTime >= p.attack.grabHoldDuration) {
        // Time's up, slam down
        p.attack.phase = "fall";
        p.attack.impactTime = 0;
        p.attack.impactDuration = 0.1;
        p.attack.groundTargetY = p.attack.startY;
        setAnim(p, "l2_smash_fall", false, state);
      }
      return;
    }

    // Fall Phase
    if (p.attack.phase === "fall") {
      // Fast descent to groundTargetY
      const fallSpeed = 2500;
      p.vel.y = fallSpeed;

      // Enable drop-through for semisolids
      p.dropThroughTimer = 0.1;

      // Do NOT manually update p.pos.y += p.vel.y * dt;
      // Let physics engine resolve movement and collisions.

      const target = p.attack.grabbedTarget;
      if (target) {
        // Keep target X synced
        target.pos.x = p.pos.x + p.facing * 60;
        // Move target downwards with same speed (physics will handle Y, but we force velocity)
        target.vel.y = fallSpeed;
        target.dropThroughTimer = 0.1; // Target should also bypass semisolids
      }

      // Check grounded status from physics engine (set in previous frame or after physics update)
      // We use p.grounded && p.vel.y >= 0 to confirm we hit ground while falling
      if (p.grounded) {
        // Reached solid ground
        p.vel.y = 0;
        p.dropThroughTimer = 0;

        if (target) {
          target.vel.y = 0;
          target.dropThroughTimer = 0;
          // Snap target Y to attacker Y on impact
          target.pos.y = p.pos.y;
        }

        p.attack.phase = "impact";
        p.attack.impactProcessed = false;
        const cm = p.attack.chargeMultiplier || 1.0;
        const high = cm >= 2.0;
        setAnim(p, high ? "l2_impact_high" : "l2_impact_low", false, state);
      }
      return;
    }

    // Impact Phase
    if (p.attack.phase === "impact") {
      if (!p.attack.impactProcessed) {
        p.attack.impactProcessed = true;

        // Apply Damage
        const target = p.attack.grabbedTarget;
        const descriptor = AttackCatalog.getDescriptor(p, "cyboard:l2_smash");

        if (target) {
          target.isGrabbed = false;
          if (target.attack) delete target.attack.isGrabbed;

          applyDamageWithDescriptor(p, target, descriptor, state);
          spawnEffect(
            p.pos.x + p.facing * 50,
            p.pos.y,
            "l2_impact",
            p.facing,
            1.5
          );
          p.attack.grabbedTarget = null;
        } else {
          // AOE Splash for miss
          const radius = descriptor.movement.explosionRadius || 100;
          for (const t of state.players) {
            if (t === p || t.eliminated) continue;
            const dx = t.pos.x - p.pos.x;
            const dy = t.pos.y - 100 - (p.pos.y - 50);
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < radius) {
              applyDamageWithDescriptor(p, t, descriptor, state);
            }
          }
          spawnEffect(p.pos.x, p.pos.y, "l2_impact", p.facing, 1.5);
        }
      }

      if (p.animFinished) {
        p.attack = { type: "none", phase: "none" };
      }
    }
  }
  function handleFritzL2(p, inputs, state, grounded, dtOverride) {
    if (!grounded) {
      p.attack = { type: "none", phase: "none" };
      return;
    }

    const descriptor = AttackCatalog.getDescriptor(p, "l2");
    const stages = descriptor?.chargeStages || [];
    const dotCfg = descriptor?.dot || {};
    const moveCfg = descriptor?.movement || {};
    const MAX_CHARGE = descriptor?.maxCharge ?? 2.5;
    const dt = dtOverride ?? state.deltaTime;

    const selectStage = (chargeT = 0) => {
      if (!stages.length) return null;
      let current = stages[0];
      for (const s of stages) {
        if (chargeT >= (s.threshold ?? 0)) current = s;
        else break;
      }
      return current;
    };

    // L2 Attack State Machine (Fritz)
    if (p.attack.phase === "start") {
      // Check if animation is finished or if we should transition based on input
      if (p.animFinished) {
        if (inputs.l2Held) {
          p.attack.phase = "charge";
          setAnim(p, "l2_charge_hold", true, state);
        } else {
          // Tap -> straight to release
          p.attack.phase = "release";
          const stage = selectStage(0);
          p.attack.loopsLeft = stage?.loops ?? 4;
          p.attack.speedMul = stage?.speedMultiplier ?? 1.0;
          p.attack.tickTimer = 0.15; // Start ready to tick
          p.attack.releaseDistance = 0;
          p.attack.releaseMaxDistance =
            (moveCfg.releaseMaxDistance ?? 220) + p.attack.speedMul * 120;
          p.decelerate = false;
          setAnim(p, "l2_release", false, state, 2); // 2x speed
          const relFx = descriptor?.fx?.release?.id;
          if (relFx && typeof spawnGlobalEffect === "function") {
            spawnGlobalEffect(state, p, relFx, { speed: 2 });
          }
        }
      }
    } else if (p.attack.phase === "charge") {
      const chargeT = (p.attack.chargeT = Math.min(
        (p.attack.chargeT || 0) + dt,
        MAX_CHARGE
      ));

      // Define loop boundaries based on charge level
      if (chargeT > (stages[2]?.threshold ?? 2.0)) {
        p.loopEnd = 4; // Loop frames 2-6 (indices 0-4)
      } else if (chargeT > (stages[1]?.threshold ?? 1.2)) {
        p.loopEnd = 3; // Loop frames 2-5 (indices 0-3)
      } else {
        p.loopEnd = 1; // Loop frames 2-3 (indices 0-1)
      }
      p.loopStart = 0; // Always start loop from the first frame of the anim

      // If frameIndex is now outside the loop range (because the loop just shrank), reset it.
      if (p.frameIndex > p.loopEnd) {
        p.frameIndex = p.loopStart;
      }

      // Ensure animation is looping correctly
      if (p.animFinished && p.anim === "l2_charge_hold") {
        p.frameIndex = p.loopStart; // Reset to loop start
      }

      // Set charge FX overlay
      if (chargeT > (stages[2]?.threshold ?? 2.0))
        p.chargeFx = {
          name: "fx_charge_high",
          time: p.chargeFx?.name === "fx_charge_high" ? p.chargeFx.time : 0,
        };
      else if (chargeT > (stages[1]?.threshold ?? 1.2))
        p.chargeFx = {
          name: "fx_charge_mid",
          time: p.chargeFx?.name === "fx_charge_mid" ? p.chargeFx.time : 0,
        };
      else if (chargeT > 0.5)
        p.chargeFx = {
          name: "fx_charge_low",
          time: p.chargeFx?.name === "fx_charge_low" ? p.chargeFx.time : 0,
        };
      else p.chargeFx = null;

      if (inputs.l2Up) {
        p.vel.x = 0; // Stop movement on release
        p.attack.phase = "release";
        const stage = selectStage(p.attack.chargeT || 0);
        p.attack.loopsLeft = stage?.loops ?? 6;
        p.attack.speedMul = stage?.speedMultiplier ?? 1.5;

        p.attack.tickTimer = 0.15; // Start ready to tick
        p.attack.hitTargets = new Set(); // Track targets hit by this attack
        p.attack.releaseDistance = 0;
        p.attack.releaseMaxDistance =
          (moveCfg.releaseMaxDistance ?? 220) + p.attack.speedMul * 120;
        p.decelerate = false;
        setAnim(p, "l2_release", false, state, 2); // 2x speed
        p.chargeFx = null; // Clear charge FX
        const relFx = descriptor?.fx?.release?.id;
        if (relFx && typeof spawnGlobalEffect === "function") {
          spawnGlobalEffect(state, p, relFx, { speed: 2 });
        }
      }
    } else if (p.attack.phase === "release") {
      // -- Movement --
      const pconf = p.config.physics;
      const slowedMultiplier = moveCfg.releaseSlowdown ?? 0.3; // default 70% slower
      const baseSpeed =
        p.facing * pconf.moveSpeed * p.attack.speedMul * slowedMultiplier;
      const maxTravel =
        p.attack.releaseMaxDistance ??
        (moveCfg.releaseMaxDistance ?? 220) + p.attack.speedMul * 120;
      const traveled = p.attack.releaseDistance || 0;
      const slowdownProgress =
        maxTravel > 0 ? Math.min(1, traveled / maxTravel) : 1;
      const decay = Math.max(0, 1 - slowdownProgress);
      const adjustedSpeed = baseSpeed * decay;

      p.vel.x = adjustedSpeed;

      const distanceDelta = Math.abs(adjustedSpeed) * dt;
      const newDistance = Math.min(maxTravel, traveled + distanceDelta);
      p.attack.releaseDistance = newDistance;

      if (decay <= 0.01 || maxTravel <= 0) {
        p.vel.x = 0;
      }

      // -- Damage Over Time --
      p.attack.tickTimer = (p.attack.tickTimer || 0) + dt;
      const DAMAGE_TICK_INTERVAL = dotCfg.interval ?? 0.15;
      if (p.attack.tickTimer >= DAMAGE_TICK_INTERVAL) {
        p.attack.tickTimer -= DAMAGE_TICK_INTERVAL;
        const leftAtkRect = Renderer.getL2HitboxLeft(p, state);
        const rightAtkRect = Renderer.getL2HitboxRight(p, state);
        for (const target of state.players) {
          if (target !== p && !target.eliminated) {
            const hurtRect = Renderer.getHurtbox(target);
            if (
              rectsIntersect(hurtRect, leftAtkRect) ||
              rectsIntersect(hurtRect, rightAtkRect)
            ) {
              // MAX CHARGE STUN LOGIC
              if (p.attack.chargeT >= MAX_CHARGE) {
                target.stunT =
                  dotCfg.maxChargeStun ?? DAMAGE_TICK_INTERVAL + 0.01; // Keep stunned until next tick
                if (!p.attack.hitTargets.has(target)) {
                  p.attack.hitTargets.add(target);

                  // Spawn the effect at 24fps (native is 12fps, so speed is 2x)
                  spawnEffect(state, target, "fx_charged_hit", {
                    speed: 2,
                  });
                }
              } else {
                const l2desc = AttackCatalog.getDescriptor(p, "l2");
                applyDamageWithDescriptor(p, target, l2desc, state);
              }
            }
          }
        }
      }

      // -- Animation Loop Handling --
      if (p.animFinished) {
        p.attack.loopsLeft--;
        if (p.attack.loopsLeft > 0) {
          setAnim(p, "l2_release", false, state, 2); // Restart animation at 2x speed
        } else {
          // Final hit for max charge
          if (p.attack.chargeT >= MAX_CHARGE) {
            for (const target of p.attack.hitTargets) {
              if (!target.eliminated) {
                const finalCfg = stages[stages.length - 1]?.finalHit || {};
                const stunDuration = finalCfg.stun ?? 1.2; // fixed stun
                // Add final damage chunk before calculating knockback
                const finalDamage = finalCfg.damage ?? 15;
                target.percent = Math.min(
                  999,
                  (target.percent || 0) + finalDamage
                );

                // Spawn blood splatter effect
                if (ParticleManager && ParticleManager.emitBloodSplatter) {
                  const bloodDir = {
                    x: p?.facing ?? 1,
                    y: descriptor.knockbackAngle
                      ? -Math.sin(
                          ((descriptor.knockbackAngle || 65) * Math.PI) / 180
                        )
                      : -0.2,
                  };
                  ParticleManager.emitBloodSplatter(
                    target.pos.x,
                    target.pos.y,
                    finalDamage,
                    state,
                    { dir: bloodDir }
                  );
                }

                // Scaled & Randomized Knockback
                const baseKnockback = finalCfg.knockback?.base ?? 400;
                const P = target.percent || 0;
                const exponent = finalCfg.knockback?.exponent ?? 0.8;
                const knockbackForce =
                  baseKnockback * Math.pow(1 + P / 100, exponent) * 1.25; // Apply global knockback boost (+25%)

                // Angle range
                const angRange = finalCfg.knockback?.angleRange || [75, 105];
                const randomAngleDeg =
                  angRange[0] + Math.random() * (angRange[1] - angRange[0]);
                const theta = randomAngleDeg * (Math.PI / 180);

                target.vel.x = Math.cos(theta) * knockbackForce;
                target.vel.y = -Math.sin(theta) * knockbackForce;
                target.grounded = false;
                target.stunT = stunDuration;
              }
            }
          }
          p.attack = { type: "none", phase: "none" };
        }
      }
    }
  }
  function handleHPL2(p, inputs, state, grounded, dt) {
    const charKey = "hp";
    const attackConfig = CharacterCatalog.getAttackConfig(charKey, state) || {};
    const l2Config = attackConfig.l2_ranged || {};
    const descriptor = AttackCatalog.getDescriptor(p, "l2_ranged");
    const chargeStages = descriptor?.chargeStages || [];
    const stageThreshold = chargeStages.length
      ? chargeStages[chargeStages.length - 1]?.threshold
      : undefined;
    const maxCharge = l2Config.maxCharge ?? stageThreshold ?? 2.0;
    const projectileFrame = l2Config.projectileFrame ?? 1;

    // HP stays rooted during the throw
    p.vel.x = 0;

    // DEBUG: HP L2 Movement Debug (only in dev mode)
    if (state?.debug?.devMode && state?.debug?.movementLogging) {
      console.log(`🎯 HP L2 Movement Debug:`, {
        charKey: p.charName.toLowerCase(),
        phase: p.attack.phase,
        chargeT: p.attack.chargeT || 0,
        maxCharge,
        velX: p.vel.x,
        note: "HP L2 is rooted during throw - no movement",
      });
    }

    if (p.attack.phase === "start") {
      if (p.animFinished) {
        if (inputs.l2Held) {
          p.attack.phase = "charge";
          p.attack.chargeT = 0;
          setAnim(p, "l2_ranged_hold", true, state, l2Config.animSpeed || 1);
        } else {
          p.attack.phase = "release";
          p.attack.projectileSpawned = false;
          setAnim(
            p,
            "l2_ranged_release",
            false,
            state,
            l2Config.animSpeed || 1
          );
          const relFx = descriptor?.fx?.release?.id;
          if (relFx && typeof spawnGlobalEffect === "function") {
            spawnGlobalEffect(state, p, relFx, {
              speed: l2Config.animSpeed || 1,
            });
          }
        }
      }
      return;
    }

    if (p.attack.phase === "charge") {
      const chargeT = (p.attack.chargeT = Math.min(
        (p.attack.chargeT || 0) + dt,
        maxCharge
      ));

      applyChargeFxFromDescriptor(p, descriptor, chargeT);

      if (!inputs.l2Held || inputs.l2Up) {
        p.attack.phase = "release";
        p.attack.projectileSpawned = false;
        setAnim(p, "l2_ranged_release", false, state, l2Config.animSpeed || 1);
        p.chargeFx = null;
        const relFx = descriptor?.fx?.release?.id;
        if (relFx && typeof spawnGlobalEffect === "function") {
          spawnGlobalEffect(state, p, relFx, {
            speed: l2Config.animSpeed || 1,
          });
        }
      }
      return;
    }

    if (p.attack.phase === "release") {
      if (!p.attack.projectileSpawned && p.frameIndex >= projectileFrame) {
        const proj = descriptor?.projectile;
        const shouldSpawn = proj?.spawnOnRelease === true;
        const type = proj?.type || "l2_projectile";
        if (shouldSpawn && typeof spawnProjectile === "function") {
          spawnProjectile(state, p, type);
        }
        p.attack.projectileSpawned = true;
      }

      if (p.animFinished) {
        p.attack = { type: "none", phase: "none" };
        p.chargeFx = null;
      }
    }
  }
  function handleDefaultL2(p, inputs, state, grounded, dt) {
    /* Implementation */
  }

  function handleHPUltimate(p, inputs, state, dtArg) {
    if (!p.attack || p.attack.type !== "r2_l2_ulti") return;

    // Start -> Active transition
    if (p.attack.phase === "start") {
      if (p.animFinished) {
        p.attack.phase = "active";
        p.attack.elapsed = 0;
        setAnim(p, "r2_l2_ulti", true, state, 1);
        p.ultiPhase = "active";
      }
      return;
    }

    // Active phase: run for duration, apply contact damage with per-target cooldown
    if (p.attack.phase === "active") {
      const dt = typeof dtArg === "number" ? dtArg : state.deltaTime || 0;
      p.attack.elapsed = (p.attack.elapsed || 0) + dt;

      const descriptor = AttackCatalog.getDescriptor(p, "r2_l2_ulti");
      const myRect = Renderer.getHurtbox(p);
      for (let j = 0; j < state.players.length; j++) {
        const target = state.players[j];
        if (!target || target === p || target.eliminated) continue;
        const key = target.padIndex ?? j;
        p.attack.hitCooldownMap = p.attack.hitCooldownMap || new Map();
        const lastHitT = p.attack.hitCooldownMap.get(key) || -999;
        const nowT = performance.now() * 0.001;
        if (nowT - lastHitT < 0.6) continue; // 600ms cooldown per target

        const hurtRect = Renderer.getHurtbox(target);
        if (rectsIntersect(myRect, hurtRect)) {
          applyDamageWithDescriptor(p, target, descriptor, state);
          p.attack.hitCooldownMap.set(key, nowT);
          if (descriptor?.fx?.hit?.id) {
            const fxId = descriptor.fx.hit.id;
            // Character-specific impact effects (l2_impact, l1_impact) use spawnEffect
            if (fxId === "l2_impact" || fxId === "l1_impact") {
              // Use attacker as context for character-specific effects
              spawnEffect(state, p, fxId);
            } else {
              // Global FX effects use spawnGlobalEffect
              spawnGlobalEffect(state, target, fxId);
            }
          }
        }
      }

      const duration =
        typeof p.attack.duration === "number" ? p.attack.duration : 10.0;
      if (p.attack.elapsed >= duration) {
        p.attack.phase = "end";
        p.invincible = false;
        setAnim(p, "idle", true, state, 1);
        p.ultiPhase = "end";
      }
      return;
    }

    // End cleanup
    if (p.attack.phase === "end") {
      p.attack = { type: "none", phase: "none" };
      p.invincible = false;
      p.ultiPhase = null;
      return;
    }
  }

  function findErnstUltimateTarget(p, state) {
    if (!Renderer || typeof Renderer.getHurtbox !== "function") return null;
    const myHb = Renderer.getHurtbox(p);
    if (!myHb) return null;

    const dir = p.facing >= 0 ? 1 : -1;
    let best = null;
    let bestDist = Infinity;

    for (const candidate of state.players) {
      if (!candidate || candidate === p || candidate.eliminated) continue;

      const hb = Renderer.getHurtbox(candidate);
      if (!hb) continue;

      const ahead =
        dir > 0
          ? hb.left >= myHb.left + myHb.w - 4
          : hb.left + hb.w <= myHb.left + 4;
      if (!ahead) continue;

      const verticalOverlap =
        Math.min(myHb.top + myHb.h, hb.top + hb.h) - Math.max(myHb.top, hb.top);
      if (verticalOverlap <= 0) continue;

      const distance = Math.max(
        0,
        dir > 0 ? hb.left - (myHb.left + myHb.w) : myHb.left - (hb.left + hb.w)
      );

      if (distance < bestDist) {
        best = candidate;
        bestDist = distance;
      }
    }

    return best;
  }

  function releaseErnstUltimateLocks(p, state) {
    const ultiSourceKey = p.charName?.toLowerCase?.() || "ernst";
    for (const target of state.players) {
      if (
        !target ||
        target === p ||
        !target.ultiHurtLock ||
        (target.ultiHurtLockSource &&
          target.ultiHurtLockSource !== ultiSourceKey)
      ) {
        continue;
      }

      target.ultiHurtLock = false;
      target.ultiHurtLockSource = null;
      target.animFinished = true;
      target.loop = false;
      target.frameTime = 0;
      if (Array.isArray(target.frames) && target.frames.length > 0) {
        const maxIndex = target.frames.length - 1;
        target.frameIndex = Math.min(target.frameIndex || 0, maxIndex);
      } else {
        target.frameIndex = 0;
      }

      const targetAttackType = target.attack?.type;
      const rollActive = !!target.roll?.active;
      const stunned = (target.stunT || 0) > 0;

      if (!targetAttackType || targetAttackType === "none") {
        if (!rollActive && !stunned) {
          const grounded = !!target.grounded;
          const vel = target.vel || { x: 0, y: 0 };
          const absVx = Math.abs(vel.x || 0);

          if (!grounded) {
            const nextAnim = vel.y < 0 ? "jump_up" : "airborne";
            const loopAnim = nextAnim !== "jump_up";
            setAnim(target, nextAnim, loopAnim, state, 1);
          } else if (absVx > 30) {
            setAnim(target, "run", true, state, 1);
          } else {
            setAnim(target, "idle", true, state, 1);
          }
        }
      }
    }
  }

  function removeErnstUltimateProjectiles(state, owner) {
    if (!state?.projectiles?.length) return;
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
      const proj = state.projectiles[i];
      if (proj?.type === "ernst_ulti_projectile" && proj.owner === owner) {
        state.projectiles.splice(i, 1);
      }
    }
  }

  function handleErnstUltimate(p, inputs, state, dtArg) {
    if (!p.attack || p.attack.type !== "r2_l2_ulti") return;

    // Start -> Active transition (same as HP)
    if (p.attack.phase === "start") {
      if (p.animFinished) {
        const target = findErnstUltimateTarget(p, state);
        if (!target) {
          console.log(
            "[ErnstUlt] No target detected in firing line – cancelling ultimate.",
            {
              player: p.padIndex,
              pos: { ...p.pos },
            }
          );
          p.attack.phase = "end";
          p.invincible = false;
          releaseErnstUltimateLocks(p, state);
          p.ultiPhase = "end";
          setAnim(p, "idle", true, state, 1);
          return;
        }

        console.log("[ErnstUlt] Target locked.", {
          player: p.padIndex,
          target: target.padIndex,
          attackerPos: { ...p.pos },
          targetPos: { ...target.pos },
        });

        p.attack.target = target;
        p.attack.targetIndex = state.players.indexOf(target);
        p.attack.lockedPos = { x: p.pos.x, y: p.pos.y };
        p.attack.lockedFacing = typeof p.facing === "number" ? p.facing : 1;
        p.attack.duration = 2.0;
        p.attack.phase = "active";
        p.attack.elapsed = 0;
        p.attack.lastProjectileSpawnTime = 0;
        p.attack.projectileSpawnCount = 0;
        setAnim(p, "r2_l2_ulti", true, state, 1);
        p.ultiPhase = "active";
        p.invincible = true;

        const ultiSourceKey = p.charName?.toLowerCase?.() || "ernst";
        target.vel.x = 0;
        target.vel.y = 0;
        if (!target.ultiHurtLock) {
          target.ultiHurtLock = true;
        }
        if (!target.ultiHurtLockSource) {
          target.ultiHurtLockSource = ultiSourceKey;
        }
      }
      return;
    }

    // Active phase: Spawn projectiles 2x per ulti_loop cycle
    if (p.attack.phase === "active") {
      const dt = typeof dtArg === "number" ? dtArg : state.deltaTime || 0;
      p.attack.elapsed = (p.attack.elapsed || 0) + dt;

      const duration =
        typeof p.attack.duration === "number" ? p.attack.duration : 2.0;
      if (p.attack.elapsed >= duration) {
        console.log("[ErnstUlt] Duration elapsed – cleaning up.", {
          player: p.padIndex,
          duration,
          spawned: p.attack.projectileSpawnCount || 0,
        });
        p.attack.phase = "end";
        p.invincible = false;
        releaseErnstUltimateLocks(p, state);
        removeErnstUltimateProjectiles(state, p);
        setAnim(p, "idle", true, state, 1);
        p.ultiPhase = "end";
        return;
      }

      const target = p.attack.target;
      if (!target || target.eliminated) {
        console.warn(
          "[ErnstUlt] Target missing/eliminated during active phase – ending.",
          {
            player: p.padIndex,
            targetPad: p.attack.target?.padIndex,
          }
        );
        p.attack.phase = "end";
        p.invincible = false;
        releaseErnstUltimateLocks(p, state);
        removeErnstUltimateProjectiles(state, p);
        setAnim(p, "idle", true, state, 1);
        p.ultiPhase = "end";
        return;
      }

      if (p.attack.lockedPos) {
        p.pos.x = p.attack.lockedPos.x;
        p.pos.y = p.attack.lockedPos.y;
      } else {
        p.attack.lockedPos = { x: p.pos.x, y: p.pos.y };
      }

      if (typeof p.attack.lockedFacing === "number") {
        p.facing = p.attack.lockedFacing;
      }

      p.vel.x = 0;
      p.vel.y = 0;

      const ultiSourceKey = p.charName?.toLowerCase?.() || "ernst";
      target.vel.x = 0;
      target.vel.y = 0;
      if (!target.ultiHurtLock) {
        target.ultiHurtLock = true;
      }
      if (!target.ultiHurtLockSource) {
        target.ultiHurtLockSource = ultiSourceKey;
      }

      // Get ulti_loop animation duration to sync projectile spawns
      const charData = state.characterConfigs?.[p.charName];
      const ultiLoopFrames = charData?.animations?.r2_l2_ulti || [];
      const fps = charData?.fps || 12;
      const loopDuration =
        ultiLoopFrames.length > 0 ? ultiLoopFrames.length / fps : 0.3; // Duration of one loop cycle

      // Spawn 2 projectiles per loop cycle
      const currentTime = performance.now() * 0.001;
      const timeSinceLastSpawn =
        currentTime - (p.attack.lastProjectileSpawnTime || 0);
      const spawnInterval = Math.max(0.05, loopDuration / 2); // Spawn every half loop

      if (timeSinceLastSpawn >= spawnInterval) {
        // Spawn projectile
        if (typeof spawnProjectile === "function") {
          console.log("[ErnstUlt] Spawning projectile.", {
            player: p.padIndex,
            targetPad: target.padIndex,
            elapsed: p.attack.elapsed,
            spawnInterval,
          });
          spawnProjectile(state, p, "ernst_ulti_projectile", target);
          p.attack.lastProjectileSpawnTime = currentTime;
          p.attack.projectileSpawnCount =
            (p.attack.projectileSpawnCount || 0) + 1;
        }
      }

      return;
    }

    // End cleanup
    if (p.attack.phase === "end") {
      p.attack = { type: "none", phase: "none" };
      p.invincible = false;
      p.ultiPhase = null;
      return;
    }
  }
  function handleFritzUltimate(p, inputs, state, dtArg) {
    if (!p.attack || p.attack.type !== "r2_l2_ulti") return;

    // Helper: find nearest valid opponent
    function findNearestOpponent() {
      let best = null;
      let bestDist = Infinity;
      for (let j = 0; j < state.players.length; j++) {
        const t = state.players[j];
        if (!t || t === p || t.eliminated) continue;
        const dx = t.pos.x - p.pos.x;
        const dy = t.pos.y - p.pos.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestDist) {
          bestDist = d2;
          best = t;
        }
      }
      return best;
    }

    if (p.attack.phase === "start") {
      if (p.animFinished) {
        // Spawn disco-ball projectile to scan for target
        const proj = {
          x: p.pos.x + p.facing * 256,
          y: p.pos.y - 100,
          vel: { x: p.facing * 2000, y: 0 },
          owner: p,
          type: "ulti_check",
          maxRange: 800,
          traveledDistance: 0,
          hitTarget: null,
          reachedMaxRange: false,
          visible: true,
          size: 140,
          anim: "ulti_check",
          frameIndex: 0,
          frameTime: 0,
          isDiscoBall: true,
          targetDetected: false,
          targetPosition: null,
          hoverHeight: 150,
          pos: { x: p.pos.x + p.facing * 256, y: p.pos.y - 100 },
        };
        state.projectiles.push(proj);
        p.ultiCheckProjectile = proj;
        p.attack.phase = "check";
        p.ultiPhase = "check";
      }
      return;
    }

    if (p.attack.phase === "check") {
      const proj = p.ultiCheckProjectile;
      if (!proj) {
        p.attack.phase = "end";
        p.ultiPhase = "end";
        return;
      }
      if (proj.hitTarget) {
        p.attack.target = proj.hitTarget;
        p.attack.target.stunT = Math.max(p.attack.target.stunT || 0, 2.0);
        setAnim(p, "r2_l2_ulti", false, state, 1);
        p.attack.phase = "dash";
        p.ultiPhase = "dash";
        // Remove projectile now that it has served its purpose
        const projIndex = state.projectiles.indexOf(proj);
        if (projIndex !== -1) {
          state.projectiles.splice(projIndex, 1);
        }
        p.ultiCheckProjectile = null;
        return;
      }
      if (proj.reachedMaxRange) {
        p.attack.phase = "end";
        p.ultiPhase = "end";
        return;
      }
      return;
    }

    if (p.attack.phase === "dash") {
      const target = p.attack.target;
      if (!target || target.eliminated) {
        p.attack = { type: "none", phase: "none" };
        p.invincible = false;
        p.ultiPhase = null;
        return;
      }
      const dx = target.pos.x - p.pos.x;
      const dy = target.pos.y - p.pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 80) {
        const dashSpeed = 1200;
        p.vel.x = (dx / dist) * dashSpeed;
        p.vel.y = (dy / dist) * dashSpeed;
      } else {
        p.vel.x = 0;
        p.vel.y = 0;
        setAnim(p, "r2_l2_ulti", false, state, 1);
        p.attack.phase = "finisher";
        p.ultiPhase = "finisher";
      }
      return;
    }

    if (p.attack.phase === "finisher") {
      const target = p.attack.target;
      if (!target || target.eliminated) {
        p.attack = { type: "none", phase: "none" };
        p.invincible = false;
        p.ultiPhase = null;
        return;
      }
      p.attack.finisherT =
        (p.attack.finisherT || 0) +
        (typeof dtArg === "number" ? dtArg : state.deltaTime || 0);
      if (p.animFinished || p.attack.finisherT >= 0.15) {
        const descriptor = AttackCatalog.getDescriptor(p, "r2_l2_ulti");
        applyDamageWithDescriptor(p, target, descriptor, state);
        p.attack.phase = "end";
        p.ultiPhase = "end";
        p.ultiCheckProjectile = null;
        setAnim(p, "idle", true, state, 1);
      }
      return;
    }

    if (p.attack.phase === "end") {
      p.attack = { type: "none", phase: "none" };
      p.invincible = false;
      p.ultiPhase = null;
      p.ultiCheckProjectile = null;
      return;
    }
  }
  function handleCyboardUltimate(p, inputs, state, dtArg) {
    if (!p.attack || p.attack.type !== "r2_l2_ulti") return;

    // Helper: find nearest valid opponent
    function findNearestOpponent() {
      let best = null;
      let bestDist = Infinity;
      for (let j = 0; j < state.players.length; j++) {
        const t = state.players[j];
        if (!t || t === p || t.eliminated) continue;
        const dx = t.pos.x - p.pos.x;
        const dy = t.pos.y - p.pos.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestDist) {
          bestDist = d2;
          best = t;
        }
      }
      return best;
    }

    if (p.attack.phase === "start") {
      if (p.animFinished) {
        const target = findNearestOpponent();
        if (!target) {
          p.attack = { type: "none", phase: "none" };
          p.invincible = false;
          return;
        }
        p.attack.target = target;
        // Teleport to the target and play finish animation
        p.pos.x = target.pos.x;
        p.pos.y = target.pos.y;
        p.facing = (target.facing || 1) * -1;
        setAnim(p, "r2_l2_ulti_finish", false, state, 1);
        p.attack.phase = "finish";
      }
      return;
    }

    if (p.attack.phase === "finish") {
      const target = p.attack.target;
      if (!target || target.eliminated) {
        p.attack = { type: "none", phase: "none" };
        p.invincible = false;
        return;
      }
      if (p.animFinished) {
        const descriptor = AttackCatalog.getDescriptor(p, "r2_l2_ulti");
        applyDamageWithDescriptor(p, target, descriptor, state);
        p.attack.phase = "end";
      }
      return;
    }

    if (p.attack.phase === "end") {
      p.attack = { type: "none", phase: "none" };
      p.invincible = false;
      p.ultiPhase = null;
      setAnim(p, "idle", true, state, 1);
      return;
    }
  }

  function handleCyboardPhaseTransitions(p, state, inputs) {
    /* Implementation */
  }
  function handleFritzPhaseTransitions(p, state, inputs) {
    /* Implementation */
  }
  function handleHPPhaseTransitions(p, state, inputs) {
    /* Implementation */
  }

  /**
   * Apply hit detection logic (from old physics.js detectHits)
   */
  function applyHitDetection(
    p,
    i,
    state,
    atkRect,
    damage,
    stun,
    knockback,
    knockbackExponent,
    descriptor
  ) {
    if (!atkRect) return;

    const hitTracker =
      p.attack?.hitTargets instanceof Set ? p.attack.hitTargets : null;
    const charKey = p.charName?.toLowerCase?.();
    const deferHitTracking =
      !!hitTracker &&
      charKey === "cyboard" &&
      p.attack?.type === "r2" &&
      p.attack?.wasMaxCharge &&
      !p.attack?.slowMotionActive;

    for (let j = 0; j < state.players.length; j++) {
      if (i === j) continue;
      const target = state.players[j];
      if (target.eliminated) continue;

      if (hitTracker && hitTracker.has(target)) continue;

      const hurtRect = Renderer.getHurtbox(target);
      if (!rectsIntersect(atkRect, hurtRect)) continue;

      const rhythmBonus = checkRhythmBonus(performance.now(), p.attack.type, p);
      let finalDamage = damage;
      let finalKnockback = knockback;

      if (rhythmBonus) {
        finalDamage *= rhythmBonus.damageMultiplier;
        finalKnockback *= rhythmBonus.knockbackMultiplier;
        p.beatmatchMode = true;
        if (rhythmBonus.showFx) {
          spawnRhythmEffect(state, p);
        }
      } else {
        p.beatmatchMode = false;
      }

      const finalDescriptor = {
        ...descriptor,
        baseDamage: finalDamage,
        baseKnockback: finalKnockback,
        stunDuration: stun,
        knockbackExponent:
          typeof knockbackExponent === "number"
            ? knockbackExponent
            : descriptor.knockbackExponent,
      };

      state.pendingHits.push({
        attacker: p,
        target,
        attackType: p.attack.type,
        damage: finalDamage,
        stun,
        knockback: finalKnockback,
        descriptorOverride: finalDescriptor,
      });

      if (hitTracker && !deferHitTracking) {
        hitTracker.add(target);
      }
    }
  }

  function detectCyboardHits(
    p,
    i,
    state,
    atkRect,
    damage,
    stun,
    knockback,
    knockbackExponent,
    descriptor
  ) {
    const phases = descriptor?.detectInPhase;
    if (
      Array.isArray(phases) &&
      p.attack?.phase &&
      !phases.includes(p.attack.phase)
    ) {
      return;
    }
    if (p.attack?.type === "r2_combo" && p.attack.phase === "start") {
      // Only detect hits in frame 001 (where knock-up happens)
      if (p.frameIndex !== 1) {
        return;
      }

      const comboRect = Renderer.getR2ComboHitbox(p, state);
      if (!comboRect) {
        return;
      }

      if (!(p.attack.hitTargets instanceof Set)) {
        p.attack.hitTargets = new Set();
      }

      // CRITICAL: Calculate double knockback and 70° angle for combo
      const r2Descriptor = AttackCatalog.getDescriptor(p, "r2");
      const dashKnockback =
        p.attack?.previousDashKnockback ?? r2Descriptor?.baseKnockback ?? 150;
      const finalKnockback = dashKnockback * 2; // Double the dash knockback
      const baseMaxKnockback =
        descriptor?.maxKnockback ?? r2Descriptor?.maxKnockback ?? 300;

      // Create modified descriptor with correct knockback and angle
      const comboDescriptor = {
        ...descriptor,
        baseKnockback: finalKnockback,
        knockbackAngle: 70, // 70 degrees exit angle
        maxKnockback: Math.max(baseMaxKnockback, finalKnockback * 2),
      };

      for (const target of state.players) {
        if (target === p || target.eliminated) continue;
        if (p.attack.hitTargets.has(target)) continue;

        // EDGE CASE: Prefer comboTarget if available (from slow-motion), but allow any target
        const isComboTarget = p.attack.comboTarget === target;
        if (
          !isComboTarget &&
          p.attack.comboTarget &&
          !p.attack.comboTarget.eliminated
        ) {
          // If we have a comboTarget but current target is different, skip
          continue;
        }

        const hurtRect = Renderer.getHurtbox(target);
        if (!rectsIntersect(comboRect, hurtRect)) continue;

        // CRITICAL: Release target from any freeze state BEFORE applying knockback
        if (target.attack?.frozenVel) {
          delete target.attack.frozenVel;
        }
        if (target.attack?.isFrozen) {
          delete target.attack.isFrozen;
        }

        // Clear any grab state immediately
        target.isGrabbed = false;
        target.stunT = 0; // Clear stun so knockback can apply

        // Apply damage and knockback with modified descriptor (double knockback, 70° angle)
        applyDamageWithDescriptor(p, target, comboDescriptor, state);
        p.attack.hitTargets.add(target);
        p.attack.hitConfirmed = true;

        console.log("🎯 R2 Combo Hit:", {
          knockback: finalKnockback,
          angle: 70,
          target: target.charName,
        });
      }

      return;
    }

    let localRect = atkRect;
    let localDamage = damage ?? descriptor.baseDamage ?? 4;
    let localStun = stun ?? descriptor.stunDuration ?? 0.15;
    let localKnockback = knockback ?? descriptor.baseKnockback ?? 125;
    let localExponent =
      knockbackExponent ?? descriptor.knockbackExponent ?? 1.2;

    // R1 Dash Attack - only active frames 0-6, frames 7-9 are recovery
    if (
      p.attack?.type === "r1_dash_attack" &&
      p.frameIndex > 0 &&
      p.frameIndex <= 6
    ) {
      localRect = Renderer.getR1DashHitbox(p);
      localDamage = descriptor.baseDamage ?? localDamage;
      localStun = descriptor.stunDuration ?? localStun;
      localKnockback = descriptor.baseKnockback ?? localKnockback;
    }
    // R1 Jump Attack
    else if (p.attack?.type === "r1_jump" && p.attack.phase === "active") {
      localRect = Renderer.getR1JumpHitbox(p);
      localDamage = descriptor.baseDamage ?? localDamage;
      localStun = descriptor.stunDuration ?? localStun;
      localKnockback = descriptor.baseKnockback ?? localKnockback;
    }
    // R1 Basic Attack (release controlled via descriptor metadata)
    else if (p.attack?.type === "r1" && p.attack.phase === "release") {
      const releaseData = p.attack.releaseData || descriptor.release || {};
      const activeFrames = releaseData.activeFrames || [2, 7];
      const startFrame = Array.isArray(activeFrames) ? activeFrames[0] ?? 0 : 0;
      const endFrame =
        Array.isArray(activeFrames) && activeFrames.length > 1
          ? activeFrames[activeFrames.length - 1]
          : startFrame;

      if (p.frameIndex < startFrame || p.frameIndex > endFrame) {
        return;
      }

      const hitRect = Renderer.getR1Hitbox(p, state);
      if (!hitRect) {
        return;
      }

      const knockbackFrame = releaseData.knockbackFrame ?? endFrame;
      const preHitFrame = releaseData.preHitFrame ?? startFrame;
      const maxCharge = releaseData.maxCharge ?? descriptor.maxCharge ?? 2.0;
      const finalChargeT = p.attack.finalChargeT ?? p.attack.chargeT ?? 0;
      const chargeRatio =
        maxCharge > 0 ? Math.min(finalChargeT / maxCharge, 1.0) : 0;
      const baseReleaseDescriptor =
        releaseData.descriptor &&
        releaseData.descriptor.baseDamage !== undefined
          ? releaseData.descriptor
          : descriptor;
      const shouldDelayKnockback =
        releaseData.maxChargeKnockbackDelay !== false && chargeRatio >= 0.999;

      if (!(p.attack.processedTargets instanceof Set)) {
        p.attack.processedTargets = new Set();
      }
      if (!(p.attack.preHitTargets instanceof Set)) {
        p.attack.preHitTargets = new Set();
      }
      if (
        shouldDelayKnockback &&
        !(p.attack.deferredKnockbackTargets instanceof Map)
      ) {
        p.attack.deferredKnockbackTargets = new Map();
      }

      for (const target of state.players) {
        if (target === p || target.eliminated) continue;
        if (p.attack.processedTargets.has(target)) continue;

        const hurtRect = Renderer.getHurtbox(target);
        if (!rectsIntersect(hitRect, hurtRect)) continue;

        const preHitDescriptor = releaseData.preHitDescriptor || {
          ...baseReleaseDescriptor,
          baseKnockback: 0,
          knockbackType: "none",
        };
        const knockDescriptor =
          releaseData.knockbackDescriptor || baseReleaseDescriptor;

        if (
          p.frameIndex >= preHitFrame &&
          !p.attack.preHitTargets.has(target)
        ) {
          applyDamageWithDescriptor(p, target, preHitDescriptor, state);
          p.attack.preHitTargets.add(target);
          p.attack.hitConfirmed = true;
        }

        if (p.frameIndex < knockbackFrame) {
          continue;
        }

        if (shouldDelayKnockback) {
          p.attack.deferredKnockbackTargets.set(target, knockDescriptor);
          p.attack.processedTargets.add(target);
          continue;
        }

        applyDamageWithDescriptor(p, target, knockDescriptor, state);
        p.attack.processedTargets.add(target);
        p.attack.hitConfirmed = true;
      }

      return;
    }
    // R2 Attack
    else if (p.attack?.type === "r2" && p.attack.phase === "release") {
      localRect = Renderer.getR2Hitbox(p, state);
      localDamage = p.attack.damage ?? descriptor.baseDamage ?? localDamage;
      localStun = descriptor.stunDuration ?? localStun;
      localKnockback =
        p.attack.knockback ?? descriptor.baseKnockback ?? localKnockback;
      localExponent = descriptor.knockbackExponent ?? localExponent ?? 0.675;
    }
    // L1 Jab
    else if (
      p.attack?.type === "l1_jab" &&
      p.attack.phase === "start" &&
      p.frameIndex > 2
    ) {
      localRect = Renderer.getL1JabHitbox(p);
      localDamage = 3;
      localStun = 0.1;
      localKnockback = 75;
    }
    // L1 Smash
    else if (
      p.attack?.type === "l1_smash" &&
      p.attack.phase === "release" &&
      p.frameIndex > 0
    ) {
      localRect = Renderer.getL1SmashHitbox(p);
      const smashDesc =
        AttackCatalog.getDescriptor(p, "l1_smash") || descriptor;
      const chargeT = p.attack.chargeT || 0;
      const maxCharge = smashDesc.maxCharge ?? 2.0;
      const chargeRatio = Math.min(chargeT / maxCharge, 1.0);
      const baseDamage = smashDesc.baseDamage ?? 5;
      const baseStun = smashDesc.stunDuration ?? 0.2;
      const baseKnock = smashDesc.baseKnockback ?? 200;
      const knockExpo = smashDesc.knockbackExponent ?? 1.2;
      // Simple linear scaling by ratio (keeps current feel);
      localDamage = baseDamage;
      localStun =
        baseStun + (smashDesc.combo?.stunBonus || 0) * chargeRatio ||
        baseStun + 0.3 * chargeRatio;
      localKnockback =
        baseKnock + (smashDesc.combo?.knockBonus || 250) * chargeRatio;
      localExponent = knockExpo;
    }
    // L2 Smash (Cyboard specific)
    else if (
      p.attack?.type === "l2" &&
      p.attack.phase === "impact" &&
      ((p.anim === "l2_impact_low" && p.frameIndex >= 2 && p.frameIndex <= 6) ||
        (p.anim === "l2_impact_high" && p.frameIndex >= 3 && p.frameIndex <= 8))
    ) {
      localRect = Renderer.getL2SmashHitbox(p, state);

      const chargeMultiplier = p.attack.chargeMultiplier || 1.0;
      const hitboxMultiplier = 1.2 * chargeMultiplier * 0.85; // shrink ~15%
      localRect.w *= hitboxMultiplier;
      localRect.h *= hitboxMultiplier;
      localRect.x -= localRect.w * 0.25;
      localRect.y -= localRect.h * 0.25;

      // Use cyboard:l2_smash descriptor for scaling
      const smashDesc =
        AttackCatalog.getDescriptor(p, "l2_smash") || descriptor;
      const baseDamage = smashDesc.baseDamage ?? 6;
      const baseStun = smashDesc.stunDuration ?? 0.3;
      const baseKnockback = smashDesc.baseKnockback ?? 250;
      const exponent = smashDesc.knockbackExponent ?? 0.85;
      const cappedChargeMultiplier = Math.min(
        chargeMultiplier,
        smashDesc.maxCharge ?? 2.5
      );

      localDamage = baseDamage * cappedChargeMultiplier;
      localStun = baseStun * cappedChargeMultiplier;
      localKnockback = baseKnockback * cappedChargeMultiplier;
      localExponent = exponent;
    } else {
      return;
    }

    applyHitDetection(
      p,
      i,
      state,
      localRect,
      localDamage,
      localStun,
      localKnockback,
      localExponent,
      descriptor
    );
  }
  function detectFritzHits(
    p,
    i,
    state,
    atkRect,
    damage,
    stun,
    knockback,
    knockbackExponent,
    descriptor
  ) {
    const phases = descriptor?.detectInPhase;
    if (
      Array.isArray(phases) &&
      p.attack?.phase &&
      !phases.includes(p.attack.phase)
    ) {
      return;
    }
    let localRect = atkRect;
    let localDamage = damage ?? descriptor.baseDamage ?? 4;
    let localStun = stun ?? descriptor.stunDuration ?? 0.15;
    let localKnockback = knockback ?? descriptor.baseKnockback ?? 125;
    let localExponent =
      knockbackExponent ?? descriptor.knockbackExponent ?? 1.2;

    if (p.attack?.type === "r1_dash_attack" && p.frameIndex > 0) {
      localRect = Renderer.getR1DashHitbox(p);
      localDamage = p.config.moves.r1_dash_attack_damage || 8;
      localStun = 0.25;
      localKnockback = descriptor.baseKnockback ?? 225;
    } else if (p.attack?.type === "r1_jump" && p.attack.phase === "active") {
      localRect = Renderer.getR1JumpHitbox(p);
      localDamage = p.config.moves.r1_jump_damage || 4;
      localStun = 0.15;
      localKnockback = 75;
    } else if (p.attack?.type === "r1" && p.attack.phase === "release") {
      const releaseRect = Renderer.getR1Hitbox(p, state);
      if (!releaseRect) {
        return;
      }

      localRect = releaseRect;
      localDamage = p.attack.damage ?? descriptor.baseDamage ?? localDamage;
      localStun = p.attack.stunDuration ?? descriptor.stunDuration ?? localStun;
      localKnockback =
        p.attack.knockback ?? descriptor.baseKnockback ?? localKnockback;
      descriptor = {
        ...descriptor,
        baseDamage: localDamage,
        baseKnockback: localKnockback,
        knockbackAngle:
          p.attack.knockbackAngle ?? descriptor.knockbackAngle ?? 45,
        knockbackType: descriptor.knockbackType ?? "standard",
      };
      localExponent = descriptor.knockbackExponent ?? localExponent ?? 1.2;
    } else if (p.attack?.type === "r2" && p.attack.phase === "release") {
      localRect = Renderer.getR2Hitbox(p, state);
      localDamage = p.attack.damage ?? descriptor.baseDamage ?? 4;
      localStun = descriptor.stunDuration ?? 0.1;
      const stageKnockback =
        p.attack.knockback ?? descriptor.baseKnockback ?? localKnockback;
      localKnockback = stageKnockback;
      localExponent = descriptor.knockbackExponent ?? localExponent ?? 1.2;
    } else if (p.attack?.type === "r2_combo" && p.attack.phase === "start") {
      // Only detect hits in frame 001 (where knock-up happens)
      if (p.frameIndex !== 1) {
        return;
      }

      localRect = Renderer.getR2ComboHitbox(p, state);
      localDamage = descriptor.baseDamage ?? 15;
      localStun = descriptor.stunDuration ?? 0.3;

      // Get dash knockback from previous R2 release
      // The R2 release uses p.attack.knockback from the charge stage
      // We need to get that value and double it
      const r2Descriptor = AttackCatalog.getDescriptor(p, "r2");
      const dashKnockback =
        p.attack?.previousDashKnockback ?? r2Descriptor?.baseKnockback ?? 150;
      localKnockback = dashKnockback * 2; // Double the dash knockback
      localExponent = descriptor.knockbackExponent ?? 1.4;

      // Override angle to 70 degrees (from horizontal) in descriptor
      const baseMaxKnockback =
        descriptor?.maxKnockback ?? r2Descriptor?.maxKnockback ?? 300;
      descriptor = {
        ...descriptor,
        knockbackAngle: 70,
        maxKnockback: Math.max(baseMaxKnockback, localKnockback * 2),
      };
    } else if (p.attack?.type === "l1_jab" && p.attack.phase === "start") {
      if (p.frameIndex >= 1) {
        localRect = Renderer.getL1JabHitbox(p);
        localDamage = p.attack.damage ?? descriptor.baseDamage ?? 3;
        localStun = descriptor.stunDuration ?? 0.1;
        localKnockback = descriptor.baseKnockback ?? 75;
      } else {
        return;
      }
    } else if (
      p.attack?.type === "l1_jab_combo" &&
      p.attack.phase === "active"
    ) {
      localRect = Renderer.getL1JabHitbox(p);
      localDamage = p.attack.damage ?? descriptor.baseDamage ?? 4;
      localStun = descriptor.stunDuration ?? 0.15;
      localKnockback = descriptor.baseKnockback ?? 125;
    } else if (
      p.attack?.type === "l1_smash" &&
      p.attack.phase === "release" &&
      p.frameIndex > 0
    ) {
      localRect = Renderer.getL1SmashHitbox(p);
      const smashDesc =
        AttackCatalog.getDescriptor(p, "l1_smash") || descriptor;
      const chargeT = p.attack.chargeT || 0;
      const maxCharge = smashDesc.maxCharge ?? 2.0;
      const chargeRatio = Math.min(chargeT / maxCharge, 1.0);
      const baseDamage = smashDesc.baseDamage ?? 5;
      const baseStun = smashDesc.stunDuration ?? 0.2;
      const baseKnock = smashDesc.baseKnockback ?? 200;
      const knockExpo = smashDesc.knockbackExponent ?? 1.2;
      // Simple linear scaling by ratio (keeps current feel);
      localDamage = baseDamage;
      localStun =
        baseStun + (smashDesc.combo?.stunBonus || 0) * chargeRatio ||
        baseStun + 0.3 * chargeRatio;
      localKnockback =
        baseKnock + (smashDesc.combo?.knockBonus || 250) * chargeRatio;
      localExponent = knockExpo;
    } else {
      return;
    }

    applyHitDetection(
      p,
      i,
      state,
      localRect,
      localDamage,
      localStun,
      localKnockback,
      localExponent,
      descriptor
    );
  }
  function detectHPHits(
    p,
    i,
    state,
    atkRect,
    damage,
    stun,
    knockback,
    knockbackExponent,
    descriptor
  ) {
    const phases = descriptor?.detectInPhase;
    if (
      Array.isArray(phases) &&
      p.attack?.phase &&
      !phases.includes(p.attack.phase)
    ) {
      return;
    }
    let localRect = atkRect;
    let localDamage = damage ?? descriptor.baseDamage ?? 4;
    let localStun = stun ?? descriptor.stunDuration ?? 0.15;
    let localKnockback = knockback ?? descriptor.baseKnockback ?? 125;
    let localExponent =
      knockbackExponent ?? descriptor.knockbackExponent ?? 1.2;

    if (p.attack?.type === "r1_dash_attack" && p.frameIndex > 0) {
      localRect = Renderer.getR1DashHitbox(p);
      localDamage = p.config.moves.r1_dash_attack_damage || 8;
      localStun = 0.25;
      localKnockback = descriptor.baseKnockback ?? 225;
    } else if (p.attack?.type === "r1_jump" && p.attack.phase === "active") {
      localRect = Renderer.getR1JumpHitbox(p);
      localDamage = p.config.moves.r1_jump_damage || 4;
      localStun = 0.15;
      localKnockback = 75;
    } else if (p.attack?.type === "r1" && p.attack.phase === "release") {
      const r1Config = CharacterCatalog.getAttackConfig("hp", state)?.r1 || {};
      const dashFrames = Array.isArray(r1Config.releaseDashFrames)
        ? r1Config.releaseDashFrames
        : [];
      const rawImpactFrame =
        dashFrames.length > 0
          ? Math.min(...dashFrames)
          : r1Config.releaseKnockbackFrame ?? 0;
      const impactFrame = Math.max(0, rawImpactFrame - 1);
      const currentFrame = p.frameIndex | 0;

      if (currentFrame < impactFrame) {
        return;
      }

      localRect = Renderer.getR1Hitbox(p, state);
      if (!localRect) {
        return;
      }
      localDamage = p.attack.damage || 3;
      localStun = 0.2;
      localKnockback = 200;
    } else if (p.attack?.type === "r2" && p.attack.phase === "release") {
      // HP R2 MAX CHARGE: Skip normal hit detection if target is already grabbed
      if (
        p.charName?.toLowerCase() === "hp" &&
        p.attack.wasMaxCharge &&
        p.attack.maxChargeGrabbedTarget
      ) {
        return; // Hit already handled by grab system
      }
      localRect = Renderer.getR2Hitbox(p, state);
      localDamage = p.attack.damage ?? descriptor.baseDamage ?? 4;
      localStun = descriptor.stunDuration ?? 0.1;
      const stageKnockback =
        p.attack.knockback ?? descriptor.baseKnockback ?? localKnockback;
      localKnockback = stageKnockback;
      localExponent = descriptor.knockbackExponent ?? localExponent ?? 1.2;
    } else if (p.attack?.type === "l1_jab" && p.attack.phase === "start") {
      if (p.frameIndex >= 1) {
        localRect = Renderer.getL1JabHitbox(p);
        localDamage = p.attack.damage ?? descriptor.baseDamage ?? 3;
        localStun = descriptor.stunDuration ?? 0.1;
        localKnockback = descriptor.baseKnockback ?? 75;
      } else {
        return;
      }
    } else if (
      p.attack?.type === "l1_jab_combo" &&
      p.attack.phase === "active"
    ) {
      localRect = Renderer.getL1JabHitbox(p);
      localDamage = p.attack.damage ?? descriptor.baseDamage ?? 4;
      localStun = descriptor.stunDuration ?? 0.15;
      localKnockback = descriptor.baseKnockback ?? 125;
    } else if (
      p.attack?.type === "l1_smash" &&
      p.attack.phase === "release" &&
      p.frameIndex > 0
    ) {
      localRect = Renderer.getL1SmashHitbox(p);
      const smashDesc =
        AttackCatalog.getDescriptor(p, "l1_smash") || descriptor;
      const chargeT = p.attack.chargeT || 0;
      const maxCharge = smashDesc.maxCharge ?? 2.0;
      const chargeRatio = Math.min(chargeT / maxCharge, 1.0);
      const baseDamage = smashDesc.baseDamage ?? 5;
      const baseStun = smashDesc.stunDuration ?? 0.2;
      const baseKnock = smashDesc.baseKnockback ?? 200;
      const knockExpo = smashDesc.knockbackExponent ?? 1.2;
      // Simple linear scaling by ratio (keeps current feel);
      localDamage = baseDamage;
      localStun =
        baseStun + (smashDesc.combo?.stunBonus || 0) * chargeRatio ||
        baseStun + 0.3 * chargeRatio;
      localKnockback =
        baseKnock + (smashDesc.combo?.knockBonus || 250) * chargeRatio;
      localExponent = knockExpo;
    } else {
      return;
    }

    applyHitDetection(
      p,
      i,
      state,
      localRect,
      localDamage,
      localStun,
      localKnockback,
      localExponent,
      descriptor
    );
  }
  function detectErnstHits(
    p,
    i,
    state,
    atkRect,
    damage,
    stun,
    knockback,
    knockbackExponent,
    descriptor
  ) {
    const phases = descriptor?.detectInPhase;
    if (
      Array.isArray(phases) &&
      p.attack?.phase &&
      !phases.includes(p.attack.phase)
    ) {
      return;
    }

    if (p.attack?.type === "r1" && p.attack.phase === "charge") {
      return;
    }

    let localRect = atkRect;
    let localDamage = damage ?? descriptor.baseDamage ?? 4;
    let localStun = stun ?? descriptor.stunDuration ?? 0.15;
    let localKnockback = knockback ?? descriptor.baseKnockback ?? 125;
    let localExponent =
      knockbackExponent ?? descriptor.knockbackExponent ?? 1.2;

    if (p.attack?.type === "r1_dash_attack" && p.frameIndex > 0) {
      localRect = Renderer.getR1DashHitbox(p);
      localDamage = p.config.moves.r1_dash_attack_damage || 8;
      localStun = 0.25;
      localKnockback = descriptor.baseKnockback ?? 225;
    } else if (p.attack?.type === "r1_jump" && p.attack.phase === "active") {
      localRect = Renderer.getR1JumpHitbox(p);
      localDamage = p.config.moves.r1_jump_damage || 4;
      localStun = 0.15;
      localKnockback = 75;
    } else if (p.attack?.type === "r1" && p.attack.phase === "release") {
      const releaseRect = Renderer.getR1Hitbox(p, state);
      if (!releaseRect) {
        return;
      }

      const r1Config =
        CharacterCatalog.getAttackConfig("ernst", state)?.r1 || {};
      const knockFrame =
        (Array.isArray(r1Config.releaseDashFrames) &&
          r1Config.releaseDashFrames.length &&
          Math.min(...r1Config.releaseDashFrames)) ||
        r1Config.releaseKnockbackFrame ||
        1;
      const hasReachedKnock = (p.frameIndex ?? 0) >= knockFrame;

      if (!(p.attack.releaseHitFlags instanceof Map)) {
        p.attack.releaseHitFlags = new Map();
      }

      const preHitDescriptor = {
        ...descriptor,
        baseDamage: p.attack.damage ?? descriptor.baseDamage ?? localDamage,
        baseKnockback: 0,
        knockbackType: "none",
        knockbackAngle: 0,
        stunDuration:
          p.attack.stunDuration ?? descriptor.stunDuration ?? localStun,
      };

      const knockDescriptor = {
        ...descriptor,
        baseDamage: 0,
        baseKnockback:
          p.attack.knockback ?? descriptor.baseKnockback ?? localKnockback,
        knockbackType: "standard",
        knockbackAngle:
          p.attack.knockbackAngle ?? descriptor.knockbackAngle ?? 45,
        stunDuration:
          p.attack.stunDuration ?? descriptor.stunDuration ?? localStun,
      };

      for (const target of state.players) {
        if (target === p || target.eliminated) continue;

        const hurtRect = Renderer.getHurtbox(target);
        if (!rectsIntersect(releaseRect, hurtRect)) continue;

        const flags = p.attack.releaseHitFlags.get(target) || {
          preHitDone: false,
          knockDone: false,
        };

        if (!flags.preHitDone) {
          applyDamageWithDescriptor(p, target, preHitDescriptor, state);
          flags.preHitDone = true;
        }

        if (hasReachedKnock && !flags.knockDone) {
          applyDamageWithDescriptor(p, target, knockDescriptor, state);
          flags.knockDone = true;
        }

        p.attack.releaseHitFlags.set(target, flags);
      }
      return;
    } else if (p.attack?.type === "r2" && p.attack.phase === "release") {
      localRect = Renderer.getR2Hitbox(p, state);
      localDamage = p.attack.damage ?? descriptor.baseDamage ?? 4;
      localStun = descriptor.stunDuration ?? 0.1;
      const stageKnockback =
        p.attack.knockback ?? descriptor.baseKnockback ?? localKnockback;
      localKnockback = stageKnockback;
      localExponent = descriptor.knockbackExponent ?? localExponent ?? 1.2;
      // Override descriptor with stage-specific knockbackAngle if available
      if (p.attack.knockbackAngle !== undefined) {
        descriptor = {
          ...descriptor,
          knockbackAngle: p.attack.knockbackAngle,
        };
      }
    } else if (
      p.attack?.type === "r1_jump_attack" &&
      p.attack.phase === "active"
    ) {
      localRect = Renderer.getR1JumpHitbox(p);
      localDamage = descriptor.baseDamage ?? 4;
      localStun = descriptor.stunDuration ?? 0.15;
      localKnockback = descriptor.baseKnockback ?? 175;
    } else if (
      p.attack?.type === "r1_combo_active" &&
      p.attack.phase === "active"
    ) {
      localRect = Renderer.getR1Hitbox(p, state);
      localDamage = descriptor.baseDamage ?? 4;
      localStun = descriptor.stunDuration ?? 0.15;
      localKnockback = descriptor.baseKnockback ?? 175;
    } else if (p.attack?.type === "l1" && p.attack.phase === "release") {
      const bombRect = Renderer.getL1JabHitbox(p);
      if (!bombRect) {
        return;
      }
      localRect = bombRect;
      localDamage = p.attack.damage ?? descriptor.baseDamage ?? 4;
      localStun = descriptor.stunDuration ?? 0.15;
      localKnockback = descriptor.baseKnockback ?? 125;
    } else {
      return;
    }

    applyHitDetection(
      p,
      i,
      state,
      localRect,
      localDamage,
      localStun,
      localKnockback,
      localExponent,
      descriptor
    );
  }
  function detectDefaultHits(
    p,
    i,
    state,
    atkRect,
    damage,
    stun,
    knockback,
    knockbackExponent,
    descriptor
  ) {
    let localRect = atkRect;
    let localDamage = damage ?? descriptor.baseDamage ?? 4;
    let localStun = stun ?? descriptor.stunDuration ?? 0.15;
    let localKnockback = knockback ?? descriptor.baseKnockback ?? 125;
    let localExponent =
      knockbackExponent ?? descriptor.knockbackExponent ?? 1.2;

    if (p.attack?.type === "r1_dash_attack" && p.frameIndex > 0) {
      localRect = Renderer.getR1DashHitbox(p);
      localDamage = p.config.moves.r1_dash_attack_damage || 8;
      localStun = 0.25;
      localKnockback = descriptor.baseKnockback ?? 225;
    } else if (p.attack?.type === "r1_jump" && p.attack.phase === "active") {
      localRect = Renderer.getR1JumpHitbox(p);
      localDamage = p.config.moves.r1_jump_damage || 4;
      localStun = 0.15;
      localKnockback = 75;
    } else if (p.attack?.type === "r1" && p.attack.phase === "release") {
      localRect = Renderer.getR1Hitbox(p, state);
      localDamage = p.attack.damage || 3;
      localStun = 0.2;
      localKnockback = 200;
    } else if (p.attack?.type === "r2" && p.attack.phase === "release") {
      localRect = Renderer.getR2Hitbox(p, state);
      localDamage = p.attack.damage || 4;
      localStun = 0.1;
      localKnockback = 75;
      localExponent = 0.675;
    } else if (p.attack?.type === "l1_jab" && p.attack.phase === "start") {
      if (p.frameIndex >= 1) {
        localRect = Renderer.getL1JabHitbox(p);
        localDamage = p.attack.damage ?? descriptor.baseDamage ?? 3;
        localStun = descriptor.stunDuration ?? 0.1;
        localKnockback = descriptor.baseKnockback ?? 75;
      } else {
        return;
      }
    } else if (
      p.attack?.type === "l1_smash" &&
      p.attack.phase === "release" &&
      p.frameIndex > 0
    ) {
      localRect = Renderer.getL1SmashHitbox(p);
      const smashDesc =
        AttackCatalog.getDescriptor(p, "l1_smash") || descriptor;
      const chargeT = p.attack.chargeT || 0;
      const maxCharge = smashDesc.maxCharge ?? 2.0;
      const chargeRatio = Math.min(chargeT / maxCharge, 1.0);
      const baseDamage = smashDesc.baseDamage ?? 5;
      const baseStun = smashDesc.stunDuration ?? 0.2;
      const baseKnock = smashDesc.baseKnockback ?? 200;
      const knockExpo = smashDesc.knockbackExponent ?? 1.2;
      // Simple linear scaling by ratio (keeps current feel);
      localDamage = baseDamage;
      localStun =
        baseStun + (smashDesc.combo?.stunBonus || 0) * chargeRatio ||
        baseStun + 0.3 * chargeRatio;
      localKnockback =
        baseKnock + (smashDesc.combo?.knockBonus || 250) * chargeRatio;
      localExponent = knockExpo;
    } else {
      return;
    }

    applyHitDetection(
      p,
      i,
      state,
      localRect,
      localDamage,
      localStun,
      localKnockback,
      localExponent,
      descriptor
    );
  }

  // Helper functions that need to be available (these will be imported from physics.js)
  let canUseAbility,
    startCooldown,
    setAnim,
    spawnEffect,
    spawnGlobalEffect,
    checkRhythmBonus,
    spawnRhythmEffect,
    rectsIntersect,
    spawnProjectile,
    getBeatWindowQuality;

  /**
   * Initialize the attack system with required dependencies
   * @param {Object} dependencies - Required functions from physics.js
   */
  function init(dependencies) {
    canUseAbility = dependencies.canUseAbility;
    startCooldown = dependencies.startCooldown;
    setAnim = dependencies.setAnim;
    spawnEffect = dependencies.spawnEffect;
    spawnGlobalEffect = dependencies.spawnGlobalEffect;
    checkRhythmBonus = dependencies.checkRhythmBonus;
    spawnRhythmEffect = dependencies.spawnRhythmEffect;
    rectsIntersect = dependencies.rectsIntersect;
    spawnProjectile = dependencies.spawnProjectile;
    getBeatWindowQuality = dependencies.getBeatWindowQuality;
  }

  return {
    handleAttacks,
    detectHits,
    applyDamageWithDescriptor,
    calculateFinalDamage,
    calculateFinalKnockback,
    applyStandardKnockback,
    applyDashKnockback,
    applyLauncherKnockback,
    applyExplosionKnockback,
    spawnHitEffects,
    handleFritzL2,
    startCombo,
    init,
    updatePerfectBeatMatch,
    resetPerfectBeatMatch,
    updateBeatMatchVisualEffects,
    clearBeatMatchVisualEffects,
    releaseGrabbedTarget,
  };
})();

// Dev Commands for debugging attack values
if (typeof window !== "undefined") {
  window.debugAttack = {
    /**
     * Debug R1 Dash Attack values for a player
     * Usage: debugAttack.r1DashAttack(playerIndex) or debugAttack.r1DashAttack(player)
     */
    r1DashAttack: (playerOrIndex) => {
      const state = window.state;
      if (!state || !state.players) {
        console.error("❌ Game state not found");
        return null;
      }

      const player =
        typeof playerOrIndex === "number"
          ? state.players[playerOrIndex]
          : playerOrIndex || state.players[0];

      if (!player) {
        console.error("❌ Player not found");
        return null;
      }

      const charKey = player.charName?.toLowerCase();
      const descriptor = AttackCatalog.getDescriptor(player, "r1_dash_attack");
      const attackConfig =
        CharacterCatalog.getAttackConfig(charKey, state) || {};
      const dashConfigFromCatalog = attackConfig.r1_dash_attack || {};

      const result = {
        player: {
          name: player.charName,
          index: state.players.indexOf(player),
          currentAttack: player.attack?.type,
          currentPhase: player.attack?.phase,
        },
        descriptor: {
          full: descriptor,
          movement: descriptor?.movement,
        },
        characterCatalog: {
          full: attackConfig.r1_dash_attack,
          values: dashConfigFromCatalog,
        },
        currentValues: player.attack?._debugConfig || null,
        source: player.attack?._debugSource || null,
        calculated: {
          horizontalSpeedMultiplier:
            descriptor?.movement?.horizontalSpeedMultiplier ??
            dashConfigFromCatalog.horizontalSpeedMultiplier ??
            1,
          landingFriction:
            descriptor?.movement?.landingFriction ??
            dashConfigFromCatalog.landingFriction ??
            0.7,
          animSpeed:
            descriptor?.movement?.animSpeed ??
            dashConfigFromCatalog.animSpeed ??
            1,
          dashRange:
            descriptor?.movement?.dashRange ??
            dashConfigFromCatalog.dashRange ??
            null,
        },
        physics: {
          baseMoveSpeed: player.config?.physics?.moveSpeed,
          currentVelX: player.vel?.x,
          currentVelY: player.vel?.y,
        },
      };

      console.log("🔍 R1 Dash Attack Debug Info:", result);
      return result;
    },

    /**
     * Debug all attack descriptor values for a player
     * Usage: debugAttack.descriptor(playerIndex, "r1_dash_attack")
     */
    descriptor: (playerOrIndex, attackType = "r1_dash_attack") => {
      const state = window.state;
      if (!state || !state.players) {
        console.error("❌ Game state not found");
        return null;
      }

      const player =
        typeof playerOrIndex === "number"
          ? state.players[playerOrIndex]
          : playerOrIndex || state.players[0];

      if (!player) {
        console.error("❌ Player not found");
        return null;
      }

      const descriptor = AttackCatalog.getDescriptor(player, attackType);
      const charKey = player.charName?.toLowerCase();
      const attackConfig =
        CharacterCatalog.getAttackConfig(charKey, state) || {};

      const result = {
        player: {
          name: player.charName,
          index: state.players.indexOf(player),
        },
        attackType,
        descriptor,
        characterCatalog: attackConfig[attackType] || {},
        comparison: {
          descriptorMovement: descriptor?.movement,
          catalogConfig: attackConfig[attackType],
        },
      };

      console.log(`🔍 Attack Descriptor Debug (${attackType}):`, result);
      return result;
    },

    /**
     * Compare descriptor vs catalog values for any attack
     * Usage: debugAttack.compare(playerIndex, "r1_dash_attack")
     */
    compare: (playerOrIndex, attackType = "r1_dash_attack") => {
      const state = window.state;
      if (!state || !state.players) {
        console.error("❌ Game state not found");
        return null;
      }

      const player =
        typeof playerOrIndex === "number"
          ? state.players[playerOrIndex]
          : playerOrIndex || state.players[0];

      if (!player) {
        console.error("❌ Player not found");
        return null;
      }

      const descriptor = AttackCatalog.getDescriptor(player, attackType);
      const charKey = player.charName?.toLowerCase();
      const attackConfig =
        CharacterCatalog.getAttackConfig(charKey, state) || {};
      const catalogValues = attackConfig[attackType] || {};

      const comparison = {
        horizontalSpeedMultiplier: {
          descriptor:
            descriptor?.movement?.horizontalSpeedMultiplier ?? "undefined",
          catalog: catalogValues.horizontalSpeedMultiplier ?? "undefined",
          final:
            descriptor?.movement?.horizontalSpeedMultiplier ??
            catalogValues.horizontalSpeedMultiplier ??
            1,
          source: descriptor?.movement?.horizontalSpeedMultiplier
            ? "descriptor"
            : catalogValues.horizontalSpeedMultiplier
            ? "catalog"
            : "default",
        },
        landingFriction: {
          descriptor: descriptor?.movement?.landingFriction ?? "undefined",
          catalog: catalogValues.landingFriction ?? "undefined",
          final:
            descriptor?.movement?.landingFriction ??
            catalogValues.landingFriction ??
            0.7,
          source: descriptor?.movement?.landingFriction
            ? "descriptor"
            : catalogValues.landingFriction
            ? "catalog"
            : "default",
        },
        animSpeed: {
          descriptor: descriptor?.movement?.animSpeed ?? "undefined",
          catalog: catalogValues.animSpeed ?? "undefined",
          final:
            descriptor?.movement?.animSpeed ?? catalogValues.animSpeed ?? 1,
          source: descriptor?.movement?.animSpeed
            ? "descriptor"
            : catalogValues.animSpeed
            ? "catalog"
            : "default",
        },
        dashRange: {
          descriptor: descriptor?.movement?.dashRange ?? "undefined",
          catalog: catalogValues.dashRange ?? "undefined",
          final:
            descriptor?.movement?.dashRange ?? catalogValues.dashRange ?? null,
          source: descriptor?.movement?.dashRange
            ? "descriptor"
            : catalogValues.dashRange
            ? "catalog"
            : "none",
        },
      };

      console.log(`⚖️  Value Comparison (${attackType}):`, {
        player: player.charName,
        attackType,
        comparison,
        summary: Object.keys(comparison).map((key) => ({
          key,
          usedValue: comparison[key].final,
          source: comparison[key].source,
        })),
      });

      return comparison;
    },
  };

  console.log("🛠️  Debug Commands loaded! Available commands:");
  console.log(
    "  • debugAttack.r1DashAttack(0) - Debug R1 dash attack for player 0"
  );
  console.log(
    "  • debugAttack.descriptor(0, 'r1_dash_attack') - Get descriptor for attack"
  );
  console.log(
    "  • debugAttack.compare(0, 'r1_dash_attack') - Compare descriptor vs catalog values"
  );
}
