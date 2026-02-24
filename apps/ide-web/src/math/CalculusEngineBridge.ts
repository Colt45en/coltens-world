/**
 * TypeScript Bridge for Python Calculus Engine v2
 *
 * Provides seamless integration between Noise3D.ts terrain generation
 * and Python calculus engine for advanced terrain analysis.
 */

import { WebSocket } from 'ws';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface Vec2 {
  x: number;
  y: number;
}

export interface TerrainAnalysisPoint {
  x: number;
  y: number;
  height: number;
  gradient: Vec2;
  slope_angle: number;
  slope_magnitude: number;
  curvature_mean: number;
  curvature_gaussian: number;
  flow_direction: Vec2;
  is_ridge: boolean;
  is_valley: boolean;
  is_saddle: boolean;
}

export interface TerrainAnalysisResult {
  width: number;
  height: number;
  cell_size: number;
  points: TerrainAnalysisPoint[];
  ridges?: Vec2[][];
  valleys?: Vec2[][];
}

/**
 * Export heightmap to Python-compatible format
 */
export function exportHeightmapForAnalysis(
  heightmap: number[][],
  outputPath: string,
  cellSize: number = 1.0
): Promise<void> {
  const data = {
    width: heightmap[0]?.length || 0,
    height: heightmap.length,
    heightmap,
    cell_size: cellSize,
  };

  return fs.writeFile(outputPath, JSON.stringify(data, null, 2));
}

/**
 * Import terrain analysis results from Python
 */
export async function importTerrainAnalysis(
  inputPath: string
): Promise<TerrainAnalysisResult> {
  const content = await fs.readFile(inputPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Run Python terrain analysis as subprocess (offline pipeline)
 */
export async function analyzeTerrainOffline(
  heightmap: number[][],
  tempDir: string = './temp',
  options?: {
    cellSize?: number;
    computeCurvature?: boolean;
    ridgeThreshold?: number;
    valleyThreshold?: number;
  }
): Promise<TerrainAnalysisResult> {
  const { spawn } = await import('node:child_process');
  const { promisify } = await import('node:util');

  // Create temp directory
  await fs.mkdir(tempDir, { recursive: true });

  const inputPath = path.join(tempDir, 'heightmap_input.json');
  const outputPath = path.join(tempDir, 'terrain_analysis.json');

  // Export heightmap
  await exportHeightmapForAnalysis(heightmap, inputPath, options?.cellSize || 1.0);

  // Run Python analysis
  const pythonScript = `
from terrain_field_calculus import TerrainFieldCalculus, Noise3DIntegration
import json

# Load heightmap
data = json.load(open('${inputPath.replace(/\\/g, '/')}'))
heightmap = data['heightmap']
cell_size = data.get('cell_size', 1.0)

# Analyze
field = TerrainFieldCalculus.from_heightmap(
    heightmap,
    cell_size=cell_size,
    compute_curvature=${options?.computeCurvature !== false},
    ridge_threshold=${options?.ridgeThreshold || 0.1},
    valley_threshold=${options?.valleyThreshold || -0.1}
)

# Extract features
ridges = TerrainFieldCalculus.extract_ridges(field)
valleys = TerrainFieldCalculus.extract_valleys(field)

# Export
TerrainFieldCalculus.export_to_json(field, '${outputPath.replace(/\\/g, '/')}')

# Add ridge/valley data
result = json.load(open('${outputPath.replace(/\\/g, '/')}'))
result['ridges'] = [[{'x': p.x, 'y': p.y} for p in ridge] for ridge in ridges]
result['valleys'] = [[{'x': p.x, 'y': p.y} for p in valley] for valley in valleys]

json.dump(result, open('${outputPath.replace(/\\/g, '/')}', 'w'), indent=2)
`;

  const scriptPath = path.join(tempDir, 'analyze_temp.py');
  await fs.writeFile(scriptPath, pythonScript);

  const proc = spawn('python', [scriptPath], {
    cwd: path.resolve(__dirname),
    stdio: 'pipe',
  });

  await new Promise<void>((resolve, reject) => {
    proc.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Python process exited with code ${code}`));
    });
    proc.on('error', reject);
  });

  // Import results
  return importTerrainAnalysis(outputPath);
}

/**
 * Real-time WebSocket bridge to Python calculus engine
 */
export class CalculusEngineClient {
  private ws: WebSocket | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, {
    resolve: (result: any) => void;
    reject: (error: Error) => void;
  }>();

  constructor(private url: string = 'ws://localhost:8765') {}

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.on('open', () => {
        console.log('Connected to Python calculus engine');
        resolve();
      });

      this.ws.on('message', (data: string) => {
        const response = JSON.parse(data.toString());
        const pending = this.pendingRequests.get(response.id);
        if (pending) {
          this.pendingRequests.delete(response.id);
          if (response.error) {
            pending.reject(new Error(response.error));
          } else {
            pending.resolve(response.result);
          }
        }
      });

      this.ws.on('error', (err) => {
        console.error('WebSocket error:', err);
        reject(err);
      });
    });
  }

  async analyzeHeightmap(
    heightmap: number[][],
    options?: { cellSize?: number; computeCurvature?: boolean }
  ): Promise<TerrainAnalysisResult> {
    if (!this.ws) throw new Error('Not connected');

    const id = this.requestId++;
    const request = {
      id,
      method: 'analyze_heightmap',
      params: {
        heightmap,
        cell_size: options?.cellSize || 1.0,
        compute_curvature: options?.computeCurvature !== false,
      },
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.ws!.send(JSON.stringify(request));
    });
  }

  async computeDerivative(
    func: number[],
    x: number,
    method: 'central' | 'five_point' = 'central'
  ): Promise<{ value: number; error_est: number; h_used: number }> {
    if (!this.ws) throw new Error('Not connected');

    const id = this.requestId++;
    const request = {
      id,
      method: 'derivative',
      params: { func, x, method },
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.ws!.send(JSON.stringify(request));
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

/**
 * Three.js visualization helpers
 */
export class TerrainVisualizer {
  /**
   * Create Three.js LineSegments from ridge/valley polylines
   */
  static createPolylineGeometry(
    polylines: Vec2[][],
    heightmap: number[][],
    heightScale: number = 1.0
  ): Float32Array {
    const vertices: number[] = [];

    for (const line of polylines) {
      for (let i = 0; i < line.length - 1; i++) {
        const p0 = line[i]!;
        const p1 = line[i + 1]!;

        const h0 = heightmap[Math.floor(p0.y)]?.[Math.floor(p0.x)] || 0;
        const h1 = heightmap[Math.floor(p1.y)]?.[Math.floor(p1.x)] || 0;

        vertices.push(p0.x, h0 * heightScale, p0.y);
        vertices.push(p1.x, h1 * heightScale, p1.y);
      }
    }

    return new Float32Array(vertices);
  }

  /**
   * Create gradient field visualization (arrows)
   */
  static createGradientFieldGeometry(
    analysis: TerrainAnalysisResult,
    sampleStep: number = 5,
    arrowLength: number = 2.0
  ): Float32Array {
    const vertices: number[] = [];

    for (let i = 0; i < analysis.points.length; i += sampleStep) {
      const point = analysis.points[i]!;
      if (!point) continue;

      const grad = point.gradient;
      const mag = point.slope_magnitude;

      if (mag > 0.01) {
        // Arrow base
        vertices.push(point.x, point.height, point.y);

        // Arrow tip (gradient direction)
        const scale = arrowLength / mag;
        vertices.push(
          point.x + grad.x * scale,
          point.height,
          point.y + grad.y * scale
        );
      }
    }

    return new Float32Array(vertices);
  }

  /**
   * Create curvature heatmap texture
   */
  static createCurvatureTexture(
    analysis: TerrainAnalysisResult
  ): Uint8ClampedArray {
    const { width, height } = analysis;
    const data = new Uint8ClampedArray(width * height * 4);

    // Find min/max curvature for normalization
    let minCurv = Infinity, maxCurv = -Infinity;
    for (const point of analysis.points) {
      minCurv = Math.min(minCurv, point.curvature_mean);
      maxCurv = Math.max(maxCurv, point.curvature_mean);
    }

    for (let i = 0; i < analysis.points.length; i++) {
      const point = analysis.points[i]!;
      const curv = point.curvature_mean;

      // Normalize to 0-1
      const t = (curv - minCurv) / (maxCurv - minCurv);

      // Color map: blue (valley) -> green (flat) -> red (ridge)
      const r = Math.floor(t * 255);
      const g = Math.floor((1 - Math.abs(t * 2 - 1)) * 255);
      const b = Math.floor((1 - t) * 255);

      data[i * 4 + 0] = r;
      data[i * 4 + 1] = g;
      data[i * 4 + 2] = b;
      data[i * 4 + 3] = 255;
    }

    return data;
  }
}

/**
 * Example usage with Noise3D
 */
export async function exampleUsage() {
  console.log('=== Calculus Engine v2 Integration Example ===\n');

  // 1. Generate heightmap (use your Noise3D implementation)
  const size = 128;
  const heightmap: number[][] = [];
  for (let y = 0; y < size; y++) {
    const row: number[] = [];
    for (let x = 0; x < size; x++) {
      // Simple test terrain (replace with Noise3D.noise3D())
      const h = Math.sin(x * 0.1) * Math.cos(y * 0.1);
      row.push(h);
    }
    heightmap.push(row);
  }

  // 2. Analyze with Python calculus engine
  console.log('Analyzing terrain...');
  const analysis = await analyzeTerrainOffline(heightmap, './temp', {
    cellSize: 1.0,
    computeCurvature: true,
  });

  console.log(`Analysis complete:`);
  console.log(`  Points: ${analysis.points.length}`);
  console.log(`  Ridges: ${analysis.ridges?.length || 0}`);
  console.log(`  Valleys: ${analysis.valleys?.length || 0}`);

  // 3. Visualize in Three.js (pseudo-code)
  /*
  import * as THREE from 'three';

  // Create ridge lines
  const ridgeVertices = TerrainVisualizer.createPolylineGeometry(
    analysis.ridges || [],
    heightmap,
    10.0
  );
  const ridgeGeometry = new THREE.BufferGeometry();
  ridgeGeometry.setAttribute('position', new THREE.BufferAttribute(ridgeVertices, 3));
  const ridgeMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
  const ridgeLines = new THREE.LineSegments(ridgeGeometry, ridgeMaterial);
  scene.add(ridgeLines);

  // Create gradient field arrows
  const gradientVertices = TerrainVisualizer.createGradientFieldGeometry(
    analysis,
    5,
    2.0
  );
  const gradientGeometry = new THREE.BufferGeometry();
  gradientGeometry.setAttribute('position', new THREE.BufferAttribute(gradientVertices, 3));
  const gradientMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });
  const gradientField = new THREE.LineSegments(gradientGeometry, gradientMaterial);
  scene.add(gradientField);
  */

  console.log('\n✅ Integration complete!');
}

// Run example if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  exampleUsage().catch(console.error);
}

/* ============================================================
 * Re-exports: Core Calculus Engine (calculus.ts)
 * ============================================================
 *
 * Maintain backward compatibility while exposing new production
 * calculus implementation (Brent root solver, RK45 adaptive ODE, etc.)
 */
export {
  Calculus,
  SeriesExpansions,
  calc,
  type ScalarFn,
  type VectorFn,
  type VectorValuedFn,
  type Bounds,
  type AdaptiveSimpsonOptions,
  type RK45Options,
} from "./calculus";
