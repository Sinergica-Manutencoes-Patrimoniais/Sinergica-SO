# Define SLO Task

Define SLI (Service Level Indicator), SLO (Service Level Objective), and error-budget policy for a service or user-facing capability.

**Reference:** Google SRE Book chapter 4 (Service Level Objectives), The Site Reliability Workbook chapter 2.

---

## Execution Modes

**Choose your execution mode:**

### 1. YOLO Mode — Fast, Autonomous (0-1 prompts)

- Reads service metadata, proposes SLO based on tier defaults
- **Best for:** Standard services with known patterns

### 2. Interactive Mode — Balanced, Educational (5-10 prompts) **[DEFAULT]**

- Walks through SLI selection, target negotiation, error-budget policy
- **Best for:** First SLO for a service, training

### 3. Pre-Flight Planning — Comprehensive Upfront

- Multi-stakeholder workshop: product, engineering, on-call
- **Best for:** Customer-facing flagship services

**Parameter:** `mode` (optional, default: `interactive`)

---

## Task Definition (TRIVIAIOX Task Format V1.0)

```yaml
task: defineSlo()
responsavel: Rex (Sentinel)
responsavel_type: Agente
atomic_layer: Molecule

Entrada:
  - campo: service_id
    tipo: string
    origem: User Input
    obrigatorio: true
    validacao: Must match service in service catalog

  - campo: user_journey
    tipo: string
    origem: User Input
    obrigatorio: true
    validacao: Description of the user-facing capability being measured

  - campo: tier
    tipo: enum
    origem: User Input or service metadata
    obrigatorio: false
    validacao: tier-1 | tier-2 | tier-3 (default: tier-2)

Saida:
  - campo: slo_document
    tipo: file
    destino: docs/slo/{service_id}.md
    persistido: true

  - campo: alert_rules
    tipo: file
    destino: ops/alerts/{service_id}-burn-rate.yaml
    persistido: true
```

---

## Pre-Conditions

```yaml
pre-conditions:
  - [ ] Service exists and has at least one entry point instrumented
    blocker: true
    validacao: At least basic request-count metric available

  - [ ] User journey identified and described in plain language
    blocker: true
    validacao: user_journey input is non-empty

  - [ ] Telemetry backend reachable
    blocker: false
    validacao: Connection check to OTLP endpoint
```

---

## Execution Steps

### Step 1 — Identify the SLI

Choose one or more SLI types appropriate to the user journey:

- **Availability:** `successful_requests / total_requests` over rolling window
- **Latency:** `requests faster than threshold / total_requests` (e.g., p95 < 500ms)
- **Quality:** Domain-specific success measure (e.g., LLM eval pass rate, page rendered without error)
- **Freshness:** Time since last successful update for data products

**Anti-pattern:** Resource-utilization metrics (CPU%, memory) are NOT SLIs. They are signals for capacity planning.

### Step 2 — Set the SLO target

Negotiate target with stakeholders. Reference defaults by tier:

- **tier-1 (revenue-critical):** 99.9% availability, p95 latency targets specific to journey
- **tier-2 (customer-facing, non-revenue):** 99.5% availability
- **tier-3 (internal/batch):** 99.0% availability or freshness-based

State the target with explicit window: `99.5% over rolling 30 days`.

### Step 3 — Compute the error budget

`error_budget = 1 - slo_target`

- 99.5% over 30d → 3.6 hours of allowed bad-minute equivalent
- 99.9% over 30d → 43 minutes
- 99.99% over 30d → 4.3 minutes

Document budget consumption policy:

- < 50% consumed: normal operations, ship features
- 50-80% consumed: caution mode, prioritize reliability work
- > 80% consumed: feature freeze for the service, focus on reliability

### Step 4 — Define burn-rate alerts

Multi-window multi-burn-rate alerting (Google SRE Workbook chapter 5):

- **Fast burn:** 2% of monthly budget in 1 hour → page
- **Slow burn:** 10% of monthly budget in 6 hours → ticket

### Step 5 — Document and review

Output to `docs/slo/{service_id}.md` with:

- Service identity and owner
- User journey
- SLI definition with metric query
- SLO target and window
- Error budget and consumption policy
- Burn-rate alert rules
- Review cadence (monthly minimum, after every postmortem)

---

## Post-Conditions

```yaml
post-conditions:
  - [ ] SLO document exists at docs/slo/{service_id}.md
    blocker: true

  - [ ] Alert rules generated at ops/alerts/{service_id}-burn-rate.yaml
    blocker: true

  - [ ] Stakeholder sign-off recorded (product + engineering owner)
    blocker: false

  - [ ] Linked from service catalog
    blocker: false
```

---

## Anti-patterns to Avoid

- Choosing SLI based on what's easy to measure rather than what users feel
- Setting 100% target — leaves zero error budget for change
- Single-window alerts (catch up too slow or page too often)
- SLOs with no consumption policy — budget becomes meaningless
- Skipping monthly review — SLOs that drift from reality lose authority
