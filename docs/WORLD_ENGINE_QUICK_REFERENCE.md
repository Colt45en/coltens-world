# Quick Reference: Adding Apps to World Engine

## Add a New Route App (Internal Page)

### Step 1: Create the page component

**`src/lab/LabMyFeaturePage.tsx`**

```tsx
import React from "react";
import { GlassPanel, NeonTitle, NeonButton } from "../ui/neon";
import { useNavigate } from "react-router-dom";

export function LabMyFeaturePage() {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto">
      <GlassPanel className="rounded-2xl p-6">
        <NeonTitle as="h2" className="text-2xl">
          My Feature
        </NeonTitle>
        <p className="text-white/60 mt-3">Your feature description here.</p>
        <div className="mt-6">
          <NeonButton variant="ghost" onClick={() => navigate("/")}>
            Back
          </NeonButton>
        </div>
      </GlassPanel>
    </div>
  );
}
```

### Step 2: Import in `WorldRouter.tsx`

```tsx
import { LabMyFeaturePage } from "../lab/LabMyFeaturePage";
```

### Step 3: Add route in `WorldRouter.tsx`

In the `<Routes>` section, add:

```tsx
<Route path="/lab/myfeature" element={<LabMyFeaturePage />} />
```

### Step 4: Register in `AppRegistry.tsx`

Add to `WORLD_APPS` array:

```tsx
{
  id: "lab-myfeature",
  name: "My Feature",
  description: "Description of what it does.",
  icon: "🔧",                        // Any emoji
  kind: "route",
  path: "/lab/myfeature",
  group: "lab",                      // or "core" | "tools" | "external"
},
```

**Done!** Your app now appears in the launcher. ✅

---

## Add a New IFrame (Embedded App)

### Step 1: Register in `AppRegistry.tsx`

```tsx
{
  id: "embedded-tool",
  name: "Embedded Tool",
  description: "External app running on localhost:5170",
  icon: "🌐",
  kind: "iframe",
  url: "http://localhost:5170",      // Target URL
  group: "tools",
},
```

**Done!** Clicking this card opens `/apps/embedded-tool` with the iframe. ✅

---

## Add an External Link (New Tab)

### Step 1: Register in `AppRegistry.tsx`

```tsx
{
  id: "github",
  name: "Repository",
  description: "Source code on GitHub",
  icon: "⌬",
  kind: "external",
  url: "https://github.com/...",
  group: "external",
},
```

**Done!** Clicking this card opens GitHub in a new tab. ✅

---

## AppRegistry: Complete Reference

```tsx
type WorldApp = {
  id: string; // Unique identifier
  name: string; // Display name (card title)
  description: string; // Subtitle (card hint)
  icon: string; // Any emoji ✓
  kind: AppKind; // "route" | "iframe" | "external"

  // For kind="route"
  path?: string; // e.g., "/lab/myeature"

  // For kind="iframe" | "external"
  url?: string; // Target URL

  // Optional grouping
  group?: "core" | "lab" | "tools" | "external";
};
```

---

## Group Names (Launcher Sections)

| Group      | Purpose           | Examples                        |
| ---------- | ----------------- | ------------------------------- |
| `core`     | Essential runtime | Launcher, Neon Hub              |
| `lab`      | Development tools | Studio, Nucleus, Brain, Lexicon |
| `tools`    | Utilities         | Dashboards, Config, Sandbox     |
| `external` | External links    | Docs, GitHub, Issues            |

---

## Navigation Between Pages

### Link to another app

```tsx
import { useNavigate } from "react-router-dom";

export function MyComponent() {
  const navigate = useNavigate();

  return <button onClick={() => navigate("/lab/brain")}>Go to Brain</button>;
}
```

### Go back

```tsx
const navigate = useNavigate();
<button onClick={() => navigate(-1)}>Back</button>;
```

---

## Styling Your Page

### Using Neon Primitives

```tsx
import { GlassPanel, GlassCard, NeonButton, NeonTitle, StatChip } from "../ui/neon";

// Glass panel (container)
<GlassPanel className="rounded-2xl p-6">
  Content here
</GlassPanel>

// Glass card (clickable tile)
<GlassCard onPress={() => console.log("clicked")}>
  <div>Card content</div>
</GlassCard>

// Neon title (glowing text)
<NeonTitle as="h2">My Title</NeonTitle>

// Neon button
<NeonButton>Primary Button</NeonButton>
<NeonButton variant="ghost">Secondary</NeonButton>

// Stat chip (metric display)
<StatChip label="STATUS" value="ONLINE" accent="green" />
```

### Theme colors (via CSS variables)

```css
/* In your inline styles or CSS: */
color: var(--neon-cyan); /* #00f3ff */
color: var(--neon-gold); /* #ffaa00 */
color: var(--neon-green); /* #00ff66 */
background: var(--glass-bg);
border: 1px solid var(--glass-border);
```

---

## Updating Layout Navigation

### Desktop top nav (3 buttons)

Edit `NeonNexusLayout.tsx`:

```tsx
const desktopLinks = useMemo(
  () => [
    { key: "system", label: "SYSTEM" }, // Edit labels
    { key: "data", label: "DATA" },
    { key: "store", label: "STORE" },
  ],
  [],
);
```

### Mobile bottom nav (5 icons)

Fixed glyphs in `NavIcon` component. Edit the glyph strings if needed:

- `⌂` HOME (bottom-left)
- `⧉` DATA (left)
- `+` CENTER action
- `⚑` ALERTS (right)
- `⚙` SET (bottom-right)

### Routing on nav click

In `WorldRouter.tsx`, update the `onNav` handler:

```tsx
onNav={(key) => {
  if (key === "system") navigate("/lab/studio");    // Edit routes
  else if (key === "data") navigate("/");
  // ...
}}
```

---

## Common Patterns

### Loading state

```tsx
const [loading, setLoading] = useState(false);

if (loading) {
  return <div className="text-white/60">Loading...</div>;
}
```

### Error handling

```tsx
if (!app) {
  return (
    <GlassPanel className="rounded-2xl p-5">
      <div className="font-bold">Error: App not found</div>
    </GlassPanel>
  );
}
```

### Empty state

```tsx
if (items.length === 0) {
  return (
    <GlassPanel className="rounded-2xl p-8 text-center">
      <div className="text-white/60">No items yet</div>
      <NeonButton className="mt-4" onClick={onCreate}>
        Create One
      </NeonButton>
    </GlassPanel>
  );
}
```

---

## Testing Locally

### 1. Run dev server

```bash
cd apps/ide-web
pnpm dev
```

### 2. Open browser

```
http://localhost:5173/
```

### 3. Navigate

- Click "Launcher" to see all apps
- Click "Neon Hub" for portal
- Click "Studio Lab" to access your existing StudioHub
- Mobile: Tap bottom nav icons

### 4. Add your app

- Register in `AppRegistry.tsx`
- Refresh browser
- App should appear in launcher instantly ✅

---

## Debugging

### Routes not updating?

Make sure you added both:

1. Import in `WorldRouter.tsx`
2. `<Route>` element
3. Entry in `WORLD_APPS`

### Icon/name not showing?

Check `AppRegistry.tsx` — make sure your app object has all required fields.

### Style issues?

Check browser DevTools. All CSS variables in `neon-nexus.css` are available globally.

### Navigation not working?

Make sure you're using `useNavigate()` from `react-router-dom`.

---

## File Map

```
apps/ide-web/src/
├── world/
│   ├── AppRegistry.tsx        ← Add apps here
│   └── WorldRouter.tsx         ← Add routes here
├── lab/
│   └── LabMyPage.tsx           ← Create new pages here
├── ui/
│   └── neon.tsx               ← Use these components
├── styles/
│   └── neon-nexus.css         ← Edit colors here
└── main.tsx                   ← Already configured ✅
```

---

**Quick checklist for new app:**

- [ ] Create component in `src/lab/`
- [ ] Import in `WorldRouter.tsx`
- [ ] Add `<Route>` in `<Routes>`
- [ ] Add entry to `WORLD_APPS` in `AppRegistry.tsx`
- [ ] Refresh browser
- [ ] Done! 🎉
