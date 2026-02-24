"""
Test suite for Statistics & Probability Engine:
- Correctness of special functions (beta, gamma)
- Determinism with RNG injection
- Proper error handling
"""

import random
from packages.mathstats.stats_probability_engine import (
    Statistics,
    ProbabilityDistributions,
    HypothesisTesting,
    RandomGenerator,
    _Special,
)


# =========================
# Statistics Tests
# =========================

def test_percentile_empty_raises():
    """Percentile on empty data should raise ValueError"""
    try:
        Statistics.percentile([], 50)
        assert False, "Should have raised ValueError"
    except ValueError as e:
        assert "empty" in str(e).lower()


def test_mode_deterministic_clusters():
    """Mode with duplicate values should be deterministic"""
    data1 = [1.0, 1.0, 1.001, 2.0, 2.0, 3.0]
    data2 = [1.0, 1.001, 1.0, 3.0, 2.0, 2.0]
    # both should identify [1.0, 1.001] as dominant cluster (tolerance=0.01)
    m1 = Statistics.mode(data1, tolerance=0.01)
    m2 = Statistics.mode(data2, tolerance=0.01)
    assert len(m1) == len(m2) == 1
    assert abs(m1[0] - m2[0]) < 1e-10


def test_normal_cdf_symmetry():
    """Normal CDF should be symmetric around mean"""
    mu, sigma = 5.0, 2.0
    x_left = mu - 1.5
    x_right = mu + 1.5
    cdf_left = ProbabilityDistributions.normal_cdf(x_left, mu, sigma)
    cdf_right = ProbabilityDistributions.normal_cdf(x_right, mu, sigma)
    assert abs(cdf_left + cdf_right - 1.0) < 1e-10


def test_t_cdf_symmetry():
    """T-distribution CDF should respect symmetry"""
    df = 5
    t_val = 2.0
    cdf_pos = HypothesisTesting.t_cdf(t_val, df)
    cdf_neg = HypothesisTesting.t_cdf(-t_val, df)
    assert abs(cdf_pos + cdf_neg - 1.0) < 1e-10


def test_chi2_sf_monotone():
    """Chi-square survival function should be monotone decreasing"""
    df = 4
    chi2_vals = [1.0, 2.0, 3.0, 4.0, 5.0]
    sf_vals = [HypothesisTesting.chi2_sf(x, df) for x in chi2_vals]
    for i in range(len(sf_vals) - 1):
        assert sf_vals[i] >= sf_vals[i + 1], f"SF not monotone: {sf_vals}"


def test_rng_determinism_normal():
    """Normal RNG with same seed should be deterministic"""
    rng1 = random.Random(123)
    rng2 = random.Random(123)
    samples1 = RandomGenerator.normal(mu=0, sigma=1, size=10, rng=rng1)
    samples2 = RandomGenerator.normal(mu=0, sigma=1, size=10, rng=rng2)
    for s1, s2 in zip(samples1, samples2):
        assert abs(s1 - s2) < 1e-14, f"RNG not deterministic: {s1} vs {s2}"


def test_rng_determinism_poisson():
    """Poisson RNG with same seed should be deterministic"""
    rng1 = random.Random(456)
    rng2 = random.Random(456)
    samples1 = RandomGenerator.poisson(lambd=5.0, size=10, rng=rng1)
    samples2 = RandomGenerator.poisson(lambd=5.0, size=10, rng=rng2)
    assert samples1 == samples2, f"Poisson RNG not deterministic: {samples1} vs {samples2}"


def test_beta_special_function_bounds():
    """Regularized incomplete beta should always be in [0,1]"""
    test_cases = [
        (2.0, 3.0, 0.3),
        (5.0, 5.0, 0.5),
        (0.5, 2.0, 0.7),
        (10.0, 1.0, 0.2),
    ]
    for a, b, x in test_cases:
        result = _Special.reg_incomplete_beta(x, a, b)
        assert 0.0 <= result <= 1.0, f"Beta out of bounds: {result} for a={a}, b={b}, x={x}"
        # monotonicity: increasing in x
        if x > 0.1:
            result_left = _Special.reg_incomplete_beta(x - 0.1, a, b)
            assert result_left <= result, "Beta not monotone in x"


def test_gamma_special_function_bounds():
    """Regularized incomplete gamma should always be in [0,1]"""
    test_cases = [
        (2.0, 1.0),
        (5.0, 3.0),
        (0.5, 0.2),
        (10.0, 5.0),
    ]
    for a, x in test_cases:
        p = _Special.reg_lower_gamma(a, x)
        q = _Special.reg_upper_gamma(a, x)
        assert 0.0 <= p <= 1.0, f"Lower gamma out of bounds: {p}"
        assert 0.0 <= q <= 1.0, f"Upper gamma out of bounds: {q}"
        assert abs(p + q - 1.0) < 1e-10, f"P + Q should equal 1: {p} + {q} = {p+q}"


def test_t_test_one_sample_computation():
    """T-test should compute correct statistic"""
    data = [2.1, 2.0, 1.9, 2.2, 1.8]
    t_stat, p_val = HypothesisTesting.t_test_one_sample(data, population_mean=2.0)
    assert 0 <= p_val <= 1, f"P-value out of bounds: {p_val}"
    # manually: mean=2.0, std≈0.132, n=5, t = (2.0-2.0)/(0.132/sqrt(5)) ≈ 0
    assert abs(t_stat) < 1.0, f"T-statistic unexpectedly large: {t_stat}"


def test_chi_squared_goodness_of_fit():
    """Chi-squared test with bad fit should reject"""
    observed = [10, 10, 1, 1]
    expected = [5.5, 5.5, 5.5, 5.5]
    chi2, p_val = HypothesisTesting.chi_squared_goodness_of_fit(observed, expected)
    assert p_val < 0.05, f"Expected to reject H0 (uniform), got p={p_val}"


def test_binomial_rng_bounds():
    """Binomial RNG should respect [0,n] bounds"""
    samples = RandomGenerator.binomial(n=10, p=0.5, size=100)
    assert all(0 <= s <= 10 for s in samples), f"Binomial samples out of bounds: {samples}"


def test_exponential_rng_positive():
    """Exponential RNG should always be positive"""
    samples = RandomGenerator.exponential(lambd=1.0, size=100)
    assert all(s > 0 for s in samples), f"Exponential samples not positive: {samples}"


if __name__ == "__main__":
    import sys

    tests = [
        test_percentile_empty_raises,
        test_mode_deterministic_clusters,
        test_normal_cdf_symmetry,
        test_t_cdf_symmetry,
        test_chi2_sf_monotone,
        test_rng_determinism_normal,
        test_rng_determinism_poisson,
        test_beta_special_function_bounds,
        test_gamma_special_function_bounds,
        test_t_test_one_sample_computation,
        test_chi_squared_goodness_of_fit,
        test_binomial_rng_bounds,
        test_exponential_rng_positive,
    ]

    passed = 0
    failed = 0
    for test in tests:
        try:
            test()
            print(f"✓ {test.__name__}")
            passed += 1
        except Exception as e:
            print(f"✗ {test.__name__}: {e}")
            failed += 1

    print(f"\n{passed} passed, {failed} failed")
    sys.exit(0 if failed == 0 else 1)
