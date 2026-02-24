from packages.core.policy import default_policy
from packages.drivers.notes_store.driver import create_note, append_note, list_notes, read_note


def test_notes_crud(tmp_path):
    repo = tmp_path / "repo"
    (repo / "sandbox").mkdir(parents=True)
    cfg = default_policy(repo)

    meta = create_note(cfg, repo, title="Test Note", body_md="hello")
    assert meta.note_id.startswith("note_")
    notes = list_notes(cfg, repo)
    assert any(n.note_id == meta.note_id for n in notes)

    meta2 = append_note(cfg, repo, note_id=meta.note_id, body_md="world")
    assert meta2.note_id == meta.note_id

    m, txt = read_note(cfg, repo, note_id=meta.note_id)
    assert "Test Note" in txt
    assert "hello" in txt
    assert "world" in txt
