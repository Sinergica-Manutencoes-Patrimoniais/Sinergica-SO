# Prompt Regression Test Task

Compare a modified prompt against its baseline to detect regressions before shipping.

---

## Task Definition

```yaml
task: promptRegressionTest()
responsavel: Pria (Alchemist)
responsavel_type: Agente
atomic_layer: Atom

Entrada:
  - campo: baseline_results_path
    tipo: file_path
    obrigatorio: true

  - campo: candidate_prompt
    tipo: string
    obrigatorio: true

  - campo: eval_set_path
    tipo: file_path
    obrigatorio: true

Saida:
  - campo: regression_report
    tipo: file
    destino: docs/prompts/evals/{slug}-regression-{date}.json
    persistido: true

  - campo: decision
    tipo: enum
    valores: [PASS, REGRESSION, IMPROVEMENT, MIXED]
    destino: regression_report
    persistido: true
```

---

## Execution Steps

### Step 1 — Run candidate against full eval set

Execute candidate prompt against all eval cases. Collect same metrics as baseline:

- Pass rate per dimension
- P50/P95/P99 latency
- Tokens per call
- Cost per call

### Step 2 — Compute delta

| Metric | Baseline | Candidate | Delta | Threshold |
|---|---|---|---|---|
| Pass rate | {B}% | {C}% | {delta}% | ≥ -5% |
| p95 latency | {B}ms | {C}ms | {delta}% | ≤ +20% |
| Cost/call | ${B} | ${C} | {delta}% | ≤ +10% |

Thresholds from `eval_principles.regression_threshold` in agent config.

### Step 3 — Classify decision

| Condition | Decision |
|---|---|
| All deltas within thresholds | PASS |
| Any dimension drops > threshold | REGRESSION |
| All dimensions improve significantly | IMPROVEMENT |
| Some improve, some regress | MIXED |

**MIXED decision requires explicit stakeholder call:** is the trade-off acceptable?

### Step 4 — Case-level analysis

For each case that changed status (pass → fail or fail → pass):

- Record the input, baseline output, candidate output
- Tag with change type: regression / fix / behavioral-shift

### Step 5 — Update prompt card

If decision = PASS or IMPROVEMENT:

- Bump prompt version (semantic: MAJOR for behavioral change, MINOR for refinement)
- Add entry to prompt card changelog
- Update baseline to candidate

If decision = REGRESSION or unacceptable MIXED:

- Document what regressed and why
- Return to design step

---

## Post-Conditions

```yaml
post-conditions:
  - [ ] Regression report generated with delta table
    blocker: true
  - [ ] Decision classified clearly
    blocker: true
  - [ ] Case-level analysis for changed cases
    blocker: true
  - [ ] Prompt card updated if passing
    blocker: false
```
