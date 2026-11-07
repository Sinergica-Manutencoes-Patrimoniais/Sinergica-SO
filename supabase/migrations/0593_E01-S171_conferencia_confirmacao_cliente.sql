-- ADR-0367: prévia independente, nunca autoriza envio.
create table pcm.conferencia_confirmacao_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.conferencia_confirmacao_gate(id,habilitado) values(true,false);
alter table pcm.conferencia_confirmacao_gate enable row level security;
alter table pcm.conferencia_confirmacao_gate force row level security;
revoke all on pcm.conferencia_confirmacao_gate from public,anon,authenticated,service_role;
create function pcm.sso_conferir_confirmacao_cliente_visita(p_visita_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v pcm.visitas%rowtype; c pcm.visita_confirmacoes%rowtype; pol record; v_situacao text; v_encontrada boolean:=false;
begin
  if auth.uid() is null or p_visita_id is null then raise exception 'dados_invalidos' using errcode='22023'; end if;
  select * into v from pcm.visitas where id=p_visita_id;
  if not found or config.sso_autorizar_acao('visita.confirmar',v.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  if not coalesce((select habilitado from pcm.conferencia_confirmacao_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
  select * into pol from pcm.sso_resolver_ciencia_visita(v.id);
  select * into c from pcm.visita_confirmacoes where visita_id=v.id and cliente_id=v.cliente_id and revisao=v.revisao;
  if v.estado<>'confirmada' or c.id is null then v_situacao:='pendente_pcm';
  elsif pol.modo is distinct from c.politica_modo or pol.origem is distinct from c.politica_origem
    or pol.politica_id is distinct from c.politica_id or pol.politica_revisao is distinct from c.politica_revisao then v_situacao:='politica_desatualizada';
  elsif pol.modo<>'obrigatoria' then v_situacao:='nao_exigida';
  elsif not coalesce((select habilitado from pcm.portal_confirmacao_cliente_gate where id),false)
    or not coalesce((select habilitado from pcm.portal_visita_gate where id),false) then v_situacao:='fonte_indisponivel';
  else
    select exists(select 1 from pcm.portal_confirmacoes_cliente x join pcm.portal_visita_publicacoes pub on pub.id=x.publicacao_id
      join pcm.visita_ordens_servico vo on vo.visita_id=pub.visita_id and vo.os_id=pub.os_id and vo.cliente_id=pub.cliente_id and vo.encerrado_em is null
      join pcm.ordens_servico o on o.id=vo.os_id and o.client_id=vo.cliente_id and o.deleted_at is null
      where x.confirmacao_pcm_id=c.id and pub.visita_id=v.id and pub.cliente_id=v.cliente_id and pub.revisao_visita=v.revisao and pub.revogado_em is null) into v_encontrada;
    v_situacao:=case when v_encontrada then 'confirmada_portal' else 'confirmacao_pendente' end;
  end if;
  return jsonb_build_object('visitaId',v.id,'revision',v.revisao,'politicaModo',pol.modo,'situacao',v_situacao,'confirmacaoEncontrada',v_encontrada,'autorizaEnvio',false);
end $$;
revoke all on function pcm.sso_conferir_confirmacao_cliente_visita(uuid) from public,anon,authenticated,service_role;
