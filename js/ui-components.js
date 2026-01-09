// UI-Komponenten für Character und Stage Selection (Ansatz 2: Komponenten-basiert)
// Einfach und funktional: Wiederverwendbare Bausteine für die UI.

window.UIComponents = (() => {
  const CANVAS_WIDTH = 2500;
  const CANVAS_HEIGHT = 1380;

  const FONT_PRIMARY_FAMILY =
    "Inter, 'Segoe UI', 'Helvetica Neue', system-ui, sans-serif";
  const FONT_MONO_FAMILY =
    "'IBM Plex Mono', 'Fira Mono', 'SFMono-Regular', monospace";

  const UI_ANIMATIONS = Object.freeze({
    pulseDuration: 2600,
    focusScale: 0.06,
    focusDuration: 180,
    fadeFast: 120,
    fadeSlow: 240,
  });

  const createTheme = ({
    name,
    palette,
    typography = {},
    shadows = {},
    strokes = {},
  }) => {
    const mergedPalette = {
      background: "#0B0B10",
      gradient: ["#060606", "#0F1120"],
      glass: "rgba(255,255,255,0.08)",
      accent: "#00D1FF",
      accentSoft: "rgba(0,209,255,0.35)",
      secondary: "#FF2E88",
      warning: "#FFBE0B",
      textPrimary: "#FFFFFF",
      textSecondary: "rgba(255,255,255,0.6)",
      disabled: "rgba(255,255,255,0.25)",
      strokeSubtle: "rgba(255,255,255,0.4)",
      p1: "#00D1FF",
      p2: "#FF2E88",
      double: "#00FFFF",
      roles: {
        confirm: "#B8E986",
        back: "#FF6B35",
        jump: "#50E3C2",
        special: "#4A90E2",
      },
      ...palette,
    };

    if (!mergedPalette.roles) {
      mergedPalette.roles = {
        confirm: mergedPalette.accent,
        back: mergedPalette.secondary,
        jump: mergedPalette.accent,
        special: mergedPalette.secondary,
      };
    }

    const mergedTypography = {
      fontPrimary: FONT_PRIMARY_FAMILY,
      fontMonospace: FONT_MONO_FAMILY,
      weightBold: 700,
      weightSemi: 600,
      ...typography,
    };

    const mergedShadows = {
      frameGlow: 15,
      buttonGlow: 18,
      panelGlow: 12,
      ...shadows,
    };

    const mergedStrokes = {
      active: 6,
      inactive: 3,
      ...strokes,
    };

    return {
      name,
      palette: mergedPalette,
      typography: mergedTypography,
      shadows: mergedShadows,
      strokes: mergedStrokes,
      // Legacy properties for existing rendering paths
      bg: mergedPalette.background,
      bgGlass: mergedPalette.glass,
      accent: mergedPalette.accent,
      secondary: mergedPalette.secondary,
      text: mergedPalette.textPrimary,
      textSubtle: mergedPalette.textSecondary,
      p1Frame: mergedPalette.p1,
      p2Frame: mergedPalette.p2,
      glow: mergedPalette.accentSoft,
    };
  };

  // UI Theme System
  const uiThemes = {
    neonCore: createTheme({
      name: "neonCore",
      palette: {
        background: "#0A0C10",
        gradient: ["#05060A", "#0D1624"],
        glass: "rgba(0,209,255,0.1)",
        accent: "#00D1FF",
        accentSoft: "rgba(0,209,255,0.4)",
        secondary: "#FF2E88",
        textPrimary: "#FFFFFF",
        textSecondary: "rgba(255,255,255,0.65)",
        roles: {
          confirm: "#7CFFB2",
          back: "#FF6B6B",
          jump: "#8DEBFF",
          special: "#00D1FF",
        },
      },
    }),
    festivalPop: createTheme({
      name: "festivalPop",
      palette: {
        background: "#FFD6A5",
        gradient: ["#FFD6A5", "#FFADAD"],
        glass: "rgba(255,0,110,0.12)",
        accent: "#FF006E",
        accentSoft: "rgba(255,0,110,0.35)",
        secondary: "#3A86FF",
        textPrimary: "#111111",
        textSecondary: "rgba(0,0,0,0.65)",
        p1: "#FF006E",
        p2: "#3A86FF",
        roles: {
          confirm: "#8338EC",
          back: "#FF006E",
          jump: "#FFBE0B",
          special: "#3A86FF",
        },
      },
    }),
    monoGlass: createTheme({
      name: "monoGlass",
      palette: {
        background: "#0B0B10",
        gradient: ["#060606", "#0F1120"],
        glass: "rgba(255,255,255,0.08)",
        accent: "#00D1FF",
        accentSoft: "rgba(0,209,255,0.35)",
        secondary: "#FF2E88",
        warning: "#FFBE0B",
        textPrimary: "#FFFFFF",
        textSecondary: "rgba(255,255,255,0.6)",
        disabled: "rgba(255,255,255,0.25)",
        p1: "#00FF00",
        p2: "#0066FF",
        double: "#00FFFF",
        roles: {
          confirm: "#B8E986",
          back: "#FF6B35",
          jump: "#50E3C2",
          special: "#4A90E2",
        },
      },
    }),
  };

  // Current theme (default to monoGlass)
  let currentTheme = uiThemes.monoGlass;

  // Get current theme
  function getTheme() {
    return currentTheme;
  }

  // Set theme
  function setTheme(themeName) {
    if (uiThemes[themeName]) {
      currentTheme = uiThemes[themeName];
    }
  }

  // Image cache for character splash art
  const imageCache = new Map();

  // Load splash image with caching
  function loadSplashImage(src) {
    if (imageCache.has(src)) {
      return imageCache.get(src);
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    imageCache.set(src, img);
    img.src = src;
    return img;
  }

  const GLYPH_SETS = {
    ps: {
      confirm: "○",
      back: "△",
      jump: "✕",
      special: "□",
    },
    xbox: {
      confirm: "B",
      back: "Y",
      jump: "A",
      special: "X",
    },
    switch: {
      confirm: "B",
      back: "Y",
      jump: "A",
      special: "X",
    },
    generic: {
      confirm: "●",
      back: "▲",
      jump: "▼",
      special: "◆",
    },
  };

  const CONTROLLER_LABELS = {
    ps: "DualSense",
    xbox: "Xbox Controller",
    switch: "Switch Pro Controller",
    generic: "Gamepad",
  };

  const DEFAULT_GLYPHS = GLYPH_SETS.generic;

  function getPrimaryGamepadInfo() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads ? Array.from(pads).find(Boolean) : null;

    if (!pad) {
      return {
        connected: false,
        type: "generic",
        glyphs: DEFAULT_GLYPHS,
        label: "No Controller",
        index: -1,
      };
    }

    const id = (pad.id || "").toLowerCase();
    const isPS = /sony|dualshock|dualsense|ps[45]/.test(id);
    const isXbox = /xbox|microsoft/.test(id);
    const isSwitch = /nintendo|switch|pro controller/.test(id);
    const type = isPS
      ? "ps"
      : isXbox
      ? "xbox"
      : isSwitch
      ? "switch"
      : "generic";

    return {
      connected: true,
      type,
      glyphs: GLYPH_SETS[type] || DEFAULT_GLYPHS,
      label: isPS
        ? "DualSense"
        : isXbox
        ? "Xbox Controller"
        : isSwitch
        ? "Switch Pro Controller"
        : pad.id || "Controller",
      index: pad.index ?? 0,
    };
  }

  // Get gamepad-appropriate glyph for UI display
  function getGamepadGlyph(action) {
    const info = getPrimaryGamepadInfo();
    const glyphs = info.glyphs || DEFAULT_GLYPHS;
    return glyphs[action] || DEFAULT_GLYPHS[action] || "●";
  }

  // Draw D-Pad controller symbol with glass effect
  function drawDPad(ctx, x, y, size, color = null) {
    ctx.save();
    const theme = getTheme();
    const dpadColor = color || theme.text;

    ctx.fillStyle = dpadColor;
    ctx.strokeStyle = dpadColor;
    ctx.lineWidth = 3;

    const h = size / 3;
    const w = size / 3;

    // Draw center square
    ctx.fillRect(x - w / 2, y - w / 2, w, w);

    // Draw up arrow
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y - size / 2);
    ctx.lineTo(x, y - h);
    ctx.lineTo(x + w / 2, y - size / 2);
    ctx.fill();

    // Draw right arrow
    ctx.beginPath();
    ctx.moveTo(x + size / 2, y - w / 2);
    ctx.lineTo(x + h, y);
    ctx.lineTo(x + size / 2, y + w / 2);
    ctx.fill();

    // Draw down arrow
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y + size / 2);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + w / 2, y + size / 2);
    ctx.fill();

    // Draw left arrow
    ctx.beginPath();
    ctx.moveTo(x - size / 2, y - w / 2);
    ctx.lineTo(x - h, y);
    ctx.lineTo(x - size / 2, y + w / 2);
    ctx.fill();

    ctx.restore();
  }

  const FACE_BUTTONS = [
    { id: "north", role: "back", symbol: "←", dx: 0, dy: -1 },
    { id: "east", role: "confirm", symbol: "✓", dx: 1, dy: 0 },
    { id: "south", role: "jump", symbol: "▲", dx: 0, dy: 1 },
    { id: "west", role: "special", symbol: "⚡", dx: -1, dy: 0 },
  ];

  // Draw diamond button layout (classic controller) with theme support
  function drawDiamondButtons(ctx, x, y, size, activeRoles = {}) {
    ctx.save();
    const theme = getTheme();
    const roleColors = theme.palette.roles || {};

    const spacing = size;
    const btnSize = size;

    const fallbackRoleColors = {
      confirm: "#B8E986",
      back: "#FF6B35",
      jump: "#50E3C2",
      special: "#4A90E2",
    };

    FACE_BUTTONS.forEach((btn) => {
      const color = roleColors[btn.role] || fallbackRoleColors[btn.role];
      const isActive = Boolean(activeRoles[btn.role]);

      drawButton(
        ctx,
        x + btn.dx * spacing,
        y + btn.dy * spacing,
        btnSize,
        color,
        btn.symbol,
        isActive
      );
    });

    ctx.restore();
  }

  // Draw a single button with color, symbol, and highlight
  function drawButton(ctx, x, y, size, color, symbol, highlight) {
    ctx.save();
    const theme = getTheme();

    // Glow wenn highlighted
    if (highlight) {
      ctx.shadowBlur = 20;
      ctx.shadowColor = color;
    }

    // Hintergrundkreis
    ctx.beginPath();
    ctx.arc(x, y, size * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = highlight ? color : `rgba(${hexToRgb(color)}, 0.3)`;
    ctx.fill();

    // Border
    ctx.beginPath();
    ctx.arc(x, y, size * 0.4, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = highlight ? 4 : 2;
    ctx.stroke();

    // Symbol
    ctx.font = `700 ${size * 0.5}px ${
      theme.typography?.fontMonospace || FONT_MONO_FAMILY
    }`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    if (highlight) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
      ctx.fillText(symbol, x, y + 1);
      ctx.fillStyle = theme.palette.textPrimary || "#FFFFFF";
      ctx.fillText(symbol, x, y);
    } else {
      ctx.fillStyle = color;
      ctx.shadowBlur = 0;
      ctx.fillText(symbol, x, y);
    }

    ctx.restore();
  }

  // Helper: Hex to RGB
  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r},${g},${b}`;
  }

  function colorWithAlpha(color, alpha) {
    if (!color) return `rgba(255,255,255,${alpha})`;
    if (color.startsWith("#")) {
      return `rgba(${hexToRgb(color)}, ${alpha})`;
    }
    const match = color.match(/rgba?\(([^)]+)\)/i);
    if (!match) return color;
    const parts = match[1]
      .split(",")
      .map((part) => part.trim())
      .slice(0, 3);
    return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
  }

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

  // Draw controller section images (r3, buttons)
  function drawControllerSections(ctx, state) {
    // DISABLED FOR USER TEST: Controller sections hidden
    return;

    if (!state.controllerSections) return;

    const sections = state.controllerSections;
    const imageSize = 120; // slot size reference (keeps previous layout positions)
    const spacing = 20; // Space between images
    const bottomPadding = 40; // Distance from bottom
    const y = ctx.canvas.height - bottomPadding - imageSize;

    // Calculate total width and starting position (center horizontally)
    const totalWidth = imageSize * 3 + spacing * 2; // keep spacing for middle gap
    const startX = (ctx.canvas.width - totalWidth) / 2;

    // Baseline where previous 120px images ended; keep bottoms aligned here
    const baselineY = y + imageSize;

    // Only shift in Character Select; keep Stage Select and others unchanged
    const isCharacterSelect = state?.gameMode === "CHARACTER_SELECT";
    const leftShift = isCharacterSelect ? -512 : 0;
    const rightShift = isCharacterSelect ? 512 - 50 : 0;

    // Draw r3 (left)
    if (sections.r3 && sections.r3.complete && sections.r3.naturalWidth > 0) {
      const w = sections.r3.naturalWidth;
      const h = sections.r3.naturalHeight;
      const centerX = startX + imageSize / 2;
      const drawX = centerX - w / 2 + leftShift; // conditional shift
      const drawY = baselineY - h;
      ctx.drawImage(sections.r3, drawX, drawY);
    }

    // Center slot intentionally left empty (arrows removed)

    // Draw buttons (right)
    if (
      sections.buttons &&
      sections.buttons.complete &&
      sections.buttons.naturalWidth > 0
    ) {
      const w = sections.buttons.naturalWidth;
      const h = sections.buttons.naturalHeight;
      const rightSlotX = startX + (imageSize + spacing) * 2;
      const centerX = rightSlotX + imageSize / 2;
      const drawX = centerX - w / 2 + rightShift; // conditional shift
      const drawY = baselineY - h;
      ctx.drawImage(sections.buttons, drawX, drawY);
    }
  }

  function drawControllerConnection(ctx, x, y) {
    ctx.save();

    const theme = getTheme();
    const info = getPrimaryGamepadInfo();
    const fontFamily = theme.typography?.fontPrimary || FONT_PRIMARY_FAMILY;

    ctx.font = `600 14px ${fontFamily}`;
    ctx.textAlign = "center";
    ctx.fillStyle = info.connected
      ? theme.palette.textSecondary
      : theme.palette.disabled || "rgba(255,255,255,0.25)";

    const label = info.connected
      ? `Pad ${info.index + 1} • ${info.label}`
      : "No gamepad detected";

    ctx.fillText(label, x, y);

    ctx.restore();
  }

  // Character Selection Komponente
  function renderCharacterSelect(
    ctx,
    state,
    charactersData,
    p1Index,
    p2Index,
    lockedSelections
  ) {
    const charList = Object.keys(charactersData);
    const cols = 3; // 3 columns per row
    const rows = Math.ceil(charList.length / cols); // Calculate rows based on character count
    const theme = getTheme();
    const fontPrimary = theme.typography?.fontPrimary || FONT_PRIMARY_FAMILY;
    const now =
      typeof performance !== "undefined" && performance.now
        ? performance.now()
        : Date.now();
    const focusPulse = 0.85 + 0.15 * Math.sin(now * 0.004);

    // Hintergrund mit radialem Gradient
    ctx.save();
    const gradient = ctx.createRadialGradient(
      ctx.canvas.width / 2,
      ctx.canvas.height / 2,
      0,
      ctx.canvas.width / 2,
      ctx.canvas.height / 2,
      ctx.canvas.width
    );
    const gradientStops = theme.palette.gradient || ["#0E1116", "#1C2028"];
    gradient.addColorStop(0, gradientStops[0]);
    gradient.addColorStop(1, gradientStops[1] || gradientStops[0]);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = theme.bgGlass || "rgba(0,0,0,0.7)";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();

    // Titel entfernt

    // Training Mode Hinweis
    if (state.isTrainingMode) {
      ctx.save();
      ctx.fillStyle = theme.palette.accent || "#4A90E2";
      ctx.font = `600 36px ${fontPrimary}`;
      ctx.textAlign = "center";
      ctx.shadowBlur = 10;
      ctx.shadowColor = theme.palette.accent || "#4A90E2";
      ctx.fillText("TRAINING MODE", ctx.canvas.width / 2, 50);
      ctx.font = `400 24px ${fontPrimary}`;
      ctx.fillStyle = theme.palette.textSecondary || "rgba(255,255,255,0.7)";
      ctx.shadowBlur = 5;
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.fillText("Wähle deinen Character", ctx.canvas.width / 2, 80);
      ctx.restore();
    }

    // Tutorial Mode Hinweis
    if (state.isStoryMode) {
      ctx.save();
      ctx.fillStyle = theme.palette.accent || "#4A90E2";
      ctx.font = `600 36px ${fontPrimary}`;
      ctx.textAlign = "center";
      ctx.shadowBlur = 10;
      ctx.shadowColor = theme.palette.accent || "#4A90E2";
      ctx.fillText("TUTORIAL MODE", ctx.canvas.width / 2, 50);
      ctx.font = `400 24px ${fontPrimary}`;
      ctx.fillStyle = theme.palette.textSecondary || "rgba(255,255,255,0.7)";
      ctx.shadowBlur = 5;
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.fillText("Wähle deinen Character", ctx.canvas.width / 2, 80);

      // P2 Join Hinweis
      if (!lockedSelections[1]) {
        ctx.font = `400 20px ${fontPrimary}`;
        ctx.fillStyle = theme.palette.textSecondary || "rgba(255,255,255,0.7)";
        ctx.fillText(
          "Player 2: Press START to join",
          ctx.canvas.width / 2,
          ctx.canvas.height - 60
        );
      }
      ctx.restore();
    }

    // Controller-Sektionen unten anzeigen
    drawControllerSections(ctx, state);

    // Splash-Art in reduzierter Größe (256x256) mit Rahmen - Dynamic Grid (3 columns)
    const imageSize = 256; // 50% der Originalgröße (512x512 -> 256x256)
    const spacing = 30; // Abstand zwischen den Bildern (auch 50% reduziert)

    // Berechne Startposition (zentriert)
    const totalWidth = cols * imageSize + (cols - 1) * spacing;
    const totalHeight = rows * imageSize + (rows - 1) * spacing;
    const startX = (ctx.canvas.width - totalWidth) / 2;
    const startY = 80; // Start position at top (title removed)

    // Zeichne die Splash-Bilder
    charList.forEach((char, idx) => {
      const row = Math.floor(idx / cols);
      const col = idx % cols;
      const x = startX + col * (imageSize + spacing);
      const y = startY + row * (imageSize + spacing);
      const data = charactersData[char];

      // Splash-Bild in Originalgröße zeichnen
      if (data.splashArt) {
        const img = loadSplashImage(data.splashArt);

        if (img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, x, y, imageSize, imageSize);
        } else {
          // Lade-Status
          ctx.fillStyle = theme.secondary;
          ctx.fillRect(x, y, imageSize, imageSize);
          ctx.fillStyle = theme.textSubtle;
          ctx.font = "16px Inter, system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("Loading...", x + imageSize / 2, y + imageSize / 2);
        }
      } else {
        // Platzhalter
        ctx.fillStyle = theme.secondary;
        ctx.fillRect(x, y, imageSize, imageSize);
        ctx.fillStyle = theme.textSubtle;
        ctx.font = "16px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("No Image", x + imageSize / 2, y + imageSize / 2);
      }

      if (data?.disabled) {
        ctx.save();
        ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
        ctx.fillRect(x, y, imageSize, imageSize);
        ctx.fillStyle =
          theme.palette.disabledText || "rgba(255, 255, 255, 0.65)";
        ctx.font = `${theme.typography?.weightSemi || 600} 24px ${fontPrimary}`;
        ctx.textAlign = "center";
        ctx.fillText("COMING SOON", x + imageSize / 2, y + imageSize / 2);
        ctx.restore();
      }

      // Zeichne P1 Rahmen mit Glow
      if (idx === p1Index && !data?.disabled) {
        ctx.save();
        ctx.shadowBlur = (theme.shadows?.frameGlow ?? 15) * focusPulse;
        ctx.shadowColor = theme.p1Frame;
        ctx.strokeStyle = theme.p1Frame;
        ctx.lineWidth = theme.strokes?.active ?? 4;
        ctx.strokeRect(x - 3, y - 3, imageSize + 6, imageSize + 6);
        ctx.restore();
      }

      // Zeichne P2 Rahmen mit Glow
      if (idx === p2Index && !data?.disabled) {
        ctx.save();
        ctx.shadowBlur = (theme.shadows?.frameGlow ?? 15) * focusPulse;
        ctx.shadowColor = theme.p2Frame;
        ctx.strokeStyle = theme.p2Frame;
        ctx.lineWidth = theme.strokes?.active ?? 4;
        ctx.strokeRect(x - 3, y - 3, imageSize + 6, imageSize + 6);
        ctx.restore();
      }

      // Wenn beide denselben Charakter ausgewählt haben, zeichne zusätzlichen Rahmen
      if (idx === p1Index && idx === p2Index && !data?.disabled) {
        ctx.save();
        ctx.shadowBlur = (theme.shadows?.frameGlow ?? 15) * (focusPulse + 0.2);
        ctx.shadowColor = theme.palette.double || theme.accent;
        ctx.strokeStyle = theme.palette.double || theme.accent;
        ctx.lineWidth = (theme.strokes?.active ?? 4) - 1;
        ctx.strokeRect(x - 6, y - 6, imageSize + 12, imageSize + 12);
        ctx.restore();
      }
    });

    // P1 Lock Status
    if (lockedSelections[0]) {
      ctx.save();
      ctx.shadowBlur = theme.shadows?.frameGlow ?? 15;
      ctx.shadowColor = theme.p1Frame;
      ctx.fillStyle = theme.p1Frame;
      ctx.font = `${theme.typography?.weightSemi || 600} 32px ${fontPrimary}`;
      ctx.textAlign = "center";
      ctx.fillText("P1 ✓", ctx.canvas.width / 4, startY + imageSize + 40);
      ctx.restore();
    }

    // P2 Lock Status
    if (lockedSelections[1]) {
      ctx.save();
      ctx.shadowBlur = theme.shadows?.frameGlow ?? 15;
      ctx.shadowColor = theme.p2Frame;
      ctx.fillStyle = theme.p2Frame;
      ctx.font = `${theme.typography?.weightSemi || 600} 32px ${fontPrimary}`;
      ctx.textAlign = "center";
      ctx.fillText("P2 ✓", (ctx.canvas.width * 3) / 4, startY + imageSize + 40);
      ctx.restore();
    }
  }

  // Stage Selection Komponente (einfacher Bienenwaben-ähnlicher Grid)
  function renderStageSelect(ctx, state, stagesData, selectedIndex) {
    const stageList = Object.keys(stagesData);
    const theme = getTheme();
    const fontPrimary = theme.typography?.fontPrimary || FONT_PRIMARY_FAMILY;
    const now =
      typeof performance !== "undefined" && performance.now
        ? performance.now()
        : Date.now();
    const focusPulse = 0.85 + 0.15 * Math.sin(now * 0.004);

    // Radialer Gradient-Hintergrund
    ctx.save();
    const gradient = ctx.createRadialGradient(
      ctx.canvas.width / 2,
      ctx.canvas.height / 2,
      0,
      ctx.canvas.width / 2,
      ctx.canvas.height / 2,
      ctx.canvas.width
    );
    gradient.addColorStop(0, "#321450");
    gradient.addColorStop(0.5, "#502870");
    gradient.addColorStop(1, "#321450");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();

    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();

    // Titel mit Glow-Effekt
    ctx.save();
    ctx.shadowBlur = theme.shadows?.panelGlow ?? 20;
    ctx.shadowColor = theme.palette.accentSoft || `rgba(0,209,255,0.35)`;
    ctx.fillStyle = theme.palette.textPrimary || theme.text;
    ctx.font = `${theme.typography?.weightBold || 700} 60px ${fontPrimary}`;
    ctx.textAlign = "center";
    ctx.fillText("Stage Select", ctx.canvas.width / 2, 100);
    ctx.restore();

    // Grid: 2x größere Miniaturen, sauber ausgerichtet
    const cols = 5; // Für 15 Stages: 3 Reihen à 5
    const rows = Math.ceil(stageList.length / cols);
    const stageSize = 200; // Doppelt so groß wie vorher (100 -> 200)
    const stageSpacing = 40;
    const startX = (ctx.canvas.width - cols * (stageSize + stageSpacing)) / 2;
    const startY = 180;

    stageList.forEach((stage, idx) => {
      const row = Math.floor(idx / cols);
      const col = idx % cols;
      const x = startX + col * (stageSize + stageSpacing);
      const y = startY + row * (stageSize + stageSpacing + 30);

      const data = stagesData[stage];
      const isActive = idx === selectedIndex;
      const scale = isActive ? 1.04 : 1.0;
      const drawSize = stageSize * scale;
      const drawX = x + stageSize / 2 - drawSize / 2;
      const drawY = y + stageSize / 2 - drawSize / 2;

      // Rahmen für Auswahl mit Glow-Effekt
      ctx.save();
      if (isActive) {
        ctx.shadowBlur = (theme.shadows?.frameGlow ?? 15) * focusPulse;
        ctx.shadowColor = theme.accent;
        ctx.strokeStyle = theme.accent;
        ctx.lineWidth = theme.strokes?.active ?? 4;
      } else {
        ctx.strokeStyle = theme.textSubtle;
        ctx.lineWidth = theme.strokes?.inactive ?? 2;
      }
      ctx.strokeRect(drawX, drawY, drawSize, drawSize);
      ctx.restore();

      // Stage-Preview laden und zeichnen (cached)
      if (data.preview) {
        const img = loadSplashImage(data.preview);
        if (img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, drawX, drawY, drawSize, drawSize);
        } else {
          // Lade-Status
          ctx.fillStyle = theme.secondary;
          ctx.fillRect(drawX, drawY, drawSize, drawSize);
          ctx.fillStyle = theme.textSubtle;
          ctx.font = `${
            theme.typography?.weightSemi || 600
          } 20px ${fontPrimary}`;
          ctx.textAlign = "center";
          ctx.fillText("Loading...", x + stageSize / 2, y + stageSize / 2);
        }
      } else {
        // Platzhalter
        ctx.fillStyle = theme.secondary;
        ctx.fillRect(drawX, drawY, drawSize, drawSize);
        ctx.fillStyle = theme.textSubtle;
        ctx.font = `${theme.typography?.weightSemi || 600} 20px ${fontPrimary}`;
        ctx.textAlign = "center";
        ctx.fillText("No Preview", x + stageSize / 2, y + stageSize / 2);
      }

      // "COMING SOON" overlay for disabled stages
      if (data?.disabled) {
        ctx.save();
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.fillRect(drawX, drawY, drawSize, drawSize);
        ctx.fillStyle =
          theme.palette.disabledText || "rgba(255, 255, 255, 0.8)";
        ctx.font = `${theme.typography?.weightSemi || 600} 28px ${fontPrimary}`;
        ctx.textAlign = "center";
        ctx.fillText("COMING SOON", x + stageSize / 2, y + stageSize / 2);
        ctx.restore();
      }
    });

    // Controller-Sektionen unten anzeigen
    drawControllerSections(ctx, state);
  }

  // Title Screen Komponente
  function renderTitleScreen(ctx, pulseValue = 1) {
    const theme = getTheme();
    const fontPrimary = theme.typography?.fontPrimary || FONT_PRIMARY_FAMILY;
    const gradientStops = theme.palette.gradient || ["#060606", "#0F1120"];

    const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.height);
    gradient.addColorStop(0, gradientStops[0]);
    gradient.addColorStop(1, gradientStops[1] || gradientStops[0]);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    const centerX = ctx.canvas.width / 2;
    const centerY = ctx.canvas.height / 2;

    const baseScale = 0.95;
    const scaleRange = 0.05;
    const scale = baseScale + scaleRange * pulseValue;

    const glowBase = theme.shadows?.panelGlow ?? 12;
    const glowRange = 30;
    const glowStrength = glowBase + glowRange * pulseValue;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.scale(scale, scale);

    ctx.shadowBlur = glowStrength;
    ctx.shadowColor = theme.palette.accent || "#00D1FF";

    ctx.fillStyle = theme.palette.textPrimary || "#FFFFFF";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${theme.typography?.weightBold || 700} 140px ${fontPrimary}`;
    ctx.fillText("PLAY MILCH", 0, 0);

    ctx.restore();

    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = theme.palette.textSecondary || "rgba(255,255,255,0.6)";
    ctx.font = `400 28px ${fontPrimary}`;
    ctx.fillText("Press any button to start", centerX, centerY + 180);
    ctx.restore();
  }

  // NEW: Render character selection animations from atlas_ui
  function renderCharacterSelectAnimations(ctx, state, charactersData) {
    // Check if UI atlas is loaded
    if (!state.uiAtlas || !state.uiAtlasImage) return;

    const charList = Object.keys(charactersData);

    // Render P1 select animation (loops until both players confirm)
    if (
      state.selection.p1SelectAnimation &&
      state.selection.p1SelectAnimation.isLooping
    ) {
      const anim = state.selection.p1SelectAnimation;
      const charIndex = anim.charIndex;
      const charName = anim.charName; // e.g., "cyboard", "fritz", "hp", "charly"
      const frameNumber = (anim.selectFrame + 1).toString().padStart(3, "0"); // 001-004
      const frameName = `${charName}_char_select_${frameNumber}`; // e.g., "cyboard_char_select_001"
      const frame = state.uiAtlas.frames[frameName];

      if (frame) {
        const charX =
          (ctx.canvas.width - charList.length * (150 + 20)) / 2 +
          charIndex * (150 + 20);
        const charY = 200;

        ctx.save();
        ctx.drawImage(
          state.uiAtlasImage,
          frame.frame.x,
          frame.frame.y,
          frame.frame.w,
          frame.frame.h,
          charX - 10,
          charY - 10,
          170,
          170
        );
        ctx.restore();
      }
    }

    // Render P2 select animation (loops until both players confirm)
    if (
      state.selection.p2SelectAnimation &&
      state.selection.p2SelectAnimation.isLooping
    ) {
      const anim = state.selection.p2SelectAnimation;
      const charIndex = anim.charIndex;
      const charName = anim.charName; // e.g., "cyboard", "fritz", "hp", "charly"
      const frameNumber = (anim.selectFrame + 1).toString().padStart(3, "0"); // 001-004
      const frameName = `${charName}_char_select_${frameNumber}`; // e.g., "fritz_char_select_002"
      const frame = state.uiAtlas.frames[frameName];

      if (frame) {
        const charX =
          (ctx.canvas.width - charList.length * (150 + 20)) / 2 +
          charIndex * (150 + 20);
        const charY = 200;

        ctx.save();
        ctx.drawImage(
          state.uiAtlasImage,
          frame.frame.x,
          frame.frame.y,
          frame.frame.w,
          frame.frame.h,
          charX - 10,
          charY - 10,
          170,
          170
        );
        ctx.restore();
      }
    }

    // Render final selected animation (plays once for both characters)
    if (
      state.selection.selectedAnimation &&
      !state.selection.selectedAnimation.isComplete
    ) {
      const anim = state.selection.selectedAnimation;
      const p1CharIndex = charList.indexOf(anim.p1CharName);
      const p2CharIndex = charList.indexOf(anim.p2CharName);
      const frameNumber = (anim.selectedFrame + 1).toString().padStart(3, "0"); // 001-004

      // P1 selected animation
      if (p1CharIndex >= 0) {
        const p1FrameName = `${anim.p1CharName}_char_selected_${frameNumber}`; // e.g., "cyboard_char_selected_001"
        const p1Frame = state.uiAtlas.frames[p1FrameName];

        if (p1Frame) {
          const charX =
            (ctx.canvas.width - charList.length * (150 + 20)) / 2 +
            p1CharIndex * (150 + 20);
          const charY = 200;

          ctx.save();
          ctx.drawImage(
            state.uiAtlasImage,
            p1Frame.frame.x,
            p1Frame.frame.y,
            p1Frame.frame.w,
            p1Frame.frame.h,
            charX - 10,
            charY - 10,
            170,
            170
          );
          ctx.restore();
        }
      }

      // P2 selected animation (uses P2's character-specific animation)
      // Note: If both players selected the same character, this will still render at P2's index
      if (p2CharIndex >= 0) {
        const p2FrameName = `${anim.p2CharName}_char_selected_${frameNumber}`; // e.g., "fritz_char_selected_002"
        const p2Frame = state.uiAtlas.frames[p2FrameName];

        if (p2Frame) {
          const charX =
            (ctx.canvas.width - charList.length * (150 + 20)) / 2 +
            p2CharIndex * (150 + 20);
          const charY = 200;

          ctx.save();
          // If both selected same character, render animation centered on that character slot
          if (p1CharIndex === p2CharIndex) {
            // Same character - render once in the center
            // Skip P2 render since P1 already rendered it
          } else {
            // Different characters - render P2 animation
            ctx.drawImage(
              state.uiAtlasImage,
              p2Frame.frame.x,
              p2Frame.frame.y,
              p2Frame.frame.w,
              p2Frame.frame.h,
              charX - 10,
              charY - 10,
              170,
              170
            );
          }
          ctx.restore();
        }
      }
    }
  }

  // NEW: Title intro transition component
  function renderTitleIntro(ctx, state) {
    // Calculate fade to black effect in last 2 seconds of music
    const musicDuration = 12.0; // Music is 12 seconds
    const fadeStartTime = musicDuration - 2.0; // Start fading 2 seconds before music ends
    const currentTime = state.titleIntro.frameTime;

    // Check if we should fade to black
    let fadeAlpha = 1.0;
    if (currentTime >= fadeStartTime) {
      const fadeProgress = (currentTime - fadeStartTime) / 2.0; // 2 second fade
      fadeAlpha = Math.max(0, 1.0 - fadeProgress);
    }

    // Apply fade to black background
    ctx.fillStyle = `rgba(0, 0, 0, ${1.0 - fadeAlpha})`;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Check if UI atlas is loaded
    if (!state.uiAtlas || !state.uiAtlasImage) {
      // Fallback: show loading text
      ctx.fillStyle = "#ffffff";
      ctx.font = "32px monospace";
      ctx.textAlign = "center";
      ctx.fillText("Loading...", ctx.canvas.width / 2, ctx.canvas.height / 2);
      return;
    }

    // Get current frame (0-based index)
    const frameIndex = state.titleIntro.currentFrame;
    const frameNumber = (frameIndex + 1).toString().padStart(3, "0");
    const frameName = `title_intro_${frameNumber}`;
    const frame = state.uiAtlas.frames[frameName];

    if (frame) {
      // Apply fade alpha to sprite and text
      ctx.save();
      ctx.globalAlpha = fadeAlpha;

      // Center the sprite on screen in original 256x256 size
      const centerX = ctx.canvas.width / 2;
      const centerY = ctx.canvas.height / 2;
      const spriteSize = 256; // Original size 256x256

      ctx.drawImage(
        state.uiAtlasImage,
        frame.frame.x,
        frame.frame.y,
        frame.frame.w,
        frame.frame.h,
        centerX - spriteSize / 2,
        centerY - spriteSize / 2,
        spriteSize,
        spriteSize
      );

      // Add "forever young" text overlay
      ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
      ctx.font = "bold 48px serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Add subtle glow effect
      ctx.shadowBlur = 10;
      ctx.shadowColor = "rgba(255, 255, 255, 0.5)";

      ctx.fillText("forever young", centerX, centerY + spriteSize / 2 + 80);

      // Reset shadow
      ctx.shadowBlur = 0;

      ctx.restore(); // Restore globalAlpha
    }

    // Show skip instruction (subtle, also affected by fade)
    ctx.save();
    ctx.globalAlpha = fadeAlpha;
    ctx.fillStyle = "rgba(150, 150, 150, 0.6)";
    ctx.font = "20px monospace";
    ctx.textAlign = "center";
    ctx.fillText(
      "Press any key to skip",
      ctx.canvas.width / 2,
      ctx.canvas.height - 50
    );
    ctx.restore();
  }

  // NEW: Dance Battle UI (vereinfacht - Beat-Balken sind jetzt bei den Spielern)
  function renderDanceBattle(ctx, state) {
    if (!state.danceBattle.active) return;

    const db = state.danceBattle;
    const centerX = ctx.canvas.width / 2;
    const topY = 100;

    if (db.countdown?.active) {
      const atlas = state.uiAtlas;
      const atlasImage = state.uiAtlasImage;
      const countdown = db.countdown;
      const frameList = atlas?.animations?.countdown;
      const hasFrames = Array.isArray(frameList) && frameList.length > 0;
      const frameKey =
        hasFrames && countdown.frameIndex < frameList.length
          ? frameList[countdown.frameIndex]
          : hasFrames
          ? frameList[frameList.length - 1]
          : null;
      const frame = frameKey ? atlas?.frames?.[frameKey] : null;

      if (frame && atlasImage) {
        const size = 256;
        const drawX = centerX - size / 2;
        const drawY = topY - size / 2;

        ctx.save();
        ctx.shadowBlur = 30;
        ctx.shadowColor = "rgba(255, 255, 255, 0.65)";
        ctx.drawImage(
          atlasImage,
          frame.frame.x,
          frame.frame.y,
          frame.frame.w,
          frame.frame.h,
          drawX,
          drawY,
          size,
          size
        );
        ctx.restore();
      } else {
        const displayValue =
          db.countdownValue && db.countdownValue > 0
            ? Math.ceil(db.countdownValue)
            : 1;
        ctx.save();
        ctx.shadowBlur = 28;
        ctx.shadowColor = "rgba(255, 255, 255, 0.75)";
        ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
        ctx.font = "800 140px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(displayValue.toString(), centerX, topY + 40);
        ctx.restore();
      }

      return;
    }

    // Timer mit subtilem Glow
    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = "rgba(150, 150, 255, 0.65)";
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.font = "600 64px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    const timeText = db.timeRemaining.toFixed(1) + "s";
    ctx.fillText(timeText, centerX, topY);
    ctx.restore();
  }

  // NEW: In-game modal component
  function renderInGameModal(ctx, state) {
    if (!state.modal.isOpen) return;
    
    // Don't render game menu modal when scoreboard is showing
    const isScoreboardShowing =
      state.matchEnd?.isActive &&
      state.matchEnd?.phase === "showingResults";
    if (isScoreboardShowing) return;

    const modal = state.modal;
    const centerX = ctx.canvas.width / 2;
    const centerY = ctx.canvas.height / 2;
    const modalWidth = 600;
    const buttonCount = modal.buttons.length;
    const baseButtonHeight = 56;
    const baseButtonSpacing = 14;
    const headerPadding = 110;
    const footerPadding = 100;
    const maxModalHeight = Math.min(ctx.canvas.height * 0.85, 640);
    const theme = getTheme();
    const fontPrimary = theme.typography?.fontPrimary || FONT_PRIMARY_FAMILY;
    const confirmColor = theme.palette.roles?.confirm || "#00FF00";
    const disabledColor = theme.palette.disabled || "rgba(255,255,255,0.25)";

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
    const modalRadius = 16;
    const buttonAreaTop =
      modalY + headerPadding + (availableButtonSpace - buttonAreaHeight) / 2;

    const nowSeconds =
      (typeof performance !== "undefined" ? performance.now() : Date.now()) /
      1000;

    // Semi-transparent background overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Modal background
    ctx.save();
    drawRoundedRect(ctx, modalX, modalY, modalWidth, modalHeight, modalRadius);
    ctx.fillStyle = theme.bgGlass || "rgba(20,20,20,0.95)";
    ctx.fill();
    ctx.shadowBlur = theme.shadows?.panelGlow ?? 12;
    ctx.shadowColor = theme.palette.accentSoft || "rgba(0,209,255,0.35)";
    ctx.lineWidth = theme.strokes?.inactive ?? 2;
    ctx.strokeStyle = theme.palette.strokeSubtle || "rgba(255,255,255,0.4)";
    ctx.stroke();
    ctx.restore();

    // Title
    ctx.fillStyle = theme.palette.textPrimary || "#FFFFFF";
    ctx.font = `${theme.typography?.weightBold || 700} 32px ${fontPrimary}`;
    ctx.textAlign = "center";
    ctx.fillText("Game Menu", centerX, modalY + 60);

    // Buttons
    modal.buttons.forEach((button, index) => {
      const buttonY = buttonAreaTop + index * (buttonHeight + buttonSpacing);
      const isSelected = index === modal.selectedButton;
      const isDisabled = Boolean(button.disabled || button.isDisabled);
      const buttonRadius = 12;
      const btnX = modalX + 50;
      const btnWidth = modalWidth - 100;

      // Button background
      if (isSelected) {
        const pulse = (Math.sin(nowSeconds * 5) + 1) / 2;
        const gradient = ctx.createLinearGradient(
          btnX,
          buttonY,
          btnX + btnWidth,
          buttonY + buttonHeight
        );
        gradient.addColorStop(
          0,
          colorWithAlpha(confirmColor, 0.2 + 0.15 * pulse)
        );
        gradient.addColorStop(
          0.5,
          colorWithAlpha("#FFFFFF", 0.08 + 0.08 * pulse)
        );
        gradient.addColorStop(
          1,
          colorWithAlpha(confirmColor, 0.32 + 0.18 * pulse)
        );

        ctx.save();
        drawRoundedRect(
          ctx,
          btnX,
          buttonY,
          btnWidth,
          buttonHeight,
          buttonRadius
        );
        ctx.fillStyle = gradient;
        ctx.shadowBlur = (theme.shadows?.buttonGlow ?? 18) + pulse * 14;
        ctx.shadowColor = colorWithAlpha(confirmColor, 0.85);
        ctx.fill();
        ctx.restore();
        ctx.save();
        drawRoundedRect(
          ctx,
          btnX,
          buttonY,
          btnWidth,
          buttonHeight,
          buttonRadius
        );
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = colorWithAlpha(confirmColor, 0.7 + 0.25 * pulse);
        ctx.stroke();
        ctx.restore();

        // Side indicators for the active item
        const indicatorWidth = 8 + pulse * 6;
        const indicatorHeight = Math.max(
          buttonHeight - 10,
          buttonHeight * 0.75
        );
        const indicatorY = buttonY + (buttonHeight - indicatorHeight) / 2;

        ctx.save();
        ctx.fillStyle = colorWithAlpha(confirmColor, 0.6 + 0.3 * pulse);
        ctx.shadowColor = colorWithAlpha(confirmColor, 0.8);
        ctx.shadowBlur = 8 + pulse * 6;
        ctx.fillRect(
          btnX - indicatorWidth - 6,
          indicatorY,
          indicatorWidth,
          indicatorHeight
        );
        ctx.fillRect(
          btnX + btnWidth + 6,
          indicatorY,
          indicatorWidth,
          indicatorHeight
        );
        ctx.restore();
      } else {
        ctx.save();
        drawRoundedRect(
          ctx,
          btnX,
          buttonY,
          btnWidth,
          buttonHeight,
          buttonRadius
        );
        ctx.fillStyle = isDisabled
          ? colorWithAlpha(disabledColor, 0.2)
          : "rgba(60, 60, 60, 0.75)";
        ctx.fill();
        ctx.restore();

        ctx.save();
        drawRoundedRect(
          ctx,
          btnX,
          buttonY,
          btnWidth,
          buttonHeight,
          buttonRadius
        );
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = theme.palette.strokeSubtle || "rgba(255,255,255,0.4)";
        ctx.stroke();
        ctx.restore();
      }

      // Button text
      if (isSelected) {
        const pulse = (Math.sin(nowSeconds * 5) + 1) / 2;
        ctx.save();
        ctx.fillStyle = theme.palette.textPrimary || "#FFFFFF";
        ctx.shadowColor = colorWithAlpha(confirmColor, 0.4 + 0.4 * pulse);
        ctx.shadowBlur = 12 + pulse * 8;
        ctx.font = `${theme.typography?.weightBold || 700} 20px ${fontPrimary}`;
        ctx.textAlign = "center";
        ctx.fillText(button.text, centerX, buttonY + buttonHeight / 2 + 7);
        ctx.restore();
      } else {
        ctx.fillStyle = isDisabled
          ? disabledColor
          : theme.palette.textPrimary || "#FFFFFF";
        ctx.font = `${theme.typography?.weightSemi || 600} 18px ${fontPrimary}`;
        ctx.textAlign = "center";
        ctx.fillText(button.text, centerX, buttonY + buttonHeight / 2 + 7);
      }
    });

    // Instructions (moved further down to prevent overflow)
    ctx.fillStyle = theme.palette.textSecondary || "rgba(200,200,200,0.8)";
    ctx.font = `500 16px ${fontPrimary}`;
    ctx.textAlign = "center";
    ctx.fillText(
      "↑↓ Navigate | Enter Select | ESC Close",
      centerX,
      modalY + modalHeight - footerPadding + 40
    );
  }

  // NEW: Controls modal component with remapping UI
  function renderControlsModal(ctx, state) {
    if (!state.modal.controlsModal.isOpen) return;

    const centerX = ctx.canvas.width / 2;
    const centerY = ctx.canvas.height / 2;
    const modalWidth = 960;
    const modalHeight = 760;
    const modalX = centerX - modalWidth / 2;
    const modalY = centerY - modalHeight / 2;
    const rowHeight = 44;
    const tableTop = modalY + 196;
    const actionsX = modalX + 170;
    const bindingX = modalX + modalWidth - 170;
    const actionColumnWidth = modalWidth - 320;
    const bindingColumnWidth = 280;

    // Semi-transparent background overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.88)";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Modal background
    ctx.fillStyle = "rgba(18, 18, 18, 0.95)";
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 2;
    ctx.fillRect(modalX, modalY, modalWidth, modalHeight);
    ctx.strokeRect(modalX, modalY, modalWidth, modalHeight);

    const controls = state.modal.controlsModal;
    const focus = controls.focus || "player";
    const actionsActive = focus !== "player";
    const catalog = window.InputBindingCatalog;
    const actions = catalog.getDisplayableActions({ editableOnly: false });
    const totalRows = actions.length;
    const baseVisibleRows = controls.visibleRows ?? 9;
    const visibleRows = Math.max(
      1,
      Math.min(baseVisibleRows, Math.max(1, totalRows))
    );
    const listHeight = rowHeight * visibleRows;
    const editableActions = catalog.getDisplayableActions({
      editableOnly: true,
    });
    const selectedActionId =
      editableActions[controls.selectedActionIndex]?.id || null;
    const totalPlayers =
      state.input.gamepadMapping?.length > 0
        ? state.input.gamepadMapping.length
        : 1;
    const bindingState =
      state.input.playerBindings?.[controls.playerIndex] || null;

    // Title
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 36px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Controller Setup", centerX, modalY + 76);

    ctx.fillStyle = "rgba(220,220,220,0.9)";
    ctx.font = "500 18px monospace";
    ctx.fillText(
      "Remap buttons per player; bindings persist between sessions",
      centerX,
      modalY + 116
    );

    // Player tabs
    const tabWidth = 160;
    const tabHeight = 40;
    const tabSpacing = 24;
    const tabStartX =
      centerX - ((totalPlayers - 1) * (tabWidth + tabSpacing)) / 2;
    ctx.font = "600 18px monospace";
    for (let i = 0; i < totalPlayers; i++) {
      const x = tabStartX + i * (tabWidth + tabSpacing);
      const isSelected = i === controls.playerIndex;
      ctx.fillStyle = isSelected
        ? "rgba(80, 120, 255, 0.35)"
        : "rgba(40, 40, 40, 0.75)";
      ctx.strokeStyle = isSelected
        ? "rgba(120, 160, 255, 0.9)"
        : "rgba(255,255,255,0.25)";
      ctx.lineWidth = 2;
      drawRoundedRect(ctx, x, modalY + 128, tabWidth, tabHeight, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = isSelected ? "#ffffff" : "rgba(200,200,200,0.75)";
      ctx.textAlign = "center";
      ctx.fillText(`Player ${i + 1}`, x + tabWidth / 2, modalY + 156);
      if (isSelected && focus === "player") {
        ctx.save();
        ctx.shadowColor = "rgba(140, 180, 255, 0.9)";
        ctx.shadowBlur = 22;
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = "rgba(160, 200, 255, 0.95)";
        drawRoundedRect(ctx, x, modalY + 128, tabWidth, tabHeight, 10);
        ctx.stroke();
        ctx.restore();
      }
    }

    if (focus === "player") {
      ctx.fillStyle = "rgba(175, 210, 255, 0.9)";
      ctx.font = "600 18px monospace";
      ctx.textAlign = "center";
      ctx.fillText(
        "Select a player to edit • Enter/A confirm",
        centerX,
        modalY + 184
      );
    }

    // Header row
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.beginPath();
    ctx.moveTo(modalX + 60, tableTop - 24);
    ctx.lineTo(modalX + modalWidth - 60, tableTop - 24);
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(200,200,200,0.85)";
    ctx.font = "600 18px monospace";
    ctx.fillText("Action", actionsX, tableTop - 34);
    ctx.textAlign = "right";
    ctx.fillText("Binding", bindingX, tableTop - 34);

    const rowColors = [
      "rgba(120,180,255,0.11)",
      "rgba(255,180,140,0.11)",
      "rgba(140,220,190,0.11)",
      "rgba(235,190,255,0.11)",
      "rgba(255,220,140,0.11)",
    ];

    // Column background blocks for readability
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    drawRoundedRect(
      ctx,
      modalX + 100,
      tableTop - 22,
      actionColumnWidth,
      listHeight + 26,
      12
    );
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    drawRoundedRect(
      ctx,
      bindingX - bindingColumnWidth + 8,
      tableTop - 22,
      bindingColumnWidth,
      listHeight + 26,
      12
    );
    ctx.fill();

    const maxOffset = Math.max(0, totalRows - visibleRows);
    const scrollOffset = Math.max(
      0,
      Math.min(controls.scrollOffset ?? 0, maxOffset)
    );
    const rowsToRender = actions.slice(
      scrollOffset,
      scrollOffset + visibleRows
    );

    const rowFont = "500 18px monospace";
    ctx.font = rowFont;

    ctx.save();
    if (!actionsActive) {
      ctx.globalAlpha = 0.55;
    }

    rowsToRender.forEach((action, idx) => {
      const globalIndex = scrollOffset + idx;
      const rowTop = tableTop + idx * rowHeight;
      const rowCenter = rowTop + rowHeight / 2;
      const highlightHeight = rowHeight - 12;
      const highlightTop = rowCenter - highlightHeight / 2;
      const isEditable = action.editable !== false;
      const isSelected = isEditable && action.id === selectedActionId;
      const baseColor = rowColors[globalIndex % rowColors.length];

      // Base colored stripe for action row (stable across players)
      ctx.fillStyle = baseColor;
      drawRoundedRect(
        ctx,
        modalX + 110,
        highlightTop,
        modalWidth - 220,
        highlightHeight,
        10
      );
      ctx.fill();

      if (isSelected && actionsActive) {
        ctx.strokeStyle = "rgba(150, 190, 255, 0.85)";
        ctx.lineWidth = 2;
        drawRoundedRect(
          ctx,
          modalX + 110,
          highlightTop,
          modalWidth - 220,
          highlightHeight,
          10
        );
        ctx.stroke();
      }

      ctx.textAlign = "left";
      ctx.fillStyle = isEditable ? "#ffffff" : "rgba(210,210,210,0.65)";
      ctx.fillText(action.label, actionsX, rowCenter + 6);

      let bindingLabel;
      if (!bindingState) {
        bindingLabel = "No controller";
      } else if (isEditable) {
        const bindingValue = bindingState.bindings?.[action.id] || null;
        bindingLabel = catalog.formatBinding(
          bindingState.controllerType,
          bindingValue
        );
      } else {
        bindingLabel = "Automatic";
      }

      ctx.textAlign = "right";
      ctx.fillStyle =
        bindingState && isEditable
          ? "rgba(200,220,255,0.9)"
          : "rgba(210,210,210,0.65)";
      ctx.fillText(bindingLabel, bindingX, rowCenter + 6);
    });
    ctx.restore();

    if (totalRows > visibleRows) {
      ctx.fillStyle = "rgba(200,200,200,0.7)";
      ctx.font = "500 16px monospace";
      const page = Math.floor(scrollOffset / visibleRows) + 1;
      const totalPages = Math.ceil(totalRows / visibleRows);
      ctx.textAlign = "right";
      ctx.fillText(`Page ${page} / ${totalPages}`, bindingX, tableTop - 40);

      ctx.textAlign = "center";
      ctx.font = "500 14px monospace";
      if (scrollOffset > 0) {
        ctx.fillText("▲", centerX, tableTop - 30);
      }
      if (scrollOffset + visibleRows < totalRows) {
        ctx.fillText("▼", centerX, tableTop + listHeight + 10);
      }
    }

    // Notice
    if (controls.notice) {
      ctx.textAlign = "center";
      ctx.font = "600 18px monospace";
      ctx.fillStyle = "#9fd4ff";
      ctx.fillText(controls.notice, centerX, modalY + modalHeight - 134);
    }

    // Instructions
    ctx.textAlign = "center";
    ctx.font = "500 16px monospace";
    drawRoundedRect(
      ctx,
      modalX + 120,
      modalY + modalHeight - 128,
      modalWidth - 240,
      78,
      12
    );
    ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
    ctx.fill();
    ctx.fillStyle = "#ffffff";

    if (controls.captureMode) {
      ctx.fillText(
        "Listening… Press desired control • Backspace/B cancel",
        centerX,
        modalY + modalHeight - 94
      );
    } else if (!bindingState) {
      ctx.fillStyle = "#ffb0b0";
      ctx.fillText(
        "Connect a controller for this player to customize bindings",
        centerX,
        modalY + modalHeight - 94
      );
    } else if (!actionsActive) {
      ctx.fillStyle = "#e0e8ff";
      ctx.fillText(
        "← → Choose player • Enter/A confirm • ESC/B Back",
        centerX,
        modalY + modalHeight - 104
      );
      ctx.fillStyle = "#b8c8ff";
      ctx.font = "500 14px monospace";
      ctx.fillText(
        "After confirming, press LB or Tab anytime to change player again",
        centerX,
        modalY + modalHeight - 82
      );
    } else {
      ctx.fillStyle = "#e0e0e0";
      ctx.fillText(
        "↑↓ Navigate actions • Enter/A Rebind • Del / X(Square) Clear • R/Y Reset • LB or Tab Change Player • ESC/B Back",
        centerX,
        modalY + modalHeight - 108
      );
      if (totalRows > visibleRows) {
        ctx.fillStyle = "#c0c0c0";
        ctx.font = "500 14px monospace";
        ctx.fillText(
          "List scrolls automatically; keep pressing ↑/↓ to reveal hidden actions",
          centerX,
          modalY + modalHeight - 80
        );
      }
    }

    // Capture overlay
    if (controls.captureMode) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(modalX + 60, tableTop - 4, modalWidth - 120, listHeight + 8);
      ctx.strokeStyle = "rgba(120, 160, 255, 0.8)";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        modalX + 60,
        tableTop - 4,
        modalWidth - 120,
        listHeight + 8
      );

      ctx.fillStyle = "#ffffff";
      ctx.font = "600 24px monospace";
      ctx.fillText(
        "Waiting for input…",
        centerX,
        tableTop + listHeight / 2 - 6
      );
      ctx.font = "500 18px monospace";
      ctx.fillStyle = "rgba(200,200,200,0.85)";
      ctx.fillText(
        "Press a new button or move a stick to bind",
        centerX,
        tableTop + listHeight / 2 + 22
      );
      ctx.font = "500 16px monospace";
      ctx.fillStyle = "rgba(200,200,200,0.75)";
      ctx.fillText(
        "Backspace / B to cancel",
        centerX,
        tableTop + listHeight / 2 + 46
      );
    }
  }

  // NEW: Game Mode Selection Component
  function renderGameTypeSelect(ctx, state) {
    // Background
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Title
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 48px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Select Game Type", ctx.canvas.width / 2, 150);

    const centerX = ctx.canvas.width / 2;
    const centerY = ctx.canvas.height / 2;
    const typeSpacing = 400;

    // PvP Mode (Left)
    const pvpX = centerX - typeSpacing / 2;
    const isPvpSelected = state.gameTypeSelection?.selectedType === "pvp";

    ctx.save();
    ctx.translate(pvpX, centerY);

    // Border
    ctx.strokeStyle = isPvpSelected ? "#00ff00" : "#ffffff";
    ctx.lineWidth = isPvpSelected ? 6 : 3;
    ctx.strokeRect(-150, -150, 300, 300);

    // Background
    ctx.fillStyle = isPvpSelected
      ? "rgba(0, 255, 0, 0.1)"
      : "rgba(50, 50, 50, 0.5)";
    ctx.fillRect(-150, -150, 300, 300);

    // Icon/Text
    ctx.fillStyle = isPvpSelected ? "#00ff00" : "#ffffff";
    ctx.font = "bold 32px monospace";
    ctx.textAlign = "center";
    ctx.fillText("PVP", 0, -50);
    ctx.font = "20px monospace";
    ctx.fillText("Player vs", 0, 0);
    ctx.fillText("Player", 0, 30);
    ctx.fillText("Mode", 0, 60);

    ctx.restore();

    // Tutorial Mode (Right)
    const tutorialX = centerX + typeSpacing / 2;
    const isTutorialSelected =
      state.gameTypeSelection?.selectedType === "story";

    ctx.save();
    ctx.translate(tutorialX, centerY);

    // Border
    ctx.strokeStyle = isTutorialSelected ? "#00ff00" : "#ffffff";
    ctx.lineWidth = isTutorialSelected ? 6 : 3;
    ctx.strokeRect(-150, -150, 300, 300);

    // Background
    ctx.fillStyle = isTutorialSelected
      ? "rgba(0, 255, 0, 0.1)"
      : "rgba(50, 50, 50, 0.5)";
    ctx.fillRect(-150, -150, 300, 300);

    // Icon/Text
    ctx.fillStyle = isTutorialSelected ? "#00ff00" : "#ffffff";
    ctx.font = "bold 32px monospace";
    ctx.textAlign = "center";
    ctx.fillText("TUTORIAL", 0, -50);
    ctx.font = "20px monospace";
    ctx.fillText("Learn", 0, 0);
    ctx.fillText("the", 0, 30);
    ctx.fillText("Basics", 0, 60);

    ctx.restore();

    // Instructions
    ctx.fillStyle = "#ffffff";
    ctx.font = "24px monospace";
    ctx.textAlign = "center";
    ctx.fillText(
      "Left/Right to switch | B Button to confirm | Y to go back",
      ctx.canvas.width / 2,
      ctx.canvas.height - 100
    );
  }

  function renderGameModeSelect(ctx, state) {
    // Background
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Title
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 48px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Select Game Mode", ctx.canvas.width / 2, 150);

    const centerX = ctx.canvas.width / 2;
    const centerY = ctx.canvas.height / 2;
    const modeSpacing = 400;

    // Classic Mode (Left)
    const classicX = centerX - modeSpacing / 2;
    const isClassicSelected = state.selectedGameMode === "classic";

    ctx.save();
    ctx.translate(classicX, centerY);

    // Border
    ctx.strokeStyle = isClassicSelected ? "#00ff00" : "#ffffff";
    ctx.lineWidth = isClassicSelected ? 6 : 3;
    ctx.strokeRect(-150, -150, 300, 300);

    // Background
    ctx.fillStyle = isClassicSelected
      ? "rgba(0, 255, 0, 0.1)"
      : "rgba(50, 50, 50, 0.5)";
    ctx.fillRect(-150, -150, 300, 300);

    // Icon/Text
    ctx.fillStyle = isClassicSelected ? "#00ff00" : "#ffffff";
    ctx.font = "bold 32px monospace";
    ctx.textAlign = "center";
    ctx.fillText("CLASSIC", 0, -50);
    ctx.font = "20px monospace";
    ctx.fillText("3 Lives", 0, 0);
    ctx.fillText("Knockout", 0, 30);
    ctx.fillText("Mode", 0, 60);

    ctx.restore();

    // Dance Mode (Right) - DISABLED FOR USER TEST
    const danceX = centerX + modeSpacing / 2;
    const isDanceSelected = state.selectedGameMode === "dance";
    const isDanceDisabled = true; // Disabled for user test

    ctx.save();
    ctx.translate(danceX, centerY);

    // Border (grayed out)
    ctx.strokeStyle = "#666666";
    ctx.lineWidth = 3;
    ctx.strokeRect(-150, -150, 300, 300);

    // Background (grayed out)
    ctx.fillStyle = "rgba(30, 30, 30, 0.7)";
    ctx.fillRect(-150, -150, 300, 300);

    // Icon/Text (grayed out)
    ctx.fillStyle = "#666666";
    ctx.font = "bold 32px monospace";
    ctx.textAlign = "center";
    ctx.fillText("DANCE", 0, -50);
    ctx.font = "20px monospace";
    ctx.fillText("10 Perfect", 0, 0);
    ctx.fillText("Beats", 0, 30);
    ctx.fillText("Mode", 0, 60);

    // "COMING SOON" overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(-150, -150, 300, 300);
    ctx.fillStyle = "#999999";
    ctx.font = "bold 24px monospace";
    ctx.fillText("COMING SOON", 0, 0);

    ctx.restore();
  }

  function wrapTextLines(ctx, text, maxWidth) {
    if (!text) return [];
    const lines = [];
    const paragraphs = String(text)
      .split(/\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    paragraphs.forEach((paragraph, idx) => {
      const words = paragraph.split(/\s+/);
      let currentLine = "";
      words.forEach((word) => {
        const tentative = currentLine ? `${currentLine} ${word}` : word;
        if (ctx.measureText(tentative).width <= maxWidth) {
          currentLine = tentative;
        } else {
          if (currentLine) {
            lines.push(currentLine);
          }
          currentLine = word;
        }
      });
      if (currentLine) {
        lines.push(currentLine);
      }
      if (idx < paragraphs.length - 1) {
        lines.push(""); // blank line between paragraphs
      }
    });

    return lines;
  }

  // NEW: Unified Tutorial Modal (replaces all old tutorial UI)
  function renderTutorialModal(ctx, state) {
    // Delegate to the unified modal renderer
    if (window.renderTutorialModal) {
      window.renderTutorialModal(ctx, state);
    }
  }

  /**
   * Render text with markdown-style formatting: **bold**, *italic*, and color tags
   * Color tags: [[keyboard:W]], [[controller:R3]], [[action:Dance]]
   * Returns array of segments with styling info
   */
  function parseFormattedText(text) {
    const segments = [];
    let remaining = text;
    let pos = 0;

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
   * Draw formatted text (supports **bold** and *italic*)
   */
  function drawFormattedText(ctx, text, x, y, baseFont, baseColor = "#050505") {
    const segments = parseFormattedText(text);
    let currentX = x;

    ctx.save();
    segments.forEach((segment) => {
      // Set font style and color
      if (segment.style === "bold") {
        // Increase font weight for bold
        ctx.font = baseFont.replace(/(\d+)/, (match) =>
          String(Math.max(600, parseInt(match)))
        );
        ctx.fillStyle = baseColor;
      } else if (segment.style === "italic") {
        // Add italic style
        ctx.font = baseFont.replace(/(\d+px)/, "$1 italic");
        ctx.fillStyle = baseColor;
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
        ctx.globalAlpha *= 0.92;
      } else {
        ctx.font = baseFont;
        ctx.fillStyle = baseColor;
      }

      ctx.fillText(segment.text, currentX, y);
      currentX += ctx.measureText(segment.text).width;
      ctx.globalAlpha = 1;
    });
    ctx.restore();
  }

  /**
   * Draw text with highlighted keywords
   * Keywords are rendered in their specified color with a subtle glow
   */
  function drawHighlightedText(
    ctx,
    text,
    x,
    y,
    highlightKeywords,
    baseFont = "500 24px 'Inter', system-ui, sans-serif",
    baseColor = "rgba(20, 15, 10, 0.95)"
  ) {
    ctx.save();
    let currentX = x;
    let remaining = text;
    ctx.font = baseFont;

    while (remaining.length > 0) {
      // Find the earliest keyword in remaining text
      let earliestMatch = null;
      let earliestIndex = remaining.length;
      let matchedKeyword = null;

      for (const keyword of Object.keys(highlightKeywords)) {
        const index = remaining.toLowerCase().indexOf(keyword.toLowerCase());
        if (index !== -1 && index < earliestIndex) {
          earliestIndex = index;
          earliestMatch = remaining.substr(index, keyword.length);
          matchedKeyword = keyword;
        }
      }

      if (earliestMatch !== null) {
        // Draw text before the keyword (normal color)
        if (earliestIndex > 0) {
          const beforeText = remaining.substring(0, earliestIndex);
          ctx.fillStyle = baseColor;
          ctx.fillText(beforeText, currentX, y);
          currentX += ctx.measureText(beforeText).width;
        }

        // Draw the keyword (highlighted with glow)
        ctx.save();
        ctx.fillStyle = highlightKeywords[matchedKeyword];
        ctx.shadowColor = highlightKeywords[matchedKeyword];
        ctx.shadowBlur = 12;
        ctx.font = baseFont.replace(/\d+/, (w) =>
          String(Math.max(700, parseInt(w)))
        );
        ctx.fillText(earliestMatch, currentX, y);
        ctx.restore();

        currentX += ctx.measureText(earliestMatch).width;
        remaining = remaining.substring(earliestIndex + earliestMatch.length);
      } else {
        // No more keywords, draw remaining text normally
        ctx.fillStyle = baseColor;
        ctx.fillText(remaining, currentX, y);
        break;
      }
    }

    ctx.restore();
  }

  /**
   * RENDER MATCH SCOREBOARD | Dance-to-Beatmatch-Ratio Leaderboard Integration
   * Displays match statistics with focus on Dance-to-Beatmatch Ratio
   */
  function renderMatchScoreboard(ctx, state) {
    const stats = state.matchStats || [];
    const p1Stats = stats[0] || {};
    const p2Stats = stats[1] || {};
    const theme = getTheme();
    const fontPrimary = theme.typography?.fontPrimary || FONT_PRIMARY_FAMILY;

    // Calculate Dance-to-Beatmatch Ratio
    const calculateRatio = (playerStats) => {
      if (!playerStats || playerStats.danceAttempts <= 0) return 0;
      return Math.round(
        (playerStats.beatmatches / playerStats.danceAttempts) * 100
      );
    };

    const p1Ratio = calculateRatio(p1Stats);
    const p2Ratio = calculateRatio(p2Stats);
    const p1Eligible = (p1Stats.beatmatches || 0) >= 10;
    const p2Eligible = (p2Stats.beatmatches || 0) >= 10;

    // Calculate Air Time percentage
    const p1AirTime =
      p1Stats.totalTicks > 0
        ? Math.round((p1Stats.airTimeTicks / p1Stats.totalTicks) * 100)
        : 0;
    const p2AirTime =
      p2Stats.totalTicks > 0
        ? Math.round((p2Stats.airTimeTicks / p2Stats.totalTicks) * 100)
        : 0;

    // Modal dimensions
    const centerX = ctx.canvas.width / 2;
    const centerY = ctx.canvas.height / 2;
    const boardWidth = 1000;
    const boardHeight = 650;
    const boardX = centerX - boardWidth / 2;
    const boardY = centerY - boardHeight / 2;

    // Background overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Main panel with glass effect
    ctx.save();
    drawRoundedRect(ctx, boardX, boardY, boardWidth, boardHeight, 16);
    ctx.fillStyle = theme.bgGlass || "rgba(18, 18, 18, 0.95)";
    ctx.fill();
    ctx.strokeStyle = theme.palette.strokeSubtle || "rgba(255,255,255,0.25)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Title with glow
    ctx.save();
    ctx.font = `${theme.typography?.weightBold || 700} 48px ${fontPrimary}`;
    ctx.textAlign = "center";
    ctx.fillStyle = theme.palette.textPrimary || "#FFFFFF";
    ctx.shadowBlur = 20;
    ctx.shadowColor = "rgba(150, 150, 255, 0.65)";
    ctx.fillText("MATCH RESULTS", centerX, boardY + 60);
    ctx.shadowBlur = 0;
    ctx.restore();

    // Column layout
    const col1X = boardX + 120;
    const col2X = boardX + 520;
    const statY = boardY + 120;

    // Player headers
    ctx.save();
    ctx.font = `${theme.typography?.weightSemi || 600} 24px ${fontPrimary}`;
    ctx.textAlign = "left";
    ctx.fillStyle = theme.p1Frame || "#00D1FF";
    ctx.fillText("PLAYER 1", col1X, statY);
    ctx.fillStyle = theme.p2Frame || "#FF2E88";
    ctx.fillText("PLAYER 2", col2X, statY);
    ctx.restore();

    // Helper function to draw stat rows
    const drawStatRow = (
      label,
      p1Val,
      p2Val,
      yPos,
      highlightWinner = false
    ) => {
      ctx.font = `500 18px ${fontPrimary}`;
      ctx.fillStyle = theme.palette.textSecondary || "rgba(200,200,200,0.85)";
      ctx.textAlign = "left";
      ctx.fillText(label, col1X, yPos);

      // Determine winner color
      let color1 = theme.palette.textPrimary || "rgba(220,220,220,0.9)";
      let color2 = theme.palette.textPrimary || "rgba(220,220,220,0.9)";

      if (
        highlightWinner &&
        typeof p1Val === "number" &&
        typeof p2Val === "number"
      ) {
        if (p1Val > p2Val) {
          color1 = theme.p1Frame || "#00D1FF";
        } else if (p2Val > p1Val) {
          color2 = theme.p2Frame || "#FF2E88";
        }
      }

      ctx.fillStyle = color1;
      ctx.fillText(String(p1Val), col1X + 180, yPos);
      ctx.fillStyle = color2;
      ctx.fillText(String(p2Val), col2X + 180, yPos);
    };

    // Primary Metric: Dance-to-Beatmatch Ratio (LARGE DISPLAY)
    const yStart = statY + 50;
    ctx.save();
    ctx.font = `${theme.typography?.weightBold || 700} 22px ${fontPrimary}`;
    ctx.fillStyle = theme.palette.accent || "#00D1FF";
    ctx.textAlign = "left";
    ctx.fillText("Dance-to-Beatmatch Ratio", col1X, yStart);
    ctx.restore();

    // Ratio display with color coding
    const getRatioColor = (ratio, eligible) => {
      if (!eligible) return "#999999";
      if (ratio >= 90) return "#7CFB2E"; // Green
      if (ratio >= 70) return "#FFFF00"; // Yellow
      return "#FF4444"; // Red
    };

    ctx.save();
    ctx.font = `${theme.typography?.weightBold || 700} 28px ${fontPrimary}`;
    ctx.textAlign = "left";
    const p1RatioDisplay = p1Eligible ? p1Ratio + "%" : "--";
    const p2RatioDisplay = p2Eligible ? p2Ratio + "%" : "--";
    ctx.fillStyle = getRatioColor(p1Ratio, p1Eligible);
    ctx.fillText(p1RatioDisplay, col1X + 180, yStart);
    ctx.fillStyle = getRatioColor(p2Ratio, p2Eligible);
    ctx.fillText(p2RatioDisplay, col2X + 180, yStart);
    ctx.restore();

    // Detailed stats
    const yStep = 35;
    drawStatRow(
      "Perfect Beatmatches",
      p1Stats.perfectBeats || 0,
      p2Stats.perfectBeats || 0,
      yStart + yStep,
      true
    );
    drawStatRow(
      "Beat-match Attacks",
      p1Stats.beatAttacks || 0,
      p2Stats.beatAttacks || 0,
      yStart + yStep * 2,
      true
    );
    drawStatRow(
      "Damage Dealt",
      Math.round(p1Stats.damageDealt || 0),
      Math.round(p2Stats.damageDealt || 0),
      yStart + yStep * 3,
      true
    );
    drawStatRow(
      "Air Time",
      p1AirTime + "%",
      p2AirTime + "%",
      yStart + yStep * 4,
      true
    );
    drawStatRow(
      "Dance Attempts",
      p1Stats.danceAttempts || 0,
      p2Stats.danceAttempts || 0,
      yStart + yStep * 5,
      false
    );
    drawStatRow(
      "Successful Beatmatches",
      Math.round(p1Stats.beatmatches || 0),
      Math.round(p2Stats.beatmatches || 0),
      yStart + yStep * 6,
      true
    );

    // Eligibility notice
    ctx.save();
    ctx.font = `500 16px ${fontPrimary}`;
    ctx.textAlign = "center";
    if (!p1Eligible && !p2Eligible) {
      ctx.fillStyle = "rgba(255,100,100,0.9)";
      ctx.fillText(
        "⚠ Für Leaderboard-Wertung werden mindestens 10 erfolgreiche Beatmatches benötigt",
        centerX,
        boardY + boardHeight - 140
      );
    } else {
      ctx.fillStyle = "rgba(100,220,100,0.9)";
      ctx.fillText(
        "✓ Eligible für Netlify-Leaderboard-Submission",
        centerX,
        boardY + boardHeight - 140
      );
    }
    ctx.restore();

    // Continue Button
    const buttonY = boardY + boardHeight - 90;
    const buttonWidth = 320;
    const buttonHeight = 56;
    const buttonX = centerX - buttonWidth / 2;
    const buttonRadius = 12;
    const nowSeconds =
      (typeof performance !== "undefined" ? performance.now() : Date.now()) /
      1000;
    const isButtonSelected = state.matchEnd?.scoreboardButtonSelected !== false; // Default to selected
    const confirmColor = theme.palette.roles?.confirm || "#B8E986";

    // Button background with glow effect
    if (isButtonSelected) {
      const pulse = (Math.sin(nowSeconds * 5) + 1) / 2;

      // Gradient background
      const gradient = ctx.createLinearGradient(
        buttonX,
        buttonY,
        buttonX + buttonWidth,
        buttonY + buttonHeight
      );
      gradient.addColorStop(
        0,
        colorWithAlpha(confirmColor, 0.2 + 0.15 * pulse)
      );
      gradient.addColorStop(
        0.5,
        colorWithAlpha("#FFFFFF", 0.08 + 0.08 * pulse)
      );
      gradient.addColorStop(
        1,
        colorWithAlpha(confirmColor, 0.32 + 0.18 * pulse)
      );

      ctx.save();
      drawRoundedRect(
        ctx,
        buttonX,
        buttonY,
        buttonWidth,
        buttonHeight,
        buttonRadius
      );
      ctx.fillStyle = gradient;
      ctx.shadowBlur = (theme.shadows?.buttonGlow ?? 18) + pulse * 14;
      ctx.shadowColor = colorWithAlpha(confirmColor, 0.85);
      ctx.fill();
      ctx.restore();

      // Button border
      ctx.save();
      drawRoundedRect(
        ctx,
        buttonX,
        buttonY,
        buttonWidth,
        buttonHeight,
        buttonRadius
      );
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = colorWithAlpha(confirmColor, 0.7 + 0.25 * pulse);
      ctx.stroke();
      ctx.restore();

      // Side indicators
      const indicatorWidth = 8 + pulse * 6;
      const indicatorHeight = Math.max(buttonHeight - 10, buttonHeight * 0.75);
      const indicatorY = buttonY + (buttonHeight - indicatorHeight) / 2;

      ctx.save();
      ctx.fillStyle = colorWithAlpha(confirmColor, 0.6 + 0.3 * pulse);
      ctx.shadowColor = colorWithAlpha(confirmColor, 0.8);
      ctx.shadowBlur = 8 + pulse * 6;
      ctx.fillRect(
        buttonX - indicatorWidth - 6,
        indicatorY,
        indicatorWidth,
        indicatorHeight
      );
      ctx.fillRect(
        buttonX + buttonWidth + 6,
        indicatorY,
        indicatorWidth,
        indicatorHeight
      );
      ctx.restore();
    } else {
      // Unselected button
      const disabledColor = theme.palette.disabled || "rgba(255,255,255,0.25)";
      ctx.save();
      drawRoundedRect(
        ctx,
        buttonX,
        buttonY,
        buttonWidth,
        buttonHeight,
        buttonRadius
      );
      ctx.fillStyle = colorWithAlpha(disabledColor, 0.2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      drawRoundedRect(
        ctx,
        buttonX,
        buttonY,
        buttonWidth,
        buttonHeight,
        buttonRadius
      );
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = theme.palette.strokeSubtle || "rgba(255,255,255,0.4)";
      ctx.stroke();
      ctx.restore();
    }

    // Button text
    ctx.save();
    ctx.textAlign = "center";
    if (isButtonSelected) {
      const pulse = (Math.sin(nowSeconds * 5) + 1) / 2;
      ctx.fillStyle = theme.palette.textPrimary || "#FFFFFF";
      ctx.shadowColor = colorWithAlpha(confirmColor, 0.4 + 0.4 * pulse);
      ctx.shadowBlur = 12 + pulse * 8;
      ctx.font = `${theme.typography?.weightBold || 700} 22px ${fontPrimary}`;
    } else {
      ctx.fillStyle = theme.palette.textSecondary || "rgba(200,200,200,0.85)";
      ctx.font = `${theme.typography?.weightSemi || 600} 20px ${fontPrimary}`;
    }
    ctx.fillText("Continue to Menu", centerX, buttonY + buttonHeight / 2 + 8);
    ctx.restore();

    // Button hint (which player can press)
    ctx.save();
    ctx.font = `500 12px ${fontPrimary}`;
    ctx.fillStyle = theme.palette.textSecondary || "rgba(200,200,200,0.6)";
    ctx.textAlign = "center";
    ctx.fillText(
      "Press Confirm (A/X) or Enter to continue",
      centerX,
      buttonY + buttonHeight + 20
    );
    ctx.restore();
  }

  return {
    renderTitleScreen,
    renderTitleIntro,
    renderCharacterSelect,
    renderStageSelect,
    renderGameTypeSelect,
    renderGameModeSelect,
    renderDanceBattle,
    renderTutorialModal,
    renderInGameModal,
    renderControlsModal,
    renderMatchScoreboard, // NEW: Dance-to-Beatmatch-Ratio Scoreboard
    setTheme,
    getTheme,
    themes: uiThemes,
    animations: UI_ANIMATIONS,
  };
})();
