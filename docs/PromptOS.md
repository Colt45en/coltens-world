# PromptOS v1 — Universal Prompt Blueprint 🧩

## Core Structure (Use This For All Prompts)

### 1) Role
Who the model is pretending to be.

### 2) Mission
One sentence: what "done" means.

### 3) Deliverable Format
Report / outline / table / code / checklist / rubric / dataset spec, etc.

### 4) Audience + Use Case
Who will read it and how they'll use it.

### 5) Scope Boundaries
What's included/excluded. Timeframe. Regions. Assumptions.

### 6) Required Angles
The "lenses" you *must* cover (e.g., economic + political + cultural).

### 7) Evidence Standard
What counts as "supported" vs "speculative". (Citations? Primary vs secondary?).

### 8) Method (Process)
Steps the model must follow: gather → compare → synthesize → critique → conclude.

### 9) Output Quality Constraints
Style constraints: concise/technical, no fluff, include counterarguments, etc.

### 10) Checks (Self-verification)
Force correctness: contradictions, missing pieces, "what would change my mind".

### 11) Actionables / Next Steps
What you should do after reading it.

### 12) Questions (only if essential)
If unknowns block correctness, ask them — otherwise proceed with best assumptions.

## Depth Control System 🎛️

### Depth: Standard
* 5–10 key points
* 1 perspective
* minimal critique

### Depth: Deep
* 3–5 perspectives
* tradeoffs + counterarguments
* "why this happened / how it works"
* clear framework + conclusions

## Prompt Templates You Can Reuse Forever 🧱

### A) Deep Research (General)

```text
Act as a [ROLE]. Your mission: [MISSION].

Depth: [standard/deep/exhaustive].
Scope: [timeframe/region/domain]. Exclude: [exclusions].
Required lenses: [lens1, lens2, lens3...].
Evidence standard: [primary/secondary/citations/uncertainty].

Method:
1) Define the core terms and competing definitions.
2) Map the system: key entities, forces, incentives, constraints.
3) Provide a causal explanation (not just description).
4) Present strongest arguments + strongest criticisms.
5) Compare at least 2 competing frameworks/interpretations.
6) Conclude with: what's most likely true, what's uncertain, what would change your conclusion.

Deliverable format:
- Executive summary (5 bullets)
- Core analysis (structured sections)
- Counterarguments + limitations
- Practical implications / next steps
- Glossary of key terms
```

#### Example (Filled, no placeholders)

```text
Act as a historian-economist. Your mission: explain the social and economic forces that contributed to the French Revolution, and how Enlightenment ideas and popular unrest interacted with material conditions.

Depth: exhaustive.
Scope: France, 1750–1799. Exclude: Napoleonic era after 1799.
Required lenses: class structure, taxation, food supply shocks, political legitimacy, Enlightenment ideology, institutional failure.
Evidence standard: distinguish primary accounts vs later historians; label uncertainty.

Method:
1) Define "revolution" in political vs socioeconomic terms.
2) Map the system: monarchy, estates, clergy, nobility, bourgeoisie, peasants, urban workers; taxes; debt; grain markets.
3) Build the causal chain (trigger vs root cause).
4) Present competing interpretations (Marxist class analysis vs political legitimacy vs contingency/leadership).
5) Conclude with ranked causes + what likely mattered most.

Deliverable format:
- Executive summary (5 bullets)
- Timeline of key turning points
- Causal graph (text form)
- Counterarguments + what historians disagree about
- Implications for modern political instability
```

### B) Historical Research (Timeline + Causal Chain)

```text
Act as a historical analyst.
Goal: trace the evolution of [topic] from origin → present.

Output:
1) Timeline (major inflection points)
2) Forces (social/political/economic/tech)
3) Actors + incentives
4) What changed / why it changed
5) Competing narratives (at least 2)
6) Modern implications
```

### C) Scientific Research (Mechanism-first)

```text
Act as a research scientist.
Goal: explain [topic] using mechanism + evidence.

Output:
1) Definitions and measurable variables
2) Mechanism model (step-by-step)
3) What experiments show (and don't show)
4) Limitations + confounds
5) Practical applications + failure cases
```

### D) Philosophical Research (Arguments + Ethics)

```text
Act as a philosopher-ethicist.
Goal: analyze [topic] by mapping the argument landscape.

Output:
1) Core questions + definitions
2) Main positions (at least 3)
3) Strongest argument for each
4) Strongest critique of each
5) Ethical risks + responsibility framework
## Culture + History in Literature (Weaponized) 📚🧬

### The Context Matrix (use this every time)

For a given time/place, fill these:

1. **Social norms**: what's "normal", what's taboo, what gets punished
2. **Power structure**: who can command, who must obey, who is invisible
3. **Economy**: what people trade, fear, hoard, depend on
4. **Tech level**: what tools exist, what's rare, what changes daily life
5. **Religion & worldview**: what's sacred, what's heresy, what's destiny
6. **Language & speech**: slang, politeness rules, metaphors people live by
7. **Political climate**: stability vs unrest, propaganda, policing
8. **Cross-cultural contact**: trade, colonization, migration, hybrid identities

### The key move:
**Every category must produce:**
* a conflict
* a constraint
* a character choice

That's how "context" becomes *story*.

### Prompt Pack: Culture-History Scene Builder 🎭

#### 1) Scene authenticity (no info-dumps)

```text
Act as a historical fiction editor.
Setting: Victorian London, 1870s. Topic: early public reactions to new scientific claims.

Write a scene where a scientist and a clergy member argue in a public space.
Rules:
- Show social class through behavior, not exposition
- Embed period technology naturally
- Include 3 cultural assumptions characters take for granted
- End with a consequence (social or political)
Output: 900–1200 words, vivid but historically plausible.
```

#### 2) "Science vs society" tension generator

```text
Act as a science-and-society historian and story architect.
Choose a historical period where scientific progress clashed with cultural norms.
Generate:
- 3 character archetypes (innovator, gatekeeper, survivor)
- the taboo the science threatens
- the institution that resists it
- 5 plot beats driven by social pressure (not "villains")
```

#### 3) Cross-cultural science exchange (richest storytelling fuel)

```text
Act as a cross-cultural historian.
Setting: a trade route era with two competing astronomical traditions.
Design a plot where two methods collide and produce a third hybrid insight.
Deliver:
- cultural practices that shape observation
- how language limits what they can describe
- a misunderstanding that becomes a breakthrough
```

## Prompts for Your Files/Folders/Notes "Local Assistant" 📁🤖

### The "Local Organizer Mission" Template

```text
Act as a file organization assistant.
Goal: clean and organize my folder without deleting anything.

Constraints:
- Only operate inside: C:\Users\Me\Documents\Work
- Never delete files
- Move only after a dry-run plan
- Produce a summary note with what changed

Tasks:
1) Inventory: list top-level folders + counts
2) Identify clutter patterns (by extension and naming)
3) Propose a target structure (folders)
4) Dry-run planned moves
5) Apply moves
6) Write a local note: what moved where + why
Output: step-by-step plan + commands to execute.
```

### Mapping to your agent-suite CLI (what to actually run)

#### Inventory:
```bash
python apps/runner_cli.py fs-list --allow-root "C:\Users\You\Documents" --path "C:\Users\You\Documents" --recursive 0
```

#### Find "loose PDFs":
```bash
python apps/runner_cli.py fs-find --allow-root "C:\Users\You\Documents" --root "C:\Users\You\Documents" --pattern "*.pdf" --recursive 1
```

#### Dry-run organize Downloads by extension:
```bash
python apps/runner_cli.py fs-organize-ext --allow-root "C:\Users\You\Downloads" --path "C:\Users\You\Downloads" --dry-run 1
```

#### Execute:
```bash
python apps/runner_cli.py fs-organize-ext --allow-root "C:\Users\You\Downloads" --path "C:\Users\You\Downloads" --dry-run 0
```

#### Save results to a local note:
```bash
python apps/runner_cli.py note-new --title "Folder cleanup report" --body "Moved items by extension. See audit log for details."
```

## "Research → Bring Back → Organize" Power Workflow 🔥

This is the exact pipeline you described ("web and bring info back to local"):

### Example: Research a topic, save locally, then organize sources

1. **Web search → note:**
```bash
python apps/runner_cli.py web-to-note --allow-domain duckduckgo.com --query "best practices document organization naming convention"
```

2. **Snapshot an existing local doc into notes (so you have a safe copy of the content):**
```bash
python apps/runner_cli.py file-to-note --allow-root "C:\Users\You\Documents" --path "C:\Users\You\Documents\Work\project-notes.txt"
```

3. **Find duplicates by content keyword:**
```bash
python apps/runner_cli.py fs-grep --allow-root "C:\Users\You\Documents" --root "C:\Users\You\Documents\Work" --needle "project charter"
```

4. **Move into a clean structure:**
```bash
python apps/runner_cli.py fs-mkdir --allow-root "C:\Users\You\Documents" --path "C:\Users\You\Documents\Work\_Archive\2026"
python apps/runner_cli.py fs-move  --allow-root "C:\Users\You\Documents" --src "C:\Users\You\Documents\Work\oldfile.docx" --dst "C:\Users\You\Documents\Work\_Archive\2026\oldfile.docx"
```</content>
<parameter name="filePath">c:\Users\colte\colten projects\coltens world\PromptOS.md
