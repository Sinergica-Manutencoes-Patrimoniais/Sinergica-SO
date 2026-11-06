-- ADR-1172: proteção adicional sob gate fechado; preserva função e recibos existentes.
create table pcm.sso_intencao_ciencia_os_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_intencao_ciencia_os_gate(id,habilitado) values(true,false);
alter table pcm.sso_intencao_ciencia_os_gate enable row level security;alter table pcm.sso_intencao_ciencia_os_gate force row level security;
revoke all on pcm.sso_intencao_ciencia_os_gate from public,anon,authenticated,service_role;
alter function pcm.sso_registrar_intencao_envio_local(uuid,uuid,uuid,integer) rename to sso_registrar_intencao_envio_local_base_1339;
revoke all on function pcm.sso_registrar_intencao_envio_local_base_1339(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
create function pcm.sso_registrar_intencao_envio_local(p_request_id uuid,p_visita_id uuid,p_os_id uuid,p_revisao integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare resultado jsonb;v pcm.visitas%rowtype;c pcm.visita_confirmacoes%rowtype;
begin
 resultado:=pcm.sso_registrar_intencao_envio_local_base_1339(p_request_id,p_visita_id,p_os_id,p_revisao);
 perform 1 from pcm.sso_intencao_ciencia_os_gate where id and habilitado for share;
 if not found then return resultado; end if;
 select * into v from pcm.visitas where id=p_visita_id and revisao=p_revisao and estado='confirmada' for share nowait;
 if not found or config.sso_autorizar_acao('visita.confirmar',v.cliente_id) is distinct from true then raise exception 'visita_obsoleta_ou_sem_acesso' using errcode='42501'; end if;
 select * into c from pcm.visita_confirmacoes where visita_id=v.id and cliente_id=v.cliente_id and revisao=v.revisao;
 if not found then raise exception 'confirmacao_indisponivel' using errcode='23514'; end if;
 if c.politica_modo='obrigatoria' then
  perform pub.id from pcm.portal_confirmacoes_cliente x join pcm.portal_visita_publicacoes pub on pub.id=x.publicacao_id
   where x.confirmacao_pcm_id=c.id and pub.visita_id=v.id and pub.os_id=p_os_id and pub.cliente_id=v.cliente_id
    and pub.revisao_visita=v.revisao and pub.revogado_em is null for share of pub nowait;
  if not found then raise exception 'ciencia_os_ausente' using errcode='23514'; end if;
 end if;
 return resultado;
end; $$;
revoke all on function pcm.sso_registrar_intencao_envio_local(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
