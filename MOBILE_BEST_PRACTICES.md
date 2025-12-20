# Mobile Best Practices - Quick Reference

## Quick Setup for Best Experience

### 1. Device Orientation
**Recommended: Landscape Mode**
- Better control layout
- More screen space for gameplay
- Controls are more accessible
- Game is designed for 16:9 aspect ratio

### 2. Browser Recommendations
**Best:**
- **Chrome (Android)** - Best performance, full feature support
- **Safari (iOS)** - Native iOS support, good performance

**Avoid:**
- Older browsers (< iOS 12, < Android 8)
- In-app browsers (Facebook, Twitter, etc.) - Limited features

### 3. Performance Tips
1. **Close background apps** - Free up RAM/CPU
2. **Enable airplane mode** (if offline) - Reduces battery drain
3. **Lower screen brightness** - Saves battery
4. **Disable screen timeout** - Prevents interruptions
5. **Use Wi-Fi** - Faster asset loading (if not cached)

### 4. Control Tips
- **Hold device with both hands** - Thumbs on controls
- **Use thumb pads, not fingertips** - Better control
- **Practice joystick deadzone** - Small movements may not register (10% deadzone)
- **Button layout:**
  - Left thumb: Joystick (movement)
  - Right thumb: Buttons (actions)
  - Top row: Jump, R1, R2
  - Middle row: L1, L2, Roll
  - Bottom row: Grab, Dance, Ultimate

### 5. First-Time Setup
1. **Allow audio** - Tap screen when prompted
2. **Wait for assets to load** - Don't tap during loading
3. **Test controls** - Move joystick, press buttons
4. **Adjust grip** - Find comfortable position

## Control Layout Reference

```
┌─────────────────────────────────────────┐
│                                         │
│              GAME AREA                  │
│                                         │
│                                         │
│                                         │
│                                         │
│                                         │
│  [JOYSTICK]              [BUTTONS]      │
│    ⭕                      ┌─┬─┬─┐      │
│                            │J│R│R│      │
│                            │U│1│2│      │
│                            ├─┼─┼─┤      │
│                            │L│L│R│      │
│                            │1│2│O│      │
│                            ├─┼─┼─┤      │
│                            │G│D│U│      │
│                            │R│A│L│      │
│                            └─┴─┴─┘      │
└─────────────────────────────────────────┘
```

**Left Side (Joystick):**
- Movement: Left/Right
- Up/Down: Not used (jump is separate button)

**Right Side (Buttons - 3x3 Grid):**
- **Top Row:** Jump, R1, R2
- **Middle Row:** L1, L2, Roll
- **Bottom Row:** Grab, Dance, Ultimate

## Common Control Patterns

### Basic Movement
1. **Walk:** Hold joystick left/right
2. **Jump:** Press Jump button
3. **Attack:** Press R1 (light) or R2 (heavy)

### Combat Combos
1. **Light Combo:** R1 → R1 → R1 (tap rapidly)
2. **Heavy Attack:** Hold R2 (charges)
3. **Dodge:** Press Roll button
4. **Grab:** Press Grab button (when close)

### Advanced
1. **Ultimate:** Press Ultimate button (when meter full)
2. **Dance:** Press Dance button (on dance spots)
3. **Wall Interaction:** Press Grab near wall

## Troubleshooting Quick Fixes

### Controls Not Showing?
- Rotate device (triggers resize)
- Refresh page
- Check browser console for errors

### Joystick Not Working?
- Lift finger and touch again
- Check if other apps are interfering
- Try different finger position

### Buttons Not Responding?
- Press firmly (not just tap)
- Wait for button animation
- Check if button is actually pressed (should highlight)

### Game Too Slow?
- Close other apps
- Lower screen brightness
- Disable background app refresh
- Restart device if needed

### Audio Not Working?
- Tap screen once (unlocks audio)
- Check device volume
- Check browser audio permissions

## Performance Expectations

### Minimum Requirements
- **iOS:** 12+ (iPhone 6s or newer)
- **Android:** 8.0+ (with 2GB RAM)
- **Browser:** Modern (Chrome 80+, Safari 12+)

### Expected Performance
- **60 FPS:** High-end devices (iPhone 12+, flagship Android)
- **30-60 FPS:** Mid-range devices (iPhone 8-11, mid-range Android)
- **20-30 FPS:** Low-end devices (older phones)

### If Performance is Poor
1. Enable performance mode (automatic on mobile)
2. Close background apps
3. Restart browser
4. Clear browser cache
5. Update browser to latest version

## Accessibility Tips

### For Larger Fingers
- Controls auto-adjust size based on screen
- Minimum touch target: 44x44px
- Buttons have visual feedback

### For Small Screens
- Controls scale down in landscape
- Font size adjusts automatically
- Consider using tablet for better experience

### For Vision
- Controls have high contrast (white on dark)
- Text has shadow for readability
- Buttons have borders for visibility

## Network Considerations

### First Load
- Requires internet connection
- Downloads assets (~10-50MB depending on cache)
- Subsequent loads are faster (cached)

### Offline Play
- Works offline after first load
- Service worker caches assets
- May need to clear cache if issues occur

## Battery Usage

### Expected Drain
- **High:** ~10-15% per hour (intensive gameplay)
- **Medium:** ~5-10% per hour (normal gameplay)
- **Low:** ~2-5% per hour (idle/menu)

### To Reduce Drain
1. Lower screen brightness
2. Close background apps
3. Disable unnecessary notifications
4. Use airplane mode (if offline)
5. Enable battery saver mode (device setting)

## Tips for Competitive Play

1. **Practice controls** - Get comfortable with layout
2. **Use landscape** - Better visibility and controls
3. **Stable connection** - If playing online
4. **Full battery** - Or keep charger nearby
5. **Quiet environment** - Focus on gameplay
6. **Comfortable position** - Avoid hand cramps

## Getting the Most Out of Mobile

### Advantages
- ✅ Portable - Play anywhere
- ✅ Touch controls - Intuitive
- ✅ Quick sessions - Easy to start/stop
- ✅ No setup - Just open browser

### Limitations
- ⚠️ Smaller screen - Less detail visible
- ⚠️ Touch only - No physical buttons
- ⚠️ Battery drain - Intensive gameplay
- ⚠️ Performance varies - Device dependent

### When to Use Desktop Instead
- Competitive matches (better controls)
- Long sessions (better ergonomics)
- Streaming/recording (better performance)
- Multiplayer with friends (better setup)

## Support

If you encounter issues:
1. Check `MOBILE_TROUBLESHOOTING_GUIDE.md` for detailed solutions
2. Try the quick fixes above
3. Test in different browser
4. Check device compatibility
5. Report issues with device/browser info

---

**Remember:** Mobile gaming is about convenience and portability. For the best competitive experience, consider using desktop with gamepad. But for quick matches on the go, mobile is perfect!

