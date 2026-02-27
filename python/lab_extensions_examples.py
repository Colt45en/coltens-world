"""
Extensible Lab Generator - Practical Examples

Demonstrates how to extend LabGenerator with custom labs using various patterns:
1. Simple subclassing
2. Template-based generation
3. Runtime registration
4. Custom validation and hooks
5. Module-based lab discovery
"""

from pathlib import Path
from lab_extensions import (
    CustomLabGenerator,
    RegistryLabGenerator,
    LabMetadata,
    LabSpec,
)


# ============= Example 1: Simple Subclassing =============

class DataScienceLabGenerator(CustomLabGenerator):
    """
    Custom generator extending LabGenerator with domain-specific labs.

    Demonstrates: Override _define_labs() to add custom labs
    """

    def _define_labs(self):
        """Extend base labs with custom data science labs."""
        labs = super()._define_labs()

        # Add custom labs
        labs["ds01_pandas_intro"] = self._lab_pandas_intro
        labs["ds02_data_cleaning"] = self._lab_data_cleaning
        labs["ds03_visualization"] = self._lab_visualization

        return labs

    @staticmethod
    def _lab_pandas_intro() -> dict[str, str]:
        """Intro to pandas DataFrames."""
        main_code = '''"""
Lab: Pandas DataFrame Basics

Learn to create, manipulate, and analyze DataFrames.
"""
import pandas as pd
import numpy as np

def create_sample_dataframe(n_rows=100):
    """Create a sample DataFrame."""
    # TODO: Create DataFrame with columns: name, age, salary, department
    # - Use np.random for data generation
    # - Include at least 4 columns
    pass

def filter_high_earners(df, salary_threshold=50000):
    """Filter employees earning above threshold."""
    # TODO: Implement
    # Return DataFrame with employees earning > threshold
    pass

def calculate_department_stats(df):
    """Calculate mean salary by department."""
    # TODO: Group by department and calculate mean salary
    pass

if __name__ == "__main__":
    df = create_sample_dataframe()
    print(f"Created DataFrame with {len(df)} rows")
    print(df.head())
'''

        test_code = '''"""Tests for Pandas Lab"""
import pandas as pd
import pytest

def test_create_dataframe():
    """Test DataFrame creation."""
    # TODO: Test that create_sample_dataframe() returns valid DataFrame
    pass

def test_filter_high_earners():
    """Test filtering by salary."""
    # TODO: Verify filtering works correctly
    pass

def test_department_stats():
    """Test groupby aggregation."""
    # TODO: Verify stats calculation
    pass
'''

        readme = """# Pandas DataFrame Basics

Learn fundamental pandas operations for data manipulation.

## Topics
- DataFrame creation and manipulation
- Filtering and selection
- GroupBy and aggregation
- Basic statistics

## Success Criteria
- All unit tests pass
- DataFrame operations are efficient (no explicit loops where vectorization available)
"""

        return {
            "main_code": main_code,
            "test_code": test_code,
            "readme": readme,
        }

    @staticmethod
    def _lab_data_cleaning() -> dict[str, str]:
        """Data cleaning and preprocessing."""
        main_code = '''"""
Lab: Data Cleaning & Preprocessing

Handle missing values, outliers, and normalization.
"""
import pandas as pd
import numpy as np

def handle_missing_values(df, strategy='mean'):
    """Fill missing values using specified strategy."""
    # TODO: Implement missing value handling
    # Strategies: 'mean', 'median', 'forward_fill', 'drop'
    pass

def remove_outliers(df, column, method='iqr', threshold=1.5):
    """Remove outliers using IQR or Z-score method."""
    # TODO: Implement outlier detection and removal
    pass

def normalize_columns(df, columns, method='minmax'):
    """Normalize specified columns."""
    # TODO: Implement normalization
    # Methods: 'minmax' (0-1), 'zscore' (standardization)
    pass

if __name__ == "__main__":
    print("Data cleaning pipeline demo")
'''

        test_code = '''"""Tests for Data Cleaning Lab"""
import pandas as pd
import numpy as np

def test_missing_values():
    """Test missing value handling."""
    pass

def test_outlier_removal():
    """Test outlier detection."""
    pass

def test_normalization():
    """Test feature normalization."""
    pass
'''

        readme = """# Data Cleaning & Preprocessing

Master essential data preparation techniques.

## Concepts
- Missing value imputation strategies
- Outlier detection and handling
- Feature scaling and normalization
"""

        return {
            "main_code": main_code,
            "test_code": test_code,
            "readme": readme,
        }

    @staticmethod
    def _lab_visualization() -> dict[str, str]:
        """Data visualization with matplotlib and seaborn."""
        main_code = '''"""
Lab: Data Visualization

Create informative visualizations with matplotlib/seaborn.
"""
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

def plot_distribution(data, title="Distribution"):
    """Create histogram with KDE."""
    # TODO: Create and save distribution plot
    pass

def plot_correlation_heatmap(df, save_path="correlation.png"):
    """Create correlation matrix heatmap."""
    # TODO: Compute correlation and plot heatmap
    pass

def plot_time_series(df, column, save_path="timeseries.png"):
    """Plot time series data."""
    # TODO: Plot time series with proper formatting
    pass

if __name__ == "__main__":
    print("Visualization examples")
'''

        test_code = '''"""Tests for Visualization Lab"""
def test_plot_distribution():
    """Test distribution plot."""
    pass

def test_correlation_heatmap():
    """Test heatmap creation."""
    pass

def test_time_series():
    """Test time series plot."""
    pass
'''

        readme = """# Data Visualization

Learn to create publication-quality visualizations.

## Tools
- matplotlib: Core plotting library
- seaborn: Statistical visualization
- pandas: Built-in plotting
"""

        return {
            "main_code": main_code,
            "test_code": test_code,
            "readme": readme,
        }


# ============= Example 2: Template-Based Generation =============

class AlgorithmLabGenerator(RegistryLabGenerator):
    """
    Generator that creates algorithm labs from templates.

    Demonstrates: Use templates to generate multiple similar labs quickly
    """

        def __init__(self):
            super().__init__()
            self._add_sorting_labs()
            self._add_search_labs()
    
        def _add_search_labs(self):
            """Add search algorithm labs."""
            algorithms = [
                ("Linear Search", "Scan sequentially", "O(n)"),
                ("Binary Search", "Divide search space", "O(log n)"),
            ]
    
            for i, (name, desc, complexity) in enumerate(algorithms, 1):
                lab_id = f"algo_search_{i:02d}_{name.lower().replace(' ', '_')}"
    
                spec = LabSpec(
                    metadata=LabMetadata(
                        lab_id=lab_id,
                        title=f"Implement {name}",
                        description=f"Implement {desc}",
                        difficulty="intermediate",
                        duration_hours=2.0,
                        topics=["algorithms", "searching"],
                        learning_outcomes=[
                            f"Understand {name} algorithm",
                            f"Analyze {complexity} complexity",
                            "Implement in Python",
                        ],
                    ),
                    main_code=f'''"""
    Lab: {name} Implementation
    
    Algorithm: {name}
    Description: {desc}
    Time Complexity: {complexity}
    """
    
    def {name.lower().replace(' ', '_')}(arr, target):
        """
        Implement {name} algorithm.
    
        Args:
            arr: List of elements
            target: Element to search for
    
        Returns:
            Index of target if found, -1 otherwise
        """
        # TODO: Implement {name}
        pass
    
    if __name__ == "__main__":
        test_arr = [1, 3, 5, 7, 9, 11]
        result = {name.lower().replace(' ', '_')}(test_arr, 7)
        print(f"Index: {{result}}")
    ''',
                    test_code=f'''"""Tests for {name} implementation"""
    import pytest
    
    def test_{name.lower().replace(' ', '_')}_found():
        """Test when element is found."""
        arr = [1, 3, 5, 7, 9]
        # TODO: Test that target is found
        pass
    
    def test_{name.lower().replace(' ', '_')}_not_found():
        """Test when element is not found."""
        arr = [1, 3, 5, 7, 9]
        # TODO: Test that -1 is returned
        pass
    
    def test_{name.lower().replace(' ', '_')}_empty():
        """Test empty list."""
        assert {name.lower().replace(' ', '_')}([], 5) == -1
    ''',
                    readme=f"""# {name} Implementation
    
    ## Algorithm Description
    {desc}
    
    ## Complexity Analysis
    - Time: {complexity}
    - Space: O(1)
    
    ## Success Criteria
    - All unit tests pass
    - Student explains time complexity
    - Code is well-commented
    """,
                )
    
                self.register_template_lab(lab_id, spec)
    
        def _add_sorting_labs(self):
        """Add sorting algorithm labs."""
        algorithms = [
            ("Bubble Sort", "Swap adjacent elements", "O(n²)"),
            ("Quick Sort", "Divide and conquer", "O(n log n)"),
            ("Merge Sort", "Divide sequence in half", "O(n log n)"),
        ]

        for i, (name, desc, complexity) in enumerate(algorithms, 1):
            lab_id = f"algo_sort_{i:02d}_{name.lower().replace(' ', '_')}"

            spec = LabSpec(
                metadata=LabMetadata(
                    lab_id=lab_id,
                    title=f"Implement {name}",
                    description=f"Implement sorted using {desc}",
                    difficulty="intermediate",
                    duration_hours=2.0,
                    topics=["algorithms", "sorting"],
                    learning_outcomes=[
                        f"Understand {name} algorithm",
                        f"Analyze {complexity} complexity",
                        "Implement in Python",
                    ],
                ),
                main_code=f'''"""
Lab: {name} Implementation

Algorithm: {name}
Description: {desc}
Time Complexity: {complexity}
"""

def {name.lower().replace(' ', '_')}(arr):
    """
    Implement {name} algorithm.

    Args:
        arr: List of comparable elements

    Returns:
        Sorted list (in-place modification)
    """
    # TODO: Implement {name}
    pass

if __name__ == "__main__":
    test_arr = [64, 34, 25, 12, 22, 11, 90]
    result = {name.lower().replace(' ', '_')}(test_arr)
    print(f"Sorted: {{result}}")
''',
                test_code=f'''"""Tests for {name} implementation"""
import pytest

def test_{name.lower().replace(' ', '_')}_basic():
    """Test basic sorting."""
    arr = [3, 1, 4, 1, 5, 9, 2, 6]
    # TODO: Test that result is sorted
    pass

def test_{name.lower().replace(' ', '_')}_empty():
    """Test empty list."""
    assert {name.lower().replace(' ', '_')}([]) == []

def test_{name.lower().replace(' ', '_')}_single():
    """Test single element."""
    assert {name.lower().replace(' ', '_')}([42]) == [42]

def test_{name.lower().replace(' ', '_')}_duplicates():
    """Test with duplicate elements."""
    arr = [3, 1, 3, 1, 3]
    result = {name.lower().replace(' ', '_')}(arr)
    assert result == [1, 1, 3, 3, 3]
''',
                readme=f"""# {name} Implementation

## Algorithm Description
{desc}

## Complexity Analysis
- Time: {complexity}
- Space: TODO

## Success Criteria
- All unit tests pass
- Student explains time complexity
- Code is well-commented
""",
            )

            self.register_template_lab(lab_id, spec)


# ============= Example 3: Runtime Registration =============

class PluggableLabGenerator(RegistryLabGenerator):
    """
    Generator with full runtime lab registration.

    Demonstrates: Register labs after instantiation
    """

    pass


def example_3_runtime_registration():
    """Example 3: Register labs at runtime."""
    print("\n" + "=" * 60)
    print("Example 3: Runtime Registration")
    print("=" * 60)

    gen = PluggableLabGenerator()

    # Define a custom lab function
    def my_statistics_lab():
        return {
            "main_code": '''"""
Lab: Basic Statistics

Implement statistical functions.
"""
import numpy as np

def mean(arr):
    """Calculate mean."""
    # TODO: Implement
    pass

def std_dev(arr):
    """Calculate standard deviation."""
    # TODO: Implement
    pass

if __name__ == "__main__":
    data = [1, 2, 3, 4, 5]
    print(f"Mean: {mean(data)}")
    print(f"Std Dev: {std_dev(data)}")
''',
            "test_code": '''"""Tests for statistics"""
def test_mean():
    assert mean([1, 2, 3]) == 2.0

def test_std_dev():
    result = std_dev([0, 0, 0])
    assert result == 0
''',
            "readme": "# Basic Statistics Lab\n\nImplement fundamental statistical functions.",
        }

    # Register custom metadata
    metadata = LabMetadata(
        lab_id="stat01_basic",
        title="Basic Statistics",
        description="Implement statistical functions",
        difficulty="beginner",
        duration_hours=1.5,
        topics=["statistics", "math"],
        prerequisites=[],
        learning_outcomes=["Calculate mean and standard deviation"],
    )

    # Register the lab
    gen.register_lab("stat01_basic", my_statistics_lab, metadata)

    print("Registered lab: stat01_basic")
    print(f"Total labs: {len(gen.labs)}")
    print(f"Lab metadata: {gen.get_lab_metadata('stat01_basic')}")


# ============= Example 4: Custom Validation Hooks =============

class ValidatingLabGenerator(CustomLabGenerator):
    """
    Generator with custom validation and hooks.

    Demonstrates: Override validation and hook methods for quality control
    """

    def __init__(self):
        super().__init__()
        self.generation_log = []

    def _validate_lab(self, lab_id: str, lab_files: dict[str, str]) -> None:
        """Custom validation with stricter requirements."""
        # Call parent validation
        super()._validate_lab(lab_id, lab_files)

        # Additional validations
        main_code = lab_files["main_code"]
        test_code = lab_files["test_code"]
        readme = lab_files["readme"]

        # Check for TODOs
        if "TODO" not in main_code:
            raise ValueError(f"Lab {lab_id}: No TODOs found in starter code")

        # Check for docstrings
        if main_code.count('"""') < 4:
            raise ValueError(f"Lab {lab_id}: Need more docstrings")

        # Check for test count
        test_count = test_code.count("def test_")
        if test_count < 2:
            raise ValueError(f"Lab {lab_id}: Need at least 2 tests, found {test_count}")

        # Check README sections
        required_sections = ["Objectives", "Concepts", "Success"]
        for section in required_sections:
            if section not in readme:
                raise ValueError(f"Lab {lab_id}: README missing '{section}' section")

    def _pre_generation_hook(self, lab_id: str) -> None:
        """Called before generation."""
        self.generation_log.append(f"[GENERATING] {lab_id}")

    def _post_generation_hook(self, lab_id: str, lab_files: dict[str, str]) -> None:
        """Called after generation and validation."""
        lines = len(lab_files["main_code"].split("\n"))
        tests = lab_files["test_code"].count("def test_")
        self.generation_log.append(f"[SUCCESS] {lab_id} - {lines} lines, {tests} tests")

    def print_log(self):
        """Print generation log."""
        for entry in self.generation_log:
            print(entry)


def example_4_validation_hooks():
    """Example 4: Custom validation and hooks."""
    print("\n" + "=" * 60)
    print("Example 4: Validation Hooks")
    print("=" * 60)

    gen = ValidatingLabGenerator()

    # Generate a lab
    try:
        gen.generate_lab("la01_regression_from_scratch")
        print("✓ Lab passed validation")
    except ValueError as e:
        print(f"✗ Validation failed: {e}")

    print("\nGeneration log:")
    gen.print_log()


# ============= Example 5: Filtering & Discovery =============

def example_5_filtering():
    """Example 5: Filter labs by criteria."""
    print("\n" + "=" * 60)
    print("Example 5: Lab Filtering & Discovery")
    print("=" * 60)

    gen = AlgorithmLabGenerator()

    # Create extended generator with metadata
    extended = RegistryLabGenerator()

    # Manually add metadata for base labs (in real scenario, would be in generator)
    base_labs = {
        "la01_regression_from_scratch": LabMetadata(
            lab_id="la01_regression_from_scratch",
            title="Linear Regression",
            description="Implement linear regression",
            difficulty="beginner",
            duration_hours=3.0,
            topics=["ml", "optimization"],
        ),
        "opt01_autodiff_mini": LabMetadata(
            lab_id="opt01_autodiff_mini",
            title="Minimal Autodiff",
            description="Implement reverse-mode autodiff",
            difficulty="advanced",
            duration_hours=4.0,
            topics=["dl", "autodiff"],
        ),
    }

    for lab_id, metadata in base_labs.items():
        extended.metadata_registry[lab_id] = metadata

    # Filter by difficulty
    print("\nBeginner labs:")
    for lab_id in extended.filter_labs(difficulty="beginner"):
        meta = extended.get_lab_metadata(lab_id)
        if meta:
            print(f"  - {meta.title}")

    print("\nAdvanced labs:")
    for lab_id in extended.filter_labs(difficulty="advanced"):
        meta = extended.get_lab_metadata(lab_id)
        if meta:
            print(f"  - {meta.title}")

    print("\nLabs with 'optimization' topic:")
    for lab_id in extended.filter_labs(topic="optimization"):
        meta = extended.get_lab_metadata(lab_id)
        if meta:
            print(f"  - {meta.title}")


# ============= Example 6: Export & Discovery =============

def example_6_export():
    """Example 6: Export lab registry."""
    print("\n" + "=" * 60)
    print("Example 6: Lab Registry Export")
    print("=" * 60)

    gen = RegistryLabGenerator()

    # Export to JSON
    output_path = Path("lab_registry.json")
    gen.export_registry(str(output_path))

    if output_path.exists():
        print(f"✓ Exported lab registry to {output_path}")
        print(f"  File size: {output_path.stat().st_size} bytes")
    else:
        print(f"✗ Failed to create {output_path}")


# ============= Main Entry Point =============

def main():
    """Run all examples."""
    print("\n" + "=" * 60)
    print("Lab Generator Extension Examples")
    print("=" * 60)

    # Example 1: Simple subclassing
    print("\n1. Simple Subclassing")
    gen1 = DataScienceLabGenerator()
    print(f"   Created generator with {len(gen1.labs)} labs")
    print("   Base labs + Custom: pandas, cleaning, visualization")

    # Example 2: Template-based
    print("\n2. Template-Based Generation")
    gen2 = AlgorithmLabGenerator()
    algo_labs = [lab for lab in gen2.labs.keys() if lab.startswith("algo_")]
    print(f"   Created {len(algo_labs)} algorithm labs from templates")

    # Example 3: Runtime registration
    example_3_runtime_registration()

    # Example 4: Validation hooks
    example_4_validation_hooks()

    # Example 5: Filtering
    example_5_filtering()

    # Example 6: Export
    example_6_export()

    print("\n" + "=" * 60)
    print("All examples completed!")
    print("=" * 60)


if __name__ == "__main__":
    main()
