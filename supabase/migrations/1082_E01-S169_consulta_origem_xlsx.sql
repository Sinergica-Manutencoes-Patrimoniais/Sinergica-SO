-- ADR-0904: preparação aditiva, sem ativar leitura ou alterar origens existentes.
create table pcm.sso_origem_xlsx_leitura_gate (
 id boolean primary key default true check (id), habilitado boolean not null default false
);
insert into pcm.sso_origem_xlsx_leitura_gate(id,habilitado) values(true,false);
alter table pcm.sso_origem_xlsx_leitura_gate enable row level security;
alter table pcm.sso_origem_xlsx_leitura_gate force row level security;
revoke all on pcm.sso_origem_xlsx_leitura_gate from public,anon,authenticated,service_role;

create function pcm.sso_consultar_origem_xlsx(p_cliente uuid,p_lote uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ativo boolean; v_origem pcm.sso_origens_xlsx_cronograma%rowtype;
begin
 select habilitado into v_ativo from pcm.sso_origem_xlsx_leitura_gate where id for share;
 if v_ativo is distinct from true then raise exception 'leitura_origem_xlsx_bloqueada' using errcode='55000'; end if;
 select habilitado into v_ativo from pcm.sso_origem_xlsx_cronograma_gate where id for share;
 if v_ativo is distinct from true then raise exception 'origem_xlsx_bloqueada' using errcode='55000'; end if;
 perform pcm.sso_exigir_mediacao_cronograma(p_cliente);
 select habilitado into v_ativo from pcm.sso_cronograma_staging_gate where id for share;
 if v_ativo is distinct from true then raise exception 'cronograma_staging_bloqueado' using errcode='55000'; end if;
 select o.* into v_origem from pcm.sso_origens_xlsx_cronograma o
 join pcm.sso_levantamentos l on l.id=o.lote_id and l.cliente_id=o.cliente_id
 where o.lote_id=p_lote and o.cliente_id=p_cliente and l.origem='planilha' and l.chave_origem like 'cronograma:%'
 for share of o,l;
 if not found then raise exception 'lote_sem_acesso' using errcode='42501'; end if;
 if pg_catalog.encode(pg_catalog.sha256(v_origem.bytes),'hex') is distinct from v_origem.sha256 then
   raise exception 'origem_xlsx_corrompida' using errcode='55000';
 end if;
 insert into audit.events(actor_id,action,entity,entity_id,payload)
 values(auth.uid(),'cronograma.origem_xlsx_consultada','sso_levantamentos',p_lote,
   jsonb_build_object('clienteId',p_cliente,'tamanho',octet_length(v_origem.bytes)));
 return jsonb_build_object('loteId',p_lote,'clienteId',p_cliente,'sha256',v_origem.sha256,'base64',pg_catalog.encode(v_origem.bytes,'base64'));
end; $$;
revoke all on function pcm.sso_consultar_origem_xlsx(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_consultar_origem_xlsx(uuid,uuid) to authenticated;
