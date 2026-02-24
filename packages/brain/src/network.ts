/**
 * Neural Network Primitives for World Engine Brain
 *
 * Lightweight feedforward neural network with:
 * - Sigmoid activation
 * - Configurable layers
 * - Weight mutation (genetic algorithm)
 * - Crossover breeding
 */

import { randomNormal } from "@world-engine/math";

/** Sigmoid activation function */
export const sigmoid = (x: number): number => 1 / (1 + Math.exp(-Math.min(x, 100))); // Clamp to prevent overflow

export const AGENT_BRAIN_INPUT_SIZE = 20;
export const AGENT_BRAIN_OUTPUT_SIZE = 9;
export const DEFAULT_AGENT_BRAIN_HIDDEN_SIZES = [16, 12] as const;

export function createDefaultAgentNetwork(
    hiddenSizes: number[] = [...DEFAULT_AGENT_BRAIN_HIDDEN_SIZES]
): NeuralNetwork {
    return new NeuralNetwork(AGENT_BRAIN_INPUT_SIZE, [...hiddenSizes], AGENT_BRAIN_OUTPUT_SIZE);
}

/**
 * Feedforward Neural Network
 * Topology: input -> hidden[...] -> output
 */
export class NeuralNetwork {
    readonly inputSize: number;
    readonly hiddenSizes: number[];
    readonly outputSize: number;
    readonly layers: number[][][]; // Weights for each layer
    readonly biases: number[][]; // Biases for each layer
    fitness: number = 0;
    activationHistory: number[][] = []; // For debugging/visualization

    constructor(inputSize: number, hiddenSizes: number[], outputSize: number) {
        this.inputSize = inputSize;
        this.hiddenSizes = hiddenSizes;
        this.outputSize = outputSize;

        // Initialize weights and biases
        const allSizes = [inputSize, ...hiddenSizes, outputSize];
        this.layers = [];
        this.biases = [];

        for (let i = 0; i < allSizes.length - 1; i++) {
            const prevSize = allSizes[i] ?? 0;
            const currSize = allSizes[i + 1] ?? 0;

            // Random weights [-1, 1]
            this.layers.push(
                Array.from({ length: prevSize }, () =>
                    Array.from({ length: currSize }, () => Math.random() * 2 - 1)
                )
            );

            // Random biases [-1, 1]
            this.biases.push(Array.from({ length: currSize }, () => Math.random() * 2 - 1));
        }
    }

    /**
     * Forward pass: compute network output
     * @param inputs Input values (length must match inputSize)
     * @returns Output activations
     */
    forward(inputs: number[]): number[] {
        if (inputs.length !== this.inputSize) {
            throw new Error(`Expected ${this.inputSize} inputs, got ${inputs.length}`);
        }

        let activations = inputs;
        this.activationHistory = [activations];

        for (let layerIdx = 0; layerIdx < this.layers.length; layerIdx++) {
            const weights = this.layers[layerIdx];
            const biases = this.biases[layerIdx];

            if (!weights || !biases || weights.length === 0) {
                throw new Error(`Invalid layer ${layerIdx}`);
            }

            const nextActivations: number[] = [];
            const weightCols = weights[0]?.length ?? 0;
            for (let j = 0; j < weightCols; j++) {
                let sum = (biases[j] ?? 0);
                for (let i = 0; i < activations.length; i++) {
                    const act = activations[i];
                    const w = weights[i];
                    const wVal = w ? (w[j] ?? 0) : 0;
                    if (act !== undefined) {
                        sum += act * wVal;
                    }
                }
                nextActivations.push(sigmoid(sum));
            }

            activations = nextActivations;
            this.activationHistory.push(activations);
        }

        return activations;
    }

    /**
     * Mutate weights and biases (for genetic algorithm)
     * @param mutationRate Probability of mutating each weight
     * @param mutationStrength Standard deviation of mutation
     */
    mutate(mutationRate: number, mutationStrength: number): void {
        for (let layerIdx = 0; layerIdx < this.layers.length; layerIdx++) {
            const weights = this.layers[layerIdx];
            const biases = this.biases[layerIdx];

            if (!weights || !biases) continue;

            // Mutate weights
            for (let i = 0; i < weights.length; i++) {
                const row = weights[i];
                if (!row) continue;
                for (let j = 0; j < row.length; j++) {
                    if (Math.random() < mutationRate) {
                        row[j] = (row[j] ?? 0) + randomNormal(0, mutationStrength);
                    }
                }
            }

            // Mutate biases
            for (let j = 0; j < biases.length; j++) {
                if (Math.random() < mutationRate) {
                    biases[j] = (biases[j] ?? 0) + randomNormal(0, mutationStrength);
                }
            }
        }
    }

    /**
     * Create a deep copy of this network
     */
    clone(): NeuralNetwork {
        const clone = new NeuralNetwork(this.inputSize, this.hiddenSizes, this.outputSize);
        for (let i = 0; i < clone.layers.length; i++) {
            const sourceLayer = this.layers[i];
            const targetLayer = clone.layers[i];
            if (sourceLayer && targetLayer) {
                for (let j = 0; j < sourceLayer.length; j++) {
                    const sourceRow = sourceLayer[j];
                    if (sourceRow) {
                        targetLayer[j] = [...sourceRow];
                    }
                }
            }
        }
        for (let i = 0; i < clone.biases.length; i++) {
            const sourceBias = this.biases[i];
            const targetBias = clone.biases[i];
            if (sourceBias && targetBias) {
                for (let j = 0; j < sourceBias.length; j++) {
                    targetBias[j] = sourceBias[j] ?? 0;
                }
            }
        }
        clone.fitness = this.fitness;
        return clone;
    }

    /**
     * Uniform crossover: blend genes from two parents
     */
    static crossover(parentA: NeuralNetwork, parentB: NeuralNetwork): NeuralNetwork {
        const child = new NeuralNetwork(parentA.inputSize, parentA.hiddenSizes, parentA.outputSize);

        for (let layerIdx = 0; layerIdx < child.layers.length; layerIdx++) {
            const childWeights = child.layers[layerIdx];
            const parentAWeights = parentA.layers[layerIdx];
            const parentBWeights = parentB.layers[layerIdx];

            if (childWeights && parentAWeights && parentBWeights) {
                for (let i = 0; i < childWeights.length; i++) {
                    const childRow = childWeights[i];
                    const parentARow = parentAWeights[i];
                    const parentBRow = parentBWeights[i];
                    if (childRow && parentARow && parentBRow) {
                        for (let j = 0; j < childRow.length; j++) {
                            childRow[j] = Math.random() > 0.5 ? (parentARow[j] ?? 0) : (parentBRow[j] ?? 0);
                        }
                    }
                }
            }

            const childBiases = child.biases[layerIdx];
            const parentABiases = parentA.biases[layerIdx];
            const parentBBiases = parentB.biases[layerIdx];

            if (childBiases && parentABiases && parentBBiases) {
                for (let j = 0; j < childBiases.length; j++) {
                    childBiases[j] = Math.random() > 0.5 ? (parentABiases[j] ?? 0) : (parentBBiases[j] ?? 0);
                }
            }
        }

        return child;
    }

    /**
     * Export weights as JSON (for persistence)
     */
    toJSON() {
        return {
            inputSize: this.inputSize,
            hiddenSizes: this.hiddenSizes,
            outputSize: this.outputSize,
            layers: this.layers,
            biases: this.biases,
            fitness: this.fitness,
        };
    }

    /**
     * Import weights from JSON
     */
    static fromJSON(data: ReturnType<NeuralNetwork["toJSON"]>): NeuralNetwork {
        const nn = new NeuralNetwork(data.inputSize, data.hiddenSizes, data.outputSize);
        for (let i = 0; i < nn.layers.length; i++) {
            const targetLayer = nn.layers[i];
            const sourceLayer = data.layers[i];
            if (targetLayer && sourceLayer) {
                for (let j = 0; j < targetLayer.length; j++) {
                    const sourceRow = sourceLayer[j];
                    if (sourceRow) {
                        targetLayer[j] = [...sourceRow];
                    }
                }
            }
        }
        for (let i = 0; i < nn.biases.length; i++) {
            const targetBias = nn.biases[i];
            const sourceBias = data.biases[i];
            if (targetBias && sourceBias) {
                for (let j = 0; j < targetBias.length; j++) {
                    targetBias[j] = sourceBias[j] ?? 0;
                }
            }
        }
        nn.fitness = data.fitness;
        return nn;
    }
}
