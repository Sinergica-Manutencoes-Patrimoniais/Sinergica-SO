---
name: tasks
description: Tasks e gates — preventivas PCM com execução no Auvo.
alwaysApply: false
---

# Tasks — Preventivas no PCM, execução no Auvo

| # | Task | AC | Depende | Gate | Status |
|---|------|----|---------|------|--------|
| 1 | Validar POST/GET Auvo com task futura, técnico, questionário, alvo Sistema/Componente e chave estável; registrar evidência sanitizada no design | AC-2, AC-3, AC-4, AC-5 | acesso de teste autorizado | contrato real documentado | todo |
| 2 | Fechar design/ADR com campos comprovados, estados, reconciliação, payload de avaliação/local e tratamento de ciclos passados | AC-1, AC-3, AC-4, AC-5 | 1 | revisão arquitetural | todo |
| 3 | Migration aditiva de planos, ocorrências, vínculos, resultados e achados; índices, RLS FORCE, audit e pgTAP permitido/negado | AC-1, AC-4, AC-5, AC-6, AC-7 | 2 | `pnpm run lint:migrations`; `db-tests` | todo |
| 4 | Domínio com testes de recorrência ancorada, fim de mês, pausa, atraso e geração idempotente | AC-1, AC-7 | 3 | testes focados | todo |
| 5 | Casos de uso e UI de plano para Sistema/Componente, questionário obrigatório, ativação/pausa | AC-1, AC-7 | 3, 4 | testes focados | todo |
| 6 | Calendário/drawer com vencimento, visita, alvo/itens, estados e confirmação de Fabrício | AC-2, AC-3 | 5 | teste de UI | todo |
| 7 | Criação imediata Auvo, leitura de confirmação, vínculo, bloqueio de questionário incerto, falha/retry idempotente | AC-3, AC-4 | 1-3, 6 | teste integração | todo |
| 8 | Sync idempotente de status e avaliações necessárias ao resultado; preservar payloads, fotos, medições e local já recebidos sem exigir sua reprodução na nova visão | AC-5 | 3, 7 | teste de reentrega/ordem | todo |
| 9 | Triagem de achados e envio manual individual ao backlog, com origem e deduplicação | AC-6 | 8 | teste de decisão/repetição | todo |
| 10 | Validar plano de Sistema e Componente ponta a ponta; revisão adversarial, `pnpm run ci:local`, CI `db-tests` | AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7 | 1-9 | gates verdes | todo |
| 11 | Exibir e operar Preventivas na aba da Visão 360, usando o mesmo fluxo e dados do PCM com escopo fixo no cliente aberto | AC-8 | 5-9 para fluxo completo; leitura pode avançar antes do gate Auvo | testes de filtro, componente, navegação e E2E da aba | implementado localmente; E2E autenticado pendente de credenciais |
| 12 | Acrescentar calendário mensal, histórico e detalhe resumido com resultado consolidado e link direto para a OS Auvo | AC-5, AC-7, AC-8, AC-9 | 8, 11 | contrato real de resultado, testes de domínio/UI/E2E e `ci:local` | implementação local parcial; contrato vivo, db-tests, E2E e CI pendentes |

Task 7 bloqueada até task 1 comprovar POST/GET com questionário e alvo corretos. Resultado de
POST sem leitura conclusiva não satisfaz gate; task parcial nunca fica disponível ao técnico.

## E01-S53/T11 — Preventivas na Visão 360: plano para Terra

> Execução: Terra implementa as três entregas abaixo, uma por vez. Ler `spec.md` (AC-8),
> `design.md` e os arquivos citados antes de editar. Uma entrega concluída inclui teste e commit
> local `feat(E01-S53): ...`. Não fazer push, deploy, migration ou teste que crie task real no Auvo.

**Objetivo:** a aba `Preventivas` da Visão 360 mostra e opera apenas planos, vencimentos e
avaliações do cliente aberto. O PCM global continua mostrando a carteira inteira.

**Arquitetura:** extrair a tela atual para um workspace reutilizado nos dois contextos. O
adaptador recebe `clienteId?: string`; quando informado, filtra `planos_preventivos.cliente_id`
no banco e consulta ocorrências/avaliações somente pelos IDs obtidos. A Visão 360 monta o
workspace quando a aba está ativa. O cliente do novo plano vem da prop, sem seletor.

**Stack:** React 19, TypeScript, Supabase JS, TanStack Query, Vitest/Testing Library, Playwright.

**Fora desta task:** mudar recorrência, contrato Auvo, schema/RLS, navegação PCM global,
questionários respondidos em PCM, backlog automático. O gate de validação do Auvo da AC-3
continua valendo também na Visão 360.

### Arquivos e contratos

- Criar `apps/web/src/features/pcm/infrastructure/supabase-preventivas-adapter.ts`: leituras e
  mutações já existentes em `PreventivasPage.tsx`, com opção de `clienteId`.
- Criar `apps/web/src/features/pcm/components/PreventivasWorkspace.tsx`: formulário, calendário,
  avaliações e ações existentes, recebendo `{ clienteId?: string; temEscrita: boolean;
  userId: string; clienteNome?: string; compacto?: boolean }`.
- Modificar `apps/web/src/features/pcm/pages/PreventivasPage.tsx`: wrapper de permissão e
  workspace sem cliente fixo. Não duplicar JSX ou caminhos de escrita.
- Modificar `apps/web/src/features/pcm/pages/VisaoClientePage.tsx`: aba no array `ABAS` e
  conteúdo `<PreventivasWorkspace key={cliente.id} clienteId={cliente.id} ... />`.
- Testar em `apps/web/src/features/pcm/infrastructure/supabase-preventivas-adapter.test.ts`,
  `apps/web/src/features/pcm/components/PreventivasWorkspace.test.tsx`,
  `apps/web/src/features/pcm/pages/VisaoClientePage.test.tsx`,
  `apps/web/src/app/visual-v1.test.ts` e `apps/web/e2e/preventivas-cliente-360.spec.ts`.

**Interfaces estáveis:**

```ts
import type { ReactElement } from "react";

export type ContextoPreventivas = { clienteId?: string };
export async function listarPreventivas(
  contexto: ContextoPreventivas,
): Promise<{ planos: Plano[]; ocorrencias: Ocorrencia[]; avaliacoes: Avaliacao[] }>;
export function PreventivasWorkspace(props: {
  clienteId?: string;
  clienteNome?: string;
  temEscrita: boolean;
  userId: string;
  compacto?: boolean;
}): ReactElement;
```

As interfaces `Plano`, `Ocorrencia` e `Avaliacao` hoje privadas em `PreventivasPage.tsx`
devem ser exportadas em `application/preventivas-gateway.ts` para o adaptador e workspace.
`listarPreventivas({})` representa carteira global; `listarPreventivas({ clienteId })` nunca
consulta todas as ocorrências/avaliações para filtrar depois no navegador.

### Entrega 11.1 — consultas com escopo de cliente

- [ ] Escrever teste com planos de A e B: `listarPreventivas({ clienteId: "A" })` retorna apenas
  planos de A; usa somente IDs de A em `.in("plano_id", ids)` e `.in("ocorrencia_id", ids)`.
  Testar também A sem planos: retorna três arrays vazios sem consultar tabelas filhas.
- [ ] Executar `rtk pnpm --filter @sinergica/web test -- supabase-preventivas-adapter` e conferir
  falha anterior à implementação.
- [ ] Extrair leitura do `carregar()` atual para adaptador. Ordem obrigatória:

```ts
let planosQuery = supabase.schema("pcm").from("planos_preventivos").select("*");
if (clienteId) planosQuery = planosQuery.eq("cliente_id", clienteId);
const planos = await planosQuery.order("primeira_data");
const planoIds = (planos.data ?? []).map((plano) => plano.id);
if (planoIds.length === 0) return { planos: [], ocorrencias: [], avaliacoes: [] };
const ocorrencias = await supabase.schema("pcm").from("ocorrencias_preventivas")
  .select("*").in("plano_id", planoIds).order("vencimento");
const ocorrenciaIds = (ocorrencias.data ?? []).map((ocorrencia) => ocorrencia.id);
const avaliacoes = ocorrenciaIds.length === 0 ? { data: [], error: null }
  : await supabase.schema("pcm").from("avaliacoes_preventivas")
      .select("*").in("ocorrencia_id", ocorrenciaIds)
      .order("recebido_em", { ascending: false }).limit(30);
```

  Verificar cada `error` antes de retornar. Na carteira global, também selecionar ocorrências
  pelos `planoIds`, sem mudar comportamento visível. Para catálogo de alvos, filtrar
  `sistemas.cliente_id` e `equipamentos.client_id` no banco quando `clienteId` estiver presente.
- [ ] Rodar teste focado e `rtk pnpm --filter @sinergica/web exec tsc --noEmit`; commit local.

### Entrega 11.2 — mesmo workspace nos dois lugares

- [ ] Escrever teste de componente para cliente A: nome do cliente no formulário fixo, sem
  seletor de cliente; alvos só de A; leitura sem escrita esconde `Novo plano`, `Pausar`,
  `Confirmar visita` e `Enviar ao backlog`; carteira global mantém seletor.
- [ ] Executar `rtk pnpm --filter @sinergica/web test -- PreventivasWorkspace` e conferir falha.
- [ ] Extrair JSX e handlers da página existente para `PreventivasWorkspace`. Na Visão 360,
  `clienteId` prevalece sobre qualquer valor do formulário. Em abertura do modal:

```ts
const clienteEfetivoId = clienteId ?? form.clienteId;
if (!clienteEfetivoId) throw new Error("Selecione um cliente.");
const linha = {
  nome: form.nome,
  cliente_id: clienteEfetivoId,
  sistema_id: form.alvoTipo === "sistema" ? form.alvoId : null,
  equipamento_id: form.alvoTipo === "equipamento" ? form.alvoId : null,
  questionario_id: form.questionarioId,
  tipo_tarefa_id: form.tipoTarefaId,
  primeira_data: form.primeiraData,
  intervalo_unidade: form.unidade,
  intervalo_n: form.intervaloN,
  estado: "ativo",
  created_by: userId,
};
const { error } = await supabase.schema("pcm").from("planos_preventivos").insert(linha);
if (error) throw error;
```

  Ao trocar `clienteId`, fechar modais, limpar plano/ocorrência selecionados e reiniciar
  formulário. Usar `queryKey: ["pcm", "preventivas", clienteId ?? "todos"]` para não
  reutilizar dados de outro cliente; invalidar prefixo `["pcm", "preventivas"]` após criar,
  pausar, confirmar ou enviar achado, atualizando a aba e a tela global. Carregar catálogos de
  formulário quando modal abrir. Usar rótulos acessíveis (`htmlFor`/`id`) nos campos.
- [ ] Rodar teste focado, typecheck e teste visual de navegação; commit local.

### Entrega 11.3 — aba da Visão 360 e regressão

- [ ] Escrever teste que encontra botão `Preventivas` dentro da Visão 360 e renderiza workspace
  apenas ao selecionar a aba, com `clienteId={cliente.id}` e `temEscrita` já calculados pelo PCM.
  Troca de A para B não deve mostrar plano nem modal de A. Nenhuma query preventiva antes da aba.
  Sem leitura PCM, não renderizar a aba. Falha de consulta mostra `Tentar novamente`, que refaz
  a consulta filtrada; clicar `Atualizar` também preserva filtro do cliente.
- [ ] Executar `rtk pnpm --filter @sinergica/web test -- VisaoClientePage` e conferir falha.
- [ ] Alterar `Aba360`, `ABAS` e bloco de render em `VisaoClientePage.tsx`:

```tsx
{aba === "preventivas" && user && (
  <PreventivasWorkspace
    key={cliente.id}
    clienteId={cliente.id}
    clienteNome={cliente.nome}
    temEscrita={temEscrita}
    userId={user.id}
    compacto
  />
)}
```

  Colocar aba junto de `OS`/`Inspeções`; manter a tela global no menu PCM. A aba precisa
  funcionar com zero planos, falha de rede e read-only.
- [ ] Criar E2E UI com duas contas e respostas REST interceptadas: entrar na Visão 360 de A,
  abrir Preventivas e ver somente plano A; trocar para B e não ver A; no formulário, cliente B
  está fixo. A interceptação verifica `cliente_id=eq.<id>` na URL de `planos_preventivos` e
  rejeita GET global, além de conferir os IDs usados nas buscas de ocorrências/avaliações.
  Não criar task Auvo durante esse teste. `apps/web/e2e/cadastro-ativos-360.spec.ts`
  mostra caminho de navegação autenticada; usar seletores escopados a `main` porque menu lateral
  e aba têm mesmo texto.
- [ ] Rodar `rtk pnpm --filter @sinergica/web test`,
  `rtk pnpm --filter @sinergica/web exec tsc --noEmit`,
  `rtk pnpm --filter @sinergica/web test:e2e -- preventivas-cliente-360.spec.ts` e
  `rtk git diff --check`. Registrar E2E não executado se faltar sessão autenticada; não declarar
  PASS por inspeção. Commit local.

### Review Focus para Terra

1. Cliente A vazio e cliente B com planos: A exibe estado vazio sem vazamento de B (11.1/11.3).
2. Troca A para B com modal aberto: modal fecha e seleção não é reaproveitada (11.2/11.3).
3. Usuário PCM leitura: vê calendário e avaliações, mas nenhuma mutação (11.2).
4. Muitas avaliações de B: limite 30 aplicado depois do filtro de A (11.1).
5. Criar plano na Visão 360 de B: `cliente_id` persistido é B, inclusive após alternar de A
   para B; o seletor global continua operante (11.2/11.3).

## E01-S53/T12 — Calendário e histórico de preventivas

**Objetivo:** transformar a aba Preventivas da Visão 360 em consulta gerencial do ciclo completo,
sem copiar o formulário de campo para o PCM. Cada ocorrência fica acessível no calendário e no
histórico, mostra resultado `Pendente|OK|Não OK` e abre a OS completa no Auvo.

**Regra de resultado:** qualquer pergunta explicitamente marcada “Não OK” torna a ocorrência
`Não OK`. `OK` exige OS concluída, questionário completo e nenhuma marca “Não OK”. Ausência de
resposta, formato não comprovado ou sincronização incompleta permanece `Pendente`. Texto livre
nunca é interpretado como aprovação ou reprovação.

### Entrega 12.1 — contrato de resultado do Auvo

- [ ] Obter retorno real e sanitizado de OS concluída com questionário, cobrindo uma resposta
  “Não OK”, uma execução sem “Não OK” e questionário incompleto. Preferir leitura de tarefa já
  existente; criar tarefa real exige autorização explícita.
- [ ] Identificar campo e valores estáveis usados pelo Auvo. Se marca inequívoca não estiver
  disponível, registrar bloqueio e manter todas as ocorrências sem resultado comprovado como
  `Pendente`.
- [ ] Atualizar ADR-0008 com a decisão: PCM conserva resultado consolidado e vínculo; conteúdo
  completo da execução permanece no Auvo nesta etapa.
- [ ] Criar fixtures sanitizadas e testes de contrato. Gate: classificação não depende de texto
  livre, posição da pergunta ou rótulo traduzido por inferência.

### Entrega 12.2 — domínio, persistência e consulta histórica

- [x] Escrever testes da matriz de consolidação antes da implementação: qualquer “Não OK”;
  concluída sem reprovação; incompleta; conclusão antes das respostas; reentrega; evento antigo.
- [x] Implementar função pura única para consolidação e usá-la em webhook, pull e reconciliação.
- [x] Se campos consolidados não existirem, criar migration aditiva para resultado e instante da
  última consolidação, com RLS FORCE, índices necessários e pgTAP permitido/negado. Não remover
  avaliações ou snapshots existentes.
- [~] Expandir leitura de ocorrências com OS, técnico, datas e resultado sem N+1. O cliente já é
  limitado pelo plano autorizado; paginação explícita do histórico permanece pendente.
- [ ] Gates: testes focados, `lint:migrations`, `db-tests`, typecheck e reentrega fora de ordem.

### Entrega 12.3 — calendário, histórico e detalhe resumido

- [~] Escrever testes de componente para mês atual, navegação entre meses, evento em `visita_em`
  ou fallback em `vencimento`, filtros de período/resultado e permanência de ciclos concluídos.
- [x] Implementar calendário mensal e histórico decrescente na aba Preventivas da Visão 360,
  reutilizando consulta e regras da tela global quando aplicável.
- [x] Abrir o mesmo detalhe resumido por evento ou linha: plano, alvo, vencimento, visita,
  conclusão, técnico, OS, estado operacional e resultado.
- [x] Exibir **Ver OS no Auvo** somente com `auvo_task_id`; abrir a task correta em nova aba, sem
  credenciais na URL. Sem vínculo, explicar que OS ainda não foi criada ou sincronizada.
- [~] Tratar carregando, vazio, erro/retry e somente leitura. Gates: componente, acessibilidade,
  teste visual e typecheck.

### Entrega 12.4 — validação ponta a ponta

- [ ] E2E autenticado: abrir Cliente 360, navegar meses, localizar ocorrência concluída, conferir
  resultado e validar destino do link Auvo sem alterar ou concluir tarefa real.
- [ ] E2E de isolamento: cliente A nunca mostra evento, histórico ou detalhe de B após troca rápida
  de cliente, filtro, retry ou retorno atrasado.
- [ ] Regressão de criação/agendamento, pausa, retry Auvo e envio manual ao backlog.
- [ ] Executar testes web, typecheck, `db-tests`, `pnpm run ci:local`, revisão adversarial e
  `git diff --check`. Registrar separadamente qualquer gate externo indisponível.

### Fora da T12

- Renderizar formulário, fotos, medições ou relato completo no PCM.
- Editar ou responder questionário pelo PCM.
- Classificar texto livre como “Não OK”.
- Criar backlog automaticamente.

### Registro de execução — 2026-10-01

- 11.1: testes do adaptador aprovados (2); typecheck aprovado. Commit local `40b6fb0`.
- 11.2: testes do workspace aprovados (2), typecheck e teste visual aprovados. Commit local
  `2520f76`.
- 11.3: suíte web aprovada (166 arquivos, 1114 testes; 3 arquivos/9 testes de integração sem
  ambiente foram pulados), typecheck e `git diff --check` aprovados. O E2E foi criado e listado,
  mas a execução autenticada parou no setup porque `SUPABASE_TEST_EMAIL` e
  `SUPABASE_TEST_PASSWORD` não estão configurados. Nenhuma task Auvo foi criada.

## Divergências (SPEC_DEVIATION)

- [ ] Nenhuma divergência aberta.
