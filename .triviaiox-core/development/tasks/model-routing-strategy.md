# Model Routing Strategy Task

Design a model routing strategy that assigns each task in a pipeline to the right model tier based on cost, latency, and quality requirements.

**Reference:** Anthropic model selection guide, LLM routing papers (MoE, RouteLLM).

---

## Task Definition

```yaml
task: modelRoutingStrategy()
responsavel: Pria (Alchemist)
responsavel_type: Agente
atomic_layer: Molecule

Entrada:
  - campo: pipeline_tasks
    tipo: array
    obrigatorio: true
    validacao: List of tasks in the pipeline with input/output description

  - campo: budget_per_pipeline_run
    tipo: number
    obrigatorio: false
    validacao: Maximum acceptable cost in USD per pipeline execution

  - campo: latency_budget_ms
    tipo: number
    obrigatorio: false
    validacao: Maximum acceptable total latency in ms for pipeline

Saida:
  - campo: routing_strategy
    tipo: file
    destino: docs/prompts/model-routing.md
    persistido: true
```

---

## Execution Steps

### Step 1 — Classify each task

For every task in the pipeline, answer:

| Question | Fast/Cheap | Balanced | Powerful |
|---|---|---|---|
| Requires complex multi-step reasoning? | No | Sometimes | Yes |
| Output is structured / low variance? | Yes | Sometimes | No |
| Latency-sensitive (synchronous user-facing)? | Yes | Partial | No |
| Quality mistake has high consequence? | No | Medium | Yes |

### Step 2 — Map tasks to model tiers

| Tier | Models | Cost guidance | Use when |
|---|---|---|---|
| Fast/Cheap | Haiku, GPT-4o-mini, Gemini Flash | < $0.001/call | Classification, routing, extraction, filtering |
| Balanced | Sonnet, GPT-4o | $0.001-0.01/call | Structured generation, reasoning, summarization |
| Powerful | Opus, GPT-4o with reasoning, o1 | > $0.01/call | Final synthesis, critical decisions, complex reasoning |

### Step 3 — Compute pipeline cost estimate

For each task: `avg_tokens_in × cost_per_1k_input + avg_tokens_out × cost_per_1k_output`

Sum across pipeline. Compare to `budget_per_pipeline_run`.

If over budget:
- Identify tasks with Balanced/Powerful that could move down a tier
- Run eval on downgraded prompt to validate quality holds

### Step 4 — Define routing rules

Document as code-readable YAML:

```yaml
routing_rules:
  - task: {task_name}
    model: {model_id}
    max_tokens: {N}
    timeout_ms: {N}
    fallback:
      on_timeout: {cheaper_model_or_skip}
      on_rate_limit: retry_with_backoff

  - task: {task_name}
    model: {model_id}
    ...
```

### Step 5 — Latency budget allocation

Divide total `latency_budget_ms` across tasks:

- Sequential tasks: sum must be < total budget
- Parallel tasks: bottleneck task determines latency
- Buffer: reserve 20% for infrastructure overhead

---

## Post-Conditions

```yaml
post-conditions:
  - [ ] Every pipeline task has a model assignment
    blocker: true
  - [ ] Pipeline cost estimate within budget
    blocker: false
  - [ ] Fallback model defined for each task
    blocker: false
  - [ ] Routing config exportable as YAML/JSON
    blocker: true
```
