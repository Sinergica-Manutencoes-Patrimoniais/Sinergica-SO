-- Executar exclusivamente no banco sso_s169_descartavel montado com fixture_only.
\set ON_ERROR_STOP on
begin;
do $$declare msg text; h text; begin
 msg:=concat_ws(E'\n','sso-xlsx-v1','16891000-0000-4000-8000-000000000001','16891000-0000-4000-8000-000000000002','16900000-0000-4000-8000-000000000301','16900000-0000-4000-8000-000000000302',encode(convert_to('São Paulo','UTF8'),'hex'),encode(sha256(convert_to('abc','UTF8')),'hex'),encode(sha256(convert_to('[[1]]','UTF8')),'hex'),'1800000000');
 h:=encode(extensions.hmac(convert_to(msg,'UTF8'),decode(repeat('07',32),'hex'),'sha256'),'hex');
 if h<>'e43302101514f2a04919d73b6c163ba1970ae8f951cef6357bc61f6142b558fe' then raise exception 'vetor HMAC divergente'; end if;
end$$;
set local test.uid='16891000-0000-4000-8000-000000000001';
set local role authenticated;
do $$begin
 begin perform pcm.sso_receber_xlsx_atestado('16900000-0000-4000-8000-000000000301','16900000-0000-4000-8000-000000000302','16891000-0000-4000-8000-000000000002','fonte','[[1],[2],[3],[4],[5]]','YWJj',1800000000,repeat('0',64)); raise exception 'gate aberto por padrão'; exception when sqlstate '55000' then if sqlerrm <> 'atestado_xlsx_bloqueado' then raise; end if; end;
end$$;
reset role;
update pcm.sso_atestado_xlsx_gate set habilitado=true where id;
set local role authenticated;
do $$declare
 p uuid:='16900000-0000-4000-8000-000000000301'; l uuid:='16900000-0000-4000-8000-000000000302'; c uuid:='16891000-0000-4000-8000-000000000002';
 exp bigint:=floor(extract(epoch from clock_timestamp()))::bigint+120; matriz text:='[[1],[2],[3],[4],[5]]'; msg text; assinatura text; v jsonb;
begin
 msg:=concat_ws(E'\n','sso-xlsx-v1',auth.uid()::text,c::text,p::text,l::text,encode(convert_to('fonte','UTF8'),'hex'),encode(sha256(convert_to('abc','UTF8')),'hex'),encode(sha256(convert_to(matriz,'UTF8')),'hex'),exp::text);
 assinatura:=encode(extensions.hmac(convert_to(msg,'UTF8'),decode(repeat('07',32),'hex'),'sha256'),'hex');
 v:=pcm.sso_receber_xlsx_atestado(p,l,c,'fonte',matriz,'YWJj',exp,assinatura);
 if v->>'aggregateId'<>l::text then raise exception 'recibo inválido'; end if;
 v:=pcm.sso_receber_xlsx_atestado(p,l,c,'fonte',matriz,'YWJj',exp,assinatura);
 if v->>'aggregateId'<>l::text then raise exception 'replay inválido'; end if;
 begin perform pcm.sso_receber_xlsx_atestado(p,l,c,'fonte','[[2],[2],[3],[4],[5]]','YWJj',exp,assinatura); raise exception 'matriz adulterada aceita'; exception when insufficient_privilege then null; end;
 begin perform pcm.sso_receber_xlsx_atestado(p,l,c,'fonte',matriz,'ZGVm',exp,assinatura); raise exception 'arquivo adulterado aceito'; exception when insufficient_privilege then null; end;
 begin perform pcm.sso_receber_xlsx_atestado(p,l,c,'fonte',matriz,'YWJj',exp-300,assinatura); raise exception 'atestado expirado aceito'; exception when insufficient_privilege then null; end;
 begin perform pcm.sso_receber_xlsx_atestado(p,l,'16891000-0000-4000-8000-000000000003','fonte',matriz,'YWJj',exp,assinatura); raise exception 'Cliente divergente aceito'; exception when insufficient_privilege then null; end;
end$$;
reset role;
do $$begin if (select count(*) from pcm.sso_origens_xlsx_cronograma where lote_id='16900000-0000-4000-8000-000000000302')<>1 then raise exception 'origem ausente ou duplicada'; end if; end$$;
update config.permissao_teste set habilitada=false;
set local role authenticated;
do $$begin begin perform pcm.sso_receber_xlsx_atestado('16900000-0000-4000-8000-000000000301','16900000-0000-4000-8000-000000000302','16891000-0000-4000-8000-000000000002','fonte','[[1],[2],[3],[4],[5]]','YWJj',floor(extract(epoch from clock_timestamp()))::bigint+120,repeat('0',64)); raise exception 'permissão revogada aceita'; exception when insufficient_privilege then null; end; end$$;
reset role;
do $$begin if has_function_privilege('anon','pcm.sso_receber_xlsx_atestado(uuid,uuid,uuid,text,text,text,bigint,text)','execute') or has_function_privilege('service_role','pcm.sso_receber_xlsx_atestado(uuid,uuid,uuid,text,text,text,bigint,text)','execute') then raise exception 'papel indevido pode executar'; end if; end$$;
rollback;
