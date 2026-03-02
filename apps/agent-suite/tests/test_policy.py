import pytest

from packages.core.policy import (
    default_policy,
    assert_path_allowed,
    assert_domain_allowed,
)
from packages.core.utils import domain_of


def test_path_policy_allows_sandbox(tmp_path):
    repo = tmp_path / "repo"
    (repo / "sandbox").mkdir(parents=True)
    cfg = default_policy(repo)

    ok = repo / "sandbox" / "file.txt"
    ok.write_text("x", encoding="utf-8")
    assert assert_path_allowed(cfg, ok) == ok.resolve()

    bad = repo / "not_allowed.txt"
    bad.write_text("x", encoding="utf-8")
    with pytest.raises(PermissionError):
        assert_path_allowed(cfg, bad)


def test_domain_policy_allows_google(tmp_path):
    repo = tmp_path / "repo"
    (repo / "sandbox").mkdir(parents=True)
    cfg = default_policy(repo)

    assert_domain_allowed(cfg, domain_of("https://www.google.com/search?q=test"))
    with pytest.raises(PermissionError):
        assert_domain_allowed(cfg, "example.com")
