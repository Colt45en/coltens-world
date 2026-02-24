"""
Brain Memory Service

Persistent fact/vector storage with TTL support.

Used by:
- Operators to write memory_writes from executions
- Brain to maintain conversation context (facts, working summary)
- IDE to restore session state

Storage:
- In-memory for development (fast, non-persistent)
- Future: SQLite or Redis for production
"""

from __future__ import annotations
import json
import time
from typing import Any, Dict, List, Optional
from dataclasses import dataclass
from datetime import datetime


@dataclass
class MemoryEntry:
    """Single memory entry with TTL."""

    key: str
    value: str  # JSON-serialized
    created_at: float = None  # Unix timestamp
    ttl_seconds: Optional[int] = None  # None = permanent

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = time.time()

    def is_expired(self) -> bool:
        """Check if entry has expired."""
        if self.ttl_seconds is None:
            return False

        age_seconds = time.time() - self.created_at
        return age_seconds > self.ttl_seconds

    def expires_at(self) -> Optional[float]:
        """Get expiration timestamp, or None if permanent."""
        if self.ttl_seconds is None:
            return None
        return self.created_at + self.ttl_seconds

    def to_dict(self) -> Dict[str, Any]:
        """Serialize to dict."""
        return {
            "key": self.key,
            "value": self.value,
            "created_at": datetime.fromtimestamp(self.created_at).isoformat(),
            "ttl_seconds": self.ttl_seconds,
            "expires_at": (
                datetime.fromtimestamp(self.expires_at()).isoformat()
                if self.expires_at()
                else None
            ),
            "is_expired": self.is_expired(),
        }


class BrainMemoryService:
    """In-memory fact/vector storage with TTL."""

    def __init__(self):
        self.facts: Dict[str, MemoryEntry] = {}
        self.vectors: Dict[str, MemoryEntry] = {}  # For embeddings
        self.summaries: Dict[str, MemoryEntry] = {}  # Working summaries
        self.created_at = time.time()

    def write_fact(
        self, key: str, value: str, ttl_seconds: Optional[int] = None
    ) -> None:
        """Write or update a fact."""
        self.facts[key] = MemoryEntry(
            key=key, value=value, created_at=time.time(), ttl_seconds=ttl_seconds
        )

    def write_vector(
        self,
        key: str,
        vector: List[float],
        label: str = "",
        ttl_seconds: Optional[int] = 86400 * 7,  # 1 week default
    ) -> None:
        """Write or update a vector embedding."""
        entry_data = {"vector": vector, "label": label}
        self.vectors[key] = MemoryEntry(
            key=key,
            value=json.dumps(entry_data),
            created_at=time.time(),
            ttl_seconds=ttl_seconds,
        )

    def write_summary(self, key: str, summary: str, ttl_seconds: Optional[int] = None) -> None:
        """Write or update a working summary."""
        self.summaries[key] = MemoryEntry(
            key=key, value=summary, created_at=time.time(), ttl_seconds=ttl_seconds
        )

    def get_fact(self, key: str) -> Optional[str]:
        """Get fact value by key."""
        entry = self.facts.get(key)
        if entry is None:
            return None
        if entry.is_expired():
            del self.facts[key]
            return None
        return entry.value

    def get_vector(self, key: str) -> Optional[List[float]]:
        """Get vector embedding by key."""
        entry = self.vectors.get(key)
        if entry is None:
            return None
        if entry.is_expired():
            del self.vectors[key]
            return None

        try:
            data = json.loads(entry.value)
            return data.get("vector")
        except json.JSONDecodeError:
            return None

    def get_summary(self, key: str) -> Optional[str]:
        """Get summary by key."""
        entry = self.summaries.get(key)
        if entry is None:
            return None
        if entry.is_expired():
            del self.summaries[key]
            return None
        return entry.value

    def list_facts(self, prefix: Optional[str] = None, limit: int = 100) -> List[Dict[str, Any]]:
        """List facts (optionally by prefix)."""
        result = []
        for key, entry in sorted(self.facts.items()):
            if entry.is_expired():
                del self.facts[key]
                continue
            if prefix and not key.startswith(prefix):
                continue
            result.append(entry.to_dict())
            if len(result) >= limit:
                break
        return result

    def list_vectors(self, limit: int = 100) -> List[Dict[str, Any]]:
        """List vectors."""
        result = []
        for key, entry in sorted(self.vectors.items()):
            if entry.is_expired():
                del self.vectors[key]
                continue
            result.append(entry.to_dict())
            if len(result) >= limit:
                break
        return result

    def list_summaries(self, limit: int = 100) -> List[Dict[str, Any]]:
        """List summaries."""
        result = []
        for key, entry in sorted(self.summaries.items()):
            if entry.is_expired():
                del self.summaries[key]
                continue
            result.append(entry.to_dict())
            if len(result) >= limit:
                break
        return result

    def delete_fact(self, key: str) -> bool:
        """Delete a fact."""
        if key in self.facts:
            del self.facts[key]
            return True
        return False

    def delete_vector(self, key: str) -> bool:
        """Delete a vector."""
        if key in self.vectors:
            del self.vectors[key]
            return True
        return False

    def delete_summary(self, key: str) -> bool:
        """Delete a summary."""
        if key in self.summaries:
            del self.summaries[key]
            return True
        return False

    def cleanup_expired(self) -> Dict[str, int]:
        """Remove expired entries. Returns counts of removed entries."""
        removed = {
            "facts": 0,
            "vectors": 0,
            "summaries": 0,
        }

        # Clean facts
        expired_keys = [k for k, v in self.facts.items() if v.is_expired()]
        for k in expired_keys:
            del self.facts[k]
            removed["facts"] += 1

        # Clean vectors
        expired_keys = [k for k, v in self.vectors.items() if v.is_expired()]
        for k in expired_keys:
            del self.vectors[k]
            removed["vectors"] += 1

        # Clean summaries
        expired_keys = [k for k, v in self.summaries.items() if v.is_expired()]
        for k in expired_keys:
            del self.summaries[k]
            removed["summaries"] += 1

        return removed

    def stats(self) -> Dict[str, Any]:
        """Get memory service statistics."""
        # Clean before stats
        removed = self.cleanup_expired()

        return {
            "uptime_seconds": time.time() - self.created_at,
            "fact_count": len(self.facts),
            "vector_count": len(self.vectors),
            "summary_count": len(self.summaries),
            "total_entries": len(self.facts) + len(self.vectors) + len(self.summaries),
            "recent_cleanup": removed,
        }

    def clear(self):
        """Clear all memory (for testing)."""
        self.facts.clear()
        self.vectors.clear()
        self.summaries.clear()


# Global memory instance
_memory_service: Optional[BrainMemoryService] = None


def get_memory_service() -> BrainMemoryService:
    """Get or create global memory service."""
    global _memory_service
    if _memory_service is None:
        _memory_service = BrainMemoryService()
    return _memory_service


def apply_memory_writes(memory_writes: List[Any]) -> int:
    """
    Apply a list of memory writes (from operator response).

    Args:
        memory_writes: List of {key, value, ttl_seconds} dicts

    Returns:
        Number of writes applied
    """
    service = get_memory_service()
    count = 0

    for write in memory_writes:
        key = write.get("key")
        value = write.get("value")
        ttl = write.get("ttl_seconds")

        if key and value:
            # Guess type from key prefix
            if key.startswith("patch:"):
                # Code patches are just strings
                service.write_fact(key, value, ttl)
            elif key.startswith("world_tick:"):
                # World ticks are permanent (world history)
                service.write_fact(key, value, None)
            else:
                # Default to fact
                service.write_fact(key, value, ttl)

            count += 1

    return count
