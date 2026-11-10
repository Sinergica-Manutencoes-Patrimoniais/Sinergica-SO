-- ADR-0799. Somente mediação; o gate permanece fechado.
create function pcm.sso_mediar_vinculo_intervalo(
 p_request_id uuid,p_cliente_id uuid,p_disponibilidade_id uuid,p_intervalo_id uuid,
 p_revisao_disponibilidade integer,p_revisao_vinculo integer,p_incluido boolean,p_justificativa text
) returns jsonb language sql security definer set search_path='' as $$
 select pcm.sso_declarar_vinculo_intervalo(p_request_id,p_cliente_id,p_disponibilidade_id,p_intervalo_id,
   p_revisao_disponibilidade,p_revisao_vinculo,p_incluido,p_justificativa);
$$;

create function pcm.sso_consultar_vinculo_intervalo(p_cliente_id uuid,p_disponibilidade_id uuid,p_intervalo_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_disp pcm.capacidade_disponibilidades%rowtype; v_rev integer; v_eventos jsonb; v_count integer;
begin
 if not coalesce((select habilitado from pcm.capacidade_vinculo_intervalo_gate where id),false) then
   raise exception 'vinculo_intervalo_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_disponibilidade_id is null or p_intervalo_id is null
   or config.sso_autorizar_acao('capacidade.gerir',p_cliente_id) is distinct from true then
   raise exception 'vinculo_intervalo_sem_acesso' using errcode='42501'; end if;
 select * into v_disp from pcm.capacidade_disponibilidades where id=p_disponibilidade_id and cliente_id=p_cliente_id;
 if not found or not exists(select 1 from pcm.capacidade_intervalos_declarados where id=p_intervalo_id and disponibilidade_id=p_disponibilidade_id) then
   raise exception 'vinculo_intervalo_sem_acesso' using errcode='42501'; end if;
 select coalesce(max(revisao_vinculo),0) into v_rev from pcm.capacidade_vinculo_intervalo_eventos
   where cliente_id=p_cliente_id and disponibilidade_id=p_disponibilidade_id and intervalo_id=p_intervalo_id and revisao_disponibilidade=v_disp.revisao;
 select count(*),coalesce(jsonb_agg(to_jsonb(e) order by e.criado_em desc,e.request_id desc),'[]'::jsonb) into v_count,v_eventos from (
   select request_id,revisao_disponibilidade,revisao_vinculo,incluido,justificativa,ator_id,criado_em
   from pcm.capacidade_vinculo_intervalo_eventos where cliente_id=p_cliente_id and disponibilidade_id=p_disponibilidade_id and intervalo_id=p_intervalo_id
   order by criado_em desc,request_id desc limit 100
 ) e;
 return jsonb_build_object('clienteId',p_cliente_id,'disponibilidadeId',p_disponibilidade_id,'intervaloId',p_intervalo_id,
   'revisaoDisponibilidade',v_disp.revisao,'revisaoVinculo',v_rev,'historico',v_eventos,'limiteAtingido',v_count=100,'coberturaComprovada',false);
end; $$;
revoke all on function pcm.sso_mediar_vinculo_intervalo(uuid,uuid,uuid,uuid,integer,integer,boolean,text) from public,anon,service_role;
revoke all on function pcm.sso_consultar_vinculo_intervalo(uuid,uuid,uuid) from public,anon,service_role;
grant execute on function pcm.sso_mediar_vinculo_intervalo(uuid,uuid,uuid,uuid,integer,integer,boolean,text) to authenticated;
grant execute on function pcm.sso_consultar_vinculo_intervalo(uuid,uuid,uuid) to authenticated;
