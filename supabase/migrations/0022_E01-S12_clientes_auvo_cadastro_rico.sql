-- 0022_E01-S12_clientes_auvo_cadastro_rico.sql — Sinérgica SO
-- Story E01-S12/E01-S13. Recupera no OS os campos ricos de cadastro de cliente que o PCM antigo
-- já exibia a partir do Auvo. A fonte de verdade continua sendo o Auvo; estes campos são cache
-- local para leitura rápida da Lista de Clientes e Visão 360.
--
-- Rollback:
--   alter table pcm.clientes drop column if exists observacoes;
--   alter table pcm.clientes drop column if exists contato_email;
--   alter table pcm.clientes drop column if exists contato_telefone;
--   alter table pcm.clientes drop column if exists contato_nome;
--   alter table pcm.clientes drop column if exists cep;
--   alter table pcm.clientes drop column if exists estado;
--   alter table pcm.clientes drop column if exists cidade;
--   alter table pcm.clientes drop column if exists endereco;
--   alter table pcm.clientes drop column if exists status_comercial;
--   alter table pcm.clientes drop column if exists tipo;

alter table pcm.clientes
  add column if not exists tipo text not null default 'cliente'
    check (tipo in ('cliente', 'lead')),
  add column if not exists status_comercial text not null default 'ativo'
    check (status_comercial in ('ativo', 'inativo', 'prospecto')),
  add column if not exists endereco text,
  add column if not exists cidade text,
  add column if not exists estado text,
  add column if not exists cep text,
  add column if not exists contato_nome text,
  add column if not exists contato_telefone text,
  add column if not exists contato_email text,
  add column if not exists observacoes text;
