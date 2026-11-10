#!/usr/bin/env bash
# Somente ambiente descartável indicado abaixo. Dados sintéticos próprios são removidos no final.
# Requer 0962 instalada no banco descartável, rede Docker interna e nenhuma outra sessão de teste.
set -euo pipefail

container='supabase_db_Sinergica-SO'
rede='sso-testes-isolado-20261029'
if [[ "${DOCKER_HOST:-}" != 'unix:///Users/lucasazevedo/.colima/default/docker.sock' ]]; then
  printf '%s\n' 'Abortado: DOCKER_HOST não é o socket local de diagnóstico.' >&2; exit 1
fi
if [[ "$(rtk proxy docker network inspect --format '{{.Internal}}' "$rede")" != 'true' ]]; then
  printf '%s\n' 'Abortado: rede não é interna.' >&2; exit 1
fi
if [[ "$(rtk proxy docker inspect --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$container")" != "$rede " ]]; then
  printf '%s\n' 'Abortado: container não está exclusivamente na rede diagnóstica.' >&2; exit 1
fi
db() { rtk proxy docker exec -i -e PGAPPNAME="${S07_APP:-s07_concorrencia_controle}" "$container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -Atq "$@"; }
if [[ "$(db -c "select position('Bloqueio e revalidação da proposta' in pg_get_functiondef('comercial.fn_ativar_contrato(uuid)'::regprocedure)) > 0")" != 't' ]]; then
  printf '%s\n' 'Abortado: 0957 não está aplicada no banco descartável.' >&2; exit 1
fi
if [[ "$(db -c "select position('isolamento_nao_suportado' in pg_get_functiondef('comercial.fn_ativar_contrato(uuid)'::regprocedure)) > 0")" != 't' ]]; then
  printf '%s\n' 'Abortado: proteção 0962 não está aplicada no banco descartável.' >&2; exit 1
fi

owned=0
pid=''
acao_pid=''
cleanup() {
  [[ -z "$pid" ]] || wait "$pid" || true
  [[ -z "$acao_pid" ]] || wait "$acao_pid" || true
  if [[ "$owned" == 1 ]]; then
    if ! db <<'SQL'
begin;
set local app.auvo_sync_write='true';
delete from comercial.contratos where id='30760000-0000-0000-0000-000000000041' and created_by='30760000-0000-0000-0000-000000000001';
delete from comercial.propostas where id='30760000-0000-0000-0000-000000000031';
delete from comercial.oportunidades where id='30760000-0000-0000-0000-000000000021';
delete from comercial.etapas_funil where id in ('30760000-0000-0000-0000-000000000011','30760000-0000-0000-0000-000000000012');
delete from pcm.clientes where id='30760000-0000-0000-0000-00000000000a' and created_by='30760000-0000-0000-0000-000000000001';
delete from config.usuario_modulos where user_id='30760000-0000-0000-0000-000000000001';
delete from config.usuarios where user_id='30760000-0000-0000-0000-000000000001';
delete from auth.users where id='30760000-0000-0000-0000-000000000001' and email='lock-proposta-s07@example.test';
commit;
SQL
    then printf '%s\n' 'Falha na limpeza; preservar e inspecionar fixtures 30760000.' >&2; return 1; fi
    local restante
    restante="$(db -c "select (select count(*) from auth.users where id='30760000-0000-0000-0000-000000000001')+(select count(*) from config.usuarios where user_id='30760000-0000-0000-0000-000000000001')+(select count(*) from config.usuario_modulos where user_id='30760000-0000-0000-0000-000000000001')+(select count(*) from pcm.clientes where id='30760000-0000-0000-0000-00000000000a')+(select count(*) from comercial.contratos where id='30760000-0000-0000-0000-000000000041')+(select count(*) from financeiro.contratos where comercial_contrato_id='30760000-0000-0000-0000-000000000041')+(select count(*) from comercial.propostas where id='30760000-0000-0000-0000-000000000031')+(select count(*) from comercial.oportunidades where id='30760000-0000-0000-0000-000000000021')+(select count(*) from comercial.etapas_funil where id in ('30760000-0000-0000-0000-000000000011','30760000-0000-0000-0000-000000000012'))+(select count(*) from audit.events where actor_id='30760000-0000-0000-0000-000000000001');")"
    [[ "$restante" == 0 ]] || { printf '%s\n' 'Restaram fixtures ou auditoria; inspecionar IDs 30760000.' >&2; return 1; }
    printf '%s\n' 'Fixtures sintéticas removidas e conferidas.'
  fi
}
trap cleanup EXIT

db <<'SQL'
begin;
set local app.auvo_sync_write='true';
do $$ begin
 if exists(select 1 from auth.users where id='30760000-0000-0000-0000-000000000001' or email='lock-proposta-s07@example.test')
 or exists(select 1 from pcm.clientes where id='30760000-0000-0000-0000-00000000000a')
 or exists(select 1 from comercial.etapas_funil where id in ('30760000-0000-0000-0000-000000000011','30760000-0000-0000-0000-000000000012'))
 or exists(select 1 from comercial.oportunidades where id='30760000-0000-0000-0000-000000000021')
 or exists(select 1 from comercial.propostas where id='30760000-0000-0000-0000-000000000031')
 or exists(select 1 from comercial.contratos where id='30760000-0000-0000-0000-000000000041')
 or exists(select 1 from financeiro.contratos where comercial_contrato_id='30760000-0000-0000-0000-000000000041')
 or exists(select 1 from audit.events where actor_id='30760000-0000-0000-0000-000000000001') then raise exception 'fixture_ja_existente'; end if;
end $$;
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values ('30760000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','lock-proposta-s07@example.test',crypt('x',gen_salt('bf')),'{}','{}',now(),now());
insert into config.usuarios(user_id,papel,nome,ativo) values ('30760000-0000-0000-0000-000000000001','colaborador','Usuário sintético lock',true);
insert into config.usuario_modulos(user_id,modulo,nivel) values ('30760000-0000-0000-0000-000000000001','comercial','escrita');
insert into pcm.clientes(id,nome,ativo,created_by) values ('30760000-0000-0000-0000-00000000000a','Cliente sintético lock',true,'30760000-0000-0000-0000-000000000001');
insert into comercial.etapas_funil(id,nome,ordem,cor,tipo) values ('30760000-0000-0000-0000-000000000011','Etapa sintética lock',13013,'#000000','aberta'),('30760000-0000-0000-0000-000000000012','Etapa ganha sintética lock',13014,'#00ff00','ganha');
insert into comercial.oportunidades(id,cliente_id,etapa_id,titulo) values ('30760000-0000-0000-0000-000000000021','30760000-0000-0000-0000-00000000000a','30760000-0000-0000-0000-000000000011','Origem sintética lock');
insert into comercial.propostas(id,oportunidade_id,tipo,status,custo_total_centavos,piso_centavos,preco_sugerido_centavos,preco_centavos) values ('30760000-0000-0000-0000-000000000031','30760000-0000-0000-0000-000000000021','residente','aceita',10000,10638,12766,50000);
insert into comercial.contratos(id,proposta_id,cliente_id,tipo,valor_mensal_centavos,vigencia_inicio,created_by) values ('30760000-0000-0000-0000-000000000041','30760000-0000-0000-0000-000000000031','30760000-0000-0000-0000-00000000000a','residente',50000,current_date,'30760000-0000-0000-0000-000000000001');
commit;
SQL
owned=1

aguardar_trava() {
  local tentativa
  for tentativa in {1..40}; do
    [[ "$(db -c "select exists(select 1 from pg_stat_activity where application_name='$1' and wait_event='PgSleep')")" != 't' ]] || return 0
    rtk proxy sleep 0.1
  done
  printf '%s\n' 'Sessão de teste não alcançou o ponto de sincronização.' >&2; return 1
}
esperar_bloqueio() {
  local resultado
  if resultado="$(db -c "$1" 2>&1)"; then printf '%s\n' 'Falhou: operação concorrente não bloqueou.' >&2; return 1; fi
  [[ "$resultado" == *'lock timeout'* ]] || { printf '%s\n' "$resultado" >&2; return 1; }
}
aguardar_lock() {
  local tentativa
  for tentativa in {1..40}; do
    [[ "$(db -c "select exists(select 1 from pg_stat_activity where application_name='$1' and wait_event_type='Lock')")" != 't' ]] || return 0
    rtk proxy sleep 0.1
  done
  printf '%s\n' 'Sessão de ativação não aguardou bloqueio.' >&2; return 1
}
claims='{"sub":"30760000-0000-0000-0000-000000000001","role":"authenticated","user_role":"colaborador","user_modulos":{"comercial":"escrita"}}'
S07_APP='s07_concorrencia_ativacao' db -c "begin; set local app.auvo_sync_write='true'; set local request.jwt.claims='$claims'; set local role authenticated; select comercial.fn_ativar_contrato('30760000-0000-0000-0000-000000000041'); select pg_sleep(5); rollback;" >/dev/null &
pid=$!
aguardar_trava 's07_concorrencia_ativacao'
esperar_bloqueio "begin; set local lock_timeout='300ms'; update comercial.propostas set deleted_at=now() where id='30760000-0000-0000-0000-000000000031'; rollback;"
wait "$pid"; pid=''
printf '%s\n' 'PASS: exclusão aguarda ativação.'

S07_APP='s07_concorrencia_exclusao' db -c "begin; update comercial.propostas set deleted_at=now() where id='30760000-0000-0000-0000-000000000031'; select pg_sleep(5); rollback;" >/dev/null &
pid=$!
aguardar_trava 's07_concorrencia_exclusao'
esperar_bloqueio "begin; set local lock_timeout='300ms'; set local app.auvo_sync_write='true'; set local request.jwt.claims='$claims'; set local role authenticated; select comercial.fn_ativar_contrato('30760000-0000-0000-0000-000000000041'); rollback;"
wait "$pid"; pid=''
printf '%s\n' 'PASS: ativação aguarda exclusão.'

# Revogação confirmada enquanto ativação aguarda a proposta deve impedir a operação.
for tipo in avulso residente; do
  if [[ "$tipo" == avulso ]]; then valor='null'; else valor='50000'; fi
  db -c "update comercial.contratos set tipo='$tipo',valor_mensal_centavos=$valor where id='30760000-0000-0000-0000-000000000041';"
for isolamento in 'read committed'; do
S07_APP='s07_revogacao_bloqueio' db -c "begin; select 1 from comercial.propostas where id='30760000-0000-0000-0000-000000000031' for update; select pg_sleep(5); rollback;" >/dev/null &
pid=$!
aguardar_trava 's07_revogacao_bloqueio'
S07_APP='s07_revogacao_ativacao' db -c "begin isolation level $isolamento; set local app.auvo_sync_write='true'; set local request.jwt.claims='$claims'; set local role authenticated; do \$teste\$ begin perform comercial.fn_ativar_contrato('30760000-0000-0000-0000-000000000041'); raise exception 'ativacao_aceitou_revogacao' using errcode='P0001'; exception when insufficient_privilege then if sqlerrm <> 'permissao_atual_negada' then raise; end if; end \$teste\$; rollback;" >/dev/null &
acao_pid=$!
aguardar_lock 's07_revogacao_ativacao'
db -c "update config.usuario_modulos set nivel='leitura' where user_id='30760000-0000-0000-0000-000000000001' and modulo='comercial';"
wait "$pid"; pid=''
if ! wait "$acao_pid"; then acao_pid=''; printf '%s\n' 'Falhou: ativação não rejeitou a revogação com o erro esperado.' >&2; exit 1; fi
acao_pid=''
db -c "update config.usuario_modulos set nivel='escrita' where user_id='30760000-0000-0000-0000-000000000001' and modulo='comercial';"
printf '%s\n' "PASS: revogação durante espera impede ativação ($tipo; $isolamento)."
done
done

# Isolamentos de snapshot fixo falham antes dos efeitos, para os dois tipos.
for tipo in avulso residente; do
  if [[ "$tipo" == avulso ]]; then valor='null'; else valor='50000'; fi
  db -c "update comercial.contratos set tipo='$tipo',valor_mensal_centavos=$valor where id='30760000-0000-0000-0000-000000000041';"
  for isolamento in 'repeatable read' 'serializable'; do
    db -c "begin isolation level $isolamento; set local app.auvo_sync_write='true'; set local request.jwt.claims='$claims'; set local role authenticated; do \$teste\$ begin perform comercial.fn_ativar_contrato('30760000-0000-0000-0000-000000000041'); raise exception 'isolamento_aceito' using errcode='P0001'; exception when sqlstate '25001' then if sqlerrm <> 'isolamento_nao_suportado' then raise; end if; end \$teste\$; rollback;"
    estado="$(db -c "select (select status='rascunho' from comercial.contratos where id='30760000-0000-0000-0000-000000000041') and not exists(select 1 from financeiro.contratos where comercial_contrato_id='30760000-0000-0000-0000-000000000041');")"
    [[ "$estado" == 't' ]] || { printf '%s\n' 'Falhou: isolamento recusado deixou efeitos.' >&2; exit 1; }
    printf '%s\n' "PASS: isolamento recusado sem efeitos ($tipo; $isolamento)."
  done
done

# A exclusão sintética é confirmada antes de a ativação desbloquear; a ativação deve recusar.
S07_APP='s07_concorrencia_exclusao_commit' db -c "begin; update comercial.propostas set deleted_at=now() where id='30760000-0000-0000-0000-000000000031'; select pg_sleep(5); commit;" >/dev/null &
pid=$!
aguardar_trava 's07_concorrencia_exclusao_commit'
if resultado="$(db -c "begin; set local app.auvo_sync_write='true'; set local request.jwt.claims='$claims'; set local role authenticated; select comercial.fn_ativar_contrato('30760000-0000-0000-0000-000000000041'); rollback;" 2>&1)"; then
  printf '%s\n' 'Falhou: ativação aceitou proposta cuja exclusão foi confirmada.' >&2; exit 1
fi
[[ "$resultado" == *'proposta_ou_oportunidade_indisponivel'* ]] || { printf '%s\n' "$resultado" >&2; exit 1; }
wait "$pid"; pid=''
estado="$(db -c "select (select deleted_at is not null from comercial.propostas where id='30760000-0000-0000-0000-000000000031') and (select status='rascunho' from comercial.contratos where id='30760000-0000-0000-0000-000000000041') and not exists(select 1 from financeiro.contratos where comercial_contrato_id='30760000-0000-0000-0000-000000000041');")"
[[ "$estado" == 't' ]] || { printf '%s\n' 'Falhou: exclusão, contrato ou plano terminaram em estado inesperado.' >&2; exit 1; }
printf '%s\n' 'PASS: exclusão confirmada impede ativação e criação de plano.'

# A validação do protocolo de serialização usa apenas a fixture sintética já criada.
db -c "update comercial.propostas set deleted_at=null where id='30760000-0000-0000-0000-000000000031';"
for tipo in avulso residente; do
  if [[ "$tipo" == avulso ]]; then valor='null'; else valor='50000'; fi
  db -c "update comercial.contratos set tipo='$tipo',valor_mensal_centavos=$valor where id='30760000-0000-0000-0000-000000000041';"
  S07_APP='s07_serializacao_ativacao' db -c "begin; set local app.auvo_sync_write='true'; set local request.jwt.claims='$claims'; set local role authenticated; select comercial.fn_ativar_contrato('30760000-0000-0000-0000-000000000041'); select pg_sleep(5); rollback;" >/dev/null &
  pid=$!
  aguardar_trava 's07_serializacao_ativacao'
  esperar_bloqueio "begin; set local lock_timeout='300ms'; update config.usuario_modulos set nivel='leitura' where user_id='30760000-0000-0000-0000-000000000001' and modulo='comercial'; rollback;"
  wait "$pid"; pid=''
  printf '%s\n' "PASS: revogação aguarda ativação ($tipo)."

  S07_APP='s07_serializacao_revogacao' db -c "begin; update config.usuario_modulos set nivel='leitura' where user_id='30760000-0000-0000-0000-000000000001' and modulo='comercial'; select pg_sleep(5); rollback;" >/dev/null &
  pid=$!
  aguardar_trava 's07_serializacao_revogacao'
  if resultado="$(db -c "begin; set local app.auvo_sync_write='true'; set local request.jwt.claims='$claims'; set local role authenticated; select comercial.fn_ativar_contrato('30760000-0000-0000-0000-000000000041'); rollback;" 2>&1)"; then
    printf '%s\n' "Falhou: ativação prosseguiu durante revogação ($tipo)." >&2; exit 1
  fi
  [[ "$resultado" == *'autorizacao_em_alteracao'* ]] || { printf '%s\n' "$resultado" >&2; exit 1; }
  wait "$pid"; pid=''
  printf '%s\n' "PASS: ativação falha fechada durante revogação ($tipo)."
done
