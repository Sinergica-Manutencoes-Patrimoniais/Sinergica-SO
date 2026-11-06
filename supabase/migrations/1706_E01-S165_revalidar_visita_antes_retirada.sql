-- ADR-1562: revalidar candidata sob as mesmas travas antes de retirar a fila antiga.
create function pcm.sso_candidata_substituicao_visita_atual(p_cliente uuid,p_plano uuid,p_versao uuid,p_preparada uuid,p_request uuid)
returns boolean language plpgsql volatile security definer set search_path='' as $$
declare v record; v_foto jsonb;
begin
 select e.candidata,e.visita_id into v from pcm.sso_substituicoes_visita_aprovadas s
 join pcm.sso_escolhas_nova_data_visita e on e.request_id=s.escolha_request_id
 where s.versao_id=p_versao and s.preparada_id=p_preparada and s.escolha_request_id=p_request
 and e.cliente_id=p_cliente and e.plano_id=p_plano and e.preparada_id=p_preparada and e.rascunho_id=p_versao and e.visita_id=s.visita_id;
 if not found then return false;end if;
 begin
  v_foto:=pcm.sso_fotografar_candidata_nova_visita(p_cliente,p_plano,p_preparada,v.visita_id,null);
 exception when check_violation or insufficient_privilege then return false;end;
 return v_foto is not distinct from v.candidata;
end; $$;
revoke all on function pcm.sso_candidata_substituicao_visita_atual(uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;

do $migracao$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_aplicar_retiradas_fila(uuid,uuid,uuid,uuid,integer,text,uuid)'::regprocedure);
 a text:=$a$if (v_item.tipo='calendario' and v_estado is distinct from 'candidata_aguardando')$a$;
 b text:=$b$if v_item.tipo='visita' and exists(select 1 from pcm.sso_substituicoes_visita_aprovadas s where s.versao_id=v_item.versao_id and s.preparada_id=v_item.preparada_id and s.escolha_request_id=v_item.resolucao_request_id) and not pcm.sso_candidata_substituicao_visita_atual(p_cliente_id,p_plano_id,v_item.versao_id,v_item.preparada_id,v_item.resolucao_request_id) then
   v_pendentes:=v_pendentes+1;continue;
  end if;
  if (v_item.tipo='calendario' and v_estado is distinct from 'candidata_aguardando')$b$;
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'retirada_revalidacao_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $migracao$;
