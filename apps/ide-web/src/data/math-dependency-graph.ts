// Mathematics for Computer Graphics: Dependency Graph
// Machine-readable schema for mathematical topics and graphics operations

export interface MathTopic {
  name: string;
  description: string;
  tier: number;
  enables: string[];
  graphicsRelevance?: string;
  concepts?: string[];
  operations?: Record<string, string>;
  functions?: Record<string, string[]>;
  examples?: Record<string, string>;
  methods?: string[];
}

export interface Tier {
  id: string;
  name: string;
  tier: number;
  durationMonths: string;
  color: string;
}

export interface GraphicsOperation {
  category: string;
  operation: string;
  mathRequired: string[];
  equation?: string;
  methods?: string[];
}

export const TIERS: Tier[] = [
  { id: 'foundations', name: 'Foundational Concepts', tier: 0, durationMonths: '1-2', color: '#8b5cf6' },
  { id: 'classical', name: 'Classical Mathematics', tier: 1, durationMonths: '2-3', color: '#a855f7' },
  { id: 'linear', name: 'Linear Mathematics', tier: 2, durationMonths: '2-3', color: '#c084fc' },
  { id: 'calculus', name: 'Calculus and Analysis', tier: 3, durationMonths: '3-4', color: '#d8b4fe' },
  { id: 'differential_equations', name: 'Differential Equations', tier: 4, durationMonths: '4-6', color: '#e9d5ff' },
  { id: 'numerical', name: 'Numerical Methods', tier: 5, durationMonths: '3-4', color: '#06b6d4' },
  { id: 'optimization', name: 'Optimization and Statistics', tier: 6, durationMonths: '2-3', color: '#22d3ee' },
];

export const MATH_TOPICS: Record<string, MathTopic> = {
  // Tier 0: Foundations
  arithmetic: {
    name: 'Arithmetic',
    description: 'Basic operations on numbers',
    tier: 0,
    operations: {
      add: 'a + b',
      subtract: 'a - b',
      multiply: 'a × b',
      divide: 'a ÷ b',
    },
    enables: ['algebra', 'linear_algebra'],
  },
  geometry_euclidean: {
    name: 'Euclidean Geometry',
    description: 'Shapes, distances, angles in 2D/3D',
    tier: 0,
    concepts: ['point', 'line', 'plane', 'angle', 'distance', 'area', 'volume'],
    enables: ['trigonometry', 'linear_algebra', 'analytic_geometry'],
  },

  // Tier 1: Classical
  algebra: {
    name: 'Algebra',
    description: 'Symbolic manipulation and equation solving',
    tier: 1,
    operations: {
      solve_linear: 'ax + b = 0 → x = -b/a',
      solve_quadratic: 'ax² + bx + c = 0 → x = (-b ± √Δ) / 2a',
      polynomial_interpolation: 'Lagrange or Bezier basis',
    },
    enables: ['linear_algebra', 'calculus', 'differential_equations'],
    graphicsRelevance: 'Parameter equations, curve fitting',
  },
  trigonometry: {
    name: 'Trigonometry',
    description: 'Angles and periodic functions',
    tier: 1,
    functions: {
      basic: ['sin', 'cos', 'tan'],
      inverse: ['asin', 'acos', 'atan', 'atan2'],
    },
    operations: {
      pythagorean: 'sin²θ + cos²θ = 1',
      angle_sum: 'sin(A+B) = sinA·cosB + cosA·sinB',
      double_angle: 'sin(2θ) = 2·sinθ·cosθ',
    },
    enables: ['rotation_matrices', 'perspective_projection', 'lighting'],
    graphicsRelevance: 'Rotations, FOV, normal mapping, waves',
  },
  analytic_geometry: {
    name: 'Analytic Geometry',
    description: 'Geometric shapes expressed algebraically',
    tier: 1,
    operations: {
      line_2d: 'ax + by + c = 0',
      circle: '(x-h)² + (y-k)² = r²',
      plane_3d: 'ax + by + cz + d = 0',
      sphere: '(x-h)² + (y-k)² + (z-l)² = r²',
    },
    methods: ['distance_point_to_line', 'line_intersection', 'plane_intersection', 'point_in_polygon'],
    enables: ['parametric_curves', 'implicit_surfaces', 'ray_casting'],
    graphicsRelevance: 'Collision detection, ray tracing, queries',
  },
  parametric_equations: {
    name: 'Parametric Equations',
    description: 'Curves and surfaces via parameters',
    tier: 1,
    operations: {
      line: 'P(t) = P₀ + t(P₁ - P₀)',
      circle: 'P(θ) = [r·cos(θ), r·sin(θ)]',
      helix: 'P(t) = [r·cos(t), r·sin(t), h·t]',
      bezier: 'P(t) = Σᵢ B_i,n(t) · P_i',
      sphere: 'S(θ,φ) = [r·sinφ·cosθ, r·sinφ·sinθ, r·cosφ]',
      torus: 'S(θ,φ) = [(R + r·cosφ)·cosθ, ...]',
    },
    enables: ['mesh_generation', 'animation_paths'],
    graphicsRelevance: 'Procedural geometry, camera paths',
  },

  // Tier 2: Linear
  linear_algebra: {
    name: 'Linear Algebra',
    description: 'Vector spaces and matrix operations',
    tier: 2,
    operations: {
      vector_add: 'u + v',
      dot_product: 'u·v = Σᵢ uᵢvᵢ',
      cross_product: 'u × v (3D, anticommutative)',
      normalize: 'û = u / ||u||',
      matrix_multiply: '(AB)ᵢⱼ = Σₖ AᵢₖBₖⱼ',
      matrix_inverse: 'A⁻¹ such that AA⁻¹ = I',
      transpose: 'Aᵀ[i,j] = A[j,i]',
      determinant: 'det(A), volume scaling',
    },
    methods: ['eigendecomposition', 'svd', 'lu', 'cholesky'],
    enables: ['transformation_matrices', 'camera_systems', 'ik_solvers'],
    graphicsRelevance: 'All transforms, projections, solvers',
  },
  quaternions: {
    name: 'Quaternions',
    description: '4D algebra for smooth rotations',
    tier: 2,
    operations: {
      definition: 'q = w + xi + yj + zk',
      multiplication: 'Quaternion product (non-commutative)',
      rotation: "p' = q·p·q⁻¹",
      slerp: 'Spherical linear interpolation',
    },
    enables: ['smooth_animation', 'gimbal_lock_avoidance'],
    graphicsRelevance: 'Character animation, interpolation',
  },

  // Tier 3: Calculus
  differentiation: {
    name: 'Differentiation',
    description: 'Rates of change and local approximation',
    tier: 3,
    operations: {
      definition: "f'(x) = lim_{h→0} (f(x+h) - f(x)) / h",
      power_rule: "(xⁿ)' = n·xⁿ⁻¹",
      product_rule: "(fg)' = f'g + fg'",
      chain_rule: "(f∘g)' = f'(g)·g'",
      gradient: '∇f = (∂f/∂x, ∂f/∂y, ∂f/∂z)',
      jacobian: 'Matrix of all partial derivatives',
    },
    methods: ['surface_normals', 'lighting_calculations', 'ik_jacobian'],
    enables: ['optimization', 'differential_equations'],
    graphicsRelevance: 'Shading, animation, constraint solving',
  },
  integration: {
    name: 'Integration',
    description: 'Accumulation and area calculation',
    tier: 3,
    operations: {
      definition: '∫f(x)dx = F(x) + C',
      double_integral: '∫∫_R f(x,y) dA',
      triple_integral: '∫∫∫_V f(x,y,z) dV',
      line_integral: '∫_C f ds',
      surface_integral: '∫∫_S f dS',
    },
    methods: ['light_transport', 'volume_calculations', 'area_calculations'],
    enables: ['vector_calculus', 'monte_carlo'],
    graphicsRelevance: 'Rendering equations, photon mapping',
  },
  vector_calculus: {
    name: 'Vector Calculus',
    description: 'Calculus of vector fields',
    tier: 3,
    operations: {
      gradient: '∇f (scalar → vector, steepest ascent)',
      divergence: '∇·F (vector → scalar, spreading)',
      curl: '∇×F (vector → vector, rotation)',
      laplacian: '∇²f (second-order curvature)',
    },
    methods: ['fluid_simulation', 'heat_conduction', 'mesh_smoothing'],
    enables: ['pde_solvers', 'fluid_dynamics'],
    graphicsRelevance: 'Simulation, smoothing, deformation',
  },

  // Tier 4: Differential Equations
  ordinary_differential_equations: {
    name: 'Ordinary Differential Equations',
    description: 'Equations with function and derivatives',
    tier: 4,
    operations: {
      first_order: "y' = f(y, t)",
      second_order: "y'' = f(y, y', t)",
      exponential_decay: 'dy/dt = -ky',
      harmonic_oscillator: 'd²y/dt² = -ky',
    },
    enables: ['animation', 'physics_simulation'],
    graphicsRelevance: 'Particle motion, cloth sim, rigid body',
  },
  partial_differential_equations: {
    name: 'Partial Differential Equations',
    description: 'Equations with multiple variables',
    tier: 4,
    operations: {
      heat: '∂u/∂t = D∇²u',
      wave: '∂²u/∂t² = c²∇²u',
      laplace: '∇²u = 0',
      advection: '∂u/∂t + v·∇u = 0',
    },
    enables: ['fluid_sim', 'smoke_sim', 'cloth_sim'],
    graphicsRelevance: 'Dynamic simulation',
  },

  // Tier 5: Numerical
  numerical_differentiation: {
    name: 'Numerical Differentiation',
    description: 'Approximate derivatives from samples',
    tier: 5,
    operations: {
      forward: "f'(x) ≈ (f(x+h) - f(x))/h",
      backward: "f'(x) ≈ (f(x) - f(x-h))/h",
      central: "f'(x) ≈ (f(x+h) - f(x-h))/(2h)",
    },
    enables: ['finite_difference_methods'],
    graphicsRelevance: 'Discrete derivatives in simulations',
  },
  numerical_integration: {
    name: 'Numerical Integration',
    description: 'Approximate integrals via summation',
    tier: 5,
    operations: {
      rectangular: '∫f ≈ Σ f(xᵢ)Δx',
      trapezoidal: '∫f ≈ Σ (f(xᵢ) + f(xᵢ₊₁))/2 · Δx',
      monte_carlo: '∫f ≈ (V/N) · Σ f(random)',
    },
    enables: ['monte_carlo_methods'],
    graphicsRelevance: 'Path tracing, area lights',
  },
  linear_system_solvers: {
    name: 'Linear System Solvers',
    description: 'Solve Ax = b',
    tier: 5,
    methods: ['gaussian_elimination', 'lu_decomposition', 'cholesky', 'jacobi', 'gauss_seidel', 'conjugate_gradient'],
    enables: ['finite_difference_methods'],
    graphicsRelevance: 'Poisson solve, cloth constraints',
  },
  time_integration: {
    name: 'Time Integration',
    description: 'Solve dy/dt = f(y,t)',
    tier: 5,
    operations: {
      forward_euler: 'y_{n+1} = y_n + dt·f(y_n)',
      rk4: '4th-order Runge-Kutta',
      backward_euler: 'y_{n+1} = y_n + dt·f(y_{n+1})',
    },
    enables: ['physics_simulation'],
    graphicsRelevance: 'Particle animation, cloth, rigid body',
  },
  finite_difference_methods: {
    name: 'Finite Difference Methods',
    description: 'Discretize PDEs on grids',
    tier: 5,
    operations: {
      approach: 'Replace ∂/∂t with (u_{n+1} - u_n)/dt',
    },
    methods: ['explicit', 'implicit', 'semi_implicit'],
    enables: ['fluid_sim', 'smoke_sim'],
    graphicsRelevance: 'Fluid simulation, smoke, elastic',
  },

  // Tier 6: Optimization
  optimization: {
    name: 'Optimization',
    description: 'Find x minimizing/maximizing f(x)',
    tier: 6,
    operations: {
      gradient_descent: 'x_{n+1} = x_n - α∇f(x_n)',
      newton: 'x_{n+1} = x_n - [∇²f]⁻¹∇f(x_n)',
    },
    methods: ['quasi_newton', 'lagrange_multipliers', 'penalty_methods'],
    enables: ['inverse_kinematics', 'curve_fitting'],
    graphicsRelevance: 'IK, curve fitting, shape fitting',
  },
  least_squares_fitting: {
    name: 'Least Squares Fitting',
    description: 'Fit model to data minimizing error',
    tier: 6,
    operations: {
      normal_equations: 'A^T A x = A^T b',
    },
    methods: ['linear_regression', 'curve_fitting', 'mesh_decimation'],
    enables: [],
    graphicsRelevance: 'Curve fitting, mesh decimation',
  },
  monte_carlo_methods: {
    name: 'Monte Carlo Methods',
    description: 'Use random sampling to approximate integrals',
    tier: 6,
    methods: ['importance_sampling', 'stratified_sampling', 'quasi_monte_carlo'],
    enables: ['path_tracing', 'photon_mapping'],
    graphicsRelevance: 'Path tracing, photon mapping',
  },
};

export const GRAPHICS_OPERATIONS: GraphicsOperation[] = [
  // Modeling
  {
    category: 'modeling',
    operation: 'Parametric Surface',
    mathRequired: ['analytic_geometry', 'trigonometry', 'parametric_equations'],
    equation: 'S(u,v) = (x(u,v), y(u,v), z(u,v))',
  },
  {
    category: 'modeling',
    operation: 'Mesh Transform (Affine)',
    mathRequired: ['linear_algebra'],
    equation: "p' = T · p",
  },
  {
    category: 'modeling',
    operation: 'Skeletal Skinning',
    mathRequired: ['linear_algebra'],
    equation: "v' = Σᵢ wᵢ(B_i · v)",
  },

  // Animation
  {
    category: 'animation',
    operation: 'Forward Kinematics',
    mathRequired: ['linear_algebra'],
    equation: 'p_end = T₁ · T₂ · ... · Tₙ · p_base',
  },
  {
    category: 'animation',
    operation: 'Inverse Kinematics',
    mathRequired: ['optimization', 'differentiation', 'linear_system_solvers'],
    methods: ['jacobian_transpose', 'ccd', 'svd'],
  },
  {
    category: 'animation',
    operation: 'Particle Physics',
    mathRequired: ['ordinary_differential_equations', 'time_integration'],
    equation: 'm·a = F',
  },
  {
    category: 'animation',
    operation: 'Cloth Simulation',
    mathRequired: ['partial_differential_equations', 'finite_difference_methods', 'linear_system_solvers'],
  },

  // Rendering
  {
    category: 'rendering',
    operation: 'Vertex Projection',
    mathRequired: ['linear_algebra', 'trigonometry'],
    equation: 'p_screen = P · V · M · p_local',
  },
  {
    category: 'rendering',
    operation: 'Ray Casting',
    mathRequired: ['analytic_geometry', 'linear_algebra'],
    equation: 'ray(t) = origin + t · direction',
  },
  {
    category: 'rendering',
    operation: 'Ray Tracing (Rendering Equation)',
    mathRequired: ['vector_calculus', 'integration', 'monte_carlo_methods'],
    equation: 'L_o = L_e + ∫ f_r · L_i · (ω_i·n) dω_i',
  },
  {
    category: 'rendering',
    operation: 'Normal Mapping',
    mathRequired: ['differentiation', 'linear_algebra'],
  },
  {
    category: 'rendering',
    operation: 'Phong Lighting',
    mathRequired: ['linear_algebra', 'trigonometry'],
    equation: 'I = I_a + I_d·(N·L) + I_s·(R·V)ⁿ',
  },

  // Simulation
  {
    category: 'simulation',
    operation: 'Fluid Simulation',
    mathRequired: ['partial_differential_equations', 'vector_calculus', 'finite_difference_methods'],
  },
  {
    category: 'simulation',
    operation: 'Smoke Simulation',
    mathRequired: ['partial_differential_equations', 'finite_difference_methods'],
  },
];

// Helper functions
export function getTopicsByTier(tier: number): MathTopic[] {
  return Object.values(MATH_TOPICS).filter(topic => topic.tier === tier);
}

export function getTopicDependencies(topicKey: string): string[] {
  const topic = MATH_TOPICS[topicKey];
  if (!topic) return [];

  // Find topics that this one enables
  return topic.enables || [];
}

export function getTopicPrerequisites(topicKey: string): string[] {
  // Find topics that enable this one
  const prereqs: string[] = [];
  Object.entries(MATH_TOPICS).forEach(([key, topic]) => {
    if (topic.enables?.includes(topicKey)) {
      prereqs.push(key);
    }
  });
  return prereqs;
}

export function getGraphicsOperationsForTopic(topicKey: string): GraphicsOperation[] {
  return GRAPHICS_OPERATIONS.filter(op => op.mathRequired.includes(topicKey));
}

export function getMathRequiredForOperation(operationName: string): string[] {
  const op = GRAPHICS_OPERATIONS.find(o => o.operation === operationName);
  return op?.mathRequired || [];
}

export function buildDependencyChain(fromTopic: string, toTopic: string): string[][] {
  // BFS to find all paths from fromTopic to toTopic
  const paths: string[][] = [];
  const queue: string[][] = [[fromTopic]];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const path = queue.shift();
    if (!path) continue;
    const current = path[path.length - 1];
    if (!current) continue;

    if (current === toTopic) {
      paths.push(path);
      continue;
    }

    if (visited.has(current)) continue;
    visited.add(current);

    const topic = MATH_TOPICS[current];
    if (topic?.enables) {
      for (const nextTopic of topic.enables) {
        if (!path.includes(nextTopic)) {
          queue.push([...path, nextTopic]);
        }
      }
    }
  }

  return paths;
}
