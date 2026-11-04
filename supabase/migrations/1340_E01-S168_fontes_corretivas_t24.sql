-- ADR-1173: revalidação parcial e privada, sem efeito externo.
create function pcm.sso_t24_fontes_corretivas_atuais(p_tentativa_id uuid) returns boolean
language plpgsql volatile security definer set search_path='' as $$
declare t pcm.sso_t24_tentativas%rowtype;r pcm.sso_t24_produtor_recibos%rowtype;v pcm.visitas%rowtype;o pcm.ordens_servico%rowtype;
 f pcm.funcionarios%rowtype;e pcm.equipamentos%rowtype;m pcm.sso_categoria_componente%rowtype;pol pcm.sso_politica_equipment_categoria%rowtype;
 q pcm.questionarios%rowtype;cliente pcm.clientes%rowtype;tipo pcm.tipos_tarefa%rowtype;alvo bigint;esperado jsonb;despacho jsonb;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
 if auth.role() is distinct from 'service_role' or p_tentativa_id is null then raise exception 'servico_nao_autorizado' using errcode='42501'; end if;
 select * into t from pcm.sso_t24_tentativas where id=p_tentativa_id for share nowait;
 if not found then return false; end if;
 select * into r from pcm.sso_t24_produtor_recibos where tentativa_id=t.id and protocolo='corretiva' and cliente_id=t.cliente_id and visita_id=t.visita_id and os_id=t.os_id and revisao=t.revisao_visita;
 if not found then return false; end if;
 select * into v from pcm.visitas where id=t.visita_id and cliente_id=t.cliente_id and revisao=t.revisao_visita and estado='confirmada' for share nowait;
 if not found or v.inicio_em is distinct from date_trunc('milliseconds',v.inicio_em) or t.elegivel_em is distinct from v.inicio_em-interval '24 hours' then return false; end if;
 select * into o from pcm.ordens_servico where id=t.os_id and client_id=t.cliente_id and categoria='corretiva' and deleted_at is null for share nowait;
 if not found or o.status in ('finalizado','cancelado') or (o.sistema_id is null)=(o.equipamento_id is null) then return false; end if;
 select * into cliente from pcm.clientes where id=v.cliente_id and ativo and deleted_at is null and auvo_id>0 for share nowait;if not found then return false;end if;
 select * into tipo from pcm.tipos_tarefa where id=o.tipo_tarefa_id and ativo and deleted_at is null and auvo_id>0 for share nowait;if not found then return false;end if;
 despacho:=jsonb_build_object('clienteId',cliente.id,'clienteAuvoId',cliente.auvo_id::text,'tipoTarefaId',tipo.id,'tipoTarefaAuvoId',tipo.auvo_id::text,'titulo',o.titulo,'descricao',o.descricao,'prioridade',o.prioridade);
 if t.despacho is distinct from despacho then return false;end if;
 perform 1 from pcm.visita_ordens_servico where visita_id=v.id and os_id=o.id and cliente_id=v.cliente_id and encerrado_em is null for share nowait;
 if not found or not pcm.sso_conteudo_basico_conferido(v.id,o.id) then return false; end if;
 if (t.operacao='criar' and o.auvo_task_id is not null) or (t.operacao='atualizar' and o.auvo_task_id::text is distinct from t.tarefa_id) then return false; end if;
 select * into f from pcm.funcionarios where id=v.responsavel_id and ativo and deleted_at is null and auvo_user_id>0 for share nowait;
 if not found then return false; end if;
 if o.sistema_id is not null then
  select auvo_equipment_id into alvo from pcm.sistemas where id=o.sistema_id and cliente_id=v.cliente_id and ativo and deleted_at is null for share nowait;
 else
  select * into e from pcm.equipamentos where id=o.equipamento_id and client_id=v.cliente_id and ativo and deleted_at is null for share nowait;
  if not found then return false; end if;
  perform 1 from pcm.sso_politica_equipment_gate where id and habilitado for share nowait;
  if not found then return false; end if;
  select * into m from pcm.sso_categoria_componente where componente_id=e.id and cliente_id=v.cliente_id for share nowait;
  if not found or m.texto_observado is distinct from e.categoria then return false; end if;
  perform 1 from pcm.equipamento_categorias where id=m.categoria_id and deleted_at is null for share nowait;
  if not found then return false; end if;
  select * into pol from pcm.sso_politica_equipment_categoria where categoria_id=m.categoria_id for share nowait;
  if not found or pol.equipamento_controlado is distinct from true then return false; end if;
  alvo:=e.auvo_equipment_id;if e.auvo_id is not null and e.auvo_id is distinct from alvo then return false; end if;
 end if;
 if alvo is null or alvo<=0 then return false; end if;
 if o.questionario_id is not null then
  select * into q from pcm.questionarios where id=o.questionario_id and ativo and auvo_id>0 for share nowait;
  if not found then return false; end if;
 end if;
 esperado:=jsonb_build_object('tecnicoId',f.auvo_user_id::text,'inicio',to_char(v.inicio_em at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  'alvoId',alvo::text,'questionarioId',case when o.questionario_id is null then null else q.auvo_id::text end);
 return t.esperado=esperado and t.questionario_obrigatorio=(o.questionario_id is not null);
exception when lock_not_available then return false;
end; $$;
revoke all on function pcm.sso_t24_fontes_corretivas_atuais(uuid) from public,anon,authenticated,service_role;
