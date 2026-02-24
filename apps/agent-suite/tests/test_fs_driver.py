
from packages.core.policy import default_policy
from packages.drivers.fs_local.driver import latest_matching


def test_latest_matching_basic(tmp_path):
    repo = tmp_path / "repo"
    (repo / "sandbox").mkdir(parents=True)
    cfg = default_policy(repo)

    a = repo / "sandbox" / "a.txt"
    b = repo / "sandbox" / "b.txt"
    a.write_text("a", encoding="utf-8")
    b.write_text("b", encoding="utf-8")

    lm = latest_matching(cfg, repo / "sandbox", "**/*.txt")
    assert lm.path.endswith(".txt")
