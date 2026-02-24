"""
Signal Processing Engine
Digital signal processing with FFT, convolution, filters, and wavelets.

Provides core FFT, convolution, filtering, and wavelet operations for:
- Audio/signal analysis
- Frequency domain processing
- Multi-scale decomposition (DWT)
- Temporal/spectral feature extraction
"""

import math
import cmath
import importlib.util
from typing import List, Tuple, Union

HAS_NUMPY = importlib.util.find_spec("numpy") is not None


class SignalProcessing:
    """
    Comprehensive digital signal processing operations
    """

    @staticmethod
    def fft(signal: List[Union[float, complex]]) -> List[complex]:
        """
        Fast Fourier Transform using Cooley-Tukey algorithm
        Converts time domain signal to frequency domain
        """
        n = len(signal)

        # Pad to next power of 2 for efficiency
        if n & (n - 1) != 0:
            next_power = 1 << (n - 1).bit_length()
            signal = signal + [0] * (next_power - n)

        # Convert to complex if needed
        if all(isinstance(x, (int, float)) for x in signal):
            signal = [complex(x, 0) for x in signal]

        return SignalProcessing._fft_recursive(signal)

    @staticmethod
    def _fft_recursive(signal: List[complex]) -> List[complex]:
        """
        Recursive FFT implementation
        """
        n = len(signal)

        if n <= 1:
            return signal

        # Divide
        even = [signal[i] for i in range(0, n, 2)]
        odd = [signal[i] for i in range(1, n, 2)]

        # Conquer
        y_even = SignalProcessing._fft_recursive(even)
        y_odd = SignalProcessing._fft_recursive(odd)

        # Combine
        y = [0] * n
        for k in range(n // 2):
            # Twiddle factor: e^(-2πik/n)
            twiddle = cmath.exp(-2j * cmath.pi * k / n) * y_odd[k]

            y[k] = y_even[k] + twiddle
            y[k + n // 2] = y_even[k] - twiddle

        return y

    @staticmethod
    def ifft(spectrum: List[complex]) -> List[complex]:
        """
        Inverse Fast Fourier Transform
        Converts frequency domain back to time domain

        Mathematical operation: x[n] = (1/N) * Σ_k X[k] * e^(j 2πkn/N)

        CRITICAL: Uses direct _fft_recursive to avoid padding.
        This ensures strict invertibility: ifft(fft(x)) == x (mod float error)
        for any input length, including non-power-of-two.

        If spectrum length is not a power of two, padding would occur in regular fft(),
        breaking the inverse property. We bypass that by directly using the recursive
        FFT without zero-padding.

        @param spectrum Frequency-domain coefficients (complex)
        @returns Time-domain signal (complex), same length as input spectrum
        """
        n = len(spectrum)

        if n == 0:
            return []

        # Conjugate the spectrum
        conjugated = [x.conjugate() for x in spectrum]

        # Apply FFT directly without padding to preserve length
        result = SignalProcessing._fft_recursive(conjugated)

        # Conjugate result and normalize by N
        return [x.conjugate() / n for x in result]

    @staticmethod
    def dft(signal: List[Union[float, complex]]) -> List[complex]:
        """
        Discrete Fourier Transform (direct computation)
        X[k] = Σ(x[n] * e^(-2πikn/N)) for n=0 to N-1
        """
        n = len(signal)
        spectrum = []

        for k in range(n):
            sum_val = 0 + 0j
            for n_idx in range(n):
                angle = -2 * cmath.pi * k * n_idx / n
                sum_val += signal[n_idx] * cmath.exp(angle)
            spectrum.append(sum_val)

        return spectrum

    @staticmethod
    def power_spectrum(signal: List[Union[float, complex]]) -> List[float]:
        """
        Power spectral density: |X[k]|²
        """
        spectrum = SignalProcessing.fft(signal)
        return [abs(x) ** 2 for x in spectrum]

    @staticmethod
    def magnitude_spectrum(signal: List[Union[float, complex]]) -> List[float]:
        """
        Magnitude spectrum: |X[k]|
        """
        spectrum = SignalProcessing.fft(signal)
        return [abs(x) for x in spectrum]

    @staticmethod
    def phase_spectrum(signal: List[Union[float, complex]]) -> List[float]:
        """
        Phase spectrum: arg(X[k])
        """
        spectrum = SignalProcessing.fft(signal)
        return [cmath.phase(x) for x in spectrum]

    @staticmethod
    def convolution(signal1: List[float], signal2: List[float],
                    mode: str = 'full') -> List[float]:
        """
        Discrete convolution: (f * g)[n] = Σ f[m]g[n-m]

        Modes:
        - 'full': Full linear convolution output (length = len1 + len2 - 1)
          Zero-pads both signals at boundaries, returns all non-zero outputs.
          Lags range from -(len2-1) to +(len1-1).

        - 'same': Output same length as signal1 (length = len1)
          Centers signal2's support around each sample of signal1.
          Mathematically: same[n] = (f * g)[n + (len2-1)//2] for n in [0, len1)
          This ensures symmetric lag alignment, where negative lags from signal2 come
          before the center, and positive lags after.
          At boundaries, signal2 is effectively zero-padded (truncated overlap).

        - 'valid': Only where signals fully overlap (length = max(0, len1 - len2 + 1))
          No zero-padding; returns only indices where signal2 is entirely within signal1's support.
          If len2 > len1, returns empty list.

        Note on edge handling:
        'full' and 'same' use implicit zero-padding at boundaries.
        'valid' requires complete overlap, returning empty if signal2 is longer.
        """
        if not signal1 or not signal2:
            return []

        m, n = len(signal1), len(signal2)

        if mode == 'full':
            result_length = m + n - 1
            result = [0.0] * result_length

            for i in range(result_length):
                for j in range(max(0, i - n + 1), min(i + 1, m)):
                    result[i] += signal1[j] * signal2[i - j]

        elif mode == 'same':
            result_length = m
            result = [0.0] * result_length

            # Center signal2 around each point of signal1
            offset = n // 2

            for i in range(result_length):
                for j_sig2 in range(n):
                    i_sig1 = i - offset + j_sig2
                    if 0 <= i_sig1 < m:
                        result[i] += signal1[i_sig1] * signal2[j_sig2]

        elif mode == 'valid':
            if n > m:
                return []
            result_length = m - n + 1
            result = [0.0] * result_length

            for i in range(result_length):
                for j in range(n):
                    result[i] += signal1[i + j] * signal2[j]

        else:
            raise ValueError("Mode must be 'full', 'same', or 'valid'")

        return result

    @staticmethod
    def cross_correlation(signal1: List[float], signal2: List[float]) -> List[float]:
        """
        Cross-correlation: R_xy[lag] = Σ x[n]y[n+lag]

        Measures similarity between signal1 and time-shifted copies of signal2.
        Positive lags mean signal2 is shifted forward (later in time relative to signal1).

        Implementation: uses convolution with time-reversed signal2.
        Cross-correlation with lag τ is: R_xy[τ] = Σ_n x[n] y[n-τ]
        This equals convolution of x with time-reversed y.

        Output length: 2*N-1 where N = len(signal1).
        Lags range from -(N_y-1) to +(N_x-1) in output.
        Center of output (index N_y-1) corresponds to lag 0.

        @returns Full cross-correlation sequence for all lags
        """
        signal2_reversed = signal2[::-1]
        return SignalProcessing.convolution(signal1, signal2_reversed, mode='full')

    @staticmethod
    def autocorrelation(signal: List[float]) -> List[float]:
        """
        Autocorrelation: R_xx[lag] = Σ x[n]x[n+lag]

        Measures self-similarity of signal at different time lags.
        Useful for detecting periodicity, pitch estimation, and stationarity analysis.

        Implementation: cross-correlation of signal with itself.

        Output interpretation:
        - Length: 2*N-1 where N = len(signal)
        - Lags range from -(N-1) to +(N-1)
        - Index i corresponds to lag (i - N+1)
        - Center element (index N-1) is lag=0 (total signal energy)
        - Autocorrelation is symmetric: R_xx[τ] = R_xx[-τ]

        Many consumers only use nonnegative lags (indices N-1 onwards).
        To get only positive lags (lag >= 0), take output[N-1:].
        To get only negative lags (lag < 0), take output[:N].

        Note: Not normalized by signal energy. To get correlation coefficient,
        divide by R_xx[N-1] (energy at lag 0).

        @returns Full autocorrelation sequence for all lags [-(N-1), ..., 0, ..., +(N-1)]
        """
        return SignalProcessing.cross_correlation(signal, signal)


class Filters:
    """
    Digital filter implementations
    """

    @staticmethod
    def _convolve_polynomials(p1: List[float], p2: List[float]) -> List[float]:
        """
        Convolve two coefficient polynomials for IIR filter cascading

        If p1 and p2 represent polynomials P1(z) and P2(z), returns coefficients
        of P1(z)*P2(z).

        Used for cascading two transfer functions: H(z) = H1(z) * H2(z)
        requires convolving both numerators and denominators separately.

        @param p1 Coefficients of first polynomial [c0, c1, c2, ...]
        @param p2 Coefficients of second polynomial [c0, c1, c2, ...]
        @returns Coefficients of product polynomial
        """
        if not p1 or not p2:
            return []

        result = [0.0] * (len(p1) + len(p2) - 1)
        for i, coeff1 in enumerate(p1):
            for j, coeff2 in enumerate(p2):
                result[i + j] += coeff1 * coeff2

        return result

    @staticmethod
    def low_pass_butterworth(cutoff_freq: float, sample_rate: float,
                             order: int = 2) -> Tuple[List[float], List[float]]:
        """
        Butterworth low-pass filter design
        Returns (numerator_coeffs, denominator_coeffs)
        """
        nyquist = sample_rate / 2
        normalized_cutoff = cutoff_freq / nyquist

        if order == 1:
            wc = math.tan(math.pi * normalized_cutoff / 2)

            b0 = wc / (1 + wc)
            a1 = (wc - 1) / (1 + wc)

            return ([b0, b0], [1.0, a1])

        else:
            return Filters.low_pass_butterworth(cutoff_freq, sample_rate, 1)

    @staticmethod
    def high_pass_butterworth(cutoff_freq: float, sample_rate: float,
                              order: int = 2) -> Tuple[List[float], List[float]]:
        """
        Butterworth high-pass filter design
        """
        nyquist = sample_rate / 2
        normalized_cutoff = cutoff_freq / nyquist

        if order == 1:
            wc = math.tan(math.pi * normalized_cutoff / 2)

            b0 = 1 / (1 + wc)
            b1 = -1 / (1 + wc)
            a1 = (wc - 1) / (1 + wc)

            return ([b0, b1], [1.0, a1])

        else:
            return Filters.high_pass_butterworth(cutoff_freq, sample_rate, 1)

    @staticmethod
    def band_pass_butterworth(low_freq: float, high_freq: float,
                              sample_rate: float, order: int = 2) -> Tuple[List[float], List[float]]:
        """
        Butterworth band-pass filter design via cascade

        Constructs a band-pass by cascading:
        - High-pass filter at low_freq (passes frequencies > low_freq)
        - Low-pass filter at high_freq (passes frequencies < high_freq)

        The cascade produces a band-pass that attenuates outside [low_freq, high_freq].

        For transfer functions H_hp(z) = B_hp(z)/A_hp(z) and H_lp(z) = B_lp(z)/A_lp(z),
        the cascade is:
        H_total(z) = (B_hp ⊗ B_lp)(z) / (A_hp ⊗ A_lp)(z)

        where ⊗ denotes polynomial convolution.

        @param low_freq Lower cutoff frequency (Hz)
        @param high_freq Upper cutoff frequency (Hz)
        @param sample_rate Sample rate (Hz)
        @param order Filter order (only 1st-order sections currently implemented)
        @returns Cascaded (numerator_coeffs, denominator_coeffs)

        @raises ValueError if low_freq >= high_freq
        """
        if low_freq >= high_freq:
            raise ValueError("low_freq must be less than high_freq")

        lp_num, lp_den = Filters.low_pass_butterworth(high_freq, sample_rate, order)
        hp_num, hp_den = Filters.high_pass_butterworth(low_freq, sample_rate, order)

        cascaded_num = Filters._convolve_polynomials(hp_num, lp_num)
        cascaded_den = Filters._convolve_polynomials(hp_den, lp_den)

        return (cascaded_num, cascaded_den)

    @staticmethod
    def apply_filter(signal: List[float], numerator: List[float],
                     denominator: List[float]) -> List[float]:
        """
        Apply IIR filter to signal using difference equation
        y[n] = (1/a0) * (Σ(bk * x[n-k]) - Σ(ak * y[n-k]))
        """
        if not denominator or denominator[0] == 0:
            raise ValueError("Invalid denominator coefficients")

        a0 = denominator[0]
        num_norm = [b / a0 for b in numerator]
        den_norm = [a / a0 for a in denominator]

        n = len(signal)
        output = [0.0] * n

        for i in range(n):
            for j, b in enumerate(num_norm):
                if i - j >= 0:
                    output[i] += b * signal[i - j]

            for j, a in enumerate(den_norm[1:], 1):
                if i - j >= 0:
                    output[i] -= a * output[i - j]

        return output

    @staticmethod
    def moving_average(signal: List[float], window_size: int) -> List[float]:
        """
        Simple moving average filter
        """
        if window_size <= 0:
            raise ValueError("Window size must be positive")

        result = []
        for i in range(len(signal)):
            start = max(0, i - window_size // 2)
            end = min(len(signal), i + window_size // 2 + 1)

            window_sum = sum(signal[start:end])
            window_length = end - start
            result.append(window_sum / window_length)

        return result

    @staticmethod
    def median_filter(signal: List[float], window_size: int) -> List[float]:
        """
        Median filter for noise reduction
        """
        if window_size <= 0 or window_size % 2 == 0:
            raise ValueError("Window size must be positive and odd")

        result = []
        half_window = window_size // 2

        for i in range(len(signal)):
            start = max(0, i - half_window)
            end = min(len(signal), i + half_window + 1)

            window = sorted(signal[start:end])
            median_idx = len(window) // 2
            result.append(window[median_idx])

        return result


class Wavelets:
    """
    Wavelet transform implementations
    """

    @staticmethod
    def haar_transform(signal: List[float]) -> Tuple[List[float], List[float]]:
        """
        Haar wavelet transform (orthonormal analysis)
        Returns (approximation_coeffs, detail_coeffs)

        One-level decomposition using Haar basis functions:
        - φ(t): constant basis (approximation, lowpass)
        - ψ(t): Haar wavelet basis (detail, highpass)

        For each pair of adjacent samples [s[i], s[i+1]]:
        approx[i] = (s[i] + s[i+1]) / √2   (average + normalized)
        detail[i] = (s[i] - s[i+1]) / √2   (difference + normalized)

        Boundary handling: if signal length is odd, pads with zero.
        This preserves orthonormality but changes the effective signal by one sample.
        The added zero can be reconstructed exactly by haar_inverse().

        Use for: fast multiscale decomposition, rough downsampling, feature extraction.

        @returns Tuple (approximation, detail) each with length ceil(N/2)
        """
        n = len(signal)
        if n % 2 != 0:
            signal = signal + [0]
            n += 1

        approx = []
        detail = []

        for i in range(0, n, 2):
            approx.append((signal[i] + signal[i+1]) / math.sqrt(2))
            detail.append((signal[i] - signal[i+1]) / math.sqrt(2))

        return (approx, detail)

    @staticmethod
    def haar_inverse(approx: List[float], detail: List[float]) -> List[float]:
        """
        Inverse Haar wavelet transform
        """
        if len(approx) != len(detail):
            raise ValueError("Approximation and detail coefficients must have same length")

        signal = []

        for i in range(len(approx)):
            s1 = (approx[i] + detail[i]) / math.sqrt(2)
            s2 = (approx[i] - detail[i]) / math.sqrt(2)

            signal.extend([s1, s2])

        return signal

    @staticmethod
    def _pad_even_min_len(x: List[float], min_len: int = 4) -> Tuple[List[float], int]:
        """
        Pad deterministically using edge-repeat (last value).
        - Ensure length >= min_len
        - Ensure length is even
        Returns (padded, original_length)
        """
        orig_len = len(x)

        if orig_len == 0:
            x = [0.0] * min_len
            orig_len = 0

        if len(x) < min_len:
            # Pad with edge value
            pad_val = x[-1] if x else 0.0
            x = x + [pad_val] * (min_len - len(x))

        if len(x) % 2 != 0:
            x = x + [x[-1]]

        return x, orig_len

    @staticmethod
    def _db4_filters() -> Tuple[List[float], List[float]]:
        """
        Daubechies-4 (D4) analysis filters (orthonormal):
        h = scaling (low-pass)
        g = wavelet (high-pass), derived as: g[n] = (-1)^n * h[L-1-n]
        """
        s3 = math.sqrt(3.0)
        den = 4.0 * math.sqrt(2.0)

        h = [
            (1.0 + s3) / den,
            (3.0 + s3) / den,
            (3.0 - s3) / den,
            (1.0 - s3) / den
        ]

        g = [h[3], -h[2], h[1], -h[0]]
        return h, g

    @staticmethod
    def daubechies_4_transform(signal: List[float], levels: int = 1) \
            -> Tuple[List[float], List[List[float]], int]:
        """
        Multi-level Daubechies-4 discrete wavelet transform (DWT).

        - Pads to even length (edge repeat) at each level when needed.
        - Uses periodic wrapping in the filter taps for invertibility.

        Returns:
          (approx_coeffs, [detail_coeffs_level0, ...], original_length)

        Use with daubechies_4_inverse() for perfect reconstruction.
        """
        h, g = Wavelets._db4_filters()

        x, orig_len = Wavelets._pad_even_min_len(signal, min_len=4)

        details: List[List[float]] = []
        a = x

        for _ in range(max(0, int(levels))):
            n = len(a)
            if n < 4:
                break

            if n % 2 != 0:
                a, _ = Wavelets._pad_even_min_len(a, min_len=4)
                n = len(a)

            half = n // 2
            approx = [0.0] * half
            detail = [0.0] * half

            # Mallat-style analysis with periodic wrapping
            for k in range(half):
                base = 2 * k
                for i in range(4):
                    idx = (base + i) % n
                    v = a[idx]
                    approx[k] += h[i] * v
                    detail[k] += g[i] * v

            details.append(detail)
            a = approx

        return (a, details, orig_len)

    @staticmethod
    def daubechies_4_inverse(approx: List[float], details: List[List[float]],
                             orig_len: int) -> List[float]:
        """
        Invert the multi-level db4 DWT produced by daubechies_4_transform.

        Reconstruction uses the paired synthesis implied by the same h,g and periodic wrapping.

        @param approx Final approximation coefficients
        @param details List of detail coefficient lists [level0, level1, ...]
        @param orig_len Original input length (for final trimming)
        @returns Reconstructed signal, trimmed back to orig_len
        """
        h, g = Wavelets._db4_filters()

        a = list(approx)

        # Reconstruct level-by-level in reverse
        for detail in reversed(details):
            if len(a) != len(detail):
                raise ValueError(
                    f"Shape mismatch: approx len {len(a)} != detail len {len(detail)}"
                )

            half = len(a)
            n = 2 * half
            x = [0.0] * n

            # Synthesis overlap-add
            for k in range(half):
                base = 2 * k
                ak = a[k]
                dk = detail[k]
                for i in range(4):
                    idx = (base + i) % n
                    x[idx] += h[i] * ak + g[i] * dk

            a = x

        # Crop back to original length
        if orig_len == 0:
            return []
        return a[:orig_len]

    @staticmethod
    def _self_test_db4() -> None:
        """Self-test: verify db4 roundtrip invertibility."""
        x = [0.25, -1.0, 2.0, 0.5, 0.75, -0.25, 1.5]
        approx, details, orig_len = Wavelets.daubechies_4_transform(x, levels=2)
        xr = Wavelets.daubechies_4_inverse(approx, details, orig_len)

        err = max(abs(xr[i] - x[i]) for i in range(len(x)))
        if err > 1e-9:
            raise AssertionError(f"db4 roundtrip failed: max error {err}")
