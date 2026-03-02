"""
Extensible Lab Generator Design Patterns

This module provides base classes, mixins, and templates for extending LabGenerator
with custom labs. Demonstrates best practices for subclassing and composition.

Usage patterns:
1. Simple extension: Subclass LabGenerator and override _define_labs()
2. Mixin-based: Use LabTemplateMixin to inherit common patterns
3. Registry pattern: Register custom labs at runtime
4. Configuration-driven: Define labs from YAML/JSON specs
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, Optional

from lab_generator import LabGenerator


LabFiles = dict[str, str]  # {"main_code": "...", "test_code": "...", "readme": "..."}


# ============= Base Data Structures =============

_ALLOWED_DIFFICULTY = {"beginner", "intermediate", "advanced"}


@dataclass(slots=True)
class LabMetadata:
    """Metadata for a lab."""

    lab_id: str
    title: str
    description: str
    difficulty: str  # "beginner", "intermediate", "advanced"
    duration_hours: float
    topics: list[str]
    prerequisites: list[str] = field(default_factory=list)
    learning_outcomes: list[str] = field(default_factory=list)

    def validate(self) -> None:
        if self.difficulty not in _ALLOWED_DIFFICULTY:
            raise ValueError(
                f"Invalid difficulty '{self.difficulty}'. Allowed: {sorted(_ALLOWED_DIFFICULTY)}"
            )
        if self.duration_hours <= 0:
            raise ValueError("duration_hours must be > 0")
        if not self.lab_id.strip():
            raise ValueError("lab_id must be non-empty")
        if not self.title.strip():
            raise ValueError("title must be non-empty")


@dataclass(slots=True)
class LabSpec:
    """Complete specification for a lab."""

    metadata: LabMetadata
    main_code: str
    test_code: str
    readme: str

    def to_dict(self) -> LabFiles:
        """Convert to generator output format."""
        return {
            "main_code": self.main_code,
            "test_code": self.test_code,
            "readme": self.readme,
        }


# ============= Extension Base Classes =============


class CustomLabGenerator(LabGenerator):
    """
    Extended LabGenerator with hooks for custom extensions.

    Override these methods to customize behavior:
    - _define_labs(): Add custom labs
    - _validate_lab(): Validate lab structure
    - _pre_generation_hook(): Run before generation
    - _post_generation_hook(): Run after generation
    """

    def __init__(self) -> None:
        """
        Initialize with custom labs.

        NOTE: We initialize registries BEFORE calling super().__init__() in case
        LabGenerator.__init__() calls _define_labs() during construction.
        """
        self.metadata_registry: Dict[str, LabMetadata] = {}
        self.custom_labs: Dict[str, Callable[[], LabFiles]] = {}
        super().__init__()

    def _define_labs(self) -> dict[str, Callable[[], LabFiles]]:
        """Override to add custom labs on top of base labs."""
        labs = super()._define_labs()
        for lab_id, generator_fn in self.custom_labs.items():
            labs[lab_id] = generator_fn  # Store function reference, not result
        return labs

    def register_lab(
        self,
        lab_id: str,
        generator_fn: Callable[[], LabFiles],
        metadata: Optional[LabMetadata] = None,
    ) -> None:
        """
        Register a custom lab at runtime.

        Args:
            lab_id: Unique lab identifier
            generator_fn: Callable returning {"main_code", "test_code", "readme"}
            metadata: Optional metadata for the lab
        """
        self.custom_labs[lab_id] = generator_fn

        if metadata is not None:
            metadata.validate()
            self.metadata_registry[lab_id] = metadata

        # Some LabGenerator implementations build self.labs in __init__.
        # If present, update immediately; otherwise it will appear via _define_labs().
        if hasattr(self, "labs") and isinstance(getattr(self, "labs"), dict):
            self.labs[lab_id] = generator_fn  # type: ignore[attr-defined]

    def generate_lab(self, lab_id: str) -> LabFiles:
        """
        Generate a lab with validation hooks.

        Args:
            lab_id: Lab identifier

        Returns:
            dict with keys: "main_code", "test_code", "readme"
        """
        self._pre_generation_hook(lab_id)

        lab_files: LabFiles = super().generate_lab(lab_id)

        self._validate_lab(lab_id, lab_files)

        self._post_generation_hook(lab_id, lab_files)

        return lab_files

    def _validate_lab(self, lab_id: str, lab_files: LabFiles) -> None:
        """
        Validate lab structure. Override to add custom validation.

        Raises:
            ValueError: If validation fails
        """
        required_keys = {"main_code", "test_code", "readme"}
        missing = required_keys - set(lab_files.keys())
        if missing:
            raise ValueError(f"Lab {lab_id} missing required keys: {sorted(missing)}")

        for key in required_keys:
            val = lab_files.get(key)
            if not isinstance(val, str) or not val.strip():
                raise ValueError(f"Lab {lab_id} - {key} is empty or not a string")

    def _pre_generation_hook(self, lab_id: str) -> None:
        """Hook called before lab generation. Override to add pre-processing."""
        return

    def _post_generation_hook(self, lab_id: str, lab_files: LabFiles) -> None:
        """Hook called after lab generation. Override to add post-processing."""
        return

    def get_lab_metadata(self, lab_id: str) -> Optional[LabMetadata]:
        """Get metadata for a lab if registered."""
        return self.metadata_registry.get(lab_id)

    def list_labs_with_metadata(self) -> list[tuple[str, Optional[LabMetadata]]]:
        """List all labs with their metadata."""
        # self.labs is assumed from LabGenerator; fallback to custom_labs if not present
        labs_dict = getattr(self, "labs", self.custom_labs)
        return [(lid, self.get_lab_metadata(lid)) for lid in sorted(labs_dict.keys())]


# ============= Lab Template Mixins =============


class LabTemplateMixin:
    """
    Mixin providing reusable lab template generators.

    Use with CustomLabGenerator to add templated labs quickly.
    """

    @staticmethod
    def template_numpy_function(
        *,
        lab_id: str,
        title: str,
        function_signature: str,
        docstring: str,
        unit_tests: str,
        success_criteria: str,
        difficulty: str = "intermediate",
        duration_hours: float = 2.0,
        topics: Optional[list[str]] = None,
    ) -> LabSpec:
        """Template for NumPy function implementation labs."""
        topics = topics or ["numpy", "python"]

        meta = LabMetadata(
            lab_id=lab_id,
            title=title,
            description=title,
            difficulty=difficulty,
            duration_hours=duration_hours,
            topics=topics,
        )
        meta.validate()

        main_code = f'''"""
{title}

Implement the following function(s) following the specifications below.
"""

import numpy as np

{function_signature}
    """
    {docstring}
    """
    # TODO: Implement
    raise NotImplementedError("Implement per docstring")


if __name__ == "__main__":
    print("Run tests with: pytest {lab_id}_test.py -v")
'''

        test_code = f'''"""
Unit tests for {title}
"""

import numpy as np
import pytest

{unit_tests}


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
'''

        readme = f"""# {title}

## Objective
Implement the specified function(s) per the docstring requirements.

## Specifications
See docstrings in `{lab_id}_starter.py`.

## Unit Tests
Run:
```bash
pytest {lab_id}_test.py -v
```

## Success Criteria

{success_criteria}

## Getting Started

1. Review function signatures and docstrings
2. Implement each function
3. Run tests
4. All tests should pass
"""

        return LabSpec(
            metadata=meta, main_code=main_code, test_code=test_code, readme=readme
        )

    @staticmethod
    def template_class_implementation(
        *,
        lab_id: str,
        class_name: str,
        methods: list[tuple[str, str]],
        unit_tests: str,
        title: Optional[str] = None,
        difficulty: str = "intermediate",
        duration_hours: float = 3.0,
        topics: Optional[list[str]] = None,
    ) -> LabSpec:
        """Template for class implementation labs."""
        topics = topics or ["oop", "python"]
        title = title or f"{class_name} Implementation"

        meta = LabMetadata(
            lab_id=lab_id,
            title=title,
            description=f"Implement {class_name} class",
            difficulty=difficulty,
            duration_hours=duration_hours,
            topics=topics,
        )
        meta.validate()

        methods_code = "\n\n    ".join(
            [
                f'def {name}(self):\n        """{doc}"""\n        # TODO: Implement\n        raise NotImplementedError\n'
                for name, doc in methods
            ]
        )

        main_code = f'''"""
{title}

Implement the {class_name} class with the following methods:
{", ".join([name for name, _ in methods])}
"""


class {class_name}:
    """Implementation class."""

    def __init__(self):
        """Initialize."""
        pass

    {methods_code}


if __name__ == "__main__":
    print("Run tests with: pytest {lab_id}_test.py -v")
'''

        test_code = f'''"""
Tests for {class_name}
"""

import pytest

{unit_tests}


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-v"]))
'''

        readme = f"""# {title}

## Objective

Implement the `{class_name}` class.

## Methods required

{", ".join([name for name, _ in methods])}

## Run tests

```bash
pytest {lab_id}_test.py -v
```
"""

        return LabSpec(
            metadata=meta, main_code=main_code, test_code=test_code, readme=readme
        )


# ============= Registry-Based Generator =============


class RegistryLabGenerator(CustomLabGenerator, LabTemplateMixin):
    """
    Lab generator with runtime registry for maximum flexibility.

    Supports:
    - Registering custom labs at runtime
    - Template-based lab creation
    - Metadata management
    - Filtering and discovery
    """

    def __init__(self) -> None:
        """Initialize with empty registry."""
        super().__init__()
        self._registry: Dict[str, Dict[str, Any]] = {}

    def register_custom_lab(
        self,
        lab_id: str,
        title: str,
        generator_fn: Callable[[], LabFiles],
        metadata: Optional[LabMetadata] = None,
        **extra_fields: Any,
    ) -> None:
        """Register a custom lab with full metadata."""
        self.register_lab(lab_id, generator_fn, metadata)

        self._registry[lab_id] = {
            "title": title,
            "generator_fn": generator_fn,
            "metadata": metadata,
            **extra_fields,
        }

    def register_template_lab(self, lab_id: str, spec: LabSpec) -> None:
        """Register a lab from a LabSpec (template-generated)."""

        def gen_fn() -> LabFiles:
            return spec.to_dict()

        # Ensure lab_id consistency
        if spec.metadata.lab_id != lab_id:
            raise ValueError(
                f"Spec metadata.lab_id='{spec.metadata.lab_id}' does not match register lab_id='{lab_id}'"
            )

        self.register_custom_lab(
            lab_id=lab_id,
            title=spec.metadata.title,
            generator_fn=gen_fn,
            metadata=spec.metadata,
        )

    def filter_labs(
        self, difficulty: Optional[str] = None, topic: Optional[str] = None
    ) -> list[str]:
        """Filter labs by difficulty or topic."""
        matching: list[str] = []

        for lab_id, metadata in self.list_labs_with_metadata():
            if metadata is None:
                continue
            if difficulty and metadata.difficulty != difficulty:
                continue
            if topic and topic not in metadata.topics:
                continue
            matching.append(lab_id)

        return matching

    def export_registry(self, filepath: str | Path) -> None:
        """Export registry metadata to JSON."""
        import json

        fp = Path(filepath)
        data: dict[str, Any] = {}

        for lab_id, metadata in self.list_labs_with_metadata():
            if metadata:
                data[lab_id] = {
                    "title": metadata.title,
                    "description": metadata.description,
                    "difficulty": metadata.difficulty,
                    "duration_hours": metadata.duration_hours,
                    "topics": metadata.topics,
                    "prerequisites": metadata.prerequisites,
                    "learning_outcomes": metadata.learning_outcomes,
                }

        fp.write_text(json.dumps(data, indent=2), encoding="utf-8", newline="\n")


# ============= Converters & Utilities =============


def spec_to_files(spec: LabSpec, output_dir: Path) -> None:
    """Convert a LabSpec to files on disk."""
    output_dir.mkdir(parents=True, exist_ok=True)

    spec.metadata.validate()
    lab_id = spec.metadata.lab_id

    (output_dir / f"{lab_id}_starter.py").write_text(
        spec.main_code, encoding="utf-8", newline="\n"
    )
    (output_dir / f"{lab_id}_test.py").write_text(
        spec.test_code, encoding="utf-8", newline="\n"
    )
    (output_dir / f"{lab_id}_README.md").write_text(
        spec.readme, encoding="utf-8", newline="\n"
    )


def import_labs_from_module(module_name: str, generator: CustomLabGenerator) -> None:
    """
    Dynamically import labs from a module.

    Convention: Module should have dict `CUSTOM_LABS = {"lab_id": generator_fn}`
    """
    import importlib

    try:
        module = importlib.import_module(module_name)
    except ImportError as e:
        print(f"Warning: Could not import {module_name}: {e}")
        return

    custom = getattr(module, "CUSTOM_LABS", None)
    if isinstance(custom, dict):
        for lab_id, gen_fn in custom.items():
            generator.register_lab(lab_id, gen_fn)


if __name__ == "__main__":
    print("Extensible Lab Generator Design Patterns")
    print("=" * 60)
    print("\nUsage:")
    print("  from lab_extensions import CustomLabGenerator")
    print("  gen = CustomLabGenerator()")
    print("  gen.register_lab('my_lab', my_generator_fn)")
    print("  gen.generate_lab('my_lab')")
    print("\nSee lab_extensions_examples.py for detailed examples.")
