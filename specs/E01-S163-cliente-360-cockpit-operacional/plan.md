# Implementation Plan: Cliente 360 como cockpit operacional

**Branch**: `docs/E01-S163-cliente-360-cockpit-operacional` | **Date**: 2026-10-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/E01-S163-cliente-360-cockpit-operacional/spec.md`

## Summary

Transformar o Cliente 360 em cockpit de trabalho por composição, não duplicação: aplicar siglas recomendadas no preview do identificador; extrair o detalhe global de OS/Chamado para drawer compartilhado; oferecer Lista/Timeline/Calendário e detalhe editável/auditável de preventivas; acrescentar filtros puros sobre coleções já escopadas por cliente; excluir apontamentos de visita com a regra de domínio existente; agrupar a navegação e expor ações rápidas autorizadas. Não há migration nesta story.

## Technical Context

**Language/Version**: TypeScript 5.6+ (lockfile 5.9), React 19

**Primary Dependencies**: Vite 7, TanStack Query 5, Supabase JS 2, Tailwind 4, Radix UI via `@sinergica/ui`, Lucide

**Storage**: PostgreSQL/Supabase existente; `localStorage` apenas para preferência não sensível da visão preventiva

**Testing**: Vitest 3 + Testing Library 16, Playwright 1.61, testes Supabase existentes

**Target Platform**: Web desktop responsivo

**Project Type**: Monorepo pnpm/Turborepo, aplicação web em `apps/web`

**Performance Goals**: filtro visual p95 <= 300 ms após carga para até 1.000 itens; troca de aba/drawer sem reload global

**Constraints**: RLS e isolamento OS-grade; sem SQL direto em componente; TanStack Query para estado servidor; histórico preventivo imutável; sem DDL especulativo

**Scale/Scope**: 1 cockpit, 5 fatias, 4 abas filtráveis, 3 visões preventivas e 4 tipos de detalhe contextual

## Constitution Check

*GATE before Phase 0: PASS. Re-check after Phase 1: PASS.*

| Principle | Gate | Plan evidence |
|---|---|---|
| Segurança OS-grade | PASS | `clienteId` em query keys e read-models; drawer rejeita entidade fora do cliente; ações continuam nos use cases/políticas existentes; testes com dois clientes. |
| Migrations seguras | PASS / N/A | Nenhuma migration. Se benchmark exigir índice, interromper a fatia e abrir ADR + migration + testes RLS/query em story separada. |
| DDD pragmático | PASS | Regras de apontamento, filtros e edição preventiva ficam em funções de domínio/aplicação; componentes só orquestram UI. |
| TanStack Query | PASS | Leituras/mutações servidoras reutilizam queries e invalidam chaves compartilhadas; não introduzir fetching manual via `useEffect`. |
| Testabilidade e AC-N | PASS | Tarefas e testes referenciam ACs; TDD por fatia e E2E dos fluxos críticos. |
| Observabilidade sem dados sensíveis | PASS | Eventos técnicos definidos em `research.md`; sem nomes, texto livre, fotos ou documentos. |
| Reuso antes de duplicação | PASS | `ChamadoPainel`, regra `ehOsRegistroVisita`, calendário e use cases existentes são extraídos/compostos. |

Não há violação constitucional a justificar.

## Technical Design

### 1. Identificador assistido

- Manter `siglasInformadas` como estado de formulário em `CampoIdentificador`.
- Adicionar ação `Aplicar recomendações`, que valida os valores visíveis e solicita nova prévia completa.
- Separar “aplicar no preview” de “persistir ao salvar”. `EquipamentoModal` e `SistemaModal` continuam chamando o use case `resolverIdentificadorNaCriacao`/equivalente.
- Em edição, identificador existente permanece estável até o usuário entrar explicitamente no fluxo já protegido por aviso de QR.
- Cobrir colisão, sugestão parcialmente preenchida, cancelamento e falha sem persistência parcial.

### 2. Detalhe compartilhado de OS/Chamado

- Extrair de `OrdensServicoPage.tsx` o conteúdo de detalhe para `components/OrdemServicoDetalhe.tsx`, sem acoplar ao drawer.
- Criar `components/OrdemServicoDetalheDrawer.tsx` como shell acessível. A página global pode manter seu layout atual usando o mesmo conteúdo.
- Quando `chamadoId` existe, compor `ChamadoPainel`; não copiar histórico ou handlers.
- Centralizar query keys/invalidações da operação para que mutações atualizem global e Cliente 360.
- Em `VisaoClientePage`, representar seleção com união discriminada e fechá-la na troca de cliente.
- `PainelBacklog`, `PainelHistorico`, cards de Resumo e Timeline recebem callbacks de seleção, não navegação imperativa.

### 3. Exclusão de apontamentos

- Aplicar `ehOsRegistroVisita` no read-model que abastece `estado.visao.backlog`, `historico`, KPIs e eventos de timeline.
- Se a origem comum já expõe listas filtradas, mover a composição para esse ponto compartilhado; não repetir strings em componentes.
- Manter testes de domínio existentes e acrescentar regressão específica do Cliente 360 com variações normalizadas.

### 4. Preventivas multimodo e auditáveis

- Extrair a coleção selecionada de `PreventivasWorkspace` e renderizá-la em `PreventivasListaView`, `PreventivasTimelineView` ou `PreventivasCalendarioView`.
- Persistir apenas o enum da última visão no navegador, validando valores antigos/desconhecidos.
- Criar `PreventivaDetalheDrawer` capaz de mostrar ocorrência ou plano e delegar ações aos gateways/use cases.
- Ampliar `preventivas-gateway.ts` com comando de atualização de plano; adapter valida `cliente_id` e política de campos editáveis.
- Implementar função pura `podeEditarEstruturaPlano(plano, ocorrencias)` e usá-la tanto para UI quanto para validação de aplicação. A infraestrutura não atualiza ocorrências como efeito colateral.
- “Pausar e criar novo plano” preenche um formulário novo; não reutiliza id nem move histórico.

### 5. Filtros por aba

- Criar `domain/cliente-360-filtros.ts` com tipos, normalização e predicados puros.
- Componentes mantêm estado local por aba e derivam listas com `useMemo`.
- `PainelItensDoCliente`: mapear sistemas e sync já disponíveis.
- `PainelSistemasCliente`: derivar composição pelas memberships existentes.
- `EstruturaClientePage`: produzir árvore podada que inclui matches e ancestrais.
- `PainelFerramentasCliente`: adapter passa categoria da ferramenta; não adicionar filtro de técnico inexistente.
- Um componente visual compartilhado pode padronizar chips/contador/limpeza, mas os filtros de domínio continuam específicos por entidade.

### 6. Navegação e ações rápidas

- Substituir o card alto do cliente por `ClientContextRail`: uma faixa que reúne identidade, endereço, situação, CNPJ, contato, cidade/UF e vínculo Auvo com hierarquia moderada; em largura limitada, metadados vão para “Mais dados do cliente”, nunca somem por truncamento.
- Substituir a faixa plana de `ABAS` por configuração agrupada; preservar ids atuais para reduzir regressão.
- Em viewport estreito, apresentar overflow acessível “Mais”; o grupo/aba ativos permanecem perceptíveis.
- Ações rápidas chamam os modais/flows existentes com `clienteId` predefinido e são condicionadas à política já usada por cada ação.
- Usar primitive de Dialog/Drawer de `@sinergica/ui` para focus trap, retorno de foco e reduced motion.

### 7. Query, cache and failure boundaries

- Query keys incluem `clienteId` e id da entidade.
- Mutações invalidam chaves declaradas pelo caso de uso, sem `window.location.reload`.
- Respostas tardias do cliente anterior não são renderizadas.
- Erro de uma seção/drawer não bloqueia o cockpit inteiro.

### 8. Performance gate

- Primeiro benchmarka derivação local com fixture de 1.000 itens por aba.
- Memorizar índices relacionais em `Map`/`Set` para evitar loops quadráticos.
- Se p95 exceder 300 ms, perfilar antes de mudar a consulta.
- Qualquer necessidade de busca server-side, índice composto ou trigram sai desta story e exige ADR/revisão arquitetural.

## Project Structure

### Documentation

```text
specs/E01-S163-cliente-360-cockpit-operacional/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── ui-contracts.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code

```text
apps/web/src/features/pcm/
├── application/
│   ├── identificador-ativo.ts
│   └── preventivas-gateway.ts
├── components/
│   ├── CampoIdentificador.tsx
│   ├── ChamadoPainel.tsx
│   ├── OrdemServicoDetalhe.tsx                 # new, shared content
│   ├── OrdemServicoDetalheDrawer.tsx           # new
│   ├── PreventivaDetalheDrawer.tsx             # new
│   ├── PreventivasListaView.tsx                # new
│   ├── PreventivasTimelineView.tsx             # new
│   ├── PreventivasCalendarioView.tsx
│   ├── PreventivasWorkspace.tsx
│   ├── PainelItensDoCliente.tsx
│   ├── PainelSistemasCliente.tsx
│   └── PainelFerramentasCliente.tsx
├── domain/
│   ├── cliente-360-filtros.ts                  # new
│   ├── ordens-servico.ts
│   └── preventivas.ts
├── infrastructure/
│   ├── supabase-ferramenta-alocacao-cliente-adapter.ts
│   └── supabase-preventivas-adapter.ts
└── pages/
    ├── EstruturaClientePage.tsx
    ├── OrdensServicoPage.tsx
    └── VisaoClientePage.tsx

apps/web/e2e/
└── cliente-360-cockpit.spec.ts                 # new
```

Testes unitários/integração permanecem ao lado dos arquivos conforme convenção atual.

**Structure Decision**: Evoluir o bounded context PCM existente. Não criar novo pacote, contexto ou camada transversal; extrair apenas componentes e regras com segundo consumidor real.

## Rollout and Verification

1. Entregar US1, US2 e US3 como MVP operacional.
2. Entregar filtros por aba e medir antes de otimizar.
3. Entregar agrupamento/ações rápidas preservando ids de aba.
4. Rodar testes focados a cada fatia, `pnpm run eval:spec` e `pnpm run ci:local` ao final.
5. Executar smoke test com dois clientes e matriz de permissões.
6. Após alterar código, executar `graphify update .` quando a ferramenta estiver disponível; no ambiente atual, `graphify` não está instalado.

## Complexity Tracking

Nenhuma violação constitucional. A quantidade de componentes novos decorre de separar conteúdo reutilizável, shell de drawer e três visualizações, mantendo responsabilidades pequenas.
