from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

try:
    from tools._common import CANONICAL_JSON_KWARGS, write_jsonl
except ModuleNotFoundError:
    from _common import CANONICAL_JSON_KWARGS, write_jsonl

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "datasets" / "golden_ai_training"

SPEC: dict[str, Any] = {
    "program_title": "Golden Standard AI Training Method (Crystal Knowledge Edition)",
    "track": "llms_agents",
    "core_principles": [
        "Reproducibility over vibes (seeds, logs, configs, deterministic splits)",
        "Baseline first, then complexity",
        "Data is a first-class artifact (versioned, audited, gated)",
        "Evaluation is a product (stress tests + failure catalogs)",
        "Ablations are mandatory (prove causality of improvements)",
        "Ship with monitors + rollback (models drift)",
        "Safety and privacy are design constraints, not afterthoughts",
    ],
    "golden_loop": [
        "Define: task + metric + baseline",
        "Data: collect -> clean -> label -> split -> version",
        "Model: simplest that can win first (baseline -> improved)",
        "Train: reproducible seeds + logging + checkpoints",
        "Eval: holdout, stress tests, failure modes, calibration",
        "Improve: ablations + error analysis + targeted data/model changes",
        "Ship: deployment + monitoring + rollback + drift detection",
        "Govern: safety, privacy, security, compliance",
    ],
    "knowledge_map": {
        "math_spine": [
            "linear_algebra",
            "calculus_gradients",
            "probability_bayes",
            "optimization_sgd_adam",
            "information_theory_kl_entropy",
        ],
        "ml_core": [
            "bias_variance",
            "regularization",
            "train_val_test_leakage",
            "metrics_and_calibration",
        ],
        "deep_learning": [
            "backprop",
            "normalization",
            "cnn_rnn_attention",
            "stability_init_clipping_amp",
        ],
        "llms": [
            "tokenization_bpe",
            "transformers_attention",
            "pretrain_vs_finetune",
            "sft_dpo_rlhf_concepts",
        ],
        "data_engineering": [
            "labeling_strategy",
            "dedupe_filtering",
            "dataset_versioning",
            "sampling",
        ],
        "evaluation_reliability": [
            "stress_tests",
            "ood_thinking",
            "human_eval_rubrics",
            "error_analysis",
        ],
        "mlops_production": [
            "experiment_tracking",
            "model_registry",
            "deployment_canary",
            "monitoring_drift_cost_latency",
        ],
        "safety_security": [
            "privacy_pii",
            "prompt_injection_if_agents",
            "bias_audits",
            "governance",
        ],
    },
    "gating_checklist": {
        "gate_1_baseline": [
            "Metric chosen + baseline achieved",
            "Train/val/test split locked and versioned",
            "Single-run reproducible with same seed",
        ],
        "gate_2_training_quality": [
            "Loss curves logged",
            "Overfit test passed (model can fit tiny subset)",
            "Ablation: remove one component and show expected drop",
        ],
        "gate_3_evaluation": [
            "Confusion/failure buckets created",
            "Stress tests defined and run",
            "Calibration checked (if probabilistic outputs matter)",
        ],
        "gate_4_shipping": [
            "Latency + cost budget measured",
            "Monitoring signals defined",
            "Rollback plan exists",
        ],
        "gate_5_safety": [
            "PII handling policy documented",
            "Bias checks appropriate to domain",
            "Abuse cases enumerated + mitigations tracked",
        ],
    },
    "capstone_projects": [
        {
            "name": "From-Scratch ML (No Frameworks)",
            "goal": "Implement logistic regression + MLP with backprop, train on a small dataset, and prove correctness with gradient checks.",
            "deliverables": [
                "gradient_check_report",
                "training_curves",
                "ablation_notes",
                "reproducible_run_script",
            ],
        },
        {
            "name": "Mini-Transformer Language Model",
            "goal": "Train a small decoder-only transformer on a tiny corpus; evaluate perplexity; run failure analysis on generations.",
            "deliverables": [
                "tokenizer_spec",
                "model_config",
                "perplexity_eval",
                "generation_failure_catalog",
            ],
        },
        {
            "name": "Preference Tuning Toy (DPO-style)",
            "goal": "Create synthetic preference pairs; train a small model to prefer better outputs; evaluate win-rate vs baseline.",
            "deliverables": [
                "pair_generation_script",
                "training_logs",
                "win_rate_eval",
                "safety_constraints_notes",
            ],
        },
    ],
    "mastery_quiz": {
        "quiz_title": "Golden Standard AI Mastery Quiz (Crystal Core)",
        "questions": [
            {
                "question_number": 1,
                "question_text": "What is the single most important reason to lock train/val/test splits early?",
                "options": {
                    "a": "To make training faster",
                    "b": "To prevent data leakage and maintain comparable evaluations",
                    "c": "To reduce model size",
                    "d": "To improve GPU utilization",
                },
                "correct_answer": "b",
            },
            {
                "question_number": 2,
                "question_text": "Which metric best captures probabilistic prediction quality when outputs are probabilities?",
                "options": {
                    "a": "Accuracy only",
                    "b": "F1 score only",
                    "c": "Log loss / cross-entropy",
                    "d": "Number of parameters",
                },
                "correct_answer": "c",
            },
            {
                "question_number": 3,
                "question_text": "What does an 'overfit test' (tiny subset fit) primarily verify?",
                "options": {
                    "a": "The model is unbiased",
                    "b": "The pipeline + optimization are implemented correctly",
                    "c": "The dataset is perfectly clean",
                    "d": "The model will generalize",
                },
                "correct_answer": "b",
            },
            {
                "question_number": 4,
                "question_text": "Why are ablations mandatory for serious model improvement work?",
                "options": {
                    "a": "They reduce compute cost",
                    "b": "They prove which change caused the gain (causality evidence)",
                    "c": "They make charts prettier",
                    "d": "They eliminate the need for test sets",
                },
                "correct_answer": "b",
            },
            {
                "question_number": 5,
                "question_text": "In a transformer block, what is the purpose of residual connections?",
                "options": {
                    "a": "To increase token count",
                    "b": "To stabilize optimization and preserve information flow",
                    "c": "To remove attention",
                    "d": "To reduce dataset size",
                },
                "correct_answer": "b",
            },
            {
                "question_number": 6,
                "question_text": "What is the correct interpretation of KL divergence in training objectives?",
                "options": {
                    "a": "A distance metric that is always symmetric",
                    "b": "A measure of how one distribution differs from another (asymmetric)",
                    "c": "A measure of GPU speed",
                    "d": "A measure of model size",
                },
                "correct_answer": "b",
            },
            {
                "question_number": 7,
                "question_text": "What is the most common failure mode if you tune hyperparameters on the test set?",
                "options": {
                    "a": "Better generalization",
                    "b": "Test set becomes a training signal (leakage), inflating reported performance",
                    "c": "Lower variance",
                    "d": "Faster inference",
                },
                "correct_answer": "b",
            },
            {
                "question_number": 8,
                "question_text": "Which practice most directly improves training reproducibility?",
                "options": {
                    "a": "Changing model architecture every run",
                    "b": "Pinning seeds, recording configs, and versioning data/code",
                    "c": "Using more GPUs",
                    "d": "Using larger batch sizes only",
                },
                "correct_answer": "b",
            },
            {
                "question_number": 9,
                "question_text": "What does 'calibration' refer to in classification models producing probabilities?",
                "options": {
                    "a": "Whether the model uses GPUs",
                    "b": "Whether predicted probabilities match true outcome frequencies",
                    "c": "Whether the dataset is balanced",
                    "d": "Whether the model is small",
                },
                "correct_answer": "b",
            },
            {
                "question_number": 10,
                "question_text": "What is the best definition of 'data leakage'?",
                "options": {
                    "a": "A corrupted CSV file",
                    "b": "Information from validation/test influences training or model selection improperly",
                    "c": "Slow training speed",
                    "d": "Low GPU memory",
                },
                "correct_answer": "b",
            },
            {
                "question_number": 11,
                "question_text": "Why is 'baseline first' a golden rule?",
                "options": {
                    "a": "Baselines always win",
                    "b": "It gives a reference point and prevents wasting complexity on unsolved basics",
                    "c": "It eliminates evaluation",
                    "d": "It makes models smaller",
                },
                "correct_answer": "b",
            },
            {
                "question_number": 12,
                "question_text": "What is the core reason mixed precision (AMP) is used?",
                "options": {
                    "a": "To change the dataset",
                    "b": "To speed up training and reduce memory while keeping stability (with scaling)",
                    "c": "To remove gradients",
                    "d": "To make outputs discrete",
                },
                "correct_answer": "b",
            },
        ],
    },
}


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")


def _pretty_label(key: str) -> str:
    return key.replace("_", " ")


def _dump_json(path: Path, obj: Any) -> None:
    kwargs = {k: v for k, v in CANONICAL_JSON_KWARGS.items() if k != "separators"}
    with path.open("wt", encoding="utf-8", newline="\n") as f:
        json.dump(obj, f, indent=2, **kwargs)
        f.write("\n")


def _mcq_prompt(q: dict[str, Any]) -> str:
    o = q["options"]
    return "\n".join(
        [
            q["question_text"],
            f"a) {o['a']}",
            f"b) {o['b']}",
            f"c) {o['c']}",
            f"d) {o['d']}",
            "Answer with the correct option and a one-sentence rationale.",
        ]
    )


def _mcq_good(q: dict[str, Any]) -> str:
    ans = q["correct_answer"]
    return f"Correct answer: {ans}. {q['options'][ans]}. This option best matches the core concept being tested."


def _mcq_bad(q: dict[str, Any]) -> str:
    ans = q["correct_answer"]
    wrong = next(k for k in ("a", "b", "c", "d") if k != ans)
    return f"Correct answer: {wrong}. {q['options'][wrong]}. This does not address the central concept as directly."


def _make_mcq(
    question_number: int, question_text: str, correct_text: str, distractors: list[str]
) -> dict[str, Any]:
    letters = ("a", "b", "c", "d")
    correct_slot = letters[(question_number - 1) % 4]
    options_list = [None, None, None, None]
    options_list[letters.index(correct_slot)] = correct_text
    d_iter = iter(distractors[:3])
    for i in range(4):
        if options_list[i] is None:
            options_list[i] = next(d_iter)
    options = {letters[i]: str(options_list[i]) for i in range(4)}
    return {
        "question_number": question_number,
        "question_text": question_text,
        "options": options,
        "correct_answer": correct_slot,
    }


def build_quiz_bank(
    spec: dict[str, Any], target_count: int = 84
) -> list[dict[str, Any]]:
    questions = [dict(q) for q in spec["mastery_quiz"]["questions"]]
    next_num = max((int(q["question_number"]) for q in questions), default=0) + 1

    section_keys = list(spec["knowledge_map"].keys())
    section_labels = {k: _pretty_label(k) for k in section_keys}
    all_topic_to_section: dict[str, str] = {}
    for section, topics in spec["knowledge_map"].items():
        for topic in topics:
            all_topic_to_section[topic] = section

    golden_steps = spec["golden_loop"]
    step_names = [s.split(":", 1)[0].strip() for s in golden_steps]
    step_texts = [s for s in golden_steps]
    gate_keys = list(spec["gating_checklist"].keys())
    gate_labels = {g: _pretty_label(g) for g in gate_keys}
    principle_list = list(spec["core_principles"])
    capstones = list(spec["capstone_projects"])

    def add(question_text: str, correct: str, wrongs: list[str]) -> None:
        nonlocal next_num
        deduped: list[str] = []
        for w in wrongs:
            s = str(w)
            if s != correct and s not in deduped:
                deduped.append(s)
        fillers = [
            "None of the above",
            "Only after deployment",
            "It depends on GPU type",
            "This is not part of the method",
            "A larger model always fixes this",
        ]
        for f in fillers:
            if len(deduped) >= 3:
                break
            if f != correct and f not in deduped:
                deduped.append(f)
        questions.append(_make_mcq(next_num, question_text, correct, deduped[:3]))
        next_num += 1

    for i, step in enumerate(step_texts, start=1):
        add(
            f"Which Golden Loop stage is described by: '{step}'?",
            step_names[i - 1],
            [name for j, name in enumerate(step_names, start=1) if j != i][:3],
        )
        add(
            f"In the Golden Loop order, what comes immediately after '{step_names[i - 1]}'?"
            if i < len(step_names)
            else "What is the final stage in the Golden Loop?",
            step_names[i] if i < len(step_names) else step_names[-1],
            [
                n
                for n in step_names
                if n != (step_names[i] if i < len(step_names) else step_names[-1])
            ][:3],
        )

    for idx, p in enumerate(principle_list, start=1):
        add(
            f"Which core principle directly matches this statement: '{p}'?",
            p,
            [x for j, x in enumerate(principle_list, start=1) if j != idx][:3],
        )

    for gate, checks in spec["gating_checklist"].items():
        for chk in checks:
            add(
                f"Which gate includes this checkpoint: '{chk}'?",
                gate_labels[gate],
                [gate_labels[g] for g in gate_keys if g != gate][:3],
            )

    for topic, section in all_topic_to_section.items():
        topic_label = _pretty_label(topic)
        correct_label = section_labels[section]
        wrong_labels = [section_labels[s] for s in section_keys if s != section][:3]
        add(
            f"In the Crystal AI knowledge map, which section contains '{topic_label}'?",
            correct_label,
            wrong_labels,
        )

    project_names = [p["name"] for p in capstones]
    for project in capstones:
        for deliverable in project["deliverables"]:
            add(
                f"Which capstone project requires the deliverable '{deliverable}'?",
                project["name"],
                [n for n in project_names if n != project["name"]][:3],
            )
        add(
            f"Which capstone has this goal: '{project['goal']}'?",
            project["name"],
            [n for n in project_names if n != project["name"]][:3],
        )

    if len(questions) < target_count:
        for section, topics in spec["knowledge_map"].items():
            for topic in topics:
                add(
                    f"Why is '{_pretty_label(topic)}' included in the training foundation?",
                    "It affects model quality, evaluation integrity, or operational reliability",
                    [
                        "It only matters after full deployment",
                        "It is included only for naming consistency",
                        "It is unrelated to training and evaluation quality",
                    ],
                )
                if len(questions) >= target_count:
                    break
            if len(questions) >= target_count:
                break

    return questions[:target_count]


def build_sft(spec: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    quiz_bank = build_quiz_bank(spec)
    rows.append(
        {
            "id": "golden_loop_overview",
            "task": "framework_overview",
            "instruction": "Explain the Golden Loop for building AI systems and why it is non-negotiable.",
            "response": "The Golden Loop is Define -> Data -> Model -> Train -> Eval -> Improve -> Ship -> Govern. It is non-negotiable because reliable AI work requires reproducibility, trustworthy evaluation, deployment readiness, and safety constraints at every iteration.",
            "source": "golden_loop",
        }
    )
    rows.append(
        {
            "id": "golden_loop_order",
            "task": "ordering",
            "instruction": "List the Golden Loop stages in order.",
            "response": "1) Define 2) Data 3) Model 4) Train 5) Eval 6) Improve 7) Ship 8) Govern",
            "source": "golden_loop",
        }
    )
    for i, step in enumerate(spec["golden_loop"], start=1):
        rows.append(
            {
                "id": f"golden_loop_step_{i}",
                "task": "step_explanation",
                "instruction": f"Explain Golden Loop step {i}: {step}",
                "response": f"This step enforces discipline in the workflow: {step}. It should produce documented artifacts and clear pass/fail criteria.",
                "source": "golden_loop",
            }
        )
    for i, p in enumerate(spec["core_principles"], start=1):
        rows.append(
            {
                "id": f"principle_{i}",
                "task": "principle_explanation",
                "instruction": f"Why does this principle matter in production AI work: {p}",
                "response": f"It matters because {p.lower()} helps teams produce reproducible and auditable improvements instead of chasing noisy results.",
                "source": "core_principles",
            }
        )
    for section, topics in spec["knowledge_map"].items():
        rows.append(
            {
                "id": f"km_section_{section}",
                "task": "knowledge_section",
                "instruction": f"What topics belong in the '{_pretty_label(section)}' section of the Crystal AI knowledge map?",
                "response": ", ".join(_pretty_label(t) for t in topics),
                "source": "knowledge_map",
            }
        )
        for t in topics:
            rows.append(
                {
                    "id": f"km_topic_{section}_{t}",
                    "task": "topic_reason",
                    "instruction": f"Why is '{_pretty_label(t)}' important in a golden-standard AI training foundation?",
                    "response": f"{_pretty_label(t)} affects model quality, evaluation integrity, or operational reliability, so it must be part of the foundation.",
                    "source": "knowledge_map",
                }
            )
    for gate, checks in spec["gating_checklist"].items():
        rows.append(
            {
                "id": f"gate_{gate}_purpose",
                "task": "gate_purpose",
                "instruction": f"What is the purpose of {_pretty_label(gate)} in the Golden AI Training method?",
                "response": f"{_pretty_label(gate)} defines a required checkpoint before moving to the next stage of the pipeline.",
                "source": "gating_checklist",
            }
        )
        rows.append(
            {
                "id": f"gate_{gate}_checks",
                "task": "gate_checklist",
                "instruction": f"List the checks required to pass {_pretty_label(gate)}.",
                "response": "; ".join(checks),
                "source": "gating_checklist",
            }
        )
    for proj in spec["capstone_projects"]:
        pid = _slug(proj["name"])
        rows.append(
            {
                "id": f"capstone_{pid}_goal",
                "task": "capstone_goal",
                "instruction": f"What is the goal of the capstone project '{proj['name']}'?",
                "response": proj["goal"],
                "source": "capstone_projects",
            }
        )
        rows.append(
            {
                "id": f"capstone_{pid}_deliverables",
                "task": "capstone_deliverables",
                "instruction": f"List the deliverables for '{proj['name']}'.",
                "response": ", ".join(proj["deliverables"]),
                "source": "capstone_projects",
            }
        )
    for q in quiz_bank:
        rows.append(
            {
                "id": f"quiz_{q['question_number']:02d}",
                "task": "mcq_reasoning",
                "instruction": _mcq_prompt(q),
                "response": _mcq_good(q),
                "source": "mastery_quiz",
            }
        )
    return rows


def build_preference(spec: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for q in build_quiz_bank(spec):
        rows.append(
            {
                "id": f"pref_quiz_{q['question_number']:02d}",
                "prompt": _mcq_prompt(q),
                "chosen": _mcq_good(q),
                "rejected": _mcq_bad(q),
                "domain": "mastery_quiz",
                "label_source": "synthetic_from_spec",
            }
        )
    for i, p in enumerate(spec["core_principles"], start=1):
        rows.append(
            {
                "id": f"pref_principle_{i}",
                "prompt": f"Explain why this AI training principle matters: {p}",
                "chosen": f"It matters because {p.lower()} reduces false progress and makes improvements reproducible and reviewable.",
                "rejected": "It matters mostly for presentation quality and can be skipped if the metric goes up.",
                "domain": "core_principles",
                "label_source": "synthetic_from_spec",
            }
        )
    for gate, checks in spec["gating_checklist"].items():
        rows.append(
            {
                "id": f"pref_{gate}",
                "prompt": f"What should a reviewer verify before passing {_pretty_label(gate)}?",
                "chosen": "Verify evidence for all gate checks: "
                + "; ".join(checks)
                + ".",
                "rejected": "Pass the gate if the latest experiment looks promising, even if checks are incomplete.",
                "domain": "gating_checklist",
                "label_source": "synthetic_from_spec",
            }
        )
    return rows


def build_quiz_eval(spec: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for q in build_quiz_bank(spec):
        ans = q["correct_answer"]
        rows.append(
            {
                "id": f"quiz_eval_{q['question_number']:02d}",
                "task_type": "multiple_choice",
                "question_number": q["question_number"],
                "question": q["question_text"],
                "options": q["options"],
                "gold_answer": ans,
                "gold_text": q["options"][ans],
                "source": spec["mastery_quiz"]["quiz_title"],
            }
        )
    return rows


def build_manifest(
    sft: list[dict[str, Any]],
    pref: list[dict[str, Any]],
    quiz_eval: list[dict[str, Any]],
    quiz_bank: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "program_title": SPEC["program_title"],
        "track": SPEC["track"],
        "artifacts": {
            "golden_ai_training.spec.json": {"type": "source_spec"},
            "mastery_quiz_bank.json": {"type": "quiz_bank", "rows": len(quiz_bank)},
            "sft_train.jsonl": {"type": "sft", "rows": len(sft)},
            "preference_pairs.jsonl": {"type": "preference", "rows": len(pref)},
            "quiz_eval.jsonl": {"type": "eval", "rows": len(quiz_eval)},
        },
        "generation": {
            "script": "tools/build_golden_ai_training_dataset.py",
            "deterministic": True,
        },
    }


def build_readme() -> str:
    return """# Golden AI Training Dataset Pack

Generated from a single source spec for `llms_agents`.

Files:
- `golden_ai_training.spec.json` (source curriculum/quiz spec)
- `mastery_quiz_bank.json` (expanded 60-120 style MCQ bank generated from the spec)
- `sft_train.jsonl` (synthetic instruction/response training data)
- `preference_pairs.jsonl` (synthetic chosen/rejected preference pairs)
- `quiz_eval.jsonl` (held-out multiple choice evaluation rows)
- `manifest.json` (artifact metadata)

Regenerate:

```powershell
python tools/build_golden_ai_training_dataset.py
```
"""


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    quiz_bank = build_quiz_bank(SPEC)
    sft = build_sft(SPEC)
    pref = build_preference(SPEC)
    quiz_eval = build_quiz_eval(SPEC)
    _dump_json(OUT_DIR / "golden_ai_training.spec.json", SPEC)
    _dump_json(
        OUT_DIR / "mastery_quiz_bank.json",
        {
            "quiz_title": "Golden Standard AI Mastery Quiz Bank (Expanded)",
            "questions": quiz_bank,
        },
    )
    write_jsonl(str(OUT_DIR / "sft_train.jsonl"), sft)
    write_jsonl(str(OUT_DIR / "preference_pairs.jsonl"), pref)
    write_jsonl(str(OUT_DIR / "quiz_eval.jsonl"), quiz_eval)
    _dump_json(
        OUT_DIR / "manifest.json", build_manifest(sft, pref, quiz_eval, quiz_bank)
    )
    (OUT_DIR / "README.md").write_text(build_readme(), encoding="utf-8", newline="\n")
    print(f"Wrote {OUT_DIR}")
    print(
        f"quiz_bank={len(quiz_bank)} sft={len(sft)} pref={len(pref)} quiz_eval={len(quiz_eval)}"
    )


if __name__ == "__main__":
    main()
