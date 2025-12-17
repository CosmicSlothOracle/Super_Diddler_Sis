window.AudioSystem = (() => {
  let currentTrack = null;
  let isMusicEnabled = true;
  let isFading = false;
  let fadeStartTime = 0;
  let fadeDuration = 0;
  // musicStartTime removed - we now use currentTrack.currentTime directly
  let currentTrackName = null;
  let audioUnlocked = false;

  // Track when pauses are triggered intentionally by the system so we can distinguish
  // them from unexpected browser-induced pauses (which we want to auto-recover from).
  let manualPauseGuard = {
    active: false,
    timeoutId: null,
  };

  // NEW: Store pending track request if audio is locked
  let pendingTrack = null;
  function markManualPause() {
    manualPauseGuard.active = true;
    if (manualPauseGuard.timeoutId) {
      clearTimeout(manualPauseGuard.timeoutId);
    }
    // Reset flag shortly after so future pause events can be detected as unexpected.
    manualPauseGuard.timeoutId = setTimeout(() => {
      manualPauseGuard.active = false;
      manualPauseGuard.timeoutId = null;
    }, 500);
  }

  function wasManualPause() {
    return manualPauseGuard.active;
  }

  let activeRequestId = 0;
  let currentRequestContext = null;

  function createRequestContext(requestId, label) {
    return {
      id: requestId,
      label,
      timers: new Set(),
      cleanup: [],
    };
  }

  function guardRequest(requestId) {
    return requestId === activeRequestId;
  }

  function registerTimeout(context, handler, delay) {
    if (!context) {
      return setTimeout(handler, delay);
    }

    const wrapped = setTimeout(() => {
      context.timers.delete(wrapped);
      if (!guardRequest(context.id)) {
        return;
      }
      handler();
    }, delay);

    context.timers.add(wrapped);
    return wrapped;
  }

  function registerInterval(context, handler, interval) {
    if (!context) {
      return setInterval(handler, interval);
    }

    const wrapped = setInterval(() => {
      if (!guardRequest(context.id)) {
        clearInterval(wrapped);
        context.timers.delete(wrapped);
        return;
      }
      handler(() => {
        clearInterval(wrapped);
        context.timers.delete(wrapped);
      });
    }, interval);

    context.timers.add(wrapped);
    return wrapped;
  }

  function addTrackedCleanup(context, fn) {
    if (!context) return;
    context.cleanup.push(fn);
  }

  function addTrackedEventListener(context, target, event, handler, options) {
    if (!context) {
      target.addEventListener(event, handler, options);
      return () => target.removeEventListener(event, handler, options);
    }

    const guardedHandler = (...args) => {
      if (!guardRequest(context.id)) {
        return;
      }
      handler(...args);
    };

    target.addEventListener(event, guardedHandler, options);
    addTrackedCleanup(context, () =>
      target.removeEventListener(event, guardedHandler, options)
    );
    return () => target.removeEventListener(event, guardedHandler, options);
  }

  function invalidateRequestContext(context) {
    if (!context) return;

    context.timers.forEach((handle) => {
      clearTimeout(handle);
      clearInterval(handle);
    });
    context.timers.clear();

    context.cleanup.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        console.warn("🎵 Cleanup handler failed", err);
      }
    });
    context.cleanup.length = 0;
  }

  function clearCurrentTrackRefs() {
    currentTrack = null;
    currentSource = null;
    currentGainNode = null;
    currentFilterNode = null;
    waveShaperNode = null;
    delayNode = null;
    reverbGainNode = null;
    effectGainNode = null;
    highpassFilterNode = null;
    gaterGainNode = null;
    gaterLFO = null;
    gaterLFOGain = null;
    lofiFilterNode = null;
    lofiGainNode = null;
    currentTrackName = null;
  }

  // Track resume attempts to prevent loops
  let resumeAttempts = new Map();

  function attemptResumePlayback(track, trackName) {
    if (!track) return;

    // Prevent multiple resume attempts for the same track
    const trackId = track.src;
    const lastAttempt = resumeAttempts.get(trackId) || 0;
    const now = performance.now();

    if (now - lastAttempt < 1000) {
      // Wait 1 second between attempts
      return;
    }

    resumeAttempts.set(trackId, now);

    console.warn(
      `🎵 [DEBUG] Attempting to resume playback for ${trackName}... currentTime=${track.currentTime}, ended=${track.ended}, readyState=${track.readyState}, networkState=${track.networkState}`
    );

    if (audioContext && audioContext.state !== "running") {
      console.warn(
        `🎵 [DEBUG] AudioContext state=${audioContext.state} - trying resume()`
      );
      audioContext.resume().catch((err) => {
        console.error(`🎵 [DEBUG] Failed to resume AudioContext:`, err);
      });
    }

    track
      .play()
      .then(() => {
        console.log(
          `🎵 [DEBUG] Playback successfully resumed for ${trackName} at t=${track.currentTime}`
        );
        // Clear resume attempt tracking on success
        resumeAttempts.delete(trackId);
      })
      .catch((err) => {
        console.error(
          `🎵 [DEBUG] Failed to resume playback for ${trackName}:`,
          err
        );
      });
  }

  // Web Audio API
  let audioContext = null;
  let currentSource = null;
  let currentGainNode = null;
  let currentFilterNode = null;
  let isDancePhaseActive = false;

  // Extended Audio Effects
  let waveShaperNode = null; // For distortion/bit-crush
  let delayNode = null; // For reverb/delay effects
  let reverbGainNode = null; // For reverb feedback
  let effectGainNode = null; // For effect intensity control
  let highpassFilterNode = null; // For highpass effects
  let gaterGainNode = null; // For gater/tremolo effects
  let gaterLFO = null; // LFO for gater effect
  let gaterLFOGain = null; // LFO gain control for gater effect
  let lofiFilterNode = null; // For Lo-Fi filter combination
  let lofiGainNode = null; // For Lo-Fi gain control
  let isDeathEffectActive = false;
  let isDanceEffectActive = false;
  let perfectBeatCount = 0; // Track perfect beats for effects

  // Music track definitions
  const TRACKS = {
    MENU_LOOP: {
      src: "assets/audio/music/ui/menu_loop.ogg",
      loop: true,
      volume: 0.35,
    },
    TITLE_INTRO: {
      src: "assets/audio/music/ui/title_intro.mp3",
      loop: false,
      volume: 0.4,
    },
    CHARACTER_SELECT: {
      src: "assets/audio/music/ui/character_select_loop.mp3",
      loop: true,
      volume: 0.35,
    },
    // PVP Stage Music Tracks (BPM in filenames)
    PVP_STAGE: {
      src: "assets/audio/music/stages/pvp_stage_105bpm.ogg",
      loop: true,
      volume: 0.3,
    },
    PVP_STAGE_1: {
      src: "assets/audio/music/stages/pvp_stage_1_83bpm.ogg",
      loop: true,
      volume: 0.3,
    },
    PVP_STAGE_2: {
      src: "assets/audio/music/stages/pvp_stage_2_94bpm.ogg",
      loop: true,
      volume: 0.3,
    },
    PVP_STAGE_3: {
      src: "assets/audio/music/stages/pvp_stage_3_130bpm.ogg",
      loop: true,
      volume: 0.3,
    },
    TRAINING_STAGE: {
      src: "assets/audio/music/stages/training.ogg",
      loop: true,
      volume: 0.3,
    },
    PVP_STAGE_4_SCALED: {
      src: "assets/audio/music/stages/pvp_stage_4_scaled_105bpm.ogg",
      loop: true,
      volume: 0.3,
    },
    PVP_STAGE_TUTORIAL: {
      src: "assets/audio/music/stages/pvp_stage_tutorial_80bpm.ogg",
      loop: true,
      volume: 0.3,
    },
  };

  function init() {
    // Wait for user interaction to unlock audio
    const unlockAudio = async () => {
      if (!audioUnlocked) {
        audioUnlocked = true;
        // Initialize AudioContext on first user interaction
        if (!audioContext) {
          // Use AudioDeviceManager for optimized AudioContext if available
          if (window.AudioDeviceManager) {
            audioContext = window.AudioDeviceManager.createOptimizedAudioContext();
          } else {
            // Fallback to standard AudioContext
            audioContext = new (window.AudioContext ||
              window.webkitAudioContext)();
          }
          console.log(
            "🎵 AudioContext initialized:",
            audioContext.sampleRate,
            "Hz, state:",
            audioContext.state
          );

          // Immediately try to resume if suspended
          if (audioContext.state === "suspended") {
            audioContext.resume().then(() => {
              console.log("🎵 AudioContext auto-resumed after creation");
              // Warm up audio graph with silent one-shot to prevent first-play stutter
              primeAudioGraph();
            });
          } else {
            // Already running, warm up immediately
            primeAudioGraph();
          }

          // Setup device change listener if AudioDeviceManager is available
          if (window.AudioDeviceManager) {
            window.AudioDeviceManager.onDeviceChange((type, deviceId) => {
              console.log(`🎵 Audio device changed: ${type} → ${deviceId}`);

              // If output device changed, update current track's sink
              if (type === "output" && currentTrack && currentTrack.setSinkId) {
                currentTrack.setSinkId(deviceId).catch((err) => {
                  console.warn("🎵 Failed to switch audio output device:", err);
                });
              }
            });
          }
        }
        console.log("🎵 Audio context unlocked");

        // NEW: Play pending track if one was queued during lock
        if (pendingTrack) {
          console.log(`🎵 Playing pending track: ${pendingTrack.name}`);
          playTrack(pendingTrack.name, pendingTrack.options);
          pendingTrack = null;
        }
      }
    };

    /**
     * Prime audio graph with silent one-shot playback to prevent first-play stutter.
     * This warms up the audio pipeline before actual gameplay.
     */
    function primeAudioGraph() {
      if (!audioContext || audioContext.state !== "running") {
        return; // Can't prime if not running
      }

      try {
        // Create a silent buffer (0.1 seconds of silence)
        const sampleRate = audioContext.sampleRate;
        const buffer = audioContext.createBuffer(
          1,
          sampleRate * 0.1,
          sampleRate
        );

        // Create a buffer source
        const source = audioContext.createBufferSource();
        source.buffer = buffer;

        // Create a gain node with very low volume (practically silent)
        const gainNode = audioContext.createGain();
        gainNode.gain.value = 0.001; // -60 dB (practically silent)

        // Connect: source → gain → destination
        source.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Start playback (will play silence, but warms up the graph)
        source.start();
        source.stop(audioContext.currentTime + 0.1);

        console.log("🎵 Audio graph primed with silent one-shot");
      } catch (error) {
        // Silent fail - audio warmup is best-effort
        console.debug("🎵 Audio warmup failed (non-critical):", error);
      }
    }

    document.addEventListener("keydown", unlockAudio, { once: true });
    document.addEventListener("click", unlockAudio, { once: true });
    document.addEventListener("touchstart", unlockAudio, { once: true });
  }

  function createAudioElement(trackConfig, useWebAudio = true) {
    const audio = new Audio();
    audio.src = trackConfig.src;
    audio.loop = trackConfig.loop;
    // IMPORTANT: the HTMLMediaElement's volume still affects the audio stream even when routed through
    // Web Audio API. Setting it to 0 silences the track. Use full volume (1.0) and let the GainNode
    // handle all attenuation instead.
    audio.volume = useWebAudio ? 1 : trackConfig.volume;

    // Set output device if AudioDeviceManager is available and device is selected
    if (window.AudioDeviceManager && audio.setSinkId) {
      const currentOutput = window.AudioDeviceManager.getCurrentOutputDevice();
      if (currentOutput && currentOutput.deviceId !== "default") {
        audio.setSinkId(currentOutput.deviceId).catch((err) => {
          console.warn("🎵 Failed to set audio sink:", err);
        });
      }
    }

    return audio;
  }

  function setupAudioNodes(audio, targetVolume) {
    if (!audioContext) {
      console.warn("🎵 AudioContext not initialized - using fallback audio");
      return null;
    }

    try {
      // Create source from audio element
      const source = audioContext.createMediaElementSource(audio);

      // Create filter node (Lowpass for background/foreground effect)
      const filterNode = audioContext.createBiquadFilter();
      filterNode.type = "lowpass";
      filterNode.frequency.value = 20000; // Default: No filtering (full spectrum)
      filterNode.Q.value = 1;

      // Create effect nodes
      const waveShaperNode = audioContext.createWaveShaper();
      const delayNode = audioContext.createDelay(1.0); // Max 1 second delay
      const reverbGainNode = audioContext.createGain();
      const effectGainNode = audioContext.createGain();
      const highpassFilterNode = audioContext.createBiquadFilter();
      const gaterGainNode = audioContext.createGain();
      const gaterLFO = audioContext.createOscillator();
      const gaterLFOGain = audioContext.createGain();
      const lofiFilterNode = audioContext.createBiquadFilter();
      const lofiGainNode = audioContext.createGain();

      // Initialize effect nodes
      setupWaveShaper(waveShaperNode, 0); // No distortion initially
      setupDelayReverb(delayNode, reverbGainNode, 0); // No reverb initially
      effectGainNode.gain.value = 1.0; // No effect attenuation initially

      // Setup highpass filter
      highpassFilterNode.type = "highpass";
      highpassFilterNode.frequency.value = 20; // No highpass initially
      highpassFilterNode.Q.value = 1;

      // Setup gater (tremolo) effect
      gaterGainNode.gain.value = 1.0; // No gating initially
      gaterLFO.frequency.value = 8; // 8 Hz for rhythmic gating
      gaterLFOGain.gain.value = 0; // No modulation initially
      gaterLFO.connect(gaterLFOGain);
      gaterLFOGain.connect(gaterGainNode.gain);
      gaterLFO.start();

      // Setup Lo-Fi filter combination
      lofiFilterNode.type = "lowpass";
      lofiFilterNode.frequency.value = 8000; // Classic Lo-Fi cutoff
      lofiFilterNode.Q.value = 0.5; // Gentle resonance
      lofiGainNode.gain.value = 1.0; // No attenuation initially

      // Create gain node for volume control
      const gainNode = audioContext.createGain();
      gainNode.gain.value = targetVolume;

      // Connect: source → effects → highpass → lofi → filter → gater → gain → output
      source.connect(waveShaperNode);
      waveShaperNode.connect(delayNode);
      delayNode.connect(effectGainNode);
      effectGainNode.connect(highpassFilterNode);
      highpassFilterNode.connect(lofiFilterNode);
      lofiFilterNode.connect(lofiGainNode);
      lofiGainNode.connect(filterNode);
      filterNode.connect(gaterGainNode);
      gaterGainNode.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Reverb feedback loop: delay → reverbGain → delay
      delayNode.connect(reverbGainNode);
      reverbGainNode.connect(delayNode);

      console.log(
        `🎵 Extended Web Audio chain created: source → effects → filter(${filterNode.frequency.value}Hz) → gain(${gainNode.gain.value}) → output`
      );

      return {
        source,
        filterNode,
        gainNode,
        waveShaperNode,
        delayNode,
        reverbGainNode,
        effectGainNode,
        highpassFilterNode,
        gaterGainNode,
        gaterLFO,
        gaterLFOGain,
        lofiFilterNode,
        lofiGainNode,
      };
    } catch (err) {
      console.error("🎵 Failed to create Web Audio nodes:", err);
      return null;
    }
  }

  // ============================================
  // NEW: Effect Setup Functions
  // ============================================

  /**
   * Setup WaveShaper for distortion/bit-crush effects
   * @param {WaveShaperNode} waveShaper - The WaveShaper node
   * @param {number} intensity - Distortion intensity (0-1)
   */
  function setupWaveShaper(waveShaper, intensity) {
    const samples = 256;
    const curve = new Float32Array(samples);

    for (let i = 0; i < samples; i++) {
      const x = (i / (samples - 1)) * 2 - 1; // -1 to 1
      let y;

      if (intensity === 0) {
        y = x; // No distortion
      } else {
        // Bit-crush + distortion
        const crushed =
          Math.sign(x) * Math.pow(Math.abs(x), 1 - intensity * 0.7);
        const distorted = Math.tanh(crushed * (1 + intensity * 3));
        y = distorted;
      }

      curve[i] = y;
    }

    waveShaper.curve = curve;
    waveShaper.oversample = "4x";
  }

  /**
   * Setup Delay + Reverb effect
   * @param {DelayNode} delay - The delay node
   * @param {GainNode} reverbGain - The reverb feedback gain node
   * @param {number} intensity - Reverb intensity (0-1)
   */
  function setupDelayReverb(delay, reverbGain, intensity) {
    delay.delayTime.value = 0.1 + intensity * 0.3; // 0.1s to 0.4s delay
    reverbGain.gain.value = intensity * 0.3; // 0 to 0.3 feedback
  }

  /**
   * Setup Lo-Fi filter combination for authentic Lo-Fi sound
   * @param {BiquadFilterNode} lofiFilter - The Lo-Fi filter node
   * @param {GainNode} lofiGain - The Lo-Fi gain control node
   * @param {number} intensity - Lo-Fi intensity (0-1)
   */
  function setupLoFiFilter(lofiFilter, lofiGain, intensity) {
    if (intensity === 0) {
      // No Lo-Fi effect - bypass
      lofiFilter.frequency.value = 20000; // Full spectrum
      lofiGain.gain.value = 1.0; // No attenuation
    } else {
      // Classic Lo-Fi sound: warm lowpass + slight attenuation
      const baseFreq = 8000; // Classic Lo-Fi cutoff
      const minFreq = 2000; // Minimum frequency for heavy Lo-Fi
      lofiFilter.frequency.value = baseFreq - (baseFreq - minFreq) * intensity;

      // Slight gain reduction for authentic Lo-Fi feel
      lofiGain.gain.value = 1.0 - intensity * 0.15; // Max 15% reduction
    }
  }

  function playTrack(trackName, options = {}) {
    const { fadeIn = 0, fadeOut = 0, onEnd = null, delay = 0 } = options;

    console.log(
      `🎵 [DEBUG] playTrack called: trackName=${trackName}, options=`,
      options
    );
    console.log(
      `🎵 [DEBUG] Audio state: unlocked=${audioUnlocked}, enabled=${isMusicEnabled}`
    );

    if (!audioUnlocked) {
      console.warn("🎵 Audio not unlocked yet - queuing track for later");
      pendingTrack = { name: trackName, options };
      return;
    }

    if (!isMusicEnabled) {
      console.log("🎵 Music is disabled");
      return;
    }

    const trackConfig = TRACKS[trackName];
    if (!trackConfig) {
      console.error(`🎵 Unknown track: ${trackName}`);
      return;
    }

    const previousTrack = currentTrack;
    const previousGainNode = currentGainNode;
    const previousContext = currentRequestContext;

    const requestId = ++activeRequestId;
    const requestContext = createRequestContext(requestId, `play:${trackName}`);
    currentRequestContext = requestContext;
    isFading = false;

    invalidateRequestContext(previousContext);

    if (previousTrack && fadeIn === 0) {
      console.log(
        `🎵 [DEBUG] Stopping current track immediately: ${currentTrackName}, currentTime=${previousTrack.currentTime}, duration=${previousTrack.duration}`
      );
      markManualPause();
      try {
        previousTrack.pause();
      } catch (err) {
        console.warn("🎵 Failed to pause previous track", err);
      }
      try {
        previousTrack.currentTime = 0;
      } catch (err) {
        console.warn("🎵 Failed to reset previous track time", err);
      }
      clearCurrentTrackRefs();
    }

    const useWebAudio = !!audioContext;
    const newTrack = createAudioElement(trackConfig, useWebAudio);
    newTrack.currentTime = 0;
    console.log(
      `🎵 [DEBUG] Created new track: src=${newTrack.src}, loop=${newTrack.loop}, volume=${newTrack.volume}`
    );

    addTrackedEventListener(requestContext, newTrack, "loadstart", () => {});
    addTrackedEventListener(requestContext, newTrack, "loadedmetadata", () => {
      console.log(
        `🎵 [DEBUG] ${trackName}: loadedmetadata - duration=${newTrack.duration}`
      );

      if (!trackConfig.loop && fadeOut > 0) {
        const duration = newTrack.duration;
        if (isFinite(duration)) {
          const fadeOutStartTime = (duration - fadeOut) * 1000;
          registerTimeout(
            requestContext,
            () => {
              if (!guardRequest(requestId)) {
                return;
              }
              if (nodes) {
                startFadeOut(nodes.gainNode, fadeOut, requestContext, () => {
                  markManualPause();
                  newTrack.pause();
                });
              } else {
                startFadeOutFallback(newTrack, fadeOut, requestContext, () => {
                  markManualPause();
                  newTrack.pause();
                });
              }
            },
            Math.max(0, fadeOutStartTime)
          );
        }
      }
    });

    addTrackedEventListener(requestContext, newTrack, "play", () => {
      console.log(
        `🎵 [DEBUG] ${trackName}: play event - currentTime=${newTrack.currentTime}`
      );
    });

    addTrackedEventListener(requestContext, newTrack, "pause", () => {
      const manual = wasManualPause();
      console.log(
        `🎵 [DEBUG] ${trackName}: pause event - currentTime=${newTrack.currentTime}, manual=${manual}, ended=${newTrack.ended}`
      );

      if (!manual && !newTrack.ended) {
        console.warn(
          `🎵 [DEBUG] Unexpected pause detected for ${trackName}. Attempting recovery...`
        );
        attemptResumePlayback(newTrack, trackName);
      }
    });

    addTrackedEventListener(requestContext, newTrack, "ended", () => {
      console.log(
        `🎵 [DEBUG] ${trackName}: ended event - currentTime=${newTrack.currentTime}, duration=${newTrack.duration}`
      );
      if (onEnd && guardRequest(requestId)) {
        try {
          onEnd();
        } catch (err) {
          console.error("🎵 onEnd callback failed:", err);
        }
      }
    });

    addTrackedEventListener(requestContext, newTrack, "error", (e) => {
      console.error(`🎵 [DEBUG] ${trackName}: error event`, e);
      console.error(
        `🎵 [DEBUG] Error details: code=${newTrack.error?.code}, message=${newTrack.error?.message}`
      );
    });

    addTrackedEventListener(requestContext, newTrack, "stalled", () => {
      console.warn(`🎵 [DEBUG] ${trackName}: stalled event`);
      attemptResumePlayback(newTrack, trackName);
    });

    addTrackedEventListener(requestContext, newTrack, "suspend", () => {
      console.warn(`🎵 [DEBUG] ${trackName}: suspend event`);
      if (!wasManualPause() && !newTrack.ended) {
        attemptResumePlayback(newTrack, trackName);
      }
    });

    addTrackedEventListener(requestContext, newTrack, "waiting", () => {
      console.warn(`🎵 [DEBUG] ${trackName}: waiting event`);
      if (!wasManualPause() && !newTrack.ended) {
        attemptResumePlayback(newTrack, trackName);
      }
    });

    const nodes = useWebAudio
      ? setupAudioNodes(newTrack, trackConfig.volume)
      : null;

    console.log(
      `🎵 [DEBUG] Audio nodes setup: useWebAudio=${useWebAudio}, nodes=${!!nodes}`
    );

    if (useWebAudio && !nodes) {
      console.warn("🎵 Web Audio setup failed, using fallback");
      newTrack.volume = trackConfig.volume;
    }

    if (fadeIn > 0) {
      if (nodes) {
        currentTrack = newTrack;
        currentSource = nodes.source;
        currentGainNode = nodes.gainNode;
        currentFilterNode = nodes.filterNode;
        waveShaperNode = nodes.waveShaperNode;
        delayNode = nodes.delayNode;
        reverbGainNode = nodes.reverbGainNode;
        effectGainNode = nodes.effectGainNode;
        highpassFilterNode = nodes.highpassFilterNode;
        gaterGainNode = nodes.gaterGainNode;
        gaterLFO = nodes.gaterLFO;
        gaterLFOGain = nodes.gaterLFOGain;
        lofiFilterNode = nodes.lofiFilterNode;
        lofiGainNode = nodes.lofiGainNode;

        startCrossfade(
          newTrack,
          previousTrack,
          nodes.gainNode,
          previousGainNode,
          trackConfig.volume,
          fadeIn,
          requestContext
        );
      } else {
        newTrack.volume = 0;
        startCrossfadeFallback(
          newTrack,
          previousTrack,
          trackConfig.volume,
          fadeIn,
          requestContext
        );
      }
    }

    if (audioContext && audioContext.state === "suspended") {
      console.log("🎵 Resuming suspended AudioContext...");
      audioContext.resume().then(() => {
        console.log("🎵 AudioContext resumed, state:", audioContext.state);
      });
    }

    const startPlayback = () => {
      if (!guardRequest(requestId)) {
        return;
      }

      newTrack
        .play()
        .then(() => {
          if (!guardRequest(requestId)) {
            return;
          }

          currentTrackName = trackName;
          console.log(
            `🎵 [DEBUG] ✅ Playback started successfully: ${trackName} (${trackConfig.src})`
          );
          console.log(
            `🎵 [DEBUG] Track properties: currentTime=${newTrack.currentTime}, duration=${newTrack.duration}, paused=${newTrack.paused}, ended=${newTrack.ended}`
          );

          if (nodes) {
            console.log(
              `🎵 [DEBUG] Using Web Audio API (gain: ${nodes.gainNode.gain.value})`
            );
          } else {
            console.log(
              `🎵 [DEBUG] Using fallback audio (volume: ${newTrack.volume})`
            );
          }

          if (fadeIn === 0) {
            currentTrack = newTrack;
            if (nodes) {
              currentSource = nodes.source;
              currentGainNode = nodes.gainNode;
              currentFilterNode = nodes.filterNode;
              waveShaperNode = nodes.waveShaperNode;
              delayNode = nodes.delayNode;
              reverbGainNode = nodes.reverbGainNode;
              effectGainNode = nodes.effectGainNode;
              highpassFilterNode = nodes.highpassFilterNode;
              gaterGainNode = nodes.gaterGainNode;
              gaterLFO = nodes.gaterLFO;
              gaterLFOGain = nodes.gaterLFOGain;
              lofiFilterNode = nodes.lofiFilterNode;
              lofiGainNode = nodes.lofiGainNode;
            } else {
              currentSource = null;
              currentGainNode = null;
              currentFilterNode = null;
              waveShaperNode = null;
              delayNode = null;
              reverbGainNode = null;
              effectGainNode = null;
              highpassFilterNode = null;
              gaterGainNode = null;
              gaterLFO = null;
              gaterLFOGain = null;
              lofiFilterNode = null;
              lofiGainNode = null;
            }
          } else if (!nodes) {
            currentTrack = newTrack;
          }

          if (trackName.startsWith("PVP_STAGE")) {
            startBattlePhase();
          }

          if (window.state) {
            window.state.musicStartTime = audioContext
              ? audioContext.currentTime * 1000
              : performance.now();
            console.log(
              `🎵 Music start time: ${window.state.musicStartTime}ms`
            );
          }
        })
        .catch((err) => {
          if (!guardRequest(requestId)) {
            return;
          }
          console.error(`🎵 [DEBUG] ❌ Failed to play ${trackName}:`, err);
          console.error(
            `🎵 [DEBUG] Track state: src=${newTrack.src}, readyState=${newTrack.readyState}, networkState=${newTrack.networkState}`
          );
        });
    };

    if (delay > 0) {
      console.log(`🎵 Delaying playback by ${delay}ms`);
      registerTimeout(requestContext, startPlayback, delay);
    } else {
      startPlayback();
    }
  }

  function startFadeOut(gainNode, duration, context, onComplete) {
    if (!gainNode || !audioContext || !context) return;

    const requestId = context.id;
    const startGain = gainNode.gain.value;
    const now = audioContext.currentTime;

    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(startGain, now);
    gainNode.gain.linearRampToValueAtTime(0, now + duration);

    registerTimeout(
      context,
      () => {
        if (!guardRequest(requestId)) return;
        if (typeof onComplete === "function") {
          onComplete();
        }
      },
      duration * 1000
    );
  }

  function startFadeOutFallback(audio, duration, context, onComplete) {
    if (!audio || !context) return;

    const requestId = context.id;
    const startVolume = audio.volume;
    const startTime = performance.now();
    const durationMs = duration * 1000;

    registerInterval(
      context,
      (stop) => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / durationMs, 1);
        audio.volume = startVolume * (1 - progress);

        if (progress >= 1) {
          stop();
          if (!guardRequest(requestId)) return;
          if (typeof onComplete === "function") {
            onComplete();
          }
        }
      },
      16
    );
  }

  function startCrossfade(
    newTrack,
    oldTrack,
    newGainNode,
    oldGainNode,
    targetVolume,
    duration,
    context
  ) {
    if (!context || !audioContext) return;

    isFading = true;
    const requestId = context.id;
    const now = audioContext.currentTime;

    if (oldGainNode) {
      oldGainNode.gain.cancelScheduledValues(now);
      oldGainNode.gain.setValueAtTime(oldGainNode.gain.value, now);
      oldGainNode.gain.linearRampToValueAtTime(0, now + duration);
    }

    if (newGainNode) {
      newGainNode.gain.cancelScheduledValues(now);
      newGainNode.gain.setValueAtTime(0, now);
      newGainNode.gain.linearRampToValueAtTime(targetVolume, now + duration);
      console.log(
        `🎵 Crossfade started: 0 → ${targetVolume} over ${duration}s`
      );
    }

    registerTimeout(
      context,
      () => {
        if (!guardRequest(requestId)) return;
        if (oldTrack && oldTrack !== newTrack) {
          markManualPause();
          oldTrack.pause();
          console.log(`🎵 Old track stopped after crossfade`);
        }
        isFading = false;
        if (newGainNode) {
          console.log(
            `🎵 Crossfade complete, final gain: ${newGainNode.gain.value}`
          );
        }
      },
      duration * 1000
    );
  }

  function startCrossfadeFallback(
    newTrack,
    oldTrack,
    targetVolume,
    duration,
    context
  ) {
    if (!context) return;

    isFading = true;
    const requestId = context.id;
    fadeStartTime = performance.now();
    fadeDuration = duration * 1000;
    const oldStartVolume =
      oldTrack && oldTrack !== newTrack ? oldTrack.volume : 0;

    registerInterval(
      context,
      (stop) => {
        const elapsed = performance.now() - fadeStartTime;
        const progress = Math.min(elapsed / fadeDuration, 1);

        if (oldTrack && oldTrack !== newTrack) {
          oldTrack.volume = Math.max(0, oldStartVolume * (1 - progress));
        }

        if (newTrack) {
          newTrack.volume = targetVolume * progress;
        }

        if (progress >= 1) {
          stop();
          if (!guardRequest(requestId)) return;
          if (oldTrack && oldTrack !== newTrack) {
            markManualPause();
            oldTrack.pause();
          }
          isFading = false;
        }
      },
      16
    );
  }

  function stopMusic(fadeOut = 0) {
    if (!currentTrack) return;

    const trackToStop = currentTrack;
    const gainNodeToStop = currentGainNode;
    const previousContext = currentRequestContext;

    const requestId = ++activeRequestId;
    const requestContext = createRequestContext(requestId, "stop");
    invalidateRequestContext(previousContext);
    currentRequestContext = requestContext;

    clearCurrentTrackRefs();

    const finalizeStop = () => {
      if (!guardRequest(requestId)) return;
      try {
        markManualPause();
        trackToStop.pause();
        trackToStop.currentTime = 0;
      } catch (err) {
        console.warn("🎵 Failed to finalize stop", err);
      }
      resumeAttempts.clear();
      isFading = false;
      if (currentRequestContext === requestContext) {
        currentRequestContext = null;
      }
      invalidateRequestContext(requestContext);
      console.log("🎵 Music stopped");
    };

    if (fadeOut > 0) {
      if (gainNodeToStop && audioContext) {
        startFadeOut(gainNodeToStop, fadeOut, requestContext, finalizeStop);
      } else {
        startFadeOutFallback(
          trackToStop,
          fadeOut,
          requestContext,
          finalizeStop
        );
      }
    } else {
      finalizeStop();
    }
  }

  function toggleMusic() {
    isMusicEnabled = !isMusicEnabled;

    if (!isMusicEnabled && currentTrack) {
      stopMusic(0.5);
    }

    console.log(`🎵 Music ${isMusicEnabled ? "enabled" : "disabled"}`);
  }

  function previewTrack(trackName, duration = 10) {
    // Play first X seconds of a track (for stage select)
    // Note: Preview always uses fallback audio (no Web Audio API) to avoid conflicts
    const trackConfig = TRACKS[trackName];
    if (!trackConfig) return;

    const preview = createAudioElement(trackConfig, false); // false = don't use Web Audio
    preview.volume = trackConfig.volume * 0.7; // Slightly quieter

    preview.play().then(() => {
      setTimeout(() => {
        markManualPause();
        preview.pause();
      }, duration * 1000);
    });
  }

  function shutdown() {
    const track = currentTrack;
    const context = currentRequestContext;

    ++activeRequestId;
    invalidateRequestContext(context);
    currentRequestContext = null;
    resumeAttempts.clear();

    if (track) {
      try {
        markManualPause();
        track.pause();
      } catch (err) {
        console.warn("🎵 Failed to pause during shutdown", err);
      }
    }

    clearCurrentTrackRefs();
    isFading = false;
    console.log("🎵 AudioSystem shutdown");
  }

  function getMusicTime() {
    if (!currentTrack) {
      // console.log(`🎵 [DEBUG] getMusicTime: no current track`); // DISABLED DEBUG
      return 0;
    }

    // Use the audio element's actual playback position (in seconds)
    // This is much more accurate than performance.now() because it's
    // directly synced with the audio decoder

    // SAFETY: Clamp to prevent negative values or NaN
    const rawTime = currentTrack.currentTime || 0;

    // Check if duration is valid (not NaN or Infinity)
    const duration = currentTrack.duration;
    if (isNaN(duration) || !isFinite(duration)) {
      // Audio not fully loaded yet, return 0
      return 0;
    }

    const musicTime = Math.max(0, rawTime * 1000); // Convert to milliseconds

    // Log every 60 frames (once per second at 60fps) - DISABLED DEBUG
    // if (
    //   Math.floor(musicTime / 1000) % 5 === 0 &&
    //   Math.floor(musicTime) % 1000 < 50
    // ) {
    //   console.log(
    //     `🎵 [DEBUG] getMusicTime: currentTime=${rawTime.toFixed(
    //       3
    //     )}s, musicTime=${musicTime.toFixed(0)}ms, duration=${duration.toFixed(
    //       3
    //     )}, paused=${currentTrack.paused}, ended=${currentTrack.ended}`
    //   );
    // }

    return musicTime;
  }

  // NEW: Anti-Drift System - Detects and corrects timing drift
  let driftCorrection = {
    enabled: true,
    lastSyncTime: 0,
    lastAudioTime: 0,
    lastSystemTime: 0,
    driftHistory: [],
    maxHistorySize: 10,
    correctionThreshold: 200, // ms - correct if drift exceeds this (increased from 50)
    correctionStrength: 0.05, // How aggressively to correct (0-1) (reduced from 0.1)
    stabilityThreshold: 100, // ms - if drift is stable within this range, don't correct
  };

  function detectAndCorrectDrift(state) {
    if (!driftCorrection.enabled || !currentTrack || !state) return;

    const currentSystemTime = performance.now();
    const currentAudioTime = getMusicTime();

    // Only check every 2 seconds to avoid excessive calculations
    if (currentSystemTime - driftCorrection.lastSyncTime < 2000) return;

    driftCorrection.lastSyncTime = currentSystemTime;

    // Calculate expected audio time based on system time
    const stageStartTime = state.stageStartTime || 0;
    const expectedAudioTime =
      (currentSystemTime / 1000 - stageStartTime) * 1000;

    // Calculate drift (positive = audio ahead, negative = audio behind)
    const drift = currentAudioTime - expectedAudioTime;

    // Store drift history
    driftCorrection.driftHistory.push(drift);
    if (driftCorrection.driftHistory.length > driftCorrection.maxHistorySize) {
      driftCorrection.driftHistory.shift();
    }

    // Calculate average drift
    const avgDrift =
      driftCorrection.driftHistory.reduce((a, b) => a + b, 0) /
      driftCorrection.driftHistory.length;

    // Check if drift is stable (not changing much)
    const driftVariance =
      driftCorrection.driftHistory.reduce((sum, drift) => {
        return sum + Math.pow(drift - avgDrift, 2);
      }, 0) / driftCorrection.driftHistory.length;
    const driftStability = Math.sqrt(driftVariance);

    // Apply correction only if:
    // 1. Drift exceeds threshold AND
    // 2. Drift is not stable (changing significantly)
    if (
      Math.abs(avgDrift) > driftCorrection.correctionThreshold &&
      driftStability > driftCorrection.stabilityThreshold
    ) {
      const correction = -avgDrift * driftCorrection.correctionStrength;
      state.currentBeatOffset = (state.currentBeatOffset || 0) + correction;

      // DISABLED DEBUG - Drift correction logging
      // console.log(
      //   `🎵 [DRIFT CORRECTION] Drift: ${avgDrift.toFixed(
      //     1
      //   )}ms, Stability: ${driftStability.toFixed(
      //     1
      //   )}ms, Correction: ${correction.toFixed(
      //     1
      //   )}ms, New Offset: ${state.currentBeatOffset.toFixed(1)}ms`
      // );

      // Reset drift history after correction
      driftCorrection.driftHistory = [];
    } else if (Math.abs(avgDrift) > driftCorrection.correctionThreshold) {
      // Drift is high but stable - don't correct, just log - DISABLED DEBUG
      // console.log(
      //   `🎵 [DRIFT STABLE] Drift: ${avgDrift.toFixed(
      //     1
      //   )}ms, Stability: ${driftStability.toFixed(1)}ms - No correction needed`
      // );
    }

    // Debug logging every 10 seconds
    // DISABLED DEBUG - Drift logging
    // if (
    //   Math.floor(currentSystemTime / 10000) % 6 === 0 &&
    //   Math.floor(currentSystemTime / 1000) % 10 < 1
    // ) {
    //   console.log(
    //     `🎵 [DRIFT DEBUG] Audio: ${currentAudioTime.toFixed(
    //       0
    //     )}ms, Expected: ${expectedAudioTime.toFixed(
    //       0
    //     )}ms, Drift: ${drift.toFixed(1)}ms, Avg: ${avgDrift.toFixed(1)}ms`
    //   );
    // }
  }

  // NEW: Beat-aligned offset system - allows precise downbeat alignment
  function calculateBeatAlignedOffset(state, beatOffsetMs) {
    if (!state.currentBPM || !currentTrack) return beatOffsetMs;

    const beatInterval = 60000 / state.currentBPM; // ms per beat
    const currentMusicTime = getMusicTime();

    // Find the nearest beat boundary
    const currentBeat = Math.floor(currentMusicTime / beatInterval);
    const timeSinceBeat = currentMusicTime % beatInterval;

    // If we're closer to the next beat, align to it
    const timeToNextBeat = beatInterval - timeSinceBeat;
    const timeToPrevBeat = timeSinceBeat;

    let alignedOffset = beatOffsetMs;

    if (timeToNextBeat < timeToPrevBeat) {
      // Align to next beat
      alignedOffset = beatOffsetMs + timeToNextBeat;
    } else {
      // Align to previous beat
      alignedOffset = beatOffsetMs - timeToPrevBeat;
    }

    console.log(
      `🎵 [BEAT ALIGN] Current: ${currentMusicTime.toFixed(
        0
      )}ms, Beat: ${currentBeat}, Since: ${timeSinceBeat.toFixed(
        0
      )}ms, Aligned Offset: ${alignedOffset.toFixed(0)}ms`
    );

    return alignedOffset;
  }

  // NEW: Smart downbeat detection - finds the actual downbeat in the music
  function detectDownbeatOffset(state) {
    if (!state.currentBPM || !currentTrack) return 0;

    const beatInterval = 60000 / state.currentBPM; // ms per beat
    const currentMusicTime = getMusicTime();

    // Calculate current beat position
    const currentBeat = Math.floor(currentMusicTime / beatInterval);
    const timeSinceBeat = currentMusicTime % beatInterval;

    // For downbeat detection, we want to align to beat 0 (the downbeat)
    // If we're not on beat 0, calculate offset to get there
    const beatInBar = currentBeat % 4;
    let downbeatOffset = 0;

    if (beatInBar !== 0) {
      // Calculate how much to adjust to get to the next downbeat
      const beatsToNextDownbeat = 4 - beatInBar;
      const timeToNextDownbeat =
        beatsToNextDownbeat * beatInterval - timeSinceBeat;
      downbeatOffset = timeToNextDownbeat;
    } else {
      // We're on a downbeat, but might need to adjust timing
      if (timeSinceBeat > beatInterval / 2) {
        // We're past the middle of the beat, align to next downbeat
        downbeatOffset = 4 * beatInterval - timeSinceBeat;
      } else {
        // We're at the beginning of the beat, align to current downbeat
        downbeatOffset = -timeSinceBeat;
      }
    }

    console.log(
      `🎵 [DOWNBEAT DETECT] Current: ${currentMusicTime.toFixed(
        0
      )}ms, Beat: ${currentBeat} (${beatInBar}/4), Since: ${timeSinceBeat.toFixed(
        0
      )}ms, Downbeat Offset: ${downbeatOffset.toFixed(0)}ms`
    );

    return downbeatOffset;
  }

  function getCurrentTrack() {
    return currentTrackName;
  }

  function setVolume(volume) {
    const targetVolume = Math.max(0, Math.min(1, volume));

    if (currentGainNode && audioContext) {
      const now = audioContext.currentTime;
      currentGainNode.gain.cancelScheduledValues(now);
      currentGainNode.gain.setValueAtTime(currentGainNode.gain.value, now);
      currentGainNode.gain.linearRampToValueAtTime(targetVolume, now + 0.05);
    } else if (currentTrack) {
      // Fallback: Set volume directly on audio element
      currentTrack.volume = targetVolume;
    }
  }

  // ============================================
  // NEW: Filter Control Functions
  // ============================================

  /**
   * Set lowpass filter frequency (20 Hz - 20000 Hz)
   * @param {number} frequency - Target frequency in Hz
   * @param {number} transitionTime - Transition duration in seconds (default: 0.05)
   */
  function setLowpassFilter(frequency, transitionTime = 0.05) {
    if (!currentFilterNode || !audioContext) {
      console.warn("🎵 No active filter node");
      return;
    }

    const now = audioContext.currentTime;
    const targetFreq = Math.max(20, Math.min(20000, frequency));

    currentFilterNode.frequency.cancelScheduledValues(now);
    currentFilterNode.frequency.setValueAtTime(
      currentFilterNode.frequency.value,
      now
    );
    currentFilterNode.frequency.exponentialRampToValueAtTime(
      targetFreq,
      now + transitionTime
    );

    console.log(`🎵 Filter: ${Math.round(targetFreq)} Hz`);
  }

  /**
   * Start "Dance Phase" - Music moves to foreground (only filter, no gain boost)
   * @param {number} duration - Fade-in duration in seconds (default: calculated from BPM)
   * @param {Object} options - Optional settings { filterFreq: 20000, bpm: 120 }
   */
  function startDancePhase(duration = null, options = {}) {
    if (!currentFilterNode || !audioContext) {
      console.warn("🎵 Cannot start dance phase - no active audio");
      return;
    }

    if (isDancePhaseActive) {
      console.log("🎵 Dance phase already active");
      return;
    }

    const { filterFreq = 20000, bpm = 120 } = options;
    const now = audioContext.currentTime;

    // Calculate duration for 4 beats if not specified
    if (duration === null) {
      const beatDuration = 60.0 / bpm; // Duration of one beat in seconds
      duration = beatDuration * 4; // 4 beats
    }

    // Open filter (full spectrum) - NO gain boost for sensitive audio equipment
    setMainFilter(filterFreq, duration, 1); // prio 1: overrides battle sweeps

    // Synchronize Lo-Fi filter: fade out during dance phase
    if (lofiFilterNode && lofiGainNode) {
      setupLoFiFilter(lofiFilterNode, lofiGainNode, 1.0); // Start with full Lo-Fi

      // Fade Lo-Fi effect to 0 over the same duration
      const lofiGainStart = lofiGainNode.gain.value;
      lofiGainNode.gain.cancelScheduledValues(now);
      lofiGainNode.gain.setValueAtTime(lofiGainStart, now);
      lofiGainNode.gain.linearRampToValueAtTime(1.0, now + duration);

      // Fade Lo-Fi filter frequency to full spectrum
      lofiFilterNode.frequency.cancelScheduledValues(now);
      lofiFilterNode.frequency.setValueAtTime(
        lofiFilterNode.frequency.value,
        now
      );
      lofiFilterNode.frequency.exponentialRampToValueAtTime(
        20000,
        now + duration
      );
    }

    isDancePhaseActive = true;
    console.log(
      `🎵 Dance Phase STARTED (${duration.toFixed(
        2
      )}s fade-in over 4 beats, filter: ${filterFreq}Hz)`
    );
    console.log(
      `🎵 Current filter frequency: ${currentFilterNode.frequency.value}Hz → ${filterFreq}Hz`
    );
  }

  /**
   * End "Dance Phase" - Music moves to background
   * @param {number} duration - Fade-out duration in seconds (default: 2)
   * @param {Object} options - Optional settings { filterFreq: 200 }
   */
  function endDancePhase(duration = 2.0, options = {}) {
    if (!currentFilterNode || !audioContext) {
      console.warn("🎵 Cannot end dance phase - no active audio");
      return;
    }

    if (!isDancePhaseActive) {
      console.log("🎵 Dance phase not active");
      return;
    }

    const { filterFreq = 120 } = options; // Noch stärkerer Lowpass (120Hz = 200Hz - 40%)
    const now = audioContext.currentTime;

    // Close filter (muffled background sound) - NO volume change needed
    setMainFilter(filterFreq, duration, 0); // back to normal prio

    // Synchronize Lo-Fi filter: fade back in during end of dance phase
    if (lofiFilterNode && lofiGainNode) {
      // Fade Lo-Fi effect back in over the same duration
      const lofiGainStart = lofiGainNode.gain.value;
      lofiGainNode.gain.cancelScheduledValues(now);
      lofiGainNode.gain.setValueAtTime(lofiGainStart, now);
      lofiGainNode.gain.linearRampToValueAtTime(0.85, now + duration); // Back to Lo-Fi gain

      // Fade Lo-Fi filter frequency back to Lo-Fi range
      lofiFilterNode.frequency.cancelScheduledValues(now);
      lofiFilterNode.frequency.setValueAtTime(
        lofiFilterNode.frequency.value,
        now
      );
      lofiFilterNode.frequency.exponentialRampToValueAtTime(
        8000,
        now + duration
      ); // Back to Lo-Fi cutoff
    }

    isDancePhaseActive = false;
    console.log(
      `🎵 Dance Phase ENDED (${duration}s fade-out, filter: ${filterFreq}Hz)`
    );
  }

  /**
   * Check if dance phase is currently active
   */
  function isDancePhase() {
    return isDancePhaseActive;
  }

  // ============================================
  // NEW: Kill Zone Death Effects
  // ============================================

  /**
   * Trigger death effect sequence: Distortion → Lowpass + Reverb → Respawn → Normal
   * @param {number} playerIndex - Which player died (0 or 1)
   */
  function triggerDeathEffect(playerIndex) {
    if (
      !waveShaperNode ||
      !effectGainNode ||
      !currentFilterNode ||
      !audioContext ||
      isDeathEffectActive
    ) {
      console.warn(
        "🎵 Cannot trigger death effect - no active audio or already active"
      );
      return;
    }

    isDeathEffectActive = true;
    const now = audioContext.currentTime;

    console.log(`🎵 Death effect triggered for player ${playerIndex + 1}`);

    // Phase 1: Heavy distortion + dramatic lowpass (0.3s)
    setupWaveShaper(waveShaperNode, 0.9);
    setMainFilter(100, 0.3, 2); // prio 2 overrides everything

    // Phase 2: Add reverb for "echo of death" effect (0.4s)
    if (delayNode && reverbGainNode) {
      setupDelayReverb(delayNode, reverbGainNode, 0.6); // Heavy reverb
    }

    // Phase 3: Gradual recovery (0.8s)
    setTimeout(() => {
      setMainFilter(200, 0.8, 2); // maintain prio 2 during recovery

      // Remove distortion gradually
      if (waveShaperNode) {
        setupWaveShaper(waveShaperNode, 0.3); // Light distortion
        setTimeout(() => {
          if (waveShaperNode) {
            setupWaveShaper(waveShaperNode, 0); // No distortion
          }
        }, 400);
      }

      // Remove reverb gradually
      if (delayNode && reverbGainNode) {
        setupDelayReverb(delayNode, reverbGainNode, 0.2); // Light reverb
        setTimeout(() => {
          if (delayNode && reverbGainNode) {
            setupDelayReverb(delayNode, reverbGainNode, 0); // No reverb
          }
        }, 400);
      }
    }, 300);

    // Reset effect state after sequence
    setTimeout(() => {
      isDeathEffectActive = false;
      currentFilterPriority = 0; // Allow normal control again
      startBattlePhase();
      updateLoFiForMode();
      console.log("🎵 Death effect sequence completed");
    }, 1500);
  }

  /**
   * Reset death effects immediately (called on respawn)
   */
  function resetDeathEffects() {
    if (!waveShaperNode || !currentFilterNode || !audioContext) {
      return;
    }

    const now = audioContext.currentTime;
    console.log("🎵 Resetting death effects on respawn");

    // Immediately reset all death effects
    setupWaveShaper(waveShaperNode, 0); // Remove distortion

    // Reset filter to normal background level
    currentFilterNode.frequency.cancelScheduledValues(now);
    currentFilterNode.frequency.setValueAtTime(
      currentFilterNode.frequency.value,
      now
    );
    currentFilterNode.frequency.exponentialRampToValueAtTime(120, now + 0.3);

    // Reset reverb
    if (delayNode && reverbGainNode) {
      setupDelayReverb(delayNode, reverbGainNode, 0);
    }

    // Reset death effect state
    isDeathEffectActive = false;
  }

  // ============================================
  // NEW: Dance Battle Effects
  // ============================================

  /**
   * Start dance battle effects with progressive intensity
   * @param {number} intensity - Current dance battle intensity (0-1)
   * @param {number} beatProgress - Progress through current beat (0-1)
   */
  function updateDanceBattleEffects(intensity, beatProgress) {
    if (!delayNode || !reverbGainNode || !currentFilterNode || !audioContext) {
      return;
    }

    // Don't override filter if dance phase is active (it should stay at 20kHz)
    if (isDancePhaseActive) {
      // Only update reverb, not filter
      const reverbIntensity = intensity * 0.4; // Max 40% reverb
      setupDelayReverb(delayNode, reverbGainNode, reverbIntensity);
      console.log(
        `🎵 Dance effects (phase active): intensity=${intensity.toFixed(
          2
        )}, reverb=${reverbIntensity.toFixed(2)}`
      );
      return;
    }

    // Filter sweep via central method (prio 0)
    const baseFreq = 120;
    const maxFreq = 20000;
    const sweepFreq =
      baseFreq + (maxFreq - baseFreq) * intensity * (0.5 + beatProgress * 0.5);
    setMainFilter(sweepFreq, 0.1, 0);

    // Reverb intensity: builds up with dance battle intensity
    const reverbIntensity = intensity * 0.4; // Max 40% reverb
    setupDelayReverb(delayNode, reverbGainNode, reverbIntensity);

    console.log(
      `🎵 Dance effects: intensity=${intensity.toFixed(2)}, freq=${Math.round(
        sweepFreq
      )}Hz, reverb=${reverbIntensity.toFixed(2)}`
    );
  }

  /**
   * Trigger dramatic knockback effect during dance battle
   * @param {number} intensity - Knockback intensity (0-1)
   */
  function triggerDanceKnockbackEffect(intensity) {
    if (!waveShaperNode || !effectGainNode || !audioContext) {
      return;
    }

    const now = audioContext.currentTime;
    console.log(`🎵 Dance knockback effect: intensity=${intensity.toFixed(2)}`);

    // Dramatic distortion spike
    setupWaveShaper(waveShaperNode, intensity * 0.6);

    // Volume spike for impact
    effectGainNode.gain.cancelScheduledValues(now);
    effectGainNode.gain.setValueAtTime(1.0, now);
    effectGainNode.gain.linearRampToValueAtTime(
      1.0 + intensity * 0.3,
      now + 0.05
    );
    effectGainNode.gain.linearRampToValueAtTime(1.0, now + 0.2);

    // Remove distortion after impact
    setTimeout(() => {
      if (waveShaperNode) {
        setupWaveShaper(waveShaperNode, 0);
      }
    }, 200);
  }

  /**
   * Reset all dance battle effects to normal
   */
  function resetDanceBattleEffects() {
    if (!delayNode || !reverbGainNode || !waveShaperNode || !audioContext) {
      return;
    }

    const now = audioContext.currentTime;
    console.log("🎵 Resetting dance battle effects");

    // Reset reverb
    setupDelayReverb(delayNode, reverbGainNode, 0);

    // Reset distortion
    setupWaveShaper(waveShaperNode, 0);

    // Reset highpass filter
    if (highpassFilterNode) {
      highpassFilterNode.frequency.cancelScheduledValues(now);
      highpassFilterNode.frequency.setValueAtTime(
        highpassFilterNode.frequency.value,
        now
      );
      highpassFilterNode.frequency.exponentialRampToValueAtTime(20, now + 0.5);
    }

    // Reset gater effect
    if (gaterLFOGain) {
      gaterLFOGain.gain.cancelScheduledValues(now);
      gaterLFOGain.gain.setValueAtTime(gaterLFOGain.gain.value, now);
      gaterLFOGain.gain.linearRampToValueAtTime(0, now + 0.5);
    }

    // Reset filter to background level (stärkerer Lowpass)
    if (currentFilterNode) {
      currentFilterNode.frequency.cancelScheduledValues(now);
      currentFilterNode.frequency.setValueAtTime(
        currentFilterNode.frequency.value,
        now
      );
      currentFilterNode.frequency.exponentialRampToValueAtTime(120, now + 1.0);
    }

    // Reset Lo-Fi filter to background level
    if (lofiFilterNode && lofiGainNode) {
      setupLoFiFilter(lofiFilterNode, lofiGainNode, 1.0); // Full Lo-Fi effect
    }

    // Reset perfect beat count
    perfectBeatCount = 0;
  }

  // ============================================
  // NEW: Perfect Beat Effects
  // ============================================

  /**
   * Trigger perfect beat effect based on count
   * @param {number} playerIndex - Which player hit perfect beat (0 or 1)
   */
  function triggerPerfectBeatEffect(playerIndex) {
    if (!highpassFilterNode || !gaterLFOGain || !audioContext) {
      console.warn("🎵 Cannot trigger perfect beat effect - no active audio");
      return;
    }

    perfectBeatCount++;
    const now = audioContext.currentTime;

    console.log(
      `🎵 Perfect Beat ${perfectBeatCount} for Player ${playerIndex + 1}`
    );

    if (perfectBeatCount === 1) {
      // 1 Perfect: 10% Highpass (NO GATER)
      const targetFreq = 20 + (2000 - 20) * 0.1; // ~218 Hz
      highpassFilterNode.frequency.cancelScheduledValues(now);
      highpassFilterNode.frequency.setValueAtTime(
        highpassFilterNode.frequency.value,
        now
      );
      highpassFilterNode.frequency.exponentialRampToValueAtTime(
        targetFreq,
        now + 0.2
      );
      console.log(
        `🎵 Perfect Beat 1: Highpass to ${Math.round(targetFreq)}Hz (no gater)`
      );
    } else if (perfectBeatCount === 2) {
      // 2 Perfect: 20% Highpass (NO GATER)
      const targetFreq = 20 + (2000 - 20) * 0.2; // ~416 Hz
      highpassFilterNode.frequency.cancelScheduledValues(now);
      highpassFilterNode.frequency.setValueAtTime(
        highpassFilterNode.frequency.value,
        now
      );
      highpassFilterNode.frequency.exponentialRampToValueAtTime(
        targetFreq,
        now + 0.2
      );
      console.log(
        `🎵 Perfect Beat 2: Highpass to ${Math.round(targetFreq)}Hz (no gater)`
      );
    } else if (perfectBeatCount >= 3) {
      // 3+ Perfect: 100% Gater + 50% Highpass
      const targetFreq = 20 + (2000 - 20) * 0.5; // ~1010 Hz
      highpassFilterNode.frequency.cancelScheduledValues(now);
      highpassFilterNode.frequency.setValueAtTime(
        highpassFilterNode.frequency.value,
        now
      );
      highpassFilterNode.frequency.exponentialRampToValueAtTime(
        targetFreq,
        now + 0.2
      );

      // Maximum gater effect - ONLY activated on 3rd perfect beat
      gaterLFOGain.gain.cancelScheduledValues(now);
      gaterLFOGain.gain.setValueAtTime(gaterLFOGain.gain.value, now);
      gaterLFOGain.gain.linearRampToValueAtTime(1.0, now + 0.2);
      console.log(
        `🎵 Perfect Beat 3+: Highpass to ${Math.round(
          targetFreq
        )}Hz + 100% Gater ACTIVATED`
      );
    }
  }

  /**
   * Reset perfect beat effects (called when dance battle ends)
   */
  function resetPerfectBeatEffects() {
    if (!highpassFilterNode || !gaterLFOGain || !audioContext) {
      return;
    }

    const now = audioContext.currentTime;
    perfectBeatCount = 0;

    // Reset highpass filter
    highpassFilterNode.frequency.cancelScheduledValues(now);
    highpassFilterNode.frequency.setValueAtTime(
      highpassFilterNode.frequency.value,
      now
    );
    highpassFilterNode.frequency.exponentialRampToValueAtTime(20, now + 0.5);

    // Reset gater effect
    gaterLFOGain.gain.cancelScheduledValues(now);
    gaterLFOGain.gain.setValueAtTime(gaterLFOGain.gain.value, now);
    gaterLFOGain.gain.linearRampToValueAtTime(0, now + 0.5);

    console.log("🎵 Perfect beat effects reset");
  }

  /**
   * Reset all audio filters to default state (called on game restart)
   */
  function resetFilters() {
    if (!audioContext) return;

    const now = audioContext.currentTime;

    // Reset all filter nodes to default values
    if (currentFilterNode) {
      currentFilterNode.frequency.cancelScheduledValues(now);
      currentFilterNode.frequency.setValueAtTime(20000, now); // Full range
      currentFilterNode.Q.cancelScheduledValues(now);
      currentFilterNode.Q.setValueAtTime(1, now);
    }

    if (highpassFilterNode) {
      highpassFilterNode.frequency.cancelScheduledValues(now);
      highpassFilterNode.frequency.setValueAtTime(20, now); // Full range
    }

    if (gaterLFOGain) {
      gaterLFOGain.gain.cancelScheduledValues(now);
      gaterLFOGain.gain.setValueAtTime(0, now);
    }

    if (waveShaperNode) {
      waveShaperNode.curve = null; // Reset distortion
    }

    if (reverbGainNode) {
      reverbGainNode.gain.cancelScheduledValues(now);
      reverbGainNode.gain.setValueAtTime(0, now);
    }

    if (effectGainNode) {
      effectGainNode.gain.cancelScheduledValues(now);
      effectGainNode.gain.setValueAtTime(1.0, now);
    }

    // Reset effect states
    isDeathEffectActive = false;
    isDanceEffectActive = false;
    isDancePhaseActive = false;
    perfectBeatCount = 0;
    currentFilterPriority = 0;
    activeFilterMode = "BATTLE";

    console.log("🎵 All audio filters reset to default");
  }

  // ============================================
  // CENTRAL FILTER CONTROL (new)
  // ============================================
  let activeFilterMode = "BATTLE"; // "START", "BATTLE", "DANCE", "DEATH", etc.
  let currentFilterPriority = 0; // Higher number = higher priority, protects against lower-prio overrides
  let targetFilterFreq = 400; // Remember last target frequency for info/debug

  /**
   * Smoothly move the main low-pass filter to target frequency.
   * Uses a simple priority system: calls with lower priority than the current one are ignored
   * until the priority is reset explicitly (e.g. after transition ends).
   * @param {number} freq Target frequency in Hz (20-20000)
   * @param {number} duration Transition time in seconds
   * @param {number} priority Priority (default 0). Higher values override lower ones.
   */
  function setMainFilter(freq, duration = 1.0, priority = 0) {
    if (!currentFilterNode || !audioContext) return;
    if (priority < currentFilterPriority) {
      // Ignore low-priority request
      return;
    }
    // Accept request and remember prio
    currentFilterPriority = priority;
    const now = audioContext.currentTime;
    const clampedFreq = Math.max(20, Math.min(20000, freq));
    currentFilterNode.frequency.cancelScheduledValues(now);
    currentFilterNode.frequency.setValueAtTime(
      currentFilterNode.frequency.value,
      now
    );
    currentFilterNode.frequency.exponentialRampToValueAtTime(
      clampedFreq,
      now + duration
    );
    targetFilterFreq = clampedFreq;
    console.log(
      `🎧 setMainFilter → ${Math.round(
        clampedFreq
      )}Hz (${duration}s, prio ${priority})`
    );
  }

  /**
   * Enter standard battle mode (full frequency, no filter)
   */
  function startBattlePhase() {
    activeFilterMode = "BATTLE";
    currentFilterPriority = 0; // reset priority so regular sweeps can happen
    setMainFilter(20000, 0.5, 0); // Full frequency - no lowpass filter
  }

  /**
   * Update Lo-Fi effect intensity based on current mode
   * Battle/Background  => intensity 1.0  (muffled)
   * Dance              => intensity 0.0  (clean)
   * Death              => intensity 0.8  (very muffled)
   * Start/Other        => intensity 0.5
   */
  function updateLoFiForMode() {
    if (!lofiFilterNode || !lofiGainNode) return;
    let intensity = 0.5;
    switch (activeFilterMode) {
      case "DANCE":
        intensity = 0.0;
        break;
      case "DEATH":
        intensity = 0.8;
        break;
      case "BATTLE":
        intensity = 1.0;
        break;
      default:
        intensity = 0.5;
    }
    setupLoFiFilter(lofiFilterNode, lofiGainNode, intensity);
    console.log(
      `🎧 Lo-Fi intensity set to ${intensity.toFixed(
        2
      )} for mode ${activeFilterMode}`
    );
  }

  /**
   * Utility: Convert beats to seconds for easier timing.
   * @param {number} beats Number of beats
   * @param {number} bpm Beats per minute
   * @returns {number} seconds
   */
  function beatsToSeconds(beats, bpm = 120) {
    return (60 / bpm) * beats;
  }

  function isPlaying() {
    return currentTrack && !currentTrack.paused && !currentTrack.ended;
  }

  return {
    init,
    playTrack,
    stopMusic,
    toggleMusic,
    previewTrack,
    isPlaying,
    getMusicTime, // ← UNCHANGED! Beatmatch system stays compatible
    getCurrentTrack,
    setVolume,
    setLowpassFilter,
    currentGainNode: () => currentGainNode, // Export gain node for tutorial volume control
    startDancePhase,
    endDancePhase,
    isDancePhase,
    // NEW: Death and Dance Battle Effects
    triggerDeathEffect,
    resetDeathEffects,
    updateDanceBattleEffects,
    triggerDanceKnockbackEffect,
    resetDanceBattleEffects,
    // NEW: Perfect Beat Effects
    triggerPerfectBeatEffect,
    resetPerfectBeatEffects,
    // NEW: Reset all filters
    resetFilters,
    // Central filter API
    setMainFilter,
    beatsToSeconds,
    startBattlePhase,
    // NEW: Anti-Drift and Beat Alignment System
    detectAndCorrectDrift,
    calculateBeatAlignedOffset,
    detectDownbeatOffset,
    shutdown,
    TRACKS,
  };
})();
