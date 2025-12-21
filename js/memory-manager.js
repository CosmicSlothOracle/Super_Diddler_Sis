// Memory Manager
// Monitor and manage memory usage
window.MemoryManager = (() => {
  let memoryLimit = 200; // Default limit in MB
  let cleanupThreshold = 0.8; // Cleanup when usage exceeds 80% of limit
  const trackedAssets = new Map(); // path -> { size, type, lastUsed }
  let frameCount = 0;
  const CLEANUP_CHECK_INTERVAL = 60; // Check every 60 frames

  function getMemoryUsage() {
    let totalMemory = 0;

    // Try to get actual memory usage (Chrome only)
    if (performance.memory) {
      totalMemory = performance.memory.usedJSHeapSize / (1024 * 1024); // Convert to MB
    } else {
      // Estimate based on tracked assets
      trackedAssets.forEach(asset => {
        totalMemory += asset.size || 0;
      });
      // Add estimated overhead (50MB base + particle memory)
      totalMemory += 50;
    }

    return totalMemory;
  }

  function getMemoryLimit() {
    if (window.QualityManager) {
      const tier = window.QualityManager.getQualityPreset();
      switch (tier) {
        case 'low':
          return 100;
        case 'medium':
          return 200;
        case 'high':
          return 400;
        case 'ultra':
          return 600;
        default:
          return 200;
      }
    }
    return memoryLimit;
  }

  function estimateAssetSize(asset) {
    // Rough size estimates
    if (asset instanceof Image) {
      const width = asset.width || asset.naturalWidth || 256;
      const height = asset.height || asset.naturalHeight || 256;
      // RGBA = 4 bytes per pixel
      return (width * height * 4) / (1024 * 1024); // MB
    }
    if (asset instanceof Audio) {
      // Rough estimate: 1MB per minute of audio
      return 1;
    }
    if (typeof asset === 'object') {
      // JSON data: rough estimate
      return JSON.stringify(asset).length / (1024 * 1024); // MB
    }
    return 0.1; // Default small size
  }

  function cleanupUnusedAssets(state) {
    const cleaned = [];
    const currentTime = performance.now();
    const UNUSED_THRESHOLD = 60000; // 60 seconds

    // Find unused character assets (not in current match)
    const currentCharacters = state.selectedCharacters || [];
    trackedAssets.forEach((asset, path) => {
      if (path.includes('/characters/')) {
        const charName = path.split('/characters/')[1]?.split('/')[0];
        if (charName && !currentCharacters.includes(charName)) {
          // Character not in use, mark for cleanup
          if (!asset.lastUsed || (currentTime - asset.lastUsed > UNUSED_THRESHOLD)) {
            cleaned.push(path);
          }
        }
      }
    });

    // Clean up old assets
    cleaned.forEach(path => {
      trackedAssets.delete(path);
    });

    return cleaned.length;
  }

  function forceCleanup(state) {
    const currentCharacters = state.selectedCharacters || [];
    const currentStage = state.currentStagePath || '';
    let cleaned = 0;

    trackedAssets.forEach((asset, path) => {
      // Keep only current character and stage assets
      const isCurrentCharacter = currentCharacters.some(char => path.includes(`/characters/${char}/`));
      const isCurrentStage = path.includes(currentStage);
      const isCritical = path.includes('/ui/') || path.includes('atlas_ui');

      if (!isCurrentCharacter && !isCurrentStage && !isCritical) {
        trackedAssets.delete(path);
        cleaned++;
      }
    });

    return cleaned;
  }

  return {
    init() {
      memoryLimit = getMemoryLimit();
      console.log(`[MemoryManager] Initialized with limit: ${memoryLimit}MB`);
    },

    trackAsset(path, asset) {
      const size = estimateAssetSize(asset);
      trackedAssets.set(path, {
        size,
        type: asset.constructor.name,
        lastUsed: performance.now(),
      });
    },

    updateAssetUsage(path) {
      const asset = trackedAssets.get(path);
      if (asset) {
        asset.lastUsed = performance.now();
      }
    },

    untrackAsset(path) {
      trackedAssets.delete(path);
    },

    getMemoryUsage() {
      return getMemoryUsage();
    },

    getMemoryLimit() {
      return getMemoryLimit();
    },

    shouldCleanup() {
      const usage = getMemoryUsage();
      const limit = getMemoryLimit();
      return usage > (limit * cleanupThreshold);
    },

    cleanupUnusedAssets(state) {
      return cleanupUnusedAssets(state);
    },

    forceCleanup(state) {
      return forceCleanup(state);
    },

    checkAndCleanup(state) {
      frameCount++;
      if (frameCount % CLEANUP_CHECK_INTERVAL === 0) {
        if (this.shouldCleanup()) {
          const cleaned = this.cleanupUnusedAssets(state);
          if (cleaned > 0) {
            console.log(`[MemoryManager] Cleaned up ${cleaned} unused assets`);
          }
        }
      }
    },

    getTrackedAssets() {
      return Array.from(trackedAssets.keys());
    },

    getStats() {
      const usage = getMemoryUsage();
      const limit = getMemoryLimit();
      return {
        usage,
        limit,
        usagePercent: (usage / limit) * 100,
        trackedCount: trackedAssets.size,
      };
    },
  };
})();

