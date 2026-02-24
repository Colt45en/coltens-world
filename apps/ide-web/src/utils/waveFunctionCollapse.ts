/**
 * waveFunctionCollapse.ts - Wave Function Collapse Algorithm
 *
 * Constraint satisfaction solver for procedural generation.
 * Generates output that is locally similar to input patterns.
 */

export type TileId = number;
export type Direction = 0 | 1 | 2 | 3; // N, E, S, W

export interface Tile {
  id: TileId;
  color: string;
  name: string;
  adjacencyRules: Map<Direction, Set<TileId>>;
  weight: number;
}

export interface Cell {
  collapsed: boolean;
  options: Set<TileId>;
  entropy: number;
}

export class WaveFunctionCollapse {
  private grid: Cell[][];
  private tiles: Map<TileId, Tile>;
  private width: number;
  private height: number;
  private history: { x: number; y: number; tile: TileId }[];

  constructor(width: number, height: number, tiles: Tile[]) {
    this.width = width;
    this.height = height;
    this.tiles = new Map(tiles.map((t) => [t.id, t]));
    this.history = [];
    this.grid = this.initializeGrid();
  }

  private initializeGrid(): Cell[][] {
    const grid: Cell[][] = [];
    const allTileIds = new Set(Array.from(this.tiles.keys()));

    for (let y = 0; y < this.height; y++) {
      grid[y] = [];
      for (let x = 0; x < this.width; x++) {
        grid[y]![x] = {
          collapsed: false,
          options: new Set(allTileIds),
          entropy: this.calculateEntropy(allTileIds),
        };
      }
    }
    return grid;
  }

  /**
   * Calculate Shannon Entropy for a set of tile options
   * H = log(Σw_i) - (Σw_i * log(w_i)) / Σw_i
   */
  private calculateEntropy(options: Set<TileId>): number {
    if (options.size === 0) return -1;
    if (options.size === 1) return 0;

    let sumWeights = 0;
    let sumWeightLogWeight = 0;

    for (const tileId of options) {
      const tile = this.tiles.get(tileId);
      if (tile) {
        const w = tile.weight;
        sumWeights += w;
        sumWeightLogWeight += w * Math.log(w);
      }
    }

    if (sumWeights === 0) return -1;

    return Math.log(sumWeights) - sumWeightLogWeight / sumWeights;
  }

  /**
   * Find the cell with the lowest non-zero entropy
   */
  private findLowestEntropyCell(): { x: number; y: number } | null {
    let minEntropy = Infinity;
    let candidates: { x: number; y: number }[] = [];

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.grid[y]?.[x];
        if (!cell || cell.collapsed || cell.entropy < 0) continue;

        if (cell.entropy < minEntropy) {
          minEntropy = cell.entropy;
          candidates = [{ x, y }];
        } else if (cell.entropy === minEntropy) {
          candidates.push({ x, y });
        }
      }
    }

    if (candidates.length === 0) return null;

    // Add noise to break ties randomly
    return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
  }

  /**
   * Collapse a cell to a single tile based on weighted random selection
   */
  private collapseCell(x: number, y: number): TileId | null {
    const cell = this.grid[y]?.[x];
    if (!cell || cell.collapsed || cell.options.size === 0) return null;

    // Weighted random selection
    const tiles = Array.from(cell.options).map((id) => this.tiles.get(id)!);
    const totalWeight = tiles.reduce((sum, tile) => sum + tile.weight, 0);
    let random = Math.random() * totalWeight;

    for (const tile of tiles) {
      random -= tile.weight;
      if (random <= 0) {
        cell.collapsed = true;
        cell.options = new Set([tile.id]);
        cell.entropy = 0;
        this.history.push({ x, y, tile: tile.id });
        return tile.id;
      }
    }

    // Fallback
    const fallback = Array.from(cell.options)[0] ?? 0;
    cell.collapsed = true;
    cell.options = new Set([fallback]);
    cell.entropy = 0;
    this.history.push({ x, y, tile: fallback });
    return fallback;
  }

  /**
   * Propagate constraints to neighboring cells
   */
  private propagate(x: number, y: number): boolean {
    const stack: { x: number; y: number }[] = [{ x, y }];
    const processed = new Set<string>();

    while (stack.length > 0) {
      const current = stack.pop()!;
      const key = `${current.x},${current.y}`;

      if (processed.has(key)) continue;
      processed.add(key);

      const cell = this.grid[current.y]?.[current.x];
      if (!cell) continue;

      // Check all 4 directions
      const directions: [Direction, number, number][] = [
        [0, 0, -1], // North
        [1, 1, 0], // East
        [2, 0, 1], // South
        [3, -1, 0], // West
      ];

      for (const [dir, dx, dy] of directions) {
        const nx = current.x + dx;
        const ny = current.y + dy;

        if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) continue;

        const neighbor = this.grid[ny]?.[nx];
        if (!neighbor || neighbor.collapsed) continue;

        // Calculate valid options for neighbor based on current cell
        const validOptions = new Set<TileId>();

        for (const tileId of cell.options) {
          const tile = this.tiles.get(tileId);
          if (tile) {
            const allowed = tile.adjacencyRules.get(dir);
            if (allowed) {
              for (const allowedId of allowed) {
                validOptions.add(allowedId);
              }
            }
          }
        }

        // Intersect with neighbor's current options
        const newOptions = new Set<TileId>();
        for (const option of neighbor.options) {
          if (validOptions.has(option)) {
            newOptions.add(option);
          }
        }

        // Check for contradiction
        if (newOptions.size === 0) {
          return false; // Contradiction detected
        }

        // Update neighbor if options changed
        if (newOptions.size < neighbor.options.size) {
          neighbor.options = newOptions;
          neighbor.entropy = this.calculateEntropy(newOptions);
          stack.push({ x: nx, y: ny });
        }
      }
    }

    return true;
  }

  /**
   * Run one iteration of the WFC algorithm
   * Returns true if step was successful, false if complete or contradiction
   */
  step(): boolean {
    const cell = this.findLowestEntropyCell();
    if (!cell) return false; // All cells collapsed

    const tileId = this.collapseCell(cell.x, cell.y);
    if (tileId === null) return false;

    const success = this.propagate(cell.x, cell.y);
    return success;
  }

  /**
   * Run the algorithm to completion
   */
  generate(): boolean {
    let maxIterations = this.width * this.height * 10;
    let iterations = 0;

    while (iterations < maxIterations) {
      if (!this.step()) {
        // Check if all cells are collapsed
        return this.isComplete();
      }
      iterations++;
    }

    return false; // Timeout
  }

  /**
   * Check if all cells are collapsed
   */
  isComplete(): boolean {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (!this.grid[y]?.[x]?.collapsed) return false;
      }
    }
    return true;
  }

  /**
   * Get the current grid state
   */
  getGrid(): Cell[][] {
    return this.grid;
  }

  /**
   * Get the collapsed tile ID at a position
   */
  getTileAt(x: number, y: number): TileId | null {
    const cell = this.grid[y]?.[x];
    if (!cell || !cell.collapsed) return null;
    return Array.from(cell.options)[0] ?? null;
  }

  /**
   * Get generation history
   */
  getHistory(): { x: number; y: number; tile: TileId }[] {
    return this.history;
  }

  /**
   * Reset the grid
   */
  reset(): void {
    this.grid = this.initializeGrid();
    this.history = [];
  }
}

/**
 * Create a simple tileset for demonstration
 */
export function createSimpleTileset(): Tile[] {
  // Simple 4-tile set: grass, water, sand, rock
  const grass: Tile = {
    id: 0,
    name: "Grass",
    color: "#4ade80",
    weight: 5,
    adjacencyRules: new Map([
      [0, new Set([0, 2, 3])], // N: grass, sand, rock
      [1, new Set([0, 2, 3])], // E
      [2, new Set([0, 2, 3])], // S
      [3, new Set([0, 2, 3])], // W
    ]),
  };

  const water: Tile = {
    id: 1,
    name: "Water",
    color: "#3b82f6",
    weight: 3,
    adjacencyRules: new Map([
      [0, new Set([1, 2])], // N: water, sand
      [1, new Set([1, 2])], // E
      [2, new Set([1, 2])], // S
      [3, new Set([1, 2])], // W
    ]),
  };

  const sand: Tile = {
    id: 2,
    name: "Sand",
    color: "#fbbf24",
    weight: 4,
    adjacencyRules: new Map([
      [0, new Set([0, 1, 2, 3])], // N: can be adjacent to all
      [1, new Set([0, 1, 2, 3])], // E
      [2, new Set([0, 1, 2, 3])], // S
      [3, new Set([0, 1, 2, 3])], // W
    ]),
  };

  const rock: Tile = {
    id: 3,
    name: "Rock",
    color: "#64748b",
    weight: 2,
    adjacencyRules: new Map([
      [0, new Set([0, 2, 3])], // N: grass, sand, rock
      [1, new Set([0, 2, 3])], // E
      [2, new Set([0, 2, 3])], // S
      [3, new Set([0, 2, 3])], // W
    ]),
  };

  return [grass, water, sand, rock];
}
