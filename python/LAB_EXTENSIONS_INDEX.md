# Lab Generator Extensibility Index

Complete index and quick navigation for extending the LabGenerator system.

## 📚 Documentation Files

| File | Purpose | Audience | Time |
|------|---------|----------|------|
| [LAB_EXTENSIONS_GUIDE.md](#guide) | Comprehensive reference | All | 30 min |
| [LAB_EXTENSIONS_ARCHITECTURE.md](#architecture) | System design & flowcharts | Architects, Leads | 20 min |
| [lab_extensions_cheatsheet.py](#cheatsheet) | Quick patterns & snippets | Developers | 5 min |
| [lab_extensions.py](#code) | Core extensibility code | Reference | - |
| [lab_extensions_examples.py](#examples) | Runnable examples | Learners | 10 min |

## 🎯 Quick Navigation by Use Case

### "I want to add 1-3 custom labs"

**→ Pattern 1: Simple Subclassing**

1. Read: [Simple Pattern Section](#pattern-1-simple-subclassing)
2. Copy: Template from [cheatsheet.py](#) (lines 5-70)
3. Run: `python -c "from my_labs import MyLabGenerator; gen = MyLabGenerator()"`
4. Generate: `gen.generate_lab('my_lab')`

**Time: 15 minutes**

```python
from lab_generator import LabGenerator

class MyLabGenerator(LabGenerator):
    def _define_labs(self):
        labs = super()._define_labs()
        labs["my_lab"] = self._lab_my_lab
        return labs

    @staticmethod
    def _lab_my_lab():
        return {"main_code": "...", "test_code": "...", "readme": "..."}

gen = MyLabGenerator()
gen.generate_lab("my_lab")
```

---

### "I want to create 10+ similar labs quickly"

**→ Pattern 3: Template-Based Generation**

1. Read: [Template Pattern Section](#pattern-3-template-based)
2. Copy: [Algorithm Example](#) from examples.py
3. Customize: Modify template parameters
4. Generate: `gen.generate_lab("algo_01")`

**Time: 20 minutes**

```python
from lab_extensions import LabTemplateMixin, RegistryLabGenerator

class AlgorithmLabFactory(LabTemplateMixin, RegistryLabGenerator):
    def __init__(self):
        super().__init__()
        self._create_bulk_labs()

    def _create_bulk_labs(self):
        for i, (name, desc) in enumerate(ALGORITHM_LIST):
            spec = LabTemplateMixin.template_numpy_function(
                title=name,
                function_signature=f"def {name.lower()}(arr):",
                docstring=desc,
                unit_tests="def test_...: pass",
                success_criteria="All tests pass",
            )
            self.register_template_lab(f"algo_{i}", spec)

gen = AlgorithmLabFactory()
```

---

### "I need dynamic/plugin lab registration"

**→ Pattern 2: Runtime Registration**

1. Read: [Runtime Registration Section](#pattern-2-runtime-registration)
2. Copy: [Example 3](#) from examples.py (lines 150-190)
3. Register: `gen.register_lab(id, generator_fn, metadata)`
4. Filter: `easy = gen.filter_labs(difficulty="beginner")`

**Time: 15 minutes**

```python
from lab_extensions import RegistryLabGenerator, LabMetadata

gen = RegistryLabGenerator()

metadata = LabMetadata(
    lab_id="my_lab",
    title="My Lab",
    description="...",
    difficulty="beginner",
    duration_hours=2.0,
    topics=["python"],
)

gen.register_custom_lab("my_lab", "My Lab", my_generator_fn, metadata)
labs = gen.filter_labs(topic="python")
```

---

### "I need to enforce lab quality standards"

**→ Pattern 4: Custom Validation Hooks**

1. Read: [Validation Hooks Section](#pattern-4-custom-validation)
2. Copy: [ValidatingLabGenerator](#) from examples.py
3. Override: `_validate_lab()`, `_pre_generation_hook()`, `_post_generation_hook()`
4. Generate: `gen.generate_lab(lab_id)`

**Time: 20 minutes**

```python
from lab_extensions import CustomLabGenerator

class ValidatingLabGenerator(CustomLabGenerator):
    def _validate_lab(self, lab_id, lab_files):
        super()._validate_lab(lab_id, lab_files)
        # Add custom validation
        if lab_files["test_code"].count("def test_") < 3:
            raise ValueError("Need 3+ tests")

gen = ValidatingLabGenerator()
gen.generate_lab("my_lab")
```

---

### "I want 100% flexibility"

**→ Pattern 2 (Advanced): Full RegistryLabGenerator**

1. Read: [Complete API Reference](#api-reference)
2. Study: [All Examples](#)
3. Combine: Multiple patterns as needed
4. Use: All RegistryLabGenerator features

**Time: 30+ minutes**

```python
from lab_extensions import RegistryLabGenerator, LabTemplateMixin

class AdvancedGen(LabTemplateMixin, RegistryLabGenerator):
    def __init__(self):
        super().__init__()
        # - Use templates
        # - Register dynamically
        # - Apply metadata
        # - Filter & export
```

---

## 📖 Documentation Sections

### <a name="pattern-1-simple-subclassing"></a>Pattern 1: Simple Subclassing

**Best for:** 1-5 custom labs

[Full Guide →](LAB_EXTENSIONS_GUIDE.md#pattern-a-simple-subclassing)

```
File: my_labs.py
Extend: LabGenerator._define_labs()
Time: 15 min
Effort: Low
Flexibility: Low
```

Example files:
- [lab_extensions_examples.py, lines 45-130](lab_extensions_examples.py#L45)
- [lab_extensions_cheatsheet.py, lines 5-70](lab_extensions_cheatsheet.py#L5)

---

### <a name="pattern-2-runtime-registration"></a>Pattern 2: Runtime Registration

**Best for:** Dynamic labs, plugins, configuration-driven

[Full Guide →](LAB_EXTENSIONS_GUIDE.md#pattern-b-runtime-registration)

```
File: lab_registry.py or inline in gen initialization
Use: RegistryLabGenerator.register_custom_lab()
Time: 15 min
Effort: Medium
Flexibility: High
```

Example files:
- [lab_extensions_examples.py, lines 195-240](lab_extensions_examples.py#L195)
- [lab_extensions_cheatsheet.py, lines 75-130](lab_extensions_cheatsheet.py#L75)

---

### <a name="pattern-3-template-based"></a>Pattern 3: Template-Based Generation

**Best for:** Creating 10+ similar labs

[Full Guide →](LAB_EXTENSIONS_GUIDE.md#pattern-c-template-based)

```
File: template_labs.py
Use: LabTemplateMixin.template_*() + register_template_lab()
Time: 20 min
Effort: Medium
Flexibility: Medium
```

Example files:
- [lab_extensions_examples.py, lines 245-330](lab_extensions_examples.py#L245)
- [lab_extensions_cheatsheet.py, lines 135-200](lab_extensions_cheatsheet.py#L135)

---

### <a name="pattern-4-custom-validation"></a>Pattern 4: Custom Validation & Hooks

**Best for:** Enforcing quality standards

[Full Guide →](LAB_EXTENSIONS_GUIDE.md#pattern-d-custom-validation--hooks)

```
File: validating_labs.py
Use: CustomLabGenerator + override _validate_lab()
Time: 20 min
Effort: High
Flexibility: High
```

Example files:
- [lab_extensions_examples.py, lines 335-400](lab_extensions_examples.py#L335)
- [lab_extensions_cheatsheet.py, lines 205-260](lab_extensions_cheatsheet.py#L205)

---

## 🔧 <a name="api-reference"></a>API Reference

### Core Classes

**LabGenerator** (base, 1500 lines)
- 8 built-in labs included
- Main method: `generate_lab(lab_id)`
- [Source: lab_generator.py](lab_generator.py)

**CustomLabGenerator**
- Extends: LabGenerator
- Adds: `register_lab()`, validation hooks
- [Source: lab_extensions.py, lines 80-200](lab_extensions.py#L80)

**RegistryLabGenerator**
- Extends: CustomLabGenerator, LabTemplateMixin
- Adds: Filtering, serialization, metadata
- [Source: lab_extensions.py, lines 250-380](lab_extensions.py#L250)

**LabTemplateMixin**
- Provides: `template_numpy_function()`, `template_class_implementation()`
- [Source: lab_extensions.py, lines 150-250](lab_extensions.py#L150)

### Data Classes

**LabMetadata** - Lab information
```python
LabMetadata(
    lab_id: str,                    # Unique ID
    title: str,                     # Display title
    description: str,               # Short description
    difficulty: str,                # beginner|intermediate|advanced
    duration_hours: float,          # Estimated time
    topics: list[str],              # Keywords
    prerequisites: list[str] = [],  # Optional
    learning_outcomes: list[str] = [],  # Optional
)
```

**LabSpec** - Complete lab specification
```python
LabSpec(
    metadata: LabMetadata,
    main_code: str,
    test_code: str,
    readme: str,
)
```

---

## 📋 <a name="guide"></a>Full Extension Guide

See [LAB_EXTENSIONS_GUIDE.md](LAB_EXTENSIONS_GUIDE.md) for:

- ✓ Detailed pattern explanations
- ✓ Code examples for each pattern
- ✓ Best practices and conventions
- ✓ Advanced patterns (inheritance, conditional registration)
- ✓ Troubleshooting guide
- ✓ API reference with examples

**Length:** ~500 lines | **Read time:** 30 minutes

---

## 🏗️ <a name="architecture"></a>System Architecture

See [LAB_EXTENSIONS_ARCHITECTURE.md](LAB_EXTENSIONS_ARCHITECTURE.md) for:

- ✓ Class hierarchy diagrams
- ✓ Extension flowcharts
- ✓ Data flow visualization
- ✓ Feature matrix comparison
- ✓ Complexity vs. flexibility analysis
- ✓ File organization guide
- ✓ Integration points

**Length:** ~400 lines | **Read time:** 20 minutes

---

## <a name="cheatsheet"></a>Quick Cheatsheet

See [lab_extensions_cheatsheet.py](lab_extensions_cheatsheet.py) for:

- ✓ All 4 patterns side-by-side
- ✓ Copy-paste code snippets
- ✓ One-liner examples
- ✓ Quick commands
- ✓ Template generators
- ✓ Metadata structure
- ✓ Complete working example

**Length:** ~400 lines | **Read time:** 5-10 minutes | **Type:** Python file

Run: `python lab_extensions_cheatsheet.py`

---

## <a name="examples"></a>Working Examples

See [lab_extensions_examples.py](lab_extensions_examples.py) for:

**6 Complete Working Examples:**

1. **Simple Subclassing** (lines 45-130)
   - DataScienceLabGenerator with 3 custom labs
   - pandas, data_cleaning, visualization

2. **Template-Based** (lines 245-330)
   - AlgorithmLabGenerator with sorting algorithms
   - Automatic template generation

3. **Runtime Registration** (lines 195-240)
   - Register custom stats lab at runtime
   - Full metadata included

4. **Custom Validation** (lines 335-400)
   - ValidatingLabGenerator with strict checks
   - Pre/post hooks with logging

5. **Filtering & Discovery** (lines 420-480)
   - Filter labs by difficulty/topic
   - Analyze lab statistics

6. **Export & Serialization** (lines 495-510)
   - Export lab metadata to JSON
   - Registry management

**Run All:** `python lab_extensions_examples.py`

---

## 🎓 Learning Path

### For Beginners

1. **15 min:** Read [Quick Start → Pattern 1](#quick-start)
2. **10 min:** Copy code from [cheatsheet.py](#cheatsheet)
3. **15 min:** Run [Example 1 from examples.py](#examples)
4. **10 min:** Create your own simple subclass

**Total: 50 minutes → You can now create custom labs!**

### For Intermediate

1. **20 min:** Read [Pattern 2 & 3](#pattern-2-runtime-registration)
2. **20 min:** Run [Example 3 & 2 from examples.py](#examples)
3. **15 min:** Create 5+ labs using templates
4. **10 min:** Register and filter labs

**Total: 65 minutes → You can now use advanced features!**

### For Advanced

1. **30 min:** Read complete [LAB_EXTENSIONS_GUIDE.md](#guide)
2. **30 min:** Study [LAB_EXTENSIONS_ARCHITECTURE.md](#architecture)
3. **30 min:** Run all [6 examples](#examples)
4. **30 min:** Create custom solution combining patterns

**Total: 2 hours → You're an expert!**

---

## 💡 Common Tasks

### Task: Add a custom lab

**Time: 5 minutes | Pattern: 1 | Difficulty: Easy**

```python
from lab_generator import LabGenerator

class MyGen(LabGenerator):
    def _define_labs(self):
        labs = super()._define_labs()
        labs["my_lab"] = self._lab_my
        return labs

    @staticmethod
    def _lab_my():
        # Return dict with main_code, test_code, readme
        pass

gen = MyGen()
gen.generate_lab("my_lab")
```

See: [Pattern 1 Quick Start](#pattern-1-simple-subclassing)

---

### Task: Create 20 similar labs

**Time: 30 minutes | Pattern: 3 | Difficulty: Medium**

```python
from lab_extensions import LabTemplateMixin, RegistryLabGenerator

class BulkGen(LabTemplateMixin, RegistryLabGenerator):
    def __init__(self):
        super().__init__()
        for i in range(20):
            spec = LabTemplateMixin.template_numpy_function(...)
            self.register_template_lab(f"lab_{i}", spec)

gen = BulkGen()
for lab_id in gen.labs.keys():
    gen.generate_lab(lab_id)
```

See: [Pattern 3 → Template-Based](#pattern-3-template-based)

---

### Task: Filter labs by topic

**Time: 5 minutes | Pattern: 2 | Difficulty: Easy**

```python
from lab_extensions import RegistryLabGenerator

gen = RegistryLabGenerator()
# ... register labs with metadata ...

python_labs = gen.filter_labs(topic="python")
beginner_labs = gen.filter_labs(difficulty="beginner")
```

See: [Example 5: Filtering & Discovery](#examples)

---

### Task: Enforce quality standards

**Time: 20 minutes | Pattern: 4 | Difficulty: Medium**

```python
from lab_extensions import CustomLabGenerator

class ValidGen(CustomLabGenerator):
    def _validate_lab(self, lab_id, lab_files):
        super()._validate_lab(lab_id, lab_files)
        if lab_files["test_code"].count("def test_") < 3:
            raise ValueError("Need 3+ tests")

gen = ValidGen()
gen.generate_lab("my_lab")
```

See: [Pattern 4: Custom Validation](#pattern-4-custom-validation)

---

## 🔍 Finding What You Need

| I want to... | Pattern | File | Time |
|-------------|---------|------|------|
| Add 1-3 labs | 1 | Cheatsheet | 5 min |
| Create 10+ labs | 3 | Examples | 20 min |
| Plugin architecture | 2 | Guide | 15 min |
| Quality enforcement | 4 | Examples | 20 min |
| Full features | 2 (Advanced) | Architecture | 30 min |
| Understand design | - | Architecture | 20 min |
| Copy-paste code | - | Cheatsheet | 5 min |
| Learn by example | - | Examples | 30 min |
| Reference docs | - | Guide | 30 min |

---

## 📞 Support Resources

| Question | Answer Location |
|----------|-----------------|
| "How do I..." | [Quick Navigation](#quick-navigation-by-use-case) |
| "Show me code" | [lab_extensions_examples.py](#) |
| "Explain the pattern" | [LAB_EXTENSIONS_GUIDE.md](#) |
| "How is it designed?" | [LAB_EXTENSIONS_ARCHITECTURE.md](#) |
| "Quick reference" | [lab_extensions_cheatsheet.py](#) |
| "API details" | [lab_extensions.py](#) source code |

---

## ✅ Checklist: Getting Started

- [ ] Read [Quick Start](#quick-navigation-by-use-case) for your use case (5 min)
- [ ] Copy code from [cheatsheet.py](#cheatsheet) or [examples.py](#examples) (5 min)
- [ ] Modify for your needs (10 min)
- [ ] Test: `gen.generate_lab("my_id")` (5 min)
- [ ] Save to disk: `write_lab_files("my_id", "output/")` (2 min)
- [ ] Review generated files in `output/` (5 min)
- [ ] **Done! You've created your first custom lab.** 🎉

**Total time: 30 minutes to your first custom lab**

---

## Version & Status

**Version:** 1.0 Extensibility Framework
**Created:** 2026-02-22
**Status:** ✅ Production-Ready
**Maintained:** Yes
**License:** MIT (same as parent project)

---

## Files Included in Extensibility Package

```
python/
├── lab_extensions.py (400+ lines)
│   └─ Core extensibility classes
├── lab_extensions_examples.py (300+ lines)
│   └─ 6 complete working examples
├── lab_extensions_cheatsheet.py (400+ lines)
│   └─ Quick reference & snippets
├── LAB_EXTENSIONS_GUIDE.md (500+ lines)
│   └─ Comprehensive reference manual
├── LAB_EXTENSIONS_ARCHITECTURE.md (400+ lines)
│   └─ System design & diagrams
└── LAB_EXTENSIONS_INDEX.md (THIS FILE)
    └─ Navigation & quick start
```

**Total: 2000+ lines of extension-related code and documentation**

---

**Ready to start extending? Pick your use case from [Quick Navigation](#quick-navigation-by-use-case) above!** 🚀
