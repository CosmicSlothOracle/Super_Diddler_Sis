window.GameAssets = (() => {
  const isElectronRenderer =
    typeof window !== "undefined" &&
    typeof window.process === "object" &&
    window.process.type === "renderer";

  const nodeRequire =
    typeof window !== "undefined" && typeof window.require === "function"
      ? window.require
      : typeof globalThis !== "undefined" &&
        typeof globalThis.require === "function"
      ? globalThis.require
      : null;

  let fs = null;
  let pathModule = null;
  let pathToFileURL = null;

  if (isElectronRenderer && nodeRequire) {
    try {
      fs = nodeRequire("fs");
    } catch (error) {
      fs = null;
    }

    try {
      pathModule = nodeRequire("path");
    } catch (error) {
      pathModule = null;
    }

    try {
      ({ pathToFileURL } = nodeRequire("url"));
    } catch (error) {
      pathToFileURL = null;
    }
  }
  const isFileProtocol =
    typeof window !== "undefined" &&
    window.location &&
    window.location.protocol === "file:";

  let scriptDir = null;
  if (isElectronRenderer && pathModule) {
    try {
      if (typeof document !== "undefined" && document.currentScript?.src) {
        const scriptUrl = new URL(document.currentScript.src);
        if (scriptUrl.protocol === "file:") {
          let pathname = decodeURIComponent(scriptUrl.pathname);
          if (
            typeof process !== "undefined" &&
            process.platform === "win32" &&
            pathname.startsWith("/")
          ) {
            pathname = pathname.slice(1);
          }
          scriptDir = pathModule.dirname(pathname);
        }
      }
    } catch (error) {
      // Ignore and fallback
    }

    if (!scriptDir && typeof __dirname === "string" && __dirname) {
      scriptDir = __dirname;
    }
  }

  const devBaseDir = isElectronRenderer
    ? scriptDir
      ? pathModule
        ? pathModule.resolve(scriptDir, "..")
        : scriptDir
      : typeof process !== "undefined" && typeof process.cwd === "function"
      ? process.cwd()
      : null
    : null;

  let electronBasePath = null;
  if (isElectronRenderer && pathModule && fs) {
    try {
      const resourcesPath = process.resourcesPath || "";
      const asarPath = pathModule.join(resourcesPath, "app.asar");
      const unpackedPath = pathModule.join(resourcesPath, "app");

      if (fs && fs.existsSync(asarPath)) {
        electronBasePath = asarPath;
      } else if (fs && fs.existsSync(unpackedPath)) {
        electronBasePath = unpackedPath;
      } else {
        electronBasePath = devBaseDir;
      }
    } catch (error) {
      electronBasePath = devBaseDir;
    }
  }

  console.log("[GameAssets] init", {
    isElectronRenderer,
    hasNodeRequire: !!nodeRequire,
    hasFs: !!fs,
    hasPath: !!pathModule,
    hasPathToFileURL: !!pathToFileURL,
    scriptDir,
    devBaseDir,
    electronBasePath,
  });

  function shouldUseFileSystem() {
    return isElectronRenderer && isFileProtocol && !!electronBasePath;
  }

  function isFileNotFound(error) {
    return (
      error &&
      (error.code === "ENOENT" ||
        error.code === "ENOTDIR" ||
        error.code === "EINVAL")
    );
  }

  function stripQuery(src) {
    const [noQuery] = src.split("?");
    return noQuery.split("#")[0];
  }

  function resolveAbsolutePath(src) {
    if (!isElectronRenderer || !isFileProtocol || !fs || !pathModule) {
      return null;
    }
    if (/^(https?:|data:)/i.test(src)) return null;

    const normalizedSrc = stripQuery(src).replace(/^\//, "");
    const baseCandidates = [];

    if (electronBasePath) baseCandidates.push(electronBasePath);
    if (devBaseDir) baseCandidates.push(devBaseDir);
    if (scriptDir && pathModule)
      baseCandidates.push(pathModule.resolve(scriptDir));
    if (typeof process !== "undefined" && typeof process.cwd === "function") {
      baseCandidates.push(process.cwd());
    }

    for (const base of baseCandidates) {
      if (!base) continue;
      if (!pathModule) break;
      try {
        const candidate = pathModule.join(base, normalizedSrc);
        if (fs && fs.existsSync(candidate)) {
          return candidate;
        }
      } catch (error) {
        // ignore and try next candidate
      }
    }

    if (baseCandidates.length > 0 && baseCandidates[0]) {
      return pathModule
        ? pathModule.join(baseCandidates[0], normalizedSrc)
        : null;
    }

    return null;
  }

  async function readBinaryFile(src) {
    const absolute = resolveAbsolutePath(src);
    if (!absolute || !fs) return null;
    return fs.promises.readFile(absolute);
  }

  function toFileUrl(src) {
    if (!shouldUseFileSystem()) return src;
    if (/^(https?:|data:)/i.test(src)) return src;
    const absolute = resolveAbsolutePath(src);
    if (!absolute) return src;
    return pathToFileURL ? pathToFileURL(absolute).href : src;
  }

  function inferMimeType(src) {
    const clean = stripQuery(src).toLowerCase();
    if (clean.endsWith(".png")) return "image/png";
    if (clean.endsWith(".jpg") || clean.endsWith(".jpeg")) return "image/jpeg";
    if (clean.endsWith(".gif")) return "image/gif";
    if (clean.endsWith(".json")) return "application/json";
    if (clean.endsWith(".webp")) return "image/webp";
    if (clean.endsWith(".webm")) return "video/webm";
    return "application/octet-stream";
  }

  async function fetchJson(src) {
    if (shouldUseFileSystem()) {
      const buffer = await readBinaryFile(src);
      if (!buffer) throw new Error(`Failed to load ${src}`);
      return JSON.parse(buffer.toString("utf8"));
    }

    const res = await fetch(src);
    if (!res.ok) throw new Error(`Failed to fetch ${src}: ${res.status}`);
    return res.json();
  }

  /**
   * Load image using createImageBitmap for off-thread decoding.
   * Falls back to Image() if createImageBitmap is not available.
   * Returns Image object that can be used with Canvas2D.
   * Canvas2D can draw ImageBitmap directly, but we convert to Image for compatibility.
   */
  async function loadImageFormat(src, format) {
    // Replace extension with requested format
    const basePath = src.replace(/\.(png|jpg|jpeg|webp|avif)$/i, '');
    const formatPath = `${basePath}.${format}`;

    try {
      let blob = null;

      if (shouldUseFileSystem()) {
        const buffer = await readBinaryFile(formatPath);
        if (!buffer) throw new Error(`Failed to load ${formatPath}`);
        blob = new Blob([buffer], { type: inferMimeType(formatPath) });
      } else {
        const res = await fetch(formatPath);
        if (!res.ok) throw new Error(`Failed to fetch ${formatPath}: ${res.status}`);
        blob = await res.blob();
      }

      return blob;
    } catch (error) {
      throw error; // Re-throw to allow fallback chain
    }
  }

  async function loadImage(src) {
    // Try modern formats first (AVIF > WebP > PNG)
    const formats = ['avif', 'webp', 'png'];
    let blob = null;
    let usedFormat = 'png';

    // Check browser support (simplified - fallback chain handles unsupported formats)
    // Note: Format detection via toDataURL is unreliable, so we rely on fetch errors for detection
    const supportsAVIF = true; // Try AVIF first, fallback on error
    const supportsWebP = true; // Try WebP second, fallback on error

    // Filter formats based on browser support
    const supportedFormats = formats.filter(format => {
      if (format === 'avif') return supportsAVIF;
      if (format === 'webp') return supportsWebP;
      return true; // PNG always supported
    });

    // Try formats in priority order
    for (const format of supportedFormats) {
      try {
        blob = await loadImageFormat(src, format);
        usedFormat = format;
        break; // Success, exit loop
      } catch (error) {
        // Try next format
        continue;
      }
    }

    // Fallback to original src if all formats failed
    if (!blob) {
      try {
        if (shouldUseFileSystem()) {
          const buffer = await readBinaryFile(src);
          if (!buffer) throw new Error(`Failed to load ${src}`);
          blob = new Blob([buffer], { type: inferMimeType(src) });
        } else {
          const res = await fetch(src);
          if (!res.ok) throw new Error(`Failed to fetch ${src}: ${res.status}`);
          blob = await res.blob();
        }
      } catch (error) {
        console.error(`Failed to load image in any format: ${src}`, error);
        throw error;
      }
    }

    try {

      let bitmap = null;
      if (typeof createImageBitmap !== "undefined") {
        try {
          bitmap = await createImageBitmap(blob, {
            premultiplyAlpha: "premultiply",
            imageOrientation: "none",
            colorSpaceConversion: "none",
          });
        } catch (bitmapError) {
          console.warn(
            `createImageBitmap failed for ${src}, falling back to Image():`,
            bitmapError
          );
        }
      }

      const objectUrl = URL.createObjectURL(blob);

      const img = new Image();
      img.decoding = "async";
      img.src = objectUrl;

      try {
        if (typeof img.decode === "function") {
          await img.decode();
        } else {
          await new Promise((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = reject;
          });
        }
      } catch (decodeError) {
        console.warn(
          `Image.decode failed for ${src}, using onload fallback`,
          decodeError
        );
        await new Promise((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
        });
      }

      URL.revokeObjectURL(objectUrl);

      if (bitmap) {
        img._bitmap = bitmap;
        img._decodedOffThread = true;
      } else {
        img._decodedOffThread = false;
      }

      return img;
    } catch (error) {
      console.error(`Failed to load image ${src}:`, error);
      throw error;
    }
  }

  /**
   * Warm up image decoding by drawing it to an offscreen canvas.
   * This forces decode/upload before first actual render.
   * Returns a promise that resolves when warmup is complete.
   */
  async function warmupImage(img) {
    if (!img) return Promise.resolve();

    try {
      // Use OffscreenCanvas if available, fallback to regular canvas
      let offscreen, ctx;
      if (typeof OffscreenCanvas !== "undefined") {
        offscreen = new OffscreenCanvas(
          Math.min(img.width || 64, 64),
          Math.min(img.height || 64, 64)
        );
        ctx = offscreen.getContext("2d", {
          alpha: true,
          willReadFrequently: false,
        });
      } else {
        // Fallback for browsers without OffscreenCanvas
        const canvas = document.createElement("canvas");
        canvas.width = Math.min(img.width || 64, 64);
        canvas.height = Math.min(img.height || 64, 64);
        ctx = canvas.getContext("2d", {
          alpha: true,
          willReadFrequently: false,
        });
      }

      // Draw image at tiny size to trigger decode/upload pipeline
      // This ensures GPU texture cache is warm before first real draw
      const source = img._bitmap || img;
      ctx.drawImage(source, 0, 0, 1, 1);

      // Optional: Draw a few more variations to warm up scaling paths
      const srcWidth =
        source.width ||
        source.naturalWidth ||
        img.width ||
        img.naturalWidth ||
        1;
      const srcHeight =
        source.height ||
        source.naturalHeight ||
        img.height ||
        img.naturalHeight ||
        1;

      ctx.drawImage(source, 0, 0, srcWidth, srcHeight, 0, 0, 2, 2);

      return Promise.resolve();
    } catch (error) {
      // Silent fail - warmup is best-effort
      console.debug(`Warmup failed for image (non-critical):`, error);
      return Promise.resolve(); // Always resolve, never reject
    }
  }

  /**
   * Warm up all critical spritesheets before match starts.
   * This prevents stuttering on first sprite draw.
   */
  async function warmupSpritesheets(state) {
    const startTime = performance.now();
    console.log("🔥 Starting sprite warmup phase...");

    const warmupPromises = [];

    // Warm up character atlases
    if (state.characterConfigs) {
      for (const charName in state.characterConfigs) {
        const charData = state.characterConfigs[charName];
        if (charData && charData.atlasImage) {
          warmupPromises.push(warmupImage(charData.atlasImage));
        }
      }
    }

    // Warm up FX atlases
    if (state.fxAtlas && state.fxAtlas.atlasImage) {
      warmupPromises.push(warmupImage(state.fxAtlas.atlasImage));
    }
    if (state.fxAtlas2 && state.fxAtlas2.atlasImage) {
      warmupPromises.push(warmupImage(state.fxAtlas2.atlasImage));
    }
    if (state.fxAtlas3 && state.fxAtlas3.atlasImage) {
      warmupPromises.push(warmupImage(state.fxAtlas3.atlasImage));
    }

    // Warm up UI atlas
    if (state.uiAtlasImage) {
      warmupPromises.push(warmupImage(state.uiAtlasImage));
    }

    // Warm up stage layers
    if (state.bg) warmupPromises.push(warmupImage(state.bg));
    if (state.bgLayer) warmupPromises.push(warmupImage(state.bgLayer));
    if (state.mid) warmupPromises.push(warmupImage(state.mid));
    if (state.fg) warmupPromises.push(warmupImage(state.fg));

    // Warm up stage FX atlas if present
    if (state.stageFxAtlas && state.stageFxAtlas.atlasImage) {
      warmupPromises.push(warmupImage(state.stageFxAtlas.atlasImage));
    }

    // Wait for all warmups to complete (in parallel)
    await Promise.all(warmupPromises);

    const warmupTime = performance.now() - startTime;
    console.log(`✅ Sprite warmup complete in ${warmupTime.toFixed(2)}ms`);

    return warmupTime;
  }

  function loadVideo(src) {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.addEventListener("loadeddata", () => resolve(video));
      video.onerror = reject;
      video.src = toFileUrl(src);
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      const playResult = video.play();
      if (playResult && typeof playResult.catch === "function") {
        playResult.catch((err) => {
          console.warn(`Video playback failed for ${src}:`, err);
        });
      }
    });
  }

  async function loadCharacterAssets(state) {
    const C = GameState.CONSTANTS;
    const cacheBuster = `?v=${Date.now()}`;
    for (const charName of state.selectedCharacters) {
      if (state.characterConfigs[charName]) continue; // Already loaded

      const configPath = `${C.CHAR_DIR}/${charName}/config.json${cacheBuster}`;
      const config = await fetchJson(configPath);

      const atlasJsonPath = `${config.atlas_path}.json${cacheBuster}`;
      const atlasData = await fetchJson(atlasJsonPath);

      const atlasImagePath = `${config.atlas_path}.png`;
      const atlasImage = await loadImage(atlasImagePath);

      // Track asset for memory management
      if (window.MemoryManager) {
        window.MemoryManager.trackAsset(atlasImagePath, atlasImage);
      }

      const animations = atlasData.animations || {};

      // TEMP PATCH: legacy cyboard atlases ship without l1_release frames.
      // Until the sprite export catches up, alias l1_release to l1_start so the
      // attack handler stops spamming fallback logs. We clone the sequence so
      // downstream mutations (loop tweaks etc.) stay isolated.
      if (
        charName === "cyboard" &&
        !animations.l1_release &&
        Array.isArray(animations.l1_start)
      ) {
        animations.l1_release = animations.l1_start.map((frame) =>
          typeof frame === "string" ? frame : { ...frame }
        );
      }

      state.characterConfigs[charName] = {
        config,
        frames: atlasData.frames,
        animations,
        atlasImage,
        fps: atlasData.meta?.fps ?? 12,
      };
    }
  }

  async function loadStageAssets(state, stagePath) {
    const C = GameState.CONSTANTS;

    // Extract sectionKey from stagePath
    // stagePath format: "levels/sidescroller/ninja_stage/sections/pvp_stage"
    const pathParts = stagePath.split("/");
    const sectionKey = pathParts[pathParts.length - 1]; // Last part is sectionKey

    const heatmapPath = `${stagePath}/${C.HEATMAP_DIR}`;

    // NEW: Check if this is a tile-based stage (story mode)
    const isTileBased = stagePath.includes("/story/");

    if (isTileBased) {
      // Load tiles for story mode
      state.useTiles = true;
      state.bgTiles = [];
      state.midTiles = [];
      state.tileWidth = GameState.CONSTANTS.NATIVE_WIDTH; // Default tile width

      // Load bg tiles
      let bgTileIndex = 0;
      while (true) {
        try {
          const bgTile = await loadImage(
            `${stagePath}/bg_tile_${String(bgTileIndex).padStart(2, "0")}.png`
          );
          state.bgTiles.push(bgTile);
          bgTileIndex++;
          // Get tile width from first tile
          if (bgTileIndex === 1) {
            state.tileWidth =
              bgTile.naturalWidth ||
              bgTile.width ||
              GameState.CONSTANTS.NATIVE_WIDTH;
          }
        } catch (e) {
          break; // No more tiles
        }
      }
      console.log(
        `[Assets] Loaded ${state.bgTiles.length} background tiles for ${sectionKey}`
      );

      // Load mid tiles
      let midTileIndex = 0;
      while (true) {
        try {
          const midTile = await loadImage(
            `${stagePath}/mid_tile_${String(midTileIndex).padStart(2, "0")}.png`
          );
          state.midTiles.push(midTile);
          midTileIndex++;
        } catch (e) {
          // Try alternative naming (with closing parenthesis)
          try {
            const midTile = await loadImage(
              `${stagePath}/mid_tile_${String(midTileIndex).padStart(
                2,
                "0"
              )}).png`
            );
            state.midTiles.push(midTile);
            midTileIndex++;
          } catch (e2) {
            break; // No more tiles
          }
        }
      }
      console.log(
        `[Assets] Loaded ${state.midTiles.length} mid tiles for ${sectionKey}`
      );

      // Set stage length based on tiles
      if (state.bgTiles.length > 0) {
        const stageLength = state.bgTiles.length * state.tileWidth;
        if (!state.cameraBounds) {
          state.cameraBounds = {
            x: 0,
            y: 0,
            width: stageLength,
            height: GameState.CONSTANTS.NATIVE_HEIGHT,
          };
        } else {
          state.cameraBounds.width = stageLength;
        }
        console.log(
          `[Assets] Story stage length: ${stageLength}px (${state.bgTiles.length} tiles)`
        );
      }

      // No fg for tile-based stages (or load if exists)
      try {
        state.fg = await loadImage(`${stagePath}/fg.png`);
      } catch (e) {
        state.fg = null;
      }
    } else {
      // Normal stage loading (non-tile-based)
      state.useTiles = false;

      // Load animated background if it exists
      const videoPath = `${stagePath}/bg_animated/bg.webm`;
      try {
        state.bgVideo = await loadVideo(videoPath);
      } catch (e) {
        console.log(
          "No animated background found for this stage. Loading static."
        );
        state.bg = await loadImage(`${stagePath}/bg.png`);
      }

      // NEW: Load background layer (optional - for stage animations)
      try {
        state.bgLayer = await loadImage(`${stagePath}/bg_layer.png`);
        console.log(`[Assets] Loaded background layer for ${sectionKey}`);
      } catch (e) {
        console.log(
          `[Assets] No background layer found for ${sectionKey} (optional)`
        );
        state.bgLayer = null;
      }

      state.mid = await loadImage(`${stagePath}/mid.png`);
      state.fg = await loadImage(`${stagePath}/fg.png`);
    }

    // Load heatmaps
    const groundImg = await loadImage(`${heatmapPath}/ground.png`);
    state.groundData = getImageData(groundImg);
    const semisolidImg = await loadImage(`${heatmapPath}/semisolid.png`);
    state.semisolidData = getImageData(semisolidImg);
    const killImg = await loadImage(`${heatmapPath}/kill.png`);
    state.killData = getImageData(killImg);

    // Load stage metadata first to get camera bounds for spawn scaling
    state.cameraBounds = null;
    state.stageMinZoom = 1.0;
    state.stageMaxZoom = 2.03125;
    state.stageDisableAutoZoom = false;
    try {
      const meta = await fetchJson(
        `${stagePath}/meta.json?cacheBust=${Date.now()}`
      );

      if (meta) {
        // Load camera bounds
        if (meta.camera_bounds) {
          const bounds = meta.camera_bounds;
          state.cameraBounds = {
            x: bounds.x ?? 0,
            y: bounds.y ?? 0,
            width: bounds.width ?? GameState.CONSTANTS.NATIVE_WIDTH,
            height: bounds.height ?? GameState.CONSTANTS.NATIVE_HEIGHT,
          };
        }

        // Load zoom settings
        state.stageMinZoom = meta.minZoom ?? 1.0;
        state.stageMaxZoom = meta.maxZoom ?? 2.03125;
        state.stageDisableAutoZoom = meta.disableAutoZoom ?? false;
        state.stageHighRes = meta.highResStage ?? false;

        // Load optional camera enhancements (deadzone, padding scale, intro lock)
        if (meta.deadzone && typeof meta.deadzone === "object") {
          const dz = meta.deadzone;
          state.cameraDeadzone = {
            width: typeof dz.width === "number" ? dz.width : 0,
            height: typeof dz.height === "number" ? dz.height : 0,
          };
        } else {
          state.cameraDeadzone = state.cameraDeadzone ?? null;
        }

        if (meta.paddingScale && typeof meta.paddingScale === "object") {
          const ps = meta.paddingScale;
          state.cameraPaddingScale = {
            x: typeof ps.x === "number" ? ps.x : null,
            y: typeof ps.y === "number" ? ps.y : null,
          };
        } else {
          state.cameraPaddingScale = state.cameraPaddingScale ?? null;
        }

        if (typeof meta.introLockFrames === "number") {
          state.cameraIntroLockFrames = meta.introLockFrames | 0;
        } else {
          state.cameraIntroLockFrames = state.cameraIntroLockFrames ?? 0;
        }

        // NEW: Load intro timeout frames (for faster zoom-out)
        if (typeof meta.introTimeoutFrames === "number") {
          state.cameraIntroTimeoutFrames = meta.introTimeoutFrames | 0;
        } else {
          state.cameraIntroTimeoutFrames =
            state.cameraIntroTimeoutFrames ?? undefined;
        }

        // NEW: Load camera intro hold until close setting
        if (typeof meta.cameraIntroHoldUntilClose === "boolean") {
          state.cameraIntroHoldUntilClose = meta.cameraIntroHoldUntilClose;
        } else {
          state.cameraIntroHoldUntilClose =
            state.cameraIntroHoldUntilClose ?? true;
        }

        // NEW: Load max zoom per second (for faster zoom-out)
        if (typeof meta.maxZoomPerSec === "number") {
          state.cameraMaxZoomPerSec = meta.maxZoomPerSec;
        } else {
          state.cameraMaxZoomPerSec = state.cameraMaxZoomPerSec ?? 1.5;
        }

        // Predictive lead factor (X only for iteration 2)
        if (typeof meta.predictiveLeadFactor === "number") {
          state.cameraPredictiveLeadFactor = meta.predictiveLeadFactor;
        } else if (state.cameraPredictiveLeadFactor === undefined) {
          state.cameraPredictiveLeadFactor = 0;
        }
        // Lock camera to bounds center (no tracking)
        state.cameraLockToBounds = !!meta.lockCameraToBounds;

        // Blast bounds (extreme mode) and toggle
        if (meta.blast_bounds && typeof meta.blast_bounds === "object") {
          const bb = meta.blast_bounds;
          state.cameraBlastBounds = {
            x: typeof bb.x === "number" ? bb.x : 0,
            y: typeof bb.y === "number" ? bb.y : 0,
            width:
              typeof bb.width === "number"
                ? bb.width
                : state.cameraBounds?.width ?? GameState.CONSTANTS.NATIVE_WIDTH,
            height:
              typeof bb.height === "number"
                ? bb.height
                : state.cameraBounds?.height ??
                  GameState.CONSTANTS.NATIVE_HEIGHT,
          };
        } else {
          state.cameraBlastBounds = state.cameraBlastBounds ?? null;
        }

        state.cameraEnableBlastBounds = !!meta.enableBlastBounds;

        console.log(
          `📷 Stage zoom settings loaded: minZoom=${state.stageMinZoom}, maxZoom=${state.stageMaxZoom}, disableAutoZoom=${state.stageDisableAutoZoom}, highRes=${state.stageHighRes}`
        );

        // Deprecated: maxZoomMultiplier (for backwards compatibility)
        if (typeof meta.maxZoomMultiplier === "number") {
          console.warn(
            "maxZoomMultiplier is deprecated, use minZoom/maxZoom instead"
          );
          state.stageMaxZoom = 2.03125 * meta.maxZoomMultiplier;
          console.log(
            `📷 maxZoomMultiplier converted: ${meta.maxZoomMultiplier} → maxZoom=${state.stageMaxZoom}`
          );
        }
      }
    } catch (err) {
      if (isFileNotFound(err)) {
        console.log(`No stage metadata for ${stagePath}`);
      } else {
        console.warn(`Failed to load stage metadata for ${stagePath}:`, err);
      }
    }

    // Load and parse spawn points (after metadata so camera bounds are available)
    const spawnImg = await loadImage(`${heatmapPath}/spawn.png`);
    // Use camera bounds dimensions if available (scaled stages), otherwise use native/viewport
    const spawnScaleWidth =
      state.cameraBounds?.width ?? GameState.CONSTANTS.NATIVE_WIDTH;
    const spawnScaleHeight =
      state.cameraBounds?.height ?? GameState.CONSTANTS.NATIVE_HEIGHT;
    const spawnData = parseSpawns(spawnImg, {
      width: spawnScaleWidth,
      height: spawnScaleHeight,
    });
    // Backward compatibility: keep spawnPoints as array for player spawns
    state.spawnPoints = spawnData.players || [];
    // NEW: Store NPC spawns separately
    state.npcSpawnPoints = spawnData.npcs || [];

    // Load extended heatmaps (optional - with error handling)
    try {
      const frictionImg = await loadImage(`${heatmapPath}/friction.png`);
      state.frictionData = getImageData(frictionImg);
      console.log(`[Assets] Loaded friction heatmap for ${sectionKey}`);
    } catch (e) {
      console.log(
        `[Assets] No friction heatmap found for ${sectionKey} (optional)`
      );
      state.frictionData = null;
    }

    // Load walljump heatmap (bounce_wall.png) - separate try-catch
    try {
      const walljumpImg = await loadImage(`${heatmapPath}/bounce_wall.png`);
      state.walljumpData = getImageData(walljumpImg);
      console.log(
        `[Assets] Loaded walljump heatmap for ${sectionKey} - Size: ${walljumpImg.width}x${walljumpImg.height}`
      );
    } catch (e) {
      console.log(
        `[Assets] No walljump heatmap found for ${sectionKey} (optional)`
      );
      state.walljumpData = null;
    }

    try {
      const hazardImg = await loadImage(`${heatmapPath}/hazard.png`);
      state.hazardData = getImageData(hazardImg);
      console.log(`[Assets] Loaded hazard heatmap for ${sectionKey}`);
    } catch (e) {
      console.log(
        `[Assets] No hazard heatmap found for ${sectionKey} (optional)`
      );
      state.hazardData = null;
    }

    try {
      const bounceImg = await loadImage(`${heatmapPath}/bounce.png`);
      state.bounceData = getImageData(bounceImg);
      console.log(`[Assets] Loaded bounce heatmap for ${sectionKey}`);
    } catch (e) {
      console.log(
        `[Assets] No bounce heatmap found for ${sectionKey} (optional)`
      );
      state.bounceData = null;
    }

    try {
      const speedImg = await loadImage(`${heatmapPath}/speed.png`);
      state.speedData = getImageData(speedImg);
      console.log(`[Assets] Loaded speed heatmap for ${sectionKey}`);
    } catch (e) {
      console.log(
        `[Assets] No speed heatmap found for ${sectionKey} (optional)`
      );
      state.speedData = null;
    }

    try {
      const specialImg = await loadImage(`${heatmapPath}/special.png`);
      state.specialData = getImageData(specialImg);
      console.log(`[Assets] Loaded special heatmap for ${sectionKey}`);
    } catch (e) {
      console.log(
        `[Assets] No special heatmap found for ${sectionKey} (optional)`
      );
      state.specialData = null;
    }

    // NEW: Load dedicated UI animation heatmap (anim_ui.png)
    try {
      const animUiImg = await loadImage(`${heatmapPath}/anim_ui.png`);
      state.animUiData = getImageData(animUiImg);
      console.log(`[Assets] Loaded anim_ui heatmap for ${sectionKey}`);
    } catch (e) {
      console.log(
        `[Assets] No anim_ui heatmap found for ${sectionKey} (optional)`
      );
      state.animUiData = null;
    }

    // NEW: Load dedicated Dance Zone heatmap (zone.png)
    try {
      const zoneImg = await loadImage(`${heatmapPath}/zone.png`);
      state.zoneData = getImageData(zoneImg);
      console.log(`[Assets] Loaded zone heatmap for ${sectionKey}`);
    } catch (e) {
      console.log(
        `[Assets] No zone heatmap found for ${sectionKey} (optional, required for Dance Mode 2.0)`
      );
      state.zoneData = null;
    }

    // NEW: Load stage-specific animations if they exist
    const cacheBuster = `?v=${Date.now()}`;
    const stageFxAtlasPath = `${stagePath}/stage_animations/atlas.json${cacheBuster}`;
    try {
      const atlasData = await fetchJson(stageFxAtlasPath);
      const atlasImage = await loadImage(
        `${stagePath}/stage_animations/atlas.png`
      );

      const metaSize = atlasData.meta?.size || null;
      const expectedWidth = metaSize?.w || atlasImage.width || 1;
      const expectedHeight = metaSize?.h || atlasImage.height || 1;
      const sourceScaleX = atlasImage.width / expectedWidth;
      const sourceScaleY = atlasImage.height / expectedHeight;
      const hasSourceScaleMismatch =
        Math.abs(sourceScaleX - 1) > 0.01 || Math.abs(sourceScaleY - 1) > 0.01;

      if (hasSourceScaleMismatch) {
        console.log(
          `[Assets] Stage FX atlas appears scaled (image ${atlasImage.width}x${
            atlasImage.height
          } vs meta ${expectedWidth}x${expectedHeight}). Applying source scale correction: ${sourceScaleX.toFixed(
            3
          )}x, ${sourceScaleY.toFixed(3)}x`
        );
      }

      state.stageFxAtlas = {
        frames: atlasData.frames,
        animations: atlasData.animations,
        atlasImage,
        fps: atlasData.meta?.fps ?? 12,
        meta: atlasData.meta || {},
        sourceScaleX,
        sourceScaleY,
      };
      console.log(`Loaded stage-specific FX for ${stagePath}`);
    } catch (e) {
      // It's okay if a stage has no specific effects
      console.log(`No stage-specific FX found for ${stagePath}.`);
      state.stageFxAtlas = null;
    }
  }

  async function loadGlobalFxAssets(state) {
    // Add cache busting to ensure latest version is loaded
    const cacheBuster = `?v=${Date.now()}`;

    // Load atlas_fx (main effects)
    const atlasData = await fetchJson(
      `assets/effects/atlas_fx.json${cacheBuster}`
    );

    const atlasImage = await loadImage("assets/effects/atlas_fx.png");

    state.fxAtlas = {
      frames: atlasData.frames,
      animations: atlasData.animations,
      atlasImage,
      fps: atlasData.meta?.fps ?? 12,
    };

    // Load atlas_fx2 (blood effects)
    try {
      const atlas2Data = await fetchJson(
        `assets/effects/atlas_fx2.json${cacheBuster}`
      );
      const atlas2Image = await loadImage("assets/effects/atlas_fx2.png");

      state.fxAtlas2 = {
        frames: atlas2Data.frames,
        animations: atlas2Data.animations,
        atlasImage: atlas2Image,
        fps: atlas2Data.meta?.fps ?? 12,
      };

      console.log("✅ Global FX assets loaded (atlas_fx + atlas_fx2)");
    } catch (error) {
      console.log("⚠️ atlas_fx2 not found, blood effects will be disabled");
      state.fxAtlas2 = null;
    }

    // Load atlas_fx3 (knockback type effects)
    try {
      const atlas3Data = await fetchJson(
        `assets/effects/atlas_fx3.json${cacheBuster}`
      );
      const atlas3Image = await loadImage("assets/effects/atlas_fx3.png");

      state.fxAtlas3 = {
        frames: atlas3Data.frames,
        animations: atlas3Data.animations,
        atlasImage: atlas3Image,
        fps: atlas3Data.meta?.fps ?? 12,
      };

      console.log(
        "✅ Global FX assets loaded (atlas_fx + atlas_fx2 + atlas_fx3)"
      );
    } catch (error) {
      console.log(
        "⚠️ atlas_fx3 not found, knockback type effects will be disabled"
      );
      state.fxAtlas3 = null;
    }
  }

  async function loadUIAssets(state) {
    // Load UI atlas for character selection animations
    const cacheBuster = `?v=${Date.now()}`;
    const uiAtlasPath = `assets/ui/atlas_ui.json${cacheBuster}`;
    const uiAtlasData = await fetchJson(uiAtlasPath);

    const uiAtlasImagePath = "assets/ui/atlas_ui.png";
    const uiAtlasImage = await loadImage(uiAtlasImagePath);

    state.uiAtlas = uiAtlasData;
    state.uiAtlasImage = uiAtlasImage;
    state.uiAnimations = uiAtlasData.animations;

    // NEW: Load controls legend image
    try {
      const controlsLegendPath = "assets/ui/controls_legend.png";
      state.controlsLegendImage = await loadImage(controlsLegendPath);
      console.log("✅ Controls legend image loaded");
    } catch (error) {
      console.warn("⚠️ Controls legend image not found:", error);
      state.controlsLegendImage = null;
    }

    // Load controller section images (r3, buttons)
    // Arrows are no longer used in the UI
    const controllerSectionNames = ["r3", "buttons"];
    state.controllerSections = state.controllerSections || {};

    for (const sectionName of controllerSectionNames) {
      try {
        const sectionPath = `assets/ui/icons/${sectionName}.png`;
        const sectionImage = await loadImage(sectionPath);
        state.controllerSections[sectionName] = sectionImage;
        console.log(`✅ Controller section '${sectionName}' loaded`);
      } catch (error) {
        console.warn(
          `⚠️ Controller section '${sectionName}' could not be loaded (assets/ui/icons/${sectionName}.png):`,
          error
        );
        state.controllerSections[sectionName] = null;
      }
    }
  }

  function getImageData(img) {
    const off = document.createElement("canvas");
    off.width = img.naturalWidth;
    off.height = img.naturalHeight;
    const c = off.getContext("2d");
    c.drawImage(img, 0, 0);
    return c.getImageData(0, 0, off.width, off.height);
  }

  function parseSpawns(spawnImg, canvas) {
    const data = getImageData(spawnImg);
    const { width, height } = data;
    const pixels = data.data;
    const playerPoints = [];
    const npcPoints = [];

    // Magenta (255, 0, 255) = NPC spawns
    // All other colors = Player spawns
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (pixels[i + 3] > 0) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];

          // Check if it's Magenta (NPC spawn) - allow some tolerance
          const isMagenta = r > 200 && g < 50 && b > 200;

          const point = { x, y, r, g, b };

          if (isMagenta) {
            npcPoints.push(point);
          } else {
            playerPoints.push(point);
          }
        }
      }
    }

    // Parse player spawns (existing logic)
    let clusterA = [],
      clusterB = [];

    if (playerPoints.length > 0) {
      const colorKey = (p) => `${p.r >> 5}_${p.g >> 5}_${p.b >> 5}`;
      const map = new Map();
      playerPoints.forEach((p) =>
        map.set(colorKey(p), (map.get(colorKey(p)) || 0) + 1)
      );
      const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);

      if (sorted.length >= 2) {
        const keyA = sorted[0][0];
        const keyB = sorted[1][0];
        playerPoints.forEach((p) => {
          const cKey = colorKey(p);
          if (cKey === keyA) clusterA.push(p);
          else if (cKey === keyB) clusterB.push(p);
          else (p.x < spawnImg.naturalWidth / 2 ? clusterA : clusterB).push(p);
        });
      } else {
        playerPoints.forEach((p) =>
          (p.x < spawnImg.naturalWidth / 2 ? clusterA : clusterB).push(p)
        );
      }
    }

    const centroid = (arr) => {
      if (arr.length === 0)
        return { x: canvas.width / 2, y: canvas.height / 2 };
      const sum = arr.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), {
        x: 0,
        y: 0,
      });
      return {
        x: Math.round(sum.x / arr.length),
        y: Math.round(sum.y / arr.length),
      };
    };

    const playerSpawns = [centroid(clusterA), centroid(clusterB)];

    // Parse NPC spawns - each magenta pixel is a potential spawn point
    const npcSpawns = npcPoints.map((p) => ({ x: p.x, y: p.y }));

    return {
      players: playerSpawns,
      npcs: npcSpawns,
    };
  }

  function unloadAsset(path) {
    // Remove from state if it exists
    // This is a basic implementation - may need to be extended based on asset type
    if (window.MemoryManager) {
      window.MemoryManager.untrackAsset(path);
    }
  }

  function unloadCharacterAssets(charName) {
    const C = GameState.CONSTANTS;
    const paths = [
      `${C.CHAR_DIR}/${charName}/config.json`,
      `${C.CHAR_DIR}/${charName}/atlas.json`,
      `${C.CHAR_DIR}/${charName}/atlas.png`,
    ];

    paths.forEach(path => {
      unloadAsset(path);
    });

    // Also remove from characterConfigs if state is available
    if (typeof window !== 'undefined' && window.state && window.state.characterConfigs) {
      delete window.state.characterConfigs[charName];
    }
  }

  function unloadStageAssets(stagePath) {
    const C = GameState.CONSTANTS;
    const paths = [
      `${stagePath}/bg.png`,
      `${stagePath}/mid.png`,
      `${stagePath}/fg.png`,
      `${stagePath}/bg_layer.png`,
      `${stagePath}/${C.HEATMAP_DIR}/ground.png`,
      `${stagePath}/${C.HEATMAP_DIR}/semisolid.png`,
      `${stagePath}/${C.HEATMAP_DIR}/kill.png`,
      `${stagePath}/${C.HEATMAP_DIR}/spawn.png`,
    ];

    paths.forEach(path => {
      unloadAsset(path);
    });

    // Clear stage-related state
    if (typeof window !== 'undefined' && window.state) {
      window.state.bg = null;
      window.state.mid = null;
      window.state.fg = null;
      window.state.bgLayer = null;
      window.state.ground = null;
      window.state.semisolid = null;
      window.state.kill = null;
      window.state.spawn = null;
    }
  }

  const api = {
    loadImage,
    loadCharacterAssets,
    loadStageAssets,
    loadGlobalFxAssets,
    loadUIAssets,
    getImageData,
    parseSpawns,
    warmupImage,
    warmupSpritesheets,
    unloadAsset,
    unloadCharacterAssets,
    unloadStageAssets,
  };
  try {
    if (typeof window !== "undefined" && window) {
      setTimeout(() => {
        try {
          window.dispatchEvent(
            new CustomEvent("game-assets:ready", { detail: api })
          );
        } catch (eventError) {
          console.debug(
            "[GameAssets] Failed to dispatch ready event",
            eventError
          );
        }
      }, 0);
    }
  } catch (dispatchError) {
    console.debug("[GameAssets] Ready event dispatch skipped", dispatchError);
  }

  return api;
})();
