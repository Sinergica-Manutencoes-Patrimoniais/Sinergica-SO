-- ADR-1478: decisão da revisão acompanha a ocorrência por Visita.
create table pcm.sso_continuidades_visita_aprovadas(
 cliente_id uuid not null,plano_id uuid not null references pcm.planos_manutencao(id),
 versao_id uuid not null references pcm.plano_versoes(id),preparada_id uuid not null references pcm.ocorrencias_visita_preparadas(id),
 decisao_request_id uuid not null references pcm.sso_decisoes_impacto_visita(request_id),vigencia date not null,
 criado_em timestamptz not null default now(),primary key(versao_id,preparada_id)
);
alter table pcm.sso_continuidades_visita_aprovadas enable row level security;
alter table pcm.sso_continuidades_visita_aprovadas force row level security;
revoke all on pcm.sso_continuidades_visita_aprovadas from public,anon,authenticated,service_role;
create trigger sso_continuidades_visita_imutaveis before update or delete on pcm.sso_continuidades_visita_aprovadas for each row execute function pcm.sso_proteger_conferencia_levantamento();

-- Manter a avaliação de calendário e acrescentar as fontes de Visita ao mesmo token.
do $migracao$
declare v_def text:=pg_catalog.pg_get_functiondef('pcm.sso_registrar_continuidades_aprovadas()'::regprocedure);
 v_decl text:='v_calendario jsonb;v_grupos jsonb;';
 v_avaliar text:=$antes$ v_grupos:=pcm.sso_avaliar_fotografias_grupo_mediada(auth.uid(),v_plano.cliente_id,new.plano_id,v_plano.revisao);$antes$;
 v_validar text:=$antes$ if (v_calendario->>'revisaoPlano')::integer is distinct from v_plano.revisao$antes$;
 v_final text:=$antes$ return new;
end; $antes$;
 v_novo_final text:=$depois$ insert into pcm.sso_continuidades_visita_aprovadas(cliente_id,plano_id,versao_id,preparada_id,decisao_request_id,vigencia)
 select v_plano.cliente_id,new.plano_id,v_rascunho,o.id,d.request_id,new.vigencia_inicio
 from pcm.ocorrencias_visita_preparadas o
 join lateral (select x.* from pcm.sso_decisoes_impacto_visita x where x.rascunho_id=v_rascunho and x.preparada_id=o.id order by x.revisao desc limit 1) d on true
 where o.plano_id=new.plano_id and o.versao_id=new.versao_anterior_id
   and d.decisao='manter_sem_alterar' and d.revisao_plano=v_plano.revisao;
 return new;
end; $depois$;
begin
 if (length(v_def)-length(replace(v_def,v_decl,'')))/length(v_decl)<>1
  or (length(v_def)-length(replace(v_def,v_avaliar,'')))/length(v_avaliar)<>1
  or (length(v_def)-length(replace(v_def,v_validar,'')))/length(v_validar)<>1
  or (length(v_def)-length(replace(v_def,v_final,'')))/length(v_final)<>1 then raise exception 'definicao_continuidade_incompativel' using errcode='55000'; end if;
 v_def:=replace(v_def,v_decl,'v_calendario jsonb;v_grupos jsonb;v_visitas jsonb;');
 v_def:=replace(v_def,v_avaliar,v_avaliar||E'\n v_visitas:=pcm.sso_avaliar_fontes_impacto_visita_legado(v_plano.cliente_id,new.plano_id,v_plano.revisao);');
 v_def:=replace(v_def,v_validar,$novo$ if (v_visitas->>'revisaoPlano')::integer is distinct from v_plano.revisao
  or (v_visitas->>'visitasSemIdentidade')::bigint is distinct from 0
  or (v_visitas->>'decisoesVisitaAusentes')::bigint is distinct from 0
  or (v_visitas->>'decisoesVisitaObsoletas')::bigint is distinct from 0
  or (v_visitas->>'visitasExigemReconciliacao')::bigint is distinct from 0
  or (v_visitas->>'visitasSemPonteLegada')::bigint is distinct from 0
  or (v_visitas->>'legadasSemPonteObservada')::bigint is distinct from 0
  or (v_calendario->>'revisaoPlano')::integer is distinct from v_plano.revisao$novo$);
 execute replace(v_def,v_final,v_novo_final);
end; $migracao$;

create function pcm.sso_continuidade_visita_autorizada(p_cliente uuid,p_plano uuid,p_versao uuid,p_rotina uuid,p_preparada uuid,p_visita uuid,p_vencimento date)
returns boolean language plpgsql volatile security definer set search_path='' as $$
begin
 perform 1 from pcm.sso_continuidade_revisao_gate where id and habilitado for share;
 if not found then return true; end if;
 if exists(select 1 from pcm.ocorrencias_visita_preparadas o where o.id=p_preparada and o.plano_id=p_plano and o.versao_id=p_versao and o.visita_id=p_visita) then return true; end if;
 return exists(
  select 1 from pcm.sso_continuidades_visita_aprovadas c
  join pcm.ocorrencias_visita_preparadas o on o.id=c.preparada_id and o.plano_id=c.plano_id and o.visita_id=p_visita
  join pcm.plano_versoes v on v.id=c.versao_id and v.plano_id=c.plano_id and v.estado='aprovado' and v.vigencia_inicio=c.vigencia
  join pcm.sso_decisoes_impacto_visita d on d.request_id=c.decisao_request_id and d.rascunho_id=c.versao_id and d.preparada_id=o.id and d.decisao='manter_sem_alterar'
  cross join lateral jsonb_array_elements(case when jsonb_typeof(v.snapshot->'rotinas')='array' then v.snapshot->'rotinas' else '[]'::jsonb end) r(item)
  where c.cliente_id=p_cliente and c.plano_id=p_plano and c.versao_id=p_versao and c.preparada_id=p_preparada
    and p_vencimento>=c.vigencia and r.item->>'id'=p_rotina::text and r.item->>'modo'='visita'
    and r.item->>'rotina_logica_id'=o.rotina_logica_id::text and r.item->>'alvo_tipo'=o.alvo_tipo
    and coalesce(r.item->>'sistema_id',r.item->>'equipamento_id',r.item->>'grupo_id')=o.alvo_id::text
 );
end; $$;
revoke all on function pcm.sso_continuidade_visita_autorizada(uuid,uuid,uuid,uuid,uuid,uuid,date) from public,anon,authenticated,service_role;

-- A verificação ocorre antes de substituir o vencimento calculado pelo histórico.
do $migracao$
declare v_def text:=pg_catalog.pg_get_functiondef('pcm.sso_preparar_ocorrencia_por_visita(uuid,uuid,uuid,uuid,uuid,uuid,integer,text)'::regprocedure);
 v_antes text:=$antes$    -- O recibo deve refletir a data histórica salva, não a data calculada$antes$;
 v_depois text:=$depois$    if not pcm.sso_continuidade_visita_autorizada(v_plano.cliente_id,p_plano_id,p_versao_id,p_rotina_id,v_existente,p_visita_id,v_vencimento) then raise exception 'continuidade_visita_nao_aprovada' using errcode='23514'; end if;
    -- O recibo deve refletir a data histórica salva, não a data calculada$depois$;
begin
 if (length(v_def)-length(replace(v_def,v_antes,'')))/length(v_antes)<>1 then raise exception 'definicao_visita_incompativel' using errcode='55000'; end if;
 execute replace(v_def,v_antes,v_depois);
end; $migracao$;
