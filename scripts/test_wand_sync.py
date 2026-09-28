"""Exercise the real plugin and native libraries with stubbed Noita entity APIs.

Run on Windows with a 32-bit LuaJIT 5.1 executable:
    python scripts/test_wand_sync.py --lua path/to/x86/luajit.exe
The 64-bit evaluation runtime in bin/ cannot load Noita's 32-bit mod DLLs.
Port 12345 must be free; this test never connects to an existing game.
"""

import argparse
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import tempfile
import time
import unittest


ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "scripts" / "fixtures" / "wand_sync_host.lua"
LUA_EXECUTABLE = None


class WandSyncStandaloneTests(unittest.TestCase):
    def setUp(self):
        with socket.socket() as probe:
            probe.bind(("127.0.0.1", 12345))
        self.directory = tempfile.TemporaryDirectory(prefix="twwe standalone 游戏 ")
        self.addCleanup(self.directory.cleanup)
        self.game_root = Path(self.directory.name)
        self.plugin = self.game_root / "mods" / "wand_sync"
        shutil.copytree(ROOT / "wand_sync", self.plugin, ignore=shutil.ignore_patterns("cache"))
        self.assertFalse((self.game_root / "mods" / "wand_editor").exists())
        self.log = (self.game_root / "host.log").open("w+b")
        self.addCleanup(self.log.close)

    def start_host(self, **environment):
        self.process = subprocess.Popen(
            [str(LUA_EXECUTABLE), str(FIXTURE)], cwd=self.game_root,
            env={**os.environ, "LUA_PATH": "", "LUA_CPATH": "", **environment},
            stdout=self.log, stderr=subprocess.STDOUT,
        )
        self.addCleanup(self.stop_host)

    def stop_host(self):
        if self.process.poll() is None:
            self.process.terminate()
        self.process.wait(timeout=10)

    def logs(self):
        self.log.flush()
        return (self.game_root / "host.log").read_text(encoding="utf-8", errors="replace")

    def request(self, message):
        with socket.create_connection(("127.0.0.1", 12345), timeout=3) as connection:
            connection.sendall((message + "\n").encode("utf-8"))
            with connection.makefile("r", encoding="utf-8") as response:
                return response.readline().strip()

    def wait_ready(self):
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            if self.process.poll() is not None:
                self.fail(self.logs())
            try:
                information = json.loads(self.request("GET_GAME_INFO"))
                self.assertEqual(information["root"], self.game_root.as_posix())
                return
            except OSError:
                time.sleep(0.05)
        self.fail("Plugin did not listen on port 12345: " + self.logs())

    def test_push_pull_without_wand_editor(self):
        self.start_host()
        self.wait_ready()
        self.assertEqual(self.request("PING"), "OK")
        before = json.loads(self.request("GET_ALL_WANDS"))
        self.assertEqual(before["wands"]["1"]["mana_max"], 321)
        self.assertEqual(before["wands"]["1"]["spells"], {"1": "LIGHT_BULLET"})
        payload = {
            "slot": 1, "mana_max": 987, "fire_rate_wait": 0,
            "shuffle_deck_when_empty": True, "spells": {"2": "BOMB"},
            "always_cast": ["DAMAGE"],
        }
        self.assertEqual(self.request(json.dumps(payload)), "OK")
        after = json.loads(self.request("GET_ALL_WANDS"))["wands"]["1"]
        self.assertEqual(after["mana_max"], 987)
        self.assertEqual(after["fire_rate_wait"], 0)
        self.assertTrue(after["shuffle_deck_when_empty"])
        self.assertEqual(after["spells"], {"2": "BOMB"})
        self.assertEqual(after["always_cast"], ["DAMAGE"])
        self.assertEqual(self.request(json.dumps(payload)), "OK")
        repeated = json.loads(self.request("GET_ALL_WANDS"))["wands"]["1"]
        self.assertEqual(repeated["spells"], {"2": "BOMB"})
        self.assertEqual(repeated["always_cast"], ["DAMAGE"])
        self.assertEqual(self.request('{"slot":1,"delete":true}'), "OK")
        self.assertEqual(json.loads(self.request("GET_ALL_WANDS"))["wands"], {})

    def test_optional_imports_and_mod_environment(self):
        self.start_host()
        self.wait_ready()
        self.assertFalse(json.loads(self.request("GET_WAND_EDITOR_DATA")))
        self.assertFalse(json.loads(self.request("GET_SPELL_LAB_DATA")))
        self.assertEqual(json.loads(self.request("GET_ACTIVE_MODS")), ["wand_sync"])
        self.assertEqual(json.loads(self.request("GET_MOD_APPENDS")), {})
        spells = json.loads(self.request("GET_ALL_SPELLS"))
        self.assertEqual(spells["spells"][0]["id"], "LIGHT_BULLET")
        self.assertEqual(spells["active_mods"], ["wand_sync"])

    def test_no_player_is_a_valid_empty_state(self):
        self.start_host(TWWE_TEST_EMPTY="1")
        self.wait_ready()
        response = json.loads(self.request("GET_ALL_WANDS"))
        self.assertEqual(response["wands"], {})
        self.assertTrue(response["stable"])

    def test_missing_runtime_reports_installation_error(self):
        (self.plugin / "files" / "module" / "vcruntime140.dll").unlink()
        self.start_host()
        self.assertNotEqual(self.process.wait(timeout=10), 0)
        self.assertIn("could not load vcruntime140.dll", self.logs())
        self.assertIn("Copy the entire wand_sync folder", self.logs())

    def test_missing_socket_fails_before_starting_worker(self):
        (self.plugin / "files" / "module" / "socket" / "core.dll").unlink()
        self.start_host()
        self.assertNotEqual(self.process.wait(timeout=10), 0)
        self.assertIn("socket.core", self.logs())
        self.assertNotIn("WAND_SYNC_TEST_READY", self.logs())


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--lua", required=True, type=Path, help="32-bit LuaJIT 5.1 executable")
    options = parser.parse_args()
    LUA_EXECUTABLE = options.lua.resolve(strict=True)
    unittest.main(argv=[__file__], verbosity=2)
