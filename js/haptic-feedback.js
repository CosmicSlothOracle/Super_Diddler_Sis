// Haptic Feedback
// Provide tactile feedback for button presses and actions
window.HapticFeedback = (() => {
  let enabled = true;
  let supported = false;

  function checkSupport() {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      supported = true;
      // Test vibration (very short pulse)
      try {
        navigator.vibrate(1);
      } catch (e) {
        supported = false;
      }
    }
    return supported;
  }

  function vibrate(pattern) {
    if (!enabled || !supported) {
      return false;
    }
    try {
      navigator.vibrate(pattern);
      return true;
    } catch (e) {
      console.warn('[HapticFeedback] Vibration failed:', e);
      return false;
    }
  }

  return {
    init() {
      supported = checkSupport();
      if (supported) {
        console.log('[HapticFeedback] Haptic feedback available');
      } else {
        console.log('[HapticFeedback] Haptic feedback not available');
      }
    },

    isSupported() {
      return supported;
    },

    setEnabled(value) {
      enabled = value;
    },

    isEnabled() {
      return enabled;
    },

    // Button press feedback
    buttonPress() {
      return vibrate(10); // 10ms pulse
    },

    // Hit impact feedback
    hitImpact() {
      return vibrate(20); // 20ms pulse
    },

    // Combo feedback
    combo() {
      return vibrate([10, 5, 10]); // Pattern: 10ms on, 5ms off, 10ms on
    },

    // Ultimate feedback
    ultimate() {
      return vibrate([30, 10, 30]); // Pattern: 30ms on, 10ms off, 30ms on
    },

    // Custom pattern
    custom(pattern) {
      return vibrate(pattern);
    },
  };
})();

