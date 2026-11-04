-- ADR-1503: decisão de retirar não resolve mudança de regra com escopo ainda presente.
create function pcm.sso_escopo_impacto_retirado(
 p_cliente uuid,p_plano uuid,p_rascunho uuid,p_preparada uuid,p_tipo text
) returns boolean language sql stable security definer set search_path='' as $$
 select exists (
  select 1 from pcm.planos_manutencao p
  join pcm.plano_versoes v on v.plano_id=p.id and v.id=p_rascunho
  join (
   select id,plano_id,rotina_logica_id,alvo_tipo,alvo_id,'calendario'::text tipo from pcm.ocorrencias_rotina_preparadas
   union all
   select id,plano_id,rotina_logica_id,alvo_tipo,alvo_id,'visita'::text tipo from pcm.ocorrencias_visita_preparadas
  ) o on o.id=p_preparada and o.plano_id=p.id and o.tipo=p_tipo
  where p.id=p_plano and p.cliente_id=p_cliente
   and not exists (
    select 1 from pcm.rotinas_manutencao r
    where r.plano_id=p.id and r.versao_id=v.id and r.rotina_logica_id=o.rotina_logica_id
     and r.alvo_tipo=o.alvo_tipo
     and case r.alvo_tipo when 'sistema' then r.sistema_id when 'componente' then r.equipamento_id when 'grupo' then r.grupo_id end=o.alvo_id
   )
 );
$$;
revoke all on function pcm.sso_escopo_impacto_retirado(uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;

create function pcm.sso_verificar_resolucao_retirada() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 -- Trava impede inserção ou atualização concorrente de Rotina entre a prova e o commit.
 lock table pcm.rotinas_manutencao in share mode nowait;
 if pcm.sso_escopo_impacto_retirado(new.cliente_id,new.plano_id,new.rascunho_id,new.preparada_id,new.tipo) is distinct from true then
  raise exception 'escopo_nao_retirado_ou_indeterminado' using errcode='23514';
 end if;
 return new;
end; $$;
revoke all on function pcm.sso_verificar_resolucao_retirada() from public,anon,authenticated,service_role;
create trigger sso_verificar_resolucao_retirada before insert on pcm.sso_resolucoes_impacto_revisao
 for each row execute function pcm.sso_verificar_resolucao_retirada();

-- Resoluções históricas inválidas não suprimem a pendência na avaliação.
do $migracao$
declare v_assinatura text;v_def text;
 v_antes text:='and rr.rascunho_id=v_rascunho))';
 v_depois text:='and rr.rascunho_id=v_rascunho and pcm.sso_escopo_impacto_retirado(rr.cliente_id,rr.plano_id,rr.rascunho_id,rr.preparada_id,rr.tipo)))';
begin
 for v_assinatura in select unnest(array['pcm.sso_avaliar_decisoes_impacto(uuid,uuid,integer)','pcm.sso_avaliar_fontes_impacto_visita_legado(uuid,uuid,integer)']) loop
  v_def:=pg_catalog.pg_get_functiondef(v_assinatura::regprocedure);
  if (length(v_def)-length(replace(v_def,v_antes,'')))/length(v_antes)<>1 then
   raise exception 'definicao_avaliacao_incompativel: %',v_assinatura using errcode='55000';
  end if;
  execute replace(v_def,v_antes,v_depois);
 end loop;
end; $migracao$;

create function pcm.sso_verificar_retiradas_antes_aprovacao() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_plano pcm.planos_manutencao%rowtype;v_rascunho uuid;v_previa jsonb;
begin
 perform 1 from pcm.sso_continuidade_revisao_gate where id and habilitado for share;
 if not found then return new; end if;
 select * into v_plano from pcm.planos_manutencao where id=new.plano_id for update nowait;
 if not found then raise exception 'plano_indisponivel' using errcode='23514'; end if;
 lock table pcm.rotinas_manutencao in share mode nowait;
 v_previa:=pcm.sso_previa_revisao_revisionada(new.plano_id,v_plano.revisao,1,null);
 v_rascunho:=(v_previa->>'versaoRascunhoId')::uuid;
 if v_rascunho is null then raise exception 'rascunho_indisponivel' using errcode='23514'; end if;
 if exists (
  select 1 from pcm.sso_resolucoes_impacto_revisao rr
  where rr.cliente_id=v_plano.cliente_id and rr.plano_id=new.plano_id and rr.rascunho_id=v_rascunho and rr.revisao_plano=v_plano.revisao
   and ((rr.tipo='calendario' and rr.decisao_request_id=(select d.request_id from pcm.sso_decisoes_impacto_ocorrencia d where d.rascunho_id=v_rascunho and d.preparada_id=rr.preparada_id order by d.revisao desc limit 1))
     or (rr.tipo='visita' and rr.decisao_request_id=(select d.request_id from pcm.sso_decisoes_impacto_visita d where d.rascunho_id=v_rascunho and d.preparada_id=rr.preparada_id order by d.revisao desc limit 1)))
   and pcm.sso_escopo_impacto_retirado(rr.cliente_id,rr.plano_id,rr.rascunho_id,rr.preparada_id,rr.tipo) is distinct from true
 ) then raise exception 'retirada_escopo_presente_ou_indeterminado' using errcode='23514'; end if;
 return new;
end; $$;
revoke all on function pcm.sso_verificar_retiradas_antes_aprovacao() from public,anon,authenticated,service_role;
create trigger sso_validar_retiradas_antes_aprovacao before insert on pcm.aprovacao_revisao_tokens
 for each row execute function pcm.sso_verificar_retiradas_antes_aprovacao();
