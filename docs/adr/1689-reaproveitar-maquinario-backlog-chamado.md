---
name: "docs-adr-1689-reaproveitar-maquinario-backlog-chamado-md"
description: "Documento Sinérgica SO: ADR-1689 — E01-S193 reaproveita o maquinário Backlog→Chamado já existente"
alwaysApply: false
---

# ADR-1689 — E01-S193 reaproveita o maquinário Backlog→Chamado já existente, em vez de construir RPC nova

**Status:** proposta — aguarda revisão humana (gate da task 2 de `specs/E01-S193-backlog-antecede-chamado/tasks.md`).
**Não substitui nem edita** `ADR-0665`, `ADR-0670` nem `ADR-0151`; é complementar a elas.

## Contexto

O `plan.md` de E01-S193 foi escrito presumindo que nada existia além de `sso_backlog_parcelas`
(E01-S167) e que seriam necessárias três RPCs novas (`sso_enviar_pendencias_backlog`,
`sso_priorizar_item_backlog`, `sso_liberar_escopo_backlog`). O inventário da task 1 (17/11/2026)
mostrou que isso é **falso**: a família `sso_backlog_composicoes`/`sso_backlog_pendencias`
(E01-S174, migrations `0375` a `1832`, 39 arquivos) já implementa o modelo "Backlog é escopo
validado, Chamado só nasce na liberação do PCM" quase por completo:

| Capacidade pedida pelo Pacote Consolidado | Já existe como | Gate (hoje fechado) |
|---|---|---|
| Pendência → item de Backlog, zero OS/Chamado (AC-1, AC-2) | `pcm.sso_compor_backlog_pendencias` (`0375`) | `sso_backlog_composicao_gate` |
| Priorização GUTD no item, não na OS (AC-3) | `pcm.sso_priorizar_composicao` (`0377`) | `sso_backlog_composicao_gate` |
| Liberação integral → Chamado sem OS (AC-4) | `pcm.sso_promover_backlog_chamado` (`0890`) | `sso_promocao_backlog_gate`, `chamado_os_gate`, `sso_backlog_chamado_gate`, `sso_backlog_parcela_gate` |
| Liberação parcial, resto fica no Backlog (AC-5) | `pcm.sso_dividir_composicao_backlog` (`0895`) separando o subconjunto, **então** `sso_promover_backlog_chamado` no destino | `sso_divisao_backlog_gate` + os 4 acima |
| Devolução ao Backlog com motivo (AC-6) | `pcm.sso_devolver_parcela_chamado_backlog` (`1830`) | já referenciado no `spec.md` como reuso obrigatório |

Front: `apps/web/src/features/pcm/interfaces/pendencias-tecnicas/Composicoes.tsx` e
`PromoverComposicao.tsx` já chamam as RPCs certas, com idempotência de sessão e confirmação dupla.
Nenhum dos dois é importado por página ou rota alguma — órfãos, mesmo padrão medido em
`docs/Apontamentos/alcance-no-front-2026-11-17.md` (E00-S28).

Todos os gates nasceram `default false` **por desenho**: `ADR-0665` e `ADR-0670` dizem
explicitamente que concorrência, ordem de locks e efeito de triggers exigem revisão adversarial
antes de habilitar, e essa revisão nunca ocorreu. `1839_E01-S187_grants_rpcs_ui_com_gate.sql`
documenta um achado irmão (12/11/2026): ativar uma feature exige **três** peças — flag no front,
gate no banco, `grant execute` — e a terceira também faltava em 333 RPCs vivas; 581 gates, 0
abertos, confirmados ali.

## Decisão

1. **Nenhuma migration cria RPC nova** para AC-1 a AC-6. `sso_backlog_parcelas` (E01-S167)
   permanece como está, para o fluxo que já parte de um Chamado existente (`1218`/`1219`); não se
   funde com `sso_backlog_composicoes`.
2. **A tarefa de E01-S193 é habilitar, não construir:** revisão adversarial dos 5 comandos listados
   acima (locks, concorrência, autorização, efeito de trigger em `audit.events` e no notificador do
   Portal — ponto que a própria `ADR-0665` deixou como risco auditável), depois abrir os 6 gates por
   migration aditiva, conferir `grant execute` contra `1839`, e só então declarar a flag
   `VITE_SSO_BACKLOG_PRE_CHAMADO_ENABLED`.
3. **Front:** criar o caminho de navegação para `Composicoes.tsx` (ou uma tela equivalente, a
   decidir na implementação) a partir de "Central de Pendências" / área de Backlog — não recriar os
   componentes.
4. **Estado do Chamado na liberação:** `0890` cria com `status='aberto'`, não `'demanda'`. Esta ADR
   **não decide agora** se `'demanda'` precisa existir como estado distinto — isso depende de o que
   `E01-S194` (Kanban) precisa diferenciar. Duas opções ficam em aberto para quem revisar:
   - **Opção A (menor mudança):** manter `'aberto'`; `E01-S194` usa `chamados_eventos.tipo='criado'`
     com `metadata->>'origemBacklog'` (já gravado por `0890` linha 61) para colorir/filtrar no
     Kanban sem precisar de novo valor de `status`.
   - **Opção B (fiel ao `spec.md` literal):** `ALTER ... ADD CONSTRAINT` aditivo introduzindo
     `'demanda'`, e um novo passo dentro do mesmo comando de liberação que transiciona
     `'aberto'→'demanda'` antes de devolver o resultado — exige revisão de todo lugar que hoje
     assume `status in ('aberto','convertido_os','backlog','cancelado')` (grep antes de decidir).
   **Pedir a Fabrício/PCM** qual das duas antes de escrever a migration — é decisão de produto
   (o que aparece como coluna no Kanban), não só técnica.
5. **AC-7/AC-8 (Backlog legado por status de OS) são trabalho genuinamente novo** — nada no
   inventário cobre a classificação de `pcm.ordens_servico.status='backlog'`. Tasks 3, 12, 13 do
   `tasks.md` permanecem como escritas.

## Consequências

- Escopo de migration nova cai de ~6 RPCs para: 6 `update ... habilitado=true` (um por gate, cada
  um só depois de revisão própria), grants faltantes, e a decisão do item 4 se Opção B for
  escolhida. AC-7/AC-8 seguem como estavam.
- Risco herdado: qualquer bug nos comandos de 2026 (0375–0895) que a revisão adversarial encontrar
  é bug de produção potencial assim que o gate abrir — não é "código novo com bug novo", é "código
  antigo nunca exercitado em produção". Tratar com o mesmo rigor de `/revisao-adversarial` que um
  comando novo.
- `tasks.md` da story precisa de nova rodada (tasks 4–9 trocam de "criar migration" para "revisar e
  habilitar"); task 1 fica **done** com este documento.

## Referências

- `ADR-0665` — promoção integral (`0890`).
- `ADR-0670` — divisão de composição (`0895`).
- `ADR-0151` — priorização sem concessão (`0377`).
- `1839_E01-S187_grants_rpcs_ui_com_gate.sql` — achado irmão do terceiro pilar de ativação.
- `docs/Apontamentos/alcance-no-front-2026-11-17.md` — medição do E00-S28.
