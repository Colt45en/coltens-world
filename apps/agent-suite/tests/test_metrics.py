from packages.core.grounding_tasks import GroundingTask
from packages.core.metrics import stage1_metrics, stage2_metrics
from packages.core.model_actions import AgentAction


def make_task(**overrides):
    base = {
        "task_type": "text2point",
        "image_path": "dummy.png",
        "screen_size": (1920, 1080),
        "target_point": (150, 150),
        "target_box": (100, 100, 200, 200),
    }
    base.update(overrides)
    return GroundingTask.model_validate(base)


def test_stage1_metrics_point_in_box_true():
    task = make_task()
    m = stage1_metrics(task, (150, 150))
    assert m["task_type"] == "text2point"
    assert m["ok"] is True
    assert m["point_in_box"] is True
    assert m["point_distance"] == 0


def test_stage1_metrics_missing_point():
    task = make_task()
    m = stage1_metrics(task, None)
    assert m["ok"] is False
    assert m["reason"] == "missing_point"


def test_stage2_metrics_strict_and_fuzzy_match():
    gold = AgentAction.model_validate({"POINT": [100, 200], "STATUS": "continue"})
    pred = AgentAction.model_validate({"POINT": [100, 200], "STATUS": "continue"})

    m = stage2_metrics(gold, pred)
    assert m["format_valid"] is True
    assert m["strict_match"] is True
    assert m["fuzzy_match"] is True
    assert m["per_field_accuracy"]["POINT"] is True
    assert m["per_field_accuracy"]["STATUS"] is True


def test_stage2_metrics_fuzzy_match_within_tolerance():
    gold = AgentAction.model_validate({"POINT": [100, 200], "STATUS": "continue"})
    pred = AgentAction.model_validate({"POINT": [110, 215], "STATUS": "continue"})

    m = stage2_metrics(gold, pred, point_tol=25)
    assert m["format_valid"] is True
    assert m["strict_match"] is False
    assert m["fuzzy_match"] is True


def test_stage2_metrics_invalid_pred():
    gold = AgentAction.model_validate({"POINT": [100, 200], "STATUS": "continue"})
    m = stage2_metrics(gold, None)
    assert m["format_valid"] is False
    assert m["strict_match"] is False
    assert m["fuzzy_match"] is False
