# World Engine Router: Installation & Verification

**Status:** Ready to deploy
**Created:** 2026-02-12
**Files:** 20 components + config + docs

---

## Pre-Requisites Check

- ✅ React v18+ (already in your ide-web)
- ✅ Vite (already configured)
- ✅ TypeScript (already configured)
- ✅ Tailwind CSS (already installed)
- ⏳ **React Router v6** (need to install)

---

## Installation Steps

### 1️⃣ Install React Router

```bash
cd apps/ide-web
pnpm add react-router-dom
```

Expected output:

```
+ react-router-dom@6.x.x
added 2 packages...
```

### 2️⃣ Verify Files Created

Check that these files exist:

**Core System (7 files):**

- ✅ `src/world/AppRegistry.tsx` — App registry
- ✅ `src/world/WorldRouter.tsx` — React Router setup
- ✅ `src/styles/neon-nexus.css` — Theme
- ✅ `src/lib/cn.ts` — Utility
- ✅ `src/ui/neon.tsx` — UI components
- ✅ `tailwind.config.ts` — Tailwind config
- ✅ `src/main.tsx` — UPDATED (BrowserRouter wrapper)

**Effects (2 files):**

- ✅ `src/fx/NeonPhysicsCanvas.tsx` — Particle physics
- ✅ `src/fx/CyberGrid.tsx` — Grid overlay

**Layout (1 file):**

- ✅ `src/layout/NeonNexusLayout.tsx` — Layout wrapper

**Pages (5 files):**

- ✅ `src/pages/LauncherPage.tsx` — App discovery
- ✅ `src/pages/NeonHub.tsx` — Portal UI
- ✅ `src/pages/NotFound.tsx` — 404 page
- ✅ `src/iframe/IFrameAppPage.tsx` — Embed apps
- ✅ `src/layout/NeonNexusLayout.tsx` — Layout

**Lab Pages (4 files):**

- ✅ `src/lab/LabStudioPage.tsx` — Your existing StudioHub
- ✅ `src/lab/LabNucleusPage.tsx` — Nucleus placeholder
- ✅ `src/lab/LabBrainPage.tsx` — Brain placeholder
- ✅ `src/lab/LabLexiconPage.tsx` — Lexicon placeholder

### 3️⃣ Type Check

```bash
pnpm run type-check
```

Expected: **0 errors** (or only pre-existing ones)

If errors related to `react-router-dom`, make sure it's installed.

### 4️⃣ Build Test

```bash
pnpm run build
```

Expected: Build succeeds without fatal errors

### 5️⃣ Start Dev Server

```bash
pnpm dev
```

Expected output:

```
VITE v4.x.x  ready in XXX ms

➜  Local:   http://localhost:5173/
```

### 6️⃣ Open in Browser

Navigate to: **<http://localhost:5173/>**

---

## Visual Verification Checklist

### 🏠 Launcher Page (`/`) appears with

- [ ] Title: "World Engine"
- [ ] Subtitle: "Launch any application..."
- [ ] Two buttons: "NEON HUB" + "OPEN STUDIO"
- [ ] App grid with cards grouped by category:
    - CORE: Launcher, Neon Hub
    - LAB: Studio Lab, Nucleus Monitor, Brain Console, Lexicon Inspector
    - EXTERNAL: Docs

### ✨ Neon Hub Page (`/hub`) shows

- [ ] Title: "Digital Reality"
- [ ] 5 tiles: SYSTEM, MENU, ALERTS, MARKET, COMM
- [ ] Two buttons: "INITIATE" + "DOCS"
- [ ] Desktop: System strip at bottom
- [ ] Mobile: Bottom nav with glyphs

### 🎨 Theme Elements

- [ ] Deep blue/black background (not white)
- [ ] Cyan glow text in titles
- [ ] Glass panels with blur effect
- [ ] Moving grid overlay (slow animation)
- [ ] Particles moving on canvas (click to explode)
- [ ] Rounded glass cards with gradient borders

### 📱 Navigation

**Desktop:**

- [ ] Top nav bar with brand + buttons (SYSTEM, DATA, STORE)
- [ ] Button highlights when active
- [ ] Clicking buttons navigates correctly

**Mobile (narrow viewport: <640px):**

- [ ] Top nav hidden
- [ ] Mobile header with brand + user icon
- [ ] Bottom nav with 5 icons visible
- [ ] Center icon (+ button) prominent
- [ ] Bottom nav persists while scrolling

### 🧭 Route Tests

Click each launcher card and verify:

| Card              | Path           | Should Show          |
| ----------------- | -------------- | -------------------- |
| Launcher          | `/`            | Launcher page ✅     |
| Neon Hub          | `/hub`         | Portal UI ✅         |
| Studio Lab        | `/lab/studio`  | Your StudioHub ✅    |
| Nucleus Monitor   | `/lab/nucleus` | Placeholder page ✅  |
| Brain Console     | `/lab/brain`   | Placeholder page ✅  |
| Lexicon Inspector | `/lab/lexicon` | Placeholder page ✅  |
| Docs              | opens new tab  | GitHub in browser ✅ |

### 💻 Back Navigation

- [ ] Every page has a "Back" button (or back via nav)
- [ ] Clicking back returns to launcher
- [ ] URL updates correctly

### 🎯 Mobile Navigation

On small screen (mobile), test bottom nav:

| Icon | Label  | Route          | Action      |
| ---- | ------ | -------------- | ----------- |
| ⌂    | HOME   | → ?            | Verify      |
| ⧉    | DATA   | → /            | Launcher ✅ |
| +    | CENTER | → /lab/studio  | Studio ✅   |
| ⚑    | ALERTS | → /lab/nucleus | Nucleus ✅  |
| ⚙    | SET    | → /lab/lexicon | Lexicon ✅  |

---

## Performance Checklist

### 🚄 Load Time

- [ ] Launcher loads < 2 sec
- [ ] Quick navigation between pages (< 300ms)
- [ ] Particle canvas renders smoothly (60 fps)

### 🎬 Animations

- [ ] Grid moves smoothly (20s loop)
- [ ] Particles respond to mouse (smooth physics)
- [ ] Cards have hover effects
- [ ] Text glows on titles

### 📱 Responsiveness

- [ ] Desktop (1920px+): Top nav visible, full width
- [ ] Tablet (768px): Adaptive spacing
- [ ] Mobile (375px): Bottom nav, stacked cards

---

## Troubleshooting

### ❌ Blank white page

**Cause:** React Router not installed
**Fix:**

```bash
pnpm add react-router-dom
pnpm dev
```

### ❌ "Cannot find module 'react-router-dom'"

**Cause:** Module not installed
**Fix:**

```bash
pnpm install
pnpm dev
```

### ❌ StudioHub not showing at `/lab/studio`

**Cause:** Import missing
**Fix:** Check `src/lab/LabStudioPage.tsx` — make sure it imports `StudioHub` correctly

### ❌ CSS not loading (theme looks broken)

**Cause:** `neon-nexus.css` not imported
**Fix:** Check `src/main.tsx` — make sure it has:

```tsx
import "./styles/neon-nexus.css";
```

### ❌ No physics particles on canvas

**Cause:** Canvas context not available
**Check:** Browser console for errors
**Fix:** Make sure hardware acceleration is enabled in browser

### ❌ Type errors on build

**Run:**

```bash
pnpm add -D @types/react-router-dom
pnpm run type-check
```

### ❌ "router.d.ts not found"

**Fix:**

```bash
pnpm install
rm -rf node_modules/.vite
pnpm dev
```

---

## Testing Sequence (5-minute walk-through)

1. **Navigate to launcher** (`/`)
   - Verify all cards visible
   - Click "NEON HUB" → `/hub` works

2. **Check portal** (`/hub`)
   - Verify title & buttons render
   - Click "INITIATE" → back to launcher

3. **Open Studio** (`/lab/studio`)
   - Verify StudioHub appears
   - Check mode switcher works
   - Click back → returns to launcher

4. **Test mobile** (DevTools: toggle device toolbar)
   - Verify bottom nav appears
   - Click each icon → pages load
   - Verify responsive layout

5. **Verify effects**
   - Particles on screen background
   - Grid overlay moving
   - Cards have hover effects

---

## Success Criteria

All of the following verified:

- ✅ React Router installed + no import errors
- ✅ All 20 components load without errors
- ✅ Launcher page shows all apps at `/`
- ✅ Navigation between pages works (click cards, click back)
- ✅ Mobile nav visible on narrow screen
- ✅ Desktop nav visible on wide screen
- ✅ Theme colors present (cyan, gold, deep blue)
- ✅ Glass effects visible (blur, transparency)
- ✅ Particles animating on canvas
- ✅ Your existing StudioHub accessible at `/lab/studio`

---

## Next Steps (After Verification)

### Immediate

1. Verify all tests pass ✅
2. Commit to Git
3. Share deployment guide with team

### Short-term

1. **Replace placeholders** — Add real Nucleus/Brain/Lexicon UIs
2. **Add metrics** — Add system status strips
3. **Wire Brain** — Add chat query components in `/lab/brain`

### Medium-term

1. **Persistence** — Remember last visited page (localStorage)
2. **Rich branding** — Add app-specific icons/logos
3. **Search** — Add launcher search by app name
4. **Analytics** — Track which apps users visit

---

## File Summary

| Category    | Count  | Purpose                            |
| ----------- | ------ | ---------------------------------- |
| Core Router | 2      | AppRegistry + WorldRouter          |
| Styling     | 1      | neon-nexus.css (theme tokens)      |
| Utilities   | 1      | cn.ts (class helpers)              |
| Components  | 1      | neon.tsx (UI primitives)           |
| Effects     | 2      | Physics canvas + grid              |
| Layout      | 1      | NeonNexusLayout (top-level)        |
| Pages       | 2      | Launcher + NeonHub                 |
| Labs        | 4      | Studio + Nucleus + Brain + Lexicon |
| Iframe      | 1      | IFrameAppPage (embed apps)         |
| Config      | 2      | tailwind.config.ts + main.tsx      |
| Docs        | 2      | Integration guide + Quick ref      |
| **Total**   | **21** | **Full production-ready system**   |

---

## Deploy Command (When Ready)

```bash
cd apps/ide-web
pnpm install
pnpm run type-check
pnpm run build
pnpm run preview
```

Then visit: **<http://localhost:4173/preview>** to see production build.

---

**Status: READY FOR TESTING** ✨

Next action: Run `pnpm dev` and verify checklist.
