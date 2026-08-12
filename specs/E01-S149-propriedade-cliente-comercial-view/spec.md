---
name: E01-S149-propriedade-cliente-comercial-view
description: Documentar e reforçar propriedade de cliente — Comercial dono, PCM/Atendimento veem view
---

# E01-S149 — Propriedade de cliente (Comercial dono, PCM view)

## Contexto
`pcm.clientes` é **Shared Kernel** (ADR-0019) — múltiplos módulos consomem.
Comercial é o **dono** (ciclo de vida: lead → cliente → inativo).
PCM/Atendimento **leem** e (agora) **editam pontualmente** via RPC com guarda.

Hoje: confusão sobre quem controla quê. Documentar clara.

## Requisitos

### AC-1: Propriedade clara
- `pcm.clientes` pertence ao **Comercial** (R1 do ADR-0019)
- Criação/exclusão: só Comercial
- Edição pontual (status ativo/inativo): PCM via RPC guarda `pcm:escrita`

### AC-2: Views de leitura
- `relacionamento.contas` (interface pública de `pcm.clientes`, usa Shared Kernel) — existe
- Nova: `pcm.clientes_ativos_operacao` (view filtrada só pra PCM — S147 feedback)

### AC-3: Documentação
- ARCHITECTURE.md: matriz dono × consumidor inclui Clientes
- Glossário: definição de Conta vs Cliente vs Lead
- ADR-0019 (ou corolário): fronteira explícita

## Fora de escopo
- Implementação nova de tabela/feature
- Migração de dados

## Tier
Trivial (só documentação + view).

---

## Tarefas

1. **View:** `pcm.clientes_ativos_operacao` (read-only, filtro `ativo=true AND status NOT IN ('lead','prospecto')`)
2. **ARCHITECTURE.md:** seção Clientes com matriz e proprietário
3. **ARCHITECTURE.md:** corolário do ADR-0019 — Shared Kernel não transfere propriedade
4. **glossary.md:** Conta, Cliente, Lead, Prospecto (distinções)
5. **Migration:** `0205` (ou próxima livre) cria view + comment de propriedade

---

## Validação
- Documentação clara, leitura compreensível
- View filtra corretamente
- Sem mudança de comportamento (AC-1 de S147/S148 cobrem isso)
