/**
 * Agent Controller
 *
 * Uses neural network to decide actions for game entities.
 * Interfaces between the brain and the game engine.
 */
/**
 * Agent controller: operates the neural network brain
 */
export class AgentBrain {
    agentId;
    network;
    goals;
    maxSensors = 4; // Max nearby entities to sense
    state;
    decisionCache = null;
    lastDecisionTime = 0;
    decisionInterval = 100; // ms between decisions (for performance)
    constructor(agentId, network, goals = []) {
        this.agentId = agentId;
        this.network = network;
        this.goals = goals || [{ type: "survive", weight: 1.0 }];
        this.state = {
            id: agentId,
            sensors: {
                position: { x: 0, y: 0, z: 0 },
                velocity: { x: 0, y: 0, z: 0 },
                nearbyEntitiesDistance: Array(this.maxSensors).fill(1),
                nearbyEntitiesHealth: Array(this.maxSensors).fill(0.5),
                health: 1,
                energy: 1,
                facing: 0.5,
                groundHeight: 0,
                temperature: 0.5,
                lightLevel: 0.5,
            },
            actions: {
                moveForward: 0,
                moveSideways: 0,
                moveVertical: 0,
                turn: 0,
                sprint: 0,
                crouch: 0,
                attack: 0,
                defend: 0,
                interact: 0,
            },
            health: 100,
            energy: 100,
            score: 0,
            timeAlive: 0,
            distanceTraveled: 0,
        };
    }
    /**
     * Update sensors from game state
     */
    updateSensors(sensors) {
        this.state.sensors = { ...this.state.sensors, ...sensors };
    }
    /**
     * Run one decision cycle: convert sensors → actions
     * Caches decisions to reduce computation
     */
    decide(forceRecompute = false) {
        const now = Date.now();
        if (!forceRecompute && this.decisionCache && now - this.lastDecisionTime < this.decisionInterval) {
            return this.decisionCache;
        }
        const inputs = this.sensorsToInputs();
        const outputs = this.network.forward(inputs);
        const actions = this.outputsToActions(outputs);
        this.state.actions = actions;
        this.decisionCache = actions;
        this.lastDecisionTime = now;
        return actions;
    }
    /**
     * Convert sensor data to neural network input vector
     */
    sensorsToInputs() {
        const s = this.state.sensors;
        return [
            // Position (relative, normalized)
            Math.min(Math.abs(s.position.x) / 100, 1),
            Math.min(Math.abs(s.position.y) / 100, 1),
            Math.min(Math.abs(s.position.z) / 50, 1),
            // Velocity
            Math.min(Math.abs(s.velocity.x) / 50, 1),
            Math.min(Math.abs(s.velocity.y) / 50, 1),
            Math.min(Math.abs(s.velocity.z) / 50, 1),
            // Nearby threats/allies (distance + health)
            ...s.nearbyEntitiesDistance.slice(0, this.maxSensors),
            ...s.nearbyEntitiesHealth.slice(0, this.maxSensors),
            // Self state
            s.health,
            s.energy,
            s.facing,
            // Environment
            s.groundHeight,
            s.temperature,
            s.lightLevel,
        ];
    }
    /**
     * Convert neural network outputs to actions (0-1 values)
     */
    outputsToActions(outputs) {
        const actions = {
            moveForward: outputs[0] ?? 0,
            moveSideways: outputs[1] ? outputs[1] * 2 - 1 : 0, // -1 to 1
            moveVertical: outputs[2] ? outputs[2] * 2 - 1 : 0,
            turn: outputs[3] ? outputs[3] * 2 - 1 : 0,
            sprint: outputs[4] ?? 0,
            crouch: outputs[5] ?? 0,
            attack: outputs[6] ?? 0,
            defend: outputs[7] ?? 0,
            interact: outputs[8] ?? 0,
        };
        return actions;
    }
    /**
     * Calculate reward based on goals
     * Higher is better
     */
    calculateReward() {
        let totalReward = 0;
        for (const goal of this.goals) {
            let goalReward = 0;
            switch (goal.type) {
                case "survive":
                    // Reward staying alive, penalize low health
                    goalReward = this.state.health > 0 ? 1 : -10;
                    break;
                case "explore":
                    // Reward movement and distance traveled
                    goalReward = Math.min(this.state.distanceTraveled / 1000, 1);
                    break;
                case "collect":
                    // Reward score (assume game increments this)
                    goalReward = this.state.score / 100;
                    break;
                case "avoid":
                    // Reward high energy (avoid obstacles = less damage)
                    goalReward = this.state.energy / 100;
                    break;
                case "chase":
                    // Custom: assume reward fn is provided
                    if (goal.reward) {
                        goalReward = goal.reward(this.state);
                    }
                    break;
            }
            totalReward += goalReward * goal.weight;
        }
        return totalReward;
    }
    /**
     * Update internal state (called each game tick)
     */
    tick(deltaTime) {
        this.state.timeAlive += deltaTime;
        this.state.score += (this.state.actions.attack * 10); // Example: score from attacking
    }
}
