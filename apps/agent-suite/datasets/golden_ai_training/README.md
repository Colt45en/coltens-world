# Golden AI Training Dataset Pack

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
