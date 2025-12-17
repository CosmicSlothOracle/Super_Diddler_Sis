/**
 * Tutorial System - Manages step-by-step tutorial progression
 * Handles instruction display, progress tracking, and step transitions
 */
window.TutorialSystem = (() => {
  /**
   * Get instruction text for current step
   * @param {number} step - Current step number
   * @param {Object} stepData - Step tracking data
   * @param {Object} gameState - Optional game state for Part 2 specific text
   */
  function getInstructionText(step, stepData, gameState = null) {
    const isPart2 = gameState?.tutorial?.part === 2;

    switch (step) {
      case 1: {
        const usedCount = Object.values(stepData.step1.attacksUsed).filter(
          (v) => v
        ).length;
        // Part 2 Step A: Alone, test all 4 attacks
        if (isPart2) {
          return {
            main: "Führe jetzt alle vier Angriffe aus",
            detail:
              "R1: Schneller Jab | R2: Schwerer Schlag | L1: Spezial-Angriff | L2: Geladener Angriff (halten und loslassen)",
            progress: `${usedCount}/4 attacks used`,
            highlightElements: [
              "button_r1",
              "button_r2",
              "button_l1",
              "button_l2",
            ],
          };
        }
        // Legacy Step 1
        return {
          main: "Warm-up: test each attack once",
          detail:
            "Tap R1 for a quick jab, R2 for a heavy strike, L1 for your special, and hold L2 to charge and release.",
          progress: `${usedCount}/4 attacks used`,
          highlightElements: [
            "button_r1",
            "button_r2",
            "button_l1",
            "button_l2",
          ],
        };
      }
      case 2: {
        const hitCount = Object.values(stepData.step2.attacksHit).filter(
          (v) => v
        ).length;
        // Part 2 Step B: Passive NPC
        if (isPart2) {
          return {
            main: "Teste deine Angriffe jetzt an diesem Gegner",
            detail:
              "Führe Angriffe auf den passiven NPC aus. Mindestens 4 Treffer erforderlich.",
            progress: `${hitCount}/4 attacks landed`,
            highlightElements: ["enemy_target"],
          };
        }
        // Legacy step 2
        return {
          main: "Apply it: hit the sparring bot with every move",
          detail:
            "Close the distance and land R1, R2, L1, and a charged L2 on the enemy once each.",
          progress: `${hitCount}/4 attacks landed`,
          highlightElements: ["enemy_target"],
        };
      }
      case 3: {
        // Part 2 Step C: Active NPC fight
        if (isPart2) {
          const p1 = gameState?.players?.[0];
          const p2 = gameState?.players?.[1];
          const p1Alive = p1 && !p1.eliminated && p1.lives > 0;
          const p2Alive = p2 && !p2.eliminated && p2.lives > 0;
          return {
            main: "Kämpfe jetzt gegen diesen Gegner",
            detail:
              "Kämpfe bis einer von euch K.O. geht. Nutze alles, was du gelernt hast.",
            progress:
              p1Alive && p2Alive
                ? "Kampf läuft..."
                : p1Alive
                ? "Du hast gewonnen!"
                : "Gegner hat gewonnen!",
            highlightElements: ["enemy_target"],
          };
        }
        // Legacy step 3
        return {
          main: "Match the beat! Watch the top bar - each beat lights up",
          detail: `Collect ${stepData.step3.requiredPerfectBeats} perfect beats (green feedback), then hold L2 to charge and release on beat`,
          progress: `${stepData.step3.perfectBeatCount}/${stepData.step3.requiredPerfectBeats} perfect beats`,
          highlightElements: ["hud_beat_bar", "button_l2"],
        };
      }
      case 4:
        return {
          main: "Press [Roll Button] to dodge!",
          detail: "Dodge 3 times in a row to complete this step",
          progress: `${stepData.step4.consecutiveDodges}/${stepData.step4.requiredDodges} consecutive dodges`,
          highlightElements: ["button_roll"],
        };
      case 5:
        return {
          main: "The top bar shows the music beats - 4 beats per bar",
          detail:
            "Time your attacks with the beats for bonus damage! Green = Perfect, Yellow = Good, Red = Miss",
          progress: `${stepData.step5.beatMatchesPerformed}/${stepData.step5.requiredMatches} beat matches`,
          highlightElements: ["hud_beat_bar", "hud_beat_feedback"],
        };
      case 6:
        return {
          main: "Defeat the enemy!",
          detail: "Use everything you've learned to defeat your opponent",
          progress: stepData.step6.enemyDefeated ? "Enemy defeated!" : "Fight!",
          highlightElements: ["enemy_target"],
        };
      default:
        return {
          main: "",
          detail: "",
          progress: "",
          highlightElements: [],
        };
    }
  }

  /**
   * Check if current step is complete
   * @param {number} step - Current step number
   * @param {Object} stepData - Step tracking data
   * @param {Object} gameState - Optional game state for Part 2 Step C
   */
  function isStepComplete(step, stepData, gameState = null) {
    switch (step) {
      case 1:
        // Step A: All 4 attacks used
        return Object.values(stepData.step1.attacksUsed).every((v) => v);
      case 2:
        // Step B: All 4 attacks hit on enemy
        return Object.values(stepData.step2.attacksHit).every((v) => v);
      case 3:
        // Step C (Part 2): One player is eliminated
        if (gameState?.tutorial?.part === 2) {
          const p1 = gameState.players?.[0];
          const p2 = gameState.players?.[1];
          return (
            (p1 && p1.eliminated) ||
            (p1 && p1.lives <= 0) ||
            (p2 && p2.eliminated) ||
            (p2 && p2.lives <= 0)
          );
        }
        // Legacy: Perfect beats + charged attack
        return (
          stepData.step3.perfectBeatCount >=
            stepData.step3.requiredPerfectBeats &&
          stepData.step3.chargedAttackPerformed
        );
      case 4:
        return (
          stepData.step4.consecutiveDodges >= stepData.step4.requiredDodges
        );
      case 5:
        return (
          stepData.step5.explanationShown &&
          stepData.step5.beatMatchesPerformed >= stepData.step5.requiredMatches
        );
      case 6:
        return stepData.step6.enemyDefeated;
      default:
        return false;
    }
  }

  /**
   * Initialize tutorial step
   */
  function initializeStep(state, step) {
    if (!state.tutorial) return;

    state.tutorial.step = step;

    // Step-specific initialization
    switch (step) {
      case 2:
        // Part 2 Step B: Spawn passive NPC
        if (state.tutorial?.part === 2) {
          if (!state.tutorial.stepData.step2.enemySpawned) {
            spawnTutorialEnemy(state, true) // true = passive
              .then(() => {
                state.tutorial.stepData.step2.enemySpawned = true;
                console.log("[Tutorial Step 2B] Passive NPC spawn complete");
              })
              .catch((err) => {
                console.error(
                  "[Tutorial Step 2B] Failed to spawn passive NPC:",
                  err
                );
              });
          }
        } else {
          // Legacy: Spawn enemy for step 2
          if (!state.tutorial.stepData.step2.enemySpawned) {
            spawnTutorialEnemy(state)
              .then(() => {
                state.tutorial.stepData.step2.enemySpawned = true;
                console.log("[Tutorial Step 2] Enemy spawn complete");
              })
              .catch((err) => {
                console.error("[Tutorial Step 2] Failed to spawn enemy:", err);
              });
          }
        }
        break;
      case 3:
        // Part 2 Step C: Enable NPC controller for active fight
        if (state.tutorial?.part === 2) {
          // Check if NPC already exists (from Step 2)
          if (state.players.length >= 2 && state.players[1]) {
            // NPC already exists, just enable controller
            if (window.NPCController && !window.NPCController.isEnabled()) {
              window.NPCController.enable();
              console.log(
                "[Tutorial Step 3C] NPC Controller enabled for active fight"
              );
            }
          } else {
            // Spawn new active NPC (shouldn't happen normally, but just in case)
            spawnTutorialEnemy(state, false) // false = active
              .then(() => {
                if (window.NPCController && !window.NPCController.isEnabled()) {
                  window.NPCController.enable();
                  console.log(
                    "[Tutorial Step 3C] Active NPC spawn complete, controller enabled"
                  );
                }
              })
              .catch((err) => {
                console.error(
                  "[Tutorial Step 3C] Failed to spawn active NPC:",
                  err
                );
              });
          }
          // Initialize step 3 data
          state.tutorial.stepData.step3 = state.tutorial.stepData.step3 || {
            perfectBeatCount: 0,
            requiredPerfectBeats: 4,
            chargedAttackPerformed: false,
            enemyDefeated: false,
            complete: false,
          };
          state.tutorial.stepData.step3.enemyDefeated = false;
        } else {
          // Legacy: Enable beat matching feedback
          if (state.tutorial.stepData.step3) {
            state.tutorial.stepData.step3.perfectBeatCount = 0;
          }
        }
        break;
      case 4:
        // Reset dodge counter
        state.tutorial.stepData.step4.consecutiveDodges = 0;
        state.tutorial.stepData.step4.lastDodgeTime = 0;
        break;
      case 5:
        // Show explanation
        state.tutorial.stepData.step5.explanationShown = true;
        state.tutorial.stepData.step5.beatMatchesPerformed = 0;
        break;
      case 6:
        // Legacy: Enable NPC Controller for final battle
        if (window.NPCController && !window.NPCController.isEnabled()) {
          window.NPCController.enable();
          console.log(
            "[Tutorial Step 6] NPC Controller enabled for final battle"
          );
        }
        state.tutorial.stepData.step6 = state.tutorial.stepData.step6 || {
          enemyDefeated: false,
          complete: false,
        };
        state.tutorial.stepData.step6.enemyDefeated = false;
        break;
    }

    // Update instruction panel
    updateInstructionPanel(state);
  }

  /**
   * Spawn tutorial enemy
   * @param {Object} state - Game state
   * @param {boolean} passive - If true, spawn passive NPC (no controller). If false, spawn active NPC.
   * Picks a random character from available characters (excluding P1's character)
   * Loads character assets if needed before spawning
   */
  async function spawnTutorialEnemy(state, passive = true) {
    // Check if P2 already exists (2 human players)
    if (
      state.players.length >= 2 &&
      state.players[1] &&
      !state.players[1].eliminated
    ) {
      // P2 already exists (human player) - just position it if needed
      const p2 = state.players[1];
      if (state.npcSpawnPoints && state.npcSpawnPoints.length > 0) {
        const spawnPoint = state.npcSpawnPoints[0];
        p2.pos.x = spawnPoint.x;
        p2.pos.y = spawnPoint.y;
        p2.eliminated = false;
        p2.health = 100; // Full health for tutorial
        console.log("[Tutorial] P2 (human) repositioned for tutorial combat");
      }
      // Return early - no NPC spawning needed
      return Promise.resolve();
    }

    // Get P1's character to exclude it
    const p1 = state.players[0];
    if (!p1) {
      console.warn("[Tutorial] P1 not found, cannot spawn enemy");
      return;
    }

    // Get available characters (excluding P1's character)
    const availableCharacters = [];
    if (state.selection?.characters) {
      for (const charName of Object.keys(state.selection.characters)) {
        const charData = state.selection.characters[charName];
        // Only include enabled characters that are not P1's character
        if (!charData?.disabled && charName !== p1.charName) {
          availableCharacters.push(charName);
        }
      }
    }

    // Fallback: if no characters found in selection, use hardcoded list
    if (availableCharacters.length === 0) {
      const allChars = ["cyboard", "fritz", "HP"];
      availableCharacters.push(...allChars.filter((c) => c !== p1.charName));
    }

    // Pick random character
    const randomChar =
      availableCharacters.length > 0
        ? availableCharacters[
            Math.floor(Math.random() * availableCharacters.length)
          ]
        : p1.charName; // Fallback to P1's character if no others available

    console.log(
      `[Tutorial] Spawning enemy with character: ${randomChar} (P1 is ${p1.charName})`
    );

    // Load character assets if not already loaded
    if (
      !state.characterConfigs[randomChar] &&
      window.GameAssets &&
      window.GameAssets.loadCharacterAssets
    ) {
      console.log(
        `[Tutorial] Loading assets for enemy character: ${randomChar}`
      );
      const tempState = {
        selectedCharacters: [randomChar],
        characterConfigs: state.characterConfigs,
      };
      await window.GameAssets.loadCharacterAssets(tempState);
      // Update state reference
      state.characterConfigs = tempState.characterConfigs;
    }

    // Check if assets are loaded
    if (!state.characterConfigs[randomChar]) {
      console.error(
        `[Tutorial] Failed to load assets for character: ${randomChar}`
      );
      return;
    }

    // Determine spawn position
    let spawnPos = { x: p1.pos.x + 300, y: p1.pos.y }; // Default: near P1
    if (state.npcSpawnPoints && state.npcSpawnPoints.length > 0) {
      const spawnPoint = state.npcSpawnPoints[0];
      spawnPos = { x: spawnPoint.x, y: spawnPoint.y };
    }

    // Create P2 as enemy
    if (window.Physics && window.Physics.createPlayer) {
      const p2 = window.Physics.createPlayer(state, randomChar, spawnPos, 1);
      if (p2) {
        // Ensure player is added to state.players array
        if (state.players.length <= 1) {
          state.players.push(p2);
        } else {
          state.players[1] = p2;
        }
        p2.eliminated = false;
        p2.health = 100; // Full health for tutorial
        if (passive) {
          // Passive NPC: disable controller if enabled
          if (window.NPCController && window.NPCController.isEnabled()) {
            window.NPCController.disable();
            console.log("[Tutorial] Passive NPC: Controller disabled");
          }
        } else {
          // Active NPC: enable controller
          if (window.NPCController && !window.NPCController.isEnabled()) {
            window.NPCController.enable();
            console.log("[Tutorial] Active NPC: Controller enabled");
          }
        }
        console.log(
          `[Tutorial] ${
            passive ? "Passive" : "Active"
          } enemy spawned for tutorial combat with character: ${randomChar}`
        );
      } else {
        console.warn(
          `[Tutorial] Failed to create enemy player with character: ${randomChar}`
        );
      }
    } else {
      console.warn("[Tutorial] Physics.createPlayer not available");
    }
  }

  /**
   * Update instruction panel with current step info (legacy - now uses modal system)
   */
  function updateInstructionPanel(state) {
    if (!state.tutorial || !state.tutorial.active) return;

    // Part 2 and Part 3 don't use instruction panel (use modal system instead)
    if (state.tutorial.part === 2 || state.tutorial.part === 3) {
      return;
    }

    // Legacy step-based system - could show modal messages here if needed
    // For now, instruction panel is deprecated in favor of unified modal
  }

  // Part 1 Modal lines (Beatmatch Basics)
  const PART_ONE_MODAL_INTRO = [
    "Finally here, you are. **Work that booty**, you must, yes yes.\n\nDance flamboyantly, you may... but *watchful*, you must remain. **Creeping, the diddlers are.** Always watching.\n\nYour goal: reach the **music at the top** of stage. Simple it seems... but *fail*, you might.",
  ];

  // Part 2 Modal Pages (PvP Stage 2 - Combat Tutorial)
  // Page 0: Dojo Welcome
  const PART_TWO_PAGE_DOJO = [
    "Konnichiwa, hmm. Welcome to the **dojo**, you are.\n\nWhere discipline *dies* and dancers cry, this place is. **Much pain**, you will feel.",
    "Only **one of you**, out climbs. Focus, you must. Or *fail*, you will.",
  ];

  // Page 1: UI Explanation (English)
  const PART_TWO_PAGE_UI = [
    "Cover the **basics**, we must.\n\n**Damage percent?** Higher = faster flight. *Physics hates you.*",
    "**Hearts?** Your lives. Lose them, and *set dressing* you become.",
    "**Ultimate bar?** Ten chunks of pure violence. With perfect beatmatches, earn them you must.",
  ];

  // Page 2: Beatmatch Instruction (NEW - after UI explanation)
  const PART_TWO_PAGE_BEATMATCH_INSTRUCTION = [
    "**Ten perfect beatmatches**, punch in you must. *Not eight. Not 'almost'.* **TEN.**",
    "On the bar, keep an eye you must. Like guilt, it fills.",
  ];

  // Page 3: Ultimate Explanation (shown when ultimeter is full)
  // Character-specific hints are added dynamically
  const PART_TWO_PAGE_ULTIMATE_BASE = [
    "**Full, your Ultimate is!** Dangerous in *irresponsible way*, you have become.\n\n**R3**, hit you must. Problems for everyone, it causes.",
  ];

  // Character-specific ultimate hints
  const ULTIMATE_HINTS = {
    fritz: "*Line of sight* needed. **Don't aim backwards**, hmm.",
    ernst: "At the enemy, **look you must**. Before god smites you, hmm.",
    cyboard:
      "**Teleport attack**. Miss, you cannot. Just aim and press, yes yes.",
    HP: "**Invincible bike-man**. In the nuts, kick someone he will. Absolutely.",
  };

  // Page 4: Ultimate Task (shown after NPC spawns and ultimate explanation)
  const PART_TWO_PAGE_ULTIMATE_TASK = [
    "Here, the **dummy** is. Like a piñata, *except it screams internally*.\n\nWith your Ultimate, **hit it** you must.\n\n**R3.** Press it. Make a memory.",
  ];

  // Page 5: Beat Charge Explanation (shown after ultimate hit)
  const PART_TWO_PAGE_BEAT_CHARGE_EXPLANATION = [
    "Tasted the *unsettling joy* of power, you have. **Attention**, pay you must.",
    "A special move, there is: **The Grab**.\n\nAn opponent who hoards charges, if you grab them, **steal all their power** you will. Slam it *straight back* into them.",
    "**Vaporize** hopes, dreams, and half their health bar, a charged grab can. With *emotional irresponsibility*, handle it you must.",
  ];

  // Page 6: Beat Charge Task (shown after explanation)
  const PART_TWO_PAGE_BEAT_CHARGE_TASK = [
    "Farm beatmatches however you like, you may.\n\nBut **one Beat-Charge attack**, land you must. *Don't fumble this.*",
  ];

  // Completion Modal (after beat charge hit)
  const PART_TWO_MODAL_COMPLETE = [
    "*Stone cold*, you seemed. Enjoying this, you almost were. **Worrying**, this is.\n\nFurther, advance you can now. *Violent dance therapy*, guide your soul it might... or deeper into darkness, it might take you.",
  ];

  // Part 3 Modal lines (Advanced Rhythm on pvp_stage_3)
  const PART_THREE_MODAL_INTRO = [
    "When the music starts, **legally your body must move** in rhythm. Like a puppet, you become. But *powerful* puppet, yes yes.",
    "At the top, **two UI bars collide**. The perfect beatmatch moment, they show. *Watch them*, you must.",
    "**Louder the music** = juicier bonuses. Closer to Dance Spot, *better it gets*.\n\nGain, you will:\n• **Beat Charges** — temporary boosts. *Use them fast.*\n• **Ultimate segments** — ten for full meltdown.",
  ];

  const PART_THREE_MODAL_STEP_B = [
    "**Burn those Beat Charges** on a powered hit. Bones rattle, make them you will.",
  ];

  const PART_THREE_MODAL_STEP_C = [
    "In the **eye of Dance Spot**, stand you must. Where *power doubles*, that place is.\n\n**2× Ultimate. 2× Beat Charges.** *Generous chaos-storm*, this is.",
    "Every fighter swings *differently*. But **basic attack skeleton**, follow they all:\n\n**R1** — light attack or combo. Tap it a few times, yes yes.",
    "**R1 twice quickly** = forward dash-strike. *Universal move. Universal pain.*",
    "**R2** — charged smash or dash. Longer you charge, *meaner it gets*. More damage, more priority, more regrets.",
    "**L1** — ranged grab or attack. Depends on character's *questionable life choices*, hmm.",
    "**L2** — standard special. *Wildly different* per fighter. Ranged blast, tracking hook, or something we're afraid to legally describe.",
    "Dodge and aerial dash, you have. **Gravity, only a suggestion** it is.",
  ];

  const PART_THREE_MODAL_STEP_D = [
    "If the music fades to *dying-toaster whisper* and your UI looks ghostly, **bonuses drop to a quarter**.\n\nCompounds over time, it does. Tank the market will, and pay for it you must. Pay you cannot... and therefore **my slaves** you become.\n\nShush now, little one. Or hear you complain, **BNDiddler** will. *Very dangerous*, he is, hmm.",
  ];

  function ensurePartTwoState(state) {
    if (!state?.tutorial) return null;
    if (!state.tutorial.part2) {
      state.tutorial.part2 = {
        completeModalShown: false,
        gameFrozen: false,
        currentPage: 0, // 0 = Dojo, 1 = UI, 2 = Ultimate Explanation, 3 = Ultimate Task
        uiHighlightActive: false,
        introComplete: false,
        // NEW: Step tracking for Part 2
        currentStep: "intro", // intro, beatmatch, ultimate_explain, ultimate_task, beat_charge_explain, beat_charge_task, complete
        perfectBeatsCollected: 0,
        requiredPerfectBeats: 10,
        npcSpawned: false,
        ultimateUsed: false,
        ultimateHitEnemy: false,
        beatChargeHitEnemy: false, // Track if player hit enemy with beat charges
        showBeatChargeModalTimer: -1, // NEW: Timer to delay modal
        ultimateExplainPage: 0, // Track which ultimate explanation page we're on
        beatChargeExplainPage: 0, // Track which beat charge explanation page we're on
      };
    }
    // Ensure required fields are set even if part2 already existed
    const part2 = state.tutorial.part2;
    if (
      part2.requiredPerfectBeats === undefined ||
      part2.requiredPerfectBeats === null
    ) {
      part2.requiredPerfectBeats = 10;
    }
    if (
      part2.perfectBeatsCollected === undefined ||
      part2.perfectBeatsCollected === null
    ) {
      part2.perfectBeatsCollected = 0;
    }
    if (!part2.currentStep) {
      part2.currentStep = "intro";
    }
    if (!part2.modal) {
      part2.modal = {
        visible: false,
        lines: [],
        currentLine: 0,
        charIndex: 0,
        charsPerSecond: 60,
        holdDuration: 1.1,
        holdTimer: 0,
        autoHideTimer: 0,
        hideAfter: 1.5,
        completed: false,
      };
    }
    return part2;
  }

  /**
   * Check if game should be frozen (modal visible in Part 2)
   */
  function isGameFrozen(state) {
    if (!state?.tutorial?.active) return false;
    // Use unified modal controller
    if (window.TutorialModalController?.isGameFrozen(state)) {
      return true;
    }
    // Also check part2.gameFrozen for legacy compatibility
    if (state.tutorial.part === 2) {
      const part2 = state.tutorial.part2;
      return part2?.gameFrozen === true;
    }
    return false;
  }

  /**
   * Check if UI highlight should be active (Page 1 - UI explanation)
   */
  function isUIHighlightActive(state) {
    if (!state?.tutorial?.active) return false;
    if (state.tutorial.part !== 2) return false;
    const part2 = state.tutorial.part2;
    return part2?.currentPage === 1 && part2?.modal?.visible === true;
  }

  function startPartOneIntro(state) {
    if (!state?.tutorial) return;
    if (!state.tutorial.part1) {
      state.tutorial.part1 = {};
    }
    // Show intro modal using unified system
    if (window.TutorialModalController) {
      window.TutorialModalController.show(state, "part1-intro");
    }
  }

  function startPartTwoIntro(state) {
    const part2 = ensurePartTwoState(state);
    if (!part2) return;

    // Set game freeze and start at page 0 (Dojo intro)
    part2.gameFrozen = true;
    part2.currentPage = 0;
    part2.introComplete = false;
    part2.uiHighlightActive = false;

    // Reset step tracking
    part2.currentStep = "intro";
    part2.perfectBeatsCollected = 0;
    part2.npcSpawned = false;
    part2.ultimateUsed = false;
    part2.ultimateHitEnemy = false;

    // Show first dojo modal using unified system
    if (window.TutorialModalController) {
      window.TutorialModalController.show(state, "part2-dojo-1");
    }

    console.log("[Tutorial Part 2] Game frozen, showing Dojo intro modal");
  }

  /**
   * Advance to next Part 2 page or transition between steps
   */
  function advancePartTwoPage(state) {
    const part2 = ensurePartTwoState(state);
    if (!part2) return false;

    const currentStep = part2.currentStep;

    // Handle different step transitions
    switch (currentStep) {
      case "intro":
        // During intro: advance through pages 0 (Dojo), 1 (UI), and 2 (Beatmatch Instruction)
        if (part2.currentPage === 0) {
          // Show second dojo message
          part2.currentPage = 1;
          if (window.TutorialModalController) {
            window.TutorialModalController.show(state, "part2-dojo-2");
          }
          return true;
        } else if (part2.currentPage === 1) {
          // Show first UI message
          part2.currentPage = 2;
          part2.uiHighlightActive = true;
          if (window.TutorialModalController) {
            window.TutorialModalController.show(state, "part2-ui-1");
          }
          return true;
        } else if (part2.currentPage === 2) {
          // Show second UI message
          part2.currentPage = 3;
          if (window.TutorialModalController) {
            window.TutorialModalController.show(state, "part2-ui-2");
          }
          return true;
        } else if (part2.currentPage === 3) {
          // Show third UI message
          part2.currentPage = 4;
          if (window.TutorialModalController) {
            window.TutorialModalController.show(state, "part2-ui-3");
          }
          return true;
        } else if (part2.currentPage === 4) {
          // Show first beatmatch message
          part2.currentPage = 5;
          if (window.TutorialModalController) {
            window.TutorialModalController.show(state, "part2-beatmatch-1");
          }
          return true;
        } else if (part2.currentPage === 5) {
          // Show second beatmatch message and end intro
          part2.gameFrozen = false;
          part2.uiHighlightActive = false;
          part2.introComplete = true;
          if (window.TutorialModalController) {
            window.TutorialModalController.show(state, "part2-beatmatch-2");
          }
          part2.currentStep = "beatmatch";
          console.log(
            "[Tutorial Part 2] Intro complete, starting beatmatch step - player must fill ultimeter"
          );
          return false;
        }
        return false;

      case "ultimate_explain":
        // After ultimate explanation - check if we need to show character-specific hint
        if (!part2.ultimateExplainPage) {
          part2.ultimateExplainPage = 1;
          // Show base explanation first
          if (window.TutorialModalController) {
            window.TutorialModalController.show(state, "part2-ultimate-base");
          }
          return true;
        } else if (part2.ultimateExplainPage === 1) {
          // Show character-specific hint
          const charName =
            state.selectedCharacters?.[0] ||
            state.players?.[0]?.charName ||
            "cyboard";
          const hintId =
            window.TutorialMessages?.getUltimateHintId?.(charName) ||
            "part2-ultimate-cyboard";
          part2.ultimateExplainPage = 2;
          if (window.TutorialModalController) {
            window.TutorialModalController.show(state, hintId);
          }
          return true;
        } else {
          // All explanation messages shown, show task modal
          part2.currentStep = "ultimate_task";
          part2.ultimateExplainPage = 0;
          if (window.TutorialModalController) {
            window.TutorialModalController.show(state, "part2-ultimate-task");
          }
          console.log(
            "[Tutorial Part 2] Showing ultimate task modal (NPC already spawned)"
          );
          return true;
        }

      case "ultimate_task":
        // After ultimate task confirmation - unfreeze and let player use ultimate
        part2.gameFrozen = false;
        if (window.TutorialModalController) {
          window.TutorialModalController.hide(state);
        }
        console.log(
          "[Tutorial Part 2] Ultimate task started - player must hit enemy with ultimate"
        );
        return false;

      case "beat_charge_explain":
        // After beat charge explanation - check if we need to show more explanation messages
        if (!part2.beatChargeExplainPage) {
          part2.beatChargeExplainPage = 1;
        }
        if (part2.beatChargeExplainPage === 1) {
          // Show second explanation message
          part2.beatChargeExplainPage = 2;
          if (window.TutorialModalController) {
            window.TutorialModalController.show(state, "part2-beat-charge-2");
          }
          return true;
        } else if (part2.beatChargeExplainPage === 2) {
          // Show third explanation message
          part2.beatChargeExplainPage = 3;
          if (window.TutorialModalController) {
            window.TutorialModalController.show(state, "part2-beat-charge-3");
          }
          return true;
        } else if (part2.beatChargeExplainPage === 3) {
          // All explanation messages shown, show controls modal first
          part2.beatChargeExplainPage = 4; // Use 4 for controls page
          if (window.TutorialModalController) {
            window.TutorialModalController.show(
              state,
              "part2-beat-charge-controls"
            );
          }
          console.log("[Tutorial Part 2] Showing beat charge controls modal");
          return true;
        } else if (part2.beatChargeExplainPage === 4) {
          // Controls modal shown, now show task modal
          part2.currentStep = "beat_charge_task";
          part2.beatChargeExplainPage = 0;
          if (window.TutorialModalController) {
            window.TutorialModalController.show(
              state,
              "part2-beat-charge-task"
            );
          }
          console.log("[Tutorial Part 2] Showing beat charge task modal");
          return true;
        }
        return false;

      case "beat_charge_task":
        // After beat charge task confirmation - unfreeze and let player hit enemy with beat charges
        part2.gameFrozen = false;
        if (window.TutorialModalController) {
          window.TutorialModalController.hide(state);
        }
        console.log(
          "[Tutorial Part 2] Beat charge task started - player must hit enemy with beat charge attack"
        );
        return false;

      case "complete":
        // After completion modal - end tutorial part 2
        part2.gameFrozen = false;
        part2.completeModalShown = true;
        if (window.TutorialModalController) {
          window.TutorialModalController.hide(state);
        }
        console.log(
          "[Tutorial Part 2] Complete! Transitioning to next part..."
        );
        // Transition to Part 3 or end tutorial
        transitionToNextPart(state);
        return false;

      default:
        return false;
    }
  }

  /**
   * Show Ultimate explanation modal (called when ultimeter is full)
   */
  function showUltimateExplanationModal(state) {
    const part2 = ensurePartTwoState(state);
    if (!part2) return;

    part2.gameFrozen = true;
    part2.currentStep = "ultimate_explain";
    part2.ultimateExplainPage = 1; // Start with base explanation

    // Show base ultimate explanation first
    if (window.TutorialModalController) {
      window.TutorialModalController.show(state, "part2-ultimate-base");
    }

    console.log(
      "[Tutorial Part 2] Ultimeter full! Showing ultimate explanation (NPC already spawned)"
    );
  }

  /**
   * Check if ultimeter is full in Part 2 beatmatch step
   * Called from physics update loop - checks p.ultimeter.isReady instead of counting beats
   */
  function checkPartTwoUltimeterReady(state) {
    const part2 = ensurePartTwoState(state);
    if (!part2 || part2.currentStep !== "beatmatch") return;

    const p1 = state.players?.[0];
    if (!p1) return;

    // Check if ultimeter is ready (instead of counting beats)
    if (p1.ultimeter?.isReady && !part2.ultimateReady) {
      part2.ultimateReady = true;
      console.log(
        "[Tutorial Part 2] ✅ Ultimeter is full! Spawning NPC and showing ultimate explanation..."
      );

      // SPAWN NPC NOW (last chance before showing modal)
      if (!part2.npcSpawned) {
        spawnTutorialEnemy(state, false); // Passive NPC
        part2.npcSpawned = true;
        console.log(
          "[Tutorial Part 2] NPC spawned for ultimate practice (BEFORE modal)"
        );
      }

      // Show ultimate explanation modal
      showUltimateExplanationModal(state);
    }
  }

  /**
   * Track ultimate hit on enemy in Part 2
   */
  function trackPartTwoUltimateHit(state) {
    const part2 = ensurePartTwoState(state);
    if (!part2 || part2.currentStep !== "ultimate_task") return;

    part2.ultimateHitEnemy = true;
    console.log(
      "[Tutorial Part 2] Ultimate hit enemy! Showing beat charge explanation modal"
    );

    // Show beat charge explanation modal instead of completion
    showBeatChargeExplanationModal(state);
    part2.currentStep = "beat_charge_explain";
  }

  /**
   * NEW: Check if ultimate was USED in Part 2
   * This is more reliable than waiting for a hit.
   */
  function checkPartTwoUltimateUsed(state) {
    const part2 = ensurePartTwoState(state);
    if (!part2 || part2.currentStep !== "ultimate_task" || part2.ultimateUsed) {
      return;
    }

    const p1 = state.players?.[0];
    if (!p1) return;

    // If ultimeter was ready and is now empty, player has used their ultimate.
    if (part2.ultimateReady && p1.ultimeter.current === 0) {
      part2.ultimateUsed = true;

      // NEW: Get character-specific ultimate duration for the delay
      const charKey = p1.charName.toLowerCase();
      const attackConfig =
        window.CharacterCatalog?.getAttackConfig(charKey, state) || {};
      const ultimateDuration = attackConfig.ultimate?.duration || 2.5; // Fallback to 2.5s

      console.log(
        `[Tutorial Part 2] ✅ Ultimate used by ${p1.charName}! Starting ${ultimateDuration}s delay before showing beat charge modal.`
      );

      // Start timer instead of showing modal immediately
      part2.showBeatChargeModalTimer = ultimateDuration;
    }
  }

  /**
   * Show Beat Charge explanation modal (called after ultimate hit or use)
   */
  function showBeatChargeExplanationModal(state) {
    const part2 = ensurePartTwoState(state);
    if (!part2) return;

    part2.gameFrozen = true;
    part2.currentStep = "beat_charge_explain";
    part2.beatChargeExplainPage = 1; // Start with first message

    // Show first beat charge explanation
    if (window.TutorialModalController) {
      window.TutorialModalController.show(state, "part2-beat-charge-1");
    }

    console.log(
      "[Tutorial Part 2] Ultimate section complete! Showing beat charge explanation"
    );
  }

  /**
   * Central update logic for Part 2 timers and state transitions
   */
  function updatePartTwoLogic(dt, state) {
    const part2 = ensurePartTwoState(state);
    if (!part2) return;

    // Handle delayed modal for beat charge explanation
    if (part2.showBeatChargeModalTimer > 0) {
      part2.showBeatChargeModalTimer -= dt;
      if (part2.showBeatChargeModalTimer <= 0) {
        console.log(
          "[Tutorial Part 2] Delay timer finished. Showing beat charge explanation modal."
        );
        showBeatChargeExplanationModal(state);
        part2.showBeatChargeModalTimer = -1; // Deactivate timer
      }
    }
  }

  /**
   * Track beat charge hit on enemy in Part 2
   */
  function trackPartTwoBeatChargeHit(state) {
    const part2 = ensurePartTwoState(state);
    if (!part2 || part2.currentStep !== "beat_charge_task") return;

    part2.beatChargeHitEnemy = true;
    console.log(
      "[Tutorial Part 2] Beat charge hit enemy! Showing completion modal"
    );

    // Show completion modal
    showPartTwoCompleteModal(state);
    part2.currentStep = "complete";
  }

  /**
   * Transition to next tutorial part
   */
  function transitionToNextPart(state) {
    // For now, just log - can be expanded to transition to Part 3
    console.log("[Tutorial Part 2] Tutorial Part 2 complete!");
    // TODO: Implement transition to Part 3 or end tutorial
  }

  function showPartTwoCompleteModal(state) {
    const part2 = ensurePartTwoState(state);
    if (!part2) return;

    // Freeze game during completion modal
    part2.gameFrozen = true;
    part2.currentStep = "complete";

    if (window.TutorialModalController) {
      window.TutorialModalController.show(state, "part2-complete");
    }

    console.log("[Tutorial Part 2] Showing completion modal, game frozen");
  }

  function startPartThreeIntro(state) {
    if (!state?.tutorial) return;
    if (!state.tutorial.part3) {
      state.tutorial.part3 = {
        beatCharges: 0,
        maxBeatCharges: 3,
        beatChargeAccumulator: 0,
        centerDoubleAchieved: false,
        quietZoneHintShown: false,
        ultimeterFull: false,
        ultimateUsed: false,
        tipMessage: "",
        tipTimer: 0,
        tipDuration: 0,
        currentStep: "intro",
        beatChargesCollected: false,
        chargedAttackUsed: false,
      };
    }

    const part3 = state.tutorial.part3;
    part3.beatCharges = 0;
    part3.beatChargeAccumulator = 0;
    part3.centerDoubleAchieved = false;
    part3.quietZoneHintShown = false;
    part3.ultimeterFull = false;
    part3.ultimateUsed = false;
    part3.tipMessage = "";
    part3.tipTimer = 0;
    part3.tipDuration = 0;
    part3.currentStep = "intro";
    part3.beatChargesCollected = false;
    part3.chargedAttackUsed = false;

    showPartThreeStepModal(state, "intro");
  }

  function showPartThreeStepModal(state, step) {
    if (!state?.tutorial?.part3) return;
    const part3 = state.tutorial.part3;

    switch (step) {
      case "intro":
        // Show first intro message (others will be shown on confirmation)
        if (!part3.introPage) {
          part3.introPage = 1;
        }
        if (window.TutorialModalController) {
          window.TutorialModalController.show(state, "part3-intro-1");
        }
        part3.currentStep = step;
        return;
      case "stepB":
        if (window.TutorialModalController) {
          window.TutorialModalController.show(state, "part3-step-b");
        }
        part3.currentStep = step;
        return;
      case "stepC":
        // Show first step C message (others will be shown on confirmation)
        if (!part3.stepCPage) {
          part3.stepCPage = 1;
        }
        if (window.TutorialModalController) {
          window.TutorialModalController.show(state, "part3-step-c-1");
        }
        part3.currentStep = step;
        return;
      case "stepD":
        if (window.TutorialModalController) {
          window.TutorialModalController.show(state, "part3-step-d");
        }
        part3.currentStep = step;
        return;
      default:
        console.warn(`[Tutorial] Unknown part 3 step: ${step}`);
        return;
    }
  }

  /**
   * Confirm Part 3 modal (handles multi-page sequences)
   */
  function confirmPartThreeModal(state) {
    const part3 = state?.tutorial?.part3;
    if (!part3) return false;

    // Use unified modal controller
    if (!window.TutorialModalController?.isWaitingForConfirmation(state)) {
      return false;
    }

    const wasConfirmed = window.TutorialModalController?.confirm(state);
    if (!wasConfirmed) return false;

    // Handle multi-page sequences
    if (part3.currentStep === "intro") {
      if (!part3.introPage) part3.introPage = 1;
      if (part3.introPage === 1) {
        part3.introPage = 2;
        if (window.TutorialModalController) {
          window.TutorialModalController.show(state, "part3-intro-2");
        }
        return true;
      } else if (part3.introPage === 2) {
        part3.introPage = 3;
        if (window.TutorialModalController) {
          window.TutorialModalController.show(state, "part3-intro-3");
        }
        return true;
      } else {
        // All intro messages shown
        part3.introPage = 0;
        return true;
      }
    } else if (part3.currentStep === "stepC") {
      if (!part3.stepCPage) part3.stepCPage = 1;
      const stepCMessages = [
        "part3-step-c-1",
        "part3-step-c-2",
        "part3-step-c-3",
        "part3-step-c-4",
        "part3-step-c-5",
        "part3-step-c-6",
        "part3-step-c-7",
      ];
      if (part3.stepCPage < stepCMessages.length) {
        part3.stepCPage++;
        if (window.TutorialModalController) {
          window.TutorialModalController.show(
            state,
            stepCMessages[part3.stepCPage - 1]
          );
        }
        return true;
      } else {
        // All step C messages shown
        part3.stepCPage = 0;
        return true;
      }
    }

    return true;
  }

  function resetPartThreeState(state) {
    if (!state?.tutorial) return;
    if (state.tutorial.part3) {
      state.tutorial.part3.beatCharges = 0;
      state.tutorial.part3.beatChargeAccumulator = 0;
      state.tutorial.part3.centerDoubleAchieved = false;
      state.tutorial.part3.quietZoneHintShown = false;
      state.tutorial.part3.ultimeterFull = false;
      state.tutorial.part3.ultimateUsed = false;
      state.tutorial.part3.currentStep = "intro"; // intro, stepA, stepB, stepC, stepD, stepE, stepF
      state.tutorial.part3.beatChargesCollected = false;
      state.tutorial.part3.chargedAttackUsed = false;
    }
  }

  // Unified modal update (replaces updatePartOneModal, updatePartTwoModal, updatePartThreeModal)
  function updateTutorialModal(dt, state) {
    if (window.TutorialModalController) {
      window.TutorialModalController.update(dt, state);
    }
  }

  /**
   * Confirm modal (called when player presses X button)
   * Handles page navigation for intro sequence, ultimate explanation, and completion modal
   */
  function confirmModal(state) {
    const part2 = state?.tutorial?.part2;
    if (!part2) return false;

    // Use unified modal controller
    if (!window.TutorialModalController?.isWaitingForConfirmation(state)) {
      return false;
    }

    const currentStep = part2.currentStep;
    console.log(
      `[Tutorial Part 2] confirmModal called, currentStep: ${currentStep}`
    );

    // Check if this is the completion modal (after ultimate hit)
    if (currentStep === "complete" || part2.completeModalShown) {
      console.log(
        "[Tutorial Part 2] Completion modal confirmed - transitioning to Part 3"
      );
      state.tutorial.transitionToPart3 = true;
      if (window.TutorialModalController) {
        window.TutorialModalController.hide(state);
      }
      part2.gameFrozen = false;
      return true;
    }

    // Handle step-based modal confirmations
    const wasConfirmed = window.TutorialModalController?.confirm(state);
    if (!wasConfirmed) return false;

    switch (currentStep) {
      case "intro":
        // During intro: advance through pages
        const hasMoreIntroPages = advancePartTwoPage(state);
        if (!hasMoreIntroPages) {
          console.log(
            "[Tutorial Part 2] All intro pages complete, starting beatmatch"
          );
        }
        return true;

      case "ultimate_explain":
        // After ultimate explanation - show task modal
        console.log(
          "[Tutorial Part 2] Ultimate explanation confirmed, showing task"
        );
        advancePartTwoPage(state);
        return true;

      case "ultimate_task":
        // After ultimate task confirmation - unfreeze and let player use ultimate
        console.log(
          "[Tutorial Part 2] Ultimate task confirmed, player must hit enemy"
        );
        advancePartTwoPage(state);
        return true;

      case "beat_charge_explain":
        // After beat charge explanation - show task modal
        console.log(
          "[Tutorial Part 2] Beat charge explanation confirmed, showing task"
        );
        advancePartTwoPage(state);
        return true;

      case "beat_charge_task":
        // After beat charge task confirmation - unfreeze
        console.log(
          "[Tutorial Part 2] Beat charge task confirmed, player must hit enemy"
        );
        advancePartTwoPage(state);
        return true;

      default:
        return true;
    }
  }

  function setPartTwoTip(state, message, duration = 2.5) {
    if (!state?.tutorial) return;

    // Set tip for Part 2 or Part 3
    if (state.tutorial.part === 2) {
      const part2 = ensurePartTwoState(state);
      if (!part2) return;
      part2.tipMessage = message;
      part2.tipDuration = duration;
      part2.tipTimer = duration;
    } else if (state.tutorial.part === 3) {
      if (!state.tutorial.part3) {
        state.tutorial.part3 = {
          beatCharges: 0,
          maxBeatCharges: 3,
          beatChargeAccumulator: 0,
          centerDoubleAchieved: false,
          quietZoneHintShown: false,
          ultimeterFull: false,
          ultimateUsed: false,
          tipMessage: "",
          tipTimer: 0,
          tipDuration: 0,
          modal: {
            visible: false,
            lines: [],
            currentLine: 0,
            charIndex: 0,
            charsPerSecond: 60, // 15% faster than 52
            holdDuration: 1.1,
            holdTimer: 0,
            autoHideTimer: 0,
            hideAfter: 1.5,
            completed: false,
          },
        };
      }
      const part3 = state.tutorial.part3;
      part3.tipMessage = message;
      part3.tipDuration = duration;
      part3.tipTimer = duration;
    }
  }

  function updatePartTwoTip(dt, state) {
    // Update Part 2 tips
    const part2 = state?.tutorial?.part2;
    if (part2 && part2.tipTimer > 0) {
      part2.tipTimer = Math.max(0, part2.tipTimer - dt);
      if (part2.tipTimer === 0) {
        part2.tipMessage = "";
      }
    }

    // Update Part 3 tips (reuse same system)
    const part3 = state?.tutorial?.part3;
    if (part3 && part3.tipTimer > 0) {
      part3.tipTimer = Math.max(0, part3.tipTimer - dt);
      if (part3.tipTimer === 0) {
        part3.tipMessage = "";
      }
    }
  }

  /**
   * Track attack usage for Step 1
   */
  function trackAttackUsage(state, player, attackType) {
    if (!state.tutorial?.active || state.tutorial.step !== 1) return;
    // Part 3 doesn't use step-based attack tracking (uses modal system instead)
    if (state.tutorial.part === 3) return;
    if (player.padIndex !== 0) return; // Only track P1 attacks

    const attackKey = attackType.toLowerCase();
    if (["r1", "r2", "l1", "l2"].includes(attackKey)) {
      if (!state.tutorial.stepData.step1.attacksUsed[attackKey]) {
        state.tutorial.stepData.step1.attacksUsed[attackKey] = true;
        updateInstructionPanel(state);
        console.log(
          `[Tutorial Step 1] Attack ${attackKey} used: ${
            Object.values(state.tutorial.stepData.step1.attacksUsed).filter(
              (v) => v
            ).length
          }/4`
        );
      }
    }
  }

  /**
   * Track attack hit on enemy for Step 2
   */
  function trackAttackHit(state, attacker, victim, attackType) {
    if (!state.tutorial?.active || state.tutorial.step !== 2) return;
    // Part 3 doesn't use step-based attack tracking (uses modal system instead)
    if (state.tutorial.part === 3) return;
    if (attacker.padIndex !== 0) return; // Only track P1 attacks
    if (victim.padIndex !== 1) return; // Only track hits on P2 (enemy)

    const attackKey = attackType.toLowerCase();
    if (["r1", "r2", "l1", "l2"].includes(attackKey)) {
      if (!state.tutorial.stepData.step2.attacksHit[attackKey]) {
        state.tutorial.stepData.step2.attacksHit[attackKey] = true;
        updateInstructionPanel(state);
        console.log(
          `[Tutorial Step 2] Attack ${attackKey} hit enemy: ${
            Object.values(state.tutorial.stepData.step2.attacksHit).filter(
              (v) => v
            ).length
          }/4`
        );
      }
    }
  }

  /**
   * Track perfect beat for Step 3 (legacy) and Part 2 beatmatch step
   */
  function trackPerfectBeat(state, player) {
    if (!state.tutorial?.active) return;
    if (player.padIndex !== 0) return; // Only track P1

    // Part 2: Check ultimeter ready state (instead of counting beats)
    if (
      state.tutorial.part === 2 &&
      state.tutorial.part2?.currentStep === "beatmatch"
    ) {
      // Check is done in physics update loop, not here
      return;
    }

    // Legacy Step 3 tracking
    if (state.tutorial.step !== 3) return;

    const step3 = state.tutorial.stepData.step3;
    if (step3.perfectBeatCount < step3.requiredPerfectBeats) {
      step3.perfectBeatCount++;
      updateInstructionPanel(state);
      console.log(
        `[Tutorial Step 3] Perfect beat: ${step3.perfectBeatCount}/${step3.requiredPerfectBeats}`
      );
    }
  }

  /**
   * Track charged attack for Step 3
   * Called when L2 attack is released after charging
   */
  function trackChargedAttack(state, player) {
    if (!state.tutorial?.active || state.tutorial.step !== 3) return;
    if (player.padIndex !== 0) return; // Only track P1

    const step3 = state.tutorial.stepData.step3;
    // Check if player has L2 attack and it's in release phase (charged attack performed)
    const isL2Attack =
      player.attack?.type === "l2" || player.attack?.type === "l2_ranged";
    const isReleased =
      player.attack?.phase === "release" ||
      player.attack?.phase === "jump" ||
      player.attack?.phase === "active";

    if (
      isL2Attack &&
      isReleased &&
      step3.perfectBeatCount >= step3.requiredPerfectBeats &&
      !step3.chargedAttackPerformed
    ) {
      step3.chargedAttackPerformed = true;
      updateInstructionPanel(state);
      console.log("[Tutorial Step 3] Charged L2 attack performed!");
    }
  }

  /**
   * Track dodge for Step 4
   */
  function trackDodge(state, player, currentTime) {
    if (!state.tutorial?.active || state.tutorial.step !== 4) return;
    if (player.padIndex !== 0) return; // Only track P1

    const step4 = state.tutorial.stepData.step4;
    const timeSinceLastDodge = currentTime - step4.lastDodgeTime;

    // Check if dodge is within time window (consecutive)
    if (timeSinceLastDodge <= step4.dodgeWindow || step4.lastDodgeTime === 0) {
      step4.consecutiveDodges++;
      step4.lastDodgeTime = currentTime;
      updateInstructionPanel(state);
      console.log(
        `[Tutorial Step 4] Consecutive dodge: ${step4.consecutiveDodges}/${step4.requiredDodges}`
      );
    } else {
      // Reset counter if too much time passed
      step4.consecutiveDodges = 1;
      step4.lastDodgeTime = currentTime;
      updateInstructionPanel(state);
      console.log("[Tutorial Step 4] Dodge counter reset, starting new streak");
    }
  }

  /**
   * Track beat match for Step 5
   */
  function trackBeatMatch(state, player, beatQuality) {
    if (!state.tutorial?.active || state.tutorial.step !== 5) return;
    if (player.padIndex !== 0) return; // Only track P1
    if (beatQuality !== "perfect" && beatQuality !== "good") return; // Only count successful matches

    const step5 = state.tutorial.stepData.step5;
    if (step5.beatMatchesPerformed < step5.requiredMatches) {
      step5.beatMatchesPerformed++;
      updateInstructionPanel(state);
      console.log(
        `[Tutorial Step 5] Beat match: ${step5.beatMatchesPerformed}/${step5.requiredMatches}`
      );
    }
  }

  /**
   * Advance to next step if current step is complete
   */
  function checkStepCompletion(state) {
    if (!state.tutorial?.active) return;

    const step = state.tutorial.step;
    const stepData = state.tutorial.stepData;

    // Part 2: Use step-based progression for Steps 1-3
    if (state.tutorial.part === 2) {
      // Step 3 (active NPC fight) completion is handled by trackPlayerDeath
      if (step === 3) {
        return;
      }

      // Check if current step is complete
      if (
        isStepComplete(step, stepData, state) &&
        !stepData[`step${step}`]?.complete
      ) {
        if (stepData[`step${step}`]) {
          stepData[`step${step}`].complete = true;
        }
        console.log(`[Tutorial Part 2] Step ${step} complete!`);

        const nextStep = getNextCombatStep(step, state);
        if (nextStep) {
          initializeStep(state, nextStep);
        }
      }
      return;
    }

    // Part 3 doesn't use step-based progression (uses modal system instead)
    if (state.tutorial.part === 3) {
      return;
    }

    // Legacy step progression (only for old tutorial system)
    if (
      isStepComplete(step, stepData, state) &&
      !stepData[`step${step}`]?.complete
    ) {
      if (stepData[`step${step}`]) {
        stepData[`step${step}`].complete = true;
      }
      console.log(`[Tutorial] Step ${step} complete!`);

      const nextStep = getNextCombatStep(step, state);
      if (nextStep) {
        initializeStep(state, nextStep);
      } else {
        // Check if we should transition to next part
        if (state.tutorial.part === 3) {
          // Part 3 complete, tutorial fully complete
          console.log("[Tutorial] All parts complete! Tutorial finished.");
          completeTutorial(state);
        } else {
          // Legacy: Tutorial complete
          console.log("[Tutorial] All steps complete! Tutorial finished.");
          completeTutorial(state);
        }
      }
    }
  }

  function getNextCombatStep(currentStep, state) {
    // Part 2: PvP Stage 2 steps
    if (state?.tutorial?.part === 2) {
      switch (currentStep) {
        case 1: // Schritt A: Allein, 4 Angriffe
          return 2; // Schritt B: Passiver NPC
        case 2: // Schritt B: Passiver NPC
          return 3; // Schritt C: Aktiver NPC
        case 3: // Schritt C: Aktiver NPC
          return null; // Part 2 complete, transition to Part 3
        default:
          return null;
      }
    }
    // Legacy steps (for backward compatibility)
    switch (currentStep) {
      case 1:
        return 2;
      case 2:
        return 6;
      case 6:
        return null;
      default:
        return null;
    }
  }

  /**
   * Track player death for Part 2 Step 3 completion
   */
  function trackPlayerDeath(state, player) {
    if (!state.tutorial?.active || state.tutorial.part !== 2) return;
    // Only track deaths in Step 3 (active NPC fight)
    if (state.tutorial.step !== 3) return;

    // Check if player lost a life (died)
    if (player.lives <= 0 || player.eliminated) {
      const part2 = state.tutorial.part2;
      if (part2 && !part2.completeModalShown) {
        part2.completeModalShown = true;
        console.log(
          `[Tutorial Part 2 Step 3] Player ${
            player.padIndex + 1
          } died - showing completion modal`
        );

        // Show completion modal
        showPartTwoCompleteModal(state);
      }
    }
  }

  /**
   * Complete tutorial and return to menu
   */
  function completeTutorial(state) {
    if (!state.tutorial?.active) return;

    state.tutorial.active = false;
    console.log("[Tutorial] Tutorial complete - returning to menu");

    // Return to character select menu (which shows PVP/Tutorial selection)
    if (window.AudioSystem) {
      window.AudioSystem.stopMusic(0.5);
      window.AudioSystem.playTrack("MENU_LOOP");
    }

    // Reset tutorial mode flags
    if (state.isStoryMode !== undefined) {
      state.isStoryMode = false;
    }

    // Transition to character select menu
    state.gameMode = "CHARACTER_SELECT";
    if (state.selection) {
      state.selection.p1Locked = false;
      state.selection.p2Locked = false;
    }
  }

  function resetCombatSteps(state) {
    if (!state?.tutorial?.stepData) return;
    state.tutorial.stepData.step1 = {
      attacksUsed: { r1: false, r2: false, l1: false, l2: false },
      complete: false,
    };
    state.tutorial.stepData.step2 = {
      attacksHit: { r1: false, r2: false, l1: false, l2: false },
      enemySpawned: false,
      complete: false,
    };
    state.tutorial.stepData.step3 = {
      enemyDefeated: false,
      complete: false,
    };
    state.tutorial.stepData.step6 = {
      enemyDefeated: false,
      complete: false,
    };
  }

  return {
    initializeStep,
    updateInstructionPanel,
    spawnTutorialEnemy,
    trackAttackUsage,
    trackAttackHit,
    trackPerfectBeat,
    trackChargedAttack,
    trackDodge,
    trackBeatMatch,
    trackPlayerDeath,
    checkStepCompletion,
    getInstructionText,
    isStepComplete,
    resetCombatSteps,
    completeTutorial,
    startPartOneIntro,
    startPartTwoIntro,
    showPartTwoCompleteModal,
    updateTutorialModal, // Unified modal update
    updatePartTwoTip,
    setPartTwoTip,
    confirmModal,
    advancePartTwoPage,
    isGameFrozen,
    isUIHighlightActive,
    // NEW: Part 2 step tracking
    checkPartTwoUltimeterReady,
    trackPartTwoUltimateHit,
    checkPartTwoUltimateUsed,
    updatePartTwoLogic,
    trackPartTwoBeatChargeHit,
    showUltimateExplanationModal,
    showBeatChargeExplanationModal,
    getPartTwoCurrentStep: (state) => state?.tutorial?.part2?.currentStep,
    getPartTwoPerfectBeats: (state) =>
      state?.tutorial?.part2?.perfectBeatsCollected || 0,
    getPartTwoRequiredBeats: (state) =>
      state?.tutorial?.part2?.requiredPerfectBeats || 10,
    startPartThreeIntro,
    resetPartThreeState,
    showPartThreeStepModal,
    confirmPartThreeModal,
  };
})();
