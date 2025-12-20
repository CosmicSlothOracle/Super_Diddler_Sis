# Deployment Cache Fix - Service Worker Update

## Problem
The deployed version was showing old code because:
1. **Service Worker Cache**: Old cache version (`beatfighter-v1`) was serving stale files
2. **No Cache Invalidation**: Updated files weren't being fetched fresh
3. **Microphone Permission**: `enumerateDevices()` was triggering unnecessary permission prompts

## Solutions Applied

### 1. Service Worker Cache Version Update
- **Changed**: `CACHE_NAME = "beatfighter-v1"` → `"beatfighter-v2-20250120"`
- **Effect**: Forces all clients to clear old cache and fetch fresh files
- **Location**: `sw.js` line 3

### 2. Network-First for Versioned Files
- **Added**: Special handling for files with `?v=` query strings
- **Effect**: Versioned JS/CSS files always fetch from network first, then cache
- **Location**: `sw.js` fetch handler

### 3. Service Worker Update Detection
- **Added**: Auto-reload when new service worker is installed
- **Effect**: Users automatically get latest version without manual refresh
- **Location**: `index.html` service worker registration

### 4. Microphone Permission Fix
- **Changed**: Made `enumerateDevices()` optional with error handling
- **Effect**: App works even if user denies microphone permission
- **Location**: `js/audio-device-manager.js`

### 5. PWA Meta Tag Update
- **Added**: `<meta name="mobile-web-app-capable" content="yes">`
- **Effect**: Fixes deprecated iOS meta tag warning
- **Location**: `index.html`

## Deployment Steps

1. **Commit all changes**:
   ```bash
   git add .
   git commit -m "fix: service worker cache invalidation and microphone permission"
   git push origin main
   ```

2. **After deployment, users need to**:
   - Hard refresh (Ctrl+Shift+R / Cmd+Shift+R)
   - Or clear browser cache
   - Or wait for automatic reload (if service worker update is detected)

3. **To force immediate update for all users**:
   - Increment `CACHE_NAME` version in `sw.js`
   - This triggers cache deletion on next visit

## Testing

### Verify Cache Update:
1. Open deployed site
2. Open DevTools → Application → Service Workers
3. Check cache name should be `beatfighter-v2-20250120`
4. Check "Update on reload" and refresh
5. Verify new code is loaded

### Verify Microphone Fix:
1. Open deployed site
2. Check console - should NOT see microphone permission prompt
3. Audio should still work normally

### Verify Mobile Controls:
1. Open on mobile device or emulator
2. Should see 9 buttons (3x3 grid) not 4 buttons (2x2 grid)
3. Controls should be responsive and working

## Future Cache Updates

When deploying new code:
1. Update `CACHE_NAME` in `sw.js` with new version/date
2. Update version query strings in `index.html` if needed
3. Service worker will automatically invalidate old cache

Example:
```javascript
const CACHE_NAME = "beatfighter-v3-20250125"; // New version
```

## Notes

- Service worker cache is aggressive for performance
- Version query strings (`?v=20250120`) bypass cache
- Network-first for versioned files ensures updates are always fresh
- Old caches are automatically deleted on service worker activation

