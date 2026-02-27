/**
 * GraphAlgorithms - Fibonacci spiral distribution & Dijkstra pathfinding
 *
 * Features:
 * - Fibonacci spiral galaxy generation (even spatial distribution)
 * - Dijkstra's shortest path algorithm
 * - Automatic network connection based on proximity
 * - 3D node positioning for spatial graphs
 */

import { Vector3 } from "./Vector3";

export interface GraphNode {
  id: number;
  position: Vector3;
  connections: GraphNode[];
  metadata?: Record<string, any>;
}

export class GraphAlgorithms {
  nodes: GraphNode[] = [];

  // The Golden Ratio (φ = 1.618...)
  private static readonly PHI = 1.618033988749;
  private static readonly GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // ~137.5°

  // ============================================================================
  // FIBONACCI SPIRAL GENERATION
  // ============================================================================

  /**
   * Generate evenly distributed nodes using Fibonacci spiral
   *
   * Based on sunflower seed pattern - creates near-perfect uniform distribution
   * without clustering or gaps. Used for:
   * - Market sector nodes
   * - Star systems in galaxy
   * - Network topology
   * - Distributed sampling points
   *
   * @param count - Number of nodes to generate
   * @param scale - Radial scale factor
   * @param plane - "XZ" (ground plane) or "XY" (frontal plane)
   */
  generateFibonacciSpiral(
    count: number,
    scale: number,
    plane: "XZ" | "XY" = "XZ"
  ): void {
    this.nodes = [];

    for (let i = 0; i < count; i++) {
      // Radius grows with square root (maintains density)
      const radius = scale * Math.sqrt(i);

      // Golden angle ensures no radial alignment
      const theta = i * GraphAlgorithms.GOLDEN_ANGLE;

      let position: Vector3;
      if (plane === "XZ") {
        // Ground plane (Y=0)
        const x = radius * Math.cos(theta);
        const z = radius * Math.sin(theta);
        position = new Vector3(x, 0, z);
      } else {
        // Frontal plane (Z=0)
        const x = radius * Math.cos(theta);
        const y = radius * Math.sin(theta);
        position = new Vector3(x, y, 0);
      }

      this.nodes.push({
        id: i,
        position,
        connections: [],
      });
    }

    // Connect nearby nodes to form network
    this.connectNearbyNodes(scale * 2.5);
  }

  /**
   * Generate 3D spherical Fibonacci distribution
   * @param count - Number of nodes
   * @param radius - Sphere radius
   */
  generateFibonacciSphere(count: number, radius: number): void {
    this.nodes = [];

    for (let i = 0; i < count; i++) {
      // Even distribution on sphere surface
      const y = 1 - (i / (count - 1)) * 2; // -1 to 1
      // Clamp to [0, 1] to prevent NaN from floating point errors
      const radiusAtY = Math.sqrt(Math.max(0, Math.min(1, 1 - y * y)));
      const theta = i * GraphAlgorithms.GOLDEN_ANGLE;

      const position = new Vector3(
        radiusAtY * Math.cos(theta) * radius,
        y * radius,
        radiusAtY * Math.sin(theta) * radius
      );

      this.nodes.push({
        id: i,
        position,
        connections: [],
      });
    }

    this.connectNearbyNodes(radius * 0.5);
  }

  /**
   * Connect nodes within distance threshold
   */
  private connectNearbyNodes(maxDistance: number): void {
    const maxDistSq = maxDistance * maxDistance;

    for (let i = 0; i < this.nodes.length; i++) {
      const nodeA = this.nodes[i];
      if (!nodeA) continue;

      for (let j = i + 1; j < this.nodes.length; j++) {
        const nodeB = this.nodes[j];
        if (!nodeB) continue;
        const distSq = nodeA.position.distanceSquaredTo(nodeB.position);

        if (distSq < maxDistSq) {
          nodeA.connections.push(nodeB);
          nodeB.connections.push(nodeA);
        }
      }
    }
  }

  // ============================================================================
  // GRAPH MANIPULATION
  // ============================================================================

  addNode(position: Vector3, autoConnect = true, maxDistance = 10): number {
    const id = this.nodes.length;
    const node: GraphNode = {
      id,
      position,
      connections: [],
    };

    if (autoConnect) {
      const maxDistSq = maxDistance * maxDistance;
      for (const other of this.nodes) {
        const distSq = position.distanceSquaredTo(other.position);
        if (distSq < maxDistSq) {
          node.connections.push(other);
          other.connections.push(node);
        }
      }
    }

    this.nodes.push(node);
    return id;
  }

  removeNode(id: number): void {
    const node = this.nodes[id];
    if (!node) return;

    // Remove connections from other nodes
    for (const other of this.nodes) {
      other.connections = other.connections.filter((n) => n !== node);
    }

    // Mark as removed (don't shift array indices)
    node.connections = [];
  }

  addEdge(idA: number, idB: number): void {
    const nodeA = this.nodes[idA];
    const nodeB = this.nodes[idB];

    if (!nodeA || !nodeB) return;

    if (!nodeA.connections.includes(nodeB)) {
      nodeA.connections.push(nodeB);
    }
    if (!nodeB.connections.includes(nodeA)) {
      nodeB.connections.push(nodeA);
    }
  }

  // ============================================================================
  // DIJKSTRA'S SHORTEST PATH ALGORITHM
  // ============================================================================

  /**
   * Find shortest path between two nodes using Dijkstra's algorithm
   *
   * @param startId - Starting node ID
   * @param endId - Target node ID
   * @returns Array of positions along the shortest path (empty if no path)
   */
  findShortestPath(startId: number, endId: number): Vector3[] {
    const startNode = this.nodes[startId];
    const endNode = this.nodes[endId];

    if (!startNode || !endNode) return [];

    // Distance from start to each node
    const distances = new Map<number, number>();
    // Previous node in optimal path
    const previous = new Map<number, GraphNode>();
    // Unvisited nodes
    const unvisited = new Set<number>();

    // Initialize
    for (const node of this.nodes) {
      distances.set(node.id, Infinity);
      unvisited.add(node.id);
    }
    distances.set(startId, 0);

    while (unvisited.size > 0) {
      // Find unvisited node with smallest distance
      let currentId = -1;
      let minDist = Infinity;

      for (const id of unvisited) {
        const dist = distances.get(id) || Infinity;
        if (dist < minDist) {
          minDist = dist;
          currentId = id;
        }
      }

      // No path exists or reached target
      if (currentId === -1 || currentId === endId) break;

      unvisited.delete(currentId);
      const current = this.nodes[currentId];
      if (!current) break;

      // Check all neighbors
      for (const neighbor of current.connections) {
        if (!unvisited.has(neighbor.id)) continue;

        // Calculate distance (Euclidean)
        const edgeLength = current.position.distanceTo(neighbor.position);
        const altDistance = (distances.get(currentId) || Infinity) + edgeLength;

        if (altDistance < (distances.get(neighbor.id) || Infinity)) {
          distances.set(neighbor.id, altDistance);
          previous.set(neighbor.id, current);
        }
      }
    }

    // Reconstruct path
    const path: Vector3[] = [];
    let current: GraphNode | undefined = endNode;

    while (current) {
      path.unshift(current.position);
      current = previous.get(current.id);

      // Prevent infinite loops
      if (path.length > this.nodes.length) break;
    }

    // If path doesn't reach start, no valid path exists
    if (path.length > 0 && startNode && path[0] && !path[0].equals(startNode.position)) {
      return [];
    }

    return path;
  }

  /**
   * Find all nodes within a radius of a point
   */
  findNodesInRadius(center: Vector3, radius: number): GraphNode[] {
    const radiusSq = radius * radius;
    return this.nodes.filter((node) => {
      return node.position.distanceSquaredTo(center) < radiusSq;
    });
  }

  /**
   * Find nearest node to a point
   */
  findNearestNode(point: Vector3): GraphNode | null {
    if (this.nodes.length === 0) return null;

    let nearest = this.nodes[0]!;
    let minDistSq = point.distanceSquaredTo(nearest.position);

    for (const node of this.nodes) {
      const distSq = point.distanceSquaredTo(node.position);
      if (distSq < minDistSq) {
        minDistSq = distSq;
        nearest = node;
      }
    }

    return nearest;
  }

  // ============================================================================
  // GRAPH ANALYSIS
  // ============================================================================

  getStats(): {
    nodeCount: number;
    edgeCount: number;
    avgConnections: number;
    maxConnections: number;
    minConnections: number;
  } {
    const edgeCount = this.nodes.reduce((sum, node) => sum + node.connections.length, 0) / 2;
    const connectionCounts = this.nodes.map((n) => n.connections.length);

    return {
      nodeCount: this.nodes.length,
      edgeCount,
      avgConnections: connectionCounts.reduce((a, b) => a + b, 0) / this.nodes.length || 0,
      maxConnections: Math.max(...connectionCounts, 0),
      minConnections: Math.min(...connectionCounts, Number.MAX_SAFE_INTEGER),
    };
  }

  clear(): void {
    this.nodes = [];
  }
}
