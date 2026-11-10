#!/usr/bin/env bash
# Somente banco descartável, com 0963 instalada; restaura gates e apaga fixtures próprias.
set -euo pipefail
container='supabase_db_Sinergica-SO'
rede='sso-testes-isolado-20261029'
[[ "${DOCKER_HOST:-}" == 'unix:///Users/lucasazevedo/.colima/default/docker.sock' ]]
[[ "$(rtk proxy docker network inspect --format '{{.Internal}}' "$rede")" == true ]]
[[ "$(rtk proxy docker inspect --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$container")" == "$rede " ]]
db() { rtk proxy docker exec -i "$container" psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -Atq "$@"; }
[[ "$(db -c "select count(*) from auth.users where id='17870000-0000-0000-0000-000000000001'")" == 0 ]]
[[ "$(db -c "select habilitado from pcm.sso_mediacao_conferencia_gate where id")" == f ]]
[[ "$(db -c "select habilitado from pcm.sso_fotos_levantamento_gate where id")" == f ]]
owned=0
cleanup() {
  [[ "$owned" == 1 ]] || return 0
  db <<'SQL'
begin;
set local app.auvo_sync_write='true';
set local storage.allow_delete_query='true';
delete from audit.events where entity_id='17870000-0000-0000-0000-000000000021' and action='levantamento.foto_vinculada';
delete from pcm.sso_fotos_levantamento where ator_id='17870000-0000-0000-0000-000000000001';
delete from storage.objects where id='17870000-0000-0000-0000-000000000031';
delete from pcm.sso_levantamento_linhas where lote_id in ('17870000-0000-0000-0000-000000000021','17870000-0000-0000-0000-000000000022');
delete from pcm.sso_levantamentos where criado_por='17870000-0000-0000-0000-000000000001';
delete from config.sso_concessoes where usuario_id='17870000-0000-0000-0000-000000000001';
delete from pcm.clientes where id in ('17870000-0000-0000-0000-00000000000a','17870000-0000-0000-0000-00000000000b');
delete from config.usuario_modulos where user_id='17870000-0000-0000-0000-000000000001';
delete from config.usuarios where user_id='17870000-0000-0000-0000-000000000001';
delete from auth.users where id='17870000-0000-0000-0000-000000000001';
update pcm.sso_mediacao_conferencia_gate set habilitado=false where id;
update pcm.sso_fotos_levantamento_gate set habilitado=false where id;
commit;
SQL
}
trap cleanup EXIT
{ printf '%s\n' 'begin;' "set local app.auvo_sync_write='true';"; sed -n '5,12p' supabase/tests/E01-S178_recibo_foto_mediado.test.sql; printf '%s\n' 'update pcm.sso_mediacao_conferencia_gate set habilitado=true where id;' 'update pcm.sso_fotos_levantamento_gate set habilitado=true where id;' "set local request.jwt.claims='{\"sub\":\"17870000-0000-0000-0000-000000000001\",\"role\":\"authenticated\",\"user_role\":\"colaborador\"}';" 'set local role authenticated;' "select pcm.sso_vincular_foto_levantamento_autorizado('17870000-0000-0000-0000-000000000041','17870000-0000-0000-0000-000000000021','a','17870000-0000-0000-0000-00000000000a/17870000-0000-0000-0000-000000000021/17870000-0000-0000-0000-000000000031');" 'commit;'; } | db
owned=1
db <<'SQL' &
begin isolation level repeatable read;
set local request.jwt.claims='{"sub":"17870000-0000-0000-0000-000000000001","role":"authenticated","user_role":"colaborador"}';
set local role authenticated;
select 1;
select pg_sleep(5);
do $test$ begin
  perform pcm.sso_recibo_foto_levantamento_autorizado('17870000-0000-0000-0000-000000000041','17870000-0000-0000-0000-000000000021','a','17870000-0000-0000-0000-00000000000a/17870000-0000-0000-0000-000000000021/17870000-0000-0000-0000-000000000031');
  raise exception 'recibo_aceitou_snapshot_obsoleto';
exception when sqlstate '25001' then
  if sqlerrm <> 'isolamento_nao_suportado' then raise; end if;
end $test$;
rollback;
SQL
pid=$!
sleep 2
db -c "update config.sso_concessoes set ativa=false where usuario_id='17870000-0000-0000-0000-000000000001'"
wait "$pid"
