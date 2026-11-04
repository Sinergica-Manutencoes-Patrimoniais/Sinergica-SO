-- ADR-1129: proveniência humana; não comprova disponibilidade.
create table pcm.sso_proveniencia_simulacao_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_proveniencia_simulacao_gate(id,habilitado) values(true,false);
create table pcm.sso_proveniencias_simulacao_visita(
 request_id uuid primary key,ator_id uuid not null references auth.users(id),cliente_id uuid not null references pcm.clientes(id),
 visita_id uuid not null references pcm.visitas(id),origem_parcial boolean not null,destino_parcial boolean not null,
 payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now()
);
alter table pcm.sso_proveniencia_simulacao_gate enable row level security;
alter table pcm.sso_proveniencia_simulacao_gate force row level security;
alter table pcm.sso_proveniencias_simulacao_visita enable row level security;
alter table pcm.sso_proveniencias_simulacao_visita force row level security;
revoke all on pcm.sso_proveniencia_simulacao_gate,pcm.sso_proveniencias_simulacao_visita from public,anon,authenticated,service_role;
create trigger sso_proveniencias_simulacao_imutaveis before update or delete on pcm.sso_proveniencias_simulacao_visita for each row execute function pcm.sso_proteger_conferencia_levantamento();
create function pcm.sso_reprogramar_visita_com_proveniencia(p_ator_id uuid,p_cliente_id uuid,p_request_id uuid,p_visita_id uuid,p_revision integer,
 p_inicio timestamptz,p_fim timestamptz,p_motivo text,p_vencimento_declarado date,p_alertas jsonb,p_origem_parcial boolean,p_destino_parcial boolean)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare v_ant pcm.sso_proveniencias_simulacao_visita%rowtype;v_payload jsonb;v_nucleo jsonb;v_resultado jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.uid() is null or auth.uid() is distinct from p_ator_id or p_cliente_id is null or p_request_id is null or p_visita_id is null
  or p_origem_parcial is null or p_destino_parcial is null or jsonb_typeof(p_alertas) is distinct from 'array' then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if (p_origem_parcial or p_destino_parcial) and not p_alertas @> '["capacidade_nao_verificada"]'::jsonb then raise exception 'alerta_capacidade_obrigatorio' using errcode='23514'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_proveniencia_simulacao_gate where id and habilitado for share;
 if not found then raise exception 'proveniencia_desabilitada' using errcode='55000'; end if;
 if config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'visitaId',p_visita_id,'revision',p_revision,'inicio',p_inicio,'fim',p_fim,
  'motivo',btrim(p_motivo),'vencimentoDeclarado',p_vencimento_declarado,'alertas',p_alertas,'origemParcial',p_origem_parcial,'destinoParcial',p_destino_parcial);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('proveniencia-simulacao:'||p_request_id::text,0));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('visita-alertas:'||p_request_id::text,0));
 select * into v_ant from pcm.sso_proveniencias_simulacao_visita where request_id=p_request_id;
 if found then
  if v_ant.ator_id is distinct from p_ator_id or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
  perform 1 from pcm.visitas where id=p_visita_id and cliente_id=p_cliente_id for share;
  if not found or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  return v_ant.resultado;
 end if;
 if exists(select 1 from pcm.sso_alertas_reprogramacao_comandos where request_id=p_request_id) then raise exception 'pedido_sem_proveniencia' using errcode='23505'; end if;
 v_nucleo:=pcm.sso_reprogramar_visita_alertas_declarados(p_ator_id,p_cliente_id,p_request_id,p_visita_id,p_revision,p_inicio,p_fim,p_motivo,p_vencimento_declarado,p_alertas);
 if v_nucleo->>'requestId' is distinct from p_request_id::text or v_nucleo->>'aggregateId' is distinct from p_visita_id::text then raise exception 'recibo_invalido' using errcode='23514'; end if;
 v_resultado:=v_nucleo||jsonb_build_object('origemParcialDeclarada',p_origem_parcial,'destinoParcialDeclarada',p_destino_parcial,'provenienciaComprovada',false);
 insert into pcm.sso_proveniencias_simulacao_visita(request_id,ator_id,cliente_id,visita_id,origem_parcial,destino_parcial,payload,resultado)
  values(p_request_id,p_ator_id,p_cliente_id,p_visita_id,p_origem_parcial,p_destino_parcial,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator_id,'visita.proveniencia_simulacao_declarada','visitas',p_visita_id,
  jsonb_build_object('requestId',p_request_id,'origemParcial',p_origem_parcial,'destinoParcial',p_destino_parcial));
 return v_resultado;
end; $$;
revoke all on function pcm.sso_reprogramar_visita_com_proveniencia(uuid,uuid,uuid,uuid,integer,timestamptz,timestamptz,text,date,jsonb,boolean,boolean) from public,anon,authenticated,service_role;
