# Lab Generator Integration Guide

Quick integration checklist for adding the curriculum lab system to your project.

## 📋 Checklist

### Phase 1: Setup (5 min)
- [x] `lab_generator.py` created at `python/lab_generator.py`
- [x] CLI script `generate_labs.py` at `python/generate_labs.py`
- [x] Documentation `LAB_GENERATOR_README.md` at `python/LAB_GENERATOR_README.md`
- [x] Examples `lab_generator_examples.py` at `python/lab_generator_examples.py`

### Phase 2: Generate Labs (2 min)
```bash
cd coltens\ world/python
python generate_labs.py                    # Generate all 8 labs
```

Output directory structure:
```
python/labs/
├── la01_regression_from_scratch/
│   ├── la01_regression_from_scratch_starter.py
│   ├── la01_regression_from_scratch_test.py
│   └── la01_regression_from_scratch_README.md
├── la02_pca_scratch/
├── opt01_autodiff_mini/
├── opt02_logistic_from_scratch/
├── ps01_naive_bayes/
├── ps02_bootstrap_ci/
├── geo01_knn_metrics/
└── info01_softmax_ce/
```

### Phase 3: Test & Validate (5 min)

```bash
# Test single lab
cd python/labs/la01_regression_from_scratch
pytest la01_regression_from_scratch_test.py -v

# Run example analysis
cd python
python lab_generator_examples.py
```

### Phase 4: Integration with Course Platform (Optional)

For LMS (Canvas, Blackboard, etc.):
1. Upload `{lab_id}_starter.py` as student template
2. Display `{lab_id}_README.md` as assignment description
3. Configure autograder to run `pytest {lab_id}_test.py`

For GitHub Classroom:
1. Create repository with `labs/` directory
2. Add `.github/workflows/autograder.yml` to run pytest
3. Students fork and submit completed `*_starter.py` files

## 🚀 Quick Commands

```bash
# Generate all labs
python generate_labs.py

# Generate specific lab
python generate_labs.py la01_regression

# List all labs
python generate_labs.py --list

# Custom output directory
python generate_labs.py --output "./curriculum"

# Run examples
python lab_generator_examples.py

# Generate metadata
python -c "from lab_generator_examples import example_3_serialize_to_json; example_3_serialize_to_json()"
```

## 📚 Lab Catalog

| Lab | Type | Topics | Lines | Tests |
|-----|------|--------|-------|-------|
| `la01_regression_from_scratch` | Core | Normal eq, GD, MSE | ~200 | 3 |
| `la02_pca_scratch` | Core | Eigendecomposition, variance reduction | ~200 | 3 |
| `opt01_autodiff_mini` | Advanced | Computational graphs, backprop, AD | ~180 | 5 |
| `opt02_logistic_from_scratch` | Core | Sigmoid, cross-entropy, Adam | ~220 | 4 |
| `ps01_naive_bayes` | Core | Bayes, independence, Laplace smoothing | ~150 | 2 |
| `ps02_bootstrap_ci` | Intermediate | Resampling, non-parametric inference | ~120 | 2 |
| `geo01_knn_metrics` | Core | Distance metrics, nearest neighbor | ~160 | 3 |
| `info01_softmax_ce` | Core | Multi-class, softmax, cross-entropy | ~200 | 3 |

**Total:** 8 labs, ~1500 lines of starter code, ~25 unit tests

## 🎯 Suggested Curriculum Sequence

### Semester 1: Fundamentals
1. **Week 1-2**: `la01_regression_from_scratch` (linear models)
2. **Week 3-4**: `la02_pca_scratch` (unsupervised learning)
3. **Week 5-6**: `geo01_knn_metrics` (instance-based learning)
4. **Week 7-8**: `ps01_naive_bayes` (probabilistic models)

### Semester 2: Advanced
5. **Week 1-2**: `opt02_logistic_from_scratch` (binary classification)
6. **Week 3-4**: `info01_softmax_ce` (multi-class classification)
7. **Week 5-6**: `opt01_autodiff_mini` (deep learning intro)
8. **Week 7-8**: `ps02_bootstrap_ci` (statistical inference)

## 🔧 Customization Points

### Modify Difficulty

Edit lab generator methods to adjust TODOs:

```python
# Easy: Verbose TODOs
# TODO: Step 1 - compute X^T @ X
# TODO: Step 2 - invert the matrix
# TODO: Step 3 - multiply by X^T @ y

# Hard: Minimal TODOs
# TODO: Implement (X^T X)^{-1} X^T y
```

### Add Reference Solutions

Create hidden `*_solution.py` files:

```python
# Only distribute to instructors
labs/
├── la01_regression_from_scratch/
│   ├── la01_regression_from_scratch_starter.py   (for students)
│   ├── la01_regression_from_scratch_test.py      (for students)
│   ├── la01_regression_from_scratch_README.md    (for students)
│   └── LA01_regression_from_scratch_SOLUTION.py  (instructor only)
```

### Add Extra Credit

Extend test files with `@pytest.mark.xfail` or `@pytest.mark.skip`:

```python
@pytest.mark.xfail(reason="Advanced: implement whitening")
def test_pca_whitening():
    """Optional advanced test."""
    pass
```

### Create New Labs

```python
class MyLabGenerator(LabGenerator):
    def _define_labs(self):
        labs = super()._define_labs()
        labs["my_custom_lab"] = self._lab_custom
        return labs

    @staticmethod
    def _lab_custom():
        main_code = "..."
        test_code = "..."
        readme = "..."
        return {"main_code": main_code, "test_code": test_code, "readme": readme}
```

## 📊 Analytics & Reporting

### Generate Metadata

```bash
python -c "
from lab_generator import LabGenerator
import json

gen = LabGenerator()
metadata = {}
for lab_id in gen.labs.keys():
    lab = gen.generate_lab(lab_id)
    metadata[lab_id] = {
        'starter_lines': len(lab['main_code'].split('\n')),
        'test_lines': len(lab['test_code'].split('\n')),
        'num_todos': lab['main_code'].count('TODO'),
        'num_tests': lab['test_code'].count('def test_'),
    }

with open('lab_statistics.json', 'w') as f:
    json.dump(metadata, f, indent=2)
print('Saved lab statistics')
"
```

### Track Completion

```bash
# Count passing tests per student
for lab_dir in labs/*/; do
    lab_name=$(basename "$lab_dir")
    passed=$(pytest "$lab_dir"/*_test.py -q 2>/dev/null | grep -o '[0-9]* passed' | grep -o '[0-9]*')
    echo "$lab_name: $passed tests passed"
done
```

## 🔗 Related Systems in Workspace

**Graphics Pipeline** (Previously Created):
- `python/graphics_generator.py` — 3D projection mathematics
- `python/geometry_engine.py` — Ray tracing, collision detection
- `apps/ide-web/src/pages/LabGraphicsLabPage.tsx` — Graphics workbench

**Repository Structure**:
- `coltens world/` — Inner monorepo (true source)
- `c:\Users\colte\colten projects\` — Wrapper root (Phase 2a consolidation pending)

**Build & Testing**:
- Guard rails: `.gitignore`, `repo-doctor.sh`, `enforce-contracts-truth.js`
- Pre-commit hooks: Activated guard rails prevent tracked artifacts

## 📝 Next Steps

1. **Generate labs**: `python generate_labs.py`
2. **Review starter code**: Pick a lab and examine structure
3. **Run examples**: `python lab_generator_examples.py`
4. **Create course**: Upload to LMS or GitHub Classroom
5. **Iterate**: Collect student feedback and refine labs

## 🎓 Educational Value

- **Hands-on**: Students implement algorithms from scratch
- **Structured**: Clear objectives, tests, and success criteria
- **Gradable**: Automated test suite provides instant feedback
- **Extensible**: Easy to customize difficulty and add labs
- **Reproducible**: Consistent starter code across cohorts

## 📞 Support

For questions or custom lab requests:
- Review `LAB_GENERATOR_README.md` for comprehensive guide
- Run `lab_generator_examples.py` for usage patterns
- Extend `LabGenerator` class for custom labs
- Check `generate_labs.py` CLI for all options

---

**Status**: ✅ **Production-Ready**
**Created**: 2026-02-22
**Files**: 4 (lab_generator.py, generate_labs.py, LAB_GENERATOR_README.md, lab_generator_examples.py)
**Labs**: 8 available | ~1500 lines starter code | ~25 tests
**Integration**: Ready to deploy
