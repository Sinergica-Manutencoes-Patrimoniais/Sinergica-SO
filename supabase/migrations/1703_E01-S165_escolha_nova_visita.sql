-- ADR-1559: fundação privada de escolha explícita; sem aplicação, sem grant e sem Auvo.
create table pcm.sso_escolhas_nova_data_visita (
 request_id uuid primary key,cliente_id uuid not null,plano_id uuid not null references pcm.planos_manutencao(id),
 rascunho_id uuid not null references pcm.plano_versoes(id),preparada_id uuid not null references pcm.ocorrencias_visita_preparadas(id),
 rotina_id uuid not null,visita_id uuid not null references pcm.visitas(id),serie_id uuid not null,semana_origem date not null,
 vencimento_novo date not null,revisao_plano integer not null,ator_id uuid not null references auth.users(id),
 comparacao jsonb not null,candidata jsonb not null,fonte_feriados text not null,payload jsonb not null,resultado jsonb not null,
 criado_em timestamptz not null default clock_timestamp(),unique(rascunho_id,rotina_id,visita_id)
);
alter table pcm.sso_escolhas_nova_data_visita enable row level security;
alter table pcm.sso_escolhas_nova_data_visita force row level security;
revoke all on pcm.sso_escolhas_nova_data_visita from public,anon,authenticated,service_role;
create trigger sso_escolhas_nova_visita_imutaveis before update or delete on pcm.sso_escolhas_nova_data_visita for each row execute function pcm.sso_proteger_conferencia_levantamento();

-- Uma Visita só é candidata se a própria origem contratual e série provarem o dia.
create function pcm.sso_fotografar_candidata_nova_visita(p_cliente uuid,p_plano uuid,p_preparada uuid,p_visita uuid,p_ignorar uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_ant pcm.ocorrencias_visita_preparadas%rowtype;v_visita pcm.visitas%rowtype;v_origem pcm.visita_origem_contratual%rowtype;v_regra pcm.regras_visita_contratual%rowtype;v_data date;
begin
 lock table pcm.visitas,pcm.visita_origem_contratual,pcm.regras_visita_contratual,pcm.sso_visita_regra_transicoes,pcm.feriados_declarados,pcm.sso_visitas_suprimidas_feriado,pcm.visita_ordens_servico,pcm.ocorrencias_visita_preparadas,pcm.rotina_visita_serie_vinculos,pcm.rotina_serie_vigencias in share mode nowait;
 select o.* into v_ant from pcm.ocorrencias_visita_preparadas o join pcm.planos_manutencao p on p.id=o.plano_id and p.cliente_id=p_cliente where o.id=p_preparada and o.plano_id=p_plano;
 if not found then raise exception 'ocorrencia_indisponivel' using errcode='42501';end if;
 select * into v_visita from pcm.visitas where id=p_visita and cliente_id=p_cliente for share;
 if not found or v_visita.id=v_ant.visita_id or v_visita.natureza<>'regular' or v_visita.estado not in ('rascunho','planejada','confirmada') then raise exception 'visita_candidata_indisponivel' using errcode='23514';end if;
 select * into v_origem from pcm.visita_origem_contratual where visita_id=v_visita.id and cliente_id=p_cliente and serie_id=v_ant.serie_id;
 if not found then raise exception 'serie_candidata_divergente' using errcode='23514';end if;
 select * into v_regra from pcm.regras_visita_contratual where id=pcm.sso_regra_efetiva_visita(v_visita.id) and serie_id=v_origem.serie_id;
 if not found or v_regra.fuso is distinct from v_visita.fuso or not exists(select 1 from pg_catalog.pg_timezone_names where name=v_visita.fuso) then raise exception 'regra_candidata_indisponivel' using errcode='23514';end if;
 v_data:=v_origem.semana_origem+(v_regra.dia_semana-1);
 if v_data is not distinct from v_ant.vencimento_original or (v_visita.inicio_em at time zone v_visita.fuso)::date is distinct from v_data
  or v_origem.semana_origem<v_regra.ancora_semana or mod(v_origem.semana_origem-v_regra.ancora_semana,7*v_regra.intervalo_semanas)<>0
  or v_data<v_regra.vigencia_inicio or (v_regra.vigencia_fim is not null and v_data>v_regra.vigencia_fim)
  or not exists(select 1 from pcm.rotina_visita_serie_vinculos l join pcm.rotina_serie_vigencias g on g.plano_id=l.plano_id and g.rotina_logica_id=l.rotina_logica_id and g.serie_id=l.serie_id where l.plano_id=p_plano and l.rotina_logica_id=v_ant.rotina_logica_id and l.serie_id=v_origem.serie_id and g.inicio<=v_data and (g.fim is null or g.fim>=v_data))
  or exists(select 1 from pcm.sso_visitas_suprimidas_feriado where visita_id=v_visita.id)
  or exists(select 1 from pcm.feriados_declarados f where f.cliente_id=p_cliente and f.ativo and f.data=v_data and (f.contrato_id is null or f.contrato_id=v_origem.contrato_id))
  or exists(select 1 from pcm.visita_ordens_servico vo where vo.visita_id=v_visita.id and vo.encerrado_em is null)
  or exists(select 1 from pcm.ocorrencias_visita_preparadas o where o.plano_id=p_plano and o.rotina_logica_id=v_ant.rotina_logica_id and o.alvo_tipo=v_ant.alvo_tipo and o.alvo_id=v_ant.alvo_id and o.visita_id=v_visita.id and o.id is distinct from p_ignorar)
 then raise exception 'visita_candidata_exige_reconciliacao' using errcode='23514';end if;
 return jsonb_build_object('visitaId',v_visita.id,'visitaRevisao',v_visita.revisao,'serieId',v_origem.serie_id,'semanaOrigem',v_origem.semana_origem,'regraId',v_regra.id,'vencimento',v_data,'fontesFeriadosCompletas',false);
end; $$;
revoke all on function pcm.sso_fotografar_candidata_nova_visita(uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;

create function pcm.sso_escolher_nova_visita(p_ator uuid,p_request uuid,p_cliente uuid,p_plano uuid,p_rascunho uuid,p_preparada uuid,p_revisao_plano integer,p_revisao_decisao integer,p_visita uuid,p_data_confirmada date,p_fonte text,p_motivo text,p_comparacao jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_ant pcm.sso_escolhas_nova_data_visita%rowtype;v_payload jsonb;v_nova jsonb;v_anterior jsonb;v_candidata jsonb;v_foto jsonb;v_resultado jsonb;v_rotina uuid;
begin
 if p_request is null or p_visita is null or p_data_confirmada is null or not isfinite(p_data_confirmada) or jsonb_typeof(p_comparacao) is distinct from 'object' or nullif(btrim(p_fonte),'') is null or length(p_fonte)>2000 or nullif(btrim(p_motivo),'') is null or length(p_motivo)>2000 then raise exception 'parametros_invalidos' using errcode='22023';end if;
 perform pcm.sso_conferir_decisao_impacto_mediada(p_ator,p_cliente,p_plano,true);
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('decisao-impacto-visita:'||p_request::text,0)) then raise exception 'decisao_em_andamento' using errcode='55P03';end if;
 v_payload:=jsonb_build_object('cliente',p_cliente,'plano',p_plano,'rascunho',p_rascunho,'preparada',p_preparada,'revisaoPlano',p_revisao_plano,'revisaoDecisao',p_revisao_decisao,'visita',p_visita,'dataConfirmada',p_data_confirmada,'fonte',btrim(p_fonte),'motivo',btrim(p_motivo),'comparacao',p_comparacao);
 select * into v_ant from pcm.sso_escolhas_nova_data_visita where request_id=p_request;
 if found then if v_ant.ator_id is distinct from p_ator or v_ant.payload is distinct from v_payload then raise exception 'request_id_conflitante' using errcode='23505';end if;return v_ant.resultado;end if;
 if exists(select 1 from pcm.sso_decisoes_impacto_ocorrencia where request_id=p_request union all select 1 from pcm.sso_decisoes_impacto_visita where request_id=p_request) then raise exception 'decisao_anterior_sem_escolha' using errcode='23514';end if;
 v_anterior:=p_comparacao->'anterior';v_nova:=p_comparacao->'rascunho';
 if jsonb_typeof(v_anterior) is distinct from 'object' or jsonb_typeof(v_nova) is distinct from 'object' or v_anterior->>'modo' is distinct from 'visita' or v_nova->>'modo' is distinct from 'visita'
  or v_anterior->>'alvo_tipo' is distinct from v_nova->>'alvo_tipo' or coalesce(v_anterior->>'sistema_id',v_anterior->>'equipamento_id',v_anterior->>'grupo_id') is distinct from coalesce(v_nova->>'sistema_id',v_nova->>'equipamento_id',v_nova->>'grupo_id') then raise exception 'identidade_ou_alvo_incompativel' using errcode='23514';end if;
 v_rotina:=(v_nova->>'id')::uuid;
 v_resultado:=pcm.sso_decidir_impacto_comparado(p_ator,p_request,p_cliente,p_plano,p_rascunho,p_preparada,p_revisao_plano,p_revisao_decisao,'exige_reconciliacao',p_motivo,'visita',p_comparacao);
 perform pcm.sso_travar_fontes_impacto_grupo();
 v_foto:=pcm.sso_fotografar_efeitos_impacto_grupo(p_cliente,p_plano,p_preparada,'visita');
 if jsonb_typeof(p_comparacao->'osImpacto') is distinct from 'array' or jsonb_array_length(p_comparacao->'osImpacto')>0 or p_comparacao->>'osOutroCliente' is distinct from 'false'
  or coalesce(jsonb_array_length(v_foto->'os'),0)>0 or coalesce(jsonb_array_length(v_foto->'grupo'),0)>0 or coalesce(jsonb_array_length(v_foto->'intencoes'),0)>0 or coalesce(jsonb_array_length(v_foto->'chamadosCalendario'),0)>0 or coalesce(jsonb_array_length(v_foto->'chamadosVisita'),0)>0 then raise exception 'execucao_ou_vinculo_exige_reconciliacao' using errcode='23514';end if;
 v_candidata:=pcm.sso_fotografar_candidata_nova_visita(p_cliente,p_plano,p_preparada,p_visita,null);
 if (v_candidata->>'vencimento')::date is distinct from p_data_confirmada then raise exception 'data_candidata_alterada' using errcode='40001';end if;
 perform pcm.sso_conferir_decisao_impacto_mediada(p_ator,p_cliente,p_plano,true);
 v_resultado:=v_resultado||jsonb_build_object('visitaEscolhida',p_visita,'novaDataEscolhida',v_candidata->>'vencimento','fontesFeriadosCompletas',false,'substituicaoAplicada',false);
 insert into pcm.sso_escolhas_nova_data_visita values(p_request,p_cliente,p_plano,p_rascunho,p_preparada,v_rotina,p_visita,(v_candidata->>'serieId')::uuid,(v_candidata->>'semanaOrigem')::date,(v_candidata->>'vencimento')::date,p_revisao_plano,p_ator,p_comparacao,v_candidata,btrim(p_fonte),v_payload,v_resultado,clock_timestamp());
 insert into audit.events(actor_id,action,entity,entity_id,payload) values(p_ator,'plano.nova_visita_escolhida','planos_manutencao',p_plano,v_resultado);
 return v_resultado;
end; $$;
revoke all on function pcm.sso_escolher_nova_visita(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,uuid,date,text,text,jsonb) from public,anon,authenticated,service_role;
-- Acesso mediado concedido ao final; aprovação e execução mantêm seus gates.

-- Revalidar decisão, comparação, efeitos e candidata antes de qualquer aprovação futura.
create function pcm.sso_escolha_nova_visita_atual(p_request uuid,p_cliente uuid,p_plano uuid,p_rascunho uuid,p_revisao integer)
returns boolean language plpgsql volatile security definer set search_path='' as $$
declare v pcm.sso_escolhas_nova_data_visita%rowtype;v_ultima uuid;v_foto jsonb;v_atual jsonb;v_candidata jsonb;
begin
 select * into v from pcm.sso_escolhas_nova_data_visita where request_id=p_request and cliente_id=p_cliente and plano_id=p_plano and rascunho_id=p_rascunho and revisao_plano=p_revisao;
 if not found then return false;end if;
 select request_id into v_ultima from pcm.sso_decisoes_impacto_visita where cliente_id=p_cliente and plano_id=p_plano and rascunho_id=p_rascunho and preparada_id=v.preparada_id order by revisao desc limit 1;
 if v_ultima is distinct from p_request then return false;end if;
 perform pcm.sso_travar_fontes_impacto_grupo();
 v_atual:=pcm.sso_comparar_rotina_impacto_v3(auth.uid(),p_cliente,p_plano,p_revisao,p_rascunho,v.preparada_id,'visita');
 if v_atual is distinct from v.comparacao then return false;end if;
 v_foto:=pcm.sso_fotografar_efeitos_impacto_grupo(p_cliente,p_plano,v.preparada_id,'visita');
 begin v_candidata:=pcm.sso_fotografar_candidata_nova_visita(p_cliente,p_plano,v.preparada_id,v.visita_id,null);
 exception when check_violation or insufficient_privilege then return false;end;
 return v_candidata is not distinct from v.candidata and jsonb_typeof(v_atual->'osImpacto')='array' and jsonb_array_length(v_atual->'osImpacto')=0 and v_atual->>'osOutroCliente'='false'
  and coalesce(jsonb_array_length(v_foto->'os'),0)=0 and coalesce(jsonb_array_length(v_foto->'grupo'),0)=0 and coalesce(jsonb_array_length(v_foto->'intencoes'),0)=0
  and coalesce(jsonb_array_length(v_foto->'chamadosCalendario'),0)=0 and coalesce(jsonb_array_length(v_foto->'chamadosVisita'),0)=0;
end; $$;
revoke all on function pcm.sso_escolha_nova_visita_atual(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;

create table pcm.sso_substituicoes_visita_aprovadas (
 versao_id uuid not null references pcm.plano_versoes(id),preparada_id uuid not null references pcm.ocorrencias_visita_preparadas(id),
 escolha_request_id uuid not null references pcm.sso_escolhas_nova_data_visita(request_id),vigencia date not null,
 rotina_id uuid not null,visita_id uuid not null references pcm.visitas(id),serie_id uuid not null,semana_origem date not null,vencimento_novo date not null,
 primary key(versao_id,preparada_id),unique(versao_id,rotina_id,visita_id)
);
alter table pcm.sso_substituicoes_visita_aprovadas enable row level security;
alter table pcm.sso_substituicoes_visita_aprovadas force row level security;
revoke all on pcm.sso_substituicoes_visita_aprovadas from public,anon,authenticated,service_role;
create trigger sso_substituicoes_visita_imutaveis before update or delete on pcm.sso_substituicoes_visita_aprovadas for each row execute function pcm.sso_proteger_conferencia_levantamento();

do $migracao$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_avaliar_fontes_impacto_visita_legado(uuid,uuid,integer)'::regprocedure);
 a text:=$a$and not pcm.sso_escolha_alteracao_atual('visita',itens.request_id,p_cliente_id,p_plano_id,v_rascunho,p_expected_plano))$a$;
 b text:=$b$and not pcm.sso_escolha_alteracao_atual('visita',itens.request_id,p_cliente_id,p_plano_id,v_rascunho,p_expected_plano) and not pcm.sso_escolha_nova_visita_atual(itens.request_id,p_cliente_id,p_plano_id,v_rascunho,p_expected_plano))$b$;
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 then raise exception 'avaliacao_visita_incompativel' using errcode='55000';end if;
 execute replace(d,a,b);
end; $migracao$;

create function pcm.sso_selar_nova_visita() returns trigger language plpgsql security definer set search_path='' as $$
declare v_plano pcm.planos_manutencao%rowtype;v_previa jsonb;v_rascunho uuid;v_item record;
begin
 perform 1 from pcm.sso_continuidade_revisao_gate where id and habilitado for share;if not found then return new;end if;
 select * into v_plano from pcm.planos_manutencao where id=new.plano_id for update nowait;
 if not found or auth.uid() is null or config.sso_autorizar_acao('plano.gerir',v_plano.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 v_previa:=pcm.sso_previa_revisao_revisionada(new.plano_id,v_plano.revisao,1,null);v_rascunho:=(v_previa->>'versaoRascunhoId')::uuid;
 if v_rascunho is null or (v_previa->>'versaoAnteriorId')::uuid is distinct from new.versao_anterior_id then raise exception 'versao_origem_divergente' using errcode='23514';end if;
 for v_item in select e.* from pcm.sso_escolhas_nova_data_visita e where e.cliente_id=v_plano.cliente_id and e.plano_id=new.plano_id and e.rascunho_id=v_rascunho and e.revisao_plano=v_plano.revisao loop
  if pcm.sso_escolha_nova_visita_atual(v_item.request_id,v_item.cliente_id,v_item.plano_id,v_item.rascunho_id,v_item.revisao_plano) then
   if config.sso_autorizar_acao('visita.confirmar',v_item.cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
   if (v_item.comparacao->>'vencimentoOriginal')::date<new.vigencia_inicio or v_item.vencimento_novo<new.vigencia_inicio then raise exception 'substituicao_anterior_vigencia' using errcode='23514';end if;
   insert into pcm.sso_substituicoes_visita_aprovadas values(v_item.rascunho_id,v_item.preparada_id,v_item.request_id,new.vigencia_inicio,v_item.rotina_id,v_item.visita_id,v_item.serie_id,v_item.semana_origem,v_item.vencimento_novo);
  end if;
 end loop;
 return new;
end; $$;
revoke all on function pcm.sso_selar_nova_visita() from public,anon,authenticated,service_role;
create trigger sso_selar_nova_visita after insert on pcm.aprovacao_revisao_tokens for each row execute function pcm.sso_selar_nova_visita();

-- Inclui a antiga entrada de Visita no mesmo comando explícito de retirada 1674.
do $migracao$
declare d text:=pg_catalog.pg_get_functiondef('pcm.sso_aplicar_retiradas_fila(uuid,uuid,uuid,uuid,integer,text,uuid)'::regprocedure);
 a text:=$a$join pcm.sso_retiradas_impacto_aprovadas s on s.tipo='visita' and s.preparada_id=o.id$a$;
 b text:=$b$join (select tipo,versao_id,preparada_id,resolucao_request_id,vigencia from pcm.sso_retiradas_impacto_aprovadas union all select 'visita'::text,versao_id,preparada_id,escolha_request_id,vigencia from pcm.sso_substituicoes_visita_aprovadas) s on s.tipo='visita' and s.preparada_id=o.id$b$;
 c text:='pcm.sso_substituicoes_calendario_aprovadas,pcm.ocorrencias_rotina_preparadas';
 e text:='pcm.sso_substituicoes_calendario_aprovadas,pcm.sso_substituicoes_visita_aprovadas,pcm.ocorrencias_rotina_preparadas';
begin
 if (length(d)-length(replace(d,a,'')))/length(a)<>1 or (length(d)-length(replace(d,c,'')))/length(c)<>1 then raise exception 'fila_visita_incompativel' using errcode='55000';end if;
 execute replace(replace(d,a,b),c,e);
end; $migracao$;

create table pcm.sso_substituicoes_visita_materializadas (
 escolha_request_id uuid primary key references pcm.sso_escolhas_nova_data_visita(request_id),
 preparada_antiga_id uuid not null references pcm.ocorrencias_visita_preparadas(id),preparada_nova_id uuid not null references pcm.ocorrencias_visita_preparadas(id),
 ciclo_novo_id uuid not null references pcm.sso_ciclos_visita_canonicos(id),versao_id uuid not null references pcm.plano_versoes(id),
 criado_em timestamptz not null default clock_timestamp(),unique(preparada_nova_id),check(preparada_antiga_id<>preparada_nova_id)
);
alter table pcm.sso_substituicoes_visita_materializadas enable row level security;
alter table pcm.sso_substituicoes_visita_materializadas force row level security;
revoke all on pcm.sso_substituicoes_visita_materializadas from public,anon,authenticated,service_role;
create trigger sso_substituicoes_visita_materializadas_imutaveis before update or delete on pcm.sso_substituicoes_visita_materializadas for each row execute function pcm.sso_proteger_conferencia_levantamento();
create function pcm.sso_vincular_nova_visita() returns trigger language plpgsql security definer set search_path='' as $$
declare v_item record;v_candidata jsonb;v_foto jsonb;
begin
 for v_item in
  select s.*,e.cliente_id,e.plano_id,e.candidata from pcm.sso_substituicoes_visita_aprovadas s
  join pcm.sso_escolhas_nova_data_visita e on e.request_id=s.escolha_request_id
  join pcm.plano_versoes v on v.id=s.versao_id and v.estado='aprovado' and v.vigencia_inicio=s.vigencia
  join pcm.ocorrencias_visita_preparadas o on o.id=new.preparada_id and o.plano_id=v.plano_id
  join pcm.sso_ciclos_visita_canonicos c on c.id=new.ciclo_id and c.plano_id=o.plano_id and c.serie_id=s.serie_id and c.semana_origem=s.semana_origem and c.rotina_logica_id=o.rotina_logica_id and c.alvo_tipo=o.alvo_tipo and c.alvo_id=o.alvo_id
  where s.versao_id=new.versao_id and s.rotina_id=new.rotina_id and o.visita_id=s.visita_id and o.serie_id=s.serie_id
   and o.semana_origem=s.semana_origem and o.vencimento_original=s.vencimento_novo
   and s.vigencia<=pcm.sso_data_civil_transicao_plano(v.plano_id,v.id,s.vigencia)
 loop
  if v_item.preparada_id=new.preparada_id then raise exception 'substituicao_reutilizou_ocorrencia' using errcode='23514';end if;
  perform pcm.sso_travar_fontes_impacto_grupo();
  lock table pcm.sso_fila_visita in share mode nowait;
  v_foto:=pcm.sso_fotografar_efeitos_impacto_grupo(v_item.cliente_id,v_item.plano_id,v_item.preparada_id,'visita');
  if coalesce(jsonb_array_length(v_foto->'os'),0)>0 or coalesce(jsonb_array_length(v_foto->'grupo'),0)>0 or coalesce(jsonb_array_length(v_foto->'intencoes'),0)>0 or coalesce(jsonb_array_length(v_foto->'chamadosCalendario'),0)>0 or coalesce(jsonb_array_length(v_foto->'chamadosVisita'),0)>0 or exists(select 1 from pcm.sso_fila_visita fila join pcm.sso_ciclo_visita_versoes cv on cv.ciclo_id=fila.ciclo_id where cv.preparada_id=v_item.preparada_id and fila.estado in ('aguardando','verificacao')) then raise exception 'origem_antiga_exige_reconciliacao' using errcode='23514';end if;
  v_candidata:=pcm.sso_fotografar_candidata_nova_visita(v_item.cliente_id,v_item.plano_id,v_item.preparada_id,v_item.visita_id,new.preparada_id);
  if v_candidata is distinct from v_item.candidata then raise exception 'visita_candidata_alterada' using errcode='40001';end if;
  insert into pcm.sso_substituicoes_visita_materializadas(escolha_request_id,preparada_antiga_id,preparada_nova_id,ciclo_novo_id,versao_id)
   values(v_item.escolha_request_id,v_item.preparada_id,new.preparada_id,new.ciclo_id,new.versao_id);
 end loop;
 return new;
end; $$;
revoke all on function pcm.sso_vincular_nova_visita() from public,anon,authenticated,service_role;
create trigger sso_vincular_nova_visita after insert on pcm.sso_ciclo_visita_usos_versao for each row execute function pcm.sso_vincular_nova_visita();

-- Consulta de candidatas existentes, limitada, sem afirmar completude da fonte de feriados.
create function pcm.sso_listar_candidatas_nova_visita(p_ator uuid,p_cliente uuid,p_plano uuid,p_rascunho uuid,p_preparada uuid,p_revisao integer,p_inicio date,p_fim date,p_comparacao jsonb)
returns table(visita_id uuid,vencimento date,serie_id uuid,semana_origem date) language plpgsql volatile security definer set search_path='' as $$
declare v_ant pcm.ocorrencias_visita_preparadas%rowtype;v_atual jsonb;v_row record;v_foto jsonb;v_total integer:=0;
begin
 if p_inicio is null or p_fim is null or not isfinite(p_inicio) or not isfinite(p_fim) or p_fim<p_inicio or p_fim-p_inicio>90 or jsonb_typeof(p_comparacao) is distinct from 'object' then raise exception 'periodo_invalido' using errcode='22023';end if;
 perform pcm.sso_conferir_decisao_impacto_mediada(p_ator,p_cliente,p_plano,true);
 v_atual:=pcm.sso_comparar_rotina_impacto_v3(p_ator,p_cliente,p_plano,p_revisao,p_rascunho,p_preparada,'visita');
 if v_atual is distinct from p_comparacao then raise exception 'comparacao_obsoleta' using errcode='40001';end if;
 select * into v_ant from pcm.ocorrencias_visita_preparadas where id=p_preparada and plano_id=p_plano;
 if not found then raise exception 'ocorrencia_indisponivel' using errcode='42501';end if;
 for v_row in select v.id from pcm.visitas v join pcm.visita_origem_contratual o on o.visita_id=v.id and o.cliente_id=v.cliente_id
  where v.cliente_id=p_cliente and o.serie_id=v_ant.serie_id and v.natureza='regular' and v.estado in ('rascunho','planejada','confirmada')
   and (v.inicio_em at time zone v.fuso)::date between p_inicio and p_fim order by v.inicio_em,v.id limit 101 loop
  v_total:=v_total+1;if v_total>100 then raise exception 'periodo_com_candidatas_demais' using errcode='54000';end if;
  begin v_foto:=pcm.sso_fotografar_candidata_nova_visita(p_cliente,p_plano,p_preparada,v_row.id,null);
  exception when check_violation then continue;end;
  visita_id:=v_row.id;vencimento:=(v_foto->>'vencimento')::date;serie_id:=(v_foto->>'serieId')::uuid;semana_origem:=(v_foto->>'semanaOrigem')::date;return next;
 end loop;
 if config.sso_autorizar_acao('visita.confirmar',p_cliente) is distinct from true or config.sso_autorizar_acao('plano.gerir',p_cliente) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
end; $$;
revoke all on function pcm.sso_listar_candidatas_nova_visita(uuid,uuid,uuid,uuid,uuid,integer,date,date,jsonb) from public,anon,authenticated,service_role;

-- Leitura recuperável; não demonstra fonte externa completa nem aplica substituição.
create function pcm.sso_consultar_escolha_nova_visita(p_ator uuid,p_cliente uuid,p_plano uuid,p_rascunho uuid,p_preparada uuid,p_revisao integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v pcm.sso_escolhas_nova_data_visita%rowtype;v_atual boolean;v_ultima uuid;
begin
 perform pcm.sso_conferir_decisao_impacto_mediada(p_ator,p_cliente,p_plano,true);
 select d.request_id into v_ultima from pcm.sso_decisoes_impacto_visita d where d.cliente_id=p_cliente and d.plano_id=p_plano and d.rascunho_id=p_rascunho and d.preparada_id=p_preparada and d.revisao_plano=p_revisao order by d.revisao desc limit 1;
 select * into v from pcm.sso_escolhas_nova_data_visita where request_id=v_ultima and cliente_id=p_cliente and plano_id=p_plano and rascunho_id=p_rascunho and preparada_id=p_preparada and revisao_plano=p_revisao;
 if not found then return null;end if;
 v_atual:=pcm.sso_escolha_nova_visita_atual(v.request_id,p_cliente,p_plano,p_rascunho,p_revisao);
 if config.sso_autorizar_acao('plano.gerir',p_cliente) is distinct from true or config.sso_autorizar_acao('visita.confirmar',p_cliente) is distinct from true then raise exception 'sem_acesso' using errcode='42501';end if;
 return jsonb_build_object('requestId',v.request_id,'preparadaId',v.preparada_id,'visitaId',v.visita_id,'data',v.vencimento_novo,'serieId',v.serie_id,'semanaOrigem',v.semana_origem,'fonteFeriados',v.fonte_feriados,'atual',v_atual,'fontesFeriadosCompletas',false,'substituicaoAplicada',exists(select 1 from pcm.sso_substituicoes_visita_materializadas m where m.escolha_request_id=v.request_id));
end; $$;
revoke all on function pcm.sso_consultar_escolha_nova_visita(uuid,uuid,uuid,uuid,uuid,integer) from public,anon,authenticated,service_role;

-- Entradas mediadas: ator, Cliente, permissões e gates são revalidados no servidor.
grant execute on function pcm.sso_escolher_nova_visita(uuid,uuid,uuid,uuid,uuid,uuid,integer,integer,uuid,date,text,text,jsonb) to authenticated;
grant execute on function pcm.sso_listar_candidatas_nova_visita(uuid,uuid,uuid,uuid,uuid,integer,date,date,jsonb) to authenticated;
grant execute on function pcm.sso_consultar_escolha_nova_visita(uuid,uuid,uuid,uuid,uuid,integer) to authenticated;
