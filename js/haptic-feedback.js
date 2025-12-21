// Haptic Feedback
// Provide tactile feedback for button presses and actions
window.HapticFeedback = (() => {
  let enabled = true;
  let supported = false;

  function checkSupport() {
    // Check if API exists without testing it (browsers require user interaction first)
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      supported = true;
      // Don't test vibration here - browsers block it until user interaction
      // We'll test it lazily on first actual vibration call
    }
    return supported;
  }

  function vibrate(pattern) {
    if (!enabled) {
      return false;
    }
    // Check API availability
    if (typeof navigator === "undefined" || !navigator.vibrate) {
      supported = false;
      return false;
    }
    // Mark as supported if API exists (we'll test it on first use)
    if (!supported) {
      supported = true;
    }
    try {
      navigator.vibrate(pattern);
      return true;
    } catch (e) {
      // Silently handle "user interaction required" errors
      // This is expected until user interacts with the page
      if (e.name !== "NotAllowedError" && e.name !== "SecurityError") {
        console.warn("[HapticFeedback] Vibration failed:", e);
      }
      return false;
    }
  }

  return {
    init() {
      supported = checkSupport();
      if (supported) {
        console.log("[HapticFeedback] Haptic feedback available");
      } else {
        console.log("[HapticFeedback] Haptic feedback not available");
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
