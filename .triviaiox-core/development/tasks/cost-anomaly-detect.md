# Cost Anomaly Detect Task

Detect cost anomalies and regressions vs baseline. Designed to run on a schedule or triggered by monitoring.

**Reference:** FinOps Foundation anomaly detection patterns, AWS Cost Anomaly Detection methodology.

---

## Task Definition

```yaml
task: costAnomalyDetect()
responsavel: Atlas (Decoder)
responsavel_type: Agente
atomic_layer: Atom

Entrada:
  - campo: service_id
    tipo: string
    obrigatorio: true

  - campo: window_hours
    tipo: number
    obrigatorio: false
    validacao: Default 24

  - campo: baseline_period_days
    tipo: number
    obrigatorio: false
    validacao: Default 7

Saida:
  - campo: anomaly_report
    tipo: object
    destino: return value + optional alert trigger
    persistido: false

  - campo: alert_triggered
    tipo: boolean
    destino: monitoring backend
    persistido: false
```

---

## Detection Algorithm

### Statistical method

Compute rolling stats for each metric (cost per run, cost per call, daily total):

```
rolling_mean = avg(last N days)
rolling_std = stddev(last N days)
z_score = (current_value - rolling_mean) / rolling_std

if z_score > 2.5: ANOMALY (p99 threshold)
if z_score > 1.8: WARNING (p97 threshold)
```

### Regression method (vs stored baseline)

```
delta = (current - baseline) / baseline
if delta > 0.30: COST_REGRESSION (>30% increase)
if delta > 0.10: COST_INCREASE (>10% increase, advisory)
```

### Volume-adjusted cost

Always check if cost increase is explained by volume increase:

```
cost_per_unit = total_cost / total_runs
if cost_per_unit anomaly: genuine regression
if only total_cost anomaly: may be volume (OK)
```

## Anomaly Types

| Type | Condition | Severity | Action |
|---|---|---|---|
| Cost spike | z_score > 2.5 on cost_per_run | HIGH | Alert + investigate |
| Cost regression | delta > 30% vs baseline | HIGH | Alert + story |
| Volume spike | total cost up, cost_per_run stable | INFO | Log only |
| LLM tail latency | p95 tokens > 3x p50 | MEDIUM | Alert @prompt-engineer |
| Unknown source | cost event with source=unknown | HIGH | Alert + audit |

## Output Format

```json
{
  "service_id": "...",
  "window_hours": 24,
  "total_cost_window": 0.0,
  "anomalies": [
    {
      "type": "COST_REGRESSION",
      "metric": "cost_per_run_p95",
      "current": 0.15,
      "baseline": 0.09,
      "delta_pct": 66.7,
      "z_score": 3.1,
      "severity": "HIGH",
      "recommended_action": "Run cost-per-task-report, escalate to @prompt-engineer"
    }
  ],
  "warnings": [],
  "status": "ANOMALY_DETECTED"
}
```

## Escalation Path

- HIGH severity → Create story via @po, alert @analyst and @reliability
- MEDIUM → Add to weekly cost report
- INFO → Log for trend analysis only
