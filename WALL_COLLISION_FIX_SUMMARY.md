# Wall Collision System - Complete Implementation Summary

## Problem Statement
Players were experiencing collision bugs when interacting with walls on the heatmap:
- Climbing behavior (Fahrstuhl-Effekt) when stuck in walls
- Respawn bugs
- Improper collision detection between BLACK (ground) and DARK_GRAY (walls)

## Root Cause Analysis
The original `isPixelSolid()` function checked **only the alpha channel** (>128), treating ALL opaque pixels identically:
- BLACK (#000000) = ground
- DARK_GRAY (#646464) = walls
- But both were treated as "solid" with no semantic distinction

This caused:
1. Incorrect collision responses (walls treated like ground)
2. Wallslide mechanics interfering with wall physics
3. Players phasing through or sticking in walls

## Solution Architecture

### 1. Precise Color-Based Collision Detection (`isPixelSolid`)
**Location:** `js/physics.js` lines ~3944-3962

Changed from alpha-only check to **RGB color matching**:
```javascript
function isPixelSolid(x, y, data, cameraBounds = null) {
  const color = getPixelColor(x, y, data, cameraBounds);
  if (!color || color.a <= 128) return false;

  // Accept both BLACK (ground) and DARK_GRAY (wall) as solid
  const tolerance = 2;
  const isBlack = colorsMatch(color, HEATMAP_COLORS.BLACK, tolerance);
  const isWallGray = colorsMatch(color, HEATMAP_COLORS.DARK_GRAY, tolerance);
  return isBlack || isWallGray;
}
```

**Why tolerance = 2:**
- Allows for minor export variance (PNG compression, image tools)
- Maintains exact color specification intent
- Prevents false positives from anti-aliasing artifacts

### 2. Dedicated Wall Pixel Detection (`isWallPixel`)
**Location:** `js/physics.js` lines ~3973-3982

New function for explicit wall detection:
```javascript
function isWallPixel(x, y, data, cameraBounds = null) {
  const color = getPixelColor(x, y, data, cameraBounds);
  if (!color || color.a <= 128) return false;
  return colorsMatch(color, HEATMAP_COLORS.DARK_GRAY, 2);
}
```

Used in:
- Wallslide back-face detection
- Explicit wall collision responses
- Debug visualizations

### 3. Dedicated Ground Pixel Detection (`isGroundPixel`)
**Location:** `js/physics.js` lines ~3987-3994

New function for explicit ground detection:
```javascript
function isGroundPixel(x, y, data, cameraBounds = null) {
  const color = getPixelColor(x, y, data, cameraBounds);
  if (!color || color.a <= 128) return false;
  return colorsMatch(color, HEATMAP_COLORS.BLACK, 2);
}
```

Used for:
- Landing detection
- Ground friction application
- Negative cases in back-face detection

### 4. Wall Collision Response (in `resolveCollisionsStep`)
**Location:** `js/physics.js` lines ~3619-3656 (right) and ~3674-3704 (left)

Walls are **ALWAYS impassable**, regardless of airborne state:
```javascript
if (surfaceType === "wall") {
  // Walls: Always stop movement and correct position
  p.vel.x = 0;
  p.pos.x = Math.floor(checkX) - hb.w; // Snap to surface immediately

  // CONTINUOUS POSITION CORRECTION: Ensure never inside wall
  const newHb = Renderer.getHurtbox(p);
  if (isPixelSolidScaled(newHb.left + newHb.w, checkYMid, groundData, state)) {
    p.pos.x = Math.floor(checkX) - newHb.w - 0.1;
  }
}
```

### 5. Wallslide Back-Face Detection (`bounce_wall.png`)
**Location:** `js/physics.js` lines ~3083-3142

**Critical Change:** Back-face check now uses `isWallPixelScaled()` instead of `isPixelSolidScaled()`

```javascript
// Check LEFT wall - Back-Face detection
const checkBackFaceX = pt.x - 8; // 8 pixels left of wallslide surface

// ONLY check for DARK_GRAY walls, NOT black ground
const isBackFace = isWallPixelScaled(
  checkBackFaceX,
  pt.y,
  state.groundData,
  state
);

if (!isBackFace) {
  // Front-Face: no DARK_GRAY wall blocking → allow wallslide
  leftWall = true;
}
```

**Behavior:**
- Scenario: `[DARK_GRAY][GREEN Wallslide][Luft]`
  - Left: DARK_GRAY detected → Back-Face → NO wallslide from left
  - Right: No DARK_GRAY → Front-Face → wallslide from right ALLOWED

- Scenario: `[DARK_GRAY][GREEN Wallslide][DARK_GRAY]`
  - Left: DARK_GRAY detected → Back-Face → NO wallslide from left
  - Right: DARK_GRAY detected → Back-Face → NO wallslide from right
  - Result: Wallslide blocked from both sides

## Heatmap Color Semantics

| Layer | Color | RGB | Meaning | Behavior |
|-------|-------|-----|---------|----------|
| `ground.png` | BLACK | (0,0,0) | Normal ground/floor | Players can walk/land, non-blocking |
| `ground.png` | DARK_GRAY | (64,64,64) | Impassable wall | Blocks all movement, full collision |
| `bounce_wall.png` | GREEN | (0,255,0) | Wallslide surface | Vertical wallslide mechanic, separate layer |

## Implementation Checklist

✅ Precise color-based collision detection
✅ Dedicated wall/ground pixel detection functions
✅ Wall collision responses (always impassable)
✅ Position correction for stuck players
✅ Wallslide back-face detection updated
✅ No linter errors
✅ Architecture validated

## Testing Recommendations

1. **Horizontal Movement:**
   - Walk into a wall → should stop immediately
   - Airborne jump into wall → should stop, not slide up

2. **Wallslide Mechanics:**
   - Single wall with wallslide layer: slide from open side only
   - Double walls (confined space): no wallslide possible
   - Mixed surfaces: confirm BLACK ground doesn't interfere

3. **Edge Cases:**
   - Player respawn in wall → should be immediately pushed out
   - Fast movement into wall → should snap position correctly
   - Scaled stages → coordinate scaling should work correctly

## Files Modified

- `js/physics.js` (primary collision system)

## Backward Compatibility

✅ All existing code using `isPixelSolid()` continues to work
✅ New functions are additive (no breaking changes)
✅ Wallslide mechanics preserved with enhanced precision

## Performance Notes

- Color matching uses simple RGB comparison with tolerance
- `colorsMatch()` function is O(1) per pixel check
- No additional memory overhead
- Scaling/coordinate transformation reuses existing infrastructure

