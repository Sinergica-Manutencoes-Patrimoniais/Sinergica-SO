---
name: design
description: Technical Design Doc — 5 eixos + dependências, solução, riscos e roadmap. Puxe ao desenhar feature arquitetural.
alwaysApply: false
---

# Technical Design Doc — Agente entrevistador de cadastro de cliente/estrutura

> **Tier:** arquitetural · **Status:** rascunho
> **Autor:** @prompt-engineer / @architect · **Revisores:** Lucas · **Data:** 2026-07-28

## Contexto da funcionalidade
Onboarding de cliente e cadastro de estrutura de locais é manual. Quer-se um agente que entrevista o
colaborador e propõe os cadastros, com confirmação antes de gravar. Reaproveita a hierarquia de
localização de ativos (ADR-0009) e o cadastro de clientes. Ver `product.md`.

## Goals / Non-goals
**Goals**
- Roteiro de entrevista **configurável** (perguntas, ordem, condicionais, padrão por perfil).
- Proposta de cadastro (contato/CNPJ/estrutura em árvore) a partir das respostas.
- **Confirmação humana** obrigatória antes de qualquer escrita.
- Escrita nos cadastros existentes (cliente + estrutura de locais).

**Non-goals**
- Substituir cadastro manual; portal externo do cliente; catalogar itens fora da gestão.

## Design proposto

### Componentes
1. **Roteiro configurável** (`template de entrevista`): lista de perguntas com tipo (texto, número,
   escolha), condicionais e valores-padrão por perfil de prédio. Editável por admin.
2. **Motor de entrevista** (conversacional): conduz o roteiro, uma pergunta por vez, aceita respostas
   livres, normaliza via LLM. Estado da entrevista persistido (retomável).
3. **Montador de proposta**: transforma respostas → estrutura (árvore de locais até ~3 níveis) +
   campos cadastrais (contato, CNPJ).
4. **Tela de confirmação**: apresenta a proposta ao entrevistado; só grava após confirmação. Permite
   ajuste manual antes de confirmar (o cadastro manual continua soberano).
5. **Gravação transacional**: efetiva cliente + estrutura nos schemas existentes.

### Fluxo
```
admin configura roteiro
  → colaborador inicia entrevista para um cliente
    → motor conduz perguntas (LLM normaliza respostas)
      → montador gera proposta (árvore + cadastro)
        → tela de confirmação (entrevistado revisa/ajusta)
          → confirma? → grava; nega/ajusta → volta ao passo anterior (nada gravado)
```

## Cobertura dos 5 eixos

### 1. Tech stack
OpenRouter (LLM de condução/normalização); Postgres (roteiro, estado de entrevista, escrita nos
cadastros); React (UI conversacional + confirmação); Deno edge se rodar server-side.

### 2. Arquitetura base
Novo material em **Atendimento** (motor conversacional) que **escreve** em PCM (clientes + estrutura
de locais/ativos) via caso de uso/porta — respeitar a regra de dependência (features não se importam
direto; escrita via application/porta). Estrutura de árvore segue ADR-0009. Fronteira nova → ADR-0016.

### 3. Infra
Tabelas novas: `atendimento.roteiro_entrevista` (config), `atendimento.entrevista_sessao` (estado).
RLS FORCE. Escrita final nos schemas de PCM via caso de uso transacional. Secrets/OpenRouter no Vault.

### 4. Qualidade
- Evals (`ia/`): normalização de resposta em campo estruturado; montagem de árvore correta.
- Teste-chave de segurança: **nada é gravado sem confirmação** (AC bloqueante).
- Defesa a prompt injection nas respostas livres do entrevistado.

### 5. Observabilidade
Logar sessões de entrevista (início/confirmação), versão de roteiro e de prompt; auditar as escritas
resultantes em `audit.*` (append-only). Alertar gravação sem confirmação (não deve ocorrer).

## Mapa de dependências
| Dependência                | Tipo    | Descrição                                | Métodos / endpoints        |
|----------------------------|---------|------------------------------------------|----------------------------|
| OpenRouter                 | REST    | Condução/normalização da entrevista      | chat/completions           |
| Cadastro de clientes (PCM) | interna | Escrita de contato/CNPJ                   | caso de uso de cliente     |
| Estrutura de locais (PCM)  | interna | Escrita da árvore (ADR-0009)             | caso de uso de localização |

## Alternativas consideradas
| Alternativa                                | Prós | Contras | Por que (não) |
|--------------------------------------------|------|---------|---------------|
| A (escolhida) roteiro configurável + confirmação antes de gravar | seguro, flexível, alinhado ao pedido | mais peças (roteiro, estado, confirmação) | escolhida |
| B agente grava direto sem confirmação      | menos passos | risco de dado errado; contradiz o pedido | rejeitada |
| C formulário estático multi-step (sem LLM) | simples | não é "entrevista"; perde normalização de linguagem | rejeitada (mas é o fallback) |

## Trade-offs e consequências
- Ganho: onboarding rápido com segurança (confirmação). Custo: complexidade (motor + roteiro +
  estado). Dívida: roteiro configurável pode começar simples (lista fixa) e evoluir.

## Riscos
| Risco                         | Descrição                                   | Prob. × Impacto | Ações / mitigações                    |
|-------------------------------|---------------------------------------------|-----------------|---------------------------------------|
| Gravação sem revisão          | agente grava proposta errada                | baixo × alto    | confirmação obrigatória + auditoria    |
| Prompt injection na resposta  | entrevistado insere instrução maliciosa     | baixo × médio   | sanitização + prompt defensivo         |
| Árvore mal montada            | normalização gera estrutura errada          | médio × médio   | ajuste manual na tela de confirmação   |

## Roadmap da feature
| Fase / onda | Entrega                                             | Quando | Depende de |
|-------------|-----------------------------------------------------|--------|------------|
| 1 (MVP)     | Roteiro fixo + entrevista + confirmação + escrita de contato/CNPJ | próximo ciclo | ADR-0009 |
| 2           | Roteiro totalmente configurável + padrão por perfil de prédio     | depois | 1 |
| 3           | Montagem de árvore de estrutura completa (3 níveis)               | depois | 2 |

## Questões em aberto
- [ ] "Cadastros na área do cliente" (fala do Fabrício) = o **registro do cliente no PCM**, certo? —
      confirmar, já que a Área do Cliente externa (portal) foi descartada (item 14). (Lucas)
- [ ] Perfis de padrão de prédio: quem cadastra e com qual granularidade? (Lucas / Fabrício)
- [ ] MVP usa roteiro fixo ou já configurável? (define escopo da fase 1)

> Nova fronteira (Atendimento escreve cadastro/estrutura de PCM via entrevista) → **ADR-0016**.
