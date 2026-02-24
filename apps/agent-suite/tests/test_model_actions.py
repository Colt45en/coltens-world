from packages.core.model_actions import AgentAction, compact_action_dumps, compact_action_loads

def test_compact_roundtrip_is_stable():
    a = AgentAction.from_dict({"POINT": [200, 300], "TYPE": "x", "STATUS": "continue"})
    s1 = compact_action_dumps(a)
    a2 = compact_action_loads(s1)
    s2 = compact_action_dumps(a2)
    assert s1 == s2

def test_envelope_and_compact_parse_same():
    compact = {"POINT": [1, 2], "STATUS": "continue"}
    envelope = {"type": "agent_action", "data": compact}
    a1 = AgentAction.from_dict(compact)
    a2 = AgentAction.from_dict(envelope)
    assert a1.compact_dict() == a2.compact_dict()
