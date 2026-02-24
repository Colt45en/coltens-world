# Hardened Statistics & Probability Engine

Location: `packages/mathstats/`

## Overview

Production-grade statistics and probability library with:
- **Correct special functions** (regularized incomplete beta, regularized gamma)
- **Deterministic RNG injection** (reproducible random streams via seed)
- **Robust error handling** (no crashes on edge cases)
- **Pure Python** (no SciPy dependency; Numerical Recipes algorithms)
- **Type-safe** (full type annotations, `py.typed` marker)

## Module Structure

```
packages/mathstats/
├── __init__.py                         # Public API exports
├── py.typed                            # Type checker marker
├── stats_probability_engine.py         # Core implementation (600+ lines)
└── test_stats_probability_engine.py    # Comprehensive test suite (13 tests)
```

## API Surface

### 1. Statistics

Core descriptive statistics for data analysis.

```python
from packages.mathstats import Statistics

data = [1.5, 2.0, 2.5, 3.0, 4.0]

Statistics.mean(data)              # → 2.6
Statistics.median(data)            # → 2.5
Statistics.mode(data, tolerance=0.01)  # → [value with max frequency]
Statistics.variance(data)          # Sample variance
Statistics.std_dev(data)           # Sample standard deviation
Statistics.percentile(data, 75)    # 75th percentile
Statistics.quartiles(data)         # → (Q1, Q2, Q3)
Statistics.iqr(data)               # Interquartile range
Statistics.skewness(data)          # Skewness coefficient
Statistics.kurtosis(data)          # Excess kurtosis
Statistics.covariance(x, y)        # Between two arrays
Statistics.correlation(x, y)       # Pearson correlation
Statistics.linear_regression(x, y) # → (slope, intercept, r²)
```

**Error Handling:**
- Empty data → `ValueError` with descriptive message
- Invalid percentiles (p < 0 or p > 100) → `ValueError`
- Single point for sample variance → `ValueError`
- Constant x values for regression → `ValueError`

### 2. ProbabilityDistributions

Standard probability distributions (PDF/CDF).

```python
from packages.mathstats import ProbabilityDistributions as D

# Normal distribution
D.normal_pdf(x, mu=0.0, sigma=1.0)
D.normal_cdf(x, mu=0.0, sigma=1.0)

# Exponential distribution
D.exponential_pdf(x, lambd=1.0)
D.exponential_cdf(x, lambd=1.0)

# Poisson (PMF)
D.poisson_pmf(k, lambd)

# Binomial (PMF)
D.binomial_pmf(k, n, p)

# Uniform distribution
D.uniform_pdf(x, a=0.0, b=1.0)

# Gamma distribution
D.gamma_pdf(x, alpha, beta=1.0)

# Chi-squared distribution
D.chi_squared_pdf(x, df)

# t-distribution
D.t_distribution_pdf(x, df)
```

### 3. HypothesisTesting

Statistical tests and special functions for p-values.

```python
from packages.mathstats import HypothesisTesting as HT

# CDF functions (for p-value computation)
HT.t_cdf(t, df)           # t-distribution CDF
HT.chi2_cdf(chi2, df)     # Chi-squared CDF
HT.chi2_sf(chi2, df)      # Chi-squared survival function (1 - CDF)

# Hypothesis tests
t_stat, p_val = HT.t_test_one_sample(
    data=[2.1, 2.0, 1.9, 2.2, 1.8],
    population_mean=2.0,
    alternative="two-sided"  # or "greater", "less"
)

z_stat, p_val = HT.z_test_one_sample(
    sample_mean=100.5,
    population_mean=100.0,
    population_std=15.0,
    n=50,
    alternative="two-sided"
)

chi2, p_val = HT.chi_squared_goodness_of_fit(
    observed=[10, 15, 20, 25],
    expected=[15, 15, 15, 15]
)
```

### 4. RandomGenerator

Deterministic random number generation with seed injection.

```python
from packages.mathstats import RandomGenerator
import random

# Create deterministic RNG with seed
rng = random.Random(42)

# Normal distribution (Box-Muller transform)
RandomGenerator.normal(mu=0.0, sigma=1.0, size=10, rng=rng)

# Exponential distribution
RandomGenerator.exponential(lambd=1.0, size=10, rng=rng)

# Poisson distribution (Knuth algorithm for small λ, normal approx for large λ)
RandomGenerator.poisson(lambd=5.0, size=10, rng=rng)

# Binomial distribution
RandomGenerator.binomial(n=10, p=0.5, size=10, rng=rng)

# Without RNG (uses global random module)
RandomGenerator.normal(size=1)  # → single float
RandomGenerator.poisson(lambd=2.0, size=5)  # → list of 5 integers
```

**Determinism:**
Same seed produces identical sequence:
```python
rng1 = random.Random(123)
rng2 = random.Random(123)
assert RandomGenerator.normal(size=5, rng=rng1) == RandomGenerator.normal(size=5, rng=rng2)
```

## Key Correctness Improvements

### 1. Special Functions (Numerical Recipes)

**Beta Function: `reg_incomplete_beta(x, a, b)`**
- Computes regularized incomplete beta: $I_x(a,b) = \frac{B_x(a,b)}{B(a,b)}$
- Lentz algorithm for continued fractions (stable convergence)
- Uses symmetry: if $x > \frac{a+1}{a+b+2}$, compute from complementary side
- Range: $[0, 1]$ guaranteed

**Gamma Functions: `reg_lower_gamma(a, x)`, `reg_upper_gamma(a, x)`**
- Lower: $P(a,x) = \frac{\gamma(a,x)}{\Gamma(a)}$ (series expansion)
- Upper: $Q(a,x) = \frac{\Gamma(a,x)}{\Gamma(a)}$ (continued fraction)
- Relationship: $P(a,x) + Q(a,x) = 1$ (verified in tests)
- Numerically stable for all positive $(a, x)$

### 2. RNG Determinism

All random generators accept optional `rng: Optional[random.Random]` parameter:
```python
rng = random.Random(seed=123)  # Fixed seed
samples = RandomGenerator.normal(mu=0, sigma=1, size=100, rng=rng)
# Result is always identical for seed=123
```

### 3. Edge Case Handling

| Function | Edge Case | Behavior |
|----------|-----------|----------|
| `percentile([])` | Empty data | `ValueError("Cannot calculate percentile of empty dataset")` |
| `mode([])` | Empty data | `ValueError("Cannot calculate mode of empty dataset")` |
| `std_dev([x])` | Single point | `ValueError` if sample=True ✓ |
| `normal_pdf` | Invalid σ | `ValueError("sigma must be positive")` |
| `t_cdf` | x ≈ 0, df=2 | No division by zero (tested) |
| `poisson(0)` | λ=0 in Knuth | Returns 0 (correct) |
| `log(0)` in Box-Muller | u≈0 | Protected with `u = max(u, 1e-15)` |

## Testing (13/13 Passing ✅)

```bash
cd packages/agent-suite
python -m pytest packages/mathstats/test_stats_probability_engine.py -v
```

**Test Categories:**

| Category | Test | Purpose |
|----------|------|---------|
| **Error Handling** | `test_percentile_empty_raises` | ValueError on empty input |
| **Numeric Stability** | `test_mode_deterministic_clusters` | Floating-point clustering tolerance |
| **Distribution Properties** | `test_normal_cdf_symmetry` | CDF(μ-δ) + CDF(μ+δ) = 1 |
| | `test_t_cdf_symmetry` | t(-x, df) + t(x, df) = 1 |
| | `test_chi2_sf_monotone` | SF(x) ≥ SF(x+1) |
| **Special Functions** | `test_beta_special_function_bounds` | 0 ≤ I_x(a,b) ≤ 1 |
| | `test_gamma_special_function_bounds` | P(a,x) + Q(a,x) = 1 ✓ |
| **RNG Determinism** | `test_rng_determinism_normal` | Seed=123 reproducible |
| | `test_rng_determinism_poisson` | Identical sequence |
| **Hypothesis Testing** | `test_t_test_one_sample_computation` | 0 ≤ p ≤ 1 |
| | `test_chi_squared_goodness_of_fit` | Rejects bad fit |
| **Distribution Samples** | `test_binomial_rng_bounds` | 0 ≤ sample ≤ n |
| | `test_exponential_rng_positive` | All samples > 0 |

## Integration with Existing Codebase

### Import Location
```python
# From anywhere in the agent-suite workspace:
from packages.mathstats import Statistics, RandomGenerator, HypothesisTesting
```

### Type Checking
The module includes `py.typed` marker for full Pylance/mypy support:
```bash
mypy your_file.py --strict  # Full type checking
```

### No External Dependencies
- Uses only Python stdlib: `math`, `random`, `typing`
- Zero SciPy, NumPy, or pandas dependencies
- Faster imports, smaller footprint

## Example Workflows

### Workflow 1: A/B Test Analysis
```python
from packages.mathstats import Statistics, HypothesisTesting as HT

control = [10.2, 10.5, 10.1, 10.3, 10.4]
treatment = [10.8, 11.0, 10.9, 11.2, 10.7]

print(f"Control mean: {Statistics.mean(control):.2f}")
print(f"Treatment mean: {Statistics.mean(treatment):.2f}")

# t-test
t_stat, p_val = HT.t_test_one_sample(treatment, Statistics.mean(control))
print(f"t-statistic: {t_stat:.3f}, p-value: {p_val:.4f}")
if p_val < 0.05:
    print("✓ Significant difference detected")
```

### Workflow 2: Deterministic Sampling
```python
from packages.mathstats import RandomGenerator
import random

# Reproducible synthetic dataset generation
rng = random.Random(seed=42)
synthetic_data = RandomGenerator.normal(mu=100, sigma=15, size=1000, rng=rng)
# Same seed always produces identical data → perfect for unit tests
```

### Workflow 3: Distribution Fitting Diagnostics
```python
from packages.mathstats import HypothesisTesting as HT, Statistics

chi2, p_val = HT.chi_squared_goodness_of_fit(
    observed=[observed_count for category in data],
    expected=[expected_count for category in data]
)

if p_val > 0.05:
    print("✓ Data fits expected distribution")
else:
    print("✗ Significant deviation from expected distribution")
```

## Performance Characteristics

| Operation | Complexity | Notes |
|-----------|-----------|-------|
| `mean(), median()` | O(n) | N/A |
| `std_dev()` | O(n) | Uses accurate `math.fsum()` |
| `percentile()` | O(n log n) | Sorts input |
| `linear_regression()` | O(n) | Two-pass algorithm |
| `normal_pdf()` | O(1) | Closed-form |
| `t_cdf()` | O(1) | Beta continued fraction (fast convergence) |
| `chi2_sf()` | O(1) | Gamma continued fraction (fast convergence) |
| `RandomGenerator.normal()` | O(size) | Box-Muller, 1-2 Uniform samples per value |
| `RandomGenerator.poisson()` | O(size) with O(λ) avg | Knuth for λ<30, normal approx for λ≥30 |

## Design Philosophy

1. **Correctness over Speed**: Numerical Recipes algorithms prioritize accuracy (IEEE double precision)
2. **Determinism by Default**: RNG injection available everywhere, reproducible by seed
3. **Fail Loudly**: Edge cases raise `ValueError` with descriptive messages, never silently return wrong answers
4. **No External Dependencies**: Pure Python for maximum portability and minimal cognitive load
5. **Type Safe**: Full `Sequence`/`Iterable`/`Optional` annotations, `py.typed` marker for IDE support

## Future Extensions (Optional)

### NumPy Acceleration Layer
User offered optional NumPy variants (when performance critical, keeping identical float outputs):
```python
# Deterministic even with NumPy:
result_python = Statistics.mean(data)
result_numpy = Statistics.mean_numpy(data)  # Identical result, faster for large n
assert result_python == result_numpy
```

### Scipy Compatibility Mode
Wrapper to ensure our special functions match scipy outputs (for validation):
```python
# If scipy available:
assert abs(our_beta - scipy.special.betainc(a, b, x)) < 1e-14
```

## References

- **Numerical Recipes in C**, Press et al., 2nd ed. (Ch. 6: Gamma, Beta functions)
- **Statistical Computing**, Davies & Kennedy
- **IEEE 754 Floating Point Standard**
- **DSA**: Box-Muller transform (1958), Knuth Poisson algorithm (TAOCP Vol. 2)

## Contact & Issues

If special functions produce unexpected results:
1. Check test suite: `test_gamma_special_function_bounds`, `test_beta_special_function_bounds`
2. Compare against known reference values (e.g., Wolfram Alpha)
3. File issue with failing test case + expected value
