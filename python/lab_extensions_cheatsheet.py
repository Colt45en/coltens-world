"""
Lab Generator Extensibility Cheat Sheet

Quick reference for common extension patterns.
"""

# ============= IMPORTS =============
from lab_extensions import (
    CustomLabGenerator,
    LabMetadata,
    LabTemplateMixin,
    RegistryLabGenerator,
)
from lab_generator import LabGenerator

# ============= PATTERN 1: Simple Subclass (5 minutes) =============

# Create file: my_labs.py

class MyLabGenerator(LabGenerator):
    """Add custom labs via subclassing."""

    def _define_labs(self) -> dict[str, dict[str, str]]:
        labs: dict[str, dict[str, str]] = super()._define_labs()  # type: ignore[assignment]
        labs["my_lab"] = self._lab_my_lab()
        return labs

    @staticmethod
    def _lab_my_lab():
        return {
            "main_code": '''"""Custom Lab"""
def my_function():
    # TODO: #2 Implement
    pass
''',
            "test_code": '''"""Tests"""
def test_my_function():
    pass
''',
            "readme": "# My Custom Lab\n",
        }

# Usage:
# gen = MyLabGenerator()
# gen.generate_lab("my_lab")


# ============= PATTERN 2: Runtime Registration (3 minutes) =============

gen = RegistryLabGenerator()

def my_custom_lab():
    return {
        "main_code": "# code",
        "test_code": "# tests",
        "readme": "# readme",
    }

metadata = LabMetadata(
    lab_id="custom_01",
    title="My Lab",
    description="Description",
    difficulty="intermediate",
    duration_hours=2.0,
    topics=["python"],
)

gen.register_custom_lab("custom_01", "My Lab", my_custom_lab, metadata)

# Usage:
# gen.generate_lab("custom_01")
# gen.filter_labs(difficulty="intermediate")
# gen.export_registry("labs.json")


# ============= PATTERN 3: Template Generation (2 minutes) =============

class TemplateGen(RegistryLabGenerator, LabTemplateMixin):
    def __init__(self):
        super().__init__()

        # Generate lab from template
        spec = LabTemplateMixin.template_numpy_function(
            lab_id="sum_lab",
            title="Sum Function",
            function_signature="def custom_sum(arr):",
            docstring="Compute sum of array elements",
            unit_tests='''
def test_sum():
    assert custom_sum([1, 2, 3]) == 6
''',
            success_criteria="All tests pass",
        )

        self.register_template_lab("sum_lab", spec)

# Usage:
# gen = TemplateGen()
# gen.generate_lab("sum_lab")


# ============= PATTERN 4: Custom Validation (5 minutes) =============

class ValidatingGen(CustomLabGenerator):
    """Enforce quality standards."""

    def _validate_lab(self, lab_id: str, lab_files: dict[str, str]) -> None:
        super()._validate_lab(lab_id, lab_files)

        # Custom checks
        test_code = lab_files["test_code"]
        if test_code.count("def test_") < 2:
            raise ValueError("Minimum 2 tests required")

    def _pre_generation_hook(self, lab_id: str) -> None:
        print(f"Generating {lab_id}...")

    def _post_generation_hook(self, lab_id: str, lab_files: dict[str, str]) -> None:
        print(f"✓ Generated {lab_id}")

# Usage:
# gen = ValidatingGen()
# gen.generate_lab("la01_regression_from_scratch")


# ============= QUICK COMMANDS =============

"""
QUICK START:

1. Clone base generator:
   gen = LabGenerator()
   lab = gen.generate_lab("la01_regression_from_scratch")

2. Simple extension:
   class MyGen(LabGenerator):
       def _define_labs(self):
           labs = super()._define_labs()
           labs["custom"] = self._my_lab
           return labs

3. Register at runtime:
   gen = RegistryLabGenerator()
   gen.register_lab("id", generator_fn)

4. Use templates:
   spec = LabTemplateMixin.template_numpy_function(...)
   gen.register_template_lab("id", spec)

5. Validate with hooks:
   class ValidGen(CustomLabGenerator):
       def _validate_lab(self, id, files):
           # Custom validation
           pass

6. Export metadata:
   gen.export_registry("labs.json")

7. Filter labs:
   easy = gen.filter_labs(difficulty="beginner")

TIPS:
- Use subclassing for 1-5 custom labs
- Use registry for dynamic/plugin labs
- Use templates for 10+ similar labs
- Use validation hooks for quality control
- Always include metadata for discovery/filtering
"""


# ============= TEMPLATE GENERATORS =============

"""
Built-in Templates:

1. template_numpy_function(
    title,
    function_signature,
    docstring,
    unit_tests,
    success_criteria
)

2. template_class_implementation(
    class_name,
    methods: list[(name, docstring)],
    unit_tests,
    title=None
)

Example:
    spec = LabTemplateMixin.template_numpy_function(
        title="Implement mean",
        function_signature="def mean(arr):",
        docstring="Calculate arithmetic mean",
        unit_tests="def test_mean(): assert mean([1,2,3]) == 2.0",
        success_criteria="All tests pass"
    )
"""


# ============= METADATA STRUCTURE =============

"""
LabMetadata fields:

LabMetadata(
    lab_id="unique_id",              # Required: unique ID
    title="Display Title",            # Required: human-readable
    description="What is this lab",   # Required
    difficulty="beginner|intermediate|advanced",
    duration_hours=2.0,               # Estimated time
    topics=["topic1", "topic2"],      # Keywords for filtering
    prerequisites=["prereq"],         # Optional
    learning_outcomes=["outcome"],    # Optional
)

Usage:
    - Filter: gen.filter_labs(difficulty="beginner", topic="python")
    - Export: gen.export_registry("labs.json")
    - Discover: gen.get_lab_metadata("lab_id")
"""


# ============= VALIDATION PATTERNS =============

"""
Override _validate_lab() for custom checks:

def _validate_lab(self, lab_id, lab_files):
    super()._validate_lab(lab_id, lab_files)

    main = lab_files["main_code"]
    test = lab_files["test_code"]
    readme = lab_files["readme"]

    # Check for minimum tests
    if test.count("def test_") < 2:
        raise ValueError("Need 2+ tests")

    # Check for TODOs
    if "TODO" not in main:
        raise ValueError("No TODOs in starter code")

    # Check README sections
    if "Objectives" not in readme:
        raise ValueError("Missing Objectives section")
"""


# ============= HOOKS PATTERNS =============

"""
Life cycle hooks:

1. _pre_generation_hook(lab_id)
   - Called BEFORE generation
   - Use for: logging, setup, validation

2. _post_generation_hook(lab_id, lab_files)
   - Called AFTER generation and validation
   - Use for: cleanup, stats, post-processing

Example:
    class LoggingGen(CustomLabGenerator):
        def _pre_generation_hook(self, lab_id):
            print(f"Generating {lab_id}...")

        def _post_generation_hook(self, lab_id, lab_files):
            lines = len(lab_files["main_code"].split("\\n"))
            tests = lab_files["test_code"].count("def test_")
            print(f"Created: {lines} lines, {tests} tests")
"""


# ============= FILE GENERATION =============

"""
Generate labs to disk:

from generate_labs import write_lab_files
from pathlib import Path

gen = MyLabGenerator()
for lab_id in gen.labs.keys():
    output = Path("labs") / lab_id
    write_lab_files(lab_id, output)

Output structure:
    labs/
    ├── la01_regression/
    │   ├── la01_regression_starter.py
    │   ├── la01_regression_test.py
    │   └── la01_regression_README.md
    ├── my_custom_lab/
    │   ├── my_custom_lab_starter.py
    │   ├── my_custom_lab_test.py
    │   └── my_custom_lab_README.md
"""


# ============= COMPLETE EXAMPLE =============

"""
Full working example - save as example_extension.py:

from lab_extensions import RegistryLabGenerator, LabMetadata, LabTemplateMixin

class MyCompleteLabs(LabTemplateMixin, RegistryLabGenerator):
    def __init__(self):
        super().__init__()
        self._add_custom_labs()

    def _add_custom_labs(self):
        # Example 1: Register custom function lab
        def my_lab():
            return {
                "main_code": '''def greet(name):
    # TODO: Implement
    pass
''',
                "test_code": '''def test_greet():
    assert greet("Alice") == "Hello, Alice!"
''',
                "readme": "# Greeting Lab\\n",
            }

        meta = LabMetadata(
            lab_id="custom_greet",
            title="Greeting Function",
            description="Create a greeting function",
            difficulty="beginner",
            duration_hours=0.5,
            topics=["python", "functions"],
        )

        self.register_custom_lab(
            "custom_greet",
            "Greeting Function",
            my_lab,
            metadata=meta
        )

        # Example 2: Use template for bulk generation
        for i in range(3):
            spec = LabTemplateMixin.template_numpy_function(
                title=f"Math Function {i+1}",
                function_signature=f"def math_op_{i+1}(x, y):",
                docstring=f"Implement operation {i+1}",
                unit_tests=f"def test_math_op_{i+1}(): pass",
                success_criteria="All tests pass",
            )
            self.register_template_lab(f"math_{i+1}", spec)

# Usage
if __name__ == "__main__":
    gen = MyCompleteLabs()

    # Generate all labs
    for lab_id in gen.labs.keys():
        try:
            gen.generate_lab(lab_id)
            print(f"✓ {lab_id}")
        except Exception as e:
            print(f"✗ {lab_id}: {e}")

    # Filter labs
    beginner = gen.filter_labs(difficulty="beginner")
    print(f"\\nBeginner labs: {beginner}")

    # Export metadata
    gen.export_registry("labs.json")
"""


if __name__ == "__main__":
    print(__doc__)
