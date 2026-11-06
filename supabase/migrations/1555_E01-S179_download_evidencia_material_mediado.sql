-- ADR-1411: caminho privado apenas para a função de serviço autenticada.
create table pcm.sso_download_evidencia_material_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_download_evidencia_material_gate(id,habilitado) values(true,false);
alter table pcm.sso_download_evidencia_material_gate enable row level security;
alter table pcm.sso_download_evidencia_material_gate force row level security;
revoke all on pcm.sso_download_evidencia_material_gate from public,anon,authenticated,service_role;

create function pcm.sso_caminho_evidencia_material_servico(p_usuario_id uuid,p_evidencia_id uuid) returns text
language plpgsql volatile security definer set search_path='' as $$
declare v_papel text; v_claims text; v_sub text; v_role text; v_caminho text;
begin
 if current_setting('transaction_isolation')<>'read committed' or coalesce(auth.role(),'')<>'service_role' or p_usuario_id is null or p_evidencia_id is null then raise exception 'sem_acesso' using errcode='42501'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_download_evidencia_material_gate where id and habilitado for share;
 if not found then raise exception 'download_desabilitado' using errcode='55000'; end if;
 perform 1 from pcm.sso_material_evidencia_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 select u.papel into v_papel from config.usuarios u where u.user_id=p_usuario_id and u.ativo and u.papel<>'cliente-sindico' for share;
 if v_papel is null then raise exception 'sem_acesso' using errcode='42501'; end if;
 -- Reutiliza a autorização canônica em vez de copiá-la; apenas serviço pode definir esta identidade.
 v_claims:=current_setting('request.jwt.claims',true);
 v_sub:=current_setting('request.jwt.claim.sub',true); v_role:=current_setting('request.jwt.claim.role',true);
 perform pg_catalog.set_config('request.jwt.claims',jsonb_build_object('sub',p_usuario_id,'role','authenticated','user_role',v_papel)::text,true);
 perform pg_catalog.set_config('request.jwt.claim.sub',p_usuario_id::text,true);
 perform pg_catalog.set_config('request.jwt.claim.role','authenticated',true);
 v_caminho:=pcm.sso_caminho_evidencia_material(p_evidencia_id);
 perform pg_catalog.set_config('request.jwt.claims',coalesce(v_claims,''),true);
 perform pg_catalog.set_config('request.jwt.claim.sub',coalesce(v_sub,''),true);
 perform pg_catalog.set_config('request.jwt.claim.role',coalesce(v_role,''),true);
 return v_caminho;
end; $$;
revoke all on function pcm.sso_caminho_evidencia_material_servico(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_caminho_evidencia_material_servico(uuid,uuid) to service_role;
