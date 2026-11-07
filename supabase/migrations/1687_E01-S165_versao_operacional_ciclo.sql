-- ADR-1544: fundamento privado; nenhum selo é criado por esta migration.
-- A origem da ocorrência continua imutável e a guarda 1045 permanece intacta.
create table pcm.sso_versoes_operacionais_ciclo (
 tipo text not null check(tipo in ('calendario','visita')),
 cliente_id uuid not null, plano_id uuid not null references pcm.planos_manutencao(id),
 preparada_id uuid not null, versao_id uuid not null references pcm.plano_versoes(id),
 rotina_id uuid not null, vigencia date not null, decisao_request_id uuid not null,
 criado_em timestamptz not null default clock_timestamp(),
 primary key(tipo,versao_id,preparada_id)
);
alter table pcm.sso_versoes_operacionais_ciclo enable row level security;
alter table pcm.sso_versoes_operacionais_ciclo force row level security;
revoke all on pcm.sso_versoes_operacionais_ciclo from public,anon,authenticated,service_role;
create trigger sso_versoes_operacionais_ciclo_imutaveis before update or delete on pcm.sso_versoes_operacionais_ciclo
 for each row execute function pcm.sso_proteger_conferencia_levantamento();

-- Interna: conserva origem para ocorrências sem escolha aprovada e vigente.
-- Escritor e gatilho de aprovação serão adicionados junto à decisão explícita do PCM.
create function pcm.sso_versao_operacional_ciclo(p_cliente uuid,p_plano uuid,p_preparada uuid,p_tipo text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_versao uuid;v_rotina uuid;v_logica uuid;v_alvo_tipo text;v_alvo uuid;v_data date;
 v_atual record;v_total integer;v_item jsonb;v_n integer;
begin
 if p_tipo='calendario' then
  select o.versao_id,o.rotina_id,o.rotina_logica_id,o.alvo_tipo,o.alvo_id,o.vencimento_original
   into v_versao,v_rotina,v_logica,v_alvo_tipo,v_alvo,v_data
   from pcm.ocorrencias_rotina_preparadas o join pcm.planos_manutencao p on p.id=o.plano_id and p.cliente_id=p_cliente
   where o.id=p_preparada and o.plano_id=p_plano;
 elsif p_tipo='visita' then
  select o.versao_id,o.rotina_id,o.rotina_logica_id,o.alvo_tipo,o.alvo_id,o.vencimento_original
   into v_versao,v_rotina,v_logica,v_alvo_tipo,v_alvo,v_data
   from pcm.ocorrencias_visita_preparadas o join pcm.planos_manutencao p on p.id=o.plano_id and p.cliente_id=p_cliente
   where o.id=p_preparada and o.plano_id=p_plano;
 else raise exception 'tipo_invalido' using errcode='22023'; end if;
 if not found then raise exception 'ocorrencia_indisponivel' using errcode='42501';end if;
 select count(*) into v_total from pcm.sso_versoes_operacionais_ciclo s
 join pcm.plano_versoes v on v.id=s.versao_id and v.plano_id=s.plano_id and v.estado='aprovado' and v.vigencia_inicio=s.vigencia
 where s.tipo=p_tipo and s.cliente_id=p_cliente and s.plano_id=p_plano and s.preparada_id=p_preparada
  and s.vigencia<=v_data and (v.vigencia_fim is null or v_data<=v.vigencia_fim)
  and s.vigencia<=pcm.sso_data_civil_transicao_plano(p_plano,v.id,s.vigencia);
 if v_total>1 then raise exception 'versao_operacional_ambigua' using errcode='23514';end if;
 if v_total=1 then
  select s.versao_id,s.rotina_id,v.snapshot into v_atual from pcm.sso_versoes_operacionais_ciclo s
  join pcm.plano_versoes v on v.id=s.versao_id and v.plano_id=s.plano_id and v.estado='aprovado' and v.vigencia_inicio=s.vigencia
  where s.tipo=p_tipo and s.cliente_id=p_cliente and s.plano_id=p_plano and s.preparada_id=p_preparada
   and s.vigencia<=v_data and (v.vigencia_fim is null or v_data<=v.vigencia_fim)
   and s.vigencia<=pcm.sso_data_civil_transicao_plano(p_plano,v.id,s.vigencia);
  select count(*),min(r.item::text)::jsonb into v_n,v_item from jsonb_array_elements(case when jsonb_typeof(v_atual.snapshot->'rotinas')='array' then v_atual.snapshot->'rotinas' else '[]'::jsonb end) r(item)
   where r.item->>'id'=v_atual.rotina_id::text and r.item->>'rotina_logica_id'=v_logica::text and r.item->>'modo'=p_tipo
    and r.item->>'alvo_tipo'=v_alvo_tipo and coalesce(r.item->>'sistema_id',r.item->>'equipamento_id',r.item->>'grupo_id')=v_alvo::text;
  if v_n<>1 then raise exception 'versao_operacional_divergente' using errcode='23514';end if;
  v_versao:=v_atual.versao_id;v_rotina:=v_atual.rotina_id;
 end if;
 return jsonb_build_object('versaoId',v_versao,'rotinaId',v_rotina);
end; $$;
revoke all on function pcm.sso_versao_operacional_ciclo(uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
