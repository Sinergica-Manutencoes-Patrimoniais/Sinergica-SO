-- ADR-0826: mantém leitura legada, nega referência com reserva mediada.
create or replace function pcm.sso_comprovante_despesa_revisao_autorizado(p_despesa_id uuid,p_revisao integer)
returns text language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;v_objeto uuid;v_caminho text;
begin
 if auth.uid() is null or p_despesa_id is null or p_revisao is null or p_revisao<1 then raise exception 'comprovante_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
 select d.cliente_id into v_cliente from pcm.despesas_visita d where d.id=p_despesa_id;
 if v_cliente is null or config.sso_autorizar_acao('despesa_visita.gerir',v_cliente) is not true then raise exception 'comprovante_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
 select h.objeto_id,h.caminho into v_objeto,v_caminho from (
  select r.comprovante_objeto_id as objeto_id,r.comprovante_caminho as caminho from pcm.despesa_visita_realizacoes r where r.despesa_id=p_despesa_id and r.revisao=p_revisao
  union all select c.objeto_novo,c.caminho_novo from pcm.despesa_visita_correcoes_realizacao c where c.despesa_id=p_despesa_id and c.revisao=p_revisao
 ) h;
 if v_objeto is null or not exists(select 1 from storage.objects o join storage.buckets b on b.id=o.bucket_id where o.id=v_objeto and o.name=v_caminho and o.bucket_id='sso-despesas-visita' and b.public is false) then raise exception 'comprovante_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
 if exists(select 1 from pcm.sso_ingestao_comprovante_reservas r left join pcm.sso_ingestao_comprovante_confirmacoes c on c.request_id=r.request_id where r.caminho=v_caminho or c.objeto_id=v_objeto) then raise exception 'comprovante_nao_encontrado_ou_sem_acesso' using errcode='42501'; end if;
 return v_caminho;
end $$;
revoke all on function pcm.sso_comprovante_despesa_revisao_autorizado(uuid,integer) from public,anon,authenticated,service_role;
