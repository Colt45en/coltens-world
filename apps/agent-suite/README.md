# Agent-GUI (Web + Windows Desktop + Local Files) 🖱️🧠

A **safe-by-default** automation starter kit that supports:

- 🌐 **Web browser automation** (Playwright, DOM/a11y-first)
- 🗂️ **Local files** (sandboxed allowlist roots)
- 🪟 **Windows desktop apps** (optional UI Automation via `pywinauto`)

This repo is an **executor + safety layer + action contract** you can build ML policies on later.
No ML is required to run it today.

## Nucleus Integration 🚀

The agent suite now integrates with the **World Engine Nucleus** as an HTTP service for tool execution. The nucleus can send tool execution requests via HTTP POST, and the agent executes them on the Windows desktop.

### Architecture

- **Agent Server**: HTTP server running on `http://127.0.0.1:3001`
- **Nucleus Communication**: HTTP POST requests for tool execution
- **Tool Execution**: Desktop automation using Windows UI Automation
- **Response Format**: JSON responses with execution results

### Starting with Nucleus

1. Ensure Nucleus is running on `localhost:3000`
2. Start the agent HTTP server:
```bash
python agent_main.py
```

The agent will start an HTTP server and be ready to receive tool execution requests.

### Communication Protocol

#### Tool Execution Request
```http
POST http://127.0.0.1:3001/tool/execute
Content-Type: application/json

{
  "action": {
    "kind": "click",
    "target": {"x": 500, "y": 300}
  },
  "trace_id": "trace-123",
  "session_id": "session-456"
}
```

#### Tool Execution Response
```json
{
  "action": {...},
  "result": {
    "status": "executed",
    "details": {...}
  },
  "success": true,
  "trace_id": "trace-123"
}
```

#### Health Check
```http
GET http://127.0.0.1:3001/health
```

Response: `{"status": "healthy"}`

---

## AgentCPM-GUI Training Pipeline Integration 🎓

The agent-suite now includes **full support for AgentCPM-GUI style training/evaluation**:

- **Stage I**: Visual grounding (Text2Point, Fun2Point, BBox2Text)
- **Stage II**: Supervised fine-tuning on action sequences
- **Stage III**: Reinforcement learning with format and semantic rewards

### Key Features

✅ **Two-Layer Architecture**
- **Model Layer**: Compact JSON actions (what your VLM emits)
- **Executor Layer**: Real UI automation (what your code runs)

✅ **Complete Toolkit**
- Coordinate normalization (pixel ↔ normalized [0..1000])
- JSONL/Parquet dataset schemas
- Evaluation metrics (point-in-box, exact match, token F1)
- Reward scoring for RL (-1/0/1)
- CLI tools for offline evaluation

✅ **HuggingFace Integration**
- Load/save datasets directly from HF Hub
- Pandas integration for data processing
- Parquet format for efficient I/O

### Quick Start

```bash
# Install core dependencies
pip install -r requirements.txt

# Optional: HuggingFace integration
pip install -r requirements-hf.txt

# Run evaluation tools
python tools/eval_stage1.py --input data.jsonl --out results.jsonl
python tools/eval_stage2.py --input actions.jsonl --out metrics.jsonl

# Run tests
pytest tests/test_model_actions.py tests/test_coords.py tests/test_metrics.py
```

### Documentation

📖 See [**AGENTCPM_STYLE_PIPELINE.md**](docs/AGENTCPM_STYLE_PIPELINE.md) for complete documentation including:
- Dataset preparation with Pandas + HuggingFace
- Model integration with Transformers
- Evaluation metrics implementation
- Complete training pipeline examples
- Integration with existing agent code

### Code Structure

```
packages/core/
├── model_actions.py      # Compact VLM actions (AgentAction)
├── coords.py             # Coordinate normalization
├── grounding_tasks.py    # Stage I task schemas
├── metrics.py            # Evaluation metrics
├── reward.py             # RL reward scoring
└── executor_bridge.py    # Model → Executor conversion
```

---

## 1) Quick Start (Windows)

### A) Create venv + install deps
```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m playwright install
```

### B) (Optional) Enable Windows UI Automation (Notepad demo)
```bash
pip install -r requirements-windows.txt
```

---

## 2) Quick Start (macOS/Linux)

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m playwright install
```

---

## 3) Safety Model (IMPORTANT)

By default, the agent can only touch files inside the repo's `./sandbox/` directory.

Add more allowed roots via CLI:
```bash
python apps/runner_cli.py open-latest --allow-root "C:\Users\You\Downloads" --root "C:\Users\You\Downloads" --pattern "**/*.pdf"
```

Add allowed domains via CLI:
```bash
python apps/runner_cli.py web-google --allow-domain "wikipedia.org" --query "capital of Paraguay"
```

All actions are written to:
- `./audit/actions.jsonl`

---

## 4) Commands

### Web: Google a query and attempt to extract an answer
```bash
python apps/runner_cli.py web-google --query "capital of Paraguay" --headless 1
```

### Local files: open the latest matching file
```bash
python apps/runner_cli.py open-latest --root ./sandbox --pattern "**/*"
```

### Local files: open a specific path (file or folder) with default OS app
```bash
python apps/runner_cli.py open-path --path ./sandbox
```

### Windows Desktop UIA: Notepad demo (optional)
```bash
python apps/runner_cli.py notepad-demo
```

---

## 5) Project Layout

```
agent-gui/
  apps/
    runner_cli.py
  packages/
    core/                 # contracts, policy, audit logger, utils
    drivers/              # web_playwright, fs_local, desktop_windows_uia
  sandbox/                # safe default file root
  audit/                  # JSONL action logs
  tests/
```

---

## 6) What you get (right now)

- A **unified action schema**
- A strict **policy gate** for domains + file roots
- A runnable **web driver** (Playwright)
- A runnable **local file driver** (latest match + open)
- An optional **Windows UIA driver** (Notepad typing demo)
- An **audit logger** that records everything

Next steps (if you want a real "autonomous agent"):
- add a planner (instruction → action DSL)
- add verifiers + scoring
- collect trajectories for supervised training
- then RLFT if desired

---

## 7) Evaluation (AgentCPM-style TM/EM)

This repo includes a step-level evaluator for the compact JSON action space:

```bash
python apps/eval_cli.py --pairs datasets/sample/pairs.jsonl
```

Action schema + compact codec live in:
- `packages/core/action_schema.py`
- `packages/core/action_codec.py`
- `packages/core/eval_metrics.py`

---

## Notes + Bring Web Info Back Local 📝➡️💾

This repo now includes a **local notes store** under `./sandbox/notes/`.

Create a note:
```bash
python apps/runner_cli.py note-new --title "My note" --body "Hello!"
```

Append to a note:
```bash
python apps/runner_cli.py note-append --note-id <NOTE_ID> --body "More text..."
```

List notes:
```bash
python apps/runner_cli.py note-list
```

Read a note:
```bash
python apps/runner_cli.py note-read --note-id <NOTE_ID>
```

### Web → Note (DuckDuckGo)
For reliability, `web-to-note` uses DuckDuckGo. You must allow it:
```bash
python apps/runner_cli.py web-to-note --allow-domain duckduckgo.com --query "capital of Paraguay"
```

### File → Note (text preview)
Save a UTF-8 text file preview into a note (safe; no binary parsing):
```bash
python apps/runner_cli.py file-to-note --allow-root "C:\\Users\\You\\Documents" --path "C:\\Users\\You\\Documents\\todo.txt"
```

Internals:
- Notes driver: `packages/drivers/notes_store/driver.py`
- Web search: `packages/drivers/web_playwright/search.py`

---

## File & Folder Ops 📁🧹 (search / read / move / organize)

All filesystem actions are **sandboxed** by `--allow-root`. You must explicitly allow a root folder.

List a folder:
```bash
python apps/runner_cli.py fs-list --allow-root "C:\Users\You\Documents" --path "C:\Users\You\Documents" --recursive 0
```

Find by name (glob):
```bash
python apps/runner_cli.py fs-find --allow-root "C:\Users\You\Documents" --root "C:\Users\You\Documents" --pattern "*.md"
```

Find by content (safe grep across text files):
```bash
python apps/runner_cli.py fs-grep --allow-root "C:\Users\You\Documents" --root "C:\Users\You\Documents" --needle "invoice"
```

Read a text file (bounded):
```bash
python apps/runner_cli.py fs-read --allow-root "C:\Users\You\Documents" --path "C:\Users\You\Documents\todo.txt"
```

Move / Copy:
```bash
python apps/runner_cli.py fs-move --allow-root "C:\Users\You\Documents" --src "C:\Users\You\Documents\a.txt" --dst "C:\Users\You\Documents\Archive\a.txt"
python apps/runner_cli.py fs-copy --allow-root "C:\Users\You\Documents" --src "C:\Users\You\Documents\a.txt" --dst "C:\Users\You\Documents\Backup\a.txt"
```

Organize by extension (dry-run first):
```bash
python apps/runner_cli.py fs-organize-ext --allow-root "C:\Users\You\Downloads" --path "C:\Users\You\Downloads" --dry-run 1
# then execute:
python apps/runner_cli.py fs-organize-ext --allow-root "C:\Users\You\Downloads" --path "C:\Users\You\Downloads" --dry-run 0
```

Tip: Combine with Notes:
- Use `web-to-note` to save web research locally
- Use `file-to-note` to snapshot file previews into notes


## 📁 Documents: Rules Organizer + Undo

This suite now includes **two power tools** for your Documents / Downloads / Projects folders:

### 1) Rules Organizer (JSON ruleset)

Run a ruleset against a folder to move/copy files into a clean structure.

**Example (dry-run first):**
```bash
python apps/runner_cli.py fs-organize-rules ^
  --allow-root "C:\Users\YOU\Documents" ^
  --allow-destructive ^
  --dir "C:\Users\YOU\Documents" ^
  --rules "sandbox\examples\rules.documents.example.json" ^
  --recursive ^
  --dry-run
```

Remove `--dry-run` to apply.

**Rules file format:** `sandbox/examples/rules.documents.example.json`

Each rule has:
- `when`: matching (glob / regex / ext_in / contains_text / size limits / excludes)
- `then`: `move_to` or `copy_to` + optional `rename` template
- `priority`: smaller runs first (first match wins)

Rename template tokens:
`{stem} {ext} {name} {yyyy} {mm} {dd} {date}`

### 2) Undo Tool (journal-backed)

Every journaled file action writes a record to:

`sandbox/sandbox/audit/undo.jsonl`

Undo the last action(s):

```bash
# Preview what would happen:
python apps/runner_cli.py fs-undo --steps 3 --dry-run

# Actually undo:
python apps/runner_cli.py fs-undo --steps 3 --allow-destructive
```

Journaled commands:
- `fs-move`, `fs-copy`, `fs-rename`, `fs-mkdir`
- `fs-organize-ext` (batch)
- `fs-organize-rules` (each op is logged; plus batch entries where relevant)

⚠️ Safety:
- Undo will **never overwrite** existing files. If the original path exists, it will **skip** and report a conflict.
- Operations are limited to your `--allow-root` paths.
