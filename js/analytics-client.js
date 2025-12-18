window.AnalyticsClient = (() => {
  /**
   * Analytics Client for tracking game events
   * Sends events to serverless backend (Netlify Function) or stores locally
   */

  let sessionId = null;
  let userId = null;
  let eventQueue = [];
  let batchTimer = null;
  let isInitialized = false;

  /**
   * Generate anonymous user ID from browser fingerprint
   */
  function generateUserId() {
    if (userId) return userId;

    const fingerprint = [
      navigator.userAgent || "",
      screen.width || 0,
      screen.height || 0,
      new Date().getTimezoneOffset() || 0,
      navigator.language || "",
    ].join("|");

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    userId = "user_" + Math.abs(hash).toString(36);
    return userId;
  }

  /**
   * Generate session ID
   */
  function generateSessionId() {
    if (sessionId) return sessionId;
    sessionId =
      "session_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    return sessionId;
  }

  /**
   * Add event to queue
   */
  function queueEvent(eventType, data = {}) {
    if (!window.AnalyticsConfig || !window.AnalyticsConfig.enabled) {
      return;
    }

    const event = {
      timestamp: new Date().toISOString(),
      sessionId: generateSessionId(),
      userId: generateUserId(),
      eventType: eventType,
      data: data,
    };

    eventQueue.push(event);

    // Send immediately for important events
    const immediateEvents = [
      "session_start",
      "session_end",
      "error",
      "match_end",
    ];
    if (immediateEvents.includes(eventType)) {
      flushQueue();
    } else if (eventQueue.length >= (window.AnalyticsConfig.batchSize || 10)) {
      flushQueue();
    } else {
      scheduleBatch();
    }
  }

  /**
   * Schedule batch send
   */
  function scheduleBatch() {
    if (batchTimer) return;

    const interval = window.AnalyticsConfig?.batchInterval || 5000;
    batchTimer = setTimeout(() => {
      batchTimer = null;
      flushQueue();
    }, interval);
  }

  /**
   * Flush event queue to backend
   */
  async function flushQueue() {
    if (eventQueue.length === 0) return;
    if (batchTimer) {
      clearTimeout(batchTimer);
      batchTimer = null;
    }

    const events = [...eventQueue];
    eventQueue = [];

    // Try to send to backend
    try {
      const endpoint = window.AnalyticsConfig?.endpoint || "/api/log-event";
      const isDev = window.AnalyticsConfig?.devMode || false;

      if (isDev) {
        // In dev mode, store locally in localStorage as fallback
        const stored = JSON.parse(
          localStorage.getItem("analytics_queue") || "[]"
        );
        stored.push(...events);
        localStorage.setItem("analytics_queue", JSON.stringify(stored));
        console.log(
          "[Analytics] Dev mode: Stored",
          events.length,
          "events locally"
        );
        return;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ events }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      // Fallback: Store in localStorage if backend unavailable
      console.warn(
        "[Analytics] Failed to send events, storing locally:",
        error.message
      );
      const stored = JSON.parse(
        localStorage.getItem("analytics_queue") || "[]"
      );
      stored.push(...events);
      // Keep only last 1000 events to avoid localStorage overflow
      if (stored.length > 1000) {
        stored.splice(0, stored.length - 1000);
      }
      localStorage.setItem("analytics_queue", JSON.stringify(stored));
    }
  }

  /**
   * Track generic event
   */
  function trackEvent(eventType, data = {}) {
    queueEvent(eventType, data);
  }

  /**
   * Track error
   */
  function trackError(error, context = {}) {
    if (!window.AnalyticsConfig?.trackErrors) return;

    const errorData = {
      message: error?.message || String(error),
      stack: error?.stack || null,
      name: error?.name || "Error",
      context: context,
    };

    queueEvent("error", errorData);
  }

  /**
   * Track input action
   */
  function trackInput(actionId, playerIndex = null) {
    if (!window.AnalyticsConfig?.trackInputs) return;

    queueEvent("input", {
      actionId: actionId,
      playerIndex: playerIndex,
    });
  }

  /**
   * Track session start
   */
  function trackSessionStart() {
    generateSessionId(); // Initialize session
    queueEvent("session_start", {
      userAgent: navigator.userAgent || "",
      screenWidth: screen.width || 0,
      screenHeight: screen.height || 0,
      language: navigator.language || "",
    });
  }

  /**
   * Track session end
   */
  function trackSessionEnd() {
    queueEvent("session_end", {});
    flushQueue(); // Ensure session_end is sent immediately
  }

  /**
   * Initialize analytics
   */
  function init() {
    if (isInitialized) return;
    isInitialized = true;

    // Track session start
    trackSessionStart();

    // Track session end on page unload
    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", () => {
        trackSessionEnd();
        // Try to send synchronously (may not work in all browsers)
        if (navigator.sendBeacon) {
          const events =
            eventQueue.length > 0 ? eventQueue : [{ eventType: "session_end" }];
          navigator.sendBeacon(
            window.AnalyticsConfig?.endpoint || "/api/log-event",
            JSON.stringify({ events })
          );
        }
      });
    }
  }

  // Auto-initialize when module loads
  if (typeof window !== "undefined" && document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return {
    trackEvent,
    trackError,
    trackInput,
    trackSessionStart,
    trackSessionEnd,
    init,
    flushQueue, // Expose for manual flushing if needed
  };
})();
