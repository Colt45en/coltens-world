# Lab Generator Extension Guide

Complete reference for extending `LabGenerator` with custom labs using various design patterns.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Extension Patterns](#extension-patterns)
3. [API Reference](#api-reference)
4. [Best Practices](#best-practices)
5. [Advanced Patterns](#advanced-patterns)
6. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Pattern 1: Simple Subclassing (Easiest)

```python
from lab_generator import LabGenerator

class MyLabGenerator(LabGenerator):
    def _define_labs(self):
        labs = super()._define_labs()

        # Add your custom labs
        labs["custom_lab_01"] = self._lab_my_custom

        return labs

    @staticmethod
    def _lab_my_custom():
        return {
            "main_code": "# TODO: Implement",
            "test_code": "# Tests",
            "readme": "# My Custom Lab",
        }

# Use it
gen = MyLabGenerator()
lab = gen.generate_lab("custom_lab_01")
```

### Pattern 2: Runtime Registration (Most Flexible)

```python
from lab_extensions import RegistryLabGenerator, LabMetadata

gen = RegistryLabGenerator()

def my_lab_generator():
    return {
        "main_code": "# Code",
        "test_code": "# Tests",
        "readme": "# Readme",
    }

metadata = LabMetadata(
    lab_id="custom_lab",
    title="My Custom Lab",
    description="Description",
    difficulty="intermediate",
    duration_hours=2.0,
    topics=["python", "algorithms"],
)

gen.register_custom_lab(
    "custom_lab",
    title="My Custom Lab",
    generator_fn=my_lab_generator,
    metadata=metadata,
)

lab = gen.generate_lab("custom_lab")
```

### Pattern 3: Template-Based (Fastest for Bulk Creation)

```python
from lab_extensions import LabTemplateMixin, RegistryLabGenerator, LabSpec

class MyGenerator(LabTemplateMixin, RegistryLabGenerator):
    def __init__(self):
        super().__init__()
        self._add_template_labs()

    def _add_template_labs(self):
        # Use template for NumPy function lab
        spec = LabTemplateMixin.template_numpy_function(
            title="Implement mean() function",
            function_signature="def mean(arr):",
            docstring="Calculate arithmetic mean",
            unit_tests="def test_mean(): assert mean([1,2,3]) == 2.0",
            success_criteria="All tests pass",
        )
        self.register_template_lab("numpy_mean", spec)

gen = MyGenerator()
```

---

## Extension Patterns

### Pattern A: Simple Subclassing

**Best for:** Adding a few custom labs to the base set

**File:** Create `my_labs.py`

```python
from lab_generator import LabGenerator

class ComputerScienceLabGenerator(LabGenerator):
    """Extend with CS fundamentals labs."""

    def _define_labs(self):
        labs = super()._define_labs()
        labs.update({
            "cs01_linked_list": self._lab_linked_list,
            "cs02_binary_tree": self._lab_binary_tree,
            "cs03_hash_table": self._lab_hash_table,
        })
        return labs

    @staticmethod
    def _lab_linked_list():
        main_code = '''"""
Lab: Linked List Implementation
"""
class Node:
    def __init__(self, data):
        self.data = data
        self.next = None

class LinkedList:
    def __init__(self):
        self.head = None

    def append(self, data):
        # TODO: Append a node
        pass
'''
        test_code = '''"""Tests for LinkedList"""
def test_append():
    ll = LinkedList()
    ll.append(1)
    assert ll.head.data == 1
'''
        readme = "# Linked List Implementation\n..."

        return {
            "main_code": main_code,
            "test_code": test_code,
            "readme": readme,
        }

    # ... similar for other labs

# Usage
gen = ComputerScienceLabGenerator()
gen.generate_lab("cs01_linked_list")
```

---

### Pattern B: Runtime Registration

**Best for:** Dynamic lab registration, plugins, configuration-driven

**File:** Create `lab_registry.py`

```python
from lab_extensions import RegistryLabGenerator, LabMetadata

def create_generator_with_custom_labs():
    gen = RegistryLabGenerator()

    # Define and register labs
    def physics_lab_gen():
        return {
            "main_code": '''"""Physics Lab"""\nimport numpy as np\n\ndef calculate_velocity(distance, time):\n    # TODO: Implement\n    pass\n''',
            "test_code": '''"""Tests"""\ndef test_velocity():\n    assert calculate_velocity(100, 10) == 10.0\n''',
            "readme": "# Physics Lab\n",
        }

    metadata = LabMetadata(
        lab_id="phys01_kinematics",
        title="Kinematics Lab",
        description="Implement kinematic equations",
        difficulty="intermediate",
        duration_hours=2.5,
        topics=["physics", "simulation"],
        prerequisites=["math basics"],
        learning_outcomes=["Understand velocity", "Implement physics simulations"],
    )

    gen.register_custom_lab(
        "phys01_kinematics",
        title="Kinematics",
        generator_fn=physics_lab_gen,
        metadata=metadata,
    )

    return gen

# Usage
gen = create_generator_with_custom_labs()
print(gen.list_labs_with_metadata())
```

---

### Pattern C: Template-Based

**Best for:** Bulk creation of similar labs (algorithms, data structures, etc.)

**File:** Create `template_labs.py`

```python
from lab_extensions import LabTemplateMixin, RegistryLabGenerator, LabMetadata

class AlgorithmLabFactory(LabTemplateMixin, RegistryLabGenerator):
    """Factory for generating algorithm labs from templates."""

    def __init__(self):
        super().__init__()
        self._create_sorting_labs()

    def _create_sorting_labs(self):
        """Generate sorting algorithm labs from templates."""
        algorithms = [
            ("Bubble Sort", "Compare adjacent elements", "O(n²)", "bubble_sort"),
            ("Quick Sort", "Divide and conquer pivot", "O(n log n)", "quick_sort"),
            ("Merge Sort", "Recursive merge strategy", "O(n log n)", "merge_sort"),
        ]

        for name, description, complexity, func_name in algorithms:
            # Use template for consistency
            spec = LabTemplateMixin.template_numpy_function(
                title=f"Implement {name}",
                function_signature=f"def {func_name}(arr):",
                docstring=f"{name}: {description}. Time complexity: {complexity}",
                unit_tests=f'''
def test_{func_name}_basic():
    arr = [3, 1, 4, 1, 5]
    result = {func_name}(arr)
    assert result == [1, 1, 3, 4, 5]

def test_{func_name}_empty():
    assert {func_name}([]) == []
''',
                success_criteria=f"All tests pass. Code implements {name} correctly.",
            )

            lab_id = f"algo_{func_name}"
            self.register_template_lab(lab_id, spec)

# Usage
factory = AlgorithmLabFactory()
factory.generate_lab("algo_bubble_sort")
```

---

### Pattern D: Custom Validation & Hooks

**Best for:** Enforcing lab quality standards, custom workflows

```python
from lab_extensions import CustomLabGenerator

class ValidatingLabGenerator(CustomLabGenerator):
    """Generator with custom validation and hooks."""

    def __init__(self):
        super().__init__()
        self.stats = {"generated": 0, "validated": 0, "failed": 0}

    def _validate_lab(self, lab_id, lab_files):
        """Enforce strict quality standards."""
        super()._validate_lab(lab_id, lab_files)

        # Custom validations
        main = lab_files["main_code"]
        tests = lab_files["test_code"]
        readme = lab_files["readme"]

        # Check minimum test coverage
        if tests.count("def test_") < 3:
            raise ValueError(f"{lab_id}: Minimum 3 tests required")

        # Check docstring density
        docstring_count = main.count('"""')
        if docstring_count < 6:
            raise ValueError(f"{lab_id}: Insufficient documentation")

        # Check README completeness
        required = ["Objective", "Concepts", "Success Criteria"]
        for section in required:
            if section not in readme:
                raise ValueError(f"{lab_id}: README missing '{section}'")

    def _pre_generation_hook(self, lab_id):
        """Called before generation."""
        print(f"Generating {lab_id}...")

    def _post_generation_hook(self, lab_id, lab_files):
        """Called after successful generation."""
        self.stats["generated"] += 1
        self.stats["validated"] += 1

    def generate_lab(self, lab_id):
        """Override to track stats."""
        try:
            return super().generate_lab(lab_id)
        except ValueError as e:
            self.stats["failed"] += 1
            raise

    def print_stats(self):
        print(f"Stats: {self.stats}")

# Usage
gen = ValidatingLabGenerator()
try:
    gen.generate_lab("la01_regression_from_scratch")
except ValueError as e:
    print(f"Validation failed: {e}")
```

---

## API Reference

### CustomLabGenerator

Base class for extensible lab generation.

**Methods:**

- `register_lab(lab_id, generator_fn, metadata=None)` — Register a custom lab
- `generate_lab(lab_id)` — Generate lab with validation hooks (inherited)
- `_validate_lab(lab_id, lab_files)` — Override for custom validation
- `_pre_generation_hook(lab_id)` — Override for pre-processing
- `_post_generation_hook(lab_id, lab_files)` — Override for post-processing
- `get_lab_metadata(lab_id)` — Retrieve lab metadata
- `list_labs_with_metadata()` — List all labs with metadata

**Example:**

```python
gen = CustomLabGenerator()
gen.register_lab("my_lab", my_generator_fn)
gen.generate_lab("my_lab")
```

---

### RegistryLabGenerator

Advanced generator with filtering, serialization, and templates.

**Methods (in addition to CustomLabGenerator):**

- `register_custom_lab(lab_id, title, generator_fn, metadata, **extra)` — Full registration
- `register_template_lab(lab_id, spec)` — Register from LabSpec
- `filter_labs(difficulty=None, topic=None)` — Filter by criteria
- `export_registry(filepath)` — Export metadata to JSON

**Example:**

```python
gen = RegistryLabGenerator()
gen.register_custom_lab("my_lab", "Title", my_fn, metadata)
easy_labs = gen.filter_labs(difficulty="beginner")
gen.export_registry("labs.json")
```

---

### LabTemplateMixin

Provides reusable lab templates.

**Methods:**

- `template_numpy_function(title, signature, docstring, tests, criteria)` — NumPy function lab
- `template_class_implementation(class_name, methods, tests)` — Class implementation lab

**Example:**

```python
class MyGen(LabTemplateMixin, RegistryLabGenerator):
    def __init__(self):
        super().__init__()
        spec = LabTemplateMixin.template_numpy_function(...)
        self.register_template_lab("my_lab", spec)
```

---

### LabSpec & LabMetadata

Data structures for lab specification.

**LabMetadata:**

```python
metadata = LabMetadata(
    lab_id="unique_id",
    title="Display Title",
    description="Short description",
    difficulty="beginner|intermediate|advanced",
    duration_hours=2.0,
    topics=["topic1", "topic2"],
    prerequisites=["prereq1"],
    learning_outcomes=["outcome1"],
)
```

**LabSpec:**

```python
spec = LabSpec(
    metadata=metadata,
    main_code="...",
    test_code="...",
    readme="...",
)

# Convert to files
spec_to_files(spec, Path("output"))
```

---

## Best Practices

### 1. Consistent Lab Structure

```python
def my_lab():
    main_code = '''"""
Lab Title

Description of what students will implement.
"""
import necessary_modules

def function_1():
    """Docstring with TODO."""
    # TODO: Implement
    pass

def function_2():
    """Second function."""
    # TODO: Implement
    pass

if __name__ == "__main__":
    # Demo usage
    print("Run tests with: pytest *_test.py -v")
'''

    test_code = '''"""Tests for lab."""
import pytest

def test_function_1_basic():
    """Test basic behavior."""
    assert function_1(input) == expected

def test_function_1_edge():
    """Test edge case."""
    assert function_1(edge_input) == edge_expected

def test_function_2():
    """Test second function."""
    pass
'''

    readme = """# Lab Title

## Objectives
- Learn X
- Implement Y
- Understand Z

## Concepts
- Concept 1 with explanation
- Concept 2 with examples

## Success Criteria
- All tests pass
- Code handles edge cases
- Properly documented
"""

    return {
        "main_code": main_code,
        "test_code": test_code,
        "readme": readme,
    }
```

### 2. Use Metadata for Organization

```python
metadata = LabMetadata(
    lab_id="ds01_pandas",
    title="Pandas Basics",
    description="Learn fundamental pandas operations",
    difficulty="beginner",
    duration_hours=2.0,
    topics=["data-science", "pandas", "python"],
    prerequisites=["python-basics"],
    learning_outcomes=[
        "Create and manipulate DataFrames",
        "Perform data aggregation",
        "Handle missing values",
    ],
)
```

### 3. Test Coverage Checklist

```python
# ✓ Basic functionality tests
def test_function_basic():
    pass

# ✓ Edge case tests
def test_function_empty():
    pass

# ✓ Boundary tests
def test_function_boundary():
    pass

# ✓ Error handling tests
def test_function_invalid_input():
    pass

# ✓ Performance tests (optional)
def test_function_performance():
    pass
```

### 4. Documentation Standards

```markdown
# Lab Title

## Objectives
Clear list of what students will learn.

## Concepts
Explain key concepts with equations/examples.

## Implementation Guide
Step-by-step hints without spoilers.

## Deliverables
- Code files
- Test output
- Documentation

## Success Criteria
- All X tests pass
- Code meets Y requirements
- Handles Z edge cases

## Extra Credit
Optional advanced extensions.
```

---

## Advanced Patterns

### Pattern: Dynamic Lab Loading

```python
def load_labs_from_module(module_name: str, generator):
    """Dynamically import labs from module."""
    import importlib
    module = importlib.import_module(module_name)

    if hasattr(module, "CUSTOM_LABS"):
        for lab_id, gen_fn in module.CUSTOM_LABS.items():
            generator.register_lab(lab_id, gen_fn)

# Usage
gen = CustomLabGenerator()
load_labs_from_module("my_custom_labs", gen)
```

### Pattern: Lab Inheritance

```python
class AILabGenerator(CustomLabGenerator):
    def _define_labs(self):
        labs = super()._define_labs()
        labs.update(self._add_ai_labs())
        return labs

    def _add_ai_labs(self):
        return {
            "ai01_neural_net": self._lab_neural_net,
            "ai02_cnn": self._lab_cnn,
        }

class DeepLearningLabGenerator(AILabGenerator):
    def _define_labs(self):
        labs = super()._define_labs()
        labs.update(self._add_dl_labs())
        return labs

    def _add_dl_labs(self):
        return {
            "dl01_rnn": self._lab_rnn,
            "dl02_transformer": self._lab_transformer,
        }
```

### Pattern: Conditional Registration

```python
class SmartLabGenerator(RegistryLabGenerator):
    def __init__(self, include_advanced=True, include_experimental=False):
        super().__init__()

        if include_advanced:
            self._add_advanced_labs()

        if include_experimental:
            self._add_experimental_labs()

    def _add_advanced_labs(self):
        # Register advanced labs
        pass

    def _add_experimental_labs(self):
        # Register experimental labs
        pass
```

---

## Troubleshooting

### Issue: "Unknown lab" error

**Cause:** Lab ID not registered

**Solution:** Ensure `_define_labs()` includes your lab or use `register_lab()`:

```python
gen.register_lab("my_lab", my_generator_fn)
```

### Issue: Validation fails unexpectedly

**Cause:** Generated content missing required keys or empty

**Solution:** Check that generator returns dict with "main_code", "test_code", "readme":

```python
def my_lab():
    return {
        "main_code": "import numpy as np\n...",
        "test_code": "def test_...\n...",
        "readme": "# Lab\n...",
    }
```

### Issue: Tests don't run

**Cause:** Test file naming or import errors

**Solution:** Ensure test file follows naming pattern and imports are correct:

```python
# ✓ Correct
def test_my_function():
    from my_module import my_function
    assert my_function(...) == expected

# ✗ Incorrect: missing def test_ prefix
def my_test():
    pass
```

### Issue: Metadata not showing up

**Cause:** Metadata not registered during lab registration

**Solution:** Pass metadata when registering:

```python
gen.register_lab(lab_id, gen_fn, metadata=my_metadata)
# OR
gen.register_custom_lab(lab_id, title, gen_fn, metadata=my_metadata)
```

---

## Summary

| Pattern | Complexity | Flexibility | Best For |
|---------|-----------|------------|----------|
| Simple Subclassing | Low | Low | 1-5 custom labs |
| Runtime Registration | Medium | High | Dynamic labs, plugins |
| Template-Based | Low | Medium | Bulk creation (10+) |
| Custom Validation | High | High | Quality control, enforcement |

**Choose the pattern that matches your use case and complexity level.**

---

**Last updated:** 2026-02-22
**Version:** 1.0
**Status:** Production-ready
