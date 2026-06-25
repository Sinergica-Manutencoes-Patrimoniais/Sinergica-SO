---
name: regra-artefato-canonico
description: Regra que reconcilia Triviaiox com a esteira SDD — artefato único, sem story paralela. Puxe ao orquestrar agentes no Padrão OS.
alwaysApply: false
---

# Regra — Artefato canônico único (Triviaiox × SDD)

Para evitar duas cerimônias concorrentes (artefatos SDD vs "story" do Triviaiox), vale **uma
única verdade**:

1. **Os artefatos da esteira SDD são os únicos artefatos de planejamento:**
   `specs/NNNN-*/{product,domain,design,spec,tasks}.md` + ADR em `docs/adr/`.
2. **A story do Triviaiox é uma visão de execução** derivada de `tasks.md` — pode existir como
   recorte operacional para o `@dev`, mas **não duplica** AC, escopo ou design. Se conflitar com a
   `spec.md`, a **spec vence**.
3. **Cada agente respeita a propriedade do artefato** (ver `config.yaml` → `artifact_ownership`):
   - `@pm` é dono de `product.md` e `spec.md` (AC). `@dev` não altera AC/escopo da spec.
   - `@architect` é dono de `domain.md`, `design.md` e ADR.
   - `@sm` transforma spec+design em `tasks.md` (cada task → `AC-N` + gate executável).
   - `@qa` valida pelos gates (`/validar`); `@devops` faz push/PR (exclusivo).
4. **Sem invenção de novo formato.** Templates só de `specs/_templates/`. Exemplo de referência:
   `specs/0001-calculo-comissao/`.

> Esta regra existe porque tanto o Triviaiox quanto o SDD têm "AC", "tasks" e "decisão durável".
> Unificar no conjunto SDD elimina ambiguidade para o agente e mantém a rastreabilidade
> `AC → task → gate → commit`.
