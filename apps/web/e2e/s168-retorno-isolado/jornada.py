"""Jornada HTTP parcial AC5, chamada apenas por bootstrap descartável atestado.

Não inicia serviços nem faz limpeza: o chamador deve destruir o clone mesmo após falha.
A origem prévia é sintética, não comprova geração real da OS nem coleta Auvo.
"""
import json
import secrets
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
CLIENTE = "16891000-0000-4000-8000-000000000002"
RETORNO = "16891000-0000-4000-8000-000000000018"
RESPOSTA = "16891000-0000-4000-8000-000000000019"
ATOR = "16891000-0000-4000-8000-000000000001"


def executar(sql, query, request, auth_url, rest_url, storage_url, anon, watchdog):
    """Exige Auth com hook JWT, PostgREST schema pcm e Storage em rede interna.

    request(url, method, headers, bytes) retorna (status, bytes). SQL nunca recebe
    dados pessoais: senha aleatória sintética fica apenas em memória/clone efêmero.
    """
    senha = secrets.token_hex(24) + "aA1!"
    origem = (ROOT / "supabase/tests/manual_E01-S168_origem_http_sintetica.sql").read_bytes()
    setup = ("\nupdate auth.users set encrypted_password=crypt('" + senha + "',gen_salt('bf')),email_confirmed_at=now(),confirmation_token='',recovery_token='',email_change='',email_change_token_new='' where id='" + ATOR + "';\n"
             "update pcm.validacao_os_gate set habilitado=true where id;\n"
             "update pcm.sso_upload_evidencia_resposta_gate set habilitado=true where id;\n"
             "update pcm.sso_classificacao_retorno_mediada_gate set leitura=true,escrita=true where id;\n"
             "update pcm.sso_revisao_validacao_os_gate set habilitado=true where id;\n"
             "update pcm.sso_mediacao_decisao_retorno_gate set habilitado=true where id;\n")
    sql(b"set local search_path=public,extensions;\n" + origem + setup.encode(), "origem sintética AC5 HTTP")
    if watchdog.is_set(): raise RuntimeError("Monitor interrompeu jornada AC5")
    status, body = request(auth_url + "/token?grant_type=password", "POST", {"apikey": anon, "Content-Type": "application/json"}, json.dumps({"email":"s168-fechamento@example.test","password":senha}).encode())
    if status != 200: raise RuntimeError("Login sintético AC5 falhou: " + str(status))
    token = json.loads(body).get("access_token")
    if not isinstance(token, str) or not token: raise RuntimeError("Login sem token")
    headers = {"apikey": anon, "Authorization": "Bearer " + token}
    nome = CLIENTE + "/" + RETORNO + "/" + str(uuid.uuid4())
    objeto = storage_url + "/object/sso-retorno-evidencias/" + nome
    png = bytes([137,80,78,71,13,10,26,10,0,0,0,0])
    status, _ = request(objeto, "POST", {**headers, "Content-Type":"image/png", "x-upsert":"false"}, png)
    if status not in (200, 201): raise RuntimeError("Upload autenticado AC5 falhou: " + str(status))
    def rpc(nome_rpc, payload):
        return request(rest_url + "/rpc/" + nome_rpc, "POST", {**headers, "Content-Type":"application/json", "Accept-Profile":"pcm", "Content-Profile":"pcm"}, json.dumps(payload).encode())
    status, body = rpc("sso_resolver_upload_resposta_mediada", {"p_cliente_id":CLIENTE,"p_retorno_id":RETORNO,"p_caminho":nome})
    if status != 200 or json.loads(body) is not True: raise RuntimeError("Objeto não foi confirmado")
    pedido = {"p_request_id":str(uuid.uuid4()),"p_cliente_id":CLIENTE,"p_retorno_id":RETORNO,"p_expected_revision":0,"p_resposta_id":RESPOSTA,"p_caminho":nome,"p_justificativa":"Evidência sintética"}
    status, body = rpc("sso_registrar_upload_resposta_mediada", pedido)
    if status != 200: raise RuntimeError("Associação de evidência falhou: " + str(status))
    recibo = json.loads(body)
    if recibo.get("requestId") != pedido["p_request_id"] or recibo.get("revision") != 1 or recibo.get("autenticidadeConteudoComprovada") is not False: raise RuntimeError("Recibo de evidência divergente")
    status, body = rpc("sso_registrar_upload_resposta_mediada", pedido)
    if status != 200 or json.loads(body) != recibo: raise RuntimeError("Replay de evidência divergente")
    decisao = {"p_request_id":str(uuid.uuid4()),"p_cliente_id":CLIENTE,"p_retorno_id":RETORNO,"p_expected_revision":0,"p_decisao":"devolver","p_motivo":"Revisão sintética"}
    status, body = rpc("sso_decidir_retorno_mediado", decisao)
    if status != 200: raise RuntimeError("Decisão autenticada falhou: " + str(status))
    resultado = json.loads(body)
    if resultado.get("requestId") != decisao["p_request_id"] or resultado.get("retornoId") != RETORNO or resultado.get("revision") != 1: raise RuntimeError("Recibo de decisão divergente")
    status, body = rpc("sso_decidir_retorno_mediado", decisao)
    if status != 200 or json.loads(body) != resultado: raise RuntimeError("Replay de decisão divergente")
    sem_motivo = {**decisao, "p_request_id":str(uuid.uuid4()), "p_expected_revision":1, "p_decisao":"reabrir", "p_motivo":""}
    status, body = rpc("sso_decidir_retorno_mediado", sem_motivo)
    if status != 400 or json.loads(body).get("code") != "22023": raise RuntimeError("Reabertura sem motivo não foi recusada")
    reabrir = {**sem_motivo, "p_request_id":str(uuid.uuid4()), "p_motivo":"Correção sintética"}
    status, body = rpc("sso_decidir_retorno_mediado", reabrir)
    if status != 200: raise RuntimeError("Reabertura autenticada falhou: " + str(status))
    reaberta = json.loads(body)
    if reaberta.get("requestId") != reabrir["p_request_id"] or reaberta.get("retornoId") != RETORNO or reaberta.get("revision") != 2: raise RuntimeError("Recibo de reabertura divergente")
    status, body = rpc("sso_decidir_retorno_mediado", reabrir)
    if status != 200 or json.loads(body) != reaberta: raise RuntimeError("Replay de reabertura divergente")
    sql(("update config.sso_concessoes set ativa=false where usuario_id='" + ATOR + "' and cliente_id='" + CLIENTE + "' and acao='execucao.validar';").encode(), "revogação sintética AC5")
    if query("select count(*) from config.sso_concessoes where usuario_id='" + ATOR + "' and cliente_id='" + CLIENTE + "' and acao='execucao.validar' and ativa") != "0": raise RuntimeError("Revogação não confirmada")
    status, _ = rpc("sso_decidir_retorno_mediado", decisao)
    if status != 403: raise RuntimeError("Replay após revogação não recusado: " + str(status))
    nome_negado = CLIENTE + "/" + RETORNO + "/" + str(uuid.uuid4())
    status, body = rpc("sso_autorizar_upload_evidencia_resposta", {"p_nome": nome_negado})
    if status != 200 or json.loads(body) is not False: raise RuntimeError("Predicado após revogação não negou acesso")
    outro = storage_url + "/object/sso-retorno-evidencias/" + nome_negado
    status, body = request(outro, "POST", {**headers, "Content-Type":"image/png", "x-upsert":"false"}, png)
    try: erro = json.loads(body)
    except (ValueError, TypeError): raise RuntimeError("Recusa do Storage inconclusiva") from None
    if status not in (400, 403) or not isinstance(erro, dict) or "row-level security" not in str(erro.get("message", "")).lower():
        raise RuntimeError("Recusa do Storage não identifica política RLS")
    if query("select count(*) from storage.objects where bucket_id='sso-retorno-evidencias' and name='" + nome_negado + "'") != "0": raise RuntimeError("Objeto negado foi gravado")
    if query("select count(*) from pcm.sso_uploads_evidencia_resposta where retorno_id='" + RETORNO + "'") != "1": raise RuntimeError("Evidência ausente ou duplicada")
    if query("select count(*) from pcm.sso_revisoes_validacao_os where retorno_id='" + RETORNO + "'") != "2": raise RuntimeError("Decisões ausentes ou duplicadas")
    if watchdog.is_set(): raise RuntimeError("Monitor interrompeu jornada AC5")
    print("AC5 parcial: login, upload, associação, devolver, reabrir, replays e revogação verificados; clone deve ser descartado.", flush=True)
