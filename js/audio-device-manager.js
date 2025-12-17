/**
 * Audio Device Manager
 *
 * Verwaltet Audio-Ein- und Ausgabegeräte:
 * - Listet verfügbare Geräte auf
 * - Erlaubt Geräte-Wechsel
 * - Erkennt automatisch Geräte-Wechsel
 * - Optimiert Sample-Rate für bessere Qualität
 * - Unterstützt Mikrofon mit hoher Qualität
 */

window.AudioDeviceManager = (() => {
  let audioDevices = {
    inputs: [],
    outputs: [],
    currentInput: null,
    currentOutput: null,
  };

  let deviceChangeListeners = [];
  let mediaStream = null;
  let audioContext = null;
  let preferredSampleRate = 48000; // 48kHz für bessere Qualität (Standard ist oft 44.1kHz)

  /**
   * Initialisiert den Audio Device Manager
   */
  async function init() {
    console.log("🎤 [AudioDeviceManager] Initializing...");

    // Warte auf User-Interaction für Permissions
    const initOnInteraction = async () => {
      try {
        // Request permissions für enumerateDevices (benötigt getUserMedia)
        await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log("🎤 [AudioDeviceManager] Permissions granted");
      } catch (err) {
        console.warn("🎤 [AudioDeviceManager] Could not request permissions:", err);
        // Continue anyway - enumerateDevices might still work
      }

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
      const devices = await navigator.mediaDevices.enumerateDevices();

      audioDevices.inputs = devices
        .filter((d) => d.kind === "audioinput")
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${audioDevices.inputs.length + 1}`,
          groupId: d.groupId,
        }));

      audioDevices.outputs = devices
        .filter((d) => d.kind === "audiooutput")
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Speaker ${audioDevices.outputs.length + 1}`,
          groupId: d.groupId,
        }));

      // Setze Standard-Geräte falls nicht gesetzt
      if (!audioDevices.currentOutput && audioDevices.outputs.length > 0) {
        audioDevices.currentOutput = audioDevices.outputs[0].deviceId;
      }
      if (!audioDevices.currentInput && audioDevices.inputs.length > 0) {
        audioDevices.currentInput = audioDevices.inputs[0].deviceId;
      }

      console.log(
        `🎤 [AudioDeviceManager] Found ${audioDevices.inputs.length} input(s), ${audioDevices.outputs.length} output(s)`
      );

      return {
        inputs: audioDevices.inputs,
        outputs: audioDevices.outputs,
      };
    } catch (err) {
      console.error("🎤 [AudioDeviceManager] Failed to enumerate devices:", err);
      return { inputs: [], outputs: [] };
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
      const oldInput = audioDevices.currentInput;

      await refreshDevices();

      // Prüfe ob Standard-Gerät geändert wurde
      if (oldOutput !== audioDevices.currentOutput) {
        console.log(
          `🎤 [AudioDeviceManager] Output device changed: ${oldOutput} → ${audioDevices.currentOutput}`
        );
        notifyDeviceChange("output", audioDevices.currentOutput);
      }

      if (oldInput !== audioDevices.currentInput) {
        console.log(
          `🎤 [AudioDeviceManager] Input device changed: ${oldInput} → ${audioDevices.currentInput}`
        );
        notifyDeviceChange("input", audioDevices.currentOutput);
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
   * Setzt das Eingabe-Gerät (Mikrofon)
   */
  async function setInputDevice(deviceId, constraints = null) {
    if (!deviceId) {
      console.warn("🎤 [AudioDeviceManager] No device ID provided");
      return false;
    }

    // Prüfe ob Gerät existiert
    const device = audioDevices.inputs.find((d) => d.deviceId === deviceId);
    if (!device) {
      console.warn(`🎤 [AudioDeviceManager] Input device not found: ${deviceId}`);
      return false;
    }

    audioDevices.currentInput = deviceId;

    // Stoppe alten Stream
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      mediaStream = null;
    }

    // Erstelle neuen Stream mit optimalen Constraints
    const defaultConstraints = {
      audio: {
        deviceId: { exact: deviceId },
        sampleRate: preferredSampleRate,
        channelCount: 2, // Stereo
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        // Zusätzliche Qualitäts-Optionen
        latency: 0.01, // Niedrige Latenz
        sampleSize: 16, // 16-bit
      },
    };

    const finalConstraints = constraints || defaultConstraints;

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia(finalConstraints);
      console.log(
        `🎤 [AudioDeviceManager] Input device set to: ${device.label} (${preferredSampleRate}Hz)`
      );

      // Logge tatsächliche Constraints
      const audioTrack = mediaStream.getAudioTracks()[0];
      if (audioTrack) {
        const settings = audioTrack.getSettings();
        console.log("🎤 [AudioDeviceManager] Actual audio settings:", {
          sampleRate: settings.sampleRate,
          channelCount: settings.channelCount,
          echoCancellation: settings.echoCancellation,
          noiseSuppression: settings.noiseSuppression,
          autoGainControl: settings.autoGainControl,
        });
      }

      notifyDeviceChange("input", deviceId);
      return true;
    } catch (err) {
      console.error("🎤 [AudioDeviceManager] Failed to set input device:", err);
      return false;
    }
  }

  /**
   * Gibt den aktuellen MediaStream zurück (für Mikrofon-Zugriff)
   */
  function getMediaStream() {
    return mediaStream;
  }

  /**
   * Stoppt den aktuellen MediaStream
   */
  function stopMediaStream() {
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      mediaStream = null;
      console.log("🎤 [AudioDeviceManager] MediaStream stopped");
    }
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
      inputs: [...audioDevices.inputs],
      outputs: [...audioDevices.outputs],
      currentInput: audioDevices.currentInput,
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
   * Gibt das aktuelle Eingabe-Gerät zurück
   */
  function getCurrentInputDevice() {
    return audioDevices.inputs.find(
      (d) => d.deviceId === audioDevices.currentInput
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
    setInputDevice,
    getMediaStream,
    stopMediaStream,
    onDeviceChange,
    removeDeviceChangeListener,
    getDevices,
    getCurrentOutputDevice,
    getCurrentInputDevice,
    createOptimizedAudioContext,
    setPreferredSampleRate,
    getSampleRate,
  };
})();

