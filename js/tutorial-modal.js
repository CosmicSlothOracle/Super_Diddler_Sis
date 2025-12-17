/**
 * Unified Tutorial Modal System
 * Single modal component with Star Wars-style glowing text effects
 */

window.TutorialModalController = (() => {
  // Animation constants
  const TEXT_IN_DURATION = 0.5; // 500ms
  const TEXT_OUT_DURATION = 0.5; // 500ms
  const DEFAULT_AUTO_DISMISS_MS = 5000; // 5 seconds
  const CHARS_PER_SECOND = 60;

  /**
   * Show a tutorial message
   * @param {Object} state - Game state
   * @param {string} messageId - Message ID from TutorialMessages
   */
  function show(state, messageId) {
    if (!state?.tutorial) {
      console.warn("[TutorialModal] No tutorial state found");
      return;
    }

    let message = window.TutorialMessages?.getMessage?.(messageId);
    if (!message) {
      console.warn(`[TutorialModal] Message not found: ${messageId}`);
      return;
    }

    // Handle character-specific controls message
    if (messageId === "part2-beat-charge-controls") {
      const controlsBody =
        window.TutorialMessages?.getBeatChargeControlsBody?.(state);
      if (controlsBody) {
        message = { ...message, body: controlsBody };
      }
    }

    // Ensure modal state exists
    if (!state.tutorial.modal) {
      state.tutorial.modal = {
        visible: false,
        messageId: null,
        currentMessage: null,
        animationState: "hidden",
        animationProgress: 0,
        charIndex: 0,
        charsPerSecond: CHARS_PER_SECOND,
        autoDismissTimer: 0,
        completed: false,
        textLines: [],
        currentLine: 0,
        holdTimer: 0,
        holdDuration: 1.1,
      };
    }

    const modal = state.tutorial.modal;
    modal.messageId = messageId;
    modal.currentMessage = message;
    modal.visible = true;
    modal.animationState = "appearing";
    modal.animationProgress = 0;
    modal.charIndex = 0;
    modal.currentLine = 0;
    modal.holdTimer = 0;
    modal.completed = false;

    // Parse message body into lines (split by \n\n for paragraphs)
    // Text wrapping will be done during rendering using actual canvas context
    const paragraphs = message.body.split(/\n\n+/).filter((p) => p.trim());
    modal.textLines = [];
    paragraphs.forEach((para) => {
      // Split each paragraph by \n (explicit line breaks)
      const lines = para.split(/\n/).filter((l) => l.trim() || l === "");
      lines.forEach((line) => {
        modal.textLines.push(line);
      });
      // Add blank line between paragraphs
      if (paragraphs.indexOf(para) < paragraphs.length - 1) {
        modal.textLines.push("");
      }
    });

    // Set auto-dismiss timer
    if (message.autoDismissMs !== null && message.autoDismissMs !== undefined) {
      modal.autoDismissTimer = message.autoDismissMs / 1000; // Convert to seconds
    } else {
      modal.autoDismissTimer = 0; // Manual dismiss
    }

    console.log(`[TutorialModal] Showing message: ${messageId}`);
  }

  /**
   * Update modal animation and state
   * @param {number} dt - Delta time in seconds
   * @param {Object} state - Game state
   */
  function update(dt, state) {
    const modal = state?.tutorial?.modal;
    if (!modal || !modal.visible) return;

    const message = modal.currentMessage;
    if (!message) return;

    // Handle animation states
    switch (modal.animationState) {
      case "appearing":
        modal.animationProgress += dt / TEXT_IN_DURATION;
        if (modal.animationProgress >= 1.0) {
          modal.animationProgress = 1.0;
          modal.animationState = "visible";
        }
        break;

      case "visible":
        // Update character-by-character reveal
        if (modal.currentLine < modal.textLines.length) {
          const currentLineText = modal.textLines[modal.currentLine] || "";
          if (modal.charIndex < currentLineText.length) {
            modal.charIndex = Math.min(
              currentLineText.length,
              modal.charIndex + dt * modal.charsPerSecond
            );
          } else {
            // Line complete, wait before next line
            modal.holdTimer += dt;
            if (modal.holdTimer >= modal.holdDuration) {
              modal.currentLine++;
              modal.charIndex = 0;
              modal.holdTimer = 0;
            }
          }
        } else {
          // All text revealed
          modal.completed = true;

          // Handle auto-dismiss
          if (modal.autoDismissTimer > 0) {
            modal.autoDismissTimer -= dt;
            if (modal.autoDismissTimer <= 0) {
              // Start dismissing
              modal.animationState = "dismissing";
              modal.animationProgress = 0;
            }
          }
        }
        break;

      case "dismissing":
        modal.animationProgress += dt / TEXT_OUT_DURATION;
        if (modal.animationProgress >= 1.0) {
          // Dismissal complete
          hide(state);
        }
        break;

      case "hidden":
        // Do nothing
        break;
    }
  }

  /**
   * Hide the modal
   * @param {Object} state - Game state
   */
  function hide(state) {
    const modal = state?.tutorial?.modal;
    if (!modal) return;

    modal.visible = false;
    modal.animationState = "hidden";
    modal.animationProgress = 0;
    modal.messageId = null;
    modal.currentMessage = null;
    modal.completed = false;
    modal.textLines = [];
    modal.currentLine = 0;
    modal.charIndex = 0;

    console.log("[TutorialModal] Modal hidden");
  }

  /**
   * Confirm/dismiss the modal (manual dismiss)
   * Can be called at any time to skip the modal
   * @param {Object} state - Game state
   * @returns {boolean} True if modal was dismissed
   */
  function confirm(state) {
    const modal = state?.tutorial?.modal;
    if (!modal || !modal.visible) return false;

    // If text is still being revealed, complete it instantly
    if (!modal.completed) {
      // Complete all text immediately
      modal.completed = true;
      modal.currentLine = modal.textLines.length;
      if (modal.textLines.length > 0) {
        const lastLine = modal.textLines[modal.textLines.length - 1];
        modal.charIndex = lastLine ? lastLine.length : 0;
      }
    }

    // If still appearing, skip to visible state
    if (modal.animationState === "appearing") {
      modal.animationState = "visible";
      modal.animationProgress = 1.0;
    }

    // If auto-dismiss is set, just hide immediately
    if (modal.autoDismissTimer > 0) {
      hide(state);
      return true;
    }

    // Otherwise, start dismissal animation or hide immediately if already visible
    if (modal.animationState === "visible") {
      modal.animationState = "dismissing";
      modal.animationProgress = 0;
      return true;
    }

    // If already dismissing, hide immediately
    if (modal.animationState === "dismissing") {
      hide(state);
      return true;
    }

    return false;
  }

  /**
   * Check if modal is visible and can be dismissed
   * Now returns true for any visible modal (can be skipped anytime)
   * @param {Object} state - Game state
   * @returns {boolean}
   */
  function isWaitingForConfirmation(state) {
    const modal = state?.tutorial?.modal;
    // Allow skipping at any time when modal is visible
    return modal?.visible === true;
  }

  /**
   * Check if game should be frozen (modal visible)
   * @param {Object} state - Game state
   * @returns {boolean}
   */
  function isGameFrozen(state) {
    const modal = state?.tutorial?.modal;
    return modal?.visible === true && modal.animationState !== "hidden";
  }

  return {
    show,
    update,
    hide,
    confirm,
    isWaitingForConfirmation,
    isGameFrozen,
  };
})();

/**
 * Render the unified tutorial modal with Star Wars glow effect
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} state - Game state
 */
window.renderTutorialModal = function (ctx, state) {
  const modal = state?.tutorial?.modal;
  if (!modal || !modal.visible) return;

  const message = modal.currentMessage;
  if (!message) return;

  const canvasWidth = ctx.canvas.width;
  const canvasHeight = ctx.canvas.height;
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;

  // Modal dimensions
  const panelWidth = 900;
  const panelX = centerX - panelWidth / 2;
  const panelY = 60;
  const horizontalPadding = 48;
  const verticalPadding = 40;
  const lineHeight = 28; // Reduced line height
  const paragraphSpacing = 12;
  const cornerRadius = 20;
  const textAreaWidth = panelWidth - horizontalPadding * 2;

  // Calculate content height with proper text wrapping
  const baseFont = `500 20px ${FONT_MONO_FAMILY}`;
  ctx.font = baseFont;

  let contentHeight = verticalPadding * 2;
  const visibleLines = [];

  for (let i = 0; i <= modal.currentLine && i < modal.textLines.length; i++) {
    const rawLine = modal.textLines[i];
    if (rawLine === "" || !rawLine.trim()) {
      contentHeight += paragraphSpacing;
      visibleLines.push({ text: "", isBlank: true, wrappedLines: [] });
      continue;
    }

    // Get text to show (with character reveal)
    const charsToShow =
      i === modal.currentLine ? Math.floor(modal.charIndex) : rawLine.length;
    const textToWrap = rawLine.substring(0, charsToShow);

    // Wrap text to fit modal width
    const words = textToWrap.trim().split(/\s+/);
    const wrappedLines = [];
    let currentLine = "";

    words.forEach((word) => {
      if (!word) return;
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width <= textAreaWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          wrappedLines.push(currentLine);
          contentHeight += lineHeight;
        }
        currentLine = word;
      }
    });

    if (currentLine) {
      wrappedLines.push(currentLine);
      contentHeight += lineHeight;
    }

    visibleLines.push({
      text: rawLine,
      isBlank: false,
      wrappedLines: wrappedLines,
    });
  }

  const panelHeight = Math.max(240, contentHeight + 80); // Extra space for title and footer

  // Calculate animation values (simplified - no glow)
  let opacity = 1.0;
  let yOffset = 0;

  if (modal.animationState === "appearing") {
    const progress = modal.animationProgress;
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    opacity = eased;
    yOffset = (1 - eased) * 10; // Slight downward motion
  } else if (modal.animationState === "dismissing") {
    const progress = modal.animationProgress;
    // Ease in cubic
    const eased = Math.pow(progress, 3);
    opacity = 1 - eased;
    yOffset = -eased * 10; // Slight upward motion
  }

  ctx.save();

  // Dark backdrop overlay
  ctx.fillStyle = `rgba(0, 0, 0, ${0.75 * opacity})`;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Modal background with white clean look and reflection
  const drawY = panelY + yOffset;

  // Main white panel
  ctx.shadowBlur = 0;
  drawRoundedRect(ctx, panelX, drawY, panelWidth, panelHeight, cornerRadius);

  // White background with subtle gradient for depth
  const bgGradient = ctx.createLinearGradient(
    panelX,
    drawY,
    panelX,
    drawY + panelHeight
  );
  bgGradient.addColorStop(0, `rgba(255, 255, 255, ${0.98 * opacity})`);
  bgGradient.addColorStop(0.5, `rgba(255, 255, 255, ${0.99 * opacity})`);
  bgGradient.addColorStop(1, `rgba(250, 250, 250, ${0.97 * opacity})`);
  ctx.fillStyle = bgGradient;
  ctx.fill();

  // Smooth reflection effect - glossy top highlight
  const reflectionHeight = panelHeight * 0.35;
  const reflectionGradient = ctx.createLinearGradient(
    panelX,
    drawY,
    panelX,
    drawY + reflectionHeight
  );
  // Smooth fade from bright white to transparent
  reflectionGradient.addColorStop(0, `rgba(255, 255, 255, ${0.9 * opacity})`);
  reflectionGradient.addColorStop(
    0.15,
    `rgba(255, 255, 255, ${0.7 * opacity})`
  );
  reflectionGradient.addColorStop(0.4, `rgba(255, 255, 255, ${0.3 * opacity})`);
  reflectionGradient.addColorStop(0.7, `rgba(255, 255, 255, ${0.1 * opacity})`);
  reflectionGradient.addColorStop(1, `rgba(255, 255, 255, ${0 * opacity})`);

  ctx.save();
  // Clip to top rounded corners only
  const reflectionPath = new Path2D();
  reflectionPath.moveTo(panelX + cornerRadius, drawY);
  reflectionPath.lineTo(panelX + panelWidth - cornerRadius, drawY);
  reflectionPath.quadraticCurveTo(
    panelX + panelWidth,
    drawY,
    panelX + panelWidth,
    drawY + cornerRadius
  );
  reflectionPath.lineTo(panelX + panelWidth, drawY + reflectionHeight);
  reflectionPath.lineTo(panelX, drawY + reflectionHeight);
  reflectionPath.lineTo(panelX, drawY + cornerRadius);
  reflectionPath.quadraticCurveTo(panelX, drawY, panelX + cornerRadius, drawY);
  reflectionPath.closePath();
  ctx.clip(reflectionPath);
  ctx.fillStyle = reflectionGradient;
  ctx.fillRect(panelX, drawY, panelWidth, reflectionHeight);
  ctx.restore();

  // Additional subtle horizontal reflection line at top
  ctx.save();
  ctx.globalAlpha = 0.3 * opacity;
  ctx.strokeStyle = `rgba(255, 255, 255, 0.6)`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(panelX + cornerRadius, drawY + 1);
  ctx.lineTo(panelX + panelWidth - cornerRadius, drawY + 1);
  ctx.stroke();
  ctx.restore();

  // Black border - clean inline
  ctx.strokeStyle = `rgba(0, 0, 0, ${1.0 * opacity})`;
  ctx.lineWidth = 2;
  drawRoundedRect(ctx, panelX, drawY, panelWidth, panelHeight, cornerRadius);
  ctx.stroke();

  // Subtle inner shadow for depth
  ctx.strokeStyle = `rgba(0, 0, 0, ${0.08 * opacity})`;
  ctx.lineWidth = 1;
  drawRoundedRect(
    ctx,
    panelX + 2,
    drawY + 2,
    panelWidth - 4,
    panelHeight - 4,
    cornerRadius - 1
  );
  ctx.stroke();

  // Title - black text
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.font = `700 28px ${FONT_MONO_FAMILY}`;
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(0, 0, 0, 1.0)";
  ctx.fillText(message.title, centerX, drawY + 30);
  ctx.restore();

  // Draw text with Star Wars glow effect
  const textStartX = panelX + horizontalPadding;
  let cursorY = drawY + verticalPadding + 50; // Space for title

  ctx.save();
  ctx.globalAlpha = opacity;

  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  visibleLines.forEach((lineData) => {
    if (lineData.isBlank) {
      cursorY += paragraphSpacing;
      return;
    }

    // Draw wrapped lines
    if (lineData.wrappedLines && lineData.wrappedLines.length > 0) {
      lineData.wrappedLines.forEach((wrappedLine) => {
        if (wrappedLine) {
          // Draw text - black inline
          ctx.save();
          ctx.shadowBlur = 0; // No shadow/glow
          ctx.fillStyle = "rgba(0, 0, 0, 1.0)";
          drawFormattedTextSimple(
            ctx,
            wrappedLine,
            textStartX,
            cursorY,
            baseFont
          );
          ctx.restore();
        }
        cursorY += lineHeight;
      });
    } else {
      cursorY += lineHeight;
    }
  });

  ctx.restore();

  // Confirmation hint - show anytime modal is visible (can skip anytime) - black text
  if (modal.visible) {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.font = `500 18px ${FONT_MONO_FAMILY}`;
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.textAlign = "left";
    const hintText = modal.completed
      ? "Press X to continue"
      : "Press X to skip";
    ctx.fillText(hintText, textStartX, drawY + panelHeight - 32);
    ctx.restore();
  }

  ctx.restore();
};

/**
 * Draw formatted text (supports **bold** and *italic*) - no glow
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {string} text - Text to draw
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {string} baseFont - Base font string
 */
function drawFormattedTextSimple(ctx, text, x, y, baseFont) {
  // Parse markdown formatting
  const segments = parseFormattedText(text);
  let currentX = x;

  segments.forEach((segment) => {
    // Set font style and color
    if (segment.style === "bold") {
      ctx.font = baseFont.replace(/(\d+)/, (match) =>
        String(Math.max(600, parseInt(match)))
      );
      ctx.fillStyle = "rgba(20, 15, 10, 0.95)";
    } else if (segment.style === "italic") {
      ctx.font = baseFont.replace(/(\d+px)/, "$1 italic");
      ctx.fillStyle = "rgba(0, 0, 0, 1.0)"; // Black for normal text
    } else if (segment.style === "keyboard") {
      ctx.font = baseFont.replace(/(\d+)/, (match) =>
        String(Math.max(600, parseInt(match)))
      );
      ctx.fillStyle = "#20B2AA"; // Teal
    } else if (segment.style === "controller") {
      ctx.font = baseFont.replace(/(\d+)/, (match) =>
        String(Math.max(600, parseInt(match)))
      );
      ctx.fillStyle = "#4169E1"; // Blue
    } else if (segment.style === "action") {
      ctx.font = baseFont.replace(/(\d+)/, (match) =>
        String(Math.max(600, parseInt(match)))
      );
      ctx.fillStyle = "#FF8C00"; // Orange
    } else {
      ctx.font = baseFont;
      ctx.fillStyle = "rgba(0, 0, 0, 1.0)"; // Black for normal text
    }

    ctx.fillText(segment.text, currentX, y);
    currentX += ctx.measureText(segment.text).width;
  });
}

/**
 * Parse markdown-style formatting: **bold**, *italic*, and color tags
 * Color tags: [[keyboard:W]], [[controller:R3]], [[action:Dance]]
 * @param {string} text - Text to parse
 * @returns {Array} Array of segments with style info
 */
function parseFormattedText(text) {
  const segments = [];
  let remaining = text;

  while (remaining.length > 0) {
    // Find earliest formatting marker
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
    const italicMatch = remaining.match(/\*([^*]+)\*/);
    const keyboardMatch = remaining.match(/\[\[keyboard:([^\]]+)\]\]/);
    const controllerMatch = remaining.match(/\[\[controller:([^\]]+)\]\]/);
    const actionMatch = remaining.match(/\[\[action:([^\]]+)\]\]/);

    let match = null;
    let type = null;
    let matchIndex = remaining.length;

    if (boldMatch && boldMatch.index < matchIndex) {
      match = boldMatch;
      type = "bold";
      matchIndex = boldMatch.index;
    }
    if (italicMatch && italicMatch.index < matchIndex) {
      match = italicMatch;
      type = "italic";
      matchIndex = italicMatch.index;
    }
    if (keyboardMatch && keyboardMatch.index < matchIndex) {
      match = keyboardMatch;
      type = "keyboard";
      matchIndex = keyboardMatch.index;
    }
    if (controllerMatch && controllerMatch.index < matchIndex) {
      match = controllerMatch;
      type = "controller";
      matchIndex = controllerMatch.index;
    }
    if (actionMatch && actionMatch.index < matchIndex) {
      match = actionMatch;
      type = "action";
      matchIndex = actionMatch.index;
    }

    if (match) {
      // Add text before match
      if (matchIndex > 0) {
        segments.push({
          text: remaining.substring(0, matchIndex),
          style: "normal",
        });
      }
      // Add formatted text
      segments.push({
        text: match[1],
        style: type,
      });
      // Continue after match
      remaining = remaining.substring(matchIndex + match[0].length);
    } else {
      // No more formatting, add rest
      if (remaining.length > 0) {
        segments.push({
          text: remaining,
          style: "normal",
        });
      }
      break;
    }
  }

  return segments.length > 0 ? segments : [{ text: text, style: "normal" }];
}

/**
 * Helper: Draw rounded rectangle
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} width - Width
 * @param {number} height - Height
 * @param {number} radius - Corner radius
 */
function drawRoundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Font constants (matching ui-components.js)
const FONT_MONO_FAMILY =
  "'IBM Plex Mono', 'Fira Mono', 'SFMono-Regular', monospace";
