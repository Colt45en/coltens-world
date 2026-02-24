# 🌱 World Cultivation System — Agriculture, Genesis & Curriculum

Comprehensive guide to **world generation, character spawning, curriculum scheduling, and guardian invariants** in World Engine.

The "**agriculture**" layer is the deliberate cultivation of coherent worlds—seeding characters, managing progression through curriculum wheels, and enforcing grade rails that prevent invalid state transitions.

![Status](https://img.shields.io/badge/status-production%20ready-brightgreen) ![Determinism](https://img.shields.io/badge/determinism-verified-green) ![Constraints](https://img.shields.io/badge/constraints-enforced-red)

---

## 📋 Table of Contents

- [Overview](#overview)
- [World Genesis (Seeding)](#world-genesis-seeding)
- [Curriculum Wheel System](#curriculum-wheel-system)
- [Guardian Invariants (Grade Rails)](#guardian-invariants-grade-rails)
- [Character & Region Generation](#character--region-generation)
- [Continuity & Coherence](#continuity--coherence)
- [API & Integration](#api--integration)
- [Examples](#examples)

---

## 🎯 Overview

**World cultivation** is the disciplined process of:

1. **Genesis** → Seed world with regions, factions, characters
2. **Curriculum** → Organize learning/progression through structured wheel
3. **Constraints** → Apply guardian invariants to prevent invalid states
4. **Continuity** → Ensure coherence across timeline and state transitions

### Philosophy

> Worlds are grown, not built. We plant seeds (deterministic DNA), apply careful guardianship (constraints), and harvest coherent narratives (emergent behaviors).

---

## 🌍 World Genesis (Seeding)

### Architecture

**Path:** `unified_nexus/world_genesis.py`

Genesis is the **deterministic initialization** of a world:
- Regions and their characteristics
- Factions with governing ideologies
- Characters with family trees and relationships
- Initial state consistent across runs

### Determinism Guarantee

```python
# Same seed → Identical world every time
genesis = WorldGenesis(seed=42)
world1 = genesis.generate()  # Run 1

genesis = WorldGenesis(seed=42)
world2 = genesis.generate()  # Run 2

assert hash(world1) == hash(world2)  # Always true
```

**Implementation:**
- Seeded RNG (no `time.time()`)
- Stable serialization (sorted keys)
- Content-addressed hashes (SHA256)

### Generation Phases

```
Phase 1: Region Spawning
    ↓ Define geography, climate, resources
    ↓
Phase 2: Faction Creation
    ↓ Ideology, governance, territory
    ↓
Phase 3: Character Spawning
    ↓ Individual agents, family trees, skills
    ↓
Phase 4: Relationship Binding
    ↓ Trade routes, conflicts, alliances
    ↓
Phase 5: Timeline Seeding
    ↓ Initial events, history, momentum
```

### Region Seeding

```python
class Region:
    id: str                  # region_1, region_2, etc.
    name: str                # "The Verdant Vale"
    climate: str             # "temperate", "arid", "tundra"
    resources: List[str]     # ["timber", "wheat", "ore"]
    terrain_map: ndarray     # Height map (512x512)
    faction_claims: Dict     # faction_id → disputed (bool)
```

**Deterministic generation:**
```python
def generate_terrain_map(region_id: str, seed: int) -> np.ndarray:
    """Height map via Perlin noise with stable seeding."""
    rng = np.random.RandomState(hash((region_id, seed)))
    return perlin_2d(512, 512, rng)
```

### Faction Seeding

```python
class Faction:
    id: str
    name: str
    ideology: str            # "democratic", "authoritarian", "theocratic"
    capital_region: str      # Which region they call home
    resources_controlled: Dict[str, int]  # resource_type → quantity
    military_strength: int
    technological_level: int
    history_events: List[Event]
```

**Governance model:**
- **Democratic**: Decisions require majority approval
- **Authoritarian**: Single leader makes decisions
- **Theocratic**: Spiritual authority makes decisions

### Character Seeding

```python
class Character:
    id: str                  # char_1, char_2, etc.
    name: str
    faction_id: str
    role: str                # "leader", "merchant", "warrior", "scholar"
    age: int
    skills: Dict[str, int]   # skill_name → proficiency (0-100)
    relationships: Dict[str, int]  # char_id → sentiment (-100 to +100)
    inventory: List[str]     # Items currently held
    goals: List[Goal]        # Short/medium/long term objectives
```

**Family trees:**
```python
Character(
    id="char_5",
    name="Alice",
    mother_id="char_2",
    father_id="char_3",
    children_ids=["char_6", "char_7"],
    spouse_id="char_4"
)
```

Family relationships are **genetic invariants** (cannot be changed after seeding).

---

## 📅 Curriculum Wheel System

### Overview

The **curriculum wheel** is a deterministic progression system where:
- Time is divided into discrete **rotations**
- Each rotation has defined **stops**
- Each stop has **learning objectives** and **constraints**
- Progress is **linear** (no backward jumps) and **incremental** (one stop at a time)

### Wheel Structure

```
┌─────────────────────────┐
│   CURRICULUM WHEEL      │
├─────────────────────────┤
│ Rotation 1              │
│  ├─ Stop 1: Intro       │
│  ├─ Stop 2: Foundation  │
│  └─ Stop 3: Advanced    │
│                         │
│ Rotation 2              │
│  ├─ Stop 1: Synthesis   │
│  ├─ Stop 2: Application │
│  └─ Stop 3: Mastery     │
│                         │
│ Rotation N              │
│  ├─ Stop N-1            │
│  └─ Stop N (terminal)   │
└─────────────────────────┘
```

### API

**Path:** `unified_nexus/wheel_runtime.py`

```python
class WheelRuntime:
    def __init__(self, character_id: str, wheel_id: str):
        self.character_id = character_id
        self.rotation = 1      # Current rotation (1-indexed)
        self.stop_index = 0    # Index within rotation

    def get_current_stop(self) -> Stop:
        """Get current learning objective."""
        return self.wheel.rotations[self.rotation][self.stop_index]

    def advance_to_next_stop(self) -> bool:
        """Move to next stop. Returns False if at terminal stop."""
        if self.is_at_terminal_stop():
            return False
        self.stop_index += 1
        return True

    def advance_to_next_rotation(self) -> bool:
        """Jump to next rotation. Pre-validated by constraints."""
        if self.rotation >= self.wheel.total_rotations:
            return False
        self.rotation += 1
        self.stop_index = 0
        return True

    def is_at_terminal_stop(self) -> bool:
        """Check if character completed wheel."""
        return (
            self.rotation == self.wheel.total_rotations and
            self.stop_index == len(self.wheel.rotations[-1]) - 1
        )
```

### Stop Definition

```python
class Stop:
    id: str
    rotation: int
    index: int
    learning_objectives: List[str]
    skill_tests: Dict[str, int]         # skill → required_proficiency
    tool_access: List[str]              # Which tools available at this stop
    asset_unlocks: List[AssetId]        # New avatars/items/regions unlocked
    duration_min_seconds: int           # Cannot skip before this time

    def validate(self, character: Character) -> bool:
        """Check if character meets prerequisites."""
        for skill, required_prof in self.skill_tests.items():
            if character.skills.get(skill, 0) < required_prof:
                return False
        return True
```

### Guardian Invariants

The curriculum wheel enforces three **grade rail** constraints:

#### Invariant 1: Directory Order

```
1 ≤ rotation ≤ total_rotations
0 ≤ stop_index < len(rotation_stops)
```

✅ Cannot jump backward
✅ Cannot exceed terminal stop
✅ Monotonic progression only

#### Invariant 2: Duration Lock

```python
class DurationLock:
    """Cannot advance stop until minimum time has elapsed."""
    current_stop_entered_at: int  # Unix timestamp
    minimum_stop_duration_sec: int

    def can_advance(self) -> bool:
        elapsed = time.time() - self.current_stop_entered_at
        return elapsed >= self.minimum_stop_duration_sec
```

Prevents "rushing through" curriculum without engagement.

#### Invariant 3: Skill Validation

```python
def validate_stop_transition(
    current_char: Character,
    destination_stop: Stop
) -> ValidationResult:
    """Check if skill levels meet stop requirements."""
    for skill, required in destination_stop.skill_tests.items():
        current_level = current_char.skills.get(skill, 0)
        if current_level < required:
            return ValidationResult(
                valid=False,
                reason=f"Skill {skill} too low: {current_level}/{required}"
            )
    return ValidationResult(valid=True)
```

Ensures characters don't skip prerequisites.

---

## 🛡️ Guardian Invariants (Grade Rails)

### Defense in Depth

Five complementary constraint layers protect world coherence:

### Layer 1: Curriculum Guardian (Wheel Runtime)

**What it guards:**
- Stop progression order
- Rotation advancement
- Skill prerequisites

**Enforcement point:**
```python
# In wheel_runtime.py
def advance(self, target_rotation, target_stop):
    assert 1 <= target_rotation <= self.wheel.total_rotations
    assert 0 <= target_stop < len(self.wheel.rotations[target_rotation])
    assert target_rotation >= self.rotation  # No backward jump
```

**Violations trigger:**
```json
{
  "type": "constraint_violation",
  "constraint": "curriculum_order",
  "violation": "Attempted backward rotation (3 → 1)",
  "character": "char_5",
  "action": "REJECT"
}
```

### Layer 2: World Genesis Continuity

**What it guards:**
- Family tree immutability
- Factional consistency
- Region & resource coherence

**Key invariants:**
```python
# Census check: All living characters in exactly one faction
assert sum(char.faction_id for char in world.all_characters()) == world.population

# Genealogy check: Parents must be older than children
for char in world.all_characters():
    for child_id in char.children_ids:
        assert char.age > world.get_character(child_id).age

# Resource conservation: Total produced ≥ total consumed
for faction in world.all_factions():
    assert faction.production_total >= faction.consumption_total
```

**Enforcement:**
```python
genesis = WorldGenesis(seed=42)
world = genesis.generate()
assert world.validate_invariants()  # Must pass
```

### Layer 3: Physics Constraints

**What it guards:**
- Body bounds (no clipping)
- Movement validation
- Collision solving

**See:** `packages/physics-contract/src/constraints.ts`

### Layer 4: Representation Invariants

**What it guards:**
- Packet-level value bounds
- Batch statistical properties
- Direction/blame magnitude

**See:** `invariantPolicy.core.ts`

### Layer 5: Digital Twin Health

**What it guards:**
- Tool result validity
- Avatar compilation hashes
- State reconciliation

**See:** `unified_nexus/invariants.py`

---

## 👥 Character & Region Generation

### Character DNA

```typescript
interface CharacterDNA {
  // Genealogy
  parent_ids: [string, string];  // Mother, Father
  birth_rotation: number;
  birth_region_id: string;

  // Traits
  personality_archetype: string;  // "explorer", "sage", "caregiver"
  core_motivation: string;        // "knowledge", "power", "service"

  // Skills (0-100 proficiency)
  skills: {
    combat: number;
    diplomacy: number;
    crafting: number;
    farming: number;
  };

  // Relationships
  affinity_faction_id: string;    // Primary faction
  trusted_character_ids: string[];
  rival_character_ids: string[];

  // Network
  inventory_capacity: number;
  tool_access_level: number;      // 0 (guest) to 5 (admin)
}
```

### Region DNA

```typescript
interface RegionDNA {
  // Geography
  climate_type: "temperate" | "arid" | "tundra" | "tropical";
  elevation_seed: number;
  terrain_features: string[];  // "mountains", "rivers", "forests"

  // Resources
  primary_resources: string[];   // What grows here
  resource_abundance: number;    // (0-100) How much available

  // Infrastructure
  settlement_count: number;
  settlement_types: string[];    // "capital", "outpost", "trade_hub"

  // Governance
  governing_faction_id: string;
  dispute_level: number;          // (0-100) Contested territory?
}
```

### Generation Algorithm

```python
def generate_character(
    character_dna: CharacterDNA,
    world_state: World,
    seed: int
) -> Character:
    """Deterministic character instantiation."""

    rng = np.random.RandomState(
        hash_stable(character_dna, seed)
    )

    # Calculate derived attributes deterministically
    age = calculate_age(
        char_dna.birth_rotation,
        world_state.current_rotation
    )

    relationships = {
        parent_id: 100.0  # Kin have high affinity
        for parent_id in character_dna.parent_ids
    }

    # Initialize all other relationships from `affinity_faction_id`
    for other_char in world_state.characters:
        if other_char.faction_id == character_dna.affinity_faction_id:
            relationships[other_char.id] = 30.0  # Faction members are friendly
        else:
            relationships[other_char.id] = -10.0  # Outsiders neutral/hostile

    return Character(
        id=character_dna.id,
        name=generate_name(character_dna, rng),
        age=age,
        faction_id=character_dna.affinity_faction_id,
        skills=character_dna.skills,
        relationships=relationships,
        inventory=generate_starting_inventory(character_dna, rng)
    )
```

---

## 🔄 Continuity & Coherence

### Timeline Continuity

**Principle:** World history never contradicts itself.

```python
class Timeline:
    events: List[Event]           # Chronologically ordered

    def add_event(self, event: Event) -> bool:
        """Validate event against existing history."""
        # Event causality check: No effect before cause
        for prev_event in self.events:
            if event.depends_on(prev_event) and event.timestamp < prev_event.timestamp:
                return False  # Causality violation

        self.events.append(event)
        return True

    def get_world_state_at(self, rotation: int) -> World:
        """Reconstruct world state at any point in time."""
        # Apply all events up to rotation
        state = World()
        for event in self.events:
            if event.rotation <= rotation:
                state.apply_event(event)
        return state
```

### Character Continuity

**Principle:** Character state transitions must be logically coherent.

```python
class CharacterContinuity:
    """Validate state transitions."""

    def validate_transition(
        from_state: Character,
        to_state: Character,
        action: Action
    ) -> bool:
        # Skill values can only increase (no degradation)
        for skill in from_state.skills:
            if to_state.skills[skill] < from_state.skills[skill]:
                return False

        # Age always increases (time moves forward)
        if to_state.age < from_state.age:
            return False

        # Inventory mass conservation
        if sum(to_state.calculate_inventory_mass()) >\
           to_state.inventory_capacity:
            return False

        return True
```

### Relational Coherence

**Principle:** Social relationships respect genealogy and history.

```python
def validate_relationship_state(
    char1: Character,
    char2: Character,
    world: World
) -> bool:
    """Check if relationship is logical given world state."""

    # Parent-child relationships are immutable
    if char1.is_parent_of(char2):
        assert world.get_relationship(char1, char2) >= 50
        return True

    # Enemies cannot be allies
    if world.get_relationship(char1, char2) < -50:
        assert not char1.allied_with(char2)

    # Trust requires interaction history
    if world.get_relationship(char1, char2) > 75:
        interactions = world.get_interactions_between(char1, char2)
        assert len(interactions) > 0

    return True
```

---

## 🔌 API & Integration

### World Genesis API

```python
# Create deterministic world
from unified_nexus.world_genesis import WorldGenesis

genesis = WorldGenesis(seed=42)
world = genesis.generate()

# Access world components
regions = world.get_all_regions()
factions = world.get_all_factions()
characters = world.get_all_characters()

# Validate invariants
assert world.validate_invariants()
```

### Curriculum Wheel API

```python
from unified_nexus.wheel_runtime import WheelRuntime, Wheel

# Load curriculum wheel
wheel = Wheel.load("curriculum_v2.json")

# Create runtime for character
runtime = WheelRuntime(
    character_id="char_5",
    wheel=wheel
)

# Check current progress
current_stop = runtime.get_current_stop()
print(f"Learning: {current_stop.learning_objectives}")

# Advance through curriculum
if runtime.advance_to_next_stop():
    print("Progressed to next stop")
else:
    print("Already at terminal stop")
```

### Constraint Validation

**In Nucleus:**

```typescript
// Tool execution with constraint pre-validation
import { CurriculumConstraintStore } from "./constraints/CurriculumConstraintStore";

const constraints = new CurriculumConstraintStore(world);

// Pre-validate tool call
const validation = await constraints.validate({
  character_id: "char_5",
  action: "advance_rotation",
  target_rotation: 3,
  target_stop_index: 1
});

if (!validation.valid) {
  return {
    status: "forbidden",
    reason: validation.reason  // e.g., "Rotation bounds exceeded"
  };
}

// Safe to dispatch to agent
await toolExecutor.execute(toolCall);
```

### Ledger Integration

**All world changes recorded:**

```json
{
  "type": "character.advanced",
  "timestamp": "2026-01-15T10:30:00Z",
  "character_id": "char_5",
  "from_rotation": 2,
  "to_rotation": 3,
  "from_stop_index": 2,
  "to_stop_index": 0,
  "triggered_by": "user_approval",
  "approval_id": "a-12345"
}
```

Every progression is **auditable and reversible** (via ledger replay).

---

## 📚 Examples

### Example 1: Seeding a World

```python
import json
from unified_nexus.world_genesis import WorldGenesis

# Create genesis engine
genesis = WorldGenesis(seed=42)

# Generate world
world = genesis.generate()

# Export world state
world_state = {
    "seed": 42,
    "regions": [
        {
            "id": region.id,
            "name": region.name,
            "climate": region.climate,
            "resources": region.resources
        }
        for region in world.get_all_regions()
    ],
    "factions": [...],
    "characters": [...]
}

with open("world_state.json", "w") as f:
    json.dump(world_state, f, indent=2)

# Validate
assert world.validate_invariants()
print("✅ World seed successful")
```

### Example 2: Character Progression

```python
from unified_nexus.wheel_runtime import WheelRuntime

# Load world
world = load_world("world_state.json")
char = world.get_character("char_5")

# Create curriculum runtime
wheel = Wheel.load("curriculum.json")
runtime = WheelRuntime(char.id, wheel)

print(f"Current: Rotation {runtime.rotation}, Stop {runtime.stop_index}")

# Validate advancement
can_advance = runtime.wheel.validate_stop_transition(
    char,
    runtime.wheel.get_next_stop(runtime.rotation, runtime.stop_index)
)

if can_advance:
    runtime.advance_to_next_stop()
    print(f"✅ Advanced to: {runtime.get_current_stop().learning_objectives}")
else:
    print("❌ Cannot advance: Missing skill prerequisites")
```

### Example 3: Constraint Validation

```typescript
import { CurriculumConstraintStore } from "@world-engine/nucleus/constraints";

const constraints = new CurriculumConstraintStore(world);

// Check rotation bounds
const result1 = constraints.validateRotationBounds(
  character_id: "char_5",
  target_rotation: 3
);
// → { valid: true }

// Check stop index bounds
const result2 = constraints.validateStopIndexBounds(
  character_id: "char_5",
  target_stop_index: 999  // Out of bounds
);
// → { valid: false, reason: "Stop index (999) exceeds rotation size (4)" }

// Check version matching
const result3 = constraints.validateVersionMatching(
  character_id: "char_5",
  curriculum_version: "2.0.1"
);
// → { valid: true }
```

### Example 4: Deterministic Replication

```python
# Server generates world
genesis1 = WorldGenesis(seed=42)
world1 = genesis1.generate()
hash1 = world1.compute_hash()  # SHA256

# Client replicates world independently
genesis2 = WorldGenesis(seed=42)
world2 = genesis2.generate()
hash2 = world2.compute_hash()

# Hashes must match
assert hash1 == hash2  # ✅ World is deterministic
```

---

## 🧪 Testing Agriculture Systems

### Determinism Tests

```bash
# Test world genesis reproducibility
pnpm test:genesis:determinism

# Test curriculum progression
pnpm test:curriculum:invariants

# Test character generation
pnpm test:character:generation
```

### Validation Tests

```bash
# Test constraint enforcement
pnpm test:constraints:validation

# Test timeline coherence
pnpm test:timeline:coherence

# Test relationship consistency
pnpm test:relationships:invariants
```

---

## 🐛 Common Issues

### World Genesis Non-Deterministic

**Problem:** Different seeds produce same world

**Solution:** Check RNG seeding
```python
# ❌ Bad: Uses wall clock
rng = np.random.RandomState()

# ✅ Good: Uses provided seed
rng = np.random.RandomState(hash_stable(dna, seed))
```

### Curriculum Advancement Fails

**Problem:** Character can't advance even though seems ready

**Solution:** Check skill prerequisites
```python
runtime = WheelRuntime(char.id, wheel)
next_stop = runtime.wheel.get_next_stop(...)

# Debug required skills
for skill, required in next_stop.skill_tests.items():
    current = char.skills.get(skill, 0)
    print(f"{skill}: {current}/{required}")
```

### Constraint Violation on Valid Action

**Problem:** Action rejected by constraint system

**Solution:** Check all five layers
```
1. Curriculum order (bounds check)
2. Genesis continuity (genealogy)
3. Physics (body bounds)
4. Representation (packet values)
5. Digital twin (hash format)
```

---

## 📊 Architecture Summary

```
World Genesis
    ↓
World Seeded with Initial State
    ↓
Curriculum Wheel Runtime Initialized
    ↓
Character progression via Stop advancement
    ↓
Guardian Invariants validate each transition
    ↓
Ledger records all decisions
    ↓
World State remains coherent across timeline
```

---

## 🔗 Related Documentation

| Document | Purpose |
|----------|---------|
| [README.md](README.md) | Main project overview |
| [CURRICULUM_WHEEL.md](CURRICULUM_WHEEL.md) | Detailed wheel design |
| [CONSTRAINTS.md](CONSTRAINTS.md) | Constraint system reference |
| [WORLD_GENESIS.md](WORLD_GENESIS.md) | Genesis algorithm deep-dive |

---

**World Cultivation v2.0** — Coherent • Deterministic • Constrained
©️ 2026 Proprietary Software
