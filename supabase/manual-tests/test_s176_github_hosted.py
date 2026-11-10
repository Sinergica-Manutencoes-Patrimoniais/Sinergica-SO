"""Testa somente validações locais do modo GitHub; não inicia Docker."""
import importlib.util
import json
import os
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("s176_recorte", Path(__file__).with_name("E01-S176_recorte_do_zero.py"))
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class TesteGithubHosted(unittest.TestCase):
    def test_ambiente_invalido_falha_antes_do_docker(self):
        with patch.dict(os.environ, {"GITHUB_ACTIONS": "false", "RUNNER_ENVIRONMENT": "github-hosted"}, clear=True), patch.object(mod.platform, "system", return_value="Linux"), patch.object(mod, "docker") as docker:
            with self.assertRaises(RuntimeError):
                mod.preparar_github_hosted()
            docker.assert_not_called()

    def test_contexto_remoto_e_recusado(self):
        env = {"GITHUB_ACTIONS": "true", "RUNNER_ENVIRONMENT": "github-hosted"}
        contexto = json.dumps([{"Endpoints": {"docker": {"Host": "tcp://remoto:2375"}}}])
        with patch.dict(os.environ, env, clear=True), patch.object(mod.platform, "system", return_value="Linux"), patch.object(mod, "docker", side_effect=["default", contexto]):
            with self.assertRaises(RuntimeError):
                mod.preparar_github_hosted()

    def test_ambiente_local_valido_devolve_raiz(self):
        env = {"GITHUB_ACTIONS": "true", "RUNNER_ENVIRONMENT": "github-hosted"}
        contexto = json.dumps([{"Endpoints": {"docker": {"Host": "unix:///var/run/docker.sock"}}}])
        info = json.dumps({"OSType": "linux", "DockerRootDir": "/var/lib/docker"})
        with patch.dict(os.environ, env, clear=True), patch.object(mod.platform, "system", return_value="Linux"), patch.object(mod, "docker", side_effect=["default", contexto, info]), patch.object(mod.os.path, "isdir", return_value=True):
            self.assertEqual(mod.preparar_github_hosted(), os.path.realpath("/var/lib/docker"))


if __name__ == "__main__":
    unittest.main()
