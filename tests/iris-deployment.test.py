"""Deployment entry point only; does not import or modify the independent Iris repo."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET


class DeploymentTests(unittest.TestCase):
    def entry(self):
        filename = Path(__file__).resolve().parents[1] / "deploy/windows/start-iris.py"
        self.assertTrue(filename.is_file(), "Missing isolated Iris deployment entry point")
        spec = importlib.util.spec_from_file_location("iris_cloud_start", filename)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def environment(self):
        return {"OPENAI_API_KEY": "qa-placeholder", "OPENAI_BASE_URL": "https://model.example/v1", "LLM_MODEL": "qa-model"}

    def test_missing_credentials_fail_before_creating_data(self):
        entry = self.entry()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "agent.yaml").write_text("tts: {enabled: false}", encoding="utf-8")
            for key in self.environment():
                values = self.environment()
                values[key] = " "
                with self.assertRaisesRegex(ValueError, key):
                    entry.prepare_runtime(root, values)
                self.assertFalse((root / "data").exists())

    def test_first_start_disables_local_models_and_preserves_changes(self):
        entry = self.entry()
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "agent.yaml").write_text("tts: {enabled: false}", encoding="utf-8")
            entry.prepare_runtime(root, self.environment())
            filename = root / "data/knowledge/runtime.json"
            values = json.loads(filename.read_text(encoding="utf-8"))
            for key in ["embedding_enabled", "semantic_split_enabled", "graph_enabled", "image_enabled", "reranker_enabled"]:
                self.assertIs(values[key], False)
            filename.write_text('{"embedding_enabled": true}', encoding="utf-8")
            entry.prepare_runtime(root, self.environment())
            self.assertEqual(filename.read_text(encoding="utf-8"), '{"embedding_enabled": true}')

    def test_missing_cloud_config_is_rejected(self):
        entry = self.entry()
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaisesRegex(ValueError, "agent.yaml"):
                entry.prepare_runtime(Path(directory), self.environment())

    @unittest.skipUnless(os.name == "nt", "Windows service generator")
    def test_winsw_v2_service_account_uses_supported_low_privilege_fields(self):
        blog = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            iris = root / "iris"
            (iris / ".venv/Scripts").mkdir(parents=True)
            (iris / ".venv/Scripts/python.exe").write_bytes(b"not executed")
            wrapper = root / "wrapper.exe"
            wrapper.write_bytes(b"not executed")
            powershell = Path(os.environ["SystemRoot"]) / "System32/WindowsPowerShell/v1.0/powershell.exe"
            result = subprocess.run([str(powershell), "-NoProfile", "-ExecutionPolicy", "Bypass", "-File",
                str(blog / "deploy/windows/New-ServiceFiles.ps1"), "-IrisRuntime", str(iris),
                "-WinSWExe", str(wrapper), "-CaddyExe", str(wrapper), "-NodeExe", sys.executable,
                "-ServicesDir", str(root / "services")], capture_output=True)
            self.assertEqual(result.returncode, 0, result.stderr.decode(errors="replace"))
            for service in ("blog", "iris", "caddy"):
                account = ET.parse(root / f"services/IrisBlog-{service}.xml").getroot().find("serviceaccount")
                # These are the fields actually consumed by the WinSW v2 parser.
                self.assertEqual(account.findtext("domain"), "NT AUTHORITY")
                self.assertEqual(account.findtext("user"), "LocalService")
                self.assertIsNone(account.find("username"))


if __name__ == "__main__":
    unittest.main()
