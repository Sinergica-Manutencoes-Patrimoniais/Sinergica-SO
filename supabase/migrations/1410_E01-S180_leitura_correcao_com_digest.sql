-- ADR-1257: reconhece correção mediada; gates existentes permanecem fechados.
create or replace function pcm.sso_comprovante_unificado_servico(p_usuario_id uuid,p_despesa_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_papel text;v_claims text;v_sub text;v_gate boolean;v_caminho text;v_objeto uuid;v_digest text;v_relacionados bigint;v_validos bigint;
begin
 if auth.role() is distinct from 'service_role' or p_usuario_id is null or p_despesa_id is null then raise exception 'sem_acesso' using errcode='42501'; end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 select habilitado into v_gate from pcm.sso_leitura_comprovante_unificada_gate where id for share;
 if not coalesce(v_gate,false) then raise exception 'leitura_desabilitada' using errcode='55000'; end if;
 select papel into v_papel from config.usuarios where user_id=p_usuario_id and ativo;
 if v_papel is null then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_claims:=current_setting('request.jwt.claims',true);v_sub:=current_setting('request.jwt.claim.sub',true);
 perform pg_catalog.set_config('request.jwt.claims',jsonb_build_object('sub',p_usuario_id::text,'user_role',v_papel)::text,true);
 perform pg_catalog.set_config('request.jwt.claim.sub',p_usuario_id::text,true);
 -- A 1013 tornou a entrada legada incompatível com reservas mediadas.
 -- O resolvedor de serviço deve usar a seleção interna antes de conferir digest.
 v_caminho:=pcm.sso_comprovante_despesa_caminho_interno(p_despesa_id);
 select o.id into v_objeto from storage.objects o join storage.buckets b on b.id=o.bucket_id where o.bucket_id='sso-despesas-visita' and o.name=v_caminho and b.public is false;
 if v_objeto is null then raise exception 'sem_acesso' using errcode='42501'; end if;
 select count(*) into v_relacionados from pcm.sso_ingestao_comprovante_reservas r left join pcm.sso_ingestao_comprovante_confirmacoes c on c.request_id=r.request_id where r.caminho=v_caminho or c.objeto_id=v_objeto;
 if v_relacionados>0 then
   select count(*),min(r.digest) into v_validos,v_digest from pcm.sso_ingestao_comprovante_reservas r join pcm.sso_ingestao_comprovante_confirmacoes c on c.request_id=r.request_id where r.despesa_id=p_despesa_id and exists(select 1 from pcm.despesas_visita d where d.id=r.despesa_id and d.cliente_id=r.cliente_id) and (exists(select 1 from pcm.despesa_visita_realizacoes a where a.request_id=r.request_id and a.despesa_id=r.despesa_id and a.comprovante_objeto_id=c.objeto_id and a.comprovante_caminho=r.caminho) or exists(select 1 from pcm.despesa_visita_correcoes_realizacao x where x.request_id=r.request_id and x.despesa_id=r.despesa_id and x.objeto_novo=c.objeto_id and x.caminho_novo=r.caminho)) and r.caminho=v_caminho and c.objeto_id=v_objeto;
   if v_relacionados<>1 or v_validos<>1 then raise exception 'origem_ambigua' using errcode='42501'; end if;
   select habilitado into v_gate from pcm.sso_ingestao_comprovante_gate where id for share; if not coalesce(v_gate,false) then raise exception 'leitura_desabilitada' using errcode='55000'; end if;
   select habilitado into v_gate from pcm.sso_upload_comprovante_gate where id for share; if not coalesce(v_gate,false) then raise exception 'leitura_desabilitada' using errcode='55000'; end if;
 end if;
 perform pg_catalog.set_config('request.jwt.claims',coalesce(v_claims,''),true);perform pg_catalog.set_config('request.jwt.claim.sub',coalesce(v_sub,''),true);
 return jsonb_build_object('origem',case when v_relacionados=0 then 'legado' else 'mediado' end,'objetoId',v_objeto,'caminho',v_caminho,'digest',v_digest);
end $$;

create or replace function pcm.sso_comprovante_historico_unificado_servico(p_usuario_id uuid,p_despesa_id uuid,p_revisao integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_papel text;v_claims text;v_sub text;v_gate boolean;v_cliente uuid;v_objeto uuid;v_caminho text;v_digest text;v_relacionados bigint;v_validos bigint;v_historicos bigint;
begin
 if auth.role() is distinct from 'service_role' or p_usuario_id is null or p_despesa_id is null or p_revisao is null or p_revisao<1 then raise exception 'sem_acesso' using errcode='42501'; end if;
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 select habilitado into v_gate from pcm.sso_leitura_comprovante_unificada_gate where id for share; if not coalesce(v_gate,false) then raise exception 'leitura_desabilitada' using errcode='55000'; end if;
 select papel into v_papel from config.usuarios where user_id=p_usuario_id and ativo;
 if v_papel is null then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_claims:=current_setting('request.jwt.claims',true);v_sub:=current_setting('request.jwt.claim.sub',true);
 perform pg_catalog.set_config('request.jwt.claims',jsonb_build_object('sub',p_usuario_id::text,'user_role',v_papel)::text,true);
 perform pg_catalog.set_config('request.jwt.claim.sub',p_usuario_id::text,true);
 select cliente_id into v_cliente from pcm.despesas_visita where id=p_despesa_id;
 if v_cliente is null or config.sso_autorizar_acao('despesa_visita.gerir',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select count(*), (array_agg(h.objeto_id))[1], min(h.caminho) into v_historicos,v_objeto,v_caminho from (
  select r.comprovante_objeto_id as objeto_id,r.comprovante_caminho as caminho from pcm.despesa_visita_realizacoes r where r.despesa_id=p_despesa_id and r.revisao=p_revisao
  union all select c.objeto_novo,c.caminho_novo from pcm.despesa_visita_correcoes_realizacao c where c.despesa_id=p_despesa_id and c.revisao=p_revisao
 ) h;
 if v_historicos<>1 then raise exception 'origem_ambigua' using errcode='42501'; end if;
 if v_objeto is null or not exists(select 1 from storage.objects o join storage.buckets b on b.id=o.bucket_id where o.id=v_objeto and o.name=v_caminho and o.bucket_id='sso-despesas-visita' and b.public is false) then raise exception 'sem_acesso' using errcode='42501'; end if;
 select count(*) into v_relacionados from pcm.sso_ingestao_comprovante_reservas r left join pcm.sso_ingestao_comprovante_confirmacoes c on c.request_id=r.request_id where r.caminho=v_caminho or c.objeto_id=v_objeto;
 if v_relacionados>0 then
  select count(*),min(r.digest) into v_validos,v_digest from pcm.sso_ingestao_comprovante_reservas r join pcm.sso_ingestao_comprovante_confirmacoes c on c.request_id=r.request_id where r.despesa_id=p_despesa_id and exists(select 1 from pcm.despesas_visita d where d.id=r.despesa_id and d.cliente_id=r.cliente_id) and (exists(select 1 from pcm.despesa_visita_realizacoes a where a.request_id=r.request_id and a.despesa_id=r.despesa_id and a.comprovante_objeto_id=c.objeto_id and a.comprovante_caminho=r.caminho) or exists(select 1 from pcm.despesa_visita_correcoes_realizacao x where x.request_id=r.request_id and x.despesa_id=r.despesa_id and x.objeto_novo=c.objeto_id and x.caminho_novo=r.caminho)) and r.cliente_id=v_cliente and r.caminho=v_caminho and c.objeto_id=v_objeto;
  if v_relacionados<>1 or v_validos<>1 then raise exception 'origem_ambigua' using errcode='42501'; end if;
  select habilitado into v_gate from pcm.sso_ingestao_comprovante_gate where id for share;if not coalesce(v_gate,false) then raise exception 'leitura_desabilitada' using errcode='55000'; end if;
  select habilitado into v_gate from pcm.sso_upload_comprovante_gate where id for share;if not coalesce(v_gate,false) then raise exception 'leitura_desabilitada' using errcode='55000'; end if;
 end if;
 perform pg_catalog.set_config('request.jwt.claims',coalesce(v_claims,''),true);perform pg_catalog.set_config('request.jwt.claim.sub',coalesce(v_sub,''),true);
 return jsonb_build_object('origem',case when v_relacionados=0 then 'legado' else 'mediado' end,'objetoId',v_objeto,'caminho',v_caminho,'digest',v_digest);
end $$;
