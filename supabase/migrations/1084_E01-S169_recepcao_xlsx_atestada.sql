-- ADR-0908. Preparação aditiva: gate fechado e segredo não provisionado por migration.
create table pcm.sso_atestado_xlsx_gate(id boolean primary key default true check(id), habilitado boolean not null default false);
insert into pcm.sso_atestado_xlsx_gate(id,habilitado) values(true,false);
alter table pcm.sso_atestado_xlsx_gate enable row level security;
alter table pcm.sso_atestado_xlsx_gate force row level security;
revoke all on pcm.sso_atestado_xlsx_gate from public,anon,authenticated,service_role;

create function pcm.sso_receber_xlsx_atestado(p_request uuid,p_lote uuid,p_cliente uuid,p_fonte text,p_matriz_texto text,p_base64 text,p_expira bigint,p_assinatura text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ativo boolean; v_actor uuid:=auth.uid(); v_bytes bytea; v_segredo text; v_qtd integer; v_msg text; v_assinatura bytea; v_recebida bytea; v_diferenca integer:=0; v_matriz jsonb; v_agora bigint;
begin
 select habilitado into v_ativo from pcm.sso_atestado_xlsx_gate where id for share;
 if v_ativo is distinct from true then raise exception 'atestado_xlsx_bloqueado' using errcode='55000'; end if;
 perform pcm.sso_exigir_mediacao_cronograma(p_cliente);
 v_agora:=floor(extract(epoch from clock_timestamp()))::bigint;
 if v_actor is null or p_request is null or p_lote is null or p_cliente is null or p_fonte is null or p_fonte<>btrim(p_fonte) or length(p_fonte) not between 1 and 188
   or p_expira is null or p_expira<v_agora or p_expira>v_agora+300
   or p_assinatura is null or p_assinatura !~ '^[a-f0-9]{64}$'
   or p_matriz_texto is null or octet_length(p_matriz_texto) not between 1 and 1048576
   or p_base64 is null or octet_length(p_base64) not between 1 and 6990508 then
   raise exception 'atestado_xlsx_invalido' using errcode='42501';
 end if;
 begin v_bytes:=decode(p_base64,'base64'); v_matriz:=p_matriz_texto::jsonb;
 exception when others then raise exception 'atestado_xlsx_invalido' using errcode='42501'; end;
 if octet_length(v_bytes) not between 1 and 5242880 or jsonb_typeof(v_matriz)<>'array' then raise exception 'atestado_xlsx_invalido' using errcode='42501'; end if;
 select count(*), min(decrypted_secret) into v_qtd,v_segredo from vault.decrypted_secrets where name='sso_xlsx_atestado_v1';
 if v_qtd<>1 or v_segredo is null or v_segredo !~ '^[a-f0-9]{64}$' then raise exception 'atestado_xlsx_indisponivel' using errcode='55000'; end if;
 v_msg:=concat_ws(E'\n','sso-xlsx-v1',v_actor::text,p_cliente::text,p_request::text,p_lote::text,encode(convert_to(p_fonte,'UTF8'),'hex'),encode(sha256(v_bytes),'hex'),encode(sha256(convert_to(p_matriz_texto,'UTF8')),'hex'),p_expira::text);
 v_assinatura:=extensions.hmac(convert_to(v_msg,'UTF8'),decode(v_segredo,'hex'),'sha256');
 v_recebida:=decode(p_assinatura,'hex');
 for i in 0..31 loop v_diferenca:=v_diferenca | (get_byte(v_assinatura,i) # get_byte(v_recebida,i)); end loop;
 if v_diferenca<>0 then raise exception 'atestado_xlsx_invalido' using errcode='42501'; end if;
 return pcm.sso_receber_xlsx_cronograma(p_request,p_lote,p_cliente,p_fonte,v_matriz,p_base64,encode(sha256(v_bytes),'hex'));
end; $$;
revoke all on function pcm.sso_receber_xlsx_atestado(uuid,uuid,uuid,text,text,text,bigint,text) from public,anon,authenticated,service_role;
grant execute on function pcm.sso_receber_xlsx_atestado(uuid,uuid,uuid,text,text,text,bigint,text) to authenticated;
