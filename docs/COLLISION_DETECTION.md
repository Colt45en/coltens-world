# Option A2: Collision Detection & Response

## Architecture

### Client-Side Collision Prediction

The `PredictionEngine` now includes full collision detection and response:

1. **Collider Types:**
   - Circle colliders (15px radius) for player entities
   - Box colliders (axis-aligned rectangles) for static world geometry

2. **Prediction Flow:**

   ```
   Update Input → Predict Move (check collisions) → Response (slide/stop) → Render
   ```

3. **Collision Response:**
   - **No collision:** Move freely to next position
   - **Wall collision:** Stop movement, slide along surface if possible
   - **Entity collision:** Tracked for gameplay (push-back in future phases)

### Server-Side Collision Validation

The sim server validates all moves against world colliders:

1. **Per-Frame Validation:**

   ```
   Receive Input → Calculate Next Position → Validate Against World → Send Snapshot
   ```

2. **Validation Strategy:**
   - Axis-aligned optimization: Try moving along X or Y only if diagonal fails
   - Continues allowing valid movement directions when blocked by corners

3. **Anti-Cheat:**
   - Server enforces bounds independently from client prediction
   - Large divergence (> 500px) triggers reconciliation snap
   - Client cannot request impossible moves

## Implementation Details

### Files Modified

**`packages/engine/src/collision.ts`** (NEW - 180 lines)

- `CircleCollider` and `BoxCollider` types
- `detectCircleBox()` - AABB collision detection
- `predictMove()` - Check move validity against static colliders
- `slideAlongCollision()` - Calculate tangent response for wall-sliding

**`packages/engine/src/prediction.ts`** (UPDATED)

- `PredictedEntity` now includes optional `collider: { radius }`
- `PredictionEngine` constructor takes `staticColliders: BoxCollider[]`
- `stepPrediction(dt)` now calls `predictMove()` and handles collision response
- New methods:
  - `getLastCollisions()` - Retrieve collision events from last frame
  - `setStaticColliders()` - Update world geometry at runtime

**`packages/engine/src/contracts/protocol/sim.ts`** (UPDATED)

- New `SimWorldMetadata` message type
- `BoxCollider` Zod schema
- Server sends level geometry on client connection

**`apps/sim-server/src/sim/collision.ts`** (NEW - 80 lines)

- Server-side collision validation
- `validateMoveAgainstColliders()` - Clamp position to valid space
- Receives authoritative static colliders from level

**`apps/sim-server/src/net/wsServer.ts`** (UPDATED)

- Accepts `staticColliders` option
- Sends `sim.worldMetadata` on client connection
- Validates all entity moves in tick loop
- Prevents clipping through world geometry

**`apps/sim-server/src/index.ts`** (UPDATED)

- Defines test arena (1200x700) with walls and obstacles
- Creates L-shaped center obstacle for testing navigation

**`apps/preview-runtime/src/main.ts`** (UPDATED)

- Waits for `sim.worldMetadata` before initializing `PredictionEngine`
- Renders collision boxes (purple wireframe) for debugging
- Tracks collision count and displays in HUD
- Shows collision indicator (red ring) around player when colliding
- Initialized PredictionEngine with received static colliders

## Protocol Messages

### Before: Client connects

```json
{
  "meta": { "v": "1.0.0", "ts": 1700000000 },
  "type": "sim.snapshot",
  "payload": { "tick": 0, "entities": [] }
}
```

### Now: Client connects + receives world metadata

```json
{
  "meta": { "v": "1.0.0", "ts": 1700000000 },
  "type": "sim.worldMetadata",
  "payload": {
    "levelId": "v1-arena",
    "staticColliders": [
      { "x": 0, "y": 0, "width": 1200, "height": 20 },
      { "x": 400, "y": 250, "width": 150, "height": 30 }
    ]
  }
}
```

## Testing

### Local Test (Both Client & Server on Local Machine)

1. Start Nucleus + Sim server (from IDE)
2. Open preview runtime in browser (http://localhost:5173)
3. Use WASD/Arrows to move player (green circle)
4. Walk toward purple wall boxes → collision prevents clipping
5. Navigate the L-shaped obstacle in center
6. HUD shows collision count when hitting walls

### Expected Behavior

- **No lag:** Prediction prevents wall-clipping immediately on client
- **No overshooting:** Collision response is smooth (slide along surface)
- **Server validation:** Server independently enforces same bounds
- **Reconciliation:** If client and server diverge, blend back into sync

### Debugging

- **Purple boxes:** Static world colliders (render via `globalAlpha = 0.3`)
- **Red ring:** Player collision radius when actively colliding
- **HUD indicator:** Shows collision event count (resets each frame)
- Browser console: Check for validation errors in wsServer

## Known Limitations

1. **Circle-Circle Collision:** Tracked but not blocking (for entity collisions in A3)
2. **Sliding Behavior:** Currently stops if diagonal blocked; could improve to slide further along valid axes
3. **Dynamic Colliders:** Not yet supported (all colliders are static)
4. **Damage/Knockback:** Collision events don't yet have callbacks

## Next Steps

### Option A3: Input Buffering

- Queue up to 64 input commands on client
- Server applies in sequence, catching up on high latency
- Smooth gameplay on 200ms+ links

### Option A4: Delta Snapshots

- Compress snapshots: only send changed entity state
- Baseline snapshots every N ticks
- ~80% bandwidth reduction for mobile

### Collision Enhancements (Future)

- **Push-Back Physics:** Multi-entity collisions push players apart
- **Damage Zones:** Collision callbacks trigger damage/effects
- **Trigger Shapes:** Non-physical collision zones for gameplay
- **Kinetic Colliders:** Moving obstacles (elevators, doors)

## Validation Checklist

✅ Client prediction prevents clipping through walls
✅ Server independently validates all moves
✅ World geometry loaded from server on connect
✅ Collision shapes render for debugging
✅ No performance regression vs. A1 (same prediction loop cost)
✅ Reconciliation still blends smoothly when diverged
✅ Protocol messages validated with Zod
