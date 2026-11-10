-- ADR-1354: inclusão manual de fonte sem vínculo como conferência, não execução.
create table pcm.sso_fila_sem_vinculo_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_fila_sem_vinculo_gate(id, habilitado) values(true, false);
alter table pcm.sso_fila_sem_vinculo_gate enable row level security;
alter table pcm.sso_fila_sem_vinculo_gate force row level security;
revoke all on pcm.sso_fila_sem_vinculo_gate from public, anon, authenticated, service_role;

create function pcm.sso_fila_sem_vinculo_habilitada() returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare v_habilitado boolean;
begin
  select habilitado into v_habilitado from pcm.sso_fila_sem_vinculo_gate where id for share;
  return coalesce(v_habilitado, false);
end; $$;
revoke all on function pcm.sso_fila_sem_vinculo_habilitada() from public, anon, authenticated, service_role;

alter table pcm.sso_fila_preventiva_pcm drop constraint sso_fila_preventiva_pcm_estado_check;
alter table pcm.sso_fila_preventiva_pcm add constraint sso_fila_preventiva_pcm_estado_check
  check(estado in ('aguardando', 'verificacao', 'cancelado'));

do $migration$
declare
  v_funcao regprocedure := 'pcm.sso_alterar_fila_preventiva_pcm(uuid,uuid,uuid,uuid,text,integer,text)'::regprocedure;
  v_definicao text := pg_catalog.pg_get_functiondef(v_funcao);
  v_origem text := $antes$if v_estado->>'estado' is distinct from 'candidata_aguardando' then raise exception 'elegibilidade_nao_comprovada' using errcode='23514'; end if;$antes$;
  v_origem_nova text := $depois$if v_estado->>'estado' is distinct from 'candidata_aguardando' and not (
      v_estado->>'estado' is not distinct from 'indeterminado' and v_estado->>'motivo' is not distinct from 'sem_vinculo' and pcm.sso_fila_sem_vinculo_habilitada()
    ) then raise exception 'elegibilidade_nao_comprovada' using errcode='23514'; end if;$depois$;
  v_insert text := $antes$values(v_ciclo,p_cliente_id,p_plano_id,p_preparada_id,'aguardando',1) returning * into v_fila;$antes$;
  v_insert_novo text := $depois$values(v_ciclo,p_cliente_id,p_plano_id,p_preparada_id,case when v_estado->>'estado' = 'candidata_aguardando' then 'aguardando' else 'verificacao' end,1) returning * into v_fila;$depois$;
  v_cancelar text := $antes$v_fila.estado<>'aguardando'$antes$;
  v_cancelar_novo text := $depois$v_fila.estado not in ('aguardando','verificacao')$depois$;
begin
  if length(v_definicao)-length(replace(v_definicao,v_origem,''))<>length(v_origem)
    or length(v_definicao)-length(replace(v_definicao,v_insert,''))<>length(v_insert)
    or length(v_definicao)-length(replace(v_definicao,v_cancelar,''))<>length(v_cancelar) then
    raise exception 'definicao_fila_incompativel' using errcode = '55000'; end if;
  v_definicao := replace(replace(replace(v_definicao, v_origem, v_origem_nova), v_insert, v_insert_novo), v_cancelar, v_cancelar_novo);
  execute v_definicao;
end;
$migration$;
