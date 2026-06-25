# Data Classification Task

Classify personal and sensitive data in a story to determine applicable privacy requirements before development starts.

**Reference:** Privacy by Design Principle 1 (Proactive, not Reactive), GDPR Article 4/9, ISO 27701, NIST Privacy Framework.

---

## Task Definition

```yaml
task: dataClassification()
responsavel: Pax (Balancer)
responsavel_type: Agente
atomic_layer: Atom

Entrada:
  - campo: story_id
    tipo: string
    obrigatorio: true

Saida:
  - campo: data_classification_report
    tipo: file
    destino: docs/stories/{story_id}/privacy/data-classification.md
    persistido: true

  - campo: privacy_gate_required
    tipo: boolean
    destino: story_file (metadata)
    persistido: true
```

---

## Classification Framework

### Data Categories

| Category | Examples | Baseline Protection |
|---|---|---|
| **Public** | Company name, public description | No special requirements |
| **Internal** | Internal IDs, usage stats | Basic access control |
| **Confidential — Personal** | Name, email, phone, address | Privacy by Design required |
| **Confidential — Sensitive** | Health, religion, political views, financial | Explicit consent or legal basis required |
| **Confidential — Credentials** | Passwords, tokens, keys | Never store plaintext; encryption required |

### Processing Activities

For each data item in the story, identify:

| Data Item | Category | Collection Method | Storage Location | Retention | Legal Basis | Third-Party Shared |
|---|---|---|---|---|---|---|
| {item} | {category} | {how} | {where} | {how long} | {consent/legit interest/contract} | {yes/no — who} |

---

## Execution Steps

### Step 1 — Inventory data items

Read the story and list every data item that will be:

- Collected
- Stored
- Processed
- Transmitted
- Displayed to users

### Step 2 — Classify each item

Apply the framework above. Flag any item as **Confidential** or above.

### Step 3 — Determine privacy gate requirement

**Privacy gate IS required if any item is:**

- Confidential — Personal
- Confidential — Sensitive
- Collected from users without their direct provision
- Shared with third-party processors

**Privacy gate NOT required if:**

- All data is Public or Internal category
- No user-identifiable data involved

### Step 4 — Document and update story

If privacy gate required:

- Add `privacy_gate_required: true` to story metadata
- Block story from moving to `em-progresso` until PIA completed
- Tag story with `privacy-review` label

---

## Post-Conditions

```yaml
post-conditions:
  - [ ] All data items in story classified
    blocker: true
  - [ ] Privacy gate requirement determined
    blocker: true
  - [ ] Story metadata updated if gate required
    blocker: true
```
