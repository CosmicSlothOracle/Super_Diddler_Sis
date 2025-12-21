// Battery Optimizer
// Optimize performance when device is low on battery or backgrounded
window.BatteryOptimizer = (() => {
  let isBackgrounded = false;
  let isLowBattery = false;
  let batteryLevel = 1.0;
  let targetFPS = 60;
  let throttleFrameRate = false;

  function handleVisibilityChange() {
    isBackgrounded = document.hidden || document.webkitHidden || false;
    updateTargetFPS();
  }

  function handleBatteryChange(battery) {
    if (battery) {
      batteryLevel = battery.level;
      isLowBattery = batteryLevel < 0.2; // Less than 20%
      updateTargetFPS();
    }
  }

  function updateTargetFPS() {
    if (isBackgrounded) {
      targetFPS = 30; // Reduce to 30fps when backgrounded
      throttleFrameRate = true;
    } else if (isLowBattery) {
      targetFPS = 30; // Reduce to 30fps when low battery
      throttleFrameRate = true;
    } else {
      targetFPS = 60;
      throttleFrameRate = false;
    }
  }

  async function initBatteryAPI() {
    if (navigator.getBattery) {
      try {
        const battery = await navigator.getBattery();
        handleBatteryChange(battery);
        battery.addEventListener('levelchange', () => handleBatteryChange(battery));
        battery.addEventListener('chargingchange', () => handleBatteryChange(battery));
      } catch (error) {
        console.warn('[BatteryOptimizer] Battery API not available:', error);
      }
    }
  }

  return {
    init() {
      // Page Visibility API
      if (document.addEventListener) {
        document.addEventListener('visibilitychange', handleVisibilityChange);
        document.addEventListener('webkitvisibilitychange', handleVisibilityChange);
      }

      // Battery API (if available)
      initBatteryAPI();

      // Initial state
      handleVisibilityChange();
      updateTargetFPS();

      console.log('[BatteryOptimizer] Initialized');
    },

    isBackgrounded() {
      return isBackgrounded;
    },

    isLowBattery() {
      return isLowBattery;
    },

    shouldThrottle() {
      return throttleFrameRate;
    },

    getTargetFPS() {
      return targetFPS;
    },

    getBatteryLevel() {
      return batteryLevel;
    },
  };
})();

