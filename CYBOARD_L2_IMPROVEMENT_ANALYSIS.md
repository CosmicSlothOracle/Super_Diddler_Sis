# Cyboard L2 Attack Analysis & Improvement Suggestions

## Current Implementation Analysis

### Attack Flow
1. **Start Phase**: Initializes jump parameters
   - Fixed jump height: 360px
   - Fixed jump distance: 700px at 45° angle
   - Jump duration: 0.25s (3 frames @ 12fps)

2. **Jump Phase**: Lerps player to target position (peak of jump)

3. **Grab Phase**: Single-frame hit detection
   - Hitbox: 140px wide × 180px tall
   - Position: 30px forward offset, 20px above player
   - **Critical Issue**: Only checks on first frame of grab phase
   - If miss: Attack cancels completely, player falls normally

4. **Grab Hold Phase**: If hit, holds target for 0.4s mid-air

5. **Fall Phase**: Fast descent (2500 speed) to ground

6. **Impact Phase**: Applies damage if target was grabbed, or AOE splash (100px radius) if missed

### Current Hitbox Specifications
```javascript
// From renderer.js:1980
const w = 140;  // Width
const h = 180;  // Height
const forwardOffset = 30 * p.facing;
const top = p.pos.y - h - 20;  // Above player
```

### Problems Identified

#### 1. **Single-Frame Hit Detection Window**
- **Current**: Hit check happens only on first frame of grab phase
- **Impact**: Extremely tight timing window - must be at exact peak position
- **Comparison**: HP grab checks 2 frames (`detectFrames: 2`)

#### 2. **Small Hitbox Size**
- **Current**: 140×180px hitbox
- **Impact**: Difficult to catch moving or dodging targets
- **Comparison**: HP grab expands hurtbox by 40% width, 40% height, plus backward extension

#### 3. **Fixed Trajectory**
- **Current**: Always jumps 700px at 45° angle, no adjustment
- **Impact**: Cannot adapt to enemy position, requires perfect spacing
- **No auto-aim or tracking**

#### 4. **Complete Cancel on Miss**
- **Current**: If grab misses, attack cancels immediately
- **Impact**: High risk, no partial reward for near-misses
- **Note**: AOE splash exists but only triggers if attack completes (impact phase)

#### 5. **No Rhythm Bonus Integration**
- **Current**: No expansion based on perfect beats
- **Comparison**: HP grab gets 44% larger hitbox with perfect beats

## Improvement Suggestions

### Priority 1: Extend Hit Detection Window (HIGH IMPACT, LOW RISK)

**Change**: Check for hits across multiple frames during grab phase

```javascript
// Current (single frame):
if (!p.attack.grabChecked) {
  p.attack.grabChecked = true;
  // ... hit check ...
}

// Suggested (multi-frame):
if (p.attack.grabCheckFrames < 3) {  // Check for 3 frames (~0.25s @ 12fps)
  p.attack.grabCheckFrames = (p.attack.grabCheckFrames || 0) + 1;
  // ... hit check ...
  if (grabbedTarget) {
    // Transition to grab_hold
  }
}
// After 3 frames, if no hit, cancel
```

**Benefits**:
- More forgiving timing window
- Catches enemies who are slightly off-position
- Maintains attack identity (still requires good positioning)

### Priority 2: Increase Hitbox Size (HIGH IMPACT, MEDIUM RISK)

**Change**: Expand hitbox dimensions and adjust positioning

```javascript
// Current:
const w = 140;
const h = 180;
const forwardOffset = 30 * p.facing;

// Suggested:
const w = 200;  // +43% width (from 140)
const h = 220;  // +22% height (from 180)
const forwardOffset = 50 * p.facing;  // +67% forward reach
```

**Alternative (Configurable)**:
Add to `character-catalog.js`:
```javascript
cyboard: {
  l2: {
    grabHitboxWidth: 200,
    grabHitboxHeight: 220,
    grabForwardOffset: 50,
    grabCheckFrames: 3,  // Multi-frame detection
  }
}
```

**Benefits**:
- Easier to catch enemies
- Better forward reach for aerial targets
- Still requires positioning skill

### Priority 3: Add Rhythm Bonus Expansion (MEDIUM IMPACT, LOW RISK)

**Change**: Expand hitbox when player has perfect beats

```javascript
const baseW = 200;
const baseH = 220;
const rhythmMultiplier = p.perfectBeatCount > 0 ? 1.3 : 1.0;  // 30% larger
const w = baseW * rhythmMultiplier;
const h = baseH * rhythmMultiplier;
```

**Benefits**:
- Rewards rhythm gameplay
- Consistent with other attacks (HP grab)
- Encourages beat-matching

### Priority 4: Improve Miss Behavior (MEDIUM IMPACT, LOW RISK)

**Change**: Allow AOE splash even on early miss

```javascript
// Current: Attack cancels on miss, AOE only on impact phase
if (!grabbedTarget) {
  p.attack = { type: "none", phase: "none" };
  // ... cancel ...
}

// Suggested: Transition to fall phase even on miss, apply AOE on impact
if (!grabbedTarget) {
  // Don't cancel - continue to fall phase
  p.attack.phase = "fall";
  p.attack.impactTime = 0;
  p.attack.groundTargetY = p.attack.startY;
  p.attack.grabbedTarget = null;  // Mark as miss
  setAnim(p, "l2_smash_fall", false, state);
}
// Impact phase already handles AOE for missed grabs
```

**Benefits**:
- Partial reward for near-misses
- Maintains attack commitment (can't cancel early)
- AOE splash still useful

### Priority 5: Optional Auto-Aim/Tracking (LOW PRIORITY, HIGH RISK)

**Change**: Slight adjustment toward nearest enemy

```javascript
// In start phase, find nearest enemy
let nearestEnemy = null;
let minDist = Infinity;
for (const target of state.players) {
  if (target === p || target.eliminated) continue;
  const dx = target.pos.x - p.pos.x;
  const dy = target.pos.y - p.pos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < minDist && dist < 800) {  // Max tracking range
    minDist = dist;
    nearestEnemy = target;
  }
}

// Adjust jump target slightly toward enemy (max 15% adjustment)
if (nearestEnemy) {
  const adjustFactor = 0.15;  // 15% max adjustment
  const idealX = nearestEnemy.pos.x;
  const currentTargetX = p.attack.targetX;
  p.attack.targetX = currentTargetX + (idealX - currentTargetX) * adjustFactor;
}
```

**Benefits**:
- Easier to land on moving targets
- Still requires good positioning (only 15% adjustment)

**Risks**:
- May feel "magnetic" or unfair
- Could reduce skill expression
- **Recommendation**: Make this optional/configurable, test extensively

## Recommended Implementation Order

1. **Phase 1 (Quick Wins)**:
   - Extend hit detection to 3 frames
   - Increase hitbox size (200×220px)
   - Increase forward offset (50px)

2. **Phase 2 (Polish)**:
   - Add rhythm bonus expansion
   - Improve miss behavior (allow AOE on miss)

3. **Phase 3 (Optional)**:
   - Test auto-aim/tracking (if Phase 1-2 insufficient)
   - Add character catalog config for tuning

## Code Locations

- **Handler**: `js/attack-system.js` line 4617 (`handleCyboardL2`)
- **Hitbox**: `js/renderer.js` line 1980 (`getL2SmashHitbox`)
- **Descriptor**: `js/attack-catalog.js` line 1312 (`cyboard:l2_smash`)
- **Character Config**: `js/character-catalog.js` (add cyboard.l2 section)

## Testing Checklist

After implementing changes:
- [ ] Test against stationary targets
- [ ] Test against moving targets (walking, dashing)
- [ ] Test against dodging targets
- [ ] Test rhythm bonus expansion
- [ ] Test miss behavior (AOE splash)
- [ ] Test edge cases (near edges, platforms)
- [ ] Verify no performance regression
- [ ] Check visual feedback (hitbox debug if available)

