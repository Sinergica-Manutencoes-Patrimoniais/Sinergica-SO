-- 0177_E03-S01_view_contas_e_depreciacao.sql — Sinérgica SO
-- Story E03-S01, AC-3 e AC-8.
--
-- 1) `relacionamento.contas` — a interface pública de leitura do Shared Kernel `pcm.clientes`
--    (ADR-0019, R2). `pcm.clientes` recebe 35 FKs de 4 contextos; declarar a view dá aos
--    consumidores um contrato estável e deixa o PCM livre para mexer na tabela por trás.
--    A view mora em `relacionamento` (schema transversal, junto de `contatos`) porque a Conta é
--    transversal — mover a TABELA para lá seria o desenho ideal, mas 35 FKs em produção é risco
--    desproporcional (alternativa avaliada e rejeitada no ADR-0019).
--
--    `security_invoker = true` é o ponto crítico: sem ele a view roda com os direitos do dono e
--    vaza Conta para quem não tem RLS de `pcm.clientes`. E `grant select` é explícito porque
--    view NÃO herda grant da tabela — foi exatamente esse o bug real da E04-S04, corrigido em 0110.
--
--    A view NÃO expõe `tipo` nem `status_comercial`: são as colunas deprecadas abaixo. Consumidor
--    novo não deve nem saber que existem.
--
-- 2) Depreciação de `pcm.clientes.tipo` e `status_comercial` (ADR-0020). NÃO são removidas aqui:
--    a UI do PCM ainda lê as duas (ListaClientesPage, CabecalhoCliente, Visão 360) e nada deve
--    quebrar nesta story. O drop é migration futura, depois de um ciclo com a UI nova em produção.
--    Verificado em produção (2026-08-10): `tipo='lead'` = 0 linhas e `status_comercial='prospecto'`
--    = 0 linhas — não há dado a migrar, só conceito a mudar de lugar.
--
-- Rollback:
--   drop view if exists relacionamento.contas;
--   comment on column pcm.clientes.tipo is null;
--   comment on column pcm.clientes.status_comercial is null;

create or replace view relacionamento.contas
with (security_invoker = true) as
select
  c.id,
  c.nome,
  c.cnpj,
  c.auvo_id,
  c.ativo,
  c.endereco,
  c.cidade,
  c.estado,
  c.cep,
  c.contato_nome,
  c.contato_telefone,
  c.contato_email,
  c.observacoes,
  c.marcacao_id,
  c.created_at,
  c.updated_at
from pcm.clientes c
where c.deleted_at is null;

grant select on relacionamento.contas to authenticated, service_role;

comment on view relacionamento.contas is
  'Interface pública de leitura da Conta (pcm.clientes, Shared Kernel). ADR-0019 R2. '
  'security_invoker herda a RLS de pcm.clientes. Não expõe tipo/status_comercial (deprecados).';

comment on column pcm.clientes.tipo is
  'DEPRECADA (ADR-0020, E03-S01). O funil vive em comercial.oportunidades; lead e cliente são a '
  'mesma Conta em momentos diferentes. Mantida só para não quebrar a UI do PCM; drop em story '
  'futura. Não escrever.';

comment on column pcm.clientes.status_comercial is
  'DEPRECADA (ADR-0020, E03-S01). Substituída pela etapa do funil em comercial.oportunidades; '
  'para saber se a Conta está ativa use a coluna ativo. Mantida só para não quebrar a UI do PCM; '
  'drop em story futura. Não escrever.';
