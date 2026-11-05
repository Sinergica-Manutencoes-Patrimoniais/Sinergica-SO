"""Controle de sessões para ensaios concorrentes no clone exclusivo do harness."""
import os
import re
import selectors
import subprocess
import time


class Sessao:
    """Uma conexão psql; cada comando termina com marcador e SQLSTATE explícito."""

    def __init__(self, container):
        self.processo = subprocess.Popen(
            ["rtk", "proxy", "docker", "exec", "-i", container, "psql", "-X", "-qAt",
             "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=0"],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            bufsize=0,
        )
        self.seletor = selectors.DefaultSelector()
        self.seletor.register(self.processo.stdout, selectors.EVENT_READ)
        self.pendente = b""
        self.sequencia = 0

    def comando(self, sql, estados=("00000",), prazo=10):
        self.sequencia += 1
        marcador = f"SSO_CONCORRENCIA_{self.sequencia}_"
        self.processo.stdin.write((sql + "\n\\echo " + marcador + ":SQLSTATE\n").encode())
        limite = time.monotonic() + prazo
        while True:
            match = re.search(marcador.encode() + rb"([A-Z0-9]{5})\r?\n", self.pendente)
            if match:
                estado = match.group(1).decode()
                self.pendente = self.pendente[match.end():]
                if estado not in estados:
                    raise RuntimeError("SQLSTATE inesperado em sessão concorrente: " + estado)
                return estado
            restante = limite - time.monotonic()
            if restante <= 0 or not self.seletor.select(restante):
                raise RuntimeError("Prazo da sessão concorrente excedido")
            dados = os.read(self.processo.stdout.fileno(), 65536)
            if not dados:
                raise RuntimeError("Sessão concorrente encerrou antes do marcador")
            self.pendente += dados
            if len(self.pendente) > 1024 * 1024:
                raise RuntimeError("Saída da sessão excedeu limite")

    def fechar(self):
        self.processo.terminate()
        try:
            self.processo.wait(timeout=5)
        except subprocess.TimeoutExpired:
            self.processo.kill()
            self.processo.wait(timeout=5)
        self.seletor.close()


def executar(container, watchdog):
    """Executa as duas ordens parciais; chamador deve descartar o clone integralmente."""
    a = Sessao(container)
    b = None
    try:
        b = Sessao(container)
        if watchdog.is_set():
            raise RuntimeError("Monitor interrompeu o ensaio")
        a.comando("set app.auvo_sync_write='true';")
        a.comando("""do $$ begin
          insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
          values ('17900000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin-concorrencia-1790@test.local',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
          insert into config.usuarios(user_id,papel,nome,ativo) values ('17900000-0000-0000-0000-000000000001','superadmin','Admin sintético',true);
          insert into pcm.clientes(id,nome,ativo,created_by) values
          ('176a0000-0000-0000-0000-00000000000a','Cliente A',true,'17900000-0000-0000-0000-000000000001'),
          ('176a0000-0000-0000-0000-00000000000b','Cliente B',true,'17900000-0000-0000-0000-000000000001');
          insert into pcm.sistemas(id,cliente_id,nome) values ('176a0000-0000-0000-0000-000000000051','176a0000-0000-0000-0000-00000000000a','Sistema A');
          insert into pcm.equipamentos(id,client_id,nome) values ('176a0000-0000-0000-0000-000000000011','176a0000-0000-0000-0000-00000000000a','Item A'); end $$;""")
        a.comando("begin;")
        a.comando("set local lock_timeout='2s';")
        a.comando("update config.usuarios set ativo=false where user_id='17900000-0000-0000-0000-000000000001';")
        b.comando("begin;")
        b.comando("set local role authenticated;")
        b.comando("""set local request.jwt.claims='{"sub":"17900000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';""")
        comando = "select config.sso_definir_perfil('17900000-0000-0000-0000-000000000101',0,'17900000-0000-0000-0000-000000000010','Perfil sintético',true,'Ensaio');"
        b.comando(comando, ("55P03",))
        b.comando("rollback;")
        a.comando("select 1;")
        a.comando("commit;")
        b.comando("begin;")
        b.comando("set local role authenticated;")
        b.comando("""set local request.jwt.claims='{"sub":"17900000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';""")
        b.comando(comando, ("42501",))
        b.comando("rollback;")
        a.comando("""do $$ begin if exists(select 1 from config.sso_perfis where id='17900000-0000-0000-0000-000000000010') or exists(select 1 from config.sso_comandos where request_id='17900000-0000-0000-0000-000000000101') then raise exception 'perfil_ou_recibo_indevido'; end if; end $$;""")
        # Ordem inversa: o comando conserva a trava até a confirmação.
        a.comando("update config.usuarios set ativo=true where user_id='17900000-0000-0000-0000-000000000001';")
        a.comando("begin;")
        a.comando("set local role authenticated;")
        a.comando("""set local request.jwt.claims='{"sub":"17900000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';""")
        comando_inverso = "select config.sso_definir_perfil('17900000-0000-0000-0000-000000000102',0,'17900000-0000-0000-0000-000000000010','Perfil sintético',true,'Ensaio');"
        a.comando(comando_inverso)
        b.comando("begin;")
        b.comando("set local lock_timeout='2s';")
        b.comando("update config.usuarios set ativo=false where user_id='17900000-0000-0000-0000-000000000001';", ("55P03",))
        b.comando("rollback;")
        a.comando("select 1;")
        a.comando("commit;")
        b.comando("update config.usuarios set ativo=false where user_id='17900000-0000-0000-0000-000000000001';")
        a.comando("begin;")
        a.comando("set local role authenticated;")
        a.comando("""set local request.jwt.claims='{"sub":"17900000-0000-0000-0000-000000000001","role":"authenticated","user_role":"superadmin"}';""")
        a.comando(comando_inverso, ("42501",))
        a.comando("rollback;")
        a.comando("""do $$ begin if (select count(*) from config.sso_perfis where id='17900000-0000-0000-0000-000000000010')<>1 or (select count(*) from config.sso_comandos where request_id='17900000-0000-0000-0000-000000000102')<>1 then raise exception 'perfil_ou_recibo_incorreto'; end if; end $$;""")
        if watchdog.is_set():
            raise RuntimeError("Monitor interrompeu o ensaio")
        a.comando("begin;")
        a.comando("set local app.auvo_sync_write='true';")
        a.comando("insert into pcm.sistema_itens(sistema_id,item_id) values ('176a0000-0000-0000-0000-000000000051','176a0000-0000-0000-0000-000000000011');")
        b.comando("begin;")
        b.comando("set local app.auvo_sync_write='true';")
        b.comando("set local lock_timeout='2s';")
        b.comando("update pcm.sistemas set cliente_id='176a0000-0000-0000-0000-00000000000b' where id='176a0000-0000-0000-0000-000000000051';", ("40001", "55P03"))
        b.comando("rollback;")
        a.comando("select 1;")
        a.comando("commit;")
        a.comando("""do $$ begin if not exists(select 1 from pcm.sistema_itens si join pcm.sistemas s on s.id=si.sistema_id join pcm.equipamentos e on e.id=si.item_id where si.sistema_id='176a0000-0000-0000-0000-000000000051' and si.item_id='176a0000-0000-0000-0000-000000000011' and s.cliente_id=e.client_id and e.client_id='176a0000-0000-0000-0000-00000000000a') then raise exception 'vinculo_final_invalido'; end if; end $$;""")
        # Ordem inversa em fixture sem vínculo: mudança de Cliente precede tentativa de vínculo.
        a.comando("delete from pcm.sistema_itens where sistema_id='176a0000-0000-0000-0000-000000000051' and item_id='176a0000-0000-0000-0000-000000000011';")
        a.comando("begin;")
        a.comando("set local app.auvo_sync_write='true';")
        a.comando("update pcm.sistemas set cliente_id='176a0000-0000-0000-0000-00000000000b' where id='176a0000-0000-0000-0000-000000000051';")
        b.comando("begin;")
        b.comando("set local app.auvo_sync_write='true';")
        b.comando("set local lock_timeout='2s';")
        b.comando("insert into pcm.sistema_itens(sistema_id,item_id) values ('176a0000-0000-0000-0000-000000000051','176a0000-0000-0000-0000-000000000011');", ("40001", "55P03"))
        b.comando("rollback;")
        a.comando("select 1;")
        a.comando("commit;")
        b.comando("begin;")
        b.comando("set local app.auvo_sync_write='true';")
        b.comando("insert into pcm.sistema_itens(sistema_id,item_id) values ('176a0000-0000-0000-0000-000000000051','176a0000-0000-0000-0000-000000000011');", ("23514",))
        b.comando("rollback;")
        a.comando("""do $$ begin if not exists(select 1 from pcm.sistemas where id='176a0000-0000-0000-0000-000000000051' and cliente_id='176a0000-0000-0000-0000-00000000000b') or not exists(select 1 from pcm.equipamentos where id='176a0000-0000-0000-0000-000000000011' and client_id='176a0000-0000-0000-0000-00000000000a') or exists(select 1 from pcm.sistema_itens where sistema_id='176a0000-0000-0000-0000-000000000051' and item_id='176a0000-0000-0000-0000-000000000011') then raise exception 'mudanca_final_invalida'; end if; end $$;""")
        print("Concorrência parcial: S170 contenção genérica nas duas ordens e replay revogado; S176 contenção genérica nas duas ordens.", flush=True)
    finally:
        try:
            if b is not None:
                b.fechar()
        finally:
            a.fechar()

