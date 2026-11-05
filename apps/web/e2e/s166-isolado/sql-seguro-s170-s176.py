#!/usr/bin/env python3
"""Executa somente fixture S170/S176 em clone atestado; não cria serviços.

A fixture ainda não foi fornecida. Este invólucro recusa execução na ausência dela.
Nenhuma credencial, configuração .env ou conexão externa é carregada.
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
BOOT = HERE / "bootstrap-interno.py"
FIXTURE = HERE / "fixture-s170-s176.sql"
PREFIX = "sso-s166-e2e-"


def run(args, data=None):
    try:
        result = subprocess.run(args, input=data, capture_output=True, timeout=30, check=True)
    except (subprocess.SubprocessError, OSError):
        raise RuntimeError("Não foi possível verificar ou acessar o clone descartável.") from None
    return result.stdout


def verificar(ident):
    run([sys.executable, str(BOOT), "verificar", "--id", ident])
    network = PREFIX + ident
    container = network + "-db"
    info = json.loads(run(["rtk", "proxy", "docker", "inspect", "--type", "container", container]))[0]
    rede = json.loads(run(["rtk", "proxy", "docker", "inspect", "--type", "network", network]))[0]
    if (not rede.get("Internal") or rede.get("Ingress") or rede.get("Driver") != "bridge"
        or rede.get("Labels", {}).get("sso.ensaio") != ident
        or info["Config"].get("Labels", {}).get("sso.ensaio") != ident
        or info["HostConfig"].get("NetworkMode") != network
        or info["HostConfig"].get("Privileged") or info["Mounts"]
        or set(info["NetworkSettings"]["Networks"]) != {network}
        or any(info["NetworkSettings"].get("Ports", {}).values())):
        raise RuntimeError("Isolamento do destino não comprovado.")
    return info["Id"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--id", required=True)
    args = parser.parse_args()
    if not re.fullmatch(r"[0-9a-f]{12}", args.id):
        raise RuntimeError("Identificador inválido.")
    if not FIXTURE.is_file():
        raise RuntimeError("Fixture S170/S176 ainda não preparada; nenhuma escrita executada.")
    container_id = verificar(args.id)
    database = "sso_s166_" + args.id
    # A transação aborta antes da fixture quando identidade ou ausência de dados é divergente.
    guard = f"""\\set ON_ERROR_STOP on
begin;
do $$ begin
 if current_database() <> '{database}' or (select count(*) from auth.users) <> 0
    or (select count(*) from pcm.clientes) <> 0 or (select count(*) from vault.secrets) <> 0
    or (select count(*) from pcm.auvo_sync_outbox) <> 0 then
   raise exception 'destino_ou_dados_divergentes';
 end if;
end $$;
""".encode()
    fixture = FIXTURE.read_bytes()
    if re.search(rb"(?im)^\s*(?:begin|commit|rollback)\s*;|^\s*\\(?:connect|c|include|i|ir)\b", fixture):
        raise RuntimeError("Fixture contém comandos de transação ou conexão não permitidos.")
    if verificar(args.id) != container_id:
        raise RuntimeError("Contêiner alterado durante a conferência.")
    # A fixture roda apenas em rollback: ainda não há jornada UI que exija dados persistidos.
    run(["rtk", "proxy", "docker", "exec", "-i", container_id, "psql", "-X", "-U", "supabase_admin",
         "-d", database, "-v", "ON_ERROR_STOP=1", "-q"], guard + fixture + b"\nrollback;\n")
    print("Fixture executada no clone atestado e revertida.")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
