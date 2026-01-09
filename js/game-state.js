window.GameState = (() => {
  const createState = () => ({
    bg: null,
    bgLayer: null, // NEW: Additional background layer for stage animations
    mid: null,
    ground: null,
    groundData: null,
    kill: null,
    killData: null,
    semisolid: null,
    semisolidData: null,
    spawn: null,
    // Extended heatmap data
    frictionData: null,
    hazardData: null,
    bounceData: null,
    speedData: null,
    specialData: null,
    atlas: null,
    atlasImage: null,
    fxAtlas: null,
    fps: 12,
    tileSize: [256, 256],
    frames: {},
    animations: {},
    players: [],
    projectiles: [],
    pendingHits: [], // <-- NEW: To store hits for resolution
    lastTime: 0,
    hitstop: 0, // Global freeze frames (0 = running, >0 = paused)
    shake: {
      x: 0,
      y: 0,
      duration: 0,
      intensity: 0,
      decay: 0.9,
    },
    camera: {
      x: 0,
      y: 0,
      zoom: 1.0,
    },
    input: {
      keysDown: new Set(),
      keysPressed: new Set(),
      gamepadPrevA: [],
      gamepadPrevR1: [],
      gamepadPrevR2: [],
      gamepadPrevL1: [],
      gamepadPrevL2: [],
      gamepadPrevR3: [],
      gamepadPrevJump: [],
      lastR2DownTime: [],
      lastL2DownTime: [],
      gamepadPrevB: [],
      gamepadPrevDanceBattle: [],
      gamepadPrevTriangle: [],
      gamepadPrevStart: [],
      prevPadSig: [],
      loggedPadInfo: [],
      // Gamepad mapping: playerIndex -> physical gamepad index
      gamepadMapping: [null, null], // [P1 gamepad index, P2 gamepad index]
      connectedGamepads: new Set(), // Track which physical gamepads are connected
      playerBindings: [],
      prevActionState: [],
      bindingStorageLoaded: false,
      bindingOverrides: { devices: {} },
      rawPrevButtons: [],
    },
    effects: [],
    // NEW: Global Match Statistics for Scoreboard & Leaderboard
    matchStats: [
      {
        danceAttempts: 0,
        beatmatches: 0,
        perfectBeats: 0,
        damageDealt: 0,
        airTimeTicks: 0,
        beatAttacks: 0,
        totalTicks: 0,
      },
      {
        danceAttempts: 0,
        beatmatches: 0,
        perfectBeats: 0,
        damageDealt: 0,
        airTimeTicks: 0,
        beatAttacks: 0,
        totalTicks: 0,
      },
    ],
    stageAnimations: [], // NEW: Stage animations for bgLayer
    stageAnimationsFromHeatmapSpawned: false, // Prevent duplicate heatmap spawns
    spawnedStageAnimKeys: new Set(), // Track spawned anims by block+name
    cameraBounds: null, // Optional per-stage camera bounds loaded from metadata
    stageMinZoom: 1.0, // Minimum zoom level for this stage
    stageMaxZoom: 2.03125, // Maximum zoom level for this stage
    stageDisableAutoZoom: false, // If true, camera stays at minZoom
    stageHighRes: false, // If true, stage assets are 20% larger
    screenFlash: {
      active: false,
      duration: 0.3, // Duration in seconds
      startTime: 0,
      color: "rgba(255, 255, 255, 0.8)", // White flash with 80% opacity
    },
    danceBattle: {
      active: false,
      timeRemaining: 15.0,
      startTime: 0,
      p1BeatCount: 0,
      p2BeatCount: 0,
      winner: null, // null, 0 (p1), or 1 (p2)
      cooldown: 0, // Cooldown nach Ende der Phase (z.B. 5s)
      musicStartReferenceMs: null,
      countdown: null,
      countdownValue: 0,
      inputLocked: false,
      prevTimeScale: 1.0,
    },
    beatFeedback: {
      p1: { text: "", color: "", time: 0, duration: 1.0 }, // P1 feedback (links)
      p2: { text: "", color: "", time: 0, duration: 1.0 }, // P2 feedback (rechts)
    },
    comboSystem: {
      p1: {
        count: 0,
        text: "",
        color: "",
        time: 0,
        duration: 2.0,
        isActive: false,
        perfectStreak: 0, // NEW: Track perfect streak for special rewards
      }, // P1 combo (links)
      p2: {
        count: 0,
        text: "",
        color: "",
        time: 0,
        duration: 2.0,
        isActive: false,
        perfectStreak: 0, // NEW: Track perfect streak for special rewards
      }, // P2 combo (rechts)
      comboTerms: [
        "jazzy",
        "skankstepper",
        "vouge",
        "sassy feet",
        "Detleft D!",
        "double Soost",
        "dicey",
        "diggidi Dirk",
        "cocaine",
        "DANCE INSTRUCTOR",
      ],
      comboColors: [
        "#ff4444",
        "#ff8844",
        "#ffaa44",
        "#ffdd44",
        "#ffaa88",
        "#ff88aa",
        "#aa88ff",
        "#8844ff",
        "#6644ff",
        "#ffffff",
      ],
    },
    debug: {
      drawBoxes: false,
      showSpriteInfo: false, // Show sprite debug information
      infiniteUltimeter: false, // DEBUG: Ultimeter stays at 100% for testing
      devMode: false, // DEV MODE: Debug features (wallslide, logging, etc.)
      showModal: false, // Show debug modal (Q key toggle)
      cameraLogging: false, // Camera debug logging
    },
    uiVisible: true, // NEW: Toggle for ingame UI visibility
    timeScale: 1.0, // Global time scale (1.0 = normal, <1.0 = slow-motion)
    physics: {
      gravity: 2800, // Increased for heavier feel (17% stronger)
      moveSpeed: 520,
      airControl: 0.6,
      accel: 3200,
      jumpSpeed: 880,
      maxFall: 3000, // Increased for more dynamic falling (15% faster)
      friction: 0.85, // Ground friction (15% speed loss per frame)
      airResistance: 0.98, // Base air resistance (enhanced with velocity-dependent drag in movement-system)
    },
    characterConfigs: {}, // To store loaded character configs
    selectedCharacters: ["cyboard", "fritz", "HP"], // Default selection
    selectedGameMode: "classic", // NEW: "classic" or "dance"
    isTrainingMode: false, // NEW: Training mode flag (only P1 selects character, single player spawn)
    isStoryMode: false, // NEW: Story mode flag (co-op campaign)
    npcSpawnPoints: [], // NEW: NPC spawn points from heatmap
    // NEW: Tutorial mode state
    tutorial: {
      active: false,
      part: 1, // 1 = dance spot tutorial, 2 = combat tutorial
      step: 1, // Current tutorial step (1-5 for combat tutorial)
      perfectBeatCount: 0, // Count of perfect beats at dance spot
      requiredPerfectBeats: 4, // Required perfect beats to complete part 1
      danceSpotActive: false, // Whether dance spot is active
      uiVisible: false, // UI visibility for tutorial
      musicFadedIn: false, // Music fade state
      proximityAlpha: 0, // Proximity-based fade (0-1)
      activeSpotPos: null, // Dance spot position
      activeSpotSize: 256, // Dance spot size
      transitionToPart2: false, // Flag to transition to part 2 (pvp_stage_2)
      // NEW: Victory dance sequence
      victoryDance: {
        active: false,
        phase: "pending", // "pending", "zooming", "dancing", "complete"
        startTime: 0,
        zoomStartTime: 0,
        zoomDuration: 2.0, // 2 seconds to zoom in
        danceDuration: 4.0, // 4 seconds of dancing
        targetZoom: 2.5, // Close-up zoom level
      },
      // NEW: Combat tutorial step data
      stepData: {
        step1: {
          attacksUsed: { r1: false, r2: false, l1: false, l2: false },
          complete: false,
        },
        step2: {
          attacksHit: { r1: false, r2: false, l1: false, l2: false },
          enemySpawned: false,
          complete: false,
        },
        step3: {
          perfectBeatCount: 0,
          requiredPerfectBeats: 4,
          chargedAttackPerformed: false,
          complete: false,
        },
        step4: {
          consecutiveDodges: 0,
          requiredDodges: 3,
          lastDodgeTime: 0,
          dodgeWindow: 3.0, // seconds between dodges to count as "in a row"
          complete: false,
        },
        step5: {
          explanationShown: false,
          beatMatchesPerformed: 0,
          requiredMatches: 2,
          complete: false,
        },
        step6: {
          enemyDefeated: false,
          complete: false,
        },
      },
      // NEW: Unified tutorial modal state (replaces part1.modal, part2.modal, part3.modal, instructionPanel)
      modal: {
        visible: false,
        messageId: null,
        currentMessage: null,
        animationState: "hidden", // hidden | appearing | visible | dismissing
        animationProgress: 0, // 0-1
        charIndex: 0,
        charsPerSecond: 60,
        autoDismissTimer: 0,
        completed: false,
        textLines: [],
        currentLine: 0,
        holdTimer: 0,
        holdDuration: 1.1,
      },
      // NEW: Tutorial Part 1 state (Beatmatch Basics)
      part1: {
        // Part 1 specific state (no modal here, uses unified modal)
      },
      // NEW: Tutorial Part 2 state (PvP Stage 2 - Combat Tutorial)
      part2: {
        completeModalShown: false, // Track if completion modal was shown
        gameFrozen: false, // Game freeze during modals
        currentPage: 0, // 0 = Dojo intro, 1 = UI explanation, 2+ = later steps
        uiHighlightActive: false, // Highlight UI elements during explanation
        introComplete: false, // Track if intro modals are done
        // NEW: Step tracking for Part 2
        currentStep: "intro", // intro, beatmatch, ultimate_explain, ultimate_task, beat_charge_explain, beat_charge_task, complete
        perfectBeatsCollected: 0,
        requiredPerfectBeats: 10,
        npcSpawned: false,
        ultimateUsed: false,
        ultimateHitEnemy: false,
        beatChargeHitEnemy: false,
        showBeatChargeModalTimer: -1,
        ultimateReady: false,
      },
      // NEW: Tutorial Part 3 state (Advanced Rhythm on pvp_stage_3)
      part3: {
        beatCharges: 0,
        maxBeatCharges: 3,
        beatChargeAccumulator: 0,
        tipMessage: "",
        tipTimer: 0,
        tipDuration: 0,
        centerDoubleAchieved: false,
        quietZoneHintShown: false,
        ultimeterFull: false,
        ultimateUsed: false,
        currentStep: "intro", // intro, stepA, stepB, stepC, stepD, stepE, stepF
        beatChargesCollected: false,
        chargedAttackUsed: false,
      },
      transitionToPart3: false, // Flag to transition to part 3 (pvp_stage_3)
    },
    gameTypeSelection: {
      selectedType: "pvp", // "pvp" or "story"
    },
    // NEW: Input cooldown to prevent accidental confirmations
    inputCooldown: {
      confirmCooldown: 0, // Cooldown timer for confirm button (in seconds)
    },
    currentBPM: 117, // Current stage BPM (dynamically set based on stage)
    currentStageMusic: "NINJA_STAGE", // Current stage music track
    currentBeatOffset: 0, // Beat offset in ms to compensate for audio sync issues
    musicStartTime: 0, // Timestamp when music started (for beat counting)
    // NEW: Dance Mode state (Global Mechanic)
    danceMode: {
      active: false,
      // Legacy/Battle specific fields
      targetScore: 10,
      p1Score: 0,
      p2Score: 0,
      currentActiveSpot: null,
      availableSpots: [],
      lastScoreFrame: -1,
      spotCheckCooldown: 0,
      p1PerfectBeatCount: 0,
      p2PerfectBeatCount: 0,
      p1SpotIds: [],
      p2SpotIds: [],
      // New Global Dance Spot fields
      spots: [], // List of all available spots {x, y}
      activeSpotIndex: -1, // Index of currently active spot
      barCount: 0, // For 16-bar rotation
      proximityAlpha: 0, // Global proximity volume/UI fade
      beatMatchRadius: 400, // Radius for valid beat matches
      uiVisible: false, // Whether beat UI should be shown
    },
    cooldownConfig: {
      // TESTING MODE: All cooldowns set to 0 for easy testing
      // TODO: Restore proper values when cooldown system is ready
      // Original values: r1: 1.0, r2: 1.5, l1: 2.0, l2: 2.0, ultimate: 5.0, roll: 1.5, shield: 1.0, doubleJump: 2.5
      r1: 0,
      r2: 0,
      l1: 0,
      l2: 0,
      ultimate: 5.0, // FIXED: Ultimate cooldown restored to prevent infinite ulti usage
      roll: 0,
      shield: 0,
      doubleJump: 0,
      beatReduction: 0.5, // Keep this for later
    },
    // NEW: In-game modal state
    modal: {
      isOpen: false,
      selectedButton: 0, // 0-5: restart, training, character select, stage select, controls, quit
      buttons: [
        { id: "restart", text: "Restart", action: "restart" },
        { id: "training", text: "Trainieren", action: "training" },
        {
          id: "character_select",
          text: "Character Selection",
          action: "character_select",
        },
        { id: "stage_select", text: "Stage Selection", action: "stage_select" },
        { id: "controls", text: "Controls", action: "controls" },
        { id: "quit", text: "Quit Game", action: "quit" },
      ],
      controlsModal: {
        isOpen: false,
        playerIndex: 0,
        selectedActionIndex: 0,
        captureMode: null,
        notice: "",
        noticeTimer: 0,
        lastBoundActionId: null,
        scrollOffset: 0,
        visibleRows: 9,
        focus: "player",
        lastCaptureTime: 0,
      },
    },
    // NEW: End-of-match sequence state
    matchEnd: {
      isActive: false,
      phase: "pending", // "pending", "zooming", "beatmatching", "showingResults"
      winner: null, // 0 or 1 (player index)
      startTime: 0,
      zoomStartTime: 0,
      zoomDuration: 8.0, // 8 seconds to zoom in (8 bars)
      beatmatchStartTime: 0,
      beatmatchDuration: 2.4, // 3 beats at 75 BPM = 2.4 seconds
      perfectBeatCount: 0,
      maxPerfectBeats: 3,
      audioFadeStartTime: 0,
      audioFadeDuration: 2.0, // 2 seconds fade out
      screenGrayStartTime: 0,
      screenGrayDuration: 0.5, // 0.5 seconds to gray out
      modalShowStartTime: 0,
      modalShowDuration: 0.8, // 0.8 seconds modal slide-in
      // Visual effects
      screenGrayAlpha: 0, // 0-1 for screen graying effect
      modalSlideOffset: 0, // 0-1 for modal slide animation
      // Audio effects
      technicolorActive: false,
      gaterActive: false,
      lastKnownAliveIndex: null,
      // Leaderboard submission tracking
      scoresSubmitted: false, // Track if scores have been submitted to prevent duplicate submissions
      // Scoreboard button state
      scoreboardButtonSelected: true, // Button is selected by default
      // Scoreboard grace period
      scoreboardOpenTime: 0, // Timestamp when scoreboard modal first opened (to ignore stale input)
    },
  });

  const CONSTANTS = {
    NATIVE_WIDTH: 2500,
    NATIVE_HEIGHT: 1380,
    LEVEL_DIR: "levels",
    HEATMAP_DIR: "heatmaps", // This will be relative to the specific stage path
    CHAR_DIR: "assets/characters",
  };

  return { createState, CONSTANTS };
})();
