create table pcm.sso_consulta_reserva_codigo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_consulta_reserva_codigo_gate(id,habilitado) values(true,false);
alter table pcm.sso_consulta_reserva_codigo_gate enable row level security;alter table pcm.sso_consulta_reserva_codigo_gate force row level security;
revoke all on pcm.sso_consulta_reserva_codigo_gate from public,anon,authenticated,service_role;
create function pcm.sso_consultar_reserva_codigo_linha(p_cliente_id uuid,p_lote_id uuid,p_chave text) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_lote pcm.sso_levantamentos%rowtype;v_reserva pcm.sso_reservas_codigo_parcial%rowtype;v_ciclo integer;
begin
 if not coalesce((select habilitado from pcm.sso_consulta_reserva_codigo_gate where id),false) then raise exception 'consulta_desabilitada' using errcode='55000';end if;
 if auth.uid() is null or p_cliente_id is null or p_lote_id is null or p_chave is null or length(btrim(p_chave)) not between 1 and 200 then raise exception 'parametros_invalidos' using errcode='22023';end if;
 select * into v_lote from pcm.sso_levantamentos where id=p_lote_id and cliente_id=p_cliente_id;
 if not found or config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is not true or not exists(select 1 from pcm.sso_levantamento_linhas l where l.lote_id=p_lote_id and l.chave=p_chave) then raise exception 'linha_nao_encontrada_ou_sem_acesso' using errcode='42501';end if;
 select coalesce((select ciclo from pcm.sso_conferencia_ciclos where lote_id=p_lote_id),1) into v_ciclo;
 select * into v_reserva from pcm.sso_reservas_codigo_parcial where lote_id=p_lote_id and linha_chave=p_chave order by criado_em desc,id desc limit 1;
 if not found then return jsonb_build_object('loteId',p_lote_id,'chave',p_chave,'revision',v_lote.revisao,'cicloAtual',v_ciclo,'situacao','nao_registrada');end if;
 return jsonb_build_object('loteId',p_lote_id,'chave',p_chave,'revision',v_lote.revisao,'cicloAtual',v_ciclo,'cicloReserva',v_reserva.ciclo,'codigo',v_reserva.codigo,'situacao',case when v_reserva.consumida_em is not null then 'consumida' when v_reserva.liberada_em is not null then 'liberada' else 'ativa' end,'criadaEm',v_reserva.criado_em,'consumidaEm',v_reserva.consumida_em,'liberadaEm',v_reserva.liberada_em);
end;$$;
revoke all on function pcm.sso_consultar_reserva_codigo_linha(uuid,uuid,text) from public,anon,authenticated,service_role;
