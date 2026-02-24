from packages.core.reward import compute_reward

def test_reward_invalid_format_is_minus_one():
    r = compute_reward({"pred_action": None})
    assert r["reward"] == -1
    assert r["reason"] == "format_invalid"

def test_reward_exact_match_is_one():
    sample = {
        "pred_action": {"POINT":[1,2], "STATUS":"continue"},
        "gold_action": {"POINT":[1,2], "STATUS":"continue"},
    }
    r = compute_reward(sample)
    assert r["reward"] == 1
    assert r["reason"] == "correct_action"

def test_reward_valid_wrong_is_zero():
    sample = {
        "pred_action": {"POINT":[1,2], "STATUS":"continue"},
        "gold_action": {"POINT":[9,9], "STATUS":"continue"},
    }
    r = compute_reward(sample)
    assert r["reward"] == 0
    assert r["reason"] == "wrong_action"
