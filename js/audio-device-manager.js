/**
 * Audio Device Manager
 *
 * Verwaltet Audio-Ausgabegeräte:
 * - Listet verfügbare Geräte auf
 * - Erlaubt Geräte-Wechsel
 * - Erkennt automatisch Geräte-Wechsel
 * - Optimiert Sample-Rate für bessere Qualität
 */

window.AudioDeviceManager = (() => {
  let audioDevices = {
    outputs: [],
    currentOutput: null,
  };

  let deviceChangeListeners = [];
  let audioContext = null;
  let preferredSampleRate = 48000; // 48kHz für bessere Qualität (Standard ist oft 44.1kHz)

  /**
   * Initialisiert den Audio Device Manager
   */
  async function init() {
    console.log("🎤 [AudioDeviceManager] Initializing...");

    // Warte auf User-Interaction für enumerateDevices
    const initOnInteraction = async () => {
      await refreshDevices();
      setupDeviceChangeListeners();
    };

    // Warte auf User-Interaction
    document.addEventListener("keydown", initOnInteraction, { once: true });
    document.addEventListener("click", initOnInteraction, { once: true });
    document.addEventListener("touchstart", initOnInteraction, { once: true });
  }

  /**
   * Aktualisiert die Liste der verfügbaren Audio-Geräte
   */
  async function refreshDevices() {
    try {
      // Note: enumerateDevices() may trigger microphone permission prompt on some browsers
      // even though we only need output devices. This is a browser limitation.
      // We catch and ignore permission errors to avoid blocking the app.
      let devices;
      try {
        devices = await navigator.mediaDevices.enumerateDevices();
      } catch (permError) {
        // User denied microphone permission or browser requires it for enumerateDevices
        // This is fine - we can still use default audio output
        console.log("🎤 [AudioDeviceManager] Device enumeration skipped (permission not granted)");
        return;
      }

      audioDevices.outputs = devices
        .filter((d) => d.kind === "audiooutput")
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Speaker ${audioDevices.outputs.length + 1}`,
          groupId: d.groupId,
        }));

      // Setze Standard-Gerät falls nicht gesetzt
      if (!audioDevices.currentOutput && audioDevices.outputs.length > 0) {
        audioDevices.currentOutput = audioDevices.outputs[0].deviceId;
      }

      console.log(
        `🎤 [AudioDeviceManager] Found ${audioDevices.outputs.length} output(s)`
      );

      return {
        outputs: audioDevices.outputs,
      };
    } catch (err) {
      console.error("🎤 [AudioDeviceManager] Failed to enumerate devices:", err);
      return { outputs: [] };
    }
  }

  /**
   * Setzt Event-Listener für Geräte-Wechsel
   */
  function setupDeviceChangeListeners() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.addEventListener) {
      console.warn("🎤 [AudioDeviceManager] devicechange event not supported");
      return;
    }

    navigator.mediaDevices.addEventListener("devicechange", async () => {
      console.log("🎤 [AudioDeviceManager] Device change detected, refreshing...");
      const oldOutput = audioDevices.currentOutput;

      await refreshDevices();

      // Prüfe ob Standard-Gerät geändert wurde
      if (oldOutput !== audioDevices.currentOutput) {
        console.log(
          `🎤 [AudioDeviceManager] Output device changed: ${oldOutput} → ${audioDevices.currentOutput}`
        );
        notifyDeviceChange("output", audioDevices.currentOutput);
      }
    });

    console.log("🎤 [AudioDeviceManager] Device change listeners set up");
  }

  /**
   * Benachrichtigt alle Listener über Geräte-Wechsel
   */
  function notifyDeviceChange(type, deviceId) {
    deviceChangeListeners.forEach((listener) => {
      try {
        listener(type, deviceId);
      } catch (err) {
        console.error("🎤 [AudioDeviceManager] Listener error:", err);
      }
    });
  }

  /**
   * Erstellt einen AudioContext mit optimaler Sample-Rate
   */
  function createOptimizedAudioContext() {
    if (audioContext) {
      return audioContext;
    }

    // Versuche 48kHz, fallback auf Standard
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: preferredSampleRate,
      });

      const actualSampleRate = audioContext.sampleRate;
      console.log(
        `🎤 [AudioDeviceManager] AudioContext created: ${actualSampleRate}Hz (requested: ${preferredSampleRate}Hz)`
      );

      // Wenn die gewünschte Sample-Rate nicht unterstützt wird, logge eine Warnung
      if (Math.abs(actualSampleRate - preferredSampleRate) > 100) {
        console.warn(
          `🎤 [AudioDeviceManager] Sample rate mismatch: requested ${preferredSampleRate}Hz, got ${actualSampleRate}Hz`
        );
      }
    } catch (err) {
      console.warn("🎤 [AudioDeviceManager] Failed to create optimized AudioContext:", err);
      // Fallback auf Standard
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      console.log(
        `🎤 [AudioDeviceManager] Using default AudioContext: ${audioContext.sampleRate}Hz`
      );
    }

    return audioContext;
  }

  /**
   * Setzt das Ausgabe-Gerät (Sink)
   * Hinweis: setSinkId wird nur von HTMLMediaElement unterstützt, nicht von AudioContext
   */
  async function setOutputDevice(deviceId) {
    if (!deviceId) {
      console.warn("🎤 [AudioDeviceManager] No device ID provided");
      return false;
    }

    // Prüfe ob Gerät existiert
    const device = audioDevices.outputs.find((d) => d.deviceId === deviceId);
    if (!device) {
      console.warn(`🎤 [AudioDeviceManager] Output device not found: ${deviceId}`);
      return false;
    }

    audioDevices.currentOutput = deviceId;
    console.log(`🎤 [AudioDeviceManager] Output device set to: ${device.label}`);

    // Für HTMLMediaElement: setSinkId verwenden
    // Für AudioContext: Neuen Context mit dem Gerät erstellen (nicht direkt möglich)
    // Workaround: AudioContext verwendet immer das Standard-Gerät
    // Wir können nur HTMLMediaElement.setSinkId() verwenden

    notifyDeviceChange("output", deviceId);
    return true;
  }


  /**
   * Fügt einen Listener für Geräte-Wechsel hinzu
   */
  function onDeviceChange(callback) {
    if (typeof callback === "function") {
      deviceChangeListeners.push(callback);
    }
  }

  /**
   * Entfernt einen Listener
   */
  function removeDeviceChangeListener(callback) {
    const index = deviceChangeListeners.indexOf(callback);
    if (index > -1) {
      deviceChangeListeners.splice(index, 1);
    }
  }

  /**
   * Gibt alle verfügbaren Geräte zurück
   */
  function getDevices() {
    return {
      outputs: [...audioDevices.outputs],
      currentOutput: audioDevices.currentOutput,
    };
  }

  /**
   * Gibt das aktuelle Ausgabe-Gerät zurück
   */
  function getCurrentOutputDevice() {
    return audioDevices.outputs.find(
      (d) => d.deviceId === audioDevices.currentOutput
    );
  }


  /**
   * Setzt die bevorzugte Sample-Rate
   */
  function setPreferredSampleRate(rate) {
    if (rate >= 8000 && rate <= 192000) {
      preferredSampleRate = rate;
      console.log(`🎤 [AudioDeviceManager] Preferred sample rate set to: ${rate}Hz`);
    } else {
      console.warn(
        `🎤 [AudioDeviceManager] Invalid sample rate: ${rate} (must be 8000-192000)`
      );
    }
  }

  /**
   * Gibt die aktuelle Sample-Rate zurück
   */
  function getSampleRate() {
    if (audioContext) {
      return audioContext.sampleRate;
    }
    return preferredSampleRate;
  }

  return {
    init,
    refreshDevices,
    setOutputDevice,
    onDeviceChange,
    removeDeviceChangeListener,
    getDevices,
    getCurrentOutputDevice,
    createOptimizedAudioContext,
    setPreferredSampleRate,
    getSampleRate,
  };
})();

