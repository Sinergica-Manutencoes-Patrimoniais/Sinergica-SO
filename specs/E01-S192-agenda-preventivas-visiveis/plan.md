# Plano técnico — E01-S192

## US0 — Diagnóstico (AC-1, AC-2)

### Agenda do Técnico — causa do vazio

Duas causas, não uma:

1. **Dado inexistente** — `pcm.agenda_tecnico` (schema desde `0155_E01-S104`) nunca recebeu escrita
   de nenhum fluxo automático. Grep exaustivo no repositório: a única escrita é manual, pela
   própria tela (`criarAlocacao`/`editarAlocacao` em `application/agenda-tecnico.ts`, usadas por
   `AgendaTecnicoPage.tsx`). Nenhuma OS em execução, nenhuma Visita agendada, nenhum gatilho Auvo
   grava aqui. "Semana sem alocações, apesar de haver OS em execução" é esperado — a Agenda e a
   OS/Visita são dados desconectados, não o mesmo dado visto de ângulos diferentes.
2. **Campo ausente, não só dado ausente** — `AlocacaoTecnico` (`domain/agenda-tecnico.ts`) não tem
   nenhum campo de OS vinculada (`osId`/`osNumero`). Mesmo que alguém gravasse uma alocação hoje,
   AC-3 ("mostra cada alocação... e OS vinculadas") não teria onde aparecer — é lacuna de
   interface, não só de dado.

Conclusão nomeada: **dado + interface**, não gate nem flag (não há `import.meta.env.VITE_SSO_*`
nem papel/concessão bloqueando `AgendaTecnicoPage` — confirmado lendo `HomePage.tsx`, a rota
`pcmView === "agenda-tecnico"` renderiza incondicionalmente).

AC-4/AC-5 (vazio explicado, erro distinto de vazio/carregando) **já estão implementados**
(`AgendaTecnicoPage.tsx`: estados `carregando`/`erro` distintos, mensagem "Nenhuma alocação nesta
semana." no `vazio=` da `DataTable`) — não é código novo.

AC-6 (horas de terceiro separadas) **já existe**, só em outra tela: módulo
`interfaces/capacidade-agenda/` (`SnapshotCapacidade.tsx`, `EsforcoDeclarado.tsx`,
`consolidar-esforco-visitas.ts`) trata "terceiro" como categoria própria. Não está integrado à
`AgendaTecnicoPage` (board semanal manual) — são dois sistemas de capacidade paralelos, mesmo
padrão do achado de Plano duplicado abaixo.

### Preventivas — causa do "sem jornada visível"

A tela `PreventivasPage` **já implementa a cadeia completa** Plano → Ocorrência → OS: lê
`pcm.planos_preventivos`/`pcm.ocorrencias_preventivas` (`supabase-preventivas-adapter.ts`) e
`PreventivaDetalheDrawer.tsx` mostra vencimento, estado, técnico e `OS {numero}` com navegação
(`onAbrirOs`). AC-7/AC-8 **já satisfeitos, sem código novo**.

O que faltava — e é a causa real do achado da reanálise — é que o **Kanban de Operação**
(`pcm.operacao_itens`, tela separada da Preventivas) nunca expôs o vínculo de volta: um cartão
preventivo no Kanban não tinha como linkar ao Plano que o originou, só a `PreventivasPage` tinha
essa cadeia. É esse o "12 cartões preventivos sem jornada visível" — visível na tela certa
(Preventivas), invisível na tela onde o usuário efetivamente olhou (Kanban). Corrigido nesta story
(ver AC-9 abaixo).

**Achado maior, não pedido pela spec mas decorrente do diagnóstico**: existem dois sistemas de
Plano paralelos e desconectados — `pcm.planos_preventivos` (legado, o que `ordens_servico` e
`PreventivasPage` realmente usam) e `pcm.planos_manutencao` (novo, gerenciado por
`PreventivasWorkspace.tsx`/`plano-manutencao/`, usado pelo motor de ciclo/calendário do E01-S191).
Não são a mesma entidade. Pergunta 17 da reanálise ("quais partes já têm interface") responde: o
legado tem interface completa (Preventivas); o novo tem interface completa (Workspace de Planos de
Manutenção); **nenhum dos dois aponta pro outro**. Migrar um pro outro é mudança de schema com
dado em produção — decisão arquitetural, ADR antes de codar, fora do escopo unilateral desta story
(a própria spec exclui "reescrever... o motor de versionamento de Plano").

## AC-9 — Kanban com link de volta ao Plano

Migration `1858_E01-S192_ocorrencia_preventiva_operacao_itens.sql`:
- `pcm.operacao_itens` (view) ganha `ocorrencia_preventiva_id` nos dois ramos do `UNION ALL`
  (aditivo, mesma posição/tipo nos dois `SELECT`s).
- `pcm.sso_resolver_plano_origem_os(p_cliente_id, p_ocorrencia_preventiva_id)` — RPC lazy
  (só chamada quando o drawer abre uma OS com origem preventiva), resolve
  `ocorrencias_preventivas.plano_id → planos_preventivos.nome`, sufixo `" (legado)"` deixando a
  origem explícita (nunca implícita, por causa do achado dos dois sistemas de Plano). Devolve
  `null` (não erro) quando a ocorrência não existe mais — "card sem Plano" é informação (AC-9),
  não defeito.
- Autorização por módulo (mesmo padrão de `sso_autorizar_acao`/`s184_acesso_interno_atual`):
  `papel = 'superadmin'` OU `resolver_permissoes_modulo` com `modulo = 'pcm'`. Sem ação granular
  nova — reproduzir o achado da E00-S26/E00-S27 (capacidade que ninguém tem concedida) numa
  informação não mais sensível que a própria OS já visível no Kanban seria o mesmo erro de novo.

Frontend: `pcm.operacao_itens` → `ItemOperacaoResumo` (`operacao-gateway.ts`) →
`OrdemServicoOperacional` (`domain/ordens-servico.ts`) ganham `ocorrenciaPreventivaId`, propagado
em `supabase-operacao-adapter.ts`, `supabase-hub-os-adapter.ts` (mesma coluna, fonte
`pcm.ordens_servico` direta) e `operacao-queries.ts` (`resumoParaOrdem`). `OrdensServicoPage.tsx`
(`DetalheOs`) chama `resolverPlanoOrigemOs` via `useQuery` (lazy, `enabled` só com
`clienteId` + `ocorrenciaPreventivaId`) e mostra "Plano de origem" no painel — só quando um
Cliente específico está filtrado (mesma condição já usada por `CentralMateriaisGlobal`/
`QuadroGerencial` nesta tela).

## SPEC_DEVIATION — AC-3 (parcial)

"Mostra... OS vinculadas" não é implementável sem decidir **quem escreve** `pcm.agenda_tecnico` a
partir de OS/Visita (motor de capacidade? gatilho na mudança de status da OS? sync Auvo?) — decisão
de pipeline/arquitetura, não um bug de interface. Documentado aqui e não corrigido nesta story;
AC-4/AC-5/AC-6 (estados distintos, terceiro separado) já satisfeitos como descrito acima. Decisão
de qual pipeline alimenta a Agenda fica para story dedicada, com ADR se envolver mudança de schema.
