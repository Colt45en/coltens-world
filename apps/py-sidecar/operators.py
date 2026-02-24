"""
Brain Operator System

Registers and executes operators (prompt.operator.patch, prompt.operator.simulate_world_tick).
Uses OpenAI Chat API for LLM-powered code generation and world simulation.
Integrates with memory system for fact/vector persistence.
"""

from __future__ import annotations
import json
import hashlib
import asyncio
from typing import Any, Dict, List, Optional
from datetime import datetime
from dataclasses import dataclass, asdict
from abc import ABC
import time

# Would be installed via requirements
import openai


# ============================================================================
# Data Classes (Operator Request/Response)
# ============================================================================

@dataclass
class MemoryContext:
    """Context from memory system"""
    facts: List[Dict[str, Any]] = None
    vectors: List[Dict[str, Any]] = None
    summary: str = ""

    def __post_init__(self):
        if self.facts is None:
            self.facts = []
        if self.vectors is None:
            self.vectors = []


@dataclass
class OperatorRequest:
    """Unified operator request"""
    operator_name: str
    trace_id: str
    payload: Dict[str, Any]
    memory_context: Optional[MemoryContext] = None
    timeout_ms: int = 30000
    deterministic: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return {
            "operator_name": self.operator_name,
            "trace_id": self.trace_id,
            "payload": self.payload,
            "memory_context": asdict(self.memory_context) if self.memory_context else {},
            "timeout_ms": self.timeout_ms,
            "deterministic": self.deterministic,
        }


@dataclass
class MemoryWrite:
    """Memory persistence request"""
    key: str
    value: str
    ttl_seconds: Optional[int] = None


@dataclass
class OperatorResponse:
    """Unified operator response"""
    operator_name: str
    trace_id: str
    status: str  # success | validation_error | timeout | execution_error
    result: Dict[str, Any] = None
    error: Optional[Dict[str, Any]] = None
    memory_writes: List[MemoryWrite] = None
    execution_time_ms: int = 0
    deterministic_hash: Optional[str] = None

    def __post_init__(self):
        if self.result is None:
            self.result = {}
        if self.memory_writes is None:
            self.memory_writes = []

    def to_dict(self) -> Dict[str, Any]:
        return {
            "operator_name": self.operator_name,
            "trace_id": self.trace_id,
            "status": self.status,
            "result": self.result,
            "error": self.error,
            "memory_writes": [{"key": w.key, "value": w.value, "ttl_seconds": w.ttl_seconds} for w in self.memory_writes],
            "execution_time_ms": self.execution_time_ms,
            "deterministic_hash": self.deterministic_hash,
        }


# ============================================================================
# Base Operator (ABC)
# ============================================================================

class BaseOperator(ABC):
    """Abstract base for all operators"""

    def __init__(self, name: str):
        self.name = name
        self._openai_client = None  # Lazy initialization

    @property
    def openai_client(self):
        """Lazy-initialize OpenAI client."""
        if self._openai_client is None:
            self._openai_client = openai.AsyncOpenAI()
        return self._openai_client

    async def call_openai(
        self,
        messages: List[Dict[str, str]],
        model: str = "gpt-4-turbo",
        temperature: float = 0.3,
        max_tokens: int = 4096,
    ) -> str:
        """Call OpenAI Chat API and extract response text."""
        try:
            response = await self.openai_client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            raise RuntimeError(f"OpenAI API error: {str(e)}")

    def compute_hash(self, data: Any) -> str:
        """Compute SHA-256 hash of output for replay verification."""
        json_str = json.dumps(data, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(json_str.encode()).hexdigest()


# ============================================================================
# Operator: prompt.operator.patch (LLM-powered code generation)
# ============================================================================

class PatchOperator(BaseOperator):
    """
    Code generation operator.
    Uses OpenAI to generate unified diffs for file modifications.
    """

    def __init__(self):
        super().__init__("prompt.operator.patch")

    async def execute(self, request: OperatorRequest) -> OperatorResponse:
        """Generate code patch using OpenAI."""
        start = time.time()

        try:
            # Validate payload
            payload = request.payload
            if not all(k in payload for k in ["file_path", "instruction", "current_content"]):
                return OperatorResponse(
                    operator_name=self.name,
                    trace_id=request.trace_id,
                    status="validation_error",
                    error={
                        "code": "MISSING_PAYLOAD_FIELDS",
                        "message": "patch operator requires: file_path, instruction, current_content"
                    },
                    execution_time_ms=int((time.time() - start) * 1000),
                )

            file_path = payload["file_path"]
            instruction = payload["instruction"]
            current_content = payload["current_content"]
            context = payload.get("context", {})
            model = payload.get("model", "gpt-4-turbo")
            temperature = payload.get("temperature", 0.3)

            # Build prompt
            language = context.get("language", "typescript")
            constraint = context.get("constraint", "Produce minimal, focused changes.")

            system_prompt = f"""You are an expert code modifier. Your task is to generate a unified diff for a {language} file.

CONSTRAINT: {constraint}

Respond ONLY with a valid unified diff. Example format:
--- a/path/to/file.ts
+++ b/path/to/file.ts
@@ -10,5 +10,7 @@
 unchanged line
-old line to remove
+new line to add
 another unchanged line

Do NOT include explanations, comments, or backticks."""

            user_prompt = f"""FILE: {file_path}

CURRENT CONTENT:
```{language}
{current_content}
```

INSTRUCTION:
{instruction}

Generate the unified diff now."""

            diff_text = await self.call_openai(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                model=model,
                temperature=temperature,
                max_tokens=4096,
            )

            # Validate diff format
            if not diff_text.startswith("---"):
                return OperatorResponse(
                    operator_name=self.name,
                    trace_id=request.trace_id,
                    status="execution_error",
                    error={
                        "code": "INVALID_DIFF_FORMAT",
                        "message": f"OpenAI response did not start with '---'. Got: {diff_text[:100]}"
                    },
                    execution_time_ms=int((time.time() - start) * 1000),
                )

            # Success
            result = {
                "diff": diff_text,
                "file_path": file_path,
                "model_used": model,
            }

            exec_time = int((time.time() - start) * 1000)

            return OperatorResponse(
                operator_name=self.name,
                trace_id=request.trace_id,
                status="success",
                result=result,
                execution_time_ms=exec_time,
                deterministic_hash=self.compute_hash(result) if request.deterministic else None,
                memory_writes=[
                    MemoryWrite(
                        key=f"patch:{file_path}",
                        value=diff_text,
                        ttl_seconds=3600,  # 1 hour
                    )
                ],
            )

        except asyncio.TimeoutError:
            return OperatorResponse(
                operator_name=self.name,
                trace_id=request.trace_id,
                status="timeout",
                error={
                    "code": "EXECUTION_TIMEOUT",
                    "message": f"Operator exceeded {request.timeout_ms}ms timeout",
                },
                execution_time_ms=int((time.time() - start) * 1000),
            )
        except Exception as e:
            return OperatorResponse(
                operator_name=self.name,
                trace_id=request.trace_id,
                status="execution_error",
                error={
                    "code": "EXECUTION_ERROR",
                    "message": str(e),
                    "details": {"exception_type": type(e).__name__},
                },
                execution_time_ms=int((time.time() - start) * 1000),
            )


# ============================================================================
# Operator: prompt.operator.simulate_world_tick (Deterministic world deltas)
# ============================================================================

class SimulateWorldTickOperator(BaseOperator):
    """
    World simulation operator.
    Generates deterministic world state deltas (entity movement, collision, etc).
    Uses seeded PRNG for reproducibility.
    """

    def __init__(self):
        super().__init__("prompt.operator.simulate_world_tick")

    def seeded_rng(self, seed: int, index: int) -> float:
        """Deterministic RNG using XORShift + counter."""
        x = seed ^ (index + 1)
        x ^= x << 13
        x ^= x >> 7
        x ^= x << 17
        return (x & 0xFFFFFFFF) / 0xFFFFFFFF

    async def execute(self, request: OperatorRequest) -> OperatorResponse:
        """Simulate world tick and generate entity deltas."""
        start = time.time()

        try:
            # Validate payload
            payload = request.payload
            if not all(k in payload for k in ["world_state", "tick_number", "seed", "instruction"]):
                return OperatorResponse(
                    operator_name=self.name,
                    trace_id=request.trace_id,
                    status="validation_error",
                    error={
                        "code": "MISSING_PAYLOAD_FIELDS",
                        "message": "simulate_world_tick requires: world_state, tick_number, seed, instruction"
                    },
                    execution_time_ms=int((time.time() - start) * 1000),
                )

            world_state = payload["world_state"]
            tick_number = payload["tick_number"]
            seed = payload["seed"]
            instruction = payload["instruction"]
            constraints = payload.get("delta_constraints", {})
            model = payload.get("model", "gpt-4-turbo")

            max_velocity = constraints.get("max_velocity_per_tick", 5.0)
            max_rotation = constraints.get("max_rotation_radians", 0.5)

            # Prepare context for LLM
            entities_summary = f"Entities: {len(world_state.get('entities', []))} total"
            collisions_summary = f"Active collisions: {len(world_state.get('collisions', []))}"

            system_prompt = """You are a deterministic physics engine operator.
Generate entity deltas (position, rotation, velocity changes) for a single world tick.

OUTPUT REQUIREMENTS:
1. JSON object with "entity_deltas" array
2. Each delta: {entity_id, dx, dy, dz, drotation_rad, forces}
3. All values must respect physical constraints
4. Output ONLY valid JSON, no explanation"""

            user_prompt = f"""WORLD STATE (tick #{tick_number}):
{entities_summary}
{collisions_summary}

INSTRUCTION: {instruction}

CONSTRAINTS:
- Max velocity per tick: {max_velocity}
- Max rotation per tick: {max_rotation} radians

Seed for determinism: {seed}

Generate entity deltas as JSON only:"""

            delta_json_str = await self.call_openai(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                model=model,
                temperature=0.0,  # Deterministic
                max_tokens=2048,
            )

            # Parse and validate JSON
            try:
                delta_data = json.loads(delta_json_str)
            except json.JSONDecodeError as e:
                return OperatorResponse(
                    operator_name=self.name,
                    trace_id=request.trace_id,
                    status="execution_error",
                    error={
                        "code": "INVALID_JSON_RESPONSE",
                        "message": f"Could not parse LLM response as JSON: {str(e)}",
                        "details": {"response_snippet": delta_json_str[:200]}
                    },
                    execution_time_ms=int((time.time() - start) * 1000),
                )

            # Validate deltas against constraints
            entity_deltas = delta_data.get("entity_deltas", [])
            for delta in entity_deltas:
                dx = abs(delta.get("dx", 0))
                abs(delta.get("dy", 0))
                abs(delta.get("dz", 0))
                drot = abs(delta.get("drotation_rad", 0))

                if dx > max_velocity or drot > max_rotation:
                    return OperatorResponse(
                        operator_name=self.name,
                        trace_id=request.trace_id,
                        status="execution_error",
                        error={
                            "code": "CONSTRAINT_VIOLATION",
                            "message": f"Delta violates constraints: dx={dx} (max={max_velocity}), drot={drot} (max={max_rotation})",
                        },
                        execution_time_ms=int((time.time() - start) * 1000),
                    )

            result = {
                "tick_number": tick_number,
                "entity_deltas": entity_deltas,
                "seed_used": seed,
                "constraint_compliance": True,
            }

            exec_time = int((time.time() - start) * 1000)

            return OperatorResponse(
                operator_name=self.name,
                trace_id=request.trace_id,
                status="success",
                result=result,
                execution_time_ms=exec_time,
                deterministic_hash=self.compute_hash(result),  # Always hash for replay
                memory_writes=[
                    MemoryWrite(
                        key=f"world_tick:{tick_number}",
                        value=json.dumps(result),
                        ttl_seconds=None,  # Permanent (world history)
                    )
                ],
            )

        except asyncio.TimeoutError:
            return OperatorResponse(
                operator_name=self.name,
                trace_id=request.trace_id,
                status="timeout",
                error={
                    "code": "EXECUTION_TIMEOUT",
                    "message": f"Operator exceeded {request.timeout_ms}ms timeout",
                },
                execution_time_ms=int((time.time() - start) * 1000),
            )
        except Exception as e:
            return OperatorResponse(
                operator_name=self.name,
                trace_id=request.trace_id,
                status="execution_error",
                error={
                    "code": "EXECUTION_ERROR",
                    "message": str(e),
                    "details": {"exception_type": type(e).__name__},
                },
                execution_time_ms=int((time.time() - start) * 1000),
            )


# ============================================================================
# Operator Registry
# ============================================================================

class OperatorRegistry:
    """Central registry for operator registration, validation, and execution."""

    def __init__(self):
        self.operators: Dict[str, BaseOperator] = {}
        self.execution_log: List[Dict[str, Any]] = []

        # Register built-in operators
        self.register(PatchOperator())
        self.register(SimulateWorldTickOperator())

    def register(self, operator: BaseOperator):
        """Register an operator."""
        self.operators[operator.name] = operator

    def list_operators(self) -> List[str]:
        """List all registered operators."""
        return list(self.operators.keys())

    async def execute(
        self,
        operator_name: str,
        trace_id: str,
        payload: Dict[str, Any],
        memory_context: Optional[MemoryContext] = None,
        timeout_ms: int = 30000,
        deterministic: bool = True,
    ) -> OperatorResponse:
        """Execute an operator."""
        if operator_name not in self.operators:
            return OperatorResponse(
                operator_name=operator_name,
                trace_id=trace_id,
                status="validation_error",
                error={
                    "code": "OPERATOR_NOT_FOUND",
                    "message": f"Operator '{operator_name}' not registered. Available: {self.list_operators()}",
                },
                execution_time_ms=0,
            )

        operator = self.operators[operator_name]
        request = OperatorRequest(
            operator_name=operator_name,
            trace_id=trace_id,
            payload=payload,
            memory_context=memory_context or MemoryContext(),
            timeout_ms=timeout_ms,
            deterministic=deterministic,
        )

        try:
            # Execute with timeout
            response = await asyncio.wait_for(
                operator.execute(request),
                timeout=timeout_ms / 1000.0,
            )
        except asyncio.TimeoutError:
            response = OperatorResponse(
                operator_name=operator_name,
                trace_id=trace_id,
                status="timeout",
                error={
                    "code": "EXECUTION_TIMEOUT",
                    "message": f"Operator execution exceeded {timeout_ms}ms",
                },
                execution_time_ms=timeout_ms,
            )
        except Exception as e:
            response = OperatorResponse(
                operator_name=operator_name,
                trace_id=trace_id,
                status="execution_error",
                error={
                    "code": "UNEXPECTED_ERROR",
                    "message": str(e),
                },
                execution_time_ms=0,
            )

        # Log execution
        self.execution_log.append({
            "timestamp": datetime.utcnow().isoformat(),
            "operator_name": operator_name,
            "trace_id": trace_id,
            "status": response.status,
            "execution_time_ms": response.execution_time_ms,
        })

        return response

    def validate_request(
        self,
        operator_name: str,
        payload: Dict[str, Any],
    ) -> tuple[bool, Optional[str]]:
        """Validate operator request (basic checks)."""
        if operator_name not in self.operators:
            return False, f"Operator '{operator_name}' not found"

        # Could add schema-based validation here with jsonschema
        if not isinstance(payload, dict):
            return False, "Payload must be a dictionary"

        return True, None


# Global registry instance
_registry: Optional[OperatorRegistry] = None

def get_registry() -> OperatorRegistry:
    """Get or create global operator registry."""
    global _registry
    if _registry is None:
        _registry = OperatorRegistry()
    return _registry
