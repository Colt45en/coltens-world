#!/usr/bin/env python3
"""
Lab Generator CLI: Generate curriculum lab starter code and tests.

Usage:
    python generate_labs.py                    # Generate all labs
    python generate_labs.py la01_regression    # Generate specific lab
    python generate_labs.py --list             # List all available labs
    python generate_labs.py --output ./data    # Specify output directory
"""

import argparse
import sys
from pathlib import Path
from lab_generator import LabGenerator, write_lab_files


def main():
    parser = argparse.ArgumentParser(
        description="Generate curriculum lab starter code and tests"
    )
    parser.add_argument(
        "lab_id",
        nargs="?",
        default=None,
        help="Lab ID to generate (if omitted, generates all labs)",
    )
    parser.add_argument(
        "--output",
        "-o",
        default="labs",
        help="Output directory for generated labs (default: labs)",
    )
    parser.add_argument(
        "--list",
        "-l",
        action="store_true",
        help="List all available labs",
    )

    args = parser.parse_args()

    generator = LabGenerator()

    if args.list:
        print("Available labs:")
        for i, lab_id in enumerate(generator.labs.keys(), 1):
            print(f"  {i}. {lab_id}")
        return

    output_base = Path(args.output)
    output_base.mkdir(parents=True, exist_ok=True)

    if args.lab_id:
        # Generate specific lab
        if args.lab_id not in generator.labs:
            print(f"Error: Unknown lab '{args.lab_id}'", file=sys.stderr)
            print(
                f"Available labs: {', '.join(generator.labs.keys())}", file=sys.stderr
            )
            sys.exit(1)

        output_dir = output_base / args.lab_id
        print(f"Generating lab: {args.lab_id}")
        write_lab_files(args.lab_id, output_dir)
        print(f"✓ Generated to {output_dir}")
    else:
        # Generate all labs
        total = len(generator.labs)
        print(f"Generating {total} labs to {output_base}/")
        for i, lab_id in enumerate(generator.labs.keys(), 1):
            output_dir = output_base / lab_id
            write_lab_files(lab_id, output_dir)
            print(f"  ✓ [{i}/{total}] {lab_id}")

        print(f"\n✓ All {total} labs generated successfully!")
        print(f"  Output directory: {output_base.resolve()}")


if __name__ == "__main__":
    main()
