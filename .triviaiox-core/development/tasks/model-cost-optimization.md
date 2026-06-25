# Model Cost Optimization Task

Analyze LLM model tier usage and recommend changes to reduce cost without quality regression.

**Reference:** FinOps Foundation (Optimize phase), Anthropic model comparison docs.

---

## Task Definition

```yaml
task: modelCostOptimization()
responsavel: Atlas (Decoder)
responsavel_type: Agente
atomic_layer: Molecule

Entrada:
  - campo: cost_report_path
    tipo: file_path
    obrigatorio: true

  - campo: current_routing_path
    tipo: file_path
    obrigatorio: false
    validacao: docs/prompts/model-routing.md

Saida:
  - campo: optimization_recommendations
    tipo: file
    destino: docs/finops/{service_id}-cost-optimization.md
    persistido: true
```

---

## Execution Steps

### Step 1 — Identify high-cost model usages

From cost report, find tasks with:

- High cost-per-call AND high volume → largest optimization targets
- Powerful-tier model (Opus, GPT-4o) for simple tasks → likely over-provisioned

### Step 2 — Assess downgrade candidates

For each high-cost task, evaluate:

| Task | Current Model | Candidate Downgrade | Risk |
|---|---|---|---|
| {task} | claude-opus | claude-sonnet | Medium — test regression |
| {task} | claude-sonnet | claude-haiku | Low — simple extraction |

Downgrade is safe when:

- Task is classification, extraction, or filtering
- Output schema is strict and validated
- Eval pass rate difference between models < 5% (validate with @prompt-engineer)

### Step 3 — Estimate savings

For each recommendation:

```
current_cost_per_month = calls_per_day × avg_tokens × model_price × 30
new_cost_per_month = calls_per_day × avg_tokens × cheaper_model_price × 30
savings = current - new
savings_pct = savings / current × 100
```

### Step 4 — Caching opportunities

Identify prompts with repetitive system prompts (> 1024 tokens):

- Anthropic prompt caching: 90% discount on cached tokens
- Candidate: any system prompt that's the same across many calls
- Implement via `cache_control: {type: "ephemeral"}` on static sections

### Step 5 — Batch vs. real-time

Tasks that don't require real-time responses:

- Use Anthropic Batches API (50% discount vs standard)
- Eligible: background processing, bulk analysis, non-interactive generation

### Step 6 — Recommendations document

```markdown
## Cost Optimization Recommendations — {service_id}

### High-Impact Changes
1. Downgrade {task} from {model_A} to {model_B} — saves ${X}/month — Low risk (validate with @prompt-engineer)
2. Add prompt caching to {task} system prompt — saves ${X}/month — Zero risk

### Medium-Impact Changes
3. Batch {task} calls — saves ${X}/month — Requires pipeline change (story for @sm)

### Total Projected Savings
${X}/month ({Y}% of current LLM spend)

### Next Steps
- @prompt-engineer: validate model downgrade with regression eval
- @sm: create story for batch implementation
```

---

## Post-Conditions

```yaml
post-conditions:
  - [ ] Recommendations document generated
    blocker: true
  - [ ] Cost savings estimated per recommendation
    blocker: true
  - [ ] High-risk recommendations flagged for @prompt-engineer validation
    blocker: true
```
