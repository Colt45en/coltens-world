from __future__ import annotations

import argparse
import pandas as pd

from tools._common import read_jsonl

def main():
    ap = argparse.ArgumentParser(description="Convert Stage I JSONL grounding tasks to Parquet (fast I/O).")
    ap.add_argument("--input", required=True, help="Stage I JSONL")
    ap.add_argument("--out", required=True, help="Output Parquet path")
    args = ap.parse_args()

    rows = read_jsonl(args.input)
    df = pd.DataFrame(rows)
    df.to_parquet(args.out, index=False)
    print({"rows": len(df), "out": args.out})

if __name__ == "__main__":
    main()
