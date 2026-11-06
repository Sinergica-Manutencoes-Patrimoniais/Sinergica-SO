-- ADR-0665: promove composição integral, sem OS; gate e concessão individuais fechados.
insert into config.sso_acoes(codigo,modulo,nivel,exige_concessao_individual) values('backlog.promover','pcm','escrita',true) on conflict(codigo) do nothing;
insert into config.sso_acao_modulos(acao,modulo,nivel) values('backlog.promover','pcm','escrita') on conflict(acao,modulo) do nothing;
create table pcm.sso_promocao_backlog_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_promocao_backlog_gate enable row level security;alter table pcm.sso_promocao_backlog_gate force row level security;
revoke all on pcm.sso_promocao_backlog_gate from public,anon,authenticated,service_role;
insert into pcm.sso_promocao_backlog_gate(id,habilitado) values(true,false);
create table pcm.sso_promocoes_backlog(request_id uuid primary key,cliente_id uuid not null references pcm.clientes(id),composicao_id uuid not null unique references pcm.sso_backlog_composicoes(id),chamado_id uuid not null unique references pcm.chamados(id),ator_id uuid not null references auth.users(id),payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now());
alter table pcm.sso_promocoes_backlog enable row level security;alter table pcm.sso_promocoes_backlog force row level security;
revoke all on pcm.sso_promocoes_backlog from public,anon,authenticated,service_role;
create trigger sso_promocao_backlog_imutavel before update or delete on pcm.sso_promocoes_backlog for each row execute function pcm.sso_proteger_conferencia_levantamento();
-- Recupera somente texto inequívoco do questionário congelado e vinculado à OS.
create function pcm.sso_descricao_historica_pendencia(p_cliente_id uuid,p_pendencia_id uuid)
returns text language plpgsql stable security definer set search_path='' as $$
declare v_total bigint;v_texto text;v_tipo_valido boolean;
begin
 if auth.uid() is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select count(*),min(q.item->>'texto'),bool_and(jsonb_typeof(q.item->'texto')='string') into v_total,v_texto,v_tipo_valido
 from pcm.sso_pendencias_tecnicas p
 join pcm.respostas_os_preparadas resp on resp.id=p.resposta_id and resp.retorno_id=p.retorno_id and resp.chave_pergunta=p.pergunta
 join pcm.retorno_os_preparado ret on ret.id=p.retorno_id and ret.os_id=p.os_id and ret.rotina_id=p.rotina_id and ret.cliente_id=p_cliente_id
 join pcm.ordens_servico os on os.id=p.os_id and os.client_id=p_cliente_id and os.deleted_at is null and os.ocorrencia_preventiva_id=p.ocorrencia_id
 join pcm.ocorrencias_rotina_vinculos vinc on vinc.ocorrencia_legada_id=p.ocorrencia_id
 join pcm.ocorrencias_rotina_preparadas ocorr on ocorr.id=vinc.ocorrencia_preparada_id and ocorr.rotina_id=ret.rotina_id and ocorr.versao_id=ret.versao_id
 join pcm.planos_manutencao plano on plano.id=ocorr.plano_id and plano.cliente_id=p_cliente_id
 join pcm.plano_versoes versao on versao.id=ret.versao_id and versao.plano_id=plano.id and versao.estado='aprovado'
 cross join lateral jsonb_array_elements(case when jsonb_typeof(versao.snapshot->'rotinas')='array' then versao.snapshot->'rotinas' else '[]'::jsonb end) r(item)
 cross join lateral jsonb_array_elements(case when jsonb_typeof(r.item->'questionario'->'perguntas')='array' then r.item->'questionario'->'perguntas' else '[]'::jsonb end) q(item)
 where p.id=p_pendencia_id and p.cliente_id=p_cliente_id and r.item->>'id'=ret.rotina_id::text
 and (select count(*) from jsonb_array_elements(case when jsonb_typeof(versao.snapshot->'rotinas')='array' then versao.snapshot->'rotinas' else '[]'::jsonb end) ri(item) where ri.item->>'id'=ret.rotina_id::text)=1
 and jsonb_typeof(r.item->'questionario')='object' and r.item->'questionario'->>'id'=r.item->>'questionario_id'
 and q.item->>'id'=resp.chave_pergunta;
 if v_total<>1 or v_tipo_valido is distinct from true or nullif(btrim(v_texto),'') is null or length(btrim(v_texto))>1000 then raise exception 'descricao_historica_indisponivel_ou_ambigua' using errcode='23514'; end if;
 return btrim(v_texto);
end; $$;
revoke all on function pcm.sso_descricao_historica_pendencia(uuid,uuid) from public,anon,authenticated,service_role;
create function pcm.sso_promover_backlog_chamado(p_request_id uuid,p_cliente_id uuid,p_composicao_id uuid,p_expected_revision integer,p_chamado_id uuid,p_titulo text,p_descricao text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_ant pcm.sso_promocoes_backlog%rowtype;v_comp pcm.sso_backlog_composicoes%rowtype;v_p record;v_titulo text:=nullif(btrim(p_titulo),'');v_payload jsonb;v_resultado jsonb;v_numero text;v_qtd integer;v_rev bigint;v_escopo_rev bigint;v_parcela uuid;v_mapa jsonb:='[]'::jsonb;
begin
 if not coalesce((select habilitado from pcm.sso_promocao_backlog_gate where id),false) then raise exception 'promocao_bloqueada' using errcode='55000'; end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_composicao_id is null or p_expected_revision is null or p_expected_revision<1 or p_chamado_id is null or v_titulo is null or length(v_titulo)>200 or length(coalesce(p_descricao,''))>10000 then raise exception 'pedido_invalido' using errcode='22023'; end if;
 if config.sso_autorizar_acao('backlog.promover',p_cliente_id) is distinct from true or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if not exists(select 1 from config.sso_acoes where codigo='backlog.promover' and modulo='pcm' and nivel='escrita' and exige_concessao_individual is true) then raise exception 'capacidade_promocao_incompativel' using errcode='55000'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'composicaoId',p_composicao_id,'expectedRevision',p_expected_revision,'chamadoId',p_chamado_id,'titulo',v_titulo,'descricao',p_descricao);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('promocao-backlog:'||p_request_id::text,0));
 select * into v_ant from pcm.sso_promocoes_backlog where request_id=p_request_id;
 if found then if v_ant.ator_id is distinct from v_actor or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if;return v_ant.resultado;end if;
 select * into v_comp from pcm.sso_backlog_composicoes where id=p_composicao_id and cliente_id=p_cliente_id for update;
 if not found then raise exception 'composicao_indisponivel' using errcode='42501'; end if;
 if v_comp.revisao<>p_expected_revision then raise exception 'revisao_obsoleta' using errcode='40001'; end if;
 if exists(select 1 from pcm.sso_backlog_chamado_vinculos where composicao_id=p_composicao_id) then raise exception 'composicao_ja_vinculada' using errcode='23514'; end if;
 perform p.id from pcm.sso_pendencias_tecnicas p join pcm.sso_backlog_pendencias b on b.pendencia_id=p.id where b.composicao_id=p_composicao_id order by p.id for update of p;
 select count(*) into v_qtd from pcm.sso_backlog_pendencias where composicao_id=p_composicao_id;
 if v_qtd not between 1 and 100 or exists(select 1 from pcm.sso_backlog_pendencias b join pcm.sso_pendencias_tecnicas p on p.id=b.pendencia_id where b.composicao_id=p_composicao_id and (p.cliente_id is distinct from p_cliente_id or p.alvo_tipo is distinct from v_comp.alvo_tipo or p.alvo_id is distinct from v_comp.alvo_id or p.estado<>'aberta' or p.revisao<>b.revisao_origem or length(btrim(p.pergunta)) not between 1 and 1000)) then raise exception 'escopo_indisponivel' using errcode='23514'; end if;
 if config.sso_autorizar_acao('backlog.promover',p_cliente_id) is distinct from true or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('chamado.escopo.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 -- Evita consumir numeração se qualquer comando aninhado estiver fechado.
 if not coalesce((select habilitado from pcm.chamado_os_gate where id),false) or not coalesce((select habilitado from pcm.sso_backlog_chamado_gate where id),false) or not coalesce((select habilitado from pcm.sso_backlog_parcela_gate where id),false) then raise exception 'dependencias_promocao_bloqueadas' using errcode='55000'; end if;
 v_numero:=pcm.fn_proximo_numero_chamado();
 insert into pcm.chamados(id,numero,cliente_id,titulo,descricao,origem,status,created_by,updated_by) values(p_chamado_id,v_numero,p_cliente_id,v_titulo,p_descricao,'manual','aberto',v_actor,v_actor);
 insert into pcm.chamados_eventos(chamado_id,tipo,metadata,created_by) values(p_chamado_id,'criado',jsonb_build_object('requestId',p_request_id,'origemBacklog',p_composicao_id),v_actor);
 for v_p in select p.id,pcm.sso_descricao_historica_pendencia(p_cliente_id,p.id) as descricao from pcm.sso_backlog_pendencias b join pcm.sso_pendencias_tecnicas p on p.id=b.pendencia_id where b.composicao_id=p_composicao_id order by p.id loop
   v_parcela:=gen_random_uuid();select sso_revisao into v_rev from pcm.chamados where id=p_chamado_id;
   perform pcm.sso_comando_escopo_chamado(gen_random_uuid(),p_cliente_id,p_chamado_id,v_rev,'adicionar_parcela',v_parcela,v_p.descricao,null,null);
   v_mapa:=v_mapa||jsonb_build_array(jsonb_build_object('pendenciaId',v_p.id,'parcelaId',v_parcela));
 end loop;
 select sso_revisao into v_rev from pcm.chamados where id=p_chamado_id;
 perform pcm.sso_vincular_backlog_chamado(gen_random_uuid(),p_composicao_id,v_comp.revisao,p_chamado_id,v_rev);
 select revisao into v_escopo_rev from pcm.chamado_escopo_composicoes where chamado_id=p_chamado_id;
 for v_p in select item from jsonb_array_elements(v_mapa) x(item) loop
   perform pcm.sso_vincular_pendencia_parcela(gen_random_uuid(),p_composicao_id,v_comp.revisao,v_rev,v_escopo_rev,(v_p.item->>'pendenciaId')::uuid,(v_p.item->>'parcelaId')::uuid);
 end loop;
 v_resultado:=jsonb_build_object('requestId',p_request_id,'composicaoId',p_composicao_id,'chamadoId',p_chamado_id,'numero',v_numero,'parcelas',v_mapa,'osCriada',false,'promocaoIntegral',true);
 insert into pcm.sso_promocoes_backlog(request_id,cliente_id,composicao_id,chamado_id,ator_id,payload,resultado) values(p_request_id,p_cliente_id,p_composicao_id,p_chamado_id,v_actor,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'backlog.promovido_chamado','sso_backlog_composicoes',p_composicao_id,v_resultado);
 return v_resultado;
end; $$;
revoke all on function pcm.sso_promover_backlog_chamado(uuid,uuid,uuid,integer,uuid,text,text) from public,anon,authenticated,service_role;
