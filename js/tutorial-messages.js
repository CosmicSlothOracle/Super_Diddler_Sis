/**
 * Tutorial Message Data Store
 * Centralized repository for all tutorial text content
 */

window.TutorialMessages = (() => {
  const messages = {
    // Part 1 Messages (Beatmatch Basics)
    "part1-intro": {
      id: "part1-intro",
      title: "PART 1 — Intro",
      body: "You have arrived.\nStatistically unlikely.\n\nDance freely if you must.\nDance carelessly and you will be noticed.\nYou are always being watched.\n\nYour goal is simple:\nreach the music at the top of the stage.\n\nSimple does not mean safe.",
      autoDismissMs: 8000,
    },

    // Part 2 Messages (PvP Stage 2 - Combat Tutorial)
    "part2-dojo-1": {
      id: "part2-dojo-1",
      title: "PART 2 — Dojo / Combat Tutorial",
      body: "Welcome.\nThis is where confidence erodes.",
      autoDismissMs: null,
    },
    "part2-dojo-2": {
      id: "part2-dojo-2",
      title: "PART 2 — Dojo / Combat Tutorial",
      body: "Only one of you proceeds.\nFocus helps.\nFailure is prepared.",
      autoDismissMs: null,
    },
    "part2-ui-1": {
      id: "part2-ui-1",
      title: "UI Basics",
      body: "**Damage Percent** (left side inside the square panel at top left):\nHigher damage percent means faster flight.\nPhysics dislikes you.",
      autoDismissMs: null,
    },
    "part2-ui-2": {
      id: "part2-ui-2",
      title: "UI Basics",
      body: "**Hearts** (inside the square panel at top left, below the percentage):\nHearts are lives.\nLose them and become decoration.",
      autoDismissMs: null,
    },
    "part2-ui-3": {
      id: "part2-ui-3",
      title: "UI Basics",
      body: "**Ultimate Bar** (at the top inside the square panel at top left, ten segments):\nPerfect beatmatches fill it.\nAlmost does not.",
      autoDismissMs: null,
    },
    "part2-beatmatch-1": {
      id: "part2-beatmatch-1",
      title: "Beatmatch Task",
      body: "Land ten perfect beatmatches.\nNot fewer.\nWatch the **Ultimate Bar** (at the top inside the square panel at top left).\nIt fills slowly. Like guilt.\n\n[[action:Dance]]: [[controller:Circle]] / [[keyboard:D]]",
      autoDismissMs: null,
    },
    "part2-beatmatch-2": {
      id: "part2-beatmatch-2",
      title: "Beatmatch Task",
      body: "Land ten perfect beatmatches.\nNot fewer.\nWatch the **Ultimate Bar** (at the top inside the square panel at top left).\nIt fills slowly. Like guilt.\n\n[[action:Dance]]: [[controller:Circle]] / [[keyboard:D]]",
      autoDismissMs: null,
    },
    "part2-ultimate-base": {
      id: "part2-ultimate-base",
      title: "Ultimate Ready",
      body: "Your Ultimate is full.\nThis makes you briefly dangerous.\n\n[[action:Ultimate]]: [[controller:R3]] / [[keyboard:W+R]]\n\nPress it.\nHesitation creates problems.",
      autoDismissMs: null,
    },
    "part2-ultimate-fritz": {
      id: "part2-ultimate-fritz",
      title: "Ultimate",
      body: "You require a clear line of sight. Don't aim heroically over your shoulder; it accomplishes nothing but confusion.\n\n[[action:Ultimate]]: [[controller:R3]] / [[keyboard:W+R]]",
      autoDismissMs: null,
    },
    "part2-ultimate-ernst": {
      id: "part2-ultimate-ernst",
      title: "Ultimate",
      body: "Look at your opponent before firing. The heavens have strong opinions on misdirected smiting.\n\n[[action:Ultimate]]: [[controller:R3]] / [[keyboard:W+R]]",
      autoDismissMs: null,
    },
    "part2-ultimate-cyboard": {
      id: "part2-ultimate-cyboard",
      title: "Ultimate",
      body: "A teleporting strike. Simply aim and activate. Missing is technically possible, but would raise many uncomfortable questions.\n\n[[action:Ultimate]]: [[controller:R3]] / [[keyboard:W+R]]",
      autoDismissMs: null,
    },
    "part2-ultimate-hp": {
      id: "part2-ultimate-hp",
      title: "Ultimate",
      body: "An invincible motorcyclist with a fondness for dramatic kicks. He will strike precisely where dignity is most fragile.\n\n[[action:Ultimate]]: [[controller:R3]] / [[keyboard:W+R]]",
      autoDismissMs: null,
    },
    "part2-ultimate-task": {
      id: "part2-ultimate-task",
      title: "Ultimate Task",
      body: "The dummy exists to be harmed.\nUse your Ultimate.\nHit it.\n\n[[action:Ultimate]]: [[controller:R3]] / [[keyboard:W+R]]\n\nMake it memorable.",
      autoDismissMs: null,
    },
    "part2-beat-charge-controls": {
      id: "part2-beat-charge-controls",
      title: "Controls",
      body: "", // Will be populated dynamically based on character
      autoDismissMs: null,
    },
    "part2-beat-charge-1": {
      id: "part2-beat-charge-1",
      title: "Beat Charge Explanation",
      body: "Power feels good.\nThis is a problem.",
      autoDismissMs: null,
    },
    "part2-beat-charge-2": {
      id: "part2-beat-charge-2",
      title: "Beat Charge Explanation",
      body: "There is a grab.\nIf the opponent hoards power, take it.\nThen return it.\nViolently.\n\n[[action:Grab]]: [[controller:Triangle]] / [[keyboard:A]]",
      autoDismissMs: null,
    },
    "part2-beat-charge-3": {
      id: "part2-beat-charge-3",
      title: "Beat Charge Explanation",
      body: "This erases health and optimism.\nUse irresponsibly.",
      autoDismissMs: null,
    },
    "part2-beat-charge-task": {
      id: "part2-beat-charge-task",
      title: "Beat Charge Task",
      body: "Farm however you like.\nBut land one charged attack.\n\n[[action:Attacks]]: [[controller:R1]] [[keyboard:Q]] / [[controller:R2]] [[keyboard:W]] / [[controller:L1]] [[keyboard:E]] / [[controller:L2]] [[keyboard:R]]\n\nDo not fumble.",
      autoDismissMs: null,
    },
    "part2-complete": {
      id: "part2-complete",
      title: "Completion",
      body: "You seemed calm.\nAlmost pleased.\n\nConcerning.\n\nYou may continue.\nWhether this helps or ruins you\nremains unclear.",
      autoDismissMs: null,
    },

    // Part 2 Step-based messages (for instruction panel replacement)
    "part2-step1": {
      id: "part2-step1",
      title: "Warm-up",
      body: "Führe jetzt alle vier Angriffe aus\n\n[[action:Light Attack]]: [[controller:R1]] / [[keyboard:Q]]\n[[action:Heavy Attack]]: [[controller:R2]] / [[keyboard:W]]\n[[action:Special]]: [[controller:L1]] / [[keyboard:E]]\n[[action:Charged Attack]]: [[controller:L2]] / [[keyboard:R]] (halten und loslassen)",
      autoDismissMs: null,
    },
    "part2-step2": {
      id: "part2-step2",
      title: "Combat Practice",
      body: "Teste deine Angriffe jetzt an diesem Gegner\n\nFühre Angriffe auf den passiven NPC aus. Mindestens 4 Treffer erforderlich.",
      autoDismissMs: null,
    },
    "part2-step3": {
      id: "part2-step3",
      title: "Fight",
      body: "Kämpfe jetzt gegen diesen Gegner\n\nKämpfe bis einer von euch K.O. geht. Nutze alles, was du gelernt hast.",
      autoDismissMs: null,
    },

    // Part 3 Messages (Advanced Rhythm on pvp_stage_3)
    "part3-intro-1": {
      id: "part3-intro-1",
      title: "PART 3 — Advanced Rhythm",
      body: "When the music starts,\nyour body must obey.",
      autoDismissMs: null,
    },
    "part3-intro-2": {
      id: "part3-intro-2",
      title: "PART 3 — Advanced Rhythm",
      body: "At the top, two bars align.\nThat is the moment.\nMiss it.",
      autoDismissMs: null,
    },
    "part3-intro-3": {
      id: "part3-intro-3",
      title: "PART 3 — Advanced Rhythm",
      body: "Louder music means better rewards.\nCloser is stronger.\n\nBeat Charges are temporary.\nUltimate segments lead to collapse.",
      autoDismissMs: null,
    },
    "part3-step-b": {
      id: "part3-step-b",
      title: "Beat Charges",
      body: "Spend them on powered hits.\nThings will break.\n\n[[action:Collect]]: [[controller:Circle]] / [[keyboard:D]]\n[[action:Use]]: Any attack while charged",
      autoDismissMs: null,
    },
    "part3-step-c-1": {
      id: "part3-step-c-1",
      title: "Dance Spot & Controls",
      body: "Stand in the Dance Spot.\nPower doubles.",
      autoDismissMs: null,
    },
    "part3-step-c-2": {
      id: "part3-step-c-2",
      title: "Dance Spot & Controls",
      body: "[[action:Light attacks]]: [[controller:R1]] / [[keyboard:Q]]\n[[action:Dash strikes]]: [[controller:R1]] (double tap) / [[keyboard:Q]] (double tap)\n[[action:Charged smashes]]: [[controller:R2]] / [[keyboard:W]]\n[[action:Specials]]: [[controller:L1]] / [[keyboard:E]] (varies by character)\n[[action:Specials]]: [[controller:L2]] / [[keyboard:R]] (varies by character)",
      autoDismissMs: null,
    },
    "part3-step-c-3": {
      id: "part3-step-c-3",
      title: "Dance Spot & Controls",
      body: "You can dodge.\nYou can dash in the air.\nGravity is optional.\n\n[[action:Dodge]]: [[controller:Square]] / [[keyboard:Shift]]\n[[action:Dash]]: [[controller:R1]] (double tap) / [[keyboard:Q]] (double tap)",
      autoDismissMs: null,
    },
    "part3-step-c-4": {
      id: "part3-step-c-4",
      title: "Dance Spot & Controls",
      body: "You can dodge.\nYou can dash in the air.\nGravity is optional.\n\n[[action:Dodge]]: [[controller:Square]] / [[keyboard:Shift]]\n[[action:Dash]]: [[controller:R1]] (double tap) / [[keyboard:Q]] (double tap)",
      autoDismissMs: null,
    },
    "part3-step-c-5": {
      id: "part3-step-c-5",
      title: "Dance Spot & Controls",
      body: "You can dodge.\nYou can dash in the air.\nGravity is optional.\n\n[[action:Dodge]]: [[controller:Square]] / [[keyboard:Shift]]\n[[action:Dash]]: [[controller:R1]] (double tap) / [[keyboard:Q]] (double tap)",
      autoDismissMs: null,
    },
    "part3-step-c-6": {
      id: "part3-step-c-6",
      title: "Dance Spot & Controls",
      body: "You can dodge.\nYou can dash in the air.\nGravity is optional.\n\n[[action:Dodge]]: [[controller:Square]] / [[keyboard:Shift]]\n[[action:Dash]]: [[controller:R1]] (double tap) / [[keyboard:Q]] (double tap)",
      autoDismissMs: null,
    },
    "part3-step-c-7": {
      id: "part3-step-c-7",
      title: "Dance Spot & Controls",
      body: "You can dodge.\nYou can dash in the air.\nGravity is optional.\n\n[[action:Dodge]]: [[controller:Square]] / [[keyboard:Shift]]\n[[action:Dash]]: [[controller:R1]] (double tap) / [[keyboard:Q]] (double tap)",
      autoDismissMs: null,
    },
    "part3-step-d": {
      id: "part3-step-d",
      title: "Low Music Warning",
      body: "When the music fades,\nbonuses collapse.\n\nThis stacks.\nLike debt.\n\nEventually you pay.\nIf you cannot,\nyou work for me.\n\nBe quiet now.\nSomeone is listening.",
      autoDismissMs: null,
    },

    // Legacy step-based messages (for backward compatibility)
    "step1-attacks": {
      id: "step1-attacks",
      title: "Warm-up",
      body: "Warm-up: test each attack once\n\n[[action:Quick Jab]]: [[controller:R1]] / [[keyboard:Q]]\n[[action:Heavy Strike]]: [[controller:R2]] / [[keyboard:W]]\n[[action:Special]]: [[controller:L1]] / [[keyboard:E]]\n[[action:Charged Attack]]: [[controller:L2]] / [[keyboard:R]] (hold and release)",
      autoDismissMs: null,
    },
    "step2-hits": {
      id: "step2-hits",
      title: "Combat Practice",
      body: "Apply it: hit the sparring bot with every move\n\nClose the distance and land [[controller:R1]] [[keyboard:Q]], [[controller:R2]] [[keyboard:W]], [[controller:L1]] [[keyboard:E]], and a charged [[controller:L2]] [[keyboard:R]] on the enemy once each.",
      autoDismissMs: null,
    },
    "step3-beats": {
      id: "step3-beats",
      title: "Beat Matching",
      body: "Match the beat! Watch the top bar - each beat lights up\n\n[[action:Collect perfect beats]]: [[controller:Circle]] / [[keyboard:D]] (green feedback), then hold [[controller:L2]] [[keyboard:R]] to charge and release on beat",
      autoDismissMs: null,
    },
    "step4-dodge": {
      id: "step4-dodge",
      title: "Dodging",
      body: "[[action:Dodge]]: [[controller:Square]] / [[keyboard:Shift]]\n\nDodge 3 times in a row to complete this step",
      autoDismissMs: null,
    },
    "step5-beatmatch": {
      id: "step5-beatmatch",
      title: "Beat Matching",
      body: "The top bar shows the music beats - 4 beats per bar\n\nTime your attacks with the beats for bonus damage! Green = Perfect, Yellow = Good, Red = Miss\n\n[[action:Dance]]: [[controller:Circle]] / [[keyboard:D]]",
      autoDismissMs: null,
    },
    "step6-defeat": {
      id: "step6-defeat",
      title: "Final Challenge",
      body: "Defeat the enemy!\n\nUse everything you've learned to defeat your opponent",
      autoDismissMs: null,
    },
  };

  /**
   * Get a message by ID
   * @param {string} id - Message ID
   * @returns {Object|null} Message object or null if not found
   */
  function getMessage(id) {
    return messages[id] || null;
  }

  /**
   * Get all messages
   * @returns {Array} Array of all message objects
   */
  function getAllMessages() {
    return Object.values(messages);
  }

  /**
   * Get character-specific ultimate hint message ID
   * @param {string} charName - Character name (lowercase)
   * @returns {string|null} Message ID or null
   */
  function getUltimateHintId(charName) {
    const charNameLower = charName.toLowerCase();
    const hintMap = {
      fritz: "part2-ultimate-fritz",
      ernst: "part2-ultimate-ernst",
      cyboard: "part2-ultimate-cyboard",
      hp: "part2-ultimate-hp",
    };
    return hintMap[charNameLower] || "part2-ultimate-cyboard"; // Default to cyboard
  }

  /**
   * Get character-specific L1/L2 description
   * @param {string} charName - Character name
   * @returns {Object} Object with l1Desc and l2Desc
   */
  function getCharacterSpecificControls(charName) {
    const charNameLower = (charName || "").toLowerCase();
    const controls = {
      fritz: {
        l1: "Jab Combo or Smash",
        l2: "Charged DoT Attack",
      },
      hp: {
        l1: "Ranged Grab",
        l2: "Ranged Projectile",
      },
      ernst: {
        l1: "Ranged Grab",
        l2: "Ranged Projectile",
      },
      cyboard: {
        l1: "Bomb Projectile",
        l2: "Smash Attack",
      },
      charly: {
        l1: "Ranged Grab",
        l2: "Ranged Projectile",
      },
    };
    return controls[charNameLower] || controls.cyboard; // Default to cyboard
  }

  /**
   * Get beat charge controls message with character-specific info
   * @param {string} charName - Character name
   * @returns {string} Controls message body
   */
  function getBeatChargeControlsMessage(charName) {
    const charControls = getCharacterSpecificControls(charName);
    return `[[action:Dance]] (collect charges): [[controller:Circle]] / [[keyboard:D]]\n[[action:Grab]] (steal charges): [[controller:Triangle]] / [[keyboard:A]]\n[[action:Ultimate]]: [[controller:R3]] / [[keyboard:W+R]]\n\nCharacter-Specific:\n[[controller:L1]] ([[keyboard:E]]): ${charControls.l1}\n[[controller:L2]] ([[keyboard:R]]): ${charControls.l2}`;
  }

  /**
   * Get beat charge controls message (character-specific)
   * @param {Object} state - Game state (to get current character)
   * @returns {string} Message ID
   */
  function getBeatChargeControlsMessageId(state) {
    const p1 = state?.players?.[0];
    const charName = p1?.charName || "cyboard";
    return "part2-beat-charge-controls";
  }

  /**
   * Get beat charge controls message body (character-specific)
   * @param {Object} state - Game state (to get current character)
   * @returns {string} Message body
   */
  function getBeatChargeControlsBody(state) {
    const p1 = state?.players?.[0];
    const charName = p1?.charName || "cyboard";
    return getBeatChargeControlsMessage(charName);
  }

  return {
    getMessage,
    getAllMessages,
    getUltimateHintId,
    getCharacterSpecificControls,
    getBeatChargeControlsMessage,
    getBeatChargeControlsMessageId,
    getBeatChargeControlsBody,
  };
})();
