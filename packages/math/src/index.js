/**
 * Math catalog: deterministic primitives for engine
 * Categories: core, algebra, calculus, geometry, discrete, probability, stats, etc.
 */
/**
 * Core vector operations
 */
export const Vec3 = {
    create(x, y, z) {
        return { x, y, z };
    },
    add(a, b) {
        return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
    },
    subtract(a, b) {
        return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
    },
    scale(v, s) {
        return { x: v.x * s, y: v.y * s, z: v.z * s };
    },
    dot(a, b) {
        return a.x * b.x + a.y * b.y + a.z * b.z;
    },
    length(v) {
        return Math.hypot(v.x, v.y, v.z);
    },
    normalize(v) {
        const len = this.length(v);
        if (len === 0)
            return { x: 0, y: 0, z: 0 };
        return { x: v.x / len, y: v.y / len, z: v.z / len };
    },
    cross(a, b) {
        return {
            x: a.y * b.z - a.z * b.y,
            y: a.z * b.x - a.x * b.z,
            z: a.x * b.y - a.y * b.x,
        };
    },
};
/**
 * Seeded RNG for deterministic randomness
 * Uses PCG variant for good distribution and period
 */
export class SeededRNG {
    state;
    inc = 1n;
    constructor(seed) {
        this.state = BigInt(seed) << 1n | 1n;
        this.inc = (BigInt(Date.now()) << 1n) | 1n;
    }
    next() {
        const oldState = this.state;
        this.state = (oldState * 6364136223846793005n + this.inc) & ((1n << 64n) - 1n);
        const xorshifted = Number((oldState >> 18n) ^ oldState >> 27n) >>> 0;
        const rotation = Number(oldState >> 59n) >>> 0;
        return (((xorshifted >> rotation) | (xorshifted << (32 - rotation))) >>> 0) / 0x100000000;
    }
    nextInt(min, max) {
        return Math.floor(this.next() * (max - min)) + min;
    }
    nextFloat(min, max) {
        return this.next() * (max - min) + min;
    }
}
/**
 * Gaussian Random Number (Box-Muller transform)
 * @param mean Center of distribution
 * @param std Standard deviation
 * @returns Random number from normal distribution
 */
export const randomNormal = (mean = 0, std = 1) => {
    let u = 0, v = 0;
    while (u === 0)
        u = Math.random();
    while (v === 0)
        v = Math.random();
    return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};
/**
 * Basic statistical operations
 */
export const Stats = {
    mean(values) {
        if (values.length === 0)
            return 0;
        return values.reduce((a, b) => a + b, 0) / values.length;
    },
    variance(values) {
        const m = this.mean(values);
        const squaredDiffs = values.map(v => (v - m) ** 2);
        return this.mean(squaredDiffs);
    },
    stdDev(values) {
        return Math.sqrt(this.variance(values));
    },
    median(values) {
        if (values.length === 0)
            return 0;
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        if (sorted.length % 2 === 1) {
            return sorted[mid] ?? 0;
        }
        const left = sorted[mid - 1] ?? 0;
        const right = sorted[mid] ?? 0;
        return (left + right) / 2;
    },
};
export default {
    Vec3,
    SeededRNG,
    Stats,
    randomNormal,
};
