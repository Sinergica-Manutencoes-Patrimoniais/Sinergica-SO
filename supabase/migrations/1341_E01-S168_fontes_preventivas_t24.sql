-- ADR-1174: revalidação parcial privada; não autoriza rede.
create function pcm.sso_t24_fontes_preventivas_atuais(p_tentativa_id uuid) returns boolean
language plpgsql volatile security definer set search_path='' as $$
declare t pcm.sso_t24_tentativas%rowtype;r pcm.sso_t24_produtor_recibos%rowtype;v pcm.visitas%rowtype;o pcm.ordens_servico%rowtype;
 f pcm.funcionarios%rowtype;b pcm.os_rotina_vinculos_explicitos%rowtype;ev pcm.os_rotina_vinculo_eventos%rowtype;c pcm.visita_confirmacoes%rowtype;
 e pcm.equipamentos%rowtype;m pcm.sso_categoria_componente%rowtype;pol pcm.sso_politica_equipment_categoria%rowtype;q pcm.questionarios%rowtype;cliente pcm.clientes%rowtype;tipo pcm.tipos_tarefa%rowtype;
 snap jsonb;atual jsonb;esperada jsonb;esperado jsonb;despacho jsonb;alvo_id uuid;alvo_tipo text;alvo bigint;questionario_id uuid;revisao_vinculo integer;qtd integer;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.role() is distinct from 'service_role' or p_tentativa_id is null then raise exception 'servico_nao_autorizado' using errcode='42501'; end if;
 select * into t from pcm.sso_t24_tentativas where id=p_tentativa_id for share nowait;
 if not found then return false; end if;
 select * into r from pcm.sso_t24_produtor_recibos where tentativa_id=t.id and protocolo='preventiva' and cliente_id=t.cliente_id and visita_id=t.visita_id and os_id=t.os_id and revisao=t.revisao_visita;
 if not found then return false; end if;
 select * into v from pcm.visitas where id=t.visita_id and cliente_id=t.cliente_id and revisao=t.revisao_visita and estado='confirmada' for share nowait;
 if not found or v.inicio_em is distinct from date_trunc('milliseconds',v.inicio_em) or t.elegivel_em is distinct from v.inicio_em-interval '24 hours' then return false; end if;
 select * into o from pcm.ordens_servico where id=t.os_id and client_id=t.cliente_id and categoria='preventiva' and deleted_at is null for share nowait;
 if not found or o.status in ('finalizado','cancelado') then return false; end if;
 select * into cliente from pcm.clientes where id=v.cliente_id and ativo and deleted_at is null and auvo_id>0 for share nowait;if not found then return false;end if;
 select * into tipo from pcm.tipos_tarefa where id=o.tipo_tarefa_id and ativo and deleted_at is null and auvo_id>0 for share nowait;if not found then return false;end if;
 despacho:=jsonb_build_object('clienteId',cliente.id,'clienteAuvoId',cliente.auvo_id::text,'tipoTarefaId',tipo.id,'tipoTarefaAuvoId',tipo.auvo_id::text,'titulo',o.titulo,'descricao',o.descricao,'prioridade',o.prioridade);
 if t.despacho is distinct from despacho then return false;end if;
 perform 1 from pcm.visita_ordens_servico where visita_id=v.id and os_id=o.id and cliente_id=v.cliente_id and encerrado_em is null for share nowait;
 if not found or not pcm.sso_conteudo_basico_conferido(v.id,o.id) then return false; end if;
 if (t.operacao='criar' and o.auvo_task_id is not null) or (t.operacao='atualizar' and o.auvo_task_id::text is distinct from t.tarefa_id) then return false; end if;
 select * into c from pcm.visita_confirmacoes where visita_id=v.id and cliente_id=v.cliente_id and revisao=v.revisao;
 if not found then return false; end if;
 select * into b from pcm.os_rotina_vinculos_explicitos where os_id=o.id and cliente_id=v.cliente_id;
 if not found then return false; end if;
 select * into ev from pcm.os_rotina_vinculo_eventos where os_id=o.id order by revisao desc limit 1;
 if ev.acao='invalidar' then return false; end if;
 revisao_vinculo:=coalesce(ev.revisao,1);
 if revisao_vinculo=1 then
  esperada:=jsonb_build_object('osId',b.os_id,'ocorrenciaLegadaId',b.ocorrencia_legada_id,'ocorrenciaPreparadaId',b.ocorrencia_preparada_id,
   'planoId',b.plano_id,'versaoId',b.versao_id,'rotinaId',b.rotina_id,'alvoTipo',b.alvo_tipo,'alvoId',b.alvo_id);snap:=b.rotina_snapshot;
 else esperada:=ev.previa;snap:=ev.rotina_snapshot;end if;
 select jsonb_build_object('osId',o.id,'ocorrenciaLegadaId',o.ocorrencia_preventiva_id,'ocorrenciaPreparadaId',oc.id,'planoId',oc.plano_id,
   'versaoId',oc.versao_id,'rotinaId',oc.rotina_id,'alvoTipo',oc.alvo_tipo,'alvoId',oc.alvo_id),versao.snapshot
  into atual,esperado from pcm.ocorrencias_rotina_vinculos ponte join pcm.ocorrencias_rotina_preparadas oc on oc.id=ponte.ocorrencia_preparada_id
   join pcm.planos_manutencao plano on plano.id=oc.plano_id and plano.cliente_id=v.cliente_id
   join pcm.plano_versoes versao on versao.id=oc.versao_id and versao.plano_id=plano.id and versao.estado='aprovado'
  where ponte.ocorrencia_legada_id=o.ocorrencia_preventiva_id for share of ponte,oc,plano,versao nowait;
 if not found or atual is distinct from esperada or jsonb_typeof(esperado->'rotinas') is distinct from 'array' then return false; end if;
 select count(*),min(item::text)::jsonb into qtd,atual from jsonb_array_elements(esperado->'rotinas') item where item->>'id'=esperada->>'rotinaId';
 if qtd<>1 or atual is distinct from snap or not exists(select 1 from pcm.os_rotina_conferencias x where x.os_id=o.id and x.cliente_id=v.cliente_id
  and x.visita_id=v.id and x.revisao_visita=v.revisao-1 and x.revisao_vinculo=revisao_vinculo and x.previa=esperada and x.criado_em<=c.confirmado_em) then return false; end if;
 if coalesce(snap->'alvo'->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
 alvo_id:=(snap->'alvo'->>'id')::uuid;alvo_tipo:=snap->'alvo'->>'tipo';
 if alvo_tipo='sistema' then select auvo_equipment_id into alvo from pcm.sistemas where id=alvo_id and cliente_id=v.cliente_id and ativo and deleted_at is null for share nowait;
 elsif alvo_tipo='componente' then
  select * into e from pcm.equipamentos where id=alvo_id and client_id=v.cliente_id and ativo and deleted_at is null for share nowait;
  if not found then return false; end if;
  perform 1 from pcm.sso_politica_equipment_gate where id and habilitado for share nowait;if not found then return false; end if;
  select * into m from pcm.sso_categoria_componente where componente_id=e.id and cliente_id=v.cliente_id for share nowait;
  if not found or m.texto_observado is distinct from e.categoria then return false; end if;
  perform 1 from pcm.equipamento_categorias where id=m.categoria_id and deleted_at is null for share nowait;if not found then return false; end if;
  select * into pol from pcm.sso_politica_equipment_categoria where categoria_id=m.categoria_id for share nowait;
  if not found or pol.equipamento_controlado is distinct from true then return false; end if;
  alvo:=e.auvo_equipment_id;if e.auvo_id is not null and e.auvo_id is distinct from alvo then return false; end if;
 else return false;end if;
 if alvo is null or alvo<=0 then return false; end if;
 if snap->>'questionario_id' is not null then
  if snap->>'questionario_id' !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  questionario_id:=(snap->>'questionario_id')::uuid;
  select * into q from pcm.questionarios where id=questionario_id and ativo and auvo_id>0 for share nowait;
  if not found or snap->'questionario'->>'auvo_id' is distinct from q.auvo_id::text then return false; end if;
 end if;
 select * into f from pcm.funcionarios where id=v.responsavel_id and ativo and deleted_at is null and auvo_user_id>0 for share nowait;
 if not found then return false; end if;
 esperado:=jsonb_build_object('tecnicoId',f.auvo_user_id::text,'inicio',to_char(v.inicio_em at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'alvoId',alvo::text,'questionarioId',case when questionario_id is null then null else q.auvo_id::text end);
 return t.esperado=esperado and t.questionario_obrigatorio=(questionario_id is not null);
exception when lock_not_available then return false;
end; $$;
revoke all on function pcm.sso_t24_fontes_preventivas_atuais(uuid) from public,anon,authenticated,service_role;
