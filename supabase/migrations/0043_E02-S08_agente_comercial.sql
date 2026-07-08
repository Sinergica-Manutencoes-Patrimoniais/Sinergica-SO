-- 0043_E02-S08_agente_comercial.sql — Sinérgica SO
-- Agente comercial (E02-S08): qualifica contato novo (não é síndico de condomínio já cliente)
-- recebido numa instância WhatsApp dedicada (`atendimento.instancias_agente`, E02-S06) e cria
-- `comercial.leads` com score/resumo pro time comercial assumir. 3 mudanças:
-- 1) `atendimento.mensagens.remetente_tipo` ganha o valor 'agente' — mensagens do agente comercial
--    não devem aparecer com o rótulo/branding "Agente Zé" no Inbox (MensagemBubble.tsx já
--    distingue 'ze' visualmente; 'agente' é o rótulo genérico pro 2º agente).
-- 2) `comercial.leads` ganha `score` (0-100), `resumo`, `conversa_id` e `origem_ref` — nenhum
--    existia antes desta story porque `comercial.leads` (schema desde E00-S00) nunca teve um
--    fluxo de criação automatizado.
-- 3) `comercial.leads` ganha GRANT para `service_role` — só tinha grant pra `authenticated` desde
--    0002; o agente roda como Edge Function com service_role, igual o Zé cria `pcm.ordens_servico`.
--
-- Reverso:
--   revoke select, insert, update on comercial.leads from service_role;
--   alter table comercial.leads drop column if exists origem_ref;
--   alter table comercial.leads drop constraint if exists leads_conversa_id_fkey;
--   alter table comercial.leads drop column if exists conversa_id;
--   alter table comercial.leads drop column if exists resumo;
--   alter table comercial.leads drop column if exists score;
--   alter table atendimento.mensagens drop constraint mensagens_remetente_tipo_check;
--   alter table atendimento.mensagens add constraint mensagens_remetente_tipo_check
--     check (remetente_tipo in ('cliente', 'ze', 'humano'));

alter table atendimento.mensagens drop constraint mensagens_remetente_tipo_check;
alter table atendimento.mensagens add constraint mensagens_remetente_tipo_check
  check (remetente_tipo in ('cliente', 'ze', 'humano', 'agente')) not valid;

alter table comercial.leads add column if not exists score int check (score between 0 and 100);
alter table comercial.leads add column if not exists resumo text;
alter table comercial.leads add column if not exists conversa_id uuid;
alter table comercial.leads add column if not exists origem_ref text;
alter table comercial.leads add constraint leads_conversa_id_fkey
  foreign key (conversa_id) references atendimento.conversas(id) not valid;

grant select, insert, update on comercial.leads to service_role;
