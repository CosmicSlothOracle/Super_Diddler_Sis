// Progressive Asset Loader
// Load assets in priority order with progress tracking
window.ProgressiveAssetLoader = (() => {
  let loadProgress = 0;
  let totalAssets = 0;
  let loadedAssets = 0;
  const loadQueue = {
    critical: [],
    high: [],
    medium: [],
    low: [],
  };
  let idleCallbackId = null;

  function updateProgress() {
    if (totalAssets > 0) {
      loadProgress = loadedAssets / totalAssets;
    } else {
      loadProgress = 1;
    }
  }

  function loadAsset(assetPath, priority) {
    return new Promise((resolve, reject) => {
      // Determine asset type and load accordingly
      if (assetPath.endsWith('.json')) {
        // JSON asset
        fetch(assetPath)
          .then(res => res.json())
          .then(data => {
            loadedAssets++;
            updateProgress();
            resolve(data);
          })
          .catch(reject);
      } else if (assetPath.match(/\.(png|jpg|jpeg|webp|avif)$/i)) {
        // Image asset
        const img = new Image();
        img.onload = () => {
          loadedAssets++;
          updateProgress();
          resolve(img);
        };
        img.onerror = reject;
        img.src = assetPath;
      } else if (assetPath.match(/\.(ogg|mp3|wav)$/i)) {
        // Audio asset
        const audio = new Audio();
        audio.addEventListener('canplaythrough', () => {
          loadedAssets++;
          updateProgress();
          resolve(audio);
        }, { once: true });
        audio.onerror = reject;
        audio.src = assetPath;
      } else {
        // Unknown type, try fetch
        fetch(assetPath)
          .then(res => {
            loadedAssets++;
            updateProgress();
            resolve(res);
          })
          .catch(reject);
      }
    });
  }

  async function loadPriorityQueue(priority) {
    const queue = loadQueue[priority];
    if (!queue || queue.length === 0) {
      return;
    }

    const assets = queue.slice();
    queue.length = 0; // Clear queue

    for (const asset of assets) {
      try {
        await loadAsset(asset.path, priority);
        if (window.AssetPriorityManager) {
          window.AssetPriorityManager.markAssetLoaded(asset.path);
        }
        if (asset.onLoad) {
          asset.onLoad();
        }
      } catch (error) {
        console.warn(`[ProgressiveLoader] Failed to load ${asset.path}:`, error);
        if (asset.onError) {
          asset.onError(error);
        }
      }
    }
  }

  function scheduleIdleLoad() {
    if (typeof requestIdleCallback === 'undefined') {
      // Fallback for browsers without requestIdleCallback
      setTimeout(() => {
        loadPriorityQueue('low');
      }, 1000);
      return;
    }

    if (idleCallbackId) {
      cancelIdleCallback(idleCallbackId);
    }

    idleCallbackId = requestIdleCallback((deadline) => {
      // Load medium priority assets during idle time
      if (deadline.timeRemaining() > 0 && loadQueue.medium.length > 0) {
        loadPriorityQueue('medium');
      }

      // Load low priority assets if still have time
      if (deadline.timeRemaining() > 0 && loadQueue.low.length > 0) {
        loadPriorityQueue('low');
      }

      // Schedule next idle load if there are still assets
      if (loadQueue.medium.length > 0 || loadQueue.low.length > 0) {
        scheduleIdleLoad();
      } else {
        idleCallbackId = null;
      }
    }, { timeout: 5000 });
  }

  return {
    async loadCritical() {
      // Load all critical assets immediately (blocking)
      totalAssets += loadQueue.critical.length;
      await loadPriorityQueue('critical');
      return loadProgress;
    },

    async loadPriority(priority) {
      // Load assets of specific priority
      if (!loadQueue[priority]) {
        return;
      }
      totalAssets += loadQueue[priority].length;
      await loadPriorityQueue(priority);
      return loadProgress;
    },

    loadIdle() {
      // Schedule low-priority assets to load during idle time
      scheduleIdleLoad();
    },

    queueAsset(path, priority, onLoad = null, onError = null) {
      if (!loadQueue[priority]) {
        console.warn(`[ProgressiveLoader] Invalid priority: ${priority}`);
        priority = 'medium';
      }
      loadQueue[priority].push({ path, onLoad, onError });
      totalAssets++;
    },

    getLoadProgress() {
      return loadProgress;
    },

    getLoadedCount() {
      return loadedAssets;
    },

    getTotalCount() {
      return totalAssets;
    },

    reset() {
      loadProgress = 0;
      totalAssets = 0;
      loadedAssets = 0;
      Object.keys(loadQueue).forEach(key => {
        loadQueue[key] = [];
      });
      if (idleCallbackId) {
        if (typeof cancelIdleCallback !== 'undefined') {
          cancelIdleCallback(idleCallbackId);
        }
        idleCallbackId = null;
      }
    },
  };
})();

