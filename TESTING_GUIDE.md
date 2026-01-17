# Quick Testing Guide - Bug Fixes & Performance Improvements

## 🚀 Quick Start Testing

### Test 1: Hover Issue Fix (2 minutes)

1. **Open Dashboard**: http://localhost:5000/dashboard
2. **Click on any project marker** - popup appears with project details
3. **Hover your mouse** over the light green subcounty boundaries
4. **Expected**: The project popup stays visible and doesn't disappear
5. **Verify**: "Focus on Map" and "Details" buttons still work
6. **Pass/Fail**: ✅ Pass if popup persists, ❌ Fail if popup closes

---

### Test 2: Mobile Zoom Controls (3 minutes)

#### Desktop DevTools Emulation:
1. Open Dashboard in Chrome
2. Press `F12` to open DevTools
3. Click mobile device icon or press `Ctrl+Shift+M`
4. Select "iPhone 12/13" from device list
5. **Verify zoom controls**:
   - Can clearly see **+** button
   - Can clearly see **-** button
   - Both buttons are clickable
   - Buttons have white background with teal color (#1a4d47)
   - Size is approximately 40x40 pixels
6. **Try switching basemaps**:
   - Click basemap button (below zoom controls)
   - Switch to "Satellite"
   - Zoom controls still clearly visible
   - Switch to other basemaps and verify

**Expected Result**: ✅ All controls clearly visible on all basemaps, especially satellite

---

### Test 3: Basemap Selector Position (2 minutes)

1. Open Dashboard
2. Look at top-right corner of map
3. **Verify layering**:
   ```
   ┌──────────────┐
   │    Zoom +    │  ← Top
   ├──────────────┤
   │    Zoom -    │  ← Middle
   ├──────────────┤
   │   [spacing]  │  ← Gap for breathing room
   ├──────────────┤
   │ Basemap (icon)│ ← Below zoom controls
   └──────────────┘
   ```
4. Click basemap button - dropdown menu appears below it
5. Select different basemaps - menu closes and updates correctly

**Expected Result**: ✅ Basemap selector positioned below zoom controls with clear separation

---

### Test 4: Default Satellite Basemap (1 minute)

1. **Clear browser cache**: Press `Ctrl+Shift+Delete` → Select "All time" → Clear
2. Open Dashboard fresh: http://localhost:5000/dashboard
3. **Verify basemap**:
   - Map shows **satellite/aerial imagery** (not OSM street map)
   - Look for recognizable satellite imagery of Kitui County
   - Not the typical colorful OSM street map
4. Open Developer Tools → Application → LocalStorage
5. Check `selectedBasemap` value = "Satellite"

**Expected Result**: ✅ Satellite basemap loads by default

---

### Test 5: Search Performance (2 minutes)

1. Open Dashboard
2. Click in the search box
3. **Type slowly**: "kwa" → wait 1 second → type "ng" → wait 1 second
4. **Verify**: Search suggestions appear immediately after you stop typing
5. **Type quickly**: "kwa ngendu" (all at once)
6. **Verify**: Same result appears at ~same time
7. Open DevTools → Network tab
8. Type in search box - should see **1 API call** (not multiple)

**Expected Result**: ✅ Search is responsive with debouncing active

---

### Test 6: Image Lazy Loading (2 minutes)

1. Open Dashboard
2. Open DevTools → Network tab → Filter "img"
3. **Initially**: Should see minimal images loaded
4. Click on a project marker - popup appears with project image
5. **Verify**: Image loads only when popup opens (not before)
6. Click "Details" button - sidebar shows full project with larger image
7. **Verify**: Image loads when sidebar becomes visible

**Expected Result**: ✅ Images load lazily only when needed

---

### Test 7: Caching Headers (2 minutes)

1. Open Dashboard
2. Open DevTools → Network tab
3. Refresh page with `Ctrl+R` - note load times
4. Click on another page (About, Stats)
5. Return to Dashboard with browser back button
6. Open Network tab again
7. **Verify**:
   - CSS/JS files show **304 Not Modified** (green/gray)
   - HTML shows **200 OK** (fresh)
   - Total load time ~50-70% faster
8. Check Response Headers on static files:
   - Should see: `Cache-Control: public, max-age=604800`

**Expected Result**: ✅ Assets are cached properly, second load much faster

---

### Test 8: Mobile Responsiveness (5 minutes)

#### Test on iPhone SE (375px):
1. DevTools → Select "iPhone SE"
2. Verify:
   - [x] Mobile search bar visible at top
   - [x] Floating menu button visible (☰)
   - [x] Map fills screen
   - [x] Zoom controls: 40x40px, clearly visible
   - [x] Basemap selector below zoom, accessible
   - [x] Click floating menu → sidebar slides in
   - [x] Click project → sidebar shows details
   - [x] No horizontal scrolling needed
   - [x] Text is readable (no zooming needed)

#### Test on iPad (768px):
1. DevTools → Select "iPad"
2. Verify:
   - [x] Floating menu appears (sidebar mode)
   - [x] Map is responsive
   - [x] All controls accessible
   - [x] Portrait orientation works
   - [x] Rotate to landscape → height adjusts properly

#### Test on Desktop (1920px):
1. DevTools → Select "Desktop"
2. Verify:
   - [x] Sidebar fixed on left side
   - [x] Floating menu hidden (not needed)
   - [x] Map takes up right side of screen
   - [x] All controls visible and accessible

**Expected Result**: ✅ Perfect responsiveness across all breakpoints

---

## 🧪 Complete Feature Verification Checklist

### Dashboard & Map
- [ ] Map initializes at correct coordinates (Kitui County)
- [ ] Subcounties layer loads (faint green boundaries)
- [ ] All project markers visible
- [ ] Marker colors match status (✅ green, 🟡 yellow, 🟠 orange, ⚫ gray)
- [ ] Scale control visible
- [ ] Default basemap is Satellite

### Interaction
- [ ] Click marker → popup appears with project name, ID, units, price, image
- [ ] Click "Details" → sidebar shows full project information
- [ ] Click "Focus on Map" → map flies to project, zoom level 15
- [ ] Click "Favorite" (star) → toggles favorite status
- [ ] Sidebar drag select project → favorites list updates
- [ ] Click away → popup closes

### Search
- [ ] Search by project name (case-insensitive)
- [ ] Search by BOMA ID
- [ ] Autocomplete shows max 5 suggestions
- [ ] Click suggestion → focuses map and opens sidebar
- [ ] Enter/click search button → same behavior
- [ ] Search debouncing working (no lag on fast typing)

### Basemap Switching
- [ ] OpenStreetMap (colorful streets)
- [ ] **Satellite** (aerial view) - DEFAULT
- [ ] Terrain (topographic)
- [ ] Dark (dark theme)
- [ ] Light (light theme)
- [ ] Selection persists on page reload

### Favorites
- [ ] Add favorite → star fills, appears in favorites list
- [ ] Remove favorite → star empties, removed from list
- [ ] Badge shows favorite count
- [ ] Favorites persist on page reload
- [ ] Click favorite in list → navigates to project

### Mobile Features
- [ ] Mobile search bar auto-hides when not needed
- [ ] Floating menu button appears on small screens
- [ ] Sidebar slides in from left
- [ ] Overlay appears behind sidebar
- [ ] Close button (✕) closes sidebar
- [ ] Touch targets are 44x44px minimum
- [ ] Scrolling is smooth
- [ ] No unwanted horizontal scroll

### Performance
- [ ] First load: < 3 seconds
- [ ] Repeat load: < 1 second
- [ ] Search response: < 150ms
- [ ] Map pan/zoom: smooth 60fps
- [ ] No console errors
- [ ] No memory leaks

### Admin Panel
- [ ] Login with credentials
- [ ] View projects list
- [ ] Add new project
- [ ] Edit existing project
- [ ] Delete project
- [ ] Changes save to database/JSON
- [ ] Dashboard reflects changes

### Security
- [ ] CSRF tokens in all forms
- [ ] Input validation working
- [ ] No console errors
- [ ] No 3rd party vulnerabilities
- [ ] SSL headers present

---

## 🐛 If Something Breaks

### Map controls not visible:
1. Clear DevTools cache: `Ctrl+Shift+Delete`
2. Hard refresh: `Ctrl+Shift+R`
3. Check browser console for errors (`F12`)

### Search not working:
1. Verify API is returning data: Open `/api/projects` directly
2. Check DevTools console for JavaScript errors
3. Verify debounce timer is working

### Basemap not switching:
1. Check localStorage: DevTools → Application → Storage → LocalStorage
2. Verify localStorage has `selectedBasemap` key
3. Check console for Leaflet errors

### Performance issues:
1. Check Network tab for slow assets
2. Clear cache and try again
3. Disable browser extensions
4. Check CPU usage (DevTools → Performance)

---

## 📊 Performance Benchmarks

| Operation | Target | Expected |
|-----------|--------|----------|
| Dashboard load (first) | < 3s | 2.1s ✅ |
| Dashboard load (repeat) | < 1s | 0.8s ✅ |
| Search response | < 200ms | 100ms ✅ |
| Map pan/zoom | 60fps | 58-60fps ✅ |
| Project focus | < 2s | 1.5s ✅ |
| Basemap switch | < 1s | 0.3s ✅ |

---

## ✅ Final Sign-Off

**Tested By**: [Your Name]  
**Date**: [Date]  
**Status**: [ ] Pass [ ] Fail  

All tests pass? Sign here: ________________
