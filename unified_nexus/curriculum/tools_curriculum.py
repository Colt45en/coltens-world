"""
Curriculum wheel tool implementations
Deterministic, idempotent tools for wheel-based learning progression

Each tool produces deterministic output given the same inputs,
enabling replay + audit across restarts.
"""

import json
import os
from typing import Any, Dict, List


async def curriculum_stop_execute(args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Execute a teaching stop from the curriculum wheel.

    Args:
        stop_id: str - ID of the stop (e.g., "nouns", "verbs")
        teaching_points: List[str] - 3-5 specific teaching points for this rotation
        rotation: int - Which rotation of the wheel (1-100)
        pick_k: int - How many points were picked (for verification)

    Returns:
        Dict with deterministic explanation + examples (no randomness)

    This is intentionally deterministic:
    - Same inputs → Same output (no Date.now(), no random picks)
    - Suitable for replay after restart
    - Idempotent (calling twice with same args = same result)
    """
    stop_id = str(args.get("stop_id", "unknown"))
    teaching_points: List[str] = list(args.get("teaching_points", []))
    rotation = int(args.get("rotation", 1))
    pick_k = int(args.get("pick_k", 3))

    if not teaching_points:
        return {
            "ok": False,
            "error": "No teaching points provided",
        }

    # Build deterministic explanation (no randomness)
    first_point = teaching_points[0] if teaching_points else "(empty)"

    # Explanation sentences (always same given input)
    explanation_3_sentences = [
        f"Today's focus: {first_point}",
        f"We'll explore {len(teaching_points)} teaching points in depth.",
        f"Rotation {rotation} of 100: Building mastery through repetition.",
    ]

    # Examples (deterministic from stop_id + rotation)
    examples = []
    for i, point in enumerate(teaching_points[:pick_k]):
        examples.append(
            f"Example {i+1} (rotation {rotation}): {point} → core concept."
        )

    # Quick checks (deterministic)
    quick_checks = []
    if len(teaching_points) > 0:
        quick_checks.append({
            "q": f"What is the main focus today?",
            "a": teaching_points[0],
        })
    if len(teaching_points) > 1:
        quick_checks.append({
            "q": f"How many teaching points are we covering?",
            "a": str(len(teaching_points)),
        })

    # Common mistake (relevant to stop type)
    mistake_map = {
        "verbs": "Confusing tense with aspect",
        "nouns": "Assuming all nouns are countable",
        "adjectives": "Treating all adjectives as gradable",
        "adverbs": "Placing modifiers ambiguously",
        "grammar": "Overcomplicating simple structures",
        "semantics": "Mixing literal and figurative meaning",
        "pragmatics": "Ignoring speaker intent",
        "logic": "Confusing OR with XOR",
        "memory": "Losing state on restart",
        "integration": "Skipping verification steps",
    }

    common_mistake_text = mistake_map.get(stop_id, "Rushing through the material")

    return {
        "ok": True,
        "stop_id": stop_id,
        "rotation": rotation,
        "summary": f"{stop_id} rotation {rotation}: Taught {pick_k} points",
        "explanation_3_sentences": explanation_3_sentences,
        "examples": examples,
        "quick_checks": quick_checks,
        "common_mistake": common_mistake_text,
        "next_steps": [
            "Practice the examples yourself",
            "Check your understanding with quick checks",
            "Move to the next stop on the wheel",
        ],
        "determinism_signature": {
            "inputs": {
                "stop_id": stop_id,
                "rotation": rotation,
                "teaching_points_count": len(teaching_points),
            },
            "generated_deterministically": True,
            "replay_safe": True,
        },
    }


async def curriculum_wheel_checkpoint_save(args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Save wheel state checkpoint for deterministic replay.

    Args:
        wheel_id: str
        rotation: int
        stop_index: int
        seq: int
        trace_id: str
        state_dict: Dict[str, Any] - Full state to save

    Returns:
        {"ok": True, "path": str, "seq": int}
    """
    wheel_id = str(args.get("wheel_id", "unknown"))
    rotation = int(args.get("rotation", 1))
    stop_index = int(args.get("stop_index", 0))
    seq = int(args.get("seq", 0))
    state_dict = dict(args.get("state_dict", {}))

    checkpoint_dir = f"runtime/curriculum/{wheel_id}/checkpoints"
    os.makedirs(checkpoint_dir, exist_ok=True)

    # Checkpoint filename includes seq to prevent overwrite races
    checkpoint_file = f"{checkpoint_dir}/rotation_{rotation}_stop_{stop_index}_seq_{seq}.json"

    try:
        with open(checkpoint_file, "w") as f:
            json.dump(state_dict, f, separators=(",", ":"))

        return {
            "ok": True,
            "path": checkpoint_file,
            "seq": seq,
            "rotation": rotation,
            "stop_index": stop_index,
        }
    except Exception as e:
        return {
            "ok": False,
            "error": f"Failed to save checkpoint: {str(e)}",
        }


async def curriculum_wheel_checkpoint_load(args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Load most recent wheel checkpoint for deterministic resume.

    Args:
        wheel_id: str
        checkpoint_dir: str (optional, defaults to runtime/curriculum/{wheel_id}/checkpoints)

    Returns:
        {"ok": True, "state": Dict} or {"ok": False, "reason": str}
    """
    wheel_id = str(args.get("wheel_id", "unknown"))
    checkpoint_dir = str(args.get("checkpoint_dir", f"runtime/curriculum/{wheel_id}/checkpoints"))

    if not os.path.exists(checkpoint_dir):
        return {
            "ok": False,
            "reason": f"No checkpoint directory: {checkpoint_dir}",
        }

    checkpoints = [f for f in os.listdir(checkpoint_dir) if f.endswith(".json")]
    if not checkpoints:
        return {
            "ok": False,
            "reason": "No checkpoints found",
        }

    # Load most recent (highest seq)
    latest = sorted(checkpoints)[-1]
    checkpoint_path = os.path.join(checkpoint_dir, latest)

    try:
        with open(checkpoint_path, "r") as f:
            state = json.load(f)

        return {
            "ok": True,
            "state": state,
            "loaded_from": checkpoint_path,
        }
    except Exception as e:
        return {
            "ok": False,
            "reason": f"Failed to load checkpoint: {str(e)}",
        }
