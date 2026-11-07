-- ADR-0521: somente leitura, sem expor conteúdo de outros Clientes.
create table pcm.sso_historico_cadastro_lotes_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_historico_cadastro_lotes_gate(id,habilitado) values(true,false);
alter table pcm.sso_historico_cadastro_lotes_gate enable row level security;alter table pcm.sso_historico_cadastro_lotes_gate force row level security;
revoke all on pcm.sso_historico_cadastro_lotes_gate from public,anon,authenticated,service_role;
create function pcm.sso_historico_cadastro_levantamentos(p_cliente_id uuid,p_tipo text,p_entidade_id uuid,p_apos uuid,p_limite integer)
returns table(request_id uuid,lote_id uuid,linha_chave text,revisao_lote integer,operacao text,motivo text,ator_id uuid,ocorrido_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare v_existe boolean:=false;
begin
 if not coalesce((select habilitado from pcm.sso_historico_cadastro_lotes_gate where id),false) then raise exception 'historico_desabilitado' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_entidade_id is null or p_tipo is null or p_tipo not in ('area','local','sublocal','sistema','equipamento','componente','grupo_quantitativo') or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if config.sso_autorizar_acao('cadastro.aprovar',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_tipo='area' then select exists(select 1 from pcm.areas a where a.id=p_entidade_id and a.cliente_id=p_cliente_id and a.ativo and a.deleted_at is null) into v_existe;
 elsif p_tipo in ('local','sublocal') then select exists(select 1 from pcm.locais l join pcm.areas a on a.id=l.area_id where l.id=p_entidade_id and a.cliente_id=p_cliente_id and a.ativo and a.deleted_at is null and l.ativo and l.deleted_at is null and ((p_tipo='local' and l.parent_id is null) or (p_tipo='sublocal' and l.parent_id is not null))) into v_existe;
 elsif p_tipo='sistema' then select exists(select 1 from pcm.sistemas s where s.id=p_entidade_id and s.cliente_id=p_cliente_id and s.ativo and s.deleted_at is null) into v_existe;
 elsif p_tipo='grupo_quantitativo' then select exists(select 1 from pcm.grupos_quantitativos g where g.id=p_entidade_id and g.cliente_id=p_cliente_id and g.ativo and g.deleted_at is null) into v_existe;
 else select exists(select 1 from pcm.equipamentos e where e.id=p_entidade_id and e.client_id=p_cliente_id and e.tipo=p_tipo and e.ativo and e.deleted_at is null) into v_existe; end if;
 if not v_existe then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select x.request_id,x.lote_id,x.linha_chave,x.revisao_lote,x.operacao,x.motivo,x.ator_id,x.ocorrido_em from (
   select i.request_id,i.lote_id,i.linha_chave,i.revisao revisao_lote,coalesce(c.payload->>'operacao','nao_identificada') operacao,c.payload->>'motivo' motivo,i.ator_id,i.ocorrido_em
   from pcm.sso_levantamento_incorporacoes i join pcm.sso_levantamentos l on l.id=i.lote_id and l.cliente_id=p_cliente_id left join pcm.sso_levantamento_comandos c on c.request_id=i.request_id
   where i.tipo=p_tipo and i.entidade_id=p_entidade_id
   union all
   select a.request_id,a.lote_id,a.linha_chave,a.revisao,'atualizar_localizacao'::text,c.payload->>'motivo',a.ator_id,a.criado_em
   from pcm.sso_atualizacoes_localizacao a join pcm.sso_levantamentos l on l.id=a.lote_id and l.cliente_id=p_cliente_id left join pcm.sso_levantamento_comandos c on c.request_id=a.request_id
   where a.tipo=p_tipo and a.entidade_id=p_entidade_id
 ) x where p_apos is null or x.request_id>p_apos order by x.request_id limit p_limite;
end; $$;
revoke all on function pcm.sso_historico_cadastro_levantamentos(uuid,text,uuid,uuid,integer) from public,anon,authenticated,service_role;
