# Cost Per Task Report Task

Generate a cost intelligence report for a service or pipeline over a time period.

**Reference:** FinOps Foundation Framework (Inform phase), cloud cost reporting best practices.

---

## Task Definition

```yaml
task: costPerTaskReport()
responsavel: Atlas (Decoder)
responsavel_type: Agente
atomic_layer: Atom

Entrada:
  - campo: service_id
    tipo: string
    obrigatorio: true

  - campo: period
    tipo: object
    obrigatorio: true
    validacao: "{start: YYYY-MM-DD, end: YYYY-MM-DD}"

  - campo: cost_schema_path
    tipo: file_path
    obrigatorio: true

Saida:
  - campo: cost_report
    tipo: file
    destino: docs/finops/reports/{service_id}-{period}.md
    persistido: true
```

---

## Execution Steps

### Step 1 — Pull cost data

Query cost rollup views for the period:

- Total cost for period
- Cost by source (LLM, scraper, image gen, etc.)
- Cost by story/task
- Daily trend (cost per day)
- P50/P95 cost per pipeline run (if applicable)

### Step 2 — Compare to baseline or previous period

| Metric | Previous Period | Current Period | Delta |
|---|---|---|---|
| Total cost | ${prev} | ${curr} | {+/-}% |
| Cost per run (p50) | ${prev} | ${curr} | {+/-}% |
| Cost per run (p95) | ${prev} | ${curr} | {+/-}% |
| LLM share | {prev}% | {curr}% | — |
| Top cost driver | {prev} | {curr} | — |

### Step 3 — Identify top 3 cost drivers

Rank sources and task types by total spend. For each top driver:

- What is it?
- Is the cost expected given volume?
- Is there a cost regression vs baseline?

### Step 4 — Flag anomalies

An anomaly is a cost-per-run that's > 2 standard deviations above rolling 7-day mean.

List each anomaly: date, task, cost, vs expected.

### Step 5 — Recommendations

Based on data:

- If LLM cost is > 80% of total and pass rate is high: evaluate Haiku tier for qualifying steps
- If scraper cost spikes on weekends: investigate parallelism configuration
- If cost per run p95 > 5x p50: long-tail outlier — investigate expensive cases

### Step 6 — Publish report

Write `docs/finops/reports/{service_id}-{period}.md` with:

- Executive summary (3 bullets)
- Cost table
- Trend chart (ASCII or link to dashboard)
- Anomalies
- Recommendations

---

## Post-Conditions

```yaml
post-conditions:
  - [ ] Report generated with cost table and period comparison
    blocker: true
  - [ ] Anomalies identified (or "none found" explicitly stated)
    blocker: true
  - [ ] Recommendations provided
    blocker: false
```
