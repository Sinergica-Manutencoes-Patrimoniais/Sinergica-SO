-- ADR-0571: somente com Plano legado existente e parâmetros comprovados.
create table pcm.sso_materializar_visita_legado_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_materializar_visita_legado_gate enable row level security;alter table pcm.sso_materializar_visita_legado_gate force row level security;
revoke all on pcm.sso_materializar_visita_legado_gate from public,anon,authenticated,service_role;
insert into pcm.sso_materializar_visita_legado_gate(id,habilitado) values(true,false);
create table pcm.sso_materializacoes_visita_legado (
 request_id uuid primary key,cliente_id uuid not null,preparada_id uuid not null unique references pcm.ocorrencias_visita_preparadas(id),legada_id uuid not null unique references pcm.ocorrencias_preventivas(id),relacao_request_id uuid not null references pcm.sso_declaracoes_planos_legados(request_id),ator_id uuid not null references auth.users(id),payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now()
);
alter table pcm.sso_materializacoes_visita_legado enable row level security;alter table pcm.sso_materializacoes_visita_legado force row level security;
revoke all on pcm.sso_materializacoes_visita_legado from public,anon,authenticated,service_role;
create trigger sso_materializacao_visita_legado_imutavel before update or delete on pcm.sso_materializacoes_visita_legado for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_materializar_visita_legado(p_request_id uuid,p_cliente_id uuid,p_preparada_id uuid,p_plano_legado_id uuid,p_relacao_request_id uuid,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_prep pcm.ocorrencias_visita_preparadas%rowtype;v_plano pcm.planos_manutencao%rowtype;v_legado pcm.planos_preventivos%rowtype;v_origem pcm.visita_origem_contratual%rowtype;v_ant pcm.sso_materializacoes_visita_legado%rowtype;v_hoje date;v_distancia integer;v_passo integer;v_indice integer;v_legada uuid;v_criada boolean;v_payload jsonb;v_resultado jsonb;v_vinculo jsonb;v_motivo text:=nullif(btrim(p_motivo),'');
begin
 if not coalesce((select habilitado from pcm.sso_materializar_visita_legado_gate where id),false) or not coalesce((select habilitado from pcm.sso_vinculo_visita_legado_gate where id),false) or not coalesce((select habilitado from pcm.ocorrencia_rotina_gate where id),false) then raise exception 'materializacao_visita_bloqueada' using errcode='55000';end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_preparada_id is null or p_plano_legado_id is null or p_relacao_request_id is null or v_motivo is null or length(v_motivo)>2000 then raise exception 'comando_invalido' using errcode='22023';end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'preparadaId',p_preparada_id,'planoLegadoId',p_plano_legado_id,'relacaoRequestId',p_relacao_request_id,'motivo',v_motivo);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('materializar-visita-legado:'||p_request_id::text,0));
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 select * into v_ant from pcm.sso_materializacoes_visita_legado where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from v_actor or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505';end if;return v_ant.resultado;end if;
 select o.* into v_prep from pcm.ocorrencias_visita_preparadas o join pcm.planos_manutencao p on p.id=o.plano_id and p.cliente_id=p_cliente_id where o.id=p_preparada_id for update of o;
 if not found then raise exception 'preparada_indisponivel' using errcode='42501';end if;
 select * into v_plano from pcm.planos_manutencao where id=v_prep.plano_id and cliente_id=p_cliente_id for update;
 if not found or v_plano.estado not in ('aprovado','ativo') then raise exception 'plano_inativo' using errcode='23514';end if;
 v_hoje:=pcm.sso_data_civil_versao_geracao(v_plano.id,v_prep.versao_id);
 if v_prep.vencimento_original<v_hoje then raise exception 'vencido_exige_decisao_pcm' using errcode='23514';end if;
 select * into v_origem from pcm.visita_origem_contratual where visita_id=v_prep.visita_id and cliente_id=p_cliente_id and serie_id=v_prep.serie_id and semana_origem=v_prep.semana_origem for share;
 if not found then raise exception 'origem_visita_nao_comprovada' using errcode='23514';end if;
 if exists(select 1 from pcm.feriados_declarados f where f.cliente_id=p_cliente_id and f.ativo and f.data=v_prep.vencimento_original and (f.contrato_id is null or f.contrato_id=v_origem.contrato_id)) then raise exception 'feriado_declarado_exige_reconciliacao' using errcode='23514';end if;
 select * into v_legado from pcm.planos_preventivos where id=p_plano_legado_id and cliente_id=p_cliente_id for update;
 if not found or v_legado.estado<>'ativo' then raise exception 'plano_legado_indisponivel' using errcode='23514';end if;
 if not exists(select 1 from pcm.sso_declaracoes_planos_legados d where d.request_id=p_relacao_request_id and d.cliente_id=p_cliente_id and d.plano_id=v_plano.id and d.plano_legado_id=v_legado.id and d.decisao='declarar' and d.revisao=(select max(x.revisao) from pcm.sso_declaracoes_planos_legados x where x.plano_id=v_plano.id and x.plano_legado_id=v_legado.id)) then raise exception 'relacao_nao_atual' using errcode='23514';end if;
 if not ((v_prep.alvo_tipo='sistema' and v_legado.sistema_id=v_prep.alvo_id) or (v_prep.alvo_tipo='componente' and v_legado.equipamento_id=v_prep.alvo_id)) then raise exception 'alvo_nao_comprovado' using errcode='23514';end if;
 if v_legado.intervalo_unidade='semanas' then v_distancia:=v_prep.vencimento_original-v_legado.primeira_data;v_passo:=7*v_legado.intervalo_n;
 else v_distancia:=(extract(year from v_prep.vencimento_original)::integer-extract(year from v_legado.primeira_data)::integer)*12+extract(month from v_prep.vencimento_original)::integer-extract(month from v_legado.primeira_data)::integer;v_passo:=v_legado.intervalo_n;end if;
 if v_distancia<0 or mod(v_distancia,v_passo)<>0 then raise exception 'ciclo_legado_incompativel' using errcode='23514';end if;
 v_indice:=v_distancia/v_passo;
 if pcm.sso_vencimento_ciclo_calendario(v_legado.primeira_data,v_legado.intervalo_n,v_legado.intervalo_unidade,v_indice) is distinct from v_prep.vencimento_original then raise exception 'ciclo_legado_incompativel' using errcode='23514';end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 insert into pcm.ocorrencias_preventivas(plano_id,indice,vencimento,chave_externa) values(v_legado.id,v_indice,v_prep.vencimento_original,'PREV-'||v_legado.id||'-'||v_indice) on conflict(plano_id,indice) do nothing returning id into v_legada;v_criada:=found;
 if not v_criada then select id into v_legada from pcm.ocorrencias_preventivas where plano_id=v_legado.id and indice=v_indice;end if;
 if v_legada is null then raise exception 'ciclo_legado_indisponivel' using errcode='23514';end if;
 v_vinculo:=pcm.sso_vincular_visita_legado_existente(gen_random_uuid(),p_cliente_id,p_preparada_id,v_legada,p_relacao_request_id,v_motivo);
 v_resultado:=jsonb_build_object('requestId',p_request_id,'preparadaId',p_preparada_id,'legadaId',v_legada,'ocorrenciaLegadaCriada',v_criada,'dataReferenciaCivil',v_hoje,'fonteFeriadosCompleta',false,'planoLegadoCriado',false,'osCriada',false,'tarefaAuvoCriada',false,'filaOficialIntegrada',false);
 insert into pcm.sso_materializacoes_visita_legado(request_id,cliente_id,preparada_id,legada_id,relacao_request_id,ator_id,payload,resultado) values(p_request_id,p_cliente_id,p_preparada_id,v_legada,p_relacao_request_id,v_actor,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'calendario.visita_legado_materializada','planos_manutencao',v_plano.id,v_resultado||jsonb_build_object('motivo',v_motivo));return v_resultado;
end; $$;
revoke all on function pcm.sso_materializar_visita_legado(uuid,uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;

create function pcm.sso_listar_visitas_integracao_legado(p_cliente_id uuid,p_plano_id uuid,p_legado_id uuid,p_relacao_request_id uuid,p_apos uuid default null,p_limite integer default 20)
returns table(preparada_id uuid,visita_id uuid,serie_id uuid,semana_origem date,vencimento_original date,alvo_tipo text,alvo_id uuid)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_materializar_visita_legado_gate where id),false) then raise exception 'materializacao_visita_bloqueada' using errcode='55000';end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true or not exists(select 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id) or not exists(select 1 from pcm.planos_preventivos where id=p_legado_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501';end if;
 if p_limite is null or p_limite not between 1 and 50 then raise exception 'consulta_invalida' using errcode='22023';end if;
 if not exists(select 1 from pcm.sso_declaracoes_planos_legados d where d.request_id=p_relacao_request_id and d.plano_id=p_plano_id and d.plano_legado_id=p_legado_id and d.cliente_id=p_cliente_id and d.decisao='declarar' and d.revisao=(select max(e.revisao) from pcm.sso_declaracoes_planos_legados e where e.plano_id=p_plano_id and e.plano_legado_id=p_legado_id)) then raise exception 'relacao_nao_atual' using errcode='23514';end if;
 return query select o.id,o.visita_id,o.serie_id,o.semana_origem,o.vencimento_original,o.alvo_tipo,o.alvo_id from pcm.ocorrencias_visita_preparadas o where o.plano_id=p_plano_id and (p_apos is null or o.id>p_apos) and not exists(select 1 from pcm.sso_vinculos_visita_legado v where v.ocorrencia_visita_id=o.id) order by o.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_visitas_integracao_legado(uuid,uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
