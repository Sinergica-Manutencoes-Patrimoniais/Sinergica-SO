-- ADR-0819: seleção conservadora, sem alterar políticas ou leitores legados.
create table pcm.sso_leitura_comprovante_unificada_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_leitura_comprovante_unificada_gate(id,habilitado) values(true,false);
alter table pcm.sso_leitura_comprovante_unificada_gate enable row level security;
alter table pcm.sso_leitura_comprovante_unificada_gate force row level security;
revoke all on pcm.sso_leitura_comprovante_unificada_gate from public,anon,authenticated,service_role;

create function pcm.sso_comprovante_unificado_servico(p_usuario_id uuid,p_despesa_id uuid)
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
 v_caminho:=pcm.sso_comprovante_despesa_autorizado(p_despesa_id);
 select o.id into v_objeto from storage.objects o join storage.buckets b on b.id=o.bucket_id where o.bucket_id='sso-despesas-visita' and o.name=v_caminho and b.public is false;
 if v_objeto is null then raise exception 'sem_acesso' using errcode='42501'; end if;
 select count(*) into v_relacionados from pcm.sso_ingestao_comprovante_reservas r left join pcm.sso_ingestao_comprovante_confirmacoes c on c.request_id=r.request_id where r.caminho=v_caminho or c.objeto_id=v_objeto;
 if v_relacionados>0 then
   select count(*),min(r.digest) into v_validos,v_digest from pcm.sso_ingestao_comprovante_reservas r join pcm.sso_ingestao_comprovante_confirmacoes c on c.request_id=r.request_id join pcm.despesa_visita_realizacoes a on a.request_id=r.request_id and a.despesa_id=r.despesa_id and a.comprovante_objeto_id=c.objeto_id and a.comprovante_caminho=r.caminho where r.despesa_id=p_despesa_id and r.caminho=v_caminho and c.objeto_id=v_objeto;
   if v_relacionados<>1 or v_validos<>1 then raise exception 'origem_ambigua' using errcode='42501'; end if;
   select habilitado into v_gate from pcm.sso_ingestao_comprovante_gate where id for share; if not coalesce(v_gate,false) then raise exception 'leitura_desabilitada' using errcode='55000'; end if;
   select habilitado into v_gate from pcm.sso_upload_comprovante_gate where id for share; if not coalesce(v_gate,false) then raise exception 'leitura_desabilitada' using errcode='55000'; end if;
 end if;
 perform pg_catalog.set_config('request.jwt.claims',coalesce(v_claims,''),true);perform pg_catalog.set_config('request.jwt.claim.sub',coalesce(v_sub,''),true);
 return jsonb_build_object('origem',case when v_relacionados=0 then 'legado' else 'mediado' end,'objetoId',v_objeto,'caminho',v_caminho,'digest',v_digest);
end $$;
revoke all on function pcm.sso_comprovante_unificado_servico(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_comprovante_unificado_servico(uuid,uuid) to service_role;
