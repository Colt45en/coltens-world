# Curriculum Lab Generator

Emits starter code, unit-test scaffolding, and README documentation for hands-on ML/data science curriculum labs.

## Overview

This system provides a complete scaffolding framework for building reproducible, well-documented curriculum labs. Each lab includes:

- **Starter code** with TODOs and docstrings
- **Full test suite** with unit tests for each function
- **Comprehensive README** with objectives, concepts, and success criteria

## Available Labs

| Lab ID | Title | Topics |
|--------|-------|--------|
| `la01_regression_from_scratch` | Linear Regression from Scratch | Normal equations, gradient descent, MSE |
| `la02_pca_scratch` | PCA from Scratch | Eigendecomposition, dimensionality reduction, variance |
| `opt01_autodiff_mini` | Minimal Autodiff | Reverse-mode AD, computational graphs, backprop |
| `opt02_logistic_from_scratch` | Logistic Regression + Adam | Sigmoid, cross-entropy, Adam optimizer |
| `ps01_naive_bayes` | Naive Bayes Classifier | Bayes' theorem, conditional independence, Laplace smoothing |
| `ps02_bootstrap_ci` | Bootstrap Confidence Intervals | Resampling, percentile method, non-parametric inference |
| `geo01_knn_metrics` | kNN with Different Metrics | Euclidean, Manhattan, cosine distance, metric selection |
| `info01_softmax_ce` | Softmax Classifier | Multi-class, softmax, cross-entropy, decision boundaries |

## Quick Start

### Generate All Labs

```bash
cd python
python generate_labs.py
```

This creates the `labs/` directory with subdirectories for each lab:

```
labs/
├── la01_regression_from_scratch/
│   ├── la01_regression_from_scratch_starter.py
│   ├── la01_regression_from_scratch_test.py
│   └── la01_regression_from_scratch_README.md
├── la02_pca_scratch/
│   ├── ...
├── ...
```

### Generate a Specific Lab

```bash
python generate_labs.py la01_regression
```

### List All Available Labs

```bash
python generate_labs.py --list
```

### Specify Output Directory

```bash
python generate_labs.py --output ./curriculum_labs
```

## Lab Structure

Each generated lab contains three key files:

### 1. **Starter Code** (`*_starter.py`)

- Fully commented with docstrings
- Function signatures complete, bodies are `pass` or TODO comments
- Synthetic data generators included
- Main execution block demonstrates expected usage
- Ready to run: `python la01_regression_from_scratch_starter.py`

**Example:**

```python
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
```

### 2. **Unit Tests** (`*_test.py`)

- Comprehensive test coverage
- Tests for edge cases (empty inputs, single samples, etc.)
- Numerical validation and convergence checks
- All tests initially fail (expected)
- Run with: `pytest la01_regression_from_scratch_test.py -v`

**Example:**

```python
def test_linear_regression_normal_eq_basic():
    """Test normal equations on simple data."""
    X = np.array([[1.0, 0.0], [1.0, 1.0], [1.0, 2.0]])
    y = np.array([1.0, 2.0, 3.0])
    w = linear_regression_normal_eq(X, y)

    assert w is not None
    assert w.shape == (2,)

    yhat = X @ w
    error = np.linalg.norm(yhat - y)
    assert error < 0.1, f"Fit error too large: {error}"
```

### 3. **Documentation** (`*_README.md`)

- Clear learning objectives
- Concept summaries (with math notation)
- Deliverables checklist
- Getting started guide
- Success criteria / grading rubric

**Sections:**
- Objectives
- Concepts (with equations)
- Deliverables
- Getting Started
- Success Criteria
- (Optional) Advanced Extensions

## Workflow

### For Students

1. **Read README**: Understand objectives and success criteria
2. **Study starter code**: Read docstrings and TODOs
3. **Implement functions**: Replace `pass` or TODO blocks
4. **Run tests**: `pytest *_test.py -v`
5. **Iterate**: Fix failing tests until all pass
6. **Generate outputs**: Plots, saved models, metrics
7. **Compare with baseline**: Try sklearn for validation

### For Instructors

1. **Customize context**: Fork `LabGenerator` and modify docstrings/TODOs
2. **Adjust difficulty**: Remove/add test cases
3. **Add reference implementations**: Provide hidden solutions
4. **Track progress**: Collect student submissions and grade tests
5. **Iterate**: Collect feedback and refine labs each semester

## Lab Details

### LA01: Linear Regression from Scratch

**Topics:** Normal equations, gradient descent, MSE

**Implementations:**
- `linear_regression_normal_eq(X, y)`: Closed-form solution
- `linear_regression_gd(X, y, lr, max_iters)`: Iterative solver
- Compare convergence and efficiency

**Tests:** Fit validation, convergence, NE vs GD equivalence

**Outputs:** Loss curve PNG, weight file NPY

---

### LA02: PCA from Scratch

**Topics:** Eigendecomposition, variance, dimensionality reduction

**Implementations:**
- `pca_from_covariance(X, k)`: Spectral decomposition
- `explained_variance_ratio(explained_var)`: Cumulative variance
- `reconstruct(Z, U, mean)`: Inverse mapping
- `pca_whiten(X, k)`: Whitening transformation

**Tests:** Eigenvalue sorting, variance monotonicity, reconstruction error, sklearn comparison

**Outputs:** Variance plot PNG, components NPY, projection NPY

---

### OPT01: Minimal Autodiff

**Topics:** Computational graphs, reverse-mode AD, chain rule

**Implementations:**
- `Node` class: Graph nodes with backward functions
- `Variable`: Leaf nodes (parameters)
- `add`, `multiply`, `square`: Graph operations
- `backward(grad)`: Gradient accumulation

**Tests:** Gradient correctness, chain rule, numerical gradient checking

**Success:** Gradient check error < 1e-4 on all compositions

---

### OPT02: Logistic Regression + Adam

**Topics:** Sigmoid, cross-entropy, Adam optimizer, adaptive learning rates

**Implementations:**
- `sigmoid(z)`: Numerically stable version
- `cross_entropy_loss(y_true, y_pred)`: Binary classification loss
- `logistic_train_adam(X, y, lr, max_iters, beta1, beta2)`: Full Adam training loop

**Tests:** Sigmoid properties, loss computation, convergence, accuracy > 0.75

**Outputs:** Loss curve PNG, metrics TXT

---

### PS01: Naive Bayes Classifier

**Topics:** Bayes' theorem, conditional independence, Laplace smoothing

**Implementations:**
- `NaiveBayesBernoulli`: Binary features
- `NaiveBayesMultinomial`: Count-based (text)
- Both with Laplace smoothing (α=1)

**Tests:** Basic fitting/prediction, sklearn equivalence

**Outputs:** Confusion matrix PNG, accuracy report TXT

---

### PS02: Bootstrap Confidence Intervals

**Topics:** Resampling, non-parametric statistics, percentile method

**Implementations:**
- `bootstrap_ci(metric_vals, alpha, B, method)`: Percentile CI
- `bootstrap_ci_bca()`: (Optional) Bias-corrected accelerated

**Tests:** CI bounds, coverage properties, width reasonableness

**Outputs:** Distribution plot PNG with CI overlay

---

### GEO01: kNN with Different Metrics

**Topics:** Distance metrics, nearest neighbor search, metric selection

**Implementations:**
- `euclidean_distance(X, x)`: L2 norm
- `cosine_distance(X, x)`: Cosine similarity-based
- `manhattan_distance(X, x)`: L1 norm
- `KNNClassifier`: Unified interface

**Tests:** Distance correctness (e.g., 3-4-5 triangle), prediction logic, metric ablation

**Outputs:** Accuracy comparison TXT, metric ablation plot PNG

---

### INFO01: Softmax Classifier

**Topics:** Multi-class, softmax, cross-entropy, decision regions

**Implementations:**
- `softmax(z)`: Numerically stable with shifting
- `cross_entropy(y_true, y_pred)`: Multi-class loss
- `SoftmaxClassifier`: Full training loop

**Tests:** Softmax properties (normalization, invariance), accuracy, decision regions

**Outputs:** Decision regions plot PNG, loss analysis TXT

---

## Extending the Lab Generator

### Adding a New Lab

1. **Create generator method** in `LabGenerator`:

```python
@staticmethod
def _lab_my_topic() -> dict[str, str]:
    """Description of lab."""
    main_code = '''... starter code ...'''
    test_code = '''... tests ...'''
    readme = '''... documentation ...'''
    return {
        "main_code": main_code,
        "test_code": test_code,
        "readme": readme,
    }
```

2. **Register in `_define_labs()`**:

```python
def _define_labs(self) -> dict[str, dict]:
    return {
        ...
        "my_lab_id": self._lab_my_topic,
    }
```

3. **Test generation**:

```bash
python generate_labs.py my_lab_id
```

### Customizing Difficulty

Modify starter code:

```python
# Easy: Leave function signature, add more detailed TODOs
# Medium: Require students to design function signature
# Hard: Only provide problem statement, no scaffold
```

Adjust test rigor:

```python
# Add edge case tests for harder labs
# Remove helper tests for advanced labs
```

## Integration with Curriculum

### Standalone

```bash
# Students clone and work on individual labs
cd labs/la01_regression_from_scratch
pip install -r requirements.txt  # numpy, matplotlib, pytest
python la01_regression_from_scratch_starter.py  # See scaffold
pytest la01_regression_from_scratch_test.py -v  # Run tests
```

### In a Course Platform

1. **Generate all labs**:
   ```bash
   python generate_labs.py --output /path/to/course_materials
   ```

2. **Create assignment on platform** (LMS, GitClassroom, etc.):
   - Upload `*_starter.py` and `*_test.py`
   - Display `*_README.md` as assignment description
   - Configure autograder to run `pytest`

3. **Student submission**:
   - Submit completed `*_starter.py`
   - Autograder runs tests and reports results

4. **Grading**:
   - Test pass rate (quantitative)
   - Code style / docstrings (qualitative)
   - Extra credit for advanced extensions

## Requirements

```
numpy>=1.20
matplotlib>=3.5
pytest>=6.0
scikit-learn>=1.0  # For reference implementations (optional)
```

Install:

```bash
pip install numpy matplotlib pytest scikit-learn
```

## Performance Notes

- **All labs**: Runs on CPU in seconds to < 1 minute
- **PCA, kNN**: Scale to ~10k samples without issues
- **Autodiff**: Designed for scalars; extend with array support if desired
- **Logistic/Softmax**: Batch training supports 100k+ samples

## License & Usage

These labs are part of the curriculum framework. Customize and distribute as needed for educational use.

## FAQ

**Q: Can I hide solutions for students?**
A: Provide only `*_starter.py` and `*_README.md`. Keep `*_test.py` locally or as autograder.

**Q: How do I add sklearn comparison?**
A: Already included in most labs. Students uncomment `try/except` blocks.

**Q: Can I add more TODOs?**
A: Yes, modify the generator methods or fork the class to add custom scaffolding.

**Q: How long should each lab take?**
A: ~3-6 hours for students (depending on background and difficulty level).

**Q: Can I use these with online judges (e.g., LeetCode)?**
A: Yes, but you'd need to adapt the output for platform compatibility. Test signatures remain the same.

---

**Last updated:** 2026-02-22
**Generator version:** 1.0
