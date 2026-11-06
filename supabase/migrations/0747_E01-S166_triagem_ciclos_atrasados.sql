-- ADR-0522: triagem humana, sem deslocar vencimentos ou gerar retroativos.
create table pcm.sso_triagem_atraso_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_triagem_atraso_gate enable row level security;alter table pcm.sso_triagem_atraso_gate force row level security;
revoke all on pcm.sso_triagem_atraso_gate from public,anon,authenticated,service_role;
insert into pcm.sso_triagem_atraso_gate(id,habilitado) values(true,false);
create table pcm.sso_triagens_atraso (
 request_id uuid primary key,cliente_id uuid not null,preparada_id uuid not null references pcm.ocorrencias_rotina_preparadas(id),revisao integer not null check(revisao>0),data_referencia date not null,decisao text not null check(decisao in ('avaliar','tratar_manualmente')),
 motivo text not null,ator_id uuid not null references auth.users(id),payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now(),unique(preparada_id,revisao)
);
alter table pcm.sso_triagens_atraso enable row level security;alter table pcm.sso_triagens_atraso force row level security;
revoke all on pcm.sso_triagens_atraso from public,anon,authenticated,service_role;
create trigger sso_triagem_atraso_imutavel before update or delete on pcm.sso_triagens_atraso for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_listar_candidatos_atraso(p_cliente_id uuid,p_plano_id uuid,p_rotina_id uuid,p_data_referencia date,p_apos uuid default null,p_limite integer default 20)
returns table(preparada_id uuid,versao_id uuid,rotina_id uuid,ciclo integer,vencimento_original date,tolerancia_depois integer,tem_vinculo_legado boolean,tem_os boolean,ultima_revisao integer)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_triagem_atraso_gate where id),false) then raise exception 'triagem_atraso_bloqueada' using errcode='55000';end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501';end if;
 if p_data_referencia is null or not isfinite(p_data_referencia) or p_limite is null or p_limite not between 1 and 50 then raise exception 'consulta_invalida' using errcode='22023';end if;
 return query select o.id,o.versao_id,o.rotina_id,o.ciclo,o.vencimento_original,o.tolerancia_depois,exists(select 1 from pcm.ocorrencias_rotina_vinculos v where v.ocorrencia_preparada_id=o.id and v.ocorrencia_legada_id is not null),exists(select 1 from pcm.ocorrencias_rotina_vinculos v join pcm.ordens_servico os on os.ocorrencia_preventiva_id=v.ocorrencia_legada_id and os.client_id=p_cliente_id and os.deleted_at is null where v.ocorrencia_preparada_id=o.id),coalesce((select max(t.revisao) from pcm.sso_triagens_atraso t where t.preparada_id=o.id),0)
 from pcm.ocorrencias_rotina_preparadas o where o.plano_id=p_plano_id and o.rotina_id=p_rotina_id and p_data_referencia-o.vencimento_original>o.tolerancia_depois and (p_apos is null or o.id>p_apos) order by o.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_candidatos_atraso(uuid,uuid,uuid,date,uuid,integer) from public,anon,authenticated,service_role;

create function pcm.sso_triar_ciclo_atrasado(p_request_id uuid,p_cliente_id uuid,p_preparada_id uuid,p_expected_revision integer,p_data_referencia date,p_decisao text,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_prep pcm.ocorrencias_rotina_preparadas%rowtype;v_ant pcm.sso_triagens_atraso%rowtype;v_rev integer;v_payload jsonb;v_resultado jsonb;v_motivo text:=nullif(btrim(p_motivo),'');
begin
 if not coalesce((select habilitado from pcm.sso_triagem_atraso_gate where id),false) then raise exception 'triagem_atraso_bloqueada' using errcode='55000';end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_preparada_id is null or p_expected_revision is null or p_expected_revision<0 or p_data_referencia is null or not isfinite(p_data_referencia) or p_decisao is null or p_decisao not in ('avaliar','tratar_manualmente') or v_motivo is null or length(v_motivo)>2000 then raise exception 'comando_invalido' using errcode='22023';end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'preparadaId',p_preparada_id,'revisaoEsperada',p_expected_revision,'dataReferencia',p_data_referencia,'decisao',p_decisao,'motivo',v_motivo);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('triagem-atraso:'||p_request_id::text,0));
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 select * into v_ant from pcm.sso_triagens_atraso where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from v_actor or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505';end if;return v_ant.resultado;end if;
 select o.* into v_prep from pcm.ocorrencias_rotina_preparadas o join pcm.planos_manutencao p on p.id=o.plano_id and p.cliente_id=p_cliente_id where o.id=p_preparada_id for update of o;
 if not found then raise exception 'ocorrencia_indisponivel' using errcode='42501';end if;
 if p_data_referencia-v_prep.vencimento_original<=v_prep.tolerancia_depois then raise exception 'fora_criterio_candidato' using errcode='23514';end if;
 select coalesce(max(revisao),0) into v_rev from pcm.sso_triagens_atraso where preparada_id=p_preparada_id;
 if v_rev<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001';end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 v_resultado:=jsonb_build_object('requestId',p_request_id,'preparadaId',p_preparada_id,'revisao',v_rev+1,'vencimentoOriginal',v_prep.vencimento_original,'dataReferencia',p_data_referencia,'decisao',p_decisao,'dataBaseAlterada',false,'ocorrenciaCriada',false,'osCriada',false,'tarefaAuvoCriada',false);
 insert into pcm.sso_triagens_atraso(request_id,cliente_id,preparada_id,revisao,data_referencia,decisao,motivo,ator_id,payload,resultado) values(p_request_id,p_cliente_id,p_preparada_id,v_rev+1,p_data_referencia,p_decisao,v_motivo,v_actor,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'calendario.ciclo_atrasado_triagem','planos_manutencao',v_prep.plano_id,v_resultado||jsonb_build_object('motivo',v_motivo));return v_resultado;
end; $$;
revoke all on function pcm.sso_triar_ciclo_atrasado(uuid,uuid,uuid,integer,date,text,text) from public,anon,authenticated,service_role;
