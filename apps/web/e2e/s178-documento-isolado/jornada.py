"""Ensaio documental sintético; só deve rodar em clone descartável e rede interna."""
import base64
import hashlib
import json
import secrets
import threading
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
ATOR_A = "18120000-0000-4000-8000-000000000011"
ATOR_B = "18120000-0000-4000-8000-000000000012"
CLIENTE = "18120000-0000-4000-8000-000000000021"
LOTE = "18120000-0000-4000-8000-000000000041"
VINCULO = "18120000-0000-4000-8000-000000000081"
PDF = b"%PDF-1.4\n% SSO sintetico\n%%EOF\n"

def executar(sql, query, request, auth, storage, edge, gateway, anon, service, barreira, watchdog):
    origem = (ROOT / "supabase/tests/manual_E01-S178_documento_mediado_1812.sql").read_bytes()
    if hashlib.sha256(origem).hexdigest() != "2eb51f7cd15cd7725d3a1b5fb5f463aeeef4f3e0b2ed357e1d9b78b697fa8025":
        raise RuntimeError("Fixture documental divergente")
    texto = origem.decode("utf-8")
    parte = "set local app.auvo_sync_write='true';" + texto.split("set local app.auvo_sync_write='true';", 1)[1].split("set local role authenticated;", 1)[0]
    inicio, resto = parte.split("insert into storage.objects", 1)
    _, resto = resto.split(";", 1)
    senha = secrets.token_hex(24) + "aA1!"
    sql(("set local search_path=public,extensions;\n" + inicio + "\nupdate auth.users set encrypted_password=crypt('" + senha + "',gen_salt('bf')),email_confirmed_at=now(),confirmation_token='',recovery_token='',email_change='',email_change_token_new='' where id in ('" + ATOR_A + "','" + ATOR_B + "');").encode(), "atores documento sintético")
    caminho = CLIENTE + "/" + LOTE + "/18120000-0000-4000-8000-000000000051"
    status, _ = request(storage + "/object/sso-levantamento-documentos/" + caminho, "POST", {"Authorization":"Bearer " + service,"apikey":service,"Content-Type":"application/pdf","x-upsert":"false"}, PDF)
    if status not in (200,201): raise RuntimeError("Upload PDF sintético falhou: " + str(status))
    objeto = query("select id::text from storage.objects where bucket_id='sso-levantamento-documentos' and name='" + caminho + "'").strip()
    import uuid
    try: objeto = str(uuid.UUID(objeto))
    except ValueError: raise RuntimeError("Objeto Storage sintético ausente") from None
    resto = resto.replace("'18120000-0000-4000-8000-000000000051'", "'" + objeto + "'")
    sql(("set local search_path=public,extensions;\n" + resto).encode(), "vínculo documento sintético")
    def login(email, ator):
        status, corpo = request(auth + "/token?grant_type=password", "POST", {"apikey":anon,"Content-Type":"application/json"}, json.dumps({"email":email,"password":senha}).encode())
        if status != 200: raise RuntimeError("Login documento sintético falhou: " + str(status))
        token = json.loads(corpo).get("access_token")
        if not isinstance(token,str): raise RuntimeError("Token sintético ausente")
        parte = token.split(".")[1]; claims = json.loads(base64.urlsafe_b64decode(parte + "=" * (-len(parte)%4)))
        if claims.get("sub") != ator or claims.get("user_role") != "colaborador" or claims.get("user_modulos",{}).get("pcm") != "leitura": raise RuntimeError("Claims documento divergentes")
        return token
    a = login("documento-a@example.test",ATOR_A); b = login("documento-b@example.test",ATOR_B)
    def obter(token):
        return request(edge + "/", "POST", {"Authorization":"Bearer " + token,"apikey":anon,"Content-Type":"application/json"}, json.dumps({"vinculoId":VINCULO}).encode())
    status, conteudo = obter(a)
    if status != 200 or conteudo != PDF: raise RuntimeError("Documento autorizado ou bytes divergentes: " + str(status))
    status, _ = obter(b)
    if status != 404: raise RuntimeError("Cliente cruzado não recusado: " + str(status))
    controle = {"x-barreira":barreira}
    if request(gateway + "/__barreira/armar", "POST", controle, b"")[0] != 204: raise RuntimeError("Barreira não armada")
    resultado = []; erros = []
    def chamada():
        try: resultado.append(obter(a))
        except Exception: erros.append(True)
    thread = threading.Thread(target=chamada, daemon=True); thread.start()
    try:
        for _ in range(100):
            if watchdog.is_set(): raise RuntimeError("Monitor interrompeu jornada")
            if request(gateway + "/__barreira/status", "POST", controle, b"")[0] == 204: break
            time.sleep(.1)
        else: raise RuntimeError("Download não atingiu barreira")
        sql(("delete from auth.sessions where user_id='" + ATOR_A + "';").encode(), "revogação sessão sintética")
        if query("select count(*) from auth.sessions where user_id='" + ATOR_A + "'").strip() != "0": raise RuntimeError("Sessão sintética não revogada")
    finally:
        try:
            request(gateway + "/__barreira/liberar", "POST", controle, b"")
        finally:
            thread.join(timeout=45)
            if thread.is_alive(): raise RuntimeError("Leitura documental não encerrou")
    if thread.is_alive() or erros or not resultado: raise RuntimeError("Resultado de revogação inconclusivo")
    if resultado[0][0] != 401: raise RuntimeError("Revogação não comprovada: HTTP " + str(resultado[0][0]))
    print("Documento Edge sintético: PDF, Cliente cruzado e revogação durante download verificados.", flush=True)
