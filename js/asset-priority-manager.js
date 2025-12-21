// Asset Priority Manager
// Classify and prioritize assets for progressive loading
window.AssetPriorityManager = (() => {
  // Asset categories with priority levels
  const PRIORITIES = {
    critical: 1,
    high: 2,
    medium: 3,
    low: 4,
  };

  // Asset manifest: maps asset paths to priorities
  const assetManifest = {
    // Critical: Core game JS and initial UI
    critical: [
      'js/game-state.js',
      'js/input-handler.js',
      'js/physics.js',
      'js/renderer.js',
      'js/main.js',
      'assets/ui/atlas_ui.png',
      'assets/ui/atlas_ui.json',
    ],
    // High: Characters, stages, core audio
    high: [
      'data/characters.json',
      'data/stages.json',
      'assets/audio/music/',
      'assets/characters/',
      'assets/effects/',
      'levels/',
    ],
    // Medium: Effects, particles, background music
    medium: [
      'assets/audio/sfx/',
      'assets/audio/voice/',
    ],
    // Low: Tutorial assets, optional content
    low: [
      'tutorial',
    ],
  };

  // Track loaded assets
  const loadedAssets = new Set();

  function getPriorityForPath(path) {
    // Check exact matches first
    for (const [priority, paths] of Object.entries(assetManifest)) {
      for (const manifestPath of paths) {
        if (path === manifestPath || path.startsWith(manifestPath)) {
          return priority;
        }
      }
    }
    // Default to medium priority
    return 'medium';
  }

  return {
    getCriticalAssets() {
      return assetManifest.critical.slice();
    },

    getAssetsByPriority(priority) {
      return assetManifest[priority] ? assetManifest[priority].slice() : [];
    },

    getPriorityForAsset(path) {
      return getPriorityForPath(path);
    },

    markAssetLoaded(path) {
      loadedAssets.add(path);
    },

    isAssetLoaded(path) {
      return loadedAssets.has(path);
    },

    getLoadedAssets() {
      return Array.from(loadedAssets);
    },

    clearLoadedAssets() {
      loadedAssets.clear();
    },

    // Helper to classify character assets
    classifyCharacterAsset(charName) {
      // First character is critical, others are high priority
      return 'high';
    },

    // Helper to classify stage assets
    classifyStageAsset(stagePath) {
      // Selected stage is high priority, others are medium
      return 'high';
    },
  };
})();

