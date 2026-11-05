-- ADR-0863. Expansão da fonte existente; gates permanecem fechados.
alter table pcm.capacidade_esforco_declaracoes add column ocorrencia_visita_id uuid references pcm.ocorrencias_visita_preparadas(id);
alter table pcm.capacidade_esforco_declaracoes add constraint capacidade_esforco_uma_origem_check
  check (num_nonnulls(os_id, ocorrencia_id, ocorrencia_visita_id) = 1);
alter table pcm.capacidade_esforco_declaracoes drop constraint capacidade_esforco_declaracoes_check;
create unique index capacidade_esforco_visita_revisao_idx on pcm.capacidade_esforco_declaracoes(cliente_id,ocorrencia_visita_id,revisao) where ocorrencia_visita_id is not null;

create function pcm.sso_declarar_esforco_ocorrencia_visita(p_request_id uuid,p_cliente_id uuid,p_origem_id uuid,p_expected_revision integer,p_internos_minutos integer,p_terceiros_minutos integer,p_acompanhamento_minutos integer,p_justificativa text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ator uuid:=auth.uid(); v_anterior pcm.capacidade_esforco_declaracoes%rowtype; v_revisao integer; v_payload jsonb;
begin
 perform 1 from pcm.capacidade_esforco_declarado_gate where id for share;
 if not coalesce((select habilitado from pcm.capacidade_esforco_declarado_gate where id),false) then raise exception 'esforco_capacidade_bloqueado' using errcode='55000'; end if;
 if pg_catalog.current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_autorizacao_incompativel' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 if v_ator is null or p_request_id is null or p_cliente_id is null or p_origem_id is null or p_expected_revision is null or p_expected_revision<0 or p_justificativa is null or length(btrim(p_justificativa)) not between 1 and 2000 or p_internos_minutos<0 or p_terceiros_minutos<0 or p_acompanhamento_minutos<0 then raise exception 'declaracao_invalida' using errcode='22023'; end if;
 if config.sso_autorizar_acao('capacidade.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform 1 from pcm.ocorrencias_visita_preparadas o join pcm.planos_manutencao p on p.id=o.plano_id where o.id=p_origem_id and p.cliente_id=p_cliente_id for share of o,p;
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'origemTipo','ocorrencia_visita','origemId',p_origem_id,'expectedRevision',p_expected_revision,'internosMinutos',p_internos_minutos,'terceirosMinutos',p_terceiros_minutos,'acompanhamentoMinutos',p_acompanhamento_minutos,'justificativa',btrim(p_justificativa));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
 select * into v_anterior from pcm.capacidade_esforco_declaracoes where request_id=p_request_id;
 if found then
   if v_anterior.ator_id is distinct from v_ator or v_anterior.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;
   if config.sso_autorizar_acao('capacidade.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
   return jsonb_build_object('requestId',p_request_id,'revision',v_anterior.revisao);
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('capacidade-esforco:ocorrencia_visita:'||p_origem_id::text,0));
 select coalesce(max(revisao),0) into v_revisao from pcm.capacidade_esforco_declaracoes where cliente_id=p_cliente_id and ocorrencia_visita_id=p_origem_id;
 if v_revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 if config.sso_autorizar_acao('capacidade.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 insert into pcm.capacidade_esforco_declaracoes(request_id,cliente_id,ocorrencia_visita_id,revisao,internos_minutos,terceiros_minutos,acompanhamento_minutos,justificativa,payload,ator_id) values(p_request_id,p_cliente_id,p_origem_id,v_revisao+1,p_internos_minutos,p_terceiros_minutos,p_acompanhamento_minutos,btrim(p_justificativa),v_payload,v_ator);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'capacidade.esforco_declarado','capacidade_esforco_declaracoes',p_request_id,v_payload);
 return jsonb_build_object('requestId',p_request_id,'revision',v_revisao+1);
end; $$;
revoke all on function pcm.sso_declarar_esforco_ocorrencia_visita(uuid,uuid,uuid,integer,integer,integer,integer,text) from public,anon,service_role;
grant execute on function pcm.sso_declarar_esforco_ocorrencia_visita(uuid,uuid,uuid,integer,integer,integer,integer,text) to authenticated;

create function pcm.sso_consultar_esforco_ocorrencia_visita(p_cliente_id uuid,p_origem_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_declaracao pcm.capacidade_esforco_declaracoes%rowtype;
begin
 if not coalesce((select habilitado from pcm.capacidade_esforco_declarado_gate where id),false) then raise exception 'esforco_capacidade_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_origem_id is null or config.sso_autorizar_acao('capacidade.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.ocorrencias_visita_preparadas o join pcm.planos_manutencao p on p.id=o.plano_id where o.id=p_origem_id and p.cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_declaracao from pcm.capacidade_esforco_declaracoes where cliente_id=p_cliente_id and ocorrencia_visita_id=p_origem_id order by revisao desc limit 1;
 return jsonb_build_object('origemTipo','ocorrencia_visita','origemId',p_origem_id,'revision',coalesce(v_declaracao.revisao,0),'internosMinutos',v_declaracao.internos_minutos,'terceirosMinutos',v_declaracao.terceiros_minutos,'acompanhamentoMinutos',v_declaracao.acompanhamento_minutos);
end; $$;
revoke all on function pcm.sso_consultar_esforco_ocorrencia_visita(uuid,uuid) from public,anon,service_role;
grant execute on function pcm.sso_consultar_esforco_ocorrencia_visita(uuid,uuid) to authenticated;

-- Projeção preserva critérios de 0988 e acrescenta apenas a origem de Visita.
create or replace function pcm.sso_mediar_ocorrencias_sem_os(p_cliente_id uuid,p_semana_inicio date,p_apos_tipo text default null,p_apos_id uuid default null,p_limite integer default 50)
returns table(tipo text,ocorrencia_id uuid,vencimento_original date,plano_id uuid,rotina_id uuid,alvo_tipo text,alvo_id uuid,esforco_revision integer,internos_minutos integer,terceiros_minutos integer,acompanhamento_minutos integer,completude text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_fila_obrigacoes_preparadas_gate where id),false) or not coalesce((select habilitado from pcm.capacidade_esforco_declarado_gate where id),false) then raise exception 'ocorrencias_capacidade_bloqueadas' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or config.sso_autorizar_acao('capacidade.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_semana_inicio is null or not isfinite(p_semana_inicio) or extract(isodow from p_semana_inicio)<>1 or p_limite is null or p_limite not between 1 and 100 or ((p_apos_tipo is null)<>(p_apos_id is null)) or (p_apos_tipo is not null and p_apos_tipo not in ('calendario','visita')) then raise exception 'consulta_invalida' using errcode='22023'; end if;
 return query with candidatas as (
  select 'calendario'::text tipo,o.id ocorrencia_id,o.vencimento_original,o.plano_id,o.rotina_id,o.alvo_tipo,o.alvo_id from pcm.ocorrencias_rotina_preparadas o join pcm.planos_manutencao p on p.id=o.plano_id and p.cliente_id=p_cliente_id
  where o.vencimento_original>=p_semana_inicio and o.vencimento_original<p_semana_inicio+7
   and not exists(select 1 from pcm.ocorrencias_rotina_vinculos v join pcm.ordens_servico os on os.ocorrencia_preventiva_id=v.ocorrencia_legada_id where v.ocorrencia_preparada_id=o.id)
   and not exists(select 1 from pcm.sso_ocorrencias_grupo g join pcm.sso_vinculos_os_grupo v on v.ocorrencia_grupo_id=g.id where g.calendario_preparado_id=o.id)
  union all
  select 'visita'::text,o.id,o.vencimento_original,o.plano_id,o.rotina_id,o.alvo_tipo,o.alvo_id from pcm.ocorrencias_visita_preparadas o join pcm.planos_manutencao p on p.id=o.plano_id and p.cliente_id=p_cliente_id
  where o.vencimento_original>=p_semana_inicio and o.vencimento_original<p_semana_inicio+7
   and not exists(select 1 from pcm.sso_vinculos_visita_legado v join pcm.ordens_servico os on os.ocorrencia_preventiva_id=v.ocorrencia_legada_id where v.ocorrencia_visita_id=o.id)
   and not exists(select 1 from pcm.sso_ocorrencias_grupo g join pcm.sso_vinculos_os_grupo v on v.ocorrencia_grupo_id=g.id where g.visita_preparada_id=o.id)
 ), pagina as (select c.* from candidatas c where p_apos_tipo is null or (c.tipo,c.ocorrencia_id)>(p_apos_tipo,p_apos_id) order by c.tipo,c.ocorrencia_id limit p_limite)
 select p.tipo,p.ocorrencia_id,p.vencimento_original,p.plano_id,p.rotina_id,p.alvo_tipo,p.alvo_id,coalesce(d.revisao,0),d.internos_minutos,d.terceiros_minutos,d.acompanhamento_minutos,'desconhecida'::text
 from pagina p left join lateral (select e.revisao,e.internos_minutos,e.terceiros_minutos,e.acompanhamento_minutos from pcm.capacidade_esforco_declaracoes e where e.cliente_id=p_cliente_id and ((p.tipo='calendario' and e.ocorrencia_id=p.ocorrencia_id) or (p.tipo='visita' and e.ocorrencia_visita_id=p.ocorrencia_id)) order by e.revisao desc limit 1) d on true order by p.tipo,p.ocorrencia_id;
end; $$;
