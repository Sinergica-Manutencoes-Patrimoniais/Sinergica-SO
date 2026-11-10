-- ADR-0990: defesa comum aos caminhos de aprovação parcial; não altera linhas já aprovadas.
create function pcm.sso_guardar_hierarquia_aprovacao_parcial() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_tipo text;v_pai_chave text;v_pai_tipo text;
begin
  perform pcm.sso_exigir_hierarquia_parcial_aciclica(new.lote_id,jsonb_build_array(jsonb_build_object('chave',new.linha_chave)));
  select l.tipo,nullif(btrim(l.atributos->>'referenciaPai'),'') into v_tipo,v_pai_chave
    from pcm.sso_levantamento_linhas l where l.lote_id=new.lote_id and l.chave=new.linha_chave;
  if not found then raise exception 'linha_indisponivel' using errcode='23514'; end if;
  if v_tipo='area' and v_pai_chave is not null then raise exception 'area_nao_admite_pai' using errcode='23514'; end if;
  if v_pai_chave is null then return new; end if;
  select l.tipo into v_pai_tipo from pcm.sso_levantamento_linhas l where l.lote_id=new.lote_id and l.chave=v_pai_chave;
  if not found then return new; end if;
  if not ((v_tipo='local' and v_pai_tipo='area')
    or (v_tipo='sublocal' and v_pai_tipo in ('local','sublocal'))
    or (v_tipo='sistema' and v_pai_tipo in ('area','local','sublocal'))
    or (v_tipo in ('equipamento','grupo_quantitativo') and v_pai_tipo in ('local','sublocal'))
    or (v_tipo='componente' and v_pai_tipo in ('local','sublocal','equipamento'))) then
    raise exception 'tipo_pai_incompativel' using errcode='23514';
  end if;
  return new;
end; $$;
revoke all on function pcm.sso_guardar_hierarquia_aprovacao_parcial() from public,anon,authenticated,service_role;
create trigger sso_guardar_hierarquia_aprovacao_parcial before insert on pcm.sso_aprovacoes_parciais_linhas
for each row execute function pcm.sso_guardar_hierarquia_aprovacao_parcial();
