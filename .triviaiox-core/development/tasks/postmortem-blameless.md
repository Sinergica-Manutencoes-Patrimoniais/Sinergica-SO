# Postmortem Blameless Task

Facilitate a blameless postmortem after a SEV1 or customer-impacting SEV2 incident. Goal: find system and process improvements, never individuals to blame.

**Reference:** Google SRE Book chapter 15 (Postmortem Culture), John Allspaw's "Blameless PostMortems and a Just Culture" (2012).

---

## Execution Modes

### 1. YOLO Mode — Generate postmortem draft from incident record

### 2. Interactive Mode — Facilitated retrospective with team **[DEFAULT]**

**Parameter:** `mode` (optional, default: `interactive`)

---

## Task Definition

```yaml
task: postmortemBlameless()
responsavel: Rex (Sentinel)
responsavel_type: Agente
atomic_layer: Molecule

Entrada:
  - campo: incident_record
    tipo: file_path
    obrigatorio: true
    validacao: ops/incidents/{date}-{slug}.md must exist

  - campo: attendees
    tipo: array
    obrigatorio: false
    validacao: People with context — IC, tech lead, on-call

Saida:
  - campo: postmortem_doc
    tipo: file
    destino: ops/postmortems/{YYYY-MM-DD}-{slug}.md
    persistido: true

  - campo: action_items
    tipo: array
    destino: backlog via @po
    persistido: true
```

---

## Pre-Conditions

```yaml
pre-conditions:
  - [ ] Incident declared resolved (status = Resolved)
    blocker: true
  - [ ] Timeline captured in incident record
    blocker: true
  - [ ] Conducted within 5 business days of incident
    blocker: false
    note: Delay erodes memory accuracy
```

---

## Execution Steps

### Step 1 — Establish blameless culture contract

Open every postmortem with this explicit statement:

> "We assume engineers acted with the best intentions given the information available at the time. Our goal is to understand the system and process, not assign blame. There are no mistakes here, only learning."

Record any deviation from this principle as a process failure.

### Step 2 — Reconstruct the timeline

Pull from incident record. Fill gaps by asking "what did you observe at that time?" — not "why did you do X?".

Timeline should answer:
- When did the problem start?
- When did we detect it?
- When did we understand it?
- When did we mitigate it?
- When did we resolve it?

Calculate key metrics:
- **MTTD** (mean time to detect)
- **MTTR** (mean time to mitigate)
- **MTTF** (time to full resolution)

### Step 3 — Identify contributing factors

Use the "5 Whys" technique starting from the customer impact, NOT from "human error":

```
Impact: customers experienced checkout failures for 47 minutes
↓ Why? Payment service returned 503s
↓ Why? Database connection pool exhausted
↓ Why? Black Friday traffic spike 3x above capacity plan
↓ Why? Capacity plan used last year's seasonality model
↓ Why? No automated forecast update process exists
↓ Root cause: Missing automation, not the engineer who ran the capacity review
```

**Forbidden language in postmortems:**
- "Engineer X failed to..."
- "Human error"
- "Careless mistake"
- "Should have known"

### Step 4 — Identify action items

Each contributing factor should have ≥ 1 action item:

| Action | Owner | Priority | Due |
|--------|-------|----------|-----|
| Automate capacity forecast on weekly cadence | @reliability | HIGH | 2 weeks |
| Add load shedding to payment service | @architect + @dev | HIGH | 1 sprint |
| Update runbook with connection pool symptoms | @reliability | MEDIUM | 3 days |

Action items go to backlog via @po with explicit priority.

### Step 5 — Share and iterate

- Circulate draft to attendees within 48h for accuracy corrections
- Publish final to `ops/postmortems/`
- Link from incident record
- Share key learnings with wider team (optional anonymized version)

---

## Post-Conditions

```yaml
post-conditions:
  - [ ] Postmortem doc published
    blocker: true
  - [ ] Action items added to backlog via @po
    blocker: true
  - [ ] Blameless tone verified — no individual blame language
    blocker: true
  - [ ] MTTD and MTTR recorded for DORA tracking
    blocker: false
```

---

## Anti-patterns

- "Root cause" framed as a person's decision
- Action items that say "be more careful" (not actionable)
- No due dates on action items
- Postmortem shared only with the team involved
- Written by IC alone without multiple perspectives
- Waiting more than 2 weeks — memory fades, learnings lose value
