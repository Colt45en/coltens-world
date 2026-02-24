# AgentCPM-GUI Style Pipeline — Formal Architecture Spec (Repo-Aligned)

**Doc version:** 1.0
**Determinism contract:** STRICT ✅ (canonical JSON, schema-validated, auditable)

---

## 0) Goals and Non-Goals

### Goals
- **Two-layer action architecture stays strict:**
  - **Model action** (compact JSON emitted by model) → **Executor action** (playwright/uia/etc).
- Offline pipeline supports:
  - **Stage I** grounding eval (Text2Point / Fun2Point / BBox2Text)
  - **Stage II** SFT next-action prediction eval
  - **Stage III** reward computation for RFT/GRPO style loops
- Deterministic formatting:
  - compact JSON, stable keys, schema-validated, auditable logs

### Non-Goals
- Repo does **not** ship a VLM/training framework (by design).
- Repo does **not** enforce a single RL algorithm; it only provides **reward + validators**.

---

## 1) Component Map

### Core library (`apps/agent-suite/packages/core/`)
**Responsibilities**
- Define **schemas**, **normalization**, **bridges**, **metrics**, **reward**
- Be pure + deterministic (**no executor I/O**, **no network**, **no nondeterminism**)

**Modules**
- `coords.py` — normalize/de-normalize points/boxes (0..1000 space)
- `grounding_tasks.py` — JSONL schemas + loaders for Stage I tasks
- `model_actions.py` — compact model action schema (pydantic) + canonical JSON dumps/loads
- `action_schema.py` — executor action schema (the "real" operational actions)
- `executor_bridge.py` — convert `AgentAction` → executor actions (+ inverse if needed)
- `metrics.py` — Stage I/II/III metric functions
- `reward.py` — Stage III reward & task verifiers

### Tools (`apps/agent-suite/tools/`)
**Responsibilities**
- Offline CLI runners:
  - read JSONL → validate → score → write JSONL reports
- **No business logic duplicated here** (tools import from `packages.core`)

**CLIs**
- `eval_stage1.py`
- `eval_stage2.py`
- `reward_stage3.py`
- optional parquet/data tools: `convert_*`, `embed_images_*`

### Tests (`apps/agent-suite/tests/`)
**Responsibilities**
- Lock invariants:
  - schema validation
  - compact JSON determinism
  - coordinate correctness (edges)
  - bridge correctness
  - reward correctness

---

## 2) Global Invariants (Hard Requirements)

These must remain true forever unless `schema_version` is bumped and tooling is updated.

### 2.1 Canonical coordinate space
- All points are **normalized ints** in `[0..1000]`:
  - `POINT = [x, y]` where `x,y ∈ ℤ` and `0 ≤ x,y ≤ 1000`
- All boxes are normalized ints:
  - `BOX = [x1,y1,x2,y2]` where `0 ≤ x1 ≤ x2 ≤ 1000` and `0 ≤ y1 ≤ y2 ≤ 1000`
- Normalization is **deterministic** and **clamped**:
  - out-of-range inputs must clamp to `[0..1000]`
- All conversions must be **stable across versions**:
  - any rounding rule must be explicitly documented (see `coords.py` contract below)

### 2.2 Canonical compact JSON (no drift)
Compact JSON emitted/consumed by the pipeline MUST be canonical:
- no whitespace
- stable key ordering
- excludes `null` keys
- `ensure_ascii=False`
- **One serializer** only (single function)

**Canonical dump rule**
```python
json.dumps(obj, separators=(",", ":"), sort_keys=True, ensure_ascii=False)
```

### 2.3 Schema validation is mandatory

* Every JSONL line is validated before scoring.
* Stage III reward uses:
  * `-1` **ONLY** for format/schema failure
  * `0` schema ok but wrong
  * `1` schema ok and correct

### 2.4 Deterministic bridging

`model_action -> [executor_actions...]` MUST be:

* deterministic ordering
* clamped to bounds
* auditable (log both layers + any clamp/repair decisions)

---

## 3) Data Flow by Stage (Contracts + Schemas)

All datasets are newline-delimited JSON (**JSONL**). Each line is one independent example.

### 3.1 Stage I — Grounding (pixel → semantics → location/text)

**Task types**

* `text2point`: `target_text` → predict point
* `fun2point`: functional description → predict point
* `bbox2text`: given bbox → output text

**Outputs (metrics per example)**

* point distance
* point-in-box accuracy (when a target box exists)
* exact match (bbox2text)

#### 3.1.1 Stage I JSONL schema (canonical)

Required keys across all Stage I tasks:

* `schema_version: int` (start at `1`)
* `task_type: "text2point" | "fun2point" | "bbox2text"`
* `image_path: str` (relative path or URI)
* `screen_size: [int width, int height]` (raw pixel dimensions)

Optional / task-dependent keys:

* `target_text: str` (text2point, bbox2text)
* `target_function: str` (fun2point)
* `target_point: [int,int]` normalized (text2point, fun2point)
* `target_box: [int,int,int,int]` normalized (any if available; required for bbox2text)

#### 3.1.2 FIXED Stage I example (valid JSON) ✅

```json
{
  "schema_version": 1,
  "task_type": "text2point",
  "image_path": "screenshots/001.png",
  "target_text": "Submit",
  "target_point": [500, 750],
  "target_box": [450, 720, 550, 780],
  "screen_size": [1920, 1080]
}
```

---

### 3.2 Stage II — SFT Next Action

**Inputs**
JSONL episodes with:

* instruction
* history
* screenshot reference
* gold action (model-level compact action JSON)

**Outputs**

* format validity rate
* strict/fuzzy match
* per-field accuracy (POINT, TYPE, PRESS, STATUS)

#### 3.2.1 Stage II JSONL schema (canonical) ✅ (DEDUPED — only one copy)

Required keys:

* `schema_version: int` (start at `1`)
* `episode_id: str`
* `instruction: str`
* `history: list[{"role": "user"|"assistant"|"system", "content": str}]`
* `screenshot: {"image_path": str, "screen_size": [int,int]}`
* `gold_action: object` (must validate as AgentAction; see Section 4)

Optional keys:

* `metadata: object` (task tags, app domain, etc.)

Example:

```json
{
  "schema_version": 1,
  "episode_id": "ep_000001",
  "instruction": "Log into the website with the provided email.",
  "history": [
    {"role": "user", "content": "Open the login page."},
    {"role": "assistant", "content": "Okay."}
  ],
  "screenshot": {
    "image_path": "screenshots/ep_000001.png",
    "screen_size": [1920, 1080]
  },
  "gold_action": {
    "POINT": [200, 300],
    "TYPE": "user@example.com",
    "STATUS": "continue"
  },
  "metadata": {
    "domain": "web",
    "app": "example_site"
  }
}
```

---

### 3.3 Stage III — Reward (RFT / GRPO)

**Inputs**
JSONL with:

* observation + instruction + task metadata
* model predicted action JSON (compact)
* optional gold target / verifier inputs

**Outputs**

* `reward ∈ {-1,0,1}`
* diagnostics: reason + details (required for debugging)

#### 3.3.1 Stage III JSONL schema (canonical)

Required keys:

* `schema_version: int` (start at `1`)
* `sample_id: str`
* `instruction: str`
* `observation: object` (task-specific but schema-validated at least as JSON object)
* `pred_action: object` (must validate as AgentAction)

Optional keys:

* `gold_action: object` (AgentAction)
* `verifier: object` (task-specific verification inputs: target_box, expected_text, etc.)
* `metadata: object`

Output/report line MUST include:

* `reward: int` (-1,0,1)
* `reason: str` (enumerated; see below)
* `details: object` (structured diagnostics)

Reason string must be one of:

* `format_invalid`
* `schema_invalid`
* `wrong_action`
* `correct_action`

Example input:

```json
{
  "schema_version": 1,
  "sample_id": "s_000042",
  "instruction": "Click Submit.",
  "observation": {
    "image_path": "screenshots/042.png",
    "screen_size": [1920, 1080]
  },
  "pred_action": {
    "POINT": [500, 750],
    "PRESS": "ENTER",
    "STATUS": "continue"
  },
  "verifier": {
    "target_box": [450, 720, 550, 780]
  }
}
```

Example output/report line:

```json
{
  "schema_version": 1,
  "sample_id": "s_000042",
  "reward": 1,
  "reason": "correct_action",
  "details": {
    "parsed_action": {"POINT":[500,750],"PRESS":"ENTER","STATUS":"continue"},
    "point_in_target_box": true,
    "clamped": false
  }
}
```

---

## 4) The Two-Layer Action Contract (Most Important Invariant)

### 4.1 Model action (compact) — `AgentAction`

* minimal keys
* stable schema
* designed to be emitted by a model
* canonical compact JSON (Section 2.2)

**Example**

```json
{"POINT":[500,500],"TYPE":"hello","STATUS":"continue"}
```

#### 4.1.1 AgentAction schema (explicit)

`AgentAction` is an object with these allowed keys:

* `POINT: [int,int]` normalized 0..1000 (optional)
* `TYPE: str` (optional)
* `PRESS: str` (optional)  e.g. `"ENTER"`, `"TAB"`, `"ESC"`, `"CTRL+L"`
* `STATUS: str` (required) one of:
  * `"continue"` — keep going
  * `"finish"` — task complete
  * `"fail"` — cannot proceed

**Invariants**

* Keys outside this set are invalid (schema failure).
* Values must meet type + range constraints.
* Recommended (strict) rule for determinism:
  * At least one of `TYPE` or `PRESS` must be present.
  * If `TYPE` is present and `POINT` is present → bridge MUST click/focus then type.
  * If `TYPE` is present and `POINT` is missing → bridge MUST follow a single deterministic policy:
    * either **(A)** treat as schema_invalid, or
    * **(B)** treat as "type into current focus" (but this must be the ONLY policy forever).
      Pick ONE and lock it in tests.

### 4.2 Executor action (operational) — `ExecutorAction`

Executor actions are what code can actually run (click/type/press/etc).
A single `AgentAction` may map to multiple executor actions.

Minimal canonical executor action set:

* `{"kind":"click","point":[x_px,y_px],"button":"left"}`
* `{"kind":"type","text":"..."}`
* `{"kind":"press","key":"ENTER"}`
* Optional (if supported): scroll, wait, drag, hotkey, etc.

### 4.3 Bridge rule — `AgentAction -> [ExecutorAction...]`

Bridge MUST be deterministic and auditable.

**Deterministic sequencing rule (recommended default)**
Given an `AgentAction`:

1. If `POINT` exists and (`TYPE` exists or `PRESS` exists): emit a **click** at that point first (focus).
2. If `TYPE` exists: emit **type** action next.
3. If `PRESS` exists: emit **press** action last.
4. Emit in that exact order every time.

**Clamping rule**

* Any normalized point/box out of range must clamp to `[0..1000]`
* When converting normalized → pixel, clamp within screen bounds:
  * `0 ≤ x_px < width`, `0 ≤ y_px < height`

**Audit rule**
Every run logs:

* original input JSON
* parsed `AgentAction` (canonical dump)
* clamping decisions (`clamped: true/false`, plus before/after)
* produced executor action list (canonical dump)

---

## 5) Interfaces (Public API) + No-Drift Boundaries

### 5.1 Public surface (`apps/agent-suite/packages/core/__init__.py`)

This file MUST export the stable surface area to prevent import spaghetti.

Export ONLY:

* `AgentAction`, `compact_action_dumps`, `compact_action_loads`
* `normalize_point`, `denormalize_point`, `normalize_box`, `denormalize_box`
* `load_grounding_jsonl`
* `model_to_executor`
* `stage1_metrics`, `stage2_metrics`, `compute_reward`

Everything else is internal.

### 5.2 Function contracts (explicit signatures)

(Exact language-level types may vary, but behavior must match.)

#### `coords.py`

* `normalize_point(x_px:int, y_px:int, screen_w:int, screen_h:int) -> tuple[int,int]`
* `denormalize_point(x_norm:int, y_norm:int, screen_w:int, screen_h:int) -> tuple[int,int]`
* `normalize_box(x1_px:int,y1_px:int,x2_px:int,y2_px:int, screen_w:int, screen_h:int) -> tuple[int,int,int,int]`
* `denormalize_box(x1_norm:int,y1_norm:int,x2_norm:int,y2_norm:int, screen_w:int, screen_h:int) -> tuple[int,int,int,int]`

**Rounding rule (must be stable):**

* Pixel→norm: `round(x_px * 1000 / (screen_w-1))` (or floor/ceil), but pick ONE and lock in tests.
* Norm→pixel: `round(x_norm * (screen_w-1) / 1000)` (or floor/ceil), but pick ONE and lock in tests.

#### `grounding_tasks.py`

* `load_grounding_jsonl(path_or_uri:str) -> list[dict]`
* Loader MUST:
  * parse JSONL
  * validate required fields
  * validate ranges/types of normalized coords/boxes
  * preserve line order (deterministic)

#### `model_actions.py`

* `class AgentAction(BaseModel): ...` (strict schema; forbid extra keys)
* `compact_action_dumps(obj:dict) -> str` (canonical JSON string)
* `compact_action_loads(s:str) -> dict` (parse + validate + return canonical dict)

✅ FIXED example:

```python
action = AgentAction(POINT=[200, 300], TYPE="user@example.com", STATUS="continue")
compact_json = compact_action_dumps(action.model_dump(exclude_none=True))
# {"POINT":[200,300],"STATUS":"continue","TYPE":"user@example.com"}
```

#### `executor_bridge.py`

* `model_to_executor(action:AgentAction, screen_size:tuple[int,int]) -> list[dict]`
* MUST implement sequencing + clamping + auditable mapping (Section 4.3)

#### `metrics.py`

* `stage1_metrics(example:dict, pred:dict) -> dict`
* `stage2_metrics(gold:dict, pred:dict) -> dict`

#### `reward.py`

* `compute_reward(sample:dict) -> dict` returning:
  * `reward: int` in `{-1,0,1}`
  * `reason: str` (enum)
  * `details: dict` (diagnostics)

---

## 6) Tools / CLIs (No Duplicate Logic)

### 6.1 `tools/eval_stage1.py`

* Input: Stage I JSONL + predictions JSONL (same ordering or keyed by id)
* Output: JSONL report with metrics per sample + aggregate summary

### 6.2 `tools/eval_stage2.py`

* Input: Stage II JSONL + predictions JSONL
* Output: format validity + strict/fuzzy + per-field accuracy + aggregate summary

### 6.3 `tools/reward_stage3.py`

* Input: Stage III JSONL
* Output: JSONL with `{reward, reason, details}` per sample + aggregate totals

**Tool rule**

* Tools are thin: **parse → validate → call core → write report**.

---

## 7) Tests (Invariants Must Be Locked)

Add/ensure these tests exist:

1. **Roundtrip determinism**
   * `compact_action_dumps(loads(dumps(x))) == dumps(x)`
2. **Clamp**
   * POINT outside range clamps to `[0..1000]`
3. **Bridge determinism**
   * POINT + TYPE produces the same executor sequence always
4. **Reward correctness**
   * invalid JSON/schema → `reward=-1` always
   * valid schema but wrong → `reward=0`
   * valid schema and correct → `reward=1`

Recommended additional tests:

* Coordinate conversion edge cases: (0,0), (1000,1000), screen_w=1 / screen_h=1 handling (must be defined)
* Box ordering repair or strict reject (pick ONE policy and lock it)

---

## 8) Audit Logging (Recommended but Deterministic)

Each tool should optionally emit a per-sample audit line (JSONL), canonical-dumped:

* `sample_id`
* `input_line_index`
* `parsed_action`
* `clamp_events`
* `executor_actions`
* `metrics/reward`

**Important:** audit logs must preserve input ordering and never include nondeterministic fields unless explicitly disabled.

---

## 9) Change Management (Prevent Drift)

### 9.1 Schema evolution rules

* Additive changes only (new optional fields) within a `schema_version`
* Any rename/removal requires `schema_version++`
* Every schema change must add/update tests that lock behavior

### 9.2 Single source of truth

* The only truth for compact JSON is `compact_action_dumps` / `compact_action_loads`.
* The only truth for action schema is `AgentAction` (extra keys forbidden).

---

## 🚀 Quick Start

### Installation & Setup

```bash
cd apps/agent-suite

# Install deps (if needed)
pip install pydantic pytest

# Run all locks
pytest -v

# Try a tool
python tools/reward_stage3.py --input data/samples.jsonl --out results_stage3.jsonl
```

### CLI Tools

**Stage I: Visual Grounding Evaluation**
```bash
python tools/eval_stage1.py --input data/grounding.jsonl --pred data/preds_stage1.jsonl --out results_stage1.jsonl
```

**Stage II: Action Prediction Evaluation**
```bash
python tools/eval_stage2.py --input data/actions.jsonl --pred data/preds_stage2.jsonl --out results_stage2.jsonl
```

**Stage III: Reward Computation**
```bash
python tools/reward_stage3.py --input data/samples.jsonl --out results_stage3.jsonl
```

All tools accept **line-aligned JSONL** input, output **canonical JSON** (no drift), and append a **summary record** as the final line.

---

## 💡 Design Notes

### Canonical JSON

A single `CANONICAL_JSON_KWARGS` constant enforces stable JSON output everywhere.

```python
CANONICAL_JSON_KWARGS = {
    "separators": (",", ":"),
    "sort_keys": True,
    "ensure_ascii": False,
}
```

### Deterministic Bridge

Executor sequencing is immutable and test-locked:

* **click** (if `POINT` and (`TYPE` or `PRESS`))
* **type** (if `TYPE`)
* **press** (if `PRESS`)

**Note:** `STATUS` is **not** an executor step; it is a model-level control field for internal auditing.

### Reward Diagnostics

Every sample returns:

* `reward ∈ {-1,0,1}` (format invalid / wrong / correct)
* `reason` (e.g., `format_invalid`, `wrong_action`, `correct_action`)
* `details` dict showing what was checked

### Per-Sample Evaluation

CLI tools emit per-line metrics so you can debug, parallelize, and aggregate easily.

### Integer-Only Coordinates

No float rounding drift: half-up integer arithmetic only.

---

**Everything is locked, tested, and drift-proof.** 🔒✨

---

## Appendix A — Canonical JSON Serializer (Single Function)

```python
import json

def compact_action_dumps(obj: dict) -> str:
    # obj should already have exclude_none applied upstream
    return json.dumps(obj, separators=(",", ":"), sort_keys=True, ensure_ascii=False)
```

---

## Appendix B — Pydantic Strictness (Recommended)

```python
from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List, Literal

class AgentAction(BaseModel):
    model_config = ConfigDict(extra="forbid")  # reject unknown keys

    POINT: Optional[List[int]] = Field(default=None, min_length=2, max_length=2)
    TYPE: Optional[str] = None
    PRESS: Optional[str] = None
    STATUS: Literal["continue", "finish", "fail"]
```

---

## Appendix C — HF `hf://` Paths Note

If you use pandas/pyarrow with `hf://datasets/...` in examples/tools, keep them isolated to tooling (not core),
and ensure tool dependencies include the relevant HF filesystem support.

Hugging Face documentation on fsspec integration:
- [Pandas with HF datasets](https://huggingface.co/docs/hub/en/datasets-pandas)
- [HF FileSystem](https://huggingface.co/docs/huggingface_hub/en/guides/hf_file_system)

```python
# Example: use hf:// paths in tool layer only
import pandas as pd
df = pd.read_json("hf://datasets/username/dataset/train.jsonl", lines=True)
```
