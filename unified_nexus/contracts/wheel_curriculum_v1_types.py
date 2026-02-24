"""Wheel Curriculum v1 Contract Types

Deterministic, resumable learning wheel with:
- WheelPlan: curriculum data (stops, teaching points, lesson pool)
- WheelState: session state (rotation, stop index, completion tracking)
- Envelopes: curriculum.stop.execute tool calls + results
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Literal, Optional
from enum import Enum


# ============================================================================
# ENUMS
# ============================================================================


class ToolContractVersion(str, Enum):
    """Tool contract version marker"""
    CURRICULUM_STOP_EXECUTE_V1 = "curriculum.stop.execute.v1"


# ============================================================================
# DATA STRUCTURES (Plan + State)
# ============================================================================


@dataclass(frozen=True)
class WheelStop:
    """A single stop on the wheel (e.g., "verbs", "nouns")"""

    label: str
    """Human-readable stop label"""

    loop1_points: List[str]
    """Core teaching points for rotation 1 (pinned content)"""

    lesson_pool: List[str]
    """Pool of additional lessons for rotations 2+"""


@dataclass(frozen=True)
class MutationPolicy:
    """Deterministic selection policy for pool items"""

    seed: int
    """Base seed for mulberry32 RNG"""

    max_pool_items_per_stop_per_rotation: int
    """Max items picked per stop per rotation (e.g., 2)"""

    no_repeat_within_last_rotations: int
    """Anti-repeat window (e.g., 3 rotations)"""


@dataclass(frozen=True)
class V1WheelPlan:
    """Immutable curriculum plan (the "Brain knows this forever")"""

    v: Literal[1]
    wheel_id: str
    title: str
    total_rotations: int
    stop_order: List[str]
    """Ordered list of stop IDs (e.g., ["verbs", "nouns", ...])"""

    stops: Dict[str, WheelStop]
    """stop_id -> WheelStop definition"""

    agent_tool: Dict[str, str]
    """Tool contract marker: {"tool_name": "curriculum.stop.execute", "expects": "curriculum.stop.execute.v1"}"""

    mutation_policy: MutationPolicy
    """Deterministic pool selection rules"""

    guardian_invariants: List[str]
    """Immutable constraints (for assertion by agent)"""


@dataclass
class V1WheelState:
    """Mutable session state (persisted to resume anywhere)"""

    v: Literal[1]
    wheel_id: str
    rotation: int
    """Current rotation [1..total_rotations]"""

    stop_index: int
    """Current index into plan.stop_order"""

    completed: Dict[str, Dict[str, bool]] = field(default_factory=dict)
    """completed[str(rotation)][stop_id] = true"""

    recent_pool_picks: Dict[str, List[Dict[str, Any]]] = field(default_factory=dict)
    """recent_pool_picks[stop_id] = [{"rotation": N, "item": "..."}, ...]"""

    active_call: Optional[Dict[str, Any]] = None
    """{"call_id": uuid, "stop_id": str, "rotation": int} while waiting for tool_result"""

    history: List[Dict[str, Any]] = field(default_factory=list)
    """[{"rotation": N, "stop_id": "...", "call_id": uuid, "ok": bool, "summary": "..."}]"""


# ============================================================================
# AGENT TOOL CONTRACT: curriculum.stop.execute.v1
# ============================================================================


@dataclass(frozen=True)
class CurriculumStopExecuteInput:
    """Input to curriculum.stop.execute tool (passed via V1CommandEnvelope.payload)"""

    contract: str
    """Should be "curriculum.stop.execute.v1" (from ToolContractVersion enum)"""

    wheel_id: str
    rotation: int
    stop_id: str
    stop_label: str
    teaching_points: List[str]
    """Points to use as lesson anchors (loop1_points or pool picks)"""

    prompt: str
    """Full prompt text describing the lesson"""

    guardian_invariants: List[str]
    """Constraints agent should verify"""


@dataclass(frozen=True)
class QuickCheck:
    """Single Q->A pair for quick checks"""

    q: str
    a: str


@dataclass(frozen=True)
class CommonMistake:
    """Mistake + correction pair"""

    mistake: str
    fix: str


@dataclass(frozen=True)
class CurriculumStopExecuteResult:
    """Result of curriculum.stop.execute (agent returns this in tool_result)"""

    ok: bool
    summary: str
    """One-line completion summary"""

    explanation_3_sentences: List[str]
    """[sentence1, sentence2, sentence3]"""

    examples: List[str]
    """[example1, example2, example3]"""

    quick_checks: List[QuickCheck]
    """[{q, a}, {q, a}, {q, a}]"""

    common_mistake: CommonMistake
    """{"mistake": "...", "fix": "..."}"""

    tags: List[str]
    """[tag1, tag2, ..., tag5-10]"""


# ============================================================================
# ENVELOPE PAYLOADS (for EventBus)
# ============================================================================


@dataclass(frozen=True)
class CurriculumToolCallPayload:
    """Payload for nucleus.tool_call event_type"""

    call_id: str
    """UUID correlating this call with its result"""

    tool: str
    """"curriculum.stop.execute" (from mutation_policy.agent_tool)"""

    args: CurriculumStopExecuteInput
    """Input contract"""


@dataclass(frozen=True)
class CurriculumToolResultPayload:
    """Payload for nucleus.tool_result event_type (from agent back to brain)"""

    call_id: str
    """UUID matching the original nucleus.tool_call.call_id"""

    ok: bool
    """Success flag"""

    result: Optional[CurriculumStopExecuteResult] = None
    """Structured result if ok=true"""

    error: Optional[str] = None
    """Error message if ok=false"""


@dataclass(frozen=True)
class BrainCurriculumProgressPayload:
    """Emitted when a stop completes"""

    wheel_id: str
    rotation: int
    stop_index: int


@dataclass(frozen=True)
class BrainCurriculumCompletedPayload:
    """Emitted when all rotations finish"""

    wheel_id: str
    """Curriculum ID"""

    total_rotations: int
    history_length: int
