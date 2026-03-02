from __future__ import annotations

import argparse
from typing import Any, Dict, List

from tools._common import ensure_agent_suite_on_path, iter_jsonl, write_jsonl

ensure_agent_suite_on_path()

from packages.core import compute_reward  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--input",
        required=True,
        help="Stage III samples JSONL (must include pred_action)",
    )
    ap.add_argument("--out", required=True, help="Output rewards JSONL")
    args = ap.parse_args()

    samples = list(iter_jsonl(args.input))
    out: List[Dict[str, Any]] = []

    total = 0
    counts = {-1: 0, 0: 0, 1: 0}

    for i, s in enumerate(samples):
        r = compute_reward(s)
        r["index"] = i
        out.append(r)
        total += 1
        counts[int(r["reward"])] += 1

    out.append(
        {
            "summary": {
                "total": total,
                "counts": counts,
                "rates": {
                    str(k): (counts[k] / total) if total else 0.0 for k in counts
                },
            }
        }
    )

    write_jsonl(args.out, out)


if __name__ == "__main__":
    main()
