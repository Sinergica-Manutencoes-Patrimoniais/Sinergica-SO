-- ADR-0365: congela somente na transição, sem alterar snapshots anteriores.
create table pcm.sso_snapshot_evidencia_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
alter table pcm.sso_snapshot_evidencia_gate enable row level security;
alter table pcm.sso_snapshot_evidencia_gate force row level security;
revoke all on pcm.sso_snapshot_evidencia_gate from public,anon,authenticated,service_role;
insert into pcm.sso_snapshot_evidencia_gate(id,habilitado) values(true,false);
create function pcm.sso_congelar_evidencias_pergunta() returns trigger language plpgsql security definer set search_path='' as $$
declare v_rotina jsonb;v_pergunta jsonb;v_questoes jsonb;v_contrato pcm.sso_contratos_evidencia_pergunta%rowtype;v_saida jsonb:='[]'::jsonb;v_rotina_id uuid;v_questionario_id uuid;
begin
 if old.estado<>'rascunho' or new.estado<>'aprovado' or not coalesce((select habilitado from pcm.sso_snapshot_evidencia_gate where id),false) then return new; end if;
 if jsonb_typeof(new.snapshot->'rotinas') is distinct from 'array' then raise exception 'snapshot_invalido' using errcode='23514'; end if;
 for v_rotina in select value from jsonb_array_elements(new.snapshot->'rotinas') loop
  if v_rotina->>'questionario_id' is null then continue; end if;
  v_rotina_id:=(v_rotina->>'id')::uuid;v_questionario_id:=(v_rotina->>'questionario_id')::uuid;
  if jsonb_typeof(v_rotina->'questionario') is distinct from 'object' or v_rotina->'questionario'->>'id' is distinct from v_rotina->>'questionario_id' then raise exception 'questionario_invalido' using errcode='23514'; end if;
  v_questoes:=v_rotina->'questionario'->'perguntas';
  if jsonb_typeof(v_questoes) is distinct from 'array' or jsonb_array_length(v_questoes)=0 then raise exception 'perguntas_indisponiveis' using errcode='23514'; end if;
  if exists(select 1 from jsonb_array_elements(v_questoes) x(item) where jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'id') not in ('string','number') or nullif(btrim(item->>'id'),'') is null) or exists(select 1 from jsonb_array_elements(v_questoes) x(item) group by item->>'id' having count(*)>1) then raise exception 'perguntas_invalidas' using errcode='23514'; end if;
  for v_pergunta in select value from jsonb_array_elements(v_questoes) loop
   select * into v_contrato from pcm.sso_contratos_evidencia_pergunta c where c.plano_id=new.plano_id and c.versao_id=new.id and c.rotina_id=v_rotina_id and c.pergunta_id=v_pergunta->>'id' order by c.revisao_plano desc limit 1;
   if not found or v_contrato.questionario_id is distinct from v_questionario_id or v_contrato.pergunta_fonte is distinct from v_pergunta then raise exception 'contrato_evidencia_ausente_ou_obsoleto' using errcode='23514'; end if;
   v_saida:=v_saida||jsonb_build_array(jsonb_build_object('rotinaId',v_rotina_id,'questionarioId',v_questionario_id,'perguntaId',v_pergunta->>'id','exigida',v_contrato.exigida,'contratoId',v_contrato.id));
  end loop;
 end loop;
 new.snapshot:=jsonb_set(new.snapshot,'{contratos_evidencias}',v_saida,true);return new;
end; $$;
revoke all on function pcm.sso_congelar_evidencias_pergunta() from public,anon,authenticated,service_role;
create trigger sso_congelar_evidencias_pergunta before update of estado on pcm.plano_versoes for each row execute function pcm.sso_congelar_evidencias_pergunta();

create function pcm.sso_checar_evidencias_snapshot(p_cliente_id uuid,p_retorno_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_retorno pcm.retorno_os_preparado%rowtype;v_snapshot jsonb;v_rotina jsonb;v_questionario text;v_num integer;v_item record;v_apos integer:=null;v_lidos integer;v_qtd integer;v_tipo text;v_valor text;v_contrato_questionario text;v_indeterminadas integer:=0;v_exigidas integer:=0;v_sem_decisao integer:=0;
begin
 if not coalesce((select habilitado from pcm.validacao_os_gate where id),false) or not coalesce((select habilitado from pcm.sso_upload_evidencia_resposta_gate where id),false) or not coalesce((select habilitado from pcm.sso_validacao_resposta_gate where id),false) then raise exception 'cobertura_bloqueada' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('execucao.validar',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 select * into v_retorno from pcm.retorno_os_preparado where id=p_retorno_id and cliente_id=p_cliente_id;
 if not found then raise exception 'retorno_indisponivel' using errcode='23514'; end if;
 select v.snapshot into v_snapshot from pcm.plano_versoes v join pcm.planos_manutencao p on p.id=v.plano_id and p.cliente_id=p_cliente_id where v.id=v_retorno.versao_id and v.estado='aprovado';
 if not found or jsonb_typeof(v_snapshot->'rotinas') is distinct from 'array' then raise exception 'snapshot_indisponivel' using errcode='23514'; end if;
 select count(*),min(x.item::text)::jsonb into v_num,v_rotina from jsonb_array_elements(v_snapshot->'rotinas') x(item) where x.item->>'id'=v_retorno.rotina_id::text;
 if v_num<>1 then raise exception 'rotina_indisponivel' using errcode='23514'; end if; v_questionario:=v_rotina->>'questionario_id';
 loop
  v_lidos:=0;
  for v_item in select * from pcm.sso_prever_cobertura_perguntas_contrato(p_cliente_id,p_retorno_id,v_apos,100) loop
   v_lidos:=v_lidos+1;v_apos:=v_item.indice;
   select count(*),min(jsonb_typeof(x.item->'exigida')),min(x.item->>'exigida'),min(x.item->>'questionarioId') into v_qtd,v_tipo,v_valor,v_contrato_questionario
    from jsonb_array_elements(case when jsonb_typeof(v_snapshot->'contratos_evidencias')='array' then v_snapshot->'contratos_evidencias' else '[]'::jsonb end) x(item)
    where x.item->>'rotinaId'=v_retorno.rotina_id::text and x.item->>'perguntaId'=v_item.pergunta_id;
   if v_qtd<>1 or v_tipo is distinct from 'boolean' or v_contrato_questionario is distinct from v_questionario then v_indeterminadas:=v_indeterminadas+1;
   elsif v_valor='true' and not (v_item.obrigatoriedade='opcional' and v_item.resposta_id is null) then
    v_exigidas:=v_exigidas+1;
    if v_item.estado is distinct from 'aceita_pcm_sem_autenticacao_externa' then v_sem_decisao:=v_sem_decisao+1; end if;
   end if;
  end loop;
  exit when v_lidos<100;
 end loop;
 return jsonb_build_object('requisitoIndeterminado',v_indeterminadas,'exigenciasAplicaveis',v_exigidas,'semDecisaoPcmAceita',v_sem_decisao,'conteudoAutenticado',false,'aprovacaoDisponivel',false);
end; $$;
revoke all on function pcm.sso_checar_evidencias_snapshot(uuid,uuid) from public,anon,authenticated,service_role;

create function pcm.sso_listar_contratos_evidencia_rascunho(p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid,p_apos integer,p_limite integer)
returns table(indice integer,pergunta_id text,exigida boolean,contrato_atual boolean,revisao_plano integer)
language plpgsql stable security definer set search_path='' as $$
declare v_perguntas jsonb;v_questionario uuid;
begin
 if not coalesce((select habilitado from pcm.sso_contrato_evidencia_gate where id),false) then raise exception 'contrato_evidencia_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_limite is null or p_limite not between 1 and 100 or (p_apos is not null and p_apos<0) then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 select q.perguntas,q.id into v_perguntas,v_questionario from pcm.planos_manutencao p join pcm.plano_versoes v on v.plano_id=p.id and v.estado='rascunho' join pcm.rotinas_manutencao r on r.versao_id=v.id and r.plano_id=p.id join pcm.questionarios q on q.id=r.questionario_id and q.ativo where p.id=p_plano_id and p.cliente_id=p_cliente_id and p.estado='rascunho' and v.id=p_versao_id and r.id=p_rotina_id;
 if not found or jsonb_typeof(v_perguntas) is distinct from 'array' then raise exception 'questionario_indisponivel' using errcode='23514'; end if;
 if exists(select 1 from jsonb_array_elements(v_perguntas) x(item) where jsonb_typeof(item) is distinct from 'object' or jsonb_typeof(item->'id') not in ('string','number') or nullif(btrim(item->>'id'),'') is null) or exists(select 1 from jsonb_array_elements(v_perguntas) x(item) group by item->>'id' having count(*)>1) then raise exception 'perguntas_invalidas' using errcode='23514'; end if;
 return query select x.ord::integer,x.item->>'id',c.exigida,coalesce(c.questionario_id=v_questionario and c.pergunta_fonte=x.item,false),c.revisao_plano from jsonb_array_elements(v_perguntas) with ordinality x(item,ord)
 left join lateral (select c0.* from pcm.sso_contratos_evidencia_pergunta c0 where c0.plano_id=p_plano_id and c0.versao_id=p_versao_id and c0.rotina_id=p_rotina_id and c0.pergunta_id=x.item->>'id' order by c0.revisao_plano desc limit 1) c on true where p_apos is null or x.ord>p_apos order by x.ord limit p_limite;
end; $$;
revoke all on function pcm.sso_listar_contratos_evidencia_rascunho(uuid,uuid,uuid,uuid,integer,integer) from public,anon,authenticated,service_role;

create function pcm.sso_historico_contrato_evidencia(p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid,p_pergunta_id text,p_antes integer,p_limite integer)
returns table(id uuid,revisao_plano integer,exigida boolean,justificativa text,ator_id uuid,criado_em timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not coalesce((select habilitado from pcm.sso_contrato_evidencia_gate where id),false) then raise exception 'contrato_evidencia_bloqueado' using errcode='55000'; end if;
 if auth.uid() is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true or not exists(select 1 from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id) then raise exception 'sem_acesso' using errcode='42501'; end if;
 if p_pergunta_id is null or length(btrim(p_pergunta_id)) not between 1 and 250 or p_limite is null or p_limite not between 1 and 100 or (p_antes is not null and p_antes<1) then raise exception 'paginacao_invalida' using errcode='22023'; end if;
 return query select c.id,c.revisao_plano,c.exigida,c.justificativa,c.ator_id,c.criado_em from pcm.sso_contratos_evidencia_pergunta c where c.plano_id=p_plano_id and c.versao_id=p_versao_id and c.rotina_id=p_rotina_id and c.pergunta_id=p_pergunta_id and (p_antes is null or c.revisao_plano<p_antes) order by c.revisao_plano desc limit p_limite;
end; $$;
revoke all on function pcm.sso_historico_contrato_evidencia(uuid,uuid,uuid,uuid,text,integer,integer) from public,anon,authenticated,service_role;
