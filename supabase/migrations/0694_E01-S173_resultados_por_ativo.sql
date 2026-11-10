-- ADR-0468: visão informativa sem criação de Pendência.
create table pcm.sso_resultados_ativo_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_resultados_ativo_gate(id,habilitado) values(true,false);
alter table pcm.sso_resultados_ativo_gate enable row level security;
alter table pcm.sso_resultados_ativo_gate force row level security;
revoke all on pcm.sso_resultados_ativo_gate from public,anon,authenticated,service_role;
create function pcm.sso_listar_resultados_ativo(p_cliente_id uuid,p_alvo_tipo text,p_alvo_id uuid,p_apos uuid,p_limite integer)
returns table(resposta_id uuid,retorno_id uuid,os_id uuid,chave_pergunta text,resultado text,observacao text,fotos_registradas bigint,decisao_retorno text)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_resultados_ativo_gate where id),false) then raise exception 'resultados_desabilitados' using errcode='55000'; end if;
 if auth.uid() is null or p_cliente_id is null or p_alvo_id is null or p_alvo_tipo is null or p_alvo_tipo not in ('sistema','componente','grupo') or p_limite is null or p_limite not between 1 and 100 then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
 return query select resp.id,r.id,r.os_id,resp.chave_pergunta,resp.resultado,resp.observacao,
 (select count(*) from pcm.sso_uploads_evidencia_resposta u join storage.objects o on o.id=u.objeto_id and o.name=u.caminho and o.bucket_id='sso-retorno-evidencias' and split_part(o.name,'/',1)=r.cliente_id::text and split_part(o.name,'/',2)=r.id::text and o.metadata->>'mimetype'=u.mime_declarado join storage.buckets b on b.id=o.bucket_id and b.public is false where u.resposta_id=resp.id and u.retorno_id=r.id),
 case when d.quantidade=1 then d.decisao else null end
 from pcm.respostas_os_preparadas resp join pcm.retorno_os_preparado r on r.id=resp.retorno_id and r.cliente_id=p_cliente_id
 join pcm.rotinas_manutencao rotina on rotina.id=r.rotina_id and rotina.versao_id=r.versao_id and rotina.alvo_tipo=p_alvo_tipo and coalesce(rotina.sistema_id,rotina.equipamento_id,rotina.grupo_id)=p_alvo_id
 join pcm.ordens_servico os on os.id=r.os_id and os.client_id=p_cliente_id and os.deleted_at is null
 left join lateral (select count(*) quantidade,min(x.decisao) decisao from pcm.decisoes_validacao_os x where x.retorno_id=r.id and x.created_at=(select max(y.created_at) from pcm.decisoes_validacao_os y where y.retorno_id=r.id)) d on true
 where resp.resultado in ('corrigido','nao_ok','nao_aplicavel') and (p_apos is null or resp.id>p_apos) order by resp.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_resultados_ativo(uuid,text,uuid,uuid,integer) from public,anon,authenticated,service_role;
