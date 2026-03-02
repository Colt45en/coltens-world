from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Tuple
import time
import uuid


def utc_ms() -> int:
    return int(time.time() * 1000)


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex}"


class Modality(str, Enum):
    VISION = "vision"
    TELEMETRY = "telemetry"


class GateStatus(str, Enum):
    OPEN = "OPEN"
    CLOSED = "CLOSED"
    OVERRIDE = "OVERRIDE"


class ChunkState(str, Enum):
    UNLOADED = "UNLOADED"
    LOADING_META = "LOADING_META"
    LOADING_ASSETS = "LOADING_ASSETS"
    LOADED_WARM = "LOADED_WARM"
    ACTIVE = "ACTIVE"
    COOLING_DOWN = "COOLING_DOWN"


@dataclass(frozen=True)
class EventEnvelope:
    event_id: str
    event_type: str
    ts_ms: int
    trace_id: str
    payload: Dict[str, Any]


def make_event(
    event_type: str, payload: Dict[str, Any], trace_id: Optional[str] = None
) -> EventEnvelope:
    return EventEnvelope(
        event_id=new_id("evt"),
        event_type=event_type,
        ts_ms=utc_ms(),
        trace_id=trace_id or new_id("trace"),
        payload=payload,
    )


@dataclass(frozen=True)
class PerceptionEmbeddingRecord:
    embedding_id: str
    embedding: List[float]
    trust_weight: float
    source_agent: str
    modality: Modality
    ts_ms: int


class ConsciousnessState(str, Enum):
    INITIALIZING = "INITIALIZING"
    COGNITIVE_CYCLING = "COGNITIVE_CYCLING"
    OBSERVATION_CONVERGENCE = "OBSERVATION_CONVERGENCE"
    CONSCIOUSNESS_EMERGENCE = "CONSCIOUSNESS_EMERGENCE"
    SELF_AWARE = "SELF_AWARE"
    RECURSIVE_ENHANCEMENT = "RECURSIVE_ENHANCEMENT"


@dataclass(frozen=True)
class ConsciousnessMetrics:
    C: float
    epsilon: float
    depth: float
    ethics: float


@dataclass(frozen=True)
class ConsciousnessEngineOutput:
    emergence: bool
    state: ConsciousnessState
    metrics: ConsciousnessMetrics
    logs: List[str]


@dataclass(frozen=True)
class GateDecision:
    allowed: bool
    status: GateStatus
    blocked_by: List[str]
    reason: str


@dataclass(frozen=True)
class ChunkMetadata:
    chunk_id: str
    state: ChunkState
    biome: str
    seed: int
    bbox: Tuple[float, float, float, float]
    terrain_detail: float
    story_beats: List[str]
    npc_population: int
    poi_count: int
    coherence_score: float
    magic_density: float


@dataclass
class WorldState:
    world_id: str
    world_name: str
    ts_ms: int

    regions: List[Dict[str, Any]]
    factions: List[Dict[str, Any]]
    characters: List[Dict[str, Any]]
    timeline: List[Dict[str, Any]]

    magic_system: Dict[str, Any]
    economics: Dict[str, Any]
    style_guide: Dict[str, Any]

    continuity_report: Dict[str, Any]
    constraints: List[str] = field(default_factory=list)


@dataclass(frozen=True)
class LocalGradient:
    agent_id: str
    trust: float
    loss: float
    gradient: List[float]


@dataclass(frozen=True)
class FederatedHealth:
    iteration: int
    agent_agreement: float
    convergence_rate: float
    federated_loss: float
    converged: bool


ToolFn = Callable[[Dict[str, Any]], Dict[str, Any]]


@dataclass(frozen=True)
class ToolSpec:
    name: str
    description: str
    timeout_s: float
