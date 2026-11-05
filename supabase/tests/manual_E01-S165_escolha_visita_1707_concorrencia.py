#!/usr/bin/env python3
"""Ensaio destrutivo restrito a clone descartável. Consulte o README correspondente."""
import argparse
import re
import subprocess
import sys
import time
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--container", required=True)
parser.add_argument("--database", required=True)
args = parser.parse_args()
if not args.database.startswith("sso_"):
    parser.error("o banco descartável deve começar com sso_")
root = Path(__file__).resolve().parent
prefix = "manual_E01-S165_escolha_visita_1707_concorrencia_"
base = ["docker", "exec", "-i", "-e", "PGAPPNAME=sso_1707_concorrencia", args.container,
        "psql", "-U", "supabase_admin", "-d", args.database, "-v", "ON_ERROR_STOP=1", "-q", "-t", "-A"]

def run(sql):
    result = subprocess.run(base, input=sql, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()

claims = """set request.jwt.claims = '{"sub":"16610000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}'; set role authenticated;
"""
run((root / (prefix + "setup.sql")).read_text())
files = {}
for name in ("a", "b", "retry"):
    script = (root / (prefix + name + ".sql")).read_text()
    match = re.search(r"f:=(pcm\.sso_comparar_rotina_impacto_v3\(.*?\));", script)
    if not match:
        raise RuntimeError("expressão de fotografia não encontrada: " + name)
    photo = run(claims + "select " + match.group(1) + ";")
    files[name] = script[:match.start()] + "f:=$foto$" + photo + "$foto$::jsonb;" + script[match.end():]

process = subprocess.Popen(base, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
process.stdin.write(files["a"])
process.stdin.close()
try:
    for _ in range(100):
        waiting = run("select count(*) from pg_stat_activity where application_name='sso_1707_concorrencia' and wait_event='PgSleep';")
        if waiting == "1":
            break
        if process.poll() is not None:
            raise RuntimeError("sessão A terminou antes de segurar a trava: " + process.stderr.read())
        time.sleep(0.05)
    else:
        raise RuntimeError("sessão A não alcançou a espera dentro do prazo")
    run(files["b"])
    stdout = process.stdout.read()
    stderr = process.stderr.read()
    if process.wait() != 0:
        raise RuntimeError("sessão A falhou: " + stderr)
    run(files["retry"])
    run(files["a"].replace("select pg_sleep(12);", ""))
    count = run("select count(*) from pcm.sso_escolhas_nova_data_visita where visita_id='16610000-0000-0000-0000-000000000083';")
    if count != "1":
        raise RuntimeError("quantidade de escolhas divergente: " + count)
    print("PASS: trava concorrente, rejeição do retry, replay e uma escolha")
finally:
    if process.poll() is None:
        process.terminate()
        process.wait()
