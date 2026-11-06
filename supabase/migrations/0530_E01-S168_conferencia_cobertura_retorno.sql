-- ADR-0304: cobertura estrutural com atestação humana, sem comprovação externa.
create table pcm.sso_conferencia_cobertura_retorno_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_conferencia_cobertura_retorno_gate enable row level security;
alter table pcm.sso_conferencia_cobertura_retorno_gate force row level security;
revoke all on pcm.sso_conferencia_cobertura_retorno_gate from public,anon,authenticated,service_role;
insert into pcm.sso_conferencia_cobertura_retorno_gate(id,habilitado) values(true,false);
create table pcm.sso_conferencias_cobertura_retorno (
 id uuid primary key default gen_random_uuid(),request_id uuid not null unique,retorno_id uuid not null references pcm.retorno_os_preparado(id),
 evidencia_id uuid not null references pcm.retorno_evidencias_declaradas(id),revisao_evidencias integer not null,perguntas integer not null check(perguntas>0),
 justificativa text not null check(length(btrim(justificativa)) between 1 and 2000),payload jsonb not null,
 ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now()
);
alter table pcm.sso_conferencias_cobertura_retorno enable row level security;
alter table pcm.sso_conferencias_cobertura_retorno force row level security;
revoke all on pcm.sso_conferencias_cobertura_retorno from public,anon,authenticated,service_role;
create trigger sso_conferencia_cobertura_imutavel before update or delete on pcm.sso_conferencias_cobertura_retorno for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_conferir_cobertura_retorno(p_request_id uuid,p_cliente_id uuid,p_retorno_id uuid,p_evidencia_id uuid,p_expected_evidencias integer,p_justificativa text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid();v_retorno pcm.retorno_os_preparado%rowtype;v_anterior pcm.sso_conferencias_cobertura_retorno%rowtype;v_payload jsonb;v_snapshot jsonb;v_rotina jsonb;v_perguntas jsonb;v_num integer;v_revisao integer;v_id uuid;
begin
 if not coalesce((select habilitado from pcm.validacao_os_gate where id),false) or not coalesce((select habilitado from pcm.origem_campo_inbox_gate where id),false) or not coalesce((select habilitado from pcm.sso_conferencia_cobertura_retorno_gate where id),false) then raise exception 'conferencia_cobertura_bloqueada' using errcode='55000'; end if;
 if v_actor is null or p_request_id is null or p_cliente_id is null or p_retorno_id is null or p_expected_evidencias is null or p_expected_evidencias<0 or p_justificativa is null or length(btrim(p_justificativa)) not between 1 and 2000 then raise exception 'conferencia_invalida' using errcode='22023'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'retornoId',p_retorno_id,'evidenciaId',p_evidencia_id,'expectedEvidencias',p_expected_evidencias,'justificativa',btrim(p_justificativa));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text,0));
 select * into v_retorno from pcm.retorno_os_preparado where id=p_retorno_id and cliente_id=p_cliente_id and origem='manual_declarado' for update;
 if not found or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_anterior from pcm.sso_conferencias_cobertura_retorno where request_id=p_request_id;
 if found then if v_anterior.ator_id is distinct from v_actor or v_anterior.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505'; end if; return jsonb_build_object('conferenciaId',v_anterior.id,'retornoId',p_retorno_id,'coberturaEstrutural',true,'evidenciaExternaComprovada',false,'requestId',p_request_id); end if;
 select coalesce(max(revisao),0) into v_revisao from pcm.retorno_evidencias_declaradas where retorno_id=p_retorno_id;
 if v_revisao<>p_expected_evidencias then raise exception 'evidencia_obsoleta_ou_indisponivel' using errcode='40001'; end if;
 if p_evidencia_id is not null and not exists(select 1 from pcm.retorno_evidencias_declaradas where id=p_evidencia_id and retorno_id=p_retorno_id) then raise exception 'evidencia_obsoleta_ou_indisponivel' using errcode='40001'; end if;
 if p_evidencia_id is null and not exists(select 1 from pcm.sso_checar_evidencias_snapshot(p_cliente_id,p_retorno_id) d where (d->>'requisitoIndeterminado')::integer=0 and (d->>'exigenciasAplicaveis')::integer=0) then raise exception 'evidencia_exigida_ou_indeterminada' using errcode='23514'; end if;
 select v.snapshot into v_snapshot from pcm.retorno_campo_classificacoes cl join pcm.origem_campo_inbox i on i.id=cl.envelope_id and i.integracao='auvo'
 join pcm.origem_campo_resolucoes res on res.id=cl.resolucao_id and res.envelope_id=i.id and res.cliente_id=p_cliente_id and res.resultado='os_identificada'
 join pcm.ordens_servico os on os.id=v_retorno.os_id and os.id=res.os_id and os.client_id=p_cliente_id and os.deleted_at is null and os.auvo_task_id=i.task_id
 join pcm.clientes cli on cli.id=p_cliente_id and cli.deleted_at is null and cli.auvo_id::text=i.cliente_externo_id
 join pcm.ocorrencias_rotina_vinculos vinc on vinc.ocorrencia_legada_id=os.ocorrencia_preventiva_id
 join pcm.ocorrencias_rotina_preparadas oc on oc.id=vinc.ocorrencia_preparada_id and oc.versao_id=v_retorno.versao_id and oc.rotina_id=v_retorno.rotina_id
 join pcm.planos_manutencao p on p.id=oc.plano_id and p.cliente_id=p_cliente_id join pcm.plano_versoes v on v.id=oc.versao_id and v.plano_id=p.id and v.estado='aprovado'
 where cl.retorno_id=p_retorno_id and not exists(select 1 from pcm.origem_campo_resolucoes newer where newer.envelope_id=i.id and (newer.criada_em,newer.id)>(res.criada_em,res.id));
 if not found or jsonb_typeof(v_snapshot->'rotinas') is distinct from 'array' then raise exception 'vinculo_nao_comprovado' using errcode='23514'; end if;
 select count(*),min(x.item::text)::jsonb into v_num,v_rotina from jsonb_array_elements(v_snapshot->'rotinas') x(item) where x.item->>'id'=v_retorno.rotina_id::text;
 if v_num<>1 or jsonb_typeof(v_rotina->'questionario') is distinct from 'object' or v_rotina->'questionario'->>'id' is distinct from v_rotina->>'questionario_id' or v_rotina->>'questionario_id' is null then raise exception 'questionario_indisponivel' using errcode='23514'; end if;
 v_perguntas:=v_rotina->'questionario'->'perguntas';
 if jsonb_typeof(v_perguntas) is distinct from 'array' or jsonb_array_length(v_perguntas)=0 then raise exception 'perguntas_indisponiveis' using errcode='23514'; end if;
 if exists(select 1 from jsonb_array_elements(v_perguntas) x(item) where jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'id') not in ('string','number') or nullif(btrim(item->>'id'),'') is null)
 or exists(select 1 from jsonb_array_elements(v_perguntas) x(item) group by item->>'id' having count(*)>1)
 or exists(select 1 from jsonb_array_elements(v_perguntas) x(item)
   where not exists(select 1 from pcm.respostas_os_preparadas r where r.retorno_id=p_retorno_id and r.chave_pergunta=item->>'id' and r.resultado in ('ok','nao_ok','nao_aplicavel','corrigido'))
   and not (
     (select count(*) from jsonb_array_elements(case when jsonb_typeof(v_snapshot->'contratos_perguntas')='array' then v_snapshot->'contratos_perguntas' else '[]'::jsonb end) c(item)
       where c.item->>'rotinaId'=v_retorno.rotina_id::text and c.item->>'questionarioId'=v_rotina->>'questionario_id' and c.item->>'perguntaId'=x.item->>'id')=1
     and exists(select 1 from jsonb_array_elements(case when jsonb_typeof(v_snapshot->'contratos_perguntas')='array' then v_snapshot->'contratos_perguntas' else '[]'::jsonb end) c(item)
       where c.item->>'rotinaId'=v_retorno.rotina_id::text and c.item->>'questionarioId'=v_rotina->>'questionario_id' and c.item->>'perguntaId'=x.item->>'id' and jsonb_typeof(c.item->'obrigatoria')='boolean' and c.item->>'obrigatoria'='false')
   ))
 or exists(select 1 from pcm.respostas_os_preparadas r where r.retorno_id=p_retorno_id and r.resultado='nao_inspecionado')
 or exists(select 1 from pcm.respostas_os_preparadas r where r.retorno_id=p_retorno_id and not exists(select 1 from jsonb_array_elements(v_perguntas) x(item) where item->>'id'=r.chave_pergunta)) then raise exception 'cobertura_estrutural_incompleta' using errcode='23514'; end if;
 if config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 insert into pcm.sso_conferencias_cobertura_retorno(request_id,retorno_id,evidencia_id,revisao_evidencias,perguntas,justificativa,payload,ator_id) values(p_request_id,p_retorno_id,p_evidencia_id,v_revisao,jsonb_array_length(v_perguntas),btrim(p_justificativa),v_payload,v_actor) returning id into v_id;
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_actor,'execucao.cobertura_estrutural_conferida','retorno_os_preparado',p_retorno_id,jsonb_build_object('requestId',p_request_id,'conferenciaId',v_id,'evidenciaId',p_evidencia_id,'revision',v_revisao));
 return jsonb_build_object('conferenciaId',v_id,'retornoId',p_retorno_id,'coberturaEstrutural',true,'evidenciaExternaComprovada',false,'requestId',p_request_id);
end; $$;
revoke all on function pcm.sso_conferir_cobertura_retorno(uuid,uuid,uuid,uuid,integer,text) from public,anon,authenticated,service_role;

create function pcm.sso_listar_conferencias_cobertura_retorno(p_cliente_id uuid,p_retorno_id uuid,p_apos uuid,p_limite integer)
returns table(id uuid,evidencia_id uuid,revisao_evidencias integer,perguntas integer,justificativa text,ator_id uuid,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.validacao_os_gate where id),false) or not coalesce((select habilitado from pcm.origem_campo_inbox_gate where id),false) or not coalesce((select habilitado from pcm.sso_conferencia_cobertura_retorno_gate where id),false) then raise exception 'conferencia_cobertura_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true or not exists(select 1 from pcm.retorno_os_preparado where id=p_retorno_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 100 then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 return query select c.id,c.evidencia_id,c.revisao_evidencias,c.perguntas,c.justificativa,c.ator_id,c.criado_em from pcm.sso_conferencias_cobertura_retorno c where c.retorno_id=p_retorno_id and (p_apos is null or c.id>p_apos) order by c.id limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_conferencias_cobertura_retorno(uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;
