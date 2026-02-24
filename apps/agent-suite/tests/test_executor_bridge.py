from packages.core.model_actions import AgentAction
from packages.core.executor_bridge import model_to_executor

def test_bridge_sequence_is_deterministic():
    a = AgentAction.from_dict({"POINT": [500, 500], "TYPE": "hello", "PRESS": "ENTER", "STATUS": "continue"})
    screen = (1920, 1080)

    seq1 = model_to_executor(a, screen)
    seq2 = model_to_executor(a, screen)

    assert seq1 == seq2
    assert [x["kind"] for x in seq1] == ["click", "type", "press"]
