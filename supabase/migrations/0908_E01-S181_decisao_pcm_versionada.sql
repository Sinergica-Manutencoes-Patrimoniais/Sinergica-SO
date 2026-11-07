create table comercial.sso_decisao_pcm_orcamento_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into comercial.sso_decisao_pcm_orcamento_gate(id,habilitado) values(true,false);
alter table comercial.sso_decisao_pcm_orcamento_gate enable row level security;
alter table comercial.sso_decisao_pcm_orcamento_gate force row level security;
revoke all on comercial.sso_decisao_pcm_orcamento_gate from public,anon,authenticated,service_role;
create table comercial.sso_decisoes_pcm_orcamento(request_id uuid primary key,cliente_id uuid not null references pcm.clientes(id),os_id uuid not null references pcm.ordens_servico(id),
 proposta_id uuid not null references comercial.propostas(id),versao integer not null,decisao_id uuid not null unique references comercial.proposta_decisoes(id),
 payload jsonb not null,resultado jsonb not null,ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now());
alter table comercial.sso_decisoes_pcm_orcamento enable row level security;
alter table comercial.sso_decisoes_pcm_orcamento force row level security;
revoke all on comercial.sso_decisoes_pcm_orcamento from public,anon,authenticated,service_role;
create trigger sso_decisao_pcm_orcamento_imutavel before update or delete on comercial.sso_decisoes_pcm_orcamento for each row execute function pcm.sso_proteger_nota_reconciliacao();
create function comercial.sso_decidir_orcamento_pcm(p_request_id uuid,p_cliente_id uuid,p_os_id uuid,p_proposta_id uuid,p_versao integer,p_decisao text,p_motivo text,p_evidencia text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p comercial.propostas%rowtype; anterior comercial.sso_decisoes_pcm_orcamento%rowtype; payload jsonb; resultado jsonb; decisao_id uuid;
begin
 if not coalesce((select habilitado from comercial.sso_decisao_pcm_orcamento_gate where id),false) then raise exception 'indisponivel' using errcode='55000'; end if;
 if auth.uid() is null or p_request_id is null or p_cliente_id is null or p_os_id is null or p_proposta_id is null or p_versao is null or p_versao<1 or p_decisao is null or p_decisao not in ('aceita','recusada')
 or p_motivo is null or length(btrim(p_motivo)) not between 1 and 2000 or p_evidencia is null or length(btrim(p_evidencia)) not between 1 and 1000
 or config.sso_autorizar_acao('orcamento.emitir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso_ou_dados_invalidos' using errcode='42501'; end if;
 payload:=jsonb_build_object('clienteId',p_cliente_id,'osId',p_os_id,'propostaId',p_proposta_id,'versao',p_versao,'decisao',p_decisao,'motivo',btrim(p_motivo),'evidenciaDeclarada',btrim(p_evidencia));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('decisao-pcm-orcamento:'||p_request_id::text,0));
 select * into anterior from comercial.sso_decisoes_pcm_orcamento where request_id=p_request_id;
 if found then if anterior.ator_id is distinct from auth.uid() or anterior.payload is distinct from payload then raise exception 'request_id_conflitante' using errcode='23505'; end if; return anterior.resultado; end if;
 select * into p from comercial.propostas where id=p_proposta_id and deleted_at is null for update;
 if not found or p.status<>'enviada' or p.versao_atual<>p_versao then raise exception 'versao_ou_estado_obsoleto' using errcode='40001'; end if;
 if p.valido_ate is not null and p.valido_ate<current_date then raise exception 'proposta_expirada' using errcode='23514'; end if;
 if not exists(select 1 from comercial.proposta_origens_operacionais o join pcm.listas_materiais l on l.id=o.lista_materiais_id and l.cliente_id=p_cliente_id and l.ordem_servico_id=p_os_id join pcm.ordens_servico os on os.id=p_os_id and os.client_id=p_cliente_id and os.deleted_at is null where o.proposta_id=p_proposta_id and o.ordem_servico_id=p_os_id)
 or not exists(select 1 from comercial.sso_orcamento_publicacoes pub where pub.proposta_id=p_proposta_id and pub.versao=p_versao)
 or not exists(select 1 from comercial.proposta_versoes v where v.proposta_id=p_proposta_id and v.versao=p_versao) then raise exception 'origem_ou_publicacao_indisponivel' using errcode='42501'; end if;
 if p.preco_centavos<p.piso_centavos and (not coalesce((select habilitado from comercial.sso_excecao_preco_gate where id),false) or not exists(select 1 from comercial.sso_excecoes_preco_operacional e where e.proposta_id=p.id and e.versao=p_versao and e.preco_centavos=p.preco_centavos and e.piso_centavos=p.piso_centavos)) then raise exception 'excecao_preco_indisponivel' using errcode='23514'; end if;
 if exists(select 1 from comercial.proposta_decisoes where proposta_id=p.id) then raise exception 'decisao_existente' using errcode='23505'; end if;
 insert into comercial.proposta_decisoes(proposta_id,cliente_id,decisao,motivo,autor_user_id) values(p.id,p_cliente_id,p_decisao,btrim(p_motivo),auth.uid()) returning id into decisao_id;
 if p.preco_centavos<p.piso_centavos then perform pg_catalog.set_config('comercial.forcar_piso','true',true); end if;
 update comercial.propostas set status=p_decisao,updated_at=now(),updated_by=auth.uid() where id=p.id;
 perform pg_catalog.set_config('comercial.forcar_piso','false',true);
 resultado:=jsonb_build_object('requestId',p_request_id,'propostaId',p.id,'osId',p_os_id,'versao',p_versao,'decisao',p_decisao,'evidenciaAutenticada',false,'osCriada',false,'cobrancaCriada',false);
 insert into comercial.sso_decisoes_pcm_orcamento(request_id,cliente_id,os_id,proposta_id,versao,decisao_id,payload,resultado,ator_id) values(p_request_id,p_cliente_id,p_os_id,p.id,p_versao,decisao_id,payload,resultado,auth.uid());
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'orcamento.decisao_pcm','propostas',p.id,jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'osId',p_os_id,'versao',p_versao,'decisao',p_decisao,'decisaoId',decisao_id));
 return resultado;
end $$;
revoke all on function comercial.sso_decidir_orcamento_pcm(uuid,uuid,uuid,uuid,integer,text,text,text) from public,anon,authenticated,service_role;
