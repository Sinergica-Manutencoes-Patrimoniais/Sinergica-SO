-- ADR-1477: continuidade por decisão vinculada à transação de aprovação.
create table pcm.sso_continuidade_revisao_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_continuidade_revisao_gate(id,habilitado) values(true,false);
alter table pcm.sso_continuidade_revisao_gate enable row level security;
alter table pcm.sso_continuidade_revisao_gate force row level security;
revoke all on pcm.sso_continuidade_revisao_gate from public,anon,authenticated,service_role;
create table pcm.sso_continuidades_ciclo_aprovadas(
 cliente_id uuid not null,plano_id uuid not null references pcm.planos_manutencao(id),
 versao_id uuid not null references pcm.plano_versoes(id),preparada_id uuid not null references pcm.ocorrencias_rotina_preparadas(id),
 decisao_request_id uuid not null references pcm.sso_decisoes_impacto_ocorrencia(request_id),vigencia date not null,
 criado_em timestamptz not null default now(),primary key(versao_id,preparada_id)
);
alter table pcm.sso_continuidades_ciclo_aprovadas enable row level security;
alter table pcm.sso_continuidades_ciclo_aprovadas force row level security;
revoke all on pcm.sso_continuidades_ciclo_aprovadas from public,anon,authenticated,service_role;
create trigger sso_continuidades_ciclo_imutaveis before update or delete on pcm.sso_continuidades_ciclo_aprovadas for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_registrar_continuidades_aprovadas() returns trigger language plpgsql security definer set search_path='' as $$
declare v_plano pcm.planos_manutencao%rowtype;v_previa jsonb;v_rascunho uuid;v_calendario jsonb;v_grupos jsonb;
begin
 perform 1 from pcm.sso_continuidade_revisao_gate where id and habilitado for share;
 if not found then return new; end if;
 if auth.uid() is null or pg_catalog.current_setting('transaction_isolation')<>'read committed' or new.txid<>pg_catalog.txid_current() then raise exception 'transacao_invalida' using errcode='25001'; end if;
 select * into v_plano from pcm.planos_manutencao where id=new.plano_id for update nowait;
 if not found or config.sso_autorizar_acao('plano.gerir',v_plano.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform 1 from pcm.sso_concorrencia_impacto_gate where id and habilitado for share;
 if not found or not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('sso-impacto-revisao-protocolo-global-v1',0)) then raise exception 'protocolo_impacto_indisponivel' using errcode='55P03'; end if;
 v_previa:=pcm.sso_previa_revisao_revisionada(new.plano_id,v_plano.revisao,1,null);
 if (v_previa->>'versaoAnteriorId')::uuid is distinct from new.versao_anterior_id then raise exception 'versao_origem_divergente' using errcode='23514'; end if;
 v_rascunho:=(v_previa->>'versaoRascunhoId')::uuid;
 v_calendario:=pcm.sso_avaliar_decisoes_impacto(v_plano.cliente_id,new.plano_id,v_plano.revisao);
 v_grupos:=pcm.sso_avaliar_fotografias_grupo_mediada(auth.uid(),v_plano.cliente_id,new.plano_id,v_plano.revisao);
 if (v_calendario->>'revisaoPlano')::integer is distinct from v_plano.revisao or (v_grupos->>'revisaoPlano')::integer is distinct from v_plano.revisao
  or (v_calendario->>'decisoesAusentes')::bigint is distinct from 0 or (v_calendario->>'decisoesObsoletas')::bigint is distinct from 0
  or (v_calendario->>'exigemReconciliacao')::bigint is distinct from 0 or (v_calendario->>'fontesIndividuaisIncompletas')::bigint is distinct from 0
  or (v_calendario->>'comOsClienteDivergente')::bigint is distinct from 0 or (v_grupos->>'fotografiasAusentes')::bigint is distinct from 0
  or (v_grupos->>'fotografiasObsoletas')::bigint is distinct from 0 then raise exception 'impacto_parcial_pendente' using errcode='23514'; end if;
 insert into pcm.sso_continuidades_ciclo_aprovadas(cliente_id,plano_id,versao_id,preparada_id,decisao_request_id,vigencia)
 select v_plano.cliente_id,new.plano_id,v_rascunho,o.id,d.request_id,new.vigencia_inicio
 from pcm.ocorrencias_rotina_preparadas o
 join lateral (select x.* from pcm.sso_decisoes_impacto_ocorrencia x where x.rascunho_id=v_rascunho and x.preparada_id=o.id order by x.revisao desc limit 1) d on true
 where o.plano_id=new.plano_id and o.versao_id=new.versao_anterior_id and o.vencimento_original>=new.vigencia_inicio
   and d.decisao='manter_sem_alterar' and d.revisao_plano=v_plano.revisao;
 return new;
end; $$;
revoke all on function pcm.sso_registrar_continuidades_aprovadas() from public,anon,authenticated,service_role;
create trigger sso_continuidades_na_aprovacao after insert on pcm.aprovacao_revisao_tokens for each row execute function pcm.sso_registrar_continuidades_aprovadas();

create function pcm.sso_continuidade_ciclo_autorizada(p_cliente uuid,p_plano uuid,p_versao uuid,p_rotina uuid,p_preparada uuid,p_vencimento date)
returns boolean language plpgsql volatile security definer set search_path='' as $$
begin
 perform 1 from pcm.sso_continuidade_revisao_gate where id and habilitado for share;
 if not found then return false; end if;
 return exists(
  select 1 from pcm.sso_continuidades_ciclo_aprovadas c
  join pcm.ocorrencias_rotina_preparadas o on o.id=c.preparada_id and o.plano_id=c.plano_id and o.vencimento_original=p_vencimento
  join pcm.plano_versoes v on v.id=c.versao_id and v.plano_id=c.plano_id and v.estado='aprovado' and v.vigencia_inicio=c.vigencia
  join pcm.sso_decisoes_impacto_ocorrencia d on d.request_id=c.decisao_request_id and d.rascunho_id=c.versao_id and d.preparada_id=o.id and d.decisao='manter_sem_alterar'
  cross join lateral jsonb_array_elements(case when jsonb_typeof(v.snapshot->'rotinas')='array' then v.snapshot->'rotinas' else '[]'::jsonb end) r(item)
  where c.cliente_id=p_cliente and c.plano_id=p_plano and c.versao_id=p_versao and c.preparada_id=p_preparada
    and p_vencimento>=c.vigencia and r.item->>'id'=p_rotina::text and r.item->>'modo'='calendario'
    and r.item->>'rotina_logica_id'=o.rotina_logica_id::text and r.item->>'alvo_tipo'=o.alvo_tipo
    and coalesce(r.item->>'sistema_id',r.item->>'equipamento_id',r.item->>'grupo_id')=o.alvo_id::text
 );
end; $$;
revoke all on function pcm.sso_continuidade_ciclo_autorizada(uuid,uuid,uuid,uuid,uuid,date) from public,anon,authenticated,service_role;

-- Alteração cirúrgica no núcleo instalado, preservando ordem e verificações anteriores.
do $migracao$
declare v_def text:=pg_catalog.pg_get_functiondef('pcm.sso_materializar_ciclo_canonico(uuid,uuid,uuid,uuid,uuid,integer,date)'::regprocedure);
 v_antes text:=$antes$then raise exception 'coincidencia_data_exige_reconciliacao' using errcode='23514';end if;$antes$;
 v_depois text:=$depois$and not pcm.sso_continuidade_ciclo_autorizada(p_cliente_id,p_plano_id,p_versao_id,p_rotina_id,v_preparada,p_vencimento) then raise exception 'coincidencia_data_exige_reconciliacao' using errcode='23514';end if;$depois$;
begin
 if (length(v_def)-length(replace(v_def,v_antes,'')))/length(v_antes)<>1 then raise exception 'definicao_ciclo_incompativel' using errcode='55000'; end if;
 execute replace(v_def,v_antes,v_depois);
end; $migracao$;
