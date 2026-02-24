from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Literal, Tuple


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
class V1EventEnvelope:
    v: Literal[1]
    event_type: str
    ts_ms: int
    trace_id: str
    seq: int
    payload: Dict[str, Any]
    event_id: str


@dataclass(frozen=True)
class V1CommandEnvelope:
    v: Literal[1]
    command_type: str
    ts_ms: int
    trace_id: str
    payload: Dict[str, Any]
    command_id: str


@dataclass(frozen=True)
class V1Imprint:
    v: Literal[1]
    imprint_id: str
    ts_ms: int
    trace_id: str
    kind: str
    data: Dict[str, Any]


@dataclass(frozen=True)
class V1PerceptionEmbeddingRecord:
    v: Literal[1]
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
class V1ConsciousnessMetrics:
    v: Literal[1]
    C: float
    epsilon: float
    depth: float
    ethics: float


@dataclass(frozen=True)
class V1ConsciousnessEngineOutput:
    v: Literal[1]
    emergence: bool
    state: ConsciousnessState
    metrics: V1ConsciousnessMetrics
    logs: List[str]


@dataclass(frozen=True)
class V1GateDecision:
    v: Literal[1]
    allowed: bool
    status: GateStatus
    blocked_by: List[str]
    reason: str


@dataclass(frozen=True)
class V1ChunkMetadata:
    v: Literal[1]
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
class V1WorldState:
    v: Literal[1]
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
    constraints: List[str] = field(default_factory=lambda: list[str]())
