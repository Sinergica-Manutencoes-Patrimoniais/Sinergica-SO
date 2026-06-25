# Incident Declare Task

Declare a production incident, assign an Incident Commander, open a war-room channel, and start the incident timeline.

**Reference:** Google SRE Book chapter 14 (Managing Incidents), PagerDuty Incident Response Guide.

---

## Execution Modes

### 1. YOLO Mode — Auto-declare based on alert context

### 2. Interactive Mode — Guided declaration with stakeholder check **[DEFAULT]**

**Parameter:** `mode` (optional, default: `interactive`)

---

## Task Definition

```yaml
task: incidentDeclare()
responsavel: Rex (Sentinel)
responsavel_type: Agente
atomic_layer: Molecule

Entrada:
  - campo: symptom
    tipo: string
    obrigatorio: true
    validacao: Alert text or observed user impact description

  - campo: severity
    tipo: enum
    obrigatorio: true
    validacao: SEV1 | SEV2 | SEV3

  - campo: affected_services
    tipo: array
    obrigatorio: true

Saida:
  - campo: incident_record
    tipo: file
    destino: ops/incidents/{YYYY-MM-DD}-{slug}.md
    persistido: true

  - campo: timeline_start
    tipo: timestamp
    destino: incident_record
    persistido: true
```

---

## Pre-Conditions

```yaml
pre-conditions:
  - [ ] Symptom confirmed observable (not test alert)
    blocker: true
  - [ ] Severity determined using severity framework
    blocker: true
```

---

## Execution Steps

### Step 1 — Assess severity (30 seconds)

Use the severity framework:

| Severity | Criterion | Response |
|----------|-----------|----------|
| SEV1 | Customer-facing outage or data loss | Page immediately, declare now |
| SEV2 | Degraded customer experience, partial failure | Page on-call, investigate |
| SEV3 | Internal-only, no customer impact | Ticket, no page |

**When in doubt, declare higher** — easier to downgrade than to upgrade late.

### Step 2 — Declare and open record

Create `ops/incidents/{YYYY-MM-DD}-{slug}.md` from postmortem template sections:

```
## Incident: {slug}
**Declared:** {timestamp UTC}
**Severity:** {SEV1/2/3}
**IC (Incident Commander):** {name}
**Status:** Investigating

### Affected Services
- {service}

### Symptom
{alert text or observed behavior}

### Timeline
| Time (UTC) | Event |
|------------|-------|
| {declared} | Incident declared |
```

### Step 3 — Assign roles (SEV1/SEV2 only)

- **Incident Commander (IC):** coordinates response, owns communication
- **Technical Lead:** directs investigation and mitigation
- **Communications Lead:** external/stakeholder updates (SEV1 only)

Single engineer can hold IC + Technical Lead for SEV2. Never add people without a role.

### Step 4 — Establish communication rhythm

- **SEV1:** status update every 30 minutes to stakeholders, hourly to external
- **SEV2:** update every 4 hours or on status change
- **SEV3:** update in ticket when resolved

### Step 5 — Mitigation over RCA

Explicit rule: **prioritize user impact mitigation before root cause investigation**. Acceptable mitigations:

- Roll back last deploy
- Disable feature flag
- Scale up resource
- Route traffic to healthy region
- Kill an agent loop

Record each mitigation attempt in timeline even if unsuccessful.

### Step 6 — Declare resolved

When user impact is confirmed gone:

- Update status to Resolved
- Record time to mitigate (TTM) and time to resolve (TTR)
- Trigger postmortem if SEV1 or SEV2 with customer impact
- Update stakeholders with resolution summary

---

## Post-Conditions

```yaml
post-conditions:
  - [ ] Incident record created with timeline
    blocker: true
  - [ ] Roles assigned (IC at minimum)
    blocker: true
  - [ ] Communication rhythm established for SEV1/SEV2
    blocker: false
  - [ ] Mitigation attempted before RCA
    blocker: false
  - [ ] Postmortem scheduled if SEV1 or customer-impacting SEV2
    blocker: false
```

---

## Anti-patterns

- Starting RCA before mitigating user impact
- Adding people without explicit roles (bystander effect)
- No timeline — reconstruction after incident is unreliable
- Skipping declaration for "probably fine" situations — incident log gap
- IC doing technical work — coordination and investigation cannot share a brain
