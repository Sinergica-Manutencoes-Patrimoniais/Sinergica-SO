-- ADR-0326: nova conferência estrutural sob bloqueio, sem aprovação de OS.
create table pcm.sso_reatestacoes_cobertura_retorno (
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,retorno_id uuid not null references pcm.retorno_os_preparado(id),
 conferencia_anterior_id uuid not null references pcm.sso_conferencias_cobertura_retorno(id),conferencia_nova_id uuid not null unique references pcm.sso_conferencias_cobertura_retorno(id),
 revisao_decisao integer not null,revisao_evidencias integer not null,justificativa text not null check(length(btrim(justificativa)) between 1 and 2000),
 payload jsonb not null,ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now()
);
alter table pcm.sso_reatestacoes_cobertura_retorno enable row level security;
alter table pcm.sso_reatestacoes_cobertura_retorno force row level security;
revoke all on pcm.sso_reatestacoes_cobertura_retorno from public,anon,authenticated,service_role;
create trigger sso_reatestacao_cobertura_imutavel before update or delete on pcm.sso_reatestacoes_cobertura_retorno for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_reatestar_cobertura_retorno(p_request_id uuid,p_cliente_id uuid,p_retorno_id uuid,p_conferencia_id uuid,p_expected_evidencias integer,p_expected_decisao integer,p_justificativa text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_retorno pcm.retorno_os_preparado%rowtype;v_ant pcm.sso_reatestacoes_cobertura_retorno%rowtype;v_conferencia pcm.sso_conferencias_cobertura_retorno%rowtype;
 v_payload jsonb;v_decisoes integer;v_versionadas integer;v_revision integer;v_evidencias integer;v_nova jsonb;v_id uuid;
begin
 if not coalesce((select habilitado from pcm.validacao_os_gate where id),false) or not coalesce((select habilitado from pcm.origem_campo_inbox_gate where id),false) or not coalesce((select habilitado from pcm.sso_conferencia_cobertura_retorno_gate where id),false) or not coalesce((select habilitado from pcm.sso_revisao_validacao_os_gate where id),false) then raise exception 'reatestacao_bloqueada' using errcode='55000'; end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_retorno_id is null or p_conferencia_id is null or p_expected_evidencias is null or p_expected_evidencias<0 or p_expected_decisao is null or p_expected_decisao<0 or p_justificativa is null or length(btrim(p_justificativa)) not between 1 and 2000 then raise exception 'reatestacao_invalida' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'retornoId',p_retorno_id,'conferenciaId',p_conferencia_id,'expectedEvidencias',p_expected_evidencias,'expectedDecisao',p_expected_decisao,'justificativa',btrim(p_justificativa));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
 select * into v_retorno from pcm.retorno_os_preparado where id=p_retorno_id and cliente_id=p_cliente_id for update;
 if not found or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_ant from pcm.sso_reatestacoes_cobertura_retorno where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from v_actor or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if; return jsonb_build_object('reatestacaoId',v_ant.id,'conferenciaId',v_ant.conferencia_nova_id,'requestId',p_request_id,'evidenciaExternaComprovada',false); end if;
 select * into v_conferencia from pcm.sso_conferencias_cobertura_retorno where id=p_conferencia_id and retorno_id=p_retorno_id;
 if not found then raise exception 'conferencia_indisponivel' using errcode='23514'; end if;
 select coalesce(max(revisao),0) into v_evidencias from pcm.retorno_evidencias_declaradas where retorno_id=p_retorno_id;
 select count(*) into v_decisoes from pcm.decisoes_validacao_os where retorno_id=p_retorno_id;
 select count(*),coalesce(max(revisao),0) into v_versionadas,v_revision from pcm.sso_revisoes_validacao_os where retorno_id=p_retorno_id;
 if v_evidencias<>p_expected_evidencias or v_revision<>p_expected_decisao then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 if v_decisoes<>v_versionadas then raise exception 'historico_nao_reconciliado' using errcode='23514'; end if;
 perform i.id from pcm.retorno_campo_classificacoes c join pcm.origem_campo_inbox i on i.id=c.envelope_id where c.retorno_id=p_retorno_id for share of i;
 perform os.id from pcm.ordens_servico os where os.id=v_retorno.os_id and os.client_id=p_cliente_id and os.deleted_at is null for share;
 perform cli.id from pcm.clientes cli where cli.id=p_cliente_id and cli.deleted_at is null for share;
 perform vinc.ocorrencia_preparada_id from pcm.ordens_servico os join pcm.ocorrencias_rotina_vinculos vinc on vinc.ocorrencia_legada_id=os.ocorrencia_preventiva_id join pcm.ocorrencias_rotina_preparadas oc on oc.id=vinc.ocorrencia_preparada_id join pcm.planos_manutencao p on p.id=oc.plano_id join pcm.plano_versoes v on v.id=oc.versao_id where os.id=v_retorno.os_id and p.cliente_id=p_cliente_id and oc.rotina_id=v_retorno.rotina_id and oc.versao_id=v_retorno.versao_id for share of vinc,oc,p,v;
 perform r.id from pcm.respostas_os_preparadas r where r.retorno_id=p_retorno_id order by r.id for share;
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_nova:=pcm.sso_conferir_cobertura_retorno(gen_random_uuid(),p_cliente_id,p_retorno_id,v_conferencia.evidencia_id,p_expected_evidencias,btrim(p_justificativa));
 insert into pcm.sso_reatestacoes_cobertura_retorno(request_id,retorno_id,conferencia_anterior_id,conferencia_nova_id,revisao_decisao,revisao_evidencias,justificativa,payload,ator_id)
 values(p_request_id,p_retorno_id,p_conferencia_id,(v_nova->>'conferenciaId')::uuid,v_revision,v_evidencias,btrim(p_justificativa),v_payload,v_actor) returning id into v_id;
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'execucao.cobertura_reatestada','retorno_os_preparado',p_retorno_id,jsonb_build_object('requestId',p_request_id,'reatestacaoId',v_id,'conferenciaId',v_nova->>'conferenciaId'));
 return jsonb_build_object('reatestacaoId',v_id,'conferenciaId',v_nova->>'conferenciaId','requestId',p_request_id,'evidenciaExternaComprovada',false);
end; $$;
revoke all on function pcm.sso_reatestar_cobertura_retorno(uuid,uuid,uuid,uuid,integer,integer,text) from public,anon,authenticated,service_role;

create function pcm.sso_listar_reatestacoes_retorno(p_cliente_id uuid,p_retorno_id uuid,p_conferencia_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,conferencia_nova_id uuid,revisao_decisao integer,revisao_evidencias integer,justificativa text,ator_id uuid,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.validacao_os_gate where id),false) or not coalesce((select habilitado from pcm.origem_campo_inbox_gate where id),false) or not coalesce((select habilitado from pcm.sso_conferencia_cobertura_retorno_gate where id),false) or not coalesce((select habilitado from pcm.sso_revisao_validacao_os_gate where id),false) then raise exception 'reatestacao_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or not exists(select 1 from pcm.retorno_os_preparado where id=p_retorno_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 return query select a.id,a.conferencia_nova_id,a.revisao_decisao,a.revisao_evidencias,a.justificativa,a.ator_id,a.criado_em from pcm.sso_reatestacoes_cobertura_retorno a where a.retorno_id=p_retorno_id and a.conferencia_anterior_id=p_conferencia_id and (p_apos is null or a.id>p_apos) order by a.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_reatestacoes_retorno(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
