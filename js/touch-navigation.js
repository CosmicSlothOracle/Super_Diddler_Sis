// Touch Navigation for Mobile Devices
// Handles touch interactions with canvas-based UI elements
window.TouchNavigation = (() => {
  let canvas = null;
  let state = null;
  let lastTouchTime = 0;
  const TOUCH_DEBOUNCE_MS = 200; // Prevent double-taps
  let activePointerId = null;

  function init(canvasElement, gameState) {
    canvas = canvasElement;
    state = gameState;
    if (!canvas) return;

    // Use pointer events for better compatibility
    canvas.addEventListener("pointerdown", handleTouch, { passive: false });
    canvas.addEventListener("pointerup", handleTouchEnd, { passive: false });
    canvas.addEventListener("pointercancel", handleTouchEnd, { passive: false });
  }

  function getCanvasCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    // Account for device pixel ratio for accurate coordinate mapping
    const dpr = window.devicePixelRatio || 1;
    const scaleX = (canvas.width / dpr) / rect.width;
    const scaleY = (canvas.height / dpr) / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function handleTouch(e) {
    if (!state || !canvas) return;

    // Only handle touch events (not mouse) when in mobile mode
    if (activePointerId !== null && e.pointerId !== activePointerId) {
      return; // Ignore secondary touches while a menu pointer is active
    }
    const isMobile =
      state.performanceMode || window.matchMedia("(pointer: coarse)").matches;
    if (!isMobile && e.pointerType === "mouse") {
      return; // Skip mouse events on desktop
    }

    if (activePointerId === null) {
      activePointerId = e.pointerId;
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    }

    // Allow touch and pen events
    if (e.pointerType !== "touch" && e.pointerType !== "pen" && !isMobile) {
      return;
    }

    const now = Date.now();
    // Reduced debounce time for better responsiveness on mobile
    const debounceTime = isMobile ? 50 : TOUCH_DEBOUNCE_MS;
    if (now - lastTouchTime < debounceTime) {
      return; // Debounce
    }
    lastTouchTime = now;

    const coords = getCanvasCoordinates(e);
    e.preventDefault();

    // Check if touch is on mobile controls (should be ignored)
    const mobileControls = document.getElementById("mobile-controls");
    if (mobileControls && mobileControls.style.display !== "none") {
      const controlsRect = mobileControls.getBoundingClientRect();
      // Check joystick area (left side)
      const joystickArea = mobileControls.querySelector("div");
      if (joystickArea) {
        const joystickRect = joystickArea.getBoundingClientRect();
        if (
          e.clientX >= joystickRect.left &&
          e.clientX <= joystickRect.right &&
          e.clientY >= joystickRect.top &&
          e.clientY <= joystickRect.bottom
        ) {
          return; // Touch is on joystick, ignore
        }
      }
      // Check button area (right side)
      const buttonArea = mobileControls.querySelector("div:last-child");
      if (buttonArea) {
        const buttonRect = buttonArea.getBoundingClientRect();
        if (
          e.clientX >= buttonRect.left &&
          e.clientX <= buttonRect.right &&
          e.clientY >= buttonRect.top &&
          e.clientY <= buttonRect.bottom
        ) {
          return; // Touch is on buttons, ignore
        }
      }
    }

    // Handle different game modes
    if (state.modal?.isOpen) {
      handleModalTouch(coords);
    } else if (state.gameMode === "TITLE_INTRO") {
      handleTitleIntroTouch(coords);
    } else if (state.gameMode === "GAME_TYPE_SELECT") {
      handleGameTypeSelectTouch(coords);
    } else if (state.gameMode === "GAME_MODE_SELECT") {
      handleGameModeSelectTouch(coords);
    } else if (state.gameMode === "CHARACTER_SELECT") {
      handleCharacterSelectTouch(coords);
    } else if (state.gameMode === "STAGE_SELECT") {
      handleStageSelectTouch(coords);
    } else if (state.gameMode === "TITLE_SCREEN") {
      handleTitleScreenTouch(coords);
    }
  }

  function handleTouchEnd(e) {
    if (e.pointerId === activePointerId) {
      canvas.releasePointerCapture && canvas.releasePointerCapture(e.pointerId);
      activePointerId = null;
    }
    // Can be used for drag gestures if needed
  }

  function handleModalTouch(coords) {
    if (!state.modal?.isOpen || !state.modal.buttons) return;

    const ctx = canvas.getContext("2d");
    const centerX = ctx.canvas.width / 2;
    const centerY = ctx.canvas.height / 2;
    const modalWidth = 600;
    const buttonCount = state.modal.buttons.length;
    const baseButtonHeight = 56;
    const baseButtonSpacing = 14;
    const headerPadding = 110;
    const footerPadding = 100;
    const maxModalHeight = Math.min(ctx.canvas.height * 0.85, 640);

    let buttonHeight = baseButtonHeight;
    let buttonSpacing = baseButtonSpacing;
    let buttonAreaHeight =
      buttonCount > 0
        ? buttonCount * buttonHeight + (buttonCount - 1) * buttonSpacing
        : 0;
    const chromeHeight = headerPadding + footerPadding;
    const minModalHeight = chromeHeight + 160;
    let desiredModalHeight = buttonAreaHeight + chromeHeight;
    let modalHeight = Math.min(
      Math.max(desiredModalHeight, minModalHeight),
      maxModalHeight
    );
    const availableButtonSpace = modalHeight - chromeHeight;

    if (buttonAreaHeight > availableButtonSpace && buttonAreaHeight > 0) {
      const compressFactor = availableButtonSpace / buttonAreaHeight;
      buttonHeight *= compressFactor;
      buttonSpacing *= compressFactor;
      buttonAreaHeight = availableButtonSpace;
    }

    const modalX = centerX - modalWidth / 2;
    const modalY = centerY - modalHeight / 2;
    const buttonAreaTop =
      modalY + headerPadding + (availableButtonSpace - buttonAreaHeight) / 2;
    const btnX = modalX + 50;
    const btnWidth = modalWidth - 100;

    // Check which button was touched
    for (let i = 0; i < state.modal.buttons.length; i++) {
      const buttonY = buttonAreaTop + i * (buttonHeight + buttonSpacing);

      if (
        coords.x >= btnX &&
        coords.x <= btnX + btnWidth &&
        coords.y >= buttonY &&
        coords.y <= buttonY + buttonHeight
      ) {
        const button = state.modal.buttons[i];
        if (button.disabled || button.isDisabled) {
          return; // Don't activate disabled buttons
        }

        // Select and activate the button
        state.modal.selectedButton = i;
        if (
          window.handleModalAction &&
          typeof window.handleModalAction === "function"
        ) {
          window.handleModalAction(state, button.action);
        }
        break;
      }
    }
  }

  function handleCharacterSelectTouch(coords) {
    // Character selection uses a grid layout
    // Check which character was touched and which player (P1/P2)
    if (!state.selection?.characters) return;

    const characterKeys = Object.keys(state.selection.characters);
    const cols = 3; // Characters displayed in 3 columns
    const rows = Math.ceil(characterKeys.length / cols);

    // Character selection screen layout:
    // Top half: P1 characters (3 columns)
    // Bottom half: P2 characters (3 columns)
    const charWidth = canvas.width / cols;
    const charHeight = canvas.height / 2 / rows; // Half screen height divided by rows

    const col = Math.floor(coords.x / charWidth);
    const isP1Area = coords.y < canvas.height / 2;
    const relativeY = isP1Area ? coords.y : coords.y - canvas.height / 2;
    const row = Math.floor(relativeY / charHeight);

    if (col >= 0 && col < cols && row >= 0 && row < rows) {
      const charIndex = row * cols + col;
      if (charIndex < characterKeys.length) {
        const charName = characterKeys[charIndex];
        const charData = state.selection.characters[charName];

        // Skip disabled characters
        if (charData?.disabled) return;

        if (isP1Area && !state.selection.p1Locked) {
          state.selection.p1CharIndex = charIndex;
          state.selectedCharacters[0] = charName;
          // Lock P1 on touch
          state.selection.p1Locked = true;
        } else if (!isP1Area && !state.selection.p2Locked) {
          state.selection.p2CharIndex = charIndex;
          state.selectedCharacters[1] = charName;
          // Lock P2 on touch
          state.selection.p2Locked = true;
        }

        // If both players are locked, proceed automatically
        if (state.selection.p1Locked && state.selection.p2Locked) {
          // Simulate confirm to proceed to stage select
          setTimeout(() => {
            state.input.keysPressed.add("Enter");
          }, 100);
        }
      }
    }
  }

  function handleStageSelectTouch(coords) {
    // Stage selection uses a grid layout
    if (!state.selection?.stages) return;

    const stageKeys = Object.keys(state.selection.stages);
    const cols = 5; // Stages displayed in 5 columns
    const rows = Math.ceil(stageKeys.length / cols);
    const stageWidth = canvas.width / cols;
    const stageHeight = canvas.height / rows;

    const col = Math.floor(coords.x / stageWidth);
    const row = Math.floor(coords.y / stageHeight);
    const stageIndex = row * cols + col;

    if (stageIndex >= 0 && stageIndex < stageKeys.length) {
      const stageName = stageKeys[stageIndex];
      const stageData = state.selection.stages[stageName];

      // Skip disabled stages
      if (stageData?.disabled) return;

      state.selection.stageIndex = stageIndex;

      // Simulate confirm action after a short delay
      setTimeout(() => {
        state.input.keysPressed.add("Enter");
      }, 100);
    }
  }

  function handleTitleScreenTouch(coords) {
    // Title screen - touch anywhere to start
    if (state.gameMode === "TITLE_SCREEN") {
      state.input.keysPressed.add("Enter");
    }
  }

  function handleTitleIntroTouch(coords) {
    // Title intro - touch anywhere to skip (if skip is enabled)
    if (state.gameMode === "TITLE_INTRO" && state.titleIntro?.canSkip) {
      // Simulate any key press to trigger skip
      state.input.keysPressed.add("Enter");
    }
  }

  function handleGameTypeSelectTouch(coords) {
    // Game type selection: PVP (left) or TUTORIAL (right)
    if (!state.gameTypeSelection) {
      state.gameTypeSelection = { selectedType: "pvp" };
    }

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const typeSpacing = 400;
    const buttonSize = 300;
    const buttonHalf = buttonSize / 2;

    // PVP button (left)
    const pvpX = centerX - typeSpacing / 2;
    const pvpLeft = pvpX - buttonHalf;
    const pvpRight = pvpX + buttonHalf;
    const pvpTop = centerY - buttonHalf;
    const pvpBottom = centerY + buttonHalf;

    // TUTORIAL button (right)
    const tutorialX = centerX + typeSpacing / 2;
    const tutorialLeft = tutorialX - buttonHalf;
    const tutorialRight = tutorialX + buttonHalf;
    const tutorialTop = centerY - buttonHalf;
    const tutorialBottom = centerY + buttonHalf;

    // Check which button was touched
    if (
      coords.x >= pvpLeft &&
      coords.x <= pvpRight &&
      coords.y >= pvpTop &&
      coords.y <= pvpBottom
    ) {
      // PVP selected
      state.gameTypeSelection.selectedType = "pvp";
      // Auto-confirm after short delay
      setTimeout(() => {
        state.input.keysPressed.add("Enter");
      }, 200);
    } else if (
      coords.x >= tutorialLeft &&
      coords.x <= tutorialRight &&
      coords.y >= tutorialTop &&
      coords.y <= tutorialBottom
    ) {
      // TUTORIAL selected
      state.gameTypeSelection.selectedType = "story";
      // Auto-confirm after short delay
      setTimeout(() => {
        state.input.keysPressed.add("Enter");
      }, 200);
    }
  }

  function handleGameModeSelectTouch(coords) {
    // Game mode selection: Classic (left) or Dance (right)
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const modeSpacing = 400;
    const buttonSize = 300;
    const buttonHalf = buttonSize / 2;

    // Classic button (left)
    const classicX = centerX - modeSpacing / 2;
    const classicLeft = classicX - buttonHalf;
    const classicRight = classicX + buttonHalf;
    const classicTop = centerY - buttonHalf;
    const classicBottom = centerY + buttonHalf;

    // Dance button (right)
    const danceX = centerX + modeSpacing / 2;
    const danceLeft = danceX - buttonHalf;
    const danceRight = danceX + buttonHalf;
    const danceTop = centerY - buttonHalf;
    const danceBottom = centerY + buttonHalf;

    // Check which button was touched
    if (
      coords.x >= classicLeft &&
      coords.x <= classicRight &&
      coords.y >= classicTop &&
      coords.y <= classicBottom
    ) {
      // Classic selected
      state.selectedGameMode = "classic";
      // Auto-confirm after short delay
      setTimeout(() => {
        state.input.keysPressed.add("Enter");
      }, 200);
    } else if (
      coords.x >= danceLeft &&
      coords.x <= danceRight &&
      coords.y >= danceTop &&
      coords.y <= danceBottom
    ) {
      // Dance selected
      state.selectedGameMode = "dance";
      // Auto-confirm after short delay
      setTimeout(() => {
        state.input.keysPressed.add("Enter");
      }, 200);
    }
  }

  return {
    init,
  };
})();
