-- ADR-0782: cancelamento explícito sem exclusão física de objetos.
alter table pcm.sso_ingestao_foto_reservas
 add column cancelado_em timestamptz,
 add column cancelado_por uuid references auth.users(id),
 add column cancelado_motivo text,
 add constraint sso_ingestao_cancelamento_completo check ((cancelado_em is null and cancelado_por is null and cancelado_motivo is null) or (cancelado_em is not null and cancelado_por is not null and cancelado_motivo is not null and length(btrim(cancelado_motivo)) between 1 and 2000 and foto_id is null));
create function pcm.sso_impedir_confirmacao_ingestao_cancelada() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.cancelado_em is not null and new.foto_id is not null then raise exception 'ingestao_cancelada' using errcode='55000'; end if;
 return new;
end; $$;
revoke all on function pcm.sso_impedir_confirmacao_ingestao_cancelada() from public,anon,authenticated,service_role;
create trigger sso_impedir_confirmacao_ingestao_cancelada before update on pcm.sso_ingestao_foto_reservas for each row execute function pcm.sso_impedir_confirmacao_ingestao_cancelada();
create function pcm.sso_cancelar_ingestao_foto(p_cliente_id uuid,p_request_id uuid,p_lote_id uuid,p_chave text,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_res pcm.sso_ingestao_foto_reservas%rowtype;v_ator uuid:=auth.uid();v_motivo text:=btrim(p_motivo);
begin
 if not coalesce((select habilitado from pcm.sso_ingestao_foto_gate where id),false) or not coalesce((select habilitado from pcm.sso_fotos_levantamento_gate where id),false) then raise exception 'ingestao_desabilitada' using errcode='55000'; end if;
 if v_ator is null or p_cliente_id is null or config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_request_id is null or p_lote_id is null or p_chave is null or v_motivo is null or length(v_motivo) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 select r.* into v_res from pcm.sso_ingestao_foto_reservas r join pcm.sso_levantamentos l on l.id=r.lote_id and l.cliente_id=r.cliente_id join pcm.sso_levantamento_linhas i on i.lote_id=r.lote_id and i.chave=r.linha_chave where r.request_id=p_request_id and r.cliente_id=p_cliente_id and r.lote_id=p_lote_id and r.linha_chave=p_chave for update of r;
 if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
 if config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if v_res.foto_id is not null then raise exception 'foto_ja_confirmada' using errcode='55000'; end if;
 if v_res.cancelado_em is not null then
  if v_res.cancelado_por is distinct from v_ator or v_res.cancelado_motivo is distinct from v_motivo then raise exception 'cancelamento_conflitante' using errcode='23505'; end if;
  return jsonb_build_object('requestId',p_request_id,'estado','cancelada');
 end if;
 update pcm.sso_ingestao_foto_reservas set cancelado_em=clock_timestamp(),cancelado_por=v_ator,cancelado_motivo=v_motivo where request_id=p_request_id;
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'levantamento.ingestao_foto_cancelada','sso_levantamentos',p_lote_id,jsonb_build_object('clienteId',p_cliente_id,'requestId',p_request_id,'motivo',v_motivo));
 return jsonb_build_object('requestId',p_request_id,'estado','cancelada');
end; $$;
revoke all on function pcm.sso_cancelar_ingestao_foto(uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_cancelar_ingestao_foto(uuid,uuid,uuid,text,text) to authenticated;
