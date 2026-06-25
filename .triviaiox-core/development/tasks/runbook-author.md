# Runbook Author Task

Author a runbook for a known failure mode. Runbooks are versioned operational documents that an on-call engineer can execute under pressure.

**Reference:** Google SRE Book chapter 14, "Build Your Own Runbook" patterns.

---

## Execution Modes

### 1. YOLO Mode — Generate from postmortem action items

### 2. Interactive Mode — Author from scratch with template guidance **[DEFAULT]**

### 3. Pre-Flight Planning — Game-day-validated runbook

**Parameter:** `mode` (optional, default: `interactive`)

---

## Task Definition

```yaml
task: runbookAuthor()
responsavel: Rex (Sentinel)
responsavel_type: Agente
atomic_layer: Molecule

Entrada:
  - campo: failure_mode
    tipo: string
    obrigatorio: true
    validacao: Specific symptom or alert that triggers the runbook

  - campo: service_id
    tipo: string
    obrigatorio: true

  - campo: severity_default
    tipo: enum
    obrigatorio: false
    validacao: SEV1 | SEV2 | SEV3

Saida:
  - campo: runbook_file
    tipo: file
    destino: ops/runbooks/{service_id}/{slug}.md
    persistido: true
```

---

## Pre-Conditions

```yaml
pre-conditions:
  - [ ] Failure mode is observable (alert exists or symptom is detectable)
    blocker: true
  - [ ] Runbook template available
    blocker: true
  - [ ] At least one historical occurrence or game-day evidence
    blocker: false
```

---

## Execution Steps

### Step 1 — Frame the failure mode

State as a single sentence the on-call would see in an alert:

> "Latency burn-rate alert firing for service-X p95 above 1500ms"

NOT:

> "Performance issues" (too vague to act on)

### Step 2 — Use the runbook template

Load `templates/runbook-template.md`. Fill required sections:

1. **Symptom** — What the on-call sees (alert text, dashboard link, user report pattern)
2. **Severity guidance** — When to escalate from SEV3 → SEV2 → SEV1
3. **Detect** — How to confirm this is the real failure mode and not adjacent
4. **Diagnose** — Ordered diagnostic steps with expected outputs
5. **Mitigate** — Stop-the-bleeding actions (often before root cause is known)
6. **Resolve** — Root-cause resolution steps if known
7. **Verify** — How to confirm recovery
8. **Escalate** — Who to contact, when, with what context
9. **Postmortem trigger** — Conditions that require formal postmortem
10. **Related runbooks** — Cross-references to adjacent failures

### Step 3 — Write for the tired on-call at 3 AM

Style guide:

- **Imperative voice:** "Run this query" not "you might want to run"
- **Copy-pasteable commands** with expected output snippet
- **Decision trees** for branching paths, not prose
- **Time-boxed steps:** "If no improvement after 5 minutes, escalate"
- **Assume zero context:** include service identity, environment, and how to find auth credentials

### Step 4 — Add observability links

- Dashboard URL for this service
- Saved trace search for the symptom
- Log query for the symptom
- Recent deploy timeline

### Step 5 — Game-day validation

Before publishing, simulate the failure (or replay from postmortem):

- Have a teammate execute the runbook with no prior knowledge
- Time each step
- Note where they got stuck or confused
- Iterate until a cold-start engineer can execute end-to-end

### Step 6 — Version and review

- Commit runbook to repo (handoff to @devops for PR)
- Schedule quarterly review or trigger after each related incident
- Add to runbook index

---

## Post-Conditions

```yaml
post-conditions:
  - [ ] Runbook follows template structure
    blocker: true
  - [ ] All commands tested in staging or against production replica
    blocker: true
  - [ ] Game-day simulated with someone other than author
    blocker: false
  - [ ] Linked from alert configuration
    blocker: false
```

---

## Anti-patterns

- Runbooks that explain "what" but not "what to do"
- Commands that require tribal knowledge (env vars, auth) without instructions
- No mitigate-first guidance — on-call paralyzed by RCA pressure
- Runbooks that grow stale because they're never reviewed
- Single huge runbook for a service instead of one per failure mode
