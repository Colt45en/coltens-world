/**
 * @we/brain - Neural Network Brain System for World Engine
 *
 * Exports:
 * - NeuralNetwork: Core feedforward network with sigmoid activation
 * - Population: Evolution system with genetic algorithms
 * - AgentBrain: Game entity controller driven by neural network
 * - EvolutionConfig: Configuration for population evolution
 * - BrainSensors/BrainActions: Interfaces for sensor/motor I/O
 */
export { AgentBrain } from "./controller.js";
export { AGENT_BRAIN_INPUT_SIZE, AGENT_BRAIN_OUTPUT_SIZE, createDefaultAgentNetwork, DEFAULT_AGENT_BRAIN_HIDDEN_SIZES, NeuralNetwork, sigmoid } from "./network.js";
export { Population } from "./population.js";
// Review & Governance
export * from "./review/reviewStore.js";
export * from "./review/reviewTypes.js";
