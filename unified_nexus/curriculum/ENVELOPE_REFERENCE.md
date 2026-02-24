"""
WHEEL CURRICULUM ENVELOPE REFERENCE

Quick reference for the envelopes emitted/received by WheelRuntime.
All envelopes match your V1EventEnvelope spec (ts_ms, trace_id, event_type, event_id).

=============================================================================
1. BRAIN → AGENT: nucleus.tool_call
=============================================================================

Event emitted by Brain when ready to start a new stop.

```json
{
  "v": 1,
  "event_type": "nucleus.tool_call",
  "ts_ms": 1708668000000,
  "trace_id": "550e8400-e29b-41d4-a716-446655440000",
  "seq": 0,
  "event_id": "660f9411-f3ac-52e5-b827-557755550111",
  "payload": {
    "call_id": "770g0422-g4bd-63f6-c938-668866661222",
    "tool": "curriculum.stop.execute",
    "args": {
      "contract": "curriculum.stop.execute.v1",
      "wheel_id": "learning-wheel",
      "rotation": 1,
      "stop_id": "verbs",
      "stop_label": "Learning All the Differences in Verbs",
      "teaching_points": [
        "Action Verbs: Run, jump, create—physical and mental movement.",
        "Linking Verbs: Is, seem, become—connect subject and complement.",
        "Helping Verbs: Can, will, must—modify tense or possibility.",
        "Transitive vs. Intransitive: He writes a book (transitive) vs. He writes daily (intransitive).",
        "Regular vs. Irregular: Walk → walked vs. Go → went."
      ],
      "prompt": "WHEEL: Ferris Wheel Learning Loop\nwheel_id=learning-wheel\nrotation=1/100\nstop=verbs :: Learning All the Differences in Verbs\n\nTEACHING POINTS (use these exactly as the lesson anchors):\n- Action Verbs: Run, jump, create—physical and mental movement.\n- Linking Verbs: Is, seem, become—connect subject and complement.\n- Helping Verbs: Can, will, must—modify tense or possibility.\n- Transitive vs. Intransitive: He writes a book (transitive) vs. He writes daily (intransitive).\n- Regular vs. Irregular: Walk → walked vs. Go → went.\n\nREQUIRED OUTPUT (deterministic structure):\n1) 3-sentence explanation\n2) 3 examples\n3) 3 quick checks (Q->A)\n4) 1 common mistake + correction\n5) tags[] (5-10 tokens)",
      "guardian_invariants": [
        "Stop order must follow stop_order list",
        "Rotation must be within [1..total_rotations]",
        "A stop cannot be completed twice in the same rotation",
        "Tool results must match the active call_id to advance"
      ]
    }
  }
}
```

**Key fields:**
- `payload.call_id` — UUID to correlate with tool_result
- `payload.args.teaching_points` — Array of lesson anchors (what the agent must teach)
- `payload.args.prompt` — Full formatted lesson prompt
- For rotation 1: teaching_points = loop1_points (pinned)
- For rotation 2+: teaching_points = deterministic pool picks

=============================================================================
2. AGENT → BRAIN: nucleus.tool_result
=============================================================================

Event emitted by Agent after completing curriculum.stop.execute.

```json
{
  "v": 1,
  "event_type": "nucleus.tool_result",
  "ts_ms": 1708668001234,
  "trace_id": "550e8400-e29b-41d4-a716-446655440000",
  "seq": 1,
  "event_id": "880h1533-h5ce-74g7-d949-779977772333",
  "payload": {
    "call_id": "770g0422-g4bd-63f6-c938-668866661222",
    "ok": true,
    "result": {
      "ok": true,
      "summary": "Completed Loop 1: Verb types (action, linking, helping, transitive, irregular).",
      "explanation_3_sentences": [
        "Verbs are words that express action or state of being, and they come in many varieties depending on their function and form.",
        "Some verbs describe physical or mental movement (action verbs), while others connect a subject to a complement (linking verbs), and still others modify tense or mood (helping verbs).",
        "Understanding the differences between transitive and intransitive verbs, as well as regular and irregular verb forms, is essential for mastering grammar and clear communication."
      ],
      "examples": [
        "Action verb: 'She runs every morning.' Linking verb: 'The sky is blue.' Helping verb: 'You will arrive soon.'",
        "Transitive: 'I wrote a letter.' Intransitive: 'I laughed out loud.'",
        "Regular: 'I walked.' Irregular: 'I went.'"
      ],
      "quick_checks": [
        {
          "q": "Is 'walked' a regular or irregular verb?",
          "a": "Regular (add -ed to past tense)."
        },
        {
          "q": "What is an action verb?",
          "a": "A verb expressing physical or mental movement (e.g., run, think, create)."
        },
        {
          "q": "Give an example of a linking verb.",
          "a": "Is, seem, become, appear."
        }
      ],
      "common_mistake": {
        "mistake": "Using 'went' as a regular verb by saying 'goed'.",
        "fix": "Went is the irregular past tense of 'go'. Use 'went', never 'goed'."
      },
      "tags": [
        "verbs",
        "action-verbs",
        "linking-verbs",
        "grammar",
        "transitive",
        "intransitive",
        "regular-irregular"
      ]
    }
  }
}
```

**Key fields:**
- `payload.call_id` — MUST match the original nucleus.tool_call.payload.call_id
- `payload.ok` — true if successful, false if error
- `payload.result.ok` — redundant ok flag (same as top-level ok)
- `payload.result.summary` — One-liner describing completion
- `payload.result.explanation_3_sentences` — List of 3 explanation sentences
- `payload.result.examples` — List of 3 examples
- `payload.result.quick_checks` — List of {q, a} pairs (3 recommended)
- `payload.result.common_mistake` — {mistake, fix} pair
- `payload.result.tags` — 5-10 relevant tags

If error occurs:
```json
{
  "payload": {
    "call_id": "...",
    "ok": false,
    "error": "Agent crashed during lesson generation"
  }
}
```

=============================================================================
3. BRAIN → OBSERVERS: brain.curriculum.progress
=============================================================================

Event emitted by Brain after each stop completion.

```json
{
  "v": 1,
  "event_type": "brain.curriculum.progress",
  "ts_ms": 1708668002000,
  "trace_id": "550e8400-e29b-41d4-a716-446655440000",
  "seq": 2,
  "event_id": "990i2644-i6df-85h8-e050-880088882444",
  "payload": {
    "wheel_id": "learning-wheel",
    "rotation": 1,
    "stop_index": 1
  }
}
```

**Emitted:**
- After Brain.on_tool_result() completes
- stop_index = next stop to tackle
- Useful for telemetry, progress dashboards

=============================================================================
4. BRAIN → OBSERVERS: brain.curriculum.completed
=============================================================================

Event emitted when all rotations finish.

```json
{
  "v": 1,
  "event_type": "brain.curriculum.completed",
  "ts_ms": 1708668100000,
  "trace_id": "550e8400-e29b-41d4-a716-446655440000",
  "seq": 1000,
  "event_id": "aaa0j0755-j7eg-96i9-f161-991199991555",
  "payload": {
    "wheel_id": "learning-wheel",
    "total_rotations": 100,
    "history_length": 1000
  }
}
```

**Emitted:**
- When Brain.tick() detects rotation > total_rotations
- history_length = total stops completed (10 stops × 100 rotations = 1000)
- Signals curriculum completion to all listeners

=============================================================================
CALL_ID CORRELATION
=============================================================================

The call_id is critical:

1. Brain.tick() generates call_id (uuid.uuid4())
2. Brain emits nucleus.tool_call with this call_id
3. Brain stores call_id in state.active_call = {call_id, stop_id, rotation}
4. Agent receives the call_id in payload (passed through nucleus routing)
5. Agent embeds the call_id in nucleuos.tool_result
6. Brain.on_tool_result() validates call_id == state.active call_id
7. Only if matched: mark completed, advance stop, clear active_call

If call_id doesn't match: result is ignored (stale/crash recovery).

=============================================================================
TRACE_ID & SEQ
=============================================================================

trace_id: UUID per envelope (uniquely identifies event for observability)

seq: Event sequence number in this session
- Starts at 0
- Increments per emission (by Brain/Agent)
- Useful for ordering if events arrive out-of-order

=============================================================================
PAYLOAD STRUCTURE VALIDATION
=============================================================================

All payloads match your unified_nexus/contracts/wheel_curriculum_v1_types:

- V1WheelPlan → nucleus.tool_call args
- CurriculumStopExecuteResult → nucleus.tool_result result
- BrainCurriculumProgressPayload → brain.curriculum.progress payload
- BrainCurriculumCompletedPayload → brain.curriculum.completed payload

None use your dataclasses directly (all dicts for JSON serialization).
Convert with: asdict(CurriculumToolCallPayload(...))

=============================================================================
HOW TO USE THIS REFERENCE
=============================================================================

1. When Brain emits nucleus.tool_call
   → Copy the "BRAIN → AGENT" example above
   → Agent handler receives this envelope

2. When Agent returns result
   → Copy the "AGENT → BRAIN" example
   → Wrap your CurriculumStopExecuteResult as nucleus.tool_result payload

3. When observing progress
   → Listen for brain.curriculum.progress events
   → Extract rotation + stop_index for dashboards

4. When curriculum completes
   → Listen for brain.curriculum.completed event
   → Record total_rotations + history_length in telemetry

5. If debugging
   → Check call_id correlation
   → Verify payload.result matches expected schema
   → Confirm ts_ms is in milliseconds
"""
