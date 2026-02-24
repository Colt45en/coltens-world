# World Engine Brain System

## Overview

The **World Engine Brain** (`@we/brain`) is a neural network-based AI system for controlling game entities and learning behaviors through genetic algorithms. It acts as the computational "brain" that drives agent decision-making in the game environment.

**Key Features:**

- ✅ Feedforward neural networks with sigmoid activation
- ✅ Genetic algorithm evolution (mutation, crossover, selection)
- ✅ Game-integrated agent controller (sensors → brain → actions)
- ✅ Multiple optimization targets (survive, explore, collect, navigate)
- ✅ UEE-1 protocol integration for seamless task dispatch

## Architecture

### 1. **Neural Network** (`NeuralNetwork`)

Feedforward topology with configurable layers.

```typescript
const network = new NeuralNetwork(
  2, // input size (e.g., 2 sensors)
  [4], // hidden layer sizes (e.g., 1 hidden layer with 4 neurons)
  1, // output size (e.g., 1 action)
);

const output = network.forward([0.5, 0.3]); // Returns activation
```

**Activation:** Sigmoid (bounds outputs to 0-1)
**Weights:** Random initialization [-1, 1]

### 2. **Population & Evolution** (`Population`)

Genetic algorithm for optimizing populations toward fitness.

```typescript
const config = {
  populationSize: 100,
  mutationRate: 0.1,
  mutationStrength: 0.5,
  elitism: 5,
  selectionPressure: "top50" as const,
};

const population = new Population(config, inputSize, hiddenSizes, outputSize);

// Evaluate all agents
await population.evaluate(async (network) => {
  // Return fitness score (higher = better)
  return calculateFitness(network);
});

// Evolve to next generation
population.evolve(); // Breeding + mutation
```

**Selection Strategies:**

- `"top50"` — Top 50% become breeding pool
- `"roulette"` — Fitness-proportionate selection
- `"tournament"` — Pairwise tournament selection

### 3. **Agent Controller** (`AgentBrain`)

Connects neural network to game entity.

```typescript
const brain = new AgentBrain("agent-1", network, [{ type: "survive", weight: 1.0 }]);

// Update sensory inputs
brain.updateSensors({
  position: { x: 10, y: 5, z: 0 },
  health: 0.8,
  energy: 0.6,
  nearbyEntitiesDistance: [0.2, 0.5, 0.9, 1.0],
});

// Get action decisions
const actions = brain.decide();
// {
//   moveForward: 0.7,
//   turn: 0.2,
//   attack: 0.5,
//   ...
// }

// Update internal state each frame
brain.tick(deltaTime);

// Calculate reward
const reward = brain.calculateReward();
```

## Integration with World Engine

### UEE Task Types

The brain system exposes two new UEE task types:

#### **1. `brain_control`** — Real-time Decision Making

Send current game state, receive agent actions.

```typescript
const envelope = {
  contract: { type: "UnifiedEngineEnvelope", version: "1.0.0" },
  task: { type: "brain_control", id: "decision-1", mode: "generate" },
  inputs: {
    brain_control: {
      agentId: "player-1",
      sensors: {
        position: { x: 10, y: 5, z: 0 },
        velocity: { x: 1, y: 0, z: 0 },
        health: 0.8,
        energy: 0.6,
        nearbyEntitiesDistance: [0.2, 0.5, 0.9, 1.0],
        nearbyEntitiesHealth: [0.3, 0.7, 1.0, 0.1],
      },
      goals: [
        { type: "survive", weight: 1.0 },
        { type: "explore", weight: 0.5 },
      ],
    },
  },
  controls: {
    return: {
      include_prose: false,
      include_json: true,
      include_audit: true,
      include_state_delta: false,
    },
  },
};

// Send to Nucleus
const response = await router.route(envelope, sessionId);

// Response:
// {
//   ok: true,
//   taskId: "decision-1",
//   outputs: {
//     brain_control: {
//       actions: {
//         moveForward: 0.7,
//         turn: 0.2,
//         attack: 0.5,
//         ...
//       },
//       reward: 2.5,
//       agentState: {...}
//     }
//   },
//   audit: { decision_made: true, reward_value: 2.5, ... }
// }
```

#### **2. `brain_train`** — Offline Training/Evolution

Train population over multiple generations.

```typescript
const trainingEnvelope = {
  contract: { type: "UnifiedEngineEnvelope", version: "1.0.0" },
  task: { type: "brain_train", id: "training-1", mode: "generate" },
  inputs: {
    brain_train: {
      populationSize: 100,
      generations: 50,
      fitnessFunction: "survive", // or "collect", "navigate", "explore"
      mutationRate: 0.1,
      mutationStrength: 0.5,
      elitism: 5,
    },
  },
};

const response = await router.route(trainingEnvelope, sessionId);

// Response:
// {
//   ok: true,
//   outputs: {
//     brain_train: {
//       populationId: "pop-training-1",
//       generation: 50,
//       bestFitness: 3.95,
//       bestNetwork: { /* JSON weights */ },
//       populationStats: {
//         size: 100,
//         avgFitness: 2.3,
//         maxFitness: 3.95,
//         minFitness: 0.5,
//       },
//       fitnessHistory: [0.5, 0.8, 1.2, ...],
//       solved: true,
//     }
//   },
//   audit: {
//     generations_run: 50,
//     fitness_function: "survive",
//     convergence: 0.9875,
//     duration_ms: 5420,
//   }
// }
```

## Sensor-Action Mapping

### Sensors (Inputs)

The brain perceives the game state through 16+ normalized inputs:

```typescript
[
  // Position (relative, 0-1 normalized)
  position.x / 100,
  position.y / 100,
  position.z / 50,

  // Velocity
  Math.abs(velocity.x) / 50,
  Math.abs(velocity.y) / 50,
  Math.abs(velocity.z) / 50,

  // Nearby entities (distance + health)
  entity0_distance, // 0-1
  entity1_distance, // 0-1
  entity2_distance, // 0-1
  entity3_distance, // 0-1
  entity0_health, // 0-1
  entity1_health, // 0-1
  entity2_health, // 0-1
  entity3_health, // 0-1

  // Self state
  health, // 0-1
  energy, // 0-1
  facing, // 0-1 (normalized angle)
  groundHeight, // 0-1
  temperature, // 0-1
  lightLevel, // 0-1
];
```

Total: **20 input neurons** by default

### Actions (Outputs)

The brain produces 9 control outputs (sigmoid-activated, 0-1):

```typescript
{
  moveForward: 0.7,    // Throttle forward
  moveSideways: -0.3,  // Strafe left (-1 to 1)
  moveVertical: 0.2,   // Jump/crouch (-1 to 1)
  turn: 0.5,           // Rotation (-1 to 1)
  sprint: 0.8,         // Boost
  crouch: 0.1,         // Lower profile
  attack: 0.6,         // Action/attack strength
  defend: 0.3,         // Defensive stance
  interact: 0.0,       // Use/grab objects
}
```

## Training Workflow

### Step 1: Define Fitness Function

What should agents optimize for?

```typescript
// Option A: Use built-in fitness functions
const fitnessType = "survive"; // or "explore", "collect", "navigate"

// Option B: Custom fitness in handler
// (See brainTrain.ts for example implementation)
```

### Step 2: Run Evolution Loop

```typescript
const trainingConfig = {
  populationSize: 100,
  generations: 100,
  fitnessFunction: "survive",
  mutationRate: 0.1, // 10% of weights mutate per generation
  mutationStrength: 0.5, // Gaussian(0, 0.5) noise magnitude
  elitism: 5, // Keep top 5 unchanged
};

// Send brain_train task to Nucleus
const response = await router.route(
  {
    contract: { type: "UnifiedEngineEnvelope", version: "1.0.0" },
    task: { type: "brain_train", id: "train-1", mode: "generate" },
    inputs: { brain_train: trainingConfig },
  },
  sessionId,
);

if (response.ok && response.outputs?.brain_train?.solved) {
  console.log("Training converged!");
  bestNetwork = response.outputs.brain_train.bestNetwork;
}
```

### Step 3: Deploy Best Agent

```typescript
// Instantiate best network
const network = NeuralNetwork.fromJSON(bestNetwork);

// Create agent controller
const agent = new AgentBrain("hero", network, [
  { type: "survive", weight: 1.0 },
  { type: "explore", weight: 0.3 },
]);

// Now use brain_control in game loop
```

## Example: Training XOR

```typescript
// Create population
const config: EvolutionConfig = {
  populationSize: 100,
  mutationRate: 0.1,
  mutationStrength: 0.5,
  elitism: 5,
  selectionPressure: "top50",
};

const pop = new Population(config, 2, [4], 1); // 2 inputs, 4 hidden, 1 output

// XOR fitness function
const xorFitness = (network: NeuralNetwork): number => {
  const data = [
    { inputs: [0, 0], expected: 0 },
    { inputs: [0, 1], expected: 1 },
    { inputs: [1, 0], expected: 1 },
    { inputs: [1, 1], expected: 0 },
  ];

  let score = 0;
  for (const { inputs, expected } of data) {
    const output = network.forward(inputs)[0];
    const error = Math.abs(expected - output);
    score += Math.pow(1 - error, 2); // Range: 0-4
  }
  return score;
};

// Train
for (let gen = 0; gen < 100; gen++) {
  // Evaluate
  for (const agent of pop.agents) {
    agent.network.fitness = xorFitness(agent.network);
  }

  // Check convergence
  pop.agents.sort((a, b) => b.network.fitness - a.network.fitness);
  console.log(`Gen ${gen}: Best fitness = ${pop.agents[0].network.fitness}`);

  if (pop.agents[0].network.fitness > 3.95) {
    console.log("XOR solved!");
    break;
  }

  // Evolve
  pop.evolve();
}

// Test solution
const best = pop.agents[0];
console.log(best.network.forward([0, 0])); // ~0
console.log(best.network.forward([0, 1])); // ~1
console.log(best.network.forward([1, 0])); // ~1
console.log(best.network.forward([1, 1])); // ~0
```

## Integration with Preview Runtime

### Rendering Brain Activity

Display neural network state in real-time:

```typescript
// BrainVisualizer component (React)
function BrainViz({ brain }) {
  // Show:
  // - Node activations (brightness)
  // - Connection weights (thickness + color)
  // - Action outputs (highlights)
  // - Fitness history (bar chart)
}
```

### Applying Brain Actions

```typescript
// In preview runtime
async function gameTick() {
  // 1. Get current game state
  const state = engine.getWorldState();

  // 2. Send to brain_control
  const response = await bus.request("nucleus", "uee.route", {
    type: "brain_control",
    agentId: "player",
    sensors: state.sensors,
  });

  // 3. Apply actions
  if (response.ok) {
    const { actions } = response.outputs.brain_control;

    entity.velocity.x += actions.moveForward * 10;
    entity.rotation += actions.turn * 0.05;
    entity.health -= actions.attack * 2;

    if (actions.sprint > 0.5) {
      entity.speed *= 1.5;
    }
  }

  // 4. Update rewards for training
  currentReward += calculateReward(entity);
}
```

## Best Practices

✅ **DO:**

- Start with small populations (50-100) for testing
- Use XOR/simple tasks for validation before complex fitness
- Save best networks as JSON for later deployment
- Monitor convergence with fitness history
- Use top50 selection for stable evolution
- Clamp input values to [0, 1] range
- Test with multiple random seeds

❌ **DON'T:**

- Use very high mutation rates (>0.5) → chaos
- Train with population size < 20 → poor diversity
- Forget to normalize sensor inputs (scale to 0-1)
- Expect convergence in < 10 generations
- Use networks with 0 hidden layers (XOR needs >0)
- Ignore fitness plateau (early stopping helps)

## Performance Considerations

| Population | Hidden Layer | Gens/sec | Memory |
| ---------- | ------------ | -------- | ------ |
| 50         | [4]          | ~500     | ~2 MB  |
| 100        | [8, 4]       | ~100     | ~8 MB  |
| 200        | [16, 8]      | ~20      | ~25 MB |

**Optimization Tips:**

- Cache decisions (100ms decision interval by default)
- Batch evaluate populations on worker threads
- Prune old training sessions (>1 hour old)
- Use sparse sensor inputs when possible

## Troubleshooting

**Problem:** Population fitness plateaus early

- **Solution:** Increase population size or mutation strength

**Problem:** Network diverges (fitness decreases)

- **Solution:** Lower mutation rate or use elitism > 5

**Problem:** Training too slow

- **Solution:** Reduce population size or hidden layer sizes

**Problem:** Agent seems to ignore goals

- **Solution:** Verify sensors are being updated, check sensor normalization

## See Also

- [UEE Quick Reference](./UEE_QUICK_REFERENCE.md) — Protocol overview
- [UEE Integration Guide](./UEE_INTEGRATION.md) — Full integration patterns
- `packages/brain/src/` — Source code
- `apps/nucleus/src/router/handlers/brainControl.ts` — Handler implementation
- `apps/nucleus/src/router/handlers/brainTrain.ts` — Training handler
