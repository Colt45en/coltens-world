from __future__ import annotations

import argparse
import os

from ingest import run_ingest
from transform import run_transform
from gates import run_gates
from persist import (
    MergePolicy,
    open_db,
    upsert_batch,
    upsert_lexicon_entries,
    upsert_rune_rows,
)
from report import make_decision_record, make_weekly_ops_report
from utils import ensure_dir, read_text_file, write_json


def main() -> int:
    ap = argparse.ArgumentParser(description="Autonomy Loop Pipeline MVP")
    ap.add_argument("--input", required=True, help="Path to code/text file to ingest")
    ap.add_argument(
        "--language", required=True, help="Language label (TypeScript/Python/...)"
    )
    ap.add_argument(
        "--objective", required=True, help="Objective function for this batch"
    )
    ap.add_argument(
        "--narrative", default="slice_of_life", help="Weekly report narrative mode"
    )
    ap.add_argument("--output-dir", required=True, help="Directory to write artifacts")
    ap.add_argument(
        "--min-confidence", type=float, default=0.80, help="Confidence gate threshold"
    )
    ap.add_argument(
        "--merge-policy",
        default="2.0",
        choices=["1.0", "2.0", "3.0"],
        help="Policy version (MVP supports 2.0 behavior)",
    )
    args = ap.parse_args()

    src_path = os.path.abspath(args.input)
    out_dir = os.path.abspath(args.output_dir)
    ensure_dir(out_dir)

    text = read_text_file(src_path)

    # 1) Detective
    packet = run_ingest(
        source_file=src_path,
        language=args.language,
        objective=args.objective,
        text=text,
    )
    write_json(os.path.join(out_dir, "evidence_packet.json"), packet)

    # 2) Alchemist
    transformed = run_transform(packet=packet, source_text=text)
    # write as arrays for compatibility with your spec
    write_json(
        os.path.join(out_dir, "lexicon_entries.json"), transformed["lexicon_entries"]
    )
    write_json(os.path.join(out_dir, "rune_rows.json"), transformed["rune_rows"])

    # 3) Analyst
    plan = run_gates(
        packet=packet,
        transform_out=transformed,
        min_confidence=float(args.min_confidence),
    )
    write_json(os.path.join(out_dir, "validated_plan.json"), plan)

    # 4) Specialist (SQLite) - governance: only persist baseline if not FAILED
    db_path = os.path.join(out_dir, "world.db")
    conn = open_db(db_path)

    # Always store batch record (audit), but only store entries if not failed
    upsert_batch(conn, packet)

    # 5) PM Decision
    decision = make_decision_record(plan)
    write_json(os.path.join(out_dir, "decision_record.json"), decision)

    if decision["approved_for_release"]:
        # Merge policy v2.0 default behavior
        policy = MergePolicy(version=str(args.merge_policy), threshold=0.8)
        merge_result = upsert_lexicon_entries(
            conn, transformed["lexicon_entries"], policy
        )
        upsert_rune_rows(conn, transformed["rune_rows"])
        conn.commit()

        # Include merge result as an extra artifact (useful)
        write_json(os.path.join(out_dir, "merge_result.json"), merge_result)
    else:
        conn.commit()

    # 6) WeeklyOpsReport (MVP: generated from current DB state)
    weekly = make_weekly_ops_report(
        conn=conn, week_starting="2026-02-10", narrative_mode=args.narrative
    )
    write_json(os.path.join(out_dir, "weekly_ops_report.json"), weekly)

    # Simple pipeline log
    log_path = os.path.join(out_dir, "pipeline.log")
    with open(log_path, "w", encoding="utf-8") as f:
        f.write("AUTONOMY LOOP PIPELINE MVP\n")
        f.write(f"input={src_path}\n")
        f.write(f"batch_id={packet['batch_id']}\n")
        f.write(f"decision={decision['decisions'][0]['choice']}\n")
        f.write(f"overall_status={plan['overall_status']}\n")
        f.write(f"db={db_path}\n")

    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
