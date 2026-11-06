-- ADR-1096: página local; não altera as fontes e não movimenta valores.
create table pcm.sso_varredura_origens_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_varredura_origens_gate(id,habilitado) values(true,false);
create table pcm.sso_observacoes_origens_internas(
 tipo text not null check(tipo in ('comercial','financeiro')),objeto_id uuid not null,cliente_id uuid not null references pcm.clientes(id),
 estado_fonte text not null,classificacao text not null,revisao integer not null check(revisao>0),atualizado_em timestamptz not null default now(),
 primary key(tipo,objeto_id)
);
create table pcm.sso_observacoes_origens_eventos(
 tipo text not null,objeto_id uuid not null,revisao integer not null check(revisao>0),request_id uuid not null,
 estado_fonte text not null,classificacao text not null,criado_em timestamptz not null default now(),
 primary key(tipo,objeto_id,revisao),unique(request_id,tipo,objeto_id),
 foreign key(tipo,objeto_id) references pcm.sso_observacoes_origens_internas(tipo,objeto_id)
);
create table pcm.sso_varredura_origens_paginas(
 request_id uuid primary key,cursor_tipo text,cursor_id uuid,limite integer not null check(limite between 1 and 50),
 resultado jsonb not null,criado_em timestamptz not null default now(),
 check((cursor_tipo is null and cursor_id is null) or (cursor_tipo in ('comercial','financeiro') and cursor_id is not null))
);
alter table pcm.sso_varredura_origens_gate enable row level security;alter table pcm.sso_varredura_origens_gate force row level security;
alter table pcm.sso_observacoes_origens_internas enable row level security;alter table pcm.sso_observacoes_origens_internas force row level security;
alter table pcm.sso_observacoes_origens_eventos enable row level security;alter table pcm.sso_observacoes_origens_eventos force row level security;
alter table pcm.sso_varredura_origens_paginas enable row level security;alter table pcm.sso_varredura_origens_paginas force row level security;
revoke all on pcm.sso_varredura_origens_gate,pcm.sso_observacoes_origens_internas,pcm.sso_observacoes_origens_eventos,pcm.sso_varredura_origens_paginas from public,anon,authenticated,service_role;
create trigger sso_observacoes_origens_eventos_imutaveis before update or delete on pcm.sso_observacoes_origens_eventos for each row execute function pcm.sso_proteger_nota_reconciliacao();
create trigger sso_varredura_origens_paginas_imutaveis before update or delete on pcm.sso_varredura_origens_paginas for each row execute function pcm.sso_proteger_nota_reconciliacao();

create function pcm.sso_varrer_origens_internas(p_request_id uuid,p_cursor_tipo text,p_cursor_id uuid,p_limite integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_pagina pcm.sso_varredura_origens_paginas%rowtype;v_atual pcm.sso_observacoes_origens_internas%rowtype;
 v_item record;v_tipo text:=p_cursor_tipo;v_id uuid:=p_cursor_id;v_total integer:=0;v_alterados integer:=0;v_resultado jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if p_request_id is null or p_limite is null or p_limite not between 1 and 50
   or ((p_cursor_tipo is null)<>(p_cursor_id is null)) or (p_cursor_tipo is not null and p_cursor_tipo not in ('comercial','financeiro'))
   then raise exception 'parametros_invalidos' using errcode='22023'; end if;
 perform 1 from pcm.sso_varredura_origens_gate where id and habilitado for share;
 if not found then raise exception 'varredura_desabilitada' using errcode='55000'; end if;
 perform 1 from pcm.reconciliacao_outbox_gate where id and habilitado for share;
 if not found then raise exception 'reconciliacao_bloqueada' using errcode='55000'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-varredura-origens:'||p_request_id::text,0));
 select * into v_pagina from pcm.sso_varredura_origens_paginas where request_id=p_request_id;
 if found then
   if v_pagina.cursor_tipo is distinct from p_cursor_tipo or v_pagina.cursor_id is distinct from p_cursor_id or v_pagina.limite is distinct from p_limite then raise exception 'request_id_conflitante' using errcode='23505'; end if;
   return v_pagina.resultado;
 end if;
 for v_item in
   select z.tipo,z.objeto_id,z.cliente_id,z.estado_fonte,z.classificacao from (
     select 'comercial'::text tipo,p.id objeto_id,os.client_id cliente_id,p.status::text estado_fonte,
       case when l.ordem_servico_id is distinct from os.id then 'conflito_de_origem' else 'vinculo_observado' end::text classificacao
     from comercial.proposta_origens_operacionais origem
       join comercial.propostas p on p.id=origem.proposta_id and p.deleted_at is null
       left join comercial.oportunidades op on op.id=p.oportunidade_id
       join pcm.ordens_servico os on os.id=origem.ordem_servico_id and os.deleted_at is null
       join pcm.listas_materiais l on l.id=origem.lista_materiais_id and l.cliente_id=os.client_id
     where os.client_id is not null and (p.oportunidade_id is null or op.cliente_id=os.client_id)
     union all
     select 'financeiro'::text,f.id,f.cliente_id,f.status::text,
       case when r.item_id is null then 'declaracao_ausente_conferir'
         when d.id is null then 'despesa_indisponivel_conferir'
         when f.origem_tipo is distinct from 'despesa_visita' or f.origem_id is distinct from d.id or r.visita_id is distinct from d.visita_id
         then 'conflito_de_origem' when r.despesa_revisao is distinct from d.revisao then 'despesa_alterada_conferir' else 'vinculo_observado' end::text
     from financeiro.itens_faturaveis f
       left join financeiro.sso_declaracoes_repasse_despesa r on r.item_id=f.id
       left join pcm.despesas_visita d on d.id=r.despesa_id and d.cliente_id=f.cliente_id
     where f.cliente_id is not null and (f.origem_tipo='despesa_visita' or r.item_id is not null)
   ) z where p_cursor_tipo is null or (z.tipo,z.objeto_id)>(p_cursor_tipo,p_cursor_id)
   order by z.tipo,z.objeto_id limit p_limite
 loop
   if v_tipo=v_item.tipo and v_id=v_item.objeto_id then raise exception 'origem_duplicada' using errcode='23514'; end if;
   v_tipo:=v_item.tipo;v_id:=v_item.objeto_id;v_total:=v_total+1;
   if v_item.estado_fonte is null or v_item.cliente_id is null then raise exception 'origem_invalida' using errcode='23514'; end if;
   perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('sso-observacao-origem:'||v_tipo||':'||v_id::text,0));
   select * into v_atual from pcm.sso_observacoes_origens_internas where tipo=v_tipo and objeto_id=v_id for update;
   if found and v_atual.cliente_id is distinct from v_item.cliente_id then raise exception 'origem_exige_reconciliacao' using errcode='23514'; end if;
   if not found then
     insert into pcm.sso_observacoes_origens_internas(tipo,objeto_id,cliente_id,estado_fonte,classificacao,revisao)
       values(v_tipo,v_id,v_item.cliente_id,v_item.estado_fonte,v_item.classificacao,1) returning * into v_atual;
   elsif v_atual.estado_fonte is distinct from v_item.estado_fonte or v_atual.classificacao is distinct from v_item.classificacao then
     update pcm.sso_observacoes_origens_internas set estado_fonte=v_item.estado_fonte,classificacao=v_item.classificacao,
       revisao=revisao+1,atualizado_em=now() where tipo=v_tipo and objeto_id=v_id returning * into v_atual;
   else continue;
   end if;
   insert into pcm.sso_observacoes_origens_eventos(tipo,objeto_id,revisao,request_id,estado_fonte,classificacao)
     values(v_tipo,v_id,v_atual.revisao,p_request_id,v_item.estado_fonte,v_item.classificacao);
   v_alterados:=v_alterados+1;
 end loop;
 v_resultado:=jsonb_build_object('requestId',p_request_id,'considerados',v_total,'alterados',v_alterados,
   'proximoTipo',case when v_total=p_limite then v_tipo else null end,'proximoId',case when v_total=p_limite then v_id else null end,'efeitoExternoComprovado',false);
 insert into pcm.sso_varredura_origens_paginas(request_id,cursor_tipo,cursor_id,limite,resultado) values(p_request_id,p_cursor_tipo,p_cursor_id,p_limite,v_resultado);
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(null,'integracao.varredura_origens','sso_varredura_origens_paginas',p_request_id,
   jsonb_build_object('considerados',v_total,'alterados',v_alterados));
 return v_resultado;
end; $$;
revoke all on function pcm.sso_varrer_origens_internas(uuid,text,uuid,integer) from public,anon,authenticated,service_role;
