/**
 * Brain Training Handler
 *
 * Executes brain_train UEE tasks:
 * - Evolve population of neural networks
 * - Optimize for specified fitness function
 * - Return best agents + statistics
 */
import { Population } from "@world-engine/brain";
import { narrowByTaskType } from "@world-engine/protocol";
// Global training sessions: sessionId -> TrainingState
const trainingSessions = new Map();
/**
 * XOR Task: Can network learn XOR logic?
 * Used as default fitness function for testing
 */
function xorFitness(network) {
    const data = [
        { inputs: [0, 0], expected: 0 },
        { inputs: [0, 1], expected: 1 },
        { inputs: [1, 0], expected: 1 },
        { inputs: [1, 1], expected: 0 },
    ];
    let score = 0;
    for (const { inputs, expected } of data) {
        const output = network.forward(inputs)[0] ?? 0;
        const error = Math.abs(expected - output);
        score += Math.pow(1 - error, 2);
    }
    return score; // 0-4 scale
}
/**
 * Fitness function factory
 */
function createFitnessFunction(taskType) {
    switch (taskType) {
        case "survive":
            // Agent that avoids damage and maintains health
            return async (network) => {
                const inputs = [
                    Math.random(), // health
                    Math.random(), // nearby_threat_distance
                    Math.random(), // energy
                ];
                const outputs = network.forward(inputs);
                const defensiveness = outputs?.[0] ?? 0; // 0-1
                return defensiveness > 0.5 ? 1 : 0; // Survive if defensive
            };
        case "navigate":
            // Agent that reaches targets efficiently
            return async (network) => {
                let score = 0;
                for (let i = 0; i < 5; i++) {
                    const inputs = [Math.random(), Math.random(), Math.random()]; // pos, target, obstacles
                    const outputs = network.forward(inputs);
                    const moveQuality = 1 - Math.abs((outputs?.[0] ?? 0) - 0.7); // Prefer moderate speed
                    score += moveQuality;
                }
                return score / 5;
            };
        case "collect":
            // Agent that gathers resources
            return async (network) => {
                let score = 0;
                for (let i = 0; i < 5; i++) {
                    const inputs = [Math.random(), Math.random()]; // resource_distance, carrying_capacity
                    const outputs = network.forward(inputs);
                    const collectDecision = outputs?.[0] ?? 0; // 0-1
                    if (collectDecision > 0.5)
                        score++;
                }
                return score;
            };
        case "explore":
            // Agent that discovers the map
            return async (network) => {
                let score = 0;
                for (let i = 0; i < 5; i++) {
                    const inputs = [Math.random(), Math.random()]; // unexplored_ratio, risk_level
                    const outputs = network.forward(inputs);
                    const exploreDrive = outputs?.[0] ?? 0;
                    score += exploreDrive;
                }
                return score / 5;
            };
        default:
            // Default to XOR
            return async (network) => xorFitness(network);
    }
}
function parsePositiveInt(value) {
    if (typeof value !== "number" || !Number.isFinite(value))
        return undefined;
    const n = Math.floor(value);
    return n > 0 ? n : undefined;
}
function parseHiddenSizes(value) {
    if (!Array.isArray(value))
        return undefined;
    const parsed = value.map(parsePositiveInt).filter((n) => typeof n === "number");
    return parsed.length > 0 ? parsed : undefined;
}
function defaultTrainingTopology(fitnessType) {
    switch (fitnessType) {
        case "survive":
        case "navigate":
            return { inputSize: 3, hiddenSizes: [6, 4], outputSize: 1, maxFitness: 1, successThreshold: 0.98 };
        case "collect":
            return { inputSize: 2, hiddenSizes: [4], outputSize: 1, maxFitness: 5, successThreshold: 4.7 };
        case "explore":
            return { inputSize: 2, hiddenSizes: [4], outputSize: 1, maxFitness: 1, successThreshold: 0.98 };
        case "xor":
        default:
            return { inputSize: 2, hiddenSizes: [4], outputSize: 1, maxFitness: 4, successThreshold: 3.95 };
    }
}
function resolveTrainingTopology(fitnessType, brainTrainInput) {
    const base = defaultTrainingTopology(fitnessType);
    return {
        ...base,
        inputSize: parsePositiveInt(brainTrainInput.inputSize) ?? base.inputSize,
        hiddenSizes: parseHiddenSizes(brainTrainInput.hiddenSizes) ?? base.hiddenSizes,
        outputSize: parsePositiveInt(brainTrainInput.outputSize) ?? base.outputSize,
        maxFitness: typeof brainTrainInput.maxFitness === "number" && Number.isFinite(brainTrainInput.maxFitness)
            ? brainTrainInput.maxFitness
            : base.maxFitness,
        successThreshold: typeof brainTrainInput.successThreshold === "number" && Number.isFinite(brainTrainInput.successThreshold)
            ? brainTrainInput.successThreshold
            : base.successThreshold,
    };
}
function sameTopology(a, b) {
    if (a.inputSize !== b.inputSize || a.outputSize !== b.outputSize)
        return false;
    if (a.hiddenSizes.length !== b.hiddenSizes.length)
        return false;
    for (let i = 0; i < a.hiddenSizes.length; i++) {
        if (a.hiddenSizes[i] !== b.hiddenSizes[i])
            return false;
    }
    return true;
}
/**
 * Handle brain_train task: run genetic algorithm on population
 */
export async function handleBrainTrain(envelope, context) {
    if (!narrowByTaskType(envelope, "brain_train")) {
        return {
            ok: false,
            taskId: context.taskId,
            taskType: context.taskType,
            errors: ["Expected brain_train task type"],
        };
    }
    const { brain_train } = envelope.inputs;
    if (!brain_train) {
        return {
            ok: false,
            taskId: context.taskId,
            taskType: context.taskType,
            errors: ["Missing brain_train inputs"],
        };
    }
    try {
        const config = {
            populationSize: brain_train.populationSize || 100,
            mutationRate: brain_train.mutationRate || 0.1,
            mutationStrength: brain_train.mutationStrength || 0.5,
            elitism: brain_train.elitism || 5,
            selectionPressure: "top50",
        };
        const generations = Number(brain_train.generations ?? 10) || 10;
        const fitnessType = typeof brain_train.fitnessFunction === "string" ? brain_train.fitnessFunction : "survive";
        const topology = resolveTrainingTopology(fitnessType, brain_train);
        // Create or resume population
        const populationId = `pop-${context.taskId}`;
        let state = trainingSessions.get(context.sessionId);
        const shouldResetPopulation = !state || state.fitnessType !== fitnessType || !sameTopology(state.topology, topology);
        if (shouldResetPopulation) {
            const population = new Population(config, topology.inputSize, topology.hiddenSizes, topology.outputSize);
            state = {
                populationId,
                population,
                startedAt: Date.now(),
                lastCheckpoint: Date.now(),
                fitnessType,
                topology,
            };
            trainingSessions.set(context.sessionId, state);
        }
        const { population } = state;
        const fitnessFn = createFitnessFunction(fitnessType);
        // Run evolution for N generations
        for (let gen = 0; gen < generations; gen++) {
            await population.evaluate(fitnessFn);
            if (population.bestFitness >= topology.successThreshold) {
                // Early stop (good enough)
                break;
            }
            population.evolve();
            state.lastCheckpoint = Date.now();
        }
        // Final evaluation
        await population.evaluate(fitnessFn);
        const best = population.bestAgent;
        if (!best) {
            throw new Error("No best agent found");
        }
        // Package results
        return {
            ok: true,
            taskId: context.taskId,
            taskType: context.taskType,
            outputs: {
                brain_train: {
                    populationId,
                    generation: population.generation,
                    fitnessType,
                    bestFitness: population.bestFitness,
                    bestNetwork: best.network.toJSON(),
                    populationStats: {
                        size: population.agents.length,
                        avgFitness: population.agents.reduce((sum, a) => sum + a.network.fitness, 0) / population.agents.length,
                        maxFitness: population.bestFitness,
                        minFitness: Math.min(...population.agents.map((a) => a.network.fitness)),
                    },
                    fitnessHistory: population.fitnessHistory.slice(-20), // Last 20 generations
                    solved: population.bestFitness >= topology.successThreshold,
                    topology,
                },
            },
            audit: {
                generations_run: population.generation,
                fitness_function: fitnessType,
                convergence: topology.maxFitness > 0 ? population.bestFitness / topology.maxFitness : 0,
                duration_ms: Date.now() - state.startedAt,
                topology_reset: shouldResetPopulation,
            },
        };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            ok: false,
            taskId: context.taskId,
            taskType: context.taskType,
            errors: [`Brain training failed: ${message}`],
        };
    }
}
/**
 * Get active training session
 */
export function getTrainingSession(sessionId) {
    return trainingSessions.get(sessionId);
}
/**
 * List all training sessions
 */
export function listTrainingSessions() {
    return Array.from(trainingSessions.keys());
}
/**
 * Clear old training sessions (cleanup)
 */
export function cleanupOldSessions(ageMs = 3600000) {
    const now = Date.now();
    let removed = 0;
    for (const [sessionId, state] of trainingSessions.entries()) {
        if (now - state.lastCheckpoint > ageMs) {
            trainingSessions.delete(sessionId);
            removed++;
        }
    }
    return removed;
}
export default handleBrainTrain;
