/* Minimal level viewer for Ninja Stage - Now with Character and Stage Select */
(() => {
  // Browser-compatible environment variable checks
  const WITH_STEAM =
    (typeof process !== "undefined" && process.env?.WITH_STEAM === "true") ||
    false;
  const IS_ELECTRON_BUILD =
    (typeof process !== "undefined" && process.env?.IS_ELECTRON === "true") ||
    false;

  const isElectronRuntime = () =>
    typeof window !== "undefined" &&
    typeof window.process === "object" &&
    window.process?.type === "renderer";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const overlay = document.getElementById("overlay");

  const state = GameState.createState();
  window.state = state; // Make state globally accessible for WebGL renderer
  state.gameMode = "LOADING"; // NEW: Game mode state machine

  // NEW: Performance mode for mobile devices
  state.performanceMode = false;
  if (typeof window !== "undefined" && window.matchMedia) {
    const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const isLowEnd =
      navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4;
    state.performanceMode = isCoarsePointer || isLowEnd;
    if (state.performanceMode) {
      console.log("[Performance] Mobile/Performance mode enabled");
    }
  }

  // NEW: Metronome state
  state.metronome = {
    enabled: false,
    visualPulse: 0, // 0-1 value for visual feedback
  };

  // Resolve global singletons (defensive when scripts fail to load)
  const Physics = window.Physics;
  const AttackSystem = window.AttackSystem;
  const Renderer = window.Renderer;
  const MovementSystem = window.MovementSystem;
  const AudioSystem = window.AudioSystem;
  const GameAssets = window.GameAssets;
  const InputHandler = window.InputHandler;
  const Metronome = window.Metronome;
  const ParticleManager = window.ParticleManager;
  const UIComponents = window.UIComponents;
  const NPCController = window.NPCController;
  const PerformanceMonitor = window.PerformanceMonitor;
  const WebGLRenderer = window.WebGLRenderer;

  if (!Physics || typeof Physics !== "object") {
    throw new Error(
      "Physics module missing – ensure js/physics.js is loaded before main.js."
    );
  }

  // --- NEW: Selection state ---
  state.selection = {
    characters: {},
    stages: {},
    p1CharIndex: 0,
    p2CharIndex: 0,
    stageIndex: 0,
    p1Locked: false,
    p2Locked: false,
    // NEW: Animation states for character selection flow
    p1SelectAnimation: null, // Animation object for P1 select
    p2SelectAnimation: null, // Animation object for P2 select
    selectedAnimation: null, // Animation object for final selected state
    animationPhase: "idle", // "idle", "p1_selecting", "p2_selecting", "selected"
    fadeOutSpeed: 1.0, // Default fade speed, will be faster for P1 selection
  };

  // --- Title screen state ---
  state.titleScreen = {
    pulsePhase: 0, // For pulsing animation
    introPlayed: false,
  };

  // --- NEW: Title intro transition state ---
  state.titleIntro = {
    isActive: false,
    startTime: 0,
    duration: 12.0, // 12 seconds to match music duration with fade to black
    currentFrame: 0,
    totalFrames: 16,
    canSkip: true,
    // NEW: Loop-based animation with speed progression
    frameTime: 0,
    loopCount: 0, // 0 = first loop (normal speed), 1 = second loop (double speed)
    maxLoops: 2, // Stop after 2 loops
    stutterFrames: [3, 7, 11, 15], // Every 4th frame (0-based) shown longer
  };

  // Performance: Frame pacing and delta clamping for first frames
  let frameCount = 0;
  const MAX_FRAME_DELTA = 1 / 30; // Clamp to max 30fps equivalent (33.33ms)
  const FRAMES_TO_STABILIZE = 10; // Clamp delta for first 10 frames

  /**
   * Warm up Canvas2D context by performing dummy operations.
   * This triggers first-time canvas API calls before actual gameplay.
   */
  async function warmupCanvasContext(ctx, canvas) {
    return new Promise((resolve) => {
      // Use requestAnimationFrame to ensure browser is ready
      requestAnimationFrame(() => {
        try {
          // Perform common canvas operations to warm up the pipeline
          ctx.save();
          ctx.fillStyle = "black";
          ctx.fillRect(0, 0, 1, 1);
          ctx.clearRect(0, 0, 1, 1);

          // Warm up transforms
          ctx.translate(1, 1);
          ctx.scale(1, 1);
          ctx.rotate(0);
          ctx.restore();

          // Warm up image drawing (if we have any loaded images)
          if (
            state.characterConfigs &&
            Object.keys(state.characterConfigs).length > 0
          ) {
            const firstChar = Object.values(state.characterConfigs)[0];
            if (firstChar && firstChar.atlasImage) {
              try {
                // Draw tiny version to warm up drawImage path
                ctx.drawImage(firstChar.atlasImage, 0, 0, 1, 1, 0, 0, 1, 1);
              } catch (e) {
                // Image might not be ready yet, that's okay
              }
            }
          }

          // Warm up stage layers and FX atlases to avoid first-frame uploads
          const stageImages = [
            state.bg,
            state.bgLayer,
            state.mid,
            state.fg,
            state.stageFxAtlas?.atlasImage,
          ];
          for (const img of stageImages) {
            if (!img) continue;
            try {
              const texture = img._bitmap || img;
              ctx.drawImage(texture, 0, 0, 1, 1, 0, 0, 1, 1);
            } catch (e) {
              // Best-effort warmup; ignore individual failures
            }
          }
          // Clear the tiny warmup pixel
          ctx.clearRect(0, 0, 1, 1);

          // Give browser one more frame to process
          requestAnimationFrame(() => {
            resolve();
          });
        } catch (error) {
          console.debug("Canvas warmup failed (non-critical):", error);
          resolve(); // Always resolve, don't block
        }
      });
    });
  }

  /**
   * AGGRESSIVE gameplay warmup - pre-compiles all critical code paths
   * This prevents JIT compilation stutter during first actions
   */
  async function warmupGameplaySystems(state, ctx, canvas) {
    const startTime = performance.now();
    console.log("🔥 Starting aggressive gameplay warmup...");

    // Wait for next frame to ensure browser is ready
    await new Promise((resolve) => requestAnimationFrame(resolve));

    try {
      // 1. Create dummy player objects for testing
      const dummyPlayer1 = {
        charName: state.selectedCharacters?.[0] || "cyboard",
        pos: { x: 100, y: 100 },
        facing: 1,
        frameIndex: 0,
        frames: [],
        anim: "idle",
        attack: { type: "none", phase: "none" },
        vel: { x: 0, y: 0 },
        percent: 0,
        config: state.characterConfigs?.[state.selectedCharacters?.[0]] || {},
      };

      const dummyPlayer2 = {
        charName: state.selectedCharacters?.[1] || "fritz",
        pos: { x: 200, y: 100 },
        facing: -1,
        frameIndex: 0,
        frames: [],
        anim: "idle",
        attack: { type: "none", phase: "none" },
        vel: { x: 0, y: 0 },
        percent: 0,
        config: state.characterConfigs?.[state.selectedCharacters?.[1]] || {},
      };

      // 2. Warm up Renderer functions - all hitbox calculations
      if (Renderer && state.characterConfigs) {
        console.log("🔥 Warming up Renderer hitbox functions...");

        // Test all hitbox getters
        try {
          Renderer.getHurtbox(dummyPlayer1);
          Renderer.getR1Hitbox(dummyPlayer1, state);
          Renderer.getR2Hitbox(dummyPlayer1, state);
          Renderer.getL1JabHitbox(dummyPlayer1);
          Renderer.getL1SmashHitbox(dummyPlayer1);
          Renderer.getR1ComboHitbox(dummyPlayer1, state);
          Renderer.getR1DashHitbox(dummyPlayer1, state);
          Renderer.getR1JumpHitbox(dummyPlayer1, state);
          Renderer.getR1UpAttackHitbox(dummyPlayer1);
          Renderer.getL2SmashHitbox(dummyPlayer1);

          // Test with different facing directions
          dummyPlayer1.facing = -1;
          Renderer.getR1Hitbox(dummyPlayer1, state);
          Renderer.getR2Hitbox(dummyPlayer1, state);
        } catch (e) {
          console.debug("Renderer warmup warning (non-critical):", e);
        }
      }

      // 3. Warm up AttackSystem functions
      if (AttackSystem && AttackSystem.detectHits) {
        console.log("🔥 Warming up AttackSystem functions...");
        try {
          // Test hit detection with dummy data
          AttackSystem.detectHits(dummyPlayer1, 0, state);
          AttackSystem.detectHits(dummyPlayer2, 1, state);

          // Test damage calculation functions
          if (AttackSystem.calculateFinalDamage) {
            AttackSystem.calculateFinalDamage(
              dummyPlayer1,
              dummyPlayer2,
              10,
              {}
            );
          }
          if (AttackSystem.calculateFinalKnockback) {
            AttackSystem.calculateFinalKnockback(
              dummyPlayer1,
              dummyPlayer2,
              100,
              1.0,
              {}
            );
          }
        } catch (e) {
          console.debug("AttackSystem warmup warning (non-critical):", e);
        }
      }

      // 3.5. CRITICAL: Warm up resolveHits function (prevents first-hit stutter)
      // This function creates Maps/Sets and does complex priority calculations
      if (Physics && Physics.resolveHits) {
        console.log(
          "🔥 Warming up resolveHits function (first-hit stutter fix)..."
        );
        try {
          // Create dummy pendingHits array that simulates a real collision
          const originalPendingHits = state.pendingHits || [];
          state.pendingHits = [
            {
              attacker: dummyPlayer1,
              target: dummyPlayer2,
              attackType: "r1",
              damage: 5,
              stun: 0.1,
              knockback: 100,
              descriptor:
                AttackCatalog?.getDescriptor?.(dummyPlayer1, "r1") || {},
            },
            {
              attacker: dummyPlayer2,
              target: dummyPlayer1,
              attackType: "r1",
              damage: 5,
              stun: 0.1,
              knockback: 100,
              descriptor:
                AttackCatalog?.getDescriptor?.(dummyPlayer2, "r1") || {},
            },
          ];

          // Temporarily add dummy players to state for resolveHits
          const originalPlayers = state.players || [];
          state.players = [dummyPlayer1, dummyPlayer2];

          // Warm up resolveHits - this compiles Map/Set creation and priority logic
          Physics.resolveHits(state);

          // Test with overlapping hits (clank scenario)
          state.pendingHits = [
            {
              attacker: dummyPlayer1,
              target: dummyPlayer2,
              attackType: "r1",
              damage: 10,
              stun: 0.2,
              knockback: 200,
              descriptor:
                AttackCatalog?.getDescriptor?.(dummyPlayer1, "r1") || {},
            },
          ];
          Physics.resolveHits(state);

          // Restore original state
          state.pendingHits = originalPendingHits;
          state.players = originalPlayers;
        } catch (e) {
          console.debug("resolveHits warmup warning (non-critical):", e);
        }
      }

      // 4. Warm up Canvas drawing operations - test all sprite rendering paths
      if (Renderer && state.characterConfigs) {
        console.log("🔥 Warming up Canvas drawing operations...");
        try {
          ctx.save();

          // Test drawing from each character atlas
          for (const charName in state.characterConfigs) {
            const charData = state.characterConfigs[charName];
            if (charData && charData.atlasImage) {
              // Draw tiny off-screen sprite to trigger drawImage path
              ctx.drawImage(
                charData.atlasImage,
                0,
                0,
                1,
                1,
                -1000,
                -1000,
                1,
                1
              );
            }
          }

          // Test FX atlas drawing
          if (state.fxAtlas && state.fxAtlas.atlasImage) {
            ctx.drawImage(
              state.fxAtlas.atlasImage,
              0,
              0,
              1,
              1,
              -1000,
              -1000,
              1,
              1
            );
          }
          if (state.fxAtlas2 && state.fxAtlas2.atlasImage) {
            ctx.drawImage(
              state.fxAtlas2.atlasImage,
              0,
              0,
              1,
              1,
              -1000,
              -1000,
              1,
              1
            );
          }
          if (state.fxAtlas3 && state.fxAtlas3.atlasImage) {
            ctx.drawImage(
              state.fxAtlas3.atlasImage,
              0,
              0,
              1,
              1,
              -1000,
              -1000,
              1,
              1
            );
          }

          // Test transforms
          ctx.translate(10, 10);
          ctx.scale(1.5, 1.5);
          ctx.rotate(0.1);
          ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset

          ctx.restore();
        } catch (e) {
          console.debug("Canvas drawing warmup warning (non-critical):", e);
        }
      }

      // 5. Warm up Physics/AttackSystem handleAttacks path
      if (AttackSystem && AttackSystem.handleAttacks) {
        console.log("🔥 Warming up attack handling paths...");
        try {
          const dummyInputs = {
            r1Down: false,
            r1Held: false,
            r2Down: false,
            r2Held: false,
            l1Down: false,
            l1Held: false,
            l2Down: false,
            l2Held: false,
            ultiDown: false,
            jumpPressed: false,
            jumpHeld: false,
            axis: 0,
            rollDown: false,
            rollHeld: false,
          };

          // Test attack handling (should early return, but JIT compiles the function)
          AttackSystem.handleAttacks(0.016, dummyPlayer1, dummyInputs, state);

          // Test with different attack states
          dummyPlayer1.attack = { type: "r1", phase: "start" };
          AttackSystem.handleAttacks(0.016, dummyPlayer1, dummyInputs, state);

          dummyPlayer1.attack = { type: "r2", phase: "charge" };
          AttackSystem.handleAttacks(0.016, dummyPlayer1, dummyInputs, state);
        } catch (e) {
          console.debug("Attack handling warmup warning (non-critical):", e);
        }
      }

      // 6. Warm up WebGL shaders more aggressively
      // Use the existing warmupCollisionEffects which properly cleans up
      if (
        WebGLRenderer &&
        state.webglInitialized &&
        WebGLRenderer.warmupCollisionEffects
      ) {
        console.log("🔥 Warming up WebGL shaders aggressively...");
        try {
          // This function triggers effects, updates them, and then clears them
          WebGLRenderer.warmupCollisionEffects();

          // Additionally test multiple shader paths for better JIT compilation
          if (WebGLRenderer.triggerKillZoneEffect) {
            // Trigger different intensity levels to compile all shader branches
            WebGLRenderer.triggerKillZoneEffect(0.1, 0.5, 0.05);
            WebGLRenderer.triggerKillZoneEffect(0.5, 0.5, 0.1);
            WebGLRenderer.triggerKillZoneEffect(0.9, 0.9, 0.3);

            // Update effects multiple times to ensure compilation
            if (WebGLRenderer.updateKillZoneEffects) {
              for (let i = 0; i < 3; i++) {
                WebGLRenderer.updateKillZoneEffects(0.016);
              }
            }

            // Clear effects again after additional testing
            // (warmupCollisionEffects already cleared once, but we added more)
            // Note: We can't directly access killZoneEffects, but updates help compilation
          }
        } catch (e) {
          console.debug("WebGL warmup warning (non-critical):", e);
        }
      }

      // 7. Force texture uploads by drawing all critical sprites
      if (Renderer && state.characterConfigs) {
        console.log("🔥 Forcing texture uploads...");
        try {
          ctx.save();
          ctx.globalAlpha = 0.01; // Almost invisible

          // Draw a small portion of each atlas to force GPU upload
          for (const charName in state.characterConfigs) {
            const charData = state.characterConfigs[charName];
            if (charData && charData.atlasImage) {
              const img = charData.atlasImage;
              // Draw corner of atlas to trigger upload
              ctx.drawImage(
                img,
                0,
                0,
                Math.min(64, img.width),
                Math.min(64, img.height),
                0,
                0,
                1,
                1
              );
            }
          }

          // Force FX atlas uploads
          [state.fxAtlas, state.fxAtlas2, state.fxAtlas3].forEach((atlas) => {
            if (atlas && atlas.atlasImage) {
              const img = atlas.atlasImage;
              ctx.drawImage(
                img,
                0,
                0,
                Math.min(64, img.width),
                Math.min(64, img.height),
                0,
                0,
                1,
                1
              );
            }
          });

          ctx.globalAlpha = 1.0;
          ctx.restore();
        } catch (e) {
          console.debug("Texture upload warmup warning (non-critical):", e);
        }
      }

      // 8. Warm up MovementSystem paths
      if (MovementSystem && MovementSystem.handleMovement) {
        console.log("🔥 Warming up MovementSystem paths...");
        try {
          const dummyInputs = {
            axis: 0.5,
            jumpPressed: false,
            jumpHeld: false,
            rollDown: false,
            rollHeld: false,
          };

          // Test movement handling
          MovementSystem.handleMovement(
            0.016,
            dummyPlayer1,
            dummyInputs,
            state
          );

          // Test with different inputs
          dummyInputs.axis = -0.5;
          MovementSystem.handleMovement(
            0.016,
            dummyPlayer1,
            dummyInputs,
            state
          );

          dummyInputs.jumpPressed = true;
          MovementSystem.handleMovement(
            0.016,
            dummyPlayer1,
            dummyInputs,
            state
          );
        } catch (e) {
          console.debug("MovementSystem warmup warning (non-critical):", e);
        }
      }

      // 10. Warm up actual player rendering paths
      if (Renderer && Renderer.drawPlayer && state.characterConfigs) {
        console.log("🔥 Warming up player rendering paths...");
        try {
          // Prepare dummy players with proper structure for rendering
          const charName1 = state.selectedCharacters?.[0] || "cyboard";
          const charName2 = state.selectedCharacters?.[1] || "fritz";

          // Ensure players have frame data
          const charData1 = state.characterConfigs[charName1];
          const charData2 = state.characterConfigs[charName2];

          if (charData1) {
            dummyPlayer1.charName = charName1;
            dummyPlayer1.config = charData1;
            // Get first frame name if available
            const firstAnim = charData1.animations
              ? Object.keys(charData1.animations)[0]
              : null;
            if (firstAnim && charData1.animations[firstAnim]) {
              dummyPlayer1.anim = firstAnim;
              dummyPlayer1.frames = charData1.animations[firstAnim];
            }
          }

          if (charData2) {
            dummyPlayer2.charName = charName2;
            dummyPlayer2.config = charData2;
            const firstAnim = charData2.animations
              ? Object.keys(charData2.animations)[0]
              : null;
            if (firstAnim && charData2.animations[firstAnim]) {
              dummyPlayer2.anim = firstAnim;
              dummyPlayer2.frames = charData2.animations[firstAnim];
            }
          }

          ctx.save();
          // Render off-screen to warm up paths
          ctx.translate(-10000, -10000);
          Renderer.drawPlayer(ctx, state, dummyPlayer1);
          Renderer.drawPlayer(ctx, state, dummyPlayer2);
          ctx.restore();
        } catch (e) {
          console.debug("Player rendering warmup warning (non-critical):", e);
        }
      }

      // 9. Give browser time to process JIT compilation
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => setTimeout(resolve, 16)); // One frame delay

      const warmupTime = performance.now() - startTime;
      console.log(
        `✅ Aggressive gameplay warmup complete in ${warmupTime.toFixed(2)}ms`
      );

      return warmupTime;
    } catch (error) {
      console.warn("⚠️ Gameplay warmup failed (non-critical):", error);
      return 0;
    }
  }

  function loop(ts) {
    // Start performance monitoring for this frame
    if (window.PerformanceMonitor?.isEnabled) {
      window.PerformanceMonitor.startFrame();
    }

    const t = ts * 0.001;
    let dt = state.lastTime ? t - state.lastTime : 0;

    // Clamp delta spikes in first frames to prevent physics explosions
    if (frameCount < FRAMES_TO_STABILIZE) {
      dt = Math.min(dt, MAX_FRAME_DELTA);
    }

    frameCount++;
    state.lastTime = t;

    switch (state.gameMode) {
      case "TITLE_SCREEN":
        // Update pulse animation
        state.titleScreen.pulsePhase += dt * 2; // 2 Hz frequency
        const pulseValue = (Math.sin(state.titleScreen.pulsePhase) + 1) / 2; // 0 to 1

        // Handle input
        handleTitleScreenInput();

        // Render
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        UIComponents.renderTitleScreen(ctx, pulseValue);
        break;

      case "TITLE_INTRO":
        // Update title intro animation
        updateTitleIntroAnimation(dt);
        handleTitleIntroInput();

        // Render
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        UIComponents.renderTitleIntro(ctx, state);
        break;

      case "CHARACTER_SELECT":
        handleCharacterSelectInput();
        // Check for Start button (Button 9) as ESC input
        checkStartButtonAsESC(state);
        // Handle modal input if modal is open
        handleModalInput(state);
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear screen
        UIComponents.renderCharacterSelect(
          ctx,
          state,
          state.selection.characters,
          state.selection.p1CharIndex,
          state.selection.p2CharIndex,
          [state.selection.p1Locked, state.selection.p2Locked]
        );
        // Render modal if open
        UIComponents.renderInGameModal(ctx, state);
        break;

      case "STAGE_SELECT":
        handleStageSelectInput();
        // Check for Start button (Button 9) as ESC input
        checkStartButtonAsESC(state);
        // Handle modal input if modal is open
        handleModalInput(state);
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear screen
        UIComponents.renderStageSelect(
          ctx,
          state,
          state.selection.stages,
          state.selection.stageIndex
        );
        // Render modal if open
        UIComponents.renderInGameModal(ctx, state);
        break;

      case "GAME_TYPE_SELECT":
        // Update input cooldown
        if (state.inputCooldown.confirmCooldown > 0) {
          state.inputCooldown.confirmCooldown = Math.max(
            0,
            state.inputCooldown.confirmCooldown - dt
          );
        }
        handleGameTypeSelectInput();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        UIComponents.renderGameTypeSelect(ctx, state);
        break;

      case "GAME_MODE_SELECT":
        handleGameModeSelectInput();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        UIComponents.renderGameModeSelect(ctx, state);
        break;

      case "PLAYING":
        // NEW: Check for tutorial part 1 to part 2 transition (pvp_stage_2)
        if (state.tutorial?.transitionToPart2) {
          state.tutorial.transitionToPart2 = false;
          const tutorialPart2StagePath =
            "levels/sidescroller/ninja_stage/sections/pvp_stage_2";
          state.gameMode = "LOADING";
          startGame(tutorialPart2StagePath);
          break;
        }
        // NEW: Check for tutorial part 2 to part 3 transition (pvp_stage_3)
        if (state.tutorial?.transitionToPart3) {
          state.tutorial.transitionToPart3 = false;
          const tutorialPart3StagePath =
            "levels/sidescroller/ninja_stage/sections/pvp_stage_3";
          state.gameMode = "LOADING";
          startGame(tutorialPart3StagePath);
          break;
        }

        // Performance monitoring: WebGL fallback init
        if (window.PerformanceMonitor?.isEnabled) {
          window.PerformanceMonitor.startSection("WebGL_FallbackCheck");
        }

        // The core game loop
        // Note: WebGL is now initialized early in startGame(), so we skip init here
        // Only initialize if somehow it wasn't done during warmup
        if (
          typeof WebGLRenderer !== "undefined" &&
          WebGLRenderer.init &&
          state.webglInitialized === undefined
        ) {
          console.warn(
            "⚠️ WebGL not initialized during warmup, initializing now (WILL CAUSE LAG)..."
          );
          const initResult = WebGLRenderer.init(canvas);
          if (initResult) {
            state.webglInitialized = true;
            WebGLRenderer.setSnowEnabled(true);
            if (WebGLRenderer.warmupCollisionEffects) {
              WebGLRenderer.warmupCollisionEffects();
            }
          } else {
            state.webglInitialized = false;
          }
        }

        if (window.PerformanceMonitor?.isEnabled) {
          window.PerformanceMonitor.endSection("WebGL_FallbackCheck");
        }

        // Performance monitoring: Physics update
        if (window.PerformanceMonitor?.isEnabled) {
          window.PerformanceMonitor.startSection("Physics_Update");
        }

        // --- NEW: Hitstop & Camera Shake Logic ---
        // Update Shake
        if (state.shake && state.shake.duration > 0) {
          state.shake.duration -= dt;
          state.shake.x = (Math.random() - 0.5) * 2 * state.shake.intensity;
          state.shake.y = (Math.random() - 0.5) * 2 * state.shake.intensity;
          // Decay intensity
          state.shake.intensity *= Math.pow(state.shake.decay, dt * 60);

          if (state.shake.duration <= 0) {
            state.shake.x = 0;
            state.shake.y = 0;
            state.shake.intensity = 0;
          }
        }

        // Handle Hitstop (Freeze Frames)
        let skipUpdates = false;
        let skipReason = null;
        if (state.hitstop > 0) {
          state.hitstop -= dt * 60; // Decrease frames
          if (state.hitstop > 0) {
            skipUpdates = true; // Still frozen
            skipReason = "hitstop";
          } else {
            state.hitstop = 0; // Reset if dropped below 0
          }
        }

        // NEW: Tutorial Part 2 Game Freeze (during modals)
        if (window.TutorialSystem?.isGameFrozen?.(state)) {
          skipUpdates = true;
          skipReason = skipReason || "tutorial_modal";
        }

        // Debug: If we're skipping updates, print the cause and some helpful state
        if (skipUpdates) {
          try {
            console.warn(
              `[DEBUG] skipUpdates=true → reason=${skipReason}; hitstop=${(
                state.hitstop || 0
              ).toFixed(2)}; tutorialPart=${
                state.tutorial?.part
              }; part2ModalVisible=${Boolean(
                state.tutorial?.part2?.modal?.visible
              )}; modal.isOpen=${Boolean(state.modal?.isOpen)}`
            );
          } catch (e) {
            // Swallow debug errors to avoid breaking the loop
          }
        }

        if (!skipUpdates) {
          Physics.update(dt, state, {
            width: GameState.CONSTANTS.NATIVE_WIDTH,
            height: GameState.CONSTANTS.NATIVE_HEIGHT,
          });
        } else {
          // Even when physics is paused due to hitstop/modal freezes, advance
          // visual-only stage animations and particle updates so UI/background
          // animations continue to play.
          try {
            const scaledDt =
              dt * (state.timeScale !== undefined ? state.timeScale : 1.0);
            if (Physics.updateStageAnimations) {
              Physics.updateStageAnimations(scaledDt, state);
            }
            const particleMgr = window.ParticleManager;
            if (particleMgr && typeof particleMgr.update === "function") {
              particleMgr.update(scaledDt);
            }
            // DanceSpotManager affects UI visibility/proximity; update it too.
            if (
              window.DanceSpotManager &&
              typeof window.DanceSpotManager.update === "function"
            ) {
              window.DanceSpotManager.update(scaledDt, state);
            }
          } catch (e) {
            // Swallow to avoid breaking the loop
            console.warn(
              "[DEBUG] Error advancing visual-only systems during skipUpdates:",
              e
            );
          }
        }

        if (window.PerformanceMonitor?.isEnabled) {
          window.PerformanceMonitor.endSection("Physics_Update");
        }

        // Performance monitoring: Particle update
        if (window.PerformanceMonitor?.isEnabled) {
          window.PerformanceMonitor.startSection("Particle_Update");
        }

        const particleMgr = window.ParticleManager;
        if (
          !skipUpdates &&
          particleMgr &&
          typeof particleMgr.update === "function"
        ) {
          // In performance mode, update particles less frequently (every other frame)
          if (state.performanceMode) {
            state._particleUpdateCounter =
              (state._particleUpdateCounter || 0) + 1;
            if (state._particleUpdateCounter % 2 === 0) {
              particleMgr.update(dt);
            }
          } else {
            particleMgr.update(dt);
          }
        }

        if (window.PerformanceMonitor?.isEnabled) {
          window.PerformanceMonitor.endSection("Particle_Update");
        }

        // Update beatmatch feedback timers
        if (state.beatFeedback) {
          if (state.beatFeedback.p1.time < state.beatFeedback.p1.duration) {
            state.beatFeedback.p1.time += dt;
          }
          if (state.beatFeedback.p2.time < state.beatFeedback.p2.duration) {
            state.beatFeedback.p2.time += dt;
          }
        }

        // NEW: Check tutorial step completion
        if (window.TutorialSystem && state.tutorial?.active) {
          // Check step completion for all parts (Part 2 Step 3 is handled by trackPlayerDeath)
          window.TutorialSystem.checkStepCompletion(state);

          // Update unified tutorial modal
          window.TutorialSystem.updateTutorialModal(dt, state);

          // Update part-specific logic
          if (state.tutorial.part === 2) {
            window.TutorialSystem.updatePartTwoLogic(dt, state);
            window.TutorialSystem.updatePartTwoTip(dt, state);
          } else if (state.tutorial.part === 3) {
            window.TutorialSystem.updatePartTwoTip(dt, state); // Reuse tip system for part 3
          }
        }

        // Performance monitoring: Rendering
        if (window.PerformanceMonitor?.isEnabled) {
          window.PerformanceMonitor.startSection("Renderer_Full");
        }

        Renderer.render(ctx, state);

        if (window.PerformanceMonitor?.isEnabled) {
          window.PerformanceMonitor.endSection("Renderer_Full");
        }

        // NEW: Dance Battle UI overlay
        UIComponents.renderDanceBattle(ctx, state);
        // Render unified tutorial modal
        UIComponents.renderTutorialModal(ctx, state);

        // NEW: Handle tutorial modal confirmation (X button - can skip anytime)
        if (state.tutorial?.active) {
          // Check if unified modal is visible (can be skipped at any time)
          const isModalVisible =
            window.TutorialModalController?.isWaitingForConfirmation?.(state);

          if (isModalVisible) {
            // X button only (Button 0 = X on PlayStation / A on Xbox)
            // Also support Enter/Space for keyboard
            const xButtonPressed =
              state.input.keysPressed.has("Enter") ||
              state.input.keysPressed.has(" ") ||
              getGamepadButtonPressed(0, 0); // X/A button only

            if (xButtonPressed) {
              // Handle Part 2 and Part 3 modals
              if (state.tutorial.part === 2) {
                if (window.TutorialSystem?.confirmModal(state)) {
                  console.log(
                    "[Tutorial] Part 2 modal confirmed/skipped via X button"
                  );
                }
              } else if (state.tutorial.part === 3) {
                if (window.TutorialSystem?.confirmPartThreeModal(state)) {
                  console.log(
                    "[Tutorial] Part 3 modal confirmed/skipped via X button"
                  );
                }
              } else {
                // Part 1 or other - use generic confirm (works anytime now)
                if (window.TutorialModalController?.confirm(state)) {
                  console.log(
                    "[Tutorial] Modal confirmed/skipped via X button"
                  );
                }
              }
            }
          }
        }

        // NEW: Modal UI overlay
        UIComponents.renderInGameModal(ctx, state);
        UIComponents.renderControlsModal(ctx, state);

        // NEW: Handle modal input
        handleModalInput(state);
        // Check for Start button (Button 9) as ESC input
        checkStartButtonAsESC(state);

        InputHandler.clearInputEdges(state);

        // Update metronome visual pulse (decay over time)
        if (state.metronome.visualPulse > 0) {
          state.metronome.visualPulse = Math.max(
            0,
            state.metronome.visualPulse - dt * 4
          ); // Decay in 0.25s
        }

        // Update metronome BPM if in gameplay and BPM changed
        if (state.metronome.enabled && state.currentBPM) {
          const metronomeState = Metronome.getState();
          if (metronomeState.currentBPM !== state.currentBPM) {
            Metronome.setBPM(state.currentBPM);
          }
        }

        updateGameOverlay(state);
        break;
    }

    // End performance monitoring for this frame
    if (window.PerformanceMonitor?.isEnabled) {
      window.PerformanceMonitor.endFrame();
    }

    requestAnimationFrame(loop);
  }

  function updateGameOverlay(state) {
    const p1Pad = state.input.gamepadMapping[0];
    const p2Pad = state.input.gamepadMapping[1];
    const padCount = state.input.connectedGamepads.size;

    // Check if we're in the beat window
    const isInBeat = Physics.isInBeatWindow
      ? Physics.isInBeatWindow(state)
      : false;
    const beatColor = isInBeat ? "#00ff00" : "#ff0000";
    const beatText = isInBeat ? "🟢 BEAT" : "🔴 WAIT";

    // Check for Fritz Ultimate Status
    let fritzPlayer = null;
    let discoBallActive = false;
    let vignetteActive = false;
    let statusText = "💫 Ready for disco";
    let statusColor = "#888888";

    // Finde Fritz Player
    if (state.players) {
      fritzPlayer = state.players.find((p) => p.charName === "fritz");
    }

    // Check for Disco-Ball status
    if (state.projectiles) {
      for (const proj of state.projectiles) {
        if (proj.type === "ulti_check" && proj.isDiscoBall) {
          discoBallActive = true;
          break;
        }
      }
    }

    // Status basierend auf Fritz Ultimate Phase
    if (fritzPlayer) {
      if (fritzPlayer.ultiPhase === "start") {
        statusText = "🌑 VIGNETTE ACTIVE!";
        statusColor = "#ff6600";
        vignetteActive = true;
      } else if (discoBallActive) {
        statusText = "🕺 DISCO BALL ACTIVE!";
        statusColor = "#ff00ff";
        vignetteActive = true;
      } else if (fritzPlayer.ultiPhase) {
        statusText = "⚡ ULTIMATE READY!";
        statusColor = "#ffff00";
      }
    }

    // NEW: Cooldown Display Helper
    function formatCooldown(cd) {
      if (!cd || cd <= 0) return '<span style="color:#00ff00;">✓</span>';
      return `<span style="color:#ff4444;">${cd.toFixed(1)}s</span>`;
    }

    function getCooldownDisplay(player, label) {
      if (!player || !player.cooldowns) return "";
      const cds = player.cooldowns;
      return `
        <div style="margin-top:8px; font-size:10px; border-top:1px solid #444; padding-top:4px;">
          <div style="font-weight:bold; color:#ffaa00;">${label}</div>
          <div>R1: ${formatCooldown(cds.r1)} | R2: ${formatCooldown(
        cds.r2
      )} | L1: ${formatCooldown(cds.l1)} | L2: ${formatCooldown(cds.l2)}</div>
          <div>Roll: ${formatCooldown(cds.roll)} | Shield: ${formatCooldown(
        cds.shield
      )} | 2xJump: ${formatCooldown(cds.doubleJump)} | Ulti: ${formatCooldown(
        cds.ultimate
      )}</div>
        </div>
      `;
    }

    const p1 = state.players ? state.players[0] : null;
    const p2 = state.players ? state.players[1] : null;

    // NEW: Enhanced Beat timing debug info with drift detection
    function getBeatDebugInfo() {
      if (!state.currentBPM) return "";
      let rawMusicTime = 0;
      if (AudioSystem && AudioSystem.getMusicTime) {
        rawMusicTime = AudioSystem.getMusicTime() || 0;
      }
      const beatOffset = state.currentBeatOffset || 0;
      let musicTime = 0;
      if (rawMusicTime > 0) {
        musicTime = Math.max(0, rawMusicTime + beatOffset);
      } else {
        const stageStartTime = state.stageStartTime || 0;
        const timeSinceStageStart = performance.now() / 1000 - stageStartTime;
        musicTime = Math.max(0, timeSinceStageStart * 1000 + beatOffset);
      }
      const beatInterval = 60000 / state.currentBPM;
      const timeSinceLastBeat = musicTime % beatInterval;
      const beatWindow = beatInterval * 0.25; // 25% window (matches isInBeatWindow)
      const nextBeatIn = beatInterval - timeSinceLastBeat;
      const offsetDisplay =
        beatOffset !== 0
          ? ` | Offset: ${beatOffset >= 0 ? "+" : ""}${beatOffset.toFixed(0)}ms`
          : "";

      // NEW: Drift detection info
      const stageStartTime = state.stageStartTime || 0;
      const systemTime = performance.now() / 1000 - stageStartTime;
      const expectedMusicTime = systemTime * 1000;
      const drift = rawMusicTime - expectedMusicTime;
      const driftDisplay =
        Math.abs(drift) > 10
          ? ` | Drift: ${drift >= 0 ? "+" : ""}${drift.toFixed(0)}ms`
          : "";

      // NEW: Beat alignment info
      const currentBeat = Math.floor(musicTime / beatInterval);
      const beatInBar = currentBeat % 4;
      const beatStatus = "🟢 ACTIVE"; // All beats are now active for beatmatch

      return `
        <div style="margin-top:8px; font-size:9px; border-top:1px solid #333; padding-top:4px; color:#888;">
          <div>🎵 BPM: ${state.currentBPM} | Beat every ${beatInterval.toFixed(
        0
      )}ms | Window: ±${beatWindow.toFixed(
        0
      )}ms${offsetDisplay}${driftDisplay}</div>
          <div>⏱️ Music: ${(musicTime / 1000).toFixed(
            2
          )}s | Since beat: ${timeSinceLastBeat.toFixed(
        0
      )}ms | Next: ${nextBeatIn.toFixed(0)}ms</div>
          <div>🎯 Beat: ${currentBeat} (${
        beatInBar + 1
      }/4) | ${beatStatus}</div>
        </div>
      `;
    }

    // Debug Modal nur anzeigen wenn showModal aktiviert ist
    if (state.debug.showModal) {
      overlay.innerHTML = `
        <div>🎮 Gamepads: ${padCount} connected</div>
        <div>P1: ${p1Pad !== null ? `Pad ${p1Pad}` : "Keyboard"}</div>
        <div>P2: ${p2Pad !== null ? `Pad ${p2Pad}` : "Not connected"}</div>
        <div style="margin-top:8px; font-size:12px; font-weight:bold; color:${beatColor};">${beatText}</div>
        <div style="margin-top:4px; font-size:10px; color:${statusColor}; font-weight:bold;">${statusText}</div>
        <div style="margin-top:4px; font-size:10px;">Press H to toggle hitboxes | M for music | N for metronome | Alt+P to spawn NPC | P to toggle NPC | I for dev mode | B for beat align | V for beat sync debug | T for beat sync toggle | F for FPS multiplier | Q to hide debug</div>
        ${
          state.metronome.enabled
            ? `<div style="margin-top:4px; font-size:10px; color:#ff0; background:rgba(255,255,0,${
                state.metronome.visualPulse * 0.5
              }); padding:2px 6px; border-radius:3px;">🎵 METRONOME: ${
                state.currentBPM
              } BPM</div>`
            : ""
        }
        ${
          window.NPCController?.isEnabled()
            ? `<div style="margin-top:4px; font-size:10px; color:#0ff; background:rgba(0,255,255,0.2); padding:2px 6px; border-radius:3px;">🤖 NPC ACTIVE (P2)</div>`
            : ""
        }
        ${
          state.debug?.devMode
            ? `<div style="margin-top:4px; font-size:10px; color:#f0f; background:rgba(255,0,255,0.3); padding:2px 6px; border-radius:3px;">🛠️ DEV MODE: Instant Ultimeter</div>`
            : ""
        }
      `;
    } else {
      overlay.innerHTML = "";
    }
  }

  function handleResize() {
    const C = GameState.CONSTANTS;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    const ratio = C.NATIVE_WIDTH / C.NATIVE_HEIGHT;
    let newWidth = screenWidth;
    let newHeight = newWidth / ratio;

    if (newHeight > screenHeight) {
      newHeight = screenHeight;
      newWidth = newHeight * ratio;
    }

    // Canvas für WebGL vorbereiten
    canvas.width = newWidth;
    canvas.height = newHeight;

    // Set CSS dimensions to match internal resolution (prevents stretching)
    // This maintains aspect ratio and allows black bars (letterboxing) to appear
    canvas.style.width = newWidth + "px";
    canvas.style.height = newHeight + "px";

    // WebGL Canvas Attribute setzen
    canvas.style.imageRendering = "pixelated";
    canvas.style.imageRendering = "crisp-edges";

    // Stelle sicher, dass Canvas WebGL-fähig ist
    console.log("Canvas resized to:", newWidth, "x", newHeight);

    // Store the viewport info for the renderer
    // Note: viewport.x and viewport.y are 0 since canvas is centered by CSS (#root with place-items: center)
    state.viewport = {
      width: newWidth,
      height: newHeight,
      x: 0, // Canvas is centered by CSS, no translation needed
      y: 0, // Canvas is centered by CSS, no translation needed
    };
  }

  // --- Gamepad Helper Functions ---
  const gamepadState = {
    prevButtons: [{}, {}], // Previous button states for P1 and P2
    prevDpad: [{}, {}], // Previous D-Pad states
    prevStick: [{}, {}], // Previous stick states for edge detection
  };

  function getGamepadButtonPressed(gamepadIndex, buttonIndex) {
    const gamepads = navigator.getGamepads();
    const gp = gamepads[gamepadIndex];
    if (!gp) return false;

    const pressed = gp.buttons[buttonIndex]?.pressed || false;
    const wasPressed =
      gamepadState.prevButtons[gamepadIndex][buttonIndex] || false;
    gamepadState.prevButtons[gamepadIndex][buttonIndex] = pressed;

    return pressed && !wasPressed; // Edge detection
  }

  function getGamepadAxis(gamepadIndex, axisIndex, deadzone = 0.3) {
    const gamepads = navigator.getGamepads();
    const gp = gamepads[gamepadIndex];
    if (!gp) return 0;

    const value = gp.axes[axisIndex] || 0;
    return Math.abs(value) > deadzone ? value : 0;
  }

  function getGamepadAxisPressed(
    gamepadIndex,
    axisIndex,
    direction,
    deadzone = 0.5
  ) {
    // direction: 1 = positive (right/down), -1 = negative (left/up)
    const value = getGamepadAxis(gamepadIndex, axisIndex, deadzone);
    const isPressed = direction > 0 ? value > deadzone : value < -deadzone;
    const wasPressed =
      gamepadState.prevStick[gamepadIndex][`${axisIndex}_${direction}`] ||
      false;
    gamepadState.prevStick[gamepadIndex][`${axisIndex}_${direction}`] =
      isPressed;

    return isPressed && !wasPressed; // Edge detection
  }

  function getGamepadDPad(gamepadIndex, direction) {
    // direction: "left" = 14, "right" = 15, "up" = 12, "down" = 13
    const buttonMap = { left: 14, right: 15, up: 12, down: 13 };
    return getGamepadButtonPressed(gamepadIndex, buttonMap[direction]);
  }

  // --- NEW: Input handlers for selection screens ---
  function handleTitleScreenInput() {
    const pressed = state.input.keysPressed;
    const anyKeyPressed = pressed.size > 0;

    // Check for gamepad input (any button on any pad)
    const gamepads = navigator.getGamepads();
    let gamepadPressed = false;
    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];
      if (gp && gp.buttons.some((btn) => btn.pressed)) {
        gamepadPressed = true;
        break;
      }
    }

    if (anyKeyPressed || gamepadPressed) {
      if (!state.titleScreen.introPlayed) {
        // Start title intro transition
        state.titleScreen.introPlayed = true;
        startTitleIntroTransition(state);
      }
    }

    InputHandler.clearInputEdges(state);
  }

  function handleCharacterSelectInput() {
    // If modal is open, don't process character selection input
    // Let handleModalInput() handle it instead
    if (state.modal.isOpen || state.modal.controlsModal.isOpen) {
      return;
    }

    const kd = state.input.keysDown;
    const pressed = state.input.keysPressed;
    const charList = Object.keys(state.selection.characters);
    const cols = 3; // 3 columns grid
    const rows = Math.ceil(charList.length / cols);

    // Helper function to navigate in grid
    function navigateGrid(currentIndex, direction, charList) {
      const rows = Math.ceil(charList.length / cols);
      const row = Math.floor(currentIndex / cols);
      const col = currentIndex % cols;

      let newRow = row;
      let newCol = col;

      if (direction === "right") {
        newCol = (col + 1) % cols;
      } else if (direction === "left") {
        newCol = (col - 1 + cols) % cols;
      } else if (direction === "down") {
        newRow = (row + 1) % rows;
      } else if (direction === "up") {
        newRow = (row - 1 + rows) % rows;
      }

      const newIndex = newRow * cols + newCol;
      return newIndex < charList.length ? newIndex : currentIndex;
    }

    const isIndexDisabled = (index) => {
      const charName = charList[index];
      if (!charName) return false;
      return !!state.selection.characters[charName]?.disabled;
    };

    function moveIndexSkippingDisabled(currentIndex, direction) {
      let nextIndex = navigateGrid(currentIndex, direction, charList);
      let safety = 0;

      while (
        nextIndex !== currentIndex &&
        isIndexDisabled(nextIndex) &&
        safety < charList.length
      ) {
        currentIndex = nextIndex;
        nextIndex = navigateGrid(currentIndex, direction, charList);
        safety++;
      }

      if (isIndexDisabled(nextIndex)) {
        return currentIndex;
      }

      return nextIndex;
    }

    // Check if only one controller is connected
    const padCount = state.input.connectedGamepads.size;
    const onlyOneController = padCount <= 1;

    // Player 1 - Keyboard + Gamepad 0
    if (!state.selection.p1Locked) {
      // Navigate right
      const p1Right =
        pressed.has("ArrowRight") ||
        getGamepadDPad(0, "right") ||
        getGamepadAxisPressed(0, 0, 1); // L-Stick right

      // Navigate left
      const p1Left =
        pressed.has("ArrowLeft") ||
        getGamepadDPad(0, "left") ||
        getGamepadAxisPressed(0, 0, -1); // L-Stick left

      // Navigate down
      const p1Down =
        pressed.has("ArrowDown") ||
        getGamepadDPad(0, "down") ||
        getGamepadAxisPressed(0, 1, 1); // L-Stick down

      // Navigate up
      const p1Up =
        pressed.has("ArrowUp") ||
        getGamepadDPad(0, "up") ||
        getGamepadAxisPressed(0, 1, -1); // L-Stick up

      // Confirm - UNIFIED: B button
      const p1Confirm = pressed.has(" ") || getGamepadButtonPressed(0, 1); // B button (Circle on PS)

      if (p1Right) {
        state.selection.p1CharIndex = moveIndexSkippingDisabled(
          state.selection.p1CharIndex,
          "right"
        );
      }
      if (p1Left) {
        state.selection.p1CharIndex = moveIndexSkippingDisabled(
          state.selection.p1CharIndex,
          "left"
        );
      }
      if (p1Down) {
        state.selection.p1CharIndex = moveIndexSkippingDisabled(
          state.selection.p1CharIndex,
          "down"
        );
      }
      if (p1Up) {
        state.selection.p1CharIndex = moveIndexSkippingDisabled(
          state.selection.p1CharIndex,
          "up"
        );
      }
      if (p1Confirm) {
        const selectedChar = charList[state.selection.p1CharIndex];
        const charData = state.selection.characters[selectedChar];
        if (charData?.disabled) {
          console.warn(
            `[Character Select] P1 attempted to pick disabled character '${selectedChar}'.`
          );
        } else {
          state.selection.p1Locked = true;
          state.selectedCharacters[0] = selectedChar;
        }
      }
    }

    // Player 2 - Keyboard + Gamepad 1
    // NEW: If only one controller and P1 is locked, allow P1 to also select P2
    if (!state.selection.p2Locked) {
      // If only one controller and P1 is locked, use P1's controller for P2 selection
      const useP1Controller = onlyOneController && state.selection.p1Locked;
      // Navigate right
      const p2Right = useP1Controller
        ? pressed.has("ArrowRight") ||
          getGamepadDPad(0, "right") ||
          getGamepadAxisPressed(0, 0, 1)
        : pressed.has("ArrowRight") ||
          getGamepadDPad(1, "right") ||
          getGamepadAxisPressed(1, 0, 1); // L-Stick right

      // Navigate left
      const p2Left = useP1Controller
        ? pressed.has("ArrowLeft") ||
          getGamepadDPad(0, "left") ||
          getGamepadAxisPressed(0, 0, -1)
        : pressed.has("ArrowLeft") ||
          getGamepadDPad(1, "left") ||
          getGamepadAxisPressed(1, 0, -1); // L-Stick left

      // Navigate down
      const p2Down = useP1Controller
        ? pressed.has("ArrowDown") ||
          getGamepadDPad(0, "down") ||
          getGamepadAxisPressed(0, 1, 1)
        : pressed.has("ArrowDown") ||
          getGamepadDPad(1, "down") ||
          getGamepadAxisPressed(1, 1, 1); // L-Stick down

      // Navigate up
      const p2Up = useP1Controller
        ? pressed.has("ArrowUp") ||
          getGamepadDPad(0, "up") ||
          getGamepadAxisPressed(0, 1, -1)
        : pressed.has("ArrowUp") ||
          getGamepadDPad(1, "up") ||
          getGamepadAxisPressed(1, 1, -1); // L-Stick up

      // Confirm - UNIFIED: B button
      const p2Confirm = useP1Controller
        ? pressed.has(" ") || getGamepadButtonPressed(0, 1)
        : getGamepadButtonPressed(1, 1); // B button

      if (p2Right) {
        state.selection.p2CharIndex = moveIndexSkippingDisabled(
          state.selection.p2CharIndex,
          "right"
        );
      }
      if (p2Left) {
        state.selection.p2CharIndex = moveIndexSkippingDisabled(
          state.selection.p2CharIndex,
          "left"
        );
      }
      if (p2Down) {
        state.selection.p2CharIndex = moveIndexSkippingDisabled(
          state.selection.p2CharIndex,
          "down"
        );
      }
      if (p2Up) {
        state.selection.p2CharIndex = moveIndexSkippingDisabled(
          state.selection.p2CharIndex,
          "up"
        );
      }
      if (p2Confirm) {
        const selectedChar = charList[state.selection.p2CharIndex];
        const charData = state.selection.characters[selectedChar];
        if (charData?.disabled) {
          console.warn(
            `[Character Select] P2 attempted to pick disabled character '${selectedChar}'.`
          );
        } else {
          state.selection.p2Locked = true;
          state.selectedCharacters[1] = selectedChar;
        }
      }
    }

    // Back button (Y button or Backspace) - UNIFIED: Y for back everywhere
    const p1Back = pressed.has("Backspace") || getGamepadButtonPressed(0, 3); // Y button (Triangle on PS)
    const p2Back = getGamepadButtonPressed(1, 3); // Y button (Triangle on PS)
    // If only one controller and P1 is selecting P2, allow P1's back button to unlock P2
    const p2BackFromP1 =
      onlyOneController &&
      state.selection.p1Locked &&
      state.selection.p2Locked &&
      p1Back;

    if (state.selection.p1Locked && p1Back && !p2BackFromP1) {
      state.selection.p1Locked = false;
    }
    if (state.selection.p2Locked && (p2Back || p2BackFromP1)) {
      state.selection.p2Locked = false;
    }

    // Return to game type selection if both players are unlocked and back is pressed
    if (
      !state.selection.p1Locked &&
      !state.selection.p2Locked &&
      (p1Back || p2Back)
    ) {
      state.gameMode = "GAME_TYPE_SELECT";
      // Reset character selection state
      state.selection.p1Locked = false;
      state.selection.p2Locked = false;
      InputHandler.clearInputEdges(state);
      return;
    }

    // NEW: Story mode - P2 can join with Start button
    if (state.isStoryMode && !state.selection.p2Locked) {
      // Check for Start button on any gamepad to add P2
      const p2Start =
        getGamepadButtonPressed(0, 9) || getGamepadButtonPressed(1, 9);
      if (p2Start) {
        // P2 joins - use same character as P1 or default
        const p1Char = state.selectedCharacters[0] || charList[0];
        state.selection.p2CharIndex = state.selection.p1CharIndex;
        state.selection.p2Locked = true;
        state.selectedCharacters[1] = p1Char;
        console.log("P2 joined Story Mode");
      }
    }

    // Direct transition: Training mode -> start game immediately, Story mode -> start story, Normal mode -> stage select
    // (but only if neither pressed back)
    if (state.selection.p1Locked && !p1Back && !p2Back) {
      if (state.isTrainingMode) {
        // Training mode: P1 locked -> start training stage immediately
        const trainingStagePath =
          "levels/sidescroller/ninja_stage/sections/training_stage";
        state.gameMode = "LOADING";
        InputHandler.clearInputEdges(state);
        startGame(trainingStagePath);
        return; // Exit early to prevent double input clear
      } else if (state.isStoryMode) {
        // Story mode (Tutorial): P1 locked -> start tutorial stage
        const tutorialStagePath =
          "levels/sidescroller/ninja_stage/sections/pvp_stage_tutorial_scaled";
        state.gameMode = "LOADING";
        InputHandler.clearInputEdges(state);
        startGame(tutorialStagePath);
        return; // Exit early to prevent double input clear
      } else if (state.selection.p2Locked) {
        // Normal mode: both players locked -> stage select
        state.gameMode = "STAGE_SELECT";
        // Menu loop continues playing (no need to stop/restart)
        InputHandler.clearInputEdges(state);
        return; // Exit early to prevent double input clear
      }
    }

    InputHandler.clearInputEdges(state);
  }

  function handleStageSelectInput() {
    // If modal is open, don't process stage selection input
    // Let handleModalInput() handle it instead
    if (state.modal.isOpen || state.modal.controlsModal.isOpen) {
      return;
    }

    const pressed = state.input.keysPressed;
    const stageList = Object.keys(state.selection.stages);
    const cols = 5; // Stages are displayed in a 5-column grid

    // Navigate right (keyboard or any gamepad) - UNIFIED: L-Stick navigation
    const navRight =
      pressed.has("ArrowRight") ||
      getGamepadDPad(0, "right") ||
      getGamepadDPad(1, "right") ||
      getGamepadAxisPressed(0, 0, 1) ||
      getGamepadAxisPressed(1, 0, 1);

    // Navigate left (keyboard or any gamepad) - UNIFIED: L-Stick navigation
    const navLeft =
      pressed.has("ArrowLeft") ||
      getGamepadDPad(0, "left") ||
      getGamepadDPad(1, "left") ||
      getGamepadAxisPressed(0, 0, -1) ||
      getGamepadAxisPressed(1, 0, -1);

    // Navigate down (keyboard or any gamepad)
    const navDown =
      pressed.has("ArrowDown") ||
      getGamepadDPad(0, "down") ||
      getGamepadDPad(1, "down") ||
      getGamepadAxisPressed(0, 1, 1) ||
      getGamepadAxisPressed(1, 1, 1);

    // Navigate up (keyboard or any gamepad)
    const navUp =
      pressed.has("ArrowUp") ||
      getGamepadDPad(0, "up") ||
      getGamepadDPad(1, "up") ||
      getGamepadAxisPressed(0, 1, -1) ||
      getGamepadAxisPressed(1, 1, -1);

    // Confirm (keyboard or any gamepad) - UNIFIED: B button
    const confirm =
      pressed.has(" ") ||
      pressed.has("Enter") ||
      getGamepadButtonPressed(0, 1) ||
      getGamepadButtonPressed(1, 1);

    // Back button - UNIFIED: Y button (ESC now opens modal, so remove ESC from here)
    const back =
      pressed.has("Backspace") ||
      getGamepadButtonPressed(0, 3) ||
      getGamepadButtonPressed(1, 3);

    if (navRight) {
      state.selection.stageIndex =
        (state.selection.stageIndex + 1) % stageList.length;
    }
    if (navLeft) {
      state.selection.stageIndex =
        (state.selection.stageIndex - 1 + stageList.length) % stageList.length;
    }
    if (navDown) {
      // Move down one row (5 columns per row)
      const newIndex = state.selection.stageIndex + cols;
      state.selection.stageIndex =
        newIndex < stageList.length ? newIndex : state.selection.stageIndex;
    }
    if (navUp) {
      // Move up one row (5 columns per row)
      const newIndex = state.selection.stageIndex - cols;
      state.selection.stageIndex =
        newIndex >= 0 ? newIndex : state.selection.stageIndex;
    }
    if (confirm) {
      // Transition to game mode select instead of starting game directly
      state.gameMode = "GAME_MODE_SELECT";
      state.selectedGameMode = "classic"; // Reset to classic by default
      // Stop menu loop - game mode select has no music
      AudioSystem.stopMusic(0.5);
    }
    if (back) {
      // Return to character select
      state.gameMode = "CHARACTER_SELECT";
      state.selection.p1Locked = false;
      state.selection.p2Locked = false;
      // Analytics: Track game mode change
      if (window.AnalyticsClient) {
        window.AnalyticsClient.trackEvent("game_mode_change", {
          mode: "CHARACTER_SELECT",
        });
      }
      // Restart menu loop when returning to character select
      AudioSystem.playTrack("MENU_LOOP");
    }

    InputHandler.clearInputEdges(state);
  }

  function handleGameTypeSelectInput() {
    const pressed = state.input.keysPressed;

    // Toggle type with L-Stick left/right (keyboard or gamepad)
    const toggleTypeLeft =
      pressed.has("ArrowLeft") ||
      getGamepadDPad(0, "left") ||
      getGamepadDPad(1, "left") ||
      getGamepadAxisPressed(0, 0, -1) ||
      getGamepadAxisPressed(1, 0, -1);

    const toggleTypeRight =
      pressed.has("ArrowRight") ||
      getGamepadDPad(0, "right") ||
      getGamepadDPad(1, "right") ||
      getGamepadAxisPressed(0, 0, 1) ||
      getGamepadAxisPressed(1, 0, 1);

    // Confirm (keyboard or any gamepad) - UNIFIED: B button
    // Check cooldown to prevent accidental confirmation after intro skip
    const confirmCooldownActive =
      (state.inputCooldown?.confirmCooldown || 0) > 0;
    const confirm =
      !confirmCooldownActive &&
      (pressed.has(" ") ||
        pressed.has("Enter") ||
        getGamepadButtonPressed(0, 1) ||
        getGamepadButtonPressed(1, 1));

    // Back button - UNIFIED: Y button
    const back =
      pressed.has("Backspace") ||
      getGamepadButtonPressed(0, 3) ||
      getGamepadButtonPressed(1, 3);

    if (toggleTypeLeft || toggleTypeRight) {
      state.gameTypeSelection.selectedType =
        state.gameTypeSelection.selectedType === "pvp" ? "story" : "pvp";
      console.log(
        `Game type switched to: ${state.gameTypeSelection.selectedType}`
      );
    }

    if (confirm) {
      const selectedType = state.gameTypeSelection.selectedType;
      console.log(`Starting ${selectedType} mode`);

      if (selectedType === "story") {
        // Tutorial mode: go directly to character select
        state.gameMode = "CHARACTER_SELECT";
        state.isStoryMode = true; // Keep flag name for compatibility
        // Reset character selection state
        state.selection.p1Locked = false;
        state.selection.p2Locked = false;
      } else {
        // PvP mode: go to character select (then stage select)
        state.gameMode = "CHARACTER_SELECT";
        state.isStoryMode = false;
        // Reset character selection state
        state.selection.p1Locked = false;
        state.selection.p2Locked = false;
      }
    }

    if (back) {
      // Return to title intro
      state.gameMode = "TITLE_INTRO";
    }

    InputHandler.clearInputEdges(state);
  }

  function handleGameModeSelectInput() {
    const pressed = state.input.keysPressed;

    // Toggle mode with L-Stick left/right (keyboard or gamepad) - UNIFIED: L-Stick navigation
    const toggleModeLeft =
      pressed.has("ArrowLeft") ||
      getGamepadDPad(0, "left") ||
      getGamepadDPad(1, "left") ||
      getGamepadAxisPressed(0, 0, -1) ||
      getGamepadAxisPressed(1, 0, -1);

    const toggleModeRight =
      pressed.has("ArrowRight") ||
      getGamepadDPad(0, "right") ||
      getGamepadDPad(1, "right") ||
      getGamepadAxisPressed(0, 0, 1) ||
      getGamepadAxisPressed(1, 0, 1);

    // Confirm (keyboard or any gamepad) - UNIFIED: B button
    const confirm =
      pressed.has(" ") ||
      pressed.has("Enter") ||
      getGamepadButtonPressed(0, 1) ||
      getGamepadButtonPressed(1, 1);

    // Back button - UNIFIED: Y button (ESC now opens modal, so remove ESC from here)
    const back =
      pressed.has("Backspace") ||
      getGamepadButtonPressed(0, 3) ||
      getGamepadButtonPressed(1, 3);

    if (toggleModeLeft || toggleModeRight) {
      state.selectedGameMode =
        state.selectedGameMode === "classic" ? "dance" : "classic";
      console.log(`Game mode switched to: ${state.selectedGameMode}`);
    }

    if (confirm) {
      const selectedStageKey = Object.keys(state.selection.stages)[
        state.selection.stageIndex
      ];
      const stagePath = state.selection.stages[selectedStageKey].path;
      console.log(`Starting game with mode: ${state.selectedGameMode}`);
      // Analytics: Track stage selection
      if (window.AnalyticsClient) {
        window.AnalyticsClient.trackEvent("stage_selection", {
          stage: selectedStageKey,
          stagePath: stagePath,
        });
      }
      startGame(stagePath);
    }

    if (back) {
      // Return to stage select
      state.gameMode = "STAGE_SELECT";
    }

    InputHandler.clearInputEdges(state);
  }

  // NEW: Title intro transition functions
  function startTitleIntroTransition(state) {
    state.titleIntro.isActive = true;
    state.titleIntro.startTime = state.lastTime;
    state.titleIntro.currentFrame = 0;
    state.titleIntro.frameTime = 0; // Reset frame accumulator
    state.gameMode = "TITLE_INTRO";

    // Play menu loop music (loops continuously)
    AudioSystem.playTrack("MENU_LOOP");
  }

  function updateTitleIntroAnimation(dt) {
    if (!state.titleIntro.isActive) return;

    // Update frame time accumulator (cap at music duration)
    state.titleIntro.frameTime = Math.min(
      state.titleIntro.frameTime + dt,
      12.0
    );

    // Calculate current loop and frame position
    const currentLoop = Math.floor(state.titleIntro.frameTime / (12.0 / 2)); // Each loop is 6 seconds (12s / 2 loops)
    const loopTime = state.titleIntro.frameTime % (12.0 / 2); // Time within current loop

    // Update loop count if it changed
    if (
      currentLoop !== state.titleIntro.loopCount &&
      currentLoop < state.titleIntro.maxLoops
    ) {
      state.titleIntro.loopCount = currentLoop;
      console.log(
        `Title intro loop ${currentLoop + 1}/${state.titleIntro.maxLoops}`
      );
    }

    // Determine speed multiplier and direction based on loop
    const speedMultiplier = state.titleIntro.loopCount === 0 ? 1 : 0.5; // Second loop is double speed
    const isReverseLoop = state.titleIntro.loopCount === 1; // Second loop plays backwards

    // Calculate current frame based on loop time with stutter effect
    let accumulatedTime = 0;
    let newFrame = 0;

    // For reverse loop, iterate backwards through frames
    const frameRange = isReverseLoop
      ? Array.from(
          { length: state.titleIntro.totalFrames },
          (_, i) => state.titleIntro.totalFrames - 1 - i
        )
      : Array.from({ length: state.titleIntro.totalFrames }, (_, i) => i);

    for (let i = 0; i < frameRange.length; i++) {
      const frameIndex = frameRange[i];

      // Determine frame duration based on whether it's a stutter frame and current loop speed
      const isStutterFrame =
        state.titleIntro.stutterFrames.includes(frameIndex);
      const baseFrameDuration = 12.0 / 16 / 2; // 0.375s base (doubled speed from original)
      const frameDuration = isStutterFrame
        ? baseFrameDuration * 2
        : baseFrameDuration;
      const adjustedFrameDuration = frameDuration / speedMultiplier; // Apply speed multiplier

      if (
        loopTime >= accumulatedTime &&
        loopTime < accumulatedTime + adjustedFrameDuration
      ) {
        newFrame = frameIndex;
        break;
      }

      accumulatedTime += adjustedFrameDuration;
    }

    // Update frame only if it changed and is within bounds (prevents flickering)
    if (
      newFrame !== state.titleIntro.currentFrame &&
      newFrame >= 0 &&
      newFrame < state.titleIntro.totalFrames
    ) {
      state.titleIntro.currentFrame = newFrame;
    }

    // Check if music duration is reached (12 seconds with fade to black)
    if (state.titleIntro.frameTime >= 12.0) {
      state.titleIntro.isActive = false;
      // Music end callback will handle transition to character select
    }
  }

  function handleTitleIntroInput() {
    if (!state.titleIntro.canSkip) return;

    const pressed = state.input.keysPressed;
    const anyKeyPressed = pressed.size > 0;

    // Check for gamepad input
    const gamepads = navigator.getGamepads();
    let gamepadPressed = false;
    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];
      if (gp && gp.buttons.some((btn) => btn.pressed)) {
        gamepadPressed = true;
        break;
      }
    }

    if (anyKeyPressed || gamepadPressed) {
      // Skip intro and go to game type selection
      state.titleIntro.isActive = false;
      state.gameMode = "GAME_TYPE_SELECT";
      // Set cooldown to prevent accidental confirmation
      state.inputCooldown.confirmCooldown = 0.3; // 300ms cooldown
      // Menu loop continues playing (no need to restart)
    }

    InputHandler.clearInputEdges(state);
  }

  // NEW: Animation functions for character selection flow
  function startCharacterSelectAnimation(state, player, charIndex) {
    const charList = Object.keys(state.selection.characters);
    const charName = charList[charIndex];

    // Create animation object
    const animation = {
      player: player,
      charIndex: charIndex,
      charName: charName, // e.g., "cyboard", "fritz", "hp", "charly"
      frame: 0,
      duration: 0,
      frameDuration: 0.2, // 0.2 seconds per frame (5 fps)
      fadeOutAlpha: 1.0,
      selectFrame: 0,
      selectMaxFrames: 4, // char_select animation has 4 frames
      isLooping: true, // Loops until both players confirm
    };

    if (player === "p1") {
      state.selection.p1SelectAnimation = animation;
    } else {
      state.selection.p2SelectAnimation = animation;
    }
  }

  function startCharacterSelectedAnimation(state) {
    // Stop looping select animations
    if (state.selection.p1SelectAnimation) {
      state.selection.p1SelectAnimation.isLooping = false;
    }
    if (state.selection.p2SelectAnimation) {
      state.selection.p2SelectAnimation.isLooping = false;
    }

    // Create final selected animation
    state.selection.selectedAnimation = {
      frame: 0,
      duration: 0,
      maxDuration: 1.6, // 1.6 seconds for 4 frames at 0.4s each (slower)
      frameDuration: 0.4, // 0.4 seconds per frame
      selectedFrame: 0,
      selectedMaxFrames: 4, // char_selected animation has 4 frames
      isComplete: false,
      p1CharName: state.selectedCharacters[0],
      p2CharName: state.selectedCharacters[1],
    };
  }

  function updateCharacterSelectAnimations(dt) {
    // Update P1 select animation (loops until both players confirm)
    if (state.selection.p1SelectAnimation) {
      const anim = state.selection.p1SelectAnimation;
      anim.duration += dt;

      // Calculate looping frame (0-3 repeating)
      anim.selectFrame =
        Math.floor(anim.duration / anim.frameDuration) % anim.selectMaxFrames;

      // Update fade-out alpha (used when P1 selects)
      anim.fadeOutAlpha = Math.max(
        0,
        1.0 - anim.duration * state.selection.fadeOutSpeed
      );
    }

    // Update P2 select animation (loops until both players confirm)
    if (state.selection.p2SelectAnimation) {
      const anim = state.selection.p2SelectAnimation;
      anim.duration += dt;

      // Calculate looping frame (0-3 repeating)
      anim.selectFrame =
        Math.floor(anim.duration / anim.frameDuration) % anim.selectMaxFrames;

      // Update fade-out alpha (used when P2 selects)
      anim.fadeOutAlpha = Math.max(
        0,
        1.0 - anim.duration * state.selection.fadeOutSpeed
      );
    }

    // Update selected animation (plays once, then transitions to stage select)
    if (
      state.selection.selectedAnimation &&
      !state.selection.selectedAnimation.isComplete
    ) {
      const anim = state.selection.selectedAnimation;
      anim.duration += dt;

      // Calculate frame (plays once, no loop)
      anim.selectedFrame = Math.min(
        Math.floor(anim.duration / anim.frameDuration),
        anim.selectedMaxFrames - 1
      );

      // Check if animation is complete
      if (anim.duration >= anim.maxDuration) {
        anim.isComplete = true;
        // Automatic transition to stage select
        state.gameMode = "STAGE_SELECT";
        // Stop character select music when entering stage select
        AudioSystem.stopMusic(0.5);
        // Analytics: Track game mode change and character selection
        if (window.AnalyticsClient) {
          window.AnalyticsClient.trackEvent("game_mode_change", {
            mode: "STAGE_SELECT",
          });
          window.AnalyticsClient.trackEvent("character_selection", {
            characters: state.selectedCharacters || [],
          });
        }
        console.log(
          "Character selected animation complete - transitioning to stage select"
        );
      }
    }
  }

  async function startGame(stagePath) {
    state.gameMode = "LOADING";
    overlay.textContent = "Loading stage…";

    // Safety: clear any leftover freeze frames or screen shake from previous session
    state.hitstop = 0;
    if (state.shake) {
      state.shake.x = 0;
      state.shake.y = 0;
      state.shake.duration = 0;
      state.shake.intensity = 0;
    }

    // Reset stage-specific camera metadata before loading new assets
    state.cameraBounds = null;
    state.stageMinZoom = 1.0;
    state.stageMaxZoom = 2.03125;
    state.stageDisableAutoZoom = false;
    state.stageHighRes = false;

    // NEW: Reset match end state when restarting
    if (state.matchEnd) {
      state.matchEnd.isActive = false;
      state.matchEnd.phase = "pending";
      state.matchEnd.winner = null;
      state.matchEnd.screenGrayAlpha = 0;
      state.matchEnd.modalSlideOffset = 0;
      state.matchEnd.beatCount = 0;
      state.matchEnd.audioFadeStartTime = 0;
      state.matchEnd.screenGrayStartTime = 0;
      state.matchEnd.modalShowStartTime = 0;
      state.matchEnd.lastKnownAliveIndex = null;
      console.log("🔄 Match end state reset for restart");
    }

    // NEW: Reset modal state
    state.modal.isOpen = false;
    state.modal.selectedButton = 0;

    try {
      await GameAssets.loadCharacterAssets(state);
      await GameAssets.loadGlobalFxAssets(state);
      await GameAssets.loadStageAssets(state, stagePath);

      // Performance: Warm up all spritesheets before match starts
      // This prevents stuttering on first sprite draw
      overlay.textContent = "Warming up graphics...";
      const warmupTime = await GameAssets.warmupSpritesheets(state);
      console.log(`🔥 Sprite warmup completed in ${warmupTime.toFixed(2)}ms`);

      // Performance: Initialize WebGL early (before first render frame)
      // This prevents WebGL init stutter on first frame
      if (typeof WebGLRenderer !== "undefined" && WebGLRenderer.init) {
        console.log("🎨 Initializing WebGL early (before first render)...");
        const webglInitResult = WebGLRenderer.init(canvas);
        if (webglInitResult) {
          state.webglInitialized = true;
          WebGLRenderer.setSnowEnabled(true);
          if (WebGLRenderer.warmupCollisionEffects) {
            WebGLRenderer.warmupCollisionEffects();
          }
          console.log("✅ WebGL initialized early");
        } else {
          state.webglInitialized = false;
          console.warn("⚠️ WebGL initialization failed");
        }
      }

      // Performance: Warm up Canvas2D context with a dummy render
      // This triggers first-time canvas operations before actual gameplay
      overlay.textContent = "Preparing render pipeline...";
      await warmupCanvasContext(ctx, canvas);

      // Performance: Warm up fonts to prevent first-frame stutter
      if (Renderer.warmupFonts) {
        Renderer.warmupFonts(ctx);
      }

      // Performance: AGGRESSIVE gameplay warmup - pre-compile all critical code paths
      overlay.textContent = "Warming up gameplay systems...";
      await warmupGameplaySystems(state, ctx, canvas);
      console.log("✅ Gameplay warmup complete");

      // Reset frame counter for delta clamping (important for restarts)
      frameCount = 0;

      const spawns = state.spawnPoints;
      // Story mode: 1 player if P2 didn't join, 2 if P2 joined
      // Training mode: 1 player
      // PvP mode: 2 players
      const playerCount = state.isTrainingMode
        ? 1
        : state.isStoryMode && !state.selection.p2Locked
        ? 1
        : 2;

      // Ensure we have enough spawn points
      while (spawns.length < playerCount) {
        spawns.push({
          x:
            (spawns.length === 0 ? canvas.width * 0.25 : canvas.width * 0.75) |
            0,
          y: (canvas.height * 0.5) | 0,
        });
      }

      // In training mode or story mode solo, use only the first spawn point (center-left)
      const activeSpawns =
        state.isTrainingMode || (state.isStoryMode && playerCount === 1)
          ? [spawns[0]]
          : spawns.slice(0, playerCount);

      state.spawnPoints = activeSpawns.map((s) => ({ ...s }));
      state.players = activeSpawns.map((s, i) => {
        const charName = state.selectedCharacters[i];
        return Physics.createPlayer(state, charName, s, i);
      });

      // NEW: Reset all player states for clean restart
      state.players.forEach((player, index) => {
        player.lives = 3; // Reset lives
        player.eliminated = false; // Reset elimination status
        player.percent = 0; // Reset damage percentage
        player.pos = { ...state.spawnPoints[index] }; // Reset position
        player.vel = { x: 0, y: 0 }; // Reset velocity
        player.onGround = false; // Reset ground state
        player.facing = index === 0 ? 1 : -1; // Reset facing direction
        player.isInvincible = true; // Spawn protection
        player.respawnInvincibilityTimer = 2.0; // 2 seconds grace period
        player.isMovable = true; // Ensure player can move
        player.respawnState = "none"; // Ensure not stuck in respawn state
        console.log(
          `🔄 Player ${index + 1} (${player.charName}) reset for restart`
        );
      });

      // NEW: Set BPM and Music based on stage config
      const stageKey = Object.keys(state.selection.stages).find(
        (key) => state.selection.stages[key].path === stagePath
      );
      if (stageKey) {
        const stageConfig = state.selection.stages[stageKey];
        state.currentBPM = stageConfig.bpm || 117; // Default to 117 if not specified
        state.currentStageMusic = stageConfig.music || "NINJA_STAGE";
        state.currentBeatOffset = stageConfig.beatOffset || 0; // Offset in ms to sync beats
        state.currentStagePath = stagePath; // Store current stage path for restart functionality
        console.log(
          `🎵 Stage config: ${stageConfig.name} - ${state.currentBPM} BPM - Music: ${state.currentStageMusic} - Offset: ${state.currentBeatOffset}ms`
        );
        if (
          typeof WebGLRenderer !== "undefined" &&
          WebGLRenderer.setColorFilter
        ) {
          WebGLRenderer.setColorFilter(stageConfig.colorFilter || null);
        }
      } else if (
        typeof WebGLRenderer !== "undefined" &&
        WebGLRenderer.setColorFilter
      ) {
        WebGLRenderer.setColorFilter(null);
      }

      // NEW: Add permanent stage effects based on the loaded stage using bgLayer system
      if (state.stageFxAtlas) {
        let stageAnimationName = null;
        let stageAnimationPos = { x: 1100, y: 400 };
        let stageAnimationScale = 0.5;

        // Determine stage-specific animation and settings
        if (stagePath.includes("pvp_stage_2")) {
          stageAnimationName = "fx_stage_sound";
          stageAnimationPos = { x: 1100, y: 400 };
          stageAnimationScale = 0.5;
        } else if (stagePath.includes("pvp_stage_3")) {
          // Stage 3 with 2x FPS multiplier for faster animation
          stageAnimationName = "fx_stage_sound";
          stageAnimationPos = { x: 1000, y: 450 };
          stageAnimationScale = 0.4;
        } else if (stagePath.includes("pvp_stage_tutorial_scaled")) {
          // Tutorial stage uses same animations as stage 3
          stageAnimationName = "fx_stage_3";
          stageAnimationPos = { x: 1200, y: 350 };
          stageAnimationScale = 0.6;
        } else if (stagePath.includes("pvp_stage")) {
          // Default pvp_stage (stage 1)
          stageAnimationName = "fx_stage_sound";
          stageAnimationPos = { x: 1000, y: 450 };
          stageAnimationScale = 0.4;
        }

        // Spawn stage animation on bgLayer if animation exists
        if (
          stageAnimationName &&
          state.stageFxAtlas.animations[stageAnimationName]
        ) {
          console.log(
            `🎬 Spawning stage animation '${stageAnimationName}' for ${stagePath}`
          );
          Physics.spawnStageAnimation(
            state,
            stageAnimationName,
            stageAnimationPos,
            {
              scale: stageAnimationScale,
              isLooped: true,
              speed: 1.0,
              offsetX: 0,
              offsetY: 0,
              beatSync: true, // NEW: Enable beat synchronization
              fpsMultiplier: 2, // 2x FPS for all stage animations
            }
          );
        } else if (stageAnimationName) {
          console.warn(
            `⚠️ Stage animation '${stageAnimationName}' not found in stageFxAtlas for ${stagePath}`
          );
        }
      }

      // NEW: Initialize Tutorial Mode if tutorial stage
      if (stagePath.includes("pvp_stage_tutorial_scaled")) {
        console.log("[Tutorial] Initializing tutorial mode...");
        state.tutorial.active = true;
        state.tutorial.part = 1;
        state.tutorial.perfectBeatCount = 0;
        state.tutorial.danceSpotActive = false;
        state.tutorial.uiVisible = false; // UI starts hidden
        state.tutorial.musicFadedIn = false; // Music starts silent
        state.tutorial.proximityAlpha = 0; // Proximity-based fade (0-1)

        // Initialize Part 1 intro modal
        if (window.TutorialSystem) {
          window.TutorialSystem.startPartOneIntro(state);
        }

        // Set BPM to 80 for tutorial
        state.currentBPM = 80;
        state.currentStageMusic = "PVP_STAGE_TUTORIAL";
        console.log(
          `[Tutorial] BPM set to 80, Music: ${state.currentStageMusic}`
        );

        // Spawn tutorial dance spots (only DANCE_SPOT_D color)
        if (state.specialData && state.stageFxAtlas) {
          Physics.spawnTutorialDanceSpots(state);
        }
      }

      // NEW: Spawn stage animations based on special heatmap green pixels
      if (state.specialData && state.stageFxAtlas) {
        // Reset stage animation state to avoid duplicates on restart/reload
        state.stageAnimations = [];
        state.stageAnimationsFromHeatmapSpawned = false;
        state.spawnedStageAnimKeys = new Set();
        Physics.spawnStageAnimationsFromHeatmap(state);
      }

      // NEW: Initialize Dance Mode if selected OR always if special data or zone data exists (Global Mechanic)
      if (state.specialData || state.zoneData) {
        if (window.DanceSpotManager) {
          window.DanceSpotManager.init(state);
        }
      }

      if (state.selectedGameMode === "dance") {
        console.log("[Dance Mode] Initializing dance mode...");
        state.danceMode.active = true;
        state.danceMode.p1Score = 0;
        state.danceMode.p2Score = 0;
        state.danceMode.currentActiveSpot = null;
        state.danceMode.availableSpots = [];
        state.danceMode.lastScoreFrame = -1;
        // NEW: Initialize 4-Beat-System Tracking
        state.danceMode.p1PerfectBeatCount = 0;
        state.danceMode.p2PerfectBeatCount = 0;
        state.danceMode.p1SpotIds = [];
        state.danceMode.p2SpotIds = [];

        // Set players to infinite lives
        state.players.forEach((player) => {
          player.lives = 999;
        });

        // NEW: Initialize Dance Mode audio filter (start at 400Hz)
        if (window.AudioSystem && window.AudioSystem.setMainFilter) {
          window.AudioSystem.setMainFilter(1800, 0.5, 2); // Priority 2 to override battle mode
          console.log("[Dance Mode] Audio filter initialized at 1800Hz");
        }

        // Spawn dance spots from heatmap (supports both zoneData and specialData)
        if ((state.zoneData || state.specialData) && state.stageFxAtlas) {
          Physics.spawnDanceSpotsFromHeatmap(state);
          Physics.selectRandomActiveSpot(state);
        } else {
          console.error(
            "[Dance Mode] Cannot initialize - missing zone/special heatmap or stage atlas"
          );
        }
      }

      // NEW: Initialize Tutorial Part 2 (Combat) if pvp_stage_2
      if (stagePath.includes("pvp_stage_2") && state.tutorial?.active) {
        console.log(
          "[Tutorial] Initializing tutorial mode (Part 2: Combat Basics on PvP Stage 2)..."
        );
        state.tutorial.part = 2;
        state.tutorial.step = 1; // Start at step 1 (test all 4 attacks alone)
        state.tutorial.perfectBeatCount = 0;

        // IMPORTANT: Make UI permanently visible in Part 2 (like normal PvP)
        state.uiVisible = true;
        state.tutorial.uiVisible = true;
        state.tutorial.proximityAlpha = 1; // Force full alpha

        // CRITICAL FIX: Disable danceMode.active for Tutorial Part 2
        // The DanceSpotManager.update() overwrites proximityAlpha every frame based on player position!
        // By disabling danceMode.active, the update() stops running and the UI stays visible.
        if (state.danceMode) {
          state.danceMode.active = false; // DISABLE dance mode proximity fade
          state.danceMode.proximityAlpha = 1; // Force full alpha
          console.log(
            "[Tutorial Part 2] Dance mode DISABLED to prevent UI fade"
          );
        }

        // CRITICAL: Reset victoryDance from Part 1 - it was blocking UI rendering!
        if (state.tutorial.victoryDance) {
          state.tutorial.victoryDance.active = false;
          state.tutorial.victoryDance.phase = "none";
          console.log(
            "[Tutorial Part 2] Victory dance RESET (was blocking UI)"
          );
        }

        console.log("[Tutorial Part 2] UI set to permanently visible", {
          uiVisible: state.uiVisible,
          tutorialUiVisible: state.tutorial.uiVisible,
          tutorialProximityAlpha: state.tutorial.proximityAlpha,
          danceModeActive: state.danceMode?.active,
          danceModeProximityAlpha: state.danceMode?.proximityAlpha,
        });

        // Reset step data for Part 2
        if (window.TutorialSystem?.resetCombatSteps) {
          window.TutorialSystem.resetCombatSteps(state);
        }

        // Instruction panel removed - using unified modal system instead

        // Initialize Part 2 intro modal
        if (window.TutorialSystem) {
          window.TutorialSystem.startPartTwoIntro(state);
        }

        // CRITICAL: Set camera to center of stage during freeze
        // This prevents stage boundaries and off-zones from being visible
        if (state.camera) {
          // pvp_stage_2 is 2500x1380 - center the camera on the stage
          const stageWidth = state.cameraBounds?.width || 2500;
          const stageHeight = state.cameraBounds?.height || 1380;
          state.camera.x = stageWidth / 2; // 1250
          state.camera.y = stageHeight / 2; // 690
          state.camera.zoom = 1.0; // Use default zoom to show stage properly
          console.log("[Tutorial Part 2] Camera centered on stage:", {
            x: state.camera.x,
            y: state.camera.y,
            zoom: state.camera.zoom,
          });
        }

        // Check if P2 already exists (2 human players) or needs NPC spawn
        const hasP2 =
          state.players.length >= 2 &&
          state.players[1] &&
          !state.players[1].eliminated;

        if (hasP2) {
          // 2 human players - no NPC needed, no NPC Controller
          console.log("[Tutorial Part 2] 2 human players detected - P1 vs P2");
          // Ensure NPC Controller is disabled
          if (window.NPCController && window.NPCController.isEnabled()) {
            window.NPCController.disable();
            console.log(
              "[Tutorial Part 2] NPC Controller disabled (2 human players)"
            );
          }
        } else {
          // 1 player - NPC will be spawned in Step 2 (passive) and Step 3 (active)
          // For now, just ensure NPC Controller is disabled
          console.log(
            "[Tutorial Part 2] 1 player detected - NPC will be spawned in later steps"
          );
          if (window.NPCController && window.NPCController.isEnabled()) {
            window.NPCController.disable();
            console.log(
              "[Tutorial Part 2] NPC Controller disabled (will be enabled in Step 3)"
            );
          }
        }
      }

      // NEW: Initialize Tutorial Part 3 (Advanced Rhythm) if pvp_stage_3
      if (stagePath.includes("pvp_stage_3") && state.tutorial?.active) {
        console.log(
          "[Tutorial] Initializing tutorial mode (Part 3: Advanced Rhythm)..."
        );
        state.tutorial.part = 3;
        state.tutorial.perfectBeatCount = 0;

        // NEW: Enable Dance Mode for Part 3 (for UI fade and dance spots)
        if (state.danceMode) {
          state.danceMode.active = true;
          state.danceMode.proximityAlpha = 1.0; // Start visible, let manager update it
          console.log(
            "[Tutorial Part 3] Dance mode ENABLED for UI fade and spots"
          );

          // Ensure spots are spawned if missing
          if (
            (!state.danceMode.spots || state.danceMode.spots.length === 0) &&
            state.specialData
          ) {
            if (window.Physics && window.Physics.spawnDanceSpotsFromHeatmap) {
              window.Physics.spawnDanceSpotsFromHeatmap(state);
              window.Physics.selectRandomActiveSpot(state);
              console.log("[Tutorial Part 3] Spawned dance spots from heatmap");
            }
          }
        }

        // Instruction panel removed - using unified modal system instead

        if (window.TutorialSystem?.resetPartThreeState) {
          window.TutorialSystem.resetPartThreeState(state);
        }

        // Initialize tutorial part 3 intro modal
        if (window.TutorialSystem) {
          window.TutorialSystem.startPartThreeIntro(state);
        }

        // Disable NPC Controller during tutorial
        if (NPCController && NPCController.isEnabled()) {
          NPCController.toggle(); // Disable if enabled
        }
      }

      // NEW: Initialize UI visibility for tutorial stages (default to visible, but user can toggle)
      if (
        stagePath.includes("pvp_stage_2") ||
        stagePath.includes("pvp_stage_3")
      ) {
        // Only set to true if not already set by user (preserve user preference)
        if (state.uiVisible === undefined) {
          state.uiVisible = true;
        }
        // Ensure currentStagePath is set even if stageKey is not found
        if (!state.currentStagePath) {
          state.currentStagePath = stagePath;
        }
        console.log(
          `[Tutorial Stage] UI visible initialized, currentStagePath: ${state.currentStagePath}`
        );
      }

      // NEW: Enable NPC Controller if P2 is selected but no second controller is connected
      const padCount = state.input.connectedGamepads.size;
      if (
        state.players.length >= 2 &&
        padCount <= 1 &&
        NPCController &&
        !state.tutorial?.active
      ) {
        NPCController.enable();
        console.log(
          "🤖 NPC Controller enabled automatically (P2 selected, only 1 controller connected)"
        );
      }

      overlay.textContent =
        "Running – Move: LS/D-Pad/A,D; Jump: X/W/Space; Music: M";

      // NEW: Beatmatch-Timer startet JETZT (Stage-Start)
      state.stageStartTime = performance.now() / 1000; // Sekunden
      console.log(`🎵 [DEBUG] Stage Start Time: ${state.stageStartTime}s`);

      // NEW: Song startet exakt auf Beat 5 (nach 4-Beat-Vorlauf)
      const beatInterval = 60000 / (state.currentBPM || 117); // ms per beat
      const songDelay = beatInterval * 4; // 4 Beats Vorlauf

      console.log(
        `🎵 [DEBUG] Waiting ${songDelay}ms (4 beats @ ${state.currentBPM} BPM) before starting song: ${state.currentStageMusic}`
      );

      // NEW: Reset audio filters before starting new music
      if (AudioSystem.resetFilters) {
        AudioSystem.resetFilters();
        console.log("🔄 Audio filters reset for restart");
      }

      // Stop menu loop before starting stage music
      AudioSystem.stopMusic(0.5);

      // NEW: Tutorial stage: Don't start music immediately (will fade in based on proximity)
      if (state.tutorial?.active && state.tutorial.part === 1) {
        console.log(
          "[Tutorial] Music will fade in when player approaches dance spot"
        );
        // Music will be started in updateTutorialProximity()
      } else {
        // Start stage music with crossfade and 4-beat delay (use dynamic music from stage config)
        AudioSystem.playTrack(state.currentStageMusic, {
          fadeIn: 1.5,
          delay: songDelay,
        });

        console.log(
          `🎵 [DEBUG] Stage music playTrack called with delay=${songDelay}ms`
        );
      }

      // NEW: Musik startet gefiltert im Hintergrund (für Dance Battle System)
      setTimeout(() => {
        if (AudioSystem.setLowpassFilter) {
          AudioSystem.setLowpassFilter(1800, 2.0); // 2 Sekunden Fade zu gedämpft
          console.log("🎵 Stage music filtered to background (1800 Hz)");
        }
      }, songDelay + 1500); // Nach initialem Fade-in + Song-Delay

      // NEW: Auto-detect downbeat alignment after music starts
      setTimeout(() => {
        if (AudioSystem.detectDownbeatOffset) {
          const downbeatOffset = AudioSystem.detectDownbeatOffset(state);
          if (Math.abs(downbeatOffset) > 50) {
            // Only adjust if significant offset
            state.currentBeatOffset =
              (state.currentBeatOffset || 0) + downbeatOffset;
            console.log(
              `🎵 Auto-downbeat alignment: Applied ${downbeatOffset.toFixed(
                0
              )}ms offset for better beat sync`
            );
          }
        }
      }, songDelay + 3000); // Wait 3 seconds after music starts for stable detection

      state.gameMode = "PLAYING";

      // Analytics: Track match start
      if (window.AnalyticsClient) {
        const stageName = stagePath.split("/").pop() || stagePath;
        window.AnalyticsClient.trackEvent("match_start", {
          stage: stageName,
          characters: state.selectedCharacters || [],
          isTrainingMode: state.isTrainingMode || false,
          isStoryMode: state.isStoryMode || false,
          playerCount: state.players?.length || 0,
        });
      }

      // Debug: Log initial tutorial / hitstop state right after starting the stage
      try {
        console.log(
          `[DEBUG] startGame complete → hitstop=${
            state.hitstop || 0
          }; tutorialActive=${Boolean(state.tutorial?.active)}; tutorialPart=${
            state.tutorial?.part
          }; part2ModalVisible=${Boolean(
            state.tutorial?.part2?.modal?.visible
          )}`
        );
      } catch (e) {
        // ignore
      }
    } catch (err) {
      console.error("Error starting game:", err);
      overlay.textContent =
        "Error: " + err.message + " (Press START/ESC to return)";
      state.gameMode = "ERROR"; // Set specific error state
      // Analytics: Track error
      if (window.AnalyticsClient) {
        window.AnalyticsClient.trackError(err, { context: "startGame" });
      }
    }
  }

  // NEW: Check Start button (Button 9) as ESC input
  function checkStartButtonAsESC(state) {
    const gamepads = navigator.getGamepads();
    let startPressed = false;

    state.input.gamepadMapping.forEach((physicalIndex, playerIndex) => {
      if (physicalIndex === null) {
        state.input.gamepadPrevStart[playerIndex] = false;
        return;
      }

      const gp = gamepads?.[physicalIndex];
      if (!gp) {
        state.input.gamepadPrevStart[playerIndex] = false;
        return;
      }

      const bindingState = state.input.playerBindings[playerIndex];
      const startBinding = bindingState?.bindings?.start;

      let pressed = false;
      if (startBinding && startBinding.type === "button") {
        pressed = !!gp.buttons?.[startBinding.index]?.pressed;
      } else if (startBinding && startBinding.type === "axis") {
        const value = gp.axes?.[startBinding.index] ?? 0;
        const deadzone =
          startBinding.deadzone !== undefined ? startBinding.deadzone : 0.2;
        const threshold =
          startBinding.threshold !== undefined ? startBinding.threshold : 0.5;
        const adjValue = Math.abs(value) < deadzone ? 0 : value;
        pressed = Math.abs(adjValue) >= threshold;
      } else {
        pressed = !!gp.buttons?.[9]?.pressed;
      }

      const wasPressed = state.input.gamepadPrevStart[playerIndex] || false;
      if (pressed && !wasPressed) {
        startPressed = true;
      }
      state.input.gamepadPrevStart[playerIndex] = pressed;
    });

    if (startPressed) {
      // Simulate ESC key press logic
      // Handle modal in PLAYING mode
      if (state.gameMode === "PLAYING") {
        if (state.modal.controlsModal.isOpen) {
          // Close controls modal first
          state.modal.controlsModal.isOpen = false;
          state.modal.controlsModal.captureMode = null;
          state.modal.controlsModal.notice = "";
          state.modal.controlsModal.focus = "player";
          state.modal.controlsModal.lastCaptureTime = 0;
        } else if (state.modal.isOpen) {
          // Close main modal
          state.modal.isOpen = false;
        } else {
          // Open main modal
          state.modal.isOpen = true;
          state.modal.selectedButton = 0; // Reset selection
        }
      }
      // Handle modal in CHARACTER_SELECT and STAGE_SELECT
      else if (
        state.gameMode === "CHARACTER_SELECT" ||
        state.gameMode === "STAGE_SELECT" ||
        state.gameMode === "LOADING" ||
        state.gameMode === "ERROR"
      ) {
        if (state.modal.isOpen) {
          // Close modal
          state.modal.isOpen = false;
        } else {
          // Open modal with Quit Game option
          state.modal.isOpen = true;
          state.modal.selectedButton = 5; // Select "Quit Game" button (index 5)
        }
      }
    }
  }

  // NEW: Modal input handling
  function handleModalInput(state) {
    if (!state.modal.isOpen && !state.modal.controlsModal.isOpen) return;

    const pressed = state.input.keysPressed;
    const kd = state.input.keysDown;

    if (state.modal.controlsModal.isOpen) {
      const controls = state.modal.controlsModal;
      const catalog = window.InputBindingCatalog;
      const actions = catalog.getDisplayableActions({ editableOnly: false });
      const editableActions = catalog.getDisplayableActions({
        editableOnly: true,
      });
      const maxVisibleRows = controls.visibleRows ?? 9;

      if (
        controls.notice &&
        performance.now() * 0.001 - (controls.noticeTimer || 0) > 3
      ) {
        controls.notice = "";
      }

      if (editableActions.length === 0) return;

      if (controls.selectedActionIndex >= editableActions.length) {
        controls.selectedActionIndex = editableActions.length - 1;
      }
      if (controls.selectedActionIndex < 0) {
        controls.selectedActionIndex = 0;
      }

      const totalPlayers =
        state.input.gamepadMapping?.length > 0
          ? state.input.gamepadMapping.length
          : 1;
      if (controls.playerIndex >= totalPlayers) {
        controls.playerIndex = totalPlayers - 1;
      }
      if (controls.playerIndex < 0) controls.playerIndex = 0;

      const bindingState =
        state.input.playerBindings?.[controls.playerIndex] || null;
      const selectedAction =
        editableActions[controls.selectedActionIndex] || null;

      if (controls.captureMode) {
        const cancelCapture =
          pressed.has("Backspace") ||
          getGamepadButtonPressed(0, 1) ||
          getGamepadButtonPressed(1, 1);
        if (cancelCapture) {
          controls.captureMode = null;
          controls.notice = "Capture cancelled";
          controls.noticeTimer = performance.now() * 0.001;
        }
        return;
      }

      const now = performance.now() * 0.001;

      const navUp =
        pressed.has("ArrowUp") ||
        getGamepadDPad(0, "up") ||
        getGamepadDPad(1, "up") ||
        getGamepadAxisPressed(0, 1, -1) ||
        getGamepadAxisPressed(1, 1, -1);
      const navDown =
        pressed.has("ArrowDown") ||
        getGamepadDPad(0, "down") ||
        getGamepadDPad(1, "down") ||
        getGamepadAxisPressed(0, 1, 1) ||
        getGamepadAxisPressed(1, 1, 1);
      const navLeft =
        pressed.has("ArrowLeft") ||
        getGamepadDPad(0, "left") ||
        getGamepadDPad(1, "left") ||
        getGamepadAxisPressed(0, 0, -1) ||
        getGamepadAxisPressed(1, 0, -1);
      const navRight =
        pressed.has("ArrowRight") ||
        getGamepadDPad(0, "right") ||
        getGamepadDPad(1, "right") ||
        getGamepadAxisPressed(0, 0, 1) ||
        getGamepadAxisPressed(1, 0, 1);

      let focus = controls.focus || "player";
      if (totalPlayers <= 1) {
        focus = "actions";
      }
      controls.focus = focus;

      if (focus === "player") {
        if (totalPlayers > 1) {
          if (navLeft) {
            controls.playerIndex =
              (controls.playerIndex - 1 + totalPlayers) % totalPlayers;
          } else if (navRight) {
            controls.playerIndex = (controls.playerIndex + 1) % totalPlayers;
          }
        }
        const confirmPlayer =
          pressed.has("Enter") ||
          pressed.has(" ") ||
          getGamepadButtonPressed(0, 0) ||
          getGamepadButtonPressed(1, 0);
        if (confirmPlayer) {
          controls.focus = "actions";
          controls.notice = `Editing bindings for Player ${
            controls.playerIndex + 1
          }`;
          controls.noticeTimer = now;
        }
        return;
      }

      if (navUp) {
        controls.selectedActionIndex =
          (controls.selectedActionIndex - 1 + editableActions.length) %
          editableActions.length;
      } else if (navDown) {
        controls.selectedActionIndex =
          (controls.selectedActionIndex + 1) % editableActions.length;
      }

      const reopenPlayerSelect =
        totalPlayers > 1 &&
        (pressed.has("Tab") ||
          getGamepadButtonPressed(0, 4) ||
          getGamepadButtonPressed(1, 4));

      if (reopenPlayerSelect) {
        controls.focus = "player";
        controls.notice = "Select player to configure";
        controls.noticeTimer = now;
        return;
      }

      if (!bindingState || !selectedAction) return;

      const confirm =
        pressed.has("Enter") ||
        pressed.has(" ") ||
        getGamepadButtonPressed(0, 0) ||
        getGamepadButtonPressed(1, 0);
      const rawClear =
        pressed.has("Backspace") ||
        pressed.has("Delete") ||
        getGamepadButtonPressed(0, 2) ||
        getGamepadButtonPressed(1, 2);
      const reset =
        pressed.has("r") ||
        pressed.has("R") ||
        getGamepadButtonPressed(0, 3) ||
        getGamepadButtonPressed(1, 3);

      const justCaptured =
        controls.lastCaptureTime && now - controls.lastCaptureTime < 0.25;
      const clear = rawClear && !justCaptured;

      if (confirm) {
        controls.captureMode = {
          playerIndex: controls.playerIndex,
          actionId: selectedAction.id,
          startedAt: performance.now() * 0.001,
          prevAxes: [],
        };
        controls.notice =
          catalog.ACTIONS[selectedAction.id]?.kind === "axis"
            ? `Move a stick for ${selectedAction.label}`
            : `Press a button for ${selectedAction.label}`;
        controls.noticeTimer = performance.now() * 0.001;
      } else if (clear) {
        window.InputHandler.clearBinding(
          state,
          controls.playerIndex,
          selectedAction.id
        );
      } else if (reset) {
        window.InputHandler.resetBinding(
          state,
          controls.playerIndex,
          selectedAction.id
        );
      }

      const selectedRowIndex = actions.findIndex(
        (action) => action.id === selectedAction.id
      );
      if (selectedRowIndex !== -1) {
        const maxOffset = Math.max(0, actions.length - maxVisibleRows);
        controls.scrollOffset = Math.max(
          0,
          Math.min(controls.scrollOffset ?? 0, maxOffset)
        );
        if (selectedRowIndex < controls.scrollOffset) {
          controls.scrollOffset = selectedRowIndex;
        } else if (selectedRowIndex >= controls.scrollOffset + maxVisibleRows) {
          controls.scrollOffset = selectedRowIndex - maxVisibleRows + 1;
        }
        controls.scrollOffset = Math.max(
          0,
          Math.min(controls.scrollOffset, maxOffset)
        );
      }

      return;
    }

    // Handle main modal navigation
    if (state.modal.isOpen) {
      // Navigation up/down - UNIFIED: L-Stick navigation
      const navUp =
        pressed.has("ArrowUp") ||
        getGamepadDPad(0, "up") ||
        getGamepadDPad(1, "up") ||
        getGamepadAxisPressed(0, 1, -1) ||
        getGamepadAxisPressed(1, 1, -1);

      const navDown =
        pressed.has("ArrowDown") ||
        getGamepadDPad(0, "down") ||
        getGamepadDPad(1, "down") ||
        getGamepadAxisPressed(0, 1, 1) ||
        getGamepadAxisPressed(1, 1, 1);

      if (navUp) {
        state.modal.selectedButton = Math.max(
          0,
          state.modal.selectedButton - 1
        );
      }
      if (navDown) {
        state.modal.selectedButton = Math.min(
          state.modal.buttons.length - 1,
          state.modal.selectedButton + 1
        );
      }

      // Selection - UNIFIED: B button
      const select =
        pressed.has("Enter") ||
        pressed.has(" ") ||
        getGamepadButtonPressed(0, 1) ||
        getGamepadButtonPressed(1, 1);

      if (select) {
        const selectedButton = state.modal.buttons[state.modal.selectedButton];
        handleModalAction(state, selectedButton.action);
      }

      // Back - UNIFIED: Y button
      const back =
        getGamepadButtonPressed(0, 3) || getGamepadButtonPressed(1, 3);
      if (back) {
        state.modal.isOpen = false;
      }
    }
  }

  // NEW: Handle modal button actions
  function handleModalAction(state, action) {
    switch (action) {
      case "restart":
        // Restart current stage (preserve training mode if active)
        const currentStageKey = Object.keys(state.selection.stages).find(
          (key) => state.selection.stages[key].path === state.currentStagePath
        );
        if (currentStageKey) {
          const stagePath = state.selection.stages[currentStageKey].path;
          const wasTrainingMode = state.isTrainingMode; // Preserve training mode
          state.modal.isOpen = false;
          startGame(stagePath);
          // Restore training mode after restart (if it was active)
          if (wasTrainingMode) {
            state.isTrainingMode = true;
          }
        }
        break;

      case "training":
        // Enter training mode: go to character selection (only P1 selects)
        state.modal.isOpen = false;
        state.isTrainingMode = true;
        state.gameMode = "CHARACTER_SELECT";
        state.selection.p1Locked = false;
        state.selection.p2Locked = false;
        AudioSystem.stopMusic(0.5);
        AudioSystem.playTrack("MENU_LOOP");
        break;

      case "character_select":
        // Return to character selection
        state.modal.isOpen = false;
        state.isTrainingMode = false; // Reset training mode when manually going to character select
        state.gameMode = "CHARACTER_SELECT";
        state.selection.p1Locked = false;
        state.selection.p2Locked = false;
        AudioSystem.stopMusic(0.5);
        AudioSystem.playTrack("MENU_LOOP");
        break;

      case "stage_select":
        // Return to stage selection with same character selection
        state.modal.isOpen = false;
        state.gameMode = "STAGE_SELECT";
        AudioSystem.stopMusic(0.5);
        AudioSystem.playTrack("MENU_LOOP");
        break;

      case "controls":
        // Open controls modal
        state.modal.controlsModal.isOpen = true;
        state.modal.controlsModal.playerIndex = 0;
        state.modal.controlsModal.selectedActionIndex = 0;
        state.modal.controlsModal.captureMode = null;
        state.modal.controlsModal.lastBoundActionId = null;
        state.modal.controlsModal.scrollOffset = 0;
        state.modal.controlsModal.focus = "player";
        state.modal.controlsModal.lastCaptureTime = 0;
        const controlsNow =
          (typeof performance !== "undefined"
            ? performance.now()
            : Date.now()) * 0.001;
        state.modal.controlsModal.notice = "Select player to configure";
        state.modal.controlsModal.noticeTimer = controlsNow;
        break;

      case "quit":
        // Close the game
        state.modal.isOpen = false;
        if (IS_ELECTRON_BUILD && isElectronRuntime()) {
          try {
            const { ipcRenderer } = require("electron");
            ipcRenderer.send("quit-app");
          } catch (err) {
            console.warn(
              "Electron IPC unavailable, falling back to window.close()",
              err
            );
            window.close();
          }
        } else {
          // Browser: Try to close window (may be blocked by browser security)
          // If blocked, user can manually close the tab/window
          try {
            window.close();
          } catch (e) {
            console.log(
              "Window.close() blocked by browser. User can close tab manually."
            );
          }
          // Browser environment - close window
          window.close();
        }
        break;
    }
  }

  // NEW: Spawn NPC (Player 2) function
  window.spawnNPC = function (state) {
    // Check if we're in playing mode
    if (state.gameMode !== "PLAYING") {
      console.warn("🤖 Cannot spawn NPC: Not in PLAYING mode");
      return;
    }

    // Check if Player 2 already exists
    if (state.players.length >= 2 && state.players[1]) {
      console.log("🤖 Player 2 already exists, respawning at spawn point");
      const p2 = state.players[1];
      // Reset Player 2 to spawn point
      if (state.spawnPoints.length >= 2) {
        p2.pos = { ...state.spawnPoints[1] };
      } else {
        // Fallback: spawn on the right side
        p2.pos = {
          x: canvas.width * 0.75,
          y: canvas.height * 0.5,
        };
      }
      p2.vel = { x: 0, y: 0 };
      p2.percent = 0;
      p2.lives = 3;
      p2.eliminated = false;
      p2.isInvincible = true;
      p2.respawnInvincibilityTimer = 2.0;
      p2.facing = -1; // Face left (towards P1)
      p2.isMovable = true;
      p2.respawnState = "none";
      console.log(`🤖 Player 2 (${p2.charName}) respawned`);
      return;
    }

    // Create Player 2 if it doesn't exist
    const charName =
      state.selectedCharacters[1] || state.selectedCharacters[0] || "cyboard";
    const spawnPos =
      state.spawnPoints.length >= 2
        ? state.spawnPoints[1]
        : {
            x: canvas.width * 0.75,
            y: canvas.height * 0.5,
          };

    // Ensure spawn point exists
    if (state.spawnPoints.length < 2) {
      state.spawnPoints.push({ ...spawnPos });
    }

    const p2 = Physics.createPlayer(state, charName, spawnPos, 1);
    state.players.push(p2);

    console.log(
      `🤖 NPC (Player 2) spawned: ${charName} at (${spawnPos.x}, ${spawnPos.y})`
    );
  };

  // NEW: Toggle metronome function (called from input-handler)
  window.toggleMetronome = function () {
    if (!state.currentBPM) {
      console.warn("🎵 Cannot start metronome: No BPM set (not in gameplay)");
      return;
    }

    // Calculate sync offset to align with music beats
    let syncOffset = 0;
    if (!state.metronome.enabled) {
      // Starting metronome - sync with current music beat phase
      let rawMusicTime = 0;
      if (AudioSystem && AudioSystem.getMusicTime) {
        rawMusicTime = AudioSystem.getMusicTime() || 0;
      }
      const beatOffset = state.currentBeatOffset || 0;
      const musicTime =
        rawMusicTime > 0
          ? Math.max(0, rawMusicTime + beatOffset)
          : Math.max(
              0,
              (performance.now() / 1000 - (state.stageStartTime || 0)) * 1000 +
                beatOffset
            );
      const beatInterval = 60000 / state.currentBPM; // ms
      const timeSinceLastBeat = musicTime % beatInterval;

      // Calculate time until NEXT beat
      syncOffset = beatInterval - timeSinceLastBeat;

      console.log(
        `🎵 Sync calculation: musicTime=${musicTime.toFixed(
          0
        )}ms, timeSinceBeat=${timeSinceLastBeat.toFixed(
          0
        )}ms, nextBeatIn=${syncOffset.toFixed(0)}ms`
      );
    }

    state.metronome.enabled = Metronome.toggle(state.currentBPM, syncOffset);

    // Set visual callback for beat pulse
    if (state.metronome.enabled) {
      Metronome.setVisualCallback(() => {
        state.metronome.visualPulse = 1.0; // Trigger visual pulse
      });
      console.log(`🎵 Metronome enabled at ${state.currentBPM} BPM (synced)`);
    } else {
      console.log("🎵 Metronome disabled");
    }
  };

  // NEW: Beat alignment function (called from input-handler)
  window.alignBeatOffset = function () {
    if (!state.currentBPM || !AudioSystem.detectDownbeatOffset) {
      console.warn(
        "🎵 Cannot align beat: No BPM set or alignment system not available"
      );
      return;
    }

    const currentOffset = state.currentBeatOffset || 0;
    const downbeatOffset = AudioSystem.detectDownbeatOffset(state);

    state.currentBeatOffset = currentOffset + downbeatOffset;

    console.log(
      `🎵 Beat alignment: Old offset: ${currentOffset.toFixed(
        0
      )}ms → Downbeat adjustment: ${downbeatOffset.toFixed(
        0
      )}ms → New offset: ${state.currentBeatOffset.toFixed(0)}ms`
    );
  };

  // NEW: Global function to toggle beat sync for all stage animations
  window.toggleBeatSync = function (enabled = null) {
    if (!state.stageAnimations) {
      console.warn("🎬 No stage animations found");
      return;
    }

    const newState =
      enabled !== null ? enabled : !state.stageAnimations[0]?.beatSync;

    for (const anim of state.stageAnimations) {
      anim.beatSync = newState;
    }

    console.log(
      `🎬 Beat sync for all stage animations: ${
        newState ? "ENABLED" : "DISABLED"
      }`
    );
  };

  // NEW: Global function to set FPS multiplier for all stage animations
  window.setFPSMultiplier = function (multiplier) {
    if (!state.stageAnimations) {
      console.warn("🎬 No stage animations found");
      return;
    }

    for (const anim of state.stageAnimations) {
      anim.fpsMultiplier = multiplier;
    }

    console.log(
      `🎬 FPS multiplier for all stage animations set to: ${multiplier}x`
    );
  };

  async function main() {
    overlay.textContent = "Initializing...";
    try {
      // Initialize systems
      // Initialize Audio Device Manager first (for optimized AudioContext)
      if (window.AudioDeviceManager) {
        window.AudioDeviceManager.init();
      }
      AudioSystem.init();
      Metronome.init();
      InputHandler.setupListeners(state);

      // Initialize mobile controls
      if (window.MobileControls) {
        window.MobileControls.init();
      }

      window.addEventListener("resize", handleResize);
      handleResize();

      // Load selection data
      const charsRes = await fetch("data/characters.json");
      state.selection.characters = await charsRes.json();
      const stagesRes = await fetch("data/stages.json");
      state.selection.stages = await stagesRes.json();

      const characterKeys = Object.keys(state.selection.characters);
      const enabledIndices = characterKeys
        .map((name, index) =>
          state.selection.characters[name]?.disabled ? -1 : index
        )
        .filter((index) => index >= 0);

      if (enabledIndices.length > 0) {
        const p1Index = enabledIndices[0];
        const p2Index =
          enabledIndices.length > 1 ? enabledIndices[1] : enabledIndices[0];

        state.selection.p1CharIndex = p1Index;
        state.selection.p2CharIndex = p2Index;

        state.selectedCharacters[0] = characterKeys[p1Index];
        state.selectedCharacters[1] = characterKeys[p2Index];
      }

      // Load UI assets for character selection animations
      await GameAssets.loadUIAssets(state);

      // Preload character assets for selection screen
      const allCharacters = Object.keys(state.selection.characters);
      for (const charName of allCharacters) {
        await GameAssets.loadCharacterAssets({
          selectedCharacters: [charName],
          characterConfigs: state.characterConfigs,
        });
      }

      // Preload character splash images for UI
      for (const [charName, charData] of Object.entries(
        state.selection.characters
      )) {
        if (charData.splashArt) {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.src = charData.splashArt;
          // Don't await - let them load in background
        }
      }

      // Start with Title Screen
      state.gameMode = "TITLE_SCREEN";
      overlay.textContent = ""; // Hide loading overlay
      requestAnimationFrame(loop);
    } catch (err) {
      console.error(err);
      overlay.textContent = "Error: " + err.message;
    }
  }

  main().catch((err) => {
    console.error(err);
    overlay.textContent = "Error: " + err.message;
  });

  // Steam Integration (optional - nur in Electron)
  let steamManager = null;
  let achievementSystem = null;

  // Nur laden wenn in Electron und Build-Flag aktiv
  if (WITH_STEAM && IS_ELECTRON_BUILD && isElectronRuntime()) {
    try {
      const SteamManager = require("../electron-main/steam/steam-manager.js");
      steamManager = new SteamManager();

      // Achievement System
      achievementSystem = {
        achievements: {
          first_kill: { unlocked: false, name: "First Blood" },
          combo_master: { unlocked: false, name: "Combo Master" },
          perfect_round: { unlocked: false, name: "Perfect Round" },
        },

        checkAchievements: function (gameState) {
          if (!steamManager) return;

          // Beispiel: Erster Kill
          if (
            gameState.players &&
            gameState.players[0] &&
            gameState.players[0].kills > 0 &&
            !this.achievements.first_kill.unlocked
          ) {
            this.achievements.first_kill.unlocked = true;
            steamManager.unlockAchievement("first_kill");
            console.log("🏆 Achievement unlocked: First Blood!");
          }
        },
      };

      console.log("🎮 Steam Manager loaded");
    } catch (error) {
      console.log(
        "Steam not available (expected when Steam runtime is missing)"
      );
    }
  } else if (!WITH_STEAM) {
    console.log("Steam integration disabled for this build (WITH_STEAM=false)");
  }

  // Achievement checking in game loop
  const originalLoop = loop;
  function enhancedLoop(ts) {
    originalLoop(ts);

    // Check achievements
    if (achievementSystem && state) {
      achievementSystem.checkAchievements(state);
    }
  }

  // Replace loop with enhanced version
  window.loop = enhancedLoop;
})();
