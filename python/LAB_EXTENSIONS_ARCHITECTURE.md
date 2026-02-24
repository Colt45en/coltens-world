# Lab Generator Extensibility Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                  Lab Generator System                       │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
            ┌──────────────┐    ┌──────────────┐
            │ Base Classes │    │   Templates  │
            └──────────────┘    └──────────────┘
                    │                   │
                    └─────────┬─────────┘
                              ▼
                ┌──────────────────────────────┐
                │   LabGenerator (Base)        │
                │  - 8 built-in labs           │
                │  - Core generation logic     │
                └──────────────────────────────┘
                              │
                    ┌─────────┴────────────┐
                    ▼                      ▼
        ┌─────────────────────┐  ┌─────────────────────┐
        │CustomLabGenerator   │  │RegistryLabGenerator │
        │ - Runtime register  │  │ - Full registry     │
        │ - Validation hooks  │  │ - Filtering         │
        │ - Metadata mgmt     │  │ - Templates         │
        │ - Pre/post hooks    │  │ - Serialization     │
        └─────────────────────┘  └─────────────────────┘
                    │                      │
        ┌───────────┼───────────┐          │
        ▼           ▼           ▼          ▼
    Custom   Template   Validation   Registry
    Subclass  Mixin     Hooks        Mgmt
```

## Class Hierarchy

```
LabGenerator (Base - 1500 lines)
    │
    ├─ Built-in labs (8 labs)
    │   ├ la01_regression_from_scratch
    │   ├ la02_pca_scratch
    │   ├ opt01_autodiff_mini
    │   ├ opt02_logistic_from_scratch
    │   ├ ps01_naive_bayes
    │   ├ ps02_bootstrap_ci
    │   ├ geo01_knn_metrics
    │   └ info01_softmax_ce
    │
    └─ Extension Points
        │
        ├─ CustomLabGenerator
        │   │
        │   └─ Custom Validation Hooks
        │       ├ _validate_lab()
        │       ├ _pre_generation_hook()
        │       └ _post_generation_hook()
        │
        ├─ RegistryLabGenerator
        │   │
        │   ├─ Runtime Registration
        │   │   ├ register_lab()
        │   │   ├ register_custom_lab()
        │   │   └ register_template_lab()
        │   │
        │   ├─ Discovery & Filtering
        │   │   ├ filter_labs()
        │   │   ├ list_labs_with_metadata()
        │   │   └ get_lab_metadata()
        │   │
        │   └─ Serialization
        │       └ export_registry()
        │
        └─ LabTemplateMixin
            │
            ├─ template_numpy_function()
            └─ template_class_implementation()
```

## Extension Patterns Flowchart

```
                    Need Custom Labs?
                          │
                          ▼
        ┌──────────────────────────────────────┐
        │  How many labs? How much customization?
        └──────────────────────────────────────┘
                   │        │        │
        ┌──────────┴───┐    │        └────────────┐
        ▼              ▼    ▼                     ▼
    1-5 Labs    10+ Similar  Complex       Extreme
                  Labs      Validation     Flexibility
        │              │        │              │
        ▼              ▼        ▼              ▼
    Pattern 1:    Pattern 3:  Pattern 4:   Pattern 2:
    Simple      Template      Custom      Runtime
    Subclass    Generation    Hooks       Registry
        │              │        │              │
        ▼              ▼        ▼              ▼
    class           class         class       gen =
    MyGen(          GenFactory(   ValidGen(  RegistryLabGenerator()
     LabGen):       LabTemplate,   LabGen):  gen.register_lab()
     def _def()      LabRegistry):  def       gen.register_custom()
      ...            def __init__  _valid()
                     ...           ...
```

## Data Flow

```
User Request
    │
    ├─ generate_lab(lab_id)
    │
    ▼
┌─────────────────────────┐
│ Pre-Generation Hook     │
│ (optional)              │
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│ Lab Generation          │
│ - Call generator_fn()   │
│ - Get main/test/readme  │
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│ Validation              │
│ - Custom checks         │
│ - Quality control       │
└─────────────────────────┘
    │
    ├─ ✗ Failure → ValueError → User
    │
    ▼
┌─────────────────────────┐
│ Post-Generation Hook    │
│ (optional)              │
└─────────────────────────┘
    │
    ▼
Lab Dictionary
{
  "main_code": "...",
  "test_code": "...",
  "readme": "..."
}
    │
    ▼
User → write_lab_files() → Disk Output
```

## Feature Matrix

| Feature | LabGen | CustomGen | RegistryGen | Notes |
|---------|--------|-----------|-------------|-------|
| **Core** | | | | |
| 8 built-in labs | ✓ | ✓ | ✓ | Foundation |
| Generate lab | ✓ | ✓ | ✓ | Main operation |
| **Extension** | | | | |
| Custom labs | Subclass | Subclass | Register | Different approaches |
| Runtime registration | ✗ | ✓ | ✓ | After init |
| Metadata | ✗ | ✓ | ✓ | Lab info storage |
| **Validation** | | | | |
| Basic validation | ✓ | ✓ | ✓ | Checks keys/content |
| Custom validation | ✗ | ✓ | ✓ | Enforce standards |
| Hooks | ✗ | ✓ | ✓ | Pre/post processing |
| **Discovery** | | | | |
| List labs | ✓ | ✓ | ✓ | Get all IDs |
| Filter by difficulty | ✗ | ✗ | ✓ | Requires metadata |
| Filter by topic | ✗ | ✗ | ✓ | Requires metadata |
| **Tools** | | | | |
| Templates | ✗ | ✗ | ✓ | Via mixin |
| Serialization | ✗ | ✗ | ✓ | JSON export |

## Extension Complexity vs. Flexibility

```
Flexibility
    ▲
    │     ┌─ Pattern 2: Runtime Registry
    │    ╱│  (Most Flexible)
    │   ╱ │  - Dynamic registration
   6│  ╱  │  - Full filtering
    │ ╱   │  - Serialization
    │╱    │
   5├─────┼─ Pattern 4: Custom Validation
    │     │  - Validation hooks
   4│ ┌───┼─ Pattern 3: Template Generation
    │ │   │  - Bulk creation
   3│ │ ┌─┼─ Pattern 1: Simple Subclass
    │ │ │ │  (Easiest)
   2│ │ │ │
    │ │ │ │
   1│ │ │ │
    └─┼─┼─┼────────────────────────► Complexity
      1 2 3 4 5 6
      (Low)     (High)
```

## File Organization

```
python/
├── lab_generator.py (1500+ lines)
│   └─ LabGenerator (8 built-in labs)
│
├── lab_extensions.py (400+ lines)
│   ├─ CustomLabGenerator
│   ├─ RegistryLabGenerator
│   ├─ LabTemplateMixin
│   ├─ LabMetadata (dataclass)
│   └─ LabSpec (dataclass)
│
├── generate_labs.py (CLI)
│   └─ write_lab_files()
│
├── lab_extensions_examples.py (300+ lines)
│   ├─ Example 1: Simple subclassing
│   ├─ Example 2: Template-based
│   ├─ Example 3: Runtime registration
│   ├─ Example 4: Custom validation
│   ├─ Example 5: Filtering & discovery
│   └─ Example 6: Export & serialization
│
├── lab_extensions_cheatsheet.py
│   └─ Quick reference for all patterns
│
├── LAB_EXTENSIONS_GUIDE.md
│   └─ Comprehensive 200+ line guide
│
└── labs/ (generated)
    ├── la01_regression_from_scratch/
    ├── la02_pca_scratch/
    ├── ...
    └── [custom labs generated here]
```

## Usage Patterns Quick Comparison

| Scenario | Pattern | Code |
|----------|---------|------|
| Add 2-3 labs | Pattern 1 | `class MyGen(LabGenerator): ...` |
| Create 20 similar | Pattern 3 | `TemplateGen().register_template_lab()` |
| Dynamic plugins | Pattern 2 | `gen.register_lab(id, fn)` |
| Quality control | Pattern 4 | `class ValidGen(CustomLabGenerator): ...` |
| All features | Pattern 2 | `RegistryLabGenerator()` |

## Integration Points

```
Your Code
    │
    ├─ Import LabGenerator
    │   └─ Use 8 built-in labs directly
    │
    ├─ Subclass CustomLabGenerator
    │   ├─ Add custom labs
    │   └─ Add validation hooks
    │
    ├─ Use RegistryLabGenerator
    │   ├─ Register at runtime
    │   ├─ Filter and discover
    │   └─ Export metadata
    │
    └─ Use LabTemplateMixin
        └─ Generate bulk labs from templates
            │
            ▼
        Output: {main_code, test_code, readme}
            │
            ├─ Display in web UI
            ├─ Save to disk
            ├─ Export to LMS
            ├─ Upload to GitHub Classroom
            └─ Serialize to JSON/YAML
```

## Example Inheritance Trees

**Option A: Simple Subclassing**
```
LabGenerator
    │
    └─ MyLabGenerator
```

**Option B: Registry with Templates**
```
LabGenerator
    │
    ├─ CustomLabGenerator
    │   │
    │   └─ (mixin) LabTemplateMixin
    │       │
    │       └─ RegistryLabGenerator
    │           │
    │           └─ MyTemplateGen (your code)
```

**Option C: Full-Featured Custom**
```
LabGenerator
    │
    └─ CustomLabGenerator
        │
        ├─ _validate_lab() override
        ├─ _pre_generation_hook() override
        ├─ _post_generation_hook() override
        │
        └─ MyValidatingGen (your code)
```

## API Quick Reference

```
LabGenerator
  .generate_lab(lab_id)

CustomLabGenerator (extends above)
  .register_lab(id, fn, metadata)
  ._validate_lab(id, files)
  ._pre_generation_hook(id)
  ._post_generation_hook(id, files)
  .get_lab_metadata(id)
  .list_labs_with_metadata()

RegistryLabGenerator (extends above)
  .register_custom_lab(id, title, fn, meta)
  .register_template_lab(id, spec)
  .filter_labs(difficulty, topic)
  .export_registry(filepath)

LabTemplateMixin (mixin for above)
  .template_numpy_function(...)
  .template_class_implementation(...)

Data Classes
  LabMetadata(lab_id, title, description, difficulty,
              duration_hours, topics, prerequisites,
              learning_outcomes)
  LabSpec(metadata, main_code, test_code, readme)
```

## Key Takeaways

1. **Start simple**: Use Pattern 1 if you only need a few labs
2. **Scale with templates**: Use Pattern 3 for creating 10+ similar labs
3. **Go dynamic**: Use Pattern 2 when you need runtime registration
4. **Ensure quality**: Use Pattern 4 to enforce standards
5. **Combine freely**: Mix and match patterns as needed

---

**Architecture Version**: 1.0
**Created**: 2026-02-22
**Status**: Production-Ready
