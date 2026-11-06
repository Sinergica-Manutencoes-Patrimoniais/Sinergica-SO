"""Seleção SQL da CI em clone descartável; não equivale a supabase start."""
import hashlib
import json
import re

MANIFESTO = "supabase/manual-tests/s176_pgtap_ci_manifest.json"
SHA256 = "26e007ccbecac1750467ac889bd394059acf5c542523a6963f4ceedbadaac112"

def preparar(root):
    dados = (root / MANIFESTO).read_bytes()
    if hashlib.sha256(dados).hexdigest() != SHA256: raise RuntimeError("Manifesto pgTAP CI divergente")
    itens = json.loads(dados)["arquivos"]
    nomes = [item["nome"] for item in itens]
    pasta = root / "supabase/tests"
    selecionados = sorted(f.name for f in pasta.glob("*.test.sql")) + ["remote_promotion_smoke.sql"]
    if nomes != selecionados or len(nomes) != len(set(nomes)):
        raise RuntimeError("Seleção pgTAP CI divergente")
    arquivos = []
    for item in itens:
        nome = item["nome"]
        conteudo = (pasta / nome).read_bytes()
        if hashlib.sha256(conteudo).hexdigest() != item["sha256"]: raise RuntimeError("Teste SQL divergente: " + nome)
        if (len(re.findall(rb"(?im)^\s*begin\s*;", conteudo)) != 1
            or len(re.findall(rb"(?im)^\s*rollback\s*;", conteudo)) != 1
            or re.search(rb"(?im)^\s*(?:commit|end transaction)\s*;|^\s*\\", conteudo)):
            raise RuntimeError("Transação ou metacomando inesperado: " + nome)
        plano = item["plano"]
        if not isinstance(plano, int) or plano < 1: raise RuntimeError("Plano TAP inválido: " + nome)
        arquivos.append((nome, conteudo, plano))
    return arquivos
