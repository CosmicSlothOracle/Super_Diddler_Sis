window.Metronome = (() => {
  let audioContext = null;
  let isActive = false;
  let nextBeatTime = 0;
  let currentBPM = 120;
  let schedulerInterval = null;
  let visualCallback = null;

  // Scheduling constants
  const SCHEDULE_AHEAD_TIME = 0.1; // How far ahead to schedule (seconds)
  const SCHEDULER_INTERVAL = 25; // How often to check for scheduling (ms)

  function init() {
    if (!audioContext) {
      // Use AudioDeviceManager for optimized AudioContext if available
      if (window.AudioDeviceManager) {
        audioContext = window.AudioDeviceManager.createOptimizedAudioContext();
        console.log(
          `🎵 Metronome AudioContext initialized: ${audioContext.sampleRate}Hz (optimized)`
        );
      } else {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log(
          `🎵 Metronome AudioContext initialized: ${audioContext.sampleRate}Hz`
        );
      }
    }
  }

  function scheduleBeat(time) {
    // Create oscillator for beep sound
    const osc = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    // Connect: oscillator → gain → output
    osc.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // High-pitched beep: 1000 Hz
    osc.frequency.value = 1000;

    // Short envelope: quick attack, quick release
    gainNode.gain.value = 0;
    gainNode.gain.setValueAtTime(0, time);
    gainNode.gain.linearRampToValueAtTime(0.3, time + 0.001); // Fast attack
    gainNode.gain.linearRampToValueAtTime(0, time + 0.05); // 50ms beep

    // Start and stop oscillator
    osc.start(time);
    osc.stop(time + 0.05);

    // Trigger visual callback
    if (visualCallback) {
      const delay = (time - audioContext.currentTime) * 1000;
      setTimeout(() => {
        if (visualCallback) visualCallback();
      }, Math.max(0, delay));
    }
  }

  function scheduler() {
    // Schedule all beats that need to happen in the next SCHEDULE_AHEAD_TIME
    while (nextBeatTime < audioContext.currentTime + SCHEDULE_AHEAD_TIME) {
      scheduleBeat(nextBeatTime);

      // Calculate next beat time
      const beatInterval = 60.0 / currentBPM; // in seconds
      nextBeatTime += beatInterval;
    }
  }

  function start(bpm = 120, syncOffset = 0) {
    if (!audioContext) init();
    if (isActive) return;

    currentBPM = bpm;
    isActive = true;

    // Resume AudioContext if suspended
    if (audioContext.state === "suspended") {
      audioContext.resume();
    }

    // Initialize timing - sync with music if offset provided
    if (syncOffset > 0) {
      // syncOffset is time until next beat in milliseconds
      nextBeatTime = audioContext.currentTime + syncOffset / 1000;
      console.log(
        `🎵 Metronome synced: next beat in ${syncOffset.toFixed(0)}ms`
      );
    } else {
      // No sync - start immediately
      nextBeatTime = audioContext.currentTime;
    }

    // Start scheduler
    schedulerInterval = setInterval(scheduler, SCHEDULER_INTERVAL);

    console.log(`🎵 Metronome started at ${bpm} BPM`);
  }

  function stop() {
    if (!isActive) return;

    isActive = false;

    if (schedulerInterval) {
      clearInterval(schedulerInterval);
      schedulerInterval = null;
    }

    console.log("🎵 Metronome stopped");
  }

  function toggle(bpm = 120, syncOffset = 0) {
    if (isActive) {
      stop();
      return false;
    } else {
      start(bpm, syncOffset);
      return true;
    }
  }

  function setBPM(bpm) {
    currentBPM = bpm;
    console.log(`🎵 Metronome BPM set to ${bpm}`);
  }

  function setVisualCallback(callback) {
    visualCallback = callback;
  }

  function getState() {
    return {
      isActive,
      currentBPM,
      nextBeatTime: audioContext ? nextBeatTime - audioContext.currentTime : 0,
    };
  }

  return {
    init,
    start,
    stop,
    toggle,
    setBPM,
    setVisualCallback,
    getState,
  };
})();
