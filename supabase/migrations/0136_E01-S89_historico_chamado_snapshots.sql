-- 0136_E01-S89_historico_chamado_snapshots.sql — Sinérgica SO
-- Story E01-S89. Anexa um snapshot imutável de X dias de conversa (WhatsApp/Atendimento) a um
-- Chamado (pcm.chamados, E01-S88). Cross-domínio Atendimento→PCM — mesmo padrão já usado por
-- `financeiro.*` referenciando `pcm.clientes`/`pcm.ordens_servico` (0106/0108/0111/0115): tabela
-- nova vive no schema de quem PRODUZ o dado (atendimento), com FK direta pro schema pcm — nenhum
-- import de código entre as features, só a FK no banco (CLAUDE.md §arquitetura).
--
-- AC-3: append-only — sem grant de update/delete pra authenticated, mesmo padrão de
-- `financeiro.lancamentos_eventos` (0117) e `pcm.chamados_eventos` (0134). Anexar de novo cria
-- outra linha, nunca sobrescreve a anterior.

create table atendimento.historico_chamado_snapshots (
  id               uuid        primary key default gen_random_uuid(),
  conversa_id      uuid        not null references atendimento.conversas (id),
  chamado_id       uuid        not null references pcm.chamados (id),
  janela_dias      int         not null check (janela_dias > 0),
  data_inicio      timestamptz not null,
  data_fim         timestamptz not null,
  mensagens        jsonb       not null,
  total_mensagens  int         not null check (total_mensagens > 0),
  created_at       timestamptz not null default now(),
  created_by       uuid        references auth.users
);

create index idx_historico_chamado_snapshots_chamado on atendimento.historico_chamado_snapshots (chamado_id);
create index idx_historico_chamado_snapshots_conversa on atendimento.historico_chamado_snapshots (conversa_id);

alter table atendimento.historico_chamado_snapshots enable row level security;
alter table atendimento.historico_chamado_snapshots force row level security;

grant select on atendimento.historico_chamado_snapshots to authenticated;
grant insert on atendimento.historico_chamado_snapshots to authenticated;
grant select, insert, update, delete on atendimento.historico_chamado_snapshots to service_role;

-- Leitura: quem vê o Chamado (módulo pcm) OU quem vê a conversa de origem (módulo atendimento) —
-- o snapshot aparece tanto no detalhe do Chamado (PCM) quanto, futuramente, no perfil da conversa.
create policy "historico_chamado_snapshots_select" on atendimento.historico_chamado_snapshots
  for select to authenticated
  using (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' in ('leitura', 'escrita')
    or auth.jwt() -> 'user_modulos' ->> 'pcm' in ('leitura', 'escrita')
  );

-- Escrita: só quem tem atendimento:escrita — é quem executa a ação "enviar histórico" no inbox.
create policy "historico_chamado_snapshots_insert" on atendimento.historico_chamado_snapshots
  for insert to authenticated
  with check (
    auth.jwt() ->> 'user_role' = 'superadmin'
    or auth.jwt() -> 'user_modulos' ->> 'atendimento' = 'escrita'
  );
