"""
Example usage of LabGenerator for programmatic lab generation and customization.

This demonstrates how to:
1. Generate labs programmatically
2. Access individual lab components
3. Serialize labs to JSON
4. Customize and extend lab generation
"""
import json
from pathlib import Path
from lab_generator import LabGenerator, write_lab_files


def example_1_generate_single_lab():
    """Example 1: Generate a single lab programmatically."""
    print("=" * 60)
    print("Example 1: Generate a Single Lab")
    print("=" * 60)

    generator = LabGenerator()

    # Generate a specific lab
    lab_id = "la02_pca_scratch"
    lab_files = generator.generate_lab(lab_id)

    print(f"Generated lab: {lab_id}")
    print(f"  - main_code: {len(lab_files['main_code'])} chars")
    print(f"  - test_code: {len(lab_files['test_code'])} chars")
    print(f"  - readme: {len(lab_files['readme'])} chars")
    print()


def example_2_list_all_labs():
    """Example 2: List all available labs."""
    print("=" * 60)
    print("Example 2: List All Available Labs")
    print("=" * 60)

    generator = LabGenerator()

    print("Available labs:")
    for i, lab_id in enumerate(generator.labs.keys(), 1):
        lab_files = generator.generate_lab(lab_id)
        lines = len(lab_files['main_code'].split('\n'))
        print(f"  {i:2d}. {lab_id:30s} ({lines} lines of starter code)")

    print(f"\nTotal: {len(generator.labs)} labs")
    print()


def example_3_serialize_to_json():
    """Example 3: Serialize lab metadata to JSON."""
    print("=" * 60)
    print("Example 3: Serialize Lab Metadata to JSON")
    print("=" * 60)

    generator = LabGenerator()

    # Create metadata
    metadata = {}
    for lab_id in generator.labs.keys():
        lab_files = generator.generate_lab(lab_id)
        metadata[lab_id] = {
            "title": lab_id.replace("_", " ").title(),
            "starter_lines": len(lab_files['main_code'].split('\n')),
            "test_lines": len(lab_files['test_code'].split('\n')),
            "readme_lines": len(lab_files['readme'].split('\n')),
        }

    # Save to JSON
    output_file = Path("labs_metadata.json")
    with open(output_file, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"Saved metadata to {output_file}")
    print(f"Total labs: {len(metadata)}")
    print()


def example_4_access_components():
    """Example 4: Access specific components of a lab."""
    print("=" * 60)
    print("Example 4: Access Specific Lab Components")
    print("=" * 60)

    generator = LabGenerator()
    lab_files = generator.generate_lab("opt01_autodiff_mini")

    # Print first TODO from main code
    main_code = lab_files['main_code']
    lines = main_code.split('\n')

    # Find first TODO
    for i, line in enumerate(lines):
        if 'TODO' in line:
            print(f"First TODO at line {i+1}:")
            print(f"  {line.strip()}")
            break

    # Find first test function
    test_code = lab_files['test_code']
    test_lines = test_code.split('\n')

    for i, line in enumerate(test_lines):
        if 'def test_' in line:
            print(f"\nFirst test at line {i+1}:")
            print(f"  {line.strip()}")
            break

    print()


def example_5_generate_with_custom_output():
    """Example 5: Generate labs to custom directory."""
    print("=" * 60)
    print("Example 5: Generate Labs to Custom Directory")
    print("=" * 60)

    output_dir = Path("my_curriculum_labs")
    output_dir.mkdir(exist_ok=True)

    # Generate just a few labs
    generator = LabGenerator()
    labs_to_generate = [
        "la01_regression_from_scratch",
        "la02_pca_scratch",
        "opt01_autodiff_mini",
    ]

    for lab_id in labs_to_generate:
        lab_output = output_dir / lab_id
        write_lab_files(lab_id, lab_output)
        print(f"✓ Generated {lab_id} to {lab_output}")

    print(f"\nAll labs saved to {output_dir.resolve()}")
    print()


def example_6_analyze_coverage():
    """Example 6: Analyze test coverage of labs."""
    print("=" * 60)
    print("Example 6: Analyze Test Coverage")
    print("=" * 60)

    generator = LabGenerator()

    coverage_stats = {}

    for lab_id in generator.labs.keys():
        lab_files = generator.generate_lab(lab_id)
        test_code = lab_files['test_code']

        # Count test functions
        test_count = test_code.count('def test_')

        # Count assertions
        assert_count = test_code.count('assert ')

        coverage_stats[lab_id] = {
            "tests": test_count,
            "assertions": assert_count,
        }

    print("Test Coverage Analysis:")
    print(f"{'Lab ID':<30} {'Tests':<8} {'Assertions':<12}")
    print("-" * 50)

    for lab_id in sorted(coverage_stats.keys()):
        stats = coverage_stats[lab_id]
        print(f"{lab_id:<30} {stats['tests']:<8} {stats['assertions']:<12}")

    total_tests = sum(s['tests'] for s in coverage_stats.values())
    total_asserts = sum(s['assertions'] for s in coverage_stats.values())

    print("-" * 50)
    print(f"{'TOTAL':<30} {total_tests:<8} {total_asserts:<12}")
    print()


def example_7_custom_extension():
    """Example 7: Extend LabGenerator with custom lab."""
    print("=" * 60)
    print("Example 7: Custom Lab Extension")
    print("=" * 60)

    class MyLabGenerator(LabGenerator):
        """Extended generator with custom lab."""

        def _define_labs(self):
            labs = super()._define_labs()
            labs["custom_kmeans"] = self._lab_kmeans
            return labs

        @staticmethod
        def _lab_kmeans():
            """K-means clustering from scratch."""
            main_code = '''"""
Custom Lab: K-means Clustering
Implement K-means from scratch.
"""
import numpy as np

def kmeans(X, k, max_iters=100, seed=42):
    """K-means clustering."""
    # TODO: Implement
    pass
'''
            test_code = '''"""Tests for K-means."""
def test_kmeans_basic():
    """Test K-means."""
    pass
'''
            readme = """# K-means Clustering
Custom curriculum lab."""

            return {
                "main_code": main_code,
                "test_code": test_code,
                "readme": readme,
            }

    # Test custom generator
    gen = MyLabGenerator()
    print(f"Extended generator has {len(gen.labs)} labs")
    print(f"Custom lab available: {'custom_kmeans' in gen.labs}")

    if 'custom_kmeans' in gen.labs:
        lab = gen.generate_lab("custom_kmeans")
        print(f"Generated custom_kmeans: {len(lab['main_code'])} chars")

    print()


def main():
    """Run all examples."""
    example_1_generate_single_lab()
    example_2_list_all_labs()
    example_3_serialize_to_json()
    example_4_access_components()
    example_5_generate_with_custom_output()
    example_6_analyze_coverage()
    example_7_custom_extension()

    print("=" * 60)
    print("All examples completed!")
    print("=" * 60)


if __name__ == "__main__":
    main()
