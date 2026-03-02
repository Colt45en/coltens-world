from __future__ import annotations

from typing import Dict, List, Optional

from ..contracts import ChunkMetadata, ChunkState, new_id


class ChunkRegistry:
    def __init__(self) -> None:
        self._chunks: Dict[str, ChunkMetadata] = {}

    def upsert(self, meta: ChunkMetadata) -> None:
        self._chunks[meta.chunk_id] = meta

    def list_active(self) -> List[ChunkMetadata]:
        return [c for c in self._chunks.values() if c.state == ChunkState.ACTIVE]

    def seed_demo(self) -> None:
        self.upsert(
            ChunkMetadata(
                chunk_id=new_id("chunk"),
                state=ChunkState.ACTIVE,
                biome="temperate_forest",
                seed=1337,
                bbox=(0.0, 0.0, 512.0, 512.0),
                terrain_detail=0.7,
                story_beats=["arrival", "mystery_signal"],
                npc_population=42,
                poi_count=7,
                coherence_score=0.82,
                magic_density=0.18,
            )
        )
        self.upsert(
            ChunkMetadata(
                chunk_id=new_id("chunk"),
                state=ChunkState.LOADED_WARM,
                biome="desert_ruins",
                seed=202,
                bbox=(512.0, 0.0, 1024.0, 512.0),
                terrain_detail=0.5,
                story_beats=["distant_ruins"],
                npc_population=12,
                poi_count=3,
                coherence_score=0.74,
                magic_density=0.06,
            )
        )
        self.upsert(
            ChunkMetadata(
                chunk_id=new_id("chunk"),
                state=ChunkState.UNLOADED,
                biome="ocean",
                seed=9,
                bbox=(0.0, 512.0, 512.0, 1024.0),
                terrain_detail=0.2,
                story_beats=[],
                npc_population=0,
                poi_count=0,
                coherence_score=0.90,
                magic_density=0.01,
            )
        )


class StreamingAwareWorldGenerator:
    """
    Only spawns agents/world expansions in ACTIVE chunks.
    """

    def __init__(self, chunks: ChunkRegistry) -> None:
        self.chunks = chunks

    def choose_chunk(self) -> Optional[ChunkMetadata]:
        act = self.chunks.list_active()
        if not act:
            return None
        return sorted(act, key=lambda c: c.coherence_score, reverse=True)[0]
