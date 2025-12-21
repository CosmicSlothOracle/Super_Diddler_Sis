// Frame Budget Manager
// Manage frame time budgets and implement frame skipping when needed
window.FrameBudgetManager = (() => {
  const TARGET_FRAME_TIME = 16.67; // 60fps target in milliseconds
  const FRAME_HISTORY_SIZE = 60; // Track last 60 frames
  const ADAPT_DOWN_THRESHOLD = 3; // Consecutive slow frames to trigger quality degradation
  const ADAPT_UP_THRESHOLD = 60; // Consecutive fast frames to trigger quality improvement

  let frameStartTime = 0;
  let frameTimeHistory = [];
  let currentFPS = 60;
  let frameCount = 0;

  // Update type priorities (lower number = higher priority)
  const UPDATE_PRIORITIES = {
    critical: 1, // Physics, Input, Collision
    high: 2, // Rendering, Particles
    medium: 3, // UI updates, Animations
    low: 4, // Background effects, Non-visible particles
  };

  // Track which update types have been skipped this frame
  let skippedUpdatesThisFrame = new Set();

  function calculateFPS() {
    if (frameTimeHistory.length < 2) {
      return 60;
    }
    const avgFrameTime = frameTimeHistory.reduce((a, b) => a + b, 0) / frameTimeHistory.length;
    return avgFrameTime > 0 ? 1000 / avgFrameTime : 60;
  }

  function getAverageFrameTime() {
    if (frameTimeHistory.length === 0) {
      return TARGET_FRAME_TIME;
    }
    return frameTimeHistory.reduce((a, b) => a + b, 0) / frameTimeHistory.length;
  }

  function getBudgetRemaining() {
    const elapsed = performance.now() - frameStartTime;
    return Math.max(0, TARGET_FRAME_TIME - elapsed);
  }

  return {
    startFrame() {
      frameStartTime = performance.now();
      skippedUpdatesThisFrame.clear();
      frameCount++;
      return getBudgetRemaining();
    },

    endFrame() {
      const frameTime = performance.now() - frameStartTime;

      // Add to history
      frameTimeHistory.push(frameTime);
      if (frameTimeHistory.length > FRAME_HISTORY_SIZE) {
        frameTimeHistory.shift();
      }

      // Update FPS
      currentFPS = calculateFPS();

      // Trigger quality adaptation if QualityManager is available
      if (window.QualityManager && typeof window.QualityManager.adaptQuality === 'function') {
        window.QualityManager.adaptQuality(frameTime);
      }

      return frameTime;
    },

    shouldSkipUpdate(type) {
      // Never skip critical updates
      if (type === 'critical' || UPDATE_PRIORITIES[type] === UPDATE_PRIORITIES.critical) {
        return false;
      }

      // Check if we're already over budget
      const budgetRemaining = getBudgetRemaining();
      const priority = UPDATE_PRIORITIES[type] || UPDATE_PRIORITIES.medium;

      // Skip if budget is tight and this is a lower priority update
      if (budgetRemaining < 5 && priority > UPDATE_PRIORITIES.high) {
        skippedUpdatesThisFrame.add(type);
        return true;
      }

      // Skip if average frame time is consistently high
      const avgFrameTime = getAverageFrameTime();
      if (avgFrameTime > TARGET_FRAME_TIME * 1.2 && priority > UPDATE_PRIORITIES.critical) {
        // Skip medium/low priority updates when consistently slow
        if (priority >= UPDATE_PRIORITIES.medium) {
          skippedUpdatesThisFrame.add(type);
          return true;
        }
      }

      return false;
    },

    getCurrentFPS() {
      return currentFPS;
    },

    getFrameTimeStats() {
      if (frameTimeHistory.length === 0) {
        return {
          min: 0,
          max: 0,
          avg: TARGET_FRAME_TIME,
          current: 0,
        };
      }
      const min = Math.min(...frameTimeHistory);
      const max = Math.max(...frameTimeHistory);
      const avg = getAverageFrameTime();
      const current = frameTimeHistory[frameTimeHistory.length - 1] || 0;
      return { min, max, avg, current };
    },

    getBudgetRemaining() {
      return getBudgetRemaining();
    },

    getSkippedUpdates() {
      return Array.from(skippedUpdatesThisFrame);
    },

    reset() {
      frameTimeHistory = [];
      frameCount = 0;
      currentFPS = 60;
      skippedUpdatesThisFrame.clear();
    },
  };
})();

