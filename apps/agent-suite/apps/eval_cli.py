from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, Iterator

from packages.core.eval_metrics import step_metrics
from packages.core.normalize import ScreenSize, BBox


def _iter_jsonl(path: Path) -> Iterator[Dict[str, Any]]:
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            yield json.loads(line)


def main() -> None:
    ap = argparse.ArgumentParser(
        description="Evaluate step-level action predictions (TM/EM + optional point-in-box)."
    )
    ap.add_argument(
        "--pairs",
        required=True,
        help="JSONL file where each line has {pred, gold, optional: screen, bbox}.",
    )
    args = ap.parse_args()

    pairs_path = Path(args.pairs)
    tm_n = 0
    em_n = 0
    total = 0
    pib_total = 0
    pib_true = 0

    for rec in _iter_jsonl(pairs_path):
        pred = rec.get("pred", {})
        gold = rec.get("gold", {})

        screen = None
        bbox = None
        if "screen" in rec and isinstance(rec["screen"], dict):
            screen = ScreenSize(
                width=int(rec["screen"]["width"]), height=int(rec["screen"]["height"])
            )
        if "bbox" in rec and isinstance(rec["bbox"], dict):
            bbox = BBox(
                xmin=int(rec["bbox"]["xmin"]),
                ymin=int(rec["bbox"]["ymin"]),
                xmax=int(rec["bbox"]["xmax"]),
                ymax=int(rec["bbox"]["ymax"]),
            )

        m = step_metrics(pred, gold, screen=screen, gold_bbox_px=bbox)
        total += 1
        tm_n += 1 if m.type_match else 0
        em_n += 1 if m.exact_match else 0

        if m.point_in_box is not None:
            pib_total += 1
            pib_true += 1 if m.point_in_box else 0

    tm = (tm_n / total) if total else 0.0
    em = (em_n / total) if total else 0.0
    print(f"Total steps: {total}")
    print(f"Type-Match (TM):  {tm:.4f}")
    print(f"Exact-Match (EM): {em:.4f}")
    if pib_total:
        print(f"Point-in-Box:     {(pib_true / pib_total):.4f} (n={pib_total})")


if __name__ == "__main__":
    main()
