-- ADR-0837: preparação privada, sem alterar policies, gates ou grants atuais.
create function pcm.sso_s180_dispatch_fontes_privado(p_bucket text,p_nome text,p_owner text)
returns boolean language plpgsql volatile security definer set search_path='' as $$
declare v_partes text[]; v_alvo uuid; v_os uuid; v_revisao integer;
begin
  if current_setting('transaction_isolation') <> 'read committed' then return false; end if;
  if not pg_catalog.pg_try_advisory_xact_lock_shared(
    pg_catalog.hashtextextended('sso-autorizacao-confirmacao-visita',0)
  ) then return false; end if;
  if auth.uid() is null or p_owner is distinct from auth.uid()::text or p_nome is null then return false; end if;
  v_partes:=string_to_array(p_nome,'/');
  if coalesce(array_length(v_partes,1),0) < 2
     or v_partes[1] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or v_partes[2] !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  v_alvo:=v_partes[2]::uuid;
  case p_bucket
    when 'sso-grupos-fotos' then
      perform 1 from pcm.sso_grupo_fotos_gate where id for share nowait;
      if not found then return false; end if;
      perform 1 from pcm.grupos_quantitativos where id=v_alvo for share nowait;
      if not found then return false; end if;
    when 'sso-material-evidencias' then
      if array_length(v_partes,1) is distinct from 4 or v_partes[3] !~ '^[1-9][0-9]{0,8}$' then return false; end if;
      v_revisao:=v_partes[3]::integer;
      perform 1 from pcm.sso_material_evidencia_gate where id for share nowait;
      if not found then return false; end if;
      select l.ordem_servico_id into v_os from pcm.listas_materiais l where l.id=v_alvo for share nowait;
      if not found then return false; end if;
      perform 1 from pcm.sso_lista_materiais_eventos where lista_id=v_alvo and revisao=v_revisao for share nowait;
      if not found then return false; end if;
      perform 1 from pcm.ordens_servico where id=v_os for share nowait;
      if not found then return false; end if;
    when 'sso-levantamento-fotos' then
      perform 1 from pcm.sso_fotos_levantamento_gate where id for share nowait;
      if not found then return false; end if;
      perform 1 from pcm.sso_levantamentos where id=v_alvo for share nowait;
      if not found then return false; end if;
    when 'sso-levantamento-documentos' then
      perform 1 from pcm.sso_documentos_levantamento_gate where id for share nowait;
      if not found then return false; end if;
      perform 1 from pcm.sso_levantamentos where id=v_alvo for share nowait;
      if not found then return false; end if;
    when 'sso-retorno-evidencias' then
      perform 1 from pcm.validacao_os_gate where id for share nowait;
      if not found then return false; end if;
      perform 1 from pcm.sso_upload_evidencia_resposta_gate where id for share nowait;
      if not found then return false; end if;
      perform 1 from storage.buckets where id=p_bucket for share nowait;
      if not found then return false; end if;
      select r.os_id into v_os from pcm.retorno_os_preparado r where r.id=v_alvo for share nowait;
      if not found then return false; end if;
      perform 1 from pcm.ordens_servico where id=v_os for share nowait;
      if not found then return false; end if;
    when 'sso-despesas-visita' then
      perform 1 from pcm.sso_upload_comprovante_gate where id for share nowait;
      if not found then return false; end if;
      perform 1 from pcm.despesas_visita where id=v_alvo for share nowait;
      if not found then return false; end if;
    else return false;
  end case;
  return pcm.sso_s180_dispatch_autorizacao_privada(p_bucket,p_nome,p_owner);
exception when lock_not_available then return false;
end $$;
revoke all on function pcm.sso_s180_dispatch_fontes_privado(text,text,text) from public,anon,authenticated,service_role;
comment on function pcm.sso_s180_dispatch_fontes_privado(text,text,text) is
  'Preparação privada desconectada; GRANT/REVOKE SQL e ativação de policies exigem revisão.';
