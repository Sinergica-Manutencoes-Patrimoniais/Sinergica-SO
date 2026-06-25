# TriviaGrowth Triviaiox Constitution

> **Version:** 1.1.0 | **Ratified:** 2025-01-30 | **Last Amended:** 2026-05-08

Este documento define os princípios fundamentais e inegociáveis do TriviaGrowth Triviaiox. Todos os agentes, tasks, e workflows DEVEM respeitar estes princípios. Violações são bloqueadas automaticamente via gates.

---

## Core Principles

### I. CLI First (NON-NEGOTIABLE)

O CLI é a fonte da verdade onde toda inteligência, execução, e automação vivem.

**Regras:**
- MUST: Toda funcionalidade nova DEVE funcionar 100% via CLI antes de qualquer UI
- MUST: Dashboards apenas observam, NUNCA controlam ou tomam decisões
- MUST: A UI NUNCA é requisito para operação do sistema
- MUST: Ao decidir onde implementar, sempre CLI > Observability > UI

**Hierarquia:**
```
CLI (Máxima) → Observability (Secundária) → UI (Terciária)
```

**Gate:** `dev-develop-story.md` - WARN se UI criada antes de CLI funcional

---

### II. Agent Authority (NON-NEGOTIABLE)

Cada agente tem autoridades exclusivas que não podem ser violadas.

**Regras:**
- MUST: Apenas @devops pode executar `git push` para remote
- MUST: Apenas @devops pode criar Pull Requests
- MUST: Apenas @devops pode criar releases e tags
- MUST: Agentes DEVEM delegar para o agente apropriado quando fora de seu escopo
- MUST: Nenhum agente pode assumir autoridade de outro

**Exclusividades:**

| Autoridade | Agente Exclusivo |
|------------|------------------|
| git push | @devops |
| PR creation | @devops |
| Release/Tag | @devops |
| Story creation | @sm, @po |
| Architecture decisions | @architect |
| Quality verdicts | @qa |

**Gate:** Implementado via definição de agentes (não requer gate adicional)

---

### III. Story-Driven Development (MUST)

Todo desenvolvimento começa e termina com uma story.

**Regras:**
- MUST: Nenhum código é escrito sem uma story associada
- MUST: Stories DEVEM ter acceptance criteria claros antes de implementação
- MUST: Progresso DEVE ser rastreado via checkboxes na story
- MUST: File List DEVE ser mantida atualizada na story
- SHOULD: Stories seguem o workflow: @po/@sm cria → @dev implementa → @qa valida → @devops push

**Gate:** `dev-develop-story.md` - BLOCK se não houver story válida

---

### IV. No Invention (MUST)

Especificações não inventam - apenas derivam dos requisitos.

**Regras:**
- MUST: Todo statement em spec.md DEVE rastrear para:
  - Um requisito funcional (FR-*)
  - Um requisito não-funcional (NFR-*)
  - Uma constraint (CON-*)
  - Um finding de research (verificado e documentado)
- MUST NOT: Adicionar features não presentes nos requisitos
- MUST NOT: Assumir detalhes de implementação não pesquisados
- MUST NOT: Especificar tecnologias não validadas

**Gate:** `spec-write-spec.md` - BLOCK se spec contiver invenções

---

### V. Quality First (MUST)

Qualidade não é negociável. Todo código passa por múltiplos gates antes de merge.

**Regras:**
- MUST: `npm run lint` passa sem erros
- MUST: `npm run typecheck` passa sem erros
- MUST: `npm test` passa sem falhas
- MUST: `npm run build` completa com sucesso
- MUST: CodeRabbit não reporta issues CRITICAL
- MUST: Story status é "Done" ou "Ready for Review"
- SHOULD: Cobertura de testes não diminui

**Gate:** `pre-push.md` - BLOCK se qualquer check falhar

---

### VII. Observability First (MUST)

Sistemas não podem ser operados sem visibilidade. Observabilidade é requisito, não opcional.

**Regras:**
- MUST: Todo serviço em produção DEVE expor traces, métricas e logs (OpenTelemetry padrão)
- MUST: SLOs DEVEM ser definidos antes de ir para produção (latência p99, error rate, availability)
- MUST: Error budget DEVE ser calculado — deploys bloqueados quando budget esgotado
- SHOULD: Dashboard de RED metrics (Rate, Errors, Duration) por serviço
- SHOULD: Runbook existe para cada alerta crítico

**Responsável:** @reliability (Rex)
**Gate:** `production-readiness-checklist.md` — BLOCK se SLO não definido

---

### VIII. Prompt-as-Code (MUST)

Prompts de LLM são artefatos de engenharia — versionados, testados, revisados como código.

**Regras:**
- MUST: Todo prompt de produção DEVE ter eval set (mínimo 20 casos)
- MUST: Regressão de prompt DEVE ser verificada antes de merge (pass_rate_delta ≤ -5%)
- MUST: Prompts DEVEM ser versionados com semantic versioning
- MUST: Prompt cards documentam: propósito, inputs, outputs esperados, cost baseline
- MUST NOT: Alterar prompts de produção sem regressão verificada

**Responsável:** @prompt-engineer (Pria)
**Gate:** `prompt-quality-gate.md` — BLOCK se eval set ausente

---

### IX. FinOps Aware (SHOULD)

Custos de LLM são variáveis e podem escalar de forma não-linear. Todo componente deve ter custo rastreado.

**Regras:**
- SHOULD: Cost-per-task instrumentado em tabela de execuções
- SHOULD: Alertas de anomalia de custo configurados (limiar: +20% sobre baseline 7 dias)
- SHOULD: Model routing documentado: Fast/Cheap → Balanced → Powerful conforme complexidade
- MUST NOT: Usar modelos Powerful para tarefas repetitivas/simples sem justificativa

**Responsável:** @analyst (Atlas)
**Gate:** `finops-readiness-checklist.md` — WARN se sem instrumentação

---

### X. AI Safety by Default (MUST)

Sistemas LLM têm vetores de ataque únicos. Defesa contra prompt injection e PII leakage são não-negociáveis.

**Regras:**
- MUST: Toda feature LLM DEVE ser testada contra OWASP LLM Top 10 antes de produção
- MUST: Inputs não-confiáveis (scraping, webhook, user-generated) DEVEM ser sanitizados antes de envio ao LLM
- MUST: Outputs de LLM com PII DEVEM ser redacted antes de logs/storage
- MUST NOT: Retornar outputs de LLM diretamente ao usuário sem validação de conteúdo

**Responsável:** @qa (Quinn)
**Gate:** `ai-safety-checklist.md` — BLOCK em falhas LLM01 (Prompt Injection) e LLM06 (Sensitive Disclosure)

---

### VI. Absolute Imports (SHOULD)

Imports relativos criam acoplamento e dificultam refatoração.

**Regras:**
- SHOULD: Sempre usar imports absolutos com alias `@/`
- SHOULD NOT: Usar imports relativos (`../../../`)
- EXCEPTION: Imports dentro do mesmo módulo/feature podem ser relativos

**Exemplo:**
```typescript
// CORRETO
import { useStore } from '@/stores/feature/store'

// INCORRETO
import { useStore } from '../../../stores/feature/store'
```

**Gate:** ESLint rule (já implementado)

---

## Governance

### Amendment Process

1. Proposta de mudança documentada com justificativa
2. Review por @architect e @po
3. Aprovação requer consenso
4. Mudança implementada com atualização de versão
5. Propagação para templates e tasks dependentes

### Versioning

- **MAJOR:** Remoção ou redefinição incompatível de princípio
- **MINOR:** Novo princípio ou expansão significativa
- **PATCH:** Clarificações, correções de texto, refinamentos

### Compliance

- Todos os PRs DEVEM verificar compliance com Constitution
- Gates automáticos BLOQUEIAM violações de princípios NON-NEGOTIABLE
- Gates automáticos ALERTAM violações de princípios MUST
- Violações de SHOULD são reportadas mas não bloqueiam

### Gate Severity Levels

| Severidade | Comportamento | Uso |
|------------|---------------|-----|
| BLOCK | Impede execução, requer correção | NON-NEGOTIABLE, MUST críticos |
| WARN | Permite continuar com alerta | MUST não-críticos |
| INFO | Apenas reporta | SHOULD |

---

## References

- **Princípios derivados de:** `.claude/CLAUDE.md`
- **Inspirado por:** GitHub Spec-Kit Constitution System
- **Gates implementados em:** `.triviaiox-core/development/tasks/`
- **Checklists relacionados:** `.triviaiox-core/product/checklists/`

---

*TriviaGrowth Triviaiox Constitution v1.1.0*
*CLI First | Agent-Driven | Quality First | Observability First | Prompt-as-Code | FinOps Aware | AI Safety by Default*
