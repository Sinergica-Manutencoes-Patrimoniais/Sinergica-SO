create table pcm.sso_recuperar_atualizacao_lote_gate(id boolean primary key default true check(id),habilitado boolean not null default false);
insert into pcm.sso_recuperar_atualizacao_lote_gate(id,habilitado) values(true,false);
alter table pcm.sso_recuperar_atualizacao_lote_gate enable row level security;alter table pcm.sso_recuperar_atualizacao_lote_gate force row level security;
revoke all on pcm.sso_recuperar_atualizacao_lote_gate from public,anon,authenticated,service_role;
create function pcm.sso_recuperar_atualizacao_lote(p_lote_id uuid,p_request_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_cliente uuid;v_cmd pcm.sso_levantamento_comandos%rowtype;
begin
 if not coalesce((select habilitado from pcm.sso_recuperar_atualizacao_lote_gate where id),false) then raise exception 'recuperacao_desabilitada' using errcode='55000';end if;
 if auth.uid() is null or p_lote_id is null or p_request_id is null then raise exception 'parametros_invalidos' using errcode='22023';end if;
 select cliente_id into v_cliente from pcm.sso_levantamentos where id=p_lote_id;
 if not found or config.sso_autorizar_acao('cadastro.aprovar',v_cliente) is not true then raise exception 'sem_acesso' using errcode='42501';end if;
 select * into v_cmd from pcm.sso_levantamento_comandos where request_id=p_request_id and ator_id=auth.uid() and payload->>'operacao'='atualizar_selecao' and payload->>'loteId'=p_lote_id::text;
 if not found then return jsonb_build_object('loteId',p_lote_id,'requestId',p_request_id,'situacao','nao_localizado');end if;
 return jsonb_build_object('loteId',p_lote_id,'requestId',p_request_id,'situacao','registrado','revision',(v_cmd.resultado->>'revision')::integer,'quantidade',jsonb_array_length(v_cmd.resultado->'resultados'));
end;$$;
revoke all on function pcm.sso_recuperar_atualizacao_lote(uuid,uuid) from public,anon,authenticated,service_role;
