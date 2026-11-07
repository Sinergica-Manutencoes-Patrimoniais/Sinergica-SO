-- ADR-0615: identidade interna de declaração, não prova de fato físico.
create table financeiro.sso_fato_execucao_declarado_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into financeiro.sso_fato_execucao_declarado_gate(id,habilitado) values(true,false);
alter table financeiro.sso_fato_execucao_declarado_gate enable row level security;
alter table financeiro.sso_fato_execucao_declarado_gate force row level security;
revoke all on financeiro.sso_fato_execucao_declarado_gate from public,anon,authenticated,service_role;
create table financeiro.sso_fatos_execucao_declarados(id uuid primary key,cliente_id uuid not null references pcm.clientes(id),
 vinculo_id uuid not null unique references financeiro.sso_vinculos_resposta_servico(id),resposta_id uuid not null unique references pcm.respostas_os_preparadas(id),
 retorno_id uuid not null references pcm.retorno_os_preparado(id),revisao_id uuid not null references pcm.sso_revisoes_validacao_os(id),
 motivo text not null check(length(btrim(motivo)) between 1 and 1000),ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now());
alter table financeiro.sso_fatos_execucao_declarados enable row level security;
alter table financeiro.sso_fatos_execucao_declarados force row level security;
revoke all on financeiro.sso_fatos_execucao_declarados from public,anon,authenticated,service_role;
create trigger sso_fato_execucao_declarado_imutavel before update or delete on financeiro.sso_fatos_execucao_declarados for each row execute function pcm.sso_proteger_nota_reconciliacao();
create function financeiro.sso_identificar_fato_execucao_declarado(p_request_id uuid,p_cliente_id uuid,p_vinculo_id uuid,p_revisao_id uuid,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a financeiro.sso_fatos_execucao_declarados%rowtype; v financeiro.sso_vinculos_resposta_servico%rowtype;
 e pcm.sso_evidencias_por_resposta%rowtype; r pcm.retorno_os_preparado%rowtype; rev pcm.sso_revisoes_validacao_os%rowtype; n bigint; nvers bigint; ultima integer;
begin
 if not coalesce((select habilitado from financeiro.sso_fato_execucao_declarado_gate where id),false)
   or not coalesce((select habilitado from financeiro.sso_vinculo_resposta_servico_gate where id),false)
   or not coalesce((select habilitado from pcm.sso_revisao_validacao_os_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
 if auth.uid() is null or p_request_id is null or p_cliente_id is null or p_vinculo_id is null or p_revisao_id is null
   or p_motivo is null or length(btrim(p_motivo)) not between 1 and 1000
   or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso_ou_dados_invalidos' using errcode='42501'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('fato-execucao-declarado:'||p_request_id::text,0));
 select * into a from financeiro.sso_fatos_execucao_declarados where id=p_request_id;
 if found then
   if a.cliente_id<>p_cliente_id or a.ator_id is distinct from auth.uid() or a.vinculo_id<>p_vinculo_id or a.revisao_id<>p_revisao_id or a.motivo is distinct from btrim(p_motivo) then raise exception 'request_id_conflitante' using errcode='23505'; end if;
   return jsonb_build_object('fatoId',a.id,'execucaoComprovada',false,'geraFaturavel',false);
 end if;
 select * into v from financeiro.sso_vinculos_resposta_servico where id=p_vinculo_id and cliente_id=p_cliente_id;
 if not found then raise exception 'referencia_indisponivel' using errcode='42501'; end if;
 select * into e from pcm.sso_evidencias_por_resposta where id=v.vinculo_evidencia_id and resposta_id=v.resposta_id;
 if not found then raise exception 'referencia_indisponivel' using errcode='42501'; end if;
 select * into r from pcm.retorno_os_preparado where id=e.retorno_id and cliente_id=p_cliente_id for update;
 if not found then raise exception 'referencia_indisponivel' using errcode='42501'; end if;
 select count(*) into n from pcm.decisoes_validacao_os where retorno_id=r.id;
 select count(*),coalesce(max(revisao),0) into nvers,ultima from pcm.sso_revisoes_validacao_os where retorno_id=r.id;
 select * into rev from pcm.sso_revisoes_validacao_os where id=p_revisao_id and retorno_id=r.id and revisao=ultima;
 if not found or n<>nvers or not exists(select 1 from pcm.decisoes_validacao_os where id=rev.decisao_id and retorno_id=r.id and decisao='aprovar') then raise exception 'revisao_nao_aprovada_ou_obsoleta' using errcode='40001'; end if;
 insert into financeiro.sso_fatos_execucao_declarados(id,cliente_id,vinculo_id,resposta_id,retorno_id,revisao_id,motivo,ator_id)
   values(p_request_id,p_cliente_id,v.id,v.resposta_id,r.id,rev.id,btrim(p_motivo),auth.uid());
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'execucao.fato_declarado_identificado','ordens_servico',r.os_id,jsonb_build_object('fatoId',p_request_id,'clienteId',p_cliente_id,'vinculoId',v.id,'revisaoId',rev.id));
 return jsonb_build_object('fatoId',p_request_id,'execucaoComprovada',false,'geraFaturavel',false);
end $$;
revoke all on function financeiro.sso_identificar_fato_execucao_declarado(uuid,uuid,uuid,uuid,text) from public,anon,authenticated,service_role;
