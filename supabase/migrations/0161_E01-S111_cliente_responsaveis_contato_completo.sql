-- 0161_E01-S111_cliente_responsaveis_contato_completo.sql — Sinérgica SO
-- Story E01-S111. Estende E01-S103 (pcm.cliente_responsaveis): separa `contato` (texto livre
-- misturando telefone/email) em `email` + `telefone` distintos, e adiciona `preferencia_contato`
-- (lista fechada) — insumo futuro pro Zé saber como contatar (E02-S24/S26).
--
-- Reverso:
--   alter table pcm.cliente_responsaveis add column contato text;
--   update pcm.cliente_responsaveis set contato = coalesce(telefone, email);
--   alter table pcm.cliente_responsaveis drop constraint if exists cliente_responsaveis_preferencia_contato_check;
--   alter table pcm.cliente_responsaveis drop column preferencia_contato;
--   alter table pcm.cliente_responsaveis drop column telefone;
--   alter table pcm.cliente_responsaveis drop column email;

alter table pcm.cliente_responsaveis add column email text;
alter table pcm.cliente_responsaveis add column telefone text;
alter table pcm.cliente_responsaveis add column preferencia_contato text;

-- AC-3: dado existente de `contato` (texto livre) preservado em `telefone` — sem parsing
-- automático arriscado; operador ajusta manualmente depois se o valor era um e-mail.
update pcm.cliente_responsaveis set telefone = contato where contato is not null;

-- Intencional: dado já migrado para `telefone` na linha acima; nenhum client em produção lê
-- `contato` fora deste adapter, atualizado no mesmo PR/deploy.
-- squawk-ignore ban-drop-column
alter table pcm.cliente_responsaveis drop column contato;

-- NOT VALID aqui, VALIDATE em migration separada (0162) — padrão da casa, evita travar escrita
-- concorrente durante a validação em tabela já com dado em produção.
alter table pcm.cliente_responsaveis
  add constraint cliente_responsaveis_preferencia_contato_check
  check (preferencia_contato is null or preferencia_contato in ('whatsapp', 'ligacao', 'email', 'outro'))
  not valid;
