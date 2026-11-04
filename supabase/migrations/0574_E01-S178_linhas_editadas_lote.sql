-- ADR-0348: projeção mínima, privada e desligada.
create table pcm.sso_linhas_editadas_lote_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_linhas_editadas_lote_gate(id,habilitado) values(true,false);
alter table pcm.sso_linhas_editadas_lote_gate enable row level security;alter table pcm.sso_linhas_editadas_lote_gate force row level security;
revoke all on pcm.sso_linhas_editadas_lote_gate from public,anon,authenticated,service_role;
create function pcm.sso_listar_linhas_editadas_lote(p_lote_id uuid,p_apos text,p_limite integer)
returns table(linha_chave text,ultima_revisao integer,ciclo_atual integer,estado text)
language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;v_ciclo integer;
begin
  if not coalesce((select habilitado from pcm.sso_linhas_editadas_lote_gate where id),false) then raise exception 'consulta_desabilitada' using errcode='55000'; end if;
  if auth.uid() is null or p_lote_id is null or p_limite is null or p_limite not between 1 and 100 or (p_apos is not null and length(p_apos)>200) then raise exception 'parametros_invalidos' using errcode='22023'; end if;
  select l.cliente_id into v_cliente from pcm.sso_levantamentos l where l.id=p_lote_id;
  if v_cliente is null or config.sso_autorizar_acao('cadastro.aprovar',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501'; end if;
  select coalesce((select c.ciclo from pcm.sso_conferencia_ciclos c where c.lote_id=p_lote_id),1) into v_ciclo;
  return query select l.chave,max(e.revisao),v_ciclo,
    case when exists(select 1 from pcm.sso_levantamento_incorporacoes i where i.lote_id=l.lote_id and i.linha_chave=l.chave) then 'incorporada'
      when exists(select 1 from pcm.sso_levantamento_rejeicoes r where r.lote_id=l.lote_id and r.linha_chave=l.chave) then 'rejeitada'
      when exists(select 1 from pcm.sso_conferencia_linhas c where c.lote_id=l.lote_id and c.linha_chave=l.chave and c.ciclo=v_ciclo and c.atributos=l.atributos) then 'conferida'
      else 'pendente' end
    from pcm.sso_levantamento_linhas l join pcm.sso_edicoes_linha_staging e on e.lote_id=l.lote_id and e.linha_chave=l.chave
    where l.lote_id=p_lote_id and (p_apos is null or l.chave>p_apos) group by l.lote_id,l.chave,l.atributos order by l.chave limit p_limite;
end;
$$;
revoke all on function pcm.sso_listar_linhas_editadas_lote(uuid,text,integer) from public,anon,authenticated,service_role;
