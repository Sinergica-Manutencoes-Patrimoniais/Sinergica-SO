# Define Error Budget Task

Translate an SLO target into an error-budget policy that governs feature velocity vs. reliability investment.

**Reference:** Google SRE Workbook chapter 8 (Implementing SLOs), Niall Murphy's error-budget policy templates.

---

## Execution Modes

### 1. YOLO Mode — Apply standard policy from tier defaults

### 2. Interactive Mode — Negotiate thresholds with stakeholders **[DEFAULT]**

### 3. Pre-Flight Planning — Multi-team policy with explicit escalations

**Parameter:** `mode` (optional, default: `interactive`)

---

## Task Definition

```yaml
task: defineErrorBudget()
responsavel: Rex (Sentinel)
responsavel_type: Agente
atomic_layer: Molecule

Entrada:
  - campo: service_id
    tipo: string
    obrigatorio: true

  - campo: slo_target
    tipo: number
    obrigatorio: true
    validacao: 0 < target < 1 (e.g., 0.995 for 99.5%)

  - campo: window_days
    tipo: number
    obrigatorio: false
    validacao: Default 30

Saida:
  - campo: error_budget_policy
    tipo: file
    destino: docs/slo/{service_id}-error-budget.md
    persistido: true
```

---

## Pre-Conditions

```yaml
pre-conditions:
  - [ ] SLO already defined for service
    blocker: true
  - [ ] Product owner identified for sign-off
    blocker: false
```

---

## Execution Steps

### Step 1 — Compute budget

`error_budget = (1 - slo_target) * window_minutes`

| SLO | 30-day budget |
|-----|---------------|
| 99.0% | 7h 12m |
| 99.5% | 3h 36m |
| 99.9% | 43m |
| 99.99% | 4m 19s |
| 99.999% | 26s |

### Step 2 — Define consumption tiers and policy

```yaml
budget_consumption:
  green: # < 50% consumed
    posture: Normal operations
    feature_velocity: Full
    on_call_escalation: Standard
    examples:
      - Ship features
      - Refactor without freeze
      - Run experiments

  yellow: # 50-80% consumed
    posture: Caution
    feature_velocity: Reduced — prioritize reliability stories
    on_call_escalation: Earlier paging on borderline cases
    examples:
      - Skip non-critical refactors
      - Add resilience tests before risky changes
      - Daily error-budget review

  red: # > 80% consumed
    posture: Freeze
    feature_velocity: Reliability-only stories until budget recovers
    on_call_escalation: Auto-escalate after first attempt
    required_actions:
      - Postmortem for incidents that consumed budget
      - Reliability-focused sprint
      - Stakeholder briefing if budget exhausted twice in a row
```

### Step 3 — Define burn-rate alerts

Multi-window multi-burn-rate (SRE Workbook chapter 5):

```yaml
alerts:
  - name: fast-burn
    condition: 2% of monthly budget consumed in 1 hour
    severity: page
    channel: oncall

  - name: slow-burn
    condition: 10% of monthly budget consumed in 6 hours
    severity: ticket
    channel: team

  - name: budget-exhausted
    condition: > 100% consumed
    severity: page
    channel: oncall + product
```

### Step 4 — Define exit criteria

When in red tier, what brings service back to yellow/green:

- Burn rate < 1x for 7 consecutive days
- Postmortems for all SEV1/SEV2 in window have shipped action items
- New SLI showing improvement trend

### Step 5 — Get stakeholder sign-off

Required signatures:

- Product owner (acknowledges feature-velocity impact)
- Engineering owner (commits to reliability investment when red)
- Reliability engineer (validates feasibility of targets)

---

## Post-Conditions

```yaml
post-conditions:
  - [ ] Policy document published at docs/slo/{service_id}-error-budget.md
    blocker: true
  - [ ] Burn-rate alerts active in monitoring backend
    blocker: true
  - [ ] Stakeholders signed off in writing
    blocker: false
```

---

## Anti-patterns

- Budget defined but never enforced — feature-freeze rule ignored
- Only single-window alerts (page-fatigue or miss fast burns)
- Budget reset at calendar boundaries instead of rolling window
- No exit criteria — services stuck in red indefinitely
- Treating budget as an entitlement to spend rather than a signal
