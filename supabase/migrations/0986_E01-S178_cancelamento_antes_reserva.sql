-- ADR-0784: tombstone impede chegada tardia da reserva original.
create table pcm.sso_ingestao_foto_tombstones(
 request_id uuid primary key,cliente_id uuid not null references pcm.clientes(id),lote_id uuid not null,linha_chave text not null,
 ator_id uuid not null references auth.users(id),motivo text not null check(length(btrim(motivo)) between 1 and 2000),criado_em timestamptz not null default now(),
 foreign key(lote_id,linha_chave) references pcm.sso_levantamento_linhas(lote_id,chave)
);
alter table pcm.sso_ingestao_foto_tombstones enable row level security;
alter table pcm.sso_ingestao_foto_tombstones force row level security;
revoke all on pcm.sso_ingestao_foto_tombstones from public,anon,authenticated,service_role;
create function pcm.sso_impedir_reserva_foto_cancelada() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-ingestao-foto:'||new.request_id::text,0));
 if exists(select 1 from pcm.sso_ingestao_foto_tombstones t where t.request_id=new.request_id) then raise exception 'ingestao_cancelada' using errcode='55000'; end if;
 return new;
end; $$;
revoke all on function pcm.sso_impedir_reserva_foto_cancelada() from public,anon,authenticated,service_role;
create trigger sso_impedir_reserva_foto_cancelada before insert on pcm.sso_ingestao_foto_reservas for each row execute function pcm.sso_impedir_reserva_foto_cancelada();
create or replace function pcm.sso_cancelar_ingestao_foto(p_cliente_id uuid,p_request_id uuid,p_lote_id uuid,p_chave text,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_res pcm.sso_ingestao_foto_reservas%rowtype;v_tomb pcm.sso_ingestao_foto_tombstones%rowtype;v_ator uuid:=auth.uid();v_motivo text:=btrim(p_motivo);
begin
 if not coalesce((select habilitado from pcm.sso_ingestao_foto_gate where id),false) or not coalesce((select habilitado from pcm.sso_fotos_levantamento_gate where id),false) then raise exception 'ingestao_desabilitada' using errcode='55000'; end if;
 if v_ator is null or p_cliente_id is null or config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_request_id is null or p_lote_id is null or p_chave is null or v_motivo is null or length(v_motivo) not between 1 and 2000 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if not exists(select 1 from pcm.sso_levantamentos l join pcm.sso_levantamento_linhas i on i.lote_id=l.id where l.id=p_lote_id and l.cliente_id=p_cliente_id and i.chave=p_chave) then raise exception 'sem_acesso' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-ingestao-foto:'||p_request_id::text,0));
 if config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select r.* into v_res from pcm.sso_ingestao_foto_reservas r where r.request_id=p_request_id for update;
 if found then
  if v_res.cliente_id is distinct from p_cliente_id or v_res.lote_id is distinct from p_lote_id or v_res.linha_chave is distinct from p_chave then raise exception 'sem_acesso' using errcode='42501'; end if;
  if v_res.foto_id is not null then raise exception 'foto_ja_confirmada' using errcode='55000'; end if;
  if v_res.cancelado_em is not null then
   if v_res.cancelado_por is distinct from v_ator or v_res.cancelado_motivo is distinct from v_motivo then raise exception 'cancelamento_conflitante' using errcode='23505'; end if;
   return jsonb_build_object('requestId',p_request_id,'estado','cancelada');
  end if;
  update pcm.sso_ingestao_foto_reservas set cancelado_em=clock_timestamp(),cancelado_por=v_ator,cancelado_motivo=v_motivo where request_id=p_request_id;
 else
  select t.* into v_tomb from pcm.sso_ingestao_foto_tombstones t where t.request_id=p_request_id;
  if found then
   if v_tomb.cliente_id is distinct from p_cliente_id or v_tomb.lote_id is distinct from p_lote_id or v_tomb.linha_chave is distinct from p_chave then raise exception 'sem_acesso' using errcode='42501'; end if;
   if v_tomb.ator_id is distinct from v_ator or v_tomb.motivo is distinct from v_motivo then raise exception 'cancelamento_conflitante' using errcode='23505'; end if;
   return jsonb_build_object('requestId',p_request_id,'estado','cancelada');
  end if;
  insert into pcm.sso_ingestao_foto_tombstones(request_id,cliente_id,lote_id,linha_chave,ator_id,motivo) values(p_request_id,p_cliente_id,p_lote_id,p_chave,v_ator,v_motivo);
 end if;
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'levantamento.ingestao_foto_cancelada','sso_levantamentos',p_lote_id,jsonb_build_object('clienteId',p_cliente_id,'requestId',p_request_id,'motivo',v_motivo));
 return jsonb_build_object('requestId',p_request_id,'estado','cancelada');
end; $$;
revoke all on function pcm.sso_cancelar_ingestao_foto(uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_cancelar_ingestao_foto(uuid,uuid,uuid,text,text) to authenticated;
