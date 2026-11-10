-- ADR-0972: consulta privada do estado atual, sem declarar conferência.
create function pcm.sso_consultar_conferencia_copia(p_cliente_id uuid,p_plano_id uuid,p_versao_id uuid,p_rotina_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' set timezone='UTC' as $$
declare v_plano pcm.planos_manutencao%rowtype;v_rotina pcm.rotinas_manutencao%rowtype;v_questionario pcm.questionarios%rowtype;
  v_hash text;v_copiada boolean;v_conferida boolean;v_projecao jsonb:=null;v_origem jsonb;v_snapshot jsonb;v_item jsonb;
  v_total integer;v_comparacao text:='historico_indeterminado';
begin
  if current_setting('transaction_isolation')<>'read committed' then raise exception 'isolamento_nao_suportado' using errcode='25001'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)) then raise exception 'autorizacao_em_alteracao' using errcode='55P03'; end if;
  perform 1 from pcm.sso_conferencia_copia_rotina_gate where id and habilitado for share;
  if not found then raise exception 'conferencia_copia_desabilitada' using errcode='55000'; end if;
  if auth.uid() is null or p_cliente_id is null or p_plano_id is null or p_versao_id is null or p_rotina_id is null
    or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select * into v_plano from pcm.planos_manutencao where id=p_plano_id and cliente_id=p_cliente_id for share;
  if not found then raise exception 'sem_acesso' using errcode='42501'; end if;
  perform 1 from pcm.plano_versoes where id=p_versao_id and plano_id=p_plano_id and estado='rascunho' for share;
  if not found then raise exception 'versao_indisponivel' using errcode='23514'; end if;
  select * into v_rotina from pcm.rotinas_manutencao where id=p_rotina_id and plano_id=p_plano_id and versao_id=p_versao_id for share;
  if not found then raise exception 'rotina_indisponivel' using errcode='23514'; end if;
  select exists(select 1 from pcm.sso_copias_rotina_modelo c where c.destino_cliente_id=p_cliente_id and c.destino_plano_id=p_plano_id and c.destino_rotina_id=p_rotina_id)
    or exists(select 1 from pcm.sso_copias_plano c cross join lateral jsonb_array_elements(c.resultado->'rotinas') x(item)
      where c.cliente_id=p_cliente_id and c.destino_plano_id=p_plano_id and c.destino_versao_id=p_versao_id and x.item->>'rotinaId'=p_rotina_id::text) into v_copiada;
  if not v_copiada then return jsonb_build_object('clienteId',p_cliente_id,'planoId',p_plano_id,'versaoId',p_versao_id,'rotinaId',p_rotina_id,'copiada',false); end if;
  if v_rotina.questionario_id is not null then
    select * into v_questionario from pcm.questionarios where id=v_rotina.questionario_id and ativo for share;
    if not found then raise exception 'questionario_indisponivel' using errcode='23514'; end if;
    if jsonb_typeof(v_questionario.perguntas) is distinct from 'array' or jsonb_array_length(v_questionario.perguntas)>500
      or pg_column_size(v_questionario.perguntas)>1048576 or length(v_questionario.nome)>1000
      or length(v_questionario.cabecalho)>10000 or length(v_questionario.rodape)>10000 then raise exception 'questionario_nao_projetavel' using errcode='23514'; end if;
    select jsonb_build_object('id',v_questionario.id,'nome',v_questionario.nome,'cabecalho',v_questionario.cabecalho,'rodape',v_questionario.rodape,
      'perguntas',coalesce(jsonb_agg(case when jsonb_typeof(x.item->'texto')='string' and length(btrim(x.item->>'texto'))>0 and length(x.item->>'texto')<=4000
        then to_jsonb(x.item->>'texto') else 'null'::jsonb end order by x.ordem),'[]'::jsonb)) into v_projecao
      from jsonb_array_elements(v_questionario.perguntas) with ordinality x(item,ordem);
  end if;
  select count(*),min(z.origem::text)::jsonb into v_total,v_origem from (
    select jsonb_build_object('cliente',c.origem_cliente_id,'plano',c.origem_plano_id,'versao',c.origem_versao_id,'rotina',c.origem_rotina_id) origem
      from pcm.sso_copias_rotina_modelo c where c.destino_cliente_id=p_cliente_id and c.destino_plano_id=p_plano_id and c.destino_rotina_id=p_rotina_id
    union all
    select jsonb_build_object('cliente',c.cliente_id,'plano',c.origem_plano_id,'versao',c.origem_versao_id,'rotina',x.item->>'origemRotinaId')
      from pcm.sso_copias_plano c cross join lateral jsonb_array_elements(c.resultado->'rotinas') x(item)
      where c.cliente_id=p_cliente_id and c.destino_plano_id=p_plano_id and c.destino_versao_id=p_versao_id and x.item->>'rotinaId'=p_rotina_id::text
  ) z;
  if v_total<>1 then raise exception 'origem_copia_ambigua' using errcode='23514'; end if;
  if config.sso_autorizar_acao('plano.gerir',(v_origem->>'cliente')::uuid) is distinct from true then
    v_comparacao:='origem_restrita';
  else
    select v.snapshot into v_snapshot from pcm.plano_versoes v join pcm.planos_manutencao p on p.id=v.plano_id
      where v.id=(v_origem->>'versao')::uuid and p.id=(v_origem->>'plano')::uuid and p.cliente_id=(v_origem->>'cliente')::uuid and v.estado='aprovado' for share of v,p;
    if jsonb_typeof(v_snapshot->'rotinas')='array' then
      select count(*),min(x.item::text)::jsonb into v_total,v_item from jsonb_array_elements(v_snapshot->'rotinas') x(item)
        where x.item->>'id'=v_origem->>'rotina';
      if v_total=1 then
        if v_item->>'questionario_id' is null and v_rotina.questionario_id is null then v_comparacao:='sem_questionario';
        elsif v_item->>'questionario_id' is distinct from v_rotina.questionario_id::text then v_comparacao:='referencia_alterada';
        elsif jsonb_typeof(v_item->'questionario') is distinct from 'object' or jsonb_typeof(v_item->'questionario'->'perguntas') is distinct from 'array' then v_comparacao:='historico_indeterminado';
        elsif (v_item->'questionario')=to_jsonb(v_questionario) then v_comparacao:='conteudo_integral_igual';
        else v_comparacao:='conteudo_integral_diferente'; end if;
      end if;
    end if;
  end if;
  v_hash:=pcm.sso_hash_rotina_copia(p_plano_id,p_versao_id,p_rotina_id);
  if v_hash is null or config.sso_autorizar_acao('plano.gerir',p_cliente_id) is distinct from true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select exists(select 1 from pcm.sso_conferencias_copia_rotina c where c.cliente_id=p_cliente_id and c.plano_id=p_plano_id
    and c.versao_id=p_versao_id and c.rotina_id=p_rotina_id and c.plano_revision=v_plano.revisao and c.conteudo_sha256=v_hash) into v_conferida;
  return jsonb_build_object('clienteId',p_cliente_id,'planoId',p_plano_id,'versaoId',p_versao_id,'rotinaId',p_rotina_id,
    'copiada',true,'planoRevision',v_plano.revisao,'conteudoSha256',v_hash,'conferenciaAtual',v_conferida,
    'questionarioAtual',v_projecao,'questionarioProjetadoParcialmente',true,'comparacaoQuestionario',v_comparacao,'aprovacaoRealizada',false);
end; $$;
revoke all on function pcm.sso_consultar_conferencia_copia(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
