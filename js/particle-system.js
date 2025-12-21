window.ParticleManager = (() => {
  // Dynamic max particles based on quality preset
  function getMaxParticles() {
    if (window.QualityManager) {
      return window.QualityManager.getSetting('particleMaxCount');
    }
    return 200; // Fallback default
  }
  const SMOKE_TRAIL_THRESHOLD = 550; // Min velocity to trigger smoke (px/s)

  // Reusable vector for calculations
  const vec = { x: 0, y: 0 };

  class Particle {
    constructor() {
      this.active = false;
      this.pos = { x: 0, y: 0 };
      this.vel = { x: 0, y: 0 }; // NEW: Velocity for movement
      this.life = 0; // Remaining lifetime in seconds
      this.totalLife = 1;
      this.alpha = 1;
      this.scale = 1;
      this.rotation = 0;
      this.animName = null;
      this.frameIndex = 0;
      this.frameTime = 0;
      this.fps = 12;
      // Blood-specific behavior controls
      this.preferredDir = { x: 0, y: 0 }; // Direction for burst
      this.enableBurst = false;
      this.burstTriggered = false;
      this.initialSlowFade = false;
      // Per-particle physics tuning
      this.dragFactor = 0.98; // default drag per update step
      this.gravityPerSec = 50; // default gravity (px/s^2)
      this.zLayer = "foreground"; // "foreground" or "background"
    }

    init(x, y, life, scale, animName, fps) {
      this.active = true;
      this.pos.x = x;
      this.pos.y = y;
      this.life = life;
      this.totalLife = life;
      this.scale = scale;
      this.rotation = Math.random() * Math.PI * 2;
      this.alpha = 1;
      this.animName = animName;
      this.fps = fps;
      this.frameIndex = 0;
      this.frameTime = 0;
      this.zLayer = "foreground"; // Default to foreground
    }

    update(dt) {
      this.life -= dt;
      if (this.life <= 0) {
        this.active = false;
        return;
      }

      // NEW: Apply velocity for movement
      if (this.vel) {
        this.pos.x += this.vel.x * dt;
        this.pos.y += this.vel.y * dt;
        this.vel.y += (this.gravityPerSec || 50) * dt; // Gravity
        const drag = this.dragFactor || 0.98;
        this.vel.x *= drag;
        this.vel.y *= drag;
      }

      // Update animation frame
      this.frameTime += dt;
      const frameDur = 1 / this.fps;
      if (this.frameTime >= frameDur) {
        this.frameTime -= frameDur;
        this.frameIndex++; // Animation will be clamped during render
      }

      // Update wall bounce phase animation
      if (this.wallBouncePhase) {
        this.wallBounceAge += dt;

        if (
          this.wallBouncePhase === "compression" &&
          this.wallBounceAge >= 0.1
        ) {
          // Switch to expansion phase
          this.wallBouncePhase = "expansion";
          this.vel.x = this.wallBounceNormalX * 300 + this.wallBounceSpreadX;
          this.vel.y = this.wallBounceNormalY * 300 + this.wallBounceSpreadY;
        }
      }

      // Update properties based on lifetime
      const lifeRatio = this.life / this.totalLife; // 1 → 0

      // Three fade modes:
      // 1. slowFadeIn: Slowly fade in to 100% opacity, then fade out (for high-velocity knockback trails)
      // 2. initialSlowFade: Hold opacity early, snap fade late
      // 3. Default: Fast fade
      if (this.slowFadeIn) {
        const progress = 1 - lifeRatio; // 0 → 1
        if (progress < 0.4) {
          // Slow fade IN to 100% opacity in first 40% of lifetime
          this.alpha = Math.min(1.0, progress / 0.4); // 0 → 1.0
        } else {
          // Slow fade OUT in remaining 60% of lifetime
          const fadeOutProgress = (progress - 0.4) / 0.6; // 0 → 1
          this.alpha = Math.max(0, 1.0 * (1 - Math.pow(fadeOutProgress, 1.2)));
        }
      } else if (this.initialSlowFade) {
        const progress = 1 - lifeRatio; // 0 → 1
        if (progress < 0.5) {
          // Very slow fade in first half
          this.alpha = 0.9 + 0.1 * (1 - progress / 0.5); // ~0.9-1.0
        } else {
          // Snap fade second half (2x+ faster than linear)
          const late = (progress - 0.5) / 0.5; // 0 → 1
          this.alpha = Math.max(0, 0.9 * (1 - Math.pow(late, 1.5)));
        }
      } else {
        // Default faster fade (2x)
        this.alpha = Math.max(0, Math.min(1, lifeRatio * 0.5));
      }

      this.scale += 0.3 * dt; // Grow slightly (reduced from 0.5)

      // Trigger burst at mid-life for blood particles
      if (this.enableBurst && !this.burstTriggered) {
        const progress = 1 - lifeRatio;
        if (progress >= 0.5) {
          this.burstTriggered = true;
          // Impart velocity in preferred direction with small spread
          const base = 850; // higher base speed for farther travel
          const spread = 110;
          const nx = this.preferredDir.x;
          const ny = this.preferredDir.y;
          const mag = Math.max(0.0001, Math.hypot(nx, ny));
          const dirX = nx / mag;
          const dirY = ny / mag;
          this.vel.x = dirX * base + (Math.random() - 0.5) * spread;
          this.vel.y = dirY * base + (Math.random() - 0.5) * spread;
          // Reduce drag and gravity for blood burst to carry farther
          this.dragFactor = 0.995;
          this.gravityPerSec = 35;
          // Shorten remaining life for a crisp release
          this.life = Math.min(
            this.life,
            Math.max(0.18, this.totalLife * 0.25)
          );
        }
      }
    }
  }

  class ParticleSystem {
    constructor() {
      this.pool = [];
      this.activeParticles = [];
      const maxParticles = getMaxParticles();
      for (let i = 0; i < maxParticles; i++) {
        this.pool.push(new Particle());
      }
    }

    emit(x, y, animName, state) {
      let p = this.pool.pop();
      if (!p) {
        // Pool is empty, recycle the oldest active particle
        p = this.activeParticles.shift();
      }

      if (p && state.fxAtlas) {
        const life = 0.8 + Math.random() * 0.5; // 0.8 to 1.3 seconds
        const scale = 0.25 + Math.random() * 0.2; // 0.25 to 0.45 initial scale (reduced from 0.4-0.7)
        const fps = state.fxAtlas.fps || 12; // Fallback to 12 FPS if not specified
        p.init(x, y, life, scale, animName, fps);
        this.activeParticles.push(p);
        return p;
      }
      return null;
    }

    // NEW: Emit particle with specific atlas
    emitWithAtlas(x, y, animName, atlas, state) {
      let p = this.pool.pop();
      if (!p) {
        // Pool is empty, recycle the oldest active particle
        p = this.activeParticles.shift();
      }

      if (p && atlas) {
        const life = 0.8 + Math.random() * 0.5; // 0.8 to 1.3 seconds
        const scale = 0.25 + Math.random() * 0.2; // 0.25 to 0.45 initial scale
        const fps = atlas.fps || 12; // Fallback to 12 FPS if not specified
        p.init(x, y, life, scale, animName, fps);
        p.atlas = atlas; // Store atlas reference for rendering
        this.activeParticles.push(p);
        return p;
      }
      return null;
    }

    update(dt, camera = null) {
      const maxParticles = getMaxParticles();

      // Cull particles outside viewport if camera is provided
      const viewportMargin = 200; // Margin in pixels
      let culledCount = 0;

      for (let i = this.activeParticles.length - 1; i >= 0; i--) {
        const p = this.activeParticles[i];
        p.update(dt);

        // Viewport culling: remove particles far outside viewport
        if (camera && p.active) {
          const dx = p.pos.x - camera.x;
          const dy = p.pos.y - camera.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const viewportRadius = Math.max(
            (GameState.CONSTANTS.NATIVE_WIDTH / camera.zoom) / 2,
            (GameState.CONSTANTS.NATIVE_HEIGHT / camera.zoom) / 2
          ) + viewportMargin;

          if (distance > viewportRadius) {
            p.active = false;
            culledCount++;
          }
        }

        if (!p.active) {
          // Move dead particle back to the pool
          this.pool.push(p);
          this.activeParticles.splice(i, 1);
        }
      }

      // Limit active particles based on quality setting
      if (this.activeParticles.length > maxParticles) {
        const excess = this.activeParticles.length - maxParticles;
        for (let i = 0; i < excess; i++) {
          const p = this.activeParticles.shift();
          if (p) {
            p.active = false;
            this.pool.push(p);
          }
        }
      }
    }

    // The draw call will be handled by the Renderer for better batching
  }

  // --- Public API ---
  const instance = new ParticleSystem();

  // NEW: Check if player is flying through air due to knockback and emit smoke trail
  function checkKnockbackSmokeTrail(p, state) {
    if (!p || !p.vel || !state.fxAtlas) return;

    // Only emit if player is airborne and was hit (knockback flight)
    if (p.grounded || !p.airborneFromHit) return;

    // Calculate flight speed
    const speed = Math.hypot(p.vel.x, p.vel.y);

    // Minimum speed threshold for smoke emission (lower than normal movement smoke)
    const MIN_KNOCKBACK_SPEED = 200; // px/s
    if (speed < MIN_KNOCKBACK_SPEED) return;

    // Track knockback flight time
    if (!p.knockbackFlightStartTime) {
      p.knockbackFlightStartTime = state.lastTime || performance.now() * 0.001;
    }

    const flightDuration =
      (state.lastTime || performance.now() * 0.001) -
      p.knockbackFlightStartTime;

    // Reset flight time when landing
    // This is handled in the updatePlayer logic, but we reset it here when grounded

    // Calculate emission rate based on speed and flight duration
    // Speed factor: faster = more particles (proportional scaling)
    const speedFactor = Math.min(speed / 600, 3.0); // Normalize to 0-3.0 (allows up to 1800 px/s)

    // Duration factor: longer flight = longer trail (but less dense per second)
    const durationFactor = Math.min(flightDuration / 2.0, 1.0); // 0-1 over 2 seconds

    // Initial density decreases rapidly (exponential decay)
    // High density at start (first 0.3 seconds), then rapid drop-off
    const initialDensityDecay = Math.exp(-flightDuration / 0.3); // Decays to ~37% after 0.3s

    // Base emission interval: starts very short (dense), increases over time
    // Scale inversely with speed factor for proportional particle count
    const baseInterval = 0.015 + flightDuration * 0.025; // Starts at 15ms, increases to ~65ms after 2s
    const emissionInterval = baseInterval / (speedFactor * initialDensityDecay);

    // Track last emission time
    const now = state.lastTime || performance.now() * 0.001;
    const timeSinceLastEmit = now - (p.lastKnockbackSmokeEmitTime || 0);

    if (timeSinceLastEmit >= emissionInterval) {
      p.lastKnockbackSmokeEmitTime = now;

      // Choose smoke animation randomly
      const animName =
        Math.random() > 0.5 ? "fx_smoke_trail_a" : "fx_smoke_trail_b";

      // Emit particle slightly behind player (opposite to velocity direction)
      const velNormX = p.vel.x / Math.max(speed, 0.001);
      const velNormY = p.vel.y / Math.max(speed, 0.001);

      // Offset behind player (trail effect) - more offset at higher speeds
      const trailOffset = 25 + speedFactor * 20; // More offset at higher speeds
      const emitX = p.pos.x - velNormX * trailOffset;
      const emitY = p.pos.y - velNormY * trailOffset;

      // Emit multiple particles for thicker trail at high speeds
      // Base count: 1, scales up to 3-4 particles at very high speeds
      const particleCount = Math.min(Math.floor(1 + speedFactor * 0.8), 4);

      for (let i = 0; i < particleCount; i++) {
        // Slight spread for multiple particles
        const spreadOffset = (i - (particleCount - 1) / 2) * 8;
        const perpX = -velNormY * spreadOffset; // Perpendicular to velocity
        const perpY = velNormX * spreadOffset;

        // Emit particle
        const particle = instance.emit(
          emitX + perpX,
          emitY + perpY,
          animName,
          state
        );

        if (particle) {
          // Scale particle size proportionally with speed (thicker trail)
          const baseScale = 0.35;
          const scaleBoost = speedFactor * 0.4; // Up to 1.2x scale at max speed
          particle.scale = baseScale + scaleBoost + Math.random() * 0.15;

          // Start at low opacity, will fade in slowly to 100%
          particle.alpha = 0.1; // Start very transparent

          // Use slow fade-in mode: slowly fade to 100% opacity, then fade out
          particle.slowFadeIn = true;

          // Longer lifetime for high-velocity trails (better visibility)
          const baseLifetime = 0.6;
          const extendedLifetime = baseLifetime + durationFactor * 0.6; // 0.6-1.2 seconds
          particle.life = extendedLifetime + Math.random() * 0.3;
          particle.totalLife = particle.life;

          // Velocity: opposite to player movement, with random spread
          // More spread at higher speeds for thicker, more visible trail
          const spread = 60 + speedFactor * 40;
          particle.vel = {
            x: -velNormX * 80 + (Math.random() - 0.5) * spread,
            y: -velNormY * 80 + (Math.random() - 0.5) * spread,
          };

          // Less gravity for smoke to float longer and create visible trail
          particle.gravityPerSec = 15;
          particle.dragFactor = 0.96; // Slow dissipation for longer visibility
        }
      }
    }
  }

  function checkPlayerVelocity(p, state) {
    if (!p || !p.vel || !state.fxAtlas) return; // Guard against missing data and unloaded FX atlas

    vec.x = p.vel.x;
    vec.y = p.vel.y;
    const speed = Math.sqrt(vec.x * vec.x + vec.y * vec.y);

    if (speed > SMOKE_TRAIL_THRESHOLD) {
      // Logic to control emission rate.
      // We can use a timer on the player object to avoid emitting every frame.
      const now = state.lastTime; // Assuming lastTime is current game time
      const timeSinceLastEmit = now - (p.lastSmokeEmitTime || 0);

      // Scale emission interval proportionally with speed (faster = more frequent)
      // Base interval at threshold (550), decreases as speed increases
      const speedFactor = Math.min(speed / SMOKE_TRAIL_THRESHOLD, 2.0); // 1.0 to 2.0
      const baseInterval = 0.05; // 50ms at threshold
      const EMIT_INTERVAL = baseInterval / speedFactor; // Faster = shorter interval (more particles)

      if (timeSinceLastEmit > EMIT_INTERVAL) {
        p.lastSmokeEmitTime = now;
        const anim =
          Math.random() > 0.5 ? "fx_smoke_trail_a" : "fx_smoke_trail_b";
        const particle = instance.emit(p.pos.x, p.pos.y, anim, state);

        // Scale particle properties slightly with speed (keep it subtle for regular movement)
        if (particle) {
          const intensity = Math.min(
            (speed - SMOKE_TRAIL_THRESHOLD) / 300,
            0.3
          ); // Max 30% boost
          particle.scale = particle.scale * (1 + intensity);
          particle.alpha = Math.min(
            1.0,
            particle.alpha * (1 + intensity * 0.5)
          );
        }
      }
    }

    // Check if player is in beatmatch mode and emit additional beatmatch smoke
    if (p.beatmatchMode && speed > SMOKE_TRAIL_THRESHOLD) {
      const now = state.lastTime;
      const timeSinceLastBeatmatchEmit = now - (p.lastBeatmatchEmitTime || 0);

      // Emit beatmatch smoke at same interval as normal smoke (original behavior)
      const EMIT_INTERVAL = 0.05;
      if (timeSinceLastBeatmatchEmit > EMIT_INTERVAL) {
        p.lastBeatmatchEmitTime = now;
        instance.emit(p.pos.x, p.pos.y, "fx_smoketrail_beatmatch", state);
      }
    }
  }

  function emitBeatmatchParticles(x, y, state) {
    if (!state.fxAtlas) return;

    // Emit multiple particles for a more dramatic effect
    const particleCount = 8;
    for (let i = 0; i < particleCount; i++) {
      // Random offset around the hit position
      const offsetX = (Math.random() - 0.5) * 60; // ±30px spread
      const offsetY = (Math.random() - 0.5) * 60;

      instance.emit(x + offsetX, y + offsetY, "fx_smoketrail_beatmatch", state);
    }
  }

  function emitBloodSplatter(x, y, damage, state, opts = {}) {
    if (!state.fxAtlas2) return;

    // Calculate damage tier (8er-Schritte): 1-5, 6-10, 11-15, etc.
    const damageTier = Math.floor((damage - 1) / 5); // 0, 1, 2, 3...
    const tierDamage = Math.min(damageTier, 7); // Max tier 7 (damage 36-40)

    // Determine animation name based on damage tier
    const animName = `fx_blood_${tierDamage}`;

    // Calculate intensity based on damage within tier (1-5)
    const damageInTier = ((damage - 1) % 5) + 1; // 1-5
    const intensity = damageInTier / 5; // 0.2 to 1.0

    // Optional overrides
    // Base particle count (reduced overall for less clutter)
    const baseParticleCount = 6 + tierDamage * 2.5;
    const particleCount = Math.min(
      18,
      Math.floor(baseParticleCount * (0.6 + intensity * 0.5))
    );

    // Spread radius increases with damage tier but stays compact
    const baseSpread = 24 + tierDamage * 8; // tighter core blast
    const spreadRadius = baseSpread * (0.6 + intensity * 0.35);

    // Determine preferred direction (defaults to attacker facing right)
    const dir =
      opts.dir &&
      typeof opts.dir.x === "number" &&
      typeof opts.dir.y === "number"
        ? { x: opts.dir.x, y: opts.dir.y }
        : { x: 1, y: -0.25 };

    const dirMag = Math.max(0.0001, Math.hypot(dir.x, dir.y));
    const normDirX = dir.x / dirMag;
    const normDirY = dir.y / dirMag;

    if (state?.debug?.devMode) {
      console.log(
        `🩸 Blood splatter: damage=${damage}, tier=${tierDamage}, anim=${animName}, particles=${particleCount}, spread=${spreadRadius.toFixed(
          0
        )}px`
      );
    }

    for (let i = 0; i < particleCount; i++) {
      // Random offset with spread radius
      const angle = Math.random() * Math.PI * 0.6 - Math.PI * 0.3; // +/- 54° fan
      const distance = Math.random() * spreadRadius;
      const offsetX =
        Math.cos(angle) * distance * normDirX -
        Math.sin(angle) * distance * normDirY;
      const offsetY =
        Math.sin(angle) * distance * normDirX +
        Math.cos(angle) * distance * normDirY;

      // Launch from hit point with slight upward bias
      const upwardBias = -8 - Math.random() * 18;

      const particle = instance.emitWithAtlas(
        x + offsetX,
        y + offsetY + upwardBias,
        animName,
        state.fxAtlas2,
        state
      );
      if (particle) {
        const burstSpeed =
          (opts.minSpeed ?? 420) +
          Math.random() * ((opts.maxSpeed ?? 640) - (opts.minSpeed ?? 420));
        const spreadX = (Math.random() - 0.5) * 160;
        const spreadY = (Math.random() - 0.5) * 140;

        particle.vel.x = normDirX * burstSpeed + spreadX;
        particle.vel.y = normDirY * burstSpeed + spreadY - 120;

        particle.initialSlowFade = false; // quick fade-out
        particle.enableBurst = false;
        particle.burstTriggered = true;
        particle.dragFactor = 0.9;
        particle.gravityPerSec = 720; // strong gravity for parabolic arc

        const life = 0.28 + Math.random() * 0.18;
        particle.totalLife = life;
        particle.life = life;

        particle.scale = 0.16 + Math.random() * 0.12;
        particle.alpha = 0.95;

        // Slight random rotation wobble handled by default
      }
    }
  }

  function emitWallImpactParticles(x, y, normalX, normalY, speed, state) {
    if (!state.fxAtlas) return;

    // Calculate particle count based on impact speed
    const particleCount = Math.min(Math.floor(speed / 150), 8); // Max 8 particles

    // Compression phase: particles move toward wall
    for (let i = 0; i < particleCount; i++) {
      const randomOffset = (Math.random() - 0.5) * 20; // Small random spread
      const compressionX = x + normalX * -10 + randomOffset; // Move toward wall
      const compressionY = y + (Math.random() - 0.5) * 30; // Vertical spread

      // Choose random smoke trail animation
      const animName =
        Math.random() > 0.5 ? "fx_smoke_trail_a" : "fx_smoke_trail_b";

      // Emit particle with compression velocity
      const particle = instance.emit(
        compressionX,
        compressionY,
        animName,
        state
      );

      if (particle) {
        // Set initial velocity toward wall (compression)
        particle.vel.x = normalX * -200 + (Math.random() - 0.5) * 50;
        particle.vel.y = (Math.random() - 0.5) * 100;

        // Phase-based animation instead of setTimeout
        particle.wallBouncePhase = "compression";
        particle.wallBounceAge = 0;
        particle.wallBounceNormalX = normalX;
        particle.wallBounceNormalY = normalY;
        particle.wallBounceSpreadX = (Math.random() - 0.5) * 200;
        particle.wallBounceSpreadY = (Math.random() - 0.5) * 200;
      }
    }
  }

  // NEW: Combo Particle System - Vertical upward flow with increasing intensity
  function emitComboParticles(player, comboLevel, state) {
    if (!state.fxAtlas3) {
      console.warn("🎆 fxAtlas3 not loaded, cannot emit combo particles");
      return; // Use fxAtlas3 for dance_combo_particles effects
    }

    const baseX = player.pos.x;
    const baseY = player.pos.y; // Character feet position

    // Calculate intensity based on combo level (1-10)
    const intensity = Math.min(comboLevel / 10, 1.0); // 0.1 to 1.0

    // Particle count scales with combo level
    const baseParticleCount = 3;
    const maxParticleCount = 12;
    const particleCount = Math.floor(
      baseParticleCount + (maxParticleCount - baseParticleCount) * intensity
    );

    // Vertical spread increases with combo level
    const baseHeight = 80; // Start height above feet
    const maxHeight = 200; // Max height for highest combo
    const spreadHeight = baseHeight + (maxHeight - baseHeight) * intensity;

    // Horizontal spread (narrower for focused effect)
    const horizontalSpread = 40 + intensity * 20; // 40-60px spread

    if (state?.debug?.devMode) {
      console.log(
        `🎆 Combo particles: level=${comboLevel}, intensity=${intensity.toFixed(
          2
        )}, particles=${particleCount}, height=${spreadHeight.toFixed(0)}px`
      );
    }

    for (let i = 0; i < particleCount; i++) {
      // Random position around character feet
      const offsetX = (Math.random() - 0.5) * horizontalSpread;
      const offsetY = Math.random() * spreadHeight; // 0 to maxHeight

      // Choose animation based on combo level
      let animName;
      if (comboLevel <= 3) {
        animName = "dance_combo_particles_low"; // Basic combo particles
      } else if (comboLevel <= 6) {
        animName = "dance_combo_particles_mid"; // Medium intensity
      } else {
        animName = "dance_combo_particles_high"; // High combo = intense effect
      }

      // Debug: Check if animation exists
      if (!state.fxAtlas3.animations[animName]) {
        console.warn(
          `🎆 Animation "${animName}" not found in fxAtlas3. Available:`,
          Object.keys(state.fxAtlas3.animations)
        );
        return; // Skip if animation doesn't exist
      }

      // Emit particle with upward velocity using fxAtlas3
      const particle = instance.emitWithAtlas(
        baseX + offsetX,
        baseY - offsetY, // Negative Y = upward from feet
        animName,
        state.fxAtlas3,
        state
      );

      if (particle) {
        // Set to background layer (renders behind characters)
        particle.zLayer = "background";

        // Set upward velocity (particles float up)
        particle.vel = {
          x: (Math.random() - 0.5) * 50, // Slight horizontal drift
          y: -100 - intensity * 100, // Upward velocity: -100 to -200
        };

        // Reduce scale for less obstruction
        particle.scale = 0.25 + intensity * 0.3; // 0.25 to 0.55

        // Slightly lower alpha to reduce visual noise (reduced from 0.7 to 0.4)
        particle.alpha = 0.4;

        // Shorter life for faster fade-out
        particle.life = 0.4 + intensity * 0.3; // 0.4 to 0.7 seconds
        particle.totalLife = particle.life;

        // Disable slow fade-in for faster fade-out
        particle.slowFadeIn = false;
        particle.initialSlowFade = false;
      }
    }
  }

  // NEW: Emit a short failure burst when a beat is missed (GOOD or OFF)
  function emitComboFailEffect(player, state) {
    if (!state || !state.fxAtlas3) return;

    const baseX = player.pos.x;
    const baseY = player.pos.y; // feet position

    // Emit a small cluster for visual clarity
    const count = 3;
    for (let i = 0; i < count; i++) {
      const offsetX = (Math.random() - 0.5) * 30;
      const offsetY = (Math.random() - 0.5) * 20;
      const particle = instance.emitWithAtlas(
        baseX + offsetX,
        baseY + offsetY,
        "dance_combo_fail",
        state.fxAtlas3,
        state
      );
      if (particle) {
        // Gentle outward puff
        particle.vel = {
          x: (Math.random() - 0.5) * 80,
          y: -50 + (Math.random() - 0.5) * 60,
        };
        particle.life = 0.6 + Math.random() * 0.2;
        particle.totalLife = particle.life;
        particle.scale = 0.35 + Math.random() * 0.15;
      }
    }
  }

  // NEW: Emit beat charge particles (replaces aura)
  function emitBeatChargeParticles(player, beatCount, state) {
    if (beatCount <= 0) return;

    // Try to find the atlas containing the beat charge effect
    let atlas = state.fxAtlas;

    // Determine which animation to use based on charge level
    // Logic: randomly select from unlocked tiers to simulate the "stacking" effect of the original aura
    // Level 1: A
    // Level 2: A or B
    // ...
    // Level 9: A through I
    const unlockedTiers = Math.min(beatCount, 9);
    const tierIndex = Math.floor(Math.random() * unlockedTiers); // 0 to 8
    const tierLetter = ["a", "b", "c", "d", "e", "f", "g", "h", "i"][tierIndex];
    const animName = `beat_match_charge_${tierLetter}`;

    // If not in fxAtlas, check character config
    if (!atlas || !atlas.animations || !atlas.animations[animName]) {
      if (player.charName && state.characterConfigs[player.charName]) {
        atlas = state.characterConfigs[player.charName];
      }
    }

    // Validation
    if (!atlas || !atlas.animations || !atlas.animations[animName]) return;

    const now = state.lastTime || performance.now() * 0.001;
    const timeSinceLastEmit = now - (player.lastBeatChargeEmitTime || 0);

    // Emit rate: faster for higher charge
    // Level 1-3: Low density (every ~60ms)
    // Level 4-6: Medium density (every ~40ms)
    // Level 7-9: High density (every ~30ms)
    const densityMultiplier = 1 + (beatCount - 1) * 0.3;
    const emitInterval = 0.06 / Math.sqrt(densityMultiplier);

    if (timeSinceLastEmit >= emitInterval) {
      player.lastBeatChargeEmitTime = now;

      // Particles to emit per tick (increase count at high levels)
      const count = beatCount >= 6 ? 2 : 1;

      for (let i = 0; i < count; i++) {
        // Randomize position around character center
        // Assuming character is roughly 60-80px wide
        // Spread increases slightly with charge
        const spreadX = 35 + beatCount * 2;
        const offsetX = (Math.random() - 0.5) * spreadX;

        // Emitting from body center/chest area
        const offsetY = -40 + (Math.random() - 0.5) * 60;

        // Cycle through charge anims if available?
        // User said "Beat Charge A... additional effects appear at higher levels"
        // If we just use A, it's consistent.
        // If we want to mix B-I:
        if (beatCount >= 4 && Math.random() > 0.7) {
          // occasionally mix in B or C if available?
          // keeping it simple with A for now as base particle
        }

        const p = instance.emitWithAtlas(
          player.pos.x + offsetX,
          player.pos.y + offsetY,
          animName,
          atlas,
          state
        );

        if (p) {
          // Upward motion (fading out upwards)
          const speed = 50 + beatCount * 5;
          p.vel.x = (Math.random() - 0.5) * 20; // Slight horizontal drift
          p.vel.y = -speed - Math.random() * speed * 0.6; // Upward velocity

          // Life: shorter for crisp effect
          p.life = 0.5 + Math.random() * 0.3;
          p.totalLife = p.life;

          // Start transparent, fade in then out
          p.alpha = 0.0;
          p.slowFadeIn = true; // Use existing slowFadeIn logic

          // Scale: Start smallish
          // If sprites are large auras, scale down significantly (0.2 - 0.4)
          p.scale = 0.25 + Math.random() * 0.2;

          // Add rotation for dynamic feel
          p.rotation = Math.random() * 6.28;

          // Anti-gravity to float up
          p.gravityPerSec = -30;
          p.dragFactor = 0.96;
        }
      }
    }
  }

  return {
    instance,
    update: instance.update.bind(instance),
    checkPlayerVelocity,
    checkKnockbackSmokeTrail, // NEW: Knockback flight smoke trail
    emitBeatmatchParticles,
    emitBloodSplatter,
    emitWallImpactParticles,
    emitComboParticles, // NEW: Add to exports
    emitWithAtlas: instance.emitWithAtlas.bind(instance), // NEW: Add to exports
    emitComboFailEffect, // NEW: Miss feedback effect
    emitBeatChargeParticles, // NEW: Beat charge particle effect
    emitBeatDischargeParticles, // NEW: Explosive discharge effect
  };

  // NEW: Emit explosive discharge particles when beat charge is consumed
  function emitBeatDischargeParticles(player, beatCount, state) {
    if (beatCount <= 0) return;

    // Try to find the atlas containing the beat charge effect
    let atlas = state.fxAtlas;
    const facing = player.facing || 1; // 1 = Right, -1 = Left

    // --- PHASE 1: IMPLOSION (Instant gathering/sucking in) ---
    // Creates a brief "vacuum" effect before the blast
    for (let i = 0; i < 12; i++) {
        // Use high tier sprite for core implosion
        const animName = "beat_match_charge_i";

        // Atlas check
        let currentAtlas = atlas;
        if (!currentAtlas || !currentAtlas.animations || !currentAtlas.animations[animName]) {
             if (player.charName && state.characterConfigs[player.charName]) {
                currentAtlas = state.characterConfigs[player.charName];
             }
        }
        if (!currentAtlas || !currentAtlas.animations || !currentAtlas.animations[animName]) continue;

        // Spawn in a ring around impact point
        const angle = (i / 12) * Math.PI * 2;
        const radius = 100 + Math.random() * 40;
        const startX = player.pos.x + Math.cos(angle) * radius;
        const startY = player.pos.y - 30 + Math.sin(angle) * radius;

        const p = instance.emitWithAtlas(startX, startY, animName, currentAtlas, state);
        if (p) {
            p.zLayer = "foreground";
            // Move towards center FAST (Negative velocity relative to angle)
            const speed = 1200;
            p.vel.x = -Math.cos(angle) * speed;
            p.vel.y = -Math.sin(angle) * speed;
            p.life = 0.1; // Very short life (snap to center)
            p.totalLife = p.life;
            p.scale = 0.6;
            p.alpha = 1.0;
            p.dragFactor = 1.0; // No drag for consistent arrival

            // Orient inward
            p.rotation = angle;
            p.scaleX = 1.5; // Streak inward
            p.scaleY = 0.2;
        }
    }

    // --- PHASE 2: DIRECTIONAL LIGHTNING BLAST ---
    const particleCount = 30 + beatCount * 6;
    const unlockedTiers = Math.min(beatCount, 9);

    for (let i = 0; i < particleCount; i++) {
      // Select random tier up to unlocked level
      const tierIndex = Math.floor(Math.random() * unlockedTiers);
      const tierLetter = ["a", "b", "c", "d", "e", "f", "g", "h", "i"][tierIndex];
      const animName = `beat_match_charge_${tierLetter}`;

      // Atlas check
      let currentAtlas = atlas;
      if (!currentAtlas || !currentAtlas.animations || !currentAtlas.animations[animName]) {
        if (player.charName && state.characterConfigs[player.charName]) {
          currentAtlas = state.characterConfigs[player.charName];
        }
      }
      if (!currentAtlas || !currentAtlas.animations || !currentAtlas.animations[animName]) continue;

      // Emit from center (Chest/Body area)
      const p = instance.emitWithAtlas(
        player.pos.x + (Math.random() - 0.5) * 20,
        player.pos.y - 30 + (Math.random() - 0.5) * 40,
        animName,
        currentAtlas,
        state
      );

      if (p) {
        p.zLayer = "foreground";

        // DIRECTIONAL CONE:
        // Main direction is 'facing', with spread
        const baseAngle = facing === 1 ? 0 : Math.PI;
        // Spread +/- 45 degrees (0.8 rad)
        const spread = (Math.random() - 0.5) * 1.6;
        const angle = baseAngle + spread;

        // SPEED: Extremely fast for lightning look
        const speed = 1000 + Math.random() * 1200 + beatCount * 80;

        p.vel.x = Math.cos(angle) * speed;
        p.vel.y = Math.sin(angle) * speed;

        // Short life
        p.life = 0.1 + Math.random() * 0.2;
        p.totalLife = p.life;

        // Start bright
        p.alpha = 1.0;
        p.initialSlowFade = false;

        // LIGHTNING / ZIGZAG LOOK:
        // Extreme stretching along velocity
        p.rotation = angle;
        p.scaleX = 2.5 + Math.random() * 3.0; // Very long streaks
        p.scaleY = 0.08 + Math.random() * 0.12; // Very thin lines

        // "Jagged" randomness:
        // Offset the visual rotation slightly from the velocity vector
        // This makes the streak look like it's zig-zagging or chaotic
        p.rotation += (Math.random() - 0.5) * 0.8;

        // Occasional sparks
        if (Math.random() > 0.85) {
             p.scaleX = 0.4 + Math.random() * 0.4;
             p.scaleY = p.scaleX;
             p.rotation = Math.random() * 6.28;
        }

        p.dragFactor = 0.82; // Fast slowdown
        p.gravityPerSec = 0;
      }
    }
  }
})();
