-- ADR-0413: visão de composição vinculada, sem criar score por parcela.
create table pcm.sso_gutd_parcela_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_gutd_parcela_gate(id,habilitado) values(true,false);
alter table pcm.sso_gutd_parcela_gate enable row level security;alter table pcm.sso_gutd_parcela_gate force row level security;
revoke all on pcm.sso_gutd_parcela_gate from public,anon,authenticated,service_role;
create function pcm.sso_gutd_parcela(p_parcela_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_b pcm.sso_backlog_parcelas%rowtype;v_c pcm.sso_backlog_composicoes%rowtype;v_cfg config.priorizacao_gutd%rowtype;v_score numeric;v_estado text;
begin
  if not coalesce((select habilitado from pcm.sso_gutd_parcela_gate where id),false) then raise exception 'gutd_desabilitado' using errcode='55000'; end if;
  if auth.uid() is null or p_parcela_id is null then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select * into v_b from pcm.sso_backlog_parcelas where parcela_id=p_parcela_id;
  if not found or config.sso_autorizar_acao('execucao.validar',v_b.cliente_id) is not true or config.sso_autorizar_acao('chamado.escopo.gerir',v_b.cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_c from pcm.sso_backlog_composicoes where id=v_b.composicao_id and cliente_id=v_b.cliente_id;
  if not found then raise exception 'composicao_indisponivel' using errcode='23514'; end if;
  select * into v_cfg from config.priorizacao_gutd where id=1;
  if v_c.gravidade is null or v_c.urgencia is null or v_c.tendencia is null then v_estado:='fatores_ausentes';
  elsif v_cfg.id is null then v_estado:='pesos_indisponiveis';
  elsif v_c.dor_cliente is null and v_cfg.peso_gravidade+v_cfg.peso_urgencia+v_cfg.peso_tendencia=0 then v_estado:='pesos_insuficientes';
  elsif v_c.dor_cliente is null then v_estado:='dor_nao_informada';v_score:=(v_cfg.peso_gravidade*v_c.gravidade+v_cfg.peso_urgencia*v_c.urgencia+v_cfg.peso_tendencia*v_c.tendencia)::numeric/(v_cfg.peso_gravidade+v_cfg.peso_urgencia+v_cfg.peso_tendencia);
  else v_estado:='completa';v_score:=(v_cfg.peso_gravidade*v_c.gravidade+v_cfg.peso_urgencia*v_c.urgencia+v_cfg.peso_tendencia*v_c.tendencia+v_cfg.peso_dor_cliente*v_c.dor_cliente)::numeric/100; end if;
  return jsonb_build_object('parcelaId',p_parcela_id,'composicaoId',v_c.id,'revision',v_c.revisao,'g',v_c.gravidade,'u',v_c.urgencia,'t',v_c.tendencia,'d',v_c.dor_cliente,'estado',v_estado,'score',v_score);
end;
$$;
revoke all on function pcm.sso_gutd_parcela(uuid) from public,anon,authenticated,service_role;
