from packages.core.action_codec import loads_and_validate, dumps_compact


def test_compact_json_no_spaces():
    s = dumps_compact({"POINT":[1,2],"STATUS":"continue"})
    assert " " not in s
    assert "\n" not in s


def test_action_validation_ok():
    ok, obj, err = loads_and_validate('{"POINT":[480,320]}')
    assert ok
    assert obj["POINT"] == [480, 320]


def test_action_validation_semantic_fail():
    ok, obj, err = loads_and_validate('{"to":"down"}')
    assert not ok
    assert "Semantic" in err


def test_action_validation_schema_fail():
    ok, obj, err = loads_and_validate('{"POINT":[2000,0]}')
    assert not ok
    assert "Schema" in err or "Location" in err
