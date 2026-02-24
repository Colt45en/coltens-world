"""Lab Generator: Emits starter code and unit-test scaffolding for curriculum labs.
Covers:
  - PCA from scratch
  - Linear regression (normal equations + GD)
  - Logistic regression with Adam optimizer
  - Bootstrap confidence intervals
  - Naive Bayes classifier
  - Softmax classifier with cross-entropy
  - kNN metric comparison
  - Minimal autodiff
  - Minimal MLP
"""
from __future__ import annotations
from pathlib import Path

class LabGenerator:
    """
    Generates starter code and test scaffolds for curriculum labs.
    """
    def __init__(self):
        self.labs = self._define_labs()
    def _define_labs(self) -> dict[str, dict]:
        """Define all lab scaffolding by lab_id."""
        return {
            "la01_regression_from_scratch": self._lab_linear_regression,
            "la02_pca_scratch": self._lab_pca,
            "opt01_autodiff_mini": self._lab_autodiff,
            "opt02_logistic_from_scratch": self._lab_logistic,
            "ps01_naive_bayes": self._lab_naive_bayes,
            "ps02_bootstrap_ci": self._lab_bootstrap,
            "geo01_knn_metrics": self._lab_knn_metrics,
            "info01_softmax_ce": self._lab_softmax,
        }
    def generate_lab(self, lab_id: str) -> dict[str, str]:
        """
        Generate starter code and tests for a lab.
        Args:
            lab_id: Lab identifier
        Returns:
            dict with keys: "main_code", "test_code", "readme"
        """
        if lab_id not in self.labs:
            raise ValueError(f"Unknown lab: {lab_id}")
        generator_func = self.labs[lab_id]
        return generator_func()
    # ========== Individual Lab Generators ==========
    @staticmethod
    def _lab_linear_regression() -> dict[str, str]:
        """Linear regression via normal equations and gradient descent."""
        main_code = '''"""
Lab: Linear Regression from Scratch
Implement linear regression using:
1. Normal equations: (A^T A)^{-1} A^T b
2. Gradient descent with line search or fixed learning rate
Verify both methods converge to the same solution.
"""
import numpy as np
import matplotlib.pyplot as plt

def generate_regression_data(n_samples=100, n_features=5, noise_scale=1.0, seed=42):
    """Generate synthetic regression dataset."""
    rng = np.random.default_rng(seed)
    X = rng.normal(0, 1, (n_samples, n_features))
    w_true = rng.normal(0, 1, n_features)
    y = X @ w_true + noise_scale * rng.normal(0, 1, n_samples)
    return X, y, w_true

def linear_regression_normal_eq(X, y):
    """
    Solve via normal equations: w = (X^T X)^{-1} X^T y

    Args:
        X: (n_samples, n_features)
        y: (n_samples,)

    Returns:
        w: (n_features,) weight vector
    """
    # TODO: Implement normal equations
    # 1. Compute X^T X
    # 2. Compute (X^T X)^{-1}
    # 3. Compute X^T y
    # 4. w = (X^T X)^{-1} X^T y
    pass

def linear_regression_gd(X, y, learning_rate=0.01, max_iters=1000, tol=1e-5):
    """
    Solve via gradient descent.

    Loss: L(w) = 0.5 * mean((X @ w - y)^2)
    Gradient: dL/dw = (1/n) * X^T (X @ w - y)

    Args:
        X: (n_samples, n_features)
        y: (n_samples,)
        learning_rate: step size
        max_iters: max iterations
        tol: convergence tolerance on loss

    Returns:
        w: (n_features,) weight vector
        losses: list of loss values per iteration
    """
    # TODO: Implement gradient descent
    # 1. Initialize w to zeros
    # 2. For each iteration:
    #    - Compute predictions: yhat = X @ w
    #    - Compute loss: L = 0.5 * mean((yhat - y)^2)
    #    - Compute gradient: grad = X.T @ (yhat - y) / n
    #    - Update: w -= learning_rate * grad
    # 3. Return w and loss history
    pass

def mse(X, y, w):
    """Mean squared error."""
    yhat = X @ w
    return np.mean((yhat - y) ** 2)

if __name__ == "__main__":
    # Generate data
    X, y, w_true = generate_regression_data(n_samples=200, n_features=10)

    # Solve with normal equations
    w_ne = linear_regression_normal_eq(X, y)
    mse_ne = mse(X, y, w_ne)
    print(f"Normal Equations MSE: {mse_ne:.6f}")

    # Solve with gradient descent
    w_gd, losses = linear_regression_gd(X, y, learning_rate=0.01, max_iters=2000)
    mse_gd = mse(X, y, w_gd)
    print(f"Gradient Descent MSE: {mse_gd:.6f}")

    # Check convergence
    print(f"Weight difference (NE vs GD): {np.linalg.norm(w_ne - w_gd):.6f}")

    # Plot loss curve
    plt.figure(figsize=(10, 5))
    plt.plot(losses)
    plt.xlabel("Iteration")
    plt.ylabel("Loss (MSE)")
    plt.title("Gradient Descent: Training Loss")
    plt.grid()
    plt.savefig("regression_loss_curve.png", dpi=100)
    print("Saved: regression_loss_curve.png")

    # Save weights
    np.save("regression_weights.npy", w_ne)
    print("Saved: regression_weights.npy")
'''
        test_code = '''"""
Tests for linear regression lab.
"""
import numpy as np
import pytest
from regression_model import (
    linear_regression_normal_eq,
    linear_regression_gd,
    mse,
    generate_regression_data,
)

def test_linear_regression_normal_eq_basic():
    """Test normal equations on simple data."""
    X = np.array([[1.0, 0.0], [1.0, 1.0], [1.0, 2.0]])
    y = np.array([1.0, 2.0, 3.0])
    w = linear_regression_normal_eq(X, y)

    assert w is not None
    assert w.shape == (2,)

    # Check prediction
    yhat = X @ w
    error = np.linalg.norm(yhat - y)
    assert error < 0.1, f"Fit error too large: {error}"

def test_linear_regression_gd_converges():
    """Test gradient descent convergence."""
    X = np.ones((10, 1))
    y = np.ones(10) * 5.0

    w, losses = linear_regression_gd(X, y, learning_rate=0.01, max_iters=500)

    assert w is not None
    assert losses is not None
    assert len(losses) > 0

    # Loss should decrease monotonically
    for i in range(1, len(losses)):
        assert losses[i] <= losses[i-1] + 1e-6, f"Loss increased at step {i}"

    # Final loss should be small
    assert losses[-1] < 0.01, f"Final loss too large: {losses[-1]}"

def test_normal_eq_vs_gd():
    """Test that NE and GD converge to similar solution."""
    X, y, _ = generate_regression_data(n_samples=50, n_features=3, noise_scale=0.5)

    w_ne = linear_regression_normal_eq(X, y)
    w_gd, _ = linear_regression_gd(X, y, learning_rate=0.01, max_iters=5000)

    mse_ne = mse(X, y, w_ne)
    mse_gd = mse(X, y, w_gd)

    # Both should have similar MSE
    assert abs(mse_ne - mse_gd) < 0.01, f"NE MSE: {mse_ne}, GD MSE: {mse_gd}"

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
'''
        readme = """# Lab: Linear Regression from Scratch
## Objectives
- Implement linear regression using normal equations
- Implement linear regression using gradient descent
- Verify both methods converge to the same solution
- Analyze training curves and loss convergence
## Concepts
- Normal equations: (X^T X)^{-1} X^T y
- Gradient descent: iterative optimization
- Mean squared error (MSE)
- Learning rate and convergence
## Deliverables
- `regression_model.py`: Implementations of both methods
- `regression_loss_curve.png`: Plot of training loss over iterations
- `regression_weights.npy`: Learned weight vector
- `test_regression.py`: Unit tests (all passing)
## Getting Started
1. Examine the synthetic data generator
2. Implement `linear_regression_normal_eq()`
3. Implement `linear_regression_gd()`
4. Run tests to verify correctness
5. Generate plots and save outputs
## Success Criteria
- Both methods produce weights with MSE < 0.5 on synthetic data
- Gradient descent loss decreases monotonically
- Weight vectors from NE and GD differ by < 0.01 in L2 norm
- All unit tests pass
"""
        return {
            "main_code": main_code,
            "test_code": test_code,
            "readme": readme,
        }
    @staticmethod
    def _lab_pca() -> dict[str, str]:
        """PCA from scratch using covariance or SVD."""
        main_code = '''"""
Lab: Principal Component Analysis (PCA) from Scratch
Implement PCA using eigendecomposition of the covariance matrix:
  1. Center data: X_c = X - mean(X)
  2. Compute covariance: C = (1/(n-1)) * X_c^T X_c
  3. Eigendecomposition: C = U Lambda U^T
  4. Principal components: top-k eigenvectors (by eigenvalue)
  5. Projection: Z = X_c @ U_k
Compare with sklearn.decomposition.PCA.
"""
import numpy as np
import matplotlib.pyplot as plt

def pca_from_covariance(X, k):
    """
    PCA via eigendecomposition of covariance matrix.

    Args:
        X: (n_samples, n_features) data matrix
        k: number of principal components to retain

    Returns:
        Z: (n_samples, k) projected data
        U: (n_features, k) principal axes
        explained_var: (k,) explained variance per component
    """
    # TODO: Implement PCA
    # 1. Center the data: X_c = X - X.mean(axis=0)
    # 2. Compute covariance: C = X_c.T @ X_c / (n-1)
    # 3. Eigendecomposition: vals, vecs = np.linalg.eigh(C)
    # 4. Sort by descending eigenvalue
    # 5. Select top-k eigenvectors as U
    # 6. Project: Z = X_c @ U
    # 7. Return Z, U, eigenvalues
    pass

def pca_whiten(X, k, eps=1e-8):
    """
    Whiten data: divide by sqrt of eigenvalues.

    Returns:
        Z_white: (n_samples, k) whitened projection
    """
    # TODO: Implement whitening
    # Z_white = Z / sqrt(explained_var + eps)
    pass

def explained_variance_ratio(explained_var):
    """
    Compute cumulative explained variance ratio.

    Returns:
        ratio: (len(explained_var),) cumulative fraction of variance
    """
    # TODO: Implement
    # ratio = cumsum(explained_var) / sum(explained_var)
    pass

def reconstruct(Z, U, mean):
    """
    Reconstruct original data from PCA projection.

    Args:
        Z: (n_samples, k) projected data
        U: (n_features, k) principal axes
        mean: (n_features,) data mean

    Returns:
        X_recon: (n_samples, n_features) reconstructed data
    """
    # TODO: X_recon = Z @ U.T + mean
    pass

if __name__ == "__main__":
    # Generate synthetic data
    rng = np.random.default_rng(42)
    X = rng.normal(0, 1, (200, 50))

    # Apply PCA
    k = 10
    Z, U, explained_var = pca_from_covariance(X, k)

    print(f"Original shape: {X.shape}")
    print(f"Projected shape: {Z.shape}")
    print(f"Explained variance: {explained_var}")

    # Plot explained variance
    cum_var_ratio = explained_variance_ratio(explained_var)
    plt.figure(figsize=(10, 5))
    plt.plot(cum_var_ratio, marker='o')
    plt.xlabel("Component")
    plt.ylabel("Cumulative Explained Variance")
    plt.title("PCA: Cumulative Explained Variance")
    plt.grid()
    plt.savefig("pca_variance.png", dpi=100)
    print("Saved: pca_variance.png")

    # Compare with sklearn
    try:
        from sklearn.decomposition import PCA
        pca_sklearn = PCA(n_components=k)
        Z_sklearn = pca_sklearn.fit_transform(X)

        var_diff = np.linalg.norm(explained_var - pca_sklearn.explained_variance_)
        print(f"\\nVariance difference vs sklearn: {var_diff:.6f}")
    except ImportError:
        print("sklearn not available for comparison")

    # Save components
    np.save("pca_components.npy", U)
    np.save("pca_projection.npy", Z)
    print("Saved: pca_components.npy, pca_projection.npy")
'''
        test_code = '''"""
Tests for PCA lab.
"""
import numpy as np
import pytest
from pca_from_scratch import (
    pca_from_covariance,
    explained_variance_ratio,
    reconstruct,
)

def test_pca_basic():
    """Test PCA on simple data."""
    X = np.array([[1., 2.], [2., 4.], [3., 6.]])
    Z, U, var = pca_from_covariance(X, k=1)

    assert Z.shape == (3, 1)
    assert U.shape == (2, 1)
    assert len(var) == 1

def test_pca_explained_variance():
    """Test explained variance calculation."""
    X = np.eye(5)
    _, _, var = pca_from_covariance(X, k=5)

    ratio = explained_variance_ratio(var)
    assert len(ratio) == 5
    assert ratio[-1] <= 1.0 + 1e-6  # Last should be ~1

def test_pca_reconstruction():
    """Test data reconstruction."""
    rng = np.random.default_rng(42)
    X = rng.normal(0, 1, (20, 10))

    Z, U, _ = pca_from_covariance(X, k=5)
    mean = X.mean(axis=0)
    X_recon = reconstruct(Z, U, mean)

    # Reconstruction error should be small but non-zero
    error = np.linalg.norm(X - X_recon) / np.linalg.norm(X)
    assert 0 < error < 0.5

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
'''
        readme = """# Lab: PCA from Scratch
## Objectives
- Implement PCA using eigendecomposition
- Understand variance explanation and dimensionality reduction
- Compare your implementation with scikit-learn
- Visualize variance explained by each component
## Concepts
- Covariance matrix
- Eigendecomposition
- Principal components and explained variance
- Data projection and reconstruction
- Whitening
## Deliverables
- `pca_from_scratch.py`: Full PCA implementation
- `pca_variance.png`: Cumulative explained variance plot
- `pca_components.npy`: Principal axes
- `pca_projection.npy`: Projected data
- `test_pca.py`: Unit tests (all passing)
## Success Criteria
- Eigenvalues sorted in descending order
- Explained variance decreases monotonically
- Reconstruction error reasonable (10-30% for k << n_features)
- sklearn comparison shows variance difference < 1e-4
- All unit tests pass
"""
        return {
            "main_code": main_code,
            "test_code": test_code,
            "readme": readme,
        }
    @staticmethod
    def _lab_autodiff() -> dict[str, str]:
        """Minimal reverse-mode autodiff."""
        main_code = '''"""
Lab: Tiny Autodiff (Reverse-Mode)
Implement a minimal computational graph with reverse-mode autodiff:
  - Node: stores value and backward function
  - Graph: chain of operations
  - Backward: traverse graph and accumulate gradients
Test on scalar-to-scalar functions via finite differences.
"""
import numpy as np

class Node:
    """Represents a value in the computational graph."""

    def __init__(self, value, backward_fn=None, depends_on=None):
        """
        Args:
            value: scalar or array
            backward_fn: callable that computes grad_inputs given grad_output
            depends_on: list of input Nodes for this operation
        """
        self.value = value
        self.backward_fn = backward_fn
        self.depends_on = depends_on or []
        self.grad = None

    def backward(self, grad=1.0):
        """
        Reverse-mode autodiff: accumulate gradient.

        Args:
            grad: upstream gradient
        """
        # TODO: Implement
        # 1. Accumulate gradient: self.grad += grad
        # 2. If backward_fn exists, compute input gradients
        # 3. Recursively call backward on dependencies
        pass

class Variable(Node):
    """A leaf node (parameter or input)."""

    def __init__(self, value):
        super().__init__(value, backward_fn=None, depends_on=[])

def add(a, b):
    """Addition: c = a + b."""
    # TODO: Implement
    # result.backward_fn should compute grad_a and grad_b
    # grad_a = grad_c, grad_b = grad_c
    pass

def multiply(a, b):
    """Multiplication: c = a * b."""
    # TODO: Implement
    # grad_a = grad_c * b.value
    # grad_b = grad_c * a.value
    pass

def square(a):
    """Square: b = a^2."""
    # TODO: Implement
    # grad_a = 2 * a.value * grad_b
    pass

def numerical_gradient(f, x, eps=1e-5):
    """
    Compute numerical gradient of f at x via finite differences.

    f: function that takes scalar, returns scalar
    x: evaluation point
    """
    grad_num = (f(x + eps) - f(x - eps)) / (2 * eps)
    return grad_num

if __name__ == "__main__":
    # Example: gradient of f(x) = (3*x)^2
    x = Variable(2.0)

    # Build graph: y = (3*x)^2
    temp = multiply(3.0, x)
    y = square(temp)

    # Backward pass
    y.backward(grad=1.0)

    # Check: df/dx at x=2 should be 2*(3*2)*3 = 36
    grad_auto = x.grad
    print(f"Autodiff gradient: {grad_auto}")

    # Numerical check
    f = lambda t: (3*t)**2
    grad_num = numerical_gradient(f, 2.0)
    print(f"Numerical gradient: {grad_num}")

    error = abs(grad_auto - grad_num) / (abs(grad_num) + 1e-8)
    print(f"Relative error: {error:.2e}")

    assert error < 1e-4, f"Gradient check failed: {error}"
    print("Gradient check passed!")
'''
        test_code = '''"""
Tests for autodiff lab.
"""
import pytest
import numpy as np
from autodiff import (
    Variable, Node, add, multiply, square, numerical_gradient
)

def test_add_gradient():
    """Test addition gradient."""
    x = Variable(2.0)
    y = Variable(3.0)
    z = add(x, y)

    z.backward(grad=1.0)

    assert x.grad == 1.0
    assert y.grad == 1.0

def test_multiply_gradient():
    """Test multiplication gradient."""
    x = Variable(2.0)
    y = Variable(3.0)
    z = multiply(x, y)

    z.backward(grad=1.0)

    assert x.grad == 3.0, f"Expected x.grad=3.0, got {x.grad}"
    assert y.grad == 2.0, f"Expected y.grad=2.0, got {y.grad}"

def test_square_gradient():
    """Test square gradient."""
    x = Variable(3.0)
    y = square(x)

    y.backward(grad=1.0)

    # dy/dx = 2*x = 6
    assert x.grad == 6.0

def test_composition_gradient():
    """Test gradient through composition: f(x) = (2*x)^2."""
    x = Variable(2.0)
    temp = multiply(2.0, x)
    y = square(temp)

    y.backward(grad=1.0)

    # dy/dx = 2*(2*x)*2 = 8*x = 16
    assert x.grad == 16.0

def test_gradient_check_polynomial():
    """Verify autodiff against numerical gradient."""
    # f(x) = x^2 + 2*x
    f = lambda x: x**2 + 2*x

    x_val = 3.0
    x = Variable(x_val)
    x_sq = square(x)
    two_x = multiply(2.0, x)
    y = add(x_sq, two_x)

    y.backward(grad=1.0)

    grad_auto = x.grad
    grad_num = numerical_gradient(f, x_val)

    error = abs(grad_auto - grad_num) / (abs(grad_num) + 1e-8)
    assert error < 1e-4

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
'''
        readme = """# Lab: Minimal Autodiff
## Objectives
- Implement reverse-mode automatic differentiation
- Build a computational graph
- Verify gradients via finite differences
- Understand backpropagation
## Concepts
- Computational graphs
- Forward pass (evaluation)
- Backward pass (gradient accumulation)
- Chain rule
- Numerical gradient checking
## Deliverables
- `autodiff.py`: Node class and operations (add, multiply, square)
- `tests_pass.txt`: Output from pytest
- `grad_check_error.txt`: Numerical gradient check results
## Success Criteria
- All unit tests pass
- Gradient check error < 1e-4 for all test cases
- Correctly implements chain rule for nested operations
- Handles scalar values only (no arrays)
## Notes
- Start with simple operations: add, multiply, square
- Extend to more operations if desired: sin, exp, log
- Test each operation independently before composition
"""
        return {
            "main_code": main_code,
            "test_code": test_code,
            "readme": readme,
        }
    @staticmethod
    def _lab_logistic() -> dict[str, str]:
        """Logistic regression with Adam optimizer."""
        main_code = '''"""
Lab: Binary Logistic Regression + Adam Optimizer
Implement logistic regression with Adam optimizer:
  1. Sigmoid: σ(z) = 1 / (1 + e^{-z})
  2. Cross-entropy loss: -[y*log(ŷ) + (1-y)*log(1-ŷ)]
  3. Gradient: ∇L = (1/n) * X^T (σ(Xw+b) - y)
  4. Adam: momentum + adaptive learning rates
Compare with sklearn.linear_model.LogisticRegression.
"""
import numpy as np
import matplotlib.pyplot as plt

def sigmoid(z):
    """Sigmoid function, clipped for stability."""
    return 1.0 / (1.0 + np.exp(-np.clip(z, -500, 500)))

def cross_entropy_loss(y_true, y_pred):
    """Binary cross-entropy loss."""
    eps = 1e-15
    y_pred = np.clip(y_pred, eps, 1 - eps)
    return -np.mean(y_true * np.log(y_pred) + (1 - y_true) * np.log(1 - y_pred))

def logistic_train_adam(X, y, lr=0.01, max_iters=1000, beta1=0.9, beta2=0.999, eps=1e-8):
    """
    Train logistic regression with Adam optimizer.

    Args:
        X: (n_samples, n_features)
        y: (n_samples,) binary labels in {0, 1}
        lr: learning rate
        max_iters: max iterations
        beta1, beta2: Adam parameters
        eps: numerical stability constant

    Returns:
        w: (n_features,) learned weights
        b: scalar bias
        losses: list of loss values
    """
    # TODO: Implement Adam optimizer for logistic regression
    # 1. Initialize w, b to zero
    # 2. Initialize m_w, v_w, m_b, v_b to zero (first/second moments)
    # 3. For each iteration t:
    #    - Forward: yhat = sigmoid(X @ w + b)
    #    - Loss: L = cross_entropy_loss(y, yhat)
    #    - Gradients: grad_w = X.T @ (yhat - y) / n, grad_b = mean(yhat - y)
    #    - Update moments:
    #      m_w = beta1*m_w + (1-beta1)*grad_w
    #      v_w = beta2*v_w + (1-beta2)*grad_w^2
    #      (same for b)
    #    - Bias correction:
    #      m_w_hat = m_w / (1 - beta1^t)
    #      v_w_hat = v_w / (1 - beta2^t)
    #      (same for b)
    #    - Update: w -= lr * m_w_hat / (sqrt(v_w_hat) + eps)
    # 4. Return w, b, losses
    pass

def logistic_predict(X, w, b, threshold=0.5):
    """Predict binary labels."""
    return (sigmoid(X @ w + b) > threshold).astype(int)

def accuracy(y_true, y_pred):
    """Compute accuracy."""
    return np.mean(y_true == y_pred)

def roc_auc(y_true, y_prob):
    """Compute ROC AUC score (simplified: use sklearn if available)."""
    try:
        from sklearn.metrics import roc_auc_score
        return roc_auc_score(y_true, y_prob)
    except ImportError:
        # Fallback: simple AUC approximation
        sorted_idx = np.argsort(-y_prob)
        sorted_y = y_true[sorted_idx]
        n_pos = np.sum(y_true)
        n_neg = len(y_true) - n_pos
        tp_cumsum = np.cumsum(sorted_y)
        auc = (np.sum(tp_cumsum[np.where(sorted_y == 0)]) - n_neg * (n_neg + 1) / 2) / (n_pos * n_neg)
        return auc

if __name__ == "__main__":
    # Generate binary classification data
    rng = np.random.default_rng(42)
    n_samples = 200
    n_features = 10

    X = rng.normal(0, 1, (n_samples, n_features))
    w_true = rng.normal(0, 0.5, n_features)
    y = (sigmoid(X @ w_true) > 0.5).astype(int)

    # Add noise
    noise_idx = rng.choice(n_samples, size=20, replace=False)
    y[noise_idx] = 1 - y[noise_idx]

    # Train
    w, b, losses = logistic_train_adam(X, y, lr=0.1, max_iters=1000)

    # Evaluate
    y_pred = logistic_predict(X, w, b)
    acc = accuracy(y, y_pred)
    y_prob = sigmoid(X @ w + b)
    auc = roc_auc(y, y_prob)

    print(f"Accuracy: {acc:.4f}")
    print(f"ROC AUC: {auc:.4f}")

    # Plot loss curve
    plt.figure(figsize=(10, 5))
    plt.plot(losses)
    plt.xlabel("Iteration")
    plt.ylabel("Loss (Cross-Entropy)")
    plt.title("Logistic Regression: Training Loss (Adam)")
    plt.grid()
    plt.savefig("logistic_loss_curve.png", dpi=100)
    print("Saved: logistic_loss_curve.png")

    # Save metrics
    with open("logistic_metrics.txt", "w") as f:
        f.write(f"Accuracy: {acc:.4f}\\n")
        f.write(f"ROC AUC: {auc:.4f}\\n")
    print("Saved: logistic_metrics.txt")
'''
        test_code = '''"""
Tests for logistic regression lab.
"""
import pytest
import numpy as np
from logistic_adam import (
    sigmoid, cross_entropy_loss, logistic_train_adam,
    logistic_predict, accuracy, roc_auc
)

def test_sigmoid():
    """Test sigmoid function."""
    assert np.isclose(sigmoid(0), 0.5)
    assert sigmoid(10) > 0.99
    assert sigmoid(-10) < 0.01

def test_cross_entropy():
    """Test cross-entropy loss."""
    y_true = np.array([1., 0., 1.])
    y_pred = np.array([0.9, 0.1, 0.8])

    loss = cross_entropy_loss(y_true, y_pred)
    assert loss > 0
    assert loss < 1  # Should be reasonable

def test_logistic_converges():
    """Test that logistic regression converges."""
    # Simple separable data
    X = np.array([[0., 0.], [1., 1.], [0., 1.], [1., 0.]])
    y = np.array([0, 1, 0, 1])

    w, b, losses = logistic_train_adam(X, y, lr=0.1, max_iters=500)

    assert len(losses) > 0
    # Loss should decrease
    assert losses[-1] < losses[0]

def test_accuracy_metric():
    """Test accuracy computation."""
    y_true = np.array([1, 1, 0, 0])
    y_pred = np.array([1, 1, 0, 1])

    acc = accuracy(y_true, y_pred)
    assert acc == 0.75

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
'''
        readme = """# Lab: Logistic Regression with Adam
## Objectives
- Implement binary logistic regression
- Implement Adam optimizer
- Train and evaluate a classifier
- Compare with sklearn
## Concepts
- Sigmoid activation
- Cross-entropy loss
- Gradient-based optimization
- Adam: adaptive moments
- Model evaluation (accuracy, ROC AUC)
## Deliverables
- `logistic_adam.py`: Full implementation
- `logistic_loss_curve.png`: Training loss curve
- `logistic_metrics.txt`: Accuracy and AUC
- `test_logistic.py`: Unit tests (all passing)
## Success Criteria
- Converges: final loss < initial loss
- Accuracy > 0.75 on synthetic data
- ROC AUC > 0.80
- All unit tests pass
- Loss decreases monotonically
"""
        return {
            "main_code": main_code,
            "test_code": test_code,
            "readme": readme,
        }
    @staticmethod
    def _lab_naive_bayes() -> dict[str, str]:
        """Naive Bayes classifier."""
        main_code = '''"""
Lab: Naive Bayes Classifier (Bernoulli & Multinomial)
Implement Naive Bayes for text classification:
  - P(y|x) ∝ P(y) * ∏_i P(x_i|y)
  - Bernoulli: P(x_i|y) for binary features
  - Multinomial: P(x_i|y) for word counts
"""
import numpy as np

class NaiveBayesBernoulli:
    """Naive Bayes with Bernoulli features (binary)."""

    def __init__(self, alpha=1.0):
        """alpha: Laplace smoothing parameter."""
        self.alpha = alpha
        self.class_priors = None
        self.feature_log_probs = None
        self.classes = None

    def fit(self, X, y):
        """
        Train on data.

        Args:
            X: (n_samples, n_features) binary array {0, 1}
            y: (n_samples,) class labels
        """
        # TODO: Implement
        # 1. Get unique classes
        # 2. Compute class priors: P(y=c) = count(y==c) / n
        # 3. For each class c, compute P(x_i=1|y=c)
        #    = (count(x_i==1 & y==c) + alpha) / (count(y==c) + 2*alpha)
        # 4. Store as log probabilities for numerical stability
        pass

    def predict(self, X):
        """Predict class labels."""
        # TODO: Implement
        # For each sample, compute log P(y|x) for each class
        # Return argmax
        pass

class NaiveBayesMultinomial:
    """Naive Bayes with Multinomial features (word counts)."""

    def __init__(self, alpha=1.0):
        """alpha: Laplace smoothing parameter."""
        self.alpha = alpha
        self.class_priors = None
        self.feature_log_probs = None
        self.classes = None

    def fit(self, X, y):
        """
        Train on data.

        Args:
            X: (n_samples, n_features) count array
            y: (n_samples,) class labels
        """
        # TODO: Implement
        # 1. Get unique classes
        # 2. Compute class priors
        # 3. For each feature i and class c:
        #    P(x_i|y=c) = (sum of x_i for y==c + alpha) /
        #                  (sum of all x for y==c + alpha*n_features)
        # 4. Store as log probabilities
        pass

    def predict(self, X):
        """Predict class labels."""
        # TODO: Implement
        pass

if __name__ == "__main__":
    # Simple synthetic data
    rng = np.random.default_rng(42)

    X_train = np.random.randint(0, 2, (100, 10))
    y_train = np.random.randint(0, 2, 100)

    X_test = np.random.randint(0, 2, (20, 10))
    y_test = np.random.randint(0, 2, 20)

    # Train Bernoulli NB
    nb = NaiveBayesBernoulli(alpha=1.0)
    nb.fit(X_train, y_train)
    y_pred = nb.predict(X_test)

    acc = np.mean(y_pred == y_test)
    print(f"Bernoulli NB Accuracy: {acc:.4f}")

    # Compare with sklearn
    try:
        from sklearn.naive_bayes import BernoulliNB
        sklearn_nb = BernoulliNB(alpha=1.0)
        sklearn_nb.fit(X_train, y_train)
        sklearn_pred = sklearn_nb.predict(X_test)

        acc_sklearn = np.mean(sklearn_pred == y_test)
        print(f"sklearn BernoulliNB Accuracy: {acc_sklearn:.4f}")
    except ImportError:
        print("sklearn not available for comparison")
'''
        test_code = '''"""
Tests for Naive Bayes lab.
"""
import pytest
import numpy as np
from naive_bayes import NaiveBayesBernoulli, NaiveBayesMultinomial

def test_bernoulli_basic():
    """Test Bernoulli NB on simple data."""
    X = np.array([[1, 0], [0, 1], [1, 1], [0, 0]])
    y = np.array([0, 0, 1, 1])

    nb = NaiveBayesBernoulli()
    nb.fit(X, y)
    pred = nb.predict(X)

    assert pred.shape == (4,)
    assert all(p in [0, 1] for p in pred)

def test_multinomial_basic():
    """Test Multinomial NB on simple data."""
    X = np.array([[1, 2], [2, 3], [3, 2], [0, 1]])
    y = np.array([0, 0, 1, 1])

    nb = NaiveBayesMultinomial()
    nb.fit(X, y)
    pred = nb.predict(X)

    assert pred.shape == (4,)

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
'''
        readme = """# Lab: Naive Bayes Classifier
## Objectives
- Implement Bernoulli and Multinomial Naive Bayes
- Understand conditional independence assumption
- Apply to binary and multi-class problems
- Evaluate and compare with sklearn
## Concepts
- Bayes' theorem
- Conditional independence assumption
- Laplace smoothing
- Log-probability trick
- Text classification
## Deliverables
- `naive_bayes.py`: Bernoulli and Multinomial implementations
- `confusion_matrix.png`: Visualization of predictions
- `nb_accuracy.txt`: Accuracy metrics
- `test_naive_bayes.py`: Unit tests (all passing)
## Success Criteria
- Correct computation of class priors
- Proper Laplace smoothing
- Accuracy competitive with sklearn
- All unit tests pass
"""
        return {
            "main_code": main_code,
            "test_code": test_code,
            "readme": readme,
        }
    @staticmethod
    def _lab_bootstrap() -> dict[str, str]:
        """Bootstrap confidence intervals."""
        main_code = '''"""
Lab: Bootstrap Confidence Intervals
Implement bootstrap resampling to compute confidence intervals for:
  - Model accuracy
  - ROC AUC
  - Other metrics
Methods:
  - Percentile CI
  - BCa (bias-corrected and accelerated)
"""
import numpy as np

def bootstrap_ci(metric_vals, alpha=0.95, B=10000, method='percentile', seed=42):
    """
    Compute bootstrap confidence interval for a metric.

    Args:
        metric_vals: (n,) array of metric values or callable
        alpha: confidence level (e.g., 0.95 for 95% CI)
        B: number of bootstrap samples
        method: 'percentile' or 'bca'
        seed: random seed

    Returns:
        lo, hi: confidence interval bounds
    """
    # TODO: Implement
    # 1. Initialize RNG with seed
    # 2. For b in range(B):
    #    - Sample n values from metric_vals with replacement
    #    - Compute statistic (mean, median, etc.)
    #    - Store in bootstrap_stats
    # 3. If method == 'percentile':
    #    - CI = [percentile(bootstrap_stats, (1-alpha)/2 * 100),
    #            percentile(bootstrap_stats, (1+alpha)/2 * 100)]
    # 4. Return CI bounds
    pass

def bootstrap_ci_bca(metric_vals, alpha=0.95, B=10000, seed=42):
    """
    Bias-corrected and accelerated bootstrap CI.
    (Advanced: optional extension)
    """
    pass

if __name__ == "__main__":
    # Example: Bootstrap CI for accuracy
    rng = np.random.default_rng(42)

    # Simulate accuracy values from repeated cross-validation
    np.random.seed(42)
    accuracies = rng.normal(0.85, 0.05, 50)  # Mean 0.85, std 0.05

    ci_lo, ci_hi = bootstrap_ci(accuracies, alpha=0.95, B=10000)

    print(f"95% Bootstrap CI for Accuracy: [{ci_lo:.4f}, {ci_hi:.4f}]")

    # Visualize
    import matplotlib.pyplot as plt

    plt.figure(figsize=(10, 6))
    plt.hist(accuracies, bins=20, alpha=0.7, label='Original values')
    plt.axvline(ci_lo, color='red', linestyle='--', label=f'CI: [{ci_lo:.4f}, {ci_hi:.4f}]')
    plt.axvline(ci_hi, color='red', linestyle='--')
    plt.xlabel("Accuracy")
    plt.ylabel("Frequency")
    plt.title("Bootstrap Confidence Interval")
    plt.legend()
    plt.savefig("bootstrap_ci_plot.png", dpi=100)
    print("Saved: bootstrap_ci_plot.png")
'''
        test_code = '''"""
Tests for bootstrap lab.
"""
import pytest
import numpy as np
from bootstrap_ci import bootstrap_ci

def test_bootstrap_ci_basic():
    """Test bootstrap CI computation."""
    rng = np.random.default_rng(42)
    data = rng.normal(0, 1, 100)

    lo, hi = bootstrap_ci(data, alpha=0.95, B=1000)

    # CI should be symmetric around mean for normal data
    mean = np.mean(data)
    assert lo < mean < hi

def test_bootstrap_ci_coverage():
    """Test that CI is reasonable."""
    rng = np.random.default_rng(42)
    data = rng.normal(10, 2, 200)

    lo, hi = bootstrap_ci(data, alpha=0.95, B=1000)

    # CI width should be reasonable
    width = hi - lo
    std = np.std(data)

    assert width < 4 * std  # Rough sanity check

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
'''
        readme = """# Lab: Bootstrap Confidence Intervals
## Objectives
- Implement bootstrap resampling
- Compute confidence intervals without distributional assumptions
- Understand percentile and BCa methods
- Apply to model evaluation metrics
## Concepts
- Resampling with replacement
- Bootstrap distribution
- Percentile method
- Bias-corrected and accelerated (BCa) bootstrap
- Non-parametric inference
## Deliverables
- `bootstrap_ci.py`: Percentile and optional BCa implementation
- `ci_report.md`: Summary of CI computations
- `bootstrap_ci_plot.png`: Visualization
- `test_bootstrap.py`: Unit tests (all passing)
## Success Criteria
- CI bounds contain true statistic (coverage)
- CI width is reasonable
- Handles different data sizes
- All unit tests pass
"""
        return {
            "main_code": main_code,
            "test_code": test_code,
            "readme": readme,
        }
    @staticmethod
    def _lab_knn_metrics() -> dict[str, str]:
        """kNN metric comparison."""
        main_code = '''"""
Lab: kNN with Different Metrics (L2 vs Cosine)
Compare kNN performance under different distance metrics:
  - Euclidean (L2): sqrt(sum((x-y)^2))
  - Manhattan (L1): sum(|x-y|)
  - Cosine: 1 - (x·y) / (||x|| ||y||)
Experiment on text embeddings or other datasets.
"""
import numpy as np

def euclidean_distance(X, x):
    """Compute Euclidean (L2) distance from x to all rows of X."""
    # TODO: ||X - x||_2 = sqrt(sum((X - x)^2, axis=1))
    pass

def cosine_distance(X, x):
    """Compute cosine distance from x to all rows of X."""
    # TODO: 1 - (X·x) / (||X|| * ||x||)
    pass

def manhattan_distance(X, x):
    """Compute Manhattan (L1) distance from x to all rows of X."""
    # TODO: sum(|X - x|, axis=1)
    pass

class KNNClassifier:
    """Simple k-Nearest Neighbors classifier."""

    def __init__(self, k=3, metric='euclidean'):
        """
        Args:
            k: number of neighbors
            metric: 'euclidean', 'cosine', or 'manhattan'
        """
        self.k = k
        self.metric = metric
        self.X_train = None
        self.y_train = None

    def fit(self, X, y):
        """Store training data."""
        self.X_train = X
        self.y_train = y

    def predict(self, X_test):
        """Predict labels for test data."""
        # TODO: For each test sample:
        # 1. Compute distances to all training samples
        # 2. Find k nearest neighbors
        # 3. Return majority class vote
        pass

def evaluate_metric(X_train, y_train, X_test, y_test, metric, k=5):
    """Train and evaluate kNN with given metric."""
    knn = KNNClassifier(k=k, metric=metric)
    knn.fit(X_train, y_train)
    y_pred = knn.predict(X_test)

    acc = np.mean(y_pred == y_test)
    return acc

if __name__ == "__main__":
    # Generate synthetic data
    rng = np.random.default_rng(42)
    n_train = 200
    n_test = 50
    n_features = 20
    n_classes = 3

    X_train = rng.normal(0, 1, (n_train, n_features))
    y_train = rng.integers(0, n_classes, n_train)

    X_test = rng.normal(0, 1, (n_test, n_features))
    y_test = rng.integers(0, n_classes, n_test)

    # Evaluate each metric
    metrics = ['euclidean', 'cosine', 'manhattan']
    results = {}

    for metric in metrics:
        acc = evaluate_metric(X_train, y_train, X_test, y_test, metric, k=5)
        results[metric] = acc
        print(f"{metric:12s}: {acc:.4f}")

    # Save results
    with open("knn_metric_ablation.txt", "w") as f:
        for metric, acc in results.items():
            f.write(f"{metric:12s}: {acc:.4f}\\n")
    print("\\nSaved: knn_metric_ablation.txt")
'''
        test_code = '''"""
Tests for kNN metrics lab.
"""
import pytest
import numpy as np
from knn_metrics import (
    euclidean_distance, cosine_distance, manhattan_distance,
    KNNClassifier, evaluate_metric
)

def test_euclidean_distance():
    """Test Euclidean distance computation."""
    X = np.array([[0., 0.], [3., 4.]])
    x = np.array([0., 0.])

    dist = euclidean_distance(X, x)

    assert dist[0] == pytest.approx(0.0)
    assert dist[1] == pytest.approx(5.0)

def test_cosine_distance():
    """Test cosine distance."""
    X = np.array([[1., 0.], [0., 1.]])
    x = np.array([1., 0.])

    dist = cosine_distance(X, x)

    assert dist[0] == pytest.approx(0.0)  # Same direction
    assert dist[1] == pytest.approx(1.0)  # Orthogonal

def test_knn_predict():
    """Test kNN prediction."""
    X_train = np.array([[0., 0.], [1., 1.], [10., 10.]])
    y_train = np.array([0, 0, 1])

    knn = KNNClassifier(k=1, metric='euclidean')
    knn.fit(X_train, y_train)

    # Test point [0.1, 0.1] should be nearest to [0, 0]
    y_pred = knn.predict(np.array([[0.1, 0.1]]))
    assert y_pred[0] == 0

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
'''
        readme = """# Lab: kNN with Different Metrics
## Objectives
- Implement multiple distance metrics
- Compare kNN performance across metrics
- Understand geometry of feature spaces
- Evaluate on text or standard datasets
## Concepts
- Euclidean (L2) distance
- Cosine similarity
- Manhattan (L1) distance
- Nearest neighbors search
- Metric selection and data properties
## Deliverables
- `knn_metrics.py`: Distance functions and kNN classifier
- `metric_ablation.txt`: Accuracy for each metric
- `accuracy_comparison.png`: Visualization
- `test_knn.py`: Unit tests (all passing)
## Success Criteria
- All distance functions implemented correctly
- kNN works with multiple metrics
- Comparison shows meaningful differences
- All unit tests pass
"""
        return {
            "main_code": main_code,
            "test_code": test_code,
            "readme": readme,
        }
    @staticmethod
    def _lab_softmax() -> dict[str, str]:
        """Softmax classifier with cross-entropy."""
        main_code = '''"""
Lab: Softmax Classifier with Cross-Entropy Loss
Multi-class classifier:
  - Softmax: p_i = e^{z_i} / sum(e^{z_j})
  - Cross-entropy: L = -sum(y_k * log(p_k))
  - SGD or Adam training
"""
import numpy as np
import matplotlib.pyplot as plt

def softmax(z):
    """Softmax function (numerically stable)."""
    z_shifted = z - np.max(z, axis=1, keepdims=True)
    exp_z = np.exp(z_shifted)
    return exp_z / np.sum(exp_z, axis=1, keepdims=True)

def cross_entropy(y_true, y_pred):
    """Cross-entropy loss."""
    eps = 1e-15
    y_pred = np.clip(y_pred, eps, 1 - eps)
    return -np.mean(np.sum(y_true * np.log(y_pred), axis=1))

class SoftmaxClassifier:
    """Multi-class classifier with softmax and cross-entropy."""

    def __init__(self, n_classes, learning_rate=0.01, max_iters=1000):
        self.n_classes = n_classes
        self.learning_rate = learning_rate
        self.max_iters = max_iters
        self.W = None
        self.b = None

    def fit(self, X, y):
        """
        Train the classifier.

        Args:
            X: (n_samples, n_features)
            y: (n_samples,) class labels in {0, ..., n_classes-1}
        """
        # TODO: Implement training
        # 1. Initialize W and b
        # 2. Convert y to one-hot: y_one_hot
        # 3. For each iteration:
        #    - Forward: z = X @ W + b, p = softmax(z)
        #    - Loss: L = cross_entropy(y_one_hot, p)
        #    - Backward: dW = X.T @ (p - y_one_hot) / n
        #               db = mean(p - y_one_hot, axis=0)
        #    - Update: W -= lr * dW, b -= lr * db
        pass

    def predict(self, X):
        """Predict class labels."""
        z = X @ self.W + self.b
        p = softmax(z)
        return np.argmax(p, axis=1)

if __name__ == "__main__":
    # Generate synthetic multi-class data
    rng = np.random.default_rng(42)
    n_samples = 300
    n_features = 10
    n_classes = 3

    X = rng.normal(0, 1, (n_samples, n_features))
    y = rng.integers(0, n_classes, n_samples)

    # Train
    clf = SoftmaxClassifier(n_classes=n_classes, learning_rate=0.1, max_iters=500)
    clf.fit(X, y)

    # Predict
    y_pred = clf.predict(X)
    acc = np.mean(y_pred == y)

    print(f"Accuracy: {acc:.4f}")

    # Visualize decision regions (if 2D)
    if n_features == 2:
        xx, yy = np.meshgrid(
            np.linspace(X[:, 0].min() - 1, X[:, 0].max() + 1, 100),
            np.linspace(X[:, 1].min() - 1, X[:, 1].max() + 1, 100)
        )
        Z = clf.predict(np.c_[xx.ravel(), yy.ravel()])
        Z = Z.reshape(xx.shape)

        plt.figure(figsize=(10, 8))
        plt.contourf(xx, yy, Z, alpha=0.3, cmap='viridis')
        plt.scatter(X[:, 0], X[:, 1], c=y, cmap='viridis', s=20, edgecolors='k')
        plt.title("Softmax Classifier Decision Regions")
        plt.xlabel("Feature 1")
        plt.ylabel("Feature 2")
        plt.savefig("softmax_decision_regions.png", dpi=100)
        print("Saved: softmax_decision_regions.png")
'''
        test_code = '''"""
Tests for softmax classifier lab.
"""
import pytest
import numpy as np
from softmax_ce import (
    softmax, cross_entropy, SoftmaxClassifier
)

def test_softmax_basic():
    """Test softmax normalization."""
    Z = np.array([[1., 2., 3.], [0., 0., 0.]])
    p = softmax(Z)

    # Check probabilities sum to 1
    assert np.allclose(np.sum(p, axis=1), 1.0)

    # Check in range [0, 1]
    assert np.all(p >= 0) and np.all(p <= 1)

def test_softmax_invariance():
    """Test softmax invariance under shifting."""
    Z = np.array([[1., 2., 3.]])
    Z_shifted = Z + 100

    p1 = softmax(Z)
    p2 = softmax(Z_shifted)

    assert np.allclose(p1, p2)

def test_cross_entropy_zero():
    """Test cross-entropy for perfect prediction."""
    y_true = np.array([[1., 0., 0.]])
    y_pred = np.array([[0.99, 0.005, 0.005]])

    loss = cross_entropy(y_true, y_pred)
    assert loss < 0.1

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
'''
        readme = """# Lab: Softmax Classifier with Cross-Entropy
## Objectives
- Implement multi-class classification
- Understand softmax and cross-entropy
- Train and evaluate on synthetic data
- Visualize decision regions
## Concepts
- Softmax activation for multi-class
- Cross-entropy loss
- Numerical stability
- Gradient computation for multi-class
- Decision boundaries
## Deliverables
- `softmax_ce.py`: Softmax classifier implementation
- `decision_plot.png`: Decision region visualization
- `loss_analysis.txt`: Loss and accuracy metrics
- `test_softmax.py`: Unit tests (all passing)
## Success Criteria
- Softmax outputs valid probabilities
- Cross-entropy decreases during training
- Accuracy improves during training
- Numerical stability handled (no NaN/inf)
- All unit tests pass
"""
        return {
            "main_code": main_code,
            "test_code": test_code,
            "readme": readme,
        }

def write_lab_files(lab_id: str, output_dir: str | Path = ".") -> None:
    """
    Write lab files to disk.

    Args:
        lab_id: Lab identifier
        output_dir: Directory to write files
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    generator = LabGenerator()
    lab_files = generator.generate_lab(lab_id)

    # Write main code
    main_file = output_dir / f"{lab_id}_starter.py"
    with open(main_file, "w") as f:
        f.write(lab_files["main_code"])
    print(f"Wrote: {main_file}")

    # Write tests
    test_file = output_dir / f"{lab_id}_test.py"
    with open(test_file, "w") as f:
        f.write(lab_files["test_code"])
    print(f"Wrote: {test_file}")

    # Write readme
    readme_file = output_dir / f"{lab_id}_README.md"
    with open(readme_file, "w") as f:
        f.write(lab_files["readme"])
    print(f"Wrote: {readme_file}")

if __name__ == "__main__":
    # Example: generate all labs

    output_base = Path("labs")
    output_base.mkdir(exist_ok=True)

    generator = LabGenerator()
    for lab_id in generator.labs.keys():
        output_dir = output_base / lab_id
        write_lab_files(lab_id, output_dir)
        print()
