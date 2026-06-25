# On-Call Handoff Task

Generate an on-call handoff document that transfers context — not just the pager — from one engineer to the next.

**Reference:** Google SRE Book chapter 14, PagerDuty On-Call Best Practices.

---

## Task Definition

```yaml
task: oncallHandoff()
responsavel: Rex (Sentinel)
responsavel_type: Agente
atomic_layer: Atom

Entrada:
  - campo: service_scope
    tipo: array
    obrigatorio: true
    validacao: Services covered by this rotation

  - campo: from_engineer
    tipo: string
    obrigatorio: true

  - campo: to_engineer
    tipo: string
    obrigatorio: true

  - campo: period_start
    tipo: timestamp
    obrigatorio: true

  - campo: period_end
    tipo: timestamp
    obrigatorio: true

Saida:
  - campo: handoff_doc
    tipo: file
    destino: ops/oncall/handoffs/{YYYY-MM-DD}-{from}-to-{to}.md
    persistido: true
```

---

## Execution Steps

### Step 1 — Collect period summary

Pull from incident records and monitoring for the rotation period:

- Incidents declared (SEV1/SEV2/SEV3) with brief outcome
- Error budget burn during period (% consumed)
- Alerts that fired (and if false-positive)
- Notable deployments

### Step 2 — Generate handoff document

```markdown
## On-Call Handoff: {period_start} → {period_end}

**From:** {from_engineer}
**To:** {to_engineer}
**Services:** {service_scope}

### Period Summary
- Incidents: {count} ({SEV1 count} SEV1, {SEV2 count} SEV2, {SEV3 count} SEV3)
- Error budget consumed: {X}% for {service}
- Notable alerts: {summary}

### Open Items (require attention this rotation)
- [ ] {item} — {context} — Priority: {HIGH|MEDIUM|LOW}

### Known Issues to Watch
- {symptom} → usually caused by {cause} → check {runbook_link}

### Recent Changes (past 72h)
- {deploy description} — deployed {timestamp} — by {author}

### Runbooks Updated This Rotation
- {runbook} — {what changed}

### Toil This Rotation
- {toil description} — {time spent} — {ticket to eliminate it}
```

### Step 3 — Walk the new on-call through the doc

For SEV1-prone services: live handoff conversation, not async. Cover open items explicitly.

### Step 4 — Escalation contacts

Include names and contact methods for:

- Technical leads per service
- Product owner for customer-impact decisions
- Previous on-call (during overlap window)

---

## Post-Conditions

```yaml
post-conditions:
  - [ ] Handoff doc generated and shared
    blocker: true
  - [ ] New on-call acknowledged receipt
    blocker: false
  - [ ] Toil documented for elimination backlog
    blocker: false
```
