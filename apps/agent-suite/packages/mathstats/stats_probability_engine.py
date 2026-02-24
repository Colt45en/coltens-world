"""
Statistics & Probability Engine (Hardened)
- Deterministic numeric behavior where possible
- Correct special functions for t/chi-square p-values (no SciPy)
- RNG injection for reproducible random streams
"""

from __future__ import annotations

import math
import random
from typing import Iterable, List, Sequence, Tuple, Optional, Union, Literal


# =========================
# Core numeric helpers
# =========================

def _fsum(xs: Iterable[float]) -> float:
    return math.fsum(xs)


def _clamp_int(v: int, lo: int, hi: int) -> int:
    return lo if v < lo else hi if v > hi else v


# =========================
# Statistics
# =========================

class Statistics:
    """Comprehensive statistics engine for data analysis."""

    @staticmethod
    def mean(data: Sequence[float]) -> float:
        if not data:
            raise ValueError("Cannot calculate mean of empty dataset")
        return _fsum(data) / len(data)

    @staticmethod
    def median(data: Sequence[float]) -> float:
        if not data:
            raise ValueError("Cannot calculate median of empty dataset")
        s = sorted(data)
        n = len(s)
        mid = n // 2
        if n % 2 == 0:
            return (s[mid - 1] + s[mid]) / 2.0
        return s[mid]

    @staticmethod
    def mode(data: Sequence[float], tolerance: float = 1e-10) -> List[float]:
        """
        Float-tolerant mode via deterministic clustering:
        - sort data
        - cluster adjacent values within tolerance
        - return mean of cluster(s) with max size
        """
        if not data:
            raise ValueError("Cannot calculate mode of empty dataset")
        if tolerance < 0:
            raise ValueError("tolerance must be >= 0")

        s = sorted(float(x) for x in data)
        clusters: List[List[float]] = []
        cur: List[float] = [s[0]]

        for v in s[1:]:
            if abs(v - cur[-1]) <= tolerance:
                cur.append(v)
            else:
                clusters.append(cur)
                cur = [v]
        clusters.append(cur)

        max_len = max(len(c) for c in clusters)
        return [Statistics.mean(c) for c in clusters if len(c) == max_len]

    @staticmethod
    def variance(data: Sequence[float], sample: bool = True) -> float:
        if not data:
            raise ValueError("Cannot calculate variance of empty dataset")
        n = len(data)
        if n == 1 and sample:
            raise ValueError("Cannot calculate sample variance with single data point")

        mu = Statistics.mean(data)
        ss = _fsum((x - mu) ** 2 for x in data)
        denom = (n - 1) if sample else n
        return ss / denom

    @staticmethod
    def std_dev(data: Sequence[float], sample: bool = True) -> float:
        return math.sqrt(Statistics.variance(data, sample))

    @staticmethod
    def skewness(data: Sequence[float]) -> float:
        if len(data) < 3:
            raise ValueError("Need at least 3 data points for skewness")
        mu = Statistics.mean(data)
        sigma = Statistics.std_dev(data, sample=False)
        if sigma == 0:
            return 0.0
        m3 = _fsum((x - mu) ** 3 for x in data) / len(data)
        return m3 / (sigma ** 3)

    @staticmethod
    def kurtosis(data: Sequence[float]) -> float:
        if len(data) < 4:
            raise ValueError("Need at least 4 data points for kurtosis")
        mu = Statistics.mean(data)
        sigma = Statistics.std_dev(data, sample=False)
        if sigma == 0:
            return 0.0
        m4 = _fsum((x - mu) ** 4 for x in data) / len(data)
        return (m4 / (sigma ** 4)) - 3.0

    @staticmethod
    def percentile(data: Sequence[float], p: float) -> float:
        if not data:
            raise ValueError("Cannot calculate percentile of empty dataset")
        if not (0.0 <= p <= 100.0):
            raise ValueError("Percentile must be between 0 and 100")

        s = sorted(data)
        n = len(s)
        if p == 0:
            return s[0]
        if p == 100:
            return s[-1]

        idx = (p / 100.0) * (n - 1)
        lo = int(idx)
        hi = min(lo + 1, n - 1)
        if lo == hi:
            return s[lo]
        w = idx - lo
        return s[lo] * (1.0 - w) + s[hi] * w

    @staticmethod
    def quartiles(data: Sequence[float]) -> Tuple[float, float, float]:
        return (
            Statistics.percentile(data, 25),
            Statistics.percentile(data, 50),
            Statistics.percentile(data, 75),
        )

    @staticmethod
    def iqr(data: Sequence[float]) -> float:
        q1, _, q3 = Statistics.quartiles(data)
        return q3 - q1

    @staticmethod
    def covariance(x: Sequence[float], y: Sequence[float], sample: bool = True) -> float:
        if len(x) != len(y):
            raise ValueError("Arrays must have same length")
        if not x:
            raise ValueError("Cannot calculate covariance of empty arrays")

        mx = Statistics.mean(x)
        my = Statistics.mean(y)
        ss = _fsum((xi - mx) * (yi - my) for xi, yi in zip(x, y))
        denom = (len(x) - 1) if sample else len(x)
        return ss / denom

    @staticmethod
    def correlation(x: Sequence[float], y: Sequence[float]) -> float:
        if len(x) != len(y):
            raise ValueError("Arrays must have same length")
        sx = Statistics.std_dev(x, sample=False)
        sy = Statistics.std_dev(y, sample=False)
        if sx == 0 or sy == 0:
            return 0.0
        cov = Statistics.covariance(x, y, sample=False)
        return cov / (sx * sy)

    @staticmethod
    def linear_regression(x: Sequence[float], y: Sequence[float]) -> Tuple[float, float, float]:
        if len(x) != len(y):
            raise ValueError("Arrays must have same length")
        if len(x) < 2:
            raise ValueError("Need at least 2 data points for regression")

        n = len(x)
        sx = _fsum(x)
        sy = _fsum(y)
        sxy = _fsum(xi * yi for xi, yi in zip(x, y))
        sx2 = _fsum(xi * xi for xi in x)

        denom = n * sx2 - sx * sx
        if denom == 0:
            raise ValueError("Cannot perform regression: x values are constant")

        slope = (n * sxy - sx * sy) / denom
        intercept = (sy - slope * sx) / n

        y_mean = sy / n
        ss_tot = _fsum((yi - y_mean) ** 2 for yi in y)
        ss_res = _fsum((yi - (slope * xi + intercept)) ** 2 for xi, yi in zip(x, y))
        r2 = 1.0 - (ss_res / ss_tot) if ss_tot != 0 else 0.0

        return slope, intercept, r2


# =========================
# Special functions (correct)
# =========================

class _Special:
    """
    Numerical Recipes style implementations:
    - Regularized incomplete beta I_x(a,b)
    - Regularized gamma P(a,x) and Q(a,x)
    """

    @staticmethod
    def _betacf(a: float, b: float, x: float) -> float:
        MAXIT = 200
        EPS = 3e-14
        FPMIN = 1e-30

        qab = a + b
        qap = a + 1.0
        qam = a - 1.0

        c = 1.0
        d = 1.0 - qab * x / qap
        if abs(d) < FPMIN:
            d = FPMIN
        d = 1.0 / d
        h = d

        for m in range(1, MAXIT + 1):
            m2 = 2 * m

            aa = m * (b - m) * x / ((qam + m2) * (a + m2))
            d = 1.0 + aa * d
            if abs(d) < FPMIN:
                d = FPMIN
            c = 1.0 + aa / c
            if abs(c) < FPMIN:
                c = FPMIN
            d = 1.0 / d
            h *= d * c

            aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
            d = 1.0 + aa * d
            if abs(d) < FPMIN:
                d = FPMIN
            c = 1.0 + aa / c
            if abs(c) < FPMIN:
                c = FPMIN
            d = 1.0 / d
            delta = d * c
            h *= delta

            if abs(delta - 1.0) < EPS:
                break

        return h

    @staticmethod
    def reg_incomplete_beta(x: float, a: float, b: float) -> float:
        if a <= 0 or b <= 0:
            raise ValueError("a and b must be positive")
        if x <= 0:
            return 0.0
        if x >= 1:
            return 1.0

        # bt = exp(lgamma(a+b)-lgamma(a)-lgamma(b) + a ln x + b ln(1-x))
        bt = math.exp(
            math.lgamma(a + b) - math.lgamma(a) - math.lgamma(b)
            + a * math.log(x) + b * math.log(1.0 - x)
        )

        # Use symmetry for stability
        if x < (a + 1.0) / (a + b + 2.0):
            return bt * _Special._betacf(a, b, x) / a
        else:
            return 1.0 - bt * _Special._betacf(b, a, 1.0 - x) / b

    @staticmethod
    def reg_lower_gamma(a: float, x: float) -> float:
        """P(a,x) = γ(a,x)/Γ(a)"""
        if a <= 0:
            raise ValueError("a must be positive")
        if x <= 0:
            return 0.0

        ITMAX = 200
        EPS = 3e-14
        gln = math.lgamma(a)

        if x < a + 1.0:
            ap = a
            summ = 1.0 / a
            delt = summ
            for _ in range(ITMAX):
                ap += 1.0
                delt *= x / ap
                summ += delt
                if abs(delt) < abs(summ) * EPS:
                    break
            return summ * math.exp(-x + a * math.log(x) - gln)
        else:
            return 1.0 - _Special.reg_upper_gamma(a, x)

    @staticmethod
    def reg_upper_gamma(a: float, x: float) -> float:
        """Q(a,x) = Γ(a,x)/Γ(a)"""
        if a <= 0:
            raise ValueError("a must be positive")
        if x <= 0:
            return 1.0

        # For numerical stability: if x < a, use complementary relationship
        # Q(a,x) = 1 - P(a,x)
        if x < a + 1.0:
            return 1.0 - _Special.reg_lower_gamma(a, x)

        ITMAX = 200
        EPS = 3e-14
        FPMIN = 1e-30
        gln = math.lgamma(a)

        b = x + 1.0 - a
        c = 1.0 / FPMIN
        d = 1.0 / b
        h = d

        for i in range(1, ITMAX + 1):
            an = -i * (i - a)
            b += 2.0
            d = an * d + b
            if abs(d) < FPMIN:
                d = FPMIN
            c = b + an / c
            if abs(c) < FPMIN:
                c = FPMIN
            d = 1.0 / d
            delta = d * c
            h *= delta
            if abs(delta - 1.0) < EPS:
                break

        return math.exp(-x + a * math.log(x) - gln) * h


# =========================
# Distributions
# =========================

class ProbabilityDistributions:
    @staticmethod
    def normal_pdf(x: float, mu: float = 0.0, sigma: float = 1.0) -> float:
        if sigma <= 0:
            raise ValueError("sigma must be positive")
        z = (x - mu) / sigma
        return math.exp(-0.5 * z * z) / (sigma * math.sqrt(2.0 * math.pi))

    @staticmethod
    def normal_cdf(x: float, mu: float = 0.0, sigma: float = 1.0) -> float:
        if sigma <= 0:
            raise ValueError("sigma must be positive")
        z = (x - mu) / sigma
        # Prefer built-in erf for accuracy
        return 0.5 * (1.0 + math.erf(z / math.sqrt(2.0)))

    @staticmethod
    def exponential_pdf(x: float, lambd: float = 1.0) -> float:
        if lambd <= 0:
            raise ValueError("lambda must be positive")
        if x < 0:
            return 0.0
        return lambd * math.exp(-lambd * x)

    @staticmethod
    def exponential_cdf(x: float, lambd: float = 1.0) -> float:
        if lambd <= 0:
            raise ValueError("lambda must be positive")
        if x < 0:
            return 0.0
        return 1.0 - math.exp(-lambd * x)

    @staticmethod
    def poisson_pmf(k: int, lambd: float) -> float:
        if lambd <= 0:
            raise ValueError("lambda must be positive")
        if k < 0:
            return 0.0
        return math.exp(-lambd) * (lambd ** k) / math.factorial(k)

    @staticmethod
    def binomial_pmf(k: int, n: int, p: float) -> float:
        if not (0.0 <= p <= 1.0):
            raise ValueError("p must be in [0,1]")
        if n < 0:
            raise ValueError("n must be >= 0")
        if k < 0 or k > n:
            return 0.0
        # Use comb for stability and speed
        return math.comb(n, k) * (p ** k) * ((1.0 - p) ** (n - k))

    @staticmethod
    def uniform_pdf(x: float, a: float = 0.0, b: float = 1.0) -> float:
        if b <= a:
            raise ValueError("b must be > a")
        return (1.0 / (b - a)) if (a <= x <= b) else 0.0

    @staticmethod
    def gamma_pdf(x: float, alpha: float, beta: float = 1.0) -> float:
        if alpha <= 0 or beta <= 0:
            raise ValueError("alpha and beta must be positive")
        if x < 0:
            return 0.0
        return (beta ** alpha / math.gamma(alpha)) * (x ** (alpha - 1.0)) * math.exp(-beta * x)

    @staticmethod
    def chi_squared_pdf(x: float, df: int) -> float:
        if df <= 0:
            raise ValueError("df must be positive")
        if x < 0:
            return 0.0
        # Chi^2(df) = Gamma(k=df/2, rate=1/2)
        return ProbabilityDistributions.gamma_pdf(x, df / 2.0, 0.5)

    @staticmethod
    def t_distribution_pdf(x: float, df: int) -> float:
        if df <= 0:
            raise ValueError("df must be positive")
        num = math.gamma((df + 1.0) / 2.0)
        den = math.sqrt(df * math.pi) * math.gamma(df / 2.0)
        return (num / den) * (1.0 + (x * x) / df) ** (-(df + 1.0) / 2.0)


# =========================
# Hypothesis Testing (correct p-values)
# =========================

class HypothesisTesting:
    @staticmethod
    def t_cdf(t: float, df: int) -> float:
        if df <= 0:
            raise ValueError("df must be positive")
        # for df large, normal approx is fine but this works for all df
        a = df / 2.0
        b = 0.5
        x = df / (df + t * t)
        ib = _Special.reg_incomplete_beta(x, a, b)
        if t >= 0:
            return 1.0 - 0.5 * ib
        return 0.5 * ib

    @staticmethod
    def chi2_cdf(chi2: float, df: int) -> float:
        if df <= 0:
            raise ValueError("df must be positive")
        if chi2 <= 0:
            return 0.0
        return _Special.reg_lower_gamma(df / 2.0, chi2 / 2.0)

    @staticmethod
    def chi2_sf(chi2: float, df: int) -> float:
        if df <= 0:
            raise ValueError("df must be positive")
        if chi2 <= 0:
            return 1.0
        return _Special.reg_upper_gamma(df / 2.0, chi2 / 2.0)

    @staticmethod
    def z_test_one_sample(sample_mean: float, population_mean: float,
                          population_std: float, n: int,
                          alternative: Literal["two-sided", "greater", "less"] = "two-sided") -> Tuple[float, float]:
        if population_std <= 0:
            raise ValueError("population_std must be positive")
        if n <= 0:
            raise ValueError("n must be positive")

        z = (sample_mean - population_mean) / (population_std / math.sqrt(n))

        if alternative == "two-sided":
            p = 2.0 * (1.0 - ProbabilityDistributions.normal_cdf(abs(z)))
        elif alternative == "greater":
            p = 1.0 - ProbabilityDistributions.normal_cdf(z)
        elif alternative == "less":
            p = ProbabilityDistributions.normal_cdf(z)
        else:
            raise ValueError("alternative must be 'two-sided', 'greater', or 'less'")

        return z, p

    @staticmethod
    def t_test_one_sample(data: Sequence[float], population_mean: float,
                          alternative: Literal["two-sided", "greater", "less"] = "two-sided") -> Tuple[float, float]:
        if len(data) < 2:
            raise ValueError("Need at least 2 points for t-test")

        xbar = Statistics.mean(data)
        s = Statistics.std_dev(data, sample=True)
        n = len(data)
        df = n - 1
        t = (xbar - population_mean) / (s / math.sqrt(n))

        cdf = HypothesisTesting.t_cdf(t, df)
        if alternative == "two-sided":
            p = 2.0 * min(cdf, 1.0 - cdf)
        elif alternative == "greater":
            p = 1.0 - cdf
        elif alternative == "less":
            p = cdf
        else:
            raise ValueError("alternative must be 'two-sided', 'greater', or 'less'")

        return t, p

    @staticmethod
    def chi_squared_goodness_of_fit(observed: Sequence[int], expected: Sequence[float]) -> Tuple[float, float]:
        if len(observed) != len(expected):
            raise ValueError("observed and expected must have same length")
        if len(observed) < 2:
            raise ValueError("need at least 2 categories")

        chi2 = 0.0
        for o, e in zip(observed, expected):
            if e <= 0:
                raise ValueError("expected frequencies must be > 0")
            chi2 += (o - e) ** 2 / e

        df = len(observed) - 1
        p = HypothesisTesting.chi2_sf(chi2, df)
        return chi2, p


# =========================
# Deterministic RNG
# =========================

class RandomGenerator:
    """
    RNG injection for determinism:
      rng = random.Random(seed)
      RandomGenerator.normal(..., rng=rng)
    """

    @staticmethod
    def normal(mu: float = 0.0, sigma: float = 1.0, size: int = 1,
               rng: Optional[random.Random] = None) -> Union[float, List[float]]:
        if sigma <= 0:
            raise ValueError("sigma must be positive")
        if size <= 0:
            raise ValueError("size must be positive")

        r = rng or random
        out: List[float] = []

        while len(out) < size:
            u1 = r.random()
            u2 = r.random()
            # protect against log(0)
            u1 = max(u1, 1e-15)
            mag = math.sqrt(-2.0 * math.log(u1))
            z1 = mag * math.cos(2.0 * math.pi * u2)
            z2 = mag * math.sin(2.0 * math.pi * u2)
            out.append(mu + sigma * z1)
            if len(out) < size:
                out.append(mu + sigma * z2)

        return out[0] if size == 1 else out

    @staticmethod
    def exponential(lambd: float = 1.0, size: int = 1,
                    rng: Optional[random.Random] = None) -> Union[float, List[float]]:
        if lambd <= 0:
            raise ValueError("lambda must be positive")
        if size <= 0:
            raise ValueError("size must be positive")

        r = rng or random
        out = []
        for _ in range(size):
            u = r.random()
            u = min(max(u, 1e-15), 1.0 - 1e-15)
            out.append(-math.log(1.0 - u) / lambd)
        return out[0] if size == 1 else out

    @staticmethod
    def poisson(lambd: float, size: int = 1,
                rng: Optional[random.Random] = None) -> Union[int, List[int]]:
        """
        Knuth exact for small lambda; normal approx fallback for larger lambda.
        """
        if lambd <= 0:
            raise ValueError("lambda must be positive")
        if size <= 0:
            raise ValueError("size must be positive")

        r = rng or random
        out: List[int] = []

        def knuth() -> int:
            L = math.exp(-lambd)
            k = 0
            p = 1.0
            while p > L:
                k += 1
                p *= r.random()
            return k - 1

        for _ in range(size):
            if lambd < 30.0:
                out.append(knuth())
            else:
                # Normal approximation: N(lambd, lambd)
                x = int(round(r.gauss(lambd, math.sqrt(lambd))))
                out.append(max(0, x))

        return out[0] if size == 1 else out

    @staticmethod
    def binomial(n: int, p: float, size: int = 1,
                 rng: Optional[random.Random] = None) -> Union[int, List[int]]:
        if n < 0:
            raise ValueError("n must be >= 0")
        if not (0.0 <= p <= 1.0):
            raise ValueError("p must be in [0,1]")
        if size <= 0:
            raise ValueError("size must be positive")

        r = rng or random
        out: List[int] = []

        for _ in range(size):
            s = 0
            for __ in range(n):
                if r.random() < p:
                    s += 1
            out.append(s)

        return out[0] if size == 1 else out
