window.DanceSpotManager = (() => {
  // Configuration
  const SPOT_CHANGE_BARS = 16; // Change spot every 16 bars
  const MAX_FADE_DISTANCE = 600; // Distance where music is fully silent (Outer Radius)
  const MIN_FADE_DISTANCE = 150; // Distance where music is max volume (Inner Radius)
  const CENTER_FADE_DISTANCE = 75; // NEW: Distance for Bloom Effect (Center Radius)
  const UI_VISIBLE_THRESHOLD = 0.1; // Alpha threshold to show UI

  let spots = [];
  let activeSpotIndex = -1;
  let isInitialized = false;

  function init(state) {
    console.log(
      `[DanceSpotManager] Initializing... zoneData: ${!!state.zoneData}, specialData: ${!!state.specialData}, availableSpots: ${
        state.danceMode?.availableSpots?.length || 0
      }`
    );

    // 1. Try to spawn spots via Physics if not already done
    if (
      (!state.danceMode?.availableSpots ||
        state.danceMode.availableSpots.length === 0) &&
      window.Physics &&
      window.Physics.spawnDanceSpotsFromHeatmap
    ) {
      console.log(
        `[DanceSpotManager] Attempting to spawn spots from heatmap...`
      );
      window.Physics.spawnDanceSpotsFromHeatmap(state);
    }

    // 2. Load spots from state
    if (
      state.danceMode &&
      state.danceMode.availableSpots &&
      state.danceMode.availableSpots.length > 0
    ) {
      spots = state.danceMode.availableSpots;
      console.log(
        `[DanceSpotManager] Initialized with ${spots.length} spots.`,
        spots.map(
          (s) => `Spot at (${s.pos.x.toFixed(1)}, ${s.pos.y.toFixed(1)})`
        )
      );
    } else {
      console.warn(
        `[DanceSpotManager] No dance spots found. zoneData: ${!!state.zoneData}, specialData: ${!!state.specialData}, stageFxAtlas: ${!!state.stageFxAtlas}`
      );
      spots = [];
    }

    if (spots.length > 0) {
      // Initialize State if needed
      if (!state.danceMode) state.danceMode = {};

      state.danceMode.active = true;
      state.danceMode.spots = spots; // Store full objects
      state.danceMode.proximityAlpha = 0;
      state.danceMode.barCount = 0;

      // Select Initial Spot
      if (window.Physics && window.Physics.selectRandomActiveSpot) {
        window.Physics.selectRandomActiveSpot(state);
        syncActiveSpotIndex(state);
      } else {
        selectNewRandomSpot(state);
      }

      console.log(`[DanceSpotManager] Active Spot Index: ${activeSpotIndex}`);
    } else {
      state.danceMode = { active: false };
    }

    isInitialized = true;
  }

  function syncActiveSpotIndex(state) {
    if (state.danceMode.currentActiveSpot) {
      const idx = spots.findIndex(
        (s) =>
          s === state.danceMode.currentActiveSpot ||
          (s.pos.x === state.danceMode.currentActiveSpot.pos.x &&
            s.pos.y === state.danceMode.currentActiveSpot.pos.y)
      );
      if (idx !== -1) activeSpotIndex = idx;
    }
  }

  function selectNewRandomSpot(state) {
    // Internal fallback if Physics is missing
    if (spots.length === 0) return;

    // Simple random selection different from current
    let newIndex = activeSpotIndex;
    if (spots.length > 1) {
      while (newIndex === activeSpotIndex) {
        newIndex = Math.floor(Math.random() * spots.length);
      }
    } else {
      newIndex = 0;
    }

    activeSpotIndex = newIndex;
    state.danceMode.activeSpotIndex = activeSpotIndex;
    state.danceMode.currentActiveSpot = spots[activeSpotIndex];

    // Reset active effects on spots (if any visual logic uses this)
    spots.forEach((s, i) => {
      s.isActive = i === activeSpotIndex;
    });

    console.log(
      `[DanceSpotManager] New Active Spot (Internal): ${activeSpotIndex}`
    );
  }

  function update(dt, state) {
    if (!state.danceMode?.active || spots.length === 0) return;

    // 1. Handle Rotation Timer (16 Bars)
    // Only if AudioSystem is available (use fallback timing when audio is blocked)
    if (window.AudioSystem) {
      const isPlaying = AudioSystem.isPlaying ? AudioSystem.isPlaying() : false;
      let currentMusicTime = 0;
      if (AudioSystem.getMusicTime) {
        currentMusicTime = AudioSystem.getMusicTime() || 0;
      }
      if (currentMusicTime <= 0) {
        const stageStartTime = state.stageStartTime || 0;
        currentMusicTime = Math.max(
          0,
          (performance.now() / 1000 - stageStartTime) * 1000
        );
      }
      const BPM = state.currentBPM || 120;
      const beatDuration = 60000 / BPM;
      const barDuration = beatDuration * 4;
      const currentBar = Math.floor(currentMusicTime / barDuration);

      if (state.danceMode.barCount !== currentBar) {
        if (currentBar % SPOT_CHANGE_BARS === 0 && currentBar > 0) {
          if (window.Physics && window.Physics.selectRandomActiveSpot) {
            window.Physics.selectRandomActiveSpot(state);
            syncActiveSpotIndex(state);
          } else {
            selectNewRandomSpot(state);
          }

          // Optional: Trigger Battle or FX
          if (window.Physics && window.Physics.startDanceBattle) {
            window.Physics.startDanceBattle(state);
          }
        }
        state.danceMode.barCount = currentBar;
      }
    }

    // 2. Calculate Intensity based on Distance to Active Spot
    const activeSpot = state.danceMode.currentActiveSpot;
    if (!activeSpot) {
      for (const p of state.players) {
        if (p.danceSpotDirection) delete p.danceSpotDirection;
      }
      return;
    }

    activeSpot.playerIntensities = {};
    activeSpot.playerVectors = {};
    activeSpot.playerWorldPositions = {};
    activeSpot.p1RingIntensity = 0;
    activeSpot.p2RingIntensity = 0;

    let maxIntensity = 0.0;

    for (const p of state.players) {
      if (p.eliminated) {
        if (p.danceSpotDirection) delete p.danceSpotDirection;
        continue;
      }

      // Get player feet position
      const pHb = Renderer.getHurtbox(p);
      const pX = pHb.left + pHb.w / 2;
      const pY = pHb.top + pHb.h; // Feet

      // Calculate Euclidean distance to spot center
      const dist = Math.hypot(pX - activeSpot.pos.x, pY - activeSpot.pos.y);

      // Map distance to intensity (0.0 to 1.0)
      let intensity = 0.0;
      let saturation = 0.0;
      let bloom = 0.0;

      if (dist <= MIN_FADE_DISTANCE) {
        intensity = 1.0; // Full intensity inside inner radius
        saturation = 1.0; // Full saturation
      } else if (dist >= MAX_FADE_DISTANCE) {
        intensity = 0.0; // No intensity outside outer radius
        saturation = 0.0; // Black & White
      } else {
        // Linear fade out
        const range = MAX_FADE_DISTANCE - MIN_FADE_DISTANCE;
        const progress = (dist - MIN_FADE_DISTANCE) / range;
        intensity = 1.0 - progress;

        // Saturation curve (can be tweaked, currently linear with intensity)
        saturation = intensity;
      }

      // Calculate Bloom (only in center)
      if (dist <= CENTER_FADE_DISTANCE) {
        const bloomProgress = dist / CENTER_FADE_DISTANCE;
        bloom = 1.0 - bloomProgress; // 1.0 at center, 0.0 at edge
      }

      p.danceZoneIntensity = intensity;
      p.danceZoneSaturation = saturation;
      p.danceZoneBloom = bloom;

      const resolvedIndex =
        typeof p.padIndex === "number" && p.padIndex >= 0
          ? p.padIndex
          : state.players.indexOf(p);
      const playerIndex = resolvedIndex >= 0 ? resolvedIndex : 0;
      const dirX =
        dist > 0.001 ? (activeSpot.pos.x - pX) / dist : 0;
      const dirY =
        dist > 0.001 ? (activeSpot.pos.y - pY) / dist : 0;

      activeSpot.playerIntensities[playerIndex] = intensity;
      activeSpot.playerVectors[playerIndex] = {
        dx: dirX,
        dy: dirY,
        distance: dist,
        intensity,
      };
      activeSpot.playerWorldPositions[playerIndex] = { x: pX, y: pY };

      if (playerIndex === 0) {
        activeSpot.p1RingIntensity = intensity;
      } else if (playerIndex === 1) {
        activeSpot.p2RingIntensity = intensity;
      }

      if (intensity > 0.05) {
        p.danceSpotDirection = {
          dx: dirX,
          dy: dirY,
          distance: dist,
          intensity,
        };
      } else if (p.danceSpotDirection) {
        delete p.danceSpotDirection;
      }

      if (intensity > maxIntensity) maxIntensity = intensity;
    }

    // 3. Smooth Transition for Global Volume/Alpha
    const targetAlpha = maxIntensity;
    const currentAlpha = state.danceMode.proximityAlpha || 0;

    // Smooth interpolate
    const lerpSpeed = 2.0;
    const newAlpha =
      currentAlpha + (targetAlpha - currentAlpha) * dt * lerpSpeed;

    state.danceMode.proximityAlpha = newAlpha;

    // 4. Apply System Effects
    if (window.AudioSystem) {
      AudioSystem.setVolume(newAlpha);
    }

    state.danceMode.uiVisible = newAlpha > UI_VISIBLE_THRESHOLD;
  }

  // Deprecated/Legacy Helper (kept if anything external calls it, but redirected)
  function isPlayerInRadius(player, state) {
    // Just check the calculated intensity
    return (player.danceZoneIntensity || 0) > 0.8;
  }

  return {
    init,
    update,
    isPlayerInRadius,
  };
})();
