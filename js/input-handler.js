window.InputHandler = (() => {
  const BindingCatalog = window.InputBindingCatalog;
  if (!BindingCatalog) {
    throw new Error(
      "[InputHandler] Missing InputBindingCatalog – ensure input-binding-catalog.js is loaded first."
    );
  }

  // Check if running in dev mode (npm start --dev or browser URL parameter)
  function isDevMode() {
    if (typeof process !== "undefined" && process.argv) {
      return process.argv.includes("--dev");
    }
    // Browser fallback: check URL parameter or localStorage
    if (typeof window !== "undefined" && window.location) {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has("dev")) return true;
      // Check localStorage flag (can be set via console: localStorage.setItem('devMode', 'true'))
      try {
        return localStorage.getItem("devMode") === "true";
      } catch (e) {
        // localStorage may be blocked in some contexts
      }
      // Check if devTools are available (indicates dev mode)
      return window.__DEV_MODE__ === true;
    }
    return false;
  }

  const ACTION_IDS = Object.keys(BindingCatalog.ACTIONS);
  const STORAGE_KEY = "beatfighter:controllerBindings:v1";

  function getDeviceGuid(pad, fallbackIndex) {
    if (!pad) return `unknown-${fallbackIndex ?? 0}`;
    if (pad.id && pad.id.trim()) return `${pad.id}`;
    return `index-${fallbackIndex ?? pad.index ?? 0}`;
  }

  function ensurePlayerBinding(state, playerIndex, pad, controllerType) {
    loadBindingStorage(state);
    const deviceGuid = getDeviceGuid(pad, playerIndex);
    const bindings = state.input.playerBindings;
    const current = bindings[playerIndex];
    let changed = false;

    if (
      !current ||
      current.deviceGuid !== deviceGuid ||
      current.controllerType !== controllerType
    ) {
      const created = BindingCatalog.createBindingsForType(controllerType);
      const overrides =
        state.input.bindingOverrides?.devices?.[deviceGuid]?.bindings;
      const mergedBindings = overrides
        ? BindingCatalog.mergeBindings(created.bindings, overrides)
        : created.bindings;
      bindings[playerIndex] = {
        deviceGuid,
        controllerType: created.controllerType,
        bindings: mergedBindings,
      };
      state.input.prevActionState[playerIndex] = {};
      changed = true;
    }

    return { binding: bindings[playerIndex], changed };
  }

  function getPlayerBinding(state, playerIndex) {
    return state.input.playerBindings[playerIndex] || null;
  }

  function getActionLabel(actionId) {
    const entry = BindingCatalog.ACTION_DISPLAY.find(
      (action) => action.id === actionId
    );
    return entry ? entry.label : actionId;
  }

  function readButton(pad, binding) {
    if (!pad || !binding) {
      return { pressed: false, value: 0 };
    }
    if (binding.type === "button") {
      const btn = pad.buttons?.[binding.index];
      return {
        pressed: !!btn?.pressed,
        value: btn?.value ?? 0,
      };
    }
    if (binding.type === "axis") {
      const raw = pad.axes?.[binding.index] ?? 0;
      const deadzone =
        binding.deadzone !== undefined ? Math.max(binding.deadzone, 0) : 0;
      const value = Math.abs(raw) < deadzone ? 0 : raw;
      const threshold =
        binding.threshold !== undefined ? binding.threshold : 0.5;
      return {
        pressed: Math.abs(value) >= threshold,
        value,
      };
    }
    return { pressed: false, value: 0 };
  }

  function cloneBindings(bindings) {
    return JSON.parse(JSON.stringify(bindings || {}));
  }

  function loadBindingStorage(state) {
    if (state.input.bindingStorageLoaded) return;
    state.input.bindingStorageLoaded = true;
    if (typeof window === "undefined" || !window.localStorage) {
      state.input.bindingOverrides = { devices: {} };
      return;
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        state.input.bindingOverrides = { devices: {} };
        return;
      }
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        state.input.bindingOverrides = parsed;
      } else {
        state.input.bindingOverrides = { devices: {} };
      }
    } catch (err) {
      console.warn("[InputHandler] Failed to load controller bindings:", err);
      state.input.bindingOverrides = { devices: {} };
    }
  }

  function saveBindingStorage(state) {
    if (typeof window === "undefined" || !window.localStorage) return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state.input.bindingOverrides)
      );
    } catch (err) {
      console.warn("[InputHandler] Failed to save controller bindings:", err);
    }
  }

  function persistBindingOverride(state, bindingState) {
    if (!bindingState) return;
    if (!state.input.bindingOverrides) {
      state.input.bindingOverrides = { devices: {} };
    }
    if (!state.input.bindingOverrides.devices) {
      state.input.bindingOverrides.devices = {};
    }
    state.input.bindingOverrides.devices[bindingState.deviceGuid] = {
      controllerType: bindingState.controllerType,
      bindings: cloneBindings(bindingState.bindings),
    };
    saveBindingStorage(state);
  }

  function computeEdges(state, playerIndex, actionId, pressed) {
    const prevState =
      state.input.prevActionState[playerIndex] ||
      (state.input.prevActionState[playerIndex] = {});
    const wasPressed = !!prevState[actionId];
    prevState[actionId] = pressed;

    return {
      down: pressed && !wasPressed,
      up: !pressed && wasPressed,
    };
  }

  function announceBindingChange(state, actionId, message) {
    if (!state.modal?.controlsModal) return;
    const controlsModal = state.modal.controlsModal;
    controlsModal.lastBoundActionId = actionId;
    controlsModal.notice = message;
    controlsModal.noticeTimer = performance.now() * 0.001;
  }

  function writeBinding(state, playerIndex, actionId, bindingData) {
    const bindingState = state.input.playerBindings[playerIndex];
    if (!bindingState) return;

    const currentBinding = bindingState.bindings
      ? bindingState.bindings[actionId]
      : null;
    const prevBindingClone =
      currentBinding && typeof currentBinding === "object"
        ? JSON.parse(JSON.stringify(currentBinding))
        : null;

    if (bindingData) {
      const newBinding = { ...bindingData };
      bindingState.bindings[actionId] = newBinding;

      if (newBinding.type === "button") {
        let swapCandidate =
          prevBindingClone && prevBindingClone.type === "button"
            ? { ...prevBindingClone }
            : null;
        Object.keys(bindingState.bindings).forEach((otherActionId) => {
          if (otherActionId === actionId) return;
          const otherBinding = bindingState.bindings[otherActionId];
          if (!otherBinding) return;
          if (
            otherBinding.type === "button" &&
            otherBinding.index === newBinding.index
          ) {
            if (swapCandidate) {
              bindingState.bindings[otherActionId] = { ...swapCandidate };
              swapCandidate = null;
            } else {
              bindingState.bindings[otherActionId] = null;
            }
          }
        });
      }
    } else {
      bindingState.bindings[actionId] = null;
    }

    persistBindingOverride(state, bindingState);
    resetPrevActionState(state, playerIndex);
    return bindingState;
  }

  function applyCapturedBinding(
    state,
    playerIndex,
    actionId,
    newBinding,
    controllerType
  ) {
    if (!state.modal?.controlsModal) return;
    const controlsModal = state.modal.controlsModal;
    const bindingState = writeBinding(state, playerIndex, actionId, newBinding);
    if (!bindingState) return;

    if (controllerType) {
      bindingState.controllerType = controllerType;
      persistBindingOverride(state, bindingState);
    }

    controlsModal.captureMode = null;
    controlsModal.focus = "actions";
    controlsModal.lastCaptureTime = performance.now() * 0.001;
    const label = getActionLabel(actionId);
    announceBindingChange(
      state,
      actionId,
      `Bound ${label} to ${BindingCatalog.formatBinding(
        bindingState.controllerType,
        bindingState.bindings[actionId]
      )}`
    );
  }

  function setBinding(state, playerIndex, actionId, bindingData) {
    const bindingState = writeBinding(
      state,
      playerIndex,
      actionId,
      bindingData
    );
    if (!bindingState) return;
    const label = getActionLabel(actionId);
    announceBindingChange(
      state,
      actionId,
      `Bound ${label} to ${BindingCatalog.formatBinding(
        bindingState.controllerType,
        bindingState.bindings[actionId]
      )}`
    );
  }

  function clearBinding(state, playerIndex, actionId) {
    const bindingState = writeBinding(state, playerIndex, actionId, null);
    if (!bindingState) return;
    const label = getActionLabel(actionId);
    announceBindingChange(state, actionId, `Cleared binding for ${label}`);
  }

  function resetBinding(state, playerIndex, actionId) {
    const bindingState = state.input.playerBindings[playerIndex];
    if (!bindingState) return;
    const defaults =
      BindingCatalog.createBindingsForType(bindingState.controllerType)
        .bindings?.[actionId] || null;
    const updated = writeBinding(
      state,
      playerIndex,
      actionId,
      defaults ? { ...defaults } : null
    );
    if (!updated) return;
    const binding = updated.bindings[actionId];
    const formatted = binding
      ? BindingCatalog.formatBinding(updated.controllerType, binding)
      : "Unbound";
    const label = getActionLabel(actionId);
    announceBindingChange(
      state,
      actionId,
      binding
        ? `Reset ${label} to default (${formatted})`
        : `Reset ${label} to default`
    );
  }

  function handleBindingCapture(state, playerIndex, pad, controllerType) {
    const controlsModal = state.modal?.controlsModal;
    if (!controlsModal?.captureMode) return;

    const capture = controlsModal.captureMode;
    if (capture.playerIndex !== playerIndex) return;

    const actionId = capture.actionId;
    const meta = BindingCatalog.ACTIONS[actionId];
    if (!meta) return;

    const rawPrevButtons =
      state.input.rawPrevButtons[playerIndex] ||
      (state.input.rawPrevButtons[playerIndex] = []);

    if (meta.kind === "button") {
      const buttons = pad.buttons || [];
      for (let i = 0; i < buttons.length; i++) {
        const pressed = !!buttons[i]?.pressed;
        const wasPressed = rawPrevButtons[i] || false;
        if (pressed && !wasPressed) {
          const existing =
            state.input.playerBindings[playerIndex].bindings[actionId];
          if (!existing || existing.type !== "button" || existing.index !== i) {
            applyCapturedBinding(
              state,
              playerIndex,
              actionId,
              { type: "button", index: i },
              controllerType
            );
          } else {
            controlsModal.captureMode = null;
          }
          rawPrevButtons[i] = pressed;
          return;
        }
        rawPrevButtons[i] = pressed;
      }
    } else if (meta.kind === "axis") {
      capture.prevAxes = capture.prevAxes || [];
      const axes = pad.axes || [];
      for (let i = 0; i < axes.length; i++) {
        const value = axes[i] ?? 0;
        const prevValue = capture.prevAxes[i] ?? 0;
        if (Math.abs(value) > 0.6 && Math.abs(prevValue) < 0.2) {
          applyCapturedBinding(
            state,
            playerIndex,
            actionId,
            {
              type: "axis",
              index: i,
              deadzone: 0.2,
              threshold: 0.5,
            },
            controllerType
          );
          capture.prevAxes = axes.map((v) => v);
          return;
        }
      }
      capture.prevAxes = axes.map((v) => v);
    }
  }

  function resetPrevActionState(state, playerIndex) {
    if (state.input.prevActionState[playerIndex]) {
      ACTION_IDS.forEach((actionId) => {
        state.input.prevActionState[playerIndex][actionId] = false;
      });
    }
    state.input.gamepadPrevJump[playerIndex] = false;
    state.input.gamepadPrevR1[playerIndex] = false;
    state.input.gamepadPrevR2[playerIndex] = false;
    state.input.gamepadPrevL1[playerIndex] = false;
    state.input.gamepadPrevL2[playerIndex] = false;
    state.input.gamepadPrevR3[playerIndex] = false;
    state.input.gamepadPrevB[playerIndex] = false;
    state.input.gamepadPrevDanceBattle[playerIndex] = false;
    state.input.gamepadPrevTriangle[playerIndex] = false;
    state.input.gamepadPrevStart[playerIndex] = false;
    state.input.prevPadSig[playerIndex] = "";
    state.input.loggedPadInfo[playerIndex] = false;
    state.input.rawPrevButtons[playerIndex] = [];
  }

  function setupListeners(state) {
    window.addEventListener("keydown", (e) => {
      if (!e.repeat) state.input.keysPressed.add(e.key);
      state.input.keysDown.add(e.key);

      // Escape key always works (not a debug key)
      if (e.key === "Escape") {
        // Handle modal in PLAYING mode
        if (state.gameMode === "PLAYING") {
          if (state.modal.controlsModal.isOpen) {
            // Close controls modal first
            state.modal.controlsModal.isOpen = false;
            state.modal.controlsModal.captureMode = null;
            state.modal.controlsModal.notice = "";
            state.modal.controlsModal.focus = "player";
            state.modal.controlsModal.lastCaptureTime = 0;
          } else if (state.modal.isOpen) {
            // Close main modal
            state.modal.isOpen = false;
          } else {
            // Open main modal
            state.modal.isOpen = true;
            state.modal.selectedButton = 0; // Reset selection
          }
        }
        // Handle modal in CHARACTER_SELECT and STAGE_SELECT
        else if (
          state.gameMode === "CHARACTER_SELECT" ||
          state.gameMode === "STAGE_SELECT"
        ) {
          if (state.modal.isOpen) {
            // Close modal
            state.modal.isOpen = false;
          } else {
            // Open modal with Quit Game option
            state.modal.isOpen = true;
            state.modal.selectedButton = 5; // Select "Quit Game" button (index 5)
          }
        }
        return; // Escape handled, don't process further
      }

      // Debug keys only work in dev mode
      const devMode = isDevMode();
      if (!devMode) {
        return; // Skip all debug keys if not in dev mode
      }

      // Dev mode only keys below
      if (e.key === "h" || e.key === "H") {
        state.debug.drawBoxes = !state.debug.drawBoxes;
      }
      if (e.key === "m" || e.key === "M") {
        AudioSystem.toggleMusic();
      }
      if (e.key === "n" || e.key === "N") {
        if (window.toggleMetronome) {
          window.toggleMetronome();
        }
      }
      if (e.key === "p" || e.key === "P") {
        // Alt+P: Spawn NPC (Player 2)
        if (e.altKey) {
          if (state.gameMode === "PLAYING" && window.spawnNPC) {
            window.spawnNPC(state);
          }
        } else {
          // P: Toggle NPC on/off
          if (window.NPCController) {
            window.NPCController.toggle();
          }
        }
      }
      if (e.key === "i" || e.key === "I") {
        state.debug.devMode = !state.debug.devMode;
        console.log(
          `🛠️ Dev Mode ${state.debug.devMode ? "ENABLED" : "DISABLED"}`
        );
      }
      if (e.key === "c" || e.key === "C") {
        state.debug.cameraLogging = !state.debug.cameraLogging;
        console.log(
          `📷 Camera Logging ${
            state.debug.cameraLogging ? "ENABLED" : "DISABLED"
          }`
        );
        if (state.debug.cameraLogging) {
          console.log("  → Camera debug info will be logged to console");
          console.log(
            "  → Shows zoom calculations, bounds, and final camera values"
          );
          console.log("  → Press C again to disable");
        }
      }
      if (e.key === "q" || e.key === "Q") {
        state.debug.showModal = !state.debug.showModal;
        console.log(
          `🔧 Debug Modal ${state.debug.showModal ? "SHOWN" : "HIDDEN"}`
        );
      }
      if (e.key === "b" || e.key === "B") {
        if (window.alignBeatOffset) {
          window.alignBeatOffset();
        }
      }
      if (e.key === "v" || e.key === "V") {
        if (window.state) {
          window.state.debug = window.state.debug || {};
          window.state.debug.beatSyncLogging =
            !window.state.debug.beatSyncLogging;
          console.log(
            `🎬 Beat sync debug logging: ${
              window.state.debug.beatSyncLogging ? "ON" : "OFF"
            }`
          );
        }
      }
      if (e.key === "t" || e.key === "T") {
        if (window.toggleBeatSync) {
          window.toggleBeatSync();
        }
      }
      if (e.key === "f" || e.key === "F") {
        if (window.setFPSMultiplier) {
          // Cycle through FPS multipliers: 1x -> 2x -> 4x -> 1x
          const currentMultiplier =
            state.stageAnimations?.[0]?.fpsMultiplier || 1;
          const nextMultiplier =
            currentMultiplier === 1 ? 2 : currentMultiplier === 2 ? 4 : 1;
          window.setFPSMultiplier(nextMultiplier);
        }
      }
      if (e.key === "z" || e.key === "Z") {
        // Test dance_spot animation
        if (window.testDanceSpotEffect && state.gameMode === "PLAYING") {
          window.testDanceSpotEffect(state);
          console.log("🎭 Dance spot test animation spawned!");
        }
      }
      if (e.key === "u" || e.key === "U") {
        // Toggle UI visibility
        state.uiVisible = !state.uiVisible;
        console.log(`🎮 UI ${state.uiVisible ? "SHOWN" : "HIDDEN"}`);
      }
    });
    window.addEventListener("keyup", (e) => {
      state.input.keysDown.delete(e.key);
    });

    // Gamepad connection events
    window.addEventListener("gamepadconnected", (e) => {
      console.log(
        `🎮 Gamepad connected: ${e.gamepad.id} at index ${e.gamepad.index}`
      );
      state.input.connectedGamepads.add(e.gamepad.index);
      updateGamepadMapping(state);
    });

    window.addEventListener("gamepaddisconnected", (e) => {
      console.log(
        `🎮 Gamepad disconnected: ${e.gamepad.id} at index ${e.gamepad.index}`
      );
      state.input.connectedGamepads.delete(e.gamepad.index);

      // Remove from player mapping if assigned
      for (let i = 0; i < state.input.gamepadMapping.length; i++) {
        if (state.input.gamepadMapping[i] === e.gamepad.index) {
          state.input.gamepadMapping[i] = null;
          console.log(`Player ${i + 1} gamepad disconnected`);
          state.input.loggedPadInfo[i] = false;
        }
      }
      updateGamepadMapping(state);
      state.input.playerBindings.forEach((binding, idx) => {
        if (binding?.deviceGuid === getDeviceGuid(e.gamepad, idx)) {
          resetPrevActionState(state, idx);
        }
      });
    });

    // Initial gamepad scan (for already connected gamepads)
    scanGamepads(state);
  }

  function scanGamepads(state) {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i]) {
        state.input.connectedGamepads.add(i);
      }
    }
    updateGamepadMapping(state);
  }

  function updateGamepadMapping(state) {
    // Assign first available gamepad to P1 if not assigned
    if (state.input.gamepadMapping[0] === null) {
      const available = Array.from(state.input.connectedGamepads);
      if (available.length > 0) {
        state.input.gamepadMapping[0] = available[0];
        console.log(`✅ Player 1 assigned to gamepad ${available[0]}`);
      }
    }

    // Assign second available gamepad to P2 if not assigned
    if (state.input.gamepadMapping[1] === null) {
      const available = Array.from(state.input.connectedGamepads).filter(
        (idx) => idx !== state.input.gamepadMapping[0]
      );
      if (available.length > 0) {
        state.input.gamepadMapping[1] = available[0];
        console.log(`✅ Player 2 assigned to gamepad ${available[0]}`);
      }
    }

    const pads = pollGamepads();
    state.input.gamepadMapping.forEach((physicalIndex, playerIndex) => {
      if (physicalIndex === null) {
        resetPrevActionState(state, playerIndex);
        return;
      }
      const pad = pads?.[physicalIndex];
      if (!pad) {
        resetPrevActionState(state, playerIndex);
        return;
      }
      const controllerType = detectControllerType(pad);
      const { changed } = ensurePlayerBinding(
        state,
        playerIndex,
        pad,
        controllerType
      );
      if (changed) {
        resetPrevActionState(state, playerIndex);
      }
    });
  }

  function pollGamepads() {
    return navigator.getGamepads ? navigator.getGamepads() : [];
  }

  /**
   * Detects the controller type based on gamepad ID
   * @param {Gamepad} pad - The gamepad object
   * @returns {string} - "ps", "xbox", "switch", or "generic"
   */
  function detectControllerType(pad) {
    if (!pad || !pad.id) {
      // If no ID, try to detect by mapping
      // Standard mapping usually means Xbox-like layout
      if (pad.mapping === "standard") {
        return "generic"; // Treat as generic/Xbox-like
      }
      return "generic";
    }

    const mapping = pad.mapping || "";
    const id = pad.id.toLowerCase();
    const isPS = /sony|dualshock|dualsense|ps[45]|054c|0810|0ce6/.test(id);
    const isXbox = /xbox|microsoft|045e|028e|xinput/.test(id);
    const isSwitch = /nintendo|switch|pro controller|057e/.test(id);

    if (isPS) {
      // If browser already maps it to standard, use ps_standard to get correct labels + standard bindings
      return mapping === "standard" ? "ps_standard" : "ps";
    }
    if (isXbox) return "xbox";
    if (isSwitch) return "switch";

    // If mapping is "standard", assume Xbox-like layout (generic controllers usually use standard)
    if (mapping === "standard") {
      return "generic"; // Will be treated as Xbox-like in mapping
    }

    return "generic";
  }

  function getPadInput(playerIndex, state) {
    const physicalIndex = state.input.gamepadMapping[playerIndex];
    const pads = pollGamepads();
    const pad = physicalIndex !== null ? pads?.[physicalIndex] : null;

    const inputs = {
      axis: 0,
      jump: false,
      jumpHeld: false,
      r1Held: false,
      r1Down: false,
      r1Up: false,
      r2Held: false,
      r2Down: false,
      r2Up: false,
      rollDown: false,
      rollHeld: false,
      rollUp: false,
      wallInteractDown: false,
      wallInteractHeld: false,
      wallInteractUp: false,
      downHeld: false,
      grabDown: false, // Formerly danceBattleDown
      l1Held: false,
      l1Down: false,
      l1Up: false,
      l2Held: false,
      l2Down: false,
      l2Up: false,
      ultiDown: false,
      danceDown: false,
      l3UpR1Down: false,
    };

    if (!pad) {
      resetPrevActionState(state, playerIndex);
      return inputs;
    }

    const controllerType = detectControllerType(pad);
    const { binding, changed } = ensurePlayerBinding(
      state,
      playerIndex,
      pad,
      controllerType
    );

    if (changed) {
      console.log(
        `[Input] P${playerIndex + 1} binding initialized for '${
          binding.deviceGuid
        }' (${binding.controllerType})`
      );
    }

    const bindingMap = binding.bindings;

    handleBindingCapture(state, playerIndex, pad, binding.controllerType);

    const axisXState = readButton(pad, bindingMap.axisX);
    const axisYState = readButton(pad, bindingMap.axisY);
    const dpadLeft = readButton(pad, bindingMap.dpadLeft).pressed;
    const dpadRight = readButton(pad, bindingMap.dpadRight).pressed;
    const dpadDownState = readButton(pad, bindingMap.dpadDown);
    const dpadUp = readButton(pad, bindingMap.dpadUp).pressed;

    if (dpadLeft) inputs.axis = -1;
    if (dpadRight) inputs.axis = 1;
    if (Math.abs(axisXState.value) > 0.2) inputs.axis = axisXState.value;

    inputs.downHeld = dpadDownState.pressed || axisYState.value > 0.4;

    // Jump
    const jumpPressed = readButton(pad, bindingMap.jump).pressed;
    const jumpEdges = computeEdges(state, playerIndex, "jump", jumpPressed);
    inputs.jumpHeld = jumpPressed;
    inputs.jump = jumpEdges.down;
    state.input.gamepadPrevJump[playerIndex] = jumpPressed;

    // R1
    const r1Pressed = readButton(pad, bindingMap.r1).pressed;
    const r1Edges = computeEdges(state, playerIndex, "r1", r1Pressed);
    inputs.r1Held = r1Pressed;
    inputs.r1Down = r1Edges.down;
    inputs.r1Up = r1Edges.up;
    state.input.gamepadPrevR1[playerIndex] = r1Pressed;

    // R2
    const r2Pressed = readButton(pad, bindingMap.r2).pressed;
    const r2Edges = computeEdges(state, playerIndex, "r2", r2Pressed);
    inputs.r2Held = r2Pressed;
    inputs.r2Down = r2Edges.down;
    inputs.r2Up = r2Edges.up;
    if (inputs.r2Down) {
      state.input.lastR2DownTime[playerIndex] = performance.now() * 0.001;
    }
    state.input.gamepadPrevR2[playerIndex] = r2Pressed;

    // L1
    const l1Pressed = readButton(pad, bindingMap.l1).pressed;
    const l1Edges = computeEdges(state, playerIndex, "l1", l1Pressed);
    inputs.l1Held = l1Pressed;
    inputs.l1Down = l1Edges.down;
    inputs.l1Up = l1Edges.up;
    state.input.gamepadPrevL1[playerIndex] = l1Pressed;

    // L2
    const l2Pressed = readButton(pad, bindingMap.l2).pressed;
    const l2Edges = computeEdges(state, playerIndex, "l2", l2Pressed);
    inputs.l2Held = l2Pressed;
    inputs.l2Down = l2Edges.down;
    inputs.l2Up = l2Edges.up;
    if (inputs.l2Down) {
      state.input.lastL2DownTime[playerIndex] = performance.now() * 0.001;
      console.log(
        `[Input] P${
          playerIndex + 1
        }: L2 DOWN (Gamepad ${physicalIndex}, ${controllerType})`
      );
    }
    if (inputs.l2Up) {
      console.log(
        `[Input] P${
          playerIndex + 1
        }: L2 UP (Gamepad ${physicalIndex}, ${controllerType})`
      );
    }
    state.input.gamepadPrevL2[playerIndex] = l2Pressed;

    // R3 (Ultimate trigger)
    const r3Pressed = readButton(pad, bindingMap.r3).pressed;
    const r3Edges = computeEdges(state, playerIndex, "r3", r3Pressed);
    inputs.ultiDown = r3Edges.down;
    state.input.gamepadPrevR3[playerIndex] = r3Pressed;

    // Roll
    const rollPressed = readButton(pad, bindingMap.roll).pressed;
    const rollEdges = computeEdges(state, playerIndex, "roll", rollPressed);
    inputs.rollHeld = rollPressed;
    inputs.rollDown = rollEdges.down;
    inputs.rollUp = rollEdges.up;
    state.input.gamepadPrevB[playerIndex] = rollPressed;

    // Grab (Square equivalent - formerly Dance Battle)
    const grabPressed = readButton(pad, bindingMap.danceBattle).pressed;
    const grabEdges = computeEdges(
      state,
      playerIndex,
      "danceBattle", // Keep internal ID for binding/edge consistency
      grabPressed
    );
    inputs.grabDown = grabEdges.down;
    state.input.gamepadPrevDanceBattle[playerIndex] = grabPressed;

    // Dance (Circle equivalent)
    const dancePressed = readButton(pad, bindingMap.dance).pressed;
    const danceEdges = computeEdges(state, playerIndex, "dance", dancePressed);
    inputs.danceDown = danceEdges.down;
    state.input.gamepadPrevTriangle[playerIndex] = dancePressed;

    // L3 state for special combos
    const l3Pressed = readButton(pad, bindingMap.l3).pressed;
    computeEdges(state, playerIndex, "l3", l3Pressed);

    // Fritz special: L3 up + R1 down
    inputs.l3UpR1Down =
      inputs.r1Down && (axisYState.value < -0.4 || dpadUp === true);

    // Debug logging (once)
    const pressedButtons = [0, 1, 2, 3, 4, 5, 6, 7]
      .map((i) => (pad.buttons?.[i]?.pressed ? i : null))
      .filter((i) => i !== null);

    if (pressedButtons.length > 0 && !state.input.loggedPadInfo[playerIndex]) {
      console.log(
        `[Input Debug] P${
          playerIndex + 1
        } (${controllerType}): Raw buttons pressed: [${pressedButtons.join(
          ", "
        )}]`
      );
    }

    const sig = [0, 1, 2, 3, 4, 5, 6, 7]
      .map((i) => (pad.buttons?.[i]?.pressed ? i : "."))
      .join("");
    if (state.input.prevPadSig[playerIndex] !== sig) {
      state.input.prevPadSig[playerIndex] = sig;
    }
    if (!state.input.loggedPadInfo[playerIndex]) {
      console.log(
        `[Input] P${playerIndex + 1} mapped to Pad${physicalIndex}: id='${
          pad.id || "?"
        }', type='${controllerType}', mapping='${pad.mapping || "?"}'`
      );
      state.input.loggedPadInfo[playerIndex] = true;
    }

    state.input.rawPrevButtons[playerIndex] = (pad.buttons || []).map((btn) =>
      btn ? !!btn.pressed : false
    );

    return inputs;
  }

  function getKeyboardInput(state) {
    const kd = state.input.keysDown;
    const pressed = state.input.keysPressed;

    // Movement: Arrow keys only
    const left = kd.has("ArrowLeft");
    const right = kd.has("ArrowRight");

    // Abilities
    const r1Held = kd.has("q") || kd.has("Q");
    const r1Down = pressed.has("q") || pressed.has("Q");
    const r2Held = kd.has("w") || kd.has("W");
    const r2Down = pressed.has("w") || pressed.has("W");
    const l1Held = kd.has("e") || kd.has("E");
    const l1Down = pressed.has("e") || pressed.has("E");
    const l2Held = kd.has("r") || kd.has("R");
    const l2Down = pressed.has("r") || pressed.has("R");

    if (l2Down) {
      console.log(`[Input] P1: L2 DOWN (Keyboard R)`);
    }

    // Ultimate: S key
    const ultiDown = pressed.has("s") || pressed.has("S");

    // Jump: Spacebar
    const jumpPressed = pressed.has(" ");
    const jumpHeld = kd.has(" ");

    // Dodge: Shift
    const rollDown =
      pressed.has("Shift") ||
      pressed.has("ShiftLeft") ||
      pressed.has("ShiftRight");
    const rollHeld =
      kd.has("Shift") || kd.has("ShiftLeft") || kd.has("ShiftRight");
    const rollUp =
      !(kd.has("Shift") || kd.has("ShiftLeft") || kd.has("ShiftRight")) &&
      (state.input.prevKeysDown?.has("Shift") ||
        state.input.prevKeysDown?.has("ShiftLeft") ||
        state.input.prevKeysDown?.has("ShiftRight"));

    // Walljump/Wallslide: Ctrl
    const wallInteractDown =
      pressed.has("Control") ||
      pressed.has("ControlLeft") ||
      pressed.has("ControlRight");
    const wallInteractHeld =
      kd.has("Control") || kd.has("ControlLeft") || kd.has("ControlRight");
    const wallInteractUp =
      !(kd.has("Control") || kd.has("ControlLeft") || kd.has("ControlRight")) &&
      (state.input.prevKeysDown?.has("Control") ||
        state.input.prevKeysDown?.has("ControlLeft") ||
        state.input.prevKeysDown?.has("ControlRight"));

    // Dance: D
    const danceDown = pressed.has("d") || pressed.has("D");

    // L3 Up + R1 Down (Fritz special combo)
    const l3UpR1Down = r1Down && kd.has("ArrowUp");

    return {
      axis: left && !right ? -1 : right && !left ? 1 : 0,
      jump: jumpPressed,
      jumpHeld: jumpHeld,
      r1Held: r1Held,
      r1Down: r1Down,
      r2Held: r2Held,
      r2Down: r2Down,
      l1Held: l1Held,
      l1Down: l1Down,
      l1Up:
        !l1Held &&
        (state.input.prevKeysDown?.has("e") ||
          state.input.prevKeysDown?.has("E")),
      l2Held: l2Held,
      l2Down: l2Down,
      l2Up:
        !l2Held &&
        (state.input.prevKeysDown?.has("r") ||
          state.input.prevKeysDown?.has("R")),
      ultiDown: ultiDown,
      l3UpR1Down: l3UpR1Down,
      rollDown: rollDown,
      rollHeld: rollHeld,
      rollUp: rollUp,
      wallInteractDown: wallInteractDown,
      wallInteractHeld: wallInteractHeld,
      wallInteractUp: wallInteractUp,
      downHeld: kd.has("ArrowDown"),
      grabDown: pressed.has("a") || pressed.has("A"), // Grab mapped to A key
      danceDown: danceDown,
    };
  }

  function clearInputEdges(state) {
    state.input.prevKeysDown = new Set(state.input.keysDown);
    state.input.keysPressed.clear();
  }

  return {
    setupListeners,
    getPadInput,
    getKeyboardInput,
    clearInputEdges,
    scanGamepads,
    updateGamepadMapping,
    setBinding,
    clearBinding,
    resetBinding,
  };
})();
