-- ADR-1117: entrada coordenada de geração ou supressão; sem autorização de rollout.
create table pcm.sso_geracao_ou_supressao_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_geracao_ou_supressao_gate(id,habilitado) values(true,false);
create table pcm.sso_geracao_ou_supressao_comandos(
 request_id uuid primary key,ator_id uuid not null references auth.users(id),cliente_id uuid not null references pcm.clientes(id),
 serie_id uuid not null references pcm.calendario_contratual_series(id),payload jsonb not null,resultado jsonb not null,
 criado_em timestamptz not null default now()
);
alter table pcm.sso_geracao_ou_supressao_gate enable row level security;
alter table pcm.sso_geracao_ou_supressao_gate force row level security;
alter table pcm.sso_geracao_ou_supressao_comandos enable row level security;
alter table pcm.sso_geracao_ou_supressao_comandos force row level security;
revoke all on pcm.sso_geracao_ou_supressao_gate,pcm.sso_geracao_ou_supressao_comandos from public,anon,authenticated,service_role;
create trigger sso_geracao_ou_supressao_imutavel before update or delete on pcm.sso_geracao_ou_supressao_comandos
 for each row execute function pcm.sso_proteger_supressao_semana();

create function pcm.sso_gerar_visita_ou_suprimir(p_ator_id uuid,p_request_id uuid,p_cliente_id uuid,p_serie_id uuid,
 p_regra_id uuid,p_semana date,p_visita_id uuid,p_inicio_em timestamptz,p_responsavel_id uuid,p_cobertura text)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare v_comando pcm.sso_geracao_ou_supressao_comandos%rowtype;v_serie pcm.calendario_contratual_series%rowtype;
 v_regra pcm.regras_visita_contratual%rowtype;v_f pcm.feriados_declarados%rowtype;v_payload jsonb;v_resultado jsonb;v_interno jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_request_id is null or p_cliente_id is null or p_serie_id is null
  or p_regra_id is null or p_semana is null or not isfinite(p_semana) or extract(isodow from p_semana)<>1
  or p_visita_id is null or p_inicio_em is null or not isfinite(p_inicio_em) then
  raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then
  raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_geracao_ou_supressao_gate where id and habilitado for share;
 if not found then raise exception 'geracao_ou_supressao_desabilitada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then
  raise exception 'sem_acesso' using errcode='42501'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'serieId',p_serie_id,'regraId',p_regra_id,'semana',p_semana,
  'visitaId',p_visita_id,'inicioEm',p_inicio_em,'responsavelId',p_responsavel_id,'cobertura',p_cobertura);
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('geracao-ou-supressao:'||p_request_id::text,0)) then
  raise exception 'pedido_em_alteracao' using errcode='55P03'; end if;
 select * into v_comando from pcm.sso_geracao_ou_supressao_comandos where request_id=p_request_id;
 if found then
  if v_comando.ator_id is distinct from p_ator_id or v_comando.cliente_id is distinct from p_cliente_id or v_comando.payload is distinct from v_payload then
   raise exception 'request_id_conflitante' using errcode='23505'; end if;
  return v_comando.resultado;
 end if;
 if exists(select 1 from pcm.sso_geracao_visita_contratual where request_id=p_request_id)
  or exists(select 1 from pcm.sso_supressoes_semana_feriado where request_id=p_request_id) then
  raise exception 'request_id_conflitante' using errcode='23505';
 end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-feriados-cliente:'||p_cliente_id::text,0)) then
  raise exception 'feriados_em_alteracao' using errcode='55P03'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-semana-visita:'||p_serie_id::text||':'||p_semana::text,0)) then
  raise exception 'semana_em_alteracao' using errcode='55P03'; end if;
 select * into v_serie from pcm.calendario_contratual_series where id=p_serie_id and cliente_id=p_cliente_id for share nowait;
 if not found then raise exception 'serie_indisponivel' using errcode='42501'; end if;
 select * into v_regra from pcm.regras_visita_contratual where id=p_regra_id and serie_id=p_serie_id for share nowait;
 if not found then raise exception 'regra_indisponivel' using errcode='23514'; end if;
 select * into v_f from pcm.feriados_declarados f where f.cliente_id=p_cliente_id and f.ativo
  and f.data=p_semana+(v_regra.dia_semana-1) and (f.contrato_id is null or f.contrato_id=v_serie.contrato_id) order by f.id limit 1;
 if found then
  v_interno:=pcm.sso_registrar_supressao_semana(p_ator_id,p_cliente_id,p_request_id,p_serie_id,p_regra_id,p_semana,v_f.id,v_f.revisao);
  v_resultado:=jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'serieId',p_serie_id,'semana',p_semana,
   'decisao','suprimida_feriado','detalhe',v_interno,'efeitoRemoto',false);
 else
  v_interno:=pcm.sso_pcm_gerar_visita_suprimivel(p_ator_id,p_request_id,p_cliente_id,p_serie_id,p_regra_id,p_semana,p_visita_id,p_inicio_em,p_responsavel_id,p_cobertura);
  if v_interno->>'decisao' is distinct from 'criada' or v_interno->>'visitaId' is distinct from p_visita_id::text
   or v_interno->'visitaCriada' is distinct from 'true'::jsonb then
   raise exception 'resultado_geracao_divergente' using errcode='23514';
  end if;
  v_resultado:=jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'serieId',p_serie_id,'semana',p_semana,
   'decisao','gerada','detalhe',v_interno,'efeitoRemoto',false);
 end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then
  raise exception 'sem_acesso' using errcode='42501'; end if;
 insert into pcm.sso_geracao_ou_supressao_comandos(request_id,ator_id,cliente_id,serie_id,payload,resultado)
  values(p_request_id,p_ator_id,p_cliente_id,p_serie_id,v_payload,v_resultado);
 return v_resultado;
end; $$;
revoke all on function pcm.sso_gerar_visita_ou_suprimir(uuid,uuid,uuid,uuid,uuid,date,uuid,timestamptz,uuid,text) from public,anon,authenticated,service_role;
