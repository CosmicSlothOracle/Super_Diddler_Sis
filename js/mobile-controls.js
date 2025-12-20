// Virtual Gamepad for Mobile Devices
// Provides joystick (left) and action buttons (right)
window.MobileControls = (() => {
  let joystickActive = false;
  let joystickX = 0;
  let joystickY = 0;
  let joystickBaseX = 0;
  let joystickBaseY = 0;
  let joystickKnobX = 0;
  let joystickKnobY = 0;
  let joystickRadius = 60;
  let joystickKnobRadius = 30;
  let activePointerId = null;

  const buttons = {
    jump: { pressed: false, down: false, up: false },
    r1: { pressed: false, down: false, up: false },
    r2: { pressed: false, down: false, up: false },
    l1: { pressed: false, down: false, up: false },
    l2: { pressed: false, down: false, up: false },
    roll: { pressed: false, down: false, up: false },
    grab: { pressed: false, down: false, up: false },
    dance: { pressed: false, down: false, up: false },
    ultimate: { pressed: false, down: false, up: false },
  };

  const prevButtonState = {
    jump: false,
    r1: false,
    r2: false,
    l1: false,
    l2: false,
    roll: false,
    grab: false,
    dance: false,
    ultimate: false,
  };

  let container = null;
  let joystickBase = null;
  let joystickKnob = null;
  let buttonContainer = null;
  let isVisible = false;

  function createControls() {
    if (container) return;

    container = document.createElement("div");
    container.id = "mobile-controls";
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1000;
      touch-action: none;
      user-select: none;
    `;

    // Joystick (left side)
    const joystickArea = document.createElement("div");
    joystickArea.style.cssText = `
      position: absolute;
      left: 20px;
      bottom: 20px;
      width: 140px;
      height: 140px;
      pointer-events: auto;
      touch-action: none;
    `;

    joystickBase = document.createElement("div");
    joystickBase.style.cssText = `
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      width: ${joystickRadius * 2}px;
      height: ${joystickRadius * 2}px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.15);
      border: 3px solid rgba(255, 255, 255, 0.4);
      pointer-events: none;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.2);
    `;

    joystickKnob = document.createElement("div");
    joystickKnob.style.cssText = `
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      width: ${joystickKnobRadius * 2}px;
      height: ${joystickKnobRadius * 2}px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.7);
      border: 3px solid rgba(255, 255, 255, 0.9);
      pointer-events: none;
      transition: transform 0.08s ease-out;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4), inset 0 1px 2px rgba(255, 255, 255, 0.3);
    `;

    joystickArea.appendChild(joystickBase);
    joystickArea.appendChild(joystickKnob);
    container.appendChild(joystickArea);

    // Buttons (right side) - Expanded layout for all buttons
    buttonContainer = document.createElement("div");
    buttonContainer.style.cssText = `
      position: absolute;
      right: 15px;
      bottom: 15px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      grid-template-rows: repeat(3, 1fr);
      gap: 10px;
      width: 240px;
      height: 240px;
      pointer-events: auto;
      touch-action: none;
    `;

    // Layout: 3x3 grid
    // Row 1: Jump, R1, R2
    // Row 2: L1, L2, Roll
    // Row 3: Grab, Dance, Ultimate
    const buttonConfigs = [
      { id: "jump", label: "JUMP", row: 0, col: 0 },
      { id: "r1", label: "R1", row: 0, col: 1 },
      { id: "r2", label: "R2", row: 0, col: 2 },
      { id: "l1", label: "L1", row: 1, col: 0 },
      { id: "l2", label: "L2", row: 1, col: 1 },
      { id: "roll", label: "ROLL", row: 1, col: 2 },
      { id: "grab", label: "GRAB", row: 2, col: 0 },
      { id: "dance", label: "DANCE", row: 2, col: 1 },
      { id: "ultimate", label: "ULT", row: 2, col: 2 },
    ];

    buttonConfigs.forEach((config) => {
      const btn = document.createElement("div");
      btn.className = `mobile-btn mobile-btn-${config.id}`;
      btn.dataset.buttonId = config.id;
      btn.textContent = config.label;
      btn.style.cssText = `
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.25);
        border: 3px solid rgba(255, 255, 255, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: bold;
        color: rgba(255, 255, 255, 0.95);
        touch-action: none;
        user-select: none;
        transition: all 0.1s ease;
        text-align: center;
        line-height: 1.1;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.2);
        text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
      `;
      buttonContainer.appendChild(btn);
    });

    container.appendChild(buttonContainer);
    document.body.appendChild(container);

    // Initialize joystick position
    const rect = joystickArea.getBoundingClientRect();
    joystickBaseX = rect.left + rect.width / 2;
    joystickBaseY = rect.top + rect.height / 2;
    joystickKnobX = joystickBaseX;
    joystickKnobY = joystickBaseY;

    setupEventListeners();
  }

  function setupEventListeners() {
    if (!container) return;

    // Joystick events
    const joystickArea = container.querySelector("div");
    joystickArea.addEventListener("pointerdown", handleJoystickStart, {
      passive: false,
    });
    joystickArea.addEventListener("pointermove", handleJoystickMove, {
      passive: false,
    });
    joystickArea.addEventListener("pointerup", handleJoystickEnd, {
      passive: false,
    });
    joystickArea.addEventListener("pointercancel", handleJoystickEnd, {
      passive: false,
    });

    // Button events
    const buttonElements = buttonContainer.querySelectorAll(".mobile-btn");
    buttonElements.forEach((btn) => {
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleButtonDown(btn.dataset.buttonId);
      });
      btn.addEventListener("pointerup", (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleButtonUp(btn.dataset.buttonId);
      });
      btn.addEventListener("pointercancel", (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleButtonUp(btn.dataset.buttonId);
      });
      btn.addEventListener("pointerleave", (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleButtonUp(btn.dataset.buttonId);
      });
    });
  }

  function handleJoystickStart(e) {
    if (activePointerId !== null) return;
    e.preventDefault();
    e.stopPropagation();
    activePointerId = e.pointerId;
    joystickActive = true;
    const rect = joystickBase.parentElement.getBoundingClientRect();
    joystickBaseX = rect.left + rect.width / 2;
    joystickBaseY = rect.top + rect.height / 2;
    // Update joystick position immediately on start
    updateJoystick(e.clientX, e.clientY);
  }

  function handleJoystickMove(e) {
    if (e.pointerId !== activePointerId || !joystickActive) return;
    e.preventDefault();
    e.stopPropagation();
    // Update base position in case of resize during interaction
    const rect = joystickBase.parentElement.getBoundingClientRect();
    joystickBaseX = rect.left + rect.width / 2;
    joystickBaseY = rect.top + rect.height / 2;
    updateJoystick(e.clientX, e.clientY);
  }

  function handleJoystickEnd(e) {
    if (e.pointerId !== activePointerId) return;
    e.preventDefault();
    e.stopPropagation();
    joystickActive = false;
    activePointerId = null;
    joystickX = 0;
    joystickY = 0;
    // Update base position before resetting knob
    const rect = joystickBase.parentElement.getBoundingClientRect();
    joystickBaseX = rect.left + rect.width / 2;
    joystickBaseY = rect.top + rect.height / 2;
    joystickKnobX = joystickBaseX;
    joystickKnobY = joystickBaseY;
    updateJoystickVisual();
  }

  function updateJoystick(clientX, clientY) {
    const dx = clientX - joystickBaseX;
    const dy = clientY - joystickBaseY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDistance = joystickRadius - joystickKnobRadius;

    if (distance > maxDistance) {
      const angle = Math.atan2(dy, dx);
      joystickX = Math.cos(angle) * maxDistance;
      joystickY = Math.sin(angle) * maxDistance;
    } else {
      joystickX = dx;
      joystickY = dy;
    }

    // Normalize to -1..1 range
    joystickX = joystickX / maxDistance;
    joystickY = joystickY / maxDistance;

    // Apply deadzone
    const deadzone = 0.1;
    if (Math.abs(joystickX) < deadzone) joystickX = 0;
    if (Math.abs(joystickY) < deadzone) joystickY = 0;

    joystickKnobX = joystickBaseX + joystickX * maxDistance;
    joystickKnobY = joystickBaseY + joystickY * maxDistance;

    updateJoystickVisual();
  }

  function updateJoystickVisual() {
    if (!joystickKnob) return;
    const offsetX = joystickKnobX - joystickBaseX;
    const offsetY = joystickKnobY - joystickBaseY;
    joystickKnob.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
  }

  function handleButtonDown(buttonId) {
    if (!buttons[buttonId]) return;
    buttons[buttonId].pressed = true;
    buttons[buttonId].down = !prevButtonState[buttonId];
    prevButtonState[buttonId] = true;

    const btn = buttonContainer.querySelector(`.mobile-btn-${buttonId}`);
    if (btn) {
      btn.style.background = "rgba(255, 255, 255, 0.5)";
      btn.style.borderColor = "rgba(255, 255, 255, 0.9)";
      btn.style.transform = "scale(0.92)";
      btn.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.3)";
    }
  }

  function handleButtonUp(buttonId) {
    if (!buttons[buttonId]) return;
    buttons[buttonId].pressed = false;
    buttons[buttonId].up = prevButtonState[buttonId];
    prevButtonState[buttonId] = false;

    const btn = buttonContainer.querySelector(`.mobile-btn-${buttonId}`);
    if (btn) {
      btn.style.background = "rgba(255, 255, 255, 0.25)";
      btn.style.borderColor = "rgba(255, 255, 255, 0.5)";
      btn.style.transform = "scale(1)";
      btn.style.boxShadow = "0 2px 6px rgba(0, 0, 0, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.2)";
    }
  }

  function updateButtonEdges() {
    Object.keys(buttons).forEach((key) => {
      buttons[key].down = false;
      buttons[key].up = false;
    });
  }

  function shouldShow() {
    if (typeof window === "undefined") return false;
    // Show on mobile devices (coarse pointer) or when width < 900px
    const isCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
    const isNarrow = window.innerWidth < 900;
    return isCoarsePointer || isNarrow;
  }

  function shouldShowInGameMode(gameMode) {
    // Only show controls when actually playing (not in menus)
    return gameMode === "PLAYING";
  }

  function updateVisibility(gameMode = null) {
    // Check if device should show mobile controls at all
    const deviceShouldShow = shouldShow();
    if (!deviceShouldShow) {
      // Hide if not mobile device
      if (container) {
        container.style.display = "none";
      }
      isVisible = false;
      return;
    }

    // Check if we should show based on game mode
    const shouldShowControls = gameMode ? shouldShowInGameMode(gameMode) : false;

    // Only update if visibility actually changed
    if (shouldShowControls === isVisible && container) {
      return;
    }

    isVisible = shouldShowControls;

    if (!container) {
      if (shouldShowControls) {
        createControls();
      }
      return;
    }

    container.style.display = shouldShowControls ? "block" : "none";

    // Recalculate joystick base position when visibility changes
    if (shouldShowControls && joystickBase) {
      const rect = joystickBase.parentElement.getBoundingClientRect();
      joystickBaseX = rect.left + rect.width / 2;
      joystickBaseY = rect.top + rect.height / 2;
      joystickKnobX = joystickBaseX;
      joystickKnobY = joystickBaseY;
      updateJoystickVisual();
    }
  }

  // Public API
  return {
    init() {
      updateVisibility();
      const handleResize = () => {
        updateVisibility();
        // Recalculate joystick position on resize
        if (joystickBase && joystickActive) {
          const rect = joystickBase.parentElement.getBoundingClientRect();
          joystickBaseX = rect.left + rect.width / 2;
          joystickBaseY = rect.top + rect.height / 2;
        }
      };
      window.addEventListener("resize", handleResize);
      window.addEventListener("orientationchange", () => {
        // Delay to allow browser to update layout
        setTimeout(handleResize, 100);
      });
      if (window.matchMedia) {
        window
          .matchMedia("(pointer: coarse)")
          .addEventListener("change", updateVisibility);
      }
    },

    getAxisX() {
      return joystickX;
    },

    getAxisY() {
      return joystickY;
    },

    isButtonDown(buttonId) {
      return buttons[buttonId]?.down || false;
    },

    isButtonHeld(buttonId) {
      return buttons[buttonId]?.pressed || false;
    },

    isButtonUp(buttonId) {
      return buttons[buttonId]?.up || false;
    },

    clearEdges() {
      updateButtonEdges();
    },

    updateVisibility(gameMode) {
      updateVisibility(gameMode);
    },

    setGameMode(gameMode) {
      // Called when game mode changes to update visibility
      updateVisibility(gameMode);
    },
  };
})();
