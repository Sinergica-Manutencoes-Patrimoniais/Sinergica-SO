"""Jornada HTTP parcial AC5, chamada apenas por bootstrap descartável atestado.

Não inicia serviços nem faz limpeza: o chamador deve destruir o clone mesmo após falha.
A origem prévia é sintética, não comprova geração real da OS nem coleta Auvo.
"""
import base64
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
             "update config.usuarios set papel='colaborador' where user_id='" + ATOR + "';\n"
             "insert into config.usuario_modulos(user_id,modulo,nivel) values('" + ATOR + "','pcm','escrita');\n"
             "update pcm.validacao_os_gate set habilitado=true where id;\n"
             "update pcm.sso_upload_evidencia_resposta_gate set habilitado=true where id;\n"
             "update pcm.sso_validacao_resposta_gate set habilitado=true where id;\n"
             "update pcm.origem_campo_inbox_gate set habilitado=true where id;\n"
             "update pcm.sso_conferencia_cobertura_retorno_gate set habilitado=true where id;\n"
             "update pcm.sso_condicao_retorno_gate set habilitado=true where id;\n"
             "update pcm.sso_condicao_evidencia_gate set habilitado=true where id;\n"
             "update pcm.sso_atestacao_pcm_gate set habilitado=true where id;\n"
             "update pcm.sso_pendencias_gate set habilitado=true where id;\n"
             "update pcm.clientes set auvo_id=168910001 where id='" + CLIENTE + "';\n"
             "update pcm.ordens_servico set auvo_task_id=168910002 where id='16891000-0000-4000-8000-000000000017';\n"
             "insert into pcm.origem_campo_inbox(id,integracao,task_id,chave_evento,cliente_externo_id,payload) values ('16891000-0000-4000-8000-000000000035','auvo',168910002,'origem-sintetica-http','168910001','{}');\n"
             "insert into pcm.origem_campo_resolucoes(id,envelope_id,cliente_id,os_id,resultado) values ('16891000-0000-4000-8000-000000000036','16891000-0000-4000-8000-000000000035','" + CLIENTE + "','16891000-0000-4000-8000-000000000017','os_identificada');\n"
             "insert into pcm.retorno_campo_classificacoes(envelope_id,resolucao_id,retorno_id,request_id,ator_id,payload) values ('16891000-0000-4000-8000-000000000035','16891000-0000-4000-8000-000000000036','" + RETORNO + "','16891000-0000-4000-8000-000000000037','" + ATOR + "','{}');\n"
             "update pcm.sso_classificacao_retorno_mediada_gate set leitura=true,escrita=true where id;\n"
             "update pcm.sso_revisao_validacao_os_gate set habilitado=true where id;\n"
             "update pcm.sso_mediacao_decisao_retorno_gate set habilitado=true where id;\n")
    sql(b"set local search_path=public,extensions;\n" + origem + setup.encode(), "origem sintética AC5 HTTP")
    if query("select count(*) from config.usuarios u join config.usuario_modulos m on m.user_id=u.user_id where u.user_id='" + ATOR + "' and u.ativo and u.papel='colaborador' and m.modulo='pcm' and m.nivel='escrita'") != "1":
        raise RuntimeError("Ator sintético sem perfil esperado")
    if watchdog.is_set(): raise RuntimeError("Monitor interrompeu jornada AC5")
    status, body = request(auth_url + "/token?grant_type=password", "POST", {"apikey": anon, "Content-Type": "application/json"}, json.dumps({"email":"s168-fechamento@example.test","password":senha}).encode())
    if status != 200: raise RuntimeError("Login sintético AC5 falhou: " + str(status))
    token = json.loads(body).get("access_token")
    if not isinstance(token, str) or not token: raise RuntimeError("Login sem token")
    try:
        parte = token.split(".")[1]
        claims = json.loads(base64.urlsafe_b64decode(parte + "=" * (-len(parte) % 4)))
    except (ValueError, IndexError, TypeError): raise RuntimeError("Claims sintéticas inválidas") from None
    if claims.get("sub") != ATOR or claims.get("user_role") != "colaborador" or claims.get("user_modulos", {}).get("pcm") != "escrita":
        raise RuntimeError("Claims não correspondem ao ator sintético PCM")
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
    try: evidencia_id = str(uuid.UUID(recibo["evidenciaId"]))
    except (KeyError, ValueError, TypeError, AttributeError): raise RuntimeError("Identificador de evidência inválido") from None
    if evidencia_id != recibo["evidenciaId"]: raise RuntimeError("Identificador de evidência não canônico")
    for revisao, escolha in enumerate(("rejeitada_pcm", "aceita_pcm")):
        validacao = {"p_request_id":str(uuid.uuid4()), "p_cliente_id":CLIENTE, "p_retorno_id":RETORNO,
                     "p_resposta_id":RESPOSTA, "p_evidencia_id":evidencia_id, "p_expected_decisao":revisao,
                     "p_expected_uploads":1, "p_decisao":escolha, "p_justificativa":"Decisão sintética com motivo"}
        status, body = rpc("sso_validar_resposta_evidencia_mediada", validacao)
        if status != 200: raise RuntimeError("Validação de evidência falhou: " + str(status))
        resultado_validacao = json.loads(body)
        if resultado_validacao.get("requestId") != validacao["p_request_id"] or resultado_validacao.get("revision") != revisao + 1 or resultado_validacao.get("conteudoAutenticado") is not False:
            raise RuntimeError("Recibo de validação de evidência divergente")
        try: uuid.UUID(resultado_validacao["validacaoId"])
        except (KeyError, ValueError, TypeError, AttributeError): raise RuntimeError("Identificador de validação inválido") from None
        status, body = rpc("sso_validar_resposta_evidencia_mediada", validacao)
        if status != 200 or json.loads(body) != resultado_validacao: raise RuntimeError("Replay da validação divergente")
    if query("select count(*) from pcm.sso_validacoes_resposta where resposta_id='" + RESPOSTA + "' and evidencia_id='" + evidencia_id + "' and (revisao=1 and decisao='rejeitada_pcm' or revisao=2 and decisao='aceita_pcm')") != "2":
        raise RuntimeError("Validações de evidência não persistiram")
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
    conferencia = {"p_request_id":str(uuid.uuid4()), "p_cliente_id":CLIENTE, "p_retorno_id":RETORNO,
                   "p_evidencia_id":None, "p_expected_evidencias":0, "p_justificativa":"Conferência sintética"}
    status, body = rpc("sso_conferir_cobertura_mediada", conferencia)
    if status != 200: raise RuntimeError("Conferência autenticada falhou: " + str(status))
    conferida = json.loads(body)
    if conferida.get("requestId") != conferencia["p_request_id"] or conferida.get("retornoId") != RETORNO or conferida.get("coberturaEstrutural") is not True or conferida.get("evidenciaExternaComprovada") is not False:
        raise RuntimeError("Recibo de conferência divergente")
    try: conferencia_id = str(uuid.UUID(conferida["conferenciaId"]))
    except (KeyError, ValueError, TypeError, AttributeError): raise RuntimeError("Identificador de conferência inválido") from None
    aprovacao = {"p_request_id":str(uuid.uuid4()), "p_cliente_id":CLIENTE, "p_retorno_id":RETORNO,
                 "p_conferencia_id":conferencia_id, "p_expected_evidencias":0, "p_expected_decisao":2,
                 "p_justificativa":"Aprovação sintética"}
    status, body = rpc("sso_atestar_aprovar_retorno_mediado", aprovacao)
    if status != 200: raise RuntimeError("Aprovação autenticada falhou: " + str(status))
    aprovada = json.loads(body)
    if aprovada.get("requestId") != aprovacao["p_request_id"] or aprovada.get("retornoId") != RETORNO or aprovada.get("revision") != 3 or aprovada.get("osEncerrada") is not False or aprovada.get("conteudoAutenticado") is not False:
        raise RuntimeError("Recibo de aprovação divergente")
    status, body = rpc("sso_atestar_aprovar_retorno_mediado", aprovacao)
    if status != 200 or json.loads(body) != aprovada: raise RuntimeError("Replay de aprovação divergente")
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
    if query("select count(*) from pcm.sso_revisoes_validacao_os where retorno_id='" + RETORNO + "'") != "3": raise RuntimeError("Decisões ausentes ou duplicadas")
    if watchdog.is_set(): raise RuntimeError("Monitor interrompeu jornada AC5")
    print("AC5 parcial: login, upload, associação, rejeição/aceitação, devolver, reabrir, aprovar, replays e revogação verificados; clone deve ser descartado.", flush=True)
