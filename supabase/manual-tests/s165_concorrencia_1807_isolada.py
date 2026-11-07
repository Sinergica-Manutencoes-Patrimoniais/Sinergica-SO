"""Concorrência 1807 exclusivamente no clone atestado e descartado pelo harness.

O setup confirma dados sintéticos; sem descarte integral não deve ser chamado.
Módulo não é executável sozinho e não publica rede nem aciona Auvo.
"""
import hashlib
import re
import subprocess
from pathlib import Path

from s165_concorrencia_1805_isolada import atestar
from s176_runner_concorrencia import Sessao

FIXTURE = 'supabase/tests/manual_E01-S165_revisao_contratos_mediada_1807.sql'
FIXTURE_SHA256 = '762e4e1e4cf5bac38a43846a97e8a4498d49f6f5df14ec17e9c23469afbd2e8d'
MARCADOR = '-- Gate novo desligado por padrão deve impedir chamada mediada.'
ATOR = '18040000-0000-4000-8000-000000000001'
CLIENTE = '18040000-0000-4000-8000-00000000000a'
CLAIMS = '{"sub":"'+ATOR+'","role":"authenticated","user_role":"superadmin"}'


def preparar(root: Path):
    arquivo = (root / FIXTURE).read_bytes()
    if hashlib.sha256(arquivo).hexdigest() != FIXTURE_SHA256:
        raise RuntimeError('Hash da fixture 1807 divergente')
    texto = arquivo.decode('utf-8')
    if texto.count(MARCADOR) != 1:
        raise RuntimeError('Marcador da fixture 1807 divergente')
    prefixo = texto.split(MARCADOR, 1)[0]
    if (len(re.findall(r'(?im)^\s*begin\s*;', prefixo)) != 1
        or re.search(r'(?im)^\s*(commit|rollback|end transaction)\s*;|session_replication_role|^\s*\\', prefixo)):
        raise RuntimeError('Setup transacional 1807 divergente')
    gates = ('sso_inicio_revisao_contratos_mediado_gate','sso_revisao_contrato_gate',
             'sso_contrato_pergunta_gate','sso_revisao_evidencia_gate','sso_contrato_evidencia_gate',
             'sso_revisao_exigencias_gate','sso_exigencia_legal_gate','sso_contratos_em_revisao_gate')
    retorno = prefixo + '\nreset role;\n' + ''.join('update pcm.'+g+' set habilitado=true where id;\n' for g in gates) + 'commit;\n'
    return retorno.encode()


def executar(container, setup, watchdog):
    atestar(container)
    if watchdog.is_set(): raise RuntimeError('Monitor interrompeu o ensaio')
    a = Sessao(container)
    b = None
    try:
        b = Sessao(container)
        a.comando("""do $$ begin
          if exists(select 1 from auth.users) or exists(select 1 from pcm.clientes)
             or exists(select 1 from pcm.planos_manutencao) or exists(select 1 from pcm.plano_comandos)
          then raise exception 'clone_nao_vazio'; end if;
          if current_setting('cron.launch_active_jobs',true) is distinct from 'off' then
            raise exception 'cron_nao_desligado'; end if;
        end $$;""")
        # ON_ERROR_STOP evita confirmar setup parcialmente falho; saída não é exposta.
        proc = subprocess.run(['rtk','proxy','docker','exec','-i',container,'psql','-X','-qAt',
            '-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'], input=setup,
            capture_output=True, timeout=180)
        if proc.returncode: raise RuntimeError('Setup sintético 1807 falhou')
        if watchdog.is_set(): raise RuntimeError('Monitor interrompeu o ensaio')

        def iniciar(s):
            s.comando('begin;')
            s.comando("set local lock_timeout='2s';")
            s.comando("set local app.auvo_sync_write='true';")
            s.comando('set local role authenticated;')
            s.comando("set local request.jwt.claims='"+CLAIMS+"';")

        def chamada(i, modo, request=None):
            plano=f'18040000-0000-4000-8000-{10+i:012d}'
            versao=f'18070001-0000-4000-8000-{i:012d}'
            pedido=request or f'18070000-0000-4000-8000-{i:012d}'
            return f"select pcm.sso_iniciar_revisao_contratos_mediada('{ATOR}','{CLIENTE}','{plano}','{pedido}',4,'{versao}','{modo}');"

        def concessao(ativa, revisao, sufixo):
            valor='true' if ativa else 'false'
            return (f"select config.sso_definir_concessao('18070002-0000-4000-8000-{sufixo:012d}',{revisao},"
                    f"'{ATOR}',null,'plano.gerir','{CLIENTE}',{valor},'Concorrência sintética');")

        # Mesmo request em modos diferentes: trava impede concorrência; colisão após commit.
        iniciar(a); a.comando(chamada(1,'contratos')); iniciar(b); b.comando(chamada(1,'evidencias'),('55P03',)); b.comando('rollback;')
        a.comando('commit;'); iniciar(b); b.comando(chamada(1,'evidencias'),('23505',)); b.comando('rollback;')
        iniciar(b); b.comando(chamada(1,'contratos')); b.comando('commit;')
        iniciar(a); a.comando(chamada(2,'evidencias')); iniciar(b); b.comando(chamada(2,'contratos'),('55P03',)); b.comando('rollback;')
        a.comando('commit;'); iniciar(b); b.comando(chamada(2,'contratos'),('23505',)); b.comando('rollback;')
        iniciar(b); b.comando(chamada(2,'evidencias')); b.comando('commit;')

        # Gate primeiro: chamada bloqueada durante UPDATE e negada após commit.
        a.comando('begin;'); a.comando('update pcm.sso_inicio_revisao_contratos_mediado_gate set habilitado=false where id;')
        iniciar(b); b.comando(chamada(3,'contratos'),('55P03',)); b.comando('rollback;')
        a.comando('commit;'); iniciar(b); b.comando(chamada(3,'contratos'),('55000',)); b.comando('rollback;')
        a.comando('update pcm.sso_inicio_revisao_contratos_mediado_gate set habilitado=true where id;')
        # Ordem inversa: comando retém SHARE do gate até commit.
        iniciar(a); a.comando(chamada(4,'contratos')); b.comando('begin;'); b.comando("set local lock_timeout='2s';")
        b.comando('update pcm.sso_inicio_revisao_contratos_mediado_gate set habilitado=false where id;',('55P03',)); b.comando('rollback;')
        a.comando('commit;'); b.comando('update pcm.sso_inicio_revisao_contratos_mediado_gate set habilitado=false where id;')
        iniciar(a); a.comando(chamada(4,'contratos'),('55000',)); a.comando('rollback;')
        b.comando('update pcm.sso_inicio_revisao_contratos_mediado_gate set habilitado=true where id;')
        iniciar(a); a.comando(chamada(4,'contratos')); a.comando('commit;')

        # Revogação primeiro e aprovação primeiro, com comandos administrativos reais.
        iniciar(a); a.comando(concessao(False,0,1)); iniciar(b); b.comando(chamada(5,'contratos'),('55P03',)); b.comando('rollback;')
        a.comando('commit;'); iniciar(b); b.comando(chamada(5,'contratos'),('42501',)); b.comando('rollback;')
        iniciar(a); a.comando(concessao(True,1,2)); a.comando('commit;')
        iniciar(a); a.comando(chamada(6,'contratos')); iniciar(b); b.comando(concessao(False,2,3),('55P03',)); b.comando('rollback;')
        a.comando('commit;'); iniciar(b); b.comando(concessao(False,2,3)); b.comando('commit;')
        iniciar(a); a.comando(chamada(6,'contratos'),('42501',)); a.comando('rollback;')
        a.comando("""do $$ begin
          if (select count(*) from pcm.sso_revisoes_plano_contratos where request_id in
            ('18070000-0000-4000-8000-000000000001','18070000-0000-4000-8000-000000000004','18070000-0000-4000-8000-000000000006')) <> 3
          or (select count(*) from pcm.sso_revisoes_plano_evidencias where request_id='18070000-0000-4000-8000-000000000002') <> 1
          or exists(select 1 from pcm.sso_revisoes_plano_contratos where request_id in
            ('18070000-0000-4000-8000-000000000003','18070000-0000-4000-8000-000000000005'))
          then raise exception 'recibos_concorrencia_divergentes'; end if;
        end $$;""")
        if watchdog.is_set(): raise RuntimeError('Monitor interrompeu o ensaio')
        print('Concorrência 1807: modo/request, gate e autorização; clone exige descarte.', flush=True)
    finally:
        if b is not None: b.fechar()
        a.fechar()
