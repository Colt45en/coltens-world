from __future__ import annotations

import argparse
from typing import List
import io
import pandas as pd
from PIL import Image
from tqdm import tqdm


def main():
    ap = argparse.ArgumentParser(
        description="Embed images as PNG bytes into a Parquet file (optional)."
    )
    ap.add_argument(
        "--input", required=True, help="Input JSONL or Parquet with column image_path"
    )
    ap.add_argument("--out", required=True, help="Output Parquet path")
    ap.add_argument("--size", default="1000x1000", help="Resize WxH, default 1000x1000")
    ap.add_argument("--format", default="png", help="png or jpeg")
    args = ap.parse_args()

    w, h = [int(x) for x in args.size.lower().split("x")]
    fmt = args.format.lower()
    if fmt not in {"png", "jpeg", "jpg"}:
        raise ValueError("format must be png or jpeg")

    if args.input.lower().endswith(".parquet"):
        df = pd.read_parquet(args.input)
    else:
        df = pd.read_json(args.input, lines=True)

    if "image_path" not in df.columns:
        raise ValueError("input must have image_path column")

    blobs: List[bytes] = []
    sizes: List[List[int]] = []

    for p in tqdm(df["image_path"].tolist(), desc="Embedding images"):
        img = Image.open(p).convert("RGB")
        img = img.resize((w, h))
        bio = io.BytesIO()
        if fmt in {"jpeg", "jpg"}:
            img.save(bio, format="JPEG", quality=92, optimize=True)
        else:
            img.save(bio, format="PNG", optimize=True)
        blobs.append(bio.getvalue())
        sizes.append([w, h])

    df = df.copy()
    df["image_bytes"] = blobs
    df["image_embedded_size"] = sizes
    df.to_parquet(args.out, index=False)
    print({"rows": len(df), "out": args.out, "embedded": True})


if __name__ == "__main__":
    main()
