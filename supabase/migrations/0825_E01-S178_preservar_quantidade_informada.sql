-- Rejeita incorporação de Grupo que descarte ou troque quantidade explícita do levantamento.
create function pcm.sso_preservar_quantidade_informada_grupo() returns trigger language plpgsql security definer set search_path='' as $$
declare v_quantidade text;v_oficial bigint;v_cliente uuid;
begin
 if new.tipo<>'grupo_quantitativo' then return new;end if;
 select nullif(btrim(l.atributos->>'quantidade'),''),t.cliente_id into v_quantidade,v_cliente from pcm.sso_levantamento_linhas l join pcm.sso_levantamentos t on t.id=l.lote_id where l.lote_id=new.lote_id and l.chave=new.linha_chave;
 if v_quantidade is null then return new;end if;
 if v_quantidade !~ '^[0-9]{1,16}$' then raise exception 'quantidade_informada_invalida' using errcode='23514';end if;
 select g.quantidade into v_oficial from pcm.grupos_quantitativos g where g.id=new.entidade_id and g.cliente_id=v_cliente;
 if not found or v_quantidade::numeric is distinct from v_oficial::numeric then raise exception 'quantidade_informada_divergente' using errcode='23514';end if;
 return new;
end;$$;
revoke all on function pcm.sso_preservar_quantidade_informada_grupo() from public,anon,authenticated,service_role;
create trigger sso_preservar_quantidade_informada_grupo before insert on pcm.sso_levantamento_incorporacoes for each row execute function pcm.sso_preservar_quantidade_informada_grupo();
