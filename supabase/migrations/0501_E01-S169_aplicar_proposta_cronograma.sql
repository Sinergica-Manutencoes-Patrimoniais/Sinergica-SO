-- ADR-0275: aplica proposta somente a Rotina rascunho, via comando canônico.
create table pcm.sso_cronograma_aplicacoes_proposta (
 id uuid primary key default gen_random_uuid(),proposta_id uuid not null unique references pcm.sso_cronograma_propostas_reprocessamento(id),
 revisao_plano integer not null,ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now()
);
alter table pcm.sso_cronograma_aplicacoes_proposta enable row level security;
alter table pcm.sso_cronograma_aplicacoes_proposta force row level security;
revoke all on pcm.sso_cronograma_aplicacoes_proposta from public,anon,authenticated,service_role;
create trigger sso_cronograma_aplicacao_imutavel before update or delete on pcm.sso_cronograma_aplicacoes_proposta for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_aplicar_reprocessamento_cronograma(p_request_id uuid,p_cliente_id uuid,p_proposta_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_proposta pcm.sso_cronograma_propostas_reprocessamento%rowtype;v_lote pcm.sso_levantamentos%rowtype;
 v_plano pcm.planos_manutencao%rowtype;v_rotina pcm.rotinas_manutencao%rowtype;v_cmd pcm.sso_levantamento_comandos%rowtype;
 v_payload jsonb;v_antes jsonb;v_resultado jsonb;v_edicao jsonb;v_id uuid;
begin
 if not coalesce((select habilitado from pcm.sso_cronograma_staging_gate where id),false) or not coalesce((select habilitado from pcm.sso_cronograma_aprovacao_gate where id),false) or not coalesce((select habilitado from pcm.sso_cronograma_incorporacao_gate where id),false) then raise exception 'incorporacao_cronograma_bloqueada' using errcode='55000'; end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_proposta_id is null then raise exception 'pedido_invalido' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('tipo','aplicarReprocessamentoCronograma','clienteId',p_cliente_id,'propostaId',p_proposta_id);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
 select * into v_cmd from pcm.sso_levantamento_comandos where request_id=p_request_id;
 select * into v_proposta from pcm.sso_cronograma_propostas_reprocessamento where id=p_proposta_id and cliente_id=p_cliente_id;
 if not found or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_lote from pcm.sso_levantamentos where id=v_proposta.lote_id and cliente_id=p_cliente_id for update;
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_plano from pcm.planos_manutencao where id=v_proposta.plano_id and cliente_id=p_cliente_id for update;
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
 if v_cmd.request_id is not null then if v_cmd.ator_id is distinct from v_actor or v_cmd.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if; return v_cmd.resultado; end if;
 if v_lote.revisao<>v_proposta.revisao_lote or v_plano.revisao<>v_proposta.revisao_plano then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 if v_plano.estado<>'rascunho' or not exists(select 1 from pcm.sso_cronograma_aprovacoes where id=v_proposta.aprovacao_id and lote_id=v_lote.id and revisao_aprovacao=v_lote.revisao) then raise exception 'fonte_ou_plano_indisponivel' using errcode='23514'; end if;
 if exists(select 1 from pcm.sso_cronograma_aplicacoes_proposta where proposta_id=p_proposta_id) then raise exception 'proposta_ja_aplicada' using errcode='23505'; end if;
 select r.* into v_rotina from pcm.rotinas_manutencao r join pcm.plano_versoes v on v.id=r.versao_id where r.id=v_proposta.rotina_id and r.plano_id=v_plano.id and r.versao_id=v_proposta.versao_id and v.estado='rascunho' for update of r;
 if not found then raise exception 'rotina_nao_editavel' using errcode='23514'; end if;
 v_antes:=jsonb_build_object('nome',v_rotina.nome,'alvoTipo',v_rotina.alvo_tipo,'alvoId',coalesce(v_rotina.sistema_id,v_rotina.equipamento_id,v_rotina.grupo_id),'modo',v_rotina.modo,'intervalo',v_rotina.intervalo_n,'unidade',v_rotina.intervalo_unidade,'dataBase',v_rotina.data_base,'tempoMinutos',v_rotina.tempo_minutos,'toleranciaAntes',v_rotina.tolerancia_antes,'toleranciaDepois',v_rotina.tolerancia_depois);
 if v_antes is distinct from v_proposta.antes then raise exception 'rotina_alterada' using errcode='40001'; end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_edicao:=pcm.sso_editar_rotina_rascunho(gen_random_uuid(),v_plano.revisao,v_plano.id,v_rotina.id,v_proposta.depois->>'nome',v_proposta.depois->>'alvoTipo',(v_proposta.depois->>'alvoId')::uuid,v_proposta.depois->>'modo',(v_proposta.depois->>'intervalo')::integer,v_proposta.depois->>'unidade',(v_proposta.depois->>'dataBase')::date,(v_proposta.depois->>'tempoMinutos')::integer,(v_proposta.depois->>'toleranciaAntes')::integer,(v_proposta.depois->>'toleranciaDepois')::integer,v_rotina.instrucao,v_rotina.questionario_id);
 insert into pcm.sso_cronograma_aplicacoes_proposta(proposta_id,revisao_plano,ator_id) values(p_proposta_id,(v_edicao->>'revision')::integer,v_actor) returning id into v_id;
 v_resultado:=jsonb_build_object('propostaId',p_proposta_id,'aplicacaoId',v_id,'planoId',v_plano.id,'rotinaId',v_rotina.id,'revision',v_edicao->'revision','state','rascunho','requestId',p_request_id,'warnings',v_edicao->'warnings');
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'cronograma.reprocessamento_aplicado','sso_cronograma_propostas_reprocessamento',p_proposta_id,jsonb_build_object('requestId',p_request_id,'aplicacaoId',v_id,'rotinaId',v_rotina.id,'revision',v_edicao->'revision'));
 insert into pcm.sso_levantamento_comandos(request_id,ator_id,payload,resultado) values(p_request_id,v_actor,v_payload,v_resultado);return v_resultado;
end; $$;
revoke all on function pcm.sso_aplicar_reprocessamento_cronograma(uuid,uuid,uuid) from public,anon,authenticated,service_role;

create function pcm.sso_listar_propostas_reprocessamento(p_cliente_id uuid,p_lote_id uuid,p_plano_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,chave_linha text,rotina_id uuid,revisao_lote integer,revisao_plano integer,antes jsonb,depois jsonb,justificativa text,criado_em timestamptz,aplicada boolean)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_cronograma_staging_gate where id),false) or not coalesce((select habilitado from pcm.sso_cronograma_aprovacao_gate where id),false) or not coalesce((select habilitado from pcm.sso_cronograma_incorporacao_gate where id),false) then raise exception 'incorporacao_cronograma_bloqueada' using errcode='55000'; end if;
 if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.sso_levantamentos where id=p_lote_id and cliente_id=p_cliente_id) or not exists(select 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select p.id,p.chave_linha,p.rotina_id,p.revisao_lote,p.revisao_plano,p.antes,p.depois,p.justificativa,p.criado_em,exists(select 1 from pcm.sso_cronograma_aplicacoes_proposta a where a.proposta_id=p.id)
 from pcm.sso_cronograma_propostas_reprocessamento p where p.cliente_id=p_cliente_id and p.lote_id=p_lote_id and p.plano_id=p_plano_id and (p_apos is null or p.id>p_apos) order by p.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_propostas_reprocessamento(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
