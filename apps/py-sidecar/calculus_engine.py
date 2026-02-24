"""
Calculus Engine v2 (no dependencies)
- Adaptive, error-estimated differentiation and integration
- Stable gradient/Hessian (reuses f0, symmetry)
- Robust nth derivative via Fornberg finite-difference weights (no recursive differentiation)
- Adaptive RK45 ODE solver (Dormand–Prince)
- Safer root finding (hybrid Newton/bisection if bracketed)
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Callable, List, Tuple, Optional, Union, Any

Number = Union[float, complex]
Vec = Union[float, List[float], Tuple[float, ...]]

_EPS = 2.220446049250313e-16  # IEEE-754 double eps


def _is_scalar(y: Any) -> bool:
    return isinstance(y, (int, float))


def _v_add(a: Vec, b: Vec) -> Vec:
    if _is_scalar(a) and _is_scalar(b):
        return float(a) + float(b)
    aa = list(a)  # type: ignore[arg-type]
    bb = list(b)  # type: ignore[arg-type]
    return [aa[i] + bb[i] for i in range(len(aa))]


def _v_sub(a: Vec, b: Vec) -> Vec:
    if _is_scalar(a) and _is_scalar(b):
        return float(a) - float(b)
    aa = list(a)  # type: ignore[arg-type]
    bb = list(b)  # type: ignore[arg-type]
    return [aa[i] - bb[i] for i in range(len(aa))]


def _v_mul(a: Vec, s: float) -> Vec:
    if _is_scalar(a):
        return float(a) * s
    aa = list(a)  # type: ignore[arg-type]
    return [aa[i] * s for i in range(len(aa))]


def _v_norm_inf(a: Vec) -> float:
    if _is_scalar(a):
        return abs(float(a))
    aa = list(a)  # type: ignore[arg-type]
    return max(abs(x) for x in aa) if aa else 0.0


@dataclass(frozen=True)
class DerivativeResult:
    value: float
    error_est: float
    h_used: float


@dataclass(frozen=True)
class IntegralResult:
    value: float
    error_est: float
    evals: int


@dataclass(frozen=True)
class ODEResult:
    t: List[float]
    y: List[Vec]
    n_steps: int


class Calculus:
    # -----------------------------
    # Differentiation
    # -----------------------------

    @staticmethod
    def _auto_h(x: float, order: int) -> float:
        """
        Choose h ~ eps^(1/(order+1)) * scale
        - For central difference first derivative: truncation O(h^2) => order=2 => eps^(1/3)
        - For five-point first derivative: truncation O(h^4) => order=4 => eps^(1/5)
        - For second derivative (3-point): truncation O(h^2) => order=2 => eps^(1/3)
        """
        scale = max(1.0, abs(x))
        return (float(_EPS) ** (1.0 / (order + 1))) * scale

    @staticmethod
    def derivative(
        f: Callable[[Number], Number],
        x: float,
        h: Optional[float] = None,
        method: str = "central",
        *,
        richardson: bool = True
    ) -> DerivativeResult:
        """
        Numerical first derivative with optional Richardson extrapolation + error estimate.

        Supported methods:
        - "forward"  : O(h)
        - "backward" : O(h)
        - "central"  : O(h^2)  (default)
        - "five_point": O(h^4)
        - "complex_step": Im(f(x + i h))/h  (best if f supports complex input)
        """
        if method == "complex_step":
            # Complex-step is cancellation-free for analytic functions
            hh = h if h is not None else 1e-20
            try:
                val = f(x + 1j * hh)
            except TypeError as e:
                raise TypeError("complex_step requires f to accept complex inputs") from e
            if not isinstance(val, complex):
                raise TypeError("complex_step requires f(x + i h) to return complex")
            return DerivativeResult(value=float(val.imag / hh), error_est=0.0, h_used=hh)

        if method in ("forward", "backward"):
            hh = h if h is not None else Calculus._auto_h(x, order=1)
            if method == "forward":
                d = (float(f(x + hh)) - float(f(x))) / hh
            else:
                d = (float(f(x)) - float(f(x - hh))) / hh
            # error estimate: crude (first-order)
            return DerivativeResult(value=d, error_est=abs(d) * hh, h_used=hh)

        if method == "central":
            hh = h if h is not None else Calculus._auto_h(x, order=2)

            def D(step: float) -> float:
                return (float(f(x + step)) - float(f(x - step))) / (2.0 * step)

            d1 = D(hh)
            if not richardson:
                return DerivativeResult(value=d1, error_est=abs(d1) * hh * hh, h_used=hh)

            d2 = D(hh * 0.5)
            # Richardson: eliminate O(h^2) term
            d_ex = (4.0 * d2 - d1) / 3.0
            err = abs(d_ex - d2)
            return DerivativeResult(value=d_ex, error_est=err, h_used=hh * 0.5)

        if method == "five_point":
            hh = h if h is not None else Calculus._auto_h(x, order=4)

            def D(step: float) -> float:
                return (
                    -float(f(x + 2 * step))
                    + 8.0 * float(f(x + step))
                    - 8.0 * float(f(x - step))
                    + float(f(x - 2 * step))
                ) / (12.0 * step)

            d1 = D(hh)
            if not richardson:
                return DerivativeResult(value=d1, error_est=abs(d1) * hh ** 4, h_used=hh)

            d2 = D(hh * 0.5)
            # Richardson: eliminate O(h^4) term
            d_ex = (16.0 * d2 - d1) / 15.0
            err = abs(d_ex - d2)
            return DerivativeResult(value=d_ex, error_est=err, h_used=hh * 0.5)

        raise ValueError(f"Unknown method: {method}")

    @staticmethod
    def second_derivative(
        f: Callable[[float], float],
        x: float,
        h: Optional[float] = None,
        *,
        richardson: bool = True
    ) -> DerivativeResult:
        """
        Second derivative using centered 3-point stencil + optional Richardson.
        """
        hh = h if h is not None else Calculus._auto_h(x, order=2)

        def D2(step: float) -> float:
            return (f(x + step) - 2.0 * f(x) + f(x - step)) / (step * step)

        d1 = D2(hh)
        if not richardson:
            return DerivativeResult(value=d1, error_est=abs(d1) * hh * hh, h_used=hh)

        d2 = D2(hh * 0.5)
        # Richardson for O(h^2): d_ex = (4*d2 - d1)/3
        d_ex = (4.0 * d2 - d1) / 3.0
        err = abs(d_ex - d2)
        return DerivativeResult(value=d_ex, error_est=err, h_used=hh * 0.5)

    # -----------------------------
    # Multivariate calculus
    # -----------------------------

    @staticmethod
    def gradient(
        f: Callable[[List[float]], float],
        x: List[float],
        h: Optional[float] = None
    ) -> List[float]:
        """
        Gradient via central differences. Uses auto h per component scale if h is None.
        """
        n = len(x)
        out: List[float] = []
        x0 = x[:]  # base
        for i in range(n):
            hi = h if h is not None else Calculus._auto_h(x0[i], order=2)
            xp = x0[:]
            xm = x0[:]
            xp[i] += hi
            xm[i] -= hi
            out.append((f(xp) - f(xm)) / (2.0 * hi))
        return out

    @staticmethod
    def hessian(
        f: Callable[[List[float]], float],
        x: List[float],
        h: Optional[float] = None
    ) -> List[List[float]]:
        """
        Hessian with symmetry + reuse f(x).
        - Diagonal: 3-point second difference
        - Off-diagonal: mixed partial centered formula
        """
        n = len(x)
        H = [[0.0 for _ in range(n)] for _ in range(n)]
        f0 = f(x)

        # Diagonal terms
        for i in range(n):
            hi = h if h is not None else Calculus._auto_h(x[i], order=2)
            xp = x[:]
            xm = x[:]
            xp[i] += hi
            xm[i] -= hi
            H[i][i] = (f(xp) - 2.0 * f0 + f(xm)) / (hi * hi)

        # Mixed partials: compute only i<j then mirror
        for i in range(n):
            for j in range(i + 1, n):
                hi = h if h is not None else Calculus._auto_h(x[i], order=2)
                hj = h if h is not None else Calculus._auto_h(x[j], order=2)

                xpp = x[:]
                xpm = x[:]
                xmp = x[:]
                xmm = x[:]

                xpp[i] += hi; xpp[j] += hj
                xpm[i] += hi; xpm[j] -= hj
                xmp[i] -= hi; xmp[j] += hj
                xmm[i] -= hi; xmm[j] -= hj

                val = (f(xpp) - f(xpm) - f(xmp) + f(xmm)) / (4.0 * hi * hj)
                H[i][j] = val
                H[j][i] = val

        return H

    # -----------------------------
    # Nth derivative (Fornberg weights)
    # -----------------------------

    @staticmethod
    def nth_derivative(
        f: Callable[[float], float],
        x: float,
        n: int,
        h: Optional[float] = None,
        stencil: int = 9
    ) -> float:
        """
        Stable nth derivative via finite-difference weights (Fornberg).
        - Uses a symmetric stencil around x (odd stencil recommended: 5,7,9,11...)
        - Avoids recursive differentiation explosions

        NOTE: higher n still gets sensitive, but this is the correct way to do it numerically.
        """
        if n < 0:
            raise ValueError("n must be >= 0")
        if n == 0:
            return f(x)
        if stencil < n + 1:
            stencil = n + 1
        if stencil % 2 == 0:
            stencil += 1  # enforce odd for symmetry

        hh = h if h is not None else Calculus._auto_h(x, order=2)  # base step
        m = stencil // 2
        xs = [x + (k - m) * hh for k in range(stencil)]
        ws = Calculus._fornberg_weights(x, xs, n)  # weights for derivative order n
        return sum(ws[k] * f(xs[k]) for k in range(stencil))

    @staticmethod
    def _fornberg_weights(x0: float, x: List[float], m: int) -> List[float]:
        """
        Fornberg algorithm: compute finite difference weights for derivative order m at x0.
        Returns weights w such that f^(m)(x0) ≈ Σ w_i f(x_i).
        """
        n = len(x)
        c = [[0.0 for _ in range(m + 1)] for _ in range(n)]
        c[0][0] = 1.0
        c1 = 1.0
        c4 = x[0] - x0

        for i in range(1, n):
            mn = min(i, m)
            c2 = 1.0
            c5 = c4
            c4 = x[i] - x0
            for j in range(i):
                c3 = x[i] - x[j]
                c2 *= c3
                if j == i - 1:
                    for k in range(mn, 0, -1):
                        c[i][k] = (c1 * (k * c[i - 1][k - 1] - c5 * c[i - 1][k])) / c2
                    c[i][0] = (-c1 * c5 * c[i - 1][0]) / c2
                for k in range(mn, 0, -1):
                    c[j][k] = ((c4 * c[j][k]) - (k * c[j][k - 1])) / c3
                c[j][0] = (c4 * c[j][0]) / c3
            c1 = c2

        return [c[i][m] for i in range(n)]

    # -----------------------------
    # Integration
    # -----------------------------

    @staticmethod
    def integrate_adaptive_simpson(
        f: Callable[[float], float],
        a: float,
        b: float,
        tol: float = 1e-10,
        max_depth: int = 20
    ) -> IntegralResult:
        """
        Adaptive Simpson's rule with error estimate.

        Returns IntegralResult(value, error_est, evals)
        """
        evals = 0

        def fa(x: float) -> float:
            nonlocal evals
            evals += 1
            return f(x)

        def simpson(fa_: float, fm_: float, fb_: float, h: float) -> float:
            return (h / 6.0) * (fa_ + 4.0 * fm_ + fb_)

        # Initial evaluations
        fa0 = fa(a)
        fb0 = fa(b)
        m = 0.5 * (a + b)
        fm0 = fa(m)
        S0 = simpson(fa0, fm0, fb0, b - a)

        # iterative stack to avoid recursion depth issues
        stack: List[Tuple[float, float, float, float, float, float, float, int]] = []
        # (a, b, fa, fm, fb, S, tol, depth)
        stack.append((a, b, fa0, fm0, fb0, S0, tol, 0))

        total = 0.0
        err_total = 0.0

        while stack:
            aa, bb, faa, fmm, fbb, S, local_tol, depth = stack.pop()
            mm = 0.5 * (aa + bb)
            lm = 0.5 * (aa + mm)
            rm = 0.5 * (mm + bb)

            flm = fa(lm)
            frm = fa(rm)

            S_left = (mm - aa) / 6.0 * (faa + 4.0 * flm + fmm)
            S_right = (bb - mm) / 6.0 * (fmm + 4.0 * frm + fbb)
            S2 = S_left + S_right

            # Simpson error estimate: (S2 - S)/15
            err = abs(S2 - S) / 15.0

            if depth >= max_depth or err <= local_tol:
                total += S2 + (S2 - S) / 15.0  # Richardson correction
                err_total += err
            else:
                # split interval, halve tolerance
                half_tol = local_tol * 0.5
                stack.append((mm, bb, fmm, frm, fbb, S_right, half_tol, depth + 1))
                stack.append((aa, mm, faa, flm, fmm, S_left, half_tol, depth + 1))

        return IntegralResult(value=total, error_est=err_total, evals=evals)

    # -----------------------------
    # ODE Solvers
    # -----------------------------

    @staticmethod
    def solve_ode_rk45(
        f: Callable[[float, Vec], Vec],
        y0: Vec,
        t_span: Tuple[float, float],
        tol: float = 1e-6,
        h0: Optional[float] = None,
        h_min: float = 1e-12,
        h_max: float = 1.0,
        max_steps: int = 200000
    ) -> ODEResult:
        """
        Adaptive Dormand–Prince RK45 (like scipy RK45 but minimal).
        Works for scalar y or vector y (list/tuple).
        """
        t0, t1 = t_span
        direction = 1.0 if t1 >= t0 else -1.0

        t = t0
        y = y0

        if h0 is None:
            h = min(h_max, max(1e-3, abs(t1 - t0) / 200.0))
        else:
            h = abs(h0)

        t_out = [t]
        y_out = [y]
        steps = 0

        # Dormand–Prince coefficients
        # (Butcher tableau for RK45)
        a2 = 1/5
        a3 = 3/10
        a4 = 4/5
        a5 = 8/9
        a6 = 1.0
        a7 = 1.0

        b21 = 1/5

        b31 = 3/40;   b32 = 9/40

        b41 = 44/45;  b42 = -56/15;  b43 = 32/9

        b51 = 19372/6561; b52 = -25360/2187; b53 = 64448/6561; b54 = -212/729

        b61 = 9017/3168; b62 = -355/33; b63 = 46732/5247; b64 = 49/176; b65 = -5103/18656

        # 5th order solution
        c1 = 35/384; c3 = 500/1113; c4 = 125/192; c5 = -2187/6784; c6 = 11/84

        # 4th order solution (error estimate)
        d1 = 5179/57600; d3 = 7571/16695; d4 = 393/640; d5 = -92097/339200; d6 = 187/2100; d7 = 1/40

        def clamp_step(step: float) -> float:
            return max(h_min, min(h_max, step))

        while (t - t1) * direction < 0:
            steps += 1
            if steps > max_steps:
                raise RuntimeError("RK45 exceeded max_steps; tighten h_max or relax tol.")

            # avoid overshoot
            if (t + direction * h - t1) * direction > 0:
                h = abs(t1 - t)

            hh = direction * h

            k1 = f(t, y)
            k2 = f(t + a2 * hh, _v_add(y, _v_mul(k1, b21 * hh)))
            k3 = f(t + a3 * hh, _v_add(y, _v_add(_v_mul(k1, b31 * hh), _v_mul(k2, b32 * hh))))
            k4 = f(t + a4 * hh, _v_add(y, _v_add(_v_add(_v_mul(k1, b41 * hh), _v_mul(k2, b42 * hh)), _v_mul(k3, b43 * hh))))
            k5 = f(t + a5 * hh, _v_add(y, _v_add(_v_add(_v_add(_v_mul(k1, b51 * hh), _v_mul(k2, b52 * hh)), _v_mul(k3, b53 * hh)), _v_mul(k4, b54 * hh))))
            k6 = f(t + a6 * hh, _v_add(y, _v_add(_v_add(_v_add(_v_add(_v_mul(k1, b61 * hh), _v_mul(k2, b62 * hh)), _v_mul(k3, b63 * hh)), _v_mul(k4, b64 * hh)), _v_mul(k5, b65 * hh))))

            # 5th order estimate
            y5 = _v_add(
                y,
                _v_add(
                    _v_add(_v_mul(k1, c1 * hh), _v_mul(k3, c3 * hh)),
                    _v_add(_v_add(_v_mul(k4, c4 * hh), _v_mul(k5, c5 * hh)), _v_mul(k6, c6 * hh))
                )
            )

            k7 = f(t + a7 * hh, y5)

            # 4th order estimate
            y4 = _v_add(
                y,
                _v_add(
                    _v_add(_v_mul(k1, d1 * hh), _v_mul(k3, d3 * hh)),
                    _v_add(_v_add(_v_mul(k4, d4 * hh), _v_mul(k5, d5 * hh)),
                           _v_add(_v_mul(k6, d6 * hh), _v_mul(k7, d7 * hh)))
                )
            )

            err = _v_norm_inf(_v_sub(y5, y4))
            scale = max(1.0, _v_norm_inf(y5))
            rel_err = err / scale

            if rel_err <= tol:
                t = t + hh
                y = y5
                t_out.append(t)
                y_out.append(y)

                # step increase
                if rel_err == 0:
                    h = clamp_step(h * 2.0)
                else:
                    h = clamp_step(h * min(2.0, 0.9 * (tol / rel_err) ** 0.2))
            else:
                # step decrease
                h = clamp_step(h * max(0.1, 0.9 * (tol / rel_err) ** 0.25))

        return ODEResult(t=t_out, y=y_out, n_steps=steps)

    # -----------------------------
    # Root finding
    # -----------------------------

    @staticmethod
    def find_root_hybrid(
        f: Callable[[float], float],
        x0: float,
        bracket: Optional[Tuple[float, float]] = None,
        tol: float = 1e-12,
        max_iter: int = 100
    ) -> float:
        """
        Hybrid method:
        - If bracket provided with sign change: Newton step when safe, otherwise bisection.
        - If no bracket: damped Newton with numerical derivative fallback.
        """
        if bracket is not None:
            a, b = bracket
            fa = f(a)
            fb = f(b)
            if fa * fb > 0:
                raise ValueError("Bracket must satisfy f(a)*f(b) <= 0")

            x = x0
            for _ in range(max_iter):
                fx = f(x)
                if abs(fx) <= tol:
                    return x

                # numerical derivative (central, Richardson)
                dres = Calculus.derivative(lambda t: f(float(t)), x, method="central")
                fpx = dres.value

                # Newton candidate
                if abs(fpx) > 1e-16:
                    xn = x - fx / fpx
                else:
                    xn = float("nan")

                # accept Newton only if inside bracket
                if (not math.isnan(xn)) and (a <= xn <= b):
                    x_new = xn
                else:
                    x_new = 0.5 * (a + b)

                f_new = f(x_new)
                # shrink bracket
                if fa * f_new <= 0:
                    b = x_new
                    fb = f_new
                else:
                    a = x_new
                    fa = f_new

                if abs(b - a) <= tol:
                    return 0.5 * (a + b)

                x = x_new

            raise RuntimeError("Root find did not converge (hybrid bracketed).")

        # No bracket: damped Newton
        x = x0
        for _ in range(max_iter):
            fx = f(x)
            if abs(fx) <= tol:
                return x
            dres = Calculus.derivative(lambda t: f(float(t)), x, method="central")
            fpx = dres.value
            if abs(fpx) < 1e-16:
                raise RuntimeError("Derivative too small; supply a bracket.")
            step = fx / fpx
            # damping to avoid wild jumps
            x = x - step * 0.8
        raise RuntimeError("Root find did not converge (unbracketed).")


# -----------------------------
# Example sanity checks
# -----------------------------
if __name__ == "__main__":
    # Derivative tests
    f = math.sin
    d = Calculus.derivative(f, 1.0, method="five_point")
    print("d/dx sin(1) ~", d.value, "err~", d.error_est, "true=", math.cos(1.0))

    # Second derivative test: d2/dx2 sin = -sin
    d2 = Calculus.second_derivative(math.sin, 1.0)
    print("d2/dx2 sin(1) ~", d2.value, "true=", -math.sin(1.0))

    # Adaptive Simpson test: ∫0^π sin(x) dx = 2
    I = Calculus.integrate_adaptive_simpson(math.sin, 0.0, math.pi, tol=1e-12)
    print("Integral sin 0..pi ~", I.value, "err~", I.error_est, "true=2")

    # ODE test: y' = y, y(0)=1 => y(t)=e^t
    def ode(t: float, y: Vec) -> Vec:
        return y  # type: ignore[return-value]

    sol = Calculus.solve_ode_rk45(ode, 1.0, (0.0, 1.0), tol=1e-8)
    print("ODE y'=y at t=1 ~", sol.y[-1], "true=", math.e)

    # Root test: cos(x)=0 => x=pi/2
    root = Calculus.find_root_hybrid(math.cos, x0=1.0, bracket=(0.0, 2.0))
    print("Root cos(x)=0 ~", root, "true=", math.pi/2)
