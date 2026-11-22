from backend.scenarios.loader import SCENARIOS, get_scenario


def test_scenarios_list_structure():
    assert len(SCENARIOS) >= 3
    for sc in SCENARIOS:
        assert "id" in sc
        assert "title" in sc
        assert "description" in sc
        assert "initial_files" in sc
        assert isinstance(sc["initial_files"], dict)
        assert len(sc["initial_files"]) > 0


def test_get_scenario_by_id():
    sc1 = get_scenario("scenario_1_binary_search")
    assert sc1["id"] == "scenario_1_binary_search"
    assert "binary_search.py" in sc1["initial_files"]
    assert "test_binary_search.py" in sc1["initial_files"]

    sc2 = get_scenario("scenario_2_log_pipeline")
    assert sc2["id"] == "scenario_2_log_pipeline"
    assert "pipeline.py" in sc2["initial_files"]

    sc3 = get_scenario("scenario_3_exponential_backoff")
    assert sc3["id"] == "scenario_3_exponential_backoff"
    assert "http_client.py" in sc3["initial_files"]


def test_get_scenario_fallback():
    fallback = get_scenario("non_existent_scenario_12345")
    assert fallback is not None
    assert fallback["id"] == SCENARIOS[0]["id"]
