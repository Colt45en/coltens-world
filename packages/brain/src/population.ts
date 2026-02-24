/**
 * Population Genetics & Evolution
 *
 * Manages a population of neural networks that evolve toward solving
 * a fitness function. Used to optimize agent behavior in World Engine.
 */

import { NeuralNetwork } from "./network.js";

/**
 * Agent: Neural network + metadata
 */
export interface Agent {
    id: string;
    network: NeuralNetwork;
    generation: number;
    parentIds: string[];
}

/**
 * Evolution parameters
 */
export interface EvolutionConfig {
    populationSize: number;
    mutationRate: number; // 0-1
    mutationStrength: number; // Standard deviation
    elitism: number; // Top N agents to keep unchanged
    selectionPressure: "roulette" | "tournament" | "top50"; // Selection strategy
}

/**
 * Population of neural networks
 */
export class Population {
    agents: Agent[];
    generation: number = 1;
    bestFitness: number = 0;
    bestAgent: Agent | null = null;
    fitnessHistory: number[] = [];
    config: EvolutionConfig;

    constructor(
        config: EvolutionConfig,
        inputSize: number,
        hiddenSizes: number[],
        outputSize: number
    ) {
        this.config = config;
        this.agents = Array.from({ length: config.populationSize }, (_, i) => ({
            id: `agent-${this.generation}-${i}`,
            network: new NeuralNetwork(inputSize, hiddenSizes, outputSize),
            generation: this.generation,
            parentIds: [],
        }));
    }

    /**
     * Evaluate all agents using fitness function
     */
    async evaluate(fitnessFn: (network: NeuralNetwork) => Promise<number>): Promise<void> {
        for (const agent of this.agents) {
            agent.network.fitness = await fitnessFn(agent.network);
        }

        // Track best
        this.agents.sort((a, b) => b.network.fitness - a.network.fitness);
        const best = this.agents[0];
        if (best) {
            this.bestAgent = best;
            this.bestFitness = best.network.fitness;
            this.fitnessHistory.push(this.bestFitness);
        }
    }

    /**
     * Evolve population for next generation
     */
    evolve(): void {
        const sorted = [...this.agents].sort((a, b) => b.network.fitness - a.network.fitness);
        const newAgents: Agent[] = [];

        // Elitism: keep best unchanged
        for (let i = 0; i < this.config.elitism && i < sorted.length; i++) {
            const agent = sorted[i];
            if (!agent) continue;
            newAgents.push({
                id: `agent-${this.generation + 1}-${newAgents.length}`,
                network: agent.network.clone(),
                generation: this.generation + 1,
                parentIds: [agent.id],
            });
        }

        // Selection pool based on strategy
        let selectionPool = sorted;
        if (this.config.selectionPressure === "top50") {
            selectionPool = sorted.slice(0, Math.ceil(sorted.length / 2));
        } else if (this.config.selectionPressure === "tournament") {
            // Tournament selection: done per breeding iteration
            selectionPool = sorted;
        }

        // Breeding: fill rest of population
        while (newAgents.length < this.config.populationSize) {
            let parentA: Agent | undefined = selectionPool[0];
            let parentB: Agent | undefined = selectionPool[Math.floor(Math.random() * selectionPool.length)];

            if (this.config.selectionPressure === "tournament") {
                // Simple tournament: random pair, keep better
                const idx1 = Math.floor(Math.random() * selectionPool.length);
                const idx2 = Math.floor(Math.random() * selectionPool.length);
                const p1 = selectionPool[idx1];
                const p2 = selectionPool[idx2];
                if (p1 && p2) {
                    parentA = p1.network.fitness >= p2.network.fitness ? p1 : p2;
                }
                parentB = selectionPool[Math.floor(Math.random() * selectionPool.length)];
            } else if (this.config.selectionPressure === "roulette") {
                // Fitness proportionate selection
                const totalFitness = selectionPool.reduce((sum, a) => sum + a.network.fitness, 0);
                const probs = selectionPool.map((a) => a.network.fitness / (totalFitness || 1));

                parentA = this.selectByProbability(selectionPool, probs);
                parentB = this.selectByProbability(selectionPool, probs);
            }

            if (!parentA || !parentB) continue;

            // Crossover + Mutation
            const child = NeuralNetwork.crossover(parentA.network, parentB.network);
            child.mutate(this.config.mutationRate, this.config.mutationStrength);

            newAgents.push({
                id: `agent-${this.generation + 1}-${newAgents.length}`,
                network: child,
                generation: this.generation + 1,
                parentIds: [parentA.id, parentB.id],
            });
        }

        this.agents = newAgents;
        this.generation++;
    }

    /**
     * Select agent by probability distribution
     */
    private selectByProbability(agents: Agent[], probs: number[]): Agent | undefined {
        let rand = Math.random();
        for (let i = 0; i < agents.length; i++) {
            const prob = probs[i];
            if (prob !== undefined) {
                rand -= prob;
                if (rand <= 0) return agents[i];
            }
        }
        return agents[agents.length - 1];
    }

    /**
     * Get top N agents
     */
    getTopAgents(n: number): Agent[] {
        return [...this.agents].sort((a, b) => b.network.fitness - a.network.fitness).slice(0, n);
    }
}
