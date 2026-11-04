-- ADR-0989: validação interna sob trava do lote, sem alterar cadastro oficial.
create function pcm.sso_exigir_hierarquia_parcial_aciclica(p_lote_id uuid,p_itens jsonb) returns void
language plpgsql stable security definer set search_path='' as $$
declare v_invalida boolean;
begin
  if p_lote_id is null or jsonb_typeof(p_itens) is distinct from 'array' then raise exception 'selecao_invalida' using errcode='22023'; end if;
  if jsonb_array_length(p_itens) not between 1 and 50 then raise exception 'quantidade_invalida' using errcode='22023'; end if;
  with recursive trilha(chave,proximo,caminho,ciclo,profundidade) as (
    select l.chave,nullif(btrim(l.atributos->>'referenciaPai'),''),array[l.chave]::text[],false,1
      from pcm.sso_levantamento_linhas l join jsonb_array_elements(p_itens) x(item) on x.item->>'chave'=l.chave
      where l.lote_id=p_lote_id
    union all
    select pai.chave,nullif(btrim(pai.atributos->>'referenciaPai'),''),t.caminho||pai.chave,pai.chave=any(t.caminho),t.profundidade+1
      from trilha t join pcm.sso_levantamento_linhas pai on pai.lote_id=p_lote_id and pai.chave=t.proximo
      where not t.ciclo and t.profundidade<=1000
  ) select exists(select 1 from trilha where ciclo or profundidade>1000) into v_invalida;
  if v_invalida then raise exception 'hierarquia_ciclica_ou_extensa' using errcode='23514'; end if;
end; $$;
revoke all on function pcm.sso_exigir_hierarquia_parcial_aciclica(uuid,jsonb) from public,anon,authenticated,service_role;
