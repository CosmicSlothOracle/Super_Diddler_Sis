# Mobile Version Troubleshooting Guide

## Overview
This guide helps diagnose and fix issues with the mobile version of Beat Fighter, focusing on controls, performance, and user experience.

## Common Issues and Solutions

### 1. Controls Not Appearing

**Symptoms:**
- No joystick or buttons visible on mobile device
- Controls work on desktop but not on mobile

**Diagnosis:**
1. Check if device is detected as mobile:
   - Open browser console and check: `window.matchMedia("(pointer: coarse)").matches`
   - Should return `true` on mobile devices
2. Check viewport width:
   - Controls show when `window.innerWidth < 900px` OR `(pointer: coarse)` matches
3. Check CSS:
   - Verify `mobile-controls.css` is loaded
   - Check for CSS conflicts (z-index, display properties)

**Solutions:**
- Ensure viewport meta tag is correct in `index.html`:
  ```html
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
  ```
- Force show controls (for testing): In browser console:
  ```javascript
  document.getElementById('mobile-controls').style.display = 'block';
  ```
- Check if controls are behind canvas: Increase z-index in CSS (already set to 10000)

### 2. Joystick Not Responding

**Symptoms:**
- Joystick appears but doesn't move character
- Joystick knob doesn't follow finger

**Diagnosis:**
1. Check pointer events:
   - Open browser console during touch
   - Verify `pointerdown`, `pointermove`, `pointerup` events fire
2. Check joystick state:
   ```javascript
   window.MobileControls.getAxisX(); // Should return -1 to 1
   window.MobileControls.getAxisY(); // Should return -1 to 1
   ```
3. Check input handler:
   - Verify `InputHandler.getMobileInput(0)` returns correct axis values

**Solutions:**
- **Issue: Pointer events blocked**
  - Ensure `touch-action: none` is set on joystick area
  - Check for overlapping elements blocking touches
  - Verify `e.preventDefault()` and `e.stopPropagation()` are called

- **Issue: Joystick position incorrect after resize**
  - Fixed: Joystick base position now recalculates on resize/orientation change
  - If still occurs, manually trigger: `window.MobileControls.updateVisibility()`

- **Issue: Deadzone too large**
  - Current deadzone: 0.1 (10%)
  - To adjust, modify `deadzone` value in `mobile-controls.js` line ~267

### 3. Buttons Not Working

**Symptoms:**
- Buttons visible but no action when pressed
- Buttons work sometimes but not consistently

**Diagnosis:**
1. Check button state:
   ```javascript
   window.MobileControls.isButtonDown('jump'); // Should return true when pressed
   window.MobileControls.isButtonHeld('r1'); // Should return true while held
   ```
2. Check input handler:
   - Verify `InputHandler.getMobileInput(0)` includes button states
3. Check for edge detection issues:
   - Buttons use `down`/`up` edge detection
   - These reset each frame via `clearEdges()`

**Solutions:**
- **Issue: Button presses not detected**
  - Ensure `pointerdown` events fire (check browser console)
  - Verify buttons have `pointer-events: auto` (not `none`)
  - Check for CSS `touch-action: none` on buttons

- **Issue: Buttons too small to press**
  - Minimum touch target is now 44x44px (Apple/Google recommendation)
  - Adjust button container size in CSS if needed

- **Issue: Accidental touches**
  - Buttons now have better visual feedback
  - Consider increasing gap between buttons in CSS

### 4. Touch Navigation Not Working (Menus/Selection)

**Symptoms:**
- Can't tap on character/stage selection
- Modal buttons don't respond to touch
- Title screen doesn't respond to touch

**Diagnosis:**
1. Check touch navigation initialization:
   ```javascript
   window.TouchNavigation // Should exist
   ```
2. Check canvas coordinates:
   - Touch coordinates are converted to canvas space
   - Verify `getCanvasCoordinates()` accounts for device pixel ratio
3. Check debounce:
   - Default: 200ms (desktop), 100ms (mobile)
   - Too high = unresponsive, too low = double-taps

**Solutions:**
- **Issue: Touch coordinates incorrect**
  - Fixed: Now accounts for device pixel ratio
  - If still off, check canvas scaling in `handleResize()`

- **Issue: Touch blocked by mobile controls**
  - Touch navigation checks if touch is on controls and ignores it
  - Verify control areas don't overlap menu items

- **Issue: Debounce too aggressive**
  - Reduced to 100ms on mobile (was 200ms)
  - Can be adjusted in `touch-navigation.js` line ~45

### 5. Performance Issues

**Symptoms:**
- Game runs slowly on mobile
- Frame drops during combat
- Battery drains quickly

**Diagnosis:**
1. Check performance mode:
   ```javascript
   state.performanceMode // Should be true on mobile
   ```
2. Check frame rate:
   - Use browser dev tools performance tab
   - Target: 60 FPS, acceptable: 30+ FPS
3. Check hardware:
   ```javascript
   navigator.hardwareConcurrency // CPU cores
   ```

**Solutions:**
- **Performance mode enabled automatically:**
  - Triggered by `(pointer: coarse)` OR `hardwareConcurrency < 4`
  - Reduces particle effects, simplifies rendering

- **Manual optimizations:**
  - Reduce particle count in `particle-system.js`
  - Disable WebGL effects if available
  - Lower canvas resolution (not recommended - breaks UI)

- **Battery optimization:**
  - Ensure `requestAnimationFrame` is used (not `setInterval`)
  - Avoid constant polling - use event-driven updates

### 6. Canvas Scaling Issues

**Symptoms:**
- Game appears too small/large
- Black bars on sides/top
- Touch coordinates don't match visual elements

**Diagnosis:**
1. Check canvas size:
   ```javascript
   canvas.width, canvas.height // Internal resolution
   canvas.style.width, canvas.style.height // Display size
   ```
2. Check viewport:
   ```javascript
   state.viewport // Should match canvas display size
   ```
3. Check aspect ratio:
   - Native: 2500x1380 (from `GameState.CONSTANTS`)
   - Canvas maintains aspect ratio with letterboxing

**Solutions:**
- **Black bars are normal:**
  - Game maintains 16:9 aspect ratio
  - Letterboxing (black bars) appears on non-16:9 screens
  - This is intentional to prevent stretching

- **Touch coordinates off:**
  - Fixed: Now accounts for device pixel ratio
  - If still incorrect, verify canvas scaling in `main.js` `handleResize()`

### 7. Orientation Issues

**Symptoms:**
- Controls misaligned after rotation
- Joystick position incorrect in landscape
- Buttons overlap in portrait

**Diagnosis:**
1. Check orientation:
   ```javascript
   window.orientation // -90, 0, 90, 180
   window.innerWidth, window.innerHeight // Swap on rotation
   ```
2. Check CSS media queries:
   - `@media (orientation: landscape)`
   - `@media (orientation: portrait)`

**Solutions:**
- **Orientation change handler:**
  - Added `orientationchange` event listener
  - Recalculates joystick position after 100ms delay
  - CSS adjusts control sizes for landscape/portrait

- **Manual fix:**
  - Rotate device, wait 1 second
  - Controls should auto-adjust
  - If not, refresh page

### 8. Audio Issues on Mobile

**Symptoms:**
- No sound on mobile
- Audio delayed or choppy
- Audio doesn't start until interaction

**Diagnosis:**
1. Check audio context:
   ```javascript
   AudioSystem.audioContext.state // Should be 'running'
   ```
2. Check user interaction:
   - Mobile browsers require user interaction before audio
   - Audio unlocks on first touch (via `audio-device-manager.js`)

**Solutions:**
- **Audio requires interaction:**
  - Normal behavior - browsers block autoplay
  - Audio unlocks on first touch/click
  - If still no sound, check browser permissions

- **Audio choppy:**
  - Reduce audio buffer size in `audio-system.js`
  - Disable audio effects if available
  - Check device performance (see Performance Issues)

## Best Practices for Mobile Testing

### 1. Test on Real Devices
- Emulators don't accurately represent touch behavior
- Test on multiple devices (iOS, Android, different screen sizes)
- Test in both portrait and landscape

### 2. Use Browser DevTools
- Chrome: `chrome://inspect` → Remote debugging
- Safari: Develop menu → [Your Device]
- Firefox: `about:debugging` → This Firefox → Inspect

### 3. Test Touch Events
```javascript
// In browser console on mobile device
document.addEventListener('touchstart', (e) => {
  console.log('Touch:', e.touches.length, e.touches[0].clientX, e.touches[0].clientY);
});
```

### 4. Monitor Performance
- Use browser performance profiler
- Check frame rate (target: 60 FPS)
- Monitor memory usage
- Check network requests (asset loading)

### 5. Test Different Scenarios
- Title screen → Character select → Stage select → Gameplay
- Test all buttons (jump, R1, R2, L1, L2, roll, grab, dance, ultimate)
- Test joystick in all directions
- Test during combat (stress test)

## Recommended Mobile Settings

### For Best Performance:
1. **Close other apps** - Free up RAM/CPU
2. **Enable performance mode** - Automatic on mobile
3. **Use landscape** - Better control layout
4. **Stable internet** - For asset loading (if not cached)

### For Best Controls:
1. **Use landscape orientation** - More screen space for controls
2. **Hold device with both hands** - Thumbs on controls
3. **Adjust brightness** - See controls clearly
4. **Disable screen timeout** - Prevent interruptions

## Debugging Commands

### Check Mobile Controls State:
```javascript
// Get joystick position
console.log('Axis X:', window.MobileControls.getAxisX());
console.log('Axis Y:', window.MobileControls.getAxisY());

// Check button states
console.log('Jump:', window.MobileControls.isButtonHeld('jump'));
console.log('R1:', window.MobileControls.isButtonHeld('r1'));
```

### Check Input Handler:
```javascript
// Get mobile input for P1
const input = window.InputHandler.getMobileInput(0);
console.log('Mobile Input:', input);
```

### Force Show/Hide Controls:
```javascript
// Show
document.getElementById('mobile-controls').style.display = 'block';

// Hide
document.getElementById('mobile-controls').style.display = 'none';

// Update visibility
window.MobileControls.updateVisibility();
```

### Check Performance Mode:
```javascript
console.log('Performance Mode:', state.performanceMode);
console.log('Is Mobile:', window.matchMedia("(pointer: coarse)").matches);
```

## Known Limitations

1. **Only P1 gets mobile controls** - P2 requires gamepad/keyboard
2. **No haptic feedback** - Visual feedback only
3. **Fixed control layout** - Not customizable (yet)
4. **No multi-touch gestures** - Single touch at a time
5. **Battery usage** - Game is CPU/GPU intensive

## Future Improvements

1. **Haptic feedback** - Vibration on button press
2. **Customizable controls** - Drag to reposition
3. **Control transparency** - Adjustable opacity
4. **P2 mobile controls** - Support for second player
5. **Gesture support** - Swipe for special moves
6. **Performance tuning** - Device-specific optimizations

## Getting Help

If issues persist:
1. Check browser console for errors
2. Verify all scripts load (Network tab)
3. Test in different browsers (Chrome, Safari, Firefox)
4. Check device compatibility (iOS 12+, Android 8+)
5. Clear browser cache and reload

For specific issues, provide:
- Device model and OS version
- Browser and version
- Steps to reproduce
- Console errors (if any)
- Screenshot/video if possible

