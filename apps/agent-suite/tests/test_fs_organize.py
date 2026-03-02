from pathlib import Path

from packages.core.policy import default_policy
from packages.drivers.fs_local.organize import (
    mkdir,
    list_dir,
    find_by_name,
    find_by_content,
    read_text_file,
    move_path,
    copy_path,
    rename_path,
    organize_by_extension,
)


def test_fs_find_read_move_copy(tmp_path):
    repo = tmp_path / "repo"
    (repo / "sandbox").mkdir(parents=True)
    cfg = default_policy(repo)

    root = repo / "sandbox" / "docs"
    mkdir(cfg, root)

    a = root / "a.txt"
    b = root / "b.md"
    a.write_text("hello invoice world", encoding="utf-8")
    b.write_text("# Title\nnotes", encoding="utf-8")

    entries = list_dir(cfg, root, recursive=False)
    assert any(e.name == "a.txt" for e in entries)

    hits = find_by_name(cfg, root, pattern="*.md", recursive=True)
    assert any(h.path.endswith("b.md") for h in hits)

    gh = find_by_content(cfg, root, needle="invoice", recursive=True)
    assert any(h.path.endswith("a.txt") for h in gh)

    txt = read_text_file(cfg, a, max_chars=1000)
    assert "invoice" in txt

    dst_dir = root / "Archive"
    mkdir(cfg, dst_dir)
    moved = move_path(cfg, a, dst_dir / "a.txt", overwrite=False)
    assert Path(moved).exists()

    copied = copy_path(cfg, b, dst_dir / "b.md", overwrite=True)
    assert Path(copied).exists()

    renamed = rename_path(cfg, dst_dir / "b.md", new_name="b2.md", overwrite=True)
    assert Path(renamed).exists()


def test_fs_organize_by_extension_dryrun(tmp_path):
    repo = tmp_path / "repo"
    (repo / "sandbox").mkdir(parents=True)
    cfg = default_policy(repo)

    dl = repo / "sandbox" / "dl"
    mkdir(cfg, dl)
    (dl / "x.txt").write_text("x", encoding="utf-8")
    (dl / "y.md").write_text("y", encoding="utf-8")

    rep = organize_by_extension(cfg, dl, recursive=False, dry_run=True)
    assert any(
        dst.endswith("\\txt\\x.txt") or dst.endswith("/txt/x.txt")
        for _, dst in rep.moves
    )
    assert any(
        dst.endswith("\\md\\y.md") or dst.endswith("/md/y.md") for _, dst in rep.moves
    )
