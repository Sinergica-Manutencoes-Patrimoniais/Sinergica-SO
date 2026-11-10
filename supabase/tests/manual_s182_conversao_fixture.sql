-- Apenas banco descartável com fixtures S182, migrations 1086 e 1087.
\set ON_ERROR_STOP on
do $$ begin if current_database() <> 'sso_s182_descartavel' then raise exception 'banco não descartável'; end if; end $$;
alter table financeiro.lancamentos add column tipo text, add column cliente_id uuid, add column data_competencia date, add column valor_centavos bigint;
alter table financeiro.sso_faturavel_documentos alter column id set default gen_random_uuid(), add column cliente_id uuid, add column referencia text, add column lancamento_id uuid, add column data_documento date, add column criado_por uuid;
alter table financeiro.sso_faturavel_alocacoes add column item_id uuid, add column documento_id uuid, add column valor_centavos bigint, add column revisao_item integer, add column request_id uuid, add column ator_id uuid;
alter table financeiro.sso_faturavel_comandos add column ator_id uuid, add column payload jsonb, add column resultado jsonb;
create table financeiro.sso_faturamento_gate(id boolean primary key, habilitado boolean);
insert into financeiro.sso_faturamento_gate(id,habilitado) values(true,true);
