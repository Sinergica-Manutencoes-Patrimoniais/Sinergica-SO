create or replace function pcm.sso_validar_atributos_ativo_importado() returns trigger language plpgsql security definer set search_path='' as $$
declare v_atributos jsonb; v_cliente uuid; v_observacoes text;
begin
 if new.tipo not in ('sistema','equipamento','componente') then return new; end if;
 if not coalesce((select habilitado from pcm.sso_validar_atributos_ativo_importado_gate where id),false) then raise exception 'validacao_ativo_desabilitada' using errcode='55000'; end if;
 select l.atributos,t.cliente_id into v_atributos,v_cliente from pcm.sso_levantamento_linhas l join pcm.sso_levantamentos t on t.id=l.lote_id where l.lote_id=new.lote_id and l.chave=new.linha_chave and l.tipo=new.tipo;
 if not found or jsonb_typeof(v_atributos) is distinct from 'object' or v_cliente is null then raise exception 'linha_indisponivel' using errcode='23514'; end if;
 if exists(select 1 from jsonb_each(v_atributos) x where x.key not in ('nome','referenciaPai','codigoInformado','observacoes') and x.value<>'null'::jsonb and x.value<>'""'::jsonb) then raise exception 'atributo_ativo_nao_suportado' using errcode='23514'; end if;
 if v_atributos ? 'observacoes' and v_atributos->'observacoes' not in ('null'::jsonb,'""'::jsonb) then
   if new.tipo not in ('equipamento','componente') or jsonb_typeof(v_atributos->'observacoes') is distinct from 'string' then raise exception 'observacoes_nao_preservadas' using errcode='23514'; end if;
   select e.observacoes into v_observacoes from pcm.equipamentos e where e.id=new.entidade_id and e.client_id=v_cliente and e.tipo=new.tipo and e.deleted_at is null for update;
   if not found or v_observacoes is distinct from v_atributos->>'observacoes' then raise exception 'observacoes_nao_preservadas' using errcode='23514'; end if;
 end if;
 return new;
end; $$;
revoke all on function pcm.sso_validar_atributos_ativo_importado() from public,anon,authenticated,service_role;
