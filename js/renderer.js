window.Renderer = (() => {
  let webglRenderer = null;
  let isWebGLInitialized = false;

  // Sprite-Cache f�r Performance-Optimierung
  const spriteCache = new Map();
  const MAX_CACHE_SIZE = 100; // Maximale Anzahl gecachter Sprites

  const PLAYER_OUTLINE_COLORS = [
    {
      rgb: [98, 176, 255],
      stroke: "rgba(98, 176, 255, 1)",
      glow: "rgba(98, 176, 255, 0.85)",
      fill: "rgba(98, 176, 255, 0.18)",
    },
    {
      rgb: [255, 109, 109],
      stroke: "rgba(255, 109, 109, 1)",
      glow: "rgba(255, 109, 109, 0.85)",
      fill: "rgba(255, 109, 109, 0.18)",
    },
    {
      rgb: [154, 107, 255],
      stroke: "rgba(154, 107, 255, 1)",
      glow: "rgba(154, 107, 255, 0.85)",
      fill: "rgba(154, 107, 255, 0.18)",
    },
    {
      rgb: [255, 216, 107],
      stroke: "rgba(255, 216, 107, 1)",
      glow: "rgba(255, 216, 107, 0.85)",
      fill: "rgba(255, 216, 107, 0.18)",
    },
  ];

  // Font-Cache f�r Performance-Optimierung
  // Verhindert unn�tige Font-Set-Operationen die zu Stuttern f�hren
  let currentFont = null;
  let currentTextAlign = null;
  let currentTextBaseline = null;

  /**
   * Set font with caching - only updates context if font actually changed.
   * This prevents expensive font metric recalculations on every frame.
   */
  function setFontCached(
    ctx,
    fontString,
    textAlign = null,
    textBaseline = null
  ) {
    if (currentFont !== fontString) {
      ctx.font = fontString;
      currentFont = fontString;
    }
    if (textAlign !== null && currentTextAlign !== textAlign) {
      ctx.textAlign = textAlign;
      currentTextAlign = textAlign;
    }
    if (textBaseline !== null && currentTextBaseline !== textBaseline) {
      ctx.textBaseline = textBaseline;
      currentTextBaseline = textBaseline;
    }
  }

  /**
   * Warm up font rendering by measuring common text strings.
   * This triggers font metric calculations before gameplay.
   */
  function warmupFonts(ctx) {
    const commonFonts = [
      "bold 16px monospace",
      "bold 20px monospace",
      "bold 24px monospace",
      "bold 32px monospace",
      "bold 48px monospace",
      "12px monospace",
      "14px monospace",
      "16px monospace",
      "20px monospace",
    ];

    const testStrings = [
      "PERFECT",
      "GOOD",
      "jazzy",
      "DANCE INSTRUCTOR",
      "TARANTULA",
      "1234567890",
    ];

    try {
      for (const font of commonFonts) {
        ctx.font = font;
        for (const text of testStrings) {
          // Measure text to trigger font metric calculation
          ctx.measureText(text);
          // Draw to trigger glyph cache
          ctx.fillText(text, -1000, -1000); // Off-screen
        }
      }

      // Reset to default
      ctx.font = "12px monospace";
      currentFont = "12px monospace";
      currentTextAlign = null;
      currentTextBaseline = null;

      console.log("? Font warmup complete");
    } catch (error) {
      console.debug("Font warmup failed (non-critical):", error);
    }
  }

  // Cache-Management-Funktionen
  function getCachedSprite(atlasImage, x, y, w, h, scale) {
    const key = `${atlasImage.src}-${x}-${y}-${w}-${h}-${scale}`;
    return spriteCache.get(key);
  }

  function setCachedSprite(atlasImage, x, y, w, h, scale, canvas) {
    if (spriteCache.size >= MAX_CACHE_SIZE) {
      // Entferne �ltesten Eintrag
      const firstKey = spriteCache.keys().next().value;
      spriteCache.delete(firstKey);
    }
    const key = `${atlasImage.src}-${x}-${y}-${w}-${h}-${scale}`;
    spriteCache.set(key, canvas);
  }

  function render(ctx, state) {
    // Performance monitoring
    if (window.PerformanceMonitor?.isEnabled) {
      window.PerformanceMonitor.startSection("Renderer_Clear");
    }

    // Clear the entire window (viewport)
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    if (window.PerformanceMonitor?.isEnabled) {
      window.PerformanceMonitor.endSection("Renderer_Clear");
    }

    if (!state.viewport) return;

    // Performance monitoring: WebGL initialization check
    if (window.PerformanceMonitor?.isEnabled) {
      window.PerformanceMonitor.startSection("Renderer_WebGLInit");
    }

    // WebGL Renderer should already be initialized during warmup phase
    // Only initialize here as fallback if warmup didn't happen
    if (!isWebGLInitialized && state.webglInitialized) {
      // WebGL was initialized elsewhere (during warmup), just mark as initialized
      isWebGLInitialized = true;
      webglRenderer = WebGLRenderer;
    } else if (!isWebGLInitialized) {
      // Fallback: Initialize WebGL here if warmup didn't happen
      console.warn(
        "?? WebGL initialization in render loop (THIS WILL CAUSE LAG)"
      );
      try {
        webglRenderer = WebGLRenderer;
        if (webglRenderer && webglRenderer.init) {
          webglRenderer.init(ctx.canvas);
          isWebGLInitialized = true;
          console.log("WebGL Renderer initialized (fallback)");
        }
      } catch (error) {
        console.warn("WebGL not available:", error);
      }
    }

    if (window.PerformanceMonitor?.isEnabled) {
      window.PerformanceMonitor.endSection("Renderer_WebGLInit");
    }

    ctx.save();

    // Translate to the letterboxed position
    ctx.translate(state.viewport.x, state.viewport.y);

    // Scale the context to fit the game world into the viewport
    // Use effective native dimensions if device aspect ratio is matched
    const nativeWidth = state.effectiveNativeWidth ?? GameState.CONSTANTS.NATIVE_WIDTH;
    const nativeHeight = state.effectiveNativeHeight ?? GameState.CONSTANTS.NATIVE_HEIGHT;

    // Account for device pixel ratio (canvas is already scaled, so use actual canvas dimensions)
    const dpr = state.devicePixelRatio || window.devicePixelRatio || 1;
    // Canvas internal size already accounts for DPR, so use that for scaling
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    const scaleX = canvasWidth / nativeWidth;
    const scaleY = canvasHeight / nativeHeight;

    // If matching device aspect, use uniform scaling to prevent distortion
    // Otherwise use different scales for letterboxing
    if (state.viewport.matchesDevice) {
      // Use uniform scale (min of X/Y) to maintain proportions
      const uniformScale = Math.min(scaleX, scaleY);
      ctx.scale(uniformScale, uniformScale);
    } else {
      // Use different scales for letterboxing (maintains 16:9)
      ctx.scale(scaleX, scaleY);
    }

    // --- START OF VIRTUAL RESOLUTION DRAWING ---

    // Draw the video background first, so it's behind everything.
    // It's not affected by the camera transforms.
    drawLayer(ctx, state.bgVideo, {
      width: GameState.CONSTANTS.NATIVE_WIDTH,
      height: GameState.CONSTANTS.NATIVE_HEIGHT,
    });

    if (state.camera) {
      // These translations are now in the virtual resolution space
      ctx.save();
      ctx.translate(
        GameState.CONSTANTS.NATIVE_WIDTH / 2,
        GameState.CONSTANTS.NATIVE_HEIGHT / 2
      );
      ctx.scale(state.camera.zoom, state.camera.zoom);

      // NEW: Apply screen shake
      const shakeX = state.shake ? state.shake.x : 0;
      const shakeY = state.shake ? state.shake.y : 0;
      ctx.translate(-(state.camera.x + shakeX), -(state.camera.y + shakeY));
    }

    // Render background (tiles or static)
    if (state.useTiles && state.bgTiles && state.bgTiles.length > 0) {
      drawTiles(ctx, state.bgTiles, state.tileWidth, state.camera);
    } else {
      drawLayer(ctx, state.bg);
    }

    // NEW: Background layer for stage animations (between bg and characters)
    drawLayer(ctx, state.bgLayer);

    // NEW: Render stage animations on bgLayer (only if quality setting allows)
    if (!window.QualityManager || window.QualityManager.getSetting('stageAnimations')) {
      renderStageAnimations(ctx, state);
    }

    // Performance monitoring: Effects
    if (window.PerformanceMonitor?.isEnabled) {
      window.PerformanceMonitor.startSection("Renderer_Effects");
    }

    // NEW: Draw background particles (behind characters)
    drawParticles(ctx, state, "background");

    // FX above characters, below mid
    for (const e of state.effects) {
      drawEffect(ctx, state, e);
    }

    // Characters are between bgLayer and mid
    // (Moved characters rendering here to respect Z-order)
    for (const p of state.players) {
      if (!p.eliminated) drawPlayer(ctx, p, state);
    }

    if (window.PerformanceMonitor?.isEnabled) {
      window.PerformanceMonitor.endSection("Renderer_Players"); // This section name might be confusing now, keeping original name
    }

    // NEW: Draw foreground particles (in front of characters)
    drawParticles(ctx, state, "foreground");

    // Projectiles are also above characters
    for (const proj of state.projectiles) {
      drawProjectile(ctx, state, proj);
    }

    if (window.PerformanceMonitor?.isEnabled) {
      window.PerformanceMonitor.endSection("Renderer_Effects");
    }

    // Render mid layer (tiles or static)
    if (state.useTiles && state.midTiles && state.midTiles.length > 0) {
      drawTiles(ctx, state.midTiles, state.tileWidth, state.camera);
    } else {
      // NEW: Draw mid layer with beat-synchronized technicolor pulse effect
      drawMidLayerWithBeatPulse(ctx, state.mid, state);
    }

    // Wall highlight removed for performance

    // Schneefall zwischen mid und fg rendern (realistisch)
    renderSnowOverlay(ctx, state);

    drawLayer(ctx, state.fg);

    if (state.debug.drawBoxes) {
      drawDebugBoxes(ctx, state);
    }

    // Debug-Modus f�r Sprite-Informationen
    if (state.debug.showSpriteInfo) {
      drawSpriteDebugInfo(ctx, state);
    }

    if (state.camera) {
      ctx.restore();
    }

    // --- END OF VIRTUAL RESOLUTION DRAWING ---

    ctx.restore(); // Restores the state before letterbox transformations

    // Combo text rendering moved back to drawCentralBeatBar for static UI display

    // Performance monitoring: UI rendering
    if (window.PerformanceMonitor?.isEnabled) {
      window.PerformanceMonitor.startSection("Renderer_UI");
    }

    // Ingame UI rendern
    drawIngameUI(ctx, state);

    // Tutorial instruction panel removed - using unified modal system instead

    // WebGL Disco-Ball Licht-Effekt
    applyDiscoBallLight(ctx, state);

    // Screen Flash Effect
    renderScreenFlash(ctx, state);

    // NEW: Match End Visual Effects
    renderMatchEndEffects(ctx, state);

    // NEW: Dance Spot Direction Indicator (when spot is off-screen)
    renderDanceSpotIndicator(ctx, state);

    if (window.PerformanceMonitor?.isEnabled) {
      window.PerformanceMonitor.endSection("Renderer_UI");
    }
  }

  function renderSnowOverlay(ctx, state) {
    // Nur Schneeflocken rendern (ohne andere WebGL-Effekte)
    if (isWebGLInitialized && webglRenderer && webglRenderer.renderSnowOnly) {
      webglRenderer.renderSnowOnly(ctx, state);
    }
  }

  function applyDiscoBallLight(ctx, state) {
    // Initialisiere WebGL Renderer falls noch nicht geschehen
    if (!isWebGLInitialized) {
      if (typeof WebGLRenderer !== "undefined") {
        webglRenderer = WebGLRenderer;

        // Warte bis Canvas bereit ist
        if (ctx.canvas && ctx.canvas.width > 0 && ctx.canvas.height > 0) {
          isWebGLInitialized = webglRenderer.init(ctx.canvas);
          if (isWebGLInitialized) {
            console.log("?? WebGL Disco-Ball Renderer initialized!");
          } else {
            console.warn(
              "?? WebGL initialization failed, trying again next frame..."
            );
          }
        }
      }
    }

    // Nur Disco-Ball Effekte rendern (nach HUD)
    if (
      isWebGLInitialized &&
      webglRenderer &&
      webglRenderer.renderDiscoBallOnly
    ) {
      webglRenderer.renderDiscoBallOnly(ctx, state);
    }

    // Schneefall aktivieren falls noch nicht geschehen (only if quality allows)
    const allowSnow = !window.QualityManager || window.QualityManager.getSetting('snowEnabled');
    if (allowSnow && isWebGLInitialized && webglRenderer && webglRenderer.setSnowEnabled) {
      webglRenderer.setSnowEnabled(true);
    } else if (!allowSnow && webglRenderer && webglRenderer.setSnowEnabled) {
      webglRenderer.setSnowEnabled(false);
    }
  }

  function drawParticles(ctx, state, targetLayer = null) {
    const pm = ParticleManager.instance;
    if (!pm) return;

    for (const p of pm.activeParticles) {
      // NEW: Check Z-Layer
      // If targetLayer is specified, only draw particles that match it.
      // If no targetLayer (legacy), draw everything (or default to foreground).
      // Note: Particles without zLayer default to "foreground" in ParticleSystem.
      const pLayer = p.zLayer || "foreground";
      if (targetLayer && pLayer !== targetLayer) continue;

      // Determine which atlas to use based on animation name
      const isBloodEffect = p.animName && p.animName.startsWith("fx_blood_");
      const isKnockbackEffect =
        p.animName &&
        (p.animName.startsWith("fx_knockback_") ||
          p.animName.startsWith("fx_clank"));

      let atlas;
      if (p.atlas) {
        // Use stored atlas from spawnGlobalEffect
        atlas = p.atlas;
      } else if (isBloodEffect) {
        atlas = state.fxAtlas2;
      } else if (isKnockbackEffect) {
        atlas = state.fxAtlas3;
      } else {
        atlas = state.fxAtlas;
      }

      if (!atlas) continue;

      const anim = atlas.animations[p.animName];
      if (!anim) continue;

      const frameIndex = Math.min(p.frameIndex, anim.length - 1);
      const frameName = anim[frameIndex];
      const f = atlas.frames[frameName];
      if (!f) continue;

      const { x, y, w, h } = f.frame;

      ctx.save();
      // Translate to particle position to handle rotation and scaling from center
      ctx.translate(p.pos.x, p.pos.y);
      ctx.rotate(p.rotation);

      // Support non-uniform scaling for streak effects
      const sX = p.scaleX !== undefined ? p.scaleX : p.scale;
      const sY = p.scaleY !== undefined ? p.scaleY : p.scale;
      ctx.scale(sX, sY);

      ctx.globalAlpha = p.alpha;

      // Draw the image centered
      const texture = atlas.atlasImage?._bitmap || atlas.atlasImage;
      if (!texture) {
        ctx.restore();
        continue;
      }
      ctx.drawImage(texture, x, y, w, h, -w / 2, -h / 2, w, h);

      ctx.restore();
    }

    ctx.globalAlpha = 1.0;
  }

  function drawLayer(ctx, element, dimensions) {
    if (!element) return;

    const source = element._bitmap || element;
    const fallbackWidth =
      element?.width || element?.naturalWidth || source?.width || 0;
    const fallbackHeight =
      element?.height || element?.naturalHeight || source?.height || 0;
    const destWidth = dimensions ? dimensions.width : fallbackWidth;
    const destHeight = dimensions ? dimensions.height : fallbackHeight;

    const isDrawableImage =
      typeof HTMLImageElement !== "undefined" &&
      element instanceof HTMLImageElement;
    const isVideo =
      typeof HTMLVideoElement !== "undefined" &&
      element instanceof HTMLVideoElement;
    const isBitmap =
      typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap;

    if (isDrawableImage || isVideo || isBitmap) {
      ctx.drawImage(source, 0, 0, destWidth, destHeight);
    }
  }

  // NEW: Calculate beat phase (0-1) for beat-synchronized effects
  function getBeatPhase(state) {
    const bpm = state.currentBPM || 117;
    const beatInterval = 60000 / bpm; // ms per beat
    const beatOffset = state?.currentBeatOffset || 0;
    let adjustedMusicTime = 0;

    // Use unified audio-based timing system
    if (AudioSystem && AudioSystem.getMusicTime) {
      const audioTime = AudioSystem.getMusicTime();
      adjustedMusicTime = Math.max(0, audioTime + beatOffset);
    } else {
      // Fallback to system time
      const stageStartTime = state?.stageStartTime || 0;
      const timeSinceStageStart = performance.now() / 1000 - stageStartTime;
      adjustedMusicTime = Math.max(0, timeSinceStageStart * 1000 + beatOffset);
    }

    const timeSinceLastBeat = adjustedMusicTime % beatInterval;
    return timeSinceLastBeat / beatInterval; // 0-1
  }

  // NEW: Draw mid layer with beat-synchronized technicolor pulse effect
  function drawMidLayerWithBeatPulse(ctx, element, state, dimensions) {
    if (!element) return;

    const source = element._bitmap || element;
    const fallbackWidth =
      element?.width || element?.naturalWidth || source?.width || 0;
    const fallbackHeight =
      element?.height || element?.naturalHeight || source?.height || 0;
    const destWidth = dimensions ? dimensions.width : fallbackWidth;
    const destHeight = dimensions ? dimensions.height : fallbackHeight;

    const isDrawableImage =
      typeof HTMLImageElement !== "undefined" &&
      element instanceof HTMLImageElement;
    const isVideo =
      typeof HTMLVideoElement !== "undefined" &&
      element instanceof HTMLVideoElement;
    const isBitmap =
      typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap;

    if (!isDrawableImage && !isVideo && !isBitmap) return;

    // Calculate beat phase for pulse effect
    const beatPhase = getBeatPhase(state);

    // Beat pulse: strongest at beat match point (beatPhase = 0)
    // Create a pulse that peaks at beat match and fades smoothly
    // Use cosine to create a pulse that peaks at 0 and 1 (beat match points)
    const beatPulse = Math.cos(beatPhase * Math.PI * 2);
    const normalizedPulse = beatPulse * 0.5 + 0.5; // 0-1, peaks at beatPhase = 0 and 1

    // Intensity: stronger pulse near beat match (beatPhase close to 0 or 1)
    // Create a sharper peak at beat match for better visual feedback
    const beatMatchProximity = 1.0 - Math.min(beatPhase, 1.0 - beatPhase) * 2.0; // 0-1, peaks at beat match
    const sharpPeak = Math.pow(beatMatchProximity, 0.7); // Sharper peak near beat match
    const pulseIntensity = 0.4 + sharpPeak * 0.5; // 0.4-0.9 intensity range

    // Technicolor effect intensity based on beat pulse
    // Combine normalized pulse with intensity for smooth, beat-synchronized effect
    const technicolorIntensity = normalizedPulse * pulseIntensity;

    ctx.save();

    // Apply technicolor effect using canvas filters and composite operations
    // Chromatic aberration simulation: draw RGB channels with slight offsets
    if (technicolorIntensity > 0.01) {
      // Red channel offset (slight right shift)
      ctx.globalCompositeOperation = "screen";
      ctx.globalAlpha = technicolorIntensity * 0.3;
      ctx.filter = "brightness(1.2) saturate(1.5)";
      ctx.drawImage(
        source,
        1,
        0,
        destWidth,
        destHeight,
        0,
        0,
        destWidth,
        destHeight
      );

      // Blue channel offset (slight left shift)
      ctx.globalAlpha = technicolorIntensity * 0.3;
      ctx.drawImage(
        source,
        -1,
        0,
        destWidth,
        destHeight,
        0,
        0,
        destWidth,
        destHeight
      );

      // Green channel (center, no offset)
      ctx.globalAlpha = technicolorIntensity * 0.2;
      ctx.drawImage(
        source,
        0,
        0,
        destWidth,
        destHeight,
        0,
        0,
        destWidth,
        destHeight
      );

      // Reset composite operation
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1.0;
      ctx.filter = "none";
    }

    // Draw base layer with saturation boost
    if (technicolorIntensity > 0.01) {
      const saturationBoost = 1.0 + technicolorIntensity * 0.5; // Up to 1.5x saturation
      ctx.filter = `saturate(${saturationBoost})`;
    }

    ctx.drawImage(source, 0, 0, destWidth, destHeight);

    ctx.restore();
  }

  // NEW: Draw tiles for scrollable story stages
  function drawTiles(ctx, tiles, tileWidth, camera) {
    if (!tiles || tiles.length === 0 || !tileWidth) return;

    // Calculate view bounds
    const viewWidth = GameState.CONSTANTS.NATIVE_WIDTH / (camera?.zoom || 1);
    const viewHeight = GameState.CONSTANTS.NATIVE_HEIGHT / (camera?.zoom || 1);
    const cameraX = camera?.x || 0;
    const viewLeft = cameraX - viewWidth / 2;
    const viewRight = cameraX + viewWidth / 2;

    // Calculate which tiles are visible
    const firstTileIndex = Math.max(0, Math.floor(viewLeft / tileWidth));
    const lastTileIndex = Math.min(
      tiles.length - 1,
      Math.floor(viewRight / tileWidth)
    );

    // Draw visible tiles
    for (let i = firstTileIndex; i <= lastTileIndex; i++) {
      const tile = tiles[i];
      if (!tile) continue;

      const tileX = i * tileWidth;
      const source = tile._bitmap || tile;
      const tileHeight =
        tile.naturalHeight || tile.height || GameState.CONSTANTS.NATIVE_HEIGHT;

      // Only draw if tile is within view
      if (tileX + tileWidth >= viewLeft && tileX <= viewRight) {
        ctx.drawImage(source, tileX, 0, tileWidth, tileHeight);
      }
    }
  }

  // NEW: Render stage animations on background layer
  function renderStageAnimations(ctx, state) {
    if (!state.stageFxAtlas || !state.stageAnimations) return;

    // Performance monitoring
    if (window.PerformanceMonitor?.isEnabled) {
      window.PerformanceMonitor.startSection("StageAnimations");
    }

    const atlasScaleX = state.stageFxAtlas.sourceScaleX || 1;
    const atlasScaleY = state.stageFxAtlas.sourceScaleY || 1;

    for (const anim of state.stageAnimations) {
      if (anim.done || !anim.frames || anim.frameIndex >= anim.frames.length)
        continue;

      // NEW: Skip dance spot loop animations that are not currently active (only in Dance Mode)
      // Tutorial mode dance spots should always render
      if (
        state.danceMode?.active &&
        anim.anim === "dance_spot_loop" &&
        !state.tutorial?.active
      ) {
        const isActiveSpot = state.danceMode.currentActiveSpot?.effect === anim;
        if (!isActiveSpot) {
          continue; // Skip rendering inactive dance spot loops (only in Dance Mode)
        }
      }

      const frameName = anim.frames[anim.frameIndex];
      const frame = state.stageFxAtlas.frames[frameName];
      if (!frame) continue;

      const atlasImage = state.stageFxAtlas.atlasImage;
      const texture = atlasImage?._bitmap || atlasImage;
      if (!texture) continue;

      // Calculate position with scale
      let x = anim.pos.x + anim.offsetX;
      let y = anim.pos.y + anim.offsetY;
      const baseScale = anim.scale || 1.0;
      let scale = baseScale;

      // NEW: Dance Mode Active Spot Pulsing Effect (only during perfect beat window)
      if (
        state.danceMode?.active &&
        state.danceMode.currentActiveSpot &&
        anim.anim === "dance_spot_loop"
      ) {
        const isActiveSpot = state.danceMode.currentActiveSpot.effect === anim;
        if (isActiveSpot) {
          // Check if we're in the perfect beat window
          const BPM = state.currentBPM || 117;
          const BEAT_INTERVAL = 60000 / BPM;
          const beatOffset = state.currentBeatOffset || 0;
          const PERFECT_WINDOW = BEAT_INTERVAL * 0.24; // 18% of beat interval for perfect window (20% gr��er)

          let adjustedTime = 0;
          let audioTime = 0;
          if (AudioSystem && AudioSystem.getMusicTime) {
            audioTime = AudioSystem.getMusicTime() || 0;
          }
          if (audioTime > 0) {
            adjustedTime = Math.max(0, audioTime + beatOffset);
          } else {
            const stageStartTime = state.stageStartTime || 0;
            const timeSinceStageStart =
              performance.now() / 1000 - stageStartTime;
            adjustedTime = Math.max(0, timeSinceStageStart * 1000 + beatOffset);
          }

          const timeSinceLastBeat = adjustedTime % BEAT_INTERVAL;

          // Only pulse during perfect beat window (first 18% of beat)
          if (timeSinceLastBeat <= PERFECT_WINDOW) {
            const windowProgress = timeSinceLastBeat / PERFECT_WINDOW; // 0-1

            // Subtle pulse from 1.0 to 1.05 and back (5% size change)
            const pulseScale = 1.0 + Math.sin(windowProgress * Math.PI) * 0.05;
            scale *= pulseScale;

            // Adjust position to keep center point fixed
            const baseWidth = frame.frame.w * baseScale * atlasScaleX;
            const baseHeight = frame.frame.h * baseScale * atlasScaleY;
            const centerX = x + baseWidth / 2;
            const centerY = y + baseHeight / 2;
            const scaledWidth = frame.frame.w * scale * atlasScaleX;
            const scaledHeight = frame.frame.h * scale * atlasScaleY;
            x = centerX - scaledWidth / 2;
            y = centerY - scaledHeight / 2;
          }
        }
      }

      // NEW: Dance Battle Phase - 4-Beat-Cycle scaling
      if (state.danceBattle && state.danceBattle.active) {
        // Calculate current beat position in 4-beat cycle
        const BPM = state.currentBPM || 117;
        const BEAT_INTERVAL = 60000 / BPM;
        const beatOffset = state.currentBeatOffset || 0;

        let adjustedTime = 0;
        let audioTime = 0;
        if (AudioSystem && AudioSystem.getMusicTime) {
          audioTime = AudioSystem.getMusicTime() || 0;
        }
        if (audioTime > 0) {
          adjustedTime = Math.max(0, audioTime + beatOffset);
        } else {
          const stageStartTime = state.stageStartTime || 0;
          const timeSinceStageStart = performance.now() / 1000 - stageStartTime;
          adjustedTime = Math.max(0, timeSinceStageStart * 1000 + beatOffset);
        }

        const beatNumber = Math.floor(adjustedTime / BEAT_INTERVAL);
        const beatInCycle = beatNumber % 4; // 0, 1, 2, 3 (4-Beat-Zyklus)

        let danceBattleScaleMultiplier = 1.0;

        // 4-Beat-Pattern:
        // Beat 0 (1. Beat): 10% gr��er (Beatmatch-Fenster)
        // Beat 1 (2. Beat): Normale Gr��e
        // Beat 2 (3. Beat): 5% gr��er (Vorank�ndigung)
        // Beat 3 (4. Beat): Normale Gr��e
        switch (beatInCycle) {
          case 0: // Beat 1 - Beatmatch-Fenster
            danceBattleScaleMultiplier = 1.1; // 10% gr��er
            break;
          case 1: // Beat 2
            danceBattleScaleMultiplier = 1.0; // Normale Gr��e
            break;
          case 2: // Beat 3 - Vorank�ndigung
            danceBattleScaleMultiplier = 1.05; // 5% gr��er
            break;
          case 3: // Beat 4
            danceBattleScaleMultiplier = 1.0; // Normale Gr��e
            break;
        }

        // Apply dance battle scaling
        scale *= danceBattleScaleMultiplier;

        // Adjust position to keep center point fixed (scale from center)
        const baseWidth = frame.frame.w * baseScale * atlasScaleX;
        const baseHeight = frame.frame.h * baseScale * atlasScaleY;
        const centerX = x + baseWidth / 2;
        const centerY = y + baseHeight / 2;
        const scaledWidth = frame.frame.w * scale * atlasScaleX;
        const scaledHeight = frame.frame.h * scale * atlasScaleY;
        x = centerX - scaledWidth / 2;
        y = centerY - scaledHeight / 2;
      }

      const w = frame.frame.w * scale * atlasScaleX;
      const h = frame.frame.h * scale * atlasScaleY;

      // Draw the frame
      const srcX = frame.frame.x * atlasScaleX;
      const srcY = frame.frame.y * atlasScaleY;
      const srcW = frame.frame.w * atlasScaleX;
      const srcH = frame.frame.h * atlasScaleY;

      ctx.drawImage(texture, srcX, srcY, srcW, srcH, x, y, w, h);
    }

    if (state.danceMode?.active) {
      renderDanceSpotIndicators(ctx, state);
    }

    if (window.PerformanceMonitor?.isEnabled) {
      window.PerformanceMonitor.endSection("StageAnimations");
    }
  }

  function renderDanceSpotIndicators(ctx, state) {
    const spot = state.danceMode?.currentActiveSpot;
    if (!spot?.pos) return;

    const intensities = spot.playerIntensities || {};
    const centerX = spot.pos.x;
    const centerY = spot.pos.y;
    const beatPhase = getBeatPhase(state);
    const beatPulse = Math.sin(beatPhase * Math.PI * 2);
    const pulseFactor = 1 + beatPulse * 0.04;

    // Dance Zone Constants (matching dance-spot-manager.js)
    const MIN_FADE_DISTANCE = 150; // Inner radius - max volume zone
    const MAX_FADE_DISTANCE = 600; // Outer radius - silent zone

    // Check if we're in the perfect beat window
    const BPM = state.currentBPM || 117;
    const BEAT_INTERVAL = 60000 / BPM;
    const beatOffset = state.currentBeatOffset || 0;
    const PERFECT_WINDOW = BEAT_INTERVAL * 0.24; // 24% of beat interval for perfect window

    let adjustedTime = 0;
    let audioTime = 0;
    if (window.AudioSystem && window.AudioSystem.getMusicTime) {
      audioTime = window.AudioSystem.getMusicTime() || 0;
    }
    if (audioTime > 0) {
      adjustedTime = Math.max(0, audioTime + beatOffset);
    } else {
      const stageStartTime = state.stageStartTime || 0;
      const timeSinceStageStart = performance.now() / 1000 - stageStartTime;
      adjustedTime = Math.max(0, timeSinceStageStart * 1000 + beatOffset);
    }

    const timeSinceLastBeat = adjustedTime % BEAT_INTERVAL;
    const isInBeatWindow =
      timeSinceLastBeat < PERFECT_WINDOW ||
      timeSinceLastBeat > BEAT_INTERVAL - PERFECT_WINDOW;

    const rings = state.players.map((_, index) => ({
      playerIndex: index,
      baseRadius: 110 + index * 60,
      baseWidth: 5 + index * 1.5,
    }));

    ctx.save();
    ctx.globalCompositeOperation = "lighter";

    // 1. INNER RINGS (DanceBot-Ringe)
    for (const ring of rings) {
      const intensity = Math.max(
        0,
        Math.min(1, intensities[ring.playerIndex] || 0)
      );

      // Blue Ring (P1, index 0): Only visible during beat window
      // Red Ring (P2, index 1): Always visible for orientation
      if (ring.playerIndex === 0 && !isInBeatWindow) {
        continue; // Skip blue ring when not in beat window
      }

      // Use minimum visibility when no player is nearby, scale up with intensity
      const minAlpha = 0.15; // Minimum alpha when no player nearby
      const maxAlpha = 0.45; // Maximum alpha when player is in zone
      const effectiveIntensity = Math.max(0.1, intensity); // Ensure minimum visibility

      const palette =
        PLAYER_OUTLINE_COLORS[ring.playerIndex % PLAYER_OUTLINE_COLORS.length];
      const rgb = palette.rgb || [255, 255, 255];
      const auraInner = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${
        minAlpha + (maxAlpha - minAlpha) * effectiveIntensity
      })`;
      const auraOuter = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0)`;
      const radius = (ring.baseRadius + effectiveIntensity * 32) * pulseFactor;

      const gradient = ctx.createRadialGradient(
        centerX,
        centerY,
        Math.max(10, radius * 0.3),
        centerX,
        centerY,
        radius
      );
      gradient.addColorStop(0, auraInner);
      gradient.addColorStop(1, auraOuter);

      ctx.globalAlpha = minAlpha + (maxAlpha - minAlpha) * effectiveIntensity;
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalAlpha = 0.3 + 0.5 * effectiveIntensity;
      ctx.lineWidth = ring.baseWidth + effectiveIntensity * 4;
      ctx.strokeStyle = palette.stroke;
      ctx.shadowColor = palette.glow;
      ctx.shadowBlur = 20 + effectiveIntensity * 40;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 2. OUTER RING - Boundary at MAX_FADE_DISTANCE (600px)
    // This marks the boundary between "beatmatch with low bonuses possible" and "no beatmatch possible"
    // Pulsates with beat like the other rings
    ctx.globalCompositeOperation = "source-over"; // Change blend mode for outer ring
    const outerRingPulse = Math.abs(beatPulse); // Use absolute value for pulsing effect
    const outerRingRadius = MAX_FADE_DISTANCE * (1 + outerRingPulse * 0.02); // 2% pulse
    ctx.globalAlpha = 0.4 + outerRingPulse * 0.2; // Pulse alpha between 0.4 and 0.6
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.lineWidth = 3 + outerRingPulse * 1; // Pulse line width between 3 and 4
    ctx.shadowColor = "rgba(255, 255, 255, 0.3)";
    ctx.shadowBlur = 8 + outerRingPulse * 4; // Pulse shadow blur between 8 and 12
    ctx.setLineDash([8, 4]); // Dashed line for boundary
    ctx.beginPath();
    ctx.arc(centerX, centerY, outerRingRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]); // Reset line dash

    ctx.restore();
  }

  function drawPlayer(ctx, p, state) {
    if (!p.anim || !p.frames) return;
    if (p.eliminated) return;

    const charData = state.characterConfigs[p.charName];
    if (!charData) {
      console.error(`[drawPlayer] Character config missing for ${p.charName}`);
      return;
    }
    const atlasTexture = charData.atlasImage?._bitmap || charData.atlasImage;
    if (!atlasTexture) {
      console.error(`[drawPlayer] Atlas image not loaded for ${p.charName}`);
      return;
    }

    // Check for Cyboard Ultimate reverse animation
    if (p.ultiReverseAnim && !p.ultiReverseAnim.finished) {
      // Render reverse animation frames
      const currentFrameName =
        p.ultiReverseAnim.frames[p.ultiReverseAnim.currentFrame];
      if (currentFrameName && charData.frames[currentFrameName]) {
        const frame = charData.frames[currentFrameName];
        const { x, y, w, h } = frame.frame;

        let scale = 0.75;
        if (p.charName === "cyboard") {
          scale = 0.75; // Default Cyboard scale
        }

        const scaledW = w * scale;
        const scaledH = h * scale;
        const drawX = p.pos.x - scaledW / 2;
        const drawY = p.pos.y - scaledH;

        ctx.save();
        const shouldFlip = p.facing === -1;
        if (shouldFlip) {
          ctx.translate(drawX + scaledW, drawY);
          ctx.scale(-1, 1);
          ctx.drawImage(atlasTexture, x, y, w, h, 0, 0, scaledW, scaledH);
        } else {
          ctx.drawImage(
            atlasTexture,
            x,
            y,
            w,
            h,
            drawX,
            drawY,
            scaledW,
            scaledH
          );
        }
        ctx.restore();
      }
      return; // Don't render normal animation while reverse anim is playing
    }

    // Frame-Index-Validierung
    if (p.frameIndex < 0 || p.frameIndex >= p.frames.length) {
      console.warn(
        `[drawPlayer] Invalid frameIndex ${p.frameIndex} for ${p.charName}, clamping to valid range`
      );
      p.frameIndex = Math.max(0, Math.min(p.frameIndex, p.frames.length - 1));
    }

    const frameData = p.frames[p.frameIndex];
    const frameName =
      typeof frameData === "object" ? frameData.frame : frameData;
    const frame = charData.frames[frameName];
    if (!frame) {
      // Fallback auf ersten Frame der Animation
      const fallbackFrameName = p.frames[0];
      const fallbackFrame = charData.frames[fallbackFrameName];
      if (fallbackFrame) {
        console.warn(
          `[drawPlayer] Frame ${frameName} missing for ${p.charName}, using fallback frame`
        );
        // Verwende fallbackFrame f�r das Rendering
        const { x, y, w, h } = fallbackFrame.frame;
        // Setze die Variablen f�r das normale Rendering
        frame = fallbackFrame;
      } else {
        console.error(
          `[drawPlayer] No fallback frame available for ${p.charName}`
        );
        return;
      }
    }

    if (p.anim === "wallslide_loop") {
      const wallslideRenderTag = `${frameName}:${p.frameIndex}`;
      if (p._debugRenderWallslideFrame !== wallslideRenderTag) {
        p._debugRenderWallslideFrame = wallslideRenderTag;
        console.log(
          `[Wallslide Render] ${p.charName} frame=${frameName} index=${
            p.frameIndex
          }/${p.frames.length - 1} pos=(${p.pos.x.toFixed(
            1
          )}, ${p.pos.y.toFixed(1)}) facing=${p.facing}`
        );
      }
    } else if (p._debugRenderWallslideFrame) {
      delete p._debugRenderWallslideFrame;
    }

    const { x, y, w, h } = frame.frame;

    // NEW: Support for frame-specific offsets (for HP dance_c/d dance with special positioning)
    const frameOffsetX =
      typeof frameData === "object" && frameData.offsetX
        ? frameData.offsetX
        : 0;
    const frameOffsetY =
      typeof frameData === "object" && frameData.offsetY
        ? frameData.offsetY
        : 0;

    let scale = 0.75;
    if (p.charName === "fritz") {
      scale = 0.6; // 20% smaller
    } else if (p.charName.toLowerCase() === "hp") {
      scale = 0.675; // 10% smaller
    }

    let shakeX = 0;
    let shakeY = 0;
    if (p.isGrabbed) {
      const shakeIntensity = 4; // Pixels of shake
      shakeX = (Math.random() - 0.5) * 2 * shakeIntensity;
      shakeY = (Math.random() - 0.5) * 2 * shakeIntensity;
    }

    const scaledW = w * scale;
    const scaledH = h * scale;
    let drawX = p.pos.x - scaledW / 2 + shakeX + frameOffsetX;
    let drawY = p.pos.y - scaledH + shakeY + frameOffsetY;

    const resolvedIndex =
      typeof p.padIndex === "number" && p.padIndex >= 0
        ? p.padIndex
        : state.players.indexOf(p);
    const playerIndex = resolvedIndex >= 0 ? resolvedIndex : 0;

    if (
      p.charName?.toLowerCase?.() === "hp" &&
      p.attack?.type === "r1" &&
      p.attack?.phase === "release" &&
      typeof p.frameIndex === "number"
    ) {
      const r1Config =
        window.CharacterCatalog?.getAttackConfig("hp", state)?.r1 || {};
      const dashFrames = Array.isArray(r1Config.releaseDashFrames)
        ? r1Config.releaseDashFrames
        : [];
      const rawImpactFrame =
        dashFrames.length > 0
          ? Math.min(...dashFrames)
          : r1Config.releaseKnockbackFrame ?? 0;
      const impactFrame = Math.max(0, rawImpactFrame - 1);
      const currentFrame = p.frameIndex | 0;
      const frameOffsetIndex = Math.max(0, currentFrame - impactFrame);

      const chargeT =
        typeof p.attack?.finalChargeT === "number"
          ? p.attack.finalChargeT
          : typeof p.attack?.chargeT === "number"
          ? p.attack.chargeT
          : 0;
      const descriptor = window.AttackCatalog?.getDescriptor?.(p, "r1") || {
        maxCharge: 2.0,
      };
      const maxCharge = descriptor?.maxCharge ?? 2.0;
      const chargeRatio = Math.max(
        0,
        Math.min(1, maxCharge ? chargeT / maxCharge : 0)
      );
      const scaleMultiplier = 1 + 0.6 * chargeRatio;

      const baseOffsets = [-100, -60, -30, 0];
      let offsetY = 0;
      if (currentFrame >= impactFrame) {
        const baseIndex =
          frameOffsetIndex < baseOffsets.length
            ? frameOffsetIndex
            : baseOffsets.length - 1;
        const baseOffset =
          baseIndex >= 0 ? baseOffsets[baseIndex] : baseOffsets[0];
        offsetY = Math.round(baseOffset * scaleMultiplier);
        if (frameOffsetIndex >= baseOffsets.length) {
          offsetY = 0;
        }
      }

      const offsetX = currentFrame >= impactFrame ? 5 : 0;
      const directionalOffsetX = p.facing === 1 ? offsetX : -offsetX;

      drawX += directionalOffsetX;
      drawY += offsetY;

      const debugState = window.state || state;
      if (debugState?.debug?.devMode) {
        console.log("[drawPlayer] HP R1 release sprite offset", {
          frameIndex: currentFrame,
          impactFrame,
          rawImpactFrame,
          chargeT,
          maxCharge,
          chargeRatio,
          offsetX: directionalOffsetX,
          offsetY,
          drawX,
          drawY,
        });
      }
    }

    // NEW: Drop Shadow Rendering (vor dem normalen Sprite)
    if (p.grounded || p.vel.y < 0) {
      // Nur wenn am Boden oder fallend
      ctx.save();

      // Schatten-Parameter (konfigurierbar)
      const shadowConfig = {
        color: "rgba(0, 0, 0, 0.3)",
        blur: 6,
        offsetX: 4,
        offsetY: 4,
      };

      ctx.shadowColor = shadowConfig.color;
      ctx.shadowBlur = shadowConfig.blur;
      ctx.shadowOffsetX = shadowConfig.offsetX;
      ctx.shadowOffsetY = shadowConfig.offsetY;

      // Schatten rendern (gleicher Sprite wie Character)
      const shouldFlipShadow =
        p.facing === -1 &&
        !(p.charName === "fritz" && p.anim.startsWith("l2_"));
      if (shouldFlipShadow) {
        ctx.translate(drawX + scaledW, drawY);
        ctx.scale(-1, 1);
        ctx.drawImage(atlasTexture, x, y, w, h, 0, 0, scaledW, scaledH);
      } else {
        ctx.drawImage(atlasTexture, x, y, w, h, drawX, drawY, scaledW, scaledH);
      }

      ctx.restore();
    }

    ctx.save();

    // NEW: Apply Dance Mode Visual Feedback (Desaturation + Bloom)
    // Only apply if Dance Mode is active and values are present
    if (state.danceMode?.active && typeof p.danceZoneSaturation === "number") {
      const sat = Math.max(0, Math.min(1, p.danceZoneSaturation));

      // 1. Desaturation
      if (sat < 0.99) {
        // Convert to percentage string to avoid scientific notation issues
        ctx.filter = `saturate(${Math.floor(sat * 100)}%)`;
      }

      // 2. Bloom (Glow based on intensity - works everywhere, not just center)
      const intensity = Math.max(0, Math.min(1, p.danceZoneIntensity || 0));
      if (intensity > 0.05) {
        // Add brightness for bloom core
        const brightness = 1.0 + intensity * 0.5; // Up to 1.5x brightness
        if (ctx.filter && ctx.filter !== "none") {
          ctx.filter += ` brightness(${Math.floor(brightness * 100)}%)`;
        } else {
          ctx.filter = `brightness(${Math.floor(brightness * 100)}%)`;
        }

        // Add glow via shadow
        ctx.shadowColor = "rgba(255, 255, 255, 0.6)"; // White glow
        ctx.shadowBlur = 15 * intensity; // Variable blur radius based on intensity
        // shadowOffset 0 to center the glow
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }
    }

    const shouldFlip =
      p.facing === -1 && !(p.charName === "fritz" && p.anim.startsWith("l2_"));
    if (shouldFlip) {
      ctx.translate(drawX + scaledW, drawY);
      ctx.scale(-1, 1);
      ctx.drawImage(atlasTexture, x, y, w, h, 0, 0, scaledW, scaledH);
    } else {
      ctx.drawImage(atlasTexture, x, y, w, h, drawX, drawY, scaledW, scaledH);
    }
    ctx.restore();

    // --- Special rendering for Fritz's L2 ---
    if (p.charName === "fritz" && p.anim === "l2_release") {
      drawFritzL2Side("l2_release_left", -1);
      drawFritzL2Side("l2_release_right", 1);
    }

    // --- Special rendering for Fritz's L1 Smash Max Charge ---
    if (p.charName === "fritz" && p.anim === "l1_smash_release_max") {
      drawFritzL1SmashMax();
    }

    function drawFritzL1SmashMax() {
      // Render the max charge effect with forward movement
      const animFrames = charData.animations["l1_smash_release_max"];
      if (!animFrames || p.frameIndex >= animFrames.length) return;

      const frameName = animFrames[p.frameIndex];
      const smashFrame = charData.frames[frameName];
      if (!smashFrame) return;

      const { x, y, w, h } = smashFrame.frame;
      const scaledW = w * scale;
      const scaledH = h * scale;

      // Progressive forward offset based on animation progress
      const progress = p.frameIndex / (animFrames.length - 1); // 0 to 1
      const forwardOffset = progress * 80 * p.facing; // Moves 80 pixels forward

      // Position in front of character, facing direction
      const effectDrawX = p.pos.x - scaledW / 2 + forwardOffset;
      const effectDrawY = p.pos.y - scaledH;

      ctx.save();
      ctx.globalAlpha = 0.95;

      // Flip sprite based on facing direction
      const shouldFlip = p.facing === -1;
      if (shouldFlip) {
        ctx.translate(effectDrawX + scaledW, effectDrawY);
        ctx.scale(-1, 1);
        ctx.drawImage(atlasTexture, x, y, w, h, 0, 0, scaledW, scaledH);
      } else {
        ctx.drawImage(
          atlasTexture,
          x,
          y,
          w,
          h,
          effectDrawX,
          effectDrawY,
          scaledW,
          scaledH
        );
      }
      ctx.restore();
    }

    function drawFritzL2Side(animName, direction) {
      const animFrames = charData.animations[animName];
      if (!animFrames || p.frameIndex >= animFrames.length) return;

      const frameData = animFrames[p.frameIndex];
      const frameName =
        typeof frameData === "object" ? frameData.frame : frameData;
      const sideFrame = charData.frames[frameName];
      if (!sideFrame) return;

      const { x, y, w, h } = sideFrame.frame;
      const scaledW = w * scale; // Use the same character-specific scale
      const scaledH = h * scale; // Use the same character-specific scale
      const sideDrawX = p.pos.x - scaledW / 2 + 256 * scale * direction;
      const sideDrawY = p.pos.y - scaledH;

      ctx.save();
      // These side effects should never be flipped based on player facing direction.
      ctx.drawImage(
        atlasTexture,
        x,
        y,
        w,
        h,
        sideDrawX,
        sideDrawY,
        scaledW,
        scaledH
      );
      ctx.restore();
    }
    // --- End special rendering ---

    // Draw charge FX overlay if it exists
    if (p.chargeFx && state.fxAtlas) {
      const fxData = state.fxAtlas;
      const anim = fxData.animations[p.chargeFx.name];
      if (anim) {
        const frameName = anim[p.chargeFx.frameIndex || 0];
        const f = fxData.frames[frameName];
        if (f) {
          const { x, y, w, h } = f.frame;
          // Draw centered on the player
          const drawX = p.pos.x - w / 2;
          const drawY = p.pos.y - h;
          ctx.globalAlpha = 0.8;
          ctx.drawImage(fxData.atlasImage, x, y, w, h, drawX, drawY, w, h);
          ctx.globalAlpha = 1.0;
        }
      }
    }

    // --- NEW: BEAT CHARGE GLOW (Visual Feedback) ---
    // Renders an additive glow effect based on perfect beat count
    // REMOVED: User requested to use only particle effects for beat charge, no static aura.
    /*
    if (p.perfectBeatCount && p.perfectBeatCount > 0) {
      // ... (Previous glow rendering logic removed) ...
    }
    */
    // --------------------------------------------------
  }

  function getHurtbox(p) {
    let w = 120,
      h = 170; // Default values

    switch (p.charName) {
      case "cyboard":
        w = 80;
        h = 134;
        break;
      case "fritz":
        w = 96;
        h = 142;
        break;
      case "HP":
      case "hp":
      case "ernst":
        w = 96;
        h = 150;
        break;
    }
    // Shrink hurtbox uniformly by 10% (user requested)
    const SHRINK_FACTOR = 0.9;
    w = Math.round(w * SHRINK_FACTOR);
    h = Math.round(h * SHRINK_FACTOR);

    return {
      w,
      h,
      left: Math.round(p.pos.x - w / 2),
      top: Math.round(p.pos.y - h),
    };
  }

  // Clamp an attack hitbox's height so it never exceeds the character's hurtbox height.
  // Preserves the bottom edge of the hitbox (moves top down when clamping).
  function clampHitboxHeightToHurtbox(p, hitbox) {
    if (!hitbox || typeof hitbox.h !== "number") return hitbox;
    const hb = getHurtbox(p);
    if (!hb) return hitbox;
    if (hitbox.h > hb.h) {
      const excess = hitbox.h - hb.h;
      hitbox.h = hb.h;
      hitbox.top = (hitbox.top + excess) | 0;
    }
    return hitbox;
  }

  function getR1Hitbox(p, state) {
    const frameData = p.frames[p.frameIndex | 0];
    const frameName =
      typeof frameData === "object" ? frameData.frame : frameData;
    const charData = state.characterConfigs[p.charName];
    const f = charData.frames[frameName];
    const w = 100,
      h = 200;
    if (!f)
      return clampHitboxHeightToHurtbox(p, {
        w,
        h,
        left: (p.pos.x - w / 2) | 0,
        top: (p.pos.y - h) | 0,
      });

    const { w: fw, h: fh } = f.frame;
    const baseLeft = p.pos.x - (fw * 0.75) / 2;
    const baseTop = p.pos.y - fh * 0.75;

    let left = p.facing === 1 ? baseLeft + fw * 0.75 - w : baseLeft;
    const top = baseTop + fh * 0.75 - h;
    const baseRect = clampHitboxHeightToHurtbox(p, {
      w,
      h,
      left: left | 0,
      top: top | 0,
    });

    if (
      p?.attack?.type === "r1" &&
      p?.attack?.phase === "release" &&
      typeof p.frameIndex === "number" &&
      p.charName?.toLowerCase?.() === "hp"
    ) {
      const r1Config =
        window.CharacterCatalog?.getAttackConfig("hp", state)?.r1 || {};
      const dashFrames = Array.isArray(r1Config.releaseDashFrames)
        ? r1Config.releaseDashFrames
        : [];
      const rawImpactFrame =
        dashFrames.length > 0
          ? Math.min(...dashFrames)
          : r1Config.releaseKnockbackFrame ?? 0;
      const impactFrame = Math.max(0, rawImpactFrame - 1); // Convert to zero-based index
      const currentFrame = p.frameIndex | 0;
      const frameOffsetIndex = Math.max(0, currentFrame - impactFrame);

      const chargeT =
        typeof p.attack?.finalChargeT === "number"
          ? p.attack.finalChargeT
          : typeof p.attack?.chargeT === "number"
          ? p.attack.chargeT
          : 0;
      const descriptor = window.AttackCatalog?.getDescriptor?.(p, "r1") || {
        maxCharge: 2.0,
      };
      const maxCharge = descriptor?.maxCharge ?? 2.0;
      const chargeRatio = Math.max(
        0,
        Math.min(1, maxCharge ? chargeT / maxCharge : 0)
      );
      const scaleMultiplier = 1 + 0.6 * chargeRatio;

      const baseOffsets = [-100, -60, -30, -10];
      let offsetY = 0;
      if (currentFrame >= impactFrame) {
        const baseIndex =
          frameOffsetIndex < baseOffsets.length
            ? frameOffsetIndex
            : baseOffsets.length - 1;
        const baseOffset =
          baseIndex >= 0 ? baseOffsets[baseIndex] : baseOffsets[0];
        offsetY = Math.round(baseOffset * scaleMultiplier);
        if (frameOffsetIndex >= baseOffsets.length) {
          offsetY = 0;
        }
      }

      const offsetX = currentFrame >= impactFrame ? 5 : 0;
      const directionalOffsetX = p.facing === 1 ? offsetX : -offsetX;

      baseRect.left = Math.round((baseRect.left || 0) + directionalOffsetX);
      baseRect.top = Math.round((baseRect.top || 0) + offsetY);

      const debugState = window.state || state;
      if (debugState?.debug?.devMode) {
        console.log("[Renderer.getR1Hitbox] HP R1 release offset", {
          frameIndex: currentFrame,
          impactFrame,
          rawImpactFrame,
          chargeT,
          maxCharge,
          chargeRatio,
          offsetX: directionalOffsetX,
          offsetY,
          baseLeft: baseRect.left,
          baseTop: baseRect.top,
        });
      }
    }

    return baseRect;
  }

  function getR2Hitbox(p, state) {
    const frameData = p.frames[p.frameIndex | 0];
    const frameName =
      typeof frameData === "object" ? frameData.frame : frameData;
    const charData = state.characterConfigs[p.charName];
    const f = charData.frames[frameName];
    const w = 150,
      h = 250; // Larger hitbox for R2
    if (!f)
      return clampHitboxHeightToHurtbox(p, {
        w,
        h,
        left: (p.pos.x - w / 2) | 0,
        top: (p.pos.y - h) | 0,
      });

    const { w: fw, h: fh } = f.frame;
    const baseLeft = p.pos.x - (fw * 0.75) / 2;
    const baseTop = p.pos.y - fh * 0.75;

    let left = p.facing === 1 ? baseLeft + fw * 0.75 - w : baseLeft;
    const top = baseTop + fh * 0.75 - h;
    return clampHitboxHeightToHurtbox(p, {
      w,
      h,
      left: left | 0,
      top: top | 0,
    });
  }

  function getR2ComboHitbox(p, state) {
    const frameData = p.frames[p.frameIndex | 0];
    const frameName =
      typeof frameData === "object" ? frameData.frame : frameData;
    const charData = state.characterConfigs[p.charName];
    const f = charData.frames[frameName];
    const w = 120,
      h = 220; // A bit taller than R1
    if (!f)
      return clampHitboxHeightToHurtbox(p, {
        w,
        h,
        left: (p.pos.x - w / 2) | 0,
        top: (p.pos.y - h) | 0,
      });

    const { w: fw, h: fh } = f.frame;
    const baseLeft = p.pos.x - (fw * 0.75) / 2;
    const baseTop = p.pos.y - fh * 0.75;

    // This hitbox is centered more on the player
    let left = baseLeft + ((fw * 0.75 - w) / 2) * p.facing;
    const top = baseTop;
    return clampHitboxHeightToHurtbox(p, {
      w,
      h,
      left: left | 0,
      top: top | 0,
    });
  }

  function getR1JumpHitbox(p) {
    const w = 120,
      h = 100;
    // Hitbox is positioned forward and slightly below the player
    const left = p.facing === 1 ? p.pos.x : p.pos.x - w;
    const top = p.pos.y - h / 2;
    return clampHitboxHeightToHurtbox(p, {
      w,
      h,
      left: left | 0,
      top: top | 0,
    });
  }

  function getR1DashHitbox(p) {
    const hb = getHurtbox(p);
    const hurtboxWidth = hb?.w ?? 100;
    const hurtboxHeight = hb?.h ?? 150;

    // Keep the dash hitbox wider than the hurtbox, but not excessively so
    const w = Math.max(130, Math.round(hurtboxWidth + 50));
    // Limit vertical size so it roughly hugs the torso during the dash
    const h = Math.min(110, Math.round(hurtboxHeight * 0.65));

    // Offset the box slightly forward, but keep most of it overlapping the player
    const forwardOffset = Math.max(24, Math.round(hurtboxWidth * 0.25));
    const leftBase = p.pos.x - w / 2;
    const left =
      p.facing === 1 ? leftBase + forwardOffset : leftBase - forwardOffset;
    const top = p.pos.y - h;
    return clampHitboxHeightToHurtbox(p, {
      w,
      h,
      left: left | 0,
      top: top | 0,
    });
  }

  function getR1CircleHitbox(p) {
    const w = 160;
    const h = 100;
    const offsetX = 10;
    const left = p.facing === 1 ? p.pos.x + offsetX : p.pos.x - w - offsetX;
    const top = p.pos.y - h;
    return clampHitboxHeightToHurtbox(p, {
      w,
      h,
      left: left | 0,
      top: top | 0,
    });
  }

  function getL1JabHitbox(p) {
    const w = 80,
      h = 60;
    // Hitbox is positioned forward and centered vertically
    const left = p.facing === 1 ? p.pos.x + 20 : p.pos.x - w - 20;
    const top = p.pos.y - h - 20;
    return clampHitboxHeightToHurtbox(p, {
      w,
      h,
      left: left | 0,
      top: top | 0,
    });
  }

  function getL1SmashHitbox(p) {
    const w = 150,
      h = 120;
    // Larger hitbox for charged smash, positioned forward
    const left = p.facing === 1 ? p.pos.x + 30 : p.pos.x - w - 30;
    const top = p.pos.y - h - 10;
    return clampHitboxHeightToHurtbox(p, {
      w,
      h,
      left: left | 0,
      top: top | 0,
    });
  }

  function getR1UpAttackHitbox(p) {
    const w = 100,
      h = 80;
    // Overhead attack hitbox - positioned above and slightly forward
    const left = p.facing === 1 ? p.pos.x + 20 : p.pos.x - w - 20;
    const top = p.pos.y - h - 40; // Higher up for overhead attack
    return clampHitboxHeightToHurtbox(p, {
      w,
      h,
      left: left | 0,
      top: top | 0,
    });
  }

  function getR1ComboHitbox(p, state) {
    let w = 140,
      h = 120,
      offsetX = 20,
      offsetY = -20; // Default values

    // Dynamically adjust hitbox based on the current animation and frame
    switch (p.anim) {
      case "r1_combo_1":
        // Smaller hitbox for the initial, quick jabs
        w = 150;
        h = 100;
        offsetX = 40;
        offsetY = -10;
        break;
      case "r1_combo_2":
        // Wider hitbox for the sweeping motion
        w = 220;
        h = 130;
        offsetX = 50;
        offsetY = -30;
        break;
      case "r1_combo_3":
        // Larger and more forward hitbox for the lunge/finisher
        w = 240;
        h = 150;
        offsetX = 80;
        offsetY = -40;
        break;
    }

    const left = p.facing === 1 ? p.pos.x + offsetX : p.pos.x - w - offsetX;
    const top = p.pos.y - h + offsetY;
    return clampHitboxHeightToHurtbox(p, {
      w,
      h,
      left: left | 0,
      top: top | 0,
    });
  }

  function drawEffect(ctx, state, e) {
    // Skip rendering if effect is marked as done
    if (e.done) {
      // Debug logging for beat charge aura effect
      if (
        e.isCharacterEffect &&
        e.owner &&
        e.frames &&
        e.frames[0] &&
        typeof e.frames[0] === "string" &&
        e.frames[0].includes("fx_charged_beat")
      ) {
        console.log(
          `[BeatCharge] P${
            e.owner.padIndex + 1
          }: Skipping render of done aura effect`
        );
      }
      return;
    }

    let atlas = e.atlas;
    if (!atlas) {
      atlas = e.isStageEffect
        ? state.stageFxAtlas
        : e.isGlobal
        ? state.fxAtlas
        : state.characterConfigs[e.charName || e.owner?.charName];
    }
    const atlasImage = atlas?.atlasImage;
    const texture = atlasImage?._bitmap || atlasImage;
    if (!atlas || !texture) {
      if (e.isCharacterEffect) {
        console.warn(
          `[drawEffect] Character effect atlas not found for ${e.charName}`,
          e
        );
      }
      return;
    }

    const frameData = e.frames[e.frameIndex | 0];
    const frameName =
      typeof frameData === "object" ? frameData.frame : frameData;
    const f = atlas.frames[frameName];

    // Debug logging for knockback effects (dev mode only)
    if (
      state?.debug?.devMode &&
      state?.debug?.fxLogging &&
      frameName &&
      frameName.includes("fx_knockback")
    ) {
      console.log(
        `[drawEffect] Rendering ${frameName} - frameIndex: ${
          e.frameIndex
        }, atlas: ${
          atlas === state.fxAtlas3
            ? "fxAtlas3"
            : atlas === state.fxAtlas2
            ? "fxAtlas2"
            : atlas === state.fxAtlas
            ? "fxAtlas"
            : "other"
        }, frame found: ${!!f}`
      );
    }

    if (!f) {
      if (e.isCharacterEffect && state?.debug?.devMode) {
        console.warn(
          `[drawEffect] Frame not found: ${frameName} for ${e.charName}, skipping effect`
        );
      } else if (
        state?.debug?.devMode &&
        state?.debug?.fxLogging &&
        frameName &&
        frameName.includes("fx_knockback")
      ) {
        console.warn(
          `[drawEffect] ? Frame not found: ${frameName} in atlas, skipping effect`
        );
        console.log(
          `[drawEffect] Available frames in atlas:`,
          Object.keys(atlas.frames).filter((k) => k.includes("fx_knockback"))
        );
      }
      // Mark effect as done to remove it from the effects array
      e.done = true;
      return;
    }

    // Debug log for character effects (dev mode only)
    if (state?.debug?.devMode && e.isCharacterEffect && e.frameIndex === 0) {
      console.log(
        `[drawEffect] Rendering character effect: ${frameName}, pos: (${e.pos.x}, ${e.pos.y}), facing: ${e.facing}`
      );
    }

    const { x, y, w, h } = f.frame;
    const scale = e.scale !== undefined ? e.scale : 0.75;
    const scaledW = w * scale;
    const scaledH = h * scale;

    // For character effects, position relative to owner
    let drawX, drawY;
    if (e.isCharacterEffect && e.owner) {
      drawX =
        e.owner.pos.x -
        scaledW / 2 +
        (e.facing === -1 ? -e.offsetX : e.offsetX);
      drawY = e.owner.pos.y - scaledH + e.offsetY;
    } else {
      drawX =
        e.pos.x - scaledW / 2 + (e.facing === -1 ? -e.offsetX : e.offsetX);
      drawY = e.pos.y - scaledH / 2 + e.offsetY; // Centered vertically
    }

    ctx.save();

    if (e.rotation) {
      // Translate context to the effect's center for rotation
      const centerX = drawX + scaledW / 2;
      const centerY = drawY + scaledH / 2;
      ctx.translate(centerX, centerY);
      ctx.rotate(e.rotation);
      // Adjust draw coordinates to be relative to the new, rotated context
      drawX = -scaledW / 2;
      drawY = -scaledH / 2;
    }

    if (e.facing === -1 && !e.isGlobal && !e.isStageEffect && !e.rotation) {
      // Flip character effects and other non-global effects
      ctx.translate(drawX + scaledW, drawY);
      ctx.scale(-1, 1);
      ctx.drawImage(texture, x, y, w, h, 0, 0, scaledW, scaledH);
    } else {
      ctx.drawImage(texture, x, y, w, h, drawX, drawY, scaledW, scaledH);
    }
    ctx.restore();
  }

  function drawProjectile(ctx, state, proj) {
    const charName = proj.owner?.charName;
    if (!charName || !proj.owner) {
      console.warn("[drawProjectile] Projectile without valid owner, removing");
      proj.done = true; // Mark for removal
      return;
    }
    const charData = state.characterConfigs[charName];
    if (!charData) {
      console.error(
        `[drawProjectile] Character config missing for ${charName}`
      );
      proj.done = true;
      return;
    }
    if (!charData.atlasImage && !charData.atlasImage?._bitmap) {
      console.error(`[drawProjectile] Atlas image not loaded for ${charName}`);
      proj.done = true;
      return;
    }

    const animFrames = charData.animations[proj.anim];
    if (!animFrames) return;

    const frameData = animFrames[proj.frameIndex || 0];
    const frameName =
      typeof frameData === "object" ? frameData.frame : frameData;
    const f = charData.frames[frameName];
    if (!f) return;

    const { x, y, w, h } = f.frame;

    // Special scaling for ulti_check projectile
    let scaledW, scaledH, drawX, drawY;
    if (proj.type === "ulti_check") {
      scaledW = w * 0.5; // Smaller scale for ulti_check
      scaledH = h * 0.5;
      drawX = proj.x - scaledW / 2;

      // Special positioning for different ulti_check frames - Fixed positioning
      const frameName = animFrames[proj.frameIndex || 0];
      if (frameName && typeof frameName === "object") {
        const frameNameStr = frameName.frame;
        if (frameNameStr === "ulti_check_000") {
          // ulti_check_000: Center the disco ball properly at spawn position
          drawY = proj.y - scaledH / 2;
        } else if (frameNameStr === "ulti_check_003") {
          // ulti_check_003: slightly lower for visual consistency
          drawY = proj.y - scaledH / 2 - 10;
        } else {
          // Other frames: consistent positioning
          drawY = proj.y - scaledH / 2;
        }
      } else {
        // Fallback for non-object frame data
        drawY = proj.y - scaledH / 2;
      }
    } else {
      scaledW = w * 0.75;
      scaledH = h * 0.75;
      drawX = proj.pos.x - scaledW / 2;
      drawY = proj.pos.y - scaledH / 2;
    }

    ctx.save();
    // Optional: Rotate projectile based on velocity vector
    // const angle = Math.atan2(proj.vel.y, proj.vel.x);
    // ctx.translate(drawX + scaledW / 2, drawY + scaledH / 2);
    // ctx.rotate(angle);
    // ctx.drawImage(state.atlasImage, x, y, w, h, -scaledW / 2, -scaledH / 2, scaledW, scaledH);
    const texture = charData.atlasImage?._bitmap || charData.atlasImage;
    ctx.drawImage(texture, x, y, w, h, drawX, drawY, scaledW, scaledH);
    ctx.restore();
  }

  function getProjectileHitbox(proj) {
    // Special handling for ulti_check projectile - Fixed hitbox positioning
    if (proj.type === "ulti_check") {
      // Create a vertical column from ground to disco ball center
      const groundY = 800; // Approximate ground level
      const discoBallCenterY = proj.y; // Disco ball center position (after visual fix)
      const hitboxHeight = Math.abs(discoBallCenterY - groundY);

      return {
        w: proj.size, // Width stays the same
        h: hitboxHeight, // Height spans from ground to disco ball center
        left: (proj.x - proj.size / 2) | 0,
        top: Math.min(groundY, discoBallCenterY) | 0,
      };
    }

    const w = 48,
      h = 48;
    return {
      w,
      h,
      left: (proj.pos.x - w / 2) | 0,
      top: (proj.pos.y - h / 2) | 0,
    };
  }

  function getL2HitboxLeft(p, state) {
    let scale = 0.75;
    if (p.charName === "fritz") {
      scale = 0.6;
    } else if (
      p.charName.toLowerCase() === "hp" ||
      p.charName.toLowerCase() === "ernst"
    ) {
      scale = 0.675;
    }
    const w = 120,
      h = 250;
    const offsetX = -256 * scale;
    return clampHitboxHeightToHurtbox(p, {
      w,
      h,
      left: p.pos.x + offsetX - w / 2,
      top: p.pos.y - h,
    });
  }

  function getL2HitboxRight(p, state) {
    let scale = 0.75;
    if (p.charName === "fritz") {
      scale = 0.6;
    } else if (
      p.charName.toLowerCase() === "hp" ||
      p.charName.toLowerCase() === "ernst"
    ) {
      scale = 0.675;
    }
    const w = 120,
      h = 250;
    const offsetX = 256 * scale;
    return clampHitboxHeightToHurtbox(p, {
      w,
      h,
      left: p.pos.x + offsetX - w / 2,
      top: p.pos.y - h,
    });
  }

  function getL2SmashHitbox(p, state) {
    // Cyboard L2 Smash - overhead sword strike hitbox
    const w = 140; // Wide hitbox for the sword swing
    const h = 180; // Tall hitbox for overhead strike

    // Positioned in front of the player, slightly forward
    const forwardOffset = 30 * p.facing;
    const left = p.pos.x + forwardOffset - w / 2;
    const top = p.pos.y - h - 20; // Slightly above player for overhead strike

    return clampHitboxHeightToHurtbox(p, { w, h, left, top });
  }

  // drawHUD function removed - UI elements no longer displayed

  // drawHeart function removed - no longer needed

  // drawPercent function removed - no longer needed

  function drawDebugBoxes(ctx, state) {
    ctx.save();
    ctx.lineWidth = 2;
    // Draw camera deadzone rectangle (if configured)
    if (state.camera && state.cameraDeadzone) {
      const dz = state.cameraDeadzone;
      if (
        typeof dz.width === "number" &&
        typeof dz.height === "number" &&
        dz.width > 0 &&
        dz.height > 0
      ) {
        const viewW =
          GameState.CONSTANTS.NATIVE_WIDTH / (state.camera.zoom || 1);
        const viewH =
          GameState.CONSTANTS.NATIVE_HEIGHT / (state.camera.zoom || 1);
        const rectW = dz.width * viewW;
        const rectH = dz.height * viewH;
        const left = state.camera.x - rectW / 2;
        const top = state.camera.y - rectH / 2;
        ctx.strokeStyle = "#ffff00"; // Yellow for deadzone
        ctx.strokeRect(left, top, rectW, rectH);
      }
    }
    for (let i = 0; i < state.players.length; i++) {
      const p = state.players[i];
      const hb = getHurtbox(p);
      ctx.strokeStyle = i === 0 ? "#00ff88" : "#88e7ff";
      ctx.strokeRect(hb.left, hb.top, hb.w, hb.h);
      if (p.attack?.type === "r1" && p.attack.phase === "release") {
        const atk = getR1Hitbox(p, state);
        ctx.strokeStyle = "#00aaff";
        ctx.strokeRect(atk.left, atk.top, atk.w, atk.h);
      } else if (p.attack?.type === "r1_combo_active") {
        // Corrected from "r1_combo"
        const atk = getR1ComboHitbox(p, state);
        ctx.strokeStyle = "#ff0000"; // Red for combo hitbox
        ctx.strokeRect(atk.left, atk.top, atk.w, atk.h);
      } else if (p.attack?.type === "r2" && p.attack.phase === "release") {
        const atk = getR2Hitbox(p, state);
        ctx.strokeStyle = "#ff5500"; // Different color for R2 hitbox
        ctx.strokeRect(atk.left, atk.top, atk.w, atk.h);
      } else if (p.attack?.type === "r1_circle_attack") {
        const atk = getR1CircleHitbox(p, state);
        ctx.strokeStyle = "#ffff00";
        ctx.strokeRect(atk.left, atk.top, atk.w, atk.h);
      } else if (
        p.attack?.type === "l1_jab" ||
        p.attack?.type === "l1_jab_combo"
      ) {
        const atk = getL1JabHitbox(p);
        ctx.strokeStyle = "#ff8800";
        ctx.strokeRect(atk.left, atk.top, atk.w, atk.h);
      } else if (
        p.attack?.type === "l1_smash" &&
        p.attack.phase === "release"
      ) {
        const atk = getL1SmashHitbox(p);
        ctx.strokeStyle = p.attack.isMaxCharge ? "#ff0088" : "#ffaa00";
        ctx.strokeRect(atk.left, atk.top, atk.w, atk.h);
      } else if (p.attack?.type === "r1_up_attack") {
        const atk = getR1UpAttackHitbox(p);
        ctx.strokeStyle = "#ff00ff"; // Magenta for overhead attack
        ctx.strokeRect(atk.left, atk.top, atk.w, atk.h);
      } else if (
        p.attack?.type === "l1_ranged_grab" &&
        p.attack.phase === "cast" &&
        p.attack.detectActive
      ) {
        const atk = getL1RangedGrabHitbox(p, state);
        ctx.strokeStyle = "#00ffff"; // Cyan for grab hitbox
        ctx.strokeRect(atk.left, atk.top, atk.w, atk.h);
      } else if (p.attack?.type === "l1_ranged_grab_combo") {
        const atk = getL1RangedComboHitbox(p, state);
        ctx.strokeStyle = "#ff00aa"; // Pink for combo hitbox
        ctx.strokeRect(atk.left, atk.top, atk.w, atk.h);
      } else if (p.attack?.type === "l2_smash") {
        const atk = getL2SmashHitbox(p, state);
        ctx.strokeStyle = "#ff8800"; // Orange for L2 smash hitbox
        ctx.strokeRect(atk.left, atk.top, atk.w, atk.h);
      }
    }
    ctx.restore();
  }

  function drawSpriteDebugInfo(ctx, state) {
    ctx.save();
    ctx.fillStyle = "yellow";
    ctx.font = "12px monospace";

    for (const p of state.players) {
      if (p.eliminated) continue;

      // Zeige Sprite-Informationen an
      ctx.fillText(
        `${p.charName}: ${p.anim}[${p.frameIndex}/${p.frames?.length || 0}]`,
        p.pos.x - 50,
        p.pos.y - 30
      );

      // Zeige Frame-Name an
      if (p.frames && p.frames[p.frameIndex]) {
        const frameData = p.frames[p.frameIndex];
        const frameName =
          typeof frameData === "object" ? frameData.frame : frameData;
        ctx.fillText(`Frame: ${frameName}`, p.pos.x - 50, p.pos.y - 15);
      }
    }
    ctx.restore();
  }

  // NEW: Draw rounded rectangle helper
  function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  // NEW: Draw comprehensive top HUD panel for each player
  function drawPlayerTopHUD(ctx, player, x, y, align) {
    const panelWidth = 360;
    const panelHeight = 160; // Increased height for larger hearts (56px)
    const panelX = align === "left" ? x : x - panelWidth;
    const padding = 16;

    // Panel Background (High contrast black with subtle border)
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.88)";
    drawRoundedRect(ctx, panelX, y, panelWidth, panelHeight, 10);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, panelX, y, panelWidth, panelHeight, 10);
    ctx.stroke();
    ctx.restore();

    const contentX = panelX + padding;
    const contentY = y + padding;
    const contentWidth = panelWidth - padding * 2;

    // 1. Beat-Charge + Ultimate Bar (10 Segments, combined)
    const ultimeter = player.ultimeter || {
      current: 0,
      max: 100,
      isReady: false,
    };
    // Simplified logic: Ultimeter current value (0-100) DIRECTLY represents the segments.
    // 100 = 10 segments. 10 = 1 segment.

    const maxSegments = 10;
    const currentSegments = ultimeter.current / 10; // Float 0.0 to 10.0

    // Determine full segments and partial fill
    const fullSegments = Math.floor(currentSegments);
    const partialFill = currentSegments - fullSegments;

    const barHeight = 12; // Slightly taller for better visibility
    const barY = contentY;
    const segmentGap = 4;
    const totalGapWidth = segmentGap * (maxSegments - 1);
    const segmentWidth = (contentWidth - totalGapWidth) / maxSegments;

    // Draw segments
    const now = Date.now();
    const pulseScale = ultimeter.isReady
      ? 0.95 + 0.05 * Math.sin(now / 150)
      : 1.0;

    for (let i = 0; i < maxSegments; i++) {
      const segX = contentX + i * (segmentWidth + segmentGap);
      const isFilled = i < fullSegments;
      const isPartial = i === fullSegments && partialFill > 0;

      // Background
      ctx.fillStyle = "rgba(40, 40, 40, 0.8)";
      ctx.fillRect(segX, barY, segmentWidth, barHeight);

      if (isFilled || isPartial) {
        const fillWidth = isFilled ? segmentWidth : segmentWidth * partialFill;

        ctx.save();
        // Only apply pulse transform if fully ready
        if (ultimeter.isReady) {
          // We apply color pulse logic below, but transform is tricky per-segment without shifting
          // Just pulse the color intensity for now
        }

        if (ultimeter.isReady) {
          // Pulsing Gold/White for full charge
          const t = (Math.sin(now / 100) + 1) / 2;
          ctx.fillStyle = `rgba(255, ${215 + t * 40}, ${t * 100}, 1.0)`;
        } else {
          // Progressive Color (Blue -> Purple -> Pink)
          const hue = 200 + (i / maxSegments) * 120;
          ctx.fillStyle = `hsla(${hue}, 80%, 60%, 1.0)`;
        }

        ctx.fillRect(segX, barY, fillWidth, barHeight);

        // Glow effect
        if (isFilled) {
          ctx.shadowColor = ctx.fillStyle;
          ctx.shadowBlur = 10;
          ctx.fillRect(segX, barY, fillWidth, barHeight);
        }

        ctx.restore();
      }
    }

    // 2. Percentage (Large, prominent)
    const percentY = barY + 50;
    ctx.font = "bold 52px monospace";
    ctx.textAlign = align === "left" ? "left" : "right";

    // Dynamic color based on damage (white -> yellow -> red)
    const percent = Math.floor(player.percent || 0);
    let percentColor = "#ffffff";
    if (percent >= 150) percentColor = "#ff0000";
    else if (percent >= 100) percentColor = "#ff8800";
    else if (percent >= 50) percentColor = "#ffff88";

    ctx.fillStyle = percentColor;
    const percentText = percent + "%";
    const percentX = align === "left" ? contentX : contentX + contentWidth;

    // Text shadow for readability
    ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
    ctx.shadowBlur = 6;
    ctx.fillText(percentText, percentX, percentY);
    ctx.shadowBlur = 0;

    // 3. Lives (Hearts) - Below percentage, only in Classic Mode
    // Check if player has lives system (Classic Mode typically has 3 lives)
    if (player.lives !== undefined && player.lives <= 5) {
      const heartSize = 56; // Doubled from 28px
      const heartSpacing = 12;
      const heartY = percentY + 20; // Adjusted for larger hearts
      const maxLives = 3;

      // Calculate total width for centering within content area
      const totalHeartsWidth =
        maxLives * heartSize + (maxLives - 1) * heartSpacing;
      const heartsStartX = contentX + (contentWidth - totalHeartsWidth) / 2; // Center within panel

      for (let i = 0; i < maxLives; i++) {
        const heartX = heartsStartX + i * (heartSize + heartSpacing);
        const isFilled = i < player.lives;

        // Draw heart with appropriate style
        if (isFilled) {
          // White heart with subtle glow for better visibility
          ctx.save();
          ctx.shadowColor = "rgba(255, 255, 255, 0.5)";
          ctx.shadowBlur = 6;
          drawHeart(ctx, heartX, heartY, heartSize, "#ffffff");
          ctx.restore();
        } else {
          // Empty heart (grayed out, semi-transparent) - clearly visible but distinct
          ctx.save();
          ctx.globalAlpha = 0.3;
          drawHeart(ctx, heartX, heartY, heartSize, "#666666");
          ctx.restore();
        }
      }
    }

    // 4. Player Label (Small, subtle, opposite side)
    ctx.font = "bold 16px monospace";
    ctx.fillStyle = "rgba(200, 200, 200, 0.7)";
    ctx.textAlign = align === "left" ? "right" : "left";
    const labelX = align === "left" ? contentX + contentWidth : contentX;
    ctx.fillText(`P${player.padIndex + 1}`, labelX, barY + 22);
  }

  // Ingame UI Functions
  function drawIngameUI(ctx, state) {
    if (!state.players || state.players.length === 0) return;

    // DEBUG: Log UI state every 60 frames
    if (!window._uiDebugCounter) window._uiDebugCounter = 0;
    window._uiDebugCounter++;
    const shouldLog = window._uiDebugCounter % 120 === 1; // Log every 2 seconds at 60fps

    if (shouldLog) {
      console.log("[UI DEBUG] drawIngameUI called:", {
        tutorialActive: state.tutorial?.active,
        tutorialPart: state.tutorial?.part,
        tutorialProximityAlpha: state.tutorial?.proximityAlpha,
        tutorialUiVisible: state.tutorial?.uiVisible,
        danceModeActive: state.danceMode?.active,
        danceModeProximityAlpha: state.danceMode?.proximityAlpha,
        globalUiVisible: state.uiVisible,
        currentStagePath: state.currentStagePath,
      });
    }

    // NEW: Hide UI during tutorial victory dance
    if (state.tutorial?.victoryDance?.active) {
      if (shouldLog)
        console.log("[UI DEBUG] Skipping UI - victory dance active");
      return; // Skip UI rendering during victory dance
    }

    // NEW: Global UI Fade (Tutorial or Dance Mode)
    let uiFadeActive = false;
    let uiAlpha = 1.0;

    // CRITICAL: Tutorial Part 2 should NEVER use fade logic - UI must be fully visible
    const isTutorialPart2ForFade =
      state.tutorial?.active && state.tutorial.part === 2;

    if (isTutorialPart2ForFade) {
      // Tutorial Part 2: NO fade, full UI visibility
      uiFadeActive = false;
      uiAlpha = 1.0;
      if (shouldLog)
        console.log("[UI DEBUG] Tutorial Part 2 - NO fade, full visibility");
    } else if (state.tutorial?.active && state.tutorial.part === 1) {
      uiAlpha = state.tutorial.proximityAlpha || 0;
      uiFadeActive = true;
      if (shouldLog)
        console.log(
          "[UI DEBUG] Tutorial Part 1 fade active, uiAlpha:",
          uiAlpha
        );
    } else if (state.danceMode?.active) {
      uiAlpha =
        state.danceMode.proximityAlpha !== undefined
          ? state.danceMode.proximityAlpha
          : 1.0;
      uiFadeActive = true;
      if (shouldLog)
        console.log("[UI DEBUG] Dance Mode fade active, uiAlpha:", uiAlpha);
    } else {
      if (shouldLog) console.log("[UI DEBUG] No fade active, uiAlpha: 1.0");
    }

    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;
    const margin = 40; // Margin for top HUD panels

    // UI-Elemente am oberen und unteren Bildschirmrand
    const p1 = state.players[0];
    const p2 = state.players[1];

    // NEW: Top HUD Panels (Ultimeter + Percent + Lives) - ALWAYS VISIBLE
    // These modals must be visible regardless of dance zone intensity
    const topHUDY = 0; // Same Y position as beat bar sprites (Y=0)
    if (p1) {
      drawPlayerTopHUD(ctx, p1, margin, topHUDY, "left");
    }
    if (p2) {
      drawPlayerTopHUD(ctx, p2, canvasWidth - margin, topHUDY, "right");
    }

    // Now handle fade/visibility for beat bar sprites only
    if (uiFadeActive) {
      if (uiAlpha <= 0.01) {
        if (shouldLog)
          console.log("[UI DEBUG] uiAlpha <= 0.01, skipping beat bar render");
        // Skip beat bar rendering if completely faded out, but modals already rendered above
        if (
          (state.tutorial?.active && state.tutorial.part === 1) ||
          (state.danceMode?.active &&
            state.danceMode.proximityAlpha !== undefined)
        ) {
          ctx.restore();
        }
        return;
      }
      ctx.save();
      ctx.globalAlpha = uiAlpha;
      if (shouldLog)
        console.log("[UI DEBUG] uiFadeActive, rendering with alpha:", uiAlpha);
    } else {
      // Check if we should force UI visible (tutorial stages: pvp_stage_2, pvp_stage_3)
      const isTutorialStage =
        state.currentStagePath?.includes("pvp_stage_2") ||
        state.currentStagePath?.includes("pvp_stage_3");
      const shouldForceUI = isTutorialStage && state.tutorial?.active;

      if (shouldLog)
        console.log(
          "[UI DEBUG] No fade, shouldForceUI:",
          shouldForceUI,
          "uiVisible:",
          state.uiVisible
        );

      // Only check uiVisible for beat bar sprites (not modals - they're already rendered above)
      if (!shouldForceUI && !state.uiVisible) {
        if (shouldLog)
          console.log(
            "[UI DEBUG] Skipping beat bar - shouldForceUI false and uiVisible false"
          );
        // Skip beat bar rendering if UI is hidden, but modals already rendered above
        return;
      }
    }

    // NECRODANCER-STYLE BEAT BAR - Only show if at least one player is in dance zone
    // Hide beat bar sprites if ALL players are too far from dance zones
    // No dance area = danceZoneIntensity < 0.05
    let shouldShowBeatBar = true;

    // EXCEPTION: In Tutorial Part 2/3, always show beat bar (like normal PvP)
    const isTutorialPart2Or3 =
      state.tutorial?.active &&
      (state.tutorial.part === 2 || state.tutorial.part === 3);

    if (shouldLog)
      console.log("[UI DEBUG] isTutorialPart2Or3:", isTutorialPart2Or3);

    if (!isTutorialPart2Or3 && (p1 || p2)) {
      // Check if players are in "no dance" areas (silent zones)
      const p1InNoDanceZone =
        p1 &&
        typeof p1.danceZoneIntensity === "number" &&
        p1.danceZoneIntensity < 0.05;
      const p2InNoDanceZone =
        p2 &&
        typeof p2.danceZoneIntensity === "number" &&
        p2.danceZoneIntensity < 0.05;

      // Check if players have danceZoneIntensity set (if undefined, assume classic mode - show beat bar)
      const p1HasIntensity = p1 && typeof p1.danceZoneIntensity === "number";
      const p2HasIntensity = p2 && typeof p2.danceZoneIntensity === "number";

      // Hide beat bar only if ALL existing players are in no-dance zones
      // (If danceZoneIntensity is undefined, assume classic mode and show beat bar)
      if (p1 && p2) {
        // Both players exist
        shouldShowBeatBar = !(
          p1HasIntensity &&
          p1InNoDanceZone &&
          p2HasIntensity &&
          p2InNoDanceZone
        );
      } else if (p1) {
        // Only P1 exists
        shouldShowBeatBar = !(p1HasIntensity && p1InNoDanceZone);
      } else if (p2) {
        // Only P2 exists
        shouldShowBeatBar = !(p2HasIntensity && p2InNoDanceZone);
      }
    }

    if (shouldShowBeatBar) {
      drawNecroDancerBeatBar(ctx, state, canvasWidth, canvasHeight);
    }

    // NEW: Dance Mode Score Bar (only in dance mode, NOT in classic mode)
    // Check both danceMode.active and selectedGameMode to ensure it's only shown in dance mode
    const isDanceMode =
      state.danceMode?.active && state.selectedGameMode === "dance";
    if (isDanceMode) {
      const scoreBarY = canvasHeight - 80;
      if (p1) {
        drawDanceModeScoreBar(
          ctx,
          state,
          0,
          margin,
          scoreBarY,
          150,
          20,
          "P1 Score"
        );
      }
      if (p2) {
        drawDanceModeScoreBar(
          ctx,
          state,
          1,
          canvasWidth - margin - 150,
          scoreBarY,
          150,
          20,
          "P2 Score"
        );
      }
    }

    // NEW: Restore alpha if tutorial mode or dance mode fade was active
    if (
      (state.tutorial?.active && state.tutorial.part === 1) ||
      (state.danceMode?.active && state.danceMode.proximityAlpha !== undefined)
    ) {
      ctx.restore();
    }
  }

  function drawUltimeter(ctx, player, x, y, width, height, label) {
    const ultimeter = player.ultimeter || {
      current: 0,
      max: 100,
      isReady: false,
    };
    const gainPerPerfect =
      (window.UltimeterManager &&
        window.UltimeterManager.GAIN_CONFIGS &&
        window.UltimeterManager.GAIN_CONFIGS.perfect_beat) ||
      ultimeter.max;
    const segments = Math.max(1, Math.ceil(ultimeter.max / gainPerPerfect));
    const segmentGap = 3;
    const totalGapWidth = segmentGap * (segments - 1);
    const segmentWidth = (width - totalGapWidth) / segments;
    const pulseScale = ultimeter.isReady
      ? 0.9 + 0.1 * Math.sin((Date.now() / 200) % (Math.PI * 2))
      : 1.0;

    // Hintergrund
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(x - 5, y - 5, width + 10, height + 10);

    // Ultimeter-Balken
    ctx.fillStyle = "#333333";
    ctx.fillRect(x, y, width, height);

    let remaining = ultimeter.current;
    for (let i = 0; i < segments; i++) {
      const segmentX = x + i * (segmentWidth + segmentGap);
      const fillRatio = Math.max(0, Math.min(1, remaining / gainPerPerfect));
      if (fillRatio > 0) {
        const gradient = ctx.createLinearGradient(
          segmentX,
          y,
          segmentX + segmentWidth,
          y
        );
        if (ultimeter.isReady) {
          gradient.addColorStop(0, "#ff00ff");
          gradient.addColorStop(1, "#ff44ff");
        } else {
          gradient.addColorStop(0, "#4444ff");
          gradient.addColorStop(1, "#6666ff");
        }
        const fillWidth = Math.min(
          segmentWidth,
          segmentWidth * fillRatio * pulseScale
        );
        ctx.fillStyle = gradient;
        ctx.fillRect(segmentX, y, fillWidth, height);
      }

      // Segment Rahmen
      ctx.strokeStyle = ultimeter.isReady ? "#ff00ff" : "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(segmentX, y, segmentWidth, height);

      remaining -= gainPerPerfect;
    }

    // Rahmen
    ctx.strokeStyle = ultimeter.isReady ? "#ff00ff" : "#ffffff";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);

    // Label
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(label, x + width / 2, y - 8);
  }

  function drawPercentageDamage(ctx, player, x, y) {
    const percent = Math.round(player.percent || 0);

    ctx.font = "14px monospace";
    ctx.textAlign = "center";
    const text = `${percent}%`;

    // Measure text width for background
    const metrics = ctx.measureText(text);
    const textWidth = metrics.width;
    const textHeight = 14; // Font size
    const padding = 6;

    // Draw black background with rounded corners effect
    ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
    ctx.fillRect(
      x - textWidth / 2 - padding,
      y - textHeight - padding / 2,
      textWidth + padding * 2,
      textHeight + padding
    );

    // Draw white text on top
    ctx.fillStyle = "#ffffff";
    ctx.fillText(text, x, y);
  }

  // NEW: Draw Dance Mode Score Bar
  function drawDanceModeScoreBar(
    ctx,
    state,
    playerIndex,
    x,
    y,
    width,
    height,
    label
  ) {
    if (!state.danceMode?.active) return;

    const score =
      playerIndex === 0 ? state.danceMode.p1Score : state.danceMode.p2Score;
    const targetScore = state.danceMode.targetScore || 10;
    const ratio = Math.min(score / targetScore, 1.0);

    // Hintergrund
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(x - 5, y - 5, width + 10, height + 10);

    // Score-Balken Hintergrund
    ctx.fillStyle = "#333333";
    ctx.fillRect(x, y, width, height);

    // Füllung mit Farbverlauf (grün -> gelb -> rot bei hohem Score)
    const gradient = ctx.createLinearGradient(x, y, x + width, y);
    if (ratio >= 1.0) {
      // Voll = Rot (Gewonnen)
      gradient.addColorStop(0, "#ff0000");
      gradient.addColorStop(1, "#ff4444");
    } else if (ratio >= 0.7) {
      // Hoch = Gelb
      gradient.addColorStop(0, "#ffaa00");
      gradient.addColorStop(1, "#ffcc44");
    } else {
      // Niedrig = Grün
      gradient.addColorStop(0, "#44ff44");
      gradient.addColorStop(1, "#66ff66");
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width * ratio, height);

    // Rahmen
    ctx.strokeStyle = ratio >= 1.0 ? "#ff0000" : "#ffffff";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);

    // Label und Score Text
    ctx.fillStyle = "#ffffff";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(label, x + width / 2, y - 8);

    // Score Text im Balken
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${score}/${targetScore}`, x + width / 2, y + height / 2 + 5);
  }

  function drawHeart(ctx, x, y, size, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x + size / 2, y + size * 0.3);
    ctx.bezierCurveTo(
      x + size * 0.1,
      y,
      x,
      y + size * 0.3,
      x + size / 2,
      y + size
    );
    ctx.bezierCurveTo(
      x + size,
      y + size * 0.3,
      x + size * 0.9,
      y,
      x + size / 2,
      y + size * 0.3
    );
    ctx.closePath();
    ctx.fill();
  }

  function adjustBrightness(color, factor) {
    // Einfache Helligkeitsanpassung f�r Hex-Farben
    if (color.startsWith("#")) {
      const r = parseInt(color.substring(1, 3), 16);
      const g = parseInt(color.substring(3, 5), 16);
      const b = parseInt(color.substring(5, 7), 16);
      return `rgb(${Math.min(255, r * factor)}, ${Math.min(
        255,
        g * factor
      )}, ${Math.min(255, b * factor)})`;
    }
    return color;
  }

  function adjustSaturation(color, saturation) {
    // S�ttigungsanpassung f�r Hex-Farben (0.0 = grau, 1.0 = original)
    if (color.startsWith("#")) {
      const r = parseInt(color.substring(1, 3), 16) / 255;
      const g = parseInt(color.substring(3, 5), 16) / 255;
      const b = parseInt(color.substring(5, 7), 16) / 255;

      // Convert to grayscale
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;

      // Apply saturation
      const newR = gray + (r - gray) * saturation;
      const newG = gray + (g - gray) * saturation;
      const newB = gray + (b - gray) * saturation;

      return `rgb(${Math.floor(newR * 255)}, ${Math.floor(
        newG * 255
      )}, ${Math.floor(newB * 255)})`;
    }
    return color;
  }

  function getL1RangedGrabHitbox(player, state) {
    const hurtbox = getHurtbox(player);
    const facing = player.facing;

    // Long, narrow hitbox extending in front of HP for grabbing
    // Base range can be increased by beat charges (+44% total = +20% increase from previous +20%)
    const baseRange = 200;
    const effectiveRange =
      player?.perfectBeatCount > 0 ? Math.round(baseRange * 1.44) : baseRange;
    // Ensure grab hitbox is at least 30% wider than character hurtbox
    const minWidth = Math.ceil(hurtbox.w * 1.3);
    const hitboxWidth = Math.max(effectiveRange, minWidth);
    const hitbox = {
      left: hurtbox.left + hurtbox.w * facing,
      top: hurtbox.top + hurtbox.h * 0.3, // Upper third of hurtbox
      w: hitboxWidth, // long grab range (scaled when beat-charged, minimum 30% of hurtbox)
      h: hurtbox.h * 0.4, // 40% of hurtbox height
    };

    // Ensure hitbox doesn't go beyond player bounds
    if (facing > 0) {
      hitbox.left = Math.max(hitbox.left, hurtbox.left + hurtbox.w);
    } else {
      hitbox.left = Math.min(hitbox.left, hurtbox.left - hitbox.w);
    }

    return clampHitboxHeightToHurtbox(player, hitbox);
  }

  // HP's L1 Ranged Grab Combo Hitbox (air follow-up)
  function getL1RangedComboHitbox(player, state) {
    const hurtbox = getHurtbox(player);
    const facing = player.facing;

    // Wide hitbox in front for catching aerial opponents
    const hitbox = {
      left: hurtbox.left + hurtbox.w * facing - 50,
      top: hurtbox.top - 100, // Above player
      w: 300, // 300px wide
      h: 200, // 200px tall
    };

    // Adjust based on facing direction
    if (facing < 0) {
      hitbox.left = hurtbox.left - hitbox.w + hurtbox.w;
    }

    return clampHitboxHeightToHurtbox(player, hitbox);
  }

  function drawDanceBattleBar(ctx, player, state, x, y, width, height) {
    // Nur anzeigen, wenn Dance Battle aktiv ist
    if (!state.danceBattle.active) return;

    const beatCount =
      player.padIndex === 0
        ? state.danceBattle.p1BeatCount
        : state.danceBattle.p2BeatCount;

    const maxBeats = 6; // Maximal 6 Punkte zum Gewinnen
    const ratio = Math.min(beatCount / maxBeats, 1.0);

    // Hintergrund mit leichter Transparenz
    ctx.fillStyle = "rgba(50, 50, 50, 0.7)";
    ctx.fillRect(x, y, width, height);

    // Rosa-Lila Verlauf mit Transparenz
    const gradient = ctx.createLinearGradient(x, y, x + width, y);
    gradient.addColorStop(0, "rgba(255, 105, 180, 0.7)"); // Hot Pink mit Transparenz
    gradient.addColorStop(0.5, "rgba(218, 112, 214, 0.8)"); // Orchid
    gradient.addColorStop(1, "rgba(186, 85, 211, 0.9)"); // Medium Orchid

    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, width * ratio, height);

    // Puls-Effekt wenn sich der Wert �ndert
    ctx.save();
    ctx.shadowBlur = 10;
    ctx.shadowColor = "rgba(255, 105, 180, 0.8)";
    ctx.fillRect(x, y, width * ratio, height);
    ctx.restore();

    // Beat Count Text
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.shadowBlur = 2;
    ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
    ctx.fillText(`${beatCount}/${maxBeats}`, x + width / 2, y + height / 2 + 4);
    ctx.shadowBlur = 0;

    // Rahmen mit rosa Glow
    ctx.strokeStyle = "rgba(255, 105, 180, 0.9)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
  }

  function drawMusicNotes(ctx, player, centerX, y, size) {
    const notes = player.musicNotes || 0;
    const spacing = size + 5; // 5px Abstand zwischen Noten
    const totalWidth = spacing * 3 - 5; // Breite f�r 3 Noten
    const startX = centerX - totalWidth / 2;

    for (let i = 0; i < 3; i++) {
      const noteX = startX + i * spacing;
      const isFilled = i < notes; // Gef�llte Note wenn verf�gbar

      ctx.save();
      ctx.translate(noteX, y);

      // Notenkopf (Kreis)
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.4, size * 0.35, -Math.PI / 6, 0, Math.PI * 2);

      if (isFilled) {
        // Gef�llte Note (aktiv)
        ctx.fillStyle = "#FFD700"; // Gold
        ctx.fill();
        ctx.strokeStyle = "#FFA500"; // Orange Umrandung
      } else {
        // Leere Note (verbraucht)
        ctx.fillStyle = "#333333"; // Dunkelgrau
        ctx.fill();
        ctx.strokeStyle = "#666666"; // Grau Umrandung
      }
      ctx.lineWidth = 2;
      ctx.stroke();

      // Notenhals
      ctx.beginPath();
      ctx.moveTo(size * 0.35, 0);
      ctx.lineTo(size * 0.35, -size * 0.8);
      if (isFilled) {
        ctx.strokeStyle = "#FFD700";
      } else {
        ctx.strokeStyle = "#666666";
      }
      ctx.lineWidth = 2;
      ctx.stroke();

      // Notenf�hnchen
      ctx.beginPath();
      ctx.moveTo(size * 0.35, -size * 0.8);
      ctx.bezierCurveTo(
        size * 0.6,
        -size * 0.7,
        size * 0.5,
        -size * 0.5,
        size * 0.35,
        -size * 0.4
      );
      ctx.stroke();

      ctx.restore();
    }
  }

  function drawNecroDancerBeatBar(ctx, state, canvasWidth, canvasHeight) {
    // Performance monitoring
    if (window.PerformanceMonitor?.isEnabled) {
      window.PerformanceMonitor.startSection("NecroDancerBeatBar");
    }

    // Check if UI atlas is loaded
    if (!state.uiAtlas || !state.uiAtlasImage) return;

    // Position am oberen Bildschirmrand
    const topY = 0; // Oberer Rand ohne Abstand (Balken sind 256px hoch)
    const centerX = canvasWidth / 2;
    const spriteHeight = 256;
    const spriteWidth = 256;

    // Get beat data from state
    const bpm = state.currentBPM || 117;
    const beatInterval = 60000 / bpm; // ms per beat

    // Beatmatch-Timer: Einheitliches Zeit-System (gleiche Quelle wie Beat-Detection)
    const beatOffset = state?.currentBeatOffset || 0;
    let adjustedMusicTime = 0;

    // Use unified audio-based timing system
    if (AudioSystem && AudioSystem.getMusicTime) {
      // Use audio-based timing (most accurate)
      const audioTime = AudioSystem.getMusicTime();
      adjustedMusicTime = Math.max(0, audioTime + beatOffset);
    } else {
      // Fallback to system time
      const stageStartTime = state?.stageStartTime || 0;
      const timeSinceStageStart = performance.now() / 1000 - stageStartTime;
      adjustedMusicTime = Math.max(0, timeSinceStageStart * 1000 + beatOffset);
    }

    // Berechne Beat-Phase (0-1 innerhalb eines Beats)
    const timeSinceLastBeat = adjustedMusicTime % beatInterval;
    const beatPhase = timeSinceLastBeat / beatInterval; // 0-1

    // Multi-Bar System: 4 Balken pro Seite, jeder bewegt 1/4 der Strecke
    // Strecke aufteilen in 4 Segmente
    const totalTravelDistance = canvasWidth / 2 - spriteWidth / 2;
    const segmentDistance = totalTravelDistance / 4; // Jeder Balken bewegt nur 1/4

    // Frame-Auswahl f�r animierte Balken (4 Frames pro Balken)
    const frameIndex = Math.floor(beatPhase * 4) % 4;
    const frameNumber = frameIndex.toString().padStart(3, "0");

    // Zeichne 4 linke Balken (gestaffelt, jeder mit eigenem Offset)
    for (let i = 0; i < 4; i++) {
      // Jeder Balken startet bei i * segmentDistance vom linken Rand
      // bewegt sich dann um beatPhase * segmentDistance nach rechts
      const leftBarX = i * segmentDistance + beatPhase * segmentDistance;

      // Nur zeichnen wenn Balken noch sichtbar ist
      if (leftBarX + spriteWidth > 0 && leftBarX < canvasWidth / 2) {
        const leftFrameName = `beatbar_left_${frameNumber}`;
        const leftFrame = state.uiAtlas.frames[leftFrameName];
        if (leftFrame) {
          ctx.drawImage(
            state.uiAtlasImage,
            leftFrame.frame.x,
            leftFrame.frame.y,
            leftFrame.frame.w,
            leftFrame.frame.h,
            leftBarX,
            topY,
            spriteWidth,
            spriteHeight
          );
        }
      }
    }

    // Zeichne 4 rechte Balken (gestaffelt, jeder mit eigenem Offset)
    for (let i = 0; i < 4; i++) {
      // Jeder Balken startet bei i * segmentDistance vom rechten Rand
      // bewegt sich dann um beatPhase * segmentDistance nach links
      const rightBarX =
        canvasWidth -
        (i * segmentDistance + beatPhase * segmentDistance) -
        spriteWidth;

      // Nur zeichnen wenn Balken noch sichtbar ist
      if (
        rightBarX < canvasWidth &&
        rightBarX + spriteWidth > canvasWidth / 2
      ) {
        const rightFrameName = `beatbar_right_${frameNumber}`;
        const rightFrame = state.uiAtlas.frames[rightFrameName];
        if (rightFrame) {
          ctx.drawImage(
            state.uiAtlasImage,
            rightFrame.frame.x,
            rightFrame.frame.y,
            rightFrame.frame.w,
            rightFrame.frame.h,
            rightBarX,
            topY,
            spriteWidth,
            spriteHeight
          );
        }
      }
    }

    // Impact-Effekt wenn sich Balken treffen
    // Startet 10% vor Beat-Ende (beatPhase 0.90), l�uft 10% in den n�chsten Beat rein (beatPhase 0.10)
    // 8 Frames �ber diese gesamte Dauer (20% des Beat-Intervalls)
    let impactActive = false;
    let impactProgress = 0;

    if (beatPhase >= 0.9) {
      // Im aktuellen Beat (0.90 - 1.0): Progress 0.0 - 0.5 (erste H�lfte der 8 Frames)
      impactProgress = (beatPhase - 0.9) / 0.2; // Normiert auf 20% (10% vor + 10% nach)
      impactActive = true;
    } else if (beatPhase <= 0.1) {
      // Im n�chsten Beat (0.0 - 0.10) - �berlappung: Progress 0.5 - 1.0 (zweite H�lfte)
      impactProgress = 0.1 / 0.2 + beatPhase / 0.2; // 0.5 + (0.0-0.1) = 0.5-1.0
      impactActive = true;
    }

    if (impactActive) {
      // Clamp progress auf 0-1 und mappe auf 8 Frames (0-7)
      impactProgress = Math.min(Math.max(impactProgress, 0), 1);
      const impactFrameIndex = Math.floor(impactProgress * 8);
      const impactFrameNumber = Math.min(Math.max(impactFrameIndex, 0), 7)
        .toString()
        .padStart(3, "0");
      const impactFrameName = `beatbar_impact_${impactFrameNumber}`;
      const impactFrame = state.uiAtlas.frames[impactFrameName];

      if (impactFrame) {
        // Zeichne Impact in der Mitte
        ctx.drawImage(
          state.uiAtlasImage,
          impactFrame.frame.x,
          impactFrame.frame.y,
          impactFrame.frame.w,
          impactFrame.frame.h,
          centerX - spriteWidth / 2,
          topY,
          spriteWidth,
          spriteHeight
        );
      }
    }

    if (window.PerformanceMonitor?.isEnabled) {
      window.PerformanceMonitor.endSection("NecroDancerBeatBar");
    }
  }

  function adjustBrightness(color, factor) {
    // Einfache Helligkeitsanpassung f�r Hex-Farben
    if (color.startsWith("#")) {
      const r = parseInt(color.substring(1, 3), 16);
      const g = parseInt(color.substring(3, 5), 16);
      const b = parseInt(color.substring(5, 7), 16);
      return `rgb(${Math.min(255, r * factor)}, ${Math.min(
        255,
        g * factor
      )}, ${Math.min(255, b * factor)})`;
    }
    return color;
  }

  function adjustSaturation(color, saturation) {
    // S�ttigungsanpassung f�r Hex-Farben (0.0 = grau, 1.0 = original)
    if (color.startsWith("#")) {
      const r = parseInt(color.substring(1, 3), 16) / 255;
      const g = parseInt(color.substring(3, 5), 16) / 255;
      const b = parseInt(color.substring(5, 7), 16) / 255;

      // Convert to grayscale
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;

      // Apply saturation
      const newR = gray + (r - gray) * saturation;
      const newG = gray + (g - gray) * saturation;
      const newB = gray + (b - gray) * saturation;

      return `rgb(${Math.floor(newR * 255)}, ${Math.floor(
        newG * 255
      )}, ${Math.floor(newB * 255)})`;
    }
    return color;
  }

  // Combo text rendering moved back to drawCentralBeatBar for static UI display

  function renderScreenFlash(ctx, state) {
    if (!state.screenFlash || !state.screenFlash.active) return;

    const flash = state.screenFlash;
    const currentTime = state.lastTime;
    const elapsed = currentTime - flash.startTime;

    // Check if flash duration has expired
    if (elapsed >= flash.duration) {
      flash.active = false;
      return;
    }

    // Calculate fade-out effect (starts at full opacity, fades to 0)
    const progress = elapsed / flash.duration;
    const alpha = 1.0 - progress; // Fade from 1.0 to 0.0

    // Extract color components and apply alpha
    const colorMatch = flash.color.match(
      /rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d.]+)?\)/
    );
    if (!colorMatch) return;

    const r = parseInt(colorMatch[1]);
    const g = parseInt(colorMatch[2]);
    const b = parseInt(colorMatch[3]);
    const baseAlpha = parseFloat(colorMatch[4] || 1.0);

    // Apply the fade-out alpha
    const finalAlpha = baseAlpha * alpha;

    // Draw the flash overlay
    ctx.save();
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${finalAlpha})`;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.restore();
  }

  // NEW: Render dance spot direction indicator when spot is off-screen
  function renderDanceSpotIndicator(ctx, state) {
    // Only show in dance mode
    if (!state.danceMode?.active || !state.danceMode.currentActiveSpot) {
      return;
    }

    const spot = state.danceMode.currentActiveSpot;
    if (!spot.pos) return;

    const spotX = spot.pos.x;
    const spotY = spot.pos.y;

    // Calculate viewport bounds in world space
    if (!state.camera) return;

    const viewWidth = GameState.CONSTANTS.NATIVE_WIDTH / state.camera.zoom;
    const viewHeight = GameState.CONSTANTS.NATIVE_HEIGHT / state.camera.zoom;

    const viewLeft = state.camera.x - viewWidth / 2;
    const viewRight = state.camera.x + viewWidth / 2;
    const viewTop = state.camera.y - viewHeight / 2;
    const viewBottom = state.camera.y + viewHeight / 2;

    // Check if spot is outside viewport
    const isOutsideViewport =
      spotX < viewLeft ||
      spotX > viewRight ||
      spotY < viewTop ||
      spotY > viewBottom;

    if (!isOutsideViewport) {
      return; // Spot is visible, no need for indicator
    }

    // Calculate direction to spot (8-directional)
    const centerX = (viewLeft + viewRight) / 2;
    const centerY = (viewTop + viewBottom) / 2;
    const dx = spotX - centerX;
    const dy = spotY - centerY;

    // Determine corner based on direction
    // We use canvas coordinates (not world coordinates) for drawing
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;

    // Normalize direction
    const angle = Math.atan2(dy, dx);
    const normalizedAngle = (angle + Math.PI * 2) % (Math.PI * 2);

    // Determine which corner to use
    let cornerX, cornerY;
    let gradientCenterX, gradientCenterY;

    // Map angle to corner (8 directions)
    if (normalizedAngle >= (7 * Math.PI) / 8 || normalizedAngle < Math.PI / 8) {
      // Right
      cornerX = canvasWidth;
      cornerY = canvasHeight / 2;
      gradientCenterX = canvasWidth;
      gradientCenterY = canvasHeight / 2;
    } else if (
      normalizedAngle >= Math.PI / 8 &&
      normalizedAngle < (3 * Math.PI) / 8
    ) {
      // Bottom-right
      cornerX = canvasWidth;
      cornerY = canvasHeight;
      gradientCenterX = canvasWidth;
      gradientCenterY = canvasHeight;
    } else if (
      normalizedAngle >= (3 * Math.PI) / 8 &&
      normalizedAngle < (5 * Math.PI) / 8
    ) {
      // Bottom
      cornerX = canvasWidth / 2;
      cornerY = canvasHeight;
      gradientCenterX = canvasWidth / 2;
      gradientCenterY = canvasHeight;
    } else if (
      normalizedAngle >= (5 * Math.PI) / 8 &&
      normalizedAngle < (7 * Math.PI) / 8
    ) {
      // Bottom-left
      cornerX = 0;
      cornerY = canvasHeight;
      gradientCenterX = 0;
      gradientCenterY = canvasHeight;
    } else if (
      normalizedAngle >= (7 * Math.PI) / 8 &&
      normalizedAngle < (9 * Math.PI) / 8
    ) {
      // Left
      cornerX = 0;
      cornerY = canvasHeight / 2;
      gradientCenterX = 0;
      gradientCenterY = canvasHeight / 2;
    } else if (
      normalizedAngle >= (9 * Math.PI) / 8 &&
      normalizedAngle < (11 * Math.PI) / 8
    ) {
      // Top-left
      cornerX = 0;
      cornerY = 0;
      gradientCenterX = 0;
      gradientCenterY = 0;
    } else if (
      normalizedAngle >= (11 * Math.PI) / 8 &&
      normalizedAngle < (13 * Math.PI) / 8
    ) {
      // Top
      cornerX = canvasWidth / 2;
      cornerY = 0;
      gradientCenterX = canvasWidth / 2;
      gradientCenterY = 0;
    } else {
      // Top-right
      cornerX = canvasWidth;
      cornerY = 0;
      gradientCenterX = canvasWidth;
      gradientCenterY = 0;
    }

    // Create subtle technicolor gradient
    // Gradient size: smaller for subtlety
    const gradientSize = Math.min(canvasWidth, canvasHeight) * 0.15; // 15% of screen size

    // Validate all values are finite before creating gradient
    if (
      Number.isFinite(gradientCenterX) &&
      Number.isFinite(gradientCenterY) &&
      Number.isFinite(gradientSize) &&
      gradientSize > 0
    ) {
      // Create radial gradient from corner
      const gradient = ctx.createRadialGradient(
        gradientCenterX,
        gradientCenterY,
        0,
        gradientCenterX,
        gradientCenterY,
        gradientSize
      );

      // Technicolor colors: subtle rainbow gradient
      // Very low opacity for subtlety (0.08 to 0.15)
      const baseOpacity = 0.12;
      gradient.addColorStop(0, `rgba(255, 0, 128, ${baseOpacity})`); // Magenta
      gradient.addColorStop(0.3, `rgba(255, 100, 0, ${baseOpacity * 0.8})`); // Orange
      gradient.addColorStop(0.6, `rgba(100, 255, 0, ${baseOpacity * 0.6})`); // Yellow-green
      gradient.addColorStop(1, `rgba(0, 0, 0, 0)`); // Transparent edge

      // Draw gradient
      ctx.save();
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      ctx.restore();
    }
  }

  // NEW: Render match end visual effects
  function renderMatchEndEffects(ctx, state) {
    if (!state.matchEnd || !state.matchEnd.isActive) return;

    const me = state.matchEnd;

    // Enhanced screen graying effect - more dramatic
    if (me.screenGrayAlpha > 0) {
      ctx.save();
      // Use a more dramatic darkening effect
      ctx.fillStyle = `rgba(20, 20, 20, ${me.screenGrayAlpha * 0.8})`;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

      // Add a subtle vignette effect for more drama
      const centerX = ctx.canvas.width / 2;
      const centerY = ctx.canvas.height / 2;
      const radius = Math.max(ctx.canvas.width, ctx.canvas.height) / 2;

      // Validate all values are finite before creating gradient
      if (
        Number.isFinite(centerX) &&
        Number.isFinite(centerY) &&
        Number.isFinite(radius) &&
        radius > 0
      ) {
        const gradient = ctx.createRadialGradient(
          centerX,
          centerY,
          0,
          centerX,
          centerY,
          radius
        );
        gradient.addColorStop(0, `rgba(0, 0, 0, ${me.screenGrayAlpha * 0.3})`);
        gradient.addColorStop(1, `rgba(0, 0, 0, ${me.screenGrayAlpha * 0.8})`);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      }
      ctx.restore();
    }

    // Winner highlighting effect (during zooming and beatmatching phases)
    if (
      (me.phase === "zooming" || me.phase === "beatmatching") &&
      me.winner !== null
    ) {
      const winner = state.players[me.winner];
      if (winner && !winner.eliminated && winner.pos) {
        // Draw a subtle glow around the winner
        ctx.save();

        // Calculate winner position in screen coordinates
        // Validate all values to prevent NaN/Infinity errors
        const camX = state.camera?.x ?? 0;
        const camY = state.camera?.y ?? 0;
        const camZoom = state.camera?.zoom ?? 1;
        const posX = winner.pos?.x ?? 0;
        const posY = winner.pos?.y ?? 0;

        const screenX = (posX - camX) * camZoom + ctx.canvas.width / 2;
        const screenY = (posY - camY) * camZoom + ctx.canvas.height / 2;

        // Validate that all values are finite before creating gradient
        if (
          Number.isFinite(screenX) &&
          Number.isFinite(screenY) &&
          Number.isFinite(ctx.canvas.width) &&
          Number.isFinite(ctx.canvas.height)
        ) {
          // Create radial gradient for glow effect
          const gradient = ctx.createRadialGradient(
            screenX,
            screenY,
            50,
            screenX,
            screenY,
            150
          );
          gradient.addColorStop(0, "rgba(255, 215, 0, 0.3)"); // Gold center
          gradient.addColorStop(0.5, "rgba(255, 165, 0, 0.2)"); // Orange middle
          gradient.addColorStop(1, "rgba(255, 69, 0, 0.0)"); // Red outer (transparent)

          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        }

        ctx.restore();
      }
    }

    // Modal slide-in animation
    if (me.modalSlideOffset > 0) {
      ctx.save();
      ctx.translate(0, ctx.canvas.height * me.modalSlideOffset);

      // Draw modal background (will be handled by UI components)
      // This is just for the slide animation

      ctx.restore();
    }
  }

  return {
    render,
    getHurtbox,
    getR1Hitbox,
    getR2Hitbox,
    getR2ComboHitbox,
    getR1JumpHitbox,
    getR1DashHitbox,
    getR1ComboHitbox,
    getR1CircleHitbox,
    getL1JabHitbox,
    getL1SmashHitbox,
    getR1UpAttackHitbox,
    getProjectileHitbox,
    getL2HitboxLeft,
    getL2HitboxRight,
    getL2SmashHitbox,
    getL1RangedGrabHitbox,
    getL1RangedComboHitbox,
    warmupFonts,
    setFontCached,
  };
})();
