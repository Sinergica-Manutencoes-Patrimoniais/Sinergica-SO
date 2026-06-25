# Prompt A/B Test Task

Design and analyze an A/B test between two prompt variants with statistical rigor.

---

## Task Definition

```yaml
task: promptAbTest()
responsavel: Pria (Alchemist)
responsavel_type: Agente
atomic_layer: Molecule

Entrada:
  - campo: variant_a_path
    tipo: file_path
    obrigatorio: true
  - campo: variant_b_path
    tipo: file_path
    obrigatorio: true
  - campo: eval_set_path
    tipo: file_path
    obrigatorio: true
  - campo: primary_metric
    tipo: string
    obrigatorio: true
    validacao: Which metric decides the winner (e.g., correctness_pass_rate, cost_per_call, p95_latency)

Saida:
  - campo: ab_report
    tipo: file
    destino: docs/prompts/evals/{slug}-ab-{date}.json
    persistido: true
  - campo: winner
    tipo: string
    valores: [A, B, INCONCLUSIVE]
    destino: ab_report
    persistido: true
```

---

## Execution Steps

### Step 1 — Define hypothesis

```
H0 (null): Variant A and Variant B perform equivalently on {primary_metric}
H1 (alternative): Variant B outperforms A on {primary_metric}
```

Significance threshold: p < 0.05. Minimum detectable effect: 5% on primary metric.

### Step 2 — Run both variants on full eval set

Execute variants in parallel or interleaved (to control for time effects).

Record per case:
- Which variant was used
- Output
- Grader score per dimension
- Latency
- Token usage
- Cost

### Step 3 — Compute primary metric and significance

For pass-rate metrics: use chi-squared test or Fisher's exact test.

| Metric | Variant A | Variant B | Delta | p-value |
|---|---|---|---|---|
| {primary_metric} | {A}% | {B}% | {delta}% | {p} |
| cost_per_call | ${A} | ${B} | {delta}% | — |
| p95_latency | {A}ms | {B}ms | {delta}% | — |

### Step 4 — Classify decision

- p < 0.05 AND primary metric delta > minimum effect → winner = B or A
- p ≥ 0.05 OR delta < minimum effect → INCONCLUSIVE

### Step 5 — Secondary analysis

For INCONCLUSIVE: check if sample size is the issue. Calculate required N for the observed effect.

Check for unexpected regressions on non-primary dimensions:
- Even if B wins on quality, does it regress significantly on cost or latency?
- Trade-off must be explicitly accepted.

---

## Post-Conditions

```yaml
post-conditions:
  - [ ] Both variants run on same eval set
    blocker: true
  - [ ] Significance test applied
    blocker: true
  - [ ] Trade-off analysis on secondary metrics
    blocker: true
  - [ ] Decision recorded in prompt card
    blocker: false
```
