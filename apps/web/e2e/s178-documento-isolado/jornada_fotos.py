"""Fotos sintéticas em clone documental isolado; requer Storage e Auth reais."""
import json
import secrets
import struct
import zlib
import threading
import time
import uuid

A="18120000-0000-4000-8000-000000000011"
B="18120000-0000-4000-8000-000000000012"
C="18120000-0000-4000-8000-000000000021"
L="18120000-0000-4000-8000-000000000041"
S="18120000-0000-4000-8000-000000000031"
def chunk(tipo, dados):
    return struct.pack(">I",len(dados))+tipo+dados+struct.pack(">I",zlib.crc32(tipo+dados)&0xffffffff)

PNG=(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR",struct.pack(">IIBBBBB",1,1,8,2,0,0,0))
     + chunk(b"IDAT",zlib.compress(b"\x00\x00\x00\x00")) + chunk(b"IEND",b""))

def executar(sql, query, request, auth, storage, edges, gateway, anon, service, barreira, watchdog):
    senha=secrets.token_hex(24)+"aA1!"
    sql(("set local app.auvo_sync_write='true'; set local search_path=public,extensions; update auth.users set encrypted_password=crypt('"+senha+"',gen_salt('bf')) where id in ('"+A+"','"+B+"');"
       "insert into pcm.areas(id,cliente_id,nome) values ('18130000-0000-4000-8000-000000000001','"+C+"','Área foto');"
       "insert into pcm.locais(id,area_id,nome) values ('18130000-0000-4000-8000-000000000002','18130000-0000-4000-8000-000000000001','Local foto');"
       "insert into pcm.equipamento_categorias(id,nome) values ('18130000-0000-4000-8000-000000000003','Categoria foto');"
       "insert into pcm.grupos_quantitativos(id,cliente_id,local_id,categoria_id,nome,quantidade,created_by,updated_by) values ('18130000-0000-4000-8000-000000000004','"+C+"','18130000-0000-4000-8000-000000000002','18130000-0000-4000-8000-000000000003','Grupo foto',1,'"+A+"','"+A+"');"
       "insert into pcm.equipamentos(id,client_id,nome,tipo,created_by) values ('18130000-0000-4000-8000-000000000005','"+C+"','Equipamento foto','equipamento','"+A+"');"
       "update pcm.sso_fotos_levantamento_gate set habilitado=true where id; update pcm.sso_foto_staging_ativo_gate set habilitado=true where id; update pcm.sso_foto_staging_grupo_gate set habilitado=true where id; update pcm.sso_foto_grupo_mediada_gate set habilitado=true where id; update pcm.sso_foto_equipamento_gate set habilitado=true where id;").encode(),"origem fotos sintéticas")
    vinculos=[]
    for tipo in ("sistema","grupo","equipamento"):
        chave=str(uuid.uuid4());caminho=C+"/"+L+"/"+chave
        st,_=request(storage+"/object/sso-levantamento-fotos/"+caminho,"POST",{"Authorization":"Bearer "+service,"apikey":service,"Content-Type":"image/png","x-upsert":"false"},PNG)
        if st not in (200,201):raise RuntimeError("Storage foto sintética falhou: "+str(st))
        obj=query("select id::text from storage.objects where bucket_id='sso-levantamento-fotos' and name='"+caminho+"'").strip()
        try: obj=str(uuid.UUID(obj))
        except ValueError: raise RuntimeError("Objeto foto ausente") from None
        foto=str(uuid.uuid4());vinculo=str(uuid.uuid4());vinculos.append(vinculo)
        alvo=S if tipo=="sistema" else ("18130000-0000-4000-8000-000000000004" if tipo=="grupo" else "18130000-0000-4000-8000-000000000005")
        insert=("insert into pcm.sso_fotos_levantamento(id,cliente_id,lote_id,linha_chave,objeto_id,ator_id,request_id) values ('"+foto+"','"+C+"','"+L+"','linha','"+obj+"','"+A+"','"+str(uuid.uuid4())+"');"
            "insert into pcm.sso_decisoes_foto_levantamento(foto_id,revisao,decisao,motivo,ator_id,request_id) values ('"+foto+"',1,'aceita','Foto sintética','"+A+"','"+str(uuid.uuid4())+"');")
        if tipo=="grupo":insert += "insert into pcm.sso_foto_staging_grupo(id,foto_id,grupo_id,cliente_id,decisao_revision,ator_id,request_id) values ('"+vinculo+"','"+foto+"','"+alvo+"','"+C+"',1,'"+A+"','"+str(uuid.uuid4())+"');"
        else:insert += "insert into pcm.sso_foto_staging_ativo(id,foto_id,tipo,entidade_id,cliente_id,decisao_revision,ator_id,request_id) values ('"+vinculo+"','"+foto+"','"+tipo+"','"+alvo+"','"+C+"',1,'"+A+"','"+str(uuid.uuid4())+"');"
        sql(insert.encode(),"vínculo foto sintética")
    def login(email):
        status,body=request(auth+"/token?grant_type=password","POST",{"apikey":anon,"Content-Type":"application/json"},json.dumps({"email":email,"password":senha}).encode())
        if status!=200:raise RuntimeError("Login foto sintética falhou: "+str(status))
        token=json.loads(body).get("access_token")
        if not isinstance(token,str):raise RuntimeError("Token foto ausente")
        return token
    b=login("documento-b@example.test")
    for tipo,vinculo in zip(("sistema","grupo","equipamento"),vinculos):
        a=login("documento-a@example.test")
        def obter(token):return request(edges[tipo]+"/","POST",{"Authorization":"Bearer "+token,"apikey":anon,"Content-Type":"application/json"},json.dumps({"vinculoId":vinculo}).encode())
        st,body=obter(a)
        if st!=200 or body!=PNG:raise RuntimeError("Foto autorizada divergente: "+tipo+" HTTP "+str(st))
        st,_=obter(b)
        if st!=404:raise RuntimeError("Cliente cruzado não negado: "+tipo+" HTTP "+str(st))
        control={"x-barreira":barreira}
        if request(gateway+"/__barreira/armar","POST",control,b"")[0]!=204:raise RuntimeError("Barreira foto não armada")
        result=[];errors=[]
        def leitura():
            try:result.append(obter(a))
            except Exception:errors.append(True)
        thread=threading.Thread(target=leitura,daemon=True);thread.start()
        try:
            for _ in range(100):
                if watchdog.is_set():raise RuntimeError("Monitor interrompeu fotos")
                status_barreira=request(gateway+"/__barreira/status","POST",control,b"")[0]
                if status_barreira==204:break
                if result: raise RuntimeError("Foto encerrou antes da barreira: "+tipo+" HTTP "+str(result[0][0]))
                if errors: raise RuntimeError("Transporte falhou antes da barreira: "+tipo)
                time.sleep(.1)
            else:raise RuntimeError("Foto não atingiu barreira: "+tipo+" status "+str(status_barreira))
            sql(("delete from auth.sessions where user_id='"+A+"';").encode(),"revogação foto sintética")
            if query("select count(*) from auth.sessions where user_id='"+A+"'").strip()!="0":raise RuntimeError("Sessão foto não revogada")
        finally:
            try:
                request(gateway+"/__barreira/liberar","POST",control,b"")
            finally:
                thread.join(timeout=45)
                if thread.is_alive(): raise RuntimeError("Leitura de foto não encerrou: "+tipo)
        if thread.is_alive() or errors or not result:raise RuntimeError("Revogação foto inconclusiva: "+tipo)
        if result[0][0]!=401:raise RuntimeError("Revogação foto não comprovada: "+tipo+" HTTP "+str(result[0][0]))
    print("Fotos sintéticas: bytes, Cliente cruzado e revogação verificados nas três rotas.",flush=True)
