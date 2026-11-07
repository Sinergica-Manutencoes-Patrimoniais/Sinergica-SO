-- ADR-0820: separa seleção interna de acesso legado, sem abrir gates.
create function pcm.sso_comprovante_despesa_caminho_interno(p_despesa_id uuid)
returns text language plpgsql stable security definer set search_path='' as $$
declare v_caminho text;
begin
 if auth.uid() is null or p_despesa_id is null then raise exception 'comprovante_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
 select coalesce(c.caminho_novo,r.comprovante_caminho) into v_caminho
 from pcm.despesas_visita d join pcm.despesa_visita_realizacoes r on r.despesa_id=d.id
 left join lateral (select cor.objeto_novo,cor.caminho_novo from pcm.despesa_visita_correcoes_realizacao cor where cor.despesa_id=d.id order by cor.revisao desc limit 1) c on true
 join storage.objects o on o.id=coalesce(c.objeto_novo,r.comprovante_objeto_id) and o.name=coalesce(c.caminho_novo,r.comprovante_caminho)
 join storage.buckets b on b.id=o.bucket_id and b.public is false
 where d.id=p_despesa_id and o.bucket_id='sso-despesas-visita' and config.sso_autorizar_acao('despesa_visita.gerir',d.cliente_id) is true;
 if v_caminho is null then raise exception 'comprovante_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
 return v_caminho;
end $$;
revoke all on function pcm.sso_comprovante_despesa_caminho_interno(uuid) from public,anon,authenticated,service_role;

create or replace function pcm.sso_comprovante_despesa_autorizado(p_despesa_id uuid)
returns text language plpgsql stable security definer set search_path='' as $$
declare v_caminho text;
begin
 v_caminho:=pcm.sso_comprovante_despesa_caminho_interno(p_despesa_id);
 if exists(select 1 from pcm.sso_ingestao_comprovante_reservas where caminho=v_caminho) then raise exception 'comprovante_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
 return v_caminho;
end $$;
revoke all on function pcm.sso_comprovante_despesa_autorizado(uuid) from public,anon,authenticated,service_role;

-- Substituição estrita e fail-closed: abortar se assinatura/corpo anterior divergir.
do $$
declare v_assinatura regprocedure;v_def text;v_alterada text;
begin
 foreach v_assinatura in array array['pcm.sso_comprovante_digest_servico(uuid,uuid)'::regprocedure,'pcm.sso_comprovante_unificado_servico(uuid,uuid)'::regprocedure] loop
   v_def:=pg_catalog.pg_get_functiondef(v_assinatura);
   v_alterada:=replace(v_def,'pcm.sso_comprovante_despesa_autorizado(p_despesa_id)','pcm.sso_comprovante_despesa_caminho_interno(p_despesa_id)');
   if v_alterada=v_def then raise exception 'resolvedor_anterior_incompativel' using errcode='55000'; end if;
   execute v_alterada;
 end loop;
end $$;
