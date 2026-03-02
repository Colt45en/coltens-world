import json
import tempfile
import unittest
from pathlib import Path

from packages.core.policy import PolicyConfig
from packages.drivers.fs_local.rules import apply_ruleset
from packages.drivers.fs_local.undo import UndoJournal, undo_last


class TestRulesAndUndo(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.cfg = PolicyConfig(
            allowed_roots=[self.root], allowed_domains=[], allow_destructive=True
        )
        self.journal = UndoJournal(self.root / "undo.jsonl")

        # Files
        (self.root / "a.pdf").write_bytes(b"%PDF-1.7 fake")
        (self.root / "img.png").write_bytes(b"\x89PNG\r\n\x1a\n")
        (self.root / "log.txt").write_text(
            "something ERROR happened\n", encoding="utf-8"
        )
        (self.root / "keep.txt").write_text("hello world\n", encoding="utf-8")

        self.rules = self.root / "rules.json"
        ruleset = {
            "version": "fs-rules.v1",
            "rules": [
                {
                    "name": "pdf",
                    "priority": 10,
                    "when": {"glob": "**/*.pdf"},
                    "then": {"move_to": "_sorted/PDF", "rename": "{stem}{ext}"},
                },
                {
                    "name": "img",
                    "priority": 20,
                    "when": {"ext_in": ["png"]},
                    "then": {"move_to": "_sorted/Images"},
                },
                {
                    "name": "errlog",
                    "priority": 30,
                    "when": {"ext_in": ["txt"], "contains_text": "error"},
                    "then": {"copy_to": "_sorted/Logs"},
                },
            ],
        }
        self.rules.write_text(json.dumps(ruleset), encoding="utf-8")

    def tearDown(self):
        self.tmp.cleanup()

    def test_apply_and_undo(self):
        # dry run
        r = apply_ruleset(
            self.cfg, self.root, self.rules, dry_run=True, undo=self.journal
        )
        self.assertTrue(r["ok"])
        self.assertEqual(r["ops"], 3)
        # journal should still have ops even in dry_run? We currently append even dry_run.
        # For safety, journal should only record real changes; so we expect 0.
        # If this fails, adjust implementation.
        self.assertEqual(len(self.journal.read_all()), 0)

        # apply
        apply_ruleset(self.cfg, self.root, self.rules, dry_run=False, undo=self.journal)
        self.assertTrue((self.root / "_sorted" / "PDF" / "a.pdf").exists())
        self.assertTrue((self.root / "_sorted" / "Images" / "img.png").exists())
        self.assertTrue((self.root / "_sorted" / "Logs" / "log.txt").exists())
        self.assertTrue((self.root / "log.txt").exists())  # copied
        ops = self.journal.read_all()
        self.assertGreaterEqual(len(ops), 3)

        # undo last 3 operations
        res = undo_last(self.cfg, self.journal, steps=3, dry_run=False)
        self.assertGreaterEqual(res.undone, 2)

        # moved files should be back
        self.assertTrue((self.root / "a.pdf").exists())
        self.assertTrue((self.root / "img.png").exists())
        # copied file should be removed
        self.assertFalse((self.root / "_sorted" / "Logs" / "log.txt").exists())


if __name__ == "__main__":
    unittest.main()
