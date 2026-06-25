# Chaos Experiment Task

Design and execute a controlled chaos engineering experiment to validate system resilience before production discovers it for you.

**Reference:** Principles of Chaos Engineering (principlesofchaos.org), Netflix Chaos Monkey, AWS Fault Injection Simulator.

---

## Execution Modes

### 1. YOLO Mode — Run standard hypothesis against known blast radius

### 2. Interactive Mode — Hypothesis-driven experiment design **[DEFAULT]**

### 3. Pre-Flight Planning — Full game-day with stakeholders

**Parameter:** `mode` (optional, default: `interactive`)

---

## Task Definition

```yaml
task: chaosExperiment()
responsavel: Rex (Sentinel)
responsavel_type: Agente
atomic_layer: Molecule

Entrada:
  - campo: hypothesis
    tipo: string
    obrigatorio: true
    validacao: "We believe {service} will {behavior} when {condition}"

  - campo: blast_radius
    tipo: enum
    obrigatorio: true
    validacao: dev | staging | production-canary | production

  - campo: rollback_plan
    tipo: string
    obrigatorio: true

Saida:
  - campo: experiment_record
    tipo: file
    destino: ops/chaos/{YYYY-MM-DD}-{slug}.md
    persistido: true
```

---

## Pre-Conditions

```yaml
pre-conditions:
  - [ ] Hypothesis formed using scientific format
    blocker: true
  - [ ] Rollback plan defined before experiment starts
    blocker: true
  - [ ] Blast radius approved — production experiments require on-call paged
    blocker: true
  - [ ] SLO baseline measured (steady state)
    blocker: true
```

---

## Execution Steps

### Step 1 — Form the hypothesis

Required format:

> "We believe **[service/system]** will **[expected behavior]** when **[failure condition]**, as evidenced by **[observable signal]** staying within **[acceptable bounds]**."

Example:

> "We believe the qualifier agent will gracefully degrade to synchronous processing when the Redis queue is unavailable, as evidenced by p99 latency remaining below 10s and zero data loss."

### Step 2 — Define steady state

Before injecting failure, measure:

- Current SLI values (availability, latency, quality)
- Error rate baseline
- Expected normal variance

This is the baseline you compare against during the experiment.

### Step 3 — Choose failure injection method

| Failure Class | Injection Methods |
|---------------|------------------|
| Network | latency injection, packet loss, DNS failure, partition |
| Resource | CPU contention, memory pressure, disk full |
| Dependency | timeout, 500 error, TLS cert expire, auth failure |
| Data | corrupt payload, schema mismatch, stale cache |
| Process | kill service instance, deploy bad config, kill queue consumer |
| LLM-specific | model timeout, context overflow, rate limit hit, token budget exceeded |

### Step 4 — Execute with monitoring

Run experiment against defined blast radius:

- Start at smallest blast radius, expand only if steady state maintained
- Observe SLI signals in real time against steady-state baseline
- Any SLO breach → abort immediately, restore, record

Record every observation in the experiment log with timestamps.

### Step 5 — Analyze results

Did the hypothesis hold?

- **Confirmed:** system behaved as expected — document as confidence evidence
- **Partial:** system degraded gracefully but differently than expected — update runbooks
- **Refuted:** system failed ungracefully — create stories for resilience improvements

### Step 6 — Document and share

Publish `ops/chaos/{date}-{slug}.md`:

- Hypothesis
- Steady state baseline
- Failure injected
- Observations
- Result (confirmed/partial/refuted)
- Action items (stories for @po if refuted)

---

## Post-Conditions

```yaml
post-conditions:
  - [ ] Hypothesis outcome recorded
    blocker: true
  - [ ] Steady state restored and confirmed
    blocker: true
  - [ ] Action items created if hypothesis refuted
    blocker: false
  - [ ] Runbooks updated based on observations
    blocker: false
```

---

## Anti-patterns

- Running experiments without a rollback plan
- Production experiments without on-call awareness
- No baseline measurement — can't tell if experiment changed anything
- "Let's see what happens" without a hypothesis — it's testing, not chaos engineering
- Blast radius too large for first experiment
- Not sharing results — game-day learnings die with the team
