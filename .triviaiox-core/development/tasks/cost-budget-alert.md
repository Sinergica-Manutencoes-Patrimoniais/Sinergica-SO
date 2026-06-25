# Cost Budget Alert Task

Define a cost budget for a service and set up alerts when spend approaches or exceeds the budget.

**Reference:** FinOps Foundation Framework (Operate phase), AWS Budgets, GCP Budget Alerts.

---

## Task Definition

```yaml
task: costBudgetAlert()
responsavel: Atlas (Decoder)
responsavel_type: Agente
atomic_layer: Atom

Entrada:
  - campo: service_id
    tipo: string
    obrigatorio: true

  - campo: monthly_budget_usd
    tipo: number
    obrigatorio: true

  - campo: alert_channel
    tipo: string
    obrigatorio: true
    validacao: teams_webhook | slack_webhook | email | pagerduty

Saida:
  - campo: budget_config
    tipo: file
    destino: ops/finops/{service_id}-budget.yaml
    persistido: true
```

---

## Budget Configuration

```yaml
budget:
  service_id: "{service_id}"
  monthly_budget_usd: {N}
  reset_day: 1  # Day of month budget resets

  alert_thresholds:
    - pct: 50
      type: informational
      action: Log to cost report
      message: "{service_id} has consumed 50% of monthly budget (${spent}/${budget})"

    - pct: 80
      type: warning
      action: Alert to {channel}
      message: "{service_id} has consumed 80% of monthly budget — review model routing"

    - pct: 100
      type: critical
      action: Alert to {channel} + create story via @po
      message: "{service_id} has EXCEEDED monthly budget — @analyst investigate immediately"

    - pct: 120
      type: critical_escalated
      action: Alert to {channel} + escalate to @reliability
      message: "{service_id} is 20% over budget — potential runaway cost detected"
```

## Implementation Options

### Option 1 — Application-side (no external service needed)

Compute cumulative cost from `cost_events` table at alert check time (run hourly via cron/edge function):

```sql
SELECT SUM(cost_usd) AS monthly_total
FROM cost_events
WHERE service_id = $1
  AND created_at >= DATE_TRUNC('month', NOW())
```

Compare to budget thresholds and trigger webhook.

### Option 2 — Provider-native (for provider-level budgets)

Set budget alerts in Anthropic Console, Apify billing, Replicate, etc. for each provider. Note: provider-native alerts have access to actual billing, not just instrumented estimates.

### Step — Define runbook for budget breach

When 100% threshold fires:

1. Pull cost report for current month: `*cost-report`
2. Run anomaly detection: `*cost-anomaly-detect`
3. Identify top cost driver
4. If anomaly: investigate and stop runaway process
5. If expected: review model routing with @prompt-engineer, create optimization story

---

## Post-Conditions

```yaml
post-conditions:
  - [ ] Budget config file created
    blocker: true
  - [ ] Alert thresholds defined for 50%, 80%, 100%, 120%
    blocker: true
  - [ ] Alert channel tested with sample message
    blocker: false
  - [ ] Runbook for budget breach documented
    blocker: false
```
