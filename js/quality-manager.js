// Quality Manager System
// Centralized quality settings management with adaptive scaling
window.QualityManager = (() => {
  let currentPreset = 'medium';
  let deviceTier = 'medium';
  let manualOverride = null;

  // Quality presets with per-setting values
  const PRESETS = {
    low: {
      particleMaxCount: 50,
      particleQuality: 0.5,
      renderScale: 0.75,
      webglEffects: false,
      snowEnabled: false,
      stageAnimations: false,
      textureQuality: 0.5,
      maxParticlesPerSystem: 20,
    },
    medium: {
      particleMaxCount: 100,
      particleQuality: 0.75,
      renderScale: 0.9,
      webglEffects: true,
      snowEnabled: false,
      stageAnimations: true,
      textureQuality: 0.75,
      maxParticlesPerSystem: 50,
    },
    high: {
      particleMaxCount: 200,
      particleQuality: 1.0,
      renderScale: 1.0,
      webglEffects: true,
      snowEnabled: true,
      stageAnimations: true,
      textureQuality: 1.0,
      maxParticlesPerSystem: 100,
    },
    ultra: {
      particleMaxCount: 300,
      particleQuality: 1.0,
      renderScale: 1.0,
      webglEffects: true,
      snowEnabled: true,
      stageAnimations: true,
      textureQuality: 1.0,
      maxParticlesPerSystem: 150,
    },
  };

  // Performance tracking for adaptive quality
  let frameTimeHistory = [];
  const FRAME_TIME_HISTORY_SIZE = 60; // Track last 60 frames
  let consecutiveSlowFrames = 0;
  let consecutiveFastFrames = 0;
  const SLOW_FRAME_THRESHOLD = 20; // ms
  const FAST_FRAME_THRESHOLD = 14; // ms
  const ADAPT_DOWN_THRESHOLD = 3; // Consecutive slow frames to degrade
  const ADAPT_UP_THRESHOLD = 60; // Consecutive fast frames to improve

  function getPresetOrder() {
    return ['low', 'medium', 'high', 'ultra'];
  }

  function getPresetIndex(preset) {
    return getPresetOrder().indexOf(preset);
  }

  function getNextLowerPreset(preset) {
    const order = getPresetOrder();
    const index = getPresetIndex(preset);
    if (index > 0) {
      return order[index - 1];
    }
    return preset; // Already at lowest
  }

  function getNextHigherPreset(preset) {
    const order = getPresetOrder();
    const index = getPresetIndex(preset);
    if (index < order.length - 1) {
      return order[index + 1];
    }
    return preset; // Already at highest
  }

  return {
    init(deviceTierOverride = null) {
      if (deviceTierOverride) {
        deviceTier = deviceTierOverride;
      } else if (window.DeviceCapabilityDetector) {
        deviceTier = window.DeviceCapabilityDetector.getTier();
      }

      // Set initial preset based on device tier
      if (!manualOverride) {
        currentPreset = deviceTier;
      } else {
        currentPreset = manualOverride;
      }

      // Ensure preset is valid
      if (!PRESETS[currentPreset]) {
        currentPreset = 'medium';
      }

      console.log(`[QualityManager] Initialized with preset: ${currentPreset} (device tier: ${deviceTier})`);
      return currentPreset;
    },

    getQualityPreset() {
      return currentPreset;
    },

    getSetting(key) {
      const preset = PRESETS[currentPreset];
      if (!preset) {
        console.warn(`[QualityManager] Invalid preset: ${currentPreset}, using medium`);
        return PRESETS.medium[key];
      }
      return preset[key];
    },

    setQualityPreset(preset) {
      if (!PRESETS[preset]) {
        console.warn(`[QualityManager] Invalid preset: ${preset}`);
        return false;
      }
      manualOverride = preset;
      currentPreset = preset;
      console.log(`[QualityManager] Quality preset manually set to: ${preset}`);
      return true;
    },

    adaptQuality(frameTime) {
      if (manualOverride) {
        // Don't adapt if manually overridden
        return;
      }

      // Add frame time to history
      frameTimeHistory.push(frameTime);
      if (frameTimeHistory.length > FRAME_TIME_HISTORY_SIZE) {
        frameTimeHistory.shift();
      }

      // Check for slow frames
      if (frameTime > SLOW_FRAME_THRESHOLD) {
        consecutiveSlowFrames++;
        consecutiveFastFrames = 0;

        // Degrade quality if consistently slow
        if (consecutiveSlowFrames >= ADAPT_DOWN_THRESHOLD) {
          const lowerPreset = getNextLowerPreset(currentPreset);
          if (lowerPreset !== currentPreset) {
            console.log(`[QualityManager] Degrading quality: ${currentPreset} -> ${lowerPreset} (frame time: ${frameTime.toFixed(2)}ms)`);
            currentPreset = lowerPreset;
            consecutiveSlowFrames = 0;
          }
        }
      } else if (frameTime < FAST_FRAME_THRESHOLD) {
        consecutiveFastFrames++;
        consecutiveSlowFrames = 0;

        // Improve quality if consistently fast
        if (consecutiveFastFrames >= ADAPT_UP_THRESHOLD) {
          const higherPreset = getNextHigherPreset(currentPreset);
          // Don't exceed device tier
          const deviceTierIndex = getPresetIndex(deviceTier);
          const higherPresetIndex = getPresetIndex(higherPreset);
          if (higherPresetIndex <= deviceTierIndex && higherPreset !== currentPreset) {
            console.log(`[QualityManager] Improving quality: ${currentPreset} -> ${higherPreset} (frame time: ${frameTime.toFixed(2)}ms)`);
            currentPreset = higherPreset;
            consecutiveFastFrames = 0;
          }
        }
      } else {
        // Reset counters for normal frame times
        consecutiveSlowFrames = Math.max(0, consecutiveSlowFrames - 1);
        consecutiveFastFrames = Math.max(0, consecutiveFastFrames - 1);
      }
    },

    getFrameTimeStats() {
      if (frameTimeHistory.length === 0) {
        return { min: 0, max: 0, avg: 0 };
      }
      const min = Math.min(...frameTimeHistory);
      const max = Math.max(...frameTimeHistory);
      const avg = frameTimeHistory.reduce((a, b) => a + b, 0) / frameTimeHistory.length;
      return { min, max, avg };
    },

    resetAdaptation() {
      frameTimeHistory = [];
      consecutiveSlowFrames = 0;
      consecutiveFastFrames = 0;
    },
  };
})();

