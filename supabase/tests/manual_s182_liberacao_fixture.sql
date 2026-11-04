-- Somente banco descartável após as fixtures de reserva e autorização da S182.
\set ON_ERROR_STOP on
do $$ begin if current_database() <> 'sso_s182_descartavel' then raise exception 'banco não descartável'; end if; end $$;
alter table financeiro.sso_documentos_internos_liberacoes add column motivo text, add column payload jsonb, add column ator_id uuid;
create table financeiro.sso_reserva_documento_liberacao_gate(id boolean primary key, habilitado boolean);
insert into financeiro.sso_reserva_documento_liberacao_gate values(true,true);
\ir ../migrations/0737_E01-S182_competencia_reserva.sql
-- Barreira somente na fixture para observar mudança de autorização após a checagem.
create trigger sso_teste_barreira_liberacao before insert on financeiro.sso_documentos_internos_liberacoes for each row execute function financeiro.sso_teste_barreira_revogacao();
