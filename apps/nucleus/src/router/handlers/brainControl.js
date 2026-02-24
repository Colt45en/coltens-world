/**
 * Brain Control Handler
 *
 * Executes brain_control UEE tasks:
 * - Takes game state (sensors)
 * - Runs through neural network brain
 * - Returns control actions for game entity
 */
import { AgentBrain, createDefaultAgentNetwork, NeuralNetwork } from "@world-engine/brain";
import { narrowByTaskType } from "@world-engine/protocol";
// Global agent registry: agentId -> brain
const agentRegistry = new Map();
function isSerializedNetwork(value) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return false;
    const candidate = value;
    return (typeof candidate.inputSize === "number" &&
        Array.isArray(candidate.hiddenSizes) &&
        typeof candidate.outputSize === "number" &&
        Array.isArray(candidate.layers) &&
        Array.isArray(candidate.biases));
}
function resolveNetwork(network) {
    if (network instanceof NeuralNetwork)
        return network;
    if (isSerializedNetwork(network)) {
        try {
            return NeuralNetwork.fromJSON(network);
        }
        catch {
        }
    }
    return createDefaultAgentNetwork();
}
/**
 * Get or create an agent brain
 */
export function getOrCreateAgent(agentId, network) {
    if (!agentRegistry.has(agentId)) {
        const brain = new AgentBrain(agentId, resolveNetwork(network), [{ type: "survive", weight: 1 }]);
        agentRegistry.set(agentId, brain);
    }
    return agentRegistry.get(agentId);
}
/**
 * Remove agent brain
 */
export function removeAgent(agentId) {
    agentRegistry.delete(agentId);
}
/**
 * List all active agents
 */
export function listAgents() {
    return Array.from(agentRegistry.keys());
}
/**
 * Handle brain_control task: agent perception → decision
 */
export async function handleBrainControl(envelope, context) {
    if (!narrowByTaskType(envelope, "brain_control")) {
        return {
            ok: false,
            taskId: context.taskId,
            taskType: context.taskType,
            errors: ["Expected brain_control task type"],
        };
    }
    const brain_control = envelope.inputs.brain_control;
    if (!brain_control?.agentId) {
        return {
            ok: false,
            taskId: context.taskId,
            taskType: context.taskType,
            errors: ["Missing required field: agentId"],
        };
    }
    try {
        // Get or create agent
        const agent = getOrCreateAgent(brain_control.agentId, brain_control.network);
        // Update sensors from input
        if (brain_control.sensors) {
            agent.updateSensors(brain_control.sensors);
        }
        // Update goals if provided
        if (brain_control.goals && Array.isArray(brain_control.goals) && brain_control.goals.length > 0) {
            agent.goals.splice(0, agent.goals.length, ...brain_control.goals);
        }
        // Run decision cycle
        const actions = agent.decide();
        // Calculate reward for logging
        const reward = agent.calculateReward();
        // Build response
        return {
            ok: true,
            taskId: context.taskId,
            taskType: context.taskType,
            outputs: {
                brain_control: {
                    actions,
                    reward,
                    agentState: {
                        id: agent.state.id,
                        health: agent.state.health,
                        energy: agent.state.energy,
                        score: agent.state.score,
                        timeAlive: agent.state.timeAlive,
                    },
                },
            },
            audit: {
                decision_made: true,
                sensor_count: brain_control.sensors ? Object.keys(brain_control.sensors).length : 0,
                goals_count: brain_control.goals?.length || 0,
                reward_value: reward,
            },
        };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            ok: false,
            taskId: context.taskId,
            taskType: context.taskType,
            errors: [`Brain control failed: ${message}`],
        };
    }
}
export default handleBrainControl;
