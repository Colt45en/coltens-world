from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional
import random

from ..contracts import WorldState, new_id, utc_ms, ChunkMetadata


@dataclass
class WorldGenesisConfig:
    authorization_required: bool = True


class WorldGenesisOrchestrator:
    """
    Synthesizes coherent world states by composing "agents".
    """

    def __init__(self, cfg: WorldGenesisConfig | None = None) -> None:
        self.cfg = cfg or WorldGenesisConfig()

    def spawn_world(
        self,
        *,
        world_name: str,
        emergence_proof: Dict[str, Any] | None,
        num_regions: int,
        num_characters: int,
        chunk: ChunkMetadata | None = None,
    ) -> Optional[WorldState]:
        if self.cfg.authorization_required:
            if not emergence_proof or not emergence_proof.get("emergence", False):
                return None

        rng = random.Random((chunk.seed if chunk else 777) ^ hash(world_name))

        regions = self._build_regions(rng, num_regions, chunk)
        factions = self._build_factions(rng, regions)
        characters = self._build_characters(rng, num_characters, factions)
        timeline = self._build_timeline(rng, factions, characters)
        magic_system = self._build_magic(rng, chunk)
        economics = self._build_economics(rng, factions)
        style_guide = self._build_style(rng)

        continuity = self._continuity_pass(regions, factions, characters, timeline)
        constraints = continuity.get("constraints", [])

        return WorldState(
            world_id=new_id("world"),
            world_name=world_name,
            ts_ms=utc_ms(),
            regions=regions,
            factions=factions,
            characters=characters,
            timeline=timeline,
            magic_system=magic_system,
            economics=economics,
            style_guide=style_guide,
            continuity_report=continuity,
            constraints=constraints,
        )

    def _build_regions(
        self, rng: random.Random, n: int, chunk: ChunkMetadata | None
    ) -> List[Dict[str, Any]]:
        biome = chunk.biome if chunk else "mixed"
        base = []
        for i in range(n):
            base.append(
                {
                    "id": new_id("region"),
                    "name": f"Region-{i}",
                    "biome": biome,
                    "terrain_detail": float(0.3 + 0.7 * rng.random()),
                }
            )
        return base

    def _build_factions(
        self, rng: random.Random, regions: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        factions = []
        k = max(2, min(5, len(regions)))
        for i in range(k):
            factions.append(
                {
                    "id": new_id("faction"),
                    "name": f"Faction-{i}",
                    "home_region": regions[i % len(regions)]["id"],
                    "ethos": rng.choice(["order", "freedom", "profit", "mysticism"]),
                }
            )
        return factions

    def _build_characters(
        self, rng: random.Random, n: int, factions: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        chars = []
        for i in range(n):
            f = factions[i % len(factions)]
            chars.append(
                {
                    "id": new_id("char"),
                    "name": f"Character-{i}",
                    "faction": f["id"],
                    "role": rng.choice(
                        ["scout", "engineer", "seer", "merchant", "guardian"]
                    ),
                    "motif": rng.choice(["echo", "ember", "glass", "thorn", "signal"]),
                }
            )
        return chars

    def _build_timeline(
        self,
        rng: random.Random,
        factions: List[Dict[str, Any]],
        characters: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        beats = []
        for i in range(6):
            beats.append(
                {
                    "t": i,
                    "event": rng.choice(
                        [
                            "discovery",
                            "conflict",
                            "treaty",
                            "betrayal",
                            "cataclysm",
                            "revelation",
                        ]
                    ),
                    "actor": rng.choice(characters)["id"] if characters else None,
                    "faction": rng.choice(factions)["id"] if factions else None,
                }
            )
        return beats

    def _build_magic(
        self, rng: random.Random, chunk: ChunkMetadata | None
    ) -> Dict[str, Any]:
        density = chunk.magic_density if chunk else 0.12
        return {
            "type": rng.choice(["runes", "fields", "alchemy", "psyche"]),
            "density": float(density),
            "rules": ["conservation", "cost", "signal_noise"],
        }

    def _build_economics(
        self, rng: random.Random, factions: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        return {
            "currency": rng.choice(["coins", "credits", "marks"]),
            "major_goods": rng.sample(
                ["food", "ore", "data", "spice", "artifacts"], k=3
            ),
            "trade_factions": [f["id"] for f in factions[: min(3, len(factions))]],
        }

    def _build_style(self, rng: random.Random) -> Dict[str, Any]:
        return {
            "voice": rng.choice(["mythic", "noir", "scientific", "whimsical"]),
            "lexicon_bias": rng.choice(["concrete", "symbolic", "technical"]),
        }

    def _continuity_pass(
        self, regions, factions, characters, timeline
    ) -> Dict[str, Any]:
        constraints: List[str] = []
        region_ids = {r["id"] for r in regions}
        for f in factions:
            if f["home_region"] not in region_ids:
                constraints.append("orphaned_faction_home_region")

        faction_ids = {f["id"] for f in factions}
        for c in characters:
            if c["faction"] not in faction_ids:
                constraints.append("orphaned_character_faction")

        char_ids = {c["id"] for c in characters}
        for e in timeline:
            if e["actor"] is not None and e["actor"] not in char_ids:
                constraints.append("timeline_actor_missing")

        ok = len(constraints) == 0
        return {
            "ok": ok,
            "constraints": constraints,
            "notes": "reference continuity pass (expand with richer contradiction detection later)",
        }
