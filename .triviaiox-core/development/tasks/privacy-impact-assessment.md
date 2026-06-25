# Privacy Impact Assessment (PIA/DPIA) Task

Conduct a Privacy Impact Assessment for a story that introduces, modifies, or expands personal data processing.

**Reference:** GDPR Article 35 (DPIA requirement), ICO PIA code of practice, Privacy by Design Principle 2 (Privacy as Default).

---

## Task Definition

```yaml
task: privacyImpactAssessment()
responsavel: Pax (Balancer)
responsavel_type: Agente
atomic_layer: Molecule

Entrada:
  - campo: story_id
    tipo: string
    obrigatorio: true

  - campo: data_classification_path
    tipo: file_path
    obrigatorio: true
    validacao: data-classification.md must exist

Saida:
  - campo: pia_document
    tipo: file
    destino: docs/stories/{story_id}/privacy/pia.md
    persistido: true

  - campo: privacy_risks
    tipo: array
    destino: pia_document + story backlog
    persistido: true
```

---

## PIA Structure

### Section 1 — Processing Description

- What personal data is collected?
- For what purpose?
- Who collects it?
- Who has access?
- What is the legal basis? (Consent / Contract / Legitimate Interest / Legal Obligation / Vital Interest / Public Task)

### Section 2 — Necessity and Proportionality

For each data item:

| Data Item | Is it necessary for the stated purpose? | Could a less privacy-invasive alternative achieve the same goal? |
|---|---|---|
| {item} | Yes/No + rationale | {alternative if any} |

Remove or anonymize any data item where necessity is unclear.

### Section 3 — Risk Assessment

| Risk | Probability | Impact | Severity | Mitigation |
|---|---|---|---|---|
| Unauthorized access to {data} | Low/Medium/High | Low/Medium/High | {P×I} | {mitigation} |
| Data breach of {data} | — | — | — | Encryption at rest + in transit |
| Third-party misuse of {data} | — | — | — | DPA agreement |
| User right to deletion not handled | — | — | — | Implement delete endpoint |
| Data retained longer than necessary | — | — | — | Retention automation |

### Section 4 — User Rights Coverage

| Right | How it's implemented | Who handles requests |
|---|---|---|
| Right to access | {endpoint or process} | {team/agent} |
| Right to correction | {endpoint or process} | {team/agent} |
| Right to deletion | {endpoint or process} | {team/agent} |
| Right to portability | {endpoint or process} | {team/agent} |
| Right to object | {endpoint or process} | {team/agent} |

### Section 5 — Third-Party Processors

| Processor | Data shared | DPA status | Sub-processors |
|---|---|---|---|
| {name} | {data items} | Signed / Pending / N/A | {list} |

### Section 6 — Decision

| Decision | Rationale |
|---|---|
| APPROVED — proceed | All risks mitigated or accepted with documented rationale |
| APPROVED WITH CONDITIONS | Proceed with conditions listed below |
| BLOCKED | High-severity unmitigated risk; do not implement until resolved |

---

## Post-Conditions

```yaml
post-conditions:
  - [ ] All 6 PIA sections completed
    blocker: true
  - [ ] Legal basis documented for all personal data processing
    blocker: true
  - [ ] High-severity risks have mitigations
    blocker: true
  - [ ] User rights coverage documented
    blocker: false
  - [ ] Third-party DPA status confirmed
    blocker: false
```
