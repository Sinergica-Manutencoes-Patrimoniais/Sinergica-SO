-- ADR-1374: candidato pendente; geração e conferência iniciam bloqueadas.
create table financeiro.sso_candidato_servico_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into financeiro.sso_candidato_servico_gate(id,habilitado) values(true,false);
alter table financeiro.sso_candidato_servico_gate enable row level security;
alter table financeiro.sso_candidato_servico_gate force row level security;
revoke all on financeiro.sso_candidato_servico_gate from public,anon,authenticated,service_role;

create table financeiro.sso_candidatos_servico(
 fato_id uuid primary key references financeiro.sso_fatos_execucao_declarados(id), cliente_id uuid not null references pcm.clientes(id),
 item_id uuid not null unique references financeiro.itens_faturaveis(id), payload jsonb not null, criado_em timestamptz not null default now()
);
create table financeiro.sso_candidato_servico_comandos(
 request_id uuid primary key, ator_id uuid not null references auth.users(id), cliente_id uuid not null references pcm.clientes(id),
 fato_id uuid not null references financeiro.sso_candidatos_servico(fato_id), payload jsonb not null, resultado jsonb not null, criado_em timestamptz not null default now()
);
alter table financeiro.sso_candidatos_servico enable row level security;
alter table financeiro.sso_candidatos_servico force row level security;
alter table financeiro.sso_candidato_servico_comandos enable row level security;
alter table financeiro.sso_candidato_servico_comandos force row level security;
revoke all on financeiro.sso_candidatos_servico,financeiro.sso_candidato_servico_comandos from public,anon,authenticated,service_role;
create trigger sso_candidato_servico_comandos_imutaveis before update or delete on financeiro.sso_candidato_servico_comandos for each row execute function pcm.sso_proteger_nota_reconciliacao();

-- Esta guarda cobre somente proposta integral e material da mesma linha. Outros
-- caminhos e fatos historicamente equivalentes exigem inventário e revisão.
create function financeiro.sso_intertravar_origens_servico() returns trigger language plpgsql security definer set search_path='' as $$
declare v_proposta uuid; v_versao integer; v_linha uuid;
begin
 if new.item_base_id is not null then
   if exists(select 1 from financeiro.itens_faturaveis b where b.id=new.item_base_id and b.origem_tipo='servico_extra_fato') then raise exception 'complemento_servico_bloqueado' using errcode='55000'; end if;
   return new;
 end if;
 if new.origem_tipo not in ('servico_extra_fato','proposta_operacional','material_proposta_linha') then return new; end if;
 lock table financeiro.itens_faturaveis in share row exclusive mode nowait;
 if new.origem_tipo='servico_extra_fato' then
   select s.proposta_id,s.versao,s.linha_id into v_proposta,v_versao,v_linha
     from financeiro.sso_fatos_execucao_declarados f join financeiro.sso_vinculos_resposta_servico v on v.id=f.vinculo_id and v.cliente_id=f.cliente_id
     join financeiro.sso_snapshots_servico_extra s on s.id=v.snapshot_id and s.cliente_id=f.cliente_id
     where f.id=new.origem_id and f.cliente_id=new.cliente_id;
   if v_proposta is null then raise exception 'origem_servico_inconsistente' using errcode='23514'; end if;
   if exists(select 1 from financeiro.itens_faturaveis i where i.cliente_id=new.cliente_id and i.item_base_id is null and
     ((i.origem_tipo='proposta_operacional' and i.origem_id=v_proposta) or
      (i.origem_tipo='material_proposta_linha' and exists(select 1 from financeiro.sso_material_linha_proposta m join financeiro.sso_material_declaracoes d on d.id=m.declaracao_id and d.cliente_id=new.cliente_id
       where m.declaracao_id=i.origem_id and m.proposta_id=v_proposta and m.versao=v_versao and m.linha_id=v_linha)))) then
     raise exception 'origem_financeira_conflitante' using errcode='23505'; end if;
 else
   if new.origem_tipo='proposta_operacional' then v_proposta:=new.origem_id;
   else
     select m.proposta_id,m.versao,m.linha_id into v_proposta,v_versao,v_linha from financeiro.sso_material_linha_proposta m
       join financeiro.sso_material_declaracoes d on d.id=m.declaracao_id and d.cliente_id=new.cliente_id where m.declaracao_id=new.origem_id;
     if v_proposta is null then
       if exists(select 1 from financeiro.itens_faturaveis i where i.cliente_id=new.cliente_id and i.item_base_id is null and i.origem_tipo='servico_extra_fato') then
         raise exception 'origem_material_inconsistente' using errcode='23514';
       end if;
       return new;
     end if;
   end if;
   if exists(select 1 from financeiro.itens_faturaveis i join financeiro.sso_fatos_execucao_declarados f on f.id=i.origem_id and f.cliente_id=i.cliente_id
     join financeiro.sso_vinculos_resposta_servico v on v.id=f.vinculo_id and v.cliente_id=f.cliente_id
     join financeiro.sso_snapshots_servico_extra s on s.id=v.snapshot_id and s.cliente_id=f.cliente_id
     where i.cliente_id=new.cliente_id and i.item_base_id is null and i.origem_tipo='servico_extra_fato' and s.proposta_id=v_proposta
       and (new.origem_tipo='proposta_operacional' or (s.versao=v_versao and s.linha_id=v_linha))) then
     raise exception 'origem_financeira_conflitante' using errcode='23505'; end if;
 end if;
 return new;
end; $$;
revoke all on function financeiro.sso_intertravar_origens_servico() from public,anon,authenticated,service_role;
create trigger sso_intertravar_origens_servico before insert on financeiro.itens_faturaveis for each row execute function financeiro.sso_intertravar_origens_servico();

create function financeiro.sso_bloquear_conferencia_servico_pendente() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (old.origem_tipo in ('servico_extra_fato','proposta_operacional','material_proposta_linha') or new.origem_tipo in ('servico_extra_fato','proposta_operacional','material_proposta_linha'))
   and (new.cliente_id is distinct from old.cliente_id or new.origem_tipo is distinct from old.origem_tipo or new.origem_id is distinct from old.origem_id or new.item_base_id is distinct from old.item_base_id) then
   lock table financeiro.itens_faturaveis in share row exclusive mode nowait;
 end if;
 if (old.origem_tipo='servico_extra_fato' or new.origem_tipo='servico_extra_fato' or
     ((old.origem_tipo in ('proposta_operacional','material_proposta_linha') or new.origem_tipo in ('proposta_operacional','material_proposta_linha'))
       and exists(select 1 from financeiro.itens_faturaveis i where i.cliente_id in (old.cliente_id,new.cliente_id) and i.item_base_id is null and i.origem_tipo='servico_extra_fato')))
   and (new.cliente_id is distinct from old.cliente_id or new.origem_tipo is distinct from old.origem_tipo or new.origem_id is distinct from old.origem_id or new.item_base_id is distinct from old.item_base_id) then
   raise exception 'identidade_financeira_imutavel' using errcode='23514'; end if;
 if old.origem_tipo='servico_extra_fato' and (new.valor_original_centavos is distinct from old.valor_original_centavos or new.competencia is distinct from old.competencia) then
   raise exception 'origem_servico_imutavel' using errcode='23514'; end if;
 if old.origem_tipo='servico_extra_fato' and (new.status is distinct from old.status or new.valor_conferido_centavos is distinct from old.valor_conferido_centavos)
   and new.status <> 'cancelado' then raise exception 'conferencia_servico_bloqueada' using errcode='55000'; end if;
 return new;
end; $$;
revoke all on function financeiro.sso_bloquear_conferencia_servico_pendente() from public,anon,authenticated,service_role;
create trigger sso_bloquear_conferencia_servico_pendente before update on financeiro.itens_faturaveis for each row execute function financeiro.sso_bloquear_conferencia_servico_pendente();

create function financeiro.sso_criar_candidato_servico(p_request_id uuid,p_cliente_id uuid,p_fato_id uuid,p_revisao_atestacao integer,p_competencia date)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_fato financeiro.sso_fatos_execucao_declarados%rowtype; v_snapshot financeiro.sso_snapshots_servico_extra%rowtype;
 v_decl financeiro.sso_servicos_extra_declarados%rowtype; v_atest financeiro.sso_atestacoes_servico%rowtype;
 v_candidato financeiro.sso_candidatos_servico%rowtype; v_cmd financeiro.sso_candidato_servico_comandos%rowtype;
 v_payload jsonb; v_resultado jsonb; v_valor numeric; v_item uuid; v_ultima integer; v_total bigint; v_versionadas bigint; v_modo text;
begin
 if current_setting('transaction_isolation') <> 'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
 perform 1 from financeiro.sso_candidato_servico_gate where id and habilitado for share;
 if not found then raise exception 'candidato_desabilitado' using errcode='55000'; end if;
 perform 1 from financeiro.sso_servico_extra_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 perform 1 from financeiro.sso_snapshot_servico_extra_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 perform 1 from financeiro.sso_vinculo_resposta_servico_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 perform 1 from financeiro.sso_fato_execucao_declarado_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 perform 1 from financeiro.sso_atestacao_servico_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 perform 1 from financeiro.sso_coordenacao_linhas_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 perform 1 from financeiro.sso_modo_faturamento_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 perform 1 from financeiro.sso_reconciliacao_servico_material_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 perform 1 from financeiro.sso_revisao_origens_reconciliacao_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 perform 1 from comercial.sso_classificacao_linha_gate where id and habilitado for share;
 if not found then raise exception 'fonte_desabilitada' using errcode='55000'; end if;
 if auth.uid() is null or p_request_id is null or p_cliente_id is null or p_fato_id is null or p_revisao_atestacao is null or p_revisao_atestacao<1
   or p_competencia is null or not isfinite(p_competencia) or extract(day from p_competencia)<>1
   or config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true
   or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso_ou_dados_invalidos' using errcode='42501'; end if;
 v_payload:=jsonb_build_object('clienteId',p_cliente_id,'fatoId',p_fato_id,'revisaoAtestacao',p_revisao_atestacao,'competencia',p_competencia);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('candidato-servico-request:'||p_request_id::text,0));
 select * into v_cmd from financeiro.sso_candidato_servico_comandos where request_id=p_request_id;
 if found then
   if v_cmd.ator_id is distinct from auth.uid() or v_cmd.cliente_id is distinct from p_cliente_id or v_cmd.payload is distinct from v_payload then raise exception 'request_conflitante' using errcode='23505'; end if;
   return v_cmd.resultado;
 end if;
 select * into v_fato from financeiro.sso_fatos_execucao_declarados where id=p_fato_id and cliente_id=p_cliente_id;
 if not found then raise exception 'origem_indisponivel' using errcode='42501'; end if;
 select s.* into v_snapshot from financeiro.sso_vinculos_resposta_servico v join financeiro.sso_snapshots_servico_extra s on s.id=v.snapshot_id and s.cliente_id=v.cliente_id
   where v.id=v_fato.vinculo_id and v.cliente_id=p_cliente_id and v.resposta_id=v_fato.resposta_id;
 if not found then raise exception 'origem_inconsistente' using errcode='23514'; end if;
 select * into v_decl from financeiro.sso_servicos_extra_declarados where id=v_snapshot.declaracao_id and cliente_id=p_cliente_id;
 if not found or v_decl.proposta_id<>v_snapshot.proposta_id or v_decl.versao<>v_snapshot.versao or v_decl.linha_id<>v_snapshot.linha_id or v_decl.quantidade<>v_snapshot.quantidade
   or not exists(select 1 from financeiro.sso_servicos_extra_decisoes d where d.id=v_snapshot.decisao_id and d.declaracao_id=v_decl.id and d.decisao='aceita') then raise exception 'declaracao_inconsistente' using errcode='23514'; end if;
 lock table financeiro.fechamentos_mensais in share mode nowait;
 lock table financeiro.sso_reconciliacoes_servico_material,financeiro.sso_revisoes_origens_reconciliacao,financeiro.sso_material_declaracoes in share mode nowait;
 if exists(select 1 from financeiro.sso_reconciliacoes_servico_material r
   left join financeiro.sso_material_declaracoes m on m.id=r.material_id and m.cliente_id=r.cliente_id
   left join financeiro.sso_revisoes_origens_reconciliacao x on x.decisao_id=r.id and x.servico_id=r.servico_id
   where r.cliente_id=p_cliente_id and r.servico_id=v_decl.id
     and not exists(select 1 from financeiro.sso_reconciliacoes_servico_material posterior
       where posterior.servico_id=r.servico_id and posterior.material_id=r.material_id and posterior.revisao>r.revisao)
     and (r.decisao<>'distintos_declarados' or m.id is null or x.decisao_id is null
       or x.material_revisao is distinct from m.revisao or x.material_estado is distinct from m.estado)) then
   raise exception 'reconciliacao_pendente_ou_obsoleta' using errcode='23514'; end if;
 perform 1 from comercial.propostas where id=v_snapshot.proposta_id and deleted_at is null and status='aceita' and versao_atual=v_snapshot.versao for update nowait;
 if not found then raise exception 'proposta_obsoleta' using errcode='40001'; end if;
 select m.modo into v_modo from financeiro.sso_consultar_modo_proposta(p_cliente_id,v_snapshot.proposta_id) m;
 if v_modo is distinct from 'linhas' then raise exception 'modo_incompativel' using errcode='23514'; end if;
 perform 1 from pcm.retorno_os_preparado where id=v_fato.retorno_id and cliente_id=p_cliente_id for update nowait;
 if not found then raise exception 'retorno_indisponivel' using errcode='23514'; end if;
 select * into v_atest from financeiro.sso_atestacoes_servico where fato_id=p_fato_id and cliente_id=p_cliente_id for update nowait;
 if not found or v_atest.estado<>'confirmada' or v_atest.revisao<>p_revisao_atestacao or v_atest.revisao_pcm_id<>v_fato.revisao_id then raise exception 'atestacao_obsoleta' using errcode='40001'; end if;
 select count(*),coalesce(max(revisao),0) into v_versionadas,v_ultima from pcm.sso_revisoes_validacao_os where retorno_id=v_fato.retorno_id;
 select count(*) into v_total from pcm.decisoes_validacao_os where retorno_id=v_fato.retorno_id;
 if v_total<>v_versionadas or not exists(select 1 from pcm.sso_revisoes_validacao_os r join pcm.decisoes_validacao_os d on d.id=r.decisao_id and d.retorno_id=r.retorno_id
   where r.id=v_fato.revisao_id and r.retorno_id=v_fato.retorno_id and r.revisao=v_ultima and d.decisao='aprovar') then raise exception 'revisao_pcm_obsoleta' using errcode='40001'; end if;
 if not exists(select 1 from comercial.sso_classificacoes_linha c join comercial.sso_revisoes_classificacao_linha r on r.classificacao_id=c.id and r.decisao='aceita'
   where c.cliente_id=p_cliente_id and c.proposta_id=v_snapshot.proposta_id and c.versao=v_snapshot.versao and c.linha_id=v_snapshot.linha_id and c.tipo='servico') then raise exception 'classificacao_nao_aprovada' using errcode='23514'; end if;
 if exists(select 1 from financeiro.fechamentos_mensais where competencia=p_competencia and status='fechado') then raise exception 'competencia_fechada' using errcode='23514'; end if;
 if v_snapshot.linha_publica->>'precoUnitarioCentavos' !~ '^(0|[1-9][0-9]{0,12})$'
   or (v_snapshot.linha_publica->>'precoUnitarioCentavos')::numeric is distinct from v_decl.preco_unitario_centavos::numeric then raise exception 'preco_inconsistente' using errcode='23514'; end if;
 v_valor:=v_decl.quantidade::numeric*v_decl.preco_unitario_centavos::numeric;
 if v_valor<0 or v_valor>9007199254740991 then raise exception 'valor_invalido' using errcode='22003'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('candidato-servico-fato:'||p_fato_id::text,0));
 select * into v_candidato from financeiro.sso_candidatos_servico where fato_id=p_fato_id;
 if found then
   if v_candidato.cliente_id is distinct from p_cliente_id or v_candidato.payload is distinct from v_payload then raise exception 'origem_conflitante' using errcode='23505'; end if;
   if not exists(select 1 from financeiro.itens_faturaveis i where i.id=v_candidato.item_id and i.cliente_id=p_cliente_id and i.origem_tipo='servico_extra_fato'
     and i.origem_id=p_fato_id and i.status='pendente' and i.valor_original_centavos=v_valor and i.competencia=p_competencia) then raise exception 'candidato_nao_pendente' using errcode='23514'; end if;
   v_item:=v_candidato.item_id;
 else
   v_item:=pg_catalog.gen_random_uuid();
   insert into financeiro.itens_faturaveis(id,cliente_id,origem_tipo,origem_id,valor_original_centavos,competencia) values(v_item,p_cliente_id,'servico_extra_fato',p_fato_id,v_valor::bigint,p_competencia);
   insert into financeiro.sso_candidatos_servico(fato_id,cliente_id,item_id,payload) values(p_fato_id,p_cliente_id,v_item,v_payload);
 end if;
 if config.sso_autorizar_acao('faturavel.efetivar',p_cliente_id) is distinct from true or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 v_resultado:=jsonb_build_object('requestId',p_request_id,'itemId',v_item,'fatoId',p_fato_id,'valorCentavos',v_valor::text,'competencia',p_competencia,'estado','pendente','conferenciaPermitida',false,'cobrancaCriada',false);
 insert into financeiro.sso_candidato_servico_comandos(request_id,ator_id,cliente_id,fato_id,payload,resultado) values(p_request_id,auth.uid(),p_cliente_id,p_fato_id,v_payload,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(auth.uid(),'faturavel.candidato_servico','itens_faturaveis',v_item,v_resultado);
 return v_resultado;
end; $$;
revoke all on function financeiro.sso_criar_candidato_servico(uuid,uuid,uuid,integer,date) from public,anon,authenticated,service_role;
grant execute on function financeiro.sso_criar_candidato_servico(uuid,uuid,uuid,integer,date) to authenticated;
