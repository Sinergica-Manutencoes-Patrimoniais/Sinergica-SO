-- ADR-0501: resolvedor privado comum; não libera validação nem fila operacional.
create table pcm.sso_origem_execucao_unificada_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_origem_execucao_unificada_gate enable row level security;
alter table pcm.sso_origem_execucao_unificada_gate force row level security;
revoke all on pcm.sso_origem_execucao_unificada_gate from public,anon,authenticated,service_role;
insert into pcm.sso_origem_execucao_unificada_gate(id,habilitado) values(true,false);

create function pcm.sso_resolver_origem_execucao(p_cliente_id uuid,p_ocorrencia_legada_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_leg pcm.ocorrencias_preventivas%rowtype;v_legado pcm.planos_preventivos%rowtype;v_origem jsonb;v_total integer;v_versao pcm.plano_versoes%rowtype;v_rotina jsonb;v_n integer;
begin
 if not coalesce((select habilitado from pcm.sso_origem_execucao_unificada_gate where id),false) then raise exception 'origem_execucao_bloqueada' using errcode='55000';end if;
 if auth.uid() is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 select o.* into v_leg from pcm.ocorrencias_preventivas o join pcm.planos_preventivos p on p.id=o.plano_id and p.cliente_id=p_cliente_id where o.id=p_ocorrencia_legada_id;
 if not found then raise exception 'ocorrencia_indisponivel' using errcode='42501';end if;
 select * into v_legado from pcm.planos_preventivos where id=v_leg.plano_id and cliente_id=p_cliente_id;
 with origens as (
  select jsonb_build_object('tipo','calendario','planoId',o.plano_id,'versaoId',o.versao_id,'rotinaId',o.rotina_id,'rotinaLogicaId',o.rotina_logica_id,'alvoTipo',o.alvo_tipo,'alvoId',o.alvo_id,'vencimento',o.vencimento_original,'preparadaId',o.id) item from pcm.ocorrencias_rotina_vinculos v join pcm.ocorrencias_rotina_preparadas o on o.id=v.ocorrencia_preparada_id where v.ocorrencia_legada_id=v_leg.id
  union all
  select jsonb_build_object('tipo','visita','planoId',o.plano_id,'versaoId',o.versao_id,'rotinaId',o.rotina_id,'rotinaLogicaId',o.rotina_logica_id,'alvoTipo',o.alvo_tipo,'alvoId',o.alvo_id,'vencimento',o.vencimento_original,'preparadaId',o.id,'visitaId',o.visita_id,'serieId',o.serie_id,'semanaOrigem',o.semana_origem) from pcm.sso_vinculos_visita_legado v join pcm.ocorrencias_visita_preparadas o on o.id=v.ocorrencia_visita_id where v.ocorrencia_legada_id=v_leg.id and v.cliente_id=p_cliente_id
 ) select count(*),min(item::text)::jsonb into v_total,v_origem from origens;
 if v_total<>1 then raise exception 'origem_indisponivel_ou_ambigua' using errcode='23514';end if;
 if not exists(select 1 from pcm.planos_manutencao p where p.id=(v_origem->>'planoId')::uuid and p.cliente_id=p_cliente_id) or v_origem->>'vencimento' is distinct from v_leg.vencimento::text or not ((v_origem->>'alvoTipo'='sistema' and v_origem->>'alvoId'=v_legado.sistema_id::text) or (v_origem->>'alvoTipo'='componente' and v_origem->>'alvoId'=v_legado.equipamento_id::text)) then raise exception 'origem_incompativel' using errcode='23514';end if;
 if v_origem->>'tipo'='visita' and not exists(select 1 from pcm.visita_origem_contratual o join pcm.visitas v on v.id=o.visita_id and v.cliente_id=o.cliente_id where o.visita_id=(v_origem->>'visitaId')::uuid and o.cliente_id=p_cliente_id and o.serie_id=(v_origem->>'serieId')::uuid and o.semana_origem=(v_origem->>'semanaOrigem')::date) then raise exception 'origem_visita_nao_comprovada' using errcode='23514';end if;
 select * into v_versao from pcm.plano_versoes where id=(v_origem->>'versaoId')::uuid and plano_id=(v_origem->>'planoId')::uuid and estado='aprovado';
 if not found or jsonb_typeof(v_versao.snapshot->'rotinas') is distinct from 'array' then raise exception 'snapshot_indisponivel' using errcode='23514';end if;
 select count(*),min(item::text)::jsonb into v_n,v_rotina from jsonb_array_elements(v_versao.snapshot->'rotinas') x(item) where item->>'id'=v_origem->>'rotinaId';
 if v_n<>1 or v_rotina->>'rotina_logica_id' is distinct from v_origem->>'rotinaLogicaId' or v_rotina->>'alvo_tipo' is distinct from v_origem->>'alvoTipo' or coalesce(v_rotina->>'sistema_id',v_rotina->>'equipamento_id',v_rotina->>'grupo_id') is distinct from v_origem->>'alvoId' or v_rotina->>'modo' is distinct from v_origem->>'tipo' then raise exception 'rotina_historica_incompativel' using errcode='23514';end if;
 return v_origem||jsonb_build_object('ocorrenciaLegadaId',v_leg.id,'execucaoAutorizada',false,'aprovacaoAutorizada',false,'filaOficialAlterada',false);
end; $$;
revoke all on function pcm.sso_resolver_origem_execucao(uuid,uuid) from public,anon,authenticated,service_role;
