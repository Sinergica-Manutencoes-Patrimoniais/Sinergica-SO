-- ADR-1440: ciclo canônico de Visita possui seu próprio namespace de Chamados.
create table pcm.sso_chamados_ciclo_visita (
 ciclo_id uuid primary key references pcm.sso_ciclos_visita_canonicos(id),cliente_id uuid not null references pcm.clientes(id),
 plano_id uuid not null references pcm.planos_manutencao(id),preparada_id uuid not null references pcm.ocorrencias_visita_preparadas(id),
 chamado_id uuid not null unique references pcm.chamados(id),ator_id uuid not null references auth.users(id),criado_em timestamptz not null default now()
);
create table pcm.sso_chamado_visita_comandos (
 request_id uuid primary key,ator_id uuid not null references auth.users(id),cliente_id uuid not null references pcm.clientes(id),
 ciclo_id uuid not null references pcm.sso_chamados_ciclo_visita(ciclo_id),payload jsonb not null,resultado jsonb not null,criado_em timestamptz not null default now()
);
alter table pcm.sso_chamados_ciclo_visita enable row level security;
alter table pcm.sso_chamados_ciclo_visita force row level security;
alter table pcm.sso_chamado_visita_comandos enable row level security;
alter table pcm.sso_chamado_visita_comandos force row level security;
revoke all on pcm.sso_chamados_ciclo_visita,pcm.sso_chamado_visita_comandos from public,anon,authenticated,service_role;
create trigger sso_chamado_ciclo_visita_imutavel before update or delete on pcm.sso_chamados_ciclo_visita for each row execute function pcm.sso_proteger_conferencia_levantamento();
create trigger sso_chamado_visita_comando_imutavel before update or delete on pcm.sso_chamado_visita_comandos for each row execute function pcm.sso_proteger_conferencia_levantamento();

create function pcm.sso_criar_chamado_ciclo_visita(p_request_id uuid,p_cliente_id uuid,p_plano_id uuid,p_preparada_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_ator uuid:=auth.uid();v_oc pcm.ocorrencias_visita_preparadas%rowtype;v_ciclo uuid;
 v_ant pcm.sso_chamado_visita_comandos%rowtype;v_existente pcm.sso_chamados_ciclo_visita%rowtype;
 v_snapshot jsonb;v_itens jsonb;v_nome text;v_chamado uuid;v_numero text;v_payload jsonb;v_resultado jsonb;v_criado boolean:=false;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from pcm.sso_chamado_preventivo_gate where id and habilitado for share;
 if not found then raise exception 'criacao_desabilitada' using errcode='55000'; end if;
 if v_ator is null or p_request_id is null or p_cliente_id is null or p_plano_id is null or p_preparada_id is null
   or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('chamado.os.criar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'planoId',p_plano_id,'preparadaId',p_preparada_id);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chamado-visita-request:'||p_request_id::text,0));
 select * into v_ant from pcm.sso_chamado_visita_comandos where request_id=p_request_id;
 if found then
   if v_ant.ator_id is distinct from v_ator or v_ant.cliente_id is distinct from p_cliente_id or v_ant.payload is distinct from v_payload then raise exception 'request_conflitante' using errcode='23505'; end if;
   return v_ant.resultado;
 end if;
 lock table pcm.sso_vinculos_visita_legado,pcm.ordens_servico,pcm.sso_vinculos_os_grupo in share mode nowait;
 select o.* into v_oc from pcm.ocorrencias_visita_preparadas o join pcm.planos_manutencao p on p.id=o.plano_id
   where o.id=p_preparada_id and o.plano_id=p_plano_id and p.cliente_id=p_cliente_id and p.estado in ('aprovado','ativo') for share of o,p;
 if not found then raise exception 'ocorrencia_indisponivel' using errcode='42501'; end if;
 perform 1 from pcm.visitas v join pcm.visita_origem_contratual origem on origem.visita_id=v.id and origem.cliente_id=v.cliente_id
   where v.id=v_oc.visita_id and v.cliente_id=p_cliente_id and v.estado not in ('cancelada','concluida')
   and origem.serie_id=v_oc.serie_id and origem.semana_origem=v_oc.semana_origem for update of v;
 if not found or exists(select 1 from pcm.sso_visitas_suprimidas_feriado where visita_id=v_oc.visita_id) then raise exception 'visita_indisponivel_ou_suprimida' using errcode='23514'; end if;
 select cv.ciclo_id into v_ciclo from pcm.sso_ciclo_visita_versoes cv join pcm.sso_ciclos_visita_canonicos c on c.id=cv.ciclo_id
   where cv.preparada_id=v_oc.id and cv.versao_id=v_oc.versao_id and c.plano_id=p_plano_id and c.rotina_logica_id=v_oc.rotina_logica_id
   and c.alvo_tipo=v_oc.alvo_tipo and c.alvo_id=v_oc.alvo_id and c.serie_id=v_oc.serie_id and c.semana_origem=v_oc.semana_origem;
 if v_ciclo is null then raise exception 'identidade_indisponivel' using errcode='23514'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('chamado-visita-ciclo:'||v_ciclo::text,0));
 select * into v_existente from pcm.sso_chamados_ciclo_visita where ciclo_id=v_ciclo;
 if found then
   if v_existente.cliente_id is distinct from p_cliente_id or v_existente.plano_id is distinct from p_plano_id
     or not exists(select 1 from pcm.chamados where id=v_existente.chamado_id and cliente_id=p_cliente_id and deleted_at is null) then raise exception 'chamado_exige_reconciliacao' using errcode='23514'; end if;
   v_chamado:=v_existente.chamado_id;select numero into v_numero from pcm.chamados where id=v_chamado;
 else
   if exists(select 1 from pcm.sso_ciclo_visita_versoes cv join pcm.sso_vinculos_visita_legado ponte on ponte.ocorrencia_visita_id=cv.preparada_id
       join pcm.ordens_servico os on os.ocorrencia_preventiva_id=ponte.ocorrencia_legada_id where cv.ciclo_id=v_ciclo)
     or exists(select 1 from pcm.sso_ciclo_visita_versoes cv join pcm.sso_ocorrencias_grupo g on g.visita_preparada_id=cv.preparada_id
       join pcm.sso_vinculos_os_grupo vinc on vinc.ocorrencia_grupo_id=g.id where cv.ciclo_id=v_ciclo) then raise exception 'os_existente_exige_reconciliacao' using errcode='23514'; end if;
   select snapshot into v_snapshot from pcm.plano_versoes where id=v_oc.versao_id and plano_id=p_plano_id and estado='aprovado' for share;
   if not found or jsonb_typeof(v_snapshot->'rotinas') is distinct from 'array' then raise exception 'snapshot_indisponivel' using errcode='23514'; end if;
   select jsonb_agg(r) into v_itens from jsonb_array_elements(v_snapshot->'rotinas') r where r->>'id'=v_oc.rotina_id::text and r->>'rotina_logica_id'=v_oc.rotina_logica_id::text;
   if v_itens is null or jsonb_array_length(v_itens)<>1 or v_itens->0->>'modo' is distinct from 'visita'
     or v_itens->0->>'alvo_tipo' is distinct from v_oc.alvo_tipo
     or (case v_oc.alvo_tipo when 'sistema' then v_itens->0->>'sistema_id' when 'componente' then v_itens->0->>'equipamento_id' when 'grupo' then v_itens->0->>'grupo_id' end) is distinct from v_oc.alvo_id::text then raise exception 'rotina_divergente' using errcode='23514'; end if;
   v_nome:=nullif(btrim(v_itens->0->>'nome'),'');
   if v_nome is null or length(v_nome)>200 then raise exception 'nome_rotina_invalido' using errcode='23514'; end if;
   v_chamado:=gen_random_uuid();v_numero:=pcm.fn_proximo_numero_chamado();
   insert into pcm.chamados(id,numero,cliente_id,titulo,descricao,origem,status,created_by)
     values(v_chamado,v_numero,p_cliente_id,left('Preventiva: '||v_nome,200),'Vencimento original: '||v_oc.vencimento_original::text,'manual','aberto',v_ator);
   insert into pcm.sso_chamados_ciclo_visita(ciclo_id,cliente_id,plano_id,preparada_id,chamado_id,ator_id) values(v_ciclo,p_cliente_id,p_plano_id,p_preparada_id,v_chamado,v_ator);
   insert into pcm.chamados_eventos(chamado_id,tipo,metadata,created_by) values(v_chamado,'criado',jsonb_build_object('origem','preventiva_visita','cicloId',v_ciclo,'preparadaId',p_preparada_id,'visitaId',v_oc.visita_id),v_ator);
   v_criado:=true;
 end if;
 if config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('chamado.os.criar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=jsonb_build_object('requestId',p_request_id,'clienteId',p_cliente_id,'planoId',p_plano_id,'preparadaId',p_preparada_id,'cicloId',v_ciclo,'chamadoId',v_chamado,'numero',v_numero,'criado',v_criado,'osCriada',false,'tarefaAuvoCriada',false);
 insert into pcm.sso_chamado_visita_comandos(request_id,ator_id,cliente_id,ciclo_id,payload,resultado) values(p_request_id,v_ator,p_cliente_id,v_ciclo,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(v_ator,'preventiva.chamado_visita_vinculado','chamados',v_chamado,v_resultado);
 return v_resultado;
end; $$;
revoke all on function pcm.sso_criar_chamado_ciclo_visita(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_criar_chamado_ciclo_visita(uuid,uuid,uuid,uuid) to authenticated;
