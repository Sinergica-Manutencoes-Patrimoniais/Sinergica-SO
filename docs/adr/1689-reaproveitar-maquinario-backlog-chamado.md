---
name: "docs-adr-1689-reaproveitar-maquinario-backlog-chamado-md"
description: "Documento Sinérgica SO: ADR-1689 — E01-S193 reaproveita o maquinário Backlog→Chamado já existente"
alwaysApply: false
---

# ADR-1689 — E01-S193 reaproveita o maquinário Backlog→Chamado já existente, em vez de construir RPC nova

**Status:** **decidida (17/11/2026)** — revisão humana escolheu Opção B (seção "Decisão", item 4). Gate da task 2 de `specs/E01-S193-backlog-antecede-chamado/tasks.md` fechado.
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

Front: `apps/web/src/features/pcm/interfaces/pendencias-tecnicas/Composicoes.tsx`,
`PromoverComposicao.tsx`, `DividirComposicao.tsx` e `Workspace.tsx` (`ComporBacklog`) já chamam as
RPCs certas, com idempotência de sessão e confirmação dupla.

**Correção de um achado anterior (17/11/2026):** a primeira versão desta ADR afirmou que esses
componentes eram órfãos — "não importados por página ou rota alguma". **Isso estava errado** —
um grep raso (só por `<Composicoes`/`<PromoverComposicao`) não viu que a cadeia real é
`VisaoClientePage.tsx:539` → `PendenciasTecnicasWorkspace` (export de `Workspace.tsx`) → `Lista` →
`ComporBacklog`/`Composicoes` → `PromoverComposicao`/`DividirComposicao`. **A página existe e monta
o componente de verdade** (Cliente 360, página real, sem flag na própria chamada de montagem). O
gap real não é alcance de rota — é exatamente a mesma classe do `E00-S28`: a flag interna do
componente (`VITE_SSO_PENDENCIAS_TECNICAS_ENABLED`, `VITE_SSO_BACKLOG_COMPOSICAO_ENABLED`,
`VITE_SSO_PROMOVER_BACKLOG_CHAMADO_ENABLED`, `VITE_SSO_DIVIDIR_BACKLOG_ENABLED`, e outras ~70
flags só nesta pasta) nunca foi declarada em `.env.example`/`netlify.toml`, então resolve pra
`undefined !== "true"` → `false` sempre, e os 6 gates de banco seguem fechados (seção "Decisão").
Front e rota estão prontos; falta só a terceira e quarta peça de ativação (flag declarada + gate
aberto), não uma quinta (tela/rota nova).

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
3. **Front — correção, 17/11/2026:** nenhum caminho de navegação novo é necessário. A rota real já
   existe (`VisaoClientePage.tsx` → `PendenciasTecnicasWorkspace` → `Composicoes`/`ComporBacklog`
   → `PromoverComposicao`/`DividirComposicao`) — achado anterior de "órfão" estava errado (ver
   correção na seção anterior). O trabalho de front desta story é: (a) trocar a chamada de
   `PromoverComposicao.tsx` de `sso_promover_backlog_chamado` pro wrapper novo
   `sso_liberar_escopo_backlog` (item 4 abaixo — feito); (b) declarar as flags envolvidas quando
   `E00-S28` mesclar (não recriar componente nenhum).
4. **Estado do Chamado na liberação — decidido em 17/11/2026 (revisão humana): Opção B,
   introduzir `'demanda'`.** Mecanismo, após auditar os 44 pontos que hoje leem
   `pcm.chamados.status` (`grep` em `supabase/migrations`, 17/11/2026):

   - **Todos os 44 são whitelist positiva** (`status not in ('aberto','convertido_os')`,
     `status <> 'cancelado'` etc.) nunca blacklist. `'demanda'` entrar no conjunto permitido não
     muda nenhum dos 44 — um Chamado em `'demanda'` **automaticamente** não passa em nenhum deles:
     não pode virar OS (`1020`, `0448`, `1047`), não pode ser vinculado de novo
     (`0438`), não pode ser suspenso ou unido. **É um dead-end por construção**, sem tocar uma
     linha dos RPCs existentes — exatamente a leitura literal do `spec.md`: *"só então o Chamado
     admite OS"* vira verdade por omissão, não por guarda nova.
   - **Front:** `StatusChamado` (`apps/web/src/features/pcm/domain/chamados.ts:6`) ganha
     `"demanda"` no union type e label próprio; `podeGerarOsOuBacklog` (linha 145, `status !== "aberto"`)
     já rejeita `'demanda'` sem mudança — é a mesma função, mesmo texto de erro.
   - **Migration nova (não edita `1854`/`1855`/`0890`):** (a) `ALTER TABLE pcm.chamados`
     `DROP CONSTRAINT` + `ADD CONSTRAINT` aditivo incluindo `'demanda'` no `CHECK`; (b) uma RPC
     nova e fina — `pcm.sso_liberar_escopo_backlog` — que **chama** `pcm.sso_promover_backlog_chamado`
     (0890, sem reescrever locks/idempotência/parcelas) e, só depois do retorno, faz
     `update pcm.chamados set status='demanda' where id=p_chamado_id and status='aberto'`,
     registrando em `audit.events`. Não duplica a lógica de composição/parcela/pendência.
   - **AC-5 (parcial):** `pcm.sso_dividir_composicao_backlog` (0895) separa o subconjunto numa
     composição destino; a mesma RPC nova de liberação roda sobre o destino. O restante continua
     na composição origem, intocado.
   - **Transição `'demanda'→'aberto'`** (liberar pra OS) é RPC própria, **fora do escopo desta
     story** — cabe a `E01-S194` (Kanban), que é quem decide a ação do PCM que dispara essa
     transição. Até lá, Chamado em `'demanda'` existe, aparece, mas não produz OS — estado válido,
     não é bug.
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
