-- ADR-1091: coordenação de OS, sem registrar cron ou abrir gates.
create table pcm.sso_executor_varredura_os (
  id boolean primary key default true check(id), habilitado boolean not null default false,
  intervalo_minutos integer not null default 60 check(intervalo_minutos between 5 and 10080),
  execucao_atual uuid references pcm.sso_execucoes_varredura_os(id),
  ultima_conclusao timestamptz, atualizado_em timestamptz not null default now()
);
insert into pcm.sso_executor_varredura_os(id,habilitado) values(true,false);
alter table pcm.sso_executor_varredura_os enable row level security;
alter table pcm.sso_executor_varredura_os force row level security;
revoke all on pcm.sso_executor_varredura_os from public,anon,authenticated,service_role;

create function pcm.sso_executar_pagina_varredura_os_periodica()
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_config pcm.sso_executor_varredura_os%rowtype; v_execucao pcm.sso_execucoes_varredura_os%rowtype;
  v_execucao_id uuid; v_revisao integer; v_resultado jsonb;
begin
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-executor-varredura-os-periodica',0)) then
    return jsonb_build_object('situacao','em_execucao');
  end if;
  select * into v_config from pcm.sso_executor_varredura_os where id for update;
  if not found or not v_config.habilitado then return jsonb_build_object('situacao','desabilitado'); end if;
  if v_config.execucao_atual is null then
    if v_config.ultima_conclusao is not null and now()<v_config.ultima_conclusao+pg_catalog.make_interval(mins=>v_config.intervalo_minutos) then
      return jsonb_build_object('situacao','aguardando_intervalo'); end if;
    v_execucao_id:=gen_random_uuid(); v_revisao:=0;
  else
    select * into v_execucao from pcm.sso_execucoes_varredura_os where id=v_config.execucao_atual;
    if not found or v_execucao.estado is distinct from 'em_andamento' then raise exception 'execucao_inconsistente' using errcode='23514'; end if;
    v_execucao_id:=v_execucao.id; v_revisao:=v_execucao.revisao;
  end if;
  v_resultado:=pcm.sso_avancar_varredura_os(v_execucao_id,gen_random_uuid(),v_revisao,50);
  if v_resultado->>'execucaoId' is distinct from v_execucao_id::text or v_resultado->>'estado' is null or v_resultado->>'estado' not in ('em_andamento','concluida')
    or v_resultado->'efeitoRemotoComprovado' is distinct from 'false'::jsonb then raise exception 'resultado_invalido' using errcode='23514'; end if;
  update pcm.sso_executor_varredura_os set
    execucao_atual=case when v_resultado->>'estado'='concluida' then null else v_execucao_id end,
    ultima_conclusao=case when v_resultado->>'estado'='concluida' then now() else ultima_conclusao end,
    atualizado_em=now() where id;
  return jsonb_build_object('situacao',v_resultado->>'estado','execucaoId',v_execucao_id,
    'revisao',v_resultado->'revisao','efeitoRemotoComprovado',false);
end; $$;
revoke all on function pcm.sso_executar_pagina_varredura_os_periodica() from public,anon,authenticated,service_role;
grant execute on function pcm.sso_executar_pagina_varredura_os_periodica() to service_role;
