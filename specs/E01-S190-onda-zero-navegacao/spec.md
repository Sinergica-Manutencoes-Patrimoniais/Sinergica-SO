# Feature Specification: Onda Zero — navegação consolidada

**Story:** E01-S190 · **Owner:** _(marcar antes de codar)_ · **Created:** 2026-11-13
**Feature Branch (planejada):** `feat/E01-S190-onda-zero-navegacao`
**Status:** Especificada — implementação não iniciada. **Exige aceite do Fabrício antes de codar** (ver Decisões pendentes).

**Input:** Reanálise do Fabrício de 12/11/2026, seção 7 ("Simplificação recomendada") e decisões solicitadas 1 e 6.

## Contexto — o problema que esta story resolve

O Fabrício aponta que o sistema publicado "continua com o menu amplo e conceitos separados" e que
"Assessment deve virar tipo de Inspeção na simplificação". A recomendação dele é explícita: a
simplificação deve acontecer **antes** da abertura ampla dos gates e antes de novas telas.

Isto não é dívida técnica — é **divergência em relação ao pedido**. Módulos que ele nunca pediu
como módulos (Assessment, PMOC) viraram módulos; conceitos que ele pediu juntos (Cliente e sua
estrutura) ficaram separados em três entradas de menu.

**O código de banco e integrações é preservado.** A mudança é de navegação, nomenclatura e
agrupamento — nada de regra de negócio é reescrito.

## Decisões pendentes — bloqueiam o início

Esta story **não pode começar** sem resposta a duas perguntas da reanálise (26 e 27):

1. Assessment vira **tipo de Inspeção** chamado "Diagnóstico Inicial do Cliente"? E PMOC vira **modalidade de Plano de Manutenção**?
2. Clientes, Sistemas e Componentes se reúnem em **"Clientes e Estrutura"**, com entrada pela Visão 360?

Se a resposta for não a qualquer uma, o escopo correspondente sai e a story encolhe.

## User Scenarios & Testing

### US1 — Conceitos duplicados viram um só (Priority: P1)

**Why this priority:** É a divergência conceitual; enquanto existir, qualquer tela nova herda a confusão.

**Independent Test:** Criar um Diagnóstico Inicial e confirmar que ele aparece na lista de Inspeções, com os dados do antigo Assessment preservados e acessíveis.

**Acceptance Scenarios:**

- **AC-1:** Dado um Assessment já existente, quando a consolidação for aplicada, então ele aparece como Inspeção do tipo "Diagnóstico Inicial do Cliente", **com identidade, histórico e evidências preservados** — nenhum registro é recriado nem perde vínculo.
- **AC-2:** Dado um PMOC existente, quando a consolidação for aplicada, então ele aparece como modalidade de Plano de Manutenção, mantendo rotinas, ocorrências geradas e documentos emitidos.
- **AC-3:** Dado um usuário que acessava o módulo antigo por link direto ou favorito, quando abrir a rota antiga, então é levado ao lugar novo — nunca a uma página de erro.

### US2 — O menu reflete como a operação pensa (Priority: P1)

**Why this priority:** O menu é a primeira coisa que o operador vê; é onde a complexidade aparece.

**Independent Test:** Abrir o sistema com perfil de Operador PCM e contar as entradas de menu principal; confirmar que configurações administrativas não aparecem.

**Acceptance Scenarios:**

- **AC-4:** Dado o menu principal, quando reorganizado, então agrupa em **Clientes e Estrutura** (entrada pela Visão 360), **Planejamento e Visitas** (agenda e visitas juntas), **Central de Pendências** (com filtros por origem e decisão do PCM) e **Relatórios** (uma área, visões por finalidade).
- **AC-5:** Dados tipos, categorias, grupos e palavras-chave, quando o menu for reorganizado, então eles saem do menu principal para **Configurações administrativas**, visíveis apenas a perfis autorizados.
- **AC-6:** Dado um perfil sem autorização para uma área, quando abrir o sistema, então a área não aparece no menu — ocultar é consequência da permissão, nunca uma lista fixa por papel.

### US3 — Nada se perde na consolidação (Priority: P1)

**Why this priority:** Reorganizar navegação é onde se perde funcionalidade sem perceber.

**Independent Test:** Antes e depois, listar as ações alcançáveis por um perfil e comparar; qualquer ação que sumiu é regressão.

**Acceptance Scenarios:**

- **AC-7:** Dada a lista de ações alcançáveis por perfil antes da mudança, quando comparada à de depois, então nenhuma ação desapareceu sem decisão registrada — tela que sai do menu continua alcançável pelo caminho novo.
- **AC-8:** Dado o glossário do projeto, quando um termo for renomeado, então o glossário é atualizado no mesmo PR e o termo antigo fica registrado como sinônimo histórico.

### Edge Cases

- Registro de Assessment em andamento no momento da consolidação não pode ficar inacessível.
- Perfil que só tinha acesso ao módulo antigo precisa manter acesso equivalente no lugar novo.
- Relatório que hoje é entrada própria no menu e vira visão dentro de Relatórios: o link antigo tem que continuar funcionando.
- Documento PMOC já emitido referencia o conceito antigo; a emissão anterior não é reescrita.

## Requirements

### Functional Requirements

- **FR-001:** Consolidar Assessment em tipo de Inspeção e PMOC em modalidade de Plano, preservando identidade e histórico, conforme AC-1, AC-2, AC-3.
- **FR-002:** Reorganizar o menu principal em áreas, movendo catálogos administrativos para Configurações, conforme AC-4, AC-5, AC-6.
- **FR-003:** Garantir ausência de regressão de alcance, conforme AC-7, AC-8.
- **FR-004:** Manter rotas antigas respondendo por redirecionamento, não por erro.

### Key Entities

Nenhuma entidade nova. **Tipo de Inspeção** ganha o valor "Diagnóstico Inicial do Cliente";
**Plano de Manutenção** ganha a modalidade PMOC. Navegação deixa de ser lista de módulos e passa a
ser lista de **áreas**, cada uma com visões.

## Success Criteria

- **SC-001:** O menu principal do Operador PCM cabe sem rolagem e nenhuma entrada é catálogo administrativo.
- **SC-002:** Nenhum registro de Assessment ou PMOC perde identidade, histórico ou evidência.
- **SC-003:** Toda rota antiga responde — redirecionada, nunca quebrada.
- **SC-004:** A comparação de ações alcançáveis por perfil, antes e depois, não tem perda não decidida.

## Assumptions & Dependencies

- **Bloqueada pelas decisões acima.** Sem aceite, não começa.
- Independente de E01-S188 e E01-S189 em código, mas o Fabrício pede que seja feita **antes** da abertura ampla de gates.
- Não depende de credencial externa.

## Fora de escopo

- Reescrever regra de negócio de Inspeção, Plano ou PMOC.
- Redesenho visual das telas internas; aqui é agrupamento e nomenclatura.
- Remover código de módulo consolidado — ele é preservado, só deixa de ser entrada própria de menu.
